/**
 * Migration #3916 — chaque tirage d'un Talent d'espèce désigne sa table.
 * Entrées : src/data/species.json (écrite), src/data/talents-aleatoires.json (lue).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { serializeDataset } from '../../src/data/serialize.ts';

const fichier = new URL('../../src/data/species.json', import.meta.url);
const catalogue = new URL('../../src/data/talents-aleatoires.json', import.meta.url);
const especes = JSON.parse(readFileSync(fichier, 'utf8'));
const id = 'talents-aleatoires';
const tables = JSON.parse(readFileSync(catalogue, 'utf8'));
let migres = 0;

function migrer(entree, lieu) {
  if (Object.hasOwn(entree, 'random')) {
    const { random } = entree;
    if (Object.keys(entree).length !== 1 || !Number.isInteger(random) || random <= 0)
      throw new Error(`${lieu} : tirage historique attendu sous la forme { random: nombre positif }`);
    migres += 1;
    return { pick: random, table: { id } };
  }
  if (Array.isArray(entree.of)) return { ...entree, of: entree.of.map((option, i) => migrer(option, `${lieu}.of[${i}]`)) };
  return entree;
}

const resultat = especes.map((espece) => ({
  ...espece,
  talents: espece.talents.map((entree, i) => migrer(entree, `species.json › ${espece.id}.talents[${i}]`)),
}));

if (migres) {
  if (!tables.some((table) => table.id === id)) throw new Error(`talents-aleatoires.json : document « ${id} » introuvable`);
  writeFileSync(fichier, serializeDataset(resultat));
}
console.log(`migration 3916 : ${migres} tirage(s) de Talent migré(s) dans species.json.`);
