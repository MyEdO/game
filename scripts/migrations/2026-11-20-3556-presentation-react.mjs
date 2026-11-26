/**
 * #3556 — retire les clés de case et les panneaux de la console React, les colonnes et répliques
 * de son étal, l'infobulle de l'ancien éditeur de lieux et les réglages de rendu exclusifs au web
 * dans `structureAppearance.json` et `ambiance.json`.
 *
 * Entrées : `src/data/actions.json`, `src/data/merchantFamilies.json`, `src/data/merchants.json`,
 * `src/data/lieux-services.json`, `src/data/structureAppearance.json` et `src/data/ambiance.json`
 * (lus et réécrits lorsqu’un de ces champs historiques est présent).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { serializeDataset } from '../../src/data/schemas/serialize.ts';
import { estObjet } from '../../src/lib/objet.mjs';
import { tableTotale } from '../../src/lib/tableTotale.ts';

const cibles = [
  { fichier: 'actions.json', champs: { keys: 40, panneau: 2 } },
  { fichier: 'merchantFamilies.json', champs: { columns: 7 } },
  { fichier: 'merchants.json', champs: { boniment: 6 } },
  { fichier: 'lieux-services.json', champs: { editorNote: 1 } },
  {
    fichier: 'structureAppearance.json',
    champs: { 'window.lit': 5, recess: 1, 'door.lintelPx': 5, 'door.jambCap': 4, 'parapet.bands': 4 },
  },
  {
    fichier: 'ambiance.json', objet: true,
    champs: tableTotale([
      'ambientFloor', 'faceShade', 'entreeEnScene',
      'iso.warm', 'iso.vignette', 'iso.lowerFloorDim', 'iso.nightVeil',
      'iso.nightVeilMax', 'iso.dayVignetteFloor', 'iso.edgeDepth',
      'pov.fogOutdoorSurface', 'pov.ambientUnseen', 'pov.warm', 'pov.floorOcclusion',
      'pov.vignette', 'pov.depth.lod',
      ...['pluie', 'neige', 'tempete'].flatMap(meteo =>
        ['particles', 'pcolor', 'density'].map(champ => `iso.weather.${meteo}.${champ}`)),
    ], () => 1),
  },
];

const sorties = cibles.map(({ fichier, champs, objet = false }) => {
  const url = new URL(`../../src/data/${fichier}`, import.meta.url);
  const texte = readFileSync(url, 'utf8');
  const donnees = JSON.parse(texte);
  if (!(objet ? estObjet(donnees) : Array.isArray(donnees)) || serializeDataset(donnees) !== texte) {
    throw new Error(`${fichier} : ${objet ? 'objet' : 'liste'} non canonique`);
  }
  const entrees = objet ? [donnees] : donnees;
  for (const [chemin, attendu] of Object.entries(champs)) {
    const segments = chemin.split('.');
    const champ = segments.pop();
    const objets = segments.reduce((parents, segment) => parents.map(parent => parent[segment]).filter(estObjet), entrees);
    const porteurs = objets.filter(item => Object.hasOwn(item, champ));
    if (porteurs.length !== 0 && porteurs.length !== attendu) {
      throw new Error(`${fichier} : ${porteurs.length} occurrence(s) de ${chemin}, ${attendu} attendues`);
    }
    for (const item of porteurs) delete item[champ];
  }
  return { url, texte, apres: serializeDataset(donnees) };
});

for (const { url, texte, apres } of sorties) {
  if (apres !== texte) writeFileSync(url, apres);
}
console.log(sorties.some(({ texte, apres }) => texte !== apres)
  ? 'Migration #3556 : métadonnées de présentation React retirées.'
  : 'Migration #3556 : rien à faire.');
