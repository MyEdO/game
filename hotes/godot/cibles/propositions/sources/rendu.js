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
  Object.assign(ecran.style, { width: `${innerWidth / echelle}px`, height: `${innerHeight / echelle}px`, transform: `scale(${echelle})`, transformOrigin: '0 0' });

  /* ───────── les mots et les valeurs ───────── */
  const echapper = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  /* un nombre signé, le moins typographique */
  const signe = (n) => (n < 0 ? `−${-n}` : `+${n}`);
  /* un d100 sur deux chiffres, `00` pour cent */
  const d100 = (n) => String(n % 100).padStart(2, '0');
  const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;
  const modif = (t) => `<span class="modif rubrique">${t}</span>`;

  /* ───────── le combat ───────── */
  const qui = (id) => etat.combattants[id];
  const portraitDe = (id, taille = 'grand') => portrait(qui(id).buste, { camp: qui(id).ennemi ? 'ennemi' : 'heros', taille });
  const libelleDuModificateur = (m) => ('de' in m ? `${m.nom} : ${m.de} → ${d100(m.vers)}` : 'rang' in m ? `${m.nom} ${m.rang} sur ${m.sur}` : m.valeur === undefined ? m.nom : `${m.nom} ${signe(m.valeur)}`);
  const porte = ({ arme, cible }) => `${echapper(arme)} · Cible : ${echapper(qui(cible).nom)}`;
  const regle = (libelle, corps) => `<div class="regle"><span class="l rubrique">${echapper(libelle)}</span>${corps}</div>`;
  const optionsDu = (r) => options(r.valeurs.map((v, k) => [echapper(v), { armee: k === r.tenue }]));

  /* le camp d'un testeur, à gauche ou en miroir à droite : son Test et son seuil, ses dés posés ou tombés */
  const testeur = (t, cote = '') => {
    const des = t.jet?.des ?? t.des;
    const faces = des ? des.map(String) : ['', ''];
    return camp({
      cote, portrait: portraitDe(t.qui), nom: echapper(qui(t.qui).nom), carac: echapper(t.test), seuil: t.seuil,
      des: cote ? faces.reverse() : faces, regles: !!t.jet?.reglable,
      total: t.jet ? d100(t.jet.des[0] + t.jet.des[1]) : null, dr: t.jet ? signe(t.jet.dr) : null,
      modif: t.modificateurs?.map(libelleDuModificateur).join(' · ') || null,
      reussite: !!t.jet?.reussite, ...(t.jet?.critique ? { verdict: 'critique' } : {}),
    });
  };
  /* le héros qui choisit sans dé : ce qui le met en jeu, son prix */
  const MISES = {
    reserve: (m) => `${pluriel(m.valeur, 'Point')} de ${echapper(m.reserve)}`,
    test: (m) => `${echapper(m.test)} ≤ ${m.seuil}`,
    critiqueSur: (m) => `Critique sur ${echapper(qui(m.critiqueSur).nom)}`,
    arme: (m) => echapper(m.arme),
    engagement: ({ engagement: g }) => `Engagée · Avantage ${g.avantage} · ${echapper(qui(g.contre).nom)} ${g.adverse}`,
    menace: (m) => echapper(m.menace),
    corruption: ({ corruption: c }) => `Points de Corruption ${c.points} / ${c.seuil}`,
    decidePour: (m) => `décide pour ${echapper(m.decidePour)}`,
  };
  /* ce qui menace le héros se lit en rouge */
  const MENACES = ['menace', 'corruption'];
  const sansDe = (h) => {
    const mise = Object.keys(MISES).find((k) => k in h.mise);
    return `<div class="camp${MENACES.includes(mise) ? ' touche lanceur' : ''}">${portraitDe(h.qui)}<div><div class="n gothique">${echapper(qui(h.qui).nom)}${h.marque ? ` ${modif(echapper(h.marque))}` : ''}</div><div class="c rubrique">${MISES[mise](h.mise)}</div>${h.cout ? modif(echapper(h.cout)) : ''}</div></div>`;
  };
  /* celui qui subit la table qu'un jet impose : ses dés, la table tirée, ce qui l'y mène */
  const issueQuiMene = (i) => ('critique' in i ? ['Critique : ' + i.critique, 'du jet d’Incantation'] : 'unites' in i ? [`${i.unites} aux unités`, 'du jet d’Incantation'] : ['Tableau', `des ${echapper(i.tableau)}`]);
  const subit = (s) => {
    const [b, span] = issueQuiMene(s.issue);
    const motif = typeof s.motif === 'string' ? echapper(s.motif) : `Échec sur un double : ${s.motif.double}`;
    return `<div class="camp touche lanceur">${portraitDe(s.qui)}<div><div class="n gothique">${echapper(qui(s.qui).nom)}</div><div class="c rubrique">${motif}</div>
      <div class="des">${s.des.map((d) => d10(String(d))).join('')}${s.tire === undefined ? '' : sceau(s.tire, 'grand')}<div class="issue"><b>${b}</b>${b === 'Tableau' ? `<b>${span}</b>` : `<span>${span}</span>`}</div></div></div></div>`;
  };
  /* celle qu'une Influence corruptrice expose : ses Points de Corruption sur son seuil */
  const expose = (e) => `<div class="camp expose">${portraitDe(e.qui)}<div><div class="n gothique">${echapper(qui(e.qui).nom)}</div><div class="c rubrique">${echapper(e.exposition)}</div>
    <div class="points"><div class="l rubrique"><span>Points de Corruption</span><b>${e.corruption.points} / ${e.corruption.seuil}</b></div>${rangDePas(e.corruption.points, e.corruption.seuil, 'petit cire')}</div></div></div>`;
  const HEROS = { testeur: (h) => testeur(h), heros: sansDe, subit, expose };
  /* à droite : l'autre camp, ce que le jet vise, ce qu'un Critique touche */
  const AUTRES = {
    testeur: (a) => testeur(a, 'droite'),
    vise: (v) => vise(qui(v.qui).buste, echapper(qui(v.qui).nom), echapper(v.comme), `${qui(v.qui).blessures} / ${qui(v.qui).max}`),
    touche: (t) => `<div class="camp droite touche">${portraitDe(t.qui)}${silhouette(100, { [t.zone]: 'touchee' })}
      <div><div class="n gothique">${echapper(qui(t.qui).nom)}</div><div class="c rubrique">${echapper(t.atteinte)}</div>
      <div class="des">${sceau(t.blessures, 'grand')}<div class="issue"><b>Blessures</b><b>perdues</b></div></div></div></div>`,
  };

  /* une carte de choix : son nom ou le combattant qu'elle nomme, son détail ligne à ligne (une ligne en liste), sa marque */
  const ligneDeCarte = (l) => (typeof l === 'string' ? echapper(l)
    : 'contre' in l ? `${echapper(l.test)} ≤ ${l.seuil} contre ≤ ${l.contre}`
      : 'seuil' in l ? `${echapper(l.test)} · ≤ ${l.seuil}`
        : 'ni' in l ? `Niveau d’incantation ${l.ni}`
          : 'aCumuler' in l ? `Test étendu : ${l.aCumuler} DR à cumuler`
            : `${echapper(qui(l.qui).nom)} à ${l.distance} m · portée ${l.portee} m`);
  const carteDe = (c) => {
    const lignes = c.detail.map(ligneDeCarte);
    const marque = c.marque && modif(c.marque.valeur === undefined ? echapper(c.marque.nom) : `${c.marque.valeur < 0 ? signe(c.marque.valeur) : c.marque.valeur} ${echapper(c.marque.nom)}`);
    /* la marque suit la dernière ligne quand elle y tient, sinon passe dessous */
    const derniere = lignes.length ? lignes.pop() : '';
    const sous = [...lignes, marque ? (`${derniere}${c.marque.nom}`.length > 24 ? `${derniere} <br>${marque}` : `${derniere} ${marque}`) : derniere].join('<span class="sep"> · </span><br>');
    return carte(echapper(c.nom ?? qui(c.qui).nom), `${sous}${c.refus && c.survol ? raison(echapper(c.refus)) : ''}`, { armee: !!c.choisie, fermee: !!c.refus, classe: c.funeste ? 'funeste' : '', portrait: c.qui ? portrait(qui(c.qui).buste, { camp: qui(c.qui).ennemi ? 'ennemi' : 'heros' }) : '' });
  };
  const cartesDu = (g) => (g.cartes.length === 1 ? carteDe(g.cartes[0]) : `<div class="cartes">${g.cartes.map(carteDe).join('')}</div>`);
  const enjeuDu = (e) => `<div class="enjeu"><div class="l rubrique">${echapper(e.libelle)}</div><table>${e.issues.map((i, k) => `<tr${k === e.tombee ? ' class="tombee"' : ''}><td>${echapper(i.issue)}</td><td>${echapper(i.effet)}</td></tr>`).join('')}</table></div>`;
  const etenduDu = (c) => `<div id="verdict" class="sort etendu"><div class="sous rubrique">Test étendu · Niveau d’incantation ${c.ni}</div><div class="dr gothique">${echapper(c.sort)}</div>
    <div class="cumul">${rangDePas(c.cumul, c.ni, 'petit')}<b class="rubrique" data-texte="cumul">${c.cumul} DR sur ${c.ni}</b></div><p data-texte="phrase d'issue">${echapper(c.phrase)}</p></div>`;
  const tableDu = (c) => (c.tire === undefined
    ? `<div id="critique"><div class="dr gothique">${echapper(c.nom)}</div><p data-texte="texte de la table">${echapper(c.texte)}</p></div>`
    : `<div id="critique"><div class="tete-c"><div class="dr gothique">${echapper(c.nom)}</div><div class="tirage">${c.tire === null ? sceau('', 'moyen', { etat: 'vide' }) : sceau(c.tire, 'moyen')}<span class="rubrique">${echapper(c.table)}<br>${c.tire === null ? 'à tirer' : 'tirée'} au d100</span></div></div>
      <p data-texte="texte de la table">${echapper(c.texte)}</p></div>`);
  const localisationDe = (c) => {
    const l = c.localisation;
    const bascules = c.bascules.map((b) => bascule(echapper(b.libelle), b.allumee)).join('');
    if (l.zone) return `<div id="verdict" class="reglages"><div class="rangee">${silhouette(102, { [l.zone.id]: 'choisie' })}
      <div class="choix"><div class="sous rubrique">${porte(c.porte)}</div><div class="l rubrique">${echapper(l.libelle)}</div>
      <div class="v"><span class="gothique">${echapper(l.zone.nom)}</span>${l.malus === null ? '' : modif(`${signe(l.malus)} au Test`)}</div>
      ${l.hasard ? `<div class="bas">${options([['Au hasard']])}${bascules}</div>` : ''}</div></div></div>`;
    return reglages(porte(c.porte), `<div class="rangee">${silhouette(92)}<div class="choix">
      ${c.reglages.map((r) => regle(r.libelle, optionsDu(r))).join('')}${regle(l.libelle, options([['Au hasard', { armee: true }]]))}
      <div class="bascules">${bascules}</div>${c.note ? `<p data-texte="note">${echapper(c.note)}</p>` : ''}</div></div>`, 'haut');
  };
  /* le centre de la fenêtre, et ce qu'il demande à sa mise en page (`combat/combat.css`, `combat-suite/suite.css`) */
  const CENTRES = {
    verdict: (c) => ['', verdict(c.relance === undefined ? porte(c.porte) : `${echapper(c.porte.arme)} · ${echapper(qui(c.porte.cible).nom)} · <span class="relance">relancé, <s>${d100(c.relance)}</s></span>`, `DR net ${signe(c.drNet)}`, echapper(c.issue))],
    attaque: (c) => [c.localisation.zone ? 'avant' : 'avant armes', localisationDe(c)],
    defense: (c) => ['avant defense', reglages(porte(c.porte), `<div class="reactions">${c.reactions.map((r, k) => carte(echapper(r.nom), `≤ ${r.seuil}`, { armee: k === c.tenue, classe: 'courte' })).join('')}</div>
      ${c.sociale ? regle('À la place de Corps à corps', modif(echapper(c.sociale))) : c.reglages.map((r) => regle(r.libelle, optionsDu(r))).join('')}`, 'haut')],
    choix: (c, f) => {
      const annonce = !c.annonce ? '' : 'round' in c.annonce
        ? `<div class="annonce"><div class="dr gothique">Round ${c.annonce.round}</div><div class="sous rubrique">${echapper(c.annonce.sous)}</div></div>`
        : `<div class="annonce"><div class="dr gothique">${echapper(c.annonce.sort)}</div><div class="sous rubrique">${echapper(qui(c.annonce.lanceur).nom)} · Cible : ${echapper(qui(c.annonce.cible).nom)}</div></div>`;
      const groupes = c.groupes.length === 1 && !c.groupes[0].libelle ? cartesDu(c.groupes[0])
        : c.groupes.map((g) => `<div class="groupe"><div class="t rubrique">${echapper(g.libelle)}</div>${cartesDu(g)}</div>`).join('');
      const classe = ['debut', f.autre ? 'destin' : '', c.groupes.length > 1 ? 'deux' : '', f.heros?.role === 'testeur' ? 'effet-critique' : c.groupes[0].cartes.length === 3 && f.heros ? 'trois' : ''].filter(Boolean).join(' ');
      return [classe, `${annonce}${groupes}`];
    },
    consigne: (c) => ['consigne', `<p class="consigne" data-texte="consigne">${echapper(c.consigne)}</p>`],
    critique: (c, f) => [f.autre ? 'critique duel' : 'critique', `<div id="critique"><div class="dr gothique">${echapper(c.nom)}</div><p data-texte="texte du critique">${echapper(c.effet)}</p></div>`],
    table: (c) => ['critique', tableDu(c)],
    sort: (c) => ['seul', `<div id="verdict" class="sort"><div class="sous rubrique">Sort · Niveau d’incantation ${c.ni}</div><div class="dr gothique">${echapper(c.sort)}</div><p>${echapper(c.issue)}</p></div>`],
    surincantation: (c) => {
      const axe = (a) => ('sansObjet' in a ? `<div class="axe ferme"><span class="rubrique">${echapper(a.nom)}</span><em>sans objet</em></div>`
        : `<div class="axe"><span class="rubrique">${echapper(a.nom)}</span>${rangDePas(a.alloues, a.sur, 'petit')}<b>${'cibles' in a.effet ? pluriel(a.effet.cibles, 'cible') : `×${a.effet.facteur}`}</b>${moinsPlus({ moins: a.alloues > 0, plus: a.alloues < a.sur })}</div>`);
      return ['sur', `<div id="verdict" class="surinc">
        <div class="sort"><div class="sous rubrique">Sort · Niveau d’incantation ${c.ni}</div><div class="dr gothique">${echapper(c.sort)}</div>
          <p data-texte="consigne">Cibles supplémentaires : ${c.supplementaires.choisies} / ${c.supplementaires.sur}, à cliquer sur la carte.</p></div>
        <div class="axes"><div class="t"><span class="rubrique">Surincantation</span><b class="gothique" data-texte="pas">${c.pas.alloues} pas sur ${c.pas.sur}</b></div>${c.axes.map(axe).join('')}</div>
      </div>
      <div class="cibles-du-sort">${c.cibles.map((x) => `<div class="c-s">${portraitDe(x.qui, 'petit')}<div><div class="n gothique">${echapper(qui(x.qui).nom)}</div><div class="c rubrique">${echapper(x.comme)}</div></div></div>`).join('')}</div>`];
    },
    etendu: (c) => [c.enjeu ? 'focal' : 'seul', `${etenduDu(c)}${c.enjeu ? enjeuDu(c.enjeu) : ''}`],
    nature: (c) => ['corruption', `<div class="nature"><div class="l rubrique">${echapper(c.libelle)}</div><div class="deux">${c.cartes.map(carteDe).join('')}</div></div>${enjeuDu(c.enjeu)}`],
    consequence: (c) => ['', verdict(`${echapper(c.arme)} · ${echapper(c.coup)}`, `${c.etats.nombre} États ${echapper(c.etats.etat)}`, echapper(c.issue))],
    tests: (c) => {
      const nom = (l) => `${echapper(qui(l.qui).nom)}${l.poste ? `, ${echapper(l.poste)}` : ''} · ${echapper(l.test)} ≤ ${l.seuil}${l.de === undefined ? '' : ` · dé ${l.de}`}`;
      const issue = (l) => (l.dr !== undefined
        ? `${l.de !== undefined && l.dr < 0 ? 'échec · ' : ''}${signe(l.dr)} DR${l.double ? `, compte double : ${signe(2 * l.dr)}` : ''}`
        : [l.attente && echapper(l.attente), l.double && 'compte double', l.bonus && `Mouvement ${l.bonus.mouvement} : ${signe(l.bonus.dr)} DR`].filter(Boolean).join(' · '));
      const somme = c.lignes.reduce((t, l) => t + (l.dr ?? 0) * (l.double ? 2 : 1), 0);
      return ['tests', `<div id="verdict" class="tests"><div class="tete"><span class="dr gothique">${echapper(c.nom)}</span><span class="sous rubrique">${echapper(c.test)}</span></div>
        <table>${c.lignes.map((l) => `<tr${l.courant ? ' class="courant"' : ''}><td>${nom(l)}</td><td>${issue(l)}</td></tr>`).join('')}
        ${c.regle ? `<tr><td>${echapper(c.regle.texte)}</td><td>${echapper(c.regle.effet)}</td></tr>` : ''}${c.somme ? `<tr class="somme"><td>Somme</td><td>${signe(somme)} DR</td></tr>` : ''}</table></div>`];
    },
    corruption: (c) => ['corruption tombe', `${verdict(`${echapper(c.influence)} · Points de Corruption ${c.corruption.points} / ${c.corruption.seuil}`, c.gain ? `+${pluriel(c.gain, 'Point')}` : 'Aucun Point', echapper(c.issue))}${enjeuDu(c.enjeu)}`],
  };
  /* les gestes : la réserve dépensée à gauche, la plaque principale en premier, la raison d'un refus au survol */
  const gestesDe = (f) => `${f.reserves.length ? reserves(f.reserves.map((r) => [r.valeur, r.porteur ? `${echapper(r.nom)} de ${echapper(qui(r.porteur).nom)}` : echapper(r.nom)])) : ''}${f.gestes.map((g) => plaque(`${echapper(g.libelle)}${g.refus && g.survol ? raison(echapper(g.refus)) : ''}`, { armee: !!g.principal, fermee: !!g.refus, classe: g.libelle.length > 12 ? 'large' : '' })).join('')}`;
  const fenetre = (f) => {
    const [classe, centre] = CENTRES[f.centre.role](f.centre, f);
    return bandeauDuJet(echapper(f.titre), classe, `${f.heros ? HEROS[f.heros.role](f.heros) : ''}${centre}${f.autre ? AUTRES[f.autre.role](f.autre) : ''}`, gestesDe(f));
  };

  /* 5. Combat : la borne du round, l'ordre du tour (l'actif en bas, le round suivant au-delà de sa borne), le journal,
     le système, la fin du tour, fermée tant qu'une fenêtre tient la main */
  const PICTO_DE_L_ETAT = { aTerre: 'aTerre', hemorragique: 'goutte' };
  const etatPorte = (e) => `<div class="etat-porte${e.presse ? ' presse' : ''}">${sceau(PICTO_DE_L_ETAT[e.etat], 'menu')}<span class="rubrique">${echapper(e.nom)}</span>${e.n > 1 ? `<b>${e.n}</b>` : ''}</div>`;
  const rangDe = (id, classe) => { const c = qui(id); return combattant(c.buste, c.ennemi ? 'ennemi' : 'heros', echapper(c.nom), c.blessures, c.max, classe, classe.includes('fantome') ? '' : c.etats.map(etatPorte).join('')); };
  const entree = (e, k, toutes) => (typeof e === 'string' ? (k === toutes.length - 1 ? neuf : vieux)(echapper(e)) : borneJ(e.commence ? `Le combat commence ! (Round ${e.round})` : `Round ${e.round}`));
  /* `fin` : la fin du tour se presse ; `lu` : le combattant dont la fiche est lue ; `journal` : le journal entier est ouvert */
  const combat = (c, { fin = false, lu = null, journal = false } = {}) => [
    `<div id="round" class="cadre bois" data-piece="round"><div class="fond bois"><div class="n gothique">Round ${c.round}</div><div class="t rubrique">${c.tour ? `tour ${c.tour.rang}<br>sur ${c.tour.sur}` : 'le round<br>débute'}</div></div>${ferrures}</div>`,
    `<div id="ordre" data-piece="ordre">${[...c.ordre.map((id, k) => rangDe(id, k === 0 && c.tour ? 'actif' : id === lu ? 'lu' : '')), borne(c.round + 1), ...c.suivant.map((id, k) => rangDe(id, k ? 'fantome loin' : 'fantome'))].reverse().join('')}</div>`,
    `<div id="journal" data-piece="journal"><div class="tete rubrique ombre">Journal ${rond('journal', 'petit', { arme: journal })}</div>${c.journal.map(entree).join('')}</div>`,
    `<div id="fin" class="${fin ? '' : 'ferme'}" data-piece="fin">${rond('fin', 'maitre', { ferme: !fin })}<span class="rubrique ombre">Fin du tour</span></div>`,
  ];

  /* 5. Combat, le tour : la barre de l'actif (valeurs à gauche, portrait au centre, actions à droite, rangées par
     familles en onglets au-dessus de leur rangée), ce qui s'y pose, les offres du champ */
  const PICTO_DE_L_ACTION = {
    attaque: 'attaque', course: 'botte', defensive: 'defensive', incantation: 'sort', focalisation: 'focaliser', avantage: 'competence',
    'usage-objet': 'objet', depot: 'poser', panoplie: 'armes', munition: 'munition', 'abandon-poste': 'sortie',
    'mise-en-selle': 'monter', 'service-poste': 'servir', poussee: 'pousser', 'annulation-deplacement': 'annuler', pause: 'pause',
  };
  const refusDe = (a) => (a.refus && a.survol ? raison(echapper(a.refus)) : '');
  const fermeeDe = (a, adverse) => adverse || !!a.fermee || !!a.refus;
  const FAMILLES = {
    action: (f, b) => `<div class="plaques">${f.actions.map((a) => plaque(`${echapper(a.libelle)}${refusDe(a)}`, { icone: PICTO_DE_L_ACTION[a.id], armee: !!a.armee, fermee: fermeeDe(a, b.adverse) })).join('')}</div>`,
    situation: (f, b) => `<div class="plaques situation">${f.actions.map((a) => plaque(`${echapper(a.libelle)}${refusDe(a)}`, { taille: 'petite', armee: !!a.armee, fermee: fermeeDe(a, b.adverse) })).join('')}</div>`,
    gestes: (f, b) => `<div class="pastilles">${f.actions.map((a) => outil(PICTO_DE_L_ACTION[a.id], echapper(a.libelle), { ouvert: !!a.ouverte, ferme: fermeeDe(a, b.adverse) })).join('')}</div>`,
    rapides: (f) => `<div class="rapides">${f.sorts.map((n, k) => `<div class="case-r">${plaque('', { icone: n ? 'sort' : null, numero: k + 1, armee: k === f.arme, fermee: !n })}<span class="rubrique">${n ? echapper(n) : 'Libre'}</span></div>`).join('')}</div>`,
  };
  const valeursDe = (b) => {
    const c = qui(b.qui);
    if (b.adverse) return mesure('Blessures', `${c.blessures} / ${c.max}`);
    return `${mesure('Blessures', `${c.blessures} / ${c.max}`)}
      <div class="mesure"><div class="tete rubrique"><span>Mouvement</span><b>${b.mouvement.reste} / ${b.mouvement.sur}</b></div>${rangDePas(b.mouvement.reste, b.mouvement.sur)}</div>
      <div class="jeton">${sceau('epee')}<div class="v"><span class="rubrique">Action</span> <em>${b.action ? 'disponible' : 'dépensée'}</em></div></div>
      <div class="jeton"><div class="chiffre">${b.avantage}</div><div class="v"><span class="rubrique">Avantage</span></div></div>
      <div class="tiers">${b.determination === undefined ? '' : `<div class="jeton">${rond(b.determination, 'petit')}<div class="v"><span class="rubrique">Détermination</span></div></div>`}
      <div class="portes"><span class="rubrique">États</span>${c.etats.map(etatPorte).join('') || '<em>aucun</em>'}</div></div>`;
  };
  const barre = (b) => {
    const c = qui(b.qui), ouverte = b.familles.find((f) => f.id === b.ouverte);
    return [
      cadre('barre', null, null, null, null, '', `<div id="etat">${valeursDe(b)}</div><div id="gestes" class="${ouverte.id}">${FAMILLES[ouverte.id](ouverte, b)}</div>`, {
        classe: b.adverse ? 'adverse' : '',
        tete: `${onglets(b.familles.map((f) => echapper(f.nom)), echapper(ouverte.nom))}<div id="tour-outils">${b.outils.map((a) => rond(PICTO_DE_L_ACTION[a.id], 'petit', { ferme: fermeeDe(a, b.adverse) })).join('')}</div>${clouer()}`,
      }),
      `<div id="actif-portrait">${portrait(c.buste, { camp: c.ennemi ? 'ennemi' : 'heros', taille: 'maitre' })}</div>`,
      `<div id="actif-nom"><div class="n gothique" data-texte="nom de l'actif">${echapper(c.nom)}</div><div class="a rubrique">${echapper(b.arme)}</div></div>`,
    ];
  };
  const ficheDuSort = (s, sous, vers) => apercu({ nom: echapper(s.nom), sous, vers, corps: `
    <div class="titre rubrique">Sort · coûte ${echapper(s.cout)}</div>
    <table><tr><td>Niveau d’incantation</td><td>${s.ni}</td></tr><tr><td>Portée</td><td>${echapper(s.portee)}</td></tr><tr><td>Cible</td><td>${s.cibles}</td></tr><tr><td>Durée</td><td>${echapper(s.duree)}</td></tr></table>
    <div class="pied">${echapper(s.note)}</div>` });
  const DESSINS_D_ARME = {
    epee: '<path d="M18 62L58 22l6-8-8 6L16 60z" fill="#d9d3c2" stroke="#1a1005" stroke-width="1.500"/><path d="M14 52l14 14M12 68l6-6" stroke="#e2c06a" stroke-width="3.500"/>',
    bouclier: '<path d="M40 12l24 8v18c0 15-10 25-24 30-14-5-24-15-24-30V20z" fill="#6f4d30" stroke="#1a1005" stroke-width="1.500"/><path d="M40 12v56M16 34h48" stroke="#e2c06a" stroke-width="2.500"/><circle cx="40" cy="34" r="6" fill="#b9b3a4" stroke="#1a1005" stroke-width="1.500"/>',
  };
  const armeDeLaFiche = (a) => `<div class="arme">
      <div class="vignette laiton"><div><svg viewBox="0 0 80 80" fill="none" stroke-linecap="round" stroke-linejoin="round">${DESSINS_D_ARME[a.id]}</svg></div></div>
      <div class="texte"><div class="n gothique">${echapper(a.nom)}</div>
        <div class="mesures">${disque(a.test, { taille: 'grand' })}<span class="rubrique t">Test</span>
          <div class="m"><span class="rubrique">Dégâts</span><b>+BF+${a.degats.bonus} (${a.degats.total})</b></div><div class="m"><span class="rubrique">Allonge</span><b>${echapper(a.allonge)}</b></div></div>
        ${a.atouts.length ? `<div class="atouts">${a.atouts.map((t) => `<span class="rubrique">${echapper(t)}</span>`).join('')}</div>` : ''}</div>
    </div>`;
  const ficheDuCombattant = (f) => {
    const c = qui(f.qui);
    return [
      `<div id="f-identite" class="cadre bois" data-piece="fiche-identite"><div class="fond parchemin">
        <div class="tete">${portrait(c.buste, { camp: c.ennemi ? 'ennemi' : 'heros', taille: 'maitre' })}<div><div class="n gothique">${echapper(c.nom)}</div><div class="c rubrique">${echapper(f.peuple)}</div><div class="c rubrique">${echapper(f.carriere)}</div></div></div>
        ${mesure('Blessures', `${c.blessures} / ${c.max}`)}${filet({ losange: true })}
        <div class="reserves">${f.reserves.map((r) => compteur(r.valeur, echapper(r.nom))).join('')}</div>
      </div>${ferrures}</div>`,
      `<div id="f-profil" class="cadre bois" data-piece="fiche-profil"><div class="fond parchemin">${f.caracteristiques.map((k) => `<div class="carac"><span class="rubrique">${echapper(k.nom)}</span><b class="chiffres">${k.valeur}</b></div>`).join('')}</div>${ruban('Caractéristiques', { gothique: true })}${ferrures}</div>`,
      `<div id="f-figure" class="cadre bois" data-piece="fiche-figure"><div class="fond bois"><div class="niche laiton"><div><svg viewBox="-34 -82 68 96" id="figure-lue"></svg></div></div></div>${ferrures}</div>`,
      `<div id="f-sections" class="cadre bois" data-piece="fiche-sections"><div class="fond parchemin">${f.armes.map(armeDeLaFiche).join('')}</div>${onglets(f.sections.map(echapper), echapper(f.ouverte))}${ferrures}</div>`,
      croix(),
    ];
  };
  const POSES = {
    sort: (p, e) => {
      const rapides = e.barre.familles.find((f) => f.id === 'rapides');
      return [`<div id="apercu-sort" class="${p.depuis}">${ficheDuSort(p.sort, p.depuis === 'rapide' ? `Touche ${rapides.sorts.indexOf(p.sort.nom) + 1}` : 'Sort', p.depuis === 'rapide' ? 'bas' : 'droite')}</div>`];
    },
    cible: (p) => {
      const c = qui(p.qui);
      return [`<div id="apercu-cible">${apercu({ nom: echapper(c.nom), sous: 'Cible', vers: 'gauche', corps: `
        <div class="pv">${jauge(c.blessures / c.max, { taille: 'forte' })}<b>${c.blessures} / ${c.max}</b></div>
        <div class="titre rubrique">Attaque · ${echapper(p.arme)}</div>
        <table><tr class="seuil"><td>${echapper(p.test)}</td><td>≤ ${p.seuil}</td></tr><tr><td>dont Avantage</td><td>${signe(p.avantage)}</td></tr><tr><td>Dégâts</td><td>${signe(p.degats)}</td></tr><tr><td>${echapper(c.nom)} oppose</td><td>${echapper(p.oppose)}</td></tr></table>
        <div class="pied">${echapper(p.note)}</div>` })}</div>`];
    },
    journal: (p) => [`<div id="journal-entier" class="cadre bois" data-piece="journal-entier"><div class="fond parchemin">
      ${p.rounds.map((r) => `<h4 class="rubrique"><span>Round ${r.round}</span></h4>${r.lignes.map((l, k) => `<p data-texte="journal ${r.round}.${k}">${echapper(l)}</p>`).join('')}`).join('')}
    </div>${ruban('Journal', { gothique: true })}${ferrures}</div>`],
    fiche: (p) => ficheDuCombattant(p.fiche),
  };
  /* une offre posée sur l'entité du champ qui la porte (`surface: 'pastille-entite'`) : sa case et sa hauteur au-dessus */
  const ENTITES = { monture: [[9, 9], 138], piece: [[11.5, 8.5], 86] };
  const offre = (o) => { const [[i, j], haut] = ENTITES[o.sur]; const [x, y] = P(i, j); return `<div class="pastille-entite" data-piece="pastille ${echapper(o.libelle)}" style="left:${x / 12.8}%;top:${y - haut}px">${rond(PICTO_DE_L_ACTION[o.id], 'petit')}<span class="rubrique ombre">${echapper(o.libelle)}</span></div>`; };
  const tourDeCombat = (e) => [
    SYSTEME,
    ...combat(e.combat, { fin: !e.barre.adverse, lu: e.pose?.role === 'fiche' ? e.pose.fiche.qui : null, journal: e.pose?.role === 'journal' }),
    ...barre(e.barre),
    ...(e.liste ? [`<div id="liste" class="cadre bois" data-piece="liste"><div class="fond"><div class="t rubrique">${echapper(e.liste.titre)}</div>${e.liste.lignes.map((l, k) => plaque(echapper(l), { armee: k === e.liste.choisie, classe: 'ligne-l' })).join('')}</div>${ferrures}</div>`] : []),
    ...(e.pose ? POSES[e.pose.role](e.pose, e) : []),
    ...(e.offres ?? []).map(offre),
  ];

  /* 7. Ce que rend une victoire, dans une fenêtre du bas sous la bannière : l'Expérience et l'argent, les vaincus, le
     butin, à qui va chaque objet ; l'action unique de l'issue en pied */
  const butin = (b, action) => bandeauDuJet('Butin', 'butin', `
    <div class="gains">${reserves([[b.experience, 'Expérience']], 'grand')}<div class="argent"><b class="gothique">${b.argent.shillings}/${b.argent.pence}</b><span class="rubrique">Argent</span></div></div>
    <div class="vaincus"><div class="t rubrique">Vaincus</div>${b.vaincus.map((v) => `<div class="v">${echapper(v.nom)} ×${v.nombre}${v.depecer ? options([['Dépecer']]) : ''}</div>`).join('')}</div>
    <div class="lignes-b"><div class="t rubrique">Butin, à qui va chaque objet</div>${b.objets.map((o) => `<div class="ligne-b"><span data-texte="butin ${echapper(o.nom)}">${echapper(o.nom)}</span><i class="rubrique">Attribuer</i>${o.pour.map((h) => portrait(h, { taille: 'menu' })).join('')}</div>`).join('')}</div>`,
  plaque(echapper(action), { armee: true }));

  /* ───────── les options ───────── */
  const curseur = (v, min, max, texte = v, l = 118) => `<span class="curseur">${reglette((v - min) / (max - min), l)}<span class="val gothique">${texte}</span></span>`;
  const valeurDe = (p, l) => ('oui' in p ? ouiNon(p.oui) : 'pourcent' in p ? curseur(p.pourcent, 0, 100, `${p.pourcent} %`, 104)
    : 'valeurs' in p ? segments(p.valeurs.map(echapper), echapper(p.valeurs[p.tenue]))
      : 'liste' in p ? `<span class="pas-a-pas">${picto('gauche', 15, '#5a4530', 2)}<b class="rubrique">${echapper(p.liste)}</b>${picto('droite', 15, '#5a4530', 2)}</span>`
        : curseur(p.valeur, p.min, p.max, p.signe ? signe(p.valeur) : p.valeur, l));
  const pref = (p) => `<div class="pref"><div class="l"><b>${echapper(p.nom)}</b>${valeurDe(p, 104)}</div>${p.aide ? `<p>${echapper(p.aide)}</p>` : ''}</div>`;
  const regleMaison = (r) => `<div class="regle ${r.aide ? 'pointee' : ''} ${r.modifiee ? 'modifiee' : ''}">
    <div class="t"><b data-texte="règle ${echapper(r.nom)}">${echapper(r.nom)}</b>${r.maison ? '<span class="ref rubrique">valeur maison</span>' : ''}</div>
    <div class="c">${r.modifiee ? `<span class="defaut rubrique">${picto('annuler', 12, '#6b1c10', 2)}Défaut</span>` : ''}${valeurDe(r, 118)}</div>
    ${r.aide ? `<p class="aide" data-texte="aide">${echapper(r.aide)}</p>` : ''}${r.action ? `<div class="action">${plaque(echapper(r.action), { armee: true, icone: 'etoile' })}</div>` : ''}</div>`;
  const ecranDesOptions = (o) => {
    const { ouvert } = o;
    const domaine = o.domaines.find((d) => d.nom === ouvert.domaine);
    const modifiees = ouvert.gauche.concat(ouvert.droite).filter((r) => r.modifiee).length;
    return [fondDeTable(),
      cartouche({ icone: 'systeme', nom: echapper(o.titre.nom), sous: echapper(o.titre.sous), taille: 'titre', largeur: 392 }),
      `<div id="preferences" class="cadre bois" data-piece="préférences"><div class="fond bois">${o.son.map(pref).join('')}<div class="trait"></div>${o.jeu.map(pref).join('')}</div>${ruban('Préférences')}${ferrures}</div>`,
      signets(o.domaines.map((d) => ({ nom: echapper(d.nom), compte: d.regles, marque: !!d.modifiees })), echapper(ouvert.domaine)),
      `<div id="registre" data-piece="registre"><div class="tranche"></div>
        <div class="feuille g parchemin">
          <div class="tete"><span class="dom gothique" data-texte="domaine">${echapper(domaine.nom)}</span><span class="sous rubrique">Règles maison · ${pluriel(domaine.regles, 'règle')}</span></div>
          ${filet({ losange: true })}${ouvert.gauche.map(regleMaison).join('')}
          <div class="pied">${rond('gauche', 'petit', { ferme: ouvert.feuillet === 1 })}<span class="folio rubrique">Feuillet ${ouvert.feuillet} sur ${ouvert.feuillets}</span>${modifiees ? `<span class="marque">${sceau('plume', 'menu')}<i>${pluriel(modifiees, 'règle')} ${modifiees > 1 ? 'modifiées' : 'modifiée'}</i></span>` : ''}</div>
        </div>
        ${ouvert.droite.length ? `<div class="feuille d parchemin">
          <div class="tete"><span class="sous rubrique">${echapper(domaine.nom)}, suite</span><span class="sous rubrique">Règles ${ouvert.gauche.length + 1} à ${ouvert.gauche.length + ouvert.droite.length} sur ${domaine.regles}</span></div>
          ${filet({ losange: true })}${ouvert.droite.map(regleMaison).join('')}
          <div class="pied"><span class="suite"><span class="rubrique">Feuillet suivant</span>${rond('droite', 'petit')}</span></div>
        </div>` : '<div class="feuille d parchemin"></div>'}
        ${CLOUS}</div>`,
      croix()];
  };

  /* ───────── le bivouac ───────── */
  const PICTO_DE_LA_NUIT = { froid: 'flocon', repos: 'sommeil' };
  const PICTO_DU_TEMPS = { gel: 'flocon' };
  const bivouac = (b) => [
    cartouche({ icone: 'lune', nom: echapper(b.titre), sous: `${b.date.jour} ${echapper(b.date.mois)} · ${echapper(b.moment)} · ${picto(PICTO_DU_TEMPS[b.meteo.temps], 13, '#c9b995')} ${echapper(b.meteo.ciel)}`, taille: 'titre', largeur: 436 }),
    `<div id="recit" data-piece="recit"><div class="r rubrique ombre">${echapper(b.lieu)}</div><p class="ombre">${echapper(b.recit)}</p></div>`,
    `<div id="camp" class="cadre bois" data-piece="campement"><div class="fond bois">
      <div class="rang-c"><span class="lab rubrique">Abri</span>${medaillon('tente', { taille: 'petit' })}<span class="v">${echapper(b.abri.nom)} <em>· ${echapper(b.abri.detail)}</em></span></div>
      <div class="rang-c" style="margin-bottom:0"><span class="lab rubrique">Temps</span>${sceau(PICTO_DU_TEMPS[b.meteo.temps])}<span class="v">${echapper(b.temps)}</span></div>
      ${filet({ fondu: true })}
      <div class="t rubrique">Ce que la nuit jouera</div>
      ${b.nuit.map((n) => `<div class="jouera">${rond(PICTO_DE_LA_NUIT[n.id], 'menu', { arme: true })}${echapper(n.nom)}<span class="rubrique">${echapper(n.jet)}</span></div>`).join('')}
      ${plaque(echapper(b.action), { armee: true, icone: 'lune', classe: 'nuit' })}
    </div>${ruban('Le campement')}${ferrures}</div>`,
    bandeauDu(b.groupe, (h) => `<div class="choix-h"><span class="rubrique">Couchage</span><b>${echapper(h.couchage)}</b></div><div class="choix-h"><span class="rubrique">Nourriture</span>${h.nourriture.valeurs.map((v, k) => plaque(echapper(v), { armee: k === h.nourriture.tenue, taille: 'petite' })).join('')}</div>`),
    retour(echapper(b.retour), 'route'), coins(),
  ];

  /* ───────── les lieux et la route ───────── */
  /* le groupe du bandeau, ce que dit chaque héros : le poste ou l'activité qu'il tient, ou ce qui l'attend */
  const PICTO_DU_DIT = { mousse: 'cordage', timonier: 'barre', navigateur: 'etoile', capitaine: 'couronne', tenez: 'bouclier', motivation: 'couronne', quais: 'ancre', temple: 'livre', caserne: 'bouclier' };
  const ditDe = (d) => ('attend' in d ? { html: `<span class="attend${d.sombre ? ' sombre' : ''} rubrique">${echapper(d.attend)}</span>` }
    : d.mal ? { texte: echapper(d.texte), icone: 'goutte', mal: true } : { texte: echapper(d.texte), icone: PICTO_DU_DIT[d.id] });
  const bandeauDu = (groupe, html = () => '') => bandeau(Object.fromEntries(groupe.map((h) => { const d = h.dit ? ditDe(h.dit) : {}; return [h.id, { ...d, choisi: !!h.choisi, html: `${d.html ?? ''}${html(h)}` }]; })),
    { groupe: groupe.map((h) => ({ id: h.id, nom: echapper(h.nom), car: echapper(h.carriere), pv: h.blessures, max: h.max })) });
  /* le titre d'un lieu : sa journée en voyage, ou son nom et ce qu'on y vit */
  const PICTO_DU_DECOR = { mer: 'soleil', foret: 'botte' };
  const titreDu = (t, decor) => ('jour' in t
    ? temps({ teinte: t.ciel, jour: echapper(t.jour), date: `${t.date.jour} ${echapper(t.date.mois)} · ${t.enMer}ᵉ jour en mer`, meteo: echapper(t.meteo), icone: PICTO_DU_DECOR[decor] })
    : cartouche({ icone: PICTO_DU_DECOR[decor], nom: echapper(t.nom), sous: echapper(t.sous), taille: 'titre', largeur: 436 }));
  const recitDu = (r) => `<div id="recit" data-piece="recit"><div class="r rubrique ombre">${echapper(r.rubrique)}</div><p class="ombre" data-texte="recit">${echapper(r.texte)}</p></div>`;
  const ligneDu = (lab, val) => `<div class="ligne"><span class="rubrique">${lab}</span><span>${val}</span></div>`;

  /* la poursuite : qui poursuit, la Distance en jauge, ce que la manche joue, ce qui la clôt ; ou la sommation du navire */
  const PANNEAUX = {
    poursuite: (p) => cadre('panneau', null, null, null, null, 'bois', `${ligneDu('Poursuivant', echapper(p.poursuivant))}
      ${ligneDu('Distance', `<span class="chiffres">${p.distance} / ${p.sur}</span>`)}${jauge(p.distance / p.sur, { teinte: 'or', taille: 'forte' })}
      ${ligneDu(echapper(p.manche.libelle), 'dr' in p.manche ? `<span class="chiffres">${signe(p.manche.dr)}</span>` : echapper(p.manche.test))}
      ${p.issues.map((i) => (i.condition ? ligneDu(echapper(i.condition), `${echapper(i.issue)} à ${i.distance}`) : ligneDu(`Distance ${i.distance}`, echapper(i.issue)))).join('')}
      ${p.abandon ? `${filet()}${plaque(echapper(p.abandon), { taille: 'petite' })}` : ''}`, { ruban: 'La poursuite', classe: 'bord' }),
    sommation: (p) => cadre('panneau', null, null, null, null, 'bois', `${ligneDu('Navire hostile', echapper(p.navire))}${ligneDu('Équipage', `${p.forbans} forbans`)}
      ${ligneDu('Cargaison en cale', p.cargaison === null ? 'pillée' : `${p.cargaison} Enc`)}${ligneDu('Pillage, si soumission', `${p.pillage} % · valeur maison`)}`, { ruban: 'La sommation', classe: 'bord' }),
  };
  /* la frise de la Distance, de « Rattrapés » à « Semés », le repère du départ, l'écart que la manche creuse */
  const friseDu = (f) => {
    const x1 = 900, xi = x1 * f.distance / f.sur, xd = x1 * f.depart / f.sur;
    return `<div id="frise" data-piece="distance"><svg width="920" height="44" viewBox="-10 -24 920 44"><path d="M0 0H${xi}" stroke="#f3dc93" stroke-width="3"/><path d="M${xi} 0H${x1}" stroke="#c9b995" stroke-width="1.500" opacity=".8"/>
      <circle cx="0" r="6" fill="#b9412c" stroke="#150d04" stroke-width="1.500"/><circle cx="${x1}" r="5" fill="#f3dc93" stroke="#150d04" stroke-width="1.500"/><circle cx="${xd}" r="3" fill="#c9b995"/><path d="M${xi - 5} -13h10l-5 7z" fill="#e9dcc0"/>
      <g font-family="Fell SC" font-size="11" letter-spacing="1.200" fill="#c9b995"><text x="-6" y="17">Rattrapés · 0</text><text x="${xd}" y="17" text-anchor="middle">Départ · ${f.depart}</text><text x="${x1 + 6}" y="17" text-anchor="end">Semés · ${f.sur}</text></g></svg>
      <div class="reste rubrique ombre">Distance <b class="gothique">${f.distance}</b>${f.ecart ? ` · le navire creuse l’écart, ${signe(f.ecart)}` : ''}</div></div>`;
  };
  /* l'aperçu du Test d'équipage joué : chaque poste, son DR, la somme */
  const apercuDuTest = (a) => `<div id="apercu-test">${apercu({ nom: echapper(a.nom), sous: echapper(a.test), vers: 'bas', corps: `<table>${a.lignes.map((l) => `<tr><td>${echapper(qui(l.qui).nom)}, ${echapper(l.poste)}</td><td>${signe(l.dr)} DR${l.double ? ', compte double' : ''}</td></tr>`).join('')}
    <tr class="somme"><td>Somme</td><td>${signe(a.lignes.reduce((t, l) => t + l.dr * (l.double ? 2 : 1), 0))} DR</td></tr></table>` })}</div>`;
  const poursuite = (p) => [
    titreDu(p.titre, p.decor), recitDu(p.recit),
    ...(p.trajet ? [carteDuTrajet({ titre: echapper(p.trajet.titre), de: echapper(p.trajet.de), vers: echapper(p.trajet.vers), part: p.trajet.part, eau: 'mer' })] : []),
    PANNEAUX[p.panneau.role](p.panneau),
    ...(p.frise ? [friseDu(p.frise)] : []), ...(p.apercu ? [apercuDuTest(p.apercu)] : []),
    ...(p.postes ? [ouvrir(echapper(p.postes), 'cordage', 428)] : []),
    ...(p.fenetre ? [fenetre(p.fenetre)] : [bandeauDu(p.groupe)]), coins(),
  ];

  /* la bataille de masse : la Puissance des deux armées, ce que le Round joue, les Scènes sur le champ, le carton */
  const PICTO_DE_LA_SCENE = { pluie: 'arc', tenez: 'bouclier', motivation: 'couronne' };
  const prenom = (id) => echapper(qui(id).nom.split(' ')[0]);
  const quiJoue = (j) => (j.qui === 'groupe' ? 'Tout le groupe' : j.qui.map(prenom).join(', '));
  const ceQueJoue = (j) => (j.echec ? 'échouée, aucun effet' : [j.ote && `Horde ${signe(-j.ote)}`, j.rupture && `rupture ${j.rupture.points}/${j.rupture.sur}`].filter(Boolean).join(' · '));
  const armeeDu = (a, bonus, teinte) => `${ligneDu(echapper(a.nom), `<span class="chiffres">${a.puissance} · départ ${a.depart}</span>`)}${jauge(a.puissance / 100, { teinte, taille: 'forte' })}${bonus ? ligneDu('Tests de Puissance ce Round', `<span class="chiffres">${signe(bonus)}</span>`) : ''}`;
  const puissance = (b) => cadre('panneau', null, null, null, null, 'bois', `${armeeDu(b.armees.allies, b.bonus, 'or')}${armeeDu(b.armees.ennemis, 0, 'cire')}${filet({ fondu: true })}
    ${b.jeu ? `<div class="t rubrique">Ce que le Round ${b.jeu.joue ? 'a joué' : 'jouera'}</div>${b.jeu.scenes.map((j) => `<div class="jouera${b.jeu.joue ? ' joue' : ''}">${rond(PICTO_DE_LA_SCENE[j.scene], 'menu', { arme: true })}${echapper(j.nom)}<span class="rubrique">${b.jeu.joue ? ceQueJoue(j) : quiJoue(j)}</span></div>`).join('')}` : ''}
    ${b.rounds ? `<div class="t rubrique">Ce que la bataille a joué</div>${b.rounds.map((r, k) => ligneDu(`Round ${k + 1}`, `${r.allies} contre ${r.ennemis}`)).join('')}` : ''}
    ${(b.gestes ?? []).map((g, k) => plaque(echapper(g.libelle), { armee: !!g.principal, icone: k ? 'des' : 'epee' })).join('')}`, { ruban: 'Puissance', classe: 'bord armees' });
  /* une Scène sur son emplacement du champ : ses postés (ou son pictogramme), la place offerte, son effet, son geste */
  const EMPLACEMENTS = [[800, 84], [470, 330], [760, 330]];
  const sceneDu = (sc, [cx, y]) => `<div class="poste scene ${sc.postes.length ? 'occupe' : 'vide'}${sc.visee ? ' vise' : ''}" style="left:${cx - 115}px;top:${y}px">
    <div class="postes-de-scene">${sc.postes.length ? sc.postes.map((id) => portrait(qui(id).buste)).join('') : medaillon(PICTO_DE_LA_SCENE[sc.id], { taille: 'moyen' })}${sc.place ? medaillon('plus', { taille: 'petit' }) : ''}</div>
    <div class="et bois"><b>${echapper(sc.nom)}</b><span class="rubrique">${echapper(sc.effet)}</span>${sc.rupture ? `<span class="rubrique position">Point de rupture ${sc.rupture.points}/${sc.rupture.sur}</span>` : ''}${plaque(echapper(sc.geste), { armee: !!sc.visee, taille: 'petite' })}</div></div>`;
  const apercuDeLaScene = (a, scenes) => {
    const k = scenes.findIndex((sc) => sc.id === a.scene), [cx, y] = EMPLACEMENTS[k];
    return apercu({ nom: echapper(scenes[k].nom), sous: 'Postés', vers: 'bas', style: `left:${cx - 90}px;bottom:${720 - y + 8}px;--pointe:90px`,
      corps: `<table>${a.lignes.map((l) => `<tr><td>${echapper(qui(l.qui).nom)}</td><td>${echapper(l.comment)}</td></tr>`).join('')}${a.regles.map((r) => `<tr><td>${echapper(r.libelle)}</td><td>${echapper(r.texte)}</td></tr>`).join('')}</table>` });
  };
  /* le carton : les deux armées de part et d'autre de ce qui les départage, ses gestes */
  const ost = (o, a, bonus, cote) => ('issue' in o
    ? `<div class="ost ${cote}">${sceau(a.puissance, 'maitre', { etat: o.gagne ? 'reussite' : '', de: 'Puiss.' })}<div><div class="n">${echapper(a.nom)}</div><div class="c rubrique">départ ${a.depart}</div><div class="issue${o.gagne ? ' reussite' : ''}"><b>${echapper(o.issue)}</b></div></div></div>`
    : `<div class="ost ${cote}">${sceau(o.jet, 'maitre', { etat: o.dr > 0 ? 'reussite' : '', de: 'd100' })}<div><div class="n">${echapper(a.nom)}</div><div class="c rubrique">Puissance ≤ ${o.seuil}${bonus ? ` + ${bonus}` : ''}</div><div class="issue${o.dr > 0 ? ' reussite' : ''}"><b>${o.dr > 0 ? 'Réussite' : 'Échec'} · DR ${signe(o.dr)}</b> · ôte ${o.ote}</div></div></div>`);
  const carton = (b) => {
    const c = b.carton, { allies, ennemis } = b.armees, issue = 'issue' in c.allies;
    const milieu = issue
      ? `<div class="sous rubrique">Après ${b.rounds.length} Rounds de bataille</div><div class="dr">${echapper((c.allies.gagne ? allies : ennemis).nom)} l’emporte</div><p data-texte="phrase d'issue">${echapper(c.phrase)}</p>`
      : `<div class="sous rubrique">Round de bataille ${b.round.rang} / ${b.round.sur}</div><div class="dr">${allies.puissance} contre ${ennemis.puissance}</div><p data-texte="phrase d'issue">Les Personnages réduisent l’ennemi de ${c.allies.ote}, l’ennemi réduit les Personnages de ${c.ennemis.ote}.</p>`;
    return cadre('epreuve', null, null, null, null, 'parchemin', `${ost(c.allies, allies, b.bonus, '')}<div class="milieu">${milieu}</div>${ost(c.ennemis, ennemis, 0, 'droite')}
      <div class="gestes">${c.gestes.map((g) => plaque(echapper(g.libelle), { armee: !!g.principal, classe: g.libelle.length > 14 ? 'large' : '' })).join('')}</div>`, { ruban: echapper(c.titre), classe: issue ? 'issue' : '' });
  };
  const bataille = (b) => [
    cartouche({ icone: 'epee', nom: 'Bataille de masse', sous: b.round ? `Round de bataille ${b.round.rang} / ${b.round.sur}` : 'La bataille est terminée', taille: 'titre', largeur: 436 }),
    ...(b.terrain ? [recitDu({ rubrique: 'Le terrain', texte: b.terrain })] : []),
    puissance(b),
    ...(b.scenes ? [`<div data-piece="scenes">${b.scenes.map((sc, k) => sceneDu(sc, EMPLACEMENTS[k])).join('')}</div>`] : []),
    ...(b.apercu ? [apercuDeLaScene(b.apercu, b.scenes)] : []),
    ...(b.carton ? [carton(b)] : []),
    ...(b.fenetre ? [fenetre(b.fenetre)] : [bandeauDu(b.groupe)]), coins(),
  ];

  /* l'interlude en ville : les Activités restantes de chaque héros, la carte et ses lieux, le lieu choisi et ses
     Activités ; la carte se trace une fois posée (`lieux-et-nuit/carte-de-la-ville.js`) */
  const lieuSurLaCarte = (l) => { const { x, y, icone } = LIEUX_DE_LA_VILLE[l.id];
    /* l'étiquette d'un lieu près d'un bord de la carte s'ouvre vers l'intérieur */
    return `<div class="lieu bois${l.choisi ? ' choisi' : ''}${x < 211 ? ' gauche' : x > 633 ? ' droite' : ''}" style="left:${(100 * x) / 844}%;top:${(100 * y) / 572}%">${medaillon(icone, { taille: 'petit' })}<div><b>${echapper(l.nom)}</b><span class="rubrique">${echapper(l.quoi)}</span></div>${l.heros ? portrait(l.heros, { taille: 'petit' }) : ''}${l.fantome ? portrait(l.fantome, { taille: 'petit', classe: 'fantome' }) : ''}</div>`; };
  const activiteDu = (a) => `<div class="activite${a.enjeu ? ' prise' : ''}${a.refus ? ' fermee' : ''}">${medaillon(a.id, { taille: 'petit', ferme: !!a.refus })}<div><b>${echapper(a.nom)}</b>${a.test ? `<span class="c rubrique">${echapper(a.test)}</span>` : ''}${a.enjeu ? `<i>${echapper(a.enjeu)}</i>` : ''}</div>${a.refus && a.survol ? raison(echapper(a.refus)) : ''}</div>`;
  const interlude = (i) => {
    const nomDe = (id) => echapper(i.groupe.find((h) => h.id === id).nom.split(' ')[0]);
    const pips = (n) => `<div class="pips">${[0, 1, 2].map((k) => `<i class="${k < n ? '' : 'vide'}"></i>`).join('')}</div>`;
    const choisi = i.groupe.find((h) => h.choisi)?.id;
    const [ouvertes, fermees] = [i.lieu.activites.filter((a) => !a.refus), i.lieu.activites.filter((a) => a.refus)];
    return [
      cartouche({ icone: 'ville', nom: echapper(i.ville.nom), sous: echapper(i.ville.sous), taille: 'titre', largeur: 300 }),
      cadre('interlude', null, null, null, null, 'bois', `<h3>Activités restantes</h3><div class="s rubrique">Une par semaine, trois au plus</div>
        <div class="rangs">${i.restantes.map((r) => rang(r.qui, { taille: 'petit', choisi: r.qui === choisi, nom: nomDe(r.qui), gothique: true, sous: `Événement · ${echapper(r.evenement)}`, fin: `<div class="r">${pips(r.activites)}</div>` })).join('')}</div>
        ${filet({ fondu: true })}<div class="avis">${sceau('pieces')}<span>${echapper(i.avis)}</span></div>`, { ruban: 'L’interlude' }),
      `<div id="carte" class="cadre bois" data-piece="carte"><div class="fond parchemin"><svg viewBox="0 0 844 572" preserveAspectRatio="none"></svg>${i.lieux.map(lieuSurLaCarte).join('')}</div>${ferrures}</div>`,
      cadre('lieu', null, null, null, null, 'bois', `<h3 data-texte="lieu">${echapper(i.lieu.nom)}</h3>
        ${i.lieu.forces ? `<div class="forces rubrique">Armée des Personnages ${i.lieu.forces.allies} · Horde ennemie ${i.lieu.forces.ennemis}</div>` : ''}
        ${ouvertes.map(activiteDu).join('')}${fermees.length ? `<div class="fermees">${fermees.map(activiteDu).join('')}</div>` : ''}
        ${plaque(echapper(i.lieu.envoi), { armee: true, icone: 'route', classe: 'envoyer' })}`, { ruban: echapper(i.lieu.quartier) }),
      bandeauDu(i.groupe), retour(echapper(i.retour), 'sablier'), coins(),
    ];
  };
  const tracerLaVille = (i) => dessinerLaVille(document.querySelector('#carte svg'), i.lieux.map((l) => ({ ...LIEUX_DE_LA_VILLE[l.id], choisi: !!l.choisi })));

  /* ───────── les gabarits : leurs feuilles, leurs scripts, leur pose ───────── */
  const COUR = { feuilles: ['combat/combat.css', 'combat-suite/suite.css'], scripts: ['combat/jet.js', 'combat/socle.js', 'combat/cour.js'] };
  const GABARITS = {
    /* 6. Fenêtre du bas, posée sur le combat ou, hors combat, seule sur la cour */
    'fenetre-du-bas': { ...COUR, poser: (e) => [SYSTEME, ...(e.combat ? combat(e.combat) : []), fenetre(e.fenetre)] },
    /* 5. Combat : le tour de l'actif */
    combat: { ...COUR, poser: tourDeCombat },
    /* 7. Issue d'un combat : la bannière, l'action unique dessous, le système */
    recit: { ...COUR, poser: (e) => [SYSTEME, issue(echapper(e.titre), { suite: e.suite ? echapper(e.suite) : '', action: e.butin ? '' : echapper(e.action) }), ...(e.butin ? [butin(e.butin, e.action)] : [])] },
    /* 2. Gestion */
    gestion: { feuilles: ['lieux-et-nuit/commun.css', 'accueil-et-systeme/systeme.css', 'accueil-et-systeme/options.css'], scripts: ['lieux-et-nuit/bustes.js', 'lieux-et-nuit/commun.js', 'accueil-et-systeme/systeme.js'], poser: ecranDesOptions },
  };
  /* 4. Lieu et voyage : un décor par lieu, ses feuilles et ses scripts */
  const LIEU = { feuilles: ['lieux-et-nuit/commun.css'], scripts: ['lieux-et-nuit/bustes.js', 'lieux-et-nuit/commun.js'] };
  const ROUTE = { feuilles: [...LIEU.feuilles, 'voyage/voyage.css', 'combat/jet.css', 'combat-suite/suite.css'], scripts: [...LIEU.scripts, 'voyage/voyage.js', 'combat/jet.js', 'combat-suite/decors.js'] };
  const DECORS = {
    bivouac: { feuilles: [...LIEU.feuilles, 'lieux-et-nuit/bivouac.css'], scripts: [...LIEU.scripts, 'lieux-et-nuit/bivouac.js'], poser: bivouac },
    mer: { ...ROUTE, poser: poursuite },
    foret: { ...ROUTE, poser: poursuite },
    champ: { ...ROUTE, poser: bataille },
    ville: { feuilles: [...LIEU.feuilles, 'lieux-et-nuit/interlude-en-ville.css'], scripts: [...LIEU.scripts, 'lieux-et-nuit/carte-de-la-ville.js'], poser: interlude, tracer: tracerLaVille },
  };
  GABARITS['lieu-et-voyage'] = DECORS[etat.decor];

  const charger = (src) => new Promise((ok, ko) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => ko(new Error(`script ${src}`)); document.body.append(s); });
  const lier = (href) => new Promise((ok, ko) => { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; l.onload = ok; l.onerror = () => ko(new Error(`feuille ${href}`)); document.head.append(l); });

  (async () => {
    const g = GABARITS[etat.gabarit];
    if (!g) throw new Error(`gabarit ${etat.gabarit} : aucune pose`);
    /* la cour, à l'état qu'elle dessine (`combat/cour.js`) et avec les marques de la suite du combat */
    if (etat.cour) Object.assign(ecran.dataset, { etat: etat.cour.etat, marques: (etat.cour.marques ?? []).join(' ') });
    await Promise.all(g.feuilles.map(lier));
    await lier('rendu.css');
    for (const s of g.scripts) await charger(s);
    if (etat.cour?.videe) document.querySelector('#scene rect[fill="#06040a"]')?.remove();
    monter(g.poser(etat));
    g.tracer?.(etat);
    if (etat.pose?.role === 'fiche') FIGURES[qui(etat.pose.fiche.qui).buste](document.getElementById('figure-lue'));
    await document.fonts.ready;
    globalThis.RAPPORT_DU_RENDU = {};
  })().catch((e) => { globalThis.RAPPORT_DU_RENDU = { erreur: String(e) }; throw e; });
}
