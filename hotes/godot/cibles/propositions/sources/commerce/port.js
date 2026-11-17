/* Le port (#3935, #4411). « port » : le quai en lieu (les services sur leurs bâtiments, le navire du groupe, la carte et
   les départs). Les autres états ouvrent la page des services du port sur l'un d'eux, la cale du navire pour seul
   porteur : « port-negoce » (vendre un lot), « port-achat », « port-chantier », « port-recrutement »,
   « port-avitaillement ». */
const ETAT = document.getElementById('ecran').dataset.etat;
sceneDuQuai();
const pieces = [];
const enseigne = (o) => cartouche({ classe: 'service enseigne', ...o });
/* la page des services : son service ouvert, armé au rail */
const SERVICES = { negoce: ['ballot', 'Négoce de cargaison'], chantier: ['marteau', 'Chantier naval'], recrutement: ['equipage', 'Recrutement'], avitaillement: ['tonneau', 'Avitaillement'] };
const services = (ouvert) => {
  el(S, 'rect', { width: 380, height: H, fill: '#000', opacity: .3 });
  pieces.push(titre({ icone: 'ancre', nom: 'Le port', sous: `${SERVICES[ouvert][1]} · Salzenmund · printemps`, largeur: 420 }));
  pieces.push(rail('Services du port', Object.entries(SERVICES).map(([id, [icone, nom]]) => [icone, nom, id === ouvert ? 1 : 0]), 'Le navire reste à quai'));
};
const quitter = (dits = {}, bourses = false) => pieces.push(bandeau(dits, { bourses }), retour('Quitter le port'), coins());
const cale = (corps, classe = 'enseigne') => cartouche({ id: 'cale', classe: `offre ${classe}`, x: 846, y: 216, l: 300, icone: 'navire', nom: 'La cale', sous: 'Cogue du groupe', pointe: 92, corps });
const cereales = (pris = false) => `<div class="lot ${pris ? 'pris' : ''}">${picto('epi', 16, pris ? '#2a1a08' : '#e2c06a')}<span>Céréales</span><span class="lin">60 Enc</span></div>`;
/* #3004 : le navire, sa cargaison et ses vivres sont une entreprise commune, chacun règle sa part avant de valider.
   Les avoirs sont ceux d'un groupe qui vient de vendre ses céréales : des exemples. */
const AVOIRS = ['31 CO', '30 CO 9/–', '32 CO 6/–', '31 CO 3/–'];
const parts = (part, total) => bourse({ parts: HEROS.map((h, k) => [h.nom.split(' ')[0], part, AVOIRS[k]]), total });
/* une ligne que l'on choisit ou dont on règle le nombre : son nom, ce qu'elle coûte, ce que l'on en a ou en veut */
const ligne = (nom, sous, prix, fin, pris = false) => `<div class="ligne ${pris ? 'prise' : ''}"><b>${nom}</b><span class="c">${sous}</span><span class="px lin">${prix}</span>${fin}</div>`;

if (ETAT === 'port-negoce') {
  services('negoce');
  pieces.push(cartouche({ id: 'offre-bois', classe: 'offre enseigne', x: 350, y: 372, l: 232, icone: 'planches', nom: 'Bois', sous: '320 Enc · 1 CO 10/– / Enc', pointe: 196 }));
  pieces.push(cartouche({ id: 'offre-luxe', classe: 'offre enseigne', x: 520, y: 196, l: 296, icone: 'joyau', nom: 'Produits de luxe', marque: 'Surplus', sous: '360 Enc · 25 CO / Enc', pointe: 112 }));
  pieces.push(cale(`<div class="porteur-ligne"><span>Chargée</span><b class="lin">240 / 300 Enc libres</b></div>${jauge(60, 300)}${cereales(true)}`, 'choisie'));
  pieces.push(page('lot', 'Le lot', `
    <div class="tete"><h3 data-texte="lot">Céréales</h3><span class="sous rubrique">60 Enc dans la cale</span></div>
    <div class="filet"></div>
    <table class="faits">
      <tr><td>Prix de base<span class="lin">60 Enc à 2 CO</span></td><td class="lin">120 CO</td></tr>
      <tr><td>Salzenmund</td><td>demande des céréales <span class="lin">+1</span></td></tr>
      <tr><td>Prix d’offre</td><td>le prix de base</td></tr>
      <tr><td>Marchandage du vendeur</td><td class="lin">+2 DR</td></tr>
    </table>
    <div class="filet"></div>
    <div class="voies">
      ${voie('balance', 'Vendre', 'Recherche d’acheteur, puis Marchandage', 'Un acheteur se trouve sur 80 ou moins au d100 ; sinon la moitié du lot se propose.', '120 CO', true)}
      ${voie('moitie', 'Brader', 'Sans Test', 'Un port de commerce, ou qui demande la denrée, la reprend au quart de son prix de base.', '30 CO')}
    </div>
    ${plaque('Vendre', { armee: true, icone: 'balance', classe: 'conclure' })}
    <div class="note"><i>Au port, seule la cale du navire se négocie.</i></div>`));
  quitter({ aldric: { icone: 'balance', texte: 'mènera le Marchandage' } }, true);
}

