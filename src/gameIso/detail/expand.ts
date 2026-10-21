/**
 * Expansion PURE d'une `DetailRecipe` en primitives UV — le cœur que les backends (iso affine,
 * POV perspective) consomment chacun à sa résolution. Tout est en ESPACE DE FACE [0,1]²
 * (u gauche→droite, v haut→bas) ; seules les ÉPAISSEURS restent en mètres (`jointWM`, `wM`, `rM`) :
 * c'est au backend de les projeter (px/m à sa résolution).
 *
 * DÉTERMINISME TOTAL AU SEED : chaque section (courses/speckle) tire son SOUS-flux de
 * `seedStream(hash32(seed, section))` — ajouter/retirer une section à la recette ne décale pas les
 * tirages des autres (goldens stables par section).
 */
import type { DetailRecipe } from '../../data/materials.types';
import { hash32, seedStream } from '../../data/hash';

/** Rang horizontal [v0,v1] (assise/bardeau/planche). */
export interface CourseRow { v0: number; v1: number }
/** Pierre d'un rang : rectangle UV + nuance `shade` ∈ [−paletteVar, +paletteVar] (modulation de la
 *  couleur de face par le backend — la couleur de base reste celle de la def d'apparence). */
export interface CourseBlock { u0: number; u1: number; v0: number; v1: number; shade: number }
/** Bande horizontale pleine [v0,v1] (plinthe/arase/bandeau). */
export interface BandUV { v0: number; v1: number; color: string }
/** Écharpe de colombage : segment (u0,v0)→(u1,v1), épaisseur portée par `timber.wM`. */
export interface TimberBrace { u0: number; v0: number; u1: number; v1: number }
/** Tache de mouchetis : centre (u,v), rayon en MÈTRES. */
export interface SpeckleDot { u: number; v: number; rM: number; color: string }
/** Touffe d'herbe : pied (u,v), hauteur de brin en MÈTRES. */
export interface TuftUV { u: number; v: number; hM: number; color: string }

export interface DetailExpansion {
  /** Rangs + pierres (`blocks` vide = rangs continus type bardeau/planche). `jointWM` en mètres. */
  courses?: { rows: CourseRow[]; blocks: CourseBlock[]; joint: string; jointWM: number };
  bands: BandUV[];
  /** Poteaux (centres `u`, pleine hauteur) + écharpes ; largeur commune `wM` en mètres. */
  timber?: { posts: number[]; braces: TimberBrace[]; wM: number; color: string };
  speckles: SpeckleDot[];
  tufts: TuftUV[];
}

/** Fraction des blocs recevant un accent clair / sombre (~2×18 % de l'appareillage) — dosage PARTAGÉ
 *  par les backends (accents iso, trapèzes nuancés POV). */
export const ACCENT_FRAC = 0.18;
/** Retrait (m) d'un bloc d'accent — laisse respirer les joints dessinés dessous. Partagé backends. */
export const BLOCK_INSET_M = 0.05;
/** Amplification des nuances d'un bloc d'accent (× `paletteVar`) — dosage PARTAGÉ (accents iso,
 *  trapèzes nuancés POV, bardeaux de toit). */
export const BLOCK_SHADE_K = 1.5;
/** Éventail d'une touffe : décalage horizontal MONDE d'un brin latéral, en fraction de sa hauteur —
 *  dosage PARTAGÉ par les backends qui posent la touffe EN MONDE (POV `groundAccentItems`, WebGL
 *  `tuftGeometry`/`accentMatrix`). L'affine, lui, penche ses brins à l'ÉCRAN et n'a pas d'éventail
 *  monde (`TUFT_LEAN_AMPLITUDE`, `authoring/detailSvg.ts`). */
export const TUFT_FAN = 0.3;
/** Bornes VERTICALES du colombage (fractions de la hauteur de face, depuis le HAUT) : les pans de bois
 *  courent entre le couronnement (bande haute [0.86,1]·WALL_H du builder) et la plinthe (0.11 bas) —
 *  des FORMES calées sur l'assemblage bois, pas des couleurs. Dosage PARTAGÉ : l'affine les strope à
 *  l'écran (`timberOverlaySvg`), la cuisson par face du WebGL les pose aux MÊMES marges (`faceBake`). */
export const TIMBER_V0 = 0.13;
export const TIMBER_V1 = 0.88;
/** Variantes de variance de TEINTE par case (facteurs d'étalement du `tintVar` d'une recette) — dosage
 *  PARTAGÉ par les TROIS backends : dégradés de terrain de l'affine, teinte de tuile du POV, couleur de
 *  sommet du WebGL. La variante se choisit au hash de l'identité MONDE de la case, jamais stockée. */
