/* La planche du kit (#4411) : chaque pièce de `../gestes.js`, à chaque taille et dans chaque état (repos, survol, armé,
   fermé), étiquetée de l'appel qui la pose. Une feuille par `data-etat` : boutons, plaques, portraits, marques, annonces, titres,
   textes, listes.
   Maquette hors du jeu. */
el(S, 'rect', { width: W, height: H, fill: '#120c08' });
const appel = (texte) => `<code style="display:block;margin-top:6px;font:10px/13px monospace;color:inherit;opacity:.85;white-space:nowrap">${texte}</code>`;
const piece = (libelle, html, style = '') => `<figure style="margin:0;display:flex;flex-direction:column;align-items:center;${style}">${html}${appel(libelle)}</figure>`;
const suite = (...pieces) => `<div style="display:flex;flex-wrap:wrap;align-items:flex-end;gap:10px 22px;margin-bottom:12px">${pieces.join('')}</div>`;
const large = (l, html) => `<div style="width:${l}px">${html}</div>`;
const page = (id, x, y, w, h, matiere, titre, ...rangs) => cadre(id, x, y, w, h, matiere, `<div style="padding:26px 22px 0;${matiere === 'parchemin' ? 'color:var(--encre-2)' : 'color:var(--creme-2)'}">${rangs.join('')}</div>`, { ruban: titre });
const TAILLES = ['menu', 'petit', 'moyen', 'grand', 'maitre'];
const repere = (x, y, libelle) => `<div style="position:absolute;left:${x}px;top:${y}px;color:var(--creme-2)">${appel(libelle)}</div>`;
const marques = (matiere) => [
  suite(piece("segments([…], 'Bois')", segments(['Fer', 'Bois', 'Cuir'], 'Bois')), piece("{ egaux: true }", segments(['1', '2', '3'], '2', { egaux: true })), piece('ouiNon(true)', ouiNon(true))),
  suite(piece('reglette(.6)', reglette(.6)), piece('reglette(.3, null)', large(140, reglette(.3, null))), piece('rangDePas({ pleins: 3, total: 5 })', rangDePas({ pleins: 3, total: 5 })), piece("{ forme: 'clous' }", rangDePas({ pleins: 6, total: 8, forme: 'clous' }))),
  suite(piece('vie(8, 14)', large(140, vie(8, 14))), piece("jauge(.6, { taille: 'forte' })", large(140, jauge(.6, { taille: 'forte' }))), piece("{ teinte: 'or', ajout: .2 }", large(140, jauge(.5, { teinte: 'or', taille: 'forte', ajout: .2 })))),
  suite(piece('filet()', large(100, filet())), piece('{ fondu: true }', large(100, filet({ fondu: true }))), piece('{ losange: true }', large(100, filet({ losange: true }))), piece(matiere === 'bois' ? '{ or: true, losange: true }' : '{ fondu, losange }', large(100, filet(matiere === 'bois' ? { or: true, losange: true } : { fondu: true, losange: true })))),
];
const FEUILLES = {
  boutons: () => [
    page('ronds', 24, 22, 1060, 234, 'bois', "rond(contenu, taille, { survol, arme, ferme })",
      suite(...TAILLES.map((t) => piece(`rond('epee', '${t}')`, rond('epee', t)))),
      suite(piece("rond('epee')", rond('epee')), piece('{ survol: true }', rond('epee', 'moyen', { survol: true })), piece('{ arme: true }', rond('epee', 'moyen', { arme: true })), piece('{ ferme: true }', rond('epee', 'moyen', { ferme: true })), piece("rond(2, 'petit')", rond(2, 'petit')),
        piece("moinsPlus({ entre })", moinsPlus({ entre: '<b class="chiffres">3</b>' })), piece('moinsPlus({ moins: false, entre })', moinsPlus({ moins: false, entre: '<b class="chiffres">0</b>' })))),
    page('outils', 24, 280, 1040, 146, 'bois', "outil(nom, libelle, { ouvert, ferme, taille })",
      suite(piece("outil('carte', 'Carte')", outil('carte', 'Carte')), piece('{ ouvert: true }', outil('carte', 'Carte', { ouvert: true })), piece('{ ferme: true }', outil('carte', 'Carte', { ferme: true })), piece("{ taille: 'grand' }", outil('carte', 'Carte', { taille: 'grand' })))),
    page('medaillons', 24, 450, 1060, 130, 'bois', "medaillon(nom, { taille, ferme, inerte, vise })",
      suite(...['grand', 'moyen', 'petit'].map((t) => piece(t === 'grand' ? "medaillon('carte')" : `{ taille: '${t}' }`, medaillon('carte', { taille: t }))), piece('{ vise: true }', medaillon('carte', { vise: true })), piece('{ ferme: true }', medaillon('carte', { ferme: true })), piece('{ inerte: true }', medaillon('carte', { inerte: true })))),
    croix(), repere(1110, 30, 'croix() →'),
    `<div style="position:absolute;top:300px;right:0">${ouvrir('La carte', 'carte', 1)}</div>`, repere(1088, 352, "ouvrir('La carte', 'carte', 1)"),
    retour('Quitter la planche'), repere(180, 664, "← retour('Quitter la planche')"),
    coins(), repere(1150, 560, 'coins() ↓'),
  ],
  plaques: () => [
    page('plaques', 24, 22, 1232, 380, 'bois', "plaque(libelle, { survol, armee, fermee, icone, numero, prix, taille })",
      suite(...[['plaque(\'Attaquer\')', {}], ['{ survol: true }', { survol: true }], ['{ armee: true }', { armee: true }], ['{ fermee: true }', { fermee: true }]].map(([a, o]) => piece(a, plaque('Attaquer', o), 'width:140px')), piece("{ icone: 'epee', prix: '2/-' }", plaque('Acheter', { icone: 'epee', prix: '2/-' }), 'width:190px'),
        piece("{ taille: 'geste' }", large(96, plaque('Utiliser une compétence', { taille: 'geste' })), 'width:120px'), piece("{ prix: '25 PX' }", plaque('', { prix: '<span class="chiffres">25 PX</span>', taille: 'petite' }), 'width:110px')),
      suite(...[["{ taille: 'petite' }", {}], ['petite, survol', { survol: true }], ['petite, armee', { armee: true }], ['petite, fermee', { fermee: true }]].map(([a, o]) => piece(a, plaque('Réussite', { taille: 'petite', ...o }), 'width:130px')),
        piece("plaque(…, { fermee }) + raison(texte)", `<div style="position:relative;display:flex;justify-content:center;margin-top:40px">${plaque('Lancer', { fermee: true })}${raison('Plus de Chance à dépenser.')}</div>`, 'width:220px'),
        piece("onglets(noms, active)", `<div style="position:relative;width:300px;height:30px">${onglets(['État', 'Charge', 'Cargaison'], 'État')}</div>`)),
      suite(piece("{ taille: 'appel' }", plaque('Commencer', { taille: 'appel', armee: true, icone: 'route' }), 'width:230px'), piece('{ numero: 2 }', plaque('Parlons.', { numero: 2, classe: 'gauche' }), 'width:190px'),
        ...[['carte(nom, sous, { portrait })', {}], ['{ armee, marque }', { armee: true, marque: 'Action et Mouvement' }], ['{ fermee: true }', { fermee: true }]].map(([a, o]) => piece(a, large(220, carte('Bjorn', 'Chasseur', { portrait: portrait('bjorn', { taille: 'petit' }), ...o })))))),
    page('saisies', 24, 426, 700, 270, 'parchemin', 'bourse(…) · champ(…) — parchemin',
      suite(piece('bourse({ heros, avoir })', large(220, bourse({ heros: 'Bjorn', avoir: '14/-' }))), piece("bourse({ parts, total })", large(300, bourse({ parts: [['Bjorn', '10/-', '14/-'], ['Mira', '5/-', '9/-']], total: '15/-' })))),
      suite(piece('{ …, reglable: false }', large(260, bourse({ parts: [['Bjorn', '10/-', '14/-']], total: '10/-', reglable: false }))), piece("champ('Nom', 'Bjorn')", champ('Nom', 'Bjorn')), piece("champ('Nom', '', { attente })", champ('Nom', '', { attente: 'Un nom…' })))),
    page('saisies-bois', 748, 426, 508, 270, 'bois', 'bourse(…) · champ(…) — bois',
      suite(piece('bourse({ heros, avoir })', large(220, bourse({ heros: 'Bjorn', avoir: '14/-' })))),
      suite(piece("champ('Nom', 'Bjorn')", champ('Nom', 'Bjorn')), piece("champ('', '', { attente })", champ('', '', { attente: 'Un nom…' })))),
  ],
  portraits: () => [
    page('portraits', 24, 22, 820, 330, 'bois', "portrait(genre, { camp, taille, choisi })",
      suite(...[...TAILLES, 'affiche'].map((t) => piece(`'${t}'`, portrait('bjorn', { taille: t }))))),
    page('camps', 24, 376, 820, 320, 'bois', "camp heros · pnj · ennemi, choisi",
      suite(piece("portrait('mira', { taille: 'grand' })", portrait('mira', { taille: 'grand' })), piece('{ choisi: true }', portrait('mira', { taille: 'grand', choisi: true })), piece("portrait('hote') → camp 'pnj'", portrait('hote', { taille: 'grand' })),
        piece("{ camp: 'pnj', choisi }", portrait('hote', { taille: 'grand', choisi: true })), piece("{ camp: 'ennemi' }", portrait('orc', { camp: 'ennemi', taille: 'grand' })), piece('ennemi, choisi', portrait('orc', { camp: 'ennemi', taille: 'grand', choisi: true })),
        piece("portrait('esquisse')", portrait('esquisse', { taille: 'grand' })), piece('portrait(null) : place libre', portrait(null, { taille: 'grand' })))),
    page('rangs', 868, 376, 388, 320, 'bois', 'rang(genre, …) · cartouche(…)',
      suite(piece("rang('mira', { nom, sous })", rang('mira', { nom: 'Mira', sous: 'Éclaireuse' })), piece("{ gothique: 'moyen', taille }", rang('orc', { camp: 'ennemi', nom: 'Orc', gothique: 'moyen', taille: 'grand' }))),
      suite(piece('cartouche({ icone, nom, sous })', cartouche({ icone: 'chope', nom: 'Odelina Landau', sous: 'L’aubergiste' })))),
    page('pictos', 868, 22, 388, 330, 'bois', "picto(nom, taille, couleur)",
      suite(piece("picto('epee', 16)", picto('epee', 16)), piece("picto('epee')", picto('epee')), piece("picto('epee', 32)", picto('epee', 32))),
      suite(piece("picto('carte', 22, 'var(--cire)')", picto('carte', 22, 'var(--cire)')))),
  ],
  marques: () => [
    page('disques', 24, 22, 440, 200, 'bois', 'disque(n, { taille, vide }) · reserves(jetons, taille)',
      suite(...['grand', 'moyen', 'petit'].map((t) => piece(`'${t}'`, disque(3, { taille: t }))), piece('{ vide: true }', disque(0, { vide: true }))),
      suite(piece("reserves([{ valeur: 2, icone, nom: 'Destin' }], 'grand')", reserves([{ valeur: 2, icone: picto('noeud', 20, undefined, 1.8), nom: 'Destin' }], 'grand')))),
    page('sceaux', 24, 246, 440, 450, 'bois', 'sceau(contenu, taille, { etat, de })',
      suite(...TAILLES.map((t) => piece(`'${t}'`, sceau('goutte', t)))),
      suite(piece("sceau(7, 'grand')", sceau(7, 'grand')), piece("'reussite'", sceau(7, 'grand', { etat: 'reussite' })), piece("'vide'", sceau('', 'grand', { etat: 'vide' }))),
      suite(piece("sceau(4, 'maitre', { de: 'd10' })", sceau(4, 'maitre', { de: 'd10' })))),
    page('marques-bois', 488, 22, 768, 236, 'bois', 'Marques · bois', ...marques('bois')),
    page('marques-parchemin', 488, 282, 768, 236, 'parchemin', 'Marques · parchemin', ...marques('parchemin')),
    cadre('clous', 488, 542, 240, 154, 'bois', `<div style="padding:48px 14px 0;color:var(--creme-2)">${appel('{ ruban, tete: clouer() }')}</div>`, { ruban: 'ruban(libelle)', tete: clouer() }),
    cadre('quarts', 752, 542, 240, 154, 'parchemin', `<div style="padding:48px 14px 0;color:var(--encre-2)">${appel('cadre(…, { tete: clouer(4) })')}</div>`, { tete: clouer(4) }),
    cadre('rubans', 1016, 542, 240, 154, 'bois', `<div style="position:relative;height:100%;color:var(--creme-2)">${ruban('Rubrique', { style: 'top:36px' })}<div style="position:absolute;left:14px;top:72px">${appel("ruban('Rubrique')")}</div></div>`),
  ],
  /* les pièces d'un écran de gestion et d'une issue : leur place est celle de leur gabarit (`../../dispositions.md`) */
  annonces: () => [
    cartouche({ icone: 'carte', nom: 'La planche', sous: "cartouche({ …, taille: 'titre' })", taille: 'titre' }),
    croix(),
    signets([{ nom: 'Tests', compte: 11 }, { nom: 'Combat', compte: 22, marque: true }, { nom: 'Destin & Résistance', compte: 1 }, { nom: 'Voyage', compte: 32, marque: true }], 'Combat'),
    repere(1096, 262, "signets(sections, 'Combat')"),
    issue('Victoire', { action: 'Continuer' }), repere(364, 430, "issue('Victoire', { action })"),
    `<div style="position:absolute;left:364px;top:500px">${rond('epee')}</div>`,
    apercu({ nom: 'Orc', sous: 'Cible', vers: 'gauche', style: 'left:420px;top:480px;--pointe:30px', corps: `<p style="margin:4px 0 0;font-style:italic;font-size:13px;line-height:17px">300 de large, la pointe vers ce qu’on survole, à 12 de lui.</p>${appel("apercu({ nom, sous, corps, vers: 'gauche' })")}` }),
    `<div class="action-de-coin" data-piece="action de coin">${plaque('Continuer', { armee: true })}${plaque('Plus tard')}</div>`, repere(1120, 576, 'action de coin ↓'),
  ],
};
/* les titres (#4585) : le cartouche de titre, le ruban, le titre de panneau, l'intertitre et le filet posé au-dessus de
   lui, sur bois et sur parchemin */
