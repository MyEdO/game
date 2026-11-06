/**
 * POSE PAR FRAME des HALOS D'INTERACTION du monde volumique (#1176, P3-0g) — la passe SŒUR de
 * `stage/dynamicMarkPose.ts`, et pour une raison de plus : ces halos ne se contentent pas de suivre le
 * décor, ils PULSENT. Une pulsation ne se pose pas une fois pour toutes : elle est une fonction de la
 * frame — même patron que le vacillement des lampes (`stage/stagePointLights.applyFlicker`, #1245).
 * Les cadences et les amplitudes ci-dessous sont LA source de ces battements ; il n'y en a pas d'autre.
 *
 * CE QUI SE MESURE EN PIXELS D'ÉCRAN — le décalage de l'étincelle, sa montée, l'épaisseur des traits,
 * et l'axe même de son élévation (cf. `poserEtincelle`) : une affordance d'interaction doit rester
 * lisible à toute distance de caméra, là où une taille métrique fondrait avec le décor. C'est l'idiome
 * courant des marques de ce monde volumique (`sceneMeshes.billboardPose`, `boardPose`), pas une
 * convention d'écran subie.
 *
 * PURE : ni DOM ni contexte WebGL — elle ne fait que réécrire les matrices d'instance et l'opacité de
 * matériau de pools déjà montés (`backends/webgl/interactHaloMeshes`), au compte près. CÔTÉ
 * ALLOCATION : matrices, vecteurs, centre de travail sont des singletons de module, et les chapelets de
 * cordes sortent du cache de `ringDashes` (celui des anneaux d'équipe, partagé). Restent par frame le
 * relevé de comptes qu'elle REND, les deux petits objets de `haloPing`/`sparkBob`, et les deux vecteurs
 * que `billboardPose` rend PAR étincelle — la même dépense que la passe des billboards
 * (`boardPose.poseBoards`), quelques dizaines d'octets que la jeune génération ramasse.
 */
import * as THREE from 'three';
import { ISO_PX_PER_M } from '../iso';
import type { ProjKind } from '../../geometry/iso';
import { ringPhaseRad, strokeWidthK } from '../builders/dynamicMarks';
import {
  HALO_HOVER_SCALE,
  HALO_HOVER_STROKE_PX,
  HALO_RX_PX,
  HALO_STROKE_PX,
  PING_STROKE_PX,
  SPARK_DX_PX,
  SPARK_DY_PX,
  SPARK_R_PX,
  haloRadiusK,
  type InteractHalo,
} from '../builders/interactHalos';
import { HALO_SLOT_OPACITY, haloSlotLiftM, type HaloSlot } from '../backends/webgl/interactHaloMeshes';
import { billboardPose } from '../backends/webgl/sceneMeshes';
import { pxPerM } from '../../noyau/monde/volume/worldTris';
import { poserCompteInstances } from '../backends/webgl/instancePools';
import { ringDashes, writeRingChords } from './dynamicMarkPose';

/** Les pools montés, par slot — un slot absent n'est simplement pas peint. */
export type HaloPools = Partial<Record<HaloSlot, THREE.InstancedMesh>>;

/** Comptes d'instances écrites, par slot. */
export type HaloCounts = Record<HaloSlot, number>;

/** Ce que la frame apporte aux halos. */
export interface HaloFrame {
  /** Mètres par case. */
  mpt: number;
  /** Hauteur métrique du sol d'une case (0 au sol, cf. `builders/highlights`). */
  groundM: (x: number, y: number, z: number) => number;
  /** VUE de la caméra — la géométrie ÉCRAN d'un anneau en dépend (cf. `ringDashes`). */
  kind: ProjKind;
  /** Lacet de la CAMÉRA (degrés). Absent = cran zéro. */
  yawDeg?: number;
  /** Orientation de la CAMÉRA : l'étincelle est un quad ALIGNÉ ÉCRAN, et son décalage depuis le décor
   *  se mesure en pixels d'écran (`SPARK_DX_PX` vers la droite). */
  camQuat: THREE.Quaternion;
  /** Horloge de la frame, en SECONDES — la phase des pulsations. Toutes les instances la partagent :
   *  une animation CSS part elle aussi de l'origine du document, donc en phase pour toute la page. */
  tSec: number;
}

