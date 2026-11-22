/* Commerce, images d'intention (#3935, #4411). Ajouts au socle de « lieux et nuit » (../lieux-et-nuit/commun.js) : les
   mesures d'une offre, la page de droite, la quantité, les deux décors (la halle, le quai) et la carte du port. Posés
   par `../rendu.js` (écrans `halle`, `marchandage`, `port`). Maquette hors du jeu. */
/* ───────── les pièces ───────── */
const mesures = (lignes) => `<table>${lignes.map(([k, v, c]) => `<tr><td>${k}</td><td class="${c ?? ''}">${v}</td></tr>`).join('')}</table>`;
/* la page de droite, sur parchemin : ce que l'on compose ou traite ; `piece` la nomme au rapport de rendu */
const page = (piece, intitule, corps) => `<div id="page" class="page cadre bois" data-piece="${piece}"><div class="fond parchemin">${corps}</div>${ruban(intitule)}${ferrures}</div>`;
const quantite = (v, min, max, unite = 'Enc') => `<div class="quantite">${rond('moins', 'petit')}<div style="flex:1">${reglette((v - min) / (max - min), null)}<div class="bornes chiffres"><span>${min}</span><span>${max}</span></div></div>${rond('plus', 'petit')}<span class="val">${v} ${unite}</span></div>`;

/* le fragment de carte du port de Salzenmund : la côte du Nordland, la route de mer qui part d'ici */
const CARTE_DU_PORT = `<svg viewBox="0 0 343 220">
  <path d="M0,150C40,138 70,150 104,132C132,118 150,128 178,112C206,96 236,104 262,90C290,76 318,84 343,72V220H0Z" fill="rgba(90,60,20,.16)" stroke="#4a3420" stroke-width="1.3"/>
  <g stroke="#4a3420" stroke-width=".8" opacity=".55" fill="none">${[[30, 60], [90, 40], [150, 70], [210, 36], [270, 50], [60, 100], [130, 96], [230, 70]].map(([x, y]) => `<path d="M${x},${y}c5,-5 10,-5 15,0s10,5 15,0"/>`).join('')}</g>
  <g fill="none" stroke="#4a3420" stroke-width=".9" opacity=".7">${[[40, 186], [70, 178], [120, 190], [150, 170], [200, 184], [240, 160], [290, 176], [310, 150], [96, 166]].map(([x, y]) => `<path d="M${x},${y}l5,-11l5,11zM${x + 5},${y}v4"/>`).join('')}</g>
  <path d="M178,112C150,86 110,84 70,112" fill="none" stroke="#9c2a1a" stroke-width="2"/>
  <path d="M178,112C214,74 268,60 318,66" fill="none" stroke="#4a3420" stroke-width="1.2" stroke-dasharray="4 4"/>
  ${[[70, 112, 'Norden', -16, 18], [318, 66, 'Dietershafen', -70, -9], [262, 90, 'Hargendorf', -24, 20]].map(([x, y, n, dx, dy]) => `<circle cx="${x}" cy="${y}" r="3.500" fill="#e9dcc0" stroke="#2a1d12" stroke-width="1.300"/><text x="${x + dx}" y="${y + dy}" font-family="Fell SC" font-size="11.500" letter-spacing=".8" fill="#2a1d12">${n}</text>`).join('')}
  <circle cx="178" cy="112" r="6" fill="#9c2a1a" stroke="#5a130b" stroke-width="1.500"/><text x="150" y="136" font-family="Fell SC" font-size="12" letter-spacing=".8" fill="#7c1f14">Salzenmund</text>
  <g transform="translate(44,44)" stroke="#4a3420" fill="none" stroke-width="1"><circle r="13"/><path d="M0,-18V18M-18,0H18M-9,-9L9,9M9,-9L-9,9"/></g>
  <text x="196" y="30" font-family="Fell" font-style="italic" font-size="13" fill="#4a3420" opacity=".8">Mer des Griffes</text>
</svg>`;

