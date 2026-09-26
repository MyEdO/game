/**
 * TEXTURE DE PÉRIODE : le tracé métrique de `detail/courses` rasterisé en LOGICIEL, sans
 * DOM ni canevas (Node-safe : la planche QC et les tests le cuisent comme le navigateur). Le pivot ne
 * rasterise jamais de SVG ici — `coursesPeriod`/`groundCoursesPeriod` rendent des polylignes et des
 * rectangles en mètres, ce module les échantillonne en pixels.
 *
 * MASQUE MULTIPLICATIF RVB, jamais une couleur absolue : la texture MULTIPLIE la couleur de base de la
 * surface (albédo de sommet × `map`). 255 = pleine teinte ; un joint y descend au rapport PAR CANAL
 * `joint ÷ base` de la DONNÉE (`teinteRatio`) — un pixel de joint rend donc EXACTEMENT la couleur de
 * joint de la recette, sans qu'aucun hex ne vive ici ; un bloc nuancé applique le MÊME dosage que les
 * deux backends écran (`BLOCK_SHADE_K`).
 * Un rapport > 1 (bloc CLAIR, ou mortier plus clair que son pan) passe par le `gain` : la valeur 255
 * vaut alors `gain`, à reporter sur la couleur du matériau — le masque reste borné, l'éclaircissement
 * passe par ce facteur.
 *
 * CONTINUITÉ DE RÉPÉTITION : tout stamp s'écrit MODULO la période (tore). Le bord gauche prolonge donc
 * exactement le bord droit, et le haut le bas — une ligne de rang posée en v = 0 se retrouve entière à
 * la couture d'en dessous. Les joints VERTICAUX, eux, ne touchent jamais le bord (`rowBoundaries`).
 */
import * as THREE from 'three';
import { PRIORITE_FOND, queueBakeTask } from './atlasBake';
import {
  coursesKey,
  coursesPeriod,
  coursesPeriodM,
  groundCoursesPeriod,
  groundPeriodM,
  type Courses,
  type CourseLine,
  type CourseRect,
  type CourseVertical,
} from '../../detail/courses';
import { BLOCK_SHADE_K } from '../../detail/expand';
import { parseHex, srgbToLinear } from '../../shade';
import type { DetailRecipe } from '../../detail/types';

/** Les deux familles de période : appareillage VERTICAL (mur, pan de toit) et appareillage de SOL. */
export type PeriodKind = 'wall' | 'ground';

/** Résolution de cuisson (px par mètre de période). Une assise de 0,35 m y tient sur ~34 px : le joint
 *  (2 cm) fait 2 px, la plus petite forme que le mip 0 sait porter sans se dissoudre. */
export const PERIOD_PX_PER_M = 96;
/** Bornes du côté cuit (px), puissances de 2 : mipmaps + `RepeatWrapping` sans repli d'échantillonnage,
 *  et une période ne coûte jamais plus qu'une petite tuile de VRAM. */
const MIN_PX = 16;
const MAX_PX = 512;

/** Masque cuit d'une période : RGBA 8 bits, les 3 canaux portent des rapports multiplicatifs distincts. */
export interface PeriodTextureData {
  data: Uint8Array;
  w: number;
  h: number;
  /** Taille MÉTRIQUE de la période rendue (u le long de l'appareillage, v vers le bas). */
  periodM: { u: number; v: number };
  /** Facteur que vaut la valeur 255 du masque (> 1 quand la période porte du CLAIR : bloc nuancé,
   *  mortier plus clair que son pan). */
  gain: number;
}

