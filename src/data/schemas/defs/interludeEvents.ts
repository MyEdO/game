import { nommerChamps } from '../grammaire/meta';

import { z } from 'zod';
import { document } from '../grammaire/document';
import { plageSchema } from '../grammaire/valeurs';

export const file = 'interludeEvents.json';
export const famille = 'entite';

const fxSchema = nommerChamps(z.strictObject({
  moneyPct: z.number().optional(),
  revenuePct: z.number().optional(),
  revenueClasses: z.array(z.string()).optional(),
  revenueBlockedClasses: z.array(z.string()).optional(),
  bankPct: z.number().optional(),
  fortuneMaxDelta: z.number().optional(),
  loseActivity: z.boolean().optional(),
  stashRaided: z.boolean().optional(),
  bankCrashCheck: z.boolean().optional(),
}), {
  moneyPct: { label: 'variation de la bourse en pourcentage' },
  revenuePct: { label: 'variation du revenu en pourcentage' },
  revenueClasses: { label: 'classes concernées par le revenu' },
  revenueBlockedClasses: { label: 'classes sans revenu' },
  bankPct: { label: 'variation de l’épargne en pourcentage' },
  fortuneMaxDelta: { label: 'variation du maximum de Fortune' },
  loseActivity: { label: 'activité perdue' },
  stashRaided: { label: 'cache pillée' },
  bankCrashCheck: { label: 'vérification de faillite bancaire' },
});

const doc = document(
  'interludeEvents',
  famille,
  {
    ...plageSchema.shape,
    fx: fxSchema.optional(),
    /** Note d'atelier — JAMAIS affichée au joueur ni journalisée (contrairement à `desc`) : précise
     *  ce que `fx` ne modélise pas pour cet événement, à l'usage des auteurs de données. */
    atelierNote: z.string().optional(),
  },
  {
    min: { label: 'Borne basse (plage de tirage)' },
    max: { label: 'Borne haute (plage de tirage)' },
    fx: { label: 'Effets sur la trésorerie', hint: 'Impact chiffré argent/revenu/banque/activité' },
    atelierNote: { label: 'Note d’atelier', hint: 'Note interne aux auteurs de données — jamais affichée ni journalisée' },
  },
  {
    codex: { keys: ['interludeEvents'] },
    edit: { dataset: 'interludeEvents' },
  },
  { exiges: ['desc'] },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