/* ───────── le décor : silhouettes de commerce ───────── */
const ballot = (g, x, y, w = 70, h = 42, fill = '#8f8468') => {
  el(g, 'rect', { x, y: y - h, width: w, height: h, rx: 9, fill });
  el(g, 'rect', { x: x + 2, y: y - h + 1, width: w - 4, height: 5, rx: 3, fill: '#d9cda8', opacity: .55 });
  el(g, 'path', { d: `M${x + w * .3},${y - h}v${h}M${x + w * .7},${y - h}v${h}`, stroke: '#2a2116', 'stroke-width': 2, opacity: .8 });
};
const fut = (g, x, y, w = 50, h = 66, fill = '#1a110a') => {
  el(g, 'path', { d: `M${x + w * .14},${y - h}h${w * .72}c${w * .19},${h * .3} ${w * .19},${h * .7} 0,${h}h${-w * .72}c${-w * .19},${-h * .3} ${-w * .19},${-h * .7} 0,${-h}z`, fill });
  for (const k of [.2, .5, .8]) el(g, 'path', { d: `M${x + w * .03},${y - h * k}h${w * .94}`, stroke: '#5a4024', 'stroke-width': 2.4, opacity: .8 });
  el(g, 'path', { d: `M${x + w * .2},${y - h + 2}v${h - 4}`, stroke: '#e8c890', 'stroke-width': 1.6, opacity: .35 });
};
const caisse = (g, x, y, w = 54, h = 40, fill = '#1c130b') => {
  el(g, 'rect', { x, y: y - h, width: w, height: h, fill });
  el(g, 'path', { d: `M${x},${y - h}l${w},${h}M${x + w},${y - h}l${-w},${h}M${x},${y - h}h${w}`, stroke: '#4a3520', 'stroke-width': 1.6, opacity: .8 });
};
const roue = (g, x, y, r, fill = '#0b0806') => {
  el(g, 'circle', { cx: x, cy: y, r, fill: 'none', stroke: fill, 'stroke-width': r * .16 });
  for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; el(g, 'path', { d: `M${x},${y}L${x + Math.cos(a) * r},${y + Math.sin(a) * r}`, stroke: fill, 'stroke-width': r * .09 }); }
  el(g, 'circle', { cx: x, cy: y, r: r * .2, fill });
};
/* la charrette : (x, y) le pied de sa roue ; charge = ballots chargés */
const charrette = (g, x, y, charge = 0) => {
  el(g, 'ellipse', { cx: x + 10, cy: y + 2, rx: 120, ry: 9, fill: '#000', opacity: .55, filter: 'url(#f2)' });
  for (let k = 0; k < charge; k++) ballot(g, x - 70 + (k % 2) * 66 + (k > 1 ? 30 : 0), y - 74 - (k > 1 ? 40 : 0), 64, 40);
  el(g, 'path', { d: `M${x - 88},${y - 92}h8v24h-8zM${x + 78},${y - 92}h8v24h-8zM${x - 92},${y - 74}h182l-8,22h-166zM${x + 82},${y - 60}l92,22v6l-96,-16z`, fill: '#0b0806' });
  el(g, 'path', { d: `M${x - 90},${y - 74}h178`, stroke: '#c9a066', 'stroke-width': 1.5, opacity: .5 });
  roue(g, x, y - 34, 34);
};
/* la mule bâtée : (x, y) le sol sous elle, tournée vers la droite */
const mule = (g, x, y, s = 1) => {
  el(g, 'ellipse', { cx: x, cy: y + 2, rx: 62 * s, ry: 7 * s, fill: '#000', opacity: .55, filter: 'url(#f2)' });
  const f = el(g, 'g', { transform: `translate(${x},${y}) scale(${s})`, fill: '#0b0806' });
  el(f, 'path', { d: 'M-46,-56C-40,-68 30,-68 40,-58L52,-82C54,-90 62,-92 66,-86L80,-70C82,-66 78,-62 74,-64L60,-66L50,-44C48,-34 44,-32 40,-32L38,0L30,0L30,-28L-28,-28L-30,0L-38,0L-40,-34C-48,-38 -50,-48 -46,-56Z' });
  el(f, 'path', { d: 'M56,-88L53,-108L62,-90ZM62,-90L65,-110L69,-88Z' });
  el(f, 'path', { d: 'M-46,-54C-58,-46 -58,-28 -53,-16', stroke: '#0b0806', 'stroke-width': 4, fill: 'none' });
  el(f, 'path', { d: 'M-24,-74h46v10h-46zM-30,-66h18v26h-18zM10,-66h18v26h-18z', fill: '#1c130b' });
  el(f, 'path', { d: 'M-24,-74h46', stroke: '#c9a066', 'stroke-width': 1.4, opacity: .5 });
};

