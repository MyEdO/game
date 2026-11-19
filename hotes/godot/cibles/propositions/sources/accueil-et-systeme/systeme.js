/* Accueil et système, images d'intention (#3935). Ajouts au kit commun (commun.js) : pictogrammes, bustes des
   pré-tirés, outils de paysage, Altdorf. Maquette hors du jeu. */
Object.assign(BUSTES, {
  wanda: BUSTES.mira,
  johann: BASE + '<path d="M18 30h42l-2 5H20zM25 30c1-12 6-18 14-18s13 6 14 18z" fill="#1c1410"/>',
  kirsten: BASE + '<path d="M23 36c-3-15 5-25 16-25s19 10 16 25l-3 8c1-9-1-17-4-20-5-4-13-4-18 0-3 3-5 11-4 20z" fill="#1c1410"/>',
  harbull: '<path d="M16 90c0-15 8-21 19-23l-1-6c-8-4-11-14-7-22 4-8 20-8 24 0 4 8 1 18-7 22l-1 6c11 2 19 8 19 23z"/><path d="M24 40c-3-13 4-22 15-22s18 9 15 22c-2-7-8-10-15-10s-13 3-15 10z" fill="#1c1410"/>',
  sigrid: BASE + '<path d="M22 34c-2-14 6-23 17-23s19 9 17 23c-3-8-9-12-17-12s-14 4-17 12z" fill="#1c1410"/><path d="M36 13h6v12h-6zM31 17h16v4H31z" fill="#e9dcc0" opacity=".85"/>',
  malmir: '<path d="M16 90c0-17 7-25 19-27l-2-8c-6-5-8-15-5-23 3-8 19-8 22 0 3 8 1 18-5 23l-2 8c12 2 19 10 19 27z"/><path d="M25 37l-10-10 10 3zM53 37l10-10-10 3z"/><path d="M24 30c0-12 7-19 15-19s15 7 15 19c-10-5-20-5-30 0z" fill="#1c1410"/>',
});
/* la table : le fond des écrans posés hors du jeu */
const fondDeTable = () => { el(S, 'rect', { width: W, height: H, fill: '#150c07' }); return `<div class="calque bois" id="table"></div><div class="calque" id="lueur-table"></div>`; };
/* les quatre clous d'un registre relié */
const CLOUS = '<i class="clou" style="left:8px;top:8px"></i><i class="clou" style="right:8px;top:8px"></i><i class="clou" style="left:8px;bottom:8px"></i><i class="clou" style="right:8px;bottom:8px"></i>';

