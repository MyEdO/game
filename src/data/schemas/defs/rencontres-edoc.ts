import { nommerChamps } from '../grammaire/meta';
/** EDOC 8 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { travelTableEntrySchema } from '../grammaire/mecanique';
import { listeCle } from '../grammaire/collection-cle';

export const file = 'rencontres-edoc.json';
export const famille = 'config';

const doc = document(
  'rencontres-edoc',
  famille,
  {
    die: z.string(),
    tables: nommerChamps(z.strictObject({
      positives: listeCle(travelTableEntrySchema, 'id'),
      fortuites: listeCle(travelTableEntrySchema, 'id'),
      dangereuses: listeCle(travelTableEntrySchema, 'id'),
    }), {
      positives: { label: 'Positives' },
      fortuites: { label: 'Fortuites' },
      dangereuses: { label: 'Dangereuses' },
    }),
  },
  {
    die: { label: 'Dé de tirage', hint: 'Expression du dé lancé pour tirer une rencontre (d100)' },
    tables: { label: 'Rencontres par catégorie', hint: 'Trois tables sœurs : positives, fortuites, dangereuses' },
  },
  {
    codex: { keys: ['rencontresPositives', 'rencontresFortuites', 'rencontresDangereuses'] },
    edit: { niche: { categories: { rencontresPositives: 'tables.positives', rencontresFortuites: 'tables.fortuites', rencontresDangereuses: 'tables.dangereuses' } } },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
