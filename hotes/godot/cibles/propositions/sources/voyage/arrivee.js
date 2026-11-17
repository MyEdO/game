/* L'arrivée : l'écran du lieu (cible écrite `ecrites/lieu.md`), dont la première ligne est le récit du trajet
   (`src/noyau/recitEnVue.ts`, `trm.titreArrivee`, `trm.dureeVoyage`). Un seul départ : les routes de l'étape sont à sens
   unique (`from`, `src/scenes/diligence/diligence-projet.json`, `src/noyau/worldMap.ts:176`). Place de diligence : LDB 51 l.184
   sur 115 km (`billetImplicite`, `src/engine/travel.ts:170`), le billet de La Diligence s'arrête ici (EDO 01 l.142). */
poser(interieur(D.relais()));
fermer();
el(S, 'rect', { width: 560, height: 280, fill: 'url(#haut)', opacity: .55 });
const pieces = [];
pieces.push(titre({ icone: 'lit', nom: 'Auberge des Sept Rayons', sous: `Auberge-relais · mur d’enceinte · ${picto('soleil', 13, '#c9b995')} temps sec`, largeur: 452 }));
pieces.push(recit('Arrivée à Auberge des Sept Rayons · Voyage de 5 h.', 'Une auberge-relais liée aux Lignes du Rochet, disposée comme La Diligence. Trois diligences s’y sont arrêtées pour la nuit et les lieux sont bondés ; on y colporte toutes les rumeurs de la route.').replace('id="recit"', 'id="recit" class="lieu"'));
pieces.push(`<div class="hote cadre bois" data-piece="service auberge" style="left:520px;top:20px;width:490px"><div class="fond bois"><div class="tete">${medaillon('lit', { petit: true })}<div><div class="n gothique">Auberge</div></div></div>
  <p>« Trois voitures ce soir ! Il reste de la paille au dortoir, et du ragoût tant qu’il y en a. »</p>
  <div class="gestes">${plaque('Entrer', { icone: 'porte' })}${plaque('Dormir', { icone: 'lit' })}${plaque('Recueillir des informations', { icone: 'bulle' })}</div></div>${ferrures}<i class="pointe" style="left:90px;bottom:-8px"></i></div>`);
pieces.push(carteDuTrajet({ titre: 'La route d’Altdorf', de: 'Sept Rayons', vers: 'Altdorf', part: 0.001 }).replace('<div class="ruban rubrique">La route d’Altdorf</div>', ''));
pieces.push(ouvrir('Ouvrir la carte', 'loupe', 262));
pieces.push(`<div id="partir" class="cadre bois" data-piece="partir"><div class="fond bois">
  ${depart({ nom: 'Altdorf', sous: 'Par la grand-route · 115 km', modes: [['botte', 5], ['roue', 2]], note: 'Diligence : 9/– 7 sc la place, à l’extérieur.' })}
</div><div class="ruban rubrique">Partir</div>${ferrures}</div>`);
pieces.push(bandeau({
  bjorn: { texte: 'descend du toit, les reins moulus' },
  mira: { texte: 'compte trois attelages dans la cour' },
  aldric: { mal: true, icone: 'goutte', texte: 'les symptômes de « Rhume commun » se déclarent' },
  greta: { texte: 'garde un œil sur les bagages' },
}, { bourses: true }));
pieces.push(retour('Explorer', 'route'), coins());
monter(pieces);