// ── CADENCES ET RAMPES ─────────────────────────────────────────────────────────────
// Un motif symétrique (0 % / 50 % / 100 %) à départ et arrivée amortis se lit en SINUSOÏDE :
// `(1 − cos 2πp) / 2` vaut 0 aux bornes, 1 au milieu, et sa dérivée s'annule aux trois.

/** PULSATION du halo au repos : période 1,6 s, opacité 0,35 aux bornes, 0,8 à mi-course. */
export const HALO_PULSE_S = 1.6;
export const HALO_PULSE_MIN = 0.35;
export const HALO_PULSE_MAX = 0.8;
/** PULSATION du halo SURVOLÉ : plus rapide (0,7 s) et plus vive (0,85 → 1). */
export const HALO_HOVER_PULSE_S = 0.7;
export const HALO_HOVER_PULSE_MIN = 0.85;
export const HALO_HOVER_PULSE_MAX = 1;

/** Rampe symétrique d'un `ease-in-out` sur une période : 0 → 1 → 0. */
function rampeSymetrique(p: number): number {
  return (1 - Math.cos(2 * Math.PI * p)) / 2;
}

/** Phase d'une animation de période `periodeS` à l'instant `tSec`, dans `[0, 1[`. */
export function phase(tSec: number, periodeS: number): number {
  const p = (tSec / periodeS) % 1;
  return p < 0 ? p + 1 : p;
}

/** MULTIPLICATEUR d'opacité du halo à l'instant `tSec` — il porte sur le halo ENTIER, et les opacités
 *  de repos de ses deux pools (disque, contour) le multiplient. */
export function haloPulse(tSec: number, survole: boolean): number {
  const min = survole ? HALO_HOVER_PULSE_MIN : HALO_PULSE_MIN;
  const max = survole ? HALO_HOVER_PULSE_MAX : HALO_PULSE_MAX;
  return min + (max - min) * rampeSymetrique(phase(tSec, survole ? HALO_HOVER_PULSE_S : HALO_PULSE_S));
}

/** ONDE « sonar » du décor fouillable : période 1,9 s — de `scale 0,65`/opacité 0,7 à `scale 1,55`/
 *  opacité 0 à 75 % de la période, puis RIEN jusqu'au tour suivant (le dernier quart est invisible). */
export const PING_S = 1.9;
export const PING_SCALE_MIN = 0.65;
export const PING_SCALE_MAX = 1.55;
export const PING_OPACITY_MAX = 0.7;
export const PING_END = 0.75;

/** Onde « sonar » de l'instant : échelle et opacité. La rampe est un `ease-out` — départ rapide,
 *  arrivée amortie — rendu par la quadratique `1 − (1 − u)²`. */
export function haloPing(tSec: number): { scale: number; opacity: number } {
  const p = phase(tSec, PING_S);
  if (p >= PING_END) return { scale: PING_SCALE_MAX, opacity: 0 };
  const u = p / PING_END;
  const e = 1 - (1 - u) * (1 - u);
  return { scale: PING_SCALE_MIN + (PING_SCALE_MAX - PING_SCALE_MIN) * e, opacity: PING_OPACITY_MAX * (1 - e) };
}

/** FLOTTEMENT de l'étincelle : période 1,6 s, montée de 4 px à mi-course, opacité 0,85 → 1. */
export const SPARK_S = 1.6;
export const SPARK_RISE_PX = 4;
export const SPARK_OPACITY_MIN = 0.85;
export const SPARK_OPACITY_MAX = 1;