/* la halle : trois arches ouvertes sur la place, la grande balance, les ballots du drapier, les fûts du vigneron,
   la charrette et la mule du groupe au premier plan. charge = ballots sur la charrette */
function sceneDeLaHalle({ charge = 0 } = {}) {
  const S = toile(), W = 1707, H = 780;
  rims('#f0c882', '#0b0806');
  grad('h-mur', [[0, '#100e0a'], [.6, '#272014'], [1, '#382c18']]);
  grad('h-sol', [[0, '#55432a'], [.35, '#2a1e12'], [1, '#090605']]);
  grad('h-jour', [[0, '#f1e3b8'], [.55, '#e0bd7c'], [1, '#c2904c']]);
  grad('h-rai', [[0, '#f0d8a0', .34], [1, '#f0d8a0', 0]]);
  const SOL = 468;
  el(S, 'rect', { width: W, height: SOL, fill: 'url(#h-mur)' });
  el(S, 'rect', { y: SOL, width: W, height: H - SOL, fill: 'url(#h-sol)' });
  const r = alea(11);
  [452, 722, 992].forEach((x, k) => {
    const d = `M${x},${SOL}V253a103,103 0 0 1 206,0V${SOL}Z`;
    el(el(defs, 'clipPath', { id: 'arche' + k }), 'path', { d });
    el(S, 'path', { d, fill: 'url(#h-jour)' });
    const g = el(S, 'g', { 'clip-path': `url(#arche${k})` });
    for (const [fill, o, base, n] of [['#a98a5c', .55, 70, 5], ['#6a5236', .8, 40, 4]]) {
      let xx = x - 10;
      for (let i = 0; i < n; i++) { const w = 44 + r() * 30, hh = base + r() * 46, p = 18 + r() * 16; el(g, 'path', { d: `M${xx},${SOL}V${SOL - hh}l${w / 2},${-p}l${w / 2},${p}V${SOL}Z`, fill, opacity: o }); xx += w + r() * 8; }
    }
    for (let i = 0; i < 2; i++) perso(g, x + 50 + r() * 110, SOL - 2, 46 + r() * 8, { fill: '#3a2c1c', coiffe: i ? 'chapeau' : '' });
    el(S, 'path', { d: `M${x},${SOL}H${x + 206}L${x + 330},${H}H${x - 124}Z`, fill: 'url(#h-rai)', style: 'mix-blend-mode:screen' });
    el(S, 'path', { d, fill: 'none', stroke: '#0c0a07', 'stroke-width': 8 });
  });
  { // piliers, sablière, pavés
    const g = el(S, 'g', { fill: '#0d0b08' });
    el(g, 'rect', { width: W, height: 62 }); el(g, 'rect', { y: 62, width: W, height: 6, fill: '#2a2114' });
    for (const x of [392, 662, 932, 1202]) { el(g, 'rect', { x, y: 68, width: 56, height: SOL - 68 }); el(g, 'rect', { x: x - 8, y: SOL - 26, width: 72, height: 26 }); el(g, 'rect', { x: x - 6, y: 68, width: 68, height: 16 }); }
    el(g, 'rect', { y: SOL - 3, width: W, height: 6 });
    const p = el(S, 'g', { stroke: '#080503', 'stroke-width': 1.3, opacity: .6 });
    for (let k = -14; k <= 14; k++) el(p, 'path', { d: `M${825 + k * 62},${SOL}L${825 + k * 230},${H}` });
    for (const y of [492, 524, 566, 622]) el(p, 'path', { d: `M0,${y}H${W}` });
  }
  const G = el(S, 'g');
  { // la grande balance de la halle, pendue à la sablière
    const g = el(G, 'g', { stroke: '#0b0806', fill: 'none', 'stroke-width': 3 });
    el(g, 'path', { d: 'M774,68V176M724,188L774,176L824,188' });
    el(g, 'path', { d: 'M724,188L706,250M724,188L742,250M824,188L806,250M824,188L842,250', 'stroke-width': 1.6 });
    el(G, 'path', { d: 'M700,250h48c0,12 -10,19 -24,19s-24,-7 -24,-19zM800,250h48c0,12 -10,19 -24,19s-24,-7 -24,-19z', fill: '#0b0806' });
    el(G, 'circle', { cx: 774, cy: 176, r: 6, fill: '#0b0806' });
  }
  // l'étal du drapier : ballots de laine
  el(G, 'ellipse', { cx: 470, cy: 566, rx: 130, ry: 10, fill: '#000', opacity: .5, filter: 'url(#f4)' });
  ballot(G, 400, 478, 78, 46, '#6f6650'); ballot(G, 482, 478, 78, 46, '#6f6650'); ballot(G, 440, 432, 78, 46, '#7a7058');
  // les fûts du vigneron
  el(G, 'ellipse', { cx: 1090, cy: 566, rx: 120, ry: 10, fill: '#000', opacity: .5, filter: 'url(#f4)' });
  fut(G, 1040, 508, 54, 72); fut(G, 1098, 508, 54, 72); fut(G, 1070, 562, 60, 80, '#20150c'); caisse(G, 1140, 562, 56, 44);
  // les deux négociants
  el(G, 'ellipse', { cx: 600, cy: 568, rx: 50, ry: 8, fill: '#000', opacity: .55, filter: 'url(#f2)' });
  perso(G, 600, 566, 176, { coiffe: 'bonnet', fill: 'url(#rimD)', extra: '<path d="M14,-60l20,10 -2,5 -20,-7z"/>' });
  el(G, 'ellipse', { cx: 968, cy: 568, rx: 50, ry: 8, fill: '#000', opacity: .55, filter: 'url(#f2)' });
  perso(G, 968, 566, 182, { coiffe: 'chapeau', fill: 'url(#rimG)', vers: -1, extra: '<path d="M14,-58l18,-12 3,4 -17,14z"/><path d="M30,-76h7v12h-7z"/>' });
  // les porteurs du groupe, au premier plan
  mule(G, 436, 600, .9);
  charrette(G, 770, 604, charge);
  fermer();
  el(S.ownerSVGElement, 'rect', { width: 340, height: 720, fill: '#000', opacity: .32 });
}

