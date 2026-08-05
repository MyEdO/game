/**
 * MESURE DE VOLUME DU RIG — harnais CANONIQUE du contrat d'art (écart de luminance sur le
 * rendu COMPOSÉ). Artiste et juge invoquent CE fichier ; aucun script de mesure jetable.
 *
 *   npx tsx scripts/qc/mesure-volume.mts <tenueId> [--slot bras] [--views front,profile,back]
 *                                        [--json] [--with-flesh] [--no-erode]
 *   npx tsx scripts/qc/mesure-volume.mts --all [--ids <a,b,c>] [--slot bras] [--views …] [--json] …
 *     (sweep de tout `SPECIFIC_TENUES` — mêmes réglages/métriques que le mode mono, ligne par
 *     tenue×vue. `--ids` restreint le sweep à une liste explicite, pour découper en tranches.)
 *   npx tsx scripts/qc/mesure-volume.mts --creature <id> [--os tronc,tete] [--views …] [--json]
 *     (plan QUADRUPÈDE/AILÉ : même définition de masque, par GROUPE D'OS, + PLATITUDE LOCALE
 *     fenêtrée — compte, amas 4-connexes, carte, bandes. Cf. § MODE CRÉATURE plus bas.)
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * DÉFINITION DU MASQUE (il n'en existe qu'une — toute divergence de chiffre vient d'ici)
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * 1. RIG DE RÉFÉRENCE figé et déterministe : Humain M, build 0.55, seed 4, pose de repos,
 *    aucune arme ni armure (`REF_APPEARANCE` / `REF_EQUIP`). Même rig que la galerie
 *    `scripts/gen-tenue-views-gallery.mts`. viewBox 120×150, rendu à `RENDER_W` px de large
 *    (`PX_PER_U` px par unité SVG).
 * 2. OS DU SLOT : `SLOT_BONES[slot]` (`src/gameIso/rig/bones.ts`). L'art d'un slot est porté
 *    ENTIÈREMENT par ces os (composeRig.tsx l.184-195) : le slot `bras` = `epauleG`+`epauleD`.
 * 3. VISIBILITÉ RÉELLE : un pixel n'entre dans le masque que si la couleur RGB du rendu
 *    COMPOSÉ y égale exactement celle du rendu des SEULS os du masque. L'occlusion (par le
 *    torse, une cape, une arme) sort donc du masque — on ne mesure que ce qui se voit.
 * 4. CHAIR EXCLUE PAR DÉFAUT. Une tenue n'habille pas la chair de son porteur : elle ne peut
 *    pas lui emprunter son volume. Les os `mainG`/`mainD`/`piedG`/`piedD` (`FLESH_BONES`)
 *    restent HORS masque. `--with-flesh` adjoint au slot sa chair terminale
 *    (`SLOT_FLESH`) — la sortie porte alors la mention `chair=INCLUSE`.
 * 5. ÉROSION PAR DÉFAUT de `ERODE_U` unité SVG (chebyshev, 8-voisins, `ERODE_PX` itérations
 *    d'un pixel). Le cerne n'est pas du volume : un cerne de 0,7 u ne pèse que 0,19 px sur un
 *    token de 40 px, mais il domine les extrêmes de luminance. `--no-erode` le désactive.
 * 6. Chaque nombre rendu porte les trois réglages qui l'ont produit (masque, érosion, chair).
 *
 * MÉTRIQUES, par vue :
 *  - P90 / P10 / P90−P10 de luminance Rec.709 ramenée sur 0..100 (échelle du contrat).
 *  - Part claire : % des pixels du masque au-dessus de la mi-distance entre la valeur de BASE
 *    de la matière dominante (jeton `@vetN`/`@cuir`/… résolu) et sa valeur de LUMIÈRE (`…H`).
 *    Diagnostic le plus robuste : un P90 posé exactement sur la valeur de base = aucune
 *    surface éclairée. Part sombre (miroir, #638 volet B) : % des pixels sous la mi-distance
 *    base↔OMBRE (`…O`) — seule mesure exprimable pour une matière quasi-blanche.
 *  - Composantes connexes (8-voisins) de la figure ENTIÈRE : une masse détachée est un défaut
 *    bloquant. bbox des surnuméraires en unités SVG.
 *  - Séparation slot↔torse : |ΔL| sur les pixels de frontière (médiane et p10). Un p10 à 0
 *    signifie qu'une part de la frontière n'a aucune différence de valeur.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * CONTRAT (ÉNONCÉ UNIQUE — le harnais RÉFUTE, il ne certifie JAMAIS ; code : `qc-contrat.ts`)
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * Une vue mesurable (matière trouvée, masque non vide) est réfutée (`ECHEC`) si sa palette est
 * SAINE (`lLumiere > lBase`) ET que l'une des conditions suivantes tient — CONJONCTION
 * écart∧part-claire, ancrée sur la palette :
 *  - écart P90−P10 < `CONTRAT_ECART_MIN` — pas assez de plage de luminance ;
 *  - part claire   < `CONTRAT_CLAIR_MIN` — aucune surface franchement éclairée ;
 *  - `p90SurBase` (« ancrage ») — le P90 est posé exactement sur la valeur de base, cause
 *    explicite même si `CONTRAT_CLAIR_MIN` la subsume déjà (diagnostic le plus lisible).
 * Palette INVERSÉE (`lLumiere <= lBase`) → `ECHEC palette inversée` à part : le contrat y est
 * inexprimable, c'est un défaut de DONNÉE, pas de rendu — les trois causes ci-dessus ne
 * s'évaluent PAS dans ce cas. Matière introuvable ou masque vide → `NON MESURABLE` : ni succès
 * ni échec, à instruire par un juge, n'affecte PAS l'exit code. Sinon → `NON-REFUTE` — jamais
 * « BON » : le harnais ne voit qu'un histogramme de pixels, jamais le rendu ; le verdict humain
 * vient d'un juge qui a REGARDÉ l'image (#635).
 * CLAUSE QUASI-BLANC (#638 volet B) : une matière de base ≥ `CONTRAT_QUASI_BLANC_BASE_MIN` ne
 * peut structurellement pas atteindre la part claire (aucune surface plus claire qu'une base déjà
 * quasi-blanche) — son volume s'y prouve par l'OMBRE, miroir symétrique : part SOMBRE (< seuil
 * base↔ombre) à la place de part claire, `p10SurBase` (« ancrage » bas) à la place de `p90SurBase`.
 */
