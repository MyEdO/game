/**
 * LACET CONTINU de la caméra du stage (#1176, P2-7) — l'écart, en degrés, entre le lacet RÉELLEMENT
 * regardé et le cran de la vue (`camRot`/`camEdge`). Le monde est une caméra réelle, qui accepte
 * n'importe quel angle (`affineCamera(kind, yawDeg, …)`) et dont les overlays SVG se re-projettent
 * élément par élément (`Dims.yawDeg` → `tileCenter`).
 *
 * Hors du store Zustand : `snapshotSave` sérialise TOUTE clé de données de l'état initial, et un angle
 * de vue vivant n'a rien à faire dans une sauvegarde. Même patron que `state/viewLevel.ts` — le clavier
 * le PILOTE, le rendu le LIT.
 *
 * PULLÉ, JAMAIS POUSSÉ (#1403) : ce module n'a AUCUNE horloge. Il expose son avancement
 * (`avancerLacet(now)`) et son régime (`lacetActif()`) ; c'est le battement unique du stage
 * (`gameIso/stage/stageFrames`, tenu par l'hôte tant que `lacetActif`) qui l'appelle à l'image, et les
 * consommateurs par-frame relisent `getStageYaw()` là. Ses ABONNÉS, eux, ne sont avisés qu'au DISCRET
 * — franchissement de cran, changement de régime, pose/remise à zéro : un avis par image, c'est un
 * commit React par image.
 *
 * TROIS RÉGIMES, une seule avance (`mode`) :
 *  - `repos` : rien ne tourne, l'avance est un no-op. Le lacet reste OÙ IL EST — aucun angle n'est
 *    privilégié, il n'y a pas de ré-aimantage.
 *  - `approche` : le PAS FIN. `cible` est là où le joueur veut regarder, `courant` est là où la caméra
 *    EST, et il y court (exponentielle `TAU_MS`) — le pas glisse au lieu de sauter.
 *  - `libre` : le MAINTIEN. `courant` s'intègre à `VITESSE_LACET_DEG_S`, sans cible et sans plafond :
 *    la caméra tourne tant que le geste dure, et s'arrête net à sa fin.
 */
import type { Rot } from '../geometry/iso';

/** Constante de temps de l'approche (ms) : le lacet courant couvre ~63 % de son retard à chaque `TAU`. */
const TAU_MS = 90;

/** Retard MAXIMAL toléré entre la cible et le lacet courant (degrés), cf. `yawTarget`. */
const AVANCE_MAX_DEG = 90;

/** Écart en deçà duquel la caméra est ARRIVÉE (degrés) : sous le dixième de degré, plus aucun pixel
 *  d'overlay ne bouge — continuer à animer ne ferait que rendre pour rien. */
const ARRIVE_DEG = 0.05;

/** PAS FIN d'un appui bref (degrés) : le geste de visée précise. Le besoin « tourner vite » est servi
 *  par le MAINTIEN (`demarrerLacet`), jamais par un pas plus gros ni par une accélération du pas. */
export const PAS_TAP_DEG = 2;

/** Vitesse du lacet MAINTENU (degrés par seconde) : un tour complet en ~3,6 s. */
export const VITESSE_LACET_DEG_S = 100;

/** Durée d'appui (ms) au-delà de laquelle l'appui devient un MAINTIEN (les entrées arment ce délai
 *  après le pas fin de l'enfoncement). */
export const SEUIL_MAINTIEN_MS = 250;

/** Degrés de lacet par pixel de glissement du pointeur (bouton milieu). */
export const SENSIBILITE_DRAG_DEG_PX = 0.35;

/** Durée maximale intégrée en une frame de MAINTIEN (ms). Un onglet caché suspend
 *  `requestAnimationFrame` : au retour, `dt` vaut la durée entière de l'absence, et l'intégrer
 *  entièrement ferait faire à la caméra les tours qu'on n'a pas vus. */
const DT_MAX_MS = 100;

/** Régime courant du lacet — cf. l'en-tête de fichier. */
type ModeLacet = 'repos' | 'libre' | 'approche';

let cible = 0;
let courant = 0;
let mode: ModeLacet = 'repos';
let sens: 1 | -1 = 1;
let dernier = 0;
const subs = new Set<() => void>();

