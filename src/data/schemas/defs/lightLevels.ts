/**
 * Schéma de `lightLevels.json` — paliers de lumière (jour/couvert/crépuscule/nuit/ténèbres) consommés
 * comme `LightLevelDef[]` (`src/data/index.ts`) : `{ id, type, label, scalar, baseSightTiles }`.
 */
import { z } from 'zod';
import { document } from '../grammaire/document';

export const file = 'lightLevels.json';
export const famille = 'entite';

const doc = document(
  'lightLevels',
  famille,
  {
    scalar: z.number(),
    baseSightTiles: z.number(),
  },
  {
    scalar: {
      label: 'Facteur de luminosité',
      hint: 'Scalaire d’éclairement 0..1 du palier : assombrissement du rendu et plancher du champ de lumière de la SCÈNE',
    },
    baseSightTiles: { label: 'Portée de vue de base', hint: 'Distance de vision en cases avant modificateurs' },
  },
  {
    codex: {
      exempt: {
        kind: 'vocabulaire-app-interne',
        raison:
          'niveaux de lumière (rendu iso/vision), vocabulaire moteur — la RÈGLE de vision est ailleurs, sourcée et exposée via `regles`/`etats`.',
      },
    },
    edit: { none: 'aucune catégorie Codex ne l’expose, donc aucun formulaire d’atelier ne l’édite', dataset: 'lightLevels' },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
