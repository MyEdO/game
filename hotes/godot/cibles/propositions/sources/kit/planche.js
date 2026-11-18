/* La planche du kit (#4411) : chaque pièce de `../gestes.js`, à chaque taille et dans chaque état (repos, survol, armé,
   fermé), étiquetée de l'appel qui la pose. Une feuille par `data-etat` : boutons, plaques, portraits, marques.
   Maquette hors du jeu. */
el(S, 'rect', { width: W, height: H, fill: '#120c08' });
const nom = (appel) => `<code style="display:block;margin-top:6px;font:10px/13px monospace;color:inherit;opacity:.85;white-space:nowrap">${appel}</code>`;
const piece = (appel, html, style = '') => `<figure style="margin:0;display:flex;flex-direction:column;align-items:center;${style}">${html}${nom(appel)}</figure>`;
const rang = (...pieces) => `<div style="display:flex;flex-wrap:wrap;align-items:flex-end;gap:14px 22px;margin-bottom:20px">${pieces.join('')}</div>`;
const large = (l, html) => `<div style="width:${l}px">${html}</div>`;
const page = (id, x, y, w, h, matiere, titre, ...rangs) => cadre(id, x, y, w, h, matiere, `<div style="padding:26px 22px 0;${matiere === 'parchemin' ? 'color:var(--encre-2)' : 'color:var(--creme-2)'}">${rangs.join('')}</div>`, { ruban: titre });
const TAILLES = ['menu', 'petit', 'moyen', 'grand', 'maitre'];
const repere = (x, y, appel) => `<div style="position:absolute;left:${x}px;top:${y}px;color:var(--creme-2)">${nom(appel)}</div>`;
const marques = (matiere) => [
  rang(piece("segments(['Fer', 'Bois', 'Cuir'], 'Bois')", segments(['Fer', 'Bois', 'Cuir'], 'Bois')), piece("{ egaux: true }", segments(['1', '2', '3'], '2', { egaux: true })), piece('ouiNon(true)', ouiNon(true))),
  rang(piece('reglette(.6)', reglette(.6)), piece('reglette(.3, null)', large(140, reglette(.3, null))), piece('rangDePas(3, 5)', rangDePas(3, 5))),
  rang(piece('vie(8, 14)', large(140, vie(8, 14))), piece("jauge(.6, { taille: 'forte' })", large(140, jauge(.6, { taille: 'forte' }))), piece("{ teinte: 'or', ajout: .2 }", large(140, jauge(.5, { teinte: 'or', taille: 'forte', ajout: .2 })))),
  rang(piece('filet()', large(100, filet())), piece('{ fondu: true }', large(100, filet({ fondu: true }))), piece('{ losange: true }', large(100, filet({ losange: true }))), piece(matiere === 'bois' ? '{ or: true, losange: true }' : '{ fondu, losange }', large(100, filet(matiere === 'bois' ? { or: true, losange: true } : { fondu: true, losange: true })))),
];
const FEUILLES = {
  boutons: () => [
    page('ronds', 24, 22, 1060, 270, 'bois', "rond(nom, taille, { survol, arme, ferme })",
      rang(...TAILLES.map((t) => piece(`rond('epee', '${t}')`, rond('epee', t)))),
      rang(piece("rond('epee')", rond('epee')), piece('{ survol: true }', rond('epee', 'moyen', { survol: true })), piece('{ arme: true }', rond('epee', 'moyen', { arme: true })), piece('{ ferme: true }', rond('epee', 'moyen', { ferme: true })),
        piece("moinsPlus({ entre })", moinsPlus({ entre: '<b class="chiffres">3</b>' })), piece('moinsPlus({ moins: false, entre })', moinsPlus({ moins: false, entre: '<b class="chiffres">0</b>' })))),
    page('outils', 24, 326, 1060, 150, 'bois', "outil(nom, libelle, { ouvert, ferme, taille })",
      rang(piece("outil('carte', 'Carte')", outil('carte', 'Carte')), piece('{ ouvert: true }', outil('carte', 'Carte', { ouvert: true })), piece('{ ferme: true }', outil('carte', 'Carte', { ferme: true })), piece("{ taille: 'grand' }", outil('carte', 'Carte', { taille: 'grand' })))),
    page('medaillons', 24, 510, 1060, 150, 'bois', "medaillon(nom, { taille, ferme, inerte })",
      rang(...['grand', 'moyen', 'petit'].map((t) => piece(`medaillon('carte', { taille: '${t}' })`, medaillon('carte', { taille: t }))), piece('{ ferme: true }', medaillon('carte', { ferme: true })), piece('{ inerte: true }', medaillon('carte', { inerte: true })))),
    croix(), ouvrir('La carte', 'carte', 300), repere(1520, 76, 'croix()'), repere(1500, 352, "ouvrir('La carte', 'carte', 300)"),
    retour('Quitter la planche'), repere(270, 740, "retour('Quitter la planche') ←"),
    coins(), repere(1560, 600, 'coins()'),
  ],
  plaques: () => [
    page('plaques', 24, 22, 1100, 420, 'bois', "plaque(libelle, { survol, armee, fermee, icone, prix, taille })",
      rang(...[['plaque(\'Attaquer\')', {}], ['{ survol: true }', { survol: true }], ['{ armee: true }', { armee: true }], ['{ fermee: true }', { fermee: true }]].map(([a, o]) => piece(a, plaque('Attaquer', o), 'width:170px')), piece("{ icone: 'epee', prix: '2/-' }", plaque('Acheter', { icone: 'epee', prix: '2/-' }), 'width:190px')),
      rang(...[["{ taille: 'petite' }", {}], ['petite, survol', { survol: true }], ['petite, armee', { armee: true }], ['petite, fermee', { fermee: true }]].map(([a, o]) => piece(a, plaque('Réussite', { taille: 'petite', ...o }), 'width:140px')),
        piece("plaque(…, { fermee }) + raison(texte)", `<div style="position:relative;display:flex;justify-content:center;margin-top:40px">${plaque('Lancer', { fermee: true })}${raison('Plus de Chance à dépenser.')}</div>`, 'width:220px')),
      rang(...[['carte(nom, sous, { portrait })', {}], ['{ armee: true }', { armee: true }], ['{ fermee: true }', { fermee: true }]].map(([a, o]) => piece(a, carte('Bjorn', 'Chasseur', { portrait: portrait('bjorn', { taille: 'petit' }), ...o }), 'width:220px')))),
    page('saisies', 24, 476, 1100, 280, 'parchemin', 'bourse(…) · champ(…) — parchemin',
      rang(piece('bourse({ heros, avoir })', large(220, bourse({ heros: 'Bjorn', avoir: '14/-' }))), piece("bourse({ parts, total })", large(300, bourse({ parts: [['Bjorn', '10/-', '14/-'], ['Mira', '5/-', '9/-']], total: '15/-' }))), piece('{ …, reglable: false }', large(260, bourse({ parts: [['Bjorn', '10/-', '14/-']], total: '10/-', reglable: false })))),
      rang(piece("champ('Nom', 'Bjorn')", champ('Nom', 'Bjorn')), piece("champ('Nom', '', { attente })", champ('Nom', '', { attente: 'Un nom…' })))),
    page('saisies-bois', 1150, 22, 532, 300, 'bois', 'bourse(…) · champ(…) — bois',
      rang(piece('bourse({ heros, avoir })', large(220, bourse({ heros: 'Bjorn', avoir: '14/-' })))),
      rang(piece("champ('Nom', 'Bjorn')", champ('Nom', 'Bjorn')), piece("champ('', '', { attente })", champ('', '', { attente: 'Un nom…' })))),
  ],
  portraits: () => [
    page('portraits', 24, 22, 1300, 410, 'bois', "portrait(genre, { camp, taille, choisi })",
      rang(...[...TAILLES, 'affiche'].map((t) => piece(`{ taille: '${t}' }`, portrait('bjorn', { taille: t }))))),
    page('camps', 24, 466, 1300, 290, 'bois', "camp heros · pnj · ennemi, choisi",
      rang(piece("portrait('mira', { taille: 'grand' })", portrait('mira', { taille: 'grand' })), piece('{ choisi: true }', portrait('mira', { taille: 'grand', choisi: true })), piece("portrait('hote') → camp 'pnj'", portrait('hote', { taille: 'grand' })),
        piece("{ camp: 'pnj', choisi }", portrait('hote', { taille: 'grand', choisi: true })), piece("{ camp: 'ennemi' }", portrait('orc', { camp: 'ennemi', taille: 'grand' })), piece('ennemi, choisi', portrait('orc', { camp: 'ennemi', taille: 'grand', choisi: true })))),
    page('pictos', 1350, 22, 332, 410, 'bois', "picto(nom, taille, couleur)",
      rang(piece("picto('epee', 16)", picto('epee', 16)), piece("picto('epee')", picto('epee')), piece("picto('epee', 32)", picto('epee', 32))),
      rang(piece("picto('carte', 22, 'var(--cire)')", picto('carte', 22, 'var(--cire)')))),
  ],
  marques: () => [
    titre({ icone: 'carte', nom: 'La planche', sous: 'titre({ icone, nom, sous, largeur })', largeur: 420 }),
    page('disques', 24, 140, 640, 250, 'bois', "disque(n, { taille, vide }) · compteur(n, libelle)",
      rang(...['grand', 'moyen', 'petit'].map((t) => piece(`disque(3, { taille: '${t}' })`, disque(3, { taille: t }))), piece('{ vide: true }', disque(0, { vide: true }))),
      rang(piece("compteur(2, 'Destin')", compteur(2, 'Destin')))),
    page('sceaux', 24, 424, 640, 332, 'bois', "sceau(contenu, taille, { etat })",
      rang(...TAILLES.map((t, k) => piece(k ? `'${t}'` : `sceau('goutte', '${t}')`, sceau('goutte', t)))),
      rang(piece("sceau(7, 'grand')", sceau(7, 'grand')), piece("{ etat: 'reussite' }", sceau(7, 'grand', { etat: 'reussite' })), piece("{ etat: 'vide' }", sceau('', 'grand', { etat: 'vide' })))),
    page('marques-bois', 690, 22, 610, 360, 'bois', 'Marques · bois', ...marques('bois')),
    page('marques-parchemin', 690, 406, 610, 350, 'parchemin', 'Marques · parchemin', ...marques('parchemin')),
    cadre('clous', 1326, 22, 356, 140, 'bois', `<div style="padding:48px 16px 0;color:var(--creme-2)">${nom('cadre(…, { ruban, tete: clouer() })')}</div>`, { ruban: "ruban(t, { gothique: true })", tete: clouer() }),
    cadre('quarts', 1326, 196, 356, 120, 'parchemin', `<div style="padding:40px 16px 0;color:var(--encre-2)">${nom("cadre(…, { tete: clouer('quarts') })")}</div>`, { tete: clouer('quarts') }),
    cadre('rubans', 1326, 350, 356, 120, 'bois', `<div style="position:relative;height:100%;color:var(--creme-2)">${ruban('Rubrique', { style: 'top:36px' })}<div style="position:absolute;left:16px;top:66px">${nom("ruban('Rubrique')")}</div></div>`),
  ],
};
monter(FEUILLES[document.getElementById('ecran').dataset.etat]());
