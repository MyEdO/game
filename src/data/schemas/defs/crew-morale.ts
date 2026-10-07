import { nommerChamps, metaDesChamps } from '../grammaire/meta';
/** MDG 14. */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { plageSchema, sourceRefSchema } from '../grammaire/valeurs';
import { listeCle } from '../grammaire/collection-cle';

export const file = 'crew-morale.json';
export const famille = 'config';

const doc = document(
  'crew-morale',
  famille,
  {
  base: z.number(),
  factors: listeCle(
    nommerChamps(z.strictObject({
      id: z.string(),
      label: z.string(),
      /** Dés signés texte (ex. « +2d10 », « -3d10 ») — lu par `rollExpr` (`src/engine/dice.ts`). */
      effect: z.string(),
      /** MDG 14. */
      wageMul: z.number().optional(),
      /** MDG 14. */
      recommendedPay: z.boolean().optional(),
      source: sourceRefSchema,
    }), {
      id: { label: 'identifiant' },
      label: { label: 'libellé' },
      effect: { label: 'effet' },
      wageMul: { label: 'multiplicateur de paie' },
      recommendedPay: { label: 'paie recommandée' },
      source: { label: 'source' },
    }),
    'id',
  ),
  bands: listeCle(
    nommerChamps(z.strictObject({
      ...plageSchema.shape,
      id: z.string(),
      label: z.string(),
      captainCmdDR: z.number(),
      crewTestDR: z.number(),

      desertionRoll: z.number().optional(),
      desc: z.string(),
      source: sourceRefSchema,
    }), {
      ...metaDesChamps(plageSchema, { exigees: true }),
      id: { label: 'identifiant' },
      label: { label: 'libellé' },
      captainCmdDR: { label: 'DR de commandement du capitaine' },
      crewTestDR: { label: 'DR du Test d’équipage' },
      desertionRoll: { label: 'jet de désertion' },
      desc: { label: 'texte' },
      source: { label: 'source' },
    }),
    'id',
  ),
  },
  {
    base: { label: 'Score de départ', hint: "Score de Moral de départ d'un équipage" },
    factors: {
      label: 'Facteurs de Moral',
      hint: 'Modificateurs de Moral en dés signés (ex. +2d10), dont les choix de paie du Conseil de bord',
    },
    bands: {
      label: 'Effets du Moral',
      hint: "Bandes de score vers plus/moins DR de Commandement/Tests d'équipage, seuil de désertion",
    },
  },
  {
    codex: { keys: ['crewMoraleFactors', 'crewMoraleBands'] },
    edit: { niche: { categories: { crewMoraleFactors: 'factors', crewMoraleBands: 'bands' } } },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
