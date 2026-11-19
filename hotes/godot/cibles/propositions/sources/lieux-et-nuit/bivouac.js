/* Le décor du bivouac : la clairière de la halte du soir, sous la nuit de gel (`../rendu.js`, gabarit `lieu-et-voyage`). */
rims('#e09a48', '#0b0806');
grad('ciel', [[0, '#070a18'], [.38, '#121a3c'], [.74, '#2c3566'], [1, '#575a8c']]);
grad('sol', [[0, '#24253a'], [.35, '#17161f'], [1, '#07060a']]);
grad('toile', [[0, '#3a2a1e'], [.55, '#8a5c34'], [1, '#c98a48']], { x1: 0, y1: 0, x2: 1, y2: 0 });
radial('halo', [[0, '#dfe6ff', .5], [.4, '#8f9ad8', .14], [1, '#8f9ad8', 0]]);
el(S, 'rect', { width: W, height: 410, fill: 'url(#ciel)' });
{ // la voûte : étoiles, voie lactée, lune
  const r = alea(11);
  el(S, 'ellipse', { cx: 606, cy: 120, rx: 760, ry: 70, fill: '#8f9ad8', opacity: .1, filter: 'url(#f18)', transform: 'rotate(-12 606 120)' });
  for (let n = 0; n < 420; n++) { const x = r() * W, y = r() * 370, s = r(); el(S, 'circle', { cx: x, cy: y, r: .35 + s * s * 1.5, fill: s > .93 ? '#fff1cf' : '#e4e9ff', opacity: (.25 + r() * .75) * (1 - y / 490) }); }
  el(S, 'circle', { cx: 454, cy: 74, r: 90, fill: 'url(#halo)' });
  el(S, 'path', { d: 'M454,44A30,30 0 1 0 484,74A23,23 0 0 1 454,44Z', fill: '#f3ecd4' });
  for (const [x, y, w] of [[266, 270, 300], [766, 220, 380], [1166, 300, 280], [546, 310, 420]]) el(S, 'ellipse', { cx: x, cy: y, rx: w, ry: 9, fill: '#4a4f86', opacity: .3, filter: 'url(#f8)' });
}
{ // les lointains
  const r = alea(4); const crete = (y0, amp, pas, seed) => { const q = alea(seed); let d = `M0,${H}L0,${y0}`; for (let x = 0; x <= W + pas; x += pas) d += `L${x},${y0 - q() * amp}L${x + pas * .5},${y0 - q() * amp * .35}`; return d + `L${W},${H}Z`; };
  el(S, 'path', { d: crete(362, 86, 96, 3), fill: '#3a4070' });
  el(S, 'path', { d: crete(378, 40, 150, 8), fill: '#272c54' });
  el(S, 'rect', { y: 350, width: W, height: 90, fill: '#7a82c0', opacity: .28, filter: 'url(#f18)' });
  const g = el(S, 'g');
  for (let n = 0; n < 190; n++) { const x = r() * W; let h = 44 + r() * 86; if (x > -29 && x < 146) h = 26 + r() * 22; sapin(g, x, 402 + r() * 10, h, melange('#0d1022', '#1a2040', r())); }
}
el(S, 'rect', { y: 398, width: W, height: H - 398, fill: 'url(#sol)' });
el(S, 'rect', { y: 388, width: W, height: 60, fill: '#8a90c8', opacity: .2, filter: 'url(#f8)' });
el(S, 'path', { d: 'M-64,422C-14,388 36,380 76,382C126,384 166,400 206,422Z', fill: '#0d0e18' }); // la butte
el(S, 'path', { d: 'M1493,440C1346,450 1166,490 936,610L1126,610C1266,530 1386,490 1493,475Z', fill: '#1d1b24', opacity: .9 }); // le chemin
// le feu éclaire la clairière
el(S, 'ellipse', { cx: 646, cy: 555, rx: 680, ry: 210, fill: 'url(#lueur)', style: 'mix-blend-mode:screen' });
el(S, 'ellipse', { cx: 646, cy: 560, rx: 330, ry: 90, fill: 'url(#lueur)', style: 'mix-blend-mode:screen', opacity: .8 });
el(S, 'ellipse', { cx: 646, cy: 440, rx: 420, ry: 260, fill: 'url(#lueur)', style: 'mix-blend-mode:screen', opacity: .32 });
{ // herbes du sol
  const r = alea(21); const g = el(S, 'g', { stroke: '#050508', 'stroke-width': 1.2, fill: 'none', opacity: .8 });
  for (let n = 0; n < 240; n++) { const x = r() * W, y = 420 + r() * 170; el(g, 'path', { d: `M${x},${y}q2,-${5 + r() * 6} 4,0q2,-${4 + r() * 5} 4,0` }); }
}
const G = el(S, 'g');
// la roche du guet
el(G, 'path', { d: 'M816,482L838,440L868,422L922,418L952,440L968,482Z', fill: '#16161f' });
el(G, 'path', { d: 'M816,482L838,440L868,422L876,440L854,482Z', fill: '#4a3222', opacity: .8 });
perso(G, 896, 420, 66, { coiffe: 'casque', fill: '#ffe2a6', extra: '<path d="M17,-2L21,-98" stroke="#ffe2a6" stroke-width="3" fill="none"/>' }).setAttribute('opacity', .34);
// la tente
el(G, 'ellipse', { cx: 226, cy: 510, rx: 86, ry: 9, fill: '#000', opacity: .5, filter: 'url(#f2)' });
el(G, 'path', { d: 'M158,510L222,416L248,510Z', fill: '#17120f' });
el(G, 'path', { d: 'M222,416L298,510L248,510Z', fill: 'url(#toile)' });
el(G, 'path', { d: 'M254,510L264,472L278,510Z', fill: '#120c08' });
el(G, 'path', { d: 'M222,416L222,408M298,510L326,518M158,510L136,518', stroke: '#0a0705', 'stroke-width': 1.6 });
// la diligence dételée, au bord du chemin
{
  const g = el(G, 'g', { fill: '#08070a' });
  el(g, 'ellipse', { cx: 1026, cy: 536, rx: 90, ry: 8, opacity: .55, filter: 'url(#f2)' });
  el(g, 'path', { d: 'M964,462h118c5,0 8,3 8,8v40h-134v-40c0,-5 3,-8 8,-8zM958,456h130v7h-130zM982,444h34v12h-34zM1026,440h44v16h-44zM1090,490l44,22v5l-44,-14z' });
  el(g, 'rect', { x: 976, y: 472, width: 22, height: 20, fill: '#d99a48', opacity: .55 });
  for (const cx of [986, 1062]) { el(g, 'circle', { cx, cy: 516, r: 21, fill: 'none', stroke: '#08070a', 'stroke-width': 4 }); for (let a = 0; a < 6; a++) el(g, 'path', { d: `M${cx},516L${cx + 20 * Math.cos(a * Math.PI / 3)},${516 + 20 * Math.sin(a * Math.PI / 3)}`, stroke: '#08070a', 'stroke-width': 2 }); }
  const cheval = (x, y, s) => { const c = el(G, 'g', { transform: `translate(${x},${y}) scale(${s})`, fill: '#0a090c' }); el(c, 'path', { d: 'M-40,-52C-20,-60 14,-60 30,-54C36,-66 44,-80 52,-86L60,-84L58,-76C66,-70 70,-62 68,-56L60,-56C54,-56 50,-52 46,-44C44,-34 38,-28 30,-26L32,0L26,0L22,-24L-22,-24L-26,0L-32,0L-32,-26C-40,-30 -44,-40 -40,-52ZM-40,-50C-50,-44 -52,-30 -50,-16L-46,-16C-46,-28 -44,-38 -38,-44Z' }); };
  cheval(1206, 530, .82);
}
// le feu
{
  const x = 646, y = 548;
  el(G, 'ellipse', { cx: x, cy: y + 4, rx: 50, ry: 13, fill: '#1a1210' });
  for (let a = 0; a < 9; a++) { const t = a / 9 * Math.PI * 2; el(G, 'ellipse', { cx: x + 46 * Math.cos(t), cy: y + 4 + 12 * Math.sin(t), rx: 8, ry: 5.5, fill: Math.sin(t) > 0 ? '#2a2422' : '#5a4636' }); }
  el(G, 'circle', { cx: x, cy: y - 34, r: 120, fill: 'url(#coeur)', style: 'mix-blend-mode:screen', opacity: .8 });
  el(G, 'path', { d: `M${x - 34},${y + 2}L${x + 26},${y - 12}M${x + 34},${y + 2}L${x - 26},${y - 12}M${x - 6},${y + 6}L${x + 4},${y - 16}`, stroke: '#1c110b', 'stroke-width': 8, 'stroke-linecap': 'round' });
  flammes(G, x, y - 4, .82);
  const r = alea(2); for (let n = 0; n < 26; n++) el(G, 'circle', { cx: x - 30 + r() * 60, cy: y - 80 - r() * 150, r: .8 + r() * 1.2, fill: '#ffc76e', opacity: .3 + r() * .6 });
}
// la couche vide, le mannequin d'exercice
el(G, 'path', { d: 'M334,566c-2,-12 6,-18 18,-18l66,2c10,0 14,6 14,14l-2,6z', fill: '#4a3120' });
el(G, 'path', { d: 'M418,550c10,0 14,6 14,14l-2,6l-14,0z', fill: '#a06a38' });
el(G, 'ellipse', { cx: 342, cy: 556, rx: 11, ry: 8, fill: '#6a5038' });
el(G, 'path', { d: 'M771,560L771,486M748,504L794,504M771,486a9,9 0 1 0 .1,0', stroke: '#1a100a', 'stroke-width': 7, 'stroke-linecap': 'round', fill: '#1a100a' });
el(G, 'path', { d: 'M767,560L767,490M748,501L770,501', stroke: '#c98a48', 'stroke-width': 1.6, opacity: .8 });
// les héros dans la clairière
perso(G, 58, 384, 62, { coiffe: 'capuche', fill: '#080a14' });
el(G, 'ellipse', { cx: 556, cy: 562, rx: 40, ry: 7, fill: '#000', opacity: .5, filter: 'url(#f2)' });
perso(G, 546, 560, 86, { pose: 'assis', fill: 'url(#rimD)', extra: '<path d="M14,-36l24,-7 4,12 -24,7z" fill="#e9d6a6"/><path d="M-16,0h22v-9h-22z" fill="#0b0806"/>' });
// premier plan : lisière sombre
{
  const g = el(S, 'g', { fill: '#030305' });
  sapin(g, -224, 770, 640, '#030305'); sapin(g, 1502, 790, 560, '#030305');
  const r = alea(9); for (let n = 0; n < 90; n++) { const x = r() * 250 + (n % 2 ? -214 : 1243), y = 610 + r() * 140; el(g, 'path', { d: `M${x},${y}q3,-${14 + r() * 20} 6,0` }); }
}
fermer();
el(S, 'rect', { width: 306, height: 230, fill: 'url(#haut)', opacity: .5 });
