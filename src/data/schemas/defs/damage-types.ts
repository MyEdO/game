/**
 * Schéma de `damage-types.json` — registre des types de Dégâts (Immunité aux Dégâts,
 * `src/data/index.ts`, `DamageTypeData`). 4 entrées présentes : poison/feu/electrique/magique.
 *
 * ZÉRO champ hors enveloppe : l'entrée est son identité (`id`/`type`/`label`), rien de plus.
 */
import { document } from '../grammaire/document';

export const file = 'damage-types.json';
export const famille = 'entite';

const doc = document(
  'damage-types',
  famille,
  {},
  {},
  {
    codex: {
      exempt: {
        kind: 'vocabulaire-app-interne',
        raison: 'vocabulaire de catégorisation (id+label uniquement) — aucune fiche autonome.',
      },
    },
    edit: { none: 'aucune catégorie Codex ne l’expose, donc aucun formulaire d’atelier ne l’édite', dataset: 'damageTypes' },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
