/**
 * Schéma de `sizes.json` — modificateur de tir selon la Taille de la CIBLE (LDB 14 l.118-131),
 * consommé par `src/engine/size.ts` (`SIZE_RANGED_MOD`, clé = `SizeCategory`) ; Enc qu'un être
 * occupe à bord selon sa Taille (MDG 12 l.25-33), consommé par `SIZE_SHIPBOARD_ENC` ; côté N de
 * l'empreinte de grille par défaut d'une créature de cette Taille (LDB 15 l.12 ne donne que
 * « 2, 4 ou même plus » — barre chiffrée MAISON), consommé par `sizeFootprintSide`. Les 7 clés de
 * chaque table sont les 7 catégories RAW (Minuscule → Monstrueuse, `SizeCategory` dans `size.ts`).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { marquerCollection, marqueDeRecord } from '../grammaire/collection-cle';

export const file = 'sizes.json';
export const famille = 'config';

const sizeTable = z.strictObject({
  minuscule: z.number(),
  tresPetite: z.number(),
  petite: z.number(),
  moyenne: z.number(),
  grande: z.number(),
  enorme: z.number(),
  monstrueuse: z.number(),
});

const doc = document(
  'sizes',
  famille,
  {
    // Univers de la source `sizes` (`grammaire/sourcesDeSpecs.ts`).
    rangedMod: marquerCollection(sizeTable, marqueDeRecord({ espace: {} })),
    shipboardEnc: sizeTable,
    footprintSide: sizeTable,
  },
  {
    rangedMod: { label: 'Modificateur de tir (cible)', hint: 'Modificateur au Test de Tir selon la Taille de la cible' },
    shipboardEnc: { label: 'Encombrement à bord', hint: "Encombrement occupé à bord selon la Taille de l'être" },
    footprintSide: {
      label: "Côté d'empreinte",
      hint: 'Côté par défaut de l’empreinte de grille de cette Taille (barre chiffrée maison : le LDB ne donne que « 2, 4 ou même plus »)',
    },
  },
  {
    codex: { keys: ['sizes'] },
    edit: { object: 'single' },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
