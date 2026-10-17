import { nommerChamps } from '../grammaire/meta';
/** LDB 74. */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { couleurHexSchema } from '../grammaire/valeurs';

export const file = 'lightTones.json';
export const famille = 'entite';

const doc = document(
  'lightTones',
  famille,
  {
    color: couleurHexSchema,
    intensity: z.number().gt(0).lte(1),
    flicker: nommerChamps(z
      .strictObject({
        amplitude: z.number().min(0).max(0.5),
        hz: z.number().gt(0).max(8),
      }), { amplitude: { label: 'amplitude' }, hz: { label: 'fréquence en hertz' } })
      .optional(),
  },
  {
    color: { label: 'Couleur', hint: 'Teinte hexadécimale `#rrggbb` de la source ponctuelle' },
    intensity: { label: 'Intensité', hint: 'Part de l’intensité de calage anti-saturation, jamais une valeur absolue' },
    flicker: { label: 'Vacillement', hint: 'Amplitude et fréquence du battement de la flamme' },
  },
  {
    codex: {
      exempt: {
        kind: 'vocabulaire-app-interne',
        raison:
          "tons de lumière (rendu volumique #1245 : couleur/intensité/vacillement d'une source ponctuelle), vocabulaire d'APPARENCE — aucune conséquence de règle, le rayon RAW vit sur la source elle-même.",
      },
    },
    edit: { none: 'aucune catégorie Codex ne l’expose, donc aucun formulaire d’atelier ne l’édite', dataset: 'lightTones' },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
