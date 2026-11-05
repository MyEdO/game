/**
 * Migration #1669 T2 — une table à fourchettes porte ses rangées sous `entries` et son dé de tirage
 * sous `die` (`deDeTirageSchema`, `src/data/schemas/grammaire/valeurs.ts`).
 *
 *   `mutationTables.json`   `[].ranges`           → `[].entries`, `die` posé juste avant
 *   `weather.json`          `.seasons[].ranges`   → `.seasons[].entries`, `die` posé juste avant
 *
 * Renommage EN PLACE : la clé garde son rang dans l'objet. Le `die` n'est écrit que là où il manque ;
 * un `die` déjà présent est une donnée, laissée telle quelle. Dés imprimés :
 *   - `physique` : LDB 19 l.116 ; `mentale` : LDB 19 l.144 ;
 *   - `edoc-phys-*` : EDOC 12 l.65 ; `edoc-tete-bestiale-*` : EDOC 12 l.152 ; `edoc-mental-*` : EDOC 12 l.204 ;
 *   - saisons de `weather.json` : EDOC 8 l.52-59 (bandes 01-00).
 *
 * Entrées : src/data/mutationTables.json, src/data/weather.json.
 *
 * FORME ASSERTÉE SUR LE RÉSULTAT, par fichier : chaque table porte `entries` et `die`, aucune ne porte
 * plus `ranges`. Aucun cardinal : un renommage vaut pour toute table présente, qu'une donnée en ajoute
 * (#1812) ou en retire (#3080). Vrai sur l'arbre d'avant comme au rejeu (no-op byte-identique). Tout
 * écart, toute table portant les deux clés ou tout document non canonique est un ARRÊT nominatif
 * (exit 1), AUCUNE écriture.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Le dé IMPRIMÉ, commun à toutes les tables de ces deux fichiers (réfs en en-tête). */
const DE_IMPRIME = 'd100';

/** Les tables du fichier : [objet porteur, chemin lisible]. */
const TABLES_DE = {
  'mutationTables.json': (doc) => doc.map((t, i) => [t, `[${i}] ${t.id}`]),
  'weather.json': (doc) => (doc.seasons ?? []).map((s, i) => [s, `.seasons[${i}] ${s.id}`]),
};

/** Renomme `ranges` en `entries` au même rang, et pose `die` juste avant `entries` s'il manque. */
function migrer(table) {
  const copie = Object.entries(table);
  const sansDe = !('die' in table);
  for (const k of Object.keys(table)) delete table[k];
  for (const [k, v] of copie) {
    const cle = k === 'ranges' ? 'entries' : k;
    if (cle === 'entries' && sansDe) table.die = DE_IMPRIME;
    table[cle] = v;
  }
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
    if ('ranges' in t && 'entries' in t) arrets.push(`${fichier} ${ou} : porte à la fois \`ranges\` et \`entries\``);
    else if ('ranges' in t || !('die' in t)) migrer(t);
  }
  for (const [t, ou] of tables) {
    if (!Array.isArray(t.entries)) arrets.push(`${fichier} ${ou} : aucune rangée sous \`entries\``);
    if (typeof t.die !== 'string') arrets.push(`${fichier} ${ou} : aucun dé de tirage \`die\``);
  }
  const out = serializeDataset(doc);
  if (out !== brut) ecritures.push([chemin, fichier, out]);
}

if (arrets.length) {
  console.error(`ARRÊT — ${arrets.length} anomalie(s), AUCUNE écriture :`);
  for (const a of arrets) console.error(`  ${a}`);
  process.exit(1);
}
for (const [chemin, , out] of ecritures) writeFileSync(chemin, out, 'utf8');
console.log(`migration 1669 T2 : ${ecritures.length} document(s) réécrit(s)${ecritures.length ? ` (${ecritures.map(([, f]) => f).join(', ')})` : ''}.`);
