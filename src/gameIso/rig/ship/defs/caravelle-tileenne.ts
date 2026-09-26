/**
 * CARAVELLE TILÉENNE (MDG, ~40 m, voile) — fine et basse (rien des châteaux massifs de la
 * caraque) : charpente RÉELLE lisible — quille droite, étrave élancée qui déborde la lisse
 * (beaupré en tête), étambot incliné portant un TABLEAU plat, dunette = MARCHE de la lisse
 * (jamais un bloc posé). Trois mâts « redonda » (misaine et grand mât carrés, artimon latin),
 * flammes tiléennes en girouette. Vues : profil + proue + poupe.
 */
import type { ShipArtDef } from '../artkit';
import { hune, lateenSail, pennant, rudder, spar, squareSail, stay } from '../artkit';

function profile(): string {
  return '<g>'
    + rudder(-42.5, -16)
    // Artimon latin sur la dunette, grand mât, misaine — mâture élancée.
    + spar(-31, -21, -31, -68, 2)
    + lateenSail([-21, -64], [-44, -33], [-23, -22], [3, 5])
    + spar(-2, -11, -2, -92, 2.4)
    + squareSail(-2, -84, 40, 15, { seams: 2 }) + hune(-2, -89)
    + spar(25, -12.5, 27, -70, 2)
    + squareSail(26, -64, 26, 10, { seams: 1 })
    // Beaupré planté dans la TÊTE d'étrave (pas sur le pont).
    + spar(43, -24, 58, -33, 1.8)
    + stay(-2, -92, 26, -16) + stay(-2, -92, -31, -23) + stay(27, -70, 57, -32)
    + pennant(-2, -92, 12) + pennant(27, -70, 9) + pennant(-31, -68, 8)
    // COQUE en une SEULE silhouette charpentée : couronnement, lisse de dunette, MARCHE sur le
    // pont principal (tonture douce, franc-bord bas), remontée du bouge avant, étrave DROITE
    // et élancée qui déborde, quille DROITE, étambot incliné (tableau).
    + '<path d="M-43 -23 L-27 -20.5 L-26.2 -12.4 Q-6 -10.2 14 -11.4 Q28 -12.8 37 -16 L45 -26 L38.6 -0.6 L-37.6 -0.6 Z" fill="@coque" stroke="@coqueO" stroke-width="1.5"/>'
    // Quille (trait ferme), taillant d'étrave, lisses en lumière.
    + '<path d="M38.6 -0.6 L-37.6 -0.6" stroke="@coqueO" stroke-width="1.8"/>'
    + '<path d="M45 -26 L38.6 -0.6" stroke="@coqueH" stroke-width="1.3"/>'
    + '<path d="M-43 -23 L-27 -20.5 M-26.2 -12.4 Q-6 -10.2 14 -11.4 Q28 -12.8 37 -16" fill="none" stroke="@coqueH" stroke-width="1.2"/>'
    // Préceinte suivant la tonture + virure basse en retrait.
    + '<path d="M-41 -15 Q-4 -6.6 35.5 -12.6" fill="none" stroke="@coqueH" stroke-width="1.1" opacity="0.85"/>'
    + '<path d="M-39.5 -9 Q0 -2.6 36.8 -7.4" fill="none" stroke="@coqueO" stroke-width="0.8" opacity="0.45"/>'
    // Fenêtres de la dunette (dans le pavois arrière, pas un placage).
    + '<path d="M-37 -17 l2.6 0 m4.6 0 l2.6 0" stroke="@matO" stroke-width="1.5"/>'
    + '</g>';
}

