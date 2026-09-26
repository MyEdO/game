/**
 * Gabarit THÉROPODE (grands sauriens prédateurs des Terres du Sud — Cornu, et tout carnosaure
 * bipède) : bête dressée sur deux PATTES ARRIÈRE massives (digitigrades, serres), petits bras
 * avant griffus, longue queue-balancier à crête, cou porté en avant, longue gueule de prédateur
 * hérissée de rangées de dents, crête d'épines OSSEUSES optionnelle sur le sommet du crâne
 * (les « cornes pointues » du Cornu — pas une grande corne recourbée unique).
 * Anim propre au plan : respiration/balancement de queue au repos, foulée bipède au déplacement,
 * détente du cou + gueule grande ouverte à l'attaque, effondrement en avant à la mort. Réutilise
 * la machinerie (FK générique, palette tokenisée, rendu) — même patron que jabberslythe/squig.
 *
 * Traits OPTIONNELS (défaut = éteint, rendu saurien inchangé) pour les hybrides bipèdes type
 * Cockatrice (art-ref/zi/page068_img1.png) : `wings` = grandes ailes MEMBRANEUSES déployées,
 * `beak` = tête de coq/rapace à bec crochu (remplace la gueule dentée), `plumage` = cou/échine
 * emplumés hirsutes, `serpentTail` = queue serpentine effilée (remplace le balancier à crête).
 */
import type { BonePose } from '../poses';
import type { ResolvedBone } from '../composeRig';
import type { BodyPlan } from '../bodyPlan';
import type { View } from '../facing';
import type { Palette, PaletteDeclaree } from '../palette';
import { worldTransformsG, type FKBone, type Matrix } from '../kinematics';
import { buildTokenMap, applyTokenMap } from '../palette';
import { bonesToSvg } from '../renderBones';
import { THEROPOD_SPECIES } from '../creatures';
import { sortByZ } from '../composite';

export type TheropodBoneId =
  | 'corps' | 'queue' | 'cou' | 'tete' | 'machoire'
  | 'brasG' | 'brasD' | 'jambeG' | 'jambeD' | 'aileG' | 'aileD';
type TBone = FKBone & { z: number };
export interface TheropodProps {
  sl: number;
  girth: number; // profondeur du torse
  horns: number; // × hauteur de la crête d'épines osseuses du crâne (0 = crâne nu)
  muzzle: number; // × longueur de la gueule
  /** × envergure des ailes MEMBRANEUSES déployées (absent/0 = pas d'ailes — saurien pur). */
  wings?: number;
  /** × longueur du bec CROCHU de coq/rapace — remplace la gueule dentée (absent/0 = gueule). */
  beak?: number;
  /** Plumage hirsute (cou emplumé, échine à plumes au lieu d'épines) — absent/0 = écailles. */
  plumage?: number;
  /** Queue SERPENTINE effilée à pointe retroussée au lieu du balancier à crête. */
  serpentTail?: boolean;
  palette: PaletteDeclaree;
}

const TEETH = '#efe6cf';
const EYE = '#6e421c'; // œil sombre et discret (artwork ZI 80 — pas de jaune vif)
const MAW = '#2a0e0c';
const TONGUE = '#b03038';
const CLAW = '#15110c';

/** Longueur du museau (repère local de la tête). */
const muzzleLen = (p: TheropodProps): number => 14 + 8 * p.muzzle;

/** Rangée de dents triangulaires (le prédateur en a des DIZAINES, pas 3). `up` = crocs dressés. */
function teethRow(x0: number, x1: number, y: number, h: number, up: boolean): string {
  let d = '';
  for (let x = x0, i = 0; x <= x1; x += 2.9, i++) {
    const hh = i % 2 === 0 ? h : h * 0.7;
    d += `M${x.toFixed(1)} ${y} l1 ${(up ? -hh : hh).toFixed(1)} l1.4 ${(up ? hh : -hh).toFixed(1)} `;
  }
  return `<path d="${d}" fill="${TEETH}"/>`;
}

function buildSkeleton(p: TheropodProps): Record<TheropodBoneId, TBone> {
  void p;
  return {
    corps: { parent: null, pivot: { x: 58, y: 96 }, angle: 0, z: 5 }, // torse penché, hanches massives
    queue: { parent: 'corps', pivot: { x: -18, y: 0 }, angle: 0, z: 3 }, // balancier à crête
    cou: { parent: 'corps', pivot: { x: 15, y: -13 }, angle: 14, z: 6 }, // porté en avant
    tete: { parent: 'cou', pivot: { x: 0, y: -22 }, angle: -8, z: 7 },
    machoire: { parent: 'tete', pivot: { x: 0, y: 1.5 }, angle: 9, z: 8 }, // gueule entrouverte au repos
    brasG: { parent: 'corps', pivot: { x: 11, y: 2 }, angle: 0, z: 2 }, // petit bras lointain
    brasD: { parent: 'corps', pivot: { x: 14, y: 4 }, angle: 0, z: 9 },
    jambeG: { parent: 'corps', pivot: { x: -13, y: 2 }, angle: 4, z: 1 }, // patte lointaine, décalée derrière
    jambeD: { parent: 'corps', pivot: { x: -4, y: 2 }, angle: 0, z: 10 },
    aileG: { parent: 'corps', pivot: { x: -4, y: -13 }, angle: 0, z: 2 }, // aile lointaine (derrière)
    aileD: { parent: 'corps', pivot: { x: 2, y: -14 }, angle: 0, z: 4 }, // aile proche, sous le torse
  };
}

