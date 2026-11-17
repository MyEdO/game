/* Exploration et récit, images d'intention (#3935) : cinq écrans sur la scène isométrique. L'état vient de
   data-etat : exploration, dialogue, jet-de-competence, butin, document. Le Test de compétence se pose sur le socle
   du jet (`../combat/jet.js`). Maquette hors du jeu. */
const ETAT = document.getElementById('ecran').dataset.etat;
Object.assign(BUSTES, {
  gustav: '<path d="M6 90c0-21 11-28 25-30l-1-6c-8-5-10-18-6-27 4-9 26-9 30 0 4 9 2 22-6 27l-1 6c14 2 25 9 25 30z"/><path d="M24 30c1-4 3-7 6-9-3 4-4 7-4 11zM54 30c-1-4-3-7-6-9 3 4 4 7 4 11z" fill="#15100c"/><path d="M30 48c6 4 12 4 18 0-2 6-16 6-18 0z" fill="#15100c"/>',
  voyageur: BASE + '<path d="M22 36c-2-15 6-24 17-24s19 9 17 24c-5-9-10-12-17-12s-12 3-17 12z" fill="#15100c"/><path d="M31 40l5 3M47 40l-5 3" stroke="#15100c" stroke-width="2.500"/>',
});
BUSTES_PNJ.add('gustav'); BUSTES_PNJ.add('voyageur');
Object.assign(PICTOS, {
  main: '<path d="M8 13V6.500a1.500 1.500 0 0 1 3 0V11M11 11V5a1.500 1.500 0 0 1 3 0v6M14 11V6.500a1.500 1.500 0 0 1 3 0V14c0 4-2.500 6.500-6 6.500S6 18 5 15.500l-1.200-3c-.5-1.500 1.500-2.300 2.500-1l1.700 2"/>',
  sac: '<path d="M8 8h8l3 11a1.500 1.500 0 0 1-1.500 2h-11A1.500 1.500 0 0 1 5 19zM9 8V6a3 3 0 0 1 6 0v2"/>',
  habit: '<path d="M9 4l3 2 3-2 5 3-2 4-2-1v10H8V10l-2 1-2-4z"/>',
  lettre: '<path d="M4 6h16v12H4zM4 7l8 6 8-6"/>',
  de: '<path d="M12 3l8 6-3 11H7L4 9zM12 3l4 9-4 4-4-4zM4 9l4 3M20 9l-4 3M12 16v4"/>',
});
/* `role` : ce que la colonne dit du héros éclairé ; au dialogue, un clic sur un autre portrait change le testeur */
const groupe = (role = '') => `<div id="groupe" data-piece="groupe">${HEROS.map((h) => `
  <div class="rang ${h.id === 'mira' ? 'mene' : ''}">${portrait(h.id)}<div><div class="nom ${h.id === 'mira' ? '' : 'rubrique'} ombre">${h.nom}</div>${h.id === 'mira' && role ? `<div class="role rubrique ombre">${role}</div>` : ''}
    <div class="ligne"><div class="vie"><i style="width:${100 * h.pv / h.max}%"></i></div><span class="pv ombre">${h.pv} / ${h.max}</span></div></div></div>`).join('')}</div>`;
const chronique = (lignes, classe = '', style = '') => `<div id="chronique" class="${classe}" style="${style}" data-piece="chronique"><div class="tete rubrique ombre">Chronique</div>${lignes.map(([g, t]) => `<p class="${g} ombre">${t}</p>`).join('')}</div>`;
const marque = (x, y, icone) => `<div class="marque" style="left:${x}px;top:${y}px">${medaillon(icone, { petit: true, taille: 17 })}</div>`;
const LIEU = titre({ icone: 'lit', nom: 'La Diligence', sous: 'Auberge-relais · salle commune', largeur: 392 });
const JOUR = ['borne-j', 'Le soir, à La Diligence'];
const pieces = [];

