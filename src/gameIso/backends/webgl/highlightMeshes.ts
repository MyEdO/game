/**
 * BACKEND VOLUMIQUE des SURBRILLANCES de combat (#1176, P3-0c) — le peintre three
 * sur le MÊME builder pur (`builders/highlights`) : un élément sémantique devient un quad PLAT posé au
 * sol du monde. En volume, une case est un CARRÉ — le losange de la voie affine n'était que sa
 * projection.
 *
 * DEUX MOITIÉS, comme `groundAccents.ts` :
 *  - DÉRIVATION PURE (`highlightSlot`, `highlightTint`, `highlightMatrix`, `groupHighlights`) : aucun
 *    contexte GPU requis, testable en node nu ;
 *  - MONTAGE (`buildHighlightMesh`, `writeHighlightInstances`) : un `InstancedMesh` par SLOT, de
 *    CAPACITÉ fixe, dont le contenu se réécrit EN PLACE (`instanceMatrix.array` + `instanceColor`) —
 *    le patron du pool de flaques (`stage/stagePointLights.ts`) et du semis d'averse
 *    (`weatherParticles.writePrecipMatrices`). Une marque qui apparaît n'entraîne aucun démontage.
 *
 * SLOT et non KIND : l'opacité est une propriété de MATÉRIAU (elle ne voyage pas par instance), et
 * trois kinds en portent deux (`team` actif/passif, `zone` fumée/feu, `ring` foule/contour). Le slot est
 * donc le kind DIVISÉ par son opacité — la teinte, elle, reste par instance (`instanceColor`). Les
 * `ring` non-foule sont des CONTOURS : un cadre mince, jamais un quad plein.
 *
 * RANG DE SUPERPOSITION : ces quads sont COPLANAIRES entre eux (deux marques sur la même case, un
 * anneau sur une teinte d'équipe) et se z-fighteraient. Le rang est donc EXPLICITE et métrique, en
 * multiples de `SPECKLE_LIFT_M` (`groundAccents.ts`) — le décollement d'un accent au-dessus de sa
 * nappe. Pas `COPLANAR_BIAS_M` : ce biais-là départage des faces DANS la géométrie fusionnée
 * (`worldTris.ts`), et une marque n'y est pas.
 */
import * as THREE from 'three';
import { strokeWidthK } from '../../builders/dynamicMarks';
import type { HighlightEl } from '../../builders/highlights';
import { tileTint } from '../../teamColors';
import { materiauPlanTransparent } from './worldMaterials';
import { poserCompteInstances } from './instancePools';
import {
  INTENT_TINT,
  RANGE_BAND_TINT,
  RING_ALLY_TINT,
  RING_CROWD_TINT,
  RING_TARGET_TINT,
  RUN_TINT,
  WALK_TINT,
  ZONE_FIRE_TINT,
  ZONE_SMOKE_TINT,
} from '../../highlightTints';
import { SPECKLE_LIFT_M } from './groundAccents';
import { withRenderRank } from './renderRanks';
import type { VerrouDesMots } from '../../../noyau/fabriquesDuNoyau';

/** Un lot de MONTAGE : kind du builder divisé par son opacité de matériau. */
export type HighlightSlot =
  | 'deplacement'
  | 'course'
  | 'intention'
  | 'bandeDePortee'
  | 'equipe'
  | 'equipeActive'
  | 'zoneDeFeu'
  | 'zoneDeFumee'
  | 'anneauDeFoule'
  | 'anneauDeContour';

/** Tous les slots, dans l'ordre de RANG croissant (cf. `SLOT_RANK`). */
export const HIGHLIGHT_SLOTS: readonly HighlightSlot[] = [
  'deplacement',
  'course',
  'equipe',
  'equipeActive',
  'zoneDeFeu',
  'zoneDeFumee',
  'anneauDeFoule',
  'anneauDeContour',
  'bandeDePortee',
  'intention',
];

/** VERROU : un slot, un genre de marque et ses tons ne prennent que des mots du lexique (#3938). */
const verrouDesMarques: VerrouDesMots<HighlightSlot | HighlightEl['kind'] | Extract<HighlightEl, { tone: string }>['tone']> = true;
void verrouDesMarques;

