/**
 * Parts du gabarit QUADRUPÈDE — repère LOCAL de chaque os, tokenisées (@corps/@corpsO/@corpsH
 * = robe/pelage ; @cheveux = crinière/queue ; @cuir = sabot/coussinet). Trois vues dédiées
 * (profile = côté droit ; front = face, tête à 2 yeux ; back = croupe + queue). Cible de
 * silhouette : les sprites monolithiques officiels (Loup/Chien/Ours/Rat géant/Sanglier).
 */
import type { View } from '../facing';
import type { QuadBoneId, QuadProps, QuadFoot, QuadDecoFragment, QuadDecoValue } from './quadSkeleton';
import { scalesPatch } from '../parts/textures';
import { quadHeadBone, quadHeadDef } from './heads';
import { quadManeDef } from './manes';
import { quadArt } from './partArt';
import { QUAD_Z } from './quadZ';
import { quadTailDef } from './tails';

// ============================ helpers ============================
// Segment CONIQUE (membre qui s'effile : cuisse→genou, canon→boulet) — la capsule droite à
// épaisseur constante lisait « pied de table ». Le contour ne démarre qu'à 30 % de la hauteur :
// le HAUT du membre (recouvert par/fondu dans le corps) n'imprime AUCUNE couture sur la robe.
const taper = (len: number, thTop: number, thBot: number, fill: string, line = '@corpsO'): string => {
  const r1 = thTop / 2, r2 = thBot / 2;
  const e = (t: number) => (r1 + (r2 * 0.92 - r1) * t).toFixed(2); // bord à la fraction t
  const y0 = (len * 0.3).toFixed(1);
  return `<path d="M${-r1} 0 Q${-r1} ${-r1 * 0.6} 0 ${-r1 * 0.6} Q${r1} ${-r1 * 0.6} ${r1} 0 L${r2 * 0.92} ${len} Q0 ${len + r2 * 0.7} ${-r2 * 0.92} ${len} Z" fill="${fill}"/>` +
    `<path d="M${-e(0.3)} ${y0} L${-r2 * 0.92} ${len} Q0 ${len + r2 * 0.7} ${r2 * 0.92} ${len} L${e(0.3)} ${y0}" fill="none" stroke="${line}" stroke-width="0.5"/>`;
};
function hoof(foot: QuadFoot, far: boolean, leather = '@cuir'): string {
  const c = far ? `${leather}O` : leather;
  const body = far ? '@corpsO' : '@corps';
  if (foot === 'sabot') // sabot net : bloc trapézoïdal compact (PAS une « botte ») + pince + couronne claire
    return `<path d="M-2.8 -1 Q-3 4 -3.4 7 Q0 9.4 3.4 7 Q3 4 2.8 -1 Q0 -2 -2.8 -1 Z" fill="${c}" stroke="#0e0b07" stroke-width="0.5"/>` +
      `<path d="M-2.9 -0.6 Q0 -2 2.9 -0.6 L2.6 1 Q0 -0.2 -2.6 1 Z" fill="@corpsH" opacity="0.3"/>` + // couronne claire (raccord poil/corne)
      `<path d="M0 1 L0 7.5" stroke="#0e0b07" stroke-width="0.4" opacity="0.5"/>`;
  if (foot === 'serre') // serre : tarse + 3 DOIGTS PLEINS posés au sol, griffes courbes — plus le râteau filaire
    return `<g><path d="M-2.8 -3 L2.8 -3 Q3.2 2 2 4 L-2 4 Q-3.2 2 -2.8 -3 Z" fill="${c}" stroke="#0e0b07" stroke-width="0.5"/>` +
      `<path d="M-2 3 Q-5.5 4 -7 8.5 Q-6.6 10 -5 9.8 Q-3 8 -1 5 Z" fill="${c}" stroke="#0e0b07" stroke-width="0.5"/>` +
      `<path d="M-1 4 Q-1.4 7 -1 9.6 Q0.4 10.6 1.6 9.6 Q2 6.5 1.4 4 Z" fill="${c}" stroke="#0e0b07" stroke-width="0.5"/>` +
      `<path d="M2 3 Q5.5 4.6 6.6 8.8 Q6 10.2 4.6 9.8 Q3 7.6 1.6 5 Z" fill="${c}" stroke="#0e0b07" stroke-width="0.5"/>` +
      `<path d="M-7 8.5 q-2 0.8 -2.4 2.8 M0.3 9.9 q0 2 -0.3 3 M6.6 8.8 q2 0.8 2.4 2.8" stroke="#0e0b07" stroke-width="1.5" fill="none" stroke-linecap="round"/></g>`;
  // patte : extrémité du MEMBRE (couleur du corps, plus le godet sombre), doigts ronds + griffes
  return `<g><path d="M-4 -3 Q-5 5 -3 8.5 Q0 10.5 3.4 8.8 Q5.6 5 4.6 -3 Z" fill="${body}" stroke="@corpsO" stroke-width="0.5"/>` +
    `<path d="M-3.4 8 Q-2.4 10.4 -1 10.6 Q0 9 -0.6 7.4 Z M-0.2 8.2 Q0.8 10.8 2.2 10.6 Q3 9 2.2 7.4 Z M2.8 7.6 Q4 9.8 5 9.2 Q5.4 7.6 4.4 6.4 Z" fill="${c}" stroke="#0e0b07" stroke-width="0.4"/>` +
    `<path d="M-1 10.6 l-0.3 2.6 M2.2 10.6 l0.2 2.6 M5 9.2 l0.8 2.2" stroke="#15110c" stroke-width="1.3" stroke-linecap="round"/></g>`;
}
function footFront(foot: QuadFoot, far: boolean, leather = '@cuir'): string {
  const c = far ? `${leather}O` : leather;
  const body = far ? '@corpsO' : '@corps';
  if (foot === 'sabot') return `<ellipse cx="0" cy="3" rx="3.4" ry="3" fill="${c}" stroke="#0e0b07" stroke-width="0.5"/>`;
  if (foot === 'serre') // 3 doigts pleins écartés (pas des fils)
    return `<g><path d="M-0.8 -1 Q-4.4 2.5 -5.2 7.5 Q-4.4 9 -3 8.4 Q-1.6 5 -0.4 2 Z" fill="${c}" stroke="#0e0b07" stroke-width="0.4"/>` +
      `<path d="M-0.8 0 Q-1.2 4 -0.8 8.6 Q0.2 9.6 1.2 8.6 Q1.4 4 1 0 Z" fill="${c}" stroke="#0e0b07" stroke-width="0.4"/>` +
      `<path d="M0.8 -1 Q4.4 2.5 5.2 7.5 Q4.4 9 3 8.4 Q1.6 5 0.4 2 Z" fill="${c}" stroke="#0e0b07" stroke-width="0.4"/>` +
      `<path d="M-5.2 7.5 l-1 2 M0.2 8.9 l0 2.2 M5.2 7.5 l1 2" stroke="#0e0b07" stroke-width="1.1" stroke-linecap="round"/></g>`;
  return `<g><path d="M-3.6 -1 Q-4.2 5 0 6.6 Q4.2 5 3.6 -1 Z" fill="${body}" stroke="@corpsO" stroke-width="0.45"/>` +
    `<ellipse cx="-2" cy="5.8" rx="1.2" ry="1.5" fill="${c}"/><ellipse cx="0.1" cy="6.5" rx="1.2" ry="1.5" fill="${c}"/><ellipse cx="2.2" cy="5.8" rx="1.2" ry="1.5" fill="${c}"/>` +
    `<path d="M-2 7.2 l0 2 M0.1 7.9 l0 2 M2.2 7.2 l0 2" stroke="#15110c" stroke-width="1" stroke-linecap="round"/></g>`;
}
// Articulation (épaule/genou/boulet) : pastille de la couleur du membre qui BOUCHE le trou
// entre deux segments capsulés (défaut « segments empilés avec gaps »).
const joint = (body: string, cy: number, r: number, line = '@corpsO') =>
  `<circle cx="0" cy="${cy.toFixed(1)}" r="${r}" fill="${body}" stroke="${line}" stroke-width="0.3"/>`;

// Morphologie des MEMBRES par carrure (anti « jouet de bois » : pattes-cylindres identiques) :
// masse de cuisse/épaule fondue dans le corps en haut, canon plus fin en bas, jarret marqué.
//   mass = largeur de la masse musculaire haute (demi-épaisseur), taper = épaisseur du canon.
//   sousTronc = en PROFIL, le segment HAUT du membre PROCHE se peint SOUS le barillet (cf.
//   `PLAN_HAUT_SOUS_TRONC` plus bas) : c'est le corps qui descend sur le membre, pas le membre qui
//   se plante devant le flanc. Réservé aux carrures dont le tronc porte ses masses d'attache.
//   jointNu = articulations calées sur l'épaisseur du segment et SANS liseré (cf. `bas` ci-dessous).
const LEG_BUILD: Record<string, { mass: number; haut: number; bas: number; sousTronc?: boolean; jointNu?: boolean }> = {
  equine: { mass: 6.2, haut: 8.5, bas: 5.2 }, // cheval : cuisse pleine, canons FINS
  canine: { mass: 5.2, haut: 7.5, bas: 4.8 }, // loup/chien : svelte, jarret net
  suid: { mass: 5.5, haut: 8, bas: 5.5 }, // sanglier : courtes et fortes
  rodent: { mass: 4.5, haut: 7, bas: 4.5 },
  ursine: { mass: 8.5, haut: 12, bas: 9 }, // ours : poteaux massifs
  // Bovin : POTEAUX, plus épais que l'ursidé. Sous un tonneau de trait, les valeurs de l'ours
  // donnaient des pattes d'antilope (verdict à l'œil). Cette table est lue par les TROIS vues :
  // face et dos s'épaississent d'autant, ce qui est voulu — ce sont les MÊMES pattes.
  bovin: { mass: 11, haut: 15.6, bas: 11.4, sousTronc: true, jointNu: true },
  feline: { mass: 6.8, haut: 9, bas: 5.5 }, // lion : haunches musclées, canon fin
  draconic: { mass: 8, haut: 11, bas: 7.5 },
  batracien: { mass: 7.5, haut: 10, bas: 7 },
};
// Masse musculaire HAUTE (cuisse/épaule) : goutte qui s'effile dans le membre — SANS contour
// (elle FOND dans la robe du corps, sinon elle lit comme une plaque collée), juste une ombre
// interne courbe pour le galbe. Courte (≤ 0.36 du membre) : le canon reste fin dessous.
const muscle = (body: string, m: number, len: number) =>
  `<path d="M${-m} -3 Q${-m - 0.8} ${len * 0.2} ${-m * 0.4} ${len * 0.36} Q0 ${len * 0.46} ${m * 0.4} ${len * 0.36} Q${m + 0.8} ${len * 0.2} ${m} -3 Q0 ${-m * 0.9} ${-m} -3 Z" fill="${body}"/>`;

// Balzane (markings==='balzanes') : « chaussette » claire au bas du canon, au-dessus du sabot.
const balzane = (p: QuadProps, ll: number, w: number, far: boolean): string =>
  p.markings === 'balzanes'
    ? `<path data-marking="balzanes" d="M${-w * 0.46} ${22 * ll - 7} L${w * 0.46} ${22 * ll - 7} L${w * 0.45} ${22 * ll} Q0 ${22 * ll + 3} ${-w * 0.45} ${22 * ll} Z" fill="#e9e4d6" opacity="${far ? 0.55 : 0.9}"/>`
    : '';