const titres = () => [
  suite(piece("titre({ texte })", titre({ texte: 'Un héritage à Bögenhafen' }))),
  suite(piece("rubrique({ texte, note })", rubrique({ texte: 'Compétences de carrière', note: 'une Augmentation à la fois' })),
    piece("filet() + rubrique({ texte })", large(220, `${filet()}${rubrique({ texte: 'Lots en cale' })}`))),
];
FEUILLES.titres = () => [
  cartouche({ icone: 'carte', nom: 'Carnet d’enquête', sous: "cartouche({ …, taille: 'titre' })", taille: 'titre' }),
  `<div class="bois" style="position:absolute;left:420px;top:34px;padding:12px 16px">${titre({ texte: 'Compendium', ecran: true })}${appel("titre({ texte, ecran: true })")}</div>`,
  page('titres-bois', 24, 160, 600, 250, 'bois', "ruban(libelle) · bois", ...titres()),
  page('titres-parchemin', 656, 160, 600, 250, 'parchemin', "ruban(libelle) · parchemin", ...titres()),
];
/* les textes (#4585) : la ligne libellé-valeur et ses quatre variantes, la rubrique, le sous-titre, la note et le nom, sur
   bois et sur parchemin */
const textes = () => [
  suite(piece("ligne({ libelle, valeur })", large(230, ligne({ libelle: 'Poursuivant', valeur: 'Cogue pirate' }))),
    piece("{ format: 'nombre' }", large(150, ligne({ libelle: 'Blessures', valeur: '10 / 14', format: 'nombre' })))),
  suite(piece("{ variante: 'empilee' }", large(160, ligne({ libelle: 'Race', valeur: 'Humains (Reikland)', variante: 'empilee' }))),
    piece("{ variante: 'mesure', dessous }", large(200, ligne({ libelle: 'Blessures', valeur: '5 / 8', variante: 'mesure', format: 'nombre', dessous: rangDePas({ pleins: 5, total: 8, taille: 'petit' }) })))),
  suite(piece("{ variante: 'tabulaire' } · etat 'tombee', 'somme'", large(250, `<table style="width:100%;border-collapse:collapse">${ligne({ libelle: 'Prix de base', valeur: '2 CO', variante: 'tabulaire', format: 'nombre' })}${ligne({ libelle: 'Marchandage', valeur: '−4/-', variante: 'tabulaire', format: 'nombre', etat: 'tombee' })}${ligne({ libelle: 'Total', valeur: '1 CO 16/-', variante: 'tabulaire', format: 'nombre', etat: 'somme' })}</table>`))),
  suite(piece("rubrique({ texte, note })", rubrique({ texte: 'Blessures', note: 'Changer coûte 100 PX.' })), piece("sousTitre({ texte })", sousTitre({ texte: 'Chasseur · Argent 1' }))),
  suite(piece("glose({ texte })", glose({ texte: 'Changer coûte 100 PX.' })), piece("{ variante: 'avertissement' }", glose({ texte: 'Coût doublé', variante: 'avertissement' }))),
  suite(...['grand', 'moyen', 'petit'].map((t) => piece(t === 'moyen' ? 'nom({ texte })' : `{ taille: '${t}' }`, nom({ texte: 'Aldric Haas', taille: t })))),
];
const consigne = () => suite(piece("glose({ texte, variante: 'consigne' })", large(220, glose({ texte: 'Choisissez une cible.', variante: 'consigne' }))));
FEUILLES.textes = () => [
  page('textes-bois', 24, 22, 600, 490, 'bois', 'ligne(…) · rubrique · note · nom — bois', ...textes()),
  page('textes-parchemin', 656, 22, 600, 490, 'parchemin', 'ligne(…) · rubrique · note · nom — parchemin', ...textes(), consigne()),
];
/* les listes (#4585) : l'étiquette et ses teintes, la ligne de liste et ses états, la puce et le séparateur, sur bois et sur
   parchemin */
