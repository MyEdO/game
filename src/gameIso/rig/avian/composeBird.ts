/**
 * Gabarit AVIAIRE (pigeon / petit oiseau). Corps dodu sur 2 pattes fines, aile repliée, queue
 * en éventail, petite tête à bec qui DODELINE (le tell de l'oiseau). Anim propre au plan :
 * hochement de tête au repos, sautillement+frémissement d'aile au déplacement, coup de bec à
 * l'attaque, sur le flanc à la mort. Réutilise la machinerie (FK, palette tokenisée, rendu).
 */
import type { BonePose } from '../poses';
import type { ResolvedBone } from '../composeRig';
import type { BodyPlan } from '../bodyPlan';
import type { View } from '../facing';
import type { Palette, PaletteDeclaree } from '../palette';
import { worldTransformsG, type FKBone, type Matrix } from '../kinematics';
import { buildTokenMap, applyTokenMap } from '../palette';
import { bonesToSvg } from '../renderBones';
import { BIRD_SPECIES } from '../creatures';
import { sortByZ } from '../composite';
import { raptorBodyBack, raptorBodyFront, raptorBodyProfile, raptorHead } from './raptorParts';

export type BirdBoneId = 'corps' | 'tete';
type BBone = FKBone & { z: number };
export interface BirdProps {
  sl: number;
  girth: number; // rondeur du corps
  palette: PaletteDeclaree; // plumage (corps/corpsO/corpsH) ; cuir = pattes/bec
  /** Mode THÉROPODE (Happeur carnivore, Compagnon T1 ch.11) : reptile bipède horizontal —
   *  lourde queue d'équilibre, pattes arrière puissantes, bras-moignons, mâchoire dentée.
   *  Réutilise la machinerie aviaire (2 os, dodelinement = affût, coup de bec = morsure). */
  theropod?: boolean;
  /** longueur de la queue du théropode (×, défaut 1). */
  tailLen?: number;
  /** Mode PIGEON VOYAGEUR (réf. art LDB 79 p.318) : message roulé sanglé sur le dos,
   *  clochette dorée pendue à une patte, gorge irisée vert/violet. */
  messenger?: boolean;
  /** Mode RAPACE GÉANT (Grand Aigle, réf. art ZI 6 p.65) : aigle en piqué, ailes déployées
   *  immenses en V à rémiges digitées, serres tendues en avant, bec crochu massif.
   *  Dessin dans `raptorParts.ts` ; mêmes 2 os (le dodelinement/coup de bec restent valides). */
  raptor?: boolean;
  /** Mode GALLINACÉ (poulet de basse-cour) : crête rouge dentelée sur le crâne + barbillon
   *  rouge sous le bec, visibles sur les 3 vues. Rien sans le flag (les autres oiseaux inchangés). */
  comb?: boolean;
}

