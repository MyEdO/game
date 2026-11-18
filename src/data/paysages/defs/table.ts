import type { FamilleDeCouches } from '../types';

/**
 * La table, le fond des écrans posés hors du jeu (#3935, maquette `propositions/sources/accueil-et-systeme`,
 * `systeme.css` `#lueur-table`, `gestes.css` `.bois`) : sur le bois de la table, l'ombre qui gagne vers le bas, puis
 * la lueur d'une chandelle au milieu, éteinte au bord.
 */
export const couches: FamilleDeCouches = [
  {
    id: 'table-lueur',
    label: 'Table : lueur',
    svg: `
      <linearGradient id="table-lueur-bois" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="var(--shadow-ink)" stop-opacity="0"/><stop offset="0.55" stop-color="var(--shadow-ink)" stop-opacity="0.2"/><stop offset="1" stop-color="var(--shadow-ink)" stop-opacity="0.35"/>
      </linearGradient>
      <radialGradient id="table-lueur-chandelle" cx="0.5" cy="0.46" r="0.5" gradientTransform="translate(0.5 0.46) scale(1.2 1.4) translate(-0.5 -0.46)">
        <stop offset="0" stop-color="var(--lueur-de-table)" stop-opacity="0.2"/><stop offset="0.55" stop-color="var(--lueur-de-table)" stop-opacity="0.05"/><stop offset="1" stop-color="var(--shadow-ink)" stop-opacity="0.55"/>
      </radialGradient>
      <rect x="0" y="0" width="1600" height="900" fill="url(#table-lueur-bois)"/>
      <rect x="0" y="0" width="1600" height="900" fill="url(#table-lueur-chandelle)"/>
    `,
  },
];
