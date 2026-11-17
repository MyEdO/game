/* Exploration et récit, images d'intention (#3935). La scène isométrique, sur la grille de la maquette de combat :
   la salle commune de l'auberge La Diligence et la route d'Altdorf de nuit. Maquette hors du jeu : le décor est
   dessiné, il ne prétend pas être le rendu du moteur. */
flou('f6', 6);
grad('gauche', [[0, '#000', .62], [1, '#000', 0]], { x1: 0, y1: 0, x2: 1, y2: 0 });
radial('droite', [[0, '#000', .7], [.55, '#000', .35], [1, '#000', 0]]);
radial('froid', [[0, '#2a3a6a', 0], [1, '#2a3a6a', .55]]);
radial('torche', [[0, '#ffdf9a', .8], [.2, '#ffb65a', .45], [.5, '#e07a2c', .16], [1, '#e07a2c', 0]]);
const teinte = (id, clair, sombre) => grad(id, [[0, clair], [.55, sombre], [1, melange(sombre, '#000000', .35)]], { x1: 0, y1: 0, x2: 1, y2: 1 });
teinte('t-vert', '#7d8a55', '#343d24'); teinte('t-cape', '#6f7f7a', '#27322f'); teinte('t-robe', '#7c88ad', '#2b3350');
teinte('t-cuir', '#b98a58', '#5a3d2a'); teinte('t-tablier', '#a9865c', '#4a3320'); teinte('t-brun', '#8a7458', '#3d3024');
teinte('t-rouge', '#a85a48', '#4a1f18'); teinte('t-bois', '#8a6a44', '#3f2c1a'); teinte('t-mort', '#5d6470', '#252a33');

const A = 46, B = 23, OX = 608, OY = 60;
const P = (i, j) => [OX + (i - j) * A, OY + (i + j) * B];
const losange = (x, y, a = A, b = B) => `M${x},${y - b}L${x + a},${y}L${x},${y + b}L${x - a},${y}Z`;
const path = (f, d, fill, extra = {}) => el(f, 'path', { d, fill, ...extra });
function boite(g, cx, cy, a, b, h, [dessus, so, se], assises = 0, bord = '#15131a') {
  const tr = { stroke: bord, 'stroke-width': .9, 'stroke-linejoin': 'round' };
  el(g, 'path', { d: `M${cx - a},${cy - h}L${cx},${cy + b - h}L${cx},${cy + b}L${cx - a},${cy}Z`, fill: so, ...tr });
  el(g, 'path', { d: `M${cx},${cy + b - h}L${cx + a},${cy - h}L${cx + a},${cy}L${cx},${cy + b}Z`, fill: se, ...tr });
  el(g, 'path', { d: `M${cx},${cy - b - h}L${cx + a},${cy - h}L${cx},${cy + b - h}L${cx - a},${cy - h}Z`, fill: dessus, ...tr });
  for (let k = 1; k <= assises; k++) { const t = h * k / (assises + 1); el(g, 'path', { d: `M${cx - a},${cy - h + t}L${cx},${cy + b - h + t}L${cx + a},${cy - h + t}`, fill: 'none', stroke: bord, 'stroke-width': .8, opacity: .55 }); }
}
const BOIS = ['#8a6a44', '#6a4c2e', '#3f2c1a'];
const objets = [];
const objet = (i, j, dessine, dz = 0) => objets.push({ z: i + j + dz, dessine, p: P(i, j) });
const poser = () => { const g = el(S, 'g'); objets.sort((p, q) => p.z - q.z).forEach((o) => o.dessine(g, o.p)); objets.length = 0; };