export interface PeriodTextureOpts {
  kind?: PeriodKind;
  /** Couleur de BASE de la surface : le masque n'en garde que des RAPPORTS (jamais une teinte). */
  baseColor: string;
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** Plafond d'un rapport de teinte : un ornement ne peut pas éclaircir sa surface au-delà de ce facteur
 *  (au-dessus, le `gain` écraserait la dynamique de tout le masque pour une poignée de pixels). Mesuré
 *  le 2026-08-09 sur TOUTE la donnée de joints et de colombage (les matières de toiture de
 *  `materials.json` + `structureAppearance.json`) : rapport de canal LINÉAIRE maximal 1,443 (joint `#6a531f` sur le pan sud
 *  du chaume `#59461a` ; 1,211 en octets sRGB) — cette borne ne mord sur aucune recette d'aujourd'hui. */
const TEINTE_MAX = 2;

/** Rapport de teinte PAR CANAL d'une couleur d'ornement sur une couleur de base, borné à `TEINTE_MAX`.
 *  `null` si l'une des deux n'est pas lisible en hex (couleur CSS nommée d'une def : la cuisson s'en
 *  abstient). SOURCE UNIQUE des deux canaux cuits — la période l'applique à ses joints et à rien
 *  d'autre, `faceBake` à son colombage.
 *
 *  Rapport pris en LINÉAIRE, jamais sur les octets sRGB : le masque est un multiplicateur que le GPU
 *  applique à un albédo DÉJÀ linéarisé (couleur de sommet convertie par three, `map` en `NoColorSpace`).
 *  Un rapport d'octets sRGB y rendait une teinte trop CLAIRE — mesuré le 2026-08-09 sur
 *  `vitrine-batiments-iso-rot0-unlit` : le colombage `#3b2e1f` sur panneau `#6e5940` sortait à
 *  rgb(82,64,44) (luminance 63,3) au lieu de la donnée rgb(59,46,31) (45,3), soit 24,4 de contraste au
 *  lieu de 42,4 — l'écart-type d'écran du bois plafonnait à 8,32 pour 23,63 au backend affine. */
export function teinteRatio(ornement: string, base: string): [number, number, number] | null {
  const o = parseHex(ornement);
  const b = parseHex(base);
  if (!o || !b) return null;
  const r = [0, 1, 2].map((c) => {
    const bl = srgbToLinear(b[c]);
    return bl <= 0 ? 1 : clamp(srgbToLinear(o[c]) / bl, 0, TEINTE_MAX);
  });
  return [r[0], r[1], r[2]];
}

/** Part de la teinte de base que laisse un joint, PAR CANAL : le rapport de la DONNÉE (couleur de joint
 *  ÷ couleur de face). AUCUN plafond à 1 — un mortier plus clair que son pan se dessine PLUS CLAIR, et
 *  son dépassement se reporte par le `gain`, exactement comme un bloc clair. Un plafond à 1 effaçait
 *  tout joint des pans SUD des trois matériaux de toit (rapports 1,04 à 1,19 : aplat intégral). */
export function jointFactor(jointColor: string, baseColor: string): [number, number, number] {
  return teinteRatio(jointColor, baseColor) ?? [1, 1, 1];
}

/** Côté cuit d'un axe : la taille métrique × la résolution, ramenée à la puissance de 2 la plus proche
 *  dans les bornes. */
function sidePx(metres: number, pxPerM: number): number {
  return 2 ** Math.round(Math.log2(clamp(metres * pxPerM, MIN_PX, MAX_PX)));
}

/** Masque en cours de cuisson — 3 facteurs multiplicatifs par pixel, indexés en tore. */
interface Mask {
  f: Float32Array;
  w: number;
  h: number;
  /** Pixels par mètre, par axe (après arrondi du côté à une puissance de 2). */
  sx: number;
  sy: number;
}

const wrap = (i: number, n: number) => ((i % n) + n) % n;

/** Un joint COUVRE ce qu'il traverse : le rapport de la donnée REMPLACE le pixel, canal par canal. Tous
 *  les joints d'une période partagent le même rapport — deux joints qui se croisent tombent donc sur la
 *  même valeur et ne creusent aucun puits, et un joint tracé par-dessus un bloc nuancé se voit, comme le
 *  mortier d'un appareillage. Une règle du « plus sombre gagne » effaçait, elle, tout joint PLUS CLAIR
 *  que son pan. */
function poserJoint(m: Mask, x: number, y: number, ratio: readonly number[]): void {
  const i = (wrap(y, m.h) * m.w + wrap(x, m.w)) * 3;
  for (let c = 0; c < 3; c++) m.f[i + c] = ratio[c];
}

/** Segment MÉTRIQUE épaissi de `wPx` pixels, échantillonné au demi-pixel (chaque pas dépose un carré). */
function stampSegment(m: Mask, u0: number, v0: number, u1: number, v1: number, wPx: number, ratio: readonly number[]): void {
  const x0 = u0 * m.sx, y0 = v0 * m.sy, x1 = u1 * m.sx, y1 = v1 * m.sy;
  const len = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.ceil(len * 2));
  const r = Math.max(0.5, wPx / 2);
  const lo = Math.round(-r + 0.5);
  const hi = Math.round(r - 0.5);
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const cx = Math.round(x0 + (x1 - x0) * t);
    const cy = Math.round(y0 + (y1 - y0) * t);
    for (let dy = lo; dy <= hi; dy++) for (let dx = lo; dx <= hi; dx++) poserJoint(m, cx + dx, cy + dy, ratio);
  }
}

