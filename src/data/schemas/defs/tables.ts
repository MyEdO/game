import { nommerChamps, metaDesChamps } from '../grammaire/meta';
/**
 * Schéma de `tables.json` — Tables d'EFFETS référençables (`EffectTable`, `src/data/effectTables.ts`).
 * Rangées `[min,max] → GameOp[]` tirées par l'op `rollTable` variante `tableId`. Miroir de `mutationTables`
 * mais la rangée porte des `GameOp` (forme LOOSE `gameOpSchema`) au lieu d'un id de mutation.
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { gameOpSchema } from '../grammaire/mecanique';
import { deDeTableSchema, ecartsDeCouverture, plageOuverteSchema, type DeDeTable } from '../grammaire/valeurs';
import { facesDuDe } from '../../../engine/tables';

export const file = 'tables.json';
export const famille = 'entite';

const doc = document(
  'tables',
  famille,
  {
    die: deDeTableSchema,
    rows: z.array(
      nommerChamps(z.strictObject({
        ...plageOuverteSchema.shape,
        label: z.string().optional(),
        ops: z.array(gameOpSchema),
      }), { ...metaDesChamps(plageOuverteSchema, { exigees: true }), label: { label: 'Libellé' }, ops: { label: 'Opérations' } }),
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
  {
    // VDM 12 l.435 ; patron `structure-criticals.ts`.
    affinerDataset: (dataset) =>
      dataset.superRefine((v, ctx) => {
        type Bande = { min?: number | null; max?: number | null };
        for (const [i, t] of (v as { id?: string; die: DeDeTable; rows?: Bande[] }[]).entries()) {
          const rows = t.rows ?? [];
          const jusqua = rows.some((r) => r.max === null) ? 'ouverte' : facesDuDe(t.die);
          const ecarts = ecartsDeCouverture(rows, 1, jusqua, (r) => `la rangée n° ${rows.indexOf(r) + 1}`);
          if (ecarts.length) {
            ctx.addIssue({
              code: 'custom',
              path: [i, 'rows'],
              message: `tables.json › ${t.id} : les rangées ne couvrent pas le ${t.die} d'un seul tenant depuis 1 — ${ecarts.join(' ; ')}.`,
            });
          }
        }
      }),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
