/* Suite du combat, images d'intention (#3935) : la mutation que la Corruption menace et les réactions (désengagement,
   fuite, Destin), chacune dans le bandeau du bas ; les autres états de la suite sont des maquettes
   (`../maquettes/`).
   Se charge après `../combat/combat.js`, dont il reprend les pièces et qui dessine sur la cour (`../combat/cour.js`)
   l'ordre, le journal et le bandeau d'un état de base (`data-etat="jet"`, `data-variante`) ; ce script y pose l'état `data-suite`. Maquette hors du jeu. */
{
const SUITE = ECRAN.dataset.suite;
const $ = (s) => document.querySelector(s);

/* ───────── pièces du bandeau ───────── */
/* le bandeau et l'annonce de l'état de base cèdent leur place au bandeau de la suite */
const poser = (titre, classe, contenu, suites) => {
  const [premier, ...autres] = document.querySelectorAll('#jet, #issue');
  autres.forEach((e) => e.remove());
  premier.outerHTML = bandeauDuJet(titre, classe, contenu, suites);
};

/* ───────── l'ordre, le round, le journal ───────── */
const ordre = (...r) => { $('#ordre').innerHTML = r.join(''); };
const round = (n, t) => { $('#round .n').textContent = `Round ${n}`; $('#round .t').innerHTML = t; };
const journal = (...l) => { const j = $('#journal'); j.querySelectorAll('p').forEach((p) => p.remove()); j.insertAdjacentHTML('beforeend', l.join('')); };

const ILYANWE = { portrait: portrait('ilyanwe', { taille: 'grand' }), nom: 'Ilyanwe la Voilée' };

const ETATS = {
  /* LDB 19 l.70, l.76 ; LDB 17 l.67 ; #3001 ; `src/noyau/corruptionFlow.ts:369-371`, `cor.thresholdFail`,
     `cor.renounceTitle`, `src/noyau/choixDeFenetre.ts:246` */
  'corruption-mutation'() {
    round(1, 'tour 2<br>sur 4');
    ordre(Be('actif'), G(), O(), borne(2), I('fantome'), Be('fantome loin'));
    journal(vieux('Berta : +2 Points de Corruption (total 7).'), vieux('Berta : la Corruption déborde son seuil.'), neuf('Berta échoue à contenir sa Corruption.'));
    poser('La mutation menace', 'debut destin', `
      <div class="camp touche lanceur">${portrait('berta', { taille: 'grand' })}
        <div><div class="n gothique">Berta</div><div class="c rubrique">Points de Corruption 7 / 6</div></div>
      </div>
      ${carte('Je te renie !', '−1 Résilience · aucune mutation<br>Les Points de Corruption restent', { armee: true })}
      ${carte('Muter', '−3 Points, le Bonus de Force Mentale<br>La mutation se tire au d100', { classe: 'funeste' })}`,
    `${reserves([[RESERVES.berta.resilience, 'Résilience']])}${plaque('Confirmer', { armee: true })}`);
  },

  /* LDB 15 l.43-49, l.59-66 ; `src/noyau/pendings.ts:1268`, `reglage.desengagement.*`, `jet.desengagement`,
     fiche `user-arbitrage-raison-de-refus-au-survol-jamais-inline` */
  desengagement() {
    journal(vieux('Ilyanwe la Voilée charge Orc (+1 Avantage).'), vieux('Orc touche Ilyanwe la Voilée au bras droit.'), neuf('Ilyanwe la Voilée veut rompre le combat.'));
    poser('Se désengager', 'debut', `
      <div class="camp">${portrait('ilyanwe', { taille: 'grand' })}<div><div class="n gothique">Ilyanwe la Voilée</div><div class="c rubrique">Engagée · Avantage 0 · Orc 1</div></div></div>
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
      ${camp({ ...ILYANWE, carac: 'Calme · Touché en fuyant', seuil: 52, des: ['70', '1'], total: 71, dr: '−2' })}
      ${verdict('Hache · coup dans le dos', '3 États Brisé', 'Orc touche Ilyanwe la Voilée dans le dos : elle fuit, Brisée.')}
      ${camp({ cote: 'droite', portrait: portrait('orc', { camp: 'ennemi', taille: 'grand' }), nom: 'Orc', carac: 'Corps à corps (Base) · Avantage 2', seuil: 75, des: ['4', '20'], total: 24, dr: '+5', modif: 'Dos tourné +20', reussite: true })}`, apresLeDe({ heros: RESERVES.ilyanwe, echec: true }));
  },

  /* LDB 17 l.29-32 ; `src/noyau/choixDeFenetre.ts:234`, `valeur.issue.*`, `ecran.destin.*`, `fenetre.destin` */
  'sauvetage-par-le-destin'() {
    ordre(O('actif'), borne(2), I('fantome', 0), Be('fantome loin'));
    S.querySelector('rect[fill="#b9412c"][x="681"]').setAttribute('width', 0);
    journal(vieux('Orc s’avance vers Ilyanwe la Voilée.'), vieux('Orc attaque Ilyanwe la Voilée.'), neuf('Orc touche Ilyanwe la Voilée : un coup fatal.'));
    poser('Le Destin', 'debut destin', `
      <div class="camp touche lanceur">${portrait('ilyanwe', { taille: 'grand' })}
        <div><div class="n gothique">Ilyanwe la Voilée</div><div class="c rubrique">Un coup fatal.</div></div>
      </div>
      ${carte('Éviter le coup', '−1 Destin · elle reste au combat', { armee: true })}
      ${carte('Survivre hors du combat', '−1 Destin · elle quitte la rencontre')}
      ${carte('Accepter son sort', 'Sans sacrifice, le héros meurt.', { classe: 'funeste' })}`,
    `${reserves([[2, 'Destin']])}${plaque('Confirmer', { armee: true })}`);
  },

};
ETATS[SUITE]();
}
