import { describe, it, expect } from 'vitest';
import {
  forcePaceDifficulty, exhaustionDifficulty, overspeedRow, foulingEffects,
  weeklyFoulingLevel, orientationOutcome, rollCourseChange, lighthouseSpotDifficulty,
  lighthouseOrientationDR, seaMilesPerDay, pursuitDistanceGain, pursuitLowMPenalty, savoirOceansBonus,
} from './seaNavigation';
import type { RNG } from './dice';
import type { Combatant } from './types';

const seq = (...vals: number[]): RNG => {
  let i = 0;
  return { int: (min, max) => Math.min(max, Math.max(min, vals[i++ % vals.length])) };
};

const hull = (E: number): Combatant => ({
  id: 'coque', name: 'Coque', kind: 'enemy',
  characteristics: { 'capacite-de-combat': 0, 'capacite-de-tir': 0, force: 0, endurance: E, initiative: 0, agilite: 0, dexterite: 0, intelligence: 0, 'force-mentale': 0, sociabilite: 0 },
  movement: 0, wounds: { current: 50, max: 50 }, weapons: [], skills: [], talents: [],
} as unknown as Combatant);

describe('Forcer le rythme & Épuisement (MDG 13 l.95-111)', () => {
  it('+1 M : Voile Très Difficile (−30) / Ramer Difficile (−20) ; +2 M : Ramer Très Difficile seulement', () => {
    expect(forcePaceDifficulty(1, 'voile')).toBe('tresDifficile');
    expect(forcePaceDifficulty(1, 'avirons')).toBe('difficile');
    expect(forcePaceDifficulty(2, 'voile')).toBeNull(); // « n/a »
    expect(forcePaceDifficulty(2, 'avirons')).toBe('tresDifficile');
    expect(forcePaceDifficulty(3, 'avirons')).toBeNull();
  });

  it('Épuisement de fin de Période : Résistance Accessible (+20), Complexe (−10) si rythme forcé', () => {
    expect(exhaustionDifficulty(false)).toBe('accessible');
    expect(exhaustionDifficulty(true)).toBe('complexe');
  });
});

describe('« Ça va lâcher, capitaine ! » (MDG 13 l.121-142)', () => {
  it('jusqu’à M+4 : aucun risque ; M+5 → Accessible/heure/1+X ; M+9 ou plus → Très Difficile/Round/8+X', () => {
    expect(overspeedRow(5, 9)).toBeNull(); // M+4
    expect(overspeedRow(5, 10)).toMatchObject({ difficulty: 'accessible', per: 'heure', damage: 1 });
    expect(overspeedRow(5, 12)).toMatchObject({ difficulty: 'complexe', per: 'minute', damage: 3 });
    expect(overspeedRow(5, 14)).toMatchObject({ difficulty: 'tresDifficile', per: 'round', damage: 8 });
    expect(overspeedRow(5, 20)).toMatchObject({ damage: 8 }); // « M+9 ou plus »
  });
});

describe('Salissures (MDG 13 l.144-159)', () => {
  it('effets par niveau (tableau verbatim) ; niveau 0 = coque propre ; plafond au niveau 5', () => {
    expect(foulingEffects(0)).toMatchObject({ manDR: 0, mMod: 0, navDR: 0 });
    expect(foulingEffects(1)).toMatchObject({ manDR: -1, mMod: 0, repairPctOfBase: 5 });
    expect(foulingEffects(3)).toMatchObject({ manDR: -2, mMod: -1, repairPctOfBase: 15 });
    expect(foulingEffects(5)).toMatchObject({ manDR: -3, mMod: -2, navDR: -1, repairPctOfBase: 25 });
    expect(foulingEffects(9)).toMatchObject({ level: 5 });
  });

  it('Test hebdomadaire raté → +1 niveau (plafonné à 5) ; réussi → inchangé', () => {
    expect(weeklyFoulingLevel(0, false)).toEqual({ level: 1, gained: true });
    expect(weeklyFoulingLevel(2, true)).toEqual({ level: 2, gained: false });
    expect(weeklyFoulingLevel(5, false)).toEqual({ level: 5, gained: false });
  });
});

describe('Orientation — Repères & Changement de cap (MDG 13 l.307-331)', () => {
  it('bandes de Repères : 4+ exact ; 0-3 ok ; −1/−2 mineur (sans effet la 1ʳᵉ fois) ; −3/−4 dérive ; ≤−5 dérive majeure (+2)', () => {
    expect(orientationOutcome(4, false)).toMatchObject({ outcome: 'exact', rollCourseChange: false });
    expect(orientationOutcome(2, false)).toMatchObject({ outcome: 'ok', rollCourseChange: false });
    expect(orientationOutcome(-1, false)).toMatchObject({ outcome: 'drift-minor', rollCourseChange: false });
    expect(orientationOutcome(-2, true)).toMatchObject({ outcome: 'drift-minor', rollCourseChange: true }); // « s'il se reproduit »
    expect(orientationOutcome(-3, false)).toMatchObject({ outcome: 'drift', rollCourseChange: true, courseChangeBonus: 0 });
    expect(orientationOutcome(-6, false)).toMatchObject({ outcome: 'drift-major', rollCourseChange: true, courseChangeBonus: 2 });
  });

  it('Changement de cap : 1-3 sans conséquence ; 4-6 +10 % ; 7-9 +25 % ; 10-11 90° ; 12 demi-tour ; côté 1-5 tribord', () => {
    expect(rollCourseChange(seq(2, 3))).toMatchObject({ outcome: 'aucun', delayPct: 0, side: 'tribord' });
    expect(rollCourseChange(seq(5, 8))).toMatchObject({ outcome: 'retard', delayPct: 10, side: 'babord' });
    expect(rollCourseChange(seq(8, 1))).toMatchObject({ outcome: 'retard', delayPct: 25 });
    expect(rollCourseChange(seq(10, 1))).toMatchObject({ outcome: 'quart-de-tour' });
    expect(rollCourseChange(seq(10, 1), 2)).toMatchObject({ outcome: 'demi-tour' }); // 10 + 2 (dérive majeure)
  });
});

