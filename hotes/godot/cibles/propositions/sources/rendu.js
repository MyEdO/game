/* La page de rendu des maquettes (#4411) : une maquette (`maquettes/maquette.ts`), posée sur `globalThis.MAQUETTE` par
   `rendre.mjs` avec les dessins des registres et les couleurs du thème de Godot, dessinée avec les pièces du kit
   (`gestes.js`). La vue suit celle de Godot (`projet/project.godot`, `canvas_items`, `expand`) : `echelle = min(L / 1280,
   H / 720)`, chaque bloc ancré dans la vue logique (`../dispositions.md`). Un bloc est la jumelle d'une zone de Godot
   (`projet/scripts/zone.gd`) : sa source, ses `ids` (un id fini par `/` nomme sa famille ; sans `ids`, ce qu'aucun
   bloc de sa source ne nomme), ses formes (`<type>[.<ton>]:<forme>`, la forme au ton prime), chacune une pièce du kit.
   Chaque élément qu'aucun bloc ne dessine est dit au rapport (`globalThis.RAPPORT_DU_RENDU`). Maquette hors du jeu. */
{
  const { maquette, dessins } = globalThis.MAQUETTE;
  const VUE = { largeur: 1280, hauteur: 720 };
  const echelle = Math.min(innerWidth / VUE.largeur, innerHeight / VUE.hauteur);
  const ecran = document.getElementById('ecran');
  Object.assign(ecran.style, { width: `${innerWidth / echelle}px`, height: `${innerHeight / echelle}px`, transform: `scale(${echelle})`, transformOrigin: '0 0' });
  Object.assign(PICTOS, dessins.icone);
  /* le buste qui dessine le combattant `id` (`Decor.bustes`), ou son id s'il est déjà celui d'un buste */
  const buste = (id) => maquette.decor?.bustes[id] ?? id;

  /* ───────── les blocs ───────── */
  /* les éléments vus, puis ceux qu'un bloc prend, par chemin : une entité que deux blocs posent (le domaine et son
     signet) se vérifie sur l'union de ce qu'ils prennent */
  const vus = new Set();
  const pris = new Set();
  const nomme = (ids, id) => ids.some((i) => i === id || (i.endsWith('/') && id.startsWith(i)));
  const formeDe = (b, e) => {
    for (const prefixe of [`${e.type}.${e.ton ?? ''}:`, `${e.type}:`]) {
      const f = (b.formes ?? []).find((x) => x.startsWith(prefixe));
      if (f) return f.slice(prefixe.length);
    }
    return e.type;
  };
  const elementsDe = (blocs, b, sources) => {
    const elements = sources[b.source] ?? [];
    if (b.ids) return elements.filter((e) => nomme(b.ids, e.id));
    const nommes = blocs.filter((a) => a.source === b.source).flatMap((a) => a.ids ?? []);
    return elements.filter((e) => !nomme(nommes, e.id));
  };
  /* Les blocs `blocs` posés sur `sources` : par nom de bloc, le HTML de chacun de ses éléments. Les éléments de
     `verifiees` sont vus sous `chemin` ; ceux qu'aucun bloc ne prend vont au rapport. */
  const poser = (blocs, sources, chemin, verifiees) => {
    const liste = Object.values(blocs);
    for (const source of verifiees) for (const e of sources[source] ?? []) vus.add(`${chemin}${source}:${e.id}`);
    return Object.fromEntries(Object.entries(blocs).map(([nom, b]) => [nom, elementsDe(liste, b, sources).map((e) => {
      pris.add(`${chemin}${b.source}:${e.id}`);
      const forme = FORMES[formeDe(b, e)];
      if (!forme) throw new Error(`${chemin}${b.source}:${e.id} : aucune pièce « ${formeDe(b, e)} »`);
      return forme(e, (imbriques) => poser(imbriques, e, `${chemin}${b.source}:${e.id}/`, ['elements']));
    }).join('')]));
  };

  /* ───────── les pièces, par forme ───────── */
  const echapper = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const iconeDe = (e) => e.elements.find((x) => x.type === 'icone')?.icone;
  const presse = (c) => c.valeurs.find((v) => v.presse)?.libelle;
  const lecture = (r) => `<span class="lecture gothique">${echapper(r.texte)}</span>`;
  const camp = (e, sous, miroir) => {
    const { modificateurs } = sous({ modificateurs: { source: 'modificateurs', formes: ['puce:modificateur'] } });
    const d = Number(e.resultat);
    const faces = e.resultat === null ? ['', ''] : [String(d % 100 - d % 10), String(d % 10)];
    const etat = e.resultat === null ? 'vide' : e.ton === 'reussite' ? 'reussite' : '';
    return `<div class="camp ${miroir ? 'droite' : ''}">${e.combattant ? portrait(buste(e.combattant), { camp: miroir ? 'ennemi' : 'heros', taille: 'grand' }) : ''}
      <div><div class="n gothique" data-texte="${echapper(e.id)}">${echapper(e.qui)}${modificateurs}</div><div class="c rubrique">${echapper(e.libelle)}</div>
      <div class="des"><span class="seuil">${echapper(e.cible)}</span>${faces.map(d10).join('')}${sceau(echapper(e.resultat), 'grand', { etat })}${e.resultat === null ? ''
        : `<div class="issue ${etat}"><b>${echapper(e.verdict)}</b><span>${echapper(e.dr)}</span></div>`}</div></div></div>`;
  };
  const choixEnPlaques = (c) => (c.valeurs.length === 1 ? `<b>${echapper(c.valeurs[0].libelle)}</b>`
    : c.valeurs.map((v) => plaque(echapper(v.libelle), { armee: v.presse, fermee: !!v.refus, taille: 'petite' })).join(''));
  /* la valeur `/true` ou `/false` d'un réglage qui s'allume ou s'éteint */
  const allumable = (c) => c.valeurs.every((v) => /\/(true|false)$/.test(v.id));
  const regleEnOptions = (c, valeurs) => `<div class="regle"><span class="l rubrique" data-texte="${echapper(c.id)}">${echapper(c.libelle)}</span>${options(valeurs.map((v) => [echapper(v.libelle), { armee: v.presse, fermee: !!v.refus }]))}</div>`;
  /* la zone que la valeur pressée de la localisation nomme (`…/"tete"`), aucune au hasard (`…/null`) */
  const zoneChoisie = (c) => {
    const v = c.valeurs.find((x) => x.presse);
    const zone = v && JSON.parse(v.id.slice(v.id.lastIndexOf('/') + 1));
    return zone ? { [zone]: 'choisie' } : {};
  };
  /* un rang de l'ordre du tour : son portrait, son nom, sa jauge de Blessures ; un ennemi est au ton `echec` */
  const rangDeLOrdre = (e, sous, { classe = '', taille = 'moyen', gothique = false, choisi = false, corps = true } = {}) => {
    sous({ portrait: { source: 'elements', ids: ['portrait'], formes: ['portrait:surLeRang'] }, blessures: { source: 'elements', ids: ['blessures'], formes: ['jauge:surLeRang'] }, fiche: { source: 'elements', ids: ['fiche/'], formes: ['bouton:surLeRang'] } });
    const p = e.elements.find((x) => x.type === 'portrait');
    const j = e.elements.find((x) => x.type === 'jauge');
    return rang(buste(p.combattant), {
      camp: e.ton === 'echec' ? 'ennemi' : 'heros', nom: echapper(e.nom), classe, taille, gothique, choisi,
      corps: corps && j ? `<div class="ligne">${vie(j.courant, j.max)}<span class="pv ombre">${echapper(j.texte)}</span></div>` : '',
    });
  };
  const reglage = (c, controle) => `<div class="pref"><div class="l"><b data-texte="${echapper(c.id)}">${echapper(c.libelle)}</b>${controle}</div></div>`;
  const regleDuCurseur = (c, largeur) => reglette((c.valeur - c.min) / (c.max - c.min), largeur);
  const FORMES = {
    ligne: (e) => `<p class="ligne ${e.ton}" data-texte="${echapper(e.id)}">${echapper(e.texte)}</p>`,
    rubrique: (e) => `<span class="rubrique" data-texte="${echapper(e.id)}">${echapper(e.texte)}</span>`,
    ruban: (e) => ruban(echapper(e.texte), { gothique: true }),
    medaillon: (e) => medaillon(e.icone, { inerte: true }),
    nomDuTitre: (e) => `<div class="n gothique" data-texte="titre">${echapper(e.texte)}</div>`,
    mention: (e) => `<span class="mention rubrique">${echapper(e.texte)}</span>`,
    picto: (e) => `<span class="mention picto">${picto(e.icone, 13)}</span>`,
    drNet: (e) => `<div class="dr gothique" data-texte="${echapper(e.id)}">${echapper(e.texte)}</div>`,
    issue: (e) => `<p data-texte="${echapper(e.id)}">${echapper(e.texte)}</p>`,
    recit: (e) => `<p class="ombre" data-texte="${echapper(e.id)}">${echapper(e.texte)}</p>`,
    rubriqueDuRecit: (e) => `<div class="r rubrique ombre" data-texte="${echapper(e.id)}">${echapper(e.texte)}</div>`,
    aide: (e) => `<p class="aide" data-texte="${echapper(e.id)}">${echapper(e.texte)}</p>`,
    lecture,
    lectureFermee: (e) => `<span class="lecture ferme gothique">${echapper(e.texte)}</span>`,
    chiffre: (e) => `<em class="chiffres">${echapper(e.texte)}</em>`,
    rangee: (e) => `<div class="rang-c">${e.icone ? sceau(e.icone) : ''}<span class="v" data-texte="${echapper(e.id)}">${echapper(e.texte)}</span></div>`,
    puceEnRangee: (e) => `<div class="rang-c"><span class="lab rubrique">${echapper(e.libelle)}</span><span class="v">${echapper(e.valeur)}</span></div>`,
    puceEnJeu: (e) => `<div class="jouera">${echapper(e.libelle)}<span class="rubrique">${echapper(e.valeur)}</span></div>`,
    modificateur: (e) => `<span class="modif rubrique">${echapper(e.libelle)} ${echapper(e.valeur)}</span>`,
    disque: (e) => `<div class="res${e.valeur === '0' ? ' vide' : ''}">${disque(echapper(e.valeur), { taille: 'petit', vide: e.valeur === '0' })}<span class="rubrique">${echapper(e.libelle)}</span></div>`,
    jetDuCamp: (e, sous) => camp(e, sous, false),
    jetDuCampEnMiroir: (e, sous) => camp(e, sous, true),
    plaque: (e) => plaque(echapper(e.libelle), { armee: e.focus, fermee: !!e.refus, icone: e.icone ?? null }),
    plaqueArmee: (e) => plaque(echapper(e.libelle), { armee: true, fermee: !!e.refus, icone: e.icone ?? null }),
    plaqueAppel: (e) => plaque(echapper(e.libelle), { armee: e.focus, fermee: !!e.refus, icone: e.icone ?? null, taille: 'appel' }),
    defaut: (e) => `<span class="defaut rubrique">${picto(e.icone, 12)}${echapper(e.libelle)}</span>`,
    croix: (e) => `<div class="croix" data-piece="fermer">${rond(e.icone)}</div>`,
    surLeRang: () => '',
    pastille: (e) => rond(iconeDe(e), 'grand'),
    cire: () => '<i class="cire"></i>',
    icone: (e) => picto(e.icone, 18),
    segments: (c) => segments(c.valeurs.map((v) => echapper(v.libelle)), echapper(presse(c)), { egaux: c.valeurs.length === 2 }),
    pasAPas: (c) => `<span class="pas-a-pas">${picto('gauche', 15, undefined, 2)}<b class="rubrique">${echapper(presse(c))}</b>${picto('droite', 15, undefined, 2)}</span>`,
    regletteLue: (c) => regleDuCurseur(c, 118),
    reglageEnSegments: (c) => reglage(c, FORMES.segments(c)),
    reglageEnPourcent: (c) => reglage(c, `<span class="curseur">${regleDuCurseur(c, 104)}<span class="val gothique">${c.valeur} %</span></span>`),
    choixDuHeros: (c) => `<div class="choix-h"><span class="rubrique">${echapper(c.libelle)}</span>${choixEnPlaques(c)}</div>`,
    portrait: (e) => portrait(buste(e.combattant), { taille: 'grand' }),
    puceEnMention: (e) => `<span class="rubrique">${echapper(e.libelle)} ${echapper(e.valeur)}</span>`,
    silhouette: (c) => silhouette(92, zoneChoisie(c)),
    choixLu: (c) => regleEnOptions(c, c.valeurs.filter((v) => v.presse)),
    choixEnLigne: (c) => (allumable(c) ? bascule(echapper(c.libelle), c.valeurs.some((v) => v.presse && v.id.endsWith('/true'))) : regleEnOptions(c, c.valeurs)),
    borneDuRound: (e) => `<div class="n gothique" data-texte="${echapper(e.id)}">${echapper(e.texte)}</div>`,
    rangPasse: (e, sous) => rangDeLOrdre(e, sous, { classe: 'fantome', taille: 'petit', corps: false }),
    rang: (e, sous) => rangDeLOrdre(e, sous),
    rangDeLActif: (e, sous) => rangDeLOrdre(e, sous, { classe: 'actif', taille: 'grand', gothique: true, choisi: true }),
    borneDeLOrdre: (e) => `<div class="borne"><span class="rubrique ombre" data-texte="${echapper(e.id)}">${echapper(e.texte)}</span><i></i></div>`,
    systeme: (e) => `<div id="systeme" data-piece="systeme">${rond(iconeDe(e))}</div>`,
    teteDuJournal: (e) => `<div class="tete rubrique ombre">${echapper(e.nom)} ${rond(iconeDe(e), 'petit')}</div>`,
    ligneDuJournal: (e) => `<p class="ombre ${e.ton}">${echapper(e.texte)}</p>`,
    finDuTour: (c) => {
      const [fin] = c.valeurs;
      return `<div id="fin" class="${fin.refus ? 'ferme' : ''}" data-piece="fin">${rond(fin.icone, 'maitre', { ferme: !!fin.refus })}<span class="rubrique ombre">${echapper(fin.libelle)}</span></div>`;
    },
    /* un geste du menu de la partie, que le menu fermé ne montre pas */
    dansLeMenu: () => '',
    issueDuCombat: (e) => `<div class="toile-ombre"><div class="toile"><span class="gothique" data-texte="issue">${echapper(e.texte)}</span></div></div>`,
    jauge: (e) => jauge(e.courant / e.max),
    signet: (e, sous) => {
      const b = sous({ cire: { source: 'elements', ids: ['cire'], formes: ['icone:cire'] }, nombre: { source: 'elements', ids: ['nombre'], formes: ['ligne:chiffre'] } });
      return `<div class="signet${e === premier(e) ? ' ouvert' : ''}"><span class="rubrique" data-texte="${echapper(e.id)}">${echapper(e.nom)}</span>${b.cire}${b.nombre}</div>`;
    },
    domaine: (e, sous) => `<div class="domaine${e === premier(e) ? ' ouvert' : ''}">${sous({ feuillets: { source: 'elements', ids: ['feuillet/'], formes: ['entite:feuillet'] } }).feuillets}</div>`,
    feuillet: (e, sous) => {
      const b = sous({
        compte: { source: 'elements', ids: ['compte'], formes: ['ligne:rubrique'] }, gauche: { source: 'elements', ids: ['gauche/'], formes: ['entite:regle'] },
        folio: { source: 'elements', ids: ['folio'], formes: ['ligne:rubrique'] }, modifiees: { source: 'elements', ids: ['modifiees'], formes: ['ligne:rubrique'] },
        suite: { source: 'elements', ids: ['suite'], formes: ['ligne:rubrique'] }, plage: { source: 'elements', ids: ['plage'], formes: ['ligne:rubrique'] },
        droite: { source: 'elements', ids: ['droite/'], formes: ['entite:regle'] },
      });
      return `<div class="feuillet${e.id.endsWith('/1') ? ' ouvert' : ''}">
        <div class="feuille g parchemin"><div class="tete"><span class="dom gothique" data-texte="domaine">${echapper(e.nom)}</span>${b.compte}</div>${filet({ losange: true })}${b.gauche}
          <div class="pied">${b.folio}<span class="marque">${b.modifiees}</span></div></div>
        <div class="feuille d parchemin"><div class="tete">${b.suite}${b.plage}</div>${b.droite ? filet({ losange: true }) : ''}${b.droite}</div></div>`;
    },
    regle: (e, sous) => {
      const b = sous({
        ref: { source: 'elements', ids: ['ref'], formes: ['ligne:rubrique'] }, retablir: { source: 'elements', ids: ['retablir/'], formes: ['bouton:defaut'] },
        controle: { source: 'elements', ids: ['regle/'], formes: ['choix:segments', 'liste:pasAPas', 'curseur:regletteLue'] },
        valeur: { source: 'elements', ids: ['valeur'], formes: ['ligne.ferme:lectureFermee', 'ligne:lecture'] },
        aide: { source: 'elements', ids: ['aide'], formes: ['ligne:aide'] }, action: { source: 'elements', ids: ['action/'], formes: ['bouton:plaqueArmee'] },
      });
      return `<div class="regle${e.ton === 'alerte' ? ' modifiee' : ''}"><div class="t"><b data-texte="${echapper(e.id)}">${echapper(e.nom)}</b><span class="ref">${b.ref}</span></div>
        <div class="c">${b.retablir}${b.controle}${b.valeur}</div>${b.aide}${b.action ? `<div class="action">${b.action}</div>` : ''}</div>`;
    },
    heros: (e, sous) => {
      const b = sous({
        portrait: { source: 'elements', ids: ['portrait'] }, carriere: { source: 'elements', ids: ['carriere'], formes: ['ligne:rubrique'] },
        blessures: { source: 'elements', ids: ['blessures'] }, fiche: { source: 'elements', ids: ['fiche/'], formes: ['bouton:surLeRang'] },
        choix: { source: 'elements', formes: ['choix:choixDuHeros'] },
      });
      const blessures = e.elements.find((x) => x.id === 'blessures');
      return `<div class="heros">${b.portrait}${b.fiche}<div class="qui"><div class="nom gothique" data-texte="${echapper(e.id)}">${echapper(e.nom)}</div>
        <div class="l2"><span class="car">${b.carriere}</span>${blessures ? `<span class="pv chiffres">${echapper(blessures.texte)}</span>` : ''}</div>${b.blessures}${b.choix}</div></div>`;
    },
    paysage: (e) => `<svg class="calque paysage" viewBox="0 0 ${dessins.cadreDesPaysages.largeur} ${dessins.cadreDesPaysages.hauteur}" preserveAspectRatio="xMidYMid slice">${e.paysage.map((c) => dessins.paysage[c]).join('')}</svg>`,
  };
  /* le premier domaine des règles, ouvert comme l'onglet courant d'un `TabContainer` neuf */
  const premier = (e) => (zones()['reglages.regles'] ?? []).find((x) => x.type === e.type) ?? e;

  /* ───────── les gabarits : leurs blocs, puis leur pose ───────── */
  /* les gestes que la pastille du menu de la partie ouvre (`MenuDeLaPartie.tscn`), qu'aucune disposition ne pose */
  const GESTES_DU_MENU = {
    groupe: { source: 'groupe.gestes', formes: ['bouton:dansLeMenu'] },
    partie: { source: 'partie.gestes', formes: ['bouton:dansLeMenu'] },
  };
  const GABARITS = {
    'fenetre-du-bas': {
      feuilles: ['combat/jet.css'], scripts: ['combat/jet.js'],
      blocs: {
        titre: { source: 'fenetre.titre', formes: ['ligne:ruban'] },
        etape: { source: 'fenetre.etape', formes: ['ligne:rubrique'] },
        camp: { source: 'fenetre.corps', ids: ['jet', 'defense/jet', 'jets/0/1'], formes: ['jet:jetDuCamp'] },
        arme: { source: 'fenetre.corps', ids: ['arme'], formes: ['ligne:rubrique'] },
        cible: { source: 'fenetre.corps', ids: ['cible', 'sansEquipe'], formes: ['ligne:rubrique'] },
        qui: { source: 'fenetre.corps', ids: ['defense/qui'], formes: ['ligne:rubrique'] },
        degats: { source: 'fenetre.corps', ids: ['degats', 'tirDansLeTas', 'tirImmobile'], formes: ['puce:puceEnMention'] },
        drNet: { source: 'fenetre.corps', ids: ['drNet', 'jets/0/drNet'], formes: ['ligne:drNet'] },
        issue: { source: 'fenetre.corps', formes: ['ligne:issue'] },
        miroir: { source: 'fenetre.corps', ids: ['defense', 'jets/0/0'], formes: ['jet:jetDuCampEnMiroir'] },
        localisation: { source: 'fenetre.reglages', ids: ['jetRegler@attaque#localisation'], formes: ['choix:silhouette'] },
        localisationLue: { source: 'fenetre.reglages', ids: ['jetRegler@attaque#localisation'], formes: ['choix:choixLu'] },
        reglages: { source: 'fenetre.reglages', formes: ['choix:choixEnLigne'] },
        reserves: { source: 'fenetre.reserves', formes: ['puce:disque'] },
        gestes: { source: 'fenetre.gestes', formes: ['bouton:plaque'] },
      },
      poser: (b) => {
        const regle = b.localisation || b.localisationLue || b.reglages;
        return [cadre('jet', null, null, null, null, 'parchemin', `${b.camp}
        <div id="verdict" class="${regle ? 'reglages' : ''}"><div class="sous">${[b.etape, b.arme, b.cible, b.qui, b.degats].filter(Boolean).join('<i class="point"></i>')}</div>${b.drNet}${b.issue}${regle
          ? `<div class="rangee">${b.localisation}<div class="choix">${b.localisationLue}${b.reglages}</div></div>` : ''}</div>${b.miroir}
        <div id="suites">${b.reserves ? `<div class="en-reserve">${b.reserves}</div>` : ''}${b.gestes}</div>`, { tete: b.titre + clouer() })];
      },
    },
    /* 5. Combat, sans la barre de l'actif : la borne du round, l'ordre du tour (`Ecran.tscn` : `suite/`, `round`,
       `ordre/`), le journal, le système et la fin du tour */
    combat: {
      feuilles: ['combat/combat.css'], scripts: ['combat/jet.js', 'combat/socle.js'],
      blocs: {
        tour: { source: 'combat.tour', formes: ['ligne:borneDuRound'] },
        suite: { source: 'combat.ordre', ids: ['suite/'], formes: ['entite:rangPasse'] },
        round: { source: 'combat.ordre', ids: ['round'], formes: ['ligne:borneDeLOrdre'] },
        restants: { source: 'combat.ordre', ids: ['ordre/'], formes: ['entite:rang', 'entite.alerte:rangDeLActif'] },
        menu: { source: 'partie.menu', formes: ['entite:systeme'] },
        journal: { source: 'journal.titre', formes: ['entite:teteDuJournal'] },
        lignes: { source: 'journal.lignes', formes: ['ligne:ligneDuJournal'] },
        fin: { source: 'combat.offres', ids: ['economie/aucun'], formes: ['choix:finDuTour'] },
        ...GESTES_DU_MENU,
      },
      poser: (b) => [b.menu,
        cadre('round', null, null, null, null, 'bois', b.tour),
        `<div id="ordre" data-piece="ordre">${b.suite}${b.round}${b.restants}</div>`,
        `<div id="journal" data-piece="journal">${b.journal}<div class="lignes">${b.lignes}</div></div>`,
        b.fin],
    },
    /* 7. Issue d'un combat : le titre en toile, l'action unique dessous, le système */
    recit: {
      feuilles: ['combat/combat.css'], scripts: [],
      blocs: {
        titre: { source: 'fenetre.titre', formes: ['ligne:issueDuCombat'] },
        gestes: { source: 'fenetre.gestes', formes: ['bouton:plaqueAppel'] },
        menu: { source: 'partie.menu', formes: ['entite:systeme'] },
        ...GESTES_DU_MENU,
      },
      poser: (b) => [b.menu, `<div id="issue" data-piece="issue">${b.titre}${b.gestes}</div>`],
    },
    gestion: {
      feuilles: ['lieux-et-nuit/commun.css', 'accueil-et-systeme/systeme.css', 'accueil-et-systeme/options.css'], scripts: ['lieux-et-nuit/bustes.js', 'lieux-et-nuit/commun.js', 'accueil-et-systeme/systeme.js'],
      blocs: {
        medaillon: { source: 'reglages.titre', ids: ['nom'], formes: ['ligne:medaillon'] },
        nom: { source: 'reglages.titre', ids: ['nom'], formes: ['ligne:nomDuTitre'] },
        sous: { source: 'reglages.titre', ids: ['sous'], formes: ['ligne:rubrique'] },
        sons: { source: 'reglages.preferences', ids: ['preference/son-coupe', 'preference/volume-musique', 'preference/volume-ambiance', 'preference/volume-effets', 'preference/volume-interface'], formes: ['choix:reglageEnSegments', 'curseur:reglageEnPourcent'] },
        jeu: { source: 'reglages.preferences', formes: ['choix:reglageEnSegments', 'liste:reglageEnSegments', 'curseur:reglageEnPourcent', 'ligne:aide'] },
        avis: { source: 'reglages.avis', formes: ['ligne:aide'] },
        domaines: { source: 'reglages.regles', formes: ['entite:domaine'] },
        signets: { source: 'reglages.regles', formes: ['entite:signet'] },
        croix: { source: 'reglages.gestes', formes: ['bouton:croix'] },
      },
      poser: (b) => [fondDeTable(),
        cadre('titre', null, null, null, null, 'bois', `${b.medaillon}<div>${b.nom}<div class="s">${b.sous}</div></div>`),
        cadre('preferences', null, null, null, null, 'bois', `${b.sons}<div class="trait"></div>${b.jeu}${b.avis}`),
        `<div id="signets" data-piece="signets">${b.signets}</div>`,
        `<div id="registre" data-piece="registre"><div class="tranche"></div>${b.domaines}${CLOUS}</div>`,
        b.croix],
    },
    'lieu-et-voyage': {
      feuilles: ['lieux-et-nuit/commun.css'], scripts: ['lieux-et-nuit/bustes.js', 'lieux-et-nuit/commun.js'],
      blocs: {
        decor: { source: 'fenetre.corps', ids: ['scene/paysage'] },
        medaillon: { source: 'fenetre.titre', formes: ['ligne:medaillon'] },
        titre: { source: 'fenetre.titre', formes: ['ligne:nomDuTitre'] },
        temps: { source: 'fenetre.corps', ids: ['scene/date', 'scene/meteo', 'scene/moment'], formes: ['ligne:mention', 'icone:picto'] },
        lieu: { source: 'fenetre.corps', ids: ['repos/lieu'], formes: ['ligne:rubriqueDuRecit'] },
        recit: { source: 'fenetre.corps', ids: ['repos/description'], formes: ['ligne:recit'] },
        activite: { source: 'fenetre.corps', formes: ['puce:puceEnRangee', 'ligne:rangee', 'entite:enJeu'] },
        action: { source: 'fenetre.gestes', formes: ['bouton:plaqueAppel'] },
        groupe: { source: 'groupe.heros', formes: ['entite:heros'] },
        journal: { source: 'journal.titre', formes: ['entite:pastille'] },
        menu: { source: 'partie.menu', formes: ['entite:pastille'] },
      },
      poser: (b) => [b.decor,
        cadre('titre', null, null, null, null, 'bois', `${b.medaillon}<div>${b.titre}<div class="s">${b.temps}</div></div>`),
        `<div id="recit" data-piece="recit">${b.lieu}${b.recit}</div>`,
        cadre('activite', null, null, null, null, 'bois', `${b.activite}${b.action}`),
        cadre('bandeau', null, null, null, null, 'bois', b.groupe, { classe: `b${zones()['groupe.heros'].length}`, tete: clouer(zones()['groupe.heros'].length) }),
        `<div id="coins" data-piece="coins">${b.journal}${b.menu}</div>`],
    },
  };
  FORMES.enJeu = (e, sous) => `<div class="en-jeu"><div class="t rubrique">${echapper(e.nom)}</div>${sous({ puces: { source: 'elements', formes: ['puce:puceEnJeu'] } }).puces}</div>`;

  /* les zones de la maquette, sous les réponses de sa méthode */
  const zones = () => maquette.reponses.reglages?.zones ?? { ...maquette.reponses.demarrer.vue.zones, ...maquette.reponses.demarrer.zones };
  const charger = (src) => new Promise((ok, ko) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => ko(new Error(`script ${src}`)); document.body.append(s); });
  const lier = (href) => new Promise((ok, ko) => { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; l.onload = ok; l.onerror = () => ko(new Error(`feuille ${href}`)); document.head.append(l); });
  /* le décor `cour` : la cour du combat à l'état que nomme sa variante (`combat/cour.js`) */
  const DECORS = { cour: { feuilles: [], scripts: ['combat/jet.js', 'combat/socle.js', 'combat/cour.js'] } };

  (async () => {
    const gabarits = maquette.gabarits.map((g) => {
      if (!GABARITS[g]) throw new Error(`gabarit ${g} : aucune pose`);
      return GABARITS[g];
    });
    const decor = maquette.decor && DECORS[maquette.decor.scene];
    if (maquette.decor) ecran.dataset.etat = maquette.decor.variante;
    const scripts = [...new Set([...(decor?.scripts ?? []), ...gabarits.flatMap((g) => g.scripts)])];
    await Promise.all([...new Set([...(decor?.feuilles ?? []), ...gabarits.flatMap((g) => g.feuilles)])].map(lier));
    await lier('rendu.css');
    for (const s of scripts) await charger(s);
    const sources = zones();
    const blocs = Object.fromEntries(maquette.gabarits.flatMap((g) => Object.entries(GABARITS[g].blocs).map(([nom, b]) => [`${g}|${nom}`, b])));
    const html = poser(blocs, sources, '', Object.keys(sources));
    const duGabarit = (g) => Object.fromEntries(Object.keys(GABARITS[g].blocs).map((nom) => [nom, html[`${g}|${nom}`]]));
    monter(maquette.gabarits.flatMap((g) => GABARITS[g].poser(duGabarit(g))));
    await document.fonts.ready;
    globalThis.RAPPORT_DU_RENDU = { nonDessines: [...vus].filter((v) => !pris.has(v)) };
  })().catch((e) => { globalThis.RAPPORT_DU_RENDU = { erreur: String(e) }; throw e; });
}
