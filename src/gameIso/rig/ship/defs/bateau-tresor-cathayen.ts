/**
 * BATEAU-TRÉSOR CATHAYEN (MDG, ~130 m, voile) — jonque colossale : quatre voiles LATTÉES en
 * éventail, poupe-château ÉTAGÉE taillée dans la coque et couronnée de toits-pagodes, voûte
 * arrière en surplomb, étrave-tableau évasée à l'ŒIL peint, safran de jonque profond dans l'axe.
 * Le géant absolu de la toise navale.
 */
import type { ShipArtDef } from '../artkit';
import { junkSail, pennant, spar, stay } from '../artkit';

/** Toit de pagode à arêtes retroussées. */
const pagodaRoof = (cx: number, y: number, hw: number): string =>
  `<path d="M${cx - hw} ${y} Q${cx - hw + 2} ${y - 3.4} ${cx - hw - 2.6} ${y - 5.4} L${cx} ${y - 4.6} L${cx + hw + 2.6} ${y - 5.4} Q${cx + hw - 2} ${y - 3.4} ${cx + hw} ${y} Z" fill="@pavillon" stroke="@coqueO" stroke-width="0.9"/>`;

function profile(): string {
  return '<g>'
    // Safran de jonque PROFOND, suspendu sous la voûte arrière.
    + '<path d="M-45 -13 L-54 -11.5 L-51.6 4.5 L-44.6 -1 Z" fill="@coque" stroke="@coqueO" stroke-width="1"/>'
    // Quatre mâts à voiles lattées en éventail (le grand mât au centre-arrière, l'étagement cathayen).
    + spar(-40, -45, -40, -78, 2.2) + junkSail(-40, -74, 26, 11, 6, 3)
    + spar(-13, -18, -13, -96, 2.8) + junkSail(-13, -90, 48, 17, 9, 5)
    + spar(15, -17, 15, -88, 2.6) + junkSail(15, -82, 42, 15, 8, 5)
    + spar(39, -21, 39, -58, 2.2) + junkSail(39, -54, 24, 10, 6, 3)
    + stay(-13, -96, -41, -47) + stay(15, -88, 44, -27) + stay(-13, -96, 16, -24)
    + pennant(-13, -96, 12) + pennant(15, -88, 10) + pennant(-40, -78, 8) + pennant(39, -58, 8)
    // COQUE-CHÂTEAU d'un seul tenant : voûte arrière en surplomb, poupe étagée en DEUX ponts
    // taillés dans la muraille, tonture creusée au milieu, étrave-tableau évasée montant en pointe.
    + '<path d="M-53 -47 L-36 -45 L-35 -35 L-20 -33 L-19 -24 Q0 -17.5 22 -19.5 Q42 -22 50 -30 L57 -36 L48 -2 Q0 3.6 -44 -1.6 Q-52 -22 -53 -47 Z" fill="@coque" stroke="@coqueO" stroke-width="1.6"/>'
    // Livet en surbrillance, du pied du château à la pointe d'étrave.
    + '<path d="M-19 -24 Q0 -17.5 22 -19.5 Q42 -22 50 -30 L57 -36" fill="none" stroke="@coqueH" stroke-width="1.4"/>'
    // Préceintes courant sur TOUTE la longueur (elles remontent dans la voûte et dans l'étrave).
    + '<path d="M-51 -36 Q0 -12 54 -30 M-47 -24 Q0 -5 49 -17" fill="none" stroke="@coqueO" stroke-width="0.9" opacity="0.5"/>'
    // Cloisons étanches (construction cathayenne) : coutures verticales du bordé.
    + '<path d="M-30 -17 L-30 -6 M-8 -14 L-8 -3 M14 -14.5 L14 -3.5 M34 -17 L34 -6.5" stroke="@coqueO" stroke-width="0.8" opacity="0.4"/>'
    // ŒIL peint de l'étrave (tradition cathayenne).
    + '<circle cx="49.5" cy="-24" r="2.8" fill="@toileDeVoile" stroke="@coqueO" stroke-width="0.9"/>'
    + '<circle cx="50.3" cy="-24" r="1.2" fill="@matO"/>'
    // Toits-PAGODES couronnant les deux étages du château (jamais une boîte posée : les murs
    // sont la muraille elle-même) + galeries de fenêtres percées dans chaque étage.
    + pagodaRoof(-27.5, -34, 7.5)
    + pagodaRoof(-44.5, -46, 8.5)
    + '<path d="M-33 -29 l3.5 0 m4.5 0 l3.5 0 M-50.5 -40.5 l3.5 0 m4 0 l3.5 0" stroke="@toileDeVoileH" stroke-width="1.6"/>'
    + '</g>';
}

