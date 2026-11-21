/* Le socle du jet, images d'intention (#3935) : le bandeau du bas et ses pièces, avant le dé (testeur, réglages)
   comme après (les deux camps, le verdict), les réserves du héros. Se pose sur le combat (`socle.js`) comme sur un `commun.js`, sur les pièces de `../gestes.js` ; le portrait
   d'un camp arrive déjà dessiné. Se charge après `../gestes.js`.
   Maquette hors du jeu. */
/* le camp d'un testeur dans sa place de la fenêtre, `gauche` ou `droite` : quatre places (`PLACES`, `../rendu.js`), le
   portrait, l'identité (le nom, le Test sur deux lignes au plus), la rangée du seuil, des deux dés et du sceau du total,
   dont l'état porte le verdict (vert la réussite, cerclé d'or le critique, rouge l'échec), l'issue sous le portrait (le
   verdict écrit et le DR, une ligne, de la couleur du verdict) ; un dé qui se règle porte son − et son + dessous ;
   `survol` : le seuil survolé porte la bulle des influences du jet, une ligne chacune */
const camp = ({ cote = '', portrait, nom, carac, seuil, des = ['', ''], regles = false, total = null, dr = null, influences = [], survol = null, reussite = false, critique = false }) => fiche({
  cote, portrait, nom, ligne: carac,
  rangee: `<div class="des${regles ? ' regles' : ''}" data-primitive="camp"><span class="seuil">≤ ${seuil}${survol === 'seuil' ? raison(influences.join('<br>')) : ''}</span>${des.map((d) => (regles ? `<div class="de-regle">${d10(d)}${moinsPlus()}</div>` : d10(d))).join('')}${sceau(total ?? '', 'grand', { etat: total == null ? 'vide' : critique ? 'reussite critique' : reussite ? 'reussite' : '' })}</div>`,
  issue: total == null ? '' : `<div class="issue ${critique ? 'critique' : reussite ? 'reussite' : 'echec'}" data-primitive="camp"><b>${critique ? 'Critique' : reussite ? 'Réussite' : 'Échec'}</b> DR ${dr}</div>`,
});
/* qui occupe un camp de la fenêtre, quel que soit son rôle (testeur, cible, lanceur visé, interlocuteur, touché) : les
   places du camp (`PLACES_DU_CAMP`, `../rendu.js`), en miroir à droite : le portrait, l'identité (le nom, la ligne de
   son rôle), la rangée sous l'identité (les dés, une jauge, une réplique), l'issue */
const fiche = ({ cote = '', portrait, nom, ligne, rangee = '', issue = '', classe = '' }) => `
  <div class="camp ${cote} ${classe}" data-primitive="fiche">${places('fenetre', {
    [`${cote || 'gauche'}-portrait`]: portrait,
    [`${cote || 'gauche'}-identite`]: `<div class="n gothique" data-primitive="fiche">${nom}</div><div class="c rubrique" data-primitive="fiche" data-texte="Test">${ligne}</div>`,
    [`${cote || 'gauche'}-des`]: rangee,
    [`${cote || 'gauche'}-issue`]: issue,
  })}</div>`;
/* le verdict d'un jet tombé, au centre : le cadre du centre et cinq places fixes (`PLACES`, `../rendu.js`), les mêmes
   quelle que soit la situation : sur quoi il porte (`sous`) ; la grande ligne, l'issue en un mot générique (`mot`) de la
   couleur de l'issue (`sens` : reussite, echec, critique) ; la ligne des conséquences (`consequences`) ; le DR en petit
   (`dr`) ; la phrase d'issue. Rend le contenu de chaque place de la fenêtre */
const verdict = ({ sous, mot, sens, consequences, dr, phrase }) => ({
  centre: '<div id="verdict" class="grille" data-primitive="verdict"></div>',
  'issue-sous': `<div class="sous rubrique" data-primitive="verdict" data-texte="sous-titre">${sous}</div>`,
  'issue-mot': `<div class="issue-du-jet gothique ${sens}" data-primitive="verdict" data-texte="issue"><span>${mot}</span></div>`,
  'issue-consequences': consequences,
  'issue-dr': `<div class="dr-du-jet rubrique" data-primitive="verdict" data-texte="DR">${dr}</div>`,
  'issue-phrase': `<p class="phrase-du-jet" data-primitive="verdict" data-texte="phrase d'issue">${phrase}</p>`,
});
/* les conséquences d'un jet, une pièce chacune, de la couleur de son ton (`gain`, `perte`) : son pictogramme et sa
   valeur ; son nom, sa cible et son détail dans la bulle de son survol (fiche `user-doctrine-icone-identifie-survol-detaille`) ;
   sans pictogramme, son nom écrit, la pièce marquée `data-sans-icone` */
const consequences = (liste) => `<div class="consequences" data-primitive="consequences">${liste.map(({ icone, nom, valeur, ton, survol, bulle }) => `<span class="consequence ${ton}"${icone ? '' : ' data-sans-icone'}${icone ? ` title="${bulle}"` : ''}>${icone ?? `<span class="nom">${nom}</span>`}${valeur ? `<b>${valeur}</b>` : ''}${survol ? raison(bulle) : ''}</span>`).join('')}</div>`;
/* le bandeau, à la place de la barre de l'actif ou du bandeau des héros : ses places (`PLACES`, `../rendu.js`), la rangée
   des gestes, une place par plaque (`plaques`, une liste) et la réserve qu'elles dépensent */
