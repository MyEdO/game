/* L'éditeur de campagne (#3935) : un plan de travail, pas un lieu. La barre porte le projet, ses trois documents et les
   gestes d'édition ; à gauche les scènes ou les lieux et l'outil ; au centre la scène vue de dessus ou la carte du
   monde ; à droite l'inspecteur de ce qui est choisi, la logique et la validation. Le plan dessiné est une esquisse,
   pas le relevé de la scène du projet. États de la scène : une porte choisie (`editeur-scene`), l'outil « Terrain » et
   ses options (`editeur-outil-terrain`), un personnage choisi et son « Supprimer » (`editeur-supprimer`). */
const ETAT = document.getElementById('ecran').dataset.etat;
const CARTE = ETAT === 'editeur-carte-du-monde';
const TERRAIN = ETAT === 'editeur-outil-terrain';
const SUPPRIMER = ETAT === 'editeur-supprimer';
const petite = (libelle, o = {}) => plaque(libelle, o);
const outilDePalette = ([icone, nom, la]) => `<div class="o ${la ? 'la' : ''}">${picto(icone, 20, la ? '#2a1a08' : '#e2c06a', 1.5)}<span>${nom}</span></div>`;
const volet = (id, x, y, intitule, corps) => `<div id="${id}" class="volet cadre bois" data-piece="${id}" style="left:${x}px;top:${y}px;width:270px"><div class="fond bois">${corps}</div>${ruban(intitule)}${ferrures}</div>`;
const barre = () => `<div id="barre" class="cadre bois" data-piece="barre"><div class="fond bois">
  ${medaillon('plume', { taille: 'moyen', inerte: true })}
  <div><div class="nom gothique" data-texte="titre">Éditeur de campagne</div><div class="s rubrique">L’Ennemi Intérieur — chapitre 1 : la route d’Altdorf</div></div>
  <div class="sep"></div>
  ${segments(['Scène', 'Carte du monde', 'Narratif'], CARTE ? 'Carte du monde' : 'Scène')}
  <div class="espace"></div>
  ${petite('Annuler', { icone: 'annuler' })}${petite('Rétablir', { icone: 'refaire', fermee: true })}
  <div class="sep"></div>
  ${petite('Copier')}${petite('Coller', { fermee: true })}${petite('Dupliquer')}
  <div class="sep"></div>
  ${petite('Enregistrer', { icone: 'disque' })}${petite('Tester la scène', { icone: 'jouer', armee: true })}
  ${croix({ dansLePanneau: true })}
</div>${ferrures}</div>`;

