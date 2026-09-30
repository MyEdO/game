/**
 * ACCENTS DE SOL (touffes d'herbe, mouchetis) en INSTANCES. Le pendant three de `groundAccentsSvg`
 * (`authoring/detailSvg.ts`) :
 * un semis SANS période, ancré au MONDE, qui ne peut donc passer ni par la texture de période
 * (`periodTexture`) ni par la cuisson par face (`faceBake`) — ses emplacements sont uniques au monde.
 *
 * DEUX MOITIÉS, séparées exprès :
 *  - DÉRIVATION PURE (`tileGroundAccents`, `sceneGroundAccents`) : aucune dépendance à three, testable
 *    en node nu. Elle consomme le MÊME cœur d'expansion que les deux autres backends
 *    (`expandRecipe`, seed = identité MONDE `hash32('floor', x, y, z)`) et le MÊME flux de brins
 *    (`seedStream(hash32(seed, 'blades'))`, deux tirages par touffe) — même seed, mêmes emplacements ;
 *  - MONTAGE (`mountGroundAccentLots`) puis REPOSE (`reposeGroundAccents`) : un `THREE.InstancedMesh`
 *    par (type d'accent × couleur), monté une fois par semis ; le dégagement s'y applique par
 *    COMPACTION des instances retenues et la teinte de visibilité par `instanceColor` — ni l'un ni
 *    l'autre ne refait un mesh. Le frustum culling natif de three
 *    reste actif : `InstancedMesh` surcharge `computeBoundingSphere` pour couvrir SES instances, et
 *    `Frustum.intersectsObject` la calcule à la première frame (three 185, `three.core.js:25611`).
 *
 * LECTURE DU 2ᵉ RANG DU FLUX `blades` : le tirage que le SVG étale en penché d'ÉCRAN
 * (`TUFT_LEAN_AMPLITUDE`, sans équivalent dans un monde 3D) se lit ici en ANGLE MONDE `r() * 2π`.
 * Les hauteurs de brin, elles, restent identiques chez les deux peintres.
 */
import * as THREE from 'three';
import { expandRecipe, TUFT_FAN } from '../../detail/expand';
import { hash32, seedStream } from '../../../data/hash';
import type { DetailRecipe } from '../../detail/types';
import { terrainDetail } from '../../../state/terrain';
import type { LectureDArete, Scene } from '../../../state/scene';
import type { Vec3 } from './worldTris';
import type { SceneEl } from '../../builders/types';
import { worldFaces, type KeepEl, type TintAt } from './sceneMeshes';

/** Largeur du HAUT d'un brin, en fraction de sa base : la lame s'affine vers la pointe. */
const TUFT_TIP_K = 0.25;

/** Décollement (m) d'un mouchetis au-dessus de la nappe qui le porte. Il ne peut pas s'appuyer sur le
 *  biais coplanaire du monde (`COPLANAR_BIAS_M` = 1,5 mm, `worldTris.ts`) : ce biais-là départage des
 *  faces DANS la géométrie fusionnée, et un accent n'y est pas. 5 mm = plus de 3 crans de ce biais,
 *  assez pour ne pas z-fighter le losange sans décoller à l'œil. */
export const SPECKLE_LIFT_M = 0.005;

/** Un accent posé : type, couleur de DONNÉE, case dont il prend sa visibilité, pose monde. */
export interface GroundAccent {
  kind: 'tuft' | 'speckle';
  /** Couleur tirée dans la palette de la recette, PAR TUILE (`authoring/detailSvg.ts`). */
  color: string;
  /** Case porteuse : le MONTAGE y prend sa teinte de visibilité, AU CENTRE de la case — un accent est
   *  un objet POSÉ, dont l'instance porte UNE couleur ; le champ continu est la matière du monde cuit,
   *  qui, lui, a des sommets à échantillonner. La dérivation, elle, l'ignore. */
  cell: { x: number; y: number; z: number };
  /** Repère three (m) : pied de la touffe / centre au sol du mouchetis. */
  pos: Vec3;
  /** Hauteur (m) d'une touffe, rayon (m) d'un mouchetis. */
  sizeM: number;
  /** Lacet monde (rad) de la croix d'une touffe ; 0 pour un mouchetis. */
  yaw: number;
}

