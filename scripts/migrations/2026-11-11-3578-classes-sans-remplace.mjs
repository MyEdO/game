/**
 * Migration #3578 L2a — `classes.json › remplace` sort : le remplacement d'une Classe au tirage (MDG 09 l.9)
 * est porté par la PORTION de `carrieres-aleatoires.json` (sa `colonne` et l'étendue qu'elle couvre), écrite
 * par `2026-11-10-3578-carrieres-aleatoires.mjs`, et le champ n'a plus de lecteur.
 *
 * Entrées : src/data/classes.json (lue et écrite).
 *
 * FORME D'AVANT SEULE : un `classes.json` dont aucune Classe ne porte `remplace` est laissé tel quel (rejeu sur
 * l'arbre migré : no-op byte-identique). ARRÊT nominatif (exit 1), AUCUNE écriture : un fichier non canonique.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CLASSES = join(ROOT, 'src/data/classes.json');

const brut = readFileSync(CLASSES, 'utf8');
const classes = JSON.parse(brut);
if (brut !== serializeDataset(classes)) {
  console.error('ARRÊT — classes.json : forme non canonique, AUCUNE écriture.');
  process.exit(1);
}
const porteurs = classes.filter((k) => Object.hasOwn(k, 'remplace'));
if (!porteurs.length) {
  console.log('migration 3578 L2a : aucune Classe ne porte `remplace`, rien à faire.');
} else {
  writeFileSync(CLASSES, serializeDataset(classes.map(({ remplace: _remplace, ...k }) => k)), 'utf8');
  console.log(`migration 3578 L2a : \`remplace\` retiré de ${porteurs.length} Classe(s) (${porteurs.map((k) => k.id).join(', ')}).`);
}
