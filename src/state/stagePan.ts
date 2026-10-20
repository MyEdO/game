/**
 * PANORAMIQUE VIVANT de la caméra du stage — le décalage manuel de la vue à l'instant de la FRAME,
 * hors de tout rendu React. Même patron que `state/stageYaw.ts` : le geste le POSE, le rendu le LIT,
 * et l'ENTRÉE DE SCÈNE le remet à zéro (`remettreLAdaptateur` sur `EVT.ARRIVEE_EN_SCENE`, `state/store.ts`, au
 * même site que `resetStageYaw`).
 *
 * Le store garde le décalage COMMIS (`camPan`) : le relâchement du glisser l'écrit en UN `set`
 * ABSOLU (`setCamPan`), le recentrage le remet à zéro (`resetCamPan` : changement d'unité active,
 * touche de recentrage, changement de cran), les sauvegardes le portent, et c'est lui que le clavier
 * connaît. `accorderPan` recale le vivant sur le commis — et lui seul peut le faire reculer : un
 * rendu survenu EN PLEIN glisser (survol, tour d'IA) ne ramène pas la vue à l'endroit qu'on vient de
 * quitter.
 *
 * `accordsPan` COMPTE ces recalages : un geste en vol lit ce compteur pour savoir qu'un recentrage
 * lui est passé dessus, et se re-cale dessus au lieu de le contredire au relâchement.
 */

let pan = { x: 0, y: 0 };
let commis = { x: 0, y: 0 };
let accords = 0;
const subs = new Set<() => void>();

/** Décalage manuel de la frame — ce que `camAt` ajoute au point focal. */
export const getStagePan = (): { x: number; y: number } => pan;

/** Nombre de RECALAGES du vivant sur le commis depuis le chargement (cf. l'en-tête). */
export const accordsPan = (): number => accords;

/** S'abonne aux REMISES À ZÉRO du décalage (recentrage, entrée de scène) — la vue les repeint hors de
 *  tout rendu : elles peuvent tomber en plein glisser, là où aucun rendu React ne vient. */
export function subscribeStagePan(f: () => void): () => void {
  subs.add(f);
  return () => { subs.delete(f); };
}

/** Pose le décalage VIVANT (glisser-caméra) : ABSOLU depuis celui du début de geste, comme `poserYaw`. */
export function poserPan(x: number, y: number): void {
  pan = { x, y };
}

/** Accorde le vivant sur le décalage COMMIS du store — sans effet tant que celui-ci n'a pas bougé.
 *  Aucun avis aux abonnés : ce recalage se lit AU RENDU (`useStageCamera`), et c'est ce rendu-là qui
 *  peint la nouvelle valeur. */
export function accorderPan(p: { x: number; y: number }): void {
  if (p.x === commis.x && p.y === commis.y) return;
  commis = { x: p.x, y: p.y };
  pan = { x: p.x, y: p.y };
  accords++;
}

/** Remet le vivant ET le commis à zéro : entrée de scène, et RECENTRAGE (`resetCamPan`/`rotateCam`,
 *  `state/store.ts`) — qui peut tomber pendant un glisser, donc SANS aucun rendu à venir : les abonnés
 *  sont avisés pour que la vue reparte du centre tout de suite. */
export function resetStagePan(): void {
  pan = { x: 0, y: 0 };
  commis = { x: 0, y: 0 };
  accords++;
  subs.forEach((f) => f());
}
