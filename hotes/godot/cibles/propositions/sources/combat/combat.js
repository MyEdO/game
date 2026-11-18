/* Écran de combat, image d'intention (#3935) : l'interface, posée sur la cour (`cour.js`). Deux états : « tour » (le
   tour d'un héros) et « jet » (le jet d'attaque qui se résout). Se charge après `jet.js`, `socle.js` et `cour.js`.
   Maquette hors du jeu. */
/* ───────── l'interface ───────── */

const fiche = (classe, style) => `<div id="apercu" class="parchemin ${classe}" data-piece="fiche" style="${style}">
    <div class="tete"><span class="n gothique">Fléchette</span><span class="c rubrique">${VAR === 'rapides' ? 'Touche 1' : 'Sort'}</span></div>
    <div class="titre rubrique" style="margin-top:8px">Sort · coûte l’Action</div>
    <table>
      <tr><td>Niveau d’incantation</td><td>0</td></tr>
      <tr><td>Portée</td><td>Force Mentale mètres</td></tr>
      <tr><td>Cible</td><td>1</td></tr>
      <tr><td>Durée</td><td>Instantanée</td></tr>
    </table>
    <div class="pied">Un clic arme le sort, un second sur la cible le lance.</div>
  </div>`;
const rapides = (armee, noms = ['Fléchette', 'Dôme', 'Bouclier', 'Lumière', null, null]) => `<div id="rapides" class="cadre bois" data-piece="rapides"><div class="fond">
      ${noms.map((n, i) => [n, i === 0 && armee]).map(([n, a], i) => `<div class="case-r">${plaque('', { icone: n ? 'sort' : null, numero: i + 1, armee: a, fermee: !n })}<span class="rubrique">${n ?? 'Libre'}</span></div>`).join('')}
    </div>${ferrures}</div>`;
const VARIANTE = () => {
  if (VAR === 'liste') return [
    `<div id="liste" class="cadre bois" data-piece="liste"><div class="fond"><div class="t rubrique">Lancer ce sort</div>
      ${[['Dôme', 0], ['Bouclier anti-flèches', 0], ['Fléchette', 1], ['Lumière', 0]].map(([n, a]) => plaque(n, { armee: !!a, classe: 'ligne-l' })).join('')}
    </div>${ferrures}</div>`,
    fiche('a-gauche', 'left:588px;top:334px;width:300px'),
  ];
  return [rapides(1), fiche('a-gauche', 'left:588px;top:334px;width:300px')];
};

/* la silhouette des localisations : six zones, trois états (libre, choisie, touchee) */
const ZONES = {
  tete: '<circle cx="30" cy="11" r="9"/>',
  corps: '<path d="M19.500,23H40.500L39,56H21Z"/>',
  brasD: '<path d="M17,23.500L9,28L5,56L11.500,57.500L15,37L18,31Z"/>',
  brasG: '<path d="M43,23.500L51,28L55,56L48.500,57.500L45,37L42,31Z"/>',
  jambeD: '<path d="M21,58.500H29.200L28,97H20.500Z"/>',
  jambeG: '<path d="M39,58.500H30.800L32,97H39.500Z"/>',
};
const silhouette = (h, etats = {}) => `<svg class="silhouette" width="${h * .6}" height="${h}" viewBox="0 0 60 100">${Object.entries(ZONES).map(([z, d]) => `<g class="zone ${etats[z] ?? ''}">${d}</g>`).join('')}</svg>`;