import { inflateSync } from 'node:zlib';
import { Resvg } from '@resvg/resvg-js';
import { resolveRig, type ResolvedBone } from '../../src/gameIso/rig/composeRig';
import { toSvg } from '../../src/gameIso/rig/kinematics';
import { SLOT_BONES, type BoneId, type Slot } from '../../src/gameIso/rig/bones';
import { buildTokenMap, lum, SLOTS } from '../../src/gameIso/rig/palette';
import type { PartArt } from '../../src/gameIso/rig/parts/types';
import { DEFS } from '../../src/gameIso/sprites';
import { TENUE_BY_ID, TENUE_PALETTE_BY_ID, SPECIFIC_TENUES, CLASS_TENUE_BY_ID } from '../../src/gameIso/rig/parts/tenues';
import { slugId } from '../../src/data/slug';
import type { Appearance, RigSpeciesId } from '../../src/gameIso/rig/appearance';
import type { View } from '../../src/gameIso/rig/facing';
import { computeVerdict, CONTRAT_ECART_MIN, CONTRAT_CLAIR_MIN, CONTRAT_QUASI_BLANC_BASE_MIN, type Verdict } from '../../src/gameIso/rig/qc-contrat';
import { QUAD_SPECIES, WINGED_SPECIES } from '../../src/gameIso/rig/creatures';
import { resolveQuadFromProps } from '../../src/gameIso/rig/quadruped/composeQuad';
import { QUAD_REST } from '../../src/gameIso/rig/quadruped/quadPose';
import type { QuadBoneId } from '../../src/gameIso/rig/quadruped/quadSkeleton';

// ── Rig de référence (figé) ───────────────────────────────────────────────────────────────
const REF_APPEARANCE: Appearance = { species: 'Humain' as RigSpeciesId, sex: 'M', build: 0.55, seed: 4 };
const REF_EQUIP = { weapons: [], armour: [] };
const VB_W = 120, VB_H = 150;
const RENDER_W = 480;
const PX_PER_U = RENDER_W / VB_W;
const RENDER_H = Math.round(VB_H * PX_PER_U);
/** Érosion du masque, en unités SVG. Le cerne d'une part fait ~0,7 u. */
const ERODE_U = 1;
const ERODE_PX = Math.round(ERODE_U * PX_PER_U);
/** Opacité minimale pour qu'un pixel COMPTE dans un masque de mesure (couleur fiable). */
const ALPHA_MIN = 200;
/** Opacité minimale pour la CONNEXITÉ de la figure — un vrai détachement laisse du fond pur. */
const ALPHA_FIG = 8;

/** Os de CHAIR — jamais dans un masque de tenue sans `--with-flesh`. */
const FLESH_BONES: BoneId[] = ['mainG', 'mainD', 'piedG', 'piedD'];
/** Chair TERMINALE adjointe à un slot par `--with-flesh`. */
const SLOT_FLESH: Partial<Record<Slot, BoneId[]>> = {
  bras: ['mainG', 'mainD'],
  jambes: ['piedG', 'piedD'],
};

// ── CLI ───────────────────────────────────────────────────────────────────────────────────
const USAGE = 'usage: npx tsx scripts/qc/mesure-volume.mts (<tenueId> | --all [--ids a,b,c] | --creature <id> [--os tronc,tete]) [--slot bras] [--views front,profile,back] [--json] [--with-flesh] [--no-erode]';
const argv = process.argv.slice(2);
const flag = (n: string) => argv.includes(n);
function opt(n: string): string | undefined {
  const i = argv.indexOf(n);
  return i >= 0 ? argv[i + 1] : undefined;
}
const positional = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && ['--slot', '--views', '--ids', '--creature', '--os'].includes(argv[i - 1])));
const tenueArg = positional[0];
const allMode = flag('--all');
const slot = (opt('--slot') ?? 'bras') as Slot;
const views = (opt('--views') ?? 'front,profile,back').split(',').map((v) => v.trim()) as View[];
const asJson = flag('--json');
const withFlesh = flag('--with-flesh');
const erode = !flag('--no-erode');
const idsArg = opt('--ids');
/** Porte CRÉATURE : le même harnais, appliqué au plan quadrupède/ailé (cf. § MODE CRÉATURE). */
const creatureArg = opt('--creature');
const osArg = opt('--os');

function die(msg: string): never {
  console.error(msg);
  process.exit(1);
}
if (tenueArg && allMode) die(`${USAGE}\n--all et <tenueId> sont exclusifs.`);
if (creatureArg && (tenueArg || allMode)) die(`${USAGE}\n--creature ne se combine ni avec <tenueId> ni avec --all.`);
if (!tenueArg && !allMode && !creatureArg) die(USAGE);
if (idsArg && !allMode) die(`${USAGE}\n--ids nécessite --all.`);
if (osArg && !creatureArg) die(`${USAGE}\n--os nécessite --creature.`);
if (!SLOT_BONES[slot]) die(`slot inconnu: ${slot} — attendus: ${Object.keys(SLOT_BONES).join(', ')}`);
for (const v of views) if (!['front', 'profile', 'back'].includes(v)) die(`vue inconnue: ${v} — attendues: front, profile, back`);

