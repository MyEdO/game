/**
 * Gabarit JABBERSLYTHE (bêtes du Chaos crapaud-dragon : Jabberslythe générique + variantes
 * nommées Slenderthigh Whiptongue / Fr'hough Mournbreath). Silhouette calée sur l'artwork
 * officiel (art-ref/ldb/page324_img7750.png) : QUADRUPÈDE massif écailleux à dorsale d'épines
 * et ocelles, GRANDES AILES MEMBRANEUSES de dragon déployées en éventail, cou court noyé dans
 * une crinière hirsute, tête reptilienne CORNÉE à gueule béante hérissée de crocs + LANGUE-FOUET,
 * longue queue annelée finie en DARD de scorpion. Bois ramifiés optionnels (Mournbreath).
 * Anim propre : battement d'ailes + ondulation du cou au repos, bond au déplacement, fouet de
 * langue/cou à l'attaque, effondrement à la mort.
 */
import type { BonePose } from '../poses';
import type { ResolvedBone } from '../composeRig';
import type { BodyPlan } from '../bodyPlan';
import type { View } from '../facing';
import type { Palette, PaletteDeclaree } from '../palette';
import { worldTransformsG, type FKBone, type Matrix } from '../kinematics';
import { buildTokenMap, applyTokenMap } from '../palette';
import { bonesToSvg } from '../renderBones';
import { JABBER_SPECIES } from '../creatures';
import { sortByZ } from '../composite';

export type JabberBoneId = 'corps' | 'aileG' | 'aileD' | 'cou' | 'tete';
type JBone = FKBone & { z: number };
export interface JabberProps {
  sl: number;
  girth: number;
  antlers: boolean; // bois ramifiés (Mournbreath)
  tongue: number; // longueur de la langue-fouet (× ; Whiptongue = long)
  palette: PaletteDeclaree;
}

function buildSkeleton(): Record<JabberBoneId, JBone> {
  return {
    corps: { parent: null, pivot: { x: 60, y: 96 }, angle: 0, z: 3 }, // tronc quadrupède + queue-dard
    aileG: { parent: 'corps', pivot: { x: -6, y: -14 }, angle: 0, z: 1 }, // aile lointaine (derrière)
    aileD: { parent: 'corps', pivot: { x: 8, y: -15 }, angle: 0, z: 2 }, // aile proche
    cou: { parent: 'corps', pivot: { x: 14, y: -6 }, angle: -18, z: 4 }, // cou court à crinière, vers l'avant-haut
    tete: { parent: 'cou', pivot: { x: 0, y: -20 }, angle: 10, z: 5 },
  };
}

// Griffes d'un pied (3 triangles cornés) — pointe posée au sol y=gy.
function claws(gy: number): string {
  return `<path d="M-4 ${gy - 1} L-8 ${gy + 3} L-2 ${gy + 1} Z M-1 ${gy - 1} L-1 ${gy + 4} L2 ${gy} Z M3 ${gy - 1} L7 ${gy + 3} L2 ${gy + 1} Z" fill="@cuir" stroke="#1a140e" stroke-width="0.4"/>`;
}

