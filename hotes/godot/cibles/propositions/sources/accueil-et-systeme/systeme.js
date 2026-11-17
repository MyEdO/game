/* Accueil et système, images d'intention (#3935). Ajouts au kit commun (commun.js) : pictogrammes, bustes des
   pré-tirés, outils de paysage. Maquette hors du jeu. */
Object.assign(PICTOS, {
  croix: '<path d="M6 6l12 12M18 6L6 18"/>',
  gauche: '<path d="M14.500 5.500L8 12l6.500 6.500"/>',
  droite: '<path d="M9.500 5.500L16 12l-6.500 6.500"/>',
  plume: '<path d="M20 4c-7 0-12 4-13 11l-3 5M7 15c5 0 9-2 11-6M10.500 11.500l4 .5"/>',
  reseau: '<circle cx="6" cy="12" r="2.500"/><circle cx="18" cy="6" r="2.500"/><circle cx="18" cy="18" r="2.500"/><path d="M8.200 10.900l7.600-3.800M8.200 13.100l7.600 3.800"/>',
  disque: '<path d="M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6"/>',
  retour: '<path d="M9 6.500L4.500 11 9 15.500M4.500 11h9.500a4.500 4.500 0 0 1 0 9H10"/>',
  jouer: '<path d="M8 5l11 7-11 7z"/>',
  note: '<path d="M12 3v12.500M12 3l6 2v4l-6-2"/><ellipse cx="9" cy="16.500" rx="3.200" ry="2.500"/>',
  coche: '<path d="M5 12.500l4.500 4.500L19 7.500"/>',
  sceau: '<circle cx="12" cy="10" r="5.500"/><path d="M8.500 14.500L7 21l5-2.500L17 21l-1.500-6.500"/>',
});
Object.assign(BUSTES, {
  wanda: BUSTES.mira,
  johann: BASE + '<path d="M18 30h42l-2 5H20zM25 30c1-12 6-18 14-18s13 6 14 18z" fill="#1c1410"/>',
  kirsten: BASE + '<path d="M23 36c-3-15 5-25 16-25s19 10 16 25l-3 8c1-9-1-17-4-20-5-4-13-4-18 0-3 3-5 11-4 20z" fill="#1c1410"/>',
  harbull: '<path d="M16 90c0-15 8-21 19-23l-1-6c-8-4-11-14-7-22 4-8 20-8 24 0 4 8 1 18-7 22l-1 6c11 2 19 8 19 23z"/><path d="M24 40c-3-13 4-22 15-22s18 9 15 22c-2-7-8-10-15-10s-13 3-15 10z" fill="#1c1410"/>',
  sigrid: BASE + '<path d="M22 34c-2-14 6-23 17-23s19 9 17 23c-3-8-9-12-17-12s-14 4-17 12z" fill="#1c1410"/><path d="M36 13h6v12h-6zM31 17h16v4H31z" fill="#e9dcc0" opacity=".85"/>',
  malmir: '<path d="M16 90c0-17 7-25 19-27l-2-8c-6-5-8-15-5-23 3-8 19-8 22 0 3 8 1 18-5 23l-2 8c12 2 19 10 19 27z"/><path d="M25 37l-10-10 10 3zM53 37l10-10-10 3z"/><path d="M24 30c0-12 7-19 15-19s15 7 15 19c-10-5-20-5-30 0z" fill="#1c1410"/>',
});
const buste = (genre, style = '', classe = '') => `<div class="portrait laiton ${classe}" style="${style}"><div><svg viewBox="0 0 78 90" preserveAspectRatio="xMidYMax slice" fill="#2a1f17">${BUSTES[genre]}</svg></div></div>`;
const fermerRond = () => `<div id="fermer" data-piece="fermer">${rond('croix', 20)}</div>`;
const outil = (icone, libelle) => `<div class="outil">${rond(icone, 23)}<span class="rubrique ombre">${libelle}</span></div>`;

/* ───────── paysage ───────── */
const etoiles = (g, n, yMax, graine = 5) => { const r = alea(graine); for (let i = 0; i < n; i++) { const y = r() * yMax; el(g, 'circle', { cx: r() * W, cy: y, r: .5 + r() * 1.1, fill: '#fff', opacity: (.25 + r() * .6) * (1 - y / yMax * .8) }); } };
const crete = (y0, amp, pas, graine, x0 = -20, x1 = W + 20) => { const r = alea(graine); const pts = []; for (let x = x0; x <= x1; x += pas * (.6 + r() * .8)) pts.push([x, y0 - r() * amp]); return pts; };
const massif = (g, pts, bas, fill, extra = {}) => el(g, 'path', { d: 'M' + pts.map((p) => p.join(',')).join('L') + `L${W + 20},${bas}L-20,${bas}Z`, fill, ...extra });
const nuages = (g, bandes, fill, filtre = 'f8') => bandes.forEach(([cx, cy, rx, ry, o]) => el(g, 'ellipse', { cx, cy, rx, ry, fill, opacity: o, filter: `url(#${filtre})` }));
const lisiere = (g, y, n, hMin, hMax, fill, graine, x0 = 0, x1 = W) => { const r = alea(graine); const a = []; for (let i = 0; i < n; i++) a.push([x0 + r() * (x1 - x0), y + r() * 10, hMin + r() * (hMax - hMin)]); a.sort((p, q) => p[1] - q[1]).forEach(([x, yy, h]) => sapin(g, x, yy, h, fill)); };
// Partagé avec les scripts de page chargés après celui-ci.
Object.assign(globalThis, { buste, fermerRond, outil, etoiles, crete, massif, nuages, lisiere });
