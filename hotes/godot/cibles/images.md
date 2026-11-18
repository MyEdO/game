# Images cibles et propositions de maquettes (#3935)

Images d'intention des écrans sans maquette validée, une par état, sous `propositions/<famille>/<état>.jpg`, le compte rendu détaillé de chaque famille dans `propositions/<famille>.md` (vue
`bureau`). Une proposition n'est pas une cible : elle le devient quand l'utilisateur la valide, son image entre alors
dans `maquettes/` et `maquettes.json`. Les choix qu'aucune cible écrite ne tranchait sont listés avec l'état.
Dessinées depuis les cibles écrites (`ecrites/`) et les maquettes validées, jamais depuis un écran existant
(fiche `user-doctrine-la-cible-prime-sur-l-ancien-ecran`).

## Images cibles validées (2026-11-13 au 2026-11-15)

Les images de la page « Images cibles des écrans », sous `maquettes/`. Celles d'une planche en PNG, déclarées dans
`maquettes.json` ; les autres en JPEG, référence de leur famille. Légende de chacune :

| Image | Ce qu'elle tranche |
|---|---|
| `voyage-image-cible` | le décor tient tout l'écran et dit le milieu, le moment et le temps ; les jets en pastilles sur les cartes des héros ; seule une décision arrête la route |
| `combat-tour-du-heros` | le tour d'un héros : ordre en colonne de portraits, panneau de l'actif, barre d'actions, aperçu de la cible survolée |
| `attaque-jet-tombe` | le jet d'attaque dans un bandeau de parchemin en bas, les deux dés côte à côte, sans masquer le champ |
| `combat-liste-ouverte` | variante A : la pastille « Sort » ouvre un panneau au-dessus du meuble qui ne liste que le disponible, fiche au survol, deux clics pour lancer |
| `combat-barre-de-l-actif` | variante B (retenue) : six emplacements rapides au-dessus des actions, jouables d'un clic ou aux touches 1 à 6 ; les pastilles restent l'entrée de chaque famille |
| `lieu-steinbruck` | l'arrivée dans un bourg : la place, la rue jusqu'à la porte, les services portés par leurs bâtiments, le départ sur le poteau des routes |
| `echoppe-panier` | le marchand à gauche, l'étal en lignes avec le prix en colonne, le panier et son compte, la vente héros par héros |
| `lieu-enceintes` | l'enceinte est une donnée du lieu : aucun mur, palissade, rempart, sur le même écran |
| `ville-bogenhafen-quartiers` | une grande ville s'ouvre sur son plan, quartiers nommés, ambiance et enseignes du quartier regardé, sceau sur le quartier d'une rumeur |
| `auberge-fin-du-voyage` | l'aubergiste vend chambre, repas, bière et écurie au prix du livre ; la rumeur de la salle s'inscrit au journal |
| `logis-qualites` | la qualité est une donnée de l'établissement, par quartier ; salle, offres et prix la suivent |
| `auberge-bouge-altstadt` | le même écran en bas de l'échelle : moins d'offres, paillasse, avertissement des voleurs |
| `creation-carriere` | la frise des dix étapes, le d100 au-dessus des listes, la page de la carrière, le héros qui se dessine |
| `fiche-du-heros` | un écran entier : identité et réserves à gauche, profil en bande, contenu en onglets, héros changé par le bandeau |

## Combat (2026-11-16)

