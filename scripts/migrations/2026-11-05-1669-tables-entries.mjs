/**
 * Migration #1669 T1 — une table à fourchettes porte ses rangées sous `entries`, la clé que pose la
 * fabrique (`document(…, { rangee })`, `src/data/schemas/grammaire/document.ts`) et que lit la porte
 * `rangeesDe` (`src/data/rangees.ts`).
 *
 *   `tables.json`              `[].rows`                          → `[].entries`
 *   `arcane-phenomena.json`    `.tables[].rows`                   → `.tables[].entries`
 *   op `rollTable` en ligne    `{ op: 'rollTable', die, rows }`   → `{ op: 'rollTable', die, entries }`
 *
 * Renommage EN PLACE : la clé garde son rang dans l'objet. Le `die` n'est pas touché.
 *
 * Entrées : src/data/tables.json, src/data/arcane-phenomena.json, src/data/spells.json,
 * src/data/symptoms.json.
 *
 * FORME ASSERTÉE SUR LE RÉSULTAT, par fichier : chaque table porte `entries` et aucune ne porte plus
 * `rows`. Aucun cardinal : un renommage vaut pour toute table présente, qu'une donnée en ajoute (#1812)
 * ou en retire (#3080). Vrai sur l'arbre d'avant comme au rejeu (no-op byte-identique). Tout
 * écart, toute table portant les deux clés ou tout document non canonique est un ARRÊT nominatif
 * (exit 1), AUCUNE écriture.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Les tables du fichier : [objet porteur, chemin lisible]. */
const TABLES_DE = {
  'tables.json': (doc) => doc.map((t, i) => [t, `[${i}] ${t.id}`]),
  'arcane-phenomena.json': (doc) => (doc.tables ?? []).map((t, i) => [t, `.tables[${i}] ${t.id}`]),
  'spells.json': (doc) => opsRollTableEnLigne(doc),
  'symptoms.json': (doc) => opsRollTableEnLigne(doc),
};


/** Les ops `rollTable` à table EN LIGNE (sans `tableId`) du document, à toute profondeur. */
function opsRollTableEnLigne(noeud, chemin = '', acc = []) {
  if (Array.isArray(noeud)) noeud.forEach((v, i) => opsRollTableEnLigne(v, `${chemin}[${i}]`, acc));
  else if (noeud && typeof noeud === 'object') {
    if (noeud.op === 'rollTable' && !('tableId' in noeud)) acc.push([noeud, chemin]);
    for (const [k, v] of Object.entries(noeud)) opsRollTableEnLigne(v, `${chemin}.${k}`, acc);
  }
  return acc;
}

/** Renomme `rows` en `entries` au même rang. */
function renommer(table) {
  const copie = Object.entries(table);
  for (const k of Object.keys(table)) delete table[k];
  for (const [k, v] of copie) table[k === 'rows' ? 'entries' : k] = v;
}

const arrets = [];
const ecritures = [];
for (const fichier of Object.keys(TABLES_DE)) {
  const chemin = join(ROOT, 'src/data', fichier);
  const brut = readFileSync(chemin, 'utf8');
  const doc = JSON.parse(brut);
  if (brut !== serializeDataset(doc)) { arrets.push(`${fichier} : forme non canonique`); continue; }
  const tables = TABLES_DE[fichier](doc);
  for (const [t, ou] of tables) {
    if ('rows' in t && 'entries' in t) arrets.push(`${fichier} ${ou} : porte à la fois \`rows\` et \`entries\``);
    else if ('rows' in t) renommer(t);
  }
  for (const [t, ou] of tables) if (!Array.isArray(t.entries)) arrets.push(`${fichier} ${ou} : aucune rangée sous \`entries\``);
  const out = serializeDataset(doc);
  if (out !== brut) ecritures.push([chemin, fichier, out]);
}

if (arrets.length) {
  console.error(`ARRÊT — ${arrets.length} anomalie(s), AUCUNE écriture :`);
  for (const a of arrets) console.error(`  ${a}`);
  process.exit(1);
}
for (const [chemin, , out] of ecritures) writeFileSync(chemin, out, 'utf8');
console.log(`migration 1669 : ${ecritures.length} document(s) réécrit(s)${ecritures.length ? ` (${ecritures.map(([, f]) => f).join(', ')})` : ''}.`);
