import { metaDesChamps, nommerNoeud } from '../grammaire/meta';
/** LDB 05 l.514-531 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { couvertureDuDeParDocument, plageSchema } from '../grammaire/valeurs';
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
    edit: { dataset: 'talentsAleatoires' },
  },
  {
    rangee,
    deDeTirage: true,
    affinerDataset: couvertureDuDeParDocument<{ id: string; die: string; entries: z.output<typeof rangee>[] }>(file, (r) => `la rangée « ${r.id} »`),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
