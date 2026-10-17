import { nommerChamps } from '../grammaire/meta';
/** MDG 14. */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { moneySchema, sourceRefSchema } from '../grammaire/valeurs';
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
        maison: z.string().optional(),
      }), {
      daily: { label: 'paie quotidienne' },
      weekly: { label: 'paie hebdomadaire' },
      source: { label: 'source' },
      maison: { label: 'arbitrage maison' },
    })
      .optional(),
  },
  {
    skills: { label: 'Compétences du rôle', hint: 'Compétence (+ spécialisation optionnelle) qui couvre ce rôle d’équipage' },
    wage: { label: 'Solde', hint: 'Coût quotidien et hebdomadaire d’un mercenaire tenant ce rôle' },
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
