/* Le port (#3935). Deux états : « port », le quai en lieu (les services sur leurs bâtiments, le navire du groupe, la
   carte et les départs) ; « port-negoce », la page des services du port ouverte sur le négoce de cargaison, la cale du
   navire pour seul porteur. */
const NEGOCE = document.getElementById('ecran').dataset.etat === 'port-negoce';
sceneDuQuai();
const pieces = [];
const enseigne = (o) => cartouche({ classe: 'service enseigne', ...o });

if (NEGOCE) {
  el(S, 'rect', { width: 380, height: H, fill: '#000', opacity: .3 });
  pieces.push(titre({ icone: 'ancre', nom: 'Le port', sous: 'Négoce de cargaison · Salzenmund · printemps', largeur: 420 }));
  pieces.push(rail('Services du port', [['ballot', 'Négoce de cargaison', 1], ['marteau', 'Chantier naval'], ['equipage', 'Recrutement'], ['tonneau', 'Avitaillement']], 'Le navire reste à quai'));
  pieces.push(cartouche({ id: 'offre-bois', classe: 'offre enseigne', x: 350, y: 372, l: 232, icone: 'planches', nom: 'Bois', sous: '320 Enc · 1 CO 10/– / Enc', pointe: 196 }));
  pieces.push(cartouche({ id: 'offre-luxe', classe: 'offre enseigne', x: 520, y: 196, l: 296, icone: 'joyau', nom: 'Produits de luxe', marque: 'Surplus', sous: '360 Enc · 25 CO / Enc', pointe: 112 }));
  pieces.push(cartouche({ id: 'cale', classe: 'offre choisie', x: 846, y: 216, l: 300, icone: 'navire', nom: 'La cale', sous: 'Cogue du groupe', pointe: 92,
    corps: `<div class="porteur-ligne"><span>Chargée</span><b class="lin">240 / 300 Enc libres</b></div>${jauge(60, 300)}<div class="lot pris">${picto('epi', 16, '#2a1a08')}<span>Céréales</span><span class="lin">60 Enc</span></div>` }));
  pieces.push(`<div id="page" class="page cadre bois" data-piece="lot" style="height:auto"><div class="fond parchemin">
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
    <div class="note"><i>Au port, seule la cale du navire se négocie.</i></div>
  </div><div class="ruban gothique">Le lot</div>${ferrures}</div>`);
  pieces.push(bandeau({ aldric: { icone: 'balance', texte: 'mènera le Marchandage' } }, { bourses: true }));
  pieces.push(retour('Quitter le port'), coins());
} else {
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
