import { metaDesChamps, nommerNoeud } from '../grammaire/meta';
/** LDB 19 l.76-81 ; ADE II 02 l.172-177 ; NADJ 15 l.173 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { couvertureDuDeParDocument, mutationKindSchema, plageSchema, raceKeySchema } from '../grammaire/valeurs';
import { ref } from '../grammaire/ref';

export const file = 'mutation-nature.json';
export const famille = 'entite';

const plage = metaDesChamps(plageSchema, { exigees: true });

/** Une rangée du tableau : le Tableau de Corruption de la nature qu'elle tire (`physique`, `mentale`), à sa
 *  fourchette. LDB 19 l.83 */
export const rangee = ref('mutationTable', {
  min: nommerNoeud(z.number(), { nom: plage.min.label }),
  max: nommerNoeud(z.number(), { nom: plage.max.label }),
});

type Document = { id: string; race: string; die: string; entries: z.output<typeof rangee>[] };

const doc = document(
  'mutation-nature',
  famille,
  { race: raceKeySchema },
  { race: { label: 'Race', hint: 'Race dont ce tableau tire la nature de la mutation' } },
  {
    codex: { keys: ['mutationNature'] },
    edit: { dataset: 'mutationNature' },
  },
  {
    rangee,
    deDeTirage: true,
    /** `natureDeMutationDe` (`src/data/index.ts`) */
    affinerDataset: (dataset) =>
      couvertureDuDeParDocument<Document>(file, (r) => `la rangée ${r.min}-${r.max} (${r.id})`)(dataset).superRefine((v, ctx) => {
        const premiers = new Map<string, string>();
        for (const [i, d] of (v as Document[]).entries()) {
          for (const [j, r] of d.entries.entries()) {
            if (!mutationKindSchema.safeParse(r.id).success) ctx.addIssue({ code: 'custom', path: [i, 'entries', j, 'id'], message: `${file} › ${d.id} : la rangée ${r.min}-${r.max} tire « ${r.id} », qui n'est pas une nature de mutation (${mutationKindSchema.options.join(', ')}).` });
          }
          const premier = premiers.get(d.race);
          if (premier === undefined) premiers.set(d.race, d.id);
          else ctx.addIssue({ code: 'custom', path: [i, 'race'], message: `${file} › ${d.id} : la race « ${d.race} » est déjà celle du document « ${premier} » : un seul document par race.` });
        }
        for (const race of raceKeySchema.options.filter((r) => !premiers.has(r))) {
          ctx.addIssue({ code: 'custom', path: [], message: `${file} : aucun document ne tire la nature de la mutation de la race « ${race} ».` });
        }
      }),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
