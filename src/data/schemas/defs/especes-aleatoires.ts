import { metaDesChamps, nommerNoeud } from '../grammaire/meta';
/** LDB 04 l.93-101 ; NADJ 14 l.66-75 ; ADE II 02 l.112-121 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { couvertureDuDeParDocument, plageSchema } from '../grammaire/valeurs';
import { ref } from '../grammaire/ref';

export const file = 'especes-aleatoires.json';
export const famille = 'entite';

const plage = metaDesChamps(plageSchema, { exigees: true });

/** Une rangée du tableau : la référence de l'espèce nominale de sa race, à sa fourchette. */
export const rangee = ref('species', {
  min: nommerNoeud(z.number(), { nom: plage.min.label }),
  max: nommerNoeud(z.number(), { nom: plage.max.label }),
});

const doc = document(
  'especes-aleatoires',
  famille,
  {},
  {},
  {
    codex: { keys: ['especesAleatoires'] },
    edit: { dataset: 'especesAleatoires' },
  },
  {
    rangee,
    deDeTirage: true,
    affinerDataset: couvertureDuDeParDocument<{ id: string; die: string; entries: z.output<typeof rangee>[] }>(file, (r) => `la rangée ${r.min}-${r.max} (${r.id})`),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
