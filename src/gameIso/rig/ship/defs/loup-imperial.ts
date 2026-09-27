/**
 * LOUP IMPÉRIAL (MDG, ~55 m, mixte) — galéasse de l'Empire : coque LONGUE et basse à tonture
 * quasi droite (jamais un croissant), château arrière ÉTAGÉ taillé dans la muraille et coiffé
 * de tourelles en poivrière, galerie d'apostis ARCADÉE au-dessus d'une pleine batterie
 * d'avirons, guibre portant l'ÉPERON à tête de LOUP, trois mâts à hunes carrées et voiles
 * RAYÉES. Réf : planche MDG 12 p.098 (en bas à gauche — bandes des voiles + tête de loup font
 * la signature).
 */
import type { ShipArtDef } from '../artkit';
import { castle, flag, gunports, hune, oarBank, pennant, spar, squareSail, stay } from '../artkit';

/** Voile carrée RAYÉE (bandes verticales @pavillon — la livrée du Loup). */
function stripedSail(cx: number, yTop: number, h: number, hw: number): string {
  let s = squareSail(cx, yTop, h, hw);
  for (let i = 0; i < 3; i++) {
    const x = cx - hw + ((2 * hw) * (2 * i + 1)) / 6;
    s += `<path d="M${x - 2.2} ${yTop + 2} Q${x - 2.2 + h * 0.13} ${yTop + h * 0.55} ${x - 2.2} ${yTop + h - 1.5} L${x + 2.2} ${yTop + h - 1.5} Q${x + 2.2 + h * 0.13} ${yTop + h * 0.55} ${x + 2.2} ${yTop + 2} Z" fill="@pavillon" opacity="0.8"/>`;
  }
  return s;
}

/** Voile carrée rayée vue de FACE/DOS (vent portant, bandes verticales droites). */
function stripedSailOn(cx: number, yTop: number, h: number, hw: number): string {
  let s = spar(cx - hw - 2, yTop, cx + hw + 2, yTop, 1.8);
  s += `<path d="M${cx - hw} ${yTop + 1} Q${cx - hw - 3} ${yTop + h * 0.5} ${cx - hw + 1.5} ${yTop + h} L${cx + hw - 1.5} ${yTop + h} Q${cx + hw + 3} ${yTop + h * 0.5} ${cx + hw} ${yTop + 1} Z" fill="@toileDeVoile" stroke="@toileDeVoileO" stroke-width="1"/>`;
  for (let i = 0; i < 3; i++) {
    const x = cx - hw + ((2 * hw) * (2 * i + 1)) / 6;
    s += `<path d="M${x - 2.2} ${yTop + 2} L${x + 2.2} ${yTop + 2} L${x + 2.2} ${yTop + h - 1.5} L${x - 2.2} ${yTop + h - 1.5} Z" fill="@pavillon" opacity="0.8"/>`;
  }
  return s;
}

/** Tourelle de château en poivrière (toit @pavillon), yBase = pied. */
const turret = (x: number, yBase: number): string =>
  `<rect x="${x - 2.2}" y="${yBase - 5.5}" width="4.4" height="5.5" fill="@coque" stroke="@coqueO" stroke-width="0.9"/>`
  + `<path d="M${x - 3.2} ${yBase - 5.5} L${x} ${yBase - 10.4} L${x + 3.2} ${yBase - 5.5} Z" fill="@pavillon" stroke="@coqueO" stroke-width="0.7"/>`;

