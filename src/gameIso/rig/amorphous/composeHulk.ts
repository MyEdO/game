/**
 * Gabarit AMORPHE / HULK, trois formes par props :
 * - `blob` (défaut — oozes, golems de boue) : masse BOURSOUFLÉE irrégulière qui tremblote,
 *   visage à plusieurs yeux asymétriques + gueule, deux moignons de bras, bas qui dégouline.
 * - `gel` (Amibe, fidèle à l'artwork ZI 5 p.48) : masse GÉLATINEUSE TRANSLUCIDE dressée (plus haute
 *   que large), fill semi-transparent gris-turquoise à fine membrane rosâtre — SANS visage ; son
 *   identité = les proies ENGLOUTIES visibles par transparence (squelette : crâne, cage
 *   thoracique, os épars ; épée, anneau, débris), bulles internes, socle de vase sombre opaque
 *   où la digestion s'achève + gouttelette satellite.
 * - `brute` (Bête des marais, fidèle à l'artwork LDB 79 p.320) : colosse VOÛTÉ de mousse et de
 *   racines, silhouette humanoïde asymétrique — épaules énormes, tête basse fondue dans la masse
 *   (masque végétal à lueurs pâles + alvéoles), bras-troncs évasés dont les doigts-racines
 *   touchent terre, PAS de jambes : le bas fond en jupe de vase qui dégouline dans une flaque.
 * Anim commune au plan : tremblotement/pulsation au repos, embardée au déplacement, abattage des
 * bras à l'attaque, affaissement à la mort.
 */
import type { BonePose } from '../poses';
import type { ResolvedBone } from '../composeRig';
import type { BodyPlan } from '../bodyPlan';
import type { View } from '../facing';
import type { Palette, PaletteDeclaree } from '../palette';
import { worldTransformsG, type FKBone, type Matrix } from '../kinematics';
import { buildTokenMap, applyTokenMap } from '../palette';
import { bonesToSvg } from '../renderBones';
import { HULK_SPECIES } from '../creatures';
import { sortByZ } from '../composite';

export type HulkBoneId = 'corps' | 'brasG' | 'brasD';
type HBone = FKBone & { z: number };
export interface HulkProps {
  sl: number;
  girth: number; // ampleur de la masse
  /** Forme : `blob` (défaut) = masse informe à moignons ; `gel` = gelée translucide à proies
   *  englouties ; `brute` = colosse bipède voûté. */
  form?: 'blob' | 'gel' | 'brute';
  palette: PaletteDeclaree;
}

function buildSkeleton(p: HulkProps): Record<HulkBoneId, HBone> {
  // brute : les bras s'ancrent aux ÉPAULES (haut de la masse) et suivent l'ampleur ; blob :
  // moignons à mi-masse ; gel : pseudopodes discrets à mi-hauteur de la masse dressée.
  const ax = p.form === 'brute' ? 20 * p.girth : p.form === 'gel' ? 17 * p.girth : 19;
  const ay = p.form === 'brute' ? -26 : p.form === 'gel' ? -9 : -2;
  return {
    corps: { parent: null, pivot: { x: 60, y: 92 }, angle: 0, z: 3 },
    brasG: { parent: 'corps', pivot: { x: -ax, y: ay }, angle: 0, z: 2 },
    brasD: { parent: 'corps', pivot: { x: ax, y: ay }, angle: 0, z: 4 },
  };
}

