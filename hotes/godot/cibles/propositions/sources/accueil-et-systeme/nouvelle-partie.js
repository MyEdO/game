/* Composer le groupe et choisir la campagne (#3935) : la salle commune d'une auberge-relais. Le groupe est attablé,
   les voyageurs à recruter se tiennent dans la salle, les campagnes sont des avis cloués au panneau.
   États : `roster`, l'onglet « Mes personnages » (zonesDeLaPartie, src/hote/groupe.ts:86-90) ; `coop`, le siège de la place
   libre (attribuerLEmplacement, src/noyau/sieges.ts:143). */
const ETAT = document.getElementById('ecran').dataset.etat ?? '';
const ROSTER = ETAT === 'roster';
radial('mur', [[0, '#c98a4a'], [.3, '#8f5a2e'], [.65, '#4f301a'], [1, '#22140b']], { cx: .5, cy: .52, r: .62 });
grad('sol', [[0, '#3a2414'], [1, '#0e0805']]);
grad('nuit-f', [[0, '#141a3a'], [1, '#33305c']]);
grad('plateau', [[0, '#6b4526'], [1, '#2c1a0d']]);
radial('halo', [[0, '#ffd98a', .55], [.6, '#ffd98a', .12], [1, '#ffd98a', 0]]);
const N = '#0d0806', P = '#1c110a';