const jeu = ETAT === 'jet';
const ui = [];
const I = (c = '', pv = 17) => combattant('ilyanwe', 'heros', 'Ilyanwe la Voilée', pv, 17, c);
const Be = (c = '') => combattant('berta', 'heros', 'Berta', c.includes('fantome') ? 12 : PV_BERTA, 12, c, COUCHEE && !c.includes('fantome') ? etatPorte('aTerre', { presse: VAR === 'retirer' }) : '');
const G = (c = '', nom = 'Tireur gobelin') => combattant('gobelin', 'ennemi', nom, 11, 11, c);
const O = (c = '') => combattant('orc', 'ennemi', 'Orc', PV_ORC, 14, c, COUCHEE ? etatPorte('hemorragique', { n: 2 }) : '');
const SECOND = DEBUT || VAR === 'journal';
const ROUND = DEBUT ? 'le round<br>débute' : ADVERSE ? 'tour 4<br>sur 4' : VAR === 'mortelle' ? 'tour 2<br>sur 3' : BERTA_JOUE ? 'tour 2<br>sur 4' : 'tour 1<br>sur 4';
ui.push(SYSTEME);
if (!FIN) {
  ui.push(`<div id="round" class="cadre bois" data-piece="round"><div class="fond bois"><div class="n gothique">Round ${SECOND ? 2 : 1}</div><div class="t rubrique">${ROUND}</div></div>${ferrures}</div>`);
  ui.push(`<div id="ordre" data-piece="ordre">
  ${(ADVERSE ? [O('actif'), borne(2), I('fantome'), Be('fantome loin')]
    : DEBUT ? [I(), Be(), G(), O(), borne(3), I('fantome'), Be('fantome loin')]
    : BERTA_JOUE ? [Be('actif'), VAR === 'mortelle' ? '' : G(), O(), borne(2), I('fantome'), Be('fantome loin')]
    : [I('actif'), Be(VAR === 'fiche' ? 'lu' : ''), G(), O(), borne(SECOND ? 3 : 2), I('fantome'), Be('fantome loin')]).join('')}
</div>`);
  const GOB = 'Tireur gobelin maîtrise sa psychologie (Animosité).', ORCP = 'Orc maîtrise sa psychologie (Animosité).', CHARGE = 'Ilyanwe la Voilée charge Orc (+1 Avantage).';
  const TIR = 'Tireur gobelin tire sur Berta et la manque.', AVANCE = 'Orc s’avance vers Ilyanwe la Voilée.';
  const LIGNES = {
    adverse: vieux('Berta se met en Défensive.') + vieux(TIR) + neuf(AVANCE),
    defense: vieux(TIR) + vieux(AVANCE) + neuf('Orc attaque Ilyanwe la Voilée.'),
    critique: vieux(ORCP) + vieux(CHARGE) + neuf('Ilyanwe la Voilée touche Orc (Tête) : 10 dégâts − 7 (BE+PA) = 3 Blessures — CRITIQUE !'),
    round: vieux(TIR) + vieux(AVANCE) + borneJ('Round 2'),
    tirRapide: vieux(TIR) + vieux(AVANCE) + borneJ('Round 2'),
    parade: vieux(TIR) + vieux('Orc s’avance vers Berta.') + neuf('Orc attaque Berta.'),
    riposte: vieux(TIR) + vieux('Orc s’avance vers Berta.') + neuf('Orc attaque Berta.'),
    sociale: vieux(TIR) + vieux('Orc s’avance vers Berta.') + neuf('Orc attaque Berta.'),
    aTerre: vieux(GOB) + vieux(ORCP) + neuf('Berta est À Terre.'),
    determination: vieux(GOB) + vieux(ORCP) + neuf('Berta est À Terre.'),
    retirer: vieux(GOB) + vieux(ORCP) + neuf('Berta est À Terre.'),
    tireur: vieux(GOB) + vieux(ORCP) + neuf('Ilyanwe la Voilée se met en Défensive.'),
    piece: vieux(ORCP) + vieux('Ilyanwe la Voilée se met en Défensive.') + neuf('Berta sert la Baliste.'),
    armes: vieux(GOB) + vieux(ORCP) + neuf('Berta attaque Orc.'),
    empoigner: vieux(GOB) + vieux(ORCP) + neuf('Berta attaque Orc.'),
    harpon: vieux(GOB) + vieux(ORCP) + neuf('Berta attaque Orc.'),
    localiser: vieux(GOB) + vieux(ORCP) + neuf('Berta attaque Orc.'),
    montee: vieux(GOB) + vieux(ORCP) + neuf('Ilyanwe la Voilée se met en Défensive.'),
    siege: vieux(ORCP) + vieux('Ilyanwe la Voilée se met en Défensive.') + neuf('Berta sert le Mortier.'),
    seconde: vieux(ORCP) + vieux('Berta attaque Orc.') + neuf('Berta touche Orc (Corps) : 10 dégâts − 7 (BE+PA) = 3 Blessures'),
    mortelle: vieux(ORCP) + vieux('Berta attaque Tireur gobelin.') + neuf('Berta tue Tireur gobelin d’un seul coup.'),
    journal: '',
  }[VAR] ?? (jeu && VAR !== 'incantation' ? vieux(GOB) + vieux(ORCP) + neuf(CHARGE) : borneJ('Le combat commence ! (Round 1)') + vieux(GOB) + neuf(ORCP));
  ui.push(`<div id="journal" data-piece="journal">
  <div class="tete rubrique ombre${VAR === 'journal' ? ' ouvert' : ''}">Journal ${rond('journal', 'petit', { arme: VAR === 'journal' })}</div>
  ${LIGNES}
</div>`);
  const fermee = jeu || VAR === 'adverse';
  ui.push(`<div id="fin" class="${fermee ? 'ferme' : ''}" data-piece="fin">${rond('fin', 'maitre', { ferme: fermee })}<span class="rubrique ombre">Fin du tour</span></div>`);
}

