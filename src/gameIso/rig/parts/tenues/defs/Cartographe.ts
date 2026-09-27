import type { TenueDef } from '../types';
import { BOTTE_CUIR } from '../botte-gabarit';

// Cartographe (AA 02 l.127 / schéma folio 16, l.389) — arpenteuse-dessinatrice : longue ROBE
// ouverte cramoisie (houppelande) à liseré d'or sur robe de dessous crème, manches à crevés
// crème + poignets à ruche, ceinture de cuir + bourse, bandoulière d'étui à CARTES (rouleaux de
// vélin sanglés au flanc), collier de perles bleues + pendentif d'or. Tête nue (chevelure libre),
// pas de couvre-chef → slot `tete` omis (le monocle, accessoire de visage, ne s'ajoute pas sans
// écraser tout le crâne — cf. RENDU).
export const tenue: TenueDef = {
  label: 'Cartographe',
  id: "cartographe",
  palette: {
    vet1: '#9e2f2a', vet1H: '#c04a3e', vet1O: '#641b17',
    vet2: '#e2d3af', vet2H: '#f1e8cf', vet2O: '#b39a6c',
    cuir: '#5e3d22', cuirH: '#8a5f34', cuirO: '#331f0f',
    or: '#c9a23c', orO: '#8a6a1e', orH: '#e6cb72',
    parchemin: '#d9c7a1', parcheminO: '#a9895a', parcheminH: '#efe3c6',
    perle: '#2f4c72', perleH: '#4f7398',
  },
  set: {
    pied: BOTTE_CUIR,
    torse: {
      // FACE — robe rouge ouverte sur gorge nue + corsage crème, liseré d'or, collier bleu +
      // pendentif d'or, bandoulière de cuir, ceinture + bourse, rouleaux de vélin au flanc gauche.
      front: `<g stroke-linejoin="round">`
        + `<path d="M-14 -27 Q0 -32 14 -27 L12 4 L11 36 Q0 40 -11 36 L-12 4 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.8"/>`
        + `<path d="M-11 -20 Q-12 6 -9.5 33" fill="none" stroke="@vet1H" stroke-width="1.4" opacity="0.5"/>`
        + `<path d="M-8.6 -18 Q-9.4 6 -7.6 32" fill="none" stroke="@vet1H" stroke-width="0.6" opacity="0.35"/>`
        + `<path d="M8 -22 Q11 8 9 34 L11 36 Q12 8 12 -24 Z" fill="@vet1O" opacity="0.5"/>`
        + `<path d="M9.4 -20 Q11.2 8 9.6 32" fill="none" stroke="@vet1H" stroke-width="0.7" opacity="0.3"/>`
        // corsage crème (robe de dessous) sous l'ouverture
        + `<path d="M-6 -22 Q0 -23 6 -22 L6.5 16 Q0 18 -6.5 16 Z" fill="@vet2" stroke="@vet2O" stroke-width="0.6"/>`
        + `<path d="M-5 -20 Q0 -21 5 -20 L5 -3 Q0 -1 -5 -3 Z" fill="@vet2H" opacity="0.5"/>`
        // gorge nue (décolleté carré) au-dessus du corsage
        + `<path d="M-5 -24 Q0 -21 5 -24 Q4.6 -18 3.8 -16 Q0 -14.5 -3.8 -16 Q-4.6 -18 -5 -24 Z" fill="@peau" stroke="@peauO" stroke-width="0.4"/>`
        // liseré d'or : bords d'ouverture de la robe + encolure carrée
        + `<path d="M-6 -23 L-6.4 16 M6 -23 L6.4 16" fill="none" stroke="@or" stroke-width="0.9"/>`
        + `<path d="M-6 -23 Q0 -25 6 -23" fill="none" stroke="@orH" stroke-width="0.7"/>`
        // collier de perles bleues + pendentif d'or
        + `<path d="M-4.6 -16.5 Q0 -12 4.6 -16.5" fill="none" stroke="@perle" stroke-width="1.5"/>`
        + `<g fill="@perleH"><circle cx="-3.4" cy="-14.8" r="0.7"/><circle cx="-1.6" cy="-13.3" r="0.7"/><circle cx="0" cy="-12.7" r="0.7"/><circle cx="1.6" cy="-13.3" r="0.7"/><circle cx="3.4" cy="-14.8" r="0.7"/></g>`
        + `<path d="M0 -12.5 L0 -8 M-1.4 -9.6 L0 -6.6 L1.4 -9.6 Z" fill="@or" stroke="@orO" stroke-width="0.4"/>`
        // épaulettes bouffantes à crevés (crevés crème sur rouge, liseré d'or à la base)
        + `<g stroke="@vet1O" stroke-width="0.5"><path d="M-14 -26 Q-8 -30 -6 -24 Q-5 -18 -8 -14 Q-12 -13 -14 -17 Z" fill="@vet1"/><path d="M14 -26 Q8 -30 6 -24 Q5 -18 8 -14 Q12 -13 14 -17 Z" fill="@vet1"/></g>`
        + `<g stroke="@vet2" stroke-width="1.5" fill="none" opacity="0.9"><path d="M-12 -25 Q-11 -19 -12 -15"/><path d="M-9.4 -26 Q-8.6 -19 -9.6 -14.6"/><path d="M12 -25 Q11 -19 12 -15"/><path d="M9.4 -26 Q8.6 -19 9.6 -14.6"/></g>`
        + `<path d="M-13.6 -15.5 Q-9.5 -12.5 -6.6 -15 M13.6 -15.5 Q9.5 -12.5 6.6 -15" fill="none" stroke="@or" stroke-width="0.7"/>`
        // bandoulière de cuir (épaule droite -> hanche gauche), étui à cartes
        + `<path d="M-9 -18 L7.6 20 L5.8 20.9 L-10.4 -17 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.5"/>`
        + `<path d="M-9.4 -17.2 L6.8 20.2" fill="none" stroke="@cuirH" stroke-width="0.5" opacity="0.7"/>`
        // ceinture de cuir à liseré d'or
        + `<path d="M-11.4 15 Q0 18 11.4 15 L11.2 21 Q0 24 -11.2 21 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.6"/>`
        + `<path d="M-11.2 16.4 Q0 19 11.2 16.4 M-11 20 Q0 22.6 11 20" fill="none" stroke="@or" stroke-width="0.6"/>`
        + `<rect x="-2" y="16.4" width="4" height="4.2" rx="0.6" fill="@or" stroke="@orO" stroke-width="0.5"/><circle cx="0" cy="18.5" r="0.9" fill="@orH"/>`
        // bourse de cuir pendue à la ceinture
        + `<path d="M-6 21 Q0 20 5 21 L5.6 30 Q0 33 -6.4 30 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.6"/>`
        + `<path d="M-6 21 Q0 24 5 21 L4.4 25 Q0 27 -5.2 25 Z" fill="@cuirH" stroke="@cuirO" stroke-width="0.5"/>`
        + `<path d="M-1 21.5 Q0 20 1 21.5 L0.6 24 L-0.6 24 Z" fill="@cuirO"/>`
        // étui à cartes : 2 rouleaux de vélin sanglés au flanc gauche, sceau rouge
        + `<g stroke="@parcheminO" stroke-width="0.5"><path d="M-11 10 Q-19 12 -19 18 Q-19 22 -14 22 L-12 20 Q-13 14 -11 10 Z" fill="@parchemin"/><path d="M-12 15 Q-18 16 -18.6 18.6" fill="none" stroke-width="0.4"/><ellipse cx="-18" cy="18" rx="1.6" ry="2.4" fill="@parcheminH"/><path d="M-18 16.4 Q-16.8 18 -18 19.6" fill="none" stroke-width="0.4"/></g>`
        + `<g stroke="@parcheminO" stroke-width="0.5"><path d="M-10 18 Q-18 21 -18 27 Q-18 31 -12.5 31 L-11 28.5 Q-12 23 -10 18 Z" fill="@parchemin"/><ellipse cx="-17" cy="27.2" rx="1.7" ry="2.6" fill="@parcheminH"/><path d="M-17 25.4 Q-15.7 27.2 -17 29" fill="none" stroke-width="0.4"/></g>`
        + `<path d="M-13.6 15 Q-11 18 -13 24" fill="none" stroke="@cuir" stroke-width="1.4"/><circle cx="-12.2" cy="27.6" r="1.5" fill="@vet1" stroke="@vet1O" stroke-width="0.4"/>`
        + `</g>`,
      // DOS — robe rouge fermée, couture centrale, épaulettes, bandoulière + ceinture, rouleaux au flanc.
      back: `<g stroke-linejoin="round">`
        + `<path d="M-14 -27 Q0 -32 14 -27 L12 4 L11 36 Q0 40 -11 36 L-12 4 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.8"/>`
        + `<path d="M0 -27 L0 38" fill="none" stroke="@vet1O" stroke-width="1"/>`
        + `<path d="M-13 -25 Q0 -29 13 -25 L12.5 -19 Q0 -23 -12.5 -19 Z" fill="@vet1H" opacity="0.35"/>`
        + `<g stroke="@vet1O" stroke-width="0.5"><path d="M-14 -26 Q-8 -30 -6 -24 Q-5 -18 -8 -14 Q-12 -13 -14 -17 Z" fill="@vet1"/><path d="M14 -26 Q8 -30 6 -24 Q5 -18 8 -14 Q12 -13 14 -17 Z" fill="@vet1"/></g>`
        + `<g stroke="@vet2" stroke-width="1.3" fill="none" opacity="0.75"><path d="M-11.4 -25 Q-10.6 -19 -11.6 -15"/><path d="M11.4 -25 Q10.6 -19 11.6 -15"/></g>`
        + `<path d="M-9 -18 L8.5 20 L6 21.5 L-11 -16.5 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.5"/>`
        + `<path d="M-11.4 15 Q0 18 11.4 15 L11.2 21 Q0 24 -11.2 21 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.6"/>`
        + `<path d="M-11 18 Q0 20.6 11 18" fill="none" stroke="@or" stroke-width="0.6"/>`
        + `<g stroke="@parcheminO" stroke-width="0.5"><path d="M-10 12 Q-18 14 -18 20 Q-18 24 -13 24 L-11 21.5 Q-12 16 -10 12 Z" fill="@parchemin"/><ellipse cx="-17" cy="20.2" rx="1.6" ry="2.5" fill="@parcheminH"/></g>`
        + `</g>`,
      // PROFIL — buste étroit, robe rouge, bandoulière, ceinture + bourse à l'avant, un rouleau à l'arrière.
      profile: `<g stroke-linejoin="round">`
        + `<path d="M-6 -27 Q3 -31 8 -26 Q9 6 7 36 Q0 40 -6 36 Q-7 6 -6 -27 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.8"/>`
        + `<path d="M4.6 -24 Q6 6 4.6 34" fill="none" stroke="@vet1H" stroke-width="0.8" opacity="0.45"/>`
        + `<path d="M-4 -25 Q1 -27 5 -24 Q5 -16 2 -14 Q-2 -15 -4 -18 Z" fill="@vet2" stroke="@vet2O" stroke-width="0.5"/>`
        + `<g stroke="@vet1O" stroke-width="0.5"><path d="M-6 -26 Q1 -30 5 -24 Q5 -17 1 -14 Q-4 -14 -6 -18 Z" fill="@vet1"/></g>`
        + `<g stroke="@vet2" stroke-width="1.3" fill="none" opacity="0.8"><path d="M-4 -25 Q-3.4 -19 -4.2 -15"/><path d="M-0.4 -26 Q0.2 -19 -0.6 -14.6"/></g>`
        + `<path d="M-3 -17 L6 18 L4 19 L-5 -15.5 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.5"/>`
        + `<path d="M-6 15 Q1 18 7 15 L7 21 Q1 24 -6 21 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.6"/>`
        + `<path d="M-5.6 17.6 Q1 20 6.6 17.6" fill="none" stroke="@or" stroke-width="0.6"/>`
        + `<path d="M0 21 Q4 20.4 6.4 21 L6.8 30 Q3 32.4 -0.4 30 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.6"/><path d="M0 21 Q3.4 23.4 6.4 21 L5.8 25 Q3 26.6 -0.2 25 Z" fill="@cuirH" stroke="@cuirO" stroke-width="0.4"/>`
        + `<g stroke="@parcheminO" stroke-width="0.5"><path d="M-4 12 Q-11 15 -11 21 Q-11 25 -6 25 L-4.6 22 Q-5.6 17 -4 12 Z" fill="@parchemin"/><ellipse cx="-10" cy="21.2" rx="1.5" ry="2.4" fill="@parcheminH"/></g>`
        + `</g>`,
    },
    // JAMBES = jupe longue. Art dessiné pour la jambe GAUCHE ; la droite est MIROITÉE (face/dos) →
    // pan rouge à l'EXTÉRIEUR (x négatif) + jupon crème au CENTRE (x positif jusqu'à ~+11 = axe du
    // corps), liseré d'or à la couture d'ouverture. Les deux copies se rejoignent à l'axe (crème centré).
    jambes: {
      // Chaque moitié est une DEMI-CLOCHE qui traverse l'axe (crème jusqu'à x≈+15) → les deux copies
      // miroitées se recouvrent au centre = jupon crème CONTINU ; pan rouge à l'extérieur ; ourlet
      // bas et large (y52) pour couvrir les pieds (robe qui balaie le sol).
      front: `<g stroke-linejoin="round">`
        + `<path d="M-5 0 Q-7 6 -8 12 Q-14 32 -15 52 L15 52 Q14 30 9 9 Q6 3 5 0 Q0 -2 -5 0 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.8"/>`
        + `<path d="M0.6 3 Q-0.4 30 0.6 52 L15 52 Q14.4 30 9.6 6 Q4 4 0.6 3 Z" fill="@vet2" stroke="@vet2O" stroke-width="0.5"/>`
        + `<path d="M2 4 Q1.4 20 4 40 Q6 48 6 52" fill="none" stroke="@vet2H" stroke-width="0.7" opacity="0.5"/>`
        + `<path d="M0.6 3 Q-0.4 30 0.6 52" fill="none" stroke="@or" stroke-width="0.9"/>`
        + `<path d="M-13 32 Q-13.6 42 -12.6 51 M-8 22 Q-9 38 -8 50 M-3.4 12 Q-4.4 34 -3.6 50" fill="none" stroke="@vet1O" stroke-width="0.6" opacity="0.55"/>`
        + `<path d="M-10.6 26 Q-11.2 40 -10.4 50" fill="none" stroke="@vet1H" stroke-width="1" opacity="0.4"/>`
        + `<path d="M5 12 Q4.4 32 5 50 M9.6 16 Q9.8 34 9.8 50 M13.4 28 Q13.4 40 13.4 50" fill="none" stroke="@vet2O" stroke-width="0.5" opacity="0.5"/>`
        + `<path d="M-15 47 Q0 44 15 47 L15 52 L-15 52 Z" fill="@vet1O" opacity="0.28"/>`
        + `</g>`,
      // DOS : robe fermée = cloche ROUGE pleine (le jupon ne s'ouvre qu'à l'avant), couture au centre.
      back: `<g stroke-linejoin="round">`
        + `<path d="M-5 0 Q-7 6 -8 12 Q-14 32 -15 52 L15 52 Q14 30 9 9 Q6 3 5 0 Q0 -2 -5 0 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.8"/>`
        + `<path d="M0.6 3 Q-0.2 30 0.6 52" fill="none" stroke="@vet1O" stroke-width="0.9" opacity="0.55"/>`
        + `<path d="M-13 32 Q-13.6 42 -12.6 51 M-8 22 Q-9 38 -8 50 M-3.4 12 Q-4.4 34 -3.6 50 M6 14 Q6.4 34 6.4 50 M11 24 Q11.2 40 11.2 51" fill="none" stroke="@vet1O" stroke-width="0.6" opacity="0.5"/>`
        + `<path d="M-15 47 Q0 44 15 47 L15 52 L-15 52 Z" fill="@vet1O" opacity="0.3"/>`
        + `</g>`,
      // PROFIL : non miroité — jupe cloche ROUGE large (les deux jambes se recouvrent en une masse),
      // jupon crème réduit à une fente à l'AVANT (+x) pour ne pas lire « pantalon » en pas de marche.
      profile: `<g stroke-linejoin="round">`
        + `<path d="M-8 0 Q-11 26 -10 52 L11 52 Q12 26 6 0 Q0 -2 -8 0 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.8"/>`
        + `<path d="M4.6 4 Q4.8 28 5.4 52 L11 52 Q12 26 6.6 3 Q5 2 4.6 4 Z" fill="@vet2" stroke="@vet2O" stroke-width="0.5"/>`
        + `<path d="M4.6 4 Q4.8 28 5.4 52" fill="none" stroke="@or" stroke-width="0.8"/>`
        + `<path d="M-7 16 Q-8.4 38 -7 51 M-2.6 10 Q-3.6 34 -2.6 51 M2 8 Q1.2 32 2 50" fill="none" stroke="@vet1O" stroke-width="0.6" opacity="0.5"/>`
        + `<path d="M-4.6 20 Q-5.6 38 -4.6 50" fill="none" stroke="@vet1H" stroke-width="0.9" opacity="0.35"/>`
        + `<path d="M8.4 16 Q8.6 34 8.6 50" fill="none" stroke="@vet2O" stroke-width="0.5" opacity="0.5"/>`
        + `<path d="M-10 47 Q0 44 11 47 L11 52 L-10 52 Z" fill="@vet1O" opacity="0.28"/>`
        + `</g>`,
    },
    // BRAS = manche à crevés (dessiné pour le bras GAUCHE, droit miroité) : épaulette bouffante à
    // crevés crème sur rouge + liseré d'or, avant-bras rouge, poignet à ruche crème.
    bras: {
      front: `<g stroke-linejoin="round">`
        + `<path d="M-6 -2 Q-7.4 3 -6 9 Q0 12 6 9 Q7.4 3 6 -2 Q0 -5 -6 -2 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.7"/>`
        + `<g stroke="@vet2" stroke-width="1.6" fill="none" opacity="0.9"><path d="M-3.6 -3 Q-4 3 -3.6 9"/><path d="M0 -4 L0 11"/><path d="M3.6 -3 Q4 3 3.6 9"/></g>`
        + `<path d="M-6 9 Q0 11.5 6 9" fill="none" stroke="@or" stroke-width="0.8"/>`
        + `<path d="M-4.6 10 Q-5.2 18 -4 25 Q0 27 4 25 Q5.2 18 4.6 10 Q0 8 -4.6 10 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.7"/>`
        + `<path d="M-2.4 12 Q-3 18 -2.4 24 M2.4 12 Q3 18 2.4 24" fill="none" stroke="@vet1O" stroke-width="0.5" opacity="0.55"/>`
        + `<path d="M-4 23.5 Q0 26 4 23.5 L3.6 30 Q0 31.6 -3.6 30 Z" fill="@vet2H" stroke="@vet2O" stroke-width="0.6"/>`
        + `<path d="M-3.6 26 Q0 28 3.6 26" fill="none" stroke="@vet2O" stroke-width="0.5" opacity="0.6"/>`
        + `</g>`,
      back: `<g stroke-linejoin="round">`
        + `<path d="M-6 -2 Q-7.4 3 -6 9 Q0 12 6 9 Q7.4 3 6 -2 Q0 -5 -6 -2 Z" fill="@vet1O" stroke="@vet1O" stroke-width="0.7"/>`
        + `<g stroke="@vet1" stroke-width="1" fill="none" opacity="0.5"><path d="M-3.6 -3 Q-4 3 -3.6 9"/><path d="M3.6 -3 Q4 3 3.6 9"/></g>`
        + `<path d="M-4.6 10 Q-5.2 18 -4 25 Q0 27 4 25 Q5.2 18 4.6 10 Q0 8 -4.6 10 Z" fill="@vet1O" stroke="@vet1O" stroke-width="0.7"/>`
        + `<path d="M0 11 Q0 18 0 24" fill="none" stroke="@vet1" stroke-width="0.5" opacity="0.4"/>`
        + `<path d="M-4 23.5 Q0 26 4 23.5 L3.6 30 Q0 31.6 -3.6 30 Z" fill="@vet2" stroke="@vet2O" stroke-width="0.6"/>`
        + `</g>`,
      profile: `<g stroke-linejoin="round">`
        + `<path d="M-5 -2 Q-6.2 3 -5 9 Q0 11.5 5 9 Q6.2 3 5 -2 Q0 -5 -5 -2 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.7"/>`
        + `<g stroke="@vet2" stroke-width="1.4" fill="none" opacity="0.85"><path d="M-2.6 -3 Q-3 3 -2.6 9"/><path d="M1 -4 Q0.6 3 1 10"/></g>`
        + `<path d="M-5 9 Q0 11 5 9" fill="none" stroke="@or" stroke-width="0.7"/>`
        + `<path d="M-4 10 Q-4.6 18 -3.6 25 Q0 27 3.6 25 Q4.6 18 4 10 Q0 8 -4 10 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.7"/>`
        + `<path d="M0 12 Q-0.4 18 0 24" fill="none" stroke="@vet1O" stroke-width="0.5" opacity="0.5"/>`
        + `<path d="M-3.6 23.5 Q0 26 3.6 23.5 L3.2 30 Q0 31.6 -3.2 30 Z" fill="@vet2H" stroke="@vet2O" stroke-width="0.6"/>`
        + `</g>`,
    },
  },
};