// Membre AVANT de rapace (`fore` vrai + foreCoat) : cuisse dans la robe des AILES (@aile —
// l'avant-train rapace porte le même plumage), culotte de plumes retombant sur un canon-TARSE
// écailleux (famille custom @cuirAv) fin, serres de la même famille.
function legParts(p: QuadProps, far: boolean, foot: QuadFoot, fore = false) {
  const ll = p.legLen;
  const plumed = fore && !!p.foreCoat;
  const body = plumed ? (far ? '@aileO' : '@aile') : (far ? '@corpsO' : '@corps');
  const leather = plumed ? '@cuirAv' : '@cuir';
  const L = LEG_BUILD[p.build] ?? LEG_BUILD.equine;
  // canon : plus FIN que la cuisse, s'effile vers le boulet ; jarret/genou bouché à la jointure.
  // ARTICULATIONS NUES (carrures qui le déclarent) : la pastille de jointure est calée sur la
  // DEMI-ÉPAISSEUR du segment et perd son liseré. Au diamètre du socle (12,1 u pour un canon de
  // 10,8) et cerclée de son trait, elle dépassait du membre en DÔME — au zoom, une rotule de
  // poupée articulée posée sur le genou (constat au gros plan des pattes). Elle doit BOUCHER le
  // trou entre deux segments, pas s'annoncer.
  const nu = LEG_BUILD[p.build]?.jointNu === true;
  const jHaut = nu ? (L.bas + 0.6) / 2 : (L.bas + 1.4) * 0.52;
  const jBas = nu ? L.bas * 0.36 : L.bas * 0.4;
  const bas = plumed
    ? joint(body, 0, (L.bas + 1.4) * 0.52, '@aileO') + taper(22 * ll, L.bas + 0.2, L.bas * 0.72, leather, '@cuirAvO') +
      scalesPatch(-L.bas * 0.34, L.bas * 0.34, 7, 22 * ll - 2, 2.4, 'cuirAv') +
      // culotte de plumes sur le haut du tarse (pointes dentelées)
      `<path d="M${(-(L.bas / 2 + 1.8)).toFixed(1)} -1.5 q-0.8 4.6 0.4 7.2 l1.9 -3.6 l1 4.2 l2 -3.8 l1.3 4 l1.9 -3.4 q1.3 -2.8 0.7 -5 Q0 ${(-L.bas * 0.5).toFixed(1)} ${(-(L.bas / 2 + 1.8)).toFixed(1)} -1.5 Z" fill="${body}" stroke="@aileO" stroke-width="0.4"/>` +
      joint(leather, 22 * ll, L.bas * 0.38, '@cuirAvO')
    : joint(body, 0, jHaut, nu ? 'none' : '@corpsO') + taper(22 * ll, L.bas + 0.6, L.bas * 0.78, body) + joint(body, 22 * ll, jBas, nu ? 'none' : '@corpsO') + balzane(p, ll, L.bas + 0.6, far);
  return {
    haut: muscle(body, L.mass, 30 * ll) + taper(30 * ll, L.haut, L.bas + 1.4, body, plumed ? '@aileO' : '@corpsO'), // cuisse → genou
    bas,
    pied: hoof(foot, far, leather), // sabot À l'os du pied (bas de la jambe) — PAS 22·ll plus bas (sinon détaché)
  };
}
function legPartsFront(p: QuadProps, far: boolean, foot: QuadFoot, fore = false) {
  const ll = p.legLen;
  const plumed = fore && !!p.foreCoat;
  const body = plumed ? (far ? '@aileO' : '@aile') : (far ? '@corpsO' : '@corps');
  const leather = plumed ? '@cuirAv' : '@cuir';
  const L = LEG_BUILD[p.build] ?? LEG_BUILD.equine;
  const k = far ? 0.84 : 1;
  // Membre FRONTAL = colonne d'aplomb, plus PLEINE qu'en profil (le canon ne s'effile presque
  // pas, sinon « patte d'insecte »). Cuisse haute fondue dans le corps, canon trapu jusqu'au pied.
  const shin = plumed ? leather : body;
  const lineB = plumed ? '@cuirAvO' : '@corpsO';
  return {
    haut: muscle(body, L.mass * 0.5 * k, 26 * ll) + taper(30 * ll, L.haut * 0.95 * k, (L.bas + 1.8) * k, body, plumed ? '@aileO' : '@corpsO'),
    bas: joint(body, 0, (L.bas + 1.8) * k * 0.5, plumed ? '@aileO' : '@corpsO') + taper(22 * ll, (L.bas + 1.2) * k, L.bas * 0.95 * k, shin, lineB) +
      (plumed ? scalesPatch(-L.bas * 0.4 * k, L.bas * 0.4 * k, 6, 22 * ll - 2, 2.4, 'cuirAv') : '') +
      joint(shin, 22 * ll, L.bas * 0.46, lineB) + (plumed ? '' : balzane(p, ll, (L.bas + 1.2) * k, far)),
    pied: footFront(foot, far, leather), // pied à l'os (bas de la jambe), pas 22·ll plus bas
  };
}
// ============================ PROFIL ============================
// CORPS ENTIER en UNE SEULE silhouette continue (poitrail → garrot → dos → croupe → cuisse →
// ventre), dessinée dans le tronc : détourer barrique et croupe séparément lit « deux pièces mal
// soudées / croupe-ballon » (retour utilisateur + juges).
// +x = avant. La croupe (os) ne porte plus que pattes arrière/queue ; l'arrière-train vit ici
// (la croupe ne tourne que de quelques degrés en anim — perte négligeable, couture supprimée).
// La profondeur est encore étirée par girth (scale vertical au rendu).
// Canal `bodyHi` (calque clair du haut de la silhouette : pelage en touffes, balafres) : la DEF DE
// TÊTE le déclare, la CARRURE décide où il s'applique — deux cas l'ajoutent à leur `hi` (`ursine`,
// `canine`), les six autres l'ignorent. Une tête qui déclare le canal peint donc sur ces deux
// carrures, quelle que soit l'espèce porteuse. Population au 2026-08-05 : `ours` (ours + blaireau
// en `ursine`, chien en `feline` — non consulté là) et `loup-feroce` (loup, `canine`) ; les couples
// (canal, espèce) non consultés sont un stock gelé nominatif (`heads/quad-heads.test.ts`), et
// qu'aucun canal ne soit de l'art mort y est une garde.
function barrel(p: QuadProps): string {
  const bl = p.bodyLen;
  const X = (n: number) => (n * bl).toFixed(1);
  let path: string, hi: string, lo: string;
  switch (p.build) {
    case 'suid': // bosse d'épaule HAUTE à l'avant, dos qui DÉVALE vers un arrière fin et bas + soies
      path = `M${X(31)} -16 Q${X(34)} -8 ${X(33)} 1 Q${X(31)} 12 ${X(22)} 16 Q${X(4)} 19 ${X(-18)} 16 Q${X(-32)} 17 ${X(-38)} 12 Q${X(-44)} 6 ${X(-43)} -2 Q${X(-42)} -9 ${X(-36)} -11 Q${X(-20)} -14 ${X(-6)} -20 Q${X(4)} -29 ${X(14)} -27 Q${X(26)} -24 ${X(31)} -16 Z`;
      hi = `<path d="M${X(-4)} -23 Q${X(6)} -30 ${X(16)} -26" fill="none" stroke="@cheveux" stroke-width="2.4" opacity="0.85" stroke-linecap="round"/><path d="M${X(-2)} -23 l-1 4 M${X(4)} -26 l-1 4 M${X(10)} -27.5 l0 4 M${X(15)} -26 l1 4" stroke="@cheveux" stroke-width="1" opacity="0.7"/>`;
      lo = `<path d="M${X(-40)} 8 Q${X(-10)} 18 ${X(24)} 13 L${X(26)} 8 Q${X(-8)} 14 ${X(-39)} 4 Z" fill="@corpsO" opacity="0.8"/>`;
      break;
    case 'rodent': // dos ARQUÉ culminant à l'arrière-milieu, avant bas, grosses hanches
      path = `M${X(30)} -6 Q${X(33)} 0 ${X(31)} 6 Q${X(27)} 12 ${X(18)} 13 Q${X(2)} 15 ${X(-16)} 13 Q${X(-32)} 14 ${X(-40)} 9 Q${X(-46)} 3 ${X(-45)} -5 Q${X(-44)} -14 ${X(-34)} -18 Q${X(-18)} -23 ${X(-2)} -20 Q${X(16)} -16 ${X(30)} -6 Z`;
      hi = `<path d="M${X(-34)} -16 Q${X(-14)} -22 ${X(4)} -18 L${X(3)} -14 Q${X(-14)} -18 ${X(-32)} -12 Z" fill="@corpsH" opacity="0.5"/>`;
      lo = `<path d="M${X(-42)} 7 Q${X(-10)} 14 ${X(22)} 10 L${X(24)} 5 Q${X(-8)} 11 ${X(-41)} 3 Z" fill="@corpsO" opacity="0.8"/>`;
      break;
    case 'ursine': // MASSIF : bosse d'épaule, tout en profondeur, arrière rond et lourd
      path = `M${X(30)} -12 Q${X(34)} -4 ${X(33)} 6 Q${X(30)} 17 ${X(20)} 20 Q${X(2)} 24 ${X(-16)} 21 Q${X(-34)} 22 ${X(-42)} 14 Q${X(-48)} 6 ${X(-46)} -4 Q${X(-44)} -14 ${X(-34)} -18 Q${X(-20)} -22 ${X(-6)} -24 Q${X(6)} -28 ${X(16)} -24 Q${X(26)} -20 ${X(30)} -12 Z`;
      hi = `<path d="M${X(-16)} -21 Q${X(2)} -27 ${X(16)} -23 L${X(15)} -18 Q${X(2)} -22 ${X(-15)} -16 Z" fill="@corpsH" opacity="0.55"/>`;
      lo = `<path d="M${X(-42)} 12 Q${X(-8)} 22 ${X(24)} 14 L${X(26)} 8 Q${X(-6)} 18 ${X(-41)} 6 Z" fill="@corpsO" opacity="0.85"/>`;
      hi += quadArt(quadHeadDef(p.head).bodyHi, p); // canal `bodyHi` de la def de tête (cf. en-tête)
      break;
    case 'canine': // loup/chien : garrot haut, DOS qui plonge vers la croupe, poitrail PROFOND
      // descendu au coude, fort RELEVÉ de ventre (flanc creusé) au niveau du rein — silhouette
      // lévrier/lupin, pas un tube. +x = avant.
      path = `M${X(30)} 2 Q${X(33)} -8 ${X(31)} -12 Q${X(28)} -17 ${X(22)} -17 Q${X(4)} -16 ${X(-12)} -14 Q${X(-30)} -12 ${X(-40)} -7 Q${X(-45)} -2 ${X(-43)} 3 Q${X(-40)} 6 ${X(-33)} 6 Q${X(-24)} 6 ${X(-18)} 3 Q${X(-8)} 7 ${X(4)} 11 Q${X(16)} 14 ${X(25)} 13 Q${X(31)} 8 ${X(30)} 2 Z`;
      hi = `<path d="M${X(-28)} -13 Q${X(-4)} -16 ${X(18)} -16 L${X(17)} -12 Q${X(-4)} -13 ${X(-27)} -9 Z" fill="@corpsH" opacity="0.5"/>`;
      lo = `<path d="M${X(-33)} 5 Q${X(-22)} 5 ${X(-16)} 2.5 Q${X(-6)} 6 ${X(6)} 10 Q${X(18)} 13 ${X(24)} 11 L${X(22)} 7 Q${X(14)} 9 ${X(4)} 6 Q${X(-8)} 3 ${X(-18)} 0 Q${X(-26)} 1.5 ${X(-32)} 1 Z" fill="@corpsO" opacity="0.7"/>`;
      hi += quadArt(quadHeadDef(p.head).bodyHi, p); // canal `bodyHi` de la def de tête (cf. en-tête)
      break;
    case 'feline': // poitrail profond + TAILLE creusée + haunches arrière rondes et musclées
      path = `M${X(30)} -15 Q${X(34)} -8 ${X(33)} 0 Q${X(31)} 8 ${X(23)} 10 Q${X(10)} 11 ${X(0)} 8 Q${X(-12)} 5 ${X(-22)} 8 Q${X(-36)} 12 ${X(-43)} 6 Q${X(-48)} -1 ${X(-45)} -9 Q${X(-42)} -16 ${X(-32)} -17 Q${X(-16)} -19 ${X(-2)} -20 Q${X(12)} -23 ${X(23)} -20 Q${X(29)} -18 ${X(30)} -15 Z`;
      hi = `<path d="M${X(-28)} -15 Q${X(-4)} -20 ${X(20)} -19 L${X(19)} -15 Q${X(-4)} -16 ${X(-27)} -11 Z" fill="@corpsH" opacity="0.55"/>`;
      lo = `<path d="M${X(-40)} 4 Q${X(-20)} 10 ${X(-2)} 5 Q${X(14)} 8 ${X(25)} 3 L${X(23)} -1 Q${X(12)} 5 ${X(-2)} 2 Q${X(-20)} 7 ${X(-39)} 0 Z" fill="@corpsO" opacity="0.8"/>`;
      break;
    case 'draconic': { // LONG et profond, ventre lourd qui ondule, arrière qui file vers la queue
      path = `M${X(30)} -14 Q${X(35)} -6 ${X(34)} 4 Q${X(32)} 17 ${X(20)} 22 Q${X(2)} 26 ${X(-14)} 22 Q${X(-32)} 24 ${X(-42)} 16 Q${X(-50)} 9 ${X(-48)} -1 Q${X(-46)} -11 ${X(-36)} -15 Q${X(-20)} -19 ${X(-4)} -20 Q${X(12)} -23 ${X(22)} -20 Q${X(28)} -18 ${X(30)} -14 Z`;
      hi = `<path d="M${X(-32)} -14 Q${X(-6)} -20 ${X(20)} -19 L${X(19)} -15 Q${X(-6)} -16 ${X(-31)} -10 Z" fill="@corpsH" opacity="0.5"/>`;
      lo = `<path d="M${X(-44)} 12 Q${X(-8)} 25 ${X(24)} 16 L${X(26)} 9 Q${X(-6)} 20 ${X(-43)} 6 Z" fill="@corpsO" opacity="0.85"/>` +
        // cuir d'écailles imbriquées (textures.ts) sur le flanc — le ventre lourd reste lisse
        scalesPatch(-40 * bl, 26 * bl, -12, 9, 4.6, 'corps');
      break;
    }
    case 'batracien': { // sac TRÈS large, bas et rond (pas de dos défini), dos verruqueux
      path = `M${X(26)} -14 Q${X(33)} -8 ${X(33)} 2 Q${X(32)} 17 ${X(18)} 21 Q${X(0)} 24 ${X(-20)} 21 Q${X(-36)} 18 ${X(-38)} 6 Q${X(-39)} -8 ${X(-28)} -16 Q${X(-12)} -23 ${X(4)} -23 Q${X(18)} -22 ${X(26)} -14 Z`;
      hi = `<path d="M${X(-22)} -16 Q${X(-4)} -22 ${X(14)} -19 L${X(13)} -14 Q${X(-4)} -18 ${X(-21)} -11 Z" fill="@corpsH" opacity="0.5"/>`;
      lo = `<path d="M${X(-34)} 10 Q${X(-4)} 21 ${X(22)} 13 L${X(24)} 6 Q${X(-4)} 17 ${X(-33)} 4 Z" fill="@corpsO" opacity="0.85"/>` +
        `<circle cx="${X(-16)}" cy="-13" r="1.7" fill="@corpsO"/><circle cx="${X(-4)}" cy="-17" r="2" fill="@corpsO"/><circle cx="${X(7)}" cy="-16" r="1.6" fill="@corpsO"/><circle cx="${X(15)}" cy="-12" r="1.5" fill="@corpsO"/><circle cx="${X(-9)}" cy="-8" r="1.3" fill="@corpsO"/><circle cx="${X(2)}" cy="-6" r="1.4" fill="@corpsO"/>`;
      break;
    }
    case 'bovin': { // BÊTE DE TRAIT : masse basse et lourde, garrot BOSSU, croupe HAUTE et charnue
      // Le dos n'est pas une arche (ursine) mais une LIGNE BRISÉE en trois temps — bosse de garrot
      // à l'avant, léger creux de rein au milieu, croupe qui remonte en table à l'arrière. Le
      // poitrail descend au COUDE et le ventre est plein jusqu'aux flancs : la bête est basse sur
      // pattes, jamais un tonneau rond. L'avant du corps RECULE au-dessus du poitrail (encoche
      // d'encolure en x≈+26) — sans ce retrait l'encolure sort du sommet de la masse et la tête se
      // soude au tronc (verdicts « moignon soudé », « capybara à collier »).
      path = `M${X(26)} -21.6 Q${X(23.4)} -29.6 ${X(15)} -30.6 Q${X(7)} -27.6 ${X(0)} -25.8 ` +
        `Q${X(-10)} -25.2 ${X(-20)} -27 Q${X(-30)} -29.2 ${X(-38)} -24 Q${X(-45)} -19 ${X(-46)} -8 ` +
        `Q${X(-46)} 4 ${X(-40)} 12.6 Q${X(-30)} 18.6 ${X(-14)} 20.8 Q${X(2)} 21.8 ${X(14)} 20 ` +
        `Q${X(24)} 17.6 ${X(29)} 9 Q${X(32)} 0 ${X(31)} -10 Q${X(30)} -18 ${X(26)} -21.6 Z`;
      // dessus ÉCLAIRÉ en LENTILLE (pointes fondues aux deux bouts) : il monte sur la bosse de
      // garrot, suit le creux de rein et se relève sur la croupe — la ligne de dos bovine se lit
      // ainsi en gris, sans aucune arête droite.
      hi = `<path d="M${X(-36)} -21.4 Q${X(-24)} -26.4 ${X(-10)} -23.4 Q${X(0)} -22.6 ${X(8)} -24.4 ` +
        `Q${X(15)} -28.4 ${X(23)} -25.4 Q${X(17)} -24 ${X(10)} -21 Q${X(0)} -19 ${X(-10)} -19.6 ` +
        `Q${X(-24)} -22 ${X(-36)} -21.4 Z" fill="@corpsH" opacity="0.68"/>` +
        // seconde passe FEUTRÉE juste dessous : sans elle, le bord bas de la lentille fait une
        // arête nette au milieu du flanc et l'ensemble lit « couverture de bât posée sur le dos ».
        `<path d="M${X(-34)} -18.6 Q${X(-22)} -22.6 ${X(-8)} -20 Q${X(2)} -19.4 ${X(10)} -21.4 ` +
        `Q${X(16)} -24.6 ${X(21.6)} -22.4 Q${X(15)} -21 ${X(8)} -18.4 Q${X(0)} -16.4 ${X(-9)} -16.6 ` +
        `Q${X(-22)} -18.6 ${X(-34)} -18.6 Z" fill="@corpsH" opacity="0.26"/>` +
        // MASSES D'ATTACHE — le cœur de la carrure de trait, et la réponse au verdict « la jonction
        // avec le corps ». Une patte de bovin ne se PLANTE pas sous un tonneau : le corps DESCEND
        // sur elle. Ces deux masses appartiennent au TRONC, débordent sous son contour (≈ 8 u) et
        // enveloppent le haut du membre ; le membre proche, peint au plan 9, en ressort. On lit une
        // continuation, plus un pilotis. Elles sont posées APRÈS la nappe ventrale : ce sont elles
        // qui interrompent l'ombre du ventre à l'aplomb des membres, jamais l'inverse.
        // Épaule (bras + coude), sur l'antérieur (pivot x ≈ +25) :
        // Le trait ne court QUE sur la part de la masse qui fait SILHOUETTE (sous le contour du
        // barillet) : contourner la masse entière posait une ligne de COUTURE en plein flanc, ce
        // que la jonction doit précisément effacer.
        `<path d="M${X(31.6)} -3 Q${X(34)} 8 ${X(32)} 17.4 Q${X(29.4)} 25.6 ${X(23)} 27.4 ` +
        `Q${X(17)} 27 ${X(15.4)} 20.4 Q${X(14.4)} 11 ${X(16.4)} 1 Z" fill="@corps"/>` +
        `<path d="M${X(33.6)} 4.4 Q${X(32.8)} 12.4 ${X(31)} 19.4 Q${X(28.6)} 25.8 ${X(23)} 27.4 ` +
        `Q${X(17)} 27 ${X(15.4)} 20.4" fill="none" stroke="@corpsO" stroke-width="0.7" stroke-linecap="round"/>` +
        `<path d="M${X(30.4)} -1 Q${X(32.6)} 8.4 ${X(30.6)} 17.4 Q${X(28.4)} 23.4 ${X(24.4)} 25.4 ` +
        `Q${X(26)} 18.4 ${X(26.4)} 10.4 Q${X(26.6)} 3.4 ${X(28.4)} -1.4 Z" fill="@corpsH" opacity="0.5"/>` +
        `<path d="M${X(17.4)} 6.4 Q${X(15.8)} 15.4 ${X(17.4)} 23.4 Q${X(20)} 27 ${X(23)} 27.4 ` +
        `Q${X(19.4)} 24.4 ${X(18.8)} 16.4 Q${X(18.4)} 9.4 ${X(19.4)} 4.4 Z" fill="@corpsO" opacity="0.34"/>` +
        // Cuisse CHARNUE, sur le postérieur (pivot x ≈ −35) : le fémur se devine sous la robe.
        `<path d="M${X(-22.6)} -14 Q${X(-16.6)} -2 ${X(-18.6)} 12 Q${X(-21.6)} 24 ${X(-30.6)} 28 ` +
        `Q${X(-39.6)} 27 ${X(-43)} 18.4 Q${X(-45.4)} 7 ${X(-43.4)} -5 Q${X(-39)} -15.4 ${X(-30)} -17.4 Z" fill="@corps"/>` +
        `<path d="M${X(-45.6)} 6 Q${X(-44.6)} 14.4 ${X(-42.4)} 19.4 Q${X(-38.6)} 27 ${X(-30.6)} 28 ` +
        `Q${X(-22)} 24.4 ${X(-19)} 13.4" fill="none" stroke="@corpsO" stroke-width="0.7" stroke-linecap="round"/>` +
        `<path d="M${X(-24.4)} -12 Q${X(-19.6)} -1 ${X(-21)} 11.4 Q${X(-23.4)} 21.4 ${X(-30.4)} 25.4 ` +
        `Q${X(-27)} 18.4 ${X(-25.6)} 9.4 Q${X(-24.6)} -1.6 ${X(-26.4)} -11 Z" fill="@corpsO" opacity="0.3"/>`;
        // La masse de cuisse ne porte PAS sa propre lumière : le rond de la hanche est peint par la
        // DEF de l'espèce, qui seule connaît son éclairage (`Boeuf.ts`, plage de croupe). Empilées,
        // les deux valeurs claires se croisaient sur le même quartier — au gros plan, deux croissants
        // beiges décalés sur la fesse, ce qui barbouille au lieu de tourner.
      // NAPPE ventrale : le tiers bas prend l'ombre du VENTRE — mais elle MEURT avant l'aplomb des
      // membres (x ≈ +25 devant, x ≈ −30 derrière). Menée d'un bord à l'autre, elle tranchait le
      // haut des quatre pattes en une ligne horizontale : la bête devenait un tonneau sur pilotis
      // (verdict utilisateur : « la jonction avec le corps »). Elle s'arrête donc dans l'entre-deux,
      // là où le ventre est vraiment à l'ombre, et les masses d'attache ci-dessous prennent le
      // relais sur les épaules et les cuisses.
      lo = `<path d="M${X(20)} 12.6 Q${X(10)} 18.4 ${X(-2)} 20.4 Q${X(-14)} 20.4 ${X(-24)} 17.4 ` +
        `Q${X(-19)} 13.4 ${X(-6)} 14.6 Q${X(6)} 14.6 ${X(17)} 9.6 Z" fill="@corpsO" opacity="0.8"/>`;
      break;
    }
    default: // equine : poitrail profond, GARROT marqué, dos level, croupe arrondie qui descend en cuisse
      path = `M${X(30)} -15 Q${X(34)} -7 ${X(33)} 2 Q${X(30)} 13 ${X(20)} 16 Q${X(2)} 19 ${X(-16)} 16 Q${X(-32)} 18 ${X(-40)} 12 Q${X(-47)} 5 ${X(-45)} -5 Q${X(-43)} -15 ${X(-32)} -17 Q${X(-14)} -19 ${X(0)} -19 Q${X(12)} -23 ${X(23)} -20 Q${X(29)} -18 ${X(30)} -15 Z`;
      hi = `<path d="M${X(-30)} -15 Q${X(-6)} -18 ${X(20)} -19 L${X(19)} -15 Q${X(-6)} -15 ${X(-29)} -11 Z" fill="@corpsH" opacity="0.6"/>`;
      lo = `<path d="M${X(-40)} 9 Q${X(-6)} 18 ${X(24)} 12 L${X(26)} 6 Q${X(-4)} 14 ${X(-39)} 4 Z" fill="@corpsO" opacity="0.85"/>`;
  }
  // Volumes internes SANS contour : ombre de flanc + creux de cuisse (l'arrière-train se lit
  // par l'ombrage, plus par une bulle détourée).
  const flank = `<ellipse cx="${X(0)}" cy="4" rx="${X(13)}" ry="5.5" fill="@corpsO" opacity="0.22"/>`;
  const thigh = `<path d="M${X(-26)} -8 Q${X(-38)} -4 ${X(-38)} 5 Q${X(-37)} 12 ${X(-29)} 13 Q${X(-22)} 12 ${X(-21)} 3 Q${X(-21)} -5 ${X(-26)} -8 Z" fill="@corpsO" opacity="0.16"/>` +
    `<path d="M${X(-24)} -10 Q${X(-34)} -7 ${X(-36)} 2" fill="none" stroke="@corpsO" stroke-width="0.8" opacity="0.4"/>`;
  return `<g><path d="${path}" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>${lo}${flank}${thigh}${hi}${ridgeArt(p)}${markingsArt(p)}${foreCoatArt(p)}</g>`;
}
// ---- Avant-train EMPLUMÉ (prop `foreCoat`) : manteau de plumes sur garrot/épaule/poitrail dans
// la robe des AILES (@aile — la moitié rapace est d'un seul plumage), bord arrière FESTONNÉ
// (pointes de couvertures), hampes + mouchetures claires @aileH — le contraste mi-aigle /
// mi-cheval de l'hippogriffe (artwork LDB 79 p.323) vit ici, la moitié ARRIÈRE du tronc garde la
// robe @corps. Dessiné PAR-DESSUS la silhouette continue de barrel().
function foreCoatArt(p: QuadProps): string {
  if (!p.foreCoat) return '';
  const bl = p.bodyLen;
  const X = (n: number) => (n * bl).toFixed(1);
  // bord arrière : remonte du brisket (x≈21·bl) au garrot en dents de plumes — chaque dent
  // descend PUIS remonte, x strictement décroissant (un contour simple, jamais croisé :
  // la 1re version en Q non monotones s'auto-croisait et annulait son propre remplissage)
  const edge = Array.from({ length: 6 }, () => `l${X(-1)} 3.4 l${X(-1.8)} -9.3 `).join('');
  const coat = `<path d="M${X(4)} -20 Q${X(18)} -23 ${X(27)} -18.5 Q${X(33.8)} -9 ${X(32.8)} 1 Q${X(30)} 12 ${X(21)} 15.6 ${edge}Z" fill="@aile" stroke="@aileO" stroke-width="0.6"/>`;
  // ombre du bord de poitrail (rondeur) + hampes de plumes + mouchetures claires
  const shade = `<path d="M${X(30)} -12 Q${X(33)} -4 ${X(31.6)} 3 Q${X(29.4)} 11 ${X(21)} 14.4 L${X(20)} 11 Q${X(27.4)} 8 ${X(29)} 0 Q${X(29.8)} -7 ${X(27)} -12 Z" fill="@aileO" opacity="0.5"/>`;
  const quills = `<path d="M${X(8)} -14 q-3 5 -3.4 10 M${X(14)} -12 q-3 6 -3.2 12 M${X(20)} -9 q-2.6 6 -2.6 12 M${X(25)} -5 q-2.2 5 -2 10" stroke="@aileO" stroke-width="0.8" fill="none" opacity="0.6"/>`;
  const dots = ([[9, -8], [13, -2], [17, 4], [22, -1], [26, 5], [11, 6], [20, 10], [27, -8], [15, -14], [24, -12]] as const)
    .map(([x, y]) => `<circle cx="${X(x)}" cy="${y}" r="0.9" fill="@aileH"/>`).join('');
  return `<g data-fore="plumes">${coat}${shade}${quills}<g opacity="0.75">${dots}</g></g>`;
}
// Plastron de FACE du manteau : épaules + haut de poitrail @aile, bord bas festonné, mouchetures.
function foreCoatFront(p: QuadProps): string {
  if (!p.foreCoat) return '';
  const teeth = 'l-1.4 4.6 l-4 -4.6 '.repeat(5);
  const coat = `<path d="M-16.4 -8 Q-17.4 -22.6 -7.8 -27.4 Q0 -29.4 7.8 -27.4 Q17.4 -22.6 16.4 -8 Q16 1 13.6 8 ${teeth}Q-16 1 -16.4 -8 Z" fill="@aile" stroke="@aileO" stroke-width="0.6"/>`;
  const sheen = `<path d="M-5.6 -24 Q0 -26.6 5.6 -24 Q6.4 -8 4 6 Q0 9 -4 6 Q-6.4 -8 -5.6 -24 Z" fill="@aileH" opacity="0.32"/>`;
  const groove = `<path d="M0 -25 Q0.4 -6 0 8" fill="none" stroke="@aileO" stroke-width="0.7" opacity="0.4"/>`;
  const dots = ([[-9, -14], [9, -14], [-11, -4], [11, -4], [-6, 0], [6, 0], [-3, -8], [3, -8], [0, 3]] as const)
    .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="0.85" fill="@aileH"/>`).join('');
  return `<g data-fore="plumes">${coat}${sheen}${groove}<g opacity="0.75">${dots}</g></g>`;
}
// Dorsale (prop `ridge`, défaut 'epines' pour draconic) : ÉPINES pointues / CRÊTE-voile
// ondulée / PLAQUES rondes, le long du haut du dos. Coordonnées calées sur le dos draconic —
// les autres builds varient de quelques px (acceptable : la dorsale vit sur les reptiliens).
function ridgeArt(p: QuadProps): string {
  const r = p.ridge ?? (p.build === 'draconic' ? 'epines' : 'sans');
  if (r === 'sans') return '';
  const bl = p.bodyLen;
  const own = quadArt(quadHeadDef(p.head).ridge, p); // dorsale déclarée par la DEF de tête
  if (own) return own;
  if (r === 'epines')
    return `<g data-ridge="epines"><path d="M${-20 * bl} -14 l-1 -5 l3 4 M${-8 * bl} -19 l0 -6 l3 5 M${6 * bl} -21 l1 -6 l2 5 M${18 * bl} -18 l1 -5 l2 4" fill="@corpsO" stroke="@corpsO" stroke-width="0.5"/></g>`;
  if (r === 'epines-continues') { // rangée SERRÉE d'épines coniques (@cheveux) garrot→croupe sur voile
    // orangée — signature artwork du Basilic (LDB 79 p.319) ; la continuité tête→queue s'obtient avec la
    // crête de la tête 'basilic' + mane 'hirsute' (encolure) + la crête de queue 'reptile'.
    const ep = (x: number, y: number, h: number) =>
      `M${(x * bl).toFixed(1)} ${y} Q${(x * bl - 1.8).toFixed(1)} ${(y - h * 0.72).toFixed(1)} ${(x * bl - 3).toFixed(1)} ${y - h} Q${(x * bl - 0.6).toFixed(1)} ${(y - h * 0.32).toFixed(1)} ${(x * bl + 2.8).toFixed(1)} ${y + 0.4} Z`;
    return `<g data-ridge="epines-continues">` +
      `<path d="M${(24 * bl).toFixed(1)} -17.5 Q${(14 * bl).toFixed(1)} -25 ${(2 * bl).toFixed(1)} -25.5 Q${(-12 * bl).toFixed(1)} -24 ${(-26 * bl).toFixed(1)} -18.5 L${(-26 * bl).toFixed(1)} -14 Q${(-12 * bl).toFixed(1)} -19 ${(24 * bl).toFixed(1)} -14 Z" fill="#c07b32" opacity="0.55"/>` +
      `<path d="${ep(22, -19.5, 6)}${ep(16, -20.5, 7.5)}${ep(10, -21, 8.5)}${ep(4, -21, 9)}${ep(-2, -20, 8.5)}${ep(-8, -19, 8)}${ep(-14, -17.5, 7)}${ep(-20, -16, 6)}${ep(-26, -14.5, 5)}" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.5"/></g>`;
  }
  if (r === 'crete') // voile continue ondulée
    return `<g data-ridge="crete"><path d="M${-21 * bl} -12 Q${-17 * bl} -23 ${-11 * bl} -16 Q${-5 * bl} -26 ${1 * bl} -18 Q${7 * bl} -27 ${13 * bl} -18 Q${18 * bl} -24 ${22 * bl} -15 L${21 * bl} -12 Q0 -19 ${-20 * bl} -10 Z" fill="@corpsO" opacity="0.92" stroke="@cheveuxO" stroke-width="0.5"/></g>`;
  // plaques rondes (stégo-like)
  return `<g data-ridge="plaques"><ellipse cx="${-15 * bl}" cy="-15" rx="3.4" ry="4.4" fill="@corpsO" stroke="@cheveuxO" stroke-width="0.5"/><ellipse cx="${-5 * bl}" cy="-19" rx="3.8" ry="5" fill="@corpsO" stroke="@cheveuxO" stroke-width="0.5"/><ellipse cx="${6 * bl}" cy="-20" rx="3.8" ry="5" fill="@corpsO" stroke="@cheveuxO" stroke-width="0.5"/><ellipse cx="${16 * bl}" cy="-16" rx="3.2" ry="4.2" fill="@corpsO" stroke="@cheveuxO" stroke-width="0.5"/></g>`;
}
// Marquages de ROBE (prop `markings`) : taches/rayures sur le flanc (les balzanes vivent sur
// les MEMBRES, cf. legParts). Sombre sur robe claire (op. soutenue), discret sinon.
function markingsArt(p: QuadProps): string {
  const m = p.markings ?? 'sans';
  if (m !== 'taches' && m !== 'rayures') return '';
  const bl = p.bodyLen;
  if (m === 'taches')
    return `<g data-marking="taches" opacity="0.5"><ellipse cx="${-14 * bl}" cy="-4" rx="4.6" ry="3.4" fill="@corpsO"/><ellipse cx="${-2 * bl}" cy="3" rx="3.6" ry="2.8" fill="@corpsO"/><ellipse cx="${12 * bl}" cy="-7" rx="4" ry="3" fill="@corpsO"/><ellipse cx="${18 * bl}" cy="2" rx="2.8" ry="2.2" fill="@corpsO"/></g>`;
  return `<g data-marking="rayures" opacity="0.45"><path d="M${-16 * bl} -16 q-2 12 -1 22 M${-8 * bl} -19 q-2 13 -1 25 M${0 * bl} -20 q-2 13 -1 26 M${8 * bl} -20 q-1 13 0 25 M${15 * bl} -18 q-1 12 0 22" stroke="@corpsO" stroke-width="2.6" fill="none" stroke-linecap="round"/></g>`;
}
// (La masse d'arrière-train vit dans la silhouette continue du tronc, cf. barrel() ; l'os `croupe`
// ne porte que les pattes arrière et la queue — jamais une « bulle » détourée.)
function neck(p: QuadProps): string {
  const h = quadHeadDef(p.head);
  // Cluster multi-cous (hydre, chimère, déchiqueteur) : sa def BINDE son art de profil sur
  // l'os `encolure` → le faisceau ondule d'un bloc, sans os supplémentaire.
  if (quadHeadBone(h, 'profile') === 'encolure') return quadArt(h.art.profile, p);
  const L = 30 * p.neckLen;
  // Encolure SCULPTÉE : large à la base (fond dans le poitrail), gorge incurvée — plus un tube.
  // La base PLONGE profondément dans le corps (jusqu'à +18, évasée) ; le CONTOUR n'est tracé que
  // sur les bords HAUTS (crête de l'encolure + gorge) — le bas FOND dans le corps SANS trait
  // (un liseré sur tout le pourtour ferait « plaque rapportée » sur l'épaule).
  const base = `<path d="M-14 18 Q-13 6 -9 0 Q-11 ${-L * 0.5} -5 ${-L} L6 ${-L} Q10 ${-L * 0.55} 10 0 Q12 9 15 18 Q0 21 -14 18 Z" fill="@corps"/>` +
    // crête (dessus de l'encolure) tracée du milieu du corps vers la nuque
    `<path d="M-12.5 9 Q-11 ${-L * 0.5} -5 ${-L}" fill="none" stroke="@corpsO" stroke-width="0.7"/>` +
    // gorge (devant de l'encolure) + pli de gorge interne
    `<path d="M13.5 11 Q11 1 10 0 Q10 ${-L * 0.55} 6 ${-L}" fill="none" stroke="@corpsO" stroke-width="0.7"/>` +
    `<path d="M9 4 Q9.5 ${-L * 0.5} 5 ${-L * 0.94}" fill="none" stroke="@corpsO" stroke-width="0.7" opacity="0.45"/>`;
  const crin = quadArt(quadManeDef(p.mane).art.neck, p); // crinière d'encolure déclarée par sa DEF
  // Avant-train emplumé (foreCoat) : la BASE de l'encolure — qui plonge dans le poitrail et le
  // recouvre au rendu — porte le manteau @aile, transition DENTELÉE plumes du cou → plumage du
  // poitrail + mouchetures claires (sinon le manteau du tronc reste caché derrière ce panneau).
  const bib = p.foreCoat
    ? `<path d="M-13.2 15.6 Q-12.4 8 -10.2 2.6 l2.6 2.8 l1.2 -4.2 l2.8 3.2 l1.4 -4.4 l3 3 l1.4 -4 l2.7 2.4 Q10.4 4.4 10.6 1.4 Q11.8 9 14.4 16.6 Q0 20 -13.2 15.6 Z" fill="@aile" stroke="@aileO" stroke-width="0.5"/>` +
      `<g fill="@aileH" opacity="0.75"><circle cx="-7" cy="10" r="0.8"/><circle cx="-1" cy="8" r="0.8"/><circle cx="5" cy="10" r="0.8"/><circle cx="-4" cy="14" r="0.8"/><circle cx="9" cy="13" r="0.8"/><circle cx="2" cy="13" r="0.8"/></g>`
    : '';
  return `<g>${base}${crin}${bib}</g>`;
}
/** Art de TÊTE d'une vue, si `bone` en est le PORTEUR déclaré par la def (binding par vue). */
function headArtOn(p: QuadProps, view: View, bone: QuadBoneId): string {
  const h = quadHeadDef(p.head);
  return quadHeadBone(h, view) === bone ? quadArt(h.art[view], p) : '';
}
/** Coiffe de crâne (bois ramifiés du cerf / cornes courbées) attachée au sommet-arrière de l'os tete.
 *  '' si la créature n'en porte pas. Teinte os/corne = @cheveux (secondaire de la robe). */
