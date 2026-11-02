import { describe, it, expect } from 'vitest';
import { maxWounds, effectiveMaxWounds, blessuresReconciliees, blessuresPosees } from './characteristics';
import { blessuresDeBase, blessuresSurLeProfil } from './combattantDeTest.testkit';
import { Characteristics, Combatant } from './types';

describe('maxWounds par catégorie de Taille (LDB 85 l.393-401)', () => {
  const chars = { force: 35, endurance: 40, 'force-mentale': 30 } as Characteristics; // BF3, BE4, BFM3 → Moyenne 14
  it('Moyenne = formule (défaut)', () => expect(maxWounds(chars, 'moyenne')).toBe(14));
  it('Petite = 2BE+BFM', () => expect(maxWounds(chars, 'petite')).toBe(11));
  it('Grande = ×2', () => expect(maxWounds(chars, 'grande')).toBe(28));
  it('Énorme = ×4', () => expect(maxWounds(chars, 'enorme')).toBe(56));
});

describe('maxWounds — Fabriqué substitue le Bonus de Force au Bonus de Force Mentale (LDB 85 l.142)', () => {
  // Fabriqué : FM = 0 (« – » du profil, pas de Caractéristique) → BFM=0 sans substitution.
  const chars = { force: 35, endurance: 40, 'force-mentale': 0 } as Characteristics; // BF3, BE4, BFM0
  const fabrique = [{ id: 'fabrique' }] as never;
  it('sans le trait : BFM (0) → Moyenne = 3+8+0 = 11', () => expect(maxWounds(chars, 'moyenne')).toBe(11));
  it('avec Fabriqué : BF (3) remplace BFM → Moyenne = 3+8+3 = 14', () => expect(maxWounds(chars, 'moyenne', fabrique)).toBe(14));
  it('avec Fabriqué, Taille Grande : delta ×2 (28)', () => expect(maxWounds(chars, 'grande', fabrique)).toBe(28));
});

describe('maxWounds — Endurant ajoute le BE avant tout modificateur de Taille (LDB 85 l.130)', () => {
  const chars = { force: 35, endurance: 40, 'force-mentale': 30 } as Characteristics; // BF3, BE4, BFM3
  const endurant = [{ id: 'endurant' }] as never;
  it('Moyenne : 14 + BE 4 = 18', () => expect(maxWounds(chars, 'moyenne', endurant)).toBe(18));
  it('Grande : (14 + 4) × 2 = 36, jamais 28 + 4', () => expect(maxWounds(chars, 'grande', endurant)).toBe(36));
});

/** Profil à 30 partout (Moyenne : 3 + 2×3 + 3 = 12), sans Blessures : un porteur NÉ s'y pose. */
const profil = (over: Partial<Combatant> = {}): Omit<Combatant, 'wounds'> =>
  ({
    characteristics: { force: 30, endurance: 30, 'force-mentale': 30 } as Characteristics,
    size: 'moyenne',
    activeEffects: [],
    ...over,
  }) as unknown as Omit<Combatant, 'wounds'>;
const BUFF_E = [{ label: 'Soin', char: 'endurance' as const, bonus: 10, duration: { scale: 'rounds' as const, left: 3 } }];
const ne = (over: Partial<Combatant> = {}, maximum?: number): Combatant => {
  const p = profil(over);
  return blessuresSurLeProfil({ ...p, wounds: blessuresPosees(p, maximum) }) as Combatant;
};

describe('effectiveMaxWounds — formule du profil courant + écart du livre (LDB 05 l.1001)', () => {
  it('porteur né à la formule : 12, écart 0', () => {
    const c = ne();
    expect(c.wounds).toEqual({ current: 12, max: 12, ecart: 0 });
    expect(effectiveMaxWounds(c)).toBe(12);
  });
  it('buff +10 Endurance → +2 Blessures (Moyenne)', () => {
    expect(effectiveMaxWounds({ ...ne(), activeEffects: BUFF_E })).toBe(14);
  });
  it('buff +10 E sur un Énorme → 56 (la Taille multiplie le profil courant)', () => {
    expect(effectiveMaxWounds({ ...ne({ size: 'enorme' }), activeEffects: BUFF_E })).toBe(56);
  });
  it('Endurance du profil abaissée (Dégâts de Caractéristique) : le maximum suit', () => {
    const c = ne();
    c.characteristics.endurance = 10;
    expect(effectiveMaxWounds(c)).toBe(8); // 3 + 2×1 + 3
  });
  it('B imprimé (20, statbloc) : écart +8 figé à la naissance, le maximum suit ensuite le profil', () => {
    const c = ne({}, 20);
    expect(c.wounds).toEqual({ current: 20, max: 20, ecart: 8 });
    expect(effectiveMaxWounds(c)).toBe(20);
    expect(effectiveMaxWounds({ ...c, activeEffects: BUFF_E })).toBe(22);
  });
  it('Trait Nuée : cinq fois la créature type, le profil compris (LDB 85 l.253)', () => {
    const c = ne({ traits: [{ id: 'nuee' }] });
    expect(c.wounds.max).toBe(60);
    expect(effectiveMaxWounds({ ...c, activeEffects: BUFF_E })).toBe(70);
  });
});

