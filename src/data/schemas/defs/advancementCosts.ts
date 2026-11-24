/**
 * Schéma de `advancementCosts.json` — Tableaux de Coût des Augmentations, un par modèle de progression
 * (`progression` absent : LDB 07 l.51-70 ; `'5e'` : CRB 045 l.33-52), consommés par `src/engine/advancement.ts`
 * (`datasetDe`, qui ignore `id`/`label`). Une bande = nombre d'Augmentations DÉJÀ achetées, `max` borne haute
 * INCLUSIVE ; la DERNIÈRE bande du LDB porte `max: null` (« et au-delà », JSON n'a pas d'Infinity), celle du CRB
 * est fermée (sa table s'arrête à +75). `id`/`label` = identité
 * STABLE de la bande (fourchette d'Augmentations déjà achetées), ajoutée pour l'exposition Codex (#422).
 * Les deux colonnes portent le nom de ce qu'elles sont — des COÛTS EN PX (#1548 L2, DESIGN v2 §S2 :
 * les noms de concept `skill`/`char` sont réservés à leur type).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { ecartsDeCouverture, plageOuverteSchema } from '../grammaire/valeurs';

export const file = 'advancementCosts.json';
export const famille = 'entite';

const doc = document(
  'advancementCosts',
  famille,
  {
    ...plageOuverteSchema.shape,
    progression: z.literal('5e').optional(),
    coutCarac: z.number(),
    coutCompetence: z.number(),
  },
  {
    min: {
      label: 'Borne basse de la bande',
      hint: 'Nombre d’Augmentations déjà achetées à partir duquel la bande s’applique',
    },
    max: {
      label: 'Borne haute de la bande',
      hint: 'Nombre d’Augmentations déjà achetées à ne pas dépasser ; null sur la dernière bande (« et au-delà »)',
    },
    progression: { label: 'Modèle de progression', hint: '5e : table du CRB ; absent : table du LDB' },
    coutCarac: { label: 'Coût (Caractéristique)', hint: 'Coût en PX de la prochaine Augmentation de Caractéristique' },
    coutCompetence: { label: 'Coût (Compétence)', hint: 'Coût en PX de la prochaine Augmentation de Compétence' },
  },
  {
    codex: { keys: ['advancementCosts'] },
    edit: { dataset: 'advancementCosts' },
  },
  {
    // Le LIBELLÉ d'une bande DIT sa fourchette (« 0–5 », « 71+ ») : c'est de l'AFFICHAGE, mais un
    // affichage qui recopie deux nombres de la MÊME entrée. Les deux bornes étant éditables au Codex,
    // rien n'empêchait le libellé de survivre à leur édition et d'annoncer une fourchette que la table
    // ne joue plus. Il se VÉRIFIE donc, il ne se dérive pas : `label` est une clé d'ENVELOPPE (requise
    // `.min(1)`, `grammaire/document.ts`) — le dériver au rendu la laisserait morte en donnée.
    affinerEntree: (entree) =>
      entree.superRefine((v, ctx) => {
        const b = v as { min?: number; max?: number | null; label?: string };
        if (typeof b.min !== 'number') return;
        const attendu = b.max === null ? `${b.min}+` : b.max === b.min ? `${b.min}` : `${b.min}–${b.max}`;
        if (b.label !== attendu) {
          ctx.addIssue({
            code: 'custom',
            path: ['label'],
            message: `advancementCosts.json : le libellé « ${b.label} » ne dit pas la fourchette de sa bande (« ${attendu} ») — il la RECOPIE, donc il ment dès qu'une borne bouge au Codex.`,
          });
        }
      }),
    // CONTIGUÏTÉ des bandes — invariant du DATASET, pas de l'entrée : une bande seule ne sait pas si
    // sa voisine s'arrête là où elle commence. `affinerDataset` (patron `names.ts`) le porte donc
    // après l'emballage par famille, et les trois portes le voient (elles valident le FICHIER,
    // `validateDataset`/`schemaForFile`).
    affinerDataset: (dataset) =>
      dataset.superRefine((v, ctx) => {
        const bandes = (v as { id?: string; min?: number; max?: number | null; progression?: '5e' }[]) ?? [];
        const ecarts = [
          ...ecartsDeCouverture(bandes.filter((b) => b.progression === undefined), 0, 'ouverte', (b) => `la bande « ${b.id} »`),
          ...ecartsDeCouverture(bandes.filter((b) => b.progression === '5e'), 0, 14, (b) => `la bande « ${b.id} »`),
        ];
        if (ecarts.length) {
          ctx.addIssue({
            code: 'custom',
            path: [],
            message: `advancementCosts.json : les bandes ne couvrent pas les Augmentations déjà achetées d'un seul tenant depuis 0 — ${ecarts.join(' ; ')}.`,
          });
        }
      }),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