export const TINT_SPREAD = [-1, -0.4, 0.35, 1];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Déplie `recipe` pour une face de `faceWM`×`faceHM` mètres au `seed` donné. PUR. */
export function expandRecipe(recipe: DetailRecipe, faceWM: number, faceHM: number, seed: number): DetailExpansion {
  const out: DetailExpansion = { bands: [], speckles: [], tufts: [] };

  if (recipe.courses) {
    const c = recipe.courses;
    const r = seedStream(hash32(seed, 'courses'));
    const n = Math.max(1, Math.round(faceHM / c.hM)); // rangs entiers, hauteur ajustée à la face
    // Bornes de rangs : i/n ± tremblé (amplitude MÈTRES → fraction v), extrémités exactes 0 et 1.
    const bounds: number[] = [0];
    const wob = (c.edgeWobble ?? 0) / faceHM;
    for (let i = 1; i < n; i++) bounds.push(clamp01(i / n + (r() * 2 - 1) * wob));
    bounds.push(1);
    // Monotonie : un wobble excessif ne doit JAMAIS inverser deux lignes de joint (rang à hauteur ≥ 0).
    for (let i = 1; i < bounds.length; i++) if (bounds[i] < bounds[i - 1]) bounds[i] = bounds[i - 1];
    const rows: CourseRow[] = [];
    for (let i = 0; i < n; i++) rows.push({ v0: bounds[i], v1: bounds[i + 1] });
    const blocks: CourseBlock[] = [];
    if (c.blockWM) {
      const [wMin, wMax] = c.blockWM;
      const mean = (wMin + wMax) / 2;
      for (let i = 0; i < n; i++) {
        // Appareillage : les rangs IMPAIRS démarrent décalés de `stagger`×largeur moyenne (le premier
        // bloc, tronqué à u=0, casse l'alignement vertical des joints d'un rang sur l'autre).
        let uM = i % 2 === 1 ? -((c.stagger ?? 0) * mean) : 0;
        while (uM < faceWM) {
          const w = wMin + r() * (wMax - wMin);
          const u0 = clamp01(uM / faceWM);
          const u1 = clamp01((uM + w) / faceWM);
          if (u1 > u0) blocks.push({ u0, u1, v0: rows[i].v0, v1: rows[i].v1, shade: (r() * 2 - 1) * (c.paletteVar ?? 0) });
          uM += w;
        }
      }
    }
    out.courses = { rows, blocks, joint: c.joint, jointWM: c.jointW };
  }

  for (const b of recipe.bands ?? []) {
    const half = b.hM / faceHM / 2; // `atV` = CENTRE de la bande, hauteur métrique → fraction v
    out.bands.push({ v0: clamp01(b.atV - half), v1: clamp01(b.atV + half), color: b.color });
  }

  if (recipe.timber) {
    const t = recipe.timber;
    // Travées ENTIÈRES au plus proche du pas demandé (un poteau à chaque bord, u=0 et u=1).
    const spans = Math.max(1, Math.round(faceWM / t.postEveryM));
    const posts: number[] = [];
    for (let i = 0; i <= spans; i++) posts.push(i / spans);
    const braces: TimberBrace[] = [];
    for (let i = 0; i < spans; i++) {
      const u0 = i / spans;
      const u1 = (i + 1) / spans;
      if (t.braces === 'X') braces.push({ u0, v0: 0, u1, v1: 1 }, { u0, v0: 1, u1, v1: 0 });
      else if (t.braces === 'V') braces.push({ u0, v0: 0, u1: (u0 + u1) / 2, v1: 1 }, { u0: u1, v0: 0, u1: (u0 + u1) / 2, v1: 1 });
    }
    out.timber = { posts, braces, wM: t.wM, color: t.color };
  }

  if (recipe.speckle) {
    const s = recipe.speckle;
    const r = seedStream(hash32(seed, 'speckle'));
    const count = Math.round(s.perM2 * faceWM * faceHM); // densité ~ perM2 × aire (déterministe)
    // Biais vertical : v = t^(1/(1+vBias)) tasse la distribution vers v=1 (le PIED de la face) —
    // usure/lichen au bas d'un mur ; vBias 0/absent ⇒ t^1 = uniforme.
    const exp = 1 / (1 + (s.vBias ?? 0));
    for (let i = 0; i < count; i++) {
      out.speckles.push({
        u: r(),
        v: Math.pow(r(), exp),
        rM: s.rM[0] + r() * (s.rM[1] - s.rM[0]),
        color: s.colors[Math.floor(r() * s.colors.length)],
      });
    }
  }

  if (recipe.tufts) {
    const t = recipe.tufts;
    const r = seedStream(hash32(seed, 'tufts'));
    const count = Math.round(t.perM2 * faceWM * faceHM);
    for (let i = 0; i < count; i++) {
      out.tufts.push({
        u: r(),
        v: r(),
        hM: t.hM[0] + r() * (t.hM[1] - t.hM[0]),
        color: t.colors[Math.floor(r() * t.colors.length)],
      });
    }
  }

  return out;
}
