# Propositions : voyage (2026-11-17, #3935)

Compte rendu des vingt états dessinés (neuf d'origine, onze ajoutés par l'audit des verbes, #4411) depuis la cible écrite `../ecrites/voyage.md` (et `../ecrites/lieu.md` pour
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
  Sous le départ, ce que la diligence coûte : le billet de La Diligence s'arrête aux Sept Rayons (EDO 01 l.142, `suite`
  du billet de `src/scenes/diligence/diligence-projet.json`), la place vers Altdorf se paie donc au tarif du livre,
  115 km à l'extérieur à –/1 par kilomètre (LDB 51 l.184, `billetImplicite`, `src/engine/travel.ts:170`) : 9/– 7 sc.
  Un seul départ : les routes de l'étape sont à sens unique (`from`, `src/noyau/worldMap.ts:176`), aucun retour vers
  La Diligence. Tarif par personne : chaque voyageur paie sa place de sa bourse (#3004), les bourses sont au
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
- Changement voulu (#4411) : l'objet du temps porte la « Cadence du voyage », deux plaques, « Jour par jour » et
  « Sous vos ordres » (armée) : `fixerLaCadence(cadence)` (`src/noyau/actionsDuNoyau.ts:303`,
  `src/noyau/voyageEnVue.ts:56`, libellés `ecran.cadence.*`). À valider : la cadence dans l'objet du temps, et la
  même pièce sur la route et le fleuve (`temps({ cadence })` de `voyage.js`, non posée sur ces deux écrans).

## postes-de-bord
- Doctrine : l'affectation suit la lignée des postes de la halte, aucun choix en liste ; chaque rôle est un poste
  posé sur le navire (nid-de-pie, gréement, pont, cale), la compétence en clair sous le nom, spécialisation comprise
  (« Projectiles (Poudre noire) », « Divertissement (Chant) »). Le héros se presse au bandeau puis son poste
  (charte « Désigner le héros exécutant ») : `affecterAuRoleABord(crewId, roleId | null)`.
- Plusieurs titulaires : la Vigie, tenue par Bjorn, offre une place de plus (« + », `poste({ heros, plus })`) ; Vigies, Mousses et Artilleurs
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
  portrait ; le billet du rôle visé ; le rôle de chaque héros rappelé sur sa carte.

## postes-de-bord-station
- État de `postes-de-bord` (`bord.js`). Bjorn est au poste « Repos » (aucun rôle, `affecterAuRoleABord(crewId, null)`),
  la Vigie est vide. Greta, choisie au bandeau, ouvre le panneau « Station de Greta » : une plaque par station que
  le navire offre, « Pont » armée, la phrase du livre de la station tenue dessous.
- Verbe : `affecterALaStation(crewId, station | null)` (`src/noyau/actionsDuNoyau.ts:314`, `src/noyau/shipCrew.ts:669`).
- Règle montrée : les stations et leur effet lors d'un Critique de navire (MDG 13 l.714, l.730, l.751,
  `src/data/ship-stations.json`, phrase verbatim) ; une station ne s'offre que si le navire la porte
  (`src/engine/shipCritical.ts:208`) : la Cogue offre le gréement, le pont et les avirons.
- À valider : la station en panneau du héros choisi plutôt qu'en zone du navire ; le « Repos » comme un poste ;
  l'ancienne prose « Vigie, au nid-de-pie » nomme un lieu que la Cogue n'offre pas comme station.

## activites-en-mer
- État de `postes-de-bord` (`bord.js`) : même navire, les postes sont les Activités de la semaine ; chaque héros se
  presse au bandeau puis son Activité. « Aucune Activité » tient Bjorn et Greta, Mira est au « Commerce
  d'opportunité », Aldric à la « Cartographie ». « Entraînement d'équipage » est fermé, sa raison au survol
  (`sact.crewIsPlayers`, verbatim).
- Panneau « La semaine » : la mise de Mira (−, +, « Plafond de la mise », « Enc libre du navire »), la planque
  d'Aldric, puis « Valider la semaine », seule plaque pleine. Billet du Commerce d'opportunité : Test étendu et ses
  quatre issues.
- Fenêtre : `fC('activitesEnMer', 'activite', …)`, `fC('activitesEnMer', 'investir', …)`,
  `fC('activitesEnMer', 'cacher', …)`, puis `fV('activitesEnMer')` (`src/noyau/seaActivities.ts`).
- Règle montrée : Activités en mer (MDG 15 l.266-300, `src/data/activities.json`). Mise, plafond, Enc libre et
  seuils sont des exemples.
- À valider : les Activités sur le gabarit des postes ; le panneau de la semaine à droite ; l'Entraînement
  d'équipage toujours fermé au noyau (`src/noyau/seaActivities.ts:103-105`) alors que le navire a des marins PNJ
  (MDG 15 l.294-300) : écart à trancher, hors de ce lot.

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

## dossier-du-navire-cargaison
- État de `dossier-du-navire` (`dossier-du-navire.js`), onglet « Cargaison » : la cale (130 / 300), ses lots
  (Laine 60, Sel 40, Métaux 30), puis « Déplacer le sel vers » : une carte par autre porteur du groupe
  (« Charrette 0 / 25 »), la quantité réglée par − et + (25 Enc), la plaque « Déplacer ». Dessous, « À bord » :
  la mule Marguerite (15 Enc) et son « Débarquer ».
- Verbes : `deplacerLaCargaison(lotId, toId, enc)` (`src/noyau/actionsDuNoyau.ts:349`), `debarquer(possessionUid)`
  (`:327`).
- À valider : la cargaison se déplace depuis le dossier du porteur qui la tient ; carte puis plaque ; l'Enc d'une
  possession embarquée et celui de la cargaison se comptent à part au noyau (`src/engine/possession.ts:238-244`).
  Lots, Enc et noms sont des exemples.

## dossier-de-la-bete
- Même dossier (`dossier({ genre })`), pour une bête : « Marguerite », mule ; le nom est en saisie
  (`renommerLaPossession(possessionUid, label)`, `:319`) ; profil et traits de la mule, phrase de chaque trait
  verbatim.
- Gestes : « Laisser ici » (`remiserLaPossession`, `:321`), « Embarquer » armée, « Abandonner »
  (`cederLaPossession`, `:329`). « Embarquer » ouvre une carte par hôte possible (« La Sterne »), puis la plaque
  « Embarquer sur La Sterne » : `embarquer(possessionUid, hostUid)` (`:325`).
- À valider : un dossier par possession, bête et véhicule compris, sur le gabarit du navire ; le nom saisi dans le
  titre (le verbe joue à chaque saisie, sans validation) ; l'hôte choisi en carte.

## dossier-du-vehicule
- Même dossier, pour un véhicule remisé : la Charrette « à l'écurie ». « Reprendre » (`recupererLaPossession`,
  `:323`) ; « Embarquer » fermée, sa raison au survol (« Cette possession doit être avec le groupe pour
  embarquer. », texte du jeu) ; « Abandonner » pressée devient « Confirmer l'abandon » et « Annuler ».