// --- GALLINACÉ (crête + barbillon, rouge chair littéral) ----------------------
const COMB = { red: '#c0392b', redO: '#922b21' };
/** Crête dentelée SUR le sommet du crâne (r=6), vue de PROFIL : 3 lobes charnus. */
function combProfile(): string {
  return `<path d="M-4.6 -3.6 Q-5.6 -6.8 -3.6 -8.4 L-2.8 -6.2 Q-2.8 -10 -0.8 -10.6 L-0.3 -7.4 Q0.8 -10.8 2.6 -9.8 L2.4 -6.8 Q4.2 -8.6 4.8 -6 Q5 -4.4 3.4 -3.8 Z" fill="${COMB.red}" stroke="${COMB.redO}" stroke-width="0.5"/>`;
}
/** Crête vue de FACE/DOS (lame dressée, vue par la tranche mais lisible : lobes courts). */
function combEdgeOn(): string {
  return `<path d="M-3.8 -4.4 Q-4.6 -7.6 -2.6 -8.4 L-1.8 -6.2 Q-1.6 -10 0 -10.6 Q1.6 -10 1.8 -6.2 L2.6 -8.4 Q4.6 -7.6 3.8 -4.4 Z" fill="${COMB.red}" stroke="${COMB.redO}" stroke-width="0.5"/>`;
}
/** Barbillon pendu sous le bec, vue de PROFIL (lobe charnu). */
function wattleProfile(): string {
  return `<path d="M3.4 2.6 Q5.2 6.8 3.8 8.6 Q2.2 7.6 2.4 3.2 Z" fill="${COMB.red}" stroke="${COMB.redO}" stroke-width="0.5"/>`;
}
/** Barbillons de FACE : deux lobes de part et d'autre sous le bec. */
function wattleFront(): string {
  return `<path d="M-2 5.8 Q-3.2 9.6 -1.6 11.4 Q-0.4 10 -0.8 6.4 Z" fill="${COMB.red}" stroke="${COMB.redO}" stroke-width="0.5"/>` +
    `<path d="M2 5.8 Q3.2 9.6 1.6 11.4 Q0.4 10 0.8 6.4 Z" fill="${COMB.red}" stroke="${COMB.redO}" stroke-width="0.5"/>`;
}
/** Queue de poule REDRESSÉE (profil) : faucille courte dressée vers l'arrière-haut, ×tailLen. */
function henTailProfile(g: number, t: number): string {
  return `<path d="M${(-11 * g).toFixed(1)} 4 Q-19 -2 ${(-24 * t).toFixed(0)} ${(-19 * t).toFixed(0)} L-18.5 ${(-13 * t).toFixed(1)} Q-19.5 ${(-19.5 * t).toFixed(1)} -15.5 ${(-23 * t).toFixed(1)} L-13.6 ${(-14 * t).toFixed(1)} Q-12 ${(-21 * t).toFixed(1)} -9.2 ${(-20 * t).toFixed(0)} L-9.8 -7 Q-8.2 -3 -8.6 2 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` +
    `<path d="M-11.5 0 Q-16.5 -6 ${(-20.5 * t).toFixed(1)} ${(-15 * t).toFixed(0)} M-10.8 -3 Q-13 -9 -12 ${(-17 * t).toFixed(0)}" stroke="@corpsO" stroke-width="0.5" fill="none" opacity="0.55"/>`;
}
/** Queue de poule REDRESSÉE (dos) : éventail court dressé au-dessus du dos, ×tailLen. */
function henTailBack(t: number): string {
  return `<path d="M-5 -6 L-8 ${(-24 * t).toFixed(0)} L-3.2 ${(-19.5 * t).toFixed(1)} L0 ${(-26 * t).toFixed(0)} L3.2 ${(-19.5 * t).toFixed(1)} L8 ${(-24 * t).toFixed(0)} L5 -6 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` +
    `<path d="M-4 -8 L-6.2 ${(-20 * t).toFixed(0)} M0 -8 L0 ${(-22 * t).toFixed(0)} M4 -8 L6.2 ${(-20 * t).toFixed(0)}" stroke="@corpsO" stroke-width="0.5" opacity="0.5"/>`;
}

function buildSkeleton(): Record<BirdBoneId, BBone> {
  return {
    corps: { parent: null, pivot: { x: 60, y: 112 }, angle: 0, z: 3 }, // corps + aile + queue + pattes
    tete: { parent: 'corps', pivot: { x: 11, y: -13 }, angle: 0, z: 4 }, // tête + bec + œil
  };
}

