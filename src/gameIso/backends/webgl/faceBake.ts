/**
 * CUISSON PAR FACE du COLOMBAGE (`timber`) : l'ornement qui ne se RÉPÈTE pas et ne tire
 * AUCUN aléa. Là où la texture de PÉRIODE (`periodTexture.ts`) porte ce qui boucle en `RepeatWrapping`
 * sur l'UV MONDE, ce module cuit l'image d'UNE face entière, échantillonnée sur son `uv1` [0,1]² — un
 * assemblage calé sur la face (un poteau à chaque bord), qui n'a pas de période.
 *
 * CANAL DÉTERMINISTE SEUL (#1176 phase 1) : l'expansion du colombage se déplie à seed 0, la cuisson est
 * donc fonction du seul GABARIT. Sa clé ne porte AUCUNE identité de face — deux façades de mêmes
 * dimensions et même variante partagent leur image. Les accents muraux SEEDÉS (blocs nuancés d'un
 * appareillage, mouchetis) ne passent PAS par ici : leur canal dédié est spécifié au #1198.
 *
 * LOGICIEL et Node-safe : ni DOM, ni canevas, ni renderer (les tests et la planche QC le cuisent comme
 * le navigateur). La géométrie reste INTACTE — le colombage mesuré en volume coûtait +98 à +114 % de
 * triangles (#1176 phase 1).
 *
 * MASQUE MULTIPLICATIF RVB, jamais une couleur absolue : chaque canal porte le rapport
 * `couleur d'ornement ÷ couleur de base`, tous deux pris à la DONNÉE (`recipe.timber.color`, la teinte
 * de face de la def d'apparence). Le rendu vaut donc `base × rapport` = la couleur de la donnée, sans
 * qu'aucun hex ne vive ici. Un rapport > 1 (un bois plus clair que son panneau) passe par le `gain` : la
 * valeur 255 du masque vaut `gain`, à reporter sur la couleur du matériau, exactement comme `periodTexture`.
 *
 * FOND : quand la recette porte des assises, la cuisson part du masque de PÉRIODE, échantillonné en
 * tore sur la face — une face cuite garde donc ses joints, et sort du groupe de période sans rien perdre.
 */
import * as THREE from 'three';
import { PRIORITE_FOND, queueBakeTask } from './atlasBake';
import { expandRecipe, TIMBER_V0, TIMBER_V1 } from '../../detail/expand';
import { periodTextureData, teinteRatio, PERIOD_PX_PER_M } from './periodTexture';
import type { DetailRecipe } from '../../../data/materials.types';

/** Ce qu'il faut d'une surface pour la cuire : sa couleur de base, sa recette et la PART de mur qu'elle
 *  habille (`TIMBERED_PARTS` en décide). Sous-ensemble de `FaceSurface` (`faceColors.ts`) élargi à la
 *  part du matériau — la cuisson ne connaît ni clé ni échelle d'UV. */
export interface BakeSurface {
  color: string;
  recipe?: DetailRecipe;
  part?: string;
}

/** Résolution de cuisson de RÉFÉRENCE (px par mètre de FACE). Plus basse que celle d'une période : une
 *  face fait plusieurs mètres de côté et son image est bornée — à 48 px/m, un poteau de 8 cm tient sur 4 px. */
export const FACE_PX_PER_M = 48;
/** Bornes du côté cuit (px), puissances de 2 : mipmaps et un plafond de VRAM par face. `BASE_MAX_PX` est
 *  le plafond ORDINAIRE ; `MAX_PX` le plafond DUR, que seules atteignent les faces dont la poutre la plus
 *  fine ne tiendrait pas sous le plafond ordinaire (`bakeResolution`). */
const MIN_PX = 16;
const BASE_MAX_PX = 256;
const MAX_PX = 512;
/** Largeur de masque (px) exigée pour la poutre la plus fine d'une recette. Mesure #1176 phase 1 : sur
 *  une grande façade bornée à 256 px de côté, la poutre de 8 cm tombait à 1,65 px et se dissolvait au
 *  mip — l'écart-type d'écran du colombage retombait à 7,98 pour 23,63 au backend affine. */
export const BEAM_MIN_PX = 3;

