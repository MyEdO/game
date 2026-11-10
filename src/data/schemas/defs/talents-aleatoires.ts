import { metaDesChamps, nommerNoeud } from '../grammaire/meta';
/** LDB 05 l.514-531 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { ecartsDuDeDeLaTable, plageSchema } from '../grammaire/valeurs';
import { ref } from '../grammaire/ref';

export const file = 'talents-aleatoires.json';
export const famille = 'entite';

const plage = metaDesChamps(plageSchema, { exigees: true });

/** Une rangée du tableau : la référence du Talent qu'elle désigne, à sa fourchette. */
export const rangee = ref('talent', {
  min: nommerNoeud(z.number(), { nom: plage.min.label }),
  max: nommerNoeud(z.number(), { nom: plage.max.label }),
});

const doc = document(
  'talents-aleatoires',
  famille,
  {},
  {},
  {
    codex: { keys: ['talentsAleatoires'] },
    edit: { niche: { categories: { talentsAleatoires: '[talents-aleatoires].entries' } } },
  },
  {
    rangee,
    deDeTirage: true,
    affinerDataset: (dataset) =>
      dataset.superRefine((v, ctx) => {
        for (const [i, t] of (v as { id: string; die: string; entries: z.output<typeof rangee>[] }[]).entries()) {
          const ecarts = ecartsDuDeDeLaTable(t, t.entries, (r) => `la rangée « ${r.id} »`);
          if (ecarts.length) {
            ctx.addIssue({
              code: 'custom',
              path: [i, 'entries'],
              message: `talents-aleatoires.json › ${t.id} : les rangées ne couvrent pas le ${t.die} d'un seul tenant — ${ecarts.join(' ; ')}.`,
            });
          }
        }
      }),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