/** Ligne de rang tremblée : (0, y0) puis chaque point, en mètres. */
function stampLine(m: Mask, line: CourseLine, wPx: number, ratio: readonly number[]): void {
  let pu = 0;
  let pv = line.y0;
  for (const p of line.pts) {
    stampSegment(m, pu, pv, p.u, p.y, wPx, ratio);
    pu = p.u;
    pv = p.y;
  }
}

/** Joint vertical entre deux blocs d'un rang. */
function stampVertical(m: Mask, v: CourseVertical, wPx: number, ratio: readonly number[]): void {
  stampSegment(m, v.u, v.y0, v.u, v.y1, wPx, ratio);
}

/** Bloc nuancé : multiplie la teinte du rectangle (retrait déjà pris par la période). */
function fillRect(m: Mask, r: CourseRect, factor: number): void {
  const x0 = Math.round(r.u0 * m.sx);
  const x1 = Math.round(r.u1 * m.sx);
  const y0 = Math.round(r.v0 * m.sy);
  const y1 = Math.round(r.v1 * m.sy);
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const i = (wrap(y, m.h) * m.w + wrap(x, m.w)) * 3;
      for (let c = 0; c < 3; c++) m.f[i + c] *= factor;
    }
}

/** Masque d'une période d'appareillage — `null` quand la recette n'a pas d'assises (rien ne se répète).
 *  `variant` ne joue que sur l'appareillage VERTICAL : la période de SOL est seedée à la seule clé de
 *  recette (`groundCoursesPeriod`), elle n'a qu'un exemplaire. */
export function periodTextureData(
  recipe: DetailRecipe,
  variant: number,
  pxPerM: number,
  opts: PeriodTextureOpts,
): PeriodTextureData | null {
  const c: Courses | undefined = recipe.courses;
  if (!c) return null;
  const kind = opts.kind ?? 'wall';
  const key = coursesKey(c);
  const periodM = kind === 'ground' ? groundPeriodM(c) : coursesPeriodM(c);
  const w = sidePx(periodM.u, pxPerM);
  const h = sidePx(periodM.v, pxPerM);
  const m: Mask = { f: new Float32Array(w * h * 3).fill(1), w, h, sx: w / periodM.u, sy: h / periodM.v };

  const pv = c.paletteVar ?? 0;
  const clair = 1 + pv * BLOCK_SHADE_K;
  const sombre = 1 - pv * BLOCK_SHADE_K;
  const jointW = Math.max(1, c.jointW * ((m.sx + m.sy) / 2));
  const jf = jointFactor(c.joint, opts.baseColor);

  if (kind === 'ground') {
    const p = groundCoursesPeriod(c, key);
    if (pv) {
      for (const r of p.light) fillRect(m, r, clair);
      for (const r of p.dark) fillRect(m, r, sombre);
    }
    for (const l of p.lines) stampLine(m, l, jointW, jf);
    for (const v of p.verticals) stampVertical(m, v, jointW, jf);
  } else {
    const p = coursesPeriod(c, key, variant);
    for (const l of p.lines) stampLine(m, l, jointW, jf);
    for (const v of p.verticals) stampVertical(m, v, jointW, jf);
  }

  let gain = 1;
  for (let i = 0; i < m.f.length; i++) if (m.f[i] > gain) gain = m.f[i];
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    for (let c2 = 0; c2 < 3; c2++) data[i * 4 + c2] = Math.round(255 * clamp(m.f[i * 3 + c2] / gain, 0, 1));
    data[i * 4 + 3] = 255;
  }
  return { data, w, h, periodM, gain };
}