// `tenueId` est un ID (slugId), jamais un libellé : un lookup par libellé replie silencieusement
// sur la tenue citadins (incident corrigé en a1fcfe6c).
if (!allMode && !creatureArg && !TENUE_BY_ID[tenueArg]) {
  const asId = slugId(tenueArg);
  if (TENUE_BY_ID[asId]) die(`« ${tenueArg} » est un LIBELLÉ, pas un id. Relancer avec l'id : ${asId}`);
  if (CLASS_TENUE_BY_ID[asId]) die(`« ${tenueArg} » est un ARCHÉTYPE DE CLASSE (repli), pas une tenue spécifique — le harnais mesure les tenues de \`SPECIFIC_TENUES\`.`);
  const near = SPECIFIC_TENUES.filter((t) => t.id.includes(asId.slice(0, 5)) || asId.includes(t.id.slice(0, 5))).slice(0, 6);
  die(`tenue inconnue: ${tenueArg}` + (near.length ? `\nproches: ${near.map((t) => `${t.id} (${t.label})`).join(', ')}` : `\n${SPECIFIC_TENUES.length} tenues disponibles.`));
}

/** Liste des tenues à mesurer — 1 en mode mono, N en `--all` (bornée par `--ids`). */
let tenueIds: string[];
if (allMode) {
  if (idsArg) {
    tenueIds = idsArg.split(',').map((s) => s.trim()).filter(Boolean);
    for (const id of tenueIds) if (!SPECIFIC_TENUES.some((t) => t.id === id)) die(`id inconnu pour --ids: ${id}`);
  } else {
    tenueIds = SPECIFIC_TENUES.map((t) => t.id);
  }
} else {
  tenueIds = creatureArg ? [] : [tenueArg];
}
const tenueLabelOf = (id: string) => SPECIFIC_TENUES.find((t) => t.id === id)?.label ?? id;

const maskBones = new Set<BoneId>([
  ...SLOT_BONES[slot],
  ...(withFlesh ? SLOT_FLESH[slot] ?? [] : []),
]);
const slotIsFlesh = SLOT_BONES[slot].every((b) => FLESH_BONES.includes(b));
if (!withFlesh) for (const b of FLESH_BONES) if (!slotIsFlesh) maskBones.delete(b);

// ── PNG (RGBA 8-bit, sortie resvg) ────────────────────────────────────────────────────────
interface Img { w: number; h: number; data: Buffer }
function decodePng(buf: Buffer): Img {
  let off = 8, w = 0, h = 0;
  const idat: Buffer[] = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      if (data[8] !== 8 || data[9] !== 6) throw new Error(`attendu RGBA 8-bit, reçu depth=${data[8]} color=${data[9]}`);
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * 4;
  const out = Buffer.alloc(w * h * 4);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? cur[x - 4] : 0, b = prev[x], c = x >= 4 ? prev[x - 4] : 0;
      let v = line[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      cur[x] = v & 0xff;
    }
    cur.copy(out, y * stride);
    prev = cur;
  }
  return { w, h, data: out };
}

// ── Rendu ─────────────────────────────────────────────────────────────────────────────────
const boneGroup = (b: ResolvedBone) =>
  `<g transform="${toSvg(b.matrix)}"><g transform="scale(${b.scale[0].toFixed(4)},${b.scale[1].toFixed(4)})">` +
  b.parts.map((p) => (p.mirror ? `<g transform="scale(-1,1)">${p.svg}</g>` : `<g>${p.svg}</g>`)).join('') +
  '</g></g>';

/** Un `<defs>` local (dégradé de chair par instance) est monté sur un os ; il doit rester présent
 *  dans un rendu ISOLÉ, sinon les parts qui le référencent changent de couleur et l'égalité
 *  composé⇄isolé (règle 3 du masque) échoue à tort. */
const defsOnly = (b: ResolvedBone): ResolvedBone => ({ ...b, parts: b.parts.filter((p) => p.svg.trimStart().startsWith('<defs')) });

function renderPng(bones: ResolvedBone[], keep: (id: string) => boolean): Img {
  const body = bones
    .map((b) => (keep(b.id) ? b : defsOnly(b)))
    .filter((b) => b.parts.length > 0)
    .map(boneGroup)
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB_W} ${VB_H}" width="${VB_W}" height="${VB_H}"><defs>${DEFS}</defs>${body}</svg>`;
  return decodePng(Buffer.from(new Resvg(svg, { fitTo: { mode: 'width', value: RENDER_W }, font: { loadSystemFonts: true } }).render().asPng()));
}

// ── Outils masque ─────────────────────────────────────────────────────────────────────────
const N8 = [-1, 0, 1];
function erodeMask(m: Uint8Array, w: number, h: number, iters: number): Uint8Array {
  let cur = m;
  for (let k = 0; k < iters; k++) {
    const next = new Uint8Array(cur.length);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (!cur[i]) continue;
      let ok = 1;
      for (const dy of N8) for (const dx of N8) if (!cur[(y + dy) * w + (x + dx)]) ok = 0;
      next[i] = ok;
    }
    cur = next;
  }
  return cur;
}
function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return NaN;
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

/** Matière dominante du masque : famille de jeton (base + ombre + lumière) qui couvre le plus de
 *  pixels. Compter la seule BASE désigne la mauvaise matière dès qu'une nappe d'ombre en recouvre
 *  la moitié (cas du dos de manche : la base de robe passait sous le cuir du poignet).
 *  Donne le seuil de « part claire » = mi-distance base↔lumière (`…H`). */
