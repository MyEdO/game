/**
 * ORDRE DES GAMMES, en clarté L de HSL QUANTIFIÉE (`clarte8`, entière ; #1903 D3, contrat de #638) :
 * l'ombre d'une gamme est plus sombre que sa base, sa lumière plus claire.
 *  (a) DONNÉE, sans surcharge : `L(ombre) < L(base) < L(lumière)` STRICT pour chaque gamme de chaque
 *      palette déclarée que reçoit `buildTokenMap`, toutes familles d'art (`palettesDeclarees`).
 *  (b) SURCHARGE (`SURCHARGES` : primaires, cas d'arrondi du juge, gris de `GRIS`) : l'écart reporté
 *      préserve cet ordre, strict hors de la borne (`L(s) = 1` : lumière = base ; `L(s) = 0` :
 *      ombre = base).
 *  (c) DONNÉE : aucune ombre ni lumière déclarée n'INVERSE la chromaticité de sa base — angle entre
 *      les vecteurs `ab` Oklab de la base et du rôle > `ANGLE_D_INVERSION` avec `|Δab|` >
 *      `SAUT_CHROMATIQUE` (#1903 v2.4).
 * Angle mort de (c) : une ombre ou une lumière d'une autre matière DE MÊME TEINTE (pointe dorée sous
 * une corde ivoire) échappe à toute garde de couleur ; elle relève de la lecture de l'art (#1903 D7).
 * Le VOLUME rendu se mesure à part, en luminance Rec.709 (`lum`, `scripts/qc/mesure-volume.mts`).
 */
import { describe, it, expect } from 'vitest';
import { buildTokenMap, clarte8, SLOTS } from '../../palette';
import { parseHex, srgbToLinear, toHex } from '../../../shade';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { palettesDeclarees, modulesDuRig, CLE_DE_PALETTE } from '../../../../../scripts/guards/lib/palettesDeclarees';

const PALETTES = await palettesDeclarees();
const ANGLE_D_INVERSION = 90;
const SAUT_CHROMATIQUE = 0.05;

