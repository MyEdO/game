/**
 * Tokenise la COULEUR des 48 defs d'arme (calqué sur _tokenize-tenues.mts) — déterministe :
 * classe chaque couleur (hex + dégradés métal) par VALEUR (HSL) en familles @metal/@cuir/@accent
 * × tiers base/O/H, le reste (outlines quasi-noirs, glow/sang/chair, rouges/verts) = `keep`.
 * Pour chaque def : réécrit art (couleur→@token, géométrie intacte) + ajoute `palette`
 * (PaletteDeclaree = hex EXACT par token → défaut sans perte, recolor cohérent via buildTokenMap).
 *
 *   npx tsx scripts/_tokenize-weapons.mts          # DRY-RUN (rapport, n'écrit rien)
 *   npx tsx scripts/_tokenize-weapons.mts --write   # applique aux defs/
 */
import { writeFileSync } from 'node:fs';
import { WEAPON_DEFS } from '../src/gameIso/rig/parts/weapons/_registry.generated';
import type { PartArt } from '../src/gameIso/rig/parts/types';

const WRITE = process.argv.includes('--write');

/** SVG d'un art : la string, ou toutes les vues d'un art directionnel concaténées (extraction couleur). */
const artText = (a: PartArt): string => (typeof a === 'string' ? a : [a.front, a.back, a.profile].filter(Boolean).join('\n'));
/** Applique une réécriture string→string en préservant la FORME de l'art (string ↔ vues directionnelles). */
const mapArt = (a: PartArt, fn: (s: string) => string): PartArt =>
  typeof a === 'string' ? fn(a) : { front: fn(a.front), ...(a.back ? { back: fn(a.back) } : {}), ...(a.profile ? { profile: fn(a.profile) } : {}) };

// ── HSL ──────────────────────────────────────────────────────────────────────
function hsl(hex: string): { h: number; s: number; l: number } {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return { h: 0, s: 0, l: 0 };
  const r = parseInt(m[1], 16) / 255, g = parseInt(m[2], 16) / 255, b = parseInt(m[3], 16) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, l = (mx + mn) / 2;
  let h = 0; const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return { h, s, l };
}

// Hex MÉDIAN représentatif de chaque dégradé (pour la lightness ET la palette) — sinon un
// g_steelD (acier FONCÉ) collapserait vers le @metal clair (canons d'arme à feu blanchis).
const GRADIENT_MID: Record<string, string> = {
  'url(#g_steel)': '#9aa6b8', 'url(#g_steelD)': '#676f80', 'url(#g_axe)': '#a4acb9',
};
const effHexOf = (color: string) => (color.startsWith('url(') ? GRADIENT_MID[color] ?? '#9aa6b8' : color);

type Fam = 'metal' | 'cuir' | 'accent' | null; // null = keep

/** Famille d'une couleur par sa VALEUR (gris/bleu→métal, brun→cuir, jaune→or, reste→keep). */
function family(color: string): Fam {
  if (color.startsWith('url(')) return /g_steel|g_axe/.test(color) ? 'metal' : null; // glow/sang/chair/œil = keep
  const { h, s, l } = hsl(color);
  if (l < 0.15) return null;                              // outline quasi-noir
  if (s < 0.16) return 'metal';                           // gris désaturé = acier
  if (h >= 186 && h <= 250) return 'metal';               // bleu-acier
  if (h >= 38 && h <= 64 && l >= 0.42 && s >= 0.3) return 'accent'; // or/jaune vif
  if (h >= 6 && h <= 46) return 'cuir';                   // brun/orange = bois/cuir
  return null;                                            // rouge/vert/divers = keep
}

let totReplaced = 0, totKept = 0, totDefs = 0;
const report: string[] = [];