function dominantMaterial(tmap: Record<string, string>, counts: Map<string, number>) {
  const fams = [...new Set(Object.keys(tmap).map((k) => k.replace(/(O|H)$/, '')))];
  let best: { fam: string; hits: number } | null = null;
  for (const fam of fams) {
    const hex = tmap[fam]?.toLowerCase();
    if (!hex || !tmap[`${fam}H`]) continue;
    const hits = ['', 'O', 'H'].reduce((s, suf) => s + (counts.get((tmap[fam + suf] ?? '').toLowerCase()) ?? 0), 0);
    if (!best || hits > best.hits) best = { fam, hits };
  }
  if (!best || best.hits === 0) return null;
  const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
  const lBase = lum(...rgb(tmap[best.fam]));
  const lHi = lum(...rgb(tmap[`${best.fam}H`]));
  const ombreHex = tmap[`${best.fam}O`];
  const lOmbre = ombreHex ? lum(...rgb(ombreHex)) : lBase;
  return { fam: best.fam, lBase, lHi, lOmbre, seuil: (lBase + lHi) / 2, seuilSombre: (lBase + lOmbre) / 2 };
}

// ── Art de tenue au slot (règle STATIQUE, pas de détection au pixel) ─────────────────────────
/** Emplacements de CORPS (chair/anatomie) — le reste de `SLOTS` (`palette.ts`) est TENUE. */
const BODY_SLOTS = new Set(['peau', 'cheveux', 'yeux', 'corps']);
const TENUE_FAM_TOKENS = SLOTS.filter((s) => !BODY_SLOTS.has(s));
const TENUE_TOKEN_RE = new RegExp(`@(${TENUE_FAM_TOKENS.join('|')})(O|H)?\\b`);
/** Un gradient de tenue est tout `url(#g_...)` qui n'est PAS `g_flesh` (chair dynamique, #583). */
const TENUE_GRADIENT_RE = /url\(#g_(?!flesh\b)\w+\)/;

/** Vrai si le fragment SVG référence de l'art de TENUE (jeton de famille vêtement/cuir/métal/accent
 *  ou gradient de tenue) — faux s'il ne référence que de la chair/anatomie (`@peau*`, `@cheveux*`,
 *  `url(#g_flesh)`) ou est absent. */
function fragmentHasTenueArt(svg: string): boolean {
  return TENUE_TOKEN_RE.test(svg) || TENUE_GRADIENT_RE.test(svg);
}

/** Toutes les vues d'un `PartArt` (string = front pour toutes vues). */
function partArtFragments(art: PartArt | undefined): string[] {
  if (art == null) return [];
  if (typeof art === 'string') return [art];
  return [art.front, art.back, art.profile].filter((s): s is string => s != null);
}

/** Slots que `TenueSet` habille réellement (`tenues/types.ts`) — les autres (`pied`, `main`,
 *  `arme`, `bouclier`, `visage`, `cheveux`) ne sont jamais portés par une tenue. */
const TENUE_SET_SLOTS = new Set<Slot>(['torse', 'jambes', 'bras', 'tete']);

/** `slotHasTenueArt` de la tenue×slot courants — absent du `set` OU chair seule → `false`. */
function slotHasTenueArt(tenueId: string, s: Slot): boolean {
  if (!TENUE_SET_SLOTS.has(s)) return false;
  const art = TENUE_BY_ID[tenueId]?.[s as 'torse' | 'jambes' | 'bras' | 'tete'];
  const fragments = partArtFragments(art);
  return fragments.length > 0 && fragments.some(fragmentHasTenueArt);
}

// ── Mesure ────────────────────────────────────────────────────────────────────────────────
interface ViewReport {
  view: View;
  pixels: number;
  p90: number; p10: number; ecart: number;
  matiere: string | null; lBase: number | null; lLumiere: number | null; seuilClair: number | null; partClaire: number | null;
  partSombre: number | null;
  p90SurBase: boolean; p10SurBase: boolean;
  composantes: number;
  surnumeraires: { pixels: number; bbox: [number, number, number, number] }[];
  sepMediane: number | null; sepP10: number | null;
  slotHasTenueArt: boolean;
  verdict: Verdict;
  raisons: string[];
}

/** Mesure UNE tenue×vue. Paramétrée par `tenueId`/`tmap` — aucune variable globale, la définition
 *  du masque et les métriques restent identiques mode mono ↔ `--all`. */
function measure(tenueId: string, tmap: Record<string, string>, view: View): ViewReport {
  const bones = resolveRig(REF_APPEARANCE, REF_EQUIP, {}, tenueId, view, [], false);
  const comp = renderPng(bones, () => true);
  const solo = renderPng(bones, (id) => maskBones.has(id as BoneId));
  const torso = renderPng(bones, (id) => id === 'torse');
  const { w, h } = comp;

  const sameAsComposite = (img: Img): Uint8Array => {
    const m = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const o = i * 4;
      if (img.data[o + 3] < ALPHA_MIN || comp.data[o + 3] < ALPHA_MIN) continue;
      if (img.data[o] === comp.data[o] && img.data[o + 1] === comp.data[o + 1] && img.data[o + 2] === comp.data[o + 2]) m[i] = 1;
    }
    return m;
  };
  const rawMask = sameAsComposite(solo);
  const torsoMask = sameAsComposite(torso);
  const mask = erode ? erodeMask(rawMask, w, h, ERODE_PX) : rawMask;

  // Luminances + histogramme de couleurs exactes du masque.
  const ls: number[] = [];
  const counts = new Map<string, number>();
  for (let i = 0; i < w * h; i++) {
    if (!mask[i]) continue;
    const o = i * 4;
    ls.push(lum(comp.data[o], comp.data[o + 1], comp.data[o + 2]));
    const hex = '#' + [comp.data[o], comp.data[o + 1], comp.data[o + 2]].map((v) => v.toString(16).padStart(2, '0')).join('');
    counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }
  ls.sort((a, b) => a - b);
  const p90 = quantile(ls, 0.9), p10 = quantile(ls, 0.1);
  const mat = dominantMaterial(tmap, counts);
  const partClaire = mat && ls.length ? (ls.filter((l) => l > mat.seuil).length / ls.length) * 100 : null;
  const partSombre = mat && ls.length ? (ls.filter((l) => l < mat.seuilSombre).length / ls.length) * 100 : null;

  // Composantes connexes (8-voisins) de la figure ENTIÈRE. Seuil d'alpha BAS (`ALPHA_FIG`, pas
  // `ALPHA_MIN`) : deux masses qui se touchent ne se joignent que par des pixels d'anticrénelage —
  // à 200 le harnais déclarait « détachés » un capuchon et son col qui se recouvrent. Un vrai
  // détachement laisse du fond PUR (alpha 0) entre les masses.
  const fig = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) if (comp.data[i * 4 + 3] >= ALPHA_FIG) fig[i] = 1;
  const seen = new Uint8Array(w * h);
  const blobs: { n: number; x0: number; y0: number; x1: number; y1: number }[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const s = y * w + x;
    if (!fig[s] || seen[s]) continue;
    const stack = [s]; seen[s] = 1;
    const b = { n: 0, x0: x, y0: y, x1: x, y1: y };
    while (stack.length) {
      const p = stack.pop()!; b.n++;
      const py = (p / w) | 0, px = p % w;
      if (px < b.x0) b.x0 = px; if (px > b.x1) b.x1 = px;
      if (py < b.y0) b.y0 = py; if (py > b.y1) b.y1 = py;
      for (const dy of N8) for (const dx of N8) {
        const qy = py + dy, qx = px + dx;
        if (qx < 0 || qx >= w || qy < 0 || qy >= h) continue;
        const q = qy * w + qx;
        if (fig[q] && !seen[q]) { seen[q] = 1; stack.push(q); }
      }
    }
    if (b.n > 12) blobs.push(b); // sous ce seuil : anticrénelage isolé, pas une masse
  }
  blobs.sort((a, b) => b.n - a.n);
  const u = (px: number) => +(px / PX_PER_U).toFixed(1);

  // Séparation slot↔torse : |ΔL| sur la frontière (masque NON érodé — la frontière est le bord).
  const deltas: number[] = [];
  if (slot !== 'torse') {
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (!rawMask[i]) continue;
      let sum = 0, n = 0;
      for (const dy of N8) for (const dx of N8) {
        const j = (y + dy) * w + (x + dx);
        if (!torsoMask[j]) continue;
        const o = j * 4;
        sum += lum(comp.data[o], comp.data[o + 1], comp.data[o + 2]); n++;
      }
      if (!n) continue;
      const o = i * 4;
      deltas.push(Math.abs(lum(comp.data[o], comp.data[o + 1], comp.data[o + 2]) - sum / n));
    }
  }
  deltas.sort((a, b) => a - b);

  const pixels = ls.length;
  const ecart = +(p90 - p10).toFixed(1);
  const matiere = mat?.fam ?? null;
  const lBase = mat ? +mat.lBase.toFixed(1) : null;
  const lLumiere = mat ? +mat.lHi.toFixed(1) : null;
  const partClaireVal = partClaire === null ? null : +partClaire.toFixed(1);
  const partSombreVal = partSombre === null ? null : +partSombre.toFixed(1);
  const p90SurBase = !!mat && Math.abs(p90 - mat.lBase) < 0.15;
  const p10SurBase = !!mat && Math.abs(p10 - mat.lBase) < 0.15;
  const hasTenueArt = slotHasTenueArt(tenueId, slot);
  const { verdict, raisons } = computeVerdict({
    pixels, matiere, lBase, lLumiere, ecart,
    partClaire: partClaireVal, partSombre: partSombreVal,
    p90SurBase, p10SurBase, slotHasTenueArt: hasTenueArt,
  });

  return {
    view,
    pixels,
    p90: +p90.toFixed(1), p10: +p10.toFixed(1), ecart,
    matiere,
    lBase,
    lLumiere,
    seuilClair: mat ? +mat.seuil.toFixed(1) : null,
    partClaire: partClaireVal,
    partSombre: partSombreVal,
    p90SurBase,
    p10SurBase,
    composantes: blobs.length,
    surnumeraires: blobs.slice(1).map((b) => ({ pixels: b.n, bbox: [u(b.x0), u(b.y0), u(b.x1), u(b.y1)] as [number, number, number, number] })),
    sepMediane: deltas.length ? +quantile(deltas, 0.5).toFixed(1) : null,
    sepP10: deltas.length ? +quantile(deltas, 0.1).toFixed(1) : null,
    slotHasTenueArt: hasTenueArt,
    verdict,
    raisons,
  };
}

