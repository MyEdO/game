/* Le récap d'un chapitre clos (#3935, #717), pendant du carton d'ouverture : Altdorf au petit matin, la diligence au
   bout de la route. Ce que le chapitre laisse (`src/noyau/chapitreRecap.ts:34-68`, `chap.*` de
   `src/i18n/messages/fr.ts`), puis la fin de séance qu'il ouvre (`seance.js`). Titre, sous-titre, objectifs et lieux :
   `src/scenes/diligence/diligence-projet.json` (`narratif.cloture`, `setObjective`, `worldMap.places`). */
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

const solde = (texte) => `<div class="solde">${rond('coche', 'menu', { arme: true })}<span class="ombre" data-texte="objectif ${texte.slice(0, 14)}">${texte}</span></div>`;
const colonne = (h) => `<div class="col"><div class="tete">${portrait(h.id, { taille: 'petit' })}<div class="qui"><div class="n gothique" data-texte="héros ${h.nom}">${h.nom}</div><div class="c rubrique">${h.car}</div></div>${gainDuHeros(h.id)}</div>
  ${cochable('A agi selon sa Motivation', '+1 Détermination', SEANCE[h.id].coches.motivation)}${cochable('Ambition à court terme accomplie', `+${PX_D_AMBITION.courte} PX`, SEANCE[h.id].coches.courte)}${cochable('Ambition à long terme accomplie', `+${PX_D_AMBITION.longue} PX`, SEANCE[h.id].coches.longue)}</div>`;
monter([
  `<div id="carton" data-piece="carton">
     <div class="sur rubrique ombre">L’Ennemi Intérieur · Fin de chapitre</div>
     <div class="toile-ombre"><div class="toile"><span class="gothique" data-texte="chapitre">Chapitre 1 — la route d’Altdorf</span></div></div>
     <p class="ombre" data-texte="sous-titre">Le reste du trajet n’a rien de remarquable : la compagnie arrive à Altdorf.</p>
     <div class="bande rubrique ombre"><span>Ce que la route retiendra</span><b class="chiffres">+140 PX</b></div>
     ${['Trouver une place à bord d’une diligence pour Altdorf.', 'Examiner les lieux de l’embuscade.', 'Se rendre à Altdorf.'].map(solde).join('')}
     <div class="deux">
       <div><div class="bande rubrique ombre"><span>Lieux révélés</span></div><p class="ombre" data-texte="lieux">Auberge La Diligence · La route principale · Auberge des Sept Rayons · Altdorf</p></div>
       <div><div class="bande rubrique ombre"><span>Tombés en chemin</span></div><p class="ombre" data-texte="tombés">Aucune perte — la compagnie est entière.</p></div>
     </div>
   </div>`,
  `<div id="seance" class="cadre bois" data-piece="fin de séance"><div class="fond bois">
     ${HEROS.map(colonne).join('')}
     <div class="col groupe"><div class="tete"><div class="qui"><div class="n gothique">Le groupe</div><div class="c rubrique">Chance restaurée à la prochaine séance</div></div></div>${casesDuGroupe()}</div>
   </div>${ruban('Fin de séance')}${ferrures}</div>`,
  `<div id="clore" data-piece="clore">${plaque('Clore le chapitre', { armee: true, icone: 'sceau' })}${plaque('Plus tard')}</div>`,
]);
