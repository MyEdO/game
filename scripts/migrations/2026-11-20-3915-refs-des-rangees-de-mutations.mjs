/**
 * Migration #3915 — chaque rangée de table désigne sa mutation par `{ id, min, max }`.
 *
 * Entrées : src/data/mutationTables.json (écrite), src/data/mutations.json (lue).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { serializeDataset } from '../../src/data/serialize.ts';

const fichier = new URL('../../src/data/mutationTables.json', import.meta.url);
const catalogue = new URL('../../src/data/mutations.json', import.meta.url);
const tables = JSON.parse(readFileSync(fichier, 'utf8'));
const mutations = new Set(JSON.parse(readFileSync(catalogue, 'utf8')).map(({ id }) => id));
let migrees = 0;

const resultat = tables.map((table) => ({
  ...table,
  entries: table.entries.map((rangee, index) => {
    if (!Object.hasOwn(rangee, 'mutation')) return rangee;
    const { mutation, min, max, ...reste } = rangee;
    const lieu = `mutationTables.json › ${table.id} › rangée ${index + 1}`;
    if (typeof mutation !== 'string' || !mutations.has(mutation))
      throw new Error(`${lieu} : mutation absente du catalogue : ${JSON.stringify(mutation)}`);
    if (!Number.isInteger(min) || !Number.isInteger(max) || Object.keys(reste).length)
      throw new Error(`${lieu} : rangée historique attendue sous la forme { min, max, mutation }`);
    migrees += 1;
    return { id: mutation, min, max };
  }),
}));

if (migrees) writeFileSync(fichier, serializeDataset(resultat));
console.log(`migration 3915 : ${migrees} rangée(s) migrée(s) dans mutationTables.json.`);
