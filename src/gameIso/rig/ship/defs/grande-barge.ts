/**
 * GRANDE BARGE (MDG 113, ~30 m, mixte) — le grand gabarit fluvial : coque à FOND PLAT et lisse
 * rectiligne (aucune tonture), ÉTRAVE relevée en tête de proue au-dessus du pavois, étambot droit
 * portant le timon de godille, bordages pleine longueur. DEUX mâts courts à voile carrée, avirons
 * de bordée, ROUF d'habitation arrière INTÉGRÉ à la coque (hiloire commune) et fret bâché en pontée.
 */
import type { ShipArtDef } from '../artkit';
import { oarBank, pennant, spar, squareSail, stay, timon } from '../artkit';

function profile(): string {
  return '<g>'
    + oarBank(-12, -2, 4, -9.5, 6)
    // Deux mâts courts à voile carrée, étais courant vers l'étrave et l'arrière.
    + spar(-4, -10, -4, -52, 2.4) + squareSail(-4, -47, 24, 10, { seams: 2 }) + pennant(-4, -52, 8)
    + stay(-4, -52, 33, -13) + stay(-4, -52, -32, -12)
    + spar(21, -11, 21, -44, 2) + squareSail(21, -40, 18, 7.5, { seams: 1 }) + pennant(21, -44, 6)
    + stay(21, -44, 37, -16)
    // Coque à FOND PLAT : lisse rectiligne, ÉTRAVE relevée montant en tête au-dessus du pavois,
    // étambot droit à l'arrière.
    + '<path d="M-36 -10.5 L29 -10.5 Q33.5 -11 36.2 -14.6 L37.2 -17.6 L39.2 -17 L38.2 -14 Q36 -7 33.8 -1 L-33.2 -1 Z" fill="@coque" stroke="@coqueO" stroke-width="1.4"/>'
    + '<path d="M-36 -10.5 L29 -10.5 Q33.5 -11 36.2 -14.6" fill="none" stroke="@coqueH" stroke-width="1.4"/>'
    // Bordages pleine longueur, remontant dans l’étrave.
    + '<path d="M-35.2 -7.4 L30.5 -7.4 Q34.6 -7.9 36.6 -11.2 M-34.4 -4.2 L32.4 -4.2 Q34.4 -4.6 35.4 -6.8" fill="none" stroke="@coqueO" stroke-width="0.8" opacity="0.5"/>'
    // Couture d’étambot + bittes d’amarrage jumelles de proue.
    + '<path d="M-34.6 -10.5 L-33.2 -1" stroke="@coqueO" stroke-width="1" opacity="0.6"/>'
    + '<path d="M28 -10.8 l0 -2.8 M31.2 -11.6 l0 -2.8" stroke="@matO" stroke-width="1.5" stroke-linecap="round"/>'
    // ROUF arrière INTÉGRÉ : hiloire commune avec la coque, toit cambré débordant, hublots, poêle.
    + '<rect x="-31" y="-18" width="16" height="8" fill="@coque" stroke="@coqueO" stroke-width="1.1"/>'
    + '<path d="M-32 -10.7 L-14 -10.7" stroke="@coqueO" stroke-width="1.6"/>'
    + '<path d="M-32 -18 Q-23 -19.8 -14 -18" stroke="@matO" stroke-width="1.9" stroke-linecap="round" fill="none"/>'
    + '<circle cx="-27.5" cy="-14" r="1.2" fill="@toileDeVoileH"/><circle cx="-22.5" cy="-14" r="1.2" fill="@toileDeVoileH"/><circle cx="-17.5" cy="-14" r="1.2" fill="@toileDeVoileH"/>'
    + spar(-29, -19.5, -29, -23, 1.4)
    // Fret en pontée : ballot BÂCHÉ saisi au pont entre les mâts + tonneau vers la proue.
    + '<path d="M2 -10.8 Q9 -17.5 16.5 -10.8 Z" fill="@toileDeVoile" stroke="@toileDeVoileO" stroke-width="1"/>'
    + '<path d="M5.5 -11 L6.5 -15 M9 -11 L9 -16.2 M12.5 -11 L12 -15" stroke="@toileDeVoileO" stroke-width="0.7" opacity="0.5"/>'
    + '<rect x="24.6" y="-15.8" width="4.4" height="4.6" rx="1.8" fill="@mat" stroke="@coqueO" stroke-width="0.8"/>'
    + '<path d="M24.6 -13.5 l4.4 0" stroke="@coqueO" stroke-width="0.7" opacity="0.6"/>'
    // Timon de godille à l’étambot.
    + timon(-34.8, -12.5)
    + '</g>';
}