describe('Phares & clochers (MDG 13 l.333-351)', () => {
  it('Voir la lumière : ≤5 milles Facile (+40) ; 5-10 Intermédiaire ; 10-15 Difficile ; au-delà : invisible', () => {
    expect(lighthouseSpotDifficulty(3)).toBe('facile');
    expect(lighthouseSpotDifficulty(8)).toBe('intermediaire');
    expect(lighthouseSpotDifficulty(14)).toBe('difficile');
    expect(lighthouseSpotDifficulty(20)).toBeNull();
  });

  it('clocher : distances divisées par 2 (l.351) → une cloche à 8 milles se juge comme une lumière à 16 (inaudible)', () => {
    expect(lighthouseSpotDifficulty(8, true)).toBeNull();
    expect(lighthouseSpotDifficulty(4, true)).toBe('intermediaire');
  });

  it('bonus d’Orientation : phare = premier chiffre de Savoir (Océans) (l.335) ; clocher = +2 DR forfaitaires (l.351)', () => {
    const nav = {
      ...hull(30), id: 'nav',
      characteristics: { 'capacite-de-combat': 0, 'capacite-de-tir': 0, force: 0, endurance: 0, initiative: 0, agilite: 0, dexterite: 0, intelligence: 30, 'force-mentale': 0, sociabilite: 0 },
      skills: [{ id: 'savoir', spec: 'oceans', advances: 6 }],
    } as unknown as Combatant;
    expect(savoirOceansBonus(nav)).toBe(3); // Int 30 + 6 avances = 36 → +3
    expect(lighthouseOrientationDR(nav, false)).toBe(3);
    expect(lighthouseOrientationDR(nav, true)).toBe(2);
    expect(savoirOceansBonus(hull(30))).toBe(0); // sans la Compétence acquise, pas de bonus
  });
});

describe('Boussole — +1 DR aux Tests d’Orientation (MDG 14 l.275, passif d’objet)', () => {
  it('un héros qui possède une boussole gagne +1 DR d’Orientation (skillDRBonus, NON gaté sur le port)', async () => {
    const { skillDRBonus } = await import('./ops');
    const c = {
      ...hull(30), id: 'nav2',
      items: [{ uid: 'u1', name: 'Boussole', trappingId: 'boussole' }],
    } as unknown as Combatant;
    expect(skillDRBonus(c, 'orientation')).toBe(1);
    expect(skillDRBonus(c, 'perception')).toBe(0);
    expect(skillDRBonus({ ...c, items: [] } as unknown as Combatant, 'orientation')).toBe(0);
  });
});

describe('Longs voyages & Poursuite (MDG 15 l.53-78 ; ch.13 l.354-420)', () => {
  it('milles/jour = 18 × M ; ÷2 sans voguer de nuit ; ±10 % par DR de Progression', () => {
    expect(seaMilesPerDay(5, true)).toBe(90);
    expect(seaMilesPerDay(5, false)).toBe(45);
    expect(seaMilesPerDay(5, true, 2)).toBeCloseTo(108); // +20 %
    expect(seaMilesPerDay(5, true, -3)).toBeCloseTo(63); // −30 %
  });

  it('Poursuite : Distance gagnée = mètres ÷ 10 (min 1) ±1/−2 selon la bande de DR (l.378-397)', () => {
    // M 5, DR 4 → Progression M+2 = 7 → 14 m → 1 (÷10 floor, min 1) + 1 = 2.
    expect(pursuitDistanceGain(5, 4)).toBe(2);
    // M 5, DR 1 → M+1 = 6 → 12 m → 1 + 0 = 1.
    expect(pursuitDistanceGain(5, 1)).toBe(1);
    // M 5, DR −1 → M = 5 → 10 m → 1 − 1 = 0.
    expect(pursuitDistanceGain(5, -1)).toBe(0);
    // M 5, DR −5 → M÷2 = 2 → 4 m → 1 − 2 = −1 (perd du terrain).
    expect(pursuitDistanceGain(5, -5)).toBe(-1);
  });

  it('bateaux lents : M 3 → −1 DR ; M 2 → −2 ; M 1 → −3 (l.399)', () => {
    expect(pursuitLowMPenalty(4)).toBe(0);
    expect(pursuitLowMPenalty(3)).toBe(-1);
    expect(pursuitLowMPenalty(2)).toBe(-2);
    expect(pursuitLowMPenalty(1)).toBe(-3);
  });
});
