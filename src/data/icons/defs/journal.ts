import type { IconFamily } from '../types';

/* Événements du feed de combat (journal + bandeau — sens : src/gameIso/combatNarration.ts).
   Charte : voir defs/action.ts (grille 24×24, trait 1.8 rond, silhouette pleine, une métaphore). */

/** Trait principal. */
const K = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
/** Trait fin (détail secondaire). */
const KF = 'fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"';
/** Silhouette pleine. */
const F = 'fill="currentColor" stroke="none"';

export const icons: IconFamily = [
  {
    id: 'journal/charge',
    label: 'Charge',
    svg:
      `<path ${F} d="M3.6 10.4 C6.8 10.1 10 10 13.1 10.1 L13 7 L20.9 12 L13 17 L13.1 13.9 C10 14 6.8 13.9 3.6 13.6 Z"/>` +
      `<path ${KF} d="M4.2 6.9 C6.1 6.6 8 6.5 9.9 6.5 M4.2 17.1 C6.1 17.4 8 17.5 9.9 17.5"/>`,
  },
  {
    id: 'journal/heal',
    label: 'Soin',
    svg:
      `<path ${F} d="M10.8 3.6 H13.2 V6.9 H16.5 V9.3 H13.2 V12.6 H10.8 V9.3 H7.5 V6.9 H10.8 Z"/>` +
      `<path ${K} d="M4.6 14.4 C4.9 17.3 7 19.4 10.1 20.1 C11.4 20.4 12.6 20.4 13.9 20.1 C17 19.4 19.1 17.3 19.4 14.4"/>`,
  },
  {
    id: 'journal/move',
    label: 'Mouvement',
    svg:
      `<ellipse ${F} cx="8.2" cy="15.8" rx="2.4" ry="3.5"/>` +
      `<circle ${F} cx="6.7" cy="11.2" r="0.75"/>` +
      `<circle ${F} cx="8.3" cy="10.7" r="0.75"/>` +
      `<circle ${F} cx="9.8" cy="11.3" r="0.75"/>` +
      `<ellipse ${F} cx="15.8" cy="8.9" rx="2.4" ry="3.5"/>` +
      `<circle ${F} cx="14.3" cy="4.3" r="0.75"/>` +
      `<circle ${F} cx="15.9" cy="3.8" r="0.75"/>` +
      `<circle ${F} cx="17.4" cy="4.4" r="0.75"/>`,
  },
  {
    id: 'journal/flee',
    label: 'Fuite',
    svg:
      `<circle ${F} cx="16.2" cy="5.2" r="1.9"/>` +
      `<path ${K} d="M15.3 6.9 C13.6 8.8 11.9 10.2 9.9 11.1"/>` +
      `<path ${K} d="M13.9 8.3 C15.4 9.5 17 10 18.7 10"/>` +
      `<path ${K} d="M9.9 11.1 C7.9 12.3 6.3 14.4 5.3 17.2"/>` +
      `<path ${K} d="M12.2 10 C13.2 12.7 12.7 15.6 10.8 18.2"/>` +
      `<path ${KF} d="M3 6.6 H6.2 M2.8 9.4 H5.4"/>`,
  },
  {
    id: 'journal/dodge',
    label: 'Esquive',
    svg:
      `<circle ${F} cx="8.8" cy="5.2" r="1.9"/>` +
      `<path ${K} d="M9.2 7.2 C11.6 8.8 12.4 11.2 11.4 13.8 C10.6 15.9 8.8 17.7 6.4 18.9"/>` +
      `<path ${K} d="M10.6 9.4 C12.6 9.2 14.2 8.4 15.4 7"/>` +
      `<path ${K} d="M15.9 4.6 C19.4 8.3 20.1 13.6 17.8 18.8"/>`,
  },
  {
    id: 'journal/damage',
    label: 'Dégâts',
    svg:
      `<path ${F} d="M11.2 3.4 L13.2 8.6 L17.2 6.4 L15.7 10.4 L21 11.4 L15.5 13.3 L17.8 17.1 L13.8 15.8 L12.3 21.1 L10.8 15.6 L7 17.9 L8.2 14 L2.9 12.5 L8.5 10.9 L6.1 6.9 L10.2 8.6 Z"/>`,
  },
  {
    id: 'journal/critical',
    label: 'Critique',
    svg:
      `<path ${F} d="M12 4.6 L14 9.85 L19.6 10.1 L15.2 13.7 L16.7 19.1 L12 16 L7.3 19.1 L8.8 13.7 L4.4 10.1 L10 9.85 Z"/>` +
      `<path ${K} d="M12 3.4 V2.1 M20.6 7.6 L21.8 6.7 M3.4 7.6 L2.2 6.7"/>`,
  },
  {
    id: 'journal/death',
    label: 'Mort',
    svg:
      `<path fill="currentColor" fill-rule="evenodd" stroke="none" d="M12 3.4 C7.4 3.4 4.4 6.7 4.4 10.9 C4.4 13.5 5.6 15.6 7.7 16.9 L7.7 18.1 L16.3 18.1 L16.3 16.9 C18.4 15.6 19.6 13.5 19.6 10.9 C19.6 6.7 16.6 3.4 12 3.4 Z M8.8 9.8 C9.9 9.8 10.7 10.6 10.7 11.7 C10.7 12.8 9.9 13.6 8.8 13.6 C7.7 13.6 6.9 12.8 6.9 11.7 C6.9 10.6 7.7 9.8 8.8 9.8 Z M15.2 9.8 C16.3 9.8 17.1 10.6 17.1 11.7 C17.1 12.8 16.3 13.6 15.2 13.6 C14.1 13.6 13.3 12.8 13.3 11.7 C13.3 10.6 14.1 9.8 15.2 9.8 Z M12 13.4 L13.1 15.5 L10.9 15.5 Z"/>` +
      `<path ${KF} d="M10.2 18.4 V20.6 M12 18.6 V20.8 M13.8 18.4 V20.6"/>`,
  },
  {
    id: 'journal/surrender',
    label: 'Reddition',
    svg:
      // Pavillon amené : hampe droite, drapeau (silhouette pleine) AFFAISSÉ vers le bas, plis pendants.
      `<path ${K} d="M6.4 3.4 V20.6"/>` +
      `<path ${F} d="M6.4 4.6 C10.2 4 13.7 4.6 17 6.2 C15.8 8.3 15.6 10.6 16.4 13.1 C13.2 11.6 9.8 11 6.4 11.4 Z"/>` +
      `<path ${KF} d="M9.4 12 C9.6 14.4 9.4 16.7 8.8 18.9"/>`,
  },
  {
    id: 'journal/round',
    label: 'Fin de Round',
    svg:
      `<path ${F} d="M12 3.4 C12.6 3.4 13 3.8 13 4.4 L13 5.1 C16 5.7 18 8.2 18 11.6 C18 14 18.5 15.7 19.6 17 L4.4 17 C5.5 15.7 6 14 6 11.6 C6 8.2 8 5.7 11 5.1 L11 4.4 C11 3.8 11.4 3.4 12 3.4 Z"/>` +
      `<circle ${F} cx="12" cy="19.4" r="1.4"/>`,
  },
  {
    id: 'journal/info',
    label: 'Information',
    svg:
      `<circle ${K} cx="12" cy="12" r="8.7"/>` +
      `<circle ${F} cx="12" cy="7.4" r="1.5"/>` +
      `<path ${K} d="M12 10.7 V17"/>`,
  },
  {
    id: 'journal/reload',
    label: 'Rechargement',
    svg:
      `<path ${K} d="M5.6 9.4 C6.8 6.3 9.9 4.4 13.3 4.9 C15.5 5.2 17.3 6.4 18.5 8.2 M18.5 8.2 L18.7 5.6 M18.5 8.2 L15.9 7.8"/>` +
      `<path ${K} d="M18.4 14.6 C17.2 17.7 14.1 19.6 10.7 19.1 C8.5 18.8 6.7 17.6 5.5 15.8 M5.5 15.8 L5.3 18.4 M5.5 15.8 L8.1 16.2"/>` +
      `<path ${K} d="M9.6 14.4 L13.6 10.4"/>` +
      `<path ${F} d="M13 8.8 L15.2 8.8 L15.2 11 Z"/>` +
      `<path ${KF} d="M10.3 12.4 L9 13.7"/>`,
  },
  {
    id: 'journal/detail',
    label: 'Détail',
    svg: `<path ${F} d="M12 9.6 L14.4 12 L12 14.4 L9.6 12 Z"/>`,
  },
  {
    id: 'journal/dialogue',
    label: 'Dialogue',
    // Bulle de parole rectangulaire, pointe vers l'interlocuteur.
    svg:
      `<path ${F} d="M4 5.6 H20 C20.9 5.6 21.6 6.3 21.6 7.2 V14.4 C21.6 15.3 20.9 16 20 16 H10.4 L6.4 19.6 V16 H4 C3.1 16 2.4 15.3 2.4 14.4 V7.2 C2.4 6.3 3.1 5.6 4 5.6 Z"/>`,
  },
  {
    id: 'journal/fall',
    label: 'Chute',
    // Silhouette qui bascule, lignes de mouvement et impact au sol.
    svg:
      `<circle ${F} cx="15.4" cy="5.4" r="2"/>` +
      `<path ${K} d="M14 7.4 C11.6 9.3 9 11.6 6.4 14.4"/>` +
      `<path ${KF} d="M13.4 9.4 L10.4 8.6 M12 11.7 L9.2 13.6"/>` +
      `<path ${KF} d="M3.2 17 H8 M2.8 19.4 H6.4"/>`,
  },
  {
    id: 'journal/heartbreak',
    label: 'Ambition brisée',
    // Cœur fendu par une cassure en éclair.
    svg:
      `<path ${F} d="M12 19.4 C6.6 15.6 3.6 12 3.6 8.7 C3.6 6.1 5.6 4.2 8 4.2 C9.6 4.2 11 5 12 6.4 L10.6 10 L13 12.8 L11 16.4 Z"/>` +
      `<path ${F} d="M12 6.4 C13 5 14.4 4.2 16 4.2 C18.4 4.2 20.4 6.1 20.4 8.7 C20.4 12 17.4 15.6 12 19.4 L13 16.4 L11 12.8 L13.4 10 Z"/>`,
  },
  {
    id: 'journal/backstab',
    label: 'Coup dans le dos',
    // Dague inclinée, garde en tête, pointe vers la cible.
    svg:
      `<path ${F} d="M6 18.4 L15.6 8.8 L18 11.2 L8.4 20.8 Z"/>` +
      `<path ${K} d="M15.6 8.8 L19.6 4.8"/>` +
      `<path ${K} d="M17.8 3.4 L21 6.6"/>` +
      `<circle ${F} cx="5.2" cy="19.6" r="1.1"/>`,
  },
];
