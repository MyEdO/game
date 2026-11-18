import { nommerChamps } from '../grammaire/meta';
/** MDG 14. */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { moneySchema, sourceRefSchema } from '../grammaire/valeurs';
import { ref, refOuSpec } from '../grammaire/ref';

export const file = 'crew-roles.json';
export const famille = 'entite';

const doc = document(
  'crew-roles',
  famille,
  {
    skills: z.array(refOuSpec('skill')),
    /** MDG 14 l.305-380. */
    profil: ref('creature'),
    // MDG 14 l.293-302.
    wage: nommerChamps(z
      .strictObject({
        daily: moneySchema,
        weekly: moneySchema,
        source: sourceRefSchema,
      }), {
      daily: { label: 'paie quotidienne' },
      weekly: { label: 'paie hebdomadaire' },
      source: { label: 'source' },
    })
      .optional(),
    /** Rôle tenu par défaut par tout membre que le Test d'équipage n'emploie pas (MDG 14 l.15). */
    parDefaut: z.literal(true).optional(),
  },
  {
    skills: { label: 'Compétences du rôle', hint: 'Compétence (+ spécialisation optionnelle) qui couvre ce rôle d’équipage' },
    profil: { label: 'Profil', hint: 'Profil du bestiaire que prend un membre d’équipage tenant ce rôle' },
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
