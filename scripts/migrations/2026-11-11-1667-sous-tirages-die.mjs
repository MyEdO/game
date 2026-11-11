/**
 * Migration #1667 B4 — les deux sous-tirages portés par une racine de document prennent la forme UNIQUE du
 * dé d'une table, `{ die }` (`sousTirage`, `src/data/schemas/grammaire/document.ts`), lue par
 * `deDeLaTableTiree` (`src/engine/tables.ts`). Le dé ne change pas, seule sa forme :
 *
 *   fichier             clé                avant                          après
 *   `stars.json`        `sub`              `{ dice: { n: 1, sides: 10 } }`  `{ die: 'd10' }`  ADE II 03 l.63
 *   `peripeties.json`   `tirageQuotidien`  `{ dice: { n: 1, sides: 10 } }`  `{ die: 'd10' }`  LDB 51 l.208
 *
 * Entrées : src/data/stars.json, src/data/peripeties.json.
 *
 * L'expression se DÉRIVE du `DiceSpec` (`n`, `sides`, `plus?`) et se relit par `parseDice` à l'identique.
 * Un nœud déjà `{ die }` lisible est la forme d'après : no-op. Toute autre forme (clé en plus, `fois`,
 * entier absent, champ manquant), un fichier non canonique ou une racine qui n'est pas le document attendu
 * est un ARRÊT nominatif (exit 1), AUCUNE écriture. Rejouée sur l'arbre migré : no-op byte-identique.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';
import { parseDice } from '../../src/engine/dice.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CIBLES = [
  { fichier: 'stars.json', type: 'stars', cle: 'sub' },
  { fichier: 'peripeties.json', type: 'peripeties', cle: 'tirageQuotidien' },
];

const estObjet = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const memesCles = (o, cles) => JSON.stringify(Object.keys(o).sort()) === JSON.stringify([...cles].sort());
const entier = (v) => Number.isInteger(v);

/** L'expression de dé d'un `DiceSpec` `{ n, sides, plus? }`, ou `null` hors de cette forme. */
function expression(spec) {
  if (!estObjet(spec)) return null;
  const avecPlus = 'plus' in spec;
  if (!memesCles(spec, avecPlus ? ['n', 'sides', 'plus'] : ['n', 'sides'])) return null;
  if (!entier(spec.n) || spec.n < 1 || !entier(spec.sides) || spec.sides < 1 || (avecPlus && (!entier(spec.plus) || spec.plus === 0))) return null;
  const plus = avecPlus ? (spec.plus > 0 ? `+${spec.plus}` : `${spec.plus}`) : '';
  const die = `${spec.n === 1 ? '' : spec.n}d${spec.sides}${plus}`;
  return JSON.stringify(parseDice(die)) === JSON.stringify(spec) ? die : null;
}

const arrets = [];
const ecritures = [];
let gestes = 0;

for (const { fichier, type, cle } of CIBLES) {
  const chemin = join(ROOT, 'src/data', fichier);
  const brut = readFileSync(chemin, 'utf8');
  const doc = JSON.parse(brut);
  if (brut !== serializeDataset(doc)) { arrets.push(`${fichier} : forme non canonique`); continue; }
  if (!estObjet(doc) || doc.type !== type) { arrets.push(`${fichier} : racine qui n'est pas le document \`${type}\``); continue; }
  const noeud = doc[cle];
  if (estObjet(noeud) && memesCles(noeud, ['die']) && typeof noeud.die === 'string' && parseDice(noeud.die) !== null) continue;
  const die = estObjet(noeud) && memesCles(noeud, ['dice']) ? expression(noeud.dice) : null;
  if (die === null) { arrets.push(`${fichier} › ${cle} : forme inattendue ${JSON.stringify(noeud)}`); continue; }
  doc[cle] = { die };
  gestes++;
  ecritures.push([chemin, serializeDataset(doc), fichier]);
}

if (arrets.length) {
  console.error(`ARRÊT — ${arrets.length} anomalie(s), AUCUNE écriture :`);
  for (const a of arrets) console.error(`  ${a}`);
  process.exit(1);
}
for (const [chemin, out] of ecritures) writeFileSync(chemin, out, 'utf8');
console.log(`migration 1667 B4 (sous-tirages en \`die\`) : ${gestes} geste(s)${ecritures.length ? `, ${ecritures.map(([, , f]) => f).join(', ')} réécrit(s)` : ''}.`);
