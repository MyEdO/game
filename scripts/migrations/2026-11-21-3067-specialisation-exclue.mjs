/**
 * Migration #3067 — Linguistique désigne sa spécialisation dans la référence de Compétence et l’exclut avec `sauf`.
 *
 * Entrées : src/data/talents.json (lue et écrite).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { serializeDataset } from '../../src/data/serialize.ts';
import { remplacerLaFormeDAvant } from './lib/formeDAvant.mjs';

const chemin = new URL('../../src/data/talents.json', import.meta.url);
const brut = readFileSync(chemin, 'utf8');
const talents = JSON.parse(brut);
const canonique = serializeDataset(talents) === brut;
const matches = talents.find(({ id }) => id === 'linguistique')?.test?.matches;
const geste = remplacerLaFormeDAvant(
  matches,
  { skill: { id: 'langue' }, exceptSpec: 'magick' },
  [{ skill: { id: 'langue', spec: 'magick' }, sauf: true }],
);
if (geste) {
  if (!canonique) throw new Error('talents.json hors de son format canonique');
  writeFileSync(chemin, serializeDataset(talents), 'utf8');
}
console.log(`migration 3067, spécialisation exclue : ${geste} test modifié.`);
