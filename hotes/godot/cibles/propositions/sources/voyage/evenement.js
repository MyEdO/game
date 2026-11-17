/* L'événement de route et son issue (cible écrite `ecrites/voyage.md`, « L'événement de route »). La péripétie
   « Voyage éreintant ! » : LDB 51 l.215 ; `src/noyau/travelFlow.ts:1418`. */
const ETAT = document.getElementById('ecran').dataset.etat;
poser(interieur(D.route({ pont: true })));
if (ETAT === 'evenement-de-route') assombrir();
fermer();
const vignette = `<svg viewBox="0 0 250 250"><rect width="250" height="250" fill="#d8c493"/><g opacity=".35">${V.monts(150, 70, '#5c4326', 3, 40, 250).replace('780L0 780', '250L0 250')}</g>
  ${V.sapins(0, 250, 168, 60, '#2a1d12', 6, 16)}<rect y="165" width="250" height="85" fill="#2a1d12"/>
  <path d="M60 250V186c26-26 60-26 86 0v10h-12c-18-16-44-16-62 0v54z" fill="#d8c493"/><path d="M186 180l26 8 4 62h-30z" fill="#d8c493"/><path d="M148 186l30-12 4 7-28 14zM150 214l22 3-4 9-20-3z" fill="#d8c493"/>
  <path d="M40 232c60-10 130-10 190 0M60 242c50-8 100-8 150 0" stroke="#8c7446" stroke-width="2" fill="none"/>
  <circle cx="196" cy="54" r="20" fill="#9c2a1a" opacity=".85"/></svg>`;
const pieces = [];
pieces.push(temps({ jour: 'Marktag', date: '14 Pflugzeit · 2ᵉ jour de route', meteo: 'Crépuscule, temps sec' }));
pieces.push(carteDuTrajet({ titre: 'La route d’Altdorf', de: 'Sept Rayons', vers: 'Altdorf', part: .55 }));
if (ETAT === 'evenement-de-route') {
  pieces.push(`<div id="evenement" class="cadre bois" data-piece="evenement"><div class="fond parchemin">
    <div class="vignette">${vignette}</div>
    <div class="corps"><div class="tete"><h2 data-texte="titre de l'événement">Voyage éreintant !</h2><span class="rubrique">Sur la route d’Altdorf · 2ᵉ jour</span></div>
      <p data-texte="texte du livre">La route est bloquée. Un pont peut être effondré, une rivière bloquée ou une route inondée, ou quelque autre obstacle insurmontable.</p>
      ${plaque('Chercher un bon itinéraire de substitution.', { armee: true, icone: 'route', prix: 'Survie en extérieur · Accessible (+20) · Bjorn' })}
      ${plaque('Attendre que la route se dégage.', { icone: 'sablier', prix: 'Un jour plus tard · chacun Exténué' })}
      ${plaque('Rebrousser chemin jusqu’aux Sept Rayons.', { fermee: true, icone: 'roue', prix: 'Fermé · le billet ne vaut que pour Altdorf' })}
    </div><div class="sceau de"><b>4</b><i>d10</i></div>
  </div><div class="ruban gothique">Péripétie de la route</div>${ferrures}</div>`);
  pieces.push(bandeau({
    bjorn: { choisi: true, html: '<span class="attend rubrique">Désigné · Survie</span>' },
    mira: { html: '<span class="attend sombre rubrique">Désigner</span>' },
    aldric: { texte: 'n’a jamais dormi hors d’un lit' },
    greta: { html: '<span class="attend sombre rubrique">Désigner</span>' },
  }));
} else {
  pieces.push(recit('Sur la route d’Altdorf · Voyage éreintant !', 'Le pont a cédé sous la crue. Bjorn trouve un gué en amont, et la diligence repasse la rivière avant la nuit.').replace('id="recit"', 'id="recit" class="route"'));
  pieces.push(frise({ de: 'Auberge des Sept Rayons', vers: 'Altdorf', fait: .55, nuits: [.33], reste: 52 }));
  pieces.push(billet({ x: 300, y: 452, nom: 'Survie en extérieur', qui: 'Bjorn', lignes: [['Seuil', 'Accessible (+20) · 61'], ['Dé', '27'], ['Réussite', '+4 degrés']] }));
  pieces.push(bandeau({
    bjorn: { icone: 'route', texte: 'trouve un gué en amont du pont' },
    mira: { texte: 'guide les chevaux dans le courant' },
    aldric: { texte: 'reporte le détour sur le vélin' },
    greta: { texte: 'pousse à la roue, de l’eau jusqu’aux genoux' },
  }));
}
pieces.push(sortie('tente', 'Faire halte'), coins());
monter(pieces);
if (ETAT === 'evenement-de-route') marquer('aldric', 'ferme');
