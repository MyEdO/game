/**
 * Migration #1667 B3a — `codexCategory` sort des documents de `miscast.json` : la catégorie Codex des
 * rangées d'une table se DÉRIVE de l'exposition (`niche.categories`, `src/data/schemas/defs/miscast.ts`),
 * lue par `categorieDeLaNiche` (`src/data/index.ts`). Le champ en était le doublon.
 *
 * Entrées : src/data/miscast.json.
 *
 * `CATEGORIES` est la correspondance que `niche.categories` déclare à l'écriture de cette migration. Un
 * document sans `codexCategory` (forme d'après) passe ; un `codexCategory` qui diffère de la catégorie
 * dérivée de son document, ou porté par un document qu'elle ne nomme pas, est un ARRÊT nominatif
 * (exit 1), AUCUNE écriture — aucune valeur ne se perd en silence. Un fichier non canonique, de même.
 * Rejouée sur l'arbre migré : no-op byte-identique.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const MISCAST = join(ROOT, 'src/data/miscast.json');
const CATEGORIES = {
  'miscast-mineure': 'miscastMinor',
  'miscast-majeure': 'miscastMajor',
  'miscast-mineure-vdm': 'miscastMinorVdm',
  'miscast-majeure-vdm': 'miscastMajorVdm',
  'miscast-colere': 'miscastWrath',
};

const arrets = [];
let gestes = 0;

const brut = readFileSync(MISCAST, 'utf8');
const docs = JSON.parse(brut);
if (brut !== serializeDataset(docs)) arrets.push('miscast.json : forme non canonique');

if (!arrets.length) {
  for (const doc of docs) {
    if (!('codexCategory' in doc)) continue;
    const derivee = CATEGORIES[doc.id];
    if (doc.codexCategory !== derivee) {
      arrets.push(`${doc.id} : codexCategory « ${doc.codexCategory} » ≠ catégorie dérivée « ${derivee ?? '(aucune)'} »`);
      continue;
    }
    delete doc.codexCategory;
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
console.log(`migration 1667 (codexCategory dérivée) : ${gestes} geste(s)${out !== brut ? ', miscast.json réécrit' : ''}.`);
