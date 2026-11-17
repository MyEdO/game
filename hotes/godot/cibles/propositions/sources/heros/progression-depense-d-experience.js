/* Progression : la dépense d'expérience (LDB 07 l.41-105 ; src/noyau/monde/advancement.ts, src/engine/advancement.ts). */
const PROFIL = [[5], [33, 2, 25, true], [30, 0, 50], [26, 0, 50], [45, 0, 50], [62, 0, 50], [58, 0, 50], [52, 0, 50], [80, 5, 25, true], [70, 6, 30, true], [29, 0, 50], [17]];
const caseDeCarac = ([v, aug, cout, carriere], i) => `<div class="c ${carriere ? 'carr' : ''}"><span class="ab">${ABR[i]}</span><span class="v">${v}</span><span class="aug">${aug ? `+${aug}` : ''}</span>${cout ? `<span class="jeton ${carriere ? 'or' : 'fer'}">${cout} PX</span>` : ''}</div>`;
const COMPETENCES = [
  ['CC', 'Corps à corps', "Armes d'hast", 5, 38, 10], ['CC', 'Corps à corps', 'Base', 3, 36, 10], ['Ag', 'Esquive', '', 5, 63, 10], ['FM', 'Focalisation', '', 8, 78, 15],
  ['I', 'Intuition', '', 5, 67, 10], ['Int', 'Langue', 'Magick', 10, 90, 15], ['I', 'Perception', '', 2, 64, 10, true], ['Int', 'Savoir', 'Magie', 6, 86, 15],
];
const achat = ([c, n, spec, aug, test, cout, vise]) => `<div class="achat ${vise ? 'vise' : ''}"><span class="fait">${aug >= 5 ? picto('coche', 15, '#6d5119', 2.4) : ''}</span>${car(c)}<span class="n" data-texte="${n} ${spec}">${n}${spec ? ` <small>(${spec})</small>` : ''}</span>
  <span class="aug">+${aug}</span><span class="val" style="min-width:${vise ? 74 : 30}px">${vise ? `${test} <span style="font-weight:400">→</span> ${test + 1}` : test}</span>${plaque(`${cout} PX`, { armee: !!vise })}</div>`;
const talent = (icone, nom, sous, cout, clos = false) => `<div class="talent ${clos ? 'clos' : ''}"><div class="medaillon petit ${clos ? 'fer' : 'laiton'}"><div>${picto(icone, 19, clos ? '#8d8474' : '#e2c06a')}</div></div><div class="t"><b data-texte="${nom}">${nom}</b><i>${sous}</i></div>${plaque(cout, { fermee: clos })}</div>`;

poser([
  identite({ px: 285, apres: '275 après cet achat', niveau: 'Sorcière novice',
    exigences: [[false, 'Cinq Augmentations en CC, Int et FM', '2 / 3'], [false, 'Cinq dans huit Compétences', '6 / 8'], [true, 'Un Talent du niveau']],
    pied: `${plaque('Changer de carrière', { prix: '200 PX', classe: 'gauche', style: 'height:38px' })}<div class="rub" style="margin-top:7px"><span class="note">100 PX une fois le niveau achevé.</span></div>` }),
  cadre('bande', 443, 20, 1238, 132, 'parchemin', PROFIL.map(caseDeCarac).join(''), { ruban: 'Caractéristiques', classe: 'bande' }),
  cadre('competences', 443, 170, 640, 438, 'parchemin', `
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin:6px 4px 2px 2px">${rub('De la carrière', 'une Augmentation à la fois')}<span class="rub">Test &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Coût &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></div>
    ${COMPETENCES.map(achat).join('')}
    <div class="achat" style="border-bottom:0;color:#5a4530">${`<span class="fait">${picto('cadenas', 15, '#5a4530', 1.6)}</span>`}<span class="n" style="color:#5a4530">Hors carrière <small>(six Compétences)</small></span><span class="rub" style="color:#6b1c10">Coût doublé</span>${picto('chevron_d', 15, '#5a4530', 2)}</div>`, { ruban: 'Compétences', classe: 'pan' }),
  cadre('talents', 1100, 170, 581, 438, 'parchemin', `
    <div style="margin:6px 0 -2px">${rub('De Sorcière novice', 'cent PX, et cent de plus par fois déjà pris')}</div>
    ${talent('etoile', 'Harmonisation aethyrique', "Maxi : Bonus d'Initiative · Tests : Focalisation", '100 PX')}
    ${talent('livre', 'Lire/Écrire', 'Acquis · Maxi : 1', 'Maxi atteint', true)}
    ${talent('feu', 'Magie mineure', 'Acquis · Maxi : 1', 'Maxi atteint', true)}
    ${talent('oeil', 'Seconde vue', "Acquis une fois · Maxi : Bonus d'Initiative", '200 PX')}`, { ruban: 'Talents', classe: 'pan' }),
  groupeDIlyanwe(),
  sortie('sortie', 'Fermer'),
  coins(),
]);
