import type { FamilleDeCouches } from '../types';
import { alea, n } from '../formes';

/**
 * L'image de l'accueil (#3935) : la compagnie de dos sur la crête, Altdorf au couchant, la comète à deux queues. Les
 * tracés sont ceux de sa maquette (`hotes/godot/cibles/propositions/sources/accueil-et-systeme/accueil.js`, et les
 * outils qu'elle charge, `gestes.js`, `lieux-et-nuit/commun.js`, `accueil-et-systeme/systeme.js`), tirés aux mêmes
 * graines, dans le cadre de la maquette (`W` × `H`) porté au cadre commun des couches.
 */
const ID = 'accueil-couchant';
const [W, H] = [1707, 780];

const defs: string[] = [];
const corps: string[] = [];
const attributs = (a: Record<string, string | number>) => Object.entries(a).map(([k, v]) => ` ${k}="${typeof v === 'number' ? n(v) : v}"`).join('');
const el = (sortie: string[], tag: string, a: Record<string, string | number>, dedans = '') => sortie.push(dedans ? `<${tag}${attributs(a)}>${dedans}</${tag}>` : `<${tag}${attributs(a)}/>`);
const jeton = (nom: string) => `var(--${nom})`;
const url = (nom: string) => `url(#${ID}-${nom})`;

type Arret = [number, string, number?];
const degrade = (nom: string, arrets: Arret[], a: Record<string, number> = { x1: 0, y1: 0, x2: 0, y2: 1 }, type = 'linearGradient') =>
  defs.push(`<${type} id="${ID}-${nom}"${attributs(a)}>` + arrets.map(([o, c, op]) => `<stop offset="${o}" stop-color="${jeton(c)}" stop-opacity="${op ?? 1}"/>`).join('') + `</${type}>`);
const radial = (nom: string, arrets: Arret[], a: Record<string, number> = { cx: 0.5, cy: 0.5, r: 0.5 }) => degrade(nom, arrets, a, 'radialGradient');
const flou = (nom: string, d: number) => defs.push(`<filter id="${ID}-${nom}" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="${d}"/></filter>`);

flou('f2', 2); flou('f4', 4); flou('f8', 8);
radial('coeur', [[0, 'comete-lueur', 0.95], [0.3, 'comete-lueur-or', 0.6], [1, 'comete-lueur-braise', 0]]);
radial('vignette', [[0.5, 'shadow-ink', 0], [0.82, 'shadow-ink', 0.4], [1, 'shadow-ink', 0.82]], { cx: 0.5, cy: 0.44, r: 0.74 });
degrade('bas', [[0, 'shadow-ink', 0], [1, 'shadow-ink', 0.85]]);
degrade('ciel', [[0, 'couchant-zenith'], [0.3, 'couchant-nuit'], [0.5, 'couchant-mauve'], [0.64, 'couchant-rose'], [0.76, 'couchant-orange'], [0.86, 'couchant-horizon'], [1, 'couchant-horizon']]);
radial('soleil', [[0, 'couchant-soleil', 1], [0.18, 'couchant-soleil-or', 0.8], [0.5, 'couchant-braise', 0.3], [1, 'couchant-braise', 0]]);
degrade('queue', [[0, 'comete-queue', 0.95], [0.25, 'comete-queue-or', 0.5], [1, 'comete-queue-fin', 0]], { x1: 0, y1: 1, x2: 1, y2: 0 });
degrade('fleuve', [[0, 'couchant-horizon'], [0.5, 'reik-rose'], [1, 'reik-ombre']]);
degrade('ombre-g', [[0, 'couchant-ombre', 0.9], [0.4, 'couchant-ombre', 0.5], [0.7, 'couchant-ombre', 0.12], [1, 'couchant-ombre', 0]], { x1: 0, y1: 0, x2: 1, y2: 0 });
degrade('brume', [[0, 'couchant-brume', 0], [0.6, 'couchant-brume', 0.32], [1, 'couchant-brume', 0]]);

