/**
 * Schéma de `renduMonte.json` — réglages MAISON du rendu du couple monté (non-règles).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';

export const file = 'renduMonte.json';
export const famille = 'config';

const doc = document(
  'renduMonte',
  famille,
  {
    /** Id d'un set d'équipement (`creatures.json › appearance.harnais`), apposé à une monture
     *  PORTÉE dont le record ne déclare aucun `appearance.harnais` (LDB 08 l.557 ; ADE I 07 l.48). Un
     *  `harnais` déclaré par le record ou par un override d'instance PRIME. */
    harnaisParDefaut: z.string(),
  },
  {
    harnaisParDefaut: {
      label: 'Harnais par défaut',
      hint: 'Appliqué seulement si le record ne déclare aucun appearance.harnais — un harnais du record ou d’une surcharge prime',
    },
  },
  {
    codex: {
      exempt: {
        kind: 'vocabulaire-app-interne',
        raison:
          "réglage de rendu (id du set d'équipement servi par défaut à une monture portée, #1128), pas une fiche de contenu — le set lui-même s'expose par la créature qui le porte.",
      },
    },
    edit: { none: 'aucune catégorie Codex ne l’expose, donc aucun formulaire d’atelier ne l’édite' },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
