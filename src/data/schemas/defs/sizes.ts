import { nommerChamps } from '../grammaire/meta';
/** LDB 14 l.118-131 ; MDG 12 l.25-33 ; LDB 15 l.12 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { marquerCollection, marqueDeRecord } from '../grammaire/collection-cle';

export const file = 'sizes.json';
export const famille = 'config';

const sizeTable = nommerChamps(z.strictObject({
  minuscule: z.number(),
  tresPetite: z.number(),
  petite: z.number(),
  moyenne: z.number(),
  grande: z.number(),
  enorme: z.number(),
  monstrueuse: z.number(),
}), {
  minuscule: { label: 'Minuscule' },
  tresPetite: { label: 'Très petite' },
  petite: { label: 'Petite' },
  moyenne: { label: 'Moyenne' },
  grande: { label: 'Grande' },
  enorme: { label: 'Énorme' },
  monstrueuse: { label: 'Monstrueuse' },
});

const doc = document(
  'sizes',
  famille,
  {
    // Univers de la source `sizes` (`grammaire/sourcesDeSpecs.ts`).
    rangedMod: marquerCollection(sizeTable, marqueDeRecord({ espace: {} })),
    shipboardEnc: marquerCollection(sizeTable, marqueDeRecord()),
    footprintSide: marquerCollection(sizeTable, marqueDeRecord()),
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
