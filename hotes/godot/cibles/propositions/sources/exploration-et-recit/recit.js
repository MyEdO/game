/* Exploration et récit, images d'intention (#3935, #4411) : les écrans de la scène isométrique. L'état vient de
   data-etat : exploration, exploration-gestes, exploration-dessus, exploration-premiere-personne, soins-entre-heros, dialogue, jet-de-competence, butin,
   designation-d-un-heros, document, document-relu, carnet. Le Test de compétence et la désignation se posent sur le
   socle du jet (`../combat/jet.js`). Maquette hors du jeu. */
const ETAT = document.getElementById('ecran').dataset.etat;
Object.assign(BUSTES, {
  gustav: '<path d="M6 90c0-21 11-28 25-30l-1-6c-8-5-10-18-6-27 4-9 26-9 30 0 4 9 2 22-6 27l-1 6c14 2 25 9 25 30z"/><path d="M24 30c1-4 3-7 6-9-3 4-4 7-4 11zM54 30c-1-4-3-7-6-9 3 4 4 7 4 11z" fill="#15100c"/><path d="M30 48c6 4 12 4 18 0-2 6-16 6-18 0z" fill="#15100c"/>',
  voyageur: BASE + '<path d="M22 36c-2-15 6-24 17-24s19 9 17 24c-5-9-10-12-17-12s-12 3-17 12z" fill="#15100c"/><path d="M31 40l5 3M47 40l-5 3" stroke="#15100c" stroke-width="2.500"/>',
});
/* `role` : ce que la colonne dit du héros éclairé ; au dialogue, un clic sur un autre portrait change le testeur */
const chronique = (lignes, classe = '', style = '') => `<div id="chronique" class="${classe}" style="${style}" data-piece="journal"><div class="tete rubrique ombre">Journal</div>${lignes.map(([g, t]) => `<p class="${g} ombre">${t}</p>`).join('')}</div>`;
const marque = (x, y, icone) => `<div class="marque" style="left:${x}px;top:${y}px">${medaillon(icone, { taille: 'petit' })}</div>`;
const LIEU = cartouche({ icone: 'lit', nom: 'La Diligence', sous: 'Auberge-relais · salle commune', taille: 'titre', largeur: 392 });
const JOUR = ['borne-j', 'Le soir, à La Diligence'];
const pieces = [];

/* ce que le curseur survole, ou que vise le point de mire : son nom, ce qu'on en sait, son geste et `par` quoi il se
   joue ; `sens` : le côté de sa pointe */
const survol = (sens, x, y, nom, texte, icone, geste, par = 'clic') => apercu({ nom, vers: sens, style: `left:${x}px;top:${y}px;--pointe:52px`, corps: `
    <p>${texte}</p>
    <div class="geste">${rond(icone, 'menu', { arme: true })}${geste}<em>${par}</em></div>` });
/* une chose de la scène que l'on vise : sa pastille et son geste */
const visee = (piece, cx, y, o) => poste(cx, y, { ...o, vise: true }).replace('class="poste', `data-piece="${piece}" class="poste`);
/* les gestes du groupe, au coin gauche : ceux que la situation ouvre s'empilent au-dessus du retour à la vue du lieu ;
   la carte du monde s'ouvre au bord droit */
const gestesDuGroupe = (ouverts = []) => [`<div id="gestes-groupe" data-piece="gestes-groupe">${ouverts.map(([icone, nom]) => `<div>${rond(icone, 'grand')}<span class="rubrique ombre">${nom}</span></div>`).join('')}</div>`,
  retour('Le lieu', 'ville'), ouvrir('Carte du monde', 'carte', 20)];
const MENE = { mira: { choisi: true, html: '<span class="attend rubrique">Mène le groupe</span>' } };
/* ce qui entoure la salle quand la situation ouvre des gestes, sous ses trois vues ; `derniere` : la ligne neuve */
const chromeDesGestes = (derniere) => [bandeau(MENE), ...gestesDuGroupe([['soin', 'Soigner'], ['sommeil', 'Se reposer'], ['oeil', 'Fouiller la pièce']]),
  ouvrir('Carnet d’enquête', 'livre', 78), chronique([JOUR, ['vieux', 'Le groupe entre dans la salle commune.'], ['', derniere]]), coins()];
