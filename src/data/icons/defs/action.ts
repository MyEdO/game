import type { IconFamily } from '../types';

/* ═════════ CHARTE D'ICONOGRAPHIE — référence pour TOUTES les familles ═════════
   Grille 24×24, motif centré, ~2px de marge de respiration.
   Trait principal stroke-width 1.8, terminaisons et jointures RONDES ; détails fins 1.2.
   « Dessiné main » : courbes C plutôt que droites parfaites, micro-asymétries voulues —
   cohérent avec Ornaments.tsx et la direction du rendu iso.
   Silhouette PLEINE (fill currentColor) pour le motif porteur dès que l'icône doit rester
   lisible à 14px ; UNE seule métaphore par icône, pas de micro-détails, pas de texte.
   Couleur : currentColor UNIQUEMENT (accent var(--gold) toléré avec parcimonie), jamais de hex.
   ════════════════════════════════════════════════════════════════════════════ */

/** Trait principal. */
const K = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
/** Trait fin (détail secondaire). */
const KF = 'fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"';
/** Silhouette pleine. */
const F = 'fill="currentColor" stroke="none"';

export const icons: IconFamily = [
  {
    id: 'action/attack',
    label: 'Attaquer',
    svg:
      `<path ${F} d="M8.2 15.9 L18.7 4.3 C19.3 3.7 20.1 3.4 20.7 3.4 C20.7 4 20.4 4.9 19.8 5.5 L9.7 17.4 Z"/>` +
      `<path ${K} d="M6.1 13.7 L10.9 18.5"/>` +
      `<path ${K} d="M8.3 16.2 L4.9 19.7"/>` +
      `<circle ${F} cx="4.3" cy="20.3" r="1.3"/>`,
  },
  {
    id: 'action/shoot',
    label: 'Tirer',
    svg:
      `<path ${K} d="M7 3.6 C12.7 6.3 13 17.5 7.2 20.4"/>` +
      `<path ${KF} d="M7 3.6 C6.7 9.2 6.8 14.9 7.2 20.4"/>` +
      `<path ${K} d="M6.9 12 H18.8 M18.8 12 L15.4 10.3 M18.8 12 L15.5 13.8"/>`,
  },
  {
    id: 'action/aim',
    label: 'Viser',
    svg:
      `<circle ${K} cx="12" cy="12" r="7.4"/>` +
      `<circle ${K} cx="12" cy="12" r="3.4"/>` +
      `<path ${K} d="M12 2.3 V5 M12 19 V21.7 M2.3 12 H5 M19 12 H21.7"/>` +
      `<circle ${F} cx="12" cy="12" r="1.3"/>`,
  },
  {
    id: 'action/cast',
    label: 'Incanter',
    svg:
      `<path ${F} d="M12 3.2 C12.7 7.7 14.3 9.9 18.9 11.9 C14.3 13.9 12.7 16.2 12 20.8 C11.3 16.2 9.6 13.9 5.1 11.9 C9.6 9.9 11.3 7.7 12 3.2 Z"/>` +
      `<circle ${F} cx="18.7" cy="4.8" r="1.1"/>` +
      `<circle ${F} cx="5.5" cy="18.8" r="0.9"/>`,
  },
  {
    id: 'action/defend',
    label: 'Se défendre',
    svg:
      `<path ${K} d="M12 2.9 C14.8 4.4 17.3 5.1 19.9 5.3 C19.8 12.4 17.3 17.7 12 21 C6.7 17.7 4.2 12.4 4.1 5.3 C6.7 5.1 9.2 4.4 12 2.9 Z"/>` +
      `<path ${KF} d="M12 6.4 C12.1 10 12 13.6 12 16.9"/>`,
  },
  {
    id: 'action/dispel',
    label: 'Dissiper',
    svg:
      `<path ${K} d="M12.4 12.6 C11.2 13.3 9.9 12.7 9.7 11.5 C9.4 9.9 10.9 8.6 12.8 8.7 C15.3 8.9 16.9 11 16.6 13.6 C16.4 15.6 15 17.2 13 17.8"/>` +
      `<path ${K} d="M9.3 17.9 C6.8 16.7 5.3 14.3 5.5 11.5 C5.7 8.3 8 5.7 11.2 5 C14 4.4 16.9 5.4 18.7 7.5"/>` +
      `<path ${KF} d="M11.4 19.5 L10.6 21.2 M8 19.6 L6.6 20.8"/>`,
  },
  {
    id: 'action/roll-fire',
    label: 'Roulade',
    svg:
      `<path ${K} d="M19.4 12.3 C19.3 16.4 16 19.6 11.9 19.6 C7.8 19.6 4.5 16.3 4.5 12.2 C4.5 8.1 7.8 4.8 11.9 4.8 L13.6 4.8"/>` +
      `<path ${K} d="M13.6 4.8 L11.7 3.4 M13.6 4.8 L11.7 6.3"/>` +
      `<path ${F} d="M12 7.6 C13.9 9.4 14.8 11 14.8 12.7 C14.8 14.6 13.6 15.9 12 15.9 C10.4 15.9 9.2 14.6 9.2 12.7 C9.2 11.7 9.6 10.8 10.4 9.9 C10.5 11 11.1 11.7 11.9 12.1 C11.5 10.6 11.5 9.1 12 7.6 Z"/>`,
  },
  {
    id: 'action/disengage',
    label: 'Se désengager',
    svg:
      `<path ${F} d="M6.3 2.9 C7.2 4.6 7.6 8.1 7.4 12.1 L5.2 12.1 C5 8.1 5.4 4.6 6.3 2.9 Z"/>` +
      `<path ${K} d="M3.9 12.9 H8.7 M6.3 13.7 V16"/>` +
      `<circle ${F} cx="6.3" cy="17.4" r="1.1"/>` +
      `<path ${K} d="M9.4 18.9 C13 19.2 16.5 17.6 19.9 14 M19.9 14 L19.5 16.9 M19.9 14 L17 13.6"/>`,
  },
  {
    id: 'action/free-attack',
    label: 'Attaque gratuite',
    svg:
      `<path ${F} d="M15.7 15.2 L5.6 4.3 C5 3.7 4.3 3.4 3.7 3.4 C3.7 4 3.9 4.9 4.4 5.6 L14.3 16.6 Z"/>` +
      `<path ${K} d="M17.9 13.4 L13.3 18.2 M15.7 15.6 L19.1 19.1"/>` +
      `<circle ${F} cx="19.7" cy="19.8" r="1.3"/>` +
      `<path ${F} d="M20.4 2.4 L15.8 8.3 L18.5 8.3 L17.1 12.7 L21.8 6.7 L19.2 6.7 Z"/>`,
  },
  {
    id: 'action/stand-up',
    label: 'Se relever',
    svg:
      `<path ${KF} d="M4.2 20.6 C9 20.2 15 20.2 19.8 20.6"/>` +
      `<circle ${F} cx="9.4" cy="5.9" r="2"/>` +
      `<path ${K} d="M9.8 8.9 C10.2 11.4 11 13.3 12.6 14.8 C13.4 16.3 13.6 18.2 13.4 20.1"/>` +
      `<path ${K} d="M10.3 12.7 C8.7 14.5 7.9 17.1 7.9 20.1"/>` +
      `<path ${K} d="M17.9 14.6 V6.4 M17.9 6 L16.1 8.2 M17.9 6 L19.7 8.2"/>`,
  },
  {
    id: 'action/break-free',
    label: 'Se libérer',
    svg:
      `<path ${K} d="M15.4 6.1 C14.4 5.4 13.3 5 12 5 C8.2 5 5.1 8.1 5.1 11.9 C5.1 15.7 8.2 18.8 12 18.8 C15.8 18.8 18.9 15.7 18.9 11.9 C18.9 10.9 18.7 10 18.3 9.1"/>` +
      `<path ${K} d="M17.4 4.9 L19 3.1 M19.6 7.2 L21.9 6.6 M15.9 2.9 L16.2 1.6"/>`,
  },
  {
    id: 'action/mount',
    label: 'Monter en selle',
    svg:
      `<path ${K} d="M6.3 20.2 C4.8 15.6 4.6 11.5 6.5 8.5 C7.9 6.4 9.8 5.3 12 5.3 C14.2 5.3 16.1 6.4 17.5 8.5 C19.4 11.5 19.2 15.6 17.7 20.2"/>` +
      `<path ${K} d="M5.3 20.4 H7.3 M16.7 20.4 H18.7"/>` +
      `<path ${K} d="M12 19.8 V11.3 M12 10.9 L10.2 13 M12 10.9 L13.8 13"/>`,
  },
  {
    id: 'action/dismount',
    label: 'Mettre pied à terre',
    svg:
      `<path ${K} d="M6.3 20.2 C4.8 15.6 4.6 11.5 6.5 8.5 C7.9 6.4 9.8 5.3 12 5.3 C14.2 5.3 16.1 6.4 17.5 8.5 C19.4 11.5 19.2 15.6 17.7 20.2"/>` +
      `<path ${K} d="M5.3 20.4 H7.3 M16.7 20.4 H18.7"/>` +
      `<path ${K} d="M12 10.6 V19.1 M12 19.5 L10.2 17.4 M12 19.5 L13.8 17.4"/>`,
  },
  {
    id: 'action/lead',
    label: 'Commander',
    svg:
      `<path ${K} d="M6.4 21 C6.6 15 6.6 9 6.4 3.4"/>` +
      `<circle ${F} cx="6.4" cy="2.6" r="1"/>` +
      `<path ${F} d="M7.1 3.9 C11.6 4.4 15.9 5.4 19.8 7.2 C15.9 8.6 11.6 9.4 7.1 9.6 Z"/>`,
  },
  {
    id: 'action/serve-engine',
    label: 'Servir l’engin',
    svg:
      `<circle ${F} cx="8" cy="16.6" r="3.7"/>` +
      `<path ${K} d="M11.9 12.6 L20.4 4.1"/>` +
      `<path ${K} d="M18.9 2.7 L21.8 5.6"/>` +
      `<path ${KF} d="M13.6 16.7 H16 M13.2 19 H15"/>`,
  },
  {
    id: 'action/leave-post',
    label: 'Quitter le poste',
    svg:
      `<path ${K} d="M6.8 20.6 C6.6 15.4 6.6 10 6.8 4.6"/>` +
      `<path ${F} d="M7.3 5 C9.5 5.2 11.5 5.7 13.5 6.6 C11.5 7.5 9.5 8 7.3 8.2 Z"/>` +
      `<path ${K} d="M4.6 20.6 H9.2"/>` +
      `<path ${K} d="M10.8 15.5 C13.5 16 16.2 15.2 19.4 12.9 M19.4 12.9 L18.9 15.4 M19.4 12.9 L16.9 12.4"/>`,
  },
  {
    id: 'action/steer-ship',
    label: 'Tenir la barre',
    svg:
      `<circle ${K} cx="12" cy="12" r="5.6"/>` +
      `<path ${K} d="M12 3.4 V7.4 M12 16.6 V20.6 M3.4 12 H7.4 M16.6 12 H20.6"/>` +
      `<path ${K} d="M5.9 5.9 L8.8 8.8 M15.2 15.2 L18.1 18.1 M18.1 5.9 L15.2 8.8 M8.8 15.2 L5.9 18.1"/>` +
      `<circle ${F} cx="12" cy="12" r="1.7"/>`,
  },
  {
    id: 'action/consume',
    label: 'Consommer',
    svg:
      `<path ${K} d="M10.1 3.4 H13.9"/>` +
      `<path ${K} d="M10.9 3.8 V7 C8.3 8.8 6.9 11 6.9 13.7 C6.9 17.4 9 19.8 12 19.8 C15 19.8 17.1 17.4 17.1 13.7 C17.1 11 15.7 8.8 13.1 7 V3.8"/>` +
      `<path ${KF} d="M8.2 13.2 C10 14.2 14 14.2 15.8 13.2"/>` +
      `<circle ${F} cx="10.9" cy="16.3" r="0.8"/>` +
      `<circle ${F} cx="13.5" cy="15.1" r="0.6"/>`,
  },
  {
    id: 'action/water',
    label: 'Asperger d’eau',
    svg:
      `<path ${F} d="M12 3.2 C15.3 8 17.8 12 17.8 15 C17.8 18.7 15.2 21 12 21 C8.8 21 6.2 18.7 6.2 15 C6.2 12 8.7 8 12 3.2 Z"/>` +
      `<path ${KF} d="M9.4 14.6 C9.2 16.6 10.2 17.9 11.9 18.2"/>`,
  },
  {
    id: 'action/pick-up',
    label: 'Ramasser',
    svg:
      `<circle ${F} cx="12" cy="16.1" r="3"/>` +
      `<path ${K} d="M7.3 6.6 C8.8 4.8 15.2 4.8 16.7 6.6"/>` +
      `<path ${K} d="M7.3 6.6 C6.9 9.5 8.1 11.7 10 13"/>` +
      `<path ${K} d="M12 5.5 C11.9 8.3 12 10.4 12 12.3"/>` +
      `<path ${K} d="M16.7 6.6 C17.1 9.5 15.9 11.7 14 13"/>`,
  },
  {
    id: 'action/force',
    label: 'Enfoncer / forcer',
    // Maillet levé, manche en diagonale (enfoncer une porte à plusieurs).
    svg:
      `<path ${F} d="M15.5 3.3 L20.7 8.5 L16.9 12.3 L11.7 7.1 Z"/>` +
      `<path ${K} d="M12.7 10.1 L4.6 18.2"/>` +
      `<path ${KF} d="M6.3 15.4 L8.4 17.5 M8.1 13.6 L10.2 15.7"/>`,
  },
];
