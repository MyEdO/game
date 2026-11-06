/**
 * Migration #1667 train (d), volet terrestre — le dé du SEUIL quotidien des Péripéties entre en donnée :
 * `peripeties.json` reçoit `tirageQuotidien: { dice: { n: 1, sides: 10 } }` (un `Tirage`), juste après son `die`.
 *
 *   champ              dé      réf
 *   `tirageQuotidien`  `1d10`  LDB 51 l.208 (« lancer 1d10 par jour de voyage »)
 *
 * Entrées : src/data/peripeties.json.
 *
 * Le document est la forme mono-table que pose `2026-11-06-1667-tableaux-racines-mono-tables.mjs`, qui
 * trie avant celle-ci. Un `tirageQuotidien` déjà présent est une donnée : no-op. Une racine qui n'est pas ce
 * document, ou un fichier non canonique, est un ARRÊT nominatif (exit 1), AUCUNE écriture.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';
import { estMonoTable } from './lib/monoTable.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const FICHIER = 'peripeties.json';
const TIRAGE = { dice: { n: 1, sides: 10 } };

const chemin = join(ROOT, 'src/data', FICHIER);
const brut = readFileSync(chemin, 'utf8');
const doc = JSON.parse(brut);
const arret = (raison) => {
  console.error(`ARRÊT — ${FICHIER} : ${raison} ; AUCUNE écriture.`);
  process.exit(1);
};
if (brut !== serializeDataset(doc)) arret('forme non canonique');
if (!estMonoTable(doc) || doc.type !== 'peripeties' || typeof doc.die !== 'string') arret('ni le document mono-table `peripeties` ni son `die`');
if (doc.tirageQuotidien !== undefined) {
  console.log(`migration 1667 (d) : ${FICHIER} porte déjà son \`tirageQuotidien\`, rien à écrire.`);
  process.exit(0);
}
const out = serializeDataset(Object.fromEntries(Object.entries(doc).flatMap(([k, v]) => (k === 'die' ? [[k, v], ['tirageQuotidien', TIRAGE]] : [[k, v]]))));
const relu = JSON.parse(out);
if (JSON.stringify(Object.keys(relu)) !== JSON.stringify([...Object.keys(doc).flatMap((k) => (k === 'die' ? [k, 'tirageQuotidien'] : [k]))])) arret('ordre des clés inattendu après écriture');
writeFileSync(chemin, out, 'utf8');
console.log(`migration 1667 (d) : ${FICHIER} reçoit son \`tirageQuotidien\` (1d10, LDB 51 l.208).`);