/* la touche d'un geste du clavier */
const touche = (t) => `<kbd class="touche chiffres">${t}</kbd>`;
/* #3935 : le regard tenu parmi les trois ; un clic sur un autre y passe, la touche passe au suivant. `regarder`
   (`hotes/godot/pont/pont.ts:1432`), `REGARDS`, `regardSuivant` (`src/noyau/monde/aretes.ts:125`, `:269`),
   `changer_de_regard` (`hotes/godot/projet/project.godot:52`) */
const regard = (tenu) => `<div id="regard" class="cadre bois" data-piece="regard"><div class="fond bois"><span class="rubrique">Regard</span>${segments(['Isométrique', 'Dessus', 'Première personne'], tenu)}${touche('V')}</div></div>`;

if (ETAT === 'exploration') {
  sceneAuberge({ survol: 'gustav', trajet: true, avis: true });
  pieces.push(LIEU);
  pieces.push(marque(263, 296, 'porte'), marque(984, 436, 'bulle'), marque(148, 428, 'cle'));
  pieces.push(survol('gauche', 1102, 214, 'Gustav Fondleburger', 'Le propriétaire, derrière son comptoir.', 'bulle', 'Parler'));
  pieces.push(visee('avis', 1505, 268, { nom: 'Avis placardé', sous: 'Lire', icone: 'livre' }));
  pieces.push(bandeau(MENE), ...gestesDuGroupe());
  pieces.push(chronique([JOUR, ['vieux', 'Le groupe entre dans la salle commune.'], ['', 'Un avis est placardé près du comptoir.']]), coins());
}

/* LDB 12 l.200 ; LDB 15 l.55 ; LDB 18 l.296-298 ; `fouillerLaPiece`, `ramasserLObjet`, `franchirLArete`, `ouvrirLeRepos`,
   `ouvrirLeMedecin` (`src/noyau/actionsDuNoyau.ts`) ; `fouille.geste`, `usable.ramasser`, `arete.enjamberFenetre`,
   `ecran.offre.soins` (`src/i18n/messages/fr.ts`) */
if (ETAT === 'exploration-gestes') {
  sceneAuberge({ auSol: [10, 10], croisee: true, colonne: true });
  pieces.push(LIEU);
  pieces.push(marque(263, 296, 'porte'), marque(984, 436, 'bulle'), marque(148, 428, 'cle'), marque(608, 488, 'main'));
  pieces.push(survol('droite', 274, 464, 'Dague', 'Posée au sol. Mira, qui mène le groupe, la prendra.', 'main', 'Ramasser'));
  pieces.push(visee('croisée', 1321, 172, { nom: 'Croisée', sous: 'Enjamber la fenêtre', icone: 'porte' }));
  pieces.push(...chromeDesGestes('Le groupe fouille la pièce.'));
}
/* les mêmes gestes, la salle vue du dessus : seule la caméra change */
if (ETAT === 'exploration-dessus') {
  const DAGUE = [10, 10], { lieu } = sceneAubergeDessus({ auSol: DAGUE, croisee: true });
  const sur = (c, icone) => { const [x, y] = lieu(...c); return marque(x, y - 34, icone); };
  const [dx, dy] = lieu(...DAGUE), [cx, cy] = lieu(SALLE.fenetresDeDroite[1], SALLE.mur[1]);
  pieces.push(LIEU, regard('Dessus'));
  pieces.push(sur([SALLE.mur[0], SALLE.porte], 'porte'), sur(SALLE.gens.cocher, 'bulle'), sur(SALLE.coffre, 'cle'), sur(DAGUE, 'main'));
  pieces.push(survol('droite', dx - 334, dy - 56, 'Dague', 'Posée au sol. Mira, qui mène le groupe, la prendra.', 'main', 'Ramasser'));
  pieces.push(visee('croisée', cx, cy - 104, { nom: 'Croisée', sous: 'Enjamber la fenêtre', icone: 'porte' }));
  pieces.push(...chromeDesGestes('Le groupe fouille la pièce.'));
}
/* #3935 (2026-11-17) : la marche libre de l'immersion (`hotes/godot/projet/scripts/immersion.gd`) : le regard à la
   souris captive, la marche au clavier, le point de mire au centre ; `agir` (E ou clic) joue la case qu'il vise
   (`case_jouee`, clic du champ) */