for (const d of WEAPON_DEFS) {
  if (d.palette) { totDefs++; continue; } // déjà tokenisé → idempotent (ne re-tokenise que les defs neufs/regénérés)
  // couleurs présentes (hex + dégradés) avec fréquence
  const svg = artText(d.art);
  const colors = new Map<string, number>();
  for (const m of svg.matchAll(/#[0-9a-fA-F]{6}\b/g)) colors.set(m[0].toLowerCase(), (colors.get(m[0].toLowerCase()) ?? 0) + 1);
  for (const m of svg.matchAll(/url\(#[\w]+\)/g)) colors.set(m[0], (colors.get(m[0]) ?? 0) + 1);

  // groupe par famille (lightness via l'hex effectif : mid réel pour un dégradé)
  const byFam: Record<'metal' | 'cuir' | 'accent', Array<{ color: string; l: number; n: number }>> = { metal: [], cuir: [], accent: [] };
  for (const [color, n] of colors) {
    const fam = family(color);
    if (!fam) continue;
    byFam[fam].push({ color, l: hsl(effHexOf(color)).l, n });
  }

  // map couleur→token + palette (hex EXACT par token ; mid réel pour les dégradés).
  const color2token = new Map<string, string>();
  const palette: Record<string, string> = {};
  for (const fam of ['metal', 'cuir', 'accent'] as const) {
    const items = byFam[fam];
    if (!items.length) continue;
    const ls = items.map((i) => i.l).sort((a, b) => a - b);
    const med = ls[Math.floor(ls.length / 2)];
    const repr: Record<string, { hex: string; n: number; isGrad: boolean }> = {};
    for (const it of items) {
      const tier = it.l >= med + 0.07 ? 'H' : it.l <= med - 0.07 ? 'O' : ''; // tier par lightness
      const token = fam + tier;
      color2token.set(it.color, '@' + token);
      const isGrad = it.color.startsWith('url(');
      const cur = repr[token];
      // hex représentatif = préfère un hex EXACT (non-dégradé) ; sinon le plus fréquent.
      if (!cur || (cur.isGrad && !isGrad) || (cur.isGrad === isGrad && it.n > cur.n)) repr[token] = { hex: effHexOf(it.color), n: it.n, isGrad };
    }
    for (const [token, r] of Object.entries(repr)) palette[token] = r.hex;
  }

  // réécrit l'art (insensible à la casse pour les hex), forme préservée (string ↔ vues)
  let replaced = 0, kept = 0;
  const rewrite = (s: string) =>
    s.replace(/url\(#[\w]+\)/g, (m) => { const t = color2token.get(m); if (t) { replaced++; return t; } kept++; return m; })
     .replace(/#[0-9a-fA-F]{6}\b/g, (m) => { const t = color2token.get(m.toLowerCase()); if (t) { replaced++; return t; } kept++; return m; });
  const art = mapArt(d.art, rewrite);
  totReplaced += replaced; totKept += kept; totDefs++;

  report.push(`${d.slug.padEnd(18)} tokens=${Object.keys(palette).length}  remplacés=${replaced}  gardés=${kept}  pal={${Object.entries(palette).map(([k, v]) => k + ':' + v).join(' ')}}`);

  if (WRITE) {
    const body =
      `import type { WeaponDef } from '../types';\n\n` +
      `export const weapon: WeaponDef = {\n` +
      `  slug: ${JSON.stringify(d.slug)},\n` +
      `  label: ${JSON.stringify(d.label)},\n` +
      `  type: ${JSON.stringify(d.type)},\n` +
      `  group: ${JSON.stringify(d.group)},\n` +
      `  target: ${JSON.stringify(d.target)},\n` +
      `  art: ${JSON.stringify(art)},\n` +
      `  palette: ${JSON.stringify(palette)},\n` +
      `};\n`;
    writeFileSync(`src/gameIso/rig/parts/weapons/defs/${d.slug}.ts`, body);
  }
}

console.log(report.join('\n'));
console.log(`\n${WRITE ? 'ÉCRIT' : 'DRY-RUN'} — ${totDefs} armes ; ${totReplaced} couleurs tokenisées, ${totKept} gardées.`);
