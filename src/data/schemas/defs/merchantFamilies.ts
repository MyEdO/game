import { nommerChamps } from '../grammaire/meta';
/**
 * Familles du stock marchand dans l'ordre d'affichage de l'étal Godot (`marchandEnVue.ts`).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { trappingCategorieSchema } from './trappings';

export const file = 'merchantFamilies.json';
export const famille = 'entite';

const doc = document(
  'merchantFamilies',
  famille,
  {
    match: nommerChamps(z.strictObject({
      /** CATÉGORIE de catalogue classée par cette famille (`TrappingData.categorie`). */
      categorie: trappingCategorieSchema.optional(),
      shield: z.boolean().optional(),
      unit: z.boolean().optional(),
    }), {
      categorie: { label: 'catégorie' },
      shield: { label: 'bouclier' },
      unit: { label: 'unité' },
    }),
  },
  {
    match: { label: 'Critère de rattachement', hint: 'Condition qui range un objet dans cette famille de présentation' },
  },
  {
    codex: {
      exempt: {
        kind: 'vocabulaire-app-interne',
        raison:
          "classement des articles dans l'étal marchand par famille — vocabulaire d'application.",
      },
    },
    edit: { none: 'aucune catégorie Codex ne l’expose, donc aucun formulaire d’atelier ne l’édite' },
  },
  // `FAMILLE_PAR_DEFAUT`, `FAMILLE_DES_UNITES`, `FAMILLE_DES_BOUCLIERS`, `FAMILLE_PAR_CATEGORIE` (`src/noyau/marchandEnVue.ts`).
  {
    affinerDataset: (dataset) =>
      dataset.superRefine((v, ctx) => {
        const familles = v as { id: string; match: { categorie?: string; shield?: boolean; unit?: boolean } }[];
        const replis = familles.filter((f) => !f.match.categorie && !f.match.shield && !f.match.unit).map((f) => f.id);
        if (replis.length !== 1)
          ctx.addIssue({ code: 'custom', path: [], message: `merchantFamilies.json : EXACTEMENT UNE famille de repli (\`match\` vide) — ${replis.length} mesurée(s)${replis.length ? ` : ${replis.join(', ')}` : ''}.` });
        for (const critere of ['unit', 'shield'] as const) {
          const porteurs = familles.filter((f) => f.match[critere]).map((f) => f.id);
          if (porteurs.length > 1)
            ctx.addIssue({ code: 'custom', path: [], message: `merchantFamilies.json : AU PLUS UNE famille \`match.${critere}\` — ${porteurs.length} mesurées : ${porteurs.join(', ')}.` });
        }
        const parCategorie = new Map<string, string[]>();
        for (const f of familles) if (f.match.categorie) parCategorie.set(f.match.categorie, [...(parCategorie.get(f.match.categorie) ?? []), f.id]);
        for (const [categorie, porteurs] of parCategorie)
          if (porteurs.length > 1)
            ctx.addIssue({ code: 'custom', path: [], message: `merchantFamilies.json : la catégorie « ${categorie} » est classée par ${porteurs.length} familles (${porteurs.join(', ')}) — une \`match.categorie\` par famille.` });
      }),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
