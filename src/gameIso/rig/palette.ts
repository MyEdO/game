/**
 * PALETTE SÉMANTIQUE du rig — personnalisation de couleur cohérente, applicable à tout.
 *
 * Les parts (tenues, visage/cheveux, parts monstrueuses) référencent des CLÉS DE PALETTE
 * (`clesDePalette.ts`) au lieu de couleurs en dur : `@peau`, `@cheveux`, `@vet1` (vêtement principal),
 * `@vet2` (secondaire), `@cuir`, `@metal`. Au moment de composer le rig, `buildTokenMap` +
 * `applyTokenMap` remplacent ces jetons par les couleurs résolues. Chaque clé porte une GAMME : sa
 * base, son ombre `<clé>O` et sa lumière `<clé>H`. Un DÉGRADÉ DÉRIVÉ `url(#dg-<forme>-@<clé>-@<clé>…)`
 * se résout dans la même passe (#1903 D2). Résolu en hex (pas de var() CSS) → marche en navigateur ET
 * en rendu headless (resvg).
 */
import type { PartArt } from './parts/types';
import { SLOTS, PORTEUR, gammes, type Gamme, type Slot } from '../../data/palette.types';
import { CLES, COUCHE_DEFAUT, SUIVEUSES, propagerSuiveuses, type BaseDeTable, type BasePorteur } from './clesDePalette';
import { parseHex, toHex, shade, LUMA_709 } from '../shade';

export { SLOTS, type Slot };

/** Surcharge du joueur, par clé recoloriable. Tout est optionnel. */
export type Palette = { [K in Slot]?: string };

/** Rôles de la gamme hors base : ombre `O` et lumière `H`, facteur de dérivation et signe de ΔL. */
const ROLES: readonly [suffix: 'O' | 'H', factor: number, signe: -1 | 1][] = [['O', 0.78, -1], ['H', 1.18, 1]];

/** Luminance Rec.709 ramenée sur 0..100 (jamais 0..255) : l'échelle du contrat de VOLUME rendu
 *  (#635, #638, `qc-contrat.ts`), mesuré sur les pixels. L'ORDRE d'une gamme se mesure en clarté
 *  HSL (`versHsl`). */
export function lum(r: number, g: number, b: number): number {
  return ((LUMA_709.r * r + LUMA_709.g * g + LUMA_709.b * b) / 255) * 100;
}

/** Hex `#rrggbb` → octets [r, g, b] 0..255 (`parseHex`) ; lève hors format. */
function octets(hex: string): [number, number, number] {
  const c = parseHex(hex);
  if (!c) throw new Error(`couleur hors format #rrggbb : ${hex}`);
  return c;
}

/** Hex `#rrggbb` → canaux [r, g, b] 0..1. */
function canaux(hex: string): [number, number, number] {
  const [r, g, b] = octets(hex);
  return [r / 255, g / 255, b / 255];
}

/** Clarté HSL QUANTIFIÉE, entière : `max + min` des octets (0..510). */
export function clarte8(hex: string): number {
  const c = octets(hex);
  return Math.max(...c) + Math.min(...c);
}

/** Chroma `max(r,g,b) − min(r,g,b)`, canaux 0..1. */
export function chroma(hex: string): number {
  const c = canaux(hex);
  return Math.max(...c) - Math.min(...c);
}

/** Chroma à partir de laquelle une couleur A UNE TEINTE (#1903 D3 point 3, v2.4), en pas 8 bits. */
export const CHROMA_DE_TEINTE = 21 / 255;

/** Hex `#rrggbb` → [teinte 0..360, saturation 0..1, clarté 0..1] (HSL). */
export function versHsl(hex: string): [number, number, number] {
  const [r, g, b] = canaux(hex);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

/** [teinte, saturation, clarté] (HSL) → hex `#rrggbb`. */
function depuisHsl(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s, hp = (((h % 360) + 360) % 360) / 60, x = c * (1 - Math.abs((hp % 2) - 1));
  const [r, g, b] = hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x] : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x];
  return toHex((r + l - c / 2) * 255, (g + l - c / 2) * 255, (b + l - c / 2) * 255);
}

