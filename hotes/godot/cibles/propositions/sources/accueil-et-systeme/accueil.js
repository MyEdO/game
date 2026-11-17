/* L'écran titre (#3935) : la compagnie sur la crête, Altdorf au couchant, la comète à deux queues. */
grad('ciel', [[0, '#090d22'], [.3, '#1c1d48'], [.5, '#4a3266'], [.64, '#9a4f66'], [.76, '#e08a4e'], [.86, '#f6c877'], [1, '#f6c877']]);
radial('soleil', [[0, '#fff1c4', 1], [.18, '#ffd487', .8], [.5, '#f08f4a', .3], [1, '#f08f4a', 0]]);
grad('queue', [[0, '#fff6dc', .95], [.25, '#ffe2a8', .5], [1, '#ffd08a', 0]], { x1: 0, y1: 1, x2: 1, y2: 0 });
grad('fleuve', [[0, '#f6c877'], [.5, '#c9785a'], [1, '#3a2a52']]);
grad('ombre-g', [[0, '#04030a', .9], [.4, '#04030a', .5], [.7, '#04030a', .12], [1, '#04030a', 0]], { x1: 0, y1: 0, x2: 1, y2: 0 });
grad('brume', [[0, '#f0a868', 0], [.6, '#f0a868', .32], [1, '#f0a868', 0]]);
rims('#f4b86a', '#0a0710');

el(S, 'rect', { width: W, height: H, fill: 'url(#ciel)' });
etoiles(el(S, 'g'), 170, 330, 11);
// la comète à deux queues
{
  const g = el(S, 'g', { transform: 'translate(1238,150) rotate(-8)' });
  el(g, 'path', { d: 'M0,0C70,-34 190,-78 330,-96C210,-58 90,-22 0,6Z', fill: 'url(#queue)', filter: 'url(#f2)' });
  el(g, 'path', { d: 'M0,0C80,-6 210,-10 350,2C220,10 90,12 0,7Z', fill: 'url(#queue)', filter: 'url(#f2)' });
  el(g, 'circle', { cx: 0, cy: 3, r: 26, fill: 'url(#coeur)' });
  el(g, 'circle', { cx: 0, cy: 3, r: 5, fill: '#fffbea' });
}
nuages(el(S, 'g'), [[420, 250, 380, 14, .5], [980, 300, 460, 16, .55], [1500, 262, 300, 12, .45], [700, 352, 330, 12, .5], [1320, 372, 380, 13, .5], [200, 392, 300, 12, .4]], '#3b2a5c');
nuages(el(S, 'g'), [[1010, 420, 420, 10, .5], [1420, 438, 300, 8, .45], [640, 446, 260, 8, .4]], '#f3a66a', 'f4');
el(S, 'ellipse', { cx: 1090, cy: 508, rx: 560, ry: 250, fill: 'url(#soleil)' });
// montagnes, collines
massif(S, crete(470, 120, 60, 21), 600, '#6b5486');
massif(S, crete(500, 60, 46, 8), 600, '#4d3d6c');
el(S, 'rect', { x: 0, y: 440, width: W, height: 90, fill: 'url(#brume)' });

