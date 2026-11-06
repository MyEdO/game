/**
 * LES IDS QU'UN VERBE DÉSIGNE (#2898) : un alias de type par genre d'id que le jeu sait énumérer, et LA table
 * (`DESIGNATIONS`) qui, pour chaque nom d'alias, donne son nom en mots et lit dans l'état les ids valides. Les paramètres d'`ActionsDuNoyau` (`actionsDuNoyau.ts`, `rollFlowSpecs.ts`) portent ces alias ; le générateur
 * des verbes (`scripts/docs/lib/verbesDeLaPartie.mjs`) lit le NOM de l'alias écrit dans la déclaration du paramètre,
 * pour les seules clés de cette table, et un hôte (`argumentsDuVerbe`, `src/hote/geste.ts`) refuse un id que la table ne
 * rend pas. Un genre neuf : un alias et une entrée ici, rien dans l'hôte.
 */
import type { Jeu } from './etat';
import { portesDuMobile } from './marcheDuGroupe';
import { scenesDuRegistre } from './monde/registreDesScenes';
import { itemLabel } from '../engine/items';
import { findMoraleFactor } from '../engine/crewMorale';
import { ACTIONS, findCreatureById, findSeaShantyById, findTrappingById, pregens } from '../data';
import { conjureFormOptions } from '../engine/conjuredWeapons';
import { actFirstIds } from './turnEconomy';
import { preemptShooterIds } from './targeting';
import { chansonsDuChanteur, choixDePaieOuverts } from './shipCrew';
import { creaturesADepecer } from './combatEffects';
import { actorIn } from './monde/combatants';
import { adversairesADistraire, adversairesDuBattement } from './combatManeuvers';
import { idsDuCoupleMonte } from './targetingModes';
import { reponsesDuNoeud } from './dialogue';
import { plaiesDeLOperation } from './medicFlow';
import { seaActivitiesCatalog } from './seaActivities';

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
/** Un combattant que `roundStartPromote` accepte (`actFirstIds`, `turnEconomy.ts`). */
export type IdDeCombattantPromouvable = string;
/** Un tireur que `armPreempt` et `preemptRangedShot` acceptent (`preemptShooterIds`, `targeting.ts`). */
export type IdDeTireurRapide = string;
/** Une chanson que le réglage `shanty.chanson` accepte (`chansonsDuChanteur`, `shipCrew.ts`). */
export type IdDeChanson = string;
/** Une forme d'arme invoquée que le lanceur du Sort en attente peut donner (`conjureFormOptions`), par l'id de son arme. LDB 47 */
export type IdDeFormeConjuree = string;
/** Un choix de paie que le choix `council.paie` accepte (`choixDePaieOuverts`, `shipCrew.ts`). */
export type IdDeChoixDePaie = string;
/** Une créature que `harvestCreature` accepte (`creaturesADepecer`, `combatEffects.ts`). */
export type IdDeCreatureADepecer = string;
/** Un adversaire que le réglage `battement.adversaire` accepte (`adversairesDuBattement`, `combatManeuvers.ts`). */
export type IdDAdversaireDuBattement = string;
/** Un adversaire que le réglage `distraire.adversaire` accepte (`adversairesADistraire`, `combatManeuvers.ts`). */
export type IdDAdversaireADistraire = string;
/** Le cavalier ou la monture que le choix `mountTarget.cible` accepte (`idsDuCoupleMonte`, `targetingModes.ts`). */
export type IdDuCoupleMonte = string;
/** Une Activité en mer du catalogue (`seaActivitiesCatalog`, MDG 15 l.268). */
export type IdDActiviteEnMer = string;
/** Une réponse VISIBLE du nœud de dialogue courant, par son `id` (`reponsesDuNoeud`, `dialogue.ts`). */
export type IdDeReponseDeDialogue = string;
/** Une Blessure Critique que l'opération armée peut viser, par son `uid` (`plaiesDeLOperation`, `medicFlow.ts`). */
export type IdDePlaieDeLOperation = string;
/** Un accès de pièce que le mobile du monde emprunte, par son `id` (`portesDuMobile`, `marcheDuGroupe.ts`). */
export type IdDePorte = string;
/** Un indice présent au carnet (`clues`). */
export type IdDIndice = string;
/** Un pré-tiré de la donnée (`pregens.json`), par son `id`. */
export type IdDePretire = string;
/** Une offre du registre des actions (`actions.json`), par son `id`. */
export type IdDOffre = string;

/** Une désignation : son nom en mots, les ids valides qu'elle lit dans l'état, et le nom en mots du joueur de
 *  l'élément d'un id (`null` : l'élément n'a pas de nom). */
interface Designation {
  mot: string;
  lire: (s: Jeu) => readonly string[];
  nom: (s: Jeu, id: string) => string | null;
}

