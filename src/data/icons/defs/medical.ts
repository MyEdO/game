import type { IconFamily } from '../types';

/* Famille « médical » (HealModal/MedicModal/EffectList/CharacterSheet/GameOpEditor — déchirure,
   chirurgie, séquelle permanente, maladie). Charte de dessin : voir defs/action.ts. */

const K = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
const KF = 'fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"';
const F = 'fill="currentColor" stroke="none"';

export const icons: IconFamily = [
  {
    id: 'medical/tear',
    label: 'Déchirure musculaire',
    // Jambe (cuisse/mollet) marquée d'une déchirure en zigzag.
    svg:
      `<path ${K} d="M9.8 3.4 C9.4 7.6 9.4 11.4 9.8 14.8 C8.6 16.9 7.9 18.9 7.7 20.8"/>` +
      `<path ${K} d="M14.2 3.4 C14.9 7.9 15 11.9 14.6 15.6 C15.6 17.5 16.2 19.3 16.3 20.8"/>` +
      `<path ${KF} d="M9.9 9.3 L12 10.9 L10.3 12.4 L12.4 14.1"/>`,
  },
  {
    id: 'medical/scalpel',
    label: 'Scalpel / chirurgie',
    // Lame de scalpel effilée, manche cannelé.
    svg:
      `<path ${F} d="M9.4 4.3 L19.9 14.8 L17.1 17.6 L6.6 7.1 Z"/>` +
      `<path ${K} d="M6.6 7.1 L4 4.5"/>` +
      `<path ${KF} d="M5.5 5.6 L5.9 6 M4.7 6.4 L5.1 6.8"/>`,
  },
  {
    id: 'medical/crutch',
    label: 'Séquelle / trauma',
    // Béquille d'aisselle.
    svg:
      `<path ${K} d="M9.4 3.6 H14.6 M12 3.6 V20.6"/>` +
      `<path ${K} d="M8 8.4 H16"/>` +
      `<path ${KF} d="M9.4 3.6 C9.1 5.4 9.1 6.7 9.4 8.4 M14.6 3.6 C14.9 5.4 14.9 6.7 14.6 8.4"/>`,
  },
  {
    id: 'medical/infection',
    label: 'Maladie / infection',
    // Microbe : corps ovale, cils rayonnants.
    svg:
      `<circle ${F} cx="12" cy="12" r="4.6"/>` +
      `<path ${K} d="M12 4.4 V6.7 M12 17.3 V19.6 M4.4 12 H6.7 M17.3 12 H19.6 M6.5 6.5 L8.1 8.1 M15.9 15.9 L17.5 17.5 M6.5 17.5 L8.1 15.9 M15.9 8.1 L17.5 6.5"/>` +
      `<circle ${F} cx="10" cy="10.7" r="0.9"/>` +
      `<circle ${F} cx="13.6" cy="13.1" r="0.7"/>`,
  },
  {
    id: 'medical/aid',
    label: 'Soins payants',
    // Croix de secours cerclée (PNJ soigneur/guérisseur).
    svg:
      `<circle ${K} cx="12" cy="12" r="8.1"/>` +
      `<path ${K} d="M12 8 V16 M8 12 H16"/>`,
  },
];