function front(): string {
  return '<g>'
    // Grand mât (le plus haut) : voile carrée face au vent, ventre vers le spectateur.
    + spar(0, -14, 0, -92, 2.2)
    + '<path d="M-16 -84 Q0 -87 16 -84 L14.5 -46 Q0 -42 -14.5 -46 Z" fill="@toileDeVoile" stroke="@toileDeVoileO" stroke-width="1"/>'
    + spar(-18, -84.5, 18, -84.5, 1.6)
    + '<path d="M0 -85 L0 -44" stroke="@toileDeVoileO" stroke-width="0.7" opacity="0.4"/>'
    + hune(0, -89)
    // Misaine devant, plus basse et plus étroite.
    + '<path d="M-12 -64 Q0 -66.5 12 -64 L11 -38 Q0 -34.5 -11 -38 Z" fill="@toileDeVoile" stroke="@toileDeVoileO" stroke-width="1"/>'
    + spar(-13.5, -64.5, 13.5, -64.5, 1.4)
    + stay(0, -92, -10, -17) + stay(0, -92, 10, -17)
    + pennant(0, -92, 10)
    // MURAILLE de proue : muraille fine évasée, lisse en bouge.
    + '<path d="M-10.5 -15 Q-11.5 -6 -6.5 -0.8 Q0 1.8 6.5 -0.8 Q11.5 -6 10.5 -15 Q6 -17.6 0 -18 Q-6 -17.6 -10.5 -15 Z" fill="@coque" stroke="@coqueO" stroke-width="1.4"/>'
    // Tête d'étrave en pointe AU-DESSUS de la lisse + taillant en arête centrale.
    + '<path d="M-2 -17.6 L0 -27 L2 -17.6 Z" fill="@coque" stroke="@coqueO" stroke-width="1.2"/>'
    + '<path d="M0 -26 L0 -0.8" stroke="@coqueH" stroke-width="1.4"/>'
    // Préceinte suivant le bouge.
    + '<path d="M-10 -10.5 Q0 -13.5 10 -10.5" fill="none" stroke="@coqueH" stroke-width="1" opacity="0.85"/>'
    // Beaupré pointé sur le spectateur (raccourci : moignon relevé + pomme).
    + spar(0, -26, 0, -33, 1.8)
    + '<circle cx="0" cy="-34" r="1.6" fill="@mat" stroke="@matO" stroke-width="0.7"/>'
    + '</g>';
}

function back(): string {
  return '<g>'
    // Grand mât vu de poupe : dos de la toile (courbure fuyante).
    + spar(0, -20, 0, -92, 2.2)
    + '<path d="M-15 -84 Q0 -82.5 15 -84 L13.5 -47 Q0 -49.5 -13.5 -47 Z" fill="@toileDeVoile" stroke="@toileDeVoileO" stroke-width="1"/>'
    + spar(-17, -84.5, 17, -84.5, 1.6)
    + hune(0, -89)
    + pennant(0, -92, 10)
    // Artimon LATIN au premier plan : antenne en travers, fuseau de toile vu de chant.
    + spar(-4, -24, -4, -66, 1.8)
    + spar(-12, -40, 8, -70, 1.5)
    + '<path d="M8 -70 L-12 -40 L-5 -38 Q3 -55 8 -70 Z" fill="@toileDeVoile" stroke="@toileDeVoileO" stroke-width="0.9"/>'
    + pennant(-4, -66, 8)
    // TABLEAU ARRIÈRE plat (trapèze), bordé horizontal, couronnement en lumière.
    + '<path d="M-10.5 -21.5 L10.5 -21.5 L8 -2 Q0 0.8 -8 -2 Z" fill="@coque" stroke="@coqueO" stroke-width="1.4"/>'
    + '<path d="M-10 -16 L10 -16 M-9.4 -11 L9.4 -11 M-8.8 -6.5 L8.8 -6.5" stroke="@coqueO" stroke-width="0.8" opacity="0.5"/>'
    + '<path d="M-10.5 -21.5 L10.5 -21.5" stroke="@coqueH" stroke-width="1.3"/>'
    // Fenêtres de dunette sous le couronnement.
    + '<path d="M-5.5 -18.8 l3 0 m5 0 l3 0" stroke="@matO" stroke-width="1.6"/>'
    // SAFRAN dans l'axe, pendu sous le tableau.
    + '<path d="M-1.8 -4 L1.8 -4 L1.4 1.6 L-1.4 1.6 Z" fill="@coque" stroke="@coqueO" stroke-width="1"/>'
    + '</g>';
}

export const hullArt: ShipArtDef = { id: 'caravelle-tileenne', front, profile, back };
