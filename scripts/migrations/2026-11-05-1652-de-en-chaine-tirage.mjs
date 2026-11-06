/**
 * Migration #1652 — le DÉ EN CHAÎNE de la donnée authorée prend la forme unique du dé (`DiceSpec`).
 *
 *   valeur tirée     `"2d10"` / `"1d10-4"` / `"20+1d10"`      → `{ "dice": { n, sides, plus? } }`
 *   enveloppe `dice` `{ "dice": "2d10" }`                       → `{ "dice": { n: 2, sides: 10 } }`
 *   effet signé      `"+2d10"` / `"-3d10"` (crew-morale)        → `{ "sign": ±1, "dice": { n, sides } }`
 *   effet de Manann  `{ sign, flat, d10 }` (sea-events)         → `{ "sign": ±1, "dice": { n: d10, sides: 10, plus?: flat } }`
 *
 * La clé `die` d'une table (dé de tirage de l'enveloppe) n'est pas une valeur tirée : jamais touchée.
 * Lecteurs : `tirer` / `tirerSigne` (`src/engine/dice.ts`), schémas `tirageSchema` / `effetSigneSchema`
 * (`src/data/schemas/grammaire/valeurs.ts`).
 *
 * Entrées : src/data/arcane-phenomena.json, src/data/crew-morale.json, src/data/problemes-vehicule.json,
 * src/data/river-navigation.json, src/data/river-perils.json, src/data/sea-events.json,
 * src/data/sea-navigation.json, src/data/ship-criticals.json, src/data/steam-breakdown.json.
 *
 * PORTE SUR LE RÉSULTAT, par document : aucun dé en chaîne hors `die` — vrai sur l'arbre d'avant comme au
 * rejeu (no-op byte-identique). Aucun cardinal gelé : les tables sont éditables et une migration suivante
 * peut y ajouter des tirages ou des effets signés (#1812). Toute chaîne hors du patron ou tout document non
 * canonique est un ARRÊT nominatif (exit 1), AUCUNE écriture.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Documents porteurs de dés authorés. */
const DOCUMENTS = [
  'arcane-phenomena.json',
  'crew-morale.json',
  'problemes-vehicule.json',
  'river-navigation.json',
  'river-perils.json',
  'sea-events.json',
  'sea-navigation.json',
  'ship-criticals.json',
  'steam-breakdown.json',
];

/** Graphie en chaîne : signe ?, constante + ?, NdM, ±constante ? (espaces tolérés). */
const CHAINE = /^([+-])?(?:(\d+)\+)?(\d*)d(\d+)([+-]\d+)?$/i;
const estChaineDeDe = (v) => typeof v === 'string' && CHAINE.test(v.replace(/\s+/g, ''));

const arrets = [];

/** `"20+1d10"` → `{sign, de}` ; une constante des DEUX côtés est hors patron. */
function lire(chaine, ou) {
  const [, signe, avant, n, sides, apres] = CHAINE.exec(chaine.replace(/\s+/g, ''));
  if (avant && apres) { arrets.push(`${ou} : « ${chaine} » porte une constante des deux côtés`); return null; }
  const plus = avant ? Number(avant) : apres ? Number(apres) : 0;
  return { signe, de: { n: n ? Number(n) : 1, sides: Number(sides), ...(plus ? { plus } : {}) } };
}

/** Réécrit en place chaque dé en chaîne du nœud ; `chemin` nomme le site au diagnostic. */
function migrer(noeud, chemin, fichier) {
  if (Array.isArray(noeud)) { noeud.forEach((v, i) => { noeud[i] = migrerValeur(v, i, `${chemin}[${i}]`, fichier); }); return; }
  if (noeud && typeof noeud === 'object') for (const k of Object.keys(noeud)) noeud[k] = migrerValeur(noeud[k], k, `${chemin}.${k}`, fichier);
}

function migrerValeur(v, cle, chemin, fichier) {
  if (cle === 'die') return v;
  if (fichier === 'sea-events.json' && cle === 'effect' && v && typeof v === 'object' && 'd10' in v) {
    const { sign, flat, d10 } = v;
    return { sign, dice: { n: d10, sides: 10, ...(flat ? { plus: flat } : {}) } };
  }
  if (!estChaineDeDe(v)) { migrer(v, chemin, fichier); return v; }
  const lu = lire(v, `${fichier} ${chemin}`);
  if (!lu) return v;
  if (fichier === 'crew-morale.json' && cle === 'effect') {
    if (!lu.signe) { arrets.push(`${fichier} ${chemin} : effet « ${v} » sans signe`); return v; }
    return { sign: lu.signe === '-' ? -1 : 1, dice: lu.de };
  }
  if (lu.signe) { arrets.push(`${fichier} ${chemin} : « ${v} » signé hors d'un effet de Moral`); return v; }
  return cle === 'dice' ? lu.de : { dice: lu.de };
}

/** Dés en chaîne restants du document, par chemin. */
function recenser(noeud, acc = [], chemin = '') {
  if (Array.isArray(noeud)) { noeud.forEach((v, i) => recenser(v, acc, `${chemin}[${i}]`)); return acc; }
  if (!noeud || typeof noeud !== 'object') return acc;
  for (const [k, v] of Object.entries(noeud)) {
    if (k !== 'die' && estChaineDeDe(v)) acc.push(`${chemin}.${k}`);
    else recenser(v, acc, `${chemin}.${k}`);
  }
  return acc;
}

const ecritures = [];
for (const fichier of DOCUMENTS) {
  const chemin = `${ROOT}src/data/${fichier}`;
  const brut = readFileSync(chemin, 'utf8');
  const doc = JSON.parse(brut);
  if (brut !== serializeDataset(doc)) { arrets.push(`${fichier} : forme non canonique`); continue; }
  migrer(doc, '', fichier);
  const restants = recenser(doc);
  if (restants.length) arrets.push(`${fichier} : dé(s) en chaîne restant(s) — ${restants.join(', ')}`);
  const out = serializeDataset(doc);
  if (out !== brut) ecritures.push([chemin, fichier, out]);
}

if (arrets.length) {
  console.error(`ARRÊT — ${arrets.length} anomalie(s), AUCUNE écriture :`);
  for (const a of arrets) console.error(`  ${a}`);
  process.exit(1);
}
for (const [chemin, , out] of ecritures) writeFileSync(chemin, out, 'utf8');
console.log(`migration 1652 : ${ecritures.length} document(s) réécrit(s)${ecritures.length ? ` (${ecritures.map(([, f]) => f).join(', ')})` : ''}.`);
