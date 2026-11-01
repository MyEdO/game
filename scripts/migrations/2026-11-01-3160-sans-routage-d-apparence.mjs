/**
 * #3160
 * Entrées : `src/data/mutations.json`, `src/data/traumas.json` et `src/data/careers.json` (lues et réécrites).
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const cibles = { 'mutations.json': 'appearance', 'traumas.json': 'rig', 'careers.json': 'tenue' };
for (const [fichier, champ] of Object.entries(cibles)) {
  const chemin = fileURLToPath(new URL(`../../src/data/${fichier}`, import.meta.url));
  const avant = fs.readFileSync(chemin, 'utf8');
  const document = JSON.parse(avant);
  let retires = 0;
  for (const entree of document) {
    if (!Object.hasOwn(entree, champ)) continue;
    delete entree[champ];
    retires++;
  }
  if (retires === 0) { console.log(`${fichier} : 0 champ(s) retiré(s), INCHANGÉ`); continue; }
  const apres = serializeDataset(document);
  if (apres !== avant) fs.writeFileSync(chemin, apres);
  console.log(`${fichier} : ${retires} champ(s) retiré(s), ${apres === avant ? 'INCHANGÉ' : 'réécrit'}`);
}
