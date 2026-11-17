/* La halle (#3935) : la page des services du lieu ouverte sur son marché de cargaison. Les offres sont les négociants
   de la halle, les porteurs du groupe attendent au premier plan ; la page de droite compose l'achat ou traite le lot
   choisi. Le Marchandage prend le bandeau du bas, à la place du bandeau des héros. « coop-la-main » est la même halle
   vue du siège d'un invité : la bourse et la cale restent à l'hôte, chaque héros dit qui le joue. */
const ETAT = document.getElementById('ecran').dataset.etat;
const COOP = ETAT === 'coop-la-main';
const VENTE = ETAT === 'halle-vente', JET = ETAT.startsWith('marchandage'), AVANT = ETAT === 'marchandage-avant-le-de';
const MARCHANDE = JET && !AVANT;
/* #3004 : la cargaison est une entreprise commune, chacun règle sa part avant de conclure */
const [bjorn, mira, aldric, greta] = HEROS;
const PARTS = bourse({ parts: [[bjorn.nom, '10/–', bjorn.bourse], [mira.nom, '5/–', mira.bourse], [aldric.nom, MARCHANDE ? '1 CO 4/– 6 sc' : '1 CO 10/–', aldric.bourse], ['Greta', '10/–', greta.bourse]], total: MARCHANDE ? '2 CO 9/– 6 sc' : '2 CO 15/–' });
sceneDeLaHalle({ charge: VENTE ? 3 : 0 });

const pieces = [];
pieces.push(titre({ icone: 'panier', nom: 'La halle', sous: 'Marché de Kemperbad · printemps', largeur: 372 }));
pieces.push(rail('Services de Kemperbad', [['lit', 'Auberge'], ['panier', 'Marché', 1], ['enclume', 'Forgeron'], ['livre', 'Temple'], ['ancre', 'Port']], 'On passe de l’un à l’autre sans ressortir'));
pieces.push(`<div id="rumeur" class="parchemin" data-piece="rumeur" style="top:450px"><i class="clou"></i><div class="r">Rumeur au marché</div><p data-texte="rumeur">Vivres, Bois se vendraient le double à Eilhart.</p></div>`);