| État | Signes du contrat `combat.md` | Choix à valider |
|---|---|---|
| `tour-adverse` | A1, A2, T3 | le meuble ne montre que nom, arme et Blessures ; emplacements rapides absents ; ruban « Action » grisé |
| `jet-avant-le-de` | J9 | zone choisie en laiton plein, « −20 au Test » en étiquette, gestes « Lancer » et « Annuler » |
| `jet-de-defense` | J1 à J8 | réussite en sceau de cire verte |
| `incantation` | J10 | cible à droite en bloc sans dé, sort en gothique au centre |
| `coup-critique` | C1, C2, C3 | victime et silhouette à gauche, texte du livre à droite, un seul geste ; la barre compte le coup et le Critique |
| `debut-du-round` | R1 | « Agir en premier » : carte du héros offert et son coût, sa Chance en réserve, puis la plaque |
| `fin-victoire` | F1 | le cartouche puis, dans le bandeau du bas, Expérience, Argent, vaincus, « Dépecer », butin à attribuer par héros ; « Reprendre » |
| `fin-defaite`, `fin-repli`, `fin-aneantissement` | F2 | un cartouche par fenêtre du noyau, sa conséquence en une ligne, le bouton au libellé du jeu |
| `journal-ouvert` | T19 | panneau au-dessus de sa pastille, rangé par round |
| `fiche-au-clic` | T21 | quatre panneaux entre l'ordre et le journal, les ancrages restent visibles |
| `cible-survolee` | T14, T15, T16 | aucun |
| `defense-avant-le-de`, `defense-riposte` | J1 à J8, avant le dé | réaction en deux cartes à seuil, « Parer avec », Porte-bouclier ou Riposte en petites plaques ; colonnes inégales ; pas d'« Annuler » |
| `meuble-engage-a-terre`, `meuble-tireur`, `meuble-chef-de-piece` | T3 à T13, point 11 | second rang de plaques pour les offres de la situation ; pastilles à libellé en ligne ; États en sceaux de cire au meuble et dans l'ordre ; raison d'un refus en bulle ; offres portées par la monture et la pièce |
| `determination`, `determination-etat` | aucun | médaillon de laiton au meuble ; trois cartes puis « Dépenser » ; l'État pressé arrive carte choisie ; « Annuler » |
| `jet-avant-le-de-armes`, `jet-avant-le-de-empoigner` | J9 | réglages en rangées : Arme, Localisation, « Des deux armes », « Retenir ses coups », « Empoigner » et sa note |
| `seconde-frappe`, `frappe-mortelle` | aucun | bandeau bas réduit à la consigne et à un geste de sortie ; cibles permises cernées de cire ; dé inversé montré |
| `debut-du-round-tir-rapide` | R1 | deux choix côte à côte, « Agir en premier » et « Préempter · Tir rapide » ; le tir part au clic d'une cible cernée |
| `defense-sociale` | J1 à J8, avant le dé | troisième carte de réaction, la Compétence sociale et son seuil ; la raison de l'offre en étiquette |
| `jet-avant-le-de-harpon` | J9 | bascule « Tirer sans la corde » et sa note ; la cible du tir en bloc sans dé |
| `localisation-du-critique` | J1 à J8, C1 | après un résultat choisi, la silhouette pressable et la zone du Critique, puis « Appliquer » |
| `cible-montee` | aucun | cavalier ou monture en deux cartes, le malus sur la carte, « Cibler » puis « Annuler » |
| `visee-de-siege` | aucun | bandeau réduit à la consigne et à « Annuler » ; l'aire du tir indirect suit la case survolée |

## Lieux et nuit (2026-11-16)

Aucune cible écrite ne couvre ces écrans. Règles de design de l'utilisateur (même fiche) : un choix se met en scène
dans son lieu avec ses PNJ ; un service vit sur la page des services de son lieu. Ce qui se joue vient des livres :
EDOC 08 l.131-180, LDB 09 l.554, LDB 18 l.296, LDB 66 l.5-28, LDB 23, NADJ 16.

| État | Intention | Choix à valider |
|---|---|---|
| `bivouac` | la halte de nuit en scène, couchage et nourriture réglés par héros au bandeau, l'abri lu | effet de la tente ; sac de couchage non montré |
| `nuit-a-l-auberge` | la salle de l'auberge, les offres au prix de la maison dont la grande chambre, la part de chaque héros, un poste de soirée par héros | une activité de soirée par héros ; boire une pinte ; écurie |
| `services-du-lieu-medecin` | la page des services d'un lieu ouverte sur le médecin, soins du patient choisi au bandeau, payés par acte | prix de la visite (LDB 75 l.19 donne une fourchette) ; Chirurgie en valeur maison ; rail du quartier ou du bâtiment |
| `jeux-de-taverne` | le service des jeux de l'auberge, la table et ses joueurs | jeux proposés par maison ; mise libre |
| `interlude-en-ville` | le plan de la ville, chaque Activité accrochée à un lieu et à son PNJ | rattachement des Activités aux lieux ; restriction par Classe ; effet de l'Événement de la période |

## Accueil et système (2026-11-16)

Aucune cible écrite. Le contenu vient de `src/hote/accueil.ts`, `groupe.ts`, `sauvegardes.ts`, `reglages.ts`.