describe('effectiveMaxWounds — Fabriqué : le maximum suit le Bonus de Force, pas de Force Mentale', () => {
  const fabrique = () => ne({ characteristics: { force: 30, endurance: 30, 'force-mentale': 0 } as Characteristics, traits: [{ id: 'fabrique' }] });

  it('sans buff : 3 + 6 + 3 = 12', () => expect(effectiveMaxWounds(fabrique())).toBe(12));
  it('buff +10 Force Mentale → SANS effet (Fabriqué ignore la FM pour les Blessures)', () => {
    expect(effectiveMaxWounds({ ...fabrique(), activeEffects: [{ label: 'Buff', char: 'force-mentale', bonus: 10, duration: { scale: 'rounds', left: 3 } }] })).toBe(12);
  });
  it('buff +10 Force → +2 Blessures (terme F ET terme BFM substitué)', () => {
    expect(effectiveMaxWounds({ ...fabrique(), activeEffects: [{ label: 'Buff', char: 'force', bonus: 10, duration: { scale: 'rounds', left: 3 } }] })).toBe(14);
  });
});

describe('blessuresReconciliees — le maximum suit, les Points perdus demeurent (LDB 48 l.23, l.27)', () => {
  /** Porteur né à 12, blessé à `courant`. */
  const blesse = (courant: number): Combatant => {
    const c = ne();
    c.wounds = { ...c.wounds, current: courant };
    return c;
  };
  const TRANSFORMATION = [{ label: 'Forme', bonus: 0, attrMods: { wounds: -6 }, duration: { scale: 'rounds' as const, left: 3 } }];

  it('un buff +E monte max ET courant ; l’expiration les redescend', () => {
    const c = blesse(10);
    c.activeEffects = BUFF_E;
    c.wounds = blessuresReconciliees(c);
    expect(c.wounds).toMatchObject({ max: 14, current: 12 });
    c.activeEffects = [];
    c.wounds = blessuresReconciliees(c);
    expect(c.wounds).toMatchObject({ max: 12, current: 10 });
  });

  it('1/12, une transformation ôte 6 : 0/6 ; sa fin rend 1/12, aucune Blessure regagnée sans soin', () => {
    const c = blesse(1);
    c.activeEffects = TRANSFORMATION;
    c.wounds = blessuresReconciliees(c);
    expect(c.wounds).toEqual({ current: 0, max: 6, ecart: 0, perduesSousZero: 5 });
    c.activeEffects = [];
    c.wounds = blessuresReconciliees(c);
    expect(c.wounds).toEqual({ current: 1, max: 12, ecart: 0 });
  });

  it('Points perdus sous la forme : ils demeurent à la fin, plancher 0', () => {
    const c = blesse(12);
    c.activeEffects = TRANSFORMATION;
    c.wounds = blessuresReconciliees(c);
    expect(c.wounds).toMatchObject({ max: 6, current: 6 });
    c.wounds = { ...c.wounds, current: 2 };
    c.activeEffects = [];
    c.wounds = blessuresReconciliees(c);
    expect(c.wounds).toEqual({ current: 8, max: 12, ecart: 0 });
  });

  it('lecture recommandée : soigné au-dessus de 0 sous la forme, la part sous 0 est soldée', () => {
    const c = blesse(1);
    c.activeEffects = TRANSFORMATION;
    c.wounds = blessuresReconciliees(c);
    c.wounds = { ...c.wounds, current: 2 };
    c.activeEffects = [];
    expect(blessuresReconciliees(c)).toEqual({ current: 8, max: 12, ecart: 0 });
  });

  it('pure : rien ne bouge → le même objet ; le porteur reçu n’est pas muté', () => {
    const c = blesse(10);
    expect(blessuresReconciliees(c)).toBe(c.wounds);
    const buffe = { ...blesse(10), activeEffects: BUFF_E };
    const avant = buffe.wounds;
    blessuresReconciliees(buffe);
    expect(buffe.wounds).toBe(avant);
    expect(avant).toEqual({ current: 10, max: 12, ecart: 0 });
  });

  it('idempotente', () => {
    const c = { ...blesse(10), activeEffects: BUFF_E };
    c.wounds = blessuresReconciliees(c);
    expect(blessuresReconciliees(c)).toBe(c.wounds);
  });

  it('une fixture (`blessuresDeBase`) naît au maximum posé sur le profil de son porteur, puis le suit', () => {
    const p = profil();
    const c = blessuresSurLeProfil({ ...p, wounds: blessuresDeBase(20, 10, p) }) as Combatant;
    expect(c.wounds).toEqual({ current: 10, max: 20, ecart: 8 });
    c.activeEffects = BUFF_E;
    expect(blessuresReconciliees(c)).toEqual({ current: 12, max: 22, ecart: 8 });
  });
});