if (VENTE) {
  pieces.push(cartouche({ id: 'offre-laine', classe: 'offre enseigne', x: 372, y: 150, l: 236, icone: 'ballot', nom: 'Laine', sous: 'À vendre · 350 Enc', pointe: 200 }));
  pieces.push(cartouche({ id: 'offre-vin', classe: 'offre enseigne', x: 900, y: 150, l: 236, icone: 'tonneau', nom: 'Vin', sous: 'À vendre · 280 Enc', pointe: 56 }));
  pieces.push(cartouche({ id: 'porteur-mule', classe: 'offre enseigne', x: 346, y: 384, l: 200, icone: 'fer_a_cheval', nom: 'Mule', sous: 'Porteur du groupe', pointe: 84,
    corps: `<div class="porteur-ligne"><span>Vide</span><b class="lin">14 / 14 Enc libres</b></div>${jauge(0, 14)}` }));
  pieces.push(cartouche({ id: 'porteur-charrette', classe: 'offre choisie', x: 640, y: 292, l: 262, icone: 'charrette', nom: 'Charrette', sous: 'Porteur du groupe', pointe: 120,
    corps: `<div class="porteur-ligne"><span>Pleine</span><b class="lin">0 / 25 Enc libres</b></div>${jauge(25, 25)}<div class="lot pris">${picto('ballot', 16, '#2a1a08')}<span>Laine</span><span class="lin">25 Enc</span></div>` }));
  pieces.push(`<div id="page" class="page cadre bois" data-piece="lot" style="height:auto"><div class="fond parchemin">
    <div class="tete"><h3 data-texte="lot">Laine</h3><span class="sous rubrique">25 Enc sur la charrette</span></div>
    <div class="filet"></div>
    <table class="faits">
      <tr><td>Prix de base<span class="lin">25 Enc à 2/–</span></td><td class="lin">2 CO 10/–</td></tr>
      <tr><td>Mise à prix à Kemperbad<span class="lin">+5 %</span></td><td class="lin">2 CO 12/– 6 sc</td></tr>
    </table>
    <div class="filet"></div>
    <div class="voies">
      ${voie('balance', 'Vendre', 'Recherche d’acheteur, puis Marchandage', 'Un acheteur se trouve sur 60 ou moins au d100 ; sinon la moitié du lot se propose.', '2 CO 12/– 6 sc', true)}
      ${voie('moitie', 'Brader', 'Sans Test', 'Une place de commerce reprend tout lot à la moitié de son prix de base.', '1 CO 5/–')}
      ${voie('deplacer', 'Déplacer', 'Vers la mule · 14 Enc libres', 'Le lot change de porteur, en tout ou en partie.', '')}
    </div>
    ${plaque('Vendre', { armee: true, icone: 'balance', classe: 'conclure' })}
    <div class="note"><i>Refuser la mise à prix garde le lot sur la charrette.</i></div>
  </div><div class="ruban gothique">Le lot</div>${ferrures}</div>`);
} else {
  pieces.push(cartouche({ id: 'offre-laine', classe: `offre ${JET ? '' : 'choisie'}`, x: 372, y: JET ? 196 : 150, l: 300, icone: 'ballot', nom: 'Laine', sous: 'Un négociant en laine', pointe: 218,
    corps: `${mesures([['Disponible', '350 Enc'], ['Prix de base', '2/– / Enc'], ...(JET ? [] : [['Estimation avant Marchandage', '2 CO 15/–']])])}${JET ? '' : `<div class="gestes">${plaque('Acheter', { armee: !COOP, fermee: COOP, icone: 'balance' })}</div>`}` }));
  if (!JET) pieces.push(cartouche({ id: 'offre-vin', classe: 'offre', x: 876, y: 130, l: 296, icone: 'tonneau', nom: 'Vin', sous: 'Un vigneron · qualité incertaine', pointe: 84,
    corps: `${mesures([['Disponible', '280 Enc'], ['Prix de base', '6/– / Enc'], ['Estimation avant Marchandage', '8 CO 5/–']])}<div class="gestes">${plaque('Évaluer le vin', { icone: 'loupe', fermee: COOP })}${plaque('Acheter', { icone: 'balance', fermee: COOP })}</div>` }));
  pieces.push(`<div id="page" class="page cadre bois ${JET ? 'courte' : ''}" data-piece="chargement" style="height:auto"><div class="fond parchemin">
    <div class="tete"><h3 data-texte="denrée">Laine</h3><span class="sous rubrique">${COOP ? 'Composé par l’hôte' : 'Achat en composition'}</span></div>
    <p style="margin-top:4px">Le négociant cède son lot entier, ou une part d’au moins 10 Enc.</p>
    <div class="filet"></div>
    <div class="r">Porteur</div>
    <div class="porteurs">
      <div class="porteur pris"><div class="l">${picto('charrette', 18, '#5a2a12')}<b>Charrette</b></div><span class="lin">25 / 25 Enc libres</span>${jauge(0, 25, 25)}</div>
      <div class="porteur"><div class="l">${picto('fer_a_cheval', 18, '#5a2a12')}<b>Mule</b></div><span class="lin">14 / 14 Enc libres</span>${jauge(0, 14)}</div>
    </div>
    <div class="filet"></div>
    <div class="r">Enc à acheter</div>
    ${quantite(25, 10, 25)}
    <div class="filet"></div>
    <table class="compte">
      <tr><td>Prix de base<span class="lin">25 Enc à 2/–</span></td><td class="lin">2 CO 10/–</td></tr>
      <tr><td>Lot partagé<span class="lin">+10 %</span></td><td class="lin">5/–</td></tr>
      ${MARCHANDE ? '<tr><td>Marchandage gagné<span class="lin">−10 %</span></td><td class="lin">−5/– 6 sc</td></tr>' : ''}
      <tr class="total"><td>${MARCHANDE ? 'Prix marchandé' : 'Estimation'}</td><td>${MARCHANDE ? '2 CO 9/– 6 sc' : '2 CO 15/–'}</td></tr>
    </table>
    ${PARTS}
    ${JET ? '' : COOP ? `${plaque('Conclure l’achat', { fermee: true, icone: 'balance', classe: 'conclure' })}
    <div class="note refus">${sceau('reseau', 12)}<i data-texte="refus">L’hôte seul engage les bourses et la cale du groupe.</i></div>`
    : `${plaque('Conclure l’achat', { armee: true, icone: 'balance', classe: 'conclure' })}
    <div class="note"><i>Le Marchandage se joue à la conclusion, contre le négociant.</i></div>`}
  </div><div class="ruban gothique">Le chargement</div>${ferrures}</div>`);
}

