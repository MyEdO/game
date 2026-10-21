/**
 * CE QU'UN HÔTE DU NOYAU FAIT D'UNE PARTIE (#2928, plan `docs/plans/2026-10-21-vague6-hote-godot.md` B1, B-b), commun à
 * l'hôte texte (`src/hoteTexte/`) et aux hôtes externes (`hotes/`) : l'erreur structurée d'un geste et sa catégorie, le
 * contrôle des arguments d'un verbe contre ses paramètres (`formes.ts`, `verbes.generated.ts`), le scénario de test
 * nommé par son id et son lancement, la tenue des jetons programmés. L'horloge qui les rejoue reste à chaque hôte.
 */
import {
  DESIGNATIONS,
  type Jeton, type Jeu, type Partie, type ResultatDeLAppel,
} from '../noyau/index';
import { lireALaForme, signature, type Designes, type ParametreDeVerbe } from './formes';
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

/** Ce que l'état désigne, lu par la table du noyau (`DESIGNATIONS`). */
const designesDe = (etat: Jeu): Designes => (cle) =>
  cle in DESIGNATIONS ? DESIGNATIONS[cle as keyof typeof DESIGNATIONS].lire(etat) : undefined;

/** Les arguments d'un verbe, lus à leurs paramètres (`lireALaForme`) : un id que l'état ne désigne pas lève une erreur
 *  de validation qui nomme les ids valides, un objet désigné par son id est complété, `null` omet un paramètre
 *  optionnel, un argument de forme fausse, en trop ou manquant lève une erreur de validation. */
export function argumentsDuVerbe(etat: Jeu, verbe: string, args: readonly unknown[], parametres: readonly ParametreDeVerbe[]): unknown[] {
  valider(args.length <= parametres.length, `${verbe} : ${parametres.length} argument(s) au plus (${signature(verbe, parametres)})`);
  for (const p of parametres.slice(args.length)) valider(p.optionnel, `${verbe} : l’argument ${p.nom} manque (${signature(verbe, parametres)})`);
  return args.map((brut, i) => {
    const p = parametres[i];
    // JSON n'a pas d'`undefined` : `null` omet un paramètre optionnel, pour en poser un suivant.
    if (brut === null && p.optionnel) return brut;
    const lu = lireALaForme(brut, p.forme, p.nom, designesDe(etat));
    if ('ecart' in lu) throw new ErreurDeGeste('validation', `${verbe} : ${lu.ecart} (${signature(verbe, parametres)})`);
    return lu.valeur;
  });
}

/** Le scénario de test `id` du catalogue (`testScenarios`), ou l'erreur de validation qui le refuse. */
export function scenarioDeTest(id: string): TestScenario {
  const scenario = testScenarios.find((s) => s.id === id);
  if (!scenario) throw new ErreurDeGeste('validation', `scénario inconnu : ${id}`);
  return scenario;
}

/** Lance `scenario` sur la partie, par le constructeur unique du lancement (`lancementDuScenario`). */
export const lancerLeScenarioDeTest = (partie: Partie, scenario: TestScenario): ResultatDeLAppel => partie.lancer(lancementDuScenario(scenario));

/** Un jeton programmé, numéroté : un jeton du noyau est une identité d'objet (`partie.ts`), qui ne traverse pas JSON. */
export interface Programme {
  id: number;
  delai: number;
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