/* ───────── les figurines ───────── */
const COIFFES = {
  court: (f, c) => path(f, 'M-8,0C-9,-12 9,-12 8,0C4,-5 -4,-5 -8,0Z', c),
  long: (f, c) => path(f, 'M-9,3C-10,-12 10,-12 9,3C12,13 11,24 8,31L5,11C3,6 -3,6 -5,11L-8,31C-11,24 -12,13 -9,3Z', c),
  chignon: (f, c) => { path(f, 'M-8,0C-9,-12 9,-12 8,0C4,-5 -4,-5 -8,0Z', c); el(f, 'circle', { cx: 0, cy: -10.5, r: 3.8, fill: c }); },
  bandeau: (f, c) => { path(f, 'M-8,0C-9,-12 9,-12 8,0C4,-5 -4,-5 -8,0Z', c); path(f, 'M-7.800,-3.500C-4,-7 4,-7 7.800,-3.500L7.800,-1C4,-4.500 -4,-4.500 -7.800,-1Z', '#e9dcc0'); },
  capuche: (f, c) => path(f, 'M-10,8C-13,-6 -7,-13 0,-13C7,-13 13,-6 10,8C6,-2 -6,-2 -10,8Z', c, { stroke: '#141a16', 'stroke-width': .6 }),
  chapeau: (f, c) => { path(f, 'M-14,-4L14,-4L13,-1.500L-13,-1.500Z', c); path(f, 'M-7,-4C-7,-15 7,-15 7,-4Z', c); },
  chauve: (f, c) => path(f, 'M-7.500,-1C-7,-4 -5,-6 -3,-6.500C-5,-4 -6,-2 -7.500,-1ZM7.500,-1C7,-4 5,-6 3,-6.500C5,-4 6,-2 7.500,-1Z', c),
};
const EXTRAS = {
  arc: (f) => { el(f, 'path', { d: 'M-13,-62Q-27,-34 -11,-6', stroke: '#6b4a2a', 'stroke-width': 2.4, fill: 'none', 'stroke-linecap': 'round' }); el(f, 'path', { d: 'M-13,-62L-11,-6', stroke: '#cfc7b0', 'stroke-width': .8 }); },
  ecu: (f) => {
    el(f, 'path', { d: 'M13,-30L23,-60', stroke: '#d5d8de', 'stroke-width': 2.6, 'stroke-linecap': 'round' }); el(f, 'path', { d: 'M9,-33L18,-29', stroke: '#3a2c1a', 'stroke-width': 2.4, 'stroke-linecap': 'round' });
    el(f, 'ellipse', { cx: -12, cy: -27, rx: 9.5, ry: 13.5, fill: '#6f4d30', stroke: '#1d130b', 'stroke-width': 1 }); el(f, 'ellipse', { cx: -12, cy: -27, rx: 6, ry: 9.5, fill: 'none', stroke: '#b9b3a4', 'stroke-width': 1, opacity: .7 }); el(f, 'circle', { cx: -12, cy: -27, r: 2.4, fill: '#b9b3a4' });
  },
  livre: (f) => { path(f, 'M6,-40L17,-37L17,-25L6,-28Z', '#6a2218', { stroke: '#1d0b08', 'stroke-width': .7 }); path(f, 'M7.500,-38L15.500,-36', 'none', { stroke: '#e2c06a', 'stroke-width': .9 }); },
  dague: (f) => { path(f, 'M-12,-30L12,-30L11,-25L-11,-25Z', '#2a221b'); el(f, 'path', { d: 'M9,-26L13,-12', stroke: '#c9ccd2', 'stroke-width': 2, 'stroke-linecap': 'round' }); },
  tablier: (f) => { path(f, 'M-8,-44L8,-44L10,-6L-10,-6Z', '#d9cdb2', { stroke: '#4a3a26', 'stroke-width': .7 }); path(f, 'M-13,-34L13,-34L13,-31L-13,-31Z', '#3a2a1c'); },
  fouet: (f) => { el(f, 'path', { d: 'M12,-34L20,-70Q26,-84 34,-66', stroke: '#3a2a1c', 'stroke-width': 1.6, fill: 'none', 'stroke-linecap': 'round' }); },
  torche: (f) => { el(f, 'path', { d: 'M13,-34L20,-66', stroke: '#4a3320', 'stroke-width': 2.6, 'stroke-linecap': 'round' }); el(f, 'circle', { cx: 21, cy: -74, r: 30, fill: 'url(#coeur)', style: 'mix-blend-mode:screen' }); path(f, 'M16,-66C13,-74 19,-78 19,-86C24,-80 27,-74 25,-66Z', '#f08a2c'); path(f, 'M18.500,-66C17,-71 20,-74 20.500,-79C23,-74 24,-70 23,-66Z', '#ffd778'); },
};
const GENS = {
  bjorn: { t: 't-vert', peau: '#d6b596', cheveux: '#3a2a1c', coiffe: 'court', extras: ['arc'] },
  mira: { t: 't-cape', peau: '#dcc0a2', cheveux: '#5a3a22', coiffe: 'long', extras: ['dague'] },
  aldric: { corps: 'robe', t: 't-robe', peau: '#dcc4a8', cheveux: '#3a3028', coiffe: 'bandeau', extras: ['livre'] },
  greta: { t: 't-cuir', peau: '#d6b596', cheveux: '#4a2f1b', coiffe: 'chignon', extras: ['ecu'] },
  gustav: { t: 't-tablier', peau: '#d9b89a', cheveux: '#6a6258', coiffe: 'chauve', large: 1.28, extras: ['tablier'] },
  cocher: { t: 't-rouge', peau: '#cfa888', cheveux: '#1d1712', coiffe: 'chapeau', extras: ['fouet'] },
  client: { t: 't-brun', peau: '#d2b092', cheveux: '#2a1f17', coiffe: 'court', extras: [] },
  cliente: { t: 't-rouge', peau: '#dcc0a2', cheveux: '#7a4a22', coiffe: 'chignon', extras: [] },
};
function figure(f, nom, { torche = false, assis = false } = {}) {
  const { corps = 'tunique', t, peau, cheveux, coiffe, large = 1, extras } = GENS[nom];
  const g = el(f, 'g', assis ? { transform: 'translate(0,-9) scale(1,.8)' } : {});
  const robe = corps === 'robe', hy = robe ? -69 : -59;
  for (const e of extras) if (e === 'arc' || e === 'fouet') EXTRAS[e](g);
  path(el(g, 'g', { transform: `scale(${large},1)` }), robe ? 'M-12,0C-14,-24 -11,-46 -8,-58C-6,-64 6,-64 8,-58C11,-46 14,-24 12,0Z' : 'M-13,0C-15,-20 -13,-38 -9,-48C-7,-54 7,-54 9,-48C13,-38 15,-20 13,0Z', `url(#${t})`, { stroke: '#15100b', 'stroke-width': .8 });
  el(g, 'circle', { cx: 0, cy: hy, r: 7.2, fill: peau });
  COIFFES[coiffe](el(g, 'g', { transform: `translate(0,${hy})` }), coiffe === 'capuche' ? '#2f3d38' : cheveux);
  for (const e of extras) if (e !== 'arc' && e !== 'fouet') EXTRAS[e](g);
  if (torche) EXTRAS.torche(g);
  return robe ? 84 : 74;
}
/* anneau : heros, pnj (aucun anneau au repos), mene (le héros mené), vise (survolé ou interlocuteur) */
function pion(g, [x, y], nom, { camp = 'heros', mene = false, vise = false, assis = false, torche = false } = {}) {
  if (mene) el(g, 'ellipse', { cx: x, cy: y, rx: 42, ry: 20, fill: '#ffe2a6', opacity: .5, filter: 'url(#f6)' });
  if (vise) { el(g, 'ellipse', { cx: x, cy: y, rx: 44, ry: 21, fill: '#ffd98a', opacity: .62, filter: 'url(#f6)' }); el(g, 'ellipse', { cx: x, cy: y - 40, rx: 30, ry: 46, fill: '#ffd98a', opacity: .4, filter: 'url(#f6)' }); }
  el(g, 'ellipse', { cx: x + 7, cy: y + 6, rx: 28, ry: 12, fill: '#000', opacity: .5, filter: 'url(#f2)' });
  if (camp === 'heros') { el(g, 'ellipse', { cx: x, cy: y + 4, rx: 24, ry: 11, fill: '#0b0807' }); el(g, 'ellipse', { cx: x, cy: y, rx: 24, ry: 11, fill: '#201915', stroke: '#e9dcc0', 'stroke-width': mene ? 3 : 2 }); }
  else if (vise) el(g, 'ellipse', { cx: x, cy: y, rx: 24, ry: 11, fill: 'rgba(32,25,21,.6)', stroke: '#f3dc93', 'stroke-width': 2.4, 'stroke-dasharray': '5 4' });
  figure(el(g, 'g', { transform: `translate(${x},${y - 1})` }), nom, { assis, torche });
}
const chemin = (g, cases) => {
  const pas = cases.map(([i, j]) => P(i, j)); const d = 'M' + pas.map((p) => p.join(',')).join('L');
  el(g, 'path', { d, fill: 'none', stroke: '#000', 'stroke-width': 7, opacity: .4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', filter: 'url(#f1)' });
  el(g, 'path', { d, fill: 'none', stroke: '#f6ecd0', 'stroke-width': 3.2, 'stroke-dasharray': '1 10', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  const [ax, ay] = pas[pas.length - 1];
  el(g, 'path', { d: losange(ax, ay, A - 3, B - 1.5), fill: '#efe2bd', 'fill-opacity': .16, stroke: '#f6ecd0', 'stroke-width': 2 });
};
const tonneau = (g, x, y) => {
  el(g, 'ellipse', { cx: x + 6, cy: y + 7, rx: 22, ry: 9, fill: '#000', opacity: .4, filter: 'url(#f2)' });
  el(g, 'path', { d: `M${x - 15},${y - 36}Q${x - 19},${y - 16} ${x - 15},${y + 3}A15,6.500 0 0 0 ${x + 15},${y + 3}Q${x + 19},${y - 16} ${x + 15},${y - 36}Z`, fill: 'url(#t-bois)', stroke: '#15100a', 'stroke-width': .9 });
  el(g, 'ellipse', { cx: x, cy: y - 36, rx: 15, ry: 6.5, fill: '#6a4c2e', stroke: '#15100a', 'stroke-width': .9 });
  el(g, 'path', { d: `M${x - 17},${y - 24}A17,7 0 0 0 ${x + 17},${y - 24}M${x - 17},${y - 8}A17,7 0 0 0 ${x + 17},${y - 8}`, fill: 'none', stroke: '#1d1b1a', 'stroke-width': 2.4 });
};
const chope = (g, x, y) => { el(g, 'rect', { x: x - 3, y: y - 8, width: 6, height: 8, rx: 1, fill: '#b9b3a4', stroke: '#2a221b', 'stroke-width': .7 }); el(g, 'path', { d: `M${x + 3},${y - 6}q4,2 0,4`, fill: 'none', stroke: '#b9b3a4', 'stroke-width': 1.2 }); };
const bougie = (g, x, y) => { el(g, 'circle', { cx: x, cy: y - 12, r: 26, fill: 'url(#coeur)', opacity: .7, style: 'mix-blend-mode:screen' }); el(g, 'rect', { x: x - 1.5, y: y - 9, width: 3, height: 9, fill: '#e9dcc0' }); path(g, `M${x - 2},${y - 9}C${x - 3},${y - 13} ${x},${y - 14} ${x},${y - 17}C${x + 3},${y - 14} ${x + 2.500},${y - 11} ${x + 2},${y - 9}Z`, '#ffd778'); };
const table = (g, x, y) => {
  el(g, 'ellipse', { cx: x + 5, cy: y + 8, rx: 42, ry: 19, fill: '#000', opacity: .42, filter: 'url(#f2)' });
  el(g, 'path', { d: `M${x - 20},${y + 4}v-20M${x + 20},${y + 4}v-20M${x},${y + 12}v-20`, stroke: '#2a1c12', 'stroke-width': 4, 'stroke-linecap': 'round' });
  el(g, 'ellipse', { cx: x, cy: y - 15, rx: 38, ry: 19, fill: '#3f2c1a', stroke: '#15100a', 'stroke-width': .9 });
  el(g, 'ellipse', { cx: x, cy: y - 19, rx: 38, ry: 19, fill: '#7d5e3c', stroke: '#15100a', 'stroke-width': .9 });
  el(g, 'path', { d: `M${x - 34},${y - 24}L${x + 30},${y - 8}M${x - 37},${y - 17}L${x + 14},${y - 2}M${x - 22},${y - 33}L${x + 37},${y - 17}`, stroke: '#3f2c1a', 'stroke-width': .8, opacity: .55 });
};
const tabouret = (g, x, y) => { el(g, 'path', { d: `M${x - 6},${y + 2}v-9M${x + 6},${y + 2}v-9`, stroke: '#2a1c12', 'stroke-width': 3 }); el(g, 'ellipse', { cx: x, cy: y - 8, rx: 10, ry: 5, fill: '#6a4c2e', stroke: '#15100a', 'stroke-width': .8 }); };

/* ───────── la salle commune de La Diligence ─────────
   groupe : 'entree' (le groupe traverse la salle) ou 'comptoir' (il parle à Gustav) ; survol : 'gustav' ;
   trajet : le chemin pointé ; avis : l'avis placardé luit ; sombre : la scène recule derrière une page */
function sceneAuberge({ groupe = 'entree', survol = null, trajet = false, parle = false, avis = false, sombre = 0, colonne = false } = {}) {
  const HM = 96;
  el(S, 'rect', { width: W, height: H, fill: '#07080d' });
  // le plancher
  { const r = alea(17); const g = el(S, 'g', { stroke: '#22160d', 'stroke-width': 1.2, 'stroke-linejoin': 'round' });
    for (let i = 4; i < 44; i++) for (let j = -1; j < 44; j++) {
      const [x, y] = P(i, j); if (x < -A || x > W + A || y < -B || y > H + B) continue;
      el(g, 'path', { d: losange(x, y), fill: melange('#5b4230', '#74573c', r()) });
      el(g, 'path', { d: `M${x - A / 2},${y - B / 2}L${x + A / 2},${y + B / 2}`, opacity: .75 });
      if (r() < .3) el(g, 'path', { d: `M${x - A * .75 + r() * 20},${y + B * .25 - 4}l10,5`, opacity: .5, 'stroke-width': .8 });
    } }
  // un tapis usé devant l'âtre
  { const [x, y] = P(6.5, 7.5); el(S, 'path', { d: losange(x, y, A * 2.6, B * 1.6), fill: '#6a2a1e', opacity: .55, stroke: '#c9a44c', 'stroke-width': 1.4, 'stroke-opacity': .5 }); el(S, 'path', { d: losange(x, y, A * 2.1, B * 1.25), fill: 'none', stroke: '#c9a44c', 'stroke-width': .8, opacity: .4 }); }
  // les murs à colombages : mur de gauche (i = 3, face sud-est), mur de droite (j = −2, face sud-ouest)
  const seF = (j) => { const [cx, cy] = P(3, j); return (u, v) => [cx + u * A, cy + B - u * B - v * HM]; };
  const soF = (i) => { const [cx, cy] = P(i, -2); return (u, v) => [cx - A + u * A, cy + u * B - v * HM]; };
  const quad = (g, F, u0, v0, u1, v1, attrs) => el(g, 'path', { d: 'M' + [F(u0, v0), F(u1, v0), F(u1, v1), F(u0, v1)].map((p) => p.join(',')).join('L') + 'Z', ...attrs });
  { const r = alea(29); const g = el(S, 'g'); const murs = [];
    for (let i = 4; i <= 26; i++) murs.push([i, -2]); for (let j = -2; j <= 22; j++) murs.push([3, j]);
    murs.sort((p, q) => (p[0] + p[1]) - (q[0] + q[1]));
    for (const [i, j] of murs) { const [x, y] = P(i, j); const t = r() * .25; boite(g, x, y, A, B, HM, [melange('#241a12', '#1a120c', t), melange('#93805f', '#7d6b4f', t), melange('#77664c', '#655640', t)], 0, 'rgba(40,28,16,.5)'); }
    const bois = { fill: '#2e1f14', stroke: '#120b06', 'stroke-width': .7 };
    for (let j = 22; j >= -1; j--) { const F = seF(j); quad(g, F, 0, 0, 1, .09, bois); quad(g, F, 0, .9, 1, 1, bois); if (j % 2 === 0) quad(g, F, 0, .09, .11, .9, bois); if (j % 4 === 1) el(g, 'path', { d: `M${F(.11, .9).join(',')}L${F(1, .09).join(',')}`, stroke: '#2e1f14', 'stroke-width': 5 }); }
    for (let i = 4; i <= 26; i++) { const F = soF(i); quad(g, F, 0, 0, 1, .09, bois); quad(g, F, 0, .9, 1, 1, bois); if (i % 2 === 0) quad(g, F, .89, .09, 1, .9, bois); if (i % 4 === 3) el(g, 'path', { d: `M${F(0, .09).join(',')}L${F(.89, .9).join(',')}`, stroke: '#2e1f14', 'stroke-width': 5 }); }
    // fenêtres, la nuit dehors
    const fenetre = (F) => { quad(g, F, .22, .4, .8, .82, { fill: '#1b2540', stroke: '#2e1f14', 'stroke-width': 3 }); el(g, 'path', { d: `M${F(.51, .4).join(',')}L${F(.51, .82).join(',')}M${F(.22, .61).join(',')}L${F(.8, .61).join(',')}`, stroke: '#2e1f14', 'stroke-width': 1.6 }); };
    fenetre(seF(1)); fenetre(seF(15)); fenetre(soF(6)); fenetre(soF(14));
    // la porte de la cour, mur de gauche
    { const F = seF(11); quad(g, F, .08, 0, .92, .8, { fill: '#2e1f14' }); quad(g, F, .14, 0, .86, .76, { fill: '#5a3d24', stroke: '#120b06', 'stroke-width': .8 });
      for (const u of [.32, .5, .68]) el(g, 'path', { d: `M${F(u, 0).join(',')}L${F(u, .76).join(',')}`, stroke: '#2a1a0e', 'stroke-width': 1 });
      el(g, 'path', { d: `M${F(.14, .2).join(',')}L${F(.86, .2).join(',')}M${F(.14, .6).join(',')}L${F(.86, .6).join(',')}`, stroke: '#17110c', 'stroke-width': 3 });
      el(g, 'circle', { cx: F(.76, .38)[0], cy: F(.76, .38)[1], r: 2.4, fill: '#e2c06a' }); }
    // l'âtre, mur de gauche
    { const F = seF(7); quad(g, F, -.08, 0, 2.08, .72, { fill: '#6a6773', stroke: '#15131a', 'stroke-width': .9 }); quad(g, F, -.14, .72, 2.14, .82, { fill: '#8a8694', stroke: '#15131a', 'stroke-width': .9 });
      for (const v of [.24, .48]) el(g, 'path', { d: `M${F(-.08, v).join(',')}L${F(2.08, v).join(',')}`, stroke: '#33313c', 'stroke-width': .9, opacity: .7 });
      quad(g, F, .26, 0, 1.74, .52, { fill: '#120b08', stroke: '#15131a', 'stroke-width': .9 });
      const [fx, fy] = F(1, 0); el(g, 'circle', { cx: fx + 4, cy: fy - 20, r: 74, fill: 'url(#coeur)', style: 'mix-blend-mode:screen' });
      el(g, 'path', { d: `M${fx - 20},${fy + 2}l34,-12M${fx - 14},${fy - 8}l30,6`, stroke: '#2a1a10', 'stroke-width': 6, 'stroke-linecap': 'round' });
      flammes(g, fx + 2, fy - 3, .5); }
    // les étagères derrière le comptoir, mur de droite
    { const F = soF(9); for (const v of [.46, .68]) { quad(g, F, .1, v, 3.9, v + .035, { fill: '#2e1f14' });
        const r2 = alea(v * 100 | 0); for (let u = .22; u < 3.8; u += .2) { const [x, y] = F(u, v + .035); const h = 9 + r2() * 8; el(g, 'rect', { x: x - 2.5, y: y - h, width: 5, height: h, rx: 1.5, fill: ['#3d5a3a', '#6a4c2e', '#8a3a26', '#b9a57b'][r2() * 4 | 0], opacity: .9 }); } } }
    // l'avis placardé, mur de droite
    { const F = soF(18); quad(g, F, .1, .34, .92, .84, { fill: '#4a3320', stroke: '#120b06', 'stroke-width': .9 });
      if (avis) el(g, 'circle', { cx: F(.5, .58)[0], cy: F(.5, .58)[1], r: 46, fill: 'url(#coeur)', opacity: .85, style: 'mix-blend-mode:screen' });
      quad(g, F, .22, .4, .8, .8, { fill: '#e6d5ad', stroke: avis ? '#f3dc93' : '#5a4530', 'stroke-width': avis ? 2 : .7 });
      for (const v of [.72, .66, .6, .54, .48]) el(g, 'path', { d: `M${F(.3, v).join(',')}L${F(v === .48 ? .58 : .72, v).join(',')}`, stroke: '#3a2a18', 'stroke-width': v === .72 ? 1.6 : .8, opacity: .8 });
      el(g, 'circle', { cx: F(.51, .78)[0], cy: F(.51, .78)[1], r: 1.6, fill: '#1a1917' }); }
  }
  const FEU = P(4.5, 7);
  el(S, 'ellipse', { cx: FEU[0] + 60, cy: FEU[1] + 40, rx: 600, ry: 330, fill: 'url(#lueur)', style: 'mix-blend-mode:screen', opacity: .9 });
  el(S, 'ellipse', { cx: 1110, cy: 330, rx: 380, ry: 230, fill: 'url(#lueur)', style: 'mix-blend-mode:screen', opacity: .45 });
  // ce que le groupe dessine au sol
  const GROUPE = groupe === 'avis' ? { mira: [17, 0], greta: [15, 1], aldric: [15, -1], bjorn: [14, 2] } : groupe === 'comptoir' ? { mira: [11, 3], greta: [10, 4], aldric: [12, 5], bjorn: [9, 5] } : { mira: [10, 6], greta: [8, 6], aldric: [8, 8], bjorn: [6, 7] };
  { const g = el(S, 'g'); if (trajet) chemin(g, [GROUPE.mira, [11, 5], [11, 4], [11, 3]]); }
  // le mobilier
  for (let i = 9; i <= 12; i++) objet(i, 2, (g, [x, y]) => { boite(g, x, y, A, B, 30, BOIS, 1, '#15100a'); if (i === 9) chope(g, x - 8, y - 30); if (i === 12) bougie(g, x + 6, y - 31); if (i === 11) { chope(g, x + 10, y - 27); chope(g, x - 16, y - 33); } });
  objet(13, 2, (g, [x, y]) => boite(g, x, y, A, B, 30, BOIS, 1, '#15100a'));
  objet(13, 1, (g, [x, y]) => boite(g, x, y, A, B, 30, BOIS, 1, '#15100a'));
  objet(13, -1, (g, [x, y]) => tonneau(g, x - 6, y)); objet(14, -1, (g, [x, y]) => tonneau(g, x - 2, y + 2)); objet(8, -1, (g, [x, y]) => tonneau(g, x, y + 2));
  objet(6, 3, (g, p) => { table(g, ...p); chope(g, p[0] - 14, p[1] - 20); chope(g, p[0] + 12, p[1] - 14); bougie(g, p[0], p[1] - 20); });
  objet(5, 3, (g, [x, y]) => pion(g, [x + 8, y + 2], 'client', { camp: 'pnj', assis: true }), -.1);
  objet(7, 3, (g, [x, y]) => pion(g, [x - 6, y + 4], 'cliente', { camp: 'pnj', assis: true }), .1);
  objet(6, 4, (g, [x, y]) => tabouret(g, x - 2, y + 2));
  objet(15, 6, (g, p) => { table(g, ...p); chope(g, p[0] + 8, p[1] - 22); bougie(g, p[0] - 10, p[1] - 17); });
  objet(14, 6, (g, [x, y]) => pion(g, [x + 8, y + 2], 'cocher', { camp: 'pnj', assis: true }), -.1);
  objet(15, 7, (g, [x, y]) => tabouret(g, x, y)); objet(16, 6, (g, [x, y]) => tabouret(g, x - 4, y));
  objet(4, 14, (g, [x, y]) => { el(g, 'ellipse', { cx: x + 6, cy: y + 8, rx: 40, ry: 16, fill: '#000', opacity: .4, filter: 'url(#f2)' }); boite(g, x, y, 30, 15, 26, BOIS, 0, '#15100a'); el(g, 'path', { d: `M${x - 30},${y - 17}L${x},${y - 2}L${x + 30},${y - 17}M${x - 10},${y - 21}v18M${x + 10},${y - 21}v18`, fill: 'none', stroke: '#c39c44', 'stroke-width': 2, opacity: .85 }); });
  objet(4, 4, (g, [x, y]) => { tonneau(g, x - 4, y); });
  // les gens
  objet(11, 1, (g, [x, y]) => pion(g, [x - 22, y + 1], 'gustav', { camp: 'pnj', vise: survol === 'gustav' || parle }), -.2);
  Object.entries(GROUPE).forEach(([nom, c]) => objet(...c, (g, p) => pion(g, p, nom, { mene: nom === 'mira' })));
  poser();
  // le fond se ferme
  el(S, 'rect', { width: W, height: H, fill: 'url(#vignette)' });
  if (colonne) el(S, 'rect', { x: 0, y: 0, width: 330, height: H, fill: 'url(#gauche)' });
  el(S, 'ellipse', { cx: 1640, cy: 600, rx: 430, ry: 260, fill: 'url(#droite)' });
  el(S, 'rect', { x: 0, y: 500, width: W, height: 280, fill: 'url(#bas)' });
  if (sombre) el(S, 'rect', { width: W, height: H, fill: '#06040a', opacity: sombre });
  return { GROUPE };
}

/* ───────── la route d'Altdorf, de nuit : le corps du voyageur ───────── */
function sceneRoute() {
  el(S, 'rect', { width: W, height: H, fill: '#07090f' });
  const surRoute = (i) => i >= 9 && i <= 12;
  { const r = alea(41); const g = el(S, 'g', { stroke: '#161c14', 'stroke-width': 1, 'stroke-linejoin': 'round' });
    for (let i = -6; i < 44; i++) for (let j = -12; j < 44; j++) {
      const [x, y] = P(i, j); if (x < -A || x > W + A || y < -B || y > H + B) continue;
      const t = r(); const bord = i === 8 || i === 13;
      el(g, 'path', { d: losange(x, y), fill: surRoute(i) ? melange('#4f4436', '#62533f', t) : bord ? melange('#3f4632', '#4d4a36', t) : melange('#2f3b2a', '#3d4a33', t), stroke: surRoute(i) ? '#2a2318' : '#1a2118' });
      if (surRoute(i) && r() < .5) el(g, 'path', { d: `M${x + A * .4},${y - B * .6}L${x - A * .6},${y + B * .4}`, stroke: '#2a2318', 'stroke-width': 1.6, opacity: .6 });
      if (!surRoute(i) && r() < .3) el(g, 'path', { d: `M${x - 10 + r() * 20},${y + 4}q2,-9 4,0q2,-7 4,0`, fill: 'none', stroke: '#62754a', 'stroke-width': 1.2, opacity: .8 });
      if (surRoute(i) && r() < .12) el(g, 'ellipse', { cx: x + r() * 20 - 10, cy: y, rx: 5, ry: 2.5, fill: '#6f6a60', stroke: '#2a2318', 'stroke-width': .6 });
    } }
  const torche = P(10, 4);
  el(S, 'ellipse', { cx: torche[0], cy: torche[1] - 20, rx: 470, ry: 270, fill: 'url(#torche)', style: 'mix-blend-mode:screen' });
  el(S, 'ellipse', { cx: 850, cy: 400, rx: 1500, ry: 800, fill: 'url(#froid)', style: 'mix-blend-mode:soft-light' });
  // le corps, que l'on fouille
  { const [x, y] = P(10, 5); const g = el(S, 'g');
    el(g, 'ellipse', { cx: x, cy: y, rx: 50, ry: 24, fill: '#ffd98a', opacity: .5, filter: 'url(#f6)' });
    el(g, 'path', { d: losange(x, y, A - 3, B - 1.5), fill: '#efe2bd', 'fill-opacity': .12, stroke: '#f3dc93', 'stroke-width': 2, 'stroke-dasharray': '5 4' });
    el(g, 'ellipse', { cx: x + 4, cy: y + 5, rx: 34, ry: 11, fill: '#000', opacity: .5, filter: 'url(#f2)' });
    path(g, `M${x - 30},${y + 2}C${x - 26},${y - 12} ${x - 4},${y - 15} ${x + 14},${y - 10}C${x + 28},${y - 7} ${x + 34},${y - 1} ${x + 30},${y + 5}C${x + 12},${y + 10} ${x - 16},${y + 9} ${x - 30},${y + 2}Z`, 'url(#t-mort)', { stroke: '#11131a', 'stroke-width': .8 });
    el(g, 'circle', { cx: x - 36, cy: y - 5, r: 7, fill: '#b9a995' }); path(g, `M${x - 43},${y - 6}C${x - 43},${y - 15} ${x - 30},${y - 15} ${x - 29},${y - 7}C${x - 34},${y - 11} ${x - 39},${y - 10} ${x - 43},${y - 6}Z`, '#3a2a1c');
    el(g, 'path', { d: `M${x + 2},${y - 12}L${x + 8},${y - 34}`, stroke: '#3a2c1a', 'stroke-width': 2, 'stroke-linecap': 'round' }); path(g, `M${x + 6},${y - 34}l6,1l-4,-7z`, '#8a3a26');
  }
  const sapinIso = (g, x, y, h, t) => { el(g, 'ellipse', { cx: x + 8, cy: y + 4, rx: h * .22, ry: h * .08, fill: '#000', opacity: .45, filter: 'url(#f2)' }); el(g, 'rect', { x: x - 3, y: y - h * .12, width: 6, height: h * .14, fill: '#2a1c12' }); sapin(g, x, y - h * .06, h, melange('#16261c', '#2c4030', t)); };
  { const r = alea(8); for (let n = 0; n < 150; n++) { const i = -6 + r() * 44, j = -12 + r() * 44; if (i > 6.6 && i < 14.4) continue; const [x, y] = P(i, j); if (x < -40 || x > W + 40 || y < 10 || y > 640) continue; const h = 90 + r() * 80, t = r(); objets.push({ z: i + j, p: [x, y], dessine: (g, p) => sapinIso(g, ...p, h, t) }); } }
  objet(13, 3, (g, [x, y]) => { el(g, 'ellipse', { cx: x + 6, cy: y + 4, rx: 22, ry: 9, fill: '#000', opacity: .45, filter: 'url(#f2)' }); path(g, `M${x - 10},${y + 3}L${x - 10},${y - 34}Q${x},${y - 44} ${x + 10},${y - 34}L${x + 10},${y + 3}Z`, '#6a6773', { stroke: '#15131a', 'stroke-width': .9 }); el(g, 'path', { d: `M${x - 5},${y - 26}h10M${x - 5},${y - 20}h10`, stroke: '#33313c', 'stroke-width': 1.4 }); });
  objet(8, 3, (g, [x, y]) => { el(g, 'ellipse', { cx: x + 6, cy: y + 8, rx: 34, ry: 14, fill: '#000', opacity: .4, filter: 'url(#f2)' }); boite(g, x, y, 26, 13, 20, BOIS, 0, '#15100a'); el(g, 'path', { d: `M${x - 26},${y - 12}L${x},${y + 1}L${x + 26},${y - 12}`, fill: 'none', stroke: '#c39c44', 'stroke-width': 1.6, opacity: .7 }); });
  objet(9, 2, (g, [x, y]) => { el(g, 'ellipse', { cx: x, cy: y - 16, rx: 12, ry: 22, fill: 'none', stroke: '#3f2c1a', 'stroke-width': 4, transform: `rotate(28 ${x} ${y - 16})` }); el(g, 'path', { d: `M${x - 9},${y - 34}L${x + 9},${y + 2}M${x - 12},${y - 10}L${x + 12},${y - 22}`, stroke: '#3f2c1a', 'stroke-width': 2 }); });
  objet(10, 6, (g, p) => pion(g, p, 'mira', { mene: true }));
  objet(10, 3, (g, p) => pion(g, p, 'greta', { torche: true }));
  objet(8, 4, (g, p) => pion(g, p, 'aldric'));
  objet(12, 4, (g, p) => pion(g, p, 'bjorn'));
  poser();
  el(S, 'rect', { width: W, height: H, fill: 'url(#vignette)' });
  el(S, 'rect', { x: 0, y: 0, width: W, height: 300, fill: 'url(#haut)' });
  el(S, 'rect', { x: 0, y: 440, width: W, height: 340, fill: 'url(#bas)' });
}
// Partagé avec les scripts de page chargés après celui-ci.
Object.assign(globalThis, { sceneAuberge, sceneRoute });
