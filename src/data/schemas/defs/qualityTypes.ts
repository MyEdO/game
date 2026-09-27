/**
 * Schéma de `qualityTypes.json` — miroir de `QualityTypeData` (`src/data/index.ts`) : les 2
 * entrées présentes dans le JSON (`atout`/`defaut`) — grandes familles de Qualités d'objet.
 *
 * ZÉRO champ hors enveloppe : l'entrée est son identité (`id`/`type`/`label`), rien de plus.
 */
import { document } from '../grammaire/document';

export const file = 'qualityTypes.json';
export const famille = 'entite';

const doc = document(
  'qualityTypes',
  famille,
  {},
  {},
  {
    codex: {
      exempt: {
        kind: 'vocabulaire-app-interne',
        raison:
          'vocabulaire de catégorisation des Qualités/Défauts (Atout/Défaut) — consommé par `qualityTypeLabel`, pas une fiche autonome.',
      },
    },
    edit: { none: 'aucune catégorie Codex ne l’expose, donc aucun formulaire d’atelier ne l’édite', dataset: 'qualityTypes' },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
