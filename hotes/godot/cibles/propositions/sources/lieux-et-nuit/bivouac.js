/* Le bivouac : la halte du soir en voyage. Chaque héros règle son couchage et sa nourriture sur sa carte du bandeau. */
rims('#e09a48', '#0b0806');
grad('ciel', [[0, '#070a18'], [.38, '#121a3c'], [.74, '#2c3566'], [1, '#575a8c']]);
grad('sol', [[0, '#24253a'], [.35, '#17161f'], [1, '#07060a']]);
grad('toile', [[0, '#3a2a1e'], [.55, '#8a5c34'], [1, '#c98a48']], { x1: 0, y1: 0, x2: 1, y2: 0 });
radial('halo', [[0, '#dfe6ff', .5], [.4, '#8f9ad8', .14], [1, '#8f9ad8', 0]]);
el(S, 'rect', { width: W, height: 440, fill: 'url(#ciel)' });
{ // la voûte : étoiles, voie lactée, lune
  const r = alea(11);
  el(S, 'ellipse', { cx: 820, cy: 150, rx: 760, ry: 70, fill: '#8f9ad8', opacity: .1, filter: 'url(#f18)', transform: 'rotate(-12 820 150)' });
  for (let n = 0; n < 420; n++) { const x = r() * W, y = r() * 400, s = r(); el(S, 'circle', { cx: x, cy: y, r: .35 + s * s * 1.5, fill: s > .93 ? '#fff1cf' : '#e4e9ff', opacity: (.25 + r() * .75) * (1 - y / 520) }); }
  el(S, 'circle', { cx: 668, cy: 104, r: 90, fill: 'url(#halo)' });
  el(S, 'path', { d: 'M668,74A30,30 0 1 0 698,104A23,23 0 0 1 668,74Z', fill: '#f3ecd4' });
  for (const [x, y, w] of [[480, 300, 300], [980, 250, 380], [1380, 330, 280], [760, 340, 420]]) el(S, 'ellipse', { cx: x, cy: y, rx: w, ry: 9, fill: '#4a4f86', opacity: .3, filter: 'url(#f8)' });
}
{ // les lointains
  const r = alea(4); const crete = (y0, amp, pas, seed) => { const q = alea(seed); let d = `M0,${H}L0,${y0}`; for (let x = 0; x <= W + pas; x += pas) d += `L${x},${y0 - q() * amp}L${x + pas * .5},${y0 - q() * amp * .35}`; return d + `L${W},${H}Z`; };
  el(S, 'path', { d: crete(392, 86, 96, 3), fill: '#3a4070' });
  el(S, 'path', { d: crete(408, 40, 150, 8), fill: '#272c54' });
  el(S, 'rect', { y: 380, width: W, height: 90, fill: '#7a82c0', opacity: .28, filter: 'url(#f18)' });
  const g = el(S, 'g');
  for (let n = 0; n < 190; n++) { const x = r() * W; let h = 44 + r() * 86; if (x > 185 && x < 360) h = 26 + r() * 22; sapin(g, x, 432 + r() * 10, h, melange('#0d1022', '#1a2040', r())); }
}
el(S, 'rect', { y: 428, width: W, height: 352, fill: 'url(#sol)' });
el(S, 'rect', { y: 418, width: W, height: 60, fill: '#8a90c8', opacity: .2, filter: 'url(#f8)' });
el(S, 'path', { d: 'M150,452C200,418 250,410 290,412C340,414 380,430 420,452Z', fill: '#0d0e18' }); // la butte
el(S, 'path', { d: 'M1707,470C1560,480 1380,520 1150,640L1340,640C1480,560 1600,520 1707,505Z', fill: '#1d1b24', opacity: .9 }); // le chemin
// le feu éclaire la clairière
el(S, 'ellipse', { cx: 860, cy: 585, rx: 680, ry: 210, fill: 'url(#lueur)', style: 'mix-blend-mode:screen' });
el(S, 'ellipse', { cx: 860, cy: 590, rx: 330, ry: 90, fill: 'url(#lueur)', style: 'mix-blend-mode:screen', opacity: .8 });
el(S, 'ellipse', { cx: 860, cy: 470, rx: 420, ry: 260, fill: 'url(#lueur)', style: 'mix-blend-mode:screen', opacity: .32 });
{ // herbes du sol
  const r = alea(21); const g = el(S, 'g', { stroke: '#050508', 'stroke-width': 1.2, fill: 'none', opacity: .8 });
  for (let n = 0; n < 240; n++) { const x = r() * W, y = 450 + r() * 170; el(g, 'path', { d: `M${x},${y}q2,-${5 + r() * 6} 4,0q2,-${4 + r() * 5} 4,0` }); }
}
const G = el(S, 'g');
// la roche du guet
el(G, 'path', { d: 'M1030,512L1052,470L1082,452L1136,448L1166,470L1182,512Z', fill: '#16161f' });
el(G, 'path', { d: 'M1030,512L1052,470L1082,452L1090,470L1068,512Z', fill: '#4a3222', opacity: .8 });
perso(G, 1110, 450, 66, { coiffe: 'casque', fill: '#ffe2a6', extra: '<path d="M17,-2L21,-98" stroke="#ffe2a6" stroke-width="3" fill="none"/>' }).setAttribute('opacity', .34);
// la tente
el(G, 'ellipse', { cx: 440, cy: 540, rx: 86, ry: 9, fill: '#000', opacity: .5, filter: 'url(#f2)' });
el(G, 'path', { d: 'M372,540L436,446L462,540Z', fill: '#17120f' });
el(G, 'path', { d: 'M436,446L512,540L462,540Z', fill: 'url(#toile)' });
el(G, 'path', { d: 'M468,540L478,502L492,540Z', fill: '#120c08' });
el(G, 'path', { d: 'M436,446L436,438M512,540L540,548M372,540L350,548', stroke: '#0a0705', 'stroke-width': 1.6 });
// la diligence dételée, au bord du chemin
{
  const g = el(G, 'g', { fill: '#08070a' });
  el(g, 'ellipse', { cx: 1240, cy: 566, rx: 90, ry: 8, opacity: .55, filter: 'url(#f2)' });
  el(g, 'path', { d: 'M1178,492h118c5,0 8,3 8,8v40h-134v-40c0,-5 3,-8 8,-8zM1172,486h130v7h-130zM1196,474h34v12h-34zM1240,470h44v16h-44zM1304,520l44,22v5l-44,-14z' });
  el(g, 'rect', { x: 1190, y: 502, width: 22, height: 20, fill: '#d99a48', opacity: .55 });
  for (const cx of [1200, 1276]) { el(g, 'circle', { cx, cy: 546, r: 21, fill: 'none', stroke: '#08070a', 'stroke-width': 4 }); for (let a = 0; a < 6; a++) el(g, 'path', { d: `M${cx},546L${cx + 20 * Math.cos(a * Math.PI / 3)},${546 + 20 * Math.sin(a * Math.PI / 3)}`, stroke: '#08070a', 'stroke-width': 2 }); }
  const cheval = (x, y, s) => { const c = el(G, 'g', { transform: `translate(${x},${y}) scale(${s})`, fill: '#0a090c' }); el(c, 'path', { d: 'M-40,-52C-20,-60 14,-60 30,-54C36,-66 44,-80 52,-86L60,-84L58,-76C66,-70 70,-62 68,-56L60,-56C54,-56 50,-52 46,-44C44,-34 38,-28 30,-26L32,0L26,0L22,-24L-22,-24L-26,0L-32,0L-32,-26C-40,-30 -44,-40 -40,-52ZM-40,-50C-50,-44 -52,-30 -50,-16L-46,-16C-46,-28 -44,-38 -38,-44Z' }); };
  cheval(1420, 560, .82);
}
// le feu
{
  const x = 860, y = 578;
  el(G, 'ellipse', { cx: x, cy: y + 4, rx: 50, ry: 13, fill: '#1a1210' });
  for (let a = 0; a < 9; a++) { const t = a / 9 * Math.PI * 2; el(G, 'ellipse', { cx: x + 46 * Math.cos(t), cy: y + 4 + 12 * Math.sin(t), rx: 8, ry: 5.5, fill: Math.sin(t) > 0 ? '#2a2422' : '#5a4636' }); }
  el(G, 'circle', { cx: x, cy: y - 34, r: 120, fill: 'url(#coeur)', style: 'mix-blend-mode:screen', opacity: .8 });
  el(G, 'path', { d: `M${x - 34},${y + 2}L${x + 26},${y - 12}M${x + 34},${y + 2}L${x - 26},${y - 12}M${x - 6},${y + 6}L${x + 4},${y - 16}`, stroke: '#1c110b', 'stroke-width': 8, 'stroke-linecap': 'round' });
  flammes(G, x, y - 4, .82);
  const r = alea(2); for (let n = 0; n < 26; n++) el(G, 'circle', { cx: x - 30 + r() * 60, cy: y - 80 - r() * 150, r: .8 + r() * 1.2, fill: '#ffc76e', opacity: .3 + r() * .6 });
}
// la couche vide, le mannequin d'exercice
el(G, 'path', { d: 'M548,596c-2,-12 6,-18 18,-18l66,2c10,0 14,6 14,14l-2,6z', fill: '#4a3120' });
el(G, 'path', { d: 'M632,580c10,0 14,6 14,14l-2,6l-14,0z', fill: '#a06a38' });
el(G, 'ellipse', { cx: 556, cy: 586, rx: 11, ry: 8, fill: '#6a5038' });
el(G, 'path', { d: 'M985,590L985,516M962,534L1008,534M985,516a9,9 0 1 0 .1,0', stroke: '#1a100a', 'stroke-width': 7, 'stroke-linecap': 'round', fill: '#1a100a' });
el(G, 'path', { d: 'M981,590L981,520M962,531L984,531', stroke: '#c98a48', 'stroke-width': 1.6, opacity: .8 });
// les héros dans la clairière
perso(G, 110, 566, 72, { pose: 'accroupi', coiffe: 'bonnet', fill: '#1b2242', vers: -1, extra: '<path d="M-26,0C-40,-8 -48,-22 -44,-40" stroke="#1b2242" stroke-width="2.500" fill="none"/>' });
perso(G, 272, 414, 62, { coiffe: 'capuche', fill: '#080a14' });
el(G, 'ellipse', { cx: 770, cy: 592, rx: 40, ry: 7, fill: '#000', opacity: .5, filter: 'url(#f2)' });
perso(G, 760, 590, 86, { pose: 'assis', fill: 'url(#rimD)', extra: '<path d="M14,-36l24,-7 4,12 -24,7z" fill="#e9d6a6"/><path d="M-16,0h22v-9h-22z" fill="#0b0806"/>' });
// premier plan : lisière sombre
{
  const g = el(S, 'g', { fill: '#030305' });
  sapin(g, -10, 800, 640, '#030305'); sapin(g, 1716, 820, 560, '#030305');
  const r = alea(9); for (let n = 0; n < 90; n++) { const x = r() * 250 + (n % 2 ? 0 : 1457), y = 640 + r() * 140; el(g, 'path', { d: `M${x},${y}q3,-${14 + r() * 20} 6,0` }); }
}
fermer();
el(S, 'rect', { width: 520, height: 260, fill: 'url(#haut)', opacity: .5 });

