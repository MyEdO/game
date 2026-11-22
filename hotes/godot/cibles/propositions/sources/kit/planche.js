/* La planche du kit (#4411) : chaque pièce de `../gestes.js`, à chaque taille et dans chaque état (repos, survol, armé,
   fermé), étiquetée de l'appel qui la pose. Une feuille par `data-etat` : boutons, plaques, portraits, marques, annonces, titres.
   Maquette hors du jeu. */
el(S, 'rect', { width: W, height: H, fill: '#120c08' });
const nom = (appel) => `<code style="display:block;margin-top:6px;font:10px/13px monospace;color:inherit;opacity:.85;white-space:nowrap">${appel}</code>`;
const piece = (appel, html, style = '') => `<figure style="margin:0;display:flex;flex-direction:column;align-items:center;${style}">${html}${nom(appel)}</figure>`;
const ligne = (...pieces) => `<div style="display:flex;flex-wrap:wrap;align-items:flex-end;gap:10px 22px;margin-bottom:12px">${pieces.join('')}</div>`;
const large = (l, html) => `<div style="width:${l}px">${html}</div>`;
const page = (id, x, y, w, h, matiere, titre, ...rangs) => cadre(id, x, y, w, h, matiere, `<div style="padding:26px 22px 0;${matiere === 'parchemin' ? 'color:var(--encre-2)' : 'color:var(--creme-2)'}">${rangs.join('')}</div>`, { ruban: titre });
const TAILLES = ['menu', 'petit', 'moyen', 'grand', 'maitre'];
const repere = (x, y, appel) => `<div style="position:absolute;left:${x}px;top:${y}px;color:var(--creme-2)">${nom(appel)}</div>`;
const marques = (matiere) => [
  ligne(piece("segments([…], 'Bois')", segments(['Fer', 'Bois', 'Cuir'], 'Bois')), piece("{ egaux: true }", segments(['1', '2', '3'], '2', { egaux: true })), piece('ouiNon(true)', ouiNon(true))),
  ligne(piece('reglette(.6)', reglette(.6)), piece('reglette(.3, null)', large(140, reglette(.3, null))), piece('rangDePas(3, 5)', rangDePas(3, 5))),
  ligne(piece('vie(8, 14)', large(140, vie(8, 14))), piece("jauge(.6, { taille: 'forte' })", large(140, jauge(.6, { taille: 'forte' }))), piece("{ teinte: 'or', ajout: .2 }", large(140, jauge(.5, { teinte: 'or', taille: 'forte', ajout: .2 })))),
  ligne(piece('filet()', large(100, filet())), piece('{ fondu: true }', large(100, filet({ fondu: true }))), piece('{ losange: true }', large(100, filet({ losange: true }))), piece(matiere === 'bois' ? '{ or: true, losange: true }' : '{ fondu, losange }', large(100, filet(matiere === 'bois' ? { or: true, losange: true } : { fondu: true, losange: true })))),
];
const FEUILLES = {
  boutons: () => [
    page('ronds', 24, 22, 1060, 234, 'bois', "rond(contenu, taille, { survol, arme, ferme })",
      ligne(...TAILLES.map((t) => piece(`rond('epee', '${t}')`, rond('epee', t)))),
      ligne(piece("rond('epee')", rond('epee')), piece('{ survol: true }', rond('epee', 'moyen', { survol: true })), piece('{ arme: true }', rond('epee', 'moyen', { arme: true })), piece('{ ferme: true }', rond('epee', 'moyen', { ferme: true })), piece("rond(2, 'petit')", rond(2, 'petit')),
        piece("moinsPlus({ entre })", moinsPlus({ entre: '<b class="chiffres">3</b>' })), piece('moinsPlus({ moins: false, entre })', moinsPlus({ moins: false, entre: '<b class="chiffres">0</b>' })))),
    page('outils', 24, 280, 1040, 146, 'bois', "outil(nom, libelle, { ouvert, ferme, taille })",
      ligne(piece("outil('carte', 'Carte')", outil('carte', 'Carte')), piece('{ ouvert: true }', outil('carte', 'Carte', { ouvert: true })), piece('{ ferme: true }', outil('carte', 'Carte', { ferme: true })), piece("{ taille: 'grand' }", outil('carte', 'Carte', { taille: 'grand' })))),
    page('medaillons', 24, 450, 1060, 130, 'bois', "medaillon(nom, { taille, ferme, inerte })",
      ligne(...['grand', 'moyen', 'petit'].map((t) => piece(`medaillon('carte', { taille: '${t}' })`, medaillon('carte', { taille: t }))), piece('{ ferme: true }', medaillon('carte', { ferme: true })), piece('{ inerte: true }', medaillon('carte', { inerte: true })))),
    croix(), repere(1110, 30, 'croix() →'),
    `<div style="position:absolute;top:300px;right:0">${ouvrir('La carte', 'carte', 1)}</div>`, repere(1088, 352, "ouvrir('La carte', 'carte', 1)"),
    retour('Quitter la planche'), repere(180, 664, "← retour('Quitter la planche')"),
    coins(), repere(1150, 560, 'coins() ↓'),
  ],
  plaques: () => [
    page('plaques', 24, 22, 1232, 380, 'bois', "plaque(libelle, { survol, armee, fermee, icone, numero, prix, taille })",
      ligne(...[['plaque(\'Attaquer\')', {}], ['{ survol: true }', { survol: true }], ['{ armee: true }', { armee: true }], ['{ fermee: true }', { fermee: true }]].map(([a, o]) => piece(a, plaque('Attaquer', o), 'width:170px')), piece("{ icone: 'epee', prix: '2/-' }", plaque('Acheter', { icone: 'epee', prix: '2/-' }), 'width:190px')),
      ligne(...[["{ taille: 'petite' }", {}], ['petite, survol', { survol: true }], ['petite, armee', { armee: true }], ['petite, fermee', { fermee: true }]].map(([a, o]) => piece(a, plaque('Réussite', { taille: 'petite', ...o }), 'width:130px')),
        piece("plaque(…, { fermee }) + raison(texte)", `<div style="position:relative;display:flex;justify-content:center;margin-top:40px">${plaque('Lancer', { fermee: true })}${raison('Plus de Chance à dépenser.')}</div>`, 'width:220px'),
        piece("onglets(noms, active)", `<div style="position:relative;width:300px;height:30px">${onglets(['État', 'Charge', 'Cargaison'], 'État')}</div>`)),
      ligne(piece("{ taille: 'appel' }", plaque('Commencer', { taille: 'appel', armee: true, icone: 'route' }), 'width:230px'), piece('{ numero: 2 }', plaque('Parlons.', { numero: 2, classe: 'gauche' }), 'width:190px'),
        ...[['carte(nom, sous, { portrait })', {}], ['{ armee: true }', { armee: true }], ['{ fermee: true }', { fermee: true }]].map(([a, o]) => piece(a, large(220, carte('Bjorn', 'Chasseur', { portrait: portrait('bjorn', { taille: 'petit' }), ...o })))))),
    page('saisies', 24, 426, 700, 270, 'parchemin', 'bourse(…) · champ(…) — parchemin',
      ligne(piece('bourse({ heros, avoir })', large(220, bourse({ heros: 'Bjorn', avoir: '14/-' }))), piece("bourse({ parts, total })", large(300, bourse({ parts: [['Bjorn', '10/-', '14/-'], ['Mira', '5/-', '9/-']], total: '15/-' })))),
      ligne(piece('{ …, reglable: false }', large(260, bourse({ parts: [['Bjorn', '10/-', '14/-']], total: '10/-', reglable: false }))), piece("champ('Nom', 'Bjorn')", champ('Nom', 'Bjorn')), piece("champ('Nom', '', { attente })", champ('Nom', '', { attente: 'Un nom…' })))),
    page('saisies-bois', 748, 426, 508, 270, 'bois', 'bourse(…) · champ(…) — bois',
      ligne(piece('bourse({ heros, avoir })', large(220, bourse({ heros: 'Bjorn', avoir: '14/-' })))),
      ligne(piece("champ('Nom', 'Bjorn')", champ('Nom', 'Bjorn')), piece("champ('', '', { attente })", champ('', '', { attente: 'Un nom…' })))),
  ],
  portraits: () => [
    page('portraits', 24, 22, 820, 330, 'bois', "portrait(genre, { camp, taille, choisi })",
      ligne(...[...TAILLES, 'affiche'].map((t) => piece(`'${t}'`, portrait('bjorn', { taille: t }))))),
    page('camps', 24, 376, 820, 320, 'bois', "camp heros · pnj · ennemi, choisi",
      ligne(piece("portrait('mira', { taille: 'grand' })", portrait('mira', { taille: 'grand' })), piece('{ choisi: true }', portrait('mira', { taille: 'grand', choisi: true })), piece("portrait('hote') → camp 'pnj'", portrait('hote', { taille: 'grand' })),
        piece("{ camp: 'pnj', choisi }", portrait('hote', { taille: 'grand', choisi: true })), piece("{ camp: 'ennemi' }", portrait('orc', { camp: 'ennemi', taille: 'grand' })), piece('ennemi, choisi', portrait('orc', { camp: 'ennemi', taille: 'grand', choisi: true })),
        piece("portrait('esquisse')", portrait('esquisse', { taille: 'grand' })), piece('portrait(null) : place libre', portrait(null, { taille: 'grand' })))),
    page('rangs', 868, 376, 388, 320, 'bois', 'rang(genre, …) · cartouche(…)',
      ligne(piece("rang('mira', { nom, sous })", rang('mira', { nom: 'Mira', sous: 'Éclaireuse' })), piece('{ gothique: true, taille }', rang('orc', { camp: 'ennemi', nom: 'Orc', gothique: true, taille: 'grand' }))),
      ligne(piece('cartouche({ icone, nom, sous })', cartouche({ icone: 'chope', nom: 'Odelina Landau', sous: 'L’aubergiste' })))),
    page('pictos', 868, 22, 388, 330, 'bois', "picto(nom, taille, couleur)",
      ligne(piece("picto('epee', 16)", picto('epee', 16)), piece("picto('epee')", picto('epee')), piece("picto('epee', 32)", picto('epee', 32))),
      ligne(piece("picto('carte', 22, 'var(--cire)')", picto('carte', 22, 'var(--cire)')))),
  ],
  marques: () => [
    page('disques', 24, 22, 440, 200, 'bois', 'disque(n, { taille, vide }) · compteur(n, libelle)',
      ligne(...['grand', 'moyen', 'petit'].map((t) => piece(`'${t}'`, disque(3, { taille: t }))), piece('{ vide: true }', disque(0, { vide: true }))),
      ligne(piece("compteur(2, 'Destin')", compteur(2, 'Destin')))),
    page('sceaux', 24, 246, 440, 450, 'bois', 'sceau(contenu, taille, { etat, de })',
      ligne(...TAILLES.map((t) => piece(`'${t}'`, sceau('goutte', t)))),
      ligne(piece("sceau(7, 'grand')", sceau(7, 'grand')), piece("'reussite'", sceau(7, 'grand', { etat: 'reussite' })), piece("'vide'", sceau('', 'grand', { etat: 'vide' }))),
      ligne(piece("sceau(4, 'maitre', { de: 'd10' })", sceau(4, 'maitre', { de: 'd10' })))),
    page('marques-bois', 488, 22, 768, 236, 'bois', 'Marques · bois', ...marques('bois')),
    page('marques-parchemin', 488, 282, 768, 236, 'parchemin', 'Marques · parchemin', ...marques('parchemin')),
    cadre('clous', 488, 542, 240, 154, 'bois', `<div style="padding:48px 14px 0;color:var(--creme-2)">${nom('{ ruban, tete: clouer() }')}</div>`, { ruban: 'ruban(libelle)', tete: clouer() }),
    cadre('quarts', 752, 542, 240, 154, 'parchemin', `<div style="padding:48px 14px 0;color:var(--encre-2)">${nom('cadre(…, { tete: clouer(4) })')}</div>`, { tete: clouer(4) }),
    cadre('rubans', 1016, 542, 240, 154, 'bois', `<div style="position:relative;height:100%;color:var(--creme-2)">${ruban('Rubrique', { style: 'top:36px' })}<div style="position:absolute;left:14px;top:72px">${nom("ruban('Rubrique')")}</div></div>`),
  ],
  /* les pièces d'un écran de gestion et d'une issue : leur place est celle de leur gabarit (`../../dispositions.md`) */
  annonces: () => [
    cartouche({ icone: 'carte', nom: 'La planche', sous: "cartouche({ …, taille: 'titre' })", taille: 'titre' }),
    croix(),
    signets([{ nom: 'Tests', compte: 11 }, { nom: 'Combat', compte: 22, marque: true }, { nom: 'Destin & Résistance', compte: 1 }, { nom: 'Voyage', compte: 32, marque: true }], 'Combat'),
    repere(1096, 262, "signets(sections, 'Combat')"),
    issue('Victoire', { action: 'Continuer' }), repere(364, 430, "issue('Victoire', { action })"),
    `<div style="position:absolute;left:364px;top:500px">${rond('epee')}</div>`,
    apercu({ nom: 'Orc', sous: 'Cible', vers: 'gauche', style: 'left:420px;top:480px;--pointe:30px', corps: `<p style="margin:4px 0 0;font-style:italic;font-size:13px;line-height:17px">300 de large, la pointe vers ce qu’on survole, à 12 de lui.</p>${nom("apercu({ nom, sous, corps, vers: 'gauche' })")}` }),
    `<div class="action-de-coin" data-piece="action de coin">${plaque('Continuer', { armee: true })}${plaque('Plus tard')}</div>`, repere(1120, 576, 'action de coin ↓'),
  ],
};
/* les titres (#4585) : le cartouche de titre, le ruban, le titre de panneau, l'intertitre et le filet posé au-dessus de
   lui, sur bois et sur parchemin */
const titres = () => [
  ligne(piece("titre({ texte })", titre({ texte: 'Un héritage à Bögenhafen' }))),
  ligne(piece("rubrique({ texte, note })", rubrique({ texte: 'Compétences de carrière', note: 'une Augmentation à la fois' })),
    piece("filet() + rubrique({ texte })", large(220, `${filet()}${rubrique({ texte: 'Lots en cale' })}`))),
];
FEUILLES.titres = () => [
  cartouche({ icone: 'carte', nom: 'Carnet d’enquête', sous: "cartouche({ …, taille: 'titre' })", taille: 'titre' }),
  `<div class="bois" style="position:absolute;left:420px;top:34px;padding:12px 16px">${titre({ texte: 'Compendium', ecran: true })}${nom("titre({ texte, ecran: true })")}</div>`,
  page('titres-bois', 24, 160, 600, 250, 'bois', "ruban(libelle) · bois", ...titres()),
  page('titres-parchemin', 656, 160, 600, 250, 'parchemin', "ruban(libelle) · parchemin", ...titres()),
];
monter(FEUILLES[document.getElementById('ecran').dataset.etat]());
