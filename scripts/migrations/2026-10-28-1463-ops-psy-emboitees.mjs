/**
 * Migration #1463 (A0-b2β0a des étiquettes de Groupe, #3045 ; forme de #1468) — les ops psychologiques
 * emboîtent leurs références :
 *  - `beginPsych.type`, `endPsych.type` : id de `psychology.json` → `{ id }` ;
 *  - `grantPsychTrait.psychType`, `removePsychTrait.psychType` : id de `psychology.json` → `{ id }` ;
 *  - `beginPsych.cible`, `grantPsychTrait.cible` : id de `groups.json` → `{ id }`.
 * Les autres clés de l'op restent à leur place.
 *
 * FORME D'AVANT RECONNUE : la valeur d'un de ces champs est une CHAÎNE. Une valeur déjà emboîtée (`{ id }`)
 * n'est pas touchée ; ni l'ordre des clés ni le nombre d'entrées n'entrent dans la décision.
 * ENTRÉES : écrites — les fichiers de `RACINES`.
 * FAIL-FAST — avant toute écriture, sortie 1 : un fichier hors de son formatage ; un champ de référence
 * qui n'est ni une chaîne ni un objet `{ id }` à chaîne.
 * IDEMPOTENT : rejouée sur l'état final, aucun geste n'est à faire et rien ne s'écrit.
 * FORMATAGE PRÉSERVÉ, constaté avant l'écriture : un dataset est EXACTEMENT `serializeDataset`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Racines qui portent ces ops. */
const RACINES = [
  'src/data/activities.json',
  'src/data/drunkenness.json',
  'src/data/mutations.json',
  'src/data/psychology.json',
  'src/data/spells.json',
  'src/data/symptoms.json',
  'src/data/tables.json',
  'src/data/talents.json',
];

/** Op → ses champs de référence. */
const CHAMPS = {
  beginPsych: ['type', 'cible'],
  endPsych: ['type'],
  grantPsychTrait: ['psychType', 'cible'],
  removePsychTrait: ['psychType'],
};

const estEmboitee = (v) => v !== null && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 1 && typeof v.id === 'string';

const fautes = [];
const docs = new Map();
for (const rel of RACINES) {
  const avant = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const doc = JSON.parse(avant);
  if (serializeDataset(doc) !== avant) fautes.push(`${rel} : formatage non canonique`);
  docs.set(rel, { doc, avant });
}
let gestes = 0;

function migrerOp(o, rel) {
  for (const champ of CHAMPS[o.op]) {
    const v = o[champ];
    if (v === undefined || estEmboitee(v)) continue;
    if (typeof v !== 'string') {
      fautes.push(`${rel} : ${o.op}.${champ} n'est ni un id ni une référence { id } (${JSON.stringify(v)})`);
      continue;
    }
    o[champ] = { id: v };
    gestes++;
  }
}

function parcourir(noeud, rel) {
  if (Array.isArray(noeud)) return noeud.forEach((x) => parcourir(x, rel));
  if (noeud === null || typeof noeud !== 'object') return;
  if (typeof noeud.op === 'string' && Object.hasOwn(CHAMPS, noeud.op)) migrerOp(noeud, rel);
  for (const v of Object.values(noeud)) parcourir(v, rel);
}
for (const [rel, { doc }] of docs) parcourir(doc, rel);

if (fautes.length) {
  console.error(`ARRÊT — rien n'est écrit :\n${fautes.join('\n')}`);
  process.exit(1);
}
for (const [rel, { doc, avant }] of docs) {
  const apres = serializeDataset(doc);
  if (apres !== avant) fs.writeFileSync(path.join(ROOT, rel), apres);
}
console.log(`migration 1463 ops psy emboîtées : ${gestes} geste(s).`);