// le mur du fond, ses colombages
el(S, 'rect', { width: W, height: 470, fill: 'url(#mur)' });
{
  const g = el(S, 'g', { fill: P });
  for (const x of [338, 492, 646, 1000, 1118, 1296]) el(g, 'rect', { x: x - 9, y: 60, width: 18, height: 410 });
  el(g, 'rect', { x: 0, y: 258, width: 790, height: 12 }); el(g, 'rect', { x: 970, y: 258, width: 760, height: 12 });
  el(g, 'path', { d: 'M347,258L483,74h14L361,258ZM1127,258L1287,74h-14L1113,258Z', opacity: .9 });
  // le plafond et ses solives
  el(g, 'rect', { x: 0, y: 0, width: W, height: 64, fill: '#120a06' });
  for (let x = 40; x < W; x += 118) el(g, 'path', { d: `M${x},64h34l-6,18h-22z`, fill: '#120a06' });
  // deux croisées sur la nuit
  for (const x of [520, 1020]) {
    el(S, 'rect', { x, y: 110, width: 78, height: 112, fill: 'url(#nuit-f)' });
    el(S, 'path', { d: `M${x},110h78v112h-78zM${x + 39},110v112M${x},166h78`, fill: 'none', stroke: P, 'stroke-width': 7 });
    el(S, 'path', { d: `M${x + 14},128l.01,0M${x + 58},146l.01,0M${x + 22},196l.01,0M${x + 62},200l.01,0`, stroke: '#fff', 'stroke-width': 1.6, 'stroke-linecap': 'round', opacity: .7 });
  }
}
// l'âtre
{
  const g = el(S, 'g');
  el(g, 'path', { d: 'M776,470V250l18,-22h172l18,22V470Z', fill: '#2a1c12' });
  el(g, 'path', { d: 'M764,236h232v18H764z', fill: '#150c07' });
  el(g, 'path', { d: 'M800,470V300a80 46 0 0 1 160 0V470Z', fill: '#0a0503' });
  el(g, 'ellipse', { cx: 880, cy: 420, rx: 120, ry: 110, fill: 'url(#lueur)' });
  flammes(g, 880, 462, 1.05);
  el(g, 'path', { d: 'M822,470l20,-12h80l18,12zM838,462l88,-10M842,452l82,12', fill: '#1a0e08', stroke: '#1a0e08', 'stroke-width': 7, 'stroke-linecap': 'round' });
  el(g, 'ellipse', { cx: 880, cy: 380, rx: 520, ry: 300, fill: 'url(#lueur)', opacity: .5 });
  // une marmite à la crémaillère
  el(g, 'path', { d: 'M880,262v80M858,344h44c2,22 -4,34 -22,34s-24,-12 -22,-34z', fill: '#0a0503', stroke: '#0a0503', 'stroke-width': 3 });
  // le manteau : chopes et chandelier
  el(g, 'path', { d: 'M790,236v-16h12v16zM812,236v-22h8v22zM940,236v-18h14v18zM964,236v-12h10v12z', fill: '#150c07' });
}
// le comptoir, à droite : tonneaux, étagères
{
  const g = el(S, 'g', { fill: N });
  el(g, 'rect', { x: 1130, y: 150, width: 160, height: 7 }); el(g, 'rect', { x: 1130, y: 208, width: 160, height: 7 });
  for (const [x, h] of [[1142, 26], [1160, 34], [1182, 22], [1204, 30], [1230, 36], [1256, 24]]) el(g, 'path', { d: `M${x},150v${-h * .6}h3v${-h * .4}h6v${h * .4}h3v${h * .6}z` });
  for (const x of [1140, 1166, 1192, 1222, 1252]) el(g, 'path', { d: `M${x},208v-20h16v20zM${x + 16},193h6v10h-6`, fill: N, stroke: N, 'stroke-width': 2 });
  el(g, 'path', { d: 'M1240,470V372h260v98Z' });
  el(g, 'path', { d: 'M1228,362h290v12h-290z', fill: '#1c110a' });
}
// le lustre
{
  const g = el(S, 'g', { fill: N });
  el(g, 'path', { d: 'M879,64h2v40h-2zM800,112h160v6H800zM806,118l74,22l74,-22', stroke: N, 'stroke-width': 3, fill: 'none' });
  el(g, 'rect', { x: 800, y: 110, width: 160, height: 6 });
  for (const x of [808, 844, 880, 916, 952]) { el(g, 'rect', { x: x - 3, y: 96, width: 6, height: 14, fill: '#e9dcc0' }); el(S, 'circle', { cx: x, cy: 88, r: 22, fill: 'url(#coeur)', opacity: .8 }); el(S, 'path', { d: `M${x},94c-4,-6 0,-9 0,-14c3,4 4,9 0,14z`, fill: '#fff3c8' }); }
}
// le plancher
el(S, 'rect', { x: 0, y: 470, width: W, height: 310, fill: 'url(#sol)' });
{
  const g = el(S, 'g', { stroke: '#0a0503', 'stroke-width': 1.5, opacity: .7 });
  for (let i = -14; i <= 14; i++) el(g, 'path', { d: `M${880 + i * 70},470L${880 + i * 210},780` });
  el(S, 'ellipse', { cx: 880, cy: 500, rx: 420, ry: 60, fill: 'url(#lueur)', opacity: .55 });
}
// les voyageurs, debout dans la salle
const VOYAGEURS = ROSTER ? [
  { id: 'kirsten', nom: 'Astrid Holz', car: 'Artiste', x: 568, h: 160, coiffe: 'bonnet', extra: '' },
  { id: 'harbull', nom: 'Odo Brandebouc', car: 'Batelier', x: 716, h: 108, coiffe: '', extra: '', vise: true },
  { id: 'sigrid', nom: 'Greta Vogt', car: 'Soldate', x: 1056, h: 166, coiffe: 'chignon', extra: '' },
] : [
  { id: 'wanda', nom: 'Wanda Weltschmertz', car: 'Sorcière', x: 414, h: 168, coiffe: 'capuche', extra: `<path d="M19,-66L23,-128" stroke="${N}" stroke-width="3.200" fill="none"/><path d="M23,-128l-5,-8l5,-6l5,6z"/>` },
  { id: 'kirsten', nom: 'Kirsten Krank', car: 'Voleuse', x: 568, h: 160, coiffe: 'bonnet', extra: '<path d="M-15,-70C-24,-50 -24,-20 -20,0L-10,0Z"/>' },
  { id: 'harbull', nom: 'Harbull Piedvelu', car: 'Herboriste', x: 716, h: 108, coiffe: '', extra: '<path d="M14,-52h14v22h-14z"/><path d="M-12,-98c4,-8 20,-8 24,0z"/>', vise: true },
  { id: 'sigrid', nom: 'Sigrid Sommerfeld', car: 'Prêtresse', x: 1056, h: 166, coiffe: 'chignon', extra: `<path d="M-19,-60L-19,-120" stroke="${N}" stroke-width="3" fill="none"/><path d="M-27,-122h16v10h-16z"/>` },
  { id: 'malmir', nom: 'Malmir Giluviel', car: 'Saltimbanque', x: 1206, h: 174, coiffe: 'chapeau', extra: '<path d="M2,-100l12,-26l3,22z"/>' },
];
{
  const g = el(S, 'g');
  el(g, 'ellipse', { cx: 716, cy: 470, rx: 58, ry: 12, fill: 'url(#halo)' });
  el(g, 'ellipse', { cx: 716, cy: 420, rx: 64, ry: 74, fill: 'url(#halo)', opacity: .7 });
  for (const v of VOYAGEURS) { el(g, 'ellipse', { cx: v.x, cy: 472, rx: 34, ry: 6, fill: '#000', opacity: .45 }); perso(g, v.x, 472, v.h, { fill: N, coiffe: v.coiffe, extra: v.extra }); }
}
// la tablée : trois attablés, une place libre
{
  const g = el(S, 'g');
  // la chaise libre, éclairée
  el(g, 'ellipse', { cx: 1094, cy: 500, rx: 70, ry: 62, fill: 'url(#halo)' });
  el(g, 'path', { d: 'M1066,560V470c0,-10 6,-16 14,-16h28c8,0 14,6 14,16v90h-8v-52h-40v52zM1074,476h40v8h-40zM1074,492h40v8h-40z', fill: '#2a1a0e', stroke: '#e2c06a', 'stroke-width': 1.2, 'stroke-dasharray': '5 4' });
  perso(g, 664, 618, 176, { fill: N, coiffe: 'bonnet' });
  perso(g, 812, 618, 164, { fill: N, coiffe: 'capuche' });
  perso(g, 952, 618, 172, { fill: N, coiffe: 'chapeau' });
  // le plateau
  el(g, 'path', { d: 'M560,540h640l44,56H516Z', fill: 'url(#plateau)' });
  el(g, 'path', { d: 'M516,596h728v16H516z', fill: '#170d06' });
  el(g, 'path', { d: 'M560,540h640', stroke: '#a8743e', 'stroke-width': 1.5, opacity: .7 });
  el(g, 'path', { d: 'M548,612h22v168h-22zM1190,612h22v168h-22z', fill: '#0e0704' });
  // sur la table : chandelle, chopes, carte, dés
  el(g, 'ellipse', { cx: 880, cy: 548, rx: 150, ry: 50, fill: 'url(#lueur)', opacity: .8 });
  el(g, 'path', { d: 'M874,566v-26h12v26zM866,566h28v5h-28z', fill: '#e9dcc0' });
  el(g, 'circle', { cx: 880, cy: 528, r: 26, fill: 'url(#coeur)' });
  el(g, 'path', { d: 'M880,538c-6,-9 0,-13 0,-21c5,6 6,13 0,21z', fill: '#fff3c8' });
  for (const [x, y] of [[640, 568], [770, 574], [980, 570]]) el(g, 'path', { d: `M${x},${y}v-22h20v22zM${x + 20},${y - 17}h7v12h-7`, fill: '#150c07', stroke: '#150c07', 'stroke-width': 3 });
  el(g, 'path', { d: 'M1046,560l96,-4l10,24l-98,6z', fill: '#d8c49a' });
  el(g, 'path', { d: 'M1062,566l66,-3M1064,573l58,-3M1066,580l40,-2', stroke: '#5a4530', 'stroke-width': 1.2, fill: 'none' });
  el(g, 'path', { d: 'M1150,548l-22,24', stroke: '#e9dcc0', 'stroke-width': 2.2 });
  el(g, 'path', { d: 'M700,578l10,-3l3,9l-10,3zM718,584l9,2l-2,9l-9,-2z', fill: '#e9dcc0' });
}
fermer();