const borne = (v: number) => Math.max(0, Math.min(1, v));

/** Pas 8 bits au plus que la garde d'arrondi d'`ecartReporte` avance (teinte ou rabotage à 255 peuvent
 *  annuler un pas). */
const PAS_D_ARRONDI_MAX = 8;

/**
 * Ombre ou lumière d'une SURCHARGE `s` : l'écart de la gamme de couche (base `b` → `o`) reporté
 * (#1903 D3 point 3, v2.4). Teinte : ΔH reporté si `b` ET `o` ont une teinte (`CHROMA_DE_TEINTE`).
 * Chroma : `C(s)·C(o)/C(b)` si `b` a une teinte, sinon `C(s)`. Clarté : ΔL borné au signe du rôle,
 * mis à l'échelle de la place disponible au-dessus ou au-dessous de `L(s)` ; tant que la clarté
 * QUANTIFIÉE (`clarte8`) égale celle de `s` hors des bornes, elle avance d'un pas 8 bits dans le sens du
 * rôle (`PAS_D_ARRONDI_MAX` pas au plus).
 */
function ecartReporte(s: string, b: string, o: string, signe: -1 | 1): string {
  const [hs, , ls] = versHsl(s), [hb, , lb] = versHsl(b), [ho, , lo] = versHsl(o);
  const teinteB = chroma(b) >= CHROMA_DE_TEINTE, teinteO = chroma(o) >= CHROMA_DE_TEINTE;
  const dl = signe < 0 ? Math.min(lo - lb, 0) : Math.max(lo - lb, 0);
  const c = teinteB ? (chroma(s) * chroma(o)) / chroma(b) : chroma(s);
  const h = hs + (teinteB && teinteO ? ho - hb : 0);
  const rendu = (l: number) => depuisHsl(h, l <= 0 || l >= 1 ? 0 : borne(c / (1 - Math.abs(2 * l - 1))), l);
  let l = borne(dl > 0 ? ls + (dl * (1 - ls)) / (1 - lb) : dl < 0 ? ls + (dl * ls) / lb : ls);
  let hex = rendu(l);
  const ls8 = clarte8(s);
  for (let n = 0; n < PAS_D_ARRONDI_MAX && ls8 > 0 && ls8 < 510 && clarte8(hex) === ls8; n++) hex = rendu((l = borne(l + signe / 255)));
  return hex;
}

/**
 * Palette DÉCLARÉE d'une couche (def de créature, espèce, nuée, navire, artkit…) : des bases de la
 * table (`clesDePalette.ts`) et, le cas échéant, l'ombre et la lumière EXACTES de leur gamme (`vet1O`,
 * `vet1H`…). Une clé hors table est refusée à la compilation.
 */
export type PaletteDeclaree = { [G in Gamme<BaseDeTable>]?: string };

/**
 * Palette d'une couche PORTÉE (tenue, arme, armure) : une `PaletteDeclaree` sans aucune gamme de sorte
 * porteur (`BasePorteur`, `?: never`) — la peau, la chevelure et les yeux viennent de l'espèce.
 */
export type PaletteDeCouchePortee = { [G in Gamme<Exclude<BaseDeTable, BasePorteur>>]?: string } & { [G in Gamme<BasePorteur>]?: never };

function stripUndef(p: Palette): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(p)) if (v != null) out[k] = v;
  return out;
}

/** Indice de la couche la plus haute qui donne la base `k`, -1 si aucune. */
function coucheQuiDonne(pile: readonly Readonly<Record<string, string>>[], k: string): number {
  let i = pile.length - 1;
  while (i >= 0 && pile[i][k] == null) i--;
  return i;
}

/**
 * Table finale jeton→hex du PORTEUR, par couches (#1903 D3) : défaut (`COUCHE_DEFAUT`) < `couches`,
 * de la plus basse à la plus haute < `surcharge`. Chaque couche propage ses clés suiveuses
 * (`propagerSuiveuses`). Pour chaque base de la table (`CLES`), la gamme de COUCHE
 * est celle de la couche la plus haute qui donne la base : son ombre/sa lumière déclarée dans CETTE
 * couche, sinon dérivée de la base. Sous surcharge, la base est la couleur choisie et son ombre/sa
 * lumière reportent l'écart de la gamme de couche (`ecartReporte`) ; une suiveuse suit la surcharge
 * de sa clé suivie, sauf si la couche qui donne sa base la déclare elle-même.
 */
