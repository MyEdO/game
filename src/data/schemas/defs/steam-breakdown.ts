import { metaDesChamps, nommerChamps } from '../grammaire/meta';
/** MDG 12 l.313-352 */
import { z } from 'zod';
import { cibleEtendueSchema, plageSchema, sourceRefSchema, tirageSchema } from '../grammaire/valeurs';
import { document } from '../grammaire/document';
import { flowTestSchema, porteurDeTestFixe } from '../grammaire/mecanique';

export const file = 'steam-breakdown.json';
export const famille = 'config';

/** Une Panne de vapeur, à sa fourchette du dé de la table. */
export const rangee = nommerChamps(z.strictObject({
  id: z.string(),
  ...plageSchema.shape,
  label: z.string(),
  desc: z.string().min(1),
  mMod: z.number().optional(),
  durationRounds: tirageSchema.optional(),
  failDamage: tirageSchema.optional(),
  engineDestroyed: z.boolean().optional(),
  hullCritical: z.boolean().optional(),
  compartmentDamage: z.number().optional(),
  mSet: z.number().optional(),
  coolMinutes: tirageSchema.optional(),
  restart: z
    .array(
      nommerChamps(porteurDeTestFixe(z.strictObject({
        test: flowTestSchema,
        ...cibleEtendueSchema.partial().shape,
      }), 'difficulty'), {
        test: { label: 'Test' },
        ...metaDesChamps(cibleEtendueSchema, { exigees: true }),
      }),
    )
    .optional(),
  source: sourceRefSchema,
}), {
  id: { label: 'identifiant' },
  min: { label: 'Borne basse', hint: 'Borne basse de la fourchette de tirage de Panne de Vapeur' },
  max: { label: 'Borne haute', hint: 'Borne haute de la fourchette de tirage de Panne de Vapeur' },
  label: { label: 'libellé' },
  desc: { label: 'texte' },
  mMod: { label: 'Modificateur de Mouvement', hint: 'Malus de Mouvement infligé par la panne' },
  durationRounds: { label: 'Durée (Rounds)', hint: 'Dés de la durée de la panne' },
  failDamage: { label: 'Dégâts à l’échec', hint: 'Dés des Dégâts infligés en cas d’échec' },
  engineDestroyed: { label: 'Moteur détruit', hint: 'La panne détruit le moteur à vapeur' },
  hullCritical: { label: 'Critique de coque', hint: 'La panne déclenche un Critique de coque' },
  compartmentDamage: { label: 'Dégâts au compartiment', hint: 'Dégâts infligés au compartiment moteur' },
  mSet: { label: 'Mouvement imposé', hint: 'Valeur de Mouvement imposée par la panne (remplace le calcul normal)' },
  coolMinutes: {
    label: 'Minutes de refroidissement',
    hint: 'Dés du délai avant de pouvoir relancer le moteur',
  },
  restart: {
    label: 'Relance du moteur',
    hint: 'Compétence, spécialisation et difficulté du Test pour relancer le moteur',
  },
  source: { label: 'source' },
});

const doc = document(
  'steam-breakdown',
  famille,
  {},
  {},
  {
    edit: { niche: { categories: { steamBreakdowns: 'entries' } } },
  },
  // MDG 12 l.323 ; l'espace des rangées est le foyer de règle `steamBreakdown` (`grammaire/ref.ts`).
  { rangee, deDeTirage: true, espace: {} },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