/* MDG 15 l.331-341 ; `src/noyau/portFlow.ts:188-201`, `:315` */
if (ETAT === 'port-achat') {
  services('negoce');
  pieces.push(cartouche({ id: 'offre-luxe', classe: 'offre enseigne', x: 520, y: 172, l: 296, icone: 'joyau', nom: 'Produits de luxe', marque: 'Surplus', sous: '360 Enc · 25 CO / Enc', pointe: 112 }));
  pieces.push(cartouche({ id: 'offre-bois', classe: 'offre choisie', x: 350, y: 256, l: 336, icone: 'planches', nom: 'Bois', sous: 'Un négociant du quai', pointe: 196,
    corps: `${mesures([['Disponible', '320 Enc'], ['Prix de base', '1 CO 10/– / Enc'], ['Estimation avant Marchandage', '90 CO']])}<div class="gestes">${plaque('Acheter', { armee: true, icone: 'balance' })}</div>` }));
  pieces.push(cale(`<div class="porteur-ligne"><span>Chargée</span><b class="lin">240 / 300 Enc libres</b></div>${jauge(60, 300, 60)}${cereales()}`));
  pieces.push(page('chargement', 'Le chargement', `
    <div class="tete"><h3 data-texte="denrée">Bois</h3><span class="sous rubrique">Achat en composition</span></div>
    <div class="filet"></div>
    <div class="r">Porteur</div>
    <div class="porteurs"><div class="porteur pris"><div class="l">${picto('navire', 18, '#5a2a12')}<b>La cale</b></div><span class="lin">240 / 300 Enc libres</span>${jauge(60, 300, 60)}</div></div>
    <div class="filet"></div>
    <div class="r">Enc à acheter</div>
    ${quantite(60, 1, 240)}
    <div class="filet"></div>
    <table class="compte">
      <tr><td>Prix de base<span class="lin">60 Enc à 1 CO 10/–</span></td><td class="lin">90 CO</td></tr>
      <tr><td>Lot partagé</td><td>vendeur <span class="lin">+1 DR</span></td></tr>
      <tr class="total"><td>Estimation</td><td>90 CO</td></tr>
    </table>
    ${parts('22 CO 10/–', '90 CO')}
    ${plaque('Conclure l’achat', { armee: true, icone: 'balance', classe: 'conclure' })}
    <div class="note"><i>Le Marchandage se joue à la conclusion, contre le négociant.</i></div>`));
  quitter({ aldric: { icone: 'balance', texte: 'mènera le Marchandage' } });
}

