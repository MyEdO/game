/* La nuit à l'auberge : la salle de la Fin du Voyage, la chambre et le repas, la soirée de chacun. */
rims('#f0a850', '#0c0705');
grad('mur', [[0, '#1d120a'], [.5, '#3a2413'], [1, '#4a2e17']]);
grad('plancher', [[0, '#4a2e18'], [.4, '#2c1a0e'], [1, '#0c0705']]);
grad('hotte', [[0, '#120b07'], [1, '#2a1a10']]);
grad('comptoir', [[0, '#3a2414'], [1, '#150c07']]);
radial('chandelle', [[0, '#ffe7a8', .9], [.25, '#ffb85c', .4], [1, '#ffb85c', 0]]);
const SOL = 470;
el(S, 'rect', { width: W, height: SOL, fill: 'url(#mur)' });
el(S, 'rect', { y: SOL, width: W, height: H - SOL, fill: 'url(#plancher)' });
{ // colombages du fond, poutres du plafond, lames du plancher
  const g = el(S, 'g', { fill: '#170d07' });
  for (let x = 470; x < W; x += 172) el(g, 'rect', { x, y: 40, width: 15, height: SOL - 40 });
  el(g, 'rect', { x: 0, y: 0, width: W, height: 46 });
  el(g, 'rect', { x: 0, y: 46, width: W, height: 6, fill: '#3a2414' });
  for (let k = 0; k < 9; k++) { const x = 380 + k * 150; el(g, 'path', { d: `M${x},0L${x + 34},0L${860 + (x - 860) * .72 + 22},46L${860 + (x - 860) * .72},46Z`, fill: '#0d0704' }); }
  const p = el(S, 'g', { stroke: '#0c0604', 'stroke-width': 1.4, opacity: .7 });
  for (let k = -14; k <= 14; k++) el(p, 'path', { d: `M${860 + k * 70},${SOL}L${860 + k * 230},${H}` });
  el(S, 'rect', { y: SOL - 3, width: W, height: 6, fill: '#0f0805' });
}
el(S, 'ellipse', { cx: 880, cy: 520, rx: 700, ry: 300, fill: 'url(#lueur)', style: 'mix-blend-mode:screen', opacity: .75 });
const G = el(S, 'g');
// la galerie des chambres, à l'étage
{
  const g = el(G, 'g');
  el(g, 'rect', { x: 1040, y: 52, width: 667, height: 196, fill: '#24160c' });
  for (const [x, ouverte] of [[1108, 0], [1262, 1], [1416, 0], [1570, 0]]) {
    el(g, 'path', { d: `M${x},248V150a36,36 0 0 1 72,0V248Z`, fill: ouverte ? '#e8a850' : '#120a06', stroke: '#0c0604', 'stroke-width': 3 });
    if (!ouverte) el(g, 'circle', { cx: x + 60, cy: 196, r: 2.5, fill: '#c9a44c' });
  }
  el(g, 'circle', { cx: 1298, cy: 190, r: 120, fill: 'url(#chandelle)', style: 'mix-blend-mode:screen', opacity: .55 });
  perso(g, 1298, 248, 78, { fill: '#120a06' });
  // la lanterne du palier
  el(g, 'path', { d: 'M1220,52v52', stroke: '#0c0604', 'stroke-width': 2 });
  el(g, 'path', { d: 'M1211,104h18l3,22h-24z', fill: '#ffd98a' });
  el(g, 'circle', { cx: 1220, cy: 116, r: 70, fill: 'url(#chandelle)', style: 'mix-blend-mode:screen', opacity: .7 });
  // le plancher de la galerie et sa balustrade
  el(g, 'rect', { x: 1040, y: 204, width: 667, height: 5, fill: '#0f0805' });
  for (let x = 1050; x < 1707; x += 17) el(g, 'rect', { x, y: 208, width: 4, height: 40, fill: '#0f0805' });
  el(g, 'rect', { x: 1026, y: 246, width: 681, height: 18, fill: '#150c07' });
  el(g, 'rect', { x: 1026, y: 264, width: 681, height: 3, fill: '#4a2e17' });
  for (const x of [1040, 1392]) el(g, 'rect', { x, y: 264, width: 16, height: SOL - 264, fill: '#150c07' });
  // l'escalier, à droite
  let d = 'M1707,264'; for (let k = 0; k < 9; k++) d += `L${1700 - k * 15},${264 + k * 23}L${1700 - (k + 1) * 15},${264 + k * 23}`; el(g, 'path', { d: d + `L1565,${SOL}L1707,${SOL}Z`, fill: '#1a0f08' });
  el(g, 'path', { d: `M1690,222L1556,${SOL - 40}`, stroke: '#0f0805', 'stroke-width': 5 });
}
// l'âtre et sa hotte
{
  const x = 880;
  el(G, 'path', { d: `M${x - 62},46L${x + 62},46L${x + 150},300L${x - 150},300Z`, fill: 'url(#hotte)' });
  el(G, 'rect', { x: x - 158, y: 300, width: 316, height: 14, fill: '#0f0805' });
  el(G, 'rect', { x: x - 150, y: 314, width: 13, height: SOL - 314, fill: '#0f0805' });
  el(G, 'rect', { x: x + 137, y: 314, width: 13, height: SOL - 314, fill: '#0f0805' });
  el(G, 'rect', { x: x - 137, y: 314, width: 274, height: SOL - 314, fill: '#0a0503' });
  el(G, 'circle', { cx: x, cy: 420, r: 150, fill: 'url(#coeur)', style: 'mix-blend-mode:screen' });
  el(G, 'path', { d: `M${x - 137},346H${x + 137}`, stroke: '#0f0805', 'stroke-width': 3 });
  el(G, 'path', { d: `M${x + 44},346v40`, stroke: '#0f0805', 'stroke-width': 2 });
  flammes(G, x - 6, SOL - 12, 1.05);
  el(G, 'path', { d: `M${x + 22},386h44l-5,34h-34z`, fill: '#0c0705' });
  el(G, 'path', { d: `M${x - 176},${SOL - 14}h352l14,34h-380z`, fill: '#2a1b12' });
  el(G, 'path', { d: `M${x - 176},${SOL - 14}h352v5h-352z`, fill: '#6a4426' });
}
// le comptoir, ses fûts, l'aubergiste
{
  const g = el(G, 'g');
  for (const cx of [540, 640]) { el(g, 'circle', { cx, cy: 356, r: 40, fill: '#20130a', stroke: '#0c0604', 'stroke-width': 5 }); el(g, 'circle', { cx, cy: 356, r: 27, fill: 'none', stroke: '#0c0604', 'stroke-width': 2 }); el(g, 'circle', { cx, cy: 368, r: 4.5, fill: '#9c2a1a' }); }
  perso(g, 600, 470, 150, { coiffe: 'chignon', fill: '#0c0705' });
  el(g, 'rect', { x: 484, y: 398, width: 300, height: 12, fill: '#5a3a20' });
  el(g, 'path', { d: `M484,410h300l14,${H - 410}h-314z`, fill: 'url(#comptoir)' });
  for (const x of [560, 636, 712]) el(g, 'path', { d: `M${x},414v230`, stroke: '#0c0604', 'stroke-width': 2, opacity: .6 });
  for (const x of [520, 742]) { el(g, 'path', { d: `M${x},380h15v18h-15zM${x + 15},384h5v9h-5`, fill: '#d9b98a', stroke: '#d9b98a', 'stroke-width': 1.5 }); }
  el(g, 'path', { d: 'M668,366v32M668,366', stroke: '#f3ecd4', 'stroke-width': 4 }); el(g, 'circle', { cx: 668, cy: 356, r: 44, fill: 'url(#chandelle)', style: 'mix-blend-mode:screen' }); el(g, 'path', { d: 'M668,366c-4,-6 0,-9 0,-14c4,5 4,8 0,14z', fill: '#ffe7a8' });
  perso(g, 716, 560, 132, { coiffe: 'bonnet', fill: '#0c0705' });
}
// une table ronde, ses convives, sa chandelle
const table = (x, y, rx, convives) => {
  el(G, 'ellipse', { cx: x, cy: y + 62, rx: rx * 1.1, ry: 14, fill: '#000', opacity: .5, filter: 'url(#f4)' });
  convives.filter((c) => c.derriere).forEach((c) => perso(G, x + c.dx, y + 26, c.h ?? 92, { pose: 'assis', ...c }));
  el(G, 'path', { d: `M${x - 6},${y}h12v58h20v5h-52v-5h20z`, fill: '#0c0705' });
  el(G, 'ellipse', { cx: x, cy: y + 5, rx, ry: rx * .2, fill: '#0c0705' });
  el(G, 'ellipse', { cx: x, cy: y, rx, ry: rx * .2, fill: '#5a3a20' });
  el(G, 'ellipse', { cx: x, cy: y, rx: rx * .8, ry: rx * .14, fill: '#8a5a30', opacity: .6 });
  el(G, 'circle', { cx: x, cy: y - 22, r: 46, fill: 'url(#chandelle)', style: 'mix-blend-mode:screen' });
  el(G, 'path', { d: `M${x},${y - 2}v-16`, stroke: '#f3ecd4', 'stroke-width': 3.5 }); el(G, 'path', { d: `M${x},${y - 18}c-4,-6 0,-9 0,-13c4,4 4,7 0,13z`, fill: '#ffe7a8' });
  convives.filter((c) => !c.derriere).forEach((c) => perso(G, x + c.dx, y + 70, c.h ?? 100, { pose: 'assis', ...c }));
};
// le box du barbier, sous la galerie
{
  el(G, 'rect', { x: 1408, y: 300, width: 150, height: SOL - 300, fill: '#150c07', opacity: .55 });
  perso(G, 1492, 470, 104, { pose: 'assis', coiffe: 'chapeau', fill: '#0c0705', vers: 1 });
  perso(G, 1612, 470, 100, { pose: 'assis', coiffe: 'chignon', fill: '#0c0705', vers: -1 });
  el(G, 'circle', { cx: 1552, cy: 404, r: 50, fill: 'url(#chandelle)', style: 'mix-blend-mode:screen' });
  el(G, 'rect', { x: 1522, y: 424, width: 62, height: 6, fill: '#5a3a20' }); el(G, 'rect', { x: 1548, y: 430, width: 8, height: 40, fill: '#0c0705' });
  el(G, 'path', { d: 'M1552,424v-14', stroke: '#f3ecd4', 'stroke-width': 3 }); el(G, 'path', { d: 'M1552,410c-4,-6 0,-9 0,-13c4,4 4,7 0,13z', fill: '#ffe7a8' });
  el(G, 'path', { d: 'M1528,424v-10h20v10zM1533,414c0,-7 10,-7 10,0', fill: '#2a1810', stroke: '#2a1810', 'stroke-width': 2 });
}
table(1010, 540, 84, [{ dx: -58, derriere: true, coiffe: 'capuche', fill: '#0c0705', vers: 1 }, { dx: 46, derriere: true, coiffe: 'chapeau', fill: '#0c0705', vers: -1 }, { dx: 96, fill: '#0c0705', vers: -1, coiffe: 'bonnet' }]);
table(1290, 566, 78, [{ dx: -36, derriere: true, coiffe: 'bonnet', fill: '#0c0705', vers: 1 }, { dx: 52, derriere: true, coiffe: 'chapeau', fill: '#0c0705', vers: -1 }]);
{ // les dés et les pièces, le tabouret libre
  const g = el(G, 'g', { fill: '#f1e6cc' });
  el(g, 'rect', { x: 1262, y: 560, width: 7, height: 7, transform: 'rotate(18 1265 563)' }); el(g, 'rect', { x: 1276, y: 566, width: 7, height: 7, transform: 'rotate(-12 1279 569)' });
  for (const [x, y] of [[1318, 562], [1326, 566], [1244, 568]]) el(g, 'ellipse', { cx: x, cy: y, rx: 5, ry: 2, fill: '#e2c06a' });
  el(G, 'path', { d: 'M1262,632h56v7h-8l4,40h-6l-5,-34h-26l-5,34h-6l4,-40h-8z', fill: '#0c0705' });
  el(G, 'ellipse', { cx: 1290, cy: 632, rx: 30, ry: 7, fill: '#ffe2a6', opacity: .5, filter: 'url(#f4)' });
}
fermer();
el(S, 'rect', { width: 560, height: H, fill: '#000', opacity: .28 });

