import { nommerChamps } from '../grammaire/meta';
/**
 * Schéma de `merchantFamilies.json` — familles de PRÉSENTATION du stock marchand, miroir de
 * `MerchantFamilyData` (`src/data/index.ts`). Consommé par le panneau du marchand —
 * ordre du tableau = ordre d'affichage des onglets.
 */
import { z } from 'zod';
import { document } from '../grammaire/document';

export const file = 'merchantFamilies.json';
export const famille = 'entite';

const doc = document(
  'merchantFamilies',
  famille,
  {
    match: nommerChamps(z.strictObject({
      /** CATÉGORIE de catalogue classée par cette famille (`TrappingData.categorie`). */
      categorie: z.string().optional(),
      shield: z.boolean().optional(),
      unit: z.boolean().optional(),
    }), {
      categorie: { label: 'catégorie' },
      shield: { label: 'bouclier' },
      unit: { label: 'unité' },
    }),
    columns: z.array(z.string()),
  },
  {
    match: { label: 'Critère de rattachement', hint: 'Condition qui range un objet dans cette famille de présentation' },
    columns: { label: 'Colonnes affichées', hint: 'Colonnes de statistiques affichées pour cette famille, dans l’ordre' },
  },
  {
    codex: {
      exempt: {
        kind: 'vocabulaire-app-interne',
        raison:
          "config de PRÉSENTATION du stock marchand (familles d'onglets, colonnes) — vocabulaire app-interne, pas une fiche de contenu.",
      },
    },
    edit: { none: 'aucune catégorie Codex ne l’expose, donc aucun formulaire d’atelier ne l’édite' },
  },
  // Repli de `familleDeLArticle` (`FAMILLE_PAR_DEFAUT`, `src/noyau/marchandEnVue.ts`).
  {
    affinerDataset: (dataset) =>
      dataset.superRefine((v, ctx) => {
        const replis = (v as { id: string; match: { categorie?: string; shield?: boolean; unit?: boolean } }[])
          .filter((f) => !f.match.categorie && !f.match.shield && !f.match.unit)
          .map((f) => f.id);
        if (replis.length !== 1)
          ctx.addIssue({ code: 'custom', path: [], message: `merchantFamilies.json : EXACTEMENT UNE famille de repli (\`match\` vide) — ${replis.length} mesurée(s)${replis.length ? ` : ${replis.join(', ')}` : ''}.` });
      }),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
