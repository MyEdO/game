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

const jeu = ETAT === 'jet';
const ui = [];
const I = (c = '', pv = 17) => combattant('ilyanwe', 'heros', 'Ilyanwe la Voilée', pv, 17, c);
const Be = (c = '') => combattant('berta', 'heros', 'Berta', c.includes('fantome') ? 12 : PV_BERTA, 12, c, COUCHEE && !c.includes('fantome') ? etatPorte('aTerre', { presse: VAR === 'retirer' }) : '');
const G = (c = '', nom = 'Tireur gobelin') => combattant('gobelin', 'ennemi', nom, 11, 11, c);
const O = (c = '') => combattant('orc', 'ennemi', 'Orc', PV_ORC, 14, c, COUCHEE ? etatPorte('hemorragique', { n: 2 }) : '');
const SECOND = DEBUT || VAR === 'journal';
const ROUND = DEBUT ? 'le round<br>débute' : ADVERSE ? 'tour 4<br>sur 4' : BERTA_JOUE ? 'tour 2<br>sur 4' : 'tour 1<br>sur 4';
ui.push(SYSTEME);
if (!FIN) {
  ui.push(`<div id="round" class="cadre bois" data-piece="round"><div class="fond bois"><div class="n gothique">Round ${SECOND ? 2 : 1}</div><div class="t rubrique">${ROUND}</div></div>${ferrures}</div>`);
  ui.push(`<div id="ordre" data-piece="ordre">
  ${(ADVERSE ? [O('actif'), borne(2), I('fantome'), Be('fantome loin')]
    : DEBUT ? [I(), Be(), G(), O(), borne(3), I('fantome'), Be('fantome loin')]
    : BERTA_JOUE ? [Be('actif'), G(), O(), borne(2), I('fantome'), Be('fantome loin')]
    : [I('actif'), Be(VAR === 'fiche' ? 'lu' : ''), G(), O(), borne(SECOND ? 3 : 2), I('fantome'), Be('fantome loin')]).join('')}
</div>`);
  const GOB = 'Tireur gobelin maîtrise sa psychologie (Animosité).', ORCP = 'Orc maîtrise sa psychologie (Animosité).', CHARGE = 'Ilyanwe la Voilée charge Orc (+1 Avantage).';
  const TIR = 'Tireur gobelin tire sur Berta et la manque.', AVANCE = 'Orc s’avance vers Ilyanwe la Voilée.';
  const LIGNES = {
    adverse: vieux('Berta se met en Défensive.') + vieux(TIR) + neuf(AVANCE),
    aTerre: vieux(GOB) + vieux(ORCP) + neuf('Berta est À Terre.'),
    tireur: vieux(GOB) + vieux(ORCP) + neuf('Ilyanwe la Voilée se met en Défensive.'),
    piece: vieux(ORCP) + vieux('Ilyanwe la Voilée se met en Défensive.') + neuf('Berta sert la Baliste.'),
    montee: vieux(GOB) + vieux(ORCP) + neuf('Ilyanwe la Voilée se met en Défensive.'),
    siege: vieux(ORCP) + vieux('Ilyanwe la Voilée se met en Défensive.') + neuf('Berta sert le Mortier.'),
    journal: '',
  }[VAR] ?? (jeu ? vieux(GOB) + vieux(ORCP) + neuf(CHARGE) : borneJ('Le combat commence ! (Round 1)') + vieux(GOB) + neuf(ORCP));
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
  /* `fenetre.victoire` (`src/i18n/messages/fr.ts:483`) */
  ui.push(`<div id="issue" data-piece="issue"><div class="toile-ombre"><div class="toile"><span class="gothique" data-texte="issue">Victoire</span></div></div></div>`);
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
  /* LDB 14 l.180 ; `fenetre.cibleDeMonture`, `verbe.cibleDeMonture.cible`, `verbe.cibleDeMonture.fermer` (`fr.ts:458`,
     `fr.ts:295`, `fr.ts:354`) ; `src/noyau/choixDeFenetre.ts:247-252` */
  if (VAR === 'montee') ui.push(bandeauDuJet('Combat monté', 'debut', `
    <div class="camp">${portrait('berta', { taille: 'grand' })}<div><div class="n gothique">Berta</div><div class="c rubrique">Épée</div></div></div>
    ${carte('Tireur gobelin', 'Cavalier <span class="modif rubrique">−10 au Test</span>', { armee: true, portrait: portrait('gobelin', { camp: 'ennemi' }) })}
    ${carte('Cheval', 'Monture', { portrait: portrait('cheval', { camp: 'ennemi' }) })}`,
  `${plaque('Cibler', { armee: true })}${plaque('Annuler')}`));
  /* AA 10 l.169, l.171 ; `fenetre.viseeDeSiege`, `consigne.poseDeLaZone`, `verbe.viseeDeSiege.fermer` (`fr.ts:484`,
     `fr.ts:4454`, `fr.ts:372`) ; `src/noyau/combatSlice.ts:1024-1031`, `src/noyau/combatFlow.ts:5949` */
  else if (VAR === 'siege') ui.push(bandeauDuJet('Viser', 'consigne', `
    <div class="camp">${portrait('berta', { taille: 'grand' })}<div><div class="n gothique">Berta <span class="modif rubrique" style="vertical-align:3px;margin-left:6px">Pilonnage</span></div><div class="c rubrique">Mortier</div></div></div>
    <p class="consigne" data-texte="consigne">Cliquez la case où poser la zone.</p>`,
  plaque('Annuler')));
  else ui.push(bandeauDuJet('Attaque', '', `
    ${camp({ portrait: portrait('ilyanwe', { taille: 'grand' }), nom: 'Ilyanwe la Voilée', carac: 'Corps à corps (Armes d’hast)', seuil: 48, des: ['90', '8'], total: 98, dr: '−5', modif: 'Avantage +10' })}
    <div id="verdict"><div class="sous rubrique">Bâton de combat · Cible : Orc</div><div class="dr gothique">DR net +1</div><p>Ilyanwe la Voilée rate son attaque ; Orc gagne +1 Avantage.</p></div>
    ${camp({ cote: 'droite', portrait: portrait('orc', { camp: 'ennemi', taille: 'grand' }), nom: 'Orc', carac: 'Parade', seuil: 35, des: ['0', '70'], total: 70, dr: '−4' })}`, apresLeDe({ heros: RESERVES.ilyanwe, echec: true })));
}
monter(ui);
if (VAR === 'fiche') FIGURES.berta(document.getElementById('figure-lue'));