// Queue annelée finie en DARD de scorpion (bulbe + telson en faucille) — le trait le plus
// distinctif. Balayée BASSE derrière la bête pour rester lisible sur le fond du gabarit
// (jamais noyée dans la membrane d'aile) ; le crochet se recourbe au-dessus du bulbe.
function tailSting(rootX: number, rootY: number, dir: number): string {
  // dir=-1 : la queue part vers -x (profil, derrière la bête) ; dir=+1 : vers +x (face/dos, sur le flanc)
  const d = dir;
  const x = (v: number) => (rootX + d * v).toFixed(1);
  return `<g>` +
    // fuseau annelé : part du croupion, s'abaisse vers l'arrière puis remonte en bulbe
    `<path d="M${x(0)} ${rootY - 5} C${x(12)} ${rootY + 3} ${x(22)} ${rootY + 5} ${x(27.5)} ${rootY + 0.5} C${x(30)} ${rootY - 1.5} ${x(30.5)} ${rootY - 5} ${x(28.5)} ${rootY - 7.5} L${x(25)} ${rootY - 5} C${x(26.5)} ${rootY - 3} ${x(26)} ${rootY - 1} ${x(24)} ${rootY + 0.5} C${x(18)} ${rootY + 4.5} ${x(9)} ${rootY + 4.5} ${x(0)} ${rootY + 4.5} Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
    // anneaux clairs (bandes de l'artwork)
    `<path d="M${x(8)} ${rootY - 2} l${(d * 1).toFixed(1)} 6 M${x(14)} ${rootY - 1} l${(d * 1.5).toFixed(1)} 5.5 M${x(20)} ${rootY - 0.5} l${(d * 2).toFixed(1)} 5 M${x(25)} ${rootY - 3.5} l${(d * 2.5).toFixed(1)} 4" stroke="@corpsH" stroke-width="0.9" opacity="0.55"/>` +
    // bulbe du dard
    `<ellipse cx="${x(27)}" cy="${rootY - 9.5}" rx="4.4" ry="3.8" fill="@corps" stroke="@corpsO" stroke-width="0.8"/>` +
    `<path d="M${x(29.5)} ${rootY - 12} q${(d * -2).toFixed(1)} 2 ${(d * -5).toFixed(1)} 2.4 M${x(30.5)} ${rootY - 8.5} q${(d * -2.5).toFixed(1)} 1.8 ${(d * -6).toFixed(1)} 2" stroke="@corpsO" stroke-width="0.7" fill="none" opacity="0.6"/>` + // segments du bulbe
    // telson : grande faucille cornée recourbée AU-DESSUS du bulbe, pointe piquant vers l'avant-bas
    `<path d="M${x(28.5)} ${rootY - 12.5} C${x(27)} ${rootY - 19} ${x(21)} ${rootY - 22} ${x(15.5)} ${rootY - 19.5} C${x(13.5)} ${rootY - 18.5} ${x(12.5)} ${rootY - 16.5} ${x(12.5)} ${rootY - 14.5} Q${x(15.5)} ${rootY - 17} ${x(18.5)} ${rootY - 17.5} C${x(22.5)} ${rootY - 18} ${x(24.5)} ${rootY - 15.5} ${x(24)} ${rootY - 11.5} Z" fill="@cuir" stroke="#1a140e" stroke-width="0.7"/>` +
    `<path d="M${x(14.5)} ${rootY - 19.8} Q${x(13)} ${rootY - 17.5} ${x(12.5)} ${rootY - 14.5} L${x(15.5)} ${rootY - 16.8} Q${x(15)} ${rootY - 18.6} ${x(14.5)} ${rootY - 19.8} Z" fill="#1a140e"/>` + // pointe sombre du dard
    `</g>`;
}

// Dorsale d'épines le long d'une ligne (petits triangles sombres).
function ridge(pts: [number, number][]): string {
  const tris = pts.map(([x, y]) => `M${x.toFixed(1)} ${y.toFixed(1)} L${(x + 2.4).toFixed(1)} ${(y - 5.5).toFixed(1)} L${(x + 4.8).toFixed(1)} ${y.toFixed(1)}`).join(' ');
  return `<path d="${tris}" fill="@corpsO" stroke="#1a140e" stroke-width="0.35"/>`;
}

// Ocelles (anneaux clairs à cœur sombre de l'artwork).
function ocelli(spots: [number, number, number][]): string {
  return spots.map(([x, y, r]) =>
    `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="@corpsH" opacity="0.5"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(r * 0.45).toFixed(1)}" fill="@corpsO" opacity="0.7"/>`).join('');
}

