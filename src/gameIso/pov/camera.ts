/**
 * POV — noyau MATHÉMATIQUE PUR d'une caméra première personne (dungeon-crawler pas-à-pas, yaw = Dir8).
 * Zéro React/store/effet : ne connaît que des mètres (monde), des cases (grille) et des pixels (viewport
 * SVG). Le rendu (polygones) et l'assemblage de scène vivent ailleurs (geometry.ts + couche React).
 *
 * Convention MONDE (partagée avec la grille) : +x = est, +y = sud, +z = HAUT (mètres). Une tuile (x,y)
 * a son CENTRE au point métrique (x·mpt, y·mpt) ; sa surface est à `heightAt(scene,x,y,z)` mètres.
 * Repère CAMÉRA : `fwd` (avant, vers l'écran) et `right` (tribord) sont des vecteurs SOL unitaires en
 * unités de GRILLE ; l'axe vertical monde `z` sert d'axe « haut » écran.
 */
import type { View } from '../rig/facing';
import { WALL_H_M } from '../iso';
import { mix, parseHex } from '../shade';
import { heightAt, sceneMetresPerTile, type Scene } from '../../state/scene';
import { DIR8_DELTA, type Dir8 } from '../../state/dir8';
import { AMBIANCE } from '../catalog/ambiance';

// — Constantes de caméra/projection — (hauteur de cloison : `WALL_H_M`, vérité partagée dans iso.ts)
/** Hauteur de l'œil au-dessus de la surface où se tient le groupe (mètres). */
export const EYE_H = 1.7;
/** Hauteur de l'œil au-dessus de l'ASSISE d'un corps ASSIS (mètres) : le tronc, le cou et la tête
 *  restent, les jambes se replient — ce qui reste au-dessus du siège, et non au-dessus du sol. */
export const EYE_H_ASSIS = 0.75;
/** Champ de vision horizontal (radians ≈ 75°). */
export const FOV_X = (75 * Math.PI) / 180;
/** Plan proche (mètres) — tout ce qui est plus près/derrière est clippé. > 0. */
export const NEAR = 0.1;
/** Viewport SVG (px). */
export const VW = 1000;
export const VH = 700;
/** Distance focale px : demi-largeur ÷ tan(demi-FOV) → `fx = fy` (pixels carrés). */
export const fx = VW / 2 / Math.tan(FOV_X / 2);
export const fy = fx;

// — Profondeur / brume : tout vient de la DONNÉE (`ambiance.json`, AMBIANCE.pov.depth) —
/** Courbe de brume : claire avant `start` (cases), opaque à `end` (= portée max de rendu),
 *  progression smoothstep^gamma (gamma > 1 = silhouettes lisibles plus loin). */
export interface FogCurve { start: number; end: number; gamma: number }
const DEPTH = AMBIANCE.pov.depth;
/** Courbe de brume du milieu : intérieur = brume sombre COURTE, extérieur = perspective LONGUE. */
export function fogCurveOf(indoor: boolean): FogCurve {
  const d = indoor ? DEPTH.indoor : DEPTH.outdoor;
  return { start: d.fogStartT, end: d.farTiles, gamma: d.fogGamma };
}
/** Portée maximale de rendu (cases) du milieu — la brume atteint 1 exactement là (coupure invisible). */
export function farTilesOf(indoor: boolean): number {
  return (indoor ? DEPTH.indoor : DEPTH.outdoor).farTiles;
}
/**
 * PROFONDEUR de la première personne, RESSERRÉE (#1247) : la courbe de brume ET la portée de rendu du
 * milieu, sorties d'un SEUL calcul. `tightenK` (part de la portée, `brume.povTightenK` en donnée) les
 * multiplie toutes deux — début de voile compris, sinon la brume mangerait la vue de près.
 *
 * UNE fonction pour les DEUX consommateurs, et c'est le fait qui la justifie : la courbe alimente le
 * `THREE.Fog` des surfaces (`povFog`) et `end` alimente le plan LOINTAIN de la caméra
 * (`stage/GameStage3D.tsx`). Resserrer un seul des deux donne soit une brume saturée bien avant la
 * coupure (portée intacte), soit une arête FRANCHE au bout du monde (caméra seule resserrée).
 *
 * `tightenK` absent ou 1 : la courbe du milieu, à l'identique. PUR.
 *
 * PÉRIMÈTRE MESURÉ : la voie POV SVG lit la portée SANS passer par ici — `farTilesOf`/`fogCurveOf`
 * directement (`backends/webgl/billboardMath.ts`, `backends/webgl/cameras.ts`). Sans effet
 * aujourd'hui : la météo n'a d'expression qu'à la voie VOLUMIQUE (le voile d'écran de l'affine ne
 * touche pas la profondeur). Qui brancherait la météo sur le SVG passerait par ici, ou aurait deux
 * portées.
 */
