/**
 * Migration #1667 trains (b) et (e) — une sous-table tirée d'un document `config` devient un nœud nommé
 * `{ die, entries }` (`tableTiree`, `src/data/schemas/grammaire/document.ts`), la forme de
 * `weather.json › seasons[]` : le tableau de rangées passe sous `entries`, son dé imprimé sous `die`.
 *
 *   `river-navigation.json`  `.windForces`                  `d10`   MSRC 7 l.27 (« Force (d10) »)
 *   `river-navigation.json`  `.windDirections`              `d10`   MSRC 7 l.25 (« Direction (d10) »)
 *   `water-exposure.json`    `.diseases`                    `d100`  MSRC 16 l.53 (colonne « 1d100 »)
 *   `sea-navigation.json`    `.orientation.changementDeCap` `d10`   MDG 13 l.326 (« Résultat du d10 »)
 *   `land-cargo.json`        `.qualiteDuVin`                `d10`   MSRC 13 l.97 (colonne « d10 »)
 *   `land-cargo.json`        `.rumeurs`                     `d100`  MSRC 13 l.283 (colonne « D100 »)
 *   `sea-weather.json`       `.table`                       `d10`   MDG 13 l.170 (« Résultat du d10 »)
 *   `sea-weather.json`       `.roseDesVents`                `d10`   MDG 13 l.252 (colonne « d10 »)
 *   `mass-battle.json`       `.hazards`                     `1d10`  ADE II 08 l.311 (colonne « 1d10 »)
 *
 * Entrées : src/data/river-navigation.json, src/data/water-exposure.json, src/data/sea-navigation.json,
 * src/data/land-cargo.json, src/data/sea-weather.json, src/data/mass-battle.json.
 *
 * Le nœud prend la place du tableau, au même rang dans son parent. Un nœud déjà migré (objet portant
 * `die` et `entries`) est laissé tel quel : son `die` est une donnée. FORME ASSERTÉE SUR LE RÉSULTAT :
 * chaque table est un objet aux seules clés `die` et `entries`. Un chemin absent, une forme inattendue
 * ou un document non canonique est un ARRÊT nominatif (exit 1), AUCUNE écriture. Rejouée sur l'arbre
 * migré : no-op byte-identique.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';
import { estObjet } from '../../src/lib/objet.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Par fichier : [chemin du champ-table, dé imprimé] (réfs en en-tête). */
const TABLES = {
  'river-navigation.json': [[['windForces'], 'd10'], [['windDirections'], 'd10']],
  'water-exposure.json': [[['diseases'], 'd100']],
  'sea-navigation.json': [[['orientation', 'changementDeCap'], 'd10']],
  'land-cargo.json': [[['qualiteDuVin'], 'd10'], [['rumeurs'], 'd100']],
  'sea-weather.json': [[['table'], 'd10'], [['roseDesVents'], 'd10']],
  'mass-battle.json': [[['hazards'], '1d10']],
};

const estNoeud = (v) => estObjet(v) && Object.keys(v).length === 2 && typeof v.die === 'string' && Array.isArray(v.entries);

const arrets = [];
const ecritures = [];
for (const [fichier, tables] of Object.entries(TABLES)) {
  const chemin = join(ROOT, 'src/data', fichier);
  const brut = readFileSync(chemin, 'utf8');
  const doc = JSON.parse(brut);
  if (brut !== serializeDataset(doc)) { arrets.push(`${fichier} : forme non canonique`); continue; }
  for (const [champ, die] of tables) {
    const ou = `${fichier} › ${champ.join('.')}`;
    const parent = champ.slice(0, -1).reduce((n, k) => n?.[k], doc);
    const cle = champ[champ.length - 1];
    const valeur = parent?.[cle];
    if (estNoeud(valeur)) continue;
    if (!Array.isArray(valeur)) { arrets.push(`${ou} : ni tableau de rangées ni nœud \`{ die, entries }\``); continue; }
    const copie = Object.entries(parent);
    for (const k of Object.keys(parent)) delete parent[k];
    for (const [k, v] of copie) parent[k] = k === cle ? { die, entries: v } : v;
  }
  for (const [champ] of tables) {
    if (!estNoeud(champ.reduce((n, k) => n?.[k], doc))) arrets.push(`${fichier} › ${champ.join('.')} : pas un nœud \`{ die, entries }\` après migration`);
  }
  const out = serializeDataset(doc);
  if (out !== brut) ecritures.push([chemin, fichier, out]);
}

if (arrets.length) {
  console.error(`ARRÊT — ${arrets.length} anomalie(s), AUCUNE écriture :`);
  for (const a of arrets) console.error(`  ${a}`);
  process.exit(1);
}
for (const [chemin, , out] of ecritures) writeFileSync(chemin, out, 'utf8');
console.log(`migration 1667 (b, e) : ${ecritures.length} document(s) réécrit(s)${ecritures.length ? ` (${ecritures.map(([, f]) => f).join(', ')})` : ''}.`);