const sapin = (sortie: string[], x: number, y: number, h: number, fill: string) => {
  const w = h * 0.34;
  let d = `M${n(x)},${n(y - h)}`;
  for (let k = 1; k <= 5; k++) { const [yy, ww] = [y - h + (h * 0.94 * k) / 5, (w * k) / 5]; d += `L${n(x + ww * 0.55)},${n(yy - h * 0.035)}L${n(x + ww)},${n(yy)}L${n(x + ww * 0.35)},${n(yy - h * 0.02)}`; }
  for (let k = 5; k >= 1; k--) { const [yy, ww] = [y - h + (h * 0.94 * k) / 5, (w * k) / 5]; d += `L${n(x - ww * 0.35)},${n(yy - h * 0.02)}L${n(x - ww)},${n(yy)}L${n(x - ww * 0.55)},${n(yy - h * 0.035)}`; }
  el(sortie, 'path', { d: `${d}L${n(x - w * 0.06)},${n(y - h * 0.06)}L${n(x - w * 0.06)},${n(y)}L${n(x + w * 0.06)},${n(y)}L${n(x + w * 0.06)},${n(y - h * 0.06)}Z`, fill: jeton(fill) });
};
const crete = (y0: number, amp: number, pas: number, graine: number, x0 = -20, x1 = W + 20) => {
  const r = alea(graine);
  const pts: [number, number][] = [];
  for (let x = x0; x <= x1; x += pas * (0.6 + r() * 0.8)) pts.push([x, y0 - r() * amp]);
  return pts;
};
const massif = (pts: [number, number][], bas: number, fill: string) =>
  el(corps, 'path', { d: `M${pts.map(([x, y]) => `${n(x)},${n(y)}`).join('L')}L${W + 20},${bas}L-20,${bas}Z`, fill: jeton(fill) });
