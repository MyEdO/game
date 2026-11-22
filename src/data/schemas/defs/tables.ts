import { nommerChamps, metaDesChamps } from '../grammaire/meta';
/**
 * Schéma de `tables.json` — Tables d'EFFETS référençables (`EffectTable`, `src/data/effectTables.ts`).
 * Rangées `[min,max] → GameOp[]` tirées par l'op `rollTable` variante `tableId`. Miroir de `mutationTables`
 * mais la rangée porte des `GameOp` (forme LOOSE `gameOpSchema`) au lieu d'un id de mutation.
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { couvertureDeclareeDuDe, type TableTiree } from '../grammaire/couverture-table';
import { executeesDe, mecaniqueDe } from '../grammaire/mecanique';
import { plageOuverteSchema } from '../grammaire/valeurs';

export const file = 'tables.json';
export const famille = 'entite';

const opsDeRangee = executeesDe(mecaniqueDe({ 'grantTrait.choix': 'admis' }).gameOp);

export const rangee = nommerChamps(z.strictObject({
  ...plageOuverteSchema.shape,
  label: z.string().optional(),
  ops: opsDeRangee,
}).refine(({ ops }) => ops.length === 1 || !ops.some((op) => op.op === 'grantTrait' && op.choix), {
  path: ['ops'],
  message: 'L’octroi d’un Trait avec un choix est la seule opération de sa rangée.',
}), { ...metaDesChamps(plageOuverteSchema, { exigees: true }), label: { label: 'Libellé' }, ops: { label: 'Opérations' } });

const doc = document(
  'tables',
  famille,
  { borneHauteOuverte: z.boolean().optional() },
  { borneHauteOuverte: { label: 'Borne haute ouverte' } },
  {
    codex: { keys: ['effectTables'] },
    edit: { dataset: 'effectTables' },
  },
  {
    rangee,
    deDeTirage: true,
    // VDM 12 l.435.
    affinerEntree: couvertureDeclareeDuDe<TableTiree & { borneHauteOuverte?: boolean }>(
      file, (table) => table.borneHauteOuverte ? 'ouverte' : 'fermee',
    ),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
