/**
 * Migration #1473 (train 2a du lot « ops à référence typées ») — la référence de Talent prend UNE graphie :
 *  - les ops `grantTalent` / `grantCareerTalent` passent de `{ op, talentId, spec? }` à
 *    `{ op, talent: { id, spec? } }` (`src/data/schemas/grammaire/mecanique.ts`, champ à choix `talent`),
 *    par la primitive `graphieOpsDeTalentDeep` (`src/data/graphieOpsDeTalent.ts`), la même que
 *    `PROJECT_MIGRATIONS[14]` ;
 *  - `axes.json › talents[]` passe de `{ talentId, spec? }` à `{ id, spec? }` (`refOuSpec('talent')`,
 *    `src/data/schemas/defs/axes.ts`).
 *
 * ENTRÉES : `src/data/*.json` ; `src/data/graphieOpsDeTalent.ts` (la primitive, chargée par Node nu).
 * FORMATAGE : `serializeDataset` (`src/data/serialize.ts`), vérifié AVANT toute écriture — un document
 * non canonique fait sortir 1, jamais un reflow silencieux.
 * IDEMPOTENT : rejouée sur l'état final, la migration n'écrit rien et sort 0.
 * FAIL-FAST : une op de Talent qui porte À LA FOIS `talentId` et `talent`, ou une réf d'axe qui porte à la
 * fois `talentId` et `id` → rien n'est écrit, sortie 1.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { estOpDeTalentAncienne, graphieOpsDeTalentDeep } from '../../src/data/graphieOpsDeTalent.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const DATA = path.join(ROOT, 'src/data');
/** Reflet de `src/data/serialize.ts#serializeDataset` (pas d'import TS applicatif depuis un script .mjs). */
const serializeDataset = (value) => JSON.stringify(value, null, 2);

const echecs = [];
const ecritures = [];
let ops = 0;
let refsDAxe = 0;

const compter = (node, fichier, where) => {
  if (Array.isArray(node)) { node.forEach((v, i) => compter(v, fichier, `${where}[${i}]`)); return; }
  if (!node || typeof node !== 'object') return;
  if (estOpDeTalentAncienne(node)) {
    if ('talent' in node) echecs.push(`${fichier} ${where} : porte À LA FOIS \`talentId\` et \`talent\``);
    ops += 1;
  }
  for (const [k, v] of Object.entries(node)) compter(v, fichier, `${where}.${k}`);
};

for (const f of fs.readdirSync(DATA).filter((n) => n.endsWith('.json')).sort()) {
  const cible = path.join(DATA, f);
  const brut = fs.readFileSync(cible, 'utf8');
  if (!brut.includes('"talentId"')) continue;
  const data = JSON.parse(brut);
  if (serializeDataset(data) !== brut) { echecs.push(`${f} n’est pas sous sa forme canonique — aucun reflow silencieux`); continue; }
  const avant = ops;
  const echecsAvant = echecs.length;
  compter(data, f, f);
  if (echecs.length > echecsAvant) continue;
  let sortie = ops > avant ? graphieOpsDeTalentDeep(data) : data;
  if (f === 'axes.json') {
    sortie = sortie.map((axe) => {
      if (!Array.isArray(axe?.talents)) return axe;
      const talents = axe.talents.map((r, i) => {
        if (!r || typeof r !== 'object' || !('talentId' in r)) return r;
        if ('id' in r) { echecs.push(`axes.json ${axe.id}.talents[${i}] : porte À LA FOIS \`talentId\` et \`id\``); return r; }
        refsDAxe += 1;
        return Object.fromEntries(Object.entries(r).map(([k, v]) => [k === 'talentId' ? 'id' : k, v]));
      });
      return { ...axe, talents };
    });
  }
  const out = serializeDataset(sortie);
  if (out !== brut) ecritures.push([cible, out]);
}

if (echecs.length) {
  console.error(`ARBITRAGE REQUIS — ${echecs.length} anomalie(s), AUCUNE écriture :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}
for (const [cible, out] of ecritures) fs.writeFileSync(cible, out);
console.log(`ops de Talent : ${ops} réécrite(s) en { talent: { id, spec? } } ; réfs de Talent d’axe : ${refsDAxe} réécrite(s) en { id, spec? }.`);
console.log(`Fichiers réécrits : ${ecritures.map(([c]) => path.relative(ROOT, c)).join(', ') || 'aucun'}`);