// ── Sortie ────────────────────────────────────────────────────────────────────────────────
/** `-` pour tout champ dégénéré (masque vide → NaN/null) — jamais un `NaN` en sortie. */
const dash = (v: number | null): string | number => (v === null || Number.isNaN(v) ? '-' : v);
const pad = (s: string | number, n: number) => String(s).padStart(n);

/** Compteurs de synthèse `--all` : le compte que les audits suivants doivent faire décroître.
 *  `NON MESURABLE` se scinde en LÉGITIME (raison « légitime… » — pas d'art de tenue au slot) et
 *  NON INSTRUIT (raisons vides — échappatoire fermée par #639, doit rester à ZÉRO). */
const tally = { 'NON-REFUTE': 0, ECHEC: 0, 'NON MESURABLE': 0, 'NM légitime': 0, 'NM non instruit': 0 };
let anyEchec = false;
function trackVerdict(v: ViewReport) {
  tally[v.verdict]++;
  if (v.verdict === 'ECHEC') anyEchec = true;
  if (v.verdict === 'NON MESURABLE') {
    if (v.raisons.some((r) => r.startsWith('légitime'))) tally['NM légitime']++;
    else tally['NM non instruit']++;
  }
}

function printViewLine(v: ViewReport, prefix: string) {
  trackVerdict(v);
  const raisonsTxt = v.raisons.length ? ` (${v.raisons.join(', ')})` : '';
  console.log(
    `${prefix}${v.view.padEnd(8)}${pad(dash(v.pixels), 5)} ${pad(dash(v.p90), 6)} ${pad(dash(v.p10), 6)} ${pad(dash(v.ecart), 8)} | ` +
    `${(v.matiere ?? '-').padEnd(8)}${pad(dash(v.lBase), 5)} ${pad(dash(v.lLumiere), 4)} ${pad(dash(v.seuilClair), 6)} ${pad(dash(v.partClaire), 6)} | ` +
    `${pad(v.composantes, 5)} | ${pad(dash(v.sepMediane), 7)} ${pad(dash(v.sepP10), 8)} | ${v.verdict}${raisonsTxt}`,
  );
  for (const s of v.surnumeraires) console.log(`${' '.repeat(prefix.length)}    ⚠ masse détachée: ${s.pixels} px, bbox u[${s.bbox.join(', ')}]`);
}