function bodyProfile(g: number): string {
  const hl = 16 + 8 * g, vh = 10 + 5 * g, gy = vh + 14;
  const leg = (x: number, far: boolean, haunch: boolean) =>
    `<g transform="translate(${x.toFixed(1)},0)"${far ? ' opacity="0.8"' : ''}>` +
    (haunch ? `<ellipse cx="0" cy="${(vh * 0.15).toFixed(1)}" rx="${(7 + 2 * g).toFixed(1)}" ry="${(7 + 3 * g).toFixed(1)}" fill="${far ? '@corpsO' : '@corps'}" stroke="@corpsO" stroke-width="0.7"/>` : '') +
    `<path d="M-5 ${(vh * 0.2).toFixed(1)} Q-7 ${(vh * 0.7).toFixed(1)} -4 ${gy - 4} L-4 ${gy} L4 ${gy} Q5 ${(vh * 0.8).toFixed(1)} 5 ${(vh * 0.2).toFixed(1)} Z" fill="${far ? '@corpsO' : '@corps'}" stroke="@corpsO" stroke-width="0.7"/>` +
    claws(gy) + `</g>`;
  const torso = `<path d="M${-hl} -2 Q${(-hl * 0.9).toFixed(1)} ${-vh} ${(-hl * 0.3).toFixed(1)} ${(-vh - 1).toFixed(1)} Q${(hl * 0.3).toFixed(1)} ${(-vh - 2).toFixed(1)} ${(hl * 0.8).toFixed(1)} ${(-vh * 0.55).toFixed(1)} Q${hl} ${(-vh * 0.2).toFixed(1)} ${(hl * 0.95).toFixed(1)} ${(vh * 0.35).toFixed(1)} Q${(hl * 0.6).toFixed(1)} ${vh} 0 ${vh} Q${(-hl * 0.7).toFixed(1)} ${vh} ${-hl} ${(vh * 0.3).toFixed(1)} Z" fill="@corps" stroke="@corpsO" stroke-width="0.8"/>` +
    `<path d="M${(-hl * 0.8).toFixed(1)} ${(vh * 0.75).toFixed(1)} Q0 ${(vh + 1).toFixed(1)} ${(hl * 0.7).toFixed(1)} ${(vh * 0.55).toFixed(1)}" stroke="@corpsO" stroke-width="2" fill="none" opacity="0.35"/>` + // ombre de ventre
    `<path d="M${(-hl * 0.35).toFixed(1)} ${(-vh * 0.65).toFixed(1)} Q${(hl * 0.25).toFixed(1)} ${(-vh * 0.8).toFixed(1)} ${(hl * 0.6).toFixed(1)} ${(-vh * 0.3).toFixed(1)}" stroke="@corpsH" stroke-width="2.4" fill="none" opacity="0.3"/>`; // reflet d'échine
  const spikes = ridge([[-hl * 0.75, -vh * 0.82], [-hl * 0.5, -vh * 0.96], [-hl * 0.25, -vh - 0.5], [0, -vh - 1], [hl * 0.25, -vh * 0.9], [hl * 0.5, -vh * 0.72]]);
  const spots = ocelli([[-hl * 0.45, -vh * 0.25, 2.8], [-hl * 0.1, vh * 0.25, 2.4], [hl * 0.3, -vh * 0.1, 2.6], [-hl * 0.7, vh * 0.1, 1.9]]);
  const warts = `<circle cx="${(hl * 0.55).toFixed(1)}" cy="${(vh * 0.5).toFixed(1)}" r="1.3" fill="@corpsO" opacity="0.5"/><circle cx="${(-hl * 0.25).toFixed(1)}" cy="${(-vh * 0.55).toFixed(1)}" r="1.1" fill="@corpsO" opacity="0.5"/>`;
  return `<g>${tailSting(-hl + 6, 0, -1)}${leg(-hl * 0.45, true, true)}${leg(hl * 0.5, true, false)}${torso}${spikes}${spots}${warts}${leg(-hl * 0.3, false, true)}${leg(hl * 0.66, false, false)}</g>`;
}

