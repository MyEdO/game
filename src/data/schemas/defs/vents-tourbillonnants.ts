import { nommerChamps, metaDesChamps } from '../grammaire/meta';
/** LDB 46 l.183-190 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { plageSchema } from '../grammaire/valeurs';

export const file = 'vents-tourbillonnants.json';
export const famille = 'config';

/** Une rangée du 1d10 : `mod` = modificateur d'Incantation. */
const windsEntrySchema = nommerChamps(z.strictObject({
  ...plageSchema.shape,
  id: z.string(),
  mod: z.number(),
  label: z.string(),
}), {
  ...metaDesChamps(plageSchema, { exigees: true }),
  id: { label: 'Identifiant' },
  mod: { label: 'Modificateur' },
  label: { label: 'Libellé' },
});

const doc = document(
  'vents-tourbillonnants',
  famille,
  {},
  {},
  {
    codex: { keys: ['ventsTourbillonnants'] },
    edit: { niche: { categories: { ventsTourbillonnants: 'entries' } } },
  },
  { rangee: windsEntrySchema },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
