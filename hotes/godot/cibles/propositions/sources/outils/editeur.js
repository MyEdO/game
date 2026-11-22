/* Les dessins de l'éditeur de campagne (#3935, #4411) (`../rendu.js`, écrans `editeur-de-scene` et
   `editeur-carte-du-monde`) : la scène vue de dessus, une esquisse quadrillée de la cour de La Diligence et non le relevé
   de la scène du projet ; la carte du monde sur parchemin, ses lieux et ses routes. Maquette hors du jeu. */
/* ───────── la scène vue de dessus ───────── */
const C = 30; // côté d'une case, en px
/* `porte`, la porte de la cuisine choisie ; `personnage`, le nom du personnage choisi ; `pinceau`, le côté du pinceau
   sous le pointeur, et les cases déjà peintes */
const planDeScene = ({ porte: porteChoisie = false, personnage = null, pinceau = null } = {}) => {
  const r = alea(11), o = [];
  const caseR = (x, y, w, h, fill, extra = '') => `<rect x="${x * C}" y="${y * C}" width="${w * C}" height="${h * C}" fill="${fill}" ${extra}/>`;
  const mur = (x1, y1, x2, y2, c = '#1a100a', l = 7) => `<path d="M${x1 * C},${y1 * C}L${x2 * C},${y2 * C}" stroke="${c}" stroke-width="${l}" stroke-linecap="square"/>`;
  const porte = (x1, y1, x2, y2, choisie = false) => `<path d="M${x1 * C},${y1 * C}L${x2 * C},${y2 * C}" stroke="${choisie ? '#f3dc93' : '#b8843f'}" stroke-width="${choisie ? 7 : 5}"/>${choisie ? `<path d="M${x1 * C},${y1 * C}L${x2 * C},${y2 * C}" stroke="#fff3c8" stroke-width="13" opacity=".28"/><rect x="${x1 * C - 5}" y="${y1 * C - 5}" width="10" height="10" fill="#f3dc93" stroke="#2a1a08"/><rect x="${x2 * C - 5}" y="${y2 * C - 5}" width="10" height="10" fill="#f3dc93" stroke="#2a1a08"/>` : ''}`;
  const tableRonde = (x, y) => `<circle cx="${x * C}" cy="${y * C}" r="17" fill="#4a2f18" stroke="#1a100a" stroke-width="1.500"/>${[[-25, 0], [25, 0], [0, -25], [0, 25]].map(([a, b]) => `<circle cx="${x * C + a}" cy="${y * C + b}" r="6" fill="#3a2414" stroke="#1a100a"/>`).join('')}`;
  const fut = (x, y) => `<circle cx="${(x + .5) * C}" cy="${(y + .5) * C}" r="11" fill="#5d3d22" stroke="#1a100a" stroke-width="1.500"/><circle cx="${(x + .5) * C}" cy="${(y + .5) * C}" r="6" fill="none" stroke="#2a180b"/>`;
  const pion = (x, y, choisi = false) => `${choisi ? `<circle cx="${(x + .5) * C}" cy="${(y + .5) * C}" r="19" fill="#fff3c8" opacity=".3"/><circle cx="${(x + .5) * C}" cy="${(y + .5) * C}" r="15" fill="none" stroke="#f3dc93" stroke-width="2.500"/>` : ''}<circle cx="${(x + .5) * C}" cy="${(y + .5) * C}" r="11" fill="#8f8672" stroke="#14100c" stroke-width="2"/><path d="M${(x + .5) * C - 5},${(y + .5) * C + 6}c0,-5 2,-7 5,-7s5,2 5,7zM${(x + .5) * C - 3},${(y + .5) * C - 4}a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" fill="#14100c"/>`;
  o.push(`<rect width="1053" height="622" fill="#2f3a26"/>`);
  for (let i = 0; i < 90; i++) o.push(`<circle cx="${r() * 1053}" cy="${r() * 622}" r="${1 + r() * 2}" fill="#3d4a30"/>`);
  o.push(caseR(2, 3, 31, 16, '#5c4c38'));                       // la cour
  for (let i = 0; i < 160; i++) o.push(`<circle cx="${60 + r() * 930}" cy="${90 + r() * 480}" r="${1 + r() * 2.5}" fill="${r() > .5 ? '#6b5a44' : '#4e4030'}"/>`);
  if (pinceau) o.push(caseR(15, 14, 5, 5, '#77706a'), caseR(12, 15, 3, 3, '#77706a'), ...[[15, 14], [17, 14], [16, 15], [18, 15], [15, 16], [12, 16], [13, 15], [17, 17], [19, 18]].map(([x, y]) => caseR(x + .08, y + .1, .84, .8, '#8a837b'))); // les pavés déjà peints
  o.push(caseR(4, 5, 15, 8, '#7a5a38'));                        // l'auberge
  for (let y = 5; y < 13; y++) o.push(`<path d="M${4 * C},${y * C}H${19 * C}" stroke="#5f4428" stroke-width="1"/>`);
  o.push(caseR(15, 5, 4, 8, '#6d6458'));                        // la cuisine, dallée
  o.push(caseR(23, 5, 9, 5, '#8a7440'));                        // l'écurie
  for (let x = 24; x < 32; x += 2) o.push(mur(x, 5, x, 8.4, '#3a2414', 4));
  o.push(`<path d="M${5 * C},${6.5 * C}H${11 * C}v${C * .8}H${5 * C}z" fill="#4a2f18" stroke="#1a100a" stroke-width="1.500"/>`); // le comptoir
  o.push(tableRonde(7, 10), tableRonde(11, 10.500), tableRonde(13, 7.500));
  o.push(fut(16, 5), fut(17, 5), fut(18, 6), fut(4, 5));
  o.push(`<rect x="${16.200 * C}" y="${10 * C}" width="${2.600 * C}" height="${1.500 * C}" fill="#2a2420" stroke="#14100c" stroke-width="1.500"/><circle cx="${17.500 * C}" cy="${10.750 * C}" r="9" fill="#c8452c" opacity=".8"/>`); // l'âtre
  o.push(`<circle cx="${21 * C}" cy="${14 * C}" r="20" fill="#6d6458" stroke="#1a100a" stroke-width="2"/><circle cx="${21 * C}" cy="${14 * C}" r="11" fill="#1c2a34"/>`); // le puits
  o.push(`<g transform="translate(${25 * C} ${13 * C})"><rect x="0" y="0" width="${3.400 * C}" height="${1.800 * C}" rx="5" fill="#2a180b" stroke="#14100c" stroke-width="2"/><rect x="8" y="7" width="${3.400 * C - 16}" height="${1.800 * C - 14}" fill="#7c1f14"/><rect x="-10" y="-5" width="16" height="9" fill="#14100c"/><rect x="-10" y="${1.800 * C - 4}" width="16" height="9" fill="#14100c"/><rect x="${3.400 * C - 12}" y="-5" width="16" height="9" fill="#14100c"/><rect x="${3.400 * C - 12}" y="${1.800 * C - 4}" width="16" height="9" fill="#14100c"/><path d="M${3.400 * C},${.9 * C}h46" stroke="#14100c" stroke-width="4"/></g>`); // la diligence
  // grille
  for (let x = 0; x <= 35; x++) o.push(`<path d="M${x * C},0V622" stroke="#000" stroke-opacity="${x % 5 ? .16 : .32}" stroke-width="1"/>`);
  for (let y = 0; y <= 21; y++) o.push(`<path d="M0,${y * C}H1053" stroke="#000" stroke-opacity="${y % 5 ? .16 : .32}" stroke-width="1"/>`);
  // l'enceinte et son portail
  o.push(mur(2, 3, 33, 3, '#4a463e', 9), mur(2, 3, 2, 19, '#4a463e', 9), mur(33, 3, 33, 19, '#4a463e', 9), mur(2, 19, 15, 19, '#4a463e', 9), mur(19, 19, 33, 19, '#4a463e', 9));
  o.push(porte(15, 19, 19, 19));
  // les murs de l'auberge, ses portes
  o.push(mur(4, 5, 19, 5), mur(4, 5, 4, 13), mur(19, 5, 19, 13), mur(4, 13, 9, 13), mur(10, 13, 19, 13), mur(15, 5, 15, 8), mur(15, 9, 15, 13));
  o.push(porte(9, 13, 10, 13), porte(15, 8, 15, 9, porteChoisie));
  o.push(mur(23, 5, 32, 5, '#3a2414'), mur(23, 5, 23, 10, '#3a2414'), mur(32, 5, 32, 10, '#3a2414'));
  // les personnages, le départ, l'entrée
  o.push(pion(7, 5.300), pion(24, 10.500), pion(27, 10.800), pion(29, 14.200), pion(12, 8.500, !!personnage));
  o.push(`<g transform="translate(${16 * C} ${16 * C})"><rect width="${2 * C}" height="${2 * C}" fill="#e2c06a" opacity=".22" stroke="#e2c06a" stroke-dasharray="5 4"/>${[[.5, .5], [1.5, .5], [.5, 1.5], [1.5, 1.5]].map(([a, b]) => `<circle cx="${a * C}" cy="${b * C}" r="9" fill="#e2c06a" stroke="#2a1a08" stroke-width="2"/>`).join('')}</g>`);
  o.push(`<path d="M${17 * C},${20.600 * C}v-34M${17 * C},${19.400 * C}l-8,10M${17 * C},${19.400 * C}l8,10" stroke="#f3dc93" stroke-width="3" fill="none" stroke-linecap="round"/>`);
  const etiquette = (x, y, t) => `<g transform="translate(${x * C} ${y * C})"><rect x="0" y="-13" width="${t.length * 7.200 + 16}" height="20" rx="2" fill="#150c07" stroke="#8a6a26" opacity=".92"/><text x="8" y="2" font-family="Fell SC" font-size="13" letter-spacing=".8" fill="#f0e2c2">${t}</text></g>`;
  o.push(etiquette(18.300, 17.200, 'Départ des héros'), etiquette(17.700, 20.300, 'Entrée'), personnage ? etiquette(13.200, 9.100, personnage) : porteChoisie ? etiquette(15.500, 8.200, 'Porte') : '');
  if (pinceau) o.push(`<rect x="${9 * C}" y="${15 * C}" width="${pinceau * C}" height="${pinceau * C}" fill="#77706a" opacity=".55" stroke="#f3dc93" stroke-width="2.500"/><path d="${Array.from({ length: pinceau - 1 }, (_, k) => `M${(10 + k) * C},${15 * C}v${pinceau * C}M${9 * C},${(16 + k) * C}h${pinceau * C}`).join('')}" stroke="#f3dc93" stroke-opacity=".5"/>`); // le pinceau sous le pointeur
  // règles de coordonnées
  for (let x = 5; x < 35; x += 5) o.push(`<text x="${x * C + 4}" y="${21 * C - 12}" font-family="DejaVu Sans,Arial" font-size="10" fill="#e9dcc0" opacity=".65">${x}</text>`);
  for (let y = 5; y < 21; y += 5) o.push(`<text x="5" y="${y * C + 13}" font-family="DejaVu Sans,Arial" font-size="10" fill="#e9dcc0" opacity=".65">${y}</text>`);
  return `<svg viewBox="0 0 1053 622" preserveAspectRatio="xMidYMid slice">${o.join('')}</svg>`;
};

