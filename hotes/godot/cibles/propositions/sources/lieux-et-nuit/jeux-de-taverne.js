/* Les jeux de taverne, service de l'auberge : la table, les joueurs, la mise, le jeu choisi. */
rims('#f0a850', '#0c0705');
grad('mur', [[0, '#1a1009'], [.5, '#352112'], [1, '#452b16']]);
grad('plancher', [[0, '#452b17'], [.4, '#2a190d'], [1, '#0b0604']]);
grad('plateau', [[0, '#8a5a30'], [1, '#4a2e18']]);
radial('chandelle', [[0, '#ffe7a8', .95], [.22, '#ffb85c', .45], [1, '#ffb85c', 0]]);
const SOL = 440;
el(S, 'rect', { width: W, height: SOL, fill: 'url(#mur)' });
el(S, 'rect', { y: SOL, width: W, height: H - SOL, fill: 'url(#plancher)' });
{
  const g = el(S, 'g', { fill: '#150c07' });
  el(g, 'rect', { width: W, height: 44 }); el(g, 'rect', { y: 44, width: W, height: 5, fill: '#3a2414' });
  for (const x of [340, 560, 920, 1140]) el(g, 'rect', { x, y: 44, width: 15, height: SOL - 44 });
  el(g, 'rect', { x: 340, y: 150, width: 815, height: 10 });
  el(g, 'rect', { y: SOL - 4, width: W, height: 7, fill: '#0f0805' });
  const p = el(S, 'g', { stroke: '#0c0604', 'stroke-width': 1.4, opacity: .7 });
  for (let k = -14; k <= 14; k++) el(p, 'path', { d: `M${760 + k * 70},${SOL}L${760 + k * 240},${H}` });
}
el(S, 'ellipse', { cx: 760, cy: 470, rx: 560, ry: 330, fill: 'url(#lueur)', style: 'mix-blend-mode:screen', opacity: .8 });
const G = el(S, 'g');
{ // la butte des fléchettes, au mur
  const x = 1046, y = 262;
  el(G, 'circle', { cx: x, cy: y, r: 50, fill: '#1a0f08' });
  for (const [r, c] of [[44, '#6a4426'], [33, '#2a1810'], [22, '#6a4426'], [11, '#9c2a1a']]) el(G, 'circle', { cx: x, cy: y, r, fill: c });
  for (let a = 0; a < 8; a++) el(G, 'path', { d: `M${x},${y}L${x + 44 * Math.cos(a * Math.PI / 4)},${y + 44 * Math.sin(a * Math.PI / 4)}`, stroke: '#1a0f08', 'stroke-width': 1.2 });
  for (const [dx, dy] of [[8, -14], [-20, 6], [26, 18]]) el(G, 'path', { d: `M${x + dx},${y + dy}l12,-9m-3,-2l5,7`, stroke: '#e9dcc0', 'stroke-width': 2 });
}
{ // la table du bras de fer, au fond
  const x = 452, y = 432;
  perso(G, x - 42, y + 8, 120, { pose: 'assis', fill: '#0c0705', coiffe: 'bonnet', extra: '<path d="M10,-44L40,-56l4,8l-28,14z"/>' });
  perso(G, x + 42, y + 8, 128, { pose: 'assis', fill: '#0c0705', vers: -1, extra: '<path d="M10,-44L38,-58l4,8l-26,14z"/>' });
  el(G, 'rect', { x: x - 56, y: y - 44, width: 112, height: 8, fill: '#5a3a20' }); el(G, 'rect', { x: x - 5, y: y - 36, width: 10, height: 44, fill: '#0c0705' });
}
// la lanterne au-dessus de la table
el(G, 'path', { d: 'M760,49V214', stroke: '#0c0604', 'stroke-width': 2.5 });
el(G, 'circle', { cx: 760, cy: 240, r: 190, fill: 'url(#chandelle)', style: 'mix-blend-mode:screen', opacity: .8 });
el(G, 'path', { d: 'M742,214h36l8,44h-52z', fill: '#ffd98a' });
el(G, 'path', { d: 'M736,210h48v6h-48zM730,258h60v6h-60zM760,214v44', fill: '#0c0604', stroke: '#0c0604', 'stroke-width': 2 });
// les joueurs de derrière, la table, puis ceux de devant
const TY = 500;
perso(G, 640, TY + 6, 218, { pose: 'assis', fill: '#0c0705', coiffe: 'bonnet', vers: 1 });
perso(G, 850, TY - 4, 200, { pose: 'assis', fill: '#0c0705', coiffe: 'chapeau', vers: -1 });
el(G, 'ellipse', { cx: 770, cy: TY + 120, rx: 290, ry: 30, fill: '#000', opacity: .55, filter: 'url(#f8)' });
el(G, 'ellipse', { cx: 770, cy: TY + 12, rx: 262, ry: 62, fill: '#140c07' });
el(G, 'ellipse', { cx: 770, cy: TY, rx: 262, ry: 62, fill: 'url(#plateau)' });
el(G, 'ellipse', { cx: 770, cy: TY - 2, rx: 200, ry: 44, fill: '#c98a48', opacity: .28, filter: 'url(#f8)' });
{ // ce qui est sur la table : les dés, le pot, les chopes
  const de = (x, y, a, n) => { const g = el(G, 'g', { transform: `translate(${x},${y}) rotate(${a})` }); el(g, 'rect', { x: -9, y: -9, width: 18, height: 18, rx: 2.5, fill: '#f1e6cc', stroke: '#2a1d12', 'stroke-width': 1 }); for (const [px, py] of n) el(g, 'circle', { cx: px, cy: py, r: 1.7, fill: '#2a1d12' }); };
  de(742, TY - 4, 16, [[-4, -4], [4, 4], [0, 0]]); de(774, TY + 8, -22, [[-4, -4], [4, 4], [-4, 4], [4, -4]]);
  const r = alea(6);
  for (let n = 0; n < 22; n++) { const x = 838 + (r() - .5) * 70, y = TY - 14 + (r() - .5) * 22; el(G, 'ellipse', { cx: x, cy: y, rx: 7, ry: 2.8, fill: r() < .25 ? '#d8d8d2' : '#e2c06a', stroke: '#5d4313', 'stroke-width': .7 }); }
  for (const [x, y] of [[640, TY - 4], [900, TY + 18]]) { el(G, 'path', { d: `M${x},${y}h18v-22h-18zM${x + 18},${y - 17}h6v11h-6`, fill: '#3a2414', stroke: '#150c07', 'stroke-width': 1.5 }); el(G, 'rect', { x: x + 1, y: y - 25, width: 16, height: 4, fill: '#e9dcc0' }); }
  for (const [x, y] of [[690, TY + 30], [706, TY + 36]]) el(G, 'ellipse', { cx: x, cy: y, rx: 7, ry: 2.8, fill: '#e2c06a', stroke: '#5d4313', 'stroke-width': .7 });
}
perso(G, 1016, TY + 118, 204, { pose: 'assis', fill: '#070403', coiffe: 'casque', vers: -1 });
// la place libre, devant
el(G, 'ellipse', { cx: 690, cy: 612, rx: 62, ry: 14, fill: '#ffe2a6', opacity: .55, filter: 'url(#f4)' });
el(G, 'path', { d: 'M640,604h100v12h-100z', fill: '#0c0705' });
el(G, 'ellipse', { cx: 690, cy: 604, rx: 50, ry: 9, fill: '#6a4426', stroke: '#f3dc93', 'stroke-width': 1.5 });
fermer();
el(S, 'rect', { width: 380, height: H, fill: '#000', opacity: .3 });

