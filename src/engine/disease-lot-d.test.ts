import { describe, it, expect } from 'vitest';
import {
  diseaseDefs, contractDisease, rollContraction, tickDisease, diseasePassiveOps,
  diseaseBlesseCount, hasActiveCapability, contagiousDiseases, Disease,
} from './disease';
import { makeRNG } from './dice';
import { MINUTES_PER_DAY } from './clock';
import type { Combatant } from './types';
import { porteEntretien, applique } from './upkeepPorte.testkit';
import type { GameOp } from './ops';
import { desDuTest } from './dice.testkit';

/** Pénalité aux TESTS d'une Caractéristique due aux maladies actives (LDB 20 l.151-176 : « pénalité […] à
 *  tous vos Tests ») — lit les `testMod{char}` passifs des symptômes. */
const pen = (c: Combatant, char: string): number[] =>
  diseasePassiveOps(c).map((m) => m.op).filter((o): o is Extract<GameOp, { op: 'testMod' }> => o.op === 'testMod' && o.char === char).map((o) => o.amount);

/** Lot D — complément Maladies (LDB 20) : la Litanie de la Pestilence au complet + nouveaux symptômes. */

function mk(over: Partial<Combatant> = {}): Combatant {
  return {
    id: 'h', label: 'H', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], movement: 4,
    ...over,
  } as Combatant;
}
const active = (name: string): Disease => {
  const dz = contractDisease(name, makeRNG(1), { incubation: 0, duration: 5 })!;
  return dz;
};

describe('Litanie de la Pestilence — les 9 maladies du LDB 20 sont câblées', () => {
  it('toutes présentes dans diseaseDefs()', () => {
    for (const n of ['infection-mineure', 'blessure-purulente', 'infection-du-sang', 'courante-galopante',
      'fievre-du-rongeur', 'flux-sanglant', 'peste-noire', 'verole-du-tanneur', 'verole-urticante']) {
      expect(diseaseDefs()[n], n).toBeTruthy();
    }
  });
  it('Fièvre du Rongeur : symptômes du verbatim (l.55)', () => {
    expect(diseaseDefs()['fievre-du-rongeur'].symptoms.map((s) => s.symptomId).sort()).toEqual(
      ['blesse', 'convulsions', 'demangeaisons', 'fievre', 'malaise', 'persistant'].sort(),
    );
  });
});

describe('nouveaux symptômes — pénalités (LDB 20 l.99-200)', () => {
  it('bubons : −10 Tests Physiques ET Sociabilité', () => {
    const c = mk({ diseases: [active('peste-noire')] });
    expect(pen(c, 'force')).toContain(-10);
    expect(pen(c, 'sociabilite')).toContain(-10);
  });
  it('convulsions : −10 Physiques (pas la Sociabilité)', () => {
    const c = mk({ diseases: [active('fievre-du-rongeur')] });
    expect(pen(c, 'agilite')).toContain(-10);
  });
  /**
   * LDB 20 l.157 : « Subissez une pénalité de -10 […] Si le symptôme est indiqué (Modéré), cette pénalité
   * passe à -20. Si le symptôme est indiqué comme (Grave), vous devez être attaché […] ». Le livre ne
   * RECHIFFRE pas (Grave) : le palier grave reprend −20 (arbitrage `maison` porté par `symptoms.json`),
   * faute de quoi aggraver Modéré → Grave ALLÉGERAIT la pénalité.
   */
  it('convulsions : (Grave) n’est JAMAIS plus léger que (Modéré)', () => {
    const par = (severity?: 'moderee' | 'grave'): number => {
      const dz = active('fievre-du-rongeur');
      dz.symptoms = dz.symptoms.map((s) => (s.symptomId === 'convulsions' ? { ...s, ...(severity ? { severity } : {}) } : s));
      const c = mk({ diseases: [dz] });
      return Math.min(...pen(c, 'agilite'));
    };
    expect(par(undefined)).toBe(-10);
    expect(par('moderee')).toBe(-20);
    expect(par('grave'), '(Grave) est moins lourd que (Modéré)').toBeLessThanOrEqual(par('moderee'));
  });
  it('démangeaisons : −10 Sociabilité seulement', () => {
    const c = mk({ diseases: [active('verole-du-tanneur')] });
    expect(pen(c, 'sociabilite')).toContain(-10);
    expect(pen(c, 'force')).toEqual([]);
  });
  it('gangrène : compte comme Blessé (bloque 1 PB de guérison) + −10 Soc', () => {
    const c = mk({ diseases: [active('peste-noire')] });
    expect(diseaseBlesseCount(c)).toBeGreaterThanOrEqual(1);
  });
  it('nausée / toux : prédicats pour les câblages (Sonné sur Esquive ratée, contagion)', () => {
    const c = mk({ diseases: [active('courante-galopante')] });
    expect(hasActiveCapability(c, 'nausea')).toBe(true);
    const v = mk({ diseases: [active('verole-urticante')] });
    expect(contagiousDiseases(v).length).toBe(1);
  });
});

describe('Vérole Urticante — immunité après guérison (l.97)', () => {
  it('guérison naturelle → inscrite dans diseaseImmunities ; recontraction impossible', () => {
    const c = mk({ diseases: [contractDisease('verole-urticante', makeRNG(2), { incubation: 0, duration: 1 })!] });
    // Le Test de fin part à la porte ; l'issue est INJECTÉE (réussite) → guérison + immunité.
    const { specs, defer } = porteEntretien();
    tickDisease(c, 2 * MINUTES_PER_DAY, makeRNG(3), defer);
    for (const s of specs) applique(c, s, { success: true }, desDuTest);
    expect(c.diseases).toEqual([]);
    expect(c.diseaseImmunities).toContain('verole-urticante');
    const log = rollContraction(c, 'verole-urticante', 0, 'tresDifficile', makeRNG(4)); // Test impossible à réussir
    expect(log).toEqual([]);
    expect(c.diseases).toEqual([]);
  });
});

describe('gangrène — progression journalière (l.135+)', () => {
  it('échecs cumulés > BE → Localisation perdue (journalisée)', () => {
    const c = mk({ diseases: [contractDisease('peste-noire', makeRNG(5), { incubation: 0, duration: 30 })!] });
    // Le Test journalier de Gangrène part à la porte (« Test de Résistance Accessible (+20) », LDB 20
    // l.176) ; issues INJECTÉES : tout raté, BE 0 → Localisation perdue dès le 1er échec.
    const { specs, defer } = porteEntretien();
    tickDisease(c, 3 * MINUTES_PER_DAY, makeRNG(6), defer, 0);
    const gangrenes = specs.filter((s) => s.kind === 'diseaseGangrene');
    expect(gangrenes.length, 'un Test par journée pleine').toBe(3);
    expect(gangrenes[0].test, 'la porte sait ce qui est testé').toEqual({ skill: 'resistance' });
    expect(gangrenes[0].difficulty).toBe('accessible');
    const log = gangrenes.flatMap((s) => applique(c, s, { success: false }, desDuTest));
    expect(log.some((l) => /Gangrène a gagné/.test(l))).toBe(true);
    expect(c.diseases![0].gangreneLost).toBe(true);
  });
});