/** Accents d'UNE tuile de sol : la dérivation pure. `h` = hauteur (m) de la nappe, `cell` = la case
 *  MONDE dont l'identité seede le semis. */
export function tileGroundAccents(
  recipe: DetailRecipe,
  cell: { x: number; y: number; z: number },
  h: number,
  mpt: number,
): GroundAccent[] {
  const seed = hash32('floor', cell.x, cell.y, cell.z);
  // Recette RESTREINTE aux deux sections d'accent : chaque section
  // tire son SOUS-flux (`expandRecipe`), retirer les autres ne décale aucun tirage.
  const e = expandRecipe({ tufts: recipe.tufts, speckle: recipe.speckle, seedScope: recipe.seedScope }, mpt, mpt, seed);
  const at = (u: number, v: number): Vec3 => ({ x: (cell.x - 0.5 + u) * mpt, y: h, z: (cell.y - 0.5 + v) * mpt });
  const tileColor = (colors: string[], part: string) => colors[hash32(seed, part) % colors.length];
  const out: GroundAccent[] = [];
  if (e.tufts.length && recipe.tufts) {
    const r = seedStream(hash32(seed, 'blades'));
    const color = tileColor(recipe.tufts.colors, 'tuftcol');
    for (const t of e.tufts) {
      // Deux tirages par touffe, dans l'ORDRE du flux (cf. contrat sur `groundAccentsSvg`) : hauteur,
      // puis angle monde.
      const hM = t.hM * (0.8 + r() * 0.5);
      const yaw = r() * Math.PI * 2;
      out.push({ kind: 'tuft', color, cell, pos: at(t.u, t.v), sizeM: hM, yaw });
    }
  }
  if (e.speckles.length && recipe.speckle) {
    const color = tileColor(recipe.speckle.colors, 'dotcol');
    for (const s of e.speckles) out.push({ kind: 'speckle', color, cell, pos: at(s.u, s.v), sizeM: s.rM, yaw: 0 });
  }
  return out;
}

/** Accent SEMÉ SUR LA SCÈNE : l'accent, plus la nappe dont il vient. C'est cette identité que la loi de
 *  dégagement (`KeepEl`) interroge — un accent est une touffe POSÉE SUR une face, il part avec elle. */
export interface SceneGroundAccent extends GroundAccent {
  el: SceneEl;
}

/** Accents de toute la scène : les faces de TERRAIN NU (`domain === 'terrain'` sans `part` — la même
 *  porte) portant une recette d'accent, chacune semée à
 *  l'identité de SA case. INVARIANT à la visibilité ET au dégagement, comme le bake du monde
 *  (`bakeWorldGeometry`) : le semis coûte 12,1 ms sur l'arène (mesuré #1176) et ne se rejoue qu'à la
 *  scène ou à l'échelle — c'est la REPOSE (`reposeGroundAccents`) qui en retire ce que le dégagement
 *  emporte, sans jamais toucher au semis. */
export function sceneGroundAccents(scene: Scene, mpt: number, lecture: LectureDArete): SceneGroundAccent[] {
  const out: SceneGroundAccent[] = [];
  for (const wf of worldFaces(scene, lecture)) {
    const m = wf.face.material;
    if (m.domain !== 'terrain' || m.part) continue;
    const recipe = terrainDetail(m.id);
    if (!recipe) continue;
    for (const a of tileGroundAccents(recipe, wf.cell, wf.face.poly[0].h, mpt)) out.push({ ...a, el: wf.el });
  }
  return out;
}