const ids = (xs: readonly { id: string }[]): string[] => xs.map((x) => x.id);
const sansDoublon = (xs: readonly string[]): string[] => [...new Set(xs)];
const lesCombattants = (s: Jeu) => [...(s.battle?.combatants ?? []), ...s.party];
const combattants = (s: Jeu): string[] => sansDoublon(ids(lesCombattants(s)));
/** Le `label` de l'élément d'id `id` parmi `xs`. */
const labelParmi = (xs: readonly { id: string; label?: string }[], id: string): string | null => xs.find((x) => x.id === id)?.label ?? null;
const nomDeCombattant = (s: Jeu, id: string): string | null => labelParmi(lesCombattants(s), id);
const lesObjets = (s: Jeu) => [...lesCombattants(s).flatMap((c) => c.items ?? []), ...s.possessions.flatMap((p) => p.items)];
/** Les armes dont le lanceur du Sort en attente peut donner la forme (`conjureFormOptions`), LDB 47. */
const formesConjurables = (s: Jeu): string[] => {
  const lanceur = s.pendingCast ? actorIn(s, s.pendingCast.casterId) : undefined;
  return lanceur ? conjureFormOptions(lanceur).map((f) => f.weapon) : [];
};
const labelDePossession = (s: Jeu, uid: string): string | null => s.possessions.find((p) => p.uid === uid)?.label ?? null;

/** Les désignations, par NOM d'alias. `mot` est un littéral : le générateur des
 *  verbes le lit au source. */
export const DESIGNATIONS = {
  IdDeCombattant: { mot: 'id de combattant', lire: combattants, nom: nomDeCombattant },
  IdDeHeros: { mot: 'id de héros', lire: (s) => ids(s.party), nom: (s, id) => labelParmi(s.party, id) },
  IdDePorteur: { mot: 'id de porteur', lire: (s) => [...ids(s.party), ...s.possessions.map((p) => p.uid)], nom: (s, id) => labelParmi(s.party, id) ?? labelDePossession(s, id) },
  IdDePossession: { mot: 'id de possession', lire: (s) => s.possessions.map((p) => p.uid), nom: labelDePossession },
  IdDObjet: {
    mot: 'id d’objet',
    lire: (s) => sansDoublon(lesObjets(s).map((i) => i.uid)),
    nom: (s, uid) => {
      const objet = lesObjets(s).find((i) => i.uid === uid);
      return objet ? itemLabel(objet) : null;
    },
  },
  IdDeScene: {
    mot: 'id de scène',
    lire: (s) => sansDoublon([...(s.scene ? [s.scene.id] : []), ...ids(scenesDuRegistre())]),
    nom: (s, id) => labelParmi([...(s.scene ? [s.scene] : []), ...scenesDuRegistre()], id),
  },
  IdDEntiteDeScene: { mot: 'id d’entité de scène', lire: (s) => ids(s.scene?.entities ?? []), nom: (s, id) => labelParmi(s.scene?.entities ?? [], id) },
  IdDeCombattantPromouvable: { mot: 'id de combattant promouvable', lire: actFirstIds, nom: nomDeCombattant },
  IdDeTireurRapide: { mot: 'id de tireur rapide', lire: (s) => preemptShooterIds(() => s), nom: nomDeCombattant },
  IdDeChanson: { mot: 'id de chanson', lire: chansonsDuChanteur, nom: (_s, id) => findSeaShantyById(id)?.label ?? null },
  IdDeFormeConjuree: { mot: 'id de forme conjurée', lire: formesConjurables, nom: (_s, id) => findTrappingById(id)?.label ?? null },
  IdDeChoixDePaie: { mot: 'id de choix de paie', lire: choixDePaieOuverts, nom: (_s, id) => findMoraleFactor(id)?.label ?? null },
  IdDeCreatureADepecer: { mot: 'id de créature à dépecer', lire: creaturesADepecer, nom: (_s, id) => findCreatureById(id)?.label ?? null },
  IdDAdversaireDuBattement: { mot: 'id d’adversaire du Battement', lire: (s) => ids(adversairesDuBattement(s)), nom: nomDeCombattant },
  IdDAdversaireADistraire: { mot: 'id d’adversaire à distraire', lire: (s) => ids(adversairesADistraire(s)), nom: nomDeCombattant },
  IdDuCoupleMonte: { mot: 'id du couple monté', lire: idsDuCoupleMonte, nom: nomDeCombattant },
  IdDActiviteEnMer: { mot: 'id d’Activité en mer', lire: () => ids(seaActivitiesCatalog()), nom: (_s, id) => labelParmi(seaActivitiesCatalog(), id) },
  IdDeReponseDeDialogue: { mot: 'id de réponse de dialogue', lire: (s) => ids(reponsesDuNoeud(s)), nom: (s, id) => labelParmi(reponsesDuNoeud(s), id) },
  IdDePlaieDeLOperation: {
    mot: 'id de plaie de l’opération',
    lire: (s) => plaiesDeLOperation(s).map((p) => p.uid),
    nom: (s, uid) => plaiesDeLOperation(s).find((p) => p.uid === uid)?.label ?? null,
  },
  IdDePorte: { mot: 'id de porte', lire: (s) => ids(portesDuMobile(s)), nom: () => null },
  IdDePretire: { mot: 'id de pré-tiré', lire: () => ids(pregens), nom: (_s, id) => labelParmi(pregens, id) },
  IdDOffre: { mot: 'id d’offre', lire: () => ids(ACTIONS), nom: (_s, id) => labelParmi(ACTIONS, id) },
  IdDIndice: { mot: 'id d’indice', lire: (s) => Object.keys(s.clues), nom: (s, id) => s.campaignNarratif?.indices.find((i) => i.id === id)?.titre ?? null },
} satisfies Record<string, Designation>;