/** Masque cuit d'une face : RGBA 8 bits, les 3 canaux portent des rapports multiplicatifs distincts. */
export interface FaceBakeData {
  data: Uint8Array;
  w: number;
  h: number;
  /** Facteur que vaut la valeur 255 du masque (> 1 quand un ornement éclaircit sa surface). */
  gain: number;
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

function sidePx(metres: number, pxPerM: number, cap: number): number {
  return 2 ** Math.round(Math.log2(clamp(metres * pxPerM, MIN_PX, cap)));
}

/** Côtés cuits d'une face de `wM`×`hM` mètres, choisis pour que la POUTRE LA PLUS FINE de la recette
 *  tienne `BEAM_MIN_PX` px de masque. La recherche monte une ÉCHELLE de coûts croissants, et s'arrête au
 *  PREMIER barreau qui nourrit la poutre : plafond ordinaire à la résolution de référence (le barreau 0
 *  = la dérivation d'avant, celle de toutes les petites façades), puis plafond dur, puis doublements de
 *  la résolution de référence — ces derniers portent le cas d'une face dont un côté RETOMBE sous le
 *  plafond à l'arrondi (une longue façade basse) et que relever le seul plafond n'affranchit pas. La
 *  montée cesse dès que les DEUX côtés saturent `MAX_PX` : il n'y a plus rien à donner.
 *
 *  `pxPerM` rendu = la résolution EFFECTIVE, moyenne des deux axes APRÈS arrondi des côtés à une
 *  puissance de 2 — la grandeur même dont `faceBakeData` tire sa largeur de trait (`m.sx`/`m.sy`). */
export function bakeResolution(
  recipe: DetailRecipe | undefined,
  wM: number,
  hM: number,
  basePxPerM: number = FACE_PX_PER_M,
): { w: number; h: number; pxPerM: number } {
  const beamM = recipe?.timber?.wM ?? 0;
  let w: number;
  let h: number;
  let px: number;
  for (let barreau = 0; ; barreau++) {
    const cap = barreau === 0 ? BASE_MAX_PX : MAX_PX;
    const res = basePxPerM * 2 ** Math.max(0, barreau - 1);
    w = sidePx(wM, res, cap);
    h = sidePx(hM, res, cap);
    px = (w / wM + h / hM) / 2;
    if (beamM <= 0 || beamM * px >= BEAM_MIN_PX) break;
    if (w >= MAX_PX && h >= MAX_PX) break;
  }
  return { w, h, pxPerM: px };
}

/** Parts de mur que le COLOMBAGE habille — le jeu EXACT des faces que le backend affine colombe :
 *  `authoring/wallsSvg.ts` (la face `part === 'face'` d'un `WallEl`, puis la couche
 *  d'accents, même filtre `f.material.part !== 'face'`) et `structureFaceSvg` (`authoring/wallsSvg.ts`),
 *  qui ne reçoit que des fermetures de comble et des raccords de nappe — tous authorés `part: 'face'`
 *  (`builders/roofs.ts:1308`, `builders/walls.ts:525`). Toute autre part (poteau, plinthe, panneau,
 *  moulure, vitre, meneau…) est un DÉCOR posé sur la joue : elle garde son chemin de période ou son
 *  aplat, jamais des pans de bois. */
const TIMBERED_PARTS: ReadonlySet<string> = new Set(['face']);

/** Une face exige-t-elle une cuisson PAR FACE ? Le SEUL canal cuit par face est le colombage d'une
 *  face MURALE `part === 'face'` : calé sur la face (il n'a pas de période), entièrement déterministe
 *  (aucun seed), et posé là où l'affine le pose. Les accents seedés d'un appareillage mural relèvent
 *  du canal dédié spécifié au #1198. */
export function needsFaceBake(recipe: DetailRecipe | undefined, kind: 'wall' | 'ground', part: string | undefined): boolean {
  if (!recipe || kind !== 'wall' || !TIMBERED_PARTS.has(part ?? '')) return false;
  return !!recipe.timber;
}

/** Masque en cours de cuisson : 3 facteurs par pixel (aucun repli en tore — une face a des BORDS). */
interface Mask {
  f: Float32Array;
  w: number;
  h: number;
  /** Pixels par mètre, par axe (après arrondi du côté à une puissance de 2). */
  sx: number;
  sy: number;
}

/** Pose un rapport sous une COUVERTURE fractionnaire : le trait se COMPOSE sur ce qu'il recouvre
 *  (`courant·(1−cov) + rapport·cov`), canal par canal. À pleine couverture le pixel vaut exactement le
 *  rapport — un poteau et une écharpe qui se croisent ne creusent donc pas un puits, et les pans de bois
 *  passent bien DEVANT le fond de période. */
function poser(m: Mask, x: number, y: number, ratio: readonly number[], cov: number): void {
  if (x < 0 || y < 0 || x >= m.w || y >= m.h || cov <= 0) return;
  const k = cov > 1 ? 1 : cov;
  const i = (y * m.w + x) * 3;
  for (let c = 0; c < 3; c++) m.f[i + c] = m.f[i + c] * (1 - k) + ratio[c] * k;
}

/** Segment MÉTRIQUE de largeur `wPx` pixels, rasterisé par la DISTANCE de chaque pixel à son axe : la
 *  couverture vaut `wPx/2 + 0,5 − d`, bornée à [0,1]. Deux conséquences mesurables : le bord d'une
 *  poutre est ANTI-CRÉNELÉ (un trait oblique cessait d'être une suite d'escaliers pleins), et une poutre
 *  plus fine qu'un pixel dépose sa fraction d'encre au lieu d'être arrondie à un pixel plein ou à rien.
 *  Bouts CARRÉS : l'axe est allongé d'une demi-largeur à chaque extrémité, comme le `stroke-linecap
 *  ="square"` de la source affine (`timberOverlaySvg`, `authoring/detailSvg.ts`). */
function stampSegment(m: Mask, u0: number, v0: number, u1: number, v1: number, wPx: number, ratio: readonly number[]): void {
  const r = Math.max(0.5, wPx / 2);
  let x0 = u0 * m.sx, y0 = v0 * m.sy, x1 = u1 * m.sx, y1 = v1 * m.sy;
  const len = Math.hypot(x1 - x0, y1 - y0);
  if (len > 0) {
    const ex = ((x1 - x0) / len) * r, ey = ((y1 - y0) / len) * r;
    x0 -= ex; y0 -= ey; x1 += ex; y1 += ey;
  }
  const dx = x1 - x0, dy = y1 - y0;
  const len2 = dx * dx + dy * dy;
  const xLo = Math.max(0, Math.floor(Math.min(x0, x1) - r - 1));
  const xHi = Math.min(m.w - 1, Math.ceil(Math.max(x0, x1) + r + 1));
  const yLo = Math.max(0, Math.floor(Math.min(y0, y1) - r - 1));
  const yHi = Math.min(m.h - 1, Math.ceil(Math.max(y0, y1) + r + 1));
  for (let y = yLo; y <= yHi; y++)
    for (let x = xLo; x <= xHi; x++) {
      const px = x + 0.5, py = y + 0.5;
      const t = len2 > 0 ? clamp(((px - x0) * dx + (py - y0) * dy) / len2, 0, 1) : 0;
      poser(m, x, y, ratio, r + 0.5 - Math.hypot(px - (x0 + dx * t), py - (y0 + dy * t)));
    }
}

/** Cuisson LOGICIELLE d'une face de `wM`×`hM` mètres. `null` dans DEUX cas : la face n'exige aucune
 *  cuisson (`needsFaceBake` — la période seule suffit, le chemin de `periodTexture` reste inchangé), ou
 *  le masque cuit est entièrement NEUTRE (rien n'y a été déposé : le gabarit est trop court pour que
 *  l'ossature y tienne). Une image neutre est une texture invisible qui coûte un dessin et de la VRAM —
 *  son groupe retombe sur le chemin période/nu. `variant` ne sert qu'au FOND de période. AUCUN seed
 *  n'entre ici : l'image ne dépend que du gabarit et de la surface. */
export function faceBakeData(
  surface: BakeSurface,
  wM: number,
  hM: number,
  pxPerM: number = FACE_PX_PER_M,
  variant = 0,
): FaceBakeData | null {
  const recipe = surface.recipe;
  if (!needsFaceBake(recipe, 'wall', surface.part) || !recipe) return null;
  const { w, h } = bakeResolution(recipe, wM, hM, pxPerM);
  const m: Mask = { f: new Float32Array(w * h * 3).fill(1), w, h, sx: w / wM, sy: h / hM };

  // FOND : le masque de période (joints), échantillonné en TORE sur la face — la face cuite quitte le
  // groupe de période sans perdre son appareillage.
  const c = recipe.courses;
  if (c) {
    const p = periodTextureData(recipe, variant, PERIOD_PX_PER_M, { kind: 'wall', baseColor: surface.color });
    if (p) {
      for (let y = 0; y < h; y++) {
        const vM = ((y + 0.5) / h) * hM;
        const py = ((Math.floor((vM / p.periodM.v) * p.h) % p.h) + p.h) % p.h;
        for (let x = 0; x < w; x++) {
          const uM = ((x + 0.5) / w) * wM;
          const px = ((Math.floor((uM / p.periodM.u) * p.w) % p.w) + p.w) % p.w;
          const i = (y * w + x) * 3;
          const j = (py * p.w + px) * 4;
          for (let c2 = 0; c2 < 3; c2++) m.f[i + c2] *= (p.data[j + c2] / 255) * p.gain;
        }
      }
    }
  }

  // COLOMBAGE : l'expansion déterministe (aucun aléa — poteaux aux deux bords + intermédiaires,
  // écharpes X/V par travée), à la couleur de la recette, posée entre les MÊMES marges verticales que
  // le backend affine (`TIMBER_V0`/`TIMBER_V1`, source unique). Posé EN DERNIER : sur une façade à
  // colombages, les pans de bois passent devant le panneau.
  const e = expandRecipe({ timber: recipe.timber, seedScope: recipe.seedScope }, wM, hM, 0);
  const ratio = e.timber ? teinteRatio(e.timber.color, surface.color) : null;
  if (e.timber && ratio) {
    // Largeur de poutre : la MÊME grandeur métrique que la source affine (`e.timber.wM` de
    // `expandRecipe`, que `timberOverlaySvg` passe en `stroke-width`) — jamais une épaisseur d'écran.
    const wPx = e.timber.wM * ((m.sx + m.sy) / 2);
    const vM = (raw: number) => (TIMBER_V0 + raw * (TIMBER_V1 - TIMBER_V0)) * hM;
    for (const u of e.timber.posts) stampSegment(m, u * wM, vM(0), u * wM, vM(1), wPx, ratio);
    for (const b of e.timber.braces) stampSegment(m, b.u0 * wM, vM(b.v0), b.u1 * wM, vM(b.v1), wPx, ratio);
  }

  let gain = 1;
  let neutre = true;
  for (let i = 0; i < m.f.length; i++) {
    if (m.f[i] > gain) gain = m.f[i];
    if (m.f[i] !== 1) neutre = false;
  }
  if (neutre) return null;
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    for (let c2 = 0; c2 < 3; c2++) data[i * 4 + c2] = Math.round(255 * clamp(m.f[i * 3 + c2] / gain, 0, 1));
    data[i * 4 + 3] = 255;
  }
  return { data, w, h, gain };
}

