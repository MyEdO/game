import { metaDesChamps, nommerNoeud } from '../grammaire/meta';
/** EDOC 12 l.170 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { plageSchema } from '../grammaire/valeurs';
import { ref } from '../grammaire/ref';

export const file = 'obsessions.json';
export const famille = 'config';

const plage = metaDesChamps(plageSchema, { exigees: true });

/** Une rangée du 2d10 : la référence du Groupe qu'elle désigne, à sa fourchette. EDOC 12 l.217, l.241. */
export const obsessionEntrySchema = ref('groupe', {
  min: nommerNoeud(z.number(), { nom: plage.min.label }),
  max: nommerNoeud(z.number(), { nom: plage.max.label }),
});

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
