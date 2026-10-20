import { describe, it, expect, afterEach } from 'vitest';
import { evaluateTest, maxForcedRoll, bestForcedRoll, rollTest, evaluateCombinedTest, slTier, isImpressiveSuccess, isImpressiveFailure, isAstoundingSuccess, isAstoundingFailure, SL_IMPRESSIVE, SL_ASTOUNDING, assistBonus } from './tests';
import { getTestPolicy, type TestPolicy } from './testPolicy';
import type { RNG } from './dice';
import { setRule, resetRule } from './policy';
import { deFixe } from './dice.testkit';

const P = (over: Partial<TestPolicy> = {}): TestPolicy => ({
  autoSuccessMax: 5, autoFailMin: 96, bandsMode: 'normal', slMode: 'standard', targetMin: 1, targetMax: 99, ...over,
});

describe('evaluateTest — bandes automatiques (LDB 12 l.28, l.32)', () => {
  it("'normal' : 01-05 = réussite auto même si cible < jet ; DR ≥ +1", () => {
    const t = evaluateTest(3, 0, undefined, P()); // 3 > 0 → échec « numérique », mais bande basse
    expect(t.success).toBe(true);
    expect(t.sl).toBeGreaterThanOrEqual(1);
  });
  it("'normal' : 96-00 = échec auto même si jet ≤ cible ; DR ≤ -1", () => {
    const t = evaluateTest(98, 99, undefined, P()); // 98 ≤ 99 → réussite « numérique », mais bande haute
    expect(t.success).toBe(false);
    expect(t.sl).toBeLessThanOrEqual(-1);
  });
  it("'off' : aucune bande (comportement historique = jet ≤ cible)", () => {
    expect(evaluateTest(3, 0, undefined, P({ bandsMode: 'off' })).success).toBe(false);
    expect(evaluateTest(98, 99, undefined, P({ bandsMode: 'off' })).success).toBe(true);
  });
  it("'inverted' : 01-05 échec auto / 96-00 réussite auto (règle maison)", () => {
    expect(evaluateTest(3, 99, undefined, P({ bandsMode: 'inverted' })).success).toBe(false);
    expect(evaluateTest(98, 0, undefined, P({ bandsMode: 'inverted' })).success).toBe(true);
  });
});

describe('evaluateTest — DR rapide (« Calculer Rapidement un DR », LDB 12 l.102)', () => {
  it("'fast' : sur une réussite, DR = chiffre des dizaines du JET", () => {
    expect(evaluateTest(36, 80, undefined, P({ slMode: 'fast' })).sl).toBe(3); // dizaines de 36
    expect(evaluateTest(36, 80, undefined, P()).sl).toBe(5); // standard : 8 − 3
  });
  it("'fast' : sur un échec, DR calculé normalement", () => {
    const t = evaluateTest(70, 30, undefined, P({ slMode: 'fast' }));
    expect(t.success).toBe(false);
    expect(t.sl).toBe(-4); // standard négatif : 3 − 7
  });
});

describe('Tests >100 % (LDB 12 l.73-77) : la valeur n’est plus plafonnée à 99', () => {
  const rng50: RNG = deFixe(50); // jet 50
  it('off (défaut) : valeur 115 plafonnée à 99 → DR = tens(99) − tens(50) = 4', () => {
    expect(rollTest(115, 'intermediaire', rng50, 0, P()).sl).toBe(4);
  });
  it('on : valeur 115 non plafonnée → DR = tens(115) − tens(50) = 6 (+1 par 10 % au-delà de 100)', () => {
    expect(rollTest(115, 'intermediaire', rng50, 0, P({ targetMax: 999 })).sl).toBe(6);
  });
});

