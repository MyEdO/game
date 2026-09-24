/**
 * LANGSKIP (MDG, ~25 m, mixte) — navire LONG norse : carène basse mais VOLUMINEUSE (quille filée,
 * bordé à clins), étrave et étambot montant en col — tête de dragon en proue, queue-volute en
 * poupe — pavois de boucliers sur le plat-bord, long rang d'avirons, gouvernail LATÉRAL de poupe,
 * mât unique trapu à grande voile carrée à laizes. Réf : planches MDG 12 p.098 (centre) et p.114.
 */
import type { ShipArtDef } from '../artkit';
import { oarBank, pennant, shieldRow, spar, squareSail, stay } from '../artkit';

/** Laizes peintes de la voile (bandes verticales suivant le ventre de la toile). */
const laizes = (d: string): string =>
  `<path d="${d}" stroke="@pavillon" stroke-width="3" opacity="0.6" fill="none"/>`;

function profile(): string {
  return '<g>'
    + oarBank(-27, 24, 9, -6, 6)
    // Gouvernail LATÉRAL de poupe (le navire long ne porte pas de safran d'étambot).
    + spar(-29, -12, -33, 2, 2)
    + '<path d="M-31.8 -1 L-35.8 0.4 L-34 6.6 L-30.6 4 Z" fill="@coque" stroke="@coqueO" stroke-width="0.9"/>'
    // Gréement : mât unique TRAPU, vergue renforcée, grande voile carrée à laizes.
    + spar(0, -6, 0, -86, 3.4)
    + spar(-25, -78, 25, -78, 2.6)
    + squareSail(0, -78, 46, 22, { seams: 0 })
    + laizes('M-13.5 -76 Q-9 -52 -12.5 -33.5 M-1 -76.6 Q3.5 -52 0 -33 M11.5 -77 Q16 -52 12.5 -33')
    + stay(0, -86, 38, -25) + stay(0, -86, -37, -21)
    + pennant(0, -86, 11)
    // CARÈNE avec du volume (pas un croissant) : tonture douce, fonds pleins, quille filée
    // d'un post à l'autre, étrave/étambot élancés en dehors.
    + '<path d="M-38.5 -22 L-33 -1 Q0 2.2 30 -1 L40.5 -25 Q34 -13.6 15 -10.4 Q0 -9.6 -15 -10.4 Q-31 -13.2 -38.5 -22 Z" fill="@coque" stroke="@coqueO" stroke-width="1.4"/>'
    + '<path d="M-38.5 -22 Q-31 -13.2 -15 -10.4 Q0 -9.6 15 -10.4 Q34 -13.6 40.5 -25" fill="none" stroke="@coqueH" stroke-width="1.1"/>'
    + '<path d="M-33 -0.6 Q0 2.6 30 -0.6" fill="none" stroke="@coqueO" stroke-width="1.6"/>'
    // BORDÉ À CLINS : virures courant sur toute la longueur, parallèles à la tonture.
    + '<path d="M-36.5 -17.5 Q0 -6.6 38 -20.5 M-35 -12.5 Q0 -3.4 35.5 -15.5 M-34 -7.5 Q0 -0.6 32.5 -10" fill="none" stroke="@coqueO" stroke-width="0.8" opacity="0.55"/>'
    // ÉTAMBOT en queue-volute (poupe).
    + '<path d="M-38.5 -22 Q-42 -27 -41 -32 Q-40 -36 -36 -35.4 Q-38.6 -33 -38.4 -30 Q-38 -26 -35.4 -22.8 Z" fill="@coque" stroke="@coqueO" stroke-width="1"/>'
    // ÉTRAVE en col portant la TÊTE DE DRAGON (gueule, corne, œil).
    + '<path d="M40.5 -25 Q43.6 -28.6 43.8 -34 L47.2 -33.4 Q46.6 -28 42.8 -24.4 Z" fill="@coque" stroke="@coqueO" stroke-width="1"/>'
    + '<path d="M43.2 -34 L49.6 -35.2 L45.6 -31.2 Z" fill="@coque" stroke="@coqueO" stroke-width="0.9"/>'
    + '<path d="M44 -35.6 l1.2 -3 l1.6 2.4 Z" fill="@coque" stroke="@coqueO" stroke-width="0.8"/>'
    + '<circle cx="45" cy="-33.6" r="0.9" fill="@pavillon"/>'
    // Pavois : boucliers ronds alternés le long du plat-bord.
    + shieldRow(-26, 26, 10, -11, 2.7)
    + '</g>';
}