function headgear(p: QuadProps, view: 'front' | 'profile' | 'back'): string {
  if (!p.headgear) return '';
  const C = '@cheveux', O = '@cheveuxO';
  if (p.headgear === 'cornes') {
    if (view === 'profile')
      return `<path d="M-1 -5 Q-8 -11 -7 -21 Q-2 -13 -2 -7 Z" fill="${C}" stroke="${O}" stroke-width="0.5"/>` +
        `<path d="M2 -5 Q-5 -12 -3 -23 Q3 -14 1 -7 Z" fill="${C}" stroke="${O}" stroke-width="0.5"/>`;
    return `<path d="M-3 -10 Q-11 -16 -9 -26 Q-4 -18 -4 -12 Z" fill="${C}" stroke="${O}" stroke-width="0.5"/>` +
      `<path d="M3 -10 Q11 -16 9 -26 Q4 -18 4 -12 Z" fill="${C}" stroke="${O}" stroke-width="0.5"/>`;
  }
  // bois (ramure de cerf) : perche incurvée qui s'élève PUIS balaie vers l'arrière + andouillers (tines)
  const beam = (sx: number, near: boolean): string => {
    const o = near ? 1 : 0.6, sw = near ? 2.8 : 2.1;
    const perche = `M${sx * 2} -5 Q${sx * 10} -15 ${sx * 12} -26 Q${sx * 13} -33 ${sx * 8} -38`;
    const tines = `M${sx * 6} -11 Q${sx * 13} -12 ${sx * 16} -19 M${sx * 9} -18 Q${sx * 16} -20 ${sx * 18} -27 M${sx * 11} -25 Q${sx * 16} -28 ${sx * 16} -34 M${sx * 9} -36 Q${sx * 5} -39 ${sx * 2} -39`;
    return `<g opacity="${o}" stroke="${C}" stroke-linecap="round" fill="none">` +
      `<path d="${perche}" stroke-width="${sw}"/>` +
      `<path d="${tines}" stroke-width="${(sw * 0.78).toFixed(1)}"/>` +
      `<path d="${perche}" stroke="${O}" stroke-width="0.6" opacity="0.5"/></g>`;
  };
  if (view === 'profile') return beam(-1.12, false) + beam(-1, true); // les deux perches vers l'arrière, décalées
  return beam(-1, true) + beam(1, true); // ramure symétrique (face/dos)
}
// (Les arts de tête de PROFIL vivent dans `heads/defs/<clé>.ts`, résolus par `headArtOn`.)
function tail(p: QuadProps): string {
  const t = quadTailDef(p.tail);
  return t.vide ? '' : quadArt(t.art.profile, p); // `vide` = l'espèce ne porte pas de queue
}

