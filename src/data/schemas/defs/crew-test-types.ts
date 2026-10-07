import { nommerChamps } from '../grammaire/meta';
/** MDG 14. */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { sourceRefSchema } from '../grammaire/valeurs';
import { listeCle } from '../grammaire/collection-cle';

export const file = 'crew-test-types.json';
export const famille = 'config';

const doc = document(
  'crew-test-types',
  famille,
  {
  types: listeCle(
    nommerChamps(z.strictObject({
      id: z.string(),
      label: z.string(),
      roles: z.array(z.string()),
      essential: z.string(),
      /** MDG 14. */
      rule: z.string().optional(),
      /** MDG 14 l.110. */
      moraleOnNegativeDR: z.boolean().optional(),
      /** MSRC 12 l.66/140. */
      steering: z.boolean().optional(),
      source: sourceRefSchema,
    }), {
      id: { label: 'identifiant' },
      label: { label: 'libellé' },
      roles: { label: 'rôles' },
      essential: { label: 'rôle essentiel' },
      rule: { label: 'règle' },
      moraleOnNegativeDR: { label: 'moral sur DR négatifs' },
      steering: { label: 'gouverne' },
      source: { label: 'source' },
    }),
    'id',
  ),
  },
  {
    types: {
      label: "Types de Test d'équipage",
      hint: 'Rôles contributeurs, rôle essentiel (DR double), règle associée et effets (ex. Rude épreuve, Manœuvre)',
    },
  },
  {
    codex: { keys: ['crewTestTypes'] },
    edit: { niche: { categories: { crewTestTypes: 'types' } } },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
