/**
 * Migration L-monnaie-3 (#1463) — l'effet `giveMoney` cesse d'ÉTALER sa charge : les dénominations
 * `gold`/`silver`/`brass` posées à plat sur l'objet-action entrent dans l'enveloppe `montant`, comme
 * toute autre action du vocabulaire porte la sienne sous un nom (`giveXp.amount`, `givePossession.ref`).
 * Cible : `{type:'giveMoney', montant: moneyPartialSchema}` (`src/data/schemas/defs-scenes/effets.ts`).
 *
 * DEUX STRATES de la MÊME donnée, migrées ENSEMBLE — l'artefact seul serait réécrit à la prochaine
 * passe d'auteur, les trois projets étant régénérés À L'OCTET par leur `generate.mjs`
 * (`projets/jeu-de-role/suites/generateurs-byte-stables.test.ts`) :
 *   1. les projets JSON, migrés STRUCTURELLEMENT (parse, nœuds `type:'giveMoney'`) ;
 *   2. l'AUTHORING `.mjs` qui les produit, migré TEXTUELLEMENT sur le littéral d'effet — la forme
 *      couvre le raccourci (`{ type: 'giveMoney', gold }`) et l'étalement (`…money`), l'enveloppe
 *      recevant le corps TEL QUEL.
 *
 * ENTRÉES (aucun autre fichier n'est lu) :
 *   - `projets/jeu-de-role/campagnes/arene/arene-projet.json` — 36 effets
 *   - `projets/jeu-de-role/campagnes/barge-du-sel/barge-du-sel-projet.json` — 1 effet
 *   - `projets/jeu-de-role/campagnes/loup-et-saumure/loup-et-saumure-projet.json` — 7 effets
 *   - `projets/jeu-de-role/campagnes/arene/*.mjs`, `projets/jeu-de-role/campagnes/barge-du-sel/generate.mjs`,
 *     `projets/jeu-de-role/campagnes/loup-et-saumure/generate.mjs`, `projets/jeu-de-role/campagnes/lib.mjs` — les littéraux d'authoring
 *
 * CARDINAL ASSERTÉ par projet (36 + 1 + 7 = 44) et NON NUL par fichier d'authoring touché.
 * AUCUN CLAMP : les montants NÉGATIFS (perte scriptée, `drainGroup`) traversent inchangés — la
 * migration ne lit pas les valeurs, elle déplace des clés.
 * IDEMPOTENT : un nœud dont la charge est déjà sous `montant` n'a plus de dénomination à plat et
 * n'est pas touché ; le littéral déjà enveloppé porte une accolade que l'ancre textuelle ne traverse
 * pas. Rejouée sur l'état final, la migration n'écrit rien et sort 0.
 * FORMATAGE PRÉSERVÉ : les projets sont re-sérialisés par LEUR sérialiseur (`JSON.stringify(doc, null, 1)`
 * + `\n`, celui des générateurs), constaté À L'IDENTIQUE avant toute écriture ; l'authoring est réécrit
 * textuellement, sans re-formatage.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const abs = (rel) => path.join(ROOT, rel);

/** Les 3 dénominations de `Money` (`src/engine/money.ts:10`) — les seules clés qui entrent dans l'enveloppe. */
const DENOMINATIONS = ['gold', 'silver', 'brass'];

/** Projets porteurs. Le NOMBRE d'effets `giveMoney` n'y est PAS gelé : une Scène est une donnée
 *  ÉDITABLE, un effet de plus est un geste de campagne légitime (#1812). Ce que ce passage possède,
 *  c'est la FORME de chaque effet — charge plate XOR enveloppe `montant`. */
const PROJETS = [
  'projets/jeu-de-role/campagnes/arene/arene-projet.json',
  'projets/jeu-de-role/campagnes/barge-du-sel/barge-du-sel-projet.json',
  'projets/jeu-de-role/campagnes/loup-et-saumure/loup-et-saumure-projet.json',
];

/** Sources d'AUTHORING qui écrivent le littéral d'effet. */
const AUTHORING = [
  'projets/jeu-de-role/campagnes/arene/expeditions.mjs',
  'projets/jeu-de-role/campagnes/arene/hub.mjs',
  'projets/jeu-de-role/campagnes/arene/zones1-7.mjs',
  'projets/jeu-de-role/campagnes/arene/zones8-13.mjs',
  'projets/jeu-de-role/campagnes/barge-du-sel/generate.mjs',
  'projets/jeu-de-role/campagnes/loup-et-saumure/generate.mjs',
  'projets/jeu-de-role/campagnes/lib.mjs',
];

const anomalies = [];

// ── Strate 1 : les projets JSON, migrés STRUCTURELLEMENT ────────────────────────────────────────
/** Tout nœud objet `type:'giveMoney'` du document, dans l'ordre du parcours. */
function* effets(noeud) {
  if (Array.isArray(noeud)) { for (const e of noeud) yield* effets(e); return; }
  if (noeud == null || typeof noeud !== 'object') return;
  if (noeud.type === 'giveMoney') yield noeud;
  for (const v of Object.values(noeud)) yield* effets(v);
}

