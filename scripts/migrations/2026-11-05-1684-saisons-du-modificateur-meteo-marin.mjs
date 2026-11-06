/**
 * Migration #1684 (#1463) — le MODIFICATEUR SAISONNIER de la météo marine (MDG 13 l.164-166) compose la
 * valeur par saison de la grammaire (`parSaison`, `src/data/schemas/grammaire/valeurs.ts`) au lieu de
 * redéclarer ses quatre colonnes :
 *
 *   `sea-weather.json › seasonMod.{printemps,ete,automne,hiver}`  →  `seasonMod.saisons.{…}`
 *
 * `source` reste sur `seasonMod`. Chaque valeur passe à l'octet près, dans l'ordre des colonnes de
 * `parSaison`.
 *
 * ENTRÉES : `src/data/sea-weather.json` (seul document lu et écrit).
 *
 * FORME ASSERTÉE SUR LE RÉSULTAT : `seasonMod` ne porte que `saisons` et `source`, et `saisons` porte
 * un nombre par saison. Rejouée, elle trouve `saisons` déjà posé et n'écrit rien. Tout écart (saison
 * présente aux deux niveaux, clé inconnue, valeur non numérique, document non canonique) est un ARRÊT
 * nominatif (exit 1), AUCUNE écriture.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const FICHIER = join(ROOT, 'src/data/sea-weather.json');

/** Les colonnes de `parSaison`, dans son ordre. */
const SAISONS = ['printemps', 'ete', 'automne', 'hiver'];

const arrets = [];
const brut = readFileSync(FICHIER, 'utf8');
const doc = JSON.parse(brut);
if (brut !== serializeDataset(doc)) arrets.push('sea-weather.json : forme non canonique');

const mod = doc.seasonMod;
let deplacees = 0;
if (mod && SAISONS.some((s) => Object.hasOwn(mod, s))) {
  const { saisons: dejaPosees = {}, source, ...reste } = mod;
  const saisons = {};
  for (const s of SAISONS) {
    if (Object.hasOwn(reste, s) && Object.hasOwn(dejaPosees, s)) arrets.push(`sea-weather.json › seasonMod : « ${s} » présente à la racine et sous \`saisons\``);
    if (Object.hasOwn(reste, s)) deplacees++;
    if (Object.hasOwn(reste, s) || Object.hasOwn(dejaPosees, s)) saisons[s] = Object.hasOwn(reste, s) ? reste[s] : dejaPosees[s];
    delete reste[s];
  }
  doc.seasonMod = { saisons, ...reste, ...(source ? { source } : {}) };
}

// FORME SUR LE RÉSULTAT.
if (doc.seasonMod) {
  for (const cle of Object.keys(doc.seasonMod)) if (cle !== 'saisons' && cle !== 'source') arrets.push(`sea-weather.json › seasonMod : clé « ${cle} » hors de saisons/source`);
  for (const s of SAISONS) {
    const v = doc.seasonMod.saisons?.[s];
    if (typeof v !== 'number') arrets.push(`sea-weather.json › seasonMod.saisons.${s} : ${JSON.stringify(v)} n'est pas un nombre`);
  }
}

if (arrets.length) {
  console.error(`ARRÊT — ${arrets.length} anomalie(s), AUCUNE écriture :`);
  for (const a of arrets) console.error(`  ${a}`);
  process.exit(1);
}

const out = serializeDataset(doc);
if (out !== brut) writeFileSync(FICHIER, out, 'utf8');
console.log(`migration 1684 : ${deplacees} colonne(s) saisonnière(s) sous seasonMod.saisons, sea-weather.json ${out !== brut ? 'réécrit' : 'inchangé'}.`);
