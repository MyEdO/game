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
  gothique, vignette à l'encre deux tons, dé tiré en sceau de cire (4 au d10, LDB 51 l.208-221), l'entrée du livre
  verbatim et entière (LDB 51 l.215).
- Un seul acte (audit §7, M1) : le Test s'ouvre au bandeau du jet, avant le dé. Le testeur se désigne dans la colonne
  de gauche du bandeau (charte « Désigner le testeur d'un jet »), les quatre héros y sont offerts, Bjorn porté ;
  seuil 61 d'exemple, « Accessible (+20) » en étiquette ; l'issue de l'échec écrite au centre, verbatim ; les
  réserves de Bjorn, « Lancer », « Résilience ». Aucun choix : « Rebrousser chemin » et « Attendre » sont retirés,
  le livre n'en pose pas ; aucune pastille « Faire halte » (aucun verbe, LDB 51 l.195).
- Règle montrée : Test de Survie en extérieur Accessible (+20), sinon un jour plus tard avec un État Exténué
  (LDB 51 l.215 ; `src/noyau/travelFlow.ts:1418`, `:1293`).
- À valider : le jeu désigne aujourd'hui d'office le meilleur héros (`travelFlow.ts:1418`) : la désignation au
  bandeau demande le réglage `testeur` sur l'étape de cascade de route (il n'existe que pour le flux `test`), le
  livre ne disant pas lequel teste (règle 7 : choix du joueur) ; ruban « Péripétie de la route » ; date impériale et
  « 2ᵉ jour de route » dans l'objet du temps ; la route coupée par un pont effondré comme lecture du texte du livre.

## evenement-de-route-issue
- Cible écrite : le résultat raconté par une phrase sur l'image, le jet en pastille sur la carte du héros, son
  détail (seuil, dé, degrés) ouvert en billet de parchemin ; la frise revient (nuit en croissant, un seul chiffre).
- Le billet porte à son pied la Chance qui reste à Bjorn (3, charte « Dépenser la Chance » : réserve toujours
  visible). Aucune pastille « Faire halte » : la route reprend seule (`jouerLaJournee`).
- À valider : billet ouvert au-dessus de la carte du héros, pointe vers sa pastille ; le soutien du groupe raconté
  par une demi-phrase par héros sans pastille ; « 52 km avant Altdorf » d'exemple ; la relance d'un jet de routine
  échoué (audit M2 : le jour s'arrête au bandeau du jet sur un échec encore influençable) n'est pas dessinée ici,
  le jet montré étant réussi.

## arrivee
- Cible écrite `lieu.md` : l'arrivée est l'écran du lieu, sa première ligne est le récit du trajet (« Arrivée à
  Auberge des Sept Rayons · Voyage de 5 h. », `src/noyau/recitEnVue.ts`, `trm.titreArrivee`, `trm.dureeVoyage`) ;
  services mis en scène sur leurs bâtiments, pas de liste ; départs à droite sous la carte, un moyen par plaque.
- Une seule entrée pour la diligence (audit §7) : la plaque du mode, sous « Partir » ; le cartouche « Lignes du
  Rochet » et son « Prendre un billet » sont retirés (le billet se paie au départ, `src/noyau/billetFlow.ts:1-9`).
  Sous chaque départ, ce que la diligence coûte : « billet en main » quand le billet tenu couvre la route
  (`OffreDePassage`, `billetFlow.ts:30`), sinon le prix par place (75 km à l'extérieur à –/1 par kilomètre, LDB 51
  l.178 : 6/– 3 sc). Tarif par personne : chaque voyageur paie sa place de sa bourse (#3004), les bourses sont au
  bandeau.
- Règle montrée : 75 km en diligence à 15 km/h (valeur maison de `src/scenes/diligence/diligence-projet.json`) ; à
  pied et en diligence, 6 h de route par jour (LDB 51 l.191-197) ; une maladie qui se déclare en pastille de cire.
- Ce que l'image ne montre pas et que la plaque de mode ouvre : de nuit, la porte de départ (« Attendre l'aube »,
  `fV('depart')`, ou « Rester », `fF('depart')`, `src/noyau/modalArbiter.ts:362`, valeur maison
  `voyage-heure-de-depart`) ; « Marchander » le billet (flux `marchandage`, `commerce/marchandage.jpg`). Classe de
  passage, heures par jour, allure et cadence ne se règlent que sur la carte (« Ouvrir la carte »).
- À valider : Sept Rayons n'a aucun `services` en donnée : le cartouche « Auberge » (Entrer, Dormir, Recueillir des
  informations) et son boniment sont à écrire ; le texte de présentation du lieu est un exemple ; « billet en main »
  vers Altdorf est un exemple ; durées des départs (« 5 j », « 2 j ») en plaques ; « Ouvrir la carte » en pastille
  sous la carte du trajet ; bourses affichées sur les cartes des héros ; sortie « Explorer ».

