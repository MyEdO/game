/**
 * Le panorama du hameau de Grisefosse, en SVG, dans la manière des décors du kit des maquettes (silhouettes plates
 * au crépuscule, fenêtres qui luisent ; `lieux-et-nuit/commun.js` de `chantier/4585-catalogue` pour le sapin). Chaque
 * bâtiment se dessine à son palier : en ruine, puis relevé, de plus en plus éclairé.
 */
import { enRuine, type IdBatiment } from './jeu';

export const LARGEUR = 1800;
export const HAUTEUR = 720;

/** Où poser l'enseigne de chaque bâtiment, en coordonnées de scène. */
export const ANCRES: Record<IdBatiment, [number, number]> = {
  memorial: [150, 452], temple: [392, 318], relais: [668, 330], forge: [962, 420], salle: [1176, 392], cartographe: [1350, 262], peage: [1618, 400],
};

const alea = (graine: number) => () => {
  graine = (graine + 0x6d2b79f5) | 0;
  let t = Math.imul(graine ^ (graine >>> 15), 1 | graine);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const p = (d: string, fill: string, extra = '') => `<path d="${d}" fill="${fill}"${extra ? ` ${extra}` : ''}/>`;
const r = (x: number, y: number, w: number, h: number, fill: string, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${extra ? ` ${extra}` : ''}/>`;
const lueur = (x: number, y: number, rayon: number, opacite = 0.8) => `<circle cx="${x}" cy="${y}" r="${rayon}" fill="url(#lueur)" opacity="${opacite}" style="mix-blend-mode:screen"/>`;
/** Une fenêtre : allumée (et son halo), ou éteinte. */
const fenetre = (x: number, y: number, w: number, h: number, allumee: boolean) =>
  (allumee ? lueur(x + w / 2, y + h / 2, w * 2.2, 0.55) : '') + r(x, y, w, h, allumee ? '#f3c46a' : '#1a1424', 'stroke="#0c0910" stroke-width="2"')
  + `<path d="M${x + w / 2},${y}v${h}M${x},${y + h / 2}h${w}" stroke="#0c0910" stroke-width="1.6"/>`;

/** Le sapin du kit (`lieux-et-nuit/commun.js`), en chaîne. */
function sapin(x: number, y: number, h: number, fill: string): string {
  const w = h * 0.34; const n = 5; let d = `M${x},${y - h}`;
  for (let k = 1; k <= n; k++) { const yy = y - h + (h * 0.94 * k) / n, ww = (w * k) / n; d += `L${x + ww * 0.55},${yy - h * 0.035}L${x + ww},${yy}L${x + ww * 0.35},${yy - h * 0.02}`; }
  for (let k = n; k >= 1; k--) { const yy = y - h + (h * 0.94 * k) / n, ww = (w * k) / n; d += `L${x - ww * 0.35},${yy - h * 0.02}L${x - ww},${yy}L${x - ww * 0.55},${yy - h * 0.035}`; }
  return p(`${d}L${x - w * 0.06},${y - h * 0.06}L${x - w * 0.06},${y}L${x + w * 0.06},${y}L${x + w * 0.06},${y - h * 0.06}Z`, fill);
}

/** Un personnage debout en silhouette. */
const silhouette = (x: number, y: number, h: number, fill: string) =>
  `<g transform="translate(${x},${y}) scale(${h / 100})" fill="${fill}"><path d="M-15,0C-18,-28 -19,-54 -13,-72C-9,-78 9,-78 13,-72C19,-54 18,-28 15,0Z"/><circle cx="0" cy="-88" r="10.5"/></g>`;

const MUR = '#1c1527', MUR_PROCHE = '#150f1d', TOIT = '#120c19', BOIS = '#3a2a1e';

function jardinDeMorr(n: number): string {
  const al = alea(5);
  let s = p('M10,600C60,540 240,536 300,600Z', '#120d18');
  if (n === 0) {
    for (let k = 0; k < 40; k++) { const x = 40 + al() * 240, y = 560 + al() * 36; s += `<path d="M${x},${y}q2,-${8 + al() * 10} 4,0" stroke="#0a070d" stroke-width="1.4" fill="none"/>`; }
    for (const [x, a] of [[110, -18], [170, 12], [222, 30]] as const) s += `<g transform="translate(${x},572) rotate(${a})">${r(-2, -26, 4, 28, '#2a2132')}${r(-9, -20, 18, 4, '#2a2132')}</g>`;
    return s + p('M248,566C246,540 252,520 262,506M256,530l14,-10M252,544l-12,-8', 'none', 'stroke="#0d0911" stroke-width="4"');
  }
  for (let k = 0; k < 7; k++) s += `<path d="M${46 + k * 34},584v-14" stroke="#2a2132" stroke-width="3"/>`;
  s += '<path d="M46,574H250" stroke="#2a2132" stroke-width="2"/>';
  for (const x of [96, 128, 176, 210]) s += `${r(x - 2, 548, 4, 26, '#3a3046')}${r(x - 8, 554, 16, 4, '#3a3046')}`;
  s += `${r(140, 520, 8, 54, '#2a2132')}${r(160, 520, 8, 54, '#2a2132')}${p('M136,522Q154,500 172,522Z', '#2a2132')}${p('M150,504l4,-8 4,8 6,-2 -6,6h-8l-6,-6z', '#0c0910')}`;
  s += `${lueur(154, 540, 22, 0.7)}${r(151, 534, 6, 8, '#f3c46a')}`;
  if (n >= 2) s += `${p('M224,584v-30h28v30z', '#2a2132')}${p('M220,556Q238,530 256,556Z', '#2a2132')}${lueur(238, 566, 30, 0.6)}${r(234, 562, 8, 12, '#f3c46a')}`;
  return s;
}

function chapelle(n: number): string {
  let s = '';
  if (n === 0) {
    s += p('M318,586V478L350,458L362,478L378,446L392,470L412,452L442,478V586Z', MUR);
    s += r(330, 420, 34, 60, MUR) + p('M330,420l6,-10 8,6 8,-12 12,16z', MUR);
    s += fenetre(372, 506, 20, 30, false) + fenetre(408, 506, 20, 30, false);
    return s + p('M300,586l14,-10 10,6 16,-6 12,10z', '#1a1322');
  }
  s += p('M318,586V478L380,424L442,478V586Z', MUR) + p('M310,480L380,418L450,480L442,484L380,430L318,484Z', TOIT);
  s += r(328, 404, 38, 182, MUR_PROCHE) + p('M324,406L347,330L370,406Z', TOIT) + `<path d="M347,330v-18M341,318h12" stroke="#2a2132" stroke-width="3"/>`;
  const fort = n >= 2;
  const verre = fort ? '#f3c46a' : '#b07a38';
  s += (fort ? lueur(400, 500, 70, 0.7) : '');
  for (const x of [380, 406]) s += p(`M${x},542v-30l7,-12 7,12v30z`, verre, 'stroke="#0c0910" stroke-width="2.5"');
  s += `<circle cx="400" cy="474" r="11" fill="${verre}" stroke="#0c0910" stroke-width="2.5"/><path d="M389,474h22M400,463v22M392,466l16,16M408,466l-16,16" stroke="#0c0910" stroke-width="1.4"/>`;
  s += fenetre(340, 430, 14, 22, n >= 1);
  s += p('M394,586v-32h12v32z', '#0c0910');
  if (n >= 3) s += lueur(347, 380, 90, 0.4) + `<circle cx="347" cy="372" r="6" fill="#c9a14a"/>`;
  return s;
}

function relais(n: number): string {
  let s = '';
  if (n >= 1) s += p('M466,586V486L496,462L526,486V586Z', MUR) + fenetre(482, 512, 16, 20, true) + fenetre(482, 546, 16, 20, n >= 2);
  s += p('M528,586V432H808V586Z', MUR) + p('M512,436L668,368L824,436L808,440L668,380L528,440Z', TOIT) + p('M528,432L668,372L808,432Z', MUR_PROCHE);
  for (const x of [528, 584, 640, 696, 752, 808]) s += `<path d="M${x},432V586" stroke="${BOIS}" stroke-width="5"/>`;
  s += `<path d="M528,500H808M528,436L584,500M640,436L584,500M696,436L752,500M808,436L752,500" stroke="${BOIS}" stroke-width="4"/>`;
  const allumees = [2, 3, 4, 5][n];
  [550, 606, 662, 718, 774].forEach((x, k) => { s += fenetre(x - 12, 452, 24, 28, k < allumees); });
  [550, 606, 718, 774].forEach((x, k) => { s += fenetre(x - 12, 520, 24, 30, k < allumees - 1); });
  s += p('M650,586v-50q18,-16 36,0v50z', '#0c0910') + lueur(668, 566, 40, 0.5) + p('M656,586v-44q12,-10 24,0v44z', '#a8692c');
  s += `<path d="M808,470h34M836,470v10" stroke="#2a2132" stroke-width="3"/>` + r(822, 480, 28, 22, BOIS, 'stroke="#0c0910" stroke-width="2"');
  s += `<path d="M831,486h8v10h-8zM839,488q4,2 0,6" stroke="#f3c46a" stroke-width="1.6" fill="none"/>`;
  s += '<g fill="#08070a"><path d="M556,566h104c5,0 8,3 8,8v8h-120v-8c0,-5 3,-8 8,-8zM540,580h140v6h-140zM566,552h30v14h-30zM606,548h40v18h-40z"/>';
  for (const cx of [566, 650]) s += `<circle cx="${cx}" cy="598" r="17" fill="none" stroke="#08070a" stroke-width="4"/>`;
  s += '</g>';
  if (n >= 3) s += `<path d="M808,432v-46" stroke="#2a2132" stroke-width="3"/>${p('M808,388l26,6 -26,8z', '#7c1f14')}${lueur(478, 470, 34, 0.6)}`;
  return s;
}

/** La forge, ouverte dès le premier jour : le feu, le forgeron à l'enclume. */
function forge(n: number): string {
  let s = '';
  s += p('M872,586V506L951,470L1030,506V586Z', MUR) + p('M862,508L951,464L1040,508L1030,512L951,476L872,512Z', TOIT);
  s += r(1000, 424, 22, 64, MUR_PROCHE);
  s += `<path d="M1011,420c-6,-14 8,-22 2,-36c-4,-10 6,-16 4,-26" stroke="#5a5070" stroke-width="7" fill="none" opacity=".35" stroke-linecap="round"/>`;
  s += lueur(920, 560, 90, 0.9) + p('M896,586v-44q24,-22 48,0v44z', '#ffb65a') + p('M904,586v-34q16,-14 32,0v34z', '#ffe2a0');
  s += silhouette(966, 586, 54, '#0a0708') + `<path d="M978,540l18,-16" stroke="#0a0708" stroke-width="5" stroke-linecap="round"/>`;
  s += p('M948,586h26v-8h6v-6h-38v6h6z', '#0a0708');
  if (n >= 1) s += `<path d="M1052,586v-52M1040,546h24M1052,534a7,7 0 1 0 .1,0" stroke="#2a1c12" stroke-width="5" fill="#2a1c12"/>`;
  if (n >= 2) s += `<path d="M872,506v-40" stroke="#2a2132" stroke-width="3"/>${p('M872,468l-24,6 24,8z', '#7c1f14')}`;
  return s;
}

/** La salle d'armes : une longue halle de bois, la quintaine dans la cour, les épées croisées à l'enseigne. */
function salleDArmes(n: number): string {
  let s = '';
  if (n === 0) {
    s += p('M1086,586V512L1110,500L1128,516L1160,494L1190,510L1214,498L1262,520V586Z', MUR);
    s += `<path d="M1100,586l40,-58M1180,586l30,-46" stroke="${BOIS}" stroke-width="6" stroke-linecap="round"/>`;
    return s + p('M1080,590l24,-10 18,6 26,-6 14,10z', '#1a1322');
  }
  s += p('M1086,586V474H1262V586Z', MUR) + p('M1072,478L1174,420L1276,478L1262,482L1174,432L1086,482Z', TOIT) + p('M1086,474L1174,424L1262,474Z', MUR_PROCHE);
  for (const x of [1086, 1130, 1174, 1218, 1262]) s += `<path d="M${x},474V586" stroke="${BOIS}" stroke-width="5"/>`;
  [1108, 1196, 1240].forEach((x, k) => { s += fenetre(x - 10, 496, 20, 26, k < n); });
  s += p('M1158,586v-46q16,-14 32,0v46z', '#0c0910') + (n >= 2 ? lueur(1174, 560, 50, 0.6) + p('M1164,586v-38q10,-9 20,0v38z', '#a8692c') : '');
  s += `<path d="M1150,452l48,30M1198,452l-48,30" stroke="#c9ccd2" stroke-width="4" stroke-linecap="round"/><circle cx="1174" cy="467" r="8" fill="#7c1f14" stroke="#0c0910" stroke-width="2"/>`;
  s += `<path d="M1292,586v-62M1276,540h32" stroke="${BOIS}" stroke-width="6" stroke-linecap="round"/>` + `<circle cx="1292" cy="516" r="9" fill="${BOIS}"/>`;
  if (n >= 3) s += `<path d="M1086,474v-40" stroke="#2a2132" stroke-width="3"/>${p('M1086,436l-24,6 24,8z', '#7c1f14')}`;
  return s;
}

function cartographe(n: number): string {
  let s = r(1112, 354, 76, 232, MUR) + p('M1104,358L1150,282L1196,358Z', TOIT);
  s += fenetre(1138, 380, 24, 30, true) + fenetre(1138, 450, 24, 30, n >= 1) + fenetre(1138, 516, 24, 30, n >= 2);
  s += p('M1140,586v-30h20v30z', '#0c0910');
  if (n >= 1) s += `<path d="M1188,420h26M1208,420v8" stroke="#2a2132" stroke-width="3"/>${r(1196, 428, 26, 20, '#d6c196', 'stroke="#0c0910" stroke-width="2"')}<path d="M1200,440l6,-6 5,4 7,-7" stroke="#7c1f14" stroke-width="1.5" fill="none"/>`;
  if (n >= 2) s += `<path d="M1170,300l34,-18" stroke="#3a3046" stroke-width="6" stroke-linecap="round"/>`;
  if (n >= 3) s += `<path d="M1150,282v-30" stroke="#2a2132" stroke-width="3"/>${p('M1150,254l26,6 -26,8z', '#c9a14a')}${lueur(1150, 395, 80, 0.4)}`;
  return s;
}

function peage(n: number): string {
  let s = p('M1240,590C1320,582 1460,584 1600,588V640H1240Z', '#20253f');
  for (let k = 0; k < 9; k++) s += `<path d="M${1270 + k * 36},${606 + (k % 3) * 9}h${18 + (k % 2) * 10}" stroke="#7a82c0" stroke-width="1.5" opacity=".35"/>`;
  s += p('M1290,600L1290,566H1560V600H1520Q1505,572 1460,572Q1415,572 1400,600H1380Q1365,580 1340,580Q1315,580 1300,600Z', '#241c2e');
  if (n === 0) {
    s += p('M1294,566V452L1308,440L1318,452L1332,436L1346,452L1356,446V566Z', MUR_PROCHE) + fenetre(1314, 486, 18, 24, false);
    return s + `<path d="M1360,570l60,14" stroke="${BOIS}" stroke-width="6" stroke-linecap="round"/>`;
  }
  s += r(1294, 440, 62, 126, MUR_PROCHE);
  for (let k = 0; k < 4; k++) s += r(1294 + k * 17, 428, 11, 14, MUR_PROCHE);
  s += fenetre(1314, 470, 20, 26, true) + p('M1312,566v-34q13,-12 26,0v34z', '#0c0910');
  s += `<path d="M1360,548h96" stroke="#c9a14a" stroke-width="6"/><path d="M1360,548h96" stroke="#7c1f14" stroke-width="6" stroke-dasharray="12 12"/>`;
  s += r(1356, 540, 8, 30, BOIS) + lueur(1366, 530, 26, 0.7) + r(1362, 524, 8, 10, '#f3c46a');
  if (n >= 2) { s += r(1520, 470, 44, 96, MUR_PROCHE); for (let k = 0; k < 3; k++) s += r(1520 + k * 16, 460, 10, 12, MUR_PROCHE); s += fenetre(1532, 494, 18, 24, true); }
  if (n >= 3) s += `<path d="M1325,428v-36" stroke="#2a2132" stroke-width="3"/>${p('M1325,394l26,6 -26,8z', '#7c1f14')}`;
  return s;
}

/** La scène entière, bâtiments à leur palier. Chaque bâtiment est un groupe `data-batiment` cliquable. */
export function sceneDuHameau(paliers: Record<IdBatiment, number>): string {
  const al = alea(17);
  let ciel = '';
  for (let k = 0; k < 160; k++) { const x = al() * LARGEUR, y = al() * 260, t = al(); ciel += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(0.4 + t * t * 1.4).toFixed(2)}" fill="#f4ead2" opacity="${((0.2 + al() * 0.7) * (1 - y / 320)).toFixed(2)}"/>`; }
  const crete = (y0: number, amp: number, pas: number, graine: number) => { const q = alea(graine); let d = `M0,${HAUTEUR}L0,${y0}`; for (let x = 0; x <= LARGEUR + pas; x += pas) d += `L${x},${y0 - q() * amp}L${x + pas * 0.5},${y0 - q() * amp * 0.4}`; return `${d}L${LARGEUR},${HAUTEUR}Z`; };
  let foret = '';
  for (let k = 0; k < 120; k++) { const x = al() * LARGEUR; foret += sapin(x, 512 + al() * 12, 50 + al() * 70, k % 2 ? '#1a1330' : '#160f28'); }
  let maisons = '';
  for (let k = 0; k < 18; k++) {
    const x = 20 + k * 100 + al() * 40, w = 40 + al() * 30, h = 30 + al() * 26, y = 548;
    maisons += p(`M${x},${y}V${y - h}L${x + w / 2},${y - h - 22}L${x + w},${y - h}V${y}Z`, '#1f1730');
    if (al() > 0.45) maisons += r(x + w * 0.35, y - h * 0.6, 7, 9, '#d79a4c', 'opacity=".75"');
  }
  let herbes = '';
  for (let k = 0; k < 160; k++) { const x = al() * LARGEUR, y = 612 + al() * 100; herbes += `<path d="M${x.toFixed(0)},${y.toFixed(0)}q2,-${(5 + al() * 7).toFixed(0)} 4,0" stroke="#08060b" stroke-width="1.2" fill="none"/>`; }
  const bat = (id: IdBatiment, dessin: string) => `<g class="bat${enRuine(paliers, id) ? ' ruine' : ''}" data-a="batiment" data-id="${id}">${dessin}</g>`;
  return `<svg class="scene" viewBox="0 0 ${LARGEUR} ${HAUTEUR}" preserveAspectRatio="xMidYMax slice" role="img" aria-label="Le hameau de Grisefosse">
  <defs>
    <linearGradient id="ciel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d0b1e"/><stop offset=".38" stop-color="#241a3e"/><stop offset=".62" stop-color="#5a3a5e"/><stop offset=".78" stop-color="#b0664a"/><stop offset=".86" stop-color="#e3a25c"/></linearGradient>
    <linearGradient id="sol" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d1626"/><stop offset=".4" stop-color="#110c17"/><stop offset="1" stop-color="#060408"/></linearGradient>
    <radialGradient id="lueur"><stop offset="0" stop-color="#ffdf9a" stop-opacity=".9"/><stop offset=".2" stop-color="#ffb65a" stop-opacity=".5"/><stop offset=".5" stop-color="#e07a2c" stop-opacity=".18"/><stop offset="1" stop-color="#e07a2c" stop-opacity="0"/></radialGradient>
    <radialGradient id="soleil"><stop offset="0" stop-color="#ffe3a0" stop-opacity=".95"/><stop offset=".25" stop-color="#ffb35e" stop-opacity=".5"/><stop offset="1" stop-color="#e0703a" stop-opacity="0"/></radialGradient>
    <filter id="flou" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="14"/></filter>
  </defs>
  <rect width="${LARGEUR}" height="${HAUTEUR}" fill="url(#ciel)"/>
  ${ciel}
  <circle cx="900" cy="520" r="260" fill="url(#soleil)"/>
  <path d="M1440,96A34,34 0 1 0 1474,130A26,26 0 0 1 1440,96Z" fill="#f3ecd4" opacity=".9"/>
  ${p(crete(470, 110, 120, 3), '#3a2c52')}${p(crete(492, 50, 160, 8), '#2a2040')}
  <rect y="470" width="${LARGEUR}" height="70" fill="#d08a5a" opacity=".18" filter="url(#flou)"/>
  ${foret}${maisons}
  <rect y="584" width="${LARGEUR}" height="${HAUTEUR - 584}" fill="url(#sol)"/>
  ${p('M0,612C300,596 520,590 800,592C1080,594 1400,600 1800,612V646C1400,634 1080,628 800,626C520,624 300,630 0,646Z', '#2a2130', 'opacity=".75"')}
  ${bat('memorial', jardinDeMorr(paliers.memorial))}
  ${bat('temple', chapelle(paliers.temple))}
  ${bat('relais', relais(paliers.relais))}
  ${bat('forge', forge(paliers.forge))}
  ${bat('salle', salleDArmes(paliers.salle))}
  <g transform="translate(200,0)">${bat('cartographe', cartographe(paliers.cartographe))}${bat('peage', peage(paliers.peage))}</g>
  ${herbes}
  ${sapin(-30, 760, 420, '#040306')}${sapin(LARGEUR + 30, 770, 380, '#040306')}
</svg>`;
}