/** Slot d'un élément du builder. */
export function highlightSlot(el: HighlightEl): HighlightSlot {
  switch (el.kind) {
    case 'deplacement':
      return 'deplacement';
    case 'course':
      return 'course';
    case 'intention':
      return 'intention';
    case 'bandeDePortee':
      return 'bandeDePortee';
    case 'equipe':
      return el.active ? 'equipeActive' : 'equipe';
    case 'zone':
      return el.smoke ? 'zoneDeFumee' : 'zoneDeFeu';
    case 'anneau':
      return el.tone === 'foule' ? 'anneauDeFoule' : 'anneauDeContour';
  }
}

/** Opacité de chaque nature de marque de case — la table, tenue au banc de population
 *  (`stage/marques-parite.test.tsx`). */
export const SLOT_OPACITY: Record<HighlightSlot, number> = {
  deplacement: 0.32,
  course: 0.24,
  intention: 0.42, // la portée DEMANDÉE prime visuellement sur les portées permanentes qu'elle recouvre
  bandeDePortee: 0.26,
  equipe: 0.2,
  equipeActive: 0.3,
  zoneDeFeu: 0.35,
  zoneDeFumee: 0.5,
  anneauDeFoule: 0.34,
  anneauDeContour: 0.9,
};

/** Rang de SUPERPOSITION entre marques coplanaires. Il REPRODUIT l'ordre d'ÉMISSION du builder
 *  (`builders/highlights.buildHighlights`) : à case égale, le dernier émis passe au-dessus. Rang
 *  croissant = plus haut, à l'identique.
 *  Chaque slot a son rang PROPRE : deux marques d'un même kind peuvent couvrir la même case (une
 *  zone de fumée et une zone de feu qui se chevauchent), et un rang partagé les z-fighterait. */
export const SLOT_RANK: Record<HighlightSlot, number> = {
  deplacement: 0,
  course: 1,
  equipe: 2,
  equipeActive: 3,
  zoneDeFeu: 4,
  zoneDeFumee: 5,
  anneauDeFoule: 6,
  anneauDeContour: 7,
  bandeDePortee: 8,
  intention: 9,
};

/** Décollement (m) d'un slot au-dessus de la surface qui le porte. */
export function slotLiftM(slot: HighlightSlot): number {
  return (SLOT_RANK[slot] + 1) * SPECKLE_LIFT_M;
}

/** Teinte d'un élément — le catalogue partagé `gameIso/highlightTints`, `team` par l'identité d'équipe. */
export function highlightTint(el: HighlightEl): string {
  switch (el.kind) {
    case 'deplacement':
      return WALK_TINT;
    case 'course':
      return RUN_TINT;
    case 'intention':
      return INTENT_TINT;
    case 'bandeDePortee':
      return RANGE_BAND_TINT[el.tone];
    case 'equipe':
      return tileTint(el.hero, el.active);
    case 'zone':
      return el.smoke ? ZONE_SMOKE_TINT : ZONE_FIRE_TINT;
    case 'anneau':
      return el.tone === 'foule' ? RING_CROWD_TINT : el.tone === 'allie' ? RING_ALLY_TINT : RING_TARGET_TINT;
  }
}

/** Épaisseur du cadre d'un anneau-contour, en fraction de case. */
export const RING_FRAME_K = 0.09;

