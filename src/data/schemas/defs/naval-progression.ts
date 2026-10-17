import { nommerChamps, metaDesChamps } from '../grammaire/meta';
/** MDG 13 l.68-75 */
import { z } from 'zod';
import { document, type DocumentARangees } from '../grammaire/document';
import { ecartsDeCouverture, enumNomme, plageOuverteSchema, sourceRefSchema } from '../grammaire/valeurs';

/** MDG 13 l.68-75 */
export const progressionModeSchema = enumNomme({
  plus2: 'Progression maximale (M+2)',
  plus1: 'Bonne progression (M+1)',
  normal: 'Progression normale (M)',
  minus1: 'Progression lente (M−1)',
  half: 'Lutte pour avancer (M÷2)',
});

export const file = 'naval-progression.json';
export const famille = 'config';

/** Une bande de DR du Test de Navigation. `mode` observés : les 5 issues RAW (ch.13 l.68-75). */
const progressionEntrySchema = nommerChamps(z.strictObject({
  ...plageOuverteSchema.shape,
  /** id STABLE = `mode` (déjà une clé fermée à 5 valeurs) — identité d'entrée pour le Codex (#422). */
  id: z.string(),
  mode: progressionModeSchema,
  desc: z.string(),
  source: sourceRefSchema,
}), {
  ...metaDesChamps(plageOuverteSchema, { exigees: true }),
  id: { label: 'Identifiant' },
  mode: { label: 'Mode' },
  desc: { label: 'Description' },
  source: { label: 'Source' },
});

const doc = document(
  'naval-progression',
  famille,
  {},
  {},
  {
    codex: { keys: ['navalProgression'] },
    edit: { niche: { categories: { navalProgression: 'entries' } } },
  },
  {
    rangee: progressionEntrySchema,
    // MDG 13 l.71, l.75 ; patron `structure-criticals.ts`.
    affinerDataset: (dataset) =>
      dataset.superRefine((v, ctx) => {
        const bandes = (v as { entries?: { id?: string; min?: number | null; max?: number | null }[] }).entries ?? [];
        const ecarts = ecartsDeCouverture(bandes, 'ouverte', 'ouverte', (b) => `la bande « ${b.id} »`);
        if (ecarts.length) {
          ctx.addIssue({
            code: 'custom',
            path: ['entries'],
            message: `naval-progression.json : les bandes ne couvrent pas les DR du Test de Navigation d'un seul tenant — ${ecarts.join(' ; ')}.`,
          });
        }
      }),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;
export const exposition = doc.exposition;
export type NavalProgressionData = DocumentARangees<z.infer<typeof progressionEntrySchema>>;
