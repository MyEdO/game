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
  /* le camp d'un combattant : l'ennemi se passe, le héros ou le PNJ suit son buste (`CAMP`, `gestes.js`) */
  const campDe = (id) => (qui(id).ennemi ? 'ennemi' : undefined);
  const portraitDe = (id, taille = 'grand') => portrait(qui(id).buste, { camp: campDe(id), taille });
  const libelleDuModificateur = (m) => ('de' in m ? `${m.nom} : ${m.de} → ${d100(m.vers)}` : 'rang' in m ? `${m.nom} ${m.rang} sur ${m.sur}` : 'facteur' in m ? `${m.nom} ×${m.facteur}` : m.valeur === undefined ? m.nom : `${m.nom} ${signe(m.valeur)}`);
  const porte = ({ arme, cible }) => `${echapper(arme)} · Cible : ${echapper(qui(cible).nom)}`;
  const regle = (libelle, corps) => `<div class="regle"><span class="l rubrique">${echapper(libelle)}</span>${corps}</div>`;
  const optionsDu = (r) => options(r.valeurs.map((v, k) => [echapper(v), { armee: k === r.tenue }]));

  /* le camp d'un testeur, à gauche ou en miroir à droite : son poste, son Test et son seuil, ses dés posés ou tombés ; les
     héros parmi lesquels il se désigne */
  const testeur = (t, cote = '') => {
    const des = t.jet?.des ?? t.des;
    const faces = des ? des.map(String) : ['', ''];
    return camp({
      cote, portrait: portraitDe(t.qui), nom: echapper(qui(t.qui).nom), carac: `${t.poste ? `${echapper(t.poste)} · ` : ''}${echapper(t.test)}`, seuil: t.seuil ?? '?',
      sous: t.parmi ? testeurs(t.parmi.map((id) => qui(id).buste), t.parmi.indexOf(t.qui)) : '',
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
    testeur: () => 'Portera le Test',
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
    rangees: (r) => `<div class="rangees"><div class="t rubrique">Chacun lance son jet, les DR s’additionnent</div>${r.rangees.map((x) => `<div class="rangee">${portrait(qui(x.qui).buste, { taille: 'menu' })}<div class="q" data-texte="rangée ${echapper(qui(x.qui).nom)}"><b class="gothique">${echapper(qui(x.qui).nom)}</b><span class="rubrique">${echapper(x.poste)} · ${echapper(x.competence)}</span></div><span class="seuil">≤ ${x.seuil}</span></div>`).join('')}</div>`,
    choix: (c) => `<div class="rangees chansons"><div class="t rubrique">${echapper(c.libelle)}</div>${c.cartes.map(carteDe).join('')}</div>`,
    interlocuteur: (i) => `<div class="camp droite parle">${portraitDe(i.qui)}<div><div class="n gothique">${echapper(qui(i.qui).nom)}</div><div class="c rubrique">${echapper(i.comme)}</div><p data-texte="réplique">${echapper(i.dit)}</p></div></div>`,
  };

  /* une carte de choix : son nom ou le combattant qu'elle nomme, son détail ligne à ligne (une ligne en liste quand il y tient), sa marque */
  const ligneDeCarte = (l) => (typeof l === 'string' ? echapper(l)
    : 'contre' in l ? `${echapper(l.test)} ≤&nbsp;${l.seuil} contre&nbsp;≤&nbsp;${l.contre}`
      : 'seuil' in l ? `${echapper(l.test)}&nbsp;·&nbsp;≤&nbsp;${l.seuil}`
        : 'ni' in l ? `Niveau d’incantation ${l.ni}`
          : 'aCumuler' in l ? `Test étendu : ${l.aCumuler} DR à cumuler`
            : 'prix' in l ? prix(l.prix)
              : 'mesure' in l ? `${echapper(l.mesure)} ${l.valeur} / ${l.sur}`
                : `${echapper(qui(l.qui).nom)} à ${l.distance} m · portée ${l.portee} m`);
  const carteDe = (c) => {
    const lignes = c.detail.map(ligneDeCarte);
    const marque = c.marque && modif(c.marque.valeur === undefined ? echapper(c.marque.nom) : `${c.marque.valeur < 0 ? signe(c.marque.valeur) : c.marque.valeur} ${echapper(c.marque.nom)}`);
    /* la marque suit la dernière ligne quand elle y tient, sinon passe dessous */
    const derniere = lignes.length ? lignes.pop() : '';
    const sous = [...lignes, marque ? (`${derniere}${c.marque.nom}`.length > 24 ? `${derniere} <br>${marque}` : `${derniere} ${marque}`) : derniere].join('<span class="sep"> · </span><br>');
    return carte(echapper(c.nom ?? qui(c.qui).nom), sous, { armee: !!c.choisie, fermee: !!c.refus, refus: c.refus && c.survol ? echapper(c.refus) : '', classe: c.funeste ? 'funeste' : '', portrait: c.qui ? portrait(qui(c.qui).buste, { camp: campDe(c.qui) }) : '' });
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
    if (l.zone) return reglages(porte(c.porte), `<div class="rangee">${silhouette(92, { [l.zone.id]: 'choisie' })}
      <div class="choix"><div class="l rubrique">${echapper(l.libelle)}</div>
      <div class="v"><span class="gothique">${echapper(l.zone.nom)}</span>${l.malus === null ? '' : modif(`${signe(l.malus)} au Test`)}</div>
      ${l.hasard ? `<div class="bas">${options([['Au hasard']])}${bascules}</div>` : ''}</div></div>`);
    return reglages(porte(c.porte), `<div class="rangee">${silhouette(92)}<div class="choix">
      ${c.reglages.map((r) => regle(r.libelle, optionsDu(r))).join('')}${regle(l.libelle, options([['Au hasard', { armee: true }]]))}
      <div class="bascules">${bascules}</div>${c.note ? `<p data-texte="note">${echapper(c.note)}</p>` : ''}</div></div>`, 'haut');
  };
  /* le lot qu'un Marchandage traite, et le sens du marché */
  const lotMarchande = (l) => `${echapper(l.nom)} · ${l.enc} Enc`;
  const SENS_DU_MARCHE = { achat: 'à l’achat', vente: 'à la vente' };
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
    marchandage: (c) => ['', reglages(`${lotMarchande(c.lot)} · estimation ${prix(c.estimation)}`, `<div class="dr gothique">Test opposé</div>
      <div class="enjeux">${c.enjeux.map((e) => modif(e.enPlus ? `${echapper(e.issue)} : ${e.pourcent} % de plus` : `${echapper(e.issue)} : ${signe(e.pourcent)} %`)).join('')}</div>`)],
    marche: (c) => ['', `<div id="verdict"><div class="sous rubrique" data-texte="sous-titre">${lotMarchande(c.lot)}</div><div class="dr gothique">DR net ${signe(c.drNet)}</div>
      <p data-texte="phrase d'issue">${echapper(c.issue.issue)} (${signe(c.issue.pourcent)} % ${SENS_DU_MARCHE[c.lot.sens]})</p><div class="prix chiffres"><s>${prix(c.avant)}</s><b>${prix(c.apres)}</b></div></div>`],
    equipage: (c) => ['avant', reglages(`Test d’équipage · ${echapper(c.fait)}${c.cible ? ` · Cible : ${echapper(qui(c.cible).nom)}` : ''}`, `<div class="l rubrique">${echapper(c.reglage.libelle)}</div>${optionsDu(c.reglage)}
      <div class="enjeux">${c.notes.map((n) => modif(typeof n === 'string' ? echapper(n) : 'dr' in n ? `${echapper(n.nom)} ${signe(n.dr)} DR` : `${pluriel(n.pieces, 'pièce')} à ${echapper(n.bord)}`)).join('')}</div>`)],
    /* le Test simple : ce qui le pose, et le jour du voyage où il tombe */
    simple: (c) => {
      const sur = `${echapper(c.sur)}${c.difficulte ? ` · ${echapper(c.difficulte.nom)} (${signe(c.difficulte.valeur)})` : ''}${etat.titre?.jourDeVoyage ? ` · ${jourDe(etat.titre.jourDeVoyage, etat.decor)}` : ''}`;
      return c.dr === undefined ? ['avant', reglages(sur, `<div class="dr gothique">Test simple</div><p data-texte="phrase">${echapper(c.phrase)}</p>`)] : ['', verdict(sur, `DR ${signe(c.dr)}`, echapper(c.phrase))];
    },
    /* les réponses d'un dialogue, numérotées : le Test qu'une réponse demande en tête, ce qu'elle coûte au bout */
    dialogue: (c) => ['dialogue', `<div class="reponses">${c.reponses.map((r, k) => plaque(`<span class="dit">${r.test ? `<span class="annonce">${picto('de', 14)}${echapper(r.test.competence)} · ${echapper(r.test.difficulte)}</span>` : ''}<span data-texte="réponse ${k + 1}">${echapper(r.texte)}</span></span>`,
      { numero: k + 1, survol: !!r.survol, prix: r.prix === undefined ? null : prix(r.prix), taille: 'petite', classe: 'gauche' })).join('')}</div>`],
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
    'manoeuvre-du-navire': 'barre', bordee: 'canon',
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
      ${b.charge ? mesure('Chargé', `${b.charge.reste} / ${b.charge.sur}`, 'or') : `<div class="mesure"><div class="tete rubrique"><span>Mouvement</span><b>${b.mouvement.reste} / ${b.mouvement.sur}</b></div>${rangDePas(b.mouvement.reste, b.mouvement.sur)}</div>`}
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
    ...(e.liste ? [`<div id="liste" class="cadre bois" data-piece="liste"><div class="fond"><div class="t rubrique">${echapper(e.liste.titre)}</div>${e.liste.lignes.map((l, k) => (typeof l === 'string' ? plaque(echapper(l), { armee: k === e.liste.choisie, classe: 'ligne-l' }) : plaque(echapper(l.nom), { armee: k === e.liste.choisie, classe: 'ligne-l', prix: `${l.enSoute} en soute` }))).join('')}</div>${ferrures}</div>`] : []),
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
  /* une règle maison ; la pointée lit son aide, et la raison qui ferme les règles quand un combat les verrouille */
  const regleMaison = (verrou) => (r) => `<div class="regle ${r.aide ? 'pointee' : ''} ${r.modifiee ? 'modifiee' : ''}">
    <div class="t"><b data-texte="règle ${echapper(r.nom)}">${echapper(r.nom)}</b>${r.maison ? '<span class="ref rubrique">valeur maison</span>' : ''}</div>
    <div class="c">${r.modifiee ? `<span class="defaut rubrique">${picto('annuler', 12, '#6b1c10', 2)}Défaut</span>` : ''}${valeurDe(r, 118)}</div>
    ${r.aide ? `<p class="aide" data-texte="aide">${echapper(r.aide)}</p>` : ''}${r.action ? `<div class="action">${plaque(echapper(r.action), { armee: true, icone: 'etoile' })}</div>` : ''}${verrou && r.aide ? raison(echapper(verrou)) : ''}</div>`;
  const ecranDesOptions = (o) => {
    const { ouvert } = o;
    const domaine = o.domaines.find((d) => d.nom === ouvert.domaine);
    const modifiees = ouvert.gauche.concat(ouvert.droite).filter((r) => r.modifiee).length;
    return [fondDeTable(),
      cartouche({ icone: 'systeme', nom: echapper(o.titre.nom), sous: echapper(o.titre.sous), taille: 'titre', largeur: 392 }),
      `<div id="preferences" class="cadre bois" data-piece="préférences"><div class="fond bois">${o.son.map(pref).join('')}<div class="trait"></div>${o.jeu.map(pref).join('')}</div>${ruban('Préférences')}${ferrures}</div>`,
      signets(o.domaines.map((d) => ({ nom: echapper(d.nom), compte: d.regles, marque: !!d.modifiees })), echapper(ouvert.domaine)),
      `<div id="registre"${o.verrou ? ' class="verrou"' : ''} data-piece="registre"><div class="tranche"></div>
        <div class="feuille g parchemin">
          <div class="tete"><span class="dom gothique" data-texte="domaine">${echapper(domaine.nom)}</span><span class="sous rubrique">Règles maison · ${pluriel(domaine.regles, 'règle')}</span></div>
          ${filet({ losange: true })}${ouvert.gauche.map(regleMaison(o.verrou)).join('')}
          <div class="pied">${rond('gauche', 'petit', { ferme: ouvert.feuillet === 1 })}<span class="folio rubrique">Feuillet ${ouvert.feuillet} sur ${ouvert.feuillets}</span>${modifiees ? `<span class="marque">${sceau('plume', 'menu')}<i>${pluriel(modifiees, 'règle')} ${modifiees > 1 ? 'modifiées' : 'modifiée'}</i></span>` : ''}</div>
        </div>
        ${ouvert.droite.length ? `<div class="feuille d parchemin">
          <div class="tete"><span class="sous rubrique">${echapper(domaine.nom)}, suite</span><span class="sous rubrique">Règles ${ouvert.gauche.length + 1} à ${ouvert.gauche.length + ouvert.droite.length} sur ${domaine.regles}</span></div>
          ${filet({ losange: true })}${ouvert.droite.map(regleMaison(o.verrou)).join('')}
          <div class="pied"><span class="suite"><span class="rubrique">Feuillet suivant</span>${rond('droite', 'petit')}</span></div>
        </div>` : '<div class="feuille d parchemin"></div>'}
        ${CLOUS}</div>`,
      croix()];
  };

  /* ───────── le système : les sauvegardes, la fin de séance ───────── */
  /* un instant de la partie : sa date impériale, son heure ; le lieu en tête */
  const dateDe = (i) => `${i.jour} ${echapper(i.mois)} ${i.annee} CI`;
  const instantDe = (i) => `${echapper(i.lieu)} · ${dateDe(i)} · ${i.heure}`;
  /* les sauvegardes : un feuillet par emplacement, ce que la sauvegarde porte ; « Charger » si plein, « Sauvegarder » sur
     un emplacement manuel, fermé avec sa raison ; l'avis d'un emplacement retiré */
  const emplacementDe = (s) => (e) => `<div class="feuillet cadre bois${e.vise ? ' vise' : ''}${e.partie ? '' : ' vide'}"><div class="fond parchemin">
    ${e.partie ? `<div class="lieu gothique" data-texte="lieu ${echapper(e.partie.instant.lieu)}">${echapper(e.partie.instant.lieu)}</div><div class="date rubrique">${dateDe(e.partie.instant)} · ${e.partie.instant.heure}</div>
      ${filet({ losange: true })}<div class="reel chiffres">Sauvegardée le ${e.partie.le.date} ${e.partie.le.heure}</div>`
    : `<div class="blanc">${filet({ losange: true })}<em>— vide —</em>${filet({ losange: true })}</div>`}
    <div class="gestes">${e.partie ? plaque('Charger', { armee: !!e.vise }) : ''}${e.auto ? '' : s.refus ? plaque(`Sauvegarder${e.survol ? raison(echapper(s.refus)) : ''}`, { fermee: true }) : plaque('Sauvegarder')}</div>
  </div>${ruban(echapper(e.nom))}${ferrures}</div>`;
  const sauvegardes = (s) => [fondDeTable(),
    cartouche({ icone: 'disque', nom: echapper(s.titre.nom), sous: instantDe(s.titre.instant), taille: 'titre', largeur: 430 }), croix(),
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
    <div class="tete">${portrait(h.id)}<div class="qui"><div class="n gothique" data-texte="héros ${echapper(h.nom)}">${echapper(h.nom)}</div><div class="c rubrique">${echapper(h.carriere)}</div></div>${gainDeLaSeance(s, h)}</div>
    ${blocDeSeance('Motivation', `Détermination ${h.determination.n} / ${h.determination.sur}`, `${ecritDe(h.motivation)}${caseDeMotivation(h)}`)}
    ${ambitionDe(s, h, 'courte')}${ambitionDe(s, h, 'longue')}
  </div>${ferrures}</div>`;
  /* la fin de séance, sur le jeu assombri : un feuillet par héros, le groupe, l'action de coin ; la croix referme sans
     rien octroyer */
  const finDeSeance = (f) => [
    cartouche({ icone: 'plume', nom: echapper(f.titre.nom), sous: instantDe(f.titre.instant), taille: 'titre', largeur: 430 }), croix(),
    `<div id="feuillets" data-piece="héros">${f.seance.heros.map(feuilletDeSeance(f.seance)).join('')}</div>`,
    `<div id="groupe" class="cadre bois" data-piece="groupe"><div class="fond bois"><div class="cases">${casesDuGroupe(f.seance)}</div><p data-texte="chance">${echapper(f.seance.chance)}</p></div>${ruban('Le groupe')}${ferrures}</div>`,
    `<div class="action-de-coin" data-piece="terminer">${plaque(echapper(f.action), { armee: true })}</div>`,
  ];

  /* ───────── l'ouverture ───────── */
  /* un instant de la partie, son lieu en petites capitales */
  const lieuEtInstant = (i) => `<span class="rubrique">${echapper(i.lieu)}</span> · ${dateDe(i)} · ${i.heure}`;
  /* le grand titre libre : son sur-titre, son nom en gothique dorée s'il en a un, ce qui le suit */
  const titreLibre = (id, sur, nom, suite) => `<div id="${id}" class="titre-libre" data-piece="titre"><div class="sur rubrique ombre">${echapper(sur)}</div>${nom ? `<div class="nom gothique" data-texte="titre">${echapper(nom)}</div>` : ''}${suite}</div>`;
  const plaqueDEntree = (e) => plaque(echapper(e.libelle), { armee: !!e.principale, icone: e.id, taille: 'appel' });
  /* l'écran titre : le titre, les entrées de jeu (la dernière sauvegarde sous la principale, qu'elle charge), les outils */
  const accueil = (a) => [
    titreLibre('blason', a.titre.sur, a.titre.nom, `${filet({ losange: true, or: true })}<div class="campagne gothique ombre">${echapper(a.titre.campagne)}</div>`),
    `<div id="entrees" data-piece="entrées">${a.entrees.map((e) => `${plaqueDEntree(e)}${e.principale ? `<div class="dernier ombre">${lieuEtInstant(a.derniere)}</div>` : ''}`).join('')}</div>`,
    `<div id="outils" data-piece="outils">${a.outils.map((o) => outil(o.id, echapper(o.libelle), { taille: 'grand' })).join('')}</div>`,
  ];
  /* le menu de la partie : le titre et l'instant, les entrées, la sortie sous un trait, la pastille du système */
  const menuDeLaPartie = (m) => [
    titreLibre('pause', m.titre.sur, m.titre.nom, `${filet({ losange: true, or: true })}<div class="ou ombre">${lieuEtInstant(m.instant)}</div>`),
    `<div id="entrees" data-piece="entrées">${m.entrees.map(plaqueDEntree).join('')}<div class="trait"></div>${plaqueDEntree(m.quitter)}<div class="dernier ombre">Dernière sauvegarde automatique à ${m.derniereAuto}.</div></div>`,
    `<div id="pastille" data-piece="système">${rond('systeme', 'grand', { arme: true })}</div>`,
  ];
  /* la clôture d'un chapitre : son sous-titre, ce que la route retiendra (les objectifs soldés, les PX), les lieux révélés,
     les héros tombés */
  const bande = (titre, droite = '') => `<div class="bande rubrique ombre"><span>${titre}</span>${droite}</div>`;
  const solde = (texte, k) => `<div class="solde">${rond('coche', 'menu', { arme: true })}<span class="ombre" data-texte="objectif ${k + 1}">${echapper(texte)}</span></div>`;
  const clotureDe = (c) => `<p class="ombre" data-texte="sous-titre">${echapper(c.sous)}</p>
    ${bande('Ce que la route retiendra', `<b class="chiffres">+${c.px} PX</b>`)}${c.objectifs.map(solde).join('')}
    <div class="deux"><div>${bande('Lieux révélés')}<p class="ombre" data-texte="lieux">${c.lieux.map(echapper).join(' · ')}</p></div>
      <div>${bande('Tombés en chemin')}<p class="ombre" data-texte="tombés">${c.tombes.length ? c.tombes.map(echapper).join(' · ') : 'Aucune perte : la compagnie est entière.'}</p></div></div>`;
  /* la fin de séance que la clôture ouvre : une colonne par héros, ses trois cases ; celle du groupe */
  const colonneDeSeance = (s) => (h) => `<div class="col"><div class="tete">${portrait(h.id, { taille: 'petit' })}<div class="qui"><div class="n gothique" data-texte="héros ${echapper(h.nom)}">${echapper(h.nom)}</div><div class="c rubrique">${echapper(h.carriere)}</div></div>${gainDeLaSeance(s, h)}</div>
    ${caseDeMotivation(h)}${caseDAmbition(s, h, 'courte')}${caseDAmbition(s, h, 'longue')}</div>`;
  const seanceDuChapitre = (s) => `<div id="seance" class="cadre bois" data-piece="fin de séance"><div class="fond bois">${s.heros.map(colonneDeSeance(s)).join('')}
    <div class="col groupe"><div class="tete"><div class="qui"><div class="n gothique">Le groupe</div><div class="c rubrique" data-texte="chance">${echapper(s.chance)}</div></div></div>${casesDuGroupe(s)}</div>
  </div>${ruban('Fin de séance')}${ferrures}</div>`;
  /* le chapitre qui s'ouvre (la campagne, le texte du chapitre, la compagnie au bandeau) ou se clôt (sa clôture, la fin de
     séance) ; ses gestes en action de coin */
  const chapitre = (c) => [
    titreLibre('carton', c.sur, c.campagne?.nom, `${c.campagne ? `<div class="tome gothique ombre">${echapper(c.campagne.tome)}</div>` : ''}
      <div class="toile-ombre"><div class="toile"><span class="gothique" data-texte="chapitre">${echapper(c.chapitre)}</span></div></div>
      ${(c.texte ?? []).map((p, k) => `<p class="ombre" data-texte="texte ${k + 1}">${echapper(p)}</p>`).join('')}${c.cloture ? clotureDe(c.cloture) : ''}`),
    ...(c.groupe ? [bandeauDu(c.groupe, undefined, 'La compagnie')] : []),
    ...(c.cloture ? [seanceDuChapitre(c.cloture.seance)] : []),
    `<div class="action-de-coin" data-piece="gestes">${c.gestes.map((g) => plaque(echapper(g.libelle), { armee: !!g.principal })).join('')}</div>`,
  ];

  /* la nouvelle partie, dans la salle commune : recruter (l'onglet, les voyageurs dans la salle, en créer, en importer) ;
     les voyageurs debout, chacun sous son poste, « Recruter » au pied du visé ; les campagnes clouées au panneau, la
     choisie en affiche ; le groupe au bandeau, la place libre */
  const PICTO_DE_LA_CAMPAGNE = { route: 'route', fleuve: 'ancre', arene: 'epee', enquete: 'plume' };
  /* les voyageurs se rangent entre le panneau de recrue et celui des campagnes, en quinconce s'ils sont trop serrés */
  const SALLE = { gauche: 420, droite: 860, haut: 116, quinconce: 160, serre: 170 };
  const placesDesVoyageurs = (n) => {
    const pas = n > 1 ? (SALLE.droite - SALLE.gauche) / (n - 1) : 0, serres = pas < SALLE.serre;
    return Array.from({ length: n }, (_, k) => [n > 1 ? SALLE.gauche + k * pas : (SALLE.gauche + SALLE.droite) / 2, SALLE.haut + (serres && k % 2 ? SALLE.quinconce : 0)]);
  };
  const recruter = (n) => cadre('rail', null, null, null, null, 'bois', `<div class="deux">${plaque('Pré-tirés', { armee: n.onglet === 'pretires' })}${plaque('Mes personnages', { armee: n.onglet === 'roster' })}</div>
    <div class="pied rubrique">${pluriel(n.salle.voyageurs.length, n.onglet === 'roster' ? 'personnage' : 'voyageur')} dans la salle, sur ${n.salle.total}</div>
    <div class="tourne">${rond('gauche', 'petit')}<span class="rubrique">D’autres voyageurs</span>${rond('droite', 'petit')}</div>
    <div class="trait"></div>${plaque('Créer un personnage', { icone: 'plume', classe: 'gauche' })}${plaque('Importer un personnage…', { icone: 'disque', classe: 'gauche' })}`, { ruban: 'Recruter' });
  const salleDe = (n) => {
    const places = placesDesVoyageurs(n.salle.voyageurs.length);
    return `<div id="salle">${n.salle.voyageurs.map((v, k) => { const [cx, y] = places[k];
      return `${poste(cx, y, { nom: echapper(v.nom), sous: echapper(v.carriere), heros: v.id, vise: !!v.vise, piece: `voyageur ${v.id}` })}${v.vise ? `<div id="recruter" data-piece="recruter" style="left:${cx - 75}px;top:${y + 100}px">${plaque('Recruter', { armee: true, icone: 'plus', taille: 'petite' })}${n.onglet === 'roster' ? `<div class="du-roster">${outil('disque', 'Exporter')}${outil('croix', 'Supprimer')}</div>` : ''}</div>` : ''}`; }).join('')}</div>`;
  };
  const avisDe = (c) => `<div class="avis parchemin"><i class="clou"></i>${picto(PICTO_DE_LA_CAMPAGNE[c.genre], 17, '#5a2a12', 1.6)}<b class="gothique" data-texte="campagne ${echapper(c.nom)}">${echapper(c.nom)}</b></div>`;
  const campagnesDe = (n) => cadre('campagnes', null, null, null, null, 'bois', `<div class="affiche parchemin"><i class="clou" style="left:14px"></i><i class="clou" style="right:14px"></i>
      <div class="sur rubrique">${echapper(n.campagne.sur)}</div><div class="n gothique" data-texte="campagne">${echapper(n.campagne.nom)}</div><div class="ch rubrique">${echapper(n.campagne.chapitre)}</div>
      ${filet({ losange: true })}<p data-texte="description">${echapper(n.campagne.texte)}</p>${plaque('Lancer', { armee: true, icone: 'route' })}<div class="cachet">${sceau(PICTO_DE_LA_CAMPAGNE[n.campagne.genre], 'moyen')}</div></div>
    <div class="avis-cloues">${n.campagnes.map(avisDe).join('')}</div>`, { ruban: 'Campagnes' });
  const renvoi = (modifier) => `<div class="renvoi"><span>${picto('croix', 11, undefined, 1.8)}<span class="rubrique">Renvoyer</span></span>${modifier ? `<span>${picto('plume', 12, undefined, 1.6)}<span class="rubrique">Modifier</span></span>` : ''}</div>`;
  const placeLibre = (l) => (l.siege ? { html: `<div class="siege"><span class="rubrique">Siège</span>${segments(l.siege.valeurs.map(echapper), echapper(l.siege.valeurs[l.siege.tenue]))}</div>` } : { texte: echapper(l.dit) });
  const nouvellePartie = (n) => [
    cartouche({ icone: 'chope', nom: echapper(n.titre.nom), sous: `${echapper(n.titre.sous)} · ${n.titre.places.n} sur ${n.titre.places.sur}`, taille: 'titre', largeur: 392 }), croix(),
    recruter(n), salleDe(n), campagnesDe(n),
    bandeau({ ...Object.fromEntries(n.groupe.map((h) => [h.id, { html: renvoi(n.modifier) }])), libre: placeLibre(n.libre) },
      { groupe: [...n.groupe.map((h) => ({ id: h.id, nom: echapper(h.nom), car: echapper(h.carriere) })), { nom: echapper(n.libre.nom), car: echapper(n.libre.sous) }] }),
  ];

  /* ───────── les outils ───────── */
  /* la prose d'une donnée, son gras Markdown rendu ; au champ de l'atelier, telle qu'elle s'écrit */
  const prose = (t) => echapper(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  /* le Compendium, registre relié : la famille ouverte au signet, ses catégories, la recherche et les livres sur le volet ;
     la catégorie au feuillet de gauche ; l'entrée pointée, en fiche ou à l'atelier, posée par-dessus le registre avec sa
     croix (`../dispositions.md`, « Dans 1280 × 720 ») */
  const sourceDe = (e) => `${echapper(e.source.livre)} p. ${e.source.page}`;
  const liensDe = (noms, reste = 0) => `<div class="liens">${noms.map((n) => `<span class="lien">${echapper(n)}</span>`).join('')}${reste ? `<span class="lien reste">et ${reste} autres</span>` : ''}</div>`;
  const renvoiDe = (r) => `<div class="r rubrique">${echapper(r.rubrique)} <em>${r.compte}</em></div>${liensDe(r.noms, r.compte - r.noms.length)}`;
  const ficheDe = (c, e) => `<div class="feuille parchemin">
    <div class="tete"><span class="dom gothique" data-texte="entrée">${echapper(e.nom)}</span><span class="sous rubrique">${echapper(c.genre)} · ${sourceDe(e)}</span></div>${filet({ losange: true })}
    <div class="fiche"><div class="puces">${c.fiche.puces.map((p) => `<div class="puce"><span class="rubrique">${echapper(p.rubrique)}</span>${echapper(p.valeur)}</div>`).join('')}</div>
      <div class="r rubrique">Description</div>${c.fiche.description.map((p, k) => `<p data-texte="description ${k + 1}">${prose(p)}</p>`).join('')}${liensDe(c.fiche.liens)}${c.fiche.renvois.map(renvoiDe).join('')}</div>
    <div class="pied">${plaque('Modifier', { icone: 'plume', taille: 'petite' })}<span class="marque"><i>Atelier : ${echapper(c.categorie)}</i></span></div></div>`;
  const champDe = (f) => `<div>${champ(echapper(f.libelle), echapper(f.valeur).replace(/\n/g, '<br>'), { classe: `${f.long ? 'long' : ''}${f.saisi ? ' saisi' : ''}`, defile: !!f.long })}${f.aide ? `<div class="aide">${echapper(f.aide.texte)}${f.aide.lien ? ` <span class="lien">${echapper(f.aide.lien)}</span>` : ''}</div>` : ''}</div>`;
  const atelierDe = (c, e) => `<div class="feuille parchemin atelier">
    <div class="tete"><span class="dom gothique" data-texte="entrée">${echapper(e.nom)}</span><span class="sous rubrique">Atelier : ${echapper(c.categorie)}</span></div>${filet({ losange: true })}
    <div class="fiche">${c.atelier.paires.map((p) => `<div class="${p.length > 1 ? 'deux' : 'un'}">${p.map(champDe).join('')}</div>`).join('')}
      <div class="r rubrique">Champs que l’entrée ne porte pas</div><div class="facettes">${c.atelier.absents.map((n) => `<b>Ajouter : ${echapper(n)}</b>`).join('')}</div></div>
    <div class="pied">${plaque('Enregistrer', { icone: 'disque', armee: true, taille: 'petite' })}${plaque('Abandonner', { taille: 'petite' })}${plaque(`Supprimer${raison(echapper(c.atelier.refus))}`, { fermee: true, taille: 'petite' })}</div></div>`;
  const compendium = (c) => {
    const pointee = c.feuillet.entrees.find((e) => e.pointee), ouverte = c.categories.find((k) => k.nom === c.categorie);
    return [fondDeTable(),
      cartouche({ icone: 'livre', nom: echapper(c.titre.nom), sous: echapper(c.titre.sous), taille: 'titre', largeur: 392 }),
      `<div id="categories" class="cadre bois" data-piece="catégories"><div class="fond bois">
        <div>${c.categories.map((k) => ligneDeListe(echapper(k.nom), k.entrees, { la: k.nom === c.categorie })).join('')}</div><div class="trait"></div>
        ${champ('Rechercher', echapper(c.recherche), { attente: 'Un nom, un mot de la fiche…' })}
        <div class="r rubrique">Livre</div><div class="facettes">${c.livres.map((l) => `<b>${echapper(l.sigle)}<em>${l.entrees}</em></b>`).join('')}</div><div class="trait"></div>
        ${plaque('Nouvelle entrée', { icone: 'plus', fermee: !!c.atelier })}</div>${ruban('Catégories')}${ferrures}</div>`,
      signets(c.familles.map((nom) => ({ nom: echapper(nom) })), echapper(c.famille)),
      `<div id="registre" data-piece="registre"><div class="tranche"></div>
        <div class="feuille g parchemin"><div class="tete"><span class="dom gothique" data-texte="catégorie">${echapper(c.categorie)}</span><span class="sous rubrique">${pluriel(ouverte.entrees, 'entrée')}</span></div>
          ${filet({ losange: true })}${c.feuillet.entrees.map((e) => `<div class="entree${e.pointee ? ' pointee' : ''}"><span>${echapper(e.nom)}</span><em class="chiffres">${sourceDe(e)}</em></div>`).join('')}
          <div class="pied">${rond('gauche', 'petit', { ferme: c.feuillet.n === 1 })}<span class="folio rubrique">Feuillet ${c.feuillet.n} sur ${c.feuillet.sur}</span>${rond('droite', 'petit', { ferme: c.feuillet.n === c.feuillet.sur })}</div></div>
        <div class="feuille d parchemin"></div>${CLOUS}
        <div id="posee" class="cadre bois">${(c.atelier ? atelierDe : ficheDe)(c, pointee)}${croix({ dansLePanneau: true })}${ferrures}</div></div>`,
      croix()];
  };
  /* la coop, sur la table : la tablée et ses quatre sièges, chacun son joueur et les héros qu'il tient ; sans partie,
     rejoindre par le code et héberger ; en salon, l'invitation et l'attribution des héros et du Maître du Jeu */
  const siegeDe = (s) => (s.joueur
    ? `<div class="siege bois${s.joueur.vous ? ' vous' : ''}${s.joueur.absent ? ' absent' : ''}"><div class="q">${s.joueur.absent ? sceau('reseau') : medaillon('personnage', { taille: 'moyen' })}<div><b class="gothique" data-texte="siège ${echapper(s.joueur.nom)}">${echapper(s.joueur.nom)}</b><span class="rubrique">${echapper(s.joueur.qualite)}</span></div></div>
      <div class="tient">${s.heros.length ? s.heros.map((h) => portrait(h, { taille: 'petit' })).join('') : '<i>Aucun héros</i>'}</div></div>`
    : '<div class="siege vide"><div class="q"><div><b>Un siège à pourvoir</b></div></div></div>');
  const tableeDe = (c) => `<div id="tablee" data-piece="tablée">${tableDuSalon()}${c.sieges.map(siegeDe).join('')}<div class="legende rubrique ombre">${echapper(c.legende)}</div></div>`;
  const feuilletCoop = (id, titre, corps) => `<div id="${id}" class="feuillet-coop cadre bois" data-piece="${id}"><div class="fond parchemin">${corps}</div>${ruban(titre)}${ferrures}</div>`;
  /* un joueur, nommé de ce qu'il est : vous, ou l'hôte ; connecté, ou en reconnexion */
  const nomDuJoueur = (j) => `${echapper(j.nom)}${j.vous ? ' (vous)' : j.hote ? ' · hôte' : ''}`;
  const joueurDe = (j) => (j.absent ? `<div class="joueur absent">${sceau('reseau', 'menu')}${nomDuJoueur(j)} — reconnexion…</div>` : `<div class="joueur"><i class="pt"></i>${nomDuJoueur(j)}</div>`);
  const coop = (c) => [fondDeTable(),
    cartouche({ icone: 'reseau', nom: echapper(c.titre.nom), sous: echapper(c.titre.sous), taille: 'titre', largeur: 392 }),
    ...(c.rejoindre ? [feuilletCoop('rejoindre', 'Rejoindre une partie', `<label class="champ"><span class="rubrique">Code de la partie</span><div class="cases gothique">${[...c.rejoindre.code].map((x) => `<b>${echapper(x)}</b>`).join('')}</div></label>
      <div class="indice">${echapper(c.rejoindre.indice)}</div>${champ('Votre nom', echapper(c.rejoindre.nom))}${plaque(echapper(c.rejoindre.geste), { armee: true, icone: 'reseau' })}`)] : []),
    ...(c.invitation ? [cadre('invitation', null, null, null, null, 'bois', `<div class="code parchemin gothique" data-texte="code">${echapper(c.invitation.code)}</div>
      <div class="r rubrique">Joueurs connectés</div><div>${c.invitation.joueurs.map(joueurDe).join('')}</div><div class="trait"></div>${plaque(echapper(c.invitation.quitter), { icone: 'sortie' })}`, { ruban: 'Inviter — partagez le code' })] : []),
    tableeDe(c),
    ...(c.heberger ? [feuilletCoop('heberger', 'Héberger une partie', `<p data-texte="aide">${echapper(c.heberger.aide)}</p>${champ('Votre nom', '', { attente: echapper(c.heberger.attente) })}
      ${plaque(echapper(c.heberger.geste), { fermee: true })}<div class="refus">${sceau('disque', 'menu')}<span>${echapper(c.heberger.refus)}</span></div>`)] : []),
    ...(c.attribution ? [cadre('attribution', null, null, null, null, 'parchemin', `${c.attribution.heros.map((h) => rang(h.id, { nom: echapper(h.nom), gothique: true, sous: echapper(h.carriere), fin: segments(c.attribution.joueurs.map(echapper), echapper(h.joueur)) })).join('')}
      <div class="mj"><div class="r"><b class="gothique">Maître du Jeu</b><i>${echapper(c.attribution.maitre.note)}</i></div>${segments([c.attribution.maitre.sans, ...c.attribution.joueurs].map(echapper), echapper(c.attribution.maitre.joueur ?? c.attribution.maitre.sans))}</div>`, { ruban: 'Attribution des héros' })] : []),
    croix()];

  /* ───────── l'éditeur ───────── */
  /* la barre : le projet, les documents, les gestes par groupe ; seul le principal garde son libellé à 1280, les autres
     leur pictogramme (`../dispositions.md`, « Outil d'édition ») ; la croix au bout */
  const gesteDeLaBarre = (g) => (g.principal ? plaque(echapper(g.libelle), { icone: g.id, armee: true, taille: 'petite' })
    : plaque('', { icone: g.id, fermee: !!g.ferme, taille: 'petite', classe: 'seule' }));
  const barreDe = (e) => `<div id="barre" class="cadre bois" data-piece="barre"><div class="fond bois">${medaillon('plume', { taille: 'moyen', inerte: true })}
    <div><div class="nom gothique" data-texte="titre">${echapper(e.projet.nom)}</div><div class="s rubrique">${echapper(e.projet.sous)}</div></div><div class="sep"></div>
    ${segments(e.documents.map(echapper), echapper(e.document))}<div class="espace"></div>
    ${e.gestes.map((g) => g.map(gesteDeLaBarre).join('')).join('<div class="sep"></div>')}${croix({ dansLePanneau: true })}</div>${ferrures}</div>`;
  /* les volets de gauche, une seule colonne en onglets : l'ouvert et son contenu */
  const voletsDe = (e, contenu) => cadre('volets', null, null, null, null, 'bois', contenu, { tete: onglets(e.volets.map(echapper), echapper(e.volet)) });
  const outilDePalette = (e) => (o) => `<div class="o${o.id === e.outil ? ' la' : ''}">${picto(o.id, 20, o.id === e.outil ? '#2a1a08' : '#e2c06a', 1.5)}<span>${echapper(o.libelle)}</span></div>`;
  const paletteDe = (e) => `<div class="outils">${e.outils.map(outilDePalette(e)).join('')}</div>`;
  const validationDe = (v) => `<div class="r rubrique">Validation</div><div class="valide">${picto('coche', 15, '#3d5a1c', 2.2)}<span>${echapper(v)}</span></div>`;
  const renvoiDeLaLogique = (nom) => `<div class="renvoi">${echapper(nom)}${picto('droite', 14, '#5a4530', 2)}</div>`;
  const VALEURS_DE_PROPRIETE = {
    texte: (p) => `<span class="v">${echapper(p.texte)}</span>`,
    valeurs: (p) => segments(p.valeurs.map(echapper), echapper(p.valeurs[p.tenue])),
    oui: (p) => ouiNon(p.oui),
    defile: (p) => `<span class="pas-a-pas">${picto('gauche', 13, '#5a4530', 2)}<b class="rubrique">${echapper(p.defile)}</b>${picto('droite', 13, '#5a4530', 2)}</span>`,
    nombre: (p) => moinsPlus({ entre: `<b class="copies">${p.nombre}</b>` }),
  };
  const proprieteDe = (p) => `<div class="prop${p.grise ? ' gris' : ''}"><span>${echapper(p.libelle)}</span>${VALEURS_DE_PROPRIETE[Object.keys(VALEURS_DE_PROPRIETE).find((k) => k in p)](p)}</div>`;
  /* l'inspecteur : ce qui est choisi, ou les options de l'outil armé ; la validation au pied */
  const inspecteurDe = (i, validation) => `<h3 class="gothique" data-texte="choisi">${echapper(i.genre)}</h3><div class="sous rubrique">${echapper(i.ou ?? i.options)}</div><div class="trait"></div>
    ${'terrains' in i ? `<div class="r rubrique">Pinceau</div><div class="pinceau">${segments(i.pinceaux.valeurs.map(echapper), echapper(i.pinceaux.valeurs[i.pinceaux.tenue]))}</div>
      <div class="r rubrique">Terrains</div><div class="terrains">${i.terrains.map((n) => `<b class="${n === i.terrain ? 'la' : ''}">${echapper(n)}</b>`).join('')}</div>`
    : `${i.nom ? champ('Nom', echapper(i.nom)) : ''}${i.proprietes.map(proprieteDe).join('')}
      ${i.inventaire ? `<div class="r rubrique">Inventaire</div><div class="prop gris"><span>${echapper(i.inventaire.vide)}</span></div>${plaque(echapper(i.inventaire.ajouter), { icone: 'plus', taille: 'petite' })}` : ''}
      ${i.troupe ? `<div class="r rubrique">Poser une troupe</div>${i.troupe.map(proprieteDe).join('')}` : ''}
      ${i.renvois.rubrique ? `<div class="r rubrique">${echapper(i.renvois.rubrique)}</div>` : ''}${i.renvois.noms.map(renvoiDeLaLogique).join('')}
      ${i.supprimer ? `<div class="au-pied">${plaque(echapper(i.supprimer), { icone: 'croix', taille: 'petite' })}</div>` : ''}`}
    ${validation ? validationDe(validation) : ''}`;
  const inspecteur = (corps) => cadre('inspecteur', null, null, null, null, 'parchemin', corps, { ruban: 'Inspecteur' });
  const PICTO_DU_POINTE = { selection: 'selection', terrain: 'terrain' };
  /* l'éditeur de scène : le volet des scènes ou la palette, le plan quadrillé et ses couches, le pied, l'inspecteur */
  const editeurDeScene = (e) => [fondDeTable(), barreDe(e),
    voletsDe(e, e.volet === e.volets[0] ? `${e.scenes.noms.map((n) => ligneDeListe(echapper(n), '', { la: n === e.scenes.ouverte })).join('')}
      <div class="gestes">${e.scenes.gestes.map((g, k) => plaque(echapper(g), { icone: k ? null : 'plus', taille: 'petite' })).join('')}</div>` : paletteDe(e)),
    `<div id="plan" class="cadre bois" data-piece="plan"><div class="fond">${planDeScene(e.plan)}</div>
      <div id="couches">${e.couches.noms.map((n, k) => plaque(echapper(n), { armee: k === e.couches.tenue, icone: k === e.couches.tenue ? 'couches' : null, taille: 'petite' })).join('')}${plaque(echapper(e.couches.ajouter), { icone: 'plus', taille: 'petite' })}${e.couches.retirer ? plaque(`${echapper(e.couches.retirer.libelle)}${raison(echapper(e.couches.retirer.refus))}`, { fermee: true, taille: 'petite' }) : ''}</div>
      <div id="nord" class="rubrique ombre">${picto('route', 18)}Nord : ${e.nord}° dans le sens horaire</div>${ferrures}</div>`,
    `<div id="pied" class="bois" data-piece="pied">${picto(PICTO_DU_POINTE[e.outil], 16)}<span data-texte="pointé">${e.pointe.map(echapper).join(' · ')}</span><span class="v">${e.taille.cases[0]} × ${e.taille.cases[1]} cases · ${pluriel(e.taille.entites, 'entité')}</span></div>`,
    inspecteur(inspecteurDe(e.inspecteur, e.validation))];
  /* l'éditeur de la carte du monde : les lieux, les routes ou la palette ; la carte ; l'inspecteur du lieu choisi */
  const editeurDeLaCarte = (e) => {
    const lieu = (id) => e.lieux.find((l) => l.id === id), choisi = lieu(e.choisi), sesRoutes = e.routes.filter((r) => r.de === e.choisi || r.vers === e.choisi);
    const depuis = `Depuis ${echapper(choisi.nom)}`;
    const VOLETS = [
      () => e.lieux.map((l) => ligneDeListe(echapper(l.nom), '', { la: l.id === e.choisi, icone: 'epingle' })).join(''),
      () => `<div id="routes">${e.routes.map((r) => ligneDeListe(`${echapper(lieu(r.de).nom)} – ${echapper(lieu(r.vers).nom)}<small>${r.km} km · ${r.modes.map(echapper).join(', ')}</small>`)).join('')}</div>`,
      () => paletteDe(e),
    ];
    return [fondDeTable(), barreDe(e),
      voletsDe(e, VOLETS[e.volets.indexOf(e.volet)]()),
      `<div id="plan" class="cadre bois" data-piece="plan"><div class="fond parchemin">${carteDeLEditeur({ titre: echapper(e.carte), lieux: e.lieux.map((l) => ({ nom: echapper(l.nom), genre: l.genre, place: l.place, choisi: l.id === e.choisi })), routes: e.routes.map((r) => ({ de: e.lieux.indexOf(lieu(r.de)), vers: e.lieux.indexOf(lieu(r.vers)), km: r.km })) })}</div>${ferrures}</div>`,
      `<div id="pied" class="bois" data-piece="pied">${picto('epingle', 16)}<span>${pluriel(e.lieux.length, 'lieu')} · ${pluriel(e.routes.length, 'route')} · Modes : ${[...new Set(e.routes.flatMap((r) => r.modes))].map(echapper).join(', ')}</span></div>`,
      inspecteur(`<h3 class="gothique" data-texte="choisi">Lieu</h3><div class="sous rubrique">${echapper(e.document)} · ${e.lieu.coordonnees.join(', ')}</div><div class="trait"></div>
        ${champ('Nom', echapper(choisi.nom))}<div class="prop"><span>Scène</span>${VALEURS_DE_PROPRIETE.defile({ defile: e.lieu.scene })}</div>
        <div class="r rubrique">Plan du lieu</div><div class="plan-du-lieu">${echapper(e.lieu.plan)}</div>
        <div class="r rubrique">Établissements (${e.lieu.etablissements})</div>${plaque('Ajouter un établissement', { icone: 'plus', taille: 'petite' })}
        <div class="r rubrique">Routes (${sesRoutes.length})</div>${sesRoutes.map((r) => `<div class="prop"><span>${echapper(lieu(r.de === e.choisi ? r.vers : r.de).nom)}</span><span class="v chiffres">${r.km} km</span></div>
          <div class="prop sens"><span>Sens</span>${segments(['Les deux sens', depuis], r.deuxSens ? 'Les deux sens' : depuis)}</div>`).join('')}
        ${e.validation ? validationDe(e.validation) : ''}`)];
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
  const ditDe = (d) => ('attend' in d ? { html: `<span class="attend${d.sombre ? ' sombre' : ''} rubrique">${echapper(d.attend)}</span>` }
    : d.mal ? { texte: echapper(d.texte), icone: 'goutte', mal: true } : { texte: echapper(d.texte), icone: PICTO_DU_ROLE[d.id] });
  /* le groupe du bandeau ; ses bourses, quand le lieu les montre ; le titre de son ruban */
  const bandeauDu = (groupe, html = () => '', titre = '') => bandeau(Object.fromEntries(groupe.map((h) => { const d = h.dit ? ditDe(h.dit) : {}; return [h.id, { ...d, choisi: !!h.choisi, html: `${d.html ?? ''}${html(h)}` }]; })),
    { groupe: groupe.map((h) => ({ id: h.id, nom: echapper(h.nom), car: echapper(h.carriere), pv: h.blessures, max: h.max, bourse: h.bourse === undefined ? '' : prix(h.bourse) })), bourses: groupe.some((h) => h.bourse !== undefined), ruban: titre });
  /* le jour d'un voyage, compté selon ce qu'on y fait */
  const NOM_DU_JOUR = { route: 'de route', fleuve: 'de descente', traversee: 'en mer', mer: 'en mer', bord: 'en mer' };
  const jourDe = (n, decor) => `${n === 1 ? '1ᵉʳ' : `${n}ᵉ`} jour ${NOM_DU_JOUR[decor]}`;
  /* le titre d'un lieu : sa journée en voyage, ou son nom et ce qu'on y vit */
  const titreDu = (t, decor) => ('jour' in t
    ? temps({ teinte: t.lumiere, jour: echapper(t.jour), date: `${t.date.jour} ${echapper(t.date.mois)} · ${jourDe(t.jourDeVoyage, decor)}`, meteo: echapper(t.meteo.ciel), icone: PICTO_DU_TEMPS[t.meteo.temps], cadence: t.cadence ?? null })
    : cartouche({ icone: 'botte', nom: echapper(t.nom), sous: echapper(t.sous), taille: 'titre', largeur: 436 }));
  /* la carte du trajet, et l'eau qui la traverse selon le décor */
  const EAU_DU_DECOR = { route: 'fleuve', relais: 'fleuve', fleuve: 'fleuve-voie', traversee: 'mer', mer: 'mer' };
  const trajetDu = (t, decor) => carteDuTrajet({ titre: echapper(t.titre), de: echapper(t.de), vers: echapper(t.vers), part: t.part, eau: EAU_DU_DECOR[decor] });
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
      ${ligneDu('Cargaison en cale', p.cargaison === null ? 'pillée' : `${p.cargaison} Enc`)}${ligneDu('Pillage, si soumission', `${p.pillage} %`)}`, { ruban: 'La sommation', classe: 'bord' }),
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
    reste: `Distance <b class="gothique">${f.distance}</b>${f.ecart ? ` · le navire creuse l’écart, ${signe(f.ecart)}` : ''}` });
  /* la frise du trajet : d'où, vers où, les nuits passées en route, ce qui reste */
  const friseDuTrajet = (f) => frise({ part: f.part, bornes: [echapper(f.de), echapper(f.vers)], trace: '#b9412c', nuits: f.nuits, reste: `<b class="gothique">${f.reste}</b> ${f.unite} avant ${echapper(f.vers)}` });
  /* la Chance qui reste à ceux qui ont lancé un jet, au pied de son billet (LDB 17 l.23-24) */
  const chanceDu = (r) => `<div class="pied"><div class="chance"><span class="rubrique">Chance</span>${reserves(r)}</div></div>`;
  /* l'aperçu du Test d'équipage joué : chaque poste, son DR, la somme ; la Chance de ceux qui l'ont lancé */
  const apercuDuTest = (a) => `<div id="apercu-test">${apercu({ nom: echapper(a.nom), sous: echapper(a.test), vers: 'bas', corps: `<table>${a.lignes.map((l) => `<tr><td>${echapper(qui(l.qui).nom)}, ${echapper(l.poste)}</td><td>${signe(l.dr)} DR${l.double ? ' ×2' : ''}</td></tr>`).join('')}
    <tr class="somme"><td>Somme</td><td>${signe(a.lignes.reduce((t, l) => t + l.dr * (l.double ? 2 : 1), 0))} DR</td></tr></table>${a.chance ? chanceDu(a.chance.map((c) => [c.valeur, prenomDe(c.qui)])) : ''}` })}</div>`;
  const poursuite = (p) => [
    titreDu(p.titre, p.decor), recitDu(p.recit),
    ...(p.trajet ? [trajetDu(p.trajet, p.decor)] : []),
    PANNEAUX[p.panneau.role](p.panneau),
    ...(p.frise ? [friseDu(p.frise)] : []), ...(p.apercu ? [apercuDuTest(p.apercu)] : []),
    ...(p.postes ? [ouvrir(echapper(p.postes), 'cordage', 428)] : []),
    ...(p.fenetre ? [fenetre(p.fenetre)] : [bandeauDu(p.groupe)]), coins(),
  ];

  /* ───────── le voyage ───────── */
  /* l'état du navire : sa coque et le Moral en jauges, son eau douce, ses vivres */
  const milliers = (n) => String(n).replace(/\B(?=(\d{3})+$)/g, ' ');
  const etatDuNavire = (n) => `${ligneDu('Coque', `<span class="chiffres">${n.coque.blessures} / ${n.coque.max}</span>`)}${jauge(n.coque.blessures / n.coque.max, { teinte: 'or', taille: 'forte' })}
    ${ligneDu('Moral', `<span class="chiffres">${n.moral}</span>`)}${jauge(n.moral / 100, { teinte: 'or', taille: 'forte' })}
    ${ligneDu('Eau douce', `<span class="chiffres">${milliers(n.eau)} L</span>`)}${ligneDu('Vivres de l’équipage', `<span class="chiffres">${pluriel(n.vivres, 'ration')}</span>`)}`;
  /* les écrans posés que la journée ouvre, sous le panneau du navire */
  const PICTO_A_OUVRIR = { dossier: 'coque', postes: 'cordage' };
  const OUVRIR_SOUS_LE_NAVIRE = 424;
  /* le billet d'un jet tombé, au-dessus de la carte du héros qui l'a lancé : le seuil, le dé, le DR, ce qu'il vaut à la
     vitesse, la Chance qui lui reste */
  const billetDuJet = (a, groupe) => {
    const k = groupe.findIndex((h) => h.id === a.qui), nom = prenomDe(a.qui);
    return `<div id="billet-du-jet">${apercu({ nom: echapper(a.test), sous: `${nom}${a.poste ? ` · ${echapper(a.poste)}` : ''}`, vers: 'bas', style: `left:calc(50% - 480px + ${240 * k + 24}px);bottom:236px;--pointe:60px`,
      corps: `<table><tr><td>Seuil</td><td>${echapper(a.difficulte.nom)} (${signe(a.difficulte.valeur)}) · ${a.seuil}</td></tr><tr><td>Dé</td><td>${d100(a.de)}</td></tr>
        <tr><td>${a.de <= a.seuil ? 'Réussite' : 'Échec'}</td><td>${signe(a.dr)} DR</td></tr>${a.effet ? `<tr><td>${echapper(a.effet.nom)}</td><td>${signe(a.effet.vitesse)} % de vitesse</td></tr>` : ''}</table>${chanceDu([[a.chance, nom]])}` })}</div>`;
  };
  /* le carton d'un arrêt : la vignette, le titre, où il tombe, le texte du livre, le dé tiré ; le choix qu'il ouvre et
     son geste, les parts qu'il règle à côté */
  const cartonDe = (a, v) => {
    const sous = [echapper(a.ou), a.marins && pluriel(a.marins, 'marin'), a.jour && jourDe(v.titre.jourDeVoyage, v.decor)].filter(Boolean).join(' · ');
    const geste = a.choix && plaque(echapper(a.choix.geste.libelle), { armee: !!a.choix.geste.principal, classe: 'commet' });
    const choix = !a.choix ? '' : a.choix.parts
      ? `<div class="reglement"><div class="choix paies">${a.choix.cartes.map(carteDe).join('')}${geste}</div><div class="qui"><div class="cadre bois"><div class="fond bois">${partsDu(a.choix.parts)}</div></div></div></div>`
      : `<div class="choix">${a.choix.cartes.map(carteDe).join('')}</div>${geste}`;
    return cadre('evenement', null, null, null, null, 'parchemin', `<div class="vignette"><svg viewBox="0 0 250 250">${VIGNETTES[a.vignette]()}</svg></div>
      <div class="corps"><div class="tete"><h2 data-texte="titre de l'événement">${echapper(a.titre)}</h2><span class="rubrique">${sous}</span></div><p data-texte="texte du livre">${echapper(a.texte)}</p>${choix}</div>
      ${a.de ? sceau(a.de.valeur, 'maitre', { de: a.de.de }) : ''}`, { ruban: echapper(a.ruban), classe: v.fenetre ? 'court' : '' });
  };
  /* une journée de route, de descente ou en mer : l'objet du temps, le récit, la carte du trajet, le navire et les écrans
     qu'il ouvre, la frise, le billet du jet, le carton de l'arrêt ; le groupe, ou la fenêtre du Test */
  const voyage = (v) => [
    titreDu(v.titre, v.decor), ...(v.recit ? [recitDu(v.recit)] : []), trajetDu(v.trajet, v.decor),
    ...(v.navire ? [cadre('navire', null, null, null, null, 'bois', etatDuNavire(v.navire.etat), { ruban: echapper(v.navire.nom), classe: 'bord' })] : []),
    ...(v.ouvrir ?? []).map((o, k) => ouvrir(echapper(o.libelle), PICTO_A_OUVRIR[o.id], OUVRIR_SOUS_LE_NAVIRE + 56 * k)),
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
      style: `left:${gauche}px;bottom:${720 - y + 14}px;--pointe:${cx - gauche - 8}px;width:${b.role === 'etendu' ? 340 : 300}px`, corps: `<table>${lignes.map(([l, v]) => `<tr><td>${l}</td><td>${v}</td></tr>`).join('')}</table>` })}</div>`;
  };
  const panneauDuBord = (b) => cadre('bord', null, null, null, null, 'bois', `${etatDuNavire(b.etat)}${filet({ fondu: true })}<div class="t rubrique">Ce que la journée jouera</div>
    ${b.jouera.map((j) => `<div class="jouera">${rond(PICTO_DU_JEU[j.id], 'menu', { arme: true })}${echapper(j.nom)}<span class="rubrique">${'qui' in j.par ? prenomDe(j.par.qui) : echapper(j.par.tenants)} · ${echapper(j.competence)}</span></div>`).join('')}`, { ruban: 'Le bord', classe: 'bord' });
  const semaineDu = (s, postes) => cadre('bord', null, null, null, null, 'bois', `${s.activites.map((a) => `<div class="t rubrique">${echapper(postes.find((p) => p.id === a.poste).nom)} · ${prenomDe(a.qui)}</div>
    <div class="reglage"><span>${echapper(a.reglage.libelle)}</span>${moinsPlus({ moins: a.reglage.valeur > 0, entre: `<b class="chiffres">${prix(a.reglage.valeur)}</b>` })}</div>
    ${a.plafond === undefined ? '' : ligneDu('Plafond', `<span class="chiffres">${prix(a.plafond)}</span>`)}${a.encLibre === undefined ? '' : ligneDu('Enc libre du navire', `<span class="chiffres">${a.encLibre}</span>`)}`).join(filet({ fondu: true }))}
    ${filet({ fondu: true })}${plaque(echapper(s.action), { armee: true })}`, { ruban: 'La semaine', classe: 'bord semaine' });
  const stationDu = (s) => cadre('station', null, null, null, null, 'bois', `<div class="stations">${s.stations.map((n, k) => plaque(echapper(n), { armee: k === s.tenue, taille: 'petite' })).join('')}</div>
    <p data-texte="station">${echapper(s.texte)}</p>`, { ruban: `Station de ${prenomDe(s.qui)}`, classe: 'bord' });
  const leBord = (b) => [
    cartouche({ icone: 'cordage', nom: echapper(b.titre.nom), sous: [echapper(b.titre.navire), b.titre.marins && pluriel(b.titre.marins, 'marin'), jourDe(b.titre.jourEnMer, 'bord'), b.titre.regle && echapper(b.titre.regle)].filter(Boolean).join(' · '), taille: 'titre', largeur: b.titre.regle ? 520 : 452 }),
    postesDu(b.postes, 'bord'), ...(b.billet ? [billetDuBord(b.billet, b.postes)] : []),
    ...(b.bord ? [panneauDuBord(b.bord)] : []), ...(b.semaine ? [semaineDu(b.semaine, b.postes)] : []),
    ...(b.ouvrir ? [ouvrir(echapper(b.ouvrir), 'coque', 348)] : []), ...(b.station ? [stationDu(b.station)] : []),
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
  const ceQueJoue = (j) => (j.echec ? 'échouée, aucun effet' : [j.ote && `Horde ${signe(-j.ote)}`, j.rupture && `rupture ${j.rupture.points}/${j.rupture.sur}`].filter(Boolean).join(' · '));
  const armeeDu = (a, bonus, teinte) => `${ligneDu(echapper(a.nom), `<span class="chiffres">${a.puissance} · départ ${a.depart}</span>`)}${jauge(a.puissance / 100, { teinte, taille: 'forte' })}${bonus ? ligneDu('Tests de Puissance ce Round', `<span class="chiffres">${signe(bonus)}</span>`) : ''}`;
  const puissance = (b) => cadre('panneau', null, null, null, null, 'bois', `${armeeDu(b.armees.allies, b.bonus, 'or')}${armeeDu(b.armees.ennemis, 0, 'cire')}${filet({ fondu: true })}
    ${b.jeu ? `<div class="t rubrique">Ce que le Round ${b.jeu.joue ? 'a joué' : 'jouera'}</div>${b.jeu.scenes.map((j) => `<div class="jouera${b.jeu.joue ? ' joue' : ''}">${rond(PICTO_DE_LA_SCENE[j.scene], 'menu', { arme: true })}${echapper(j.nom)}<span class="rubrique">${b.jeu.joue ? ceQueJoue(j) : quiJoue(j)}</span></div>`).join('')}` : ''}
    ${b.rounds ? `<div class="t rubrique">Ce que la bataille a joué</div>${b.rounds.map((r, k) => ligneDu(`Round ${k + 1}`, `${r.allies} contre ${r.ennemis}`)).join('')}` : ''}
    ${(b.gestes ?? []).map((g, k) => plaque(echapper(g.libelle), { armee: !!g.principal, icone: k ? 'des' : 'epee' })).join('')}`, { ruban: 'Puissance', classe: 'bord armees' });
  /* une Scène sur son emplacement du champ : ses postés (ou son pictogramme), la place offerte, son effet, son geste */
  const EMPLACEMENTS = [[800, 84], [470, 280], [760, 280]];
  const sceneDu = (sc, [cx, y]) => `<div class="poste scene ${sc.postes.length ? 'occupe' : 'vide'}${sc.visee ? ' vise' : ''}" data-piece="scène ${sc.id}" style="left:${cx}px;top:${y}px">
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
    ...(b.scenes ? [`<div>${b.scenes.map((sc, k) => sceneDu(sc, EMPLACEMENTS[k])).join('')}</div>`] : []),
    ...(b.apercu ? [apercuDeLaScene(b.apercu, b.scenes)] : []),
    ...(b.carton ? [carton(b)] : []),
    ...(b.fenetre ? [fenetre(b.fenetre)] : [bandeauDu(b.groupe)]), coins(),
  ];

  /* l'interlude en ville : les Activités restantes de chaque héros, la carte et ses lieux, le lieu choisi et ses
     Activités ; la carte se trace une fois posée (`lieux-et-nuit/carte-de-la-ville.js`) */
  const lieuSurLaCarte = (l) => { const { x, y, icone } = LIEUX_DE_LA_VILLE[l.id];
    /* l'étiquette d'un lieu près d'un bord de la carte s'ouvre vers l'intérieur */
    return `<div class="lieu bois${l.choisi ? ' choisi' : ''}${x < 211 ? ' gauche' : x > 633 ? ' droite' : ''}" style="left:${(100 * x) / 844}%;top:${(100 * y) / 572}%">${medaillon(icone, { taille: 'petit' })}<div><b>${echapper(l.nom)}</b><span class="rubrique">${echapper(l.quoi)}</span></div>${l.heros ? portrait(l.heros, { taille: 'petit' }) : ''}${l.fantome ? portrait(l.fantome, { taille: 'petit', classe: 'fantome' }) : ''}</div>`; };
  const activiteDu = (a) => `<div class="activite${a.prise ? ' prise' : ''}${a.refus ? ' fermee' : ''}">${medaillon(a.id, { taille: 'petit', ferme: !!a.refus })}<div><b>${echapper(a.nom)}</b>${a.test ? `<span class="c rubrique">${echapper(a.test)}</span>` : ''}${a.enjeu ? `<i>${echapper(a.enjeu)}</i>` : ''}</div>${a.refus && a.survol ? raison(echapper(a.refus)) : ''}</div>`;
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
        ${i.lieu.hote ? `<div class="pnj">${portrait(i.lieu.hote.buste)}<div><b>${echapper(i.lieu.hote.nom)}</b><p>${echapper(i.lieu.hote.dit)}</p></div></div>` : ''}
        ${i.lieu.forces ? `<div class="forces rubrique">Armée des Personnages ${i.lieu.forces.allies} · Horde ennemie ${i.lieu.forces.ennemis}</div>` : ''}
        ${ouvertes.map(activiteDu).join('')}${fermees.length ? `<div class="fermees">${fermees.map(activiteDu).join('')}</div>` : ''}
        ${plaque(echapper(i.lieu.envoi), { armee: true, icone: 'route', classe: 'envoyer' })}`, { ruban: echapper(i.lieu.quartier) }),
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
  /* le cartouche du lieu : son nom, sa date, ce qu'on y vit, son temps */
  const titreDuLieu = (t, icone, largeur = 436) => cartouche({ icone, nom: echapper(t.nom), taille: 'titre', largeur,
    sous: [t.date && `${t.date.jour} ${echapper(t.date.mois)}`, echapper(t.sous), t.meteo && `${picto(PICTO_DU_TEMPS[t.meteo.temps], 13, '#c9b995')} ${echapper(t.meteo.ciel)}`].filter(Boolean).join(' · ') });
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
  /* l'aubergiste et ses offres, à gauche sous le cartouche */
  const PICTO_DE_L_OFFRE = { commune: 'lit', privee: 'cle', grande: 'cle', repas: 'bol' };
  const offreDeLHote = (h) => cadre('hote-du-lieu', null, null, null, null, 'bois', `${cartouche({ icone: h.icone, nom: echapper(h.nom), sous: echapper(h.qualite) })}
    <div class="dit">${echapper(h.dit)}</div>
    <div class="grille">${h.offres.map((o) => `<span class="l rubrique">${picto(PICTO_DE_L_OFFRE[o.id], 17)}${echapper(o.nom)}</span><span class="q rubrique">${o.lits ? `${o.lits} lits` : 'par tête'}</span>${plaque(prix(o.prix), { armee: !!o.prise, taille: 'petite' })}`).join('')}</div>`);
  /* les postes de la scène, chacun sur sa place du décor : son centre, son haut */
  const PLACES_DES_POSTES = {
    auberge: { boire: [470, 290], rumeurs: [640, 390], jouer: [800, 250], soigner: [470, 430], dormir: [640, 40] },
    taverne: { 'bras-de-fer': [530, 30], flechettes: [690, 30], brasseur: [430, 170], batelier: [690, 170], cocher: [690, 330], 'al-zahr': [450, 380] },
    /* le bord : les rôles autour du mât, la vigie en tête ; les Activités de la semaine */
    bord: {
      vigie: [600, 20], mousse: [600, 150], capitaine: [245, 290], timonier: [415, 290], navigateur: [585, 290], artilleur: [755, 290],
      cuisinier: [245, 430], chirurgien: [415, 430], chansonnier: [585, 430], repos: [755, 430],
      aucune: [590, 150], commerce: [245, 320], cartographie: [840, 320], entrainement: [550, 440],
    },
  };
  const postesDu = (postes, decor) => `<div>${postes.map((p) => { const [cx, y] = PLACES_DES_POSTES[decor][p.id];
    return poste(cx, y, { nom: `${echapper(p.nom)}${p.refus && p.survol ? raison(echapper(p.refus)) : ''}`, sous: `${echapper(p.sous)}${p.prix === undefined ? '' : ` · ${prix(p.prix)}`}`, icone: PICTO_DU_ROLE[p.id], heros: p.tenants ?? [], plus: !!p.place, ferme: !!p.refus, vise: !!p.vise, piece: `poste ${p.id}` }); }).join('')}</div>`;
  /* qui dort où : l'abri tenu et ses places, ceux qui restent dehors, le sac de couchage ; le temps, ce que la nuit
     jouera, la note ; l'action */
  const PICTO_DE_LA_NUIT = { froid: 'flocon', repos: 'sommeil' };
  const couche = (libelle, ids, places, fin = '') => `<div class="couche"><span class="lab rubrique">${libelle}</span><div class="places">${Array.from({ length: places }, (_, k) => portrait(ids[k], { taille: 'petit' })).join('')}</div>${fin}</div>`;
  const dortoirDu = (d, meteo) => cadre('dortoir', null, null, null, null, 'bois', `
    ${d.abris ? `<div class="rang-c abri"><span class="lab rubrique">Abri</span>${segments(d.abris.map((a) => echapper(a.nom)), echapper(d.abri.nom))}</div>
      ${d.abris.filter((a) => a.test).map((a) => `<div class="aide">${echapper(a.nom)} : Test de ${echapper(a.test)}</div>`).join('')}` : ''}
    <div class="t rubrique">Qui dort où</div>
    ${couche(echapper(d.abri.nom), d.dedans, d.abri.places, `<i>${d.dedans.length} sur ${d.abri.places}</i>`)}
    ${d.dehors.length ? couche('Dehors', d.dehors, d.dehors.length) : ''}
    ${d.sac ? couche('Sac de couchage', d.sac.porteurs, d.sac.porteurs.length, `<i>${signe(d.sac.bonus)} au froid</i>`) : ''}
    ${d.temps ? `<div class="rang-c">${sceau(PICTO_DU_TEMPS[meteo.temps])}<span class="v">${echapper(d.temps)}</span></div>` : ''}
    ${filet({ fondu: true })}
    ${d.jouera ? `<div class="t rubrique">Ce que la nuit jouera</div>${d.jouera.map((n) => `<div class="jouera">${rond(PICTO_DE_LA_NUIT[n.id], 'menu', { arme: true })}${echapper(n.nom)}<span class="rubrique">${echapper(n.jet)}</span></div>`).join('')}` : ''}
    ${d.parts ? partsDu(d.parts) : ''}
    ${plaque(echapper(d.action), { armee: true, icone: 'lune', classe: 'nuit' })}`, { ruban: 'La nuit' });
  /* la partie d'un jeu de taverne : le jeu et sa règle, les jeux de la maison, la table, la mise */
  const PILE = `<svg width="38" height="34" viewBox="0 0 38 34">${[28, 23, 18, 13].map((y) => `<ellipse cx="15" cy="${y}" rx="12" ry="4.200" fill="#c9a44c" stroke="#5d4313" stroke-width="1"/>`).join('')}<ellipse cx="28" cy="27" rx="8" ry="3" fill="#c9a44c" stroke="#5d4313" stroke-width="1"/></svg>`;
  const partieDu = (p) => `<div id="partie" class="page cadre bois" data-piece="partie"><div class="fond parchemin">
    <h3 data-texte="jeu">${echapper(p.jeu.nom)}</h3><div class="sous rubrique">${echapper(p.jeu.sous)}</div><p>${echapper(p.jeu.regle)}</p>
    <div class="autres">${p.jeux.map((j) => plaque(echapper(j.nom), { armee: j.id === p.jeu.id, icone: PICTO_DU_ROLE[j.id], taille: 'petite' })).join('')}</div>
    ${filet()}<div class="t rubrique">À la table</div>
    <div class="sieges">${p.table.map((s) => `<div class="siege">${portrait(s.qui, { choisi: s.qui === p.mise.heros })}<b>${echapper(s.nom)}</b><span class="rubrique">${echapper(s.role)}</span></div>`).join('')}</div>
    ${filet()}<div class="t rubrique">La mise de ${prenomDe(p.mise.heros)}</div>
    <div class="mise">${rond('moins', 'petit')}<div class="somme">${PILE}<b>${prix(p.mise.mise)}</b></div>${rond('plus', 'petit')}
      <table class="compte"><tr><td>Le pot, à ${p.mise.joueurs}</td><td class="chiffres">${prix(p.mise.pot)}</td></tr><tr><td>Bourse de ${prenomDe(p.mise.heros)}</td><td class="chiffres">${prix(p.mise.avoir)}</td></tr></table></div>
    ${plaque(echapper(p.action), { armee: true, icone: 'des', classe: 'jouer' })}
  </div>${ruban('La partie', { gothique: true })}${ferrures}</div>`;
  /* la nuit : l'hôte ou le rail de la maison à gauche, les postes dans la scène, qui dort où ou la partie à droite ; à la
     halte, le récit sous le cartouche et ce que chacun mange sur sa carte du bandeau */
  const nuit = (n) => [
    titreDuLieu(n.titre, n.decor === 'bivouac' ? 'lune' : 'lit'),
    ...(n.recit ? [`<div id="recit" data-piece="recit"><div class="r rubrique ombre">${echapper(n.recit.lieu)}</div><p class="ombre" data-texte="recit">${echapper(n.recit.texte)}</p></div>`] : []),
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
      ...(s.hote ? [hote({ id: 'medecin', x: 400, y: 236, l: 340, icone: s.hote.icone, nom: echapper(s.hote.nom), sous: `${echapper(s.hote.qualite)} · ${echapper(s.hote.competence.nom)} ${s.hote.competence.seuil}`, pointe: 230, corps: `<p>${echapper(s.hote.dit)}</p>` })] : []),
      pageDesSoins({ ruban: s.hote ? 'Les soins du docteur' : 'Les soins', patient: echapper(patient.nom), blessures: patient.blessures, max: patient.max, mal: s.patient.mal ? echapper(s.patient.mal) : '', actes: s.actes.map(voieDu).join(''),
        pied: `${s.paiement ? `<table class="compte"><tr class="total"><td>À payer</td><td>${prix(s.paiement.aPayer)}</td></tr></table>${bourse({ heros: prenomDe(s.patient.qui), avoir: prix(s.paiement.avoir) })}` : ''}${plaque(echapper(s.action), { armee: true, icone: s.paiement ? 'bourse' : 'soin', classe: 'payer' })}${s.note ? `<div class="note"><i>${echapper(s.note)}</i></div>` : ''}` }),
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
      sous: o.depliee ? echapper(o.negociant) : `${o.disponible} Enc · ${prix(o.prixDeBase)} / Enc`, pointe: 40,
      corps: o.depliee ? `${mesures([['Disponible', `${o.disponible} Enc`], ['Prix de base', `${prix(o.prixDeBase)} / Enc`], ...(o.estimation === undefined ? [] : [['Estimation avant Marchandage', prix(o.estimation)]])])}${o.gestes ? gestesDeLOffre(o.gestes) : ''}` : '' }),
    porteur: (p, l) => hote({ id: `porteur-${p.id}`, classe: `offre enseigne${p.choisi ? ' choisie' : ''}`, x: 0, y: 0, l, icone: PICTO_DU_PORTEUR[p.id], nom: echapper(p.nom), sous: echapper(p.sous), pointe: 40,
      corps: `${p.vivres ? `${ligneDePorteur('Vivres', `${p.vivres.rations} rations-jour`)}${ligneDePorteur('Eau douce', `${p.vivres.eau} litres`)}` : ''}${ligneDePorteur(p.porte === 0 ? 'Vide' : p.porte === p.charge ? 'Pleine' : 'Chargée', libres(p.porte, p.charge))}${jauge(p.porte / p.charge, { teinte: 'or', taille: 'forte', ajout: (p.ajout ?? 0) / p.charge })}${p.lot ? lotDu(p.lot) : ''}` }),
    navire: (n, l) => hote({ id: 'navire', classe: 'offre enseigne', x: 0, y: 0, l, icone: 'navire', nom: echapper(n.nom), sous: echapper(n.sous), pointe: 40,
      corps: [n.coque && `${ligneDePorteur('Coque', `${n.coque.blessures} / ${n.coque.max}`)}${jauge(n.coque.blessures / n.coque.max)}`, n.salissures !== undefined && ligneDePorteur('Salissures', `niveau ${n.salissures}`),
        n.cale && `${ligneDePorteur('Cale', libres(n.cale.porte, n.cale.charge))}${jauge(n.cale.porte / n.cale.charge, { teinte: 'or', taille: 'forte' })}`,
        n.equipage && `${ligneDePorteur('Équipage', `${n.equipage.abord} sur ${n.equipage.sur}`)}${jauge(n.equipage.abord / n.equipage.sur, { teinte: 'or', taille: 'forte', ajout: n.equipage.ajout / n.equipage.sur })}`].filter(Boolean).join('') }),
    service: (s, l) => hote({ id: s.id, classe: `service${s.accueil ? '' : ' enseigne'}`, x: 0, y: 0, l, icone: PICTO_DU_SERVICE[s.id], nom: echapper(s.nom), sous: echapper(s.sous), pointe: 40,
      corps: s.accueil ? `<p>${echapper(s.accueil.dit)}</p><div class="gestes">${s.accueil.gestes.map((g) => plaque(echapper(g.libelle), { icone: PICTO_DU_GESTE[g.id], taille: 'petite' })).join('')}</div>` : '' }),
    constructeur: (c, l) => hote({ id: 'constructeur', classe: 'offre choisie', x: 0, y: 0, l, icone: 'marteau', nom: echapper(c.nom), sous: echapper(c.sous), pointe: 40,
      corps: c.ameliorations.map((a) => `<div class="lot${a.prise ? ' pris' : ''}${a.fermee ? ' ferme' : ''}"><span>${echapper(a.nom)}</span><span class="chiffres">${a.enc ? `${a.enc} Enc · ` : ''}${prix(a.prix)}</span></div>`).join('') }),
  };
  /* la largeur d'un hôte de la scène : déplié, il prend la colonne ; en enseigne, moins */
  const largeurDe = (h) => (h.role === 'constructeur' || (h.role === 'offre' && h.depliee) ? 340 : h.role === 'porteur' && h.id === 'mule' ? 240 : 300);
  /* une ligne de compte : son libellé et son détail, sa valeur */
  const detailDu = (d) => ('enc' in d ? `${d.enc} Enc à ${prix(d.a)}` : 'nombre' in d ? `${d.nombre} à ${prix(d.a)}` : `${signe(d.pourcent)} %`);
  const valeurDu = (v) => ('prix' in v ? prix(v.prix) : 'dr' in v ? `${v.qui ? `${echapper(v.qui)} ` : ''}${signe(v.dr)} DR` : `${echapper(v.texte)}${v.plus === undefined ? '' : ` <span class="chiffres">${signe(v.plus)}</span>`}`);
  const ligneDeCompte = (l) => `<tr><td>${echapper(l.libelle)}${l.detail ? `<span class="chiffres">${detailDu(l.detail)}</span>` : ''}</td><td class="chiffres">${valeurDu(l.valeur)}</td></tr>`;
  const nombre = (n) => moinsPlus({ entre: `<b class="chiffres">${n}</b>` });
  /* les blocs d'une page de service ; un filet sépare ceux qui changent de sujet */
  const BLOCS = {
    texte: (b) => `<p class="texte">${echapper(b.texte)}</p>`,
    porteurs: (b) => `<div class="r">Porteur</div><div class="porteurs">${b.porteurs.map((p) => `<div class="porteur${p.pris ? ' pris' : ''}"><div class="l">${picto(PICTO_DU_PORTEUR[p.id], 18, '#5a2a12')}<b>${echapper(p.nom)}</b></div><span class="chiffres">${libres(p.porte, p.charge)}</span>${jauge(p.porte / p.charge, { teinte: 'or', taille: 'forte', ajout: (p.ajout ?? 0) / p.charge })}</div>`).join('')}</div>`,
    quantite: (b) => `<div class="r">${echapper(b.libelle)}</div>${quantite(b.valeur, b.min, b.max)}`,
    faits: (b) => `<table class="faits">${b.lignes.map(ligneDeCompte).join('')}</table>`,
    compte: (b) => `<table class="compte">${b.lignes.map(ligneDeCompte).join('')}<tr class="total"><td>${echapper(b.total.libelle)}</td><td>${prix(b.total.prix)}</td></tr></table>`,
    voies: (b) => `<div class="voies">${b.voies.map(voieDu).join('')}</div>`,
    parts: (b) => partsDu(b.parts),
    lignes: (b) => `<div class="lignes">${b.lignes.map((l) => `<div class="ligne${l.prise ? ' prise' : ''}"><b>${echapper(l.nom)}</b><span class="c">${echapper(l.sous ?? '')}</span><span class="px chiffres">${prix(l.prix)}</span>${b.reglable ? nombre(l.nombre) : `<span class="n chiffres">${l.nombre}</span>`}</div>`).join('')}</div>`,
    nombre: (b) => `<div class="combien"><span class="r">${echapper(b.libelle)}</span>${nombre(b.valeur)}</div>`,
  };
  const SOUS_UN_FILET = ['porteurs', 'quantite', 'faits', 'voies', 'nombre', 'compte'];
  const gesteDeLaPage = (g) => plaque(echapper(g.libelle), { armee: !!g.principal && !('main' in etat), fermee: 'main' in etat, classe: 'conclure' });
  /* la page du service ouvert : ses blocs, ses gestes ; sa note, ou, la main ailleurs, la raison qui ferme ses gestes */
  const pageDu = (p) => page('page', echapper(p.titre), `<div class="tete"><h3 data-texte="page">${echapper(p.nom)}</h3><span class="sous rubrique">${echapper(p.sous)}</span></div>
    ${p.blocs.map((b, k) => `${SOUS_UN_FILET.includes(b.bloc) && p.blocs[k - 1]?.bloc !== 'nombre' ? filet() : ''}${BLOCS[b.bloc](b)}`).join('')}
    ${p.gestes.length > 1 ? `<div class="deux">${p.gestes.map(gesteDeLaPage).join('')}</div>` : p.gestes.map(gesteDeLaPage).join('')}
    ${etat.main ? `<div class="note refus">${sceau('reseau', 'menu')}<i data-texte="refus">${echapper(etat.main.refus)}</i></div>` : p.note ? `<div class="note"><i>${echapper(p.note)}</i></div>` : ''}`);
  /* la carte du port ou le trajet qui part d'ici, son ouverture ; les départs : la destination, sa voie et sa longueur, un
     moyen par plaque et ses jours, la place qu'une voiture vend */
  const PICTO_DU_MOYEN = { navire: 'navire', pied: 'botte', diligence: 'roue' };
  const departDu = (d) => `<div class="depart"><div class="ou"><b>${echapper(d.vers)}</b><span class="rubrique">Par ${echapper(d.par)} · ${d.distance} ${d.unite}</span>${d.place ? `<p>Diligence : ${prix(d.place.prix)} la place, ${echapper(d.place.classe)}.</p>` : ''}</div>
    <div class="moyens">${d.moyens.map((m) => plaque(`${m.jours} j`, { icone: PICTO_DU_MOYEN[m.id], taille: 'petite' })).join('')}</div></div>`;
  const carteDuLieu = (c, decor) => [
    c.trajet ? trajetDu(c.trajet, decor) : cadre('carte-du-lieu', null, null, null, null, 'parchemin', CARTE_DU_PORT),
    ouvrir(echapper(c.ouvrir), 'loupe', c.trajet ? 216 : 268),
    cadre('partir', null, null, null, null, 'bois', c.departs.map(departDu).join(''), { ruban: c.departs.every((d) => d.moyens.every((m) => m.id === 'navire')) ? 'Prendre la mer' : 'Partir' }),
  ];
  /* le commerce : le cartouche, le récit du port ou le rail des services, la rumeur ; les hôtes de la scène en colonne
     (en deux colonnes devant la carte du port) à droite du cartouche, entre le rail et la page ; la page du service ouvert, ou la carte du port ; le groupe, ou la fenêtre du Marchandage */
  const TITRE_DU_COMMERCE = { halle: ['panier', 372], quai: ['ancre', 372], relais: ['lit', 452] };
  const commerce = (c) => [
    titreDuLieu(c.titre, ...TITRE_DU_COMMERCE[c.decor]),
    ...(c.recit ? [`<div id="recit" class="${c.arrivee ? 'lieu' : ''}" data-piece="recit">${c.arrivee ? `<div class="r rubrique ombre">Arrivée à ${echapper(c.arrivee.lieu)} · Voyage de ${c.arrivee.heures} h.</div>` : ''}<p class="ombre" data-texte="recit">${echapper(c.recit)}</p></div>`] : []),
    ...(c.rail ? [railDu(c.rail)] : []),
    ...(c.rumeur ? [`<div id="rumeur" class="parchemin" data-piece="rumeur"><i class="clou"></i><div class="r">${echapper(c.rumeur.titre)}</div><p data-texte="rumeur">${echapper(c.rumeur.texte)}</p></div>`] : []),
    `<div id="scene-du-commerce" class="${c.decor}${c.carte && !c.carte.trajet ? ' en-deux' : ''}">${c.scene.map((h) => HOTES_DU_COMMERCE[h.role](h, c.carte && !c.carte.trajet ? 226 : largeurDe(h))).join('')}</div>`,
    ...(c.page ? [pageDu(c.page)] : []), ...(c.carte ? carteDuLieu(c.carte, c.decor) : []),
    ...(c.main ? [mainAilleurs(c.main)] : []),
    ...(c.fenetre ? [fenetre(c.fenetre)] : [bandeauDu(c.groupe, c.main ? (h) => joueDe(c.main.joueurs[h.id]) : undefined), retour(echapper(c.retour), c.carte ? 'route' : 'sortie')]), coins(),
  ];
  /* qui joue un héros du bandeau, en coop : son joueur, le sceau du réseau s'il se reconnecte */
  const joueDe = (j) => `<div class="joue">${j.absent ? sceau('reseau', 'menu') : ''}<span class="attend rubrique${j.vous ? '' : ' autre'}">${nomDuJoueur(j)}</span></div>`;
  /* qui tient la main, en coop : le joueur, ce qu'il fait, la partie */
  const mainAilleurs = (m) => `<div id="main" class="cadre bois" data-piece="main"><div class="fond bois">${medaillon('reseau', { taille: 'moyen' })}<div><b class="gothique" data-texte="main">La main est à ${m.tient.hote ? 'l’hôte' : echapper(m.tient.nom)}</b><span class="rubrique">${echapper(m.tient.nom)} ${echapper(m.fait)} · partie ${echapper(m.partie)}</span></div></div>${ferrures}</div>`;
  /* le décor du commerce (`commerce/commerce.js`) : la charrette chargée quand elle porte un lot ; la cour du relais
     (`voyage/voyage.js`), son coin haut assombri sous le cartouche et le récit */
  const CHARGE_DE_LA_CHARRETTE = 3;
  const DECORS_DU_COMMERCE = {
    halle: (c) => sceneDeLaHalle({ charge: c.scene.some((h) => h.role === 'porteur' && h.id === 'charrette' && h.lot) ? CHARGE_DE_LA_CHARRETTE : 0 }),
    quai: () => sceneDuQuai(),
    relais: () => { toile().innerHTML = D.relais(); fermer(); el(S, 'rect', { width: 560, height: 280, fill: 'url(#haut)', opacity: 0.55 }); },
  };
  const peindreLeCommerce = (c) => DECORS_DU_COMMERCE[c.decor](c);

  /* ───────── les dossiers ───────── */
  /* le dossier d'une possession, au gabarit de la fiche : l'identité (son nom lu ou en saisie, ses mesures, ses
     compteurs), le profil, la silhouette dans sa niche, les sections à onglets et leurs blocs */
  const mesureDu = (m) => `<div class="mesure"><div class="tete rubrique"><span>${echapper(m.nom)}</span><b class="chiffres">${m.sur === undefined ? m.valeur : `${m.valeur} / ${m.sur}`}</b></div>${jauge(m.valeur / (m.sur ?? 100), { teinte: m.teinte, taille: 'forte' })}</div>`;
  const PICTO_DU_TRAIT = { 'peu-maniable': 'barre', robuste: 'coque', dresse: 'dresse', nerveux: 'nerveux' };
  const titreDeBloc = (t, droite = '') => `<div class="bloc-t"><span class="rubrique">${t}</span>${droite}</div>`;
  const aucune = (n) => (n ? String(n) : 'aucune');
  const BLOCS_DU_DOSSIER = {
    traits: (b) => b.traits.map((t) => `<div class="arme trait"><div class="vignette laiton"><div>${picto(PICTO_DU_TRAIT[t.id], 100, '#e2c06a', 1.3)}</div></div>
      <div class="texte"><div class="n gothique">${echapper(t.nom)}</div><p data-texte="trait ${echapper(t.nom)}">${echapper(t.texte)}</p></div></div>`).join(''),
    reserves: (b) => `<div class="etats">${[['Eau douce', `${milliers(b.eau)} L`], ['Vivres de l’équipage', pluriel(b.vivres, 'ration')], ['Salissures', aucune(b.salissures)], ['Avaries', aucune(b.avaries)]].map(([l, v]) => `<div class="etat-n"><span class="rubrique">${l}</span><b class="chiffres">${v}</b></div>`).join('')}</div>`,
    livre: (b) => `<p class="livre" data-texte="texte du livre">${echapper(b.texte)}</p>`,
    cale: (b) => mesureDu({ nom: 'Cale', valeur: b.porte, sur: b.capacite, teinte: 'or' }),
    lots: (b) => `${titreDeBloc('Lots en cale')}<div class="cartes">${b.lots.map((l) => carte(echapper(l.nom), `${l.enc} Enc`, { armee: !!l.choisi, classe: 'courte' })).join('')}</div>`,
    deplacer: (b) => `${titreDeBloc(`Déplacer ${echapper(b.lot)} vers`, '<i>les porteurs qui sont là où est le navire</i>')}<div class="cartes">${b.vers.map((v) => carte(echapper(v.nom), `de ${prenomDe(v.de)} · ${v.porte} / ${v.charge} Enc`, { armee: !!v.choisi, portrait: portrait(v.genre, { taille: 'petit' }) })).join('')}
      <div class="quantite">${moinsPlus({ plus: b.quantite.valeur < Math.min(b.quantite.sur, b.quantite.place), entre: `<b class="chiffres">${b.quantite.valeur} Enc</b>` })}<span class="rubrique">sur ${b.quantite.sur} · ${b.quantite.place} de place</span>${plaque('Déplacer', { armee: true })}</div></div>`,
    aBord: (b) => `${titreDeBloc('À bord', `<b class="chiffres">${b.porte} / ${b.capacite} Enc</b>`)}${b.possessions.map((x) => `<div class="embarquee">${portrait(x.genre, { taille: 'petit' })}<div class="qui"><div class="n gothique">${echapper(x.nom)}</div><div class="c rubrique">${echapper(x.modele)} de ${prenomDe(x.de)} · ${x.enc} Enc à bord</div></div>${plaque('Débarquer')}</div>`).join('')}`,
    lieu: (b) => `<div class="ou"><div class="l"><span class="rubrique">Se trouve</span><b>${echapper(b.ou)}</b></div><div class="plaques">${b.gestes.map((g) => plaque(`${echapper(g.libelle)}${g.refus && g.survol ? raison(echapper(g.refus)) : ''}`, { armee: !!g.principal, fermee: !!g.refus })).join('')}</div></div>`,
    embarquer: (b, d) => { const n = b.navires.find((x) => x.choisi);
      return `${titreDeBloc('Embarquer sur', '<i>les navires du groupe qui ont la place</i>')}<div class="cartes">${b.navires.map((x) => carte(echapper(x.nom), `${echapper(x.modele)} · ${x.porte} / ${x.capacite} Enc à bord`, { armee: !!x.choisi, portrait: portrait('navire', { taille: 'petit' }) })).join('')}
        <div class="quantite"><span class="rubrique">${echapper(d.possession.nom)} et sa charge · ${b.charge} Enc</span>${plaque(`Embarquer sur ${echapper(n.nom)}`, { armee: true })}</div></div>`; },
    abandon: (b) => `${titreDeBloc(`Abandonner ${echapper(b.nom)}`)}<div class="plaques confirme">${plaque('Confirmer l’abandon', { armee: true })}${plaque('Annuler')}</div>`,
  };
  const valeurDuProfil = (c) => (c.valeur === null ? '–' : c.signe ? signe(c.valeur) : c.unite ? `${c.valeur} ${echapper(c.unite)}` : c.valeur);
  const dossier = (d) => {
    const p = d.possession;
    const lignes = [echapper(p.modele), `${echapper(p.nature)}${p.de ? ` de ${prenomDe(p.de)}` : ''}`, [p.longueur && `${p.longueur} mètres`, prix(p.prix)].filter(Boolean).join(' · ')];
    return [
      `<div id="f-identite" class="cadre bois dossier" data-piece="dossier-identite"><div class="fond parchemin">
        <div class="tete">${portrait(p.genre, { taille: 'affiche' })}<div>${p.saisie ? champ('', echapper(p.nom)) : `<div class="n gothique">${echapper(p.nom)}</div>`}${lignes.map((l) => `<div class="c rubrique">${l}</div>`).join('')}
          <div class="renommer${p.saisie ? ' en-saisie' : ''}">${rond('plume', 'menu', { arme: !!p.saisie })}<span class="rubrique">Renommer</span></div></div></div>
        ${d.mesures.map(mesureDu).join('')}${filet({ losange: true })}<div class="reserves">${d.compteurs.map((c) => compteur(c.valeur, echapper(c.nom))).join('')}</div>
      </div>${ferrures}</div>`,
      `<div id="f-profil" class="cadre bois dossier" data-piece="dossier-profil"><div class="fond parchemin" style="grid-template-columns:repeat(${d.profil.caracs.length},1fr)">${d.profil.caracs.map((c) => `<div class="carac"><span class="rubrique">${echapper(c.nom)}</span><b class="chiffres">${valeurDuProfil(c)}</b></div>`).join('')}</div>${ruban(echapper(d.profil.titre), { gothique: true })}${ferrures}</div>`,
      `<div id="f-figure" class="cadre bois dossier" data-piece="dossier-figure"><div class="fond bois"><div class="niche laiton"><div>${SILHOUETTES[p.genre]}</div></div></div>${ferrures}</div>`,
      `<div id="f-sections" class="cadre bois dossier" data-piece="dossier-sections"><div class="fond parchemin">${d.blocs.map((b) => BLOCS_DU_DOSSIER[b.bloc](b, d)).join('')}</div>${onglets(d.sections.map(echapper), echapper(d.ouverte))}${ferrures}</div>`,
      croix(), coins(),
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
  const journalDu = (lignes) => `<div id="fil" data-piece="journal"><div class="tete rubrique ombre">Journal</div>${lignes.map((l, k) => (typeof l === 'string'
    ? `<p class="${k === lignes.length - 1 ? '' : 'vieux '}ombre">${echapper(l)}</p>` : `<p class="moment ombre">${echapper(l.moment)}</p>`)).join('')}</div>`;
  /* ce qui est à portée sur la scène, à son point (`pointDe`, `exploration-et-recit/scene.js`) : sa marque ; survolée, ce
     qu'on en sait et son geste, l'aperçu du côté où l'écran a la place ; signalée, son nom et son geste en poste */
  const marqueDe = (c, [x, y]) => `<div class="marque" data-piece="marque ${echapper(c.nom)}" style="left:${x}px;top:${y}px">${medaillon(PICTO_DU_GESTE_DE_SCENE[c.geste.id], { taille: 'petit' })}</div>`;
  const aCote = ([x, y], { nom, corps }) => {
    const aDroite = x < VUE.largeur / 2;
    return apercu({ nom, vers: aDroite ? 'gauche' : 'droite', style: `left:${aDroite ? x + 30 : x - 330}px;top:${y - 60}px;--pointe:52px`, corps });
  };
  const survolDe = (c, point, regard) => aCote(point, { nom: echapper(c.nom), corps: `<p>${echapper(c.survolee)}</p>
    <div class="geste">${rond(PICTO_DU_GESTE_DE_SCENE[c.geste.id], 'menu', { arme: true })}${echapper(c.geste.libelle)}<em>${regard === 'immersion' ? `${touche(TOUCHES.agir)} ou clic` : 'clic'}</em></div>` });
  /* le poste d'une chose signalée, gardé entre les marges, et à gauche de la colonne des écrans à ouvrir quand il monte
     à sa hauteur (`basDesEcrans`) ; sa pointe, sous l'étiquette, reste sur la marque */
  const LARGEUR_DU_POSTE = 160, HAUTEUR_DU_POSTE = 92, JEU_DE_LA_POINTE = LARGEUR_DU_POSTE / 2 - 8;
  const signaleeDe = (c, [x, y], basDesEcrans) => {
    const haut = y + 17 - HAUTEUR_DU_POSTE, bordDroit = VUE.largeur - (haut < basDesEcrans ? 250 : 24);
    const cx = Math.max(24 + LARGEUR_DU_POSTE / 2, Math.min(x, bordDroit - LARGEUR_DU_POSTE / 2));
    return poste(cx, haut, { nom: echapper(c.nom), sous: echapper(c.geste.libelle), icone: PICTO_DU_GESTE_DE_SCENE[c.geste.id], vise: true,
      piece: `chose ${echapper(c.nom)}`, pointe: Math.max(-JEU_DE_LA_POINTE, Math.min(x - cx, JEU_DE_LA_POINTE)) });
  };
  const choseDe = (c, regard, basDesEcrans) => {
    const point = pointDe(c.id, regard);
    if (c.signalee) return [signaleeDe(c, point, basDesEcrans)];
    return [...(regard === 'immersion' && c.survolee ? [] : [marqueDe(c, point)]), ...(c.survolee ? [survolDe(c, point, regard)] : [])];
  };
  /* les gestes du groupe que la situation ouvre, en colonne au bord gauche jusqu'à la ligne basse */
  const gestesDuGroupe = (gestes) => `<div id="gestes-groupe" data-piece="gestes du groupe">${gestes.map((g) => `<div>${rond(PICTO_DU_GESTE_DU_GROUPE[g.id], 'grand')}<span class="rubrique ombre">${echapper(g.libelle)}</span></div>`).join('')}</div>`;
  /* les écrans à ouvrir au bord droit, sous le regard */
  const ECART_DES_ECRANS = 58;
  const hautDesEcrans = (e) => (e.regard ? 82 : 20);
  const ecransDu = (e) => (e.ouvrir ?? []).map((o, k) => ouvrir(echapper(o.libelle), PICTO_DE_L_ECRAN[o.id], hautDesEcrans(e) + ECART_DES_ECRANS * k));
  /* le document remis, en carton au-dessus du bandeau : son titre, d'où il vient et qui le tient, son texte, son cachet ;
     au pied, où il se relit et « Replier » */
  const documentDu = (d) => cadre('document', null, null, null, null, 'parchemin', `
    <div class="tete"><h2 data-texte="titre du document">${echapper(d.titre)}${d.sous ? ` <span>${echapper(d.sous)}</span>` : ''}</h2><span class="rubrique">${echapper(d.provenance)} · lu par ${prenomDe(d.heros)}</span></div>
    ${filet({ losange: true })}
    <div class="texte">${d.paragraphes.map((p, k) => `<p data-texte="document ${k + 1}">${echapper(p)}</p>`).join('')}<p class="signe">${d.signature.map(echapper).join('<br>')}</p></div>
    <div class="pied"><div class="note">${rond(d.relu ? 'livre' : 'journal', 'menu', { arme: true })}<span>${d.relu ? 'Relu depuis le carnet : « Replier » y ramène.' : 'Consigné au carnet : il se relit quand on veut.'}</span></div>
      ${plaque('Replier', { armee: true })}${sceau(d.sceau, 'maitre')}</div>`, { ruban: 'Document' });
  /* la fouille, dans la fenêtre du bas : ce qu'on trouve et l'argent réparti ; une case par héros (sa charge, en rouge
     quand elle est pleine) et « Laisser » pour chaque objet ; à qui va ce qui reste */
  const chargeDu = (c) => { const plein = c.enc >= c.max;
    return `<div class="col">${portrait(c.qui, { taille: 'petit' })}<div class="q"><b>${prenomDe(c.qui)}</b><span class="chiffres${plein ? ' plein' : ''}">Enc ${c.enc} / ${c.max}</span>${jauge(c.enc / c.max, { teinte: plein ? 'cire' : 'or' })}</div></div>`; };
  const fouilleDu = (f) => bandeauDuJet('Butin', 'fouille', `
    <div class="trouve"><div class="n gothique" data-texte="butin titre">${echapper(f.sur)}</div><div class="c rubrique">Fouillé par ${prenomDe(f.par)}</div>
      <p data-texte="butin récit">${echapper(f.texte)}</p>
      <div class="bourse">${sceau('pieces')}<span><b class="chiffres">${prix(f.argent)}</b> répartis entre les bourses</span></div></div>
    <div class="partage" style="--heros:${f.charges.length}"><div class="tete-o rubrique">Une case donne l’objet à ce héros</div>${f.charges.map(chargeDu).join('')}<div class="col laisser">${picto('croix', 15)}<b>Laisser</b></div>
      ${f.objets.map((o) => `<div class="objet"><div class="ic">${picto(o.id, 17)}</div><div class="t"><b data-texte="objet ${echapper(o.nom)}">${echapper(o.nom)}</b><span class="chiffres">Enc ${o.enc}</span></div></div>${'<i class="prise"></i>'.repeat(f.charges.length + 1)}`).join('')}
      <div class="reste">Ce qui reste à la fermeture va à ${prenomDe(f.reste)}.</div></div>`,
  f.gestes.map((g) => plaque(echapper(g.libelle), { armee: !!g.principal, classe: g.libelle.length > 12 ? 'large' : '' })).join(''));
  /* l'exploration : le cartouche du lieu, le regard et les écrans à ouvrir au bord droit, ce qui est à portée sur la
     scène, les gestes du groupe au bord gauche, le journal ; le document remis ; le groupe, ou la fenêtre qui prend sa
     place ; le retour au lieu */
  const ICONE_DU_LIEU = { salle: 'lit', 'grand-route': 'route' };
  const exploration = (e) => {
    const regard = e.regard ?? 'tactique', ecrans = ecransDu(e);
    const basDesEcrans = ecrans.length ? hautDesEcrans(e) + ECART_DES_ECRANS * ecrans.length : 0;
    return [
      titreDuLieu(e.titre, ICONE_DU_LIEU[e.decor], 392),
      ...(e.regard ? [regardDu(e.regard)] : []), ...ecrans,
      ...(e.choses ?? []).flatMap((c) => choseDe(c, regard, basDesEcrans)),
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
  const moyenDu = (m) => `<div class="moyen${m.pris ? ' pris' : ''}">${medaillon(PICTO_DU_MOYEN_DE_VOYAGE[m.id], { taille: 'moyen' })}<div class="q"><b>${NOM_DU_MOYEN[m.id]}</b><span class="c rubrique">${pluriel(m.jours, 'jour')} · ${pluriel(m.nuits.nombre, 'nuit')} ${NUITS[m.nuits.a]}</span></div>
    <div class="px chiffres">${m.place ? `${prix(m.place.dehors)} dehors<br>${prix(m.place.dedans)} dedans<small>par tête</small>` : 'sans frais'}</div></div>`;
  const destinationDu = (d) => cadre('destination', null, null, null, null, 'bois', `<h3 data-texte="destination">${echapper(d.nom)}</h3>
    <div class="s rubrique">Par ${echapper(d.par)} · ${d.etapes.reduce((t, x) => t + (x.km ?? 0), 0)} km</div><p data-texte="prose du lieu">${echapper(d.texte)}</p>
    <div class="etapes">${d.etapes.map((x, k) => `${x.km ? `<div class="t"><u></u><span class="chiffres">${x.km} km</span></div>` : ''}<div class="e${k ? '' : ' ici'}"><i></i><span class="rubrique">${echapper(x.nom)}</span></div>`).join('')}</div>
    ${d.moyens.map(moyenDu).join('')}${plaque(echapper(d.geste.libelle), { armee: !!d.geste.principal, icone: 'route', classe: 'partir' })}`, { ruban: 'Destination' });
  const lieuDuMonde = (l, groupe) => { const { x, y, icone } = LIEUX_DU_REIKLAND[l.id];
    return `<div class="lieu bois${l.choisi ? ' choisi' : ''}${l.ici ? ' sous' : ''}" style="left:${(100 * x) / 1225}%;top:${(100 * y) / 572}%">${medaillon(icone, { taille: 'petit' })}<div><b>${echapper(l.nom)}</b><span class="rubrique">${[echapper(l.nature), l.distance && `${l.distance} km`, l.ici && 'le groupe est ici'].filter(Boolean).join(' · ')}</span></div>${l.ici ? `<div class="ici">${groupe.map((h) => portrait(h.id, { taille: 'menu' })).join('')}</div>` : ''}</div>`; };
  const carteDuMonde = (c) => [
    titreDuLieu(c.titre, 'carte', 400),
    `<div id="reikland" class="cadre bois" data-piece="carte du monde"><div class="fond parchemin"><svg viewBox="0 0 1225 572" preserveAspectRatio="none"></svg>${c.lieux.map((l) => lieuDuMonde(l, c.groupe)).join('')}</div>${ferrures}</div>`,
    destinationDu(c.destination),
    ...(c.fenetre ? [fenetre(c.fenetre)] : [bandeauDu(c.groupe)]),
    retour(echapper(c.retour), 'porte'), coins(),
  ];
  const tracerLeReikland = (c) => dessinerLeReikland(document.querySelector('#reikland svg'), c.lieux.find((l) => l.ici)?.id);

  /* le carnet d'enquête, écran de gestion posé sur la salle : les affaires et les documents remis dans le panneau de
     gauche, l'affaire ouverte tendue à droite, ses indices et leurs lectures, la dernière en tête */
  const lectureDe = (l, classe = '') => `<div class="lu${l.manuscrite ? ' manuscrite' : ''} ${classe}"><div class="tete"><b class="gothique">${echapper(l.titre)}</b></div>${l.lignes.map((p) => `<p>${echapper(p)}</p>`).join('')}</div>`;
  const indiceDu = (i) => `<div class="indice"><b class="gothique">${echapper(i.nom)}</b><span class="chip">Indice</span>${i.nouveau ? '<span class="chip neuf">Nouveau</span>' : ''}${plaque('Épingler', { icone: 'epingle', armee: !!i.epingle, taille: 'petite', classe: 'epingle' })}</div>
    <div class="lectures"><div><div class="r rubrique">Dernière lecture</div>${lectureDe(i.lectures[0])}</div>${i.lectures.length > 1 ? `<div><div class="r rubrique">Lectures précédentes</div>${i.lectures.slice(1).map((l) => lectureDe(l, 'attenue')).join('')}</div>` : ''}</div>`;
  const carnet = (c) => {
    const affaire = c.affaires.find((a) => a.id === c.ouverte);
    return [
      cartouche({ icone: 'livre', nom: echapper(c.titre.nom), sous: echapper(c.titre.sous), taille: 'titre', largeur: 312 }),
      rail('Affaires', [['epingle', 'Épinglés', false, c.epingles], ...c.affaires.map((a) => ['oeil', echapper(a.nom), a.id === c.ouverte, a.indices])], 'Un indice caché ne s’y lit pas'),
      cadre('documents', null, null, null, null, 'bois', `${c.documents.map((d) => plaque(`<span>${echapper(d)}</span>`, { icone: 'lettre', classe: 'gauche' })).join('')}<div class="pied rubrique">Un document remis se relit ici</div>`, { ruban: 'Documents remis' }),
      `<div id="affaire" class="page cadre bois" data-piece="affaire"><div class="fond parchemin">
        <div class="tete"><h3 data-texte="affaire">${echapper(affaire.nom)}</h3><span class="sous rubrique">${pluriel(affaire.indices, 'indice')}</span></div>${filet()}
        ${c.indices.map(indiceDu).join('')}</div>${ferrures}</div>`,
      croix(),
    ];
  };

  /* ───────── le héros : sa création, sa fiche, sa progression ───────── */
  /* une rubrique et sa note ; la Caractéristique d'une ligne ; le nom d'une Compétence et sa précision */
  const rub = (t, note = '') => `<div class="rub">${t}${note ? ` <span class="note">${note}</span>` : ''}</div>`;
  const car = (c) => `<span class="tag">${c}</span>`;
  const nomDe = (n, precision) => `${echapper(n)}${precision ? ` <small>(${echapper(precision)})</small>` : ''}`;
  /* un jeton de compte : `or` à tenir, `cire` à corriger, `fer` épuisé */
  const jeton = (texte, teinte = '') => `<span class="jeton ${teinte}">${texte}</span>`;
  const px = (n) => `${n} PX`;
  const reste = (r, teinte = 'or') => jeton(`À répartir · ${r.n} / ${r.sur}`, teinte);
  /* une ligne d'une liste à choisir : cochée, ou fermée et sa raison au survol */
  const optionDe = (o, fin = '') => `<div class="ligne${o.choisie ? ' choisie' : ''}${o.refus ? ' refusee' : ''}">${o.choisie ? picto('coche', 15, undefined, 2) : '<i class="losange"></i>'}<span class="n" data-texte="${echapper(o.nom)}${o.precision ? ` ${echapper(o.precision)}` : ''}">${nomDe(o.nom, o.precision)}</span>${fin}${o.refus && o.survol ? raison(echapper(o.refus)) : ''}</div>`;
  const faitDu = (f) => `<div class="fait">${rub(echapper(f.rubrique))}<b data-texte="${echapper(f.rubrique)}">${echapper(f.valeur)}</b></div>`;
  const pills = (noms, prise = null) => `<div class="pills">${noms.map((n) => `<span class="pill${n === prise ? ' prise' : ''}">${echapper(n)}</span>`).join('')}</div>`;
  /* des clous d'Augmentation : `n` posés sur `sur` */
  const clous = (n, sur) => `<div class="clous">${Array.from({ length: sur }, (_, k) => `<i class="${k < n ? 'p' : ''}"></i>`).join('')}</div>`;
  const RESERVE = (r) => `<div class="reserve">${disque(r.valeur, { taille: 'grand' })}<span class="rub">${echapper(r.nom)}</span></div>`;

  /* la frise des étapes : cochées, le ruban de celle qui s'ouvre, les clous de celles à venir, la croix au bout ; le rail
     se trace une fois posée (`tracerLaFrise`) */
  const friseDesEtapes = (etapes, rang) => cadre('etapes', null, null, null, null, 'bois', `<div class="suite"><i class="rail"></i><i class="rail fait"></i>${etapes.map((nom, k) => (k < rang - 1
    ? `<div class="etape faite">${rond('coche', 'menu')}<span class="rubrique">${echapper(nom)}</span></div>`
    : k === rang - 1 ? `<div class="etape en-cours">${ruban(`${echapper(nom)}<small class="chiffres">${rang}/${etapes.length}</small>`, { gothique: true })}</div>`
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
  const acquisDe = (a) => `<div class="a${a.valeur === undefined ? ' total' : ''}"><i>${echapper(a.rubrique)}${a.px && a.valeur !== undefined ? jeton(`+${px(a.px)}`) : ''}</i>
    <b data-texte="acquis ${echapper(a.rubrique)}">${a.valeur === undefined ? `<span class="chiffres">${px(a.px)}</span>` : valeurDeLAcquis(a)}</b></div>`;
  const herosEnCreation = (h) => cadre('heros-neuf', null, null, null, null, 'bois', `<div class="niche laiton"><div>${figure(h.pose, { palette: !!h.palette })}</div></div>
    <div class="acquis"><div class="qui" data-texte="nom du héros">${echapper(h.nom ?? 'Nouveau héros')}</div>${h.acquis.map(acquisDe).join('')}
      <div class="gestes">${plaque(`${echapper(h.geste.libelle)} ${picto('chevron_d', 16, undefined, 2)}${h.geste.refus && h.geste.survol ? raison(echapper(h.geste.refus)) : ''}`, { armee: !h.geste.refus, fermee: !!h.geste.refus })}
        ${plaque(`${picto('chevron_g', 15, undefined, 2)} Précédent`, { taille: 'petite' })}</div></div>`, { classe: 'pan' });
  /* la tête d'une liste : sa rubrique à gauche, ce qui se règle à droite */
  const teteDeListe = (gauche, droite) => `<div class="tete-l">${gauche}${droite}</div>`;
  const nomDuDetail = (nom, sous) => `<div class="nom" data-texte="titre de page">${echapper(nom)}</div><div class="sous">${sous}</div>`;

  /* chaque étape : le choix à gauche, le ruban du détail, le détail au milieu ; la classe du choix */
  const ETAPES_DE_CREATION = {
    caracteristiques: (p) => {
      const points = p.methode === 'points', visee = p.profil.find((x) => x.carac === p.pressee);
      const porte = (x) => (x.origine ? `<span class="pts">${echapper(x.origine)}</span>` : points ? `<span class="pts nb">${x.points}</span>` : `<span class="pts">${sceau(x.de, 'petit')}</span>`);
      const caseDe = (x) => `<div class="c${x.carac === p.pressee ? ' carr' : ''}"><span class="ab">${x.carac}</span>${porte(x)}<span class="v">${x.valeur}</span>${points && !x.origine ? moinsPlus({ moins: x.points > p.points.min, plus: x.points < p.points.max && p.points.reste.n > 0 }) : ''}</div>`;
      const ligne = (r, l) => `<div class="ligne repartie">${l.carac ? car(l.carac) : ''}<span class="n" data-texte="${echapper(l.nom)}">${echapper(l.nom)}</span>${clous(l.augmentations.n, l.augmentations.sur)}${moinsPlus({ moins: l.augmentations.n > 0, plus: r.reste.n > 0 && l.augmentations.n < l.augmentations.sur })}<span class="val">${l.valeur}</span></div>`;
      const methode = (m) => optionDe({ nom: m.nom, ...(m.id === p.methode ? { choisie: true } : {}) }, m.px ? jeton(`+${px(m.px)}`, m.id === p.methode ? 'or' : '') : '');
      return [`${rub('Méthode')}<div class="lignes methodes">${p.methodes.map(methode).join('')}</div>
        <div class="tirage-c">${points
    ? `${jeton(`À répartir · ${p.points.reste.n} / ${p.points.reste.sur}`, p.points.reste.n ? 'cire' : 'or')}<span class="rub"><span class="note">De ${p.points.min} à ${p.points.max} points par Caractéristique.</span></span>`
    : `${sceau('des', 'moyen')}<div class="l">${rub('Les dix 2d10', 'tirés')}</div>${plaque('Relancer les dix 2d10', { prix: 'sans PX', taille: 'petite', classe: 'relancer' })}`}</div>
        ${p.repartitions.map((r) => `${filet({ fondu: true, losange: true })}${teteDeListe(rub(echapper(r.rubrique), echapper(r.note)), reste(r.reste))}<div class="lignes">${r.lignes.map((l) => ligne(r, l)).join('')}</div>`).join('')}`,
      'Profil',
      `<div class="profil-c"><div class="fond">${p.profil.map(caseDe).join('')}</div></div>
        ${nomDuDetail(visee.nom, `${points ? `${visee.points} points` : `${visee.de} aux dés`} + ${p.espece.valeur} des ${echapper(p.espece.nom)} + ${pluriel(visee.augmentations ?? 0, 'Augmentation')}`)}
        ${p.jets ? `${rub(`Le jet de ${echapper(visee.nom)}`, 'en prendre un autre échange les deux')}<div class="jets">${p.jets.map((j) => `<div class="jet${j.carac === p.pressee ? ' pris' : ''}">${sceau(j.de, 'petit')}<i>${j.carac}</i></div>`).join('')}</div>`
    : `${filet({ fondu: true, losange: true })}<p class="prose" data-texte="texte de la caractéristique">${echapper(p.texte)}</p>`}
        <div class="faits pied">${p.faits.map(faitDu).join('')}</div>`];
    },
    signe: (p) => [`<div class="tirage">${sceau(p.tirage.de, 'maitre')}<div class="col">${rub('Signe au d100', 'tiré')}
        ${optionDe({ nom: p.tenu, choisie: true }, jeton(`+${px(p.tirage.px)}`, 'or'))}<span class="rub"><span class="note">Le signe gardé tel que le dé l’a tiré vaut ses PX.</span></span></div></div>
      ${filet({ fondu: true, losange: true })}${rub('Signe astral')}
      <div class="deux signes">${p.signes.map((s) => optionDe({ nom: s, ...(s === p.tenu ? { choisie: true } : {}) })).join('')}</div>
      <div class="variante">${sceau('', 'petit', { etat: 'vide' })}${rub('Variante au d10', 'l’Étoile du Sorcier seule')}<div class="pills">${p.variantes.map((v) => `<span class="pill"><b class="chiffres">${v.d10}</b>${echapper(v.nom)}</span>`).join('')}</div></div>`,
    echapper(p.page.constellation),
    `<div class="vignette laiton">${ciel()}</div>${nomDuDetail(p.tenu, '')}${filet({ fondu: true, losange: true })}
      <div class="faits">${faitDu({ rubrique: 'Nom classique', valeur: p.page.classique })}${faitDu({ rubrique: 'Dates', valeur: p.page.dates })}${faitDu({ rubrique: 'Dans le ciel', valeur: p.page.ciel })}
        <div class="fait">${rub('Attributs de départ')}<div class="attributs">${p.page.attributs.map((a) => jeton(`${a.carac} ${signe(a.valeur)}`, a.valeur < 0 ? 'cire' : 'or')).join('')}</div></div></div>
      <p class="prose" data-texte="texte du signe">${echapper(p.page.texte)}</p>`],
    competencesDeRace: (p) => {
      const pris = (palier) => p.paliers.find((x) => x.palier === palier).pris;
      const pastille = (c, palier) => `<span class="palier ${palier === c.palier ? (palier ? 'pris' : 'zero') : palier && pris(palier).n === pris(palier).sur ? 'ferme' : ''}">${palier ? `+${palier}` : '0'}</span>`;
      const carte = (c, palier) => `<div class="competence">${car(c.carac)}${disque(c.base + palier)}<div class="n" data-texte="carte ${echapper(c.nom)}">${nomDe(c.nom, c.precision)}</div><span class="calc chiffres">${c.carac} ${c.base} +${palier}</span></div>`;
      const groupe = ({ palier, pris: { sur } }) => { const cartes = p.competences.filter((c) => c.palier === palier);
        return `${rub(`Augmentations à +${palier}`)}<div class="rangee">${cartes.map((c) => carte(c, palier)).join('')}${'<div class="competence vide"><span>À choisir</span></div>'.repeat(sur - cartes.length)}</div>`; };
      return [`${teteDeListe(rub('Compétences de race'), plaque('Répartition par défaut', { taille: 'petite', classe: 'regler' }))}
        <div class="lignes">${p.competences.map((c) => `<div class="ligne">${car(c.carac)}<span class="n" data-texte="${echapper(c.nom)} ${echapper(c.precision ?? '')}">${nomDe(c.nom, c.precision)}</span><div class="paliers">${[0, 3, 5].map((k) => pastille(c, k)).join('')}</div></div>`).join('')}</div>
        <div class="comptes">${p.paliers.map((x) => jeton(`À +${x.palier} · ${x.pris.n} / ${x.pris.sur}`, x.pris.n === x.pris.sur ? 'fer' : 'or')).join('')}</div>`,
      echapper(p.espece),
      `${nomDuDetail('Compétences de race', p.paliers.map((x) => `${x.pris.sur} à +${x.palier}`).join(' · '))}${filet({ fondu: true, losange: true })}${p.paliers.map(groupe).join('')}${FILIGRANE}`];
    },
    competencesDeCarriere: (p) => {
      const c = p.competences.find((x) => x.pressee);
      const race = (n) => `<span class="palier race${n ? '' : ' sans'}">+${n}</span>`;
      return [`${teteDeListe(rub('Compétences de carrière'), plaque('Répartition simple', { taille: 'petite', classe: 'regler' }))}
        <div class="lignes">${p.competences.map((x) => `<div class="ligne carriere${x.pressee ? ' choisie' : ''}">${car(x.carac)}<span class="n" data-texte="${echapper(x.nom)}">${nomDe(x.nom, x.precision)}</span>${race(x.race)}${clous(x.augmentations.n, x.augmentations.sur)}${moinsPlus({ moins: x.augmentations.n > 0, plus: p.reste.n > 0 && x.augmentations.n < x.augmentations.sur })}<span class="val">${x.test}</span></div>`).join('')}</div>
        <div class="comptes">${reste(p.reste)}<span class="rub"><span class="note">${c.augmentations.sur} Augmentations au plus par Compétence.</span></span></div>
        <div class="comptes">${race(5)}<span class="rub"><span class="note">Augmentations de race : acquises, hors des ${p.reste.sur} et des ${c.augmentations.sur}.</span></span></div>`,
      echapper(p.niveau),
      `${nomDuDetail(c.nom, `${c.precision ? `${echapper(c.precision)} · ` : ''}${echapper(p.page.carac.nom)}`)}${filet({ fondu: true, losange: true })}
        <div class="test">${disque(c.test, { taille: 'grand' })}<div>${rub('Test')}<b>${echapper(p.page.carac.nom)} ${p.page.carac.valeur}, ${pluriel(c.augmentations.n, 'Augmentation')}</b></div></div>
        ${rub(`Spécialisation d’${echapper(c.nom)}`)}${pills(p.page.specialisations, c.precision)}
        ${p.page.texte.map((t, k) => `<p class="prose" data-texte="texte de la compétence ${k + 1}">${echapper(t)}</p>`).join('')}`];
    },
    talents: (p) => {
      const tirage = (t) => `<div class="tire">${sceau(t.de, 'petit')}<div class="ligne"><span class="n" data-texte="${echapper(t.nom)}"><span>${nomDe(t.nom, t.precision)}</span>${t.doublon ? `<small class="raison">${echapper(t.doublon.raison)}</small>` : ''}</span>
        ${t.utilisation ? `<span class="pill">Utilisation ${picto('chevron_d', 12, undefined, 2)}</span>` : ''}${t.doublon ? plaque(echapper(t.doublon.relance), { taille: 'petite', classe: 'regler' }) : ''}</div></div>`;
      const page = 'sorts' in p.page
        ? `${nomDuDetail(p.page.talent, echapper(p.page.niveau))}${teteDeListe(rub(`${echapper(p.page.talent)} (${pluriel(p.page.reste.sur, 'sort')})`), reste(p.page.reste))}
          <div class="pills mineurs">${p.page.sorts.map((s) => `<span class="pill${s.retenu ? ' prise' : ' fermee'}">${echapper(s.nom)}${s.survol ? raison(echapper(p.page.refus)) : ''}</span>`).join('')}</div>
          <p class="prose pied" data-texte="texte du talent">${echapper(p.page.texte)}</p>`
        : `${medaillon(p.page.icone)}${nomDuDetail(p.page.talent, echapper(p.page.niveau))}${filet({ fondu: true, losange: true })}
          <div class="faits">${faitDu({ rubrique: 'Maxi', valeur: p.page.maxi })}${faitDu({ rubrique: 'Tests', valeur: p.page.tests })}</div>
          <p class="prose" data-texte="texte du talent">${echapper(p.page.texte)}</p>${FILIGRANE}`;
      return [`${rub('Talents de race')}<div class="deux">${p.race.acquis.map((t) => `<div class="ligne">${rond('coche', 'menu', { arme: true })}<span class="n" data-texte="${echapper(t)}">${echapper(t)}</span><span class="raison">Acquis</span></div>`).join('')}</div>
        ${rub('Au choix')}<div class="deux">${p.race.auChoix.map((o) => optionDe(o)).join('')}</div>
        ${rub(`${pluriel(p.tirages.length, 'Talent')} au d100`)}${p.tirages.map(tirage).join('')}
        ${filet({ fondu: true, losange: true })}${rub('Talent de carrière', 'un seul')}<div class="deux">${p.carriere.map((o) => optionDe(o)).join('')}</div>`,
      'Talent de carrière', page];
    },
    possessions: (p) => {
      const note = (o) => [o.note && echapper(o.note), o.nombre && `× ${o.nombre}`, o.somme !== undefined && prix(o.somme)].filter(Boolean).join(' · ');
      const objet = (o) => `<div class="objet${o.choisi ? ' choisi' : ''}"><div class="img laiton"><div>${dessinDObjet(o.id)}</div></div><b>${echapper(o.nom)}</b>${note(o) ? `<i>${note(o)}</i>` : ''}</div>`;
      const dot = (o) => `<div class="dot"><span data-texte="dotation ${echapper(o.nom)}">${nomDe(o.nom, o.precision)}</span>${note(o) ? `<small>${note(o)}</small>` : ''}</div>`;
      return [`<div class="tirage">${sceau(p.bourse.de, 'maitre')}<div class="col">${rub('Bourse')}<span class="somme chiffres">${prix(p.bourse.somme)}</span>${rub(`Statut · ${echapper(p.bourse.statut)}`, echapper(p.bourse.formule))}</div></div>
        ${filet({ fondu: true, losange: true })}${rub(`Au choix · ${echapper(p.auChoix.niveau)}`, 'un seul')}<div class="trois">${p.auChoix.options.map((o) => optionDe(o)).join('')}</div>
        ${p.dotations.map((d) => `${rub(echapper(d.rubrique))}<div class="lignes dots">${d.objets.map(dot).join('')}</div>`).join('')}`,
      'Possessions',
      `${nomDuDetail('Le bagage', `${pluriel(p.bagage.length, 'possession')} · bourse ${prix(p.bourse.somme)}`)}${filet({ fondu: true, losange: true })}
        <div class="objets">${p.bagage.map(objet).join('')}</div>
        <div class="objet-pris">${cartouche({ icone: p.pris.icone, nom: echapper(p.pris.nom), sous: echapper(p.pris.sous) })}<span class="chiffres">${prix(p.pris.prix)}</span></div>`];
    },
    identite: (p) => {
      const ecrit = (e) => `<div class="ligne-ecrite${e.saisi ? ' saisi' : ''}">${rub(echapper(e.nom))}<div class="ecrit" data-texte="${echapper(e.nom)}">${echapper(e.texte)}${e.saisi ? '<u></u>' : ''}${picto('plume', 16, undefined, 1.5)}</div></div>`;
      return [`<div class="deux">
          <div>${rub('Sexe')}<div class="plaques">${p.sexe.valeurs.map((v, k) => plaque(echapper(v), { armee: k === p.sexe.tenue, taille: 'petite' })).join('')}</div></div>
          <div>${rub('Nom', 'tiré ou écrit')}<div class="plaques">${plaque('Nom aux dés', { icone: 'de20', taille: 'petite' })}</div></div></div>
        ${ecrit({ nom: 'Nom', texte: p.nom })}${filet({ fondu: true, losange: true })}
        ${teteDeListe(rub('Physique', 'un seul tirage'), plaque('Physique aux dés', { icone: 'de20', taille: 'petite', classe: 'regler' }))}
        <div class="physique">${p.physique.map((x) => `<div class="mesure">${sceau(x.de, 'moyen')}<div>${rub(echapper(x.nom), echapper(x.formule))}<b>${echapper(x.valeur)}</b></div></div>`).join('')}</div>`,
      'Identité',
      `${nomDuDetail(p.nom, `${echapper(p.espece)} · ${echapper(p.carriere)}`)}${filet({ fondu: true, losange: true })}
        <div class="faits quatre">${p.physique.map((x) => faitDu({ rubrique: x.nom, valeur: x.valeur })).join('')}</div>
        ${p.ecrits.map(ecrit).join('')}<div class="signature">${SIGNATURE}${sceau(p.marque, 'moyen')}</div>`];
    },
    presentation: (p) => [`<div class="tete">${portrait(p.buste, { taille: 'affiche' })}<div class="q"><div class="nom" data-texte="nom">${echapper(p.nom)}</div><div class="l">${echapper(p.espece)}</div><div class="l">${echapper(p.carriere)} · ${echapper(p.classe)}</div>
        <div class="faits">${p.physique.map(faitDu).join('')}</div></div></div>
      <div class="bl">${rub('Blessures')}<span class="chiffres">${p.blessures.n} / ${p.blessures.sur}</span></div>${jauge(p.blessures.n / p.blessures.sur, { taille: 'forte' })}
      ${filet({ fondu: true, losange: true })}<div class="reserves">${p.reserves.map(RESERVE).join('')}</div>${filet({ fondu: true, losange: true })}
      <div class="faits trois">${faitDu({ rubrique: 'Signe astral', valeur: p.signe })}${faitDu({ rubrique: 'Statut', valeur: p.statut })}${faitDu({ rubrique: 'Bourse', valeur: prix(p.bourse) })}</div>
      ${rub('Motivation')}<div class="motivation" data-texte="motivation">${echapper(p.motivation)}</div>`,
    echapper(p.carriere),
    `<div class="profil-c"><div class="fond">${p.profil.map((x) => `<div class="c"><span class="ab">${x.carac}</span><span class="v">${x.valeur}</span></div>`).join('')}</div></div>
      ${rub('Compétences')}<div class="deux competences">${p.competences.map((x) => `<div class="ligne"><span class="n" data-texte="${echapper(x.nom)}">${nomDe(x.nom, x.precision)}</span><span class="val">${x.valeur}</span></div>`).join('')}</div>
      ${rub('Talents')}${pills(p.talents)}`, 'ident'],
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
  const teteDe = (id, nom, lignes) => `<div class="tete">${portrait(id, { taille: 'affiche' })}<div class="q"><div class="nom" data-texte="nom">${echapper(nom)}</div>${lignes.map((l) => `<div class="l">${l}</div>`).join('')}</div></div>`;
  const bandeDu = (profil, caseDe) => cadre('bande', null, null, null, null, 'parchemin', profil.map(caseDe).join(''), { ruban: 'Caractéristiques', classe: 'bande' });

  /* la fiche du héros : l'identité, le profil, la figure, les sections ; les possessions ouvertes, la ligne pressée */
  const mainDu = (libelle, m, prise) => `<div class="main${m ? '' : ' vide'}${prise ? ' refusee' : ''}"><i>${libelle}</i>${m ? `${picto(m.id, 16, undefined, 1.5)}<b data-texte="main ${echapper(m.nom)}">${echapper(m.nom)}</b>` : `<b>${prise ? 'Prise' : 'Vide'}</b>`}</div>`;
  const setDu = (s) => `<div class="set${s.enMain ? ' en-main' : ''}">${mainDu('Main principale', s.principale, false)}${mainDu('Main secondaire', s.secondaire, !!s.deuxMains)}
    <div class="oter">${rond('croix', 'menu', s.refus ? { ferme: true } : { arme: true })}${s.refus && s.survol ? raison(echapper(s.refus)) : ''}</div></div>`;
  const objetDu = (o) => `<div class="ligne${o.pressee ? ' choisie' : ''}">${picto(o.id, 17, undefined, 1.5)}<span class="n" data-texte="${echapper(o.nom)}">${nomDe(o.nom, o.precision)}</span><span class="raison">${o.ou ? echapper(o.ou) : `× ${o.nombre}`}</span></div>`;
  /* les gestes de la ligne ouverte : deux par rang, celui qui va vers quelque chose sur tout le rang */
  const gesteDObjet = (g) => plaque(`${echapper(g.libelle)}${g.refus && g.survol ? raison(echapper(g.refus)) : ''}`, { armee: !!g.principal, fermee: !!g.refus, prix: g.vers ? echapper(g.vers) : null, taille: 'petite', classe: g.vers ? 'large' : '' });
  const ouvertDu = (o) => `<div class="ouvert">${cartouche({ icone: o.icone, nom: echapper(o.nom), sous: echapper(o.sous), texte: 'objet ouvert' })}
    ${o.faits ? `<div class="faits trois">${o.faits.map(faitDu).join('')}</div>` : ''}
    ${o.lier ? `${rub('Lier à un sort', 'd’Arcane ou de Domaine, connu')}<div class="deux">${o.lier.map((s) => optionDe({ nom: s.nom, ...(s.choisi ? { choisie: true } : {}) }, `<span class="cout">NI ${s.ni}</span>`)).join('')}</div>` : ''}
    ${o.entrainement ? `${teteDeListe(rub('S’entraîner'), jeton(`${px(o.entrainement.px)} à dépenser`, 'or'))}${o.entrainement.paliers.map((x) => `<div class="achat">${x.acquis ? rond('coche', 'menu', { arme: true }) : '<i class="trou"></i>'}<span class="n" data-texte="${echapper(x.texte)}">${echapper(x.texte)}</span>${x.acquis ? `<span class="rub">${px(x.px)} · acquis</span>` : plaque(px(x.px), { taille: 'petite' })}</div>`).join('')}` : ''}
    ${o.faveur ? `<p class="prose nature" data-texte="nature de la Faveur">${echapper(o.faveur.nature)}</p><div class="achat"><span class="n">Activités consécutives à l’interlude</span><span class="val">${o.faveur.solde.n} / ${o.faveur.solde.sur}</span></div>
      <div class="consequence rub">Rompre : ${echapper(o.faveur.rompre)}</div>` : ''}
    <div class="gestes-o">${o.gestes.map(gesteDObjet).join('')}</div></div>`;
  const faveurDu = (f) => `<div class="ligne${f.pressee ? ' choisie' : ''}">${sceau('parchemin', 'menu')}<span class="n" data-texte="${echapper(f.creancier)}">${echapper(f.creancier)}</span><span class="raison">${echapper(f.niveau)} · ${f.solde.n} / ${f.solde.sur}</span></div>`;
  const ficheDuHeros = (f) => {
    const h = f.identite;
    return [
      '<div id="mur" class="bois"></div>',
      cadre('identite', null, null, null, null, 'parchemin', `${teteDe(h.id, h.nom, [echapper(h.espece), echapper(h.carriere)])}
        <div class="bl">${rub('Blessures')}<span class="chiffres">${h.blessures.n} / ${h.blessures.sur}</span></div>${jauge(h.blessures.n / h.blessures.sur, { taille: 'forte' })}
        ${filet({ fondu: true, losange: true })}<div class="reserves">${h.reserves.map(RESERVE).join('')}</div>`, { classe: 'pan ident' }),
      bandeDu(f.profil, (x) => `<div class="c"><span class="ab">${x.carac}</span><span class="v">${x.valeur}</span></div>`),
      cadre('figure', null, null, null, null, 'bois', `<div class="niche laiton"><div>${figure(1)}</div></div>`, { classe: 'pan figure' }),
      cadre('sections', null, null, null, null, 'parchemin', `${rub('Sets d’armes', 'celui que le héros tient est cerné de laiton')}
        <div class="sets">${f.sets.map(setDu).join('')}<div class="set neuf">${picto('plus', 18, undefined, 1.8)}</div></div>
        <div class="inventaire"><div class="liste">${rub('Porté')}<div class="lignes">${f.porte.map(objetDu).join('')}</div>
          ${rub('En vrac et rangé')}<div class="lignes">${f.vrac.map(objetDu).join('')}</div>
          ${f.faveurs ? `${rub('Faveurs dues')}<div class="lignes">${f.faveurs.map(faveurDu).join('')}</div>` : ''}</div>${ouvertDu(f.ouvert)}</div>`,
      { tete: onglets(f.sections.map(echapper), echapper(f.ouverte)), classe: 'pan sections' }),
      bandeauDu(f.groupe), croix(), coins(),
    ];
  };

  /* la progression : l'identité qui porte les PX et ce que le niveau exige ; ses gestes, ou le niveau achevé */
  const exigence = (e) => `<div class="exige">${e.fait ? rond('coche', 'menu', { arme: true }) : '<i class="trou"></i>'}<span data-texte="${echapper(e.texte)}">${echapper(e.texte)}</span>${e.compte ? `<span class="cpt chiffres">${e.compte.n} / ${e.compte.sur}</span>` : ''}</div>`;
  const identiteQuiProgresse = (h) => cadre('identite', null, null, null, null, 'parchemin', `${teteDe(h.id, h.nom, [echapper(h.espece), echapper(h.niveau), `${echapper(h.classe)} · niveau ${h.rang}`])}
    <div class="bourse-px"><div class="px laiton"><div>${h.px}</div></div><div><b>PX à dépenser</b>${h.apres === undefined ? '' : rub('', `${h.apres} après cet achat`)}</div></div>
    ${filet({ fondu: true, losange: true })}${rub(`Pour achever ${echapper(h.niveau)}`)}<div class="exigences">${h.exigences.map(exigence).join('')}</div>
    <div class="pied">${h.acheve ? `<div class="acheve">${jeton('Niveau achevé', 'or')}${rub('', echapper(h.note))}</div>`
    : `${h.gestes.map((g) => plaque(echapper(g.libelle), { fermee: !!g.refus, prix: g.px ? px(g.px) : null, classe: 'gauche' })).join('')}${rub('', echapper(h.note))}`}</div>`, { classe: 'pan ident' });
  const caseDeProgression = (x) => `<div class="c${x.carriere ? ' carr' : ''}"><span class="ab">${x.carac}</span><span class="v">${x.valeur}</span><span class="aug">${x.augmentations ? `+${x.augmentations}` : ''}</span>${x.px ? jeton(px(x.px), x.carriere ? 'or' : 'fer') : ''}</div>`;
  const competenceAAugmenter = (c) => {
    const tete = `<span class="fait">${c.exigee ? picto('coche', 15, undefined, 2.4) : ''}</span>${car(c.carac)}<span class="n" data-texte="${echapper(c.nom)} ${echapper(c.precision ?? '')}">${nomDe(c.nom, c.precision)}</span>`;
    const achat = `<span class="aug chiffres">+${c.augmentations}</span><span class="val">${c.pressee ? `${c.test} <span>→</span> ${c.test + 1}` : c.test}</span>${plaque(px(c.px), { armee: !!c.pressee, taille: 'petite' })}`;
    if (c.aDesigner && !c.specialisations) return `<div class="achat creneau">${tete}<span class="rub designer">À désigner</span>${picto('chevron_d', 15, undefined, 2)}</div>`;
    return `<div class="achat${c.pressee ? ' vise' : ''}">${tete}${achat}</div>${c.specialisations ? `<div class="depli">${pills(c.specialisations.noms, c.specialisations.retenue)}${plaque('Désigner', { prix: 'sans achat', taille: 'petite' })}</div>` : ''}`;
  };
  const talentAPrendre = (t) => `<div class="talent${t.refus ? ' clos' : ''}">${medaillon(t.icone, { taille: 'moyen', ferme: !!t.refus })}<div class="t"><b data-texte="${echapper(t.nom)}">${echapper(t.nom)}</b><i>${echapper(t.sous)}</i></div>${plaque(t.refus ? echapper(t.refus) : px(t.px), { fermee: !!t.refus, taille: 'petite' })}</div>`;
  const sortAApprendre = (s) => `<div class="achat sort"><span class="n" data-texte="${echapper(s.nom)}">${echapper(s.nom)}</span><span class="cout">NI ${s.ni}</span>${s.composant === undefined ? plaque(px(s.px), { taille: 'petite' }) : plaque('Composant', { prix: prix(s.composant), taille: 'petite', classe: 'composant' })}</div>`;
  const depense = (d) => [
    '<div id="mur" class="bois"></div>', identiteQuiProgresse(d.identite), bandeDu(d.profil, caseDeProgression),
    cadre('competences', null, null, null, null, 'parchemin', `${teteDeListe(rub('De la carrière', 'une Augmentation à la fois'), '<span class="rub colonnes"><span>Test</span><span>Coût</span></span>')}
      ${d.competences.map(competenceAAugmenter).join('')}
      <div class="achat hors"><span class="fait">${picto('cadenas', 15, undefined, 1.6)}</span><span class="n">Hors carrière <small>(${pluriel(d.horsCarriere, 'Compétence')})</small></span><span class="rub designer">Coût doublé</span>${picto('chevron_d', 15, undefined, 2)}</div>`, { ruban: 'Compétences', classe: 'pan' }),
    cadre('talents', null, null, null, null, 'parchemin', d.talents
      ? `${rub(echapper(d.talents.rubrique), echapper(d.talents.note))}${d.talents.talents.map(talentAPrendre).join('')}`
      : `${d.sorts.listes.map((l) => `${rub(echapper(l.rubrique), echapper(l.note))}${l.sorts.map(sortAApprendre).join('')}`).join('')}<div class="pied-de-bourse">${bourse({ heros: echapper(d.sorts.bourse.heros), avoir: prix(d.sorts.bourse.avoir) })}</div>`,
    { tete: onglets(['Talents', 'Sorts'], d.ouvert), classe: 'pan' }),
    bandeauDu(d.groupe), croix(), coins(),
  ];
  /* le changement de carrière : le chemin et ses stations, la page du niveau visé, une autre carrière */
  const station = (s) => `<div class="station ${s.etat}"><div class="pt">${s.etat === 'faite' ? rond('coche', 'petit', { arme: true }) : s.etat === 'visee' ? medaillon('etoile', { taille: 'petit' }) : '<i class="clou-fer"></i>'}${s.px ? jeton(px(s.px), 'or') : ''}</div>
    <div class="et"><b data-texte="station ${echapper(s.nom)}">${echapper(s.nom)}</b><i>Niveau ${s.niveau} · ${echapper(s.statut)}${s.tenu ? ` · tenu${s.acheve ? ', achevé' : ''}` : ''}</i></div>${s.refus && s.survol ? raison(echapper(s.refus)) : ''}</div>`;
  const changement = (c) => [
    '<div id="mur" class="bois"></div>', identiteQuiProgresse(c.identite),
    cadre('chemin', null, null, null, null, 'parchemin', `<div class="suite"><i class="rail"></i><i class="rail fait"></i>${c.chemin.stations.map(station).join('')}</div>`, { ruban: `${echapper(c.chemin.carriere)} · ${echapper(c.chemin.classe)}`, classe: 'chemin' }),
    cadre('vise', null, null, null, null, 'parchemin', `<div class="page-c">${nomDuDetail(c.vise.nom, `${echapper(c.vise.carriere)} · niveau ${c.vise.niveau} · Statut ${echapper(c.vise.statut)}`)}${filet({ fondu: true, losange: true })}
      <div class="ouvre">${c.vise.ouvre.map((o) => `${rub(echapper(o.rubrique))}${pills(o.noms)}`).join('')}</div>
      <p class="prose note" data-texte="note du niveau">${echapper(c.vise.note)}</p>${plaque(echapper(c.vise.geste), { armee: true, prix: px(c.vise.px), classe: 'devenir' })}</div>`, { ruban: echapper(c.vise.ruban), classe: 'pan' }),
    cadre('autre', null, null, null, null, 'parchemin', `${c.autre.arrivee ? `<div class="plaques">${c.autre.arrivee.valeurs.map((v, k) => plaque(echapper(v), { armee: k === c.autre.arrivee.tenue, taille: 'petite' })).join('')}</div>` : ''}<div class="deux">
      <div>${rub('Classe')}<div class="lignes">${c.autre.classes.map((x) => `<div class="ligne${x.choisie ? ' choisie' : x.fermee ? ' refusee' : ''}">${picto(x.id, 17, undefined, 1.5)}<span class="n" data-texte="${echapper(x.nom)}">${echapper(x.nom)}</span><span class="cout">${px(x.px)}</span></div>`).join('')}</div></div>
      <div>${rub('Carrière', c.autre.arrivee ? '' : 'au premier niveau')}<div class="lignes">${c.autre.carrieres.map((o) => optionDe(o)).join('')}</div></div></div>
      ${rub('', echapper(c.autre.note))}`, { ruban: 'Autre carrière', classe: 'pan' }),
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
    ? { feuilles: ['combat/combat.css', 'voyage/navale.css'], scripts: ['lieux-et-nuit/bustes.js', 'lieux-et-nuit/commun.js', 'combat/jet.js', 'combat/socle.js', 'voyage/voyage.js', 'voyage/navale.js'], poser: dossier, tracer: peindreLeDossier }
    : { feuilles: ['lieux-et-nuit/commun.css', 'heros/heros.css'], scripts: ['lieux-et-nuit/bustes.js', 'lieux-et-nuit/commun.js', 'heros/heros.js'], poser: (e) => HEROS_EN_FICHE(e)[0](e), tracer: (e) => HEROS_EN_FICHE(e)[1]?.() };
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
  /* 2. Gestion : sur la table, les options, les sauvegardes, le Compendium ou la coop ; le carnet posé sur la salle ; la
     nouvelle partie dans la salle commune ; la fin de séance sur le jeu */
  const OUTILS = { feuilles: ['accueil-et-systeme/options.css', 'outils/outils.css'], scripts: ['outils/outils.js'] };
  const SUR_LA_TABLE = 'domaines' in etat ? { feuilles: ['accueil-et-systeme/options.css'], scripts: [], poser: ecranDesOptions }
    : 'familles' in etat ? { ...OUTILS, poser: compendium }
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
    g.tracer?.(etat);
    if (etat.pose?.role === 'fiche') FIGURES[qui(etat.pose.fiche.qui).buste](document.getElementById('figure-lue'));
    await document.fonts.ready;
    globalThis.RAPPORT_DU_RENDU = {};
  })().catch((e) => { globalThis.RAPPORT_DU_RENDU = { erreur: String(e) }; throw e; });
}