/* ───────── le meuble étendu : ce que la situation de l'actif ouvre, ses États, sa Détermination ───────── */
/* une pastille posée sur l'entité du champ qui porte l'offre (`surface: 'pastille-entite'`, `src/data/actions.json`) */
const surLEntite = ([i, j], haut, icone, libelle) => { const [x, y] = P(i, j); return `<div class="pastille-entite" data-piece="pastille ${libelle}" style="left:${x}px;top:${y - haut}px">${rond(icone, 'petit')}<span class="rubrique ombre">${libelle}</span></div>`; };
/* libellés du registre (`label`, `src/data/actions.json` ; pastilles : `ecran.offre.*`, `src/i18n/messages/fr.ts:538-557`) ;
   raison : `agate.prone` (`fr.ts:4376`) */
const MEUBLES = {
  /* LDB 15 l.45-49 ; LDB 16 l.35 ; LDB 10 l.103, l.364 ; LDB 21 l.31 */
  aTerre: {
    sous: 'Épée', portes: etatPorte('aTerre'),
    plaques: `${plaque('Attaque', { icone: 'attaque' })}${plaque(`Course${raison('ne peut que ramper : se relever d’abord')}`, { icone: 'botte', fermee: true })}${plaque('Défensive', { icone: 'defensive' })}`,
    conditionnelles: ['Se désengager', 'Se relever', 'Battement', 'Distraire', 'Frénésie'].map((o) => plaque(o, { taille: 'petite' })).join(''),
    pastilles: [['competence', 'Compétence'], ['objet', 'Objet'], ['poser', 'Poser au sol'], ['armes', 'Armes']],
  },
  /* LDB 14 (Tableau des Difficultés de Combat, « Viser ») ; LDB 62 (Recharge) */
  tireur: {
    sous: 'Arbalète', portes: '',
    conditionnelles: `${plaque('Viser', { taille: 'petite' })}${plaque('Recharger', { fermee: true, taille: 'petite' })}`,
    pastilles: [['munition', 'Munition'], ['competence', 'Compétence'], ['objet', 'Objet'], ['poser', 'Poser au sol'], ['armes', 'Armes']],
    entites: surLEntite(MONTURE, 138, 'monter', 'Monter') + surLEntite([11.5, 8.5], 86, 'servir', 'Servir'),
  },
  /* LDB 13 l.106 ; MDG 09 l.44-46 ; `docs/raw/4e/combat.md:262` */
  piece: {
    sous: 'Baliste', portes: '',
    conditionnelles: `${plaque('Recharger', { taille: 'petite' })}${plaque('Diriger l’équipe', { taille: 'petite' })}${plaque('Quitter la pièce', { icone: 'sortie', taille: 'petite' })}`,
    pastilles: [['competence', 'Compétence'], ['objet', 'Objet'], ['poser', 'Poser au sol'], ['armes', 'Armes']],
    entites: surLEntite([11.5, 8.5], 86, 'pousser', 'Pousser'),
  },
};
if (!jeu && BERTA_JOUE) {
  const m = MEUBLES[VAR];
  ui.push(...meuble({
    genre: 'berta', nom: 'Berta', sous: m.sous,
    etat: `${mesure('Blessures', `${PV_BERTA} / 12`)}${pas(PORTEE)}${jetons(RESERVES.berta.determination)}<div class="portes"><span class="rubrique">États</span>${m.portes || '<em>aucun</em>'}</div>`,
    plaques: m.plaques ?? `${plaque('Attaque', { icone: 'attaque' })}${plaque('Course', { icone: 'botte' })}${plaque('Défensive', { icone: 'defensive' })}`,
    conditionnelles: m.conditionnelles, pastilles: m.pastilles,
  }), rapides(0, Array(6).fill(null)), m.entites ?? '');
} else if (!jeu) {
  const adv = VAR === 'adverse';
  ui.push(...meuble({
    ...(adv ? { genre: 'orc', camp: 'ennemi', nom: 'Orc', sous: 'Hache', etat: mesure('Blessures', '14 / 14') }
      : { genre: 'ilyanwe', nom: 'Ilyanwe la Voilée', sous: 'Bâton de combat', etat: `${mesure('Blessures', '17 / 17')}${pas(4)}${JETONS}` }),
    adverse: adv, ouverte: VAR === 'liste' ? 'sort' : null,
    plaques: `${plaque('Attaque', { armee: SURVOL, icone: 'attaque', fermee: adv })}${plaque('Course', { icone: 'botte', fermee: adv })}${plaque('Défensive', { icone: 'defensive', fermee: adv })}`,
    pastilles: [['sort', 'Sort'], ['focaliser', 'Focaliser'], ['competence', 'Compétence'], ['poser', 'Poser au sol'], ['armes', 'Armes']],
  }));
  if (SURVOL) ui.push(`<div id="apercu" class="parchemin" data-piece="apercu">
    <div class="tete"><span class="n gothique">Orc</span><span class="c rubrique">Cible</span></div>
    <div class="pv">${jauge(1, { taille: 'forte' })}<b>14 / 14</b></div>
    <div class="titre rubrique">Attaque · Bâton de combat</div>
    <table>
      <tr class="seuil"><td>Corps à corps (Armes d’hast)</td><td>≤ 48</td></tr>
      <tr><td>dont Avantage</td><td>+10</td></tr>
      <tr><td>Dégâts</td><td>+6</td></tr>
      <tr><td>L’Orc oppose</td><td>Parade</td></tr>
    </table>
    <div class="pied">Charge : +1 Avantage. Un second clic confirme.</div>
  </div>`);
  if (VAR === 'liste' || VAR === 'rapides') ui.push(...VARIANTE());
  if (VAR === 'cible' || VAR === 'journal' || VAR === 'fiche') ui.push(rapides(0));
  if (VAR === 'journal') {
    const l = (t) => `<p data-texte="journal ${t.slice(0, 18)}">${t}</p>`, r = (t) => `<h4 class="rubrique"><span>${t}</span></h4>`;
    ui.push(`<div id="journal-entier" class="cadre bois" data-piece="journal-entier"><div class="fond parchemin">
      ${r('Round 1')}${['Le combat commence !', 'Tireur gobelin maîtrise sa psychologie (Animosité).', 'Orc maîtrise sa psychologie (Animosité).', 'Ilyanwe la Voilée rate son incantation (Fléchette).', 'Berta se met en Défensive.', 'Tireur gobelin tire sur Berta et la manque.', 'Orc s’avance dans la cour.'].map(l).join('')}
      ${r('Round 2')}${['Tireur gobelin maîtrise sa psychologie (Animosité).', 'Orc maîtrise sa psychologie (Animosité).'].map(l).join('')}
    </div>${ruban('Journal', { gothique: true })}${ferrures}</div>`);
  }
  if (VAR === 'fiche') {
    const arme = (dessin, nom, test, degats, allonge, atouts) => `<div class="arme">
        <div class="vignette laiton"><div><svg viewBox="0 0 80 80" fill="none" stroke-linecap="round" stroke-linejoin="round">${dessin}</svg></div></div>
        <div class="texte"><div class="n gothique">${nom}</div>
          <div class="mesures">${disque(test, { taille: 'grand' })}<span class="rubrique t">Test</span>
            <div class="m"><span class="rubrique">Dégâts</span><b>${degats}</b></div><div class="m"><span class="rubrique">Allonge</span><b>${allonge}</b></div></div>
          <div class="atouts">${atouts.map((a) => `<span class="rubrique">${a}</span>`).join('')}</div></div>
      </div>`;
    ui.push(`<div id="f-identite" class="cadre bois" data-piece="fiche-identite"><div class="fond parchemin">
      <div class="tete">${portrait('berta', { taille: 'maitre' })}<div><div class="n gothique">Berta</div><div class="c rubrique">Humains<br>(Reiklander)</div><div class="c rubrique">Soldate</div></div></div>
      ${mesure('Blessures', '12 / 12')}
      ${filet({ losange: true })}
      <div class="reserves">${compteur(2, 'Destin')}${compteur(2, 'Chance')}${compteur(1, 'Résilience')}${compteur(1, 'Détermination')}</div>
    </div>${ferrures}</div>`);
    ui.push(`<div id="f-profil" class="cadre bois" data-piece="fiche-profil"><div class="fond parchemin">
      ${[['M', 4], ['CC', 41], ['CT', 33], ['F', 38], ['E', 35], ['I', 31], ['Ag', 34], ['Dex', 28], ['Int', 27], ['FM', 35], ['Soc', 30], ['B', 12]].map(([a, v]) => `<div class="carac"><span class="rubrique">${a}</span><b class="chiffres">${v}</b></div>`).join('')}
    </div>${ruban('Caractéristiques', { gothique: true })}${ferrures}</div>`);
    ui.push(`<div id="f-figure" class="cadre bois" data-piece="fiche-figure"><div class="fond bois"><div class="niche laiton"><div><svg viewBox="-34 -82 68 96" id="figure-lue"></svg></div></div></div>${ferrures}</div>`);
    ui.push(`<div id="f-sections" class="cadre bois" data-piece="fiche-sections"><div class="fond parchemin">
      ${arme('<path d="M18 62L58 22l6-8-8 6L16 60z" fill="#d9d3c2" stroke="#1a1005" stroke-width="1.500"/><path d="M14 52l14 14M12 68l6-6" stroke="#e2c06a" stroke-width="3.500"/>', 'Épée', 41, '+BF+4 (7)', 'Moyenne', [])}
      ${arme('<path d="M40 12l24 8v18c0 15-10 25-24 30-14-5-24-15-24-30V20z" fill="#6f4d30" stroke="#1a1005" stroke-width="1.500"/><path d="M40 12v56M16 34h48" stroke="#e2c06a" stroke-width="2.500"/><circle cx="40" cy="34" r="6" fill="#b9b3a4" stroke="#1a1005" stroke-width="1.500"/>', 'Bouclier', 41, '+BF+2 (5)', 'Très courte', ['Bouclier 2', 'Défensive', 'Assommante'])}
    </div>${onglets(['Attaques', 'Compétences', 'Talents', 'Possessions'], 'Attaques')}${ferrures}</div>`);
    ui.push(croix());
  }
} else if (FIN) {
  /* `fenetre.victoire`, `fenetre.defaite`, `fenetre.repli`, `fenetre.aneantissement` ; `verbe.defaite.fermer`,
     `verbe.repli.fermer`, `verbe.aneantissement.fermer` (`src/i18n/messages/fr.ts:483-505`, `fr.ts:388-390`) */
  const TITRE = { victoire: 'Victoire', defaite: 'Défaite', repli: 'Repoussés', aneantissement: 'Le groupe a péri' }[VAR];
  const SORTIE = { defaite: 'Reprendre', repli: 'Poursuivre la bataille', aneantissement: 'Retour au menu' }[VAR];
  /* ADE II 08 l.175, l.223 ; `src/noyau/issueDeCombat.ts:67-84` */
  const SUITE = { repli: 'Les héros sont soignés, la bataille continue.', aneantissement: 'Aucun héros ne tient debout.' }[VAR];
  ui.push(`<div id="issue" data-piece="issue"><div class="toile-ombre"><div class="toile"><span class="gothique" data-texte="issue">${TITRE}</span></div></div>${SUITE ? `<p class="ombre" data-texte="suite de l'issue">${SUITE}</p>` : ''}${SORTIE ? plaque(SORTIE, { armee: true, taille: 'appel' }) : ''}</div>`);
  /* `PendingVictory` (`src/noyau/pendings.ts:84-99`) ; `ecran.victoire.*` (`fr.ts:1128-1130`) ; `verbe.victoire.ligne`,
     `verbe.victoire.depecer` (`fr.ts:307-308`) ; ZI 13 l.304-316 */
  if (VAR === 'victoire') {
    const ligne = (objet) => `<div class="ligne-b"><span data-texte="butin ${objet}">${objet}</span><i class="rubrique">Attribuer</i>${portrait('ilyanwe', { taille: 'menu' })}${portrait('berta', { taille: 'menu' })}</div>`;
    ui.push(bandeauDuJet('Butin', 'butin', `
      <div class="gains">${reserves([[20, 'Expérience']], 'grand')}<div class="argent"><b class="gothique">14/6</b><span class="rubrique">Argent</span></div></div>
      <div class="vaincus"><div class="t rubrique">Vaincus</div>
        <div class="v">Orc ×1</div><div class="v">Tireur gobelin ×1</div>
        <div class="v">Grand Loup ×1${options([['Dépecer']])}</div></div>
      <div class="lignes-b"><div class="t rubrique">Butin, à qui va chaque objet</div>${['Hache', 'Arc', 'Bouclier'].map(ligne).join('')}</div>`,
    plaque('Reprendre', { armee: true })));
  }
} else {
  const BERTA_P = portrait('berta', { taille: 'grand' }), ORC_P = portrait('orc', { camp: 'ennemi', taille: 'grand' });
  const regle = (libelle, corps) => `<div class="regle"><span class="l rubrique">${libelle}</span>${corps}</div>`;
  const courte = (nom, seuil, armee) => carte(nom, `≤ ${seuil}`, { armee, classe: 'courte' });
  /* LDB 13 l.167 ; LDB 13 l.123 ; AA 13 l.84 ; LDB 10 l.1037 ; `src/noyau/fenetreDeDefense.ts` ; `reglage.defense.*`,
     `defense.porteBouclier`, `defense.secondaire` (`src/i18n/messages/fr.ts:222-225`, `fr.ts:125`, `fr.ts:123`) */
  if (est('parade', 'riposte', 'sociale')) ui.push(bandeauDuJet('Défense', 'avant defense', `
    ${camp({ portrait: BERTA_P, nom: 'Berta', ...(VAR === 'sociale' ? { carac: 'Intimidation', seuil: 38 } : { carac: 'Parade', seuil: 41 }) })}
    ${reglages('Hache · Cible : Berta', `
      <div class="reactions">${courte('Parade', 41, VAR !== 'sociale')}${courte('Esquive', 34, false)}${VAR === 'sociale' ? courte('Intimidation', 38, true) : ''}</div>
      ${VAR === 'sociale' ? regle('À la place de Corps à corps', '<span class="modif rubrique">Orc a peur de Berta</span>')
    : VAR === 'parade'
    ? regle('Parer avec', options([['Épée'], ['Bouclier (2nde)', { armee: true }]])) + regle('Porte-bouclier (2 Av.)', options([['Aucun', { armee: true }], ['Dégâts'], ['Repousser']]))
    : regle('Parer avec', options([['Rapière', { armee: true }], ['Bouclier (2nde)']])) + regle('Riposte', options([['Oui', { armee: true }], ['Non']]))}`, 'haut')}
    ${camp({ cote: 'droite', portrait: ORC_P, nom: 'Orc', carac: 'Corps à corps (Base)', seuil: 35, des: ['4', '20'], total: 24, dr: '+1', reussite: true })}`,
  avantLeDe({ heros: RESERVES.berta })));
  /* LDB 10 l.767-773 ; LDB 14 l.78, l.159 ; AA 07 l.59-61 ; `src/noyau/fenetreDAttaque.ts:166-253` ; `reglage.attaque.*`,
     `attaque.armeSecondaire`, `attaque.empoigner.note` (`fr.ts:215-221`, `fr.ts:1187`, `fr.ts:1208`) ; ADE II 02 l.677 ;
     `reglage.attaque.sansLaCorde`, `attaque.sansLaCorde.noteTenue` (`fr.ts:221`, `fr.ts:1204`) */
  else if (est('armes', 'empoigner', 'harpon')) {
    const mainsNues = VAR === 'empoigner', tir = VAR === 'harpon';
    ui.push(bandeauDuJet('Attaque', 'avant armes', `
    ${camp({ portrait: BERTA_P, nom: 'Berta', ...(tir ? { carac: 'Projectiles (Arbalète)', seuil: 33 } : { carac: mainsNues ? 'Corps à corps (Bagarre)' : 'Corps à corps (Base)', seuil: 41 }) })}
    ${reglages(`${mainsNues ? 'Mains nues' : tir ? 'Lance-harpon' : 'Épée'} · Cible : Orc`, `<div class="rangee">${silhouette(92)}<div class="choix">
      ${mainsNues || tir ? '' : regle('Arme', options([['Épée', { armee: true }], ['Bouclier (2nde −20)']]))}
      ${regle('Localisation', options([['Au hasard', { armee: true }]]))}
      ${mainsNues
    ? `<div class="bascules">${bascule('Empoigner', true)}</div><p data-texte="note de l'empoignade">Sur une touche : aucun Dégât ; Empoignade + Empêtré (cible).</p>`
    : tir ? `<div class="bascules">${bascule('Tirer sans la corde (60 m, sans Immobilisante)')}</div><p data-texte="note de la corde">Corde tenue : Immobilisante, Portée 20.</p>`
    : `<div class="bascules">${bascule('Des deux armes')}${bascule('Retenir ses coups')}</div>`}
    </div></div>`, 'haut')}
    ${tir ? vise('orc', 'Orc', 'Cible du tir', '14 / 14') : camp({ cote: 'droite', portrait: ORC_P, nom: 'Orc', carac: 'Parade', seuil: 35 })}`,
    avantLeDe({ heros: RESERVES.berta, annuler: true })));
  }
  /* LDB 17 l.57-61 ; `depenserLaDetermination` ; libellés des offres `determination-*` (`src/data/actions.json`) ;
     `cs.fragGettingUp` (`fr.ts:2087`) */
  else if (est('determination', 'retirer')) ui.push(bandeauDuJet('Détermination', 'debut trois', `
    <div class="camp">${portrait('berta', { taille: 'grand' })}<div><div class="n gothique">Berta</div><div class="c rubrique">1 Point de Détermination</div></div></div>
    ${carte('Immunité Psychologie', 'jusqu’à la fin du prochain Round', { armee: VAR === 'determination' })}
    ${carte('Ignorer les modificateurs de critique', 'jusqu’au début du prochain Round')}
    ${carte('Retirer un État', 'À Terre (+1 PB en se relevant)', { armee: VAR === 'retirer' })}`,
  `${reserves([[RESERVES.berta.determination, 'Détermination de Berta']])}${plaque('Dépenser', { armee: true })}${plaque('Annuler')}`));
  /* LDB 10 l.767-773 ; LDB 14 l.5-9 ; `fenetre.secondeFrappe`, `fenetre.frappeMortelle`, `consigne.deuxArmes`,
     `consigne.frappeMortelle`, `verbe.secondeFrappe.fermer`, `verbe.frappeMortelle.fermer` (`fr.ts:489-490`, `fr.ts:4451-4452`, `fr.ts:283-284`) */
  else if (VAR === 'seconde') ui.push(bandeauDuJet('Second coup', 'consigne', `
    ${camp({ portrait: BERTA_P, nom: 'Berta', carac: 'Bouclier (2nde −20)', seuil: 21, des: ['0', '2'], modif: 'Jet inversé : 20 → 02' })}
    <p class="consigne" data-texte="consigne">Cliquez un adversaire à portée de votre seconde arme.</p>`,
  plaque('Renoncer au second coup', { classe: 'large' })));
  else if (VAR === 'mortelle') ui.push(bandeauDuJet('Enchaînement', 'consigne', `
    ${camp({ portrait: BERTA_P, nom: 'Berta', carac: 'Épée', seuil: 41, modif: 'Enchaînement 1 sur 4' })}
    <p class="consigne" data-texte="consigne">Cliquez un adversaire adjacent que vous n’avez pas encore frappé.</p>`,
  plaque('Arrêter')));
  /* LDB 17 l.25 ; LDB 11 l.97-103 ; `verbe.debutDuRound.promouvoir`, `verbe.debutDuRound.viser`, `valeur.viser.aucun`
     (`fr.ts:322-323`, `fr.ts:399`) ; `src/noyau/choixDeFenetre.ts:358-364` */
  else if (VAR === 'tirRapide') ui.push(bandeauDuJet('Début du round', 'debut deux', `
    <div class="annonce"><div class="dr gothique">Round 2</div><div class="sous rubrique">le round débute</div></div>
    <div class="groupe"><div class="t rubrique">Agir en premier</div>${carte('Berta', 'Soldate <span class="modif rubrique">1 Chance</span>', { portrait: portrait('berta') })}</div>
    <div class="groupe"><div class="t rubrique">Préempter · Tir rapide</div><div class="cartes">
      ${carte('Aucune visée', '')}
      ${carte('Berta', 'Arbalète chargée<br><span class="modif rubrique">Action et Mouvement</span>', { armee: true, portrait: portrait('berta') })}</div></div>`,
  `${reserves([[RESERVES.berta.chance, 'Chance de Berta']])}${plaque('Commencer le round', { armee: true, classe: 'large' })}`));
  /* LDB 14 l.180 ; `fenetre.cibleDeMonture`, `verbe.cibleDeMonture.cible`, `verbe.cibleDeMonture.fermer` (`fr.ts:458`,
     `fr.ts:295`, `fr.ts:354`) ; `src/noyau/choixDeFenetre.ts:247-252` */
  else if (VAR === 'montee') ui.push(bandeauDuJet('Combat monté', 'debut', `
    <div class="camp">${portrait('berta', { taille: 'grand' })}<div><div class="n gothique">Berta</div><div class="c rubrique">Épée</div></div></div>
    ${carte('Tireur gobelin', 'Cavalier <span class="modif rubrique">−10 au Test</span>', { armee: true, portrait: portrait('gobelin', { camp: 'ennemi' }) })}
    ${carte('Cheval', 'Monture', { portrait: portrait('cheval', { camp: 'ennemi' }) })}`,
  `${plaque('Cibler', { armee: true })}${plaque('Annuler')}`));
  /* AA 10 l.169, l.171 ; `fenetre.viseeDeSiege`, `consigne.poseDeLaZone`, `verbe.viseeDeSiege.fermer` (`fr.ts:484`,
     `fr.ts:4454`, `fr.ts:372`) ; `src/noyau/combatSlice.ts:1024-1031`, `src/noyau/combatFlow.ts:5949` */
  else if (VAR === 'siege') ui.push(bandeauDuJet('Viser', 'consigne', `
    <div class="camp">${BERTA_P}<div><div class="n gothique">Berta <span class="modif rubrique" style="vertical-align:3px;margin-left:6px">Pilonnage</span></div><div class="c rubrique">Mortier</div></div></div>
    <p class="consigne" data-texte="consigne">Cliquez la case où poser la zone.</p>`,
  plaque('Annuler')));
  /* LDB 17 l.68 ; `reglage.attaque.localisationDuCritique` (`fr.ts:216`) ; `src/noyau/fenetreDAttaque.ts:288-291` */
  else if (VAR === 'localiser') ui.push(bandeauDuJet('Attaque', 'avant', `
    ${camp({ portrait: BERTA_P, nom: 'Berta', carac: 'Corps à corps (Base)', seuil: 41, des: ['10', '1'], total: 11, dr: '+3', reussite: true, modif: 'Résultat choisi' })}
    <div id="verdict" class="reglages">
      <div class="rangee">${silhouette(102, { tete: 'choisie' })}
        <div class="choix"><div class="sous rubrique">Épée · Cible : Orc</div><div class="l rubrique">Localisation du Critique</div>
          <div class="v"><span class="gothique">Tête</span></div>
        </div></div></div>
    ${camp({ cote: 'droite', portrait: ORC_P, nom: 'Orc', carac: 'Parade', seuil: 35, des: ['60', '2'], total: 62, dr: '−3' })}`,
    apresLeDe({ heros: { ...RESERVES.berta, resilience: 0 } })));
  else if (VAR === 'avant') ui.push(bandeauDuJet('Attaque', 'avant', `
    ${camp({ portrait: portrait('ilyanwe', { taille: 'grand' }), nom: 'Ilyanwe la Voilée', carac: 'Corps à corps (Armes d’hast)', seuil: 28, modif: 'Avantage +10' })}
    <div id="verdict" class="reglages">
      <div class="rangee">${silhouette(102, { tete: 'choisie' })}
        <div class="choix"><div class="sous rubrique">Bâton de combat · Cible : Orc</div><div class="l rubrique">Localisation</div>
          <div class="v"><span class="gothique">Tête</span><span class="modif rubrique">−20 au Test</span></div>
          <div class="bas">${options([['Au hasard']])}${bascule('Retenir ses coups')}</div>
        </div></div></div>
    ${camp({ cote: 'droite', portrait: portrait('orc', { camp: 'ennemi', taille: 'grand' }), nom: 'Orc', carac: 'Parade', seuil: 35 })}`,
    avantLeDe({ heros: RESERVES.ilyanwe, annuler: true })));
  else if (VAR === 'defense') ui.push(bandeauDuJet('Défense', '', `
    ${camp({ portrait: portrait('ilyanwe', { taille: 'grand' }), nom: 'Ilyanwe la Voilée', carac: 'Corps à corps (Armes d’hast)', seuil: 38, des: ['60', '1'], total: 61, dr: '−3' })}
    ${verdict('Hache · Cible : Ilyanwe la Voilée', 'DR net +4', 'Orc touche Ilyanwe la Voilée au bras droit.')}
    ${camp({ cote: 'droite', portrait: portrait('orc', { camp: 'ennemi', taille: 'grand' }), nom: 'Orc', carac: 'Corps à corps (Base)', seuil: 35, des: ['4', '20'], total: 24, dr: '+1', reussite: true })}`, apresLeDe({ heros: RESERVES.ilyanwe, echec: true })));
  else if (VAR === 'incantation') ui.push(bandeauDuJet('Incantation', 'seul', `
    ${camp({ portrait: portrait('ilyanwe', { taille: 'grand' }), nom: 'Ilyanwe la Voilée', carac: 'Langue (Magick)', seuil: 85, des: ['30', '4'], total: 34, dr: '+5', reussite: true })}
    <div id="verdict" class="sort"><div class="sous rubrique">Sort · Niveau d’incantation 0</div><div class="dr gothique">Fléchette</div><p>Ilyanwe la Voilée lance Fléchette sur Orc.</p></div>
    ${vise('orc', 'Orc', 'Cible du sort', '14 / 14')}`, apresLeDe({ heros: RESERVES.ilyanwe, survol: 'relancer' })));
  else if (VAR === 'critique') ui.push(bandeauDuJet('Coup critique', 'critique duel', `
    <div class="camp">${portrait('ilyanwe', { taille: 'grand' })}<div><div class="n gothique">Ilyanwe la Voilée</div><div class="c rubrique">Critique sur Orc</div></div></div>
    <div id="critique"><div class="dr gothique">Coup percutant</div><p data-texte="texte du critique">Le sang obscurcit votre vision, et vous percevez des points blancs et des flashs de lumière. Vous obtenez 1 État Sonné.</p></div>
    <div class="camp droite touche">${portrait('orc', { camp: 'ennemi', taille: 'grand' })}${silhouette(100, { tete: 'touchee' })}
      <div><div class="n gothique">Orc</div><div class="c rubrique">Touché à la tête</div>
      <div class="des">${sceau(2, 'grand')}<div class="issue"><b>Blessures</b><b>perdues</b></div></div></div>
    </div>`,
    plaque('Continuer', { armee: true })));
  else if (VAR === 'round') ui.push(bandeauDuJet('Début du round', 'debut', `
    <div class="annonce"><div class="dr gothique">Round 2</div><div class="sous rubrique">Agir en premier</div></div>
    ${carte('Berta', 'Soldate <span class="modif rubrique">1 Chance</span>', { armee: true, portrait: portrait('berta') })}`,
    `${reserves([[RESERVES.berta.chance, 'Chance de Berta']])}${plaque('Commencer le round', { armee: true, classe: 'large' })}`));
  else ui.push(bandeauDuJet('Attaque', '', `
    ${camp({ portrait: portrait('ilyanwe', { taille: 'grand' }), nom: 'Ilyanwe la Voilée', carac: 'Corps à corps (Armes d’hast)', seuil: 48, des: ['90', '8'], total: 98, dr: '−5', modif: 'Avantage +10' })}
    <div id="verdict"><div class="sous rubrique">Bâton de combat · Cible : Orc</div><div class="dr gothique">DR net +1</div><p>Ilyanwe la Voilée rate son attaque ; Orc gagne +1 Avantage.</p></div>
    ${camp({ cote: 'droite', portrait: portrait('orc', { camp: 'ennemi', taille: 'grand' }), nom: 'Orc', carac: 'Parade', seuil: 35, des: ['0', '70'], total: 70, dr: '−4' })}`, apresLeDe({ heros: RESERVES.ilyanwe, echec: true })));
}
monter(ui);
if (VAR === 'fiche') FIGURES.berta(document.getElementById('figure-lue'));
