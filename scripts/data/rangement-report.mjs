// Rapport objet → emplacement (#3116, H9 de #2972) — rapport (PAS de garde) : pour chaque emplacement de la
// garde-robe (`src/data/garde-robe.json`, `kind: emplacement`), les objets (`src/data/trappings.json`) qui s'y
// rangent (`rangement`), puis les objets portés (arme, ou objet à `shape`) sans rangement, chacun sous le
// premier trait de sa donnée qu'aucun objet rangé ne porte ; sans tel trait, « indiscernable d'un oubli ».
// Patron : `scripts/data/prose-field-usage-report.mjs`.
// Usage : node scripts/data/rangement-report.mjs [--json]

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tableTotale } from '../../src/lib/tableTotale.ts';

const DATA = join(process.cwd(), 'src/data');
const lire = (f) => JSON.parse(readFileSync(join(DATA, f), 'utf8'));

const emplacements = lire('garde-robe.json').filter((e) => e.kind === 'emplacement').map((e) => e.id);
const objets = lire('trappings.json');
const parEmplacement = tableTotale(emplacements, (id) => objets.filter((o) => o.rangement?.id === id).map((o) => o.id));

const traits = (o) => [
  !o.shape && 'sans shape',
  o.siegeRig && 'siegeRig',
  o.unarmed && 'unarmed',
  o.improvised && 'improvised',
  `categorie=${o.categorie}`,
  o.subType && `subType=${o.subType}`,
].filter(Boolean);
const ranges = objets.filter((o) => o.rangement);
const traitsDesRanges = new Set(ranges.flatMap(traits));
const INDISCERNABLE = 'indiscernable d’un oubli';
const portes = objets.filter((o) => !o.rangement && (o.shape || o.categorie === 'melee' || o.categorie === 'ranged'));
const sansRangement = {};
for (const o of portes) {
  const raison = traits(o).find((t) => !traitsDesRanges.has(t)) ?? INDISCERNABLE;
  (sansRangement[raison] ??= []).push(o.id);
}
const rapport = { parEmplacement, sansRangement };

if (process.argv.includes('--json')) console.log(JSON.stringify(rapport, null, 2));
else {
  for (const [id, liste] of Object.entries(parEmplacement)) console.log(`${id} (${liste.length}) : ${liste.join(', ') || '—'}`);
  console.log(`objets portés sans rangement (${portes.length}), par trait :`);
  for (const [raison, liste] of Object.entries(sansRangement)) console.log(`  ${raison} (${liste.length}) : ${liste.join(', ')}`);
}
