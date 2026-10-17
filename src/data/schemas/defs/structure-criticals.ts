import { nommerChamps, metaDesChamps } from '../grammaire/meta';
/** AA 10 l.13/116 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { plageSchema } from '../grammaire/valeurs';

export const file = 'structure-criticals.json';
export const famille = 'config';

const structureCritEntrySchema = nommerChamps(z.strictObject({
  ...plageSchema.shape,
  id: z.string(),
  label: z.string(),
  /** Blessures supplémentaires de la Structure (0 = Triviale ; null = détruite). */
  wounds: z.union([z.number(), z.null()]),
  trivial: z.boolean().optional(),
  destroyed: z.boolean().optional(),
  note: z.string(),
}), {
  ...metaDesChamps(plageSchema, { exigees: true }),
  id: { label: 'Identifiant' },
  label: { label: 'Libellé' },
  wounds: { label: 'Blessures' },
  trivial: { label: 'Trivial' },
  destroyed: { label: 'Détruit' },
  note: { label: 'Note' },
});

const doc = document(
  'structure-criticals',
  famille,
  {},
  {},
  {
    codex: { keys: ['structureCriticals'] },
    edit: { niche: { categories: { structureCriticals: 'entries' } } },
  },
  { rangee: structureCritEntrySchema, deDeTirage: true },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
