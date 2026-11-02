/**
 * Migration #3204.
 * Entrées : src/data/localisation.json, src/data/weaponGroups.json,
 * src/data/weather.json, src/data/donnees.manifest.json.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const retraits = {
  'localisation.json': (doc) => [doc.navire, doc['navire-fluvial']].map((v) => [v, 'rigs']),
  'weaponGroups.json': (doc) => doc.map((v) => [v, 'forme']),
  'weather.json': (doc) => [[doc, 'physicalTestCharsSource']],
  'donnees.manifest.json': (doc) => doc.rubriques.map((v) => [v, 'id']),
};
let gestes = 0;
for (const [fichier, cibles] of Object.entries(retraits)) {
  const chemin = fileURLToPath(new URL(`../../src/data/${fichier}`, import.meta.url));
  const doc = JSON.parse(readFileSync(chemin, 'utf8'));
  let nombre = 0;
  for (const [porteur, cle] of cibles(doc)) {
    if (Object.hasOwn(porteur, cle)) {
      delete porteur[cle];
      nombre++;
    }
  }
  if (nombre) writeFileSync(chemin, serializeDataset(doc));
  gestes += nombre;
}
console.log(`migration 3204 : ${gestes} retrait(s).`);