- À valider : l'abandon, irréversible, en deux pressions sur place plutôt qu'en fenêtre ; le lieu de remise écrit
  sur le dossier.

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

## combat-naval-bordee
- État de `combat-naval` (`combat-naval.js`) : « Bordée » ouvre le bandeau « Tir de batterie », avant le dé. À
  gauche l'Artilleur, Bjorn, rôle essentiel compté double ; au centre la munition des pièces qui portent, en deux
  options (« Boulet et poudre » armée, « Mitraille et poudre »), et deux étiquettes (« 2 pièces à bâbord », « Un DR
  pour toutes ») ; à droite les rangées des autres rôles du Test. « Lancer », « Résilience ».
- Flux `tirDeBatterie` (`src/noyau/combatSlice.ts:1131-1150`, `src/noyau/modalArbiter.ts:179`).
- Règle montrée : Tir de batterie, Test d'équipage (MDG 14 l.126-130) ; munitions de `src/data/trappings.json`
  (MDG 12). Seuils d'exemple.
- À valider : la munition réglée dans le bandeau pour tout le bord, alors que `approvisionnerLaPiece(posteUid,
  ammoUid | null)` (`:317`) la pose pièce par pièce : réglage de flux à créer,
  `jetRegler('tirDeBatterie', 'munition', ammoUid)`, qui approvisionne chaque pièce qui porte.

## combat-naval-chanson
- État de `combat-naval` : « Chanson de marin » ouvre son bandeau, avant le dé. À gauche le Chansonnier, Aldric ; au
  centre le Test et la durée de l'effet ; à droite les chansons du jeu en cartes, la première armée.
- Verbe `chanterLaChanson(shipId)` (`:112`), réglage `jR('chansonDeMarin', 'chanson', id)`
  (`src/noyau/combatSlice.ts:1186`, `src/noyau/shipCrew.ts:245`, `:609`).
