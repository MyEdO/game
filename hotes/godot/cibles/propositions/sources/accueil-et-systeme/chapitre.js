/* Les décors du chapitre (#3935) (`../rendu.js`, écran `chapitre`), peints à 1707 × 780, rognés à la vue (`toile`,
   `../lieux-et-nuit/commun.js`) : l'auberge-relais au bord de la route à la nuit tombante, quand il s'ouvre ; Altdorf au
   petit matin, la diligence au bout de la route, quand il se clôt. */
{
  const peindreLOuverture = () => {
    const S = toile(), W = 1707, H = 780;
    grad('ciel', [[0, '#070a1c'], [.34, '#161a44'], [.56, '#3a2c62'], [.7, '#7a4560'], [.8, '#c9764a'], [.9, '#eeb469'], [1, '#eeb469']]);
    grad('ombre-g', [[0, '#04030a', .95], [.36, '#04030a', .72], [.62, '#04030a', .18], [1, '#04030a', 0]], { x1: 0, y1: 0, x2: 1, y2: 0 });
    radial('lune', [[0, '#fff6dc', .9], [.25, '#ffe9b8', .35], [1, '#ffe9b8', 0]]);
    radial('lune-v', [[0, '#c9f0a8', .8], [.3, '#9ad27a', .3], [1, '#9ad27a', 0]]);
    radial('fenetre', [[0, '#ffd98a', .5], [1, '#ffd98a', 0]]);
    grad('route', [[0, '#6b4a3a'], [1, '#1c1218']]);
    const N = '#0b0812', M = '#17111f', F = '#ffcf80';

    el(S, 'rect', { width: W, height: H, fill: 'url(#ciel)' });
    etoiles(el(S, 'g'), 190, 380, 23);
    // Mannslieb, et Morrslieb plus bas
    el(S, 'circle', { cx: 1500, cy: 120, r: 110, fill: 'url(#lune)' }); el(S, 'circle', { cx: 1500, cy: 120, r: 30, fill: '#fff5d6' });
    el(S, 'path', { d: 'M1486,104a7 6 0 1 0 .1,0zM1512,126a9 7 0 1 0 .1,0zM1494,134a4 3 0 1 0 .1,0z', fill: '#e6d6ac', opacity: .7 });
    el(S, 'circle', { cx: 1196, cy: 214, r: 44, fill: 'url(#lune-v)' }); el(S, 'circle', { cx: 1196, cy: 214, r: 10, fill: '#d6f2b4' });
    nuages(el(S, 'g'), [[900, 300, 420, 13, .55], [1420, 250, 300, 11, .5], [560, 360, 360, 12, .5], [1240, 392, 380, 11, .5]], '#2c2250');
    nuages(el(S, 'g'), [[1080, 470, 460, 9, .45], [1500, 486, 280, 7, .4]], '#f0a060', 'f4');
    massif(S, crete(500, 90, 58, 31), 640, '#4a3a68');
    massif(S, crete(530, 46, 40, 5), 640, '#33284e');
    lisiere(S, 566, 70, 50, 110, '#1c1630', 7, 380, 1707);
    // le sol et la route
    el(S, 'path', { d: 'M-20,590C300,560 700,566 1000,572C1300,578 1500,570 1727,560V800H-20Z', fill: M });
    el(S, 'path', { d: 'M600,800C760,700 960,620 1160,584h54C1080,640 960,720 900,800Z', fill: 'url(#route)' });
    el(S, 'path', { d: 'M1214,584C1400,580 1560,590 1727,612V640C1560,612 1400,600 1190,600Z', fill: '#3a2a30' });
    // l'auberge-relais
    {
      const g = el(S, 'g'); const y0 = 584;
      // l'écurie
      el(g, 'path', { d: `M1300,${y0}V480l96,-44l96,44V${y0}Z`, fill: N });
      el(g, 'path', { d: `M1366,${y0}v-56a30 30 0 0 1 60 0v56z`, fill: F, opacity: .9 });
      el(g, 'path', { d: `M1396,${y0}v-84M1366,${y0 - 40}h60`, stroke: N, 'stroke-width': 3 });
      // le corps de logis
      el(g, 'path', { d: `M1040,${y0}V412h280V${y0}Z`, fill: '#120d1a' });
      el(g, 'path', { d: 'M1018,418L1180,268L1342,418Z', fill: N });
      el(g, 'path', { d: 'M1236,330v-70h30v98z', fill: N });
      el(g, 'path', { d: 'M1040,496h280M1040,412h280M1110,412V584M1250,412V584M1180,412V496M1040,496l70,-84M1320,496l-70,-84', stroke: '#06040a', 'stroke-width': 6, fill: 'none' });
      for (const [x, y, w, h] of [[1058, 436, 34, 42], [1128, 436, 34, 42], [1198, 436, 34, 42], [1268, 436, 34, 42], [1058, 520, 34, 44], [1268, 520, 34, 44], [1164, 340, 32, 40]]) {
        el(S, 'circle', { cx: x + w / 2, cy: y + h / 2, r: 46, fill: 'url(#fenetre)' });
        el(g, 'rect', { x, y, width: w, height: h, fill: F });
        el(g, 'path', { d: `M${x + w / 2},${y}v${h}M${x},${y + h / 2}h${w}`, stroke: '#120d1a', 'stroke-width': 2.5 });
      }
      el(g, 'path', { d: `M1152,${y0}v-58a28 28 0 0 1 56 0v58z`, fill: F });
      el(S, 'ellipse', { cx: 1180, cy: y0 + 4, rx: 90, ry: 18, fill: 'url(#fenetre)' });
      // la fumée
      el(g, 'path', { d: 'M1250,258c-10,-22 14,-30 4,-54c-8,-20 12,-32 6,-52', stroke: '#5a4a78', 'stroke-width': 9, 'stroke-linecap': 'round', fill: 'none', opacity: .5, filter: 'url(#f4)' });
      // l'enseigne
      el(g, 'path', { d: 'M1040,452h-62v5h62zM1002,457v10h-34v40h56v-40h-18v-10', fill: N });
      el(g, 'circle', { cx: 996, cy: 487, r: 12, fill: 'none', stroke: F, 'stroke-width': 2 });
      el(g, 'path', { d: 'M996,475v24M984,487h24M987.500,478.500l17,17M1004.500,478.500l-17,17', stroke: F, 'stroke-width': 1.3 });
      // la diligence, dételée devant l'écurie
      const d = el(g, 'g', { fill: '#06040a', transform: 'translate(1520,588)' });
      el(d, 'path', { d: 'M-66,-22v-52c0,-8 5,-12 12,-12h96c7,0 12,4 12,12v52zM-74,-90h140v-7h-140zM-52,-97v-16h40v16zM4,-97v-12h44v12z' });
      el(d, 'path', { d: 'M-50,-76h26v26h-26zM-14,-76h26v26h-14z', fill: F, opacity: .85 });
      for (const x of [-40, 30]) { el(d, 'circle', { cx: x, cy: -18, r: 22, fill: 'none', stroke: '#06040a', 'stroke-width': 5 }); el(d, 'path', { d: `M${x - 22},-18h44M${x},-40v44M${x - 15.500},-33.500l31,31M${x + 15.500},-33.500l-31,31`, stroke: '#06040a', 'stroke-width': 2.2 }); el(d, 'circle', { cx: x, cy: -18, r: 5 }); }
      el(d, 'path', { d: 'M54,-30l70,22', stroke: '#06040a', 'stroke-width': 4 });
      // la barrière
      for (let x = 700; x < 1020; x += 44) el(g, 'path', { d: `M${x},596v-26h5v26z`, fill: N });
      el(g, 'path', { d: 'M700,576h310v4h-310zM700,586h310v3h-310z', fill: N });
    }
    // les voyageurs, sur la route
    {
      const g = el(S, 'g');
      const baton = `<path d="M17,-70L26,-114" stroke="#06040a" stroke-width="3.500" fill="none"/>`;
      const sac = '<path d="M-17,-70C-23,-66 -23,-46 -17,-40L-6,-40L-6,-70Z"/>';
      perso(g, 962, 620, 80, { fill: '#06040a', coiffe: 'bonnet', extra: sac });
      perso(g, 1004, 614, 74, { fill: '#06040a', coiffe: 'capuche' });
      perso(g, 1046, 608, 76, { fill: '#06040a', coiffe: 'chapeau', extra: baton });
      perso(g, 1086, 602, 70, { fill: '#06040a', coiffe: 'chignon' });
    }
    [[-6, 800, 660], [92, 800, 540], [196, 800, 430], [1700, 800, 400]].forEach(([x, y, h]) => sapin(S, x, y, h, '#06040a'));
    el(S, 'rect', { x: 0, y: 0, width: 1000, height: H, fill: 'url(#ombre-g)' });
    el(S, 'rect', { width: W, height: H, fill: 'url(#vignette)', opacity: .8 });
    el(S, 'rect', { x: 0, y: 600, width: W, height: 180, fill: 'url(#bas)', opacity: .8 });
  };
  const peindreLaCloture = () => {
    const S = toile(), W = 1707, H = 780;
    grad('ciel', [[0, '#141a3c'], [.3, '#3a3a6e'], [.52, '#8a5a7c'], [.7, '#e39a6a'], [.84, '#f8d68c'], [1, '#f8d68c']]);
    grad('ombre-g', [[0, '#04030a', .95], [.36, '#04030a', .74], [.6, '#04030a', .2], [1, '#04030a', 0]], { x1: 0, y1: 0, x2: 1, y2: 0 });
    radial('soleil', [[0, '#fff4cc', 1], [.2, '#ffdc94', .8], [.55, '#f4a060', .3], [1, '#f4a060', 0]]);
    grad('route', [[0, '#7a5a48'], [1, '#1c1218']]);
    el(S, 'rect', { width: W, height: H, fill: 'url(#ciel)' });
    etoiles(el(S, 'g'), 60, 200, 17);
    nuages(el(S, 'g'), [[980, 150, 420, 13, .5], [1480, 120, 300, 11, .45], [1240, 214, 360, 11, .45]], '#4a3a6c');
    nuages(el(S, 'g'), [[1100, 280, 440, 9, .5], [1500, 300, 280, 7, .45]], '#f6b074', 'f4');
    el(S, 'ellipse', { cx: 1200, cy: 420, rx: 560, ry: 250, fill: 'url(#soleil)' });
    massif(S, crete(400, 110, 58, 31), 520, '#6b5486');
    massif(S, crete(424, 50, 44, 5), 520, '#4d3d6c');
    altdorf(el(S, 'g', { transform: 'translate(40,-96)' }));
    // la plaine, la route, la diligence qui arrive
    el(S, 'path', { d: 'M-20,470C300,452 700,456 1000,458C1300,460 1500,456 1727,452V800H-20Z', fill: '#17111f' });
    el(S, 'path', { d: 'M700,800C860,640 1040,520 1206,458h32C1150,540 1060,660 1010,800Z', fill: 'url(#route)' });
    lisiere(S, 474, 26, 30, 56, '#0d0916', 7, 820, 1100);
    lisiere(S, 474, 22, 30, 60, '#0d0916', 19, 1330, 1707);
    {
      const d = el(S, 'g', { fill: '#06040a', transform: 'translate(1128,470) scale(.42)' });
      el(d, 'path', { d: 'M-66,-22v-52c0,-8 5,-12 12,-12h96c7,0 12,4 12,12v52zM-74,-90h140v-7h-140zM-52,-97v-16h40v16zM4,-97v-12h44v12z' });
      for (const x of [-40, 30]) { el(d, 'circle', { cx: x, cy: -18, r: 22, fill: 'none', stroke: '#06040a', 'stroke-width': 5 }); el(d, 'circle', { cx: x, cy: -18, r: 5 }); }
    }
    el(S, 'rect', { x: 0, y: 0, width: 1040, height: H, fill: 'url(#ombre-g)' });
    el(S, 'rect', { width: W, height: H, fill: 'url(#vignette)', opacity: .8 });
    el(S, 'rect', { x: 0, y: 500, width: W, height: 280, fill: 'url(#bas)', opacity: .9 });
  };
  Object.assign(globalThis, { peindreLOuverture, peindreLaCloture });
}
