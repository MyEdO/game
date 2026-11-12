/**
 * Migration L-monnaie-4 (#1463) — le nom `cost` est RENDU À SON TYPE. Doctrine S2 (« un nom de
 * concept est réservé à son type », `scripts/guards/lib/structuresStock.mjs`) : `cost`/`price` sont
 * les noms du concept MONNAIE (`Money`, `src/engine/money.ts:10`). Six familles portaient ce nom
 * sur tout autre chose ; chacune reçoit le nom de CE qu'elle chiffre.
 *
 * RENOMMAGE PAR CHEMIN DE SCHÉMA, jamais par mot. Un porteur rencontré hors des chemins déclarés
 * est une anomalie → rien n'est écrit, sortie 1. ORDRE DES CLÉS : le nouveau nom prend la PLACE de
 * l'ancien dans l'objet.
 *
 * ENTRÉES : les 5 catalogues porteurs, chacun par son chemin exact — aucun autre fichier n'est lu.
 * Cardinal ASSERTÉ chemin par chemin, total 85 :
 *  - `src/data/actions.json` `[].cost` → `coutAction` — 55 (économie du Tour :
 *    'action'/'mouvement'/'gratuit'/'aucun', jamais une bourse) ;
 *  - `src/data/trappings.json` `[].prosthesisTraining[].cost` → `px` — 6 (LDB 73 l.19 : « pour 100 PX
 *    pour chaque tranche de 5 … la pénalité entière pour 400 PX » ; l.23 : « pour 100 PX … pour 200 PX ») ;
 *  - `src/data/talents.json` `[].variants[].combat.advantageDefenseReaction.cost` → `avantage` — 1 ;
 *  - `src/data/naval-traits.json` `[].install.cost` → `installation` — 21 (barème par bandes de coque
 *    ou 'modele', consommé par `installAmount`, `src/engine/shipBuild.ts`) ;
 *  - `src/data/qualities.json` nœuds Flow `kind:'choice'` — 1 : `cost: {advantage: N}` → `coutEnAvantage: N`,
 *    le nom ET la forme que la donnée authorée donne DÉJÀ à un coût d'Avantage (`ManeuverDef.coutEnAvantage`,
 *    `src/data/index.ts`, `maneuvers.json`) ;
 *  - `src/data/talents.json` ops `grantFreeAttack` — 1 : `cost: {advantageOrMovement: true}` APLATI sur
 *    l'op (`avantageOuMouvement: true`), même vocabulaire (`coutEnAvantage` pour un nombre d'Avantage).
 * Les deux dernières familles sont des RESHAPES, pas des renommages purs : la valeur cible est
 * ASSERTÉE littéralement avant écriture.
 * IDEMPOTENT : rejouée sur l'état final, elle n'écrit rien et sort 0.
 * FORMATAGE PRÉSERVÉ : `JSON.stringify(doc, null, 2)` exact (LF), constaté AVANT toute écriture.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { estObjet } from '../../src/lib/objet.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Chemins PORTEURS, par fichier : suite de clés depuis la racine, `[]` traversant un tableau.
 *  L'objet ATTEINT est celui qui porte la clé à renommer, et il porte `de` XOR `vers`. */
const RENOMMAGES = [
  ['src/data/actions.json', ['[]'], 'cost', 'coutAction'],
  ['src/data/trappings.json', ['[]', 'prosthesisTraining', '[]'], 'cost', 'px'],
  ['src/data/talents.json', ['[]', 'variants', '[]', 'combat', 'advantageDefenseReaction'], 'cost', 'avantage'],
  ['src/data/naval-traits.json', ['[]', 'install'], 'cost', 'installation'],
];
const CARDINAL_RESHAPES = 2;

/** Les nœuds Flow `choice` porteurs d'un coût d'Avantage se COMPTENT au rejeu, ils ne se GÈLENT pas :
 *  un talent de plus peut en apporter un, et un compte gelé lui ferait payer un recalage ici (#1812).
 *  Ce que ce passage possède, c'est la FORME du coût (`cost: {advantage}` → `coutEnAvantage`), vérifiée
 *  nœud par nœud ci-dessous. `CARDINAL_RESHAPES` reste à 2 : le nœud de Déstabilisante + l'op
 *  `grantFreeAttack`, les deux gestes que CE passage a faits. */

const FICHIERS = ['src/data/actions.json', 'src/data/trappings.json', 'src/data/talents.json',
  'src/data/naval-traits.json', 'src/data/qualities.json'];

/** Les objets atteints par un chemin (un maillon absent ne produit rien). */
function* atteints(noeud, chemin) {
  if (chemin.length === 0) { if (estObjet(noeud)) yield noeud; return; }
  if (noeud == null || typeof noeud !== 'object') return;
  const [tete, ...reste] = chemin;
  if (tete === '[]') {
    if (!Array.isArray(noeud)) return;
    for (const e of noeud) yield* atteints(e, reste);
  } else {
    if (Array.isArray(noeud)) return;
    yield* atteints(noeud[tete], reste);
  }
}

/** Tout objet du document satisfaisant `pred`, où qu'il soit. */
function* partout(noeud, pred) {
  if (Array.isArray(noeud)) { for (const e of noeud) yield* partout(e, pred); return; }
  if (noeud == null || typeof noeud !== 'object') return;
  if (pred(noeud)) yield noeud;
  for (const v of Object.values(noeud)) yield* partout(v, pred);
}

/** Remplace EN PLACE le contenu de `o` par `remplacant` (l'identité de l'objet est conservée). */
function remplace(o, remplacant) {
  for (const k of Object.keys(o)) delete o[k];
  Object.assign(o, remplacant);
}

