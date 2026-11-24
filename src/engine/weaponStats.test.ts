import { describe, it, expect } from 'vitest';
import type { ItemInstance, Weapon } from './types';
import { weaponStatParts, profilDArme, degatsConditionnels, rangeSpecLabel, ammoRangeModLabel, conditionalDamageNote } from './weaponStats';

const item = (o: Partial<ItemInstance>): ItemInstance =>
  ({ uid: 'u', label: 'x', kind: 'melee', qualities: [], enc: 0, equipped: false, ...o }) as ItemInstance;

/** Le texte du profil de `it` pour un porteur de BF `bf`. */
const texte = (it: ItemInstance | Weapon, bf: number): string[] => weaponStatParts(profilDArme(it, { bf, passif: 0 }));

describe('profilDArme (le profil mécanique d’une arme pour son porteur, en données)', () => {
  it('mêlée : formule et total au BF, Allonge, sans Portée', () => {
    expect(profilDArme(item({ damage: { plusBF: true, flat: 4 }, reach: 'Longue' }), { bf: 3, passif: 0 }))
      .toEqual({ degats: { formule: { plusBF: true, flat: 4 }, total: 7 }, portee: null, allonge: 'Longue', conditionnels: [] });
  });

  it('distance : la Portée en mètres, l’Allonge nulle (LDB 62)', () => {
    expect(profilDArme(item({ kind: 'distance', damage: { plusBF: true, flat: 3 }, range: 50, reach: 'Moyenne' }), { bf: 4, passif: 0 }))
      .toEqual({ degats: { formule: { plusBF: true, flat: 3 }, total: 7 }, portee: 50, allonge: null, conditionnels: [] });
  });

  it('arme de jet : Portée résolue au BF (spec {bf} → BF×N)', () => {
    expect(profilDArme(item({ kind: 'distance', damage: { plusBF: true, flat: 0, bare: true }, range: { bf: 3 } }), { bf: 4, passif: 0 }).portee).toBe(12);
    expect(profilDArme(item({ kind: 'distance', damage: { literal: 'Spécial' }, range: { bf: 3 } }), { bf: 2, passif: 0 }).portee).toBe(6);
  });

  it('Dégâts littéraux : total 0 ; sans Dégâts : `degats` nul', () => {
    expect(profilDArme(item({ damage: { literal: 'Spécial' } }), { bf: 3, passif: 0 }).degats).toEqual({ formule: { literal: 'Spécial' }, total: 0 });
    expect(profilDArme(item({ damage: undefined, reach: 'Courte' }), { bf: 3, passif: 0 }).degats).toBeNull();
  });
});

describe('weaponStatParts (le profil d’une arme en texte)', () => {
  it('mêlée : « Dégâts +BF+4 (7) · Allonge Longue »', () => {
    expect(texte(item({ damage: { plusBF: true, flat: 4 }, reach: 'Longue' }), 3)).toEqual(['Dégâts +BF+4 (7)', 'Allonge Longue']);
  });

  it('distance : Portée en mètres, pas d’Allonge (range prime)', () => {
    expect(texte(item({ kind: 'distance', damage: { plusBF: true, flat: 3 }, range: 50 }), 4)).toEqual(['Dégâts +BF+3 (7)', 'Portée 50 m']);
  });

  it('Dégâts plats sans BF (« +9 ») : total = la valeur fixe', () => {
    expect(texte(item({ damage: { plusBF: false, flat: 9 } }), 5)).toEqual(['Dégâts +9 (9)']);
  });

  it('Dégâts littéraux (« Spécial ») : total 0', () => {
    expect(texte(item({ damage: { literal: 'Spécial' }, reach: 'Moyenne' }), 3)).toEqual(['Dégâts Spécial (0)', 'Allonge Moyenne']);
  });

  it('sans Dégâts : seule l’Allonge sort', () => {
    expect(texte(item({ damage: undefined, reach: 'Courte' }), 3)).toEqual(['Allonge Courte']);
  });

  it('accepte un Weapon dérivé (armes EN MAIN)', () => {
    const w: Weapon = { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, reach: 'Moyenne', qualities: [] };
    expect(texte(w, 3)).toEqual(['Dégâts +BF+4 (7)', 'Allonge Moyenne']);
  });

  it('arme de JET : Portée RÉSOLUE en mètres avec le BF', () => {
    expect(texte(item({ kind: 'distance', damage: { plusBF: true, flat: 0, bare: true }, range: { bf: 3 } }), 4)).toEqual(['Dégâts +BF (4)', 'Portée 12 m']);
    expect(texte(item({ kind: 'distance', damage: { literal: 'Spécial' }, range: { bf: 3 } }), 2)).toEqual(['Dégâts Spécial (0)', 'Portée 6 m']);
  });
});

