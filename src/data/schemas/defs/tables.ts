import { nommerChamps, metaDesChamps } from '../grammaire/meta';
/**
 * Schéma de `tables.json` — Tables d'EFFETS référençables (`EffectTable`, `src/data/effectTables.ts`).
 * Rangées `[min,max] → GameOp[]` tirées par l'op `rollTable` variante `tableId`. Miroir de `mutationTables`
 * mais la rangée porte des `GameOp` (forme LOOSE `gameOpSchema`) au lieu d'un id de mutation.
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { executeesDe } from '../grammaire/mecanique';
import { ecartsDeCouverture, plageOuverteSchema } from '../grammaire/valeurs';
import { facesDuDe } from '../../../engine/tables';
import { parseDice, totalDuDe } from '../../../engine/dice';

export const file = 'tables.json';
export const famille = 'entite';

const rangee = nommerChamps(z.strictObject({
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
    edit: { none: 'exposé au Codex en LECTURE seule — aucune clé de `CodexEdit.CATEGORY_DATASET` ne le route vers un formulaire d’atelier' },
  },
  {
    rangee,
    deDeTirage: true,
    // VDM 12 l.435 ; patron `structure-criticals.ts`.
    affinerDataset: (dataset) =>
      dataset.superRefine((v, ctx) => {
        for (const [i, t] of (v as { id: string; die: string; entries: z.output<typeof rangee>[] }[]).entries()) {
          const de = parseDice(t.die);
          if (!de) continue;
          const jusqua = t.entries.some((r) => r.max === null) ? 'ouverte' : facesDuDe(t.die);
          const ecarts = ecartsDeCouverture(t.entries, totalDuDe(de, de.n), jusqua, (r) => `la rangée n° ${t.entries.indexOf(r) + 1}`);
          if (ecarts.length) {
            ctx.addIssue({
              code: 'custom',
              path: [i, 'entries'],
              message: `tables.json › ${t.id} : les rangées ne couvrent pas le ${t.die} d'un seul tenant depuis ${totalDuDe(de, de.n)} — ${ecarts.join(' ; ')}.`,
            });
          }
        }
      }),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
