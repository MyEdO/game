/**
 * CARAQUE (MDG, ~35 m, voile) — hauturier marchand : gaillard d'AVANT haut en SURPLOMB de l'étrave,
 * château arrière ÉTAGÉ (demi-pont + dunette), taille basse entre les deux, étrave élancée et
 * étambot portant le safran ; trois mâts (grand carré à hune, misaine, artimon LATIN) + beaupré.
 * La coque et ses châteaux forment UNE silhouette continue (les murailles montent dans les
 * châteaux — jamais des boîtes posées sur un croissant). Réf : MDG 13 p.114 (profil), p.105 (plans
 * de pont : maître-bau étroit, éperon d'étrave).
 */
import type { ShipArtDef } from '../artkit';
import { flag, hune, lateenSail, pennant, rudder, spar, squareSail, stay } from '../artkit';

function profile(): string {
  return '<g>'
    + rudder(-35, -16)
    // Gréement (pieds masqués par la coque dessinée ensuite) : artimon LATIN sur le demi-pont,
    // grand mât carré à hune dans la taille, misaine plantée dans le gaillard d'avant, beaupré.
    + spar(-14, -29, -14, -76, 2.2)
    + lateenSail([-4, -72], [-32, -44], [-7, -33], [3, 5])
    + spar(-2, -14, -2, -100, 2.8)
    + squareSail(-2, -90, 44, 17, { seams: 2 }) + hune(-2, -96)
    + spar(31, -32, 31, -78, 2.2)
    + squareSail(31, -72, 26, 11, { seams: 1 })
    + spar(40, -26, 58, -37, 2)
    + stay(-2, -100, 31, -33) + stay(-2, -100, -24, -38) + stay(31, -78, 54, -35) + stay(-14, -76, -38, -41)
    + pennant(-2, -100, 11) + pennant(31, -78, 8) + pennant(-14, -76, 7)
    // COQUE INTÉGRÉE en une silhouette : dunette → étambot → quille → étrave élancée →
    // gaillard d'avant en surplomb → taille basse → demi-pont → dunette.
    + '<path d="M-41 -40 L-37 -24 L-35 -1 Q-18 3.2 0 3.4 Q20 3 35 -1 Q41 -7 45 -17 L47 -25 L53 -31 L51 -37 L31 -33.5 L27 -19 Q12 -15 -2 -15.5 L-4 -27 L-23 -29 L-22 -38.5 Z" fill="@coque" stroke="@coqueO" stroke-width="1.5"/>'
    // Lisse de plat-bord de la taille (le creux entre les châteaux).
    + '<path d="M27 -19 Q12 -15 -2 -15.5" fill="none" stroke="@coqueH" stroke-width="1.3"/>'
    // Deux préceintes filant sur TOUTE la longueur (elles remontent aux extrémités — la tonture).
    + '<path d="M-36 -18 Q0 -8.5 42 -15 M-35.5 -10 Q0 -3 38 -8" fill="none" stroke="@coqueH" stroke-width="1.1" opacity="0.8"/>'
    // Bordages sous la flottaison visuelle.
    + '<path d="M-34 -4 Q0 1.2 34 -4" fill="none" stroke="@coqueO" stroke-width="0.8" opacity="0.45"/>'
    // Gaillard d'AVANT : sous-face du surplomb, créneaux, jambettes sous la muraille.
    + '<path d="M30 -32 L49 -35.5" stroke="@coqueO" stroke-width="0.8" opacity="0.5"/>'
    + '<path d="M35 -34.2 l0 -2.2 M41 -35.2 l0 -2.2 M47 -36.3 l0 -2.2" stroke="@coqueO" stroke-width="1.1"/>'
    + '<path d="M46 -25.5 L50 -30.5" stroke="@coqueO" stroke-width="0.9" opacity="0.6"/>'
    // Château ARRIÈRE : rambarde du demi-pont, pont de la dunette, rang de fenêtres.
    + '<path d="M-8 -27.4 l0 -2 M-13 -27.9 l0 -2 M-18 -28.4 l0 -2" stroke="@coqueO" stroke-width="1.1"/>'
    + '<path d="M-5 -26.5 L-22 -28.5" stroke="@coqueO" stroke-width="0.8" opacity="0.5"/>'
    + '<path d="M-27 -33.5 l3 0 m4 0 l3 0" stroke="@toileDeVoileH" stroke-width="1.5"/>'
    + '<path d="M-26 -37.8 l0 -2 M-31 -38.2 l0 -2 M-36 -38.6 l0 -2" stroke="@coqueO" stroke-width="1.1"/>'
    + flag(-38, -42, 7, 4.5)
    + '</g>';
}