function bodyFrontBack(g: number, back: boolean): string {
  const w = 13 + 9 * g, vh = 10 + 5 * g, gy = vh + 14;
  const leg = (x: number) =>
    `<g transform="translate(${x.toFixed(1)},0)">` +
    `<path d="M-5 ${(vh * 0.15).toFixed(1)} Q-6 ${(vh * 0.7).toFixed(1)} -4 ${gy - 4} L-4 ${gy} L4 ${gy} Q6 ${(vh * 0.7).toFixed(1)} 5 ${(vh * 0.15).toFixed(1)} Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
    claws(gy) + `</g>`;
  const haunches = `<ellipse cx="${(-w * 0.85).toFixed(1)}" cy="${(vh * 0.45).toFixed(1)}" rx="7.5" ry="9" fill="@corpsO" stroke="@corpsO" stroke-width="0.6" opacity="0.9"/>` +
    `<ellipse cx="${(w * 0.85).toFixed(1)}" cy="${(vh * 0.45).toFixed(1)}" rx="7.5" ry="9" fill="@corpsO" stroke="@corpsO" stroke-width="0.6" opacity="0.9"/>`;
  const torso = `<path d="M${-w} ${(-vh * 0.35).toFixed(1)} Q${-w} ${-vh} ${(-w * 0.45).toFixed(1)} ${(-vh - 3).toFixed(1)} Q0 ${(-vh - 5).toFixed(1)} ${(w * 0.45).toFixed(1)} ${(-vh - 3).toFixed(1)} Q${w} ${-vh} ${w} ${(-vh * 0.35).toFixed(1)} Q${(w * 0.95).toFixed(1)} ${(vh * 0.5).toFixed(1)} ${(w * 0.6).toFixed(1)} ${(vh - 2).toFixed(1)} Q0 ${(vh + 3).toFixed(1)} ${(-w * 0.6).toFixed(1)} ${(vh - 2).toFixed(1)} Q${(-w * 0.95).toFixed(1)} ${(vh * 0.5).toFixed(1)} ${-w} ${(-vh * 0.35).toFixed(1)} Z" fill="@corps" stroke="@corpsO" stroke-width="0.8"/>` +
    `<path d="M${(-w * 0.3).toFixed(1)} ${(-vh - 3.5).toFixed(1)} Q0 ${(-vh - 5).toFixed(1)} ${(w * 0.3).toFixed(1)} ${(-vh - 3.5).toFixed(1)} L${(w * 0.24).toFixed(1)} ${(vh * 0.7).toFixed(1)} Q0 ${(vh * 0.9).toFixed(1)} ${(-w * 0.24).toFixed(1)} ${(vh * 0.7).toFixed(1)} Z" fill="@corpsH" opacity="0.28"/>`;
  // épaules hérissées (face) / colonne d'épines centrale (dos)
  const spikes = back
    ? ridge([[-2.4, -vh - 4], [-2.4, -vh * 0.55], [-2.4, vh * 0.05]]) +
      `<path d="M0 ${(-vh - 4).toFixed(1)} L0 ${(vh * 0.6).toFixed(1)}" stroke="@corpsO" stroke-width="1" opacity="0.45"/>`
    : ridge([[-w * 0.62, -vh * 0.82], [-w * 0.36, -vh - 1.5], [w * 0.26, -vh - 1.5], [w * 0.52, -vh * 0.82]]);
  const spots = back ? '' : ocelli([[-w * 0.55, -vh * 0.2, 2.6], [w * 0.5, 0, 2.4], [-w * 0.15, vh * 0.35, 2.2]]);
  return `<g>${tailSting(w * 0.5, vh * 0.4, 1)}${haunches}${leg(-w * 0.55)}${leg(w * 0.55)}${torso}${spikes}${spots}</g>`;
}

function body(p: JabberProps, view: View): string {
  if (view === 'profile') return bodyProfile(p.girth);
  return bodyFrontBack(p.girth, view === 'back');
}

function wing(far: boolean, view: View): string {
  // GRANDE aile membraneuse de dragon (bras + 3 doigts, membrane festonnée) — l'éventail de
  // l'artwork. Profil : les deux balayées vers l'arrière ; face/dos : déployées en miroir.
  const op = far ? 0.7 : 0.95;
  const sx = view === 'profile' ? -1 : far ? -1 : 1;
  const tilt = view === 'profile' ? (far ? -14 : -26) : -12; // profil : éventail DRESSÉ vers le haut-arrière
  return `<g opacity="${op}" transform="scale(${sx},1) rotate(${tilt})">` +
    `<path d="M2 2 C8 -6 14 -18 20 -24 L40 -30 C43 -25 44 -20 44 -16 Q38 -13 40 -4 Q30 1 24 2 Q12 6 2 2 Z" fill="@voilure" stroke="@voilureO" stroke-width="0.7"/>` +
    `<path d="M20 -24 L40 -30 M20 -24 L44 -16 M20 -24 L40 -4" stroke="@voilureO" stroke-width="0.8" fill="none" opacity="0.8"/>` + // doigts
    `<path d="M2 2 Q6 -6 9 -13 Q15 -20 20 -24" stroke="@corps" stroke-width="2.6" fill="none" stroke-linecap="round"/>` + // bras
    `<path d="M2 2 Q6 -6 9 -13 Q15 -20 20 -24" stroke="@corpsO" stroke-width="0.9" fill="none" opacity="0.6"/>` +
    `<path d="M20 -24 Q19 -27 21 -29 L23 -26 Z" fill="@cuir" stroke="#1a140e" stroke-width="0.4"/>` + // griffe d'aile
    `</g>`;
}

function neck(view: View): string {
  if (view === 'profile')
    return `<g><path d="M-7 6 Q-9 -6 -3 -13 Q0 -16 4 -16 L10 -14 Q11 -4 7 6 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
      // crinière hirsute sur la nuque (la collerette rousse de l'artwork)
      `<path d="M-6 2 L-12 -1 L-7 -4 L-13 -8 L-7 -9 L-11 -14 L-4 -13 L-6 -18 L0 -15 L1 -19 L4 -15 L2 -11 L-2 -6 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.45"/></g>`;
  return `<g><path d="M-10 1 L-14 -4 L-10 -6 L-13 -11 L-8 -10 L-8 -15 L-4 -12 L0 -17 L4 -12 L8 -15 L8 -10 L13 -11 L10 -6 L14 -4 L10 1 Q0 6 -10 1 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.45"/>` +
    `<path d="M-6 3 Q-7 -8 0 -12 Q7 -8 6 3 Q0 6 -6 3 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/></g>`;
}