/* MDG 13 l.150-159, l.643 ; MDG 12 l.195-364 ; MDG 15 l.255 ; `src/noyau/seaVoyageFlow.ts:2345-2463` */
if (ETAT === 'port-chantier') {
  services('chantier');
  const pose = (nom, enc, prix, o = {}) => `<div class="lot ${o.pris ? 'pris' : ''} ${o.ferme ? 'ferme' : ''}"><span>${nom}</span><span class="lin">${enc ? `${enc} Enc · ` : ''}${prix}</span></div>`;
  pieces.push(cartouche({ id: 'constructeur', classe: 'offre choisie', x: 350, y: 132, l: 330, icone: 'marteau', nom: 'Le constructeur naval', sous: 'Améliorations à poser', pointe: 84,
    corps: `${pose('Ancre', 50, '10 CO')}${pose('Bélier', 60, '30 CO')}${pose('Figure de proue', 10, '2 CO')}${pose('Nid-de-pie', 5, '5 CO', { pris: true })}${pose('Sabord', 0, '15 CO')}${pose('Blindage (bronze)', 875, '1 250 CO', { ferme: true })}` }));
  pieces.push(cartouche({ id: 'navire', classe: 'offre enseigne', x: 846, y: 196, l: 300, icone: 'navire', nom: 'Votre cogue', sous: 'Navire du groupe · 25 m · à quai', pointe: 92,
    corps: `<div class="porteur-ligne"><span>Coque</span><b class="lin">52 / 60</b></div><div class="vie" style="margin-top:5px"><i style="width:87%"></i></div><div class="porteur-ligne"><span>Salissures</span><b>niveau <span class="lin">1</span></b></div>` }));
  pieces.push(page('chantier', 'Le chantier', `
    <div class="tete"><h3 data-texte="navire">Votre cogue</h3><span class="sous rubrique">Un travail à la fois</span></div>
    <div class="filet"></div>
    <div class="voies">
      ${voie('marteau', 'Réparer la coque', '8 Blessures · Métier (Constructeur de navires)', '1 CO par Blessure restaurée ; chaque Test réussi prend 1d10 heures et restaure 1d10 Blessures.', '8 CO', true)}
      ${voie('goutte', 'Caréner', 'Cale sèche · Salissures de niveau 1', '5 % du coût de base du navire ; la coque repart propre.', '15 CO')}
      ${voie('plus', 'Poser : Nid-de-pie', 'Amélioration · 5 Enc', 'La pose prend 1d10 jours (valeur maison).', '5 CO')}
    </div>
    ${parts('2 CO', '8 CO')}
    ${plaque('Réparer la coque', { armee: true, icone: 'marteau', classe: 'conclure' })}
    <div class="note"><i>Le temps du travail passe à quai.</i></div>`));
  quitter();
}

/* MDG 14 l.293-302 ; `src/data/crew-roles.json` ; `src/noyau/portFlow.ts:499-551` */
if (ETAT === 'port-recrutement') {
  services('recrutement');
  pieces.push(enseigne({ id: 'taverne', x: 878, y: 300, l: 256, icone: 'equipage', nom: 'Taverne des marins', sous: 'Recruter l’équipage', pointe: 226 }));
  pieces.push(cartouche({ id: 'navire', classe: 'offre enseigne', x: 560, y: 150, l: 280, icone: 'navire', nom: 'Votre cogue', sous: 'Navire du groupe · à quai', pointe: 236,
    corps: `<div class="porteur-ligne"><span>Équipage</span><b class="lin">13 sur 15</b></div>${jauge(13, 15, 2)}` }));
  const ROLES = [['Capitaine', '5 CO', 0], ['Timonier', '3 CO 12/–', 1], ['Vigie', '3 CO 12/–', 1], ['Mousse', '1 CO 4/–', 6], ['Navigateur', '5 CO', 0], ['Artilleur', '3 CO 12/–', 0], ['Cuisinier', '1 CO 4/–', 1], ['Chirurgien', '5 CO', 0], ['Chansonnier', '3 CO 12/–', 0]];
  pieces.push(page('equipage', 'L’équipage', `
    <div class="tete"><h3 data-texte="équipage">Les salariés du bord</h3><span class="sous rubrique">Solde par semaine · à bord</span></div>
    <div class="lignes">${ROLES.map(([nom, solde, n]) => ligne(nom, '', solde, `<span class="n lin">${n}</span>`, nom === 'Mousse')).join('')}</div>
    <div class="filet"></div>
    <div class="combien"><span class="r">Mousses à embaucher</span>${moinsPlus({ entre: '<b class="lin">2</b>' })}</div>
    <table class="compte">
      <tr><td>Solde ajoutée<span class="lin">2 à 1 CO 4/–</span></td><td class="lin">2 CO 8/–</td></tr>
      <tr class="total"><td>Solde de l’équipage</td><td>18 CO</td></tr>
    </table>
    <div class="deux">${plaque('Embaucher', { armee: true, icone: 'equipage', classe: 'conclure' })}${plaque('Débarquer', { classe: 'conclure' })}</div>
    <div class="note"><i>Rien n’est débité à l’embauche : la solde se règle chaque semaine.</i></div>`));
  quitter();
}