/** Adapte le squelette à la VUE (comme quadSkeletonForView) : face/dos = composition SYMÉTRIQUE
 *  (cou/tête recentrés, pattes en straddle, queue derrière en face / pendante vers l'œil de dos). */
function skeletonForView(sk: Record<TheropodBoneId, TBone>, view: View): Record<TheropodBoneId, TBone> {
  if (view === 'profile') return sk;
  const front = view === 'front';
  const out = { ...sk };
  out.queue = { ...sk.queue, pivot: { x: front ? 3 : 0, y: 3 }, angle: 0, z: front ? 1 : 8 };
  out.cou = { ...sk.cou, pivot: { x: 0, y: -16 }, angle: 0, z: 6 };
  out.tete = { ...sk.tete, pivot: { x: 0, y: -15 }, angle: 0, z: 7 };
  out.machoire = { ...sk.machoire, pivot: { x: 0, y: 3 }, angle: 0, z: 8 };
  out.brasD = { ...sk.brasD, pivot: { x: 12, y: 0 }, angle: 0, z: front ? 6 : 2 };
  out.brasG = { ...sk.brasG, pivot: { x: -12, y: 0 }, angle: 0, z: front ? 6 : 2 };
  out.jambeD = { ...sk.jambeD, pivot: { x: 10, y: 2 }, angle: 0, z: 4 };
  out.jambeG = { ...sk.jambeG, pivot: { x: -10, y: 2 }, angle: 0, z: 4 };
  // ailes déployées en miroir : derrière le corps de face, vers l'œil de dos
  out.aileD = { ...sk.aileD, pivot: { x: 9, y: -13 }, angle: 0, z: front ? 2 : 8 };
  out.aileG = { ...sk.aileG, pivot: { x: -9, y: -13 }, angle: 0, z: front ? 2 : 8 };
  return out;
}

function body(p: TheropodProps, view: View): string {
  const g = p.girth;
  if (view !== 'profile') {
    const rx = 15 * g;
    // poitrail vu de bout + mouchetures ; épines d'épaule en silhouette
    const spikes = `<path d="M${-rx + 4} -15 l-3.5 -7 l6.5 2.6 M-3.5 -18 l-1 -7.5 l5 4 M${rx - 7} -16 l2.5 -7 l4 5.5" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.4"/>`;
    const chest = `<ellipse cx="0" cy="0" rx="${rx.toFixed(1)}" ry="19" fill="@corps" stroke="@corpsO" stroke-width="0.8"/>`;
    const belly = view === 'front'
      ? `<ellipse cx="0" cy="6" rx="${(rx * 0.58).toFixed(1)}" ry="11" fill="@corpsH" opacity="0.5"/>` +
        `<path d="M-6 -2 q6 2.6 12 0 M-5 4 q5 2.4 10 0 M-4 10 q4 2.2 8 0" stroke="@corpsO" stroke-width="0.5" fill="none" opacity="0.45"/>`
      : `<path d="M0 -17 L0 17" stroke="@corpsO" stroke-width="1" opacity="0.4"/>` + // sillon dorsal
        `<path d="M-1.5 -13 l-2 -6 l5 2.2 M-1 -6 l-1.5 -6 l4.5 2.4 M-0.5 1 l-1.5 -6 l4.5 2.4 M0 8 l-1.5 -5.5 l4 2.2" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.4"/>`;
    const spots = `<circle cx="${-rx + 5}" cy="-6" r="1.9" fill="@corpsO" opacity="0.35"/><circle cx="${rx - 5}" cy="-3" r="1.7" fill="@corpsO" opacity="0.35"/><circle cx="${-rx + 7}" cy="6" r="1.5" fill="@corpsO" opacity="0.3"/><circle cx="${rx - 7}" cy="9" r="1.6" fill="@corpsO" opacity="0.3"/>`;
    return `<g>${chest}${spikes}${belly}${spots}</g>`;
  }
  // PROFIL : torse penché — poitrail avant (+x) haut, masse des hanches à l'arrière
  const torso = `<path d="M-24 4 Q-28 -8 -17 -14 Q-4 -20 9 -15 Q18 -11 19.5 -3 Q20 7 10 12.5 Q-6 18.5 -18 12 Q-23 9 -24 4 Z" fill="@corps" stroke="@corpsO" stroke-width="0.8"/>` +
    `<circle cx="-13" cy="3" r="${(11.5 * g).toFixed(1)}" fill="@corps"/>`; // cuisse/hanche massive
  const belly = `<path d="M-17 10 Q-2 17.5 12 7.5 Q9 13 -3 14.8 Q-13 14 -17 10 Z" fill="@corpsH" opacity="0.55"/>`;
  const scales = `<path d="M-15 -6 q6 3 12 1 M-9 0 q6 3 12 1 M-2 -8 q5 3 10 1 M3 -2 q5 2.6 9 0.6" stroke="@corpsO" stroke-width="0.55" fill="none" opacity="0.5"/>`;
  const spots = `<circle cx="-7" cy="-8" r="2.1" fill="@corpsO" opacity="0.35"/><circle cx="4" cy="-10" r="1.7" fill="@corpsO" opacity="0.35"/><circle cx="-17" cy="-3" r="1.9" fill="@corpsO" opacity="0.3"/><circle cx="11" cy="-6" r="1.5" fill="@corpsO" opacity="0.3"/>`;
  // échine : épines osseuses (saurien) OU frange de plumes hirsutes (plumage — artwork Cockatrice)
  const crest = p.plumage
    ? `<path d="M-22 -7 L-26 -13.5 L-19.5 -10.5 L-21 -17.5 L-14 -12.5 L-14.5 -20.5 L-8 -14.5 L-6.5 -22 L-1 -15.5 L2.5 -21.5 L5.5 -14.5 L11.5 -18 L10.5 -12" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.5"/>` +
      `<path d="M3 -12 q3.5 2.6 7 1.2 M7 -8 q3.5 2.6 7 1.2 M1 -6 q3.5 2.6 7 1.2 M5 -2 q3.2 2.4 6.5 1" stroke="@cheveuxO" stroke-width="0.6" fill="none" opacity="0.55"/>` // plumes du poitrail
    : `<path d="M-21 -8.5 l-2.5 -7.5 l6 3.4 M-12 -12.5 l-1.5 -8.5 l6 4 M-3 -16 l0 -8.5 l5.5 4.8 M7 -14 l1.5 -8 l5 5.4" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.4"/>`;
  return `<g>${torso}${belly}${scales}${spots}${crest}</g>`;
}

