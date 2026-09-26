/**
 * BOUTRE D'INJA (MDG 12, ~25 m, voile) — dhow des mers du Sud : étrave RECTILIGNE très rakée
 * (l'élancement domine la silhouette), tonture creuse remontant en dunette arrière à tableau
 * balustré, UNE immense antenne latine en deux espars amarrés sur mât en quête avant, safran
 * d'étambot à barre franche. 3 vues : profil + proue + poupe.
 */
import type { ShipArtDef } from '../artkit';
import { lateenSail, pennant, spar, stay } from '../artkit';

function profile(): string {
  return '<g>'
    // Safran d'étambot PROFOND (plonge sous la flottaison) + barre franche remontant sur la dunette.
    + '<path d="M-31 -16 L-36.5 -15 L-35 1.2 L-30.4 0.4 Z" fill="@coque" stroke="@coqueO" stroke-width="1"/>'
    + spar(-31, -17, -22, -21, 1.6)
    // Mât unique en quête AVANT + emplanture calée au pont.
    + spar(2, -9, 11, -72, 2.6)
    + '<path d="M-1 -8.2 L5.5 -7.6 L4.6 -11.4 L0 -11.8 Z" fill="@mat" stroke="@matO" stroke-width="0.8"/>'
    // Immense voile latine : antenne du point d'amure (bas arrière) à la tête (haute sur l'avant).
    + lateenSail([38, -82], [-27, -27], [16, -9.6], [6, 7])
    // Antenne en DEUX espars : surliures d'amarrage en travers de la verge.
    + '<path d="M10.5 -62.5 l3.4 3.2 M-6 -48.5 l3.4 3.2" stroke="@matO" stroke-width="1.1"/>'
    // Manœuvres : drisse en tête de mât, haubans vers la dunette, étai de proue, écoute du point d’écoute.
    + stay(11, -72, 20, -67)
    + stay(11, -72, -20, -19) + stay(11, -72, -14, -15.5)
    + stay(11, -72, 33, -19.6)
    + stay(16, -9.6, -19, -17)
    + pennant(38, -82, 9)
    // Coque : tonture creuse, étrave RECTILIGNE rakée (le grand élancement du boutre),
    // étambot en léger surplomb portant la dunette.
    + '<path d="M-31 -23 Q-18 -11 2 -9.4 Q16 -9.8 24 -12 L37 -22 L26 -0.8 Q0 2.6 -26 -0.6 Z" fill="@coque" stroke="@coqueO" stroke-width="1.4"/>'
    + '<path d="M-31 -23 Q-18 -11 2 -9.4 Q16 -9.8 24 -12 L37 -22" fill="none" stroke="@coqueH" stroke-width="1.3"/>'
    // Guibre : tête d'étrave prolongée en pointe (élancement porté au-delà du plat-bord).
    + '<path d="M37 -22 L40.6 -24.6" stroke="@coque" stroke-width="2.4" stroke-linecap="round"/>'
    // Bordages : deux virures suivant la tonture, convergeant vers l'étrave.
    + '<path d="M-29 -16 Q0 -5.6 30 -14.5 M-27.5 -9.5 Q0 -1.4 27.5 -8" fill="none" stroke="@coqueO" stroke-width="0.7" opacity="0.5"/>'
    // Dunette : lisse de couronnement balustrée (chandeliers) + ligne de pont.
    + '<path d="M-29.5 -23 l0 -2.6 M-26 -21.6 l0 -2.6 M-22.5 -20.2 l0 -2.6" stroke="@coqueO" stroke-width="1"/>'
    + '<path d="M-31 -25.6 L-21 -22.6" fill="none" stroke="@coque" stroke-width="1.6" stroke-linecap="round"/>'
    + '<path d="M-29.5 -18 L-20 -15.8" fill="none" stroke="@coqueO" stroke-width="0.8" opacity="0.5"/>'
    + '</g>';
}

