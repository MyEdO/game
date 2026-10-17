import type { IconFamily } from '../types';

/* Famille « navigation » (menu principal, éditeur, interlude, fiches — remplace les emojis
   de MainMenu/InterludeScreen/PartyScreen/révélations). Charte de dessin : voir defs/action.ts.
   Époque stricte : métaphores Renaissance-fantasy (pigeon voyageur, alambic, d10, corne du Chaos). */

const K = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
const KF = 'fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"';
const F = 'fill="currentColor" stroke="none"';

export const icons: IconFamily = [
  {
    id: 'nav/new-game',
    label: 'Nouvelle partie',
    // Épées croisées cérémonielles (même construction de lame que action/attack).
    svg:
      `<path ${F} d="M14.7 15.2 L5.2 4.5 C4.6 3.9 3.8 3.6 3.2 3.6 C3.2 4.2 3.5 5.1 4 5.7 L13.4 16.5 Z"/>` +
      `<path ${F} d="M9.3 15.2 L18.8 4.5 C19.4 3.9 20.2 3.6 20.8 3.6 C20.8 4.2 20.5 5.1 20 5.7 L10.6 16.5 Z"/>` +
      `<path ${K} d="M17 13.5 L12.6 18.1 M14.9 15.9 L18.3 19.3"/>` +
      `<circle ${F} cx="18.9" cy="19.9" r="1.2"/>` +
      `<path ${K} d="M7 13.5 L11.4 18.1 M9.1 15.9 L5.7 19.3"/>` +
      `<circle ${F} cx="5.1" cy="19.9" r="1.2"/>`,
  },
  {
    id: 'nav/load',
    label: 'Charger',
    // Coffre entrebâillé, lueur du trésor dans la fente.
    svg:
      `<path ${F} d="M5.7 9.6 C5.7 6.5 8.4 4.4 12 4.4 C15.6 4.4 18.3 6.5 18.3 9.6 L18.4 10.4 L5.6 10.4 Z"/>` +
      `<path ${K} d="M4.7 12.9 H19.3 V18.3 C19.3 19.2 18.7 19.8 17.8 19.8 H6.2 C5.3 19.8 4.7 19.2 4.7 18.3 Z"/>` +
      `<path ${KF} d="M12 12.9 V15.4"/>` +
      `<circle ${F} cx="9.3" cy="11.7" r="0.8"/>` +
      `<circle ${F} cx="12.5" cy="11.5" r="0.7"/>` +
      `<circle ${F} cx="15.1" cy="11.8" r="0.6"/>`,
  },
  {
    id: 'nav/online',
    label: 'Jouer en ligne',
    // Deux tours reliées par le vol d'un pigeon voyageur (pas de globe moderne).
    svg:
      `<path ${F} d="M3.8 20.4 V7.6 H5.1 V9.1 H6.4 V7.6 H7.7 V20.4 Z"/>` +
      `<path ${F} d="M16.3 20.4 V7.6 H17.6 V9.1 H18.9 V7.6 H20.2 V20.4 Z"/>` +
      `<path ${K} d="M8 11 C9.9 8.3 14.1 8.3 16 11"/>` +
      `<path ${KF} d="M10.5 5.8 C11.1 5.2 11.6 5.2 11.9 5.7 M11.9 5.7 C12.2 5.2 12.7 5.2 13.3 5.8"/>`,
  },
  {
    id: 'nav/rules',
    label: 'Règles maison',
    // Feuillet scellé à la cire, ruban pendant.
    svg:
      `<path ${K} d="M6.9 3.9 H17.2 C17.8 3.9 18.2 4.3 18.2 4.9 V19.1 C18.2 19.7 17.8 20.1 17.2 20.1 H6.9 C6.3 20.1 5.9 19.7 5.9 19.1 V4.9 C5.9 4.3 6.3 3.9 6.9 3.9 Z"/>` +
      `<path ${KF} d="M8.4 7.5 C10.8 7.3 13.2 7.3 15.6 7.5 M8.4 10.4 C10.4 10.2 12.4 10.2 14.4 10.4"/>` +
      `<circle ${F} cx="14.5" cy="15.8" r="2.5"/>` +
      `<path ${K} d="M12.5 17.7 L10.8 19.5"/>`,
  },
  {
    id: 'nav/compendium',
    label: 'Compendium',
    // Grimoire ouvert, deux pages annotées.
    svg:
      `<path ${K} d="M12 6.3 C10.1 4.9 7.5 4.4 4.4 4.7 V17.8 C7.5 17.5 10.1 18 12 19.4 C13.9 18 16.5 17.5 19.6 17.8 V4.7 C16.5 4.4 13.9 4.9 12 6.3 Z"/>` +
      `<path ${KF} d="M12 6.3 C12.1 10.7 12.1 15 12 19.4"/>` +
      `<path ${KF} d="M6.6 8.1 C7.9 8.1 9.1 8.4 10.2 8.9 M6.6 11 C7.9 11 9.1 11.3 10.2 11.8 M13.8 8.9 C14.9 8.4 16.1 8.1 17.4 8.1 M13.8 11.8 C14.9 11.3 16.1 11 17.4 11"/>`,
  },
  {
    id: 'nav/carnet',
    label: 'Carnet d’enquête',
    // Carnet relié (dos plein, notes) sous la loupe de l'enquêteur.
    svg:
      `<path ${F} d="M4.8 4.7 C4.8 4.1 5.2 3.7 5.8 3.7 H7.6 V19.9 H5.8 C5.2 19.9 4.8 19.5 4.8 18.9 Z"/>` +
      `<path ${K} d="M16.1 9.9 V4.7 C16.1 4.1 15.7 3.7 15.1 3.7 H5.8 C5.2 3.7 4.8 4.1 4.8 4.7 V18.9 C4.8 19.5 5.2 19.9 5.8 19.9 H11.4"/>` +
      `<path ${KF} d="M9.6 7.4 C11.1 7.3 12.6 7.3 14 7.4 M9.6 10.2 C10.7 10.1 11.7 10.1 12.6 10.2"/>` +
      `<circle ${K} cx="15.3" cy="15.1" r="3.5"/>` +
      `<path ${F} d="M17.4 18.4 L18.4 17.4 L20.9 19.9 C21.2 20.2 21.2 20.6 20.9 20.9 C20.6 21.2 20.2 21.2 19.9 20.9 Z"/>`,
  },
  {
    id: 'nav/editor',
    label: 'Éditeur',
    // Équerre graduée + marteau du bâtisseur.
    svg:
      `<path ${K} d="M4.8 4.6 C4.6 9.5 4.6 14.4 4.8 19.2 C9.7 19.4 14.5 19.4 19.4 19.2 V15.8 C15.8 16 12.3 16 8.7 15.8 C8.5 12.1 8.5 8.3 8.7 4.6 Z"/>` +
      `<path ${KF} d="M8.6 7.2 H7.5 M8.6 10.3 H7.8 M11.5 15.9 V17 M14.8 15.9 V16.7"/>` +
      `<path ${K} d="M12.6 11.9 L18.3 6.2"/>` +
      `<path ${F} d="M16.2 2.9 C17.5 1.9 19.3 2 20.4 3.1 C21.5 4.2 21.6 6 20.6 7.3 L19.2 7.7 L15.8 4.3 Z"/>`,
  },
  {
    id: 'nav/test-scenarios',
    label: 'Scénarios de test',
    // Alambic : cornue, bec distillateur, goutte à l'épreuve.
    svg:
      `<path ${K} d="M6.6 4.7 H10.8"/>` +
      `<path ${K} d="M7.6 5.1 V8.9 C5.7 10 4.5 11.9 4.5 14 C4.5 16.9 6.6 19 9.6 19 C12.6 19 14.7 16.9 14.7 14 C14.7 11.9 13.5 10 11.6 8.9 V5.1"/>` +
      `<path ${K} d="M13.4 10.5 C16.3 9.9 18.9 11.8 19.9 15.2"/>` +
      `<path ${F} d="M20.1 16.6 C20.8 17.5 21.1 18.2 21.1 18.8 C21.1 19.5 20.7 19.9 20.1 19.9 C19.5 19.9 19.1 19.5 19.1 18.8 C19.1 18.2 19.4 17.5 20.1 16.6 Z"/>` +
      `<path ${F} d="M5.5 13.7 C8.1 14.8 11.1 14.8 13.7 13.7 C13.3 16.4 11.8 18 9.6 18 C7.4 18 5.9 16.4 5.5 13.7 Z"/>`,
  },
  {
    id: 'nav/art-gallery',
    label: 'Galeries d’art',
    // Palette du peintre, touches de couleur (une seule dorée).
    svg:
      `<path ${K} d="M12 4.3 C16.9 4.3 20.8 7.4 20.8 11.2 C20.8 13.9 18.9 15.3 16.7 15.1 C15.3 15 14.5 15.7 14.7 16.9 C14.9 18.3 13.9 19.7 12 19.7 C7.1 19.7 3.2 16.3 3.2 12 C3.2 7.7 7.1 4.3 12 4.3 Z"/>` +
      `<circle ${KF} cx="11.3" cy="15.9" r="1.2"/>` +
      `<circle ${F} cx="8.1" cy="8.6" r="1.25"/>` +
      `<circle ${F} cx="12.4" cy="7.4" r="1.25"/>` +
      `<circle ${F} cx="7" cy="12.6" r="1.25"/>` +
      `<circle fill="var(--gold)" stroke="none" cx="16.3" cy="9" r="1.25"/>`,
  },
  {
    id: 'nav/campaign',
    label: 'Campagne',
    // Carte déroulée entre ses deux rouleaux, itinéraire et croix du but.
    svg:
      `<path ${K} d="M6.1 5.2 C4.7 5.2 3.7 6.2 3.7 7.5 V16.5 C3.7 17.8 4.7 18.8 6.1 18.8 M6.1 5.2 H17.9 M6.1 18.8 H17.9 M17.9 5.2 C19.3 5.2 20.3 6.2 20.3 7.5 V16.5 C20.3 17.8 19.3 18.8 17.9 18.8"/>` +
      `<path ${KF} d="M6.1 5.2 C7 5.6 7.4 6.4 7.4 7.4 V16.6 C7.4 17.6 7 18.4 6.1 18.8 M17.9 5.2 C17 5.6 16.6 6.4 16.6 7.4 V16.6 C16.6 17.6 17 18.4 17.9 18.8"/>` +
      `<path ${KF} d="M8.4 15.9 C10.2 14.1 10.5 12 13 11.5 C14.6 11.2 15.1 10 15.5 8.9"/>` +
      `<path ${KF} d="M14.5 7 L16.2 8.7 M16.2 7 L14.5 8.7"/>`,
  },
  {
    id: 'nav/seat-owner',
    label: 'Propriétaire du siège',
    // Buste du joueur sur son socle.
    svg:
      `<circle ${F} cx="12" cy="7.7" r="3.4"/>` +
      `<path ${F} d="M12 12.6 C16 12.6 18.6 15 19 19 C14.4 19.8 9.6 19.8 5 19 C5.4 15 8 12.6 12 12.6 Z"/>` +
      `<path ${KF} d="M4.6 21.3 C9.5 21.7 14.5 21.7 19.4 21.3"/>`,
  },
  {
    id: 'nav/entry-point',
    label: 'Point d’entrée',
    // Fanion à queue d'aronde planté dans son monticule.
    svg:
      `<path ${K} d="M8.6 3.7 C8.8 8.9 8.8 14.1 8.6 19.3"/>` +
      `<path ${F} d="M9.3 4.4 C12.7 4.3 16.1 4.8 19.4 5.9 L16.5 7.9 L19.3 9.9 C16.1 10.9 12.7 11.4 9.3 11.2 Z"/>` +
      `<path ${K} d="M4.9 20.8 C7.1 19.4 10.2 19.4 12.4 20.8"/>`,
  },
  {
    id: 'nav/rest',
    label: 'Repos',
    // Feu de camp : flamme sur bûches croisées.
    svg:
      `<path ${F} d="M12 4.6 C14.5 7.1 15.7 9.4 15.7 11.6 C15.7 14 14.2 15.6 12 15.6 C9.8 15.6 8.3 14 8.3 11.6 C8.3 10.3 8.9 9 9.9 7.8 C10 9.2 10.7 10.2 11.8 10.7 C11.3 8.7 11.4 6.7 12 4.6 Z"/>` +
      `<path ${K} d="M5.6 20.5 L18.4 17.7 M5.6 17.7 L18.4 20.5"/>`,
  },
  {
    id: 'nav/identify',
    label: 'Identifier',
    // Loupe posée sur une rune.
    svg:
      `<circle ${K} cx="10.3" cy="10.1" r="6"/>` +
      `<path ${K} d="M14.7 14.5 L19.8 19.6"/>` +
      `<path ${KF} d="M8.7 7.2 C8.6 9.2 8.6 11.2 8.7 13.1 M8.7 8.5 L11.6 7.1 M8.7 10.7 L11.2 9.5"/>`,
  },
  {
    id: 'nav/memorize',
    label: 'Mémoriser',
    // Livre ouvert dans une tête de profil : le sort à l'esprit.
    svg:
      `<path ${K} d="M9.5 20.7 C9.5 19.4 9.2 18.4 8.4 17.5 C6.5 15.6 5.7 13.4 6.3 10.9 C7 7.8 9.6 5.7 12.8 5.7 C16.2 5.7 18.8 8.1 18.8 11.3 C18.8 12 18.7 12.6 18.4 13.3 L19.5 15.1 C19.8 15.6 19.6 16.1 19 16.2 L17.9 16.4 C17.9 17.8 17.9 19.2 18 20.7"/>` +
      `<path ${KF} d="M12.6 9.3 C11.6 8.7 10.5 8.5 9.5 8.8 V12.4 C10.5 12.1 11.6 12.3 12.6 12.9 C13.6 12.3 14.7 12.1 15.7 12.4 V8.8 C14.7 8.5 13.6 8.7 12.6 9.3 Z"/>`,
  },
  {
    id: 'nav/activity',
    label: 'Activité',
    // Parchemin déroulé verticalement (distinct du feuillet scellé et de la carte).
    svg:
      `<path ${K} d="M8.4 4.4 H17.3 C18.6 4.4 19.5 5.3 19.5 6.6 C19.5 7.9 18.6 8.8 17.3 8.8"/>` +
      `<path ${K} d="M8.4 4.4 C7.1 4.4 6.2 5.3 6.2 6.6 V17.5 C6.2 18.7 7.1 19.6 8.3 19.6 H15.1 C16.3 19.6 17.2 18.7 17.2 17.5 V8.8"/>` +
      `<path ${KF} d="M9.1 11.1 C10.9 10.9 12.7 10.9 14.5 11.1 M9.1 14 C10.7 13.8 12.3 13.8 13.9 14"/>`,
  },
  {
    id: 'nav/dice',
    label: 'Tirage',
    // Dé à dix faces (d100 du jeu) : face en cerf-volant et arêtes rayonnantes.
    svg:
      `<path ${K} d="M12.1 3.1 L18.9 8.5 L17.1 16.7 L12 20.9 L6.9 16.7 L5.1 8.5 Z"/>` +
      `<path ${KF} d="M12.1 3.1 L8.3 10.6 L12 14.5 L15.9 10.6 Z"/>` +
      `<path ${KF} d="M12 14.5 V20.9 M8.3 10.6 L5.1 8.5 M8.3 10.6 L6.9 16.7 M15.9 10.6 L18.9 8.5 M15.9 10.6 L17.1 16.7"/>`,
  },
  {
    id: 'nav/mutation',
    label: 'Mutation',
    // Corne torse du Chaos, anneaux de croissance (pas d'ADN moderne).
    svg:
      `<path ${K} d="M5 20.2 C5.3 14.4 7.5 9.6 11.6 5.8 C13.4 4.2 15.7 3 18.3 2.3 C17.4 4.5 16.3 6.7 15 8.7 C12.6 12.3 10 15.6 7.1 18.7 C6.4 19.3 5.7 19.8 5 20.2 Z"/>` +
      `<path ${KF} d="M6 16.6 C7.1 17 8.2 17 9.3 16.6 M8.4 12.6 C9.5 13 10.6 13 11.7 12.6 M11.2 8.9 C12.2 9.3 13.2 9.3 14.2 8.9"/>`,
  },
];