const pieces = [];
pieces.push(titre({ icone: 'lune', nom: 'La halte du soir', sous: `14 Pflugzeit · troisième nuit · ${picto('flocon', 13, '#c9b995')} ciel clair, gel`, largeur: 436 }));
pieces.push(`<div id="recit" data-piece="recit"><div class="r rubrique ombre">Dans le Reikwald, à l’écart du chemin</div><p class="ombre">La clairière est sèche et le bois mort ne manque pas.</p></div>`);
/* `src/noyau/restFlow.ts:163` (couchage et pitance par héros), `:486-512` ; `docs/regles-optionnelles.md:256` */
pieces.push(`<div id="camp" class="cadre bois" data-piece="campement"><div class="fond bois">
  <div class="rang-c"><span class="lab rubrique">Abri</span>${medaillon('tente', { taille: 'petit' })}<span class="v">Tente <em>· quatre dormeurs sous la toile</em></span></div>
  <div class="rang-c" style="margin-bottom:0"><span class="lab rubrique">Temps</span>${sceau('flocon')}<span class="v">Gel cette nuit : il faudra tenir contre le froid.</span></div>
  ${filet({ fondu: true })}
  <div class="t rubrique">Ce que la nuit jouera</div>
  <div class="jouera">${rond('flocon', 'menu', { arme: true })}Le froid<span class="rubrique">Résistance</span></div>
  <div class="jouera">${rond('sommeil', 'menu', { arme: true })}Le repos<span class="rubrique">une nuit</span></div>
  ${plaque('Passer la nuit', { armee: true, icone: 'lune', classe: 'nuit' })}
</div>${ruban('Le campement')}${ferrures}</div>`);
const choix = (ration) => ({ html: `<div class="choix-h"><span class="rubrique">Couchage</span><b>Dehors</b></div><div class="choix-h"><span class="rubrique">Nourriture</span>${plaque('Ration', { armee: ration, taille: 'petite' })}${plaque('Rien', { armee: !ration, taille: 'petite' })}</div>` });
pieces.push(bandeau({ bjorn: choix(true), mira: choix(true), aldric: choix(true), greta: choix(false) }));
pieces.push(retour('Reprendre la route', 'route'), coins());
monter(pieces);