// ————————————————————————————————————————————————————————————————
// Côté GPU : la DataTexture et son cache
// ————————————————————————————————————————————————————————————————

/** Clé de cuisson d'une face : MÊME surface, MÊME gabarit (dimensions quantifiées au centimètre) et
 *  MÊME variante d'appareillage ⇒ MÊME image. Aucune identité de face n'y entre — le canal cuit est
 *  déterministe. C'est `surfaceGrouping` (`sceneMeshes.ts`) qui réunit les façades jumelles SOUS cette
 *  clé : une image pour tout un groupe de faces, quel que soit le nombre de façades qu'il porte. */
export function faceBakeKey(surfaceKey: string, wM: number, hM: number, variant: number): string {
  return `${surfaceKey}|${wM.toFixed(2)}x${hM.toFixed(2)}|v${variant}`;
}

/** Texture GPU d'une face cuite + le gain à reporter sur la couleur du matériau. */
export interface FaceBake {
  texture: THREE.DataTexture;
  gain: number;
}

const CACHE = new Map<string, FaceBake | null>();

/** Cuissons FROIDES déjà parties en file, par clé — deux demandes concurrentes de la même image (deux
 *  stages montés, le double montage de `StrictMode`, l'écran et une planche) partagent donc UNE tâche
 *  au lieu d'en payer deux. L'entrée meurt à la résolution ; le cache prend le relais. */