function front(): string {
  return '<g>'
    // Coque en amande ÉTROITE, l'étrave rakée culmine au-dessus du plat-bord (tête pointue centrale).
    + '<path d="M0 -22 Q5.5 -17 7.5 -10 Q8.6 -4 6.5 -1.5 Q0 1.8 -6.5 -1.5 Q-8.6 -4 -7.5 -10 Q-5.5 -17 0 -22 Z" fill="@coque" stroke="@coqueO" stroke-width="1.4"/>'
    // Taillant de l'étrave (arête centrale) + plat-bord vu par-dessus l'épaule de la proue.
    + '<path d="M0 -22 L0 -1.8" stroke="@coqueO" stroke-width="1" opacity="0.7"/>'
    + '<path d="M-7 -8.5 Q0 -12.5 7 -8.5" fill="none" stroke="@coqueH" stroke-width="1.2"/>'
    // Virures convergeant au taillant.
    + '<path d="M-6.9 -4.5 Q0 -7.6 6.9 -4.5" fill="none" stroke="@coqueO" stroke-width="0.7" opacity="0.5"/>'
    // Mât (en quête vers le spectateur → quasi vertical) + antenne foreshortée en travers de la tête.
    + spar(0, -11, 0, -70, 2.4)
    + spar(-4, -70, 4, -79, 1.8)
    // Latine bordée : le ventre déborde d'UN côté (bâbord du spectateur).
    + '<path d="M3 -78 Q26 -52 12 -12 L2 -12 Q1 -45 3 -78 Z" fill="@toileDeVoile" stroke="@toileDeVoileO" stroke-width="1"/>'
    + '<path d="M6 -66 Q16 -46 9.5 -16" fill="none" stroke="@toileDeVoileO" stroke-width="0.7" opacity="0.4"/>'
    + stay(0, -70, -7, -9) + stay(0, -70, 7, -9)
    + pennant(3, -79, 7)
    + '</g>';
}

function back(): string {
  return '<g>'
    // Tête de safran sous le tableau.
    + '<path d="M-1.8 -3 L1.8 -3 L1.4 1.5 L-1.4 1.5 Z" fill="@coque" stroke="@coqueO" stroke-width="0.9"/>'
    // TABLEAU arrière du boutre : panneau évasé vers le haut (surplomb de dunette).
    + '<path d="M-8.5 -5 L-10.5 -20 L10.5 -20 L8.5 -5 Q0 -1.5 -8.5 -5 Z" fill="@coque" stroke="@coqueO" stroke-width="1.4"/>'
    // Moulures sculptées + deux fenêtres de dunette.
    + '<path d="M-9.8 -16.2 L9.8 -16.2 M-9.2 -11.5 L9.2 -11.5" stroke="@coqueO" stroke-width="0.8" opacity="0.55"/>'
    + '<path d="M-5 -13.8 l2.6 0 M2.4 -13.8 l2.6 0" stroke="@toileDeVoileH" stroke-width="1.6"/>'
    // Lisse de couronnement balustrée (chandeliers), comme au profil.
    + '<path d="M-9 -20 l0 -2.4 M-4.5 -20 l0 -2.4 M0 -20 l0 -2.4 M4.5 -20 l0 -2.4 M9 -20 l0 -2.4" stroke="@coqueO" stroke-width="1"/>'
    + '<path d="M-10 -22.4 L10 -22.4" stroke="@coque" stroke-width="1.5" stroke-linecap="round"/>'
    // Mât en quête qui FUIT vers l'avant (raccourci) + antenne foreshortée.
    + spar(0, -20, 0, -64, 2.2)
    + spar(4, -64, -3, -73, 1.8)
    // Latine vue de poupe : le ventre déborde de l'AUTRE côté.
    + '<path d="M-2 -72 Q-24 -48 -11 -22 L-1 -22 Q-3 -47 -2 -72 Z" fill="@toileDeVoile" stroke="@toileDeVoileO" stroke-width="1"/>'
    + '<path d="M-5 -62 Q-15 -46 -9 -25" fill="none" stroke="@toileDeVoileO" stroke-width="0.7" opacity="0.4"/>'
    + stay(0, -64, -9, -21) + stay(0, -64, 9, -21)
    + pennant(-2, -73, 7)
    + '</g>';
}

export const hullArt: ShipArtDef = { id: 'boutre-d-inja', profile, front, back };
