# Grammaire de disposition retenue

Arbitrage du 18/11/2026 des 25 incohérences du relevé `kit-commun/dispositions.md` (162 pages dessinées en
1707 × 780), porté le même jour à la vue du jeu. Les pièces (tailles, teintes) sont celles de `kit.md`, en pixels
logiques, sans facteur, et ne sont pas rediscutées ici.

## Vue de référence et ancrages

**Vue de référence : 1280 × 720 pixels logiques, rendue en 1920 × 1080 (× 1,5).** C'est la vue du jeu Godot, dont
toutes les tailles sont réglées pour 720 de haut. Toutes les valeurs de ce document sont en pixels logiques. Par
rapport au dessin d'origine, la vue perd 427 px de large et 60 px de haut ; aucune pièce du kit n'est trop grande
pour elle.

**1280 × 720 est aussi le canevas du dessin** : pages, planches du kit et décor se dessinent à cette base, sans
facteur ni recadrage (le décor est un 16:9 tendu sur la vue). 1707 × 780 n'est plus la base de rien.

**Une place ne s'écrit jamais en x, y depuis le coin haut-gauche.** Elle s'écrit de l'une de ces quatre façons :

| Ancrage | Écriture | Ce qui l'emploie |
|---|---|---|
| **Coin ou bord** | « 22 / 18 du coin haut-droit » = 22 px du bord droit, 18 px du haut ; le premier nombre est toujours l'écart horizontal | croix, pastilles, retour, cartouche, panneaux latéraux, fil |
| **Centré** | largeur fixe, centré sur l'axe vertical de l'écran, ancré au bas | les grands cadres du bas |
| **Tendu** | entre deux marges ou entre deux pièces voisines : la pièce prend ce qui reste | registre, profil et panneaux d'une fiche, détail de la création, plan de l'éditeur, décor |
| **Relatif** | écart à une pièce nommée (« 20 px sous le cartouche ») | récit, ruban, bulle, journal au-dessus du système |

**Écran plus large ou plus haut que 16:9.** La hauteur logique reste 720 (ou la largeur 1280 si l'écran est plus
haut) et la vue s'étend dans l'autre sens. Aucune pièce ne grossit, aucune marge ne change : ce qui est ancré à un
bord suit son bord, ce qui est centré reste centré à sa largeur, seul ce qui est tendu (et le décor) prend la place
gagnée. La vue ne descend jamais sous 1280 × 720 logiques ; un écran plus petit la réduit d'un bloc.

