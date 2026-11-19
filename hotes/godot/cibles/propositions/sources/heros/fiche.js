/* La fiche du héros, sur le gabarit de la maquette validée `fiche-du-heros` (`ecrites/heros.md`) : l'identité et les
   réserves, le profil en bande, la figure, les sections en onglets. Posé sur heros.js. Maquette hors du jeu. */
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
      <div class="tete">${portrait(id, { taille: 'affiche' })}
        <div style="flex:1;min-width:0"><div class="nom" data-texte="nom">${h.nom}</div><div class="l" style="margin-top:8px">${h.espece}</div><div class="l">${h.carriere}</div></div>
      </div>
      <div class="bl" style="margin-top:34px">${rub('Blessures')}<span>${h.pv} / ${h.max}</span></div>
      ${jauge(h.pv / h.max, { taille: 'forte' })}
      <div style="height:26px"></div>${filet({ fondu: true, losange: true })}
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
