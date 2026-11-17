/* La fin de séance (#3935), ouverte du menu de la partie par-dessus le jeu assombri : un feuillet par héros (ce qu'il a
   écrit, ses trois cases, ce que la séance lui vaut), les deux cases du groupe, « Terminer la séance ».
   `src/noyau/partyFlow.ts:661-716` ; cases, octrois et réfs : `seance.js`. */
const ecrit = (texte, absent) => `<p class="ecrit${texte ? '' : ' absent'}">${texte ?? absent}</p>`;
const bloc = (rubrique, droite, corps) => `<div class="bloc"><div class="l rubrique"><span>${rubrique}</span><span>${droite}</span></div>${corps}</div>`;
const feuillet = (h) => { const f = SEANCE[h.id]; return `
  <div class="seance-heros cadre bois"><div class="fond parchemin">
    <div class="tete">${portrait(h.id)}<div class="qui"><div class="n gothique" data-texte="héros ${h.nom}">${h.nom}</div><div class="c rubrique">${h.car}</div></div>${gainDuHeros(h.id)}</div>
    ${bloc('Motivation', `Détermination ${h.determination} / ${h.resilience}`, `${ecrit(f.motivation)}${cochable('A agi selon sa Motivation', '+1 Détermination', f.coches.motivation)}`)}
    ${bloc('Ambition à court terme', '', `${ecrit(f.courte, 'Aucune Ambition à court terme notée')}${cochable('Ambition à court terme accomplie', `+${PX_D_AMBITION.courte} PX`, f.coches.courte)}
      ${f.coches.courte ? `<div class="nouvelle-ambition">${picto('plume', 15, '#5a2a12', 1.7)}<em>Nouvelle Ambition à court terme</em><i></i></div>` : ''}`)}
    ${bloc('Ambition à long terme', '', `${ecrit(f.longue, 'Aucune Ambition à long terme notée')}${cochable('Ambition à long terme accomplie', `+${PX_D_AMBITION.longue} PX`, f.coches.longue)}`)}
  </div>${ferrures}</div>`; };
el(S, 'rect', { width: W, height: H, fill: '#04030a', opacity: .38 });
el(S, 'rect', { width: W, height: H, fill: 'url(#vignette)', opacity: .7 });
monter([
  titre({ icone: 'plume', nom: 'Fin de séance', sous: 'Steinbruck · 14 Pflugzeit 2512 CI · 18:20', largeur: 430 }),
  croix(),
  `<div id="feuillets" data-piece="héros">${HEROS.map(feuillet).join('')}</div>`,
  `<div id="groupe" class="cadre bois" data-piece="groupe"><div class="fond bois"><span class="ruban rubrique">Le groupe</span>
     <div class="cases">${casesDuGroupe()}</div>
     <p data-texte="chance">La Chance du groupe sera restaurée pour la prochaine séance.</p>
   </div>${ferrures}</div>`,
  `<div id="terminer" data-piece="terminer">${plaque('Terminer la séance', { armee: true, icone: 'plume' })}</div>`,
]);
