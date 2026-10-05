import { describe, it, expect } from 'vitest';
import type { ItemInstance, Weapon } from '../engine/types';
import { weaponStatParts, rangeSpecLabel, ammoRangeModLabel, conditionalDamageNote } from './weaponStats';
import { objetDeTest } from '../engine/objetDeTest.testkit';
import { type SurchargeDObjet } from '../engine/objetDeTest.testkit';

const item = (o: SurchargeDObjet): ItemInstance =>
  objetDeTest({ uid: 'u', trappingId: 'arme-simple', kind: 'melee', qualities: [], enc: 0, equipped: false, ...o });

describe('weaponStatParts (composeur partagé des stats d’arme)', () => {
  it('mêlée : « Dégâts +BF+4 (7) · Allonge Longue » (BF=3 injecté, jamais [object Object])', () => {
    const parts = weaponStatParts(item({ damage: { plusBF: true, flat: 4 }, reach: 'Longue' }), 3);
    expect(parts).toEqual(['Dégâts +BF+4 (7)', 'Allonge Longue']);
    expect(parts.join(' · ')).not.toContain('[object Object]');
  });

  it('distance : Portée en mètres, pas d’Allonge (range prime)', () => {
    const parts = weaponStatParts(item({ kind: 'ranged', damage: { plusBF: true, flat: 3 }, range: 50 }), 4);
    expect(parts).toEqual(['Dégâts +BF+3 (7)', 'Portée 50 m']);
  });

  it('Dégâts plats sans BF (« +9 ») : total = la valeur fixe', () => {
    expect(weaponStatParts(item({ damage: { plusBF: false, flat: 9 } }), 5)).toEqual(['Dégâts +9 (9)']);
  });

  it('Dégâts littéraux (« Spécial ») : total 0, jamais [object Object]', () => {
    const parts = weaponStatParts(item({ damage: { literal: 'Spécial' }, reach: 'Moyenne' }), 3);
    expect(parts).toEqual(['Dégâts Spécial (0)', 'Allonge Moyenne']);
  });

  it('sans Dégâts : seule l’Allonge sort', () => {
    expect(weaponStatParts(item({ damage: undefined, reach: 'Courte' }), 3)).toEqual(['Allonge Courte']);
  });

  it('accepte un Weapon dérivé (armes EN MAIN)', () => {
    const w: Weapon = { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, reach: 'Moyenne', qualities: [] };
    expect(weaponStatParts(w, 3)).toEqual(['Dégâts +BF+4 (7)', 'Allonge Moyenne']);
  });

  it('arme de JET : Portée RÉSOLUE en mètres avec le BF (spec {bf} → BF×N)', () => {
    const parts = weaponStatParts(item({ kind: 'ranged', damage: { plusBF: true, flat: 0, bare: true }, range: { bf: 3 } }), 4);
    expect(parts).toContain('Portée 12 m'); // BF4 × 3
    expect(parts.join(' · ')).not.toContain('[object Object]');
    // Dynamique : un BF différent change la Portée.
    expect(weaponStatParts(item({ kind: 'ranged', damage: { literal: 'Spécial' }, range: { bf: 3 } }), 2)).toContain('Portée 6 m');
  });
});

describe('conditionalDamageNote — #135 : dégâts CONDITIONNELS dérivés des capacités de qualité (ram/siège)', () => {
  it('Bélier (qualities siege+belier, ADE II 8 l.249/292) : porte-uniquement + ×2 structure, repli Arme improvisée DÉRIVÉ (pas un littéral)', () => {
    const belier = { qualities: [{ id: 'siege' }, { id: 'belier' }], damage: { plusBF: true, flat: 10 } };
    expect(conditionalDamageNote(belier)).toBe('contre une porte uniquement — sinon Arme improvisée (+BF+1) · ×2 contre une structure');
  });

  it('Atout Siège seul (canon, ADE II 08 l.292) : uniquement la note ×2 — dégâts imprimés valent pour toute autre cible', () => {
    const canon = { qualities: [{ id: 'siege' }], damage: { plusBF: false, flat: 20 } };
    expect(conditionalDamageNote(canon)).toBe('×2 contre une structure');
  });

  it('arme normale (aucune capacité conditionnelle) : aucune note — les dégâts imprimés sont déjà la vérité', () => {
    expect(conditionalDamageNote({ qualities: [{ id: 'pointue' }], damage: { plusBF: true, flat: 4 } })).toBeNull();
  });

  it('sans dégâts imprimés mais effet À LA TOUCHE déclenché, sans formule dérivable : badge générique', () => {
    expect(conditionalDamageNote({ qualities: [], damage: null, onHitEffects: [{ trigger: 'onHit' } as never] })).toBe('Dégâts conditionnels — voir Effets');
  });

  it('sans dégâts ET sans effet à la touche (ex. armure/munition) : aucune note à ajouter', () => {
    expect(conditionalDamageNote({ qualities: [], damage: null })).toBeNull();
  });
});

describe('weaponStatParts — reporte la note conditionnelle EN PARTIE SUPPLÉMENTAIRE (#135)', () => {
  it('Bélier tenu en main : « Dégâts…·Allonge…·note conditionnelle » (armes normales inchangées)', () => {
    const w: Weapon = { label: 'Bélier', type: 'melee', damage: { plusBF: true, flat: 10 }, reach: 'Moyenne', qualities: [{ id: 'siege' }, { id: 'belier' }] };
    expect(weaponStatParts(w, 4)).toEqual([
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
