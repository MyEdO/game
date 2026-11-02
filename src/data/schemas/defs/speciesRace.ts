/** Race d'apparence par défaut. */
import { z } from 'zod';
import { document } from '../grammaire/document';

export const file = 'speciesRace.json';
export const famille = 'config';

const doc = document(
  'speciesRace',
  famille,
  {
    default: z.string(),
  },
  {
    default: { label: 'Race par défaut', hint: 'Race d’apparence retenue par défaut' },
  },
  {
    codex: {
      exempt: {
        kind: 'vocabulaire-app-interne',
        raison: "race d'apparence par défaut de l'authoring, pas une fiche de contenu.",
      },
    },
    edit: { none: 'aucune catégorie Codex ne l’expose, donc aucun formulaire d’atelier ne l’édite' },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