function tail(p: TheropodProps, view: View): string {
  if (p.serpentTail) {
    if (view === 'front') // pointe sinueuse qui fouette sur le flanc
      return `<g opacity="0.95"><path d="M0 4 Q12 10 20 6 Q26 3 24 -2 Q22 -4.5 20.5 -2 Q21.5 1 17.5 3 Q10 5.5 2 1 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/></g>`;
    if (view === 'back') // DOS : la queue serpente vers l'œil en S effilé
      return `<g><path d="M-3 -2 Q-7 8 -3 16 Q1 23 -2 30 Q-4.5 35 1 38.5 Q4.5 40.5 3.5 36.5 Q1 33 3.5 28 Q6.5 21 2.5 14 Q-0.5 8 1.5 -2 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
        `<path d="M-3.5 6 l5 1 M-3 13 l5 1 M0 20 l4.5 0.5 M-1 27 l4.5 0" stroke="@corpsO" stroke-width="0.5" opacity="0.5"/></g>`;
    // PROFIL : longue queue SERPENTINE — s'effile en S, pointe fine retroussée (artwork Cockatrice)
    return `<g><path d="M1 -5.5 C-12 -4 -24 1.5 -31.5 -1.5 C-35.5 -3.5 -36.5 -8.5 -35.5 -13.5 C-38.5 -9 -38.8 -2.5 -33 1.8 C-25 7 -12 5.5 1 4.5 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
      `<path d="M-8 -3.5 l-0.5 7.5 M-16 -2.5 l-1 7 M-23 -1 l-1.5 5.5 M-29 -2 l-2 4" stroke="@corpsO" stroke-width="0.55" opacity="0.5"/>` + // anneaux d'écailles
      `<path d="M-6 3 Q-20 4.5 -29 0.5" stroke="@corpsH" stroke-width="0.9" fill="none" opacity="0.5"/></g>`;
  }
  if (view !== 'profile') {
    if (view === 'front') // pointe qui dépasse sur le flanc
      return `<g opacity="0.95"><path d="M0 5 Q14 9 23 4 Q27 1 23.5 -1 Q16 2 5 1 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/></g>`;
    // DOS : la queue pend vers l'œil, crête visible
    return `<g><path d="M-4 -2 Q-6 12 -3 24 Q0 33 6.5 37.5 Q10 39.5 8 34 Q4.5 25 4.5 12 Q4.5 3 4 -2 Z" fill="@corps" stroke="@corpsO" stroke-width="0.8"/>` +
      `<path d="M-3.5 4 l-4.5 -1 l3 4.2 M-3.5 12 l-4.5 -0.6 l3 4 M-2.5 20 l-4.2 0 l3 3.6 M0 28 l-4 0.6 l3.4 3" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.4"/></g>`;
  }
  // PROFIL : balancier épais qui s'effile, pointe retroussée (artwork), crête d'épines sur l'arête
  const mass = `<path d="M2 -7 C-14 -11 -28 -9 -38 -17 Q-41.5 -19.5 -39 -14 C-33 -4 -18 3.5 2 7.5 Z" fill="@corps" stroke="@corpsO" stroke-width="0.8"/>`;
  const light = `<path d="M-8 4.5 Q-22 1.5 -33 -6" stroke="@corpsH" stroke-width="0.9" fill="none" opacity="0.5"/>`;
  const spikes = `<path d="M-7 -9 l-2 -6.5 l5.5 2.8 M-16 -9.8 l-2.5 -6 l5.8 2.4 M-25 -9.5 l-3 -5.5 l6 2 M-33 -12 l-3.5 -5 l5.8 1.4" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.4"/>`;
  return `<g>${mass}${spikes}${light}</g>`;
}

