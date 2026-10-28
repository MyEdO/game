/**
 * CE QU'UN HÔTE DU NOYAU FAIT D'UNE PARTIE (#2928), commun à
 * l'hôte texte (`src/hoteTexte/`) et aux hôtes externes (`hotes/`) : l'erreur structurée d'un geste et sa catégorie,
 * l'en-tête d'une partie (son scénario de test et ses entrées), son ouverture (la partie du noyau, le scénario lancé, la
 * tenue des jetons programmés, que l'horloge virtuelle du noyau rejoue chez un hôte sans minuteur). Un hôte qui a ses
 * minuteurs (Godot) rend lui-même chaque jeton ; le geste joué sur la partie vit dans `geste.ts`.
 */
import {
  creerPartie, etatInitialDuJeu, preferenceDef, refusDesSurcharges, valeurDEntree,
  type Cadence, type EntreesDeLaPartie, type IdDePreference, type PrefValue, type Jeton, type Partie, type Programme, type ResultatDeLAppel,
} from '../noyau/index';
import { lancementDuScenario, type TestScenario } from '../scenes/test-scenarios/_shared';
import { testScenarios } from '../scenes/test-scenarios';

/** Les trois catégories d'erreur d'un geste (plan v3 de #2898, « L'issue d'un geste »). */
export type CategorieDErreur = 'validation' | 'permission' | 'regle';

/** Une erreur structurée : sa catégorie et ce qui la dit. */
export class ErreurDeGeste extends Error {
  constructor(readonly categorie: CategorieDErreur, message: string) {
    super(message);
  }
}

/** Lève l'erreur de validation `message` si `condition` est fausse. */
export const valider = (condition: unknown, message: string): void => {
  if (!condition) throw new ErreurDeGeste('validation', message);
};

/** Le scénario de test `id` du catalogue (`testScenarios`), ou l'erreur de validation qui le refuse. */
export function scenarioDeTest(id: string): TestScenario {
  const scenario = testScenarios.find((s) => s.id === id);
  if (!scenario) throw new ErreurDeGeste('validation', `scénario inconnu : ${id}`);
  return scenario;
}

/** L'en-tête d'une partie : le scénario lancé et les entrées de la partie (D8). */
export interface Entete {
  scenario: string;
  graine: number;
  regles: Record<string, unknown>;
  cadence: Cadence;
  desFixes: boolean;
}

/** L'en-tête d'une partie neuve, ou l'erreur de validation qui le refuse ; cadence et dés fixés sont jugés par la table
 *  des préférences (`valeurDEntree`). */
export function nouvelEntete(scenario: string, options: { graine?: number; cadence?: unknown; desFixes?: unknown; regles?: Record<string, unknown> }): Entete {
  scenarioDeTest(scenario);
  const graine = options.graine ?? 1;
  valider(Number.isInteger(graine), `graine non entière : ${graine}`);
  const regles = options.regles ?? {};
  const refus = refusDesSurcharges(regles);
  valider(refus.length === 0, `règles refusées : ${refus.map((r) => r.raison).join(' ; ')}`);
  return {
    scenario, graine, regles,
    cadence: preference('combat-cadence', options.cadence) as Cadence,
    desFixes: preference('des-fixes', options.desFixes) as boolean,
  };
}

/** La valeur de la préférence `id` qu'une entrée `v` donne (`valeurDEntree`), ou l'erreur de validation qui la refuse. */
function preference(id: IdDePreference, v: unknown): PrefValue {
  const valeur = valeurDEntree(id, v);
  if (valeur === undefined) {
    const options = preferenceDef(id)?.options;
    throw new ErreurDeGeste('validation', `${id} non conforme : ${JSON.stringify(v)}${options ? ` (${options.join(', ')})` : ''}`);
  }
  return valeur;
}

/** La tenue des jetons programmés d'une partie : chaque jeton qu'un résultat programme reçoit un numéro, dans l'ordre
 *  d'arrivée (`programmes`) ; `reprendre` rejoue celui d'un numéro, une fois. */
export function tenueDesJetons(partie: Pick<Partie, 'reprendre'>) {
  const tenus = new Map<number, Jeton>();
  let suivant = 0;
  return {
    programmes(resultat: ResultatDeLAppel): Programme[] {
      return resultat.evenements.flatMap((e) => {
        if (e.type !== 'programme') return [];
        const id = suivant++;
        tenus.set(id, e.jeton);
        return [{ id, delai: e.delai }];
      });
    },
    reprendre(id: number): ResultatDeLAppel {
      const jeton = tenus.get(id);
      if (!jeton) throw new ErreurDeGeste('validation', `jeton inconnu : ${id}`);
      tenus.delete(id);
      return partie.reprendre(jeton);
    },
  };
}

/** La tenue des jetons d'une partie. */
export type TenueDesJetons = ReturnType<typeof tenueDesJetons>;

/** Une partie ouverte : la partie du noyau, la tenue de ses jetons, et le résultat du lancement de son scénario. */
export interface PartieOuverte {
  partie: Partie;
  jetons: TenueDesJetons;
  lancement: ResultatDeLAppel;
}

/** Ouvre la partie de l'en-tête : la partie du noyau sur l'état initial (`creerPartie`), le héros persisté par le
 *  service `persisterLeHeros` de l'hôte (`EntreesDeLaPartie`), puis son scénario lancé par le constructeur unique du
 *  lancement (`lancementDuScenario`). Un lancement qui lève ferme la partie. */
export function ouvrirLaPartie(entete: Entete, persisterLeHeros: EntreesDeLaPartie['persisterLeHeros']): PartieOuverte {
  const scenario = scenarioDeTest(entete.scenario);
  const partie = creerPartie(etatInitialDuJeu(), {
    graine: entete.graine,
    reglesMaison: entete.regles,
    cadence: entete.cadence,
    desFixes: entete.desFixes,
    persisterLeHeros,
  });
  try {
    return { partie, jetons: tenueDesJetons(partie), lancement: partie.lancer(lancementDuScenario(scenario)) };
  } catch (erreur) {
    partie.fermer();
    throw erreur;
  }
}
