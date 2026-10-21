/**
 * TRACÉ DE PÉRIODE des assises — géométrie MÉTRIQUE pure d'un appareillage qui se RÉPÈTE (mur, sol).
 * Aucune notion d'écran ici : ni pixel, ni projection, ni couleur de voile — des mètres, des bornes et
 * des rectangles. Le backend affine en fait un `<pattern>` (son `patternTransform` projette ces mètres
 * en écran) ; un cuiseur de texture en ferait une image ; les deux lisent le MÊME tracé.
 *
 * DÉTERMINISME AU SEED, comme `expandRecipe` : chaque section tire son sous-flux de
 * `seedStream(hash32(section, clé, …))` — la période d'un mur, celle d'un sol et les bornes d'un rang
 * ne se décalent pas les unes les autres.
 *
 * Convention : `u` court le long de l'appareillage (m), `v` descend (m depuis le haut de la période).
 */
import { hash32, seedStream } from '../../data/hash';
import { ACCENT_FRAC, BLOCK_INSET_M } from './expand';
import type { DetailRecipe } from '../../data/materials.types';

/** Section `courses` d'une recette, dépliée pour une PÉRIODE (et non pour une face). */
export type Courses = NonNullable<DetailRecipe['courses']>;

/** Clé de CONTENU d'une recette d'assises : deux defs qui portent le même appareillage partagent leur
 *  tracé (donc leur motif, leur texture). */
export const coursesKey = (c: Courses): string => hash32(JSON.stringify(c)).toString(36);

/** Variantes pré-seedées par recette : le tracé de période se décline en `N_VARIANTS` exemplaires,
 *  choisis au hash de l'identité monde de la face — une même période répétée à l'identique sur toute
 *  une carte se lit comme un damier. */
export const N_VARIANTS = 3;

/** Variante de motif d'une face — hash de son identité MONDE (x, y, côté). SOURCE UNIQUE : les deux
 *  backends (affine, GPU) tombent sur la même variante pour la même face. */
export const variantOf = (cell: { x: number; y: number }, side: string): number =>
  hash32('dtvar', cell.x, cell.y, side) % N_VARIANTS;

/** Pas de rang (m) d'un PAN de toit : la pente de l'élément (`pitchM`, à défaut `slopeM`) divisée par
 *  son nombre ENTIER de rangs — un rang de couverture ne se coupe pas en deux à l'arêtier, donc le pas
 *  dépend de la PENTE et se calcule par élément. `hM` = hauteur de rang de la recette. */
export function roofCourseStepM(pitchM: number | undefined, hM: number, slopeM: number): number {
  const courses = Math.max(1, Math.round((pitchM || slopeM) / hM));
  return (pitchM ?? slopeM) / courses;
}

/** Largeur de PÉRIODE d'un appareillage vertical (m) : ~4 blocs moyens (assez large pour casser la
 *  répétition à l'œil). Sans blocs (rangs continus : bardeau, planche), 2 m. */
export const patternWM = (c: Courses): number => (c.blockWM ? Math.max(1.6, 2 * (c.blockWM[0] + c.blockWM[1])) : 2);

/** Rangs par période d'un appareillage de SOL — plus qu'un mur (2) : une place pavée expose une grande
 *  surface continue, la répétition doit boucler loin. */
export const GROUND_ROWS = 6;

/** Taille MÉTRIQUE d'une période verticale (mur, pan de toit) : `patternWM` de large, DEUX rangs de
 *  haut (l'appareillage alterne par parité de rang). */
export const coursesPeriodM = (c: Courses): { u: number; v: number } => ({ u: patternWM(c), v: 2 * c.hM });

/** Taille MÉTRIQUE d'une période de SOL : deux fois plus large qu'un mur, `GROUND_ROWS` rangs de haut. */
export const groundPeriodM = (c: Courses): { u: number; v: number } => ({ u: 2 * patternWM(c), v: GROUND_ROWS * c.hM });

/** Ligne de rang tremblée : part de `(0, y0)` et rejoint chaque point de `pts` (le dernier retombe
 *  EXACTEMENT sur `y0` — la période boucle sans couture). */
export interface CourseLine {
  y0: number;
  pts: { u: number; y: number }[];
}
/** Joint VERTICAL entre deux blocs d'un rang : segment `u` de `y0` à `y1`. */
export interface CourseVertical {
  u: number;
  y0: number;
  y1: number;
}
/** Bloc nuancé (accent clair ou sombre), déjà RETRAIT pris (`BLOCK_INSET_M`) : les joints dessinés
 *  dessous respirent autour de lui. */
export interface CourseRect {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
}