const pieces = [];
pieces.push(titre({ icone: 'lit', nom: 'La Fin du Voyage', sous: 'Auberge · Teuerberg, Bögenhafen · le soir', largeur: 446 }));
/* LDB 66 l.5, l.12-16, l.28 ; `src/noyau/restFlow.ts:567-575`, `:692` ; #3004 */
const offre = (icone, nom, sous, prix, prise) => `<span class="l rubrique">${picto(icone, 17)}${nom}</span><span class="q rubrique">${sous}</span>${plaque(prix, { armee: prise })}`;
const NOTE = '6/–';
pieces.push(`<div id="nuit" class="cadre bois" data-piece="la nuit"><div class="fond bois">
  <div class="tete">${medaillon('chope', { petit: true })}<div><div class="n gothique" data-texte="hôte">Odelina Landau</div><div class="s rubrique">L’aubergiste</div></div></div>
  <div class="dit">Un lit chaud, un bon repas et pas de questions.</div>
  <div class="grille">
    ${offre('lit', 'Chambre commune', 'par tête', '10 sc')}
    ${offre('cle', 'Chambre privée', '2 lits', '10/–')}
    ${offre('cle', 'Grande chambre', '4 lits', '20/–', true)}
    ${offre('bol', 'Repas', 'par tête', '1/–', true)}
  </div>
  <div class="chambree"><span class="rubrique">Grande chambre</span>${HEROS.map((h) => portrait(h.id)).join('')}<i>4 lits sur 4</i></div>
  <div class="filet"></div>
  ${bourse({ parts: HEROS.map((h) => [h.nom.split(' ')[0], NOTE, h.bourse]), total: '1 CO 4/–' })}
  ${plaque('Passer la nuit', { armee: true, icone: 'lune', classe: 'nuit' })}
</div>${ferrures}</div>`);
const POSTES = [
  [716, 318, { nom: 'Boire', sous: 'Bière, la pinte · 3 sc', heros: 'bjorn' }],
  [1010, 376, { nom: 'Écouter les rumeurs', sous: 'Ragot', heros: 'mira' }],
  [1290, 404, { nom: 'Jouer', sous: 'Pari · une mise', icone: 'des' }],
  [1552, 262, { nom: 'Se faire soigner', sous: 'Guérison · la visite 5/–', heros: 'greta' }],
  [1298, 62, { nom: 'Dormir', sous: 'Une bonne nuit', heros: 'aldric' }],
];
pieces.push(`<div data-piece="postes">${POSTES.map((p) => poste(...p)).join('')}</div>`);
pieces.push(bandeau({
  bjorn: { icone: 'chope', texte: 'vide sa pinte au comptoir' },
  mira: { icone: 'bulle', texte: 'tend l’oreille près de l’âtre' },
  aldric: { icone: 'sommeil', texte: 'monte se coucher tôt' },
  greta: { icone: 'soin', texte: 'montre sa cuisse au barbier' },
}));
pieces.push(retour('Quitter l’auberge'), coins());
monter(pieces);
