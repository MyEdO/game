/* Le voyage en mer (cible écrite `ecrites/voyage.md`). Tests d'équipage : MDG 14 l.10-32, l.61-65 ; vent : MDG 13 l.276-287 ;
   progression du jour : MDG 15 l.78 ; `src/noyau/seaVoyageFlow.ts`, `sv.*` de `src/i18n/messages/fr.ts`. */
poser(interieur(D.mer({ x: 690 })));
fermer();
const pieces = [];
pieces.push(temps({ teinte: 'gris', jour: 'Wellentag', date: '21 Sigmarzeit · 3ᵉ jour en mer', meteo: 'Brise fraîche, vent latéral', icone: 'vent' }));
pieces.push(carteDuTrajet({ titre: 'La mer des Griffes', de: 'Salzenmund', vers: 'Erengrad', part: .3, eau: 'mer' }));
pieces.push(recit('En mer · Journée en mer', 'Brise fraîche par le travers : la cogue vire de bord et garde son cap. L’équipage tient la cadence, la côte du Nordland s’efface.').replace('id="recit"', 'id="recit" class="route"'));
pieces.push(`<div id="navire" class="cadre bois bord" data-piece="le navire"><div class="fond bois">
  ${ligne('Coque', '<span class="lin">50 / 50</span>')}${jauge(1)}
  ${ligne('Moral', '<span class="lin">75</span>')}${jauge(.75)}
  ${ligne('Eau douce', '<span class="lin">2 900 L</span>')}
  ${ligne('Vivres de l’équipage', '<span class="lin">735 rations</span>')}
</div><div class="ruban rubrique">La cogue</div>${ferrures}</div>`);
pieces.push(`<div id="ouvrir" data-piece="ouvrir le dossier" style="top:452px"><span class="rubrique ombre">Dossier du navire</span>${rond('coque', 18)}</div>`);
pieces.push(frise({ de: 'Salzenmund', vers: 'Erengrad', fait: .3, nuits: [.1, .2], reste: 385, unite: 'milles' }));
pieces.push(billet({ x: 1010, y: 404, largeur: 300, pointe: 236, nom: 'Progression', qui: 'Test d’équipage', lignes: [['Greta, Capitaine', '+2 DR, compte double'], ['Mira, Timonier', '+1 DR'], ['Les marins', '+1 DR'], ['Somme', '+6 DR']] }));
pieces.push(bandeau({
  bjorn: { icone: 'oeil', texte: 'Vigie : rien que des mouettes à l’horizon' },
  mira: { icone: 'barre', texte: 'Timonier : vire de bord sans perdre le vent' },
  aldric: { icone: 'etoile', texte: 'Navigateur : fait le point à midi, le cap est bon' },
  greta: { icone: 'couronne', texte: 'Capitaine : tient l’équipage à la manœuvre' },
}));
pieces.push(retour('Postes de bord', 'cordage'), coins());
monter(pieces);