/** Segments d'une ligne de rang tremblée d'amplitude `wob` (m), de `0` à `wM` en `SEG` pas. */
const SEG = 8;
function wobbledLine(y0: number, wM: number, wob: number, r: () => number): CourseLine {
  const pts: { u: number; y: number }[] = [];
  for (let i = 1; i <= SEG; i++) pts.push({ u: (wM * i) / SEG, y: y0 + (i === SEG ? 0 : (r() * 2 - 1) * wob) });
  return { y0, pts };
}

/** Bornes des joints VERTICAUX d'un rang de période (positions en mètres dans ]0,W[), par PARITÉ de
 *  rang. Aucun joint au bord de période (0/W) : le bloc y chevauche la couture → périodicité invisible.
 *  Bornes PARTAGÉES par le tracé du motif, les accents alignés dessus et les bardeaux de toit. */
export function rowBoundaries(c: Courses, key: string, variant: number, parity: 0 | 1): number[] {
  if (!c.blockWM) return [];
  const [wMin, wMax] = c.blockWM;
  const mean = (wMin + wMax) / 2;
  const W = patternWM(c);
  const r = seedStream(hash32('dtblocks', key, variant, parity));
  const out: number[] = [];
  let u = parity === 1 ? -(c.stagger ?? 0) * mean : 0;
  for (;;) {
    u += wMin + r() * (wMax - wMin);
    if (u >= W - 0.05) return out;
    if (u > 0.05) out.push(u);
  }
}

/** Tracé d'une période VERTICALE : deux lignes de rang tremblées (y = 0 et y = `hM`, ancrées aux
 *  coutures) + les joints verticaux des deux parités. */
export interface CoursesPeriod {
  wM: number;
  hM: number;
  lines: CourseLine[];
  verticals: CourseVertical[];
}

export function coursesPeriod(c: Courses, key: string, variant: number): CoursesPeriod {
  const W = patternWM(c);
  const r = seedStream(hash32('dtpat', key, variant));
  const wob = c.edgeWobble ?? 0;
  const lines = [0, c.hM].map((y0) => wobbledLine(y0, W, wob, r));
  const verticals: CourseVertical[] = [];
  for (const parity of [0, 1] as const) {
    const y0 = parity * c.hM;
    for (const b of rowBoundaries(c, key, variant, parity)) verticals.push({ u: b, y0, y1: y0 + c.hM });
  }
  return { wM: W, hM: 2 * c.hM, lines, verticals };
}

/** Tracé d'une période de SOL : `GROUND_ROWS` lignes de rang tremblées, les joints verticaux de
 *  chaque rang (appareillage décalé par parité), et les blocs nuancés CLAIRS/SOMBRES tirés au même
 *  flux que les joints — la variance de pierre appartient à la période, pas à la tuile. */
export interface GroundCoursesPeriod {
  wM: number;
  hM: number;
  lines: CourseLine[];
  verticals: CourseVertical[];
  light: CourseRect[];
  dark: CourseRect[];
}

export function groundCoursesPeriod(c: Courses, key: string): GroundCoursesPeriod {
  const W = 2 * patternWM(c);
  const r = seedStream(hash32('dtground', key));
  const wob = c.edgeWobble ?? 0;
  const lines: CourseLine[] = [];
  for (let row = 0; row < GROUND_ROWS; row++) lines.push(wobbledLine(row * c.hM, W, wob, r));
  const verticals: CourseVertical[] = [];
  const light: CourseRect[] = [];
  const dark: CourseRect[] = [];
  if (c.blockWM) {
    const [wMin, wMax] = c.blockWM;
    const mean = (wMin + wMax) / 2;
    for (let row = 0; row < GROUND_ROWS; row++) {
      const y0 = row * c.hM;
      const rr = seedStream(hash32('dtgrow', key, row));
      let u = row % 2 === 1 ? -(c.stagger ?? 0) * mean : 0;
      let prev = Math.max(0, u);
      for (;;) {
        u += wMin + rr() * (wMax - wMin);
        if (u >= W - 0.05) break;
        if (u > 0.05) {
          verticals.push({ u, y0, y1: y0 + c.hM });
          if (c.paletteVar) {
            const rv = rr();
            if (rv < ACCENT_FRAC || rv > 1 - ACCENT_FRAC) {
              const rect: CourseRect = {
                u0: prev + BLOCK_INSET_M,
                v0: y0 + BLOCK_INSET_M,
                u1: u - BLOCK_INSET_M,
                v1: y0 + c.hM - BLOCK_INSET_M,
              };
              (rv < ACCENT_FRAC ? light : dark).push(rect);
            }
          }
          prev = u;
        }
      }
    }
  }
  return { wM: W, hM: GROUND_ROWS * c.hM, lines, verticals, light, dark };
}
