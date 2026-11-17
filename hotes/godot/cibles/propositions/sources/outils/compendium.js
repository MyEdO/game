/* Le Compendium (#3935) : un registre relié, comme celui des règles maison. Un signet par famille, les catégories de la
   famille ouverte et la recherche sur un volet de bois ; la page de gauche liste les entrées de la catégorie, la page
   de droite ouvre la fiche de l'entrée pointée, ses renvois et l'accès à l'atelier. */
const FAMILLES = ['Personnage', 'Compétences', 'Équipement', 'Effets', 'Magie', 'Monde', 'Tables'];
const LIVRES = [['AA', 1], ['ADE I', 1], ['ADE II', 2], ['EDOC', 4], ['LDB', 168], ['MDG', 2], ['NADJ', 1], ['VDM', 8]];
const TALENTS = ['Menaçant', 'Menteur', 'Nageur endurant', 'Nanti', 'Négociateur', 'Noblesse', 'Noctambule', 'Nomade', 'Numismate', 'Obstiné', 'Œil du chasseur', 'Orateur', 'Oreille absolue'];
const CARRIERES = ['Apothicaire (N2)', 'Artisan (N2)', 'Artiste (N3)', 'Batelier (N3)', 'Bourgeois (N2)', 'Cartographe (N4)', 'Cavalier Léger (N4)', 'Charlatan (N3)', 'Cocher (N3)', 'Colporteur (N2)'];
const CREATURES = ['Alfric « Demi-nez » Brisenclume', 'Andrea Bruhn', 'Bourgmestre', 'Chef Contrebandier', 'Citadin', 'Fourgue'];
const liens = (noms, reste) => `<div class="liens">${noms.map((n) => `<span class="lien">${n}</span>`).join('')}${reste ? `<span class="lien reste">et ${reste} autres</span>` : ''}</div>`;
monter([
  fondDeTable(),
  titre({ icone: 'livre', nom: 'Compendium', sous: 'Règles et données', largeur: 392 }),
  `<div id="categories" class="cadre bois" data-piece="catégories"><div class="fond bois"><span class="ruban rubrique">Catégories</span>
     <div>${ligneDeListe('Compétences', 48)}${ligneDeListe('Talents', 187, { la: true })}${ligneDeListe('Axes de forces', 9)}</div>
     <div class="trait"></div>
     ${champ('Rechercher', '', { attente: 'Un nom, un mot de la fiche…' })}
     <div class="r rubrique">Livre</div>
     <div class="facettes">${LIVRES.map(([l, n]) => `<b>${l}<em>${n}</em></b>`).join('')}</div>
     <div class="trait"></div>
     ${plaque('Nouvelle entrée', { icone: 'plus' })}
   </div>${ferrures}</div>`,
  `<div id="signets" data-piece="signets">${FAMILLES.map((n) => `<div class="signet ${n === 'Compétences' ? 'ouvert' : ''}"><span class="rubrique">${n}</span></div>`).join('')}</div>`,
  `<div id="registre" data-piece="registre"><div class="tranche"></div>
     <div class="feuille g parchemin">
       <div class="tete"><span class="dom gothique" data-texte="catégorie">Talents</span><span class="sous rubrique">Famille Compétences · 187 talents</span></div>
       <div class="filet-l"><i></i></div>
       ${TALENTS.map((n) => `<div class="entree ${n === 'Négociateur' ? 'pointee' : ''}"><span>${n}</span><em class="lin">LDB p. ${n === 'Menaçant' ? 141 : n === 'Oreille absolue' ? 143 : 142}</em></div>`).join('')}
       <div class="pied">${rond('gauche', 16)}<span class="folio rubrique">Feuillet 9 sur 15</span><span class="suite"><span class="rubrique">Feuillet suivant</span>${rond('droite', 16)}</span></div>
     </div>
     <div class="feuille d parchemin">
       <div class="tete"><span class="dom gothique" data-texte="entrée">Négociateur</span><span class="sous rubrique">Talent · LDB p. 142</span></div>
       <div class="filet-l"><i></i></div>
       <div class="fiche">
         <div class="puces"><div class="puce"><span class="rubrique">Max</span>Bonus de Sociabilité</div><div class="puce"><span class="rubrique">Test</span>Marchandage</div></div>
         <div class="r rubrique">Description</div>
         <p data-texte="description">Vous êtes un homme d'affaires expérimenté qui sait comment conclure un marché. Quand vous utilisez la Compétence Marchandage, vous réduisez ou augmentez le prix des produits de 10 % supplémentaires.</p>
         <p><b>Remarque:</b> le MJ peut imposer une réduction inférieure des prix pour montrer qu'un vendeur refuse de vendre à perte.</p>
         <div class="liens"><span class="lien">Compétence Marchandage</span></div>
         <div class="r rubrique">Races <em>2</em></div>
         ${liens(['Halflings (Piedfoin)', 'Halflings (Rumster)'])}
         <div class="r rubrique">Carrières (par rang) <em>24</em></div>
         ${liens(CARRIERES, 14)}
         <div class="r rubrique">Créatures <em>19</em></div>
         ${liens(CREATURES, 13)}
       </div>
       <div class="pied">${plaque('Modifier', { icone: 'plume' })}<span class="marque"><i>Atelier : Talents</i></span></div>
     </div>
     <i class="clou" style="left:8px;top:8px"></i><i class="clou" style="right:8px;top:8px"></i><i class="clou" style="left:8px;bottom:8px"></i><i class="clou" style="right:8px;bottom:8px"></i>
   </div>`,
  croix(),
]);