if (ETAT === 'exploration') {
  sceneAuberge({ survol: 'gustav', trajet: true, avis: true });
  pieces.push(LIEU);
  pieces.push(marque(263, 296, 'porte'), marque(984, 436, 'bulle'), marque(148, 428, 'cle'));
  pieces.push(`<div class="apercu parchemin vers-gauche" data-piece="apercu" style="left:1102px;top:214px;width:236px;--pointe:52px">
    <div class="tete"><span class="n gothique">Gustav Fondleburger</span></div>
    <p>Le propriétaire, derrière son comptoir.</p>
    <div class="geste">${pastille('bulle')}Parler<em>clic</em></div></div>`);
  pieces.push(poste(1505, 268, { nom: 'Avis placardé', sous: 'Lire', icone: 'livre', vise: true }).replace('class="poste', 'data-piece="avis" class="poste'));
  pieces.push(bandeau({ mira: { choisi: true, html: '<span class="attend rubrique">Mène le groupe</span>' } }));
  pieces.push(`<div id="gestes-groupe" data-piece="gestes-groupe"><div>${rond('ville', 24)}<span class="rubrique ombre">Le lieu</span></div><div>${rond('carte', 24)}<span class="rubrique ombre">Carte du monde</span></div></div>`);
  pieces.push(chronique([JOUR, ['vieux', 'Le groupe entre dans la salle commune.'], ['', 'Un avis est placardé près du comptoir.']]), coins());
}

if (ETAT === 'dialogue' || ETAT === 'jet-de-competence') {
  sceneAuberge({ groupe: 'comptoir', parle: true, colonne: true });
  pieces.push(LIEU, groupe(ETAT === 'dialogue' ? 'Portera le Test' : ''), `<div id="systeme" data-piece="systeme">${rond('systeme', 22, { couleur: '#c9b995' })}</div>`);
}
if (ETAT === 'dialogue') {
  const reponse = (n, texte, { annonce, cout, visee } = {}) => `<div class="reponse laiton ${visee ? 'visee' : ''}"><div><b>${n}</b>${annonce ? `<span class="annonce">${picto('de', 14, '#2a1a08', 1.7)}${annonce}</span>` : ''}<span data-texte="réponse ${n}">${texte}</span>${cout ? `<span class="cout lin">${cout}</span>` : ''}</div></div>`;
  pieces.push(`<div id="parole" class="cadre bois arret" data-piece="parole"><div class="fond parchemin">
    <div class="orateur">${portrait('gustav')}</div>
    <div class="dit"><div class="n gothique" data-texte="orateur">Gustav Fondleburger</div><div class="c rubrique">Propriétaire de La Diligence</div>
      <p data-texte="réplique">« La diligence d’Altdorf ? Elle repart demain à l’aube, si ses cochers tiennent debout d’ici là. Voyez ça avec eux, moi je ne vends que la bière et les lits. »</p></div>
    <div class="reponses">
      ${reponse(1, 'Et cet avis placardé au mur, ce prince qui recrute ?')}
      ${reponse(2, 'À quel prix cèdent-ils leurs places, entre nous ?', { annonce: 'Test de Charme · Intermédiaire', visee: true })}
      ${reponse(3, 'Servez-nous quatre chopes, et parlons.', { cout: '4 sc' })}
      ${reponse(4, 'Nous verrons cela avec eux. Bonsoir.')}
    </div>
  </div>${ferrures}</div>`);
  pieces.push(chronique([JOUR, ['vieux', 'Le groupe entre dans la salle commune.'], ['', 'Mira s’adresse à Gustav Fondleburger.']], 'haut'));
}
if (ETAT === 'jet-de-competence') {
  const mira = HEROS.find((h) => h.id === 'mira');
  pieces.push(bandeauDuJet('Test de Charme', '', `
    ${camp({ portrait: portrait('mira'), nom: 'Mira', carac: 'Charme', seuil: 43, des: ['20', '7'], total: 27, dr: '+2', reussite: true })}
    ${verdict('Test de Charme · Intermédiaire (+0)', 'Réussite', 'Gustav se laisse amadouer et baisse la voix.')}
    <div class="camp droite enjeu">${portrait('gustav')}<div><div class="n gothique">Gustav Fondleburger</div><div class="c rubrique">Interlocuteur</div>
      <p>« À quel prix cèdent-ils leurs places, entre nous ? »</p></div></div>`, apresLeDe({ heros: mira })));
  pieces.push(chronique([['vieux', 'Le groupe entre dans la salle commune.'], ['vieux', 'Mira s’adresse à Gustav Fondleburger.'], ['', 'Mira tente de charmer Gustav Fondleburger.']], 'haut', 'bottom:234px'));
}

