/**
 * BARGE (LDB 306, ~20 m) — fluvial à FOND PLAT : ponton rectangulaire haut de bordé, proue en
 * SIFFLET (plan d'étrave incliné remontant du fond), tableau arrière portant le rouf de barre,
 * jambettes de pavois, fret bâché en pontée, mât de halage à voile carrée, avirons de bordée.
 * 3 vues : profil (proue à droite), face = plan de proue, dos = tableau + timon.
 */
import type { ShipArtDef } from '../artkit';
import { oarBank, pennant, spar, squareSail, stay, timon } from '../artkit';

function profile(): string {
  return '<g>'
    + oarBank(-14, 2, 3, -11, 6)
    // Gréement : mât de halage au tiers avant, voile carrée, étais vers les extrémités.
    + spar(9, -12, 9, -58, 2.4)
    + squareSail(9, -52, 27, 11, { seams: 2 })
    + stay(9, -58, 31, -14) + stay(9, -58, -22, -20)
    + pennant(9, -58, 8)
    // Ponton à fond plat : flancs droits, proue en sifflet (plan incliné), léger rake du tableau.
    + '<path d="M-32 -13 L31 -13 L36 -9.5 L27 -1 L-29 -1 L-34 -7 Z" fill="@coque" stroke="@coqueO" stroke-width="1.4"/>'
    + '<path d="M-32 -13 L31 -13 L36 -9.5" fill="none" stroke="@coqueH" stroke-width="1.4"/>'
    // Bordages horizontaux + couture du plan de proue.
    + '<path d="M-32.8 -9 L33.5 -9 M-31 -5 L30 -5" stroke="@coqueO" stroke-width="0.7" opacity="0.5"/>'
    + '<path d="M31 -13 L27 -1" stroke="@coqueO" stroke-width="0.8" opacity="0.6"/>'
    // Jambettes de pavois (montants au plat-bord).
    + '<path d="M-26 -13 l0 -2 M-16 -13 l0 -2 M-2 -13 l0 -2 M18 -13 l0 -2 M28 -13 l0 -2" stroke="@coqueO" stroke-width="1"/>'
    // Rouf de barre à l'arrière (toit débordant, hublot) + timon par-dessus le tableau.
    + '<rect x="-30" y="-21" width="13" height="8" fill="@coque" stroke="@coqueO" stroke-width="1"/>'
    + '<path d="M-31.5 -21 L-15.5 -21" stroke="@matO" stroke-width="1.8" stroke-linecap="round"/>'
    + '<circle cx="-26" cy="-16.5" r="1.1" fill="@toileDeVoileH"/>'
    // Fret en pontée : ballot bâché au centre, caisses vers l'avant.
    + '<path d="M-12 -13 q1.5 -5 6.5 -5 q5 0 6.5 4.8 Z" fill="@toileDeVoileO" stroke="@matO" stroke-width="0.8"/>'
    + '<rect x="16" y="-18.5" width="7" height="5.5" fill="@matO" stroke="@coqueO" stroke-width="0.8"/>'
    + '<rect x="24" y="-17.5" width="5.5" height="4.5" fill="@mat" stroke="@coqueO" stroke-width="0.8"/>'
    + timon(-30, -15)
    + '</g>';
}

function front(): string {
  return '<g>'
    // Voile carrée pleine largeur derrière le plan de proue, mât et flamme.
    + squareSail(0, -52, 27, 12, { seams: 2 })
    + spar(0, -14, 0, -58, 2.4)
    + pennant(0, -58, 8)
    // Avirons de bordée sortant des flancs.
    + '<path d="M-10 -9 L-17 1 M10 -9 L17 1" stroke="@mat" stroke-width="1.3" stroke-linecap="round"/>'
    // Plan de proue en sifflet : face large et plate, plus étroite au fond.
    + '<path d="M-12 -14 L12 -14 L9.5 -1 L-9.5 -1 Z" fill="@coque" stroke="@coqueO" stroke-width="1.4"/>'
    + '<path d="M-12 -14 L12 -14" stroke="@coqueH" stroke-width="1.4"/>'
    + '<path d="M-11.4 -10 L11.4 -10 M-10.6 -6 L10.6 -6" stroke="@coqueO" stroke-width="0.7" opacity="0.5"/>'
    // Bittes d'amarrage aux épaules + organeau de halage au centre du plan.
    + '<path d="M-9.5 -14 l0 -2.6 M9.5 -14 l0 -2.6" stroke="@coqueO" stroke-width="1.6" stroke-linecap="round"/>'
    + '<circle cx="0" cy="-8" r="1.6" fill="none" stroke="@matO" stroke-width="1"/>'
    + '</g>';
}

function back(): string {
  return '<g>'
    // Voile vue de dos, mât PAR-DESSUS la toile, flamme.
    + squareSail(0, -52, 27, 12, { seams: 2 })
    + spar(0, -14, 0, -58, 2.4)
    + pennant(0, -58, 8)
    + '<path d="M-10 -9 L-17 1 M10 -9 L17 1" stroke="@mat" stroke-width="1.3" stroke-linecap="round"/>'
    // Rouf de barre dépassant du tableau (toit débordant, hublot).
    + '<rect x="-8" y="-20.5" width="16" height="6.5" fill="@coque" stroke="@coqueO" stroke-width="1"/>'
    + '<path d="M-9.5 -20.5 L9.5 -20.5" stroke="@matO" stroke-width="1.8" stroke-linecap="round"/>'
    + '<circle cx="0" cy="-17.5" r="1.1" fill="@toileDeVoileH"/>'
    // Tableau arrière plat, bordages horizontaux.
    + '<path d="M-12 -14 L12 -14 L9.5 -1 L-9.5 -1 Z" fill="@coque" stroke="@coqueO" stroke-width="1.4"/>'
    + '<path d="M-12 -14 L12 -14" stroke="@coqueH" stroke-width="1.4"/>'
    + '<path d="M-11.4 -10 L11.4 -10 M-10.6 -6 L10.6 -6" stroke="@coqueO" stroke-width="0.7" opacity="0.5"/>'
    // Timon franchissant le tableau + pelle de godille plongeant à l'eau.
    + '<path d="M0 -15.5 L4 -6 L6.5 1.5" stroke="@mat" stroke-width="2" stroke-linecap="round" fill="none"/>'
    + '<path d="M6.5 1.5 l-2.6 -1 l0.8 3.4 Z" fill="@mat"/>'
    + '</g>';
}

export const hullArt: ShipArtDef = { id: 'barge', profile, front, back };
