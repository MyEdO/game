import { metaDesChamps, nommerNoeud } from '../grammaire/meta';
/** LDB 05 l.214-299 ; MDG 09 l.9, l.21-30 ; AA 02 l.109-128 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { ecartsDeCouverture, ecartsDuDeDeLaTable, plageSchema } from '../grammaire/valeurs';
import { idDe, ref, refs } from '../grammaire/ref';

export const file = 'carrieres-aleatoires.json';
export const famille = 'entite';

const plage = metaDesChamps(plageSchema, { exigees: true });

/** Une rangée du tableau : la référence de la Carrière qu'elle désigne, à sa fourchette. */
export const rangee = ref('career', {
  min: nommerNoeud(z.number(), { nom: plage.min.label }),
  max: nommerNoeud(z.number(), { nom: plage.max.label }),
});

type Fourchette = { readonly min: number; readonly max: number };

/** L'étendue `[min, max]` que couvrent les rangées d'une portion. */
const etendue = (portion: readonly Fourchette[]): Fourchette => ({
  min: Math.min(...portion.map((r) => r.min)),
  max: Math.max(...portion.map((r) => r.max)),
});

/** La TABLE EFFECTIVE d'une colonne (MDG 09 l.9) : sans portion, la base ; avec, les rangées de la base
 *  hors de l'étendue de la portion, puis celles de la portion, triées. Lue par `rollCareer` et par la
 *  validation de ce fichier. */
export function tableDeCarrieres<R extends Fourchette>(base: readonly R[], portion?: readonly R[]): R[] {
  if (!portion?.length) return [...base];
  const { min, max } = etendue(portion);
  return [...base.filter((r) => r.max < min || r.min > max), ...portion].sort((a, b) => a.min - b.min);
}

/** Un document du tableau : une colonne de base (ni `colonne` ni `carriere`), une portion (`colonne` = l'id de
 *  sa colonne de base) ou une variante (`carriere` = la carrière qu'elle détaille, `colonnes` = sa portée). */
type Document = { id: string; die: string; colonne?: string; carriere?: string; colonnes?: string[]; entries: z.output<typeof rangee>[] };

const nomDeRangee = (r: z.output<typeof rangee>) => `la rangée ${r.min}-${r.max} (${r.id})`;

const doc = document(
  'carrieres-aleatoires',
  famille,
  {
    /** MDG 09 l.9 */
    colonne: idDe('carrieresAleatoires', { horsMarqueurs: ['colonne', 'carriere'] }).optional(),
    /** AA 02 l.117 */
    carriere: idDe('career').optional(),
    colonnes: refs('carrieresAleatoires', { sousListe: { horsMarqueurs: ['colonne', 'carriere'] } }).optional(),
  },
  {
    colonne: { label: 'Colonne remplacée en partie', hint: 'Présente : ce document est une portion qui remplace, au choix du joueur avant le jet, l’étendue qu’elle couvre dans cette colonne' },
    carriere: { label: 'Carrière détaillée', hint: 'Présente : ce document est le jet optionnel qui suit le tirage de cette carrière' },
    colonnes: { label: 'Colonnes concernées', hint: 'Les colonnes dont le tirage de la carrière détaillée ouvre ce jet optionnel' },
  },
  {
    codex: { keys: ['carrieresAleatoires'] },
    edit: { dataset: 'carrieresAleatoires' },
  },
  {
    rangee,
    deDeTirage: true,
    espace: { marqueurs: ['colonne', 'carriere'] },
    affinerDataset: (dataset) =>
      dataset.superRefine((v, ctx) => {
        const documents = v as Document[];
        const refus = (i: number, champ: string, message: string) => ctx.addIssue({ code: 'custom', path: [i, champ], message: `carrieres-aleatoires.json › ${documents[i].id} : ${message}.` });
        const colonneDeBase = (id: string) => documents.find((d) => d.id === id && d.colonne === undefined && d.carriere === undefined);
        for (const [i, t] of documents.entries()) {
          if (t.colonne !== undefined) continue;
          const ecarts = ecartsDuDeDeLaTable(t, t.entries, nomDeRangee);
          if (ecarts.length) refus(i, 'entries', `les rangées ne couvrent pas le ${t.die} d'un seul tenant — ${ecarts.join(' ; ')}`);
        }
        const vues = new Map<string, string>();
        for (const [i, p] of documents.entries()) {
          if (p.colonne === undefined) continue;
          const deja = vues.get(p.colonne);
          if (deja !== undefined) {
            refus(i, 'entries', `la colonne « ${p.colonne} » porte déjà la portion « ${deja} » : une seule portion par colonne`);
            continue;
          }
          vues.set(p.colonne, p.id);
          const { min, max } = etendue(p.entries);
          const trous = ecartsDeCouverture(p.entries, min, max, nomDeRangee);
          if (trous.length) refus(i, 'entries', `les rangées de la portion ne couvrent pas ${min}-${max} d'un seul tenant — ${trous.join(' ; ')}`);
          const base = colonneDeBase(p.colonne);
          if (!base) continue;
          const chevauchantes = base.entries.filter((r) => (r.min < min && r.max >= min) || (r.min <= max && r.max > max));
          for (const r of chevauchantes) refus(i, 'entries', `${nomDeRangee(r)} de la colonne « ${base.id} » chevauche une borne de l'étendue ${min}-${max} de la portion`);
          const effective = ecartsDuDeDeLaTable(base, tableDeCarrieres(base.entries, p.entries), nomDeRangee);
          if (effective.length) refus(i, 'entries', `la table de « ${base.id} » avec la portion ne couvre pas le ${base.die} d'un seul tenant — ${effective.join(' ; ')}`);
        }
        for (const [i, d] of documents.entries()) {
          if ((d.carriere === undefined) !== (d.colonnes === undefined)) {
            refus(i, d.carriere === undefined ? 'colonnes' : 'carriere', '`carriere` et `colonnes` vont ensemble : une variante porte les deux, une colonne ni l’un ni l’autre');
            continue;
          }
          if (d.carriere === undefined) continue;
          const carriere = d.carriere;
          if (!d.entries.some((r) => r.id === carriere)) refus(i, 'entries', `aucune rangée ne désigne la carrière détaillée « ${carriere} »`);
          for (const col of d.colonnes ?? []) {
            const base = colonneDeBase(col);
            if (!base) continue;
            const portion = documents.find((p) => p.colonne === col)?.entries;
            const tables = [tableDeCarrieres(base.entries), tableDeCarrieres(base.entries, portion)];
            if (!tables.some((t) => t.some((r) => r.id === carriere))) refus(i, 'colonnes', `la colonne « ${col} » ne tire pas la carrière détaillée « ${carriere} »`);
          }
        }
      }),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