const HEAD_COLS = 'vue      px      P90    P10  P90-P10 | matiere  base  lum  seuil  clair% | comps | sep med  sep p10 | verdict';

const reglagesCommun = {
  slot,
  masqueOs: [...maskBones].sort(),
  chair: withFlesh ? 'INCLUSE' : 'EXCLUE',
  erosionU: erode ? ERODE_U : 0,
  erosionPx: erode ? ERODE_PX : 0,
  rig: 'Humain M · build 0.55 · seed 4 · sans arme',
  rendu: `${RENDER_W}x${RENDER_H} px (${PX_PER_U} px/u)`,
  echelle: 'luminance Rec.709 sur 0..100',
  contrat: { ecartMin: CONTRAT_ECART_MIN, clairMin: CONTRAT_CLAIR_MIN, quasiBlancBaseMin: CONTRAT_QUASI_BLANC_BASE_MIN },
};

// ─────────────────────────────────────────────────────────────────────────────────────────
// MODE CRÉATURE (`--creature <id> [--os tronc,tete]`) — MÊME définition de masque (règle 3 :
// couleur du composé = couleur du rendu des SEULS os demandés ; érosion 1 u) appliquée au plan
// QUADRUPÈDE/AILÉ, en pose de repos. Ce mode ajoute la PLATITUDE LOCALE FENÊTRÉE, que l'écart
// global ne voit pas : une bête peut afficher 33 pts d'écart P90−P10 avec un dos très structuré
// et une PLAQUE de valeur uniforme à l'épaule (mesure du juge de design, #1082).
//   Réglages DÉCLARÉS, à citer avec TOUT chiffre : fenêtre 11 u, pas 2 u, une fenêtre est RETENUE
//   si ≥ 60 % de ses pixels sont au masque, et PLATE si son P90−P10 y est < 12 pts.
//   Le rapport rend le COMPTE (plates/retenues), les AMAS de fenêtres plates 4-connexes (une
//   fenêtre plate isolée est du modelé qui s'éteint ; un amas contigu est une plaque), la CARTE
//   et les BANDES.
// BANDES — découpage DÉCLARÉ de la boîte du masque (fractions de sa bbox), le profil regardant à
// DROITE (`quadSkeleton`) : `dos` = tiers HAUT ; `flanc+epaule` = deux tiers bas de la moitié
// AVANT ; `ensemble` = tout le masque. Une fenêtre appartient à une bande si son CENTRE y tombe.
// PÉRIMÈTRE du masque : le GROUPE D'OS demandé, sans séparation par matière — un chiffre de ce
// mode n'est comparable qu'à un chiffre du même mode (un relevé antérieur qui excluait la corne
// du bœuf par géométrie compte moins de fenêtres retenues, à réglages pourtant identiques).
// ─────────────────────────────────────────────────────────────────────────────────────────
const PLAT_FENETRE_U = 11, PLAT_PAS_U = 2, PLAT_SEUIL = 12, PLAT_COUV = 0.6;
const BANDES: { nom: string; x0: number; y0: number; x1: number; y1: number }[] = [
  { nom: 'dos', x0: 0, y0: 0, x1: 1, y1: 1 / 3 },
  { nom: 'flanc+epaule', x0: 0.5, y0: 1 / 3, x1: 1, y1: 1 },
  { nom: 'ensemble', x0: 0, y0: 0, x1: 1, y1: 1 },
];

interface Platitude {
  retenues: number;
  plates: number;
  amas: { fenetres: number; bbox: [number, number, number, number] }[];
  bandes: { nom: string; retenues: number; plates: number; part: number | null }[];
  carte: string[];
}