if (ETAT === 'exploration-premiere-personne') {
  const MIRE = [W / 2, H / 2], { lieu } = sceneAubergeAuxYeux({ oeil: SALLE.groupes.entree.mira });
  const sur = ([x, y], icone) => marque(x, y - 26, icone);
  pieces.push(LIEU, regard('Première personne'));
  pieces.push(sur(lieu(SALLE.mur[0] + .5, SALLE.porte, 1.16), 'porte'), sur(lieu(SALLE.gens.cliente[0] - .15, SALLE.gens.cliente[1], 1), 'bulle'));
  pieces.push(survol('droite', MIRE[0] - 360, MIRE[1] - 56, 'Dague', 'Posée au sol. Mira, qui mène le groupe, la prendra.', 'main', 'Ramasser', `${touche('E')} ou clic`));
  pieces.push(`<i id="mire" data-piece="mire"></i>`);
  pieces.push(...chromeDesGestes('Le groupe fouille la pièce.'));
}

/* LDB 09 l.260 ; `ouvrirLeMedecin`, `fenetreChoisir('infirmerie', 'patient')`, `jetRegler('soins', 'mode')`,
   `jetLancer('soins')` (`src/noyau/medicFlow.ts`) */
if (ETAT === 'soins-entre-heros') {
  sceneAuberge({ sombre: .18 });
  pieces.push(LIEU);
  pieces.push(pageDesSoins({ ruban: 'Les soins', patient: 'Greta Hartmann', blessures: 8, max: 14,
    actes: `${acteDeSoin('soin', 'Panser les Blessures', 'Guérison', 'Lui rend le Bonus d’Intelligence du soigneur, plus ses degrés de réussite.', { pris: true })}
    ${acteDeSoin('goutte', 'Arrêter l’Hémorragie', 'Guérison', 'Greta ne saigne pas.', { ferme: true })}`,
    pied: `${plaque('Soigner', { armee: true, icone: 'soin', classe: 'payer' })}
    <div class="note"><i>Le soigneur se choisit dans le bandeau du jet, avant le dé.</i></div>` }));
  pieces.push(bandeau({ greta: { choisi: true, html: '<span class="attend rubrique">Patiente</span>' }, aldric: { icone: 'soin', texte: 'possède Guérison' } }));
  pieces.push(retour('Explorer', 'route'), coins());
}

