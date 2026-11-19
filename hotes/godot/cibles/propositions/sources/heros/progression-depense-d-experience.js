/* Progression : la dépense d'expérience (LDB 07 l.41-105, l.118, l.137, l.144 ; src/noyau/monde/advancement.ts, src/engine/advancement.ts).
   États : le niveau 1 ; `creneaux`, un emplacement « (Au choix) » du niveau 2 ouvert (LDB 09 l.38, advancement.ts:187-240) ;
   `sorts`, les Sorts et leurs composants (LDB 10 l.680-696, l.714-722 ; LDB 46 l.113 ; src/engine/grimoire.ts:176-193). */
const ETAT = document.getElementById('ecran').dataset.etat ?? '';
const NIVEAU_2 = ETAT !== '';
const PROFIL = NIVEAU_2
  ? [[5], [33, 5, 25, true], [30, 0, 50], [26, 0, 50], [45, 0, 50], [62, 0, 50], [58, 0, 25, true], [52, 0, 50], [80, 6, 30, true], [70, 6, 30, true], [29, 0, 50], [17]]
  : [[5], [33, 2, 25, true], [30, 0, 50], [26, 0, 50], [45, 0, 50], [62, 0, 50], [58, 0, 50], [52, 0, 50], [80, 5, 25, true], [70, 6, 30, true], [29, 0, 50], [17]];
const COMPETENCES = NIVEAU_2
  ? [['F', 'Intimidation', '', 0, 26, 10], ['I', 'Intuition', '', 5, 67, 10], 'creneau', ['Int', 'Langue', 'Bataille', 0, 80, 10], ['Int', 'Langue', 'Magick', 10, 90, 15], ...(ETAT === 'sorts' ? [['I', 'Perception', '', 5, 67, 10], ['Soc', 'Ragot', '', 0, 29, 10]] : [])]
  : [['CC', 'Corps à corps', "Armes d'hast", 5, 38, 10], ['CC', 'Corps à corps', 'Base', 3, 36, 10], ['Ag', 'Esquive', '', 5, 63, 10], ['FM', 'Focalisation', '', 8, 78, 15],
    ['I', 'Intuition', '', 5, 67, 10], ['Int', 'Langue', 'Magick', 10, 90, 15], ['I', 'Perception', '', 2, 64, 10, true], ['Int', 'Savoir', 'Magie', 6, 86, 15]];
const achat = ([c, n, spec, aug, test, cout, vise]) => `<div class="achat ${vise ? 'vise' : ''}"><span class="fait">${aug >= 5 ? picto('coche', 15, '#6d5119', 2.4) : ''}</span>${car(c)}<span class="n" data-texte="${n} ${spec}">${n}${spec ? ` <small>(${spec})</small>` : ''}</span>
  <span class="aug">+${aug}</span><span class="val" style="min-width:${vise ? 74 : 30}px">${vise ? `${test} <span style="font-weight:400">→</span> ${test + 1}` : test}</span>${plaque(`${cout} PX`, { armee: !!vise, taille: 'petite' })}</div>`;
/* l'emplacement « (Au choix) » : pressé, ses spécialisations en pastilles, celle retenue en laiton ; sa plaque de prix
   l'achète, « Désigner » la retient sans rien acheter */
const LANGUES = ['Albionais', 'Bretonnien', 'Classique', 'Elthárin', 'Estalien', 'Ghassalli', 'Gospodarin', 'Grumbarth', 'Guilde', 'Halfling', 'Khazalid', 'Norse', 'Queekique', 'Reikspiel', 'Tiléen', 'Voleur', 'Wastelander'];
const creneau = (ouvert) => `<div class="achat creneau ${ouvert ? 'vise' : ''}"><span class="fait"></span>${car('Int')}<span class="n" data-texte="Langue (Au choix)">Langue <small>(Au choix)</small></span>
  ${ouvert ? `<span class="aug">+0</span><span class="val" style="min-width:74px">80 <span style="font-weight:400">→</span> 81</span>${plaque('10 PX', { armee: true, taille: 'petite' })}` : `<span class="rub" style="color:#6b1c10">À désigner</span>${picto('chevron_d', 15, '#5a4530', 2)}`}</div>
  ${ouvert ? `<div class="depli"><div class="pills">${LANGUES.map((l) => `<span class="pill ${l === 'Bretonnien' ? 'prise' : ''}">${l}</span>`).join('')}</div>${plaque('Désigner', { prix: 'sans achat', taille: 'petite' })}</div>` : ''}`;
const talent = (icone, nom, sous, cout, clos = false) => `<div class="talent ${clos ? 'clos' : ''}">${medaillon(icone, { taille: 'moyen', ferme: clos })}<div class="t"><b data-texte="${nom}">${nom}</b><i>${sous}</i></div>${plaque(cout, { fermee: clos, taille: 'petite' })}</div>`;
/* un Sort : connu, il offre son composant, payé de la bourse du héros (LDB 46 l.113) ; sinon son prix en PX */
const sort = (nom, ni, prix) => `<div class="achat sort"><span class="n" data-texte="${nom}">${nom}</span><span class="cout">NI ${ni}</span>${prix.endsWith('PX') ? plaque(prix, { taille: 'petite' }) : `<span class="rub">Connu</span>${plaque('Composant', { prix, taille: 'petite' })}`}</div>`;

