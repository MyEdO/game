import { nommerChamps } from '../grammaire/meta';
/** LDB 05 ; LDB 05 l.627-633 ; ADE II 02 l.325-382 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { raceKeySchema } from '../grammaire/valeurs';

export const file = 'names.json';
export const famille = 'entite';

const composantesDePrenoms = z.array(z.string().regex(/^\S+$/, 'La composante doit former un seul mot.')).min(1);

const champs = {
  maleFirstNames: z.array(z.string()),
  femaleFirstNames: z.array(z.string()),
  lastNames: z.array(z.string()),
  firstNamePrefixes: composantesDePrenoms.optional(),
  firstNameSuffixes: composantesDePrenoms.optional(),
  lastNameSuffixes: nommerChamps(z
    .strictObject({
      M: z.array(z.string()),
      F: z.array(z.string()),
    }), { M: { label: 'Masculin' }, F: { label: 'Féminin' } })
    .optional(),
};

const doc = document(
  'names',
  famille,
  champs,
  {
    maleFirstNames: { label: 'Prénoms masculins', hint: 'Prénoms masculins tirés à la création pour cette race' },
    femaleFirstNames: { label: 'Prénoms féminins', hint: 'Prénoms féminins tirés à la création pour cette race' },
    lastNames: {
      label: 'Noms de famille',
      hint: 'Noms de famille tirés à la création (hors patronymes nains et noms ogres traditionnels)',
    },
    firstNamePrefixes: { label: 'Racines de prénoms' },
    firstNameSuffixes: { label: 'Terminaisons de prénoms' },
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
    affinerEntree: (entree) => entree.superRefine((valeur, ctx) => {
      const pool = valeur as z.output<z.ZodObject<typeof champs>>;
      const { firstNamePrefixes, firstNameSuffixes } = pool;
      if (firstNamePrefixes && firstNameSuffixes) {
        if (pool.maleFirstNames.length || pool.femaleFirstNames.length || pool.lastNames.length || pool.lastNameSuffixes) {
          ctx.addIssue({ code: 'custom', message: 'Les composantes de prénoms remplacent les listes de noms et les suffixes patronymiques.' });
        }
        return;
      }
      if (firstNamePrefixes || firstNameSuffixes) {
        ctx.addIssue({
          code: 'custom',
          path: [firstNamePrefixes ? 'firstNameSuffixes' : 'firstNamePrefixes'],
          message: 'Les racines et les terminaisons de prénoms vont de pair.',
        });
        return;
      }
      if (!pool.maleFirstNames.length || !pool.femaleFirstNames.length
        || (!pool.lastNames.length && !(pool.lastNameSuffixes?.M.length && pool.lastNameSuffixes.F.length))) {
        ctx.addIssue({ code: 'custom', message: 'La banque doit pouvoir former un nom pour chaque sexe.' });
      }
    }),
    affinerDataset: (dataset) =>
      dataset.superRefine((v, ctx) => {
        const ids = (v as { id: string }[]).map((d) => d.id);
        const attendus = [...raceKeySchema.options].sort();
        const mesures = [...ids].sort();
        if (mesures.join(',') !== attendus.join(',')) {
          ctx.addIssue({
            code: 'custom',
            path: [],
            message: `names.json : les ids du dataset (${mesures.join(', ')}) ne sont pas exactement les races jouables (${attendus.join(', ')}) — une banque par \`RaceKey\`, ni plus ni moins.`,
          });
        }
      }),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
