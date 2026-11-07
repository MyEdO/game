/**
 * Migration #1667 train (e) — le Tableau des événements d'escale (`sea-events.json › portEvents`) et le
 * tableau du Voyage rapide (`sea-events.json › fastVoyage`) deviennent des nœuds `{ die, entries }`
 * (`tableTiree`, `src/data/schemas/grammaire/document.ts`), la forme de `boardEvents` : le tableau de
 * rangées passe sous `entries`, son dé imprimé sous `die`.
 *
 *   `sea-events.json`  `.portEvents`  `2d10`  MDG 15 l.243 (colonne « 2d10 ») ; l.129 (« en lançant 2d10 »)
 *   `sea-events.json`  `.fastVoyage`  `d10`   MDG 15 l.32 (colonne « d10 »)
 *
 * `portEvents` (tableau) prend la place du nœud `{ die, entries }` au même rang. `fastVoyage`
 * (`{ paliers, source }`) devient `{ die, entries, source }` : ses paliers passent sous `entries`.
 *
 * Entrées : src/data/sea-events.json.
 *
 * Un nœud déjà migré est laissé tel quel : son `die` est une donnée. FORME ASSERTÉE SUR LE RÉSULTAT.
 * Un champ absent, une forme inattendue ou un document non canonique est un ARRÊT nominatif (exit 1),
 * AUCUNE écriture. Rejouée sur l'arbre migré : no-op byte-identique.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const FICHIER = 'sea-events.json';

const estObjet = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const clesExactes = (v, cles) => estObjet(v) && JSON.stringify(Object.keys(v)) === JSON.stringify(cles);
const estEscale = (v) => clesExactes(v, ['die', 'entries']) && typeof v.die === 'string' && Array.isArray(v.entries);
const estVoyageRapide = (v) => clesExactes(v, ['die', 'entries', 'source']) && typeof v.die === 'string' && Array.isArray(v.entries);

const chemin = join(ROOT, 'src/data', FICHIER);
const brut = readFileSync(chemin, 'utf8');
const doc = JSON.parse(brut);
const arret = (champ, motif) => {
  console.error(`ARRÊT — ${FICHIER} › ${champ} : ${motif}, AUCUNE écriture.`);
  process.exit(1);
};
if (brut !== serializeDataset(doc)) arret('*', 'forme non canonique');

const escale = doc.portEvents;
if (!estEscale(escale) && !Array.isArray(escale)) arret('portEvents', 'ni tableau de rangées ni nœud `{ die, entries }`');
const rapide = doc.fastVoyage;
if (!estVoyageRapide(rapide) && !(clesExactes(rapide, ['paliers', 'source']) && Array.isArray(rapide.paliers))) {
  arret('fastVoyage', 'ni `{ paliers, source }` ni nœud `{ die, entries, source }`');
}

const copie = Object.entries(doc);
for (const k of Object.keys(doc)) delete doc[k];
for (const [k, v] of copie) {
  if (k === 'portEvents' && Array.isArray(v)) doc[k] = { die: '2d10', entries: v };
  else if (k === 'fastVoyage' && !estVoyageRapide(v)) doc[k] = { die: 'd10', entries: v.paliers, source: v.source };
  else doc[k] = v;
}
if (!estEscale(doc.portEvents)) arret('portEvents', 'pas un nœud `{ die, entries }` après migration');
if (!estVoyageRapide(doc.fastVoyage)) arret('fastVoyage', 'pas un nœud `{ die, entries, source }` après migration');

const out = serializeDataset(doc);
if (out !== brut) writeFileSync(chemin, out, 'utf8');
console.log(`migration 1667 (e) : ${out !== brut ? `${FICHIER} réécrit` : 'aucune écriture'}.`);