function legs(): string { // 2 pattes fines + doigts (couleur cuir)
  return `<g>` +
    `<path d="M-3 9 L-4 26 M-4 26 l-3 3 M-4 26 l1 4 M-4 26 l3 2" stroke="@cuir" stroke-width="1.6" fill="none" stroke-linecap="round"/>` +
    `<path d="M3 9 L4 26 M4 26 l-3 2 M4 26 l-1 4 M4 26 l3 3" stroke="@cuir" stroke-width="1.6" fill="none" stroke-linecap="round"/>` +
    `</g>`;
}
// --- PIGEON VOYAGEUR (accessoires, réf. art LDB 79 p.318) ---------------------
const MSG = { paper: '#d9cda6', paperO: '#8a7a4e', gold: '#c9a23a', goldO: '#7a5c1a' };
/** Message roulé sanglé sur le dos (profil) : cylindre de parchemin, bout en spirale, sangle dorée. */
function scrollProfile(): string {
  return `<g transform="translate(-2,-12.5) rotate(-6)">` +
    `<rect x="-7.5" y="-3" width="14" height="6" rx="2.4" fill="${MSG.paper}" stroke="${MSG.paperO}" stroke-width="0.6"/>` +
    `<ellipse cx="-7" cy="0" rx="1.8" ry="3" fill="${MSG.paper}" stroke="${MSG.paperO}" stroke-width="0.6"/>` +
    `<path d="M-7 -1.6 a1.7 1.7 0 1 1 -1.4 2.4" fill="none" stroke="${MSG.paperO}" stroke-width="0.5"/>` + // spirale du rouleau
    `<rect x="1.4" y="-3.4" width="2.6" height="6.8" rx="0.8" fill="${MSG.gold}" stroke="${MSG.goldO}" stroke-width="0.5"/>` +
    `</g>` +
    `<path d="M1.6 -9.5 Q8 -4 6.5 5.5" stroke="${MSG.goldO}" stroke-width="0.8" fill="none" opacity="0.75"/>`; // sangle sous le poitrail
}
/** Clochette dorée pendue (cordelette + cloche + battant). */
function bell(x: number, y: number): string {
  return `<g transform="translate(${x},${y})">` +
    `<path d="M0 -3.6 L0 -1.9" stroke="${MSG.goldO}" stroke-width="0.6"/>` +
    `<path d="M-2 1.6 Q-2.3 -2.1 0 -2.1 Q2.3 -2.1 2 1.6 L2.9 2.7 L-2.9 2.7 Z" fill="${MSG.gold}" stroke="${MSG.goldO}" stroke-width="0.5"/>` +
    `<path d="M-1.2 -0.9 Q-1.35 0.4 -1 1.2" stroke="#efe0b0" stroke-width="0.5" fill="none" opacity="0.8"/>` + // reflet
    `<circle cx="0" cy="3.3" r="0.7" fill="${MSG.goldO}"/>` +
    `</g>`;
}

