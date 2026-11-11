/**
 * Migration #1667 B4 — les deux sous-tirages portés par une racine de document prennent la forme UNIQUE du
 * dé d'une table, `{ die }` (`sousTirage`, `src/data/schemas/grammaire/document.ts`), lue par
 * `deDeLaTableTiree` (`src/engine/tables.ts`). Le dé ne change pas, seule sa forme :
 *
 *   fichier             clé                avant                            après
 *   `stars.json`        `sub`              `{ dice: { n: 1, sides: 10 } }`  `{ die: 'd10' }`  ADE II 03 l.63
 *   `peripeties.json`   `tirageQuotidien`  `{ dice: { n: 1, sides: 10 } }`  `{ die: 'd10' }`  LDB 51 l.208
 *
 * Entrées : src/data/stars.json, src/data/peripeties.json.
 *
 * `AVANT` est la constante que posent `2026-11-06-1667-tableaux-racines-mono-tables.mjs` et
 * `2026-11-06-1667-tirage-du-seuil-des-peripeties.mjs`. Un nœud égal à `APRES` : no-op. Toute autre forme,
 * un fichier non canonique ou une racine qui n'est pas le document attendu est un ARRÊT nominatif (exit 1),
 * AUCUNE écriture. Rejouée sur l'arbre migré : no-op byte-identique.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { serializeDataset } from '../../src/data/serialize.ts';
import { estObjet } from '../../src/lib/objet.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const AVANT = { dice: { n: 1, sides: 10 } };
const APRES = { die: 'd10' };
const CIBLES = [
  { fichier: 'stars.json', type: 'stars', cle: 'sub' },
  { fichier: 'peripeties.json', type: 'peripeties', cle: 'tirageQuotidien' },
];

const arrets = [];
const ecritures = [];

for (const { fichier, type, cle } of CIBLES) {
  const chemin = join(ROOT, 'src/data', fichier);
  const brut = readFileSync(chemin, 'utf8');
  const doc = JSON.parse(brut);
  if (brut !== serializeDataset(doc)) { arrets.push(`${fichier} : forme non canonique`); continue; }
  if (!estObjet(doc) || doc.type !== type) { arrets.push(`${fichier} : racine qui n'est pas le document \`${type}\``); continue; }
  if (isDeepStrictEqual(doc[cle], APRES)) continue;
  if (!isDeepStrictEqual(doc[cle], AVANT)) { arrets.push(`${fichier} › ${cle} : forme inattendue ${JSON.stringify(doc[cle])}`); continue; }
  doc[cle] = { ...APRES };
  ecritures.push([chemin, serializeDataset(doc), fichier]);
}

if (arrets.length) {
  console.error(`ARRÊT — ${arrets.length} anomalie(s), AUCUNE écriture :`);
  for (const a of arrets) console.error(`  ${a}`);
  process.exit(1);
}
for (const [chemin, out] of ecritures) writeFileSync(chemin, out, 'utf8');
console.log(`migration 1667 B4 (sous-tirages en \`die\`) : ${ecritures.length} geste(s)${ecritures.length ? `, ${ecritures.map(([, , f]) => f).join(', ')} réécrit(s)` : ''}.`);