function neck(p: TheropodProps, view: View): string {
  if (view !== 'profile') {
    const fringe = p.plumage
      ? `<path d="M-6 -2 L-11 -5 L-6.5 -7 L-11 -11 L-6 -12 L-9.5 -17 L-4.5 -15.5 M6 -2 L11 -5 L6.5 -7 L11 -11 L6 -12 L9.5 -17 L4.5 -15.5" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.45"/>` // collerette hirsute
      : '';
    return `<g>${fringe}<path d="M-6.5 3 Q-7.5 -8 -5 -16 L5 -16 Q7.5 -8 6.5 3 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
      (view === 'front' ? `<path d="M-3 -12 Q0 2 3 -12" stroke="@corpsH" stroke-width="1.6" fill="none" opacity="0.5"/>`
        : `<path d="M-0.5 -14 l-1.5 -5 l4 2 M0 -8 l-1.5 -5 l4 2.2" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.4"/>`) + `</g>`;
  }
  // colonne musclée penchée en avant, base évasée noyée dans le torse, gorge claire
  const column = `<path d="M-9.5 8 Q-9.8 -7 -4.5 -22 L6 -22 Q9 -8 9.5 8 Q0 12 -9.5 8 Z" fill="@corps" stroke="@corpsO" stroke-width="0.8"/>` +
    `<path d="M4.5 -18 Q6.5 -6 5.5 4" stroke="@corpsH" stroke-width="1.4" fill="none" opacity="0.55"/>`; // gorge
  if (p.plumage) {
    // cou EMPLUMÉ (artwork Cockatrice) : camail hirsute sur la nuque + écailles de plumes
    return `<g>${column}` +
      `<path d="M-7 3 L-13.5 1 L-8 -2 L-14 -6.5 L-8 -8.5 L-13 -13.5 L-7 -13.5 L-11 -19.5 L-5 -17 L-7.5 -22 L-2 -20" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.5"/>` +
      `<path d="M-3 -16 q3 2.2 5.5 0.8 M-4 -10 q3.5 2.4 6.5 1 M-4.5 -4 q3.5 2.4 7 1 M-4 2 q3.5 2.2 7 0.8" stroke="@cheveuxO" stroke-width="0.55" fill="none" opacity="0.6"/></g>`;
  }
  return `<g>${column}` +
    `<path d="M-6.5 -2 l-5.5 -3.2 l6.3 -2 M-6 -9.5 l-5 -3.8 l6.3 -1.4 M-5 -16.5 l-4.5 -4.2 l6 -1" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.4"/></g>`; // épines de nuque
}

const BEAK_EYE = '#e9e6d6'; // œil PÂLE et fixe du regard pétrifiant (artwork Cockatrice)

/** Tête de coq/rapace à BEC CROCHU (mode `beak`) — crête de plumes hérissées, œil pâle, bec ouvert. */
function beakHead(p: TheropodProps, view: View): string {
  const crest = `<path d="M-5.5 -10.5 L-9 -16 L-3.8 -13 L-3 -19.5 L0 -13.5 L3 -19.5 L3.8 -13 L9 -16 L5.5 -10.5" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.5"/>`;
  if (view === 'back') {
    return `<g><path d="M-6.5 -5 Q-6.5 -12 0 -12 Q6.5 -12 6.5 -5 Q6.5 1 4.5 3.5 L-4.5 3.5 Q-6.5 1 -6.5 -5 Z" fill="@corps" stroke="@corpsO" stroke-width="0.8"/>${crest}</g>`;
  }
  if (view === 'front') {
    const skull = `<path d="M-7 -6 Q-7 -13 0 -13 Q7 -13 7 -6 Q7 0 4.5 2.5 L-4.5 2.5 Q-7 0 -7 -6 Z" fill="@corps" stroke="@corpsO" stroke-width="0.8"/>`;
    const eyes = `<ellipse cx="-3.5" cy="-6.5" rx="1.8" ry="2" fill="${BEAK_EYE}"/><circle cx="-3.5" cy="-6.3" r="0.8" fill="#0a0603"/>` +
      `<ellipse cx="3.5" cy="-6.5" rx="1.8" ry="2" fill="${BEAK_EYE}"/><circle cx="3.5" cy="-6.3" r="0.8" fill="#0a0603"/>` +
      `<path d="M-5.8 -8.6 Q-3.5 -10 -1.2 -8.4 M1.2 -8.4 Q3.5 -10 5.8 -8.6" stroke="@corpsO" stroke-width="0.9" fill="none"/>`;
    const beakFB = `<path d="M-3.2 -2.5 L3.2 -2.5 Q3.8 1.5 1.2 4.5 L0 6.8 L-1.2 4.5 Q-3.8 1.5 -3.2 -2.5 Z" fill="@cuir" stroke="#1a140e" stroke-width="0.6"/>` +
      `<circle cx="-1.2" cy="-1.2" r="0.5" fill="#1a140e" opacity="0.7"/><circle cx="1.2" cy="-1.2" r="0.5" fill="#1a140e" opacity="0.7"/>`;
    return `<g>${skull}${crest}${eyes}${beakFB}</g>`;
  }
  // PROFIL : crâne rond de rapace, grand œil pâle, bec crochu OUVERT à pointe rabattue
  const t = 8 + 6 * (p.beak ?? 1); // longueur du bec
  const skull = `<path d="M-8.5 2 Q-10 -7 -3.5 -10.5 Q2.5 -13 7.5 -10 Q11 -8 12 -4.5 Q12.5 -2 11.5 0.5 L-6 4 Z" fill="@corps" stroke="@corpsO" stroke-width="0.8"/>`;
  const crestP = `<path d="M-6.5 -7.5 L-11 -13 L-4.5 -11 L-6 -18 L-0.5 -12.5 L1 -19.5 L4 -12.5 L8.5 -17 L7.5 -11 L11.5 -12.5 L8 -8" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.5"/>`;
  const shag = `<path d="M-6 3 L-9.5 8 L-4.5 6 L-5.5 11 L-0.5 7.5" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.45"/>`; // barbe de plumes sous le crâne
  const beakP = `<path d="M8 -6.5 Q${(8 + 0.4 * t).toFixed(1)} -8 ${(8 + 0.75 * t).toFixed(1)} -5.5 Q${(8 + t).toFixed(1)} -3.5 ${(8 + t + 0.5).toFixed(1)} -0.5 Q${(8 + t + 0.8).toFixed(1)} 2.2 ${(8 + t - 1.5).toFixed(1)} 3.5 Q${(8 + t - 0.5).toFixed(1)} 6.5 ${(8 + t - 3).toFixed(1)} 9 Q${(8 + t - 3.5).toFixed(1)} 5.5 ${(8 + t - 5).toFixed(1)} 3.8 Q${(8 + 0.35 * t).toFixed(1)} 4.6 9.5 3 Q8.2 -1.5 8 -6.5 Z" fill="@cuir" stroke="#1a140e" stroke-width="0.6"/>` +
    `<circle cx="${(8 + 0.35 * t).toFixed(1)}" cy="-3.6" r="0.7" fill="#1a140e" opacity="0.7"/>`; // narine
  const brow = `<path d="M-2 -8.6 Q2 -10 5.5 -8" stroke="@corpsO" stroke-width="1.1" fill="none"/>`;
  const eye = `<ellipse cx="1.5" cy="-5.8" rx="2" ry="2.2" fill="${BEAK_EYE}"/><circle cx="2.2" cy="-5.6" r="0.9" fill="#0a0603"/>`;
  return `<g>${crestP}${shag}${skull}${beakP}${brow}${eye}</g>`;
}

