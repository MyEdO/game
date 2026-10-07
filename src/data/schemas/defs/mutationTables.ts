import { nommerChamps, metaDesChamps } from '../grammaire/meta';
/** LDB 19 ; EDOC */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { plageSchema } from '../grammaire/valeurs';

export const file = 'mutationTables.json';
export const famille = 'entite';

const doc = document(
  'mutationTables',
  famille,
  {
    ranges: z.array(
      nommerChamps(z.strictObject({
        ...plageSchema.shape,
        /** id d'une entrée de `mutations.json` (résolu par `rollMutation`/`BY_ID`). */
        mutation: z.string(),
      }), { ...metaDesChamps(plageSchema, { exigees: true }), mutation: { label: 'Mutation' } }),
    ),
  },
  {
    ranges: { label: 'Plages de tirage', hint: 'Bandes d100 associant chacune une plage à une Mutation par identifiant' },
  },
  {
    codex: { keys: ['mutationTables'] },
    edit: { dataset: 'mutationTables' },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