function front(): string {
  return '<g>'
    // Grand mât (arrière, plus haut) : sa voile carrée pleine face déborde derrière la misaine.
    + spar(0, -26, 0, -52, 2)
    + pennant(0, -52, 8)
    + '<path d="M-13 -46.5 L13 -46.5" stroke="@mat" stroke-width="1.6" stroke-linecap="round"/>'
    + '<path d="M-12 -45.5 L12 -45.5 L13.6 -27 Q0 -22 -13.6 -27 Z" fill="@toileDeVoile" stroke="@toileDeVoileO" stroke-width="0.9"/>'
    // Misaine au premier plan, voile carrée pleine face plus courte.
    + spar(0, -11, 0, -40, 2.2)
    + '<path d="M-10 -37 L10 -37" stroke="@mat" stroke-width="1.6" stroke-linecap="round"/>'
    + '<path d="M-9.2 -36 L9.2 -36 L10.6 -20 Q0 -15.5 -10.6 -20 Z" fill="@toileDeVoile" stroke="@toileDeVoileO" stroke-width="0.9"/>'
    + '<path d="M-4.6 -36.2 Q-4.9 -27 -5.2 -18.6 M4.6 -36.2 Q4.9 -27 5.2 -18.6" stroke="@toileDeVoileO" stroke-width="0.7" opacity="0.4" fill="none"/>'
    // MURAILLE frontale à fond plat : trapèze bas et LARGE, virures horizontales.
    + '<path d="M-11 -10.5 L11 -10.5 L8.2 -1 L-8.2 -1 Z" fill="@coque" stroke="@coqueO" stroke-width="1.4"/>'
    + '<path d="M-11 -10.5 L11 -10.5" stroke="@coqueH" stroke-width="1.3"/>'
    + '<path d="M-10.2 -7.4 L10.2 -7.4 M-9.4 -4.4 L9.4 -4.4" stroke="@coqueO" stroke-width="0.8" opacity="0.55"/>'
    // ÉTRAVE : massif central montant en tête au-dessus du pavois (le relevé du profil, vu de face).
    + '<path d="M-1.7 -17.5 L1.7 -17.5 L2.4 -3 L-2.4 -3 Z" fill="@coque" stroke="@coqueO" stroke-width="1"/>'
    // Bittes d’amarrage jumelles de part et d’autre.
    + '<path d="M-6.6 -10.5 l0 -2.6 M6.6 -10.5 l0 -2.6" stroke="@matO" stroke-width="1.5" stroke-linecap="round"/>'
    + '</g>';
}

function back(): string {
  return '<g>'
    // Grand mât vu de poupe, voile carrée pleine face (la misaine plus basse est masquée).
    + spar(0, -19, 0, -52, 2.2) + pennant(0, -52, 8)
    + '<path d="M-12 -46.5 L12 -46.5" stroke="@mat" stroke-width="1.6" stroke-linecap="round"/>'
    + '<path d="M-11.2 -45.5 L11.2 -45.5 L12.6 -26 Q0 -21 -12.6 -26 Z" fill="@toileDeVoile" stroke="@toileDeVoileO" stroke-width="0.9"/>'
    + '<path d="M-5.6 -45.7 Q-6 -35 -6.3 -24.6 M5.6 -45.7 Q6 -35 6.3 -24.6" stroke="@toileDeVoileO" stroke-width="0.7" opacity="0.4" fill="none"/>'
    // ROUF, face ARRIÈRE : toit cambré débordant, hublots, cheminée du poêle.
    + '<rect x="-8" y="-18" width="16" height="8" fill="@coque" stroke="@coqueO" stroke-width="1.1"/>'
    + '<path d="M-9.2 -18 Q0 -19.8 9.2 -18" stroke="@matO" stroke-width="1.9" stroke-linecap="round" fill="none"/>'
    + '<circle cx="-3.6" cy="-14" r="1.3" fill="@toileDeVoileH"/><circle cx="3.6" cy="-14" r="1.3" fill="@toileDeVoileH"/>'
    + spar(-6, -19.6, -6, -23, 1.4)
    // TABLEAU arrière plat et large (fond plat, étambot droit), virures horizontales.
    + '<path d="M-11 -10.5 L11 -10.5 L8.6 -1 L-8.6 -1 Z" fill="@coque" stroke="@coqueO" stroke-width="1.4"/>'
    + '<path d="M-11 -10.5 L11 -10.5" stroke="@coqueH" stroke-width="1.3"/>'
    + '<path d="M-10.4 -7 L10.4 -7 M-9.6 -4 L9.6 -4" stroke="@coqueO" stroke-width="0.8" opacity="0.55"/>'
    // Timon de godille par-dessus le tableau : fourche centrale, barre en biais, pelle à l’eau.
    + '<path d="M0 -10.5 l0 -2.4" stroke="@matO" stroke-width="1.6" stroke-linecap="round"/>'
    + '<path d="M0 -12.9 L10.5 -4" stroke="@mat" stroke-width="2" stroke-linecap="round"/>'
    + '<path d="M10.5 -4 L14.6 0.8 L9.8 1.2 Z" fill="@mat"/>'
    + '</g>';
}

export const hullArt: ShipArtDef = { id: 'grande-barge', front, profile, back };