/** Bec inférieur ouvert + langue effilée (mode `beak`). */
function beakJaw(p: TheropodProps, view: View): string {
  if (view === 'back') return '';
  if (view === 'front') {
    return `<g><path d="M-2.6 1 Q0 0.2 2.6 1 Q2 5.4 0 6.6 Q-2 5.4 -2.6 1 Z" fill="@cuir" stroke="#1a140e" stroke-width="0.5"/>` +
      `<path d="M-0.9 2.4 Q0 2 0.9 2.4 Q0.4 4.6 0 4.8 Q-0.4 4.6 -0.9 2.4 Z" fill="${TONGUE}"/></g>`;
  }
  const t = (8 + 6 * (p.beak ?? 1)) * 0.62; // mandibule plus courte que le bec supérieur
  const bone = `<path d="M2 0 Q${(0.45 * t + 5).toFixed(1)} 1.4 ${(0.8 * t + 5).toFixed(1)} 3.4 Q${(0.9 * t + 5).toFixed(1)} 4.4 ${(0.72 * t + 4).toFixed(1)} 5.4 Q${(0.35 * t + 5).toFixed(1)} 6.8 4.5 5.4 Q1 3.6 2 0 Z" fill="@cuir" stroke="#1a140e" stroke-width="0.6"/>`;
  const tongue = `<path d="M${(0.4 * t + 5).toFixed(1)} 2.4 Q${(0.75 * t + 5).toFixed(1)} 3.4 ${(0.95 * t + 5).toFixed(1)} 5.8 Q${(t + 5.5).toFixed(1)} 7.6 ${(t + 6.5).toFixed(1)} 9.6" stroke="${TONGUE}" stroke-width="1.1" fill="none" stroke-linecap="round"/>`;
  return `<g>${bone}${tongue}</g>`;
}

