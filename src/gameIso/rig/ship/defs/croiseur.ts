/**
 * CROISEUR (MDG, ~60 m, voile) — vaisseau de guerre RAPIDE à voiles étagées. Réf : planche MDG
 * p.098 (en bas à droite). Construction du type (pas de croissant générique) : coque LONGUE et
 * basse au maître-bau, silhouette en marches INTÉGRÉES au volume (gaillard d'avant → embelle
 * basse → demi-pont → dunette), tableau arrière plat, étrave élancée à guibre, BATTERIE de
 * sabords sur toute la longueur. Signature de la planche : tourelles coiffées en poivrière
 * aux angles des châteaux.
 */
import type { ShipArtDef } from '../artkit';
import { castle, flag, gunports, hune, lateenSail, pennant, rudder, spar, squareSail, stay } from '../artkit';

/** Tourelle de guette ronde à toit en poivrière (@pavillon), posée SUR un pont (yBase = rail). */
const turret = (x: number, yBase: number): string =>
  `<rect x="${x - 2.4}" y="${yBase - 6}" width="4.8" height="6" fill="@coque" stroke="@coqueO" stroke-width="0.9"/>`
  + `<path d="M${x - 3.4} ${yBase - 6} L${x} ${yBase - 11.4} L${x + 3.4} ${yBase - 6} Z" fill="@pavillon" stroke="@coqueO" stroke-width="0.7"/>`;

/** Voile carrée vue de FACE/POUPE : toile gonflée vers le spectateur sous sa vergue, couture centrale. */
function axialSail(cx: number, yTop: number, h: number, hw: number): string {
  const yB = yTop + h;
  return spar(cx - hw - 2, yTop, cx + hw + 2, yTop, 1.7)
    + `<path d="M${cx - hw} ${yTop + 0.8} Q${cx - hw - 2.4} ${yTop + h / 2} ${cx - hw + 1.6} ${yB}`
    + ` Q${cx} ${yB + 2.8} ${cx + hw - 1.6} ${yB} Q${cx + hw + 2.4} ${yTop + h / 2} ${cx + hw} ${yTop + 0.8}`
    + ` Q${cx} ${yTop + 2.4} ${cx - hw} ${yTop + 0.8} Z" fill="@toileDeVoile" stroke="@toileDeVoileO" stroke-width="1"/>`
    + `<path d="M${cx} ${yTop + 2.4} Q${cx} ${yTop + h / 2} ${cx} ${yB + 1.6}" stroke="@toileDeVoileO" stroke-width="0.7" opacity="0.4" fill="none"/>`;
}

function profile(): string {
  return '<g>'
    + rudder(-48, -18)
    // Trois mâts élancés : artimon latin sur le demi-pont, grand mât (2 étages), misaine (2 étages) ;
    // beaupré à civadière. Longues flammes de guerre.
    + spar(-32, -22, -32, -82, 2.2)
    + lateenSail([-24, -78], [-42, -42], [-27, -26], [3, 5])
    + spar(-2, -13, -2, -112, 2.8)
    + squareSail(-2, -68, 40, 17, { seams: 2 }) + squareSail(-2, -104, 30, 12, { seams: 1 }) + hune(-2, -74)
    + spar(24, -13, 24, -94, 2.4)
    + squareSail(24, -62, 32, 14, { seams: 1 }) + squareSail(24, -88, 24, 10, { seams: 1 }) + hune(24, -68)
    + spar(44, -21, 60, -32, 2)
    + squareSail(53, -30, 10, 4.5)
    + stay(-2, -112, 24, -24) + stay(-2, -112, -32, -30) + stay(24, -94, 58, -31) + stay(-32, -82, -51, -31)
    + pennant(-2, -112, 14) + pennant(24, -94, 10) + pennant(-32, -82, 9)
    // COQUE en marches intégrées (UNE silhouette) : tableau arrière quasi vertical → dunette →
    // demi-pont → embelle longue et BASSE → gaillard d'avant → étrave élancée sur l'avant.
    + '<path d="M-52 -32 L-44 -31 L-44 -25.5 L-16 -24 L-16 -14.8 L30 -14.2 L30 -20 L52 -22 L44 -1.5 Q0 3 -48 -1.5 Z" fill="@coque" stroke="@coqueO" stroke-width="1.5"/>'
    + '<path d="M-52 -32 L-44 -31 M-44 -25.5 L-16 -24 M-16 -14.8 L30 -14.2 M30 -20 L52 -22" fill="none" stroke="@coqueH" stroke-width="1.3"/>'
    // GUIBRE (éperon d'étrave effilé — la ligne rapide) + figure de proue.
    + '<path d="M52 -22 L62 -17 Q56 -18.5 50 -14.5 Z" fill="@coque" stroke="@coqueO" stroke-width="1"/>'
    + '<circle cx="61.5" cy="-17.6" r="1.5" fill="@pavillon"/>'
    // Deux préceintes filant sur toute la longueur + bordages suggérés.
    + '<path d="M-50 -19 Q0 -14 47 -18 M-49 -10.5 Q0 -6.5 45 -9.5" fill="none" stroke="@coqueH" stroke-width="1.2" opacity="0.85"/>'
    + '<path d="M-48 -5.5 Q0 -1.5 44 -5" fill="none" stroke="@coqueO" stroke-width="0.7" opacity="0.4"/>'
    // BATTERIE : rangée basse continue (9 sabords) + sabords hauts du demi-pont.
    + gunports(-40, 38, 9, -14.2, 2.8)
    + gunports(-40, -22, 4, -20.5, 2.6)
    // Galerie de poupe (fenêtres du flanc de dunette) et pavois crénelé SUR le rail du demi-pont.
    + '<path d="M-50 -28 l2.5 0 m2.5 0 l2.5 0" stroke="@toileDeVoileH" stroke-width="1.6"/>'
    + castle(-44, -16, -27, -24, 3)
    // Tourelles en poivrière (signature de la planche) : taffrail et coupée avant du demi-pont.
    + turret(-50, -32) + turret(-18, -27)
    + flag(-45, -31, 7, 4.5)
    + '</g>';
}