function blob(p: HulkProps, view: View): string {
  const g = p.girth;
  const W = (n: number) => (n * g).toFixed(1);
  // masse bosselée (contour irrégulier) + grumeaux clairs/sombres + dégoulinures au bas
  const mass = `<path d="M${W(-24)} 8 Q${W(-29)} -8 ${W(-18)} -19 Q${W(-9)} -27 0 -25 Q${W(12)} -28 ${W(20)} -18 Q${W(29)} -8 ${W(24)} 8 Q${W(27)} 21 ${W(13)} 27 Q0 31 ${W(-14)} 27 Q${W(-27)} 21 ${W(-24)} 8 Z" fill="@corps" stroke="@corpsO" stroke-width="0.8"/>`;
  const lumps = `<circle cx="${W(-12)}" cy="-11" r="6" fill="@corpsH" opacity="0.28"/><circle cx="${W(10)}" cy="-7" r="7" fill="@corpsH" opacity="0.22"/>` +
    `<circle cx="${W(-9)}" cy="13" r="5" fill="@corpsO" opacity="0.4"/><circle cx="${W(14)}" cy="11" r="6" fill="@corpsO" opacity="0.32"/><circle cx="${W(2)}" cy="-18" r="3.4" fill="@corpsO" opacity="0.3"/>`;
  const drips = `<path d="M${W(-15)} 25 q-1 7 1 11 q2 -1 2 -5 q1 5 3 6 q1 -2 0 -7 Z" fill="@corps" stroke="@corpsO" stroke-width="0.5"/>` +
    `<path d="M${W(9)} 26 q1 8 -1 12 q-2 -1 -2 -6 q-1 4 -3 5 q-1 -3 1 -8 Z" fill="@corps" stroke="@corpsO" stroke-width="0.5"/>`;
  // « Vaguement humanoïde » (canon) : BOSSE DE TÊTE émergeant de la masse + épaulements —
  // l'ovale uniforme lisait « blob-patate » (verdict des juges aveugles, lot 4).
  const dome = `<path d="M${W(-9)} -24 Q${W(-7)} -33 ${W(1)} -33.5 Q${W(9)} -33 ${W(10)} -24 Q${W(4)} -27.5 ${W(-3)} -27.5 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
    `<path d="M${W(-20)} -19 q-3 -4 -1 -7 M${W(20)} -18 q3 -4 1 -7" stroke="@corpsO" stroke-width="1.4" fill="none" opacity="0.6"/>`; // épaulements de boue
  if (view === 'back') return `<g>${drips}${mass}${dome}${lumps}<path d="M0 -22 Q3 0 0 24" stroke="@corpsO" stroke-width="1" opacity="0.35" fill="none"/></g>`;
  // visage : 3 yeux asymétriques (luisants jaunâtres) + gueule édentée — décalés vers l'AVANT
  // (+x) au profil pour donner une lecture d'orientation.
  const fx = view === 'profile' ? 6 : 0;
  const eyes = `<g transform="translate(${fx},0)"><circle cx="-8" cy="-5" r="3.6" fill="#e8e0c8"/><circle cx="-7.4" cy="-4" r="1.9" fill="#1a0e08"/>` +
    `<circle cx="8" cy="-7" r="3" fill="#e8e0c8"/><circle cx="8.6" cy="-6" r="1.5" fill="#1a0e08"/>` +
    `<circle cx="2" cy="1" r="2.3" fill="#e8e0c8"/><circle cx="2" cy="1.6" r="1.1" fill="#1a0e08"/></g>`;
  const maw = view === 'profile'
    ? `<path d="M0 13 Q8 17 ${W(17)} 11 Q${W(13)} 19 4 19 Q0 17 0 13 Z" fill="#190d08"/>` + // gueule fendue vers l'avant
      `<path d="M4 14 l1 3 l1.6 -2.8 M10 14.4 l0.9 3 l1.5 -2.8" stroke="#cabfa8" stroke-width="0.6" fill="none"/>`
    : `<path d="M-11 13 Q0 18 12 12 Q7 20 0 20 Q-7 20 -11 13 Z" fill="#190d08"/>` +
      `<path d="M-7 13.6 l1 3.4 l1.6 -3 M-1 14.6 l0.8 3.6 l1.6 -3.4 M5 13.8 l1 3.2 l1.4 -3" stroke="#cabfa8" stroke-width="0.6" fill="none"/>`;
  return `<g>${drips}${mass}${dome}${lumps}${eyes}${maw}</g>`;
}
function gel(p: HulkProps, view: View): string {
  const g = p.girth;
  const W = (n: number) => (n * g).toFixed(1);
  // socle de vase sombre OPAQUE (la digestion s'achève au bas de la masse) : bourrelet lobé +
  // flaque, dégoulinures, gouttelette satellite détachée, anneau à demi englouti dans la flaque
  const pool = `<path d="M${W(-27)} 26.5 Q${W(-31)} 23 ${W(-22)} 22 Q${W(-13)} 20.5 ${W(-4)} 22 Q${W(7)} 20.5 ${W(16)} 22 Q${W(28)} 23.5 ${W(24)} 27.5 Q${W(14)} 30.5 0 30.5 Q${W(-17)} 30.5 ${W(-27)} 26.5 Z" fill="@cheveuxO" opacity="0.75"/>`;
  const sludge = `<path d="M${W(-22)} 24 Q${W(-25)} 15 ${W(-17)} 12 Q${W(-9)} 9 0 10.5 Q${W(9)} 9 ${W(16)} 12.5 Q${W(24)} 16 ${W(20)} 24 Q${W(12)} 27.5 0 27.5 Q${W(-13)} 27.5 ${W(-22)} 24 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.8"/>` +
    `<ellipse cx="${W(-9)}" cy="15" rx="4.6" ry="2.6" fill="@corpsH" opacity="0.18"/><ellipse cx="${W(10)}" cy="17" rx="3.6" ry="2" fill="@corpsH" opacity="0.14"/>` +
    `<path d="M${W(-16)} 25 q-1.2 5.6 0.2 8.6 q1.8 -1 2 -4.8 q0.8 4.2 2.4 5 q1.2 -2.2 0.4 -6.8 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.5"/>` +
    `<path d="M${W(11)} 26 q0.6 5.8 2 8.2 q1.4 -1.4 1 -5 q1.2 3.4 2.4 3.8 q0.6 -2.8 -0.6 -6.6 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.5"/>`;
  const droplet = `<ellipse cx="${W(31)}" cy="26.5" rx="3.8" ry="3" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.6"/><path d="M${W(29.5)} 25 q1.5 -1.4 3 -0.4" stroke="@corpsH" stroke-width="0.7" fill="none" opacity="0.4"/>`;
  const ring = `<ellipse cx="${W(-23)}" cy="24" rx="5.4" ry="2.6" fill="none" stroke="@cuir" stroke-width="1.1" transform="rotate(-14 ${W(-23)} 24)"/>`;
  // masse gélatineuse TRANSLUCIDE dressée (plus haute que large), contour bosselé irrégulier,
  // fill semi-transparent + fine membrane rosâtre (@membrane) — SANS visage
  const massD = `M${W(-19)} 17 Q${W(-27)} 13 ${W(-23)} 4 Q${W(-29)} -2 ${W(-22)} -9 Q${W(-27)} -17 ${W(-18)} -23 Q${W(-23)} -30 ${W(-13)} -34 Q${W(-12)} -41 ${W(-3)} -40.5 Q${W(6)} -43 ${W(10)} -36.5 Q${W(19)} -34.5 ${W(15)} -27 Q${W(24)} -22 ${W(19)} -15 Q${W(26)} -8 ${W(21)} -1 Q${W(26)} 7 ${W(18)} 14 Q${W(9)} 19.5 0 19.5 Q${W(-11)} 19.5 ${W(-19)} 17 Z`;
  const mass = `<path d="${massD}" fill="@corps" fill-opacity="0.62" stroke="none"/>`;
  // dégradé interne (artwork ZI 48 : gelée CLAIRE et lumineuse en haut → s'assombrit en fondant
  // dans la vase du socle) — deux voiles additifs sur tokens existants, pas de <defs>
  const glow = `<path d="M${W(-15)} -22 Q${W(-19)} -31 ${W(-12)} -35 Q${W(-11)} -41 ${W(-3)} -40 Q${W(6)} -42 ${W(9)} -36 Q${W(17)} -34 ${W(14)} -27 Q${W(16)} -20 ${W(11)} -14 Q${W(1)} -18 ${W(-9)} -14 Q${W(-16)} -16 ${W(-15)} -22 Z" fill="@corpsH" opacity="0.38"/>` +
    `<path d="M${W(-17)} -13 Q${W(-4)} -18 ${W(10)} -13 Q${W(14)} -6 ${W(11)} 0 Q0 -4 ${W(-12)} 0 Q${W(-18)} -6 ${W(-17)} -13 Z" fill="@corpsH" fill-opacity="0.2"/>`;
  const shade = `<path d="M${W(-21)} 3 Q${W(-11)} 8 0 8.5 Q${W(12)} 8 ${W(20)} 2 Q${W(25)} 8 ${W(18)} 14 Q${W(9)} 19.5 0 19.5 Q${W(-11)} 19.5 ${W(-19)} 17 Q${W(-26)} 12 ${W(-21)} 3 Z" fill="@cheveux" opacity="0.45"/>` +
    `<path d="M${W(-19)} 11 Q${W(-8)} 15 0 15.2 Q${W(9)} 15 ${W(17)} 10 Q${W(21)} 14 ${W(18)} 14 Q${W(9)} 19.5 0 19.5 Q${W(-11)} 19.5 ${W(-19)} 17 Q${W(-23)} 14 ${W(-19)} 11 Z" fill="@cheveuxO" opacity="0.4"/>`;
  const membrane = `<path d="${massD}" fill="none" stroke="@membrane" stroke-width="1.3" stroke-opacity="0.8"/>` +
    `<path d="${massD}" fill="none" stroke="@corpsH" stroke-width="0.5" stroke-opacity="0.45" transform="scale(0.965)"/>`;
  // LE trait distinctif (ZI 48) : proies ENGLOUTIES en silhouettes sombres visibles PAR
  // TRANSPARENCE — squelette suspendu (crâne penché, cage thoracique, bras d'os, bassin),
  // épée inclinée, débris. Dessinées SOUS la membrane et les reflets → lecture « dedans ».
  const skull = `<circle cx="0" cy="-25" r="4.2" fill="@cuir" opacity="0.8" stroke="@cheveuxO" stroke-width="0.5" stroke-opacity="0.6"/>` +
    `<circle cx="-1.6" cy="-25.8" r="1.1" fill="@cheveuxO"/><circle cx="1.7" cy="-25.5" r="1.1" fill="@cheveuxO"/>` +
    `<path d="M-2 -21.6 l4 -0.6 M-1.2 -21.8 l0 1.4 M0.8 -22 l0 1.4" stroke="@cheveuxO" stroke-width="0.5" opacity="0.8"/>`;
  const ribs = `<path d="M0 -20 Q0.8 -12 0 -4" stroke="@cuir" stroke-width="1.2" fill="none" opacity="0.8"/>` +
    `<path d="M-0.2 -17.5 q-4.4 1 -5.6 4 M0.2 -17.5 q4.4 1 5.6 4 M-0.2 -14 q-4 1 -5 3.8 M0.2 -14 q4 1 5 3.8 M-0.1 -10.5 q-3.4 1 -4.2 3.2 M0.1 -10.5 q3.4 1 4.2 3.2" stroke="@cuir" stroke-width="0.9" fill="none" opacity="0.75"/>` +
    `<path d="M-2.6 -4.5 q2.6 2.2 5.2 0 q-0.6 3 -2.6 3 q-2 0 -2.6 -3 Z" fill="@cuir" opacity="0.7"/>`;
  const bones = `<path d="M-4 -18 L${W(-11)} -9 M${W(-11)} -9 l-2.6 1.8" stroke="@cuir" stroke-width="1.1" fill="none" opacity="0.7" stroke-linecap="round"/>` +
    `<path d="M4 -17 L${W(10)} -10" stroke="@cuir" stroke-width="1.1" fill="none" opacity="0.7" stroke-linecap="round"/>` +
    `<path d="M${W(-8)} 2 l3 4 M${W(7)} 3 l-2.6 4.4" stroke="@cuir" stroke-width="1" fill="none" opacity="0.6" stroke-linecap="round"/>`;
  const sword = `<path d="M${W(11)} -22 L${W(15.5)} -3" stroke="@cheveuxO" stroke-width="1.3" opacity="0.75" stroke-linecap="round"/>` +
    `<path d="M${W(9.4)} -18.4 l5.4 -1.4" stroke="@cheveuxO" stroke-width="1.1" opacity="0.75" stroke-linecap="round"/>`;
  const debris = `<rect x="${W(-14)}" y="-20" width="3.4" height="4" fill="@cheveuxO" opacity="0.55" transform="rotate(18 ${W(-14)} -20)"/>` +
    `<rect x="${W(-15)}" y="0" width="4.2" height="3" fill="@cheveuxO" opacity="0.5" transform="rotate(-12 ${W(-15)} 0)"/>` +
    `<circle cx="${W(9)}" cy="9" r="2.2" fill="@cheveuxO" opacity="0.5"/><circle cx="${W(-4)}" cy="10" r="1.6" fill="@cheveuxO" opacity="0.45"/>`;
  // bulles internes + voile de reflet vertical (la gelée luit sur son flanc)
  const bubbles = `<circle cx="${W(-13)}" cy="-27" r="1.4" fill="@corpsH" opacity="0.5"/><circle cx="${W(-16)}" cy="-14" r="1" fill="@corpsH" opacity="0.4"/>` +
    `<circle cx="${W(14)}" cy="-19" r="1.2" fill="@corpsH" opacity="0.45"/><circle cx="${W(16)}" cy="4" r="1.5" fill="@corpsH" opacity="0.4"/>` +
    `<circle cx="${W(-9)}" cy="6" r="1.1" fill="@corpsH" opacity="0.35"/><circle cx="${W(5)}" cy="-33" r="1" fill="@corpsH" opacity="0.45"/>`;
  const sheen = `<path d="M${W(-17)} -20 Q${W(-20)} -6 ${W(-15)} 10 Q${W(-13)} 14 ${W(-11)} 12 Q${W(-15)} -4 ${W(-13)} -19 Z" fill="@corpsH" opacity="0.18"/>` +
    `<path d="M${W(3)} -38 Q${W(7)} -36.5 ${W(9)} -33 Q${W(5)} -34 ${W(2)} -35.5 Z" fill="@corpsH" opacity="0.3"/>`;
  const inner = view === 'back'
    ? `<g opacity="0.75" transform="scale(-1,1)">${skull}${ribs}${bones}${sword}${debris}</g>`
    : `<g transform="translate(${view === 'profile' ? W(4) : 0},0)">${skull}${ribs}${bones}${sword}${debris}</g>`;
  return `<g>${pool}${ring}${sludge}${droplet}${mass}${glow}${shade}${inner}${bubbles}${sheen}${membrane}</g>`;
}
function gelArm(sx: number): string {
  // pseudopode translucide court (repère d'épaule pour l'anim), même matière que la masse
  return `<path d="M0 -3 Q${sx * 10} -1 ${sx * 9.5} 8 Q${sx * 9} 15 ${sx * 3} 16 Q${sx * 6} 10 ${sx * 4} 4 Q${sx * 2} 0 0 2 Z" fill="@corps" fill-opacity="0.62" stroke="@membrane" stroke-width="0.9" stroke-opacity="0.75"/>` +
    `<circle cx="${sx * 6}" cy="6" r="1.2" fill="@corpsH" opacity="0.4"/>`;
}
function bruteBody(p: HulkProps, view: View): string {
  const g = p.girth;
  const W = (n: number) => (n * g).toFixed(1);
  // torse-montagne voûté ASYMÉTRIQUE (épaule gauche plus haute — l'artwork n'a rien de
  // symétrique) : épaules énormes au-dessus d'une tête basse fondue dans la masse
  const torso = `<path d="M${W(-17)} 8 Q${W(-26)} 2 ${W(-27)} -13 Q${W(-27)} -30 ${W(-16)} -36 Q${W(-8)} -40.5 ${W(1)} -40 Q${W(11)} -39.5 ${W(18)} -33.5 Q${W(26)} -26 ${W(26)} -11 Q${W(26)} 3 ${W(17)} 8 Q${W(9)} 12 0 12 Q${W(-9)} 12 ${W(-17)} 8 Z" fill="@corps" stroke="@corpsO" stroke-width="0.9"/>`;
  // bosses irrégulières qui cassent le contour (grumeaux de boue en silhouette)
  const lobes = `<ellipse cx="${W(-26)}" cy="-21" rx="3.2" ry="5" fill="@corps" stroke="@corpsO" stroke-width="0.7" transform="rotate(14 ${W(-26)} -21)"/>` +
    `<ellipse cx="${W(25.5)}" cy="-18" rx="2.8" ry="4.4" fill="@corps" stroke="@corpsO" stroke-width="0.7" transform="rotate(-12 ${W(25.5)} -18)"/>` +
    `<ellipse cx="${W(-8)}" cy="-39" rx="4.4" ry="2.6" fill="@corps" stroke="@corpsO" stroke-width="0.7" transform="rotate(-8 ${W(-8)} -39)"/>`;
  const dome = `<path d="M${W(-11)} -33 Q${W(-10)} -43.5 ${W(-1)} -44 Q${W(9)} -43.5 ${W(10)} -32 Q${W(3)} -37 ${W(-4)} -37.5 Z" fill="@corps" stroke="@corpsO" stroke-width="0.8"/>`;
  // PAS de jambes : le bas du corps FOND en flaque de vase OPAQUE (les gouttes pointues et
  // régulières lisaient « orteils griffés », verdict ronde 2) — jupe à bord bas DÉCHIQUETÉ qui
  // plonge dans la flaque, langues de boue à bout ROND, mèches végétales pendantes, tendrons
  const pool = `<path d="M${W(-28)} 27 Q${W(-33)} 23.5 ${W(-24)} 22.6 Q${W(-15)} 21 ${W(-8)} 22.8 Q0 21.2 ${W(9)} 22.8 Q${W(17)} 21.4 ${W(24)} 23.2 Q${W(31)} 25 ${W(26)} 28 Q${W(15)} 31 0 31 Q${W(-17)} 31 ${W(-28)} 27 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.8"/>` +
    `<ellipse cx="${W(-12)}" cy="26" rx="5" ry="1.6" fill="@corps" opacity="0.35"/><ellipse cx="${W(11)}" cy="26.5" rx="4.2" ry="1.4" fill="@corps" opacity="0.3"/><ellipse cx="${W(-1)}" cy="24.5" rx="3.4" ry="1.1" fill="@corpsH" opacity="0.14"/>`;
  const roots = `<path d="M${W(-16)} 25 q-4.6 2.2 -8.4 1 M${W(-22)} 27.5 q-3.4 1.6 -6 0.6 M${W(13)} 24.5 q4.8 1.8 8.4 0.4 M${W(20)} 27 q3.6 1.6 6.4 0.4 M${W(2)} 28 q2 2.2 5 2.2 M${W(-6)} 28.5 q-2.2 2 -5.2 1.8" stroke="@cuir" stroke-width="1.1" fill="none" opacity="0.85" stroke-linecap="round"/>`;
  const skirt = `<path d="M${W(-17)} 3 Q${W(-21)} 13 ${W(-19)} 20.5 Q${W(-17.5)} 26 ${W(-13.5)} 24 Q${W(-12.5)} 28 ${W(-9)} 25.5 Q${W(-7.5)} 28.5 ${W(-4)} 26 Q${W(-2)} 29 ${W(1.5)} 26 Q${W(4)} 28.5 ${W(7)} 25.5 Q${W(9.5)} 28 ${W(12)} 24.5 Q${W(15)} 26.5 ${W(17.5)} 21.5 Q${W(20)} 13 ${W(17)} 3 Z" fill="@corps" stroke="@corpsO" stroke-width="0.9"/>`;
  const drips = `<path d="M${W(-14)} 23 Q${W(-15.6)} 27.5 ${W(-14.2)} 30.5 Q${W(-12.6)} 31.6 ${W(-11.8)} 29 Q${W(-11.2)} 26 ${W(-12)} 23.5 Z" fill="@corps" stroke="@corpsO" stroke-width="0.55"/>` +
    `<path d="M${W(-3.5)} 25 Q${W(-4.6)} 29.5 ${W(-3)} 32.5 Q${W(-1.2)} 33.4 ${W(-0.6)} 30 Q${W(-0.2)} 27 ${W(-1)} 25.2 Z" fill="@corps" stroke="@corpsO" stroke-width="0.55"/>` +
    `<path d="M${W(8.5)} 24.5 Q${W(8)} 28.5 ${W(9.6)} 31 Q${W(11.2)} 31.8 ${W(11.6)} 28.6 Q${W(11.8)} 26 ${W(10.8)} 24.5 Z" fill="@corps" stroke="@corpsO" stroke-width="0.55"/>`;
  const skirtStrands = `<path d="M${W(-16)} 17 q-1.2 5.4 0.2 9.4 M${W(-6.5)} 21 q-0.8 5 0.4 8.6 M${W(4.5)} 21.5 q0.6 4.8 -0.4 8.2 M${W(14)} 18 q1 4.8 0.2 8.6" stroke="@cheveux" stroke-width="1.3" fill="none" stroke-linecap="round"/>` +
    `<path d="M${W(-11)} 23 q-0.4 4 0.6 6.6 M${W(9.5)} 22.5 q0.8 3.8 0 6.6 M${W(0.5)} 24 q0.4 4 -0.4 6.8" stroke="@cuir" stroke-width="0.9" fill="none" stroke-linecap="round" opacity="0.85"/>`;
  // matière grumeleuse et FILANDREUSE : fibres qui COULENT le long de la masse (jamais de
  // stries horizontales — elles lisaient « bedaine souriante »), enchevêtrements, plaques de
  // mousse irrégulières, mèches pendantes vers le BAS
  const fibers = `<path d="M${W(-21)} -26 Q${W(-18)} -18 ${W(-21)} -10 Q${W(-23)} -3 ${W(-20)} 2 M${W(-13)} -33 Q${W(-9)} -22 ${W(-13)} -12 Q${W(-16)} -3 ${W(-12)} 4 M${W(-5)} -18 Q${W(-2)} -11 ${W(-6)} -3 Q${W(-8)} 3 ${W(-5)} 8 M${W(6)} -16 Q${W(9)} -9 ${W(5)} -1 Q${W(3)} 5 ${W(7)} 9 M${W(13)} -31 Q${W(17)} -21 ${W(13)} -11 Q${W(10)} -4 ${W(14)} 3 M${W(20)} -25 Q${W(22)} -18 ${W(19)} -10 Q${W(17)} -4 ${W(20)} 1" stroke="@corpsO" stroke-width="1" fill="none" opacity="0.55"/>` +
    `<path d="M${W(-17)} -14 Q${W(-15)} -8 ${W(-17)} -2 M${W(1)} -30 Q${W(3)} -25 ${W(0)} -20 M${W(10)} 4 Q${W(12)} 9 ${W(10)} 14 M${W(-24)} -18 Q${W(-22)} -12 ${W(-24)} -6 M${W(23)} -16 Q${W(24)} -10 ${W(22)} -4" stroke="@corpsO" stroke-width="0.8" fill="none" opacity="0.42"/>`;
  const tangle = `<path d="M${W(-16)} -24 q3 2 6.4 0.6 M${W(-11)} -8 q4 2.4 8 0.8 M${W(4)} -26 q4 1.6 7 -0.4 M${W(2)} -2 q4 2 8 0.4 M${W(-7)} 6 q4 2 9 0.6 M${W(10)} 15 q3.4 1.8 6.8 0.4 M${W(-20)} 0 q3.4 2 7 0.8 M${W(14)} -18 q3.6 1.8 6.6 0.2" stroke="@cheveuxO" stroke-width="0.8" fill="none" opacity="0.55"/>`;
  // fouillis boue-végétation ENTREMÊLÉ (l'aplat + 6 fibres lisait « lisse/uniforme ») :
  // lianes drapées en travers, mottes de boue en relief, alvéoles sombres éparses
  const vines = `<path d="M${W(-23)} -22 Q${W(-16)} -8 ${W(-20)} 5 M${W(-3)} -37 Q${W(2)} -24 ${W(-2)} -11 Q${W(-4)} -1 ${W(0)} 8 M${W(16)} -29 Q${W(21)} -15 ${W(16)} -2 Q${W(14)} 6 ${W(17)} 12" stroke="@cuir" stroke-width="1.1" fill="none" opacity="0.55" stroke-linecap="round"/>` +
    `<path d="M${W(-20)} -13 q2.6 -1.8 5 -0.6 M${W(-1)} -24 q2.4 -1.6 4.8 -0.4 M${W(17)} -12 q-2.6 -1.6 -5 -0.6" stroke="@cuir" stroke-width="0.8" fill="none" opacity="0.45" stroke-linecap="round"/>`;
  const clods = `<ellipse cx="${W(-10)}" cy="-20" rx="2.6" ry="1.7" fill="@corpsO" opacity="0.32" transform="rotate(18 ${W(-10)} -20)"/>` +
    `<ellipse cx="${W(9)}" cy="-6" rx="3" ry="1.9" fill="@corpsO" opacity="0.28" transform="rotate(-14 ${W(9)} -6)"/>` +
    `<ellipse cx="${W(-14)}" cy="1" rx="2.4" ry="1.6" fill="@corpsO" opacity="0.3" transform="rotate(10 ${W(-14)} 1)"/>` +
    `<ellipse cx="${W(19)}" cy="6" rx="2.2" ry="1.5" fill="@corpsO" opacity="0.26" transform="rotate(-20 ${W(19)} 6)"/>` +
    `<ellipse cx="${W(-2)}" cy="16" rx="2.8" ry="1.7" fill="@corpsO" opacity="0.3" transform="rotate(8 ${W(-2)} 16)"/>`;
  const pocks = `<circle cx="${W(-15)}" cy="-17" r="1" fill="@cheveuxO" opacity="0.5"/><circle cx="${W(-22)}" cy="-8" r="0.9" fill="@cheveuxO" opacity="0.45"/>` +
    `<circle cx="${W(12)}" cy="-22" r="1.1" fill="@cheveuxO" opacity="0.5"/><circle cx="${W(21)}" cy="-9" r="0.9" fill="@cheveuxO" opacity="0.45"/>` +
    `<circle cx="${W(-8)}" cy="10" r="1" fill="@cheveuxO" opacity="0.48"/><circle cx="${W(6)}" cy="5" r="0.8" fill="@cheveuxO" opacity="0.42"/><circle cx="${W(13)}" cy="18" r="0.9" fill="@cheveuxO" opacity="0.45"/>`;
  const mossHi = `<path d="M${W(-18)} -29 q3 -4 7 -3 q3 1 2 4 q-4 3 -9 -1 Z" fill="@corpsH" opacity="0.35"/>` +
    `<path d="M${W(11)} -28 q4 -3 7 -1 q2 2 -1 4 q-4 2 -6 -3 Z" fill="@corpsH" opacity="0.28"/>` +
    `<path d="M${W(-5)} -12 q3 -2 6 0 q2 2 -1 3.6 q-4 1.6 -5 -3.6 Z" fill="@corpsH" opacity="0.22"/>` +
    `<path d="M${W(4)} 14 q2.6 -1.6 5 0 q1.6 1.6 -0.8 3 q-3.4 1.4 -4.2 -3 Z" fill="@corpsH" opacity="0.2"/>`;
  const tufts = `<path d="M${W(-19)} 3 q-1 5 0.4 8 M${W(-9)} 11 q-0.6 4.6 0.8 7 M${W(3)} 11.5 q-0.4 4.6 1 7 M${W(13)} 9 q-0.2 4.6 1.2 6.6 M${W(21)} 0 q0.8 4.6 2.2 6.4" stroke="@cheveux" stroke-width="1.2" fill="none" stroke-linecap="round"/>`;
  // racines drapées sur les épaules — elles RETOMBENT (des tiges dressées lisaient « antennes »)
  const sprigs = `<path d="M${W(-14)} -35 q-4.6 -1.6 -7.4 1.6 M${W(10)} -34 q4.6 -1.6 6.8 2 M${W(-8)} -41 q-3.2 0.4 -4.4 3" stroke="@cuir" stroke-width="1.2" fill="none" stroke-linecap="round"/>`;
  const base = pool + roots + drips + skirt + skirtStrands + torso + lobes + dome + fibers + tangle + vines + clods + pocks + mossHi + tufts + sprigs;
  if (view === 'back') return `<g>${base}<path d="M0 -40 Q${W(3)} -12 0 14" stroke="@corpsO" stroke-width="1.1" opacity="0.4" fill="none"/></g>`;
  // masque végétal fondu dans la masse : arcade de mousse en surplomb, orbites en creux,
  // 2 lueurs pâles asymétriques, grappe d'alvéoles (crâne englouti) sur la joue, gueule-fente amère
  const fx = view === 'profile' ? Number(W(5)) : 0;
  const face = `<g transform="translate(${fx},0)">` +
    `<ellipse cx="0" cy="-32" rx="8" ry="5" fill="@corpsO" opacity="0.55"/>` +
    `<path d="M-7.5 -36.5 Q0 -40 7.5 -36.5" stroke="@corpsO" stroke-width="1.7" fill="none"/>` +
    `<circle cx="3.6" cy="-34" r="1.5" fill="#cfe08a"/><circle cx="-3.8" cy="-32.6" r="1.2" fill="#cfe08a"/>` +
    `<circle cx="-7" cy="-28.6" r="1.5" fill="#141508"/><circle cx="-4.4" cy="-27.2" r="1.2" fill="#141508"/><circle cx="-6.8" cy="-25.6" r="1" fill="#141508"/>` +
    `<path d="M-5 -23.5 Q0 -21.5 5 -23.5 Q2.6 -20 0 -20 Q-2.6 -20 -5 -23.5 Z" fill="#141508"/>` +
    `<path d="M-2.4 -22.6 l0.5 1.7 M1.8 -22.7 l0.5 1.6" stroke="#9aa06a" stroke-width="0.5"/>` +
    `</g>`;
  return `<g>${base}${face}</g>`;
}
function bruteArm(sx: number): string {
  // bras-tronc de boue qui S'ÉVASE vers le sol (plus large en bas qu'à l'épaule, comme
  // l'artwork), butte d'épaule moussue fondue dans le torse, main = doigts-racines ÉTALÉS qui
  // touchent terre ; mèches de vase qui PENDENT (jamais d'épines latérales — lecture insecte)
  const limb = `<path d="M${sx * -4} -8 Q${sx * 12} -12 ${sx * 18} -2 Q${sx * 23} 8 ${sx * 22} 20 Q${sx * 22} 32 ${sx * 18} 40 L${sx * 6} 40 Q${sx * 9} 28 ${sx * 8} 16 Q${sx * 7} 2 0 -1 Z" fill="@corps" stroke="@corpsO" stroke-width="0.9"/>`;
  const shoulder = `<path d="M${sx * -2} -6 Q${sx * 2} -14 ${sx * 10} -12 Q${sx * 17} -10 ${sx * 17} -3 Q${sx * 15} 3 ${sx * 7} 3 Q0 2 ${sx * -2} -6 Z" fill="@corps" stroke="@corpsO" stroke-width="0.8"/>` +
    `<path d="M${sx * 2} -11 q${sx * 5} -2 ${sx * 9} 1 q${sx * 2} 2 0 4 q${sx * -5} 2 ${sx * -9} -2 Z" fill="@corpsH" opacity="0.3"/>`;
  const fingers = `<path d="M${sx * 7} 39 q${sx * -3} 7 ${sx * -1.4} 12.6 q${sx * 2} -4 ${sx * 2.6} -9 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` +
    `<path d="M${sx * 11} 40 q${sx * -0.6} 8 ${sx * 1} 13 q${sx * 1.8} -4.6 ${sx * 1.6} -10.4 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` +
    `<path d="M${sx * 15} 40 q${sx * 1.4} 7.6 ${sx * 3.4} 11 q${sx * 1.2} -4.6 ${sx * -0.4} -10.6 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` +
    `<path d="M${sx * 19} 38 q${sx * 4} 6 ${sx * 6} 8.6 q${sx * -0.2} -4.4 ${sx * -2.6} -9 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>`;
  const tips = `<path d="M${sx * 5.4} 49 q${sx * -0.4} 1.8 ${sx * 0.2} 2.6 M${sx * 11.6} 51 q${sx * 0.2} 1.8 ${sx * 1} 2.4 M${sx * 17.6} 49.6 q${sx * 0.8} 1.4 ${sx * 1.6} 1.8 M${sx * 23.6} 45.4 q${sx * 1} 1 ${sx * 1.8} 1.2" stroke="@cuir" stroke-width="1" fill="none" stroke-linecap="round"/>`;
  const strands = `<path d="M${sx * 21} 12 q${sx * 1} 5 0 8 M${sx * 22} 24 q${sx * 1} 4.6 ${sx * -0.2} 7.6 M${sx * 9} 20 q${sx * -0.8} 4.6 ${sx * 0.4} 7" stroke="@cheveux" stroke-width="1.1" fill="none" stroke-linecap="round"/>`;
  const fibers = `<path d="M${sx * 12} -6 Q${sx * 16} 2 ${sx * 13} 10 Q${sx * 11} 18 ${sx * 14} 24 M${sx * 6} 0 Q${sx * 9} 7 ${sx * 7} 14 Q${sx * 6} 20 ${sx * 8} 26 M${sx * 17} 4 Q${sx * 20} 12 ${sx * 18} 20 Q${sx * 17} 28 ${sx * 19} 34" stroke="@corpsO" stroke-width="0.9" fill="none" opacity="0.55"/>` +
    `<path d="M${sx * 8} 8 q${sx * 4} 1.8 ${sx * 7.4} 0.4 M${sx * 10} 26 q${sx * 3.6} 1.8 ${sx * 7} 0.6" stroke="@cheveuxO" stroke-width="0.7" fill="none" opacity="0.5"/>` +
    `<ellipse cx="${sx * 15}" cy="18" rx="2.2" ry="1.5" fill="@corpsO" opacity="0.3" transform="rotate(${sx * 16} ${sx * 15} 18)"/>`;
  const lumps = `<circle cx="${sx * 13}" cy="12" r="2.6" fill="@corpsO" opacity="0.35"/><circle cx="${sx * 10}" cy="32" r="2.2" fill="@corpsO" opacity="0.3"/><ellipse cx="${sx * 17}" cy="28" rx="3" ry="2.2" fill="@corpsH" opacity="0.25"/>`;
  return limb + shoulder + fingers + tips + strands + fibers + lumps;
}
function arm(sx: number): string {
  // moignon grumeleux qui pend (repère épaule)
  return `<path d="M0 -2 Q${sx * 9} 2 ${sx * 8} 14 Q${sx * 9} 22 ${sx * 3} 24 Q${sx * 6} 16 ${sx * 4} 8 Q${sx * 2} 2 0 4 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` +
    `<circle cx="${sx * 6}" cy="8" r="2.4" fill="@corpsO" opacity="0.4"/>`;
}

