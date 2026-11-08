import { nommerChamps } from '../grammaire/meta';
/** MDG 14. */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { maisonSchema, moneySchema, sourceRefSchema } from '../grammaire/valeurs';
import { refOuSpec } from '../grammaire/ref';

export const file = 'crew-roles.json';
export const famille = 'entite';

const doc = document(
  'crew-roles',
  famille,
  {
    skills: z.array(refOuSpec('skill')),
    // MDG 14 l.293-302.
    wage: nommerChamps(z
      .strictObject({
        daily: moneySchema,
        weekly: moneySchema,
        source: sourceRefSchema.optional(),
        maison: maisonSchema.optional(),
      }), {
      daily: { label: 'paie quotidienne' },
      weekly: { label: 'paie hebdomadaire' },
      source: { label: 'source' },
      maison: { label: 'arbitrage maison' },
    })
      .optional(),
    /** Rôle tenu par défaut par tout membre que le Test d'équipage n'emploie pas (MDG 14 l.15). */
    parDefaut: z.literal(true).optional(),
  },
  {
    skills: { label: 'Compétences du rôle', hint: 'Compétence (+ spécialisation optionnelle) qui couvre ce rôle d’équipage' },
    wage: { label: 'Solde', hint: 'Coût quotidien et hebdomadaire d’un mercenaire tenant ce rôle' },
    parDefaut: { label: 'Rôle par défaut', hint: 'Rôle tenu par tout membre que le Test d’équipage n’emploie pas à un autre poste' },
  },
  {
    codex: { keys: ['crewRoles'] },
    edit: { dataset: 'crewRoles' },
  },
  { exiges: ['desc'] },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
