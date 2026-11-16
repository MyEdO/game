/** Apparence de base d'une race : son gabarit, ses couleurs et ses matières. */
import { document } from '../grammaire/document';
import { ref } from '../grammaire/ref';
import { couleursSchema, matieresSchema } from '../grammaire/valeurs';
import { surchargeDeGabaritSchema } from './gabarits';

export const file = 'raceAppearance.json';
export const famille = 'entite';

const doc = document(
  'raceAppearance',
  famille,
  {
    gabarit: ref('gabarit'),
    gabaritOverride: surchargeDeGabaritSchema.optional(),
    couleurs: couleursSchema.optional(),
    matieres: matieresSchema.optional(),
  },
  {
    gabarit: { label: 'Gabarit', hint: 'Identifiant du gabarit de silhouette par défaut de la race' },
    gabaritOverride: {
      label: 'Surcharge de gabarit',
      hint: 'Mesures du gabarit surchargées pour cette race (longueur et épaisseur globales, jambes, bras, tête)',
    },
    couleurs: { label: 'Couleurs', hint: 'Couleur du nuancier par emplacement de palette, que porte tout membre de la race sauf couleur propre ; absente, la matière du modèle' },
    matieres: { label: 'Matières', hint: 'Matière du décor par emplacement de palette, que porte toute surface de cet emplacement chez un membre de la race ; absente, la matière du modèle' },
  },
  {
    codex: { keys: ['raceAppearance'] },
    edit: { dataset: 'raceAppearance' },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
