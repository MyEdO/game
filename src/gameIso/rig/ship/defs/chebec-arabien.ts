/**
 * CHÉBEC ARABIEN (MDG, ~40 m, mixte) — corsaire d'Arabie : coque LONGUE et basse à tonture presque
 * plate (jamais un croissant), étrave en quête prolongée d'une GUIBRE pleine (éperon habillé),
 * VOÛTE arrière en surplomb à grille + balustrade de dunette intégrée, sabords d'avirons,
 * trois mâts réels en quête à voiles latines. Réf planche MDG 12 p.098 / MDG 13 p.114 (trait Loup impérial).
 */
import type { ShipArtDef } from '../artkit';
import { gunports, lateenSail, oarBank, pennant, rudder, spar, stay } from '../artkit';

function profile(): string {
  return '<g>'
    + oarBank(-24, 16, 8, -5, 6)
    // Trois MÂTS réels en quête (misaine fortement inclinée vers l'avant), latines pointes vers la proue.
    + spar(-25, -8, -22, -48, 2)
    + spar(-1, -8, 4, -72, 2.6)
    + spar(25, -8, 33, -56, 2.2)
    + lateenSail([-5, -52], [-35, -12], [-15, -9], [3, 5])
    + lateenSail([23, -76], [-15, -14], [9, -9], [4, 7])
    + lateenSail([49, -60], [15, -12], [35, -9], [3, 6])
    + stay(4, -72, 46, -12.6) + stay(33, -56, 56, -14.6) + stay(4, -72, -30, -11)
    + pennant(23, -76, 10) + pennant(49, -60, 8)
    // Safran d'étambot sous la voûte (avant la coque : il passe derrière elle).
    + rudder(-33, -9)
    // COQUE CONSTRUITE : tonture basse presque PLATE, étrave en quête (quille → guibre),
    // étambot incliné portant la voûte — le volume vient du franc-bord fermé, pas d'une banane.
    + '<path d="M-44 -12.6 Q-32 -10 -16 -9.2 Q0 -8.9 16 -9.2 Q32 -10 44 -12.8 L48 -13.6 L44 -0.8 Q0 2.6 -30 0.9 L-40 -11.2 Z" fill="@coque" stroke="@coqueO" stroke-width="1.4"/>'
    + '<path d="M-44 -12.6 Q-32 -10 -16 -9.2 Q0 -8.9 16 -9.2 Q32 -10 44 -12.8 L48 -13.6" fill="none" stroke="@coqueH" stroke-width="1.2"/>'
    // Bordages (virures suivant la tonture) + virure d'accent claire (livrée corsaire).
    + '<path d="M-40 -8.2 Q0 -4.6 43 -9 M-36 -4 Q0 -0.6 42 -4.6" fill="none" stroke="@coqueO" stroke-width="0.8" opacity="0.5"/>'
    + '<path d="M-41 -10.4 Q0 -6.6 44 -11" fill="none" stroke="@coqueH" stroke-width="1.6" opacity="0.9"/>'
    // Sabords d'avirons alignés sur la nage.
    + gunports(-24, 16, 8, -3, 1.8)
    // GUIBRE de proue : éperon PLEIN prolongeant l'étrave (habillé, pas un trait posé).
    + '<path d="M44 -12.8 L48 -13.6 L61 -16.2 L47 -9 L44 -8 Z" fill="@coque" stroke="@coqueO" stroke-width="1"/>'
    + '<path d="M48 -13.4 L60 -15.9" stroke="@coqueH" stroke-width="0.9" opacity="0.8"/>'
    // VOÛTE arrière en surplomb : plateforme + grille + balustrade de dunette intégrée au pavois.
    + '<path d="M-40 -11.2 L-52 -12.8 L-51.2 -15.2 L-39.5 -13.6 Z" fill="@coque" stroke="@coqueO" stroke-width="1"/>'
    + '<path d="M-50 -12.6 l0.3 1.8 m2.5 -1.5 l0.3 1.8 m2.5 -1.5 l0.3 1.8 m2.5 -1.5 l0.3 1.8" stroke="@coqueO" stroke-width="0.7" opacity="0.85"/>'
    + '<path d="M-39 -15.4 L-24 -13.4" stroke="@coqueO" stroke-width="1.1"/>'
    + '<path d="M-37.5 -15 l0 1.9 m3.5 -1.4 l0 1.9 m3.5 -1.4 l0 1.9 m3.5 -1.4 l0 1.9" stroke="@coqueO" stroke-width="0.8" opacity="0.85"/>'
    + '</g>';
}