const bandeauDuJet = (titre, classe, contenu, plaques, reserve = '') => cadre('jet', null, null, null, null, `parchemin ${classe}`, `
  ${contenu}
  <div id="suites" data-primitive="bandeauDuJet" data-place="fenetre/gestes">${reserve ? `<div class="place" data-primitive="bandeauDuJet" data-emplacement="place" data-place="fenetre/reserve">${reserve}</div>` : ''}${plaques.map((p, k) => `<div class="place" data-primitive="bandeauDuJet" data-emplacement="place" data-place="fenetre/plaque-${k + 1}">${p}</div>`).join('')}</div>
`, { ruban: titre, tete: clouer(), piece: 'fenetre' });

/* ───────── avant le dé : qui teste, ce qui se règle ───────── */
/* au bout des gestes : les héros qui peuvent porter le Test, celui qui le porte choisi */
const testeurs = (genres, choisi = 0) => `<div class="testeurs" data-primitive="testeurs"><span class="rubrique">Testeur</span>${genres.map((g, k) => `<div class="t${k === choisi ? ' choisi' : ''}">${portrait(g, { taille: 'menu', choisi: k === choisi })}</div>`).join('')}</div>`;
/* les réglages d'un jet avant le dé, au centre : le cadre du centre (le même que celui du jet tombé) et ses places
   fixes (`PLACES_DU_REGLAGE`, `../rendu.js`), les mêmes quelle que soit la situation : sur quoi il porte (`sous`) ; la
   sorte du Test et sa difficulté (`mot`) ; la figure (la silhouette des localisations) ; les lignes de réglage, une par
   place (`lignes`, rangées par leur rang) ; les cartes de choix ou d'enjeu (`cartes`) ; le cumul d'un Test étendu ; la
   phrase. Une nature absente laisse sa place vide. Rend le contenu de chaque place de la fenêtre */
const reglage = ({ sous, mot, figure = '', lignes = [], cartes = [], cumul = '', phrase = '' }) => ({
  centre: '<div id="verdict" class="grille" data-primitive="reglage"></div>',
  'reglage-sous': `<div class="sous rubrique" data-primitive="reglage" data-texte="sous-titre">${sous}</div>`,
  'reglage-mot': `<div class="sorte-du-jet gothique" data-primitive="reglage" data-texte="sorte">${mot}</div>`,
  'reglage-figure': figure,
  ...Object.fromEntries(lignes.map((l, k) => [`reglage-ligne-${k + 1}`, l])),
  ...Object.fromEntries(cartes.map((c, k) => [`reglage-carte-${k + 1}`, c])),
  'reglage-cumul': cumul,
  'reglage-phrase': phrase && `<p class="phrase-du-jet" data-primitive="reglage" data-texte="phrase">${phrase}</p>`,
});
/* un choix exclusif court : une plaque par option, la choisie en laiton plein */
const options = (liste) => `<div class="options" data-primitive="options">${liste.map(([libelle, o = {}]) => plaque(libelle, { taille: 'petite', ...o })).join('')}</div>`;
/* une option qui s'allume ou s'éteint */
const bascule = (libelle, allumee = false) => `<div class="bascule${allumee ? ' allumee' : ''}" data-primitive="bascule"><i class="fer"><b class="laiton"></b></i><span class="rubrique">${libelle}</span></div>`;

/* ───────── les gestes du bandeau ───────── */
/* les réserves d'un héros, à gauche des gestes : un jeton par réserve, chacun dans sa case de largeur fixe, son icône
   (un pictogramme, ou le portrait de qui la porte) et son disque ; son nom et sa valeur dans la bulle de son survol
   (`survol`), comme les influences du seuil (fiche `user-doctrine-icone-identifie-survol-detaille`) ; `taille` du disque */
const reserves = (r, taille = 'petit') => `<div class="en-reserve ${taille}" data-primitive="reserves">${r.map(({ valeur, icone, nom, survol = false }) => `<div class="res${valeur ? '' : ' vide'}">${icone}${disque(valeur, { taille, vide: !valeur })}${survol ? raison(`${nom} : ${valeur}`) : ''}</div>`).join('')}</div>`;
/* la silhouette des localisations : six zones, trois états (libre, choisie, touchee) */
const ZONES = {
  tete: '<circle cx="30" cy="11" r="9"/>',
  corps: '<path d="M19.500,23H40.500L39,56H21Z"/>',
  brasD: '<path d="M17,23.500L9,28L5,56L11.500,57.500L15,37L18,31Z"/>',
  brasG: '<path d="M43,23.500L51,28L55,56L48.500,57.500L45,37L42,31Z"/>',
  jambeD: '<path d="M21,58.500H29.200L28,97H20.500Z"/>',
  jambeG: '<path d="M39,58.500H30.800L32,97H39.500Z"/>',
};
const silhouette = (h, etats = {}) => `<svg class="silhouette" data-primitive="silhouette" width="${h * .6}" height="${h}" viewBox="0 0 60 100">${Object.entries(ZONES).map(([z, d]) => `<g class="zone ${etats[z] ?? ''}">${d}</g>`).join('')}</svg>`;

// Partagé avec les scripts de page chargés après celui-ci.
Object.assign(globalThis, { camp, fiche, verdict, reglage, consequences, bandeauDuJet, testeurs, options, bascule, reserves, silhouette });
