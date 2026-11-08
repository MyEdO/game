/**
 * Migration #1667 train (c) — un tableau RACINE tiré (un fichier dont la racine est la liste de ses
 * lignes, sans enveloppe) devient un document mono-table `config` (`options.rangee` +
 * `options.deDeTirage`, `src/data/schemas/grammaire/document.ts`), la forme d'`obsessions.json` :
 * l'enveloppe `{ id, type, label, die, source }` (et le `sub` du sous-tirage des Signes, un `Tirage`) puis les
 * lignes sous `entries`, la `source` du document étant celle du tableau. Chaque ligne perd son `type` (une rangée n'est pas un document) et garde le reste,
 * `source` comprise.
 *
 *   fichier                 id                          dé      réf
 *   `oups.json`             `tableau-des-oups`          `d100`  LDB 14 l.23-30 (« bandes 01-00 »)
 *   `interludeEvents.json`  `tableau-des-evenements`    `d100`  LDB 22 l.5 (« lancez d'abord 1d100 »)
 *   `steam-breakdown.json`  `panne-de-vapeur`           `d100`  MDG 12 l.323 (colonne « d100 »)
 *   `stars.json`            `signes-astrologiques`      `d100`  ADE II 03 l.42 (colonne « 1d100 »)
 *                           `sub.dice` (sous-tirage)   `1d10`  ADE II 03 l.63 (« Lancez un 1d10 »)
 *   `peripeties.json`       `peripeties`                `d10`   LDB 51 l.210 (colonne « 1d10 »)
 *
 * Entrées : src/data/oups.json, src/data/interludeEvents.json, src/data/steam-breakdown.json,
 * src/data/stars.json, src/data/peripeties.json.
 *
 * Un document déjà migré (objet portant `entries`) est laissé tel quel : son `die` est une donnée.
 * FORME ASSERTÉE SUR LE RÉSULTAT : un objet du `type` du fichier, qui porte les clés de son enveloppe
 * et `entries`, dont aucune ligne ne porte `type` ; une clé que le document a reçue depuis ne le
 * concerne pas. Une racine ni tableau ni document, une ligne au `type` étranger ou un
 * fichier non canonique est un ARRÊT nominatif (exit 1), AUCUNE écriture. Rejouée sur l'arbre migré :
 * no-op byte-identique.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';
import { estObjet } from '../../src/lib/objet.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Par fichier : l'enveloppe du document (réfs en en-tête). `type` = le nom de base du fichier. */
const DOCUMENTS = {
  'oups.json': {
    id: 'tableau-des-oups', type: 'oups', label: 'Tableau des Oups !', die: 'd100',
    source: { book: 'livre-de-base', page: 160, note: 'Tableau des Oups !, LDB 14 l.21-30' },
  },
  'interludeEvents.json': {
    id: 'tableau-des-evenements', type: 'interludeEvents', label: 'Tableau des Événements', die: 'd100',
    source: { book: 'livre-de-base', page: 193, note: 'Tableau des Événements, LDB 22 (table pp.193-194)' },
  },
  'steam-breakdown.json': {
    id: 'panne-de-vapeur', type: 'steam-breakdown', label: 'Panne de vapeur', die: 'd100',
    source: { book: 'mer-des-griffes', page: 99, note: 'Panne de Vapeur, MDG 12 l.324-349' },
  },
  'stars.json': {
    id: 'signes-astrologiques', type: 'stars', label: 'Tableau des Signes astrologiques', die: 'd100', sub: { dice: { n: 1, sides: 10 } },
    source: { book: 'archives-de-l-empire-2', page: 39, note: 'Tableau des Signes astrologiques, ADE II 03 l.42-63' },
  },
  'peripeties.json': {
    id: 'peripeties', type: 'peripeties', label: 'Péripéties', die: 'd10',
    source: { book: 'livre-de-base', page: 263, note: 'Péripéties (conseils de voyage MJ), LDB 51 l.210-221' },
  },
};

const estDocument = (v, enveloppe) => estObjet(v)
  && Object.keys(enveloppe).every((k) => k in v) && v.type === enveloppe.type && Array.isArray(v.entries)
  && v.entries.every((l) => l !== null && typeof l === 'object' && !('type' in l));

const arrets = [];
const ecritures = [];
for (const [fichier, enveloppe] of Object.entries(DOCUMENTS)) {
  const chemin = join(ROOT, 'src/data', fichier);
  const brut = readFileSync(chemin, 'utf8');
  let doc = JSON.parse(brut);
  if (brut !== serializeDataset(doc)) { arrets.push(`${fichier} : forme non canonique`); continue; }
  if (Array.isArray(doc)) {
    const etrangeres = doc.filter((l) => l?.type !== enveloppe.type).map((l) => `« ${l?.id} »`);
    if (etrangeres.length) { arrets.push(`${fichier} : ligne(s) au \`type\` autre que « ${enveloppe.type} » : ${etrangeres.join(', ')}`); continue; }
    doc = { ...enveloppe, entries: doc.map(({ type: _type, ...ligne }) => ligne) };
  }
  if (!estDocument(doc, enveloppe)) { arrets.push(`${fichier} : ni tableau de lignes ni document \`{ ${[...Object.keys(enveloppe), 'entries'].join(', ')} }\``); continue; }
  const out = serializeDataset(doc);
  if (out !== brut) ecritures.push([chemin, fichier, out]);
}

if (arrets.length) {
  console.error(`ARRÊT — ${arrets.length} anomalie(s), AUCUNE écriture :`);
  for (const a of arrets) console.error(`  ${a}`);
  process.exit(1);
}
for (const [chemin, , out] of ecritures) writeFileSync(chemin, out, 'utf8');
console.log(`migration 1667 (c) : ${ecritures.length} document(s) réécrit(s)${ecritures.length ? ` (${ecritures.map(([, f]) => f).join(', ')})` : ''}.`);
