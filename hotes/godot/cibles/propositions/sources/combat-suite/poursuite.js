/* La course-poursuite en mer, jouée pendant la traversée sur l'écran de voyage (`../voyage/`).
   Distance entre navires : MDG 13 l.354-403 ; rattrapés : MDG 13 l.420 ; Test d'équipage de Poursuite : MDG 14 l.67-71 ;
   `src/noyau/seaVoyageFlow.ts:1857`, `src/engine/seaNavigation.ts:212`, `sv.chase*` de `src/i18n/messages/fr.ts`.
   Deux états : la manche tombée, et le Test d'équipage à lancer (`course-poursuite-en-mer-test`), rôle après rôle
   (MDG 14 l.19, l.23-27, l.39 ; `src/noyau/flowVerbs.ts:100`). */
const A_LANCER = document.getElementById('ecran').dataset.etat === 'course-poursuite-en-mer-test';
poser(interieur(D.mer({ teinte: 'jour', navire: false })));
poser(`${D.cogue(300, 508, .4, { coque: '#0b0a0e', voile: '#17151b', pavillon: '#0b0a0e' })}<path d="M180 518q120 12 250 0" stroke="#e6ecea" stroke-width="1.500" fill="none" opacity=".5"/>
  ${D.cogue(850, 540, .86, {})}<path d="M592 559q258 26 550 0" stroke="#e6ecea" stroke-width="2.500" fill="none" opacity=".6"/>
  <path d="M0 780V690q200 -40 420 0t440 0 420 0 427 0V780z" fill="#07111a"/>`);
fermer();
const DISTANCE = A_LANCER ? 50 : 51, SEMES = 100;
const pieces = [];
pieces.push(temps({ teinte: 'jour', jour: 'Wellentag', date: '21 Sigmarzeit · 3ᵉ jour en mer', meteo: 'Temps dégagé, bon vent', icone: 'soleil' }));
pieces.push(carteDuTrajet({ titre: 'La mer des Griffes', de: 'Salzenmund', vers: 'Erengrad', part: .3, eau: 'mer' }));
pieces.push(recit('En mer · Course-poursuite', `Une voile noire grossit dans le sillage : la Cogue pirate a pris la chasse. ${A_LANCER ? 'L’équipage court à ses postes.' : 'L’équipage borde la toile, le navire creuse l’écart.'}`).replace('id="recit"', 'id="recit" class="route"'));
pieces.push(`<div id="navire" class="cadre bois bord" data-piece="la poursuite"><div class="fond bois">
  ${ligne('Poursuivant', 'Cogue pirate')}
  ${ligne('Distance', `<span class="lin">${DISTANCE} / ${SEMES}</span>`)}${jauge(DISTANCE / SEMES)}
  ${ligne('Manche du jour', A_LANCER ? 'Test d’équipage' : '<span class="lin">+1</span>')}
  ${ligne('Temps dégagé', 'semés à 100')}
  ${ligne('Distance 0', 'collision et abordage')}
</div><div class="ruban rubrique">La poursuite</div>${ferrures}</div>`);
{ const x1 = 1243, xi = x1 * DISTANCE / SEMES;
  pieces.push(`<div id="frise" data-piece="distance"><svg width="1263" height="44" viewBox="-10 -24 1263 44"><path d="M0 0H${xi}" stroke="#f3dc93" stroke-width="3"/><path d="M${xi} 0H${x1}" stroke="#c9b995" stroke-width="1.500" opacity=".8"/>
    <circle cx="0" r="6" fill="#b9412c" stroke="#150d04" stroke-width="1.500"/><circle cx="${x1}" r="5" fill="#f3dc93" stroke="#150d04" stroke-width="1.500"/><circle cx="${x1 / 2}" r="3" fill="#c9b995"/>
    <path d="M${xi - 5} -13h10l-5 7z" fill="#e9dcc0"/>
    <g font-family="Fell SC" font-size="11" letter-spacing="1.200" fill="#c9b995"><text x="-6" y="17">Rattrapés · 0</text><text x="${x1 / 2}" y="17" text-anchor="middle">Départ · 50</text><text x="${x1 + 6}" y="17" text-anchor="end">Semés · 100</text></g></svg>
    <div class="reste rubrique ombre">Distance <b class="gothique">${DISTANCE}</b>${A_LANCER ? '' : ' · le navire creuse l’écart, +1'}</div></div>`); }
const ROLES = {
  bjorn: { icone: 'cordage', texte: 'Mousse : borde la toile avec les marins' },
  mira: { icone: 'barre', texte: 'Timonier : serre le vent au plus près' },
  aldric: { icone: 'etoile', texte: 'Navigateur : coupe par les hauts-fonds' },
  greta: { icone: 'couronne', texte: 'Capitaine : presse l’équipage à la manœuvre' },
};
if (A_LANCER) {
  const BJORN = HEROS.find((h) => h.id === 'bjorn');
  pieces.push(billet({ x: 868, y: 340, largeur: 442, pointe: 378, nom: 'Poursuite', qui: 'Test d’équipage', lignes: [
    ['Greta, Capitaine · Commandement ≤ 41', '+1 DR'],
    ['<b class="courant">Bjorn, Mousse · Voile ≤ 45</b>', '<b class="courant">compte double</b>'],
    ['Aldric, Navigateur · Orientation ≤ 38', 'à venir'],
    ['Mira, Timonier · Voile ≤ 36', 'à venir'],
    ['Somme', '+1 DR']], pied: `<div class="gestes">${avantLeDe({ heros: BJORN })}</div>` }));
  pieces.push(bandeau({ ...ROLES, bjorn: { ...ROLES.bjorn, choisi: true } }));
} else {
  pieces.push(billet({ x: 1010, y: 384, largeur: 300, pointe: 236, nom: 'Poursuite', qui: 'Test d’équipage', lignes: [['Bjorn, Mousse', '+1 DR, compte double'], ['Greta, Capitaine', '+1 DR'], ['Mira, Timonier', '+1 DR'], ['Aldric, Navigateur', '+1 DR'], ['Somme', '+5 DR']] }));
  pieces.push(bandeau(ROLES));
}
pieces.push(ouvrir('Postes de bord', 'cordage', 502), coins());
monter(pieces);
