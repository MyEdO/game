import { nommerChamps } from '../grammaire/meta';
/**
 * Schéma de `merchantFamilies.json` — familles de PRÉSENTATION du stock marchand, miroir de
 * `MerchantFamilyData` (`src/data/index.ts`). Consommé par `ui/MerchantPanel.tsx` (`FAMILIES`,
 * `familyOf`, `FAMILY_COLS` dérivés) — ordre du tableau = ordre d'affichage des onglets.
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
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
