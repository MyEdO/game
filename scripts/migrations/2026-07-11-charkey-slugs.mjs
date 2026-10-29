/**
 * Migration #311 — `CharKey` : `'CC'|'CT'|'F'|'E'|'I'|'Ag'|'Dex'|'Int'|'FM'|'Soc'` → slugs pleins
 * (`'capacite-de-combat'|'capacite-de-tir'|'force'|'endurance'|'initiative'|'agilite'|'dexterite'|
 * 'intelligence'|'force-mentale'|'sociabilite'`). Remap UNIQUEMENT les champs recensés (issue #311) —
 * clé whitelistée ET valeur ∈ anciens tokens (jamais de regex aveugle sur le texte du fichier).
 * Réécrit via `serializeDataset` (2 espaces, PAS de newline final) — round-trip byte-fidèle.
 *
 * Entrées : `src/data/*.json` (tous les datasets, `readdirSync`) + les 3 projets de scène
 * (`src/scenes/{arene,barge-du-sel,loup-et-saumure}/*-projet.json`).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const DATA_DIR = path.join(ROOT, 'src/data');
const SCENES = [
  'src/scenes/arene/arene-projet.json',
  'src/scenes/barge-du-sel/barge-du-sel-projet.json',
  'src/scenes/loup-et-saumure/loup-et-saumure-projet.json',
].map((p) => path.join(ROOT, p));

const OLD_TO_NEW = {
  CC: 'capacite-de-combat',
  CT: 'capacite-de-tir',
  F: 'force',
  E: 'endurance',
  I: 'initiative',
  Ag: 'agilite',
  Dex: 'dexterite',
  Int: 'intelligence',
  FM: 'force-mentale',
  Soc: 'sociabilite',
};
const OLD = new Set(Object.keys(OLD_TO_NEW));

/** Champs recensés (issue #311, point 1) portant une VALEUR CharKey — cf. `src/data/schemas/grammaire/valeurs.ts`
 *  (`charKeySchema`), `engine/ops.ts` (Formula/GameOp), `data/index.ts:730` (`ManeuverDef.stat`). */
const SCALAR_KEYS = new Set([
  'characteristic', 'char', 'bonusOf', 'charOf', 'castingChar', 'radiusStat', 'cap', 'attacker',
  'rangeChar', 'stat',
]);
/** Champs portant un TABLEAU de CharKey (`careerLevels.json#characteristics`). */
const ARRAY_KEYS = new Set(['characteristics']);
/** Champs dont les CLÉS (pas les valeurs) sont des CharKey (`species.json#baseChar`,
 *  `CustomStatblock.char` dans les documents de scène). */
const RECORD_KEY_FIELDS = new Set(['baseChar', 'char']);

let scalarCount = 0;
let arrayCount = 0;
let recordKeyCount = 0;

function remapRecordKeys(obj) {
  const entries = Object.entries(obj).map(([k, v]) => [OLD.has(k) ? (recordKeyCount++, OLD_TO_NEW[k]) : k, v]);
  return Object.fromEntries(entries);
}

function walk(node, parentKey) {
  if (Array.isArray(node)) {
    node.forEach((n) => walk(n, parentKey));
    return node;
  }
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (RECORD_KEY_FIELDS.has(k) && v && typeof v === 'object' && !Array.isArray(v)) {
        // `char` en record-key (statblock) UNIQUEMENT si les clés sont bien des CharKey (sinon
        // c'est le `char` scalaire de Condition/GameOp, traité plus bas).
        const keys = Object.keys(v);
        if (keys.some((kk) => OLD.has(kk)) && keys.every((kk) => OLD.has(kk) || kk === 'M' || kk === 'B')) {
          node[k] = remapRecordKeys(v);
          continue;
        }
      }
      if (ARRAY_KEYS.has(k) && Array.isArray(v)) {
        node[k] = v.map((vv) => {
          if (typeof vv === 'string' && OLD.has(vv)) {
            arrayCount++;
            return OLD_TO_NEW[vv];
          }
          return vv;
        });
        continue;
      }
      if (SCALAR_KEYS.has(k) && typeof v === 'string' && OLD.has(v)) {
        node[k] = OLD_TO_NEW[v];
        scalarCount++;
        continue;
      }
      walk(v, k);
    }
  }
  return node;
}

/** Sérialiseur des documents de scène — reflet de `scripts/{arene,barge-du-sel,loup-et-saumure}/
 *  generate.mjs` (`JSON.stringify(doc, null, 1) + '\n'`), DISTINCT de `serializeDataset` (2 espaces,
 *  sans newline) : les scènes ne sont PAS dans `src/data/` et suivent leur propre convention d'écriture. */
function serializeScene(value) {
  return JSON.stringify(value, null, 1) + '\n';
}

function migrateFile(filePath, { characteristicsIds = false, serialize = serializeDataset } = {}) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(raw);
  walk(data, null);
  if (characteristicsIds) {
    for (const entry of data) {
      if (OLD.has(entry.id)) {
        entry.id = OLD_TO_NEW[entry.id];
        scalarCount++;
      }
    }
  }
  const out = serialize(data);
  if (out !== raw) fs.writeFileSync(filePath, out, 'utf8');
  return out !== raw;
}

const touched = [];

for (const f of fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'))) {
  const full = path.join(DATA_DIR, f);
  const changed = migrateFile(full, { characteristicsIds: f === 'characteristics.json' });
  if (changed) touched.push(f);
}
for (const full of SCENES) {
  const changed = migrateFile(full, { serialize: serializeScene });
  if (changed) touched.push(path.relative(ROOT, full));
}

console.log(`Fichiers modifiés : ${touched.length}`);
for (const f of touched) console.log(`  - ${f}`);
console.log(`Occurrences scalaires remappées : ${scalarCount}`);
console.log(`Occurrences tableau remappées   : ${arrayCount}`);
console.log(`Clés d'enregistrement remappées : ${recordKeyCount}`);
