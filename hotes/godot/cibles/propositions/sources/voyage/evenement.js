/* L'événement de route et son issue (cible écrite `ecrites/voyage.md`, « L'événement de route »). La péripétie
   « Voyage éreintant ! » : LDB 51 l.215 ; `src/noyau/travelFlow.ts:1418`. Le Test s'ouvre au bandeau du jet, le testeur
   s'y désigne ; échoué, il s'y relance (LDB 17 l.23). Cadence : `src/noyau/voyageEnVue.ts:56`, `ecran.cadence.*`. */
const ETAT = document.getElementById('ecran').dataset.etat;
poser(interieur(D.route({ pont: true })));
const ROULE = ETAT === 'evenement-de-route-issue';
if (!ROULE) assombrir();
fermer();
const vignette = `<svg viewBox="0 0 250 250"><rect width="250" height="250" fill="#d8c493"/><g opacity=".35">${V.monts(150, 70, '#5c4326', 3, 40, 250).replace('780L0 780', '250L0 250')}</g>
  ${V.sapins(0, 250, 168, 60, '#2a1d12', 6, 16)}<rect y="165" width="250" height="85" fill="#2a1d12"/>
  <path d="M60 250V186c26-26 60-26 86 0v10h-12c-18-16-44-16-62 0v54z" fill="#d8c493"/><path d="M186 180l26 8 4 62h-30z" fill="#d8c493"/><path d="M148 186l30-12 4 7-28 14zM150 214l22 3-4 9-20-3z" fill="#d8c493"/>
  <path d="M40 232c60-10 130-10 190 0M60 242c50-8 100-8 150 0" stroke="#8c7446" stroke-width="2" fill="none"/>
  <circle cx="196" cy="54" r="20" fill="#9c2a1a" opacity=".85"/></svg>`;
const pieces = [];
pieces.push(temps({ jour: 'Marktag', date: '14 Pflugzeit · 2ᵉ jour de route', meteo: 'Crépuscule, temps sec', cadence: ROULE ? 'jourParJour' : null }));
pieces.push(carteDuTrajet({ titre: 'La route d’Altdorf', de: 'Sept Rayons', vers: 'Altdorf', part: .55 }));
if (!ROULE) {
  pieces.push(`<div id="evenement" class="cadre bois court" data-piece="evenement"><div class="fond parchemin">
    <div class="vignette">${vignette}</div>
    <div class="corps"><div class="tete"><h2 data-texte="titre de l'événement">Voyage éreintant !</h2><span class="rubrique">Sur la route d’Altdorf · 2ᵉ jour</span></div>
      <p data-texte="texte du livre">La route est bloquée. Un pont peut être effondré, une rivière bloquée ou une route inondée, ou quelque autre obstacle insurmontable. Un Personnage effectue un Test de Survie en extérieur Accessible (+20) pour trouver un bon itinéraire de substitution, sinon tout le monde arrive un jour plus tard avec un État Exténué.</p>
    </div><div class="sceau maitre de"><b>4</b><i>d10</i></div>
  </div>${ruban('Péripétie de la route', { gothique: true })}${ferrures}</div>`);
  const bjorn = HEROS.find((h) => h.id === 'bjorn');
  const BJORN = { portrait: portrait('bjorn', { taille: 'grand' }), nom: 'Bjorn', carac: 'Survie en extérieur', seuil: 61, modif: 'Accessible (+20)' };
  const SOUS = 'Voyage éreintant ! · 2ᵉ jour de route', SINON = 'Sinon tout le monde arrive un jour plus tard avec un État Exténué.';
  pieces.push(ETAT === 'evenement-de-route-echec'
    ? bandeauDuJet('Test de Survie en extérieur', '', `
    ${camp({ ...BJORN, des: ['70', '8'], total: 78, dr: '−1' })}
    ${verdict(SOUS, 'DR −1', SINON)}
    <div></div>`, apresLeDe({ heros: bjorn, echec: true }))
    : bandeauDuJet('Test de Survie en extérieur', '', `
    ${camp({ ...BJORN, sous: testeurs(HEROS.map((h) => h.id)) })}
    ${reglages(SOUS, `<div class="dr gothique">Test simple</div><p>${SINON}</p>`)}
    <div></div>`, avantLeDe({ heros: bjorn })));
} else {
  pieces.push(recit('Sur la route d’Altdorf · Voyage éreintant !', 'Le pont a cédé sous la crue. Bjorn trouve un gué en amont, et la diligence repasse la rivière avant la nuit.'));
  pieces.push(frise({ de: 'Auberge des Sept Rayons', vers: 'Altdorf', fait: .55, nuits: [.33], reste: 52 }));
  pieces.push(billet({ x: 300, y: 398, nom: 'Survie en extérieur', qui: 'Bjorn', lignes: [['Seuil', 'Accessible (+20) · 61'], ['Dé', '27'], ['Réussite', '+4 degrés']], pied: chanceDe('bjorn') }));
  pieces.push(bandeau({
    bjorn: { icone: 'route', texte: 'trouve un gué en amont du pont' },
    mira: { texte: 'guide les chevaux dans le courant' },
    aldric: { texte: 'reporte le détour sur le vélin' },
    greta: { texte: 'pousse à la roue, de l’eau jusqu’aux genoux' },
  }));
}
pieces.push(coins());
monter(pieces);