/* ───────── la carte du monde ───────── */
/* `titre`, le titre de la carte ; `lieux`, chacun { nom, genre, place: [x, y], choisi } ; `routes`, chacune
   { de, vers, km } par rang de lieu, à sens unique */
const carteDeLEditeur = ({ titre, lieux, routes }) => {
  const r = alea(23), o = [];
  o.push(`<path d="M690,-10c30,60 -10,110 30,160c40,50 0,110 -50,170c-40,50 -30,130 -90,190c-30,40 -20,80 -40,120" fill="none" stroke="#6f8a96" stroke-width="15" opacity=".55" stroke-linecap="round"/><path d="M690,-10c30,60 -10,110 30,160c40,50 0,110 -50,170c-40,50 -30,130 -90,190c-30,40 -20,80 -40,120" fill="none" stroke="#9ab4bc" stroke-width="5" opacity=".6"/>`);
  o.push(`<text x="662" y="330" font-family="Fell" font-style="italic" font-size="17" fill="#3d5560" transform="rotate(-62 662 330)">Le Reik</text>`);
  for (let i = 0; i < 150; i++) { const x = 30 + r() * 990, y = 30 + r() * 570; if (Math.abs(x - 640 + (y - 300) * .3) < 60 || lieux.some(({ place: [a, b] }) => Math.hypot(x - a, y - b) < 46)) continue; const h = 9 + r() * 7; o.push(`<path d="M${x},${y - h}l${h * .5},${h}h${-h}z" fill="#55623a" opacity="${.35 + r() * .35}"/>`); }
  const chemin = ({ de, vers, km }) => { const [x1, y1] = lieux[de].place, [x2, y2] = lieux[vers].place; const mx = (x1 + x2) / 2 + (y2 - y1) * .14, my = (y1 + y2) / 2 - (x2 - x1) * .14; const tx = (x1 + x2) / 2 + (y2 - y1) * .07, ty = (y1 + y2) / 2 - (x2 - x1) * .07;
    return `<path d="M${x1},${y1}Q${mx},${my} ${x2},${y2}" fill="none" stroke="#5a2a12" stroke-width="3" stroke-dasharray="9 6"/><g transform="translate(${tx + 14} ${ty + 26})"><rect x="-50" y="-17" width="124" height="29" rx="2" fill="#e6d5ad" stroke="#5a4530"/><text x="12" y="4" text-anchor="middle" font-family="DejaVu Sans,Arial" font-size="17.500" fill="#2a1d12">${km} km →</text></g>`; };
  o.push(...routes.map(chemin));
  const glyphe = { hameau: '<path d="M-9,7v-9l9,-8l9,8v9z" fill="#3a1a10"/><rect x="-2.500" y="0" width="5" height="7" fill="#e6d5ad"/>', voyage: '<path d="M0,9v-20M0,-9h11l3,3l-3,3h-11" fill="none" stroke="#3a1a10" stroke-width="2.600"/>', village: '<path d="M-13,8v-11l5,-4l5,4v-9l3,-4l3,4v9l5,-4l5,4v11z" fill="#3a1a10"/>' };
  /* l'étiquette d'un lieu : au-dessus d'un village, à gauche des autres, sous le point quand il est choisi */
  lieux.forEach(({ nom, genre, place: [x, y], choisi }) => { const l = nom.length * 12.5 + 30;
    const [ex, ey] = genre === 'village' ? [x - l / 2, y - 60] : choisi ? [x - l / 2, y + 32] : [x - l - 26, y - 10];
    o.push(`${choisi ? `<circle cx="${x}" cy="${y}" r="27" fill="#fff3c8" opacity=".55"/><circle cx="${x}" cy="${y}" r="23" fill="none" stroke="#b8923a" stroke-width="3"/>` : ''}<circle cx="${x}" cy="${y}" r="17" fill="#e6d5ad" stroke="#3a1a10" stroke-width="2"/><g transform="translate(${x} ${y})">${glyphe[genre]}</g>
      <g transform="translate(${ex} ${ey})"><rect width="${l}" height="34" rx="2" fill="${choisi ? '#3c110b' : '#e6d5ad'}" stroke="${choisi ? '#e2c06a' : '#5a4530'}"/><text x="${l / 2}" y="24" text-anchor="middle" font-family="Fell SC" font-size="21" letter-spacing=".8" fill="${choisi ? '#f0e2c2' : '#2a1d12'}">${nom}</text></g>`); });
  o.push(`<text x="40" y="66" font-family="Grenze Gotisch" font-weight="600" font-size="38" fill="#3a1a10">${titre}</text><path d="M40,80h270" stroke="#5a4530"/>`);
  o.push(`<g transform="translate(960 536)" fill="none" stroke="#5a4530" stroke-width="1.500"><circle r="34"/><path d="M0,-44L9,0L0,44L-9,0zM-44,0L0,-9L44,0L0,9z" fill="#e6d5ad"/><path d="M0,-44L9,0H-9z" fill="#5a2a12"/></g><text x="960" y="482" text-anchor="middle" font-family="Fell SC" font-size="14" fill="#3a1a10">N</text>`);
  return `<svg viewBox="0 0 1053 622" preserveAspectRatio="xMidYMid meet">${o.join('')}</svg>`;
};
// Partagé avec la page de rendu.
Object.assign(globalThis, { planDeScene, carteDeLEditeur });
