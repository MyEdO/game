/**
 * Migration #3578 L3 — les tableaux racines `eyes.json` et `hairs.json` (une ligne par couleur, chacune
 * `{ id, type, label, rand, randByRace?, color, source }`) deviennent chacun un document `config` à rangées
 * (`options.rangee` + `options.deDeTirage`, `src/data/schemas/grammaire/document.ts`), la forme de
 * `stars.json` : l'enveloppe `{ id, type, label, die, source }` puis les lignes sous `entries`. Chaque ligne
 * perd son `type` (une rangée n'est pas un document) et sa `source`, qui devient celle du document : la note
 * commune du tableau, la remarque propre à une ligne y étant ajoutée (`hairs.json › auburn`, coquille gnome).
 *
 *   fichier       id                     dé      réf
 *   `eyes.json`   `couleur-des-yeux`     `2d10`  LDB 05 l.744 (colonne « 2d10 »)
 *   `hairs.json`  `couleur-des-cheveux`  `2d10`  LDB 05 l.758 (colonne « 2d10 »)
 *
 * Entrées : src/data/eyes.json, src/data/hairs.json (lues et écrites).
 *
 * Un document déjà migré (objet portant `entries`) est laissé tel quel : son `die` est une donnée. Rejouée sur
 * l'arbre migré : no-op byte-identique. ARRÊT nominatif (exit 1), AUCUNE écriture : un fichier non canonique,
 * une ligne au `type` étranger, une racine ni tableau ni document.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';
import { estMonoTable } from './lib/monoTable.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

const NOTE_YEUX = 'Tableau Couleur des Yeux, LDB 05 l.742-754 (Étape 6 Détails supplémentaires — 5 colonnes humain/nain/halfling/haut-elfe/elfe-sylvain, folio 40 : ancre data-folio l.744) ; colonne gnome = NADJ (Nuits agitées et dures journées) p.89 ; colonne ogre = ADE II (Archives de l\'Empire vol. II) p.21';
const NOTE_CHEVEUX = 'Tableau Couleur des Cheveux. Colonnes humain/nain/halfling/haut-elfe/elfe-sylvain = LDB 05 l.758-768 (folio 40 : ancres data-folio l.744 et l.773), bornes 2/3/4/5-7/8-11/12-14/15-17/18/19/20. Colonne gnome = NADJ (Nuits agitées et dures journées) « 15 - _GoBack.md » l.99-104 (p.89), bornes 2/3/4-6/7-10/11/12-14/15-17/18/19/20 — d\'où randByRace.gnome sur « blond-roux » (6) et « brun-dore » (10) (#420). Colonne ogre = ADE II (Archives de l\'Empire vol. II) « 02 - Les ogres.md » l.305-311 (p.21), table 2d10×4 colonnes (gauche+droite) re-extraite du PDF (le pli Marker avait fait sauter la colonne 2d10 GAUCHE) : bornes 2/3/4/5-7/8-11/12-14/15-17/18/19/20 — motif IDENTIQUE au LDB (confirmé au livre : même motif que la table Couleur des yeux ogre adjacente, l.286-297) ⇒ pas de randByRace.ogre (#423). La couleur gnome « Bond doré » (rangée « auburn ») est le verbatim source (coquille probable, conservée règle 5).';

/** Par fichier : l'enveloppe du document. `type` = le nom de base du fichier. */
const DOCUMENTS = {
  'eyes.json': {
    id: 'couleur-des-yeux', type: 'eyes', label: 'Tableau de couleur des yeux', die: '2d10',
    source: { book: 'livre-de-base', page: 40, note: NOTE_YEUX },
  },
  'hairs.json': {
    id: 'couleur-des-cheveux', type: 'hairs', label: 'Tableau de couleur des cheveux', die: '2d10',
    source: { book: 'livre-de-base', page: 40, note: NOTE_CHEVEUX },
  },
};

const arrets = [];
const ecritures = [];
for (const [fichier, enveloppe] of Object.entries(DOCUMENTS)) {
  const chemin = join(ROOT, 'src/data', fichier);
  const brut = readFileSync(chemin, 'utf8');
  const lu = JSON.parse(brut);
  if (brut !== serializeDataset(lu)) { arrets.push(`${fichier} : forme non canonique`); continue; }
  if (estMonoTable(lu)) continue;
  if (!Array.isArray(lu)) { arrets.push(`${fichier} : ni tableau de lignes ni document à \`entries\``); continue; }
  const etrangeres = lu.filter((l) => l?.type !== enveloppe.type).map((l) => `« ${l?.id} »`);
  if (etrangeres.length) { arrets.push(`${fichier} : ligne(s) au \`type\` autre que « ${enveloppe.type} » : ${etrangeres.join(', ')}`); continue; }
  const entries = lu.map(({ type: _type, source: _source, ...ligne }) => ligne);
  ecritures.push([chemin, fichier, serializeDataset({ ...enveloppe, entries })]);
}

if (arrets.length) {
  console.error(`ARRÊT — ${arrets.length} anomalie(s), AUCUNE écriture :`);
  for (const a of arrets) console.error(`  ${a}`);
  process.exit(1);
}
for (const [chemin, , out] of ecritures) writeFileSync(chemin, out, 'utf8');
console.log(`migration 3578 L3 : ${ecritures.length} document(s) réécrit(s)${ecritures.length ? ` (${ecritures.map(([, f]) => f).join(', ')})` : ''}.`);
