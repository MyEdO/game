import { metaDesChamps, nommerNoeud } from '../grammaire/meta';
/** MDG 15 l.404-418 ; MSRC 13 l.69-78 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { couvertureDuDeParDocument, plageSchema, saisonSchema } from '../grammaire/valeurs';
import { porteLeMarqueur, ref, refusDeLId } from '../grammaire/ref';
import { voieSchema } from './cargoes';

export const file = 'cargaisons-aleatoires.json';
export const famille = 'entite';

const plage = metaDesChamps(plageSchema, { exigees: true });

/** Une rangée d'une colonne : la référence de la cargaison qu'elle désigne, à sa fourchette. */
export const rangee = ref('cargo', {
  min: nommerNoeud(z.number(), { nom: plage.min.label }),
  max: nommerNoeud(z.number(), { nom: plage.max.label }),
});

type Document = { id: string; die: string; voie: z.output<typeof voieSchema>; saison: z.output<typeof saisonSchema>; entries: z.output<typeof rangee>[] };

const nomDeRangee = (r: z.output<typeof rangee>) => `la rangée ${r.min}-${r.max} (${r.id})`;

/** Une cargaison qui porte un prix est une marchandise (`defs/cargoes.ts`). */
const marchandise = porteLeMarqueur('cargo', 'price');

const doc = document(
  'cargaisons-aleatoires',
  famille,
  { voie: voieSchema, saison: saisonSchema },
  {
    voie: { label: 'Voie', hint: 'Le livre dont la table porte la colonne : maritime (MDG 15) ou terrestre et fluviale (MSRC 13)' },
    saison: { label: 'Saison', hint: 'La colonne saisonnière imprimée que tire ce document' },
  },
  {
    codex: { keys: ['cargaisonsAleatoires'] },
    edit: { dataset: 'cargaisonsAleatoires' },
  },
  {
    rangee,
    deDeTirage: true,
    affinerDataset: (dataset) =>
      couvertureDuDeParDocument<Document>(file, nomDeRangee)(dataset).superRefine((v, ctx) => {
        const colonnes = new Map<string, string>();
        for (const [i, t] of (v as Document[]).entries()) {
          const colonne = `${t.voie} › ${t.saison}`;
          const deja = colonnes.get(colonne);
          if (deja !== undefined) ctx.addIssue({ code: 'custom', path: [i, 'saison'], message: `${file} › ${t.id} : la colonne ${colonne} est déjà tirée par « ${deja} ».` });
          colonnes.set(colonne, t.id);
          for (const [j, r] of t.entries.entries()) {
            const refus = refusDeLId('cargo', r.id, t.voie) ?? (marchandise(r.id) ? null : `« ${r.id} » ne porte aucun prix : un marqueur de colonne Production/Produits n'est pas une marchandise.`);
            if (refus) ctx.addIssue({ code: 'custom', path: [i, 'entries', j, 'id'], message: `${file} › ${t.id} : ${nomDeRangee(r)} — ${refus}` });
          }
        }
      }),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