/** Hex → vecteur `ab` d'Oklab (Björn Ottosson, 2020). */
function abOklab(hex: string): [number, number] {
  const [r, g, b] = (parseHex(hex) ?? [0, 0, 0]).map(srgbToLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}

/** Inversion de chromaticité de `b` vers `o` : angle `ab` > `ANGLE_D_INVERSION` et saut > `SAUT_CHROMATIQUE`. */
function inverse(b: string, o: string): boolean {
  const [ab, bb] = abOklab(b), [ao, bo] = abOklab(o);
  const norme = Math.hypot(ab, bb) * Math.hypot(ao, bo);
  const angle = (Math.acos(Math.max(-1, Math.min(1, norme ? (ab * ao + bb * bo) / norme : 1))) * 180) / Math.PI;
  return angle > ANGLE_D_INVERSION && Math.hypot(ab - ao, bb - bo) > SAUT_CHROMATIQUE;
}
/** Gris de (b) : un octet sur `PAS_GRIS`, plus 0, 1, 254, 255. */
const PAS_GRIS = 8;
const GRIS = Array.from({ length: 256 }, (_, v) => v)
  .filter((v) => v % PAS_GRIS === 0 || v <= 1 || v >= 254)
  .map((v) => toHex(v, v, v));
const SURCHARGES = ['#ffffff', '#000000', '#ff0000', '#00ff00', '#ffff00', '#feadac', '#d3bd56', '#78ba5d', ...GRIS];
const clarte = clarte8;
const basesDe = (p: Readonly<Record<string, string>>) => [...new Set(Object.keys(p).map((k) => k.replace(/(O|H)$/, '')))];

/** Fautes d'ordre de la gamme `k` d'une table ; l'égalité à la base n'est admise qu'à la borne (L = 0 ou 1). */
function fautesDOrdre(m: Record<string, string>, k: string): string[] {
  const [lo, lb, lh] = [m[`${k}O`], m[k], m[`${k}H`]].map(clarte);
  const fautes: string[] = [];
  const egaliteOmbre = lb === 0 && lo === 0, egaliteLumiere = lb === 510 && lh === 510;
  if (!(lo < lb || egaliteOmbre)) fautes.push(`${k}O ${m[`${k}O`]} (L8=${lo}) ≥ base ${m[k]} (L8=${lb})`);
  if (!(lh > lb || egaliteLumiere)) fautes.push(`${k}H ${m[`${k}H`]} (L8=${lh}) ≤ base ${m[k]} (L8=${lb})`);
  return fautes;
}

describe('ordre des gammes, clarté HSL (#1903 D3)', () => {
  it('l’inventaire porte toute palette littérale déclarée dans le source du rig (`CLE_DE_PALETTE`)', () => {
    const signature = (entrees: [string, string][]) => JSON.stringify(entrees.map(([k, v]) => [k, v.toLowerCase()]).sort());
    const inventaire = new Set(PALETTES.map(({ palette }) => signature(Object.entries(palette))));
    const DECLARATION = /(?:\b(\w+)\s*:|\bconst\s+(\w+)\s*(?::[^=]+)?=)\s*(\{[^{}]*\})/g;
    const ENTREE = /(['"]?)([\w-]+)\1\s*:\s*(['"])([^'"]*)\3/g;
    const sansCommentaire = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    let lues = 0;
    const absentes = modulesDuRig().flatMap((rel) => [...sansCommentaire(readFileSync(resolve(__dirname, '../..', rel), 'utf8')).matchAll(DECLARATION)].flatMap(([, cle, nom, corps]) => {
      if (!CLE_DE_PALETTE.test(cle ?? nom)) return [];
      const entrees = [...corps.matchAll(ENTREE)].map(([, , k, , v]) => [k, v] as [string, string]);
      const toutesHex = entrees.length > 0 && entrees.length === corps.slice(1, -1).split(',').filter((e) => e.trim()).length && entrees.every(([, v]) => /^#[0-9a-f]{6}$/i.test(v));
      if (!toutesHex) return [];
      lues++;
      return inventaire.has(signature(entrees)) ? [] : [`${rel} ${cle ?? nom}`];
    }));
    expect(absentes).toEqual([]);
    expect(lues).toBeGreaterThan(PALETTES.length / 2);
  });

  describe('(a) donnée, sans surcharge : L(ombre) < L(base) < L(lumière) strict', () => {
    for (const { ou, palette } of PALETTES)
      it(ou, () => {
        const m = buildTokenMap([palette]);
        const fautes = basesDe(palette).flatMap((k) => {
          const [lo, lb, lh] = [m[`${k}O`], m[k], m[`${k}H`]].map(clarte);
          return lo < lb && lb < lh ? [] : [`${k} : O ${m[`${k}O`]} L8=${lo}, base ${m[k]} L8=${lb}, H ${m[`${k}H`]} L8=${lh}`];
        });
        expect(fautes).toEqual([]);
      });
  });

  it('(c) donnée : aucune ombre ni lumière déclarée n’inverse la chromaticité de sa base (Oklab)', () => {
    const prises = PALETTES.flatMap(({ ou, palette }) => Object.entries(palette).flatMap(([k, o]) => {
      const m = /^(.+)(O|H)$/.exec(k);
      const b = m ? palette[m[1]] : undefined;
      return b != null && inverse(b, o) ? [`${ou} ${k} : base ${b}, rôle ${o}`] : [];
    }));
    expect(prises).toEqual([]);
  });

  describe(`(b) sous surcharge (${SURCHARGES.length} couleurs) : ordre préservé, strict hors de la borne`, () => {
    for (const { ou, palette } of PALETTES)
      it(ou, () => {
        const fautes = SLOTS.flatMap((k) => SURCHARGES.flatMap((s) =>
          fautesDOrdre(buildTokenMap([palette], { [k]: s }), k).map((f) => `surcharge ${k}=${s} : ${f}`)));
        expect(fautes).toEqual([]);
      });
  });
});
