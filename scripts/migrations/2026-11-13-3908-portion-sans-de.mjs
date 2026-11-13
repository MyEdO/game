/**
 * Migration #3908 L0 — une portion de `carrieres-aleatoires.json` (`kind: 'portion'`, MDG 09 l.9) perd son `die` :
 * elle est une tranche de sa colonne et se tire au dé de la colonne (`tableDeCarrieres`, `src/data/index.ts`) ; le
 * schéma ne pose plus `die` que sur les sortes qui le déclarent (`espace.chargeParDiscriminant`).
 *
 * Entrées : src/data/carrieres-aleatoires.json (lue et écrite).
 *
 * FORME D'AVANT SEULE : un fichier dont aucune portion ne porte `die` est laissé tel quel (rejeu sur l'arbre migré :
 * no-op byte-identique). ARRÊT nominatif (exit 1), AUCUNE écriture : un fichier non canonique, une portion dont le
 * `die` diffère de celui de sa colonne (le retrait changerait un dé authoré), une portion sans colonne de base.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const TABLE = join(ROOT, 'src/data/carrieres-aleatoires.json');

const arrets = [];
const brut = readFileSync(TABLE, 'utf8');
const documents = JSON.parse(brut);
if (brut !== serializeDataset(documents)) arrets.push('carrieres-aleatoires.json : forme non canonique');
const porteuses = documents.filter((d) => d.kind === 'portion' && Object.hasOwn(d, 'die'));
for (const p of porteuses) {
  const colonne = documents.find((d) => d.kind === 'colonne' && d.id === p.colonne);
  if (!colonne) arrets.push(`carrieres-aleatoires.json › ${p.id} : aucune colonne « ${p.colonne} »`);
  else if (colonne.die !== p.die) arrets.push(`carrieres-aleatoires.json › ${p.id} : dé « ${p.die} » ≠ dé « ${colonne.die} » de sa colonne « ${colonne.id} »`);
}

if (arrets.length) {
  console.error(`ARRÊT — ${arrets.length} anomalie(s), AUCUNE écriture :`);
  for (const a of arrets) console.error(`  ${a}`);
  process.exit(1);
}
if (!porteuses.length) {
  console.log('migration 3908 L0 : aucune portion ne porte `die`, rien à faire.');
} else {
  writeFileSync(TABLE, serializeDataset(documents.map((d) => (porteuses.includes(d) ? (({ die: _de, ...reste }) => reste)(d) : d))), 'utf8');
  console.log(`migration 3908 L0 : \`die\` retiré de ${porteuses.length} portion(s) : ${porteuses.map((p) => p.id).join(', ')}.`);
}
