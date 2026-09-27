/**
 * Migration #1473 (train 1 du lot « ops à référence typées ») — `testMod.exceptSkills` passe de
 * la liste d'ids NUS à la graphie d'op de la référence de Compétence, `{ id, spec? }`
 * (`refOuSpec('skill')`, `src/data/schemas/grammaire/mecanique.ts › OP_DEFS.testMod`). `{ id }`
 * sans `spec` = toute spécialisation de la Compétence.
 *
 * ENTRÉE : `src/data/etats.json` — seul document qui porte `exceptSkills` (mesure du 2026-09-24 :
 * 1 op, État `brise`, 2 ids).
 * FORMATAGE : `serializeDataset` (`src/data/serialize.ts`), sans saut de ligne final.
 * IDEMPOTENT : une valeur déjà objet traverse intacte ; rejouée sur l'état final, rien ne s'écrit.
 * FAIL-FAST : `exceptSkills` non-tableau, ou élément ni chaîne ni `{ id }` → rien n'est écrit, sortie 1.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CIBLE = path.join(ROOT, 'src/data/etats.json');
/** Reflet de `src/data/serialize.ts#serializeDataset` (pas d'import TS depuis un script .mjs). */
const serializeDataset = (value) => JSON.stringify(value, null, 2);

const arret = (msg) => { console.error(`ARRÊT — ${msg}`); process.exit(1); };

const brut = fs.readFileSync(CIBLE, 'utf8');
const data = JSON.parse(brut);
if (serializeDataset(data) !== brut) arret('etats.json n’est pas sous sa forme canonique — aucun reflow silencieux.');

let migrees = 0;
const walk = (node, where) => {
  if (Array.isArray(node)) { node.forEach((v, i) => walk(v, `${where}[${i}]`)); return; }
  if (!node || typeof node !== 'object') return;
  if (node.op === 'testMod' && 'exceptSkills' in node) {
    if (!Array.isArray(node.exceptSkills)) arret(`${where}.exceptSkills n’est pas une liste.`);
    node.exceptSkills = node.exceptSkills.map((x, i) => {
      if (typeof x === 'string') { migrees += 1; return { id: x }; }
      if (x && typeof x === 'object' && typeof x.id === 'string') return x;
      return arret(`${where}.exceptSkills[${i}] : ${JSON.stringify(x)} n’est ni un id ni une référence { id }.`);
    });
  }
  for (const [k, v] of Object.entries(node)) if (v && typeof v === 'object') walk(v, `${where}.${k}`);
};
walk(data, 'etats.json');

if (migrees > 0) fs.writeFileSync(CIBLE, serializeDataset(data));
console.log(`exceptSkills : ${migrees} id(s) migré(s) en { id }.`);