/* MDG 14 l.236-252 ; `src/noyau/portFlow.ts:553-601` */
if (ETAT === 'port-avitaillement') {
  services('avitaillement');
  pieces.push(enseigne({ id: 'avitailleur', x: 640, y: 462, l: 232, icone: 'tonneau', nom: 'L’avitailleur', sous: 'Vivres et eau douce', pointe: 76 }));
  pieces.push(cale(`<div class="porteur-ligne"><span>Vivres</span><b class="lin">40 rations-jour</b></div><div class="porteur-ligne"><span>Eau douce</span><b class="lin">290 litres</b></div><div class="porteur-ligne"><span>Chargée</span><b class="lin">240 / 300 Enc libres</b></div>${jauge(60, 300, 72)}`));
  const nombre = (n) => moinsPlus({ entre: `<b class="lin">${n}</b>` });
  pieces.push(page('avitaillement', 'L’avitaillement', `
    <div class="tete"><h3 data-texte="avitaillement">Vivres et eau douce</h3><span class="sous rubrique">Achat en composition</span></div>
    <div class="lignes">
      ${ligne('Biscuits de mer', 'ration pour un jour', '1/–', nombre(120))}
      ${ligne('Nourriture préservée', 'ration pour un jour', '2/–', nombre(60))}
      ${ligne('Tonneau d’eau douce', '9 Enc', '8/– 6 sc', nombre(8))}
    </div>
    <p class="regle">Un tonneau contient 145 litres d’eau. Un membre d’équipage boit 2 à 3 litres d’eau par jour.</p>
    <div class="filet"></div>
    <table class="compte">
      <tr><td>Biscuits de mer<span class="lin">120 à 1/–</span></td><td class="lin">6 CO</td></tr>
      <tr><td>Nourriture préservée<span class="lin">60 à 2/–</span></td><td class="lin">6 CO</td></tr>
      <tr><td>Eau douce<span class="lin">8 à 8/– 6 sc</span></td><td class="lin">3 CO 8/–</td></tr>
      <tr class="total"><td>Devis</td><td>15 CO 8/–</td></tr>
    </table>
    ${parts('3 CO 17/–', '15 CO 8/–')}
    ${plaque('Avitailler la cale', { armee: true, icone: 'tonneau', classe: 'conclure' })}`));
  quitter();
}

