/* La halle vue du siège d'un invité (#3935), page `../outils/coop-la-main.html` : la page des services du lieu ouverte sur
   son marché de cargaison, l'achat composé par l'hôte ; la bourse et la cale restent à l'hôte, chaque héros dit qui le
   joue. */
const [bjorn, mira, aldric, greta] = HEROS;
const PARTS = bourse({ parts: [[bjorn.nom, '10/–', bjorn.bourse], [mira.nom, '5/–', mira.bourse], [aldric.nom, '1 CO 10/–', aldric.bourse], ['Greta', '10/–', greta.bourse]], total: '2 CO 15/–', reglable: false });
sceneDeLaHalle();

const pieces = [];
pieces.push(cartouche({ icone: 'panier', nom: 'La halle', sous: 'Marché de Kemperbad · printemps', taille: 'titre', largeur: 372 }));
pieces.push(rail('Services de Kemperbad', [['lit', 'Auberge'], ['panier', 'Marché', 1], ['enclume', 'Forgeron'], ['livre', 'Temple'], ['ancre', 'Port']], 'On passe de l’un à l’autre sans ressortir'));
pieces.push(`<div id="rumeur" class="parchemin" data-piece="rumeur" style="top:450px"><i class="clou"></i><div class="r">Rumeur au marché</div><p data-texte="rumeur">Vivres, Bois se vendraient le double à Eilhart.</p></div>`);
pieces.push(hote({ id: 'offre-laine', classe: 'offre choisie', x: 372, y: 150, l: 300, icone: 'ballot', nom: 'Laine', sous: 'Un négociant en laine', pointe: 218,
  corps: `${mesures([['Disponible', '350 Enc'], ['Prix de base', '2/– / Enc'], ['Estimation avant Marchandage', '2 CO 15/–']])}<div class="gestes">${plaque('Acheter', { fermee: true, icone: 'balance', taille: 'petite' })}</div>` }));
pieces.push(hote({ id: 'offre-vin', classe: 'offre', x: 876, y: 130, l: 296, icone: 'tonneau', nom: 'Vin', sous: 'Un vigneron · qualité incertaine', pointe: 84,
  corps: `${mesures([['Disponible', '280 Enc'], ['Prix de base', '6/– / Enc'], ['Estimation avant Marchandage', '8 CO 5/–']])}<div class="gestes">${plaque('Évaluer le vin', { icone: 'loupe', fermee: true, taille: 'petite' })}${plaque('Acheter', { icone: 'balance', fermee: true, taille: 'petite' })}</div>` }));
pieces.push(page('chargement', 'Le chargement', `
  <div class="tete"><h3 data-texte="denrée">Laine</h3><span class="sous rubrique">Composé par l’hôte</span></div>
  <p style="margin-top:4px">Le négociant cède son lot entier, ou une part d’au moins 10 Enc.</p>
  ${filet()}
  <div class="r">Porteur</div>
  <div class="porteurs">
    <div class="porteur pris"><div class="l">${picto('charrette', 18, '#5a2a12')}<b>Charrette</b></div><span class="chiffres">25 / 25 Enc libres</span>${jauge(0 / 25, { teinte: 'or', taille: 'forte', ajout: 25 / 25 })}</div>
    <div class="porteur"><div class="l">${picto('fer_a_cheval', 18, '#5a2a12')}<b>Mule</b></div><span class="chiffres">14 / 14 Enc libres</span>${jauge(0 / 14, { teinte: 'or', taille: 'forte' })}</div>
  </div>
  ${filet()}
  <div class="r">Enc à acheter</div>
  ${quantite(25, 10, 25)}
  ${filet()}
  <table class="compte">
    <tr><td>Prix de base<span class="chiffres">25 Enc à 2/–</span></td><td class="chiffres">2 CO 10/–</td></tr>
    <tr><td>Lot partagé<span class="chiffres">+10 %</span></td><td class="chiffres">5/–</td></tr>
    <tr class="total"><td>Estimation</td><td>2 CO 15/–</td></tr>
  </table>
  ${PARTS}
  ${plaque('Conclure l’achat', { fermee: true, icone: 'balance', classe: 'conclure' })}
  <div class="note refus">${sceau('reseau', 'menu')}<i data-texte="refus">L’hôte seul engage les bourses et la cale du groupe.</i></div>`));
const joue = (qui, moi) => ({ html: `<span class="attend rubrique ${moi ? '' : 'autre'}">${qui}</span>` });
pieces.push(`<div id="main" class="cadre bois" data-piece="main"><div class="fond bois">${medaillon('reseau', { taille: 'moyen' })}<div><b class="gothique" data-texte="main">La main est à l’hôte</b><span class="rubrique">Karl compose l’achat · partie K7M2QX</span></div></div>${ferrures}</div>`);
pieces.push(bandeau({ bjorn: joue('Karl · hôte'), mira: joue('Lena (vous)', true), aldric: { ...joue('Karl · hôte'), choisi: true }, greta: joue('Otto — reconnexion…') }, { bourses: true }));
pieces.push(retour('Quitter la halle'), coins());
monter(pieces);