/** `{…, de: v, …}` → `{…, vers: v, …}` : le nouveau nom prend la PLACE de l'ancien. */
function renommeCle(o, de, vers) {
  const sortie = {};
  for (const [k, v] of Object.entries(o)) sortie[k === de ? vers : k] = v;
  return sortie;
}

const documents = new Map();
for (const f of FICHIERS) {
  const abs = path.join(ROOT, f);
  const brut = fs.readFileSync(abs, 'utf8');
  const data = JSON.parse(brut);
  if (JSON.stringify(data, null, 2) !== brut) {
    console.error(`FORME NON CANONIQUE — ${f} n'est pas un JSON indenté à 2 ; AUCUNE écriture.`);
    process.exit(1);
  }
  documents.set(f, { abs, brut, data });
}

const anomalies = [];
let cardinal = 0;

for (const [f, chemin, de, vers] of RENOMMAGES) {
  const { data } = documents.get(f);
  let vus = 0;
  for (const porteur of atteints(data, chemin)) {
    const aDe = Object.hasOwn(porteur, de);
    const aVers = Object.hasOwn(porteur, vers);
    if (aDe && aVers) { anomalies.push(`${f} ${chemin.join('.')} : porteur avec À LA FOIS \`${de}\` et \`${vers}\``); continue; }
    if (!aDe && !aVers) { anomalies.push(`${f} ${chemin.join('.')} : porteur sans coût (${JSON.stringify(porteur)})`); continue; }
    vus++;
    if (aDe) remplace(porteur, renommeCle(porteur, de, vers));
  }
  // PORTE DE FORME, jamais un COMPTE (#1812) : `actions.json`, `trappings.json`, `talents.json` et
  // `naval-traits.json` GRANDISSENT. Ce que ce passage possède, c'est que chaque porteur atteint
  // porte `de` XOR `vers` (ci-dessus, nominatif) — et qu'aucun chemin ne se vide en silence.
  if (!vus) anomalies.push(`${f} ${chemin.join('.')} : AUCUN porteur de coût — périmètre déplacé`);
  cardinal += vus;
}

// RESHAPE 1 — nœud Flow `choice` : `cost: {advantage: N}` → `coutEnAvantage: N`.
let choix = 0;
for (const [f, { data }] of documents) {
  for (const noeud of partout(data, (o) => o.kind === 'choix' && typeof o.invite === 'string')) {
    if (Object.hasOwn(noeud, 'coutEnAvantage')) { choix++; continue; }
    if (!Object.hasOwn(noeud, 'cost')) continue;
    const c = noeud.cost;
    if (!c || typeof c !== 'object' || Object.keys(c).join(',') !== 'advantage' || typeof c.advantage !== 'number') {
      anomalies.push(`${f} : nœud choice au coût de forme inattendue (${JSON.stringify(c)})`);
      continue;
    }
    choix++;
    const sortie = {};
    for (const [k, v] of Object.entries(noeud)) { if (k === 'cost') sortie.coutEnAvantage = c.advantage; else sortie[k] = v; }
    remplace(noeud, sortie);
  }
}
if (!choix) anomalies.push('nœuds Flow `choix` porteurs d’un coût : AUCUN — périmètre déplacé');

// RESHAPE 2 — op `grantFreeAttack` : le sous-objet `cost` est APLATI sur l'op.
let gratuites = 0;
for (const [f, { data }] of documents) {
  for (const op of partout(data, (o) => o.op === 'grantFreeAttack')) {
    if (Object.hasOwn(op, 'avantageOuMouvement') || Object.hasOwn(op, 'coutEnAvantage')) { gratuites++; continue; }
    if (!Object.hasOwn(op, 'cost')) continue;
    const c = op.cost;
    if (!c || typeof c !== 'object' || c.advantageOrMovement !== true || Object.keys(c).length !== 1) {
      anomalies.push(`${f} : \`grantFreeAttack.cost\` de forme inattendue (${JSON.stringify(c)})`);
      continue;
    }
    gratuites++;
    const sortie = {};
    for (const [k, v] of Object.entries(op)) { if (k === 'cost') sortie.avantageOuMouvement = true; else sortie[k] = v; }
    remplace(op, sortie);
  }
}
if (gratuites !== 1) anomalies.push(`ops \`grantFreeAttack\` porteuses d'un coût : ${gratuites} vues, 1 attendue`);

// EXHAUSTIVITÉ : plus AUCUNE clé `cost` dans les 5 documents — ils ne chiffrent aucune bourse.
for (const [f, { data }] of documents) {
  for (const o of partout(data, (x) => Object.hasOwn(x, 'cost'))) {
    anomalies.push(`${f} : clé \`cost\` RESTANTE hors chemin déclaré (${JSON.stringify(o).slice(0, 160)})`);
  }
}

if (anomalies.length) {
  console.error(`ANOMALIES (${anomalies.length}) — AUCUNE écriture :`);
  for (const a of anomalies) console.error(`  - ${a}`);
  process.exit(1);
}

let ecrits = 0;
for (const [, { abs, brut, data }] of documents) {
  const sortie = JSON.stringify(data, null, 2);
  if (sortie === brut) continue;
  fs.writeFileSync(abs, sortie);
  ecrits++;
}

const total = cardinal + CARDINAL_RESHAPES;
console.log(ecrits === 0
  ? `RIEN À FAIRE — les ${total} porteurs ont déjà rendu le nom \`cost\`.`
  : `${total} porteurs rendus à leur type dans ${ecrits} document(s).`);
