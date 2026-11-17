/* Suite du combat, images d'intention (#3935) : magie (surincantation, Incantation Critique, contre-sort, dissipation,
   Focalisation, Incantation Imparfaite, corruption) et réactions (maladresse, désengagement, fuite, Destin, Chance), chacune dans le bandeau du bas.
   Se charge après `../combat/combat.js`, dont il reprend les pièces et qui dessine le champ, l'ordre, le journal et le
   bandeau d'un état de base (`data-etat="jet"`, `data-variante`) ; ce script y pose l'état `data-suite`. Maquette hors du jeu. */
{
const SUITE = ECRAN.dataset.suite;
const $ = (s) => document.querySelector(s);

/* ───────── pièces du bandeau ───────── */
const pas = (pleins, total, classe = '') => `<div class="pas petit ${classe}">${Array.from({ length: total }, (_, k) => `<i class="${k < pleins ? '' : 'vide'}"></i>`).join('')}</div>`;
/* le bandeau et l'annonce de l'état de base cèdent leur place au bandeau de la suite */
const poser = (titre, classe, contenu, suites) => {
  const [premier, ...autres] = document.querySelectorAll('#jet, #issue');
  autres.forEach((e) => e.remove());
  premier.outerHTML = bandeauDuJet(titre, classe, contenu, suites); clouer($('#jet'));
};

/* ───────── l'ordre, le round, le journal ───────── */
const CHAMANE = 'Chamane gobelin';
const ordre = (...r) => { $('#ordre').innerHTML = r.join(''); };
const round = (n, t) => { $('#round .n').textContent = `Round ${n}`; $('#round .t').innerHTML = t; };
const journal = (...l) => { const j = $('#journal'); j.querySelectorAll('p').forEach((p) => p.remove()); j.insertAdjacentHTML('beforeend', l.join('')); };

/* ───────── les marques du champ ───────── */
const CASE_CIBLE = S.querySelector('path.case-cible');
const HALO = S.querySelector('ellipse[fill="#e0553a"]');
const PIONS = HALO ? HALO.parentNode : null;
const sousLesPions = (tag, attrs) => S.insertBefore(el(S, tag, attrs), PIONS);
const surLesPions = (tag, attrs) => S.insertBefore(el(S, tag, attrs), PIONS.nextSibling);
const cerner = (i, j) => sousLesPions('path', caseDeCible(i, j));
/* la cible passe d'un pion à un autre : sa case et son halo */
const viser = (i, j) => {
  const [x, y] = P(i, j);
  CASE_CIBLE.setAttribute('d', caseDeCible(i, j).d);
  HALO.remove(); sousLesPions('ellipse', { cx: x, cy: y, rx: 42, ry: 20, fill: '#e0553a', opacity: .5, filter: 'url(#f6)' });
};
/* le Dôme du Chamane, sur son pion */
const dome = () => { const [x, y] = P(...GOBELIN); grad('dome', [[0, '#bcd3ff', .05], [.7, '#8fb0f0', .16], [1, '#dbe6ff', .5]], { cx: .5, cy: .9, r: .9 }, 'radialGradient');
      surLesPions('path', { d: `M${x - 66},${y + 2}A66,30 0 0 0 ${x + 66},${y + 2}`, fill: 'none', stroke: '#dbe6ff', 'stroke-width': 1, 'stroke-opacity': .5, 'stroke-dasharray': '3 5' });
      surLesPions('path', { d: `M${x - 66},${y + 2}A66,74 0 0 1 ${x + 66},${y + 2}A66,30 0 0 1 ${x - 66},${y + 2}Z`, fill: 'url(#dome)', stroke: '#dbe6ff', 'stroke-width': 1.3, 'stroke-opacity': .75 }); };
/* LDB 19 l.47-53 : ce qu'une exposition modérée décide, la ligne tombée marquée */
const enjeuModere = (tombee = '') => `<div class="enjeu"><div class="l rubrique">Ce que le Test décide</div>
  <table>${[['echec', 'Échec', '+2 Points'], ['minime', 'Succès Minime, 0 ou 1 DR', '+1 Point'], ['succes', 'Succès, 2 DR et plus', 'aucun']].map(([cle, issue, gain]) => `<tr${cle === tombee ? ' class="tombee"' : ''}><td>${issue}</td><td>${gain}</td></tr>`).join('')}</table></div>`;

const ETATS = {
  /* LDB 47 l.15-17 ; `src/noyau/fenetreDIncantation.ts:44`, `ecran.incantation.pas`, `ecran.incantation.cibles` */
  surincantation() {
    cerner(...GOBELIN);
    journal(vieux('Tireur gobelin maîtrise sa psychologie (Animosité).'), vieux('Orc maîtrise sa psychologie (Animosité).'), neuf('Ilyanwe la Voilée incante Fléchette.'));
    const axe = (nom, alloues, valeur) => `<div class="axe"><span class="rubrique">${nom}</span>${pas(alloues, 2)}<b>${valeur}</b>${moinsPlus({ moins: alloues > 0, plus: alloues < 2 })}</div>`;
    const sansObjet = (nom) => `<div class="axe ferme"><span class="rubrique">${nom}</span><em>sans objet</em></div>`;
    poser('Incantation', 'sur', `
      ${camp({ portrait: portrait('ilyanwe', 'heros'), nom: 'Ilyanwe la Voilée', carac: 'Langue (Magick)', seuil: 85, des: ['30', '4'], total: 34, dr: '+5', reussite: true })}
      <div id="verdict" class="surinc">
        <div class="sort"><div class="sous rubrique">Sort · Niveau d’incantation 0</div><div class="dr gothique">Fléchette</div>
          <p data-texte="consigne">Cibles supplémentaires : 1 / 1, à cliquer sur la carte.</p></div>
        <div class="axes"><div class="t"><span class="rubrique">Surincantation</span><b class="gothique" data-texte="pas">1 pas sur 2</b></div>
          ${axe('Cibles', 1, '2 cibles')}${axe('Portée', 0, '×1')}${sansObjet('Zone')}${sansObjet('Durée')}</div>
      </div>
      <div class="cibles-du-sort">${[['orc', 'Orc', 'Cible du sort'], ['gobelin', 'Tireur gobelin', 'Cible supplémentaire']].map(([g, n, r]) => `<div class="c-s">${portrait(g, 'ennemi')}<div><div class="n gothique">${n}</div><div class="c rubrique">${r}</div></div></div>`).join('')}</div>`, apresLeDe({ heros: RESERVES.ilyanwe }));
  },

  /* LDB 46 l.26-32 ; `reglage.incantation.effetCritique`, `src/noyau/fenetreDIncantation.ts:107-113`,
     `cf.surincantationPleinePuissance`, `cf.surincantationIrresistible` */
  'incantation-critique'() {
    journal(vieux('Tireur gobelin maîtrise sa psychologie (Animosité).'), vieux('Orc maîtrise sa psychologie (Animosité).'), neuf('Ilyanwe la Voilée incante Fléchette : Critique (33) !'));
    poser('Incantation Critique', 'debut effet-critique', `
      ${camp({ portrait: portrait('ilyanwe', 'heros'), nom: 'Ilyanwe la Voilée', carac: 'Langue (Magick) · Fléchette sur Orc', seuil: 85, des: ['30', '3'], total: 33, dr: '+5', reussite: true, verdict: 'critique' })}
      ${carte('Incantation Critique', 'Le Sort inflige aussi<br>une Blessure Critique', { armee: true })}
      ${carte('Puissance totale', 'Lancé quels que soient NI et DR<br>Peut être Dissipé')}
      ${carte('Force inéluctable', 'Ne peut pas être Dissipé')}`, apresLeDe({ heros: RESERVES.ilyanwe }));
  },

  /* LDB 46 l.156 ; `valeur.declaration.*`, `reglage.contreSort.declaration`, fiche `user-doctrine-declaration-avant-jets` */
  'contre-sort-declaration'() { this.contreSort(false); },
  'contre-sort'() { this.contreSort(true); },
  contreSort(tombe) {
    viser(...GOBELIN);
    round(1, 'tour 3<br>sur 4');
    ordre(G('actif', CHAMANE), O(), borne(2), I('fantome'), Be('fantome loin'));
    journal(vieux('Ilyanwe la Voilée lance Fléchette sur Orc.'), vieux('Berta se met en Défensive.'), neuf(`${CHAMANE} incante Fléchette sur Berta.`));
    if (!tombe) poser('Contre-sort', 'debut', `
      <div class="annonce"><div class="dr gothique">Fléchette</div><div class="sous rubrique">${CHAMANE} · Cible : Berta</div></div>
      ${carte('Contrer seul', 'Langue (Magick) ≤ 85 contre ≤ 52<br>Berta à 6 m · portée 62 m', { armee: true })}
      ${carte('S’unir', 'Test Soutenu, même Domaine', { fermee: true })}
      ${carte('Passer', 'Un seul Contre-sort par Round')}`,
    `${plaque('Déclarer', { armee: true })}${plaque('Annuler')}`);
    else poser('Contre-sort', '', `
      ${camp({ portrait: portrait('ilyanwe', 'heros'), nom: 'Ilyanwe la Voilée', carac: 'Langue (Magick)', seuil: 85, des: ['40', '2'], total: 42, dr: '+4', reussite: true })}
      ${verdict('Fléchette · Cible : Berta', 'DR net +2', 'Contre-sort d’Ilyanwe la Voilée : le Sort est dissipé.')}
      ${camp({ cote: 'droite', portrait: portrait('gobelin', 'ennemi'), nom: CHAMANE, carac: 'Langue (Magick)', seuil: 52, des: ['7', '30'], total: 37, dr: '+2', reussite: true })}`, apresLeDe({ heros: RESERVES.ilyanwe }));
  },

  /* LDB 46 l.158-160 ; `src/noyau/combatSlice.ts:2002-2006`, `ecran.offre.dissipation`, `src/data/spells.json`
     (`dome`, `arme-aethyrique`) */
  'dissipation-entree'() {
    viser(...GOBELIN); dome();
    round(2, 'tour 1<br>sur 4');
    ordre(I('actif'), Be(), G('', CHAMANE), O(), borne(3), I('fantome'), Be('fantome loin'));
    journal(vieux(`${CHAMANE} lance Arme aethyrique.`), vieux(`${CHAMANE} s’abrite sous un Dôme.`), neuf('Berta se met en Défensive.'));
    poser('Dissipation', 'debut destin', `
      <div class="camp dissipeur">${portrait('ilyanwe', 'heros')}
        <div><div class="n gothique">Ilyanwe la Voilée</div><div class="c rubrique">Langue (Magick) ≤ 85</div>
        <span class="modif rubrique">Coûte l’Action</span></div>
      </div>
      ${carte('Dôme', 'Niveau d’incantation 7<br>Test étendu : 7 DR à cumuler', { armee: true })}
      ${carte('Arme aethyrique', 'Niveau d’incantation 2<br>Test étendu : 2 DR à cumuler')}
      ${vise('gobelin', CHAMANE, 'Porteur désigné', '11 / 11')}`,
    `${plaque('Dissiper', { armee: true })}${plaque('Annuler')}`);
  },

  /* LDB 46 l.160 ; `src/noyau/pendings.ts:735`, `cs.dispelRoll` */
  dissipation() {
    viser(...GOBELIN);
    dome();
    round(2, 'tour 1<br>sur 4');
    ordre(I('actif'), Be(), G('', CHAMANE), O(), borne(3), I('fantome'), Be('fantome loin'));
    journal(vieux(`${CHAMANE} s’abrite sous un Dôme.`), vieux('Berta se met en Défensive.'), neuf('Ilyanwe la Voilée entame la Dissipation du Dôme.'));
    poser('Dissipation', 'seul', `
      ${camp({ portrait: portrait('ilyanwe', 'heros'), nom: 'Ilyanwe la Voilée', carac: 'Langue (Magick) · coûte l’Action', seuil: 85, des: ['50', '1'], total: 51, dr: '+3', reussite: true })}
      <div id="verdict" class="sort etendu"><div class="sous rubrique">Test étendu · Niveau d’incantation 7</div><div class="dr gothique">Dôme</div>
        <div class="cumul">${pas(5, 7)}<b class="rubrique" data-texte="cumul">5 DR sur 7</b></div>
        <p data-texte="phrase d'issue">Le Dôme vacille : encore 2 DR pour le dissiper.</p></div>
      ${vise('gobelin', CHAMANE, 'Lanceur du Sort visé', '11 / 11')}`, apresLeDe({ heros: RESERVES.ilyanwe }));
  },

  /* LDB 46 l.128-136 ; `src/noyau/pendings.ts:725`, `fenetre.focalisation`, `cs.focusProgress` */
  focalisation() {
    journal(vieux('Orc maîtrise sa psychologie (Animosité).'), vieux('Berta se met en Défensive.'), neuf('Ilyanwe la Voilée focalise la magie du Dôme.'));
    poser('Focalisation', 'focal', `
      ${camp({ portrait: portrait('ilyanwe', 'heros'), nom: 'Ilyanwe la Voilée', carac: 'Focalisation', seuil: 62, des: ['20', '4'], total: 24, dr: '+4', reussite: true })}
      <div id="verdict" class="sort etendu"><div class="sous rubrique">Test étendu · Niveau d’incantation 7</div><div class="dr gothique">Dôme</div>
        <div class="cumul">${pas(4, 7)}<b class="rubrique" data-texte="cumul">4 DR sur 7</b></div>
        <p data-texte="phrase d'issue">Focalisation : 4/7 DR.</p></div>
      <div class="enjeu"><div class="l rubrique">Ce que la Focalisation ouvre</div>
        <table><tr><td>7 DR cumulés</td><td>NI 0 au prochain Round</td></tr><tr><td>Critique</td><td>lançable au prochain Round</td></tr><tr><td>Incantation manquée</td><td>magie perdue</td></tr></table></div>`, apresLeDe({ heros: RESERVES.ilyanwe }));
  },

  /* LDB 46 l.36-55, l.85-89 ; `codex.fiche.influenceMalfaisante`, `step.incantationImparfaiteMineure` */
  'incantation-imparfaite'() {
    journal(vieux('Orc maîtrise sa psychologie (Animosité).'), vieux('Ilyanwe la Voilée lance Fléchette sur Orc.'), neuf('Les Vents s’emballent autour d’Ilyanwe la Voilée.'));
    poser('Incantation Imparfaite', 'critique', `
      <div class="camp touche lanceur">${portrait('ilyanwe', 'heros')}
        <div><div class="n gothique">Ilyanwe la Voilée</div><div class="c rubrique">Influence malfaisante</div>
        <div class="des">${d10('10')}${d10('8')}<div class="issue"><b>8 aux unités</b><span>du jet d’Incantation</span></div></div></div>
      </div>
      <div id="critique"><div class="tete-c"><div class="dr gothique">Rupture</div><div class="tirage"><div class="resultat">33</div><span class="rubrique">Incantation Imparfaite Mineure<br>tirée au d100</span></div></div>
        <p data-texte="texte de la table">Votre nez, vos yeux et vos oreilles saignent abondamment. Gagnez 1d10 États Hémorragique.</p></div>`,
    plaque('Continuer', { armee: true }));
  },

  /* LDB 19 l.29, l.47 ; `src/noyau/fenetreDeCorruption.ts:32`, `reglage.corruption.nature`. Hors combat : la cour
     vidée de ses adversaires (`data-variante="victoire"`), sans le voile de fin. */
  'test-de-corruption'() {
    S.querySelector('rect[fill="#06040a"]').remove();
    poser('Corruption', 'corruption', `
      <div class="camp expose">${portrait('berta', 'heros')}
        <div><div class="n gothique">Berta</div><div class="c rubrique">Exposition modérée</div>
        <div class="points"><div class="l rubrique"><span>Points de Corruption</span><b>2 / 6</b></div>${pas(2, 6, 'cire')}</div></div>
      </div>
      <div class="nature"><div class="l rubrique">Nature de la Corruption</div>
        <div class="deux">${carte('Résistance', 'Influence physique · ≤ 45', { armee: true })}${carte('Calme', 'Corruption spirituelle · ≤ 40')}</div></div>
      ${enjeuModere()}`,
    avantLeDe({ heros: RESERVES.berta }));
  },

  /* LDB 19 l.47-53 ; LDB 10 l.1016-1020 ; `src/noyau/flowVerbs.ts:84`, `verbe.resister` ; au survol de
     la plaque fermée : `jet.ferme.sansResistance` */
  'test-de-corruption-tombe'() {
    S.querySelector('rect[fill="#06040a"]').remove();
    poser('Corruption', 'corruption tombe', `
      ${camp({ portrait: portrait('berta', 'heros'), nom: 'Berta', carac: 'Résistance · Exposition modérée', seuil: 45, des: ['70', '2'], total: 72, dr: '−3' })}
      ${verdict('Influence physique · Points de Corruption 2 / 6', '+2 Points', 'Berta cède à l’Influence corruptrice : 4 Points de Corruption sur 6.')}
      ${enjeuModere('echec')}`,
    `${apresLeDe({ heros: RESERVES.berta, echec: true })}${plaque('Résistance', { fermee: true })}`);
  },

  /* LDB 19 l.70, l.76 ; LDB 17 l.67 ; #3001 ; `src/noyau/corruptionFlow.ts:369-371`, `cor.thresholdFail`,
     `cor.renounceTitle`, `src/noyau/choixDeFenetre.ts:246` */
  'corruption-mutation'() {
    round(1, 'tour 2<br>sur 4');
    ordre(Be('actif'), G(), O(), borne(2), I('fantome'), Be('fantome loin'));
    journal(vieux('Berta : +2 Points de Corruption (total 7).'), vieux('Berta : la Corruption déborde son seuil.'), neuf('Berta échoue à contenir sa Corruption.'));
    poser('La mutation menace', 'debut destin', `
      <div class="camp touche lanceur">${portrait('berta', 'heros')}
        <div><div class="n gothique">Berta</div><div class="c rubrique">Points de Corruption 7 / 6</div>
        ${reserves([RESERVES.berta.resilience, 'Résilience'])}</div>
      </div>
      ${carte('Je te renie !', '−1 Résilience · aucune mutation<br>Les Points de Corruption restent', { armee: true })}
      ${carte('Muter', '−3 Points, le Bonus de Force Mentale<br>La mutation se tire au d100', { classe: 'funeste' })}`,
    plaque('Confirmer', { armee: true }));
  },

  /* LDB 14 l.17-30 ; `src/data/oups.json`, `jet.maladresse`, `if.fumble` */
  maladresse() {
    journal(vieux('Orc maîtrise sa psychologie (Animosité).'), vieux('Ilyanwe la Voilée charge Orc (+1 Avantage).'), neuf('Ilyanwe la Voilée : maladresse (66) !'));
    poser('Maladresse', 'critique', `
      <div class="camp touche lanceur">${portrait('ilyanwe', 'heros')}
        <div><div class="n gothique">Ilyanwe la Voilée</div><div class="c rubrique">Échec sur un double : 66</div>
        <div class="des">${d10('60')}${d10('4')}<div class="resultat">64</div><div class="issue"><b>Tableau</b><b>des Oups !</b></div></div></div>
      </div>
      <div id="critique"><div class="dr gothique">Oups !</div>
        <p data-texte="texte de la table">Vous trébuchez franchement et peinez à vous redresser. Vous perdez votre prochain Mouvement.</p></div>`,
    plaque('Continuer', { armee: true }));
  },

  /* LDB 15 l.43-49, l.59-66 ; `src/noyau/pendings.ts:1268`, `reglage.desengagement.*`, `jet.desengagement`,
     fiche `user-arbitrage-raison-de-refus-au-survol-jamais-inline` */
  desengagement() {
    journal(vieux('Ilyanwe la Voilée charge Orc (+1 Avantage).'), vieux('Orc touche Ilyanwe la Voilée au bras droit.'), neuf('Ilyanwe la Voilée veut rompre le combat.'));
    poser('Se désengager', 'debut', `
      <div class="annonce"><div class="dr gothique">Engagée</div><div class="sous rubrique">Avantage 0 · Orc 1</div></div>
      ${carte('Sacrifier l’Avantage', `Quitter le combat sans Test${raison('Il faut plus d’Avantages que l’adversaire.')}`, { fermee: true })}
      ${carte('Esquive', 'Test opposé ≤ 44 · coûte l’Action')}
      ${carte('Fuir', 'Orc : +1 Avantage, coup dans le dos +20<br>Touchée : encore +1, Test de Calme', { armee: true })}`,
    `${plaque('Fuir', { armee: true })}${plaque('Annuler')}`);
  },

  /* LDB 15 l.59-66 ; `src/noyau/pendings.ts:1280-1300`, `src/noyau/jetsEnVue.ts:276-285`, `src/data/regles.json`
     (`touche-en-fuyant`), `cs.fleeBackstab` */
  fuite() {
    journal(vieux('Orc touche Ilyanwe la Voilée au bras droit.'), vieux('Ilyanwe la Voilée veut rompre le combat.'), neuf('Ilyanwe la Voilée fuit — Orc frappe dans le dos.'));
    poser('Fuite', '', `
      ${camp({ portrait: portrait('ilyanwe', 'heros'), nom: 'Ilyanwe la Voilée', carac: 'Calme · Touché en fuyant', seuil: 52, des: ['70', '1'], total: 71, dr: '−2' })}
      ${verdict('Hache · coup dans le dos', '3 États Brisé', 'Orc touche Ilyanwe la Voilée dans le dos : elle fuit, Brisée.')}
      ${camp({ cote: 'droite', portrait: portrait('orc', 'ennemi'), nom: 'Orc', carac: 'Corps à corps (Base) · Avantage 2', seuil: 75, des: ['4', '20'], total: 24, dr: '+5', modif: 'Dos tourné +20', reussite: true })}`, apresLeDe({ heros: RESERVES.ilyanwe, echec: true }));
  },

  /* LDB 17 l.29-32 ; `src/noyau/choixDeFenetre.ts:234`, `valeur.issue.*`, `ecran.destin.*`, `fenetre.destin` */
  'sauvetage-par-le-destin'() {
    ordre(O('actif'), borne(2), I('fantome', 0), Be('fantome loin'));
    S.querySelector('rect[fill="#b9412c"][x="681"]').setAttribute('width', 0);
    journal(vieux('Orc s’avance vers Ilyanwe la Voilée.'), vieux('Orc attaque Ilyanwe la Voilée.'), neuf('Orc touche Ilyanwe la Voilée : un coup fatal.'));
    poser('Le Destin', 'debut destin', `
      <div class="camp touche lanceur">${portrait('ilyanwe', 'heros')}
        <div><div class="n gothique">Ilyanwe la Voilée</div><div class="c rubrique">Un coup fatal.</div>
        ${reserves([2, 'Destin'])}</div>
      </div>
      ${carte('Éviter le coup', '−1 Destin · elle reste au combat', { armee: true })}
      ${carte('Survivre hors du combat', '−1 Destin · elle quitte la rencontre')}
      ${carte('Accepter son sort', 'Sans sacrifice, le héros meurt.', { classe: 'funeste' })}`,
    plaque('Confirmer', { armee: true }));
  },

  /* LDB 17 l.23-25 ; LDB 12 l.38 ; `verbe.relancer`, `verbe.ajouterUnDR`, `jet.ferme.sansChance` */
  'relance-a-la-chance'() {
    journal(vieux('Ilyanwe la Voilée charge Orc (+1 Avantage).'), vieux('Ilyanwe la Voilée rate son attaque (98).'), neuf('Ilyanwe la Voilée relance son Test (Chance).'));
    poser('Attaque', '', `
      ${camp({ portrait: portrait('ilyanwe', 'heros'), nom: 'Ilyanwe la Voilée', carac: 'Corps à corps (Armes d’hast)', seuil: 48, des: ['20', '7'], total: 27, dr: '+2', modif: 'Avantage +10', reussite: true })}
      ${verdict('Bâton de combat · Orc · <span class="relance">relancé, <s>98</s></span>', 'DR net +6', 'Ilyanwe la Voilée touche Orc au corps.')}
      ${camp({ cote: 'droite', portrait: portrait('orc', 'ennemi'), nom: 'Orc', carac: 'Parade', seuil: 35, des: ['0', '70'], total: 70, dr: '−4' })}`,
    apresLeDe({ heros: { ...RESERVES.ilyanwe, chance: RESERVES.ilyanwe.chance - 1 }, relance: true, survol: 'relancer' }));
  },
};
ETATS[SUITE]();
}