function bodyProfile(p: BirdProps): string {
  const g = p.girth;
  return `<g>${legs()}` +
    // queue : éventail (arrière -x, légèrement relevée) — ou faucille de poule DRESSÉE (mode comb)
    (p.comb ? henTailProfile(g, p.tailLen ?? 1)
      : `<path d="M${-12 * g} -2 L-30 -8 L-29 -2 L-31 4 L-28 6 L-12 6 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` +
        `<path d="M-28 -7 L-13 -1 M-29 0 L-13 2 M-28 5 L-13 5" stroke="@corpsO" stroke-width="0.5" opacity="0.5"/>`) +
    // corps dodu
    `<ellipse cx="0" cy="0" rx="${(15 * g).toFixed(1)}" ry="12" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
    `<ellipse cx="3" cy="-3" rx="${(9 * g).toFixed(1)}" ry="7" fill="@corpsH" opacity="0.35"/>` + // poitrail clair
    // aile repliée (sur le flanc) + rémiges
    `<path d="M2 -5 Q-8 -7 -16 0 Q-10 5 -2 4 Q4 2 2 -5 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` +
    `<path d="M-3 -2 Q-9 -2 -14 1 M-3 1 Q-9 1 -13 3" stroke="@corpsO" stroke-width="0.6" fill="none" opacity="0.6"/>` +
    (p.messenger ? scrollProfile() + bell(5, 17) : '') +
    `</g>`;
}
function bodyFront(p: BirdProps): string {
  const g = p.girth;
  return `<g>${legs()}` +
    // message roulé qui dépasse au-dessus des épaules (occulté en bas par le corps)
    (p.messenger ? `<rect x="-9" y="-15.5" width="18" height="6" rx="2.6" fill="${MSG.paper}" stroke="${MSG.paperO}" stroke-width="0.6"/>` +
      `<ellipse cx="-8.6" cy="-12.5" rx="1.6" ry="2.9" fill="${MSG.paper}" stroke="${MSG.paperO}" stroke-width="0.5"/>` : '') +
    `<ellipse cx="0" cy="0" rx="${(12 * g).toFixed(1)}" ry="13" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
    `<ellipse cx="0" cy="1" rx="${(7 * g).toFixed(1)}" ry="9" fill="@corpsH" opacity="0.4"/>` + // poitrail
    `<path d="M${-10 * g} -6 Q${-14 * g} 2 ${-8 * g} 9 Q${-6 * g} 4 ${-7 * g} -4 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` + // aile G
    `<path d="M${10 * g} -6 Q${14 * g} 2 ${8 * g} 9 Q${6 * g} 4 ${7 * g} -4 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` + // aile D
    (p.messenger ? bell(4, 18) : '') +
    `</g>`;
}
function bodyBack(p: BirdProps): string {
  const g = p.girth;
  return `<g>${legs()}` +
    // queue : éventail vers le bas — ou éventail de poule DRESSÉ au-dessus du dos (mode comb)
    (p.comb ? henTailBack(p.tailLen ?? 1)
      : `<path d="M-9 4 L-2 -2 L2 -2 L9 4 L4 16 L-4 16 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` +
        `<path d="M0 -2 L0 15 M-5 0 L-3 14 M5 0 L3 14" stroke="@corpsO" stroke-width="0.5" opacity="0.5"/>`) +
    `<ellipse cx="0" cy="-2" rx="${(12 * g).toFixed(1)}" ry="12" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
    `<path d="M0 -12 L0 6" stroke="@corpsO" stroke-width="0.6" opacity="0.4"/>` +
    // de dos, le message roulé est pleinement visible en travers du haut du dos
    (p.messenger ? `<g transform="translate(0,-8)">` +
      `<rect x="-8.5" y="-3" width="17" height="6" rx="2.6" fill="${MSG.paper}" stroke="${MSG.paperO}" stroke-width="0.6"/>` +
      `<ellipse cx="8.2" cy="0" rx="1.8" ry="3" fill="${MSG.paper}" stroke="${MSG.paperO}" stroke-width="0.6"/>` +
      `<path d="M8.2 -1.6 a1.7 1.7 0 1 0 1.4 2.4" fill="none" stroke="${MSG.paperO}" stroke-width="0.5"/>` +
      `<rect x="-2" y="-3.4" width="2.6" height="6.8" rx="0.8" fill="${MSG.gold}" stroke="${MSG.goldO}" stroke-width="0.5"/>` +
      `</g>` + bell(-4, 18) : '') +
    `</g>`;
}
function head(p: BirdProps, view: View): string {
  const irid = `<path d="M-4 6 Q0 9 4 6 Q3 9 0 10 Q-3 9 -4 6 Z" fill="@corpsH" opacity="0.5"/>` +
    // gorge irisée vert/violet du pigeon voyageur (deux nappes superposées)
    (p.messenger ? `<path d="M-4.2 4.5 Q0 7.8 4.2 4.5 Q3.2 9 0 10.6 Q-3.2 9 -4.2 4.5 Z" fill="#4e9a6a" opacity="0.7"/>` +
      `<path d="M-3 7.4 Q0 10 3 7.4 Q2.2 10.8 0 11.8 Q-2.2 10.8 -3 7.4 Z" fill="#7c5a9a" opacity="0.7"/>` : '');
  if (view === 'front')
    return `<g><circle cx="0" cy="0" r="6" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>${irid}` +
      (p.comb ? wattleFront() : '') + // barbillons sous le bec, de part et d'autre
      `<path d="M-1.6 4 L1.6 4 L0 8 Z" fill="@cuir"/>` + // bec (face, au-dessus de la gorge irisée)
      `<circle cx="-2.6" cy="-1" r="1.3" fill="#1a0e08"/><circle cx="2.6" cy="-1" r="1.3" fill="#1a0e08"/>` +
      `<circle cx="-2.6" cy="-1" r="2" fill="none" stroke="#c86018" stroke-width="0.5"/><circle cx="2.6" cy="-1" r="2" fill="none" stroke="#c86018" stroke-width="0.5"/>` +
      (p.comb ? combEdgeOn() : '') + `</g>`;
  if (view === 'back')
    return `<g><circle cx="0" cy="0" r="6" fill="@corps" stroke="@corpsO" stroke-width="0.6"/><path d="M0 -5 L0 4" stroke="@corpsO" stroke-width="0.5" opacity="0.4"/>` +
      (p.comb ? combEdgeOn() : '') + `</g>`; // de dos, la crête dressée dépasse du crâne
  // profil : tête + bec court vers +x + œil cerclé orange
  return `<g><circle cx="0" cy="0" r="6" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` +
    (p.comb
      ? `<path d="M5 -0.6 L10 1 L5 2.8 Z" fill="@cuir" stroke="#8a4010" stroke-width="0.4"/>` + wattleProfile() // bec plus court + barbillon
      : `<path d="M5 -1 L12 1 L5 3 Z" fill="@cuir" stroke="#8a4010" stroke-width="0.4"/>`) + // bec court
    `<circle cx="2" cy="-1" r="1.4" fill="#c86018"/><circle cx="2" cy="-1" r="0.8" fill="#1a0e08"/>` +
    `<circle cx="2.3" cy="-1.4" r="0.3" fill="#fff" opacity="0.7"/>${irid}` +
    (p.comb ? combProfile() : '') + `</g>`;
}

// --- THÉROPODE (Happeur carnivore) ------------------------------------------------
// Corps tacheté « du vert foncé au brun sombre sur le dos, ventre chamois » (Compagnon ch.11).
const theroSpots = (xs: [number, number][]) =>
  xs.map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="1.6" ry="1.1" fill="@corpsO" opacity="0.65"/>`).join('');
