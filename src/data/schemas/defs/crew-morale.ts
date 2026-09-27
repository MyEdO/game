/**
 * Schéma de `crew-morale.json` — MORAL d'un équipage (MDG 14). Consommé par
 * `src/engine/crewMorale.ts` : `base` (score de départ), `factors` (MODIFICATEURS DE MORAL — `effect`
 * = dés signés texte, ex. « +2d10 », « -3d10 », lus par `rollExpr`), `bands` (EFFETS DU MORAL — bornes
 * de bande, ±DR de Commandement/Tests d'équipage, seuil de désertion optionnel).
 */
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
    z.strictObject({
      id: z.string(),
      label: z.string(),
      /** Dés signés texte (ex. « +2d10 », « -3d10 ») — lu par `rollExpr` (`src/engine/dice.ts`). */
      effect: z.string(),
      /** Multiplicateur de SOLDE du choix de paie hebdomadaire (Conseil de bord) — MDG 14 ne chiffre
       *  que l'effet de Moral des lignes « La paie … », jamais le montant : valeur MAISON éditable.
       *  Présent = ce facteur est un CHOIX de paie ; absent = facteur circonstanciel. */
      wageMul: z.number().optional(),
      /** Choix de paie PROÉMINENT du Conseil de bord (bouton principal) — valeur MAISON, au même
       *  titre que `wageMul` (le tableau MDG 14 ne hiérarchise pas les lignes « La paie … »). */
      recommendedPay: z.boolean().optional(),
      source: sourceRefSchema,
    }),
    'id',
  ),
  bands: listeCle(
    z.strictObject({
      ...plageSchema.shape,
      id: z.string(),
      label: z.string(),
      captainCmdDR: z.number(),
      crewTestDR: z.number(),
      /** Absent si aucune désertion pour cette bande (« Mené de main de maître ! », « Un excellent équipage »). */
      desertionRoll: z.number().optional(),
      desc: z.string(),
      source: sourceRefSchema,
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
    edit: { niche: { categories: ['crewMoraleFactors', 'crewMoraleBands'] } },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
