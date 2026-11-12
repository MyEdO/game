/**
 * Schéma de `hairs.json` — Tableau de couleur des cheveux (LDB 05 l.756-768), document mono-table : son
 * dé `die` (LDB 05 l.758) tire un seuil (`rand`, borne haute cumulée, `randByRace` pour une colonne aux
 * bornes propres, #420). Rangée partagée avec `eyes.json` (`rangeeDeCouleurSchema`), vue TS
 * `DetailColorData` (src/data/index.ts).
 */
import { document } from '../grammaire/document';
import { rangeeDeCouleurSchema } from '../grammaire/valeurs';

export const file = 'hairs.json';
export const famille = 'config';

/** Une couleur, à son seuil du dé de la table. */
export const rangee = rangeeDeCouleurSchema;

const doc = document(
  'hairs',
  famille,
  {},
  {},
  {
    edit: { niche: { categories: { hairs: 'entries' } } },
  },
  { rangee, deDeTirage: true },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