| État | Intention | Choix à valider |
|---|---|---|
| `accueil` | la compagnie face à Altdorf, jeu en plaques, outils en pastilles | « Continuer » en premier, qui charge la dernière sauvegarde ; sur-titre et sous-titre ajoutés |
| `nouvelle-partie` | la salle d'une auberge-relais, le groupe attablé, les voyageurs à recruter, les campagnes en avis cloués | cinq voyageurs visibles à la fois ; espèce absente de l'étiquette |
| `nouvelle-partie-roster` | état : « Mes personnages », Exporter et Supprimer sur le personnage pointé, « Modifier » au bandeau | verbe d'ouverture de la création sur un héros à modifier |
| `nouvelle-partie-coop` | état : le siège de la « Place libre » | noms des sièges |
| `sauvegardes` | quatre feuillets sur la table, l'automatique d'abord, chacun ce que la sauvegarde porte | état sans partie non dessiné |
| `sauvegardes-combat` | état : « Sauvegarder » fermé en combat, raison au survol | aucun |
| `menu-de-la-partie` | le jeu assombri, la colonne de l'accueil | geste « Reprendre » ; refus de « Terminer la séance » non dessiné ; colonne à gauche |
| `options` | préférences sur un volet, règles maison dans un registre à quinze signets | douze règles par feuillet ; libellés lisibles des options |
| `options-verrou` | état : règles fermées pendant un combat, raison au survol | aucun |
| `options-chance` | état : signet « Destin & Résistance », « Regagner la Chance maintenant » | l'action de règle à servir par `zonesDesReglages` ; libellés `off / manual / auto` |
| `ouverture-de-chapitre` | carton plein écran du chapitre, « Commencer » | compagnie affichée ; texte sur l'image |
| `fin-de-seance` | par-dessus le jeu assombri : un feuillet par héros (ce qu'il a écrit, ses trois cases, son gain), les cases du groupe, « Terminer la séance » | croix plutôt que « Continuer » ; gain par héros à servir ; Ambition de groupe sans verbe d'écriture |
| `fin-de-chapitre` | pendant de l'ouverture : la clôture, les objectifs soldés et les PX, les lieux, les tombés, puis les cases de la séance ; « Clore le chapitre », « Plus tard » | un écran au lieu de deux volets ; Ambitions écrites absentes des colonnes |

## Héros : création et progression (2026-11-16)

Suite des pages de `ecrites/heros.md` (dix étapes, `src/noyau/creation/vueDeLaCreation.ts`) ; la progression
n'a pas de cible écrite (`src/noyau/monde/advancement.ts`, LDB 07).

| État | Intention | Choix à valider |
|---|---|---|
| `creation-caracteristiques` | la méthode en plaques, les Augmentations et Destin / Résilience en clous, le profil au dé | prose de la Caractéristique non servie |
| `creation-caracteristiques-reassigner` | état : les dix jets à échanger sous la Caractéristique pressée | aucun |
| `creation-caracteristiques-points` | état : cent points au − / +, « Suivant » fermé tant qu'il en reste | aucun |
| `creation-signe-astral` | le dé puis les vingt signes, la page du signe au centre | champ « Dieux » |
| `creation-competences-de-race` | douze lignes à trois paliers, six cartes au centre | aucun |
| `creation-competences-de-carriere` | huit lignes à dix clous, l'Augmentation de race en pastille à part, la Compétence pressée au centre | « Suivant » refusé tant qu'il reste des points |
| `creation-talents` | race et carrière sur une page, tirages en sceaux | pastille « Utilisation » |
| `creation-talents-doublon` | état : Talent tiré déjà possédé, « Relancer » | aucun |
| `creation-talents-sorts-mineurs` | état : les Sorts de Magie mineure en pastilles, quota du Bonus de FM | liste servie par le noyau |
| `creation-possessions` | la bourse au dé, le bagage en vignettes | pictogrammes d'objets neufs |
| `creation-identite` | ce que les dés donnent, nom, Motivation et Ambitions à la plume | saisies non servies par la vue de l'hôte (#3009) |
| `creation-presentation` | le héros achevé, « Engager » | la vue ne sert pas tout ce qui est dessiné |
| `progression-depense-d-experience` | la fiche dont profil, Compétences et Talents deviennent pressables, avec leur prix ; onglets « Talents, Sorts » | onglet de la fiche ou écran à part ; achat immédiat |
| `progression-depense-d-experience-creneaux` | état : un emplacement « (Au choix) » déplié, « Désigner » ou acheter | « Désigner » séparé de l'achat |
| `progression-depense-d-experience-sorts` | état : Sorts à apprendre et composants des Sorts connus | aucun |
| `progression-changement-de-carriere` | le chemin des quatre niveaux, inférieur et suivant pressables, une autre carrière par Classe ; refus du saut au survol | carrières listées par livre |
| `progression-changement-de-carriere-saut` | état : règle du saut de niveau active, toute station pressable | restriction des Sorciers non vérifiée par le noyau |
| `fiche-possessions` | section « Possessions » de la fiche : sets d'armes, objets, cartouche de la ligne pressée | « Sets d'armes » ou « Panoplies » |
| `fiche-possessions-composant` | état : lier un composant à un Sort connu | aucun |
| `fiche-possessions-prothese` | état : paliers d'entraînement d'une prothèse | aucun |
| `fiche-possessions-faveur` | état : une Faveur due, « Rompre la Faveur » | aucun |

## Exploration et récit (2026-11-16)

Sans cible écrite ; compte rendu dans `propositions/exploration-et-recit.md` : `exploration`, `dialogue`,
`jet-de-competence` (dans le bandeau du bas, comme le jet de combat), `butin` (chaque objet va sur un héros),
`document`, `carte-du-monde` ; écran 13 (2026-11-17, #4411) : `exploration-gestes`, `soins-entre-heros`,
`designation-d-un-heros`, `document-relu`, `carnet`, `carte-du-monde-depart-de-nuit`. Les deux autres vues de
l'exploration (2026-11-17, #4411, décision #3935) : `exploration-dessus`, `exploration-premiere-personne`, avec le
cartouche « Regard » qui passe de l'une à l'autre. Le voyage, la suite du combat, le commerce et les outils ont depuis leurs sections
ci-dessous. Manquent encore, relevés à leurs comptes rendus : la décision qui ouvre une course-poursuite en mer ; le
facteur environnemental tiré d'une bataille de masse ; le Test de Résistance raté avant
la mutation ; « Chance : +1 DR », la raison au survol de « Relancer » fermée, l'axe « Dégâts » de la surincantation
révisée ; à la halle et au port, les refus, l'acheteur introuvable, la moitié du lot proposée, l'évaluation du vin
résolue, le Marchandage de vente, le Marchandage perdu ; en
coop, l'ouverture en cours, l'échec, le hors réseau, le salon vu d'un invité, l'hôte déconnecté ; à l'éditeur, le
document « Narratif », les outils autres que « Sélection », la validation avec défauts ; au Compendium, l'atelier, la
recherche active, une table et son dé : liste complète des écrans au commentaire de #3935.

## Voyage (2026-11-17)

Suite de `ecrites/voyage.md` (et de `ecrites/lieu.md` pour l'arrivée) ; la carte du monde reste celle de
`exploration-et-recit`. Le combat naval et le dossier du navire prolongent l'écran de combat. Ce qui se joue vient
des livres : LDB 51 l.191-221, MSRC 7, MDG 12 à 15.

| État | Intention | Choix à valider |
|---|---|---|
| `evenement-de-route` | la péripétie dans un parchemin ferré, dé en sceau, entrée du livre entière ; le Test au bandeau du jet, testeur désigné dans sa colonne | aucun choix : le livre n'en pose pas ; la désignation du testeur demande un réglage au noyau |
| `evenement-de-route-issue` | le résultat en une phrase sur l'image, le jet en pastille, son détail en billet, la Chance du héros au pied, la cadence du voyage dans l'objet du temps | billet au-dessus de la carte du héros ; soutien du groupe raconté sans pastille |
| `evenement-de-route-echec` | le Test de la péripétie échoué : le bandeau du jet après le dé, « Relancer » ouvert | l'arrêt sur un échec encore influençable demande une retouche du noyau |
| `arrivee` | l'écran du lieu, sa première ligne est le récit du trajet ; services sur leurs bâtiments, départs sous la carte, le prix de la diligence sous chaque départ | Sept Rayons n'a aucun service en donnée ; durées des départs en plaques ; bourses au bandeau |
| `voyage-fluvial` | le décor en plans, la barge, le Test de Navigation en pastille sur le poste « Barre », la cadence du voyage dans l'objet du temps | vent du jour dans l'objet du temps ; le barreur se pose aux postes de bord |
| `voyage-fluvial-peril` | le contenant d'événement, les deux choix que le jeu pose en cartes, la plaque qui commet | état de la coque sur le choix qui la coûte ; libellé de la plaque selon la carte ; pas de sceau du dé |
| `voyage-en-mer` | la cogue au centre, frise en milles, Tests d'équipage en pastilles par rôle, Chance au pied du billet, la cadence du voyage dans l'objet du temps | panneau « La cogue » ; pastilles « Dossier du navire » et « Postes de bord » ; cadence en deux plaques |
| `postes-de-bord` | les neuf rôles et le repos en postes posés sur le navire, plusieurs titulaires aux postes qui l'admettent | place de chaque poste ; rôles des marins sans portrait ; panneau « Le bord » et ses Tests du jour |
| `dossier-du-navire` | la fiche lue en combat appliquée au navire : son nom, renommable, puis identité, profil, figure, sections | onglets ; Moral en barre d'or ; nom d'exemple |
| `postes-de-bord-station` | la station du héros choisi en panneau, une plaque par station que le navire offre ; le « Repos » tenu comme un poste | station en panneau plutôt qu'en zone du navire |
| `activites-en-mer` | les Activités de la semaine sur le gabarit des postes, mise et planque réglées dans « La semaine », une plaque valide | Entraînement d'équipage fermé au noyau ; panneau de la semaine |
| `dossier-du-navire-cargaison` | onglet « Cargaison » : lots de la cale, déplacement vers un autre porteur (carte, quantité, plaque), possessions à bord et « Débarquer » | déplacer depuis le dossier du porteur ; Enc embarqué compté à part |
| `dossier-de-la-bete` | le même dossier pour une bête : nom en saisie dans le champ de la charte, « Laisser ici », « Embarquer » et son hôte en carte, « Abandonner » | un dossier par possession ; nom saisi à la place du titre |
| `dossier-du-vehicule` | le dossier d'un véhicule remisé : « Reprendre », « Embarquer » refusé au survol, abandon confirmé sur place | abandon en deux pressions ; lieu de remise écrit |
| `mer-relache` | l'accostage en contenant d'événement : accorder ou refuser la relâche, carte puis plaque | carte puis plaque sur un choix clos à la pose |
| `mer-conseil-de-bord` | la paie de la semaine en quatre cartes, la part de chaque héros dans « Bourses du groupe » | répartition à créer au noyau |
| `mer-fuite-de-vapeur` | la panne en contenant d'événement, le Test d'Initiative au bandeau du jet, la cogue à vapeur au large | contenant de la route repris ; cheminée, fumée et jet de vapeur sur la cogue |
| `combat-naval-bordee` | le Tir de batterie au bandeau : l'Artilleur, la munition du bord au centre, les rangées | munition réglée pour tout le bord : réglage à créer |
| `combat-naval-chanson` | la Chanson de marin au bandeau, les chansons en cartes | chansons en colonne de droite |
| `meuble-piece-de-bord` | le tour d'un héros qui sert une pièce : meuble de l'actif, médaillon de Détermination, « Quitter la pièce », munition en pastille | munition en pastille du meuble |
| `combat-naval` | la manœuvre au bandeau du jet : virage réglé au centre, une rangée par héros en rôle ; la grille sur l'eau, les navires en pièces du champ | libellés du virage ; rangées à droite ; cases dorées et rouges |

## Suite du combat (2026-11-17)

Aucune cible écrite : le contrat `combat.md` dit la bataille de masse hors de son périmètre. Vingt-quatre états dans le
bandeau du jet de combat, douze sur les socles du voyage et de l'interlude. Ce qui se joue vient des livres : LDB 10, 12, 14, 15, 17, 19,
46, 47, ADE II 08, MDG 13, 14 et 15.

| État | Intention | Choix à valider |
|---|---|---|
| `surincantation` | le bandeau après le dé : le sort, les pas à répartir par axe, les cibles désignées | pas en losanges avec − et + ; axe « sans objet » grisé ; axe « Dégâts » de la règle révisée absent |
| `incantation-critique` | le Critique au jet d'Incantation : le jet du lanceur, puis trois cartes d'effet | sous-titres des cartes ; jet sur le Tableau non annoncé ; « Jets de table choisis » non dessiné |
| `contre-sort-declaration`, `contre-sort` | deux temps : la déclaration en trois cartes, avec la portée, puis le Test opposé tombé | « S'unir » fermée sans autre lanceur ; « Un seul Contre-sort par Round » sous « Passer » ; gestes « Déclarer », « Annuler » |
| `dissipation-entree` | le porteur désigné : le dissipeur, son seuil et le coût de l'Action, une carte par Sort durable, « Dissiper », « Annuler » | carte puis plaque ; Soutien du même Domaine non montré |
| `dissipation` | le Test étendu contre un sort qui dure, cumul des DR, le coût de l'Action, le sort visible sur le champ | cumul en losanges ; le Dôme en exemple ; ruban « Dissipation » |
| `focalisation` | le Test étendu de Focalisation dans le gabarit de la Dissipation : cumul des DR, ce qu'il ouvre | colonne « Ce que la Focalisation ouvre » ; Vent non nommé ; les autres temps ont leur image |
| `incantation-imparfaite` | le gabarit du coup critique : dés du jet, d100 de la table, texte du livre | « Malignité » lue comme les Influences malfaisantes ; ni Chance ni Résilience |
| `test-de-corruption` | hors combat, avant le dé : l'exposition, la nature en deux cartes, ce que le Test décide, les réserves | table des enjeux avant le dé ; sous-titres absents du jeu ; « Lancer », « Résilience » |
| `test-de-corruption-tombe` | le Test tombé : les Points gagnés, la ligne de la table marquée, les gestes d'après le dé et « Résistance » | « Résistance » en sixième plaque, fermée sans le Talent |
| `corruption-mutation` | le seuil manqué arrête le jeu avant tout tirage : « Je te renie ! » ou « Muter », en deux cartes | carte puis « Confirmer » ; ruban « La mutation menace » ; « Muter » en lettres de cire |
| `maladresse` | le gabarit du coup critique : le double raté, le Tableau des Oups | titre « Oups ! » ; dés du tirage montrés, double rappelé en rubrique |
| `desengagement` | le choix dans le bandeau, trois cartes, la refusée en fer, ce que coûte « Fuir » | raison du refus en billet au survol ; sous-titres des cartes ; la plaque porte le nom de l'acte choisi ; « Annuler » |
| `fuite` | la suite de « Fuir » : le coup dans le dos à +20, le Test de Calme du fuyard touché, les États Brisé | un verdict pour deux Tests non opposés ; Dégâts non montrés ; coup manqué sans image |
| `sauvetage-par-le-destin` | le coup fatal arrête le jeu dans le bandeau, trois cartes, la réserve de Destin | carte puis « Confirmer » ; « Accepter son sort » en lettres de cire |
| `relance-a-la-chance` | le jet après une relance, le premier jet rappelé barré, les trois réserves, « Relancer » fermée et sa raison | réserves en médaillons à gauche des gestes ; raison du refus en billet au survol |
| `bataille-de-masse` | le champ sur le socle du voyage, les Scènes du Round posées, les Puissances en jauges | socle du voyage plutôt que champ tactique ; place des Scènes |
| `bataille-de-masse-test-de-puissance` | le Test spectaculaire tombé dans un parchemin au-dessus des héros, le Rassemblement héros par héros | contenant en bas et non au centre ; ni Chance ni Résilience ; chiffres d'exemple |
| `course-poursuite-en-mer` | la traversée continue, le poursuivant dans le sillage, la Distance en frise, le gain net de la manche du jour | frise de Distance à la place du trajet ; repère « Départ · 50 » ; Bjorn en Mousse |
| `course-poursuite-en-mer-test` | le Test d'équipage à lancer, rôle après rôle : rangées du billet, la rangée qui joue, ses réserves, « Lancer », « Résilience » | gestes au pied du billet ; ordre des rangées |
| `dissipation-avant-le-de` | la Dissipation avant le dé : cumul acquis, réserves, « Lancer », « Résilience », « Annuler » | « Encore 5 DR pour dissiper le Dôme. » ; aucun dé réglable, le flux n'ayant pas de réglage |
| `focalisation-avant-le-de` | la Focalisation avant le dé, cumul à zéro, ce qu'elle ouvre déjà affiché | colonne de droite dès avant le dé |
| `focalisation-atteinte`, `focalisation-critique` | les deux fins : le NI atteint, ou le double réussi qui rend le Sort lançable | ligne tombée en cire à droite ; phrase du Critique sous le cumul |
| `incantation-imparfaite-tirage` | le tirage de l'Incantation Imparfaite Mineure qu'exige un Critique, avant le dé : « Lancer le dé » | titre « Les Vents s'emballent » ; pas de « Fixer le dé » |
| `maladresse-tirage` | le Tableau des Oups à tirer : le double raté, le d100 vide, « Lancer le dé » | libellé du tirage de cascade repris |
| `test-de-corruption-resistance` | le Test tombé d'un héros doté du Talent : « Résistance » ouverte | Talent en étiquette à côté du nom |
| `test-de-corruption-resilience` | la Résilience avant le dé : dés réglables à 01, réussite choisie, réserve dépensée | − et + sur chaque dé ; vaut pour tout Test du bandeau |
| `bataille-de-masse-poster` | poster ou retirer un héros depuis le billet de la Scène visée | billet plutôt que glisser ; « Poster » ouverte pour un posté ailleurs |
| `bataille-de-masse-issue` | l'issue : le vainqueur, les Puissances finales, le rappel des Rounds, la sortie | « Quitter le champ » contre « Terminer la bataille » du jeu |
| `bataille-de-masse-preparation` | la préparation en interlude : le camp de l'armée sur la carte, six Activités, deux fermées | un lieu de la carte plutôt que le catalogue ; « Livrer bataille » |
| `course-poursuite-en-mer-test-tombe` | le Test d'équipage après le dé d'une rangée en échec, gestes d'après le dé | « Continuer » clôt l'étape ; billet élargi |
| `course-poursuite-en-mer-sommation` | la sommation : fuir, combattre ou se soumettre, en trois cartes | part pillée en valeur maison ; qui décide pour le bord |
| `course-poursuite-en-mer-tribut` | le tribut à Stromfels après la soumission : livrer un marin ou refuser | tribut non chiffré par le livre ; « Livrer » en carte d'armée |
| `poursuite-terrestre` | la poursuite à pied : frise de Distance 0-10, une rangée par coureur, « Tout lancer », « Abandonner la fuite » | gabarit de la mer repris ; place de « Tout lancer » et de l'abandon |
| `poursuite-terrestre-rattrapes` | Distance 0 : abandonner le plus lent ou s'arrêter et affronter | « Abandonner Aldric » du jeu contre « Sacrifier le plus lent » ; « Faire face » |

## Commerce (2026-11-17)

Cible écrite suivie : `ecrites/lieu.md` (halle, port, Marchandage dans le bandeau de jet du combat), sous les règles
de design du 2026-11-16. Ce qui se joue vient des livres : MSRC 13, MDG 15 l.321-436, LDB 59 l.43.

| État | Intention | Choix à valider |
|---|---|---|
| `halle-achat` | la page des services ouverte sur le marché, une offre par négociant, les porteurs au premier plan | offres en cartouches plutôt qu'en lignes ; rail des services ouvert ; billet de rumeur cloué |
| `halle-vente` | la même halle, les lots sur leurs porteurs, trois voies pour un lot | la vente lue sur les porteurs ; nombre visé de l'acheteur dit avant le jet ; deux états plutôt que deux onglets |
| `marchandage-avant-le-de` | le bandeau de jet à la place du bandeau des héros, la halle visible | enjeux affichés avant le dé, perte comprise ; seuil du négociant masqué ; « Soutien du groupe » en pastille |
| `marchandage` | le jet résolu, le prix avant et après, les suites en plaques | verdict au centre ; « Conclure » armée ; compte de la page mis à jour dès le verdict |
| `port` | le port est un lieu : services en cartouches sur le quai, le navire à l'amarre, départs en mer | état du navire lu sur le navire ; un seul cartouche déplié à la fois |
| `port-negoce` | le négoce de mer sur la page des services du port, la cale seul porteur | même mise en scène que la halle ; avantages de DR annoncés avant le jet ; rail propre au port |
| `port-achat` | l'achat d'un lot : Encombrement réglé, lot partiel, parts des bourses | parts par bourse que le noyau ne prend pas ; +1 DR annoncé avant le jet |
| `port-chantier` | le constructeur et ses Améliorations, trois voies : réparer, caréner, poser | une voie à la fois ; durée de pose et Métier du constructeur en valeurs maison |
| `port-recrutement` | les neuf rôles, leur solde à la semaine, embaucher et débarquer | sept soldes en correspondance maison ; rien débité à l'embauche |
| `port-avitaillement` | les vivres en réglettes, le devis, les parts des bourses | jours de vivres non montrés, sans lecteur |

## Hors partie et outils (2026-11-17)

Aucune cible écrite. Le contenu vient de `src/hote/salon.ts`, `src/hote/coop/salon.ts`, `src/noyau/sieges.ts`,
`src/hote/editeur.ts`, `src/hote/compendium.ts`.

| État | Intention | Choix à valider |
|---|---|---|
| `coop-ouvrir` | une tablée vide, rejoindre et héberger en deux feuillets | code en six cases ; geste refusé en fer avec sa raison |
| `coop-salon` | la tablée, un siège par joueur et ses héros, le siège à pourvoir inerte, la page d'attribution | attribution lue deux fois ; un segment par siège ; rôle de Maître du Jeu sous les héros |
| `coop-la-main` | la halle vue du siège d'un invité, « La main est à l'hôte » | cartouche de la main sur tout écran joué à plusieurs ; nom du joueur sous chaque héros |
| `editeur-scene` | un plan de travail en trois colonnes : scènes et outils, plan, inspecteur | matières du jeu plutôt qu'outil neutre ; palette d'icônes libellées ; vue de dessus |
| `editeur-carte-du-monde` | le même plan de travail sur la carte, lieux et routes listés et choisis sur la carte | route éditée dans l'inspecteur du lieu ; sens d'une route en flèche |
| `compendium` | un registre relié, un signet par famille, la liste en feuillets sous-titrée de sa famille, la fiche et ses renvois | liste paginée ; renvois tronqués avec leur reste ; « Modifier » visible à la consultation |
| `compendium-atelier` | l'atelier sur la page de droite : formulaire de l'entrée, identifiant, « Enregistrer », « Abandonner », « Supprimer » refusé au survol | champs absents en puces « Ajouter » ; suppression en deux pressions |
| `editeur-outil-terrain` | l'outil « Terrain » armé, ses options (pinceau, terrains) à la place de l'inspecteur, le pinceau sur le plan | options d'outil dans l'inspecteur ; même gabarit pour les autres outils |
| `editeur-supprimer` | un personnage choisi, son inspecteur, « Supprimer » au pied ; un retrait refusé en fer, raison au survol | « Supprimer » en une pression, défait par « Annuler » |

## Sources des propositions

Chaque proposition a sa source HTML, CSS et JS sous `propositions/sources/<famille>/`, polices communes sous
`propositions/sources/polices/` (OFL). Une image se refait depuis sa source, jamais à la main :
`node propositions/sources/rendre.mjs <chemin absolu du .html> <sortie.png> [échelle]`, Playwright résolu depuis le
script (il n'est pas une dépendance du dépôt : `npm i --no-save playwright`, ou dans le conteneur cloud un lien
`node_modules/playwright` vers `/opt/node-tools/node_modules/playwright`) (vue 1707 × 780, rapport des pièces qui
débordent ou se chevauchent). Rien ne se copie d'une famille à l'autre : une page lie par chemin relatif le socle
qu'elle prolonge, et une pièce neuve s'ajoute à ce socle plutôt que dans une page. Deux socles : le commun
(`lieux-et-nuit/commun.css`, `commun.js`, `bustes.js`), que lient `heros`, `exploration-et-recit`, `voyage`,
`commerce` et les écrans hors champ de `combat-suite` ; celui du combat (`combat/combat.css`, `socle.js`), que lient
`combat-suite` et le combat naval de `voyage`. `accueil-et-systeme`, que prolonge `outils`, garde sa propre feuille
commune. Deux socles de gestes se posent sur les trois, et aucune famille n'en recopie une pièce. Le kit
(`gestes.css`, `gestes.js`, que toute page charge avant son socle) : la définition unique de chaque pièce d'interface,
cotes et signatures dans `propositions/kit.md`, chacune posée à chaque taille et dans chaque état sur la planche
(`sources/kit/planche-*.html`). Le jet
(`combat/jet.css`, `jet.js`) : le bandeau du bas, ses camps et son verdict, le testeur et les réglages d'avant le dé,
les réserves du héros, les gestes d'avant et d'après le dé ouverts ou fermés selon la règle (LDB 17 l.23-24, l.68),
les dés réglables de la Résilience, le choix par carte.