if (JET) {
    const negociant = { cote: 'droite', portrait: portrait('drapier'), nom: 'Le négociant en laine', carac: 'Marchandage', seuil: '?' };
  /* MSRC 13 l.127 ; LDB 59 l.43 ; `src/noyau/landMarketFlow.ts:325` */
  pieces.push(bandeauDuJet('Marchander l’achat', '', AVANT ? `
    ${camp({ portrait: portrait('aldric'), nom: 'Aldric', carac: 'Marchandage', seuil: 45, modif: 'Soutien du groupe' })}
    ${reglages('Laine · 25 Enc · estimation 2 CO 15/–', '<div class="dr gothique">Test opposé</div><div class="enjeux"><span class="modif rubrique">Gagné : −10 %</span><span class="modif rubrique">Succès Stupéfiant : −20 %</span><span class="modif rubrique">Perdu : +10 %</span><span class="modif rubrique">Négociateur : 10 % de plus</span></div>')}
    ${camp(negociant)}` : `
    ${camp({ portrait: portrait('aldric'), nom: 'Aldric', carac: 'Marchandage', seuil: 45, des: ['20', '7'], total: 27, dr: '+2', reussite: true, verdict: 'Réussite' })}
    <div id="verdict"><div class="sous rubrique" data-texte="sous-titre">Laine · 25 Enc</div><div class="dr gothique">DR net +4</div>
      <p>Gagné (−10 % à l’achat)</p><div class="prix lin"><s>2 CO 15/–</s><b>2 CO 9/– 6 sc</b></div></div>
    ${camp({ ...negociant, des: ['1', '60'], total: 61, dr: '−2', verdict: 'Échec' })}`,
  AVANT ? avantLeDe({ heros: aldric, annuler: true }) : `${apresLeDe({ heros: aldric, valider: 'Conclure' })}${plaque('Refuser le marché', { classe: 'large' })}`));
  pieces.push(`<div id="coins" data-piece="coins" style="top:706px">${rond('systeme', 23)}</div>`);
} else {
  const joue = (qui, moi) => ({ html: `<span class="attend rubrique ${moi ? '' : 'autre'}">${qui}</span>` });
  if (COOP) pieces.push(`<div id="main" class="cadre bois" data-piece="main"><div class="fond bois">${medaillon('reseau', { petit: true })}<div><b class="gothique" data-texte="main">La main est à l’hôte</b><span class="rubrique">Karl compose l’achat · partie K7M2QX</span></div></div>${ferrures}</div>`);
  pieces.push(bandeau(COOP ? { bjorn: joue('Karl · hôte'), mira: joue('Lena (vous)', true), aldric: { ...joue('Karl · hôte'), choisi: true }, greta: joue('Otto — reconnexion…') } : { aldric: { icone: 'balance', texte: 'mènera le Marchandage' } }, { bourses: true }));
  pieces.push(retour('Quitter la halle'), coins());
}
monter(pieces);
if (JET) clouer(document.getElementById('jet'));