/** LISERÉ de retrait d'une marque de case PLEINE, en fraction de case et PAR BORD : une plaque ne
 *  couvre pas la frontière de sa case, si bien que deux cases voisines d'une même zone laissent voir
 *  `2 · TILE_INSET_K` de sol entre elles. Le joueur compte donc ses cases DANS sa portée (arbitrage
 *  de la vue tactique, 2026-08-12).
 *
 *  POURQUOI CE LISERÉ EST NÉCESSAIRE ICI — mesuré, pas supposé. Un peintre qui pose UN chemin par
 *  case et les composite SÉPARÉMENT ne le demande pas : au pixel de frontière sa couverture se scinde
 *  entre deux chemins et l'alpha résultant tombe à
 *  `1 − (1 − 0,32·c)(1 − 0,32·(1 − c))` = 0,294 au lieu de 0,32 — la teinte étant plus claire que le
 *  sol, ce déficit se lit comme un CREUX, et une grille apparaît par accident de composition. Un
 *  `InstancedMesh` de quads JOINTIFS rend au contraire un aplat exact : aucun pixel de frontière ne se
 *  creuse. Mesuré au détecteur de coutures du juge (vallée de luminance ≥ 1,5 entre flancs égaux) sur
 *  du sol d'HERBE (quasi-aplat, `siege-enceinte-top-lit.png`), pas de case 48 px, 14,6 frontières par
 *  scanline : 13,52 coutures/scanline sous plaque composée case par case, 0,19 sous plaque volumique
 *  JOINTIVE, 13,16 sous plaque INSETÉE. Et le liseré ne creuse pas de la même profondeur :
 *  `α · (L_teinte − L_sol)`, mesuré 39,8 de médiane sur cette herbe, 24,2 sur un sol de luminance 73 —
 *  contre 1,94 pour la couture accidentelle de la composition case par case.
 *
 *  VALEUR : UN pixel du gabarit affine par bord (`strokeWidthK`, la conversion px → fraction de
 *  case), soit ~2 px de sol entre deux plaques au pas de case de 35,8 px ; la plaque garde 89 % de
 *  son aire. */
export const TILE_INSET_K = strokeWidthK(1);

/** Matrice d'INSTANCE : le carré UNITÉ posé au centre de sa case, à la hauteur métrique de sa surface
 *  plus le décollement de son slot. `(x, y, h) → (x·mpt, h, y·mpt)`, la conversion du monde
 *  (`worldTris.gpToWorld`). */
export function highlightMatrix(el: HighlightEl, mpt: number, m = new THREE.Matrix4()): THREE.Matrix4 {
  return m.compose(
    new THREE.Vector3(el.cell.x * mpt, el.h + slotLiftM(highlightSlot(el)), el.cell.y * mpt),
    new THREE.Quaternion(),
    new THREE.Vector3(mpt, 1, mpt),
  );
}

/** Les éléments par slot — la maille d'un `InstancedMesh`. */
export function groupHighlights(els: readonly HighlightEl[]): Map<HighlightSlot, HighlightEl[]> {
  const out = new Map<HighlightSlot, HighlightEl[]>();
  for (const el of els) {
    const k = highlightSlot(el);
    const lot = out.get(k);
    if (lot) lot.push(el);
    else out.set(k, [el]);
  }
  return out;
}

/** Capacité d'un pool pour `n` marques : puissance de deux, plancher 32 — un pool ne se redimensionne
 *  donc qu'aux paliers, jamais à la marque près. `0` = aucun pool (rien à peindre de ce slot). */
export function slotCapacity(n: number): number {
  if (n <= 0) return 0;
  return Math.max(32, 2 ** Math.ceil(Math.log2(n)));
}

/** Gabarit UNITÉ d'une case PLEINE : un carré horizontal centré sur l'origine (plan XZ), de côté
 *  `1 − 2·inset`. `inset` = retrait par bord, en fraction de case — 0 (le défaut) rend la case
 *  entière, ce qu'exige un gabarit qui n'est PAS une case (le tiret d'un lien de mêlée, la corde d'un
 *  anneau, le quad d'un halo : ils portent leur taille dans leur matrice d'instance). Une MARQUE DE
 *  CASE, elle, se retire de `TILE_INSET_K` pour laisser voir la grille (`buildHighlightMesh`). */
export function tileQuadGeometry(inset = 0): THREE.BufferGeometry {
  const h = 0.5 - inset;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([-h, 0, -h, h, 0, -h, h, 0, h, -h, 0, -h, h, 0, h, -h, 0, h], 3),
  );
  geo.computeVertexNormals();
  return geo;
}

/** Gabarit UNITÉ d'un CONTOUR de case : quatre bandes horizontales formant un cadre de côté 1. `k` =
 *  épaisseur du cadre en fraction de case — un cadre PLUS FIN est le même gabarit, jamais une seconde
 *  géométrie écrite à la main (repère du groupe hors combat, `backends/webgl/dynamicMarkMeshes`). */
