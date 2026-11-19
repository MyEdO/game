/* Charger et sauvegarder (#3935) : quatre feuillets du carnet de route posés sur la table, l'automatique d'abord.
   Un feuillet dit ce que la sauvegarde porte (src/noyau/persistance/save.ts:26-34) : lieu, date du jeu, heure réelle.
   État `combat` : « Sauvegarder » fermé pendant un combat (MESSAGE_DU_REFUS, src/hote/sauvegardes.ts). */
const COMBAT = document.getElementById('ecran').dataset.etat === 'combat';
const feuillet = ({ nom, lieu, date, reel, sauver = true, charge = false, vide = false, pointe = false }) => `
  <div class="feuillet cadre bois ${charge ? 'vise' : ''} ${vide ? 'vide' : ''}"><div class="fond parchemin">
    ${vide ? `<div class="blanc">${filet({ losange: true })}<em>— vide —</em>${filet({ losange: true })}</div>` : `
    <div class="lieu gothique" data-texte="lieu ${lieu}">${lieu}</div>
    <div class="date rubrique">${date}</div>
    ${filet({ losange: true })}
    <div class="reel chiffres">Sauvegardée le ${reel}</div>`}
    <div class="gestes">${vide ? '' : plaque('Charger', { armee: charge })}${sauver ? (COMBAT ? plaque(`Sauvegarder${pointe ? raison('Impossible de sauvegarder en plein combat.') : ''}`, { fermee: true }) : plaque('Sauvegarder')) : ''}</div>
  </div>${ruban(nom)}${ferrures}</div>`;
monter([
  fondDeTable(),
  cartouche({ icone: 'disque', nom: 'Sauvegardes', sous: 'Steinbruck · 14 Pflugzeit 2512 CI · 18:20', taille: 'titre', largeur: 430 }),
  croix(),
  `<div id="feuillets" data-piece="emplacements">
    ${feuillet({ nom: 'Emplacement automatique', lieu: 'Steinbruck', date: '14 Pflugzeit 2512 CI · 18:05', reel: '16/11/2026 21:48', sauver: false, charge: true })}
    ${feuillet({ nom: 'Emplacement 1', lieu: 'La route de Weissbruck', date: '12 Pflugzeit 2512 CI · 15:40', reel: '15/11/2026 23:12', pointe: true })}
    ${feuillet({ nom: 'Emplacement 2', lieu: 'Auberge La Diligence', date: '33 Jahrdrung 2512 CI · 21:30', reel: '13/11/2026 20:05' })}
    ${feuillet({ nom: 'Emplacement 3', vide: true })}
  </div>`,
  `<div id="avis" data-piece="avis">${sceau('disque')}<span class="ombre">Emplacement 3 : sauvegarde d’un autre format, retirée.</span></div>`,
]);
