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
  };

  /* une carte de choix : son nom ou le combattant qu'elle nomme, son détail ligne à ligne (une ligne en liste), sa marque */
  const ligneDeCarte = (l) => (typeof l === 'string' ? echapper(l)
    : 'contre' in l ? `${echapper(l.test)} ≤ ${l.seuil} contre ≤ ${l.contre}`
      : 'seuil' in l ? `${echapper(l.test)} · ≤ ${l.seuil}`
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
      const sur = `${echapper(c.sur)}${etat.titre?.jourDeVoyage ? ` · ${jourDe(etat.titre.jourDeVoyage, etat.decor)}` : ''}`;
      return c.dr === undefined ? ['avant', reglages(sur, `<div class="dr gothique">Test simple</div><p data-texte="phrase">${echapper(c.phrase)}</p>`)] : ['', verdict(sur, `DR ${signe(c.dr)}`, echapper(c.phrase))];
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
  /* le groupe du bandeau ; ses bourses, quand le lieu les montre */
  const bandeauDu = (groupe, html = () => '') => bandeau(Object.fromEntries(groupe.map((h) => { const d = h.dit ? ditDe(h.dit) : {}; return [h.id, { ...d, choisi: !!h.choisi, html: `${d.html ?? ''}${html(h)}` }]; })),
    { groupe: groupe.map((h) => ({ id: h.id, nom: echapper(h.nom), car: echapper(h.carriere), pv: h.blessures, max: h.max, bourse: h.bourse === undefined ? '' : prix(h.bourse) })), bourses: groupe.some((h) => h.bourse !== undefined) });
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
      ${ligneDu('Cargaison en cale', p.cargaison === null ? 'pillée' : `${p.cargaison} Enc`)}${ligneDu('Pillage, si soumission', `${p.pillage} % · valeur maison`)}`, { ruban: 'La sommation', classe: 'bord' }),
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
     loin) ; assombri sous l'arrêt */
  const peindreLeVoyage = (v) => {
    toile().innerHTML = v.decor === 'route' ? D.route({ pont: true })
      : v.decor === 'fleuve' ? D.fleuve({ barrage: v.arret?.vignette === 'barrage' })
        : D.mer(v.vapeur ? { x: 1400, s: 0.42, cogue: { vapeur: true } } : { x: 690 });
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
  const partsDu = (parts) => bourse({ parts: parts.map((p) => [prenomDe(p.heros), prix(p.part), prix(p.avoir)]), total: prix(parts.reduce((t, p) => t + p.part, 0)) });
  /* une voie de la page (`../lieux-et-nuit/soins.js`) : son Test, ce qu'elle fait, son prix */
  const voieDu = (v) => acteDeSoin(v.id, echapper(v.nom), echapper(v.test), echapper(v.texte), { pris: !!v.prise, prix: v.prix === undefined ? '' : `${prix(v.prix)}${v.maison ? '<small>valeur maison</small>' : ''}` });

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
  const postesDu = (postes, decor) => `<div data-piece="postes">${postes.map((p) => { const [cx, y] = PLACES_DES_POSTES[decor][p.id];
    return poste(cx, y, { nom: `${echapper(p.nom)}${p.refus && p.survol ? raison(echapper(p.refus)) : ''}`, sous: `${echapper(p.sous)}${p.prix === undefined ? '' : ` · ${prix(p.prix)}`}`, icone: PICTO_DU_ROLE[p.id], heros: p.tenants ?? [], plus: !!p.place, ferme: !!p.refus, vise: !!p.vise }); }).join('')}</div>`;
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
  /* le médecin dans son cabinet, pointé sur lui ; la page des soins (`../lieux-et-nuit/soins.js`) à droite */
  const soins = (s) => {
    const patient = etat.groupe.find((h) => h.id === s.patient.qui);
    return [
      titreDuLieu(s.titre, 'soin'), railDu(s.rail),
      hote({ id: 'medecin', x: 400, y: 236, l: 340, icone: s.hote.icone, nom: echapper(s.hote.nom), sous: `${echapper(s.hote.qualite)} · ${echapper(s.hote.competence.nom)} ${s.hote.competence.seuil}`, pointe: 230, corps: `<p>${echapper(s.hote.dit)}</p>` }),
      pageDesSoins({ ruban: 'Les soins du docteur', patient: echapper(patient.nom), blessures: patient.blessures, max: patient.max, mal: echapper(s.patient.mal), actes: s.actes.map(voieDu).join(''),
        pied: `<table class="compte"><tr class="total"><td>À payer</td><td>${prix(s.aPayer)}</td></tr></table>${bourse({ heros: prenomDe(s.patient.qui), avoir: prix(s.avoir) })}${plaque(echapper(s.action), { armee: true, icone: 'bourse', classe: 'payer' })}` }),
      bandeauDu(s.groupe), retour(echapper(s.retour)), coins(),
    ];
  };

  /* ───────── le commerce ───────── */
  const PICTO_DE_LA_DENREE = { laine: 'ballot', vin: 'tonneau', bois: 'planches', luxe: 'joyau', cereales: 'epi' };
  const PICTO_DU_PORTEUR = { charrette: 'charrette', mule: 'fer_a_cheval', cale: 'navire' };
  const ligneDePorteur = (libelle, valeur) => `<div class="porteur-ligne"><span>${libelle}</span><b class="chiffres">${valeur}</b></div>`;
  const libres = (porte, charge) => `${charge - porte} / ${charge} Enc libres`;
  const lotDu = (l) => `<div class="lot${l.pris ? ' pris' : ''}">${picto(PICTO_DE_LA_DENREE[l.denree], 16)}<span>${echapper(l.nom)}</span><span class="chiffres">${l.enc} Enc</span></div>`;
  const gestesDeLOffre = (gestes) => `<div class="gestes">${gestes.map((g) => plaque(echapper(g.libelle), { armee: !!g.principal, taille: 'petite' })).join('')}</div>`;
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
  const pageDu = (p) => page('page', echapper(p.titre), `<div class="tete"><h3 data-texte="page">${echapper(p.nom)}</h3><span class="sous rubrique">${echapper(p.sous)}</span></div>
    ${p.blocs.map((b, k) => `${SOUS_UN_FILET.includes(b.bloc) && p.blocs[k - 1]?.bloc !== 'nombre' ? filet() : ''}${BLOCS[b.bloc](b)}`).join('')}
    ${p.gestes.length > 1 ? `<div class="deux">${p.gestes.map((g) => plaque(echapper(g.libelle), { armee: !!g.principal, classe: 'conclure' })).join('')}</div>` : p.gestes.map((g) => plaque(echapper(g.libelle), { armee: !!g.principal, classe: 'conclure' })).join('')}
    ${p.note ? `<div class="note"><i>${echapper(p.note)}</i></div>` : ''}`);
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
    ...(c.fenetre ? [fenetre(c.fenetre)] : [bandeauDu(c.groupe), retour(echapper(c.retour), c.carte ? 'route' : 'sortie')]), coins(),
  ];
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
    /* 2. Gestion */
    gestion: { feuilles: ['lieux-et-nuit/commun.css', 'accueil-et-systeme/systeme.css', 'accueil-et-systeme/options.css'], scripts: ['lieux-et-nuit/bustes.js', 'lieux-et-nuit/commun.js', 'accueil-et-systeme/systeme.js'], poser: ecranDesOptions },
    /* 3. Fiche : le dossier d'une possession */
    fiche: { feuilles: ['combat/combat.css', 'voyage/navale.css'], scripts: ['lieux-et-nuit/bustes.js', 'lieux-et-nuit/commun.js', 'combat/jet.js', 'combat/socle.js', 'voyage/voyage.js', 'voyage/navale.js'], poser: dossier, tracer: peindreLeDossier },
  };
  /* 4. Lieu et voyage : un décor par lieu, ses feuilles et ses scripts */
  const LIEU = { feuilles: ['lieux-et-nuit/commun.css'], scripts: ['lieux-et-nuit/bustes.js', 'lieux-et-nuit/commun.js'] };
  const ROUTE = { feuilles: [...LIEU.feuilles, 'voyage/voyage.css', 'combat/jet.css', 'combat-suite/suite.css'], scripts: [...LIEU.scripts, 'voyage/voyage.js', 'combat/jet.js', 'combat-suite/decors.js'] };
  const VOYAGE = { ...ROUTE, scripts: [...LIEU.scripts, 'voyage/voyage.js', 'combat/jet.js'], poser: voyage, tracer: peindreLeVoyage };
  const NUIT = { feuilles: [...LIEU.feuilles, 'lieux-et-nuit/nuit.css'], poser: nuit };
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
  };
  GABARITS['lieu-et-voyage'] = DECORS[etat.decor];

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