/** Compte d'instances par type — le budget de la scène, mesurable sans monter un seul mesh. */
export function accentCounts(accents: readonly GroundAccent[]): { tufts: number; speckles: number; total: number } {
  let tufts = 0;
  for (const a of accents) if (a.kind === 'tuft') tufts++;
  return { tufts, speckles: accents.length - tufts, total: accents.length };
}

/** Regroupement de MONTAGE : un lot par (type d'accent × couleur de donnée) — la maille d'un
 *  `InstancedMesh`. La teinte de visibilité ne rentre PAS dans la clé : elle varie par case et voyage
 *  en `instanceColor`. */
export function groupAccents<A extends GroundAccent>(accents: readonly A[]): Map<string, A[]> {
  const out = new Map<string, A[]>();
  for (const a of accents) {
    const k = `${a.kind}|${a.color}`;
    const lot = out.get(k);
    if (lot) lot.push(a);
    else out.set(k, [a]);
  }
  return out;
}

/** Gabarit UNITÉ d'une touffe : DEUX lames trapézoïdales CROISÉES (plans XY et ZY), base de largeur 1
 *  centrée sur l'origine, hauteur 1 vers le haut — l'instance porte l'échelle et le lacet. */
export function tuftGeometry(): THREE.BufferGeometry {
  const b = 0.5;
  const t = (TUFT_TIP_K * 1) / 2;
  const lame = (axe: 'x' | 'z'): number[] => {
    const p = (s: number, y: number): [number, number, number] => (axe === 'x' ? [s, y, 0] : [0, y, s]);
    const [bl, br, tr, tl] = [p(-b, 0), p(b, 0), p(t, 1), p(-t, 1)];
    return [...bl, ...br, ...tr, ...bl, ...tr, ...tl];
  };
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([...lame('x'), ...lame('z')], 3));
  geo.computeVertexNormals();
  return geo;
}

/** Gabarit UNITÉ d'un mouchetis : un quad HORIZONTAL de côté 1 centré sur l'origine (plan XZ). */
export function speckleGeometry(): THREE.BufferGeometry {
  const h = 0.5;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([-h, 0, -h, h, 0, -h, h, 0, h, -h, 0, -h, h, 0, h, -h, 0, h], 3),
  );
  geo.computeVertexNormals();
  return geo;
}

/** Matrice d'INSTANCE d'un accent : échelle (largeur dérivée de la hauteur pour une touffe, diamètre
 *  pour un mouchetis), lacet, translation à sa pose monde (le mouchetis décollé de `SPECKLE_LIFT_M`). */
export function accentMatrix(a: GroundAccent, m = new THREE.Matrix4()): THREE.Matrix4 {
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a.yaw);
  if (a.kind === 'tuft') {
    const w = 2 * TUFT_FAN * a.sizeM;
    return m.compose(new THREE.Vector3(a.pos.x, a.pos.y, a.pos.z), q, new THREE.Vector3(w, a.sizeM, w));
  }
  const d = 2 * a.sizeM;
  return m.compose(new THREE.Vector3(a.pos.x, a.pos.y + SPECKLE_LIFT_M, a.pos.z), q, new THREE.Vector3(d, 1, d));
}

/** Un LOT monté : le `InstancedMesh` d'un (type × couleur), le semis qu'il porte, et l'état de la
 *  dernière REPOSE. C'est par cet état que la repose sait ne RIEN réécrire quand le verdict n'a pas
 *  bougé — un franchissement de cran passe une référence de `KeepEl` neuve pour un verdict identique. */
export interface GroundAccentLot {
  readonly mesh: THREE.InstancedMesh;
  /** Le semis de ce lot, dans l'ordre de sa capacité — l'index d'un accent y est son RANG. */
  readonly accents: readonly SceneGroundAccent[];
  /** Rangs écrits en tête du mesh à la dernière repose de dégagement (`mesh.count` en est la taille). */
  retenus: number[];
  /** Teinte appliquée aux instances retenues ; `null` tant qu'aucune repose n'est passée. */
  teinte: TintAt | null;
}