## voyage-fluvial
- Cible écrite, « Ce que le joueur voit pendant le trajet » : décor en plans (ciel, lointain, berge, fleuve et
  barge, premier plan en silhouettes), objet du temps, carte du trajet où la voie d'eau porte le tracé, frise,
  bandeau ; le Test de Navigation est une pastille sur la carte du barreur et une demi-phrase.
- Le barreur est un poste, pas un testeur (charte, audit M5) : « Barre » en tête de la carte de Mira, comme les
  rôles en mer ; il se pose aux postes de bord (`affecterAuRoleABord(crewId, 'timonier')`), jamais dans un bandeau de
  jet. Le billet porte à son pied la Chance qui reste à Mira. Aucune pastille « Faire halte ».
- Règle montrée : vent modéré de côté, +5 % de vitesse seulement en louvoyant, Test de Navigation Accessible (+20)
  (MSRC 7 l.23-39) ; Navigation = Voile sur un bateau à voile, par le personnage à la barre (MSRC 7 l.11-13) ;
  `src/noyau/riverVoyageFlow.ts`, `fleuve.louvoyageReussi`.
- À valider : le vent du jour écrit dans l'objet du temps à la place de la météo ; billet du jet ouvert (« Vent de
  côté capté · +5 % de vitesse ») ; aucun état de la coque à l'écran tant qu'elle est intacte ; le fleuve prend
  aujourd'hui d'office le meilleur pilote (`riverVoyageFlow.ts:254`) : lire le poste épinglé est une dette du noyau
  (MSRC 7 l.13) ; trajet Grünburg, Altdorf du scénario de test 15 (distance d'auteur).

## voyage-fluvial-peril
- Cible écrite, « L'événement de route » : même contenant ; les deux choix sont ceux que le jeu pose
  (`src/noyau/riverVoyageFlow.ts:1049-1050`, « Forcer au bélier », « Déblayer à la main »), leur prérequis écrit
  dessous (`fleuve.detailDuBelier`, `fleuve.detailDuDeblayage`).
- Carte puis plaque (charte « Choisir ») : presser une carte la choisit, la plaque de laiton plein au pied la
  commet et dit l'acte (« Enfoncer le barrage » pour le bélier) : le choix qui coûte 10 Dégâts de coque ne part
  plus d'un seul clic. Aucune pastille « Faire halte ».
- Règle montrée : foncer inflige +10 Dégâts au barrage ainsi qu'à la coque ; à la main, 3d10 objets à déblayer
  (MSRC 7 l.128) ; coque de la Barge 60 (`src/data/vehicles.json`).
- À valider : l'état de la coque (« 60 / 60 ») écrit sur le choix qui la coûte ; le libellé de la plaque selon la
  carte choisie ; pas de sceau du dé, ce péril n'étant pas tiré devant le joueur ; ruban « Péril du fleuve » ; le
  noyau clôt l'étape à la pose du choix : l'hôte tient la sélection jusqu'à la plaque.

## voyage-en-mer
- Cible écrite : même écran, la cogue au centre, frise en milles, nuits en croissants ; les Tests d'équipage du
  jour en pastilles sur les cartes des héros, chacun nommé par son rôle.
- Billet « Progression » : les trois héros dont le rôle est du Test (MDG 14 l.65 : Capitaine, Chansonnier, Mousse,
  Navigateur, Timonier), le Navigateur compris ; le rôle essentiel écrit « +2 DR ×2 = +4 », la somme juste (+6) ;
  au pied, la Chance qui reste à chacun des trois.
- « Dossier du navire » et « Postes de bord » sont deux pastilles d'ouverture sous le panneau du navire ; le bas
  gauche reste vide : rien n'y retourne nulle part et le jour avance seul.
- Règle montrée : Tests d'équipage, DR additionnés, le rôle essentiel compte double (MDG 14 l.10-32) ; Progression
  menée par le Capitaine (MDG 14 l.61-65), Orientation par le Navigateur (l.86-90) ; brise fraîche et vent latéral :
  virement de bord (MDG 13 l.276-287) ; le DR d'équipage module la progression du jour (MDG 15 l.78) ; Moral à 75
  au départ (MDG 14 l.133-143) ; `src/noyau/seaVoyageFlow.ts`.
- À valider : panneau « La cogue » sous la carte (Coque, Moral, Eau douce, Vivres de l'équipage, valeurs du scénario
  de test 14) ; DR du billet d'exemple ; trajet Salzenmund, Erengrad de la campagne `loup-et-saumure` (550 milles),
  « 385 milles avant Erengrad » d'exemple ; date impériale d'exemple.

## postes-de-bord
- Doctrine : l'affectation suit la lignée des postes de la halte, aucun choix en liste ; chaque rôle est un poste
  posé sur le navire (nid-de-pie, gréement, pont, cale), la compétence en clair sous le nom, spécialisation comprise
  (« Projectiles (Poudre noire) », « Divertissement (Chant) »). Le héros se presse au bandeau puis son poste
  (charte « Désigner le héros exécutant ») : `affecterAuRoleABord(crewId, roleId | null)`.
- Plusieurs titulaires : la Vigie, tenue par Bjorn, offre une place de plus (« + ») ; Vigies, Mousses et Artilleurs
  se tiennent à plusieurs (MDG 14 l.37). Poste « Repos » : aucun rôle (`shipRole: 'repos'`, `shipCrew.ts:71` ;
  Mousse facultatif, MDG 14 l.15). L'Artilleur est ouvert : le verbe ne refuse rien (`shipCrew.ts:668`).
- Panneau « Le bord » : Moral, Coque, Eau douce, Vivres, puis « Ce que la journée jouera » : Progression (Capitaine),
  Orientation (Navigateur), Entretien (les Mousses, rôle essentiel), soit les Tests du jour (`voyageCadence.ts`,
  `KINDS_SOUS_ORDRES` ; `src/data/crew-test-types.json`). Le Test de Perception ne se joue que sur circonstance
  (MDG 14 l.80-82), le Tir de batterie en combat : ils n'y sont plus. Aucun « Reprendre la mer » : affecter ne
  suspend pas la traversée.
- « Dossier du navire » en pastille d'ouverture sous le panneau ; sortie « Revenir à la traversée ».
- Règle montrée : les neuf rôles et leur compétence (MDG 14 l.17-32, `src/data/crew-roles.json`) ; le Capitaine,
  rôle essentiel du Test de Progression, compte double (MDG 14 l.17-32, l.61-65) ; `src/noyau/shipCrew.ts:87`.
- À valider : la place de chaque poste sur la silhouette ; les rôles tenus par les marins montrés en médaillon sans
  portrait ; le billet du rôle visé ; la station à bord (`affecterALaStation`) n'est pas dessinée : la zone du
  navire où le poste est posé la dirait (audit M6) ; le rôle de chaque héros rappelé sur sa carte.

## dossier-du-navire
- Modèle : la fiche lue en combat (`combat/fiche-au-clic`), mêmes quatre panneaux : identité, profil, figure,
  sections à onglets ; fermé par la croix. Atteignable depuis la traversée et les postes de bord (pastille
  « Dossier du navire »), et, par la charte « Voir une fiche », d'un clic sur le pion ou le cartouche du navire
  en combat naval et au port (`commerce/port.jpg`, « Votre cogue »).
- Le navire porte son nom : nom de l'instance en titre (`Possession.label`), modèle en sous-titre, « Renommer »
  à la plume (`renommerLaPossession`, `src/noyau/possessionsFlow.ts:49`). « La Sterne » est un nom d'exemple.
- Contenu du jeu : profil de la Cogue (M 5, E 45, B 50, Man −1, équipage 15 dont 8 aux voiles, capacité 300,
  25 mètres, 300 CO, `src/data/vehicles.json`) ; traits « Peu maniable » et « Robuste »
  (`src/data/naval-traits.json`) ; état du navire (`src/noyau/etat.ts:282-327` : coque, moral, eau, vivres,
  salissures, avaries).
- À valider : onglets « État », « Équipage », « Cargaison », « Améliorations » ; Moral en barre d'or sous la Coque ;
  trois médaillons (Équipage, Aux voiles, Héros à un poste) ; les traits sur le gabarit des armes de la fiche ;
  « Salissures » et « Avaries » écrits « aucune » quand rien n'est à dire.

## combat-naval
- Modèle : l'écran de combat proposé (`combat/`) : round, ordre, journal, fin du tour. La grille est sur l'eau, les
  navires sont des pièces du champ. L'image montre la manœuvre ouverte : « Manœuvrer » (`manoeuvrerLeNavire`) ouvre
  le bandeau du jet, avant le dé, à la place du meuble de l'actif.
- Rangées d'équipage : la manœuvre est un Test d'équipage, un jet par héros en rôle (`src/noyau/modalArbiter.ts:178`,
  `rangees`). À gauche le jet de Mira, Timonier, rôle essentiel compté double ; à droite les rangées des autres
  rôles du Test (MDG 14 l.74-76 : Capitaine, Navigateur, Mousse, Timonier, Chansonnier), Bjorn en Mousse par défaut
  (MDG 14 l.15). Seuils d'exemple.
- Virage : réglage du jet, au centre, en trois plaques (`jetRegler('manoeuvreDuNavire', 'virage', n)`,
  `src/noyau/combatSlice.ts:2577`) ; il ne s'applique que si le Test réussit, l'avance toujours
  (`src/noyau/shipManeuver.ts:1-11`). Les modificateurs du Test en étiquettes. Réserves de Mira, « Lancer »,
  « Résilience ».
- Règle montrée : Test de Manœuvre, Test de Navigation modifié par la Man du bateau (MDG 13 l.119) ; l'avance suit
  la table de Progression : moitié de M, M−1, M, M+1, M+2 (MDG 13 l.68-75) ; Peu maniable, −1 DR aux Tests de Voile
  (`src/data/naval-traits.json`) ; `src/engine/shipNavigation.ts:50`.
- À valider : le virage par crans de 45° et ses libellés (« Bâbord 45° », « Cap tenu », « Tribord 45° ») ; les
  rangées listées à droite, chacune lancée à son tour ; le navire adverse dans l'ordre avec sa Coque en barre ; cases
  dorées pour l'avance possible, cases rouges pour le bord où porte la batterie adverse ; lignes du journal
  réécrites (le jeu écrit « Bordée {side} de {ship} sur {target}… », `fr.ts:1943-1949`) ; le tour de Mira hors
  manœuvre (plaques « Manœuvrer », « Bordée », « Attaque ») n'est plus l'image ; la Distance de course-poursuite
  (MDG 13 l.354-403) se joue pendant la traversée, son écran est `combat-suite/course-poursuite-en-mer.jpg`.

## Payer en mer : non dessiné
Aucune des neuf images ne débite une bourse. Les gages (conseil de bord, `fC('conseil', 'paie', id)`, MDG 14
l.293-302) et l'avitaillement (`avitaillerLeNavire`, page du port de la famille commerce) n'ont pas d'image ; ce sont
des entreprises communes (#3004) : leur écran montrera la part de chaque héros, réglable avant validation, par
`bourse({ parts, total })` de `sources/gestes.js`, jamais « Bourse du groupe » au singulier.
