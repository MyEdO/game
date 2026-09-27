import type { TenueDef } from '../types';
import { BOTTE_CUIR } from '../botte-gabarit';
import { lateralPair } from '../../parallax';

// Guerrier du Chaos : ARMURE DE PLATES INTÉGRALE (cuirasse bombée à étoile du Chaos, épaulières
// à POINTES portées par l'OS DU BRAS — cohérence 3 vues/2 côtés par construction —, heaume
// intégral CORNU à fente en T + camail). @metal = plates sombres, @vet2 = garnitures laiton,
// @cuir = sangles. PILOTE de la voie registre : une tenue de carrière = CE fichier (career:
// true), consommée par career:'Guerrier du Chaos' sur la race/le PNJ — zéro édition d'existant.
export const tenue: TenueDef = {
  label: 'Guerrier du Chaos',
  id: "guerrier-du-chaos",
  palette: { vet2: '#6a5420', cuir: '#140f12', metal: '#3a3a46' },
  set: {
    pied: BOTTE_CUIR,
    torse: {
      // PAS d'épaulière dans le torse : elle vit sur l'os du BRAS (slot bras).
      front: `<g stroke-linejoin="round">`
        // gorgerin MONTANT (couvre le cou jusque sous le heaume) + cuirasse bombée
        + `<path d="M-7 -38 Q0 -41 7 -38 L8 -30 Q8 -26 7 -25 Q0 -27 -7 -25 Q-8 -26 -8 -30 Z" fill="@metalO" stroke="#0c0c12" stroke-width="0.7"/>`
        + `<path d="M-13 -26 Q0 -30 13 -26 L12.5 2 Q11 10 0 12 Q-11 10 -12.5 2 Z" fill="@metal" stroke="#0c0c12" stroke-width="1.1"/>`
        + `<path d="M-11 -23 Q0 -27 11 -23" fill="none" stroke="@metalH" stroke-width="0.9" opacity="0.7"/>`
        // étoile du Chaos à 8 flèches (garniture laiton)
        + `<g stroke="@vet2" stroke-width="1.2" fill="none"><path d="M0 -16 L0 0 M-8 -8 L8 -8 M-5.6 -13.6 L5.6 -2.4 M5.6 -13.6 L-5.6 -2.4"/></g>`
        + `<g fill="@vet2"><path d="M0 -17.5 l-1.4 2.6 h2.8 Z M0 1.5 l-1.4 -2.6 h2.8 Z M-9.5 -8 l2.6 -1.4 v2.8 Z M9.5 -8 l-2.6 -1.4 v2.8 Z"/></g>`
        // plaques segmentées du ventre + ceinture à crâne
        + `<path d="M-11 12 L11 12 L10 19 L-10 19 Z M-10 20 L10 20 L9 27 L-9 27 Z M-9 28 Q0 32 9 28 L8 33 Q0 36 -8 33 Z" fill="@metalO" stroke="#0c0c12" stroke-width="0.7"/>`
        + `<rect x="-12" y="8" width="24" height="5" rx="1.2" fill="@cuir" stroke="#0c0c12" stroke-width="0.7"/>`
        + `<circle cx="0" cy="10.5" r="3" fill="@vet2" stroke="#0c0c12" stroke-width="0.5"/><circle cx="-1.1" cy="10" r="0.6" fill="#0c0c12"/><circle cx="1.1" cy="10" r="0.6" fill="#0c0c12"/><path d="M-1.2 12.2 Q0 13 1.2 12.2" stroke="#0c0c12" stroke-width="0.5" fill="none"/>`
        + `</g>`,
      back: `<g stroke-linejoin="round">`
        + `<path d="M-7 -38 Q0 -41 7 -38 L8 -28 Q0 -31 -8 -28 Z" fill="@metalO" stroke="#0c0c12" stroke-width="0.7"/>`
        + `<path d="M-13 -26 Q0 -30 13 -26 L12.5 2 Q11 10 0 12 Q-11 10 -12.5 2 Z" fill="@metalO" stroke="#0c0c12" stroke-width="1.1"/>`
        + `<path d="M0 -28 L0 11" stroke="#0c0c12" stroke-width="1"/>`
        + `<path d="M-9 -18 l-2 -4 l4 1 Z M9 -18 l2 -4 l-4 1 Z M-7 -6 l-2 -4 l4 1 Z M7 -6 l2 -4 l-4 1 Z" fill="@metal" stroke="#0c0c12" stroke-width="0.5"/>`
        + `<path d="M-11 12 L11 12 L10 19 L-10 19 Z M-10 20 L10 20 L9 27 L-9 27 Z M-9 28 Q0 32 9 28 L8 33 Q0 36 -8 33 Z" fill="@metalO" stroke="#0c0c12" stroke-width="0.7"/>`
        + `</g>`,
      profile: `<g stroke-linejoin="round">`
        + `<path d="M-4 -38 Q2 -40 6 -37 L6.5 -26 Q0 -29 -5 -26 Z" fill="@metalO" stroke="#0c0c12" stroke-width="0.7"/>`
        + `<path d="M-6 -27 Q3 -30 7 -25 Q9 -10 7 4 Q4 11 -2 11 Q-7 8 -7 2 Q-8 -14 -6 -27 Z" fill="@metal" stroke="#0c0c12" stroke-width="1"/>`
        + `<path d="M3 -20 L3 -6 M-2 -13 L8 -13" stroke="@vet2" stroke-width="1.1" fill="none"/>`
        + `<path d="M-6 11 L7 11 L6 18 L-5 18 Z M-5 19 L6 19 L5 26 L-4 26 Z M-4 27 Q1 31 5 27 L4 32 Q0 34 -3 32 Z" fill="@metalO" stroke="#0c0c12" stroke-width="0.7"/>`
        + `<rect x="-7" y="7" width="15" height="4.6" rx="1.2" fill="@cuir" stroke="#0c0c12" stroke-width="0.6"/>`
        + `</g>`,
    },
    jambes: {
      front: `<g stroke-linejoin="round">`
        + `<path d="M-5 0 Q-6 10 -4.6 20 L4.6 20 Q6 10 5 0 Z" fill="@metal" stroke="#0c0c12" stroke-width="0.8"/>`
        + `<path d="M-4.6 6 L4.6 6 M-4.6 12 L4.6 12" stroke="#0c0c12" stroke-width="0.6" opacity="0.7"/>`
        + `<path d="M-4.2 20 Q0 18 4.2 20 Q5 24 0 26 Q-5 24 -4.2 20 Z" fill="@metalO" stroke="#0c0c12" stroke-width="0.7"/>`
        + `<path d="M0 17 L0 9 L2.6 14 Z" fill="@vet2" stroke="#0c0c12" stroke-width="0.4"/>`
        + `<path d="M-4 26 Q-4.6 36 -3.6 44 L3.6 44 Q4.6 36 4 26 Z" fill="@metal" stroke="#0c0c12" stroke-width="0.8"/>`
        + `<path d="M-3.8 44 L3.8 44 L4.4 50 Q0 52 -4.4 50 Z" fill="@metalO" stroke="#0c0c12" stroke-width="0.7"/>`
        + `</g>`,
      back: `<g stroke-linejoin="round">`
        + `<path d="M-5 0 Q-6 10 -4.6 20 L4.6 20 Q6 10 5 0 Z" fill="@metalO" stroke="#0c0c12" stroke-width="0.8"/>`
        + `<path d="M-4 22 Q-4.6 34 -3.6 44 L3.6 44 Q4.6 34 4 22 Z" fill="@metalO" stroke="#0c0c12" stroke-width="0.8"/>`
        + `<path d="M-3.8 44 L3.8 44 L4.4 50 Q0 52 -4.4 50 Z" fill="@metalO" stroke="#0c0c12" stroke-width="0.7"/>`
        + `</g>`,
      profile: `<g stroke-linejoin="round">`
        + `<path d="M-4 0 Q-5 10 -3.8 20 L4 20 Q5 10 4.2 0 Z" fill="@metal" stroke="#0c0c12" stroke-width="0.8"/>`
        + `<path d="M-3.4 20 Q0.4 18 4 20 Q4.6 24 0.4 26 Q-4 24 -3.4 20 Z" fill="@metalO" stroke="#0c0c12" stroke-width="0.7"/>`
        + `<path d="M1 17 L1 9 L3.4 14 Z" fill="@vet2" stroke="#0c0c12" stroke-width="0.4"/>`
        + `<path d="M-3.2 26 Q-3.8 36 -2.8 44 L3.4 44 Q4.2 36 3.6 26 Z" fill="@metal" stroke="#0c0c12" stroke-width="0.8"/>`
        + `<path d="M-3 44 L3.4 44 L7.5 49 Q3 51.5 -3.6 50 Z" fill="@metalO" stroke="#0c0c12" stroke-width="0.7"/>`
        + `</g>`,
    },
    bras: {
      // ÉPAULIÈRE À POINTES — UNE SEULE source de vérité (l'os du bras) : les 3 vues montrent
      // la MÊME pièce (coque débordante + pointe VERTICALE + pointe LATÉRALE), gauche/droite
      // et près/loin suivent automatiquement (chaque bras rend la sienne).
      front: `<g stroke-linejoin="round">`
        + `<path d="M0 -7 L0 -15 L3.8 -8 Z" fill="@vet2" stroke="#0c0c12" stroke-width="0.5"/>`
        + `<path d="M-6 -1 L-12 -3.5 L-6.5 3 Z" fill="@vet2" stroke="#0c0c12" stroke-width="0.5"/>`
        + `<path d="M-6.4 -3 Q0 -8 6.4 -3 Q7.6 3.5 5.4 7 Q0 9.6 -5.4 7 Q-7.6 3.5 -6.4 -3 Z" fill="@metal" stroke="#0c0c12" stroke-width="0.9"/>`
        + `<path d="M-5.6 -1.5 Q0 -5 5.6 -1.5" fill="none" stroke="@metalH" stroke-width="0.7" opacity="0.6"/>`
        + `<path d="M-4 7.5 Q0 9.6 4 7.5 L3.6 16 Q0 17.5 -3.6 16 Z" fill="@metalO" stroke="#0c0c12" stroke-width="0.7"/>`
        + `<path d="M-3.8 16 L3.8 16 L3.4 27 Q0 29 -3.4 27 Z" fill="@metal" stroke="#0c0c12" stroke-width="0.8"/>`
        + `<path d="M-3.4 20 L3.4 20 M-3.2 24 L3.2 24" stroke="#0c0c12" stroke-width="0.5" opacity="0.7"/>`
        + `</g>`,
      back: `<g stroke-linejoin="round">`
        + `<path d="M0 -7 L0 -15 L-3.8 -8 Z" fill="@vet2O" stroke="#0c0c12" stroke-width="0.5"/>`
        + `<path d="M6 -1 L12 -3.5 L6.5 3 Z" fill="@vet2O" stroke="#0c0c12" stroke-width="0.5"/>`
        + `<path d="M-6.4 -3 Q0 -8 6.4 -3 Q7.6 3.5 5.4 7 Q0 9.6 -5.4 7 Q-7.6 3.5 -6.4 -3 Z" fill="@metalO" stroke="#0c0c12" stroke-width="0.9"/>`
        + `<path d="M-4 7.5 Q0 9.6 4 7.5 L3.4 27 Q0 29 -3.4 27 Z" fill="@metalO" stroke="#0c0c12" stroke-width="0.8"/>`
        + `</g>`,
      profile: `<g stroke-linejoin="round">`
        + `<path d="M0 -7 L0 -15 L3.6 -8 Z" fill="@vet2" stroke="#0c0c12" stroke-width="0.5"/>`
        + `<path d="M-5.4 -1 L-11 -3.5 L-5.8 3 Z" fill="@vet2" stroke="#0c0c12" stroke-width="0.5"/>`
        + `<path d="M-6 -3 Q0 -8 6 -3 Q7 3.5 5 7 Q0 9.6 -5 7 Q-7 3.5 -6 -3 Z" fill="@metal" stroke="#0c0c12" stroke-width="0.9"/>`
        + `<path d="M-5.2 -1.5 Q0 -5 5.2 -1.5" fill="none" stroke="@metalH" stroke-width="0.7" opacity="0.6"/>`
        + `<path d="M-3.6 7 Q0 9.4 3.6 7 L3.2 27 Q0 29 -3.2 27 Z" fill="@metalO" stroke="#0c0c12" stroke-width="0.8"/>`
        + `</g>`,
    },
    tete: {
      front: `<g stroke-linejoin="round">`
        // cornes latérales montantes (laiton sombre)
        + `<path d="M-9 -8 Q-17 -12 -18 -24 Q-12 -18 -8 -13 Z" fill="@vet2O" stroke="#0c0c12" stroke-width="0.7"/>`
        + `<path d="M9 -8 Q17 -12 18 -24 Q12 -18 8 -13 Z" fill="@vet2O" stroke="#0c0c12" stroke-width="0.7"/>`
        // heaume INTÉGRAL descendant jusqu'au menton (le visage disparaît), fente en T sombre
        + `<path d="M-9.5 -10 Q-10.5 -17.5 0 -18.5 Q10.5 -17.5 9.5 -10 L9.2 5 Q5.5 11.5 0 12 Q-5.5 11.5 -9.2 5 Z" fill="@metal" stroke="#0c0c12" stroke-width="1"/>`
        + `<path d="M-2.1 -7 L2.1 -7 L2.1 -1.5 L4.9 -1.5 L4.9 1.8 L2.1 1.8 L2.1 9 L-2.1 9 L-2.1 1.8 L-4.9 1.8 L-4.9 -1.5 L-2.1 -1.5 Z" fill="#08070c"/>`
        + `<path d="M-8.4 -9 Q0 -12 8.4 -9" fill="none" stroke="@metalH" stroke-width="0.8" opacity="0.6"/>`
        + `<path d="M0 -18.5 L0 -7" stroke="#0c0c12" stroke-width="0.8"/>`
        // camail : jupe de plates sous le heaume (couvre le COU, rendu au-dessus de l'os cou)
        + `<path d="M-8 8 Q0 11.5 8 8 L7 20 Q0 23.5 -7 20 Z" fill="@metalO" stroke="#0c0c12" stroke-width="0.8"/>`
        + `<path d="M-7.4 13 Q0 16 7.4 13" fill="none" stroke="#0c0c12" stroke-width="0.6" opacity="0.7"/>`
        + `</g>`,
      back: `<g stroke-linejoin="round">`
        + `<path d="M-9 -8 Q-17 -12 -18 -24 Q-12 -18 -8 -13 Z" fill="@vet2O" stroke="#0c0c12" stroke-width="0.7"/>`
        + `<path d="M9 -8 Q17 -12 18 -24 Q12 -18 8 -13 Z" fill="@vet2O" stroke="#0c0c12" stroke-width="0.7"/>`
        + `<path d="M-9.5 -10 Q-10.5 -17.5 0 -18.5 Q10.5 -17.5 9.5 -10 L9.2 5 Q5.5 11.5 0 12 Q-5.5 11.5 -9.2 5 Z" fill="@metalO" stroke="#0c0c12" stroke-width="1"/>`
        + `<path d="M0 -17.5 L0 10.5" stroke="#0c0c12" stroke-width="0.9"/>`
        + `<path d="M-8 8 Q0 11.5 8 8 L7 20 Q0 23.5 -7 20 Z" fill="@metalO" stroke="#0c0c12" stroke-width="0.8"/>`
        + `<path d="M-7.4 13 Q0 16 7.4 13" fill="none" stroke="#0c0c12" stroke-width="0.6" opacity="0.7"/>`
        + `</g>`,
      profile: `<g stroke-linejoin="round">`
        // corne = élément LATÉRAL PAIR sans os pair → lateralPair() (lointaine en parallaxe + proche)
        + lateralPair(`<path d="M-4 -9 Q-13 -14 -15 -25 Q-8 -19 -3 -13 Z" fill="@vet2" stroke="#0c0c12" stroke-width="0.7"/>`, { dx: 7, dy: -0.5 })
        + `<path d="M-7.5 -10 Q-8.5 -17.5 1 -18.5 Q10.5 -16.5 10 -7 L9.6 5 Q6.5 11 0 11.5 Q-6.5 10.5 -7.5 3 Z" fill="@metal" stroke="#0c0c12" stroke-width="1"/>`
        + `<path d="M4 -6.5 L9.4 -6.5 L9.4 -2.8 L4 -2.8 Z" fill="#08070c"/>`
        + `<path d="M4.6 2 Q7.4 2.6 9.2 2" stroke="#08070c" stroke-width="1.6" fill="none"/>`
        + `<path d="M-6.4 -9 Q1 -12 8.4 -9" fill="none" stroke="@metalH" stroke-width="0.7" opacity="0.6"/>`
        + `<path d="M-6.5 7 Q1 10.5 8.5 7.5 L7.5 19 Q0.5 22.5 -5.5 19 Z" fill="@metalO" stroke="#0c0c12" stroke-width="0.8"/>`
        + `<path d="M-6 12.5 Q1 15.5 8 13" fill="none" stroke="#0c0c12" stroke-width="0.6" opacity="0.7"/>`
        + `</g>`,
    },
  },
};