const pieces = [];
pieces.push(titre({ icone: 'lit', nom: 'La Fin du Voyage', sous: 'Bonne auberge · Teuerberg, Bögenhafen', largeur: 430 }));
const SERVICES = [['lit', 'La nuit et le repas'], ['bulle', 'La salle commune'], ['des', 'Les jeux', 1], ['soin', 'Le barbier'], ['fer_a_cheval', 'L’écurie']];
pieces.push(rail('Services de la maison', SERVICES, 'Odelina Landau, l’aubergiste'));
const POSTES = [
  [640, 226, { nom: 'Le brasseur', sous: 'Tient les dés', heros: 'brasseur' }],
  [850, 222, { nom: 'Un batelier du Reik', sous: 'A misé', heros: 'batelier' }],
  [1016, 344, { nom: 'Un cocher', sous: 'A misé', heros: 'cocher' }],
  [1046, 100, { nom: 'Les fléchettes', sous: 'Projectiles (Lancer)', icone: 'cible' }],
  [452, 196, { nom: 'Le bras de fer', sous: 'Force', icone: 'poing' }],
  [690, 512, { nom: 'L’Al-zahr', sous: 'La place de Bjorn', icone: 'des', vise: true }],
];
pieces.push(`<div data-piece="table">${POSTES.map((p) => poste(...p)).join('')}</div>`);
const siege = (id, nom, sous, choisi) => `<div class="siege">${portrait(id, { classe: choisi ? 'choisi' : '' })}<b>${nom}</b><span class="rubrique">${sous}</span></div>`;
const pile = `<svg width="38" height="34" viewBox="0 0 38 34">${[28, 23, 18, 13].map((y) => `<ellipse cx="15" cy="${y}" rx="12" ry="4.200" fill="#c9a44c" stroke="#5d4313" stroke-width="1"/>`).join('')}<ellipse cx="28" cy="27" rx="8" ry="3" fill="#c9a44c" stroke="#5d4313" stroke-width="1"/></svg>`;
pieces.push(`<div id="partie" class="page cadre bois" data-piece="partie"><div class="fond parchemin">
  <h3 data-texte="jeu">L’Al-zahr</h3>
  <div class="sous rubrique">Jeu de dés · chacun met au pot</div>
  <p style="margin-top:7px">Deux dés pour toucher le nombre cible. Le premier qui l’atteint emporte le pot.</p>
  <div class="autres">${plaque('L’Al-zahr', { armee: true, icone: 'des' })}${plaque('Les fléchettes', { icone: 'cible' })}${plaque('Le bras de fer', { icone: 'poing' })}</div>
  <div class="filet"></div>
  <div class="t rubrique">À la table</div>
  <div class="sieges">${siege('bjorn', 'Bjorn', 'Votre joueur', 1)}${siege('brasseur', 'Le brasseur', 'La maison')}${siege('batelier', 'Un batelier', 'Habitué')}${siege('cocher', 'Un cocher', 'De passage')}</div>
  <div class="filet"></div>
  <div class="t rubrique">La mise de Bjorn</div>
  <div class="mise">${rond('moins', 17)}<div class="somme">${pile}<b class="lin" style="font-family:inherit">6 sc</b></div>${rond('plus', 17)}
    <table class="compte"><tr><td>Le pot, à quatre</td><td class="lin">2/–</td></tr><tr><td>Bourse de Bjorn</td><td class="lin">14/–</td></tr></table></div>
  ${plaque('S’asseoir et lancer les dés', { armee: true, icone: 'des', classe: 'jouer' })}
</div><div class="ruban gothique">La partie</div>${ferrures}</div>`);
pieces.push(bandeau({ bjorn: { choisi: true, icone: 'des', texte: 'prend la place libre à la table de dés' } }, { bourses: true }));
pieces.push(retour('Quitter la table'), coins());
monter(pieces);