const EN_VOL = new Map<string, Promise<FaceBake | null>>();

/** GÉNÉRATION de cuisson : `clearFaceBakes` la fait avancer, et toute tâche encore en file la relit à
 *  son tour de tranche. Vider le cache défait le dédoublonnage (`EN_VOL`) sans vider la FILE : sans
 *  génération, la scène neuve attend derrière une tâche qui ne sert plus personne, puis reçoit l'image
 *  que cette tâche morte a posée dans le cache neuf. */
let génération = 0;

/** Vide le cache (changement de scène) — même patron que `clearPeriodTextures`. */
export function clearFaceBakes(): void {
  for (const t of CACHE.values()) t?.texture.dispose();
  CACHE.clear();
  EN_VOL.clear();
  génération += 1;
}

/** DataTexture d'une face cuite, une fois par clé. `ClampToEdgeWrapping` : une face ne se répète pas.
 *  Elle s'échantillonne sur l'UV de FACE (`uv1`) — `channel = 1`. */
export function getFaceBake(
  cacheKey: string,
  surface: BakeSurface,
  wM: number,
  hM: number,
  variant: number,
  anisotropy = 1,
): FaceBake | null {
  const hit = CACHE.get(cacheKey);
  if (hit !== undefined) return hit;
  const cuit = faceBakeData(surface, wM, hM, FACE_PX_PER_M, variant);
  if (!cuit) {
    CACHE.set(cacheKey, null);
    return null;
  }
  const texture = new THREE.DataTexture(cuit.data, cuit.w, cuit.h, THREE.RGBAFormat);
  texture.channel = 1;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = anisotropy;
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  const out = { texture, gain: cuit.gain };
  CACHE.set(cacheKey, out);
  return out;
}