export function povDepth(indoor: boolean, tightenK?: number): { curve: FogCurve; farTiles: number } {
  const base = fogCurveOf(indoor);
  const k = tightenK === undefined ? 1 : Math.min(1, Math.max(0, tightenK));
  const curve: FogCurve = { start: base.start * k, end: base.end * k, gamma: base.gamma };
  return { curve, farTiles: curve.end };
}
/** Brume de distance INTÉRIEURE (sombre) — identité en DONNÉE (`ambiance.json`), partagée avec l'iso. */
export const FOG_COLOR = AMBIANCE.pov.fogIndoor;
/** Luminosité plancher (une surface éclairée à 0 n'est jamais totalement noire) — DONNÉE partagée
 *  (`ambiance.json`), même plancher pour le POV et le voile d'occlusion des sols iso. */
export const AMBIENT_FLOOR = AMBIANCE.ambientFloor;

// — Types —
/** Point métrique monde. */
export type Vec3 = { x: number; y: number; z: number };
/** Pose de caméra : œil (mètres), `fwd`/`right` unitaires SOL (unités grille), `mpt` m/case, `z` = couche. */
export type CamPose = {
  eye: Vec3;
  fwd: { x: number; y: number };
  right: { x: number; y: number };
  mpt: number;
  z: number;
};

/** Cote de SOL sous une position CONTINUE (mètres). `heightAt` indexe un tableau de CASES : une
 *  position fractionnaire n'y répond rien, et l'arrondir ferait sauter la cote d'un cran entier au
 *  milieu d'un pas (un ressaut franchissable vaut jusqu'à `STEP_MAX_M` = 1 m). Les quatre cases qui
 *  entourent la position sont donc interpolées bilinéairement : à une position ENTIÈRE le résultat
 *  est exactement `heightAt` de la case, entre deux il suit la pente. Hors grille, l'échantillon est
 *  pris à la case de BORD (jamais le 0 de `heightAt` hors bornes, qui creuserait le sol au bord d'une
 *  carte surélevée). PUR. */
export function groundUnderM(scene: Scene, x: number, y: number, z: number): number {
  const { w, h } = scene.dimensions;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = x - x0;
  const ty = y - y0;
  const cx = (i: number): number => (i < 0 ? 0 : i > w - 1 ? w - 1 : i);
  const cy = (j: number): number => (j < 0 ? 0 : j > h - 1 ? h - 1 : j);
  const h00 = heightAt(scene, cx(x0), cy(y0), z);
  const h10 = heightAt(scene, cx(x0 + 1), cy(y0), z);
  const h01 = heightAt(scene, cx(x0), cy(y0 + 1), z);
  const h11 = heightAt(scene, cx(x0 + 1), cy(y0 + 1), z);
  return (h00 * (1 - tx) + h10 * tx) * (1 - ty) + (h01 * (1 - tx) + h11 * tx) * ty;
}

/** REPÈRE SOL d'un cap Dir8, en unités de GRILLE : `fwd` = son delta unitaire (diagonale ÷ √2),
 *  `right` = (−fwd.y, fwd.x) — cap N (0,−1) → right (1,0) = est. PUR, et SOURCE UNIQUE de cette
 *  dérivation : la caméra première personne s'en bâtit, et la vue d'entité en perspective des
 *  billboards du monde volumique s'y branche (`billboardView`, #1176). */
export function dir8Basis(facing: Dir8): { fwd: { x: number; y: number }; right: { x: number; y: number } } {
  const d = DIR8_DELTA[facing];
  const len = Math.hypot(d.gx, d.gy) || 1; // diagonale → √2 ; cardinale → 1
  const fwd = { x: d.gx / len, y: d.gy / len };
  return { fwd, right: { x: -fwd.y, y: fwd.x } };
}