/** Platitude locale fenêtrée d'un masque (réglages ci-dessus). */
function platitude(comp: Img, mask: Uint8Array, w: number, h: number): Platitude {
  const fen = Math.round(PLAT_FENETRE_U * PX_PER_U), pas = Math.round(PLAT_PAS_U * PX_PER_U);
  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (mask[y * w + x]) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  const cols = Math.max(0, Math.floor((x1 - x0 - fen) / pas) + 1), rows = Math.max(0, Math.floor((y1 - y0 - fen) / pas) + 1);
  const plat = new Int8Array(cols * rows).fill(-1); // -1 = couverture insuffisante
  let retenues = 0, plates = 0;
  const bandes = BANDES.map((b) => ({ nom: b.nom, retenues: 0, plates: 0, part: null as number | null }));
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const bx = x0 + c * pas, by = y0 + r * pas;
    const ls: number[] = [];
    for (let y = by; y < by + fen; y++) for (let x = bx; x < bx + fen; x++) {
      const i = y * w + x;
      if (!mask[i]) continue;
      ls.push(lum(comp.data[i * 4], comp.data[i * 4 + 1], comp.data[i * 4 + 2]));
    }
    if (ls.length < PLAT_COUV * fen * fen) continue;
    retenues++;
    ls.sort((a, b) => a - b);
    const estPlate = quantile(ls, 0.9) - quantile(ls, 0.1) < PLAT_SEUIL;
    plat[r * cols + c] = estPlate ? 1 : 0;
    if (estPlate) plates++;
    // Bandes : le CENTRE de la fenêtre, ramené en fractions de la bbox du masque.
    const fx = (bx + fen / 2 - x0) / Math.max(1, x1 - x0), fy = (by + fen / 2 - y0) / Math.max(1, y1 - y0);
    BANDES.forEach((b, k) => {
      if (fx < b.x0 || fx > b.x1 || fy < b.y0 || fy > b.y1) return;
      bandes[k].retenues++;
      if (estPlate) bandes[k].plates++;
    });
  }
  for (const b of bandes) b.part = b.retenues ? +((b.plates / b.retenues) * 100).toFixed(1) : null;
  // Amas 4-connexes de fenêtres plates, rendus en u SVG.
  const vu = new Uint8Array(cols * rows);
  const amas: { fenetres: number; bbox: [number, number, number, number] }[] = [];
  const u = (px: number) => +(px / PX_PER_U).toFixed(1);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const s = r * cols + c;
    if (plat[s] !== 1 || vu[s]) continue;
    const pile = [s]; vu[s] = 1;
    const a = { n: 0, c0: c, r0: r, c1: c, r1: r };
    while (pile.length) {
      const q = pile.pop()!, qr = (q / cols) | 0, qc = q % cols;
      a.n++;
      if (qc < a.c0) a.c0 = qc; if (qc > a.c1) a.c1 = qc; if (qr < a.r0) a.r0 = qr; if (qr > a.r1) a.r1 = qr;
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
        const nr = qr + dr, nc = qc + dc;
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
        const t = nr * cols + nc;
        if (plat[t] === 1 && !vu[t]) { vu[t] = 1; pile.push(t); }
      }
    }
    if (a.n >= 2) amas.push({ fenetres: a.n, bbox: [u(x0 + a.c0 * pas), u(y0 + a.r0 * pas), u(x0 + a.c1 * pas + fen), u(y0 + a.r1 * pas + fen)] });
  }
  amas.sort((a, b) => b.fenetres - a.fenetres);
  const carte: string[] = [];
  for (let r = 0; r < rows; r++) {
    let l = '';
    for (let c = 0; c < cols; c++) l += plat[r * cols + c] === 1 ? '#' : plat[r * cols + c] === 0 ? '.' : ' ';
    carte.push(`${l}  y=${u(y0 + r * pas).toFixed(0)}`);
  }
  return { retenues, plates, amas, bandes, carte };
}

