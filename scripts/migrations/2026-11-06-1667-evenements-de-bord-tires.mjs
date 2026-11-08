/**
 * Migration #1667 train (d) — le Tableau des événements de bord (`sea-events.json › boardEvents`) devient
 * un nœud nommé `{ die, entries }` (`tableTiree`, `src/data/schemas/grammaire/document.ts`), la forme
 * des sous-tables du train (b) : le tableau de rangées passe sous `entries`, son dé imprimé sous `die`.
 *
 *   `sea-events.json`  `.boardEvents`  `d100`  MDG 15 l.134 (colonne « d100 »)
 *
 * Entrées : src/data/sea-events.json.
 *
 * Le nœud prend la place du tableau, au même rang dans le document. Un nœud déjà migré (objet portant
 * `die` et `entries`) est laissé tel quel : son `die` est une donnée. FORME ASSERTÉE SUR LE RÉSULTAT :
 * un objet aux seules clés `die` et `entries`. Un champ absent, une forme inattendue ou un document non
 * canonique est un ARRÊT nominatif (exit 1), AUCUNE écriture. Rejouée sur l'arbre migré : no-op
 * byte-identique.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';
import { estObjet } from '../../src/lib/objet.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const FICHIER = 'sea-events.json';
const CHAMP = 'boardEvents';
const DE = 'd100';

const estNoeud = (v) => estObjet(v) && Object.keys(v).length === 2 && typeof v.die === 'string' && Array.isArray(v.entries);

const chemin = join(ROOT, 'src/data', FICHIER);
const brut = readFileSync(chemin, 'utf8');
const doc = JSON.parse(brut);
const arret = (motif) => {
  console.error(`ARRÊT — ${FICHIER} › ${CHAMP} : ${motif}, AUCUNE écriture.`);
  process.exit(1);
};
if (brut !== serializeDataset(doc)) arret('forme non canonique');
const valeur = doc[CHAMP];
if (!estNoeud(valeur)) {
  if (!Array.isArray(valeur)) arret('ni tableau de rangées ni nœud `{ die, entries }`');
  const copie = Object.entries(doc);
  for (const k of Object.keys(doc)) delete doc[k];
  for (const [k, v] of copie) doc[k] = k === CHAMP ? { die: DE, entries: v } : v;
}
if (!estNoeud(doc[CHAMP])) arret('pas un nœud `{ die, entries }` après migration');
const out = serializeDataset(doc);
if (out !== brut) writeFileSync(chemin, out, 'utf8');
console.log(`migration 1667 (d) : ${out !== brut ? `${FICHIER} réécrit` : 'aucune écriture'}.`);
