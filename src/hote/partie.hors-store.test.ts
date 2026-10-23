/**
 * CE QU'UN HÔTE FAIT D'UNE PARTIE (#2928, plan `docs/plans/2026-10-21-vague6-hote-godot.md` B-b) : un jeton programmé
 * se numérote dans l'ordre d'arrivée et se reprend une fois par son numéro ; un scénario se nomme par son id du catalogue.
 */
import { describe, it, expect } from 'vitest';
import { ErreurDeGeste, nouvelEntete, ouvrirLaPartie, scenarioDeTest, tenueDesJetons } from './partie';
import { testScenarios } from '../scenes/test-scenarios';
import type { Jeton, ResultatDeLAppel } from '../noyau/index';

/** Un résultat d'appel qui programme `jetons`, chacun à son délai, entre deux événements émis. */
const programme = (...jetons: [Jeton, number][]): ResultatDeLAppel => ({
  issue: 'appliquee',
  journal: [],
  evenements: jetons.flatMap(([jeton, delai]) => [{ type: 'emis', evt: 'move_blocked', payload: null }, { type: 'programme', jeton, delai }] as ResultatDeLAppel['evenements']),
});

const jeton = (): Jeton => Object.freeze({}) as Jeton;

/** L'erreur que `faire` lève, `null` sans erreur. */
function erreurDe(faire: () => unknown): ErreurDeGeste | null {
  try {
    faire();
    return null;
  } catch (e) {
    if (e instanceof ErreurDeGeste) return e;
    throw e;
  }
}

describe('la tenue des jetons programmés', () => {
  it('numérote les jetons dans l’ordre d’arrivée, d’un résultat au suivant, avec leur délai', () => {
    const t = tenueDesJetons({ reprendre: () => programme() });
    expect(t.programmes(programme([jeton(), 300], [jeton(), 0]))).toEqual([{ id: 0, delai: 300 }, { id: 1, delai: 0 }]);
    expect(t.programmes(programme([jeton(), 50]))).toEqual([{ id: 2, delai: 50 }]);
  });

  it('reprend le jeton de son numéro, une fois ; un numéro inconnu ou repris se refuse en `validation`', () => {
    const repris: Jeton[] = [];
    const t = tenueDesJetons({ reprendre: (j) => (repris.push(j), programme()) });
    const [a, b] = [jeton(), jeton()];
    t.programmes(programme([a, 10], [b, 20]));
    t.reprendre(1);
    t.reprendre(0);
    expect(repris).toEqual([b, a]);
    expect(erreurDe(() => t.reprendre(0))?.categorie).toBe('validation');
    expect(erreurDe(() => t.reprendre(7))?.message).toBe('jeton inconnu : 7');
  });
});

describe('le scénario de test nommé par son id', () => {
  it('rend la fiche du catalogue, ou refuse un id inconnu en `validation`', () => {
    const [premier] = testScenarios;
    expect(scenarioDeTest(premier.id)).toBe(premier);
    const e = erreurDe(() => scenarioDeTest('zz-inconnu'));
    expect([e?.categorie, e?.message]).toEqual(['validation', 'scénario inconnu : zz-inconnu']);
  });
});

describe('deux parties de la même en-tête fabriquent les mêmes ids (#2907)', () => {
  /** Les uids que porte l'état d'une partie ouverte sur l'en-tête, dans l'ordre de l'état. */
  const uidsDeLaPartie = (scenario: string): string[] => {
    const { partie } = ouvrirLaPartie(nouvelEntete(scenario, { graine: 7 }));
    try {
      return [...JSON.stringify(partie.etat()).matchAll(/"(?:uid|id)":"((?:it|hero|conjure)-[^"]*)"/g)].map((m) => m[1]);
    } finally {
      partie.fermer();
    }
  };

  it.each(['duel-naval', 'embuscade'])('%s : les deux parties d’un même processus portent les mêmes ids', (scenario) => {
    const premiere = uidsDeLaPartie(scenario);
    expect(premiere.length, 'la partie ne porte aucun id fabriqué : le témoin ne mesurerait rien').toBeGreaterThan(0);
    expect(uidsDeLaPartie(scenario)).toEqual(premiere);
  });
});
