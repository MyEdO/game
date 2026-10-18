import { nommerChamps, metaDesChamps } from '../grammaire/meta';
/** AA 10 l.13/116 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { ecartsDeCouverture, plageOuverteSchema } from '../grammaire/valeurs';

export const file = 'structure-criticals.json';
export const famille = 'config';

const structureCritEntrySchema = nommerChamps(z.strictObject({
  ...plageOuverteSchema.shape,
  id: z.string(),
  label: z.string(),
  /** Blessures supplémentaires de la Structure (0 = Triviale ; null = détruite). */
  wounds: z.union([z.number(), z.null()]),
  trivial: z.boolean().optional(),
  destroyed: z.boolean().optional(),
  note: z.string(),
}), {
  ...metaDesChamps(plageOuverteSchema, { exigees: true }),
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
  {
    rangee: structureCritEntrySchema,
    deDeTirage: true,
    // AA 10 l.116-127 ; patron `advancementCosts.ts`.
    affinerDataset: (dataset) =>
      dataset.superRefine((v, ctx) => {
        const rangees = (v as { entries?: { id?: string; min?: number; max?: number | null }[] }).entries ?? [];
        const ecarts = ecartsDeCouverture(rangees, 1, 'ouverte', (e) => `la rangée « ${e.id} »`);
        if (ecarts.length) {
          ctx.addIssue({
            code: 'custom',
            path: ['entries'],
            message: `structure-criticals.json : les rangées ne couvrent pas le d100 d'un seul tenant depuis 1 — ${ecarts.join(' ; ')}. La table est lue par \`findTableEntry\` (\`src/engine/tables.ts\`), qui REPLIE sur la dernière rangée : un trou ferait tomber le Critique sur l'Effondrement.`,
          });
        }
      }),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
