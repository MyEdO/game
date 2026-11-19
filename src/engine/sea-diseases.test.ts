import { describe, it, expect } from 'vitest';
import { Combatant } from './types';
import { RNG, makeRNG } from './dice';
import { MINUTES_PER_DAY } from './clock';
import {
  avancerLesMaladies,
  applyContraction,
  contagiousDiseases,
  contractDisease,
  contractionDue,
  prolongDisease,
  tickDisease,
  type PorteurDeMaladies,
} from './disease';
import { mangerLaCale, noterLeRepas, type LotDeVivres } from './provisions';
import type { Id } from '../data/schemas/grammaire/ref';
import { porteEntretien, applique } from './upkeepPorte.testkit';
import { desDuTest, desEnSuite } from './dice.testkit';

/** RNG scripté : renvoie les valeurs dans l'ordre. */
const seq = (values: number[]): RNG => desEnSuite(values);
const sick = (over: Partial<Combatant> = {}): Combatant => ({ label: 'Marin', diseases: [], conditions: [], skills: [], ...over }) as Combatant;
const FRAIS = 'nourriture-courses-journee' as Id<'trapping'>;
const BISCUITS = 'ration-biscuits-de-mer' as Id<'trapping'>;

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

describe('Scorbut (MDG 14 l.232) — la Durée ne décroît qu’aux jours de vivres frais', () => {
  const scorbutDe = (jours: number) => contractDisease('scorbut', seq([]), { incubation: 0, duration: jours })!;

  it('sans vivre frais : la Durée reste entière, la maladie persiste', () => {
    const c = sick({ diseases: [scorbutDe(2)], regimeDeBord: { joursSansVivreFrais: 12, joursDeSoupe: 0 } });
    tickDisease(c, 5 * MINUTES_PER_DAY, seq([]), () => {});
    expect(c.diseases!.map((d) => [d.id, d.minutesLeft])).toEqual([['scorbut', 2 * MINUTES_PER_DAY]]);
  });

  it('aux jours de vivres frais : −1 jour par jour, puis guérison', () => {
    const c = sick({ diseases: [scorbutDe(2)] });
    noterLeRepas(c, FRAIS);
    tickDisease(c, MINUTES_PER_DAY, seq([]), () => {});
    expect(c.diseases![0].minutesLeft).toBe(MINUTES_PER_DAY);
    noterLeRepas(c, FRAIS);
    const log = tickDisease(c, MINUTES_PER_DAY, seq([]), () => {});
    expect(c.diseases).toEqual([]);
    expect(log.some((l) => l.includes('Scorbut'))).toBe(true);
  });

  it('une maladie sans `dureeAuFrais` décroît sans vivre frais', () => {
    const c = sick({ diseases: [contractDisease('mal-de-mer', seq([]), { incubation: 0, duration: 3 })!], regimeDeBord: { joursSansVivreFrais: 12, joursDeSoupe: 0 } });
    tickDisease(c, MINUTES_PER_DAY, seq([]), () => {});
    expect(c.diseases![0].minutesLeft).toBe(2 * MINUTES_PER_DAY);
  });
});

describe('Porteur sans fiche (`PorteurDeMaladies`) — même cycle qu’un PJ', () => {
  it('contraction, contagion, déclaration et guérison sur un équipage sans fiche', () => {
    const equipage: PorteurDeMaladies = { label: 'L’équipage', diseases: [] };
    expect(contractionDue(equipage, 'verole-urticante')).toBe(true);
    applyContraction(equipage, 'verole-urticante', false, makeRNG(1));
    expect(equipage.diseases!.map((d) => d.phase)).toEqual(['incubation']);
    const dz = equipage.diseases![0];
    const log = avancerLesMaladies(equipage, dz.minutesLeft, makeRNG(1));
    expect(dz.phase).toBe('active');
    expect(log).toHaveLength(1);
    expect(contagiousDiseases(equipage).map((d) => d.id)).toEqual(['verole-urticante']);
    const cure = avancerLesMaladies(equipage, dz.minutesLeft, makeRNG(1));
    expect(equipage.diseases).toEqual([]);
    expect(cure).toHaveLength(1);
    expect(equipage.diseaseImmunities).toEqual(['verole-urticante']);
    expect(contractionDue(equipage, 'verole-urticante')).toBe(false);
  });

  it('le Rhume commun mue en Pneumonie au même jour en pas d’une journée ou d’une heure (EDOC 08 l.122)', () => {
    const apres = (pas: number) => {
      const equipage: PorteurDeMaladies = {
        label: 'L’équipage',
        diseases: [contractDisease('rhume-commun', seq([]), { incubation: 0, duration: 10 })!],
      };
      prolongDisease(equipage, 'rhume-commun', 10);
      for (let minute = 0; minute < 14 * MINUTES_PER_DAY; minute += pas) {
        avancerLesMaladies(equipage, pas, seq([]));
      }
      expect(equipage.diseases).toMatchObject([{ id: 'rhume-commun', activeDaysElapsed: 14 }]);
      const rng = seq([1, 1, 1]);
      for (let minute = 0; minute < MINUTES_PER_DAY; minute += pas) {
        avancerLesMaladies(equipage, pas, rng);
      }
      return equipage.diseases;
    };

    const enJours = apres(MINUTES_PER_DAY);
    expect(enJours).toMatchObject([{ id: 'pneumonie', phase: 'active' }]);
    expect(apres(60)).toEqual(enJours);
  });

  it('scorbut du porteur sans fiche : ne décroît qu’aux jours de vivres frais', () => {
    const equipage: PorteurDeMaladies = { label: 'L’équipage', diseases: [contractDisease('scorbut', seq([]), { incubation: 0, duration: 1 })!], regimeDeBord: { joursSansVivreFrais: 3, joursDeSoupe: 0 } };
    avancerLesMaladies(equipage, 4 * MINUTES_PER_DAY, makeRNG(1));
    expect(equipage.diseases!.map((d) => d.id)).toEqual(['scorbut']);
    noterLeRepas(equipage, FRAIS);
    avancerLesMaladies(equipage, MINUTES_PER_DAY, makeRNG(1));
    expect(equipage.diseases).toEqual([]);
  });

  /** Jours de Durée que décompte l'horloge après `jours` repas de la cale `lots`, en pas de `pas` jours. */
  const decompte = (lots: LotDeVivres[], jours: number, pas: number): number => {
    const equipage: PorteurDeMaladies = { label: 'L’équipage', diseases: [contractDisease('scorbut', seq([]), { incubation: 0, duration: 10 })!] };
    for (const repas of mangerLaCale(lots, 1, jours, 0).repas) noterLeRepas(equipage, repas);
    for (let k = 0; k < jours / pas; k++) avancerLesMaladies(equipage, pas * MINUTES_PER_DAY, makeRNG(1));
    return 10 - equipage.diseases![0].minutesLeft / MINUTES_PER_DAY;
  };

  it('la Durée décompte un jour par jour de vivre frais mangé, quel que soit le découpage de l’horloge (MDG 14 l.232)', () => {
    const fraisPuisBiscuits = [{ vivre: FRAIS, entre: 0, rations: 3 }, { vivre: BISCUITS, entre: 0, rations: 10 }];
    expect(decompte(fraisPuisBiscuits, 4, 4)).toBe(3);
    expect(decompte(fraisPuisBiscuits, 4, 1)).toBe(3);
    expect(decompte([{ vivre: FRAIS, entre: 0, rations: 10 }], 4, 4)).toBe(4);
  });
});
