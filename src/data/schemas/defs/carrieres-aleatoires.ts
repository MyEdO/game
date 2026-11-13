import { metaDesChamps, nommerNoeud } from '../grammaire/meta';
/** LDB 05 l.214-299 ; MDG 09 l.9, l.21-30 ; AA 02 l.109-128 ; VDM 03 l.17-31 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { couvertureDuDeParDocument, ecartsDeCouverture, ecartsDuDeDeLaTable, enumNomme, plageSchema } from '../grammaire/valeurs';
import { idDe, ref } from '../grammaire/ref';

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

/** Sortes d'un document du tableau (`kind`) : LDB 05 l.214 ; MDG 09 l.9 ; AA 02 l.117. */
const LIBELLES_DE_KIND = { colonne: 'Colonne', portion: 'Portion', variante: 'Variante' } as const;

/** Un document du tableau tel que le lit l'affinage du fichier : sa charge, bornée par sa sorte
 *  (`espace.chargeParDiscriminant`), y est encore celle de la donnée, que `refusDeCharge` nomme. */
type Document = { id: string; die?: string; kind: keyof typeof LIBELLES_DE_KIND; colonne?: string; carriere?: string; entries: z.output<typeof rangee>[] };
/** Un document qui porte le dé de son tirage : une colonne, une variante (`chargeParDiscriminant`). */
type DocumentADe = Document & { die: string };

const nomDeRangee = (r: z.output<typeof rangee>) => `la rangée ${r.min}-${r.max} (${r.id})`;

const doc = document(
  'carrieres-aleatoires',
  famille,
  {
    kind: enumNomme(LIBELLES_DE_KIND),
    /** MDG 09 l.9 */
    colonne: idDe('carrieresAleatoires', 'colonne').optional(),
    /** AA 02 l.117 */
    carriere: idDe('career').optional(),
    /** AA 02 l.109 ; VDM 03 l.17 */
    tableauDuLdb: z.boolean().optional(),
  },
  {
    kind: { label: 'Sorte', hint: 'Colonne imprimée, portion qui en remplace une étendue au choix du joueur avant le jet, ou variante tirée après une carrière — les clés admises en dépendent' },
    colonne: { label: 'Colonne remplacée en partie', hint: 'La colonne dont la portion remplace l’étendue qu’elle couvre' },
    carriere: { label: 'Carrière détaillée', hint: 'La carrière dont le tirage ouvre ce jet optionnel' },
    tableauDuLdb: { label: 'Tableau du Livre de base', hint: 'La colonne est l’un des tableaux de Carrières aléatoires du Livre de base : le tirage d’une carrière détaillée y ouvre le jet optionnel de sa variante' },
  },
  {
    codex: { keys: ['carrieresAleatoires'] },
    edit: { dataset: 'carrieresAleatoires' },
  },
  {
    rangee,
    deDeTirage: true,
    espace: { discriminant: 'kind', chargeParDiscriminant: { colonne: ['die', 'tableauDuLdb'], portion: ['colonne'], variante: ['carriere', 'die'] }, requisesParDiscriminant: { colonne: ['die'] } },
    affinerDataset: (dataset) =>
      couvertureDuDeParDocument<DocumentADe>(file, nomDeRangee, (t: Document) => t.die !== undefined)(dataset).superRefine((v, ctx) => {
        const documents = v as Document[];
        const refus = (i: number, champ: string, message: string) => ctx.addIssue({ code: 'custom', path: [i, champ], message: `carrieres-aleatoires.json › ${documents[i].id} : ${message}.` });
        const colonneDeBase = (id: string) => documents.find((d): d is DocumentADe => d.id === id && d.kind === 'colonne' && d.die !== undefined);
        const vues = new Map<string, string>();
        for (const [i, p] of documents.entries()) {
          if (p.kind !== 'portion' || p.colonne === undefined) continue;
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
        /** AA 02 l.115-128 */
        const variantes = new Map<string, string>();
        for (const [i, d] of documents.entries()) {
          if (d.kind !== 'variante' || d.carriere === undefined) continue;
          const carriere = d.carriere;
          const premiere = variantes.get(carriere);
          if (premiere !== undefined) {
            refus(i, 'carriere', `la carrière détaillée « ${carriere} » porte déjà la variante « ${premiere} » : une seule variante par carrière détaillée`);
            continue;
          }
          variantes.set(carriere, d.id);
          if (!d.entries.some((r) => r.id === carriere)) refus(i, 'entries', `aucune rangée ne désigne la carrière détaillée « ${carriere} »`);
        }
      }),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
