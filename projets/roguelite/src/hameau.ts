/**
 * Le panorama du hameau de Grisefosse, en SVG : la nuit sur le Reikland, les toits pris par la lune, les fenêtres qui
 * luisent. Chaque bâtiment se dessine à son palier : en ruine, puis relevé, de plus en plus éclairé et pavoisé.
 */
import { enRuine, type IdBatiment } from './jeu';

export const LARGEUR = 1800;
export const HAUTEUR = 720;

/** La toile montre les 1600 unités du milieu de la scène : une ancre se donne au point de la scène qu'elle désigne. */
const ancre = (x: number, y: number): [number, number] => [(x - 100) * (LARGEUR / 1600), y];
/** Où poser l'enseigne de chaque bâtiment, en coordonnées de toile. */
export const ANCRES: Record<IdBatiment, [number, number]> = {
  temple: ancre(426, 402), relais: ancre(668, 350), forge: ancre(940, 430), salle: ancre(1168, 402), cartographe: ancre(1353, 236), peage: ancre(1560, 420),
};

const alea = (graine: number) => () => {
  graine = (graine + 0x6d2b79f5) | 0;
  let t = Math.imul(graine ^ (graine >>> 15), 1 | graine);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const NOIR = '#0c0910', MUR = '#30263a', OMBRE = '#1e1728', TOIT = '#181226', LUNE = '#3a3356', BOIS = '#513a28', PIERRE = '#3d3749', CREPI = '#40343f', OR = '#f3c46a', SANG = '#8a2418';
const C = `stroke="${NOIR}" stroke-width="2" stroke-linejoin="round"`;
const SOL = 586;
const p = (d: string, fill: string, extra = '') => `<path d="${d}" fill="${fill}"${extra ? ` ${extra}` : ''}/>`;
const r = (x: number, y: number, w: number, h: number, fill: string, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${extra ? ` ${extra}` : ''}/>`;
const trait = (d: string, couleur: string, e: number, extra = '') => `<path d="${d}" stroke="${couleur}" stroke-width="${e}" fill="none" stroke-linecap="round" stroke-linejoin="round"${extra ? ` ${extra}` : ''}/>`;
const lueur = (x: number, y: number, rayon: number, opacite = 0.8) => `<circle cx="${x}" cy="${y}" r="${rayon}" fill="url(#lueur)" opacity="${opacite}" style="mix-blend-mode:screen"/>`;
/** Une fenêtre dans son bâti : allumée (et son halo), ou éteinte. */
const fenetre = (x: number, y: number, w: number, h: number, allumee: boolean) =>
  (allumee ? lueur(x + w / 2, y + h / 2, w * 2.4, 0.6) : '') + r(x - 2.5, y - 2.5, w + 5, h + 5, BOIS, 'stroke="#0c0910" stroke-width="1.5"') + r(x, y, w, h, allumee ? OR : '#15101f')
  + (allumee ? r(x, y, w, h * 0.45, '#ffe6a8', 'opacity=".5"') : '') + trait(`M${x + w / 2},${y}v${h}M${x},${y + h / 2}h${w}`, NOIR, 1.6);
/** Un mur de face, son flanc droit dans l'ombre. */
const mur = (x: number, y: number, w: number, h: number, fill = MUR) => r(x, y, w, h, fill, C) + r(x + w * 0.64, y + 1, w * 0.36 - 1, h - 2, '#000', 'opacity=".2"');
/** Un pan de toit vu de face : ses rangs de bardeaux, son rampant gauche pris par la lune. */
function pan(x1: number, x2: number, bas: number, haut: number, retrait: number, debord = 10): string {
  let rangs = '';
  for (let k = 1; k < 4; k++) { const e = retrait - ((retrait + debord) * k) / 4; rangs += `M${x1 + e},${haut + ((bas - haut) * k) / 4}H${x2 - e}`; }
  return p(`M${x1 - debord},${bas}L${x1 + retrait},${haut}H${x2 - retrait}L${x2 + debord},${bas}Z`, TOIT, C)
    + p(`M${x1 - debord},${bas}L${x1 + retrait},${haut}h${(x2 - x1) * 0.2}L${x1 - debord + (x2 - x1) * 0.26},${bas}Z`, LUNE, 'opacity=".45"') + trait(rangs, NOIR, 1.2, 'opacity=".55"');
}
/** Un pignon : le mur en pointe sous ses deux rampants. */
function pignon(x1: number, x2: number, bas: number, haut: number, fill = MUR): string {
  const m = (x1 + x2) / 2;
  return p(`M${x1},${bas}L${m},${haut}L${x2},${bas}Z`, fill, C) + p(`M${m},${haut}L${x2},${bas}H${m + (x2 - m) * 0.3}Z`, '#000', 'opacity=".2"')
    + `<path d="M${x1 - 9},${bas + 6}L${m},${haut - 6}L${x2 + 9},${bas + 6}" stroke="${TOIT}" stroke-width="10" fill="none"/>` + trait(`M${x1 - 9},${bas + 2}L${m},${haut - 10}`, LUNE, 2.5);
}
const fumee = (x: number, y: number) => trait(`M${x},${y}c-8,-14 10,-22 2,-38c-6,-12 8,-20 5,-32`, '#7a70a0', 8, 'opacity=".28"');
const cheminee = (x: number, y: number, h: number) => fumee(x + 8, y - h - 8) + r(x, y - h, 16, h, OMBRE, C) + r(x - 2, y - h - 5, 20, 6, PIERRE, C);
const drapeau = (x: number, y: number, h: number, couleur = SANG) => trait(`M${x},${y}v-${h}`, '#4a405a', 3) + p(`M${x},${y - h + 2}l28,5l-7,6l7,7l-28,-3z`, couleur, 'stroke="#0c0910" stroke-width="1.2"');
const lanterne = (x: number, y: number) => lueur(x, y, 36, 0.8) + r(x - 4, y - 6, 8, 12, OR, 'stroke="#0c0910" stroke-width="1.5"');
const porte = (x: number, y: number, w: number, h: number, fill: string) => p(`M${x - w / 2},${y}v-${h - w / 2}a${w / 2},${w / 2} 0 0 1 ${w},0v${h - w / 2}z`, fill, C);
/** Des moellons épars sur un mur de pierre. */
const moellons = (x: number, y: number, w: number, h: number, graine: number) => { const q = alea(graine); let d = ''; for (let k = 0; k < (w * h) / 700; k++) d += `M${(x + 6 + q() * (w - 26)).toFixed(0)},${(y + 6 + q() * (h - 12)).toFixed(0)}h${(8 + q() * 8).toFixed(0)}`; return trait(d, NOIR, 1.4, 'opacity=".4"'); };
const gravats = (x: number, y: number, w: number) => p(`M${x},${y}l${w * 0.14},-12l${w * 0.12},5l${w * 0.16},-9l${w * 0.2},8l${w * 0.14},-5l${w * 0.24},13z`, '#221a2c', C);

/** Le sapin de la lisière. */
function sapin(x: number, y: number, h: number, fill: string): string {
  const w = h * 0.34; const n = 5; let d = `M${x},${y - h}`;
  for (let k = 1; k <= n; k++) { const yy = y - h + (h * 0.94 * k) / n, ww = (w * k) / n; d += `L${x + ww * 0.55},${yy - h * 0.035}L${x + ww},${yy}L${x + ww * 0.35},${yy - h * 0.02}`; }
  for (let k = n; k >= 1; k--) { const yy = y - h + (h * 0.94 * k) / n, ww = (w * k) / n; d += `L${x - ww * 0.35},${yy - h * 0.02}L${x - ww},${yy}L${x - ww * 0.55},${yy - h * 0.035}`; }
  return p(`${d}L${x - w * 0.06},${y - h * 0.06}L${x - w * 0.06},${y}L${x + w * 0.06},${y}L${x + w * 0.06},${y - h * 0.06}Z`, fill);
}

/** Un personnage debout en silhouette. */
const silhouette = (x: number, y: number, h: number, fill: string) =>
  `<g transform="translate(${x},${y}) scale(${h / 100})" fill="${fill}"><path d="M-15,0C-18,-28 -19,-54 -13,-72C-9,-78 9,-78 13,-72C19,-54 18,-28 15,0Z"/><circle cx="0" cy="-88" r="10.5"/></g>`;

/** L'hospice de Shallya : la nef, sa rosace et ses lancettes, le clocher au cœur doré. */
function chapelle(n: number): string {
  if (n === 0) {
    return p('M352,586V470L372,452L384,474L402,440L416,466L436,448L462,476V586Z', MUR, C) + p('M318,586V452L326,436L336,450L346,428L356,452V586Z', OMBRE, C)
      + fenetre(380, 508, 18, 30, false) + fenetre(420, 508, 18, 30, false) + moellons(352, 480, 110, 100, 3) + gravats(300, 590, 90) + gravats(430, 592, 60);
  }
  const fort = n >= 2, verre = fort ? OR : '#b07a38';
  let s = mur(352, 478, 110, 108) + pignon(352, 462, 478, 410) + moellons(352, 480, 110, 100, 3);
  s += mur(318, 390, 44, 196, OMBRE) + p('M312,392L340,300L368,392Z', TOIT, C) + p('M312,392L340,300L346,392Z', LUNE, 'opacity=".45"') + r(314, 388, 52, 6, PIERRE, C);
  s += trait('M340,300v-22', '#4a405a', 3) + p('M340,274c-4,-6 -11,-1 -7,5l7,7 7,-7c4,-6 -3,-11 -7,-5z', n >= 3 ? '#e2c06a' : '#8a6a3a', 'stroke="#0c0910" stroke-width="1.2"');
  s += fort ? lueur(407, 510, 78, 0.7) : '';
  for (const x of [382, 420]) s += p(`M${x},548v-32l7,-13 7,13v32z`, verre, C);
  s += `<circle cx="407" cy="462" r="13" fill="${verre}" ${C}/>` + trait('M394,462h26M407,449v26M398,453l18,18M416,453l-18,18', NOIR, 1.4);
  s += p('M330,440v-24a10,10 0 0 1 20,0v24z', '#15101f', C) + (n >= 2 ? trait('M340,420v10', '#c9a14a', 5) + lueur(340, 426, 30, 0.5) : '') + fenetre(332, 474, 16, 24, true);
  s += porte(407, 586, 22, 34, '#0c0910') + (n >= 3 ? lueur(340, 300, 96, 0.4) + lanterne(376, 560) + lanterne(438, 560) : '');
  return s;
}

/** L'auberge relais : le rez-de-chaussée de pierre, l'étage à colombages, le porche et l'enseigne. */
function relais(n: number): string {
  let s = '';
  if (n >= 1) s += mur(470, 510, 62, 76, PIERRE) + pan(470, 532, 512, 478, 12, 7) + porte(500, 586, 34, 46, '#0c0910') + trait('M486,586v-26M514,586v-26M486,566h28', BOIS, 3) + (n >= 2 ? lanterne(500, 528) : '');
  s += cheminee(760, 378, 44) + mur(528, 504, 280, 82, PIERRE) + moellons(528, 506, 280, 78, 9) + mur(518, 434, 300, 72, CREPI);
  let bois = 'M518,436H818M518,504H818';
  for (let x = 518; x <= 818; x += 60) bois += `M${x},436V504`;
  for (const x of [518, 638, 758]) bois += `M${x},504l30,-68M${x + 60},504l-30,-68`;
  s += trait(bois, BOIS, 5) + trait('M518,436H818', NOIR, 1.2, 'opacity=".5"') + pan(518, 818, 438, 360, 50, 14);
  if (n >= 2) for (const x of [612, 724]) s += p(`M${x - 18},418v-22l18,-16 18,16v22z`, CREPI, C) + trait(`M${x - 23},398l23,-21 23,21`, TOIT, 7) + fenetre(x - 7, 396, 14, 16, true);
  const allumees = [2, 3, 4, 5][n];
  [548, 608, 668, 728, 788].forEach((x, k) => { s += fenetre(x - 12, 452, 24, 32, k < allumees); });
  [556, 612, 724, 780].forEach((x, k) => { s += fenetre(x - 12, 522, 24, 30, k < allumees - 1); });
  s += lueur(668, 562, 54, 0.6) + porte(668, 586, 44, 58, '#0c0910') + porte(668, 586, 32, 50, '#b8742e') + trait('M668,586v-48', '#5a3410', 2);
  s += trait('M818,468h40M850,468v10', '#4a405a', 3.5) + r(834, 478, 32, 26, BOIS, C) + trait('M844,485h9v12h-9zM853,487q5,3 0,7', OR, 1.8);
  if (n >= 3) s += drapeau(580, 362, 44) + lanterne(590, 560) + lanterne(746, 560);
  return s;
}

/** La forge, ouverte dès le premier jour : le foyer, le forgeron à l'enclume ; puis l'auvent et le fanion. */
function forge(n: number): string {
  let s = r(996, 416, 26, 76, OMBRE, C) + r(992, 410, 34, 8, PIERRE, C) + trait('M1009,406c-8,-14 10,-24 2,-40c-5,-11 7,-18 5,-30', '#8a7890', 9, 'opacity=".3"')
    + `<circle cx="1004" cy="392" r="2" fill="#ffb65a"/><circle cx="1016" cy="372" r="1.6" fill="#ffb65a"/><circle cx="1008" cy="352" r="1.2" fill="#ffd778"/>`;
  s += mur(872, 510, 160, 76, PIERRE) + moellons(872, 512, 160, 72, 21) + pan(872, 1032, 512, 462, 34, 12);
  s += lueur(922, 556, 104, 0.95) + porte(922, 586, 62, 58, '#3a1408') + porte(922, 586, 50, 50, '#ffb65a') + porte(922, 586, 30, 36, '#ffe2a0');
  s += silhouette(972, 586, 56, '#0a0708') + trait('M984,540l19,-17', '#0a0708', 5) + r(998, 517, 12, 8, '#0a0708') + p('M950,586h30v-9h7v-7h-44v7h7z', '#0a0708');
  if (n >= 1) s += trait('M1032,536H1076M1070,536V586', BOIS, 5) + p('M1028,534l52,0 6,-10h-52z', TOIT, C) + trait('M1048,586v-34M1040,560h16M1058,586l6,-30', '#8a8e96', 3);
  if (n >= 2) s += drapeau(884, 470, 40);
  if (n >= 3) s += fenetre(1000, 532, 18, 22, true) + lanterne(884, 540);
  return s;
}

/** La salle d'armes : la halle de bois, les épées croisées au fronton, la quintaine dans la cour. */
function salleDArmes(n: number): string {
  if (n === 0) {
    return p('M1086,586V512L1110,498L1128,516L1160,492L1190,510L1214,496L1262,520V586Z', MUR, C) + trait('M1100,586l40,-58M1180,586l30,-46M1232,586l-8,-40', BOIS, 6) + gravats(1076, 592, 110) + gravats(1210, 592, 70);
  }
  let s = mur(1086, 478, 176, 108, CREPI) + pignon(1086, 1262, 478, 414, CREPI);
  let bois = 'M1086,480H1262M1086,532H1262';
  for (const x of [1086, 1130, 1218, 1262]) bois += `M${x},480V586`;
  s += trait(`${bois}M1130,480l-44,52M1218,480l44,52`, BOIS, 5);
  [1108, 1240].forEach((x) => { s += fenetre(x - 10, 494, 20, 26, true); });
  if (n >= 2) [1108, 1240].forEach((x) => { s += fenetre(x - 10, 546, 20, 26, true); });
  s += (n >= 2 ? lueur(1174, 558, 56, 0.6) : '') + porte(1174, 586, 40, 58, '#0c0910') + (n >= 2 ? porte(1174, 586, 28, 48, '#b8742e') : '');
  s += trait('M1150,446l48,32M1198,446l-48,32', '#d0d3d9', 4) + trait('M1154,452l-6,8M1194,452l6,8', '#c9a14a', 3) + `<circle cx="1174" cy="462" r="9" fill="${SANG}" ${C}/>`;
  s += trait('M1294,586v-60M1276,542h36', BOIS, 6) + `<circle cx="1294" cy="517" r="10" fill="${BOIS}" ${C}/>` + p('M1270,538v18l-8,6v-22z', SANG, 'stroke="#0c0910" stroke-width="1.2"');
  if (n >= 3) s += p('M1140,500h14v40l-7,-7 -7,7zM1194,500h14v40l-7,-7 -7,7z', SANG, 'stroke="#0c0910" stroke-width="1.2"') + lanterne(1140, 556) + lanterne(1208, 556);
  return s;
}

/** La tour du cartographe : la haute maison étroite, son enseigne à la carte, puis la lunette et la girouette. */
function cartographe(n: number): string {
  let s = mur(1316, 352, 74, 234, MUR) + moellons(1316, 480, 74, 100, 31) + r(1310, 440, 86, 7, PIERRE, C);
  s += p('M1306,356L1353,270L1400,356Z', TOIT, C) + p('M1306,356L1353,270L1362,356Z', LUNE, 'opacity=".45"') + trait('M1322,330h62M1336,304h34', NOIR, 1.2, 'opacity=".55"');
  s += trait('M1353,270v-30', '#4a405a', 3) + fenetre(1341, 376, 24, 32, true) + fenetre(1341, 462, 24, 30, n >= 1) + fenetre(1341, 518, 24, 30, n >= 2) + porte(1353, 586, 22, 32, '#0c0910');
  if (n >= 1) s += trait('M1390,424h30M1414,424v8', '#4a405a', 3.5) + r(1400, 432, 30, 22, '#d6c196', C) + trait('M1405,446l7,-7 5,4 8,-7', SANG, 1.8);
  if (n >= 2) s += trait('M1296,446h14', PIERRE, 5) + trait('M1300,440l-26,-18', '#c9a14a', 6) + trait('M1298,446v-8', '#4a405a', 3);
  if (n >= 3) s += p('M1353,250l24,6 -24,8z', '#c9a14a', 'stroke="#0c0910" stroke-width="1.2"') + lueur(1353, 392, 84, 0.45);
  return s;
}

/** Le péage : la rivière, le pont de pierre, la tour de garde et sa barrière ; puis la seconde tour. */
function peage(n: number): string {
  let s = p('M1430,592C1520,584 1660,586 1800,590V660H1430Z', '#232a4a');
  for (let k = 0; k < 10; k++) s += trait(`M${1450 + k * 34},${610 + (k % 3) * 11}h${18 + (k % 2) * 12}`, '#8a92d0', 1.5, 'opacity=".35"');
  s += p('M1486,604V566H1790V604H1740Q1722,572 1680,572Q1638,572 1620,604H1596Q1580,580 1552,580Q1524,580 1508,604Z', '#2a2236', C) + trait('M1486,566H1790', LUNE, 2.5, 'opacity=".7"') + moellons(1486, 566, 300, 20, 41);
  if (n === 0) {
    return s + p('M1494,566V452L1508,438L1518,452L1532,434L1546,452L1558,444V566Z', OMBRE, C) + fenetre(1516, 486, 18, 24, false) + trait('M1566,572l64,14', BOIS, 6) + gravats(1466, 592, 60);
  }
  s += mur(1494, 438, 66, 128, PIERRE) + moellons(1494, 440, 66, 120, 43);
  for (let k = 0; k < 4; k++) s += r(1490 + k * 19.5, 422, 13, 17, PIERRE, C);
  s += fenetre(1517, 468, 20, 26, true) + porte(1527, 566, 28, 40, '#0c0910');
  s += r(1562, 536, 8, 30, BOIS, C) + trait('M1566,546h104', '#c9a14a', 6) + trait('M1566,546h104', SANG, 6, 'stroke-dasharray="13 13" stroke-linecap="butt"') + lanterne(1566, 526);
  if (n >= 2) { s += mur(1716, 466, 48, 100, PIERRE); for (let k = 0; k < 3; k++) s += r(1712 + k * 20, 452, 13, 15, PIERRE, C); s += fenetre(1731, 492, 18, 24, true); }
  if (n >= 3) s += drapeau(1740, 452, 42) + lanterne(1700, 540);
  return s;
}

/** La scène entière, bâtiments à leur palier. Chaque bâtiment est un groupe `data-batiment` cliquable. */
export function sceneDuHameau(paliers: Record<IdBatiment, number>): string {
  const al = alea(17);
  let ciel = '';
  for (let k = 0; k < 170; k++) { const x = al() * LARGEUR, y = al() * 300, t = al(); ciel += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(0.4 + t * t * 1.5).toFixed(2)}" fill="#f4ead2" opacity="${((0.2 + al() * 0.7) * (1 - y / 360)).toFixed(2)}"/>`; }
  const crete = (y0: number, amp: number, pas: number, graine: number) => { const q = alea(graine); let d = `M0,${HAUTEUR}L0,${y0}`; for (let x = 0; x <= LARGEUR + pas; x += pas) d += `L${x},${(y0 - q() * amp).toFixed(0)}L${x + pas * 0.5},${(y0 - q() * amp * 0.4).toFixed(0)}`; return `${d}L${LARGEUR},${HAUTEUR}Z`; };
  let foret = '';
  for (let k = 0; k < 130; k++) { const x = al() * LARGEUR; foret += sapin(+x.toFixed(0), +(514 + al() * 14).toFixed(0), +(54 + al() * 80).toFixed(0), k % 2 ? '#1c1534' : '#17102a'); }
  let maisons = '';
  for (let k = 0; k < 18; k++) {
    const x = Math.round(20 + k * 100 + al() * 40), w = Math.round(44 + al() * 30), h = Math.round(30 + al() * 28), y = 552;
    maisons += p(`M${x},${y}V${y - h}L${x + w / 2},${y - h - 24}L${x + w},${y - h}V${y}Z`, '#221a34') + p(`M${x - 5},${y - h + 3}L${x + w / 2},${y - h - 27}l4,3L${x},${y - h + 6}Z`, '#342c50')
      + r(x + w * 0.66, y - h - 30, 7, 18, '#221a34');
    if (al() > 0.4) maisons += r(x + w * 0.3, y - h * 0.62, 8, 10, '#e0a252', 'opacity=".8"');
  }
  let herbes = '';
  for (let k = 0; k < 170; k++) { const x = al() * LARGEUR, y = 614 + al() * 100; herbes += `M${x.toFixed(0)},${y.toFixed(0)}q2,-${(5 + al() * 8).toFixed(0)} 4,0`; }
  const bat = (id: IdBatiment, dessin: string) => `<g class="bat${enRuine(paliers, id) ? ' ruine' : ''}" data-a="batiment" data-id="${id}">${dessin}</g>`;
  return `<svg class="scene" viewBox="0 0 ${LARGEUR} ${HAUTEUR}" preserveAspectRatio="xMidYMax slice" role="img" aria-label="Le hameau de Grisefosse">
  <defs>
    <linearGradient id="ciel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d0b1e"/><stop offset=".38" stop-color="#231a40"/><stop offset=".62" stop-color="#553a62"/><stop offset=".78" stop-color="#a8604e"/><stop offset=".86" stop-color="#e3a25c"/></linearGradient>
    <linearGradient id="sol" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#241b2c"/><stop offset=".4" stop-color="#130d19"/><stop offset="1" stop-color="#060408"/></linearGradient>
    <radialGradient id="lueur"><stop offset="0" stop-color="#ffdf9a" stop-opacity=".9"/><stop offset=".2" stop-color="#ffb65a" stop-opacity=".5"/><stop offset=".5" stop-color="#e07a2c" stop-opacity=".18"/><stop offset="1" stop-color="#e07a2c" stop-opacity="0"/></radialGradient>
    <radialGradient id="soleil"><stop offset="0" stop-color="#ffe3a0" stop-opacity=".95"/><stop offset=".25" stop-color="#ffb35e" stop-opacity=".5"/><stop offset="1" stop-color="#e0703a" stop-opacity="0"/></radialGradient>
    <radialGradient id="halo"><stop offset="0" stop-color="#f3ecd4" stop-opacity=".5"/><stop offset=".3" stop-color="#c9c2e0" stop-opacity=".16"/><stop offset="1" stop-color="#c9c2e0" stop-opacity="0"/></radialGradient>
    <filter id="flou" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="14"/></filter>
  </defs>
  <rect width="${LARGEUR}" height="${HAUTEUR}" fill="url(#ciel)"/>
  ${ciel}
  <circle cx="900" cy="520" r="270" fill="url(#soleil)"/>
  <circle cx="1210" cy="150" r="150" fill="url(#halo)"/><circle cx="1210" cy="150" r="38" fill="#f3ecd4"/><circle cx="1226" cy="140" r="34" fill="#1d1738" opacity=".92"/>
  ${p('M150,236q60,-22 130,-6q50,-16 110,4q-70,10 -120,6q-60,8 -120,-4zM1380,300q70,-20 150,-4q40,-12 90,2q-60,12 -110,6q-70,8 -130,-4zM760,206q40,-12 90,-2q30,-8 60,2q-40,8 -70,4q-40,4 -80,-4z', '#3a2c58', 'opacity=".5"')}
  ${p(crete(470, 120, 120, 3), '#3d2e56')}${p(crete(494, 54, 160, 8), '#2c2144')}
  <rect y="470" width="${LARGEUR}" height="70" fill="#d08a5a" opacity=".2" filter="url(#flou)"/>
  ${foret}${maisons}
  <rect y="${SOL - 2}" width="${LARGEUR}" height="${HAUTEUR - SOL + 2}" fill="url(#sol)"/>
  ${p('M0,614C300,598 520,592 800,594C1080,596 1400,602 1800,614V650C1400,638 1080,632 800,630C520,628 300,634 0,650Z', '#30263a', 'opacity=".8"')}
  ${bat('temple', chapelle(paliers.temple))}
  ${bat('relais', relais(paliers.relais))}
  ${bat('forge', forge(paliers.forge))}
  ${bat('salle', salleDArmes(paliers.salle))}
  ${bat('cartographe', cartographe(paliers.cartographe))}
  ${bat('peage', peage(paliers.peage))}
  ${trait(herbes, '#08060b', 1.2)}
  ${sapin(-30, 760, 420, '#040306')}${sapin(LARGEUR + 30, 770, 380, '#040306')}
</svg>`;
}
