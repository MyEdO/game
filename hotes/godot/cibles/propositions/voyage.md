# Propositions : voyage (2026-11-17, #3935)

Compte rendu des neuf états dessinés depuis la cible écrite `../ecrites/voyage.md` (et `../ecrites/lieu.md` pour
l'arrivée), la doctrine `user-doctrine-la-cible-prime-sur-l-ancien-ecran` et les propositions déjà au dépôt
(`exploration-et-recit/carte-du-monde.jpg`, `combat/`). Sources au dépôt : `sources/voyage/`.
Rien n'est validé : chaque « choix à valider » attend l'utilisateur.

La carte du monde n'est pas redessinée : elle existe (`exploration-et-recit/carte-du-monde.jpg`) et sert de modèle ;
les états d'ici gardent ses lieux et ses distances (La Diligence, 75 km, Sept Rayons, 115 km, Altdorf).

Pièces reprises, liées par chemin relatif : `commun.css`, `commun.js` et `bustes.js` de `sources/lieux-et-nuit/`
(cadres, plaques, bandeau, postes, pastilles, compagnie) pour les sept états de voyage ; `combat.css`, `jet.js` et
`socle.js` de `sources/combat/` (outils de dessin, grille, ordre, journal, meuble de l'actif), avec `bustes.js`, pour
le combat naval et le dossier du navire. La famille a donc deux socles, comme les écrans qu'elle prolonge.
`voyage.css`, `voyage.js`, `navale.css` et `navale.js` portent ce que la famille ajoute (décors, objet du temps,
carte du trajet, frise, contenant d'événement, navires sur la grille).

Textes repris du jeu : libellés de `src/i18n/messages/fr.ts` (« Arrivée à {lieu} », « Voyage de {duree}. »
l.3151-3167 ; « Journée de descente », « Navigation », « Vent de côté capté » l.3223-3281 ; « Journée en mer »,
« Progression », « Coque », « Moral » l.3480-3539) ; rôles et compétences de `src/data/crew-roles.json` ; profil et
traits de la Cogue de `src/data/vehicles.json` et `src/data/naval-traits.json` (la phrase mécanique de chaque trait,
verbatim) ; péripétie « Voyage éreintant ! » (LDB 51 l.215) et « Barrage de débris » (MSRC 7 l.128), texte du livre.
Les phrases de récit sur les cartes des héros et sur l'image sont des exemples de prose, pas des textes du jeu.

## evenement-de-route
- Cible écrite, « L'événement de route » : décor assombri, parchemin dans un cadre de chêne ferré, titre en
  gothique, vignette à l'encre deux tons, texte du livre en sérif, dé tiré en sceau de cire (4 au d10, LDB 51
  l.208-221), choix en barres pleine largeur avec le prérequis écrit dessus, un choix fermé visible en gris,
  exécutant désigné sur les portraits du bandeau.
- Règle montrée : Test de Survie en extérieur Accessible (+20), sinon un jour plus tard et un État Exténué chacun
  (LDB 51 l.215 ; `src/noyau/travelFlow.ts:1418`, `:1293`).
- L'objet du temps et la carte du trajet restent aux coins ; la frise s'efface sous le contenant.
- À valider : le jeu ne pose aujourd'hui aucun choix sur cette péripétie, il désigne d'office le meilleur héros,
  soutenu par le groupe (`travelFlow.ts:1418`) : les trois choix (« Chercher un bon itinéraire de substitution. »,
  « Attendre que la route se dégage. », « Rebrousser chemin jusqu'aux Sept Rayons. ») et la désignation sur les
  portraits sont une proposition ; le choix fermé et sa raison (« le billet ne vaut que pour Altdorf ») sont un
  exemple inventé pour montrer l'état fermé ; étiquette « Désigné · Survie » sur la carte du héros retenu, « Désigner »
  sur les autres ; un héros sans la compétence estompé, sa raison lisible ; ruban « Péripétie de la route » ; date
  impériale et « 2ᵉ jour de route » dans l'objet du temps ; la route coupée par un pont effondré comme lecture du
  texte du livre.

## evenement-de-route-issue
- Cible écrite : le résultat raconté par une phrase sur l'image, le jet en pastille sur la carte du héros, son
  détail (seuil, dé, degrés) ouvert en billet de parchemin ; la frise revient (nuit en croissant, un seul chiffre).
- À valider : billet ouvert au-dessus de la carte du héros, pointe vers sa pastille ; le soutien du groupe raconté
  par une demi-phrase par héros sans pastille ; « 52 km avant Altdorf » d'exemple.

## arrivee
- Cible écrite `lieu.md` : l'arrivée est l'écran du lieu, sa première ligne est le récit du trajet (« Arrivée à
  Auberge des Sept Rayons · Voyage de 5 h. », `src/noyau/recitEnVue.ts`, `trm.titreArrivee`, `trm.dureeVoyage`) ;
  services mis en scène sur leurs bâtiments, pas de liste ; départs à droite sous la carte, un moyen par plaque.
- Règle montrée : 75 km en diligence à 15 km/h (valeur maison de `src/scenes/diligence/diligence-projet.json`) ; à
  pied et en diligence, 6 h de route par jour (LDB 51 l.191-197) ; une maladie qui se déclare en pastille de cire.
- À valider : Sept Rayons n'a aucun `services` en donnée : les cartouches « Auberge » (Entrer, Dormir, Recueillir
  des informations) et « Lignes du Rochet » (Prendre un billet, fermé la nuit) et leurs boniments sont à écrire ;
  le texte de présentation du lieu est un exemple ; durées des départs (« 5 j », « 2 j ») en plaques ; « Ouvrir la
  carte » en pastille sous la carte du trajet ; bourses affichées sur les cartes des héros ; sortie « Explorer ».

## voyage-fluvial
- Cible écrite, « Ce que le joueur voit pendant le trajet » : décor en plans (ciel, lointain, berge, fleuve et
  barge, premier plan en silhouettes), objet du temps, carte du trajet où la voie d'eau porte le tracé, frise,
  bandeau ; le Test de Navigation est une pastille sur la carte du barreur et une demi-phrase.
- Règle montrée : vent modéré de côté, +5 % de vitesse seulement en louvoyant, Test de Navigation Accessible (+20)
  (MSRC 7 l.23-39) ; Navigation = Voile sur un bateau à voile, par le personnage à la barre (MSRC 7 l.11-13) ;
  `src/noyau/riverVoyageFlow.ts`, `fleuve.louvoyageReussi`.
- À valider : le vent du jour écrit dans l'objet du temps à la place de la météo ; billet du jet ouvert (« Vent de
  côté capté · +5 % de vitesse ») ; aucun état de la coque à l'écran tant qu'elle est intacte ; qui tient la barre
  n'est pas choisi ici (désignation à poser, comme aux postes de bord) ; trajet Grünburg, Altdorf du scénario de test
  15 (distance d'auteur) ; sortie « Faire halte » gardée telle quelle sur l'eau.

## voyage-fluvial-peril
- Cible écrite, « L'événement de route » : même contenant ; les deux choix sont ceux que le jeu pose
  (`src/noyau/riverVoyageFlow.ts:1049-1050`, « Forcer au bélier », « Déblayer à la main »), le prérequis écrit sur
  chaque barre (`fleuve.detailDuBelier`, `fleuve.detailDuDeblayage`).
- Règle montrée : foncer inflige +10 Dégâts au barrage ainsi qu'à la coque ; à la main, 3d10 objets à déblayer
  (MSRC 7 l.128) ; coque de la Barge 60 (`src/data/vehicles.json`).
- À valider : les libellés du jeu allongés en phrases complètes (« Enfoncer le barrage en se servant de la barge
  comme d'un bélier. », « Dégager les débris à la main. ») ; l'état de la coque (« 60 / 60 ») écrit sur le choix qui
  la coûte ; pas de sceau du dé, ce péril n'étant pas tiré devant le joueur ; ruban « Péril du fleuve » ; le
  contenant garde la hauteur de celui de la route, avec deux choix seulement.

## voyage-en-mer
- Cible écrite : même écran, la cogue au centre, frise en milles, nuits en croissants ; les Tests d'équipage du
  jour en pastilles sur les cartes des héros, chacun nommé par son rôle.
- Règle montrée : Tests d'équipage, DR additionnés, le rôle essentiel compte double (MDG 14 l.10-32) ; Progression
  menée par le Capitaine (MDG 14 l.61-65), Orientation par le Navigateur (l.86-90), Perception par la Vigie
  (l.80-84) ; brise fraîche et vent latéral : virement de bord (MDG 13 l.276-287) ; le DR d'équipage module la
  progression du jour (MDG 15 l.78) ; Moral à 75 au départ (MDG 14 l.133-143) ; `src/noyau/seaVoyageFlow.ts`.
- À valider : panneau « La cogue » sous la carte (Coque, Moral, Eau douce, Vivres de l'équipage, valeurs du scénario
  de test 14) ; pastille « Dossier du navire » ; billet du Test d'équipage qui détaille les DR par contributeur
  (chiffres d'exemple) ; sortie remplacée par « Postes de bord » ; trajet Salzenmund, Erengrad de la campagne
  `loup-et-saumure` (550 milles), « 385 milles avant Erengrad » d'exemple ; date impériale d'exemple.

## postes-de-bord
- Doctrine : l'affectation suit la lignée des postes de la halte, aucun choix en liste ; chaque rôle est un poste
  posé sur le navire (nid-de-pie, gréement, pont, cale), un portrait par poste tenu par un héros, la compétence en
  clair sous le nom.
- Règle montrée : les neuf rôles et leur compétence (MDG 14 l.17-32, `src/data/crew-roles.json`) ; le Capitaine,
  rôle essentiel du Test de Progression, compte double (MDG 14 l.17-32, l.61-65) ; `src/noyau/shipCrew.ts:87`.
- À valider : la place de chaque poste sur la silhouette ; les rôles tenus par les marins montrés en médaillon sans
  portrait ; l'Artilleur fermé faute de pièce à bord ; le billet du rôle visé ; le panneau « Le bord » (Moral,
  Coque, Eau douce, Vivres, puis « Ce que la journée jouera » : un Test par ligne, son meneur, sa compétence) et son
  seul bouton « Reprendre la mer » ; le libellé « Veille » pour le Test de Perception de la Vigie, absent du jeu ;
  le rôle de chaque héros rappelé sur sa carte ; sortie « Revenir à la traversée ».

## dossier-du-navire
- Modèle : la fiche lue en combat (`combat/fiche-au-clic`), mêmes quatre panneaux : identité, profil, figure,
  sections à onglets ; ouvert plein écran depuis la traversée.
- Contenu du jeu : profil de la Cogue (M 5, E 45, B 50, Man −1, équipage 15 dont 8 aux voiles, capacité 300,
  25 mètres, 300 CO, `src/data/vehicles.json`) ; traits « Peu maniable » et « Robuste »
  (`src/data/naval-traits.json`) ; état du navire (`src/noyau/etat.ts:282-327` : coque, moral, eau, vivres,
  salissures, avaries).
- À valider : onglets « État », « Équipage », « Cargaison », « Améliorations » ; Moral en barre d'or sous la Coque ;
  trois médaillons (Équipage, Aux voiles, Héros à un poste) ; les traits sur le gabarit des armes de la fiche ;
  « Salissures » et « Avaries » écrits « aucune » quand rien n'est à dire ; le navire n'a pas de nom propre en
  donnée, le dossier porte celui de son modèle.

## combat-naval
- Modèle : l'écran de combat proposé (`combat/`), inchangé : round, ordre, journal, meuble de l'actif, fin du tour.
  La grille est sur l'eau, les navires sont des pièces du champ ; le héros à la barre joue la manœuvre.
- Règle montrée : Test de Manœuvre, Test de Navigation modifié par la Man du bateau (MDG 13 l.119) ; l'avance suit
  la table de Progression, de la moitié de M à M+2 (MDG 13 l.68-75) ; Peu maniable, −1 DR aux Tests de Voile
  (`src/data/naval-traits.json`) ; `src/engine/shipNavigation.ts:50`, `src/noyau/actionsDuNoyau.ts:110`
  (`manoeuvrerLeNavire`).
- À valider : plaques « Manœuvrer » (armée), « Bordée » (fermée faute de pièce), « Attaque » ; Course et Défensive
  descendues en pastilles ; la mesure « Coque de la cogue » à la place du Mouvement du héros ; « À la barre de la
  cogue » sous le nom de l'actif ; le navire adverse dans l'ordre avec sa Coque en barre ; cases dorées pour l'avance
  possible, cases rouges pour le bord où porte la batterie adverse ; aperçu « Manœuvre » (seuil d'exemple) ; lignes
  du journal réécrites (le jeu écrit « Bordée {side} de {ship} sur {target}… », `fr.ts:1943-1949`) ; la Distance de
  course-poursuite (MDG 13 l.354-403) n'est pas montrée ici : le jeu la joue pendant la traversée
  (`travelPlan.sea.crisis`), son écran est `combat-suite/course-poursuite-en-mer.jpg`.