function front(): string {
  return '<g>'
    // Grand mât (centre) et misaine décalée : voiles lattées vues de CHANT (lames étroites à lattes).
    + spar(-3, -28, -3, -96, 2.6)
    + '<path d="M-6.2 -90 L0.2 -90 L1.2 -44 L-7.2 -44 Z" fill="@toileDeVoile" stroke="@toileDeVoileO" stroke-width="0.9"/>'
    + '<path d="M-6.4 -80 l6.8 -0.4 M-6.6 -68 l7.2 -0.4 M-6.8 -56 l7.6 -0.4" stroke="@matO" stroke-width="0.9" opacity="0.7"/>'
    + pennant(-3, -96, 10)
    + spar(5, -30, 5, -70, 2.2)
    + '<path d="M2.4 -66 L7.6 -66 L8.4 -36 L1.6 -36 Z" fill="@toileDeVoile" stroke="@toileDeVoileO" stroke-width="0.9"/>'
    + '<path d="M2.2 -58 l6 -0.3 M2 -48 l6.6 -0.3" stroke="@matO" stroke-width="0.9" opacity="0.7"/>'
    + pennant(5, -70, 8)
    // ÉTRAVE-TABLEAU de jonque : muraille qui s'ÉVASE en montant, préceintes horizontales.
    + '<path d="M-24 -27 Q0 -31 24 -27 L14 0.5 Q0 3 -14 0.5 Z" fill="@coque" stroke="@coqueO" stroke-width="1.5"/>'
    + '<path d="M-24 -27 Q0 -31 24 -27" fill="none" stroke="@coqueH" stroke-width="1.3"/>'
    + '<path d="M-21 -18 Q0 -22.5 21 -18 M-17.5 -9 Q0 -13 17.5 -9" fill="none" stroke="@coqueO" stroke-width="0.9" opacity="0.5"/>'
    // Massif d'étrave central montant en pointe au-dessus du pavois.
    + '<path d="M-2 -35 L2 -35 L2.8 -3 L-2.8 -3 Z" fill="@coque" stroke="@coqueO" stroke-width="1"/>'
    // Les DEUX yeux peints, de part et d'autre de l'étrave.
    + '<circle cx="-14" cy="-20.5" r="2.6" fill="@toileDeVoile" stroke="@coqueO" stroke-width="0.9"/><circle cx="-14" cy="-21.3" r="1.1" fill="@matO"/>'
    + '<circle cx="14" cy="-20.5" r="2.6" fill="@toileDeVoile" stroke="@coqueO" stroke-width="0.9"/><circle cx="14" cy="-21.3" r="1.1" fill="@matO"/>'
    + '</g>';
}

function back(): string {
  return '<g>'
    // Grand mât dépassant des toits + flamme.
    + spar(0, -52, 0, -96, 2.4) + pennant(0, -96, 10)
    // Étage HAUT du château (en retrait), galerie de fenêtres, toit-pagode.
    + '<path d="M-13 -36 L-14.5 -51 L14.5 -51 L13 -36 Z" fill="@coque" stroke="@coqueO" stroke-width="1.1"/>'
    + '<path d="M-10 -46 l4 0 M-2 -46 l4 0 M6 -46 l4 0" stroke="@toileDeVoileH" stroke-width="1.6"/>'
    + pagodaRoof(0, -51, 14.5)
    // Étage BAS, plus large, dans le prolongement direct du tableau, toit-pagode débordant.
    + '<path d="M-20 -23 L-22 -38 L22 -38 L20 -23 Z" fill="@coque" stroke="@coqueO" stroke-width="1.2"/>'
    + '<path d="M-17 -32 l3.5 0 M-9 -32 l3.5 0 M-1 -32 l3.5 0 M7 -32 l3.5 0 M14 -32 l3.5 0" stroke="@toileDeVoileH" stroke-width="1.6"/>'
    + pagodaRoof(0, -38, 22)
    // SAFRAN de jonque profond dans l'axe, plongeant sous la voûte.
    + '<path d="M-3 -6 L3 -6 L2.2 7 L-2.2 7 Z" fill="@coque" stroke="@coqueO" stroke-width="1"/>'
    // TABLEAU arrière évasé (la voûte), préceintes horizontales.
    + '<path d="M-24 -24 Q0 -26.5 24 -24 L14 0.5 Q0 3 -14 0.5 Z" fill="@coque" stroke="@coqueO" stroke-width="1.5"/>'
    + '<path d="M-21.5 -16.5 Q0 -19.5 21.5 -16.5 M-18 -8.5 Q0 -11.5 18 -8.5" fill="none" stroke="@coqueO" stroke-width="0.9" opacity="0.5"/>'
    + '</g>';
}

export const hullArt: ShipArtDef = { id: 'bateau-tresor-cathayen', front, profile, back };