/** QUART DE TOUR d'un lacet — la composante DISCRÈTE que ce module possède (le cran de départ,
 *  `camRot`, est au store) : c'est son changement qui fait un avis (cf. `viewRot`/`rotAtYaw`). */
const cranDe = (deg: number): number => Math.round(deg / 90);

/** Ce que les abonnés ont DÉJÀ appris : sans quoi « au franchissement » se relirait à chaque image. */
let cranAnnonce = 0;
let modeAnnonce: ModeLacet = 'repos';

/** Lacet courant (degrés) à ajouter au cran de la vue. */
export const getStageYaw = (): number => courant;

/** LACET DE VUE à poser sur un `Dims` cranté (`Dims.yawDeg`) : le cran de la caméra plus l'écart
 *  continu.
 *
 *  SOURCE UNIQUE de cette composition, et ce n'est pas un confort : TOUT ce qui traduit un geste
 *  ÉCRAN en case (le pas clavier d'exploration, le curseur de combat, la sonde de recette) doit voir
 *  le MÊME lacet que le peintre. Un seul de ces chemins resté au cran, et la direction qu'on pousse
 *  cesse d'être celle qu'on regarde. */
export function viewYawDeg(camRot: number, camEdge: boolean): number {
  return camRot * 90 + (camEdge ? 45 : 0) + courant;
}

/** CRAN de vue atteint par un lacet : le cran de départ plus les quarts de tour PARCOURUS (arrondi au
 *  quart le plus proche). PUR — c'est la forme qui se mesure. */
export function rotAtYaw(camRot: number, yawOffsetDeg: number): Rot {
  return ((((camRot + Math.round(yawOffsetDeg / 90)) % 4) + 4) % 4) as Rot;
}

/** CRAN EFFECTIF de la vue : celui que le lacet RÉEL regarde.
 *
 *  Ce que le cran décide reste DISCRET — la géométrie de dégagement (quelle façade est frontale,
 *  quelle nappe coiffe le groupe) et les couches pré-triées, dont les memos ne doivent pas se rejouer
 *  soixante fois par seconde. Sous lacet libre, ce cran ne peut plus être celui du store :
 *  après un demi-tour, `camRot` vaut toujours 0 et la façade tombée serait celle du départ. Il change
 *  au FRANCHISSEMENT d'un quart, et lui seul y fait rejouer ces memos. */
export function viewRot(camRot: number): Rot {
  return rotAtYaw(camRot, courant);
}

export function subscribeStageYaw(f: () => void): () => void {
  subs.add(f);
  return () => { subs.delete(f); };
}

/** UN pas d'approche exponentielle, indépendant de la cadence de frame (PUR — c'est lui qui se mesure :
 *  la même durée de rotation sur une machine à 30 Hz et sur une à 144 Hz). */
export function yawStep(courantDeg: number, cibleDeg: number, dtMs: number): number {
  if (Math.abs(cibleDeg - courantDeg) <= ARRIVE_DEG) return cibleDeg;
  return courantDeg + (cibleDeg - courantDeg) * (1 - Math.exp(-Math.max(0, dtMs) / TAU_MS));
}

/** Nouvelle CIBLE après une poussée de `deltaDeg`, avance bornée à `AVANCE_MAX_DEG`. Ce plafond ne
 *  concerne QUE la poussée fine (`pasYaw`, `nudgeStageYaw`), qui vise un angle et l'atteint : il borne
 *  le retard que des poussées répétées peuvent empiler devant la caméra. Le lacet MAINTENU
 *  (`demarrerLacet`) ne passe pas par ici et n'a aucun plafond — il tourne autant que le geste dure.
 *  PUR. */
export function yawTarget(courantDeg: number, cibleDeg: number, deltaDeg: number): number {
  const avance = cibleDeg + deltaDeg - courantDeg;
  return courantDeg + Math.max(-AVANCE_MAX_DEG, Math.min(AVANCE_MAX_DEG, avance));
}

/** Avis INCONDITIONNEL, et re-calage de ce qui a été annoncé : la pose et la remise à zéro sont des
 *  événements en elles-mêmes. */
function notifier(): void {
  cranAnnonce = cranDe(courant);
  modeAnnonce = mode;
  subs.forEach((f) => f());
}

