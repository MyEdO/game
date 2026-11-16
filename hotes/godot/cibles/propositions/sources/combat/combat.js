/* Écran de combat, image d'intention (#3935). Deux états : « tour » (le tour d'un héros) et « jet » (le jet d'attaque
   qui se résout). Maquette hors du jeu : le champ de bataille est dessiné, il ne prétend pas être le rendu du moteur. */
const NS = 'http://www.w3.org/2000/svg';
const ECRAN = document.getElementById('ecran');
/* un état neuf se range sous l'un des deux socles : le meuble de l'actif (« tour ») ou le bandeau (« jet ») */
const NEUFS = {
  'tour-adverse': ['tour', 'adverse'], 'cible-survolee': ['tour', 'cible'], 'journal-ouvert': ['tour', 'journal'], 'fiche-au-clic': ['tour', 'fiche'],
  'jet-avant-le-de': ['jet', 'avant'], 'jet-de-defense': ['jet', 'defense'], incantation: ['jet', 'incantation'], 'coup-critique': ['jet', 'critique'],
  'debut-du-round': ['jet', 'round'], 'fin-victoire': ['jet', 'victoire'], 'fin-defaite': ['jet', 'defaite'],
};
const [ETAT, VAR] = NEUFS[ECRAN.dataset.etat] ?? [ECRAN.dataset.etat, ECRAN.dataset.variante || ''];
ECRAN.dataset.socle = ETAT;
const FIN = VAR === 'victoire' || VAR === 'defaite';
const ADVERSE = VAR === 'adverse' || VAR === 'defense';
const SURVOL = ETAT === 'tour' && (!VAR || VAR === 'cible');
const W = 1707, H = 780;
const el = (parent, tag, attrs = {}, text) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (text != null) e.textContent = text; parent.appendChild(e); return e; };
const alea = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const melange = (c1, c2, t) => { const p = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)); const a = p(c1), b = p(c2); return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
const svgUrl = (s) => `url("data:image/svg+xml,${encodeURIComponent(s)}")`;

/* textures : bois et parchemin, en bruit (les mêmes que l'écran de voyage) */
document.documentElement.style.setProperty('--tex-bois', svgUrl(`<svg xmlns='${NS}' width='600' height='300'><filter id='f' x='0' y='0' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='0.006 0.22' numOctaves='4' seed='7' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.55  0 0 0 0 0.42  0 0 0 0 0.30  0.9 0.9 0.9 0 -0.75'/></filter><rect width='100%' height='100%' fill='#c9a57a'/><rect width='100%' height='100%' filter='url(#f)'/></svg>`));
document.documentElement.style.setProperty('--tex-parchemin', svgUrl(`<svg xmlns='${NS}' width='500' height='400'><filter id='a' x='0' y='0' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='0.012' numOctaves='4' seed='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.45  0 0 0 0 0.32  0 0 0 0 0.16  0.9 0.9 0.9 0 -0.95'/></filter><filter id='b' x='0' y='0' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' seed='5' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.35  0 0 0 0 0.25  0 0 0 0 0.12  0 0 0 0.22 0'/></filter><rect width='100%' height='100%' fill='#fff'/><rect width='100%' height='100%' filter='url(#a)'/><rect width='100%' height='100%' filter='url(#b)'/></svg>`));

/* ───────── le champ de bataille : une cour de ruine, en isométrie ───────── */
const S = document.getElementById('scene');
const defs = el(S, 'defs');
const grad = (id, stops, attrs = { x1: 0, y1: 0, x2: 0, y2: 1 }, type = 'linearGradient') => { const g = el(defs, type, { id, ...attrs }); stops.forEach(([o, c, a]) => el(g, 'stop', { offset: o, 'stop-color': c, 'stop-opacity': a ?? 1 })); return g; };
const flou = (id, d) => { const f = el(defs, 'filter', { id, x: '-30%', y: '-30%', width: '160%', height: '160%' }); el(f, 'feGaussianBlur', { stdDeviation: d }); };
flou('f1', 0.8); flou('f2', 2); flou('f6', 6); flou('f18', 18);
grad('nuit', [[0, '#0a0c16'], [.5, '#12131f'], [1, '#15131a']]);
grad('feu', [[0, '#ffdf9a', .85], [.16, '#ffb65a', .55], [.45, '#e07a2c', .2], [1, '#e07a2c', 0]], { cx: .5, cy: .5, r: .5 }, 'radialGradient');
grad('coeur', [[0, '#fff3c8', .95], [.3, '#ffc76e', .6], [1, '#ff9a3a', 0]], { cx: .5, cy: .5, r: .5 }, 'radialGradient');
grad('vignette', [[.5, '#000', 0], [.82, '#000', .4], [1, '#000', .8]], { cx: .5, cy: .44, r: .74 }, 'radialGradient');
grad('haut', [[0, '#080a14', .78], [1, '#080a14', 0]]);
grad('bas', [[0, '#000', 0], [1, '#000', .82]]);
grad('gauche', [[0, '#000', .62], [1, '#000', 0]], { x1: 0, y1: 0, x2: 1, y2: 0 });
grad('droite', [[0, '#000', .7], [.55, '#000', .35], [1, '#000', 0]], { cx: .5, cy: .5, r: .5 }, 'radialGradient');
grad('froid', [[0, '#2a3a6a', 0], [1, '#2a3a6a', .55]], { cx: .5, cy: .5, r: .5 }, 'radialGradient');
const teinte = (id, clair, sombre) => grad(id, [[0, clair], [.55, sombre], [1, melange(sombre, '#000000', .35)]], { x1: 0, y1: 0, x2: 1, y2: 1 });
teinte('t-robe', '#7c88ad', '#2b3350'); teinte('t-cuir', '#b98a58', '#5a3d2a'); teinte('t-orc', '#7b8f5c', '#2f3a26'); teinte('t-gob', '#8ea064', '#3b4a2b');
teinte('t-bois', '#8a6a44', '#3f2c1a');

const A = 46, B = 23, OX = 608, OY = -84;
const P = (i, j) => [OX + (i - j) * A, OY + (i + j) * B];
const losange = (x, y, a = A, b = B) => `M${x},${y - b}L${x + a},${y}L${x},${y + b}L${x - a},${y}Z`;

// l'extérieur : la nuit et la lisière, derrière les murs
el(S, 'rect', { width: W, height: H, fill: 'url(#nuit)' });
{
  const r = alea(3); const murY = (x) => (x < 838 ? 54 - (x - 608) / 2 : -176 + (x - 608) / 2);
  const arbres = []; for (let n = 0; n < 150; n++) { const x = r() * W; const y = murY(x) - 26 - r() * 170; if (y > -10) arbres.push([x, y, 46 + r() * 70, r()]); }
  arbres.sort((p, q) => p[1] - q[1]);
  for (const [x, y, h, t] of arbres) {
    const w = h * .34; let d = `M${x},${y - h}`; const n = 5;
    for (let k = 1; k <= n; k++) { const yy = y - h + h * .94 * k / n, ww = w * k / n; d += `L${x + ww * .55},${yy - h * .035}L${x + ww},${yy}L${x + ww * .35},${yy - h * .02}`; }
    for (let k = n; k >= 1; k--) { const yy = y - h + h * .94 * k / n, ww = w * k / n; d += `L${x - ww * .35},${yy - h * .02}L${x - ww},${yy}L${x - ww * .55},${yy - h * .035}`; }
    el(S, 'path', { d: d + 'Z', fill: melange('#0c0e18', '#1a1d2b', t * .8) });
  }
  el(S, 'rect', { width: W, height: 380, fill: 'url(#haut)' });
}