function profile(): string {
  return '<g>'
    // Pleine batterie d'avirons sous l'apostis.
    + oarBank(-40, 30, 12, -8, 7)
    // Trois mâts (artimon, grand mât, misaine) : voiles rayées, hunes carrées, flammes.
    + spar(-24, -16, -24, -72, 2.4) + stripedSail(-24, -65, 28, 12) + hune(-24, -69)
    + spar(4, -14, 4, -98, 3) + stripedSail(4, -90, 42, 17) + hune(4, -94)
    + spar(30, -15, 30, -76, 2.4) + stripedSail(30, -69, 30, 13) + hune(30, -73)
    + stay(4, -98, -34, -32) + stay(4, -98, 31, -20) + stay(30, -76, 47, -17) + stay(-24, -72, -51, -32)
    + pennant(4, -98, 12) + pennant(-24, -72, 8) + pennant(30, -76, 8)
    // COQUE de galéasse d'UN SEUL TENANT : château arrière taillé dans la muraille, tonture
    // quasi droite courant vers la guibre, étambot incliné, quille à la flottaison.
    + '<path d="M-54 -35 L-36 -33 L-35 -16 Q0 -13.6 34 -15.4 L46 -18 L49 -8 L46 -1.5 Q0 3 -46 -1.5 L-52 -22 Z" fill="@coque" stroke="@coqueO" stroke-width="1.5"/>'
    + '<path d="M-35 -16 Q0 -13.6 34 -15.4 L46 -18" fill="none" stroke="@coqueH" stroke-width="1.4"/>'
    // Galerie d'APOSTIS arcadée (caisson de nage en surlonge) + préceinte basse.
    + '<path d="M-35 -9.8 Q0 -7 34 -9.2" fill="none" stroke="@coqueH" stroke-width="1.7" opacity="0.9"/>'
    + gunports(-30, 28, 10, -11.6, 2.6)
    + '<path d="M-44 -5.5 Q0 -1.2 44 -5" fill="none" stroke="@coqueO" stroke-width="0.8" opacity="0.5"/>'
    // Château ARRIÈRE : rangées de fenêtres, tourelles en poivrière, pavillon.
    + '<path d="M-51 -28 l3.5 0 M-45 -28 l3.5 0 M-51.5 -21.5 l3.5 0 M-45.5 -21.5 l3.5 0 M-39.5 -21.5 l3 0" stroke="@toileDeVoileH" stroke-width="1.5"/>'
    + '<path d="M-54 -35 L-36 -33" fill="none" stroke="@coqueH" stroke-width="1.2"/>'
    + turret(-51, -34.6) + turret(-39, -33.2)
    + flag(-45, -34, 8, 5)
    // Petit gaillard d'avant crénelé sur la guibre.
    + castle(36, 47, -23, -17.5, 3)
    // ÉPERON à la flottaison, portant la TÊTE DE LOUP (gueule ouverte vers l'avant, oreille dressée).
    + '<path d="M48 -7 L62 -4 L48 -2 Z" fill="@matO" stroke="@coqueO" stroke-width="1"/>'
    + '<path d="M54.5 -11 L61 -9.6 L63.5 -7.6 L60.5 -6.6 L61.5 -4.8 L55 -5.6 Z" fill="@matO" stroke="@coqueO" stroke-width="0.9"/>'
    + '<path d="M55.5 -10.8 L56.8 -13.6 L58.6 -10.4 Z" fill="@matO" stroke="@coqueO" stroke-width="0.7"/>'
    + '</g>';
}

function front(): string {
  return '<g>'
    // Grand mât (axe) et misaine devant : voiles rayées vues de FACE, hunes, flammes.
    + spar(-2, -26, -2, -98, 2.8) + stripedSailOn(-2, -88, 38, 15) + hune(-2, -93) + pennant(-2, -98, 10)
    + spar(4, -24, 4, -68, 2.2) + stripedSailOn(4, -61, 26, 11) + pennant(4, -68, 8)
    // Ailes d'APOSTIS débordant des deux bords + avirons à l'eau.
    + '<g stroke="@mat" stroke-width="1.2" stroke-linecap="round"><line x1="-19" y1="-10" x2="-26" y2="1"/><line x1="-16.5" y1="-10.5" x2="-22.5" y2="1"/><line x1="19" y1="-10" x2="26" y2="1"/><line x1="16.5" y1="-10.5" x2="22.5" y2="1"/></g>'
    + '<path d="M-21 -12 L-12.5 -13.6 L-12.5 -9.6 L-21 -8.4 Z" fill="@coque" stroke="@coqueO" stroke-width="1"/>'
    + '<path d="M21 -12 L12.5 -13.6 L12.5 -9.6 L21 -8.4 Z" fill="@coque" stroke="@coqueO" stroke-width="1"/>'
    // Section de coque FINE de galéasse : pavois, préceintes, massif d'étrave montant.
    + '<path d="M-13 -17 Q0 -20 13 -17 L8 0.5 Q0 2.6 -8 0.5 Z" fill="@coque" stroke="@coqueO" stroke-width="1.5"/>'
    + '<path d="M-13 -17 Q0 -20 13 -17" fill="none" stroke="@coqueH" stroke-width="1.3"/>'
    + '<path d="M-11 -10 Q0 -13.5 11 -10 M-9.5 -4 Q0 -7 9.5 -4" fill="none" stroke="@coqueO" stroke-width="0.8" opacity="0.5"/>'
    + '<path d="M-1.8 -30 L1.8 -30 L2.4 -4 L-2.4 -4 Z" fill="@coque" stroke="@coqueO" stroke-width="1"/>'
    // ÉPERON en saillie sous l'étrave (raccourci vu de face).
    + '<path d="M-2.6 -4 L2.6 -4 L1.6 1.5 L-1.6 1.5 Z" fill="@matO" stroke="@coqueO" stroke-width="0.8"/>'
    // FIGURE DE PROUE : tête de loup de face (deux oreilles, mufle descendant).
    + '<circle cx="0" cy="-31.5" r="3" fill="@matO" stroke="@coqueO" stroke-width="0.9"/>'
    + '<path d="M-2.4 -33 L-3.8 -36.6 L-0.8 -34.4 Z M2.4 -33 L3.8 -36.6 L0.8 -34.4 Z" fill="@matO" stroke="@coqueO" stroke-width="0.7"/>'
    + '<path d="M-1.3 -29.4 L1.3 -29.4 L0.7 -26.8 L-0.7 -26.8 Z" fill="@matO" stroke="@coqueO" stroke-width="0.7"/>'
    + '</g>';
}

