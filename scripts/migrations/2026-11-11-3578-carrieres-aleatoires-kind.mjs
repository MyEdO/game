/**
 * Migration #3578 L2a — la sorte d'un document de `carrieres-aleatoires.json` (colonne imprimée, portion, variante)
 * devient le discriminant `kind`, posé après `type` : `portion` sur un document à `colonne` (MDG 09 l.9), `variante`
 * sur un document à `carriere` (AA 02 l.117), `colonne` sur les autres (LDB 05 l.214).
 *
 * Entrées : src/data/carrieres-aleatoires.json (lue et écrite).
 *
 * FORME D'AVANT SEULE : un document qui porte déjà `kind` est laissé tel quel (rejeu sur l'arbre migré : no-op
 * byte-identique). ARRÊT nominatif (exit 1), AUCUNE écriture : un fichier non canonique, un document qui porte à la
 * fois `colonne` et `carriere`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const TABLE = join(ROOT, 'src/data/carrieres-aleatoires.json');

const brut = readFileSync(TABLE, 'utf8');
const documents = JSON.parse(brut);
if (brut !== serializeDataset(documents)) {
  console.error('ARRÊT — carrieres-aleatoires.json : forme non canonique, AUCUNE écriture.');
  process.exit(1);
}
const ambigus = documents.filter((d) => d.colonne !== undefined && d.carriere !== undefined);
if (ambigus.length) {
  console.error(`ARRÊT — carrieres-aleatoires.json : ${ambigus.map((d) => d.id).join(', ')} porte(nt) à la fois \`colonne\` et \`carriere\`, AUCUNE écriture.`);
  process.exit(1);
}
const aPoser = documents.filter((d) => !Object.hasOwn(d, 'kind'));
if (!aPoser.length) {
  console.log('migration 3578 L2a : chaque document porte déjà `kind`, rien à faire.');
} else {
  const sorte = (d) => (d.colonne !== undefined ? 'portion' : d.carriere !== undefined ? 'variante' : 'colonne');
  const migres = documents.map((d) => {
    if (Object.hasOwn(d, 'kind')) return d;
    const { id, type, ...reste } = d;
    return { id, type, kind: sorte(d), ...reste };
  });
  writeFileSync(TABLE, serializeDataset(migres), 'utf8');
  console.log(`migration 3578 L2a : \`kind\` posé sur ${aPoser.length} document(s).`);
}
