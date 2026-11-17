/* Les postes de bord : l'affectation des héros aux rôles du navire, dans la lignée des postes de la halte.
   Rôles et compétences : MDG 14 l.17-32 ; Moral : MDG 14 l.133-143 ; `src/data/crew-roles.json`, `src/noyau/shipCrew.ts`. */
poser(interieur(D.mer({ navire: false })));
poser(D.cogue(640, 520, 1.32, {}));
el(S, 'rect', { width: W, height: H, fill: '#080504', opacity: .34 });
fermer();
const pieces = [];
pieces.push(titre({ icone: 'cordage', nom: 'Postes de bord', sous: 'La cogue · 15 marins · 3ᵉ jour en mer', largeur: 452 }));
pieces.push(`<div data-piece="postes">
  ${poste(628, 58, { nom: 'Vigie', sous: 'Perception', heros: 'bjorn' })}
  ${poste(628, 198, { nom: 'Mousse', sous: 'Voile ou Ramer', icone: 'cordage' })}
  ${poste(330, 328, { nom: 'Capitaine', sous: 'Commandement', heros: 'greta', vise: true })}
  ${poste(500, 328, { nom: 'Timonier', sous: 'Voile', heros: 'mira' })}
  ${poste(790, 328, { nom: 'Navigateur', sous: 'Orientation', heros: 'aldric' })}
  ${poste(960, 328, { nom: 'Artilleur', sous: 'Projectiles', icone: 'canon', ferme: true })}
  ${poste(450, 458, { nom: 'Cuisinier', sous: 'Métier (Cuisinier)', icone: 'marmite' })}
  ${poste(628, 458, { nom: 'Chirurgien', sous: 'Guérison', icone: 'soin' })}
  ${poste(806, 458, { nom: 'Chansonnier', sous: 'Divertissement', icone: 'chant' })}
</div>`);
pieces.push(billet({ x: 60, y: 196, largeur: 300, pointe: 236, nom: 'Capitaine', qui: 'Rôle essentiel', lignes: [['Compétence', 'Commandement'], ['Test d’équipage', 'Progression'], ['Ses degrés', 'comptent double']] }));
pieces.push(`<div id="bord" class="cadre bois bord" data-piece="le bord"><div class="fond bois">
  ${ligne('Moral', '<span class="lin">75</span>')}${jauge(.75)}
  ${ligne('Coque', '<span class="lin">50 / 50</span>')}${jauge(1)}
  ${ligne('Eau douce', '<span class="lin">2 900 L</span>')}
  ${ligne('Vivres de l’équipage', '<span class="lin">735 rations</span>')}
  <div class="filet"></div><div class="t rubrique">Ce que la journée jouera</div>
  <div class="jouera">${pastille('couronne')}Progression<span class="rubrique">Greta · Commandement</span></div>
  <div class="jouera">${pastille('etoile')}Orientation<span class="rubrique">Aldric · Orientation</span></div>
  <div class="jouera">${pastille('oeil')}Veille<span class="rubrique">Bjorn · Perception</span></div>
  <div class="jouera vide">${pastille('canon')}Tir de batterie<span class="rubrique">Aucune pièce à bord</span></div>
  ${plaque('Reprendre la mer', { armee: true, icone: 'voile', classe: 'grand' })}
</div><div class="ruban rubrique">Le bord</div>${ferrures}</div>`);
pieces.push(bandeau({
  bjorn: { texte: 'Vigie, au nid-de-pie' },
  mira: { texte: 'Timonier, à la barre' },
  aldric: { texte: 'Navigateur, cartes et sablier' },
  greta: { choisi: true, texte: 'Capitaine, sur le château arrière' },
}));
pieces.push(retour('Revenir à la traversée', 'route'), coins());
monter(pieces);