const nuages = (bandes: number[][], fill: string, filtre = 'f8') =>
  el(corps, 'g', {}, bandes.map(([cx, cy, rx, ry, o]) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${jeton(fill)}" opacity="${o}" filter="${url(filtre)}"/>`).join(''));
const lisiere = (y: number, nombre: number, hMin: number, hMax: number, fill: string, graine: number, x0 = 0, x1 = W) => {
  const r = alea(graine);
  const a: [number, number, number][] = [];
  for (let i = 0; i < nombre; i++) a.push([x0 + r() * (x1 - x0), y + r() * 10, hMin + r() * (hMax - hMin)]);
  a.sort((p, q) => p[1] - q[1]).forEach(([x, yy, h]) => sapin(corps, x, yy, h, fill));
};
/** Une silhouette debout de dos, son pied en `(x, y)`, haute de `h`, sa coiffe et ce qu'elle porte (`extra`). */
const perso = (sortie: string[], x: number, y: number, h: number, coiffe: string, extra: string) => {
  const hy = -88;
  const coiffes: Record<string, string> = {
    chapeau: `<path d="M-19,${hy - 5}L19,${hy - 5}L18,${hy - 2}L-18,${hy - 2}ZM-9,${hy - 5}C-9,${hy - 20} 9,${hy - 20} 9,${hy - 5}Z"/>`,
    capuche: `<path d="M-12,${hy + 10}C-16,${hy - 6} -8,${hy - 17} 0,${hy - 17}C8,${hy - 17} 16,${hy - 6} 12,${hy + 10}Z"/>`,
    bonnet: `<path d="M-11,${hy - 2}C-11,${hy - 18} 11,${hy - 18} 11,${hy - 2}Z"/>`,
    casque: `<path d="M-12,${hy - 1}C-12,${hy - 17} 12,${hy - 17} 12,${hy - 1}ZM-1.5,${hy - 22}h3v8h-3z"/>`,
  };
  el(sortie, 'g', { transform: `translate(${x},${y}) scale(${n(h / 100)},${n(h / 100)})`, fill: jeton('couchant-silhouette') },
    `<path d="M-15,0C-18,-28 -19,-54 -13,-72C-9,-78 9,-78 13,-72C19,-54 18,-28 15,0Z"/><circle cx="0" cy="${hy}" r="10.5"/>${coiffes[coiffe]}${extra}`);
};
const altdorf = () => {
  const g: string[] = [];
  const fen: string[] = [];
  const r = alea(42);
  const base = 532;
  const toit = (x: number, w: number, h: number, t: number) => `M${n(x)},${base}V${n(base - h)}L${n(x + w / 2)},${n(base - h - t)}L${n(x + w)},${n(base - h)}V${base}Z`;
  for (let rangee = 0; rangee < 2; rangee++) for (let x = 742; x < 1590;) {
    const w = 14 + r() * 20, h = (rangee ? 20 : 40) + r() * (rangee ? 26 : 34) + 46 * Math.exp(-(((x - 1150) / 260) ** 2));
    el(g, 'path', { d: toit(x, w, h, w * (0.5 + r() * 0.5)), fill: jeton(rangee ? 'altdorf-toits' : 'altdorf-toits-clairs') });
    if (r() < 0.55) { const y = base - h * (0.35 + r() * 0.4); el(fen, 'rect', { x: x + w * 0.3, y, width: 2.6, height: 3.6, opacity: 0.55 + r() * 0.45 }); }
    x += w * (0.7 + r() * 0.4);
  }
  const tour = (x: number, w: number, h: number, fleche: number, c = 'altdorf-toits') => {
    el(g, 'path', { d: `M${x},${base}V${base - h}h${n(-w * 0.12)}v-6h${n(w * 1.24)}v6h${n(-w * 0.12)}V${base}Z`, fill: jeton(c) });
    el(g, 'path', { d: `M${n(x - w * 0.16)},${base - h - 6}L${x + w / 2},${base - h - fleche}L${n(x + w * 1.16)},${base - h - 6}Z`, fill: jeton(c) });
    el(fen, 'rect', { x: x + w / 2 - 1.5, y: base - h * 0.7, width: 3, height: 5, opacity: 0.9 });
  };
  tour(842, 20, 96, 44, 'altdorf-toits-clairs'); tour(948, 16, 118, 60); tour(1010, 26, 84, 34, 'altdorf-toits-clairs'); tour(1262, 18, 132, 70);
  tour(1340, 24, 96, 40, 'altdorf-toits-clairs'); tour(1452, 18, 88, 46); tour(1528, 22, 70, 30, 'altdorf-toits-clairs');
  el(g, 'path', { d: `M1096,${base}V${base - 118}L1140,${base - 164}L1184,${base - 118}V${base}Z` });
  el(g, 'path', { d: `M1082,${base}V${base - 150}L1093,${base - 214}L1104,${base - 150}V${base}ZM1176,${base}V${base - 150}L1187,${base - 214}L1198,${base - 150}V${base}Z` });
  el(g, 'path', { d: `M1091.5,${base - 226}h3v9h5v3h-5v10h-3v-10h-5v-3h5zM1185.5,${base - 226}h3v9h5v3h-5v10h-3v-10h-5v-3h5z` });
  el(fen, 'circle', { cx: 1140, cy: base - 112, r: 8, opacity: 0.95 });
  el(fen, 'path', { d: `M1118,${base - 40}v-30a4 4 0 0 1 8 0v30zM1136,${base - 40}v-36a4 4 0 0 1 8 0v36zM1154,${base - 40}v-30a4 4 0 0 1 8 0v30z`, opacity: 0.85 });
  el(g, 'path', { d: `M1380,${base}V${base - 84}h66V${base}Z`, fill: jeton('altdorf-toits-clairs') });
  el(g, 'path', { d: `M1386,${base - 84}C1386,${base - 128} 1440,${base - 128} 1440,${base - 84}ZM1411.5,${base - 132}h3v16h-3z`, fill: jeton('altdorf-toits-clairs') });
  let d = `M720,${base + 22}V${base - 14}`;
  for (let x = 720; x < 1610; x += 12) d += 'h7v-6h5v6';
  el(g, 'path', { d: `${d}V${base + 22}Z`, fill: jeton('altdorf-rempart') });
  [760, 900, 1040, 1300, 1470, 1596].forEach((x) => el(g, 'path', { d: `M${x},${base + 22}V${base - 30}h-3v-7h6v4h5v-4h6v4h5v-4h6v7h-3V${base + 22}Z`, fill: jeton('altdorf-rempart') }));
  el(g, 'path', { d: `M1150,${base + 22}V${base - 44}h-4v-8h8v5h7v-5h8v5h7v-5h8v5h7v-5h8v8h-4V${base + 22}Z`, fill: jeton('altdorf-rempart') });
  const porte = `<path d="M1168,${base + 22}v-20a11 11 0 0 1 22 0v20z" fill="${jeton('altdorf-porte')}"/>`;
  [[770, 6], [912, 8], [1050, 5], [1311, 7], [1480, 6]].forEach(([x, dy]) => el(fen, 'rect', { x, y: base - 16 - dy, width: 3, height: 5, opacity: 0.8 }));
  el(corps, 'g', { fill: jeton('altdorf-toits') }, g.join(''));
  el(corps, 'g', { fill: jeton('altdorf-fenetre') }, fen.join(''));
  corps.push(porte);
};

el(corps, 'rect', { width: W, height: H, fill: url('ciel') });
{
  const r = alea(11);
  const semis: string[] = [];
  for (let i = 0; i < 170; i++) {
    const y = r() * 330;
    const cx = r() * W, rayon = 0.5 + r() * 1.1, opacite = (0.25 + r() * 0.6) * (1 - (y / 330) * 0.8);
    el(semis, 'circle', { cx, cy: y, r: rayon, fill: jeton('etoile'), opacity: String(Math.round(opacite * 100) / 100) });
  }
  el(corps, 'g', {}, semis.join(''));
}
el(corps, 'g', { transform: 'translate(1238,150) rotate(-8)' }, [
  `<path d="M0,0C70,-34 190,-78 330,-96C210,-58 90,-22 0,6Z" fill="${url('queue')}" filter="${url('f2')}"/>`,
  `<path d="M0,0C80,-6 210,-10 350,2C220,10 90,12 0,7Z" fill="${url('queue')}" filter="${url('f2')}"/>`,
  `<circle cx="0" cy="3" r="26" fill="${url('coeur')}"/>`,
  `<circle cx="0" cy="3" r="5" fill="${jeton('comete-coeur')}"/>`,
].join(''));
nuages([[420, 250, 380, 14, 0.5], [980, 300, 460, 16, 0.55], [1500, 262, 300, 12, 0.45], [700, 352, 330, 12, 0.5], [1320, 372, 380, 13, 0.5], [200, 392, 300, 12, 0.4]], 'couchant-nuee');
nuages([[1010, 420, 420, 10, 0.5], [1420, 438, 300, 8, 0.45], [640, 446, 260, 8, 0.4]], 'couchant-nuee-cuivre', 'f4');
el(corps, 'ellipse', { cx: 1090, cy: 508, rx: 560, ry: 250, fill: url('soleil') });
massif(crete(470, 120, 60, 21), 600, 'couchant-montagne-loin');
massif(crete(500, 60, 46, 8), 600, 'couchant-montagne');
el(corps, 'rect', { x: 0, y: 440, width: W, height: 90, fill: url('brume') });
altdorf();
const REIK = 'M560,556C760,548 1000,550 1707,552V600C1300,596 900,610 520,640Z';
el(corps, 'path', { d: REIK, fill: url('fleuve') });
el(corps, 'path', { d: REIK, fill: jeton('reik-voile'), opacity: 0.28 });
{
  const r = alea(9);
  const reflets: string[] = [];
  for (let i = 0; i < 46; i++) {
    const y = 560 + r() * 44, x = 900 + (r() - 0.5) * (360 + (y - 560) * 9), w = 8 + r() * 26;
    el(reflets, 'path', { d: `M${n(x)},${n(y)}h${n(w)}`, 'stroke-width': 0.8 + r() * 1.2, opacity: String(Math.round((0.3 + r() * 0.7) * 100) / 100) });
  }
  el(corps, 'g', { stroke: jeton('reik-reflet'), 'stroke-linecap': 'round', opacity: 0.55 }, reflets.join(''));
  el(corps, 'g', { fill: jeton('altdorf-rempart') }, [
    '<path d="M1084,553h196v7h-196zM1096,560h9v22h-9zM1140,560h9v24h-9zM1184,560h9v24h-9zM1228,560h9v22h-9zM1262,560h10v18h-10z"/>',
    `<path d="M1105,560a17.5 13 0 0 1 35 0zM1149,560a17.5 13 0 0 1 35 0zM1193,560a17.5 13 0 0 1 35 0z" fill="none" stroke="${jeton('altdorf-rempart')}" stroke-width="3"/>`,
    '<path d="M820,584h46l-6,7h-34zM840,584v-22l14,18zM1420,574h34l-5,6h-24zM1434,574v-17l11,14z"/>',
  ].join(''));
}
massif([[-20, 590], [200, 580], [420, 596], [640, 612], [860, 640], [1100, 632], [1300, 618], [1500, 604], [1727, 596]], 800, 'couchant-rive');
lisiere(606, 46, 30, 62, 'couchant-lisiere', 3, 0, 700);
lisiere(624, 30, 28, 52, 'couchant-lisiere', 13, 1340, 1707);
el(corps, 'path', { d: 'M-20,700C200,640 420,640 640,664C860,690 1040,700 1200,676C1380,650 1540,640 1727,660V800H-20Z', fill: jeton('couchant-silhouette') });
el(corps, 'path', { d: 'M1040,800C1100,740 1180,700 1262,680C1230,700 1190,740 1170,800Z', fill: jeton('couchant-route'), opacity: 0.9 });
el(corps, 'path', { d: 'M1262,680C1300,670 1330,664 1352,660', stroke: jeton('couchant-route'), 'stroke-width': 5, fill: 'none', opacity: 0.8 });
{
  const N = jeton('couchant-silhouette');
  const baton = `<path d="M17,-70L27,-116" stroke="${N}" stroke-width="3" fill="none"/><circle cx="27.5" cy="-118" r="3.5"/>`;
  const arc = `<path d="M-21,-98C-36,-72 -36,-34 -21,-8" stroke="${N}" stroke-width="2.4" fill="none"/><path d="M-21,-98L-21,-8" stroke="${N}" stroke-width="0.8" fill="none"/>`;
  const epee = `<path d="M13,-50L31,-2" stroke="${N}" stroke-width="3" fill="none"/><path d="M9,-46L18,-50" stroke="${N}" stroke-width="3" fill="none"/>`;
  const sac = '<path d="M-17,-70C-23,-66 -23,-46 -17,-40L-6,-40L-6,-70Z"/>';
  const compagnie: string[] = [];
  perso(compagnie, 742, 686, 128, 'bonnet', arc);
  perso(compagnie, 806, 692, 116, 'capuche', sac);
  perso(compagnie, 868, 696, 124, 'chapeau', baton);
  perso(compagnie, 936, 700, 134, 'casque', epee);
  compagnie.push(`<path d="M1010,704v-24a9 9 0 0 1 18 0v24z" fill="${N}"/>`);
  el(corps, 'g', {}, compagnie.join(''));
}
{
  const sapins: string[] = [];
  [[-10, 800, 640], [86, 800, 520], [182, 800, 420], [270, 800, 300], [1700, 800, 330], [1640, 800, 250], [1580, 800, 170]].forEach(([x, y, h]) => sapin(sapins, x, y, h, 'couchant-sapin'));
  el(corps, 'g', {}, sapins.join(''));
}
el(corps, 'rect', { x: 0, y: 0, width: 860, height: H, fill: url('ombre-g') });
el(corps, 'rect', { width: W, height: H, fill: url('vignette'), opacity: 0.8 });
el(corps, 'rect', { x: 0, y: 660, width: W, height: 120, fill: url('bas'), opacity: 0.7 });

export const couches: FamilleDeCouches = [
  {
    id: 'accueil-couchant',
    label: 'Altdorf au couchant',
    svg: `<defs>${defs.join('')}</defs><g transform="scale(${1600 / W} ${900 / H})">${corps.join('')}</g>`,
  },
];
