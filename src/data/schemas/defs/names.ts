import { nommerChamps } from '../grammaire/meta';
/** LDB 05 ; LDB 05 l.627-633 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { raceKeySchema } from '../grammaire/valeurs';

export const file = 'names.json';
export const famille = 'entite';

const doc = document(
  'names',
  famille,
  {
    maleFirstNames: z.array(z.string()),
    femaleFirstNames: z.array(z.string()),
    lastNames: z.array(z.string()),
    lastNameSuffixes: nommerChamps(z
      .strictObject({
        M: z.array(z.string()),
        F: z.array(z.string()),
      }), { M: { label: 'Masculin' }, F: { label: 'Féminin' } })
      .optional(),
  },
  {
    maleFirstNames: { label: 'Prénoms masculins', hint: 'Prénoms masculins tirés à la création pour cette race' },
    femaleFirstNames: { label: 'Prénoms féminins', hint: 'Prénoms féminins tirés à la création pour cette race' },
    lastNames: {
      label: 'Noms de famille',
      hint: 'Noms de famille tirés à la création — vide quand la race génère son patronyme par suffixe (Nains)',
    },
    lastNameSuffixes: {
      label: 'Suffixes patronymiques',
      hint: "Suffixes sexués accolés au prénom d'un parent quand la race n'a pas de nom de famille (LDB 05 l.627-633)",
    },
  },
  {
    codex: { keys: ['names'] },
    edit: { dataset: 'names' },
  },
  {
    affinerDataset: (dataset) =>
      dataset.superRefine((v, ctx) => {
        const ids = (v as { id: string }[]).map((d) => d.id);
        const attendus = [...raceKeySchema.options].sort();
        const mesures = [...ids].sort();
        if (mesures.join(',') !== attendus.join(',')) {
          ctx.addIssue({
            code: 'custom',
            path: ['id'],
            message: `names.json : les ids du dataset (${mesures.join(', ')}) ne sont pas exactement les races jouables (${attendus.join(', ')}) — une banque par \`RaceKey\`, ni plus ni moins.`,
          });
        }
      }),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