// --- poses (DELTA additif) ------------------------------------------------
export const HULK_REST: Record<string, number> = {};
/** Tremblotement : la masse oscille, les moignons ballottent en opposition. phase ∈ [0,1). */
export function hulkWobble(phase: number): Record<string, number> {
  const s = Math.sin(phase * Math.PI * 2);
  return { corps: s * 3, brasG: s * 9, brasD: -s * 9 };
}
/** Embardée : la masse se balance d'avant en arrière. phase ∈ [0,1). */
export function hulkLurch(phase: number): Record<string, number> {
  return { corps: Math.sin(phase * Math.PI * 2) * 8, brasG: 6, brasD: -6 };
}
/** Abattage : les deux moignons se projettent en avant. phase ∈ [0,1]. */
export function hulkSlam(phase: number): Record<string, number> {
  const k = Math.sin(Math.min(1, phase) * Math.PI);
  return { corps: k * 8, brasG: k * 30, brasD: k * 30 };
}
/** Mort : affaissement (masse penchée, moignons retombés). */
export const HULK_DEATH: Record<string, number> = { corps: 16, brasG: 46, brasD: 46 };

export function resolveHulkFromProps(
  p: HulkProps,
  view: View = 'front',
  pose: BonePose = {},
  colors?: Palette,
): ResolvedBone[] {
  const sk = buildSkeleton(p);
  const world = worldTransformsG(sk, pose) as Record<HulkBoneId, Matrix>;
  const tmap = buildTokenMap([p.palette], colors ?? {});
  const art: Record<HulkBoneId, string> = p.form === 'brute'
    ? { corps: bruteBody(p, view), brasG: bruteArm(-1), brasD: bruteArm(1) }
    : p.form === 'gel'
      ? { corps: gel(p, view), brasG: gelArm(-1), brasD: gelArm(1) }
      : { corps: blob(p, view), brasG: arm(-1), brasD: arm(1) };
  return sortByZ((Object.keys(sk) as HulkBoneId[])
    .map((id) => ({
      id, matrix: world[id], scale: [1, 1] as [number, number], z: sk[id].z,
      parts: [{ svg: applyTokenMap(art[id], tmap), layer: 0 }],
    })));
}

