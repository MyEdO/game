import { nommerChamps } from '../grammaire/meta';
/** MDG 12 l.313-352 */
import { z } from 'zod';
import { charKeySchema, difficultySchema, plageSchema } from '../grammaire/valeurs';
import { document } from '../grammaire/document';
import { refOuSpec } from '../grammaire/ref';

export const file = 'steam-breakdown.json';
export const famille = 'entite';

const doc = document(
  'steam-breakdown',
  famille,
  {
    ...plageSchema.shape,
    mMod: z.number().optional(),
    durationRounds: z.string().optional(),
    failDamage: z.string().optional(),
    engineDestroyed: z.boolean().optional(),
    hullCritical: z.boolean().optional(),
    compartmentDamage: z.number().optional(),
    mSet: z.number().optional(),
    coolMinutes: z.string().optional(),
    restart: z
      .array(
        nommerChamps(z.strictObject({
          skill: refOuSpec('skill').optional(),
          char: charKeySchema.optional(),
          difficulty: difficultySchema,
          extendedDR: z.number().optional(),
        }), {
          skill: { label: 'Compétence' },
          char: { label: 'Caractéristique' },
          difficulty: { label: 'Difficulté' },
          extendedDR: { label: 'DR du Test étendu' },
        }),
      )
      .optional(),
  },
  {
    min: { label: 'Borne basse', hint: 'Borne basse de la fourchette de tirage de Panne de Vapeur' },
    max: { label: 'Borne haute', hint: 'Borne haute de la fourchette de tirage de Panne de Vapeur' },
    mMod: { label: 'Modificateur de Mouvement', hint: 'Malus de Mouvement infligé par la panne' },
    durationRounds: { label: 'Durée (Rounds)', hint: 'Expression de dés de la durée de la panne' },
    failDamage: { label: 'Dégâts à l’échec', hint: 'Expression de dés des Dégâts infligés en cas d’échec' },
    engineDestroyed: { label: 'Moteur détruit', hint: 'La panne détruit le moteur à vapeur' },
    hullCritical: { label: 'Critique de coque', hint: 'La panne déclenche un Critique de coque' },
    compartmentDamage: { label: 'Dégâts au compartiment', hint: 'Dégâts infligés au compartiment moteur' },
    mSet: { label: 'Mouvement imposé', hint: 'Valeur de Mouvement imposée par la panne (remplace le calcul normal)' },
    coolMinutes: {
      label: 'Minutes de refroidissement',
      hint: 'Expression de dés du délai avant de pouvoir relancer le moteur',
    },
    restart: {
      label: 'Relance du moteur',
      hint: 'Compétence, spécialisation et difficulté du Test pour relancer le moteur',
    },
  },
  {
    codex: { keys: ['steamBreakdowns'] },
    edit: { dataset: 'steamBreakdowns' },
  },
  { exiges: ['desc'] },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
