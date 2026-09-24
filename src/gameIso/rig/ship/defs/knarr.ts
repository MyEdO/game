/**
 * KNARR (MDG, ~15 m, mixte) — cargo norse à clins : coque PROFONDE et ventrue (vrai franc-bord,
 * pas un croissant), étrave et étambot en timbres montants terminés en pointe, virures à clins
 * suivant la tonture, godille de GOUVERNE LATÉRALE sur la hanche, mât central-avant à voile
 * carrée frappée d'une croix, fret bâché amarré au milieu. Réf : planche MDG 12 p.098 (en tête).
 */
import type { ShipArtDef } from '../artkit';
import { oarBank, pennant, spar, squareSail, stay } from '../artkit';

/** Croix peinte de la voile (jeton @pavillon), centrée sur (cx, cy). */
const sailCross = (cx: number, cy: number, arm: number, w = 2.6, op = 0.85): string =>
  `<path d="M${cx} ${cy - arm} l0 ${arm * 2} M${cx - arm * 0.85} ${cy + arm * 0.12} l${arm * 1.7} 0" stroke="@pavillon" stroke-width="${w}" opacity="${op}" stroke-linecap="round"/>`;

/** Fret bâché (tonneaux sous toile cirée, lignes de saisine). */
const cargoTarp = (x0: number, x1: number, yDeck: number, h: number): string => {
  const cx = (x0 + x1) / 2;
  return `<path d="M${x0} ${yDeck} Q${x0 + 1} ${yDeck - h} ${cx} ${yDeck - h - 0.6} Q${x1 - 1} ${yDeck - h} ${x1} ${yDeck} Z" fill="@toileDeVoileO" stroke="@matO" stroke-width="0.8"/>`
    + `<path d="M${x0 + (x1 - x0) * 0.3} ${yDeck - h + 0.4} l0.6 ${h - 0.8} M${x0 + (x1 - x0) * 0.68} ${yDeck - h + 0.2} l0.4 ${h - 0.6}" stroke="@matO" stroke-width="0.6" opacity="0.7" fill="none"/>`;
};

function profile(): string {
  return '<g>'
    // Avirons d'appoint (gréement mixte), nage vers l'arrière.
    + oarBank(-12, -6, 2, -8, 4.5)
    // Gréement : mât central-avant, voile carrée à croix, étai vers l'étrave, galhauban vers l'étambot.
    + spar(2, -8, 2, -58, 2.4)
    + squareSail(2, -54, 28, 13, { seams: 1 })
    + sailCross(3, -40, 9)
    + stay(2, -58, 21, -18) + stay(2, -58, -19, -17)
    + pennant(2, -58, 8)
    // Coque PLEINE : tonture (plat-bord) haute aux extrémités, fond courbe à la flottaison,
    // étrave et étambot en timbres qui MONTENT depuis la quille — jamais un simple croissant.
    + '<path d="M23 -23 Q19 -13 13 -10 Q0 -7.8 -13 -10 Q-19 -13 -21.5 -22 Q-26 -12 -16 -0.5 Q0 2.2 19 -0.5 Q27 -13 23 -23 Z" fill="@coque" stroke="@coqueO" stroke-width="1.4"/>'
    // Livet en surbrillance suivant la tonture, d'un timbre à l'autre.
    + '<path d="M-21.5 -22 Q-19 -13 -13 -10 Q0 -7.8 13 -10 Q19 -13 23 -23" fill="none" stroke="@coqueH" stroke-width="1.2"/>'
    // Bordé à CLINS : trois virures parallèles à la tonture.
    + '<path d="M-19 -11 Q0 -6.2 19 -11.5 M-18 -7 Q0 -3.4 18 -7.5 M-16.5 -3 Q0 -0.4 16.5 -3.4" fill="none" stroke="@coqueO" stroke-width="0.8" opacity="0.5"/>'
    // Pointes des timbres (léger déversement vers l'extérieur, planche MDG).
    + '<path d="M23 -23 q1.8 -2 1 -4.8 M-21.5 -22 q-1.8 -2 -0.9 -4.6" fill="none" stroke="@coque" stroke-width="2" stroke-linecap="round"/>'
    // GOUVERNE LATÉRALE norse (godille sur la hanche arrière tribord, côté spectateur).
    + spar(-15, -8.5, -18.6, 2.5, 1.8)
    + '<path d="M-18.2 1 L-21.4 2 L-20.2 6.4 L-17.2 4.6 Z" fill="@coque" stroke="@coqueO" stroke-width="0.9"/>'
    // Fret amarré au milieu, posé DANS la coque (la bâche déborde du plat-bord).
    + cargoTarp(-9, 5, -8.4, 4.4)
    + '</g>';
}