function head(p: TheropodProps, view: View): string {
  if (p.beak) return beakHead(p, view);
  const hl = p.horns;
  if (view === 'back') {
    // crête d'épines OSSEUSES multiples sur le sommet du crâne (artwork ZI 80 : pas de grande corne unique)
    const spikes = hl > 0
      ? `<path d="M-4.2 -10 l${(-1.6 * hl).toFixed(1)} ${(-4.6 * hl).toFixed(1)} l3.4 1.6 M-0.9 -11.4 l${(-0.2 * hl).toFixed(1)} ${(-5.6 * hl).toFixed(1)} l3 2.2 M2.4 -10.6 l${(1 * hl).toFixed(1)} ${(-4.6 * hl).toFixed(1)} l2.6 2.6" fill="@cuir" stroke="@corpsO" stroke-width="0.5"/>`
      : '';
    return `<g><path d="M-6.5 -5 Q-6.5 -12 0 -12 Q6.5 -12 6.5 -5 Q6.5 1 4.5 3.5 L-4.5 3.5 Q-6.5 1 -6.5 -5 Z" fill="@corps" stroke="@corpsO" stroke-width="0.8"/>${spikes}</g>`;
  }
  if (view === 'front') {
    const skull = `<path d="M-7 -6 Q-7 -13 0 -13 Q7 -13 7 -6 Q7 0 4.5 2.5 L-4.5 2.5 Q-7 0 -7 -6 Z" fill="@corps" stroke="@corpsO" stroke-width="0.8"/>`;
    // crête d'épines osseuses vue de face : éventail serré de pointes sur le sommet du crâne
    const spikes = hl > 0
      ? `<path d="M-5 -10.6 l${(-2 * hl).toFixed(1)} ${(-4.4 * hl).toFixed(1)} l3.6 1.4 M-1.6 -12.4 l${(-0.4 * hl).toFixed(1)} ${(-5.6 * hl).toFixed(1)} l3.2 2 M2 -12 l${(0.8 * hl).toFixed(1)} ${(-4.8 * hl).toFixed(1)} l2.8 2.4" fill="@cuir" stroke="@corpsO" stroke-width="0.5"/>`
      : '';
    const eyes = `<ellipse cx="-3.5" cy="-6.5" rx="1.6" ry="1.9" fill="${EYE}"/><ellipse cx="-3.5" cy="-6.3" rx="0.55" ry="1.5" fill="#0a0603"/>` +
      `<ellipse cx="3.5" cy="-6.5" rx="1.6" ry="1.9" fill="${EYE}"/><ellipse cx="3.5" cy="-6.3" rx="0.55" ry="1.5" fill="#0a0603"/>` +
      `<path d="M-5.8 -8.6 Q-3.5 -10 -1.2 -8.4 M1.2 -8.4 Q3.5 -10 5.8 -8.6" stroke="@corpsO" stroke-width="0.9" fill="none"/>`;
    const maw = `<path d="M-5 0.6 Q0 -1 5 0.6 Q5.4 7.6 0 9.5 Q-5.4 7.6 -5 0.6 Z" fill="${MAW}"/>` +
      `<path d="M-4.4 0.8 l0.8 3.2 l1.1 -3 M-1.9 0.2 l0.8 3.4 l1.1 -3.2 M0.6 0.3 l0.8 3.3 l1.1 -3.1 M3 0.9 l0.8 2.9 l1 -2.7" fill="${TEETH}"/>`;
    return `<g>${skull}${spikes}${eyes}${maw}</g>`;
  }
  // PROFIL : longue gueule de prédateur, arcade marquée, crête d'épines osseuses sur le crâne
  const mz = muzzleLen(p);
  const skull = `<path d="M-9 2 Q-11 -6 -5 -10.5 Q1 -13.5 6 -10.5 Q10 -8.5 ${(mz * 0.55).toFixed(1)} -7 Q${mz} -4.5 ${mz + 1} -1 Q${mz} 1.6 ${mz - 2} 1.6 L-6 4 Z" fill="@corps" stroke="@corpsO" stroke-width="0.8"/>`;
  // épines multiples courant de l'arrière du crâne à l'arcade, penchées vers l'arrière (artwork ZI 80)
  const spikes = hl > 0
    ? `<path d="M-7.5 -6.5 l${(-3 * hl).toFixed(1)} ${(-4.6 * hl).toFixed(1)} l5 1.6 M-3.8 -9.6 l${(-1.8 * hl).toFixed(1)} ${(-5.6 * hl).toFixed(1)} l4.6 2 M0.4 -11.2 l${(-0.6 * hl).toFixed(1)} ${(-6 * hl).toFixed(1)} l4.2 2.6 M4.4 -10.6 l${(0.6 * hl).toFixed(1)} ${(-5 * hl).toFixed(1)} l3.6 3" fill="@cuir" stroke="@corpsO" stroke-width="0.5"/>`
    : '';
  const brow = `<path d="M-5 -8.6 Q-0.5 -10.2 3.5 -8.2" stroke="@corpsO" stroke-width="1.1" fill="none"/>`;
  const eye = `<ellipse cx="-0.5" cy="-6.2" rx="1.7" ry="2" fill="${EYE}"/><ellipse cx="0" cy="-6" rx="0.6" ry="1.6" fill="#0a0603"/>`;
  const nostril = `<circle cx="${(mz - 2.5).toFixed(1)}" cy="-2.8" r="0.8" fill="@corpsO"/>`;
  const teeth = teethRow(2, mz - 1.5, 1.4, 4.4, false);
  return `<g>${skull}${spikes}${brow}${eye}${nostril}${teeth}</g>`;
}