**Quand la largeur manque**, dans cet ordre : la pièce tendue rétrécit ; puis une colonne de trop devient un onglet
de sa voisine ; puis le détail d'une ligne se pose par-dessus (aperçu, écran posé) au lieu d'occuper une colonne.
Une pièce du kit ne rétrécit jamais (seule la carte de choix s'étire, de 200 à 262 de large) et rien ne défile de côté.

## Les règles qui valent pour toute l'application

| Rôle | Place retenue |
|---|---|
| **Croix** (fermer un écran posé par-dessus le jeu) | coin haut-droit, 44 px, 22 / 18. Deux raisons d'écran : une barre occupe le haut (création, éditeur) → la croix est dans la barre, centrée en hauteur, à 25 px de son bout droit ; en combat le coin est pris par le système → la croix passe dessous, 22 / 76 |
| **Retour** (quitter un lieu ou changer de vue du lieu) | coin bas-gauche, pastille 52 px à 30 / 34, son libellé au-dessus d'elle, aligné à gauche (à côté, il toucherait les cadres du bas). Ce coin ne porte rien d'autre |
| **Pastille du système** | hors combat : coin bas-droit, 52 px, 30 / 23. En combat : coin haut-droit, 44 px, 22 / 18, parce que le bas-droit est la fin du tour |
| **Pastille du journal** | hors combat : juste au-dessus du système, 14 px d'écart, même bord droit. Les deux pastilles vont toujours ensemble |
| **Action qui fait avancer** | toujours la première de sa rangée (à gauche, ou au-dessus si les plaques sont empilées) ; ce qui annule ou revient en arrière vient en dernier |
| **Ruban d'un cadre** | à cheval sur le bord haut, 9 px au-dessus, centré sur le cadre |
| **Grands cadres du bas** (bandeau des héros, fenêtre du bas, barre de combat, carton) | **largeur fixe 960, centrés**, ancrés au bas (1186 au dessin). Pas une proportion : il reste 160 px de chaque côté pour le retour, les pastilles, l'ordre d'initiative et la fin du tour ; sur un écran plus large ils gardent 960 |
| **Panneaux latéraux** | largeur fixe, ancrés à leur bord (24 px) et au haut (20 px) ; leur hauteur suit leur contenu et s'arrête au plus tard à la ligne basse, puis défile |
| **Ligne basse** (limite du bas des panneaux latéraux et du fil) | elle dépend du cadre du bas : **164 px du bas** sous un bandeau ou une barre ; **20 px au-dessus d'une fenêtre du bas** (198, 240 ou 294 px du bas pour 170, 212, 266) ; **24 px du bas** quand l'écran n'a aucun cadre du bas (écran de gestion) |
| **Registre** | tendu : du panneau de gauche (ou de la marge gauche) à 24 px du bord droit (186 px s'il porte des signets : 160 de signet, 2 d'écart), de **60 px du haut** jusqu'à 24 px du bas (80 px si l'écran a une action de coin : elle passe dessous) |
| **Bulle de refus** | au-dessus de l'élément refusé, centrée sur lui, 11 px, décalée de côté pour rester dans son cadre (dans l'écran hors cadre) ; sinon dessous ; sinon posée sur l'élément refusé, au bout de sa ligne, puis à sa largeur. Elle ne couvre jamais un autre texte (`poserLesBulles`) |
| **Aperçu au survol** | une seule largeur : 300 px ; à côté de l'élément survolé, sa pointe vers lui, à 12 px ; décalé seulement pour rester dans l'écran |
| **Signets** | colonne au bord droit du registre, 24 px du bord droit de l'écran, premier signet à 66 px du haut (sous la croix) |
| **Action de coin** (elle concerne tout l'écran) | pile de plaques `moyenne` larges de 136, coin bas-droit, 24 / 28, écart 9 ; la principale au-dessus, la secondaire dessous. 136 parce que c'est ce qui reste à droite d'un cadre de 960 |

## Par type d'écran

**1. Écran d'ouverture** (accueil, menu de la partie, ouverture et fin de chapitre)

| Rôle | Place retenue |
|---|---|
| Titre | grand titre libre, 84 px du bord gauche |
| Entrées | colonne de plaques, 88 px du bord gauche, sous le titre, la principale en tête |
| Continuer (écrans de chapitre) | action de coin : « Continuer » au-dessus, « Plus tard » dessous (bas de la pile à 28 px du bas) |
| Système | accueil : « Options » au bout de la rangée d'outils du bas ; menu : pastille 30 / 23 du coin bas-droit ; chapitres : aucune |
| Groupe | bandeau centré, 960 × 152, à 8 px du bas |
| Dans 1280 × 720 | tout tient : seule l'image perd de la largeur. Le bandeau passe de 296 à 240 px par héros |

**2. Écran de gestion** (options, sauvegardes, nouvelle partie, fin de séance, compendium, salon en ligne, carnet)

| Rôle | Place retenue |
|---|---|
| Titre | cartouche, 24 / 20 du coin haut-gauche, hauteur 96 |
| Fermer | croix 22 / 18 ; pas de retour, pas de pastille du système |
| Panneau de commande | à gauche, 24 px du bord, 20 px sous le cartouche, largeur gardée ; panneau latéral sans cadre du bas : il descend jusqu'à 24 px du bas |
| Sections | jusqu'à 6 : onglets horizontaux ; au-delà : signets verticaux au bord droit du registre, 15 au plus à l'écran puis ils défilent |
| Action principale | au pied de l'objet qu'elle concerne ; si elle concerne tout l'écran : action de coin, sous le registre qui s'arrête alors à 80 px du bas |
| Dans 1280 × 720 | le registre rétrécit seul (427 px de moins) et montre moins de lignes, qui défilent. S'il avait une colonne de détail (entrée du compendium, sauvegarde choisie), elle ne tient plus à côté de la liste : le détail se pose par-dessus le registre, fermé par sa croix |

**3. Fiche** (fiche du héros, progression, création, dossiers, fiche d'un combattant)

| Rôle | Place retenue |
|---|---|
| Portrait et nom | panneau d'identité, 26 / 20 du coin haut-gauche, 340 de large (400 au dessin), portrait 136 × 168 ; à la création, le héros en cours est à droite, même largeur |
| Profil | bande en haut, tendue de l'identité à la croix |
| Sections | onglets horizontaux à cheval sur le bord haut du panneau |
| Fermer | croix 22 / 18 ; création : dans la frise, 51 / 27 ; en combat : 22 / 76 |
| Journal et système | coin bas-droit, 30 / 23 et le journal 14 px au-dessus ; en combat : système seul en haut à droite |
| Groupe | bandeau réduit en bas, centré, à 8 px du bas : même hauteur 152, une case de 240 par héros autre que celui de la fiche (720 pour trois) |
| Action principale | au pied de son panneau, au-dessus de « Précédent » à la création |
| Dans 1280 × 720 | l'identité perd 60 px, le profil rétrécit. Un panneau de section montre deux colonnes au plus : une troisième devient un onglet de plus (dans la limite de 6, puis signets). Création : choix à gauche et héros à droite gardent leur largeur, le détail tendu au milieu absorbe la perte |

**4. Lieu et voyage**

| Rôle | Place retenue |
|---|---|
| Titre | cartouche, 24 / 20 du coin haut-gauche, hauteur 96 (104 avec la ligne de météo) |
| Récit du lieu | 20 px sous le cartouche, 32 px du bord gauche, largeur 340 (400 au dessin) |
| Ce que le lieu propose (menu des services, offre de l'hôte) | à gauche, 24 px du bord, 20 px sous le cartouche ou sous le récit |
| Panneau d'activité | coin haut-droit, 24 / 20 : colonne de 360 ou grande page de 480 (503 au dessin) |
| Action principale | au pied du panneau d'activité, pleine largeur, 22 px du bas du panneau (49 s'il y a une note dessous) |
| Ouvrir un écran posé | pastille 44 px, 24 px du bord droit, sous le panneau de droite (ou à 20 px du haut s'il n'y en a pas) |
| Groupe | bandeau centré, 960 × 152, à 8 px du bas |
| Retour | 30 / 34 du coin bas-gauche dès qu'on peut partir sans rien résoudre |
| Journal et système | coin bas-droit, 30 / 23 et le journal 14 px au-dessus |
| Fil des évènements | 24 px du bord droit, largeur 300, bas à la ligne basse (164 px du bas de l'écran au-dessus du bandeau) ; il grandit vers le haut |
| Dans 1280 × 720 | c'est le décor qui paie : entre le récit et la colonne il reste 524 px de décor, 404 avec la grande page. Le fil et le panneau d'activité partagent la colonne de droite et ne se montrent jamais ensemble : le panneau ouvert replie le fil dans la pastille du journal |

**5. Combat**

| Rôle | Place retenue |
|---|---|
| Titre | borne du round, 22 / 16 du coin haut-gauche |
| Ordre d'initiative | colonne au bord gauche, sous la borne, dans la marge de 160 px, l'actif en bas |
| Système | coin haut-droit, 22 / 18, 44 px |
| Journal | libellé « Journal » + rond 34 px au-dessus du fil (24 px du bord droit, largeur 300, bas à la ligne basse : 164 px du bas au-dessus de la barre, 20 px au-dessus d'une fenêtre du bas) |
| Barre de l'actif | centrée, 960 × 138, bas à 8 px du bas de l'écran ; valeurs à gauche, portrait au centre, actions à droite |
| Fin du tour | grand rond 92 px, coin bas-droit, 49 / 48 |
| Dans 1280 × 720 | la barre perd 226 px : valeurs et portrait gardent leur place, les actions se rangent par familles en onglets au-dessus de leur rangée au lieu de s'étaler toutes. La colonne d'initiative montre moins de combattants et se replie par le haut. Le fil passe par-dessus le champ, sans fond plein |

**6. Fenêtre du bas** (jets et choix)

| Rôle | Place retenue |
|---|---|
| Place | centrée, largeur 960, bas à 8 px du bas de l'écran ; trois hauteurs : 170 (consigne), 212 (jet ou choix), 266 (liste ou dialogue) |
| Titre | ruban gothique centré, 9 px au-dessus du bord |
| Héros concerné | toujours à gauche, portrait 74 × 92 à 29 / 31 du coin haut-gauche de la fenêtre, nom à sa droite |
| Adversaire ou interlocuteur | toujours à droite, en miroir (29 / 31 du coin haut-droit de la fenêtre) |
| Actions | rangée centrée, 22 px du bas de la fenêtre, la principale en premier |
| Réserve dépensée | disques à gauche de la rangée d'actions |
| Groupe | la fenêtre remplace le bandeau (hors combat) ou la barre (en combat) |
| Dans 1280 × 720 | les deux camps gardent leur place, le centre rétrécit : trois cartes de choix côte à côte au plus, larges de 200 à 262 selon la place du centre (`kit.md`, § 2) ; à partir de quatre, la fenêtre prend la hauteur 266 et les choix se lisent en liste. Les hauteurs ne changent pas |

**7. Récit, document et issue**

| Rôle | Place retenue |
|---|---|
| Carton | centré, largeur 960, bas à 170 px du bas de l'écran (10 px au-dessus du bandeau, qui reste) ; il grandit vers le haut, jusqu'à 20 px du haut (530 de haut au plus), puis défile |
| Action principale | centrée sous les cartes ou au pied du cadre, 22 px du bas du cadre |
| Issue d'un combat | bannière d'issue (`kit.md`, § 2) : 560 × 150, centrée, haut à 190 px du haut, action unique centrée 28 px dessous ; pas de bandeau. Ce que l'issue rend (gains, pertes) se lit ensuite dans une fenêtre du bas. Une issue qui porte un texte (bataille de masse) reste un carton |
| Dans 1280 × 720 | le texte y gagne (lignes plus courtes) ; trois cartes côte à côte au plus, une quatrième ouvre une seconde rangée |

**8. Outil d'édition**

| Rôle | Place retenue |
|---|---|
| Titre et actions | dans la barre du haut, tendue sur la largeur ; « Tester la scène » en dernier, contre la croix (usage des barres d'outils) |
| Fermer | croix 44 px dans la barre, 37 / 19 du coin haut-droit |
| Volets, plan, inspecteur | volets ancrés à gauche et inspecteur à droite, largeurs fixes, tendus en hauteur ; le plan est tendu entre eux |
| Dans 1280 × 720 | le plan rétrécit seul ; les volets de gauche partagent une seule colonne, en onglets ; les actions de la barre qui ne tiennent plus perdent leur libellé et gardent leur pictogramme |

## Les 25 arbitrages

1. **Pastille du système.** Deux places, une seule frontière : en combat (tour de jeu, fenêtres posées sur le combat,
   fiche d'un combattant, fins de combat), haut à droite ; partout ailleurs, coin bas-droit (30 / 23) avec le journal
   au-dessus. *Changent :* dialogue, jet de compétence, dossiers du navire, de la bête et du véhicule (système en bas,
   journal ajouté) ; test de corruption (suit le décor sur lequel il tombe) ; marchandage (le journal revient) ;
   nouvelle partie (pastille retirée : un écran de gestion a déjà la croix). *Raison :* en combat le bas-droit est la
   fin du tour ; aucune autre raison ne justifie de la déplacer.
2. **Croix.** 22 / 18 du coin haut-droit partout, 44 px. Dans une barre : centrée en hauteur, à 25 px du bout droit de la barre.
   En combat : 22 / 76. *Changent :* options et compendium (5 pages, de 14 / 8 à 22 / 18) ; dossiers (4 pages,
   la croix remonte à 22 / 18 puisque le système descend) ; éditeur (4 pages, croix de 38 → 44 px, 37 / 19).
   La création garde 51 / 27. *Raison :* même geste, même endroit ; les deux exceptions ont une raison d'écran.
3. **Fiche du héros : croix.** La fiche, la progression, la création et les dossiers ferment par la croix ; le
   bas-gauche reste vide. *Change :* rien. *Raison :* une fiche est un écran posé par-dessus le jeu, pas un lieu qu'on
   quitte ; la création jugée ferme déjà par la croix.
4. **Le groupe sous une fenêtre du bas.** Hors combat, la fenêtre remplace le bandeau : le groupe disparaît, le héros
   concerné est dans la fenêtre, à gauche ; s'il faut choisir un héros, c'est la fenêtre « désignation d'un héros ».
   Un cadre qui doit laisser le bandeau visible est un carton (type 7), posé au-dessus. *Changent :* dialogue et jet de
   compétence (la colonne du groupe à gauche disparaît). Bataille de masse (issue, test de puissance) : inchangées,
   rangées parmi les cartons. *Raison :* la colonne à gauche est le signe du combat.
5. **« Continuer » sur un écran de passage.** Action de coin : pile de plaques larges de 136 à 24 / 28 du coin
   bas-droit, « Continuer » au-dessus, « Plus tard » dessous (une rangée ne tient pas à droite du bandeau de 960). *Changent :* fin de chapitre et fin de séance (de bas-gauche à bas-droite).
   *Raison :* le bas-gauche est le retour ; on avance vers la droite, comme la fin du tour.
6. **Action sous des cartes de choix.** Centrée, 22 px du bas du cadre. *Changent :* relâche en mer, conseil de bord,
   péril fluvial (plaque recentrée) ; document lu et relu (« Replier » centré au pied du bandeau). *Raison :* 60 pages
   le font déjà.
7. **Panneau d'activité.** À droite. À gauche sous le cartouche ne reste que ce que le lieu propose : menu des
   services et offre de l'hôte (les plaques à prix de l'aubergiste). *Changent :* nuit à l'auberge (le réglage de la
   nuit et « Passer la nuit » passent à droite, comme au bivouac), interlude en ville, carte du monde (2 pages),
   préparation de la bataille. *Raison :* à gauche on lit le lieu, à droite on agit.
8. **Action au pied du panneau.** Toujours ; le panneau prend la hauteur de son contenu au lieu d'une hauteur fixe de
   590. *Changent :* soins entre héros, jeux de taverne, médecin, carte du monde ; départ de nuit (« Attendre l'aube »
   revient au pied du panneau). *Raison :* un bouton ne flotte pas au milieu d'un parchemin vide.
9. **Ouvrir la carte du monde.** Pastille « ouvrir » de 44 px au bord droit, comme au port. En exploration, sans
   panneau à droite, elle est à 20 px du haut. « Le lieu », qui ramène à la vue du lieu, devient le retour (30 / 34 du coin
   bas-gauche) ; la colonne de gestes s'arrête 8 px au-dessus de son libellé. *Changent :* les 4 pages d'exploration.
   *Raison :* le bas-gauche ne doit jamais ouvrir autre chose qu'une sortie.
10. **Ruban.** À cheval, 9 px au-dessus du bord, partout, fenêtre du bas comprise. *Changent :* les 19 pages
    d'ouverture, de gestion et de l'éditeur (34 rubans remontent de 9 px), dont salon en ligne et éditeur qui mêlaient
    les deux. *Raison :* c'est une erreur de montage, pas un choix.
11. **Journal et chronique.** Un seul nom, « Journal », une seule colonne : 24 px du bord droit, largeur 300, bas à la
    ligne basse (164 px du bas, ou 20 px au-dessus d'une fenêtre du bas).
    Hors combat il se déplie par la pastille du journal, juste dessous ; en combat par le rond au-dessus du fil.
    *Changent :* les 4 pages d'exploration (« Chronique » renommée, 30 px plus étroite et recalée). *Raison :* même
    rôle, même colonne.
12. **Cartouche des options et du compendium.** 24 / 20 du coin haut-gauche, hauteur 96, comme les autres ; le panneau
    de gauche descend à 20 px sous le cartouche ; le registre ne bouge pas. *Changent :* options (3 pages), compendium (2). *Raison :* rien ne saute en
    passant de « Sauvegardes » à « Options ».
13. **Fenêtre du bas.** Centrée, largeur 960, bas à 8 px du bas ; hauteur 212, ou 170 pour une consigne sans jet, ou
    266 pour une liste (butin) et pour le dialogue. La barre de combat prend le même axe et la même largeur.
    *Changent :* les 60 pages (recentrées, ramenées de 1180 à 960) ; dialogue (hauteur 224 → 266). *Raison :* la fenêtre
    remplace le bandeau sans que les bords bougent.
14. **Héros dans une fenêtre de choix.** Comme dans un jet : portrait 74 × 92 à 29 / 31 du coin haut-gauche de la fenêtre, nom à sa droite, puis le
    filet, puis les cartes centrées dans la place restante. *Changent :* sommation, sauvetage par le destin, entrée de
    dissipation, mutation de corruption, tribut (portrait recalé) ; détermination, désengagement (portrait ajouté).
    *Raison :* on reconnaît d'abord qui choisit.
15. **Réserve dépensée.** À gauche de la rangée d'actions. *Changent :* mutation de corruption, sauvetage par le
    destin. *Raison :* 37 pages ; la réserve se lit à côté du bouton qui la dépense.
16. **Ordre des actions.** La principale en premier : à gauche dans une rangée, au-dessus dans une pile.
    *Changent :* test de puissance (« Round suivant » avant « Rassemblement ») ; bataille de masse et postes de
    bataille (la principale passe au-dessus de « Tirer un facteur »). La création est déjà conforme (« Suivant »
    au-dessus de « Précédent »). Seul l'éditeur met la principale en dernier. *Raison :* une seule lecture.
17. **Camps.** Le héros à gauche, l'autre à droite, toujours. *Changent :* coup critique (le héros qui frappe à
    gauche, l'Orc touché et son jet à droite) ; dialogue (l'interlocuteur à droite, les réponses du héros à gauche).
    *Raison :* le dialogue et le jet qui le suit montrent le même face-à-face.
18. **Récit sous le cartouche.** 20 px sous le cartouche, 32 px du bord gauche, largeur 340 ; 8 px plus bas sous un
    cartouche à météo. *Changent :* voyage en mer, voyage fluvial, poursuites, évènement de route, bataille.
    *Raison :* le texte ne bouge pas en passant de l'arrivée au port.
19. **Gabarit de fiche.** Les dossiers (navire, cargaison, bête, véhicule) prennent le gabarit de la fiche du héros :
    toute la largeur, identité à 26 / 20 du coin haut-gauche, large de 340, portrait 136 × 168. Seule la fiche d'un combattant reste réduite et
    décalée, pour laisser voir l'ordre d'initiative. *Changent :* les 4 dossiers. *Raison :* un dossier est la fiche
    d'un navire ou d'une bête.
20. **Création : le héros à droite.** Gardé. *Change :* rien. *Raison :* la création se lit de gauche à droite (choix,
    détail, résultat) ; le héros en cours est le résultat, avec « Suivant » à son pied.
21. **Onglets ou signets.** Les deux, selon le nombre : jusqu'à 6 sections, onglets horizontaux ; au-delà, signets
    verticaux au bord droit. *Change :* rien. *Raison :* treize catégories ne tiennent pas sur une rangée.
22. **Bandeau à l'ouverture de chapitre.** Centré, 960 × 152, à 8 px du bas. *Change :* ouverture de chapitre. *Raison :* il ne
    bouge pas quand le chapitre s'ouvre sur le premier lieu.
23. **Aperçu au survol.** 300 px de large, la hauteur suit le texte. *Changent :* exploration (236), cible au combat
    (286), fiche d'un sort (322). *Raison :* une largeur pour un rôle.
24. **Quitter un écran de route.** Retour à 30 / 34 du coin bas-gauche partout où l'on peut partir sans rien résoudre. *Changent :*
    voyage en mer et voyage fluvial (« Faire halte »), bivouac, activités en mer, postes de bord (un retour vers la
    route ou la traversée). Poursuites et bataille de masse : pas de retour, on n'en sort que par leur issue.
    *Raison :* la maquette de voyage jugée le montre déjà.
25. **Sortir par une plaque.** Une plaque « Quitter » n'est permise que si elle quitte un état et non un écran : un
    poste de tir, un salon en ligne. Elle est la dernière de son groupe d'actions. *Change :* pièce de bord (« Quitter
    la pièce » passe du bloc de gauche au groupe des actions, à droite, en dernier). Salon en ligne : inchangé.
    *Raison :* ce sont des actions du jeu ; la croix et le retour ferment des écrans.

## S'écarte d'une maquette jugée

Les maquettes jugées sont en 1707 × 780 : toutes se recomposent en 1280 × 720 par les ancrages ci-dessus (cadres du
bas à 960, décor et pièces tendues plus étroits). Les écarts ci-dessous sont ceux qui restent, mesurés depuis le bord
ou le coin d'ancrage de chaque pièce.

- **Fiche du héros** (`fiche-du-heros.jpg`) : le retour « Fermer » en bas à gauche est remplacé par la croix en haut à
  droite (arbitrage 3). C'est le seul écart de fond.
- **Options** (`options.png`, `options-chance.png`, `options-verrou.png`) : la croix descend de 10 px et recule de
  8 px ; le cartouche descend de 6 px et gagne 6 px de haut ; le panneau « Préférences » descend de 12 px ; son ruban
  remonte de 9 px (arbitrages 2, 12, 10).
- **Fiche du héros**, encore : l'identité passe de 400 à 340 de large.
- **Voyage** (`voyage-image-cible.jpg`) : le récit passe de 400 à 340 de large ; le récit de la route, en bas à gauche au-dessus de la frise sur la maquette,
  passe sous le cartouche (arbitrage 18) ; l'aperçu du test, d'environ 250 px, passe à 300 (arbitrage 23).
- **Jet d'attaque** (`attaque-jet-tombe.png`) et **barre de l'actif** (`combat-barre-de-l-actif.png`) : la fenêtre et
  la barre passent de 1180 à 960 de large, centrées ; les actions de la barre se rangent en onglets ; le ruban remonte de 3 px (arbitrages 13, 10).

Conformes, sans écart : accueil, création (croix dans la frise, héros à droite, « Suivant » au-dessus de
« Précédent »), lieu, auberge (l'offre de l'aubergiste reste à gauche), échoppe.
