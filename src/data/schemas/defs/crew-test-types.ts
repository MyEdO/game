/**
 * Schéma de `crew-test-types.json` — types de Test d'équipage, MDG 14. Consommé par `src/data/index.ts` (`CrewTestTypeData`),
 * `findCrewTestTypeById`) et `src/engine/crewMorale.ts`/`src/state/shipCrew.ts`.
 */
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
    z.strictObject({
      id: z.string(),
      label: z.string(),
      roles: z.array(z.string()),
      essential: z.string(),
      /** Fiche `regles.json` qui ADRESSE le passage MDG 14 du Test. L'enjeu AFFICHÉ vient de
       *  `voyage-stakes.json`. */
      rule: z.string().optional(),
      /** MDG 14 l.110. */
      moraleOnNegativeDR: z.boolean().optional(),
      /** Test d'équipage qui DIRIGE le navire — MSRC 12 l.66/140. */
      steering: z.boolean().optional(),
      source: sourceRefSchema,
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