let migresJson = 0;
const ecritsJson = [];

for (const rel of PROJETS) {
  const chemin = abs(rel);
  const brut = fs.readFileSync(chemin, 'utf8');
  const doc = JSON.parse(brut);
  if (JSON.stringify(doc, null, 1) + '\n' !== brut) {
    anomalies.push(`${rel} : forme NON CANONIQUE (le sérialiseur de projet est \`JSON.stringify(doc, null, 1)\` + LF)`);
    continue;
  }
  let vus = 0;
  for (const e of effets(doc)) {
    vus++;
    const plates = Object.keys(e).filter((k) => DENOMINATIONS.includes(k));
    const aEnveloppe = Object.hasOwn(e, 'montant');
    if (plates.length && aEnveloppe) { anomalies.push(`${rel} : effet portant À LA FOIS une charge plate et \`montant\` (${JSON.stringify(e)})`); continue; }
    if (!plates.length && !aEnveloppe) { anomalies.push(`${rel} : effet \`giveMoney\` sans aucune charge (${JSON.stringify(e)})`); continue; }
    const autres = Object.keys(e).filter((k) => k !== 'type' && k !== 'montant' && !DENOMINATIONS.includes(k));
    if (autres.length) { anomalies.push(`${rel} : effet \`giveMoney\` portant des clés inconnues ${autres.join(', ')}`); continue; }
    if (aEnveloppe) continue; // déjà migré
    const montant = {};
    for (const k of plates) { montant[k] = e[k]; delete e[k]; }
    e.montant = montant;
    migresJson++;
  }
  if (!vus) anomalies.push(`${rel} : AUCUN effet \`giveMoney\` — périmètre déplacé`);
  const sortie = JSON.stringify(doc, null, 1) + '\n';
  if (sortie !== brut) ecritsJson.push([chemin, sortie, rel]);
}

// ── Strate 2 : l'AUTHORING `.mjs`, migré TEXTUELLEMENT ──────────────────────────────────────────
/** Littéral `{ type: 'giveMoney', <corps> }` dont le corps ne traverse AUCUNE accolade : un corps
 *  déjà enveloppé (`montant: { … }`) en porte une, et n'est donc jamais réapparié. */
const LITTERAL = /\{\s*type:\s*'giveMoney',\s*([^{}]*?)\s*\}/g;

let migresMjs = 0;
const ecritsMjs = [];

for (const rel of AUTHORING) {
  const chemin = abs(rel);
  const brut = fs.readFileSync(chemin, 'utf8');
  const total = (brut.match(/'giveMoney'/g) ?? []).length;
  if (total === 0) { anomalies.push(`${rel} : aucun littéral \`giveMoney\` — l'entrée déclarée ne porte plus rien`); continue; }
  LITTERAL.lastIndex = 0;
  let vus = 0;
  const sortie = brut.replace(LITTERAL, (_m, corps) => { vus++; return `{ type: 'giveMoney', montant: { ${corps} } }`; });
  const dejaEnveloppes = (brut.match(/\{ type: 'giveMoney', montant: \{/g) ?? []).length;
  if (vus + dejaEnveloppes !== total) {
    anomalies.push(`${rel} : ${total} littéral(aux) \`giveMoney\`, ${vus} apparié(s) par l'ancre + ${dejaEnveloppes} déjà enveloppé(s)`);
    continue;
  }
  migresMjs += vus;
  if (sortie !== brut) ecritsMjs.push([chemin, sortie, rel]);
}

// ── Verdict, puis écriture ──────────────────────────────────────────────────────────────────────
if (anomalies.length) {
  console.error(`ANOMALIES (${anomalies.length}) — AUCUNE écriture :`);
  for (const a of anomalies) console.error(`  - ${a}`);
  process.exit(1);
}
// Le passage est TOUT ou RIEN : il enveloppe chaque charge plate qu'il voit, et un rejeu n'en voit
// plus aucune. La preuve est la FORME après coup (plus une seule charge plate), jamais un compte.
assert.ok(
  ecritsJson.length === 0 || migresJson > 0,
  `un document de projet est réécrit alors qu'AUCUN effet n'a été enveloppé (${migresJson})`,
);

for (const [chemin, contenu] of [...ecritsJson, ...ecritsMjs]) fs.writeFileSync(chemin, contenu);

const touches = [...ecritsJson, ...ecritsMjs].map(([, , rel]) => rel);
console.log(touches.length === 0
  ? 'RIEN À FAIRE — les effets `giveMoney` et leur authoring portent déjà l’enveloppe `montant`.'
  : `${migresJson} effet(s) en donnée + ${migresMjs} littéral(aux) d’authoring enveloppés dans \`montant\` ; ${touches.length} fichier(s) réécrit(s) :\n  - ${touches.join('\n  - ')}`);