if (ETAT === 'dialogue' || ETAT === 'jet-de-competence') {
  sceneAuberge({ groupe: 'comptoir', parle: true });
  pieces.push(LIEU, coins());
}
if (ETAT === 'dialogue') {
  const reponse = (n, texte, { annonce, cout, visee } = {}) => plaque(`${annonce ? `<span class="annonce">${picto('de', 14, undefined, 1.7)}${annonce}</span>` : ''}<span data-texte="réponse ${n}">${texte}</span>`, { numero: n, survol: visee, prix: cout, classe: 'gauche' });
  pieces.push(`<div id="parole" class="cadre bois arret" data-piece="parole"><div class="fond parchemin">
    <div class="porteur">${portrait('mira', { taille: 'grand', choisi: true })}</div>
    <div class="reponses">
      <div class="qui"><div class="n gothique" data-texte="héros">Mira</div><div class="c rubrique">Portera le Test</div></div>
      ${reponse(1, 'Et cet avis placardé au mur, ce prince qui recrute ?')}
      ${reponse(2, 'À quel prix cèdent-ils leurs places, entre nous ?', { annonce: 'Test de Charme · Intermédiaire', visee: true })}
      ${reponse(3, 'Servez-nous quatre chopes, et parlons.', { cout: '4 sc' })}
      ${reponse(4, 'Nous verrons cela avec eux. Bonsoir.')}
    </div>
    <div class="dit"><div class="n gothique" data-texte="orateur">Gustav Fondleburger</div><div class="c rubrique">Propriétaire de La Diligence</div>
      <p data-texte="réplique">« La diligence d’Altdorf ? Elle repart demain à l’aube, si ses cochers tiennent debout d’ici là. Voyez ça avec eux, moi je ne vends que la bière et les lits. »</p></div>
    <div class="orateur">${portrait('gustav', { camp: 'pnj', taille: 'grand' })}</div>
  </div>${ferrures}</div>`);
  pieces.push(chronique([JOUR, ['vieux', 'Le groupe entre dans la salle commune.'], ['', 'Mira s’adresse à Gustav Fondleburger.']], 'haut'));
}
if (ETAT === 'jet-de-competence') {
  const mira = HEROS.find((h) => h.id === 'mira');
  pieces.push(bandeauDuJet('Test de Charme', '', `
    ${camp({ portrait: portrait('mira', { taille: 'grand' }), nom: 'Mira', carac: 'Charme', seuil: 43, des: ['20', '7'], total: 27, dr: '+2', reussite: true })}
    ${verdict('Test de Charme · Intermédiaire (+0)', 'Réussite', 'Gustav se laisse amadouer et baisse la voix.')}
    <div class="camp droite enjeu">${portrait('gustav', { camp: 'pnj', taille: 'grand' })}<div><div class="n gothique">Gustav Fondleburger</div><div class="c rubrique">Interlocuteur</div>
      <p>« À quel prix cèdent-ils leurs places, entre nous ? »</p></div></div>`, apresLeDe({ heros: mira })));
  pieces.push(chronique([['vieux', 'Le groupe entre dans la salle commune.'], ['vieux', 'Mira s’adresse à Gustav Fondleburger.'], ['', 'Mira tente de charmer Gustav Fondleburger.']], 'haut', 'bottom:234px'));
}

if (ETAT === 'butin') {
  sceneRoute();
  /* LDB 61 l.33 ; `src/noyau/combatEffects.ts:348`, `src/noyau/issueDeCombat.ts:90` */
  const ENC = { bjorn: [5, 8], mira: [4, 6], aldric: [6, 6], greta: [7, 8] };
  const col = (h) => { const [a, m] = ENC[h.id]; const plein = a >= m;
    return `<div class="col">${portrait(h.id, { taille: 'petit' })}<div class="q"><b>${h.nom.split(' ')[0]}</b><span class="chiffres ${plein ? 'plein' : ''}">Enc ${a} / ${m}</span><div class="enc ${plein ? 'plein' : ''}"><i style="width:${100 * a / m}%"></i></div></div></div>`; };
  const libre = '<div class="prise"></div>';
  const ligne = (icone, nom, enc) => `<div class="objet"><div class="ic">${picto(icone, 17, '#3a2a18', 1.6)}</div><b>${nom}</b><span class="chiffres">Enc ${enc}</span></div>${libre.repeat(HEROS.length + 1)}`;
  pieces.push(cartouche({ icone: 'route', nom: 'La route d’Altdorf', sous: 'Dans la forêt · la nuit', taille: 'titre', largeur: 392 }));
  pieces.push(`<div id="butin" class="cadre bois arret" data-piece="butin"><div class="fond parchemin">
    <div class="trouve"><div class="n gothique" data-texte="butin titre">Le corps du voyageur</div><div class="c rubrique">Fouillé par Mira</div>
      <p data-texte="butin récit">Un carreau d’arbalète dans le dos. Ses poches n’ont pas été vidées.</p>
      <div class="bourse">${sceau('pieces')}<span><b class="chiffres">2 CO 10/–</b> répartis entre les bourses</span></div></div>
    <div class="partage"><div class="tete-o rubrique">Une case donne l’objet à ce héros</div>${HEROS.map(col).join('')}<div class="col laisser">${picto('croix', 15, '#5a2a12', 1.8)}<b>Laisser</b></div>
      ${ligne('epee', 'Épée', 1)}
      ${ligne('habit', 'Vêtements de bonne facture', 1)}
    </div>
    <div id="suites">${plaque('Emporter le reste', { armee: true, icone: 'sac', classe: 'large' })}${plaque('Évaluer', { icone: 'oeil' })}</div>
    <div class="reste">Ce qui reste à la fermeture va à ${HEROS[0].nom}.</div>
  </div>${ruban('Butin', { gothique: true })}${ferrures}</div>`);
  pieces.push(chronique([['borne-j', 'La nuit, sur la route d’Altdorf'], ['vieux', 'Mira fouille le corps du voyageur.'], ['', 'Aldric prend la lettre cachetée.']], 'haut', 'bottom:286px'), coins());
}