function front(): string {
  return '<g>'
    // Voile carrée VENTRE au vent, vue de face : la toile masque le mât, la croix regarde la proue.
    + spar(-11, -50, 11, -50, 1.8)
    + '<path d="M-10.5 -49 Q-14 -40 -12.5 -29 Q0 -26.5 12.5 -29 Q14 -40 10.5 -49 Z" fill="@toileDeVoile" stroke="@toileDeVoileO" stroke-width="1"/>'
    + sailCross(0, -39, 6.5, 2.4)
    + spar(0, -50, 0, -57, 2) + pennant(0, -57, 7)
    + stay(-11, -50, -8, -15) + stay(11, -50, 8, -15)
    // Fret dépassant du plat-bord au milieu du navire.
    + '<path d="M-4.5 -15.5 Q0 -20 4.5 -15.5 Z" fill="@toileDeVoileO" stroke="@matO" stroke-width="0.8"/>'
    // Coque de FACE : section ronde et ventrue, tonture qui remonte vers les joues.
    + '<path d="M-10 -14 Q0 -17.5 10 -14 L6.5 0.5 Q0 2.8 -6.5 0.5 Z" fill="@coque" stroke="@coqueO" stroke-width="1.4"/>'
    + '<path d="M-10 -14 Q0 -17.5 10 -14" fill="none" stroke="@coqueH" stroke-width="1.1"/>'
    // Clins en anneaux concentriques.
    + '<path d="M-8.8 -9.5 Q0 -12.6 8.8 -9.5 M-7.4 -4.5 Q0 -7.4 7.4 -4.5" fill="none" stroke="@coqueO" stroke-width="0.8" opacity="0.5"/>'
    // TIMBRE D'ÉTRAVE plein axe, montant en pointe au-dessus du plat-bord.
    + '<path d="M-1.6 -15.6 Q-1.2 -21.5 0 -24.5 Q1.2 -21.5 1.6 -15.6 L1.9 -4 L-1.9 -4 Z" fill="@coque" stroke="@coqueO" stroke-width="1"/>'
    + '</g>';
}

function back(): string {
  return '<g>'
    // Voile vue de POUPE (face arrière, légèrement creusée) — le mât passe DEVANT la toile.
    + spar(-11.5, -50, 11.5, -50, 1.8)
    + '<path d="M-10.5 -49 Q-11.8 -40 -11 -29.5 Q0 -27.5 11 -29.5 Q11.8 -40 10.5 -49 Z" fill="@toileDeVoile" stroke="@toileDeVoileO" stroke-width="1"/>'
    + sailCross(0, -39, 6.5, 2.4, 0.7)
    + stay(-11.5, -50, -8, -15) + stay(11.5, -50, 8, -15)
    + spar(0, -9, 0, -57, 2.2) + pennant(0, -57, 7)
    // Fret bâché au-dessus du plat-bord.
    + '<path d="M-4.5 -15.5 Q0 -19.6 4.5 -15.5 Z" fill="@toileDeVoileO" stroke="@matO" stroke-width="0.8"/>'
    // Coque de POUPE : même section ronde que la proue (double-bout norse).
    + '<path d="M-10 -14 Q0 -17.5 10 -14 L6.5 0.5 Q0 2.8 -6.5 0.5 Z" fill="@coque" stroke="@coqueO" stroke-width="1.4"/>'
    + '<path d="M-10 -14 Q0 -17.5 10 -14" fill="none" stroke="@coqueH" stroke-width="1.1"/>'
    + '<path d="M-8.8 -9.5 Q0 -12.6 8.8 -9.5 M-7.4 -4.5 Q0 -7.4 7.4 -4.5" fill="none" stroke="@coqueO" stroke-width="0.8" opacity="0.5"/>'
    // TIMBRE D'ÉTAMBOT plein axe.
    + '<path d="M-1.5 -15.6 Q-1.1 -21 0 -24 Q1.1 -21 1.5 -15.6 L1.8 -4 L-1.8 -4 Z" fill="@coque" stroke="@coqueO" stroke-width="1"/>'
    // GOUVERNE LATÉRALE sur la hanche (barre franche rentrant vers le barreur + safran plongeant).
    + spar(6, -13.5, 1.8, -15.2, 1.2)
    + spar(6, -13.5, 9, 2, 1.6)
    + '<path d="M9 2 l3.2 0.6 l-1.4 4.4 l-2.6 -1.8 Z" fill="@coque" stroke="@coqueO" stroke-width="0.9"/>'
    + '</g>';
}

export const hullArt: ShipArtDef = { id: 'knarr', front, profile, back };
