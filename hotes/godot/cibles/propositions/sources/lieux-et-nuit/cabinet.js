/* Le décor du cabinet du médecin : la fenêtre à meneaux et son jour, la planche d'anatomie, les bocaux, la table
   d'examen et le docteur (`../rendu.js`, écran `soins`). Peint à 1707 × 780, rogné à la vue (`toile`, `commun.js`). */
{
  const S = toile(), W = 1707, H = 780;
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
}
fermer();
el(S, 'rect', { width: 340, height: H, fill: '#000', opacity: .3 });
