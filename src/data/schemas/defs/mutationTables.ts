import { metaDesChamps, nommerNoeud } from '../grammaire/meta';
/** LDB 19 ; EDOC 12 */
import type { z } from 'zod';
import { document } from '../grammaire/document';
import { couvertureDuDeParDocument, plageSchema } from '../grammaire/valeurs';
import { ref } from '../grammaire/ref';
import type { DiceSpec } from '../../../engine/dice';

export const file = 'mutationTables.json';
export const famille = 'entite';

const plage = metaDesChamps(plageSchema, { exigees: true });

export const rangee = ref('mutation', {
  min: nommerNoeud(plageSchema.shape.min.int(), { nom: plage.min.label }),
  max: nommerNoeud(plageSchema.shape.max.int(), { nom: plage.max.label }),
});

const doc = document(
  'mutationTables',
  famille,
  {},
  {},
  {
    codex: { keys: ['mutationTables'] },
    edit: { dataset: 'mutationTables' },
  },
  {
    rangee,
    deDeTirage: true,
    affinerDataset: couvertureDuDeParDocument<{ id: string; die: DiceSpec; entries: z.output<typeof rangee>[] }>(file, (r) => `la rangée « ${r.id} »`),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