/* ───────── la scène vue de dessus ───────── */
const C = 30; // côté d'une case, en px
const planDeScene = () => {
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
  if (TERRAIN) o.push(caseR(15, 14, 5, 5, '#77706a'), caseR(12, 15, 3, 3, '#77706a'), ...[[15, 14], [17, 14], [16, 15], [18, 15], [15, 16], [12, 16], [13, 15], [17, 17], [19, 18]].map(([x, y]) => caseR(x + .08, y + .1, .84, .8, '#8a837b'))); // les pavés déjà peints
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
  o.push(porte(9, 13, 10, 13), porte(15, 8, 15, 9, !TERRAIN && !SUPPRIMER));
  o.push(mur(23, 5, 32, 5, '#3a2414'), mur(23, 5, 23, 10, '#3a2414'), mur(32, 5, 32, 10, '#3a2414'));
  // les personnages, le départ, l'entrée
  o.push(pion(7, 5.300), pion(24, 10.500), pion(27, 10.800), pion(29, 14.200), pion(12, 8.500, SUPPRIMER));
  o.push(`<g transform="translate(${16 * C} ${16 * C})"><rect width="${2 * C}" height="${2 * C}" fill="#e2c06a" opacity=".22" stroke="#e2c06a" stroke-dasharray="5 4"/>${[[.5, .5], [1.5, .5], [.5, 1.5], [1.5, 1.5]].map(([a, b]) => `<circle cx="${a * C}" cy="${b * C}" r="9" fill="#e2c06a" stroke="#2a1a08" stroke-width="2"/>`).join('')}</g>`);
  o.push(`<path d="M${17 * C},${20.600 * C}v-34M${17 * C},${19.400 * C}l-8,10M${17 * C},${19.400 * C}l8,10" stroke="#f3dc93" stroke-width="3" fill="none" stroke-linecap="round"/>`);
  const etiquette = (x, y, t) => `<g transform="translate(${x * C} ${y * C})"><rect x="0" y="-13" width="${t.length * 7.200 + 16}" height="20" rx="2" fill="#150c07" stroke="#8a6a26" opacity=".92"/><text x="8" y="2" font-family="Fell SC" font-size="13" letter-spacing=".8" fill="#f0e2c2">${t}</text></g>`;
  o.push(etiquette(18.300, 17.200, 'Départ des héros'), etiquette(17.700, 20.300, 'Entrée'), SUPPRIMER ? etiquette(13.200, 9.100, 'Gustav') : TERRAIN ? '' : etiquette(15.500, 8.200, 'Porte'));
  if (TERRAIN) o.push(`<rect x="${9 * C}" y="${15 * C}" width="${3 * C}" height="${3 * C}" fill="#77706a" opacity=".55" stroke="#f3dc93" stroke-width="2.500"/><path d="M${10 * C},${15 * C}v${3 * C}M${11 * C},${15 * C}v${3 * C}M${9 * C},${16 * C}h${3 * C}M${9 * C},${17 * C}h${3 * C}" stroke="#f3dc93" stroke-opacity=".5"/>`); // le pinceau de 3×3 sous le pointeur
  // règles de coordonnées
  for (let x = 5; x < 35; x += 5) o.push(`<text x="${x * C + 4}" y="${21 * C - 12}" font-family="DejaVu Sans,Arial" font-size="10" fill="#e9dcc0" opacity=".65">${x}</text>`);
  for (let y = 5; y < 21; y += 5) o.push(`<text x="5" y="${y * C + 13}" font-family="DejaVu Sans,Arial" font-size="10" fill="#e9dcc0" opacity=".65">${y}</text>`);
  return `<svg viewBox="0 0 1053 622" preserveAspectRatio="xMidYMid slice">${o.join('')}</svg>`;
};