// ============================ FACE (front) ============================
// (Oreilles et arts de tête de FACE vivent dans `heads/kit.ts` + `heads/defs/<clé>.ts`.)
// Poitrail FACE des CANIDÉS/FÉLINS : étroit et PROFOND (quille au bréchet) + fraise de fourrure
// au garrot (loup d'hiver) — pas le barillet rond des ongulés/ursidés (qui faisait « tonneau »).
function bodyFrontCanine(p: QuadProps): string {
  const w = p.build === 'feline' ? 14 : 13; // épaule étroite
  const body = `<path d="M${-w} -4 Q${-w} -20 -6 -26 Q0 -28 6 -26 Q${w} -20 ${w} -4 Q${w - 1} 11 5 21 Q0 25 -5 21 Q${-(w - 1)} 11 ${-w} -4 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>`;
  // ombres de flanc (poitrail bombé) + quille claire centrale (poils du bréchet).
  const flanks = `<path d="M${-w} -4 Q${-w} 11 -5 21 L-6 18 Q${-(w - 2)} 9 ${-(w - 2)} -3 Z" fill="@corpsO" opacity="0.42"/>` +
    `<path d="M${w} -4 Q${w} 11 5 21 L6 18 Q${w - 2} 9 ${w - 2} -3 Z" fill="@corpsO" opacity="0.5"/>`;
  const bib = `<path d="M-3.6 -18 Q0 -21 3.6 -18 Q4.4 -2 2 15 Q0 18 -2 15 Q-4.4 -2 -3.6 -18 Z" fill="@corpsH" opacity="0.3"/>`;
  const ruff = quadArt(quadManeDef(p.mane).art.chestRuff, p); // fraise de poitrail déclarée par la DEF de crinière
  return `<g>${body}${flanks}${ruff}${bib}</g>`;
}
function bodyFront(p: QuadProps): string {
  if (p.build === 'canine' || p.build === 'feline') return bodyFrontCanine(p);
  if (p.build === 'batracien') { // crapaud : corps LARGE et BAS (la carrure↑ ne l'étire pas en colonne)
    const W = 26;
    return `<g><path d="M${-W} -8 Q${-W} -14 ${-W * 0.5} -15 Q0 -16 ${W * 0.5} -15 Q${W} -14 ${W} -8 L${W - 3} 8 Q${W - 8} 14 0 15 Q${-(W - 8)} 14 ${-(W - 3)} 8 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
      `<path d="M-5 -14 Q0 -16 5 -14 L4 12 Q0 14 -4 12 Z" fill="@corpsH" opacity="0.4"/>` +
      `<circle cx="-11" cy="-3" r="1.6" fill="@corpsO"/><circle cx="10" cy="-1" r="1.8" fill="@corpsO"/><circle cx="-3" cy="5" r="1.4" fill="@corpsO"/><circle cx="7" cy="7" r="1.3" fill="@corpsO"/><circle cx="0" cy="-9" r="1.2" fill="@corpsO"/></g>`;
  }
  // Poitrail vu de FACE : masse RONDE (épaules larges en haut → bréchet resserré entre les
  // antérieurs), modelée en BARILLET (reflet central bombé + ombres de flanc) pour qu'elle
  // lise « volume » et pas « planche plate ». w = demi-largeur d'épaule, br = demi-bréchet.
  const w = quadHeadDef(p.head).bodyWidth?.front ?? 17; // largeur d'épaule DÉCLARÉE par la def de tête
  const br = w * 0.46; // bréchet (sortie des antérieurs) — les pattes émergent de là
  const crest = quadArt(quadHeadDef(p.head).chestCrest, p);
  // silhouette : épaules rondes (±w à mi-hauteur), poitrail qui se referme en V doux sur le bréchet.
  const body = `<path d="M${-w} -8 Q${-w - 1} -23 ${-w * 0.46} -28 Q0 -30 ${w * 0.46} -28 Q${w + 1} -23 ${w} -8 Q${w - 1} 9 ${br + 2} 18 Q0 24 ${-(br + 2)} 18 Q${-(w - 1)} 9 ${-w} -8 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>`;
  // ombres de flanc (les deux bords s'enroulent en arrière) — donnent la rondeur du barillet.
  const flanks =
    `<path d="M${-w} -8 Q${-w - 1} -23 ${-w * 0.46} -28 L${-w * 0.5} -23 Q${-w * 0.84} -16 ${-(w - 1.5)} -6 Q${-(w - 1)} 8 ${-(br + 1)} 17 L${-(br + 2)} 18 Q${-(w - 1)} 9 ${-w} -8 Z" fill="@corpsO" opacity="0.42"/>` +
    `<path d="M${w} -8 Q${w + 1} -23 ${w * 0.46} -28 L${w * 0.5} -23 Q${w * 0.84} -16 ${w - 1.5} -6 Q${w - 1} 8 ${br + 1} 17 L${br + 2} 18 Q${w - 1} 9 ${w} -8 Z" fill="@corpsO" opacity="0.5"/>`;
  // reflet bombé central (sternum/pectoraux face au spectateur) + léger sillon médian.
  const sheen = `<path d="M-${w * 0.34} -22 Q0 -27 ${w * 0.34} -22 Q${w * 0.4} -4 ${br * 0.7} 14 Q0 19 ${-br * 0.7} 14 Q-${w * 0.4} -4 -${w * 0.34} -22 Z" fill="@corpsH" opacity="0.4"/>`;
  const groove = `<path d="M0 -24 Q0.4 -4 0 16" fill="none" stroke="@corpsO" stroke-width="0.7" opacity="0.35"/>`;
  return `<g>${body}${flanks}${sheen}${groove}${crest}${foreCoatFront(p)}</g>`;
}

// ============================ DOS (back) ============================
// (L'arrière du crâne / la nuque vivent dans `heads/kit.ts` (`napeGeneric`) + `heads/defs/<clé>.ts`.)
// Arrière-train DOS des CANIDÉS/FÉLINS : SVELTE et HAUT (cuisses musclées mais pas de grosses
// « fesses » d'ongulé), queue touffue tombante au centre, jarrets qui se devinent. ≠ croupe large.
function bodyBackCanine(p: QuadProps): string {
  const w = p.build === 'feline' ? 16 : 15;
  const body = `<path d="M${-w} -6 Q${-w} -19 -6 -23 Q0 -25 6 -23 Q${w} -19 ${w} -6 Q${w - 1} 9 7 19 Q0 23 -7 19 Q${-(w - 1)} 9 ${-w} -6 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>`;
  // deux cuisses fuselées (reflet vertical) + sillon central + ombres de flanc.
  const haunch = `<ellipse cx="${-w * 0.42}" cy="-3" rx="${w * 0.4}" ry="13" fill="@corpsH" opacity="0.28"/>` +
    `<ellipse cx="${w * 0.42}" cy="-3" rx="${w * 0.4}" ry="13" fill="@corpsH" opacity="0.2"/>`;
  const cleft = `<path d="M0 -20 Q1.4 -2 0 19" fill="none" stroke="@corpsO" stroke-width="1" opacity="0.55"/>`;
  const shade = `<path d="M${w} -6 Q${w - 1} 9 7 19 L8 16 Q${w - 2} 8 ${w - 2} -4 Z" fill="@corpsO" opacity="0.42"/>`;
  const ridge = quadArt(quadManeDef(p.mane).art.backTuft, p); // touffe de croupe déclarée par la DEF de crinière
  return `<g>${body}${haunch}${cleft}${shade}${ridge}</g>`;
}
function bodyBack(p: QuadProps): string {
  if (p.build === 'canine' || p.build === 'feline') return bodyBackCanine(p);
  // Arrière-train vu de DOS : DEUX FESSES rondes séparées par un sillon central profond,
  // masse LARGE et BASSE (plus large que haute) → lit comme une croupe de quadrupède, pas une
  // colonne « debout ». Chaque hanche prend un reflet bombé ; le sillon est creusé (ombre).
  const w = quadHeadDef(p.head).bodyWidth?.back ?? 22; // largeur de croupe DÉCLARÉE par la def de tête
  // silhouette : dôme du dos en haut, hanches larges au milieu, bas qui se referme (sortie des
  // postérieurs). Léger renflement à mi-flanc (les fesses débordent la taille).
  const body = `<path d="M${-w} -5 Q${-w - 1} -17 ${-w * 0.46} -21 Q0 -23 ${w * 0.46} -21 Q${w + 1} -17 ${w} -5 Q${w} 12 ${w * 0.5} 22 Q0 26 ${-w * 0.5} 22 Q${-w} 12 ${-w} -5 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>`;
  // deux hanches bombées (reflet) — la droite un peu moins éclairée (volume).
  const cheeks =
    `<ellipse cx="${-w * 0.44}" cy="-1" rx="${w * 0.42}" ry="13.5" fill="@corpsH" opacity="0.34"/>` +
    `<ellipse cx="${w * 0.44}" cy="-1" rx="${w * 0.42}" ry="13.5" fill="@corpsH" opacity="0.24"/>`;
  // sillon central profond (raie des fesses) — large ombre douce + trait sombre net.
  const cleft = `<path d="M0 -19 Q2 1 0 22 Q-2 1 0 -19 Z" fill="@corpsO" opacity="0.4"/>` +
    `<path d="M0 -18 Q1.4 2 0 21" fill="none" stroke="@corpsO" stroke-width="1.1" opacity="0.6"/>`;
  // bords de flanc qui s'enroulent en arrière (rondeur) + ombre sous-fessière.
  const shade =
    `<path d="M${w} -5 Q${w} 12 ${w * 0.5} 22 L${w * 0.6} 20 Q${w - 2} 10 ${w - 2} -3 Z" fill="@corpsO" opacity="0.42"/>` +
    `<path d="M${-w} -5 Q${-w} 12 ${-w * 0.5} 22 L${-w * 0.6} 20 Q${-(w - 2)} 10 ${-(w - 2)} -3 Z" fill="@corpsO" opacity="0.3"/>` +
    `<ellipse cx="0" cy="20" rx="${w * 0.62}" ry="5" fill="@corpsO" opacity="0.22"/>`;
  return `<g>${body}${cheeks}${cleft}${shade}</g>`;
}
// queue vue de dos : pend au centre, sous la croupe (art de la DEF de queue).
const tailBack = (p: QuadProps): string => quadArt(quadTailDef(p.tail).art.back, p);

// ============================ AILES (gabarit ailé) ============================
// Repère LOCAL = garrot. DEUX ÉTATS d'art (cf. WingState) : REPLIÉES le long du dos (repos —
// les lames dressées en permanence lisaient « feuilles plantées ») / DÉPLOYÉES (vol/attaque).
// PROFIL replié : l'aile se couche vers l'arrière (-x), couvre le haut du flanc, pointe au-delà
// de la croupe. FACE/DOS : déployée vers +x (aile gauche miroitée scale(-1,1) au dispatch).
// Couleur d'AILE : famille de jetons dédiée `@aile*`, repliée sur la ROBE (`@corps*`) quand la
// def ne stocke pas de base `aile` (cf. resolveQuadFromProps) — permet une aile d'une AUTRE
// teinte que le corps (pégase : robe blanche, ailes brun/doré, artwork LDB 79 p.325).
function wingFoldedProfile(p: QuadProps, far: boolean): string {
  const c = far ? '@aileO' : '@aile';
  const L = 46 * p.bodyLen; // longueur du pli (suit l'allongement du corps)
  if (p.wings === 'membrane') { // membrane pliée : doigts rabattus en faisceau le long du dos + griffe au poignet
    if (p.wingPose === 'deployees') // PAIRE demi-ouverte DÉPLOYÉE (dragon, artwork LDB p.321) : même voile
      // dressée que 'dressees' mais lisible en aile MEMBRANEUSE — panneaux pâles translucides (@aileH)
      // entre les doigts côté proche, aile lointaine basculée vers la queue montrant son ENVERS clair
      return `<g data-wing="folded" transform="rotate(${far ? -24 : 0})" opacity="${far ? 0.92 : 1}">` +
        `<path d="M0 0 Q-3 -20 -13 -44 L-28 -12 Q-24 -9 -20 -4 Q-16 -9 -11 -2 Q-6 -6 0 2 Z" fill="${far ? '@aileH' : '@aile'}" stroke="@aileO" stroke-width="0.7"/>` +
        (far ? '' :
          `<path d="M-13 -44 Q-22 -28 -28 -12 Q-24 -9 -20 -4 Q-19 -26 -13 -44 Z" fill="@aileH" opacity="0.4"/>` +
          `<path d="M-13 -44 Q-19 -26 -20 -4 Q-16 -9 -11 -2 Q-13 -24 -13 -44 Z" fill="@aileH" opacity="0.24"/>`) +
        `<path d="M0 0 Q-7 -24 -13 -44" fill="none" stroke="@aileO" stroke-width="2.6" stroke-linecap="round"/>` +
        `<path d="M-13 -44 Q-22 -28 -28 -12 M-13 -44 Q-19 -26 -20 -4 M-13 -44 Q-13 -24 -11 -2" fill="none" stroke="@aileO" stroke-width="1.4" stroke-linecap="round"/>` +
        `<path d="M-13 -44 l-2.6 -4.6 l4 1.8 Z" fill="${far ? '@aileH' : '@aile'}" stroke="@aileO" stroke-width="0.6"/>` + // griffe de poignet au sommet
        `</g>`;
    if (p.wingPose === 'dressees') // repliées DRESSÉES : membrane à demi-ouverte POINTÉE vers le haut,
      // poignet griffu au sommet (manticore/chauve-souris au repos — pas couchée façon planeur)
      return `<g data-wing="folded" opacity="${far ? 0.9 : 1}">` +
        `<path d="M0 0 Q-3 -20 -13 -44 L-28 -12 Q-24 -9 -20 -4 Q-16 -9 -11 -2 Q-6 -6 0 2 Z" fill="${c}" stroke="@aileO" stroke-width="0.7"/>` +
        `<path d="M0 0 Q-7 -24 -13 -44" fill="none" stroke="@aileO" stroke-width="2.6" stroke-linecap="round"/>` +
        `<path d="M-13 -44 Q-22 -28 -28 -12 M-13 -44 Q-19 -26 -20 -4 M-13 -44 Q-13 -24 -11 -2" fill="none" stroke="@aileO" stroke-width="1.4" stroke-linecap="round"/>` +
        `<path d="M-13 -44 l-2.6 -4.6 l4 1.8 Z" fill="${c}" stroke="@aileO" stroke-width="0.6"/>` + // griffe de poignet au sommet
        `</g>`;
    return `<g data-wing="folded">` +
      `<path d="M2 -2 Q-6 -7 ${-L * 0.45} -6 Q${-L} -3 ${-L - 7} 4 Q${-L * 0.6} 3 ${-L * 0.3} 4 Q-4 5 3 3 Z" fill="${c}" stroke="@aileO" stroke-width="0.7"/>` +
      `<path d="M1 -1 Q${-L * 0.4} -5 ${-L - 5} 3 M0 1 Q${-L * 0.4} -2 ${-L * 0.72} 2" fill="none" stroke="@aileO" stroke-width="1.1" stroke-linecap="round" opacity="0.8"/>` +
      `<path d="M3 -2 l3 -3 l1.4 3.4" fill="${c}" stroke="@aileO" stroke-width="0.6"/>` + // griffe de poignet
      `</g>`;
  }
  // plumes DRESSÉES (wingPose 'dressees' — pégase, artwork LDB 79 p.325) : paire de GRANDES ailes
  // LEVÉES vers le haut/arrière, lame emplumée large à rémiges digitées au sommet. L'aile
  // lointaine (far) est plus couchée en arrière que la proche → deux silhouettes distinctes en V.
  // Même vocabulaire wingPose que la membrane (manticore) ; défaut plumes = couchées ci-dessous.
  if (p.wingPose === 'dressees') {
    const rot = (far ? -26 : -4) + (p.wingLift ?? 0);
    return `<g data-wing="folded" transform="rotate(${rot})" opacity="${far ? 0.92 : 1}">` +
      // lame LARGE : bord d'attaque (avant) → pointe DIGITÉE au sommet → bord de fuite vers l'épaule
      `<path d="M4 0 Q0 -6 -3 -14 Q-6 -23 -12 -30 Q-17 -36 -24 -40 l-1 3.6 -3.8 -1 1 3.8 -3.8 -0.2 1.1 3.6 -3.7 0.7 Q-30 -21 -24 -14 Q-17 -5 -10 1 Q-3 6 5 4 Z" fill="${c}" stroke="@aileO" stroke-width="0.7"/>` +
      // panneau interne clair (volume) + longues rémiges + couvertures festonnées à la base
      `<path d="M2 -1 Q-2 -8 -5 -16 Q-8 -24 -13 -30 Q-17 -25 -14 -17 Q-10 -7 -4 0 Z" fill="@aileH" opacity="0.28"/>` +
      `<path d="M-24 -38 Q-17 -26 -10 -9 M-28 -34 Q-21 -23 -13 -6 M-31 -30 Q-24 -20 -16 -4" fill="none" stroke="@aileO" stroke-width="0.8" opacity="0.65"/>` +
      `<path d="M-4 -6 q-4.6 3 -9.6 2.2 M-9 -13 q-4.6 3 -9.6 2.2 M-1 -1 q-4.6 3 -9.6 2.2" fill="none" stroke="@aileO" stroke-width="0.7" opacity="0.7"/>` +
      // arête d'attaque claire
      `<path d="M3 -1 Q-2 -10 -7 -20 Q-13 -31 -22 -38" fill="none" stroke="@aileH" stroke-width="1.1" opacity="0.6"/>` +
      `</g>`;
  }
  // plumes REPLIÉES : vraie aile de rapace couchée — épaule pleine, rangées de COUVERTURES
  // festonnées, RÉMIGES sombres dont les pointes dépassent la croupe, arête d'aile claire —
  // les 3 hachures plates lisaient « lignes sur le dos », pas une aile.
  const prim = (sx: number, sy: number, tx: number, ty: number, w: number) =>
    `M${sx} ${sy} Q${((sx + tx) / 2).toFixed(1)} ${(Math.min(sy, ty) - 3).toFixed(1)} ${tx.toFixed(1)} ${ty} q-1.8 ${w} -5 ${(w * 0.75).toFixed(1)} Q${((sx + tx) / 2).toFixed(1)} ${(sy + w * 0.9).toFixed(1)} ${sx} ${sy + w} Z`;
  const scallop = (x: number, y: number) => `M${x.toFixed(1)} ${y} q-4.8 3.8 -10.4 3.3`;
  return `<g data-wing="folded">` +
    `<path d="${prim(-8, 0, -L - 8, -4, 3.4)} ${prim(-10, 2, -L - 4, 1, 3.2)} ${prim(-12, 4, -L + 2, 6, 3)}" fill="@aileO" stroke="#171008" stroke-width="0.4"/>` +
    `<path d="M6 -5 Q-3 -10.5 ${(-L * 0.34).toFixed(1)} -10.4 Q${(-L * 0.72).toFixed(1)} -8.6 ${(-L - 5).toFixed(1)} -4 Q${(-L * 0.66).toFixed(1)} 2.6 ${(-L * 0.28).toFixed(1)} 4.6 Q-3 5.6 6 0.6 Z" fill="${c}" stroke="@aileO" stroke-width="0.7"/>` +
    `<path d="${scallop(-2, -2)} ${scallop(-L * 0.24, -2.6)} ${scallop(-L * 0.46, -3)} ${scallop(-L * 0.68, -3.2)} ${scallop(-L * 0.12, 2)} ${scallop(-L * 0.36, 1.6)} ${scallop(-L * 0.58, 1)} ${scallop(-L * 0.78, 0.4)}" fill="none" stroke="@aileO" stroke-width="0.75" opacity="0.75"/>` +
    `<path d="M4 -5.4 Q${(-L * 0.4).toFixed(1)} -10.8 ${(-L - 4).toFixed(1)} -4.6" fill="none" stroke="@aileH" stroke-width="1.1" opacity="0.6"/>` +

    `</g>`;
}
function wingProfile(p: QuadProps, far: boolean): string {
  const c = far ? '@aileO' : '@aile';
  if (p.wings === 'membrane') { // dragon : grande membrane à doigts dressée haut au-dessus du dos
    return `<g opacity="${far ? 0.9 : 1}">` +
      `<path d="M0 0 Q-4 -30 -16 -52 L-34 -8 Q-29 -5 -25 -1 Q-20 -5 -14 1 Q-7 -3 0 2 Z" fill="${c}" stroke="@aileO" stroke-width="0.7"/>` +
      `<path d="M0 0 Q-8 -26 -16 -52" fill="none" stroke="@aileO" stroke-width="2.8" stroke-linecap="round"/>` +
      `<path d="M-16 -52 Q-26 -30 -34 -8 M-16 -52 Q-24 -28 -25 -1 M-16 -52 Q-16 -26 -14 1" fill="none" stroke="@aileO" stroke-width="1.6" stroke-linecap="round"/>` +
      `</g>`;
  }
  // plumes DÉPLOYÉES (profil) : grande aile de rapace portée À L'HORIZONTALE vers l'arrière —
  // bras qui monte au poignet puis RÉMIGES DIGITÉES séparées par des encoches (un éventail de
  // lames quasi verticales lit « planches dressées », pas une envergure de rapace).
  return `<g>` +
    `<path d="M0 0 Q-8 -10 -20 -17 Q-31 -22 -45 -18 Q-37 -13 -36 -12 Q-44 -11 -42 -9 Q-34 -6 -32 -6 Q-39 -2 -37 0 Q-29 1 -28 1 Q-34 5 -32 6.6 Q-22 6 -18 4.4 Q-8 5.6 -2 3.6 Z" fill="${c}" stroke="@aileO" stroke-width="0.7"/>` +
    `<path d="M-18 -15 Q-28 -18 -39 -15 M-17 -11 Q-27 -11 -35 -7 M-14 -7 Q-22 -5 -31 -1 M-11 -3 Q-19 0 -27 4" stroke="@aileO" stroke-width="0.7" fill="none" opacity="0.6"/>` +
    `<path d="M-4 -4 q-3.6 2.4 -8 2.2 M-11 -8 q-3.6 2.4 -8 2.2 M-9 -0.6 q-3.6 2.4 -8 2.2" stroke="@aileO" stroke-width="0.7" fill="none" opacity="0.6"/>` +
    `<path d="M0 -1.4 Q-10 -11 -21 -17" stroke="@aileH" stroke-width="1.2" fill="none" opacity="0.6"/>` +
    `</g>`;
}
// Déployée (face/dos) — vers +x : grande aile qui s'élève ET s'étend (silhouette de rapace
// déployant). Bras + surface + rémiges/doigts. (Aile G = miroir scale(-1,1) au dispatch.)
function wingSpread(p: QuadProps): string {
  if (p.wings === 'membrane') { // dragon : grande membrane à doigts, montant haut
    return `<g>` +
      `<path d="M0 0 Q18 -22 38 -22 Q54 -21 62 -10 L54 -7 Q50 -12 42 -4 Q38 -13 30 -2 Q24 -12 16 0 Q8 -6 0 3 Z" fill="@aile" stroke="@aileO" stroke-width="0.7"/>` +
      `<path d="M0 0 Q28 -20 60 -11" fill="none" stroke="@aileO" stroke-width="2.4" stroke-linecap="round"/>` +
      `<path d="M38 -21 Q41 -12 42 -4 M30 -19 Q30 -11 30 -2 M16 -12 Q16 -6 16 0" fill="none" stroke="@aileO" stroke-width="1.5" stroke-linecap="round"/>` +
      `</g>`;
  }
  return `<g>` + // rapace : aile qui monte en arc + 4 rémiges digitées au bout
    `<path d="M0 1 Q16 -16 34 -17 Q52 -18 62 -8 Q50 -4 34 -4 Q16 -2 3 6 Z" fill="@aile" stroke="@aileO" stroke-width="0.7"/>` +
    `<path d="M54 -9 Q62 -9 64 -3 L58 -2 Q52 -5 48 -6 Z M44 -14 Q52 -14 55 -7 L49 -6 Q44 -10 40 -11 Z M32 -16 Q40 -17 43 -10 L37 -9 Q32 -13 28 -13 Z M20 -16 Q27 -16 30 -10 L24 -9 Q20 -13 16 -12 Z" fill="@aile" stroke="@aileO" stroke-width="0.4"/>` +
    `<path d="M8 -4 Q24 -11 44 -10 M10 0 Q26 -5 42 -5" stroke="@aileO" stroke-width="0.6" fill="none" opacity="0.5"/>` +
    `</g>`;
}

// Aile PLIÉE vue de bout (face/dos) : panneau replié qui ÉPOUSE LE FLANC vers le bas (épaule
// modeste + pan qui descend le long du corps) : une bosse dressée au garrot lit comme de
// grandes « oreilles d'âne » près de la tête (verdict unanime des juges aveugles, lot 4).
function wingFoldedEnd(p: QuadProps): string {
  const c = p.wings === 'membrane' ? '@aileO' : '@aile';
  if (p.wingPose === 'dressees' || p.wingPose === 'deployees') // pliées DRESSÉES vues de bout : panneau qui MONTE en pointe
    // au-dessus de l'épaule (silhouette de chauve-souris au repos), griffe au sommet
    return `<g data-wing="folded">` +
      `<path d="M0 -2 Q4 -10 6.5 -19 Q8 -23.5 9.6 -21.5 Q10 -8 8 6 Q5.5 12 2.6 9 Q1 4 0 0 Z" fill="${c}" stroke="@aileO" stroke-width="0.6"/>` +
      `<path d="M4 -6 Q6.4 -14 8.6 -19 M3 -1 Q5.6 -9 7.6 -14" fill="none" stroke="@aileO" stroke-width="0.7" opacity="0.6"/>` +
      `<path d="M8.4 -21.5 l1 -3 l1.6 2.4 Z" fill="${c}" stroke="@aileO" stroke-width="0.5"/>` +
      `</g>`;
  return `<g data-wing="folded">` +
    `<path d="M0 -2 Q5 -7 8 -4 Q10 1 9.5 8 Q9 15 6 19 Q3.6 20.5 2.4 18 Q1 9 0 0 Z" fill="${c}" stroke="@aileO" stroke-width="0.6"/>` +
    `<path d="M3.4 -1 Q5.6 6 5 16 M6.4 -2 Q8.2 5 7.6 13" fill="none" stroke="@aileO" stroke-width="0.7" opacity="0.6"/>` +
    (p.wings === 'membrane' ? `<path d="M7.4 -4.6 l2 -2 l0.8 2.6" fill="${c}" stroke="@aileO" stroke-width="0.5"/>` : '') +
    `</g>`;
}

// ============================ scission crâne / nuque (vue de DOS) ============================
/**
 * Ligne de partage de l'art de tête vu de DOS, dans le repère de l'art (y croissant = vers le
 * garrot) : au-dessus vit le CRÂNE (calotte, oreilles, coiffe), au-dessous la NUQUE (le raccord
 * crinière→garrot qui se glisse entre les épaules). Les deux calques sont le MÊME art, découpé par
 * les clipPaths `rigCutQuadCrane`/`rigCutQuadNuque` (`fxGradients.ts`, userSpaceOnUse) — précédent :
 * la scission du bras au coude (`splitBrasSvg`, parts/derive.ts). Ils sont portés par deux os de
 * plans DIFFÉRENTS (`tete` / `nuque`, cf. QUAD_Z) : de dos, le crâne reste au-dessus du tronc et la
 * nuque passe dessous.
 * PÉRIMÈTRE de la scission : l'art passé ici, c'est-à-dire `headgear(p, 'back') + napeBack(p)`. Le
 * décor du canal `deco` (clés `tete` et `tete#back`) est apposé par `withDeco` APRÈS la découpe,
 * hors des deux calques : il est porté ENTIER par l'os `tete`, y compris la part de son art qui
 * descend sous la ligne de partage.
 */
const backHeadLayers = (art: string) => ({
  crane: `<g clip-path="url(#rigCutQuadCrane)">${art}</g>`,
  nuque: `<g clip-path="url(#rigCutQuadNuque)">${art}</g>`,
});

// ============================ repère de l'art, par OS × VUE ============================
/**
 * Repère (transform SVG) dans lequel vit l'art d'un os pour une vue : échelles d'espèce
 * (`headScale` / `tailLen` / `wingSpan`), agrandissement de la tête de PROFIL, miroir de l'aile
 * GAUCHE vue de bout. SOURCE UNIQUE : l'assemblage du gabarit ET le canal `deco` y passent.
 * `bodyLen`/`neckLen` n'y sont PAS : `barrel`/`neck` les cuisent dans les coordonnées de l'art de
 * tronc et d'encolure, et une def qui décore ces deux os s'authore à ces valeurs. Chaîne vide =
 * repère identité.
 */
export function quadAnchor(p: QuadProps, bone: QuadBoneId, view: View): string {
  const t: string[] = [];
  if (bone === 'tete' || bone === 'nuque') { // `nuque` = calque BAS de l'art de tête : MÊME repère
    if (p.headScale && p.headScale !== 1) t.push(`scale(${p.headScale})`);
    // Tête de PROFIL agrandie (1.3) : à l'échelle nue elle lisait « minuscule/sombre » au bout
    // de l'encolure. Ancrée à la jonction tête-cou (0,0) → grandit sans se détacher du cou.
    if (view === 'profile') t.push('scale(1.3)');
  } else if (bone === 'queue') {
    if (p.tailLen && p.tailLen !== 1) t.push(`scale(${p.tailLen})`);
  } else if (bone === 'aileD' || bone === 'aileG') {
    if (bone === 'aileG' && view !== 'profile') t.push('scale(-1,1)');
    if (p.wingSpan && p.wingSpan !== 1) t.push(`scale(${p.wingSpan})`);
  }
  return t.join(' ');
}
/** Pose `svg` DANS le repère de l'os × vue (cf. `quadAnchor`). */
export function quadAnchored(p: QuadProps, bone: QuadBoneId, view: View, svg: string): string {
  const t = quadAnchor(p, bone, view);
  return t ? `<g transform="${t}">${svg}</g>` : svg;
}

// ============================ dispatch ============================
/**
 * Un CALQUE d'art porté par un os : `plan` RELATIF au plan de l'os (`QuadDecoFragment.plan`),
 * absent = calque peint avec l'art de l'os (dans l'ordre d'apposition).
 */
export interface QuadLayer { svg: string; plan?: number }
/** Calques ordonnés PAR OS — le retour de `quadParts`. Un os absent ne porte aucun art. */
export type QuadLayers = Partial<Record<QuadBoneId, QuadLayer[]>>;

/** Fragments déclarés d'une valeur de `deco` (SVG nu = un fragment sans plan). */
export const quadDecoFragments = (v: QuadDecoValue): QuadDecoFragment[] =>
  (typeof v === 'string' ? [{ svg: v }] : v);

export function quadParts(p: QuadProps, view: View = 'profile', wings: 'folded' | 'spread' = 'folded'): QuadLayers {
  const frontFoot: QuadFoot = p.frontFoot ?? p.foot;
  // Décor PAR-OS propre à la créature (prop `deco` — précédent : épave du crabe, CrabProps.deco) :
  // SVG posé dans le REPÈRE DE L'ART de l'os (`quadAnchor`), en CALQUE sur cet os, uniquement là
  // où l'os porte déjà un art dans la vue courante (un os sans art n'affiche pas de décor flottant).
  // Clé `os#vue` = décor limité à cette vue (cf. QuadProps.deco) ; clé nue = toutes les vues.
  // Une entrée peut être un SVG nu (un calque au plan de l'os) OU une liste de calques déjà
  // planifiés (`QuadLayer[]`) : c'est ce second cas qui permet à l'assemblage d'INTERCALER un
  // morceau d'os dans la pile de la vue (haut de membre sous le barillet, cf. plus bas).
  const withDeco = (r: Partial<Record<QuadBoneId, string | QuadLayer[]>>): QuadLayers => {
    const out: QuadLayers = {};
    for (const [id, v] of Object.entries(r) as [QuadBoneId, string | QuadLayer[] | undefined][])
      if (typeof v === 'string') { if (v) out[id] = [{ svg: v }]; } else if (v?.length) out[id] = [...v];
    if (p.deco) for (const [key, val] of Object.entries(p.deco) as [string, QuadDecoValue | undefined][]) {
      const [id, vue] = key.split('#') as [QuadBoneId, View | undefined];
      if (!val || (vue && vue !== view) || !out[id]) continue;
      for (const f of quadDecoFragments(val)) out[id]!.push({ svg: quadAnchored(p, id, view, f.svg), plan: f.plan });
    }
    return out;
  };
  // Ailes face/dos : déployées vers ±x, ou bosses pliées au garrot (aileG = miroir de l'ancre).
  const endArt = wings === 'spread' ? wingSpread(p) : wingFoldedEnd(p);
  const endWings = (v: View) => (p.wings
    ? { aileD: quadAnchored(p, 'aileD', v, endArt), aileG: quadAnchored(p, 'aileG', v, endArt) }
    : {});
  if (view === 'front') {
    const n = legPartsFront(p, false, frontFoot, true), f = legPartsFront(p, true, p.foot);
    return withDeco({
      ...endWings('front'),
      tronc: bodyFront(p), tete: quadAnchored(p, 'tete', view, headgear(p, 'front') + headArtOn(p, 'front', 'tete')),
      hautAvD: n.haut, basAvD: n.bas, piedAvD: n.pied, hautAvG: n.haut, basAvG: n.bas, piedAvG: n.pied,
      hautArD: f.haut, basArD: f.bas, piedArD: f.pied, hautArG: f.haut, basArG: f.bas, piedArG: f.pied,
    });
  }
  if (view === 'back') {
    const n = legPartsFront(p, false, p.foot), f = legPartsFront(p, true, frontFoot, true);
    const dos = backHeadLayers(headgear(p, 'back') + headArtOn(p, 'back', 'tete'));
    return withDeco({
      ...endWings('back'),
      tronc: bodyBack(p), queue: quadAnchored(p, 'queue', view, tailBack(p)),
      tete: quadAnchored(p, 'tete', view, dos.crane), nuque: quadAnchored(p, 'nuque', view, dos.nuque),
      hautArD: n.haut, basArD: n.bas, piedArD: n.pied, hautArG: n.haut, basArG: n.bas, piedArG: n.pied,
      hautAvD: f.haut, basAvD: f.bas, piedAvD: f.pied, hautAvG: f.haut, basAvG: f.bas, piedAvG: f.pied,
    });
  }
  // profil : pattes AVANT (frontFoot) près/loin, pattes ARRIÈRE (p.foot) près/loin.
  const nearAv = legParts(p, false, frontFoot, true), farAv = legParts(p, true, frontFoot, true);

  const nearAr = legParts(p, false, p.foot), farAr = legParts(p, true, p.foot);
  const profArt = (far: boolean) => quadAnchored(p, far ? 'aileG' : 'aileD', view, wings === 'spread' ? wingProfile(p, far) : wingFoldedProfile(p, far));
  const profWings = p.wings ? { aileD: profArt(false), aileG: profArt(true) } : {};
  // Carrure `sousTronc` : le segment HAUT des membres PROCHES quitte le plan des pattes proches
  // (9) pour se glisser SOUS le barillet (5) — c'est le membre ENTIER, jamais un z d'os global :
  // le calque est intercalé pour cette espèce seule, les 24 autres gardent leur pile au bit près
  // (empreintes `quad-purete-rendu`). Sans ce plan, le chapeau rond du haut de membre (masse
  // d'épaule + calotte du cône) se peignait PAR-DESSUS la tête et le flanc — démontré à la sonde
  // d'isolement : la patte proche (9) couvrait la tête (7) et le tronc (5). Le bas et le pied
  // restent devant (9). Valeur : entre la croupe (4) et le tronc (5), donc aucune égalité de z à
  // départager dans le tri peintre.
  const PLAN_HAUT_SOUS_TRONC = QUAD_Z.tronc.profile - 0.5 - QUAD_Z.hautAvD.profile;
  const hautProche = (svg: string): string | QuadLayer[] =>
    (LEG_BUILD[p.build] ?? LEG_BUILD.equine).sousTronc ? [{ svg, plan: PLAN_HAUT_SOUS_TRONC }] : svg;
  return withDeco({
    ...profWings,
    tronc: barrel(p), encolure: neck(p), tete: quadAnchored(p, 'tete', view, headgear(p, 'profile') + headArtOn(p, 'profile', 'tete')), queue: quadAnchored(p, 'queue', view, tail(p)),
    hautAvD: hautProche(nearAv.haut), basAvD: nearAv.bas, piedAvD: nearAv.pied,
    hautArD: hautProche(nearAr.haut), basArD: nearAr.bas, piedArD: nearAr.pied,
    hautAvG: farAv.haut, basAvG: farAv.bas, piedAvG: farAv.pied,
    hautArG: farAr.haut, basArG: farAr.bas, piedArG: farAr.pied,
  });
}