function theroLegProfile(dx: number, far: boolean): string {
  const tone = far ? '@corpsO' : '@corps', edge = far ? '@corpsO' : '@corpsO';
  return `<g transform="translate(${dx},0)"${far ? ' opacity="0.88"' : ''}>`
    // cuisse en pilon + tibia replié en Z + métatarse, pied à 3 doigts griffus
    + `<path d="M-2 -1 Q-9 2 -8 11 Q-7 17 -2 17 Q3 14 2.6 4 Q1.6 0 -2 -1 Z" fill="${tone}" stroke="${edge}" stroke-width="0.7"/>`
    + `<path d="M-6.5 14 Q-9.5 19 -7 24 Q-5.4 26.5 -3 26 L-3.4 23 Q-5.8 20 -3.8 15.6 Z" fill="${tone}" stroke="${edge}" stroke-width="0.6"/>`
    + `<path d="M-4.4 25 L-4 30" stroke="${tone}" stroke-width="2.6" stroke-linecap="round"/>`
    + `<path d="M-4.2 30 l-3.4 1.8 M-4.2 30 l0.6 2.6 M-4.2 30 l3.6 1.4" stroke="@cuir" stroke-width="1.5" fill="none" stroke-linecap="round"/>`
    + `<path d="M-7.8 31.6 l-1.4 1.4 M-3.8 32.8 l0.2 1.8 M-0.4 31.2 l1.4 1.2" stroke="#241a10" stroke-width="0.9" stroke-linecap="round"/>`
    + `</g>`;
}
function theroBodyProfile(p: BirdProps): string {
  const g = p.girth, t = p.tailLen ?? 1;
  return `<g>` + theroLegProfile(5, true)
    // lourde queue d'équilibre (arrière -x, légèrement relevée), tachetée
    + `<path d="M-10 -6 Q${(-22 * t).toFixed(0)} -8 ${(-33 * t).toFixed(0)} -3.5 Q${(-22 * t).toFixed(0)} 0.5 -9 7 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>`
    + theroSpots([[-14, -3], [-20 * t, -4], [-26 * t, -3]])
    // corps horizontal musclé, ventre chamois
    + `<ellipse cx="0" cy="0" rx="${(15 * g).toFixed(1)}" ry="9.5" fill="@corps" stroke="@corpsO" stroke-width="0.8"/>`
    + `<path d="M-9 5.5 Q0 9.4 9 4.5 Q3 8.6 -4 7.6 Z" fill="@corpsH" opacity="0.8"/>`
    + theroSpots([[-4, -6], [3, -7], [9, -4], [-9, -4]])
    // bras-moignon presque inutile (poitrail, +x)
    + `<path d="M8 0.5 q3.2 1.4 2.6 5 l-1.6 -0.4 q0.4 -2.4 -1.8 -3.4 Z" fill="@corps" stroke="@corpsO" stroke-width="0.5"/>`
    + `<path d="M9.2 5 l1.4 1.2 M9.8 4.4 l1.8 0.6" stroke="#241a10" stroke-width="0.7" stroke-linecap="round"/>`
    + theroLegProfile(0, false)
    + `</g>`;
}
function theroBodyFront(p: BirdProps): string {
  const g = p.girth;
  return `<g>`
    + `<path d="M-7 26 l-2.8 2 M-7 26 l0 3 M-7 26 l2.8 2 M7 26 l-2.8 2 M7 26 l0 3 M7 26 l2.8 2" stroke="@cuir" stroke-width="1.5" fill="none" stroke-linecap="round"/>`
    + `<path d="M-8.5 6 Q-11 12 -8.6 18 L-5.6 26 L-8 26 M8.5 6 Q11 12 8.6 18 L5.6 26 L8 26" fill="none" stroke="@corps" stroke-width="4.6" stroke-linecap="round"/>`
    + `<ellipse cx="0" cy="0" rx="${(10.5 * g).toFixed(1)}" ry="13" fill="@corps" stroke="@corpsO" stroke-width="0.8"/>`
    + `<ellipse cx="0" cy="3" rx="${(6 * g).toFixed(1)}" ry="9" fill="@corpsH" opacity="0.8"/>`
    + theroSpots([[-7, -8], [7, -8], [-8, 0], [8, 0]])
    + `<path d="M-4 9 q-1.6 2.4 -0.6 4.6 M4 9 q1.6 2.4 0.6 4.6" stroke="@corps" stroke-width="2.2" stroke-linecap="round" fill="none"/>`
    + `</g>`;
}
function theroBodyBack(p: BirdProps): string {
  const g = p.girth, t = p.tailLen ?? 1;
  return `<g>`
    + `<path d="M-8.5 6 Q-11 12 -8.6 18 L-6 26 M8.5 6 Q11 12 8.6 18 L6 26" fill="none" stroke="@corpsO" stroke-width="4.6" stroke-linecap="round"/>`
    + `<ellipse cx="0" cy="-1" rx="${(10.5 * g).toFixed(1)}" ry="12.5" fill="@corpsO" stroke="@corpsO" stroke-width="0.8"/>`
    + `<path d="M0 -12 L0 8" stroke="@corps" stroke-width="0.7" opacity="0.5"/>`
    // queue qui tombe vers la caméra (bas de l'écran), tachetée
    + `<path d="M-3.6 6 L3.6 6 Q${(5.4 * t).toFixed(1)} ${14 * t} 2.4 ${(25 * t).toFixed(0)} L-2.4 ${(25 * t).toFixed(0)} Q${(-5.4 * t).toFixed(1)} ${14 * t} -3.6 6 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>`
    + theroSpots([[0, 11], [-1.4, 17], [1.2, 21]])
    + `</g>`;
}
function theroHead(view: View): string {
  if (view === 'front')
    return `<g><path d="M-5 -6 Q0 -8.4 5 -6 L4.2 2 Q3.4 7.4 0 9.6 Q-3.4 7.4 -4.2 2 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>`
      + `<path d="M-2.6 5.4 Q0 9.8 2.6 5.4 L1.6 8.8 Q0 10.6 -1.6 8.8 Z" fill="@corpsH" opacity="0.85"/>`
      + `<ellipse cx="-2.8" cy="-1.6" rx="1.4" ry="1.7" fill="#d8c238"/><ellipse cx="-2.8" cy="-1.6" rx="0.5" ry="1.5" fill="#160c04"/>`
      + `<ellipse cx="2.8" cy="-1.6" rx="1.4" ry="1.7" fill="#d8c238"/><ellipse cx="2.8" cy="-1.6" rx="0.5" ry="1.5" fill="#160c04"/>`
      + `<path d="M-1.2 6.8 q-0.4 0.8 0 1.5 M1.2 6.8 q0.4 0.8 0 1.5" stroke="#241a10" stroke-width="0.6" fill="none"/></g>`;
  if (view === 'back')
    return `<g><path d="M-5 -6 Q0 -8.4 5 -6 L4 3 Q3 8 0 10 Q-3 8 -4 3 Z" fill="@corpsO"/><path d="M0 -7 L0 8" stroke="@corps" stroke-width="0.5" opacity="0.4"/></g>`;
  // profil : long museau denté vers +x, œil reptilien
  return `<g><path d="M-5 -5 Q0 -7.5 5 -5.5 L14.5 -2 Q16 -1 15.2 0.6 L5.5 1.6 Q-1 2.4 -5.5 1 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>`
    + `<path d="M-4.5 2.2 L12.8 1.8 Q13.8 3.2 12.4 4.4 L-2.6 5.6 Q-5 4.6 -4.5 2.2 Z" fill="@corpsH" stroke="@corpsO" stroke-width="0.6"/>`
    + `<path d="M3.4 1 l0.8 1.6 l0.9 -1.5 l0.9 1.6 l0.9 -1.5 l0.9 1.5 l0.9 -1.4 l0.9 1.5 l0.9 -1.4 l0.9 1.3 l0.9 -1.3" stroke="#efe6cf" stroke-width="0.8" fill="none"/>`
    + `<circle cx="13.6" cy="-1" r="0.55" fill="#241a10"/>`
    + `<ellipse cx="1.6" cy="-2.4" rx="1.6" ry="1.8" fill="#d8c238"/><ellipse cx="1.6" cy="-2.4" rx="0.55" ry="1.7" fill="#160c04"/>`
    + `<path d="M-1 -4.6 q2.6 -1 4.8 -0.2" stroke="@corpsO" stroke-width="0.8" fill="none"/></g>`;
}

