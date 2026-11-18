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
  const misePourLeChoix = (m) => ('reserve' in m ? `${pluriel(m.valeur, 'Point')} de ${echapper(m.reserve)}` : 'test' in m ? `${echapper(m.test)} ≤ ${m.seuil}` : `Critique sur ${echapper(qui(m.critiqueSur).nom)}`);
  const sansDe = (h) => `<div class="camp">${portraitDe(h.qui)}<div><div class="n gothique">${echapper(qui(h.qui).nom)}</div><div class="c rubrique">${misePourLeChoix(h.mise)}</div>${h.cout ? modif(echapper(h.cout)) : ''}</div></div>`;
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

  /* une carte de choix : son nom ou le combattant qu'elle nomme, son détail ligne à ligne, sa marque */
  const ligneDeCarte = (l) => (typeof l === 'string' ? echapper(l)
    : 'contre' in l ? `${echapper(l.test)} ≤ ${l.seuil} contre ≤ ${l.contre}`
      : 'seuil' in l ? `${echapper(l.test)} · ≤ ${l.seuil}`
        : 'ni' in l ? `Niveau d’incantation ${l.ni}`
          : 'aCumuler' in l ? `Test étendu : ${l.aCumuler} DR à cumuler`
            : `${echapper(qui(l.qui).nom)} à ${l.distance} m · portée ${l.portee} m`);
  const carteDe = (c) => {
    const lignes = c.detail.map(ligneDeCarte);
    const marque = c.marque && modif(c.marque.valeur === undefined ? echapper(c.marque.nom) : `${c.marque.valeur} ${echapper(c.marque.nom)}`);
    /* la marque suit la dernière ligne quand elle y tient, sinon passe dessous */
    const derniere = lignes.length ? lignes.pop() : '';
    const sous = [...lignes, marque ? (`${derniere}${c.marque.nom}`.length > 24 ? `${derniere}<br>${marque}` : `${derniere} ${marque}`) : derniere].join('<br>');
    return carte(echapper(c.nom ?? qui(c.qui).nom), sous, { armee: !!c.choisie, fermee: !!c.refus, classe: c.funeste ? 'funeste' : '', portrait: c.qui ? portrait(qui(c.qui).buste, { camp: qui(c.qui).ennemi ? 'ennemi' : 'heros' }) : '' });
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
      const groupes = c.groupes.length === 1 && !c.groupes[0].libelle ? c.groupes[0].cartes.map(carteDe).join('')
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
  const combat = (c) => [
    `<div id="round" class="cadre bois" data-piece="round"><div class="fond bois"><div class="n gothique">Round ${c.round}</div><div class="t rubrique">${c.tour ? `tour ${c.tour.rang}<br>sur ${c.tour.sur}` : 'le round<br>débute'}</div></div>${ferrures}</div>`,
    `<div id="ordre" data-piece="ordre">${[...c.ordre.map((id, k) => rangDe(id, k === 0 && c.tour ? 'actif' : '')), borne(c.round + 1), ...c.suivant.map((id, k) => rangDe(id, k ? 'fantome loin' : 'fantome'))].reverse().join('')}</div>`,
    `<div id="journal" data-piece="journal"><div class="tete rubrique ombre">Journal ${rond('journal', 'petit')}</div>${c.journal.map(entree).join('')}</div>`,
    `<div id="fin" class="ferme" data-piece="fin">${rond('fin', 'maitre', { ferme: true })}<span class="rubrique ombre">Fin du tour</span></div>`,
  ];

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
      titre({ icone: 'systeme', nom: echapper(o.titre.nom), sous: echapper(o.titre.sous), largeur: 392 }),
      `<div id="preferences" class="cadre bois" data-piece="préférences"><div class="fond bois">${o.son.map(pref).join('')}<div class="trait"></div>${o.jeu.map(pref).join('')}</div>${ruban('Préférences')}${ferrures}</div>`,
      `<div id="signets" data-piece="signets">${o.domaines.map((d) => `<div class="signet ${d.nom === ouvert.domaine ? `ouvert ${d.nom.length > 12 ? 'serre' : ''}` : ''}"><span class="rubrique">${echapper(d.nom)}</span>${d.modifiees ? '<i class="cire"></i>' : ''}<em class="chiffres">${d.regles}</em></div>`).join('')}</div>`,
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
    titre({ icone: 'lune', nom: echapper(b.titre), sous: `${b.date.jour} ${echapper(b.date.mois)} · ${echapper(b.moment)} · ${picto(PICTO_DU_TEMPS[b.meteo.temps], 13, '#c9b995')} ${echapper(b.meteo.ciel)}`, largeur: 436 }),
    `<div id="recit" data-piece="recit"><div class="r rubrique ombre">${echapper(b.lieu)}</div><p class="ombre">${echapper(b.recit)}</p></div>`,
    `<div id="camp" class="cadre bois" data-piece="campement"><div class="fond bois">
      <div class="rang-c"><span class="lab rubrique">Abri</span>${medaillon('tente', { taille: 'petit' })}<span class="v">${echapper(b.abri.nom)} <em>· ${echapper(b.abri.detail)}</em></span></div>
      <div class="rang-c" style="margin-bottom:0"><span class="lab rubrique">Temps</span>${sceau(PICTO_DU_TEMPS[b.meteo.temps])}<span class="v">${echapper(b.temps)}</span></div>
      ${filet({ fondu: true })}
      <div class="t rubrique">Ce que la nuit jouera</div>
      ${b.nuit.map((n) => `<div class="jouera">${rond(PICTO_DE_LA_NUIT[n.id], 'menu', { arme: true })}${echapper(n.nom)}<span class="rubrique">${echapper(n.jet)}</span></div>`).join('')}
      ${plaque(echapper(b.action), { armee: true, icone: 'lune', classe: 'nuit' })}
    </div>${ruban('Le campement')}${ferrures}</div>`,
    bandeau(Object.fromEntries(b.groupe.map((h) => [h.id, { html: `<div class="choix-h"><span class="rubrique">Couchage</span><b>${echapper(h.couchage)}</b></div><div class="choix-h"><span class="rubrique">Nourriture</span>${h.nourriture.valeurs.map((v, k) => plaque(echapper(v), { armee: k === h.nourriture.tenue, taille: 'petite' })).join('')}</div>` }])),
    { groupe: b.groupe.map((h) => ({ id: h.id, nom: echapper(h.nom), car: echapper(h.carriere), pv: h.blessures, max: h.max })) }),
    retour(echapper(b.retour), 'route'), coins(),
  ];

  /* ───────── les gabarits : leurs feuilles, leurs scripts, leur pose ───────── */
  const COUR = { feuilles: ['combat/combat.css', 'combat-suite/suite.css'], scripts: ['combat/jet.js', 'combat/socle.js', 'combat/cour.js'] };
  const GABARITS = {
    /* 6. Fenêtre du bas, posée sur le combat ou, hors combat, seule sur la cour */
    'fenetre-du-bas': { ...COUR, poser: (e) => [SYSTEME, ...(e.combat ? combat(e.combat) : []), fenetre(e.fenetre)] },
    /* 7. Issue d'un combat : le titre en toile, l'action unique dessous, le système */
    recit: { ...COUR, poser: (e) => [SYSTEME, `<div id="issue" data-piece="issue"><div class="toile-ombre"><div class="toile"><span class="gothique" data-texte="issue">${echapper(e.titre)}</span></div></div>${e.suite ? `<p class="ombre" data-texte="suite de l'issue">${echapper(e.suite)}</p>` : ''}${plaque(echapper(e.action), { armee: true, taille: 'appel' })}</div>`] },
    /* 2. Gestion */
    gestion: { feuilles: ['lieux-et-nuit/commun.css', 'accueil-et-systeme/systeme.css', 'accueil-et-systeme/options.css'], scripts: ['lieux-et-nuit/bustes.js', 'lieux-et-nuit/commun.js', 'accueil-et-systeme/systeme.js'], poser: ecranDesOptions },
    /* 4. Lieu et voyage */
    'lieu-et-voyage': { feuilles: ['lieux-et-nuit/commun.css', 'lieux-et-nuit/bivouac.css'], scripts: ['lieux-et-nuit/bustes.js', 'lieux-et-nuit/commun.js', 'lieux-et-nuit/bivouac.js'], poser: bivouac },
  };

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
    await document.fonts.ready;
    globalThis.RAPPORT_DU_RENDU = {};
  })().catch((e) => { globalThis.RAPPORT_DU_RENDU = { erreur: String(e) }; throw e; });
}
