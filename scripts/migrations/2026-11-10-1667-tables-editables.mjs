/**
 * Migration #1667 lot A — les deux tableaux d'Incantations Imparfaites révisés par les Vents de la Magie
 * (`miscast.json`, VDM 02 l.218-263) déclarent la catégorie Codex de leurs lignes, comme les trois du Livre de
 * base : `miscast-mineure-vdm` → `miscastMinorVdm`, `miscast-majeure-vdm` → `miscastMajorVdm`.
 *
 * Entrée : src/data/miscast.json. Un document nommé absent n'est pas une anomalie : la migration rejouée après
 * sa suppression sort 0 sans écrire. Un fichier dont AUCUN document ne porte `codexCategory` est la forme
 * d'après `2026-11-11-1667-codex-category-derivee.mjs` (champ dérivé de l'exposition) : rien à poser.
 *
 * FORME ASSERTÉE SUR LE RÉSULTAT : un document nommé qui déclare déjà une AUTRE catégorie, ou un fichier non
 * canonique, est un ARRÊT nominatif (exit 1), AUCUNE écriture. Rejouée sur l'arbre migré : no-op byte-identique.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const MISCAST = join(ROOT, 'src/data/miscast.json');
const CATEGORIES = { 'miscast-mineure-vdm': 'miscastMinorVdm', 'miscast-majeure-vdm': 'miscastMajorVdm' };

const arrets = [];
let gestes = 0;

const brut = readFileSync(MISCAST, 'utf8');
const docs = JSON.parse(brut);
if (brut !== serializeDataset(docs)) arrets.push('miscast.json : forme non canonique');

if (!arrets.length && docs.some((d) => 'codexCategory' in d)) {
  for (const [id, categorie] of Object.entries(CATEGORIES)) {
    const i = docs.findIndex((d) => d.id === id);
    if (i < 0) continue;
    const doc = docs[i];
    if (doc.codexCategory === categorie) continue;
    if (doc.codexCategory !== undefined) { arrets.push(`${id} : codexCategory « ${doc.codexCategory} » ≠ « ${categorie} »`); continue; }
    // Clé posée avant `entries`, à la place qu'elle occupe sur les trois documents du Livre de base.
    docs[i] = Object.fromEntries(Object.entries(doc).flatMap(([k, v]) => (k === 'entries' ? [['codexCategory', categorie], [k, v]] : [[k, v]])));
    gestes++;
  }
}

if (arrets.length) {
  console.error(`ARRÊT — ${arrets.length} anomalie(s), AUCUNE écriture :`);
  for (const a of arrets) console.error(`  ${a}`);
  process.exit(1);
}
const out = serializeDataset(docs);
if (out !== brut) writeFileSync(MISCAST, out, 'utf8');
console.log(`migration 1667 (tables éditables) : ${gestes} geste(s)${out !== brut ? ', miscast.json réécrit' : ''}.`);