/* EDO 02 l.91 ; `fenetreChoisir('designationHeros', 'heros', id)` (`src/noyau/campagne.ts:57-73`) ; `fenetre.designationHeros`,
   `verbe.designationHeros.heros` (`src/i18n/messages/fr.ts:451`, `:302`) ; l'invite est celle de la donnée (`designerHeros`,
   `src/scenes/diligence/diligence-projet.json`) */
if (ETAT === 'designation-d-un-heros') {
  sceneRoute();
  pieces.push(cartouche({ icone: 'route', nom: 'La route d’Altdorf', sous: 'Dans la forêt · la nuit', taille: 'titre', largeur: 392 }));
  pieces.push(apercu({ nom: 'Le corps du voyageur', vers: 'droite', style: 'left:472px;top:318px;--pointe:70px', corps: `
    <p data-texte="invite">En retournant le cadavre, vous découvrez avec stupeur qu’il est le sosie de l’un d’entre vous. Lequel ?</p>` }));
  pieces.push(bandeauDuJet('Désigner un héros', 'debut', HEROS.map((h) => carte(h.nom, h.car, { portrait: portrait(h.id), armee: h.id === 'aldric' })).join(''), plaque('Désigner', { armee: true })));
  pieces.push(chronique([['borne-j', 'La nuit, sur la route d’Altdorf'], ['', 'Mira retourne le corps du voyageur.']], 'haut', 'bottom:234px'), coins());
}

const RELU = ETAT === 'document-relu';
if (ETAT === 'document' || RELU) {
  sceneAuberge({ groupe: 'avis', avis: true, sombre: .3 });
  pieces.push(`<div id="feuille" data-piece="feuille"><div class="parchemin">
    <h2>On recherche !<span>Aventuriers courageux !</span></h2>${filet({ losange: true })}
    <p data-texte="document 1">Son Excellence le Prince Héritier Hergard von Tasseninck de la Grande Principauté d’Ostland, fait savoir par la présente qu’il réside actuellement à Altdorf et souhaite s’attacher les services d’un groupe d’aventuriers chevronnés. L’engagement prendra effet dès que possible, pour une période indéterminée.</p>
    <p>Que les postulants soient avisés qu’il leur sera demandé d’entreprendre une mission des plus périlleuses dans les régions inexplorées des Montagnes Grises. L’objet de la mission est très délicat et la plus haute discrétion est impérative en ce qui concerne sa nature précise.</p>
    <p>La rémunération est négociable et dépendra de l’expérience des candidats, mais un minimum de 8 Couronnes par personne et par jour est assuré. De plus, une prime généreuse sera accordée une fois la mission accomplie. Couards, traînards et nains s’abstenir.</p>
    <p class="signe">Signé<br>Scribe personnel du Prince Héritier Hergard</p>
    <div class="cachet">${sceau('bouclier', 'maitre')}</div></div><i class="clou"></i></div>`);
  pieces.push(`<div id="remis" class="cadre bois" data-piece="remis"><div class="fond bois">${portrait('mira', { taille: 'grand', choisi: true })}
    <div class="t"><div class="c rubrique">Avis placardé à La Diligence</div><div class="n gothique" data-texte="titre du document">On recherche ! Aventuriers courageux !</div>
      <div class="note">${RELU ? `${rond('livre', 'menu', { arme: true })}Relu depuis le carnet : « Replier » y ramène.` : `${rond('journal', 'menu', { arme: true })}Consigné au carnet : il se relit quand on veut.`}</div></div>
    ${plaque('Replier', { armee: true })}</div>${clouer()}${ferrures}</div>`);
  pieces.push(coins());
}

/* `epinglerLIndice`, `marquerLesIndices` (`src/noyau/campagne.ts:13-29`) ; `carnet.nouveau` (`src/i18n/messages/fr.ts:1811`) ;
   l'affaire, l'indice, ses stades et leurs documents sont ceux du paquet (`src/scenes/diligence/diligence-projet.json`,
   EDO 02 : Documents 3 et 4) */
