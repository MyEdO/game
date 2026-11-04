import type { IconFamily } from '../types';

/* Famille « interface » (tour par tour, alertes). Charte de dessin : voir defs/action.ts. */

const K = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
const KF = 'fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"';
const F = 'fill="currentColor" stroke="none"';
/** Silhouette pleine à trou (evenodd) — le trou reste transparent, jamais de couleur en dur. */
const FE = 'fill="currentColor" fill-rule="evenodd" stroke="none"';

export const icons: IconFamily = [
  {
    id: 'ui/wait',
    label: 'Attendre',
    svg:
      `<path ${K} d="M7.1 3.5 H16.9 M7.1 20.5 H16.9"/>` +
      `<path ${K} d="M8.1 4 C8.1 8.6 10.7 10.4 11.5 12 C10.7 13.6 8.1 15.4 8.1 20"/>` +
      `<path ${K} d="M15.9 4 C15.9 8.6 13.3 10.4 12.5 12 C13.3 13.6 15.9 15.4 15.9 20"/>` +
      `<path ${F} d="M9.8 19 C11.1 17.4 12.9 17.4 14.2 19 Z"/>` +
      `<circle ${F} cx="12" cy="14.9" r="0.75"/>`,
  },
  {
    id: 'ui/turn-end',
    label: 'Fin du tour',
    svg:
      `<path ${K} d="M5.4 6.9 H14.4 C17.4 6.9 19.4 8.9 19.4 11.9 C19.4 14.9 17.4 16.7 14.4 16.7 H6.6"/>` +
      `<path ${K} d="M6.4 16.7 L9.4 14 M6.4 16.7 L9.4 19.4"/>`,
  },
  {
    id: 'ui/round-start',
    label: 'Nouveau round',
    svg:
      `<path ${K} d="M13.9 4.7 C17.1 5.5 19.4 8.5 19.4 12 C19.4 16.1 16.1 19.4 12 19.4 C7.9 19.4 4.6 16.1 4.6 12 C4.6 9.1 6.2 6.6 8.6 5.4"/>` +
      `<path ${K} d="M13.9 4.7 L11.9 3.4 M13.9 4.7 L12.2 6.6"/>` +
      `<path ${F} d="M10.3 9.1 L15.5 12 L10.3 14.9 Z"/>`,
  },
  {
    id: 'ui/warning',
    label: 'Attention',
    svg:
      `<path ${K} d="M12 3.6 C12.4 3.6 12.7 3.8 12.9 4.2 L20.9 18.3 C21.3 19 20.8 19.9 20 19.9 H4 C3.2 19.9 2.7 19 3.1 18.3 L11.1 4.2 C11.3 3.8 11.6 3.6 12 3.6 Z"/>` +
      `<path ${K} d="M12 9.2 C12.1 10.8 12.1 12.3 12 13.8"/>` +
      `<circle ${F} cx="12" cy="16.6" r="1.15"/>`,
  },
  {
    id: 'ui/done',
    label: 'Fait',
    svg:
      `<path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M4.9 12.7 C6.7 14.1 8.3 15.8 9.8 17.9 C12.5 13.4 15.7 9.5 19.3 6.1"/>` +
      `<path ${KF} opacity="0.5" d="M6.9 11.6 C7.9 12.4 8.8 13.3 9.7 14.4"/>`,
  },
  {
    id: 'ui/undo',
    label: 'Annuler / revenir',
    svg:
      `<path ${K} d="M17.6 5.3 C18.8 7.9 18.6 10.9 17 13.1 C15.4 15.3 12.7 16.4 9 16.4"/>` +
      `<path ${K} d="M9 16.4 L12.2 13.8 M9 16.4 L12.4 19.2"/>` +
      `<path ${KF} opacity="0.5" d="M16.4 6.4 C17.2 8.4 17.1 10.5 16 12.2"/>`,
  },
  {
    id: 'ui/preempt',
    label: 'Interruption',
    svg: `<path ${F} d="M13.8 2.4 L5.8 13.4 L10.5 13.4 L8.9 21.6 L18.2 10.1 L13.4 10.1 Z"/>`,
  },
  {
    id: 'ui/settings',
    label: 'Réglages',
    // Engrenage à 6 dents, moyeu évidé.
    svg:
      `<path ${FE} d="M12 2.6 L13.4 5 L15.9 4 L16.4 6.7 L19.1 6.7 L18.7 9.4 L21.1 10.7 L19.6 12.9 L21.1 15.1 L18.7 16.4 L19.1 19.1 L16.4 19.1 L15.9 21.8 L13.4 20.8 L12 23.2 L10.6 20.8 L8.1 21.8 L7.6 19.1 L4.9 19.1 L5.3 16.4 L2.9 15.1 L4.4 12.9 L2.9 10.7 L5.3 9.4 L4.9 6.7 L7.6 6.7 L8.1 4 L10.6 5 Z M12 9.3 C10.2 9.3 8.7 10.7 8.7 12.6 C8.7 14.4 10.2 15.9 12 15.9 C13.8 15.9 15.3 14.4 15.3 12.6 C15.3 10.7 13.8 9.3 12 9.3 Z"/>`,
  },
  {
    id: 'ui/search',
    label: 'Rechercher',
    // Loupe simple — filtre/recherche générique.
    svg:
      `<circle ${K} cx="10.4" cy="10.4" r="6"/>` +
      `<path ${K} d="M14.8 14.8 L19.9 19.9"/>`,
  },
  {
    id: 'ui/lock',
    label: 'Verrouillé',
    // Cadenas fermé, anse, corps et trou de serrure évidé (evenodd).
    svg:
      `<path ${K} d="M7.4 10.4 V7.6 C7.4 5.2 9.4 3.4 12 3.4 C14.6 3.4 16.6 5.2 16.6 7.6 V10.4"/>` +
      `<path ${FE} d="M5.6 10.4 H18.4 V19.6 C18.4 20.4 17.7 20.9 17 20.9 H7 C6.3 20.9 5.6 20.4 5.6 19.6 Z M11.1 14 C11.1 13.5 11.5 13.1 12 13.1 C12.5 13.1 12.9 13.5 12.9 14 C12.9 14.3 12.7 14.6 12.5 14.8 L12.8 16.6 H11.2 L11.5 14.8 C11.3 14.6 11.1 14.3 11.1 14 Z"/>`,
  },
  {
    id: 'ui/edit',
    label: 'Éditer',
    // Crayon incliné, pointe et gomme.
    svg:
      `<path ${F} d="M14.9 3.9 L17.4 6.4 L8.3 15.6 L5.3 16.4 L6.1 13.4 Z"/>` +
      `<path ${K} d="M16.3 2.4 L19.6 5.7 L17.4 6.4 L14.9 3.9 Z"/>` +
      `<path ${KF} d="M4.6 19.6 H19.4"/>`,
  },
  {
    id: 'ui/add',
    label: 'Ajouter',
    // Croix simple dans un cercle.
    svg:
      `<circle ${K} cx="12" cy="12" r="8.1"/>` +
      `<path ${K} d="M12 7.4 V16.6 M7.4 12 H16.6"/>`,
  },
  {
    id: 'ui/delete',
    label: 'Supprimer',
    // Corbeille, couvercle et deux nervures.
    svg:
      `<path ${K} d="M5.6 7.4 H18.4 L17.4 20.1 C17.3 20.7 16.8 21.1 16.3 21.1 H7.7 C7.2 21.1 6.7 20.7 6.6 20.1 Z"/>` +
      `<path ${K} d="M3.9 7.4 H20.1"/>` +
      `<path ${K} d="M9.4 7.4 L9.9 4.1 H14.1 L14.6 7.4"/>` +
      `<path ${KF} d="M10.3 10.6 V17.9 M13.7 10.6 V17.9"/>`,
  },
  {
    id: 'ui/eye',
    label: 'Vision',
    // Œil ouvert, iris central.
    svg:
      `<path ${K} d="M2.6 12 C4.9 7.6 8.2 5.4 12 5.4 C15.8 5.4 19.1 7.6 21.4 12 C19.1 16.4 15.8 18.6 12 18.6 C8.2 18.6 4.9 16.4 2.6 12 Z"/>` +
      `<circle ${F} cx="12" cy="12" r="3.1"/>`,
  },
  {
    id: 'ui/forbidden',
    label: 'Interdit',
    // Cercle barré.
    svg:
      `<circle ${K} cx="12" cy="12" r="8.1"/>` +
      `<path ${K} d="M6.3 6.3 L17.7 17.7"/>`,
  },
  {
    id: 'ui/key',
    label: 'Clé',
    // Panneton simple, tige et dents.
    svg:
      `<circle ${K} cx="7.3" cy="7.3" r="3.9"/>` +
      `<path ${K} d="M10 10 L19.4 19.4 M16.3 16.1 L18.4 14 M13.7 13.4 L15.7 11.4"/>`,
  },
  {
    id: 'ui/balance',
    label: 'Balance / choix pesé',
    // Balance à deux plateaux, fléau et pied.
    svg:
      `<path ${K} d="M12 3.6 V20.4 M8 20.4 H16"/>` +
      `<path ${K} d="M4.6 6.6 H19.4"/>` +
      `<path ${K} d="M4.6 6.6 L2.6 11.6 C3.6 12.6 5.6 12.6 6.6 11.6 Z"/>` +
      `<path ${K} d="M19.4 6.6 L17.4 11.6 C18.4 12.6 20.4 12.6 21.4 11.6 Z"/>`,
  },
  {
    id: 'ui/partial',
    label: 'Partiellement mécanisé',
    // Point à demi rempli.
    svg:
      `<circle ${K} cx="12" cy="12" r="6.4"/>` +
      `<path ${F} d="M12 5.6 C15.5 5.6 18.4 8.5 18.4 12 C18.4 15.5 15.5 18.4 12 18.4 Z"/>`,
  },
  {
    id: 'ui/branch',
    label: 'Branchement conditionnel',
    // Chemin qui se scinde en deux issues.
    svg:
      `<circle ${F} cx="5.3" cy="12" r="1.7"/>` +
      `<path ${K} d="M6.6 12 H10"/>` +
      `<path ${K} d="M10 12 C12 12 12 6.4 15.1 6.4 M10 12 C12 12 12 17.6 15.1 17.6"/>` +
      `<circle ${F} cx="17.1" cy="6.4" r="1.7"/>` +
      `<circle ${F} cx="17.1" cy="17.6" r="1.7"/>`,
  },
  {
    id: 'ui/close',
    label: 'Fermer',
    // Croix simple (fermer un panneau/dialogue).
    svg: `<path ${K} d="M6.5 6.5 L17.5 17.5 M17.5 6.5 L6.5 17.5"/>`,
  },
  {
    id: 'ui/think',
    label: 'Réflexion',
    // Bulle de pensée, petits ronds en traîne.
    svg:
      `<circle ${K} cx="12" cy="10" r="6"/>` +
      `<circle ${F} cx="7.6" cy="17.4" r="1.3"/>` +
      `<circle ${F} cx="5.4" cy="20.2" r="0.8"/>`,
  },
  {
    id: 'ui/tally',
    label: 'Bilan / comptage',
    // Bâtons de comptage : quatre traits verticaux barrés d'un cinquième diagonal.
    svg:
      `<path ${K} d="M5.4 5 V19 M9.1 5 V19 M12.8 5 V19 M16.5 5 V19"/>` +
      `<path ${K} d="M4 8.6 L18 15.4"/>`,
  },
  {
    id: 'ui/rotate-left',
    label: 'Tourner à gauche',
    // Flèche circulaire antihoraire, pointe nettement orientée vers la gauche.
    svg:
      `<path ${K} d="M18.9 8.1 C17.4 5.4 14.2 3.9 11.1 4.4 C7.4 5 4.7 8.2 4.7 12 C4.7 16 8 19.3 12 19.3 C15.2 19.3 17.9 17.3 18.9 14.5"/>` +
      `<path ${K} d="M4.8 7.2 L4.7 12 L9.4 11.3"/>`,
  },
  {
    id: 'ui/rotate-right',
    label: 'Tourner à droite',
    // Miroir horaire : pointe nettement orientée vers la droite.
    svg:
      `<path ${K} d="M5.1 8.1 C6.6 5.4 9.8 3.9 12.9 4.4 C16.6 5 19.3 8.2 19.3 12 C19.3 16 16 19.3 12 19.3 C8.8 19.3 6.1 17.3 5.1 14.5"/>` +
      `<path ${K} d="M19.2 7.2 L19.3 12 L14.6 11.3"/>`,
  },
  {
    id: 'ui/projection-iso',
    label: 'Vue isométrique',
    // Plan losange subdivisé selon ses deux axes isométriques.
    svg:
      `<path ${K} d="M12 3.7 L20.4 8.2 L12 12.7 L3.6 8.2 Z"/>` +
      `<path ${K} d="M12 3.7 V12.7 M3.6 8.2 H20.4"/>` +
      `<path ${KF} d="M5.1 11.2 L12 15 L18.9 11.2 M5.1 14.7 L12 18.5 L18.9 14.7"/>`,
  },
  {
    id: 'ui/projection-top',
    label: 'Vue du dessus',
    // Plan carré quadrillé vu à plat.
    svg:
      `<rect ${K} x="4.2" y="4.2" width="15.6" height="15.6" rx="0.8"/>` +
      `<path ${K} d="M12 4.2 V19.8 M4.2 12 H19.8"/>`,
  },
  {
    id: 'ui/zoom-in',
    label: 'Zoom avant',
    // Loupe et signe plus géométrique.
    svg:
      `<circle ${K} cx="10.2" cy="10.2" r="5.8"/>` +
      `<path ${K} d="M14.5 14.5 L20 20 M10.2 7.2 V13.2 M7.2 10.2 H13.2"/>`,
  },
  {
    id: 'ui/zoom-out',
    label: 'Zoom arrière',
    // Loupe et signe moins géométrique.
    svg:
      `<circle ${K} cx="10.2" cy="10.2" r="5.8"/>` +
      `<path ${K} d="M14.5 14.5 L20 20 M7.2 10.2 H13.2"/>`,
  },
  {
    id: 'ui/zoom-reset',
    label: 'Réinitialiser le zoom',
    // Loupe entourant une flèche de retour circulaire, sans chiffre ni glyphe.
    svg:
      `<circle ${K} cx="10.2" cy="10.2" r="6.2"/>` +
      `<path ${K} d="M14.7 14.7 L20 20"/>` +
      `<path ${KF} d="M12.9 8.1 C12 6.7 10.2 6.2 8.7 6.9 C7.2 7.5 6.4 9.1 6.7 10.7 C7 12.3 8.4 13.5 10 13.6 C11.2 13.7 12.3 13.1 13 12.2"/>` +
      `<path ${KF} d="M12.9 8.1 L10.4 7.9 M12.9 8.1 L12.6 5.7"/>`,
  },
];
