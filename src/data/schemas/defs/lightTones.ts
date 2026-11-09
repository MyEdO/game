import { nommerChamps } from '../grammaire/meta';
/** LDB 74. */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { couleurHexSchema, enumNomme } from '../grammaire/valeurs';
import { ref } from '../grammaire/ref';

export const file = 'lightTones.json';
export const famille = 'entite';

/** Ce qu'une source de lumière montre à son foyer (#3783), que l'hôte sait dessiner. */
export const visuelDeLumiereSchema = enumNomme({
  feu: 'Feu et fumée',
  flammeche: 'Flammèche',
  lueur: 'Lueur',
});
export type VisuelDeLumiere = z.infer<typeof visuelDeLumiereSchema>;

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
    visuel: visuelDeLumiereSchema.optional(),
    son: ref('son').optional(),
  },
  {
    color: { label: 'Couleur', hint: 'Teinte hexadécimale `#rrggbb` de la source ponctuelle' },
    intensity: { label: 'Intensité', hint: 'Part de l’intensité de calage anti-saturation, jamais une valeur absolue' },
    flicker: { label: 'Vacillement', hint: 'Amplitude et fréquence du battement de la flamme' },
    visuel: { label: 'Visuel', hint: 'Ce que la source montre à son foyer' },
    son: { label: 'Son', hint: 'Le son que la source joue en boucle' },
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