/** Avis au DISCRET seul — le franchissement d'un cran ou le changement de régime. Entre les deux, le
 *  lacet avance sans rien annoncer : ses lecteurs par-frame le relisent à l'image (`getStageYaw`). */
function notifierSiDiscret(): void {
  if (cranDe(courant) === cranAnnonce && mode === modeAnnonce) return;
  notifier();
}

/** UNE avance, quel que soit le régime, à l'horodatage de l'image qui l'appelle. Le mode décide ce qui
 *  avance ; `repos` ne fait rien (l'hôte relâche alors ses images, cf. `lacetActif`). */
export function avancerLacet(now: number): void {
  if (mode === 'repos') return;
  const dt = dernier ? now - dernier : 16;
  dernier = now;
  if (mode === 'libre') {
    courant += sens * VITESSE_LACET_DEG_S * (Math.min(Math.max(0, dt), DT_MAX_MS) / 1000);
  } else if (mode === 'approche') {
    courant = yawStep(courant, cible, dt);
    if (courant === cible) mode = 'repos';
  }
  notifierSiDiscret();
}

/** Le lacet est-il EN RÉGIME ? C'est à cette question que l'hôte tient (ou relâche) ses images. */
export function lacetActif(): boolean {
  return mode !== 'repos';
}

/** Passe au régime `m` : l'avance repart de l'image suivante, et l'avis de régime est ce qui fait tenir
 *  le battement à l'hôte. */
function relancer(m: 'libre' | 'approche'): void {
  const enVol = mode !== 'repos';
  mode = m;
  if (!enVol) dernier = 0;
  notifierSiDiscret();
}

/** Pose la CIBLE et lance (ou relance) l'approche — le geste commun aux deux poussées fines. */
function courirVers(nouvelleCible: number): void {
  cible = nouvelleCible;
  if (typeof requestAnimationFrame !== 'function') { // hors navigateur : le lacet arrive tout de suite
    courant = cible;
    mode = 'repos';
    notifier();
    return;
  }
  relancer('approche');
}

/** Pousse le lacet de `deltaDeg` et lance (ou relance) l'approche. Vise un angle LIBRE : la caméra
 *  d'inspection (DEV), qui atteint les vues de face comme n'importe quel angle intermédiaire. */
export function nudgeStageYaw(deltaDeg: number): void {
  courirVers(yawTarget(courant, cible, deltaDeg));
}

/** PAS FIN du joueur (appui bref sur Q/E, sur un bouton d'orientation) : `PAS_TAP_DEG` dans le sens
 *  poussé, en glissant. Aucun aimant : deux pas font exactement deux pas. */
export function pasYaw(dir: 1 | -1): void {
  courirVers(yawTarget(courant, cible, dir * PAS_TAP_DEG));
}

/** Démarre le lacet MAINTENU dans le sens `dir` — il tourne jusqu'à `arreterLacet`.
 *  Hors navigateur, aucune horloge de frames n'existe : le maintien ne peut pas s'intégrer (les
 *  mesures du maintien fournissent leur harnais de frames). */
export function demarrerLacet(dir: 1 | -1): void {
  sens = dir;
  if (typeof requestAnimationFrame !== 'function') return;
  relancer('libre');
}

/** Arrête le lacet maintenu. L'angle reste TEL QUEL — aucun cran ne le rattrape. */
export function arreterLacet(): void {
  if (mode !== 'libre') return;
  cible = courant;
  mode = 'repos';
  notifierSiDiscret();
}

/** Pose le lacet à `deg` SANS animation : le glisser-tourner du pointeur, qui suit le doigt image par
 *  image et n'a donc rien à rattraper. */
export function poserYaw(deg: number): void {
  cible = deg;
  courant = deg;
  mode = 'repos';
  notifier();
}

/** Remet le lacet à son ANGLE INITIAL (0 = le cran diagonal d'ouverture). Une couture l'appelle :
 *  l'ENTRÉE DE SCÈNE (`remettreLAdaptateur` sur `EVT.ARRIVEE_EN_SCENE`, `state/store.ts` — une nouvelle carte se regarde
 *  depuis son cran). Les tests s'en servent pour repartir de cet angle. */
export function resetStageYaw(): void {
  cible = 0;
  courant = 0;
  mode = 'repos';
  notifier();
}