// --- poses (DELTA additif) ------------------------------------------------
export const BIRD_REST: Record<string, number> = {};
/** Dodelinement de tête (le tell de l'oiseau). phase ∈ [0,1). */
export function birdBob(phase: number): Record<string, number> {
  return { tete: Math.sin(phase * Math.PI * 2) * 9 };
}
/** Coup de bec : la tête plonge en avant. phase ∈ [0,1]. */
export function birdPeck(phase: number): Record<string, number> {
  return { tete: Math.sin(Math.min(1, phase) * Math.PI) * 38 };
}
/** Mort : sur le flanc (corps basculé), tête tombée. */
export const BIRD_DEATH: Record<string, number> = { corps: 84, tete: 20 };

export function resolveBirdFromProps(
  p: BirdProps,
  view: View = 'profile',
  pose: BonePose = {},
  colors?: Palette,
): ResolvedBone[] {
  const sk = buildSkeleton();
  if (p.theropod) sk.tete.pivot = { x: 15, y: -9 }; // tête portée EN AVANT (cou horizontal), pas au-dessus
  if (p.raptor) { // piqué : corps haut (ailes levées au-dessus), tête portée en BAS-AVANT
    sk.corps.pivot = { x: 56, y: 98 };
    sk.tete.pivot = view === 'front' ? { x: 0, y: 12 } : view === 'back' ? { x: 0, y: -11 } : { x: 16, y: 9 };
  }
  const world = worldTransformsG(sk, pose) as Record<BirdBoneId, Matrix>;
  const tmap = buildTokenMap([p.palette], colors ?? {});
  const body = p.raptor
    ? (view === 'front' ? raptorBodyFront(p) : view === 'back' ? raptorBodyBack(p) : raptorBodyProfile(p))
    : p.theropod
      ? (view === 'front' ? theroBodyFront(p) : view === 'back' ? theroBodyBack(p) : theroBodyProfile(p))
      : (view === 'front' ? bodyFront(p) : view === 'back' ? bodyBack(p) : bodyProfile(p));
  const art: Record<BirdBoneId, string> = {
    corps: body,
    tete: p.raptor ? raptorHead(view) : p.theropod ? theroHead(view) : head(p, view),
  };
  return sortByZ((Object.keys(sk) as BirdBoneId[])
    .map((id) => ({
      id, matrix: world[id], scale: [1, 1] as [number, number], z: sk[id].z,
      parts: [{ svg: applyTokenMap(art[id], tmap), layer: 0 }],
    })));
}

