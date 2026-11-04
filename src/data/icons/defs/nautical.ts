import type { IconFamily } from '../types';

/* Famille « périls nautiques » (voyage fluvial/maritime — vent, louvoyage, tourbillon, obstacles
   flottants/rocheux). Distincte de `travel.ts` (modes de transport). Charte : voir defs/action.ts. */

const K = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
const KF = 'fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"';
const F = 'fill="currentColor" stroke="none"';

export const icons: IconFamily = [
  {
    id: 'nautical/wind',
    label: 'Vent',
    // Trois bourrasques en volute, décroissantes.
    svg:
      `<path ${K} d="M3 9 H15.5 C17.4 9 18.9 7.6 18.9 5.9 C18.9 4.5 17.7 3.6 16.4 4"/>` +
      `<path ${K} d="M3 15 H12.5 C14.1 15 15.4 16.1 15.4 17.5 C15.4 18.6 14.5 19.3 13.4 19.1"/>` +
      `<path ${KF} d="M3 12 H10"/>`,
  },
  {
    id: 'nautical/tack',
    label: 'Louvoyage',
    // Trajectoire courbe qui vire, flèche en tête.
    svg:
      `<path ${K} d="M5 15.5 C5 9.5 9.5 5.5 15.5 5.5 H18"/>` +
      `<path ${K} d="M15 3 L18.2 5.5 L15 8"/>` +
      `<path ${KF} d="M5 15.5 V19"/>`,
  },
  {
    id: 'nautical/whirlpool',
    label: 'Tourbillon',
    // Spirale convergente.
    svg:
      `<path ${K} d="M12 20 C7.6 20 4 16.4 4 12 C4 8.7 6.7 6 10 6 C12.8 6 15 8.2 15 11 C15 13.2 13.2 15 11 15 C9.3 15 8 13.7 8 12 C8 10.6 9.1 9.5 10.5 9.5"/>`,
  },
  {
    id: 'nautical/snag',
    label: 'Bois flottant',
    // Rondin flottant (coupe en bout) sur l'eau.
    svg:
      `<path ${F} d="M4 10.5 C4 8.8 8.3 7.5 13.5 7.5 C18.8 7.5 20 8.8 20 10.5 C20 12.2 18.8 13.5 13.5 13.5 C8.3 13.5 4 12.2 4 10.5 Z"/>` +
      `<circle ${KF} cx="6" cy="10.5" r="1.6"/>` +
      `<path ${K} d="M3 17 C5.5 15.3 8 15.3 10.5 17 C13 18.7 15.5 18.7 18 17 C19 16.3 20 16 21 16"/>`,
  },
  {
    id: 'nautical/rock',
    label: 'Écueil',
    // Écueil rocheux dentelé émergeant de l'eau.
    svg:
      `<path ${F} d="M8 15 L6 11 L9.5 8 L12 10 L15 7 L18 11 L16 15 Z"/>` +
      `<path ${K} d="M3 18 C5.5 16.3 8 16.3 10.5 18 C13 19.7 15.5 19.7 18 18 C19 17.3 20 17 21 17"/>`,
  },
  {
    id: 'nautical/swim',
    label: 'Natation',
    // Nageur en crawl (tête + bras tendu) au-dessus d'une ligne de vaguelettes.
    svg:
      `<circle ${F} cx="7" cy="7" r="1.7"/>` +
      `<path ${K} d="M9 9 L15.5 6.5"/>` +
      `<path ${K} d="M9 9 L12.5 14"/>` +
      `<path ${K} d="M12.5 14 L8 16.5"/>` +
      `<path ${K} d="M12.5 14 L18 15.5"/>` +
      `<path ${K} d="M3 20 C5.5 18.3 8 18.3 10.5 20 C13 21.7 15.5 21.7 18 20 C19 19.3 20 19 21 19"/>`,
  },
];