function jaw(p: TheropodProps, view: View): string {
  if (p.beak) return beakJaw(p, view);
  if (view === 'back') return '';
  if (view === 'front') {
    return `<g><path d="M-5 0 Q0 -1.2 5 0 Q5.6 6.4 0 8 Q-5.6 6.4 -5 0 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
      `<path d="M-1.6 3 Q0 2.3 1.6 3 Q0.9 5.1 0 5.3 Q-0.9 5.1 -1.6 3 Z" fill="${TONGUE}"/>` +
      `<path d="M-4.2 0.4 l0.8 -3 l1.1 3.2 M-1.7 0 l0.8 -3.3 l1.1 3.1 M0.8 0 l0.8 -3.2 l1.1 3 M3.2 0.4 l0.7 -2.8 l1 3" fill="${TEETH}"/></g>`;
  }
  // PROFIL : mâchoire inférieure longue, langue rouge, crocs dressés
  const mz = muzzleLen(p);
  const bone = `<path d="M-1.5 0 Q${(mz * 0.5).toFixed(1)} 2.5 ${(mz * 0.82).toFixed(1)} 4.5 Q${(mz * 0.55).toFixed(1)} 9 2 7.5 Q-3.5 5 -1.5 0 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>`;
  const tongue = `<path d="M2.5 3 Q${(mz * 0.38).toFixed(1)} 3.6 ${(mz * 0.52).toFixed(1)} 5.2 Q${(mz * 0.32).toFixed(1)} 6.6 3 5.6 Z" fill="${TONGUE}"/>`;
  const teeth = teethRow(1.5, mz * 0.74, 1.6, 3.6, true);
  return `<g>${bone}${tongue}${teeth}</g>`;
}

/** GRANDE aile MEMBRANEUSE de dragon déployée (mode `wings`) : bras porteur, 4 doigts rayonnants,
 *  membrane festonnée, griffe au poignet — l'éventail dressé de l'artwork Cockatrice. */
function wing(p: TheropodProps, far: boolean, view: View): string {
  const w = (p.wings ?? 0) * (far ? 0.88 : 1); // aile lointaine légèrement réduite (perspective)
  if (w <= 0) return '';
  const op = far ? 0.7 : 0.95;
  const sx = view === 'profile' ? -1 : far ? -1 : 1;
  const tilt = view === 'profile' ? (far ? 12 : -2) : -10;
  return `<g opacity="${op}" transform="scale(${(sx * w).toFixed(2)},${w.toFixed(2)}) rotate(${tilt})">` +
    `<path d="M2 2 C8 -8 15 -22 22 -28 L46 -35 Q42 -25 48 -17 Q38 -12 42 -3 Q31 -1 31 6 Q18 7 2 2 Z" fill="@voilure" stroke="@voilureO" stroke-width="0.7"/>` +
    `<path d="M22 -28 L46 -35 M22 -28 L48 -17 M22 -28 L42 -3 M22 -28 L31 6" stroke="@voilureO" stroke-width="0.8" fill="none" opacity="0.8"/>` + // doigts
    `<path d="M2 2 Q8 -8 12 -15 Q17 -24 22 -28" stroke="@corps" stroke-width="2.8" fill="none" stroke-linecap="round"/>` + // bras porteur
    `<path d="M2 2 Q8 -8 12 -15 Q17 -24 22 -28" stroke="@corpsO" stroke-width="0.9" fill="none" opacity="0.6"/>` +
    `<path d="M22 -28 Q21 -31.5 23.5 -33.5 L25.5 -30.5 Z" fill="@cuir" stroke="#1a140e" stroke-width="0.4"/>` + // griffe de poignet
    `</g>`;
}

function arm(view: View, far: boolean): string {
  if (view === 'back') return '';
  if (view === 'front') {
    const sx = far ? -1 : 1; // bras G/D recentrés en miroir
    return `<g transform="scale(${sx},1)"><path d="M0 -2 Q4 3 3 9 Q2.5 13 -1 14.5 L-2.5 12 Q0.5 10 0.5 6 Q0 1 -2 -1 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` +
      `<path d="M-1 14 l-1 3 M-2.4 12.6 l-2.6 2.2" stroke="${CLAW}" stroke-width="1.1" stroke-linecap="round"/></g>`;
  }
  const op = far ? ' opacity="0.85"' : '';
  // petit bras avant : humérus court vers le bas, avant-bras en avant, deux griffes
  return `<g${op}><path d="M-2.5 -2.5 Q-5.5 5 0 9.5 Q5.5 12.5 9.5 11 L9 7.8 Q4.5 8.6 1.5 5.6 Q-0.8 2 1 -1.8 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` +
    `<path d="M9.2 9.4 l3.6 1.6 M8.2 11 l2.8 2.8" stroke="${CLAW}" stroke-width="1.2" stroke-linecap="round"/></g>`;
}

function leg(p: TheropodProps, view: View, far: boolean): string {
  const g = p.girth;
  if (view !== 'profile') {
    const sx = far ? -1 : 1;
    // pilier digitigrade vu de bout : cuisse large, canon, pied à 3 serres
    return `<g transform="scale(${sx},1)"><path d="M-7 -2 Q-12 10 -9 24 Q-7 34 -6 40 L5 40 Q8 24 5 6 Q4 -2 1 -4 Z" fill="@corps" stroke="@corpsO" stroke-width="0.8"/>` +
      `<path d="M-8 40 L-10 46.5 L10 46.5 L8 40 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
      `<path d="M-7 46.5 l-1 3.4 M-1.5 46.5 l0 3.8 M4 46.5 l1 3.4 M8 46.5 l2 2.8" stroke="${CLAW}" stroke-width="1.3" stroke-linecap="round"/>` +
      `<path d="M-8 6 q4 4 10 3" stroke="@corpsO" stroke-width="0.5" fill="none" opacity="0.5"/></g>`;
  }
  const op = far ? ' opacity="0.85"' : '';
  // PROFIL : patte arrière en Z (cuisse-pilon massive, jarret haut, canon, pied à serres + ergot)
  const thigh = `<ellipse cx="1" cy="12" rx="${(9.5 * g).toFixed(1)}" ry="15" transform="rotate(-14 1 12)" fill="@corps" stroke="@corpsO" stroke-width="0.8"/>`;
  const shank = `<path d="M6 22 Q9.5 28 7 34 Q5 39 -1 41.5 L-4.5 39.5 Q0.5 34 -0.5 27 Q-1 23.5 -3.5 21 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>`;
  const foot = `<path d="M-5 40 Q3 42 11.5 43.5 L12.5 47.5 L-7 47.5 Q-9 43.5 -5 40 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>`;
  const claws = `<path d="M12 45 l5 1.6 -4.2 2.6 M6 47.5 l3.2 3.4 M0 47.5 l2 3.8 M-6.5 46 l-2.8 2.4" stroke="${CLAW}" stroke-width="1.3" stroke-linecap="round" fill="none"/>`;
  const scales = `<path d="M-5 6 q5 4 11 2.6 M-6 13 q5.5 4 11.5 2.4" stroke="@corpsO" stroke-width="0.5" fill="none" opacity="0.5"/>`;
  const light = `<path d="M-4 19 Q1 22 5 19.5" stroke="@corpsH" stroke-width="1" fill="none" opacity="0.5"/>`;
  return `<g${op}>${thigh}${scales}${light}${shank}${foot}${claws}</g>`;
}

// --- poses (DELTA additif) ------------------------------------------------
export const THEROPOD_REST: Record<string, number> = {};
/** Respiration : balancement de queue, dodelinement du cou, gueule qui s'entrouvre. phase ∈ [0,1). */
export function theroBreathe(phase: number): Record<string, number> {
  const s = Math.sin(phase * Math.PI * 2);
  return { queue: s * 4, cou: s * 2, tete: -s * 1.5, machoire: (s + 1) * 2, brasD: s * 2, brasG: -s * 2, aileD: -s * 5, aileG: s * 5 };
}
/** Foulée bipède : pattes en opposition, torse qui tangue, queue-balancier en contre. phase ∈ [0,1). */
export function theroStride(phase: number): Record<string, number> {
  const s = Math.sin(phase * Math.PI * 2);
  return { jambeD: s * 16, jambeG: -s * 16, corps: Math.sin(phase * Math.PI * 4) * 2.5, queue: -s * 6, cou: -s * 2.5, brasD: -s * 5, brasG: s * 5, aileD: -s * 8, aileG: s * 8 };
}
/** Bond (trait) : ramassé puis détente, pattes repliées, queue tendue. phase ∈ [0,1). */
export function theroPounce(phase: number): Record<string, number> {
  const k = (Math.sin(phase * Math.PI * 2) + 1) / 2;
  return { corps: -4 - 5 * k, jambeD: 20 * k, jambeG: 20 * k, queue: -10 * k, cou: 5 * k, aileD: -25 * k, aileG: 25 * k };
}
/** Morsure : le corps plonge, le cou se détend, la gueule s'ouvre en grand. phase ∈ [0,1]. */
export function theroBite(phase: number): Record<string, number> {
  const k = Math.sin(Math.min(1, phase) * Math.PI);
  return { corps: k * 5, cou: k * 15, tete: k * 9, machoire: k * 30, brasD: -k * 10, brasG: -k * 10, queue: -k * 8, aileD: -k * 18, aileG: k * 18 };
}
/** Mort : effondrement en avant (torse basculé, cou tombé, gueule molle, pattes fauchées). */
export const THEROPOD_DEATH: Record<string, number> = {
  corps: 78, cou: 44, tete: 22, machoire: 16, jambeD: 26, jambeG: 12, brasD: 18, brasG: 8, queue: -22, aileD: 38, aileG: -38,
};

export function resolveTheropodFromProps(
  p: TheropodProps,
  view: View = 'front',
  pose: BonePose = {},
  colors?: Palette,
): ResolvedBone[] {
  const sk = skeletonForView(buildSkeleton(p), view);
  const world = worldTransformsG(sk, pose) as Record<TheropodBoneId, Matrix>;
  const tmap = buildTokenMap([p.palette], colors ?? {});
  const art: Record<TheropodBoneId, string> = {
    corps: body(p, view), queue: tail(p, view), cou: neck(p, view), tete: head(p, view), machoire: jaw(p, view),
    brasG: arm(view, true), brasD: arm(view, false), jambeG: leg(p, view, true), jambeD: leg(p, view, false),
    aileG: wing(p, true, view), aileD: wing(p, false, view),
  };
  return sortByZ((Object.keys(sk) as TheropodBoneId[])
    .filter((id) => art[id])
    .map((id) => ({
      id, matrix: world[id], scale: [1, 1] as [number, number], z: sk[id].z,
      parts: [{ svg: applyTokenMap(art[id], tmap), layer: 0 }],
    })));
}

export const THEROPOD_DEFAULT: TheropodProps = {
  sl: 1.1, girth: 1.0, horns: 1.0, muzzle: 1.0,
  palette: { corps: '#55703c', corpsO: '#28381d', corpsH: '#a3bd68', cheveux: '#39502a', cheveuxO: '#1c2a13', cuir: '#7a755c' },
};

export function resolveTheropod(species: string, view: View = 'front', pose: BonePose = {}, colors?: Palette): ResolvedBone[] {
  return resolveTheropodFromProps(THEROPOD_SPECIES[species] ?? THEROPOD_DEFAULT, view, pose, colors);
}

export const theropodPlan: BodyPlan = {
  id: 'theropode',
  resolve: (sp, view, pose, opts) => resolveTheropod(sp, view, pose, opts?.colors),
  speciesNames: () => Object.keys(THEROPOD_SPECIES),
  restPose: () => THEROPOD_REST,
  idlePose: theroBreathe,
  walkPose: theroStride,
  leapPose: theroPounce,
  attackPose: theroBite,
  deathPose: () => THEROPOD_DEATH,
  portraitBox: '52 26 60 60', // cadre la tête haute-avant (cou porté en avant + crête d'épines)
  hasView: () => true,
};

export function theropodSvg(p: TheropodProps, view: View, opts: { dead?: boolean; phase?: number; colors?: Palette } = {}): string {
  const pose = opts.dead ? THEROPOD_DEATH : opts.phase != null ? theroBreathe(opts.phase) : {};
  return bonesToSvg(resolveTheropodFromProps(p, view, pose, opts.colors));
}