describe('maxForcedRoll — borne du dé forcé DÉRIVÉE de la policy (pas un nombre en dur)', () => {
  it("'normal' : ≤ cible ET ≤ autoFailMin − 1 (96-00 échoue toujours, LDB 12 l.28)", () => {
    expect(maxForcedRoll(99, P())).toBe(95);
    expect(maxForcedRoll(40, P())).toBe(40);
  });
  it("'off' : pas de bande d'échec auto → plafonné à la cible", () => {
    expect(maxForcedRoll(99, P({ bandsMode: 'off' }))).toBe(99);
  });
});

describe('bestForcedRoll — dé PAR DÉFAUT de la Résilience, DR-MAX selon la policy (LDB 17 l.68)', () => {
  it("standard (DR = différence de dizaines) : le meilleur jet est 01 → dizaines de la cible", () => {
    expect(bestForcedRoll(55, P())).toBe(1);
    expect(evaluateTest(bestForcedRoll(55, P()), 55, undefined, P()).sl).toBe(5); // tens(55) − tens(01) = 5
  });
  it("fast (DR = dizaines du JET) : le meilleur jet est le PLUS HAUT valide (≈ la cible), PAS 01", () => {
    const fp = P({ slMode: 'fast' });
    expect(bestForcedRoll(55, fp)).toBe(55);                       // maxForcedRoll(55) = 55
    expect(evaluateTest(bestForcedRoll(55, fp), 55, undefined, fp).sl).toBe(5); // dizaines de 55
    // Le vieux dé 01 codé en dur en Fast DR = DR MINIMAL (dizaines 0, planché à 1 par la bande auto) vs 5.
    expect(evaluateTest(1, 55, undefined, fp).sl).toBe(1);
    expect(evaluateTest(10, 55, undefined, fp).sl).toBe(1);                   // tout jet bas → DR bas ; bestForcedRoll les évite
  });
  it("fast : la bande d'échec auto plafonne le meilleur jet (cible ≥ autoFailMin)", () => {
    const fp = P({ slMode: 'fast' });
    expect(bestForcedRoll(99, fp)).toBe(95);                       // 96-00 échoue toujours → borné à 95
    expect(evaluateTest(bestForcedRoll(99, fp), 99, undefined, fp).sl).toBe(9);
  });
});

describe('evaluateCombinedTest — Test Combiné (LDB 12 l.202-206) : un jet vs DEUX valeurs', () => {
  it('les deux réussies → succès complet (full) ; DR par compétence', () => {
    const r = evaluateCombinedTest(35, 60, 40, P());
    expect(r.level).toBe('full');
    expect(r.a.success).toBe(true);
    expect(r.b.success).toBe(true);
  });
  it('une seule réussie → réussite partielle (partial)', () => {
    const r = evaluateCombinedTest(50, 60, 40, P()); // 50 ≤ 60 (a) ; 50 > 40 (b)
    expect(r.level).toBe('partial');
    expect(r.a.success).toBe(true);
    expect(r.b.success).toBe(false);
  });
  it('aucune → échec (fail)', () => {
    const r = evaluateCombinedTest(70, 60, 40, P());
    expect(r.level).toBe('fail');
  });
  it('même jet pour les deux (cohérence)', () => {
    const r = evaluateCombinedTest(42, 80, 30, P());
    expect(r.a.roll).toBe(42);
    expect(r.b.roll).toBe(42);
  });
});

describe('Largeur des bandes automatiques (LDB 12 l.32) : param réglable, plus de 5/96 en dur', () => {
  afterEach(() => resetRule('test-auto-band-width'));
  it('défaut RAW : bandes 01-05 / 96-00', () => {
    expect(getTestPolicy().autoSuccessMax).toBe(5);
    expect(getTestPolicy().autoFailMin).toBe(96);
  });
  it('largeur 10 → bandes 01-10 / 91-00 (autoFailMin = 101 − largeur), effet live + maxForcedRoll suit', () => {
    setRule('test-auto-band-width', 10);
    expect(getTestPolicy().autoSuccessMax).toBe(10);
    expect(getTestPolicy().autoFailMin).toBe(91);
    expect(evaluateTest(8, 0).success).toBe(true); // 8 ≤ 10 → réussite auto (bande basse élargie)
    expect(maxForcedRoll(99)).toBe(90); // 91 − 1
  });
  it('largeur 0 → aucune bande effective (01-00 hors plage)', () => {
    setRule('test-auto-band-width', 0);
    expect(getTestPolicy().autoSuccessMax).toBe(0);
    expect(getTestPolicy().autoFailMin).toBe(101);
    expect(evaluateTest(3, 0).success).toBe(false); // pas de bande basse → échec numérique
  });
});

