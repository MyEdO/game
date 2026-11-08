/**
 * Migration #3691 — les paliers de Disponibilité et les axes de récolte passent du libellé à l'id.
 *
 *   `availability`, `give`, clés de `barterRatios[].ratios`   « Commune » → `commune`, « Limitée » → `limitee`…
 *   `harvest.rarity`                                          idem, plus « Unique » → `unique`
 *   `harvest.danger`                                          « Inquiétante » → `inquietante`…
 *
 * La marque `ND` du livre (LDB 62 l.31) n'est pas un palier : jamais touchée.
 * Lecteurs : `availabilitySchema`, `dispoPctAvailabilitySchema`, `harvestRaritySchema`, `harvestDangerSchema`
 * (`src/data/schemas/grammaire/valeurs.ts`), dont les libellés d'affichage sont les anciennes valeurs.
 *
 * PORTE SUR LE RÉSULTAT, par document : aucune valeur de ces champs hors des ids. Au rejeu, no-op
 * byte-identique. Une valeur hors des tables ci-dessous ou un document non canonique est un ARRÊT
 * nominatif (exit 1), AUCUNE écriture.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

const DOCUMENTS = ['trappings.json', 'creatures.json', 'vehicles.json', 'mass-battle.json', 'disponibilite.json'];

const DISPONIBILITE = { Commune: 'commune', Limitée: 'limitee', Rare: 'rare', Exotique: 'exotique' };
const RARETE = { ...DISPONIBILITE, Unique: 'unique' };
const DANGER = { Inoffensive: 'inoffensive', Inquiétante: 'inquietante', Menaçante: 'menacante', Mortelle: 'mortelle' };
const MARQUES = new Set(['ND']);

const arrets = [];

/** La table d'ids que porte le champ `cle` sous `parent` (`null` : champ hors migration). */
function tableDe(cle, parent) {
  if (cle === 'availability') return DISPONIBILITE;
  if (cle === 'give' && parent === 'barterRatios') return DISPONIBILITE;
  if (parent === 'harvest' && cle === 'rarity') return RARETE;
  if (parent === 'harvest' && cle === 'danger') return DANGER;
  return null;
}

function traduire(table, v, ou) {
  if (Object.values(table).includes(v) || MARQUES.has(v) || v === null) return v;
  if (v in table) return table[v];
  arrets.push(`${ou} : « ${v} » hors table`);
  return v;
}

function migrer(noeud, parent, chemin, fichier) {
  if (Array.isArray(noeud)) { noeud.forEach((v, i) => migrer(v, parent, `${chemin}[${i}]`, fichier)); return; }
  if (!noeud || typeof noeud !== 'object') return;
  for (const k of Object.keys(noeud)) {
    const table = tableDe(k, parent);
    if (table && typeof noeud[k] === 'string') noeud[k] = traduire(table, noeud[k], `${fichier} ${chemin}.${k}`);
    else if (k === 'ratios' && parent === 'barterRatios') noeud[k] = Object.fromEntries(Object.entries(noeud[k]).map(([palier, r]) => [traduire(DISPONIBILITE, palier, `${fichier} ${chemin}.ratios`), r]));
    else migrer(noeud[k], k, `${chemin}.${k}`, fichier);
  }
}

const ecritures = [];
for (const fichier of DOCUMENTS) {
  const chemin = `${ROOT}src/data/${fichier}`;
  const brut = readFileSync(chemin, 'utf8');
  const doc = JSON.parse(brut);
  if (brut !== serializeDataset(doc)) { arrets.push(`${fichier} : forme non canonique`); continue; }
  migrer(doc, '', '', fichier);
  const out = serializeDataset(doc);
  if (out !== brut) ecritures.push([chemin, fichier, out]);
}

if (arrets.length) {
  console.error(`ARRÊT — ${arrets.length} anomalie(s), AUCUNE écriture :`);
  for (const a of arrets) console.error(`  ${a}`);
  process.exit(1);
}
for (const [chemin, , out] of ecritures) writeFileSync(chemin, out, 'utf8');
console.log(`migration 3691 : ${ecritures.length} document(s) réécrit(s)${ecritures.length ? ` (${ecritures.map(([, f]) => f).join(', ')})` : ''}.`);
