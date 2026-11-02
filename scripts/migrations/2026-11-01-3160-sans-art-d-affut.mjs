/**
 * #3160 — trappings : sélection des engins posables par leur sous-type.
 * Entrées : `src/data/trappings.json` (lue et réécrite).
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const chemin = fileURLToPath(new URL('../../src/data/trappings.json', import.meta.url));
const avant = fs.readFileSync(chemin, 'utf8');
const trappings = JSON.parse(avant);
let retires = 0;
for (const trapping of trappings) {
  if (Object.hasOwn(trapping, 'siegeRig')) {
    delete trapping.siegeRig;
    retires++;
  }
}
const apres = serializeDataset(trappings);
if (apres !== avant) fs.writeFileSync(chemin, apres);
console.log(`trappings.json : ${retires} champ(s) retiré(s), ${apres === avant ? 'INCHANGÉ' : 'réécrit'}`);
