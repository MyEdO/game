import type { IconFamily } from '../types';

/* Fallbacks d'objets (src/ui/ItemIcon.tsx) — charte : voir defs/action.ts. */

const K = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
const KF = 'fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"';
const F = 'fill="currentColor" stroke="none"';
/** Silhouette pleine à trous (evenodd). */
const FE = 'fill="currentColor" fill-rule="evenodd" stroke="none"';

export const icons: IconFamily = [
  {
    id: 'item/weapon',
    label: 'Arme',
    svg:
      `<path ${F} d="M12 2.6 C13 5.4 13.4 9.6 13.1 13.9 L10.9 13.9 C10.6 9.6 11 5.4 12 2.6 Z"/>` +
      `<path ${K} d="M8.7 14.9 C10.9 14.4 13.1 14.4 15.3 14.9"/>` +
      `<path ${K} d="M12 15.6 V18.4"/>` +
      `<circle ${F} cx="12" cy="19.8" r="1.2"/>`,
  },
  {
    id: 'item/armour',
    label: 'Armure',
    svg:
      `<path ${K} d="M6.5 4.6 C8.3 5.8 10.1 6.4 12 6.4 C13.9 6.4 15.7 5.8 17.5 4.6 C16.8 7.1 16.7 9.5 17.3 11.9 C15.6 15.9 13.9 18.3 12 19.5 C10.1 18.3 8.4 15.9 6.7 11.9 C7.3 9.5 7.2 7.1 6.5 4.6 Z"/>` +
      `<path ${KF} d="M12 8.6 C11.9 11.6 12 14.4 12 16.9"/>` +
      `<path ${KF} d="M8.7 9.9 C9.9 11 11 11.5 12 11.5 C13 11.5 14.1 11 15.3 9.9"/>`,
  },
  {
    id: 'item/ammo',
    label: 'Munition',
    svg:
      // UNE flèche/carreau en diagonale : tête triangulaire PLEINE + fût + empennage losange plein.
      `<path ${F} d="M20.3 3.7 C19.7 5.9 18.9 7.8 17.9 9.4 C16.8 8.4 15.7 7.3 14.7 6.1 C16.4 5 18.3 4.2 20.3 3.7 Z"/>` +
      `<path ${K} d="M8.9 15.1 C11.2 12.9 13.4 10.7 15.6 8.4"/>` +
      `<path ${F} d="M9.4 14.6 C9.3 15.8 9.1 16.8 8.8 17.7 C7.7 18 6.7 18.2 5.7 18.2 C5.9 17 6.1 16 6.4 15.1 C7.4 14.8 8.4 14.6 9.4 14.6 Z"/>` +
      `<path ${KF} d="M5.9 18.1 L4 20"/>`,
  },
  {
    id: 'item/cloak',
    label: 'Cape',
    svg:
      `<circle ${F} cx="12" cy="3.6" r="1.1"/>` +
      `<path ${K} d="M10.2 4.9 C7.9 7.2 6.5 11.8 6.1 19.4 C8 18.3 9.9 18.4 11.7 19.6 C13.5 18.4 15.4 18.3 17.9 19.4 C17.5 11.8 16.1 7.2 13.8 4.9"/>` +
      `<path ${KF} d="M10.6 7.6 C10 11.4 9.8 15.2 10.1 18.6 M13.6 7.8 C14.1 11.4 14.3 15 14.1 18.4"/>`,
  },
  {
    id: 'item/consumable',
    label: 'Consommable',
    svg:
      `<path ${F} d="M10.5 2.8 C11.5 2.6 12.5 2.6 13.5 2.8 L13.6 4.7 L10.4 4.7 Z"/>` +
      `<path ${K} d="M10.9 5.1 V8.6 M13.1 5.1 V8.6"/>` +
      `<path ${K} d="M10.9 8.6 C8.2 10.6 6.7 13.2 6.9 15.9 C7.1 18.3 8.9 19.8 12 19.8 C15.1 19.8 16.9 18.3 17.1 15.9 C17.3 13.2 15.8 10.6 13.1 8.6"/>` +
      `<path ${KF} d="M7.6 14.3 C10.4 15.5 13.6 15.5 16.4 14.3"/>`,
  },
  {
    id: 'item/misc',
    label: 'Objet divers',
    svg:
      // Besace de cuir à rabat (fente + boucle en trous evenodd) — pas de mallette moderne.
      `<path ${KF} d="M8.3 9.7 C8.6 6.4 15.4 6.4 15.7 9.7"/>` +
      `<path ${FE} d="M5.6 9.8 C5.1 13.2 5.4 16.4 6.4 19.1 C10.1 20.2 13.9 20.2 17.6 19.1 C18.6 16.4 18.9 13.2 18.4 9.8 Z M6.8 13.2 C10.2 12.1 13.8 12.1 17.2 13.2 L17.4 14.6 C13.8 13.5 10.2 13.5 6.6 14.6 Z M11 16.3 C11.6 15.8 12.4 15.8 13 16.3 C13.5 16.8 13.5 17.5 12.9 18 C12.4 18.4 11.6 18.4 11.1 18 C10.6 17.5 10.6 16.8 11 16.3 Z"/>`,
  },
];