const avis = (classe, style, icone, nom) => `<div class="avis parchemin ${classe}" style="${style}"><i class="clou"></i>${picto(icone, 17, '#5a2a12', 1.6)}<b class="gothique">${nom}</b></div>`;
const GROUPE = HEROS.slice(0, 3);
monter([
  cartouche({ icone: 'chope', nom: 'La Compagnie', sous: 'Composer le groupe · 3 sur 4', taille: 'titre', largeur: 392 }),
  `<div id="rail" class="cadre bois" data-piece="recruter"><div class="fond bois">
     <div class="deux">${plaque('Pré-tirés', { armee: !ROSTER })}${plaque('Mes personnages', { armee: ROSTER })}</div>
     <div class="pied rubrique">${ROSTER ? '3 personnages dans la salle, sur 3' : '5 voyageurs dans la salle, sur 15'}</div>
     <div class="tourne">${rond('gauche', 'petit')}<span class="rubrique">D’autres voyageurs</span>${rond('droite', 'petit')}</div>
     <div class="trait"></div>
     ${plaque('Créer un personnage', { icone: 'plume', classe: 'gauche' })}
     ${plaque('Importer un personnage…', { icone: 'disque', classe: 'gauche' })}
   </div>${ruban('Recruter')}${ferrures}</div>`,
  `<div id="salle" data-piece="voyageurs">${VOYAGEURS.map((v) => poste(v.x, 472 - v.h - 132, { nom: v.nom, sous: v.car, heros: v.id, vise: v.vise })).join('')}
     <div id="recruter" style="left:${716 - 75}px;top:${472 - 108 - 132 + 100}px">${plaque('Recruter', { armee: true, icone: 'plus', taille: 'petite' })}${ROSTER ? `<div class="du-roster">${outil('disque', 'Exporter')}${outil('croix', 'Supprimer')}</div>` : ''}</div></div>`,
  `<div id="panneau" class="cadre bois" data-piece="campagnes"><div class="fond bois">
     <div class="affiche parchemin"><i class="clou" style="left:14px"></i><i class="clou" style="right:14px"></i>
       <div class="sur rubrique">On recherche : aventuriers courageux</div>
       <div class="n gothique" data-texte="campagne">L’Ennemi Intérieur</div>
       <div class="ch rubrique">Chapitre 1 : la route d’Altdorf</div>
       ${filet({ losange: true })}
       <p data-texte="description">Les Personnages se forment à l’auberge-relais La Diligence, à deux jours d’Altdorf, et cherchent une place à bord d’une diligence pour la capitale.</p>
       ${plaque('Lancer', { armee: true, icone: 'route' })}
       <div class="cachet">${sceau('route', 'moyen')}</div>
     </div>
     ${avis('', 'left:18px;top:292px;transform:rotate(-1.6deg)', 'ancre', 'La Barge du Sel')}
     ${avis('', 'left:36px;top:345px;transform:rotate(1.2deg)', 'ancre', 'Le Loup et la Saumure')}
     ${avis('', 'left:20px;top:398px;transform:rotate(-.8deg)', 'epee', 'L’Arène')}
     ${avis('', 'left:34px;top:451px;transform:rotate(1deg)', 'plume', 'Les Caves de Weissbruck')}
   </div>${ruban('Campagnes', { gothique: true })}${ferrures}</div>`,
  bandeau({
    ...Object.fromEntries(GROUPE.map((h) => [h.id, { html: `<div class="renvoi">${picto('croix', 11, undefined, 1.8)}<span class="rubrique">Renvoyer</span>${ETAT ? `<i></i>${picto('plume', 12, undefined, 1.6)}<span class="rubrique">Modifier</span>` : ''}</div>` }])),
    libre: ETAT === 'coop' ? { html: `<div class="siege"><span class="rubrique">Siège</span>${segments(['Vous', 'Lena', 'Otto'], 'Lena')}</div>` } : { texte: 'Le groupe peut partir à trois.' },
  }, { groupe: [...GROUPE, { nom: 'Place libre', car: 'Un voyageur, ou personne' }] }),
  croix(),
]);
