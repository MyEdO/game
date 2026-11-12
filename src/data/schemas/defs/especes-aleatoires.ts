import { metaDesChamps, nommerNoeud } from '../grammaire/meta';
/** LDB 04 l.93-101 ; NADJ 14 l.66-75 ; ADE II 02 l.112-121 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { couvertureDuDeParDocument, plageSchema, raceKeySchema } from '../grammaire/valeurs';
import { idsDeLaSousListe, ref } from '../grammaire/ref';

export const file = 'especes-aleatoires.json';
export const famille = 'entite';

const plage = metaDesChamps(plageSchema, { exigees: true });

/** Une rangée du tableau : la référence de l'espèce nominale de sa race, à sa fourchette. */
export const rangee = ref('species', {
  min: nommerNoeud(z.number(), { nom: plage.min.label }),
  max: nommerNoeud(z.number(), { nom: plage.max.label }),
});

type Document = { id: string; die: string; entries: z.output<typeof rangee>[] };

const doc = document(
  'especes-aleatoires',
  famille,
  {},
  {},
  {
    codex: { keys: ['especesAleatoires'] },
    edit: { dataset: 'especesAleatoires' },
  },
  {
    rangee,
    deDeTirage: true,
    /** `tableDesRacesAleatoires` (`src/data/index.ts`) */
    affinerDataset: (dataset) =>
      couvertureDuDeParDocument<Document>(file, (r) => `la rangée ${r.min}-${r.max} (${r.id})`)(dataset).superRefine((v, ctx) => {
        const premiers = new Map<string, string>();
        for (const [i, d] of (v as Document[]).entries()) {
          const ids = new Set<string>(d.entries.map((r) => r.id));
          const races = raceKeySchema.options.filter((race) => idsDeLaSousListe('species', race).some((id) => ids.has(id))).sort();
          const cle = races.join(', ');
          const premier = premiers.get(cle);
          if (premier === undefined) premiers.set(cle, d.id);
          else ctx.addIssue({ code: 'custom', path: [i, 'entries'], message: `${file} › ${d.id} : le jeu de races « ${cle} » est déjà celui du document « ${premier} » : un seul document par jeu de races.` });
        }
      }),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
