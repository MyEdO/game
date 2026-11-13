import { nommerChamps, metaDesChamps } from '../grammaire/meta';
/** LDB 14 l.142-151. */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { ecartsDuDeDeLaTable, enumNomme, plageSchema } from '../grammaire/valeurs';

export const file = 'dispersion.json';
export const famille = 'config';

/** L'origine du décalage d'une rangée. */
export const depuisSchema = enumNomme({
  lanceur: 'Lanceur',
  cible: 'Cible',
});

const decalage = z.union([z.literal(-1), z.literal(0), z.literal(1)]);

export const rangee = nommerChamps(z.strictObject({
  ...plageSchema.shape,
  id: z.string(),
  depuis: depuisSchema,
  dx: decalage,
  dy: decalage,
}), {
  ...metaDesChamps(plageSchema, { exigees: true }),
  id: { label: 'identifiant' },
  depuis: { label: 'depuis' },
  dx: { label: 'décalage en x' },
  dy: { label: 'décalage en y' },
});

type Table = { id: string; die: string; entries: z.output<typeof rangee>[] };

const doc = document(
  'dispersion',
  famille,
  {},
  {},
  {
    edit: { niche: { categories: { dispersion: 'entries' } } },
  },
  {
    rangee,
    deDeTirage: true,
    affinerDataset: (dataset) =>
      dataset.superRefine((v, ctx) => {
        const table = v as Table;
        const ecarts = ecartsDuDeDeLaTable(table, table.entries, (r) => `la rangée « ${r.id} » (${r.min}-${r.max})`);
        if (ecarts.length) {
          ctx.addIssue({ code: 'custom', path: ['entries'], message: `${file} › ${table.id} : les rangées ne couvrent pas le ${table.die} d'un seul tenant — ${ecarts.join(' ; ')}.` });
        }
      }),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
