/**
 * Migration #4099 (#3908 L5) — Nonne et Prêtre pris à la place de Flagellant par l'espèce `humains-tileens` portent
 * `talentALaPlaceDe` : le Talent de carrière Béni, au choix de Myrmidia, Morr, Verena, Shallya ou Ranald (AA 05 l.137).
 *
 * Entrées : src/data/careers.json (lue et écrite).
 *
 * Migration neuve plutôt qu'un geste ajouté à `2026-11-13-3908-a-la-place-de.mjs` : celle-ci ne joue que sur la forme
 * d'avant de L2 (un `aLaPlaceDe` de l'ADE I en chaîne), que l'arbre migré ne porte plus ; un geste qui lui serait ajouté
 * ne se rejouerait pas.
 *
 * FORME D'AVANT SEULE (`lib/formeDAvant.mjs`) : chaque geste n'agit que sur la carrière qui porte exactement la
 * substitution tiléenne de L2 sans `talentALaPlaceDe` (rejeu : no-op byte-identique) ; une carrière absente ou révisée
 * depuis passe sans faute.
 * ARRÊT (exit 1), AUCUNE écriture : un fichier non canonique.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';
import { porteLaTranche } from './lib/formeDAvant.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CAREERS = join(ROOT, 'src/data/careers.json');
const CARRIERES = ['nonne', 'pretre'];
const AVANT = { aLaPlaceDe: { id: 'flagellant' }, especesALaPlaceDe: ['humains-tileens'], talentALaPlaceDe: undefined };
const BORNE = { id: 'beni', choix: ['myrmidia', 'morr', 'verena', 'shallya', 'ranald'] };

const brut = readFileSync(CAREERS, 'utf8');
const careers = JSON.parse(brut);
if (brut !== serializeDataset(careers)) {
  console.error('ARRÊT — careers.json : forme non canonique, AUCUNE écriture.');
  process.exit(1);
}
let n = 0;
const migrees = careers.map((c) => {
  if (!CARRIERES.includes(c.id) || !porteLaTranche(c, AVANT)) return c;
  n++;
  const { desc, source, ...reste } = c;
  return { ...reste, talentALaPlaceDe: BORNE, desc, source };
});
if (n === 0) {
  console.log('migration 4099 : aucune carrière tiléenne sans `talentALaPlaceDe`, rien à faire.');
} else {
  writeFileSync(CAREERS, serializeDataset(migrees), 'utf8');
  console.log(`migration 4099 : ${n} carrière(s) bornée(s) au Talent Béni (\`talentALaPlaceDe\`).`);
}