// le sol : des dalles
const dansLaCour = (i, j) => i >= 4 && j >= -1;
{
  const r = alea(17); const g = el(S, 'g', { stroke: '#1b1921', 'stroke-width': 1.3, 'stroke-linejoin': 'round' });
  for (let i = 4; i < 44; i++) for (let j = -1; j < 44; j++) {
    const [x, y] = P(i, j); if (x < -A || x > W + A || y < -B || y > H + B) continue;
    const t = r(); const mousse = r() < .13;
    el(g, 'path', { d: losange(x, y), fill: mousse ? melange('#4a4f47', '#565b4f', t) : melange('#45434f', '#5d5a66', t) });
    const k = r();
    if (k < .22) el(g, 'path', { d: `M${x - A / 2},${y - B / 2}L${x + A / 2},${y + B / 2}`, opacity: .8 });
    else if (k < .4) el(g, 'path', { d: `M${x + A / 2},${y - B / 2}L${x - A / 2},${y + B / 2}`, opacity: .8 });
    else if (k < .47) el(g, 'path', { d: `M${x - 14},${y - 4}l9,5l-3,6l8,4`, fill: 'none', opacity: .7, 'stroke-width': 1 });
    if (r() < .08) el(g, 'path', { d: `M${x - 10 + r() * 20},${y + 4}q2,-9 4,0q2,-7 4,0`, fill: 'none', stroke: '#6a7355', 'stroke-width': 1.2, opacity: .8 });
  }
}
// le brasero éclaire la cour
const FEU = P(8, 5);
el(S, 'ellipse', { cx: FEU[0] + 6, cy: FEU[1] + 60, rx: 520, ry: 290, fill: 'url(#feu)', style: 'mix-blend-mode:screen' });

el(S, 'ellipse', { cx: FEU[0] + 6, cy: FEU[1] + 100, rx: 1500, ry: 800, fill: 'url(#froid)', style: 'mix-blend-mode:soft-light' });

