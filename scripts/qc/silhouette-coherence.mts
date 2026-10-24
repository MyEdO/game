/**
 * QC / GARDE — cohérence de SILHOUETTE front↔dos du rig.
 *
 *   npx tsx scripts/qc/silhouette-coherence.mts            → table classée + contrôles + PNG sanity
 *   npx tsx scripts/qc/silhouette-coherence.mts --json     → JSON brut (pour une garde CI)
 *
 * Invariant mesuré : un corps/vêtement vu de FACE et de DOS doit avoir la MÊME silhouette
 * (seule la SURFACE diffère). On aplatit chaque vue en un MASQUE plein (tous les `fill`
 * recolorés en une couleur opaque unique, `stroke=none`, `opacity=1`, filtres/clips retirés)
 * → seul le CONTOUR compte, le détail interne (visage, ombrage) disparaît dans la masse.
 *
 *   divergence = |maskFront XOR maskBack| / |maskFront OR maskBack|
 *   (0 = contours identiques ; ↑ = divergence ; NE compare JAMAIS front↔profil.)
 *
 * On ne compare que FACE vs DOS (même projection). Le profil a une projection différente →
 * divergence légitime, hors périmètre de cet invariant.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { resolveRig, type ResolvedBone } from '../../src/gameIso/rig/composeRig';
import { bonesToSvg } from '../../src/gameIso/rig/renderBones';
import { TENUE_DEFS } from '../../src/gameIso/rig/parts/tenues/_registry.generated';
import type { Appearance } from '../../src/engine/authoringAppearance';
import type { BoneId } from '../../src/gameIso/rig/bones';
import type { View } from '../../src/gameIso/rig/facing';
import { equipDe } from '../../src/noyau/equipementDessine';


// ── Archétype humain FIXE (le corps ne varie pas — seule la tenue et la vue changent). ──
const APP: Appearance = { species: 'Humain', sex: 'M', build: 0.55, seed: 4, hairstyle: 'crane-rase-m' } as Appearance;
const EQUIP = equipDe([], []);

const RENDER_W = 240; // viewBox 120×150 → 240×300 px : assez fin pour le contour, rapide.

// ── Regroupement PART → os porteurs (pour isoler chaque part, autres slots vides). ──
const PART_BONES: Record<'torse' | 'jambes' | 'bras' | 'tete', BoneId[]> = {
  torse: ['torse', 'bassin'],
  jambes: ['cuisseG', 'tibiaG', 'piedG', 'cuisseD', 'tibiaD', 'piedD'],
  bras: ['epauleG', 'avantBrasG', 'mainG', 'epauleD', 'avantBrasD', 'mainD'],
  tete: ['tete', 'cou'],
};
type PartKey = keyof typeof PART_BONES;

/** Aplatit le markup d'un rig en masque PLEIN : tout fill → couleur opaque unique, pas de
 *  stroke/filtre/clip/opacité partielle. Le détail de surface devient intérieur → invisible. */
