/**
 * Migration L4 #1463 (vague `de`) — le terme « (Points de Péché) » a seulement UNE graphie.
 *
 * Trois graphies disaient le MÊME terme du livre. Toutes passent à la composition GÉNÉRALE
 * (`sum` + `sinPoints`, `src/data/schemas/grammaire/valeurs.ts`) :
 *
 *   `{ dice: { n, sides, sinPlus: true } }` → `{ sum: [ { dice: { n, sides } }, { sinPoints: true } ] }`
 *   `{ sinPlus1: true }`                    → `{ sum: [ 1, { sinPoints: true } ] }`
 *   op `{ …, sinPlus1Value: true }`         → op `{ …, value: { sum: [ 1, { sinPoints: true } ] } }`
 *
 * Le dé redevient le `DiceSpec` unique du projet (`src/engine/dice.ts`), et « + (Points de Péché) »
 * devient un TERME de formule. Les 10 sites, avec la ligne du livre qui les imprime :
 *
 *   colere-tenez-compte-de-mes-enseignements        ops[0].rounds  1d10  LDB 40 l.58
 *   colere-je-trouve-inquietant-votre-manque-de-foi ops[0].rounds  1d10  LDB 40 l.62
 *   colere-cessez-vos-babillages                    ops[0].rounds  2d10  LDB 40 l.65
 *   colere-ressentez-ma-colere                      ops[0].amount  1d10  LDB 40 l.68
 *   colere-qu-allez-vous-sacrifier                  ops[0].amount  1d10  LDB 40 l.73
 *   colere-purifier-la-chair                        ops[0].amount  2d10  LDB 40 l.75
 *   colere-partagez-ma-douleur                      ops[0].amount  1     LDB 40 l.63
 *   colere-blessures-divines                        ops[0].value   1     LDB 40 l.71
 *   colere-frappe-de-cecite                         ops[1].value   1     LDB 40 l.72
 *   colere-redoutez-ma-colere                       ops[0].value   1     LDB 40 l.77
 *
 * CARDINAL ASSERTÉ SUR LE RÉSULTAT : le document final porte exactement ces 10 sommes
 * sin-paramétrées — 6 dés (4 à `n:1`, 2 à `n:2`) et 4 « 1 + » —, ni plus ni moins. L'assertion vaut
 * donc sur un arbre vierge comme au rejeu ; tout écart est un ARRÊT (exit 1).
 *
 * ENTRÉES : `src/data/miscast.json` (seul document lu et écrit).
 * IDEMPOTENT : rejouée, elle ne voit plus aucun `sinPlus` et n'écrit rien.
 * FORMATAGE : `JSON.stringify(doc, null, 2)`, vérifié canonique AVANT toute écriture.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const FICHIER = path.join(ROOT, 'src/data/miscast.json');

/** Les 10 sites attendus : `<id de rangée> › <champ>` → `n` du dé, ou `1` pour un « 1 + (PP) ». */
const ATTENDUS_DES = {
  'colere-tenez-compte-de-mes-enseignements › rounds': 1,
  'colere-je-trouve-inquietant-votre-manque-de-foi › rounds': 1,
  'colere-cessez-vos-babillages › rounds': 2,
  'colere-ressentez-ma-colere › amount': 1,
  'colere-qu-allez-vous-sacrifier › amount': 1,
  'colere-purifier-la-chair › amount': 2,
};
/** Les « 1 + (Points de Péché) » : montant de Blessures et VALEUR d'État (pions gagnés). */
const ATTENDUS_UN = [
  'colere-partagez-ma-douleur › amount',
  'colere-blessures-divines › value',
  'colere-frappe-de-cecite › value',
  'colere-redoutez-ma-colere › value',
];

const brut = fs.readFileSync(FICHIER, 'utf8');
const doc = JSON.parse(brut);
if (brut !== JSON.stringify(doc, null, 2)) {
  console.error('FORME NON CANONIQUE — src/data/miscast.json ; AUCUNE écriture.');
  process.exit(1);
}

const arrets = [];
/** Sites migrés depuis un DÉ sin-paramétré : `site` → `n` du dé. @type {Record<string, number>} */
const migresDes = {};
/** Sites migrés depuis un « 1 + (Points de Péché) » (`sinPlus1` / `sinPlus1Value`). @type {string[]} */
const migresUn = [];

/** « 1 + (Points de Péché) » à la forme générale. */
const unPlusPeche = () => ({ sum: [1, { sinPoints: true }] });

/** Marche TOUT nœud d'une rangée : les graphies se cherchent partout où une formule peut vivre
 *  (`ops[].rounds|amount|value`, mais aussi un `test.onFail[]`), jamais aux seuls chemins connus. */