const TALENTS = {
  '': `<div style="margin:6px 0 -2px">${rub('De Sorcière novice', 'cent PX, et cent de plus par fois déjà pris')}</div>
    ${talent('etoile', 'Harmonisation aethyrique', "Maxi : Bonus d'Initiative · Tests : Focalisation", '100 PX')}
    ${talent('livre', 'Lire/Écrire', 'Acquis · Maxi : 1', 'Maxi atteint', true)}
    ${talent('feu', 'Magie mineure', 'Acquis · Maxi : 1', 'Maxi atteint', true)}
    ${talent('oeil', 'Seconde vue', "Acquis une fois · Maxi : Bonus d'Initiative", '200 PX')}`,
  creneaux: `<div style="margin:6px 0 -2px">${rub('De Sorcière', 'cent PX, et cent de plus par fois déjà pris')}</div>
    ${talent('etoile', 'Magie des Arcanes (Au choix)', 'À désigner : un Domaine · Maxi : 1', '100 PX')}
    ${talent('oeil', "Détection d'artefact", "Maxi : Bonus d'Initiative · Tests : Intuition", '100 PX')}
    ${talent('poing', 'Mains agiles', 'Maxi : Bonus de Dextérité · Tests : Escamotage', '100 PX')}
    ${talent('oeil', 'Sixième sens', "Maxi : Bonus d'Initiative · Tests : Intuition", '100 PX')}`,
  sorts: `<div style="margin:6px 0 2px">${rub('Magie des Arcanes (Feu)', 'cent PX par Sort, deux cents au-delà de huit connus')}</div>
    ${sort('Carreau', 4, '4/–')}${sort('Cautériser', 4, '4/–')}${sort('Dôme', 7, '7/–')}${sort('Mur de feu', 6, '6/–')}
    ${sort('Arme aethyrique', 2, '100 PX')}${sort('Cœurs ardents', 8, '100 PX')}
    <div style="margin:9px 0 2px">${rub('Magie mineure', 'sept Sorts connus ; cinquante PX le suivant')}</div>
    ${sort('Alerte', 0, '50 PX')}${sort('Bruits', 0, '50 PX')}
    <div class="pied-de-bourse">${bourse({ heros: 'Ilyanwe', avoir: '1 CO 4/–' })}</div>`,
};

poser([
  NIVEAU_2
    ? identite({ px: 240, apres: ETAT === 'creneaux' ? '230 après cet achat' : '', niveau: 'Sorcière', rang: 2,
      exigences: [[false, 'Dix Augmentations en CC, Ag, Int et FM', '0 / 4'], [false, 'Dix dans huit Compétences', '1 / 8'], [ETAT === 'sorts', 'Un Talent du niveau']],
      pied: `${plaque('Niveau suivant', { fermee: true, classe: 'gauche' })}<div style="height:9px"></div>${plaque('Autre carrière', { prix: '200 PX', classe: 'gauche' })}<div class="rub" style="margin-top:7px"><span class="note">Niveau achevé : 100 PX. Hors de sa Classe : 100 PX de plus.</span></div>` })
    : identite({ px: 285, apres: '275 après cet achat', niveau: 'Sorcière novice', rang: 1,
      exigences: [[false, 'Cinq Augmentations en CC, Int et FM', '2 / 3'], [false, 'Cinq dans huit Compétences', '6 / 8'], [true, 'Un Talent du niveau']],
      pied: `${plaque('Niveau suivant', { fermee: true, classe: 'gauche' })}<div style="height:9px"></div>${plaque('Autre carrière', { prix: '200 PX', classe: 'gauche' })}<div class="rub" style="margin-top:7px"><span class="note">Niveau achevé : 100 PX. Hors de sa Classe : 100 PX de plus.</span></div>` }),
  cadre('bande', 443, 20, 1172, 132, 'parchemin', PROFIL.map(caseDeCarac).join(''), { ruban: 'Caractéristiques', classe: 'bande' }),
  cadre('competences', 443, 170, 640, 438, 'parchemin', `
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin:6px 4px 2px 2px">${rub('De la carrière', 'une Augmentation à la fois')}<span class="rub">Test &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Coût &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></div>
    ${COMPETENCES.map((c) => (c === 'creneau' ? creneau(ETAT === 'creneaux') : achat(c))).join('')}
    <div class="achat" style="border-bottom:0;color:#5a4530">${`<span class="fait">${picto('cadenas', 15, '#5a4530', 1.6)}</span>`}<span class="n" style="color:#5a4530">Hors carrière <small>(six Compétences)</small></span><span class="rub" style="color:#6b1c10">Coût doublé</span>${picto('chevron_d', 15, '#5a4530', 2)}</div>
    ${NIVEAU_2 ? '<i class="defile"><u></u></i>' : ''}`, { ruban: 'Compétences', classe: 'pan' }),
  cadre('talents', 1100, 170, 581, 438, 'parchemin', TALENTS[ETAT], { tete: onglets(['Talents', 'Sorts'], ETAT === 'sorts' ? 'Sorts' : 'Talents'), classe: 'pan' }),
  groupeDIlyanwe(),
  croix(),
  coins(),
]);