function front(): string {
  // PROUE : maître-bau étroit (~1/4 de la longueur), étrave centrale montant au gaillard,
  // gaillard légèrement en surplomb (plus large que le plat-bord), beaupré pointant vers
  // le spectateur (raccourci), grande voile face-on derrière la misaine.
  return '<g>'
    // Grand mât (le plus haut, derrière) + grande voile gonflée VERS le spectateur.
    + spar(0, -30, 0, -100, 2.6) + hune(0, -96) + pennant(0, -100, 10)
    + spar(-21, -88, 21, -88, 1.8)
    + '<path d="M-19 -87 Q-21 -66 -19 -46 Q0 -40 19 -46 Q21 -66 19 -87 Q0 -83 -19 -87 Z" fill="@toileDeVoile" stroke="@toileDeVoileO" stroke-width="1"/>'
    + '<path d="M-6.5 -85 Q-7 -66 -6.5 -47 M6.5 -85 Q7 -66 6.5 -47" fill="none" stroke="@toileDeVoileO" stroke-width="0.7" opacity="0.4"/>'
    // Misaine devant, plus basse.
    + spar(0, -33, 0, -78, 2.2) + pennant(0, -78, 7)
    + spar(-13, -70, 13, -70, 1.6)
    + '<path d="M-12 -69 Q-13.5 -57 -12 -45 Q0 -41 12 -45 Q13.5 -57 12 -69 Q0 -66 -12 -69 Z" fill="@toileDeVoile" stroke="@toileDeVoileO" stroke-width="1"/>'
    // Haubans vers les porte-haubans.
    + stay(0, -100, -11, -24) + stay(0, -100, 11, -24)
    // Coque vue de proue : muraille ÉVASÉE, étrave centrale, préceintes en chevrons emboîtés.
    + '<path d="M-11.5 -24 Q-10 -7 0 1.5 Q10 -7 11.5 -24 Q0 -28.5 -11.5 -24 Z" fill="@coque" stroke="@coqueO" stroke-width="1.5"/>'
    + '<path d="M-10.4 -18 Q0 -8 10.4 -18 M-8.8 -11 Q0 -2.5 8.8 -11" fill="none" stroke="@coqueH" stroke-width="1" opacity="0.8"/>'
    + '<path d="M0 1.5 L0 -27" stroke="@coqueH" stroke-width="1.6"/>'
    // Gaillard d'avant EN SURPLOMB (déborde la muraille), créneaux, ligne de pont.
    + '<path d="M-13 -24.5 Q0 -29.5 13 -24.5 L13.8 -36 L-13.8 -36 Z" fill="@coque" stroke="@coqueO" stroke-width="1.2"/>'
    + '<path d="M-12.9 -30 L12.9 -30" stroke="@coqueO" stroke-width="0.8" opacity="0.5"/>'
    + '<path d="M-10 -36 l0 -2.2 M-5 -36 l0 -2.2 M0 -36 l0 -2.2 M5 -36 l0 -2.2 M10 -36 l0 -2.2" stroke="@coqueO" stroke-width="1.1"/>'
    // Beaupré en raccourci, pointé haut vers le spectateur.
    + '<path d="M0 -31 L3 -49" stroke="@mat" stroke-width="3.4" stroke-linecap="round"/>'
    + '<circle cx="3" cy="-49" r="1.8" fill="@matO"/>'
    + '</g>';
}

function back(): string {
  // POUPE : château arrière haut à léger fruit (rétréci en montant), rang de fenêtres de
  // la dunette, safran d'étambot dans l'axe avec ses ferrures, antenne latine de l'artimon
  // barrant la vue, grande voile derrière.
  return '<g>'
    // Grand mât + grande voile vue de dos (le ventre fuit le spectateur).
    + spar(0, -28, 0, -100, 2.6) + hune(0, -96) + pennant(0, -100, 10)
    + spar(-21, -88, 21, -88, 1.8)
    + '<path d="M-19 -87 Q-20 -66 -18 -48 Q0 -44 18 -48 Q20 -66 19 -87 Q0 -84 -19 -87 Z" fill="@toileDeVoile" stroke="@toileDeVoileO" stroke-width="1"/>'
    + '<path d="M-6.5 -85 Q-7 -66 -6.5 -49 M6.5 -85 Q7 -66 6.5 -49" fill="none" stroke="@toileDeVoileO" stroke-width="0.7" opacity="0.4"/>'
    // Artimon au plus près : antenne latine en diagonale + voile triangulaire.
    + spar(0, -32, 0, -74, 2.2) + pennant(0, -74, 7)
    + spar(-8, -72, 10, -40, 1.8)
    + '<path d="M-8 -70 L9 -42 L-9 -44 Q-11 -58 -8 -70 Z" fill="@toileDeVoile" stroke="@toileDeVoileO" stroke-width="1"/>'
    + stay(0, -100, -11, -22) + stay(0, -100, 11, -22)
    // Coque vue de poupe + SAFRAN d'étambot dans l'axe (ferrures horizontales).
    + '<path d="M-12 -22 Q-10.5 -7 0 1.5 Q10.5 -7 12 -22 Q0 -26.5 -12 -22 Z" fill="@coque" stroke="@coqueO" stroke-width="1.5"/>'
    + '<path d="M-10.6 -16 Q0 -7 10.6 -16 M-9 -9.5 Q0 -1.5 9 -9.5" fill="none" stroke="@coqueH" stroke-width="1" opacity="0.8"/>'
    + '<path d="M0 1.5 L0 -24" stroke="@coqueO" stroke-width="3.2"/>'
    + '<path d="M-1.8 -6 l3.6 0 M-1.8 -14 l3.6 0" stroke="@matO" stroke-width="1"/>'
    // Château arrière à FRUIT (rétréci vers le haut), fenêtres de dunette, créneaux, pavillon.
    + '<path d="M-11.5 -22.5 Q0 -27 11.5 -22.5 L9.5 -42 L-9.5 -42 Z" fill="@coque" stroke="@coqueO" stroke-width="1.2"/>'
    + '<path d="M-10.4 -31 L10.4 -31" stroke="@coqueO" stroke-width="0.8" opacity="0.5"/>'
    + '<path d="M-6.5 -35.5 l3.2 0 m3.4 0 l3.2 0" stroke="@toileDeVoileH" stroke-width="1.6"/>'
    + '<path d="M-7 -42 l0 -2.2 M-2.3 -42 l0 -2.2 M2.3 -42 l0 -2.2 M7 -42 l0 -2.2" stroke="@coqueO" stroke-width="1.1"/>'
    + flag(3, -44, 7, 4.5)
    + '</g>';
}

export const hullArt: ShipArtDef = { id: 'caraque', front, profile, back };
