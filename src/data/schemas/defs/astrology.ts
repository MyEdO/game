/**
 * Schéma de `astrology.json` — Demeures célestes (ADE II 3 l.502-512), lu en `celestialHouses`
 * (`src/data/index.ts`).
 */
import type { z } from 'zod';
import { document } from '../grammaire/document';
import { metaDesChamps } from '../grammaire/meta';
import { ecartsDeCouverture, plageEntiereSchema } from '../grammaire/valeurs';

export const file = 'astrology.json';
export const famille = 'entite';

const doc = document(
  'astrology',
  famille,
  plageEntiereSchema.shape,
  metaDesChamps(plageEntiereSchema, { exigees: true }),
  {
    codex: { keys: ['celestialHouses'] },
    edit: { dataset: 'celestialHouses' },
  },
  {
    exiges: ['desc', 'source'],
    affinerDataset: (dataset) => dataset.superRefine((v, ctx) => {
      const demeures = v as (z.output<typeof plageEntiereSchema> & { id: string })[];
      const ecarts = ecartsDeCouverture(demeures, 1, 10, (d) => `la demeure « ${d.id} »`);
      if (ecarts.length) {
        ctx.addIssue({
          code: 'custom',
          message: `${file} : les demeures célestes ne couvrent pas la bande de 1 à 10 — ${ecarts.join(' ; ')}.`,
        });
      }
    }),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
