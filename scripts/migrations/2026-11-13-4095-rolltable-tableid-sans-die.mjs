/**
 * Migration #4095 — un `rollTable` à `tableId` tire le dé de SA table (`tables.json` › `die`, lu par
 * `effectTableDie`), jamais un `die` posé sur l'op : la variante `tableId` de `GameOp` déclare `die?: never`
 * (`src/engine/ops.ts`) et son schéma n'a pas la clé (`src/data/schemas/grammaire/mecanique.ts`).
 *
 *   fichier             entrée                avant                                         après         source
 *   `trappings.json`    `poings-d-ignominie`  `{ op: 'rollTable', die: 'd10', tableId: T }`  `die` retiré  VDM 12 l.920
 *   (T = `vdm-maladie-coups-de-poing-maudits`, dé `d10` dans `tables.json`)
 *
 * Entrées : src/data/trappings.json (écrite), src/data/tables.json (lue). `MIGRATION_TRAPPINGS` substitue le
 * chemin de `trappings.json` (preuve sur copie).
 *
 * `die` sort de toute op `rollTable` à `tableId` quand il égale le dé de la table ; une op sans `die` : no-op.
 * Un `die` qui diverge, une table introuvable ou un fichier non canonique est un ARRÊT nominatif (exit 1),
 * AUCUNE écriture. Rejouée sur l'arbre migré : no-op byte-identique.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';
import { estObjet } from '../../src/lib/objet.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const chemin = process.env.MIGRATION_TRAPPINGS ?? join(ROOT, 'src/data/trappings.json');
const brut = readFileSync(chemin, 'utf8');
const doc = JSON.parse(brut);
const tablesBrut = readFileSync(join(ROOT, 'src/data/tables.json'), 'utf8');
const tables = JSON.parse(tablesBrut);
const arrets = [];
const gestes = [];

if (brut !== serializeDataset(doc)) arrets.push('trappings.json : forme non canonique');
if (tablesBrut !== serializeDataset(tables)) arrets.push('tables.json : forme non canonique');
if (!arrets.length) {
  const deDe = new Map(tables.map((t) => [t.id, t.die]));
  const visiter = (n, ptr) => {
    if (Array.isArray(n)) { n.forEach((x, i) => visiter(x, `${ptr}/${i}`)); return; }
    if (!estObjet(n)) return;
    if (n.op === 'rollTable' && 'tableId' in n && 'die' in n) {
      const de = deDe.get(n.tableId);
      if (de === undefined) arrets.push(`trappings.json ${ptr} : table « ${n.tableId} » introuvable dans tables.json`);
      else if (n.die !== de) arrets.push(`trappings.json ${ptr} : die « ${n.die} » ≠ dé « ${de} » de la table « ${n.tableId} »`);
      else { delete n.die; gestes.push(ptr); }
    }
    for (const [k, v] of Object.entries(n)) visiter(v, `${ptr}/${k}`);
  };
  visiter(doc, '');
}

if (arrets.length) {
  console.error(`ARRÊT — ${arrets.length} anomalie(s), AUCUNE écriture :`);
  for (const a of arrets) console.error(`  ${a}`);
  process.exit(1);
}
if (gestes.length) writeFileSync(chemin, serializeDataset(doc), 'utf8');
console.log(`migration 4095 (\`rollTable\` à \`tableId\` sans \`die\`) : ${gestes.length} geste(s)${gestes.length ? `, trappings.json › ${gestes.join(', ')}` : ''}.`);
