/**
 * Rapport heuristique (#633) — DIAGNOSTIC, jamais bloquant.
 *
 * Le membre supérieur se découpe en 2 segments par DÉRIVE : l'art `bras` PLEINE LONGUEUR
 * (repère épaule, y ~ -2..34) est découpé au coude (`ELBOW_Y = 18`, cf. `parts/derive.ts`) ;
 * le bas rebasé habille l'avant-bras. La dérive suffit pour un art de manche « droit » ; elle
 * couvre MAL les arts `bras` atypiques (manche courte, revers/rabat qui traverse le coude en
 * diagonale, poignet bouffant). Ce script LISTE les defs suspects pour piloter leur revue —
 * il ne corrige rien, il ne bloque rien. L'écoutille de correction est `TenueSet.avantBras`
 * (override honoré tel quel par `resolveUpperLimb`).
 *
 * Usage : npx tsx scripts/qc/bras-coverage-report.mts
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { TENUE_DEFS } from '../../src/gameIso/rig/parts/tenues/_registry.generated';
import { declaredView } from '../../src/gameIso/rig/viewArt';

// Coude = pivot avant-bras dans le repère épaule (SKELETON-CONTRACT, cf. derive.ts ELBOW_Y).
const ELBOW_Y = 18;
// Un art `bras` dont l'extrémité n'atteint pas ce y couvre à peine l'avant-bras une fois découpé
// au coude (le bas rebasé serait un sliver) → candidat override `avantBras`.
const SHORT_YMAX = 26;
// Poignet nominal d'une manche pleine longueur (repère épaule).
const WRIST_Y = 34;
// Bande du coude où la ligne de découpe (y=18) passe : une géométrie LARGE ici (|x| au-delà de ce
// seuil, alors que la manche fait ~4..6 de large) trahit un revers/rabat/bouffant coupé en travers.
const ELBOW_BAND: [number, number] = [14, 20];
const WIDE_X = 6;

/** Extrait toutes les paires (x,y) des attributs `d="…"` d'un fragment SVG. Les path de ce repo
 *  n'emploient que M/L/Q/C/Z (coordonnées absolues en paires x,y) — pas de H/V/A. On le VÉRIFIE. */
function coords(svg: string): { pts: Array<{ x: number; y: number }>; irregular: boolean } {
  const pts: Array<{ x: number; y: number }> = [];
  let irregular = false;
  const dAttr = /\bd="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = dAttr.exec(svg)) !== null) {
    const d = m[1];
    if (/[HhVvAa]/.test(d)) irregular = true; // pairing (x,y) faussé par ces commandes
    const nums = d.match(/-?\d+(?:\.\d+)?/g);
    if (!nums) continue;
    for (let i = 0; i + 1 < nums.length; i += 2) {
      pts.push({ x: parseFloat(nums[i]), y: parseFloat(nums[i + 1]) });
    }
  }
  return { pts, irregular };
}

type Row = {
  id: string;
  label: string;
  format: 'string' | '3-vues';
  yMax: number;
  short: boolean;
  wideElbow: boolean;
  wideElbowPts: Array<{ x: number; y: number }>;
  irregular: boolean;
};

const rows: Row[] = [];
for (const def of TENUE_DEFS) {
  const brasArt = def.set.bras;
  if (brasArt == null) continue; // pas d'art bras → dérive du générique (hors champ de ce rapport)
  const front = declaredView(brasArt, 'front') ?? '';
  const { pts, irregular } = coords(front);
  if (pts.length === 0) continue;
  const yMax = Math.max(...pts.map((p) => p.y));
  const wideElbowPts = pts.filter(
    (p) => p.y >= ELBOW_BAND[0] && p.y <= ELBOW_BAND[1] && Math.abs(p.x) > WIDE_X,
  );
  rows.push({
    id: def.id,
    label: def.label,
    format: typeof brasArt === 'string' ? 'string' : '3-vues',
    yMax,
    short: yMax < SHORT_YMAX,
    wideElbow: wideElbowPts.length > 0,
    wideElbowPts,
    irregular,
  });
}

rows.sort((a, b) => a.yMax - b.yMax);

const shortRows = rows.filter((r) => r.short);
const wideRows = rows.filter((r) => r.wideElbow);
const irregularRows = rows.filter((r) => r.irregular);

const L: string[] = [];
L.push('# Rapport heuristique — couverture de l’avant-bras dérivé (#633 B-P1)');
L.push('');
L.push(`Defs de tenue au \`bras\` déclaré (analysés) : ${rows.length} / ${TENUE_DEFS.length} tenues`);
L.push(`Repère épaule : coude=y${ELBOW_Y}, poignet≈y${WRIST_Y}. Front analysé par def.`);
L.push('DIAGNOSTIC non bloquant — pilote la revue B-P4, ne corrige rien.');
L.push('');
L.push(`## (a) Bras COURT (yMax < ${SHORT_YMAX}) — avant-bras peu couvert par la dérive, candidat override \`avantBras\``);
L.push(`Compte : ${shortRows.length}`);
if (shortRows.length === 0) L.push('  (aucun)');
for (const r of shortRows) {
  L.push(`  - ${r.id} (${r.label}) [${r.format}] yMax=${r.yMax}`);
}
L.push('');
L.push(`## (b) LARGE au coude (|x| > ${WIDE_X} en y∈[${ELBOW_BAND[0]}..${ELBOW_BAND[1]}]) — découpe potentiellement laide, candidat couture`);
L.push(`Compte : ${wideRows.length}`);
if (wideRows.length === 0) L.push('  (aucun)');
for (const r of wideRows) {
  const ex = r.wideElbowPts
    .slice(0, 4)
    .map((p) => `(${p.x},${p.y})`)
    .join(' ');
  L.push(`  - ${r.id} (${r.label}) [${r.format}] pts hors bande: ${ex}`);
}
L.push('');
if (irregularRows.length > 0) {
  L.push('## ⚠ Arts à path H/V/A (pairage x,y approximatif — inspecter à la main)');
  for (const r of irregularRows) L.push(`  - ${r.id} (${r.label})`);
  L.push('');
}
L.push('## Comptes');
L.push(`  bras déclarés analysés : ${rows.length}`);
L.push(`  (a) bras court        : ${shortRows.length}`);
L.push(`  (b) large au coude    : ${wideRows.length}`);
L.push(`  path irréguliers      : ${irregularRows.length}`);

const report = L.join('\n') + '\n';
process.stdout.write(report);

const here = dirname(fileURLToPath(import.meta.url));
const outDir = pathResolve(here, '../../public/qc/633-B-P1');
mkdirSync(outDir, { recursive: true });
const outFile = pathResolve(outDir, 'bras-coverage-report.txt');
writeFileSync(outFile, report, 'utf8');
process.stdout.write(`\n[écrit] ${outFile}\n`);
