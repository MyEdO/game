/* Progression : le changement de carrière (LDB 07 l.118-148 ; validateCareerChange, src/engine/advancement.ts:185). */
const station = (x, { nom, sous, etat }) => `<div class="station ${etat}" style="left:${x}px">${etat === 'faite' ? `<div class="pt">${coche(34)}</div>` : etat === 'vise' ? `<div class="pt medaillon laiton" style="padding:3px"><div>${picto('etoile', 17)}</div></div>` : '<i class="pt clou-fer"></i>'}<div class="et"><b>${nom}</b><i>${sous}</i></div></div>`;
const CLASSES = [['ville', 'Citadins', 200], ['couronne', 'Courtisans', 200], ['epee', 'Guerriers', 200], ['route', 'Itinérants', 200], ['livre', 'Lettrés', 100, true], ['ancre', 'Riverains', 200], ['masque', 'Roublards', 200], ['epi', 'Ruraux', 200]];
const classe = ([icone, nom, cout, choisie]) => `<div class="ligne ${choisie ? 'choisie' : ''}" style="height:39px">${picto(icone, 17, '#2a1d12', 1.5)}<span class="n" data-texte="${nom}">${nom}</span><span class="cout">${cout} PX</span></div>`;
const carriere = (nom) => `<div class="ligne" style="height:39px"><i class="losange"></i><span class="n" data-texte="${nom}">${nom}</span></div>`;
const pills = (noms) => `<div class="pills">${noms.map((n) => `<span class="pill">${n}</span>`).join('')}</div>`;

poser([
  identite({ px: 180, niveau: 'Sorcière novice',
    exigences: [[true, 'Cinq Augmentations en CC, Int et FM', '3 / 3'], [true, 'Cinq dans huit Compétences', '8 / 8'], [true, 'Un Talent du niveau']],
    pied: `<div style="display:flex;align-items:center;gap:11px"><span class="jeton or" style="height:26px;font-size:13px;padding:0 13px">Niveau achevé</span><span class="rub"><span class="note">Changer coûte 100 PX.</span></span></div>` }),
  cadre('chemin', 443, 20, 1238, 132, 'parchemin', `
    <i class="rail" style="left:170px;width:880px"></i><i class="rail fait" style="left:170px;width:293px"></i>
    ${station(170, { nom: 'Sorcière novice', sous: 'Niveau 1 · Bronze 3 · achevé', etat: 'faite' })}
    ${station(463, { nom: 'Sorcière', sous: 'Niveau 2 · Argent 3', etat: 'vise' })}
    ${station(757, { nom: 'Maîtresse Sorcière', sous: 'Niveau 3 · Or 1', etat: 'loin' })}
    ${station(1050, { nom: 'Dame sorcière', sous: 'Niveau 4 · Or 2', etat: 'loin' })}`, { ruban: 'Sorcier · Lettrés', classe: 'chemin' }),
  cadre('suivant', 443, 170, 640, 438, 'parchemin', `<div class="page-c">
    <div class="nom" style="margin-top:8px" data-texte="titre de page">Sorcière</div>
    <div class="sous">Sorcier · niveau 2 · Statut Argent 3</div>
    ${sep()}
    <div class="ouvre">
      ${rub('Caractéristique')}<div class="pills"><span class="pill">Agilité</span></div>
      ${rub('Compétences')}${pills(['Calme', 'Charme', 'Intimidation', 'Langue (Au choix)', 'Langue (Bataille)', 'Ragot'])}
      ${rub('Talents')}${pills(['Magie des Arcanes (Au choix)', "Détection d'artefact", 'Mains agiles', 'Sixième sens'])}
      ${rub('Dotation')}${pills(['Licence magique'])}
    </div>
    <p class="prose" style="font-style:italic;margin-top:13px;text-align:center">Ce que Sorcière novice a ouvert le reste, hormis ses Talents.</p>
    <div style="margin-top:auto;width:330px;display:flex">${plaque('Devenir Sorcière', { armee: true, prix: '100 PX', style: 'height:44px' })}</div></div>`, { ruban: 'Niveau suivant', classe: 'pan' }),
  cadre('autre', 1100, 170, 581, 438, 'parchemin', `
    <div class="deux" style="margin-top:8px;column-gap:20px">
      <div>${rub('Classe')}<div class="lignes" style="margin-top:4px">${CLASSES.map(classe).join('')}</div></div>
      <div>${rub('Carrière', 'au premier niveau')}<div class="lignes" style="margin-top:4px">${['Apothicaire', 'Érudit', 'Ingénieur', 'Juriste', 'Médecin', 'Nonne', 'Prêtre'].map(carriere).join('')}</div></div>
    </div>
    <div class="rub" style="margin-top:15px"><span class="note">Hors de sa Classe, le changement coûte 100 PX de plus.</span></div>`, { ruban: 'Autre carrière', classe: 'pan' }),
  groupeDIlyanwe(),
  sortie('sortie', 'Fermer'),
  coins(),
]);