export const BIRD_DEFAULT: BirdProps = {
  sl: 0.62, girth: 1.0,
  palette: { corps: '#7c8a99', corpsO: '#4e5a66', corpsH: '#c2ccd4', cheveux: '#3a444e', cheveuxO: '#222a30', cuir: '#d06a26' },
};

export function resolveBird(species: string, view: View = 'profile', pose: BonePose = {}, colors?: Palette): ResolvedBone[] {
  return resolveBirdFromProps(BIRD_SPECIES[species] ?? BIRD_DEFAULT, view, pose, colors);
}
export const avianPlan: BodyPlan = {
  id: 'avian',
  resolve: (sp, view, pose, opts) => resolveBird(sp, view, pose, opts?.colors),
  speciesNames: () => Object.keys(BIRD_SPECIES),
  restPose: () => BIRD_REST,
  idlePose: birdBob, // dodelinement de tête en continu
  walkPose: birdBob, // sautillement = dodelinement plus rapide
  attackPose: birdPeck,
  deathPose: () => BIRD_DEATH,
  hasView: () => true,
};

export function birdSvg(
  p: BirdProps,
  view: View,
  opts: { dead?: boolean; bobPhase?: number; colors?: Palette } = {},
): string {
  const pose = opts.dead ? BIRD_DEATH : opts.bobPhase != null ? birdBob(opts.bobPhase) : {};
  return bonesToSvg(resolveBirdFromProps(p, view, pose, opts.colors));
}
