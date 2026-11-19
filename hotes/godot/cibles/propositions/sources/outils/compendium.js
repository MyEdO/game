/* Le Compendium (#3935) : un registre relié, comme celui des règles maison. Un signet par famille, les catégories de la
   famille ouverte et la recherche sur un volet de bois ; la page de gauche liste les entrées de la catégorie, la page
   de droite ouvre la fiche de l'entrée pointée, ses renvois et l'accès à l'atelier ; à l'état `compendium-atelier`, elle
   porte l'atelier de l'entrée : son formulaire, son identifiant, ses trois gestes. */
const ATELIER = document.getElementById('ecran').dataset.etat === 'compendium-atelier';
const FAMILLES = ['Personnage', 'Compétences', 'Équipement', 'Effets', 'Magie', 'Monde', 'Tables'];
const LIVRES = [['AA', 1], ['ADE I', 1], ['ADE II', 2], ['EDOC', 4], ['LDB', 168], ['MDG', 2], ['NADJ', 1], ['VDM', 8]];
const TALENTS = ['Menaçant', 'Menteur', 'Nageur endurant', 'Nanti', 'Négociateur', 'Noblesse', 'Noctambule', 'Nomade', 'Numismate', 'Obstiné', 'Œil du chasseur', 'Orateur', 'Oreille absolue'];
const CARRIERES = ['Apothicaire (N2)', 'Artisan (N2)', 'Artiste (N3)', 'Batelier (N3)', 'Bourgeois (N2)', 'Cartographe (N4)', 'Cavalier Léger (N4)', 'Charlatan (N3)', 'Cocher (N3)', 'Colporteur (N2)'];
const CREATURES = ['Alfric « Demi-nez » Brisenclume', 'Andrea Bruhn', 'Bourgmestre', 'Chef Contrebandier', 'Citadin', 'Fourgue'];
const AJOUTS = ['Spécialisations', 'Taille requise', 'Trait conféré', 'Effets passifs'];
const liens = (noms, reste) => `<div class="liens">${noms.map((n) => `<span class="lien">${n}</span>`).join('')}${reste ? `<span class="lien reste">et ${reste} autres</span>` : ''}</div>`;
const fiche = `<div class="feuille d parchemin">
       <div class="tete"><span class="dom gothique" data-texte="entrée">Négociateur</span><span class="sous rubrique">Talent · LDB p. 142</span></div>
       ${filet({ losange: true })}
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
       <div class="pied">${plaque('Modifier', { icone: 'plume', taille: 'petite' })}<span class="marque"><i>Atelier : Talents</i></span></div>
     </div>`;
const atelier = `<div class="feuille d parchemin atelier">
       <div class="tete"><span class="dom gothique" data-texte="entrée">Négociateur</span><span class="sous rubrique">Atelier : Talents</span></div>
       ${filet({ losange: true })}
       <div class="fiche">
         <div class="deux">${champ('Nom', 'Négociateur')}${champ('Identifiant', 'negociateur')}</div>
         <div class="deux">${champ('Maximum', 'Bonus de Sociabilité')}${champ('Test associé', 'Marchandage')}</div>
         <div class="aide"><span>Nombre maximum d’achats du Talent</span><span>Correspondances : <span class="lien">Compétence Marchandage</span></span></div>
         ${champ('Description', 'Vous êtes un homme d\'affaires expérimenté qui sait comment conclure un marché. Quand vous utilisez la Compétence Marchandage, vous réduisez ou augmentez le prix des produits de 10 % supplémentaires.<br><br>**Remarque:** le MJ peut imposer une réduction inférieure des prix pour montrer qu\'un vendeur refuse de vendre à perte.', { classe: 'long' })}
         <div class="deux">${champ('Livre', 'Livre de base')}${champ('Page', '142')}</div>
         <div class="r rubrique">Champs que l’entrée ne porte pas</div>
         <div class="facettes">${AJOUTS.map((n) => `<b>Ajouter : ${n}</b>`).join('')}</div>
       </div>
       <div class="pied">${plaque('Enregistrer', { icone: 'disque', armee: true, taille: 'petite' })}${plaque('Abandonner', { taille: 'petite' })}${plaque(`Supprimer${raison('D’autres données désignent cette entrée, elle ne se supprime pas : 2 races, 24 carrières, 19 créatures')}`, { fermee: true, taille: 'petite' })}</div>
     </div>`;
monter([
  fondDeTable(),
  cartouche({ icone: 'livre', nom: 'Compendium', sous: 'Règles et données', taille: 'titre', largeur: 392 }),
  `<div id="categories" class="cadre bois" data-piece="catégories"><div class="fond bois">
     <div>${ligneDeListe('Compétences', 48)}${ligneDeListe('Talents', 187, { la: true })}${ligneDeListe('Axes de forces', 9)}</div>
     <div class="trait"></div>
     ${champ('Rechercher', '', { attente: 'Un nom, un mot de la fiche…' })}
     <div class="r rubrique">Livre</div>
     <div class="facettes">${LIVRES.map(([l, n]) => `<b>${l}<em>${n}</em></b>`).join('')}</div>
     <div class="trait"></div>
     ${plaque('Nouvelle entrée', { icone: 'plus', fermee: ATELIER })}
   </div>${ruban('Catégories')}${ferrures}</div>`,
  signets(FAMILLES.map((nom) => ({ nom })), 'Compétences'),
  `<div id="registre" data-piece="registre"><div class="tranche"></div>
     <div class="feuille g parchemin">
       <div class="tete"><span class="dom gothique" data-texte="catégorie">Talents</span><span class="sous rubrique">Famille Compétences · 187 talents</span></div>
       ${filet({ losange: true })}
       ${TALENTS.map((n) => `<div class="entree ${n === 'Négociateur' ? 'pointee' : ''}"><span>${n}</span><em class="chiffres">LDB p. ${n === 'Menaçant' ? 141 : n === 'Oreille absolue' ? 143 : 142}</em></div>`).join('')}
       <div class="pied">${rond('gauche', 'petit')}<span class="folio rubrique">Feuillet 9 sur 15</span><span class="suite"><span class="rubrique">Feuillet suivant</span>${rond('droite', 'petit')}</span></div>
     </div>
${ATELIER ? atelier : fiche}
     ${CLOUS}
   </div>`,
  croix(),
]);