if (ETAT === 'port') {
  pieces.push(titre({ icone: 'ancre', nom: 'Salzenmund', sous: `Port · Nordland · ${picto('systeme', 13, '#c9b995', 1.6)} Beau temps`, largeur: 400 }));
  pieces.push(`<div id="recit" data-piece="récit"><p class="ombre">Capitale du Nordland, Grand Temple d’Ulric et temple de Manann Resplendissant. Votre cogue est amarrée au quai des marchands.</p></div>`);
  pieces.push(enseigne({ id: 'chantier', x: 340, y: 336, l: 254, icone: 'marteau', nom: 'Chantier naval', sous: 'Réparer · caréner · améliorer', pointe: 96 }));
  pieces.push(cartouche({ id: 'entrepot', classe: 'service', x: 548, y: 86, l: 276, icone: 'ballot', nom: 'L’entrepôt', sous: 'Négoce de cargaison', pointe: 86,
    corps: `<p>Bienvenue à quai ! Amarrage, fret et passage — ici on négocie tout ce qui flotte, et le reste aussi.</p><div class="gestes">${plaque('Entrer', { icone: 'porte' })}</div>` }));
  pieces.push(cartouche({ id: 'navire', classe: 'offre enseigne', x: 838, y: 24, l: 250, icone: 'navire', nom: 'Votre cogue', sous: 'Navire du groupe · à quai', pointe: 100,
    corps: `<div class="porteur-ligne"><span>Coque</span><b class="lin">52 / 60</b></div><div class="vie" style="margin-top:5px"><i style="width:87%"></i></div><div class="porteur-ligne"><span>Cale</span><b class="lin">240 / 300 Enc libres</b></div>${jauge(60, 300)}` }));
  pieces.push(enseigne({ id: 'taverne', x: 1060, y: 268, l: 256, icone: 'equipage', nom: 'Taverne des marins', sous: 'Recruter l’équipage', pointe: 112 }));
  pieces.push(enseigne({ id: 'avitailleur', x: 1446, y: 474, l: 232, icone: 'tonneau', nom: 'L’avitailleur', sous: 'Vivres et eau douce', pointe: 70 }));
  // le fragment de carte : la côte du Nordland, la route de mer qui part d'ici
  pieces.push(`<div id="carte" class="cadre bois" data-piece="carte"><div class="fond parchemin"><svg viewBox="0 0 343 220">
    <path d="M0,150C40,138 70,150 104,132C132,118 150,128 178,112C206,96 236,104 262,90C290,76 318,84 343,72V220H0Z" fill="rgba(90,60,20,.16)" stroke="#4a3420" stroke-width="1.3"/>
    <g stroke="#4a3420" stroke-width=".8" opacity=".55" fill="none">${[[30, 60], [90, 40], [150, 70], [210, 36], [270, 50], [60, 100], [130, 96], [230, 70]].map(([x, y]) => `<path d="M${x},${y}c5,-5 10,-5 15,0s10,5 15,0"/>`).join('')}</g>
    <g fill="none" stroke="#4a3420" stroke-width=".9" opacity=".7">${[[40, 186], [70, 178], [120, 190], [150, 170], [200, 184], [240, 160], [290, 176], [310, 150], [96, 166]].map(([x, y]) => `<path d="M${x},${y}l5,-11l5,11zM${x + 5},${y}v4"/>`).join('')}</g>
    <path d="M178,112C150,86 110,84 70,112" fill="none" stroke="#9c2a1a" stroke-width="2"/>
    <path d="M178,112C214,74 268,60 318,66" fill="none" stroke="#4a3420" stroke-width="1.2" stroke-dasharray="4 4"/>
    ${[[70, 112, 'Norden', -16, 18], [318, 66, 'Dietershafen', -70, -9], [262, 90, 'Hargendorf', -24, 20]].map(([x, y, n, dx, dy]) => `<circle cx="${x}" cy="${y}" r="3.500" fill="#e9dcc0" stroke="#2a1d12" stroke-width="1.300"/><text x="${x + dx}" y="${y + dy}" font-family="Fell SC" font-size="11.500" letter-spacing=".8" fill="#2a1d12">${n}</text>`).join('')}
    <circle cx="178" cy="112" r="6" fill="#9c2a1a" stroke="#5a130b" stroke-width="1.500"/><text x="150" y="136" font-family="Fell SC" font-size="12" letter-spacing=".8" fill="#7c1f14">Salzenmund</text>
    <g transform="translate(44,44)" stroke="#4a3420" fill="none" stroke-width="1"><circle r="13"/><path d="M0,-18V18M-18,0H18M-9,-9L9,9M9,-9L-9,9"/></g>
    <text x="196" y="30" font-family="Fell" font-style="italic" font-size="13" fill="#4a3420" opacity=".8">Mer des Griffes</text>
  </svg></div>${ferrures}</div>`);
  pieces.push(ouvrir('Ouvrir la carte', 'loupe', 266));
  const depart = (nom, sous, jours) => `<div class="depart"><div class="ou"><b>${nom}</b><span class="rubrique">${sous}</span></div><div class="moyen">${rond('navire', 19)}<span class="lin">${jours} j</span></div></div>`;
  pieces.push(`<div id="partir" class="cadre bois" data-piece="partir"><div class="fond bois">
    ${depart('Norden', 'Par la mer des Griffes · 90 milles', 3)}${depart('Hargendorf', 'Par la mer des Griffes · 60 milles', 2)}
  </div><div class="ruban rubrique">Prendre la mer</div>${ferrures}</div>`);
  pieces.push(bandeau({ bjorn: { texte: 'a le pied marin, enfin' }, greta: { mal: true, icone: 'goutte', texte: 'se remet du mal de mer' } }, { bourses: true }));
  pieces.push(retour('Explorer', 'route'), coins());
}
monter(pieces);
