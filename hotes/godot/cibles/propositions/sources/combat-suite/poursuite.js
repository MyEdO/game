/* Les poursuites, sur l'écran de voyage (`../voyage/`) : la course-poursuite en mer jouée pendant la traversée, sa
   sommation et son tribut, et la poursuite terrestre.
   Distance entre navires : MDG 13 l.354-403 ; rattrapés : MDG 13 l.420 ; Test d'équipage de Poursuite : MDG 14 l.67-71,
   rôle après rôle (MDG 14 l.19, l.23-27, l.39 ; `src/noyau/flowVerbs.ts:100`) ; `src/noyau/seaVoyageFlow.ts:1857`,
   `src/engine/seaNavigation.ts:212`, `sv.chase*` de `src/i18n/messages/fr.ts`.
   Sommation et tribut : MDG 15 l.171-173 ; `src/noyau/seaVoyageFlow.ts:2216-2228`, `:2964-3006`, `opt.*`, `sv.detail*`,
   `step.seaTribut` ; le pillage est la valeur maison `pirate-pillage-pct` (`src/data/reglesOptionnelles.json`).
   Poursuite terrestre : LDB 15 l.88-108 ; `src/noyau/pursuitFlow.ts`, `src/engine/pursuit.ts`, `pursuit.*`, `opt.*`. */
const ETAT = document.getElementById('ecran').dataset.etat;
const heros = (id) => HEROS.find((h) => h.id === id);
/* la frise de Distance, de « Rattrapés » à « Semés », le repère du départ */
const friseDeDistance = ({ distance, semes, depart, note = '' }) => { const x1 = 1243, xi = x1 * distance / semes, xd = x1 * depart / semes;
  return `<div id="frise" data-piece="distance"><svg width="1263" height="44" viewBox="-10 -24 1263 44"><path d="M0 0H${xi}" stroke="#f3dc93" stroke-width="3"/><path d="M${xi} 0H${x1}" stroke="#c9b995" stroke-width="1.500" opacity=".8"/>
    <circle cx="0" r="6" fill="#b9412c" stroke="#150d04" stroke-width="1.500"/><circle cx="${x1}" r="5" fill="#f3dc93" stroke="#150d04" stroke-width="1.500"/><circle cx="${xd}" r="3" fill="#c9b995"/>
    <path d="M${xi - 5} -13h10l-5 7z" fill="#e9dcc0"/>
    <g font-family="Fell SC" font-size="11" letter-spacing="1.200" fill="#c9b995"><text x="-6" y="17">Rattrapés · 0</text><text x="${xd}" y="17" text-anchor="middle">Départ · ${depart}</text><text x="${x1 + 6}" y="17" text-anchor="end">Semés · ${semes}</text></g></svg>
    <div class="reste rubrique ombre">Distance <b class="gothique">${distance}</b>${note}</div></div>`; };
/* le panneau de la poursuite : qui poursuit, la Distance en jauge, ce qui la clôt */
const laPoursuite = (id, poursuivant, distance, semes, lignes, pied = '') => `<div id="${id}" class="cadre bois bord poursuite" data-piece="la poursuite"><div class="fond bois">
  ${ligne('Poursuivant', poursuivant)}
  ${ligne('Distance', `<span class="chiffres">${distance} / ${semes}</span>`)}${jauge(distance / semes, { teinte: 'or', taille: 'forte' })}
  ${lignes.map(([a, b]) => ligne(a, b)).join('\n  ')}${pied}
</div>${ruban('La poursuite')}${ferrures}</div>`;
/* un arrêt à trancher, dans le bandeau du bas : qui décide, une carte par voie, la plaque qui commet la carte choisie */
const decision = (titre, qui, sous, cartes, commet) => bandeauDuJet(titre, 'debut destin', `
  <div class="camp">${portrait(qui.id, { taille: 'grand' })}<div><div class="n gothique">${qui.nom}</div><div class="c rubrique">${sous}</div></div></div>
  ${cartes}`, commet);
