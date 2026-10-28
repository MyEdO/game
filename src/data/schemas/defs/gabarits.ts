/**
 * Schéma de `gabarits.json` — LE vocabulaire des carrures du rig (#2972) : facteurs appliqués au
 * squelette humain de référence (`baseSkeleton`, `src/gameIso/rig/skeletons.ts`). Une race
 * (`raceAppearance.json › gabarit`) ou une créature en nomme un ; la résolution vit au noyau
 * (`src/noyau/apparence/gabarit.ts`).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { enumNomme } from '../grammaire/valeurs';
import { tableTotale } from '../../../lib/tableTotale';
import type { IdsParEspace } from '../_ids.generated';

export const file = 'gabarits.json';

/** Id d'un gabarit : l'union LITTÉRALE de l'espace `gabarits.json` (`npm run gen`). */
export type GabaritId = IdsParEspace['gabarits.json'];
export const famille = 'entite';

/** Facteur de carrure : un multiplicateur de longueur ou d'épaisseur, strictement positif. */
const facteur = z.number().positive();

/** Les facteurs d'une carrure. */
const FACTEURS = {
  sl: facteur,
  st: facteur,
  legs: facteur,
  arms: facteur.optional(),
  head: facteur.optional(),
};

const NOMS = {
  sl: { label: 'Longueur globale', hint: 'Facteur de longueur de tous les os du squelette de référence' },
  st: { label: 'Épaisseur globale', hint: 'Facteur d’épaisseur de tous les os du squelette de référence' },
  legs: { label: 'Jambes', hint: 'Facteur de longueur des cuisses et tibias' },
  arms: { label: 'Bras', hint: 'Facteur de longueur des bras et avant-bras ; absent = 1' },
  head: { label: 'Tête', hint: 'Facteur de taille de la tête ; absent = 1' },
};

const doc = document(
  'gabarits',
  famille,
  FACTEURS,
  NOMS,
  {
    codex: {
      exempt: {
        kind: 'vocabulaire-app-interne',
        raison:
          'carrures du rig (art, pas règle) — aucune catégorie du Codex ne l’expose, aucun écran ne l’écrit : il s’édite au fichier `src/data/gabarits.json`',
      },
    },
    edit: { none: 'vocabulaire d’art, édité au fichier `src/data/gabarits.json` — aucun écran ne l’écrit', dataset: 'gabarits' },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;

/** Le facteur qu'une surcharge nomme : une clé de `FACTEURS`, libellée par `NOMS`. */
const facteurDeCarrureSchema = enumNomme(
  tableTotale(Object.keys(FACTEURS) as (keyof typeof FACTEURS)[], (k) => NOMS[k].label),
  tableTotale(Object.keys(FACTEURS) as (keyof typeof FACTEURS)[], (k) => NOMS[k].hint),
);

/** Surcharge PARTIELLE des facteurs d'une carrure, clés fermées (`raceAppearance.json › gabaritOverride`). */
export const surchargeDeGabaritSchema = z.partialRecord(facteurDeCarrureSchema, facteur);

/** VUE TS d'une entrée — le nœud rendu par la fabrique est SCELLÉ (`z.infer` y vaut `unknown`). */
export interface GabaritDef {
  id: GabaritId;
  type: 'gabarits';
  label: string;
  sl: number;
  st: number;
  legs: number;
  arms?: number;
  head?: number;
}

/** Surcharge partielle des facteurs d'une carrure. */
export type SurchargeDeGabarit = Partial<Omit<GabaritDef, 'id' | 'type' | 'label'>>;