export function buildTokenMap(couches: readonly PaletteDeclaree[], surcharge: Palette = {}): Record<string, string> {
  const declarees: readonly Readonly<Record<string, string>>[] = [COUCHE_DEFAUT, ...couches];
  const pile = declarees.map(propagerSuiveuses);
  const ov = stripUndef(surcharge);
  for (const [f, s] of SUIVEUSES) {
    if (ov[s] == null || ov[f] != null) continue;
    const i = coucheQuiDonne(pile, f);
    if (i < 0 || declarees[i][f] == null) ov[f] = ov[s];
  }
  const out: Record<string, string> = {};
  for (const k of CLES) {
    const i = coucheQuiDonne(pile, k);
    if (i < 0) continue;
    const couche = pile[i];
    const choisie = ov[k];
    out[k] = choisie ?? couche[k];
    for (const [suf, f, signe] of ROLES) {
      const deCouche = couche[k + suf] ?? shade(couche[k], f);
      out[k + suf] = choisie == null ? deCouche : ecartReporte(choisie, couche[k], deCouche, signe);
    }
  }
  return out;
}

/** Surcharges SONDES d'une déclaration : aucune, puis chaque `Slot` sous trois couleurs saturées. */
const SURCHARGES_SONDES: readonly Palette[] = [{}, ...SLOTS.flatMap((s) => ['#ff0000', '#00ff00', '#0000ff'].map((c) => ({ [s]: c })))];

const tablesEgales = (a: Record<string, string>, b: Record<string, string>): boolean =>
  Object.keys(a).length === Object.keys(b).length && Object.keys(a).every((k) => a[k] === b[k]);

/**
 * Déclarations INERTES d'une couche (#1903 A4) : une clé l'est quand la retirer laisse
 * `buildTokenMap([e], s)` identique pour chaque entrée `e` que le rig tire de la couche (`entrees`),
 * comparée à l'entrée de même indice, et chaque surcharge sonde `s` (`SURCHARGES_SONDES`). Des
 * entrées en nombre inégal avec et sans la clé lèvent. Retirées une à une jusqu'au point fixe : une
 * base doublon de la couche défaut part, puis le rôle qu'elle laisse orphelin.
 */
export function declarationsInertes(
  couche: PaletteDeclaree,
  entrees: (c: PaletteDeclaree) => readonly PaletteDeclaree[] = (c) => [c],
): string[] {
  const retirees: string[] = [];
  let reste: Readonly<Record<string, string>> = stripUndef(couche);
  for (;;) {
    const ref = entrees(reste).map((e) => SURCHARGES_SONDES.map((s) => buildTokenMap([e], s)));
    const k = Object.keys(reste).find((cle) => {
      const sans = entrees(Object.fromEntries(Object.entries(reste).filter(([c]) => c !== cle)));
      if (sans.length !== ref.length) throw new Error(`declarationsInertes : ${ref.length} entrée(s) avec « ${cle} », ${sans.length} sans`);
      return sans.every((e, j) => SURCHARGES_SONDES.every((s, i) => tablesEgales(buildTokenMap([e], s), ref[j][i])));
    });
    if (k == null) return retirees;
    retirees.push(k);
    reste = Object.fromEntries(Object.entries(reste).filter(([c]) => c !== k));
  }
}

/** Sorte porteur : une clé de `PORTEUR`, ou une suiveuse (`SUIVEUSES`) d'une clé de sorte porteur. */
const estDeSortePorteur = (k: string): boolean =>
  PORTEUR.some((p) => p === k) || SUIVEUSES.some(([f, s]) => f === k && estDeSortePorteur(s));
const CLES_PORTEUR = CLES.filter(estDeSortePorteur);

