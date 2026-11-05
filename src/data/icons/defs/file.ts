import type { IconFamily } from '../types';

/* Famille « fichier » (EditorToolbar/CodexEdit/Inspector — nouveau projet, ouvrir, enregistrer,
   importer/exporter, document, dossier). Charte de dessin : voir defs/action.ts. */

const K = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
const KF = 'fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"';
const F = 'fill="currentColor" stroke="none"';

export const icons: IconFamily = [
  {
    id: 'file/new',
    label: 'Nouveau projet',
    // Feuillet vierge, coin corné.
    svg:
      `<path ${K} d="M6.6 3.6 H14 L17.4 7 V20.4 H6.6 Z"/>` +
      `<path ${K} d="M14 3.6 V7 H17.4"/>` +
      `<path ${KF} d="M9 11.4 H15 M9 14.3 H15 M9 17.2 H12.6"/>`,
  },
  {
    id: 'file/open',
    label: 'Ouvrir',
    // Dossier entrouvert, rabat soulevé.
    svg:
      `<path ${K} d="M3.6 8.3 V18.1 C3.6 18.9 4.3 19.6 5.1 19.6 H18.9 C19.7 19.6 20.4 18.9 20.4 18.1 V9.9 C20.4 9.1 19.7 8.4 18.9 8.4 H11.6 L9.9 6.4 H5.1 C4.3 6.4 3.6 7.1 3.6 7.9 Z"/>` +
      `<path ${KF} d="M3.6 11.3 H21.1 L19.3 17.4 H5.4 Z"/>`,
  },
  {
    id: 'file/save',
    label: 'Enregistrer',
    // Disquette : coin replié, étiquette, fente.
    svg:
      `<path ${K} d="M4.6 3.6 H16.6 L19.4 6.4 V20.4 H4.6 Z"/>` +
      `<path ${F} d="M7.1 3.6 H14.6 V8.4 H7.1 Z"/>` +
      `<path ${KF} d="M8 14.9 H16 M8 17.4 H16"/>`,
  },
  {
    id: 'file/export',
    label: 'Exporter',
    // Flèche sortant d'une corbeille vers le haut.
    svg:
      `<path ${K} d="M4.6 14.3 V19.1 C4.6 19.7 5.1 20.1 5.7 20.1 H18.3 C18.9 20.1 19.4 19.7 19.4 19.1 V14.3"/>` +
      `<path ${K} d="M12 16.4 V4.1 M8 8.1 L12 3.9 L16 8.1"/>`,
  },
  {
    id: 'file/import',
    label: 'Importer',
    // Flèche entrant dans une corbeille depuis le haut.
    svg:
      `<path ${K} d="M4.6 14.3 V19.1 C4.6 19.7 5.1 20.1 5.7 20.1 H18.3 C18.9 20.1 19.4 19.7 19.4 19.1 V14.3"/>` +
      `<path ${K} d="M12 3.9 V16.1 M8 12.1 L12 16.3 L16 12.1"/>`,
  },
  {
    id: 'file/document',
    label: 'Document',
    // Feuillet plein de texte (scène active).
    svg:
      `<path ${K} d="M6.6 3.6 H14 L17.4 7 V20.4 H6.6 Z"/>` +
      `<path ${K} d="M14 3.6 V7 H17.4"/>` +
      `<path ${KF} d="M9 10.6 H15 M9 13.3 H15 M9 16 H15 M9 18.7 H12.6"/>`,
  },
  {
    id: 'file/folder',
    label: 'Dossier',
    // Dossier fermé, onglet supérieur.
    svg: `<path ${F} d="M3.6 6.9 C3.6 6.1 4.3 5.4 5.1 5.4 H9.9 L11.6 7.4 H18.9 C19.7 7.4 20.4 8.1 20.4 8.9 V17.1 C20.4 17.9 19.7 18.6 18.9 18.6 H5.1 C4.3 18.6 3.6 17.9 3.6 17.1 Z"/>`,
  },
];
