import { nommerChamps, metaDesChamps } from '../grammaire/meta';
/** LDB 08 l.38-46. */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { couvertureDuDeDuDocument, enumNomme, plageSchema } from '../grammaire/valeurs';

export const file = 'reaction-au-statut.json';
export const famille = 'config';

/** L'issue d'une rangée, lue par `statusCharmMod`. */
export const issueDeReactionSchema = enumNomme({
  'braver-le-statut': 'Braver le Statut',
  'reactions-classiques': 'Réactions classiques',
  'opinions-extremes': 'Opinions extrêmes',
});

export const rangee = nommerChamps(z.strictObject({
  ...plageSchema.shape,
  id: z.string(),
  issue: issueDeReactionSchema,
}), {
  ...metaDesChamps(plageSchema, { exigees: true }),
  id: { label: 'identifiant' },
  issue: { label: 'issue' },
});

const doc = document(
  'reaction-au-statut',
  famille,
  {},
  {},
  {
    edit: { niche: { categories: { reactionAuStatut: 'entries' } } },
  },
  {
    rangee,
    deDeTirage: true,
    affinerDataset: couvertureDuDeDuDocument<{ id: string; die: string; entries: z.output<typeof rangee>[] }>(file, (r) => `la rangée « ${r.id} » (${r.min}-${r.max})`),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
