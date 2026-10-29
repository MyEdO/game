/**
 * Migration L-monnaie-2 (#1463) — la clé `bronze` d'un montant meurt : la 3ᵉ dénomination de la
 * bourse s'écrit `brass`, comme le porte le moteur depuis toujours (`Money`, `src/engine/money.ts:10`).
 * La pièce est un SOU DE CUIVRE (LDB 57 l.7) ; `bronze` est par ailleurs l'ÉCHELON de Statut
 * (`StatusTier`) — deux concepts sous un mot, un seul migre.
 *
 * RENOMMAGE PAR CLÉ, jamais par mot : la migration ne visite que les 5 chemins de schéma ci-dessous
 * (relevé exhaustif des 2 racines authorées, 2026-09-01) et ne touche QUE la clé `bronze` d'un
 * montant. Un porteur rencontré HORS de ces chemins est une anomalie → rien n'est écrit, sortie 1.
 * ORDRE DES CLÉS : `brass` prend la PLACE de `bronze` dans l'objet (les catalogues sont sérialisés
 * tels quels ; l'ordre alphabétique n'est pas une propriété du format).
 * ENTRÉES : les 4 catalogues qui chiffrent un montant, chacun par son chemin de schéma exact — aucun
 * autre fichier n'est lu. Cardinal ASSERTÉ chemin par chemin, total 455 :
 *  - `src/data/trappings.json` `[].price` — 392 (la colonne Prix chiffrée ; `'ND'` et `null` ne sont
 *    pas des montants et n'entrent pas au compte) ;
 *  - `src/data/vehicles.json` `[].purchase.price` — 31 (les 31 entrées portent toutes leur achat) ;
 *  - `src/data/creatures.json` `[].purchase.price` — 14 (les seules créatures ACHETABLES du bestiaire) ;
 *  - `src/data/crew-roles.json` `[].wage.daily` — 9 et `[].wage.weekly` — 9 (les 9 rôles d'équipage,
 *    barème quotidien ET hebdomadaire, colonnes non-multiples l'une de l'autre).
 * RENAME PUR : aucune valeur ne change. PREUVE : les deux artefacts (avant, après) ramenés à la
 * graphie `bronze` sont deep-equal.
 * IDEMPOTENT : rejouée sur l'état final, elle n'écrit rien et sort 0.
 * FORMATAGE PRÉSERVÉ : `JSON.stringify(doc, null, 2)` exact (LF), constaté AVANT toute écriture.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Chemins PORTEURS d'un montant, par fichier : suite de clés depuis la racine, `[]` traversant un
 *  tableau. Leur NOMBRE de montants n'est pas asserté (#1812) : ces catalogues grandissent, et un
 *  objet ou un véhicule neuf doit se MIGRER — ce qui est exigé est la FORME de chaque montant
 *  (exactement une 3ᵉ dénomination, `bronze` OU `brass`) et l'EXHAUSTIVITÉ (plus aucun `bronze`
 *  hors chemin déclaré). */
const CHEMINS = [
  ['src/data/trappings.json', ['[]', 'price']],
  ['src/data/vehicles.json', ['[]', 'purchase', 'price']],
  ['src/data/creatures.json', ['[]', 'purchase', 'price']],
  ['src/data/crew-roles.json', ['[]', 'wage', 'daily']],
  ['src/data/crew-roles.json', ['[]', 'wage', 'weekly']],
];

/** Les nœuds atteints par un chemin (un `price` peut être `'ND'`, `null` ou absent : il n'est pas un montant). */
function* atteints(noeud, chemin) {
  if (chemin.length === 0) { if (noeud && typeof noeud === 'object' && !Array.isArray(noeud)) yield noeud; return; }
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

/** Tout objet portant la clé `bronze` OU `brass`, où qu'il soit — contrôle d'EXHAUSTIVITÉ. */
function* partout(noeud) {
  if (Array.isArray(noeud)) { for (const e of noeud) yield* partout(e); return; }
  if (noeud == null || typeof noeud !== 'object') return;
  if (Object.hasOwn(noeud, 'bronze') || Object.hasOwn(noeud, 'brass')) yield noeud;
  for (const v of Object.values(noeud)) yield* partout(v);
}

/** `{gold, silver, bronze}` → `{gold, silver, brass}` : `brass` prend la PLACE de `bronze`. */
function renomme(o) {
  const sortie = {};
  for (const [k, v] of Object.entries(o)) sortie[k === 'bronze' ? 'brass' : k] = v;
  return sortie;
}

/** Ramène un document à la graphie `bronze` — terrain commun de la preuve avant/après. */
function versBronze(noeud) {
  if (Array.isArray(noeud)) return noeud.map(versBronze);
  if (noeud == null || typeof noeud !== 'object') return noeud;
  const sortie = {};
  for (const [k, v] of Object.entries(noeud)) sortie[k === 'brass' ? 'bronze' : k] = versBronze(v);
  return sortie;
}

const documents = new Map();
for (const [f] of CHEMINS) {
  if (documents.has(f)) continue;
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

for (const [f, chemin] of CHEMINS) {
  const { data } = documents.get(f);
  let vus = 0;
  for (const montant of atteints(data, chemin)) {
    const aBronze = Object.hasOwn(montant, 'bronze');
    const aBrass = Object.hasOwn(montant, 'brass');
    if (aBronze && aBrass) { anomalies.push(`${f} ${chemin.join('.')} : montant portant À LA FOIS bronze et brass`); continue; }
    if (!aBronze && !aBrass) { anomalies.push(`${f} ${chemin.join('.')} : montant sans 3ᵉ dénomination (${JSON.stringify(montant)})`); continue; }
    vus++;
    if (!aBronze) continue;
    const remplacant = renomme(montant);
    for (const k of Object.keys(montant)) delete montant[k];
    Object.assign(montant, remplacant);
  }
  if (!vus) anomalies.push(`${f} ${chemin.join('.')} : AUCUN montant sur un chemin déclaré porteur — périmètre déplacé`);
  cardinal += vus;
}

// EXHAUSTIVITÉ : plus aucun porteur de `bronze` hors des chemins déclarés (les objets des chemins
// portent désormais `brass`) — un montant oublié ailleurs dans ces 4 documents est une anomalie.
for (const [f, { data }] of documents) {
  for (const o of partout(data)) {
    if (Object.hasOwn(o, 'bronze')) anomalies.push(`${f} : montant HORS chemin déclaré (${JSON.stringify(o)})`);
  }
}

if (anomalies.length) {
  console.error(`ANOMALIES (${anomalies.length}) — AUCUNE écriture :`);
  for (const a of anomalies) console.error(`  - ${a}`);
  process.exit(1);
}

let ecrits = 0;
for (const [f, { abs, brut, data }] of documents) {
  assert.deepEqual(versBronze(data), versBronze(JSON.parse(brut)), `${f} : la migration a changé autre chose que le NOM de la clé`);
  const sortie = JSON.stringify(data, null, 2);
  if (sortie === brut) continue;
  fs.writeFileSync(abs, sortie);
  ecrits++;
}

console.log(ecrits === 0
  ? `RIEN À FAIRE — les ${cardinal} montants portent déjà \`brass\`.`
  : `${cardinal} montants renommés \`bronze\` → \`brass\` dans ${ecrits} document(s).`);
