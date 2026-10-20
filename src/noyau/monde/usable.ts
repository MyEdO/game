/**
 * UTILISABLE — dériveur UNIQUE des actions qu'une entité de scène OFFRE au joueur (#1687).
 *
 * MODÈLE UNIQUE : `estUtilisable(scene, ent, flags) = actionsDe(scene, ent, flags).length > 0`. Il
 * n'existe pas de drapeau « utilisable » à interroger : une entité est utilisable parce qu'elle a
 * quelque chose à offrir, et une capacité N+1 coûte UNE ligne de ce dériveur.
 *
 * TROIS gisements, réunis ici et nulle part ailleurs :
 *  1. les CAPACITÉS D'INSTANCE, qui vivent déjà sur l'entité et se dérivent sans rien activer —
 *     table `CAPACITES` (`dialogueId`, `merchant` ; leurs hôtes RESTENT) ;
 *  2. les ACTIONS AUTHORÉES de l'instance (`usable.actions`) — le vocabulaire OUVERT de l'auteur :
 *     un `id` stable, un `Flow`, et deux faits d'épuisement (`consume`, `unique`) ;
 *  3. l'ASSISE, si l'instance porte `usable.assise` et que son type a des places JOUABLES
 *     (`placesJouables`, `noyau/monde/seating.ts` — la seule capacité qui vive sur le TYPE, donc la seule
 *     qu'un opt-in d'instance ait à ouvrir).
 *
 * `jouer` (jeu de taverne) n'est PAS une offre : `openTavernGames` n'a aucun appelant hors du nœud
 * de dialogue `tavernGames` (`noyau/combatEffects.ts`, mesuré) — une entrée ici serait une
 * affordance morte. Le rôle `tavernGame` reste sur l'entité et se joue par son dialogue.
 *
 * PUR et FEUILLE : aucune lecture de store, aucun rendu. Les DRAPEAUX de jeu (épuisement) sont un
 * PARAMÈTRE, jamais une lecture — c'est ce qui garde ce module au bord du moteur. Les libellés
 * passent par `t()` (`MsgKey`) — jamais une chaîne joueur en dur.
 */
import { t, type MsgKey } from '../../i18n';
import { placesJouables } from './seating';
import type { Scene, SceneEntity, ActionAuthoree } from './scene';

/** Les drapeaux de jeu (`state.flags`) — seule entrée d'ÉTAT de ce module pur. */
export type Drapeaux = Readonly<Record<string, boolean | undefined>>;

/** Id CANONIQUE de l'action de fouille — celui que la migration de scène a posé sur tout ancien
 *  `interact`, et celui que l'éditeur pré-arme sur un décor `searchable` du catalogue. */
export const ACTION_FOUILLER = 'fouiller';

/** Clé du drapeau qui ÉPUISE une action authorée `unique` sur une entité donnée. SOURCE UNIQUE :
 *  l'exécuteur la pose, le dériveur et les halos la lisent. */
export const cleActionJouee = (entId: string, actionId: string): string => `__action_${entId}_${actionId}`;

/** Les capacités D'INSTANCE, par id STABLE. Une capacité N+1 = une ligne de `CAPACITES` et une ligne
 *  de sa table d'exécution (`state/store.ts`) — la seconde ne compile pas sans la première. */
export type CapaciteId = 'parler' | 'commercer';

/** Ce qu'une capacité d'instance DÉCLARE : à quelle condition l'entité l'offre, et sous quel libellé
 *  (clé de catalogue — l'id est de la LOGIQUE, le libellé de l'AFFICHAGE). */
export interface Capacite {
  offerte: (ent: SceneEntity) => boolean;
  label: MsgKey;
}

/**
 * Table TOTALE des capacités d'instance — celles qui vivent DÉJÀ sur l'entité et se dérivent sans
 * rien activer. C'est le seul endroit où une capacité se déclare : `actionsDe` la lit, l'éditeur la
 * rend par `actionsDe`, et l'exécuteur du store est keyé par le MÊME `CapaciteId`.
 */
