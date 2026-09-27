/**
 * Gardes de la TEXTURE DE PÉRIODE : la rasterisation logicielle du tracé de `detail/courses` porte bien
 * un MOTIF (et non un aplat), à la densité que la recette annonce, en trois exemplaires distincts, et
 * elle se répète SANS COUTURE (tore). Les attendus se dérivent de la RECETTE lue dans la donnée —
 * jamais récités depuis l'implémentation.
 */
import { describe, expect, it } from 'vitest';
import { periodTextureData, jointFactor, PERIOD_PX_PER_M } from './periodTexture';
import { coursesPeriod, coursesPeriodM, coursesKey, patternWM, N_VARIANTS } from '../../detail/courses';
import { structureAppearance, wallPartColor } from '../../catalog/structures';
import { matieresDe } from '../../../data';
import type { DetailRecipe } from '../../detail/types';

/** Une recette d'appareillage RÉELLE, lue dans la DONNÉE : le mur de pierre (`structureAppearance.json`). */
const APP = structureAppearance('mur-en-pierre');
const PIERRE = APP.detail as DetailRecipe;
const BASE = wallPartColor(APP, 'face');

/** Luminance (0..255) du pixel (x,y). */
const lum = (t: { data: Uint8Array; w: number }, x: number, y: number) => t.data[(y * t.w + x) * 4];

/** Part des pixels du masque strictement sous le plein (= dessinés : joints, blocs sombres). */
function partDessinée(t: { data: Uint8Array; w: number; h: number }): number {
  let n = 0;
  for (let i = 0; i < t.w * t.h; i++) if (t.data[i * 4] < 255) n++;
  return n / (t.w * t.h);
}

const cuire = (variant = 0, recipe: DetailRecipe = PIERRE) =>
  periodTextureData(recipe, variant, PERIOD_PX_PER_M, { baseColor: BASE })!;

describe('periodTextureData — un MASQUE de période, pas un aplat', () => {
  it('la recette-témoin porte bien des assises (sinon la garde ne mesure rien)', () => {
    expect(PIERRE.courses).toBeTruthy();
    expect(PIERRE.courses!.blockWM).toBeTruthy();
  });

  it('une recette SANS assises ne cuit aucune texture', () => {
    expect(periodTextureData({ seedScope: 'edge' }, 0, PERIOD_PX_PER_M, { baseColor: BASE })).toBeNull();
  });

  it('le masque est non vide, en puissances de 2, et porte la période MÉTRIQUE de la recette', () => {
    const t = cuire();
    const attendu = coursesPeriodM(PIERRE.courses!);
    expect(t.periodM).toEqual(attendu);
    expect(t.data.length).toBe(t.w * t.h * 4);
    expect(Math.log2(t.w) % 1).toBe(0);
    expect(Math.log2(t.h) % 1).toBe(0);
    // Rapport d'aspect : la période est plus LARGE que haute (patternWM vs 2 rangs).
    expect(t.w).toBeGreaterThan(t.h);
  });

  it('le masque MODULE : du plein (255) ET du dessiné, jamais un aplat', () => {
    const t = cuire();
    let max = 0;
    let min = 255;
    for (let i = 0; i < t.w * t.h; i++) {
      max = Math.max(max, t.data[i * 4]);
      min = Math.min(min, t.data[i * 4]);
    }
    expect(max).toBe(255);
    expect(min).toBeLessThan(255);
    // Le joint descend au RAPPORT de la donnée (joint ÷ base), canal par canal, à l'arrondi 8 bits près.
    expect(min).toBe(Math.round(255 * jointFactor(PIERRE.courses!.joint, BASE)[0]));
  });

  it('la part de joint tient dans la fourchette DÉRIVÉE de la recette (longueur × épaisseur ÷ aire)', () => {
    const c = PIERRE.courses!;
    const t = cuire();
    const per = coursesPeriodM(c);
    const p = coursesPeriod(c, coursesKey(c), 0);
    // Longueur dessinée : 2 lignes de rang sur toute la largeur + un joint vertical par borne.
    const longueur = 2 * patternWM(c) + p.verticals.length * c.hM;
    const attendu = (longueur * c.jointW) / (per.u * per.v);
    const mesuré = partDessinée(t);
    expect(mesuré).toBeGreaterThan(0.5 * attendu);
    expect(mesuré).toBeLessThan(2.5 * attendu);
  });

  it('les 3 variantes sont deux à deux DISTINCTES (l’anti-périodicité a de quoi mordre)', () => {
    const cuites = Array.from({ length: N_VARIANTS }, (_, v) => cuire(v));
    for (let a = 0; a < cuites.length; a++)
      for (let b = a + 1; b < cuites.length; b++)
        expect(Buffer.from(cuites[a].data).equals(Buffer.from(cuites[b].data)), `variantes ${a} et ${b}`).toBe(false);
  });
});

