/**
 * Schéma de `qualitySubtypes.json` — miroir de `QualitySubtypeData` (`src/data/index.ts`) :
 * les 3 entrées présentes dans le JSON (`arme`/`armure`/`objet`) — sous-type d'objet porteur de Qualité.
 *
 * ZÉRO champ hors enveloppe : l'entrée est son identité (`id`/`type`/`label`), rien de plus.
 */
import { document } from '../grammaire/document';

export const file = 'qualitySubtypes.json';
export const famille = 'entite';

const doc = document(
  'qualitySubtypes',
  famille,
  {},
  {},
  {
    codex: {
      exempt: {
        kind: 'vocabulaire-app-interne',
        raison:
          'vocabulaire de catégorisation des Qualités/Défauts (Arme/Armure/Objet) — consommé par `qualitySubtypeLabel`, pas une fiche autonome.',
      },
    },
    edit: { none: 'aucune catégorie Codex ne l’expose, donc aucun formulaire d’atelier ne l’édite', dataset: 'qualitySubtypes' },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