describe('degatsConditionnels — #135 : dégâts CONDITIONNELS dérivés des capacités de qualité (ram/siège), en données', () => {
  it('Bélier (qualities siege+belier, ADE II 8 l.249/292) : porte uniquement, repli Arme improvisée (+BF+1), ×2 contre une structure', () => {
    expect(degatsConditionnels({ qualities: [{ id: 'siege' }, { id: 'belier' }], damage: { plusBF: true, flat: 10 } }))
      .toEqual([{ genre: 'belier', repli: { plusBF: true, flat: 1 } }, { genre: 'siege', mult: 2 }]);
  });

  it('sans dégâts imprimés mais effet À LA TOUCHE : `aLaTouche` ; sans l’un ni l’autre : aucune', () => {
    expect(degatsConditionnels({ qualities: [], damage: null, onHitEffects: [{ trigger: 'onHit' } as never] })).toEqual([{ genre: 'aLaTouche' }]);
    expect(degatsConditionnels({ qualities: [], damage: null })).toEqual([]);
  });
  it('une condition de qualité exclut `aLaTouche`', () => {
    expect(degatsConditionnels({ qualities: [{ id: 'siege' }], damage: null, onHitEffects: [{ trigger: 'onHit' } as never] })).toEqual([{ genre: 'siege', mult: 2 }]);
  });
});

describe('conditionalDamageNote — la note des dégâts conditionnels', () => {
  it('Bélier : porte-uniquement + ×2 structure', () => {
    const belier = { qualities: [{ id: 'siege' }, { id: 'belier' }], damage: { plusBF: true, flat: 10 } };
    expect(conditionalDamageNote(belier)).toBe('contre une porte uniquement — sinon Arme improvisée (+BF+1) · ×2 contre une structure');
  });

  it('Atout Siège seul (canon, ADE II 08 l.292) : uniquement la note ×2', () => {
    expect(conditionalDamageNote({ qualities: [{ id: 'siege' }], damage: { plusBF: false, flat: 20 } })).toBe('×2 contre une structure');
  });

  it('arme normale (aucune capacité conditionnelle) : aucune note', () => {
    expect(conditionalDamageNote({ qualities: [{ id: 'pointue' }], damage: { plusBF: true, flat: 4 } })).toBeNull();
  });

  it('sans dégâts imprimés mais effet À LA TOUCHE : badge générique', () => {
    expect(conditionalDamageNote({ qualities: [], damage: null, onHitEffects: [{ trigger: 'onHit' } as never] })).toBe('Dégâts conditionnels — voir Effets');
  });

  it('sans dégâts ET sans effet à la touche (ex. armure/munition) : aucune note', () => {
    expect(conditionalDamageNote({ qualities: [], damage: null })).toBeNull();
  });
});

describe('weaponStatParts — reporte la note conditionnelle EN PARTIE SUPPLÉMENTAIRE (#135)', () => {
  it('Bélier tenu en main : « Dégâts…·Allonge…·note conditionnelle »', () => {
    const w: Weapon = { label: 'Bélier', type: 'melee', damage: { plusBF: true, flat: 10 }, reach: 'Moyenne', qualities: [{ id: 'siege' }, { id: 'belier' }] };
    expect(texte(w, 4)).toEqual([
      'Dégâts +BF+10 (14)',
      'Allonge Moyenne',
      'contre une porte uniquement — sinon Arme improvisée (+BF+1) · ×2 contre une structure',
    ]);
  });
});

describe('rangeSpecLabel (catalogue : formule sans BF de porteur)', () => {
  it('number → « N m » ; {bf} → « BF×k m » ; null → null', () => {
    expect(rangeSpecLabel(50)).toBe('50 m');
    expect(rangeSpecLabel({ bf: 3 })).toBe('BF×3 m');
    expect(rangeSpecLabel(null)).toBeNull();
    expect(rangeSpecLabel(undefined)).toBeNull();
  });
});

describe('ammoRangeModLabel (modificateur de Portée d’une munition)', () => {
  it('{mult} → « ×½ »/« ×¼ » ; {add} → « +50 m »/« -10 m » ; null → null', () => {
    expect(ammoRangeModLabel({ mult: 0.5 })).toBe('×½');
    expect(ammoRangeModLabel({ mult: 0.25 })).toBe('×¼');
    expect(ammoRangeModLabel({ add: 50 })).toBe('+50 m');
    expect(ammoRangeModLabel({ add: -10 })).toBe('-10 m');
    expect(ammoRangeModLabel(null)).toBeNull();
  });
});
