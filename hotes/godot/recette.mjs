// LES RECETTES DE L'HÔTE GODOT (#2928, #3086), jouées au clic et au clavier comme un joueur, dans l'un de deux lieux
// qui portent les mêmes noms (`pilotage/`) :
// - `--natif` (#3945, `pilotage/natif.mjs`) : sans export ni navigateur, le jeu lancé sur une copie importée du projet,
//   sans rendu, son pont et son serveur dans ce processus ; `--rendu <méthode>` le lance en rendu réel sur un écran
//   virtuel, ce qu'attend un parcours qui lit l'image (`RENDUS_EN_NATIF`, `lot-de-recettes.mjs`). `--statique` s'y
//   refuse ; sans rendu, une capture se saute, notée ;
// - `--web <export>` (`pilotage/page.mjs`) : l'export Web (`node hotes/godot/construire.mjs --export --sortie <web>`)
//   servi par `servir.mjs`, Chromium piloté sur le canevas.
// Godot publie ce que l'écran porte (`globalThis.wfrpEcran`, `pont/CONTRAT.md`, section « Écran publié ») : le texte et
// le centre de chaque bouton, le point de chaque case, l'état de l'atelier. Aucun geste ne passe par le pont : chaque
// intention part d'un clic, d'un cran de molette ou d'une frappe.
// Chaque parcours s'ouvre depuis le menu d'entrée :
// - `combat` (défaut) : avec `--modeles` et `--element` (#3253), le dossier neuf servi sous `modeles/` reçoit la base et
//   les éléments du projet (manifestes, provenances et licences de `projet/modeles`, GLB tirés de la Release par
//   `recupererModeles`), puis `--element` importé (`importer.mjs --sans-publier`) ; le combat ouvert, chaque combattant
//   à corps de la vue a la base de l'élément, celle que l'écran publie posée (`wfrpEcran.corps`), et le combattant dont
//   le corps monte `--element` a monté aussi la tête de sa vue et porte, à la ligne de sa prise `secondaire`, l'emblème de sa
//   donnée (`portee.embleme`) ; sans ces options, le dossier servi est celui du projet, ou, avec `--statique`, celui que l'export a déposé, en scènes fabriquées (#3946). Puis la fenêtre du round à l'Entrée, une charge sur la plus proche des cibles en vue que la charge offre, cliquée à sa case (`casesDesCibles`),
//   la localisation, le jet et sa confirmation dans la fenêtre d'attaque, la fin du tour ; le héros suivant marche
//   d'une case (aperçu puis déplacement) et finit son tour ; les jetons de l'adversaire repris par les minuteurs de
//   Godot jusqu'à la Défense du héros visé, l'adversaire en vue ou non, jetée et confirmée, puis le round 2. `wfrpPont.appeler('vue')` observe la
//   partie, et chaque bouton se trouve par l'élément de la vue qu'il dessine (`vue.zones`). Le jet tombé, la fenêtre
//   ne redessine ni son geste ni ses réglages d'avant le jet (#2936, `ouvert`).
// - `critique` : la fenêtre du round à l'Entrée, puis le combat joué en joueur pressé (chaque fenêtre à l'Entrée, ou par
//   la première valeur ouverte de ses choix quand aucun geste n'a le focus, chaque tour une charge ou une attaque cliquée
//   sur la case de la première cible, en vue ou non, sinon la fin du tour) jusqu'au premier Coup Critique, dont la fenêtre dit la localisation et
//   les effets.
// - `fin` : le combat joué de même jusqu'à sa fin, la dernière séquence poursuivie, puis la fenêtre de la fin qui tient
//   la main, sa sortie en focus ; sa sortie à l'Entrée rend la main à la scène.
// - `exploration` (`--scenario porte-close`) : l'entrée de la scène poursuivie à l'Entrée, le groupe à sa case, la porte
//   ouverte par le bouton de son geste d'exploration, puis un clic sur une case du réduit qui y mène le groupe.
// - `relief` (`--scenario grimpant`, #3476) : la fenêtre du round à l'Entrée, le chasseur sur son plateau de 4 m ; un
//   clic sur une case du plateau à une case de lui, au bord de la falaise, en montre l'aperçu : la case cliquée est
//   celle de la surface sous le pointeur, à sa hauteur.
// - `etage` (`--scenario fenetre-ecuries`, #3476) : l'entrée de la scène poursuivie à l'Entrée, le groupe à l'étage du
//   relais ; un clic sur une case du couloir de l'étage y mène le groupe : la case cliquée est celle du plancher sous le
//   pointeur, à sa couche, pas celle de la salle basse dessous.
// - `regards` (`--scenario fenetre-ecuries`, #3476) : l'entrée de la scène poursuivie à l'Entrée, le groupe à l'étage du
//   relais ; en tactique, D tenue fait glisser la caméra, Origine la ramène au groupe ; la touche V passe du regard
//   tactique au plateau, où un clic au point publié d'une case du couloir, sans autre geste, y mène le groupe
//   (#4031), puis à l'immersion ; en immersion, une touche de marche
//   tenue (Z, Q, S ou D) mène le groupe à une case voisine, que le noyau a jouée ; V rend la tactique.
// - `meteo` (`--scenario voyage`, #3625) : le village sous la pluie ; en tactique, des averses tombent dans le monde ; au
//   plateau, rien ne tombe ; en immersion, la pluie tombe autour de l'œil.
// - `vehicule` (`--scenario caraque`, #2987) : la page rechargée à deviceScaleFactor 2 ; en tactique, chaque véhicule de
//   la vue posé à l'écran (`wfrpEcran.corps`) : son élément, l'emblème de sa donnée sur ses surfaces `blason`, la pièce de
//   chacun de ses postes et de chacune de ses Améliorations, dans l'ordre de la vue ; les fenêtres fermées à l'Entrée, une
//   capture d'ensemble, puis Origine et la molette rapprochent la caméra du véhicule actif, capturé à chaque cran de pivot (Q).
// - `cadrages` (`--vues <fichier>`, #3686) : la page rechargée à deviceScaleFactor 2 ; l'entrée de la scène poursuivie à
//   l'Entrée, le monde posé (`attendreLeMonde`) ; puis chaque vue nommée du fichier, un tableau de
//   `{ nom, regard, case: { x, y }, etage?, lacet, tangage }` en immersion ou `{ nom, regard, case, etage?, lacet, zoom }`
//   en tactique et au plateau : son regard pris à la touche V, la caméra posée par `wfrpCadrer` (`pont/CONTRAT.md`,
//   section « Écran publié ») regarde depuis la case et la couche demandées, à l'azimut demandé, le plan de sa couche
//   (`plan` du pont, l'œil marqué) s'écrit au journal, et la vue se capture sous son nom.
// - `bord` (`--scenario a-bord-de-la-caraque --route <route.json>`) : les fenêtres closes, le monde posé, chaque case
//   de la route atteinte au clic et chaque échelle franchie par son geste (« Escalader », « Descendre en escalade »),
//   une capture par couche atteinte.
// - `brume` (`--scenario brouillard`, #3625) : la clairière sous le brouillard ; en tactique, les nappes de la donnée ;
//   en immersion, aucune nappe et la brume de profondeur part de l'œil, plus serrée.
// - `dialogue` (`--scenario dialogue-multi`) : l'entrée de la scène poursuivie à l'Entrée, un clic sur une case à côté de
//   Gustav, son offre « Parler » cliquée parmi les gestes d'exploration, la conversation dessinée, puis la première
//   réponse cliquée : l'interlocuteur suivant prend la parole.
// - `document` (`--scenario documents-edo`) : l'entrée de la scène poursuivie à l'Entrée, le groupe à côté de la
//   liasse, son offre cliquée, « Chapitre 1 » puis « Lire » : le document se lit au centre ; « Refermer » rend la
//   conversation à la liasse.
// - `incantation` (`--scenario magie`) : le groupe franchit la ligne d'engagement à sa case la plus proche, la liste des sorts de la Haute
//   Sorcière ouverte, Fléchette choisie au clavier, sa cible cliquée : la fenêtre d'incantation ; le jet à l'Entrée,
//   un pas de Surincantation alloué à la Portée par son bouton, puis « Appliquer » à l'Entrée referme la fenêtre.
// - `soin` (`--scenario magie`) : le groupe franchit la ligne d'engagement à sa case la plus proche à l'écran, les tours passent jusqu'au Tueur, son offre
//   « Soigner » cliquée puis son patient : la fenêtre du soin nomme le patient, l'acte et le Test en choix ; le jet à
//   l'Entrée.
// - `voyage` (`--scenario voyage`) : l'entrée de la scène poursuivie, « Carte du monde » ouvre la carte, chaque trajet
//   et ses modes, le plan de ses lieux ; « À pied » vers Steinbruck part, les journées et la halte passent jusqu'au
//   récit de l'arrivée, puis l'écran du lieu, ses services et ses trajets.
// - `marche` (`--scenario commerce-fluvial`, #3534) : les fenêtres passées à l'Entrée, « Le lieu » ouvre l'écran du
//   lieu, son service de marché la halle (`marcheDeTerre`) et ses offres ; « Acheter » compose l'achat, « Conclure
//   l'achat » montre le lot.
// - `repos` (`--scenario voyage`, #3328) : « Carte du monde », « À pied » part, les fenêtres passent à l'Entrée jusqu'à
//   la nuit de repos ; le couchage de Bjorn, en chambre privée sur sa carte, passe à « Dehors », puis la nuit se clôt.
// - `repit` (`--scenario bataille-de-masse`) : les dés d'Événement tombent, l'entre-deux-aventures montre un onglet par
//   héros, ses Activités restantes et la liste de l'Activité à composer, chacune fermée par sa raison ; « Revenus »
//   choisi dans la liste au clavier, « Entreprendre » ouvre son jet, lancé à l'Entrée puis appliqué : l'onglet du héros
//   compte une Activité de moins.
// - `ouvrage` (`--scenario entre-deux-aventures`) : les dés d'Événement tombent ; dans l'onglet du forgeron,
//   « Artisanat » choisi dans la liste de l'Activité, puis le deuxième ouvrage ouvert et l'Atout « Solide » dans les leurs,
//   « Entreprendre » l'engage : l'ouvrage ne s'offre plus, l'Artisanat en cours se poursuit.
// - `bataille` (`--scenario bataille-de-masse`) : l'interlude clos, la bataille montre ses armées et les Scènes du
//   Round ; « Résoudre » ouvre le jet de la première Scène à postes, lancé à l'Entrée puis appliqué : la Scène se
//   ferme ; le Test spectaculaire ouvre l'entre-deux-Rounds, « Round suivant » le Round 2.
// - `fiche` : la fenêtre du round à l'Entrée, puis le statbloc du premier héros ouvert par son bouton, celui d'un ennemi
//   de l'ordre du tour, donc en vue, dont le cadre du monde montre la case, ouvert au clic droit sur elle, et la fiche fermée par son bouton « Fermer ».
// - `inventaire` (`--scenario porte-close`) : l'entrée de la scène poursuivie à l'Entrée, le statbloc de Apothicaire, sa
//   carte amenée à la molette dans la rangée du groupe, son armure choisie à l'onglet de ses possessions puis ôtée par « Porter », sa potion choisie.
// - `creation` (`--scenario marche-equipement`) : l'entrée de la scène poursuivie à l'Entrée, « Nouveau héros » ouvre
//   la création sur la race, sans résultat ni suivante avant le d100 ; le d100 tiré, la suivante à l'Entrée ; la
//   carrière tirée, puis les Caractéristiques ; « Nouveau héros » pressé ferme la création sans héros nouveau.
// - `campagne` (#3009) : « Jouer » ouvre une partie au groupe, sans scène : les pré-tirés à recruter, les campagnes du
//   jeu, dont « Lancer » ne se joue pas groupe vide ; deux pré-tirés recrutés à leur bouton, chacun en carte au pied de
//   l'écran, son recrutement refusé ensuite ; « Lancer » de la Diligence pose sa scène d'entrée, le groupe composé au
//   monde, sa fenêtre d'ouverture en main ; « Sauvegardes » ouvre le panneau des emplacements, l'emplacement 1 écrit à
//   son bouton ; « Quitter la partie » rend le menu, le pont sans partie ; la page rechargée, « Reprendre » montre
//   l'emplacement 1 et l'automatique gardé en quittant, l'emplacement 1 chargé rend la partie, son groupe et sa scène ;
//   quittée, « Jouer » de nouveau, un pré-tiré recruté, l'Arène lancée sans recharger la page.
// - `roster` (#3009) : un héros créé et engagé par le pont, sans l'écran, la partie quittée ; la page rechargée,
//   « Jouer » le montre au roster ; « Recruter » de sa carte le fait entrer au groupe sous l'id que le roster garde, son
//   recrutement refusé ensuite ; la Diligence lancée avec lui, puis quittée, il reste au roster ; « Exporter » en
//   télécharge le fichier ; « Supprimer », puis « Importer un personnage… » sur ce fichier le rend au roster ;
//   « Supprimer » l'en retire, page rechargée comprise.
// - `reglages` (#3009) : « Options » du menu ouvre le panneau des réglages ; « Oui » des dés fixés pressé, le pont dit la
//   préférence réglée ; la page rechargée, elle revient du stockage ; « Jouer », puis « Options » de la partie : le
//   même panneau, « Non » la remet, « Fermer » rend la partie. Le volume de la musique (#3949) réglé par le pont avant
//   le rechargement : il revient du stockage et, dans la page (`lieu.releverLesGains`), un gain de son graphe audio le
//   porte au lancement ; remis à 1 par le pont, le geste du panneau y remet ce gain.
// - `editeur` (#3508), servi avec une copie des projets manuscrits du dépôt (`servir.mjs`, `depot`) : « Éditeur » ouvre la
//   Diligence telle que le dépôt la sert, sur sa couche 0, rien à enregistrer ; l'outil Hauteur, « Haute (4 m) » et le
//   pinceau 3×3 choisis à leurs boutons, un glissé de deux cases sur la carte : bouton tenu, la surcouche couvre
//   l'emprise du pinceau sur chaque case et le monde reste tel quel ; relâché, la surface des cases peintes monte à
//   l'écran. « Enregistrer » l'écrit à la copie du dépôt, puis rien à enregistrer ; « Annuler » rend la surface à sa
//   place. L'outil Murs, un clic sur le côté commun de deux de ces cases pose une cloison sur le monde ; l'outil
//   Sélection, un clic au même point la choisit, gainée, et la dit ; à l'inspecteur, « Porte » en fait une porte, puis
//   « Fermée au départ » la ferme, que le monde dessine ; « Annuler » trois fois la retire. L'outil Volée, un clic trace
//   une case, en surcouche, et « Poser la volée » se refuse d'une case seule, sa raison en clair au panneau ; « Effacer le
//   tracé » la retire. L'outil Crénelage, un clic marque la case d'un parapet, que la case pointée dit ; « Annuler »
//   l'efface. L'outil Décor, un clic sur une case libre y pose le premier décor du catalogue, sélectionné, son nom au-dessus d'elle ;
//   son nom effacé au champ de l'inspecteur, un autre tapé, « Renommer » le pose au-dessus de la case ; « Copier »,
//   l'outil Sélection, un clic sur une case libre puis « Coller » y pose la copie, nommée de même ; à l'inspecteur de la
//   copie, « Source de lumière » l'allume à 6 m, « Rayon +1 m » la porte à 7 m. L'outil Emplacement de siège, un clic sur
//   une case libre y pose le premier engin, nommé comme lui ; « Droite (tribord) » fixe son créneau. L'outil Sélection,
//   un clic sur une case libre vide la sélection. L'outil Zone, une pièce tirée de deux cases sur deux, nommée et munie de
//   sa poignée ; l'outil Sélection, la poignée glissée l'agrandit ; à son inspecteur (#3606), « Ajouter : Test de
//   traversée », la difficulté choisie en liste et « sans assistance » au clic ; « Supprimer » la retire. L'outil
//   Personnage, sa première fiche (un profil standard), un clic au même endroit la pose (#3606 M1a) : à l'onglet Combat de son
//   inspecteur, « Ajouter : rôle au combat », « Ajouter : options », dont le premier Trait offert est un Facultatif de sa fiche,
//   et « caractéristiques aléatoires » au clic ; à l'onglet Identité, une entrée de fiche couverte choisie en liste ;
//   « Supprimer » le retire. L'outil
//   Architecture, un clic sur une case libre puis « Nouveau corps » y pose un corps, dont l'inspecteur dit la toiture ;
//   « Poser une façade », un clic sur le côté nord de la case y pose une façade, « Ajouter une ouverture » lui en donne
//   une ; « Tirer une exclusion de toiture », un rectangle tiré à côté l'ajoute au corps ; un clic sur la case puis
//   « Nouvelle masse de toiture » y pose une masse, que « +1 » monte à deux niveaux. L'outil Sélection, un clic sur la
//   case voisine du décor choisit le déclencheur qui la couvre : à son inspecteur, sa condition « TOUS (ET) » choisie en
//   liste, puis « Ajouter » lui donne une condition dans son contenu ; « Annuler » deux fois la retire.
//   Au flux du même déclencheur, un pas d'effet « journal » : son adresse de prose (#3606 M2g) se désigne par des choix
//   seuls, le livre, le chapitre que Godot charge à la demande (`source/`), une cellule ajoutée, sa ligne choisie : le
//   passage désigné se lit à l'inspecteur, l'empreinte jamais offerte ; « Annuler » rend le flux d'avant.
//   « Charger une planche… » ouvre le choix d'un fichier de la page, que la recette remplit d'une planche quadrillée : le
//   calque se pose sur toute la carte ; « Caler par deux points », puis le centre d'une case comme premier point de
//   l'image, son coin comme son nœud, et le centre de la case quatre plus loin comme second point, le coin de la case
//   huit plus loin comme son nœud : la planche s'étire du double, son échelle dite en pixels par case moitié de celle
//   d'avant.
//   « Couche 1 » édite l'étage, sans calque. Au menu Fichier, « Carte du monde » (#3606 M5) montre son plan à côté du
//   panneau : l'outil Lieu, un clic au large y pose un lieu, « Ajouter un lieu » un second ; l'outil Sélection, le premier
//   glissé au large, « Annuler » une fois le rend à sa place ; l'outil Chemin, le premier tiré jusqu'au second les relie ;
//   l'outil Sélection, un clic sur la route la choisit, « Depuis » le second l'oriente, son refus s'écrit au formulaire ;
//   un clic sur le premier, son libellé s'écrit au formulaire et se lit au plan ; « Plan du lieu », l'outil Épingler, un
//   clic y pose un point d'intérêt, « Retirer le point d'intérêt » l'ôte, « Annuler » le rend ; le plan refermé, un clic
//   au large vide la sélection, un axe actif coché ; « Annuler » jusqu'au plan d'avant, puis « Scène » rend la scène. À l'ouverture, sans sélection, l'inspecteur est celui de la scène : « +15° »
//   tourne son nord, « Annuler » le rend au haut du plan ; au formulaire tiré du schéma de la scène (#3606), « Ajouter :
//   message de départ » l'ajoute vide, son texte tapé au clavier sur deux lignes, « Écrire » le pose, « Annuler » deux
//   fois le retire. « Nouvelle scène » l'ajoute au projet ; « Annuler » rend le projet à ses scènes d'avant, la scène
//   d'avant montrée, « Rétablir » la rend ; « Retirer la scène » rend la précédente, dont « +15° » tourne le nord ; une
//   autre scène choisie à la liste, « Annuler » rend la précédente, son nord au haut du plan. Une seconde « Nouvelle scène » reçoit, dans un bloc de cases à l'écran, les ouvrages de la
//   Diligence : une couche ajoutée, un palier peint en Dallage à 4 m ; douze côtés en Mur à ossature en bois autour de
//   trois cases sur trois, une porte au nord, une fenêtre au sud ; la pièce tirée sur elles ; un corps, son étage, une
//   façade au nord et son ouverture ; une volée de quatre cases tirée vers le palier, posée ; un décor tourné à l’est,
//   un départ, un déclencheur tiré : la validation ne dit aucune erreur. « Enregistrer » écrit au dépôt la scène et
//   chacun de ces ouvrages ; « Tester la scène » ouvre le combat sur elle.
//   Avant « Tester la scène », à la zone Logique (#3606 M3b2), « Ajouter un dialogue » le crée, pressé, à l'inspecteur :
//   un nœud ajouté, choisi comme départ, marqué « ▶ », identifié « accueil » à son formulaire ; « Supprimer » le retire.
//   Puis (#3606 M4c) « Ajouter une rencontre » la crée, pressée, à l'inspecteur : ses membres comptés, son objectif de
//   victoire changé en « Survivre N Rounds » ; « Supprimer » la retire. Une rencontre ajoutée de même, visée par
//   l'embuscade de la première route de la carte, se renomme à la zone Logique, et « Supprimer » se refuse, la route
//   dite ; « Annuler » jusqu'à la scène sans rencontre. Puis (#3606 M6) le menu Fichier ouvre le narratif, son ouverture
//   à l'inspecteur ; « Ajouter un indice » refusé tant qu'aucune affaire n'est au narratif, dit ;
//   une affaire ajoutée, choisie, son titre écrit ; un indice ajouté, un stade ajouté et identifié, le premier retiré,
//   le dernier refusé, dit ; un état ajouté, sa forme passée à « Issue énumérée », sa valeur neuve à l'inspecteur ; un
//   écart ajouté par la liste des entrées libres ; « Annuler » jusqu'au narratif d'avant, puis la scène rendue.
// - `atelier` : `--base` importé seul (`importer.mjs --sans-publier`) dans `--modeles`, dossier neuf servi sous
//   `modeles/` ; la base choisie à la liste de tête « Corps », aucun emplacement à l'onglet Équipement ; `--element` importé puis
//   « Recharger les modèles » : l'élément, tenu, offert par la liste de chaque prise, de chaque emplacement dont l'os le
//   porte (`osDesRigides` du listage) et de chaque emplacement où se range sa forme (`emplacementsDeRangement`), et de
//   ceux-là seuls (`CONTRAT.md`, « Atelier 3D ») ; les aides, l'élément monté puis démonté (« Aucun ») ; si une surface de `--element` porte
//   `blason: true` (#3111), deux emblèmes posés tour à tour à la prise `main`, chacun sans erreur publiée, puis
//   « Aucun » et le premier reposé, ces quatre choix sans requête du GLB de l'élément (`performance`, page) ni appel
//   `composer` de Godot (`appelerEnOctets` enveloppé, témoins : le GLB requis au montage, `modeles` appelé au premier
//   rechargement) ; puis « Aucun » : l'emblème effacé au démontage, l'élément remonté sans emblème (le défaut de la
//   composition), le premier reposé avant le rechargement (sans surface `blason`, une ligne du journal dit la preuve non
//   jouée) ; à l'onglet Animation, un clip joué, mis en pause, avancé et reculé d'une image (au clic puis à l'Entrée),
//   sa vitesse réglée ; puis `--reexport` importé à la place de la base (`importer.mjs --remplacer`), l'élément qui la
//   référence revalidé contre elle et laissé en place, « Recharger les modèles » sans relancer la page : l'empreinte
//   publiée devient celle du manifeste réimporté, l'état (clip, instant, pause, vitesse, montés, emblèmes, aides) est
//   gardé. Sans `--modeles`, le véhicule (#2987) sur le dossier des modèles du projet, à deviceScaleFactor 2 : la
//   caraque choisie à côté des bases, cadrée à sa taille, capturée de trois quarts ; un canon moyen à deux places de
//   tribord, deux de bâbord et une de proue (onglet Équipement), le Sabord installé, puis d'autres Améliorations, une
//   couleur et l'emblème de ses voiles, enfin le Sabord retiré : à chaque geste, le véhicule publié est celui que le pont
//   compose pour la même entrée (`vehicule`).
// - `composition` : Soldat, manquants et copie validée côté Node ; une couleur changée à l'onglet Couleurs, posée dans
//   la composition et sur les matériaux de la pièce ; pièce skinnée montée et démontée, courtaud, corpulence aux
//   bornes, marche au clavier au corps neutre et couplage de la racine au temps du clip, puis repos.
// - `preset` (`--preset <id>`) : sur le dossier des modèles du projet, à deviceScaleFactor 2, la base du preset choisie
//   en tête du panneau, puis le preset à l'onglet Personnage ; le personnage composé sans erreur, chaque chose qu'il porte
//   montée dans la scène ou nommée manquante ; la fusion porte la pile des couches (#3842), au bilan de l'évaluateur
//   sur les mêmes éléments et les mêmes formes ; puis capturé de face, de trois quarts et de dos (glissés au bouton
//   droit de l'orbite) : ce que le jeu montrera d'un preset.
// - `vision` (`--scenario grimpant`, #3950) : la fenêtre du round à l'Entrée, l'ennemi en vue a son corps posé et son
//   rang dans l'ordre du tour ; sous chaque regard que la touche V offre au combat (tactique et plateau, `regardDuJeu`
//   y rendant la tactique pour l'immersion), la caméra posée au même point par `wfrpCadrer` (`CADRAGES_DE_LA_VISION`),
//   la luminance de chaque case libre du cadre lue sur la capture au point que `wfrpEcran` publie ; le pas du chasseur
//   cliqué vers (5, 0) change `vue.vision` et sort l'ennemi de la vue : ni corps posé, ni rang dans l'ordre du tour, sa
//   case gardée aux occupants ; le fondu fini, sous chaque regard, le même cadrage publie les mêmes points, une case
//   quittée s'assombrit et une case entrée en vue s'éclaire, chacune dans le rapport des teintes (`vision.teintes`), au
//   plus `TOLERANCE_DU_VOILE` au-dessus et, sous le soleil, `CREUX_DU_PILOTE` de plus au-dessous.
// - `murs` (`--scenario zones-pieces`, #3950) : l'entrée de la scène poursuivie à l'Entrée, le groupe mené dans la Cave
//   par la porte ouest, puis devant la porte de la Chambre, le toit levé aux deux ; à chaque fois, la tactique cadrée au
//   même point par `wfrpCadrer` (`CADRAGE_DES_MURS`), la luminance de chaque mur plein lue sur la capture au-dessus de son
//   pied, le milieu des points publiés de ses cases ; un mur resté en vue ne change pas, et chaque mur qui change d'état,
//   lu sur sa face dont la case porte son état, le plus grand de ceux de ses cases (`aretes`), se rend dans le rapport
//   des teintes à `TOLERANCE_DU_VOILE` près.
// Chaque étape est assertée ; une assertion fausse, une erreur relevée par le pont (`erreursGlobales`) ou une erreur de
// console rendent un code non nul.
//
//   node hotes/godot/recette.mjs --natif --captures <dossier> [--parcours editeur] [--scenario dome] [--graine 7]
//   node hotes/godot/recette.mjs --web <dossier de l'export> --captures <dossier> [--scenario dome] [--graine 7]
//   node hotes/godot/recette.mjs --web <export> --captures <dossier> --statique
//   node hotes/godot/recette.mjs --scenario embleme-au-combat --web <export> --captures <dossier> --modeles <dossier neuf>
//     --element <production d'un élément à surface blason>
//   node hotes/godot/recette.mjs --scenario teinte-au-combat --web <export> --captures <dossier>
//   node hotes/godot/recette.mjs --parcours exploration --scenario porte-close --web <export> --captures <dossier>
//   node hotes/godot/recette.mjs --parcours relief --scenario grimpant --web <export> --captures <dossier>
//   node hotes/godot/recette.mjs --parcours murs --scenario zones-pieces --web <export> --captures <dossier>
//   node hotes/godot/recette.mjs --parcours etage --scenario fenetre-ecuries --web <export> --captures <dossier>
//   node hotes/godot/recette.mjs --parcours regards --scenario fenetre-ecuries --web <export> --captures <dossier>
//   node hotes/godot/recette.mjs --parcours creation --scenario marche-equipement --web <export> --captures <dossier>
//   node hotes/godot/recette.mjs --parcours campagne --web <export> --captures <dossier>
//   node hotes/godot/recette.mjs --parcours reglages --web <export> --captures <dossier>
//   node hotes/godot/recette.mjs --parcours roster --web <export> --captures <dossier>
//   node hotes/godot/recette.mjs --parcours vehicule --scenario caraque --web <export> --captures <dossier>
//   node hotes/godot/recette.mjs --parcours cadrages --scenario a-bord-de-la-caraque --vues hotes/godot/cadrages/a-bord-de-la-caraque.json
//     --web <export> --captures <dossier>
//   node hotes/godot/recette.mjs --parcours dialogue --scenario dialogue-multi --web <export> --captures <dossier>
//   node hotes/godot/recette.mjs --parcours atelier --web <export> --captures <dossier>
//   node hotes/godot/recette.mjs --parcours atelier --web <export> --captures <dossier> --modeles <dossier neuf>
//     --base <production> --element <production> --reexport <production> [--clip Sword_Attack]
//   node hotes/godot/recette.mjs --parcours composition --web <export> --captures <dossier> --modeles <dossier neuf>
//     --base <production> --piece <production skinnée>
//   node hotes/godot/recette.mjs --parcours preset --preset sorcier --web <export> --captures <dossier>
//   node hotes/godot/recette.mjs --parcours bord --scenario a-bord-de-la-caraque --web <export> --captures <dossier>
//     --route <route.json de hotes/godot/recettes/route-a-bord.hors-store.test.ts>
/**
 * Les recettes de `hotes/godot/recette.mjs` partent du menu et ne jouent aucun geste par le pont. Avec `--statique`,
 * l'export se sert tel que le site le publie, ses modèles en scènes fabriquées (section « Atelier 3D », `forme`). Le tour complet
 * clique « Combat », puis y lit où cliquer ; il observe la partie par `vue`. L'atelier (`--parcours atelier`) clique
 * « Atelier », lit ses boutons et son état dans `wfrpEcran`, et sert un dossier de modèles neuf que la recette remplit
 * par `importer.mjs --sans-publier` ; sans `--modeles`, il sert le dossier des modèles du projet et y pose un véhicule,
 * qu'il compare à la réponse de `vehicule`, appelée de la page pour l'observer. La page s'ouvre sous `?recette=1`
 * (`PontDuNoyau.en_recette`) : Godot y publie `wfrpEcran`, une image ne se dessine que si l'écran a changé, sans anticrénelage
 * multiéchantillon ; une lecture de la page n'attend plus le dessin d'une image, et un geste en attend un moins long. Un cran de molette de l'atelier attend
 * que `atelier.defilement` change, jamais une publication quelconque.
 * Le parcours des cadrages (`--parcours cadrages --vues <fichier>`) attend que le monde soit posé, le modèle de
 * chaque navire de la vue (`navires`) et la base de chaque corps dessiné (`corps`), puis prend le regard de chaque
 * vue nommée du fichier à la touche du regard, la pose par `wfrpCadrer`, écrit au journal le plan de sa couche, l'œil
 * posé marqué (`plan`), et la capture sous son nom ; les vues de la caraque sont
 * `hotes/godot/cadrages/a-bord-de-la-caraque.json`.
 * L'éditeur (`--parcours editeur`) sert une copie
 * neuve des projets manuscrits du dépôt, clique « Éditeur », puis ses boutons, les cases de la carte et les points du
 * cadre du plan de la carte du monde (`wfrpEcran.editeur.plan`), lit son état
 * dans `wfrpEcran.editeur`, et le fichier que « Enregistrer » écrit à la copie ; il amène chaque bouton et chaque champ
 * du panneau par la molette, aux crans que dit son point au défilement publié (`wfrpEcran.panneau`) ; il intercepte le choix de fichier de
 * la page (`Page.setInterceptFileChooserDialog`) et remplit l'`input[data-fichier]` d'une planche qu'il écrit.
 * En natif (`--natif`), les mêmes parcours se jouent sans export : `wfrpEcran` et `wfrpPont` vivent dans le processus de
 * la recette, chaque geste est une commande du pilote (`projet/recettes/pilote.gd`), et le choix de fichier rend le
 * chemin de la planche.
 * @contrat Écran publié
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { crc32, deflateSync } from 'node:zlib'
import { FIL_DE_LA_PAGE_MS } from './servir.mjs'
import { LISTAGE } from './listage.mjs'
import { JEUX_DU_PARCOURS } from './lot-de-recettes.mjs'
import { tableTotale } from '../../src/lib/tableTotale.ts'
import { gestesDessines } from './pont/dessines.ts'
import { dossierDesProjetsLivres, listerProjetsLivres, PROJETS_MANUSCRITS } from '../../scripts/guards/lib/projetsLivres.mjs'
import { decodePng } from '../../scripts/qc/lib/pngDecode.mjs'
import { chargerAssets, chargerEvaluateur } from './asset/charger.mjs'

const chaine = { type: 'string' }
const { values: o } = parseArgs({
  options: { parcours: { type: 'string', default: 'combat' }, web: chaine, captures: chaine, scenario: { type: 'string', default: 'dome' }, graine: { type: 'string', default: '7' }, modeles: chaine, base: chaine, element: chaine, reexport: chaine, piece: chaine, vues: chaine, route: chaine, preset: chaine, clip: { type: 'string', default: 'Sword_Attack' }, statique: { type: 'boolean' }, natif: { type: 'boolean' }, rendu: chaine },
})
if (o.statique && o.modeles) throw new Error('--statique sert les modèles déposés dans l’export : --modeles hors de propos')
if (!o.web === !o.natif || !o.captures || (o.rendu && !o.natif)) throw new Error('usage : node hotes/godot/recette.mjs (--web <dossier de l’export> | --natif [--rendu <méthode>]) --captures <dossier> [--parcours <nom>] ; les parcours : l’en-tête du fichier')
if (o.parcours === 'atelier' && o.modeles && !(o.base && o.element && o.reexport)) throw new Error('--parcours atelier avec --modeles <dossier neuf> attend --base, --element et --reexport <dossier de production>')
if (o.parcours === 'cadrages' && !o.vues) throw new Error('--parcours cadrages attend --vues <fichier JSON des vues nommées>')
if (o.parcours === 'bord' && !o.route) throw new Error('--parcours bord attend --route <route.json> (`hotes/godot/recettes/route-a-bord.hors-store.test.ts`)')
if (o.parcours === 'composition' && !(o.modeles && o.base && o.piece)) throw new Error('--parcours composition attend --modeles <dossier neuf>, --base et --piece <production skinnée>')
if (o.parcours === 'preset' && !o.preset) throw new Error('--parcours preset attend --preset <id d’un preset de personnage>')
if (o.parcours === 'combat' && !o.modeles !== !o.element) throw new Error('--parcours combat attend --modeles <dossier neuf> et --element <production> ensemble, ou aucun des deux')
if (['atelier', 'composition', 'combat'].includes(o.parcours) && o.modeles && existsSync(o.modeles)) throw new Error(`--modeles ${o.modeles} existe : le parcours importe dans un dossier neuf`)

/** Les projets manuscrits du dépôt, chacun par son chemin relatif au corpus (`listerProjetsLivres`). */
const MANUSCRITS = listerProjetsLivres().filter((rel) => Object.hasOwn(PROJETS_MANUSCRITS, basename(rel)))
/** Le dépôt que sert le parcours `editeur` : une copie neuve de ses projets manuscrits, que l'enregistrement écrit. */
const depot = o.parcours === 'editeur' ? mkdtempSync(join(tmpdir(), 'recette-editeur-')) : null
for (const rel of depot ? MANUSCRITS : []) {
  mkdirSync(dirname(join(dossierDesProjetsLivres(depot), rel)), { recursive: true })
  cpSync(join(dossierDesProjetsLivres(), rel), join(dossierDesProjetsLivres(depot), rel))
}
/** Le dossier des modèles que lisent les preuves : `--modeles`, sinon celui du projet, que le serveur sert ou dont
 *  l'export servi en `--statique` a fabriqué les scènes. */
const DOSSIER_SERVI = o.modeles ?? fileURLToPath(new URL('./projet/modeles', import.meta.url))
/** Le lieu où la recette se joue, choisi une fois : la page de l'export (`--web`), ou le jeu lancé sans export
 *  (`--natif`). Les deux portent les mêmes noms. */
const lieu = o.natif ? await import('./pilotage/natif.mjs') : await import('./pilotage/page.mjs')
const { ATTENTE_ECHUE, clic, evaluate, geste, molette, realKey, realKeyDown, realKeyUp, shot, sleep, waitFor } = lieu
const { session, srv, garde } = await lieu.ouvrir({ web: o.web, modeles: o.modeles, statique: o.statique, depot, scenario: o.scenario, graine: o.graine, rendu: o.rendu })
const noter = (t) => console.log('·', t)
const lire = (expression) => evaluate(session, expression, { timeoutMs: FIL_DE_LA_PAGE_MS })
const vue = async () => JSON.parse(await lire(`wfrpPont.appeler('vue')`)).vue
/** L'attente la plus longue d'une publication : une vue se publie à l'image qui suit sa mise en page, après que le pont
 *  l'a rendue. */
const PUBLICATION_MS = 8000
/** Le suivi des publications, posé une fois dans le lieu où vivent `wfrpEcran` et `wfrpPont` : `recetteEcran.perime`
 *  dit la dernière méthode que Godot a appelée au pont depuis la dernière publication (`null` sans elle). La recette
 *  lit la vue au pont, où elle change dès l'appel de Godot ; l'écran, lui, se publie à l'image qui suit sa mise en
 *  page. */
const SUIVRE_LES_PUBLICATIONS = `(() => {
  const pont = globalThis.wfrpPont
  if (globalThis.recetteEcran?.pont === pont) return true
  const suivi = (globalThis.recetteEcran = { pont, perime: null, publie: globalThis.wfrpEcran })
  Object.defineProperty(globalThis, 'wfrpEcran', { configurable: true, get: () => suivi.publie, set: (ecran) => { suivi.publie = ecran; suivi.perime = null } })
  const appelerEnOctets = pont.appelerEnOctets
  pont.appelerEnOctets = function (methode, ...reste) { if (methode !== 'erreursGlobales') suivi.perime = methode; return appelerEnOctets.call(this, methode, ...reste) }
  return true
})()`
/** L'écran publié, attendu à jour (`SUIVRE_LES_PUBLICATIONS`) `PUBLICATION_MS` au plus, et la méthode qui le laisse
 *  périmé au-delà. */
const LIRE_L_ECRAN = `new Promise((rendre) => {
  const debut = performance.now()
  const lire = () => {
    const perime = globalThis.recetteEcran?.perime ?? null
    if (perime === null || performance.now() - debut > ${PUBLICATION_MS}) rendre(JSON.stringify({ ecran: globalThis.wfrpEcran ?? null, perime }))
    else setTimeout(lire, 10)
  }
  lire()
})`
/** L'écran publié, à jour de la vue que Godot a reçue du pont ; resté périmé, la lecture échoue. */
const ecran = async () => {
  const { ecran, perime } = JSON.parse(await lire(LIRE_L_ECRAN))
  if (perime !== null) throw new Error(`écran périmé : aucune publication ${PUBLICATION_MS} ms après l'appel « ${perime} » de Godot au pont`)
  return ecran
}
/** Le menu d'entrée publié (« Jouer », aucun plateau), le suivi des publications posé (`SUIVRE_LES_PUBLICATIONS`). */
async function attendreLeMenu() {
  await waitFor(session, '!!globalThis.wfrpPont && !!globalThis.wfrpEcran && !wfrpEcran.cases && wfrpEcran.boutons.some((b) => b.texte === "Jouer")', { timeoutMs: 120000, evaluerMs: FIL_DE_LA_PAGE_MS })
  await lire(SUIVRE_LES_PUBLICATIONS)
}
/** Attend que la vue, lue par le pont, vérifie `condition` (une expression sur `v`). */
const attendreLaVue = (condition, timeoutMs = 30000) =>
  waitFor(session, `(() => { try { const v = JSON.parse(wfrpPont.appeler('vue')).vue; return !!(${condition}) } catch { return false } })()`, { timeoutMs, evaluerMs: FIL_DE_LA_PAGE_MS })
/** Le prochain écran publié : l'actuel est marqué vu, le suivant ne l'est pas (chaque publication remplace l'objet). */
const marquer = () => lire('(globalThis.wfrpEcran && (wfrpEcran.vu = true), true)')
const nouvelEcran = (timeoutMs = 30000) => waitFor(session, '!!globalThis.wfrpEcran && !wfrpEcran.vu', { timeoutMs, evaluerMs: FIL_DE_LA_PAGE_MS })
const actif = (v) => v.projection.combat?.actif
/** Les éléments que la vue montre dans la zone `zone` (`vue.zones`, `CONTRAT.md`). */
const zone = (v, z) => v.zones[z]
/** Le bouton de la carte d'un héros du groupe (`groupe.heros`) qui ouvre sa fiche. */
const ficheDuHeros = (carte) => carte.elements.find((e) => e.type === 'bouton' && e.id.startsWith('fiche/'))
/** Le bouton `quoi` amené à l'écran dans une liste qui défile : la molette tournée d'un cran sur le premier bouton
 *  publié que retient `voisin`, un bouton de la même liste, attendu ailleurs à l'écran publié ou hors de lui, jusqu'à
 *  ce que `quoi` paraisse. */
async function amenerDansLaListe(quoi, voisin, liste) {
  for (let n = 0; n < CRANS; n++) {
    const { boutons } = await ecran()
    if (trouver(boutons, quoi)) return
    const ancre = boutons.find(voisin)
    assert.ok(ancre, `${liste} se montre ; boutons : ${boutons.map((x) => x.element ?? x.texte).join(' | ')}`)
    await molette(session, { surface: 'canvas', x: ancre.x, y: ancre.y }, CRAN_DE_MOLETTE)
    const [, defile] = await attendreALEcran((e) => {
      const a = trouver(e.boutons, { element: ancre.element })
      return !a || a.x !== ancre.x || a.y !== ancre.y
    })
    assert.ok(defile, `${JSON.stringify(quoi)} hors de ${liste}, qui ne défile plus sous la molette`)
  }
  throw new Error(`${JSON.stringify(quoi)} hors de ${liste} après ${CRANS} crans`)
}
/** Le bouton `quoi` d'une carte du groupe amené à l'écran : la rangée des cartes défile de côté. */
const amenerAuGroupe = (quoi) => amenerDansLaListe(quoi, (b) => b.element?.startsWith('bouton/fiche/'), 'la rangée du groupe')
/** Le bouton `quoi` d'un service de l'écran du lieu `v` amené à l'écran : la liste des services défile. */
const amenerAuService = (v, quoi) => {
  const services = new Set(zone(v, 'fenetre.corps').filter((e) => e.id?.startsWith('service/')).flatMap((e) => e.elements).filter((b) => b.type === 'bouton').map((b) => `bouton/${b.id}`))
  return amenerDansLaListe(quoi, (b) => services.has(b.element), 'la liste des services du lieu')
}
/** L'élément d'id `id` de la zone `z`. */
const element = (v, z, id) => zone(v, z).find((e) => e.id === id)
/** L'offre d'id `id` de la barre, rangée sous la part de l'économie du tour qu'elle prend. */
const offre = (v, id) => zone(v, 'combat.offres').flatMap((e) => e.valeurs).find((e) => e.id === id)
/** Les gestes que la fenêtre dessine, par leur identité. */
const ouverts = (v) => gestesDessines(v).map((g) => g.id)
/** Le geste en focus : celui que la fenêtre joue à l'Entrée. */
const enFocus = (v) => {
  const gestes = gestesDessines(v).filter((g) => g.focus)
  assert.equal(gestes.length, 1, `un geste en focus dans ${JSON.stringify(ouverts(v))}`)
  return gestes[0]
}
/** Le texte de chaque élément du corps de la fenêtre. */
const corps = (v) => zone(v, 'fenetre.corps').map((e) => e.texte ?? [e.qui, e.libelle, e.resultat, e.verdict].filter(Boolean).join(' ')).join(' / ')
/** L'étape de cascade que la fenêtre tient. */
const etape = (v) => v.projection.fenetre?.etape?.genre

async function cliquerPoint(x, y) {
  await marquer()
  await geste(session, { surface: 'canvas', x, y }, { qui: `clic (${Math.round(x)}, ${Math.round(y)})` }, clic())
  await nouvelEcran()
}
/** Le bouton publié dont le texte vaut `quoi`, ou, pour `{ cle }`, `{ element }` ou `{ onglet }`, dont la clé,
 *  l'élément dessiné ou le titre d'onglet vaut celui-ci ; `undefined` hors de l'écran. */
const trouver = (boutons, quoi) =>
  boutons.find((x) => (typeof quoi === 'string' ? x.texte === quoi : 'element' in quoi ? x.element === quoi.element : 'choix' in quoi ? x.choix?.includes(quoi.choix) : 'onglet' in quoi ? x.onglet && x.texte === quoi.onglet : x.cle === quoi.cle))
/** Le bouton publié qui dessine le bouton `b` de la vue. */
const bouton = (b) => ({ element: `bouton/${b.id}` })
/** L'écran publié une fois que `lu(ecran)` y trouve ce qu'il cherche, et ce qu'il y trouve ; `PUBLICATION_MS` échues,
 *  le dernier écran lu, sans lui. */
async function attendreALEcran(lu) {
  const echeance = Date.now() + PUBLICATION_MS
  for (;;) {
    const e = await ecran()
    const trouve = e && lu(e)
    if (trouve || Date.now() >= echeance) return [e, trouve]
    await sleep(50)
  }
}
async function cliquerBouton(quoi) {
  const [{ boutons }, b] = await attendreALEcran((e) => trouver(e.boutons, quoi))
  if (!b) throw new Error(`bouton ${JSON.stringify(quoi)} absent ; boutons : ${boutons.map((x) => `${x.element ?? x.cle ?? ''} « ${x.texte} »`).join(' | ')}`)
  await cliquerPoint(b.x, b.y)
}
/** La liste déroulante publiée `quoi` une fois que `tient(liste)`, attendue (`attendreALEcran`) ; `etat` dit ce qui
 *  est attendu d'elle. */
async function attendreLaListe(quoi, tient, etat) {
  const [e, liste] = await attendreALEcran((e) => {
    const l = trouver(e.boutons, quoi)
    return l && tient(l) && l
  })
  assert.ok(liste, `la liste ${JSON.stringify(quoi)} ${etat} ; publiée : ${JSON.stringify(trouver(e?.boutons ?? [], quoi))}`)
  return liste
}
/** Les cases que couvre l'emprise d'un pinceau 3×3 glissé sur trois cases d'une rangée. */
const EMPRISE_DU_GLISSE = 15
const FLECHE_HAUT = { key: 'ArrowUp', code: 'ArrowUp', windowsVirtualKeyCode: 38 }
const FLECHE_BAS = { key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 }
/** L'article de rang `rang` de la liste déroulante `quoi` désigné au clavier, la liste attendue ouverte : une flèche
 *  vers lui tant qu'elle en désigne un autre (`designe`), l'article désigné attendu à l'écran après chacune. */
async function designerALaListe(quoi, rang) {
  let liste = await attendreLaListe(quoi, (l) => l.ouverte, 'est ouverte')
  for (let fleches = 0; liste.designe !== rang; fleches++) {
    const { designe } = liste
    assert.ok(fleches < liste.choix.length, `l'article ${rang} de la liste ${JSON.stringify(quoi)} se désigne au clavier ; désigné après ${fleches} flèches : ${designe}`)
    await realKey(session, designe > rang ? FLECHE_HAUT : FLECHE_BAS)
    liste = await attendreLaListe(quoi, (l) => l.ouverte && l.designe !== designe, `désigne un autre article que le ${designe} après la flèche`)
  }
}
/** L'onglet titré du libellé du choix `choix` montré quand `quoi` n'est pas à l'écran : un choix de la barre du combat
 *  (`combat.offres`) est l'un de ses onglets. */
async function ouvrirLOngletDe(choix, quoi) {
  if (!trouver((await ecran()).boutons, quoi)) await cliquerBouton({ onglet: choix.libelle })
}
/** L'offre `b` de la barre du combat pressée, son onglet montré d'abord. */
async function presserLOffre(b) {
  await ouvrirLOngletDe(zone(await vue(), 'combat.offres').find((c) => c.valeurs.some((x) => x.id === b.id)), bouton(b))
  await cliquerBouton(bouton(b))
}
/** Les points des cases de l'écran `e` une fois la caméra posée (`glisse`), où chacun est celui qu'un clic désigne. */
const casesPosees = (e) => !e.glisse && e.cases
/** L'écran publié une fois la caméra posée, ses cases à l'écran. */
async function ecranPose() {
  const [e, cases] = await attendreALEcran(casesPosees)
  assert.ok(cases, e?.glisse ? 'la caméra ne glisse plus avant la lecture des points des cases' : 'le plateau publie ses cases')
  return e
}
/** L'écran publié une fois la caméra posée et le fondu de la vision fini (`fondu`) : l'image est celle que le jeu garde. */
async function ecranFige() {
  const [e, fige] = await attendreALEcran((e) => casesPosees(e) && !e.fondu)
  assert.ok(fige, e?.fondu ? 'la vision ne se fond plus avant la capture' : 'la caméra se pose, le plateau à l’écran, avant la capture')
  return e
}
async function cliquerCase({ x, y, z = 0 }) {
  const [e, point] = await attendreALEcran((e) => casesPosees(e)?.[`${x},${y},${z}`])
  assert.ok(point, e?.glisse ? `la caméra ne glisse plus avant le clic sur la case ${x},${y},${z}` : `la case ${x},${y},${z} est à l'écran ; cases : ${Object.keys(e?.cases ?? {}).join(' ')}`)
  await cliquerPoint(...point)
}
/** La case de la cible `id`, en vue du groupe ou non (`vue.casesDesCibles`). */
function caseDeLaCible(v, id) {
  const [x, y, z] = v.casesDesCibles[id]
  return { x, y, z }
}
async function capturer(nom) {
  await sleep(400)
  const image = await shot(session, nom, o.captures)
  noter(image ? `capture ${image}` : `capture ${nom} sautée : sans rendu`)
}
/** Chaque fenêtre qui tient la main fermée à l'Entrée, jusqu'à ce qu'aucune ne la tienne ; la vue d'alors. */
async function fermerLesFenetres() {
  let v = await vue()
  while (v.projection.fenetre) {
    await marquer()
    await realKey(session, { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
    await nouvelEcran()
    v = await vue()
  }
  return v
}
/** Le jeu rechargé (`lieu.recharger`), son menu publié : son pont repart de rien, son stockage reste. */
async function recharger() {
  await lieu.recharger(session)
  await attendreLeMenu()
}
/** Le jeu redessiné en haute définition (`lieu.enHauteDefinition`), son menu publié. */
async function enHauteDefinition() {
  await lieu.enHauteDefinition(session)
  await attendreLeMenu()
}
async function finirLeTour() {
  await cliquerBouton({ element: 'bouton/fin-de-tour' })
  const v = await vue()
  if (v.projection.combat.finDeTourArmee) await cliquerBouton({ element: 'bouton/fin-de-tour' })
}

/** Le dossier neuf `--modeles` rempli des modèles épinglés du projet (`modelesEpingles`) : le manifeste, la provenance
 *  et les licences de chacun copiés, ses GLB tirés de la Release (`recupererModeles`) ; puis `--element` importé sous le
 *  nom de son dossier de production. L'id de l'élément importé. */
async function preparerLesModeles() {
  const { DOSSIER_DES_MODELES, fichiersDuModele, modelesEpingles, recupererModeles } = await chargerAssets([
    "export { modelesEpingles } from '/hotes/godot/asset/release.ts';",
    "export { fichiersDuModele } from '/hotes/godot/asset/modeles.ts';",
  ])
  const { modeles: epingles, erreurs } = modelesEpingles(DOSSIER_DES_MODELES)
  assert.deepEqual(erreurs, [], 'les modèles du projet sont épinglés')
  mkdirSync(o.modeles, { recursive: true })
  for (const { id, licences } of epingles) {
    const { manifeste, provenance } = fichiersDuModele(id)
    for (const f of [manifeste, provenance, ...licences]) cpSync(join(DOSSIER_DES_MODELES, f), join(o.modeles, f))
  }
  const modeles = await recupererModeles({ dossier: o.modeles, journal: noter })
  const id = basename(resolve(o.element))
  importer(o.element, id)
  noter(`--modeles : ${modeles.length} modèles du projet, puis « ${id} » importé`)
  return id
}

/** Le combat ouvert, chaque corps de la vue posé à l'écran (`wfrpEcran.corps`) sur la base de l'élément `elementId` ;
 *  le combattant dont le corps le monte a monté aussi la tête de sa vue et porte, à la ligne de sa prise `secondaire`, l'emblème
 *  de sa donnée. */
async function prouverLEmbleme(elementId) {
  const base = production(o.element).manifeste.base
  const v = await vue()
  assert.equal(v.corps.refus, null, 'les modèles servis composent les corps')
  const corps = Object.entries(v.corps.combattants).filter(([, c]) => c !== null)
  assert.ok(corps.length > 0 && corps.every(([, c]) => c.base === base), `chaque corps de la vue sur « ${base} » : ${JSON.stringify(corps.map(([id, c]) => [id, c.base]))}`)
  const [id, compose] = corps.find(([, c]) => c.montes.some((m) => m.element === elementId)) ?? []
  assert.ok(id, `un combattant monte « ${elementId} »`)
  const combattant = v.projection.combat.voisins.liste.find((c) => c.id === id)
  const ligne = combattant.portee.portees.find((p) => p.point === 'secondaire')?.point
  const embleme = combattant.portee.embleme?.id
  const tete = compose.montes.find((m) => m.ligne === 'ligne/tete')?.element
  assert.ok(ligne && embleme && tete, `${combattant.nom} tient en main off, sa donnée nomme un emblème et sa tête a un élément : ${JSON.stringify(combattant.portee)}`)
  assert.equal(compose.montes.find((m) => m.ligne === ligne)?.element, elementId, `« ${elementId} » à la ligne « ${ligne} »`)
  const pose = `(() => { const c = globalThis.wfrpEcran?.corps; return !!c && ${JSON.stringify(corps.map(([i]) => i))}.every((i) => c[i]?.base === ${JSON.stringify(base)})
    && c[${JSON.stringify(id)}].elements.includes(${JSON.stringify(elementId)}) && c[${JSON.stringify(id)}].elements.includes(${JSON.stringify(tete)})
    && c[${JSON.stringify(id)}].emblemes[${JSON.stringify(ligne)}] !== undefined })()`
  await waitFor(session, pose, { timeoutMs: 120000 })
  const publie = (await ecran()).corps
  assert.equal(publie[id].emblemes[ligne], embleme, `l’emblème de la donnée de ${combattant.nom} posé à la ligne « ${ligne} »`)
  noter(`corps posés sur « ${base} » : ${corps.map(([i]) => i).join(', ')} ; ${combattant.nom} monte ${publie[id].elements.join(', ')}, emblème « ${publie[id].emblemes[ligne]} » à « ${ligne} »`)
  await capturer('3253-embleme-au-combat')
}

/** Chaque teinte de la vue posée à l'écran (#3456) : pour chaque entrée de `montes` d'un corps qui porte une `palette`,
 *  chaque surface de son élément (manifeste du dossier servi) dont cette palette colore l'emplacement porte sa couleur
 *  (`wfrpEcran.corps[id].couleurs`) ; une vue qui en porte se capture. */
async function prouverLesTeintes() {
  const v = await vue()
  const attendues = Object.entries(v.corps.combattants).flatMap(([id, c]) =>
    (c?.montes ?? []).filter((m) => m.element !== null && m.palette).flatMap((m) =>
      (JSON.parse(readFileSync(join(DOSSIER_SERVI, `${m.element}.manifeste.json`), 'utf8')).surfaces ?? [])
        .filter((s) => m.palette[s.palette] !== undefined)
        .map((s) => ({ id, ligne: m.ligne, nom: s.nom, couleur: m.palette[s.palette] }))))
  if (!attendues.length) return noter('aucune surface teinte dans la vue')
  await waitFor(session, `(() => { const c = globalThis.wfrpEcran?.corps; return !!c && ${JSON.stringify(attendues)}.every((a) => c[a.id]?.couleurs?.[a.ligne]?.[a.nom] === a.couleur) })()`, { timeoutMs: 120000 })
  noter(`teintes posées : ${attendues.map((a) => `${a.id} ${a.ligne} ${a.nom} ${a.couleur}`).join(' ; ')}`)
  await capturer('3456-teinte-au-combat')
}

async function parcoursCombat() {
  const elementId = o.element ? await preparerLesModeles() : null
  await cliquerBouton('Combat')
  noter('menu : bouton « Combat » cliqué')
  await waitFor(session, '!!globalThis.wfrpEcran?.cases && wfrpEcran.boutons.length > 0', { timeoutMs: 120000 })
  if (elementId) await prouverLEmbleme(elementId)
  await prouverLesTeintes()
  let v = await vue()
  assert.ok(v.projection.fenetre, 'la fenêtre du round tient la main')
  assert.equal(v.projection.combat.round, 1)
  await capturer('2928-6c-1-round')
  await marquer()
  await realKey(session, { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
  await nouvelEcran()
  v = await vue()
  const heros = actif(v)
  assert.equal(v.projection.fenetre, null, 'l’Entrée joue le geste au focus et ferme la fenêtre du round')
  assert.deepEqual(zone(v, 'fenetre.titre'), [], 'sans fenêtre, la zone du titre est vide')
  assert.equal(heros?.camp, 'heros', 'un héros est actif')
  assert.equal(v.projection.combat.barre.forme, 'ouverte')
  assert.equal(zone(v, 'combat.actif')[0]?.nom, heros.nom, 'le panneau nomme l’actif')
  noter(`Entrée : fenêtre fermée ; actif ${heros.nom}, barre ouverte`)
  const charge = offre(v, 'charge')
  await presserLOffre(charge)
  v = await vue()
  assert.equal(v.projection.combat.intention, 'charge', 'l’offre arme son intention')
  assert.equal(offre(v, 'charge').presse, true, 'l’offre armée est pressée')
  const proche = v.projection.combat.voisins.liste.filter((c) => v.projection.combat.cibles.liste.includes(c.id)).sort((a, b) => a.distance - b.distance)[0]
  assert.ok(proche, `la charge offre une cible en vue, dont les Blessures se lisent ; cibles : ${JSON.stringify(v.projection.combat.cibles.liste)}`)
  noter(`offre ${charge.libelle} : intention charge, ${v.cases.length} cases peintes ; la plus proche des cibles en vue : ${proche.nom}`)
  await cliquerCase(caseDeLaCible(v, proche.id))
  await attendreLaVue("v.projection.fenetre?.etape?.genre === 'jetDAttaque'")
  v = await vue()
  assert.equal(element(v, 'fenetre.corps', 'jet')?.qui, heros.nom, 'la charge ouvre l’attaque du héros')
  assert.ok(element(v, 'fenetre.corps', 'cible')?.texte.includes(proche.nom), 'sur sa cible')
  assert.equal(element(v, 'fenetre.corps', 'jet').verdict, null, 'le jet est à lancer')
  noter(`clic sur ${proche.nom} : jetons repris par les minuteurs, fenêtre « ${zone(v, 'fenetre.titre')[0].texte} » ouverte ; ${corps(v)}`)
  const localiser = element(v, 'fenetre.reglages', 'jetRegler@attaque#localisation')
  const lieu = localiser.valeurs.find((x) => x.jeu.args.at(-1) !== null)
  await cliquerBouton(bouton(lieu))
  v = await vue()
  assert.equal(element(v, 'fenetre.reglages', localiser.id).valeurs.find((x) => x.presse)?.id, lieu.id, 'la Localisation cliquée est retenue')
  noter(`Localisation « ${lieu.libelle} » ; ${element(v, 'fenetre.corps', 'jet').cible}`)
  await capturer('2928-6c-2-attaque-apercu')
  const jetDAttaque = enFocus(v).id
  noter(`gestes dessinés avant le jet : ${ouverts(v).join(', ')}`)
  await cliquerBouton(bouton(enFocus(v)))
  v = await vue()
  assert.ok(element(v, 'fenetre.corps', 'jet').verdict, 'le jet tombe')
  assert.ok(!ouverts(v).includes(jetDAttaque) && !ouverts(v).includes(localiser.id), 'le jet tombé, ni le jet ni la Localisation ne se redessinent (#2936)')
  assert.ok(ouverts(v).includes(enFocus(v).id), 'le jet tombé, sa clôture se dessine')
  noter(`gestes dessinés après le jet : ${ouverts(v).join(', ')}`)
  const issue = element(v, 'fenetre.corps', 'issue')
  assert.ok(issue, 'le jet tombé dit son issue')
  noter(`jet : ${issue.texte}`)
  await capturer('2928-6c-3-attaque-jet')
  const pbAvant = v.projection.combat.voisins.liste.find((c) => c.id === proche.id).pb[0]
  await cliquerBouton(bouton(enFocus(v)))
  v = await vue()
  assert.notEqual(etape(v), 'jetDAttaque', 'confirmée, la fenêtre d’attaque se ferme')
  const pbApres = v.projection.combat.voisins.liste.find((c) => c.id === proche.id).pb[0]
  noter(`confirmée : fenêtre fermée ; ${proche.nom} ${pbAvant} → ${pbApres} Blessures`)
  await finirLeTour()
  v = await vue()
  const second = actif(v)
  assert.notEqual(second.id, heros.id, 'la fin du tour passe la main')
  assert.equal(second.camp, 'heros')
  const vers = v.cases.find((c) => c.zone === 'marche' && c.cout === 1).case
  noter(`fin du tour de ${heros.nom} ; actif ${second.nom}`)
  await cliquerCase(vers)
  v = await vue()
  assert.deepEqual([v.projection.combat.apercu?.genre, v.projection.combat.apercu?.case], ['deplacement', [vers.x, vers.y, vers.z ?? 0]], 'le premier clic montre l’aperçu')
  const apercu = element(v, 'combat.apercu', 'apercu')
  assert.ok(apercu, 'l’aperçu dit ce qu’il coûte, près de sa case')
  noter(`premier clic sur (${vers.x}, ${vers.y}) : ${apercu.texte}`)
  await capturer('2928-6c-4-deplacement-apercu')
  await cliquerCase(vers)
  v = await vue()
  assert.deepEqual(actif(v).pos, [vers.x, vers.y, vers.z ?? 0], 'le second clic déplace le héros')
  noter(`second clic : ${second.nom} en ${actif(v).pos}`)
  await finirLeTour()
  await attendreLaVue("v.projection.fenetre?.etape?.genre === 'jetDeDefense'", 60000)
  v = await vue()
  const adversaire = actif(v)
  assert.ok(adversaire === null || adversaire.camp === 'ennemi', `les jetons repris, le noyau joue l’adversaire, en vue ou non : ${JSON.stringify(adversaire)}`)
  if (adversaire) assert.ok(element(v, 'fenetre.corps', 'defense/qui')?.texte.includes(adversaire.nom), 'la Défense répond à l’adversaire actif')
  const defenseur = v.projection.fenetre.proprietaire
  assert.equal(defenseur.genre, 'porteur', 'la Défense est à un héros')
  assert.ok(zone(v, 'fenetre.etape')[0]?.texte.includes(defenseur.nom), 'l’étape nomme le héros qui se défend')
  noter(`Défense ouverte par les minuteurs : ${corps(v)} ; à ${defenseur.nom}`)
  await capturer('2928-6c-5-defense')
  const [jetDeDefense, reagir] = [enFocus(v).id, 'jetRegler@defense#reaction']
  assert.ok(ouverts(v).includes(reagir), 'avant le jet, la réaction se dessine')
  noter(`gestes dessinés avant la Défense : ${ouverts(v).join(', ')}`)
  await cliquerBouton(bouton(enFocus(v)))
  v = await vue()
  assert.ok(zone(v, 'fenetre.corps').some((e) => e.type === 'jet' && e.verdict), 'le jet de Défense tombe')
  assert.ok([jetDeDefense, reagir].every((id) => !ouverts(v).includes(id)), 'le jet de Défense tombé, ni le jet ni la réaction ne se redessinent (#2936)')
  noter(`gestes dessinés après la Défense : ${ouverts(v).join(', ')}`)
  await capturer('2928-6c-5b-defense-jet')
  await cliquerBouton(bouton(enFocus(v)))
  await attendreLaVue("v.projection.fenetre?.etape?.genre !== 'jetDeDefense' && v.projection.combat.round === 2", 60000)
  v = await vue()
  noter(`Défense confirmée : fenêtre « ${zone(v, 'fenetre.titre')[0]?.texte ?? 'aucune'} », round ${v.projection.combat.round}`)
  await capturer('2928-6c-6-apres-defense')
}

const IMPORTER = fileURLToPath(new URL('./importer.mjs', import.meta.url))
/** Le point du panneau de l'atelier où tourne la molette : sur les lignes des points. */
const PANNEAU = { x: 60, y: 400 }
const CRANS = 150
/** Les textes du panneau de l'atelier (`projet/scripts/atelier.gd`, `projet/scenes/Atelier.tscn`) : le choix vide d'une
 *  liste d'emplacement, d'axe ou d'emblème, celui d'une liste de couleur, et deux boutons. */
const AUCUN = 'Aucun'
const PAR_DEFAUT = 'Par défaut'
const RECHARGER = 'Recharger les modèles'
const COPIER = 'Copier la composition'
const production = (dossier) => JSON.parse(readFileSync(join(dossier, 'manifest.json'), 'utf8'))
/** Le combat joué en joueur pressé jusqu'à ce que `fini(v)` tienne : chaque fenêtre à l'Entrée, ou par la première
 *  valeur ouverte de ses choix quand aucun geste n'a le focus, chaque tour une charge ou une attaque cliquée sur la
 *  case de la première cible (`caseDeLaCible`), sinon la fin du tour ; `quoi` nomme ce qu'on attend. */
async function jouerEnJoueurPresse(fini, quoi) {
  await cliquerBouton('Combat')
  await waitFor(session, '!!globalThis.wfrpEcran?.cases && wfrpEcran.boutons.length > 0', { timeoutMs: 120000 })
  let v = await vue()
  for (let pas = 0; !fini(v); pas++) {
    const c = v.projection.combat
    assert.ok(pas < 600 && c, `${quoi} : rien après ${pas} gestes, combat ${c?.fin ?? 'en cours'}`)
    const offres = zone(v, 'combat.offres').flatMap((e) => e.valeurs).filter((b) => !b.refus)
    const valeur = zone(v, 'fenetre.gestes').some((g) => g.focus) ? null : zone(v, 'fenetre.gestes').flatMap((g) => (g.type === 'choix' ? g.valeurs : [])).find((b) => !b.refus)
    if (v.projection.fenetre && valeur) await cliquerBouton(bouton(valeur))
    else if (v.projection.fenetre) {
      await marquer()
      await realKey(session, { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
      await nouvelEcran()
    } else if (c.intention && c.cibles.liste.length) await cliquerCase(caseDeLaCible(v, c.cibles.liste[0]))
    else if (c.barre.forme === 'ouverte') await presserLOffre(offres.find((o) => !c.intention && (o.id === 'charge' || o.id === 'attaque')) ?? offres.find((o) => o.id === 'fin-de-tour'))
    else {
      await marquer()
      await nouvelEcran()
    }
    v = await vue()
  }
  return v
}

async function parcoursCritique() {
  const v = await jouerEnJoueurPresse((x) => etape(x) === 'critique', 'aucun Coup Critique')
  assert.ok(element(v, 'fenetre.corps', 'critique/localisation'), 'la fenêtre dit la localisation du Coup Critique')
  noter(`Coup Critique : ${zone(v, 'fenetre.titre')[0].texte} ; ${zone(v, 'fenetre.corps').map((e) => e.valeur ?? e.texte).join(' / ')}`)
  await capturer('3328-f1-coup-critique')
}

async function parcoursFin() {
  let v = await jouerEnJoueurPresse((x) => !!x.projection.combat?.fin && !!x.projection.fenetre && !x.projection.fenetre.etape, 'aucune fin du combat')
  const [titre] = zone(v, 'fenetre.titre')
  const sortie = zone(v, 'fenetre.gestes').find((g) => g.focus)
  assert.ok(titre && sortie, `la fin du combat tient la main, sa sortie en focus : ${JSON.stringify(v.projection.fenetre)}`)
  noter(`Fin du combat : ${titre.texte} ; « ${sortie.libelle} » en focus`)
  await capturer('3328-g1-fin-du-combat')
  await marquer()
  await realKey(session, { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
  await nouvelEcran()
  v = await vue()
  assert.ok(!v.projection.combat, 'la sortie rend la main à la scène')
  noter(`« ${sortie.libelle} » à l’Entrée : la scène reprend${v.projection.fenetre ? `, ${zone(v, 'fenetre.titre')[0]?.texte} tient la main` : ''}`)
  await capturer('3328-g1-apres-la-fin')
}

async function parcoursExploration() {
  await cliquerBouton('Combat')
  await waitFor(session, '!!globalThis.wfrpEcran?.cases && wfrpEcran.boutons.length > 0', { timeoutMs: 120000 })
  let v = await vue()
  assert.equal(etape(v), 'entreeEnScene', 'l’entrée de la scène tient la main')
  assert.deepEqual(zone(v, 'exploration.gestes'), [], 'une fenêtre tient la main : aucun geste d’exploration')
  await capturer('3328-e1-1-entree')
  v = await fermerLesFenetres()
  const x = v.projection.exploration
  assert.ok(x, 'hors combat, la vue est celle de l’exploration')
  assert.deepEqual(x.heros.map((h) => h.pos), x.heros.map(() => [...x.groupe, x.etage ?? 0]), 'chaque héros se tient à la case du groupe')
  noter(`Entrée : l’entrée de la scène poursuivie ; groupe en ${x.groupe}, gestes ${zone(v, 'exploration.gestes').map((b) => b.libelle).join(' | ')}`)
  await capturer('3328-e1-2-exploration')
  const porte = zone(v, 'exploration.gestes').find((b) => b.jeu.suite?.some((a) => a.type === 'actionnerLaPorte'))
  assert.ok(porte, 'la porte fermée s’ouvre par un bouton')
  await cliquerBouton(bouton(porte))
  noter(`bouton « ${porte.libelle} » cliqué`)
  const reduit = { x: 4, y: 1 }
  await cliquerCase(reduit)
  await attendreLaVue(`v.projection.exploration?.groupe.join() === '${reduit.x},${reduit.y}'`)
  noter(`clic sur la case ${reduit.x},${reduit.y} : le groupe y marche`)
  await capturer('3328-e1-3-reduit')
}

async function parcoursRelief() {
  await cliquerBouton('Combat')
  await waitFor(session, '!!globalThis.wfrpEcran?.cases && wfrpEcran.boutons.length > 0', { timeoutMs: 120000 })
  await capturer('3476-r1-round')
  let v = await fermerLesFenetres()
  const heros = actif(v)
  assert.equal(heros?.camp, 'heros', 'un héros est actif')
  const plateau = v.cases.filter((c) => c.zone === 'marche' && c.cout === 1 && c.case.y === 2)
  assert.ok(plateau.length > 0, `une case du bord du plateau à une case de ${heros.nom} en ${heros.pos}`)
  const vers = plateau[0].case
  await cliquerCase(vers)
  v = await vue()
  assert.deepEqual([v.projection.combat.apercu?.genre, v.projection.combat.apercu?.case], ['deplacement', [vers.x, vers.y, vers.z ?? 0]], 'la case cliquée est celle du plateau sous le pointeur')
  noter(`clic sur (${vers.x}, ${vers.y}), au bord du plateau de 4 m : son aperçu`)
  await capturer('3476-r2-plateau')
}

/** Une case du couloir de l'étage du relais (`fenetre-ecuries`), que le groupe atteint depuis sa case de départ. */
const COULOIR_DE_L_ETAGE = { x: 5, y: 4, z: 1 }
async function parcoursEtage() {
  await cliquerBouton('Combat')
  await waitFor(session, '!!globalThis.wfrpEcran?.cases && wfrpEcran.boutons.length > 0', { timeoutMs: 120000 })
  const v = await fermerLesFenetres()
  assert.equal(v.projection.exploration?.etage, 1, 'le groupe se tient à l’étage du relais')
  await capturer('3476-c4-1-etage')
  const couloir = COULOIR_DE_L_ETAGE
  await cliquerCase(couloir)
  await attendreLaVue(`v.projection.exploration?.groupe.join() === '${couloir.x},${couloir.y}' && v.projection.exploration.etage === ${couloir.z}`)
  noter(`clic sur la case ${couloir.x},${couloir.y} du couloir de l’étage : le groupe y marche, à l’étage`)
  await capturer('3476-c4-2-couloir')
}

async function parcoursRegards() {
  await cliquerBouton('Combat')
  await waitFor(session, '!!globalThis.wfrpEcran?.cases && wfrpEcran.boutons.length > 0', { timeoutMs: 120000 })
  const v = await fermerLesFenetres()
  assert.equal(v.plateau.regard, 'tactique', 'la partie commence en tactique')
  await capturer('3476-v1-tactique')
  const x0 = v.projection.exploration
  const cle = `${x0.groupe[0]},${x0.groupe[1]},${x0.etage ?? 0}`
  const [px] = (await ecranPose()).cases[cle]
  const D = { key: 'd', code: 'KeyD', windowsVirtualKeyCode: 68 }
  await realKeyDown(session, D)
  await sleep(800)
  await realKeyUp(session, D)
  await waitFor(session, `wfrpEcran.cases['${cle}'][0] < ${px - 20}`)
  noter(`D tenue en tactique : la caméra glisse, la case du groupe de ${Math.round(px)} à ${Math.round((await ecran()).cases[cle][0])} px`)
  await realKey(session, { key: 'Home', code: 'Home', windowsVirtualKeyCode: 36 })
  await waitFor(session, `Math.abs(wfrpEcran.cases['${cle}'][0] - ${px}) < 2`)
  noter('Origine : la caméra revient au groupe')
  const V = { key: 'v', code: 'KeyV', windowsVirtualKeyCode: 86 }
  const regarder = async (regard) => {
    await realKey(session, V)
    await attendreLaVue(`v.plateau.regard === '${regard}'`)
    await sleep(600)
    noter(`V : le regard ${regard}`)
    await capturer(`3476-v2-${regard}`)
  }
  await regarder('plateau')
  const couloir = COULOIR_DE_L_ETAGE
  await cliquerCase(couloir)
  await attendreLaVue(`v.projection.exploration?.groupe.join() === '${couloir.x},${couloir.y}' && v.projection.exploration.etage === ${couloir.z}`)
  noter(`au plateau, sans autre geste après le regard, un clic au point publié de la case ${couloir.x},${couloir.y} du couloir y mène le groupe`)
  await regarder('immersion')
  const depart = (await vue()).projection.exploration
  const marches = [['z', 'KeyW', 87], ['q', 'KeyA', 65], ['s', 'KeyS', 83], ['d', 'KeyD', 68]]
  let arrivee = null
  for (const [key, code, windowsVirtualKeyCode] of marches) {
    await realKeyDown(session, { key, code, windowsVirtualKeyCode })
    await sleep(2000)
    await realKeyUp(session, { key, code, windowsVirtualKeyCode })
    const x = (await vue()).projection.exploration
    if (x.groupe.join() !== depart.groupe.join() || x.etage !== depart.etage) {
      arrivee = x
      noter(`${key.toUpperCase()} tenue : le groupe marche de ${depart.groupe} à ${x.groupe}, à l’étage ${x.etage}`)
      break
    }
  }
  assert.ok(arrivee, 'une touche de marche tenue mène le groupe à une case voisine')
  await sleep(300)
  await capturer('3476-v3-immersion-marche')
  await realKey(session, V)
  await attendreLaVue("v.plateau.regard === 'tactique'")
  noter('V : la tactique, à la suite du groupe')
  await sleep(600)
  await capturer('3476-v4-tactique-suivie')
}

/** La case de `grimpant` dont le pas du chasseur sort l'ennemi de la vue (`projet/recettes/vision-du-combat.gd`,
 *  `CASE_DU_PAS`). */
const CASE_DU_PAS = { x: 5, y: 0, z: 0 }
/** L'octet du masque de `vision` de chaque état d'une case (`VisionDuMonde`, `src/noyau/visionDuGroupe.ts`). */
const OCTET_DE = { visible: 255, explored: 128, unknown: 0 }
/** Le demi-côté, en pixels, du carré lu autour du point d'une case. */
const DEMI_COTE = 2
/** L'écart toléré entre la part de lumière lue et la teinte attendue : celui de `projet/recettes/voile-de-la-vision.gd`
 *  (`TOLERANCE`). */
const TOLERANCE_DU_VOILE = 0.04
/** Ce dont la part lue d'un sol au soleil s'abaisse sous sa teinte : le pilote de compatibilité somme la passe du soleil
 *  qui porte une ombre à l'autre après leur encodage sRGB, et la part décodée baisse avec la luminance du pixel. Mesuré
 *  sur l'herbe de `grimpant` (médiane 0,326 pour 0,42, #3950) ; `projet/scripts/monde.gd`, `@contrat Monde`. */
const CREUX_DU_PILOTE = 0.1
/** La courbe filmique de Godot (`tonemap_filmic`, son biais d'exposition de 2 dans `A` et `B`), sans son blanc. */
const FILMIQUE = { A: 0.88, B: 0.6, C: 0.1, D: 0.2, E: 0.01, F: 0.3 }
const filmique = (x, { A, B, C, D, E, F } = FILMIQUE) => (x * (A * x + C * B) + D * E) / (x * (A * x + B) + D * F) - E / F
/** La lumière linéaire d'un canal sRGB 8 bits de l'écran du jeu, avant la courbe filmique de son environnement
 *  (`projet/scenes/Lumiere.tscn`, `tonemap_mode = 2`, blanc 1) : la teinte de la vision est une part de cette lumière,
 *  que la courbe abaisse encore dans les tons sombres. */
function lineaire(c, { A, B, C, D, E, F } = FILMIQUE) {
  const affiche = c / 255 <= 0.04045 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4
  const y = affiche * filmique(1) + E / F
  return y >= 1 ? Infinity : (-B * (y - C) - Math.sqrt((B * (y - C)) ** 2 - 4 * A * (y - 1) * D * (y * F - E))) / (2 * A * (y - 1))
}
const mediane = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]

/** L'état de chaque case de la couche 0 dans la vision que le pont sert à Godot (`vision`), lue pour l'observer, par
 *  clé `x,y,0` ; et ses teintes. */
async function etatsDesCases() {
  const { masque, largeur, rangees, teintes } = JSON.parse(await lire(`wfrpPont.appeler('vision')`))
  const couches = new Set(Object.keys((await ecran()).cases).map((k) => k.split(',')[2]))
  assert.deepEqual([...couches], ['0'], 'la vision se lit sur une scène d’une couche')
  const octets = Buffer.from(masque, 'base64')
  const etat = Object.fromEntries(Object.entries(OCTET_DE).map(([nom, octet]) => [octet, nom]))
  const etats = {}
  for (let y = 0; y < rangees; y++) for (let x = 0; x < largeur; x++) etats[`${x},${y},0`] = etat[octets[y * largeur + x]]
  return { etats, teintes }
}

/** La luminance linéaire d'une image décodée (`decodePng`) autour du point `point` : la moyenne du carré de
 *  `DEMI_COTE`. */
function luminanceDuCarre({ w, data }, point) {
  const [px, py] = point.map(Math.round)
  let somme = 0
  for (let dy = -DEMI_COTE; dy <= DEMI_COTE; dy++) for (let dx = -DEMI_COTE; dx <= DEMI_COTE; dx++) {
    const i = ((py + dy) * w + px + dx) * 4
    somme += 0.2126 * lineaire(data[i]) + 0.7152 * lineaire(data[i + 1]) + 0.0722 * lineaire(data[i + 2])
  }
  return somme / (2 * DEMI_COTE + 1) ** 2
}

/** Le point publié de chaque case de l'écran `e` qu'aucun combattant n'occupe et que le champ ne peint pas
 *  (`vue.cases`), par clé. */
function pointsDesCasesLibres(e, v) {
  const peintes = new Set(v.cases.map(({ case: c }) => `${c.x},${c.y},${c.z ?? 0}`))
  return Object.fromEntries(Object.entries(e.cases).filter(([cle]) => !(cle in v.occupants) && !peintes.has(cle)))
}

/** La luminance lue à l'écran, sur une capture nommée `nom`, à chaque point du cadre du monde que `points` tire de
 *  l'écran publié et de la vue (par défaut, celui de chaque case libre, `pointsDesCasesLibres`) : `luminanceDuCarre`.
 *  Le point publié est le même avant et après la capture. */
async function luminancesALEcran(nom, points = pointsDesCasesLibres) {
  const v = await vue()
  for (;;) {
    const avant = await ecranFige()
    const image = decodePng(readFileSync(await shot(session, nom, o.captures)))
    const apres = await ecranFige()
    if (JSON.stringify(apres.cases) !== JSON.stringify(avant.cases)) continue
    const lum = {}
    for (const [cle, point] of Object.entries(points(avant, v))) if (dansLeCadre(avant, point)) lum[cle] = luminanceDuCarre(image, point)
    return lum
  }
}

/** Le cadrage (`wfrpCadrer`) de chaque regard du combat de `grimpant` aux captures du parcours `vision` : la même
 *  caméra avant et après le pas, donc le même pixel pour le même point d'une case, que la caméra qui suit l'actif
 *  déplacerait ; au pied de la falaise, regardant au nord, d'où le plateau ne cache aucune case du sol, et les cases
 *  du sol que le pas change à l'est des panneaux de l'interface, que l'écran publié ne borne pas. */
const CADRAGES_DE_LA_VISION = {
  tactique: { regard: 'tactique', case: { x: 5, y: 3 }, lacet: 0, zoom: 22 },
  plateau: { regard: 'plateau', case: { x: 5, y: 3 }, lacet: 0, zoom: 22 },
}
/** Le cadrage de la tactique au clic du pas : au nord du chasseur, dont le corps cache `CASE_DU_PAS` vu du sud ; au
 *  zoom des `CADRAGES_DE_LA_VISION`. */
const CADRAGE_DU_PAS = { regard: 'tactique', case: { x: 5, y: 2 }, lacet: 180, zoom: 22 }

/** La luminance de chaque case libre sous chaque regard que la touche V offre, de la tactique à son retour (au combat,
 *  `regardDuJeu` rend la tactique pour l'immersion), la caméra posée au cadrage du regard (`CADRAGES_DE_LA_VISION`),
 *  et les points publiés des cases sous ce cadrage (`luminancesCadrees`) ; chaque capture nommée
 *  `vision-<moment>-<regard>`. Le pointeur posé au coin du cadre du monde, hors du plateau sous ces cadrages : la case
 *  survolée se peint sans que `vue.cases` la nomme. */
async function luminancesSousLesRegards(moment) {
  const [x, y, l, h] = (await ecran()).cadre
  await geste(session, { surface: 'canvas', x: x + l - 2, y: y + h - 2 }, { qui: 'le pointeur hors du plateau' }, (p, emettre) => emettre('souris', { type: 'mouseMoved', x: p.x, y: p.y }))
  const lues = {}
  for (let v = await vue(); !(v.plateau.regard in lues); v = await vue()) {
    const { regard } = v.plateau
    lues[regard] = await luminancesCadrees(`vision-${moment}-${regard}`, CADRAGES_DE_LA_VISION[regard], pointsDesCasesLibres)
    noter(`${moment}, ${regard} : ${Object.keys(lues[regard].lues).length} cases lues`)
    await realKey(session, { key: 'v', code: 'KeyV', windowsVirtualKeyCode: 86 }, { delaiEntreeMs: FIL_DE_LA_PAGE_MS })
    await attendreLaVue(`v.plateau.regard !== '${regard}'`, 300000)
  }
  return lues
}

/** `grimpant` : le voile de la vision rendu par l'export (WebGL2), un ennemi sorti de la vue par un pas cliqué. */
async function parcoursVision() {
  await cliquerBouton('Combat')
  await waitFor(session, '!!globalThis.wfrpEcran?.cases && wfrpEcran.boutons.length > 0', { timeoutMs: 120000 })
  let v = await fermerLesFenetres()
  const chasseur = actif(v)
  assert.equal(chasseur?.camp, 'heros', 'un héros est actif')
  const [ennemi] = v.projection.combat.voisins.liste.filter((c) => c.id !== chasseur.id).map((c) => c.id)
  assert.ok(ennemi, `un ennemi en vue : ${JSON.stringify(v.projection.combat.voisins.liste.map((c) => c.id))}`)
  await waitFor(session, `!!globalThis.wfrpEcran?.corps?.[${JSON.stringify(ennemi)}]`, { timeoutMs: 120000 })
  assert.ok(element(v, 'combat.ordre', `ordre/${ennemi}`), `${ennemi} en vue a son rang dans l’ordre du tour`)
  noter(`${ennemi} en vue : corps posé, rang dans l’ordre du tour`)
  const avant = await etatsDesCases()
  const luesAvant = await luminancesSousLesRegards('avant')
  const cle = v.vision
  await cadrer(CADRAGE_DU_PAS, 'cadrage du pas')
  await cliquerCase(CASE_DU_PAS)
  await attendreLaVue(`v.projection.combat.apercu?.case?.join() === '${CASE_DU_PAS.x},${CASE_DU_PAS.y},${CASE_DU_PAS.z}'`)
  await cliquerCase(CASE_DU_PAS)
  await attendreLaVue(`v.vision !== ${JSON.stringify(cle)}`)
  v = await vue()
  noter(`pas cliqué vers (${CASE_DU_PAS.x}, ${CASE_DU_PAS.y}) : vision ${cle} → ${v.vision}`)
  assert.ok(!v.projection.combat.voisins.liste.some((c) => c.id === ennemi), `${ennemi} sort de la vue`)
  assert.ok(Object.values(v.occupants).includes(ennemi), `${ennemi} garde sa case aux occupants`)
  assert.equal(element(v, 'combat.ordre', `ordre/${ennemi}`), undefined, `${ennemi} hors de vue n’est pas dans l’ordre du tour`)
  await waitFor(session, `!!globalThis.wfrpEcran?.corps && !(${JSON.stringify(ennemi)} in wfrpEcran.corps)`, { timeoutMs: 30000 })
  noter(`${ennemi} hors de vue : aucun corps posé, aucun rang dans l’ordre du tour, sa case ${Object.keys(v.occupants).find((k) => v.occupants[k] === ennemi)} aux occupants ; cibles ${JSON.stringify(v.projection.combat.cibles.liste)}`)
  const apres = await etatsDesCases()
  const luesApres = await luminancesSousLesRegards('apres')
  const { teintes } = apres
  assert.deepEqual(Object.keys(luesApres), Object.keys(luesAvant), 'les mêmes regards avant et après le pas')
  for (const regard of Object.keys(luesAvant)) {
    assert.deepEqual(luesApres[regard].cases, luesAvant[regard].cases, `${regard} : le même cadrage publie les mêmes points avant et après le pas`)
    const [a, b] = [luesAvant[regard].lues, luesApres[regard].lues]
    const memes = Object.keys(a).filter((k) => k in b)
    const quittees = memes.filter((k) => avant.etats[k] === 'visible' && apres.etats[k] === 'explored').map((k) => b[k] / a[k])
    const vues = memes.filter((k) => avant.etats[k] === 'explored' && apres.etats[k] === 'visible').map((k) => a[k] / b[k])
    const etats = tableTotale(Object.keys(OCTET_DE), (e) => Object.keys(b).filter((k) => apres.etats[k] === e).map((k) => b[k]))
    const brut = Object.entries(etats).map(([e, l]) => `${e} ${l.length} cases, médiane ${l.length ? mediane(l).toFixed(4) : '—'}`).join(' ; ')
    noter(`${regard} : quittées ${quittees.map((r) => r.toFixed(3)).join(' ')} ; vues ${vues.map((r) => r.toFixed(3)).join(' ')} ; après le pas, ${brut}`)
    const attendue = teintes.explored / teintes.visible
    for (const [quoi, parts] of [['une case quittée s’assombrit', quittees], ['une case entrée en vue s’éclaire', vues]]) {
      assert.ok(parts.length > 0, `${regard} : ${quoi}, aucune à l’écran`)
      const ecart = mediane(parts) - attendue
      assert.ok(ecart <= TOLERANCE_DU_VOILE && ecart >= -CREUX_DU_PILOTE - TOLERANCE_DU_VOILE, `${regard} : ${quoi} dans le rapport ${attendue} des teintes, au plus ${TOLERANCE_DU_VOILE} au-dessus et ${CREUX_DU_PILOTE + TOLERANCE_DU_VOILE} au-dessous, lu ${mediane(parts).toFixed(3)}`)
    }
  }
}

/** Les cases de `zones-pieces` où le groupe se tient à chaque capture du parcours `murs` : dans la Cave, entrée par la
 *  porte ouest, puis devant la porte de la Chambre ; le toit de la masure levé aux deux. */
const CASES_DES_MURS = [{ x: 2, y: 2, z: 0 }, { x: 4, y: 2, z: 0 }]
/** Le cadrage de la tactique (`wfrpCadrer`) des deux captures du parcours `murs` : la même caméra, donc le même pixel
 *  pour le même point d'un mur, que la caméra qui suit le groupe déplacerait ; au nord-est de la masure, vers les faces
 *  intérieures de ses murs, que le soleil ne sature pas comme les faces sud et est du cadrage par défaut. */
const CADRAGE_DES_MURS = { regard: 'tactique', case: { x: 4, y: 4 }, lacet: 225, zoom: 14 }
/** La hauteur, en pas de case à l'écran, du point lu au-dessus du pied d'un mur : sur sa face, sous son faîte. */
const HAUSSE_DU_MUR = 0.3
/** Les pièces d'arête qui dressent un plein à lire. */
const PIECES_PLEINES = new Set(['mur', 'porte-fermee', 'fenetre', 'fenetre-close'])

/** La clé de la voisine d'une arête `a` à une case `c`, à l'opposé du bord : `c - d`, `d` allant du centre de `c` au
 *  milieu de l'arête, doublé, soit `3c - 2 milieu`. */
const voisineOpposee = (a) => {
  const [c] = a.cases
  return `${3 * c.x - Math.round(2 * a.milieu.x)},${3 * c.y - Math.round(2 * a.milieu.y)},${c.z}`
}

/** Le point à lire sur chaque arête pleine de `aretes`, par clé : son pied à l'écran, le milieu des points publiés de
 *  ses deux cases, ou, pour une arête à une case `c` (le bord de la carte), `c` décalée d'une demi-case vers le bord,
 *  à l'opposé de sa voisine opposée (`voisineOpposee`) ; monté de `HAUSSE_DU_MUR` pas
 *  de case le long de la verticale de l'écran. Hors des arêtes dégagées (`vue.plateau.aretesDegagees`) et de celles
 *  dont une case porte un corps. */
const pointsDesMurs = (aretes) => (e, v) => {
  const degagees = new Set(v.plateau.aretesDegagees.map((a) => a.cle))
  const x = v.projection.exploration
  const corps = new Set([...Object.keys(v.occupants), `${x.groupe.join()},${x.etage ?? 0}`])
  const points = {}
  for (const a of aretes) {
    const cles = a.cases.map((c) => `${c.x},${c.y},${c.z}`)
    if (!PIECES_PLEINES.has(a.piece) || degagees.has(a.cle) || cles.some((k) => corps.has(k) || !e.cases[k])) continue
    const [c] = a.cases
    const ici = e.cases[cles[0]]
    const voisine = e.cases[cles.length === 2 ? cles[1] : voisineOpposee(a)]
    const proche = e.cases[`${c.x + 1},${c.y},${c.z}`] ?? e.cases[`${c.x - 1},${c.y},${c.z}`]
    if (!voisine || !proche) continue
    const pied = cles.length === 2 ? [0, 1].map((i) => (ici[i] + voisine[i]) / 2) : [0, 1].map((i) => ici[i] + (ici[i] - voisine[i]) / 2)
    points[a.cle] = [pied[0], pied[1] - HAUSSE_DU_MUR * Math.hypot(ici[0] - proche[0], ici[1] - proche[1])]
  }
  return points
}

/** L'état de chaque arête de `aretes` dans `etats` (`etatsDesCases`) : le plus grand de ceux de ses cases, par clé. */
const etatsDesAretes = (aretes, etats) => Object.fromEntries(aretes.map((a) => {
  const octet = Math.max(...a.cases.map((c) => OCTET_DE[etats[`${c.x},${c.y},${c.z}`]]))
  return [a.cle, Object.keys(OCTET_DE).find((nom) => OCTET_DE[nom] === octet)]
}))

/** La clé de la case de l'arête `a` du côté de l'œil sous l'écran `cases` : la plus basse à l'écran de ses deux cases ;
 *  pour une arête à une case, cette case si sa voisine opposée (`voisineOpposee`) n'est pas plus basse qu'elle, sinon
 *  `null` (l'œil au-delà du bord de la carte). */
function caseDevant(a, cases) {
  const cles = a.cases.map((c) => `${c.x},${c.y},${c.z}`)
  if (cles.length === 2) return cases[cles[0]][1] >= cases[cles[1]][1] ? cles[0] : cles[1]
  return cases[voisineOpposee(a)]?.[1] >= cases[cles[0]][1] ? cles[0] : null
}

/** Le groupe mené à la case `c` par un clic sur elle. */
async function menerLeGroupe(c) {
  await cliquerCase(c)
  await attendreLaVue(`v.projection.exploration?.groupe.join() === '${c.x},${c.y}'`)
}

/** La caméra posée au cadrage `cadrage` par `wfrpCadrer`, nommé `nom` à son refus : la caméra posée. */
async function cadrer(cadrage, nom) {
  const reponse = JSON.parse(await lieu.rappeler(session, 'wfrpCadrer', JSON.stringify(cadrage)))
  assert.equal(reponse.ok, true, `${nom} : ${JSON.stringify(reponse.erreur)}`)
  return reponse.camera
}

/** La caméra posée au cadrage `cadrage` (`cadrer`), puis la luminance lue sur la capture `nom` à chaque point que
 *  `points` tire de l'écran (`luminancesALEcran`) quand elle ne change plus d'une capture à la suivante, une
 *  demi-seconde après (la marche du groupe et le fondu de la vision finis), et les points publiés des cases sous ce
 *  cadrage. */
async function luminancesCadrees(nom, cadrage, points) {
  await cadrer(cadrage, JSON.stringify(cadrage))
  for (let avant = null; ; await sleep(500)) {
    const lues = await luminancesALEcran(nom, points)
    if (JSON.stringify(lues) === JSON.stringify(avant)) return { lues, cases: (await ecran()).cases }
    avant = lues
  }
}

/** `zones-pieces` : le voile des murs rendu par l'export (WebGL2), le groupe passé d'une pièce à l'autre. */
async function parcoursMurs() {
  await cliquerBouton('Combat')
  await waitFor(session, '!!globalThis.wfrpEcran?.cases && wfrpEcran.boutons.length > 0', { timeoutMs: 120000 })
  let v = await fermerLesFenetres()
  assert.ok(v.projection.exploration, 'hors combat, la vue est celle de l’exploration')
  const { aretes } = JSON.parse(await lire(`wfrpPont.appeler('aretes')`))
  const [dans, puis] = CASES_DES_MURS
  await menerLeGroupe(dans)
  v = await vue()
  const toits = v.plateau.toitsLeves
  assert.ok(toits.length > 0, `le groupe en ${dans.x},${dans.y} est sous un toit levé`)
  const avant = await etatsDesCases()
  const a = await luminancesCadrees('murs-avant-tactique', CADRAGE_DES_MURS, pointsDesMurs(aretes))
  await menerLeGroupe(puis)
  v = await vue()
  noter(`clic sur ${puis.x},${puis.y} : le groupe passe de ${dans.x},${dans.y} à ${v.projection.exploration.groupe}, vision ${v.vision}`)
  assert.deepEqual(v.plateau.toitsLeves, toits, 'aucun toit ne se lève ni ne se pose entre les deux captures')
  const apres = await etatsDesCases()
  const b = await luminancesCadrees('murs-apres-tactique', CADRAGE_DES_MURS, pointsDesMurs(aretes))
  assert.deepEqual(b.cases, a.cases, 'le même cadrage publie les mêmes points avant et après le pas')
  const [ea, eb] = [etatsDesAretes(aretes, avant.etats), etatsDesAretes(aretes, apres.etats)]
  const parCle = Object.fromEntries(aretes.map((ar) => [ar.cle, ar]))
  const deFace = (cle) => {
    const devant = caseDevant(parCle[cle], a.cases)
    return avant.etats[devant] === ea[cle] && apres.etats[devant] === eb[cle]
  }
  const lus = Object.keys(a.lues).filter((cle) => cle in b.lues && deFace(cle))
  const parPaire = {}
  for (const cle of lus.filter((k) => ea[k] !== eb[k])) {
    const sAllume = OCTET_DE[ea[cle]] < OCTET_DE[eb[cle]]
    const [sombre, clair] = sAllume ? [ea[cle], eb[cle]] : [eb[cle], ea[cle]]
    const paire = `${sombre}/${clair}`
    parPaire[paire] = { ...parPaire[paire], [cle]: sAllume ? a.lues[cle] / b.lues[cle] : b.lues[cle] / a.lues[cle] }
  }
  const restes = lus.filter((k) => ea[k] === 'visible' && eb[k] === 'visible').map((k) => b.lues[k] / a.lues[k])
  noter(`${lus.length} murs lus aux deux captures ; restés en vue ${restes.map((r) => r.toFixed(3)).join(' ')}`)
  for (const [paire, parts] of Object.entries(parPaire)) noter(`${paire} : ${Object.entries(parts).map(([cle, r]) => `${cle} ${r.toFixed(3)}`).join(', ')} ; médiane ${mediane(Object.values(parts)).toFixed(3)}`)
  assert.ok(Object.keys(parPaire).length > 0, 'un mur à l’écran change d’état')
  assert.ok(restes.length > 0, 'un mur à l’écran reste en vue')
  assert.ok(Math.abs(mediane(restes) - 1) <= TOLERANCE_DU_VOILE, `un mur resté en vue ne change pas, lu ${mediane(restes).toFixed(3)}`)
  for (const [paire, parts] of Object.entries(parPaire).map(([p, r]) => [p, Object.values(r)])) {
    const [sombre, clair] = paire.split('/')
    const attendue = apres.teintes[sombre] / apres.teintes[clair]
    assert.ok(Math.abs(mediane(parts) - attendue) <= TOLERANCE_DU_VOILE, `un mur ${sombre} rendu à ${attendue.toFixed(3)} du mur ${clair} (rapport des teintes), lu ${mediane(parts).toFixed(3)}`)
  }
}

/** Les crans de molette qui rapprochent la caméra tactique du véhicule actif. */
const CRANS_DU_GROS_PLAN = 6
/** Les crans de pivot (Q) d'un tour complet de la caméra tactique autour du véhicule. */
const CRANS_DE_PIVOT = 4
async function parcoursVehicule() {
  await enHauteDefinition()
  await cliquerBouton('Combat')
  await waitFor(session, '!!globalThis.wfrpEcran?.cases && wfrpEcran.boutons.length > 0', { timeoutMs: 120000 })
  const v = await vue()
  const attendus = Object.entries(v.corps.vehicules).map(([id, x]) => ({
    id, vehicule: x.element, embleme: x.embleme?.id ?? null, postes: x.postes.map((p) => p.element), ameliorations: x.ameliorations.map((a) => a.element),
  }))
  assert.ok(attendus.some((a) => a.postes.length && a.ameliorations.length && a.embleme), `un véhicule servi porte des postes, des Améliorations et un emblème : ${JSON.stringify(attendus)}`)
  await waitFor(session, `(() => { const c = globalThis.wfrpEcran?.corps; return !!c && ${JSON.stringify(attendus)}.every((a) => c[a.id]?.vehicule === a.vehicule
    && c[a.id].embleme_du_vehicule === a.embleme && JSON.stringify(c[a.id].postes) === JSON.stringify(a.postes)
    && JSON.stringify(c[a.id].ameliorations) === JSON.stringify(a.ameliorations)) })()`, { timeoutMs: 180000 })
  for (const a of attendus) noter(`${a.id} : « ${a.vehicule} », emblème « ${a.embleme} », ${a.postes.length} pièces de poste, ${a.ameliorations.length} pièces d’Amélioration`)
  await fermerLesFenetres()
  await sleep(1500)
  await capturer('2987-caraque-tactique')
  await realKey(session, { key: 'Home', code: 'Home', windowsVirtualKeyCode: 36 })
  for (let i = 0; i < CRANS_DU_GROS_PLAN; i++) await molette(session, { surface: 'canvas', x: 640, y: 400 }, -100)
  for (let cran = 0; cran < CRANS_DE_PIVOT; cran++) {
    await sleep(1500)
    await capturer(`2987-caraque-gros-plan-${cran}`)
    await realKey(session, { key: 'q', code: 'KeyQ', windowsVirtualKeyCode: 81 })
  }
}

/** Le monde posé : le modèle de chaque navire de la vue (`wfrpEcran.navires`) et la base de chaque corps dessiné
 *  (`wfrpEcran.corps`), que Godot tire en GLB, chacun lu d'un bloc sur le fil de la page. */
async function attendreLeMonde() {
  const v = await vue()
  const navires = Object.keys(v.corps.navires)
  const bases = Object.fromEntries(Object.entries(v.corps.combattants).map(([id, c]) => [id, c?.base ?? null]))
  await waitFor(session, `(() => { const e = globalThis.wfrpEcran; return !!e?.navires && ${JSON.stringify(navires)}.every((id) => e.navires.includes(id))
    && Object.entries(e.corps).every(([id, c]) => c.base === (${JSON.stringify(bases)}[id] ?? null)) })()`, { timeoutMs: 300000, evaluerMs: FIL_DE_LA_PAGE_MS })
  noter(`monde posé : navires ${navires.join(', ') || 'aucun'}, corps ${Object.keys((await ecran()).corps).join(', ') || 'aucun'}`)
}

/** Les vues nommées du fichier `fichier` : un tableau non vide d'objets, chacun un `nom` de fichier unique et le
 *  cadrage que `wfrpCadrer` lit. */
function lireLesVues(fichier) {
  const vues = JSON.parse(readFileSync(fichier, 'utf8'))
  assert.ok(Array.isArray(vues) && vues.length > 0, `${fichier} : un tableau de vues attendu`)
  for (const v of vues) assert.ok(v && typeof v === 'object' && /^[\w-]+$/.test(v.nom ?? ''), `${fichier} : chaque vue porte un nom de fichier : ${JSON.stringify(v)}`)
  const noms = vues.map((v) => v.nom)
  assert.equal(new Set(noms).size, noms.length, `${fichier} : noms uniques`)
  return vues
}

async function parcoursBord() {
  const { etapes } = JSON.parse(readFileSync(o.route, 'utf8'))
  await cliquerBouton('Combat')
  await waitFor(session, '!!globalThis.wfrpEcran?.cases && wfrpEcran.boutons.length > 0', { timeoutMs: 120000, evaluerMs: FIL_DE_LA_PAGE_MS })
  await fermerLesFenetres()
  await attendreLeMonde()
  const ou = async () => { const x = (await vue()).projection.exploration; return { x: x.groupe[0], y: x.groupe[1], z: x.etage ?? 0 } }
  const cleDe = (c) => `${c.x},${c.y},${c.z}`
  const fautes = []
  const couches = new Set()
  let atteintes = 0
  let total = 0
  async function arriver(c) {
    try { await attendreLaVue(`(() => { const x = v.projection.exploration; return x.groupe[0] === ${c.x} && x.groupe[1] === ${c.y} && (x.etage ?? 0) === ${c.z} })()`, 12000); return true } catch { return false }
  }
  async function aller(c) {
    if (cleDe(await ou()) === cleDe(c)) return true
    const pt = (await ecranPose()).cases[cleDe(c)]
    if (!pt) return false
    await cliquerPoint(pt[0], pt[1])
    const ok = await arriver(c)
    const v = await vue()
    noter(`clic ${cleDe(c)} : ${ok ? 'atteinte' : 'groupe en ' + cleDe(await ou()) + ' ; fenêtre ' + JSON.stringify(v.projection.fenetre?.genre ?? v.projection.fenetre ?? null).slice(0, 120) + ' ; journal ' + JSON.stringify((v.zones?.['journal'] ?? []).slice(-1)).slice(0, 200)}`)
    return ok
  }
  async function noterLaCouche(z) { if (!couches.has(z)) { couches.add(z); await capturer(`bord-couche-${z}`) } }
  let i = 0
  while (i < etapes.length) {
    const lot = []
    while (i < etapes.length && etapes[i].aller) lot.push(etapes[i++].aller)
    const pied = etapes[i]?.escalade ? lot.pop() : null
    total += lot.length + (pied ? 1 : 0)
    let restants = lot
    for (let passe = 0; passe < 2 && restants.length; passe++) {
      const ratees = []
      while (restants.length) {
        const g = await ou()
        restants.sort((p, q) => (p.z !== g.z) - (q.z !== g.z) || Math.hypot(p.x - g.x, p.y - g.y) - Math.hypot(q.x - g.x, q.y - g.y))
        const c = restants.shift()
        if (await aller(c)) { atteintes++; await noterLaCouche(c.z) } else ratees.push(c)
      }
      restants = ratees
    }
    for (const c of restants) { fautes.push(`case ${cleDe(c)} jamais atteinte au clic`); }
    if (restants.length) { await capturer(`bord-faute-${fautes.length}`) }
    if (!pied) continue
    if (await aller(pied)) atteintes++
    else { fautes.push(`pied d’échelle ${cleDe(pied)} jamais atteint (groupe en ${cleDe(await ou())})`); await capturer(`bord-faute-${fautes.length}`) }
    const e = etapes[i++]
    total++
    const libelle = e.escalade === 'monter' ? 'Escalader' : 'Descendre en escalade'
    const { boutons } = await ecran()
    const candidats = boutons.filter((b) => b.texte === libelle)
    if (candidats.length !== 1) { fautes.push(`« ${libelle} » ×${candidats.length} en ${cleDe(await ou())} ; boutons : ${boutons.map((b) => b.texte).join(' | ')}`); await capturer(`bord-faute-${fautes.length}`); continue }
    await cliquerPoint(candidats[0].x, candidats[0].y)
    if (await arriver(e.vers)) { atteintes++; await noterLaCouche(e.vers.z) }
    else { fautes.push(`${libelle} vers ${cleDe(e.vers)} : le groupe reste en ${cleDe(await ou())}`); await capturer(`bord-faute-${fautes.length}`) }
    noter(`étape ${i}/${etapes.length} : ${atteintes}/${total} atteintes, groupe en ${cleDe(await ou())}`)
  }
  noter(`bord : ${atteintes}/${total} étapes atteintes ; fautes : ${fautes.length ? '\n' + fautes.join('\n') : 'aucune'}`)
  assert.deepEqual(fautes, [], 'chaque case des ponts atteinte au clic, chaque échelle franchie par son geste')
}

async function parcoursCadrages() {
  const vues = lireLesVues(o.vues)
  await enHauteDefinition()
  await cliquerBouton('Combat')
  await waitFor(session, '!!globalThis.wfrpEcran?.cases && wfrpEcran.boutons.length > 0', { timeoutMs: 120000, evaluerMs: FIL_DE_LA_PAGE_MS })
  await fermerLesFenetres()
  await attendreLeMonde()
  for (const { nom, ...cadrage } of vues) {
    for (let v = await vue(); v.plateau.regard !== cadrage.regard; v = await vue()) {
      const suivant = v.plateau.regardSuivant
      await realKey(session, { key: 'v', code: 'KeyV', windowsVirtualKeyCode: 86 }, { delaiEntreeMs: FIL_DE_LA_PAGE_MS })
      await attendreLaVue(`v.plateau.regard === '${suivant}'`, 300000)
    }
    const camera = await cadrer(cadrage, nom)
    const plan = { z: cadrage.etage ?? 0, ...(camera.case && { oeil: { case: camera.case, lacet: camera.lacet } }) }
    noter(`${nom} : plan de la couche ${plan.z}\n${JSON.parse(await lire(`wfrpPont.appeler('plan', ${JSON.stringify(JSON.stringify(plan))})`)).plan}`)
    assert.deepEqual(camera.case, [cadrage.case.x, cadrage.case.y, cadrage.etage ?? 0], `${nom} : la caméra regarde depuis la case demandée (${JSON.stringify(camera)})`)
    assert.ok(Math.abs(((camera.lacet - cadrage.lacet) % 360 + 540) % 360 - 180) < 0.01, `${nom} : la caméra regarde à l'azimut ${cadrage.lacet} (${JSON.stringify(camera)})`)
    noter(`${nom} : ${JSON.stringify(camera)}`)
    await capturer(nom)
  }
}

async function parcoursMeteo() {
  await cliquerBouton('Combat')
  await waitFor(session, '!!globalThis.wfrpEcran?.cases && wfrpEcran.boutons.length > 0', { timeoutMs: 120000 })
  await fermerLesFenetres()
  const meteo = async () => JSON.parse(await evaluate(session, "wfrpPont.appeler('monde')")).meteo
  const particules = (m) => (m?.pluie?.averses ?? []).reduce((n, a) => n + a.nombre, 0)
  let m = await meteo()
  assert.ok(particules(m) > 0, `en tactique, la pluie tombe : ${JSON.stringify(m)?.slice(0, 200)}`)
  noter(`tactique : ${m.pluie.averses.length} averses, ${particules(m)} particules`)
  await sleep(1500)
  await capturer('3625-m1-tactique-pluie')
  const V = { key: 'v', code: 'KeyV', windowsVirtualKeyCode: 86 }
  await realKey(session, V)
  await attendreLaVue("v.plateau.regard === 'plateau'")
  m = await meteo()
  assert.equal(m.pluie, null, 'au plateau, rien ne tombe')
  noter('plateau : rien ne tombe')
  await realKey(session, V)
  await attendreLaVue("v.plateau.regard === 'immersion'")
  assert.ok(particules(await meteo()) > 0, 'en immersion, la pluie tombe')
  await sleep(1500)
  await capturer('3625-m2-immersion-pluie')
  noter('immersion : la pluie tombe autour de l’œil')
}

async function parcoursBrume() {
  await cliquerBouton('Combat')
  await waitFor(session, '!!globalThis.wfrpEcran?.cases && wfrpEcran.boutons.length > 0', { timeoutMs: 120000 })
  let v = await fermerLesFenetres()
  const meteo = async () => JSON.parse(await evaluate(session, "wfrpPont.appeler('monde')")).meteo
  let m = await meteo()
  assert.ok(m.nappes.length > 0 && m.pluie === null, `en tactique, les nappes du brouillard, rien ne tombe : ${JSON.stringify(m)?.slice(0, 200)}`)
  const loin = v.lumiere.brume.finCases
  noter(`tactique : ${m.nappes.length} nappes (${m.nappes.map((n) => n.alpha).join(', ')}), brume de profondeur à ${loin} cases du point visé`)
  await capturer('3625-b1-tactique-nappes')
  const V = { key: 'v', code: 'KeyV', windowsVirtualKeyCode: 86 }
  for (const regard of ['plateau', 'immersion']) {
    await realKey(session, V)
    await attendreLaVue(`v.plateau.regard === '${regard}'`)
  }
  v = await vue()
  m = await meteo()
  assert.equal(m.nappes.length, 0, 'en immersion, aucune nappe')
  assert.ok(v.lumiere.brume.depuisLOeil && v.lumiere.brume.finCases < loin, `en immersion, la brume part de l’œil, plus serrée : ${JSON.stringify(v.lumiere.brume)}`)
  noter(`immersion : brume depuis l’œil, de ${v.lumiere.brume.debutCases} à ${v.lumiere.brume.finCases} cases`)
  await sleep(600)
  await capturer('3625-b2-immersion-brume')
}

async function parcoursDialogue() {
  await cliquerBouton('Combat')
  await waitFor(session, '!!globalThis.wfrpEcran?.cases', { timeoutMs: 120000 })
  await fermerLesFenetres()
  const pres = { x: 5, y: 4 }
  await cliquerCase(pres)
  await attendreLaVue(`v.projection.exploration?.groupe.join() === '${pres.x},${pres.y}'`)
  let v = await vue()
  const parler = zone(v, 'exploration.gestes').find((b) => b.jeu.suite?.some((a) => a.args?.[1] === 'parler'))
  assert.ok(parler, `à portée de Gustav, son offre « Parler » est un bouton : ${zone(v, 'exploration.gestes').map((b) => b.libelle).join(' | ')}`)
  noter(`clic sur la case ${pres.x},${pres.y} ; bouton « ${parler.libelle} »`)
  await capturer('3328-h1-1-a-portee')
  await cliquerBouton(bouton(parler))
  await attendreLaVue("v.zones['dialogue.reponses'].length > 0")
  v = await vue()
  noter(`${zone(v, 'dialogue.orateur')[0]?.texte} : ${zone(v, 'dialogue.replique')[0]?.texte} ; réponses ${zone(v, 'dialogue.reponses').map((b) => b.libelle).join(' | ')}`)
  await capturer('3328-h1-2-conversation')
  const orateur = zone(v, 'dialogue.orateur')[0]?.texte
  await cliquerBouton(bouton(zone(v, 'dialogue.reponses')[0]))
  await attendreLaVue(`v.zones['dialogue.orateur'][0]?.texte !== ${JSON.stringify(orateur)}`)
  v = await vue()
  noter(`réponse cliquée : ${zone(v, 'dialogue.orateur')[0]?.texte} prend la parole`)
  await capturer('3328-h1-3-interlocuteur-suivant')
}

async function parcoursDocument() {
  await cliquerBouton('Combat')
  await waitFor(session, '!!globalThis.wfrpEcran?.cases', { timeoutMs: 120000 })
  await fermerLesFenetres()
  const pres = { x: 2, y: 2 }
  await cliquerCase(pres)
  await attendreLaVue(`v.projection.exploration?.groupe.join() === '${pres.x},${pres.y}'`)
  let v = await vue()
  const parcourir = zone(v, 'exploration.gestes').find((b) => b.jeu.suite?.some((a) => a.args?.[1] === 'lire'))
  assert.ok(parcourir, `à portée de la liasse, son offre est un bouton : ${zone(v, 'exploration.gestes').map((b) => b.libelle).join(' | ')}`)
  await cliquerBouton(bouton(parcourir))
  await attendreLaVue("v.zones['dialogue.reponses'].length > 0")
  for (const debut of ['Chapitre 1', 'Lire']) {
    v = await vue()
    const reponse = zone(v, 'dialogue.reponses').find((b) => b.libelle.startsWith(debut))
    assert.ok(reponse, `la réponse « ${debut} » est un bouton : ${zone(v, 'dialogue.reponses').map((b) => b.libelle).join(' | ')}`)
    await cliquerBouton(bouton(reponse))
  }
  await attendreLaVue("v.zones['fenetre.corps'][0]?.id === 'lecture'")
  v = await vue()
  noter(`document « ${zone(v, 'fenetre.titre')[0]?.texte} » : ${zone(v, 'fenetre.corps')[0]?.texte.length} caractères`)
  await capturer('3328-i1-1-document')
  const refermer = zone(v, 'fenetre.gestes').find((b) => b.type === 'bouton')
  await cliquerBouton(bouton(refermer))
  await attendreLaVue("v.zones['dialogue.reponses'].length > 0 && !v.projection.fenetre")
  noter(`« ${refermer.libelle} » : la conversation revient à la liasse`)
  await capturer('3328-i1-2-referme')
}

/** La ligne d'engagement de la scène `magie` (`src/scenes/test-scenarios/magie.ts`, `engager-le-combat`), sa colonne. */
const LIGNE_D_ENGAGEMENT = 16
/** Si le point `[x, y]` de l'écran est dans le cadre du monde publié (`cadre`), la part que l'interface ne couvre pas. */
const dansLeCadre = ({ cadre: [x, y, l, h] }, [px, py]) => px >= x && px <= x + l && py >= y && py <= y + h
/** Le groupe mené au combat de la scène `magie` comme un joueur l'y mène : à chaque pas, un clic sur la case de sa
 *  rangée la plus avancée vers la ligne d'engagement que le cadre du monde montre, chaque fenêtre fermée à l'Entrée,
 *  jusqu'au combat. */
async function engagerLeCombat() {
  for (let pas = 0; !(await vue()).projection.combat; pas++) {
    const v = await fermerLesFenetres()
    if (v.projection.combat) return
    assert.ok(pas < 8, `le groupe gagne la ligne d'engagement : groupe en ${v.projection.exploration?.groupe}`)
    const publie = await ecranPose()
    const [gx, gy] = v.projection.exploration.groupe
    const z = v.projection.exploration.etage ?? 0
    const vers = Array.from({ length: LIGNE_D_ENGAGEMENT - gx }, (_, i) => LIGNE_D_ENGAGEMENT - i).find((x) => publie.cases[`${x},${gy},${z}`] && dansLeCadre(publie, publie.cases[`${x},${gy},${z}`]))
    assert.ok(vers, `une case de la rangée ${gy} vers l'est se montre dans le cadre ${publie.cadre}`)
    await cliquerCase({ x: vers, y: gy, z })
    await attendreLaVue(`!!v.projection.fenetre || !!v.projection.combat || v.projection.exploration?.groupe.join() === '${vers},${gy}'`)
  }
}

async function parcoursIncantation() {
  await cliquerBouton('Combat')
  await waitFor(session, '!!globalThis.wfrpEcran?.cases', { timeoutMs: 120000 })
  await fermerLesFenetres()
  await engagerLeCombat()
  await attendreLaVue('!!v.projection.combat')
  await fermerLesFenetres()
  let v = await vue()
  assert.equal(zone(v, 'combat.actif')[0]?.nom, 'Aelindra, Haute Sorcière', 'la Haute Sorcière ouvre le combat')
  const sorts = zone(v, 'combat.offres').find((c) => c.id === 'offre/incantation')
  assert.ok(sorts, `les sorts de l’actif sont un choix : ${zone(v, 'combat.offres').map((c) => c.id).join(' | ')}`)
  noter(`« ${sorts.libelle} » : ${sorts.valeurs.length} sorts en ${sorts.type}`)
  await capturer('3328-j1-1-sorts')
  const cle = `liste/${sorts.id}`
  await ouvrirLOngletDe(sorts, { element: cle })
  const liste = trouver((await ecran()).boutons, { element: cle })
  assert.ok(liste, `la liste des sorts se dessine : ${(await ecran()).boutons.map((b) => b.element ?? b.texte).join(' | ')}`)
  const rang = liste.choix.indexOf('Fléchette')
  assert.ok(rang >= 0, `Fléchette est offerte : ${liste.choix.join(', ')}`)
  await geste(session, { surface: 'canvas', x: liste.x, y: liste.y }, { qui: 'liste des sorts' }, clic())
  await attendreLaListe({ element: cle }, (l) => l.ouverte, 'est ouverte au clic')
  await capturer('3328-j1-2-liste-ouverte')
  await designerALaListe({ element: cle }, rang)
  await marquer()
  await realKey(session, { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
  await nouvelEcran()
  v = await vue()
  noter(`Fléchette choisie : ${v.projection.combat.cibles.liste.length} cibles`)
  const [cible] = v.projection.combat.cibles.liste
  await cliquerCase(caseDeLaCible(v, cible))
  await attendreLaVue('!!v.projection.fenetre')
  v = await vue()
  noter(`clic sur la case de ${cible} : fenêtre « ${zone(v, 'fenetre.titre')[0]?.texte} »`)
  await capturer('3328-j1-3-incantation')
  await marquer()
  await realKey(session, { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
  await nouvelEcran()
  v = await vue()
  const portee = zone(v, 'fenetre.reglages').find((c) => c.libelle === 'Surincantation : Portée')
  assert.ok(portee, `le jet tombé ouvre la Surincantation : ${corps(v)} ; réglages ${zone(v, 'fenetre.reglages').map((c) => c.libelle).join(' | ')}`)
  noter(`jet à l'Entrée : ${corps(v)}`)
  await capturer('3328-j1-4-jet')
  await cliquerBouton(bouton(portee.valeurs[1]))
  await attendreLaVue("v.zones['fenetre.corps'].find((e) => e.id === 'surincantation')?.valeur === '0 pas sur 1'")
  noter('un pas alloué à la Portée : 0 pas sur 1')
  await capturer('3328-j1-5-surincantation')
  assert.equal(enFocus(await vue()).libelle, 'Appliquer', 'l’Entrée applique l’incantation')
  await marquer()
  await realKey(session, { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
  await nouvelEcran()
  await attendreLaVue("v.zones['fenetre.titre'][0]?.texte !== 'Incantation'")
  noter('« Appliquer » : la fenêtre d’incantation se referme')
  await capturer('3328-j1-6-appliquee')
}

async function parcoursSoin() {
  await cliquerBouton('Combat')
  await waitFor(session, '!!globalThis.wfrpEcran?.cases', { timeoutMs: 120000 })
  await fermerLesFenetres()
  await engagerLeCombat()
  await attendreLaVue('!!v.projection.combat')
  await fermerLesFenetres()
  /** La main à un héros : sa barre offre la fin du tour, toute fenêtre vidée. */
  const aUnHeros = async () => {
    for (;;) {
      await attendreLaVue("!!v.projection.fenetre || v.zones['combat.offres'].flatMap((c) => c.valeurs).some((b) => b.id === 'fin-de-tour')", 120000)
      if (!(await vue()).projection.fenetre) return
      await fermerLesFenetres()
    }
  }
  for (let tours = 0; (await aUnHeros(), zone(await vue(), 'combat.actif')[0]?.nom !== 'Tueur'); tours++) {
    assert.ok(tours < 5, `Le Tueur prend la main : ${zone(await vue(), 'combat.actif')[0]?.nom}`)
    await finirLeTour()
  }
  let v = await vue()
  const soigner = offre(v, 'soins')
  assert.ok(soigner && !soigner.refus, `Le Tueur soigne : ${JSON.stringify(soigner)}`)
  await presserLOffre(soigner)
  v = await vue()
  const [patient] = v.projection.combat.cibles.liste
  const ou = caseDeLaCible(v, patient)
  noter(`« Soigner » : intention ${JSON.stringify(v.projection.combat.intention)}, patients ${v.projection.combat.cibles.liste.join(', ')} ; ${patient} en ${ou.x},${ou.y},${ou.z}`)
  await cliquerCase(ou)
  noter(`clic : fenêtre ${JSON.stringify((await vue()).projection.fenetre?.cle ?? null)}`)
  await attendreLaVue("v.zones['fenetre.corps'].some((e) => e.id === 'soin')")
  v = await vue()
  noter(`clic sur la case de ${patient} : ${corps(v)} ; réglages ${zone(v, 'fenetre.reglages').map((c) => c.libelle).join(' | ')}`)
  await capturer('3328-k1-1-soin')
  await marquer()
  await realKey(session, { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
  await nouvelEcran()
  v = await vue()
  noter(`jet à l'Entrée : ${corps(v)}`)
  await capturer('3328-k1-2-jet')
}

async function parcoursVoyage() {
  await cliquerBouton('Combat')
  await waitFor(session, '!!globalThis.wfrpEcran?.cases', { timeoutMs: 120000 })
  /** Joue le geste que l'Entrée jouerait, sinon le premier bouton ouvert, tant qu'une fenêtre autre que `jusqua` tient la
   *  main. */
  const avancer = async (jusqua) => {
    for (let v = await vue(), pas = 0; v.projection.fenetre && v.projection.fenetre.cle !== jusqua; v = await vue(), pas++) {
      assert.ok(pas < 80, `les fenêtres se vident jusqu'à ${jusqua} : ${corps(v)}`)
      const gestes = zone(v, 'fenetre.gestes')
      if (gestes.some((b) => b.type === 'bouton' && b.focus)) {
        await marquer()
        await realKey(session, { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
        await nouvelEcran()
      } else await cliquerBouton(bouton(gestes.find((b) => b.type === 'bouton' && !b.refus)))
    }
  }
  await avancer()
  await cliquerBouton('Carte du monde')
  await attendreLaVue("v.projection.fenetre?.cle === 'carteDuMonde'")
  let v = await vue()
  const points = zone(v, 'fenetre.corps').find((e) => e.type === 'plan').points
  noter(`carte : ${points.map((p) => `${p.nom} [${p.ton}] (${p.elements.map((x) => `${x.libelle} : ${x.valeurs.map((b) => b.libelle).join(', ')}`).join(' ; ')})`).join(' | ')}`)
  await capturer('3328-l1-1-carte')
  await cliquerBouton('À pied · 2 j')
  await attendreLaVue("v.disposition === 'voyage'")
  v = await vue()
  noter(`voyage : ${corps(v)}`)
  await capturer('3534-voyage-1-jets')
  for (let k = 0; k < 4; k++) {
    await amenerAuGroupe('Lancer')
    await cliquerBouton('Lancer')
    await attendreLaVue(`v.zones['groupe.heros'].flatMap((h) => h.elements).filter((e) => e.type === 'jet' && e.resultat).length > ${k}`)
  }
  noter(`jets tombés : ${zone(await vue(), 'groupe.heros').map((h) => `${h.nom} (${h.elements.map((e) => e.verdict ?? e.libelle).join(', ')})`).join(' | ')}`)
  await capturer('3534-voyage-2-tombes')
  await avancer('recitDeVoyage')
  await attendreLaVue("v.projection.fenetre?.cle === 'recitDeVoyage'")
  v = await vue()
  noter(`récit : ${corps(v)}`)
  await capturer('3328-l1-2-recit')
  await avancer('ecranDuLieu')
  await attendreLaVue("v.projection.fenetre?.cle === 'ecranDuLieu'")
  v = await vue()
  noter(`lieu : ${zone(v, 'fenetre.titre')[0].texte} ; ${zone(v, 'fenetre.corps').map((e) => e.nom ?? e.texte).join(' | ')}`)
  await capturer('3534-l2-lieu')
  const forge = bouton(zone(v, 'fenetre.corps').find((e) => e.id === 'service/forgeron').elements.find((e) => e.type === 'bouton'))
  await amenerAuService(v, forge)
  await cliquerBouton(forge)
  await attendreLaVue("v.projection.fenetre?.cle === 'marchand'")
  v = await vue()
  noter(`échoppe : ${zone(v, 'fenetre.corps').map((e) => `${e.id} (${(e.elements ?? []).map((b) => b.libelle).join(', ')})`).join(' | ')}`)
  await capturer('3534-echoppe-1-etal')
  const article = zone(v, 'fenetre.corps').filter((e) => e.id.startsWith('etal/')).flatMap((e) => e.elements).find((b) => !b.refus)
  await cliquerBouton(bouton(article))
  await attendreLaVue("v.zones['fenetre.corps'].find((e) => e.id === 'panier').elements.length > 1")
  noter(`panier : ${zone(await vue(), 'fenetre.corps').find((e) => e.id === 'panier').elements.map((b) => b.libelle).join(', ')}`)
  await capturer('3534-echoppe-2-panier')
}

async function parcoursMarche() {
  await cliquerBouton('Combat')
  await waitFor(session, '!!globalThis.wfrpEcran?.boutons', { timeoutMs: 120000 })
  /** L'Entrée tant qu'une fenêtre autre que `jusqua` tient la main. */
  const entrer = async (jusqua) => {
    for (let v = await vue(), pas = 0; v.projection.fenetre && v.projection.fenetre.cle !== jusqua; v = await vue(), pas++) {
      assert.ok(pas < 20, `l'Entrée mène à ${jusqua} : ${corps(v)}`)
      await marquer()
      await realKey(session, { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
      await nouvelEcran()
    }
  }
  await entrer()
  await cliquerBouton('Le lieu')
  await attendreLaVue("v.projection.fenetre?.cle === 'ecranDuLieu'")
  await cliquerBouton(bouton(zone(await vue(), 'fenetre.corps').find((e) => e.id === 'service/marche').elements.find((e) => e.type === 'bouton')))
  await entrer('marcheDeTerre')
  await attendreLaVue("v.projection.fenetre?.cle === 'marcheDeTerre'")
  let v = await vue()
  noter(`halle : ${zone(v, 'fenetre.corps').map((e) => `${e.id} (${(e.elements ?? []).map((x) => x.libelle ?? x.id).join(', ')})`).join(' | ')}`)
  await capturer('3534-halle-1-offres')
  await cliquerBouton('Acheter')
  await attendreLaVue("v.zones['fenetre.reglages'].some((e) => e.id === 'fenetreChoisir@marcheDeTerre#acheter')")
  await cliquerBouton('Conclure l’achat')
  await attendreLaVue("v.zones['fenetre.corps'].some((e) => e.id.startsWith('lot/'))")
  v = await vue()
  noter(`lot : ${zone(v, 'fenetre.corps').filter((e) => e.id.startsWith('lot/')).map((e) => `${e.nom} (${e.elements.map((x) => x.valeur ?? x.libelle).join(', ')})`).join(' | ')}`)
  await capturer('3534-halle-2-lot')
}

async function parcoursRepos() {
  await cliquerBouton('Combat')
  await waitFor(session, '!!globalThis.wfrpEcran?.cases', { timeoutMs: 120000 })
  /** L'Entrée tant qu'une fenêtre autre que `jusqua` tient la main. */
  const entrer = async (jusqua) => {
    for (let v = await vue(), pas = 0; v.projection.fenetre && v.projection.fenetre.cle !== jusqua; v = await vue(), pas++) {
      assert.ok(pas < 40, `l'Entrée mène à ${jusqua} : ${corps(v)}`)
      await marquer()
      await realKey(session, { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
      await nouvelEcran()
    }
  }
  await entrer()
  await cliquerBouton('Carte du monde')
  await attendreLaVue("v.projection.fenetre?.cle === 'carteDuMonde'")
  await cliquerBouton('À pied · 2 j')
  await entrer('repos')
  let v = await vue()
  noter(`repos : ${corps(v)}`)
  await capturer('3328-r1-1-nuit')
  const dormeur = (v) => element(v, 'groupe.heros', 'heros/bjorn').elements.find((x) => x.id === 'couchage').valeurs.map((b) => `${b.libelle}${b.presse ? '*' : ''}`).join(' ')
  assert.equal(dormeur(v), 'Privée* Commune Dehors', 'Bjorn en chambre privée, sur sa carte')
  await choisirDansLaListe(undefined, 'Dehors')
  await attendreLaVue("v.zones['groupe.heros'].find((e) => e.id === 'heros/bjorn').elements.find((x) => x.id === 'couchage').valeurs[2].presse")
  v = await vue()
  noter(`Bjorn : ${dormeur(v)}`)
  await capturer('3328-r1-2-dehors')
  await entrer()
  noter(`après « Dormir » : ${(await vue()).disposition}`)
}

async function parcoursRepit() {
  await cliquerBouton('Combat')
  await waitFor(session, '!!globalThis.wfrpEcran?.boutons', { timeoutMs: 120000 })
  /** L'Entrée tant qu'un geste a le focus et que la disposition n'est pas `jusqua`. */
  const entrer = async (jusqua) => {
    for (let v = await vue(), pas = 0; v.disposition !== jusqua; v = await vue(), pas++) {
      assert.ok(pas < 12, `l'Entrée mène à ${jusqua} : ${corps(v)}`)
      assert.ok(zone(v, 'fenetre.gestes').some((b) => b.type === 'bouton' && b.focus), `un geste a le focus : ${corps(v)}`)
      await marquer()
      await realKey(session, { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
      await nouvelEcran()
    }
  }
  /** Les puces de l'onglet du premier héros. */
  const puces = (v) => zone(v, 'fenetre.corps').find((e) => e.type === 'entite').elements.filter((x) => x.type === 'puce').map((x) => x.libelle)
  await entrer('interlude')
  let v = await vue()
  noter(`répit : ${zone(v, 'fenetre.corps')[0].texte} ; ${puces(v).join(' ; ')}`)
  assert.deepEqual(puces(v)[0], 'Activités : 3 / 3')
  await capturer('3328-m1-1-repit')
  await choisirDansLaListe(undefined, 'Revenus')
  await cliquerAmene('Entreprendre', 1)
  await attendreLaVue("v.disposition === 'activite'")
  await capturer('3328-m1-2-revenus')
  await marquer()
  await realKey(session, { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
  await nouvelEcran()
  await cliquerBouton('Appliquer')
  await attendreLaVue("v.disposition === 'interlude'")
  v = await vue()
  assert.equal(puces(v)[0], 'Activités : 2 / 3', 'une Activité de moins')
  await capturer('3328-m1-3-repit-apres')
}

async function parcoursOuvrage() {
  await cliquerBouton('Combat')
  await waitFor(session, '!!globalThis.wfrpEcran?.boutons', { timeoutMs: 120000 })
  for (let v = await vue(), pas = 0; v.disposition !== 'interlude'; v = await vue(), pas++) {
    assert.ok(pas < 8, `les dés d'Événement mènent à l'interlude : ${corps(v)}`)
    await marquer()
    await realKey(session, { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
    await nouvelEcran()
  }
  await capturer('3328-o1-1-forgeron')
  /** Les éléments de l'onglet du forgeron. */
  const durin = async () => zone(await vue(), 'fenetre.corps').find((e) => e.id === 'repit/durin').elements
  await choisirDansLaListe(undefined, 'Artisanat')
  await capturer('3328-o1-2-composition')
  const ouvrage = (await durin()).find((x) => x.id === 'ouvrage').valeurs.filter((v) => !v.refus)[1].libelle
  await choisirDansLaListe(undefined, ouvrage)
  await choisirDansLaListe(undefined, 'Solide')
  await cliquerAmene('Entreprendre', 1)
  await attendreLaVue("!v.zones['fenetre.corps'].find((e) => e.id === 'repit/durin').elements.some((x) => x.id === 'ouvrage')")
  noter(`ouvrage engagé : ${ouvrage} ; l'Artisanat se poursuit : ${(await durin()).find((x) => x.id === 'pratiquer').refus ?? 'ouvert'}`)
  await capturer('3328-o1-3-ouvrage-engage')
}

async function parcoursBataille() {
  await cliquerBouton('Combat')
  await waitFor(session, '!!globalThis.wfrpEcran?.boutons', { timeoutMs: 120000 })
  for (let v = await vue(), pas = 0; v.disposition !== 'interlude'; v = await vue(), pas++) {
    assert.ok(pas < 12, `les dés d'Événement mènent à l'interlude : ${corps(v)}`)
    await marquer()
    await realKey(session, { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
    await nouvelEcran()
  }
  await cliquerBouton('Clore l’interlude')
  await attendreLaVue("v.disposition === 'batailleDeMasse'")
  /** L'élément `id` du corps de la fenêtre. */
  const element = (v, id) => zone(v, 'fenetre.corps').find((e) => e.id === id)
  let v = await vue()
  noter(`bataille : ${element(v, 'bataille/round').texte} ; ${zone(v, 'fenetre.corps').filter((e) => e.id.startsWith('scene/')).map((e) => e.nom).join(', ')}`)
  await capturer('3328-n1-1-bataille')
  const [scene] = zone(v, 'fenetre.corps').filter((e) => e.id.startsWith('scene/') && e.elements.some((x) => x.id === 'postes'))
  await cliquerBouton('Résoudre')
  await attendreLaVue("v.disposition === 'activite'")
  await marquer()
  await realKey(session, { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
  await nouvelEcran()
  await cliquerBouton('Appliquer')
  await attendreLaVue("v.disposition === 'batailleDeMasse'")
  v = await vue()
  assert.equal(element(v, scene.id).elements.find((x) => x.id === 'engager').refus, 'Cette Scène est déjà résolue.', `${scene.nom} se ferme`)
  await cliquerBouton('Test spectaculaire de Puissance')
  await attendreLaVue("v.zones['fenetre.corps'].some((e) => e.libelle === 'Round suivant')")
  await capturer('3328-n1-2-entre-deux-rounds')
  await cliquerBouton('Round suivant')
  await attendreLaVue("v.zones['fenetre.corps'].some((e) => e.texte === 'Round de bataille 2 / 3')")
  await capturer('3328-n1-3-round-2')
}

async function parcoursFiche() {
  await cliquerBouton('Combat')
  await waitFor(session, '!!globalThis.wfrpEcran?.cases && wfrpEcran.boutons.length > 0', { timeoutMs: 120000 })
  await marquer()
  await realKey(session, { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
  await nouvelEcran()
  let v = await vue()
  assert.equal(v.projection.fenetre, null, 'l’Entrée ferme la fenêtre du round')
  const [heros] = zone(v, 'groupe.heros')
  assert.ok(heros, 'chaque héros du groupe a sa carte')
  await cliquerBouton(bouton(ficheDuHeros(heros)))
  v = await vue()
  assert.equal(zone(v, 'fiche.porteur')[0]?.nom, heros.nom, 'le bouton de sa carte ouvre le statbloc du héros')
  noter(`carte « ${heros.nom} » : ${zone(v, 'fiche.profil').map((p) => `${p.libelle} ${p.valeur}`).join(' · ')} ; ${zone(v, 'fiche.sections').map((s) => s.nom).join(', ')}`)
  await capturer('3678-statbloc-1-heros')
  const publie = await ecranPose()
  const [cle, ennemi] = Object.entries(v.occupants).find(([k, id]) => element(v, 'combat.ordre', `ordre/${id}`)?.ton === 'echec' && dansLeCadre(publie, publie.cases[k]))
  const [px, py] = publie.cases[cle]
  await marquer()
  await geste(session, { surface: 'canvas', x: px, y: py }, { qui: `clic droit (${Math.round(px)}, ${Math.round(py)})` }, clic({ bouton: 'right' }))
  await nouvelEcran()
  v = await vue()
  assert.equal(v.zones['fiche.porteur'][0]?.id, ennemi, 'le clic droit sur sa case ouvre le statbloc de l’ennemi')
  noter(`clic droit sur ${cle} : ${zone(v, 'fiche.porteur')[0].nom} ; ${zone(v, 'fiche.sections').map((s) => s.nom).join(', ')} ; ${zone(v, 'fiche.source').map((l) => l.texte).join('')}`)
  await capturer('3678-statbloc-2-ennemi')
  await cliquerBouton({ element: 'bouton/fermer' })
  v = await vue()
  assert.deepEqual(zone(v, 'fiche.porteur'), [], 'le bouton « Fermer » ferme la fiche')
  await capturer('3678-statbloc-3-fermee')
}

async function parcoursInventaire() {
  await cliquerBouton('Combat')
  await waitFor(session, '!!globalThis.wfrpEcran?.cases && wfrpEcran.boutons.length > 0', { timeoutMs: 120000 })
  let v = await fermerLesFenetres()
  const heros = zone(v, 'groupe.heros').find((c) => c.nom === 'Apothicaire')
  assert.ok(heros, 'Apothicaire a sa carte')
  await amenerAuGroupe(bouton(ficheDuHeros(heros)))
  await cliquerBouton(bouton(ficheDuHeros(heros)))
  await attendreLaVue(`v.zones['fiche.sections'].some((e) => e.id === 'section/possessions')`)
  v = await vue()
  const possession = (libelle) => element(v, 'fiche.sections', 'section/possessions').elements.find((b) => b.libelle === libelle)
  await cliquerBouton({ onglet: element(v, 'fiche.sections', 'section/possessions').nom })
  await cliquerBouton(bouton(possession('Justaucorps de cuir')))
  await attendreLaVue(`v.zones['fiche.objet'][0]?.nom === 'Justaucorps de cuir'`)
  v = await vue()
  noter(`possession choisie : ${zone(v, 'fiche.objet')[0].elements.map((e) => e.libelle).join(' | ')}`)
  await capturer('3328-inventaire-1-armure-portee')
  await cliquerBouton({ element: 'bouton/porter' })
  await attendreLaVue(`v.zones['fiche.objet'][0]?.ton === 'neutre'`)
  noter('« Porter » pressé : l’armure ôtée')
  await capturer('3328-inventaire-2-armure-otee')
  v = await vue()
  await cliquerBouton(bouton(possession('Potion de guérison')))
  await attendreLaVue(`v.zones['fiche.objet'][0]?.nom === 'Potion de guérison'`)
  v = await vue()
  noter(`possession choisie : ${zone(v, 'fiche.objet')[0].elements.map((e) => e.libelle).join(' | ')}`)
  await capturer('3328-inventaire-3-consommable')
}

/** Le bouton d'id `<prefixe>/…` de l'entité `id` de la zone `z` de la vue `v`. */
const boutonDeLEntite = (v, z, id, prefixe) => element(v, z, id).elements.find((e) => e.type === 'bouton' && e.id.startsWith(`${prefixe}/`))
/** « Jouer » pressé au menu : la partie ouverte au groupe, ses pré-tirés et ses campagnes montrés ; sa vue. */
async function ouvrirAuGroupe() {
  await cliquerBouton('Jouer')
  await waitFor(session, '!!globalThis.wfrpEcran?.cases && wfrpEcran.boutons.some((b) => b.element?.startsWith("bouton/recruter/"))', { timeoutMs: 120000, evaluerMs: FIL_DE_LA_PAGE_MS })
  return vue()
}
/** Le pré-tiré de rang `rang` de la zone `groupe.pretires` recruté à son bouton ; la vue d'après, son héros au groupe. */
async function recruterLePretire(rang) {
  const v = await vue()
  const carte = zone(v, 'groupe.pretires')[rang]
  await cliquerBouton(bouton(boutonDeLEntite(v, 'groupe.pretires', carte.id, 'recruter')))
  const apres = await vue()
  assert.equal(zone(apres, 'groupe.heros').at(-1).nom, carte.nom, `${carte.nom} recruté entre au groupe`)
  assert.ok(boutonDeLEntite(apres, 'groupe.pretires', carte.id, 'recruter').refus, `${carte.nom} au groupe ne se recrute plus`)
  return apres
}
/** La campagne `id` lancée à son bouton de la zone `groupe.campagnes` ; la vue d'après, sa scène d'entrée posée. */
async function lancerLaCampagne(id) {
  await cliquerBouton(bouton(boutonDeLEntite(await vue(), 'groupe.campagnes', `campagne/${id}`, 'lancer')))
  await attendreLaVue('v.projection.scene && v.plateau')
  await attendreLeMonde()
  return vue()
}
/** Attend que l'écran publie le bouton qui dessine l'élément `element`. */
const attendreLeBouton = (element) => waitFor(session, `!!globalThis.wfrpEcran && wfrpEcran.boutons.some((b) => b.element === ${JSON.stringify(element)})`, { timeoutMs: 30000, evaluerMs: FIL_DE_LA_PAGE_MS })
/** La valeur de chaque préférence de confort que dit le pont, par id. */
const preferences = async () => JSON.parse(await lire(`wfrpPont.appeler('preferences')`)).preferences
/** Attend que le pont dise la préférence `id` à `valeur`. */
const attendreLaPreference = (id, valeur) =>
  waitFor(session, `JSON.parse(wfrpPont.appeler('preferences')).preferences[${JSON.stringify(id)}] === ${JSON.stringify(valeur)}`, { timeoutMs: 30000, evaluerMs: FIL_DE_LA_PAGE_MS })
/** Règle par le pont la préférence de confort `id` à `valeur`. */
const reglerLaPreference = (id, valeur) => lire(`wfrpPont.appeler('reglages', ${JSON.stringify(JSON.stringify({ type: 'preference', args: [id, valeur] }))})`)
/** Les rangs de création des gains du graphe audio de la page (`wfrpGains`, `lieu.releverLesGains`) qui valent `valeur`. */
const gainsA = async (valeur) => JSON.parse(await lire(`JSON.stringify((globalThis.wfrpGains ?? []).flatMap((g, i) => Math.abs(g.gain.value - ${valeur}) < 1e-4 ? [i] : []))`))
async function parcoursReglages() {
  const oui = { element: 'bouton/preference/des-fixes/true' }
  const non = { element: 'bouton/preference/des-fixes/false' }
  const BAS = 0.35
  await cliquerBouton('Options')
  await attendreLeBouton(oui.element)
  assert.equal((await preferences())['des-fixes'], false, 'les dés fixés à leur défaut')
  await capturer('3009-reglages-1-au-menu')
  await cliquerBouton(oui)
  await attendreLaPreference('des-fixes', true)
  noter('« Options » au menu : les dés fixés réglés au panneau')
  await reglerLaPreference('volume-musique', BAS)
  const graphe = await lieu.releverLesGains(session)
  await recharger()
  assert.equal((await preferences())['des-fixes'], true, 'la préférence réglée revient du stockage après le rechargement de la page')
  assert.equal((await preferences())['volume-musique'], BAS, 'le volume de la musique aussi')
  const [bus, ...autres] = graphe ? await gainsA(BAS) : []
  if (graphe) assert.ok(bus !== undefined && autres.length === 0, `au lancement, un seul gain du graphe audio de la page est au volume réglé (${[bus, ...autres]})`)
  await ouvrirAuGroupe()
  await cliquerBouton({ element: 'bouton/reglages' })
  await attendreLeBouton(non.element)
  await capturer('3009-reglages-2-en-partie')
  await reglerLaPreference('volume-musique', 1)
  await cliquerBouton(non)
  await attendreLaPreference('des-fixes', false)
  if (graphe) {
    await waitFor(session, `Math.abs(wfrpGains[${bus}].gain.value - 1) < 1e-4`, { timeoutMs: 30000, evaluerMs: FIL_DE_LA_PAGE_MS })
    noter(`le bus de la musique (gain ${bus} de la page) : ${BAS} au lancement, 1 après le geste du panneau`)
  }
  await cliquerBouton({ element: 'bouton/fermer' })
  await waitFor(session, `!wfrpEcran.boutons.some((b) => b.element === ${JSON.stringify(non.element)})`, { timeoutMs: 30000, evaluerMs: FIL_DE_LA_PAGE_MS })
  noter('page rechargée : la préférence revenue du stockage ; « Options » de la partie la remet, « Fermer » rend la partie')
  await capturer('3009-reglages-3-ferme')
}
async function parcoursCampagne() {
  let v = await ouvrirAuGroupe()
  assert.equal(v.projection.scene, null, 'la partie ouverte au groupe n’a pas de scène')
  assert.deepEqual(zone(v, 'groupe.heros'), [], 'ni de héros')
  const diligence = boutonDeLEntite(v, 'groupe.campagnes', 'campagne/la-diligence', 'lancer')
  assert.ok(diligence.refus, 'groupe vide, la campagne ne se lance pas')
  assert.equal(trouver((await ecran()).boutons, bouton(diligence)), undefined, 'son bouton refusé ne se joue pas')
  noter(`au groupe : ${zone(v, 'groupe.pretires').length} pré-tirés, campagnes ${zone(v, 'groupe.campagnes').map((e) => e.nom).join(' · ')} ; « ${diligence.libelle} » refusé : ${diligence.refus}`)
  await capturer('3009-campagne-1-groupe-vide')
  await recruterLePretire(0)
  v = await recruterLePretire(1)
  const groupe = zone(v, 'groupe.heros').map((e) => e.nom)
  noter(`groupe composé : ${groupe.join(', ')}`)
  await capturer('3009-campagne-2-groupe-compose')
  v = await lancerLaCampagne('la-diligence')
  assert.equal(v.projection.fenetre?.cle, 'ouverture', 'la Diligence s’ouvre sur sa fenêtre d’ouverture')
  assert.deepEqual(zone(v, 'groupe.heros').map((e) => e.nom), groupe, 'le groupe composé entre en scène')
  assert.deepEqual([zone(v, 'groupe.pretires'), zone(v, 'groupe.campagnes')], [[], []], 'la composition se ferme, la partie en cours')
  noter(`campagne lancée : scène ${v.projection.scene.nom}, fenêtre « ${zone(v, 'fenetre.titre')[0].texte} »`)
  await capturer('3009-campagne-3-lancee')
  await cliquerBouton({ element: 'bouton/sauvegardes' })
  await attendreLeBouton('bouton/sauvegarder/1')
  await cliquerBouton({ element: 'bouton/sauvegarder/1' })
  await attendreLeBouton('bouton/charger/1')
  await capturer('3009-campagne-4-sauvegardee')
  await cliquerBouton({ element: 'bouton/fermer' })
  await waitFor(session, '!!globalThis.wfrpEcran && !wfrpEcran.boutons.some((b) => b.element === "bouton/fermer")', { timeoutMs: 30000, evaluerMs: FIL_DE_LA_PAGE_MS })
  await cliquerBouton({ element: 'bouton/quitter' })
  await attendreLeMenu()
  assert.equal(JSON.parse(await lire(`wfrpPont.appeler('vue')`)).ok, false, 'la partie quittée, le pont n’en tient plus')
  noter('partie écrite à l’emplacement 1 ; « Quitter la partie » rend le menu')
  await recharger()
  await cliquerBouton('Reprendre')
  await attendreLeBouton('bouton/charger/1')
  assert.ok(trouver((await ecran()).boutons, { element: 'bouton/charger/auto' }), 'la partie quittée s’est gardée à l’emplacement automatique')
  await capturer('3009-campagne-5-reprendre')
  await cliquerBouton({ element: 'bouton/charger/1' })
  await attendreLaVue('v.projection.scene && v.plateau', 120000)
  await attendreLeMonde()
  const reprise = await vue()
  assert.deepEqual([reprise.projection.scene.id, zone(reprise, 'groupe.heros').map((e) => e.nom)], [v.projection.scene.id, groupe], 'la partie reprise après le rechargement de la page : sa scène, son groupe')
  noter(`page rechargée, emplacement 1 chargé : scène ${reprise.projection.scene.nom}, groupe ${groupe.join(', ')}`)
  await capturer('3009-campagne-6-reprise')
  await cliquerBouton({ element: 'bouton/quitter' })
  await attendreLeMenu()
  v = await ouvrirAuGroupe()
  assert.deepEqual(zone(v, 'groupe.heros'), [], 'la partie suivante s’ouvre sur un groupe vide')
  await recruterLePretire(2)
  v = await lancerLaCampagne('arene')
  noter(`seconde partie sans recharger : scène ${v.projection.scene.nom}`)
  await capturer('3009-campagne-7-seconde-partie')
}

/** La suite que rend la méthode `methode` du pont, appelée dans la page sans passer par l'écran ; son refus lève. */
async function appelerLePont(methode, entree) {
  const r = JSON.parse(await lire(`wfrpPont.appeler(${JSON.stringify(methode)}${entree === undefined ? '' : `, ${JSON.stringify(JSON.stringify(entree))}`})`))
  assert.ok(r.ok, `${methode} : ${r.erreur?.message}`)
  return r
}

/** Un héros créé et engagé par le pont, sans l'écran, dans une partie ouverte au groupe puis quittée : chaque page
 *  jouée par ses boutons (ses tirages, puis chaque choix ouvert tranché par sa première valeur libre). Rend son nom. */
async function creerUnHerosParLePont() {
  let v = (await appelerLePont('ouvrir', { graine: Number(o.graine) })).vue
  const jouer = async (b) => { v = (await appelerLePont('creation', b.jeu)).vue }
  const corps = (id) => element(v, 'creation.corps', id)
  const suivante = () => element(v, 'creation.gestes', 'suivante')
  const ouverts = () => zone(v, 'creation.corps').filter((e) => (e.type === 'choix' || e.type === 'liste') && !e.valeurs.some((b) => b.presse))
  await jouer(element(v, 'groupe.gestes', 'creation'))
  for (let page = 0; suivante(); page++) {
    assert.ok(page < 12, `la création n’atteint pas sa dernière page : ${pageOuverte(v)}`)
    for (const id of ['tirage', 'defaut', 'bourse', 'nom', 'physique']) if (corps(id)?.type === 'bouton' && !corps(id).refus) await jouer(corps(id))
    const augmentation = zone(v, 'creation.corps').find((e) => e.id.startsWith('augmentation/'))
    if (augmentation) await jouer(augmentation.valeurs.find((b) => b.libelle === '5'))
    if (corps('destin')) await jouer(corps('destin').valeurs.at(-1))
    for (let n = 0; suivante().refus; n++) {
      assert.ok(n < 40, `${pageOuverte(v)} ne se solde pas : ${suivante().refus}`)
      await jouer(ouverts()[0]?.valeurs.find((b) => !b.refus) ?? zone(v, 'creation.corps').find((e) => e.type === 'bouton' && !e.presse && !e.refus))
    }
    await jouer(suivante())
  }
  const nom = zone(v, 'creation.corps')[0].libelle
  await jouer(element(v, 'creation.gestes', 'engager'))
  assert.equal(zone(v, 'groupe.heros').at(-1).nom, nom, `${nom} engagé entre au groupe`)
  await appelerLePont('quitter')
  return nom
}

async function parcoursRoster() {
  const nom = await creerUnHerosParLePont()
  noter(`${nom} créé et engagé par le pont, la partie quittée`)
  await recharger()
  let v = await ouvrirAuGroupe()
  const carte = zone(v, 'groupe.roster').find((e) => e.nom === nom)
  assert.ok(carte, `page rechargée, ${nom} est au roster : ${zone(v, 'groupe.roster').map((e) => e.nom).join(', ')}`)
  assert.deepEqual(zone(v, 'groupe.heros'), [], 'le groupe de la partie neuve est vide')
  noter(`page rechargée, « Jouer » : le roster montre ${zone(v, 'groupe.roster').map((e) => `${e.nom} (${e.elements[0].texte})`).join(', ')}`)
  await capturer('3009-roster-1-mes-personnages')
  await cliquerBouton(bouton(boutonDeLEntite(v, 'groupe.roster', carte.id, 'recruter')))
  v = await vue()
  assert.deepEqual(zone(v, 'groupe.heros').map((e) => [e.id, e.nom]), [[carte.id.replace('roster/', 'heros/'), nom]], 'recruté, il entre au groupe sous l’id que le roster garde')
  const refus = boutonDeLEntite(v, 'groupe.roster', carte.id, 'recruter').refus
  assert.ok(refus, 'au groupe, il ne se recrute plus')
  assert.equal(trouver((await ecran()).boutons, bouton(boutonDeLEntite(v, 'groupe.roster', carte.id, 'recruter'))), undefined, 'son bouton refusé ne se joue pas')
  noter(`${nom} recruté du roster ; « Recruter » refusé : ${refus}`)
  await capturer('3009-roster-2-recrute')
  v = await lancerLaCampagne('la-diligence')
  assert.deepEqual([zone(v, 'groupe.heros').map((e) => e.nom), zone(v, 'groupe.roster')], [[nom], []], 'il entre en scène, la composition retirée')
  noter(`campagne lancée avec ${nom} : scène ${v.projection.scene.nom}`)
  await capturer('3009-roster-3-en-scene')
  await cliquerBouton({ element: 'bouton/quitter' })
  await attendreLeMenu()
  v = await ouvrirAuGroupe()
  assert.ok(element(v, 'groupe.roster', carte.id), 'la partie quittée, il reste au roster')
  const absent = `!v.zones['groupe.roster'].some((e) => e.id === ${JSON.stringify(carte.id)})`
  const dossier = mkdtempSync(join(tmpdir(), 'recette-roster-'))
  try {
    const fichier = await lieu.recevoirLeFichier(session, dossier, () => cliquerBouton(bouton(boutonDeLEntite(v, 'groupe.roster', carte.id, 'exporter'))))
    const exporte = JSON.parse(readFileSync(fichier, 'utf8'))
    assert.deepEqual([exporte.kind, exporte.hero.label, `roster/${exporte.hero.id}`], ['wfrp4-hero', nom, carte.id], 'le fichier est l’export de ce héros')
    noter(`« Exporter » : ${basename(fichier)} reçu`)
    await cliquerBouton(bouton(boutonDeLEntite(v, 'groupe.roster', carte.id, 'retirer')))
    await attendreLaVue(absent)
    await lieu.choisirLeFichier(session, fichier, async () => cliquerBouton(bouton(element(await vue(), 'groupe.import', 'importer'))))
    await attendreLaVue(`!(${absent})`)
    v = await vue()
    assert.deepEqual(zone(v, 'groupe.avis'), [], 'importé entier, rien à en dire')
    noter(`« Supprimer », puis « Importer un personnage… » sur ce fichier : ${nom} revient au roster`)
    await capturer('3009-roster-4-importe')
  } finally {
    rmSync(dossier, { recursive: true, force: true })
  }
  await cliquerBouton(bouton(boutonDeLEntite(v, 'groupe.roster', carte.id, 'retirer')))
  await attendreLaVue(absent)
  await recharger()
  v = await ouvrirAuGroupe()
  assert.equal(element(v, 'groupe.roster', carte.id), undefined, 'supprimé, il a quitté le roster, page rechargée comprise')
  noter(`« Supprimer » : ${nom} a quitté le roster`)
  await capturer('3009-roster-5-supprime')
}

/** Le bouton de la vue d'id `id` dans la zone `z` pressé à l'écran, puis la vue que le pont rend. */
async function presser(z, id) {
  const v = await vue()
  const b = element(v, z, id)
  assert.ok(b, `bouton ${id} dans ${z} : ${zone(v, z).map((e) => e.id).join(', ')}`)
  await cliquerBouton(bouton(b))
  return vue()
}
/** La racine du dépôt, d'où se lisent ses données. */
const racineDuDepot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

/** L'éditeur publié (`wfrpEcran.editeur`) : ses zones et sa surcouche. */
const editeur = async () => (await ecran()).editeur
/** Le bouton d'id `id` des zones de l'éditeur publié, posé seul ou parmi les valeurs d'un choix. */
const boutonDeLEditeur = (e, id) => Object.values(e.zones).flat().flatMap((el) => (el.type === 'bouton' ? [el] : el.valeurs ?? [])).find((b) => b.id === id)

/** Écrit au chemin `chemin` une planche PNG de `cote` pixels de côté : un fond clair quadrillé de sombre tous les
 *  `pas` pixels. */
function ecrirePlanche(chemin, cote = 400, pas = 40) {
  const rangees = Buffer.alloc(cote * (1 + cote * 3))
  for (let y = 0; y < cote; y++) {
    for (let x = 0; x < cote; x++) rangees.fill(x % pas < 2 || y % pas < 2 ? 40 : 225, y * (1 + cote * 3) + 1 + x * 3, y * (1 + cote * 3) + 4 + x * 3)
  }
  const bloc = (type, donnees) => {
    const tete = Buffer.alloc(8)
    tete.writeUInt32BE(donnees.length)
    tete.write(type, 4)
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(Buffer.concat([tete.subarray(4), donnees])))
    return Buffer.concat([tete, donnees, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(cote, 0)
  ihdr.writeUInt32BE(cote, 4)
  ihdr.set([8, 2, 0, 0, 0], 8)
  writeFileSync(chemin, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), bloc('IHDR', ihdr), bloc('IDAT', deflateSync(rangees)), bloc('IEND', Buffer.alloc(0))]))
}

async function parcoursEditeur() {
  await cliquerBouton('Éditeur')
  await waitFor(session, '!!globalThis.wfrpEcran?.editeur && !!wfrpEcran.cases', { timeoutMs: 120000 })
  /** Le pas d'un cran de molette sur le panneau, en pixels de défilement, relevé au premier cran qui n'en touche pas un
   *  bout : les crans suivants, tournés d'un geste, s'attendent jusqu'à la position qu'ils donnent. */
  let pasDuCran = null
  /** Le bouton, ou pour `sorte` `saisies` le champ, `quoi` du panneau d'outils, rendu tel que l'écran le publie : un
   *  bouton à l'écran l'est tel quel, sinon, comme un champ, il est amené au milieu du cadre du panneau par la molette
   *  sur le panneau : son point au défilement publié (`panneau`) dit les crans à tourner, d'un geste, jusqu'à ce qu'il
   *  tienne dans la moitié centrale du cadre ou que la course s'achève. */
  const amenerAuPanneau = async (quoi, sorte = 'boutons') => {
    for (let n = 0; ; n++) {
      const publie = await ecran()
      const { panneau } = publie
      const cible = trouver(panneau[sorte], quoi)
      assert.ok(cible, `${JSON.stringify(quoi)} au panneau ; ${sorte} : ${panneau[sorte].map((b) => b.element ?? b.texte).join(' | ')}`)
      const ecart = cible.y - (panneau.haut + panneau.bas) / 2
      const fin = Math.max(panneau.contenu - panneau.page, 0)
      const course = ecart < 0 ? panneau.valeur : fin - panneau.valeur
      const visible = trouver(publie[sorte], quoi)
      if (visible && (sorte === 'boutons' || Math.abs(ecart) <= (panneau.bas - panneau.haut) / 4 || course <= 0)) return visible
      assert.ok(n < 6 && course > 0, `${JSON.stringify(quoi)} amené par la molette au milieu du panneau : à ${Math.round(cible.y)} px, défilé de ${panneau.valeur} sur ${fin}`)
      const sens = Math.sign(ecart)
      if (!pasDuCran) {
        await molette(session, { surface: 'canvas', x: 160, y: 400 }, sens * CRAN_DE_MOLETTE)
        await waitFor(session, `globalThis.wfrpEcran?.panneau?.valeur !== ${panneau.valeur}`)
        const parcouru = Math.abs((await ecran()).panneau.valeur - panneau.valeur)
        if (parcouru < course) pasDuCran = parcouru
        continue
      }
      const crans = Math.max(1, Math.round(Math.min(Math.abs(ecart), course) / pasDuCran))
      const attendu = Math.min(Math.max(panneau.valeur + sens * crans * pasDuCran, 0), fin)
      await molette(session, { surface: 'canvas', x: 160, y: 400 }, sens * CRAN_DE_MOLETTE, { crans })
      await waitFor(session, `Math.abs(globalThis.wfrpEcran?.panneau?.valeur - ${attendu}) < 0.5`)
    }
  }
  const cliquerAuPanneau = async (quoi) => {
    await amenerAuPanneau(quoi)
    await cliquerBouton(quoi)
  }
  /** La valeur `id` de la liste déroulante `liste` des options de l'outil choisie : la liste amenée sur le panneau,
   *  cliquée, attendue ouverte, le pointeur sorti d'elle ; son article désigné au clavier (`designerALaListe`), puis
   *  Entrée ; l'écran attendu ensuite : la valeur pressée, sinon la condition `attendu`. */
  const choisirALaListe = async (liste, id, zone = 'editeur.options', attendu = null) => {
    const valeurs = (await editeur()).zones[zone].find((el) => el.id === liste).valeurs
    const libelle = valeurs.find((b) => b.id === id).libelle
    const fait = attendu ?? `globalThis.wfrpEcran?.editeur?.zones['${zone}'].find((el) => el.id === '${liste}')?.valeurs.find((b) => b.id === '${id}')?.presse === true`
    const quoi = { element: `liste/${liste}` }
    const deroulante = await amenerAuPanneau(quoi)
    const rang = deroulante.choix.indexOf(libelle)
    assert.ok(rang >= 0, `${libelle} est offert : ${deroulante.choix.join(', ')}`)
    await geste(session, { surface: 'canvas', x: deroulante.x, y: deroulante.y }, { qui: `liste ${liste}` }, clic())
    await attendreLaListe(quoi, (l) => l.ouverte, 'est ouverte au clic')
    await geste(session, { surface: 'canvas', x: 1000, y: 700 }, { qui: `le pointeur hors de la liste ${liste}` }, ({ x, y }, emettre) => emettre('souris', { type: 'mouseMoved', x, y }))
    await designerALaListe(quoi, rang)
    await marquer()
    await realKey(session, { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
    await waitFor(session, fait)
  }
  /** Tape `texte` dans la saisie d'élément `element` (`amenerAuPanneau`), à la place du sien. */
  const taper = async (element, texte) => {
    const c = await amenerAuPanneau({ element }, 'saisies')
    await geste(session, { surface: 'canvas', x: c.x, y: c.y }, { qui: element }, clic())
    await realKey(session, { key: 'End', code: 'End', windowsVirtualKeyCode: 35 })
    for (let n = 0; n < c.texte.length; n++) await realKey(session, { key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 })
    for (const lettre of texte) await realKey(session, { key: lettre, code: `Key${lettre.toUpperCase()}`, windowsVirtualKeyCode: lettre.toUpperCase().charCodeAt(0) })
    await waitFor(session, `globalThis.wfrpEcran?.saisies.find((x) => x.element === '${element}')?.texte === ${JSON.stringify(texte)}`)
  }
  const inspecte = (e, id) => e.zones['editeur.inspecteur'].find((el) => el.id === id)
  /** L'inspecteur publié montre-t-il l'élément d'id `id` ? */
  const montre = (id) => `(globalThis.wfrpEcran?.editeur?.zones['editeur.inspecteur'] ?? []).some((l) => l.id === '${id}')`
  /** La valeur du champ `id` de l'inspecteur dont la valeur jouée satisfait `voulue`, choisie en liste ou au clic,
   *  jusqu'à l'état `attendu`. */
  const choisirAuChamp = async (id, voulue, attendu) => {
    const champ = inspecte(await editeur(), id)
    const valeur = champ.valeurs.find((b) => voulue(b.jeu.args[2]))
    if (champ.type === 'liste') await choisirALaListe(id, valeur.id, 'editeur.inspecteur', attendu)
    else await cliquerAuPanneau({ element: `bouton/${valeur.id}` })
    await waitFor(session, attendu, { timeoutMs: 30000 })
  }
  /** Le plan de la zone `editeur.carte` de l'éditeur publié `ed`. */
  const planDeLaCarte = (ed) => ed.zones['editeur.carte'][0]
  /** Le point du plan choisi (`alerte`) de l'éditeur publié `ed`. */
  const pointChoisi = (ed) => planDeLaCarte(ed).points.find((pt) => pt.ton === 'alerte')
  /** Le point de l'écran du point (`u`, `v`) du cadre du plan, au cadre publié de l'éditeur `ed` (`editeur.plan`). */
  const auPlan = (ed, [u, v]) => [ed.plan.x + u * ed.plan.largeur, ed.plan.y + v * ed.plan.hauteur]
  /** L'expression de la page vraie quand le point `id` du plan publié est au point (`u`, `v`) du cadre, au centième près. */
  const pointEn = (id, [u, v]) => `(globalThis.wfrpEcran?.editeur?.zones['editeur.carte'][0]?.points ?? []).some((pt) => pt.id === ${JSON.stringify(id)} && Math.abs(pt.x - ${u}) < 0.01 && Math.abs(pt.y - ${v}) < 0.01)`
  /** Le point du cadre du plan de `ed`, parmi une grille du cadre, le plus loin à l'écran de chaque point et de chaque
   *  trait du plan. */
  const auLarge = (ed) => {
    const plan = planDeLaCarte(ed)
    const places = Object.fromEntries(plan.points.map((pt) => [pt.id, auPlan(ed, [pt.x, pt.y])]))
    const auTrait = ([ax, ay], [bx, by], [cx, cy]) => {
      const l2 = (bx - ax) ** 2 + (by - ay) ** 2
      const t = l2 ? Math.max(0, Math.min(1, ((cx - ax) * (bx - ax) + (cy - ay) * (by - ay)) / l2)) : 0
      return Math.hypot(ax + t * (bx - ax) - cx, ay + t * (by - ay) - cy)
    }
    const ecart = (c) => Math.min(...Object.values(places).map(([x, y]) => Math.hypot(x - c[0], y - c[1])), ...plan.traits.map((tr) => auTrait(places[tr.de], places[tr.vers], c)))
    const grille = Array.from({ length: 17 * 17 }, (_, i) => [0.1 + 0.05 * (i % 17), 0.1 + 0.05 * Math.floor(i / 17)])
    return grille.reduce((loin, c) => (ecart(auPlan(ed, c)) > ecart(auPlan(ed, loin)) ? c : loin))
  }
  /** Le pointeur tenu sur le plan de `ed` du point `de` du cadre au point `a`, par deux points entre eux, puis relâché. */
  const glisserSurLePlan = async (ed, de, a, qui) => {
    const [x0, y0] = auPlan(ed, de)
    const [x1, y1] = auPlan(ed, a)
    await geste(session, { surface: 'canvas', x: x0, y: y0 }, { qui }, async ({ x, y }, emettre) => {
      await emettre('souris', { type: 'mouseMoved', x, y })
      await emettre('souris', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 })
      await sleep(200)
      for (const t of [1 / 3, 2 / 3, 1]) {
        await emettre('souris', { type: 'mouseMoved', x: x0 + t * (x1 - x0), y: y0 + t * (y1 - y0), button: 'left', buttons: 1 })
        await sleep(300)
      }
      await emettre('souris', { type: 'mouseReleased', x: x1, y: y1, button: 'left', clickCount: 1 })
    })
  }
  /** Le plan de la carte sans ses tons : ses lieux, chacun à sa place et nommé, et ses routes. */
  const formeDuPlan = (ed) => JSON.stringify([planDeLaCarte(ed).id, planDeLaCarte(ed).points.map((pt) => [pt.id, pt.nom, pt.x, pt.y]), planDeLaCarte(ed).traits.map((tr) => [tr.id, tr.de, tr.vers])])
  /** Le retrait d'un axe actif offert à l'inspecteur de l'éditeur publié `ed`, s'il y en a un. */
  const axeARetirer = (ed) => ed.zones['editeur.inspecteur'].find((el) => el.type === 'bouton' && /^valeur\/activeAxes\/.+\/retirer$/.test(el.id))
  /** La saisie de texte publiée au panneau dont l'élément contient `morceau`. */
  const saisieDu = async (morceau) => (await ecran()).panneau.saisies.find((x) => x.element?.includes(morceau))
  /** Le menu Fichier ouvre la carte du monde : son plan publié, son cadre à l'écran. */
  const ouvrirLaCarte = async () => {
    await cliquerAuPanneau({ element: 'bouton/document/carte' })
    await waitFor(session, `globalThis.wfrpEcran?.editeur?.zones['editeur.carte'][0]?.id === 'carte/plan' && !!wfrpEcran.editeur.plan`)
    return editeur()
  }
  /** Le menu Fichier rend la scène éditée, la carte refermée. */
  const revenirALaScene = async () => {
    await cliquerAuPanneau({ element: 'bouton/document/scene' })
    await waitFor(session, `globalThis.wfrpEcran?.editeur?.zones['editeur.carte'].length === 0 && wfrpEcran.editeur.plan === null`)
  }
  /** La carte du monde (#3606 M5) : ouverte au menu Fichier, un lieu posé au pointeur, un second par « Ajouter un lieu »,
   *  le premier glissé puis ramené d'une annulation, les deux reliés au pointeur, la route choisie et orientée, un champ
   *  du lieu et un de la route écrits, un point d'intérêt épinglé au plan du lieu puis retiré, un axe actif coché ;
   *  « Annuler » jusqu'au plan d'avant, puis la scène rendue. */
  const etapeDeLaCarte = async () => {
    const titre = (await editeur()).zones['editeur.titre'][0].texte
    let ed = await ouvrirLaCarte()
    const avant = formeDuPlan(ed)
    const { points, traits } = planDeLaCarte(ed)
    noter(`menu Fichier, « ${boutonDeLEditeur(ed, 'document/carte').libelle} » : ${planDeLaCarte(ed).id}, ${points.length} lieux, ${traits.length} routes, cadre ${Math.round(ed.plan.largeur)} × ${Math.round(ed.plan.hauteur)} px à (${Math.round(ed.plan.x)}, ${Math.round(ed.plan.y)})`)
    await cliquerAuPanneau({ element: 'bouton/outil/lieu' })
    const ici = auLarge(ed)
    await cliquerPoint(...auPlan(ed, ici))
    await waitFor(session, `globalThis.wfrpEcran?.editeur?.zones['editeur.carte'][0]?.points.length === ${points.length + 1}`)
    ed = await editeur()
    const premier = pointChoisi(ed)
    assert.ok(premier && !points.some((pt) => pt.id === premier.id) && Math.abs(premier.x - ici[0]) < 0.01 && Math.abs(premier.y - ici[1]) < 0.01, `l’outil Lieu pose un lieu, choisi, au point cliqué (${ici}) : ${JSON.stringify(premier)}`)
    await cliquerAuPanneau({ element: 'bouton/logique/lieu/ajouter' })
    await waitFor(session, `globalThis.wfrpEcran?.editeur?.zones['editeur.carte'][0]?.points.length === ${points.length + 2}`)
    ed = await editeur()
    const second = pointChoisi(ed)
    assert.ok(second && second.id !== premier.id, `« Ajouter un lieu » pose un second lieu, choisi : ${JSON.stringify(second)}`)
    noter(`outil Lieu, un clic au point (${ici.map((c) => c.toFixed(2))}) du plan : ${premier.nom} ; « Ajouter un lieu » : ${second.nom} à (${second.x.toFixed(2)}, ${second.y.toFixed(2)})`)
    await cliquerAuPanneau({ element: 'bouton/outil/select' })
    const vers = auLarge(ed)
    await glisserSurLePlan(ed, [premier.x, premier.y], vers, `le lieu ${premier.id} glissé`)
    await waitFor(session, pointEn(premier.id, vers))
    await cliquerAuPanneau({ element: 'bouton/annuler' })
    await waitFor(session, pointEn(premier.id, [premier.x, premier.y]))
    noter(`outil Sélection, ${premier.nom} glissé de (${premier.x.toFixed(2)}, ${premier.y.toFixed(2)}) à (${vers.map((c) => c.toFixed(2))}) ; « Annuler » une fois : rendu à sa place`)
    await cliquerAuPanneau({ element: 'bouton/outil/chemin' })
    ed = await editeur()
    await glisserSurLePlan(ed, [premier.x, premier.y], [second.x, second.y], 'la route tirée')
    await waitFor(session, `(globalThis.wfrpEcran?.editeur?.zones['editeur.carte'][0]?.traits ?? []).length === ${traits.length + 1}`)
    ed = await editeur()
    const route = planDeLaCarte(ed).traits.find((tr) => [tr.de, tr.vers].sort().join() === [premier.id, second.id].sort().join())
    assert.ok(route, `outil Chemin, la route tirée relie les deux lieux : ${JSON.stringify(planDeLaCarte(ed).traits)}`)
    await cliquerAuPanneau({ element: 'bouton/outil/select' })
    await cliquerPoint(...auPlan(ed, [(premier.x + second.x) / 2, (premier.y + second.y) / 2]))
    await waitFor(session, `${montre('route/sens')} && globalThis.wfrpEcran.editeur.zones['editeur.carte'][0].traits.find((tr) => tr.id === '${route.id}')?.ton === 'reussite'`)
    await capturer('3606-m5-3-selection-route')
    await cliquerAuPanneau({ element: `bouton/route/sens/${second.id}` })
    await waitFor(session, `globalThis.wfrpEcran?.editeur?.zones['editeur.inspecteur'].find((el) => el.id === 'route/sens')?.valeurs.find((b) => b.presse)?.id === 'route/sens/${second.id}'`)
    await cliquerAuPanneau({ element: 'bouton/valeur/refus/ajouter' })
    await waitFor(session, montre('valeur/refus/texte'))
    const refus = await saisieDu('/valeur/refus/texte/')
    assert.ok(refus, 'le texte du refus de la route, à son formulaire')
    await taper(refus.element, 'Pont rompu')
    await cliquerAuPanneau({ element: 'formulaire/valeur/refus/texte' })
    await waitFor(session, `globalThis.wfrpEcran?.editeur?.zones['editeur.inspecteur'].find((el) => el.id === 'valeur/refus/texte')?.champs.some((c) => c.valeur === 'Pont rompu')`)
    ed = await editeur()
    noter(`outil Chemin, ${premier.nom} tiré jusqu’à ${second.nom} : la route ${route.id} ; outil Sélection, un clic sur elle, « ${inspecte(ed, 'route/sens').valeurs.find((b) => b.presse).libelle} », son refus écrit au formulaire : « Pont rompu »`)
    await cliquerPoint(...auPlan(ed, [premier.x, premier.y]))
    await waitFor(session, montre('lieu/plan'))
    await taper('saisieTexte/valeur/label/valeur', 'Bourg')
    await cliquerAuPanneau({ element: 'formulaire/valeur/label' })
    await waitFor(session, `(globalThis.wfrpEcran?.editeur?.zones['editeur.carte'][0]?.points ?? []).some((pt) => pt.id === '${premier.id}' && pt.nom === 'Bourg')`)
    noter(`un clic sur ${premier.nom}, son libellé écrit au formulaire : « Bourg », au plan`)
    await capturer('3606-m5-3-selection')
    await cliquerAuPanneau({ element: 'bouton/lieu/plan' })
    await waitFor(session, `globalThis.wfrpEcran?.editeur?.zones['editeur.carte'][0]?.id === 'lieu/plan'`)
    ed = await editeur()
    const poiAvant = planDeLaCarte(ed).points.length
    await cliquerAuPanneau({ element: 'bouton/outil/epingler' })
    const epingle = auLarge(ed)
    await cliquerPoint(...auPlan(ed, epingle))
    await waitFor(session, `globalThis.wfrpEcran?.editeur?.zones['editeur.carte'][0]?.points.length === ${poiAvant + 1}`)
    ed = await editeur()
    const poi = pointChoisi(ed)
    assert.ok(poi && Math.abs(poi.x - epingle[0]) < 0.01 && Math.abs(poi.y - epingle[1]) < 0.01, `l’outil Épingler pose un point d’intérêt, choisi, au point cliqué (${epingle}) : ${JSON.stringify(poi)}`)
    await cliquerAuPanneau({ element: 'bouton/lieu/poi/retirer' })
    await waitFor(session, `globalThis.wfrpEcran?.editeur?.zones['editeur.carte'][0]?.points.length === ${poiAvant}`)
    noter(`« Plan du lieu » : ${poiAvant} point(s) d’intérêt ; outil Épingler, un clic au point (${epingle.map((c) => c.toFixed(2))}) : ${poi.nom} ; « Retirer le point d’intérêt » : ${poiAvant} point(s)`)
    await cliquerAuPanneau({ element: 'bouton/annuler' })
    await waitFor(session, `globalThis.wfrpEcran?.editeur?.zones['editeur.carte'][0]?.points.length === ${poiAvant + 1}`)
    ed = await editeur()
    const libelleInspecte = inspecte(ed, 'valeur/label')?.champs.find((c) => c.valeur === 'Bourg')?.valeur
    assert.ok(planDeLaCarte(ed).id === 'lieu/plan' && boutonDeLEditeur(ed, 'lieu/plan')?.presse === true && libelleInspecte === 'Bourg', `« Annuler » au plan du lieu le garde ouvert, son lieu à l’inspecteur : plan ${planDeLaCarte(ed).id}, « ${boutonDeLEditeur(ed, 'lieu/plan')?.libelle} » pressé : ${boutonDeLEditeur(ed, 'lieu/plan')?.presse}, libellé inspecté : ${libelleInspecte}`)
    noter(`« Annuler » au plan du lieu : le plan ${planDeLaCarte(ed).id}, ${planDeLaCarte(ed).points.length} point(s), l’inspecteur du lieu « ${libelleInspecte} », « ${boutonDeLEditeur(ed, 'lieu/plan').libelle} » pressé`)
    await capturer('3606-m5-2-annuler-au-plan-du-lieu')
    await cliquerAuPanneau({ element: 'bouton/lieu/plan' })
    await waitFor(session, `globalThis.wfrpEcran?.editeur?.zones['editeur.carte'][0]?.id === 'carte/plan'`)
    ed = await editeur()
    await cliquerPoint(...auPlan(ed, auLarge(ed)))
    await waitFor(session, montre('valeur/activeAxes/ajouter'))
    ed = await editeur()
    const axes = inspecte(ed, 'valeur/activeAxes/ajouter')
    const [axe] = axes.valeurs.filter((b) => b.refus === null)
    if (axes.type === 'liste') await choisirALaListe(axes.id, axe.id, 'editeur.inspecteur', `(globalThis.wfrpEcran?.editeur?.zones['editeur.inspecteur'] ?? []).some((el) => /^valeur\\/activeAxes\\/.+\\/retirer$/.test(el.id))`)
    else await cliquerAuPanneau({ element: `bouton/${axe.id}` })
    await waitFor(session, `(globalThis.wfrpEcran?.editeur?.zones['editeur.inspecteur'] ?? []).some((el) => /^valeur\\/activeAxes\\/.+\\/retirer$/.test(el.id))`)
    noter(`un clic au large sur la carte, sans sélection : « ${axes.libelle} » « ${axe.libelle} » coché`)
    let annulations = 0
    for (ed = await editeur(); formeDuPlan(ed) !== avant || axeARetirer(ed); ed = await editeur()) {
      assert.ok(annulations < 20, `« Annuler » rend la carte d’avant en moins de 20 fois : ${formeDuPlan(ed)}`)
      await cliquerAuPanneau({ element: 'bouton/annuler' })
      annulations++
    }
    noter(`« Annuler » ${annulations} fois : la carte rendue, ${planDeLaCarte(ed).points.length} lieux, ${planDeLaCarte(ed).traits.length} routes, sans axe actif`)
    await capturer('3606-m5-1-carte')
    await revenirALaScene()
    assert.equal((await editeur()).zones['editeur.titre'][0].texte, titre, 'le menu Fichier rend la scène éditée')
    noter(`menu Fichier, « ${boutonDeLEditeur(await editeur(), 'document/scene').libelle} » : ${titre}`)
  }
  /** Une rencontre que lance l'embuscade d'une route (#3606 M4c) : ajoutée à la scène éditée, visée par l'embuscade de
   *  la première route de la carte, renommée à la zone Logique ; « Supprimer » refusé, la route dite ; « Annuler »
   *  jusqu'à la scène sans rencontre. */
  const etapeDeLEmbuscade = async () => {
    await cliquerAuPanneau({ element: 'bouton/logique/rencontre/ajouter' })
    await waitFor(session, montre('rencontre/membres'))
    let ed = await editeur()
    const visee = inspecte(ed, 'nommer').champs[0].valeur
    const sceneVisee = ed.zones['editeur.scenes'].find((el) => el.id === 'scenes').valeurs.find((b) => b.presse).id.slice('scenes/'.length)
    ed = await ouvrirLaCarte()
    const routeVisee = ed.zones['editeur.logique'].find((el) => el.id === 'logique/route/liste').valeurs[0]
    await choisirALaListe('logique/route/liste', routeVisee.id, 'editeur.logique', montre('route/sens'))
    await cliquerAuPanneau({ element: 'bouton/valeur/ambush/ajouter' })
    await waitFor(session, `(globalThis.wfrpEcran?.editeur?.zones['editeur.inspecteur'] ?? []).some((el) => el.id.startsWith('valeur/ambush/'))`)
    const routeId = routeVisee.id.slice('logique/route/'.length)
    /** L'expression de la page vraie quand la valeur pressée du champ `id` de l'inspecteur joue `valeur`. */
    const presseeA = (id, valeur) => `globalThis.wfrpEcran?.editeur?.zones['editeur.inspecteur'].find((el) => el.id === '${id}')?.valeurs.find((b) => b.presse)?.jeu.args[2] === ${JSON.stringify(valeur)}`
    await choisirAuChamp('valeur/ambush/scene/id', (v) => v === sceneVisee, presseeA('valeur/ambush/scene/id', sceneVisee))
    await choisirAuChamp('valeur/ambush/encounter', (v) => v === visee, presseeA('valeur/ambush/encounter', visee))
    noter(`« Ajouter une rencontre » : « ${visee} » ; menu Fichier, « Carte du monde », la route ${routeId} choisie à la zone Logique, « Ajouter : embuscade » : sa scène ${sceneVisee}, sa rencontre « ${visee} »`)
    await revenirALaScene()
    /** L'expression de la page vraie quand la zone Logique liste la rencontre `id`. */
    const rencontreALaListe = (id) => `(globalThis.wfrpEcran?.editeur?.zones['editeur.logique'].find((el) => el.id === 'logique/rencontre/liste')?.valeurs ?? []).some((b) => b.id === 'logique/rencontre/${id}')`
    await choisirALaListe('logique/rencontre/liste', `logique/rencontre/${visee}`, 'editeur.logique', montre('rencontre/membres'))
    await taper('saisieTexte/nommer/nom', 'embuscade')
    await cliquerAuPanneau({ element: 'formulaire/nommer' })
    await waitFor(session, `${rencontreALaListe('embuscade')} && !${rencontreALaListe(visee)}`)
    ed = await editeur()
    const refus = boutonDeLEditeur(ed, 'rencontre/supprimer')?.refus
    assert.ok(refus?.includes(routeId), `« Supprimer » refusé tant que l’embuscade de ${routeId} lance la rencontre, la route dite : ${refus}`)
    noter(`menu Fichier, « Scène », « ${visee} » choisie à la zone Logique, renommée « embuscade » : ${ed.zones['editeur.logique'].find((el) => el.id === 'logique/rencontre').texte} ; « Supprimer » refusé : ${refus}`)
    let annulations = 0
    while (String(await lire(`${rencontreALaListe('embuscade')} || ${rencontreALaListe(visee)}`)) === 'true') {
      assert.ok(annulations < 10, '« Annuler » retire la rencontre en moins de 10 fois')
      await cliquerAuPanneau({ element: 'bouton/annuler' })
      annulations++
    }
    if (boutonDeLEditeur(await editeur(), 'document/carte')?.presse) await revenirALaScene()
    ed = await editeur()
    noter(`« Annuler » ${annulations} fois : ${ed.zones['editeur.logique'].find((el) => el.id === 'logique/rencontre').texte}, ${ed.zones['editeur.titre'][0].texte} éditée`)
  }
  /** Les identifiants que la zone Logique de l'éditeur publié `ed` liste pour la sorte `sorte`. */
  const listeDe = (ed, sorte) => (ed.zones['editeur.logique'].find((el) => el.id === `logique/${sorte}/liste`)?.valeurs ?? []).map((b) => b.id.slice(`logique/${sorte}/`.length))
  /** L'expression de la page vraie quand la zone Logique liste `n` porteurs de la sorte `sorte`. */
  const listeLongue = (sorte, n) => `(globalThis.wfrpEcran?.editeur?.zones['editeur.logique'].find((el) => el.id === 'logique/${sorte}/liste')?.valeurs ?? []).length === ${n}`
  /** Le narratif tel que l'auteur le voit sans sélection : les comptes de la zone Logique et le titre de l'ouverture. */
  const narratifVu = (ed) => JSON.stringify([ed.zones['editeur.logique'].filter((el) => el.type === 'ligne').map((el) => el.texte), inspecte(ed, 'valeur/ouverture/titre')?.champs.map((c) => c.valeur) ?? null])
  /** Le narratif (#3606 M6) : ouvert au menu Fichier, son ouverture à l'inspecteur ; « Ajouter un indice » refusé
   *  sans affaire, dit ; une affaire ajoutée, son titre écrit ; un indice, un stade ajouté, identifié, le premier retiré,
   *  le dernier refusé, dit ; un état, sa forme changée ; un écart par la liste des entrées libres ; « Annuler » jusqu'au
   *  narratif d'avant ; la scène rendue. */
  const etapeDuNarratif = async () => {
    const titre = (await editeur()).zones['editeur.titre'][0].texte
    await cliquerAuPanneau({ element: 'bouton/document/narratif' })
    await waitFor(session, `(globalThis.wfrpEcran?.editeur?.zones['editeur.logique'] ?? []).some((el) => el.id === 'logique/affaires') && ${montre('valeur/ouverture/retirer')}`)
    let ed = await editeur()
    const avant = narratifVu(ed)
    noter(`menu Fichier, « ${boutonDeLEditeur(ed, 'document/narratif').libelle} » : ${ed.zones['editeur.logique'].filter((el) => el.type === 'ligne').map((el) => el.texte).join(', ')}`)
    const affaires = listeDe(ed, 'affaires')
    const refusDeLIndice = boutonDeLEditeur(ed, 'logique/indices/ajouter').refus
    assert.equal(refusDeLIndice, affaires.length ? null : 'Créez d’abord une affaire.', `« Ajouter un indice » refusé sans affaire, et seulement sans elle (${affaires.length} affaire(s)) : ${refusDeLIndice}`)
    await cliquerAuPanneau({ element: 'bouton/logique/affaires/ajouter' })
    await waitFor(session, listeLongue('affaires', affaires.length + 1))
    ed = await editeur()
    const affaire = listeDe(ed, 'affaires').find((id) => !affaires.includes(id))
    assert.equal(inspecte(ed, 'nommer')?.champs[0].valeur, affaire, `l’affaire ajoutée est choisie, à son nom : ${affaire}`)
    await taper('saisieTexte/valeur/titre/valeur', 'Heritage')
    await cliquerAuPanneau({ element: 'formulaire/valeur/titre' })
    await waitFor(session, `(globalThis.wfrpEcran?.editeur?.zones['editeur.inspecteur'].find((el) => el.id === 'valeur/titre')?.champs ?? []).some((c) => c.valeur === 'Heritage')`)
    ed = await editeur()
    assert.equal(boutonDeLEditeur(ed, 'logique/indices/ajouter').refus, null, '« Ajouter un indice » offert, une affaire au narratif')
    noter(`« Ajouter un indice » sans affaire : ${refusDeLIndice ?? `offert, ${affaires.length} affaire(s) au narratif`} ; « ${boutonDeLEditeur(ed, 'logique/affaires/ajouter').libelle} » : ${affaire}, son titre écrit : « Heritage »`)
    await capturer('3606-m6-2-affaire')
    const indices = listeDe(ed, 'indices')
    await cliquerAuPanneau({ element: 'bouton/logique/indices/ajouter' })
    await waitFor(session, `${listeLongue('indices', indices.length + 1)} && ${montre('stade/ajouter')}`)
    await cliquerAuPanneau({ element: 'bouton/stade/ajouter' })
    await waitFor(session, montre('identifier/stade/stade-2'))
    await taper('saisieTexte/identifier/stade/stade-2/id', 'releve')
    await cliquerAuPanneau({ element: 'formulaire/identifier/stade/stade-2' })
    await waitFor(session, `${montre('identifier/stade/releve')} && !${montre('identifier/stade/stade-2')}`)
    await cliquerAuPanneau({ element: 'bouton/stade/stade-1/supprimer' })
    await waitFor(session, `!${montre('identifier/stade/stade-1')}`)
    ed = await editeur()
    const dernier = boutonDeLEditeur(ed, 'stade/releve/supprimer')?.refus
    assert.equal(dernier, 'Un indice garde au moins un stade.', `le dernier stade ne se retire pas, dit : ${dernier}`)
    noter(`« Ajouter un indice » : ${listeDe(ed, 'indices').find((id) => !indices.includes(id))} ; « ${boutonDeLEditeur(ed, 'stade/ajouter').libelle} » : stade-2, identifié « releve » ; « Supprimer le stade » stade-1 ; le dernier refusé : ${dernier}`)
    await capturer('3606-m6-3-stades')
    await cliquerAuPanneau({ element: 'bouton/logique/etats/ajouter' })
    await waitFor(session, `globalThis.wfrpEcran?.editeur?.zones['editeur.inspecteur'].find((el) => el.id === 'etat/forme')?.valeurs.find((b) => b.presse)?.id === 'etat/forme/heros'`)
    await cliquerAuPanneau({ element: 'bouton/etat/forme/enum' })
    await waitFor(session, `globalThis.wfrpEcran?.editeur?.zones['editeur.inspecteur'].find((el) => el.id === 'etat/forme')?.valeurs.find((b) => b.presse)?.id === 'etat/forme/enum' && ${montre('identifier/valeur/valeur-1')}`)
    ed = await editeur()
    noter(`« ${boutonDeLEditeur(ed, 'logique/etats/ajouter').libelle} » : forme « ${boutonDeLEditeur(ed, 'etat/forme/heros').libelle} » ; « ${boutonDeLEditeur(ed, 'etat/forme/enum').libelle} » pressé : sa valeur neuve valeur-1 à l’inspecteur`)
    await capturer('3606-m6-4-forme')
    const ecarts = listeDe(ed, 'ecart')
    const [entree] = ed.zones['editeur.logique'].find((el) => el.id === 'logique/ecart/ajouter').valeurs
    await choisirALaListe('logique/ecart/ajouter', entree.id, 'editeur.logique', listeLongue('ecart', ecarts.length + 1))
    ed = await editeur()
    const ecarte = listeDe(ed, 'ecart').find((id) => !ecarts.includes(id))
    assert.ok(ecarte === entree.id.slice('logique/ecart/ajouter/'.length) && boutonDeLEditeur(ed, `logique/ecart/${ecarte}`)?.presse && !boutonDeLEditeur(ed, entree.id), `l’entrée choisie à la liste est écartée, choisie, et ne s’offre plus : ${ecarte}`)
    noter(`« ${ed.zones['editeur.logique'].find((el) => el.id === 'logique/ecart/ajouter')?.libelle} », « ${entree.libelle} » choisie à la liste : ${ed.zones['editeur.logique'].find((el) => el.id === 'logique/ecart').texte}`)
    await capturer('3606-m6-5-ecart')
    let annulations = 0
    for (ed = await editeur(); narratifVu(ed) !== avant; ed = await editeur()) {
      assert.ok(annulations < 20, `« Annuler » rend le narratif d’avant en moins de 20 fois : ${narratifVu(ed)}`)
      await cliquerAuPanneau({ element: 'bouton/annuler' })
      annulations++
    }
    noter(`« Annuler » ${annulations} fois : ${ed.zones['editeur.logique'].filter((el) => el.type === 'ligne').map((el) => el.texte).join(', ')}`)
    await cliquerAuPanneau({ element: 'bouton/document/scene' })
    await waitFor(session, `globalThis.wfrpEcran?.editeur?.zones['editeur.titre'][0]?.texte === ${JSON.stringify(titre)}`)
    noter(`menu Fichier, « ${boutonDeLEditeur(await editeur(), 'document/scene').libelle} » : ${titre}`)
  }
  let e = await editeur()
  assert.equal(boutonDeLEditeur(e, 'couche/0')?.presse, true, 'la carte s’ouvre sur sa couche 0')
  assert.equal(boutonDeLEditeur(e, 'enregistrer')?.refus, 'Rien à enregistrer', 'la carte s’ouvre telle que le dépôt la sert')
  noter(`éditeur ouvert : ${e.zones['editeur.titre'][0].texte}, couches ${e.zones['editeur.couches'][0].valeurs.map((b) => b.libelle).join(', ')}`)
  await capturer('3508-l1-1-ouverte')
  const nord = () => e.zones['editeur.inspecteur'].find((l) => l.id === 'scene/nord')?.texte
  assert.equal(nord(), 'Nord : vers le haut du plan', 'sans sélection, l’inspecteur est celui de la scène')
  await cliquerAuPanneau({ element: 'bouton/scene/nord/plus' })
  await waitFor(session, `globalThis.wfrpEcran?.editeur?.zones['editeur.inspecteur'].find((l) => l.id === 'scene/nord')?.texte === 'Nord : 15° dans le sens horaire'`)
  e = await editeur()
  noter(`inspecteur de la scène, « +15° » : ${nord()}`)
  await capturer('3508-l6-1-scene')
  await cliquerAuPanneau({ element: 'bouton/annuler' })
  await waitFor(session, `globalThis.wfrpEcran?.editeur?.zones['editeur.inspecteur'].find((l) => l.id === 'scene/nord')?.texte === 'Nord : vers le haut du plan'`)
  noter('« Annuler » : le nord rendu au haut du plan')
  const message = 'Au relais\nEn route'
  const formulaireDuMessage = `globalThis.wfrpEcran?.editeur?.zones['editeur.inspecteur'].find((l) => l.id === 'valeur/startMessage/texte')`
  assert.equal(boutonDeLEditeur(await editeur(), 'valeur/startMessage/ajouter')?.libelle, 'Ajouter : message de départ', 'la Diligence n’a pas de message de départ')
  await cliquerAuPanneau({ element: 'bouton/valeur/startMessage/ajouter' })
  await waitFor(session, `${formulaireDuMessage} !== undefined`)
  const champMessage = await amenerAuPanneau({ element: 'saisieMultiligne/valeur/startMessage/texte/valeur' }, 'saisies')
  assert.equal(champMessage.texte, '', 'le message de départ ajouté, vide')
  await geste(session, { surface: 'canvas', x: champMessage.x, y: champMessage.y }, { qui: 'le champ du message de départ' }, clic())
  for (const lettre of message) {
    await realKey(session, lettre === '\n' ? { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 }
      : lettre === ' ' ? { key: ' ', code: 'Space', windowsVirtualKeyCode: 32 }
        : { key: lettre, code: `Key${lettre.toUpperCase()}`, windowsVirtualKeyCode: lettre.toUpperCase().charCodeAt(0) })
  }
  await waitFor(session, `globalThis.wfrpEcran?.saisies.find((x) => x.element === 'saisieMultiligne/valeur/startMessage/texte/valeur')?.texte === ${JSON.stringify(message)}`)
  await cliquerAuPanneau({ element: 'formulaire/valeur/startMessage/texte' })
  const valeurDuMessage = `${formulaireDuMessage}?.champs[2].valeur`
  await waitFor(session, `${valeurDuMessage} === ${JSON.stringify(message)}`)
  noter(`inspecteur de la scène, le message de départ tapé sur deux lignes au formulaire de la scène, « ${(await editeur()).zones['editeur.inspecteur'].find((l) => l.id === 'valeur/startMessage/texte').champs[2].libelle} » : ${JSON.stringify(message)}`)
  await capturer('3606-m0c-1-message-de-depart')
  await cliquerAuPanneau({ element: 'bouton/annuler' })
  await waitFor(session, `${valeurDuMessage} === ''`)
  await cliquerAuPanneau({ element: 'bouton/annuler' })
  await waitFor(session, `${formulaireDuMessage} === undefined`)
  noter('« Annuler » deux fois : la scène rendue sans message de départ')
  e = await editeur()
  for (const id of ['outil/height', 'hauteur/haute', 'pinceau/3']) {
    await cliquerAuPanneau({ element: `bouton/${id}` })
    assert.equal(boutonDeLEditeur(await editeur(), id)?.presse, true, `${id} choisi à son bouton`)
  }
  const cases = (await ecran()).cases
  const aLEcran = ([x, y]) => x > 360 && x < 1240 && y > 40 && y < 680
  const depart = Object.keys(cases).map((k) => k.split(',').map(Number)).find(([x, y]) => [0, 1, 2].every((d) => cases[`${x + d},${y}`] && aLEcran(cases[`${x + d},${y}`])) && x > 1 && y > 1)
  assert.ok(depart, 'trois cases voisines à l’écran, hors du panneau')
  const [x0, y0] = depart
  const avant = cases[`${x0 + 2},${y0}`]
  const [px, py] = cases[`${x0},${y0}`]
  let tenu = null
  await geste(session, { surface: 'canvas', x: px, y: py }, { qui: `glissé depuis la case ${x0},${y0}` }, async ({ x, y }, emettre) => {
    await emettre('souris', { type: 'mouseMoved', x, y })
    await emettre('souris', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 })
    for (const d of [1, 2]) {
      const [cx, cy] = cases[`${x0 + d},${y0}`]
      await marquer()
      await emettre('souris', { type: 'mouseMoved', x: cx, y: cy, button: 'left', buttons: 1 })
      await nouvelEcran()
    }
    await waitFor(session, `globalThis.wfrpEcran?.editeur?.surcouche.cases.length === ${EMPRISE_DU_GLISSE}`)
    tenu = { surcouche: (await editeur()).surcouche, point: (await ecran()).cases[`${x0 + 2},${y0}`] }
    const [fx, fy] = cases[`${x0 + 2},${y0}`]
    await emettre('souris', { type: 'mouseReleased', x: fx, y: fy, button: 'left', clickCount: 1 })
  })
  assert.equal(tenu.surcouche.cases.length, EMPRISE_DU_GLISSE, `bouton tenu, la surcouche couvre l’emprise 3×3 sur trois cases : ${JSON.stringify(tenu.surcouche.cases)}`)
  assert.deepEqual(tenu.point, avant, 'bouton tenu, le monde reste tel quel')
  await waitFor(session, `globalThis.wfrpEcran?.editeur?.surcouche.cases.length === 0 && wfrpEcran.cases['${x0 + 2},${y0}'][1] < ${avant[1] - 20}`)
  e = await editeur()
  noter(`glissé de (${x0}, ${y0}) à (${x0 + 2}, ${y0}) : ${tenu.surcouche.cases.length} cases en surcouche, puis la surface montée de ${Math.round(avant[1] - (await ecran()).cases[`${x0 + 2},${y0}`][1])} px ; ${e.zones['editeur.pointee'][0]?.texte}`)
  await capturer('3508-l1-2-peinte')
  const fichiers = MANUSCRITS.map((rel) => join(dossierDesProjetsLivres(depot), rel))
  const lus = () => fichiers.map((f) => readFileSync(f, 'utf8'))
  const avantLEnregistrement = lus()
  await cliquerAuPanneau({ element: 'bouton/enregistrer' })
  await waitFor(session, `Object.values(globalThis.wfrpEcran?.editeur?.zones ?? {}).flat().some((el) => el.id === 'enregistrer' && el.refus === 'Rien à enregistrer')`)
  const ecrits = lus().filter((texte, i) => texte !== avantLEnregistrement[i])
  assert.equal(ecrits.length, 1, '« Enregistrer » écrit la carte au dépôt')
  noter(`« Enregistrer » : ${MANUSCRITS[lus().findIndex((texte, i) => texte !== avantLEnregistrement[i])]} écrit (${ecrits[0].length} caractères), puis rien à enregistrer`)
  await cliquerAuPanneau({ element: 'bouton/annuler' })
  await waitFor(session, `Math.abs(globalThis.wfrpEcran?.cases['${x0 + 2},${y0}'][1] - ${avant[1]}) < 0.5`)
  noter('« Annuler » : la surface revient à sa place')
  const aretes = (await editeur()).aretes
  const [ax, ay] = cases[`${x0},${y0}`]
  const [bx, by] = cases[`${x0 + 1},${y0}`]
  const cote = [(ax + bx) / 2, (ay + by) / 2]
  await cliquerAuPanneau({ element: 'bouton/outil/wall' })
  assert.equal(boutonDeLEditeur(await editeur(), 'arete/wall')?.presse, true, 'l’outil Murs pose une cloison')
  await cliquerPoint(...cote)
  await waitFor(session, `globalThis.wfrpEcran?.editeur?.aretes === ${aretes + 1}`)
  noter(`outil Murs, clic entre (${x0}, ${y0}) et (${x0 + 1}, ${y0}) : ${aretes} puis ${aretes + 1} arêtes sur le monde`)
  e = await editeur()
  const releves = e.zones['editeur.validation'].filter((el) => el.type === 'ligne' && /^validation\/\d+$/.test(el.id))
  const neuf = releves.find((l) => l.texte.includes(`(${x0},${y0})`) || l.texte.includes(`(${x0 + 1},${y0})`))
  assert.ok(neuf && boutonDeLEditeur(e, `${neuf.id}/aller`), `la cloison seule relevée par la validation, « Y aller » offert : ${JSON.stringify(releves.map((l) => l.texte))}`)
  await cliquerAuPanneau({ element: `bouton/${neuf.id}/aller` })
  await waitFor(session, `(globalThis.wfrpEcran?.editeur?.surcouche.zones ?? []).some((z) => z.sorte === 'defaut')`)
  e = await editeur()
  noter(`validation : ${e.zones['editeur.validation'][0].texte} ; « Y aller » sur « ${neuf.texte.slice(0, 80)}… » : ${e.surcouche.zones.find((z) => z.sorte === 'defaut').cases.length} case(s) suivie(s)`)
  await capturer('3508-l6-2-validation')
  await cliquerAuPanneau({ element: 'bouton/outil/select' })
  await cliquerPoint(...cote)
  await waitFor(session, 'globalThis.wfrpEcran?.editeur?.surcouche.arete != null')
  e = await editeur()
  const choisie = e.zones['editeur.pointee'].find((l) => l.id === 'arete')
  assert.match(choisie?.texte ?? '', /^Arête .* · couche 0 · mur · /, 'la sélection dit l’arête choisie')
  noter(`outil Sélection, même point : ${choisie.texte}, gainée`)
  await capturer('3508-l2-1-cloison-choisie')
  await cliquerAuPanneau({ element: 'bouton/arete/porte' })
  await waitFor(session, `globalThis.wfrpEcran?.editeur?.surcouche.arete?.piece.startsWith('porte-') === true`)
  await cliquerAuPanneau({ element: 'bouton/arete/fermee' })
  await waitFor(session, `globalThis.wfrpEcran?.editeur?.surcouche.arete?.piece === 'porte-fermee'`)
  e = await editeur()
  assert.equal(boutonDeLEditeur(e, 'arete/fermee')?.presse, true, 'la porte fermée au départ, à l’inspecteur')
  noter(`inspecteur : « Porte » puis « Fermée au départ » : ${e.zones['editeur.pointee'].find((l) => l.id === 'arete')?.texte}, ${e.aretes} arêtes`)
  await capturer('3508-l2-3-porte-fermee')
  await cliquerAuPanneau({ element: 'bouton/annuler' })
  await cliquerAuPanneau({ element: 'bouton/annuler' })
  await cliquerAuPanneau({ element: 'bouton/annuler' })
  await waitFor(session, `globalThis.wfrpEcran?.editeur?.aretes === ${aretes} && globalThis.wfrpEcran.editeur.surcouche.arete === null`)
  noter('« Annuler » trois fois : la cloison retirée')
  await cliquerAuPanneau({ element: 'bouton/outil/stair' })
  await cliquerPoint(ax, ay)
  await waitFor(session, 'globalThis.wfrpEcran?.editeur?.surcouche.cases.length === 1')
  e = await editeur()
  const poser = boutonDeLEditeur(e, 'volee/poser')
  assert.ok(poser?.refus, '« Poser la volée » se refuse d’une case seule')
  assert.equal(e.zones['editeur.options'].find((l) => l.id === 'plan')?.texte, poser.refus, 'la raison du refus, en clair au panneau')
  noter(`outil Volée, un clic : ${e.zones['editeur.options'].find((l) => l.id === 'trace')?.texte}, en surcouche ; « Poser la volée » refusé : ${poser.refus}`)
  await capturer('3508-l2-2-volee-tracee')
  await cliquerAuPanneau({ element: 'bouton/volee/effacer' })
  await waitFor(session, 'globalThis.wfrpEcran?.editeur?.surcouche.cases.length === 0')
  noter('« Effacer le tracé » : la surcouche vide')
  await cliquerAuPanneau({ element: 'bouton/outil/crenellated' })
  await cliquerPoint(ax, ay)
  await waitFor(session, `(globalThis.wfrpEcran?.editeur?.zones['editeur.pointee'] ?? []).some((l) => l.id === 'crenelage')`)
  e = await editeur()
  noter(`outil Crénelage, un clic : ${e.zones['editeur.pointee'].find((l) => l.id === 'crenelage').texte}`)
  await cliquerAuPanneau({ element: 'bouton/annuler' })
  await waitFor(session, `(globalThis.wfrpEcran?.editeur?.zones['editeur.pointee'] ?? []).length > 0 && !globalThis.wfrpEcran.editeur.zones['editeur.pointee'].some((l) => l.id === 'crenelage')`)
  noter('« Annuler » : la marque effacée')
  await cliquerAuPanneau({ element: 'bouton/outil/prop' })
  e = await editeur()
  const catalogue = e.zones['editeur.options'].find((c) => c.id === 'decors').valeurs.find((b) => b.presse)
  /** Une case à l'écran sans repère à deux cases d'elle : aucun décor posé ne la couvre. */
  const libre = ([x, y]) => aLEcran(cases[`${x},${y}`] ?? [0, 0]) && !e.surcouche.reperes.some((r) => Math.abs(r.x - x) <= 2 && Math.abs(r.y - y) <= 2)
  const [dx, dy] = Object.keys(cases).map((k) => k.split(',').map(Number)).find(([x, y]) => libre([x, y]) && libre([x + 2, y]))
  await cliquerPoint(...cases[`${dx},${dy}`])
  await waitFor(session, '(globalThis.wfrpEcran?.editeur?.surcouche.reperes ?? []).some((r) => r.choisi)')
  e = await editeur()
  const decor = e.surcouche.reperes.find((r) => r.choisi)
  assert.deepEqual([decor.sorte, decor.x, decor.y, decor.nom, e.noms[`${dx},${dy},0`]], ['prop', dx, dy, catalogue.libelle, catalogue.libelle], 'l’outil Décor pose le décor choisi sur la case cliquée, sélectionné, nommé au-dessus d’elle')
  noter(`outil Décor, un clic : ${e.zones['editeur.pointee'].find((l) => l.id === 'entite').texte}`)
  assert.equal((await amenerAuPanneau({ element: 'saisieTexte/nommer/nom' }, 'saisies')).texte, decor.nom, 'le champ du nom, prérempli, à l’inspecteur')
  await taper('saisieTexte/nommer/nom', 'Comptoir')
  await cliquerAuPanneau({ element: 'formulaire/nommer' })
  await waitFor(session, `globalThis.wfrpEcran?.editeur?.noms['${dx},${dy},0'] === 'Comptoir'`)
  noter(`« Renommer » : ${(await editeur()).zones['editeur.pointee'].find((l) => l.id === 'entite').texte}`)
  await capturer('3508-l3-1-decor-nomme')
  await cliquerAuPanneau({ element: 'bouton/copier' })
  await cliquerAuPanneau({ element: 'bouton/outil/select' })
  await cliquerPoint(...cases[`${dx + 2},${dy}`])
  await cliquerAuPanneau({ element: 'bouton/coller' })
  await waitFor(session, `globalThis.wfrpEcran?.editeur?.noms['${dx + 2},${dy},0'] === 'Comptoir'`)
  e = await editeur()
  noter(`« Copier », un clic sur la case ${dx + 2}, ${dy}, « Coller » : ${e.surcouche.reperes.filter((r) => r.nom === 'Comptoir').map((r) => `${r.x}, ${r.y}`).join(' et ')}`)
  await capturer('3508-l3-2-decor-colle')
  await cliquerAuPanneau({ element: 'bouton/lumiere' })
  await waitFor(session, `(globalThis.wfrpEcran?.editeur?.zones['editeur.inspecteur'] ?? []).some((l) => l.id === 'lumiere/rayon')`)
  await cliquerAuPanneau({ element: 'bouton/lumiere/plus' })
  await waitFor(session, `globalThis.wfrpEcran?.editeur?.zones['editeur.inspecteur'].find((l) => l.id === 'lumiere/rayon')?.texte.includes('7 m')`)
  e = await editeur()
  noter(`« Source de lumière », « Rayon +1 m » : ${inspecte(e, 'lumiere/rayon').texte}`)
  await capturer('3508-l3b-1-lumiere')
  const [ex, ey] = Object.keys(cases).map((k) => k.split(',').map(Number)).find(([x, y]) => libre([x, y]) && !e.surcouche.reperes.some((r) => Math.abs(r.x - x) <= 2 && Math.abs(r.y - y) <= 2))
  await cliquerAuPanneau({ element: 'bouton/outil/emplacement' })
  await cliquerPoint(...cases[`${ex},${ey}`])
  await waitFor(session, `(globalThis.wfrpEcran?.editeur?.zones['editeur.inspecteur'] ?? []).some((c) => c.id === 'poste/arc')`)
  await cliquerAuPanneau({ element: 'bouton/poste/arc/tribord' })
  await waitFor(session, `globalThis.wfrpEcran?.editeur?.zones['editeur.inspecteur'].find((c) => c.id === 'poste/arc')?.valeurs.find((b) => b.id === 'poste/arc/tribord')?.presse === true`)
  e = await editeur()
  const engin = inspecte(e, 'poste/engin').valeurs.find((b) => b.presse).libelle
  assert.equal(e.surcouche.reperes.find((r) => r.choisi)?.nom, engin, 'l’emplacement porte le nom de son engin')
  noter(`outil Emplacement de siège, un clic sur la case ${ex}, ${ey}, puis « Droite (tribord) » : ${engin}, créneau tribord`)
  await capturer('3508-l3b-2-emplacement')
  await cliquerAuPanneau({ element: 'bouton/outil/zone' })
  e = await editeur()
  assert.equal(boutonDeLEditeur(e, 'zone/room')?.presse, true, 'l’outil Zone trace d’abord une pièce')
  const loin = ([x, y]) => aLEcran(cases[`${x},${y}`] ?? [0, 0]) && !e.surcouche.reperes.some((r) => Math.abs(r.x - x) <= 2 && Math.abs(r.y - y) <= 2)
  const auCentre = ([x, y]) => Math.hypot(cases[`${x},${y}`][0] - 800, cases[`${x},${y}`][1] - 380)
  const [zx, zy] = Object.keys(cases).map((k) => k.split(',').map(Number)).filter(([x, y]) => [0, 1, 2, 3].every((d) => loin([x + d, y]) && loin([x + d, y + 1])))
    .sort((a, b) => auCentre(a) - auCentre(b))[0]
  /** Glisse le pointeur de la case `de` à la case `a`, bouton tenu. */
  const glisserDe = async (de, a, qui) => geste(session, { surface: 'canvas', x: cases[de][0], y: cases[de][1] }, { qui }, async ({ x, y }, emettre) => {
    await emettre('souris', { type: 'mouseMoved', x, y })
    await emettre('souris', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 })
    await sleep(200)
    await emettre('souris', { type: 'mouseMoved', x: cases[a][0], y: cases[a][1], button: 'left', buttons: 1 })
    await sleep(300)
    await emettre('souris', { type: 'mouseReleased', x: cases[a][0], y: cases[a][1], button: 'left', clickCount: 1 })
  })
  await glisserDe(`${zx},${zy}`, `${zx + 1},${zy + 1}`, `la pièce tirée de ${zx},${zy}`)
  await waitFor(session, `globalThis.wfrpEcran?.editeur?.surcouche.zones.find((z) => z.choisi)?.cases.length === 4`)
  e = await editeur()
  assert.equal(e.noms[`${zx},${zy},0`], 'Pièce', 'la pièce tracée, nommée au-dessus de sa première case')
  assert.deepEqual(e.surcouche.poignee, { x: zx + 1, y: zy + 1, z: 0 }, 'sa poignée, au coin sud-est')
  noter(`outil Zone, pièce tirée de (${zx}, ${zy}) à (${zx + 1}, ${zy + 1}) : ${e.zones['editeur.pointee'].find((l) => l.id === 'zone').texte}`)
  await capturer('3508-l4-1-piece-tracee')
  await cliquerAuPanneau({ element: 'bouton/outil/select' })
  await glisserDe(`${zx + 1},${zy + 1}`, `${zx + 3},${zy + 1}`, 'la poignée de la pièce')
  await waitFor(session, `globalThis.wfrpEcran?.editeur?.surcouche.zones.find((z) => z.choisi)?.cases.length === 8`)
  e = await editeur()
  noter(`outil Sélection, la poignée glissée de deux cases à l’est : ${e.zones['editeur.pointee'].find((l) => l.id === 'zone').texte}`)
  await capturer('3508-l4-2-piece-agrandie')
  await cliquerAuPanneau({ element: 'bouton/valeur/crossTest/ajouter' })
  await waitFor(session, `(globalThis.wfrpEcran?.editeur?.zones['editeur.inspecteur'] ?? []).some((l) => l.id === 'valeur/crossTest/difficulty')`)
  /** L'id du bouton qui joue la valeur `valeur` du choix `choix` de l'inspecteur (`{ type: 'valeur', args: [porteur, chemin, valeur] }`). */
  const idDeLaValeur = (e, choix, valeur) => inspecte(e, choix).valeurs.find((b) => b.jeu.args[2] === valeur).id
  e = await editeur()
  await choisirALaListe('valeur/crossTest/difficulty', idDeLaValeur(e, 'valeur/crossTest/difficulty', 'difficile'), 'editeur.inspecteur')
  const sansSoutien = idDeLaValeur(e, 'valeur/crossTest/noSupport', true)
  await cliquerAuPanneau({ element: `bouton/${sansSoutien}` })
  await waitFor(session, `globalThis.wfrpEcran?.editeur?.zones['editeur.inspecteur'].find((el) => el.id === 'valeur/crossTest/noSupport')?.valeurs.find((b) => b.id === '${sansSoutien}')?.presse === true`)
  e = await editeur()
  const difficulte = inspecte(e, 'valeur/crossTest/difficulty').valeurs.find((b) => b.presse).libelle
  noter(`« Ajouter Test de traversée », difficulté « ${difficulte} », soutien refusé : ${e.zones['editeur.validation'][0].texte}`)
  await capturer('3606-m0a-1-test-de-traversee')
  await cliquerAuPanneau({ element: 'bouton/zone/supprimer' })
  await waitFor(session, '!globalThis.wfrpEcran?.editeur?.surcouche.zones.some((z) => z.choisi)')
  noter('« Supprimer » : la pièce retirée')
  await cliquerAuPanneau({ element: 'bouton/outil/personnage' })
  const fiche = 'griffon-zoo-imperial'
  await choisirALaListe('fiches', `personnage/${fiche}`)
  await cliquerPoint(...cases[`${zx},${zy}`])
  await waitFor(session, montre('valeur/combat/ajouter'))
  await cliquerAuPanneau('Combat')
  await cliquerAuPanneau({ element: 'bouton/valeur/combat/ajouter' })
  await waitFor(session, montre('valeur/combat/optionals/ajouter'))
  await cliquerAuPanneau({ element: 'bouton/valeur/combat/optionals/ajouter' })
  await waitFor(session, montre('valeur/combat/optionals/0/id'))
  e = await editeur()
  const facultatifs = JSON.parse(readFileSync(join(racineDuDepot, 'src/data/creatures.json'), 'utf8')).find((c) => c.id === fiche).optionals.flatMap((o) => (o.id ? [o.id] : []))
  const premierTrait = inspecte(e, 'valeur/combat/optionals/0/id').valeurs[0]
  assert.ok(facultatifs.includes(premierTrait.jeu.args[2]), `le premier Trait offert, ${premierTrait.libelle}, est un Facultatif de la fiche : ${facultatifs.join(', ')}`)
  const tirees = idDeLaValeur(e, 'valeur/combat/randomChars', true)
  await cliquerAuPanneau({ element: `bouton/${tirees}` })
  await waitFor(session, `globalThis.wfrpEcran?.editeur?.zones['editeur.inspecteur'].find((el) => el.id === 'valeur/combat/randomChars')?.valeurs.find((b) => b.id === '${tirees}')?.presse === true`)
  e = await editeur()
  noter(`outil Personnage, ${e.zones['editeur.pointee'].find((l) => l.id === 'entite').texte} ; onglet Combat, « Ajouter : rôle au combat », « Ajouter : options » : premier Trait offert « ${premierTrait.libelle} » ; « ${inspecte(e, 'valeur/combat/randomChars').libelle} » : ${inspecte(e, 'valeur/combat/randomChars').valeurs.find((b) => b.presse).libelle}`)
  await capturer('3606-m1a-1-combat')
  const ajoutDuProfil = inspecte(e, 'valeur/statblock/ajouter')
  const profilNeuf = ajoutDuProfil.valeurs[0]
  await cliquerAuPanneau({ element: `bouton/${profilNeuf.id}` })
  await waitFor(session, montre('valeur/statblock/char/force'))
  e = await editeur()
  noter(`onglet Combat, « ${ajoutDuProfil.libelle} », « ${profilNeuf.libelle} » : ${e.zones['editeur.inspecteur'].filter((l) => l.id.startsWith('valeur/statblock/char/') && l.type === 'formulaire').length} Caractéristiques à écrire`)
  await capturer('3606-m1b-1-profil')
  await cliquerAuPanneau('Apparence')
  await cliquerAuPanneau({ element: 'bouton/valeur/appearance/ajouter' })
  await waitFor(session, montre('valeur/appearance/couleurs/ajouter'))
  await cliquerAuPanneau({ element: 'bouton/valeur/appearance/couleurs/ajouter' })
  await waitFor(session, montre('valeur/appearance/couleurs/peau/ajouter'))
  await cliquerAuPanneau({ element: 'bouton/valeur/appearance/couleurs/peau/ajouter' })
  await waitFor(session, montre('valeur/appearance/couleurs/peau/id'))
  e = await editeur()
  const feminin = idDeLaValeur(e, 'valeur/appearance/sex', 'F')
  await cliquerAuPanneau({ element: `bouton/${feminin}` })
  await waitFor(session, `globalThis.wfrpEcran?.editeur?.zones['editeur.inspecteur'].find((el) => el.id === 'valeur/appearance/sex')?.valeurs.find((b) => b.id === '${feminin}')?.presse === true`)
  e = await editeur()
  noter(`onglet Apparence, « Ajouter : apparence », « Ajouter : couleurs », « Ajouter : Peau » : ${inspecte(e, 'valeur/appearance/couleurs/peau/id').valeurs.find((b) => b.presse).libelle} ; sexe ${inspecte(e, 'valeur/appearance/sex').valeurs.find((b) => b.presse).libelle}`)
  await capturer('3606-m1c-1-apparence')
  await cliquerAuPanneau('Rôles')
  await cliquerAuPanneau({ element: 'bouton/valeur/merchant/ajouter' })
  await waitFor(session, montre('valeur/merchant/settlement'))
  e = await editeur()
  const cite = idDeLaValeur(e, 'valeur/merchant/settlement', 'cite')
  await cliquerAuPanneau({ element: `bouton/${cite}` })
  await waitFor(session, `globalThis.wfrpEcran?.editeur?.zones['editeur.inspecteur'].find((el) => el.id === 'valeur/merchant/settlement')?.valeurs.find((b) => b.id === '${cite}')?.presse === true`)
  await cliquerAuPanneau({ element: 'bouton/valeur/tavernGame/ajouter' })
  await waitFor(session, montre('valeur/tavernGame/stakeBrass'))
  e = await editeur()
  const presse = (id) => inspecte(e, id).valeurs.find((b) => b.presse).libelle
  assert.equal(presse('valeur/merchant/settlement'), 'cité', 'la localité choisie se lit par son nom, pas par sa valeur « cite »')
  noter(`onglet Rôles, « Ajouter : marchand », localité « ${presse('valeur/merchant/settlement')} » : archétype « ${presse('valeur/merchant/archetype/id')} » ; « Ajouter : jeu de taverne » : « ${presse('valeur/tavernGame/id')} »`)
  await capturer('3606-m1d-1-marchand')
  await cliquerAuPanneau('Identité')
  await cliquerAuPanneau({ element: 'bouton/outil/select' })
  await cliquerPoint(...cases[`${dx},${dy}`])
  await waitFor(session, `${montre('valeur/usable/ajouter')} || ${montre('valeur/usable/actions/ajouter')}`)
  await cliquerAuPanneau('Rôles')
  e = await editeur()
  const rang = e.zones['editeur.inspecteur'].filter((el) => el.id.startsWith('identifier/action/')).length
  const [actionNeuve] = (inspecte(e, 'valeur/usable/ajouter') ?? inspecte(e, 'valeur/usable/actions/ajouter')).valeurs
  await cliquerAuPanneau({ element: `bouton/${actionNeuve.id}` })
  await waitFor(session, montre(`identifier/action/${actionNeuve.libelle}`))
  await taper(`saisieTexte/identifier/action/${actionNeuve.libelle}/id`, 'coffre')
  await cliquerAuPanneau({ element: `formulaire/identifier/action/${actionNeuve.libelle}` })
  await waitFor(session, montre('identifier/action/coffre'))
  await taper(`saisieTexte/valeur/usable/actions/${rang}/label/valeur`, 'Ouvrir')
  await cliquerAuPanneau({ element: `formulaire/valeur/usable/actions/${rang}/label` })
  await waitFor(session, `globalThis.wfrpEcran?.editeur?.zones['editeur.inspecteur'].find((el) => el.id === 'valeur/usable/actions/${rang}/label')?.champs[2].valeur === 'Ouvrir'`)
  e = await editeur()
  const consommer = idDeLaValeur(e, `valeur/usable/actions/${rang}/consume`, true)
  await cliquerAuPanneau({ element: `bouton/${consommer}` })
  await waitFor(session, `globalThis.wfrpEcran?.editeur?.zones['editeur.inspecteur'].find((el) => el.id === 'valeur/usable/actions/${rang}/consume')?.valeurs.find((b) => b.id === '${consommer}')?.presse === true`)
  noter(`un clic sur le décor « Comptoir », onglet Rôles, « Ajouter » : l’action « ${actionNeuve.libelle} », identifiée « coffre », libellée « Ouvrir », consommée`)
  await capturer('3606-m1e-1-actions')
  await cliquerAuPanneau('Identité')
  await cliquerAuPanneau({ element: 'bouton/outil/navire' })
  await choisirALaListe('navires', 'navire/barge-fluviale')
  const [qx, qy] = Object.keys(cases).map((k) => k.split(',').map(Number)).filter(loin).sort((a, b) => auCentre(a) - auCentre(b))[0]
  await cliquerPoint(...cases[`${qx},${qy}`])
  await waitFor(session, montre('valeur/postes/ajouter'))
  await cliquerAuPanneau('Combat')
  e = await editeur()
  const [premierEngin] = inspecte(e, 'valeur/postes/ajouter').valeurs
  await choisirALaListe('valeur/postes/ajouter', premierEngin.id, 'editeur.inspecteur', montre('valeur/postes/0/trappingId'))
  e = await editeur()
  const piece = inspecte(e, 'valeur/postes/0/trappingId').valeurs.find((b) => b.jeu.args[2] === 'canon-moyen')
  await choisirALaListe('valeur/postes/0/trappingId', piece.id, 'editeur.inspecteur')
  await waitFor(session, montre('valeur/postes/0/ammo/ajouter'))
  e = await editeur()
  const pieceChoisie = inspecte(e, 'valeur/postes/0/trappingId').valeurs.find((b) => b.presse).libelle
  const ajouterAuCoffre = inspecte(e, 'valeur/postes/0/ammo/ajouter').libelle
  await cliquerAuPanneau({ element: 'bouton/valeur/postes/0/ammo/ajouter' })
  await waitFor(session, montre('valeur/postes/0/ammo/boulet-et-poudre'))
  await cliquerAuPanneau({ element: 'formulaire/valeur/postes/0/ammo/boulet-et-poudre' })
  await waitFor(session, `globalThis.wfrpEcran?.editeur?.zones['editeur.inspecteur'].find((el) => el.id === 'valeur/postes/0/ammo/boulet-et-poudre')?.champs[2].valeur === 1`)
  e = await editeur()
  noter(`outil Navire, la barge posée sur la case ${qx}, ${qy} ; onglet Combat, « ${inspecte(e, 'valeur/postes/ajouter').libelle} » : « ${premierEngin.libelle} », puis la pièce « ${pieceChoisie} » ; « ${ajouterAuCoffre} », une munition « ${inspecte(e, 'valeur/postes/0/ammo/boulet-et-poudre').champs[2].libelle} » au coffre, quantité ${inspecte(e, 'valeur/postes/0/ammo/boulet-et-poudre').champs[2].valeur}`)
  await capturer('3606-m1f-1-postes')
  await cliquerAuPanneau('Identité')
  await cliquerAuPanneau({ element: 'bouton/entite/supprimer' })
  await waitFor(session, '!(globalThis.wfrpEcran?.editeur?.surcouche.reperes ?? []).some((r) => r.choisi)')
  await cliquerAuPanneau({ element: 'bouton/outil/select' })
  await cliquerPoint(...cases[`${dx},${dy}`])
  const flux = `valeur/usable/actions/${rang}/flow`
  await waitFor(session, montre(`${flux}/kind`))
  await cliquerAuPanneau('Rôles')
  /** L'id de la valeur du choix `choix` qui pose la variante de discriminant `kind`. */
  const idDeLaVariante = (e, choix, kind) => inspecte(e, choix).valeurs.find((b) => b.jeu.args[2]?.kind === kind).id
  /** Le pas neuf ajouté au rang `n` de la séquence du flux d'id `flux`, sa branche `kind` choisie, l'élément `attendu`
   *  montré. */
  const ajouterLePas = async (flux, n, kind, attendu) => {
    await cliquerAuPanneau({ element: `bouton/${flux}/etapes/ajouter` })
    await waitFor(session, montre(`${flux}/etapes/${n}/kind`))
    e = await editeur()
    await cliquerAuPanneau({ element: `bouton/${idDeLaVariante(e, `${flux}/etapes/${n}/kind`, kind)}` })
    await waitFor(session, montre(attendu))
  }
  /** Le texte `texte` écrit au champ `champ` du flux d'id `flux`, sa saisie tapée puis jouée. */
  const ecrireAuFlux = async (flux, champ, texte) => {
    await taper(`saisieTexte/${flux}/${champ}/valeur`, texte)
    await cliquerAuPanneau({ element: `formulaire/${flux}/${champ}` })
    await waitFor(session, `globalThis.wfrpEcran?.editeur?.zones['editeur.inspecteur'].find((el) => el.id === '${flux}/${champ}')?.champs[2].valeur === ${JSON.stringify(texte)}`)
  }
  await ajouterLePas(flux, 0, 'effet', `${flux}/etapes/0/effet/flag`)
  await ecrireAuFlux(flux, 'etapes/0/effet/flag', 'coffre')
  await ajouterLePas(flux, 1, 'si', `${flux}/etapes/1/condition/kind`)
  e = await editeur()
  await choisirALaListe(`${flux}/etapes/1/condition/kind`, idDeLaVariante(e, `${flux}/etapes/1/condition/kind`, 'flag'), 'editeur.inspecteur', montre(`${flux}/etapes/1/condition/expr`))
  await ecrireAuFlux(flux, 'etapes/1/condition/expr', 'coffre')
  e = await editeur()
  const branche = (id) => inspecte(e, id).valeurs.find((b) => b.presse).libelle
  noter(`un clic sur le décor « Comptoir », onglet Rôles, le flux de l’action « coffre » : « ${branche(`${flux}/kind`)} » ; « ${inspecte(e, `${flux}/etapes/ajouter`).libelle} » : un pas « ${branche(`${flux}/etapes/0/kind`)} », effet « ${branche(`${flux}/etapes/0/effet/type`)} » sur l’indicateur « coffre », puis un pas « ${branche(`${flux}/etapes/1/kind`)} », condition « ${branche(`${flux}/etapes/1/condition/kind`)} » « coffre »`)
  await capturer('3606-m2b-1-flux')
  await cliquerPoint(...cases[`${zx},${zy}`])
  await waitFor(session, montre('valeur/merchant/settlement'))
  e = await editeur()
  await cliquerAuPanneau('Identité')
  const entree = inspecte(e, 'entite/couvre/ajouter').valeurs[0]
  await choisirALaListe('entite/couvre/ajouter', entree.id, 'editeur.inspecteur', montre(`entite/couvre/${entree.jeu.edition.patch.couvre[0]}`))
  noter(`onglet Identité, « Couvrir une entrée de fiche » : ${(await editeur()).zones['editeur.inspecteur'].find((l) => l.id === `entite/couvre/${entree.jeu.edition.patch.couvre[0]}`).texte}`)
  await capturer('3606-m1a-2-identite')
  await cliquerAuPanneau({ element: 'bouton/entite/supprimer' })
  await waitFor(session, '!(globalThis.wfrpEcran?.editeur?.surcouche.reperes ?? []).some((r) => r.choisi)')
  await cliquerAuPanneau({ element: 'bouton/outil/architecture' })
  await cliquerPoint(...cases[`${zx},${zy}`])
  await cliquerAuPanneau({ element: 'bouton/batir/corps' })
  await waitFor(session, `(globalThis.wfrpEcran?.editeur?.zones['editeur.inspecteur'] ?? []).some((l) => l.id === 'toiture')`)
  e = await editeur()
  noter(`outil Architecture, un clic sur la case ${zx}, ${zy}, « Nouveau corps » : ${e.zones['editeur.options'].find((c) => c.id === 'corps').valeurs.find((b) => b.presse).libelle} ; ${inspecte(e, 'toiture').texte}`)
  await cliquerAuPanneau({ element: 'bouton/architecture/facade' })
  const [[nx, ny], [sx, sy]] = [cases[`${zx},${zy - 1}`], cases[`${zx},${zy}`]]
  await cliquerPoint((nx + sx) / 2, (ny + sy) / 2)
  await waitFor(session, `(globalThis.wfrpEcran?.editeur?.zones['editeur.inspecteur'] ?? []).some((l) => l.id === 'facade/apparence')`)
  await cliquerAuPanneau({ element: 'bouton/baie/ajouter' })
  await waitFor(session, `(globalThis.wfrpEcran?.editeur?.zones['editeur.inspecteur'] ?? []).some((l) => l.id.startsWith('baie/') && l.id.endsWith('/sorte'))`)
  e = await editeur()
  const baie = e.zones['editeur.inspecteur'].find((l) => l.id.startsWith('baie/') && l.id.endsWith('/sorte'))
  noter(`« Poser une façade », un clic sur le côté nord de la case, « Ajouter une ouverture » : ${baie.valeurs.find((b) => b.presse).libelle}, ${inspecte(e, baie.id.replace(/sorte$/, 'position')).texte}`)
  await capturer('3508-l5-1-facade')
  await cliquerAuPanneau({ element: 'bouton/architecture/exclusion' })
  await glisserDe(`${zx + 1},${zy}`, `${zx + 2},${zy + 1}`, 'l’exclusion de toiture tirée')
  await waitFor(session, `(globalThis.wfrpEcran?.editeur?.zones['editeur.inspecteur'] ?? []).some((l) => l.id === 'toiture/exclusion/0')`)
  e = await editeur()
  assert.equal(boutonDeLEditeur(e, 'architecture/selection')?.presse, true, 'l’exclusion tirée, le clic revient à la sélection')
  noter(`« Tirer une exclusion de toiture », de (${zx + 1}, ${zy}) à (${zx + 2}, ${zy + 1}) : ${inspecte(e, 'toiture/exclusion/0').texte}`)
  await cliquerPoint(...cases[`${zx},${zy}`])
  await cliquerAuPanneau({ element: 'bouton/batir/masse' })
  await waitFor(session, `(globalThis.wfrpEcran?.editeur?.zones['editeur.inspecteur'] ?? []).some((l) => l.id === 'masse/niveaux')`)
  await cliquerAuPanneau({ element: 'bouton/masse/niveaux/plus' })
  await waitFor(session, `globalThis.wfrpEcran?.editeur?.zones['editeur.inspecteur'].find((l) => l.id === 'masse/niveaux')?.texte === 'Niveaux : 2'`)
  e = await editeur()
  assert.equal(e.surcouche.zones.find((z) => z.choisi)?.sorte, 'masse', 'la masse bâtie, sélectionnée en surcouche')
  noter(`un clic sur la case, « Nouvelle masse de toiture », « +1 » : ${e.zones['editeur.pointee'].find((l) => l.id === 'zone')?.texte} ; ${inspecte(e, 'masse/niveaux').texte}`)
  await capturer('3508-l5-2-masse')
  await cliquerAuPanneau({ element: 'bouton/outil/select' })
  await cliquerPoint(...cases[`${dx + 1},${dy}`])
  await waitFor(session, '(globalThis.wfrpEcran?.editeur?.zones["editeur.pointee"] ?? []).some((l) => l.id === "zone")')
  noter(`outil Sélection, un clic sur la case ${dx + 1}, ${dy} : ${(await editeur()).zones['editeur.pointee'].find((l) => l.id === 'zone').texte}`)
  await waitFor(session, `(globalThis.wfrpEcran?.editeur?.zones['editeur.inspecteur'] ?? []).some((l) => l.id === 'valeur/when/kind')`)
  e = await editeur()
  /** Le déclencheur tel que l'inspecteur le montre : sa condition pressée et les pas de son flux. */
  const etatDuDeclencheur = (e) => ({
    condition: inspecte(e, 'valeur/when/kind').valeurs.find((b) => b.presse)?.id,
    pas: e.zones['editeur.inspecteur'].filter((el) => /^valeur\/flow\/etapes\/\d+\/kind$/.test(el.id)).length,
  })
  const declencheurAvant = etatDuDeclencheur(e)
  await choisirALaListe('valeur/when/kind', inspecte(e, 'valeur/when/kind').valeurs.find((b) => b.libelle === 'TOUS (ET)').id, 'editeur.inspecteur')
  await waitFor(session, `(globalThis.wfrpEcran?.editeur?.zones['editeur.inspecteur'] ?? []).some((l) => l.id === 'valeur/when/of/ajouter')`)
  await cliquerAuPanneau({ element: 'bouton/valeur/when/of/ajouter' })
  await waitFor(session, `(globalThis.wfrpEcran?.editeur?.zones['editeur.inspecteur'] ?? []).some((l) => l.id === 'valeur/when/of/0/kind')`)
  e = await editeur()
  const sousCondition = inspecte(e, 'valeur/when/of/0/kind').valeurs.find((b) => b.presse)?.libelle
  noter(`à l’inspecteur du déclencheur, la condition « ${inspecte(e, 'valeur/when/kind').valeurs.find((b) => b.presse).libelle} », puis « Ajouter » : une condition « ${sousCondition} » dans son contenu`)
  await capturer('3606-m0b-1-condition-du-declencheur')
  const rangDuPas = declencheurAvant.pas
  await ajouterLePas('valeur/flow', rangDuPas, 'effet', `valeur/flow/etapes/${rangDuPas}/effet/flag`)
  await ecrireAuFlux('valeur/flow', `etapes/${rangDuPas}/effet/flag`, 'piege')
  e = await editeur()
  noter(`le flux du même déclencheur : « ${inspecte(e, 'valeur/flow/kind').valeurs.find((b) => b.presse).libelle} » ; « ${inspecte(e, 'valeur/flow/etapes/ajouter').libelle} » : un pas « ${inspecte(e, `valeur/flow/etapes/${rangDuPas}/kind`).valeurs.find((b) => b.presse).libelle} » après les ${rangDuPas} du flux, effet « ${inspecte(e, `valeur/flow/etapes/${rangDuPas}/effet/type`).valeurs.find((b) => b.presse).libelle} » sur l’indicateur « piege »`)
  await capturer('3606-m2c-1-declencheur')
  for (let n = 0; n < 5; n++) await cliquerAuPanneau({ element: 'bouton/annuler' })
  await waitFor(session, `!(globalThis.wfrpEcran?.editeur?.zones['editeur.inspecteur'] ?? []).some((l) => l.id.startsWith('valeur/flow/etapes/${rangDuPas}/'))`)
  await waitFor(session, `!(globalThis.wfrpEcran?.editeur?.zones['editeur.inspecteur'] ?? []).some((l) => l.id.startsWith('valeur/when/of'))`)
  await cliquerPoint(...cases[`${dx + 1},${dy}`])
  await waitFor(session, montre('valeur/when/kind'))
  assert.deepEqual(etatDuDeclencheur(await editeur()), declencheurAvant, '« Annuler » cinq fois, le déclencheur recliqué : rendu à sa condition et à son flux d’avant les deux étapes')
  await ajouterLePas('valeur/flow', rangDuPas, 'effet', `valeur/flow/etapes/${rangDuPas}/effet/flag`)
  const pasDOps = `valeur/flow/etapes/${rangDuPas}/effet`
  e = await editeur()
  await choisirALaListe(`${pasDOps}/type`, inspecte(e, `${pasDOps}/type`).valeurs.find((b) => b.jeu.args[2]?.type === 'ops').id, 'editeur.inspecteur', montre(`${pasDOps}/ops/ajouter`))
  await cliquerAuPanneau({ element: `bouton/${pasDOps}/ops/ajouter` })
  await waitFor(session, montre(`${pasDOps}/ops/0/op`))
  e = await editeur()
  await choisirALaListe(`${pasDOps}/ops/0/op`, inspecte(e, `${pasDOps}/ops/0/op`).valeurs.find((b) => b.jeu.args[2]?.op === 'grantNaturalWeapon').id, 'editeur.inspecteur', montre(`${pasDOps}/ops/0/label`))
  await ecrireAuFlux('valeur/flow', `etapes/${rangDuPas}/effet/ops/0/label`, 'Griffe')
  e = await editeur()
  await choisirALaListe(`${pasDOps}/ops/0/attackKind`, inspecte(e, `${pasDOps}/ops/0/attackKind`).valeurs.find((b) => b.jeu.args[2] === 'morsure').id, 'editeur.inspecteur')
  e = await editeur()
  const pressee = (id) => inspecte(e, id).valeurs.find((b) => b.presse).libelle
  noter(`le flux du même déclencheur, un pas « ${pressee(`valeur/flow/etapes/${rangDuPas}/kind`)} » d’effet « ${pressee(`${pasDOps}/type`)} » : l’op « ${pressee(`${pasDOps}/ops/0/op`)} », champ par champ, libellée « ${inspecte(e, `${pasDOps}/ops/0/label`).champs[2].valeur} », type d’attaque « ${pressee(`${pasDOps}/ops/0/attackKind`)} »`)
  await capturer('3606-m2a-1-op-typee')
  const opTypee = pressee(`${pasDOps}/ops/0/op`)
  await cliquerAuPanneau({ element: `bouton/${pasDOps}/ops/ajouter` })
  await waitFor(session, montre(`${pasDOps}/ops/1/op`))
  e = await editeur()
  await choisirALaListe(`${pasDOps}/ops/1/op`, inspecte(e, `${pasDOps}/ops/1/op`).valeurs.find((b) => b.jeu.args[2]?.op === 'condition').id, 'editeur.inspecteur', montre(`${pasDOps}/ops/1/id/id`))
  e = await editeur()
  await choisirALaListe(`${pasDOps}/ops/1/id/id`, inspecte(e, `${pasDOps}/ops/1/id/id`).valeurs.find((b) => b.jeu.args[2] === 'sonne').id, 'editeur.inspecteur')
  e = await editeur()
  noter(`le même pas d’effet, une seconde op « ${pressee(`${pasDOps}/ops/1/op`)} », champ par champ : l’État « ${pressee(`${pasDOps}/ops/1/id/id`)} » choisi à la liste du catalogue`)
  await capturer('3606-m2a2-1-etat')
  for (let n = 0; n < 3; n++) await cliquerAuPanneau({ element: 'bouton/annuler' })
  await cliquerPoint(...cases[`${dx + 1},${dy}`])
  await waitFor(session, montre(`${pasDOps}/ops/0/op`))
  e = await editeur()
  assert.deepEqual([inspecte(e, `${pasDOps}/ops/1/op`), pressee(`${pasDOps}/ops/0/op`)], [undefined, opTypee], '« Annuler » trois fois, le déclencheur recliqué : la seconde op partie, l’op typée reste')
  for (let n = 0; n < 7; n++) await cliquerAuPanneau({ element: 'bouton/annuler' })
  await waitFor(session, `!(globalThis.wfrpEcran?.editeur?.zones['editeur.inspecteur'] ?? []).some((l) => l.id.startsWith('valeur/flow/etapes/${rangDuPas}/'))`)
  await cliquerPoint(...cases[`${dx + 1},${dy}`])
  await waitFor(session, montre('valeur/when/kind'))
  assert.deepEqual(etatDuDeclencheur(await editeur()), declencheurAvant, '« Annuler » sept fois, le déclencheur recliqué : rendu à son flux d’avant l’op')
  await ajouterLePas('valeur/flow', rangDuPas, 'effet', `valeur/flow/etapes/${rangDuPas}/effet/flag`)
  e = await editeur()
  await choisirALaListe(`${pasDOps}/type`, inspecte(e, `${pasDOps}/type`).valeurs.find((b) => b.jeu.args[2]?.type === 'transition').id, 'editeur.inspecteur', montre(`${pasDOps}/scene/id`))
  e = await editeur()
  const scenesOffertes = inspecte(e, `${pasDOps}/scene/id`).valeurs
  assert.equal(scenesOffertes.length, e.zones['editeur.scenes'].find((el) => el.id === 'scenes').valeurs.length, 'la scène de la transition se choisit parmi les scènes du projet, exactement')
  await cliquerAuPanneau({ element: `bouton/${scenesOffertes[0].id}` })
  await waitFor(session, `globalThis.wfrpEcran?.editeur?.zones['editeur.inspecteur'].find((el) => el.id === '${pasDOps}/scene/id')?.valeurs.find((b) => b.id === '${scenesOffertes[0].id}')?.presse === true`)
  e = await editeur()
  assert.equal(inspecte(e, `${pasDOps}/scene/id`).valeurs.find((b) => b.presse)?.jeu.args[2], scenesOffertes[0].jeu.args[2], 'la scène choisie est écrite')
  noter(`le flux du même déclencheur, un pas « ${pressee(`valeur/flow/etapes/${rangDuPas}/kind`)} » d’effet « ${pressee(`${pasDOps}/type`)} » : la scène choisie à la liste des ${scenesOffertes.length} scènes du projet, « ${pressee(`${pasDOps}/scene/id`)} »`)
  await capturer('3606-m2d-1-ref-locale')
  for (let n = 0; n < 4; n++) await cliquerAuPanneau({ element: 'bouton/annuler' })
  await waitFor(session, `!(globalThis.wfrpEcran?.editeur?.zones['editeur.inspecteur'] ?? []).some((l) => l.id.startsWith('valeur/flow/etapes/${rangDuPas}/'))`)
  await cliquerPoint(...cases[`${dx + 1},${dy}`])
  await waitFor(session, montre('valeur/when/kind'))
  assert.deepEqual(etatDuDeclencheur(await editeur()), declencheurAvant, '« Annuler » quatre fois, le déclencheur recliqué : rendu à son flux d’avant l’effet')
  e = await editeur()
  await choisirALaListe('valeur/when/kind', inspecte(e, 'valeur/when/kind').valeurs.find((b) => b.jeu.args[2]?.kind === 'partyDead').id, 'editeur.inspecteur', montre('valeur/when/who/forme'))
  e = await editeur()
  const parEtat = inspecte(e, 'valeur/when/who/forme').valeurs.find((b) => b.jeu.args[2]?.etat !== undefined)
  await cliquerAuPanneau({ element: `bouton/${parEtat.id}` })
  await waitFor(session, `globalThis.wfrpEcran?.editeur?.zones['editeur.inspecteur'].find((el) => el.id === 'valeur/when/who/forme')?.valeurs.find((b) => b.id === '${parEtat.id}')?.presse === true`)
  e = await editeur()
  assert.deepEqual(inspecte(e, 'valeur/when/who/forme').valeurs.find((b) => b.presse)?.jeu.args[2], { etat: '' }, 'le héros désigné par un état, posé par le choix de sa variante')
  await ajouterLePas('valeur/flow', rangDuPas, 'effet', `valeur/flow/etapes/${rangDuPas}/effet/flag`)
  e = await editeur()
  await choisirALaListe(`${pasDOps}/type`, inspecte(e, `${pasDOps}/type`).valeurs.find((b) => b.jeu.args[2]?.type === 'ops').id, 'editeur.inspecteur', montre(`${pasDOps}/ops/ajouter`))
  await cliquerAuPanneau({ element: `bouton/${pasDOps}/ops/ajouter` })
  await waitFor(session, montre(`${pasDOps}/ops/0/op`))
  e = await editeur()
  await choisirALaListe(`${pasDOps}/ops/0/op`, inspecte(e, `${pasDOps}/ops/0/op`).valeurs.find((b) => b.jeu.args[2]?.op === 'navireMod').id, 'editeur.inspecteur', montre(`${pasDOps}/ops/0/jusqua/forme`))
  e = await editeur()
  const parJours = inspecte(e, `${pasDOps}/ops/0/jusqua/forme`).valeurs.find((b) => b.jeu.args[2]?.jours !== undefined)
  await cliquerAuPanneau({ element: `bouton/${parJours.id}` })
  await waitFor(session, `globalThis.wfrpEcran?.editeur?.zones['editeur.inspecteur'].find((el) => el.id === '${pasDOps}/ops/0/jusqua/forme')?.valeurs.find((b) => b.id === '${parJours.id}')?.presse === true`)
  e = await editeur()
  noter(`à l’inspecteur du déclencheur, la condition « ${pressee('valeur/when/kind')} » : son acteur, « ${pressee('valeur/when/who/forme')} », choisi par sa variante ; au flux, l’op « ${pressee(`${pasDOps}/ops/0/op`)} », jusqu’à « ${pressee(`${pasDOps}/ops/0/jusqua/forme`)} », choisi par sa variante`)
  await capturer('3606-m2e-1-variante-nommee')
  for (let n = 0; n < 8; n++) await cliquerAuPanneau({ element: 'bouton/annuler' })
  await waitFor(session, `!(globalThis.wfrpEcran?.editeur?.zones['editeur.inspecteur'] ?? []).some((l) => l.id.startsWith('valeur/flow/etapes/${rangDuPas}/'))`)
  await cliquerPoint(...cases[`${dx + 1},${dy}`])
  await waitFor(session, montre('valeur/when/kind'))
  assert.deepEqual(etatDuDeclencheur(await editeur()), declencheurAvant, '« Annuler » huit fois, le déclencheur recliqué : rendu à sa condition et à son flux d’avant l’étape')
  e = await editeur()
  await choisirALaListe('valeur/when/kind', inspecte(e, 'valeur/when/kind').valeurs.find((b) => b.jeu.args[2]?.kind === 'money').id, 'editeur.inspecteur', montre('valeur/when/atLeast/forme'))
  e = await editeur()
  assert.equal(pressee('valeur/when/atLeast/forme'), 'Montant', 'la Bourse neuve se lit en « Montant »')
  const choisirLaForme = async (id, voulue) => {
    await cliquerAuPanneau({ element: `bouton/${id}` })
    await waitFor(session, `globalThis.wfrpEcran?.editeur?.zones['editeur.inspecteur'].find((el) => el.id === 'valeur/when/atLeast/forme')?.valeurs.find((b) => b.id === '${id}')?.presse === true`)
    e = await editeur()
    assert.equal(pressee('valeur/when/atLeast/forme'), voulue, `la variante « ${voulue} » choisie est la courante`)
  }
  await choisirLaForme(inspecte(e, 'valeur/when/atLeast/forme').valeurs.find((b) => b.jeu.args[2]?.brass?.tire !== undefined).id, 'Valeur liée')
  assert.deepEqual(inspecte(e, 'valeur/when/atLeast/forme').valeurs.find((b) => b.presse).jeu.args[2], { brass: { tire: '' } }, 'la valeur liée posée par le choix de sa variante, qui partage `brass` avec le Montant')
  noter(`à l’inspecteur du déclencheur, la condition « ${pressee('valeur/when/kind')} » : son minimum en « ${pressee('valeur/when/atLeast/forme')} », choisi par sa variante`)
  await capturer('3606-m2e2-1-bourse-valeur-liee')
  await choisirLaForme(inspecte(e, 'valeur/when/atLeast/forme').valeurs.find((b) => b.jeu.args[2]?.brass?.tire === undefined).id, 'Montant')
  noter(`puis revenu en « ${pressee('valeur/when/atLeast/forme')} »`)
  for (let n = 0; n < 3; n++) await cliquerAuPanneau({ element: 'bouton/annuler' })
  await cliquerPoint(...cases[`${dx + 1},${dy}`])
  await waitFor(session, montre('valeur/when/kind'))
  assert.deepEqual(etatDuDeclencheur(await editeur()), declencheurAvant, '« Annuler » trois fois, le déclencheur recliqué : rendu à sa condition d’avant la Bourse')
  await ajouterLePas('valeur/flow', rangDuPas, 'effet', `valeur/flow/etapes/${rangDuPas}/effet/flag`)
  e = await editeur()
  const adresse = `${pasDOps}/descRef`
  await choisirALaListe(`${pasDOps}/type`, inspecte(e, `${pasDOps}/type`).valeurs.find((b) => b.jeu.args[2]?.type === 'journal').id, 'editeur.inspecteur', montre(`${adresse}/ajouter`))
  const ligneDeLAdresse = `globalThis.wfrpEcran?.editeur?.zones['editeur.inspecteur'].find((el) => el.id === '${adresse}/etat')?.texte ?? ''`
  await choisirAuChamp(`${adresse}/ajouter`, (v) => v.book === 'livre-de-base', montre(`${adresse}/ch`))
  await choisirAuChamp(`${adresse}/ch`, (v) => v === '64', `globalThis.wfrpEcran?.editeur?.zones['editeur.inspecteur'].find((el) => el.id === '${adresse}/ch')?.valeurs.find((b) => b.presse)?.jeu.args[2] === '64'`)
  await waitFor(session, `(globalThis.wfrpEcran?.editeur?.zones['editeur.inspecteur'].find((el) => el.id === '${adresse}/parts/ajouter')?.valeurs ?? []).some((b) => b.jeu.args[2]?.at(-1)?.kind === 'cellule')`, { timeoutMs: 30000 })
  await choisirAuChamp(`${adresse}/parts/ajouter`, (v) => v.at(-1).kind === 'cellule', montre(`${adresse}/parts/0/row`))
  e = await editeur()
  const ligneVoulue = inspecte(e, `${adresse}/parts/0/row`).valeurs.find((b) => !b.presse && b.refus === null)
  await choisirAuChamp(`${adresse}/parts/0/row`, (v) => v === ligneVoulue.jeu.args[2], `(${ligneDeLAdresse}).startsWith('Passage : ') && globalThis.wfrpEcran?.editeur?.zones['editeur.inspecteur'].find((el) => el.id === '${adresse}/parts/0/row')?.valeurs.find((b) => b.presse)?.libelle === ${JSON.stringify(ligneVoulue.libelle)}`)
  e = await editeur()
  assert.ok(!e.zones['editeur.inspecteur'].some((el) => el.id.startsWith(`${adresse}/parts/0/sum`)), 'l’empreinte du fragment n’est jamais offerte')
  noter(`le flux du même déclencheur, un pas d’effet « ${pressee(`${pasDOps}/type`)} » : son adresse de prose, livre « ${pressee(`${adresse}/book`)} », chapitre « ${pressee(`${adresse}/ch`)} » chargé à la demande, une cellule ajoutée, la ligne « ${pressee(`${adresse}/parts/0/row`)} » à la colonne « ${pressee(`${adresse}/parts/0/col`)} » : ${inspecte(e, `${adresse}/etat`).texte}`)
  await capturer('3606-m2g-1-cellule')
  for (let n = 0; n < 7; n++) await cliquerAuPanneau({ element: 'bouton/annuler' })
  await waitFor(session, `!(globalThis.wfrpEcran?.editeur?.zones['editeur.inspecteur'] ?? []).some((l) => l.id.startsWith('valeur/flow/etapes/${rangDuPas}/'))`)
  await cliquerPoint(...cases[`${dx + 1},${dy}`])
  await waitFor(session, montre('valeur/when/kind'))
  assert.deepEqual(etatDuDeclencheur(await editeur()), declencheurAvant, '« Annuler » sept fois, le déclencheur recliqué : rendu à son flux d’avant l’adresse')
  const planche = join(depot, 'planche.png')
  ecrirePlanche(planche)
  await lieu.choisirLeFichier(session, planche, () => cliquerAuPanneau({ element: 'bouton/calque/charger' }))
  await waitFor(session, `globalThis.wfrpEcran?.editeur?.calque_pose === true && wfrpEcran.editeur.zones['editeur.calque'].some((l) => l.id === 'calque/echelle')`, { timeoutMs: 30000 })
  e = await editeur()
  const ligneDuCalque = (e, id) => e.zones['editeur.calque'].find((l) => l.id === id)?.texte
  const echelle = (e) => Number(ligneDuCalque(e, 'calque/echelle').split(' ')[0])
  const avantLeCalage = echelle(e)
  noter(`« Charger une planche… » : ${ligneDuCalque(e, 'calque')}, coins ${JSON.stringify(e.calque.coins)}, ${ligneDuCalque(e, 'calque/opacite')}, ${ligneDuCalque(e, 'calque/echelle')}`)
  await capturer('3508-l1b-1-planche-posee')
  const rangee = Object.keys(cases).map((k) => k.split(',').map(Number))
    .find(([x, y]) => Array.from({ length: 20 }, (_, i) => cases[`${x + (i % 10)},${y + Math.floor(i / 10)}`]).every((c) => c && aLEcran(c)))
  assert.ok(rangee, 'deux rangées de dix cases voisines à l’écran, hors du panneau')
  const [cx, cy] = rangee
  /** Le point de l'écran du nœud au coin bas-droit de la case `x`, `cy` : le milieu des centres des quatre cases qui le bordent. */
  const noeud = (x) => [0, 1].map((axe) => [[x, cy], [x + 1, cy], [x, cy + 1], [x + 1, cy + 1]].reduce((somme, [a, b]) => somme + cases[`${a},${b}`][axe], 0) / 4)
  await cliquerAuPanneau({ element: 'bouton/calque/caler' })
  for (const point of [cases[`${cx},${cy}`], noeud(cx), cases[`${cx + 4},${cy}`], noeud(cx + 8)]) {
    await cliquerPoint(...point)
  }
  await waitFor(session, `!(globalThis.wfrpEcran?.editeur?.zones['editeur.calque'] ?? []).some((l) => l.id === 'calque/calage')`)
  e = await editeur()
  assert.ok(Math.abs(echelle(e) / avantLeCalage - 0.5) < 0.02, `calée, la planche s’étire du double : ${avantLeCalage} puis ${echelle(e)} px par case`)
  noter(`« Caler par deux points », la case ${cx}, ${cy} sur son nœud, la case ${cx + 4}, ${cy} sur celui de la case ${cx + 8}, ${cy} : ${avantLeCalage} puis ${ligneDuCalque(e, 'calque/echelle')}`)
  await capturer('3508-l1b-2-planche-calee')
  await cliquerAuPanneau({ element: 'bouton/couche/1' })
  e = await editeur()
  assert.equal(boutonDeLEditeur(e, 'couche/1')?.presse, true, 'la couche 1 s’édite')
  assert.equal(e.calque_pose, false, 'la couche 1 n’a pas de calque')
  await capturer('3508-l1-3-couche-1')
  await etapeDeLaCarte()
  const scenes = (z) => z['editeur.scenes'].find((el) => el.id === 'scenes').valeurs
  const avantLAjout = scenes(e.zones)
  const titreAvantLAjout = e.zones['editeur.titre'][0].texte
  await cliquerAuPanneau({ element: 'bouton/scenes/ajouter' })
  await waitFor(session, `globalThis.wfrpEcran?.editeur?.zones['editeur.titre'][0].texte === 'Nouvelle scène'`)
  e = await editeur()
  assert.equal(scenes(e.zones).length, avantLAjout.length + 1, '« Nouvelle scène » l’ajoute au projet')
  assert.equal(boutonDeLEditeur(e, 'couche/0')?.presse, true, 'la scène neuve s’édite sur sa couche 0')
  noter(`« Nouvelle scène » : ${scenes(e.zones).length} scènes, ${e.zones['editeur.titre'][0].texte} éditée, ${Object.keys((await ecran()).cases).length} cases`)
  await capturer('3508-l6-3-scene-neuve')
  await cliquerAuPanneau({ element: 'bouton/annuler' })
  await waitFor(session, `globalThis.wfrpEcran?.editeur?.zones['editeur.scenes'].find((el) => el.id === 'scenes').valeurs.length === ${avantLAjout.length}`)
  assert.equal((await editeur()).zones['editeur.titre'][0].texte, titreAvantLAjout, '« Annuler » montre la scène d’avant l’ajout')
  noter(`« Annuler » : ${avantLAjout.length} scènes, ${titreAvantLAjout} éditée`)
  await cliquerAuPanneau({ element: 'bouton/retablir' })
  await waitFor(session, `globalThis.wfrpEcran?.editeur?.zones['editeur.scenes'].find((el) => el.id === 'scenes').valeurs.length === ${avantLAjout.length + 1} && wfrpEcran.editeur.zones['editeur.titre'][0].texte === 'Nouvelle scène'`)
  noter(`« Rétablir » : ${avantLAjout.length + 1} scènes, Nouvelle scène éditée`)
  await cliquerAuPanneau({ element: 'bouton/scenes/retirer' })
  await waitFor(session, `globalThis.wfrpEcran?.editeur?.zones['editeur.scenes'].find((el) => el.id === 'scenes').valeurs.length === ${avantLAjout.length}`)
  e = await editeur()
  assert.equal(e.zones['editeur.titre'][0].texte, avantLAjout.at(-1).libelle, 'retirée, sa précédente s’édite')
  noter(`« Retirer la scène » : ${scenes(e.zones).length} scènes, ${e.zones['editeur.titre'][0].texte} éditée`)
  const ecrite = e.zones['editeur.titre'][0].texte
  const nordDe = `globalThis.wfrpEcran?.editeur?.zones['editeur.inspecteur'].find((l) => l.id === 'scene/nord')?.texte`
  await cliquerAuPanneau({ element: 'bouton/scene/nord/plus' })
  await waitFor(session, `${nordDe} === 'Nord : 15° dans le sens horaire'`)
  const ailleurs = avantLAjout.find((b) => b.libelle !== ecrite)
  await choisirALaListe('scenes', ailleurs.id, 'editeur.scenes', `globalThis.wfrpEcran?.editeur?.zones['editeur.titre'][0].texte === ${JSON.stringify(ailleurs.libelle)}`)
  await cliquerAuPanneau({ element: 'bouton/annuler' })
  await waitFor(session, `globalThis.wfrpEcran?.editeur?.zones['editeur.titre'][0].texte === ${JSON.stringify(ecrite)} && ${nordDe} === 'Nord : vers le haut du plan'`)
  noter(`« +15° » sur ${ecrite}, ${ailleurs.libelle} choisie à la liste des scènes, « Annuler » : ${ecrite} éditée, le nord rendu au haut du plan`)
  await cliquerAuPanneau({ element: 'bouton/scenes/ajouter' })
  await waitFor(session, `globalThis.wfrpEcran?.editeur?.zones['editeur.titre'][0].texte === 'Nouvelle scène'`)
  const sceneNeuve = (await ecran()).cases
  const largeur = Math.max(...Object.keys(sceneNeuve).map((k) => Number(k.split(',')[0]))) + 1
  const hauteur = Math.max(...Object.keys(sceneNeuve).map((k) => Number(k.split(',')[1]))) + 1
  /** L'origine du bâti : le bloc de ses cases, de (-1, -1) à (9, 6), à l'écran hors du panneau et dans la carte. */
  const origine = Object.keys(sceneNeuve).map((k) => k.split(',').map(Number))
    .find(([x, y]) => x >= 1 && y >= 1 && x + 9 < largeur && y + 6 < hauteur && Array.from({ length: 11 * 8 }, (_, i) => sceneNeuve[`${x - 1 + (i % 11)},${y - 1 + Math.floor(i / 11)}`]).every(aLEcran))
  assert.ok(origine, 'un bloc de onze cases sur huit de la scène neuve à l’écran, hors du panneau')
  const [ox, oy] = origine
  /** Le point de l'écran de la case (`dx`, `dy`) du bâti, tel que l'écran le publie maintenant. */
  const aLaCase = async (dx, dy) => (await ecran()).cases[`${ox + dx},${oy + dy}`]
  const cliquerLaCase = async (dx, dy) => cliquerPoint(...(await aLaCase(dx, dy)))
  /** Un clic sur la case (`dx`, `dy`) du bâti, tout près de son côté qui la sépare de sa voisine (`vx`, `vy`). */
  const cliquerLeCote = async ([dx, dy], [vx, vy]) => {
    const [[ax, ay], [bx, by]] = [await aLaCase(dx, dy), await aLaCase(vx, vy)]
    await cliquerPoint(ax + 0.45 * (bx - ax), ay + 0.45 * (by - ay))
  }
  /** Le pointeur tenu de la première case du bâti de `chemin` à la dernière, par chacune. */
  const tirerPar = async (chemin, qui) => {
    const points = await Promise.all(chemin.map(([dx, dy]) => aLaCase(dx, dy)))
    await marquer()
    await geste(session, { surface: 'canvas', x: points[0][0], y: points[0][1] }, { qui }, async ({ x, y }, emettre) => {
      await emettre('souris', { type: 'mouseMoved', x, y })
      await emettre('souris', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 })
      await sleep(200)
      for (const [px, py] of points.slice(1)) {
        await emettre('souris', { type: 'mouseMoved', x: px, y: py, button: 'left', buttons: 1 })
        await sleep(300)
      }
      const [fx, fy] = points[points.length - 1]
      await emettre('souris', { type: 'mouseReleased', x: fx, y: fy, button: 'left', clickCount: 1 })
    })
    await nouvelEcran()
  }
  const presserTour = async (...ids) => {
    for (const id of ids) await cliquerAuPanneau({ element: `bouton/${id}` })
  }
  const options = async () => (await editeur()).zones['editeur.options'].filter((l) => l.type === 'ligne').map((l) => l.texte)
  const palier = [[8, 0], [8, 1], [8, 2]]
  await presserTour('couche/ajouter', 'outil/tile', 'pinceau/1')
  await choisirALaListe('terrains', 'terrain/dalle')
  for (const c of palier) await cliquerLaCase(...c)
  await presserTour('outil/height', 'pinceau/1', 'hauteur/haute')
  for (const c of palier) await cliquerLaCase(...c)
  await presserTour('couche/0')
  e = await editeur()
  assert.equal(boutonDeLEditeur(e, 'couche/1')?.libelle, 'Couche 1', 'la scène neuve a deux couches')
  noter(`« Ajouter une couche », le palier peint en Dallage à 4 m sur la couche 1 : ${e.zones['editeur.couches'][0].valeurs.map((b) => b.libelle).join(', ')}`)
  const aretesAvantLesMurs = e.aretes
  await presserTour('outil/wall')
  await choisirALaListe('structures', 'structure/mur-a-ossature-en-bois')
  for (const d of [0, 1, 2]) {
    await cliquerLeCote([d, 0], [d, -1])
    await cliquerLeCote([d, 2], [d, 3])
    await cliquerLeCote([0, d], [-1, d])
    await cliquerLeCote([2, d], [3, d])
  }
  await waitFor(session, `globalThis.wfrpEcran?.editeur?.aretes === ${aretesAvantLesMurs + 12}`)
  await presserTour('arete/door')
  await cliquerLeCote([1, 0], [1, -1])
  await presserTour('outil/select')
  await cliquerLeCote([2, 2], [2, 3])
  await presserTour('arete/fenetre')
  await waitFor(session, `(globalThis.wfrpEcran?.editeur?.zones['editeur.pointee'] ?? []).some((l) => l.id === 'arete' && l.texte.includes(' · fenêtre · '))`)
  e = await editeur()
  noter(`outil Murs, « Mur à ossature en bois », douze côtés cliqués autour de trois cases sur trois, une porte au nord, une fenêtre au sud : ${e.zones['editeur.pointee'].find((l) => l.id === 'arete').texte}`)
  await presserTour('outil/zone', 'zone/room')
  await tirerPar([[0, 0], [1, 1], [2, 2]], 'la pièce tirée')
  await waitFor(session, `globalThis.wfrpEcran?.editeur?.surcouche.zones.find((z) => z.choisi)?.cases.length === 9`)
  await presserTour('outil/architecture')
  await cliquerLaCase(0, 0)
  await presserTour('batir/corps', 'batir/etage')
  await waitFor(session, `globalThis.wfrpEcran?.editeur?.zones['editeur.couches'][0].valeurs.find((b) => b.presse)?.id === 'couche/1'`)
  await presserTour('couche/0', 'architecture/facade')
  await cliquerLeCote([2, 0], [2, -1])
  await waitFor(session, `(globalThis.wfrpEcran?.editeur?.zones['editeur.inspecteur'] ?? []).some((l) => l.id === 'facade/apparence')`)
  await presserTour('baie/ajouter')
  await waitFor(session, `(globalThis.wfrpEcran?.editeur?.zones['editeur.inspecteur'] ?? []).some((l) => l.id.startsWith('baie/') && l.id.endsWith('/sorte'))`)
  noter('outil Zone, la pièce tirée sur les neuf cases ; outil Architecture, « Nouveau corps », « Nouvel étage », une façade au nord et son ouverture')
  await presserTour('outil/stair', 'etage/1')
  await tirerPar([[4, 1], [5, 1], [6, 1], [7, 1]], 'la volée tracée')
  await waitFor(session, 'globalThis.wfrpEcran?.editeur?.surcouche.cases.length === 4')
  const plan = await options()
  assert.deepEqual(plan, ['Tracé : 4 cases', '0 m → 4 m · cotes 1 · 2 · 3 · 4 m'], 'la volée tracée monte au palier')
  await presserTour('volee/poser')
  await waitFor(session, 'globalThis.wfrpEcran?.editeur?.surcouche.cases.length === 0')
  noter(`outil Volée, quatre cases tirées vers le palier : ${plan.join(', ')} ; « Poser la volée »`)
  await presserTour('outil/prop')
  await cliquerLaCase(5, 4)
  await presserTour('outil/select')
  await cliquerLaCase(5, 4)
  await presserTour('entite/cap/E')
  await presserTour('outil/heroStart')
  await cliquerLaCase(3, 5)
  await presserTour('outil/zone', 'zone/trigger')
  await tirerPar([[6, 4], [7, 5], [8, 6]], 'le déclencheur tiré')
  await waitFor(session, `globalThis.wfrpEcran?.editeur?.surcouche.zones.find((z) => z.choisi)?.cases.length === 9`)
  e = await editeur()
  const validation = e.zones['editeur.validation'][0].texte
  assert.match(validation, /^Validation : 0 erreur\(s\)/, 'la scène bâtie ne porte aucune erreur')
  noter(`un décor tourné à l’est, un départ, un déclencheur tiré sur trois cases sur trois : ${validation}`)
  await capturer('3508-l7-1-batie')
  const avantLeBati = lus()
  await cliquerAuPanneau({ element: 'bouton/enregistrer' })
  await waitFor(session, `Object.values(globalThis.wfrpEcran?.editeur?.zones ?? {}).flat().some((el) => el.id === 'enregistrer' && el.refus === 'Rien à enregistrer')`)
  const ecrit = lus().findIndex((texte, i) => texte !== avantLeBati[i])
  const anciennes = new Set(JSON.parse(avantLeBati[ecrit]).scenes.map((sc) => sc.id))
  const batie = JSON.parse(lus()[ecrit]).scenes.find((sc) => !anciennes.has(sc.id))
  const ici = (dx, dy) => ({ x: ox + dx, y: oy + dy })
  assert.deepEqual(batie.layers.map((l) => l.z), [0, 1], 'deux couches')
  assert.deepEqual([4, 5, 6, 7].map((dx) => batie.layers[0].height[(oy + 1) * largeur + ox + dx]), [1, 2, 3, 4], 'la volée cotée de cran en cran')
  assert.equal(batie.walls.filter((w) => w.structure === 'mur-a-ossature-en-bois').length, 11, 'onze murs à ossature en bois')
  assert.deepEqual(batie.walls.filter((w) => w.door).map((w) => [w.x, w.y, w.side]), [[ox + 1, oy, 'N']], 'la porte au nord')
  assert.deepEqual(batie.walls.filter((w) => w.window).map((w) => [w.x, w.y, w.side]), [[ox + 2, oy + 3, 'N']], 'la fenêtre au sud')
  assert.deepEqual(batie.architecture[0].storeys.map((st) => st.z), [0, 1], 'un corps de deux étages')
  assert.equal(batie.architecture[0].facades.flatMap((f) => f.features ?? []).length, 1, 'une façade et son ouverture')
  assert.deepEqual(batie.effectZones.map((z) => [z.presentation, z.area]), [['interior', { kind: 'rect', ...ici(0, 0), w: 3, h: 3 }]], 'la pièce')
  assert.deepEqual(batie.entities.map((en) => [en.kind, en.pos, en.facing]), [['prop', ici(5, 4), 'E'], ['heroStart', ici(3, 5), undefined]], 'le décor tourné, le départ')
  assert.deepEqual(batie.triggers.map((tr) => [tr.rect, tr.flow]), [[{ ...ici(6, 4), w: 3, h: 3 }, { kind: 'sequence', etapes: [] }]], 'le déclencheur, au flux vide')
  noter(`« Enregistrer » : ${MANUSCRITS[ecrit]} porte la scène ${batie.id} : ${batie.layers.length} couches, ${batie.walls.length} arêtes, ${batie.architecture[0].storeys.length} étages, ${batie.effectZones.length} pièce, ${batie.entities.length} entités, ${batie.triggers.length} déclencheur`)
  await cliquerAuPanneau({ element: 'bouton/logique/dialogue/ajouter' })
  await waitFor(session, montre('dialogue/noeud/n1'))
  e = await editeur()
  const dialogue = inspecte(e, 'nommer').champs[0].valeur
  assert.equal(boutonDeLEditeur(e, `logique/dialogue/${dialogue}`)?.presse, true, '« Ajouter un dialogue » : le dialogue neuf, pressé à la zone Logique, à l’inspecteur')
  await choisirAuChamp('valeur/nodes/ajouter', (v) => v.at(-1)?.id === 'n2', montre('dialogue/noeud/n2'))
  const ligneDuNoeud = (id) => `globalThis.wfrpEcran?.editeur?.zones['editeur.inspecteur'].find((el) => el.id === 'dialogue/noeud/${id}')?.texte`
  await choisirAuChamp('valeur/start/id', (v) => v === 'n2', `${ligneDuNoeud('n2')} === '▶ n2'`)
  await taper('saisieTexte/identifier/noeud/n2/id', 'accueil')
  await cliquerAuPanneau({ element: 'formulaire/identifier/noeud/n2' })
  await waitFor(session, `${ligneDuNoeud('accueil')} === '▶ accueil'`)
  e = await editeur()
  noter(`« Ajouter un dialogue » : « ${dialogue} », ${e.zones['editeur.logique'].find((el) => el.id === 'logique/dialogue').texte} ; un nœud ajouté, choisi au départ, identifié « accueil » : ${inspecte(e, 'dialogue/noeud/accueil').texte}`)
  await capturer('3606-m3b2-1-dialogue')
  await cliquerAuPanneau({ element: 'bouton/dialogue/supprimer' })
  await waitFor(session, `!(globalThis.wfrpEcran?.editeur?.zones['editeur.logique'] ?? []).some((el) => (el.valeurs ?? []).some((b) => b.id === 'logique/dialogue/${dialogue}'))`)
  noter(`« Supprimer » : ${(await editeur()).zones['editeur.logique'].find((el) => el.id === 'logique/dialogue').texte}`)
  await cliquerAuPanneau({ element: 'bouton/logique/rencontre/ajouter' })
  await waitFor(session, montre('rencontre/membres'))
  e = await editeur()
  const rencontre = inspecte(e, 'nommer').champs[0].valeur
  assert.equal(boutonDeLEditeur(e, `logique/rencontre/${rencontre}`)?.presse, true, '« Ajouter une rencontre » : la rencontre neuve, pressée à la zone Logique, à l’inspecteur')
  const objectif = `globalThis.wfrpEcran?.editeur?.zones['editeur.inspecteur'].find((el) => el.id === 'valeur/victoryCondition/type')?.valeurs.find((b) => b.presse)?.jeu.args[2]?.type`
  await choisirAuChamp('valeur/victoryCondition/type', (v) => v?.type === 'surviveRounds', `${objectif} === 'surviveRounds'`)
  e = await editeur()
  noter(`« Ajouter une rencontre » : « ${rencontre} », ${e.zones['editeur.logique'].find((el) => el.id === 'logique/rencontre').texte} ; ${inspecte(e, 'rencontre/membres').texte} ; objectif « ${inspecte(e, 'valeur/victoryCondition/type').valeurs.find((b) => b.presse).libelle} »`)
  await capturer('3606-m4c-1-rencontre')
  await cliquerAuPanneau({ element: 'bouton/rencontre/supprimer' })
  await waitFor(session, `!(globalThis.wfrpEcran?.editeur?.zones['editeur.logique'] ?? []).some((el) => (el.valeurs ?? []).some((b) => b.id === 'logique/rencontre/${rencontre}'))`)
  noter(`« Supprimer » : ${(await editeur()).zones['editeur.logique'].find((el) => el.id === 'logique/rencontre').texte}`)
  await etapeDeLEmbuscade()
  await etapeDuNarratif()
  await cliquerAuPanneau({ element: 'bouton/tester' })
  await waitFor(session, '!globalThis.wfrpEcran?.editeur && !!globalThis.wfrpEcran?.cases && wfrpEcran.boutons.length > 0', { timeoutMs: 120000 })
  const v = await vue()
  assert.equal(v.projection.scene?.nom, 'Nouvelle scène', '« Tester la scène » ouvre le combat sur la scène bâtie')
  noter(`« Tester la scène » : partie ouverte sur ${v.projection.scene.nom}, ${Object.keys((await ecran()).cases).length} cases`)
  await capturer('3508-l7-2-essai')
}

/** La page ouverte de la création : son titre. */
const pageOuverte = (v) => zone(v, 'creation.titre')[0]?.texte

async function parcoursCreation() {
  await cliquerBouton('Combat')
  await waitFor(session, '!!globalThis.wfrpEcran?.cases && wfrpEcran.boutons.length > 0', { timeoutMs: 120000 })
  let v = await fermerLesFenetres()
  const avant = zone(v, 'groupe.heros').length
  v = await presser('groupe.gestes', 'creation')
  assert.equal(pageOuverte(v), 'Race · 1/10', '« Nouveau héros » ouvre la création sur sa première page')
  assert.equal(zone(v, 'creation.corps').some((e) => e.type === 'jet'), false, 'avant le d100, aucun résultat')
  assert.equal(trouver((await ecran()).boutons, { element: 'bouton/suivante' }), undefined, 'la suivante refusée ne se joue pas')
  noter(`création ouverte : ${zone(v, 'creation.corps').map((e) => e.libelle).join(' · ')}`)
  await capturer('3328-creation-1-race')
  v = await presser('creation.corps', 'tirage')
  const d100 = element(v, 'creation.corps', 'tirage')
  assert.equal(d100.type, 'jet', 'le d100 tombé se dit')
  const espece = element(v, 'creation.corps', 'espece').libelle
  noter(`d100 ${d100.resultat} : ${espece}`)
  await capturer('3328-creation-2-race-tiree')
  await marquer()
  await realKey(session, { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
  await nouvelEcran()
  v = await vue()
  assert.equal(pageOuverte(v), 'Carrière · 2/10', 'la race choisie, l’Entrée joue la suivante')
  v = await presser('creation.corps', 'tirage')
  const carriere = element(v, 'creation.corps', 'tirees').valeurs.find((b) => b.presse).libelle
  noter(`carrière tirée : ${carriere}`)
  await capturer('3328-creation-3-carriere-tiree')
  v = await presser('creation.gestes', 'suivante')
  assert.equal(pageOuverte(v), 'Caractéristiques · 3/10')
  v = await presser('creation.corps', 'tirage')
  const caracs = zone(v, 'creation.corps').filter((e) => e.type === 'puce' && e.id.startsWith('carac/'))
  assert.ok(caracs.length === 10 && caracs.every((p) => /^\d+$/.test(p.valeur)), 'les dix Caractéristiques tirées se disent')
  noter(`Caractéristiques : ${caracs.map((p) => `${p.libelle} ${p.valeur}`).join(' · ')}`)
  await capturer('3328-creation-4-caracteristiques')
  v = await presser('groupe.gestes', 'creation')
  assert.deepEqual(zone(v, 'creation.titre'), [], '« Nouveau héros » pressé ferme la création')
  assert.equal(zone(v, 'groupe.heros').length, avant, 'fermée, aucun héros ne rejoint le groupe')
}

const atelier = async () => (await ecran()).atelier
/** Attend que l'atelier publié vérifie `condition` (une expression sur `a`, et `b`, les boutons publiés). */
const attendreLAtelier = (condition, timeoutMs = 60000) =>
  waitFor(session, `(() => { const a = globalThis.wfrpEcran?.atelier, b = globalThis.wfrpEcran?.boutons; return !!a && !!(${condition}) })()`, { timeoutMs })

/** La production `dossier` importée sous l'id `id` dans `--modeles`, sans rien publier, avec les `options` d'`importer.mjs` ;
 *  le refus de l'import lève, collé. */
function importer(dossier, id, options = []) {
  const r = spawnSync(process.execPath, [IMPORTER, dossier, id, '--destination', o.modeles, '--sans-publier', ...options], { encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`import de ${dossier} sous ${id} refusé (code ${r.status}) :\n${r.stderr}${r.stdout}`)
  noter(`import de ${id} : ${r.stdout.split('\n')[1].replaceAll(o.modeles, '')}`)
}

/** Le `deltaY` d'un cran de molette de Chrome sous Windows. Le panneau en défile moins que la hauteur de sa fenêtre :
 *  aucun bouton ne passe entre deux écrans publiés (#3111). */
const CRAN_DE_MOLETTE = 100
/** Un cran de molette au point `ou`, vers le bas (`sens` 1) ou le haut (-1) : `true` si le défilement publié de l'atelier
 *  (`atelier.defilement`) change en `FIN_DE_COURSE_MS`, `false` sinon, au bout de course. Une publication sans défilement
 *  (chaque image d'un clip lu) ne compte pas. */
const FIN_DE_COURSE_MS = 3000
async function cran(sens, ou) {
  const avant = (await atelier()).defilement
  assert.equal(typeof avant, 'number', `l'atelier publie son défilement ; reçu ${JSON.stringify(avant)}`)
  await molette(session, { surface: 'canvas', x: ou.x, y: ou.y }, sens * CRAN_DE_MOLETTE)
  return waitFor(session, `(() => { const d = globalThis.wfrpEcran?.atelier?.defilement; return typeof d === 'number' && d !== ${avant} })()`, { timeoutMs: FIN_DE_COURSE_MS }).then(
    () => true,
    (e) => {
      if (e.code === ATTENTE_ECHUE) return false
      throw e
    },
  )
}
/** Le bouton `quoi` amené à l'écran par la molette tournée au point `ou`, vers le bas (`sens` 1) ou le haut (-1). */
async function amener(quoi, sens, ou = PANNEAU) {
  for (let n = 0; n < CRANS; n++) {
    const b = trouver((await ecran()).boutons, quoi)
    if (b) return b
    if (!(await cran(sens, ou))) break
  }
  const { boutons } = await ecran()
  throw new Error(`bouton ${JSON.stringify(quoi)} hors de l'écran, panneau tourné ${sens > 0 ? 'vers le bas' : 'vers le haut'} ; boutons : ${boutons.map((x) => x.cle ?? x.texte).join(' | ')}`)
}
/** Le panneau tourné à la molette au point `PANNEAU` dans le sens `sens` jusqu'au bout de sa course ; `relever` reçoit
 *  chaque écran publié. */
async function tournerJusquAuBout(sens, relever = () => {}) {
  for (let n = 0; n < CRANS; n++) {
    relever((await ecran()).boutons)
    if (!(await cran(sens, PANNEAU))) return
  }
  throw new Error(`panneau encore en mouvement après ${CRANS} crans de molette`)
}
/** Les articles de chaque liste déroulante de l'onglet courant, par clé, relevés du haut au bas du panneau ; le
 *  panneau revient en haut. */
async function listesDuPanneau() {
  await tournerJusquAuBout(-1)
  const listes = {}
  await tournerJusquAuBout(1, (boutons) => boutons.forEach((b) => b.cle && b.choix && (listes[b.cle] = b.choix)))
  await tournerJusquAuBout(-1)
  return listes
}
async function cliquerAmene(quoi, sens, ou) {
  await amener(quoi, sens, ou)
  await cliquerBouton(quoi)
}
/** L'article `article` choisi dans la liste déroulante de clé `cle`, ou dans celle qui l'offre sans clé, amenée à l'écran dans le sens `sens` : son texte,
 *  ou `{ id }`, son id publié (`ids`) ; la liste ouverte au clic, puis l'article désigné au clavier
 *  (`designerALaListe`) et retenu à l'Entrée. */
async function choisirDansLaListe(cle, article, sens = 1) {
  const quoi = cle === undefined ? { choix: article } : { cle }
  const liste = await amener(quoi, sens)
  const rang = typeof article === 'string' ? liste.choix.indexOf(article) : liste.ids.indexOf(article.id)
  assert.ok(rang >= 0, `« ${typeof article === 'string' ? article : article.id} » offert par la liste ${cle} : ${liste.choix.join(', ')}`)
  await geste(session, { surface: 'canvas', x: liste.x, y: liste.y }, { qui: `liste ${cle ?? article}` }, clic())
  await designerALaListe(quoi, rang)
  await marquer()
  await realKey(session, { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
  await nouvelEcran()
}

/** Les appels de Godot au pont, comptés par méthode dans `recetteAppels` de la page : `wfrpPont.appelerEnOctets`
 *  enveloppé, la porte du transport de la page (`projet/scripts/transport_de_la_page.gd`), relue sur
 *  `globalThis.wfrpPont` à chaque appel ; le tampon des mesures de ressources élargi pour que chaque requête y entre. */
const SONDER_LA_PAGE = `(() => {
  performance.setResourceTimingBufferSize(1e6)
  const pont = globalThis.wfrpPont, appelerEnOctets = pont.appelerEnOctets, n = (globalThis.recetteAppels = {})
  pont.appelerEnOctets = function (methode, ...reste) { n[methode] = (n[methode] ?? 0) + 1; return appelerEnOctets.call(this, methode, ...reste) }
  return true
})()`
/** Le nombre d'appels `methode` de Godot au pont depuis `SONDER_LA_PAGE`. */
const appels = (methode) => evaluate(session, `globalThis.recetteAppels[${JSON.stringify(methode)}] ?? 0`)
/** Le nombre de requêtes du GLB de l'élément `id` (`modeles/<id>.glb`) relevées par la page. */
const requetesDuGlb = (id) =>
  evaluate(session, `performance.getEntriesByType('resource').filter((e) => new URL(e.name).pathname.endsWith(${JSON.stringify(`/modeles/${id}.glb`)})).length`)
/** Les requêtes du GLB de `elementId` et les appels `composer` relevés. */
const releve = async (elementId) => ({ glb: await requetesDuGlb(elementId), composer: await appels('composer') })

/** L'emblème de libellé `texte` choisi dans la liste de la prise `main` (« Aucun » pour aucun), l'état publié qui le
 *  porte, ou une erreur, attendu ; aucune erreur publiée. L'id de l'emblème posé, `undefined` sous « Aucun ». */
async function choisirLEmbleme(texte) {
  await choisirDansLaListe('main/embleme', texte)
  await attendreLAtelier(`a.erreurs.length > 0 || ${texte === AUCUN ? '!("main" in a.emblemes)' : '"main" in a.emblemes'}`)
  const { erreurs, emblemes } = await atelier()
  assert.deepEqual(erreurs, [], `l’emblème « ${texte} » posé sans erreur`)
  return emblemes.main
}
/** À la prise `main`, où l'élément `elementId` monté porte une surface `blason` : la liste des emblèmes relevée, le
 *  premier puis le second posés et capturés, puis « Aucun » ; le premier reposé, ces quatre choix sans requête du GLB
 *  ni appel `composer`. Les libellés des emblèmes offerts. */
async function poserLesEmblemes(elementId) {
  await attendreLAtelier('b.some((x) => x.cle === "main/embleme")')
  assert.deepEqual((await atelier()).emblemes, {}, 'monté sans emblème')
  const offerts = (await listesDuPanneau())['main/embleme'].filter((texte) => texte !== AUCUN)
  assert.ok(offerts.length >= 2, `deux emblèmes offerts au moins : ${offerts.join(', ')}`)
  const [a, b] = offerts
  const avant = await releve(elementId)
  await choisirLEmbleme(a)
  noter(`emblème « ${a} » posé à la prise « main »`)
  await capturer('3111-1-embleme-a')
  const idB = await choisirLEmbleme(b)
  assert.deepEqual((await atelier()).emblemes, { main: idB }, 'le second emblème remplace le premier')
  noter(`emblème « ${b} » posé à sa place`)
  await capturer('3111-2-embleme-b')
  await choisirLEmbleme(AUCUN)
  noter('emblème « Aucun » : la surface rendue à son matériau')
  await choisirLEmbleme(a)
  const apres = await releve(elementId)
  const delta = { glb: apres.glb - avant.glb, composer: apres.composer - avant.composer }
  noter(`emblèmes « ${a} », « ${b} », « Aucun », « ${a} » : GLB de « ${elementId} » requis ${avant.glb} → ${apres.glb}, \`composer\` appelé ${avant.composer} → ${apres.composer}`)
  assert.deepEqual(delta, { glb: 0, composer: 0 }, 'un changement d’emblème seul ne recharge pas le GLB et ne compose pas')
  return offerts
}

/** L'id de la fiche du véhicule que le parcours `atelier` pose sans `--modeles`, et les Améliorations qu'il installe,
 *  le Sabord en tête : il change les places de tribord et de bâbord. */
const VEHICULE_DE_L_ATELIER = 'caraque'
const AMELIORATIONS_DE_L_ATELIER = ['sabord', 'figure-de-proue', 'ancre', 'nid-de-pie', 'clinfoc', 'embarcation-de-bord', 'safran', 'fourquines']
/** Les places de poste que le parcours arme d'une pièce, par clé de leur liste (`poste/<bord>/<rang>`). */
const PLACES_ARMEES = ['poste/tribord/0', 'poste/tribord/1', 'poste/babord/0', 'poste/babord/1', 'poste/proue/0']
/** Le glissé au bouton droit qui tourne l'orbite de l'atelier de trois quarts sur le véhicule. */
const TROIS_QUARTS = { x: 900, y: 360, dx: -220 }

/** Le véhicule de l'atelier publié conforme à ce que le pont compose pour son entrée (`vehicule`, appelé de la page sur
 *  la fiche, les pièces et les Améliorations demandées, la palette de la composition courante et l'emblème posé) : son
 *  élément, son emblème, les éléments de ses pièces et de ses Améliorations, et les nœuds cachés, ceux de `caches`
 *  compris, sans erreur. Le corps composé. */
async function prouverLeVehicule() {
  const a = await atelier()
  const entree = { definition: a.vehicule.definition, ...a.vehicule.demande, ...(a.composition.courante.couleurs ? { couleurs: a.composition.courante.couleurs } : {}), ...(a.vehicule.embleme ? { embleme: { id: a.vehicule.embleme } } : {}) }
  const { vehicule: corps } = JSON.parse(await evaluate(session, `wfrpPont.appeler('vehicule', ${JSON.stringify(JSON.stringify(entree))})`))
  assert.deepEqual(a.erreurs, [], 'le véhicule posé sans erreur')
  assert.deepEqual([a.vehicule.element, a.vehicule.embleme, a.vehicule.postes, a.vehicule.ameliorations], [corps.element, corps.embleme?.id ?? null, corps.postes.map((x) => x.element), corps.ameliorations.map((x) => x.element)], 'le véhicule posé est celui que le pont compose')
  assert.ok(corps.caches.every((nom) => a.vehicule.caches.includes(nom)), `les nœuds ${corps.caches.join(', ')} cachés : ${a.vehicule.caches.join(', ')}`)
  noter(`« ${corps.element} » : ${corps.postes.length} pièces de poste, ${corps.ameliorations.length} pièces d’Amélioration, emblème ${corps.embleme?.id ?? 'aucun'}, cachés ${a.vehicule.caches.join(', ') || 'aucun'} ; boîte ${a.vehicule.taille.map((x) => x.toFixed(1)).join(' × ')} m, orbite ×${a.cadre.toFixed(2)}`)
  return corps
}

/** Le bouton `quoi` du panneau de l'atelier amené à l'écran, la molette tournée vers le bas, puis vers le haut : le
 *  panneau d'un véhicule se repose à chaque corps reçu. */
async function chercher(quoi) {
  try {
    return await amener(quoi, 1)
  } catch {
    return amener(quoi, -1)
  }
}

/** L'atelier publié quand son véhicule a reçu le corps que `condition` (une expression sur `v`, le véhicule publié) attend. */
const attendreLeVehicule = (condition) => attendreLAtelier(`(() => { const v = a.vehicule; return !!v && !!(${condition}) })()`, 180000)

/** Sans `--modeles`, le véhicule dans l'atelier (#2987), sur le dossier des modèles du projet, la page à
 *  deviceScaleFactor 2 : la caraque choisie à la liste de tête « Véhicule ou engin », posée et cadrée à sa taille ; à l'onglet
 *  Équipement, une pièce à chaque place de `PLACES_ARMEES`, puis chaque Amélioration de `AMELIORATIONS_DE_L_ATELIER`
 *  installée ; une couleur à l'onglet Couleurs et un emblème sur ses voiles ; puis le Sabord retiré. À chaque étape, le
 *  véhicule publié est celui que le pont compose (`prouverLeVehicule`), capturé de trois quarts. */
async function parcoursAtelierDuVehicule() {
  await enHauteDefinition()
  await cliquerBouton('Atelier')
  await attendreLAtelier("Array.isArray(a.erreurs) && b.some((x) => x.cle === 'modele/vehicule')", 120000)
  await choisirDansLaListe('modele/vehicule', { id: VEHICULE_DE_L_ATELIER })
  await attendreLeVehicule(`v.element !== null && v.definition === ${JSON.stringify(VEHICULE_DE_L_ATELIER)}`)
  const nue = await prouverLeVehicule()
  assert.deepEqual([nue.postes, nue.ameliorations], [[], []], 'la coque nue, sans pièce ni Amélioration')
  assert.ok(Math.max(...(await atelier()).vehicule.taille) > 30 && (await atelier()).cadre > 5, 'la coque d’une trentaine de mètres cadrée à sa taille')
  await geste(session, { surface: 'canvas', x: TROIS_QUARTS.x, y: TROIS_QUARTS.y }, { qui: 'orbite de trois quarts' }, clic({ bouton: 'right', trajet: [{ x: TROIS_QUARTS.dx, y: 0 }] }))
  await capturer('2987-atelier-1-caraque-nue')

  await cliquerBouton('Équipement')
  for (const [n, cle] of PLACES_ARMEES.entries()) {
    const liste = await chercher({ cle })
    await choisirDansLaListe(cle, liste.choix.find((texte) => /moyen/i.test(texte)))
    await attendreLeVehicule(`v.postes.length === ${n + 1}`)
  }
  await prouverLeVehicule()
  await capturer('2987-atelier-2-canons-au-pont')
  for (const [n, amelioration] of AMELIORATIONS_DE_L_ATELIER.entries()) {
    await chercher({ cle: `amelioration/${amelioration}` })
    await cliquerBouton({ cle: `amelioration/${amelioration}` })
    await attendreLeVehicule(`v.demande.ameliorations.length === ${n + 1} && v.ameliorations.length > 0`)
    if (amelioration === 'sabord') {
      const corps = await prouverLeVehicule()
      assert.ok(corps.caches.includes('sans-sabord') && corps.ameliorations.some((x) => x.poste?.montre === 'ouvert'), 'le Sabord installé : le pont du canon caché, les canons aux sabords ouverts')
      await capturer('2987-atelier-3-sabords')
    }
  }
  await prouverLeVehicule()
  await capturer('2987-atelier-4-ameliorations')

  await cliquerBouton('Couleurs')
  const { nuancier } = JSON.parse(await evaluate(session, `wfrpPont.appeler('catalogues')`))
  await choisirDansLaListe('couleur/vet1', nuancier.at(-1).label)
  await attendreLeVehicule(`v.couleurs.toile === ${JSON.stringify(nuancier.at(-1).couleur.toLowerCase())}`)
  await cliquerBouton('Équipement')
  const emblemes = await chercher({ cle: 'vehicule/embleme' })
  await choisirDansLaListe('vehicule/embleme', emblemes.choix[1])
  await attendreLeVehicule('v.embleme !== null')
  await prouverLeVehicule()
  await capturer('2987-atelier-5-voiles-et-pavillon')

  await chercher({ cle: 'amelioration/sabord' })
  await cliquerBouton({ cle: 'amelioration/sabord' })
  await attendreLeVehicule(`!v.demande.ameliorations.includes('sabord') && v.caches.includes('avec-sabord')`)
  const sans = await prouverLeVehicule()
  assert.ok(sans.caches.includes('avec-sabord') && !sans.ameliorations.some((x) => x.poste), 'le Sabord retiré : ses pièces démontées, les canons rendus au pont')
  await capturer('2987-atelier-6-sabord-retire')
}

async function parcoursAtelier() {
  if (!o.modeles) return parcoursAtelierDuVehicule()
  const [p0, element, p1] = [production(o.base), production(o.element), production(o.reexport)]
  const base = p0.manifeste.base
  const elementId = element.manifeste.cle.apparence
  assert.notEqual(p0.model_sha256, p1.model_sha256, 'la réexportation change les octets de la base')
  importer(o.base, base)
  await cliquerBouton('Atelier')
  noter('menu : bouton « Atelier » cliqué')
  await attendreLAtelier(`a.base === ${JSON.stringify(base)}`, 120000)
  await choisirDansLaListe('modele/corps', base)
  let a = await atelier()
  assert.deepEqual([a.base, a.empreinte, a.erreurs], [base, p0.model_sha256, []], 'la base choisie, à l’empreinte de son import, sans erreur')
  await cliquerBouton('Équipement')
  assert.deepEqual((await ecran()).boutons.filter((b) => b.cle), [], 'sans élément indexé, aucun emplacement n’a de liste')
  noter(`base « ${base} » choisie, empreinte ${a.empreinte.slice(0, 12)} ; aucun emplacement à l’onglet Équipement`)
  await capturer('3086-a1-1-base-sans-element')

  importer(o.element, elementId)
  await evaluate(session, SONDER_LA_PAGE)
  await cliquerBouton('Outils')
  await cliquerAmene(RECHARGER, 1)
  await cliquerBouton('Équipement')
  await attendreLAtelier('b.some((x) => x.cle === "main")')
  const { osDesRigides } = await (await fetch(`${srv.url}modeles/${LISTAGE}`)).json()
  const pend = (attache) => osDesRigides[elementId].includes(attache.os)
  const tenu = Object.values(p0.manifeste.prises).some(pend)
  const { emplacementsDeRangement } = await chargerAssets(["export { emplacementsDeRangement } from '/src/noyau/index.ts';"])
  const rangements = tenu ? emplacementsDeRangement(element.manifeste.cle.apparence) : []
  const porteurs = [...Object.entries(p0.manifeste.emplacements).filter(([point, attache]) => pend(attache) || rangements.includes(point)).map(([point]) => point), ...(tenu ? Object.keys(p0.manifeste.prises) : [])]
  const listages = await appels('modeles')
  assert.ok(listages > 0, 'témoin : l’appel `modeles` de Godot au pont relevé par l’enveloppe')
  assert.ok(tenu, `l’os d’une prise porte « ${elementId} » (${osDesRigides[elementId].join(', ')}) : il est offert à la prise « main »`)
  const listes = await listesDuPanneau()
  const libelle = listes.main[1]
  const desPoints = Object.fromEntries(Object.entries(listes).filter(([cle]) => !cle.includes('/')))
  assert.deepEqual(desPoints, tableTotale(porteurs, () => [AUCUN, libelle]), `« ${elementId} » offert à chaque prise, aux emplacements dont l’os le porte et à ceux où se range sa forme`)
  noter(`« ${RECHARGER} » : « ${elementId} » (« ${libelle} ») offert aux points ${porteurs.join(', ')} (os ${osDesRigides[elementId].join(', ')}) ; les autres n’ont pas de rangée`)
  await cliquerBouton('Outils')
  for (const aide of ['Os', 'Prises']) await cliquerAmene(aide, 1)
  a = await atelier()
  assert.deepEqual(a.aides, { os: true, emplacements: false, prises: true }, 'les aides cochées sont montrées')

  await cliquerBouton('Équipement')
  const avantLeMontage = await requetesDuGlb(elementId)
  await choisirDansLaListe('main', libelle)
  await attendreLAtelier(`a.montes.main === ${JSON.stringify(elementId)}`)
  const auMontage = await requetesDuGlb(elementId)
  assert.ok(auMontage > avantLeMontage, `témoin : le GLB de « ${elementId} » requis au montage relevé par la page (${avantLeMontage} → ${auMontage})`)
  noter(`« ${elementId} » monté à la prise « main » ; témoins : GLB requis ${avantLeMontage} → ${auMontage}, \`modeles\` appelé ${listages} fois`)
  await capturer('3086-a1-2-element-monte')
  const blason = element.manifeste.surfaces.some((s) => s.blason === true)
  if (!blason) noter(`« ${elementId} » sans surface \`blason\` : preuve des emblèmes non jouée`)
  const emblemes = blason ? await poserLesEmblemes(elementId) : []
  await choisirDansLaListe('main', AUCUN, -1)
  await attendreLAtelier('!("main" in a.montes)')
  assert.deepEqual((await atelier()).emblemes, {}, 'démonter efface l’emblème')
  noter('« Aucun » : la prise « main » démontée, sans emblème')
  await choisirDansLaListe('main', libelle, -1)
  await attendreLAtelier(`a.montes.main === ${JSON.stringify(elementId)}`)
  if (emblemes.length) {
    await attendreLAtelier('b.some((x) => x.cle === "main/embleme")')
    assert.deepEqual((await atelier()).emblemes, {}, 'remonté sans emblème')
    noter(`« ${elementId} » remonté sans emblème`)
    await choisirLEmbleme(emblemes[0])
    noter(`« ${emblemes[0]} » reposé avant « ${RECHARGER} »`)
  }

  await cliquerBouton('Animation')
  await choisirDansLaListe('clip', o.clip)
  await attendreLAtelier(`a.clip === ${JSON.stringify(o.clip)} && a.lecture`)
  await cliquerAmene('Pause', 1)
  await attendreLAtelier('a.lecture === false')
  a = await atelier()
  assert.deepEqual([a.clip, a.lecture], [o.clip, false], 'la pause arrête le clip')
  const { instant: enPause, duree } = a
  const ecart = (depart, arrivee) => (((arrivee - depart) % duree) + duree) % duree
  await cliquerAmene('Image suivante', 1)
  const suivante = (await atelier()).instant
  await marquer()
  await realKey(session, { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
  await nouvelEcran()
  const encore = (await atelier()).instant
  const image = ecart(suivante, encore)
  assert.ok(ecart(enPause, suivante) > 0 && ecart(enPause, suivante) < duree / 2 && image > 0 && image < duree / 2, `chaque image suivante avance l’instant sur le clip bouclé de ${duree} s : ${enPause} → ${suivante} → ${encore}`)
  await cliquerBouton('Image précédente')
  a = await atelier()
  const precedente = a.instant
  assert.ok(Math.min(ecart(suivante, precedente), ecart(precedente, suivante)) < 1e-6, `l’image précédente revient d’une image : ${encore} → ${precedente}`)
  noter(`pause à ${enPause} s sur ${duree} s ; image suivante (clic) ${suivante}, (Entrée) ${encore}, précédente ${precedente} : une image ${image.toFixed(4)} s`)
  await cliquerAmene('×0.5', 1)
  a = await atelier()
  assert.deepEqual([a.vitesse, a.lecture, a.instant], [0.5, false, precedente], 'la vitesse se règle, la pause tient l’instant')
  await cliquerBouton('Lecture')
  await attendreLAtelier('a.lecture === true')
  assert.equal((await atelier()).lecture, true, 'la lecture reprend')
  await sleep(500)
  await cliquerBouton('Pause')
  await attendreLAtelier('a.lecture === false')
  const avant = await atelier()
  assert.ok(avant.instant !== precedente && avant.lecture === false, `la lecture a avancé le clip : ${precedente} → ${avant.instant}`)
  noter(`×0.5, lecture puis pause : ${avant.instant} s`)
  await capturer('3086-a1-3-clip-en-pause')

  importer(o.reexport, base, ['--remplacer'])
  noter(`« ${base} » remplacée par sa réexportation (--remplacer) : « ${elementId} », qui la référence, revalidé contre elle et laissé en place`)
  await evaluate(session, '(globalThis.recetteSansRelance = true)')
  await cliquerBouton('Outils')
  await cliquerAmene(RECHARGER, -1)
  await attendreLAtelier(`a.empreinte === ${JSON.stringify(p1.model_sha256)} && a.montes.main === ${JSON.stringify(elementId)} && a.clip !== null`, 120000)
  const apres = await atelier()
  assert.equal(await evaluate(session, 'globalThis.recetteSansRelance === true'), true, 'la page n’a pas été relancée')
  assert.ok(Math.abs(apres.instant - avant.instant) < 1e-6, `l’instant gardé : ${avant.instant} → ${apres.instant}`)
  const etat = ({ base: b, clip, lecture, vitesse, montes, emblemes: e, aides, erreurs }) => ({ b, clip, lecture, vitesse, montes, e, aides, erreurs })
  assert.deepEqual(etat(apres), etat(avant), 'clip, pause, vitesse, montés, emblèmes, aides gardés')
  noter(`« ${RECHARGER} » sans relance : empreinte ${avant.empreinte.slice(0, 12)} → ${apres.empreinte.slice(0, 12)} ; ${apres.clip} à ${apres.instant} s en pause, ×${apres.vitesse}, montés ${JSON.stringify(apres.montes)}, emblèmes ${JSON.stringify(apres.emblemes)}, aides ${JSON.stringify(apres.aides)}`)
  await capturer('3086-a1-4-reexport-recharge')
}

const proche = (a, b, tolerance, quoi) => assert.ok(Math.abs(a - b) <= tolerance, `${quoi} : ${a} contre ${b} (tolérance ${tolerance})`)
const horizontal = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2])

async function choisirAxe(catalogues, champ, id) {
  const axe = catalogues.axes.find((x) => x.champ === champ)
  assert.ok(axe && axe.forme !== 'plage', `sélecteur ${champ} publié`)
  const offert = id === null ? undefined : catalogues[axe.liste].find((x) => x.id === id)
  assert.ok(id === null || offert, `${id} offert sur ${champ}`)
  await choisirDansLaListe(`axe/${champ}`, offert?.label ?? AUCUN, -1)
  const courante = (await atelier()).composition.courante[champ]
  assert.equal(courante?.id ?? courante ?? null, id, `axe ${champ} choisi au clavier`)
}

/** À l'onglet Couleurs, l'emplacement de palette de la première surface de la pièce `piece` montée à la ligne `ligne`
 *  coloré de la dernière couleur du nuancier : la composition courante le porte et le matériau de cette surface la prend
 *  (`couleurs` de l'atelier publié) ; puis « Par défaut » l'en retire et rend à la surface le matériau du GLB. */
async function colorerLaPiece(catalogues, ligne, piece) {
  const { nom, palette } = piece.manifeste.surfaces[0]
  const couleur = catalogues.nuancier.at(-1)
  const emplacement = `ligne/${ligne}`
  await cliquerBouton('Couleurs')
  await choisirDansLaListe(`couleur/${palette}`, couleur.label)
  await attendreLAtelier(`a.couleurs[${JSON.stringify(emplacement)}]?.[${JSON.stringify(nom)}] === ${JSON.stringify(couleur.couleur)}`)
  let a = await atelier()
  assert.deepEqual([a.composition.courante.couleurs[palette], a.composition.palette[palette], a.erreurs], [{ id: couleur.id }, couleur.couleur, []], `couleur « ${couleur.label} » posée à « ${palette} »`)
  noter(`« ${couleur.label} » à « ${palette} » : la surface « ${nom} » de « ${ligne} » en ${couleur.couleur}`)
  await capturer('3086-r1-1c-couleur')
  await choisirDansLaListe(`couleur/${palette}`, PAR_DEFAUT, -1)
  await attendreLAtelier(`a.couleurs[${JSON.stringify(emplacement)}]?.[${JSON.stringify(nom)}] === undefined`)
  a = await atelier()
  assert.ok(!(palette in (a.composition.courante.couleurs ?? {})), `« ${PAR_DEFAUT} » retire « ${palette} » de la composition`)
  noter(`« ${PAR_DEFAUT} » à « ${palette} » : la surface « ${nom} » rendue au matériau du GLB`)
}

const OS_DU_TORSE = ['spine_01', 'spine_02', 'spine_03', 'clavicle_l', 'clavicle_r']
// Quatre poses distinctes vérifient le gabarit pendant le clip courtaud.
const POSES_COURTAUDES_DISTINCTES_MINIMALES = 4
// Huit images donnent plusieurs observations du gabarit courtaud.
const IMAGES_COURTAUDES = 8
// Trois secondes laissent publier les huit images du clip courtaud.
const DELAI_COURTAUD_MS = 3000

function verifierLaPeau(a, ligne) {
  const peau = a.peaux[`ligne/${ligne}`]
  assert.ok(peau, `boîte skinnée publiée à ligne/${ligne}`)
  const torse = OS_DU_TORSE.map((nom) => {
    assert.ok(a.os[nom], `os du torse publié : ${nom}`)
    return a.os[nom]
  })
  const hauteur = Math.max(...Object.values(a.os).map((p) => p[1])) - Math.min(...Object.values(a.os).map((p) => p[1]))
  // Calibration d’ingénierie : écart sain 1,26 % de la hauteur, skin sans noms de liaison 68,7 % ; marge retenue 10 %.
  const tolerance = hauteur * 0.1
  const ecarts = peau.centre.map((v, k) => Math.max(Math.min(...torse.map((p) => p[k])) - v, v - Math.max(...torse.map((p) => p[k])), 0))
  noter(`écart torse ${ligne} : ${JSON.stringify(ecarts)} m ; maximum ${Math.max(...ecarts)} m ; hauteur ${hauteur} m ; marge ${tolerance} m (${Math.max(...ecarts) / hauteur * 100} %)`)
  for (let k = 0; k < 3; k++) {
    const min = Math.min(...torse.map((p) => p[k])) - tolerance
    const max = Math.max(...torse.map((p) => p[k])) + tolerance
    assert.ok(peau.centre[k] >= min && peau.centre[k] <= max, `skin suit le torse, axe ${k} : centre ${peau.centre[k]}, enveloppe [${min}, ${max}]`)
  }
  assert.ok(peau.taille.every((v) => Number.isFinite(v) && v > 0 && v <= hauteur), `boîte du plastron : ${JSON.stringify(peau)}`)
  const g = a.gabarit
  assert.ok(g.neutre && g.repos && g.image, 'mesures du gabarit publiées')
  proche(a.cadre, g.repos.sommet / g.neutre.sommet, 1e-4, 'cadre au gabarit')
  proche(g.image.pied, g.image.piedSansGabarit, 1e-4, 'pied à sa hauteur sans gabarit')
  assert.deepEqual(a.erreurs, [], 'pose sans erreur')
}

async function verifierLeCouplage(images, racine, manifeste, assets, reposLocal, reposMonde) {
  assert.ok(images.length > 1, 'plusieurs publications de marche')
  const premier = images[0], dernier = images.at(-1), clip = premier.clip
  proche(premier.vitesse, 2, 1e-6, 'fenêtre de couplage au cran ×2')
  assert.equal(clip, manifeste.clips.marche, 'le clip joué est celui du rôle marche')
  const vitesse = manifeste.appuis.vitesseAuSol
  assert.ok(Number.isFinite(vitesse) && vitesse > 0, 'vitesse au sol déclarée pour le clip joué')
  const fiche = await assets.evaluer({ base: readFileSync(join(o.base, production(o.base).model)), manifeste, clips: [clip] })
  const appuis = fiche.mesures.clips[0].appuis
  assert.ok(appuis?.pieds.length && appuis.pieds.every((p) => p.duree > 0), 'durées d’appui mesurées sur la base')
  const dureeDAppui = Math.max(...appuis.pieds.map((p) => p.duree))
  const glissementMax = Math.max(...appuis.pieds.map((p) => p.glissementMax))
  // glissement total ≤ glissementMax + écart de vitesse × durée ; tolérance = (SOL_TOLERANCE_M − glissementMax) / durée maximale.
  const tolerance = (assets.SOL_TOLERANCE_M - glissementMax) / dureeDAppui
  assert.ok(tolerance > 0, 'budget de glissement disponible pour le couplage')
  const lateral = (os) => {
    const a = os.clavicle_l, b = os.clavicle_r, norme = horizontal(a, b)
    assert.ok(norme > 0, 'repère latéral au repos pour le lacet de la racine')
    return [(b[0] - a[0]) / norme, (b[2] - a[2]) / norme]
  }
  const local = lateral(reposLocal), monde = lateral(reposMonde)
  const cos = local[0] * monde[0] + local[1] * monde[1]
  const sin = local[0] * monde[1] - local[1] * monde[0]
  const direction = [cos * appuis.direction[0] - sin * appuis.direction[1], sin * appuis.direction[0] + cos * appuis.direction[1]]
  const attendue = vitesse
  const intervalles = []
  let tempsDeClip = 0
  for (let i = 1; i < images.length; i++) {
    const a = images[i - 1], b = images[i]
    assert.equal(b.clip, clip, 'même clip pendant la fenêtre de couplage')
    assert.equal(b.duree, premier.duree, 'longueur de clip constante')
    proche(b.vitesse, premier.vitesse, 1e-6, 'cran de vitesse constant')
    proche(b.gabarit.image.echelle, premier.gabarit.image.echelle, 1e-6, 'échelle constante')
    const dt = (b.instant - a.instant + b.duree) % b.duree
    assert.ok(dt > 0, 'intervalle de temps de clip positif')
    const dx = b.os[racine][0] - a.os[racine][0], dz = b.os[racine][2] - a.os[racine][2]
    const distance = Math.hypot(dx, dz)
    const mesuree = distance / dt
    intervalles.push({ mesuree, rapport: mesuree / attendue, cosinusSigne: (dx * direction[0] + dz * direction[1]) / distance })
    tempsDeClip += dt
  }
  assert.ok(tempsDeClip >= premier.duree * 8, 'fenêtre de couplage de huit cycles de marche')
  const mesuree = horizontal(premier.os[racine], dernier.os[racine]) / tempsDeClip
  const rapportMaximal = Math.max(...intervalles.map((p) => p.rapport))
  const rapportBudgetMaximal = Math.max(...intervalles.map((p) => Math.abs(p.mesuree - attendue) / tolerance))
  const cosinusSigne = Math.min(...intervalles.map((p) => p.cosinusSigne))
  const imagesParSeconde = (images.length - 1) * 1000 / (dernier.observeeA - premier.observeeA)
  const mesure = { clip, cran: premier.vitesse, mesuree, rapportMaximal, rapportBudgetMaximal, attendue, tolerance, cosinusSigne, direction, glissementMax, dureeDAppui, tempsDeClip, cycles: tempsDeClip / premier.duree, images: images.length, imagesParSeconde }
  noter('couplage racine/clip : ' + JSON.stringify(mesure))
  writeFileSync(join(o.captures, 'couplage.json'), JSON.stringify(mesure, null, 2))
  proche(mesuree, attendue, tolerance, 'couplage racine/clip en m/s de temps de clip')
  assert.ok(rapportBudgetMaximal <= 1, `couplage par intervalle : rapport maximal au budget de glissement ${rapportBudgetMaximal}`)
  assert.ok(cosinusSigne >= 1 - 1e-4, `sens de marche porté par le lacet de la racine : cosinus signé ${cosinusSigne}`)
}

function verifierLeMorphe(a, nom, attendu, emplacement = null) {
  const meshes = emplacement === null ? a.morphes.corps : a.morphes.montes[emplacement]
  const porteurs = Object.entries(meshes ?? {}).filter(([, morphes]) => nom in morphes)
  assert.ok(porteurs.length, `morphe ${nom} publié sur ${emplacement ?? 'le corps'}`)
  for (const [mesh, morphes] of porteurs) proche(morphes[nom], attendu, 1e-6, `${nom} sur ${emplacement ?? 'corps'}/${mesh}`)
  noter(`morphe ${nom} ${emplacement ?? 'corps'} : ${JSON.stringify(porteurs)} ; composer ${attendu}`)
}

async function observerLesImages(nombre, dureeMs) {
  return JSON.parse(await evaluate(session, `(async () => {
    const images = [], debut = performance.now(); let precedent;
    while (images.length < ${nombre} && performance.now() - debut < ${dureeMs}) {
      await new Promise(requestAnimationFrame);
      const e = globalThis.wfrpEcran;
      if (e === precedent || !e?.atelier?.lecture) continue;
      precedent = e;
      images.push({ ...e.atelier, observeeA: performance.now() });
    }
    return JSON.stringify(images);
  })()`))
}

async function parcoursComposition() {
  const assets = await chargerAssets([
    "export { schema as schemaDesPresets } from '/src/data/schemas/defs/presets-de-personnage.ts';",
    "export { validateDocument } from '/src/data/schemas/validate.ts';",
    "export { FEMININ, CORPULENCE } from '/hotes/godot/asset/silhouettes.ts';",
    "export { evaluer } from '/hotes/godot/asset/evaluateur/evaluer.ts';",
    "export { SOL_TOLERANCE_M } from '/hotes/godot/asset/evaluateur/gardes/piedsAuSol.ts';",
  ])
  const { schemaDesPresets, validateDocument, FEMININ, CORPULENCE } = assets
  const p = production(o.base)
  const piece = production(o.piece)
  const base = p.manifeste.base
  const pieceId = basename(resolve(o.piece))
  assert.ok(piece.manifeste.cle.piece, 'la pièce porte sa clé de garde-robe')
  const ligne = `piece/${piece.manifeste.cle.piece}`
  assert.equal(piece.manifeste.liaison.mode, 'squelette', 'la pièce de recette est skinnée')
  importer(o.base, base)
  await cliquerBouton('Atelier')
  await attendreLAtelier(`a.base === ${JSON.stringify(base)}`, 120000)
  await choisirDansLaListe('modele/corps', base)
  const reposDeLaBase = await atelier()
  assert.deepEqual([reposDeLaBase.empreinte, reposDeLaBase.erreurs], [p.model_sha256, []])
  assert.deepEqual([reposDeLaBase.clip, reposDeLaBase.lecture], [p.manifeste.clips.repos, true], 'la base seule joue son clip de repos')
  assert.deepEqual(Object.keys(reposDeLaBase.os).sort(), [...p.manifeste.os].sort(), 'tous les os natifs de la base sont présents dans la référence')
  await cliquerBouton('Personnage')
  const catalogues = JSON.parse(await evaluate(session, "wfrpPont.appeler('catalogues')"))
  assert.equal((await atelier()).composition.copie, '', 'avant Copier : aucune entrée copiée')
  const plageInitiale = catalogues.axes.find((x) => x.forme === 'plage')
  await cliquerAmene({ cle: `axe/${plageInitiale.champ}/neutre` }, 1)
  await attendreLAtelier('a.composition.refus !== null')
  await cliquerAmene(COPIER, 1)
  await attendreLAtelier('a.erreurs.some((x) => x.includes("presetDeComposition"))')
  assert.equal((await atelier()).composition.copie, '', 'Copier refusé : aucune entrée copiée')
  noter('Copier avant toute copie et après refus : entrée vide')
  await cliquerAmene('Soldat', -1)
  await attendreLAtelier('a.composition.preset === "soldat" && a.composition.manquants.length > 0')
  let a = await atelier()
  assert.equal(a.composition.refus, null)
  assert.equal(a.composition.courante.sex, 'F', 'Soldat féminin')
  verifierLeMorphe(a, FEMININ, 1)
  assert.deepEqual(a.erreurs, [])
  assert.ok(a.composition.montes.length > 0, 'emplacements de composition publiés')
  assert.ok(a.composition.manquants.every((m) => m.ligne && m.id && m.label), 'manquants identifiés et libellés')
  for (const axe of catalogues.axes.filter((x) => x.forme === 'plage')) {
    await amener({ cle: `axe/${axe.champ}/neutre` }, 1)
    assert.ok((await atelier()).plages[axe.champ], `plage ${axe.champ} publiée`)
  }
  noter(`Soldat : ${JSON.stringify(a.composition)}`)
  await amener(COPIER, 1)
  await capturer('3086-r1-1-soldat-manquants')
  await cliquerAmene(COPIER, 1)
  await attendreLAtelier('a.composition.copie !== ""')
  const copie = (await atelier()).composition.copie
  noter(`Copier publié : ${copie}`)
  await capturer('3086-r1-1b-copier')
  let entree
  try { entree = JSON.parse(copie) } catch {
    assert.fail(`Copier ne publie pas une entrée JSON de presetsDePersonnage : ${JSON.stringify(copie)}`)
  }
  assert.deepEqual(validateDocument(schemaDesPresets, [entree]) ?? [], [], 'copie valide au schéma de la collection presetsDePersonnage côté Node')
  const soldat = JSON.parse(readFileSync(new URL('../../src/data/presets-de-personnage.json', import.meta.url), 'utf8')).find((x) => x.id === 'soldat')
  assert.ok(soldat, 'entrée Soldat présente dans les presets app-owned')
  assert.deepEqual(entree, soldat, 'Copier restitue exactement l’entrée Soldat app-owned')

  importer(o.piece, pieceId)
  await cliquerBouton('Outils')
  await cliquerAmene(RECHARGER, -1)
  await cliquerBouton('Équipement')
  const cle = { cle: `ligne/${ligne}` }
  await cliquerAmene(cle, 1)
  await attendreLAtelier(`a.lignes[${JSON.stringify(ligne)}] === ${JSON.stringify(pieceId)}`, 120000)
  await cliquerAmene(cle, 1)
  await attendreLAtelier(`!(${JSON.stringify(ligne)} in a.lignes)`)
  assert.ok(!(`ligne/${ligne}` in (await atelier()).peaux), 'démontée : sa peau retirée')
  await cliquerBouton(cle)
  await attendreLAtelier(`a.lignes[${JSON.stringify(ligne)}] === ${JSON.stringify(pieceId)}`)
  await colorerLaPiece(catalogues, ligne, piece)
  await cliquerBouton('Personnage')
  await choisirAxe(catalogues, 'gabarit', 'courtaud')
  await attendreLAtelier('!!a.gabarit.image')
  a = await atelier()
  assert.equal(a.composition.copie, '', 'recomposition : entrée copiée effacée')
  verifierLaPeau(a, ligne)
  assert.ok(a.lecture, `la composition joue son clip de repos : ${a.clip}`)
  const clipDeRepos = a.clip
  await capturer('3086-r1-2-courtaud')
  const touche = { key: 'w', code: 'KeyW', windowsVirtualKeyCode: 87 }
  const auRepos = `a.clip === ${JSON.stringify(clipDeRepos)} && a.lecture`
  let imagesCourtaudes
  try {
    await realKeyDown(session, touche)
    await attendreLAtelier(`a.clip !== ${JSON.stringify(clipDeRepos)} && a.lecture`)
    imagesCourtaudes = await observerLesImages(IMAGES_COURTAUDES, DELAI_COURTAUD_MS)
    assert.ok(new Set(imagesCourtaudes.map((x) => x.instant)).size >= POSES_COURTAUDES_DISTINCTES_MINIMALES, 'courtaud : plusieurs images distinctes du clip')
    for (const image of imagesCourtaudes) {
      assert.ok(Math.abs(image.gabarit.image.echelle - 1) > 1e-4, 'courtaud : échelle effectivement différente de 1')
      proche(image.gabarit.image.pied, image.gabarit.image.piedSansGabarit, 1e-4, 'courtaud animé : hauteur du pied conservée')
    }
    writeFileSync(join(o.captures, 'courtaud.json'), JSON.stringify(imagesCourtaudes))
    noter(`courtaud animé : ${JSON.stringify(imagesCourtaudes.map(({ instant, gabarit }) => ({ instant, image: gabarit.image })))}`)
    await capturer('3086-r1-2b-courtaud-anime')
  } finally {
    await realKeyUp(session, touche)
  }
  await attendreLAtelier(auRepos)
  await cliquerBouton('Animation')
  await choisirDansLaListe('clip', 'A_TPose')
  await attendreLAtelier('a.clip === "A_TPose" && a.lecture')
  await cliquerAmene('Pause', 1)
  await attendreLAtelier('a.lecture === false')
  await cliquerBouton('Personnage')
  const corpulence = catalogues.axes.find((x) => x.champ === 'build' && x.forme === 'plage')
  assert.ok(corpulence, 'axe de corpulence borné')
  for (const [bord, valeur] of [['gauche', corpulence.min], ['droite', corpulence.max]]) {
    await amener({ cle: 'axe/build/neutre' }, 1)
    const plage = (await atelier()).plages.build
    assert.ok(plage, 'bords de corpulence publiés')
    await cliquerPoint(bord === 'droite' ? plage.droite - 1 : plage.gauche, plage.y)
    await attendreLAtelier(`a.plages.build?.valeur === ${valeur}`)
    a = await atelier()
    assert.equal(a.composition.courante.build, valeur)
    verifierLaPeau(a, ligne)
    const attendu = a.composition.morphes[CORPULENCE]
    assert.ok(Number.isFinite(attendu), 'poids corpulence retourné par composer')
    if (bord === 'droite') assert.ok(attendu > 0, 'corpulence non nulle à droite')
    verifierLeMorphe(a, CORPULENCE, attendu)
    verifierLeMorphe(a, CORPULENCE, attendu, `ligne/${ligne}`)
    verifierLeMorphe(a, FEMININ, 1)
    await capturer(`3086-r1-3-corpulence-${valeur}`)
  }

  await choisirAxe(catalogues, 'gabarit', null)
  await cliquerAmene({ cle: 'axe/build/neutre' }, 1)
  await choisirAxe(catalogues, 'sex', 'M')
  await cliquerBouton('Animation')
  await cliquerAmene('×2', 1)
  proche((await atelier()).vitesse, 2, 1e-4, 'marche au cran ×2')
  // #3104 — vérification du couplage limitée au corps neutre.
  const repos = await atelier()
  proche(repos.cadre, 1, 1e-4, 'marche au corps neutre')
  const poidsNeutres = Object.values(repos.composition.morphes)
  assert.ok(poidsNeutres.length > 0 && poidsNeutres.every((poids) => poids === 0), 'couplage : tous les poids de silhouette sont nuls')
  verifierLeMorphe(repos, FEMININ, 0)
  const racine = p.manifeste.gabarit.racine
  const images = []
  try {
    await realKeyDown(session, touche)
    await attendreLAtelier(`a.clip !== "A_TPose" && a.lecture`)
    images.push(...JSON.parse(await evaluate(session, `(async () => {
      const images = [], debut = performance.now(); let precedent, temps = 0;
      while (performance.now() - debut < 14000) {
        await new Promise(requestAnimationFrame);
        const e = globalThis.wfrpEcran;
        if (e === precedent || !e?.atelier?.lecture) continue;
        precedent = e;
        const a = e.atelier;
        if (images.length) temps += (a.instant - images.at(-1).instant + a.duree) % a.duree;
        images.push({ ...a, observeeA: performance.now() });
        if (temps >= a.duree * 8) break;
      }
      return JSON.stringify(images);
    })()`)))
    writeFileSync(join(o.captures, 'marche.json'), JSON.stringify(images))
    await capturer('3086-r1-4-marche')
  } finally {
    await realKeyUp(session, touche)
  }
  await attendreLAtelier(auRepos)
  const arret = await atelier()
  noter(`marche : ${images.length} poses, instants ${JSON.stringify(images.map((x) => x.instant))}`)
  await verifierLeCouplage(images, racine, p.manifeste, assets, reposDeLaBase.os, arret.os)
  assert.deepEqual(arret.erreurs, [], 'marche et arrêt sans erreur')
}

/** Les lacets de l'orbite capturés par le parcours `preset`, en radians depuis la face : trois quarts, puis dos. */
const VUES_DU_PRESET = [['face', 0], ['trois-quarts', -Math.PI / 4], ['dos', Math.PI]]
/** Chaque élément de la composition (`composition.montes`) monté dans la scène (`montes` et `lignes` de l'atelier), ses
 *  GLB lus : une capture plus tôt montre les premiers objets seuls. */
const TOUT_EST_MONTE = `JSON.stringify(a.composition.montes.filter((m) => m.element).map((m) => m.element).sort())
  === JSON.stringify([...Object.values(a.montes), ...Object.values(a.lignes)].sort())`
/** Les radians de lacet par pixel d'un glissé de l'orbite (`MiseEnPage.RADIANS_PAR_PIXEL`). */
const RADIANS_PAR_PIXEL = 0.005

/** L'écart relatif admis entre un compte du bilan de la pile que porte la fusion de Godot et celui de l'évaluateur : Godot
 *  quantifie les poids de peau sur 16 bits et cuit les formes par son propre calcul, ce qui déplace quelques points d'un
 *  côté à l'autre d'un seuil de la pile. */
const TOLERANCE_DE_LA_PILE = 0.01

/** La fusion de l'atelier porte la pile des couches de l'évaluateur (#3842) : le bilan que l'atelier publie (`pile`,
 *  `MontageDeComposition.pile_posee`) est, à `TOLERANCE_DE_LA_PILE` près, celui que l'évaluateur mesure
 *  (`mesures.pile`) sur les mêmes éléments montés, aux formes de la composition (`composition.morphes`). */
async function prouverLaPile() {
  await attendreLAtelier('Object.keys(a.pile).length > 0', 120000)
  const a = await atelier()
  const { fichiersDuModele } = await chargerAssets(["export { fichiersDuModele } from '/hotes/godot/asset/modeles.ts';"])
  const lu = (id) => { const f = fichiersDuModele(id); return { glb: readFileSync(join(DOSSIER_SERVI, f.glb)), manifeste: JSON.parse(readFileSync(join(DOSSIER_SERVI, f.manifeste), 'utf8')) } }
  const base = lu(a.base)
  const elements = [...Object.values(a.montes), ...Object.values(a.lignes)].map(lu)
  const { evaluer } = await chargerEvaluateur()
  const { mesures } = await evaluer({
    base: base.glb, manifeste: base.manifeste, elements: elements.map((e) => e.glb),
    couches: elements.map(({ manifeste: { couche, couvre = [], categorie } }) => (couche ? { couche, couvre, categorie } : null)),
    silhouettes: a.composition.morphes, clips: [base.manifeste.clips.repos],
  })
  noter(`pile : fusion ${JSON.stringify(a.pile)} ; évaluateur ${JSON.stringify(mesures.pile)}`)
  for (const [compte, attendu] of Object.entries(mesures.pile)) {
    assert.ok(Math.abs(a.pile[compte] - attendu) <= TOLERANCE_DE_LA_PILE * Math.max(attendu, 1 / TOLERANCE_DE_LA_PILE), `pile, ${compte} : ${a.pile[compte]} dans la fusion, ${attendu} à l'évaluateur`)
  }
  assert.ok(mesures.pile.couverts > 0 && mesures.pile.masques > 0, 'la tenue du preset empile des couches')
}

/** Le preset `--preset` composé dans l'atelier, sur les modèles du projet, et capturé de face, de trois quarts et de dos :
 *  sa base choisie en tête du panneau, le preset à l'onglet Personnage, aucune erreur publiée ; sa fusion porte la pile
 *  des couches de l'évaluateur (`prouverLaPile`). */
async function parcoursPreset() {
  const preset = JSON.parse(readFileSync(new URL('../../src/data/presets-de-personnage.json', import.meta.url), 'utf8')).find((x) => x.id === o.preset)
  assert.ok(preset, `--preset ${o.preset} : un preset de src/data/presets-de-personnage.json`)
  await enHauteDefinition()
  await cliquerBouton('Atelier')
  await attendreLAtelier('b.some((x) => x.cle === "modele/corps")', 120000)
  await choisirDansLaListe('modele/corps', 'humanoide')
  await attendreLAtelier('a.base === "humanoide"', 120000)
  await cliquerBouton('Personnage')
  await cliquerAmene(preset.label, -1)
  await attendreLAtelier(`a.composition.preset === ${JSON.stringify(preset.id)}`, 120000)
  await attendreLAtelier(TOUT_EST_MONTE, 120000)
  await sleep(3000)
  const a = await atelier()
  assert.deepEqual(a.erreurs, [], `${preset.label} composé sans erreur`)
  noter(`${preset.label} : montés ${a.composition.montes.filter((m) => m.element).map((m) => m.element).join(', ')} ; manquants ${a.composition.manquants.map((m) => m.label).join(', ') || 'aucun'}`)
  await prouverLaPile()
  let lacet = 0
  for (const [nom, cible] of VUES_DU_PRESET) {
    const dx = -Math.round((cible - lacet) / RADIANS_PAR_PIXEL)
    const pas = Math.ceil(Math.abs(dx) / 10)
    if (dx) await geste(session, { surface: 'canvas', x: 1000, y: 360 }, { qui: `orbite ${nom}` }, clic({ bouton: 'right', trajet: Array.from({ length: pas }, (_, i) => ({ x: Math.round((dx * (i + 1)) / pas), y: 0 })) }))
    lacet = cible
    await capturer(`preset-${preset.id}-${nom}`)
  }
}

const PARCOURS = { reglages: parcoursReglages, combat: parcoursCombat, critique: parcoursCritique, fin: parcoursFin, dialogue: parcoursDialogue, document: parcoursDocument, incantation: parcoursIncantation, soin: parcoursSoin, voyage: parcoursVoyage, marche: parcoursMarche, repos: parcoursRepos, repit: parcoursRepit, ouvrage: parcoursOuvrage, bataille: parcoursBataille, exploration: parcoursExploration, relief: parcoursRelief, etage: parcoursEtage, regards: parcoursRegards, meteo: parcoursMeteo, vehicule: parcoursVehicule, cadrages: parcoursCadrages, bord: parcoursBord, brume: parcoursBrume, fiche: parcoursFiche, inventaire: parcoursInventaire, creation: parcoursCreation, campagne: parcoursCampagne, roster: parcoursRoster, editeur: parcoursEditeur, atelier: parcoursAtelier, composition: parcoursComposition, preset: parcoursPreset, vision: parcoursVision, murs: parcoursMurs }
if (!(o.parcours in PARCOURS)) throw new Error(`--parcours ${o.parcours} : ${Object.keys(PARCOURS).join(' ou ')} attendu`)
assert.deepEqual(Object.keys(PARCOURS).filter((parcours) => !(parcours in JEUX_DU_PARCOURS)), [], 'chaque parcours déclare ses jeux au lot (`JEUX_DU_PARCOURS`)')

let echec = null
try {
  await attendreLeMenu()
  await PARCOURS[o.parcours]()
  const releve = JSON.parse(await lire(`wfrpPont.appeler('erreursGlobales')`))
  assert.deepEqual(releve, { ok: true, erreurs: [] }, 'aucune erreur de la page relevée par le pont')
  noter('erreursGlobales : aucune')
} catch (e) {
  echec = e
  console.error('ÉCHEC', e.message)
  try { noter(`état à l’échec : ${JSON.stringify((await ecran())?.atelier?.composition)}`); await capturer('echec') } catch (diagnostic) { console.error('ÉCHEC DU DIAGNOSTIC', diagnostic.message) }
} finally {
  await session.close()
  const erreurs = garde.errors()
  console.log(`console : ${garde.entries.length} entrée(s), ${erreurs.length} erreur(s), ${garde.warnings().length} avertissement(s)`)
  for (const e of [...erreurs, ...garde.warnings()]) console.log(' ', e.type, e.text)
  srv.fermer()
  if (depot) rmSync(depot, { recursive: true, force: true })
}
process.exitCode = echec || garde.errors().length ? 1 : 0
