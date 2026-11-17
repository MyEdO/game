/* La page des services d'un lieu, ouverte sur le médecin : le cabinet, l'hôte, ses soins, les autres services à côté. */
rims('#e8b060', '#0b0806');
grad('mur', [[0, '#12140f'], [.55, '#2a2618'], [1, '#3a301c']]);
grad('plancher', [[0, '#3c2a18'], [.4, '#22160c'], [1, '#090605']]);
grad('jour', [[0, '#c9d6dc'], [1, '#8fa3ac']]);
grad('rai', [[0, '#c9d6dc', .32], [1, '#c9d6dc', 0]], { x1: 0, y1: 0, x2: .6, y2: 1 });
radial('chandelle', [[0, '#ffe7a8', .9], [.25, '#ffb85c', .4], [1, '#ffb85c', 0]]);
const SOL = 480;
el(S, 'rect', { width: W, height: SOL, fill: 'url(#mur)' });
el(S, 'rect', { y: SOL, width: W, height: H - SOL, fill: 'url(#plancher)' });
{
  const g = el(S, 'g', { fill: '#0d0b07' });
  el(g, 'rect', { width: W, height: 40 }); el(g, 'rect', { y: 40, width: W, height: 5, fill: '#2a2618' });
  for (const x of [336, 588, 792, 1170]) el(g, 'rect', { x, y: 40, width: 14, height: SOL - 40 });
  el(g, 'rect', { y: SOL - 4, width: W, height: 7 });
  const p = el(S, 'g', { stroke: '#080503', 'stroke-width': 1.4, opacity: .7 });
  for (let k = -14; k <= 14; k++) el(p, 'path', { d: `M${760 + k * 66},${SOL}L${760 + k * 220},${H}` });
}
const G = el(S, 'g');
{ // la fenêtre à meneaux et son jour
  el(G, 'path', { d: 'M392,330V150a70,70 0 0 1 140,0V330Z', fill: 'url(#jour)', stroke: '#0d0b07', 'stroke-width': 7 });
  const g = el(G, 'g', { stroke: '#0d0b07', 'stroke-width': 2.2, opacity: .85 });
  for (let k = -5; k <= 9; k++) { el(g, 'path', { d: `M${392 + k * 24},80L${392 + k * 24 + 150},330` }); el(g, 'path', { d: `M${532 - k * 24},80L${532 - k * 24 - 150},330` }); }
  el(G, 'path', { d: 'M392,330V150a70,70 0 0 1 140,0V330Z', fill: 'none', stroke: '#0d0b07', 'stroke-width': 7 });
  el(G, 'path', { d: 'M462,82V330M392,210H532', stroke: '#0d0b07', 'stroke-width': 6 });
  el(G, 'rect', { x: 380, y: 328, width: 164, height: 9, fill: '#0d0b07' });
  el(S, 'path', { d: 'M392,90L532,90L1000,780L520,780Z', fill: 'url(#rai)', style: 'mix-blend-mode:screen' });
}
{ // la planche d'anatomie
  el(G, 'rect', { x: 628, y: 128, width: 124, height: 196, fill: '#cdb98c' });
  el(G, 'rect', { x: 622, y: 122, width: 136, height: 9, fill: '#1a120a' }); el(G, 'rect', { x: 622, y: 321, width: 136, height: 9, fill: '#1a120a' });
  const g = el(G, 'g', { stroke: '#4a2a18', 'stroke-width': 1.6, fill: 'none', opacity: .85 });
  el(g, 'circle', { cx: 690, cy: 160, r: 11 });
  el(g, 'path', { d: 'M690,171V250M690,186L662,224M690,186L718,224M690,250L672,306M690,250L708,306M676,196h28M678,206h24M680,216h20M682,226h16' });
  el(g, 'path', { d: 'M640,300h30M712,300h28M640,150h22M722,150h18', 'stroke-width': 1, opacity: .7 });
}
{ // les rayonnages : bocaux, fioles, livres
  const r = alea(31);
  for (let n = 0; n < 4; n++) {
    const y = 108 + n * 52;
    el(G, 'rect', { x: 826, y: y + 40, width: 330, height: 7, fill: '#0d0b07' });
    let x = 836;
    while (x < 1136) {
      const k = r(), w = 12 + r() * 16, h = 16 + r() * 22;
      const teinte = ['#3f5a3a', '#6a4a22', '#2a3a44', '#5a2a1c', '#4a4a2a'][Math.floor(r() * 5)];
      if (k < .62) { el(G, 'rect', { x, y: y + 40 - h, width: w, height: h, rx: 3, fill: teinte, opacity: .9 }); el(G, 'rect', { x: x + w * .25, y: y + 36 - h, width: w * .5, height: 5, fill: '#1a120a' }); el(G, 'rect', { x: x + 2, y: y + 43 - h, width: 2, height: h - 8, fill: '#e8d9a8', opacity: .28 }); }
      else if (k < .82) el(G, 'path', { d: `M${x},${y + 40}V${y + 40 - h * .5}L${x + w * .32},${y + 40 - h}H${x + w * .68}L${x + w},${y + 40 - h * .5}V${y + 40}Z`, fill: teinte, opacity: .9 });
      else el(G, 'rect', { x, y: y + 40 - h - 4, width: w * .6, height: h + 4, fill: '#2a1810', stroke: '#0d0b07', 'stroke-width': 1 });
      x += w + 4 + r() * 8;
    }
  }
  el(G, 'rect', { x: 820, y: 100, width: 8, height: 250, fill: '#0d0b07' }); el(G, 'rect', { x: 1154, y: 100, width: 8, height: 250, fill: '#0d0b07' });
  // les herbes qui sèchent
  for (const x of [560, 596, 780, 1010, 1060]) { el(G, 'path', { d: `M${x},45v22`, stroke: '#0d0b07', 'stroke-width': 1.5 }); el(G, 'path', { d: `M${x},66c-12,10 -14,30 -8,46c3,-10 6,-12 8,-22c2,10 5,12 8,22c6,-16 4,-36 -8,-46z`, fill: '#1e2a1a' }); }
}
// la couche du patient, sous le jour de la fenêtre
el(G, 'ellipse', { cx: 600, cy: 598, rx: 180, ry: 12, fill: '#000', opacity: .5, filter: 'url(#f4)' });
el(G, 'path', { d: 'M440,520h320v14h-320zM452,534h12v62h-12zM736,534h12v62h-12z', fill: '#140d08' });
el(G, 'path', { d: 'M440,520c0,-12 6,-16 16,-16h290c8,0 14,4 14,16z', fill: '#b9ad94' });
el(G, 'path', { d: 'M440,520c0,-12 6,-16 16,-16h60l-14,16z', fill: '#e6dcc2' });
el(G, 'path', { d: 'M600,504h146c8,0 14,4 14,16h-160z', fill: '#7c2a1c', opacity: .85 });
// la table aux instruments, sa chandelle
el(G, 'circle', { cx: 1104, cy: 470, r: 110, fill: 'url(#chandelle)', style: 'mix-blend-mode:screen' });
el(G, 'path', { d: 'M1050,520h110v9h-110zM1060,529h9v70h-9zM1141,529h9v70h-9z', fill: '#140d08' });
el(G, 'path', { d: 'M1104,520v-24', stroke: '#f3ecd4', 'stroke-width': 4 }); el(G, 'path', { d: 'M1104,496c-5,-8 0,-11 0,-17c5,6 5,9 0,17z', fill: '#ffe7a8' });
el(G, 'path', { d: 'M1064,520c0,-9 22,-9 22,0zM1122,520v-12h6v12zM1134,520l8,-16l3,1l-6,15z', fill: '#2a1810' });
// le docteur
el(G, 'ellipse', { cx: 962, cy: 604, rx: 56, ry: 9, fill: '#000', opacity: .55, filter: 'url(#f2)' });
perso(G, 960, 602, 172, { coiffe: 'chapeau', fill: 'url(#rimD)', extra: '<path d="M-17,-58l-16,22 4,3 16,-18z"/><path d="M-36,-36h10v14h-10z"/>' });
fermer();
el(S, 'rect', { width: 380, height: H, fill: '#000', opacity: .3 });

