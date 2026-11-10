/**
 * Migration #3578 L1 — la colonne `talents[].rand` (borne haute d100 portée par l'ENTITÉ) devient le
 * document TABLE `talents-aleatoires` (#1463 S2), famille `entite`, au patron de `mutationTables.json` :
 * l'enveloppe `{ id, type, label, die, source }` puis les rangées `{ id, min, max }` sous `entries`,
 * dans l'ordre des bornes. `min` = la borne haute précédente + 1, `max` = `rand`. Dé : `d100`,
 * LDB 05 l.514-531 (bandes « 01–03 » à « 98–00 », LDB 02 l.27).
 *
 * Entrées : src/data/talents.json (lue et écrite), src/data/talents-aleatoires.json (écrite).
 *
 * FORME D'AVANT SEULE : un `talents.json` dont aucune entrée ne porte `rand` est laissé tel quel, et le
 * document n'est alors ni créé ni relu (rejeu sur l'arbre migré : no-op byte-identique). ARRÊT nominatif
 * (exit 1), AUCUNE écriture : un fichier non canonique, un document `talents-aleatoires.json` déjà présent
 * alors que `talents.json` porte encore `rand`, une borne non entière, ou deux bornes égales.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const TALENTS = join(ROOT, 'src/data/talents.json');
const TABLE = join(ROOT, 'src/data/talents-aleatoires.json');

const ENVELOPPE = {
  id: 'talents-aleatoires', type: 'talents-aleatoires', label: 'Tableau des Talents aléatoires', die: 'd100',
  source: { book: 'livre-de-base', page: 36, note: 'Tableau des Talents aléatoires, LDB 05 l.514-531' },
};

const brut = readFileSync(TALENTS, 'utf8');
const talents = JSON.parse(brut);
const arrets = [];
if (brut !== serializeDataset(talents)) arrets.push('talents.json : forme non canonique');
const porteurs = talents.filter((t) => Object.hasOwn(t, 'rand'));

if (!arrets.length && porteurs.length) {
  if (existsSync(TABLE)) arrets.push('talents-aleatoires.json existe déjà alors que talents.json porte encore `rand`');
  const bornes = porteurs.filter((t) => t.rand !== null);
  for (const t of bornes) if (!Number.isInteger(t.rand)) arrets.push(`talents.json › ${t.id} : \`rand\` non entier (${JSON.stringify(t.rand)})`);
  const vues = new Map();
  for (const t of bornes) {
    if (vues.has(t.rand)) arrets.push(`talents.json : borne ${t.rand} portée par « ${vues.get(t.rand)} » et « ${t.id} »`);
    vues.set(t.rand, t.id);
  }
  if (!arrets.length) {
    const tries = [...bornes].sort((a, b) => a.rand - b.rand);
    const entries = tries.map((t, i) => ({ id: t.id, min: (tries[i - 1]?.rand ?? 0) + 1, max: t.rand }));
    const sansRand = talents.map(({ rand: _rand, ...t }) => t);
    writeFileSync(TABLE, serializeDataset([{ ...ENVELOPPE, entries }]), 'utf8');
    writeFileSync(TALENTS, serializeDataset(sansRand), 'utf8');
    console.log(`migration 3578 L1 : ${entries.length} rangée(s) écrites dans talents-aleatoires.json, \`rand\` retiré de ${porteurs.length} talent(s).`);
  }
}

if (arrets.length) {
  console.error(`ARRÊT — ${arrets.length} anomalie(s), AUCUNE écriture :`);
  for (const a of arrets) console.error(`  ${a}`);
  process.exit(1);
}
if (!porteurs.length) console.log('migration 3578 L1 : aucun `rand` dans talents.json, rien à faire.');
