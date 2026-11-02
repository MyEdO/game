/**
 * #3160
 * Entrées : `src/data/pregens.json`, `src/scenes/arene/arene-projet.json` et `src/scenes/loup-et-saumure/loup-et-saumure-projet.json` (lues et réécrites).
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const cibles = [
  ['src/data/pregens.json', true],
  ['src/scenes/arene/arene-projet.json', false],
  ['src/scenes/loup-et-saumure/loup-et-saumure-projet.json', false],
];
for (const [rel, dataset] of cibles) {
  const chemin = fileURLToPath(new URL(`../../${rel}`, import.meta.url));
  const avant = fs.readFileSync(chemin, 'utf8');
  const document = JSON.parse(avant);
  let retires = 0;
  const retirer = (porteur) => {
    if (porteur && Object.hasOwn(porteur, 'build')) {
      delete porteur.build;
      retires++;
    }
  };
  const visiter = (noeud) => {
    if (!noeud || typeof noeud !== 'object') return;
    if (Array.isArray(noeud)) { noeud.forEach(visiter); return; }
    retirer(noeud.appearance);
    Object.values(noeud).forEach(visiter);
  };
  if (dataset) document.forEach(retirer);
  else visiter(document);
  if (retires === 0) { console.log(`${rel} : 0 champ(s) retiré(s), INCHANGÉ`); continue; }
  const apres = dataset ? serializeDataset(document) : JSON.stringify(document, null, 1) + '\n';
  if (apres !== avant) fs.writeFileSync(chemin, apres);
  console.log(`${rel} : ${retires} champ(s) retiré(s), ${apres === avant ? 'INCHANGÉ' : 'réécrit'}`);
}
