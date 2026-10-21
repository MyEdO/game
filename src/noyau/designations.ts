/**
 * LES IDS QU'UN VERBE DÉSIGNE (#2898) : un alias de type par genre d'id que le jeu sait énumérer, et LA table
 * (`DESIGNATIONS`) qui, pour chaque nom d'alias, donne son nom en mots et lit dans l'état les ids valides, ou les objets désignés par leur
 * `id`. Les paramètres d'`ActionsDuNoyau` (`actionsDuNoyau.ts`, `rollFlowSpecs.ts`) portent ces alias ; le générateur
 * des verbes (`scripts/docs/lib/verbesDeLaPartie.mjs`) lit le NOM de l'alias écrit dans la déclaration du paramètre,
 * pour les seules clés de cette table, et l'hôte texte (`src/hoteTexte/partieTexte.ts`) refuse un id que la table ne
 * rend pas. Un genre neuf : un alias et une entrée ici, rien dans l'hôte.
 */
import type { EtatDeJeu } from './etat';
import { portalsForParty, type RoomPortal } from './monde/roomPortals';
import { scenesDuRegistre } from './monde/registreDesScenes';

/** Un combattant : la file de combat et le groupe (`porteurParId`, `monde/combatants.ts`). */
export type IdDeCombattant = string;
/** Un héros du groupe (`party`). */
export type IdDeHeros = string;
/** Un porteur d'objets : un héros du groupe ou une possession (`resolveCarrier`, `monde/carrier.ts`). */
export type IdDePorteur = string;
/** Une possession du groupe, par son `uid`. */
export type IdDePossession = string;
/** Un objet porté (`ItemInstance.uid`) par un héros, un combattant ou une possession. */
export type IdDObjet = string;
/** Une scène que la partie rejoint : la scène courante et celles du registre (`scenesDuRegistre`), celui que lit
 *  `transitionTo`. */
export type IdDeScene = string;
/** Une entité de la scène courante (`scene.entities`). */
export type IdDEntiteDeScene = string;
/** Une étape de la cascade ouverte (`pendingCascade.participants`). */
export type IdDEtapeDeCascade = string;

/** Une désignation : son nom en mots, et ce qu'elle lit dans l'état, les ids valides ou les objets désignés par leur `id`. */
interface Designation {
  mot: string;
  lire: (s: EtatDeJeu) => readonly string[] | readonly { id: string }[];
}

const ids = (xs: readonly { id: string }[]): string[] => xs.map((x) => x.id);
const sansDoublon = (xs: readonly string[]): string[] => [...new Set(xs)];
const combattants = (s: EtatDeJeu): string[] => sansDoublon([...ids(s.battle?.combatants ?? []), ...ids(s.party)]);

/** Les désignations, par NOM d'alias (ou d'interface désignée par son `id`). `mot` est un littéral : le générateur des
 *  verbes le lit au source. */
export const DESIGNATIONS = {
  IdDeCombattant: { mot: 'id de combattant', lire: combattants },
  IdDeHeros: { mot: 'id de héros', lire: (s) => ids(s.party) },
  IdDePorteur: { mot: 'id de porteur', lire: (s) => [...ids(s.party), ...s.possessions.map((p) => p.uid)] },
  IdDePossession: { mot: 'id de possession', lire: (s) => s.possessions.map((p) => p.uid) },
  IdDObjet: {
    mot: 'id d’objet',
    lire: (s) => sansDoublon([
      ...[...(s.battle?.combatants ?? []), ...s.party].flatMap((c) => (c.items ?? []).map((i) => i.uid)),
      ...s.possessions.flatMap((p) => p.items.map((i) => i.uid)),
    ]),
  },
  IdDeScene: { mot: 'id de scène', lire: (s) => sansDoublon([...(s.scene ? [s.scene.id] : []), ...ids(scenesDuRegistre())]) },
  IdDEntiteDeScene: { mot: 'id d’entité de scène', lire: (s) => ids(s.scene?.entities ?? []) },
  IdDEtapeDeCascade: { mot: 'id d’étape de cascade', lire: (s) => ids(s.pendingCascade?.participants ?? []) },
  RoomPortal: { mot: 'id de porte', lire: (s): readonly RoomPortal[] => (s.scene ? portalsForParty(s.scene, s.partyPos) : []) },
} satisfies Record<string, Designation>;