if (ETAT === 'carnet') {
  sceneAuberge({ sombre: .62 });
  const lu = (titre, source, texte, classe = '') => `<div class="lu ${classe}"><div class="tete"><b class="gothique">${titre}</b><span class="rubrique">${source}</span></div>${texte.map((p) => `<p>${p}</p>`).join('')}</div>`;
  pieces.push(cartouche({ icone: 'livre', nom: 'Carnet d’enquête', sous: 'Affaires et indices', taille: 'titre', largeur: 312 }));
  pieces.push(rail('Affaires', [['cle', 'Épinglés<span class="prix">1</span>'], ['oeil', 'Un héritage à Bögenhafen<span class="prix">1</span>', 1]], 'Un indice caché ne s’y lit pas'));
  pieces.push(`<div id="documents" class="cadre bois" data-piece="documents"><div class="fond bois">
    ${['On recherche ! Aventuriers courageux !', 'L’héritage', 'L’affidavit'].map((d) => plaque(`<span>${d}</span>`, { icone: 'lettre', classe: 'gauche' })).join('')}
    <div class="pied rubrique">Un document remis se relit ici</div>
  </div>${ruban('Documents remis')}${ferrures}</div>`);
  pieces.push(`<div id="carnet" class="page cadre bois" data-piece="carnet"><div class="fond parchemin">
    <div class="tete"><h3 data-texte="affaire">Un héritage à Bögenhafen</h3><span class="sous rubrique">1 indice</span></div>
    ${filet()}
    <div class="indice"><b class="gothique">L’héritage</b><span class="chip">Indice</span><span class="chip neuf">Nouveau</span>${plaque('Épingler', { icone: 'cle', classe: 'epingle', taille: 'petite' })}</div>
    <div class="deux">
      <div><div class="r rubrique">Dernière lecture</div>
        ${lu('L’affidavit', 'EDO p. 28', ['Nous, soussignés, jurons solennellement que le porteur de ce document se nomme Kastor Aloysius Lieberung.', 'Ingrid Zicherman, prêtresse', 'Temple de Sigmar, Nuln', 'Oskar Helmut, maître de guilde', 'Guilde des marchands, Nuln', 'Sous le regard de', 'Julius Schwungrad, Honorable Société des Avocats, Nuln'])}</div>
      <div><div class="r rubrique">Lectures précédentes</div>
        ${lu('L’héritage', 'EDO p. 27', ['Messires Lock, Stock & Barl', 'Notaires, Commissaires aux serments, etc.', 'Garten Weg', 'Bögenhafen', 'Cher Herr Lieberung,',
          'Après de longues recherches, nous sommes portés à croire que vous êtes le dernier parent vivant de feu le baronet Lieberung, d’Ubersreik. Si cela s’avère exact, et si aucun autre élément inconnu de nous à ce jour ne venait à se présenter, je suis chargé de vous informer que vous êtes l’unique bénéficiaire des dernières volontés et du testament de feu le Baronet (ci-après dénommé la première partie), ainsi que du titre et de toutes les terres et propriétés s’y rattachant.',
          'Je, soussigné, agissant en ma qualité d’exécuteur légal du document de la première partie mentionné ci-dessus, vous prie de vous rendre avec toute la célérité voulue à mes bureaux situés à l’adresse indiquée dans la présente lettre. Dès lors, et sous réserve que vous puissiez produire une déclaration sous serment signée et attestée par deux témoins confirmant votre identité de Kastor Aloysius Lieberung, nous aurons le plaisir de vous remettre le titre de propriété du manoir de Lieberung et de toutes les terres et propriétés s’y rattachant, ainsi que la somme de vingt mille couronnes d’or impériales.',
          'Votre humble et dévoué serviteur,', 'Dietrich Barl. K.C., LL.B. (Alt)', 'Signé en ce dixième jour de Nachhexen, dans la deux mille cinq cent douzième année de l’Empire.'], 'italique attenue')}</div>
    </div>
  </div>${ferrures}</div>`);
  pieces.push(croix());
}
monter(pieces);