// ————————————————————————————————————————————————————————————————
// Côté GPU : la DataTexture et son cache
// ————————————————————————————————————————————————————————————————

/** Texture GPU d'une période + le gain à reporter sur la couleur du matériau. */
export interface PeriodTexture {
  texture: THREE.DataTexture;
  gain: number;
  periodM: { u: number; v: number };
}

const CACHE = new Map<string, PeriodTexture | null>();

/** Périodes FROIDES déjà parties en file, par clé — même rôle que dans `faceBake` : deux demandes
 *  concurrentes de la même image partagent UNE tâche. L'entrée meurt à la résolution. */
const EN_VOL = new Map<string, Promise<PeriodTexture | null>>();

/** GÉNÉRATION de cuisson — même rôle que dans `faceBake` : une tâche encore en file au moment où le
 *  cache est vidé appartient à une carte morte, et ne cuit pas à son tour de tranche. */
let génération = 0;

/** Vide le cache (changement de scène : les surfaces de l'ancienne carte ne reviendront pas). */
export function clearPeriodTextures(): void {
  for (const t of CACHE.values()) t?.texture.dispose();
  CACHE.clear();
  EN_VOL.clear();
  génération += 1;
}

/** DataTexture d'une période, cuite UNE fois par (clé de surface, variante) : `RepeatWrapping`, mipmaps
 *  et anisotropie (le pas de rang d'un mur vu de biais tient sinon du bruit). Le masque est de la DONNÉE
 *  LINÉAIRE (un multiplicateur), jamais une couleur : aucune conversion d'espace. */
export function getPeriodTexture(
  cacheKey: string,
  recipe: DetailRecipe,
  variant: number,
  opts: PeriodTextureOpts & { anisotropy?: number },
): PeriodTexture | null {
  const hit = CACHE.get(cacheKey);
  if (hit !== undefined) return hit;
  const cuit = periodTextureData(recipe, variant, PERIOD_PX_PER_M, opts);
  if (!cuit) {
    CACHE.set(cacheKey, null);
    return null;
  }
  const texture = new THREE.DataTexture(cuit.data, cuit.w, cuit.h, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = opts.anisotropy ?? 1;
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  const out = { texture, gain: cuit.gain, periodM: cuit.periodM };
  CACHE.set(cacheKey, out);
  return out;
}

/** Ce que rend une demande de période PAR LA FILE (`getPeriodTextureEnFile`). */
export interface PeriodTextureEnFile {
  /** La texture quand le cache est CHAUD ; `null` tant que la file n'a pas servi la tranche. */
  période: PeriodTexture | null;
  /** Résolue quand la cuisson est faite (cache chaud : déjà résolue). `null` = rien à cuire, ou tâche
   *  d'une GÉNÉRATION révolue (cache vidé depuis la mise en file). */
  prêt: Promise<PeriodTexture | null>;
}

/**
 * MÊME cuisson que `getPeriodTexture`, demandée à la FILE CADENCÉE du cuiseur (`queueBakeTask`) —
 * jumelle de `getFaceBakeEnFile`, et pour la même raison : le montage d'une carte rasterise ses
 * gabarits en tranches au lieu d'un bloc synchrone. Une cuisson par tâche, en `PRIORITE_FOND`.
 */
export function getPeriodTextureEnFile(
  cacheKey: string,
  recipe: DetailRecipe,
  variant: number,
  opts: PeriodTextureOpts & { anisotropy?: number },
): PeriodTextureEnFile {
  const hit = CACHE.get(cacheKey);
  if (hit !== undefined) return { période: hit, prêt: Promise.resolve(hit) };
  const enVol = EN_VOL.get(cacheKey);
  if (enVol) return { période: null, prêt: enVol };
  const née = génération;
  const prêt = queueBakeTask(PRIORITE_FOND, async () =>
    née === génération ? getPeriodTexture(cacheKey, recipe, variant, opts) : null,
  );
  EN_VOL.set(cacheKey, prêt);
  // …et l'oubli ne retire QUE sa propre entrée (voir `getFaceBakeEnFile`).
  const oublier = (): void => { if (EN_VOL.get(cacheKey) === prêt) EN_VOL.delete(cacheKey); };
  void prêt.then(oublier, oublier);
  return { période: null, prêt };
}