/* ───────── la carte du monde ───────── */
const LIEUX = [['Auberge La Diligence', 302, 407, 'hameau'], ['La route principale', 395, 349, 'voyage'], ['Auberge des Sept Rayons', 484, 300, 'hameau'], ['Altdorf', 744, 175, 'village']];
const carteDuMonde = () => {
  const r = alea(23), o = [];
  o.push(`<path d="M690,-10c30,60 -10,110 30,160c40,50 0,110 -50,170c-40,50 -30,130 -90,190c-30,40 -20,80 -40,120" fill="none" stroke="#6f8a96" stroke-width="15" opacity=".55" stroke-linecap="round"/><path d="M690,-10c30,60 -10,110 30,160c40,50 0,110 -50,170c-40,50 -30,130 -90,190c-30,40 -20,80 -40,120" fill="none" stroke="#9ab4bc" stroke-width="5" opacity=".6"/>`);
  o.push(`<text x="662" y="330" font-family="Fell" font-style="italic" font-size="17" fill="#3d5560" transform="rotate(-62 662 330)">Le Reik</text>`);
  for (let i = 0; i < 150; i++) { const x = 30 + r() * 990, y = 30 + r() * 570; if (Math.abs(x - 640 + (y - 300) * .3) < 60 || LIEUX.some(([, a, b]) => Math.hypot(x - a, y - b) < 46)) continue; const h = 9 + r() * 7; o.push(`<path d="M${x},${y - h}l${h * .5},${h}h${-h}z" fill="#55623a" opacity="${.35 + r() * .35}"/>`); }
  const chemin = (a, b, km, sens) => { const [, x1, y1] = LIEUX[a], [, x2, y2] = LIEUX[b]; const mx = (x1 + x2) / 2 + (y2 - y1) * .14, my = (y1 + y2) / 2 - (x2 - x1) * .14; const tx = (x1 + x2) / 2 + (y2 - y1) * .07, ty = (y1 + y2) / 2 - (x2 - x1) * .07;
    return `<path d="M${x1},${y1}Q${mx},${my} ${x2},${y2}" fill="none" stroke="#5a2a12" stroke-width="3" stroke-dasharray="9 6"/><g transform="translate(${tx + 14} ${ty + 26})"><rect x="-34" y="-12" width="${sens ? 86 : 68}" height="20" rx="2" fill="#e6d5ad" stroke="#5a4530"/><text x="${sens ? 9 : 0}" y="3" text-anchor="middle" font-family="DejaVu Sans,Arial" font-size="11.500" fill="#2a1d12">${km} km${sens ? ' →' : ''}</text></g>`; };
  o.push(chemin(0, 1, 40, true), chemin(1, 2, 35, true), chemin(2, 3, 115, true));
  const glyphe = { hameau: '<path d="M-9,7v-9l9,-8l9,8v9z" fill="#3a1a10"/><rect x="-2.500" y="0" width="5" height="7" fill="#e6d5ad"/>', voyage: '<path d="M0,9v-20M0,-9h11l3,3l-3,3h-11" fill="none" stroke="#3a1a10" stroke-width="2.600"/>', village: '<path d="M-13,8v-11l5,-4l5,4v-9l3,-4l3,4v9l5,-4l5,4v11z" fill="#3a1a10"/>' };
  LIEUX.forEach(([nom, x, y, g], i) => { const la = i === 0; const l = nom.length * 8.3 + 22;
    o.push(`${la ? `<circle cx="${x}" cy="${y}" r="27" fill="#fff3c8" opacity=".55"/><circle cx="${x}" cy="${y}" r="23" fill="none" stroke="#b8923a" stroke-width="3"/>` : ''}<circle cx="${x}" cy="${y}" r="17" fill="#e6d5ad" stroke="#3a1a10" stroke-width="2"/><g transform="translate(${x} ${y})">${glyphe[g]}</g>
      <g transform="translate(${i === 3 ? x - l / 2 : x - l - 26} ${i === 3 ? y - 46 : y + (i === 0 ? 20 : -6)})"><rect width="${l}" height="24" rx="2" fill="${la ? '#3c110b' : '#e6d5ad'}" stroke="${la ? '#e2c06a' : '#5a4530'}"/><text x="${l / 2}" y="17" text-anchor="middle" font-family="Fell SC" font-size="14.500" letter-spacing=".8" fill="${la ? '#f0e2c2' : '#2a1d12'}">${nom}</text></g>`); });
  o.push(`<text x="40" y="66" font-family="Grenze Gotisch" font-weight="600" font-size="38" fill="#3a1a10">La route d’Altdorf</text><path d="M40,80h270" stroke="#5a4530"/>`);
  o.push(`<g transform="translate(960 536)" fill="none" stroke="#5a4530" stroke-width="1.500"><circle r="34"/><path d="M0,-44L9,0L0,44L-9,0zM-44,0L0,-9L44,0L0,9z" fill="#e6d5ad"/><path d="M0,-44L9,0H-9z" fill="#5a2a12"/></g><text x="960" y="482" text-anchor="middle" font-family="Fell SC" font-size="14" fill="#3a1a10">N</text>`);
  return `<svg viewBox="0 0 1053 622" preserveAspectRatio="xMidYMid slice">${o.join('')}</svg>`;
};

