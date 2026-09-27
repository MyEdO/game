/**
 * Schéma de `tables.json` — Tables d'EFFETS référençables (`EffectTable`, `src/data/effectTables.ts`).
 * Rangées `[min,max] → GameOp[]` tirées par l'op `rollTable` variante `tableId`. Miroir de `mutationTables`
 * mais la rangée porte des `GameOp` (forme LOOSE `gameOpSchema`) au lieu d'un id de mutation.
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { gameOpSchema } from '../grammaire/mecanique';
import { deDeTableSchema, plageSchema } from '../grammaire/valeurs';

export const file = 'tables.json';
export const famille = 'entite';

const doc = document(
  'tables',
  famille,
  {
    die: deDeTableSchema,
    rows: z.array(
      z.strictObject({
        ...plageSchema.shape,
        label: z.string().optional(),
        ops: z.array(gameOpSchema),
      }),
    ),
  },
  {
    die: { label: 'Type de dé' },
    rows: { label: 'Rangées de la table', hint: 'Tirées par l’op rollTable variante tableId' },
  },
  {
    codex: { keys: ['effectTables'] },
    edit: { none: 'exposé au Codex en LECTURE seule — aucune clé de `CodexEdit.CATEGORY_DATASET` ne le route vers un formulaire d’atelier' },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