// ce que le tour dessine au sol
const HEROS = ETAT === 'tour' || VAR === 'incantation' || VAR === 'defense' ? [10, 8] : [13, 6];
const ORC = ADVERSE ? [11, 7] : [14, 6], BERTA = [10, 9], GOBELIN = [12, -1];
const OCCUPE = new Set(['10,8', '10,9', '14,6', '8,5', '5,10', '6,11', '12,3', '13,3']);
{
  const g = el(S, 'g');
  if (VAR === 'adverse' || VAR === 'round' || FIN) {
    // rien au sol : personne ne vise ni ne marche
  } else if (ETAT === 'tour') {
    // les cases atteignables : une teinte et un liseré
    for (let i = 6; i <= 14; i++) for (let j = 4; j <= 12; j++) if (!OCCUPE.has(`${i},${j}`)) { const [x, y] = P(i, j); el(g, 'path', { d: losange(x, y, A - 1.5, B - .8), fill: '#efe2bd', opacity: .105 }); }
    const [cx, cy] = P(10, 8);
    el(g, 'path', { d: losange(cx, cy, 9 * A, 9 * B), fill: 'none', stroke: '#000', 'stroke-width': 5, opacity: .35, filter: 'url(#f2)' });
    el(g, 'path', { d: losange(cx, cy, 9 * A, 9 * B), fill: 'none', stroke: '#efe2bd', 'stroke-width': 1.6, opacity: .8 });
    if (SURVOL) {
    const pas = [[10, 8], [11, 7], [12, 6], [13, 6]].map(([i, j]) => P(i, j));
    const d = 'M' + pas.map((p) => p.join(',')).join('L');
    el(g, 'path', { d, fill: 'none', stroke: '#000', 'stroke-width': 7, opacity: .4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', filter: 'url(#f1)' });
    el(g, 'path', { d, fill: 'none', stroke: '#f6ecd0', 'stroke-width': 3.2, 'stroke-dasharray': '1 10', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    const [ax, ay] = pas[3];
    el(g, 'path', { d: losange(ax, ay, A - 3, B - 1.5), fill: '#efe2bd', 'fill-opacity': .16, stroke: '#f6ecd0', 'stroke-width': 2 });
    }
  } else {
    const [ax, ay] = P(...HEROS);
    el(g, 'path', { d: losange(ax, ay, A - 3, B - 1.5), fill: '#efe2bd', 'fill-opacity': .14, stroke: '#f6ecd0', 'stroke-width': 2 });
  }
  // la case de la cible
  const [ox, oy] = P(...ORC);
  if (SURVOL || (ETAT === 'jet' && VAR !== 'round' && !FIN)) el(g, 'path', { d: losange(ox, oy, A - 3, B - 1.5), fill: '#9c2a1a', 'fill-opacity': .34, stroke: '#d2553a', 'stroke-width': 2.4 });
}

// une boîte isométrique : dessus, face sud-ouest (éclairée), face sud-est (à l'ombre)
function boite(g, cx, cy, a, b, h, [dessus, so, se], assises = 0) {
  const tr = { stroke: '#15131a', 'stroke-width': .9, 'stroke-linejoin': 'round' };
  el(g, 'path', { d: `M${cx - a},${cy - h}L${cx},${cy + b - h}L${cx},${cy + b}L${cx - a},${cy}Z`, fill: so, ...tr });
  el(g, 'path', { d: `M${cx},${cy + b - h}L${cx + a},${cy - h}L${cx + a},${cy}L${cx},${cy + b}Z`, fill: se, ...tr });
  el(g, 'path', { d: `M${cx},${cy - b - h}L${cx + a},${cy - h}L${cx},${cy + b - h}L${cx - a},${cy - h}Z`, fill: dessus, ...tr });
  for (let k = 1; k <= assises; k++) { const t = h * k / (assises + 1); el(g, 'path', { d: `M${cx - a},${cy - h + t}L${cx},${cy + b - h + t}L${cx + a},${cy - h + t}`, fill: 'none', stroke: '#15131a', 'stroke-width': .8, opacity: .55 }); }
}
const PIERRE = ['#8a8694', '#5c5966', '#33313c'];
const pierre = (t) => PIERRE.map((c) => melange(c, '#2a2833', t * .35));

// les murs bas, au fond
{
  const r = alea(29); const g = el(S, 'g'); const murs = [];
  for (let i = 4; i <= 24; i++) { if (i === 8 || i === 9) continue; let h = 34 + r() * 6; if (i === 7 || i === 10) h = 80; if (i === 15) h = 24; if (i === 16) h = 13; if (i === 17) h = 30; murs.push([i, -2, h]); }
  for (let j = -2; j <= 21; j++) { let h = 34 + r() * 6; if (j === -2) h = 92; if (j === 3) h = 74; if (j === 7) h = 20; if (j === 8) h = 11; if (j === 9) h = 28; if (j === 14) h = 70; murs.push([3, j, h]); }
  murs.sort((p, q) => (p[0] + p[1]) - (q[0] + q[1]));
  for (const [i, j, h] of murs) { const [x, y] = P(i, j); boite(g, x, y, A, B, h, pierre(r()), h > 30 ? 3 : 1); }
}

{ const [x, y] = P(10, -2); const g = el(S, 'g'); const t = y - 80;
  el(g, 'path', { d: `M${x - 39},${t + 9}L${x - 7},${t + 25}L${x - 7},${t + 70}L${x - 15},${t + 60}L${x - 23},${t + 68}L${x - 31},${t + 54}L${x - 39},${t + 58}Z`, fill: '#7c1f14', stroke: '#2a0b06', 'stroke-width': .9 });
  el(g, 'path', { d: `M${x - 39},${t + 9}L${x - 7},${t + 25}L${x - 7},${t + 31}L${x - 39},${t + 15}Z`, fill: '#d9c69b', opacity: .85 });
  el(g, 'path', { d: `M${x - 28},${t + 20}L${x - 28},${t + 58}M${x - 17},${t + 26}L${x - 17},${t + 62}`, stroke: '#4a110a', 'stroke-width': 2.5, opacity: .6 });
}

// les objets et les pions, du fond vers l'avant
const objets = [];
const objet = (i, j, dessine) => objets.push({ z: i + j, dessine, p: P(i, j) });
objet(8, 5, (g, [x, y]) => { // le brasero
  el(g, 'ellipse', { cx: x, cy: y + 3, rx: 20, ry: 9, fill: '#000', opacity: .5, filter: 'url(#f2)' });
  el(g, 'path', { d: `M${x - 13},${y + 2}L${x - 5},${y - 30}M${x + 13},${y + 2}L${x + 5},${y - 30}M${x},${y + 7}L${x},${y - 30}`, stroke: '#141214', 'stroke-width': 3.2, 'stroke-linecap': 'round' });
  el(g, 'path', { d: `M${x - 19},${y - 40}Q${x},${y - 12} ${x + 19},${y - 40}Z`, fill: '#1b181a', stroke: '#0a0909', 'stroke-width': 1 });
  el(g, 'ellipse', { cx: x, cy: y - 40, rx: 19, ry: 6.5, fill: '#3a1c0c', stroke: '#0a0909', 'stroke-width': 1 });
  el(g, 'circle', { cx: x, cy: y - 52, r: 62, fill: 'url(#coeur)', style: 'mix-blend-mode:screen' });
  el(g, 'path', { d: `M${x - 11},${y - 41}C${x - 15},${y - 56} ${x - 5},${y - 60} ${x - 6},${y - 74}C${x + 2},${y - 66} ${x + 1},${y - 58} ${x + 5},${y - 66}C${x + 13},${y - 56} ${x + 13},${y - 48} ${x + 10},${y - 41}Z`, fill: '#f08a2c' });
  el(g, 'path', { d: `M${x - 6},${y - 41}C${x - 8},${y - 52} ${x - 1},${y - 54} ${x - 1},${y - 63}C${x + 6},${y - 55} ${x + 7},${y - 48} ${x + 5},${y - 41}Z`, fill: '#ffd778' });
});
objet(5, 10, (g, [x, y]) => { // la colonne brisée
  el(g, 'ellipse', { cx: x + 6, cy: y + 5, rx: 26, ry: 11, fill: '#000', opacity: .45, filter: 'url(#f2)' });
  el(g, 'path', { d: `M${x - 22},${y - 4}L${x - 22},${y + 2}A22,10 0 0 0 ${x + 22},${y + 2}L${x + 22},${y - 4}Z`, fill: '#4a4753', stroke: '#15131a', 'stroke-width': .9 });
  el(g, 'path', { d: `M${x - 16},${y - 66}L${x - 16},${y - 4}A16,7 0 0 0 ${x + 16},${y - 4}L${x + 16},${y - 52}L${x + 8},${y - 60}L${x + 2},${y - 50}L${x - 6},${y - 64}Z`, fill: '#6a6773', stroke: '#15131a', 'stroke-width': .9 });
  el(g, 'path', { d: `M${x + 3},${y - 50}L${x + 3},${y + 3}M${x + 10},${y - 56}L${x + 10},${y + 1}`, stroke: '#33313c', 'stroke-width': 5, opacity: .55 });
  el(g, 'path', { d: `M${x - 9},${y - 62}L${x - 9},${y + 1}M${x - 3},${y - 56}L${x - 3},${y + 2}`, stroke: '#8f8b99', 'stroke-width': 2, opacity: .5 });
});
objet(6, 11, (g, [x, y]) => { // son tambour tombé
  el(g, 'ellipse', { cx: x + 4, cy: y + 6, rx: 24, ry: 9, fill: '#000', opacity: .4, filter: 'url(#f2)' });
  el(g, 'path', { d: `M${x - 20},${y - 8}L${x + 8},${y + 6}A9,13 0 0 0 ${x + 12},${y - 18}L${x - 14},${y - 30}A9,12 0 0 0 ${x - 20},${y - 8}Z`, fill: '#5c5966', stroke: '#15131a', 'stroke-width': .9 });
  el(g, 'ellipse', { cx: x + 10, cy: y - 6, rx: 8, ry: 12.5, fill: '#7d7987', stroke: '#15131a', 'stroke-width': .9, transform: `rotate(-12 ${x + 10} ${y - 6})` });
});
for (const [i, j, h] of [[12, 3, 27], [13, 3, 20]]) objet(i, j, (g, [x, y]) => boite(g, x, y, A, B, h, pierre(.2), 1)); // un muret
objet(16, 9, (g, [x, y]) => { // des caisses
  el(g, 'ellipse', { cx: x + 6, cy: y + 8, rx: 40, ry: 16, fill: '#000', opacity: .4, filter: 'url(#f2)' });
  const bois = ['#8a6a44', '#6a4c2e', '#3f2c1a'];
  boite(g, x - 10, y - 2, 27, 13.5, 32, bois, 2); boite(g, x + 20, y + 9, 22, 11, 24, bois, 1); boite(g, x - 8, y - 34, 19, 9.5, 20, bois, 1);
});
objet(17, 9, (g, [x, y]) => { // un tonneau
  el(g, 'ellipse', { cx: x + 14, cy: y + 8, rx: 22, ry: 9, fill: '#000', opacity: .4, filter: 'url(#f2)' });
  el(g, 'path', { d: `M${x - 4},${y - 36}Q${x - 8},${y - 16} ${x - 4},${y + 3}A15,6.500 0 0 0 ${x + 26},${y + 3}Q${x + 30},${y - 16} ${x + 26},${y - 36}Z`, fill: 'url(#t-bois)', stroke: '#15100a', 'stroke-width': .9 });
  el(g, 'ellipse', { cx: x + 11, cy: y - 36, rx: 15, ry: 6.5, fill: '#6a4c2e', stroke: '#15100a', 'stroke-width': .9 });
  el(g, 'path', { d: `M${x - 6},${y - 24}A17,7 0 0 0 ${x + 28},${y - 24}M${x - 6},${y - 8}A17,7 0 0 0 ${x + 28},${y - 8}`, fill: 'none', stroke: '#1d1b1a', 'stroke-width': 2.4 });
});

const path = (f, d, fill, extra = {}) => el(f, 'path', { d, fill, ...extra });
const FIGURES = {
  ilyanwe: (f) => {
    el(f, 'path', { d: 'M15,3L18,-92', stroke: '#6b5234', 'stroke-width': 2.8, 'stroke-linecap': 'round' });
    path(f, 'M-12,0C-14,-24 -11,-46 -8,-58C-6,-64 6,-64 8,-58C11,-46 14,-24 12,0Z', 'url(#t-robe)', { stroke: '#11131f', 'stroke-width': .8 });
    path(f, 'M8,-56L16,-36L12,-33L5,-48Z', '#3a4468');
    el(f, 'circle', { cx: 0, cy: -69, r: 7, fill: '#dcc4a8' });
    path(f, 'M-9,-66C-10,-81 10,-81 9,-66C12,-56 11,-45 8,-38L5,-58C3,-63 -3,-63 -5,-58L-8,-38C-11,-45 -12,-56 -9,-66Z', '#cfd4e4', { stroke: '#6a718c', 'stroke-width': .7 });
    el(f, 'circle', { cx: 18, cy: -93, r: 3.2, fill: '#d8cdb4', stroke: '#3a2c1a', 'stroke-width': .7 });
  },
  berta: (f) => {
    el(f, 'path', { d: 'M13,-30L23,-60', stroke: '#d5d8de', 'stroke-width': 2.6, 'stroke-linecap': 'round' });
    el(f, 'path', { d: 'M9,-33L18,-29', stroke: '#3a2c1a', 'stroke-width': 2.4, 'stroke-linecap': 'round' });
    path(f, 'M-13,0C-15,-20 -13,-38 -9,-48C-7,-54 7,-54 9,-48C13,-38 15,-20 13,0Z', 'url(#t-cuir)', { stroke: '#1d130b', 'stroke-width': .8 });
    el(f, 'circle', { cx: 0, cy: -59, r: 7.2, fill: '#d6b596' });
    path(f, 'M-8,-59C-9,-71 9,-71 8,-59C4,-64 -4,-64 -8,-59Z', '#4a2f1b');
    el(f, 'ellipse', { cx: -12, cy: -27, rx: 9.5, ry: 13.5, fill: '#6f4d30', stroke: '#1d130b', 'stroke-width': 1 });
    el(f, 'ellipse', { cx: -12, cy: -27, rx: 6, ry: 9.5, fill: 'none', stroke: '#b9b3a4', 'stroke-width': 1, opacity: .7 });
    el(f, 'circle', { cx: -12, cy: -27, r: 2.4, fill: '#b9b3a4' });
  },
  orc: (f) => {
    el(f, 'path', { d: 'M21,-18L30,-76', stroke: '#4a3a28', 'stroke-width': 3.6, 'stroke-linecap': 'round' });
    path(f, 'M26,-80L45,-71L41,-48L30,-55Z', '#aeb2b8', { stroke: '#2a2c30', 'stroke-width': .9 });
    path(f, 'M-19,0C-22,-26 -24,-50 -16,-62C-10,-69 10,-69 16,-62C24,-50 22,-26 19,0Z', 'url(#t-orc)', { stroke: '#10140c', 'stroke-width': .8 });
    path(f, 'M-18,-28L18,-28L17,-22L-17,-22Z', '#2a221b');
    el(f, 'ellipse', { cx: -17, cy: -58, rx: 8.5, ry: 6, fill: '#3a3530', stroke: '#141210', 'stroke-width': .8 });
    el(f, 'ellipse', { cx: 17, cy: -58, rx: 8.5, ry: 6, fill: '#3a3530', stroke: '#141210', 'stroke-width': .8 });
    el(f, 'ellipse', { cx: 0, cy: -71, rx: 10.5, ry: 9, fill: '#7f9a62', stroke: '#1c2414', 'stroke-width': .8 });
    path(f, 'M-9,-68L9,-68L7,-59L-7,-59Z', '#56703f');
    path(f, 'M-6,-61L-5,-68L-2.500,-61ZM6,-61L5,-68L2.500,-61Z', '#efe6d0');
    path(f, 'M-8,-75L-2,-73M8,-75L2,-73', 'none', { stroke: '#1c2414', 'stroke-width': 1.6, 'stroke-linecap': 'round' });
  },
  gobelin: (f) => {
    el(f, 'path', { d: 'M12,-50Q27,-27 12,-4', stroke: '#6b4a2a', 'stroke-width': 2.4, fill: 'none', 'stroke-linecap': 'round' });
    el(f, 'path', { d: 'M12,-50L12,-4', stroke: '#cfc7b0', 'stroke-width': .8 });
    path(f, 'M-9,0C-11,-13 -9,-25 -6,-31C-4,-35 4,-35 6,-31C9,-25 11,-13 9,0Z', 'url(#t-gob)', { stroke: '#141a0e', 'stroke-width': .8 });
    path(f, 'M-6,-41L-17,-48L-6,-36ZM6,-41L17,-48L6,-36Z', '#86a05e', { stroke: '#1c2414', 'stroke-width': .6 });
    el(f, 'circle', { cx: 0, cy: -39, r: 6.4, fill: '#86a05e', stroke: '#1c2414', 'stroke-width': .6 });
    path(f, 'M-7,-40C-7,-50 7,-50 7,-40C3,-44 -3,-44 -7,-40Z', '#3a2f28');
  },
};
const HAUT = { ilyanwe: 98, berta: 72, orc: 86, gobelin: 54 };
function pion(g, [x, y], { genre, camp, actif, cible, pv }) {
  const anneau = camp === 'ennemi' ? '#d2553a' : '#e9dcc0';
  if (actif) el(g, 'ellipse', { cx: x, cy: y, rx: 42, ry: 20, fill: '#ffe2a6', opacity: .5, filter: 'url(#f6)' });
  if (cible) el(g, 'ellipse', { cx: x, cy: y, rx: 42, ry: 20, fill: '#e0553a', opacity: .5, filter: 'url(#f6)' });
  el(g, 'ellipse', { cx: x + 7, cy: y + 6, rx: 28, ry: 12, fill: '#000', opacity: .5, filter: 'url(#f2)' });
  el(g, 'ellipse', { cx: x, cy: y + 4, rx: 24, ry: 11, fill: '#0b0807' });
  el(g, 'ellipse', { cx: x, cy: y, rx: 24, ry: 11, fill: '#201915', stroke: anneau, 'stroke-width': actif || cible ? 3 : 2 });
  FIGURES[genre](el(g, 'g', { transform: `translate(${x},${y - 1})` }));
  const yb = y - HAUT[genre] - 12, w = 38;
  el(g, 'rect', { x: x - w / 2 - 1, y: yb - 1, width: w + 2, height: 6, fill: '#0d0806', stroke: 'rgba(233,220,192,.55)', 'stroke-width': .8, rx: 1 });
  el(g, 'rect', { x: x - w / 2, y: yb, width: w * pv, height: 4, fill: '#b9412c' });
}
const CALME = VAR === 'round' || FIN;
if (VAR !== 'defaite') {
  objet(...HEROS, (g, p) => pion(g, p, { genre: 'ilyanwe', camp: 'heros', actif: !ADVERSE && !CALME, pv: 1 }));
  objet(...BERTA, (g, p) => pion(g, p, { genre: 'berta', camp: 'heros', pv: 1 }));
}
if (VAR !== 'victoire') {
  objet(...ORC, (g, p) => pion(g, p, { genre: 'orc', camp: 'ennemi', cible: !CALME, pv: VAR === 'critique' ? 12 / 14 : 1 }));
  objet(...GOBELIN, (g, p) => pion(g, p, { genre: 'gobelin', camp: 'ennemi', pv: 1 }));
}
{ const g = el(S, 'g'); objets.sort((p, q) => p.z - q.z).forEach((o) => o.dessine(g, o.p)); }

// le fond se ferme : coins, haut, bords et bas sous l'interface
el(S, 'rect', { width: W, height: H, fill: 'url(#vignette)' });
el(S, 'rect', { x: 0, y: 0, width: 330, height: H, fill: 'url(#gauche)' });
el(S, 'ellipse', { cx: 1640, cy: 600, rx: 430, ry: 260, fill: 'url(#droite)' });
el(S, 'rect', { x: 0, y: 500, width: W, height: 280, fill: 'url(#bas)' });
if (FIN || VAR === 'fiche') el(S, 'rect', { width: W, height: H, fill: '#06040a', opacity: FIN ? .66 : .42 });

/* ───────── l'interface ───────── */
const BUSTES = {
  ilyanwe: '<path d="M16 90c0-17 7-25 19-27l-2-8c-6-5-8-15-5-23 3-8 19-8 22 0 3 8 1 18-5 23l-2 8c12 2 19 10 19 27z"/><path d="M25 37l-10-10 10 3zM53 37l10-10-10 3z"/><path d="M21 41c-3-17 5-30 18-30s21 13 18 30c4 10 5 23 3 36l-9-7c2-10 1-21-3-28-4-5-14-5-18 0-4 7-5 18-3 28l-9 7c-2-13-1-26 3-36z" fill="#1c1410"/>',
  berta: '<path d="M14 90c0-18 8-26 20-28l-2-8c-6-5-8-16-4-24 4-7 18-7 22 0 4 8 2 19-4 24l-2 8c12 2 20 10 20 28z"/><path d="M24 31c0-12 7-19 15-19s15 7 15 19c-10-5-20-5-30 0z" fill="#1c1410"/><path d="M52 33c7 9 7 22 2 33l-6-3c4-10 4-19-1-27z" fill="#1c1410"/>',
  gobelin: '<path d="M18 90c0-14 8-20 17-22l-1-5c-8-4-11-13-8-21 3-8 23-8 26 0 3 8 0 17-8 21l-1 5c9 2 17 8 17 22z"/><path d="M27 45L5 34l20 21zM51 45l22-11-20 21z"/><path d="M24 47c-2-16 5-27 15-31 10 4 17 15 15 31-10-6-20-6-30 0z" fill="#0c0605"/>',
  orc: '<path d="M4 90c0-22 11-30 25-32l-1-6c-8-5-11-17-7-26 4-9 32-9 36 0 4 9 1 21-7 26l-1 6c14 2 25 10 25 32z"/><path d="M21 33c7-6 29-6 36 0l-3 5c-9-4-21-4-30 0z" fill="#0c0605"/><path d="M29 54l-2-11 6 8zM49 54l2-11-6 8z" fill="#e6d6b0"/>',
};
const portrait = (genre, camp, style = '') => `<div class="portrait ${camp === 'ennemi' ? 'ennemi fer' : 'laiton'}" style="${style}"><div><svg viewBox="0 0 78 90" preserveAspectRatio="xMidYMax slice" fill="${camp === 'ennemi' ? '#170a08' : '#2a1f17'}">${BUSTES[genre]}</svg></div></div>`;
const ferrures = '<i class="ferrure hg"></i><i class="ferrure hd"></i><i class="ferrure bg"></i><i class="ferrure bd"></i>';
const picto = (d, taille = 22, couleur = '#e2c06a', trait = 1.6) => `<svg width="${taille}" height="${taille}" viewBox="0 0 24 24" fill="none" stroke="${couleur}" stroke-width="${trait}" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const PICTOS = {
  attaque: '<path d="M4 4l11 11M4 4v3.500M4 4h3.500M13 17l4-4M16.500 16.500L20 20M20 4L9 15M20 4v3.500M20 4h-3.500M11 17l-4-4M7.500 16.500L4 20"/>',
  course: '<path d="M9 3v9.500l-4 3.500v4h14v-2.500c0-2-2.500-3-6-3.500V3zM9 7h4M9 10.500h4M5 17.500h14"/>',
  defensive: '<path d="M12 3l7.500 2.500v5.500c0 4.800-3.200 8-7.500 9.500-4.300-1.500-7.500-4.700-7.500-9.500V5.500zM12 3v17.500M4.500 10.500h15"/>',
  sort: '<path d="M12 2.500l1.800 6.200 6.200-1.700-4.400 4.700 4.400 4.800-6.200-1.800L12 21l-1.800-6.300L4 16.500l4.400-4.800L4 7l6.200 1.700z"/>',
  focaliser: '<circle cx="12" cy="12" r="2.200"/><path d="M12 4.500a7.500 7.500 0 1 0 7.500 7.500M12 8a4 4 0 1 1-4 4M19.500 12a7.500 7.500 0 0 0-3-6"/>',
  competence: '<path d="M12 2.500l8 8-3.500 10.500h-9L4 10.500zM12 2.500l4 9.500-4 4-4-4zM4 10.500L8 12M20 10.500L16 12M12 16v5"/>',
  poser: '<path d="M12 3.500v11M7.500 10.500l4.500 4.500 4.500-4.500M4.500 20h15"/>',
  armes: '<path d="M4.500 8.500h13l-3.500-3.500M19.500 15.500h-13l3.500 3.500"/>',
  fin: '<path d="M7 3h10M7 21h10M8.500 3c0 5 7 6.500 7 9s-7 4-7 9M15.500 3c0 5-7 6.500-7 9s7 4 7 9M10.500 18.500h3"/>',
  annuler: '<path d="M9 6.500L4.500 11 9 15.500M4.500 11h9.500a4.500 4.500 0 0 1 0 9H10"/>',
  pause: '<path d="M9 6v12M15 6v12"/>',
  journal: '<path d="M4 5c3-1.200 5.500-1.200 8 0v14c-2.500-1.200-5-1.200-8 0zM20 5c-3-1.200-5.500-1.200-8 0v14c2.500-1.200 5-1.200 8 0z"/>',
  systeme: '<circle cx="12" cy="12" r="3.200"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.600 5.600l2.100 2.100M16.300 16.300l2.100 2.100M5.600 18.400l2.100-2.100M16.300 7.700l2.100-2.100"/>',
  epee: '<path d="M6 18L17 7l2-3-3 2L5 17zM8 13l3 3M4 20l2-2"/>',
};
const rond = (nom, taille, { ferme = false, couleur } = {}) => `<div class="bouton-rond ${ferme ? 'fer ferme' : 'laiton'}"><div>${picto(PICTOS[nom], taille, couleur ?? (ferme ? '#7d7668' : '#e2c06a'))}</div></div>`;
const plaque = (libelle, { armee = false, icone = null, large = false, fermee = false } = {}) => `<div class="plaque ${fermee ? 'fer fermee' : 'laiton'}${armee ? ' armee' : ''}${large ? ' large' : ''}"><div>${icone ? picto(PICTOS[icone], 21, armee ? '#2a1a08' : fermee ? '#7d7668' : '#e2c06a', 1.7) : ''}${libelle}</div></div>`;
const d10 = (texte) => `<svg width="36" height="40" viewBox="-19 -21 38 42"><path d="M0,-19L17,-5L10,17L-10,17L-17,-5Z" fill="#b8a67e" stroke="#2a1d12" stroke-width="1.300" stroke-linejoin="round"/><path d="M0,-19L10,4L0,13L-10,4Z" fill="#f1e6cc" stroke="#2a1d12" stroke-width="1" stroke-linejoin="round"/><path d="M-17,-5L-10,4M17,-5L10,4M0,13L-10,17M0,13L10,17" stroke="#2a1d12" stroke-width="1" fill="none"/><text x="0" y="3.500" text-anchor="middle" font-family="Grenze Gotisch" font-weight="600" font-size="${texte.length > 1 ? 12.5 : 15}" fill="#2a1d12">${texte}</text></svg>`;

const rang = (genre, camp, nom, pv, max, classe = '') => `
  <div class="rang ${camp === 'ennemi' ? 'ennemi' : ''} ${classe}">${portrait(genre, camp)}
    <div class="qui"><div class="nom ${classe.includes('actif') ? '' : 'rubrique'} ombre" data-texte="rang ${nom}">${nom}</div>
    ${classe.includes('fantome') ? '' : `<div class="ligne"><div class="vie"><i style="width:${100 * pv / max}%"></i></div><span class="pv ombre">${pv} / ${max}</span></div>`}</div>
  </div>`;

const fiche = (classe, style) => `<div id="apercu" class="parchemin ${classe}" data-piece="fiche" style="${style}">
    <div class="tete"><span class="n gothique">Fléchette</span><span class="c rubrique">${VAR === 'rapides' ? 'Touche 1' : 'Sort'}</span></div>
    <div class="titre rubrique" style="margin-top:8px">Sort · coûte l’Action</div>
    <table>
      <tr><td>Niveau d’incantation</td><td>0</td></tr>
      <tr><td>Portée</td><td>Force Mentale mètres</td></tr>
      <tr><td>Cible</td><td>1</td></tr>
      <tr><td>Durée</td><td>Instantanée</td></tr>
    </table>
    <div class="pied">Un clic arme le sort, un second sur la cible le lance.</div>
  </div>`;
const rapides = (armee) => `<div id="rapides" class="cadre bois" data-piece="rapides"><div class="fond">
      ${[['Fléchette', armee], ['Dôme', 0], ['Bouclier', 0], ['Lumière', 0], [null, 0], [null, 0]].map(([n, a], i) => `<div class="case-r"><div class="plaque laiton${a ? ' armee' : ''}${n ? '' : ' vide'}"><div>${n ? picto(PICTOS.sort, 20, a ? '#2a1a08' : '#e2c06a', 1.6) : ''}</div><b>${i + 1}</b></div><span class="rubrique">${n ?? 'Libre'}</span></div>`).join('')}
    </div>${ferrures}</div>`;
const VARIANTE = () => {
  if (VAR === 'liste') return [
    `<div id="liste" class="cadre bois" data-piece="liste"><div class="fond"><div class="t rubrique">Lancer ce sort</div>
      ${[['Dôme', 0], ['Bouclier anti-flèches', 0], ['Fléchette', 1], ['Lumière', 0]].map(([n, a]) => `<div class="plaque laiton ligne-l${a ? ' armee' : ''}"><div>${n}</div></div>`).join('')}
    </div>${ferrures}</div>`,
    fiche('a-gauche', 'left:588px;top:334px;width:322px'),
  ];
  return [rapides(1), fiche('a-gauche', 'left:588px;top:334px;width:322px')];
};

/* la silhouette des localisations : six zones, trois états (libre, choisie, touchee) */
const ZONES = {
  tete: '<circle cx="30" cy="11" r="9"/>',
  corps: '<path d="M19.500,23H40.500L39,56H21Z"/>',
  brasD: '<path d="M17,23.500L9,28L5,56L11.500,57.500L15,37L18,31Z"/>',
  brasG: '<path d="M43,23.500L51,28L55,56L48.500,57.500L45,37L42,31Z"/>',
  jambeD: '<path d="M21,58.500H29.200L28,97H20.500Z"/>',
  jambeG: '<path d="M39,58.500H30.800L32,97H39.500Z"/>',
};
const silhouette = (h, etats = {}) => `<svg class="silhouette" width="${h * .6}" height="${h}" viewBox="0 0 60 100">${Object.entries(ZONES).map(([z, d]) => `<g class="zone ${etats[z] ?? ''}">${d}</g>`).join('')}</svg>`;

const jeu = ETAT === 'jet';
const ui = [];
const PV_ORC = VAR === 'critique' ? 12 : 14;
const I = (c = '') => rang('ilyanwe', 'heros', 'Ilyanwe la Voilée', 17, 17, c);
const Be = (c = '') => rang('berta', 'heros', 'Berta', 12, 12, c);
const G = (c = '') => rang('gobelin', 'ennemi', 'Tireur gobelin', 11, 11, c);
const O = (c = '') => rang('orc', 'ennemi', 'Orc', PV_ORC, 14, c);
const borne = (n) => `<div class="borne"><div class="disque fer"><div>${n}</div></div><span class="rubrique ombre">Round ${n}</span><i></i></div>`;
const SECOND = VAR === 'round' || VAR === 'journal';
const ROUND = VAR === 'round' ? 'le round<br>débute' : ADVERSE ? 'tour 4<br>sur 4' : 'tour 1<br>sur 4';
ui.push(`<div id="systeme" data-piece="systeme">${rond('systeme', 22, { couleur: '#c9b995' })}</div>`);
if (!FIN) {
  ui.push(`<div id="round" class="cadre bois" data-piece="round"><div class="fond bois"><div class="n gothique">Round ${SECOND ? 2 : 1}</div><div class="t rubrique">${ROUND}</div></div>${ferrures}</div>`);
  ui.push(`<div id="ordre" data-piece="ordre">
  ${(ADVERSE ? [O('actif'), borne(2), I('fantome'), Be('fantome loin')]
    : VAR === 'round' ? [I(), Be(), G(), O(), borne(3), I('fantome'), Be('fantome loin')]
    : [I('actif'), Be(VAR === 'fiche' ? 'lu' : ''), G(), O(), borne(SECOND ? 3 : 2), I('fantome'), Be('fantome loin')]).join('')}
</div>`);
  const vieux = (t) => `<p class="vieux ombre">${t}</p>`, neuf = (t) => `<p class="ombre">${t}</p>`, borneJ = (t) => `<p class="borne-j ombre">${t}</p>`;
  const GOB = 'Tireur gobelin maîtrise sa psychologie (Animosité).', ORCP = 'Orc maîtrise sa psychologie (Animosité).', CHARGE = 'Ilyanwe la Voilée charge Orc (+1 Avantage).';
  const TIR = 'Tireur gobelin tire sur Berta et la manque.', AVANCE = 'Orc s’avance vers Ilyanwe la Voilée.';
  const LIGNES = {
    adverse: vieux('Berta se met en Défensive.') + vieux(TIR) + neuf(AVANCE),
    defense: vieux(TIR) + vieux(AVANCE) + neuf('Orc attaque Ilyanwe la Voilée.'),
    critique: vieux(ORCP) + vieux(CHARGE) + neuf('Ilyanwe la Voilée touche Orc à la tête.'),
    round: vieux(TIR) + vieux(AVANCE) + borneJ('Round 2'),
    journal: '',
  }[VAR] ?? (jeu && VAR !== 'incantation' ? vieux(GOB) + vieux(ORCP) + neuf(CHARGE) : borneJ('Le combat commence ! (Round 1)') + vieux(GOB) + neuf(ORCP));
  ui.push(`<div id="journal" data-piece="journal">
  <div class="tete rubrique ombre${VAR === 'journal' ? ' ouvert' : ''}">Journal ${rond('journal', 17, { couleur: VAR === 'journal' ? '#2a1a08' : '#e2c06a' })}</div>
  ${LIGNES}
</div>`);
  const fermee = jeu || VAR === 'adverse';
  ui.push(`<div id="fin" class="${fermee ? 'ferme' : ''}" data-piece="fin">${rond('fin', 44, { ferme: fermee })}<span class="rubrique ombre">Fin du tour</span></div>`);
}

if (!jeu) {
  const adv = VAR === 'adverse';
  ui.push(`<div id="tour-outils" data-piece="tour-outils">${rond('annuler', 19, { ferme: true })}${rond('pause', 19, { ferme: true })}</div>`);
  ui.push(`<div id="barre" class="cadre bois${adv ? ' adverse' : ''}" data-piece="barre"><div class="fond">
    <div id="etat">${adv ? `
      <div class="mesure"><div class="tete rubrique"><span>Blessures</span><b>14 / 14</b></div><div class="vie"><i style="width:100%"></i></div></div>` : `
      <div class="mesure"><div class="tete rubrique"><span>Blessures</span><b>17 / 17</b></div><div class="vie"><i style="width:100%"></i></div></div>
      <div class="mesure"><div class="tete rubrique"><span>Mouvement</span><b>4 / 4</b></div><div class="pas"><i></i><i></i><i></i><i></i></div></div>
      <div class="jeton"><div class="sceau">${picto(PICTOS.epee, 18, '#3a0c06', 1.7)}</div><div class="v"><span class="rubrique">Action</span> <em>disponible</em></div></div>
      <div class="jeton"><div class="chiffre">0</div><div class="v"><span class="rubrique">Avantage</span></div></div>`}
    </div>
    <div id="gestes">
      <div class="plaques">${plaque('Attaque', { armee: SURVOL, icone: 'attaque', fermee: adv })}${plaque('Course', { icone: 'course', fermee: adv })}${plaque('Défensive', { icone: 'defensive', fermee: adv })}</div>
      <div class="pastilles">${[['sort', 'Sort'], ['focaliser', 'Focaliser'], ['competence', 'Compétence'], ['poser', 'Poser au sol'], ['armes', 'Armes']].map(([p, l]) => `<div class="outil${p === 'sort' && VAR === 'liste' ? ' ouvert' : ''}"><div style="width:34px;height:34px;display:flex">${rond(p, 18, { ferme: adv }).replace('class="bouton-rond', 'style="width:34px;height:34px" class="bouton-rond')}</div><span class="rubrique">${l}</span></div>`).join('')}</div>
    </div>
  </div><div class="ruban rubrique" style="left:880px;top:-9px">Action</div>${ferrures}</div>`);
  ui.push(portrait(adv ? 'orc' : 'ilyanwe', adv ? 'ennemi' : 'heros', '').replace('class="portrait', 'id="actif-portrait" class="portrait'));
  ui.push(`<div id="actif-nom"><div class="n gothique" data-texte="nom de l'actif">${adv ? 'Orc' : 'Ilyanwe la Voilée'}</div><div class="a rubrique">${adv ? 'Hache' : 'Bâton de combat'}</div></div>`);
  if (SURVOL) ui.push(`<div id="apercu" class="parchemin" data-piece="apercu">
    <div class="tete"><span class="n gothique">Orc</span><span class="c rubrique">Cible</span></div>
    <div class="pv"><div class="vie"><i style="width:100%"></i></div><b>14 / 14</b></div>
    <div class="titre rubrique">Attaque · Bâton de combat</div>
    <table>
      <tr class="seuil"><td>Corps à corps (Armes d’hast)</td><td>≤ 48</td></tr>
      <tr><td>dont Avantage</td><td>+10</td></tr>
      <tr><td>Dégâts</td><td>+6</td></tr>
      <tr><td>L’Orc oppose</td><td>Parade</td></tr>
    </table>
    <div class="pied">Charge : +1 Avantage. Un second clic confirme.</div>
  </div>`);
  if (VAR === 'liste' || VAR === 'rapides') ui.push(...VARIANTE());
  if (VAR === 'cible' || VAR === 'journal' || VAR === 'fiche') ui.push(rapides(0));
  if (VAR === 'journal') {
    const l = (t) => `<p data-texte="journal ${t.slice(0, 18)}">${t}</p>`, r = (t) => `<h4 class="rubrique"><span>${t}</span></h4>`;
    ui.push(`<div id="journal-entier" class="cadre bois" data-piece="journal-entier"><div class="fond parchemin">
      ${r('Round 1')}${['Le combat commence !', 'Tireur gobelin maîtrise sa psychologie (Animosité).', 'Orc maîtrise sa psychologie (Animosité).', 'Ilyanwe la Voilée rate son incantation (Fléchette).', 'Berta se met en Défensive.', 'Tireur gobelin tire sur Berta et la manque.', 'Orc s’avance dans la cour.'].map(l).join('')}
      ${r('Round 2')}${['Tireur gobelin maîtrise sa psychologie (Animosité).', 'Orc maîtrise sa psychologie (Animosité).'].map(l).join('')}
    </div><div class="ruban titre">Journal</div>${ferrures}</div>`);
  }
  if (VAR === 'fiche') {
    const medaillon = (n, t) => `<div class="medaillon"><div class="disque fer"><div>${n}</div></div><span class="rubrique">${t}</span></div>`;
    const arme = (dessin, nom, test, degats, allonge, atouts) => `<div class="arme">
        <div class="vignette laiton"><div><svg viewBox="0 0 80 80" fill="none" stroke-linecap="round" stroke-linejoin="round">${dessin}</svg></div></div>
        <div class="texte"><div class="n gothique">${nom}</div>
          <div class="mesures"><div class="anneau fer"><div>${test}</div></div><span class="rubrique t">Test</span>
            <div class="m"><span class="rubrique">Dégâts</span><b>${degats}</b></div><div class="m"><span class="rubrique">Allonge</span><b>${allonge}</b></div></div>
          <div class="atouts">${atouts.map((a) => `<span class="rubrique">${a}</span>`).join('')}</div></div>
      </div>`;
    ui.push(`<div id="f-identite" class="cadre bois" data-piece="fiche-identite"><div class="fond parchemin">
      <div class="tete">${portrait('berta', 'heros')}<div><div class="n gothique">Berta</div><div class="c rubrique">Humains<br>(Reiklander)</div><div class="c rubrique">Soldate</div></div></div>
      <div class="mesure"><div class="tete rubrique"><span>Blessures</span><b class="lineale">12 / 12</b></div><div class="vie"><i style="width:100%"></i></div></div>
      <div class="orne"><i></i><b></b><i></i></div>
      <div class="reserves">${medaillon(2, 'Destin')}${medaillon(2, 'Chance')}${medaillon(1, 'Résilience')}${medaillon(1, 'Détermination')}</div>
    </div>${ferrures}</div>`);
    ui.push(`<div id="f-profil" class="cadre bois" data-piece="fiche-profil"><div class="fond parchemin">
      ${[['M', 4], ['CC', 41], ['CT', 33], ['F', 38], ['E', 35], ['I', 31], ['Ag', 34], ['Dex', 28], ['Int', 27], ['FM', 35], ['Soc', 30], ['B', 12]].map(([a, v]) => `<div class="carac"><span class="rubrique">${a}</span><b class="lineale">${v}</b></div>`).join('')}
    </div><div class="ruban titre">Caractéristiques</div>${ferrures}</div>`);
    ui.push(`<div id="f-figure" class="cadre bois" data-piece="fiche-figure"><div class="fond bois"><div class="niche laiton"><div><svg viewBox="-34 -82 68 96" id="figure-lue"></svg></div></div></div>${ferrures}</div>`);
    ui.push(`<div id="f-sections" class="cadre bois" data-piece="fiche-sections"><div class="fond parchemin">
      ${arme('<path d="M18 62L58 22l6-8-8 6L16 60z" fill="#d9d3c2" stroke="#1a1005" stroke-width="1.500"/><path d="M14 52l14 14M12 68l6-6" stroke="#e2c06a" stroke-width="3.500"/>', 'Épée', 41, '+BF+4 (7)', 'Moyenne', [])}
      ${arme('<path d="M40 12l24 8v18c0 15-10 25-24 30-14-5-24-15-24-30V20z" fill="#6f4d30" stroke="#1a1005" stroke-width="1.500"/><path d="M40 12v56M16 34h48" stroke="#e2c06a" stroke-width="2.500"/><circle cx="40" cy="34" r="6" fill="#b9b3a4" stroke="#1a1005" stroke-width="1.500"/>', 'Bouclier', 41, '+BF+2 (5)', 'Très courte', ['Bouclier 2', 'Défensive', 'Assommante'])}
    </div><div class="onglets"><div class="ruban titre">Attaques</div>${['Compétences', 'Talents', 'Possessions'].map((t) => plaque(t)).join('')}</div>${ferrures}</div>`);
    ui.push(`<div id="fermer" data-piece="fermer"><span class="rubrique ombre">Fermer</span>${rond('annuler', 20)}</div>`);
  }
} else if (FIN) {
  ui.push(`<div id="issue" data-piece="issue"><div class="toile-ombre"><div class="toile"><span class="gothique" data-texte="issue">${VAR === 'victoire' ? 'Victoire' : 'Défaite'}</span></div></div>${plaque('Reprendre', { armee: true })}</div>`);
} else {
  const camp = (cote, genre, c, nom, carac, seuil, des, total, dr, modif, verdict = 'échec') => `
    <div class="camp ${cote}">${portrait(genre, c)}
      <div><div class="n gothique">${nom}${modif && cote !== 'droite' ? ` <span class="modif rubrique" style="vertical-align:3px;margin-left:6px">${modif}</span>` : ''}</div><div class="c rubrique">${carac}</div>
      <div class="des"><span class="seuil">≤ ${seuil}</span>${des.map(d10).join('')}<div class="resultat${total == null ? ' vide' : verdict === 'réussite' ? ' reussite' : ''}">${total ?? ''}</div>${total == null ? '' : `<div class="issue${verdict === 'réussite' ? ' reussite' : ''}"><b>${verdict}</b><span>DR ${dr}</span></div>`}</div></div>
    </div>`;
  const bandeau = (titre, classe, contenu, suites) => `<div id="jet" class="cadre bois" data-piece="jet"><div class="fond parchemin ${classe}">
    ${contenu}
    <div id="suites">${suites}</div>
  </div><div class="ruban titre">${titre}</div>${ferrures}</div>`;
  const APRES = `${plaque('Appliquer', { armee: true })}${plaque('Relancer')}${plaque('Chance : +1 DR', { large: true })}${plaque('Pacte')}${plaque('Résilience')}`;
  const verdict = (sous, dr, phrase) => `<div id="verdict"><div class="sous rubrique" data-texte="sous-titre">${sous}</div><div class="dr gothique">${dr}</div><p>${phrase}</p></div>`;
  if (VAR === 'avant') ui.push(bandeau('Attaque', 'avant', `
    ${camp('', 'ilyanwe', 'heros', 'Ilyanwe la Voilée', 'Corps à corps (Armes d’hast)', 28, ['', ''], null, null, 'Avantage +10')}
    <div id="verdict" class="reglages">
      <div class="rangee">${silhouette(102, { tete: 'choisie' })}
        <div class="choix"><div class="sous rubrique">Bâton de combat · Cible : Orc</div><div class="l rubrique">Localisation</div>
          <div class="v"><span class="gothique">Tête</span><span class="modif rubrique">−20 au Test</span></div>
          <div class="bas"><div class="plaque laiton mini"><div>Au hasard</div></div><div class="bascule"><i class="fer"><b class="laiton"></b></i><span class="rubrique">Retenir ses coups</span></div></div>
        </div></div></div>
    ${camp('droite', 'orc', 'ennemi', 'Orc', 'Parade', 35, ['', ''], null, null, null)}`,
    `${plaque('Lancer', { armee: true })}${plaque('Annuler')}`));
  else if (VAR === 'defense') ui.push(bandeau('Défense', '', `
    ${camp('', 'ilyanwe', 'heros', 'Ilyanwe la Voilée', 'Corps à corps (Armes d’hast)', 38, ['60', '1'], 61, '−3', null)}
    ${verdict('Hache · Cible : Ilyanwe la Voilée', 'DR net +4', 'Orc touche Ilyanwe la Voilée au bras droit.')}
    ${camp('droite', 'orc', 'ennemi', 'Orc', 'Corps à corps (Base)', 35, ['4', '20'], 24, '+1', null, 'réussite')}`, APRES));
  else if (VAR === 'incantation') ui.push(bandeau('Incantation', 'seul', `
    ${camp('', 'ilyanwe', 'heros', 'Ilyanwe la Voilée', 'Langue (Magick)', 85, ['30', '4'], 34, '+5', null, 'réussite')}
    <div id="verdict" class="sort"><div class="sous rubrique">Sort · Niveau d’incantation 0</div><div class="dr gothique">Fléchette</div><p>Ilyanwe la Voilée lance Fléchette sur Orc.</p></div>
    <div class="camp droite visee">${portrait('orc', 'ennemi')}<div><div class="n gothique">Orc</div><div class="c rubrique">Cible du sort</div><div class="pv"><div class="vie"><i style="width:100%"></i></div><b class="rubrique">14 / 14</b></div></div></div>`, APRES));
  else if (VAR === 'critique') ui.push(bandeau('Coup critique', 'critique', `
    <div class="camp touche">${portrait('orc', 'ennemi')}${silhouette(100, { tete: 'touchee' })}
      <div><div class="n gothique">Orc</div><div class="c rubrique">Touché à la tête</div>
      <div class="des"><div class="resultat">2</div><div class="issue"><b>Blessures</b><b>perdues</b></div></div></div>
    </div>
    <div id="critique"><div class="dr gothique">Coup percutant</div><p data-texte="texte du critique">Le sang obscurcit votre vision, et vous percevez des points blancs et des flashs de lumière. Vous obtenez 1 État Sonné.</p></div>`,
    plaque('Continuer', { armee: true })));
  else if (VAR === 'round') ui.push(bandeau('Début du round', 'debut', `
    <div class="annonce"><div class="dr gothique">Round 2</div><div class="sous rubrique">Agir en premier</div></div>
    ${[['ilyanwe', 'Ilyanwe la Voilée', 'Sorcière', 1], ['berta', 'Berta', 'Soldate', 0]].map(([g, n, m, a]) => `<div class="plaque laiton carte${a ? ' armee' : ''}"><div>${portrait(g, 'heros')}<div class="qui"><div class="n gothique">${n}</div><div class="c">${m}</div></div></div></div>`).join('')}`,
    plaque('Commencer le round', { armee: true, large: true })));
  else ui.push(bandeau('Attaque', '', `
    ${camp('', 'ilyanwe', 'heros', 'Ilyanwe la Voilée', 'Corps à corps (Armes d’hast)', 48, ['90', '8'], 98, '−5', 'Avantage +10')}
    <div id="verdict"><div class="sous rubrique">Bâton de combat · Cible : Orc</div><div class="dr gothique">DR net +1</div><p>Ilyanwe la Voilée rate son attaque ; Orc gagne +1 Avantage.</p></div>
    ${camp('droite', 'orc', 'ennemi', 'Orc', 'Parade', 35, ['0', '70'], 70, '−4', null)}`, APRES));
}
document.getElementById('ui').innerHTML = ui.join('');
if (VAR === 'fiche') FIGURES.berta(document.getElementById('figure-lue'));
// clous de la barre
{ const b = document.querySelector('#barre, #jet'); if (b) { const h = b.offsetHeight; [[70, 3], [330, 3], [850, 3], [1110, 3], [70, h - 9], [330, h - 9], [590, h - 9], [850, h - 9], [1110, h - 9]].forEach(([x, y]) => { const c = document.createElement('i'); c.className = 'clou'; c.style.left = x + 'px'; c.style.top = y + 'px'; b.appendChild(c); }); } }

/* grain général */
document.getElementById('grain').style.cssText = 'background-image:' + svgUrl(`<svg xmlns='${NS}' width='300' height='300'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' seed='9'/><feColorMatrix values='0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.5 0'/></filter><rect width='100%' height='100%' filter='url(#g)'/></svg>`) + ';mix-blend-mode:overlay;opacity:.3';