/** Construit la pose de caméra depuis la scène, la position du groupe et son cap Dir8. PUR.
 *  eye.z = sol sous le groupe + `EYE_H` ; `fwd`/`right` = le repère du cap (`dir8Basis`).
 *  `mpt` = échelle métrique de la case.
 *  `partyPos` peut être CONTINU (la marche volumique fait glisser l'œil, #1176) : la hauteur de
 *  l'œil suit alors la pente CONTINUE du sol (`groundUnderM`) : à mi-pas d'un ressaut, l'œil est à
 *  mi-hauteur du ressaut, et sa montée s'étale sur toutes les frames du pas. */
export function makeCamera(scene: Scene, partyPos: { x: number; y: number; z?: number }, facing: Dir8, eyeH: number = EYE_H): CamPose {
  const mpt = sceneMetresPerTile(scene);
  const z = partyPos.z ?? 0;
  const { fwd, right } = dir8Basis(facing);
  const eye: Vec3 = {
    x: partyPos.x * mpt,
    y: partyPos.y * mpt,
    z: groundUnderM(scene, partyPos.x, partyPos.y, z) + eyeH,
  };
  return { eye, fwd, right, mpt, z };
}

/** Hauteur d'œil AU-DESSUS DU SOL d'un corps ASSIS à cette place — ce que `makeCamera` attend. Dérivée
 *  de l'ancre de la place (hauteur d'assise ABSOLUE) et de la seule constante nommée `EYE_H_ASSIS` :
 *  un tabouret bas et un banc haut ne donnent pas le même regard, et aucun nombre magique ne s'y glisse. */
export function seatedEyeH(scene: Scene, seat: { anchor: { x: number; y: number; h: number } }, z = 0): number {
  return seat.anchor.h - groundUnderM(scene, seat.anchor.x, seat.anchor.y, z) + EYE_H_ASSIS;
}

/** Projette un point monde `P` (mètres) en pixels viewport. PUR.
 *  Coord caméra : Xc = d·right (tribord), Zc = d·fwd (profondeur avant), Yc = Δz (haut).
 *  behind = point plus proche que le plan NEAR. sx = centre + fx·Xc/Zc ; sy = centre − fy·Yc/Zc (y écran vers le bas). */
export function project(cam: CamPose, P: Vec3): { sx: number; sy: number; depth: number; behind: boolean } {
  const dx = P.x - cam.eye.x;
  const dy = P.y - cam.eye.y;
  const dz = P.z - cam.eye.z;
  const Xc = dx * cam.right.x + dy * cam.right.y;
  const Zc = dx * cam.fwd.x + dy * cam.fwd.y;
  const Yc = dz;
  const behind = Zc < NEAR;
  return {
    sx: VW / 2 + fx * (Xc / Zc),
    sy: VH / 2 - fy * (Yc / Zc),
    depth: Zc,
    behind,
  };
}

/** Profondeur caméra (Zc = (P−eye)·fwd) d'un point monde. Interne au clip. */
function zc(cam: CamPose, P: Vec3): number {
  return (P.x - cam.eye.x) * cam.fwd.x + (P.y - cam.eye.y) * cam.fwd.y;
}

/** Interpolation monde entre deux points au facteur `t`. */
function lerp3(a: Vec3, b: Vec3, t: number): Vec3 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
}

/** Clip d'un SEGMENT monde contre le plan Zc = NEAR (même règle que `clipNear`, pour les POLYLIGNES —
 *  lignes de joints du LOD matériaux). Renvoie null si entièrement derrière. PUR. */
export function clipSegNear(a: Vec3, b: Vec3, cam: CamPose): [Vec3, Vec3] | null {
  const za = zc(cam, a);
  const zb = zc(cam, b);
  if (za < NEAR && zb < NEAR) return null;
  if (za >= NEAR && zb >= NEAR) return [a, b];
  const t = (NEAR - za) / (zb - za);
  const p = lerp3(a, b, t);
  return za >= NEAR ? [a, p] : [p, b];
}

/** Clip Sutherland-Hodgman d'un polygone CONVEXE (sommets monde en ordre) contre le plan Zc = NEAR.
 *  Les points de traversée sont interpolés EN MONDE (t = (NEAR − Zc_in)/(Zc_out − Zc_in)). Renvoie []
 *  si entièrement derrière. Garantit que tout sommet renvoyé a Zc ≥ NEAR (plus d'inversion de sx). PUR. */
