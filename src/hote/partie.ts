/**
 * CE QU'UN HÔTE DU NOYAU FAIT D'UNE PARTIE (#2928), commun à
 * l'hôte texte (`src/hoteTexte/`) et aux hôtes externes (`hotes/`) : l'erreur structurée d'un geste et sa catégorie,
 * l'en-tête d'une partie (son scénario de test et ses entrées), son ouverture (la partie du noyau, le scénario lancé, la
 * tenue des jetons programmés, que l'horloge virtuelle du noyau rejoue chez un hôte sans minuteur). Un hôte qui a ses
 * minuteurs (Godot) rend lui-même chaque jeton ; le geste joué sur la partie vit dans `geste.ts`.
 */
import {
  creerPartie, etatInitialDuJeu, preferenceDef, refusDesSurcharges, ruleOverrides, valeurDEntree,
  type Cadence, type EntreesDeLaPartie, type EtatDeJeu, type FabriqueDId, type LancementDeScenario, type IdDePreference, type PrefValue, type Jeton, type Partie, type Programme, type ResultatDeLAppel,
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

/** Les entrées d'une partie, hors de son scénario. */
export type EntreesDeLEntete = Omit<Entete, 'scenario'>;

/** Les entrées d'une partie neuve, ou l'erreur de validation qui les refuse ; cadence et dés fixés sont jugés par la
 *  table des préférences (`valeurDEntree`). */
export function nouvellesEntrees(options: { graine?: number; cadence?: unknown; desFixes?: unknown; regles?: Record<string, unknown> }): EntreesDeLEntete {
  const graine = options.graine ?? 1;
  valider(Number.isInteger(graine), `graine non entière : ${graine}`);
  const regles = options.regles ?? {};
  const refus = refusDesSurcharges(regles);
  valider(refus.length === 0, `règles refusées : ${refus.map((r) => r.raison).join(' ; ')}`);
  return {
    graine, regles,
    cadence: preference('combat-cadence', options.cadence) as Cadence,
    desFixes: preference('des-fixes', options.desFixes) as boolean,
  };
}

/** Les entrées d'une partie du jeu à la graine `graine` : les règles maison `regles`, à défaut celles en vigueur, et
 *  la cadence et les dés fixés en vigueur aux préférences de l'hôte, que l'ouverture de la partie repose. */
export function entreesDuJeu(graine: number, regles: Record<string, unknown> = ruleOverrides()): EntreesDeLEntete {
  return nouvellesEntrees({ graine, regles, cadence: preferenceDef('combat-cadence')!.get(), desFixes: preferenceDef('des-fixes')!.get() });
}

/** L'en-tête d'une partie neuve, ou l'erreur de validation qui le refuse (`nouvellesEntrees`). */
export function nouvelEntete(scenario: string, options: Parameters<typeof nouvellesEntrees>[0]): Entete {
  scenarioDeTest(scenario);
  return { scenario, ...nouvellesEntrees(options) };
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
 *  d'arrivée (`programmes`), à partir de `premier` ; `reprendre` rejoue celui d'un numéro, une fois ; `suivant` : le
 *  numéro que recevra le prochain, d'où un hôte qui ouvre une partie après l'autre fait partir la tenue de la suivante,
 *  aucun numéro ne désignant deux jetons. */
export function tenueDesJetons(partie: Pick<Partie, 'reprendre'>, premier = 0) {
  const tenus = new Map<number, Jeton>();
  let suivant = premier;
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
    suivant: (): number => suivant,
  };
}

/** La tenue des jetons d'une partie. */
export type TenueDesJetons = ReturnType<typeof tenueDesJetons>;

/** Une partie au groupe : la partie du noyau et la tenue de ses jetons. */
export interface PartieAuGroupe {
  partie: Partie;
  jetons: TenueDesJetons;
}

/** Une partie ouverte sur un lancement : la partie au groupe, et le résultat du lancement. */
export interface PartieOuverte extends PartieAuGroupe {
  lancement: ResultatDeLAppel;
}

/** Ouvre la partie de l'en-tête : son scénario lancé par le constructeur unique du lancement (`lancementDuScenario`,
 *  `ouvrirLeLancement`). */
export function ouvrirLaPartie(entete: Entete, persisterLeHeros: EntreesDeLaPartie['persisterLeHeros'], premierJeton = 0): PartieOuverte {
  const scenario = scenarioDeTest(entete.scenario);
  return ouvrirLeLancement(entete, (idNeuf) => lancementDuScenario(scenario, idNeuf), persisterLeHeros, premierJeton);
}

/** Ouvre la partie des entrées `entrees` sur l'état `etat` (`creerPartie`) : l'état initial, au groupe, sans scène ni
 *  lancement, dont le groupe se compose par les verbes du noyau avant de se lancer (`Partie.lancer`) ; ou l'état d'une
 *  sauvegarde chargée (`chargerLaSave`). Le héros est persisté par le service `persisterLeHeros` de l'hôte
 *  (`EntreesDeLaPartie`), ses jetons numérotés à partir de `premierJeton`. */
export function ouvrirAuGroupe(entrees: EntreesDeLEntete, persisterLeHeros: EntreesDeLaPartie['persisterLeHeros'], premierJeton = 0, etat: EtatDeJeu = etatInitialDuJeu()): PartieAuGroupe {
  const partie = creerPartie(etat, {
    graine: entrees.graine,
    reglesMaison: entrees.regles,
    cadence: entrees.cadence,
    desFixes: entrees.desFixes,
    persisterLeHeros,
  });
  return { partie, jetons: tenueDesJetons(partie, premierJeton) };
}

/** Ouvre la partie des entrées `entrees` (`ouvrirAuGroupe`), puis lance ce que `lancement` construit aux ids de la
 *  partie (`forgerUnId`). Un lancement qui lève ferme la partie. */
export function ouvrirLeLancement(entrees: EntreesDeLEntete, lancement: (idNeuf: FabriqueDId) => LancementDeScenario, persisterLeHeros: EntreesDeLaPartie['persisterLeHeros'], premierJeton = 0): PartieOuverte {
  const o = ouvrirAuGroupe(entrees, persisterLeHeros, premierJeton);
  try {
    return { ...o, lancement: o.partie.lancer(lancement(o.partie.etat().forgerUnId)) };
  } catch (erreur) {
    o.partie.fermer();
    throw erreur;
  }
}
