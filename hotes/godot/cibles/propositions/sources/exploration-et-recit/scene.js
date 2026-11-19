/* Le décor de l'exploration (#3935, #4411), sur la grille de la maquette de combat : la salle commune de l'auberge La
   Diligence sous ses trois regards (isométrique, du dessus, par les yeux du meneur) et la route d'Altdorf de nuit
   (`../rendu.js`). Peint à 1707 × 780, rogné à la vue (`toile`, `../lieux-et-nuit/commun.js`) ; `pointDe` ramène à la vue
   le point au-dessus d'une chose de la scène, sous chaque regard. Maquette hors du jeu : le décor est dessiné, il ne
   prétend pas être le rendu du moteur. */
{
  /* la vue, avant que le dessin ne prenne ses propres cotes ; le dessin y est rogné centré */
  const VUE = [globalThis.W, globalThis.H], ECHELLE = Math.max(VUE[0] / 1707, VUE[1] / 780);
  const vue = ([x, y]) => [VUE[0] / 2 + (x - 1707 / 2) * ECHELLE, VUE[1] / 2 + (y - 780 / 2) * ECHELLE];
  const S = toile(), W = 1707, H = 780;
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
  const objet = (i, j, dessine, dz = 0) => objets.push({ i, j, z: i + j + dz, dessine, p: P(i, j) });
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
     Ce que ses trois vues lisent : les deux murs (celui de gauche à i = 3, celui de droite à j = −2) et leurs
     percements, le mobilier, les gens, les places du groupe. */
  const SALLE = {
    mur: [3, -2], fenetresDeGauche: [1, 15], fenetresDeDroite: [6, 13], porte: 11, atre: 7, etageres: 9, avis: 16, tapis: [6.5, 7.5],
    comptoir: [[9, 2], [10, 2], [11, 2], [12, 2], [13, 2], [13, 1]], tonneaux: [[13, -1], [14, -1], [8, -1], [4, 4]],
    tables: [[6, 3], [15, 6]], tabourets: [[6, 4], [15, 7], [16, 6]], coffre: [4, 9], dague: [10, 10],
    gens: { client: [5, 3], cliente: [7, 3], cocher: [14, 6], gustav: [11, 1] },
    groupes: {
      entree: { mira: [10, 6], greta: [8, 6], aldric: [8, 8], bjorn: [6, 7] },
      comptoir: { mira: [11, 3], greta: [10, 4], aldric: [12, 5], bjorn: [9, 5] },
      avis: { mira: [16, 0], greta: [15, 1], aldric: [17, 1], bjorn: [16, 2] },
    },
  };
  const CROISEE = SALLE.fenetresDeDroite[1], [MI, MJ] = SALLE.mur, HM = 96;
  /* les faces des murs : le mur de gauche (face sud-est) à la case j, le mur de droite (face sud-ouest) à la case i ;
     F(u, v) : u le long de la case, v de son pied à son faîte */
  const seF = (j) => { const [cx, cy] = P(MI, j); return (u, v) => [cx + u * A, cy + B - u * B - v * HM]; };
  const soF = (i) => { const [cx, cy] = P(i, MJ); return (u, v) => [cx - A + u * A, cy + u * B - v * HM]; };
  /* la vue du dessus : une case est un carré de T, le mur de gauche passe en haut */
  const T = 40, DX = 1160, DY = 40;
  const dx = (j) => DX - (j - MJ + .5) * T, dy = (i) => DY + (i - MI + .5) * T, lieuDessus = (i, j) => [dx(j), dy(i)];
  /* par les yeux du meneur, depuis sa case à l'entrée, tourné vers le mur de l'âtre : le point d'un point de la salle à la
     hauteur h (en cases) */
  const [CI, CJ] = SALLE.groupes.entree.mira, FOCALE = 520, HORIZON = 250;
  const lieuAuxYeux = (i, j, h = 0) => { const d = CI - i; return [W / 2 + FOCALE * (CJ - j) / d, HORIZON + FOCALE * (1 - h) / d]; };
  /* les pièces d'un mur, sur la face que donne F(u, v) : u le long de la case, v de son pied à son faîte ; k : l'échelle
     des pièces dessinées en pixels */
  const quad = (g, F, u0, v0, u1, v1, attrs) => el(g, 'path', { d: 'M' + [F(u0, v0), F(u1, v0), F(u1, v1), F(u0, v1)].map((p) => p.join(',')).join('L') + 'Z', ...attrs });
  const BOIS_DE_MUR = { fill: '#2e1f14', stroke: '#120b06', 'stroke-width': .7 };
  const colombageDeGauche = (g, F, j) => { quad(g, F, 0, 0, 1, .09, BOIS_DE_MUR); quad(g, F, 0, .9, 1, 1, BOIS_DE_MUR); if (j % 2 === 0) quad(g, F, 0, .09, .11, .9, BOIS_DE_MUR); if (j % 4 === 1) el(g, 'path', { d: `M${F(.11, .9).join(',')}L${F(1, .09).join(',')}`, stroke: '#2e1f14', 'stroke-width': 5 }); };
  const colombageDeDroite = (g, F, i) => { quad(g, F, 0, 0, 1, .09, BOIS_DE_MUR); quad(g, F, 0, .9, 1, 1, BOIS_DE_MUR); if (i % 2 === 0) quad(g, F, .89, .09, 1, .9, BOIS_DE_MUR); if (i % 4 === 3) el(g, 'path', { d: `M${F(0, .09).join(',')}L${F(.89, .9).join(',')}`, stroke: '#2e1f14', 'stroke-width': 5 }); };
  const fenetre = (g, F, luit = false) => { if (luit) el(g, 'circle', { cx: F(.51, .61)[0], cy: F(.51, .61)[1], r: 50, fill: 'url(#coeur)', opacity: .85, style: 'mix-blend-mode:screen' }); quad(g, F, .22, .4, .8, .82, { fill: '#1b2540', stroke: luit ? '#f3dc93' : '#2e1f14', 'stroke-width': 3 }); el(g, 'path', { d: `M${F(.51, .4).join(',')}L${F(.51, .82).join(',')}M${F(.22, .61).join(',')}L${F(.8, .61).join(',')}`, stroke: '#2e1f14', 'stroke-width': 1.6 }); };
  const porteDeLaCour = (g, F) => {
    quad(g, F, .08, 0, .92, .8, { fill: '#2e1f14' }); quad(g, F, .14, 0, .86, .76, { fill: '#5a3d24', stroke: '#120b06', 'stroke-width': .8 });
    for (const u of [.32, .5, .68]) el(g, 'path', { d: `M${F(u, 0).join(',')}L${F(u, .76).join(',')}`, stroke: '#2a1a0e', 'stroke-width': 1 });
    el(g, 'path', { d: `M${F(.14, .2).join(',')}L${F(.86, .2).join(',')}M${F(.14, .6).join(',')}L${F(.86, .6).join(',')}`, stroke: '#17110c', 'stroke-width': 3 });
    el(g, 'circle', { cx: F(.76, .38)[0], cy: F(.76, .38)[1], r: 2.4, fill: '#e2c06a' });
  };
  const atre = (g, F, k = 1) => {
    quad(g, F, -.08, 0, 2.08, .72, { fill: '#6a6773', stroke: '#15131a', 'stroke-width': .9 }); quad(g, F, -.14, .72, 2.14, .82, { fill: '#8a8694', stroke: '#15131a', 'stroke-width': .9 });
    for (const v of [.24, .48]) el(g, 'path', { d: `M${F(-.08, v).join(',')}L${F(2.08, v).join(',')}`, stroke: '#33313c', 'stroke-width': .9, opacity: .7 });
    quad(g, F, .26, 0, 1.74, .52, { fill: '#120b08', stroke: '#15131a', 'stroke-width': .9 });
    const [fx, fy] = F(1, 0); el(g, 'circle', { cx: fx + 4 * k, cy: fy - 20 * k, r: 74 * k, fill: 'url(#coeur)', style: 'mix-blend-mode:screen' });
    el(g, 'path', { d: `M${fx - 20 * k},${fy + 2 * k}l${34 * k},${-12 * k}M${fx - 14 * k},${fy - 8 * k}l${30 * k},${6 * k}`, stroke: '#2a1a10', 'stroke-width': 6 * k, 'stroke-linecap': 'round' });
    flammes(g, fx + 2 * k, fy - 3 * k, .5 * k);
  };
  const etageres = (g, F) => { for (const v of [.46, .68]) { quad(g, F, .1, v, 3.9, v + .035, { fill: '#2e1f14' });
    const r2 = alea(v * 100 | 0); for (let u = .22; u < 3.8; u += .2) { const [x, y] = F(u, v + .035); const h = 9 + r2() * 8; el(g, 'rect', { x: x - 2.5, y: y - h, width: 5, height: h, rx: 1.5, fill: ['#3d5a3a', '#6a4c2e', '#8a3a26', '#b9a57b'][r2() * 4 | 0], opacity: .9 }); } } };
  const avisPlacarde = (g, F, luit) => {
    quad(g, F, .1, .34, .92, .84, { fill: '#4a3320', stroke: '#120b06', 'stroke-width': .9 });
    if (luit) el(g, 'circle', { cx: F(.5, .58)[0], cy: F(.5, .58)[1], r: 46, fill: 'url(#coeur)', opacity: .85, style: 'mix-blend-mode:screen' });
    quad(g, F, .22, .4, .8, .8, { fill: '#e6d5ad', stroke: luit ? '#f3dc93' : '#5a4530', 'stroke-width': luit ? 2 : .7 });
    for (const v of [.72, .66, .6, .54, .48]) el(g, 'path', { d: `M${F(.3, v).join(',')}L${F(v === .48 ? .58 : .72, v).join(',')}`, stroke: '#3a2a18', 'stroke-width': v === .72 ? 1.6 : .8, opacity: .8 });
    el(g, 'circle', { cx: F(.51, .78)[0], cy: F(.51, .78)[1], r: 1.6, fill: '#1a1917' });
  };
  const laDague = (g, [x, y]) => { el(g, 'ellipse', { cx: x, cy: y, rx: 34, ry: 16, fill: '#ffd98a', opacity: .55, filter: 'url(#f6)' }); el(g, 'path', { d: `M${x - 15},${y + 5}L${x + 9},${y - 5}`, stroke: '#d5d8de', 'stroke-width': 3, 'stroke-linecap': 'round' }); el(g, 'path', { d: `M${x + 5},${y - 9}l7,9M${x + 9},${y - 5}l8,-3.500`, stroke: '#3a2c1a', 'stroke-width': 3, 'stroke-linecap': 'round' }); };
  /* le mobilier et les gens, en objets que la vue pose ; groupe : les places des héros, null quand on voit par leurs
     yeux ; survol : celui que le curseur vise ; auSol : la case d'un objet posé au sol */
  function meubler({ groupe, survol = null, auSol = null }) {
    const [c0, c1] = SALLE.tonneaux, [t0, t1] = SALLE.tables, [s0, s1, s2] = SALLE.tabourets, { client, cliente, cocher, gustav } = SALLE.gens;
    SALLE.comptoir.slice(0, 4).forEach(([i, j], n) => objet(i, j, (g, [x, y]) => { boite(g, x, y, A, B, 30, BOIS, 1, '#15100a'); if (n === 0) chope(g, x - 8, y - 30); if (n === 3) bougie(g, x + 6, y - 31); if (n === 2) { chope(g, x + 10, y - 27); chope(g, x - 16, y - 33); } }));
    SALLE.comptoir.slice(4).forEach(([i, j]) => objet(i, j, (g, [x, y]) => boite(g, x, y, A, B, 30, BOIS, 1, '#15100a')));
    objet(...c0, (g, [x, y]) => tonneau(g, x - 6, y)); objet(...c1, (g, [x, y]) => tonneau(g, x - 2, y + 2)); objet(...SALLE.tonneaux[2], (g, [x, y]) => tonneau(g, x, y + 2));
    objet(...t0, (g, p) => { table(g, ...p); chope(g, p[0] - 14, p[1] - 20); chope(g, p[0] + 12, p[1] - 14); bougie(g, p[0], p[1] - 20); });
    objet(...client, (g, [x, y]) => pion(g, [x + 8, y + 2], 'client', { camp: 'pnj', assis: true }), -.1);
    objet(...cliente, (g, [x, y]) => pion(g, [x - 6, y + 4], 'cliente', { camp: 'pnj', assis: true }), .1);
    objet(...s0, (g, [x, y]) => tabouret(g, x - 2, y + 2));
    objet(...t1, (g, p) => { table(g, ...p); chope(g, p[0] + 8, p[1] - 22); bougie(g, p[0] - 10, p[1] - 17); });
    objet(...cocher, (g, [x, y]) => pion(g, [x + 8, y + 2], 'cocher', { camp: 'pnj', assis: true }), -.1);
    objet(...s1, (g, [x, y]) => tabouret(g, x, y)); objet(...s2, (g, [x, y]) => tabouret(g, x - 4, y));
    objet(...SALLE.coffre, (g, [x, y]) => { el(g, 'ellipse', { cx: x + 6, cy: y + 8, rx: 40, ry: 16, fill: '#000', opacity: .4, filter: 'url(#f2)' }); boite(g, x, y, 30, 15, 26, BOIS, 0, '#15100a'); el(g, 'path', { d: `M${x - 30},${y - 17}L${x},${y - 2}L${x + 30},${y - 17}M${x - 10},${y - 21}v18M${x + 10},${y - 21}v18`, fill: 'none', stroke: '#c39c44', 'stroke-width': 2, opacity: .85 }); });
    objet(...SALLE.tonneaux[3], (g, [x, y]) => { tonneau(g, x - 4, y); });
    if (auSol) objet(...auSol, laDague);
    objet(...gustav, (g, [x, y]) => pion(g, [x - 22, y + 1], 'gustav', { camp: 'pnj', vise: survol === 'gustav' }), -.2);
    if (groupe) Object.entries(groupe).forEach(([nom, c]) => objet(...c, (g, p) => pion(g, p, nom, { mene: nom === 'mira' })));
  }
  /* le fond se ferme sur la salle ; colonne : le bord gauche s'assombrit sous les gestes ; sombre : la scène recule */
  function fermerLaSalle({ colonne = false, sombre = 0 } = {}) {
    el(S, 'rect', { width: W, height: H, fill: 'url(#vignette)' });
    if (colonne) el(S, 'rect', { x: 0, y: 0, width: 330, height: H, fill: 'url(#gauche)' });
    el(S, 'ellipse', { cx: 1640, cy: 600, rx: 430, ry: 260, fill: 'url(#droite)' });
    el(S, 'rect', { x: 0, y: 500, width: W, height: 280, fill: 'url(#bas)' });
    if (sombre) el(S, 'rect', { width: W, height: H, fill: '#06040a', opacity: sombre });
  }

  /* la vue isométrique. groupe : 'entree' (le groupe traverse la salle), 'comptoir' (il parle à Gustav) ou 'avis' ;
     survol : 'gustav' ; trajet : le chemin pointé ; avis : l'avis placardé luit ; sombre : la scène recule derrière une
     page ; dague : la dague est posée au sol ; croisee : la croisée du mur de droite luit, on peut l'enjamber */
  function sceneAuberge({ groupe = 'entree', survol = null, trajet = false, avis = false, sombre = 0, colonne = false, dague = false, croisee = false } = {}) {
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
    { const [x, y] = P(...SALLE.tapis); el(S, 'path', { d: losange(x, y, A * 2.6, B * 1.6), fill: '#6a2a1e', opacity: .55, stroke: '#c9a44c', 'stroke-width': 1.4, 'stroke-opacity': .5 }); el(S, 'path', { d: losange(x, y, A * 2.1, B * 1.25), fill: 'none', stroke: '#c9a44c', 'stroke-width': .8, opacity: .4 }); }
    // les murs à colombages : mur de gauche (face sud-est), mur de droite (face sud-ouest)
    { const r = alea(29); const g = el(S, 'g'); const murs = [];
      for (let i = 4; i <= 26; i++) murs.push([i, MJ]); for (let j = -2; j <= 22; j++) murs.push([MI, j]);
      murs.sort((p, q) => (p[0] + p[1]) - (q[0] + q[1]));
      for (const [i, j] of murs) { const [x, y] = P(i, j); const t = r() * .25; boite(g, x, y, A, B, HM, [melange('#241a12', '#1a120c', t), melange('#93805f', '#7d6b4f', t), melange('#77664c', '#655640', t)], 0, 'rgba(40,28,16,.5)'); }
      for (let j = 22; j >= -1; j--) colombageDeGauche(g, seF(j), j);
      for (let i = 4; i <= 26; i++) colombageDeDroite(g, soF(i), i);
      // fenêtres, la nuit dehors
      SALLE.fenetresDeGauche.forEach((j) => fenetre(g, seF(j))); SALLE.fenetresDeDroite.forEach((i) => fenetre(g, soF(i), croisee && i === CROISEE));
      porteDeLaCour(g, seF(SALLE.porte)); atre(g, seF(SALLE.atre)); etageres(g, soF(SALLE.etageres)); avisPlacarde(g, soF(SALLE.avis), avis);
    }
    const FEU = P(4.5, 7);
    el(S, 'ellipse', { cx: FEU[0] + 60, cy: FEU[1] + 40, rx: 600, ry: 330, fill: 'url(#lueur)', style: 'mix-blend-mode:screen', opacity: .9 });
    el(S, 'ellipse', { cx: 1110, cy: 330, rx: 380, ry: 230, fill: 'url(#lueur)', style: 'mix-blend-mode:screen', opacity: .45 });
    // ce que le groupe dessine au sol
    const GROUPE = SALLE.groupes[groupe];
    { const g = el(S, 'g'); if (trajet) chemin(g, [GROUPE.mira, [11, 5], [11, 4], [11, 3]]); }
    meubler({ groupe: GROUPE, survol, auSol: dague ? SALLE.dague : null });
    poser();
    fermerLaSalle({ colonne, sombre });
  }

  /* ───────── la même salle, vue du dessus (`lieuDessus`) ───────── */
  function sceneAubergeDessus({ dague = false, croisee = false } = {}) {
    const lieu = lieuDessus;
    const ombre = (g, x, y, r) => el(g, 'circle', { cx: x + 4, cy: y + 5, r, fill: '#000', opacity: .45, filter: 'url(#f2)' });
    const trait = { stroke: '#15100a', 'stroke-width': .9 };
    el(S, 'rect', { width: W, height: H, fill: '#07080d' });
    // le plancher
    { const r = alea(17); const g = el(S, 'g', { stroke: '#22160d', 'stroke-width': 1.2 });
      for (let i = MI + 1; i < 23; i++) for (let j = MJ + 1; j < 32; j++) {
        const [x, y] = lieu(i, j);
        el(g, 'rect', { x: x - T / 2, y: y - T / 2, width: T, height: T, fill: melange('#5b4230', '#74573c', r()) });
        el(g, 'path', { d: `M${x},${y - T / 2}v${T}`, opacity: .75 });
      } }
    { const coin = (di, dj) => lieu(SALLE.tapis[0] + di, SALLE.tapis[1] + dj).join(','); const bords = (k) => `M${coin(1.3 * k, -1.3 * k)}L${coin(.8 * k, .8 * k)}L${coin(-1.3 * k, 1.3 * k)}L${coin(-.8 * k, -.8 * k)}Z`;
      el(S, 'path', { d: bords(1), fill: '#6a2a1e', opacity: .55, stroke: '#c9a44c', 'stroke-width': 1.4, 'stroke-opacity': .5 }); el(S, 'path', { d: bords(.8), fill: 'none', stroke: '#c9a44c', 'stroke-width': .8, opacity: .4 }); }
    // les murs, vus par leur faîte, et leurs percements
    { const g = el(S, 'g'); const haut = DY + T, bord = DX - T;
      el(g, 'path', { d: `M0,${DY}H${DX}V${H}H${bord}V${haut}H0Z`, fill: '#1d140d', stroke: '#0c0705', 'stroke-width': 1 });
      el(g, 'path', { d: `M0,${haut}H${bord}V${H}`, fill: 'none', stroke: '#93805f', 'stroke-width': 3 });
      for (let j = MJ + 1; j < 32; j += 2) el(g, 'path', { d: `M${dx(j + .5)},${DY}v${T}`, stroke: '#2e1f14', 'stroke-width': 4 });
      for (let i = MI + 1; i < 23; i += 2) el(g, 'path', { d: `M${bord},${dy(i + .5)}h${T}`, stroke: '#2e1f14', 'stroke-width': 4 });
      const vitre = { fill: '#1b2540', stroke: '#2e1f14', 'stroke-width': 3 };
      SALLE.fenetresDeGauche.forEach((j) => el(g, 'rect', { x: dx(j + .3), y: DY + T * .3, width: T * .58, height: T * .4, ...vitre }));
      SALLE.fenetresDeDroite.forEach((i) => { const luit = croisee && i === CROISEE;
        if (luit) el(g, 'circle', { cx: DX - T / 2, cy: dy(i), r: 46, fill: 'url(#coeur)', opacity: .85, style: 'mix-blend-mode:screen' });
        el(g, 'rect', { x: bord + T * .3, y: dy(i - .29), width: T * .4, height: T * .58, ...vitre, stroke: luit ? '#f3dc93' : vitre.stroke }); });
      { const x = dx(SALLE.porte + .42); el(g, 'rect', { x, y: DY, width: T * .84, height: T, fill: '#2e1f14' }); el(g, 'rect', { x: x + 3, y: DY + T * .3, width: T * .84 - 6, height: T * .7, fill: '#7a5632', stroke: '#120b06', 'stroke-width': .8 }); el(g, 'circle', { cx: x + T * .22, cy: haut - T * .22, r: 2.4, fill: '#e2c06a' }); }
      { const x = dx(SALLE.atre + .58), l = T * 2.16; el(g, 'rect', { x, y: DY + T * .2, width: l, height: T * 1.15, fill: '#6a6773', stroke: '#15131a', 'stroke-width': .9 }); el(g, 'rect', { x: x + T * .34, y: DY + T * .62, width: l - T * .68, height: T * .73, fill: '#120b08', stroke: '#15131a', 'stroke-width': .9 });
        el(g, 'circle', { cx: x + l / 2, cy: haut + T * .2, r: 60, fill: 'url(#coeur)', style: 'mix-blend-mode:screen' }); flammes(g, x + l / 2, haut + T * .3, .3); }
      { const y = dy(SALLE.etageres - .4), r = alea(46); el(g, 'rect', { x: bord - 8, y, width: 8, height: T * 3.8, fill: '#2e1f14' }); for (let v = 5; v < T * 3.8; v += 8) el(g, 'circle', { cx: bord - 4, cy: y + v, r: 2.6, fill: ['#3d5a3a', '#6a4c2e', '#8a3a26', '#b9a57b'][r() * 4 | 0] }); }
      el(g, 'rect', { x: bord - 4, y: dy(SALLE.avis - .28), width: 4, height: T * .58, fill: '#e6d5ad' });
    }
    { const [x, y] = lieu(MI + 1.5, SALLE.atre - .5); el(S, 'ellipse', { cx: x, cy: y + 30, rx: 520, ry: 400, fill: 'url(#lueur)', style: 'mix-blend-mode:screen', opacity: .9 }); }
    { const [x, y] = lieu(...SALLE.comptoir[3]); el(S, 'ellipse', { cx: x, cy: y, rx: 300, ry: 300, fill: 'url(#lueur)', style: 'mix-blend-mode:screen', opacity: .45 }); }
    // le mobilier, vu par son dessus
    const g = el(S, 'g');
    const chopeVue = (x, y) => el(g, 'circle', { cx: x, cy: y, r: 3, fill: '#b9b3a4', stroke: '#2a221b', 'stroke-width': .7 });
    const bougieVue = (x, y) => { el(g, 'circle', { cx: x, cy: y, r: 24, fill: 'url(#coeur)', opacity: .7, style: 'mix-blend-mode:screen' }); el(g, 'circle', { cx: x, cy: y, r: 2.4, fill: '#ffd778' }); };
    SALLE.comptoir.forEach((c) => { const [x, y] = lieu(...c); el(g, 'rect', { x: x - T / 2 + 5, y: y - T / 2 + 6, width: T, height: T, fill: '#000', opacity: .45, filter: 'url(#f2)' }); });
    SALLE.comptoir.forEach(([i, j], n) => { const [x, y] = lieu(i, j); el(g, 'rect', { x: x - T / 2, y: y - T / 2, width: T, height: T, fill: '#4a3320', stroke: '#15100a', 'stroke-width': 1.6 }); el(g, 'path', { d: `M${x},${y - T / 2}v${T}`, ...trait, opacity: .55 }); if (n === 0 || n === 2) chopeVue(x + 6, y - 5); if (n === 2) chopeVue(x - 9, y + 8); if (n === 3) bougieVue(x - 4, y + 6); });
    SALLE.tonneaux.forEach((c) => { const [x, y] = lieu(...c); ombre(g, x, y, 15); el(g, 'circle', { cx: x, cy: y, r: 14, fill: BOIS[1], stroke: '#1d1b1a', 'stroke-width': 2.4 }); el(g, 'circle', { cx: x, cy: y, r: 9.5, fill: 'none', ...trait, opacity: .6 }); el(g, 'path', { d: `M${x - 9},${y}h18`, ...trait, opacity: .6 }); });
    SALLE.tabourets.forEach((c) => { const [x, y] = lieu(...c); el(g, 'circle', { cx: x, cy: y, r: 8, fill: BOIS[1], ...trait }); });
    SALLE.tables.forEach((c) => { const [x, y] = lieu(...c); ombre(g, x, y, 34); el(g, 'circle', { cx: x, cy: y, r: 32, fill: '#7d5e3c', ...trait }); el(g, 'path', { d: `M${x - 11},${y - 30}v60M${x + 11},${y - 30}v60`, stroke: '#3f2c1a', 'stroke-width': .8, opacity: .55 }); chopeVue(x - 12, y + 9); chopeVue(x + 13, y - 8); bougieVue(x + 2, y + 2); });
    { const [x, y] = lieu(...SALLE.coffre); ombre(g, x, y, 22); el(g, 'rect', { x: x - 21, y: y - 13, width: 42, height: 26, rx: 2, fill: BOIS[0], ...trait }); el(g, 'path', { d: `M${x - 7},${y - 13}v26M${x + 7},${y - 13}v26`, stroke: '#c39c44', 'stroke-width': 2, opacity: .85 }); }
    if (dague) laDague(g, lieu(...SALLE.dague));
    // les gens, vus par leur dessus : `vers`, où ils regardent (0 = le mur de l'âtre, en degrés horaires)
    const gens = (c, nom, vers, { heros = false, mene = false } = {}) => { const [x, y] = lieu(...c); const { t, peau, cheveux, coiffe, large = 1 } = GENS[nom];
      if (mene) el(g, 'circle', { cx: x, cy: y, r: 30, fill: '#ffe2a6', opacity: .5, filter: 'url(#f6)' });
      ombre(g, x, y, 15);
      if (heros) el(g, 'circle', { cx: x, cy: y, r: 17, fill: '#201915', stroke: '#e9dcc0', 'stroke-width': mene ? 3 : 2 });
      const f = el(g, 'g', { transform: `translate(${x},${y}) rotate(${vers})` });
      el(f, 'ellipse', { cx: 0, cy: 1, rx: 11.5 * large, ry: 7, fill: `url(#${t})`, stroke: '#15100b', 'stroke-width': .8 });
      if (coiffe === 'chapeau') el(f, 'circle', { cx: 0, cy: 0, r: 9.5, fill: cheveux, stroke: '#15100b', 'stroke-width': .6 });
      el(f, 'circle', { cx: 0, cy: 0, r: 6, fill: coiffe === 'chauve' ? peau : cheveux, stroke: '#15100b', 'stroke-width': .6 });
      if (coiffe !== 'chapeau') el(f, 'path', { d: 'M-3.500,-4.500Q0,-8.500 3.500,-4.500Q0,-5.500 -3.500,-4.500Z', fill: peau }); };
    const { client, cliente, cocher, gustav } = SALLE.gens;
    gens([client[0] - .15, client[1]], 'client', 180); gens([cliente[0] + .15, cliente[1]], 'cliente', 0); gens([cocher[0] - .15, cocher[1]], 'cocher', 180);
    gens([gustav[0] - .24, gustav[1] + .24], 'gustav', -90);
    Object.entries(SALLE.groupes.entree).forEach(([nom, c]) => gens(c, nom, 0, { heros: true, mene: nom === 'mira' }));
    fermerLaSalle({ colonne: true });
  }

  /* ───────── la même salle, par les yeux du meneur (`lieuAuxYeux`) ─────────
     `dague` : elle est posée au sol là où tombe le point de mire, au centre de l'écran. */
  function sceneAubergeAuxYeux({ dague = false } = {}) {
    const [ci, cj] = [CI, CJ], F = FOCALE, FAITE = 1.45, PRES = .3, CASE = 65, lieu = lieuAuxYeux;
    const dalle = (i, j) => { const pres = Math.min(i + .5, ci - PRES); return 'M' + [lieu(i - .5, j + .5), lieu(i - .5, j - .5), lieu(pres, j - .5), lieu(pres, j + .5)].map((p) => p.join(',')).join('L') + 'Z'; };
    el(S, 'rect', { width: W, height: H, fill: '#0d0906' });
    // le plafond et ses solives
    { const g = el(S, 'g'); for (let i = MI + 1; i < ci; i++) { const [, y0] = lieu(i - .5, cj, FAITE), [, y1] = lieu(i - .32, cj, FAITE); el(g, 'rect', { x: 0, y: y1, width: W, height: y0 - y1, fill: '#2e1f14', stroke: '#120b06', 'stroke-width': .7 }); } }
    // le plancher
    { const r = alea(17); const g = el(S, 'g', { stroke: '#22160d', 'stroke-width': 1.2, 'stroke-linejoin': 'round' });
      for (let i = MI + 1; i <= ci; i++) for (let j = MJ + 1; j < cj + 24; j++) {
        el(g, 'path', { d: dalle(i, j), fill: melange('#5b4230', '#74573c', r()) });
        el(g, 'path', { d: `M${lieu(i - .5, j).join(',')}L${lieu(Math.min(i + .5, ci - PRES), j).join(',')}`, opacity: .75 });
      } }
    // le mur de l'âtre, en face, et le mur de droite
    const enFace = (j) => (u, v) => lieu(MI + .5, j + .5 - u, v * FAITE), aDroite = (i) => (u, v) => lieu(i - .5 + u, MJ + .5, v * FAITE);
    { const g = el(S, 'g'), enduit = (t) => ({ fill: melange('#93805f', '#7d6b4f', t), stroke: 'rgba(40,28,16,.5)', 'stroke-width': .9 }), r = alea(29);
      for (let j = cj + 23; j > MJ; j--) { quad(g, enFace(j), 0, 0, 1, 1, enduit(r() * .25)); colombageDeGauche(g, enFace(j), j); }
      for (let i = MI + 1; i < ci; i++) { quad(g, aDroite(i), 0, 0, 1, 1, enduit(.5 + r() * .25)); colombageDeDroite(g, aDroite(i), i); }
      SALLE.fenetresDeGauche.forEach((j) => fenetre(g, enFace(j)));
      porteDeLaCour(g, enFace(SALLE.porte)); atre(g, enFace(SALLE.atre), F / ((ci - MI - .5) * CASE));
    }
    { const [x, y] = lieu(MI + .5, SALLE.atre - .5); el(S, 'ellipse', { cx: x, cy: y + 30, rx: 640, ry: 360, fill: 'url(#lueur)', style: 'mix-blend-mode:screen', opacity: .9 }); }
    // le mobilier et les gens, chacun à l'échelle de sa distance, du plus lointain au plus proche
    meubler({ groupe: null, auSol: dague ? [ci - F / (H / 2 - HORIZON), cj] : null });
    objets.filter((o) => ci - o.i > .6).sort((p, q) => p.i - q.i).forEach((o) => { const [x, y] = lieu(o.i, o.j); o.dessine(el(S, 'g', { transform: `translate(${x},${y}) scale(${F / ((ci - o.i) * CASE)})` }), [0, 0]); });
    objets.length = 0;
    fermerLaSalle({ colonne: true });
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

  /* le centre de la marque d'une chose de la scène, sous le regard `regard` : la porte de la cour, l'avis et la croisée
     sur leur mur, les gens au-dessus de leur tête, ce qui est posé au sol ; au point de mire, ce qu'il vise */
  const hausse = ([x, y], [ex, ey]) => [x + ex, y + ey];
  const MARQUES = {
    tactique: {
      porte: () => seF(SALLE.porte)(.5, 1), avis: () => soF(SALLE.avis)(.5, 1), croisee: () => soF(CROISEE)(.5, 1),
      coffre: () => hausse(P(...SALLE.coffre), [0, -46]), dague: () => hausse(P(...SALLE.dague), [0, -32]),
      cocher: () => hausse(P(...SALLE.gens.cocher), [8, -84]), cliente: () => hausse(P(...SALLE.gens.cliente), [-6, -76]),
      gustav: () => hausse(P(...SALLE.gens.gustav), [-22, -86]), corps: () => hausse(P(10, 5), [0, -20]),
    },
    plateau: {
      porte: () => hausse(lieuDessus(MI, SALLE.porte), [0, -34]), avis: () => hausse(lieuDessus(SALLE.avis, MJ), [0, -34]),
      croisee: () => hausse(lieuDessus(CROISEE, MJ), [0, -34]), coffre: () => hausse(lieuDessus(...SALLE.coffre), [0, -34]),
      dague: () => hausse(lieuDessus(...SALLE.dague), [0, -34]), cocher: () => hausse(lieuDessus(...SALLE.gens.cocher), [0, -34]),
      cliente: () => hausse(lieuDessus(...SALLE.gens.cliente), [0, -34]), gustav: () => hausse(lieuDessus(...SALLE.gens.gustav), [0, -34]),
    },
    immersion: {
      porte: () => hausse(lieuAuxYeux(MI + .5, SALLE.porte, 1.16), [0, -26]), cliente: () => hausse(lieuAuxYeux(SALLE.gens.cliente[0] - .15, SALLE.gens.cliente[1], 1), [0, -26]),
      dague: () => [W / 2, H / 2],
    },
  };
  const pointDe = (id, regard) => vue(MARQUES[regard][id]());

  // Partagé avec `../rendu.js`.
  Object.assign(globalThis, { pointDe, sceneAuberge, sceneAubergeDessus, sceneAubergeAuxYeux, sceneRoute });
}
