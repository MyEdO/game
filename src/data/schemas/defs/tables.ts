import { nommerChamps, metaDesChamps } from '../grammaire/meta';
/**
 * Schéma de `tables.json` — Tables d'EFFETS référençables (`EffectTable`, `src/data/effectTables.ts`).
 * Rangées `[min,max] → GameOp[]` tirées par l'op `rollTable` variante `tableId`. Miroir de `mutationTables`
 * mais la rangée porte des `GameOp` (forme LOOSE `gameOpSchema`) au lieu d'un id de mutation.
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { executeesDe } from '../grammaire/mecanique';
import { couvertureDuDeParDocument, plageOuverteSchema } from '../grammaire/valeurs';

export const file = 'tables.json';
export const famille = 'entite';

export const rangee = nommerChamps(z.strictObject({
  ...plageOuverteSchema.shape,
  label: z.string().optional(),
  ops: executeesDe(),
}), { ...metaDesChamps(plageOuverteSchema, { exigees: true }), label: { label: 'Libellé' }, ops: { label: 'Opérations' } });

const doc = document(
  'tables',
  famille,
  {},
  {},
  {
    codex: { keys: ['effectTables'] },
    edit: { dataset: 'effectTables' },
  },
  {
    rangee,
    deDeTirage: true,
    // VDM 12 l.435 ; patron `structure-criticals.ts`.
    affinerDataset: couvertureDuDeParDocument<{ id: string; die: string; entries: z.output<typeof rangee>[] }>(file, (r, t) => `la rangée n° ${t.entries.indexOf(r) + 1}`),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