function back(): string {
  return '<g>'
    // Grand mât et artimon dans l'axe : voiles rayées vues de dos, flammes.
    + spar(-3, -44, -3, -98, 2.6) + stripedSailOn(-3, -88, 34, 13) + pennant(-3, -98, 10)
    + spar(4, -42, 4, -70, 2.2) + pennant(4, -70, 8)
    // Avirons + ailes d'apostis sur les deux bords.
    + '<g stroke="@mat" stroke-width="1.2" stroke-linecap="round"><line x1="-20" y1="-10" x2="-27" y2="1"/><line x1="20" y1="-10" x2="27" y2="1"/></g>'
    + '<path d="M-22 -12 L-14 -13.4 L-14 -9.4 L-22 -8.2 Z" fill="@coque" stroke="@coqueO" stroke-width="1"/>'
    + '<path d="M22 -12 L14 -13.4 L14 -9.4 L22 -8.2 Z" fill="@coque" stroke="@coqueO" stroke-width="1"/>'
    // SAFRAN dans l'axe, sous le tableau.
    + '<path d="M-2.6 -6 L2.6 -6 L1.8 6 L-1.8 6 Z" fill="@coque" stroke="@coqueO" stroke-width="1"/>'
    // TABLEAU arrière + château ÉTAGÉ dans son prolongement (étage haut crénelé en retrait,
    // tourelles en poivrière aux angles) — jamais une boîte posée.
    + '<path d="M-15 -19 Q0 -22 15 -19 L9 0.5 Q0 3 -9 0.5 Z" fill="@coque" stroke="@coqueO" stroke-width="1.5"/>'
    + '<path d="M-12.5 -11 Q0 -14.5 12.5 -11 M-10.5 -4 Q0 -7.5 10.5 -4" fill="none" stroke="@coqueO" stroke-width="0.8" opacity="0.5"/>'
    + '<path d="M-14 -19 L-15.5 -32 L15.5 -32 L14 -19 Z" fill="@coque" stroke="@coqueO" stroke-width="1.2"/>'
    + '<path d="M-12 -27 l3.2 0 M8.8 -27 l3.2 0" stroke="@toileDeVoileH" stroke-width="1.5"/>'
    + castle(-12, 12, -42, -32, 4)
    + '<path d="M-8 -37 l3.2 0 M-1.6 -37 l3.2 0 M4.8 -37 l3.2 0" stroke="@toileDeVoileH" stroke-width="1.5"/>'
    + turret(-13.5, -42) + turret(13.5, -42)
    + flag(0, -44, 8, 5)
    // BLASON au loup sur le tableau : écu clair, tête de loup sombre.
    + '<path d="M-4 -30.5 L4 -30.5 L4 -24.5 Q4 -21.8 0 -20.8 Q-4 -21.8 -4 -24.5 Z" fill="@toileDeVoile" stroke="@coqueO" stroke-width="0.9"/>'
    + '<path d="M-2.4 -26.6 L0.6 -28 L2.7 -26.2 L1 -25.6 L1.7 -24.2 L-2 -24.8 Z" fill="@matO"/>'
    + '<path d="M-0.8 -27.8 L-0.3 -29.4 L0.9 -27.9 Z" fill="@matO"/>'
    + '</g>';
}

export const hullArt: ShipArtDef = { id: 'loup-imperial', front, profile, back };
