import { nommerChamps, metaDesChamps } from '../grammaire/meta';
/** EDOC 12 l.170 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { plageSchema } from '../grammaire/valeurs';

export const file = 'obsessions.json';
export const famille = 'config';

/** Une rangée du 2d10. */
const obsessionEntrySchema = nommerChamps(z.strictObject({
  ...plageSchema.shape,
  id: z.string(),
  label: z.string(),
}), { ...metaDesChamps(plageSchema, { exigees: true }), id: { label: 'Identifiant' }, label: { label: 'Libellé' } });

const doc = document(
  'obsessions',
  famille,
  {},
  {},
  {
    codex: { keys: ['obsessions'] },
    edit: { niche: { categories: { obsessions: 'entries' } } },
  },
  { rangee: obsessionEntrySchema },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