/** Flottement de l'étincelle à l'instant `tSec` : montée (pixels d'écran) et opacité. */
export function sparkBob(tSec: number): { risePx: number; opacity: number } {
  const r = rampeSymetrique(phase(tSec, SPARK_S));
  return { risePx: SPARK_RISE_PX * r, opacity: SPARK_OPACITY_MIN + (SPARK_OPACITY_MAX - SPARK_OPACITY_MIN) * r };
}

// ── POSE ──────────────────────────────────────────────────────────────────────────────────────────

const M = new THREE.Matrix4();
const P = new THREE.Vector3();
const Q = new THREE.Quaternion();
const S = new THREE.Vector3();
/** Centre du halo en cours — une ancre de travail, jamais conservée. */
const CENTRE = new THREE.Vector3();
/** Axe DROITE de l'écran, dérivé de l'orientation caméra (décalage de l'étincelle). */
const DROITE = new THREE.Vector3();
/** Case et étage du halo en cours — une cellule de travail, réécrite à chaque halo (même idiome que
 *  `dynamicMarkPose.CASE_TRAVAIL` : un littéral par halo et par frame serait de la poussière). */
const CASE_TRAVAIL = { x: 0, y: 0, z: 0 };

/** Y pose la case d'un halo, et la rend. */
function caseDe(x: number, y: number, z: number): { x: number; y: number; z: number } {
  CASE_TRAVAIL.x = x;
  CASE_TRAVAIL.y = y;
  CASE_TRAVAIL.z = z;
  return CASE_TRAVAIL;
}
/** Rotation qui couche le quad HORIZONTAL de `tileQuadGeometry` dans le plan de l'écran, avant que
 *  l'orientation de la caméra ne l'y aligne : le gabarit unité est dans le plan XZ, un quart de tour
 *  autour de X le met dans le plan XY — celui que la caméra regarde de face. */
const REDRESSER = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);

/** Position MONDE du centre d'un halo (même conversion que `dynamicMarkPose.poseCase` :
 *  `(x, y, h) → (x·mpt, h, y·mpt)`), relevée de `liftM`. Un halo POSÉ AU SOL prend le décollement de
 *  son slot — il est coplanaire des marques de case, qu'il doit surmonter sans z-fighter ; l'ÉTINCELLE,
 *  elle, flotte au-dessus du décor et n'a rien à départager : sa hauteur est la sienne. */
function centreDe(x: number, y: number, z: number, liftM: number, f: HaloFrame, out: THREE.Vector3): THREE.Vector3 {
  return out.set(x * f.mpt, f.groundM(Math.round(x), Math.round(y), z) + liftM, y * f.mpt);
}

/** Écrit un ANNEAU de halo (disque plein + contour) dans ses deux pools.
 *  SATURATION ATOMIQUE, comme les anneaux d'équipe : un halo qui ne tient pas n'est pas ENTAMÉ — ni son
 *  chapelet de cordes (un arc isolé se lirait comme une autre marque), NI son disque, qui sans son
 *  contour serait une flaque muette. Le disque ne dépasse donc jamais ce que le contour sait habiller. */
function poserAnneauDeHalo(
  pools: HaloPools,
  slotDisque: HaloSlot,
  slotContour: HaloSlot,
  compte: HaloCounts,
  centre: { x: number; y: number; z: number },
  rK: { x: number; y: number },
  largeurPx: number,
  f: HaloFrame,
): void {
  // DENSITÉ des tirets : le rayon MOYEN — un anneau n'a qu'un chapelet, et sur un cercle
  // (`rK.x === rK.y`, tout décor d'une case) c'est exactement le rayon.
  const tirets = ringDashes((rK.x + rK.y) / 2, null, f.kind);
  const phi0 = ringPhaseRad(f.kind) + ((f.yawDeg ?? 0) * Math.PI) / 180;
  const rMx = rK.x * f.mpt;
  const rMy = rK.y * f.mpt;
  const contour = pools[slotContour];
  if (contour) {
    if (compte[slotContour] + tirets.length > contour.instanceMatrix.count) return;
    centreDe(centre.x, centre.y, centre.z, haloSlotLiftM(slotContour), f, CENTRE);
    compte[slotContour] = writeRingChords(contour, compte[slotContour], CENTRE, rMx, strokeWidthK(largeurPx) * f.mpt, tirets, phi0, undefined, rMy);
  }
  const disque = pools[slotDisque];
  if (disque && compte[slotDisque] < disque.instanceMatrix.count) {
    centreDe(centre.x, centre.y, centre.z, haloSlotLiftM(slotDisque), f, CENTRE);
    Q.identity();
    S.set(2 * rMx, 1, 2 * rMy); // le gabarit unité a un DIAMÈTRE de 1
    disque.setMatrixAt(compte[slotDisque]++, M.compose(CENTRE, Q, S));
  }
}

