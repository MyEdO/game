/** Score les verdicts aveugles (verdicts.json) contre la clé privée (map.json) :
 *  taux de reconnaissance espèce + vue, et défauts classés par sévérité/cellule. Le brief des agents
 *  aveugles demande la vue (`view`) parmi `front`, `profile`, `back` ; un verdict dont la `view`
 *  n'est pas une vue de `VIEWS`, absente comprise, lève en nommant sa cellule.
 *  Lancer : npx tsx scripts/_qc-quad-score.mts */
import { readFileSync } from 'node:fs';
import { VIEWS, type View } from '../src/gameIso/rig/facing';

type Cell = { species: string; view: View; pose: string };
type Defect = { severity: 'critique' | 'majeur' | 'mineur'; desc: string; fix: string };
type Verdict = { openGuess: string; bestMatch: string; view: View; confidence: number; defects: Defect[] };
type Row = { id: string; verdicts: Verdict[] };

const map: Record<string, Cell> = JSON.parse(readFileSync('public/qc/quad-cells/map.json', 'utf8'));
const rows: Row[] = JSON.parse(readFileSync('public/qc/quad-cells/verdicts.json', 'utf8'));

let spAny = 0, spBoth = 0, viewAny = 0, total = 0;
const sevRank = { critique: 0, majeur: 1, mineur: 2 } as const;
const allDefects: { cell: string; species: string; view: string; d: Defect }[] = [];
const lines: string[] = [];

for (const row of rows) {
  const c = map[row.id];
  if (!c) continue;
  total++;
  const vs = row.verdicts;
  for (const v of vs) {
    if (!VIEWS.includes(v.view)) throw new Error(`${row.id} : vue de verdict « ${String(v.view)} » hors de ${VIEWS.join(', ')}`);
  }
  const okSp = vs.filter((v) => v.bestMatch === c.species).length;
  const okView = vs.filter((v) => v.view === c.view).length;
  if (okSp >= 1) spAny++;
  if (okSp >= 2) spBoth++;
  if (okView >= 1) viewAny++;
  const guesses = vs.map((v) => `${v.bestMatch}/${v.view}(${v.confidence})`).join(' , ');
  const flag = okSp >= 2 ? '✓✓' : okSp === 1 ? '~ ' : '✗✗';
  lines.push(`${flag} ${row.id} = ${c.species} ${c.view} ${c.pose}  →  ${guesses}  [openGuess: ${vs.map((v) => v.openGuess).join(' | ')}]`);
  for (const v of vs) for (const d of v.defects) allDefects.push({ cell: row.id, species: c.species, view: c.view, d });
}

console.log('=== RECONNAISSANCE ===');
console.log(lines.sort().join('\n'));
console.log(`\nEspèce reconnue : ${spAny}/${total} (au moins 1 agent), ${spBoth}/${total} (consensus 2/2). Vue : ${viewAny}/${total}.`);

allDefects.sort((a, b) => sevRank[a.d.severity] - sevRank[b.d.severity]);
console.log('\n=== DÉFAUTS (par sévérité) ===');
const byCell: Record<string, string[]> = {};
for (const x of allDefects) {
  const k = `${x.species} ${x.view} (${x.cell})`;
  (byCell[k] ??= []).push(`[${x.d.severity}] ${x.d.desc} → ${x.d.fix}`);
}
for (const [k, ds] of Object.entries(byCell)) {
  console.log(`\n• ${k}`);
  for (const d of ds) console.log(`    ${d}`);
}
const crit = allDefects.filter((x) => x.d.severity === 'critique').length;
const maj = allDefects.filter((x) => x.d.severity === 'majeur').length;
console.log(`\nTotal défauts : ${crit} critiques, ${maj} majeurs, ${allDefects.length - crit - maj} mineurs.`);
