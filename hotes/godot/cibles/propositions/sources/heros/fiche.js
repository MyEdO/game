/* La fiche du héros, sur le gabarit de la maquette validée `fiche-du-heros` (`ecrites/heros.md`) : l'identité et les
   réserves, le profil en bande, la figure, les sections en onglets. Posé sur heros.js. Maquette hors du jeu. */
Object.assign(PICTOS, {
  baton: '<path d="M6 20L18 4M15.500 5.500l2.500 2M7 17.500l2 1.500"/>',
  dague: '<path d="M5 19l3.500-3.500M7 14l3 3M9.500 15.500L19 5l-1 5-7 7z"/>',
  sac: '<path d="M6.500 9h11l1.500 11h-14zM9 9V7a3 3 0 0 1 6 0v2M9.500 13.500h5"/>',
  fiole: '<path d="M10 4h4M10.500 4v5.500L6.500 18a1.500 1.500 0 0 0 1.400 2h8.200a1.500 1.500 0 0 0 1.400-2l-4-8.500V4M8.500 15h7"/>',
  jambe: '<path d="M9 3h6l-1 8h-4zM10 11l1 8h2l1-8M9 19h6v2H9z"/>',
  habit: '<path d="M8.500 4l3.500 2.500L15.500 4l4.500 3-2 3.500-2-1V20H8V9.500l-2 1L4 7z"/>',
  parchemin: '<path d="M7 4h11v13a3 3 0 0 1-3 3H6a2 2 0 0 0 2-2zM6 20a2 2 0 0 1-2-2v-1h4M10.500 8.500h4.500M10.500 12h4.500"/>',
});
/* les héros d'exemple de la fiche : profil de M à B, réserves Destin, Chance, Résilience, Détermination */
const FICHES = {
  ilyanwe: { nom: 'Ilyanwe<br>la Voilée', espece: 'Hauts elfes', carriere: 'Sorcière', pv: 17, max: 17, profil: [5, 33, 30, 26, 45, 62, 58, 52, 80, 70, 29, 17], reserves: [4, 4, 3, 3], sections: ['Attaques', 'Compétences', 'Talents', 'Sorts', 'Possessions'] },
  berta: { nom: 'Berta', espece: 'Humains (Reiklander)', carriere: 'Soldate', pv: 12, max: 12, profil: [4, 41, 33, 38, 36, 31, 30, 28, 27, 34, 29, 12], reserves: [2, 2, 2, 2], sections: ['Attaques', 'Compétences', 'Talents', 'Possessions'] },
};
const RESERVES_DE_FICHE = ['Destin', 'Chance', 'Résilience', 'Détermination'];
/* la fiche du héros `id` ouverte sur la section `active`, dont `contenu` remplit le panneau */
const fiche = (id, active, contenu) => {
  const h = FICHES[id];
  return [
    cadre('identite', 26, 20, 400, 588, 'parchemin', `
      <div class="tete">${portrait(id)}
        <div style="flex:1;min-width:0"><div class="nom" data-texte="nom">${h.nom}</div><div class="l" style="margin-top:8px">${h.espece}</div><div class="l">${h.carriere}</div></div>
      </div>
      <div class="bl" style="margin-top:34px">${rub('Blessures')}<span>${h.pv} / ${h.max}</span></div>
      <div class="vie"><i style="width:${100 * h.pv / h.max}%"></i></div>
      <div style="height:26px"></div>${sep()}
      <div class="reserves" style="margin-top:38px;row-gap:34px">${h.reserves.map((n, i) => reserve(n, RESERVES_DE_FICHE[i])).join('')}</div>`, { classe: 'pan ident' }),
    cadre('bande', 443, 20, 1172, 104, 'parchemin', h.profil.map((v, i) => caseDeCarac([v], i)).join(''), { ruban: 'Caractéristiques', classe: 'bande' }),
    cadre('figure', 443, 142, 397, 466, 'bois', `<div class="niche laiton"><div>${figure(1)}</div></div>`, { classe: 'pan figure' }),
    cadre('sections', 858, 142, 823, 466, 'parchemin', contenu, { tete: onglets(h.sections, active), classe: 'pan sections' }),
    groupeDIlyanwe(id),
    croix(),
    coins(),
  ];
};
// Partagé avec les scripts de page chargés après celui-ci.
Object.assign(globalThis, { fiche });
