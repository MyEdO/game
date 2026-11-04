import type { IconFamily } from '../types';

/* Famille « marchand » (MerchantPanel — panier, marchandage, marché conclu). Charte : voir defs/action.ts. */

const K = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
const KF = 'fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"';
const F = 'fill="currentColor" stroke="none"';

export const icons: IconFamily = [
  {
    id: 'merchant/cart',
    label: 'Panier',
    // Panier d'osier, poignée, deux roues.
    svg:
      `<path ${K} d="M4.3 6.6 H6.4 L8.6 15.6 H18.1 L20 9.1 H7.3"/>` +
      `<circle ${F} cx="9.6" cy="19.1" r="1.6"/>` +
      `<circle ${F} cx="17.1" cy="19.1" r="1.6"/>` +
      `<path ${KF} d="M9.7 9.1 V15.6 M13 9.1 L13.6 15.6 M16.3 9.1 L15.6 15.6"/>`,
  },
  {
    id: 'merchant/haggle',
    label: 'Marchander',
    // Bulle de dialogue avec une pièce.
    svg:
      `<path ${K} d="M4.1 5.6 H16.9 C18 5.6 18.9 6.5 18.9 7.6 V13.4 C18.9 14.5 18 15.4 16.9 15.4 H10.3 L6.6 18.6 V15.4 H4.1 C3 15.4 2.1 14.5 2.1 13.4 V7.6 C2.1 6.5 3 5.6 4.1 5.6 Z"/>` +
      `<circle ${K} cx="16.9" cy="17.4" r="4.1"/>` +
      `<path ${KF} d="M15.7 17.4 H18.1 M16.9 16.2 V18.6"/>`,
  },
  {
    id: 'merchant/deal',
    label: 'Marché conclu',
    // Poignée de main, deux avant-bras qui se rejoignent.
    svg:
      `<path ${K} d="M2.9 10.3 L6.9 7.4 L10.3 9.7 L12 8.4 L13.7 9.7 L17.1 7.4 L21.1 10.3"/>` +
      `<path ${F} d="M9.1 9.4 L12 11.6 L14.9 9.4 L18.1 11.7 C18.9 12.3 19 13.4 18.3 14.1 C17.7 14.7 16.7 14.7 16 14.2 L14.4 13 L14.9 13.4 C15.6 13.9 15.6 15 14.9 15.6 C14.3 16.1 13.4 16.1 12.7 15.6 L10.3 13.7 C9.9 14.3 9.1 14.4 8.6 14 L5.9 11.7 Z"/>`,
  },
];