// Altdorf : remparts, tours, flèches, sur l'autre rive
{
  const g = el(S, 'g', { fill: '#1d1532' }); const r = alea(42); const base = 532;
  const fen = el(S, 'g', { fill: '#ffd98a' });
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
  el(S, 'path', { d: `M1168,${base + 22}v-20a11 11 0 0 1 22 0v20z`, fill: '#ffcf80' });
  [[770, 6], [912, 8], [1050, 5], [1311, 7], [1480, 6]].forEach(([x, dy]) => el(fen, 'rect', { x, y: base - 16 - dy, width: 3, height: 5, opacity: .8 }));
}
// le Reik
el(S, 'path', { d: 'M560,556C760,548 1000,550 1707,552V600C1300,596 900,610 520,640Z', fill: 'url(#fleuve)' });
el(S, 'path', { d: 'M560,556C760,548 1000,550 1707,552V600C1300,596 900,610 520,640Z', fill: '#2a1c44', opacity: .28 });
{
  const g = el(S, 'g', { stroke: '#ffe2a0', 'stroke-linecap': 'round', opacity: .55 }); const r = alea(9);
  for (let i = 0; i < 46; i++) { const y = 560 + r() * 44, x = 900 + (r() - .5) * (360 + (y - 560) * 9), w = 8 + r() * 26; el(g, 'path', { d: `M${x},${y}h${w}`, 'stroke-width': .8 + r() * 1.2, opacity: .3 + r() * .7 }); }
  // le pont, des barges
  const p = el(S, 'g', { fill: '#140f24' });
  el(p, 'path', { d: 'M1084,553h196v7h-196zM1096,560h9v22h-9zM1140,560h9v24h-9zM1184,560h9v24h-9zM1228,560h9v22h-9zM1262,560h10v18h-10z' });
  el(p, 'path', { d: 'M1105,560a17.500 13 0 0 1 35 0zM1149,560a17.500 13 0 0 1 35 0zM1193,560a17.500 13 0 0 1 35 0z', fill: 'none', stroke: '#140f24', 'stroke-width': 3 });
  el(p, 'path', { d: 'M820,584h46l-6,7h-34zM840,584v-22l14,18zM1420,574h34l-5,6h-24zM1434,574v-17l11,14z' });
}
// la rive d'en face, les bois
massif(S, [[-20, 590], [200, 580], [420, 596], [640, 612], [860, 640], [1100, 632], [1300, 618], [1500, 604], [1727, 596]], 800, '#2b2144');
lisiere(S, 606, 46, 30, 62, '#1a1430', 3, 0, 700);
lisiere(S, 624, 30, 28, 52, '#1a1430', 13, 1340, 1707);
// la crête du premier plan et la route
el(S, 'path', { d: 'M-20,700C200,640 420,640 640,664C860,690 1040,700 1200,676C1380,650 1540,640 1727,660V800H-20Z', fill: '#0a0710' });
el(S, 'path', { d: 'M1040,800C1100,740 1180,700 1262,680C1230,700 1190,740 1170,800Z', fill: '#2a1c2c', opacity: .9 });
el(S, 'path', { d: 'M1262,680C1300,670 1330,664 1352,660', stroke: '#2a1c2c', 'stroke-width': 5, fill: 'none', opacity: .8 });
// la compagnie, de dos, sur la crête
{
  const g = el(S, 'g'); const N = '#0a0710';
  const baton = `<path d="M17,-70L27,-116" stroke="${N}" stroke-width="3" fill="none"/><circle cx="27.500" cy="-118" r="3.500"/>`;
  const arc = `<path d="M-21,-98C-36,-72 -36,-34 -21,-8" stroke="${N}" stroke-width="2.400" fill="none"/><path d="M-21,-98L-21,-8" stroke="${N}" stroke-width=".8" fill="none"/>`;
  const epee = `<path d="M13,-50L31,-2" stroke="${N}" stroke-width="3" fill="none"/><path d="M9,-46L18,-50" stroke="${N}" stroke-width="3" fill="none"/>`;
  const sac = '<path d="M-17,-70C-23,-66 -23,-46 -17,-40L-6,-40L-6,-70Z"/>';
  perso(g, 742, 686, 128, { fill: N, coiffe: 'bonnet', extra: arc });
  perso(g, 806, 692, 116, { fill: N, coiffe: 'capuche', extra: sac });
  perso(g, 868, 696, 124, { fill: N, coiffe: 'chapeau', extra: baton });
  perso(g, 936, 700, 134, { fill: N, coiffe: 'casque', extra: epee });
  el(g, 'path', { d: 'M1010,704v-24a9 9 0 0 1 18 0v24z', fill: N });
}
// les sapins qui ferment la gauche et la droite
{
  const g = el(S, 'g');
  [[-10, 800, 640], [86, 800, 520], [182, 800, 420], [270, 800, 300], [1700, 800, 330], [1640, 800, 250], [1580, 800, 170]].forEach(([x, y, h]) => sapin(g, x, y, h, '#06040a'));
}
el(S, 'rect', { x: 0, y: 0, width: 860, height: H, fill: 'url(#ombre-g)' });
el(S, 'rect', { width: W, height: H, fill: 'url(#vignette)', opacity: .8 });
el(S, 'rect', { x: 0, y: 660, width: W, height: 120, fill: 'url(#bas)', opacity: .7 });

monter([
  `<div id="blason" data-piece="titre">
     <div class="sur rubrique ombre">Jeu de rôle dans le Vieux Monde</div>
     <div class="nom gothique" data-texte="titre">Warhammer Fantasy</div>
     <div class="filet-l"><i></i></div>
     <div class="camp gothique ombre">L’Ennemi Intérieur</div>
   </div>`,
  `<div id="entrees" data-piece="entrées">
     ${plaque('Reprendre', { armee: true, icone: 'jouer' })}
     <div class="dernier ombre"><span class="rubrique">Steinbruck</span> · 14 Pflugzeit 2512 CI · 18:20</div>
     ${plaque('Jouer', { icone: 'route' })}
     ${plaque('Jouer en ligne', { icone: 'reseau' })}
   </div>`,
  `<div id="outils" data-piece="outils">${outil('epee', 'Combat')}${outil('enclume', 'Atelier')}${outil('plume', 'Éditeur')}${outil('livre', 'Compendium')}${outil('systeme', 'Options')}</div>`,
]);
