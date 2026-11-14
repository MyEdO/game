/**
 * Schéma de `eyes.json` — Tableau de couleur des yeux (LDB 05 l.742-754), document mono-table : son dé
 * `die` (LDB 05 l.744) tire un seuil (`rand`, borne haute cumulée). Rangée partagée avec `hairs.json`
 * (`rangeeDeCouleurSchema`), vue TS `DetailColorData` (src/data/index.ts).
 */
import { document } from '../grammaire/document';
import { rangeeDeCouleurSchema } from '../grammaire/valeurs';

export const file = 'eyes.json';
export const famille = 'config';

/** Une couleur, à son seuil du dé de la table. */
export const rangee = rangeeDeCouleurSchema;

const doc = document(
  'eyes',
  famille,
  {},
  {},
  {
    edit: { niche: { categories: { eyes: 'entries' } } },
  },
  { rangee, deDeTirage: true },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
