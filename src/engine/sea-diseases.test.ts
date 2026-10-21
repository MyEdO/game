import { describe, it, expect } from 'vitest';
import { Combatant } from './types';
import { RNG, makeRNG } from './dice';
import { MINUTES_PER_DAY } from './clock';
import { contractDisease, tickDisease } from './disease';
import { porteEntretien, applique } from './upkeepPorte.testkit';
import { desDuTest, desEnSuite } from './dice.testkit';

/** RNG scripté : renvoie les valeurs dans l'ordre. */
const seq = (values: number[]): RNG => desEnSuite(values);
const sick = (over: Partial<Combatant> = {}): Combatant => ({ label: 'Marin', diseases: [], conditions: [], skills: [], ...over }) as Combatant;

/**
 * Maladies marines (MDG 14) — réutilisent le CYCLE de maladie EXISTANT (`disease.ts` + `maladies.json`),
 * pas de mécanique parallèle : mêmes incubation/durée/symptômes/Test de fin que les maladies du LDB 20.
 */
describe('Mal de mer (MDG 14) — cycle de maladie réutilisé', () => {
  it("onset immédiat (incubation 0) ; symptômes malaise/nausée + Test de fin Intermédiaire ; immunité après guérison", () => {
    const dz = contractDisease('mal-de-mer', seq([]))!;
    expect(dz.phase).toBe('active'); // incubation {n:0} → symptômes immédiats
    expect(dz.symptoms.map((s) => s.symptomId).sort()).toEqual(['malaise', 'nausee', 'persistant']);
    expect(dz.persistDifficulty).toBe('intermediaire'); // Résistance Intermédiaire (+0) RAW
  });

  it('guérison (Test de fin réussi) → immunité « ne souffrira plus jamais de cette forme » (immuneAfterCure)', () => {
    const c = sick({ diseases: [contractDisease('mal-de-mer', seq([]), { incubation: 0, duration: 1 })!] });
    // Fin de durée → le Test de fin part à la porte ; issue INJECTÉE : réussite → guérison.
    const { specs, defer } = porteEntretien();
    tickDisease(c, MINUTES_PER_DAY, seq([]), defer);
    for (const s of specs) applique(c, s, { success: true }, desDuTest);
    expect(c.diseases).toHaveLength(0);
    expect(c.diseaseImmunities).toContain('mal-de-mer');
  });
});

describe('Scorbut (MDG 14) — cycle de maladie réutilisé', () => {
  it('symptômes blessé/intoxication/malaise/nausée ; durée 1d10 (après reprise de nourriture fraîche)', () => {
    const dz = contractDisease('scorbut', makeRNG(1), { incubation: 0 })!;
    expect(dz.phase).toBe('active');
    expect(dz.symptoms.map((s) => s.symptomId).sort()).toEqual(['blesse', 'intoxication', 'malaise', 'nausee']);
    expect(dz.durationMinutes).toBeGreaterThanOrEqual(1 * MINUTES_PER_DAY);
    expect(dz.durationMinutes).toBeLessThanOrEqual(10 * MINUTES_PER_DAY);
  });
});
