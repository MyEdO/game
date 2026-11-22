/** LDB 05 l.742-754 ; NADJ 15 l.82-104 ; ADE II 02 l.284-311. */
import { document } from '../grammaire/document';
import { couvertureDeLaTableDeCouleur, rangeeDeCouleurSchema } from '../grammaire/valeurs';

export const file = 'eyes.json';
export const famille = 'config';

export const rangee = rangeeDeCouleurSchema;

const doc = document(
  'eyes',
  famille,
  {},
  {},
  {
    edit: { niche: { categories: { eyes: 'entries' } } },
  },
  { rangee, deDeTirage: true, affinerDataset: couvertureDeLaTableDeCouleur(file) },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
