/**
 * Schéma de `damage-types.json` — registre des Types que nomme le Trait Immunité (`src/data/index.ts`,
 * `DamageTypeData`) : argument du Trait et valeur de la Condition `has … what:'immunity'`. LDB 85 l.174
 */
import { document } from '../grammaire/document';
import { ref } from '../grammaire/ref';

export const file = 'damage-types.json';
export const famille = 'entite';

const doc = document(
  'damage-types',
  famille,
  {
    /** VDM 13 l.24, l.61 ; ZI 08 l.28 */
    domaine: ref('domain').optional(),
  },
  {
    domaine: { label: 'Domaine', hint: 'L’Immunité à ce Type rend le porteur insensible aux effets des Sorts de ce Domaine' },
  },
  {
    codex: {
      exempt: {
        kind: 'vocabulaire-app-interne',
        raison: 'vocabulaire de catégorisation (argument du Trait Immunité) — aucune fiche autonome.',
      },
    },
    edit: { none: 'aucune catégorie Codex ne l’expose, donc aucun formulaire d’atelier ne l’édite', dataset: 'damageTypes' },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