describe('Bascule in-game : éditer UNE règle change le comportement (preuve « un seul edit »)', () => {
  afterEach(() => { resetRule('test-auto-bands'); resetRule('test-fast-sl'); resetRule('test-over-100'); });
  it('test-auto-bands → inverted : evaluateTest (policy par défaut) suit la surcharge', () => {
    expect(evaluateTest(3, 99).success).toBe(true); // normal
    setRule('test-auto-bands', 'inverted');
    expect(evaluateTest(3, 99).success).toBe(false); // bande basse = échec auto
  });
  it('test-fast-sl → true : DR rapide sans autre édition', () => {
    expect(evaluateTest(36, 80).sl).toBe(5); // standard
    setRule('test-fast-sl', true);
    expect(evaluateTest(36, 80).sl).toBe(3); // dizaines du jet
  });
  it('test-over-100 → true : rollTest cesse de plafonner la valeur à 99', () => {
    const rng50: RNG = deFixe(50);
    expect(rollTest(115, 'intermediaire', rng50).sl).toBe(4); // défaut : plafonné 99
    setRule('test-over-100', true);
    expect(rollTest(115, 'intermediaire', rng50).sl).toBe(6); // règle on : valeur 115 pleine
  });
});

describe('Tableau des Résultats — paliers de DR (LDB 12 l.104-114, primitive partagée)', () => {
  it('slTier par magnitude (succès comme échec)', () => {
    expect([0, 1].map(slTier)).toEqual(['minime', 'minime']);
    expect([2, -3].map(slTier)).toEqual(['normal', 'normal']);
    expect([4, -5].map(slTier)).toEqual(['impressionnant', 'impressionnant']);
    expect([6, -9].map(slTier)).toEqual(['stupefiant', 'stupefiant']);
  });
  it('seuils RAW exposés en constantes', () => {
    expect([SL_IMPRESSIVE, SL_ASTOUNDING]).toEqual([4, 6]);
  });
  it('prédicats Impressionnant/Stupéfiant tiennent compte du succès', () => {
    expect(isImpressiveSuccess(true, 4)).toBe(true);
    expect(isImpressiveSuccess(true, 6)).toBe(true); // « ou mieux »
    expect(isImpressiveSuccess(false, 4)).toBe(false); // un échec n'est jamais un Succès Impressionnant
    expect(isAstoundingSuccess(true, 5)).toBe(false);
    expect(isImpressiveFailure(false, -4)).toBe(true);
    expect(isImpressiveFailure(true, -4)).toBe(false);
    expect(isAstoundingFailure(false, -6)).toBe(true);
    expect(isAstoundingFailure(false, -5)).toBe(false);
  });
});

describe('assistBonus — Test Soutenu (LDB 12 l.191-198)', () => {
  it('chaque soutien octroie +10 (exemple du LDB : 2 soutiens → +20)', () => {
    expect(assistBonus(2, 5)).toBe(20);
  });
  it('plafonne les soutiens au Bonus de Caractéristique du meneur (LDB 12 l.198)', () => {
    expect(assistBonus(4, 2)).toBe(20); // 4 soutiens possibles, plafond 2 → +20
  });
  it('aucun soutien / valeurs négatives → 0', () => {
    expect(assistBonus(0, 5)).toBe(0);
    expect(assistBonus(3, 0)).toBe(0);
    expect(assistBonus(-1, 5)).toBe(0);
  });
});
