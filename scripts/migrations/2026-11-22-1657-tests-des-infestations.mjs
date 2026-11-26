/**
 * #1657 — Test fixe d'équipage des deux infestations.
 * MDG 14 l.98-104 ; MDG 15 l.159-164, l.174-178.
 * Entrée : src/data/sea-events.json.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { serializeDataset } from '../../src/data/schemas/serialize.ts';
import { porteLaTranche } from './lib/formeDAvant.mjs';

const chemin = new URL('../../src/data/sea-events.json', import.meta.url);
const brut = readFileSync(chemin, 'utf8');
const evenements = JSON.parse(brut);
let gestes = 0;

for (const [id, difficulte] of [
  ['infestation-de-rats-geants', 'complexe'],
  ['infestation-de-rats', 'intermediaire'],
]) {
  const ops = evenements.boardEvents?.entries?.find((e) => e.id === id)?.consequence?.effet?.ops;
  const index = ops?.findIndex((o) => porteLaTranche(o, {
    op: 'infestation',
    crewTestType: { id: 'extermination-nuisibles' },
    difficulty: difficulte,
    test: undefined,
  })) ?? -1;
  if (index < 0) continue;
  const { op, crewTestType, difficulty, ...charge } = ops[index];
  ops[index] = { op, test: { crewTestType: crewTestType.id, difficulty }, ...charge };
  gestes += 1;
}

if (gestes > 0) {
  if (serializeDataset(JSON.parse(brut)) !== brut) throw new Error('sea-events.json hors de son format canonique');
  writeFileSync(chemin, serializeDataset(evenements), 'utf8');
}
console.log(`migration 1657 : ${gestes} Test(s) fixe(s) d’équipage emboîté(s).`);