function head(p: JabberProps, view: View): string {
  const antlers = p.antlers
    ? `<path d="M-5 -6 q-5 -8 -4 -16 q3 4 3 8 q2 -3 1 -7 M5 -6 q5 -8 4 -16 q-3 4 -3 8 q-2 -3 -1 -7" fill="none" stroke="@cuir" stroke-width="1.6" stroke-linecap="round"/>`
    : '';
  // grandes cornes recourbées balayées sur les côtés (le trait corné de l'artwork) — croissants
  // EFFILÉS qui partent à l'horizontale puis remontent en pointe (pas des oreilles rondes)
  const hornsFB = `<path d="M-5 -5.5 Q-12 -5 -16.5 -9 Q-20 -12.5 -19.5 -17 Q-16 -13.5 -12.5 -11.5 Q-8.5 -9.5 -4.5 -8.5 Z M5 -5.5 Q12 -5 16.5 -9 Q20 -12.5 19.5 -17 Q16 -13.5 12.5 -11.5 Q8.5 -9.5 4.5 -8.5 Z" fill="@cuir" stroke="#1a140e" stroke-width="0.5"/>` +
    `<path d="M-11 -9.5 q1 1.2 0.8 2.4 M-14.5 -11.5 q1 1.2 0.8 2.4 M11 -9.5 q-1 1.2 -0.8 2.4 M14.5 -11.5 q-1 1.2 -0.8 2.4" stroke="#1a140e" stroke-width="0.4" opacity="0.6"/>`;
  if (view === 'back') return `<g>${hornsFB}${antlers}<ellipse cx="0" cy="-1" rx="8.5" ry="7.5" fill="@corpsO" stroke="#1a140e" stroke-width="0.5"/></g>`;
  const t = p.tongue;
  if (view === 'profile') {
    const horns = `<path d="M-3 -7 Q-10 -9.5 -13.5 -15.5 Q-15.5 -19.5 -13.5 -23 Q-12 -18 -8 -14.5 Q-4.5 -11.5 0 -9.5 Z" fill="@cuir" opacity="0.7" stroke="#1a140e" stroke-width="0.45"/>` + // corne lointaine
      `<path d="M0 -6 Q-7.5 -7.5 -12 -12.5 Q-15.5 -16.5 -14.5 -21.5 Q-11.5 -16.5 -7.5 -13.5 Q-3.5 -10.5 2 -8.5 Z" fill="@cuir" stroke="#1a140e" stroke-width="0.5"/>` + // corne proche : croissant effilé balayé arrière-haut
      `<path d="M-7 -10.5 q1 1.1 0.8 2.2 M-10.5 -13.5 q1 1.1 0.8 2.2" stroke="#1a140e" stroke-width="0.4" opacity="0.6"/>`;
    const tongueP = `<path d="M10 8 Q${(12 + 6 * t).toFixed(1)} ${(10 + 6 * t).toFixed(1)} ${(10 + 7 * t).toFixed(1)} ${(12 + 10 * t).toFixed(1)} Q${(8 + 7 * t).toFixed(1)} ${(14 + 11 * t).toFixed(1)} ${(10 + 8 * t).toFixed(1)} ${(15 + 12 * t).toFixed(1)}" fill="none" stroke="#c0303a" stroke-width="2.2" stroke-linecap="round"/>` +
      `<path d="M${(10 + 8 * t).toFixed(1)} ${(15 + 12 * t).toFixed(1)} l2.2 1.4 M${(10 + 8 * t).toFixed(1)} ${(15 + 12 * t).toFixed(1)} l-0.4 2.6" stroke="#c0303a" stroke-width="1.1" stroke-linecap="round"/>`; // fourche barbelée
    return `<g>${horns}${antlers}` +
      `<ellipse cx="1" cy="-1" rx="9.5" ry="7" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
      `<path d="M4 -1 Q12 -0.5 16 2 Q11 3.5 5 3 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` + // mâchoire sup
      `<path d="M4 2 Q11 3.5 15.5 2.5 Q14 9 8 11 Q4 8 3.5 4 Z" fill="#4a100c"/>` + // gueule béante
      `<path d="M3 5 Q6 11 12 13 Q7 14 3 12 Q0.5 8 1.5 5 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` + // mâchoire inf décrochée
      `<path d="M4.5 2.4 l0.8 2.4 l1.1 -2.1 M6.8 2.7 l0.9 2.8 l1.3 -2.5 M9.5 2.9 l0.9 2.7 l1.3 -2.3 M12.2 3 l0.8 2.4 l1.2 -2.1 M4.6 10 l0.7 -2.4 l1.1 2.2 M6.8 11.2 l0.8 -2.6 l1.2 2.3 M9.4 12.2 l0.8 -2.6 l1.2 2.3" stroke="#efe6cf" stroke-width="0.8" fill="none"/>` + // crocs hérissés haut + bas
      `<path d="M10.5 12.4 Q13.8 10.6 14.3 6.4 Q12.2 8.6 10 9.6 Z M5.8 11.2 Q8.6 9.2 8.9 5.6 Q7 7.6 5 8.5 Z M15.2 2.2 Q17.8 4.4 17.2 7.6 Q15.6 5.4 14 4 Z" fill="@cuir" stroke="#1a140e" stroke-width="0.45"/>` + // défenses cornées de la gueule
      tongueP +
      `<ellipse cx="3.4" cy="-3.2" rx="1.6" ry="1.7" fill="#f2e84a"/><ellipse cx="3.6" cy="-3.1" rx="0.5" ry="1.3" fill="#0a0603"/>` + // petit œil enfoncé sous l'arcade (pas de cyclope)
      `<path d="M0.6 -5.2 Q3.4 -6.8 6.2 -4.6" stroke="@corpsO" stroke-width="1.4" fill="none"/></g>`;
  }
  const eyes = `<ellipse cx="-3.5" cy="-4" rx="2.4" ry="2.6" fill="#f2e84a"/><ellipse cx="-3.5" cy="-3.8" rx="0.7" ry="2" fill="#0a0603"/>` +
    `<ellipse cx="3.5" cy="-4" rx="2.4" ry="2.6" fill="#f2e84a"/><ellipse cx="3.5" cy="-3.8" rx="0.7" ry="2" fill="#0a0603"/>` +
    `<path d="M-6.2 -6.4 Q-3.5 -8 -0.8 -6.2 M0.8 -6.2 Q3.5 -8 6.2 -6.4" stroke="@corpsO" stroke-width="1.1" fill="none"/>`; // arcades lourdes
  const tongue = `<path d="M0 10 Q${(3 + 5 * t).toFixed(1)} ${(12 + 7 * t).toFixed(1)} ${(1 + 6 * t).toFixed(1)} ${(14 + 11 * t).toFixed(1)} Q${(6 * t - 2).toFixed(1)} ${(16 + 12 * t).toFixed(1)} ${(6 * t + 1).toFixed(1)} ${(18 + 13 * t).toFixed(1)}" fill="none" stroke="#c0303a" stroke-width="2.2" stroke-linecap="round"/>` +
    `<path d="M${(6 * t + 1).toFixed(1)} ${(18 + 13 * t).toFixed(1)} l2.2 1.2 M${(6 * t + 1).toFixed(1)} ${(18 + 13 * t).toFixed(1)} l-0.6 2.4" stroke="#c0303a" stroke-width="1.1" stroke-linecap="round"/>`;
  return `<g>${hornsFB}${antlers}` +
    `<ellipse cx="0" cy="-1" rx="9" ry="8" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
    `<path d="M-6.5 2 Q0 4 6.5 2 Q6 10 0 12 Q-6 10 -6.5 2 Z" fill="#4a100c" stroke="@corpsO" stroke-width="0.5"/>` + // gueule béante
    `<path d="M-4.5 3.4 l0.8 2.6 l1.1 -2.3 M-1.5 4 l0.8 2.6 l1.1 -2.3 M1.5 4 l0.8 2.6 l1.1 -2.3 M4 3.4 l0.7 2.4 l1 -2.1 M-3 10.4 l0.7 -2.4 l1 2.1 M2 10.4 l0.7 -2.4 l1 2.1" stroke="#efe6cf" stroke-width="0.8" fill="none"/>` + // crocs haut + bas
    `<path d="M-6.2 4.5 Q-9.4 3 -10 -0.8 Q-7.8 1.2 -5.6 2 Z M6.2 4.5 Q9.4 3 10 -0.8 Q7.8 1.2 5.6 2 Z M-4 11 Q-5.8 9 -5.6 6 Q-4.4 7.8 -3 8.6 Z M4 11 Q5.8 9 5.6 6 Q4.4 7.8 3 8.6 Z" fill="@cuir" stroke="#1a140e" stroke-width="0.45"/>` + // défenses cornées aux commissures
    `${tongue}${eyes}</g>`;
}

// --- poses (DELTA additif) ------------------------------------------------
export const JABBER_REST: Record<string, number> = {};
const buzz = (phase: number, amp: number) => Math.sin(phase * Math.PI * 2 * 7) * amp; // ~7 battements/cycle
/** Battement d'ailes + ondulation du cou au repos. phase ∈ [0,1). */
export function jabberHover(phase: number): Record<string, number> {
  const b = buzz(phase, 18);
  return { aileD: -b, aileG: b, cou: Math.sin(phase * Math.PI * 2) * 5, tete: -Math.sin(phase * Math.PI * 2) * 3 };
}
/** Bond + battement ample. phase ∈ [0,1). */
export function jabberDart(phase: number): Record<string, number> {
  const b = buzz(phase, 30);
  return { aileD: -b, aileG: b, corps: Math.sin(phase * Math.PI * 2) * 6 };
}
/** Fouet : le cou et la tête (langue) se projettent en avant. phase ∈ [0,1]. */
export function jabberWhip(phase: number): Record<string, number> {
  const k = Math.sin(Math.min(1, phase) * Math.PI);
  return { cou: k * 30, tete: k * 26, aileD: -buzz(phase, 22), aileG: buzz(phase, 22) };
}
/** Mort : effondrement (corps penché, cou tombé, ailes affaissées). */
export const JABBER_DEATH: Record<string, number> = { corps: 20, cou: 60, tete: 30, aileD: 40, aileG: -40 };

export function resolveJabberFromProps(
  p: JabberProps,
  view: View = 'front',
  pose: BonePose = {},
  colors?: Palette,
): ResolvedBone[] {
  const sk = buildSkeleton();
  const world = worldTransformsG(sk, pose) as Record<JabberBoneId, Matrix>;
  const tmap = buildTokenMap([p.palette], colors ?? {});
  const art: Record<JabberBoneId, string> = { corps: body(p, view), aileG: wing(true, view), aileD: wing(false, view), cou: neck(view), tete: head(p, view) };
  return sortByZ((Object.keys(sk) as JabberBoneId[])
    .map((id) => ({
      id, matrix: world[id], scale: [1, 1] as [number, number], z: sk[id].z,
      parts: [{ svg: applyTokenMap(art[id], tmap), layer: 0 }],
    })));
}

export const JABBER_DEFAULT: JabberProps = {
  sl: 1.15, girth: 1.0, antlers: false, tongue: 1,
  palette: { corps: '#c8682a', corpsO: '#8a4216', corpsH: '#e89a52', cheveux: '#6a3210', cheveuxO: '#3a1c08', cuir: '#caa23a' },
};

export function resolveJabber(species: string, view: View = 'front', pose: BonePose = {}, colors?: Palette): ResolvedBone[] {
  return resolveJabberFromProps(JABBER_SPECIES[species] ?? JABBER_DEFAULT, view, pose, colors);
}

export const jabberslythePlan: BodyPlan = {
  id: 'jabberslythe',
  resolve: (sp, view, pose, opts) => resolveJabber(sp, view, pose, opts?.colors),
  speciesNames: () => Object.keys(JABBER_SPECIES),
  restPose: () => JABBER_REST,
  idlePose: jabberHover, // ailes battues en continu
  walkPose: jabberDart,
  attackPose: jabberWhip,
  deathPose: () => JABBER_DEATH,
  hasView: () => true,
};

export function jabberSvg(p: JabberProps, view: View, opts: { dead?: boolean; phase?: number; colors?: Palette } = {}): string {
  const pose = opts.dead ? JABBER_DEATH : opts.phase != null ? jabberHover(opts.phase) : {};
  return bonesToSvg(resolveJabberFromProps(p, view, pose, opts.colors));
}
