import { nommerChamps, metaDesChamps } from '../grammaire/meta';
/** MSRC 15 l.149-159. */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { couvertureDuDeDuDocument, plageSchema } from '../grammaire/valeurs';

export const file = 'tableau-capricieux.json';
export const famille = 'config';

export const rangee = nommerChamps(z.strictObject({
  ...plageSchema.shape,
  id: z.string(),
  dr: z.number().int(),
}), {
  ...metaDesChamps(plageSchema, { exigees: true }),
  id: { label: 'identifiant' },
  dr: { label: 'modificateur de DR' },
});

const doc = document(
  'tableau-capricieux',
  famille,
  {},
  {},
  {
    edit: { niche: { categories: { tableauCapricieux: 'entries' } } },
  },
  {
    rangee,
    deDeTirage: true,
    affinerDataset: couvertureDuDeDuDocument<{ id: string; die: string; entries: z.output<typeof rangee>[] }>(file, (r) => `la rangée « ${r.id} » (${r.min}-${r.max})`),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
