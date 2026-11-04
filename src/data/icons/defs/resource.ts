import type { IconFamily } from '../types';

/* Famille « ressources de personnage » (fiches, CreatorSummary : Destin/Chance/Résilience/
   Détermination/Blessures/Mouvement/Bourse — remplace les anciens emoji cœur/pied/tourbillon/
   trèfle/poing/bourse).
   Charte de dessin : voir defs/action.ts. */

const K = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
const KF = 'fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"';
const F = 'fill="currentColor" stroke="none"';

export const icons: IconFamily = [
  {
    id: 'resource/fate',
    label: 'Destin',
    // Comète à deux queues (le présage de Sigmar).
    svg:
      `<path ${F} d="M8.3 13.6 L9.4 15.9 L11.9 16.2 L10.1 17.9 L10.5 20.4 L8.3 19.2 L6.1 20.4 L6.5 17.9 L4.7 16.2 L7.2 15.9 Z"/>` +
      `<path ${K} d="M10.9 14.9 C13.9 11.9 17 9 20.4 6.4"/>` +
      `<path ${K} d="M12.5 16.9 C15.5 14.7 18.2 12.2 20.6 9.5"/>`,
  },
  {
    id: 'resource/resilience',
    label: 'Résilience',
    // La tour qui tient bon sous les bourrasques.
    svg:
      `<path ${F} d="M9.1 20 C9.3 16 9.3 12.1 9.1 8.1 H10.4 V9.7 H11.4 V8.1 H12.6 V9.7 H13.6 V8.1 H14.9 C14.7 12.1 14.7 16 14.9 20 Z"/>` +
      `<path ${K} d="M5.5 20.4 C7.6 19.6 9.8 19.2 12 19.2 C14.2 19.2 16.4 19.6 18.5 20.4"/>` +
      `<path ${KF} d="M3.9 10.6 C5.2 11 6.3 11.7 7.2 12.7 M3.7 14.5 C4.8 14.8 5.8 15.4 6.6 16.2 M20.1 10.6 C18.8 11 17.7 11.7 16.8 12.7 M20.3 14.5 C19.2 14.8 18.2 15.4 17.4 16.2"/>`,
  },
  {
    id: 'resource/fortune',
    label: 'Chance',
    // Trèfle à trois feuilles, tige au vent.
    svg:
      `<circle ${F} cx="12" cy="7.1" r="3"/>` +
      `<circle ${F} cx="8" cy="11.4" r="3"/>` +
      `<circle ${F} cx="16" cy="11.4" r="3"/>` +
      `<path ${K} d="M12 11.9 C12 15 12.8 17.5 14.4 19.8"/>`,
  },
  {
    id: 'resource/resolve',
    label: 'Détermination',
    // Poing serré de face, phalanges détachées.
    svg:
      `<path ${F} d="M7 8.1 C7 7.3 7.5 6.8 8.2 6.8 C8.9 6.8 9.4 7.3 9.4 8.1 V10.7 H7 Z"/>` +
      `<path ${F} d="M9.9 7.5 C9.9 6.7 10.4 6.2 11.1 6.2 C11.8 6.2 12.3 6.7 12.3 7.5 V10.7 H9.9 Z"/>` +
      `<path ${F} d="M12.8 7.7 C12.8 6.9 13.3 6.4 14 6.4 C14.7 6.4 15.2 6.9 15.2 7.7 V10.7 H12.8 Z"/>` +
      `<path ${F} d="M15.7 8.3 C15.7 7.5 16.2 7.1 16.7 7.1 C17.3 7.1 17.7 7.5 17.7 8.3 V10.7 H15.7 Z"/>` +
      `<path ${F} d="M6.7 11.4 H17.5 C17.8 13.9 17.4 16.2 16.2 18.2 C13.7 19.5 10.7 19.5 8.2 18.2 C7 16.2 6.5 13.9 6.7 11.4 Z"/>` +
      `<path ${F} d="M6.3 12 C4.9 12.6 4.2 13.7 4.3 15.1 C4.4 16.2 5.1 17.1 6.2 17.5 C5.9 15.7 5.9 13.8 6.3 12 Z"/>`,
  },
  {
    id: 'resource/wounds',
    label: 'Blessures',
    // Cœur fendu d'une entaille en éclair.
    svg:
      `<path ${F} d="M11.3 7.3 C10.5 6.2 9.4 5.6 8.1 5.6 C5.8 5.6 4.1 7.4 4.1 9.9 C4.1 13.2 6.8 16.5 11.4 19.8 L10.6 15.9 L12.3 13.5 L10.7 11 L12.1 8.5 Z"/>` +
      `<path ${F} d="M12.8 7.1 C13.6 6.2 14.7 5.6 15.9 5.6 C18.2 5.6 19.9 7.4 19.9 9.9 C19.9 13.2 17.3 16.4 12.9 19.6 L12.2 15.7 L13.9 13.3 L12.3 10.8 L13.7 8.3 Z"/>`,
  },
  {
    id: 'resource/movement',
    label: 'Mouvement',
    // Botte de cavalier, molette d'éperon au talon.
    svg:
      `<path ${F} d="M8.3 4.3 C9.9 3.9 11.5 3.9 13.1 4.3 C12.8 6.9 12.8 9.4 13.2 11.8 C15.8 12.2 17.9 13.5 19.3 15.8 C19.8 16.6 20 17.5 20 18.5 C15.9 19.1 11.9 19.1 7.8 18.5 C7.2 13.8 7.4 9.1 8.3 4.3 Z"/>` +
      `<circle ${KF} cx="5.2" cy="16.9" r="1.4"/>` +
      `<path ${KF} d="M6.6 16.9 H7.8 M5.2 15.5 L4.6 14.4 M5.2 18.3 L4.6 19.4 M3.8 16.9 H2.9"/>`,
  },
  {
    id: 'resource/gold-purse',
    label: 'Bourse',
    // Bourse de cuir nouée, la pièce d'or qui y tombe.
    svg:
      `<path ${F} d="M12 9.2 C15.7 9.2 18.4 11.8 18.4 15.2 C18.4 18.2 15.9 20.2 12 20.2 C8.1 20.2 5.6 18.2 5.6 15.2 C5.6 11.8 8.3 9.2 12 9.2 Z"/>` +
      `<path ${K} d="M9.6 8.6 C9.2 7.4 9.2 6.3 9.6 5.1 M14.4 8.6 C14.8 7.4 14.8 6.3 14.4 5.1"/>` +
      `<path ${K} d="M9.2 8.9 C10.7 8.1 13.3 8.1 14.8 8.9"/>` +
      `<circle fill="var(--gold)" stroke="none" cx="12" cy="3.6" r="1.5"/>`,
  },
  {
    id: 'resource/lifeline',
    label: 'Survivre',
    // Bouée de sauvetage : anneau à quatre bandes.
    svg:
      `<circle ${K} cx="12" cy="12" r="8.1"/>` +
      `<circle ${K} cx="12" cy="12" r="4"/>` +
      `<path ${F} d="M12 3.9 C13.4 3.9 14.7 4.2 15.9 4.8 L13.6 8.7 C13.1 8.5 12.6 8.4 12 8.4 Z"/>` +
      `<path ${F} d="M12 20.1 C10.6 20.1 9.3 19.8 8.1 19.2 L10.4 15.3 C10.9 15.5 11.4 15.6 12 15.6 Z"/>` +
      `<path ${F} d="M4.4 8.5 C5.1 7.3 6.1 6.3 7.3 5.6 L9.6 9.5 C9.1 9.9 8.6 10.4 8.3 10.9 Z"/>` +
      `<path ${F} d="M19.6 15.5 C18.9 16.7 17.9 17.7 16.7 18.4 L14.4 14.5 C14.9 14.1 15.4 13.6 15.7 13.1 Z"/>`,
  },
  {
    id: 'resource/xp',
    label: 'Points d’Expérience',
    // Double chevron montant, étoile en tête (progression / gain de PX).
    svg:
      `<path ${K} d="M6 14.4 L12 8.4 L18 14.4"/>` +
      `<path ${K} d="M6 19.2 L12 13.2 L18 19.2"/>` +
      `<circle ${F} cx="12" cy="5.2" r="1.6"/>`,
  },
];
