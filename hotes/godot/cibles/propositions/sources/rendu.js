/* La page de rendu des maquettes (#4411) : l'état d'un écran (`maquettes/maquette.ts`), posé sur `globalThis.MAQUETTE`
   par `rendre.mjs`, dessiné dans son gabarit (`../dispositions.md` § « Par type d'écran ») avec les pièces du kit
   (`gestes.js`, `../kit.md`). L'état porte les données ; ce script seul choisit la pièce qui dessine chacune, compose
   ses mots et ses valeurs, et la place. La vue suit celle de Godot (`projet/project.godot`, `canvas_items`, `expand`) :
   `echelle = min(L / 1280, H / 720)`. Maquette hors du jeu. */
{
  const { etat } = globalThis.MAQUETTE;
  const VUE = { largeur: 1280, hauteur: 720 };
  const echelle = Math.min(innerWidth / VUE.largeur, innerHeight / VUE.hauteur);
  const ecran = document.getElementById('ecran');
  const largeur = innerWidth / echelle, hauteur = innerHeight / echelle;
  Object.assign(ecran.style, { width: `${largeur}px`, height: `${hauteur}px`, transform: `scale(${echelle})`, transformOrigin: '0 0' });

  /* ───────── les cadres : un rectangle par rôle ───────── */
  /* la table rôle → rect (x, y, largeur, hauteur) de la vue 1280 × 720 : chaque cadre récurrent y a sa ligne, la même
     dans tous les états et sur tous les écrans, et son contenu s'y adapte (fiche
     `user-doctrine-boites-fixes-d-un-ecran-a-l-autre`, `../dispositions.md`) ; une ligne de deux cotes place sans
     dimensionner. Ce qui suit ce qu'il désigne porte `data-mobile` (`mobile`, `gestes.js`) et n'y figure pas */
  const CADRES = {
    /* le bas : le socle (bandeau, barre de l'actif), la fenêtre qui le remplace, le carton et l'issue au-dessus ; les coins */
    socle: [160, 560, 960, 152], fenetre: [160, 500, 960, 212], carton: [160, 222, 960, 278], issue: [360, 190, 560, 150],
    retour: [30, 592, 124, 94], coins: [1198, 579, 52, 118], 'action-de-coin': [1120, 603, 136, 89],
    /* le lieu et la route : le cartouche, le récit, les colonnes, la page, les écrans à ouvrir, le journal */
    cartouche: [24, 20, 372, 96], recit: [32, 136, 340, 112], 'colonne-gauche': [24, 136, 372, 304], note: [24, 456, 372, 100],
    hotes: [412, 20, 340, 480], 'hotes-en-deux': [412, 20, 468, 480], page: [776, 20, 480, 480],
    'colonne-droite': [896, 20, 360, 420], vignette: [896, 20, 360, 180], 'colonne-droite-basse': [896, 220, 360, 220],
    'ouvrir-1': [1120, 460, 136, 44], 'ouvrir-2': [1120, 512, 136, 44], journal: [956, 316, 300, 132],
    regard: [823, 20, 433, 58], 'gestes-du-groupe': [30, 376, 188, 180], frise: [180, 508, 920, 44],
    'carte-du-monde': [24, 136, 852, 364], 'carte-de-la-ville': [412, 20, 468, 420],
    /* le combat */
    round: [22, 16, 214, 66], ordre: [22, 96, 134, 616], systeme: [1214, 18, 44, 44], 'fin-du-tour': [1133, 582, 104, 116],
    'journal-entier': [856, 70, 400, 236],
    /* la fiche : l'identité, le profil, ses panneaux ; la création */
    identite: [26, 20, 340, 536], profil: [384, 20, 800, 96], figure: [384, 136, 180, 420], sections: [582, 136, 674, 420],
    'progression-gauche': [384, 136, 470, 420], 'progression-droite': [872, 136, 384, 420],
    etapes: [26, 12, 1228, 74], choix: [26, 96, 484, 460], detail: [527, 96, 370, 460], 'heros-neuf': [914, 96, 340, 460],
    /* la gestion et l'ouverture */
    fermer: [1214, 18, 44, 44], 'colonne-gestion': [24, 136, 372, 560], registre: [420, 60, 674, 636], signets: [1096, 66, 176, 626],
    affaire: [420, 76, 836, 620], emplacements: [24, 196, 1232, 286], avis: [28, 520, 371, 28],
    'feuillets-de-seance': [24, 136, 1232, 348], 'groupe-de-seance': [24, 604, 1072, 92], campagnes: [956, 76, 300, 468],
    tablee: [412, 136, 428, 560], 'volet-droit': [856, 76, 400, 620],
    'titre-libre': [84, 32, 980, 182], entrees: [88, 236, 330, 460], outils: [772, 623, 484, 75], 'seance-du-chapitre': [24, 509, 1072, 203],
    /* l'outil d'édition */
    /* la consultation : la barre, la liste, la fiche ; l'Index posé par-dessus la liste et la fiche */
    'barre-du-compendium': [16, 8, 1248, 44], 'liste-du-compendium': [16, 60, 300, 644], 'fiche-du-compendium': [328, 60, 936, 644], 'index-du-compendium': [16, 60, 1248, 644],
    'barre-d-outils': [12, 10, 1256, 66], volets: [12, 92, 240, 616], plan: [264, 84, 692, 576], pied: [264, 672, 692, 36], inspecteur: [968, 84, 300, 624],
  };
  /* la place d'une ligne dans une vue plus large ou plus haute que 1280 × 720 : centrée si elle l'est, sinon ancrée au
     bord le plus proche ; aucune ne grandit (`../dispositions.md`, « Vue de référence et ancrages ») */
  const placeDe = ([x, y, l = 0, h = 0]) => [x + l / 2 === VUE.largeur / 2 ? x + (largeur - VUE.largeur) / 2 : x + l / 2 > VUE.largeur / 2 ? x + largeur - VUE.largeur : x,
    y + h / 2 > VUE.hauteur / 2 ? y + hauteur - VUE.hauteur : y];
  const poserLesCadres = () => document.querySelectorAll('#ui [data-piece]').forEach((e) => {
    const ligne = CADRES[e.dataset.piece];
    if (!ligne || e.closest('[data-mobile]')) return;
    const [x, y] = placeDe(ligne);
    Object.assign(e.style, { left: `${x}px`, top: `${y}px`, right: 'auto', bottom: 'auto', ...(ligne.length > 2 ? { width: `${ligne[2]}px`, height: `${ligne[3]}px` } : {}) });
  });
  /* le rect qu'une pièce doit avoir dans la page, au relevé `bouge` de `rendre.mjs` */
  globalThis.CADRE_ATTENDU = (piece) => {
    const ligne = CADRES[piece];
    if (!ligne) return null;
    const [x, y] = placeDe(ligne);
    return { x: x * echelle, y: y * echelle, ...(ligne.length > 2 ? { width: ligne[2] * echelle, height: ligne[3] * echelle } : {}) };
  };

  /* ───────── l'intérieur des cadres : un rectangle par place ───────── */
  /* la table place → rect (x, y, largeur, hauteur) dans le fond de son cadre (`cadre/place`), la même dans tous les états
     et sur tous les écrans : ce qui manque à un état laisse sa place vide, rien ne glisse (fiche
     `user-doctrine-boites-fixes-d-un-ecran-a-l-autre`, `../dispositions.md` § « Grille intérieure »). La fenêtre : le
     héros ou le titre à gauche, le centre, l'autre camp ou ce que le centre décide à droite ; trois emplacements de carte
     de même largeur, chacun sous sa ligne de rubrique, que la liste paginée, la table tirée ou la table de Tests
     remplacent par la place large, et dont le troisième cède sa colonne à ce que le choix vise ; la réserve et six
     places de plaque dans la rangée des gestes, la principale dans la première ; les testeurs à désigner au bout de la
     rangée, à la place des deux dernières plaques ; le camp d'un testeur dans la place `gauche` ou `droite` : le
     portrait, l'identité, la rangée des dés à un y fixe, l'issue (le verdict et le DR, une ligne) du pied du portrait sur la largeur du camp, à 10 px au-dessus de la rangée des gestes,
     en miroir à droite (`camp`, `combat/jet.js`) */
  const PLACES_DU_CAMP = { portrait: [0, 0, 74, 92], identite: [86, 0, 186, 50], des: [86, 54, 186, 50], issue: [0, 98, 272, 18] };
  /* un jet avant le dé au centre, quelle que soit sa situation (`reglage`, `combat/jet.js`) ; une nature absente laisse sa
     place vide (inventaire : `../combat.md`, « Grille du centre avant le dé ») : ce sur quoi il porte, au rect de la
     même ligne du jet tombé ; la sorte du Test et sa difficulté ; la figure (la silhouette des localisations) et, à côté
     d'elle, trois lignes de réglage de 280 ; sans figure, trois lignes pleines qui prennent aussi sa colonne, la
     première sur deux bandes, son libellé au-dessus de ses options ; quatre cartes de choix ou d'enjeu, deux par bande, sur la largeur du centre ; le cumul
     d'un Test étendu et la phrase, aux rects du DR et de la phrase du jet tombé. Deux places partagent une bande quand
     aucun état ne les porte ensemble : les cartes 1-2 et la ligne 1, les cartes 3-4 et la ligne 2, le cumul et la
     ligne 2, la phrase et les lignes 2-3 */
  const PLACES_DU_REGLAGE = {
    sous: [308, 14, 326, 14], mot: [308, 28, 326, 22], figure: [300, 51, 54, 90],
    'ligne-1': [362, 51, 280, 30], 'ligne-2': [362, 81, 280, 30], 'ligne-3': [362, 111, 280, 30],
    'pleine-1': [300, 51, 342, 52], 'pleine-2': [300, 81, 342, 30], 'pleine-3': [300, 111, 342, 30],
    'carte-1': [308, 53, 161, 26], 'carte-2': [473, 53, 161, 26], 'carte-3': [308, 83, 161, 26], 'carte-4': [473, 83, 161, 26],
    cumul: [308, 88, 326, 14], phrase: [308, 104, 326, 34],
  };
  /* un jet tombé au centre, quelle que soit sa situation (`verdict`, `combat/jet.js`) : ce sur quoi il porte, la grande
     ligne de l'issue, la ligne des conséquences, le DR (net, ou le cumul d'un Test étendu sur le DR visé), la phrase
     d'issue ; une conséquence absente laisse sa ligne vide */
  const PLACES_DE_L_ISSUE = { sous: [308, 14, 326, 14], mot: [308, 28, 326, 38], consequences: [308, 66, 326, 22], dr: [308, 88, 326, 14], phrase: [308, 104, 326, 34] };
  const PLACES = {
    ...Object.fromEntries(Object.entries(PLACES_DU_REGLAGE).map(([nom, rect]) => [`fenetre/reglage-${nom}`, rect])),
    ...Object.fromEntries(Object.entries(PLACES_DE_L_ISSUE).map(([nom, rect]) => [`fenetre/issue-${nom}`, rect])),
    'fenetre/gauche': [16, 14, 272, 124], 'fenetre/centre': [300, 14, 342, 112], 'fenetre/droite': [654, 14, 272, 124],
    ...Object.fromEntries(Object.entries(PLACES_DU_CAMP).flatMap(([nom, [x, y, l, h]]) => [[`fenetre/gauche-${nom}`, [16 + x, 14 + y, l, h]], [`fenetre/droite-${nom}`, [654 + 272 - x - l, 14 + y, l, h]]])),
    'fenetre/large': [300, 14, 626, 124],
    'fenetre/rubrique-1': [300, 14, 200, 16], 'fenetre/rubrique-2': [513, 14, 200, 16], 'fenetre/rubrique-3': [726, 14, 200, 16],
    'fenetre/carte-1': [300, 32, 200, 92], 'fenetre/carte-2': [513, 32, 200, 92], 'fenetre/carte-3': [726, 32, 200, 92],
    'fenetre/cible': [726, 14, 200, 112],
    /* ce que le choix vise, à la place du troisième emplacement : le portrait au rect de celui du camp de droite,
       l'identité et sa rangée à sa gauche */
    'fenetre/cible-portrait': [852, 14, 74, 92], 'fenetre/cible-identite': [726, 14, 116, 64], 'fenetre/cible-des': [726, 78, 116, 50], 'fenetre/cible-issue': [726, 112, 200, 14],
    'fenetre/gestes': [20, 141, 902, 40], 'fenetre/reserve': [20, 140, 214, 42], 'fenetre/testeurs': [702, 141, 219, 40],
    ...Object.fromEntries(Array.from({ length: 6 }, (_, k) => [`fenetre/plaque-${k + 1}`, [246 + 114 * k, 141, 105, 40]])),
    /* le socle : quatre cases égales du bandeau ; la barre de l'actif, ses onglets (une place par famille, `FAMILLES`,
       même largeur active ou non), trois places de plaque, cinq de geste ; au-dessus de son bord haut */
    ...Object.fromEntries(Array.from({ length: 4 }, (_, k) => [`socle/case-${k + 1}`, [235.5 * k, 0, 235.5, 134]])),
    ...Object.fromEntries(Array.from({ length: 4 }, (_, k) => [`socle/onglet-${k + 1}`, [470 + 114 * k, -18, 108, 32]])),
    ...Object.fromEntries(Array.from({ length: 3 }, (_, k) => [`socle/plaque-${k + 1}`, [470 + 153 * k, 24, 144, 40]])),
    ...Object.fromEntries(Array.from({ length: 5 }, (_, k) => [`socle/geste-${k + 1}`, [470 + 90 * k, 24, 90, 72]])),
    /* l'actif au pied de l'ordre du tour, haut d'une ligne d'état qu'il porte ou non */
    'ordre/actif': [0, 458, 134, 158],
    /* le pied de l'identité qui progresse : ses gestes, ou le niveau achevé ; l'identité d'un héros ou d'une possession :
       sa tête, ses mesures, ses réserves sous le filet */
    'identite/pied': [19, 389, 284, 126],
    'identite/tete': [19, 15, 284, 168], 'identite/mesures': [19, 183, 284, 100], 'identite/reserves': [19, 283, 284, 221],
    /* la colonne du choix de la création : quatre rangées, chacune sa rubrique (ou sa tête) et sa liste, les deux dernières
       sous un filet ; la rangée haute des deuxième et troisième, la liste et son pied ; une place en couvre d'autres
       seulement quand aucune étape ne les porte ensemble (`../heros.md`, « Grille du choix ») */
    'choix/rangee-1': [19, 15, 428, 104], 'choix/rangee-2': [19, 119, 428, 48], 'choix/rangee-3': [19, 167, 428, 149], 'choix/rangee-4': [19, 316, 428, 112],
    'choix/rangees-2-3': [19, 119, 428, 197], 'choix/corps': [19, 15, 428, 352], 'choix/pied': [19, 375, 428, 53],
    /* les onglets des sections de la fiche, des dossiers et de la progression : cinq places, une section absente laisse
       la sienne vide */
    ...Object.fromEntries(['sections', 'progression-droite'].flatMap((c) => Array.from({ length: 5 }, (_, k) => [`${c}/onglet-${k + 1}`, [8 + 128 * k, -18, 124, 32]]))),
    /* les onglets du panneau de bord : le bord, la station du héros choisi */
    'colonne-droite/onglet-1': [8, -18, 160, 32], 'colonne-droite/onglet-2': [174, -18, 160, 32],
    /* la grille des colonnes du lieu et de la route, et de la page d'un service (`colonne`, `gestes.js`) : la tête, le
       corps, ou le corps sur la bande de la tête quand le panneau n'en a pas, ce qui décide au pied du corps (`pied`, que
       le corps laisse dans tous les états), le geste au pied, la note sous lui ; à
       gauche, le corps prend la hauteur que la note laisse au plein (le rail des services, sa note sous lui) */
    'colonne-droite/tete': [14, 20, 314, 48], 'colonne-droite/corps': [14, 74, 314, 262], 'colonne-droite/plein': [14, 20, 314, 316], 'colonne-droite/geste': [14, 346, 314, 40],
    'colonne-droite-basse/plein': [14, 16, 314, 106], 'colonne-droite-basse/geste': [14, 130, 314, 56],
    'colonne-gauche/tete': [15, 20, 324, 50], 'colonne-gauche/corps': [15, 76, 324, 204], 'colonne-gauche/plein': [15, 20, 324, 232], 'colonne-gauche/note': [15, 258, 324, 17],
    'page/tete': [20, 16, 422, 44], 'page/corps': [20, 66, 422, 254], 'page/pied': [20, 326, 422, 50], 'page/geste': [20, 382, 422, 44], 'page/note': [20, 432, 422, 22],
    /* le rail d'un panneau de gestion, sur la même grille ; au carnet, les documents remis sous sa note */
    'colonne-gestion/plein': [15, 20, 324, 228], 'colonne-gestion/note': [15, 254, 324, 17], 'colonne-gestion/documents': [12, 278, 330, 252],
    /* le geste qui commet un feuillet de la gestion, au pied fixe de son cadre */
    'colonne-gestion/geste': [12, 490, 330, 40],
    /* sous la bannière d'issue d'un combat : ce que l'issue laisse, sur sa largeur ; la sortie, de la largeur de la plus
       longue */
    /* le grand titre libre de l'ouverture : le sur-titre, le nom, le filet, ce qui le suit ; sous le cadre, le chapitre sur
       sa toile et le corps */
    'titre-libre/sur': [4, 0, 976, 20], 'titre-libre/nom': [0, 20, 980, 92], 'titre-libre/filet': [4, 118, 560, 7], 'titre-libre/suite': [4, 130, 760, 42],
    'titre-libre/toile': [-6, 176, 612, 58], 'titre-libre/corps': [4, 242, 976, 240],
    /* la colonne des entrées : la principale, l'instant qu'elle reprend, les autres */
    'entrees/principale': [0, 0, 330, 52], 'entrees/reprise': [4, 58, 326, 18], 'entrees/autres': [0, 88, 330, 372],
    'issue/suite': [0, 168, 560, 26], 'issue/geste': [153, 214, 254, 52],
    /* l'outil d'édition, sur la grille des colonnes : aux volets le contenu de l'ouvert, ses gestes au pied ; à
       l'inspecteur ce qui est choisi, ses propriétés, la validation au pied */
    'volets/plein': [10, 34, 202, 446], 'volets/geste': [10, 492, 202, 96],
    'inspecteur/tete': [14, 26, 254, 58], 'inspecteur/corps': [14, 90, 254, 410], 'inspecteur/geste': [14, 503, 254, 100],
    /* le carton d'un arrêt : la vignette, le titre, le texte jusqu'au geste, les cartes du choix (ou les paies et les
       parts qui les règlent) posées sur le bas du texte quand l'arrêt en ouvre un, le geste qui commet */
    'carton/vignette': [20, 24, 140, 140], 'carton/tete': [184, 22, 734, 34], 'carton/texte': [184, 60, 654, 154],
    'carton/choix': [184, 130, 734, 84], 'carton/paies': [184, 130, 354, 84], 'carton/parts': [552, 130, 366, 128], 'carton/geste': [211, 218, 300, 40],
  };
  /* le rect d'une place dans la page, au relevé `place` de `rendre.mjs` : sa ligne, depuis le fond que la ligne de son
     cadre lui donne (le rect de `CADRES`, moins le bois) */
  globalThis.PLACE_ATTENDUE = (e) => {
    const ligne = PLACES[e.dataset.place], piece = e.closest('[data-piece]'), cadre = piece && globalThis.CADRE_ATTENDU(piece.dataset.piece);
    if (!ligne || !cadre) return null;
    const bois = parseFloat(getComputedStyle(piece).paddingLeft) * echelle, haut = parseFloat(getComputedStyle(piece).paddingTop) * echelle;
    return { x: cadre.x + bois + ligne[0] * echelle, y: cadre.y + haut + ligne[1] * echelle, width: ligne[2] * echelle, height: ligne[3] * echelle };
  };
  const poserLesPlaces = () => document.querySelectorAll('#ui [data-place]').forEach((e) => {
    const ligne = PLACES[e.dataset.place];
    if (!ligne) throw new Error(`place ${e.dataset.place} : hors table`);
    const piece = e.closest('[data-piece]'), fond = (piece.querySelector(':scope > .fond') ?? piece).getBoundingClientRect(), porteur = e.offsetParent.getBoundingClientRect();
    Object.assign(e.style, { position: 'absolute', left: `${ligne[0] + (fond.x - porteur.x) / echelle}px`, top: `${ligne[1] + (fond.y - porteur.y) / echelle}px`, width: `${ligne[2]}px`, height: `${ligne[3]}px` });
  });

  /* ───────── les mots et les valeurs ───────── */
  const echapper = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  /* un nombre signé, le moins typographique */
  const signe = (n) => (n < 0 ? `−${-n}` : `+${n}`);
  /* un d100 sur deux chiffres, `00` pour cent */
  const d100 = (n) => String(n % 100).padStart(2, '0');
  const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;
  const modif = (t) => etiquette({ texte: t });

  /* ───────── le combat ───────── */
  const qui = (id) => etat.combattants[id];
  /* le camp d'un combattant : l'ennemi se passe, le héros ou le PNJ suit son buste (`CAMP`, `gestes.js`) */
  const campDe = (id) => (qui(id).ennemi ? 'ennemi' : undefined);
  const portraitDe = (id, taille = 'grand') => portrait(qui(id).buste, { camp: campDe(id), taille });
  const libelleDuModificateur = (m) => ('de' in m ? `${m.nom} : ${m.de} → ${d100(m.vers)}` : 'rang' in m ? `${m.nom} ${m.rang} sur ${m.sur}` : 'facteur' in m ? `${m.nom} ×${m.facteur}` : m.valeur === undefined ? m.nom : `${m.nom} ${signe(m.valeur)}`);
  const porte = ({ arme, cible }) => `${echapper(arme)}${separateur('median')}Cible : ${echapper(qui(cible).nom)}`;
  const regle = (libelle, corps) => `<div class="regle"><span class="l rubrique">${echapper(libelle)}</span>${corps}</div>`;
  const optionsDu = (r) => options(r.valeurs.map((v, k) => [echapper(v), { armee: k === r.tenue }]));

  /* le camp d'un testeur, à gauche ou en miroir à droite : son poste, son Test et son seuil, ses dés posés ou tombés */
  const testeur = (t, cote = '') => {
    const des = t.jet?.des ?? t.des;
    const faces = des ? des.map(String) : ['', ''];
    return camp({
      cote, portrait: portraitDe(t.qui), nom: echapper(qui(t.qui).nom), carac: `${t.poste ? `${echapper(t.poste)}${separateur('median')}` : ''}${echapper(t.test)}`, seuil: t.seuil ?? '?',
      des: cote ? faces.reverse() : faces, regles: !!t.jet?.reglable,
      total: t.jet ? d100(t.jet.des[0] + t.jet.des[1]) : null, dr: t.jet ? signe(t.jet.dr) : null,
      influences: (t.modificateurs ?? []).map(libelleDuModificateur), survol: t.survol ?? null,
      reussite: !!t.jet?.reussite, critique: !!t.jet?.critique,
    });
  };
  /* le héros qui choisit sans dé : ce qui le met en jeu, son prix */
  const MISES = {
    reserve: (m) => `${pluriel(m.valeur, 'Point')} ${de(echapper(m.reserve))}`,
    test: (m) => `${echapper(m.test)} ≤ ${m.seuil}`,
    critiqueSur: (m) => `Critique sur ${echapper(qui(m.critiqueSur).nom)}`,
    arme: (m) => echapper(m.arme),
    engagement: ({ engagement: g }) => `Engagée${separateur('median')}Avantage ${g.avantage}${separateur('median')}${echapper(qui(g.contre).nom)} ${g.adverse}`,
    menace: (m) => echapper(m.menace),
    corruption: ({ corruption: c }) => `Points de Corruption ${c.points} / ${c.seuil}`,
    decidePour: (m) => `décide pour ${echapper(m.decidePour)}`,
    testeur: () => 'Portera le Test',
  };
  /* ce qui menace le héros se lit en rouge */
  const MENACES = ['menace', 'corruption'];
  const sansDe = (h) => {
    const mise = Object.keys(MISES).find((k) => k in h.mise);
    return `<div class="camp${MENACES.includes(mise) ? ' touche lanceur' : ''}">${portraitDe(h.qui)}<div>${nom({ texte: `${echapper(qui(h.qui).nom)}${h.marque ? ` ${modif(echapper(h.marque))}` : ''}` })}${sousTitre({ texte: MISES[mise](h.mise) })}${h.cout ? modif(echapper(h.cout)) : ''}</div></div>`;
  };
  /* celui qui subit la table qu'un jet impose : ses dés, la table tirée, ce qui l'y mène */
  const issueQuiMene = (i) => ('critique' in i ? ['Critique : ' + i.critique, 'du jet d’Incantation'] : 'unites' in i ? [`${i.unites} aux unités`, 'du jet d’Incantation'] : ['Tableau', `des ${echapper(i.tableau)}`]);
  const subit = (s) => {
    const [b, span] = issueQuiMene(s.issue);
    const motif = typeof s.motif === 'string' ? echapper(s.motif) : `Échec sur un double : ${s.motif.double}`;
    return `<div class="camp touche lanceur">${portraitDe(s.qui)}<div>${nom({ texte: echapper(qui(s.qui).nom) })}${sousTitre({ texte: motif })}
      <div class="des">${s.des.map((d) => d10(String(d))).join('')}${s.tire === undefined ? '' : sceau(s.tire, 'grand')}<div class="issue"><b>${b}</b>${b === 'Tableau' ? `<b>${span}</b>` : `<span>${span}</span>`}</div></div></div></div>`;
  };
  /* celle qu'une Influence corruptrice expose : ses Points de Corruption sur son seuil */
  const expose = (e) => `<div class="camp expose">${portraitDe(e.qui)}<div>${nom({ texte: echapper(qui(e.qui).nom) })}${sousTitre({ texte: echapper(e.exposition) })}
    <div class="points"><div class="l rubrique"><span>Points de Corruption</span><b>${e.corruption.points} / ${e.corruption.seuil}</b></div>${rangDePas({ pleins: e.corruption.points, total: e.corruption.seuil, taille: 'petit', teinte: 'cire' })}</div></div></div>`;
  const HEROS = { testeur: (h) => testeur(h), heros: sansDe, subit, expose };
  /* à droite : l'autre camp, ce que le jet vise, ce qu'un Critique touche */
  const AUTRES = {
    testeur: (a) => testeur(a, 'droite'),
    /* ce que le jet vise, sans dé : sa vie sous son rôle */
    vise: (v, cote = 'droite') => fiche({ cote, classe: 'visee', portrait: portraitDe(v.qui), nom: echapper(qui(v.qui).nom), ligne: echapper(v.comme),
      rangee: `<div class="pv">${jauge(qui(v.qui).blessures / qui(v.qui).max, { taille: 'forte' })}<b class="rubrique">${qui(v.qui).blessures} / ${qui(v.qui).max}</b></div>` }),
    touche: (t, cote = 'droite') => fiche({ cote, classe: 'touche', portrait: portraitDe(t.qui), nom: echapper(qui(t.qui).nom), ligne: echapper(t.atteinte),
      rangee: `<div class="des">${silhouette(50, { [t.zone]: 'touchee' })}${sceau(t.blessures, 'grand')}<div class="issue"><b>Blessures</b><b>perdues</b></div></div>` }),
    rangees: (r) => `<div class="rangees">${rubrique({ texte: 'Chacun lance son jet, les DR s’additionnent' })}${r.rangees.map((x) => `<div class="rangee">${portrait(qui(x.qui).buste, { taille: 'menu' })}<div class="q" data-texte="rangée ${echapper(qui(x.qui).nom)}">${nom({ texte: echapper(qui(x.qui).nom), taille: 'petit' })}<span class="rubrique">${echapper(x.poste)}${separateur('median')}${echapper(x.competence)}</span></div><span class="seuil">≤ ${x.seuil}</span></div>`).join('')}</div>`,
    interlocuteur: (i, cote = 'droite') => fiche({ cote, classe: 'parle', portrait: portraitDe(i.qui), nom: echapper(qui(i.qui).nom), ligne: echapper(i.comme), rangee: `<p data-texte="réplique">${echapper(i.dit)}</p>` }),
  };

  /* une carte de choix : son nom ou le combattant qu'elle nomme, son détail ligne à ligne (une ligne en liste quand il y tient), sa marque */
  const ligneDeCarte = (l) => (typeof l === 'string' ? echapper(l)
    : 'contre' in l ? `${echapper(l.test)} ≤&nbsp;${l.seuil} contre&nbsp;≤&nbsp;${l.contre}`
      : 'seuil' in l ? `${echapper(l.test)}${separateur('median')}≤&nbsp;${l.seuil}`
        : 'ni' in l ? `Niveau d’incantation ${l.ni}`
          : 'aCumuler' in l ? `Test étendu : ${l.aCumuler} DR à cumuler`
            : 'prix' in l ? prix(l.prix)
              : 'mesure' in l ? `${echapper(l.mesure)} ${l.valeur} / ${l.sur}`
                : `${echapper(qui(l.qui).nom)} à ${l.distance} m${separateur('median')}portée ${l.portee} m`);
  const carteDe = (c) => {
    const lignes = c.detail.map(ligneDeCarte);
    const marque = !c.marque ? '' : c.marque.valeur === undefined ? echapper(c.marque.nom) : `${c.marque.valeur < 0 ? signe(c.marque.valeur) : c.marque.valeur} ${echapper(c.marque.nom)}`;
    return carte(echapper(c.nom ?? qui(c.qui).nom), lignes.join(`${separateur('median')}<br>`), { armee: !!c.choisie, fermee: !!c.refus, refus: c.refus && c.survol ? echapper(c.refus) : '', classe: c.funeste ? 'funeste' : '', marque, portrait: c.qui ? portrait(qui(c.qui).buste, { camp: campDe(c.qui) }) : '' });
  };
  /* au-delà de trois cartes, la liste se pagine par trois, à la page de la carte choisie (`../dispositions.md`, « Débordement ») */
  const PAR_PAGE = 3;
  const cartesDu = (g) => {
    const debut = PAR_PAGE * Math.floor(Math.max(0, g.cartes.findIndex((c) => c.choisie)) / PAR_PAGE), fin = Math.min(debut + PAR_PAGE, g.cartes.length);
    return `<div class="cartes liste paginee">${g.cartes.slice(debut, fin).map(carteDe).join('')}<span class="pas-a-pas page-de-liste">${picto('gauche', 13, '#5a4530', 2)}<b class="rubrique">${debut + 1}-${fin} sur ${g.cartes.length}</b>${picto('droite', 13, '#5a4530', 2)}</span></div>`;
  };
  const enjeuDu = (e) => `<div class="enjeu"><div class="l rubrique">${echapper(e.libelle)}</div><table>${e.issues.map((i, k) => `<tr${k === e.tombee ? ' class="tombee"' : ''}><td>${echapper(i.issue)}</td><td>${echapper(i.effet)}</td></tr>`).join('')}</table></div>`;
  /* le mot générique de l'issue d'un jet tombé, du point de vue de celui qui agit (`../combat.md`, « À valider ») */
  const MOT_DU_VERDICT = { reussite: 'Réussite', echec: 'Échec', critique: 'Critique' };
  /* le pictogramme qui identifie chaque genre de conséquence ; un genre sans pictogramme écrit son nom et le signale
     (`../combat.md`, « À valider ») */
  const PICTO_DE_LA_CONSEQUENCE = { localisation: 'cible', avantage: 'competence', prix: 'pieces', sort: 'sort', retard: 'sablier' };
  const NOM_DE_LA_CONSEQUENCE = { localisation: 'Localisation', blessures: 'Blessures', avantage: 'Avantage', prix: 'Prix', corruption: 'Points de Corruption', etat: 'État', sort: 'Sort lancé', dissipation: 'Sort dissipé', retard: 'Retard' };
  const NOM_DE_LA_ZONE = { tete: 'Tête', corps: 'Corps', brasD: 'Bras droit', brasG: 'Bras gauche', jambeD: 'Jambe droite', jambeG: 'Jambe gauche' };
  const UNITE_DE_LA_CONSEQUENCE = { prix: ' %', retard: ' j' };
  /* une conséquence en pièce du kit : son pictogramme (celui de la donnée, sinon celui de son genre), sa valeur signée ou
     ce qu'elle désigne ; son nom, sa cible et son détail au survol */
  const consequenceDe = (c, k, survol) => {
    const icone = c.icone ?? PICTO_DE_LA_CONSEQUENCE[c.genre];
    const valeur = `${typeof c.valeur === 'number' ? `${signe(c.valeur)}${UNITE_DE_LA_CONSEQUENCE[c.genre] ?? ''}` : c.genre === 'localisation' ? NOM_DE_LA_ZONE[c.valeur] : echapper(c.valeur ?? '')}${c.prix ? ` <s>${prix(c.prix.de)}</s> ${prix(c.prix.vers)}` : ''}`;
    const nom = c.detail && c.genre === 'etat' ? echapper(c.detail) : NOM_DE_LA_CONSEQUENCE[c.genre];
    return { icone: icone ? picto(icone, 17, 'currentColor', 1.8) : null, nom, valeur, ton: c.ton ?? '', survol: survol === k,
      bulle: [nom, c.cible && echapper(qui(c.cible).nom), c.genre !== 'etat' && c.detail && echapper(c.detail)].filter(Boolean).join(separateur('median')) };
  };
  const tableDu = (c) => (c.tire === undefined
    ? `<div id="critique">${titre({ texte: echapper(c.nom) })}${defile(`<p data-texte="texte de la table">${echapper(c.texte)}</p>`)}</div>`
    : `<div id="critique"><div class="tete-c">${titre({ texte: echapper(c.nom) })}<div class="tirage">${c.tire === null ? sceau('', 'moyen', { etat: 'vide' }) : sceau(c.tire, 'moyen')}<span class="rubrique">${echapper(c.table)}<br>${c.tire === null ? 'à tirer' : 'tirée'} au d100</span></div></div>
      ${defile(`<p data-texte="texte de la table">${echapper(c.texte)}</p>`)}</div>`);
  /* la sorte d'un Test avant le dé : opposé quand l'autre camp teste aussi */
  const sorteDe = (f) => (f.autre?.role === 'testeur' ? 'Test opposé' : 'Test simple');
  const difficulteDe = (c) => (c.difficulte ? `${separateur('median')}${echapper(c.difficulte.nom)} ${signe(c.difficulte.valeur)}` : '');
  const jourDuVoyage = () => (etat.titre?.jourDeVoyage ? `${separateur('median')}${jourDe(etat.titre.jourDeVoyage, etat.decor)}` : '');
  /* une carte du centre, à la hauteur d'une bande : son nom, sa valeur ou son détail ; `armee`, la choisie */
  const carteCourte = (nom, sous, o = {}) => carte(nom, sous, { classe: 'courte', ...o });
  /* une carte de choix au centre : son nom, la valeur qui décide (un seuil, un prix, une mesure) ; tout son détail au survol */
  const valeurDeCarte = (l) => (typeof l === 'string' ? '' : 'seuil' in l && !('contre' in l) ? `≤ ${l.seuil}` : ligneDeCarte(l));
  const carteDuCentre = (c) => carteCourte(echapper(c.nom), c.detail.map(valeurDeCarte).filter(Boolean).join(separateur('median')), { armee: !!c.choisie, detail: c.detail.map(ligneDeCarte).join(separateur('median')) });
  const regles = (liste) => liste.map((r) => regle(r.libelle, optionsDu(r)));
  /* le lot qu'un Marchandage traite */
  const lotMarchande = (l) => `${echapper(l.nom)}${separateur('median')}${l.enc} Enc`;
  /* le centre de la fenêtre, et ce qu'il demande à sa mise en page (`combat/combat.css`, `combat-suite/suite.css`) */
  const CENTRES = {
    /* un jet tombé : le panneau de droite suit la sorte du Test, l'autre camp quand la fenêtre le porte, sinon ce que le
       Test décide */
    issue: (c) => ({
      ...verdict({
        sous: `${echapper(c.sur)}${c.cible ? `${separateur('median')}Cible : ${echapper(qui(c.cible).nom)}` : ''}${c.relance === undefined ? '' : `${separateur('median')}<span class="relance">relancé, <s>${d100(c.relance)}</s></span>`}${etat.titre?.jourDeVoyage ? `${separateur('median')}${jourDe(etat.titre.jourDeVoyage, etat.decor)}` : ''}`,
        mot: MOT_DU_VERDICT[c.verdict], sens: c.verdict, consequences: consequences(c.consequences.map((x, k) => consequenceDe(x, k, c.survol))),
        dr: `${c.drNet === undefined ? `DR ${signe(c.dr)}` : `DR net ${signe(c.drNet)}`}${c.cumul ? `${separateur('median')}${rangDePas({ pleins: c.cumul.dr, total: c.cumul.vise, taille: 'petit' })}<b data-texte="cumul">${c.cumul.dr} DR sur ${c.cumul.vise}</b>` : ''}`,
        phrase: echapper(c.phrase),
      }),
      ...(c.enjeu ? { droite: enjeuDu(c.enjeu) } : {}),
    }),
    attaque: (c, f) => {
      const l = c.localisation;
      const zone = l.zone ? `${nom({ texte: echapper(l.zone.nom), taille: 'grand' })}${l.malus === null ? '' : modif(`${signe(l.malus)} au Test`)}` : '';
      return reglage({
        sous: porte(c.porte), mot: sorteDe(f), figure: silhouette(86, l.zone ? { [l.zone.id]: 'choisie' } : {}),
        lignes: [`${regles(c.reglages).join('')}${c.note ? `<p data-texte="note">${echapper(c.note)}</p>` : ''}`,
          `<div class="regle localisation"><span class="l rubrique">${echapper(l.libelle)}</span>${zone}${l.hasard || !l.zone ? rond('des', 'menu', { arme: !l.zone }) : ''}</div>`,
          c.bascules.length ? `<div class="bascules">${c.bascules.map((b) => bascule(echapper(b.libelle), b.allumee)).join('')}</div>` : ''],
      });
    },
    defense: (c, f) => reglage({
      sous: porte(c.porte), mot: sorteDe(f),
      cartes: c.reactions.map((r, k) => carteCourte(echapper(r.nom), `≤ ${r.seuil}`, { armee: k === c.tenue })),
      lignes: ['', ...(c.sociale ? ['', regle('À la place de Corps à corps', modif(echapper(c.sociale)))] : regles(c.reglages))],
    }),
    choix: (c, f) => {
      const annonce = !c.annonce ? '' : 'round' in c.annonce
        ? `<div class="annonce">${titre({ texte: `Round ${c.annonce.round}` })}${sousTitre({ texte: echapper(c.annonce.sous) })}</div>`
        : `<div class="annonce">${titre({ texte: echapper(c.annonce.sort) })}${sousTitre({ texte: `${echapper(qui(c.annonce.lanceur).nom)}${separateur('median')}Cible : ${echapper(qui(c.annonce.cible).nom)}` })}</div>`;
      /* une carte par emplacement, la rubrique de son groupe au-dessus de la première, ce que le choix vise à la place
         du troisième ; au-delà, la liste paginée tient la place des emplacements */
      const cartes = c.groupes.flatMap((g) => g.cartes.map((x, k) => [carteDe(x), k ? '' : g.libelle ?? '']));
      const lieu = cartes.length + (f.autre ? 1 : 0) > PAR_PAGE ? { large: cartesDu(c.groupes[0]) }
        : Object.fromEntries([...(f.autre ? [['cible', AUTRES[f.autre.role](f.autre, 'cible')]] : []), ...cartes.flatMap(([html, t], k) => [[`carte-${k + 1}`, html], ...(t ? [[`rubrique-${k + 1}`, `${rubrique({ texte: echapper(t) })}`]] : [])])]);
      return { ...(annonce ? { gauche: annonce } : {}), ...lieu, droite: undefined };
    },
    consigne: (c) => glose({ texte: echapper(c.consigne), variante: 'consigne', cle: 'consigne' }),
    critique: (c) => `<div id="critique">${titre({ texte: echapper(c.nom) })}<p data-texte="texte du critique">${echapper(c.effet)}</p></div>`,
    table: (c) => ({ large: tableDu(c) }),
    surincantation: (c) => {
      const axe = (a) => ('sansObjet' in a ? `<div class="axe ferme"><span class="rubrique">${echapper(a.nom)}</span><em>sans objet</em></div>`
        : `<div class="axe"><span class="rubrique">${echapper(a.nom)}</span>${rangDePas({ pleins: a.alloues, total: a.sur, taille: 'petit' })}<b>${'cibles' in a.effet ? pluriel(a.effet.cibles, 'cible') : `×${a.effet.facteur}`}</b>${moinsPlus({ moins: a.alloues > 0, plus: a.alloues < a.sur })}</div>`);
      return { centre: `<div id="verdict" class="surinc">
        <div class="sort">${sousTitre({ texte: `Sort${separateur('median')}Niveau d’incantation ${c.ni}` })}${titre({ texte: echapper(c.sort) })}
          <p data-texte="consigne">Cibles supplémentaires : ${c.supplementaires.choisies} / ${c.supplementaires.sur}, à cliquer sur la carte.</p></div>
        <div class="axes"><div class="t"><span class="rubrique">Surincantation</span>${nom({ texte: `${c.pas.alloues} pas sur ${c.pas.sur}`, cle: 'pas' })}</div>${c.axes.map(axe).join('')}</div>
      </div>`,
      droite: `<div class="cibles-du-sort">${c.cibles.map((x) => `<div class="c-s">${portraitDe(x.qui, 'petit')}<div>${nom({ texte: echapper(qui(x.qui).nom), taille: 'petit' })}${sousTitre({ texte: echapper(x.comme) })}</div></div>`).join('')}</div>` };
    },
    /* un Test étendu avant le dé : le Sort et son Niveau d'incantation sur la ligne du jet tombé, le cumul à la place du DR */
    etendu: (c) => ({
      ...reglage({ sous: `${echapper(c.sort)}${separateur('median')}Niveau d’incantation ${c.ni}`, mot: 'Test étendu',
        cumul: `<div class="dr-du-jet rubrique">${rangDePas({ pleins: c.cumul, total: c.ni, taille: 'petit' })}<b data-texte="cumul">${c.cumul} DR sur ${c.ni}</b></div>`, phrase: echapper(c.phrase) }),
      ...(c.enjeu ? { droite: enjeuDu(c.enjeu) } : {}),
    }),
    nature: (c) => ({ ...reglage({ sous: echapper(c.libelle), mot: 'Test simple', cartes: c.cartes.map(carteDuCentre) }), droite: enjeuDu(c.enjeu) }),
    tests: (c) => {
      const nom = (l) => `${echapper(qui(l.qui).nom)}${l.poste ? `, ${echapper(l.poste)}` : ''}${separateur('median')}${echapper(l.test)} ≤ ${l.seuil}${l.de === undefined ? '' : `${separateur('median')}dé ${l.de}`}`;
      const issue = (l) => (l.dr !== undefined
        ? `${l.de !== undefined && l.dr < 0 ? `échec${separateur('median')}` : ''}${signe(l.dr)} DR${l.double ? `, compte double : ${signe(2 * l.dr)}` : ''}`
        : [l.attente && echapper(l.attente), l.double && 'compte double', l.bonus && `Mouvement ${l.bonus.mouvement} : ${signe(l.bonus.dr)} DR`].filter(Boolean).join(separateur('median')));
      const somme = c.lignes.reduce((t, l) => t + (l.dr ?? 0) * (l.double ? 2 : 1), 0);
      /* un lanceur par case fixe : son portrait, son seuil, son DR (ou ce qu'il attend) ; qui, son poste, son Test et
         le détail de l'issue dans la bulle du survol (fiche `user-doctrine-icone-identifie-survol-detaille`) */
      const bref = (l) => (l.dr !== undefined ? `${signe(l.dr)} DR${l.double ? ' ×2' : ''}` : `${l.attente ? echapper(l.attente) : ''}${l.double ? ' ×2' : ''}`);
      return { large: `<div id="verdict" class="tests"><div class="tete">${titre({ texte: echapper(c.nom) })}${sousTitre({ texte: echapper(c.test) })}</div>
        <div class="lanceurs">${c.lignes.map((l) => `<div class="lanceur${l.courant ? ' courant en-cours' : ''}">${portraitDe(l.qui, 'menu')}<div><b class="gothique">≤ ${l.seuil}</b><span>${bref(l)}</span></div>${raison(`${nom(l)} : ${issue(l)}`, { survolee: false })}</div>`).join('')}</div>
        <table>${c.regle ? `<tr><td>${echapper(c.regle.texte)}</td><td>${echapper(c.regle.effet)}</td></tr>` : ''}${c.somme ? `<tr class="somme"><td>Somme</td><td>${signe(somme)} DR</td></tr>` : ''}</table></div>` };
    },
    marchandage: (c, f) => reglage({
      sous: `${lotMarchande(c.lot)}${separateur('median')}estimation ${prix(c.estimation)}`, mot: sorteDe(f),
      cartes: c.enjeux.map((e) => carteCourte(echapper(e.issue), e.enPlus ? `${e.pourcent} % de plus` : `${signe(e.pourcent)} %`)),
    }),
    /* le Test d'équipage avant le dé (MDG 14 l.13) : ni simple, ni opposé, ni étendu (`../voyage.md`, « À valider ») */
    equipage: (c) => reglage({
      sous: `${echapper(c.fait)}${c.cible ? `${separateur('median')}Cible : ${echapper(qui(c.cible).nom)}` : ''}`, mot: 'Test d’équipage',
      lignes: [regle(c.reglage.libelle, optionsDu(c.reglage))],
      phrase: c.notes.map((n) => modif(typeof n === 'string' ? echapper(n) : 'dr' in n ? `${echapper(n.nom)} ${signe(n.dr)} DR` : `${pluriel(n.pieces, 'pièce')} à ${echapper(n.bord)}`)).join(' '),
    }),
    /* le Test simple avant le dé : ce qui le pose et le jour du voyage où il tombe, sa difficulté, les cartes du choix
       qu'il porte, ce qu'il décide */
    simple: (c) => reglage({ sous: `${echapper(c.sur)}${jourDuVoyage()}`, mot: `Test simple${difficulteDe(c)}`, cartes: (c.cartes ?? []).map(carteDuCentre), phrase: echapper(c.phrase) }),
    /* les réponses d'un dialogue, numérotées : le Test qu'une réponse demande en tête, ce qu'elle coûte au bout */
    dialogue: (c) => `<div class="reponses">${c.reponses.map((r, k) => plaque(`<span class="dit">${r.test ? `<span class="annonce">${picto('de', 14)}${echapper(r.test.competence)}${separateur('median')}${echapper(r.test.difficulte)}</span>` : ''}<span data-texte="réponse ${k + 1}">${echapper(r.texte)}</span></span>`,
      { numero: k + 1, survol: !!r.survol, prix: r.prix === undefined ? null : prix(r.prix), taille: 'petite', classe: 'gauche' })).join('')}</div>`,
  };
  /* le pictogramme qui identifie chaque réserve d'un héros, et l'Expérience (`../combat.md`, « À valider ») */
  const PICTO_DE_LA_RESERVE = { destin: 'noeud', chance: 'etoile', resilience: 'coeur', determination: 'poing', experience: 'livre' };
  /* le jeton d'une réserve : son pictogramme ; son nom, de qui la porte quand elle est seule, au survol */
  const jetonDe = (r) => ({ valeur: r.valeur, icone: picto(PICTO_DE_LA_RESERVE[r.id], 20, undefined, 1.8), nom: r.porteur ? `${echapper(r.nom)} ${de(echapper(qui(r.porteur).nom))}` : echapper(r.nom), survol: !!r.survol });
  /* les gestes : la réserve dépensée à gauche, la plaque principale en premier, la raison d'un refus au survol */
  const gestesDe = (f) => [f.gestes.map((g) => plaque(`${echapper(g.libelle)}${g.refus && g.survol ? raison(echapper(g.refus)) : ''}`, { armee: !!g.principal, fermee: !!g.refus, taille: 'geste' })),
    `${f.reserves.length ? reserves(f.reserves.map(jetonDe)) : ''}`];
  /* la fenêtre : le héros à gauche, ce que le centre pose (le centre seul, ou ses places), l'autre camp à droite, les
     héros parmi lesquels le testeur se désigne au bout des gestes */
  const fenetre = (f) => {
    const centre = CENTRES[f.centre.role](f.centre, f);
    const lieu = typeof centre === 'string' ? { centre } : centre;
    if (f.autre && (lieu.droite || lieu.large)) throw new Error(`fenêtre ${f.centre.role} : la droite est prise`);
    return bandeauDuJet(echapper(f.titre), '', places('fenetre', { gauche: f.heros && HEROS[f.heros.role](f.heros), droite: f.autre && AUTRES[f.autre.role](f.autre), ...lieu,
      testeurs: f.heros?.parmi && testeurs(f.heros.parmi.map((id) => qui(id).buste), f.heros.parmi.indexOf(f.heros.qui)) }), ...gestesDe(f));
  };

  /* 5. Combat : la borne du round, l'ordre du tour (l'actif en bas, le round suivant au-delà de sa borne), le journal,
     le système, la fin du tour, fermée tant qu'une fenêtre tient la main */
  const PICTO_DE_L_ETAT = { aTerre: 'aTerre', hemorragique: 'goutte' };
  const etatPorte = (e) => `<div class="etat-porte${e.presse ? ' presse' : ''}">${sceau(PICTO_DE_L_ETAT[e.etat], 'menu')}<span class="rubrique">${echapper(e.nom)}</span>${e.n > 1 ? `<b>${e.n}</b>` : ''}</div>`;
  const rangDe = (id, classe) => { const c = qui(id); return combattant(c.buste, c.ennemi ? 'ennemi' : 'heros', echapper(c.nom), c.blessures, c.max, classe, classe.includes('fantome') ? '' : c.etats.map(etatPorte).join('')); };
  const entree = (e, k, toutes) => (typeof e === 'string' ? (k === toutes.length - 1 ? neuf : vieux)(echapper(e)) : borneJ(e.commence ? `Le combat commence ! (Round ${e.round})` : `Round ${e.round}`));
  /* `fin` : la fin du tour se presse ; `lu` : le combattant dont la fiche est lue ; `journal` : le journal entier est ouvert ;
     `cede` : un mobile (l'aperçu d'une cible, la fiche d'un combattant) prend le rect du journal, qui revient quand il
     se ferme */
  const combat = (c, { fin = false, lu = null, journal = false, cede = false } = {}) => [
    `<div id="round" class="cadre bois" data-piece="round"><div class="fond bois">${titre({ texte: `Round ${c.round}` })}${rubrique({ texte: c.tour ? `tour ${c.tour.rang}<br>sur ${c.tour.sur}` : 'le round<br>débute' })}</div>${ferrures}</div>`,
    `<div id="ordre" data-piece="ordre">${[...c.ordre.slice(c.tour ? 1 : 0).map((id) => rangDe(id, id === lu ? 'lu' : '')), borne(c.round + 1), ...c.suivant.map((id, k) => rangDe(id, k ? 'fantome loin' : 'fantome'))].reverse().join('')}${places('ordre', { actif: c.tour && rangDe(c.ordre[0], 'actif') })}</div>`,
    ...(cede ? [] : [`<div id="journal" data-piece="journal">${rubrique({ texte: 'Journal', fin: rond('journal', 'petit', { arme: journal }) })}${defile(c.journal.map(entree).join(''), 'au-pied', { liste: true })}</div>`]),
    `<div id="fin" class="${fin ? '' : 'ferme'}" data-piece="fin-du-tour">${rond('fin', 'maitre', { ferme: !fin })}<span class="rubrique ombre">Fin du tour</span></div>`,
  ];

  /* 5. Combat, le tour : la barre de l'actif (valeurs à gauche, portrait au centre, actions à droite, rangées par
     familles en onglets au-dessus de leur rangée), ce qui s'y pose, les offres du champ */
  const PICTO_DE_L_ACTION = {
    attaque: 'attaque', course: 'botte', defensive: 'defensive', incantation: 'sort', focalisation: 'focaliser', avantage: 'competence',
    'usage-objet': 'objet', depot: 'poser', panoplie: 'armes', munition: 'munition', 'abandon-poste': 'sortie',
    'mise-en-selle': 'monter', 'service-poste': 'servir', poussee: 'pousser', 'annulation-deplacement': 'annuler', pause: 'pause',
    'manoeuvre-du-navire': 'barre', bordee: 'canon',
  };
  const refusDe = (a) => (a.refus && a.survol ? raison(echapper(a.refus)) : '');
  const fermeeDe = (a, adverse) => adverse || !!a.fermee || !!a.refus;
  /* les actions d'une famille de plaques, chacune à sa place de la rangée */
  const plaquesDe = (f, b) => places('socle', Object.fromEntries(f.actions.map((a, k) => [`plaque-${k + 1}`, plaque(`${echapper(a.libelle)}${refusDe(a)}`, { icone: PICTO_DE_L_ACTION[a.id], armee: !!a.armee, fermee: fermeeDe(a, b.adverse) })])));
  /* les familles de la barre, dans l'ordre de leurs onglets : chacune garde sa place, présente ou non */
  const FAMILLES = {
    action: (f, b) => plaquesDe(f, b),
    situation: (f, b) => plaquesDe(f, b),
    gestes: (f, b) => places('socle', Object.fromEntries(f.actions.map((a, k) => [`geste-${k + 1}`, outil(PICTO_DE_L_ACTION[a.id], echapper(a.libelle), { ouvert: !!a.ouverte, ferme: fermeeDe(a, b.adverse) })]))),
    rapides: (f) => `<div class="rapides">${f.sorts.map((n, k) => `<div class="case-r">${plaque('', { icone: n ? 'sort' : null, numero: k + 1, armee: k === f.arme, fermee: !n })}<span class="rubrique">${n ? echapper(n) : 'Libre'}</span></div>`).join('')}</div>`,
  };
  const valeursDe = (b) => {
    const c = qui(b.qui);
    if (b.adverse) return mesure('Blessures', `${c.blessures} / ${c.max}`);
    return `${mesure('Blessures', `${c.blessures} / ${c.max}`)}
      ${b.charge ? mesure('Chargé', `${b.charge.reste} / ${b.charge.sur}`, 'or') : `<div class="mesure"><div class="tete rubrique"><span>Mouvement</span><b>${b.mouvement.reste} / ${b.mouvement.sur}</b></div>${rangDePas({ pleins: b.mouvement.reste, total: b.mouvement.sur })}</div>`}
      <div class="jeton">${sceau('epee')}<div class="v"><span class="rubrique">Action</span> <em>${b.action ? 'disponible' : 'dépensée'}</em></div></div>
      <div class="jeton"><div class="chiffre">${b.avantage}</div><div class="v"><span class="rubrique">Avantage</span></div></div>
      <div class="tiers">${b.determination === undefined ? '' : reserves([jetonDe({ id: 'determination', nom: 'Détermination', valeur: b.determination })])}
      <div class="portes"><span class="rubrique">États</span>${c.etats.map(etatPorte).join('') || '<em>aucun</em>'}</div></div>`;
  };
  const barre = (b) => {
    const c = qui(b.qui), ouverte = b.familles.find((f) => f.id === b.ouverte);
    return [
      cadre('barre', null, null, null, null, '', `<div id="etat">${valeursDe(b)}</div><div id="gestes" class="${ouverte.id}">${FAMILLES[ouverte.id](ouverte, b)}</div>`, {
        classe: b.adverse ? 'adverse' : '', piece: 'socle',
        tete: `${onglets(Object.keys(FAMILLES).map((id) => { const f = b.familles.find((x) => x.id === id); return f && echapper(f.nom); }), echapper(ouverte.nom), 'socle')}<div id="tour-outils">${b.outils.map((a) => rond(PICTO_DE_L_ACTION[a.id], 'petit', { ferme: fermeeDe(a, b.adverse) })).join('')}</div>${clouer()}`,
      }),
      `<div id="actif-portrait">${portrait(c.buste, { camp: c.ennemi ? 'ennemi' : 'heros', taille: 'maitre' })}</div>`,
      `<div id="actif-nom">${nom({ texte: echapper(c.nom), cle: "nom de l'actif" })}<div class="a rubrique">${echapper(b.arme)}</div></div>`,
    ];
  };
  /* le corps d'un aperçu du tour (une cible, un sort), chaque part à sa place fixe : la ligne de jauge, vide sans elle,
     l’en-tête, la table à hauteur fixe qui défile si elle déborde, le pied */
  const corpsDuTour = ({ pv = '', titre, lignes, pied }) => `<div class="pv">${pv}</div><div class="entete rubrique">${titre}</div>${tableDApercu(lignes)}<div class="pied">${glose({ texte: pied })}</div>`;
  const ficheDuSort = (s, sous, vers) => apercu({ nom: echapper(s.nom), sous, vers, corps: corpsDuTour({ titre: `Sort${separateur('median')}coûte ${echapper(s.cout)}`,
    lignes: `<tr><td>Niveau d’incantation</td><td>${s.ni}</td></tr><tr><td>Portée</td><td>${s.portee.metres} mètres (${echapper(s.portee.selon)})</td></tr><tr><td>Cible</td><td>${s.cibles}</td></tr><tr><td>Durée</td><td>${echapper(s.duree)}</td></tr>`,
    pied: echapper(s.note) }) });
  const DESSINS_D_ARME = {
    epee: '<path d="M18 62L58 22l6-8-8 6L16 60z" fill="#d9d3c2" stroke="#1a1005" stroke-width="1.500"/><path d="M14 52l14 14M12 68l6-6" stroke="#e2c06a" stroke-width="3.500"/>',
    bouclier: '<path d="M40 12l24 8v18c0 15-10 25-24 30-14-5-24-15-24-30V20z" fill="#6f4d30" stroke="#1a1005" stroke-width="1.500"/><path d="M40 12v56M16 34h48" stroke="#e2c06a" stroke-width="2.500"/><circle cx="40" cy="34" r="6" fill="#b9b3a4" stroke="#1a1005" stroke-width="1.500"/>',
  };
  const armeDeLaFiche = (a) => `<div class="arme">
      <div class="vignette laiton"><div><svg viewBox="0 0 80 80" fill="none" stroke-linecap="round" stroke-linejoin="round">${DESSINS_D_ARME[a.id]}</svg></div></div>
      <div class="texte">${nom({ texte: echapper(a.nom), taille: 'grand' })}
        <div class="mesures">${disque(a.test, { taille: 'grand' })}${rubrique({ texte: 'Test' })}
          <div class="m"><span class="rubrique">Dégâts</span><b>+BF+${a.degats.bonus} (${a.degats.total})</b></div><div class="m"><span class="rubrique">Allonge</span><b>${echapper(a.allonge)}</b></div></div>
        ${a.atouts.length ? `<div class="atouts">${a.atouts.map((t) => etiquette({ texte: echapper(t), variante: 'pastille' })).join('')}</div>` : ''}</div>
    </div>`;
  const ficheDuCombattant = (f) => {
    const c = qui(f.qui);
    return [`<div id="fiche-lue"${mobile('ancre')}>`,
      `<div id="f-identite" class="cadre bois" data-piece="fiche-identite"><div class="fond parchemin">
        <div class="tete">${portrait(c.buste, { camp: c.ennemi ? 'ennemi' : 'heros', taille: 'maitre' })}<div>${nom({ texte: echapper(c.nom), taille: 'grand' })}${sousTitre({ texte: echapper(f.peuple) })}${sousTitre({ texte: echapper(f.carriere) })}</div></div>
        ${mesure('Blessures', `${c.blessures} / ${c.max}`)}${filet({ losange: true })}
        ${reserves(f.reserves.map(jetonDe), 'grand')}
      </div>${ferrures}</div>`,
      `<div id="f-profil" class="cadre bois" data-piece="fiche-profil"><div class="fond parchemin">${f.caracteristiques.map((k) => `<div class="carac"><span class="rubrique">${echapper(k.nom)}</span><b class="chiffres">${k.valeur}</b></div>`).join('')}</div>${ruban('Caractéristiques')}${ferrures}</div>`,
      `<div id="f-figure" class="cadre bois" data-piece="fiche-figure"><div class="fond bois"><div class="niche laiton"><div><svg viewBox="-34 -82 68 96" id="figure-lue"></svg></div></div></div>${ferrures}</div>`,
      `<div id="f-sections" class="cadre bois" data-piece="fiche-sections"><div class="fond parchemin">${f.armes.map(armeDeLaFiche).join('')}</div>${onglets(f.sections.map(echapper), echapper(f.ouverte))}${ferrures}</div>`,
      croix(), '</div>',
    ];
  };
  const POSES = {
    sort: (p, e) => {
      const rapides = e.barre.familles.find((f) => f.id === 'rapides');
      return [`<div id="apercu-sort" class="${p.depuis}">${ficheDuSort(p.sort, p.depuis === 'rapide' ? `Touche ${rapides.sorts.indexOf(p.sort.nom) + 1}` : 'Sort', p.depuis === 'rapide' ? 'bas' : 'droite')}</div>`];
    },
    cible: (p) => {
      const c = qui(p.qui);
      return [`<div id="apercu-cible">${apercu({ nom: echapper(c.nom), sous: 'Cible', vers: 'gauche', corps: corpsDuTour({
        pv: `${jauge(c.blessures / c.max, { taille: 'forte' })}<b>${c.blessures} / ${c.max}</b>`, titre: `Attaque${separateur('median')}${echapper(p.arme)}`,
        lignes: `<tr class="seuil"><td>${echapper(p.test)}</td><td>≤ ${p.seuil}</td></tr><tr><td>dont Avantage</td><td>${signe(p.avantage)}</td></tr><tr><td>Dégâts</td><td>${signe(p.degats)}</td></tr><tr><td>${echapper(c.nom)} oppose</td><td>${echapper(p.oppose)}</td></tr>`,
        pied: echapper(p.note) }) })}</div>`];
    },
    /* le journal entier défile, la ligne neuve en vue au pied */
    journal: (p) => [`<div id="journal-entier" class="cadre bois" data-piece="journal-entier"><div class="fond parchemin">
      ${defile(p.rounds.map((r) => `${filet()}${rubrique({ texte: `Round ${r.round}` })}${r.lignes.map((l, k) => `<p data-texte="journal ${r.round}.${k}">${echapper(l)}</p>`).join('')}`).join(''), 'au-pied', { liste: true })}
    </div>${ruban('Journal')}${ferrures}</div>`],
    fiche: (p) => ficheDuCombattant(p.fiche),
  };
  /* une offre posée sur l'entité du champ qui la porte (`surface: 'pastille-entite'`) : sa case et sa hauteur au-dessus */
  const ENTITES = { monture: [[9, 9], 138], piece: [[11.5, 8.5], 86] };
  const offre = (o) => { const [[i, j], haut] = ENTITES[o.sur]; const [x, y] = P(i, j); return `<div class="pastille-entite" data-piece="pastille ${echapper(o.libelle)}"${mobile('scene')} style="left:${x / 12.8}%;top:${y - haut}px">${rond(PICTO_DE_L_ACTION[o.id], 'petit')}<span class="rubrique ombre">${echapper(o.libelle)}</span></div>`; };
  /* les poses mobiles qui couvrent le rect du journal */
  const CEDENT_LE_JOURNAL = ['cible', 'fiche'];
  const tourDeCombat = (e) => [
    SYSTEME,
    ...combat(e.combat, { fin: !e.barre.adverse, lu: e.pose?.role === 'fiche' ? e.pose.fiche.qui : null, journal: e.pose?.role === 'journal', cede: CEDENT_LE_JOURNAL.includes(e.pose?.role) }),
    ...barre(e.barre),
    ...(e.liste ? [`<div id="liste" class="cadre bois" data-piece="liste"${mobile('ancre')}><div class="fond">${rubrique({ texte: echapper(e.liste.titre) })}${e.liste.lignes.map((l, k) => (typeof l === 'string' ? plaque(echapper(l), { armee: k === e.liste.choisie, classe: 'ligne-l' }) : plaque(echapper(l.nom), { armee: k === e.liste.choisie, classe: 'ligne-l', prix: `${l.enSoute} en soute` }))).join('')}</div>${ferrures}</div>`] : []),
    ...(e.pose ? POSES[e.pose.role](e.pose, e) : []),
    ...(e.offres ?? []).map(offre),
  ];

  /* 7. Ce que rend une victoire, dans une fenêtre du bas sous la bannière : l'Expérience et l'argent, les vaincus, le
     butin, à qui va chaque objet ; l'action unique de l'issue en pied */
  const butin = (b, action) => bandeauDuJet('Butin', 'butin', places('fenetre', {
    gauche: `<div class="gains">${reserves([jetonDe({ id: 'experience', nom: 'Expérience', valeur: b.experience })], 'grand')}<div class="argent"><b class="gothique">${b.argent.shillings}/${b.argent.pence}</b><span class="rubrique">Argent</span></div></div>`,
    centre: `<div class="vaincus">${rubrique({ texte: 'Vaincus' })}${b.vaincus.map((v) => `<div class="v">${echapper(v.nom)} ×${v.nombre}${v.depecer ? options([['Dépecer']]) : ''}</div>`).join('')}</div>`,
    droite: `<div class="lignes-b">${rubrique({ texte: 'Butin, à qui va chaque objet' })}${b.objets.map((o) => `<div class="ligne-b"><span data-texte="butin ${echapper(o.nom)}">${echapper(o.nom)}</span><i class="rubrique">Attribuer</i>${o.pour.map((h) => portrait(h, { taille: 'menu' })).join('')}</div>`).join('')}</div>` }),
  [plaque(echapper(action), { armee: true, taille: 'geste' })]);

  /* ───────── les options ───────── */
  const curseur = (v, min, max, texte = v, l = 118) => `<span class="curseur">${reglette((v - min) / (max - min), l)}<span class="val gothique">${texte}</span></span>`;
  const valeurDe = (p, l) => ('oui' in p ? ouiNon(p.oui) : 'pourcent' in p ? curseur(p.pourcent, 0, 100, `${p.pourcent} %`, 104)
    : 'valeurs' in p ? segments(p.valeurs.map(echapper), echapper(p.valeurs[p.tenue]))
      : 'liste' in p ? `<span class="pas-a-pas">${picto('gauche', 15, '#5a4530', 2)}<b class="rubrique">${echapper(p.liste)}</b>${picto('droite', 15, '#5a4530', 2)}</span>`
        : curseur(p.valeur, p.min, p.max, p.signe ? signe(p.valeur) : p.valeur, l));
  const pref = (p) => `<div class="pref"><div class="l"><b>${echapper(p.nom)}</b>${valeurDe(p, 104)}</div>${p.aide ? glose({ texte: echapper(p.aide) }) : ''}</div>`;
  /* une règle maison ; la pointée lit son aide, et la raison qui ferme les règles quand un combat les verrouille */
  const regleMaison = (verrou) => (r) => `<div class="regle ${r.aide ? 'pointee' : ''} ${r.modifiee ? 'modifiee' : ''}">
    <div class="t"><b data-texte="règle ${echapper(r.nom)}">${echapper(r.nom)}</b>${r.maison ? '<span class="ref rubrique">hors du livre</span>' : ''}</div>
    <div class="c">${r.modifiee ? etiquette({ texte: `${picto('annuler', 12, undefined, 2)}Défaut` }) : ''}${valeurDe(r, 118)}</div>
    ${r.aide ? glose({ texte: echapper(r.aide), cle: 'aide', secondaire: true }) : ''}${r.action ? `<div class="action">${plaque(echapper(r.action), { armee: true, icone: 'etoile' })}</div>` : ''}${verrou && r.aide ? raison(echapper(verrou)) : ''}</div>`;
  const ecranDesOptions = (o) => {
    const { ouvert } = o;
    const domaine = o.domaines.find((d) => d.nom === ouvert.domaine);
    const modifiees = ouvert.gauche.concat(ouvert.droite).filter((r) => r.modifiee).length;
    return [fondDeTable(),
      cartouche({ icone: 'systeme', nom: echapper(o.titre.nom), sous: echapper(o.titre.sous), taille: 'titre' }),
      `<div id="preferences" class="cadre bois" data-piece="colonne-gestion"><div class="fond bois">${o.son.map(pref).join('')}${filet()}${o.jeu.map(pref).join('')}</div>${ruban('Préférences')}${ferrures}</div>`,
      signets(o.domaines.map((d) => ({ nom: echapper(d.nom), compte: d.regles, marque: !!d.modifiees })), echapper(ouvert.domaine)),
      `<div id="registre" class="reglages${o.verrou ? ' verrou' : ''}" data-piece="registre"><div class="tranche"></div>
        <div class="feuille g parchemin">
          <div class="tete">${titre({ texte: echapper(domaine.nom), cle: 'domaine' })}${sousTitre({ texte: `Règles maison${separateur('median')}${pluriel(domaine.regles, 'règle')}` })}</div>
          ${filet({ losange: true })}${ouvert.gauche.map(regleMaison(o.verrou)).join('')}
          <div class="pied">${rond('gauche', 'petit', { ferme: ouvert.feuillet === 1 })}${glose({ texte: `Feuillet ${ouvert.feuillet} sur ${ouvert.feuillets}` })}${modifiees ? `<span class="marque">${sceau('plume', 'menu')}<i>${pluriel(modifiees, 'règle')} ${modifiees > 1 ? 'modifiées' : 'modifiée'}</i></span>` : ''}</div>
        </div>
        ${ouvert.droite.length ? `<div class="feuille d parchemin">
          <div class="tete">${sousTitre({ texte: `${echapper(domaine.nom)}, suite` })}${sousTitre({ texte: `Règles ${ouvert.gauche.length + 1} à ${ouvert.gauche.length + ouvert.droite.length} sur ${domaine.regles}` })}</div>
          ${filet({ losange: true })}${ouvert.droite.map(regleMaison(o.verrou)).join('')}
          <div class="pied"><span class="suite"><span class="rubrique">Feuillet suivant</span>${rond('droite', 'petit')}</span></div>
        </div>` : '<div class="feuille d parchemin"></div>'}
        ${CLOUS}</div>`,
      croix()];
  };

  /* ───────── le système : les sauvegardes, la fin de séance ───────── */
  /* un instant de la partie : sa date impériale, son heure ; le lieu en tête */
  const dateDe = (i) => `${i.jour} ${echapper(i.mois)} ${i.annee} CI`;
  const instantDe = (i) => `${echapper(i.lieu)}${separateur('median')}${dateDe(i)}${separateur('median')}${i.heure}`;
  /* les sauvegardes : un feuillet par emplacement, ce que la sauvegarde porte ; « Charger » si plein, « Sauvegarder » sur
     un emplacement manuel, fermé avec sa raison ; l'avis d'un emplacement retiré */
  const emplacementDe = (s) => (e) => `<div class="feuillet cadre bois${e.vise ? ' vise' : ''}${e.partie ? '' : ' vide'}"><div class="fond parchemin">
    ${e.partie ? `${titre({ texte: echapper(e.partie.instant.lieu), cle: `lieu ${echapper(e.partie.instant.lieu)}` })}<div class="date rubrique">${dateDe(e.partie.instant)}${separateur('median')}${e.partie.instant.heure}</div>
      ${filet({ losange: true })}<div class="reel chiffres">Sauvegardée le ${e.partie.le.date} ${e.partie.le.heure}</div>`
    : `<div class="blanc">${filet({ losange: true })}<em>— vide —</em>${filet({ losange: true })}</div>`}
    <div class="gestes">${e.partie ? plaque('Charger', { armee: !!e.vise }) : ''}${e.auto ? '' : s.refus ? plaque(`Sauvegarder${e.survol ? raison(echapper(s.refus)) : ''}`, { fermee: true }) : plaque('Sauvegarder')}</div>
  </div>${ruban(echapper(e.nom))}${ferrures}</div>`;
  const sauvegardes = (s) => [fondDeTable(),
    cartouche({ icone: 'disque', nom: echapper(s.titre.nom), sous: instantDe(s.titre.instant), taille: 'titre' }), croix(),
    `<div id="feuillets" data-piece="emplacements">${s.emplacements.map(emplacementDe(s)).join('')}</div>`,
    ...(s.avis ? [`<div id="avis" data-piece="avis">${sceau('disque')}<span class="ombre" data-texte="avis">${echapper(s.avis)}</span></div>`] : [])];

  /* la fin de séance : ce que la séance vaut à chaque héros (ses Ambitions et celles du groupe accomplies, +1 Détermination
     pour qui a agi selon sa Motivation), ses trois cases ; les deux cases du groupe */
  const TERMES = { courte: 'court', longue: 'long' };
  const pxDeLaSeance = (s, h) => Object.keys(TERMES).reduce((n, t) => n + s.px[t] * (!!h.coches[t] + !!s.groupe[t]), 0);
  const gainDeLaSeance = (s, h) => `<div class="gain"><b class="chiffres">+${pxDeLaSeance(s, h)} PX</b>${h.coches.motivation ? '<span class="rubrique">+1 Détermination</span>' : ''}</div>`;
  const caseDeMotivation = (h) => cochable('A agi selon sa Motivation', '+1 Détermination', !!h.coches.motivation);
  const caseDAmbition = (s, h, t) => cochable(`Ambition à ${TERMES[t]} terme accomplie`, `+${s.px[t]} PX`, !!h.coches[t]);
  const casesDuGroupe = (s) => Object.keys(TERMES).map((t) => cochable(`Ambition de groupe à ${TERMES[t]} terme accomplie`, `+${s.px[t]} PX à chaque héros`, !!s.groupe[t])).join('');
  const blocDeSeance = (rubrique, droite, corps) => `<div class="bloc"><div class="l rubrique"><span>${rubrique}</span><span>${droite}</span></div>${corps}</div>`;
  const ecritDe = (texte, absent) => `<p class="ecrit${texte ? '' : ' absent'}">${echapper(texte ?? absent)}</p>`;
  const ambitionDe = (s, h, t) => blocDeSeance(`Ambition à ${TERMES[t]} terme`, '', `${ecritDe(h[t], `Aucune Ambition à ${TERMES[t]} terme notée`)}${caseDAmbition(s, h, t)}
    ${h.nouvelle === t ? `<div class="nouvelle-ambition">${picto('plume', 15, '#5a2a12', 1.7)}<em>Nouvelle Ambition à ${TERMES[t]} terme</em><i></i></div>` : ''}`);
  const feuilletDeSeance = (s) => (h) => `<div class="seance-heros cadre bois"><div class="fond parchemin">
    <div class="tete">${portrait(h.id)}<div class="qui">${nom({ texte: echapper(h.nom), cle: `héros ${echapper(h.nom)}` })}${sousTitre({ texte: echapper(h.carriere) })}</div>${gainDeLaSeance(s, h)}</div>
    ${blocDeSeance('Motivation', `Détermination ${h.determination.n} / ${h.determination.sur}`, `${ecritDe(h.motivation)}${caseDeMotivation(h)}`)}
    ${ambitionDe(s, h, 'courte')}${ambitionDe(s, h, 'longue')}
  </div>${ferrures}</div>`;
  /* la fin de séance, sur le jeu assombri : un feuillet par héros, le groupe, l'action de coin ; la croix referme sans
     rien octroyer */
  const finDeSeance = (f) => [
    cartouche({ icone: 'plume', nom: echapper(f.titre.nom), sous: instantDe(f.titre.instant), taille: 'titre' }), croix(),
    `<div id="feuillets" data-piece="feuillets-de-seance">${f.seance.heros.map(feuilletDeSeance(f.seance)).join('')}</div>`,
    `<div id="groupe" class="cadre bois" data-piece="groupe-de-seance"><div class="fond bois"><div class="cases">${casesDuGroupe(f.seance)}</div><p data-texte="chance">${echapper(f.seance.chance)}</p></div>${ruban('Le groupe')}${ferrures}</div>`,
    `<div class="action-de-coin" data-piece="action-de-coin">${plaque(echapper(f.action), { armee: true })}</div>`,
  ];

  /* ───────── l'ouverture ───────── */
  /* un instant de la partie, son lieu en petites capitales */
  const lieuEtInstant = (i) => `<span class="rubrique">${echapper(i.lieu)}</span>${separateur('median')}${dateDe(i)}${separateur('median')}${i.heure}`;
  /* le grand titre libre, chaque part à sa place (`titre-libre/*`) : son sur-titre, son nom en gothique dorée, le filet,
     ce qui le suit ; au chapitre, le chapitre sur sa toile et le corps (le texte ou la clôture), sous le cadre */
  const titreLibre = (id, sur, nom, { filet: trait = false, suite = '', toile = '', corps = '' }) => `<div id="${id}" class="titre-libre" data-piece="titre-libre">${places('titre-libre', {
    sur: `<div class="sur rubrique ombre">${echapper(sur)}</div>`, nom: `<div class="nom gothique" data-texte="titre">${echapper(nom)}</div>`,
    filet: trait && filet({ losange: true, or: true }), suite, toile, corps })}</div>`;
  const plaqueDEntree = (e) => plaque(echapper(e.libelle), { armee: !!e.principale, icone: e.id, taille: 'appel' });
  /* la colonne des entrées, chacune à sa place (`entrees/*`) : la principale, sous elle l'instant qu'elle reprend, les
     autres ; `fin` : ce qui suit les autres */
  const entreesDe = (entrees, instant, fin = '') => `<div id="entrees" data-piece="entrees">${places('entrees', {
    principale: plaqueDEntree(entrees[0]), reprise: `<div class="reprise ombre">${lieuEtInstant(instant)}</div>`, autres: `${entrees.slice(1).map(plaqueDEntree).join('')}${fin}` })}</div>`;
  /* l'écran titre : le titre, les entrées de jeu (la dernière sauvegarde sous la principale, qu'elle charge), les outils */
  const accueil = (a) => [
    titreLibre('blason', a.titre.sur, a.titre.nom, { filet: true, suite: `<div class="campagne gothique ombre">${echapper(a.titre.campagne)}</div>` }),
    entreesDe(a.entrees, a.derniere),
    `<div id="outils" data-piece="outils">${a.outils.map((o) => outil(o.id, echapper(o.libelle), { taille: 'grand' })).join('')}</div>`,
  ];
  /* le menu de la partie : le titre, les entrées (l'instant de la partie sous « Reprendre »), la sortie sous un trait, la
     pastille du système */
  const menuDeLaPartie = (m) => [
    titreLibre('pause', m.titre.sur, m.titre.nom, { filet: true }),
    entreesDe(m.entrees, m.instant, `${filet({ fondu: true, or: true })}${plaqueDEntree(m.quitter)}<div class="dernier ombre">Dernière sauvegarde automatique à ${m.derniereAuto}.</div>`),
    `<div id="coins" data-piece="coins">${rond('systeme', 'grand', { arme: true })}</div>`,
  ];
  /* la clôture d'un chapitre : son sous-titre, ce que la route retiendra (les objectifs soldés, les PX), les lieux révélés,
     les héros tombés */
  const bande = (titre, droite = '') => `<div class="bande rubrique ombre"><span>${titre}</span>${droite}</div>`;
  const solde = (texte, k) => `<div class="solde">${rond('coche', 'menu', { arme: true })}<span class="ombre" data-texte="objectif ${k + 1}">${echapper(texte)}</span></div>`;
  const clotureDe = (c) => `<p class="ombre" data-texte="sous-titre">${echapper(c.sous)}</p>
    ${bande('Ce que la route retiendra', `<span class="px">PX de la compagnie <b class="chiffres">+${c.px}</b></span>`)}${c.objectifs.map(solde).join('')}
    <div class="deux"><div>${bande('Lieux révélés')}<p class="ombre" data-texte="lieux">${c.lieux.map(echapper).join(separateur('median'))}</p></div>
      <div>${bande('Tombés en chemin')}<p class="ombre" data-texte="tombés">${c.tombes.length ? c.tombes.map(echapper).join(separateur('median')) : 'Aucune perte : la compagnie est entière.'}</p></div></div>`;
  /* la fin de séance que la clôture ouvre : une colonne par héros, ses trois cases ; celle du groupe */
  const colonneDeSeance = (s) => (h) => `<div class="col"><div class="tete">${portrait(h.id, { taille: 'petit' })}<div class="qui">${nom({ texte: echapper(h.nom), cle: `héros ${echapper(h.nom)}` })}${sousTitre({ texte: echapper(h.carriere) })}</div>${gainDeLaSeance(s, h)}</div>
    ${caseDeMotivation(h)}${caseDAmbition(s, h, 'courte')}${caseDAmbition(s, h, 'longue')}</div>`;
  const seanceDuChapitre = (s) => `<div id="seance" class="cadre bois" data-piece="seance-du-chapitre"><div class="fond bois">${s.heros.map(colonneDeSeance(s)).join('')}
    <div class="col groupe"><div class="tete"><div class="qui">${nom({ texte: 'Le groupe' })}${sousTitre({ texte: echapper(s.chance), cle: 'chance' })}</div></div>${casesDuGroupe(s)}</div>
  </div>${ruban('Fin de séance')}${ferrures}</div>`;
  /* le chapitre qui s'ouvre (la campagne, le texte du chapitre, la compagnie au bandeau) ou se clôt (sa clôture, la fin de
     séance) ; ses gestes en action de coin */
  const chapitre = (c) => [
    titreLibre('carton', c.sur, c.campagne.nom, { suite: `<div class="tome gothique ombre">${echapper(c.campagne.tome)}</div>`,
      toile: `<div class="toile-ombre"><div class="toile"><span class="gothique" data-texte="chapitre">${echapper(c.chapitre)}</span></div></div>`,
      corps: `${(c.texte ?? []).map((p, k) => `<p class="ombre" data-texte="texte ${k + 1}">${echapper(p)}</p>`).join('')}${c.cloture ? clotureDe(c.cloture) : ''}` }),
    ...(c.groupe ? [bandeauDu(c.groupe, undefined, 'La compagnie')] : []),
    ...(c.cloture ? [seanceDuChapitre(c.cloture.seance)] : []),
    `<div class="action-de-coin" data-piece="action-de-coin">${c.gestes.map((g) => plaque(echapper(g.libelle), { armee: !!g.principal })).join('')}</div>`,
  ];

  /* la nouvelle partie, dans la salle commune : recruter (l'onglet, les voyageurs dans la salle, en créer, en importer) ;
     les voyageurs debout, chacun sous son poste, « Recruter » au pied du visé ; les campagnes clouées au panneau, la
     choisie en affiche ; le groupe au bandeau, la place libre */
  const PICTO_DE_LA_CAMPAGNE = { route: 'route', fleuve: 'ancre', arene: 'epee', enquete: 'plume' };
  /* les voyageurs se rangent entre le panneau de recrue et celui des campagnes, en quinconce s'ils sont trop serrés ;
     le centre d'un poste reste à une demi-étiquette (un nom de 160 px) des deux colonnes */
  const SALLE = { gauche: 500, droite: 860, haut: 116, quinconce: 160, serre: 170 };
  const placesDesVoyageurs = (n) => {
    const pas = n > 1 ? (SALLE.droite - SALLE.gauche) / (n - 1) : 0, serres = pas < SALLE.serre;
    return Array.from({ length: n }, (_, k) => [n > 1 ? SALLE.gauche + k * pas : (SALLE.gauche + SALLE.droite) / 2, SALLE.haut + (serres && k % 2 ? SALLE.quinconce : 0)]);
  };
  const recruter = (n) => cadre('rail', null, null, null, null, 'bois', `<div class="deux">${plaque('Pré-tirés', { armee: n.onglet === 'pretires' })}${plaque('Mes personnages', { armee: n.onglet === 'roster' })}</div>
    ${glose({ texte: `${pluriel(n.salle.voyageurs.length, n.onglet === 'roster' ? 'personnage' : 'voyageur')} dans la salle, sur ${n.salle.total}` })}
    <div class="tourne">${rond('gauche', 'petit')}<span class="rubrique">D’autres voyageurs</span>${rond('droite', 'petit')}</div>
    ${filet()}${plaque('Créer un personnage', { icone: 'plume', classe: 'gauche' })}${plaque('Importer un personnage…', { icone: 'disque', classe: 'gauche' })}`, { ruban: 'Recruter', piece: 'colonne-gauche' });
  const salleDe = (n) => {
    const places = placesDesVoyageurs(n.salle.voyageurs.length);
    return `<div id="salle">${n.salle.voyageurs.map((v, k) => { const [cx, y] = places[k];
      return `${poste(cx, y, { nom: echapper(v.nom), sous: echapper(v.carriere), heros: v.id, vise: !!v.vise, piece: `voyageur ${v.id}` })}${v.vise ? `<div id="recruter" data-piece="recruter"${mobile('scene')} style="left:${cx - 75}px;top:${y + 105}px">${plaque('Recruter', { armee: true, icone: 'plus', taille: 'petite' })}${n.onglet === 'roster' ? `<div class="du-roster">${outil('disque', 'Exporter')}${outil('croix', 'Supprimer')}</div>` : ''}</div>` : ''}`; }).join('')}</div>`;
  };
  const avisDe = (c) => `<div class="avis parchemin"><i class="clou"></i>${picto(PICTO_DE_LA_CAMPAGNE[c.genre], 17, '#5a2a12', 1.6)}${nom({ texte: echapper(c.nom), cle: `campagne ${echapper(c.nom)}` })}</div>`;
  const campagnesDe = (n) => cadre('campagnes', null, null, null, null, 'bois', `<div class="affiche parchemin"><i class="clou" style="left:14px"></i><i class="clou" style="right:14px"></i>
      <div class="sur rubrique">${echapper(n.campagne.sur)}</div>${titre({ texte: echapper(n.campagne.nom), cle: 'campagne' })}<div class="ch rubrique">${echapper(n.campagne.chapitre)}</div>
      ${filet({ losange: true })}<p data-texte="description">${echapper(n.campagne.texte)}</p>${plaque('Lancer', { armee: true, icone: 'route' })}<div class="cachet">${sceau(PICTO_DE_LA_CAMPAGNE[n.campagne.genre], 'moyen')}</div></div>
    <div class="avis-cloues">${n.campagnes.map(avisDe).join('')}</div>`, { ruban: 'Campagnes' });
  const renvoi = (modifier) => `<div class="renvoi"><span>${picto('croix', 11, undefined, 1.8)}<span class="rubrique">Renvoyer</span></span>${modifier ? `<span>${picto('plume', 12, undefined, 1.6)}<span class="rubrique">Modifier</span></span>` : ''}</div>`;
  const placeLibre = (l) => (l.siege ? { html: `<div class="siege"><span class="rubrique">Siège</span>${segments(l.siege.valeurs.map(echapper), echapper(l.siege.valeurs[l.siege.tenue]))}</div>` } : { texte: echapper(l.dit) });
  const nouvellePartie = (n) => [
    cartouche({ icone: 'chope', nom: echapper(n.titre.nom), sous: `${echapper(n.titre.sous)}${separateur('median')}${n.titre.places.n} sur ${n.titre.places.sur}`, taille: 'titre' }), croix(),
    recruter(n), salleDe(n), campagnesDe(n),
    bandeau({ ...Object.fromEntries(n.groupe.map((h) => [h.id, { html: renvoi(n.modifier) }])), libre: placeLibre(n.libre) },
      { groupe: [...n.groupe.map((h) => ({ id: h.id, nom: echapper(h.nom), car: echapper(h.carriere) })), { nom: echapper(n.libre.nom), car: echapper(n.libre.sous) }] }),
  ];

  /* ───────── les outils ───────── */
  /* la prose d'une donnée, son gras Markdown rendu ; au champ de l'atelier, telle qu'elle s'écrit */
  const prose = (t) => echapper(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  /* le Compendium, plein écran de consultation (`../dispositions.md`, « Par type d'écran », 9) : la barre (retour et
     suivant, la recherche dans tout le Compendium, le fil, la bascule de l'atelier, la croix) ; la liste de la catégorie,
     ou les résultats de la recherche, qui défile, son rail de lettres ; la fiche de l'entrée lue, ses renvois en onglets
     comptés qui défilent, ou son atelier ; l'Index posé par-dessus la liste et la fiche */
  const sourceDe = (s) => `${echapper(s.livre)} p. ${s.page}`;
  const lien = (t, classe = '') => `<span class="lien ${classe}">${t}</span>`;
  const barreDuCompendium = (c) => `<div id="barre-du-compendium" class="bois" data-piece="barre-du-compendium">${medaillon('livre', { taille: 'moyen', inerte: true })}
    ${titre({ texte: echapper(c.titre), cle: 'titre', ecran: true })}${rond('gauche', 'petit')}${rond('droite', 'petit', { ferme: true })}
    <div class="fond bois">${champ('', echapper(c.recherche?.texte ?? ''), { attente: 'Rechercher dans tout le Compendium…' })}</div>
    <span class="fil rubrique" data-texte="fil">${c.recherche
    ? `${pluriel(c.recherche.groupes.reduce((n, g) => n + g.entrees.length, 0), 'résultat')} dans ${pluriel(c.recherche.groupes.length, 'catégorie')}`
    : `${lien(echapper(c.fil[0]))} › ${lien(echapper(c.fil[1]))} › <b>${echapper(c.entree.nom)}</b>`}</span>
    ${plaque('Atelier', { icone: 'plume', armee: !!c.atelier, taille: 'petite' })}${croix({ dansLePanneau: true })}</div>`;
  /* le filtre de livre : les deux livres les plus fournis, les autres derrière leur nombre */
  const filtreDeLivre = (livres) => {
    const tries = [...livres].sort((a, b) => b.entrees - a.entrees);
    return `<div class="livres"><span class="rubrique">Livre</span><div class="facettes">${tries.slice(0, 2).map((l) => etiquette({ texte: echapper(l.sigle), valeur: l.entrees })).join('')}${tries.length > 2 ? etiquette({ texte: `+${tries.length - 2}` }) : ''}</div></div>`;
  };
  const rangee = (e) => `<div class="rangee${e.pointee ? ' pointee' : ''}"><span>${echapper(e.nom)}</span><em class="chiffres">${echapper(e.livre)}</em></div>`;
  const listeDuCompendium = (c) => {
    const [tete, compte, corps] = c.recherche
      ? ['Résultats', c.recherche.groupes.reduce((n, g) => n + g.entrees.length, 0), c.recherche.groupes.map((g) => `<div class="groupe">${rubrique({ texte: echapper(g.categorie) })}<em class="chiffres">${g.entrees.length}</em></div>${g.entrees.map(rangee).join('')}`).join('')]
      : [c.categorie.nom, c.categorie.entrees, c.liste.entrees.map(rangee).join('')];
    const lue = c.entree.nom.normalize('NFD')[0].toUpperCase();
    return cadre('liste-du-compendium', null, null, null, null, 'bois', `<div class="tete-de-liste">${titre({ texte: echapper(tete), cle: 'catégorie' })}<em class="chiffres">${compte}</em></div>
      ${filtreDeLivre(c.livres)}<div class="corps-de-liste">${defile(corps, '', { liste: true })}<div class="rail rubrique">${[...c.liste.lettres].map((l) => `<b class="${!c.recherche && l === lue ? 'la' : ''}">${l}</b>`).join('')}</div></div>`);
  };
  /* les renvois : un onglet par groupe et son compte, toutes ses entrées, qui défilent */
  const renvoisDe = (c, legende) => {
    const ouvert = c.renvois.groupes.find((g) => g.rubrique === c.renvois.onglet);
    return `<div class="renvois"><div class="onglets-comptes">${c.renvois.groupes.map((g) => `<b class="${g === ouvert ? 'la' : ''}">${echapper(g.rubrique)}<em class="chiffres">${g.noms.length}</em></b>`).join('')}</div>
      ${rubrique({ texte: legende ?? `${ouvert.note ? `${echapper(ouvert.note)}${separateur('median')}` : ''}toutes, la colonne défile` })}
      ${defile(`<div class="noms">${ouvert.noms.map((n) => `<div class="nom-renvoi${c.survol?.renvoi === n.nom ? ' survol' : ''}">${lien(echapper(n.nom))}${n.note ? `<em class="chiffres">${echapper(n.note)}</em>` : ''}</div>`).join('')}</div>`, '', { liste: true })}</div>`;
  };
  /* l'aperçu du renvoi survolé, à sa gauche, sa pointe sur sa ligne (rangées de 26 px, `outils.css`) */
  const apercuDuRenvoi = (c) => {
    const k = c.renvois.groupes.find((g) => g.rubrique === c.renvois.onglet).noms.findIndex((n) => n.nom === c.survol.renvoi);
    return apercu({ nom: echapper(c.survol.nom), sous: echapper(c.survol.sous), vers: 'droite', style: `--rang:${k}`,
      corps: `<p><i>${echapper(c.survol.texte)}</i></p><div class="source-du-renvoi rubrique">${sourceDe(c.survol.source)}${separateur('median')}clic : ouvrir</div>` });
  };
  const teteDeFiche = (c, genre) => `<div class="tete">${titre({ texte: echapper(c.entree.nom), cle: 'entrée' })}${sousTitre({ texte: genre })}<span class="source chiffres">${sourceDe(c.entree.source)}</span>
    <span class="epingle rubrique">${picto('epingle', 15, 'currentColor', 1.8)}Épingler pour comparer</span></div>${filet()}`;
  const corpsDeFiche = (c) => `<div class="puces">${c.fiche.puces.map((p) => `<div class="puce"><span class="rubrique">${echapper(p.rubrique)}</span>${p.lien ? lien(echapper(p.valeur)) : echapper(p.valeur)}</div>`).join('')}</div>
    ${c.fiche.description.map((p, k) => `<p data-texte="description ${k + 1}">${c.fiche.liens.reduce((t, l) => t.replace(echapper(l), lien(echapper(l))), prose(p))}</p>`).join('')}`;
  const champDe = (f) => `<div class="${f.long ? 'long' : ''}">${champ(echapper(f.libelle), echapper(f.valeur).replace(/\n/g, '<br>'), { classe: `${f.long ? 'long' : ''}${f.saisi ? ' saisi' : ''}`, defile: !!f.long })}${f.aide ? `${glose({ texte: `${echapper(f.aide.texte)}${f.aide.lien ? ` ${lien(echapper(f.aide.lien))}` : ''}` })}` : ''}</div>`;
  const atelierDe = (c) => `<div class="formulaire">${c.atelier.paires.map((p) => `<div class="${p.length > 1 ? 'deux' : 'un'}${p.some((f) => f.long) ? ' long' : ''}">${p.map(champDe).join('')}</div>`).join('')}
      ${rubrique({ texte: 'Champs que l’entrée ne porte pas' })}<div class="facettes">${c.atelier.absents.map((n) => etiquette({ texte: `+ ${echapper(n)}` })).join('')}</div></div>`;
  const ficheDuCompendium = (c) => cadre('fiche-du-compendium', null, null, null, null, 'parchemin', `${teteDeFiche(c, c.atelier ? `Atelier${separateur('median')}${echapper(c.categorie.nom)}` : echapper(c.entree.genre))}
    <div class="corps-de-fiche${c.atelier ? ' atelier' : ''}"><div class="gauche">${c.atelier ? atelierDe(c) : corpsDeFiche(c)}</div>${renvoisDe(c, c.atelier ? 'Désignent cette entrée : « Supprimer » est fermé' : null)}</div>
    ${c.atelier ? `<div class="pied">${plaque('Enregistrer', { icone: 'disque', armee: true, taille: 'petite' })}${plaque('Abandonner', { taille: 'petite' })}${plaque(`Supprimer${raison(echapper(c.atelier.refus))}`, { fermee: true, taille: 'petite' })}</div>` : ''}
    ${c.survol ? apercuDuRenvoi(c) : ''}`);
  /* l'Index : les familles et leur nombre de catégories, l'ouverte ; ses catégories sur trois colonnes, ses sous-groupes
     en intertitres, le compte de chacune */
  const ligneDIndex = (k) => `<div class="ligne-d-index"><span>${echapper(k.nom)}</span><em class="chiffres">${k.entrees}</em></div>`;
  const indexDuCompendium = (c) => {
    const i = c.index, total = i.familles.reduce((n, f) => n + f.categories, 0);
    return cadre('index-du-compendium', null, null, null, null, 'bois', `<div class="tete-d-index">${titre({ texte: 'Index' })}${champ('', '', { attente: `Filtrer les ${total} catégories…` })}<span class="rubrique">${pluriel(i.familles.length, 'famille')}${separateur('median')}${total} catégories${separateur('median')}${i.entrees.toLocaleString('fr')} entrées</span></div>
      <div class="familles">${i.familles.map((f) => ligneDeListe(echapper(f.nom), f.categories, { la: f.nom === i.ouverte.nom })).join('')}</div>
      <div class="categories">${i.ouverte.categories.map(ligneDIndex).join('')}${i.ouverte.groupes.map((g) => `${rubrique({ texte: echapper(g.nom) })}${g.categories.map(ligneDIndex).join('')}`).join('')}</div>`, { classe: 'surcouche' })
      .replace('data-piece="index-du-compendium"', 'data-piece="index-du-compendium" data-surcouche');
  };
  const compendium = (c) => [fondDeTable(), barreDuCompendium(c), listeDuCompendium(c), ficheDuCompendium(c), ...(c.index ? [indexDuCompendium(c)] : [])];
  /* la coop, sur la table : la tablée et ses quatre sièges, chacun son joueur et les héros qu'il tient ; sans partie,
     rejoindre par le code et héberger ; en salon, l'invitation et l'attribution des héros et du Maître du Jeu */
  const siegeDe = (s) => (s.joueur
    ? `<div class="siege bois${s.joueur.vous ? ' vous' : ''}${s.joueur.absent ? ' absent' : ''}"><div class="q">${s.joueur.absent ? sceau('reseau') : medaillon('personnage', { taille: 'moyen' })}<div>${nom({ texte: echapper(s.joueur.nom), taille: 'grand', cle: `siège ${echapper(s.joueur.nom)}` })}<span class="rubrique">${echapper(s.joueur.qualite)}</span></div></div>
      <div class="tient">${s.heros.length ? s.heros.map((h) => portrait(h, { taille: 'petit' })).join('') : '<i>Aucun héros</i>'}</div></div>`
    : '<div class="siege vide"><div class="q"><div><b>Un siège à pourvoir</b></div></div></div>');
  const tableeDe = (c) => `<div id="tablee" data-piece="tablee">${tableDuSalon()}${c.sieges.map(siegeDe).join('')}<div class="legende rubrique ombre">${echapper(c.legende)}</div></div>`;
  const feuilletCoop = (id, piece, titre, corps) => `<div id="${id}" class="feuillet-coop cadre bois" data-piece="${piece}"><div class="fond parchemin">${corps}</div>${ruban(titre)}${ferrures}</div>`;
  /* un joueur, nommé de ce qu'il est : vous, ou l'hôte ; connecté, ou en reconnexion */
  const nomDuJoueur = (j) => `${echapper(j.nom)}${j.vous ? ' (vous)' : j.hote ? `${separateur('median')}hôte` : ''}`;
  const joueurDe = (j) => (j.absent ? `<div class="joueur absent">${sceau('reseau', 'menu')}${nomDuJoueur(j)} — reconnexion…</div>` : `<div class="joueur">${puce('losange')}${nomDuJoueur(j)}</div>`);
  const coop = (c) => [fondDeTable(),
    cartouche({ icone: 'reseau', nom: echapper(c.titre.nom), sous: echapper(c.titre.sous), taille: 'titre' }),
    ...(c.rejoindre ? [feuilletCoop('rejoindre', 'colonne-gestion', 'Rejoindre une partie', `<label class="champ"><span class="rubrique">Code de la partie</span><div class="cases chiffres">${[...c.rejoindre.code].map((x) => `<b>${echapper(x)}</b>`).join('')}</div></label>
      <div class="indice">${echapper(c.rejoindre.indice)}</div>${champ('Votre nom', echapper(c.rejoindre.nom))}${places('colonne-gestion', { geste: plaque(echapper(c.rejoindre.geste), { armee: true, icone: 'reseau' }) })}`)] : []),
    ...(c.invitation ? [cadre('invitation', null, null, null, null, 'bois', `<div class="code parchemin chiffres" data-texte="code">${echapper(c.invitation.code)}</div>
      ${rubrique({ texte: 'Joueurs connectés' })}<div>${c.invitation.joueurs.map(joueurDe).join('')}</div>${places('colonne-gestion', { geste: plaque(echapper(c.invitation.quitter), { icone: 'sortie' }) })}`, { ruban: 'Inviter — partagez le code', piece: 'colonne-gestion' })] : []),
    tableeDe(c),
    ...(c.heberger ? [feuilletCoop('heberger', 'volet-droit', 'Héberger une partie', `<p data-texte="aide">${echapper(c.heberger.aide)}</p>${champ('Votre nom', '', { attente: echapper(c.heberger.attente) })}
      ${plaque(echapper(c.heberger.geste), { fermee: true })}<div class="refus">${sceau('disque', 'menu')}<span>${echapper(c.heberger.refus)}</span></div>`)] : []),
    ...(c.attribution ? [cadre('attribution', null, null, null, null, 'parchemin', `${c.attribution.heros.map((h) => rang(h.id, { nom: echapper(h.nom), gothique: 'moyen', sous: echapper(h.carriere), fin: segments(c.attribution.joueurs.map(echapper), echapper(h.joueur)) })).join('')}
      <div class="mj"><div class="r">${nom({ texte: 'Maître du Jeu', taille: 'grand' })}<i>${echapper(c.attribution.maitre.note)}</i></div>${segments([c.attribution.maitre.sans, ...c.attribution.joueurs].map(echapper), echapper(c.attribution.maitre.joueur ?? c.attribution.maitre.sans))}</div>`, { ruban: 'Attribution des héros', piece: 'volet-droit' })] : []),
    croix()];

  /* ───────── l'éditeur ───────── */
  /* la barre : le projet, les documents, les gestes par groupe ; seul le principal garde son libellé à 1280, les autres
     leur pictogramme (`../dispositions.md`, « Outil d'édition ») ; la croix au bout */
  const gesteDeLaBarre = (g) => (g.principal ? plaque(echapper(g.libelle), { icone: g.id, armee: true, taille: 'petite' })
    : plaque('', { icone: g.id, fermee: !!g.ferme, taille: 'petite', classe: 'seule' }));
  const barreDe = (e) => `<div id="barre" class="cadre bois" data-piece="barre-d-outils"><div class="fond bois">${medaillon('plume', { taille: 'moyen', inerte: true })}
    <div>${titre({ texte: echapper(e.projet.nom), cle: 'titre', ecran: true })}${sousTitre({ texte: echapper(e.projet.sous) })}</div>
    ${segments(e.documents.map(echapper), echapper(e.document))}<div class="espace"></div>
    ${e.gestes.map((g) => `<div class="lot-de-gestes">${g.map(gesteDeLaBarre).join('')}</div>`).join('')}${croix({ dansLePanneau: true })}</div>${ferrures}</div>`;
  /* les volets de gauche, une seule colonne en onglets : l'ouvert, son contenu au plein de la grille des colonnes, ses
     gestes au pied (`colonne`) */
  const voletsDe = (e, contenu) => cadre('volets', null, null, null, null, 'bois', colonne('volets', contenu), { tete: onglets(e.volets.map(echapper), echapper(e.volet)) });
  const outilDePalette = (e) => (o) => `<div class="o${o.id === e.outil ? ' la' : ''}">${picto(o.id, 20, o.id === e.outil ? '#2a1a08' : '#e2c06a', 1.5)}<span>${echapper(o.libelle)}</span></div>`;
  const paletteDe = (e) => `<div class="outils">${e.outils.map(outilDePalette(e)).join('')}</div>`;
  const validationDe = (v) => `${rubrique({ texte: 'Validation' })}<div class="valide">${picto('coche', 15, '#3d5a1c', 2.2)}<span>${echapper(v)}</span></div>`;
  const renvoiDeLaLogique = (nom) => `<div class="renvoi">${echapper(nom)}${picto('droite', 14, '#5a4530', 2)}</div>`;
  const VALEURS_DE_PROPRIETE = {
    texte: (p) => `<span class="v">${echapper(p.texte)}</span>`,
    valeurs: (p) => segments(p.valeurs.map(echapper), echapper(p.valeurs[p.tenue])),
    oui: (p) => ouiNon(p.oui),
    defile: (p) => `<span class="pas-a-pas">${picto('gauche', 13, '#5a4530', 2)}<b class="rubrique">${echapper(p.defile)}</b>${picto('droite', 13, '#5a4530', 2)}</span>`,
    nombre: (p) => moinsPlus({ entre: `<b class="copies">${p.nombre}</b>` }),
  };
  const proprieteDe = (p) => `<div class="prop${p.grise ? ' gris' : ''}"><span>${echapper(p.libelle)}</span>${VALEURS_DE_PROPRIETE[Object.keys(VALEURS_DE_PROPRIETE).find((k) => k in p)](p)}</div>`;
  /* un geste dans le corps de l'inspecteur, une entrée parmi les autres */
  const gesteDeLInspecteur = (libelle, icone) => `<div class="geste">${plaque(libelle, { icone, taille: 'petite' })}</div>`;
  /* l'inspecteur, sur la grille des colonnes (`colonne`) : en tête ce qui est choisi, ou l'outil armé ; au corps ses
     propriétés, ou les options de l'outil (`liste` : celles d'un outil qui choisit parmi tous les genres du système, le
     terrain) ; au pied la validation, ou ce qui retire ce qui est choisi (`supprimer`) */
  const inspecteur = ({ genre, sous, corps, liste = false, validation, supprimer = '' }) => cadre('inspecteur', null, null, null, null, 'parchemin', colonne('inspecteur', {
    tete: `${titre({ texte: genre, cle: 'choisi' })}${sousTitre({ texte: sous })}${filet()}`, corps, liste,
    geste: validation ? validationDe(validation) : supprimer && plaque(supprimer, { icone: 'croix', taille: 'petite' }),
  }), { ruban: 'Inspecteur' });
  const inspecteurDe = (i, validation) => inspecteur({ genre: echapper(i.genre), sous: echapper(i.ou ?? i.options), validation, supprimer: echapper(i.supprimer ?? ''), liste: 'terrains' in i, corps: 'terrains' in i
    ? `${rubrique({ texte: 'Pinceau' })}<div class="pinceau">${segments(i.pinceaux.valeurs.map(echapper), echapper(i.pinceaux.valeurs[i.pinceaux.tenue]))}</div>
      ${rubrique({ texte: 'Terrains' })}<div class="terrains">${i.terrains.map((n) => `<b class="${n === i.terrain ? 'la' : ''}">${echapper(n)}</b>`).join('')}</div>`
    : `${i.nom ? champ('Nom', echapper(i.nom)) : ''}${i.proprietes.map(proprieteDe).join('')}
      ${i.inventaire ? `${rubrique({ texte: 'Inventaire' })}<div class="prop gris"><span>${echapper(i.inventaire.vide)}</span></div>${gesteDeLInspecteur(echapper(i.inventaire.ajouter), 'plus')}` : ''}
      ${i.troupe ? `${rubrique({ texte: 'Poser une troupe' })}${i.troupe.map(proprieteDe).join('')}` : ''}
      ${i.renvois.rubrique ? `${rubrique({ texte: echapper(i.renvois.rubrique) })}` : ''}${i.renvois.noms.map(renvoiDeLaLogique).join('')}` });
  const PICTO_DU_POINTE = { selection: 'selection', terrain: 'terrain' };
  /* l'éditeur de scène : le volet des scènes ou la palette, le plan quadrillé et ses couches, le pied, l'inspecteur */
  const editeurDeScene = (e) => [fondDeTable(), barreDe(e),
    voletsDe(e, e.volet === e.volets[0] ? { corps: e.scenes.noms.map((n) => ligneDeListe(echapper(n), '', { la: n === e.scenes.ouverte })).join(''), liste: true,
      geste: `<div class="gestes">${e.scenes.gestes.map((g, k) => plaque(echapper(g), { icone: k ? null : 'plus', taille: 'petite' })).join('')}</div>` } : { corps: paletteDe(e) }),
    `<div id="plan" class="cadre bois" data-piece="plan"><div class="fond">${planDeScene(e.plan)}</div>
      <div id="couches">${e.couches.noms.map((n, k) => plaque(echapper(n), { armee: k === e.couches.tenue, icone: k === e.couches.tenue ? 'couches' : null, taille: 'petite' })).join('')}${plaque(echapper(e.couches.ajouter), { icone: 'plus', taille: 'petite' })}${e.couches.retirer ? plaque(`${echapper(e.couches.retirer.libelle)}${raison(echapper(e.couches.retirer.refus))}`, { fermee: true, taille: 'petite' }) : ''}</div>
      <div id="nord" class="rubrique ombre">${picto('route', 18)}Nord : ${e.nord}° dans le sens horaire</div>${ferrures}</div>`,
    `<div id="pied" class="bois" data-piece="pied">${picto(PICTO_DU_POINTE[e.outil], 16)}<span data-texte="pointé">${e.pointe.map(echapper).join(separateur('median'))}</span><span class="v">${e.taille.cases[0]} × ${e.taille.cases[1]} cases${separateur('median')}${pluriel(e.taille.entites, 'entité')}</span></div>`,
    inspecteurDe(e.inspecteur, e.validation)];
  /* l'éditeur de la carte du monde : les lieux, les routes ou la palette ; la carte ; l'inspecteur du lieu choisi */
  const editeurDeLaCarte = (e) => {
    const lieu = (id) => e.lieux.find((l) => l.id === id), choisi = lieu(e.choisi), sesRoutes = e.routes.filter((r) => r.de === e.choisi || r.vers === e.choisi);
    const depuis = `Depuis ${echapper(choisi.nom)}`;
    const VOLETS = [
      () => ({ corps: e.lieux.map((l) => ligneDeListe(echapper(l.nom), '', { la: l.id === e.choisi, icone: 'epingle' })).join(''), liste: true }),
      () => ({ corps: `<div id="routes">${e.routes.map((r) => ligneDeListe(`${echapper(lieu(r.de).nom)} – ${echapper(lieu(r.vers).nom)}<small>${r.km} km${separateur('median')}${r.modes.map(echapper).join(', ')}</small>`)).join('')}</div>`, liste: true }),
      () => ({ corps: paletteDe(e) }),
    ];
    return [fondDeTable(), barreDe(e),
      voletsDe(e, VOLETS[e.volets.indexOf(e.volet)]()),
      `<div id="plan" class="cadre bois" data-piece="plan"><div class="fond parchemin">${carteDeLEditeur({ titre: echapper(e.carte), lieux: e.lieux.map((l) => ({ nom: echapper(l.nom), genre: l.genre, place: l.place, choisi: l.id === e.choisi })), routes: e.routes.map((r) => ({ de: e.lieux.indexOf(lieu(r.de)), vers: e.lieux.indexOf(lieu(r.vers)), km: r.km })) })}</div>${ferrures}</div>`,
      `<div id="pied" class="bois" data-piece="pied">${picto('epingle', 16)}<span>${pluriel(e.lieux.length, 'lieu')}${separateur('median')}${pluriel(e.routes.length, 'route')}${separateur('median')}Modes : ${[...new Set(e.routes.flatMap((r) => r.modes))].map(echapper).join(', ')}</span></div>`,
      inspecteur({ genre: 'Lieu', sous: `${echapper(e.document)}${separateur('median')}${e.lieu.coordonnees.join(', ')}`, validation: e.validation, corps: `${champ('Nom', echapper(choisi.nom))}<div class="prop"><span>Scène</span>${VALEURS_DE_PROPRIETE.defile({ defile: e.lieu.scene })}</div>
        ${rubrique({ texte: 'Plan du lieu' })}<div class="plan-du-lieu">${echapper(e.lieu.plan)}</div>
        ${rubrique({ texte: `Établissements (${e.lieu.etablissements})` })}${gesteDeLInspecteur('Ajouter un établissement', 'plus')}
        ${rubrique({ texte: `Routes (${sesRoutes.length})` })}${sesRoutes.map((r) => `<div class="prop"><span>${echapper(lieu(r.de === e.choisi ? r.vers : r.de).nom)}</span><span class="v chiffres">${r.km} km</span></div>
          <div class="prop sens"><span>Sens</span>${segments(['Les deux sens', depuis], r.deuxSens ? 'Les deux sens' : depuis)}</div>`).join('')}` })];
  };

  /* ───────── les lieux et la route ───────── */
  /* le groupe du bandeau, ce que dit chaque héros : le poste ou l'activité qu'il tient, ou ce qui l'attend */
  /* le pictogramme d'un rôle, d'un poste ou d'une activité : sur le dit d'un héros du bandeau, sur un poste libre */
  const PICTO_DU_ROLE = {
    vigie: 'oeil', mousse: 'cordage', timonier: 'barre', navigateur: 'etoile', capitaine: 'couronne', artilleur: 'canon', cuisinier: 'marmite', chirurgien: 'soin', chansonnier: 'chant', repos: 'sommeil',
    aucune: 'sommeil', commerce: 'balance', cartographie: 'plume', entrainement: 'couronne', route: 'route',
    tenez: 'bouclier', motivation: 'couronne', quais: 'ancre', temple: 'livre', caserne: 'bouclier', boire: 'chope', rumeurs: 'bulle', dormir: 'sommeil', soigner: 'soin', marchandage: 'balance',
    jouer: 'des', flechettes: 'cible', 'bras-de-fer': 'poing', 'al-zahr': 'des',
  };
  const ditDe = (d) => ('attend' in d ? { html: etiquette({ texte: echapper(d.attend), teinte: d.sombre ? '' : 'or' }) }
    : d.mal ? { texte: echapper(d.texte), icone: 'goutte', mal: true } : { texte: echapper(d.texte), icone: PICTO_DU_ROLE[d.id] });
  /* le groupe du bandeau ; ses bourses, quand le lieu les montre ; le titre de son ruban */
  const bandeauDu = (groupe, html = () => '', titre = '') => bandeau(Object.fromEntries(groupe.map((h) => { const d = h.dit ? ditDe(h.dit) : {}; return [h.id, { ...d, choisi: !!h.choisi, html: `${d.html ?? ''}${html(h)}` }]; })),
    { groupe: groupe.map((h) => ({ id: h.id, nom: echapper(h.nom), car: echapper(h.carriere), pv: h.blessures, max: h.max, bourse: h.bourse === undefined ? '' : prix(h.bourse) })), bourses: groupe.some((h) => h.bourse !== undefined), ruban: titre });
  /* le jour d'un voyage, compté selon ce qu'on y fait */
  const NOM_DU_JOUR = { route: 'de route', fleuve: 'de descente', traversee: 'en mer', mer: 'en mer', bord: 'en mer' };
  const jourDe = (n, decor) => `${n === 1 ? '1ᵉʳ' : `${n}ᵉ`} jour ${NOM_DU_JOUR[decor]}`;
  /* le titre d'un lieu : sa journée en voyage, ou son nom et ce qu'on y vit */
  const titreDu = (t, decor) => ('jour' in t
    ? temps({ teinte: t.lumiere, jour: echapper(t.jour), date: `${t.date.jour} ${echapper(t.date.mois)}${separateur('median')}${jourDe(t.jourDeVoyage, decor)}`, meteo: echapper(t.meteo.ciel), icone: PICTO_DU_TEMPS[t.meteo.temps] })
    : cartouche({ icone: 'botte', nom: echapper(t.nom), sous: echapper(t.sous), taille: 'titre' }));
  /* la carte du trajet, et l'eau qui la traverse selon le décor */
  const EAU_DU_DECOR = { route: 'fleuve', relais: 'fleuve', fleuve: 'fleuve-voie', traversee: 'mer', mer: 'mer' };
  const trajetDu = (t, decor) => carteDuTrajet({ titre: echapper(t.titre), de: echapper(t.de), vers: echapper(t.vers), part: t.part, eau: EAU_DU_DECOR[decor] });
  const recitDu = (r) => `<div id="recit" data-piece="recit">${rubrique({ texte: echapper(r.rubrique) })}<p class="ombre" data-texte="recit">${echapper(r.texte)}</p></div>`;
  const ligneDu = (lab, val) => `<div class="ligne"><span class="rubrique">${lab}</span><span>${val}</span></div>`;

  /* la poursuite : qui poursuit, la Distance en jauge, ce que la manche joue, ce qui la clôt ; ou la sommation du navire */
  /* le panneau de la poursuite : le poursuivant, la Distance et sa jauge sur une ligne quand la frise ne la montre pas
     (`frise`), la manche, les issues en une rangée, la condition de chacune au survol ; la sommation */
  const PANNEAUX = {
    poursuite: (p, piece, frise) => cadre('panneau', null, null, null, null, 'bois', colonne(piece, { corps: `${ligneDu('Poursuivant', echapper(p.poursuivant))}
      ${frise ? '' : `<div class="ligne distance"><span class="rubrique">Distance</span>${jauge(p.distance / p.sur, { teinte: 'or', taille: 'forte' })}<span class="chiffres">${p.distance} / ${p.sur}</span></div>`}
      ${ligneDu(echapper(p.manche.libelle), 'dr' in p.manche ? `<span class="chiffres">${signe(p.manche.dr)}</span>` : echapper(p.manche.test))}
      <div class="issues rubrique">${p.issues.map((i) => `<span>${echapper(i.issue)} à ${i.distance}${i.condition ? raison(echapper(i.condition), { survolee: false }) : ''}</span>`).join(separateur('median'))}</div>`,
    geste: p.abandon && plaque(echapper(p.abandon)) }), { ruban: 'La poursuite', classe: 'bord', piece }),
    sommation: (p, piece) => cadre('panneau', null, null, null, null, 'bois', colonne(piece, { corps: `${ligneDu('Navire hostile', `${echapper(p.navire)}${separateur('median')}${p.forbans} forbans`)}
      ${ligneDu('Cargaison en cale', p.cargaison === null ? 'pillée' : `${p.cargaison} Enc`)}${ligneDu('Pillage, si soumission', `${p.pillage} %`)}` }), { ruban: 'La sommation', classe: 'bord', piece }),
  };
  /* la frise, au-dessus du bandeau : la part faite tracée de `trace` depuis l'origine (`danger`, ce qu'on fuit), ses deux
     bornes, le repère d'un départ, les nuits en croissants, le pointeur ; ce qui reste, en un chiffre */
  const LONGUEUR_DE_FRISE = 900;
  const frise = ({ part, bornes: [de, vers], trace, danger = false, repere = null, nuits = [], reste }) => {
    const x1 = LONGUEUR_DE_FRISE, xi = x1 * part;
    return `<div id="frise" data-piece="frise"><svg width="920" height="44" viewBox="-10 -24 920 44"><path d="M0 0H${xi}" stroke="${trace}" stroke-width="3"/><path d="M${xi} 0H${x1}" stroke="#c9b995" stroke-width="1.500" opacity=".8"/>
      <circle cx="0" r="${danger ? 6 : 5}" fill="${danger ? '#b9412c' : '#f3dc93'}" stroke="#150d04" stroke-width="1.500"/><circle cx="${x1}" r="5" fill="#f3dc93" stroke="#150d04" stroke-width="1.500"/>
      ${repere ? `<circle cx="${x1 * repere.part}" r="3" fill="#c9b995"/>` : ''}${nuits.map((n) => `<circle cx="${x1 * n}" r="3" fill="#f3dc93"/><path d="M${x1 * n + 3} -21a7 7 0 1 0 6 10 5.500 5.500 0 0 1-6-10z" fill="#e9dcc0"/>`).join('')}<path d="M${xi - 5} -13h10l-5 7z" fill="#e9dcc0"/>
      <g font-family="Fell SC" font-size="11" letter-spacing="1.200" fill="#c9b995"><text x="-6" y="17">${de}</text>${repere ? `<text x="${x1 * repere.part}" y="17" text-anchor="middle">${repere.texte}</text>` : ''}<text x="${x1 + 6}" y="17" text-anchor="end">${vers}</text></g></svg>
      <div class="reste rubrique ombre">${reste}</div></div>`;
  };
  /* la frise de la Distance, de « Rattrapés » à « Semés », le repère du départ, l'écart que la manche creuse */
  const friseDu = (f) => frise({ part: f.distance / f.sur, bornes: ['Rattrapés · 0', `Semés · ${f.sur}`], trace: '#f3dc93', danger: true, repere: { part: f.depart / f.sur, texte: `Départ · ${f.depart}` },
    reste: `Distance <b class="gothique">${f.distance}</b>${f.ecart ? `${separateur('median')}le navire creuse l’écart, ${signe(f.ecart)}` : ''}` });
  /* la frise du trajet : d'où, vers où, les nuits passées en route, ce qui reste */
  const friseDuTrajet = (f) => frise({ part: f.part, bornes: [echapper(f.de), echapper(f.vers)], trace: '#b9412c', nuits: f.nuits, reste: `<b class="gothique">${f.reste}</b> ${f.unite} avant ${echapper(f.vers)}` });
  /* la Chance qui reste à ceux qui ont lancé un jet, au pied de son billet (LDB 17 l.23-24) : l'étoile de la Chance, un
     jeton par lanceur identifié par son portrait */
  const chanceDu = (ids) => `<div class="pied"><div class="chance">${picto(PICTO_DE_LA_RESERVE.chance, 20, undefined, 1.8)}${reserves(ids.map(([valeur, id]) => ({ valeur, icone: portrait(qui(id).buste, { taille: 'menu' }), nom: `Chance ${de(prenomDe(id))}` })))}</div></div>`;
  /* l'aperçu du Test d'équipage joué : chaque poste, son DR, la somme ; la Chance de ceux qui l'ont lancé */
  const apercuDuTest = (a) => `<div id="apercu-test">${apercu({ nom: echapper(a.nom), sous: echapper(a.test), vers: 'bas', corps: `${tableDApercu(`${a.lignes.map((l) => `<tr><td>${echapper(qui(l.qui).nom)}, ${echapper(l.poste)}</td><td>${signe(l.dr)} DR${l.double ? ' ×2' : ''}</td></tr>`).join('')}
    <tr class="somme"><td>Somme</td><td>${signe(a.lignes.reduce((t, l) => t + l.dr * (l.double ? 2 : 1), 0))} DR</td></tr>`)}${a.chance ? chanceDu(a.chance.map((c) => [c.valeur, c.qui])) : ''}` })}</div>`;
  const poursuite = (p) => [
    titreDu(p.titre, p.decor), recitDu(p.recit),
    ...(p.trajet ? [trajetDu(p.trajet, p.decor)] : []),
    PANNEAUX[p.panneau.role](p.panneau, p.trajet ? 'colonne-droite-basse' : 'colonne-droite', !!p.frise),
    ...(p.frise ? [friseDu(p.frise)] : []), ...(p.apercu ? [apercuDuTest(p.apercu)] : []),
    ...(p.postes ? [ouvrir(echapper(p.postes), 'cordage', 1)] : []),
    ...(p.fenetre ? [fenetre(p.fenetre)] : [bandeauDu(p.groupe)]), coins(),
  ];

  /* ───────── le voyage ───────── */
  /* l'état du navire : sa coque et le Moral en jauges, son eau douce, ses vivres, sur deux colonnes que la colonne
     montre entières */
  const milliers = (n) => String(n).replace(/\B(?=(\d{3})+$)/g, ' ');
  const etatDuNavire = (n) => `<div class="etat-du-navire"><div>${ligneDu('Coque', `<span class="chiffres">${n.coque.blessures} / ${n.coque.max}</span>`)}${jauge(n.coque.blessures / n.coque.max, { teinte: 'or', taille: 'forte' })}</div>
    <div>${ligneDu('Moral', `<span class="chiffres">${n.moral}</span>`)}${jauge(n.moral / 100, { teinte: 'or', taille: 'forte' })}</div>
    ${ligneDu('Eau douce', `<span class="chiffres">${milliers(n.eau)} L</span>`)}${ligneDu('Vivres', `<span class="chiffres">${pluriel(n.vivres, 'ration')}</span>`)}</div>`;
  /* les écrans posés que la journée ouvre, sous le panneau du navire */
  const PICTO_A_OUVRIR = { dossier: 'coque', postes: 'cordage' };
  /* la cadence du voyage tenue, là où elle a un effet (`src/noyau/voyageCadence.ts:78`), une plaque par cadence */
  const CADENCES = [['jourParJour', 'Jour par jour'], ['commande', 'Sous vos ordres']];
  const cadenceDu = (cadence) => `<div class="cadence"><span class="rubrique">Cadence du voyage</span><div>${CADENCES.map(([id, l]) => plaque(l, { armee: id === cadence, taille: 'petite' })).join('')}</div></div>`;
  /* sous la carte du trajet : l'état du navire, qui défile, et la cadence tenue au pied ; sans navire, la cadence seule */
  const voyageDu = (v) => cadre('navire', null, null, null, null, 'bois', colonne('colonne-droite-basse', { corps: v.navire && etatDuNavire(v.navire.etat), geste: v.titre.cadence && cadenceDu(v.titre.cadence) }),
    { ruban: v.navire ? echapper(v.navire.nom) : 'Le voyage', classe: 'bord', piece: 'colonne-droite-basse' });
  /* le billet d'un jet tombé, au-dessus de la carte du héros qui l'a lancé : le seuil, le dé, le DR, ce qu'il vaut à la
     vitesse, la Chance qui lui reste */
  const billetDuJet = (a, groupe) => {
    const k = groupe.findIndex((h) => h.id === a.qui), nom = prenomDe(a.qui);
    return `<div id="billet-du-jet">${apercu({ nom: echapper(a.test), sous: `${nom}${a.poste ? `${separateur('median')}${echapper(a.poste)}` : ''}`, vers: 'bas', style: `left:calc(50% - 480px + ${240 * k + 24}px);bottom:236px;--pointe:60px`,
      corps: `${tableDApercu(`<tr><td>Seuil</td><td>${echapper(a.difficulte.nom)} (${signe(a.difficulte.valeur)})${separateur('median')}${a.seuil}</td></tr><tr><td>Dé</td><td>${d100(a.de)}</td></tr>
        <tr><td>${a.de <= a.seuil ? 'Réussite' : 'Échec'}</td><td>${signe(a.dr)} DR</td></tr>${a.effet ? `<tr><td>${echapper(a.effet.nom)}</td><td>${signe(a.effet.vitesse)} % de vitesse</td></tr>` : ''}`)}${chanceDu([[a.chance, a.qui]])}` })}</div>`;
  };
  /* le carton d'un arrêt, chaque part à sa place (`PLACES`, `carton/*`) : la vignette, le titre et où il tombe, le texte
     du livre, le dé tiré ; les cartes du choix qu'il ouvre (ou ses paies et les parts qu'elles règlent), son geste */
  const cartonDe = (a, v) => {
    const sous = [echapper(a.ou), a.marins && pluriel(a.marins, 'marin'), a.jour && jourDe(v.titre.jourDeVoyage, v.decor)].filter(Boolean).join(separateur('median'));
    const cartes = a.choix && a.choix.cartes.map(carteDe).join('');
    return cadre('evenement', null, null, null, null, 'parchemin', `${places('carton', {
      vignette: `<div class="vignette"><svg viewBox="0 0 250 250">${VIGNETTES[a.vignette]()}</svg></div>`,
      tete: `<div class="tete">${titre({ texte: echapper(a.titre), cle: "titre de l'événement" })}<span class="rubrique">${sous}</span></div>`,
      texte: defile(`<p data-texte="texte du livre">${echapper(a.texte)}</p>`, 'suite'),
      choix: a.choix && !a.choix.parts && `<div class="choix">${cartes}</div>`,
      paies: a.choix?.parts && `<div class="choix paies">${cartes}</div>`,
      parts: a.choix?.parts && `<div class="cadre bois"><div class="fond bois">${partsDu(a.choix.parts)}</div></div>`,
      geste: a.choix && plaque(echapper(a.choix.geste.libelle), { armee: !!a.choix.geste.principal, classe: 'commet' }),
    })}${a.de ? sceau(a.de.valeur, 'maitre', { de: a.de.de }) : ''}`, { ruban: echapper(a.ruban), piece: 'carton' });
  };
  /* une journée de route, de descente ou en mer : l'objet du temps, le récit, la carte du trajet, le navire et les écrans
     qu'il ouvre, la frise, le billet du jet, le carton de l'arrêt ; le groupe, ou la fenêtre du Test */
  const voyage = (v) => [
    titreDu(v.titre, v.decor), ...(v.recit ? [recitDu(v.recit)] : []), trajetDu(v.trajet, v.decor),
    ...(v.navire || v.titre.cadence ? [voyageDu(v)] : []),
    ...(v.ouvrir ?? []).map((o, k) => ouvrir(echapper(o.libelle), PICTO_A_OUVRIR[o.id], k + 1)),
    ...(v.frise ? [friseDuTrajet(v.frise)] : []),
    ...(v.apercu ? ['role' in v.apercu ? billetDuJet(v.apercu, v.groupe) : apercuDuTest(v.apercu)] : []),
    ...(v.arret ? [cartonDe(v.arret, v)] : []),
    ...(v.fenetre ? [fenetre(v.fenetre)] : [bandeauDu(v.groupe)]),
    coins(),
  ];
  /* le décor de la journée : la route devant le pont effondré, le Reik et son barrage, la mer et la cogue (à vapeur, au
     loin) ; le haut assombri sous le récit, le tout sous l'arrêt */
  const peindreLeVoyage = (v) => {
    toile().innerHTML = v.decor === 'route' ? D.route({ pont: true })
      : v.decor === 'fleuve' ? D.fleuve({ barrage: v.arret?.vignette === 'barrage' })
        : D.mer(v.vapeur ? { x: 1400, s: 0.42, cogue: { vapeur: true } } : { x: 690 });
    el(S, 'rect', { width: W, height: 520, fill: 'url(#haut)' });
    if (v.arret) el(S, 'rect', { width: W, height: H, fill: '#080504', opacity: 0.58 });
    fermer();
  };

  /* le bord : les postes autour du mât, le billet du poste survolé ; à droite le navire et ce que la journée jouera, ou la
     semaine et ses Activités ; la station du héros choisi sous le dossier à ouvrir */
  const PICTO_DU_JEU = { progression: 'couronne', orientation: 'etoile', entretien: 'cordage' };
  const billetDuBord = (b, postes) => {
    const p = postes.find((x) => x.id === b.poste), [cx, y] = PLACES_DES_POSTES.bord[b.poste], gauche = Math.max(24, cx - 150);
    const lignes = b.role === 'role'
      ? [['Compétence', echapper(b.competence)], ['Test d’équipage', echapper(b.test)], ...(b.essentiel ? [['Ses DR', 'comptent double']] : [])]
      : [['À atteindre', `${b.aCumuler} DR en ${b.tentatives} tentatives`], ...b.issues.map((i) => [echapper(i.issue), echapper(i.effet)])];
    return `<div id="billet-du-bord">${apercu({ nom: echapper(p.nom), sous: b.role === 'etendu' ? 'Test étendu' : b.essentiel ? 'Rôle essentiel' : 'Rôle', vers: 'bas',
      style: `left:${gauche}px;bottom:${720 - y + 14}px;--pointe:${cx - gauche - 8}px`, corps: tableDApercu(lignes.map(([l, v]) => `<tr><td>${l}</td><td>${v}</td></tr>`).join('')) })}</div>`;
  };
  /* le bord, et en onglet la station du héros choisi */
  const panneauDuBord = (b, s) => cadre('bord', null, null, null, null, 'bois', colonne('colonne-droite', { liste: !!s, corps: s ? `<div class="stations">${s.stations.map((n, k) => plaque(echapper(n), { armee: k === s.tenue, taille: 'petite' })).join('')}</div>
    <p data-texte="station">${echapper(s.texte)}</p>` : `${etatDuNavire(b.etat)}${filet({ fondu: true })}${rubrique({ texte: 'Ce que la journée jouera' })}
    ${b.jouera.map((j) => `<div class="jouera">${rond(PICTO_DU_JEU[j.id], 'menu', { arme: true })}${echapper(j.nom)}<span class="rubrique">${'qui' in j.par ? prenomDe(j.par.qui) : echapper(j.par.tenants)}${separateur('median')}${echapper(j.competence)}</span></div>`).join('')}` }),
  { tete: onglets(['Le bord', ...(s ? [`Station ${de(prenomDe(s.qui))}`] : [])], s ? `Station ${de(prenomDe(s.qui))}` : 'Le bord', 'colonne-droite'), classe: 'bord', piece: 'colonne-droite' });
  const semaineDu = (s, postes) => cadre('bord', null, null, null, null, 'bois', colonne('colonne-droite', { corps: s.activites.map((a) => `${rubrique({ texte: `${echapper(postes.find((p) => p.id === a.poste).nom)}${separateur('median')}${prenomDe(a.qui)}` })}
    <div class="reglage"><span>${echapper(a.reglage.libelle)}</span>${moinsPlus({ moins: a.reglage.valeur > 0, entre: `<b class="chiffres">${prix(a.reglage.valeur)}</b>` })}</div>
    ${a.plafond === undefined ? '' : ligneDu('Plafond', `<span class="chiffres">${prix(a.plafond)}</span>`)}${a.encLibre === undefined ? '' : ligneDu('Enc libre du navire', `<span class="chiffres">${a.encLibre}</span>`)}`).join(filet({ fondu: true })),
    geste: plaque(echapper(s.action), { armee: true }) }), { tete: onglets(['La semaine'], 'La semaine', 'colonne-droite'), classe: 'bord semaine', piece: 'colonne-droite' });
  const leBord = (b) => [
    cartouche({ icone: 'cordage', nom: echapper(b.titre.nom), sous: [[echapper(b.titre.navire), b.titre.marins && pluriel(b.titre.marins, 'marin'), jourDe(b.titre.jourEnMer, 'bord')].filter(Boolean).join(separateur('median')), b.titre.regle && echapper(b.titre.regle)], taille: 'titre' }),
    postesDu(b.postes, 'bord'), ...(b.billet ? [billetDuBord(b.billet, b.postes)] : []),
    ...(b.bord ? [panneauDuBord(b.bord, b.station)] : []), ...(b.semaine ? [semaineDu(b.semaine, b.postes)] : []),
    ...(b.ouvrir ? [ouvrir(echapper(b.ouvrir), 'coque', 1)] : []),
    bandeauDu(b.groupe), retour(echapper(b.retour), 'route'), coins(),
  ];
  /* le navire du bord, vu de travers, sous l'interface */
  const peindreLeBord = () => {
    toile().innerHTML = `${D.mer({ navire: false })}${D.cogue(810, 640, 1.4, {})}`;
    el(S, 'rect', { width: W, height: H, fill: '#080504', opacity: 0.34 });
    fermer();
  };

  /* la bataille de masse : la Puissance des deux armées, ce que le Round joue, les Scènes sur le champ, le carton */
  const PICTO_DE_LA_SCENE = { pluie: 'arc', tenez: 'bouclier', motivation: 'couronne' };
  const prenom = (id) => echapper(qui(id).nom.split(' ')[0]);
  const quiJoue = (j) => (j.qui === 'groupe' ? 'Tout le groupe' : j.qui.map(prenom).join(', '));
  const ceQueJoue = (j) => (j.echec ? 'échouée, aucun effet' : [j.ote && `Horde ${signe(-j.ote)}`, j.rupture && `rupture ${j.rupture.points}/${j.rupture.sur}`].filter(Boolean).join(separateur('median')));
  const armeeDu = (a, bonus, teinte) => `${ligneDu(echapper(a.nom), `<span class="chiffres">${a.puissance}${separateur('median')}départ ${a.depart}</span>`)}${jauge(a.puissance / 100, { teinte, taille: 'forte' })}${bonus ? ligneDu('Tests de Puissance ce Round', `<span class="chiffres">${signe(bonus)}</span>`) : ''}`;
  /* les gestes de la Puissance : le premier au pied, les autres au bas du corps */
  const gesteDeLaPuissance = (g, k) => plaque(echapper(g.libelle), { armee: !!g.principal, icone: k ? 'des' : 'epee' });
  const puissance = (b) => cadre('panneau', null, null, null, null, 'bois', colonne('colonne-droite', { corps: `${armeeDu(b.armees.allies, b.bonus, 'or')}${armeeDu(b.armees.ennemis, 0, 'cire')}${filet({ fondu: true })}
    ${b.jeu ? `${rubrique({ texte: `Ce que le Round ${b.jeu.joue ? 'a joué' : 'jouera'}` })}${b.jeu.scenes.map((j) => `<div class="jouera${b.jeu.joue ? ' joue' : ''}">${rond(PICTO_DE_LA_SCENE[j.scene], 'menu', { arme: true })}${echapper(j.nom)}<span class="rubrique">${b.jeu.joue ? ceQueJoue(j) : quiJoue(j)}</span></div>`).join('')}` : ''}
    ${b.rounds ? `${rubrique({ texte: 'Ce que la bataille a joué' })}${b.rounds.map((r, k) => ligneDu(`Round ${k + 1}`, `${r.allies} contre ${r.ennemis}`)).join('')}` : ''}
    ${(b.gestes ?? []).slice(1).map((g, k) => gesteDeLaPuissance(g, k + 1)).join('')}`, geste: b.gestes?.length && gesteDeLaPuissance(b.gestes[0], 0) }), { ruban: 'Puissance', classe: 'bord armees', piece: 'colonne-droite' });
  /* une Scène sur son emplacement du champ : ses postés (ou son pictogramme), la place offerte, son effet, son geste */
  const EMPLACEMENTS = [[180, 280], [470, 280], [760, 280]];
  const sceneDu = (sc, [cx, y]) => `<div class="poste scene ${sc.postes.length ? 'occupe' : 'vide'}${sc.visee ? ' vise' : ''}" data-piece="scène ${sc.id}"${mobile('scene')} style="left:${cx}px;top:${y}px">
    <div class="postes-de-scene">${sc.postes.length ? sc.postes.map((id) => portrait(qui(id).buste)).join('') : medaillon(PICTO_DE_LA_SCENE[sc.id], { taille: 'moyen', vise: !!sc.visee })}${sc.place ? medaillon('plus', { taille: 'petit', vise: !!sc.visee }) : ''}</div>
    <div class="et bois">${nom({ texte: echapper(sc.nom), taille: 'petit' })}<span class="rubrique">${echapper(sc.effet)}</span>${sc.rupture ? `<span class="rubrique position">Point de rupture ${sc.rupture.points}/${sc.rupture.sur}</span>` : ''}${plaque(echapper(sc.geste), { armee: !!sc.visee, taille: 'petite' })}</div></div>`;
  const apercuDeLaScene = (a, scenes) => {
    const k = scenes.findIndex((sc) => sc.id === a.scene), [cx, y] = EMPLACEMENTS[k];
    return `<div id="apercu-scene">${apercu({ nom: echapper(scenes[k].nom), sous: 'Postés', vers: 'bas', style: `left:${cx - 90}px;bottom:${720 - y + 8}px;--pointe:90px`,
      corps: tableDApercu(`${a.lignes.map((l) => `<tr><td>${echapper(qui(l.qui).nom)}</td><td>${echapper(l.comment)}</td></tr>`).join('')}${a.regles.map((r) => `<tr><td>${echapper(r.libelle)}</td><td>${echapper(r.texte)}</td></tr>`).join('')}`) })}</div>`;
  };
  /* le carton : les deux armées de part et d'autre de ce qui les départage, ses gestes */
  const ost = (o, a, bonus, cote) => ('issue' in o
    ? `<div class="ost ${cote}">${sceau(a.puissance, 'maitre', { etat: o.gagne ? 'reussite' : '', de: 'Puiss.' })}<div>${nom({ texte: echapper(a.nom) })}${sousTitre({ texte: `départ ${a.depart}` })}<div class="issue${o.gagne ? ' reussite' : ''}"><b>${echapper(o.issue)}</b></div></div></div>`
    : `<div class="ost ${cote}">${sceau(o.jet, 'maitre', { etat: o.dr > 0 ? 'reussite' : '', de: 'd100' })}<div>${nom({ texte: echapper(a.nom) })}${sousTitre({ texte: `Puissance ≤ ${o.seuil}${bonus ? ` + ${bonus}` : ''}` })}<div class="issue${o.dr > 0 ? ' reussite' : ''}"><b>${o.dr > 0 ? 'Réussite' : 'Échec'}${separateur('median')}DR ${signe(o.dr)}</b>${separateur('median')}ôte ${o.ote}</div></div></div>`);
  const carton = (b) => {
    const c = b.carton, { allies, ennemis } = b.armees, issue = 'issue' in c.allies;
    const milieu = issue
      ? `${sousTitre({ texte: `Après ${b.rounds.length} Rounds de bataille` })}<div class="dr">${echapper((c.allies.gagne ? allies : ennemis).nom)} l’emporte</div><p data-texte="phrase d'issue">${echapper(c.phrase)}</p>`
      : `${sousTitre({ texte: `Round de bataille ${b.round.rang} / ${b.round.sur}` })}<div class="dr">${allies.puissance} contre ${ennemis.puissance}</div><p data-texte="phrase d'issue">Les Personnages réduisent l’ennemi de ${c.allies.ote}, l’ennemi réduit les Personnages de ${c.ennemis.ote}.</p>`;
    return cadre('epreuve', null, null, null, null, 'parchemin', `${ost(c.allies, allies, b.bonus, '')}<div class="milieu">${milieu}</div>${ost(c.ennemis, ennemis, 0, 'droite')}
      <div class="gestes">${c.gestes.map((g) => plaque(echapper(g.libelle), { armee: !!g.principal, classe: g.libelle.length > 14 ? 'large' : '' })).join('')}</div>`, { ruban: echapper(c.titre), classe: issue ? 'issue' : '', piece: 'carton' });
  };
  const bataille = (b) => [
    cartouche({ icone: 'epee', nom: 'Bataille de masse', sous: b.round ? `Round de bataille ${b.round.rang} / ${b.round.sur}` : 'La bataille est terminée', taille: 'titre' }),
    /* le carton tient le milieu de l'écran : le récit et la colonne qu'il croiserait ne se posent pas */
    ...(b.carton ? [] : [...(b.terrain ? [recitDu({ rubrique: 'Le terrain', texte: b.terrain })] : []), puissance(b)]),
    ...(b.scenes ? [`<div>${b.scenes.map((sc, k) => sceneDu(sc, EMPLACEMENTS[k])).join('')}</div>`] : []),
    ...(b.apercu ? [apercuDeLaScene(b.apercu, b.scenes)] : []),
    ...(b.carton ? [carton(b)] : []),
    ...(b.fenetre ? [fenetre(b.fenetre)] : [bandeauDu(b.groupe)]), coins(),
  ];

  /* l'interlude en ville : les Activités restantes de chaque héros, l'avis de la reprise sous elles, la carte et ses
     lieux, le lieu choisi (ses forces sous son nom) et ses Activités, la prise en entier, les autres en une rangée de médaillons ; la carte se trace une fois posée (`lieux-et-nuit/carte-de-la-ville.js`) */
  const lieuSurLaCarte = (l) => { const { x, y, icone } = LIEUX_DE_LA_VILLE[l.id];
    /* l'étiquette d'un lieu près d'un bord de la carte s'ouvre vers l'intérieur */
    return `<div class="lieu bois${l.choisi ? ' choisi' : ''}${x < 211 ? ' gauche' : x > 633 ? ' droite' : ''}" data-cle="${l.id}" style="left:${(100 * x) / 844}%;top:${(100 * y) / 572}%">${medaillon(icone, { taille: 'petit' })}<div>${nom({ texte: echapper(l.nom), taille: 'petit' })}<span class="rubrique">${echapper(l.quoi)}</span></div><div class="qui">${l.heros ? portrait(l.heros, { taille: 'menu' }) : ''}${l.fantome ? portrait(l.fantome, { taille: 'menu', classe: 'fantome' }) : ''}</div></div>`; };
  /* une Activité non prise : son médaillon seul, son nom, son Test et son enjeu dans la bulle du survol (fiche
     `user-doctrine-icone-identifie-survol-detaille`), la raison qui la ferme dans la bulle de refus */
  const activiteBreve = (a) => `<div class="activite-breve${a.refus ? ' fermee' : ''}">${medaillon(a.id, { taille: 'moyen', ferme: !!a.refus })}${raison(echapper(a.refus && a.survol ? a.refus : [a.nom, a.test, a.enjeu ?? a.refus].filter(Boolean).join(separateur('median'))), { survolee: !!(a.refus && a.survol) })}</div>`;
  /* l'Activité prise, en entier : son nom, son Test, son enjeu */
  const activiteDu = (a) => `<div class="activite prise">${medaillon(a.id, { taille: 'petit' })}<div>${nom({ texte: echapper(a.nom), taille: 'petit' })}${a.test ? `${sousTitre({ texte: echapper(a.test) })}` : ''}${a.enjeu ? `<i>${echapper(a.enjeu)}</i>` : ''}</div></div>`;
  const interlude = (i) => {
    const nomDe = (id) => echapper(i.groupe.find((h) => h.id === id).nom.split(' ')[0]);
    const pips = (n) => `<div class="pips">${[0, 1, 2].map((k) => `<i class="${k < n ? '' : 'vide'}"></i>`).join('')}</div>`;
    const choisi = i.groupe.find((h) => h.choisi)?.id;
    const [prises, autres, fermees] = [i.lieu.activites.filter((a) => a.prise), i.lieu.activites.filter((a) => !a.prise && !a.refus), i.lieu.activites.filter((a) => a.refus)];
    return [
      cartouche({ icone: 'ville', nom: echapper(i.ville.nom), sous: echapper(i.ville.sous), taille: 'titre' }),
      cadre('interlude', null, null, null, null, 'bois', colonne('colonne-gauche', { tete: `${titre({ texte: 'Activités restantes' })}${sousTitre({ texte: 'Une par semaine, trois au plus' })}`,
        corps: i.restantes.map((r) => rang(r.qui, { taille: 'petit', choisi: r.qui === choisi, nom: nomDe(r.qui), gothique: 'moyen', sous: `Événement${separateur('median')}${echapper(r.evenement)}`, fin: `<div class="r">${pips(r.activites)}</div>` })).join('') }), { ruban: 'L’interlude', piece: 'colonne-gauche' }),
      `<div id="avis" data-piece="note">${sceau('pieces')}<span class="ombre" data-texte="avis">${echapper(i.avis)}</span></div>`,
      `<div id="carte" class="cadre bois" data-piece="carte-de-la-ville"><div class="fond parchemin"><svg viewBox="0 0 844 572" preserveAspectRatio="none"></svg>${i.lieux.map(lieuSurLaCarte).join('')}</div>${ferrures}</div>`,
      cadre('lieu', null, null, null, null, 'bois', colonne('colonne-droite', { tete: `${titre({ texte: echapper(i.lieu.nom), cle: 'lieu' })}${i.lieu.forces ? `<div class="forces rubrique">Armée des Personnages ${i.lieu.forces.allies}${separateur('median')}Horde ennemie ${i.lieu.forces.ennemis}</div>` : ''}`,
        corps: `${i.lieu.hote ? `<div class="pnj">${portrait(i.lieu.hote.buste)}<div><b>${echapper(i.lieu.hote.nom)}</b><p>${echapper(i.lieu.hote.dit)}</p></div></div>` : ''}
        ${prises.map(activiteDu).join('')}${autres.length + fermees.length ? `<div class="activites-breves">${[...autres, ...fermees].map(activiteBreve).join('')}</div>` : ''}`,
        geste: plaque(echapper(i.lieu.envoi), { armee: true, icone: 'route', classe: 'envoyer' }) }), { ruban: echapper(i.lieu.quartier), piece: 'colonne-droite' }),
      bandeauDu(i.groupe), retour(echapper(i.retour), 'sablier'), coins(),
    ];
  };
  const tracerLaVille = (i) => dessinerLaVille(document.querySelector('#carte svg'), i.lieux.map((l) => ({ ...LIEUX_DE_LA_VILLE[l.id], choisi: !!l.choisi })));

  /* ───────── les lieux : leur titre, leurs services, leur argent ───────── */
  /* une somme en sous de cuivre : couronnes d'or, pistoles, sous (1 CO = 20/– = 240 sc) */
  const prix = (n) => {
    const a = Math.abs(n), co = Math.floor(a / 240), p = Math.floor((a % 240) / 12), sc = a % 12;
    return `${n < 0 ? '−' : ''}${[co && `${String(co).replace(/\B(?=(\d{3})+$)/g, ' ')} CO`, p && `${p}/–`, sc && `${sc} sc`].filter(Boolean).join(' ') || '0'}`;
  };
  /* le prénom d'un héros du groupe, ou d'un combattant que la fenêtre nomme */
  const prenomDe = (id) => echapper((etat.groupe?.find((h) => h.id === id) ?? etat.combattants[id]).nom.split(' ')[0]);
  const PICTO_DU_TEMPS = { gel: 'flocon', beau: 'soleil', vent: 'vent' };
  /* le cartouche du lieu : son nom, sa date et ce qu'on y vit, son temps en troisième ligne */
  const titreDuLieu = (t, icone) => cartouche({ icone, nom: echapper(t.nom), taille: 'titre',
    sous: [[t.date && `${t.date.jour} ${echapper(t.date.mois)}`, echapper(t.sous)].filter(Boolean).join(separateur('median')), t.meteo && `${picto(PICTO_DU_TEMPS[t.meteo.temps], 13, '#c9b995')} ${echapper(t.meteo.ciel)}`] });
  const PICTO_DU_SERVICE = {
    auberge: 'lit', marche: 'panier', forgeron: 'enclume', temple: 'livre', port: 'ancre', taverne: 'chope', joailliers: 'balance', medecins: 'soin', guet: 'bouclier',
    nuit: 'lit', salle: 'bulle', jeux: 'des', barbier: 'soin', ecurie: 'fer_a_cheval',
    negoce: 'ballot', chantier: 'marteau', recrutement: 'equipage', avitaillement: 'tonneau', entrepot: 'ballot', marins: 'equipage', avitailleur: 'tonneau',
  };
  const railDu = (r) => rail(echapper(r.titre), r.services.map((s) => [PICTO_DU_SERVICE[s.id], echapper(s.nom), s.id === r.ouvert]), echapper(r.pied));
  /* les parts du groupe, réglables avant validation, et leur total */
  const partsDu = (parts) => bourse({ parts: parts.map((p) => [prenomDe(p.heros), prix(p.part), prix(p.avoir)]), total: prix(parts.reduce((t, p) => t + p.part, 0)), reglable: !('main' in etat) });
  /* une voie de la page (`../lieux-et-nuit/soins.js`) : son Test, ce qu'elle fait ou la raison qui la ferme, son prix */
  const voieDu = (v) => acteDeSoin(v.id, echapper(v.nom), echapper(v.test), echapper(v.refus ?? v.texte), { pris: !!v.prise, ferme: !!v.refus, prix: v.prix === undefined ? '' : prix(v.prix) });

  /* ───────── la nuit ───────── */
  /* l'aubergiste, ses offres et ses avis, à gauche sous le cartouche */
  const PICTO_DE_L_OFFRE = { commune: 'lit', privee: 'cle', grande: 'cle', repas: 'bol', ecurie: 'fer' };
  const offreDeLHote = (h) => cadre('hote-du-lieu', null, null, null, null, 'bois', colonne('colonne-gauche', { tete: cartouche({ icone: h.icone, nom: echapper(h.nom), sous: echapper(h.qualite) }),
    corps: `<div class="dit">${echapper(h.dit)}</div>
    <div class="grille">${h.offres.map((o) => `<span class="l rubrique">${picto(PICTO_DE_L_OFFRE[o.id], 17)}${echapper(o.nom)}</span><span class="q rubrique">${o.lits ? `${o.lits} lits` : o.parBete ? 'par cheval' : 'par tête'}</span>${plaque('', { prix: prix(o.prix), armee: !!o.prise, taille: 'petite' })}`).join('')}</div>
    ${(h.avis ?? []).map((a) => `<div class="avis">${picto('goutte', 14)}<span class="rubrique">${echapper(a)}</span></div>`).join('')}` }), { ruban: 'La nuit et le repas', piece: 'colonne-gauche' });
  /* les postes de la scène, chacun sur sa place du décor : son centre, son haut */
  const PLACES_DES_POSTES = {
    auberge: { boire: [470, 290], rumeurs: [660, 390], jouer: [800, 250], soigner: [490, 430], dormir: [640, 40] },
    taverne: { 'bras-de-fer': [530, 30], flechettes: [690, 30], brasseur: [470, 170], batelier: [690, 170], cocher: [690, 330], 'al-zahr': [480, 380] },
    /* le bord : les rôles autour du mât, la vigie en tête ; les Activités de la semaine */
    bord: {
      vigie: [600, 20], mousse: [600, 150], capitaine: [245, 290], timonier: [415, 290], navigateur: [585, 290], artilleur: [755, 290],
      cuisinier: [245, 430], chirurgien: [415, 430], chansonnier: [585, 430], repos: [755, 430],
      aucune: [590, 150], commerce: [245, 320], cartographie: [740, 260], entrainement: [550, 440],
    },
  };
  const postesDu = (postes, decor) => `<div>${postes.map((p) => { const [cx, y] = PLACES_DES_POSTES[decor][p.id];
    return poste(cx, y, { nom: `${echapper(p.nom)}${p.refus && p.survol ? raison(echapper(p.refus)) : ''}`, sous: `${echapper(p.sous)}${p.prix === undefined ? '' : `${separateur('median')}${prix(p.prix)}`}`, icone: PICTO_DU_ROLE[p.id], heros: p.tenants ?? [], plus: !!p.place, ferme: !!p.refus, vise: !!p.vise, piece: `poste ${p.id}` }); }).join('')}</div>`;
  /* qui dort où : l'abri tenu (le Test d'un abri au survol) et ses places, ceux qui restent dehors, le sac de couchage ; le temps, ce que la nuit
     jouera en une rangée (le jet de chacun, son nom au survol), la note, qui défilent au-dessus de l'action */
  const PICTO_DE_LA_NUIT = { froid: 'flocon', repos: 'sommeil' };
  const couche = (libelle, ids, places, fin = '') => `<div class="couche"><span class="lab rubrique">${libelle}</span><div class="places">${Array.from({ length: places }, (_, k) => portrait(ids[k], { taille: 'petit' })).join('')}</div>${fin}</div>`;
  const dortoirDu = (d, meteo) => cadre('dortoir', null, null, null, null, 'bois', colonne('colonne-droite', { corps: `
    ${d.abris ? `<div class="rang-c abri"><span class="lab rubrique">Abri</span>${segments(d.abris.map((a) => echapper(a.nom)), echapper(d.abri.nom))}${raison(d.abris.filter((a) => a.test).map((a) => `${echapper(a.nom)} : Test ${de(echapper(a.test))}`).join(separateur('median')), { survolee: false })}</div>` : ''}
    ${rubrique({ texte: 'Qui dort où' })}
    ${couche(echapper(d.abri.nom), d.dedans, d.abri.places, `<i>${d.dedans.length} sur ${d.abri.places}</i>`)}
    ${d.dehors.length ? couche('Dehors', d.dehors, d.dehors.length) : ''}
    ${d.sac ? couche('Sac de couchage', d.sac.porteurs, d.sac.porteurs.length, `<i>${signe(d.sac.bonus)} au froid</i>`) : ''}
    ${d.temps ? `<div class="rang-c">${sceau(PICTO_DU_TEMPS[meteo.temps])}<span class="v">${echapper(d.temps)}</span></div>` : ''}
    ${filet({ fondu: true })}
    ${d.jouera ? `<div class="rang-c nuit-jouera"><span class="lab rubrique">La nuit jouera</span>${d.jouera.map((n) => `<span class="jet">${rond(PICTO_DE_LA_NUIT[n.id], 'menu', { arme: true })}${echapper(n.jet)}${raison(echapper(n.nom), { survolee: false })}</span>`).join('')}</div>` : ''}
    ${d.parts ? partsDu(d.parts) : ''}`, geste: plaque(echapper(d.action), { armee: true, icone: 'lune', classe: 'nuit' }) }), { ruban: 'La nuit', piece: 'colonne-droite' });
  /* la partie d'un jeu de taverne : le jeu et sa règle, les jeux de la maison, la table ; la mise au pied */
  const PILE = `<svg width="38" height="34" viewBox="0 0 38 34">${[28, 23, 18, 13].map((y) => `<ellipse cx="15" cy="${y}" rx="12" ry="4.200" fill="#c9a44c" stroke="#5d4313" stroke-width="1"/>`).join('')}<ellipse cx="28" cy="27" rx="8" ry="3" fill="#c9a44c" stroke="#5d4313" stroke-width="1"/></svg>`;
  const partieDu = (p) => `<div id="partie" class="page cadre bois" data-piece="page"><div class="fond parchemin">${colonne('page', { tete: `${titre({ texte: echapper(p.jeu.nom), cle: 'jeu' })}${sousTitre({ texte: echapper(p.jeu.sous) })}`,
    corps: `<p>${echapper(p.jeu.regle)}</p>
    <div class="autres">${p.jeux.map((j) => plaque(echapper(j.nom), { armee: j.id === p.jeu.id, icone: PICTO_DU_ROLE[j.id], taille: 'petite' })).join('')}</div>
    ${filet()}${rubrique({ texte: 'À la table' })}
    <div class="sieges">${p.table.map((s) => `<div class="siege">${portrait(s.qui, { choisi: s.qui === p.mise.heros })}${nom({ texte: echapper(s.nom), taille: 'petit' })}<span class="rubrique">${echapper(s.role)}</span></div>`).join('')}</div>`,
    pied: `<div class="mise">${rond('moins', 'petit')}<div class="somme">${PILE}<b>${prix(p.mise.mise)}</b></div>${rond('plus', 'petit')}
      <table class="compte"><tr><td>Le pot, à ${p.mise.joueurs}</td><td class="chiffres">${prix(p.mise.pot)}</td></tr><tr><td>Bourse ${de(prenomDe(p.mise.heros))}</td><td class="chiffres">${prix(p.mise.avoir)}</td></tr></table></div>`,
    geste: plaque(echapper(p.action), { armee: true, icone: 'des', classe: 'jouer' }) })}
  </div>${ruban('La partie')}${ferrures}</div>`;
  /* la nuit : l'hôte ou le rail de la maison à gauche, les postes dans la scène, qui dort où ou la partie à droite ; à la
     halte, le récit sous le cartouche et ce que chacun mange sur sa carte du bandeau */
  const nuit = (n) => [
    titreDuLieu(n.titre, n.decor === 'bivouac' ? 'lune' : 'lit'),
    ...(n.recit ? [`<div id="recit" data-piece="recit">${rubrique({ texte: echapper(n.recit.lieu) })}<p class="ombre" data-texte="recit">${echapper(n.recit.texte)}</p></div>`] : []),
    ...(n.hote ? [offreDeLHote(n.hote)] : []), ...(n.rail ? [railDu(n.rail)] : []),
    ...(n.postes ? [postesDu(n.postes, n.decor)] : []),
    ...(n.dortoir ? [dortoirDu(n.dortoir, n.titre.meteo)] : []), ...(n.partie ? [partieDu(n.partie)] : []),
    bandeauDu(n.groupe, (h) => (h.nourriture ? `<div class="choix-h"><span class="rubrique">Nourriture</span>${h.nourriture.valeurs.map((v, k) => plaque(echapper(v), { armee: k === h.nourriture.tenue, taille: 'petite' })).join('')}</div>` : '')),
    retour(echapper(n.retour), n.decor === 'bivouac' ? 'route' : 'sortie'), coins(),
  ];

  /* ───────── les soins ───────── */
  /* le médecin dans son cabinet, pointé sur lui, ou les soins entre héros dans la salle ; la page des soins
     (`../lieux-et-nuit/soins.js`) à droite, ce que le patient paie et sa bourse au pied quand il paie */
  const soins = (s) => {
    const patient = etat.groupe.find((h) => h.id === s.patient.qui);
    return [
      titreDuLieu(s.titre, s.hote ? 'soin' : 'lit'), ...(s.rail ? [railDu(s.rail)] : []),
      ...(s.hote ? [hote({ id: 'medecin', piece: 'medecin', x: 400, y: 236, l: 340, icone: s.hote.icone, nom: echapper(s.hote.nom), sous: `${echapper(s.hote.qualite)}${separateur('median')}${echapper(s.hote.competence.nom)} ${s.hote.competence.seuil}`, pointe: 230, corps: `<p>${echapper(s.hote.dit)}</p>` })] : []),
      pageDesSoins({ ruban: s.hote ? 'Les soins du docteur' : 'Les soins', patient: echapper(patient.nom), blessures: patient.blessures, max: patient.max, mal: s.patient.mal ? echapper(s.patient.mal) : '', actes: s.actes.map(voieDu).join(''),
        paie: s.paiement && `<table class="compte"><tr class="total"><td>À payer</td><td>${prix(s.paiement.aPayer)}</td></tr></table>${bourse({ heros: prenomDe(s.patient.qui), avoir: prix(s.paiement.avoir) })}`,
        geste: plaque(echapper(s.action), { armee: true, icone: s.paiement ? 'bourse' : 'soin', classe: 'payer' }), note: s.note && `<div class="note">${glose({ texte: echapper(s.note) })}</div>` }),
      bandeauDu(s.groupe), retour(echapper(s.retour), s.hote ? 'sortie' : 'route'), coins(),
    ];
  };

  /* ───────── le commerce ───────── */
  const PICTO_DE_LA_DENREE = { laine: 'ballot', vin: 'tonneau', bois: 'planches', luxe: 'joyau', cereales: 'epi' };
  const PICTO_DU_PORTEUR = { charrette: 'charrette', mule: 'fer_a_cheval', cale: 'navire' };
  const ligneDePorteur = (libelle, valeur) => `<div class="porteur-ligne"><span>${libelle}</span><b class="chiffres">${valeur}</b></div>`;
  const libres = (porte, charge) => `${charge - porte} / ${charge} Enc libres`;
  const lotDu = (l) => `<div class="lot${l.pris ? ' pris' : ''}">${picto(PICTO_DE_LA_DENREE[l.denree], 16)}<span>${echapper(l.nom)}</span><span class="chiffres">${l.enc} Enc</span></div>`;
  /* la main ailleurs (l'invité regarde l'hôte composer) : chaque geste fermé, les parts non réglables */
    const gestesDeLOffre = (gestes) => `<div class="gestes">${gestes.map((g) => plaque(echapper(g.libelle), { armee: !!g.principal && !('main' in etat), fermee: 'main' in etat, taille: 'petite' })).join('')}</div>`;
  /* ce qui se pose dans la scène : l'offre d'un négociant (son enseigne, ou dépliée sur ses mesures et ses gestes), un
     porteur du groupe et ce qu'il porte, le navire, un service sur son bâtiment, le constructeur et ses Améliorations */
  const PICTO_DU_GESTE = { entrer: 'porte', dormir: 'lit', informations: 'bulle' };
  const HOTES_DU_COMMERCE = {
    offre: (o, l) => hote({ id: `offre-${o.denree}`, classe: `offre${o.depliee ? '' : ' enseigne'}${o.choisie ? ' choisie' : ''}`, x: 0, y: 0, l, icone: PICTO_DE_LA_DENREE[o.denree], nom: echapper(o.nom), marque: o.surplus ? 'Surplus' : '',
      sous: o.depliee ? echapper(o.negociant) : `${o.disponible} Enc${separateur('median')}${prix(o.prixDeBase)} / Enc`, pointe: 40,
      corps: o.depliee ? mesures([['Disponible', `${o.disponible} Enc`], ['Prix de base', `${prix(o.prixDeBase)} / Enc`], ...(o.estimation === undefined ? [] : [['Estimation avant Marchandage', prix(o.estimation)]])]) : '',
      pied: o.depliee && o.gestes ? gestesDeLOffre(o.gestes) : '' }),
    porteur: (p, l) => hote({ id: `porteur-${p.id}`, classe: `offre charge${p.choisi ? ' choisie' : ''}`, x: 0, y: 0, l, icone: PICTO_DU_PORTEUR[p.id], nom: echapper(p.nom), sous: echapper(p.sous), pointe: 40,
      corps: `${p.vivres ? ligneDePorteur(`Vivres${separateur('median')}eau douce`, `${p.vivres.rations} rations-jour${separateur('median')}${p.vivres.eau} L`) : ''}${ligneDePorteur(p.porte === 0 ? 'Vide' : p.porte === p.charge ? 'Pleine' : 'Chargée', libres(p.porte, p.charge))}${jauge(p.porte / p.charge, { teinte: 'or', taille: 'forte', ajout: (p.ajout ?? 0) / p.charge })}${p.lot ? lotDu(p.lot) : ''}` }),
    navire: (n, l) => hote({ id: 'navire', classe: 'offre charge', x: 0, y: 0, l, icone: 'navire', nom: echapper(n.nom), sous: echapper(n.sous), pointe: 40,
      corps: [n.coque && `${ligneDePorteur('Coque', `${n.coque.blessures} / ${n.coque.max}`)}${jauge(n.coque.blessures / n.coque.max)}`, n.salissures !== undefined && ligneDePorteur('Salissures', `niveau ${n.salissures}`),
        n.cale && `${ligneDePorteur('Cale', libres(n.cale.porte, n.cale.charge))}${jauge(n.cale.porte / n.cale.charge, { teinte: 'or', taille: 'forte' })}`,
        n.equipage && `${ligneDePorteur('Équipage', `${n.equipage.abord} sur ${n.equipage.sur}`)}${jauge(n.equipage.abord / n.equipage.sur, { teinte: 'or', taille: 'forte', ajout: n.equipage.ajout / n.equipage.sur })}`].filter(Boolean).join('') }),
    service: (s, l) => hote({ id: s.id, classe: `service${s.accueil ? '' : ' enseigne'}`, x: 0, y: 0, l, icone: PICTO_DU_SERVICE[s.id], nom: echapper(s.nom), sous: echapper(s.sous), pointe: 40,
      corps: s.accueil ? `<p>${echapper(s.accueil.dit)}</p>` : '', pied: s.accueil ? `<div class="gestes">${s.accueil.gestes.map((g) => plaque(echapper(g.libelle), { icone: PICTO_DU_GESTE[g.id], taille: 'petite' })).join('')}</div>` : '' }),
    constructeur: (c, l) => hote({ id: 'constructeur', classe: 'offre choisie', x: 0, y: 0, l, icone: 'marteau', nom: echapper(c.nom), sous: echapper(c.sous), pointe: 40, liste: true,
      corps: c.ameliorations.map((a) => `<div class="lot${a.prise ? ' pris' : ''}${a.fermee ? ' ferme' : ''}"><span>${echapper(a.nom)}</span><span class="chiffres">${a.enc ? `${a.enc} Enc${separateur('median')}` : ''}${prix(a.prix)}</span></div>`).join('') }),
  };
  /* une ligne de compte : son libellé et son détail, sa valeur */
  const detailDu = (d) => ('enc' in d ? `${d.enc} Enc à ${prix(d.a)}` : 'nombre' in d ? `${d.nombre} à ${prix(d.a)}` : `${signe(d.pourcent)} %`);
  const valeurDu = (v) => ('prix' in v ? prix(v.prix) : 'dr' in v ? `${v.qui ? `${echapper(v.qui)} ` : ''}${signe(v.dr)} DR` : `${echapper(v.texte)}${v.plus === undefined ? '' : ` <span class="chiffres">${signe(v.plus)}</span>`}`);
  const ligneDeCompte = (l) => `<tr><td>${echapper(l.libelle)}${l.detail ? `<span class="chiffres">${detailDu(l.detail)}</span>` : ''}</td><td class="chiffres">${valeurDu(l.valeur)}</td></tr>`;
  const nombre = (n) => moinsPlus({ entre: `<b class="chiffres">${n}</b>` });
  /* les blocs d'une page de service ; un filet sépare ceux qui changent de sujet */
  const BLOCS = {
    porteurs: (b) => `<div class="porteurs">${b.porteurs.map((p) => `<div class="porteur${p.pris ? ' pris' : ''}"><div class="l">${picto(PICTO_DU_PORTEUR[p.id], 18, '#5a2a12')}${nom({ texte: echapper(p.nom) })}</div><span class="chiffres">${libres(p.porte, p.charge)}</span>${jauge(p.porte / p.charge, { teinte: 'or', taille: 'forte', ajout: (p.ajout ?? 0) / p.charge })}</div>`).join('')}</div>`,
    quantite: (b) => `<div class="r">${echapper(b.libelle)}${b.aide ? raison(echapper(b.aide), { survolee: false }) : ''}</div>${quantite(b.valeur, b.min, b.max)}`,
    faits: (b) => `<table class="faits">${b.lignes.map(ligneDeCompte).join('')}</table>`,
    compte: (b) => `<table class="compte">${b.lignes.map(ligneDeCompte).join('')}<tr class="total"><td>${echapper(b.total.libelle)}</td><td>${prix(b.total.prix)}</td></tr></table>`,
    voies: (b) => `<div class="voies">${b.voies.map(voieDu).join('')}</div>`,
    lignes: (b) => `<div class="lignes${b.reglable ? '' : ' deux'}">${b.lignes.map((l) => `<div class="ligne${l.prise ? ' prise' : ''}">${nom({ texte: echapper(l.nom) })}<span class="c">${echapper(l.sous ?? '')}</span><span class="px chiffres">${prix(l.prix)}</span>${b.reglable ? nombre(l.nombre) : `<span class="n chiffres">${l.nombre}</span>`}${l.aide ? raison(echapper(l.aide), { survolee: false }) : ''}</div>`).join('')}</div>`,
    nombre: (b) => `<div class="combien"><span class="r">${echapper(b.libelle)}</span>${nombre(b.valeur)}</div>`,
  };
  const SOUS_UN_FILET = ['porteurs', 'quantite', 'faits', 'voies', 'nombre', 'compte'];
  const gesteDeLaPage = (g) => plaque(echapper(g.libelle), { armee: !!g.principal && !('main' in etat), fermee: 'main' in etat, classe: 'conclure' });
  /* les bourses du groupe au pied de la page, réglables avant validation, et leur total */
  const boursesDu = (parts) => rangeeDeBourses({ parts: parts.map((p) => ({ id: p.heros, nom: prenomDe(p.heros), part: prix(p.part), avoir: prix(p.avoir), reglee: !!p.reglee })),
    total: prix(parts.reduce((t, p) => t + p.part, 0)), reglable: !('main' in etat) });
  /* la page du service ouvert : ses blocs, les bourses du groupe à son pied, ses gestes ; sa note, ou, la main ailleurs,
     la raison qui ferme ses gestes */
  const pageDu = (p) => page('page', echapper(p.titre), colonne('page', { tete: `<div class="tete">${titre({ texte: echapper(p.nom), cle: 'page' })}${sousTitre({ texte: echapper(p.sous) })}</div>`,
    corps: p.blocs.filter((b) => b.bloc !== 'parts').map((b, k, blocs) => `${SOUS_UN_FILET.includes(b.bloc) && blocs[k - 1]?.bloc !== 'nombre' ? filet() : ''}${BLOCS[b.bloc](b)}`).join(''),
    pied: p.blocs.filter((b) => b.bloc === 'parts').map((b) => boursesDu(b.parts)).join(''),
    geste: p.gestes.length > 1 ? `<div class="deux">${p.gestes.map(gesteDeLaPage).join('')}</div>` : p.gestes.map(gesteDeLaPage).join(''),
    note: etat.main ? `<div class="note refus">${sceau('reseau', 'menu')}${glose({ texte: echapper(etat.main.refus), variante: 'avertissement', cle: 'refus' })}</div>` : p.note && `<div class="note">${glose({ texte: echapper(p.note) })}</div>` }));
  /* la carte du port ou le trajet qui part d'ici, son ouverture ; les départs : la destination, sa voie et sa longueur, un
     moyen par plaque et ses jours, la place qu'une voiture vend */
  const PICTO_DU_MOYEN = { navire: 'navire', pied: 'botte', diligence: 'roue' };
  const departDu = (d) => `<div class="depart"><div class="ou">${nom({ texte: echapper(d.vers) })}<span class="rubrique">Par ${echapper(d.par)}${separateur('median')}${d.distance} ${d.unite}</span>${d.place ? `<p>Diligence : ${prix(d.place.prix)} la place, ${echapper(d.place.classe)}.</p>` : ''}</div>
    <div class="moyens">${d.moyens.map((m) => plaque('', { prix: `${m.jours} j`, icone: PICTO_DU_MOYEN[m.id], taille: 'petite' })).join('')}</div></div>`;
  const carteDuLieu = (c, decor) => [
    c.trajet ? trajetDu(c.trajet, decor) : cadre('carte-du-lieu', null, null, null, null, 'parchemin', CARTE_DU_PORT, { piece: 'vignette' }),
    ouvrir(echapper(c.ouvrir), 'loupe', 1),
    cadre('partir', null, null, null, null, 'bois', colonne('colonne-droite-basse', { corps: c.departs.map(departDu).join('') }), { ruban: c.departs.every((d) => d.moyens.every((m) => m.id === 'navire')) ? 'Prendre la mer' : 'Partir', piece: 'colonne-droite-basse' }),
  ];
  /* le commerce : le cartouche, le récit du port ou le rail des services, la rumeur ; les hôtes de la scène en colonne
     (en deux colonnes devant la carte du port) à droite du cartouche, entre le rail et la page ; la page du service ouvert, ou la carte du port ; le groupe, ou la fenêtre du Marchandage */
  const ICONE_DU_COMMERCE = { halle: 'panier', quai: 'ancre', relais: 'lit' };
  const commerce = (c) => [
    titreDuLieu(c.titre, ICONE_DU_COMMERCE[c.decor]),
    ...(c.recit ? [`<div id="recit" class="${c.arrivee ? 'lieu' : ''}" data-piece="recit">${rubrique({ texte: `${c.arrivee ? `Arrivée à ${echapper(c.arrivee.lieu)}${separateur('median')}Voyage de ${c.arrivee.heures} h.` : ''}` })}<p class="ombre" data-texte="recit">${echapper(c.recit)}</p></div>`] : []),
    ...(c.rail ? [railDu(c.rail)] : []),
    ...(c.rumeur ? [`<div id="rumeur" class="parchemin" data-piece="note"><i class="clou"></i><div class="r">${echapper(c.rumeur.titre)}</div><p data-texte="rumeur">${echapper(c.rumeur.texte)}</p></div>`] : []),
    `<div id="scene-du-commerce" class="${c.decor}${c.carte && !c.carte.trajet ? ' en-deux' : ''}" data-piece="${c.carte && !c.carte.trajet ? 'hotes-en-deux' : 'hotes'}">${defile(c.scene.map((h) => HOTES_DU_COMMERCE[h.role](h, c.carte && !c.carte.trajet ? 226 : 340)).join(''), '', { liste: true })}</div>`,
    ...(c.page ? [pageDu(c.page)] : []), ...(c.carte ? carteDuLieu(c.carte, c.decor) : []),
    ...(c.main ? [mainAilleurs(c.main)] : []),
    ...(c.fenetre ? [fenetre(c.fenetre)] : [bandeauDu(c.groupe, c.main ? (h) => joueDe(c.main.joueurs[h.id]) : undefined), retour(echapper(c.retour), c.carte ? 'route' : 'sortie')]), coins(),
  ];
  /* qui joue un héros du bandeau, en coop : son joueur, le sceau du réseau s'il se reconnecte */
  const joueDe = (j) => `<div class="joue">${j.absent ? sceau('reseau', 'menu') : ''}${etiquette({ texte: nomDuJoueur(j), teinte: j.vous ? 'or' : 'fer' })}</div>`;
  /* qui tient la main, en coop : le joueur, ce qu'il fait, la partie */
  const mainAilleurs = (m) => `<div id="main" class="cadre bois" data-piece="note"><div class="fond bois">${medaillon('reseau', { taille: 'moyen' })}<div>${nom({ texte: `La main est à ${m.tient.hote ? 'l’hôte' : echapper(m.tient.nom)}`, taille: 'grand', cle: 'main' })}<span class="rubrique">${echapper(m.tient.nom)} ${echapper(m.fait)}${separateur('median')}partie ${echapper(m.partie)}</span></div></div>${ferrures}</div>`;
  /* le décor du commerce (`commerce/commerce.js`) : la charrette chargée quand elle porte un lot ; la cour du relais
     (`voyage/voyage.js`), son coin haut assombri sous le cartouche et le récit */
  const CHARGE_DE_LA_CHARRETTE = 3;
  const DECORS_DU_COMMERCE = {
    halle: (c) => sceneDeLaHalle({ charge: c.scene.some((h) => h.role === 'porteur' && h.id === 'charrette' && h.lot) ? CHARGE_DE_LA_CHARRETTE : 0 }),
    quai: () => sceneDuQuai(),
    relais: (c) => { toile().innerHTML = D.relais(c.enceinte); fermer(); el(S, 'rect', { width: 560, height: 280, fill: 'url(#haut)', opacity: 0.55 }); },
  };
  const peindreLeCommerce = (c) => DECORS_DU_COMMERCE[c.decor](c);

  /* ───────── les dossiers ───────── */
  /* le dossier d'une possession, au gabarit de la fiche : l'identité (son nom lu ou en saisie, ses mesures, ses
     compteurs), le profil, la silhouette dans sa niche, les sections à onglets et leurs blocs, qui défilent */
  const mesureDu = (m) => `<div class="mesure"><div class="tete rubrique"><span>${echapper(m.nom)}</span><b class="chiffres">${m.sur === undefined ? m.valeur : `${m.valeur} / ${m.sur}`}</b></div>${jauge(m.valeur / (m.sur ?? 100), { teinte: m.teinte, taille: 'forte' })}</div>`;
  const PICTO_DU_TRAIT = { 'peu-maniable': 'barre', robuste: 'coque', dresse: 'dresse', nerveux: 'nerveux' };
  const aucune = (n) => (n ? String(n) : 'aucune');
  const BLOCS_DU_DOSSIER = {
    traits: (b) => b.traits.map((t) => `<div class="arme trait"><div class="vignette laiton"><div>${picto(PICTO_DU_TRAIT[t.id], 100, '#e2c06a', 1.3)}</div></div>
      <div class="texte">${nom({ texte: echapper(t.nom), taille: 'grand' })}<p data-texte="trait ${echapper(t.nom)}">${echapper(t.texte)}</p></div></div>`).join(''),
    reserves: (b) => `<div class="etats">${[['Eau douce', `${milliers(b.eau)} L`], ['Vivres de l’équipage', pluriel(b.vivres, 'ration')], ['Salissures', aucune(b.salissures)], ['Avaries', aucune(b.avaries)]].map(([l, v]) => `<div class="etat-n"><span class="rubrique">${l}</span><b class="chiffres">${v}</b></div>`).join('')}</div>`,
    livre: (b) => `<p class="livre" data-texte="texte du livre">${echapper(b.texte)}</p>`,
    cale: (b) => mesureDu({ nom: 'Cale', valeur: b.porte, sur: b.capacite, teinte: 'or' }),
    lots: (b) => `${filet()}${rubrique({ texte: 'Lots en cale' })}<div class="cartes">${b.lots.map((l) => carte(echapper(l.nom), `${l.enc} Enc`, { armee: !!l.choisi, classe: 'courte' })).join('')}</div>`,
    deplacer: (b) => `${filet()}${rubrique({ texte: `Déplacer ${echapper(b.lot)} vers`, note: 'les porteurs qui sont là où est le navire' })}<div class="cartes">${b.vers.map((v) => carte(echapper(v.nom), `de ${prenomDe(v.de)}${separateur('median')}${v.porte} / ${v.charge} Enc`, { armee: !!v.choisi, portrait: portrait(v.genre, { taille: 'petit' }) })).join('')}
      <div class="quantite">${moinsPlus({ plus: b.quantite.valeur < Math.min(b.quantite.sur, b.quantite.place), entre: `<b class="chiffres">${b.quantite.valeur} Enc</b>` })}<span class="rubrique">sur ${b.quantite.sur}${separateur('median')}${b.quantite.place} de place</span>${plaque('Déplacer', { armee: true })}</div></div>`,
    aBord: (b) => `${filet()}${rubrique({ texte: 'À bord', fin: `<b class="chiffres">${b.porte} / ${b.capacite} Enc</b>` })}${b.possessions.map((x) => `<div class="embarquee">${portrait(x.genre, { taille: 'petit' })}<div class="qui">${nom({ texte: echapper(x.nom), taille: 'grand' })}${sousTitre({ texte: `${echapper(x.modele)} ${de(prenomDe(x.de))}${separateur('median')}${x.enc} Enc à bord` })}</div>${plaque('Débarquer')}</div>`).join('')}`,
    lieu: (b) => `<div class="ou"><div class="l"><span class="rubrique">Se trouve</span><b>${echapper(b.ou)}</b></div><div class="plaques">${b.gestes.map((g) => plaque(`${echapper(g.libelle)}${g.refus && g.survol ? raison(echapper(g.refus)) : ''}`, { armee: !!g.principal, fermee: !!g.refus })).join('')}</div></div>`,
    embarquer: (b, d) => { const n = b.navires.find((x) => x.choisi);
      return `${filet()}${rubrique({ texte: 'Embarquer sur', note: 'les navires du groupe qui ont la place' })}<div class="cartes">${b.navires.map((x) => carte(echapper(x.nom), `${echapper(x.modele)}${separateur('median')}${x.porte} / ${x.capacite} Enc à bord`, { armee: !!x.choisi, portrait: portrait('navire', { taille: 'petit' }) })).join('')}
        <div class="quantite"><span class="rubrique">${echapper(d.possession.nom)} et sa charge${separateur('median')}${b.charge} Enc</span>${plaque(`Embarquer sur ${echapper(n.nom)}`, { armee: true })}</div></div>`; },
    abandon: (b) => `${filet()}${rubrique({ texte: `Abandonner ${echapper(b.nom)}` })}<div class="plaques confirme">${plaque('Confirmer l’abandon', { armee: true })}${plaque('Annuler')}</div>`,
  };
  const dossier = (d) => {
    const p = d.possession;
    const lignes = [echapper(p.modele), `${echapper(p.nature)}${p.de ? ` ${de(prenomDe(p.de))}` : ''}`, [p.longueur && `${p.longueur} mètres`, prix(p.prix)].filter(Boolean).join(separateur('median')),
      `<div class="renommer${p.saisie ? ' en-saisie' : ''}">${rond('plume', 'menu', { arme: !!p.saisie })}<span class="rubrique">Renommer</span></div>`];
    return [
      identiteDe(p.genre, p.saisie ? champ('', echapper(p.nom)) : echapper(p.nom), lignes, d.mesures, `<div class="reserves">${d.compteurs.map(compteurNomme).join('')}</div>`),
      bandeDu(d.profil.caracs, (c) => caseDuProfil(c.ab, c.valeur === null ? '–' : c.signe ? signe(c.valeur) : c.valeur, `${echapper(c.nom)}${c.unite ? ` : ${pluriel(c.valeur, echapper(c.unite))}` : ''}`), echapper(d.profil.titre)),
      figureDe(SILHOUETTES[p.genre]),
      `<div id="f-sections" class="cadre bois dossier" data-piece="sections"><div class="fond parchemin">${defile(d.blocs.map((b) => BLOCS_DU_DOSSIER[b.bloc](b, d)).join(''), '', { liste: true })}</div>${onglets(d.sections.map(echapper), echapper(d.ouverte), 'sections')}${ferrures}</div>`,
      bandeauDu(d.groupe), croix(), coins(),
    ];
  };
  /* la mer sans navire sous le dossier, assombrie, voilée sur ses bords */
  const peindreLeDossier = () => { toile().innerHTML = D.mer({ navire: false }); el(S, 'rect', { width: W, height: H, fill: '#06040a', opacity: 0.5 }); voiles(); };

  /* ───────── l'exploration et le récit ───────── */
  /* le pictogramme du geste qu'offre une chose de la scène, d'un geste du groupe, d'un écran à ouvrir */
  const PICTO_DU_GESTE_DE_SCENE = { franchir: 'porte', parler: 'bulle', fouiller: 'cle', ramasser: 'main', lire: 'livre', enjamber: 'porte' };
  const PICTO_DU_GESTE_DU_GROUPE = { soigner: 'soin', reposer: 'sommeil', fouiller: 'oeil' };
  const PICTO_DE_L_ECRAN = { carte: 'carte', carnet: 'livre' };
  /* les trois regards, et la touche du regard suivant ; celle d'agir sur ce que vise le point de mire
     (`changer_de_regard`, `agir`, `hotes/godot/projet/project.godot`) */
  const REGARDS = { tactique: 'Isométrique', plateau: 'Dessus', immersion: 'Première personne' };
  const TOUCHES = { regard: 'V', agir: 'E' };
  const touche = (t) => `<kbd class="touche chiffres">${t}</kbd>`;
  const regardDu = (r) => `<div id="regard" class="cadre bois" data-piece="regard"><div class="fond bois"><span class="rubrique">Regard</span>${segments(Object.values(REGARDS), REGARDS[r])}${touche(TOUCHES.regard)}</div></div>`;
  /* le journal hors combat, au bord droit au-dessus du bandeau ou de la fenêtre du bas : la ligne neuve en dernier */
  const journalDu = (lignes) => `<div id="fil" data-piece="journal">${rubrique({ texte: 'Journal' })}${defile(lignes.map((l, k) => (typeof l === 'string'
    ? `<p class="${k === lignes.length - 1 ? '' : 'vieux '}ombre">${echapper(l)}</p>` : `<p class="moment ombre">${echapper(l.moment)}</p>`)).join(''), 'au-pied', { liste: true })}</div>`;
  /* ce qui est à portée sur la scène, à son point (`pointDe`, `exploration-et-recit/scene.js`) : sa marque ; survolée, ce
     qu'on en sait et son geste, l'aperçu du côté où l'écran a la place ; signalée, son nom et son geste en poste */
  const marqueDe = (c, [x, y]) => `<div class="marque" data-piece="marque ${echapper(c.nom)}"${mobile('scene')} style="left:${x}px;top:${y}px">${medaillon(PICTO_DU_GESTE_DE_SCENE[c.geste.id], { taille: 'petit' })}</div>`;
  const aCote = ([x, y], { nom, corps }) => {
    const aDroite = x < VUE.largeur / 2;
    return apercu({ nom, vers: aDroite ? 'gauche' : 'droite', style: `left:${aDroite ? x + 30 : x - 330}px;top:${y - 60}px;--pointe:52px`, corps });
  };
  const survolDe = (c, point, regard) => aCote(point, { nom: echapper(c.nom), corps: `<p>${echapper(c.survolee)}</p>
    <div class="geste">${rond(PICTO_DU_GESTE_DE_SCENE[c.geste.id], 'menu', { arme: true })}${echapper(c.geste.libelle)}<em>${regard === 'immersion' ? `${touche(TOUCHES.agir)} ou clic` : 'clic'}</em></div>` });
  /* le poste d'une chose signalée, gardé entre les marges, et à gauche de la colonne des écrans à ouvrir quand il monte
     à sa hauteur (`basDesEcrans`), ou du journal quand il passe à la sienne ; sa pointe, sous l'étiquette, reste sur la
     marque */
  const LARGEUR_DU_POSTE = 160, HAUTEUR_DU_POSTE = 92, JEU_DE_LA_POINTE = LARGEUR_DU_POSTE / 2 - 8;
  const signaleeDe = (c, [x, y], basDesEcrans, journal) => {
    const haut = y + 17 - HAUTEUR_DU_POSTE, [, jy, , jh] = CADRES.journal;
    const bordDroit = Math.min(VUE.largeur - (haut < basDesEcrans ? 250 : 24), journal && haut < jy + jh && haut + HAUTEUR_DU_POSTE > jy ? placeDe(CADRES.journal)[0] - 12 : Infinity);
    const cx = Math.max(24 + LARGEUR_DU_POSTE / 2, Math.min(x, bordDroit - LARGEUR_DU_POSTE / 2));
    return poste(cx, haut, { nom: echapper(c.nom), sous: echapper(c.geste.libelle), icone: PICTO_DU_GESTE_DE_SCENE[c.geste.id], vise: true,
      piece: `chose ${echapper(c.nom)}`, pointe: Math.max(-JEU_DE_LA_POINTE, Math.min(x - cx, JEU_DE_LA_POINTE)) });
  };
  const choseDe = (c, regard, basDesEcrans, journal) => {
    const point = pointDe(c.id, regard);
    if (c.signalee) return [signaleeDe(c, point, basDesEcrans, journal)];
    return [...(regard === 'immersion' && c.survolee ? [] : [marqueDe(c, point)]), ...(c.survolee ? [survolDe(c, point, regard)] : [])];
  };
  /* les gestes du groupe que la situation ouvre, en colonne au bord gauche jusqu'à la ligne basse */
  const gestesDuGroupe = (gestes) => `<div id="gestes-groupe" data-piece="gestes-du-groupe">${gestes.map((g) => `<div>${rond(PICTO_DU_GESTE_DU_GROUPE[g.id], 'grand')}<span class="rubrique ombre">${echapper(g.libelle)}</span></div>`).join('')}</div>`;
  /* les écrans à ouvrir au bord droit, sous le regard */
  const ECART_DES_ECRANS = 58;
  const hautDesEcrans = (e) => (e.regard ? 82 : 20);
  const ecransDu = (e) => (e.ouvrir ?? []).map((o, k) => ouvrir(echapper(o.libelle), PICTO_DE_L_ECRAN[o.id], k + 1));
  /* le document remis, en carton au-dessus du bandeau : son titre, d'où il vient et qui le tient, son texte paginé, son cachet ;
     au pied, où il se relit et « Replier » */
  const documentDu = (d) => cadre('document', null, null, null, null, 'parchemin', `
    <div class="tete">${titre({ texte: [d.titre, d.sous].filter(Boolean).map(echapper).join(' '), cle: 'titre du document' })}<span class="rubrique">${echapper(d.provenance)}${separateur('median')}lu par ${prenomDe(d.heros)}</span></div>
    ${filet({ losange: true })}
    ${defile(`${d.paragraphes.map((p, k) => `<p data-texte="document ${k + 1}">${echapper(p)}</p>`).join('')}<p class="signe">${d.signature.map(echapper).join('<br>')}</p>`, 'pages texte', { liste: true })}
    <div class="pied"><span class="pas-a-pas folio">${picto('gauche', 13, '#5a4530', 2)}<b class="rubrique"></b>${picto('droite', 13, '#5a4530', 2)}</span><div class="note">${rond(d.relu ? 'livre' : 'journal', 'menu', { arme: true })}${glose({ texte: d.relu ? 'Relu depuis le carnet : « Replier » y ramène.' : 'Consigné au carnet : il se relit quand on veut.' })}</div>
      ${plaque('Replier', { armee: true })}${sceau(d.sceau, 'maitre')}</div>`, { ruban: 'Document', piece: 'carton' });
  /* la fouille, dans la fenêtre du bas : ce qu'on trouve, l'argent réparti et à qui va ce qui reste ; une case par héros
     (sa charge, en rouge quand elle est pleine) et « Laisser » pour chaque objet */
  const chargeDu = (c) => { const plein = c.enc >= c.max;
    return `<div class="col">${portrait(c.qui, { taille: 'menu' })}<div class="q">${nom({ texte: prenomDe(c.qui), taille: 'petit' })}<span class="chiffres${plein ? ' plein' : ''}">Enc ${c.enc} / ${c.max}</span>${jauge(c.enc / c.max, { teinte: plein ? 'cire' : 'or' })}</div></div>`; };
  const fouilleDu = (f) => bandeauDuJet('Butin', 'fouille', places('fenetre', {
    gauche: `<div class="trouve">${titre({ texte: echapper(f.sur), cle: 'butin titre' })}${sousTitre({ texte: `Fouillé par ${prenomDe(f.par)}` })}
      <p data-texte="butin récit">${echapper(f.texte)}</p>
      <div class="bourse">${sceau('pieces')}<span><b class="chiffres">${prix(f.argent)}</b> répartis entre les bourses</span></div>
      <div class="reste">Ce qui reste à la fermeture va à ${prenomDe(f.reste)}.</div></div>`,
    large: `<div class="partage" style="--heros:${f.charges.length}"><div class="tete-o rubrique">Une case donne l’objet à ce héros</div>${f.charges.map(chargeDu).join('')}<div class="col laisser">${picto('croix', 15)}<b>Laisser</b></div>
      ${f.objets.map((o) => `<div class="objet"><div class="ic">${picto(o.id, 17)}</div><div class="t">${nom({ texte: echapper(o.nom), taille: 'petit', cle: `objet ${echapper(o.nom)}` })}<span class="chiffres">Enc ${o.enc}</span></div></div>${'<i class="prise"></i>'.repeat(f.charges.length + 1)}`).join('')}</div>` }),
  f.gestes.map((g) => plaque(echapper(g.libelle), { armee: !!g.principal, taille: 'geste' })));
  /* l'exploration : le cartouche du lieu, le regard et les écrans à ouvrir au bord droit, ce qui est à portée sur la
     scène, les gestes du groupe au bord gauche, le journal ; le document remis ; le groupe, ou la fenêtre qui prend sa
     place ; le retour au lieu */
  const ICONE_DU_LIEU = { salle: 'lit', 'grand-route': 'route' };
  const exploration = (e) => {
    const regard = e.regard ?? 'tactique', ecrans = ecransDu(e);
    const basDesEcrans = ecrans.length ? hautDesEcrans(e) + ECART_DES_ECRANS * ecrans.length : 0;
    return [
      titreDuLieu(e.titre, ICONE_DU_LIEU[e.decor]),
      ...(e.regard ? [regardDu(e.regard)] : []), ...ecrans,
      ...(e.choses ?? []).flatMap((c) => choseDe(c, regard, basDesEcrans, !!e.journal)),
      ...(e.invite ? [aCote(pointDe(e.invite.sur, regard), { nom: echapper(e.invite.titre), corps: `<p data-texte="invite">${echapper(e.invite.texte)}</p>` })] : []),
      ...(regard === 'immersion' ? ['<i id="mire"></i>'] : []),
      ...(e.gestes?.length ? [gestesDuGroupe(e.gestes)] : []),
      ...(e.journal ? [journalDu(e.journal)] : []),
      ...(e.document ? [documentDu(e.document)] : []),
      ...(e.fouille ? [fouilleDu(e.fouille)] : e.fenetre ? [fenetre(e.fenetre)] : [bandeauDu(e.groupe)]),
      ...(e.retour ? [retour(echapper(e.retour), 'ville')] : []), coins(),
    ];
  };
  /* la salle sous le regard tenu (`exploration-et-recit/scene.js`) : le groupe à sa place, la chose survolée ou celle à qui
     l'on parle, la dague au sol, l'avis ou la croisée qui luisent ; elle recule derrière une page ; la route de nuit */
  const RECULE = 0.3;
  const peindreLExploration = (e) => {
    if (e.decor === 'grand-route') return sceneRoute();
    const choses = e.choses ?? [], est = (id) => choses.some((c) => c.id === id), signalee = (id) => choses.some((c) => c.id === id && c.signalee);
    const survol = e.fenetre?.autre?.role === 'interlocuteur' ? e.fenetre.autre.qui : choses.find((c) => c.survolee)?.id ?? null;
    if (e.regard === 'plateau') return sceneAubergeDessus({ dague: est('dague'), croisee: signalee('croisee') });
    if (e.regard === 'immersion') return sceneAubergeAuxYeux({ dague: est('dague') });
    return sceneAuberge({ groupe: e.groupeEn ?? 'entree', survol, trajet: !!e.marcheVers, avis: signalee('avis') || !!e.document, sombre: e.document || 'actes' in e ? RECULE : 0, colonne: !!e.gestes?.length, dague: est('dague'), croisee: signalee('croisee') });
  };

  /* la carte du monde : le Reikland à l'encre et les lieux connus (`exploration-et-recit/carte.js`), le groupe sur le
     sien ; la destination au coin haut-droit, ses étapes, ses moyens et ce qu'ils coûtent, le geste qui part */
  const PICTO_DU_MOYEN_DE_VOYAGE = { diligence: 'roue', pied: 'botte' };
  const NOM_DU_MOYEN = { diligence: 'En diligence', pied: 'À pied' };
  const NUITS = { auberge: 'à l’auberge', route: 'en route' };
  const moyenDu = (m) => `<div class="transport${m.pris ? ' pris' : ''}">${medaillon(PICTO_DU_MOYEN_DE_VOYAGE[m.id], { taille: 'moyen' })}<div class="q">${nom({ texte: NOM_DU_MOYEN[m.id] })}${sousTitre({ texte: `${pluriel(m.jours, 'jour')}${separateur('median')}${pluriel(m.nuits.nombre, 'nuit')} ${NUITS[m.nuits.a]}` })}</div>
    <div class="px chiffres">${m.place ? `${prix(m.place.dehors)} dehors<br>${prix(m.place.dedans)} dedans<small>par tête</small>` : 'sans frais'}</div></div>`;
  const destinationDu = (d) => cadre('destination', null, null, null, null, 'bois', colonne('colonne-droite', { tete: `${titre({ texte: echapper(d.nom), cle: 'destination' })}
    ${sousTitre({ texte: `Par ${echapper(d.par)}${separateur('median')}${d.etapes.reduce((t, x) => t + (x.km ?? 0), 0)} km` })}`, corps: `<p data-texte="prose du lieu">${echapper(d.texte)}</p>
    <div class="etapes">${d.etapes.map((x, k) => `${x.km ? `<div class="t"><u></u><span class="chiffres">${x.km} km</span></div>` : ''}<div class="e${k ? '' : ' ici'}"><i></i><span class="rubrique">${echapper(x.nom)}</span></div>`).join('')}</div>
    ${d.moyens.map(moyenDu).join('')}`, geste: plaque(echapper(d.geste.libelle), { armee: !!d.geste.principal, icone: 'route', classe: 'partir' }) }), { ruban: 'Destination', piece: 'colonne-droite' });
  const lieuDuMonde = (l, groupe) => { const { x, y, icone } = LIEUX_DU_REIKLAND[l.id];
    return `<div class="lieu bois${l.choisi ? ' choisi' : ''}${l.ici ? ' sous' : ''}" style="left:${(100 * x) / 1225}%;top:${(100 * y) / 572}%">${medaillon(icone, { taille: 'petit' })}<div>${nom({ texte: echapper(l.nom), taille: 'petit' })}<span class="rubrique">${[echapper(l.nature), l.distance && `${l.distance} km`, l.ici && 'le groupe est ici'].filter(Boolean).join(separateur('median'))}</span></div>${l.ici ? `<div class="ici">${groupe.map((h) => portrait(h.id, { taille: 'menu' })).join('')}</div>` : ''}</div>`; };
  const carteDuMonde = (c) => [
    titreDuLieu(c.titre, 'carte'),
    `<div id="reikland" class="cadre bois" data-piece="carte-du-monde"><div class="fond parchemin"><svg viewBox="0 0 1225 572" preserveAspectRatio="none"></svg>${c.lieux.map((l) => lieuDuMonde(l, c.groupe)).join('')}</div>${ferrures}</div>`,
    destinationDu(c.destination),
    ...(c.fenetre ? [fenetre(c.fenetre)] : [bandeauDu(c.groupe)]),
    retour(echapper(c.retour), 'porte'), coins(),
  ];
  const tracerLeReikland = (c) => dessinerLeReikland(document.querySelector('#reikland svg'), c.lieux.find((l) => l.ici)?.id);

  /* le carnet d'enquête, écran de gestion posé sur la salle : les affaires et les documents remis dans le panneau de
     gauche, l'affaire ouverte tendue à droite, ses indices et leurs lectures, la dernière en tête */
  const lectureDe = (l, classe = '') => `<div class="lu${l.manuscrite ? ' manuscrite' : ''} ${classe}"><div class="tete">${nom({ texte: echapper(l.titre) })}</div>${l.lignes.map((p) => `<p>${echapper(p)}</p>`).join('')}</div>`;
  const indiceDu = (i) => `<div class="indice">${nom({ texte: echapper(i.nom), taille: 'grand' })}${etiquette({ texte: 'Indice' })}${i.nouveau ? etiquette({ texte: 'Nouveau', teinte: 'cire' }) : ''}${plaque('Épingler', { icone: 'epingle', armee: !!i.epingle, taille: 'petite', classe: 'epingle' })}</div>
    ${defile(`<div class="lectures"><div>${rubrique({ texte: 'Dernière lecture' })}${lectureDe(i.lectures[0])}</div>${i.lectures.length > 1 ? `<div>${rubrique({ texte: 'Lectures précédentes' })}${i.lectures.slice(1).map((l) => lectureDe(l, 'attenue')).join('')}</div>` : ''}</div>`, '', { liste: true })}`;
  const carnet = (c) => {
    const affaire = c.affaires.find((a) => a.id === c.ouverte);
    return [
      cartouche({ icone: 'livre', nom: echapper(c.titre.nom), sous: echapper(c.titre.sous), taille: 'titre' }),
      rail('Affaires', [['epingle', 'Épinglés', false, c.epingles], ...c.affaires.map((a) => ['oeil', echapper(a.nom), a.id === c.ouverte, a.indices])], 'Un indice caché ne s’y lit pas', 'colonne-gestion',
        places('colonne-gestion', { documents: `<div class="documents">${rubrique({ texte: 'Documents remis' })}${c.documents.map((d) => plaque(echapper(d), { icone: 'lettre' })).join('')}${glose({ texte: 'Un document remis se relit ici' })}</div>` })),
      `<div id="affaire" class="page cadre bois" data-piece="affaire"><div class="fond parchemin">
        <div class="tete">${titre({ texte: echapper(affaire.nom), cle: 'affaire' })}${sousTitre({ texte: pluriel(affaire.indices, 'indice') })}</div>${filet()}
        ${c.indices.map(indiceDu).join('')}</div>${ferrures}</div>`,
      croix(),
    ];
  };

  /* ───────── le héros : sa création, sa fiche, sa progression ───────── */
  /* la note seule d'un bloc ; la Caractéristique d'une ligne ; le nom d'une Compétence et sa précision */
  const car = (c) => etiquette({ texte: c });
  const nomDe = (n, precision) => `${echapper(n)}${precision ? ` <small>(${echapper(precision)})</small>` : ''}`;
  /* un compte : `or` à tenir, `cire` à corriger, `fer` épuisé */
  const compte = (texte, teinte = '') => etiquette({ texte, variante: 'compte', teinte });
  const px = (n) => `${n} PX`;
  const reste = (r, teinte = 'or') => compte(`À répartir${separateur('median')}${r.n} / ${r.sur}`, teinte);
  /* une ligne d'une liste à choisir : cochée, ou fermée et sa raison au survol */
  const optionDe = (o, fin = '') => `<div class="ligne${o.choisie ? ' choisie' : ''}${o.refus ? ' refusee' : ''}">${puce(o.choisie ? 'coche' : 'losange')}<span class="n" data-texte="${echapper(o.nom)}${o.precision ? ` ${echapper(o.precision)}` : ''}">${nomDe(o.nom, o.precision)}</span>${fin}${o.refus && o.survol ? raison(echapper(o.refus)) : ''}</div>`;
  const faitDu = (f) => `<div class="fait">${rubrique({ texte: echapper(f.rubrique) })}<b data-texte="${echapper(f.rubrique)}">${echapper(f.valeur)}</b></div>`;
  const pills = (noms, prise = null) => `<div class="pills">${noms.map((n) => etiquette({ texte: echapper(n), variante: 'pastille', teinte: n === prise ? 'or' : '' })).join('')}</div>`;
  /* un compteur nommé d'une possession, au pied de son identité */
  const compteurNomme = (r) => `<div class="reserve">${disque(r.valeur, { taille: 'grand' })}${rubrique({ texte: echapper(r.nom) })}</div>`;

  /* la frise des étapes : cochées, le ruban de celle qui s'ouvre, les clous de celles à venir, la croix au bout ; le rail
     se trace une fois posée (`tracerLaFrise`) */
  const friseDesEtapes = (etapes, rang) => cadre('etapes', null, null, null, null, 'bois', `<div class="suite"><i class="rail"></i><i class="rail fait"></i>${etapes.map((nom, k) => (k < rang - 1
    ? `<div class="etape faite">${rond('coche', 'menu')}<span class="rubrique">${echapper(nom)}</span></div>`
    : k === rang - 1 ? `<div class="etape en-cours">${ruban(`${echapper(nom)}<small class="chiffres">${rang}/${etapes.length}</small>`)}</div>`
      : `<div class="etape a-venir"><i class="clou"></i>${k === rang ? `<span class="rubrique">${echapper(nom)}</span>` : ''}</div>`)).join('')}</div>${croix({ dansLePanneau: true })}`);
  const tracerLaFrise = () => {
    const suite = document.querySelector('#etapes .suite'), etapes = [...suite.querySelectorAll('.etape')];
    const centre = (e) => e.offsetLeft + e.offsetWidth / 2, debut = centre(etapes[0]);
    const poser = (rail, fin) => Object.assign(rail.style, { left: `${debut}px`, width: `${fin - debut}px` });
    poser(suite.querySelector('.rail:not(.fait)'), centre(etapes.at(-1)));
    poser(suite.querySelector('.rail.fait'), centre(suite.querySelector('.en-cours')));
  };
  /* ce que le héros en création a retenu : sa rubrique et ses PX, ce qui est retenu ; sans rien, le total des PX */
  const valeurDeLAcquis = (a) => (typeof a.valeur === 'string' ? `${echapper(a.valeur)}${a.bourse === undefined ? '' : `, et ${prix(a.bourse)} en bourse`}` : `${a.valeur.n} sur ${a.valeur.sur}`);
  const acquisDe = (a) => `<div class="a${a.valeur === undefined ? ' total' : ''}"><i>${echapper(a.rubrique)}${a.px && a.valeur !== undefined ? compte(`+${px(a.px)}`) : ''}</i>
    <b data-texte="acquis ${echapper(a.rubrique)}">${a.valeur === undefined ? `<span class="chiffres">${px(a.px)}</span>` : valeurDeLAcquis(a)}</b></div>`;
  const herosEnCreation = (h) => cadre('heros-neuf', null, null, null, null, 'bois', `<div class="niche laiton"><div>${figure(h.pose, { palette: !!h.palette })}</div></div>
    <div class="acquis">${nom({ texte: echapper(h.nom ?? 'Nouveau héros'), taille: 'grand', cle: 'nom du héros' })}${h.acquis.map(acquisDe).join('')}
      <div class="gestes">${plaque(`${echapper(h.geste.libelle)} ${picto('chevron_d', 16, undefined, 2)}${h.geste.refus && h.geste.survol ? raison(echapper(h.geste.refus)) : ''}`, { armee: !h.geste.refus, fermee: !!h.geste.refus })}
        ${plaque(`${picto('chevron_g', 15, undefined, 2)} Précédent`, { taille: 'petite' })}</div></div>`, { classe: 'pan' });
  /* la tête d'une liste : sa rubrique à gauche, ce qui se règle à droite */
  const teteDeListe = (gauche, droite) => `<div class="tete-l">${gauche}${droite}</div>`;
  const nomDuDetail = (nom, sous) => `${titre({ texte: echapper(nom), cle: 'titre de page' })}${sousTitre({ texte: sous })}`;

  /* chaque étape : le choix à gauche, le ruban du détail, le détail au milieu ; la classe du choix */
  const ETAPES_DE_CREATION = {
    caracteristiques: (p) => {
      const points = p.methode === 'points', visee = p.profil.find((x) => x.carac === p.pressee);
      const porte = (x) => (x.origine ? `<span class="pts">${echapper(x.origine)}</span>` : points ? `<span class="pts nb">${x.points}</span>` : `<span class="pts">${sceau(x.de, 'petit')}</span>`);
      const caseDe = (x) => `<div class="c${x.carac === p.pressee ? ' carr' : ''}"><span class="ab">${x.carac}</span>${porte(x)}<span class="v">${x.valeur}</span>${points && !x.origine ? moinsPlus({ moins: x.points > p.points.min, plus: x.points < p.points.max && p.points.reste.n > 0 }) : ''}</div>`;
      const ligne = (r, l) => `<div class="ligne repartie">${l.carac ? car(l.carac) : ''}<span class="n" data-texte="${echapper(l.nom)}">${echapper(l.nom)}</span>${rangDePas({ pleins: l.augmentations.n, total: l.augmentations.sur, forme: 'clous' })}${moinsPlus({ moins: l.augmentations.n > 0, plus: r.reste.n > 0 && l.augmentations.n < l.augmentations.sur })}<span class="val">${l.valeur}</span></div>`;
      const methode = (m) => optionDe({ nom: m.nom, ...(m.id === p.methode ? { choisie: true } : {}) }, m.px ? compte(`+${px(m.px)}`, m.id === p.methode ? 'or' : '') : '');
      return [places('choix', { 'rangee-1': `${rubrique({ texte: 'Méthode' })}<div class="lignes methodes">${p.methodes.map(methode).join('')}</div>`,
        'rangee-2': `<div class="tirage-c">${points
    ? `${compte(`À répartir${separateur('median')}${p.points.reste.n} / ${p.points.reste.sur}`, p.points.reste.n ? 'cire' : 'or')}${glose({ texte: `De ${p.points.min} à ${p.points.max} points par Caractéristique.` })}`
    : `${sceau('des', 'moyen')}<div class="l">${rubrique({ texte: 'Les dix 2d10', note: 'tirés' })}</div>${plaque('Relancer les dix 2d10', { prix: 'sans PX', taille: 'petite', classe: 'relancer' })}`}</div>`,
        ...Object.fromEntries(p.repartitions.map((r, k) => [`rangee-${k + 3}`, `${filet({ fondu: true, losange: true })}${teteDeListe(rubrique({ texte: echapper(r.rubrique), note: echapper(r.note) }), reste(r.reste))}<div class="lignes">${r.lignes.map((l) => ligne(r, l)).join('')}</div>`])) }),
      'Profil',
      `<div class="profil-c"><div class="fond">${p.profil.map(caseDe).join('')}</div></div>
        ${nomDuDetail(visee.nom, `${points ? `${visee.points} points` : `${visee.de} aux dés`} + ${p.espece.valeur} des ${echapper(p.espece.nom)} + ${pluriel(visee.augmentations ?? 0, 'Augmentation')}`)}
        ${p.jets ? `${rubrique({ texte: `Le jet ${de(echapper(visee.nom))}`, note: 'en prendre un autre échange les deux' })}<div class="jets">${p.jets.map((j) => `<div class="jet${j.carac === p.pressee ? ' pris' : ''}">${sceau(j.de, 'petit')}<i>${j.carac}</i></div>`).join('')}</div>`
    : `${filet({ fondu: true, losange: true })}<p class="prose" data-texte="texte de la caractéristique">${echapper(p.texte)}</p>`}
        <div class="faits pied">${p.faits.map(faitDu).join('')}</div>`];
    },
    signe: (p) => [places('choix', { 'rangee-1': `<div class="tirage">${sceau(p.tirage.de, 'maitre')}<div class="col">${rubrique({ texte: 'Signe au d100', note: 'tiré' })}
        ${optionDe({ nom: p.tenu, choisie: true }, compte(`+${px(p.tirage.px)}`, 'or'))}${glose({ texte: `Le signe gardé tel que le dé l’a tiré vaut ses PX.` })}</div></div>`,
      'rangees-2-3': `${rubrique({ texte: 'Signe astral' })}${defile(p.signes.map((s) => optionDe({ nom: s, ...(s === p.tenu ? { choisie: true } : {}) })).join(''), 'deux signes', { liste: true })}`,
      'rangee-4': `${filet({ fondu: true, losange: true })}<div class="variante">${sceau('', 'petit', { etat: 'vide' })}${rubrique({ texte: 'Variante au d10', note: 'l’Étoile du Sorcier seule' })}<div class="pills">${p.variantes.map((v) => etiquette({ texte: `<b class="chiffres">${v.d10}</b>${echapper(v.nom)}`, variante: 'pastille' })).join('')}</div></div>` }),
    echapper(p.page.constellation),
    `<div class="vignette laiton">${ciel()}</div>${nomDuDetail(p.tenu, '')}${filet({ fondu: true, losange: true })}
      <div class="faits">${faitDu({ rubrique: 'Nom classique', valeur: p.page.classique })}${faitDu({ rubrique: 'Dates', valeur: p.page.dates })}${faitDu({ rubrique: 'Dans le ciel', valeur: p.page.ciel })}
        <div class="fait">${rubrique({ texte: 'Attributs de départ' })}<div class="attributs">${p.page.attributs.map((a) => compte(`${a.carac} ${signe(a.valeur)}`, a.valeur < 0 ? 'cire' : 'or')).join('')}</div></div></div>
      <p class="prose" data-texte="texte du signe">${echapper(p.page.texte)}</p>`],
    competencesDeRace: (p) => {
      const pris = (palier) => p.paliers.find((x) => x.palier === palier).pris;
      const pastille = (c, palier) => compte(palier ? `+${palier}` : '0', palier === c.palier ? 'or' : palier && pris(palier).n === pris(palier).sur ? 'fer' : '');
      const carte = (c, palier) => `<div class="competence">${car(c.carac)}${disque(c.base + palier)}<div class="n" data-texte="carte ${echapper(c.nom)}">${nomDe(c.nom, c.precision)}</div><span class="calc chiffres">${c.carac} ${c.base} +${palier}</span></div>`;
      const groupe = ({ palier, pris: { sur } }) => { const cartes = p.competences.filter((c) => c.palier === palier);
        return `${rubrique({ texte: `Augmentations à +${palier}` })}<div class="rangee">${cartes.map((c) => carte(c, palier)).join('')}${'<div class="competence vide"><span>À choisir</span></div>'.repeat(sur - cartes.length)}</div>`; };
      return [places('choix', { corps: `${teteDeListe(rubrique({ texte: 'Compétences de race' }), plaque('Répartition par défaut', { taille: 'petite', classe: 'regler' }))}
        ${defile(p.competences.map((c) => `<div class="ligne">${car(c.carac)}<span class="n" data-texte="${echapper(c.nom)} ${echapper(c.precision ?? '')}">${nomDe(c.nom, c.precision)}</span><div class="paliers">${[0, 3, 5].map((k) => pastille(c, k)).join('')}</div></div>`).join(''), 'lignes', { liste: true })}`,
        pied: `<div class="comptes">${p.paliers.map((x) => compte(`À +${x.palier}${separateur('median')}${x.pris.n} / ${x.pris.sur}`, x.pris.n === x.pris.sur ? 'fer' : 'or')).join('')}</div>` }),
      echapper(p.espece),
      `${nomDuDetail('Compétences de race', p.paliers.map((x) => `${x.pris.sur} à +${x.palier}`).join(separateur('median')))}${filet({ fondu: true, losange: true })}${p.paliers.map(groupe).join('')}${FILIGRANE}`];
    },
    competencesDeCarriere: (p) => {
      const c = p.competences.find((x) => x.pressee);
      const race = (n) => `<span class="race${n ? '' : ' sans'}">${compte(`+${n}`, 'cire')}</span>`;
      return [places('choix', { corps: `${teteDeListe(rubrique({ texte: 'Compétences de carrière' }), plaque('Répartition simple', { taille: 'petite', classe: 'regler' }))}
        ${defile(p.competences.map((x) => `<div class="ligne carriere${x.pressee ? ' choisie' : ''}">${car(x.carac)}<span class="n" data-texte="${echapper(x.nom)}">${nomDe(x.nom, x.precision)}</span>${race(x.race)}${rangDePas({ pleins: x.augmentations.n, total: x.augmentations.sur, forme: 'clous' })}${moinsPlus({ moins: x.augmentations.n > 0, plus: p.reste.n > 0 && x.augmentations.n < x.augmentations.sur })}<span class="val">${x.test}</span></div>`).join(''), 'lignes', { liste: true })}`,
        pied: `<div class="comptes">${reste(p.reste)}${glose({ texte: `${c.augmentations.sur} Augmentations au plus par Compétence.` })}</div>
        <div class="comptes">${race(5)}${glose({ texte: `Augmentations de race : acquises, hors des ${p.reste.sur} et des ${c.augmentations.sur}.` })}</div>` }),
      echapper(p.niveau),
      `${nomDuDetail(c.nom, `${c.precision ? `${echapper(c.precision)}${separateur('median')}` : ''}${echapper(p.page.carac.nom)}`)}${filet({ fondu: true, losange: true })}
        <div class="test">${disque(c.test, { taille: 'grand' })}<div>${rubrique({ texte: 'Test' })}<b>${echapper(p.page.carac.nom)} ${p.page.carac.valeur}, ${pluriel(c.augmentations.n, 'Augmentation')}</b></div></div>
        ${rubrique({ texte: `Spécialisation d’${echapper(c.nom)}` })}${pills(p.page.specialisations, c.precision)}
        ${p.page.texte.map((t, k) => `<p class="prose" data-texte="texte de la compétence ${k + 1}">${echapper(t)}</p>`).join('')}`];
    },
    talents: (p) => {
      const tirage = (t) => `<div class="tire">${sceau(t.de, 'petit')}<div class="ligne"><span class="n" data-texte="${echapper(t.nom)}"><span>${nomDe(t.nom, t.precision)}</span>${t.doublon ? `<small class="raison">${echapper(t.doublon.raison)}</small>` : ''}</span>
        ${t.utilisation ? etiquette({ texte: `Utilisation ${picto('chevron_d', 12, undefined, 2)}`, variante: 'pastille' }) : ''}${t.doublon ? plaque(echapper(t.doublon.relance), { taille: 'petite', classe: 'regler' }) : ''}</div></div>`;
      const page = 'sorts' in p.page
        ? `${nomDuDetail(p.page.talent, echapper(p.page.niveau))}${teteDeListe(rubrique({ texte: `${echapper(p.page.talent)} (${pluriel(p.page.reste.sur, 'sort')})` }), reste(p.page.reste))}
          <div class="pills mineurs">${p.page.sorts.map((s) => etiquette({ texte: `${echapper(s.nom)}${s.survol ? raison(echapper(p.page.refus)) : ''}`, variante: 'pastille', teinte: s.retenu ? 'or' : 'fer' })).join('')}</div>
          <p class="prose pied" data-texte="texte du talent">${echapper(p.page.texte)}</p>`
        : `${medaillon(p.page.icone)}${nomDuDetail(p.page.talent, echapper(p.page.niveau))}${filet({ fondu: true, losange: true })}
          <div class="faits">${faitDu({ rubrique: 'Maxi', valeur: p.page.maxi })}${faitDu({ rubrique: 'Tests', valeur: p.page.tests })}</div>
          <p class="prose" data-texte="texte du talent">${echapper(p.page.texte)}</p>${FILIGRANE}`;
      return [places('choix', { 'rangee-1': `${rubrique({ texte: 'Talents de race' })}<div class="deux">${p.race.acquis.map((t) => `<div class="ligne">${rond('coche', 'menu', { arme: true })}<span class="n" data-texte="${echapper(t)}">${echapper(t)}</span><span class="raison">Acquis</span></div>`).join('')}</div>`,
        'rangee-2': `${rubrique({ texte: 'Au choix' })}<div class="deux">${p.race.auChoix.map((o) => optionDe(o)).join('')}</div>`,
        'rangee-3': `${filet({ fondu: true, losange: true })}${rubrique({ texte: `${pluriel(p.tirages.length, 'Talent')} au d100` })}${p.tirages.map(tirage).join('')}`,
        'rangee-4': `${filet({ fondu: true, losange: true })}${rubrique({ texte: 'Talent de carrière', note: 'un seul' })}<div class="deux">${p.carriere.map((o) => optionDe(o)).join('')}</div>` }),
      'Talent de carrière', page];
    },
    possessions: (p) => {
      const note = (o) => [o.note && echapper(o.note), o.nombre && `× ${o.nombre}`, o.somme !== undefined && prix(o.somme)].filter(Boolean).join(separateur('median'));
      const objet = (o) => `<div class="objet${o.choisi ? ' choisi' : ''}"><div class="img laiton"><div>${dessinDObjet(o.id)}</div></div><b>${echapper(o.nom)}</b>${note(o) ? `<i>${note(o)}</i>` : ''}</div>`;
      const dot = (o) => `<div class="dot"><span data-texte="dotation ${echapper(o.nom)}">${nomDe(o.nom, o.precision)}</span>${note(o) ? `<small>${note(o)}</small>` : ''}</div>`;
      return [places('choix', { 'rangee-1': `<div class="tirage">${sceau(p.bourse.de, 'maitre')}<div class="col">${rubrique({ texte: 'Bourse' })}<span class="somme chiffres">${prix(p.bourse.somme)}</span>${rubrique({ texte: `Statut${separateur('median')}${echapper(p.bourse.statut)}`, note: echapper(p.bourse.formule) })}</div></div>`,
        'rangee-2': `${rubrique({ texte: `Au choix${separateur('median')}${echapper(p.auChoix.niveau)}`, note: 'un seul' })}<div class="trois">${p.auChoix.options.map((o) => optionDe(o)).join('')}</div>`,
        ...Object.fromEntries(p.dotations.map((d, k) => [`rangee-${k + 3}`, `${filet({ fondu: true, losange: true })}${rubrique({ texte: echapper(d.rubrique) })}${defile(d.objets.map(dot).join(''), 'lignes dots', { liste: true })}`])) }),
      'Possessions',
      `${nomDuDetail('Le bagage', `${pluriel(p.bagage.length, 'possession')}${separateur('median')}bourse ${prix(p.bourse.somme)}`)}${filet({ fondu: true, losange: true })}
        <div class="objets">${p.bagage.map(objet).join('')}</div>
        <div class="objet-pris">${cartouche({ icone: p.pris.icone, nom: echapper(p.pris.nom), sous: echapper(p.pris.sous) })}<span class="chiffres">${prix(p.pris.prix)}</span></div>`];
    },
    identite: (p) => {
      const ecrit = (e, tete = rubrique({ texte: echapper(e.nom) })) => `<div class="ligne-ecrite${e.saisi ? ' saisi' : ''}">${tete}<div class="ecrit" data-texte="${echapper(e.nom)}">${echapper(e.texte)}${e.saisi ? '<u></u>' : ''}${picto('plume', 16, undefined, 1.5)}</div></div>`;
      return [places('choix', { 'rangee-1': `${teteDeListe(rubrique({ texte: 'Sexe' }), `<div class="plaques">${p.sexe.valeurs.map((v, k) => plaque(echapper(v), { armee: k === p.sexe.tenue, taille: 'petite' })).join('')}</div>`)}
          ${teteDeListe(rubrique({ texte: 'Nom', note: 'tiré ou écrit' }), plaque('Nom aux dés', { icone: 'de20', taille: 'petite', classe: 'regler' }))}${ecrit({ nom: 'Nom', texte: p.nom }, '')}`,
        'rangee-3': `${filet({ fondu: true, losange: true })}${teteDeListe(rubrique({ texte: 'Physique', note: 'un seul tirage' }), plaque('Physique aux dés', { icone: 'de20', taille: 'petite', classe: 'regler' }))}
        <div class="physique">${p.physique.map((x) => `<div class="mesure">${sceau(x.de, 'moyen')}<div>${rubrique({ texte: echapper(x.nom), note: echapper(x.formule) })}<b>${echapper(x.valeur)}</b></div></div>`).join('')}</div>` }),
      'Identité',
      `${nomDuDetail(p.nom, `${echapper(p.espece)}${separateur('median')}${echapper(p.carriere)}`)}${filet({ fondu: true, losange: true })}
        <div class="faits quatre">${p.physique.map((x) => faitDu({ rubrique: x.nom, valeur: x.valeur })).join('')}</div>
        ${p.ecrits.map(ecrit).join('')}<div class="signature">${SIGNATURE}${sceau(p.marque, 'moyen')}</div>`];
    },
    presentation: (p) => [places('choix', { corps: `<div class="tete">${portrait(p.buste, { taille: 'affiche' })}<div class="q">${nom({ texte: echapper(p.nom), taille: 'grand', cle: 'nom' })}<div class="l">${echapper(p.espece)}</div><div class="l">${echapper(p.carriere)}${separateur('median')}${echapper(p.classe)}</div>
        <div class="faits">${p.physique.map(faitDu).join('')}</div></div></div>
      <div class="bl">${rubrique({ texte: 'Blessures' })}<span class="chiffres">${p.blessures.n} / ${p.blessures.sur}</span></div>${jauge(p.blessures.n / p.blessures.sur, { taille: 'forte' })}
      ${filet({ fondu: true, losange: true })}${reserves(p.reserves.map(jetonDe), 'grand')}${filet({ fondu: true, losange: true })}
      <div class="faits trois">${faitDu({ rubrique: 'Signe astral', valeur: p.signe })}${faitDu({ rubrique: 'Statut', valeur: p.statut })}${faitDu({ rubrique: 'Bourse', valeur: prix(p.bourse) })}</div>`,
      pied: `${rubrique({ texte: 'Motivation' })}<div class="motivation" data-texte="motivation">${echapper(p.motivation)}</div>` }),
    echapper(p.carriere),
    `<div class="profil-c"><div class="fond">${p.profil.map((x) => `<div class="c"><span class="ab">${x.carac}</span><span class="v">${x.valeur}</span></div>`).join('')}</div></div>
      ${rubrique({ texte: 'Compétences' })}<div class="deux competences">${p.competences.map((x) => `<div class="ligne"><span class="n" data-texte="${echapper(x.nom)}">${nomDe(x.nom, x.precision)}</span><span class="val">${x.valeur}</span></div>`).join('')}</div>
      ${rubrique({ texte: 'Talents' })}${pills(p.talents)}`, 'ident'],
  };
  /* la création : la frise, le choix à gauche, le détail au milieu, le héros en création à droite ; le groupe */
  const creation = (c) => {
    const [choix, titre, detail, classe = ''] = ETAPES_DE_CREATION[c.page.etape](c.page);
    return [
      '<div id="mur" class="bois"></div>', friseDesEtapes(c.etapes, c.rang),
      cadre('choix', null, null, null, null, 'parchemin', choix, { classe: `pan ${c.page.etape} ${classe}` }),
      cadre('detail', null, null, null, null, 'parchemin', `<div class="page-c">${detail}</div>`, { ruban: titre, classe: `pan ${c.page.etape}` }),
      herosEnCreation(c.heros), bandeauDu(c.groupe), coins(),
    ];
  };

  /* la tête d'une identité : le portrait, le nom, ce qu'il est */
  const teteDe = (id, nomme, lignes) => `<div class="tete">${portrait(id, { taille: 'affiche' })}<div class="q">${nom({ texte: nomme, taille: 'grand', cle: 'nom' })}${lignes.map((l) => `<div class="l">${l}</div>`).join('')}</div></div>`;
  /* l'identité d'un héros ou d'une possession, chaque bloc à sa place : la tête, ses mesures (une jauge chacune), sous le filet
     les réserves d'un héros (`reserves`, nom au survol) ou les compteurs nommés d'une possession */
  const mesureDeLIdentite = (m) => `<div class="bl">${rubrique({ texte: echapper(m.nom) })}<span class="chiffres">${m.sur === undefined ? m.valeur : `${m.valeur} / ${m.sur}`}</span></div>${jauge(m.valeur / (m.sur ?? 100), { teinte: m.teinte, taille: 'forte' })}`;
  const identiteDe = (id, nom, lignes, mesures, enReserve) => cadre('identite', null, null, null, null, 'parchemin', places('identite', {
    tete: teteDe(id, nom, lignes), mesures: mesures.map(mesureDeLIdentite).join(''),
    reserves: `${filet({ fondu: true, losange: true })}${enReserve}`,
  }), { classe: 'pan ident' });
  /* la figure dans sa niche : celle du héros, ou la silhouette d'une possession */
  const figureDe = (dessin) => cadre('figure', null, null, null, null, 'bois', `<div class="niche laiton"><div>${dessin}</div></div>`, { classe: 'pan figure' });
  /* le profil : douze colonnes fixes, chacune l'abréviation et la valeur ; le nom entier au survol */
  const caseDuProfil = (ab, valeur, nom) => `<div class="c"><span class="ab">${ab}</span><span class="v">${valeur}</span>${nom ? raison(nom, { survolee: false }) : ''}</div>`;
  const bandeDu = (profil, caseDe, titre = 'Caractéristiques') => cadre('bande', null, null, null, null, 'parchemin', profil.map(caseDe).join(''), { ruban: titre, classe: 'bande', piece: 'profil' });

  /* la fiche du héros : l'identité, le profil, la figure, les sections ; les possessions ouvertes, la ligne pressée */
  const mainDu = (libelle, m, prise) => `<div class="main${m ? '' : ' vide'}${prise ? ' refusee' : ''}"><i>${libelle}</i>${m ? `${picto(m.id, 16, undefined, 1.5)}<b data-texte="main ${echapper(m.nom)}">${echapper(m.nom)}</b>` : `<b>${prise ? 'Prise' : 'Vide'}</b>`}</div>`;
  const setDu = (s) => `<div class="set${s.enMain ? ' en-main' : ''}">${mainDu('Main principale', s.principale, false)}${mainDu('Main secondaire', s.secondaire, !!s.deuxMains)}
    <div class="oter">${rond('croix', 'menu', s.refus ? { ferme: true } : { arme: true })}${s.refus && s.survol ? raison(echapper(s.refus)) : ''}</div></div>`;
  const objetDu = (o) => `<div class="ligne${o.pressee ? ' choisie' : ''}">${picto(o.id, 17, undefined, 1.5)}<span class="n" data-texte="${echapper(o.nom)}">${nomDe(o.nom, o.precision)}</span><span class="raison">${o.ou ? echapper(o.ou) : `× ${o.nombre}`}</span></div>`;
  /* les gestes de la ligne ouverte : deux par rang, celui qui va vers quelque chose sur tout le rang */
  const gesteDObjet = (g) => plaque(`${echapper(g.libelle)}${g.refus && g.survol ? raison(echapper(g.refus)) : ''}`, { armee: !!g.principal, fermee: !!g.refus, prix: g.vers ? echapper(g.vers) : null, taille: 'petite', classe: g.vers ? 'large' : '' });
  const ouvertDu = (o) => `<div class="ouvert">${cartouche({ icone: o.icone, nom: echapper(o.nom), sous: echapper(o.sous), texte: 'objet ouvert' })}
    ${o.faits ? `<div class="faits trois">${o.faits.map(faitDu).join('')}</div>` : ''}
    ${o.lier ? `${rubrique({ texte: 'Lier à un sort', note: 'd’Arcane ou de Domaine, connu' })}<div class="deux">${o.lier.map((s) => optionDe({ nom: s.nom, ...(s.choisi ? { choisie: true } : {}) }, `<span class="cout">NI ${s.ni}</span>`)).join('')}</div>` : ''}
    ${o.entrainement ? `${teteDeListe(rubrique({ texte: 'S’entraîner' }), compte(`${px(o.entrainement.px)} à dépenser`, 'or'))}${o.entrainement.paliers.map((x) => `<div class="achat">${x.acquis ? rond('coche', 'menu', { arme: true }) : '<i class="trou"></i>'}<span class="n" data-texte="${echapper(x.texte)}">${echapper(x.texte)}</span>${x.acquis ? `${rubrique({ texte: `${px(x.px)}${separateur('median')}acquis` })}` : plaque('', { prix: px(x.px), taille: 'petite' })}</div>`).join('')}` : ''}
    ${o.faveur ? `<p class="prose nature" data-texte="nature de la Faveur">${echapper(o.faveur.nature)}</p><div class="achat"><span class="n">Activités consécutives à l’interlude</span><span class="val">${o.faveur.solde.n} / ${o.faveur.solde.sur}</span></div>
      ${glose({ texte: `Rompre : ${echapper(o.faveur.rompre)}`, variante: 'avertissement' })}` : ''}
    <div class="gestes-o">${o.gestes.map(gesteDObjet).join('')}</div></div>`;
  const faveurDu = (f) => `<div class="ligne${f.pressee ? ' choisie' : ''}">${sceau('parchemin', 'menu')}<span class="n" data-texte="${echapper(f.creancier)}">${echapper(f.creancier)}</span><span class="raison">${echapper(f.niveau)}${separateur('median')}${f.solde.n} / ${f.solde.sur}</span></div>`;
  /* les sections de la fiche, dans l'ordre de leurs onglets */
  const SECTIONS_DE_LA_FICHE = { attaques: 'Attaques', competences: 'Compétences', talents: 'Talents', sorts: 'Sorts', possessions: 'Possessions' };
  const ficheDuHeros = (f) => {
    const h = f.identite;
    return [
      '<div id="mur" class="bois"></div>',
      identiteDe(h.id, echapper(h.nom), [echapper(h.espece), echapper(h.carriere)], [{ nom: 'Blessures', valeur: h.blessures.n, sur: h.blessures.sur, teinte: 'cire' }], reserves(h.reserves.map(jetonDe), 'grand')),
      bandeDu(f.profil, (x) => caseDuProfil(x.carac, x.valeur)),
      figureDe(figure(1)),
      cadre('sections', null, null, null, null, 'parchemin', `${rubrique({ texte: 'Panoplies', note: 'celle que le héros tient est cernée de laiton' })}
        <div class="sets">${f.sets.map(setDu).join('')}<div class="set neuf">${picto('plus', 18, undefined, 1.8)}</div></div>
        <div class="inventaire"><div class="liste">${rubrique({ texte: 'Porté' })}<div class="lignes">${f.porte.map(objetDu).join('')}</div>
          ${rubrique({ texte: 'En vrac et rangé' })}<div class="lignes">${f.vrac.map(objetDu).join('')}</div>
          ${f.faveurs ? `${rubrique({ texte: 'Faveurs dues' })}<div class="lignes">${f.faveurs.map(faveurDu).join('')}</div>` : ''}</div>${ouvertDu(f.ouvert)}</div>`,
      { tete: onglets(Object.keys(SECTIONS_DE_LA_FICHE).map((s) => f.sections.includes(s) && SECTIONS_DE_LA_FICHE[s]), SECTIONS_DE_LA_FICHE[f.ouverte], 'sections'), classe: 'pan sections' }),
      bandeauDu(f.groupe), croix(), coins(),
    ];
  };

  /* la progression : l'identité qui porte les PX et ce que le niveau exige ; ses gestes, ou le niveau achevé */
  const exigence = (e) => `<div class="exige">${e.fait ? rond('coche', 'menu', { arme: true }) : '<i class="trou"></i>'}<span data-texte="${echapper(e.texte)}">${echapper(e.texte)}</span>${e.compte ? `<span class="cpt chiffres">${e.compte.n} / ${e.compte.sur}</span>` : ''}</div>`;
  const identiteQuiProgresse = (h) => cadre('identite', null, null, null, null, 'parchemin', `${teteDe(h.id, echapper(h.nom), [echapper(h.espece), echapper(h.niveau), `${echapper(h.classe)}${separateur('median')}niveau ${h.rang}`])}
    <div class="bourse-px"><div class="px laiton"><div>${h.px}</div></div><div><b>PX à dépenser</b>${h.apres === undefined ? '' : glose({ texte: `${h.apres} après cet achat` })}</div></div>
    ${filet({ fondu: true, losange: true })}${rubrique({ texte: `Pour achever ${echapper(h.niveau)}` })}<div class="exigences">${h.exigences.map(exigence).join('')}</div>
    ${places('identite', { pied: `<div class="pied">${h.acheve ? `<div class="acheve">${compte('Niveau achevé', 'or')}${glose({ texte: echapper(h.note) })}</div>`
    : `${h.gestes.map((g) => plaque(echapper(g.libelle), { fermee: !!g.refus, prix: g.px ? px(g.px) : null, classe: 'gauche' })).join('')}${glose({ texte: echapper(h.note) })}`}</div>` })}`, { classe: 'pan ident' });
  const caseDeProgression = (x) => `<div class="c${x.carriere ? ' carr' : ''}"><span class="ab">${x.carac}</span><span class="v">${x.valeur}</span><span class="aug">${x.augmentations ? `+${x.augmentations}` : ''}</span>${x.px ? compte(px(x.px), x.carriere ? 'or' : 'fer') : ''}</div>`;
  const competenceAAugmenter = (c) => {
    const tete = `<span class="fait">${c.exigee ? picto('coche', 15, undefined, 2.4) : ''}</span>${car(c.carac)}<span class="n" data-texte="${echapper(c.nom)} ${echapper(c.precision ?? '')}">${nomDe(c.nom, c.precision)}</span>`;
    const achat = `<span class="aug chiffres">+${c.augmentations}</span><span class="val">${c.pressee ? `${c.test} <span>→</span> ${c.test + 1}` : c.test}</span>${plaque('', { prix: px(c.px), armee: !!c.pressee, taille: 'petite' })}`;
    if (c.aDesigner && !c.specialisations) return `<div class="achat creneau">${tete}${glose({ texte: 'À désigner', variante: 'avertissement' })}${picto('chevron_d', 15, undefined, 2)}</div>`;
    return `<div class="achat${c.pressee ? ' vise' : ''}">${tete}${achat}</div>${c.specialisations ? `<div class="depli">${pills(c.specialisations.noms, c.specialisations.retenue)}${plaque('Désigner', { prix: 'sans achat', taille: 'petite' })}</div>` : ''}`;
  };
  const talentAPrendre = (t) => `<div class="talent${t.refus ? ' clos' : ''}">${medaillon(t.icone, { taille: 'moyen', ferme: !!t.refus })}<div class="t">${nom({ texte: echapper(t.nom), cle: echapper(t.nom) })}<i>${echapper(t.sous)}</i></div>${(t.refus ? plaque(echapper(t.refus), { fermee: true, taille: 'petite' }) : plaque('', { prix: px(t.px), taille: 'petite' }))}</div>`;
  const sortAApprendre = (s) => `<div class="achat sort"><span class="n" data-texte="${echapper(s.nom)}">${echapper(s.nom)}</span><span class="cout">NI ${s.ni}</span>${s.composant === undefined ? plaque('', { prix: px(s.px), taille: 'petite' }) : plaque('Composant', { prix: prix(s.composant), taille: 'petite', classe: 'composant' })}</div>`;
  const depense = (d) => [
    '<div id="mur" class="bois"></div>', identiteQuiProgresse(d.identite), bandeDu(d.profil, caseDeProgression),
    cadre('competences', null, null, null, null, 'parchemin', `${teteDeListe(rubrique({ texte: 'De la carrière', note: 'une Augmentation à la fois' }), '<span class="rub colonnes"><span>Test</span><span>Coût</span></span>')}
      ${defile(`${d.competences.map(competenceAAugmenter).join('')}
      <div class="achat hors"><span class="fait">${picto('cadenas', 15, undefined, 1.6)}</span><span class="n">Hors carrière <small>(${pluriel(d.horsCarriere, 'Compétence')})</small></span>${glose({ texte: 'Coût doublé', variante: 'avertissement' })}${picto('chevron_d', 15, undefined, 2)}</div>`, '', { liste: true })}`, { ruban: 'Compétences', classe: 'pan', piece: 'progression-gauche' }),
    cadre('talents', null, null, null, null, 'parchemin', d.talents
      ? `${rubrique({ texte: echapper(d.talents.rubrique), note: echapper(d.talents.note) })}${d.talents.talents.map(talentAPrendre).join('')}`
      : `${d.sorts.listes.map((l) => `${rubrique({ texte: echapper(l.rubrique), note: echapper(l.note) })}${l.sorts.map(sortAApprendre).join('')}`).join('')}<div class="pied-de-bourse">${bourse({ heros: echapper(d.sorts.bourse.heros), avoir: prix(d.sorts.bourse.avoir) })}</div>`,
    { tete: onglets(['Talents', 'Sorts'], d.ouvert, 'progression-droite'), classe: 'pan', piece: 'progression-droite' }),
    bandeauDu(d.groupe), croix(), coins(),
  ];
  /* le changement de carrière : le chemin et ses stations, la page du niveau visé, une autre carrière */
  const station = (s) => `<div class="station ${s.etat}"><div class="pt">${s.etat === 'faite' ? rond('coche', 'petit', { arme: true }) : s.etat === 'visee' ? medaillon('etoile', { taille: 'petit', vise: true }) : '<i class="clou-fer"></i>'}${s.px ? compte(px(s.px), 'or') : ''}</div>
    <div class="et">${nom({ texte: echapper(s.nom), cle: `station ${echapper(s.nom)}` })}<i data-secondaire>Niveau ${s.niveau}${separateur('median')}${echapper(s.statut)}${s.tenu ? `${separateur('median')}tenu${s.acheve ? ', achevé' : ''}` : ''}</i></div>${s.refus && s.survol ? raison(echapper(s.refus)) : ''}</div>`;
  const changement = (c) => [
    '<div id="mur" class="bois"></div>', identiteQuiProgresse(c.identite),
    cadre('chemin', null, null, null, null, 'parchemin', `<div class="suite"><i class="rail"></i><i class="rail fait"></i>${c.chemin.stations.map(station).join('')}</div>`, { ruban: `${echapper(c.chemin.carriere)}${separateur('median')}${echapper(c.chemin.classe)}`, classe: 'chemin', piece: 'profil' }),
    cadre('vise', null, null, null, null, 'parchemin', `<div class="page-c">${nomDuDetail(c.vise.nom, `${echapper(c.vise.carriere)}${separateur('median')}niveau ${c.vise.niveau}${separateur('median')}Statut ${echapper(c.vise.statut)}`)}${filet({ fondu: true, losange: true })}
      <div class="ouvre">${c.vise.ouvre.map((o) => `${rubrique({ texte: echapper(o.rubrique) })}${pills(o.noms)}`).join('')}</div>
      ${glose({ texte: echapper(c.vise.note), cle: 'note du niveau' })}${plaque(echapper(c.vise.geste), { armee: true, prix: px(c.vise.px), classe: 'devenir' })}</div>`, { ruban: echapper(c.vise.ruban), classe: 'pan', piece: 'progression-gauche' }),
    cadre('autre', null, null, null, null, 'parchemin', `<div class="plaques">${c.autre.arrivee ? c.autre.arrivee.valeurs.map((v, k) => plaque(echapper(v), { armee: k === c.autre.arrivee.tenue, taille: 'petite' })).join('') : ''}</div><div class="deux">
      <div>${rubrique({ texte: 'Classe' })}<div class="lignes">${c.autre.classes.map((x) => `<div class="ligne${x.choisie ? ' choisie' : x.fermee ? ' refusee' : ''}">${picto(x.id, 17, undefined, 1.5)}<span class="n" data-texte="${echapper(x.nom)}">${echapper(x.nom)}</span><span class="cout">${px(x.px)}</span></div>`).join('')}</div></div>
      <div>${rubrique({ texte: 'Carrière', note: c.autre.arrivee ? '' : 'au premier niveau' })}<div class="lignes">${c.autre.carrieres.map((o) => optionDe(o)).join('')}</div></div></div>
      ${glose({ texte: echapper(c.autre.note) })}`, { ruban: 'Autre carrière', classe: 'pan', piece: 'progression-droite' }),
    bandeauDu(c.groupe), croix(), coins(),
  ];
  /* le rail du chemin, d'une station à l'autre, doré jusqu'au niveau tenu */
  const tracerLeChemin = () => {
    const suite = document.querySelector('#chemin .suite'), stations = [...suite.querySelectorAll('.station')];
    const centre = (e) => e.offsetLeft + e.offsetWidth / 2, debut = centre(stations[0]);
    const poser = (rail, fin) => Object.assign(rail.style, { left: `${debut}px`, width: `${fin - debut}px` });
    poser(suite.querySelector('.rail:not(.fait)'), centre(stations.at(-1)));
    poser(suite.querySelector('.rail.fait'), centre(stations.filter((s) => s.classList.contains('faite')).at(-1)));
  };
  /* le héros, au gabarit de la fiche : sa création, sa fiche, ses dépenses, son changement de carrière */
  const HEROS_EN_FICHE = (e) => ('etapes' in e ? [creation, tracerLaFrise] : 'sets' in e ? [ficheDuHeros] : 'competences' in e ? [depense] : [changement, tracerLeChemin]);

  /* ───────── les gabarits : leurs feuilles, leurs scripts, leur pose ───────── */
  /* la cour du combat, ou la mer du combat naval (`voyage/navale.js`) */
  const NAVALE = etat.cour && 'navires' in etat.cour;
  const COUR = NAVALE
    ? { feuilles: ['combat/combat.css', 'combat-suite/suite.css', 'voyage/navale.css'], scripts: ['combat/jet.js', 'combat/socle.js', 'voyage/navale.js'], tracer: (e) => merDuCombat(e.cour) }
    : { feuilles: ['combat/combat.css', 'combat-suite/suite.css'], scripts: ['combat/jet.js', 'combat/socle.js', 'combat/cour.js'] };
  const GABARITS = {
    /* 6. Fenêtre du bas, posée sur le combat ou, hors combat, seule sur la cour */
    'fenetre-du-bas': { ...COUR, poser: (e) => [SYSTEME, ...(e.combat ? combat(e.combat) : []), fenetre(e.fenetre)] },
    /* 5. Combat : le tour de l'actif */
    combat: { ...COUR, poser: tourDeCombat },
    /* 7. Issue d'un combat : la bannière, l'action unique dessous, le système */
    recit: { ...COUR, poser: (e) => [SYSTEME, issue(echapper(e.titre), { suite: e.suite ? echapper(e.suite) : '', action: e.butin ? '' : echapper(e.action) }), ...(e.butin ? [butin(e.butin, e.action)] : [])] },
  };
  /* 3. Fiche : le dossier d'une possession sur la mer, ou le héros sur le mur */
  GABARITS.fiche = 'possession' in etat
    ? { feuilles: ['lieux-et-nuit/commun.css', 'combat/combat.css', 'voyage/navale.css', 'heros/heros.css'], scripts: ['lieux-et-nuit/bustes.js', 'lieux-et-nuit/commun.js', 'combat/jet.js', 'combat/socle.js', 'voyage/voyage.js', 'voyage/navale.js'], poser: dossier, tracer: peindreLeDossier }
    : { feuilles: ['lieux-et-nuit/commun.css', 'combat/jet.css', 'heros/heros.css'], scripts: ['lieux-et-nuit/bustes.js', 'lieux-et-nuit/commun.js', 'combat/jet.js', 'heros/heros.js'], poser: (e) => HEROS_EN_FICHE(e)[0](e), tracer: (e) => HEROS_EN_FICHE(e)[1]?.() };
  /* 4. Lieu et voyage : un décor par lieu, ses feuilles et ses scripts */
  const LIEU = { feuilles: ['lieux-et-nuit/commun.css'], scripts: ['lieux-et-nuit/bustes.js', 'lieux-et-nuit/commun.js'] };
  const ROUTE = { feuilles: [...LIEU.feuilles, 'voyage/voyage.css', 'combat/jet.css', 'combat-suite/suite.css'], scripts: [...LIEU.scripts, 'voyage/voyage.js', 'combat/jet.js', 'combat-suite/decors.js'] };
  const VOYAGE = { ...ROUTE, scripts: [...LIEU.scripts, 'voyage/voyage.js', 'combat/jet.js'], poser: voyage, tracer: peindreLeVoyage };
  const NUIT = { feuilles: [...LIEU.feuilles, 'lieux-et-nuit/nuit.css'], poser: nuit };
  const EXPLORER = { feuilles: [...LIEU.feuilles, 'combat/jet.css', 'exploration-et-recit/recit.css'], scripts: [...LIEU.scripts, 'combat/jet.js', 'exploration-et-recit/scene.js'], poser: exploration, tracer: peindreLExploration };
  const COMMERCE = { feuilles: [...LIEU.feuilles, 'combat/jet.css', 'commerce/commerce.css'], scripts: [...LIEU.scripts, 'combat/jet.js', 'lieux-et-nuit/soins.js', 'commerce/commerce.js'], poser: commerce, tracer: peindreLeCommerce };
  const DECORS = {
    auberge: { ...NUIT, scripts: [...LIEU.scripts, 'lieux-et-nuit/auberge.js'] },
    taverne: { ...NUIT, scripts: [...LIEU.scripts, 'lieux-et-nuit/taverne.js'] },
    bivouac: { ...NUIT, scripts: [...LIEU.scripts, 'lieux-et-nuit/bivouac.js'] },
    cabinet: { feuilles: [...LIEU.feuilles, 'lieux-et-nuit/soins.css'], scripts: [...LIEU.scripts, 'lieux-et-nuit/soins.js', 'lieux-et-nuit/cabinet.js'], poser: soins },
    halle: COMMERCE,
    quai: COMMERCE,
    relais: { ...COMMERCE, feuilles: [...COMMERCE.feuilles, 'voyage/voyage.css'], scripts: [...COMMERCE.scripts, 'voyage/voyage.js'] },
    route: VOYAGE,
    fleuve: VOYAGE,
    traversee: VOYAGE,
    bord: { ...VOYAGE, poser: leBord, tracer: peindreLeBord },
    mer: { ...ROUTE, poser: poursuite },
    foret: { ...ROUTE, poser: poursuite },
    champ: { ...ROUTE, poser: bataille },
    ville: { feuilles: [...LIEU.feuilles, 'lieux-et-nuit/interlude.css'], scripts: [...LIEU.scripts, 'lieux-et-nuit/carte-de-la-ville.js'], poser: interlude, tracer: tracerLaVille },
    /* la salle porte l'exploration, ou les soins entre héros */
    salle: { ...EXPLORER, feuilles: [...EXPLORER.feuilles, 'lieux-et-nuit/soins.css'], scripts: [...EXPLORER.scripts, 'lieux-et-nuit/soins.js'], poser: (e) => ('actes' in e ? soins : exploration)(e) },
    'grand-route': EXPLORER,
    reikland: { feuilles: [...LIEU.feuilles, 'combat/jet.css', 'exploration-et-recit/carte.css'], scripts: [...LIEU.scripts, 'combat/jet.js', 'exploration-et-recit/carte.js'], poser: carteDuMonde, tracer: tracerLeReikland },
  };
  GABARITS['lieu-et-voyage'] = DECORS[etat.decor];
  /* le jeu en cours, flouté et assombri sous l'écran posé dessus (`accueil-et-systeme/systeme.css`) */
  const JEU = { feuilles: [...LIEU.feuilles, 'accueil-et-systeme/systeme.css'], scripts: [...LIEU.scripts, 'accueil-et-systeme/systeme.js'] };
  if (etat.decor === 'jeu') ecran.dataset.fond = 'jeu';
  /* 1. Ouverture : l'écran titre sur le couchant, le menu de la partie sur le jeu, le chapitre sur son décor */
  const OUVERTURE = { feuilles: [...LIEU.feuilles, 'accueil-et-systeme/systeme.css', 'accueil-et-systeme/ouverture.css'], scripts: [...LIEU.scripts, 'accueil-et-systeme/systeme.js'] };
  const CHAPITRE = { ...OUVERTURE, feuilles: [...OUVERTURE.feuilles, 'accueil-et-systeme/seance.css'], scripts: [...OUVERTURE.scripts, 'accueil-et-systeme/seance.js', 'accueil-et-systeme/chapitre.js'], poser: chapitre };
  GABARITS.ouverture = {
    couchant: { ...OUVERTURE, scripts: [...OUVERTURE.scripts, 'accueil-et-systeme/accueil.js'], poser: accueil },
    jeu: { ...OUVERTURE, poser: menuDeLaPartie, tracer: () => assombrirLeJeu({ gauche: true }) },
    relais: { ...CHAPITRE, tracer: () => peindreLOuverture() },
    altdorf: { ...CHAPITRE, tracer: () => peindreLaCloture() },
  }[etat.decor];
  /* 2. Gestion : sur la table, les options, les sauvegardes ou la coop ; le carnet posé sur la salle ; la
     nouvelle partie dans la salle commune ; la fin de séance sur le jeu */
  const OUTILS = { feuilles: ['accueil-et-systeme/options.css', 'outils/outils.css'], scripts: ['outils/outils.js'] };
  const SUR_LA_TABLE = 'domaines' in etat ? { feuilles: ['accueil-et-systeme/options.css'], scripts: [], poser: ecranDesOptions }
    : 'sieges' in etat ? { ...OUTILS, poser: coop }
        : { feuilles: ['accueil-et-systeme/sauvegardes.css'], scripts: [], poser: sauvegardes };
  const GESTIONS = {
    table: { feuilles: [...LIEU.feuilles, 'accueil-et-systeme/systeme.css', ...SUR_LA_TABLE.feuilles], scripts: [...LIEU.scripts, 'accueil-et-systeme/systeme.js', ...SUR_LA_TABLE.scripts], poser: SUR_LA_TABLE.poser },
    salle: { feuilles: [...LIEU.feuilles, 'exploration-et-recit/recit.css'], scripts: [...LIEU.scripts, 'exploration-et-recit/scene.js'], poser: carnet, tracer: () => sceneAuberge({ sombre: 0.62 }) },
    compagnie: { feuilles: [...LIEU.feuilles, 'accueil-et-systeme/nouvelle-partie.css'], scripts: [...LIEU.scripts, 'accueil-et-systeme/nouvelle-partie.js'], poser: nouvellePartie,
      tracer: (n) => peindreLaSalleCommune(n.salle.voyageurs.map((v, k) => [placesDesVoyageurs(n.salle.voyageurs.length)[k][0], v.id, !!v.vise])) },
    jeu: { ...JEU, feuilles: [...JEU.feuilles, 'accueil-et-systeme/seance.css'], scripts: [...JEU.scripts, 'accueil-et-systeme/seance.js'], poser: finDeSeance, tracer: () => assombrirLeJeu({ voile: 0.38 }) },
  };
  GABARITS.gestion = GESTIONS[etat.decor];
  /* 9. Consultation : le Compendium, sur la table */
  GABARITS.consultation = { feuilles: [...LIEU.feuilles, 'accueil-et-systeme/systeme.css', 'outils/outils.css'], scripts: [...LIEU.scripts, 'accueil-et-systeme/systeme.js', 'outils/outils.js'], poser: compendium };
  /* 8. Outil d'édition : la scène vue de dessus ou la carte du monde, sur la table */
  GABARITS.edition = { feuilles: [...LIEU.feuilles, 'accueil-et-systeme/systeme.css', 'outils/outils.css'], scripts: [...LIEU.scripts, 'accueil-et-systeme/systeme.js', 'outils/outils.js', 'outils/editeur.js'],
    poser: 'lieux' in etat ? editeurDeLaCarte : editeurDeScene };

  const charger = (src) => new Promise((ok, ko) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => ko(new Error(`script ${src}`)); document.body.append(s); });
  const lier = (href) => new Promise((ok, ko) => { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; l.onload = ok; l.onerror = () => ko(new Error(`feuille ${href}`)); document.head.append(l); });

  (async () => {
    const g = GABARITS[etat.gabarit];
    if (!g) throw new Error(`gabarit ${etat.gabarit} : aucune pose`);
    /* la cour, à l'état qu'elle dessine (`combat/cour.js`) et avec les marques de la suite du combat */
    if (etat.cour && !NAVALE) Object.assign(ecran.dataset, { etat: etat.cour.etat, marques: (etat.cour.marques ?? []).join(' ') });
    await Promise.all(g.feuilles.map(lier));
    await lier('rendu.css');
    for (const s of g.scripts) await charger(s);
    if (etat.cour?.videe) document.querySelector('#scene rect[fill="#06040a"]')?.remove();
    monter(g.poser(etat));
    poserLesCadres();
    poserLesPlaces();
    g.tracer?.(etat);
    if (etat.pose?.role === 'fiche') FIGURES[qui(etat.pose.fiche.qui).buste](document.getElementById('figure-lue'));
    await document.fonts.ready;
    /* le nom du cartouche tient sur sa ligne dans le rect du cartouche : sa police se réduit, jamais sa largeur ne croît */
    document.querySelectorAll('#titre .n').forEach((n) => { for (let t = parseFloat(getComputedStyle(n).fontSize); n.scrollWidth > n.clientWidth && t > 20; t -= 1) n.style.fontSize = `${t - 1}px`; });
    globalThis.RAPPORT_DU_RENDU = {};
  })().catch((e) => { globalThis.RAPPORT_DU_RENDU = { erreur: String(e) }; throw e; });
}
