/**
 * CE QU'UN HÔTE FAIT D'UNE PARTIE (#2928) : un jeton programmé
 * se numérote dans l'ordre d'arrivée et se reprend une fois par son numéro ; un scénario se nomme par son id du catalogue.
 */
import { describe, it, expect } from 'vitest';
import { ErreurDeGeste, nouvelEntete, ouvrirLaPartie, scenarioDeTest, tenueDesJetons } from './partie';
import { OPTIONAL_RULES } from '../engine/policy';
import { PREFERENCES } from '../noyau/preferences';
import { t } from '../i18n';
import { testScenarios } from '../scenes/test-scenarios';
import type { Combatant, Jeton, ResultatDeLAppel } from '../noyau/index';

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

describe('l’en-tête d’une partie', () => {
  it('refuse en `validation` une règle hors du registre ou une valeur non conforme ; accepte une surcharge conforme (#1463 LD.1)', () => {
    const [premier] = testScenarios;
    const r = OPTIONAL_RULES[0];
    const e = erreurDe(() => nouvelEntete(premier.id, { regles: { 'regle-hors-registre': true } }));
    expect(e?.categorie).toBe('validation');
    expect(e?.message).toContain(t('houseRules.refus.inconnue', { id: 'regle-hors-registre' }));
    expect(erreurDe(() => nouvelEntete(premier.id, { regles: { [r.id]: r.kind === 'flag' ? 'texte' : true } }))?.categorie).toBe('validation');
    expect(nouvelEntete(premier.id, { regles: { [r.id]: r.default } }).regles).toEqual({ [r.id]: r.default });
  });

  it('cadence et dés fixés : absents, le défaut de leur préférence ; non conformes à sa forme, refusés en `validation` (#3041)', () => {
    const [premier] = testScenarios;
    const defaut = (id: string) => PREFERENCES.find((p) => p.id === id)!.default;
    const e = nouvelEntete(premier.id, {});
    expect([e.cadence, e.desFixes]).toEqual([defaut('combat-cadence'), defaut('des-fixes')]);
    expect(erreurDe(() => nouvelEntete(premier.id, { cadence: 'inconnue' }))?.categorie).toBe('validation');
    expect(erreurDe(() => nouvelEntete(premier.id, { desFixes: 'oui' }))?.categorie).toBe('validation');
    expect(nouvelEntete(premier.id, { cadence: 'auto', desFixes: true })).toMatchObject({ cadence: 'auto', desFixes: true });
  });
});

describe('l’ouverture d’une partie', () => {
  it('le héros que le noyau persiste passe par le service `persisterLeHeros` que l’hôte fournit (#3041)', () => {
    const persistes: Combatant[] = [];
    // Hors combat : en combat, le background ne s'édite pas (`refusDuBackground`, `noyau/verrousDeFiche.ts`).
    const { partie } = ouvrirLaPartie(nouvelEntete('entrainement', { graine: 7 }), (heros) => void persistes.push(heros));
    try {
      expect(partie.etat().battle, 'témoin : la partie s’ouvre hors combat').toBeFalsy();
      const id = partie.etat().party[0].id;
      partie.envoyer({ type: 'setHeroBackground', args: [id, { motivation: 'Foi' }] });
      expect(persistes.map((h) => [h.id, h.motivation])).toEqual([[id, 'Foi']]);
    } finally {
      partie.fermer();
    }
  });
});