const pieces = [];
if (ETAT.startsWith('poursuite-terrestre')) {
  const RATTRAPES = ETAT === 'poursuite-terrestre-rattrapes';
  const DISTANCE = RATTRAPES ? 0 : 4, SEMES = 10;
  const coureurs = (x0, n, pas, lance) => Array.from({ length: n }, (_, k) => D.marcheur(x0 + k * pas, 566 + (k % 2) * 8, 1.05, lance)).join('');
  poser(interieur(D.route({ lanterne: false })).replace(D.cavalier(610, 656, 0.9), '').replace(D.diligence(860, 648, 1, false), ''));
  poser(`${coureurs(RATTRAPES ? 760 : 420, 3, 46, true)}${coureurs(900, 4, 52, false)}`);
  fermer();
  pieces.push(titre({ icone: 'botte', nom: 'Poursuite', sous: RATTRAPES ? 'Rattrapés !' : 'Manche 2', largeur: 452 }));
  pieces.push(recit(RATTRAPES ? 'Poursuite — rattrapés !' : 'Poursuite — manche 2', RATTRAPES
    ? 'Manche 2 : les poursuivants gagnent du terrain (−4 → Distance 0/10). Aldric, à bout de souffle, traîne derrière les autres.'
    : 'Le groupe prend la fuite. Trois Brigands dévalent le chemin derrière lui, leurs torches dansent entre les troncs.'));
  pieces.push(laPoursuite('bord', '3 Brigands', DISTANCE, SEMES, [['Test de Mouvement', 'Athlétisme'], ['Distance 0', 'rattrapés'], ['Distance 10', 'semés']],
    `${filet()}${plaque('Abandonner la fuite')}`));
  if (RATTRAPES) {
    pieces.push(decision('Rattrapés — que fait le groupe ?', heros('bjorn'), 'décide pour le groupe', `
  ${carte('Abandonner Aldric', 'Laissé derrière, il ralentit<br>les poursuivants', { portrait: portrait('aldric'), classe: 'funeste' })}
  ${carte('S’arrêter et les affronter', 'Le groupe fait face aux poursuivants', { armee: true })}`,
    plaque('Faire face', { armee: true })));
  } else {
    pieces.push(friseDeDistance({ distance: DISTANCE, semes: SEMES, depart: 4 }));
    pieces.push(billet({ x: 706, y: 232, largeur: 604, pointe: 86, nom: 'Poursuite — manche 2', qui: 'Test de Mouvement', lignes: [
      ['Bjorn · Athlétisme ≤ 45', 'à lancer'],
      ['<b class="courant">Mira · Athlétisme ≤ 52</b>', '<b class="courant">à lancer · Mouvement 5 : +1 DR</b>'],
      ['Aldric · Athlétisme ≤ 31', 'à lancer'],
      ['Greta Hartmann · Athlétisme ≤ 40', 'à lancer'],
      ['3 Brigands · Athlétisme ≤ 35', 'à la clôture'],
      ['Le DR le plus bas du groupe contre le plus haut des Brigands', '± Distance']], pied: `<div class="gestes">${avantLeDe({ heros: heros('mira') })}${plaque('Tout lancer')}</div>` }));
    const court = { icone: 'botte', texte: 'court : Athlétisme' };
    pieces.push(bandeau({ bjorn: court, mira: { ...court, choisi: true }, aldric: court, greta: court }));
  }
} else {
  const SOMMATION = ETAT === 'course-poursuite-en-mer-sommation', TRIBUT = ETAT === 'course-poursuite-en-mer-tribut';
  const A_LANCER = ETAT === 'course-poursuite-en-mer-test', TOMBE = ETAT === 'course-poursuite-en-mer-test-tombe';
  const ARRET = SOMMATION || TRIBUT, AU_TEST = A_LANCER || TOMBE;
  poser(interieur(D.mer({ teinte: 'jour', navire: false })));
  poser(`${D.cogue(300, 508, .4, { coque: '#0b0a0e', voile: '#17151b', pavillon: '#0b0a0e' })}<path d="M180 518q120 12 250 0" stroke="#e6ecea" stroke-width="1.500" fill="none" opacity=".5"/>
  ${D.cogue(850, 540, .86, {})}<path d="M592 559q258 26 550 0" stroke="#e6ecea" stroke-width="2.500" fill="none" opacity=".6"/>
  <path d="M0 780V690q200 -40 420 0t440 0 420 0 427 0V780z" fill="#07111a"/>`);
  fermer();
  const DISTANCE = AU_TEST ? 50 : 51, SEMES = 100;
  pieces.push(temps({ teinte: 'jour', jour: 'Wellentag', date: '21 Sigmarzeit · 3ᵉ jour en mer', meteo: 'Temps dégagé, bon vent', icone: 'soleil' }));
  pieces.push(carteDuTrajet({ titre: 'La mer des Griffes', de: 'Salzenmund', vers: 'Erengrad', part: .3, eau: 'mer' }));
  const ROLES = {
    bjorn: { icone: 'cordage', texte: 'Mousse : borde la toile avec les marins' },
    mira: { icone: 'barre', texte: 'Timonier : serre le vent au plus près' },
    aldric: { icone: 'etoile', texte: 'Navigateur : coupe par les hauts-fonds' },
    greta: { icone: 'couronne', texte: 'Capitaine : presse l’équipage à la manœuvre' },
  };
  if (ARRET) {
    pieces.push(recit('En mer · Cogue pirate', SOMMATION
      ? 'Cogue pirate. Une cogue avec un équipage de 25 personnes et 6 grands canons apparaît à l’horizon.'
      : 'Les forbans fouillent la cale et emportent 12 Enc de cargaison (100 %).'));
    pieces.push(`<div id="navire" class="cadre bois bord" data-piece="la cale"><div class="fond bois">
  ${ligne('Navire hostile', 'Cogue pirate')}
  ${ligne('Équipage', '25 forbans')}
  ${ligne('Cargaison en cale', SOMMATION ? '12 Enc' : 'pillée')}
  ${ligne('Pillage, si soumission', '100 % · valeur maison')}
</div>${ruban('La sommation')}${ferrures}</div>`);
    pieces.push(SOMMATION
      ? decision('Cogue pirate', heros('bjorn'), 'décide pour le bord', `
  ${carte('Prendre la fuite', 'Course-poursuite :<br>distancer la cogue', { armee: true })}
  ${carte('Combattre', 'Refuser l’abordage et se défendre<br>Abordage immédiat')}
  ${carte('Se soumettre', 'La cale fouillée, 100 % pillée<br>puis un tribut à Stromfels')}`,
      plaque('Prendre la fuite', { armee: true, classe: 'large' }))
      : decision('Un prisonnier à sacrifier à Stromfels', heros('bjorn'), 'décide pour le bord', `
  ${carte('Livrer un membre d’équipage', 'Un marin est emmené<br>L’équipage est ébranlé : Moral −2d10', { armee: true })}
  ${carte('Refuser', 'Les forbans passent à l’abordage')}`,
      plaque('Livrer un membre d’équipage', { armee: true, classe: 'longue' })));
  } else {
    pieces.push(recit('En mer · Course-poursuite', `Une voile noire grossit dans le sillage : la Cogue pirate a pris la chasse. ${AU_TEST ? 'L’équipage court à ses postes.' : 'L’équipage borde la toile, le navire creuse l’écart.'}`));
    pieces.push(laPoursuite('navire', 'Cogue pirate', DISTANCE, SEMES, [['Manche du jour', AU_TEST ? 'Test d’équipage' : '<span class="chiffres">+1</span>'], ['Temps dégagé', 'semés à 100'], ['Distance 0', 'collision et abordage']]));
    pieces.push(friseDeDistance({ distance: DISTANCE, semes: SEMES, depart: 50, note: AU_TEST ? '' : ' · le navire creuse l’écart, +1' }));
    if (A_LANCER) {
      pieces.push(billet({ x: 868, y: 340, largeur: 442, pointe: 378, nom: 'Poursuite', qui: 'Test d’équipage', lignes: [
        ['Greta, Capitaine · Commandement ≤ 41', '+1 DR'],
        ['<b class="courant">Bjorn, Mousse · Voile ≤ 45</b>', '<b class="courant">compte double</b>'],
        ['Aldric, Navigateur · Orientation ≤ 38', 'à venir'],
        ['Mira, Timonier · Voile ≤ 36', 'à venir'],
        ['Somme', '+1 DR']], pied: `<div class="gestes">${avantLeDe({ heros: heros('bjorn') })}</div>` }));
      pieces.push(bandeau({ ...ROLES, bjorn: { ...ROLES.bjorn, choisi: true } }));
    } else if (TOMBE) {
      pieces.push(billet({ x: 560, y: 340, largeur: 750, pointe: 686, nom: 'Poursuite', qui: 'Test d’équipage', lignes: [
        ['Greta, Capitaine · Commandement ≤ 41', '+1 DR'],
        ['Bjorn, Mousse · Voile ≤ 45', '+2 DR, compte double : +4'],
        ['Aldric, Navigateur · Orientation ≤ 38', '+1 DR'],
        ['<b class="courant">Mira, Timonier · Voile ≤ 36 · dé 52</b>', '<b class="courant">échec · −2 DR</b>'],
        ['Somme', '+4 DR']], pied: `<div class="gestes">${apresLeDe({ heros: heros('mira'), echec: true, valider: 'Continuer' })}</div>` }));
      pieces.push(bandeau({ ...ROLES, mira: { ...ROLES.mira, choisi: true } }));
    } else {
      pieces.push(billet({ x: 1010, y: 384, pointe: 236, nom: 'Poursuite', qui: 'Test d’équipage', lignes: [['Bjorn, Mousse', '+1 DR, compte double'], ['Greta, Capitaine', '+1 DR'], ['Mira, Timonier', '+1 DR'], ['Aldric, Navigateur', '+1 DR'], ['Somme', '+5 DR']] }));
      pieces.push(bandeau(ROLES));
    }
    pieces.push(ouvrir('Postes de bord', 'cordage', 502));
  }
}
pieces.push(coins());
monter(pieces);
