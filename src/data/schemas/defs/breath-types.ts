/**
 * Schéma de `breath-types.json` — Types de Souffle (Feu/Froid/Corrosif/Électrique/Poison/Fumée),
 * argument du Trait Souffle. Reflet de `BreathTypeData` (`src/data/index.ts`).
 *
 * ZÉRO champ hors enveloppe : l'entrée est son identité (`id`/`type`/`label`), rien de plus.
 */
import { document } from '../grammaire/document';

export const file = 'breath-types.json';
export const famille = 'entite';

const doc = document(
  'breath-types',
  famille,
  {},
  {},
  {
    codex: {
      exempt: {
        kind: 'vocabulaire-app-interne',
        raison:
          'vocabulaire de catégorisation (id+label uniquement) — aucune fiche autonome, la RÈGLE (souffle de créature) vit sur la créature elle-même.',
      },
    },
    edit: { none: 'aucune catégorie Codex ne l’expose, donc aucun formulaire d’atelier ne l’édite', dataset: 'breathTypes' },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