/** MONTAGE du semis : un `InstancedMesh` par lot (type × couleur), à la CAPACITÉ du lot — géométrie et
 *  matériau créés ici et ici seulement, libérés au seul démontage du semis. Aucune instance n'est
 *  montrée avant la première repose : elle seule connaît le dégagement et la teinte.
 *  `lit` choisit le matériau, exactement comme les faces du monde. */
export function mountGroundAccentLots(
  accents: readonly SceneGroundAccent[],
  opts: { lit: boolean },
): GroundAccentLot[] {
  const out: GroundAccentLot[] = [];
  for (const [key, lot] of groupAccents(accents)) {
    const kind = lot[0].kind;
    const geo = kind === 'tuft' ? tuftGeometry() : speckleGeometry();
    // Une lame croisée se voit des deux côtés (`DoubleSide`), comme toute face du monde volumique.
    const mat = opts.lit
      ? new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, flatShading: true })
      : new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const mesh = new THREE.InstancedMesh(geo, mat, lot.length);
    mesh.name = key;
    mesh.count = 0;
    out.push({ mesh, accents: lot, retenus: [], teinte: null });
  }
  return out;
}

/** Tampon de travail des rangs retenus, réutilisé d'une repose à l'autre : une repose qui ne change
 *  rien n'alloue rien non plus. */
const rangsRetenus: number[] = [];
const matriceDeRepose = new THREE.Matrix4();
const couleurDeRepose = new THREE.Color();

/**
 * REPOSE d'un semis déjà monté — la seule passe qu'un dégagement ou une teinte déclenche.
 *
 * DÉGAGEMENT : la MÊME loi que le masque du monde (`applyCutawayMask`), sur la même identité
 * d'élément — un accent est une touffe POSÉE SUR une face, il part avec elle. Appliquée par
 * COMPACTION : les retenus sont réécrits en tête, `count` les borne. Aucune géométrie, aucun
 * matériau touché, donc aucun relink de shader (#1376).
 * TEINTE : `instanceColor` sur les retenus, rien d'autre.
 *
 * Rend ce qui a RÉELLEMENT été écrit : un verdict inchangé et une teinte inchangée ne valent ni image
 * ni carte d'ombre.
 */
export function reposeGroundAccents(
  lots: readonly GroundAccentLot[],
  keepEl: KeepEl,
  tintAt: TintAt,
): { dégagement: boolean; teinte: boolean } {
  let dégagement = false;
  let teinte = false;
  for (const lot of lots) {
    rangsRetenus.length = 0;
    for (let i = 0; i < lot.accents.length; i++) if (keepEl(lot.accents[i].el)) rangsRetenus.push(i);
    const bouge =
      rangsRetenus.length !== lot.retenus.length || rangsRetenus.some((r, i) => r !== lot.retenus[i]);
    const { mesh } = lot;
    if (bouge) {
      for (let i = 0; i < rangsRetenus.length; i++)
        mesh.setMatrixAt(i, accentMatrix(lot.accents[rangsRetenus[i]], matriceDeRepose));
      mesh.count = rangsRetenus.length;
      mesh.instanceMatrix.needsUpdate = true;
      // La sphère de culling couvre les instances ÉCRITES : elle se réinvalide avec elles. three ne la
      // recalcule QUE si elle est nulle (`Frustum.intersectsObject`), et `setMatrixAt` ne l'invalide
      // pas — sans ce geste, le lot entier sort du frustum, écran ET carte d'ombre (#1376).
      mesh.boundingSphere = null;
      lot.retenus = rangsRetenus.slice();
      dégagement = true;
    }
    if (!bouge && lot.teinte === tintAt) continue;
    for (let i = 0; i < lot.retenus.length; i++) {
      const a = lot.accents[lot.retenus[i]];
      mesh.setColorAt(i, couleurDeRepose.set(a.color).multiplyScalar(tintAt(a.cell.x, a.cell.y, a.cell.z)));
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    lot.teinte = tintAt;
    teinte = true;
  }
  return { dégagement, teinte };
}