/* le quai : le navire du groupe amarré, l'entrepôt, le chantier, la taverne, le phare, au couchant */
function sceneDuQuai() {
  const S = toile(), W = 1707, H = 780;
  grad('q-ciel', [[0, '#141627'], [.45, '#43354f'], [.78, '#b56a4a'], [1, '#f0b060']]);
  grad('q-mer', [[0, '#7a5a52'], [.12, '#3a3248'], [1, '#0a0910']]);
  grad('q-quai', [[0, '#3a3038'], [.2, '#211a20'], [1, '#08070a']]);
  radial('q-soleil', [[0, '#ffe9b0', .95], [.25, '#ffb868', .5], [1, '#ff9a4a', 0]]);
  radial('q-feu', [[0, '#fff3c8', .95], [.3, '#ffc76e', .5], [1, '#ff9a3a', 0]]);
  const MER = 402;
  el(S, 'rect', { width: W, height: MER, fill: 'url(#q-ciel)' });
  nuagesDuSoir(S);
  el(S, 'circle', { cx: 900, cy: MER - 6, r: 240, fill: 'url(#q-soleil)', style: 'mix-blend-mode:screen' });
  el(S, 'rect', { y: MER, width: W, height: H - MER, fill: 'url(#q-mer)' });
  { const g = el(S, 'g', { stroke: '#ffd89a', 'stroke-linecap': 'round' }); const r = alea(7);
    for (let i = 0; i < 70; i++) { const y = MER + 4 + r() * r() * 110, x = 900 + (r() - .5) * (160 + (y - MER) * 5), l = 6 + r() * 22; el(g, 'path', { d: `M${x},${y}h${l}`, 'stroke-width': 1 + r(), opacity: .15 + r() * .4 }); } }
  const N = '#0b0a10';
  { // la côte et le phare au loin
    el(S, 'path', { d: `M0,${MER}L0,372C120,356 260,362 360,372C420,378 470,390 520,${MER}Z`, fill: '#2a2238' });
    el(S, 'path', { d: `M1160,${MER}C1220,388 1300,380 1420,376L${W},370V${MER}Z`, fill: '#2a2238' });
    el(S, 'path', { d: `M1236,${MER - 14}l6,-92h12l6,92zM1234,${MER - 108}h28v-6h-28zM1242,${MER - 124}h12v10h-12z`, fill: '#1a1524' });
    el(S, 'circle', { cx: 1248, cy: MER - 118, r: 46, fill: 'url(#q-feu)', style: 'mix-blend-mode:screen' });
    const g = el(S, 'g', { fill: '#1a1524' }); // deux voiles au large
    el(g, 'path', { d: 'M560,398l44,0l-6,8h-32zM580,398V366l18,28z' }); el(g, 'path', { d: 'M1110,396l36,0l-5,7h-26zM1126,396V370l14,23z' });
  }
  const G = el(S, 'g');
  { // le navire à quai : coque, châteaux, mât, vergue et voile ferlée, haubans
    el(G, 'path', { d: 'M742,450C756,486 800,500 850,500H1060C1104,500 1132,476 1146,438V404H1086L1080,436H800L772,412H742Z', fill: '#17121c', stroke: '#6a4e50', 'stroke-width': 1.2 });
    el(G, 'path', { d: 'M752,462C790,476 840,480 1126,462M768,480C810,490 860,492 1104,482', stroke: '#3a2c36', 'stroke-width': 1.4, fill: 'none' });
    el(G, 'path', { d: 'M742,412H772M1086,404H1146M800,436H1080', stroke: '#e0a060', 'stroke-width': 1.6, opacity: .6 });
    el(G, 'path', { d: 'M1090,404V384H1142V404M746,412V396H770V412', fill: N });
    for (let x = 820; x < 1070; x += 36) el(G, 'rect', { x, y: 452, width: 12, height: 9, fill: '#3a2a24' });
    el(G, 'path', { d: 'M944,436V156', stroke: N, 'stroke-width': 9 });
    el(G, 'path', { d: 'M944,156l44,10l-44,10z', fill: '#7c1f14' });
    el(G, 'path', { d: 'M926,206h36v-14h-36z', fill: N });
    el(G, 'path', { d: 'M842,228H1046', stroke: N, 'stroke-width': 6 });
    el(G, 'path', { d: 'M852,230c20,22 164,22 184,0z', fill: '#4a3a3a' });
    for (const x of [884, 944, 1004]) el(G, 'path', { d: `M${x},230v16`, stroke: N, 'stroke-width': 2 });
    const h = el(G, 'g', { stroke: N, 'stroke-width': 1.4, opacity: .9 });
    for (const [x, y] of [[760, 410], [800, 434], [1088, 404], [1140, 402], [900, 436], [990, 436]]) el(h, 'path', { d: `M944,200L${x},${y}` });
    el(h, 'path', { d: 'M772,404C720,440 690,480 668,520', 'stroke-width': 2 }); // l'amarre
  }
  { // le quai de pierre et ce qui s'y tient
    el(S, 'path', { d: `M0,520H${W}V${H}H0Z`, fill: 'url(#q-quai)' });
    el(S, 'path', { d: `M0,520H${W}`, stroke: '#8a6a5a', 'stroke-width': 2, opacity: .6 });
    const p = el(S, 'g', { stroke: '#060508', 'stroke-width': 1.3, opacity: .7 });
    for (let k = -14; k <= 14; k++) el(p, 'path', { d: `M${880 + k * 70},520L${880 + k * 250},${H}` });
    for (const y of [544, 578, 626]) el(p, 'path', { d: `M0,${y}H${W}` });
    for (const x of [668, 1190]) el(S, 'path', { d: `M${x - 9},522v-18c0,-8 18,-8 18,0v18z`, fill: N });
  }
  const Q = el(S, 'g');
  { // le chantier naval : une coque en membrures sur sa cale
    const g = el(Q, 'g', { stroke: N, fill: 'none', 'stroke-width': 5 });
    el(g, 'path', { d: 'M340,520C360,470 420,452 520,452' });
    for (let k = 0; k < 6; k++) { const x = 372 + k * 26; el(g, 'path', { d: `M${x},${506 - k * 7}C${x - 4},${470 - k * 3} ${x + 6},${440} ${x + 14},420`, 'stroke-width': 3.4 }); }
    el(g, 'path', { d: 'M350,520l40,-30M430,520l30,-44M500,520l14,-56', 'stroke-width': 3 });
  }
  { // l'entrepôt : pignon, palan, grande porte éclairée
    el(Q, 'path', { d: 'M548,520V356L640,296L732,356V520Z', fill: N });
    el(Q, 'path', { d: 'M540,362L640,292L740,362', stroke: '#17131c', 'stroke-width': 9, fill: 'none' });
    el(Q, 'path', { d: 'M640,318h64', stroke: N, 'stroke-width': 5 }); el(Q, 'path', { d: 'M700,318v46', stroke: N, 'stroke-width': 1.6 }); caisse(Q, 686, 392, 28, 26, '#16111a');
    el(Q, 'circle', { cx: 640, cy: 470, r: 80, fill: 'url(#q-feu)', opacity: .55, style: 'mix-blend-mode:screen' });
    el(Q, 'path', { d: 'M604,520V448a36,36 0 0 1 72,0V520Z', fill: '#f0b868' });
    el(Q, 'path', { d: 'M640,414V520', stroke: N, 'stroke-width': 3 });
    for (const x of [578, 688]) el(Q, 'rect', { x, y: 380, width: 18, height: 22, fill: '#e8a85a' });
    perso(Q, 622, 520, 54, { fill: N, coiffe: 'bonnet' });
    caisse(Q, 560, 548, 50, 38, '#0b0a10'); caisse(Q, 596, 560, 56, 44, '#0f0d14'); fut(Q, 700, 556, 44, 58, '#0b0a10');
  }
  { // la taverne des marins : enseigne, fenêtres
    el(Q, 'path', { d: 'M1106,520V402L1196,350L1286,402V520Z', fill: N });
    el(Q, 'path', { d: 'M1098,408L1196,346L1294,408', stroke: '#17131c', 'stroke-width': 9, fill: 'none' });
    for (const [x, y] of [[1130, 430], [1170, 430], [1226, 430], [1136, 478]]) { el(Q, 'rect', { x, y, width: 22, height: 26, fill: '#f0b868' }); el(Q, 'path', { d: `M${x + 11},${y}v26M${x},${y + 13}h22`, stroke: N, 'stroke-width': 2 }); }
    el(Q, 'path', { d: 'M1218,520V470a16,16 0 0 1 32,0V520Z', fill: '#e8a85a' });
    el(Q, 'path', { d: 'M1106,440h-34', stroke: N, 'stroke-width': 4 }); el(Q, 'rect', { x: 1066, y: 444, width: 26, height: 30, fill: N, stroke: '#8a6a26', 'stroke-width': 1.5 });
    perso(Q, 1190, 524, 58, { fill: N, coiffe: 'chapeau' }); perso(Q, 1164, 526, 56, { fill: N, vers: -1 });
  }
  { // l'avitailleur : ses tonneaux d'eau, ses sacs
    fut(Q, 1466, 596, 42, 54, '#0b0a10'); fut(Q, 1512, 596, 42, 54, '#0f0d14'); fut(Q, 1488, 606, 46, 60, '#0b0a10');
    el(Q, 'path', { d: 'M1556,604c-6,-22 2,-34 16,-34s22,12 16,34z', fill: '#0f0d14' });
    perso(Q, 1606, 606, 84, { fill: N, coiffe: 'bonnet', vers: -1 });
  }
  el(S, 'rect', { width: W, height: 300, fill: 'url(#haut)', opacity: .55 });
  fermer();
}
const nuagesDuSoir = (S) => { const g = el(S, 'g'); for (const [cx, cy, rx, ry, o] of [[420, 150, 260, 22, .5], [760, 96, 220, 16, .4], [1180, 190, 300, 20, .45], [980, 290, 240, 14, .35], [560, 300, 200, 12, .3]]) el(g, 'ellipse', { cx, cy, rx, ry, fill: '#2a2238', opacity: o, filter: 'url(#f8)' }); };
// Partagé avec les scripts de page chargés après celui-ci.
Object.assign(globalThis, { mesures, page, quantite, CARTE_DU_PORT, sceneDeLaHalle, sceneDuQuai });
