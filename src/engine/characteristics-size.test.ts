import { describe, it, expect } from 'vitest';
import { maxWounds, effectiveMaxWounds, blessuresReconciliees, blessuresDeBase } from './characteristics';
import { Characteristics, Combatant } from './types';

describe('maxWounds par catégorie de Taille (LDB 85 l.332-352)', () => {
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

describe('effectiveMaxWounds — base + delta des buffs F/E/FM × Taille', () => {
  const base = (over: Partial<Combatant> = {}): Combatant =>
    ({
      characteristics: { force: 30, endurance: 30, 'force-mentale': 30 } as Characteristics,
      size: 'moyenne',
      wounds: { current: 10, max: 12, base: 12 },
      activeEffects: [],
      ...over,
    }) as unknown as Combatant;

  it('sans buff : = wounds.base (préserve une surcharge / valeur livre)', () => {
    // base 12 alors que la formule donnerait 9 (BF3? non : F30→BF3, E30→BE3, FM30→BFM3 → 3+6+3=12). Ici base==formule.
    expect(effectiveMaxWounds(base())).toBe(12);
  });
  it('surcharge préservée à vide : base 20 (≠ formule) reste 20', () => {
    expect(effectiveMaxWounds(base({ wounds: blessuresDeBase(20) }))).toBe(20);
  });
  it('buff +10 Endurance → +2 Blessures (Moyenne)', () => {
    const c = base({ activeEffects: [{ label: 'Soin', char: 'endurance', bonus: 10, duration: { scale: 'rounds', left: 3 } }] });
    expect(effectiveMaxWounds(c)).toBe(14); // base 12 + (BE 4 vs 3 → +2)
  });
  it('buff +10 E sur un Énorme → +2×4 = +8 (delta ×Taille)', () => {
    const c = base({ size: 'enorme', wounds: blessuresDeBase(48), activeEffects: [{ label: 'Soin', char: 'endurance', bonus: 10, duration: { scale: 'rounds', left: 3 } }] });
    expect(effectiveMaxWounds(c)).toBe(56); // 48 + (woundsForSize(...,enorme) delta = +8)
  });
});

describe('effectiveMaxWounds — Fabriqué : le delta suit le Bonus de Force, pas de Force Mentale', () => {
  const base = (over: Partial<Combatant> = {}): Combatant =>
    ({
      characteristics: { force: 30, endurance: 30, 'force-mentale': 0 } as Characteristics,
      size: 'moyenne',
      wounds: { current: 10, max: 12, base: 12 },
      activeEffects: [],
      traits: [{ id: 'fabrique' }],
      ...over,
    }) as unknown as Combatant;

  it('sans buff : = wounds.base', () => expect(effectiveMaxWounds(base())).toBe(12));
  it('buff +10 Force Mentale → SANS effet (Fabriqué ignore la FM pour les Blessures)', () => {
    const c = base({ activeEffects: [{ label: 'Buff', char: 'force-mentale', bonus: 10, duration: { scale: 'rounds', left: 3 } }] });
    expect(effectiveMaxWounds(c)).toBe(12);
  });
  it('buff +10 Force → +2 Blessures (BF4 vs BF3, compté sur le terme F ET le terme BFM substitué)', () => {
    const c = base({ activeEffects: [{ label: 'Buff', char: 'force', bonus: 10, duration: { scale: 'rounds', left: 3 } }] });
    expect(effectiveMaxWounds(c)).toBe(14); // base 12 + delta woundsForSize(4,3,4) − woundsForSize(3,3,3) = 14 − 12 = +2
  });
});

describe('blessuresReconciliees — recale max + ajuste current (buff/expiration)', () => {
  const porteur = (wounds: Combatant['wounds'], activeEffects: Combatant['activeEffects']) => ({
    characteristics: { force: 30, endurance: 30, 'force-mentale': 30 } as Characteristics,
    size: 'moyenne',
    wounds,
    activeEffects,
  } as unknown as Combatant);
  const BUFF_E = [{ label: 'Soin', char: 'endurance' as const, bonus: 10, duration: { scale: 'rounds' as const, left: 3 } }];

  it('un buff +E monte max ET current ; l’expiration les redescend (plancher 0)', () => {
    const c = porteur(blessuresDeBase(12, 10), BUFF_E);
    c.wounds = blessuresReconciliees(c);
    expect(c.wounds).toMatchObject({ max: 14, current: 12 }); // +2 (BE 4 vs 3)
    c.activeEffects = [];
    c.wounds = blessuresReconciliees(c);
    expect(c.wounds).toMatchObject({ max: 12, current: 10 });
    c.wounds = { ...c.wounds, current: 1 };
    c.activeEffects = BUFF_E;
    c.wounds = blessuresReconciliees(c);
    c.wounds = { ...c.wounds, current: 1 };
    c.activeEffects = [];
    expect(blessuresReconciliees(c)).toMatchObject({ max: 12, current: 0 });
  });

  it('pure : rien ne bouge → le même objet ; le porteur reçu n’est pas muté', () => {
    const c = porteur(blessuresDeBase(12, 10), []);
    expect(blessuresReconciliees(c)).toBe(c.wounds);
    const buffe = porteur(blessuresDeBase(12, 10), BUFF_E);
    const avant = buffe.wounds;
    blessuresReconciliees(buffe);
    expect(buffe.wounds).toBe(avant);
    expect(avant).toEqual({ current: 10, max: 12, base: 12 });
  });

  it('idempotente, porteur sans `base` compris : il reçoit le `max` qu’il portait', () => {
    const { base: _base, ...sansBase } = blessuresDeBase(12, 10);
    const c = porteur(sansBase, BUFF_E);
    c.wounds = blessuresReconciliees(c);
    expect(c.wounds).toEqual({ current: 12, max: 14, base: 12 });
    expect(blessuresReconciliees(c)).toBe(c.wounds);
  });
});