const validation = `<div class="r rubrique">Validation</div><div class="valide">${picto('coche', 15, '#3d5a1c', 2.2)}<span>Validation : aucun défaut détecté. Contrôlé : réfs de logique (déclencheurs, dialogues, rencontres, entités, carte du monde), architecture (corps, étages, façades, toitures).</span></div>`;
const renvoi = (nom) => `<div class="renvoi"><span>${nom}</span>${picto('droite', 14, '#5a4530', 2)}</div>`;
const pieces = [fondDeTable(), barre()];
if (CARTE) {
  pieces.push(
    volet('lieux', 12, 84, 'Lieux (4)', LIEUX.map(([n], i) => ligneDeListe(n, '', { la: i === 0, icone: 'epingle' })).join('')),
    volet('routes', 12, 280, 'Routes (3)', [['La Diligence – La route principale', 40], ['La route principale – Sept Rayons', 35], ['Sept Rayons – Altdorf', 115]].map(([n, k]) => ligneDeListe(`${n}<small>${k} km · pied, diligence</small>`)).join('')),
    volet('outil', 12, 474, 'Outil', `<div class="outils" style="grid-template-columns:repeat(2,1fr)">${[['selection', 'Sélection', 1], ['epingle', 'Lieu'], ['chemin', 'Route'], ['etoile', 'Point d’intérêt']].map(outilDePalette).join('')}</div>`),
    `<div id="plan" class="cadre bois" data-piece="plan"><div class="fond parchemin">${carteDuMonde()}</div>${ferrures}</div>`,
    `<div id="pied" class="bois" data-piece="pied">${picto('epingle', 16)}<span>Lieux (4) · Routes (3) · Modes : pied, diligence</span></div>`,
    `<div id="inspecteur" class="cadre bois" data-piece="inspecteur"><div class="fond parchemin">
       <h3 class="gothique" data-texte="choisi">Lieu</h3><div class="sous rubrique">Carte du monde · 26, 68</div>
       <div class="trait"></div>
       ${champ('Nom', 'Auberge La Diligence')}
       <div class="prop" style="margin-top:6px"><span>Scène</span>${`<span class="pas-a-pas">${picto('gauche', 13, '#5a4530', 2)}<b class="rubrique">La Diligence</b>${picto('droite', 13, '#5a4530', 2)}</span>`}</div>
       <div class="r rubrique">Plan du lieu</div>
       <div class="plan-du-lieu">Aucun point d’intérêt désigné sur le plan.</div>
       <div class="r rubrique">Établissements (0)</div>
       ${plaque('Ajouter un établissement', { icone: 'plus' })}
       <div class="r rubrique">Routes (1)</div>
       <div class="prop"><span>La route principale</span><span class="v chiffres" style="font-style:normal">40 km</span></div>
       <div class="prop" style="flex-direction:column;align-items:flex-start;padding:6px 0 8px;gap:5px"><span>Sens</span>${segments(['Les deux sens', 'Depuis Auberge La Diligence'], 'Depuis Auberge La Diligence')}</div>
       ${validation}
     </div>${ruban('Inspecteur', { gothique: true })}${ferrures}</div>`,
  );
} else {
  const OUTILS = [['selection', 'Sélection', !TERRAIN], ['terrain', 'Terrain', TERRAIN], ['hauteur', 'Hauteur'], ['murs', 'Murs'], ['volee', 'Volée'], ['crenelage', 'Crénelage'], ['decor', 'Décor'], ['personnage', 'Personnage'], ['navire', 'Navire'], ['baliste', 'Emplacement de siège'], ['depart', 'Départ'], ['porte', 'Entrée'], ['ville', 'Architecture'], ['zone', 'Zone'], ['gomme', 'Gomme']];
  const pied = (icone, texte) => `<div id="pied" class="bois" data-piece="pied">${picto(icone, 16)}<span data-texte="pointé">${texte}</span><span class="v" style="color:var(--creme-2);font-style:normal">32 × 38 cases · 22 entités</span></div>`;
  const PIED = {
    'editeur-scene': pied('selection', 'Arête 14, 8 E · couche 0 · Porte · Mur à ossature en bois'),
    'editeur-outil-terrain': pied('terrain', 'Case 10, 16 · couche 0 · Terre battue · 0 m'),
    'editeur-supprimer': pied('selection', 'Personnage « Gustav » · case 12, 8 · couche 0'),
  };
  const TERRAINS = ['Sous-bois', 'Boue', 'Cendre', 'Dallage', 'Eau', 'Fosse', 'Herbe', 'Lave', 'Marbre', 'Mur', 'Neige', 'Ossuaire', 'Pavés', 'Pierre', 'Plancher', 'Planches', 'Porte', 'Roche', 'Chemin', 'Sable', 'Sol ensanglanté', 'Sol nu', 'Terre battue', 'Tourbe', 'Vide (étage)'];
  const INSPECTEUR = {
    'editeur-scene': `<h3 class="gothique" data-texte="choisi">Porte</h3><div class="sous rubrique">Arête 14, 8 E · couche 0</div>
       <div class="trait"></div>
       <div class="prop"><span>Type</span>${segments(['Cloison', 'Porte'], 'Porte')}</div>
       <div class="prop"><span>Fermée au départ</span>${ouiNon(true)}</div>
       <div class="prop"><span>Porte secrète</span>${ouiNon(false)}</div>
       <div class="prop gris"><span>Difficulté de Perception</span><span class="v">—</span></div>
       <div class="prop gris"><span>Découvrable depuis</span><span class="v">—</span></div>
       <div class="prop"><span>Matériau</span><span class="v">Mur à ossature en bois</span></div>
       <div class="prop"><span>Apparence</span><span class="v">Dérivée de la structure</span></div>
       <div class="r rubrique">Logique de la scène</div>
       ${renvoi('Déclencheurs (1)')}${renvoi('Dialogues (0)')}${renvoi('Rencontres (0)')}
       ${validation}`,
    'editeur-outil-terrain': `<h3 class="gothique" data-texte="choisi">Terrain</h3><div class="sous rubrique">Options de l’outil</div>
       <div class="trait"></div>
       <div class="r rubrique">Pinceau</div>
       <div class="pinceau">${segments(['1×1', '3×3', '5×5', 'Rectangle'], '3×3')}</div>
       <div class="r rubrique">Terrains</div>
       <div class="terrains">${TERRAINS.map((n) => `<b class="${n === 'Pavés' ? 'la' : ''}">${n}</b>`).join('')}</div>`,
    'editeur-supprimer': `<h3 class="gothique" data-texte="choisi">Personnage</h3><div class="sous rubrique">Case 12, 8 · couche 0</div>
       <div class="trait"></div>
       ${champ('Nom', 'Gustav')}
       <div class="prop" style="margin-top:6px"><span>Fiche</span><span class="v">Citadin</span></div>
       <div class="prop"><span>Orientation</span><span class="pas-a-pas">${picto('gauche', 13, '#5a4530', 2)}<b class="rubrique">Sud</b>${picto('droite', 13, '#5a4530', 2)}</span></div>
       <div class="prop"><span>Couche</span>${segments(['0', '1'], '0')}</div>
       <div class="r rubrique">Inventaire</div>
       <div class="prop gris"><span>Aucun objet dans l’inventaire.</span></div>
       ${plaque('Ajouter un objet à l’inventaire', { icone: 'plus' })}
       <div class="r rubrique">Poser une troupe</div>
       <div class="prop"><span>Copies</span>${moinsPlus({ entre: '<b class="copies">3</b>' })}</div>
       ${renvoi('Carrière')}${renvoi('Rencontres (0)')}
       <div class="au-pied">${plaque('Supprimer', { icone: 'croix' })}</div>`,
  };
  pieces.push(
    volet('scenes', 12, 84, '4 scènes au projet', `${['La Diligence', 'Altdorf — la porte sud', 'La route principale — le virage', 'Auberge des Sept Rayons'].map((n, i) => ligneDeListe(n, '', { la: i === 0 })).join('')}
      <div class="gestes">${plaque('Nouvelle scène', { icone: 'plus' })}</div><div class="gestes">${plaque('Dupliquer la scène')}${plaque('Retirer la scène')}</div>`),
    volet('outil', 12, 348, 'Outil', `<div class="outils">${OUTILS.map(outilDePalette).join('')}</div>`),
    `<div id="plan" class="cadre bois" data-piece="plan"><div class="fond">${planDeScene()}</div>
       <div id="couches">${plaque('Couche 0', { armee: true, icone: 'couches' })}${plaque('Couche 1')}${plaque('Ajouter une couche', { icone: 'plus' })}${SUPPRIMER ? plaque(`Retirer cette couche${raison('Le rez ne se retire pas')}`, { fermee: true }) : ''}</div>
       <div id="nord" class="rubrique ombre">${picto('route', 18)}Nord : 0° dans le sens horaire</div>${ferrures}</div>`,
    PIED[ETAT],
    `<div id="inspecteur" class="cadre bois" data-piece="inspecteur"><div class="fond parchemin">${INSPECTEUR[ETAT]}</div>${ruban('Inspecteur', { gothique: true })}${ferrures}</div>`,
  );
}
monter(pieces);