export const CAPACITES: Readonly<Record<CapaciteId, Capacite>> = {
  parler: { offerte: (ent) => !!ent.dialogueId, label: 'usable.parler' },
  commercer: { offerte: (ent) => !!ent.merchant, label: 'usable.commercer' },
};

/** L'id d'une offre est-il celui d'une capacité d'instance ? Lu par l'exécuteur pour indexer sa
 *  table TOTALE — l'appartenance se juge sur `CAPACITES`, jamais sur une seconde liste d'ids. */
export const estCapacite = (id: string): id is CapaciteId => id in CAPACITES;

/** Une action OFFERTE par une entité — ce que le joueur lira dans sa liste. */
export interface ActionOfferte {
  /** Identité STABLE : id de capacité (`parler`, `commercer`, `sasseoir`) ou id d'action authorée
   *  (`fouiller`, …). Le `label` est de l'AFFICHAGE. */
  id: string;
  label: string;
  /** D'où l'offre vient : capacité d'instance dérivée, action authorée de l'instance, ou assise. */
  origine: 'capacite' | 'authoree' | 'assise';
}

/**
 * Les actions AUTHORÉES encore JOUABLES de `ent` : celles qu'aucun drapeau d'épuisement ne ferme.
 * SOURCE UNIQUE de « ce décor a-t-il encore quelque chose à donner » — halo, ramassage en combat et
 * offre d'exploration la lisent, aucun ne recompte.
 *
 * Une action `unique` épuisée SORT d'ici, et le décor redevient MUET : plus de halo, plus de pastille,
 * plus de curseur. Ce n'est pas un refus escamoté — un refus PORTE une raison (arbitrage 2026-08-24) et
 * nomme une porte FERMÉE, celle dont les places sont toutes prises (`offresUtilisables:porteDOffre`),
 * pas une offre qui n'existe plus. Un décor qui a tout donné ne promet rien : il est du décor.
 */
export function actionsAuthorees(ent: SceneEntity, flags: Drapeaux = {}): ActionAuthoree[] {
  return (ent.usable?.actions ?? []).filter((a) => !flags[cleActionJouee(ent.id, a.id)]);
}

/**
 * Les actions offertes par `ent`, dans l'ordre où le joueur les lira : capacités d'instance, actions
 * authorées, puis assise.
 *
 * LIBELLÉ d'une action authorée : celui de l'auteur s'il en a posé un, sinon le catalogue i18n à la
 * clé `usable.<id>` — l'id est de la LOGIQUE, le libellé de l'AFFICHAGE, et aucune chaîne française
 * ne se fige en donnée. Un id hors catalogue rend la clé elle-même (repli de `t`), lisible et non
 * traduite : c'est le signal qu'il manque une entrée au catalogue.
 */
export function actionsDe(scene: Scene, ent: SceneEntity, flags: Drapeaux = {}): ActionOfferte[] {
  const out: ActionOfferte[] = [];
  for (const [id, cap] of Object.entries(CAPACITES))
    if (cap.offerte(ent)) out.push({ id, label: t(cap.label), origine: 'capacite' });
  for (const a of actionsAuthorees(ent, flags))
    out.push({ id: a.id, label: a.label ?? t(`usable.${a.id}` as MsgKey), origine: 'authoree' });
  // ASSISE : l'auteur l'ACTIVE sur l'instance (`usable.assise`) et `placesJouables` porte la
  // géométrie du TYPE — deux faits, deux gardes, aucune ne redit l'autre.
  if (ent.usable?.assise && placesJouables(scene, ent.id).length)
    out.push({ id: 'sasseoir', label: t('usable.sasseoir'), origine: 'assise' });
  return out;
}

/** Une entité APPELLE-t-elle un geste ? SOURCE UNIQUE de l'affordance (curseur main, halo), du choix
 *  de l'entité qu'un clic sur la CASE traite, et de ce que l'éditeur montre à l'auteur — trois
 *  lectures qui mentiraient séparément. Un décor est utilisable parce qu'il OFFRE quelque chose. */
export const estUtilisable = (scene: Scene, ent: SceneEntity, flags: Drapeaux = {}): boolean =>
  actionsDe(scene, ent, flags).length > 0;