if (creatureArg) {
  const props = QUAD_SPECIES[creatureArg] ?? WINGED_SPECIES[creatureArg];
  if (!props) {
    const noms = [...Object.keys(QUAD_SPECIES), ...Object.keys(WINGED_SPECIES)];
    const near = noms.filter((n) => n.includes(creatureArg.slice(0, 4)) || creatureArg.includes(n.slice(0, 4))).slice(0, 8);
    die(`créature « ${creatureArg} » hors du plan quadrupède/ailé — ce mode ne mesure que ces deux plans (${noms.length} espèces).`
      + (near.length ? `\nproches: ${near.join(', ')}` : ''));
  }
  const osMasque = (osArg ?? 'tronc').split(',').map((s) => s.trim()) as QuadBoneId[];
  const tmap = buildTokenMap(props.stored, {});
  const rapport = {
    reglages: {
      creature: creatureArg,
      masqueOs: osMasque,
      erosionU: erode ? ERODE_U : 0,
      rendu: `${RENDER_W}x${RENDER_H} px (${PX_PER_U} px/u)`,
      echelle: 'luminance Rec.709 sur 0..100',
      platitude: { fenetreU: PLAT_FENETRE_U, pasU: PLAT_PAS_U, seuil: PLAT_SEUIL, couverture: PLAT_COUV },
      bandes: BANDES.map((b) => b.nom),
      pose: 'repos (QUAD_REST)',
    },
    vues: [] as { view: View; pixels: number; p90: number; p10: number; ecart: number; matiere: string | null; partClaire: number | null; platitude: Platitude }[],
  };
  for (const view of views) {
    const bones = resolveQuadFromProps(props, view, QUAD_REST);
    const comp = renderPng(bones, () => true);
    const solo = renderPng(bones, (id) => osMasque.includes(id as QuadBoneId));
    const { w, h } = comp;
    const raw = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const o = i * 4;
      if (solo.data[o + 3] < ALPHA_MIN || comp.data[o + 3] < ALPHA_MIN) continue;
      if (solo.data[o] === comp.data[o] && solo.data[o + 1] === comp.data[o + 1] && solo.data[o + 2] === comp.data[o + 2]) raw[i] = 1;
    }
    const mask = erode ? erodeMask(raw, w, h, ERODE_PX) : raw;
    const ls: number[] = [];
    const counts = new Map<string, number>();
    for (let i = 0; i < w * h; i++) {
      if (!mask[i]) continue;
      const o = i * 4;
      ls.push(lum(comp.data[o], comp.data[o + 1], comp.data[o + 2]));
      const hex = '#' + [comp.data[o], comp.data[o + 1], comp.data[o + 2]].map((v) => v.toString(16).padStart(2, '0')).join('');
      counts.set(hex, (counts.get(hex) ?? 0) + 1);
    }
    ls.sort((a, b) => a - b);
    const mat = dominantMaterial(tmap, counts);
    rapport.vues.push({
      view,
      pixels: ls.length,
      p90: +quantile(ls, 0.9).toFixed(1),
      p10: +quantile(ls, 0.1).toFixed(1),
      ecart: +(quantile(ls, 0.9) - quantile(ls, 0.1)).toFixed(1),
      matiere: mat?.fam ?? null,
      partClaire: mat && ls.length ? +((ls.filter((l) => l > mat.seuil).length / ls.length) * 100).toFixed(1) : null,
      platitude: platitude(comp, mask, w, h),
    });
  }
  if (asJson) {
    console.log(JSON.stringify(rapport, null, 1));
  } else {
    const r = rapport.reglages;
    console.log(`créature ${r.creature} · masque os [${r.masqueOs.join(', ')}] — visibles dans le composé · pose ${r.pose}`);
    console.log(`  érosion  : ${r.erosionU} u SVG${erode ? '' : '  — DÉSACTIVÉE'} · rendu ${r.rendu} · ${r.echelle}`);
    console.log(`  platitude: fenêtre ${r.platitude.fenetreU} u, pas ${r.platitude.pasU} u, couv ≥ ${r.platitude.couverture * 100} %, PLATE si P90-P10 < ${r.platitude.seuil} pts`);
    for (const v of rapport.vues) {
      console.log(`  ${v.view.padEnd(8)} px=${pad(v.pixels, 6)} P90=${pad(v.p90, 5)} P10=${pad(v.p10, 5)} écart=${pad(v.ecart, 5)} | matière ${(v.matiere ?? '-').padEnd(8)} clair=${pad(dash(v.partClaire), 5)} %`);
      const pl = v.platitude;
      console.log(`    platitude locale : ${pl.plates}/${pl.retenues} fenêtres PLATES`
        + ` — ${pl.bandes.map((b) => `${b.nom} ${b.part === null ? '-' : `${b.part} %`} (${b.plates}/${b.retenues})`).join(' · ')}`);
      for (const a of pl.amas) console.log(`      amas de ${pad(a.fenetres, 3)} fenêtres contiguës — u[${a.bbox[0]},${a.bbox[1]} → ${a.bbox[2]},${a.bbox[3]}]`);
      console.log(`      carte (# = plate, . = structurée, espace = hors masque) — une colonne = ${PLAT_PAS_U} u`);
      for (const l of pl.carte) console.log(`      ${l}`);
    }
  }
} else if (allMode) {
  const tenues = tenueIds.map((id) => ({ id, label: tenueLabelOf(id), tmap: buildTokenMap(TENUE_PALETTE_BY_ID[id] ?? {}, {}) }));
  if (asJson) {
    const mesures: (ViewReport & { tenueId: string })[] = [];
    for (const t of tenues) for (const v of views) {
      const report = measure(t.id, t.tmap, v);
      trackVerdict(report);
      mesures.push({ tenueId: t.id, ...report });
    }
    const total = mesures.length;
    console.log(JSON.stringify({
      reglages: { ...reglagesCommun, vues: views },
      synthese: { ...tally, total },
      mesures,
    }, null, 1));
  } else {
    const r = reglagesCommun;
    console.log(`sweep --all · ${tenues.length} tenue(s) · slot ${r.slot}`);
    console.log(`  masque   : os [${r.masqueOs.join(', ')}] — visibles dans le composé`);
    console.log(`  chair    : ${r.chair}${withFlesh ? '  ⚠ la mesure INCLUT la chair (mains/pieds nus)' : ''}`);
    console.log(`  érosion  : ${r.erosionU} u SVG (${r.erosionPx} px)${erode ? '' : '  — DÉSACTIVÉE'}`);
    console.log(`  rig      : ${r.rig} · ${r.rendu} · ${r.echelle}`);
    console.log(`  contrat  : écart ≥ ${r.contrat.ecartMin} ET part claire ≥ ${r.contrat.clairMin} % (palette saine) — le harnais RÉFUTE, il ne certifie pas`);
    console.log(`  id                                 ${HEAD_COLS}`);
    for (const t of tenues) {
      for (const view of views) {
        const v = measure(t.id, t.tmap, view);
        printViewLine(v, `  ${t.id.padEnd(35)}`);
      }
    }
    const total = tally['NON-REFUTE'] + tally.ECHEC + tally['NON MESURABLE'];
    console.log(
      `  verdicts: ${tally['NON-REFUTE']} NON-REFUTE · ${tally.ECHEC} ECHEC · ${tally['NON MESURABLE']} NON MESURABLE ` +
      `(dont ${tally['NM légitime']} légitime · ${tally['NM non instruit']} NON INSTRUIT) (sur ${total} vues)`,
    );
  }
} else {
  const tenueId = tenueArg;
  const tenueLabel = tenueLabelOf(tenueId);
  const tmap = buildTokenMap(TENUE_PALETTE_BY_ID[tenueId] ?? {}, {});
  const rapport = { reglages: { tenueId, tenueLabel, ...reglagesCommun }, vues: views.map((v) => measure(tenueId, tmap, v)) };

  if (asJson) {
    for (const v of rapport.vues) trackVerdict(v);
    console.log(JSON.stringify(rapport, null, 1));
  } else {
    const r = rapport.reglages;
    console.log(`tenue ${r.tenueId} « ${r.tenueLabel} » · slot ${r.slot}`);
    console.log(`  masque   : os [${r.masqueOs.join(', ')}] — visibles dans le composé`);
    console.log(`  chair    : ${r.chair}${withFlesh ? '  ⚠ la mesure INCLUT la chair (mains/pieds nus)' : ''}`);
    console.log(`  érosion  : ${r.erosionU} u SVG (${r.erosionPx} px)${erode ? '' : '  — DÉSACTIVÉE'}`);
    console.log(`  rig      : ${r.rig} · ${r.rendu} · ${r.echelle}`);
    console.log(`  contrat  : écart ≥ ${r.contrat.ecartMin} ET part claire ≥ ${r.contrat.clairMin} % (palette saine) — le harnais RÉFUTE, il ne certifie pas`);
    console.log(`  ${HEAD_COLS}`);
    for (const v of rapport.vues) printViewLine(v, '  ');
  }
}

process.exitCode = anyEchec ? 1 : 0;
