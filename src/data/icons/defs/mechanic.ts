import type { IconFamily } from '../types';

/* Famille « mécaniques génériques du vocabulaire GameOp » (GameOpEditor — ward/protection,
   invocation/octroi, psychologie, projection/enchaînement, modificateur de statistique). Chaque
   icône couvre PLUSIEURS ops apparentées (ex. tous les Wards → mechanic/ward) — vocabulaire large,
   pas une métaphore par op individuelle (70 ops au total). Charte : voir defs/action.ts. */

const K = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
const KF = 'fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"';
const F = 'fill="currentColor" stroke="none"';

export const icons: IconFamily = [
  {
    id: 'mechanic/ward',
    label: 'Ward / protection magique',
    // Bouclier avec une runique gravée.
    svg:
      `<path ${K} d="M12 2.9 C14.8 4.4 17.3 5.1 19.9 5.3 C19.8 12.4 17.3 17.7 12 21 C6.7 17.7 4.2 12.4 4.1 5.3 C6.7 5.1 9.2 4.4 12 2.9 Z"/>` +
      `<path ${KF} d="M9 11 L12 8.4 L15 11 M9 14.6 L12 12 L15 14.6"/>`,
  },
  {
    id: 'mechanic/invoke',
    label: 'Octroi / invocation',
    // Empreinte de patte, l'invocation d'une créature ou d'un don.
    svg:
      `<circle ${F} cx="8" cy="14.9" r="2.2"/>` +
      `<circle ${F} cx="13.4" cy="13.6" r="2.1"/>` +
      `<circle ${F} cx="6" cy="9.6" r="1.6"/>` +
      `<circle ${F} cx="10.6" cy="8" r="1.6"/>` +
      `<circle ${F} cx="15" cy="8.6" r="1.5"/>` +
      `<path ${KF} d="M17 12.4 C18.4 12.4 19.4 13.6 19.1 14.9 C18.8 16.3 17.3 17.1 16 16.6"/>`,
  },
  {
    id: 'mechanic/mind',
    label: 'Psychologie',
    // Tête de profil, spirale mentale intérieure.
    svg:
      `<path ${K} d="M6.6 20.4 C6.4 17.3 6.1 15.3 5.1 13.9 C4.1 12.5 3.9 10.5 4.9 8.7 C6.3 6.1 9 4.4 12.1 4.4 C16.3 4.4 19.6 7.5 19.6 11.3 C19.6 14 18 16.3 15.6 17.4 V20.4"/>` +
      `<path ${KF} d="M9.6 11.3 C9.6 10.1 10.6 9.3 11.7 9.6 C12.7 9.9 13.1 11.1 12.4 11.9 C11.9 12.5 11.9 13.3 12.6 13.6"/>`,
  },
  {
    id: 'mechanic/chain',
    label: 'Projection / enchaînement',
    // Trois anneaux de chaîne reliés en diagonale.
    svg:
      `<circle ${K} cx="6.1" cy="17.9" r="2.6"/>` +
      `<circle ${K} cx="12" cy="12" r="2.6"/>` +
      `<circle ${K} cx="17.9" cy="6.1" r="2.6"/>` +
      `<path ${KF} d="M7.9 16.1 L10.2 13.8 M13.8 10.2 L16.1 7.9"/>`,
  },
  {
    id: 'mechanic/stat-mod',
    label: 'Modificateur de statistique',
    // Barre horizontale, flèches haut/bas d'ajustement.
    svg:
      `<path ${K} d="M5.4 12 H18.6"/>` +
      `<path ${K} d="M8.3 9 L8.3 3.6 M6.3 5.6 L8.3 3.4 L10.3 5.6"/>` +
      `<path ${K} d="M15.7 15 L15.7 20.4 M13.7 18.4 L15.7 20.6 L17.7 18.4"/>`,
  },
];
