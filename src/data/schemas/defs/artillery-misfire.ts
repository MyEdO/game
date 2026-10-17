import { nommerChamps, metaDesChamps } from '../grammaire/meta';
/**
 * Schéma de `artillery-misfire.json` — Incidents de Tir d'Artillerie par Salve (Aux Armes, AA
 * l.3940-3946). Reflet de `ArtilleryMisfireEntry` (`src/data/artilleryMisfire.ts`), table SŒUR de
 * `structure-criticals.json` (même patron `{enveloppe, die, entries}`).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { plageSchema } from '../grammaire/valeurs';

export const file = 'artillery-misfire.json';
export const famille = 'config';

const artilleryMisfireEntrySchema = nommerChamps(z.strictObject({
  ...plageSchema.shape,
  id: z.string(),
  label: z.string(),
  location: z.enum(['brasPrincipal', 'random']),

  perSalveIndex: z.boolean(),

  destroyed: z.boolean(),

  strayFire: z.boolean().optional(),
  note: z.string(),
}), {
  ...metaDesChamps(plageSchema, { exigees: true }),
  id: { label: 'identifiant' },
  label: { label: 'libellé' },
  location: { label: 'localisation' },
  perSalveIndex: { label: 'indice dans la salve' },
  destroyed: { label: 'destruction' },
  strayFire: { label: 'tir errant' },
  note: { label: 'note' },
});

const doc = document(
  'artillery-misfire',
  famille,
  {},
  {},
  {
    codex: { keys: ['artilleryMisfire'] },
    edit: { niche: { categories: { artilleryMisfire: 'entries' } } },
  },
  { rangee: artilleryMisfireEntrySchema, deDeTirage: true },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