/* ───────── paysage ───────── */
const etoiles = (g, n, yMax, graine = 5) => { const r = alea(graine); for (let i = 0; i < n; i++) { const y = r() * yMax; el(g, 'circle', { cx: r() * W, cy: y, r: .5 + r() * 1.1, fill: '#fff', opacity: (.25 + r() * .6) * (1 - y / yMax * .8) }); } };
const crete = (y0, amp, pas, graine, x0 = -20, x1 = W + 20) => { const r = alea(graine); const pts = []; for (let x = x0; x <= x1; x += pas * (.6 + r() * .8)) pts.push([x, y0 - r() * amp]); return pts; };
const massif = (g, pts, bas, fill, extra = {}) => el(g, 'path', { d: 'M' + pts.map((p) => p.join(',')).join('L') + `L${W + 20},${bas}L-20,${bas}Z`, fill, ...extra });
const nuages = (g, bandes, fill, filtre = 'f8') => bandes.forEach(([cx, cy, rx, ry, o]) => el(g, 'ellipse', { cx, cy, rx, ry, fill, opacity: o, filter: `url(#${filtre})` }));
const lisiere = (g, y, n, hMin, hMax, fill, graine, x0 = 0, x1 = W) => { const r = alea(graine); const a = []; for (let i = 0; i < n; i++) a.push([x0 + r() * (x1 - x0), y + r() * 10, hMin + r() * (hMax - hMin)]); a.sort((p, q) => p[1] - q[1]).forEach(([x, yy, h]) => sapin(g, x, yy, h, fill)); };
/* Altdorf sur sa rive : remparts, tours, flèches, le temple de Sigmar, le palais. Se dessine dans `hote` */
const altdorf = (hote) => {
  const g = el(hote, 'g', { fill: '#1d1532' }); const r = alea(42); const base = 532;
  const fen = el(hote, 'g', { fill: '#ffd98a' });
  const toit = (x, w, h, t) => `M${x},${base}V${base - h}L${x + w / 2},${base - h - t}L${x + w},${base - h}V${base}Z`;
  // les toits de la ville, deux rangs
  for (let rangee = 0; rangee < 2; rangee++) for (let x = 742; x < 1590;) {
    const w = 14 + r() * 20, h = (rangee ? 20 : 40) + r() * (rangee ? 26 : 34) + 46 * Math.exp(-(((x - 1150) / 260) ** 2));
    el(g, 'path', { d: toit(x, w, h, w * (.5 + r() * .5)), fill: rangee ? '#1d1532' : '#2c2146' });
    if (r() < .55) el(fen, 'rect', { x: x + w * .3, y: base - h * (.35 + r() * .4), width: 2.6, height: 3.6, opacity: .55 + r() * .45 });
    x += w * (.7 + r() * .4);
  }
  // tours et flèches
  const tour = (x, w, h, fleche, c = '#1d1532') => { el(g, 'path', { d: `M${x},${base}V${base - h}h${-w * .12}v-6h${w * 1.24}v6h${-w * .12}V${base}Z`, fill: c }); el(g, 'path', { d: `M${x - w * .16},${base - h - 6}L${x + w / 2},${base - h - fleche}L${x + w * 1.16},${base - h - 6}Z`, fill: c }); el(fen, 'rect', { x: x + w / 2 - 1.5, y: base - h * .7, width: 3, height: 5, opacity: .9 }); };
  tour(842, 20, 96, 44, '#2c2146'); tour(948, 16, 118, 60); tour(1010, 26, 84, 34, '#2c2146'); tour(1262, 18, 132, 70); tour(1340, 24, 96, 40, '#2c2146'); tour(1452, 18, 88, 46); tour(1528, 22, 70, 30, '#2c2146');
  // le temple de Sigmar : nef, deux flèches, rosace
  el(g, 'path', { d: `M1096,${base}V${base - 118}L1140,${base - 164}L1184,${base - 118}V${base}Z` });
  el(g, 'path', { d: `M1082,${base}V${base - 150}L1093,${base - 214}L1104,${base - 150}V${base}ZM1176,${base}V${base - 150}L1187,${base - 214}L1198,${base - 150}V${base}Z` });
  el(g, 'path', { d: `M1091.500,${base - 226}h3v9h5v3h-5v10h-3v-10h-5v-3h5zM1185.500,${base - 226}h3v9h5v3h-5v10h-3v-10h-5v-3h5z` });
  el(fen, 'circle', { cx: 1140, cy: base - 112, r: 8, opacity: .95 });
  el(fen, 'path', { d: `M1118,${base - 40}v-30a4 4 0 0 1 8 0v30zM1136,${base - 40}v-36a4 4 0 0 1 8 0v36zM1154,${base - 40}v-30a4 4 0 0 1 8 0v30z`, opacity: .85 });
  // le palais et son dôme
  el(g, 'path', { d: `M1380,${base}V${base - 84}h66V${base}Z`, fill: '#2c2146' });
  el(g, 'path', { d: `M1386,${base - 84}C1386,${base - 128} 1440,${base - 128} 1440,${base - 84}ZM1411.500,${base - 132}h3v16h-3z`, fill: '#2c2146' });
  // le rempart, au bord de l'eau
  let d = `M720,${base + 22}V${base - 14}`; for (let x = 720; x < 1610; x += 12) d += `h7v-6h5v6`; d += `V${base + 22}Z`;
  el(g, 'path', { d, fill: '#140f24' });
  [760, 900, 1040, 1300, 1470, 1596].forEach((x) => el(g, 'path', { d: `M${x},${base + 22}V${base - 30}h-3v-7h6v4h5v-4h6v4h5v-4h6v7h-3V${base + 22}Z`, fill: '#140f24' }));
  el(g, 'path', { d: `M1150,${base + 22}V${base - 44}h-4v-8h8v5h7v-5h8v5h7v-5h8v5h7v-5h8v8h-4V${base + 22}Z`, fill: '#140f24' });
  el(hote, 'path', { d: `M1168,${base + 22}v-20a11 11 0 0 1 22 0v20z`, fill: '#ffcf80' });
  [[770, 6], [912, 8], [1050, 5], [1311, 7], [1480, 6]].forEach(([x, dy]) => el(fen, 'rect', { x, y: base - 16 - dy, width: 3, height: 5, opacity: .8 }));
};
// Partagé avec les scripts de page chargés après celui-ci.
Object.assign(globalThis, { fondDeTable, CLOUS, outil, etoiles, crete, massif, nuages, lisiere, altdorf });
