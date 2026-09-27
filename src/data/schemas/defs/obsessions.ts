/**
 * Schéma de `obsessions.json` — Tableau des Obsessions (EDOC 12 l.170, folio 69). Document UNIQUE
 * de famille `config`, dérivé de `ObsessionTableFile`/`ObsessionEntry` (`src/data/obsessions.ts`) :
 * son enveloppe (identité + `source`) est posée par la fabrique, sa charge est `entries`.
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { plageSchema } from '../grammaire/valeurs';

export const file = 'obsessions.json';
export const famille = 'config';

/** Une rangée du 2d10. */
const obsessionEntrySchema = z.strictObject({
  ...plageSchema.shape,
  id: z.string(),
  label: z.string(),
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