const pieces = [];
pieces.push(titre({ icone: 'soin', nom: 'Guilde des Médecins', sous: 'Teuerberg, Bögenhafen', largeur: 400 }));
const SERVICES = [['lit', 'La Fin du Voyage'], ['chope', 'Les Piques croisées'], ['balance', 'Guilde des Joailliers'], ['soin', 'Guilde des Médecins', 1], ['bouclier', 'Caserne du Guet']];
pieces.push(`<div id="rail" class="cadre bois" data-piece="services"><div class="fond bois">
  ${SERVICES.map(([i, n, a]) => plaque(n, { icone: i, armee: !!a })).join('')}
  <div class="pied rubrique">On passe de l’un à l’autre sans ressortir</div>
</div><div class="ruban rubrique">Services de Teuerberg</div>${ferrures}</div>`);
pieces.push(`<div id="docteur" class="hote cadre bois" data-piece="docteur"><div class="fond bois">
  <div class="tete">${medaillon('soin', { petit: true })}<div><div class="n gothique" data-texte="docteur">Le docteur de la guilde</div><div class="s rubrique">Docteur en médecine · Guérison 62</div></div></div>
  <p>Asseyez-vous sous la fenêtre et montrez-moi cela. Et ne bougez plus.</p>
</div><i class="pointe" style="left:152px;bottom:-8px"></i>${ferrures}</div>`);
const onglet = (id, nom, actif) => `<div class="onglet ${actif ? 'actif' : ''}">${portrait(id)}<span class="rubrique">${nom}</span></div>`;
pieces.push(`<div id="soins" class="page cadre bois" data-piece="soins"><div class="fond parchemin">
  <div class="onglets">${onglet('bjorn', 'Bjorn')}${onglet('mira', 'Mira')}${onglet('aldric', 'Aldric')}${onglet('greta', 'Greta', 1)}</div>
  <div class="patient"><div class="etat"><div class="l"><h3 data-texte="patient">Greta Hartmann</h3><span class="sous rubrique">Blessures <span class="lin">8 / 14</span></span></div><div class="vie"><i style="width:57%"></i></div></div></div>
  <div class="mal">${sceau('goutte', 12)}<span>Cuisse lacérée, jambe gauche : la plaie attend d’être recousue.</span></div>
  <div class="filet"></div>
  <div class="soin pris"><div class="ic">${picto('soin', 19, '#5a2a12')}</div><div class="t"><b>Panser les Blessures</b><span class="c">Guérison</span><i>Lui rend le Bonus d’Intelligence du docteur, plus ses degrés de réussite.</i></div><span class="px lin">5/–</span></div>
  <div class="soin"><div class="ic">${picto('scalpel', 19, '#5a2a12')}</div><div class="t"><b>Recoudre la cuisse lacérée</b><span class="c">Chirurgie</span><i>Longue opération : chaque passe lui coûte 1d10 Blessures et une Hémorragie.</i></div><span class="px lin">15/–</span></div>
  <div class="filet"></div>
  <table class="compte">
    <tr class="total"><td>À payer</td><td>5/–</td></tr>
    <tr><td>Bourse de Greta</td><td class="lin">1 CO 3/–</td></tr>
    <tr><td>Il lui restera</td><td class="lin">18/–</td></tr>
  </table>
  ${plaque('Payer le docteur', { armee: true, icone: 'bourse', classe: 'payer' })}
</div><div class="ruban gothique">Les soins du docteur</div>${ferrures}</div>`);
pieces.push(bandeau({ greta: { choisi: true, mal: true, icone: 'goutte', texte: 'Cuisse lacérée, à recoudre' } }, { bourses: true }));
pieces.push(retour('Retour au quartier'), coins());
monter(pieces);
