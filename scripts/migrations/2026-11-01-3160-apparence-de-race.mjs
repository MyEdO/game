/**
 * #3160 — forme des apparences de race et des mutations.
 * Entrées écrites : raceAppearance.json, speciesRace.json et mutations.json.
 * Les gabarits, têtes et échelles d'art sont conservés ; les autres propriétés de chaque document
 * gardent leur valeur et leur ordre. Le libellé de speciesRace nomme sa fonction de valeur par défaut.
 * Le rejeu est byte-identique, via serializeDataset.
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const champs = {
  'raceAppearance.json': ['palette', 'paletteF', 'legs', 'dropHeadgear', 'tirageIndividuel', 'featureKeys', 'pose', 'tenue', 'sex', 'extremites'],
  'speciesRace.json': ['rules'],
  'mutations.json': ['nonVisual'],
};

for (const [fichier, cles] of Object.entries(champs)) {
  const chemin = fileURLToPath(new URL(`../../src/data/${fichier}`, import.meta.url));
  const avant = fs.readFileSync(chemin, 'utf8');
  const doc = JSON.parse(avant);
  let retires = 0;
  for (const entree of Array.isArray(doc) ? doc : [doc]) {
    for (const cle of cles) {
      if (Object.hasOwn(entree, cle)) {
        delete entree[cle];
        retires++;
      }
    }
  }
  if (fichier === 'speciesRace.json') doc.label = 'Race d’apparence par défaut';
  const apres = serializeDataset(doc);
  if (apres !== avant) fs.writeFileSync(chemin, apres);
  console.log(`${fichier} : ${retires} champ(s) retiré(s), ${apres === avant ? 'INCHANGÉ' : 'réécrit'}`);
}