export function tileFrameGeometry(k = RING_FRAME_K): THREE.BufferGeometry {
  const o = 0.5;
  const i = o - k;
  const pos: number[] = [];
  const bande = (x0: number, x1: number, z0: number, z1: number) => {
    pos.push(x0, 0, z0, x1, 0, z0, x1, 0, z1, x0, 0, z0, x1, 0, z1, x0, 0, z1);
  };
  bande(-o, o, -o, -i);
  bande(-o, o, i, o);
  bande(-o, -i, -i, i);
  bande(i, o, -i, i);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}

/** Pool d'un slot : géométrie du slot, matériau NON éclairé (une surbrillance est un repère de jeu, pas
 *  une surface du monde — elle ne doit ni s'assombrir la nuit ni recevoir d'ombre) et NON EMBRUMÉ
 *  (`fog: false` : la brume du POV mangerait l'opacité du slot — 71 % à 26 cases dehors, #1176 P3-1c),
 *  à la CAPACITÉ demandée. `instanceColor` est alloué dès la construction : l'écriture qui suit ne fait
 *  que le remplir. Toute marque PLEINE se retire du liseré de grille (`TILE_INSET_K`) ; le contour, lui,
 *  EST déjà un liseré. */
export function buildHighlightMesh(slot: HighlightSlot, capacity: number): THREE.InstancedMesh {
  const geo = slot === 'anneauDeContour' ? tileFrameGeometry() : tileQuadGeometry(TILE_INSET_K);
  const mat = materiauPlanTransparent({
    opacity: SLOT_OPACITY[slot],
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, capacity);
  mesh.name = `marques:${slot}`;
  mesh.frustumCulled = false; // les marques couvrent la carte : la sphère du pool vaudrait la scène
  const blanc = new THREE.Color(1, 1, 1);
  for (let i = 0; i < capacity; i++) mesh.setColorAt(i, blanc);
  poserCompteInstances(mesh, 0);
  // Rang `monde` : ces marques sont POSÉES au sol, sous les pions (registre `renderRanks.ts`).
  return withRenderRank(mesh, 'monde');
}

/** Réécrit EN PLACE le contenu d'un pool : matrices, teintes, et le COMPTE d'instances dessinées. Rien
 *  n'est alloué, rien n'est démonté — c'est la passe que tout changement d'état de combat rejoue.
 *
 *  Renvoie `true` quand le DESSIN a changé — compte, matrice ou teinte d'une instance dessinée. Le
 *  compte écrit ne dirait rien : 0 après effacement est un changement, et un pas qui déplace une
 *  marque garde le même compte. La comparaison se fait contre le tampon déjà en place, sans état
 *  gardé ni allocation : lire les 16 flottants qu'on s'apprête à écrire coûte l'écriture même. Le
 *  tampon d'instances est en SIMPLE précision — la comparaison arrondit (`Math.fround`) la valeur
 *  calculée, sans quoi toute matrice se dirait changée par la seule troncature. */
export function writeHighlightInstances(
  mesh: THREE.InstancedMesh,
  els: readonly HighlightEl[],
  mpt: number,
): boolean {
  const n = Math.min(els.length, mesh.instanceMatrix.count);
  const m = new THREE.Matrix4();
  const c = new THREE.Color();
  const mats = mesh.instanceMatrix.array;
  const cols = mesh.instanceColor?.array ?? null;
  let bouge = mesh.count !== n || (n > 0 && cols === null);
  for (let i = 0; i < n; i++) {
    highlightMatrix(els[i], mpt, m);
    const om = i * 16;
    if (!bouge) for (let k = 0; k < 16; k++) if (mats[om + k] !== Math.fround(m.elements[k])) { bouge = true; break; }
    mesh.setMatrixAt(i, m);
    c.set(highlightTint(els[i]));
    const oc = i * 3;
    if (!bouge && cols && (cols[oc] !== Math.fround(c.r) || cols[oc + 1] !== Math.fround(c.g) || cols[oc + 2] !== Math.fround(c.b))) bouge = true;
    mesh.setColorAt(i, c);
  }
  poserCompteInstances(mesh, n);
  if (!bouge) return false;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return true;
}