if (ETAT === 'butin') {
  sceneRoute();
  /* LDB 61 l.33 ; `src/noyau/combatEffects.ts:348`, `src/noyau/issueDeCombat.ts:90` */
  const ENC = { bjorn: [5, 8], mira: [4, 6], aldric: [6, 6], greta: [7, 8] };
  const col = (h) => { const [a, m] = ENC[h.id]; const plein = a >= m;
    return `<div class="col">${portrait(h.id)}<div class="q"><b>${h.nom.split(' ')[0]}</b><span class="lin ${plein ? 'plein' : ''}">Enc ${a} / ${m}</span><div class="enc ${plein ? 'plein' : ''}"><i style="width:${100 * a / m}%"></i></div></div></div>`; };
  const libre = '<div class="prise"></div>';
  const ligne = (icone, nom, enc) => `<div class="objet"><div class="ic">${picto(icone, 17, '#3a2a18', 1.6)}</div><b>${nom}</b><span class="lin">Enc ${enc}</span></div>${libre.repeat(HEROS.length + 1)}`;
  pieces.push(titre({ icone: 'route', nom: 'La route d’Altdorf', sous: 'Dans la forêt · la nuit', largeur: 392 }));
  pieces.push(`<div id="butin" class="cadre bois arret" data-piece="butin"><div class="fond parchemin">
    <div class="trouve"><div class="n gothique" data-texte="butin titre">Le corps du voyageur</div><div class="c rubrique">Fouillé par Mira</div>
      <p data-texte="butin récit">Un carreau d’arbalète dans le dos. Ses poches n’ont pas été vidées.</p>
      <div class="bourse">${sceau('pieces', 14)}<span><b class="lin">2 CO 10/–</b> répartis entre les bourses</span></div></div>
    <div class="partage"><div class="tete-o rubrique">Une case donne l’objet à ce héros</div>${HEROS.map(col).join('')}<div class="col laisser">${picto('croix', 15, '#5a2a12', 1.8)}<b>Laisser</b></div>
      ${ligne('epee', 'Épée', 1)}
      ${ligne('habit', 'Vêtements de bonne facture', 1)}
    </div>
    <div id="suites">${plaque('Emporter le reste', { armee: true, icone: 'sac', classe: 'large' })}${plaque('Évaluer', { icone: 'oeil' })}</div>
    <div class="reste">Ce qui reste à la fermeture va à ${HEROS[0].nom}.</div>
  </div><div class="ruban gothique">Butin</div>${ferrures}</div>`);
  pieces.push(chronique([['borne-j', 'La nuit, sur la route d’Altdorf'], ['vieux', 'Mira fouille le corps du voyageur.'], ['', 'Aldric prend la lettre cachetée.']], 'haut', 'bottom:286px'), coins());
}

if (ETAT === 'document') {
  sceneAuberge({ groupe: 'avis', avis: true, sombre: .3 });
  pieces.push(`<div id="feuille" data-piece="feuille"><div class="parchemin">
    <h2>On recherche !<span>Aventuriers courageux !</span></h2><div class="filet"><i></i><b></b><i></i></div>
    <p data-texte="document 1">Son Excellence le Prince Héritier Hergard von Tasseninck de la Grande Principauté d’Ostland, fait savoir par la présente qu’il réside actuellement à Altdorf et souhaite s’attacher les services d’un groupe d’aventuriers chevronnés. L’engagement prendra effet dès que possible, pour une période indéterminée.</p>
    <p>Que les postulants soient avisés qu’il leur sera demandé d’entreprendre une mission des plus périlleuses dans les régions inexplorées des Montagnes Grises. L’objet de la mission est très délicat et la plus haute discrétion est impérative en ce qui concerne sa nature précise.</p>
    <p>La rémunération est négociable et dépendra de l’expérience des candidats, mais un minimum de 8 Couronnes par personne et par jour est assuré. De plus, une prime généreuse sera accordée une fois la mission accomplie. Couards, traînards et nains s’abstenir.</p>
    <p class="signe">Signé<br>Scribe personnel du Prince Héritier Hergard</p>
    <div class="cachet">${sceau('bouclier', 26)}</div></div><i class="clou"></i></div>`);
  pieces.push(`<div id="remis" class="cadre bois" data-piece="remis"><div class="fond bois">${portrait('mira', { classe: 'choisi' })}
    <div class="t"><div class="c rubrique">Avis placardé à La Diligence</div><div class="n gothique" data-texte="titre du document">On recherche ! Aventuriers courageux !</div>
      <div class="note">${pastille('journal')}Consigné à la chronique : il se relit quand on veut.</div></div>
    ${plaque('Replier', { armee: true })}</div>${ferrures}</div>`);
  pieces.push(coins());
}
monter(pieces);
document.querySelectorAll('.arret, #jet, #remis').forEach(clouer);