/** Écrit l'ÉTINCELLE d'un décor fouillable : le glyphe ALIGNÉ ÉCRAN, décalé du centre du décor (droite
 *  `SPARK_DX_PX`, haut `SPARK_DY_PX`, flottement compris).
 *
 *  CE QUI SUIT L'ÉCHELLE DU DÉCOR, ET CE QUI NE LA SUIT PAS : l'échelle porte sur la seule POSITION du
 *  glyphe ; son tracé garde ses 6 px et son flottement ses 4 px, quel que soit le décor — la taille et
 *  la montée en sont INVARIANTES. L'étincelle est un point posé AU-DESSUS du décor, pas une figure
 *  couchée sur son empreinte : elle se décale du PLUS GRAND côté (`h.echelle`), là où le halo, lui,
 *  suit chaque axe.
 *
 *  L'ÉLÉVATION suit le HAUT DE L'ÉCRAN, pas l'axe Y du monde : patron `sceneMeshes.billboardPose`,
 *  celui des billboards de la scène (`boardPose`). Une élévation en Y monde disparaîtrait sous la vue
 *  du dessus, où l'axe Y pointe vers l'œil. */
function poserEtincelle(mesh: THREE.InstancedMesh, n: number, h: InteractHalo, montéePx: number, f: HaloFrame): number {
  if (n >= mesh.instanceMatrix.count) return n;
  const parMetre = pxPerM(f.mpt); // px d'écran par mètre HORIZONTAL
  centreDe(h.centre.x, h.centre.y, h.cell.z, 0, f, CENTRE);
  DROITE.set(1, 0, 0).applyQuaternion(f.camQuat);
  const echelle = Math.max(h.echelle.x, h.echelle.y);
  CENTRE.addScaledVector(DROITE, (SPARK_DX_PX * echelle) / parMetre);
  const hauteurM = (SPARK_DY_PX * echelle + montéePx) / ISO_PX_PER_M; // px d'écran VERTICAUX par mètre
  P.copy(billboardPose(CENTRE, hauteurM, f.camQuat));
  Q.copy(f.camQuat).multiply(REDRESSER);
  const côtéM = (2 * SPARK_R_PX) / parMetre;
  S.set(côtéM, 1, côtéM);
  mesh.setMatrixAt(n++, M.compose(P, Q, S));
  return n;
}

/** Pose l'opacité de matériau d'un pool : son opacité de REPOS, modulée par la pulsation de l'instant.
 *  C'est le canal de la pulsation — une opacité ne voyage pas par instance, et toutes les instances
 *  d'un slot battent de toute façon en phase (cf. `HaloFrame.tSec`). */
function battreOpacite(mesh: THREE.InstancedMesh | undefined, repos: number, pulse: number): void {
  if (mesh) (mesh.material as THREE.MeshBasicMaterial).opacity = repos * pulse;
}

/** Comptes à zéro — un relevé NEUF par frame (la passe rend ce qu'elle a écrit). */
function comptesVierges(): HaloCounts {
  return {
    haloDisque: 0,
    haloContour: 0,
    haloDisqueSurvol: 0,
    haloContourSurvol: 0,
    haloOnde: 0,
    haloEtincelle: 0,
  };
}

