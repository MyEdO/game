/* Le menu de la partie (#3935) : la pause, par-dessus le jeu assombri. Même colonne que l'écran titre. */
grad('ombre-g', [[0, '#04030a', .94], [.3, '#04030a', .78], [.62, '#04030a', .3], [1, '#04030a', .12]], { x1: 0, y1: 0, x2: 1, y2: 0 });
el(S, 'rect', { width: W, height: H, fill: 'url(#ombre-g)' });
el(S, 'rect', { width: W, height: H, fill: 'url(#vignette)', opacity: .7 });
monter([
  `<div id="pause" data-piece="titre">
     <div class="sur rubrique ombre">Partie en pause</div>
     <div class="nom gothique" data-texte="titre">Menu de la partie</div>
     ${filet({ losange: true, or: true })}
     <div class="ou ombre"><span class="rubrique">Steinbruck</span> · 14 Pflugzeit 2512 CI · 18:20</div>
   </div>`,
  `<div id="entrees" data-piece="entrées">
     ${plaque('Reprendre', { armee: true, icone: 'jouer', taille: 'appel' })}
     ${plaque('Sauvegardes', { icone: 'disque', taille: 'appel' })}
     ${plaque('Options', { icone: 'systeme', taille: 'appel' })}
     ${plaque('Jouer en ligne', { icone: 'reseau', taille: 'appel' })}
     ${plaque('Terminer la séance', { icone: 'plume', taille: 'appel' })}
     <div class="trait"></div>
     ${plaque('Quitter la partie', { icone: 'sortie', taille: 'appel' })}
     <div class="dernier ombre">Dernière sauvegarde automatique à 18:05.</div>
   </div>`,
  `<div id="pastille" data-piece="pastille">${rond('systeme', 'grand', { arme: true })}</div>`,
]);