function front(): string {
  return '<g>'
    // Mât (en arrière de la toile) puis voile carrée vue de FACE, gonflée vers l'observateur.
    + spar(0, -13, 0, -84, 3)
    + pennant(0, -84, 9)
    + spar(-25, -74.5, 25, -74.5, 2.2)
    + '<path d="M-23 -74 Q0 -79 23 -74 L19 -34 Q0 -28.5 -19 -34 Z" fill="@toileDeVoile" stroke="@toileDeVoileO" stroke-width="1"/>'
    + laizes('M-11.5 -73.4 Q-11 -52 -9.6 -32.2 M0 -74.6 Q0.4 -52 0 -30.4 M11.5 -73.4 Q11 -52 9.6 -32.2')
    // Avirons en éventail de part et d'autre.
    + '<g stroke="@mat" stroke-width="1.2" stroke-linecap="round"><line x1="-8" y1="-9" x2="-17" y2="1"/><line x1="-8.6" y1="-7" x2="-19" y2="-2"/><line x1="8" y1="-9" x2="17" y2="1"/><line x1="8.6" y1="-7" x2="19" y2="-2"/></g>'
    // Section de coque étroite (lame), clins horizontaux.
    + '<path d="M-9.5 -13 Q0 -16 9.5 -13 Q8 -3 0 1.4 Q-8 -3 -9.5 -13 Z" fill="@coque" stroke="@coqueO" stroke-width="1.3"/>'
    + '<path d="M-9.5 -13 Q0 -16 9.5 -13" fill="none" stroke="@coqueH" stroke-width="1"/>'
    + '<path d="M-8.8 -9 Q0 -11.6 8.8 -9 M-7.2 -4.4 Q0 -6.6 7.2 -4.4" fill="none" stroke="@coqueO" stroke-width="0.7" opacity="0.55"/>'
    // ÉTRAVE centrale en lame + tête de dragon de face (crâne, deux yeux).
    + '<path d="M-1.6 -14.5 L1.6 -14.5 L1.2 -31 L-1.2 -31 Z" fill="@coque" stroke="@coqueO" stroke-width="1"/>'
    + '<path d="M-3 -31 Q0 -37 3 -31 L1.6 -27.6 L-1.6 -27.6 Z" fill="@coque" stroke="@coqueO" stroke-width="0.9"/>'
    + '<circle cx="-1.3" cy="-31.8" r="0.7" fill="@pavillon"/><circle cx="1.3" cy="-31.8" r="0.7" fill="@pavillon"/>'
    // Boucliers du pavois, en enfilade raccourcie sur chaque bord.
    + '<circle cx="-8.8" cy="-13.8" r="2.4" fill="@pavillon" stroke="@coqueO" stroke-width="0.8"/>'
    + '<circle cx="-6" cy="-13" r="2.4" fill="@toileDeVoileO" stroke="@coqueO" stroke-width="0.8"/>'
    + '<circle cx="8.8" cy="-13.8" r="2.4" fill="@pavillon" stroke="@coqueO" stroke-width="0.8"/>'
    + '<circle cx="6" cy="-13" r="2.4" fill="@toileDeVoileO" stroke="@coqueO" stroke-width="0.8"/>'
    + '</g>';
}

function back(): string {
  return '<g>'
    // Voile vue de DOS (le ventre fuit vers la proue : chute creuse), vergue, puis mât DEVANT.
    + spar(-25, -75.5, 25, -75.5, 2.2)
    + '<path d="M-23 -75 Q0 -71 23 -75 L19 -33 Q0 -37.5 -19 -33 Z" fill="@toileDeVoile" stroke="@toileDeVoileO" stroke-width="1"/>'
    + laizes('M-11.5 -73.6 Q-11 -54 -9.6 -34.6 M0 -72 Q0.4 -54 0 -36.6 M11.5 -73.6 Q11 -54 9.6 -34.6')
    + spar(0, -13, 0, -84, 3)
    + pennant(0, -84, 9)
    // Gouvernail latéral plongeant à l'eau, sur le quartier tribord.
    + spar(7.5, -10, 10.5, 3, 2)
    + '<path d="M9 0 L13 1.4 L11.2 7 L8 4.4 Z" fill="@coque" stroke="@coqueO" stroke-width="0.9"/>'
    // Section de poupe : pas de tableau — l'étambot monte en QUEUE-VOLUTE dans l'axe.
    + '<path d="M-9.5 -13 Q0 -15.5 9.5 -13 Q8 -3 0 1.4 Q-8 -3 -9.5 -13 Z" fill="@coque" stroke="@coqueO" stroke-width="1.3"/>'
    + '<path d="M-9.5 -13 Q0 -15.5 9.5 -13" fill="none" stroke="@coqueH" stroke-width="1"/>'
    + '<path d="M-8.8 -9 Q0 -11.2 8.8 -9 M-7.2 -4.4 Q0 -6.4 7.2 -4.4" fill="none" stroke="@coqueO" stroke-width="0.7" opacity="0.55"/>'
    + '<path d="M-1.4 -14.5 L1.4 -14.5 L1.1 -28 L-1.1 -28 Z" fill="@coque" stroke="@coqueO" stroke-width="1"/>'
    + '<path d="M-1.1 -28 Q-1.6 -33.4 2.6 -34 Q5 -34.2 4.6 -31.8 Q3 -32.8 1.6 -31 Q0.8 -29.8 1.1 -28 Z" fill="@coque" stroke="@coqueO" stroke-width="0.9"/>'
    // Boucliers du pavois.
    + '<circle cx="-8.8" cy="-13.8" r="2.4" fill="@toileDeVoileO" stroke="@coqueO" stroke-width="0.8"/>'
    + '<circle cx="-6" cy="-13" r="2.4" fill="@pavillon" stroke="@coqueO" stroke-width="0.8"/>'
    + '<circle cx="8.8" cy="-13.8" r="2.4" fill="@toileDeVoileO" stroke="@coqueO" stroke-width="0.8"/>'
    + '<circle cx="6" cy="-13" r="2.4" fill="@pavillon" stroke="@coqueO" stroke-width="0.8"/>'
    + '</g>';
}

export const hullArt: ShipArtDef = { id: 'langskip', front, profile, back };