export function clipNear(cornersWorld: Vec3[], cam: CamPose): Vec3[] {
  const n = cornersWorld.length;
  if (n === 0) return [];
  const out: Vec3[] = [];
  for (let i = 0; i < n; i++) {
    const cur = cornersWorld[i];
    const prev = cornersWorld[(i + n - 1) % n];
    const zCur = zc(cam, cur);
    const zPrev = zc(cam, prev);
    const inCur = zCur >= NEAR;
    const inPrev = zPrev >= NEAR;
    if (inCur !== inPrev) {
      // arête traverse le plan → ajoute le point d'intersection
      const t = (NEAR - zPrev) / (zCur - zPrev);
      out.push(lerp3(prev, cur, t));
    }
    if (inCur) out.push(cur);
  }
  return out;
}

/** 4 coins MONDE (mètres) de la tuile (x,y) sur la couche `z`, CCW. `atCeiling` ajoute `WALL_H_M` (plafond). */
export function tileCornersWorld(scene: Scene, x: number, y: number, z: number, atCeiling = false): Vec3[] {
  const mpt = sceneMetresPerTile(scene);
  const h = heightAt(scene, x, y, z) + (atCeiling ? WALL_H_M : 0);
  const x0 = (x - 0.5) * mpt;
  const x1 = (x + 0.5) * mpt;
  const y0 = (y - 0.5) * mpt;
  const y1 = (y + 0.5) * mpt;
  // CCW dans le plan sol (NO, SO, SE, NE) — orientation cohérente pour le clip convexe.
  return [
    { x: x0, y: y0, z: h },
    { x: x0, y: y1, z: h },
    { x: x1, y: y1, z: h },
    { x: x1, y: y0, z: h },
  ];
}

/** Vue à présenter d'une entité (sprite paper-doll) selon son cap MONDE vu par la caméra. PUR.
 *  f = e·fwd (aligné avec l'avant caméra), s = e·right (composante latérale) : latéral net → profil,
 *  sinon f<0 (l'entité regarde vers nous) → face, f≥0 (elle nous tourne le dos) → dos. mirror = elle
 *  regarde vers bâbord écran. */
export function povView(
  fwd: { x: number; y: number },
  right: { x: number; y: number },
  entFacing: Dir8,
): { view: View; mirror: boolean } {
  const e = DIR8_DELTA[entFacing];
  const f = e.gx * fwd.x + e.gy * fwd.y;
  const s = e.gx * right.x + e.gy * right.y;
  const view = Math.abs(s) > Math.abs(f) * 1.2 ? 'profile' : f < 0 ? 'front' : 'back';
  return { view, mirror: s < 0 };
}

/** clamp scalaire. */
const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/** Teinte une couleur `#rrggbb` par la lumière (min `AMBIENT_FLOOR`) puis fond vers `fogColor` par `fogT`
 *  (défaut `FOG_COLOR` sombre ; le rendu passe une brume claire en extérieur). Renvoie `rgb(r,g,b)`. PUR. */
export function tint(baseHex: string, light: number, fogT: number, fogColor: string = FOG_COLOR): string {
  const l = clamp(light, AMBIENT_FLOOR, 1);
  const t = clamp(fogT, 0, 1);
  const base = parseHex(baseHex) ?? [0, 0, 0]; // parseur PARTAGÉ (shade.ts) — POV n'a que des couleurs hex résolues
  const fog = parseHex(fogColor) ?? [0, 0, 0];
  const ch = (b: number, f: number): number => {
    const lit = b * l;
    return Math.round(lit + (f - lit) * t);
  };
  return `rgb(${ch(base[0], fog[0])},${ch(base[1], fog[1])},${ch(base[2], fog[2])})`;
}

/** Facteur de brume [0..1] à une profondeur (cases) le long d'une `FogCurve` : 0 avant `start`,
 *  1 à `end`, smoothstep élevée à `gamma` entre les deux (perspective ATMOSPHÉRIQUE progressive —
 *  les silhouettes se délavent, pas de mur de brume). PUR. */
export function fogAt(depthTiles: number, curve: FogCurve): number {
  const u = clamp((depthTiles - curve.start) / (curve.end - curve.start), 0, 1);
  const s = u * u * (3 - 2 * u);
  return Math.pow(s, curve.gamma);
}

/** Mélange linéaire de deux couleurs `#rrggbb` (t = part de `b`, clampé à [0,1] : les poids de LOD
 *  frisent 1). Délègue au `mix` PARTAGÉ de shade.ts (parseur unique). PUR — sert aux FONDUS de LOD
 *  (un joint qui s'évanouit se mélange vers la teinte de sa face, pas d'alpha SVG). */
export function mixHex(a: string, b: string, t: number): string {
  return mix(a, b, clamp(t, 0, 1));
}
