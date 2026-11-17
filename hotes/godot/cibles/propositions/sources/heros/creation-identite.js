/* Création 9/10 : l'identité (LDB 05 l.432, l.590, l.705-768 ; src/data/details.json, eyes.json, hairs.json, names.json). */
const mesure = (jet, libelle, de, valeur) => `<div class="mesure"><div class="de moyen">${jet}</div><div>${rub(libelle, de)}<b>${valeur}</b></div></div>`;
/* un champ qui s'écrit : la plume le dit ; `saisi` = celui où l'on écrit */
const champ = (libelle, texte, saisi = false) => `<div class="champ ${saisi ? 'saisi' : ''}">${rub(libelle)}<div class="ecrit" data-texte="${libelle}">${texte}${saisi ? '<u></u>' : ''}${picto('plume', 16, '#5a3a1c', 1.5)}</div></div>`;

poser([
  frise(9),
  gauche(`
    <div class="deux" style="column-gap:26px">
      <div>${rub('Sexe')}<div class="onglets-m" style="margin-top:6px">${plaque('Masculin')}${plaque('Féminin', { armee: true })}</div></div>
      <div>${rub('Nom', 'tiré ou écrit')}<div class="onglets-m" style="margin-top:6px">${plaque('Nom aux dés', { icone: 'de20' })}</div></div>
    </div>
    ${champ('Nom', 'Astrid Altdorfer')}
    ${sep()}
    <div class="deux" style="column-gap:26px;align-items:center">${rub('Physique', 'un seul tirage')}<div class="onglets-m">${plaque('Physique aux dés', { icone: 'de20' })}</div></div>
    <div class="physique" style="margin-top:14px">
      ${mesure(8, 'Âge', '15 + d10', '23 ans')}
      ${mesure(27, 'Taille', '145 + 5d10', '172 cm')}
      ${mesure(16, 'Yeux', '2d10', 'Marron')}
      ${mesure(13, 'Cheveux', '2d10', 'Brun foncé')}
    </div>`),
  centre('Identité', `
    <div class="nom" style="margin-top:12px" data-texte="titre de page">Astrid Altdorfer</div>
    <div class="sous">Humains (Reiklander) · Artiste Apprentie</div>
    ${sep()}
    <div class="faits" style="grid-template-columns:repeat(4,auto);justify-content:space-between">
      <div class="fait">${rub('Âge')}<b>23 ans</b></div><div class="fait">${rub('Taille')}<b>172 cm</b></div><div class="fait">${rub('Yeux')}<b>Marron</b></div><div class="fait">${rub('Cheveux')}<b>Brun foncé</b></div>
    </div>
    ${champ('Motivation', 'Peindre ce que nul n’ose regarder', true)}
    ${champ('Ambition à court terme', 'Trouver un mécène à Altdorf')}
    ${champ('Ambition à long terme', 'Voir une de ses toiles au palais impérial')}
    <div style="align-self:stretch;display:flex;align-items:center;justify-content:flex-end;gap:12px;margin-top:auto">
      <svg width="120" height="34" viewBox="0 0 120 34" fill="none" stroke="#2b1a3a" stroke-width="1.300" stroke-linecap="round"><path d="M4 24c8-14 14-18 16-10 2 8-6 14-8 6-1-8 14-14 20-6 4 6 8 8 12 0 3-6 8-6 10 0 2 6 6 6 10-2 3-6 8-8 12-2 3 5 10 6 28-6M10 30c30-4 60-4 96-6"/></svg>
      <div class="sceau" style="width:40px;height:40px">${picto('palette', 21, '#3a0c06', 1.6)}</div>
    </div>`),
  herosNeuf({ nom: 'Astrid Altdorfer', acquis: [...ACQUIS, ['Compétences', 'Six de race, huit de carrière'], ['Talents', 'Six acquis'], ['Possessions', 'Sept, et 7/– en bourse']], pose: .9 }),
  groupeEnCreation({ nom: 'Astrid Altdorfer' }),
  coins(),
]);
