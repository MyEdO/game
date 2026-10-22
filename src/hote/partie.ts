/**
 * CE QU'UN HÔTE DU NOYAU FAIT D'UNE PARTIE (#2928, plan `docs/plans/2026-10-21-vague6-hote-godot.md` B1, B-b), commun à
 * l'hôte texte (`src/hoteTexte/`) et aux hôtes externes (`hotes/`) : l'erreur structurée d'un geste et sa catégorie,
 * l'en-tête d'une partie (son scénario de test et ses entrées), son ouverture (la partie du noyau, le scénario lancé, la
 * tenue des jetons programmés), et l'horloge virtuelle d'un hôte sans minuteur, qui les rejoue. Un hôte qui a ses
 * minuteurs (Godot) rend lui-même chaque jeton ; le geste joué sur la partie vit dans `geste.ts`.
 */
import {
  creerPartie, etatInitialDuJeu, CADENCE_MODES,
  type Cadence, type Jeton, type Partie, type ResultatDeLAppel,
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

/** L'en-tête d'une partie neuve, ou l'erreur de validation qui le refuse. */
export function nouvelEntete(scenario: string, options: { graine?: number; cadence?: string; desFixes?: boolean; regles?: Record<string, unknown> }): Entete {
  scenarioDeTest(scenario);
  const graine = options.graine ?? 1;
  valider(Number.isInteger(graine), `graine non entière : ${graine}`);
  const cadence = options.cadence ?? 'manuel';
  valider((CADENCE_MODES as readonly string[]).includes(cadence), `cadence inconnue : ${cadence} (${CADENCE_MODES.join(', ')})`);
  return { scenario, graine, regles: options.regles ?? {}, cadence: cadence as Cadence, desFixes: options.desFixes ?? false };
}

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

/** La tenue des jetons d'une partie. */
export type TenueDesJetons = ReturnType<typeof tenueDesJetons>;

/** Le plafond de reprises d'une horloge virtuelle : au-delà, la partie boucle. */
const PLAFOND_DE_REPRISES = 100_000;

/** L'horloge virtuelle d'un hôte sans minuteur : reprend les jetons `premiers`, puis ceux que chaque reprise programme,
 *  par échéance puis par numéro (l'ordre d'arrivée), jusqu'à ce qu'il n'en reste aucun ; rend le nombre de reprises.
 *  Au-delà de `PLAFOND_DE_REPRISES`, elle lève. */
export function horlogeVirtuelle(premiers: readonly Programme[], reprendre: (id: number) => readonly Programme[]): number {
  const file: { id: number; echeance: number }[] = [];
  let horloge = 0;
  const armer = (programmes: readonly Programme[]) => {
    for (const p of programmes) file.push({ id: p.id, echeance: horloge + p.delai });
  };
  armer(premiers);
  let reprises = 0;
  for (; file.length; reprises++) {
    if (reprises >= PLAFOND_DE_REPRISES) throw new Error(`[hôte] plus de ${PLAFOND_DE_REPRISES} reprises : la partie boucle`);
    file.sort((a, b) => a.echeance - b.echeance || a.id - b.id);
    const { id, echeance } = file.shift()!;
    horloge = echeance;
    armer(reprendre(id));
  }
  return reprises;
}

/** Une partie ouverte : la partie du noyau, la tenue de ses jetons, et le résultat du lancement de son scénario. */
export interface PartieOuverte {
  partie: Partie;
  jetons: TenueDesJetons;
  lancement: ResultatDeLAppel;
}

/** Ouvre la partie de l'en-tête : la partie du noyau sur l'état initial (`creerPartie`, aucun héros persisté : l'hôte
 *  n'a pas de sauvegarde), puis son scénario lancé par le constructeur unique du lancement (`lancementDuScenario`). Un
 *  lancement qui lève ferme la partie. */
export function ouvrirLaPartie(entete: Entete): PartieOuverte {
  const scenario = scenarioDeTest(entete.scenario);
  const partie = creerPartie(etatInitialDuJeu(), {
    graine: entete.graine,
    reglesMaison: entete.regles,
    cadence: entete.cadence,
    desFixes: entete.desFixes,
    persisterLeHeros: () => {},
  });
  try {
    return { partie, jetons: tenueDesJetons(partie), lancement: partie.lancer(lancementDuScenario(scenario)) };
  } catch (erreur) {
    partie.fermer();
    throw erreur;
  }
}
