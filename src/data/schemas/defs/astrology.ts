/**
 * Schéma de `astrology.json` — Demeures célestes (ADE II 3 l.502-512), lu en `celestialHouses`
 * (`src/data/index.ts`).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';

export const file = 'astrology.json';
export const famille = 'entite';

const doc = document(
  'astrology',
  famille,
  {
    rand: z.number(),
  },
  {
    rand: { label: 'Borne haute de la bande', hint: 'Bandes 1-2 … 9-10 imprimées par le livre (ADE II 03 l.504-512)' },
  },
  {
    codex: { keys: ['celestialHouses'] },
    edit: { dataset: 'celestialHouses' },
  },
  { exiges: ['desc', 'source'] },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