function front(): string {
  return '<g>'
    // Grand mât au centre, antennes latines en DIAGONALE (la signature du gréement vu de face).
    + spar(0, -10, 1.5, -72, 2.4)
    + spar(-16, -28, 10, -76, 1.7)
    + '<path d="M10 -76 L-16 -28 L-1 -18 Q8 -48 10 -76 Z" fill="@toileDeVoile" stroke="@toileDeVoileO" stroke-width="1"/>'
    + spar(12, -22, -8, -50, 1.4)
    + '<path d="M-8 -50 L12 -22 L2 -15 Q-5 -33 -8 -50 Z" fill="@toileDeVoile" stroke="@toileDeVoileO" stroke-width="1"/>'
    + pennant(1.5, -72, 8)
    // Avirons sortis en éventail de part et d'autre.
    + '<g stroke="@mat" stroke-width="1.2" stroke-linecap="round"><line x1="-9" y1="-6" x2="-17" y2="1"/><line x1="-10" y1="-4" x2="-19" y2="2"/><line x1="9" y1="-6" x2="17" y2="1"/><line x1="10" y1="-4" x2="19" y2="2"/></g>'
    // Muraille ÉTROITE en V doux (coque fine de corsaire), lisse de plat-bord claire.
    + '<path d="M-10.5 -12 Q-11 -4.5 -6 -1 Q0 1.6 6 -1 Q11 -4.5 10.5 -12 Q6 -14.2 0 -14.4 Q-6 -14.2 -10.5 -12 Z" fill="@coque" stroke="@coqueO" stroke-width="1.3"/>'
    + '<path d="M-10.5 -12 Q0 -14.8 10.5 -12" fill="none" stroke="@coqueH" stroke-width="1.1"/>'
    + '<path d="M-9.5 -8 Q0 -10.4 9.5 -8" fill="none" stroke="@coqueO" stroke-width="0.7" opacity="0.5"/>'
    // Étrave CENTRALE montante + guibre pointée sur le spectateur (losange raccourci).
    + '<path d="M0 -14.4 L0 -22.5" stroke="@coque" stroke-width="2.6" stroke-linecap="round"/>'
    + '<path d="M0 -22.5 l-2.2 -2.6 l2.2 -2.6 l2.2 2.6 Z" fill="@coque" stroke="@coqueO" stroke-width="0.8"/>'
    + '</g>';
}

function back(): string {
  return '<g>'
    // Artimon au premier plan (antenne en diagonale inverse), grand mât qui dépasse derrière.
    + spar(0, -10, -1.5, -62, 2.2)
    + spar(14, -26, -9, -66, 1.6)
    + '<path d="M-9 -66 L14 -26 L0 -19 Q-6 -44 -9 -66 Z" fill="@toileDeVoile" stroke="@toileDeVoileO" stroke-width="1"/>'
    + spar(3, -40, 5, -74, 1.8)
    + pennant(-1.5, -62, 8) + pennant(5, -74, 7)
    // Muraille de poupe arrondie, fine.
    + '<path d="M-11.5 -11.5 Q-12 -4.5 -6.5 -1 Q0 1.6 6.5 -1 Q12 -4.5 11.5 -11.5 Q0 -13.6 -11.5 -11.5 Z" fill="@coque" stroke="@coqueO" stroke-width="1.3"/>'
    + '<path d="M-11.5 -8 Q0 -10 11.5 -8" fill="none" stroke="@coqueH" stroke-width="1" opacity="0.9"/>'
    // VOÛTE en surplomb PLUS LARGE que la sole : panneau trapézoïdal + GRILLE croisée.
    + '<path d="M-13 -17.5 L13 -17.5 L11 -11.8 L-11 -11.8 Z" fill="@coque" stroke="@coqueO" stroke-width="1.1"/>'
    + '<path d="M-8 -17 l0.6 4.6 m3.4 -4.8 l0.5 4.8 m3.6 -4.8 l0.4 4.8 m3.6 -4.8 l0.3 4.6 M-10.5 -14.6 L10.5 -14.6" stroke="@coqueO" stroke-width="0.7" opacity="0.8"/>'
    // Balustrade de dunette au-dessus de la voûte.
    + '<path d="M-12 -19.8 L12 -19.8" stroke="@coqueO" stroke-width="1.1"/>'
    + '<path d="M-10 -19.6 l0 2.1 m4 -2.1 l0 2.1 m4 -2.1 l0 2.1 m4 -2.1 l0 2.1 m4 -2.1 l0 2.1" stroke="@coqueO" stroke-width="0.8" opacity="0.85"/>'
    // Safran dans l'axe, sous la voûte.
    + '<path d="M-1.4 -11 L1.4 -11 L1.1 0 L-1.1 0 Z" fill="@coque" stroke="@coqueO" stroke-width="0.9"/>'
    + '</g>';
}

export const hullArt: ShipArtDef = { id: 'chebec-arabien', profile, front, back };