/**
 * Table d'un OBJET (arme, armure, bouclier ; #1903 D2) : la même résolution que `buildTokenMap`,
 * sans aucune clé de sorte porteur (`estDeSortePorteur`). Un `@peau` ou un `dg-` à clé porteur de
 * l'art d'un objet traverse cette passe intact et se résout à la passe du porteur.
 */
export function tableDObjet(couches: readonly PaletteDeclaree[], surcharge: Palette = {}): Record<string, string> {
  const out = buildTokenMap(couches, surcharge);
  for (const g of gammes(CLES_PORTEUR)) delete out[g];
  return out;
}

/** Formes du dégradé dérivé `dg-<forme>-…` (#1903 D2) : axe du `<linearGradient>` et arrêts (%),
 *  un arrêt par couleur. Un arrêt est un jeton `@clé` ou un littéral `#rrggbb` (dette de littéral). */
export const FORMES_DE_DEGRADE: Record<string, { axe: string; arrets: readonly number[] }> = {
  v: { axe: 'x1="0" y1="0" x2="0" y2="1"', arrets: [0, 100] },
  v3: { axe: 'x1="0" y1="0" x2="0" y2="1"', arrets: [0, 55, 100] },
};

const DEGRADE_RESOLU = /url\(#dg-([a-z0-9]+)((?:-#[0-9a-fA-F]{6})+)\)/g;

/**
 * Dégradés dérivés d'un fragment dont les `@clé` sont substituées : chaque
 * `url(#dg-<forme>-#h1-#h2…)` entièrement résolu devient `url(#dg-<forme>-h1-h2…)`, et le fragment
 * est préfixé d'un `<defs>` portant chaque `<linearGradient>` utilisé qu'il ne définit pas déjà.
 * L'id est le contenu résolu : deux passes, deux fragments, deux porteurs de même couleur partagent
 * le même id et le même contenu.
 */
function deriverDegrades(svg: string): string {
  const neufs = new Map<string, string>();
  const out = svg.replace(DEGRADE_RESOLU, (whole, forme: string, suite: string) => {
    const f = FORMES_DE_DEGRADE[forme];
    const couleurs = suite.slice(2).toLowerCase().split('-#');
    if (!f || couleurs.length !== f.arrets.length) return whole;
    const id = `dg-${forme}-${couleurs.join('-')}`;
    if (!neufs.has(id) && !svg.includes(`id="${id}"`))
      neufs.set(id, `<linearGradient id="${id}" ${f.axe}>` +
        f.arrets.map((a, n) => `<stop offset="${a}%" stop-color="#${couleurs[n]}"/>`).join('') + '</linearGradient>');
    return `url(#${id})`;
  });
  return neufs.size ? `<defs>${[...neufs.values()].join('')}</defs>${out}` : out;
}

/** Substitue les jetons `@clé`/`@cléO`/`@cléH` d'un fragment SVG via une table prête, puis résout
 *  ses dégradés dérivés (`deriverDegrades`). Un jeton inconnu est laissé tel quel (no-op), et un
 *  `dg-` qui en contient un attend la passe suivante. Construire la table 1× par rig. */
export function applyTokenMap(svg: string, map: Record<string, string>): string {
  if (!svg.includes('@') && !svg.includes('url(#dg-')) return svg;
  return deriverDegrades(svg.replace(/@([a-zA-Z]\w*)/g, (whole, key: string) => map[key] ?? whole));
}

/** Relève `applyTokenMap` sur un `PartArt` : string → substitution directe ; art directionnel →
 *  substitution sur chaque vue présente (les clés absentes restent absentes). No-op sur un art
 *  sans `@token` (préserve l'art verbatim). Source unique pour recolorier un art tenu (arme/bouclier). */
export function applyTokenMapArt(art: PartArt, map: Record<string, string>): PartArt {
  return typeof art === 'string'
    ? applyTokenMap(art, map)
    : {
        front: applyTokenMap(art.front, map),
        ...(art.back !== undefined && { back: applyTokenMap(art.back, map) }),
        ...(art.profile !== undefined && { profile: applyTokenMap(art.profile, map) }),
      };
}
