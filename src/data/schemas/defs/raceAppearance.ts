/** Apparence de base d'une race : son gabarit. */
import { document } from '../grammaire/document';
import { ref } from '../grammaire/ref';
import { surchargeDeGabaritSchema } from './gabarits';

export const file = 'raceAppearance.json';
export const famille = 'entite';

const doc = document(
  'raceAppearance',
  famille,
  {
    gabarit: ref('gabarit'),
    gabaritOverride: surchargeDeGabaritSchema.optional(),
  },
  {
    gabarit: { label: 'Gabarit', hint: 'Identifiant du gabarit de silhouette par défaut de la race' },
    gabaritOverride: {
      label: 'Surcharge de gabarit',
      hint: 'Mesures du gabarit surchargées pour cette race (longueur et épaisseur globales, jambes, bras, tête)',
    },
  },
  {
    codex: { keys: ['raceAppearance'] },
    edit: { dataset: 'raceAppearance' },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
