/* La carte de Bögenhafen, à l'encre sur le parchemin, et ses lieux : l'emplacement de chacun sur la carte (844 × 572),
   son pictogramme. `dessinerLaVille(svg, epingles)` la trace dans `svg` et y plante une épingle par lieu, rouge pour le
   lieu choisi. Posé par `../rendu.js` (écran `interlude`). */
// un lieu par rang de 65 unités de haut (45 px dans le cadre), son étiquette ouverte vers l'intérieur, à gauche et à
// droite en alternance : deux étiquettes voisines ne se touchent pas, et les noms de la carte tiennent dans l'autre moitié
const LIEUX_DE_LA_VILLE = {
  camp: { x: 57, y: 80, icone: 'epee' }, forge: { x: 673, y: 145, icone: 'enclume' }, temple: { x: 171, y: 210, icone: 'livre' },
  caserne: { x: 673, y: 275, icone: 'bouclier' }, taverne: { x: 171, y: 340, icone: 'chope' }, comptoir: { x: 673, y: 405, icone: 'pieces' },
  quais: { x: 171, y: 470, icone: 'ancre' }, armes: { x: 673, y: 535, icone: 'epee' },
};
const dessinerLaVille = (M, epingles) => {
  const encre = '#3a2a18';
  const MUR = [[150, 196], [352, 92], [500, 74], [652, 78], [772, 152], [802, 332], [742, 492], [542, 550], [300, 534], [148, 384]];
  const dedans = (x, y) => { let c = false; for (let i = 0, j = MUR.length - 1; i < MUR.length; j = i++) { const [xi, yi] = MUR[i], [xj, yj] = MUR[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
  const riv = (x) => 512 - x * .41 + 14 * Math.sin(x / 90);
  // la campagne : arbres, chemins
  const r = alea(14); const g0 = el(M, 'g', { stroke: encre, 'stroke-width': 1, fill: 'none', opacity: .55 });
  for (let n = 0; n < 70; n++) { const x = r() * 844, y = r() * 572; if (dedans(x, y) || Math.abs(y - riv(x)) < 40) continue; el(g0, 'path', { d: `M${x - 6},${y + 6}L${x},${y - 7}L${x + 6},${y + 6}ZM${x},${y + 6}v4` }); }
  for (const d of ['M0,300C50,296 100,300 148,300', 'M802,300C820,296 834,300 844,296', 'M500,74C502,50 498,24 502,0', 'M420,542C424,556 420,566 424,572']) el(M, 'path', { d, stroke: encre, 'stroke-width': 1.4, 'stroke-dasharray': '6 5', fill: 'none', opacity: .7 });
  // la Bögen
  let d = ''; for (let x = -10; x <= 860; x += 20) d += `${x < 0 ? 'M' : 'L'}${x},${riv(x)}`;
  el(M, 'path', { d, stroke: '#5f7a80', 'stroke-width': 40, fill: 'none', opacity: .9 });
  el(M, 'path', { d, stroke: '#a9bdbd', 'stroke-width': 35, fill: 'none' });
  for (let x = 30; x < 840; x += 74) el(M, 'path', { d: `M${x},${riv(x) + 4}q6,-4 12,0t12,0`, stroke: '#5f7a80', 'stroke-width': 1, fill: 'none' });
  // les maisons
  const g1 = el(M, 'g', { stroke: encre, 'stroke-width': .9, fill: 'rgba(90,60,30,.18)', opacity: .8 });
  for (let n = 0; n < 520; n++) { const x = 150 + r() * 660, y = 70 + r() * 490; if (!dedans(x, y) || Math.abs(y - riv(x)) < 30) continue; const w = 9 + r() * 10, h = 6 + r() * 6; el(g1, 'rect', { x: -w / 2, y: -h / 2, width: w, height: h, transform: `translate(${x},${y}) rotate(${-22 + r() * 30})` }); }
  // les quartiers, en pointillé
  for (const d of ['M352,92C360,180 330,260 300,360', 'M500,74C520,160 560,220 600,270', 'M150,300C240,330 300,340 330,372', 'M430,340C470,420 440,480 420,542', 'M560,286C600,380 660,440 742,492']) el(M, 'path', { d, stroke: encre, 'stroke-width': 1.1, 'stroke-dasharray': '4 5', fill: 'none', opacity: .65 });
  // le rempart, ses tours, ses portes, le pont
  el(M, 'path', { d: 'M' + MUR.map((p) => p.join(',')).join('L') + 'Z', stroke: encre, 'stroke-width': 5, fill: 'none', 'stroke-linejoin': 'round' });
  el(M, 'path', { d: 'M' + MUR.map((p) => p.join(',')).join('L') + 'Z', stroke: '#d8c49a', 'stroke-width': 2, fill: 'none', 'stroke-linejoin': 'round' });
  for (const [x, y] of MUR) el(M, 'rect', { x: x - 6, y: y - 6, width: 12, height: 12, fill: '#e6d5ad', stroke: encre, 'stroke-width': 1.8 });
  for (const [x, y] of [[148, 300], [802, 300], [500, 74], [420, 542]]) el(M, 'path', { d: `M${x - 8},${y + 7}v-12h4v-4h8v4h4v12z`, fill: encre });
  el(M, 'path', { d: `M452,${riv(452) - 24}L470,${riv(470) + 24}`, stroke: '#e6d5ad', 'stroke-width': 11 });
  el(M, 'path', { d: `M452,${riv(452) - 24}L470,${riv(470) + 24}M441,${riv(452) - 20}L459,${riv(470) + 28}M463,${riv(452) - 28}L481,${riv(470) + 20}`, stroke: encre, 'stroke-width': 1.6 });
  const nom = (x, y, t, o = {}) => el(M, 'text', { x, y, 'text-anchor': 'middle', 'font-family': 'Fell', 'font-style': 'italic', 'font-size': 15, fill: encre, opacity: .85, ...o }, t);
  // les noms, dans la moitié de chaque rang que l'étiquette du lieu laisse libre (`LIEUX_DE_LA_VILLE`)
  nom(148, 105, 'la Fosse'); nom(694, 171, 'Quartier des artisans'); nom(148, 236, 'Altstadt'); nom(640, 301, 'Göttenplatz'); nom(200, 366, 'Teuerberg'); nom(148, 496, 'Dreieckeplatz'); nom(650, 431, 'Adel Ring');
  nom(790, 431, 'la Bögen', { 'font-size': 12, fill: '#3f5a60', transform: 'rotate(-22 790 431)' });
  const petit = (x, y, t) => el(M, 'text', { x, y, 'text-anchor': 'middle', 'font-family': 'Fell SC', 'font-size': 10.5, 'letter-spacing': 1, fill: encre, opacity: .8 }, t);
  petit(55, 366, 'Porte Ouest'); petit(694, 40, 'Porte de l’Eau'); petit(790, 301, 'Porte Est'); petit(422, 556, 'La Poterne');
  // la rose des vents
  const c = el(M, 'g', { transform: 'translate(70,500)', stroke: encre, fill: 'none', 'stroke-width': 1, opacity: .7 });
  el(c, 'circle', { r: 16 }); el(c, 'path', { d: 'M0,-26L5,0L0,26L-5,0ZM-26,0L0,-5L26,0L0,5Z' });
  // les épingles des lieux
  for (const l of epingles) el(M, 'circle', { cx: l.x, cy: l.y, r: 6.5, fill: l.choisi ? '#c8452c' : '#2a1d12', stroke: '#e6d5ad', 'stroke-width': 1.6 });
};
Object.assign(globalThis, { LIEUX_DE_LA_VILLE, dessinerLaVille });