/**
 * Re-pose les halos d'interaction dans leurs pools, et fait battre leurs opacités. Rien n'est monté,
 * rien n'est démonté : c'est la passe que la boucle rejoue tant qu'un halo est à l'écran.
 */
export function poseInteractHalos(pools: HaloPools, halos: readonly InteractHalo[], f: HaloFrame): HaloCounts {
  const n = comptesVierges();
  const étincelles = pools.haloEtincelle;
  const ping = haloPing(f.tSec);
  const spark = sparkBob(f.tSec);
  for (const h of halos) {
    // MUET = rien de peint : un utilisable ni survolé ni révélé ne s'annonce pas (#1687).
    if (h.etat === 'muet') continue;
    // Le halo épouse l'EMPREINTE, axe par axe (`InteractHalo.echelle`) : rond sur un décor d'une case,
    // allongé sur une table murale 1×2 — où un rayon isotrope débordait d'une demi-case à travers le
    // mur qu'elle longe.
    const rK = { x: haloRadiusK(HALO_RX_PX) * h.echelle.x, y: haloRadiusK(HALO_RX_PX) * h.echelle.y };
    const centre = caseDe(h.centre.x, h.centre.y, h.cell.z);
    // La variante de SURVOL est le MÊME anneau, agrandi et épaissi : le facteur porte sur le halo
    // entier, donc sur le rayon ET sur le trait.
    if (h.etat === 'survole')
      poserAnneauDeHalo(pools, 'haloDisqueSurvol', 'haloContourSurvol', n, centre, { x: rK.x * HALO_HOVER_SCALE, y: rK.y * HALO_HOVER_SCALE }, HALO_HOVER_STROKE_PX * HALO_HOVER_SCALE, f);
    else poserAnneauDeHalo(pools, 'haloDisque', 'haloContour', n, centre, rK, HALO_STROKE_PX, f);
    // ONDE « SONAR » : le même cercle, à l'échelle de l'instant — trait compris, l'échelle porte sur
    // le halo ENTIER.
    const onde = pools.haloOnde;
    if (onde && ping.opacity > 0) {
      const tirets = ringDashes(((rK.x + rK.y) / 2) * ping.scale, null, f.kind);
      if (n.haloOnde + tirets.length <= onde.instanceMatrix.count) {
        centreDe(centre.x, centre.y, centre.z, haloSlotLiftM('haloOnde'), f, CENTRE);
        n.haloOnde = writeRingChords(
          onde,
          n.haloOnde,
          CENTRE,
          rK.x * ping.scale * f.mpt,
          strokeWidthK(PING_STROKE_PX * ping.scale) * f.mpt,
          tirets,
          ringPhaseRad(f.kind) + ((f.yawDeg ?? 0) * Math.PI) / 180,
          undefined,
          rK.y * ping.scale * f.mpt,
        );
      }
    }
    if (étincelles) n.haloEtincelle = poserEtincelle(étincelles, n.haloEtincelle, h, spark.risePx, f);
  }
  const lent = haloPulse(f.tSec, false);
  const vif = haloPulse(f.tSec, true);
  battreOpacite(pools.haloDisque, HALO_SLOT_OPACITY.haloDisque, lent);
  battreOpacite(pools.haloContour, HALO_SLOT_OPACITY.haloContour, lent);
  battreOpacite(pools.haloDisqueSurvol, HALO_SLOT_OPACITY.haloDisqueSurvol, vif);
  battreOpacite(pools.haloContourSurvol, HALO_SLOT_OPACITY.haloContourSurvol, vif);
  battreOpacite(pools.haloOnde, HALO_SLOT_OPACITY.haloOnde, ping.opacity);
  battreOpacite(pools.haloEtincelle, HALO_SLOT_OPACITY.haloEtincelle, spark.opacity);
  for (const slot of Object.keys(n) as HaloSlot[]) {
    const mesh = pools[slot];
    if (!mesh) continue;
    poserCompteInstances(mesh, n[slot]);
    mesh.instanceMatrix.needsUpdate = true;
  }
  return n;
}