export const HULK_DEFAULT: HulkProps = {
  sl: 1.1, girth: 1.0,
  palette: { corps: '#5a5236', corpsO: '#362f1e', corpsH: '#7c7150', cheveux: '#2a2416', cheveuxO: '#181206', cuir: '#3a3320' },
};

export function resolveHulk(species: string, view: View = 'front', pose: BonePose = {}, colors?: Palette): ResolvedBone[] {
  return resolveHulkFromProps(HULK_SPECIES[species] ?? HULK_DEFAULT, view, pose, colors);
}

export const amorphousPlan: BodyPlan = {
  id: 'amorphous',
  resolve: (sp, view, pose, opts) => resolveHulk(sp, view, pose, opts?.colors),
  speciesNames: () => Object.keys(HULK_SPECIES),
  restPose: () => HULK_REST,
  idlePose: hulkWobble, // tremblotement en continu
  walkPose: hulkLurch,
  attackPose: hulkSlam,
  deathPose: () => HULK_DEATH,
  hasView: () => true,
};

export function hulkSvg(p: HulkProps, view: View, opts: { dead?: boolean; phase?: number; colors?: Palette } = {}): string {
  const pose = opts.dead ? HULK_DEATH : opts.phase != null ? hulkWobble(opts.phase) : {};
  return bonesToSvg(resolveHulkFromProps(p, view, pose, opts.colors));
}