/** Ce que rend une demande de cuisson PAR LA FILE (`getFaceBakeEnFile`). */
export interface FaceBakeEnFile {
  /** La cuisson quand le cache est CHAUD ; `null` tant que la file n'a pas servi la tranche. */
  cuisson: FaceBake | null;
  /** Résolue quand la cuisson est faite (cache chaud : déjà résolue). `null` = rien à cuire, ou tâche
   *  d'une GÉNÉRATION révolue (cache vidé depuis la mise en file). */
  prêt: Promise<FaceBake | null>;
}

/**
 * MÊME cuisson que `getFaceBake`, demandée à la FILE CADENCÉE du cuiseur (`queueBakeTask`) au lieu
 * d'être payée dans l'appel. Le calcul lui-même ne change pas : c'est son INSTANT qui change — un
 * montage de carte cuit ses gabarits de face en tranches au lieu d'un bloc synchrone, et l'appelant
 * tient un matériau utilisable dès le premier instant.
 *
 * La granularité est UNE cuisson par tâche : c'est elle qui découpe la passe. Priorité `PRIORITE_FOND`
 * (sous la vue courante) : le gabarit se relève en place, le billboard absent est un trou.
 */
export function getFaceBakeEnFile(
  cacheKey: string,
  surface: BakeSurface,
  wM: number,
  hM: number,
  variant: number,
  anisotropy = 1,
): FaceBakeEnFile {
  const hit = CACHE.get(cacheKey);
  if (hit !== undefined) return { cuisson: hit, prêt: Promise.resolve(hit) };
  const enVol = EN_VOL.get(cacheKey);
  if (enVol) return { cuisson: null, prêt: enVol };
  const née = génération;
  const prêt = queueBakeTask(PRIORITE_FOND, async () =>
    née === génération ? getFaceBake(cacheKey, surface, wM, hM, variant, anisotropy) : null,
  );
  EN_VOL.set(cacheKey, prêt);
  // …et l'oubli ne retire QUE sa propre entrée : une tâche périmée qui se résout après que la scène
  // neuve a ré-enfilé la même clé effacerait sinon le dédoublonnage de celle-ci.
  const oublier = (): void => { if (EN_VOL.get(cacheKey) === prêt) EN_VOL.delete(cacheKey); };
  void prêt.then(oublier, oublier);
  return { cuisson: null, prêt };
}