function flatten(markup: string): string {
  return markup
    .replace(/fill="[^"]*"/g, 'fill="#ff0000"')
    .replace(/stroke="[^"]*"/g, 'stroke="none"')
    .replace(/stroke-width="[^"]*"/g, '')
    .replace(/\bfill-opacity="[^"]*"/g, '')
    .replace(/\bstroke-opacity="[^"]*"/g, '')
    .replace(/\bopacity="[^"]*"/g, 'opacity="1"')
    .replace(/\bfilter="[^"]*"/g, '')
    .replace(/\bclip-path="[^"]*"/g, '')
    .replace(/\bmask="[^"]*"/g, '')
    // fill/stroke/opacity portés par un attribut `style="…"`
    .replace(/fill\s*:\s*[^;"']+/g, 'fill:#ff0000')
    .replace(/stroke\s*:\s*[^;"']+/g, 'stroke:none')
    .replace(/(?:fill|stroke)-opacity\s*:\s*[^;"']+/g, '')
    .replace(/opacity\s*:\s*[^;"']+/g, 'opacity:1');
}

/** Bones → masque booléen (true = pixel non-fond). Sans defs, sans fond : alpha>127. */
function maskOf(bones: ResolvedBone[]): { m: Uint8Array; w: number; h: number } {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 150" width="120" height="150">${flatten(bonesToSvg(bones))}</svg>`;
  const r = new Resvg(svg, { fitTo: { mode: 'width', value: RENDER_W } }).render();
  const px = r.pixels;
  const n = r.width * r.height;
  const m = new Uint8Array(n);
  for (let i = 0; i < n; i++) m[i] = px[i * 4 + 3] > 127 ? 1 : 0;
  return { m, w: r.width, h: r.height };
}

/** divergence XOR/OR entre deux masques de même taille (0..1, -1 si les deux sont vides). */
function divergence(a: Uint8Array, b: Uint8Array): number {
  let xor = 0, or = 0;
  for (let i = 0; i < a.length; i++) {
    const av = a[i], bv = b[i];
    if (av | bv) or++;
    if (av ^ bv) xor++;
  }
  return or === 0 ? -1 : xor / or;
}

/** Résout puis rend le masque d'une tenue (part = 'all' → corps entier ; sinon slots isolés). */
function bonesFor(tenue: string | undefined, view: View, part: PartKey | 'all'): ResolvedBone[] {
  const bones = resolveRig(APP, EQUIP, {}, tenue, view, [], false);
  if (part === 'all') return bones;
  const keep = new Set<string>(PART_BONES[part]);
  return bones.filter((b) => keep.has(b.id));
}

interface Row {
  tenue: string;
  global: number;
  torse: number;
  jambes: number;
  bras: number;
  tete: number;
}

function measure(tenue: string | undefined, label: string): Row {
  const g = divergence(maskOf(bonesFor(tenue, 'front', 'all')).m, maskOf(bonesFor(tenue, 'back', 'all')).m);
  const p: Record<PartKey, number> = { torse: 0, jambes: 0, bras: 0, tete: 0 };
  for (const k of Object.keys(PART_BONES) as PartKey[]) {
    p[k] = divergence(maskOf(bonesFor(tenue, 'front', k)).m, maskOf(bonesFor(tenue, 'back', k)).m);
  }
  return { tenue: label, global: g, ...p };
}

// ── PNG sanity-check : les 2 masques du NU superposés (face rouge, dos bleu, chevauche magenta). ──
function nuOverlayPng(): Buffer {
  const front = flatten(bonesToSvg(bonesFor(undefined, 'front', 'all')));
  const back = flatten(bonesToSvg(bonesFor(undefined, 'back', 'all')));
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 150" width="120" height="150">` +
    `<rect width="120" height="150" fill="#12151d"/>` +
    `<g opacity="0.55">${front.replace(/#ff0000/g, '#ff3344')}</g>` +
    `<g opacity="0.55">${back.replace(/#ff0000/g, '#3388ff')}</g>` +
    `</svg>`;
  return Buffer.from(new Resvg(svg, { fitTo: { mode: 'width', value: 480 } }).render().asPng());
}

// ── Contrôle de saine métrique : un masque comparé à LUI-MÊME → 0. ──
const selfMask = maskOf(bonesFor(undefined, 'front', 'all')).m;
const selfDiv = divergence(selfMask, selfMask);

// ── Sweep de toutes les tenues + ligne du nu. ──
const rows: Row[] = [];
const nu = measure(undefined, '(nu — corps de base)');
for (const def of TENUE_DEFS) rows.push(measure(def.id, def.id));

rows.sort((a, b) => b.global - a.global);

// ── PNG sanity ──
const outDir = 'public/qc/633-silhouette';
mkdirSync(outDir, { recursive: true });
const pngPath = `${outDir}/nu-mask-overlay.png`;
writeFileSync(pngPath, nuOverlayPng());

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ selfDiv, nu, rows, pngPath }, null, 1));
} else {
  const pct = (v: number) => (v < 0 ? '  —  ' : (v * 100).toFixed(1).padStart(5));
  const line = (r: Row) =>
    `${r.tenue.padEnd(30).slice(0, 30)} ${pct(r.global)} | ${pct(r.torse)} ${pct(r.jambes)} ${pct(r.bras)} ${pct(r.tete)}`;
  console.log('\n== CONTRÔLE DE MÉTRIQUE ==');
  console.log(`  self (masque vs lui-même) : ${(selfDiv * 100).toFixed(3)} %  (attendu 0)`);
  console.log(`  nu (corps de base) front↔dos : ${(nu.global * 100).toFixed(1)} %  (attendu NON nul)`);
  console.log(`  PNG sanity : ${pngPath}`);
  console.log('\n== DIVERGENCE SILHOUETTE FRONT↔DOS (%, pire d\'abord) ==');
  console.log(`${'tenue'.padEnd(30)} ${'glob'.padStart(5)} | ${'torse'.padStart(5)} ${'jambe'.padStart(5)} ${'bras'.padStart(5)} ${'tete'.padStart(5)}`);
  console.log('-'.repeat(72));
  console.log(line(nu));
  console.log('-'.repeat(72));
  for (const r of rows) console.log(line(r));

  const g = rows.map((r) => r.global);
  const band = (lo: number, hi: number) => g.filter((v) => v >= lo && v < hi).length;
  console.log('\n== DISTRIBUTION (global) ==');
  console.log(`  total tenues       : ${rows.length}`);
  console.log(`  > 20%              : ${g.filter((v) => v >= 0.2).length}`);
  console.log(`  10–20%             : ${band(0.1, 0.2)}`);
  console.log(`  5–10%              : ${band(0.05, 0.1)}`);
  console.log(`  < 5%               : ${g.filter((v) => v >= 0 && v < 0.05).length}`);
}
