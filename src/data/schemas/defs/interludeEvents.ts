import { nommerChamps } from '../grammaire/meta';

import { z } from 'zod';
import { document } from '../grammaire/document';
import { ouReserve, plageSchema, sourceRefSchema } from '../grammaire/valeurs';
import { idDe } from '../grammaire/ref';

export const file = 'interludeEvents.json';
export const famille = 'config';

/** Classes visées par un effet de revenu : ids de `classes.json`, `'*'` = toutes. */
const classesDeRevenuSchema = z.array(ouReserve(idDe('classe'), '*'));

const fxSchema = nommerChamps(z.strictObject({
  moneyPct: z.number().optional(),
  partyWide: z.boolean().optional(),
  revenuePct: z.number().optional(),
  revenueClasses: classesDeRevenuSchema.optional(),
  revenueBlockedClasses: classesDeRevenuSchema.optional(),
  bankPct: z.number().optional(),
  fortuneMaxDelta: z.number().optional(),
  loseActivity: z.boolean().optional(),
  stashRaided: z.boolean().optional(),
  bankCrashCheck: z.boolean().optional(),
}), {
  moneyPct: { label: 'variation de la bourse en pourcentage' },
  partyWide: { label: 'Événement de groupe (vaut pour tous les Personnages)' },
  revenuePct: { label: 'variation du revenu en pourcentage' },
  revenueClasses: { label: 'classes concernées par le revenu' },
  revenueBlockedClasses: { label: 'classes sans revenu' },
  bankPct: { label: 'variation de l’épargne en pourcentage' },
  fortuneMaxDelta: { label: 'variation du maximum de Fortune' },
  loseActivity: { label: 'activité perdue' },
  stashRaided: { label: 'cache pillée' },
  bankCrashCheck: { label: 'vérification de faillite bancaire' },
});

/** Un Événement, à sa fourchette du dé de la table. */
export const rangee = nommerChamps(z.strictObject({
  id: z.string(),
  ...plageSchema.shape,
  label: z.string(),
  desc: z.string().min(1),
  fx: fxSchema.optional(),
  source: sourceRefSchema,
}), {
  id: { label: 'identifiant' },
  min: { label: 'Borne basse (plage de tirage)' },
  max: { label: 'Borne haute (plage de tirage)' },
  label: { label: 'libellé' },
  desc: { label: 'texte' },
  fx: { label: 'Effets sur la trésorerie', hint: 'Impact chiffré argent/revenu/banque/activité' },
  source: { label: 'source' },
});

const doc = document(
  'interludeEvents',
  famille,
  {},
  {},
  {
    edit: { niche: { categories: { interludeEvents: 'entries' } } },
  },
  // LDB 22 l.5
  { rangee, deDeTirage: true },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