const listes = () => [
  suite(piece("etiquette({ texte })", etiquette({ texte: 'Orc a peur' })), ...['or', 'cire', 'fer'].map((t) => piece(`{ teinte: '${t}' }`, etiquette({ texte: 'Hôte', teinte: t })))),
  suite(piece("{ variante: 'pastille' }", etiquette({ texte: 'Initiative', variante: 'pastille' })), piece("{ variante: 'compte', teinte: 'or' }", etiquette({ texte: '100 PX', variante: 'compte', teinte: 'or' })), piece("{ texte, valeur }", etiquette({ texte: 'Hache', variante: 'compte', valeur: 2 }))),
  suite(piece("ligneDeListe({ puce: 'losange', nom, fin })", large(260, ligneDeListe({ puce: 'losange', nom: 'Apothicaire', fin: etiquette({ texte: '100 PX', variante: 'compte' }) }))),
    piece("{ precision }", large(260, ligneDeListe({ puce: 'losange', nom: 'Garder les jets', precision: 'Intelligence · Ténacité' })))),
  suite(piece("{ puce: 'coche', choisie: true }", large(260, ligneDeListe({ puce: 'coche', nom: 'Lettrés', choisie: true }))),
    piece("{ marque, refusee: true }", large(260, ligneDeListe({ marque: picto('epee', 16), nom: 'Arme lourde', refusee: true })))),
  suite(piece("{ nom: nom({ taille: 'petit' }) }", large(260, ligneDeListe({ nom: nom({ texte: 'Greta Hartmann', taille: 'petit' }), fin: '<em class="chiffres">3</em>' }))),
    piece("nom trop long : deux lignes", large(260, ligneDeListe({ puce: 'losange', nom: 'Composant d’incantation · Mur de feu de Kaldor' })))),
  suite(piece("puce('losange')", puce('losange')), piece("puce('coche')", puce('coche')), piece("separateur('median')", `<span>Fer${separateur('median')}Bois</span>`)),
];
FEUILLES.listes = () => [
  page('listes-bois', 24, 22, 600, 600, 'bois', 'etiquette(…) · ligneDeListe(…) · puce · séparateur — bois', ...listes()),
  page('listes-parchemin', 656, 22, 600, 600, 'parchemin', 'etiquette(…) · ligneDeListe(…) · puce · séparateur — parchemin', ...listes()),
];
monter(FEUILLES[document.getElementById('ecran').dataset.etat]());