function marcher(noeud, id) {
  if (Array.isArray(noeud)) { for (const e of noeud) marcher(e, id); return; }
  if (!noeud || typeof noeud !== 'object') return;
  // `sinPlus1Value` est un drapeau de l'OP lui-même : il POSE la `value` que l'op n'écrivait pas.
  if (noeud.sinPlus1Value === true) {
    const site = `${id} › value`;
    if (noeud.value !== undefined) {
      arrets.push(`${site} : op portant DÉJÀ une \`value\` (${JSON.stringify(noeud.value)}) sous \`sinPlus1Value\``);
    } else {
      migresUn.push(site);
      // La `value` prend la PLACE du drapeau : l'ordre des clés du document est conservé.
      for (const [k, v] of Object.entries({ ...noeud })) {
        delete noeud[k];
        if (k === 'sinPlus1Value') noeud.value = unPlusPeche();
        else noeud[k] = v;
      }
    }
  }
  for (const champ of Object.keys(noeud)) {
    const v = noeud[champ];
    if (v && typeof v === 'object' && v.dice && v.dice.sinPlus === true) {
      const site = `${id} › ${champ}`;
      const { n, sides, plus } = v.dice;
      if (plus !== undefined) {
        arrets.push(`${site} : dé sin-paramétré portant DÉJÀ un \`plus\` (${plus}) — somme ambiguë`);
        continue;
      }
      migresDes[site] = n;
      noeud[champ] = { sum: [{ dice: { n, sides } }, { sinPoints: true }] };
      continue;
    }
    if (v && typeof v === 'object' && v.sinPlus1 === true) {
      const site = `${id} › ${champ}`;
      if (Object.keys(v).length !== 1) {
        arrets.push(`${site} : \`sinPlus1\` cohabitant avec ${Object.keys(v).filter((k) => k !== 'sinPlus1').join(', ')}`);
        continue;
      }
      migresUn.push(site);
      noeud[champ] = unPlusPeche();
      continue;
    }
    marcher(v, id);
  }
}

for (const document of doc) {
  for (const rangee of document.entries ?? []) marcher(rangee, rangee.id);
}

const sitesDes = Object.keys(migresDes).sort();
const sitesUn = [...migresUn].sort();
const total = sitesDes.length + sitesUn.length;

/**
 * CARDINAL asserté sur le RÉSULTAT, jamais sur le seul delta : le document FINAL doit porter les 10
 * sommes sin-paramétrées, ni plus ni moins — vrai sur un arbre vierge comme sur un rejeu.
 */
const estTermeSin = (v) => v && typeof v === 'object' && v.sinPoints === true && Object.keys(v).length === 1;
/** `{sum:[X, {sinPoints:true}]}` → `X` ; `null` si ce n'est pas une somme sin-paramétrée. */
const termeDeSomme = (v) => {
  if (!v || typeof v === 'number' || Object.keys(v).join() !== 'sum' || !Array.isArray(v.sum) || v.sum.length !== 2) return null;
  return estTermeSin(v.sum[1]) ? v.sum[0] : null;
};
/** @type {Record<string, number>} sites du document final : `site` → `n` du dé, `0` pour « 1 + ». */
const constat = {};
const constater = (noeud, id) => {
  if (Array.isArray(noeud)) { for (const e of noeud) constater(e, id); return; }
  if (!noeud || typeof noeud !== 'object') return;
  for (const champ of Object.keys(noeud)) {
    const terme = termeDeSomme(noeud[champ]);
    if (terme === null) { constater(noeud[champ], id); continue; }
    const site = `${id} › ${champ}`;
    if (terme === 1) constat[site] = 0;
    else if (terme && typeof terme === 'object' && terme.dice) constat[site] = terme.dice.n;
    else arrets.push(`${site} : somme sin-paramétrée dont le premier terme est ${JSON.stringify(terme)}`);
  }
};
for (const document of doc) {
  for (const rangee of document.entries ?? []) constater(rangee, rangee.id);
}

const attendu = { ...ATTENDUS_DES, ...Object.fromEntries(ATTENDUS_UN.map((s) => [s, 0])) };
const vus = Object.keys(constat).sort();
const nommes = Object.keys(attendu).sort();
if (vus.join('\n') !== nommes.join('\n')) {
  arrets.push(`sites sin-paramétrés du document ≠ sites nommés :\n    vus     : ${vus.join(', ')}\n    nommés  : ${nommes.join(', ')}`);
} else {
  for (const s of vus) {
    if (constat[s] !== attendu[s]) arrets.push(`${s} : terme ${constat[s] ? `dé n=${constat[s]}` : '« 1 »'}, attendu ${attendu[s] ? `dé n=${attendu[s]}` : '« 1 »'}`);
  }
}

if (arrets.length) {
  console.error(`ARRÊT — ${arrets.length} anomalie(s), AUCUNE écriture :`);
  for (const a of arrets) console.error(`  ${a}`);
  process.exit(1);
}

const out = JSON.stringify(doc, null, 2);
if (out === brut) {
  console.log('src/data/miscast.json — INCHANGÉ (no-op byte-identique).');
  process.exit(0);
}
if (out.includes('\r')) {
  console.error(`${FICHIER} : \\r dans le texte réécrit ; AUCUNE écriture.`);
  process.exit(1);
}
fs.writeFileSync(FICHIER, out, 'utf8');
console.log(`src/data/miscast.json — réécrit (${total} site(s) : ${[...sitesDes, ...sitesUn].sort().join(', ')}).`);
