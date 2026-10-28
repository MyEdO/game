/**
 * Schéma de `breath-types.json` — Types de Souffle (Feu/Froid/Corrosif/Électrique/Poison/Fumée),
 * argument du Trait Souffle, et la RÈGLE de chaque Type (LDB 85 l.322-329) que la manœuvre `souffle`
 * compose (`souffleDuType`, `engine/creatureAttacks.ts`). Reflet de `BreathTypeData` (`src/data/index.ts`).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { idDe, ref } from '../grammaire/ref';

export const file = 'breath-types.json';
export const famille = 'entite';

const doc = document(
  'breath-types',
  famille,
  {
    /** LDB 85 l.326-328 */
    ignoreAP: z.boolean().optional(),
    /** LDB 85 l.324, l.326-328 */
    etat: idDe('etat').optional(),
    /** LDB 85 l.324 */
    trancheDeBlessures: z.number().int().positive().optional(),
    /** LDB 85 l.325 */
    endommageLEquipement: z.boolean().optional(),
    /** LDB 85 l.329 */
    fumee: z.boolean().optional(),
    /** EDOC 13 l.237 */
    types: z.array(ref('breathType')).optional(),
  },
  {
    ignoreAP: { label: 'Ignore les PA', hint: 'Toutes les Blessures infligées par le Souffle ignorent les Points d’Armure' },
    etat: { label: 'État infligé', hint: 'L’État que gagnent les cibles touchées' },
    trancheDeBlessures: { label: 'Tranche de Blessures', hint: 'Les cibles gagnent l’État pour chaque tranche de ce nombre de Blessures subies (minimum 1)' },
    endommageLEquipement: { label: 'Endommage l’équipement', hint: 'Toutes les Armures et Armes portées par les cibles subissent 1 Dégât' },
    fumee: { label: 'Fumée', hint: 'La zone se remplit de fumée qui bloque les Lignes de vue pendant Bonus d’Endurance Rounds' },
    types: { label: 'Types composés', hint: 'Type imprimé qui en nomme plusieurs : le Souffle applique les règles de chacun' },
  },
  {
    codex: {
      exempt: {
        kind: 'vocabulaire-app-interne',
        raison:
          'Type de Souffle : paramètre du Trait Souffle, dont la fiche porte la règle de chaque Type (LDB 85 l.322-329) — aucune fiche autonome.',
      },
    },
    edit: { none: 'aucune catégorie Codex ne l’expose, donc aucun formulaire d’atelier ne l’édite', dataset: 'breathTypes' },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
