/**
 * #3556 — retire les clés de case et les panneaux de la console React, les colonnes et répliques
 * de son étal, l'infobulle de l'ancien éditeur de lieux et les couleurs de la vue de plan SVG
 * dans `structureAppearance.json`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { serializeDataset } from '../../src/data/serialize.ts';

const cibles = [
  { fichier: 'actions.json', champs: { keys: 40, panneau: 2 } },
  { fichier: 'merchantFamilies.json', champs: { columns: 7 } },
  { fichier: 'merchants.json', champs: { boniment: 6 } },
  { fichier: 'lieux-services.json', champs: { editorNote: 1 } },
  { fichier: 'structureAppearance.json', champs: { 'window.lit': 5, recess: 1 } },
];

const sorties = cibles.map(({ fichier, champs }) => {
  const url = new URL(`../../src/data/${fichier}`, import.meta.url);
  const texte = readFileSync(url, 'utf8');
  const items = JSON.parse(texte);
  if (!Array.isArray(items) || serializeDataset(items) !== texte) {
    throw new Error(`${fichier} : liste non canonique`);
  }
  for (const [chemin, attendu] of Object.entries(champs)) {
    const [racine, enfant] = chemin.split('.');
    const objets = enfant === undefined ? items : items.map(item => item[racine]).filter(Boolean);
    const champ = enfant ?? racine;
    const porteurs = objets.filter(item => Object.hasOwn(item, champ));
    if (porteurs.length !== 0 && porteurs.length !== attendu) {
      throw new Error(`${fichier} : ${porteurs.length} occurrence(s) de ${chemin}, ${attendu} attendues`);
    }
    for (const item of porteurs) delete item[champ];
  }
  return { url, texte, apres: serializeDataset(items) };
});

for (const { url, texte, apres } of sorties) {
  if (apres !== texte) writeFileSync(url, apres);
}
console.log(sorties.some(({ texte, apres }) => texte !== apres)
  ? 'Migration #3556 : métadonnées de présentation React retirées.'
  : 'Migration #3556 : rien à faire.');
