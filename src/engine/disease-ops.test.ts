import { describe, it, expect } from 'vitest';
import { applyOps } from './ops';
import { cureDiseases, blessDiseaseDuration } from './rest';
import { traumaById, dechirureFractureFicheId } from './trauma';
import type { HitLocation } from './types';
const tk = (k: 'dechirure' | 'fracture', sv: 'mineur' | 'majeur', loc: HitLocation, opts?: { be?: number; d10?: number }) => traumaById(dechirureFractureFicheId(k, sv, loc), opts, loc);
import { contractDisease } from './disease';
import { MINUTES_PER_DAY } from './clock';
import { stacks, syncDerivedConditions } from './conditions';
import type { Combatant } from './types';

/**
 * Jalon 2.6 — Ops maladies/soins : Amère catharsis (cureDisease + échelle DR), Bénédiction de
 * Convalescence (reduceDiseaseDays, 1×/maladie), Cautériser (preventInfection → woundDressed),
 * Larmes de Shallya (cureCriticalWound — jamais une amputation). Consomment directement les
 * moteurs maladies (LDB 20) et convalescence (LDB 18) du Jalon 2.5/5.
 */
const dummy = (p: Partial<Combatant> = {}): Combatant =>
  ({
    id: 'x', label: 'X', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 20, max: 20 }, advantage: 0, conditions: [], skills: [], talents: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    ...p,
  } as Combatant);

const sick = (name: string, days = 5) => contractDisease(name, { int: () => 1 }, { incubation: 0, duration: days })!;

describe('cureDisease — Amère catharsis (LDB 42)', () => {
  it('purge 1 + ⌊DR/2⌋ maladies (actives d’abord) et rend l’Exténué du malaise', () => {
    const c = dummy({ diseases: [sick('infection-mineure'), sick('blessure-purulente')] });
    // Les deux Malaises PORTENT chacun leur État *Exténué* (LDB 20 l.188) : la réconciliation les pose.
    syncDerivedConditions(c);
    expect(stacks(c, 'extenue')).toBe(2);
    applyOps(c, [{ op: 'cureDisease', count: 1, countPerSL: { every: 2, amount: 1 } }], { sl: 2 });
    expect(c.diseases).toHaveLength(0); // 1 + ⌊2/2⌋ = 2 purges
    expect(stacks(c, 'extenue')).toBe(0); // malaise levé → Exténué rendu
  });

  it('immunité post-guérison préservée (Vérole Urticante)', () => {
    const c = dummy({ diseases: [sick('verole-urticante')] });
    cureDiseases(c, 1);
    expect(c.diseaseImmunities).toContain('verole-urticante');
  });
});

describe('reduceDiseaseDays — Bénédiction de Convalescence (LDB 41) + extensions #46 (dice/disease)', () => {
  it('−1 jour (min 1), UNE seule fois par maladie (verrou `oncePerDisease` — porté par la donnée du Miracle)', () => {
    const c = dummy({ diseases: [sick('infection-mineure', 5)] });
    applyOps(c, [{ op: 'reduceDiseaseDays', days: 1, oncePerDisease: true }], {});
    expect(c.diseases![0].minutesLeft).toBe(4 * MINUTES_PER_DAY);
    const log = applyOps(c, [{ op: 'reduceDiseaseDays', days: 1, oncePerDisease: true }], {}); // 2e tentative → refus
    expect(c.diseases![0].minutesLeft).toBe(4 * MINUTES_PER_DAY);
    expect(log.join(' ')).toMatch(/aucune maladie/);
  });
  it('sans verrou (herbes « 1 dose/jour ») : reprise possible ; `disease` SCOPE la maladie ciblée', () => {
    const c = dummy({ diseases: [sick('infection-mineure', 5), sick('verole-du-tanneur', 9)] });
    blessDiseaseDuration(c, 1, { disease: 'verole-du-tanneur' });
    blessDiseaseDuration(c, 1, { disease: 'verole-du-tanneur' });
    expect(c.diseases![0].minutesLeft).toBe(5 * MINUTES_PER_DAY); // non ciblée : intacte
    expect(c.diseases![1].minutesLeft).toBe(7 * MINUTES_PER_DAY);
  });
  it("`dice` tire les jours à l'application (Rouille mouchetée : « 1d10 jours », MSRC 04 l.241)", () => {
    const c = dummy({ diseases: [sick('verole-du-tanneur', 15)] });
    applyOps(c, [{ op: 'reduceDiseaseDays', dice: { n: 1, sides: 10 }, disease: 'verole-du-tanneur' }], {});
    const reduced = 15 - c.diseases![0].minutesLeft / MINUTES_PER_DAY;
    expect(reduced).toBeGreaterThanOrEqual(1);
    expect(reduced).toBeLessThanOrEqual(10);
  });
  it("`daysPerSL` échelle sur `ctx.sl` (Gesundheit : « un jour par DR obtenu », MSRC 04 l.184-186)", () => {
    const c = dummy({ diseases: [sick('blessure-purulente', 5)] });
    applyOps(c, [{ op: 'reduceDiseaseDays', days: 0, daysPerSL: { every: 1, amount: 1 }, disease: 'blessure-purulente' }], { sl: 3 });
    expect(c.diseases![0].minutesLeft).toBe(2 * MINUTES_PER_DAY); // 5 − 3 DR
  });
  it('`daysPerSL` sans `ctx.sl` (Test non joué) → aucune réduction', () => {
    const c = dummy({ diseases: [sick('blessure-purulente', 5)] });
    applyOps(c, [{ op: 'reduceDiseaseDays', days: 0, daysPerSL: { every: 1, amount: 1 }, disease: 'blessure-purulente' }], {});
    expect(c.diseases![0].minutesLeft).toBe(5 * MINUTES_PER_DAY);
  });
});

describe('preventInfection — Cautériser (LDB 47) & cureCriticalWound — Larmes de Shallya (LDB 42)', () => {
  it('preventInfection pose woundDressed (pas d’Infection post-critique, LDB 18 l.298)', () => {
    const c = dummy({});
    applyOps(c, [{ op: 'preventInfection' }], { label: 'Cautériser' });
    expect(c.woundDressed).toBe(true);
  });

  it('cureCriticalWound guérit déchirures/fractures mais JAMAIS une amputation', () => {
    const c = dummy({
      criticalWounds: 3,
      traumas: [
        tk('dechirure', 'mineur', 'jambeD', { be: 25 }),
        tk('fracture', 'majeur', 'brasG', { be: 25, d10: 5 }),
        { label: 'Main/bras amputé (brasD)', location: 'brasD', ops: [{ op: 'maxWeaponHands', hands: 1 }] },
      ],
    });
    applyOps(c, [{ op: 'cureCriticalWound', count: 1, countPerSL: { every: 2, amount: 1 } }], { sl: 4 }); // 1 + 2 = 3 tentées
    expect(c.traumas).toHaveLength(1); // l'amputation reste
    expect(c.traumas![0].label).toMatch(/amputé/);
    expect(c.criticalWounds).toBe(1); // 3 − 2 guéris
  });

  it('cureCriticalWounds direct : 0 trauma guérissable → journal explicite via l’op', () => {
    const c = dummy({ traumas: [{ label: 'Main/bras amputé (brasD)', location: 'brasD' }] });
    const log = applyOps(c, [{ op: 'cureCriticalWound' }], {});
    expect(log.join(' ')).toMatch(/amputations sont hors d'atteinte/);
    expect(c.traumas).toHaveLength(1);
  });
});