- Règle montrée : Chanson de marin (MDG 09 l.32-40, `src/data/sea-shanties.json`, titres et effets du jeu).
- À valider : les chansons en cartes dans la colonne de droite du bandeau ; « une seule chanson par quart » en
  sous-titre.

## meuble-piece-de-bord
- État de `combat-naval` : le tour de Bjorn, qui sert le « Canon (petit) de bâbord ». Le meuble de l'actif
  (`combat/meuble-chef-de-piece`) : Blessures, « Chargé 1 / 1 », réserves, « Quitter la pièce » ; plaques
  « Manœuvrer », « Bordée », « Attaque » ; conditionnelles « Recharger » (fermée, la pièce est chargée), « Diriger
  l'équipe », « Chanson de marin » ; la pastille « Munition » ouverte sur « Approvisionner la pièce », deux cartes
  et leur stock en soute.
- Verbes : `servirLePoste(posteUid?)` (`:98`), `quitterLePoste()` (`:100`), `approvisionnerLaPiece(posteUid,
  ammoUid | null)` (`:317`), `manoeuvrerLeNavire` (`:110`) ; `src/noyau/combatSlice.ts:1222-1250`,
  `src/noyau/shipCrew.ts:670`.
- Règle montrée : servir et recharger une pièce (LDB 13 l.106). Stocks d'exemple.
- À valider : la munition en pastille du meuble, à côté de « Compétence », « Objet », « Armes » ; les trois plaques
  du bord sur le tour de tout héros à un poste.

## mer-relache
- État de `voyage-en-mer` (`mer.js`), à l'accostage : le contenant d'événement « Relâche à terre », la phrase du
  livre, deux cartes (« Accorder la relâche », armée ; « Refuser la relâche ») et la plaque qui commet, libellée de
  la carte choisie.
- Fenêtre : `fC('relacheATerre', 'accorder', bool)` (`src/noyau/seaVoyageFlow.ts:2469`).
- Règle montrée : relâche à terre, désertion sur 04 ou moins (MDG 15 l.245) ; son effet sur le Moral au prochain
  conseil (MDG 14 l.159, l.167, l.192-202).
- À valider : carte puis plaque pour un choix que le noyau clôt à la pose (l'hôte tient la sélection).

## mer-conseil-de-bord
- État de `voyage-en-mer` : « Conseil de bord », la paie de la semaine. Quatre cartes, leur effet sur le Moral et
  leur coût : régulière (armée), généreuse (fermée, « Bourse insuffisante. » au survol), chiche, pas de paie ; la
  plaque « Payer ». À droite « Bourses du groupe » : la part de chaque héros, réglable (#3004,
  `bourse({ parts, total })`).
- Fenêtre : `fC('conseil', 'paie', id)` puis `fF('conseil')` (`src/noyau/shipCrew.ts:402-605`).
- Règle montrée : la paie et le Moral (MDG 14 l.139, l.147-179, `src/data/crew-morale.json`). Soldes, parts et
  avoirs sont des exemples.
- À valider : la part de chacun avant « Payer » ; le noyau ne la reçoit pas : `fC('conseil', 'paie', id)` débite
  sans répartition. Choix à créer, `fC('conseil', 'parts', { [heroId]: sous })`, sur le modèle de
  `payWithAllocation` (`src/noyau/bourseFlow.ts`).

## mer-fuite-de-vapeur
- État de `voyage-en-mer` : la panne en contenant d'événement, le dé de la table en sceau, l'entrée du livre
  entière ; dessous, le bandeau du jet avant le dé : Aldric, au moteur, Test d'Initiative, l'enjeu au centre,
  « Lancer » et ses réserves.
- Flux `fuiteDeVapeur` (`src/noyau/seaVoyageFlow.ts:1982-1997`).
- Règle montrée : Fuite de vapeur, 1d10–5 Dégâts (1 minimum) qui ignorent l'Armure (MDG 12 l.322-328). Seuil et dé
  d'exemple.
- À valider : la panne dans le contenant d'événement de la route ; le décor n'a pas de silhouette de navire à
  vapeur (la mer seule).

## Payer en mer
Les gages sont dessinés (`mer-conseil-de-bord`). L'avitaillement (`avitaillerLeNavire`) reste à la page du port de
la famille commerce : entreprise commune (#3004), `bourse({ parts, total })` de `sources/gestes.js`, jamais « Bourse
du groupe » au singulier.
