/** LDB 05 l.514-531 ; CRB 006 l.31-54 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { couvertureDuDeParDocument, rangeeDeTable } from '../grammaire/valeurs';
import type { DiceSpec } from '../../../engine/dice';

export const file = 'talents-aleatoires.json';
export const famille = 'entite';

/** Une rangée du tableau : la référence du Talent qu'elle désigne, sa spécialisation si la table la fixe, à sa fourchette. */
export const rangee = rangeeDeTable('talent');

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
    affinerDataset: couvertureDuDeParDocument<{ id: string; die: DiceSpec; entries: z.output<typeof rangee>[] }>(file, (r) => `la rangée « ${r.id} »`),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
