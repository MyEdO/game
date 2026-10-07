/** LDB 7. */
import { z } from 'zod';
import { charKeySchema } from '../grammaire/valeurs';
import { trappingRefSchema } from '../grammaire/reference';
import { avancement } from '../grammaire/avancement';
import { document } from '../grammaire/document';

export const file = 'careerLevels.json';
export const famille = 'entite';

const doc = document(
  'careerLevels',
  famille,
  {
    /** `id` de la Carrière (`CareerData.id`). */
    career: z.string(),
    level: z.number(),
    skills: z.array(avancement('skill')),
    talents: z.array(avancement('talent')),
    trappings: z.array(trappingRefSchema),
    characteristics: z.array(charKeySchema),
    /** Échelon de statut (« Bronze/Argent/Or N ») — VERBATIM du livre : chaîne libre, 432/432 entrées
     *  conformes à la graphie Bronze/Argent/Or + échelon. */
    status: z.string(),
  },
  {
    career: { label: 'Carrière', hint: 'Carrière à laquelle appartient ce Niveau' },
    level: { label: 'Niveau', hint: 'Rang du Niveau au sein de la Carrière' },
    skills: {
      label: 'Compétences du Niveau',
      hint: 'Compétences ouvertes à l’Augmentation par ce Niveau (cumul des Niveaux ≤ courant ; l’italique du N1 sert à Gagner de l’argent)',
    },
    talents: {
      label: 'Talents du Niveau',
      hint: 'Talents disponibles à l’achat au Niveau COURANT seul (100 PX + 100 par prise) — pas ceux des Niveaux précédents',
    },
    trappings: {
      label: 'Possessions du Niveau',
      hint: 'Possessions listées à ce Niveau (celles du Niveau 1 dotent le personnage à la création)',
    },
    characteristics: {
      label: 'Caractéristiques du Niveau',
      hint: 'Caractéristiques de Carrière ouvertes par ce Niveau (Augmentations au coût standard, ×2 hors carrière) ; les Niveaux ≤ courant se cumulent',
    },
    status: { label: 'Statut social', hint: 'Échelon Bronze/Argent/Or de ce Niveau' },
  },
  {
    codex: { keys: ['careerLevels'] },
    edit: { dataset: 'careerLevels' },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
