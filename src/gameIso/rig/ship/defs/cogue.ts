/**
 * COGUE (MDG, ~25 m, voile) — kogge hanséatique : QUILLE plate et étrave/étambot DROITS et
 * inclinés (la charpente signature du type — pas de croissant lisse), bordé à clins, safran
 * suspendu à l'étambot, château arrière crénelé PORTÉ par la muraille (assise = la tonture,
 * dos = l'étambot), petit gaillard en surplomb de l'étrave, UN mât central à grande voile
 * carrée avec hune. Trait de famille : planches MDG 12 p.098 / MDG 13 p.114.
 */
import type { ShipArtDef } from '../artkit';
import { flag, hune, pennant, spar, squareSail, stay } from '../artkit';

const r = (v: number): string => (Math.round(v * 10) / 10).toString();

/** Course de CRÉNEAUX d'un parapet, en segment de path (de x0 à x1, merlons à yTop). */
function merlons(x0: number, x1: number, yTop: number, teeth: number, notch = 2.6): string {
  const tw = (x1 - x0) / (teeth * 2 - 1);
  let d = ` L${r(x0)} ${r(yTop)}`;
  for (let i = 0; i < teeth * 2 - 1; i++) {
    const y = i % 2 ? yTop + notch : yTop;
    d += ` L${r(x0 + i * tw)} ${r(y)} L${r(x0 + (i + 1) * tw)} ${r(y)}`;
  }
  return d;
}

function profile(): string {
  return '<g>'
    // Safran suspendu à l'ÉTAMBOT incliné, aiguillots marqués.
    + '<path d="M-29 -22 L-33.8 -21 L-27.2 -0.5 L-24.6 -0.8 Z" fill="@coque" stroke="@coqueO" stroke-width="1"/>'
    + '<path d="M-28.4 -17.5 l-3.4 0.7 M-26.2 -9.5 l-3.4 0.7" stroke="@coqueO" stroke-width="0.9"/>'
    // Gréement : mât central puissant, grande voile carrée à ris, hune, étais vers étrave et château.
    + spar(2, -15, 2, -90, 3)
    + squareSail(2, -79, 42, 17, { seams: 2, reefs: 2 })
    + hune(2, -85)
    + stay(2, -90, 31, -29) + stay(2, -90, -29, -35) + stay(2, -79, 27, -25)
    + pennant(2, -90, 10)
    // COQUE charpentée : tonture franche mais quille PLATE, étrave et étambot DROITS inclinés.
    + '<path d="M-29 -25 Q-14 -16.5 0 -15.5 Q15 -17 30 -27 L23 -1 Q0 1.6 -22 -1 Z" fill="@coque" stroke="@coqueO" stroke-width="1.5"/>'
    + '<path d="M-29 -25 Q-14 -16.5 0 -15.5 Q15 -17 30 -27" fill="none" stroke="@coqueH" stroke-width="1.4"/>'
    // Étrave et étambot en bois massif dépassant le plat-bord + semelle de quille.
    + '<path d="M32 -30 L23 -1" stroke="@coqueO" stroke-width="2.2" stroke-linecap="round"/>'
    + '<path d="M-31 -28 L-22 -1" stroke="@coqueO" stroke-width="2.2" stroke-linecap="round"/>'
    + '<path d="M-22.5 -0.4 L23.5 -0.4" stroke="@coqueO" stroke-width="1.7"/>'
    // Bordé à CLINS : préceinte marquée + virures suivant la tonture.
    + '<path d="M-28.2 -21.5 Q0 -12.8 28.8 -23.2" fill="none" stroke="@coqueH" stroke-width="1.2" opacity="0.8"/>'
    + '<path d="M-27 -17 Q0 -9.5 27.5 -18.5 M-25.7 -12 Q0 -5.6 26 -13 M-24.3 -7 Q0 -1.8 24.6 -8" fill="none" stroke="@coqueO" stroke-width="0.8" opacity="0.5"/>'
    // CHÂTEAU ARRIÈRE : volume UNIQUE prolongeant la muraille — assise épousant la tonture,
    // dos appuyé sur la tête d'étambot, jambettes et bordages apparents, contrefiche au pont.
    + '<path d="M-12 -17.6 L-12 -33' + merlons(-12, -31, -35.6, 4) + ' L-31 -28 L-29 -25 Q-21 -19.6 -12 -17.6 Z" fill="@coque" stroke="@coqueO" stroke-width="1.2"/>'
    + '<path d="M-17.5 -18.6 L-17.5 -33 M-23.5 -21 L-23.5 -34" stroke="@coqueO" stroke-width="1" opacity="0.7"/>'
    + '<path d="M-29.6 -27.6 L-12 -25.4 M-30.4 -31 L-12 -29.2" stroke="@coqueO" stroke-width="0.6" opacity="0.5"/>'
    + '<path d="M-12 -24.5 L-5.8 -16.4" stroke="@coqueO" stroke-width="1.1"/>'
    // GAILLARD AVANT plus modeste, en surplomb de la tête d'étrave, contrefiché sur le pont.
    + '<path d="M17 -18.6 L17 -30.6' + merlons(17, 33, -32.8, 3, 2.2) + ' L33 -25.8 L30.8 -26.6 Q23 -20.6 17 -18.6 Z" fill="@coque" stroke="@coqueO" stroke-width="1.2"/>'
    + '<path d="M22.5 -19.8 L22.5 -31 M28 -22.6 L28 -31.6" stroke="@coqueO" stroke-width="0.9" opacity="0.7"/>'
    + '<path d="M17 -25 L11.4 -16.8" stroke="@coqueO" stroke-width="1.1"/>'
    + flag(-28, -37.4, 7, 4.5)
    + '</g>';
}