function front(): string {
  return '<g>'
    // Pyramide de toile vue de PROUE : misaine pleine, hunier, puis grand hunier au-dessus.
    + spar(0, -14, 0, -110, 2.6)
    + axialSail(0, -56, 30, 20)
    + axialSail(0, -82, 18, 13)
    + axialSail(0, -106, 16, 10)
    + hune(0, -86)
    + stay(0, -110, -11, -14.5) + stay(0, -110, 11, -14.5)
    + stay(0, -82, -12, -13.5) + stay(0, -82, 12, -13.5)
    + pennant(0, -110, 11)
    // ÉTRAVE de face : muraille étroite évasée, rails montant vers la tête d'étrave centrale.
    + '<path d="M-11.5 -15 Q-13 -6 -7.5 -1.5 L7.5 -1.5 Q13 -6 11.5 -15 Q6 -19 0 -21.5 Q-6 -19 -11.5 -15 Z" fill="@coque" stroke="@coqueO" stroke-width="1.5"/>'
    + '<path d="M-11.5 -15 Q-6 -19 0 -21.5 Q6 -19 11.5 -15" fill="none" stroke="@coqueH" stroke-width="1.3"/>'
    // Étrave axiale + préceintes enveloppant la joue.
    + '<path d="M0 -20 L0 -2" stroke="@coqueO" stroke-width="1.2"/>'
    + '<path d="M-11 -12 Q0 -16 11 -12 M-10 -6.5 Q0 -10 10 -6.5" fill="none" stroke="@coqueH" stroke-width="1.1" opacity="0.8"/>'
    // Sabords de chasse encadrant l'étrave.
    + gunports(-4.5, 4.5, 2, -11, 2.6)
    // Beaupré pointé vers le spectateur (raccourci) + figure de proue sous la tête d'étrave.
    + spar(0, -21.5, 0, -29, 3)
    + '<circle cx="0" cy="-30.5" r="1.8" fill="@mat" stroke="@matO" stroke-width="0.7"/>'
    + '<circle cx="0" cy="-17.5" r="1.6" fill="@pavillon"/>'
    + '</g>';
}

function back(): string {
  return '<g>'
    // Grand mât dépassant le tableau, toile vue de poupe, artimon nu au plus près.
    + spar(0, -24, 0, -112, 2.6)
    + axialSail(0, -64, 28, 19)
    + axialSail(0, -98, 16, 11)
    + hune(0, -70)
    + spar(0, -26, 0, -84, 2)
    + stay(0, -112, -12, -25) + stay(0, -112, 12, -25)
    + pennant(0, -112, 12) + pennant(0, -84, 8)
    // TABLEAU ARRIÈRE plat, évasé vers le taffrail arqué — le volume du type, pas un aplat.
    + '<path d="M-8.5 -1.5 L8.5 -1.5 L13 -24 Q0 -27.5 -13 -24 Z" fill="@coque" stroke="@coqueO" stroke-width="1.5"/>'
    + '<path d="M-13 -24 Q0 -27.5 13 -24" fill="none" stroke="@coqueH" stroke-width="1.3"/>'
    // Moulures horizontales + GALERIE de fenêtres de poupe.
    + '<path d="M-11.5 -18.5 L11.5 -18.5 M-10.5 -12.5 L10.5 -12.5" stroke="@coqueH" stroke-width="0.9" opacity="0.8"/>'
    + '<path d="M-10.5 -21 l3 0 m2.2 0 l3 0 m2.2 0 l3 0 m2.2 0 l3 0" stroke="@toileDeVoileH" stroke-width="1.7"/>'
    // Écusson de poupe + sabords de retraite.
    + '<circle cx="0" cy="-8.5" r="2.6" fill="@pavillon" stroke="@coqueO" stroke-width="0.8"/>'
    + gunports(-8.5, 8.5, 2, -8.5, 2.6)
    // Safran sous le tableau.
    + '<path d="M-1.6 -1.5 L1.6 -1.5 L1.1 1 L-1.1 1 Z" fill="@coque" stroke="@coqueO" stroke-width="0.9"/>'
    // Tourelles en poivrière aux ANGLES du taffrail (signature) + lanterne de poupe centrale.
    + turret(-11, -25) + turret(11, -25)
    + spar(0, -26.5, 0, -30.5, 1)
    + '<circle cx="0" cy="-32" r="1.7" fill="@pavillon" stroke="@coqueO" stroke-width="0.7"/>'
    + '</g>';
}

export const hullArt: ShipArtDef = { id: 'croiseur', front, profile, back };