describe('periodTextureData — CONTINUITÉ de répétition (le masque est un tore)', () => {
  /** Écart moyen de luminance entre deux colonnes. */
  function écartColonnes(t: { data: Uint8Array; w: number; h: number }, x0: number, x1: number): number {
    let s = 0;
    for (let y = 0; y < t.h; y++) s += Math.abs(lum(t, x0, y) - lum(t, x1, y));
    return s / t.h;
  }
  it('le bord DROIT prolonge le bord GAUCHE (aucun joint vertical ne touche la couture)', () => {
    const t = cuire();
    let pire = 0;
    for (let x = 0; x + 1 < t.w; x++) pire = Math.max(pire, écartColonnes(t, x, x + 1));
    expect(pire).toBeGreaterThan(0); // le motif a bien des transitions INTERNES
    expect(écartColonnes(t, t.w - 1, 0)).toBeLessThanOrEqual(pire);
  });

  it('le bord BAS prolonge le bord HAUT : la ligne de rang de v=0 est ENTIÈRE à la couture', () => {
    const t = cuire();
    // Le tracé de période ne pose de ligne de rang qu'en v = 0 et v = hM : sous la seconde, le bas de la
    // période est PLEIN — sauf la moitié basse de la ligne de v = 0, qui s'y écrit MODULO la hauteur.
    // Mesuré : 58,6 % de la dernière ligne dessinée (0 % si le stamp cesse de boucler, et la couture
    // affiche alors un rang de demi-épaisseur).
    const partDessinéeLigne = (y: number) => {
      let n = 0;
      for (let x = 0; x < t.w; x++) if (lum(t, x, y) < 255) n++;
      return n / t.w;
    };
    expect(partDessinéeLigne(t.h - 1)).toBeGreaterThan(0.3);
    // …alors qu'à mi-chemin du bord bas, seuls les joints VERTICAUX du rang y passent : c'est bien la
    // couture qui porte la ligne de rang, pas un dessin qui déborderait partout.
    expect(partDessinéeLigne(t.h - 1 - Math.round(t.h / 4))).toBeLessThan(0.25);
  });
});

describe('periodTextureData — AUCUN pan ne se cuit en APLAT, quel que soit le côté', () => {
  /** Amplitude du masque (max − min sur les 3 canaux) : 0 = aplat, la surface ne montre AUCUN joint. */
  function amplitude(t: { data: Uint8Array; w: number; h: number }): number {
    let min = 255;
    let max = 0;
    for (let i = 0; i < t.w * t.h; i++)
      for (let c = 0; c < 3; c++) {
        const v = t.data[i * 4 + c];
        if (v < min) min = v;
        if (v > max) max = v;
      }
    return max - min;
  }

  it('les 4 pans de chaque matériau de TOIT à assises portent leur joint (un mortier plus CLAIR aussi)', () => {
    const pans = matieresDe('roof').filter((m) => (m.detail as DetailRecipe | undefined)?.courses);
    expect(pans.length).toBeGreaterThan(0);
    let mesurés = 0;
    for (const m of pans)
      for (const côté of ['N', 'E', 'S', 'O'] as const) {
        const base = (m as unknown as Record<string, string | undefined>)[côté];
        if (!base) continue;
        mesurés++;
        const t = periodTextureData(m.detail as DetailRecipe, 0, PERIOD_PX_PER_M, { kind: 'wall', baseColor: base })!;
        // Le côté SUD des trois matériaux porte un joint PLUS CLAIR que son pan (rapports 1,04 à 1,19) :
        // un plafond à 1 y rendait un masque uniforme, soit 80 à 85 % d'aplat sur la planche.
        expect([`${m.id}.${côté}`, amplitude(t) > 0]).toEqual([`${m.id}.${côté}`, true]);
      }
    expect(mesurés).toBeGreaterThanOrEqual(4 * pans.length);
  });
});