function front(): string {
  return '<g>'
    // Mât puis voile carrée PLEIN CADRE (vent portant : le ventre vient au spectateur).
    + spar(0, -30, 0, -86, 2.6)
    + spar(-23, -69, 23, -69, 1.8)
    + '<path d="M-20 -67 Q-25 -49 -19 -31 Q0 -27.5 19 -31 Q25 -49 20 -67 Q0 -70.5 -20 -67 Z" fill="@toileDeVoile" stroke="@toileDeVoileO" stroke-width="1"/>'
    + '<path d="M-7 -68.3 Q-9.4 -49 -6.6 -29.8 M7 -68.3 Q9.4 -49 6.6 -29.8" fill="none" stroke="@toileDeVoileO" stroke-width="0.7" opacity="0.4"/>'
    + '<path d="M-21 -55 Q0 -51.5 21 -55 M-20 -43 Q0 -39.8 20 -43" fill="none" stroke="@toileDeVoileO" stroke-width="0.7" opacity="0.35"/>'
    + hune(0, -82) + pennant(0, -86, 9)
    + stay(0, -84, -16, -23) + stay(0, -84, 16, -23)
    // Coque vue de PROUE : muraille évasée à clins, étrave en bois massif dans l'axe.
    + '<path d="M-15.5 -23 Q-18.5 -8 -10.5 -1.5 Q0 2.6 10.5 -1.5 Q18.5 -8 15.5 -23 Q0 -28.2 -15.5 -23 Z" fill="@coque" stroke="@coqueO" stroke-width="1.5"/>'
    + '<path d="M-16.7 -16.5 Q0 -21 16.7 -16.5 M-16.8 -10.5 Q0 -14.6 16.8 -10.5 M-14.3 -4.8 Q0 -8.2 14.3 -4.8" fill="none" stroke="@coqueO" stroke-width="0.8" opacity="0.5"/>'
    + '<path d="M0 -33.5 L0 -2" stroke="@coqueO" stroke-width="2.4" stroke-linecap="round"/>'
    // Gaillard crénelé assis sur la lisse de proue (la tête d'étrave pointe dans le créneau axial).
    + '<path d="M-13 -22.6 L-13 -28.6' + merlons(-13, 13, -30.8, 4, 2.2) + ' L13 -22.6 Q0 -27.4 -13 -22.6 Z" fill="@coque" stroke="@coqueO" stroke-width="1.1"/>'
    + '<path d="M-12.4 -27 L12.4 -27" stroke="@coqueO" stroke-width="0.6" opacity="0.5"/>'
    + '</g>';
}

function back(): string {
  return '<g>'
    // Dos de la voile carrée, mât au premier plan.
    + spar(-23, -69, 23, -69, 1.8)
    + '<path d="M-20 -67 Q-24 -49 -19 -31 Q0 -28.5 19 -31 Q24 -49 20 -67 Q0 -69.3 -20 -67 Z" fill="@toileDeVoile" stroke="@toileDeVoileO" stroke-width="1"/>'
    + '<path d="M-6.8 -68 Q-9 -49 -6.4 -30.4 M6.8 -68 Q9 -49 6.4 -30.4" fill="none" stroke="@toileDeVoileO" stroke-width="0.7" opacity="0.4"/>'
    + spar(0, -31, 0, -86, 2.6)
    + hune(0, -82) + pennant(0, -86, 9)
    // Poupe : muraille à clins resserrée sur l'ÉTAMBOT axial, safran suspendu dans l'axe.
    + '<path d="M-13.5 -22 Q-16.5 -8 -9.5 -1.5 Q0 2.6 9.5 -1.5 Q16.5 -8 13.5 -22 Q0 -26.6 -13.5 -22 Z" fill="@coque" stroke="@coqueO" stroke-width="1.5"/>'
    + '<path d="M-14.7 -15.5 Q0 -19.4 14.7 -15.5 M-14.8 -9.8 Q0 -13.2 14.8 -9.8 M-12.4 -4.4 Q0 -7.4 12.4 -4.4" fill="none" stroke="@coqueO" stroke-width="0.8" opacity="0.5"/>'
    + '<path d="M0 -29 L0 -1.2" stroke="@coqueO" stroke-width="2.2" stroke-linecap="round"/>'
    + '<path d="M-2 -12 L2 -12 L2.8 -0.8 L-2.8 -0.8 Z" fill="@coque" stroke="@coqueO" stroke-width="1"/>'
    + '<path d="M-4.4 -17 L4.4 -17 M-4 -9.4 L4 -9.4" stroke="@coqueO" stroke-width="1" opacity="0.7"/>'
    // CHÂTEAU ARRIÈRE pleine largeur : parapet crénelé, assise sur la lisse de poupe, fenêtres.
    + '<path d="M-15 -22.2 L-15 -32.4' + merlons(-15, 15, -35, 5) + ' L15 -22.2 Q0 -26.8 -15 -22.2 Z" fill="@coque" stroke="@coqueO" stroke-width="1.2"/>'
    + '<path d="M-14.2 -28.4 L14.2 -28.4 M-14.5 -31.4 L14.5 -31.4" stroke="@coqueO" stroke-width="0.6" opacity="0.5"/>'
    + '<path d="M-6 -30.4 l0 2.4 M6 -30.4 l0 2.4" stroke="@toileDeVoileH" stroke-width="1.4"/>'
    + stay(0, -84, -13, -33) + stay(0, -84, 13, -33)
    + flag(10.5, -35.4, 6, 4)
    + '</g>';
}

export const hullArt: ShipArtDef = { id: 'cogue', front, profile, back };
