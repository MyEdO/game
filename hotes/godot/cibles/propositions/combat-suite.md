# Propositions : suite du combat (2026-11-17, #3935)

Compte rendu des vingt états dessinés pour la magie, les réactions de combat, la bataille de masse et la
course-poursuite en mer, depuis la cible écrite `../ecrites/combat.md`, le contrat `../combat.md`, les propositions de
combat (`combat.md`) et l'écran de voyage (`voyage.md`). Aucune cible écrite ne couvre ces états : le contrat
`../combat.md` dit la bataille de masse hors de son périmètre. Sources au dépôt : `sources/combat-suite/`. Elles lient par
chemin relatif les feuilles et les scripts de leurs deux socles : `sources/combat/` pour les seize états du champ
tactique (`suite.js`, `suite.css`), `sources/voyage/` et `sources/lieux-et-nuit/` pour les quatre autres (`bataille.js`,
`poursuite.js`, `champ.css`).
Rien n'est validé : chaque « choix à valider » attend l'utilisateur.

Textes repris du jeu : libellés de `src/i18n/messages/fr.ts` (« Surincantation », « {restant} pas sur {budget} »,
« Cibles supplémentaires : … à cliquer sur la carte », « Contrer seul », « S’unir », « Passer », « Déclarer »,
« Dissipation », « Dissiper », « Focalisation », « Focalisation : {dr}/{ni} DR. », « Incantation Critique », « Puissance
totale », « Force inéluctable », « Résistance », « Corruption », « Nature de la Corruption », « Je te renie ! », « Maladresse », « Se désengager »,
« Sacrifier l’Avantage », « Fuir », « Le Destin », « Un coup fatal. », « Sans sacrifice, le héros meurt. », « Éviter le
coup », « Survivre hors du combat », « Accepter son sort », « Relancer », « Chance : +1 DR », « Pacte », « Résilience »,
« Appliquer », « Continuer », « Bataille de masse », « Round de bataille {n} / {total} », « Point de rupture
{bp}/{max} »,
« Engager le combat », « Résoudre », « Tirer un facteur (1d10) », « Test spectaculaire de Puissance », « Rassemblement
»,
« Round suivant », « Armée des Personnages », « le navire creuse l'écart ») ; « Rupture » verbatim de LDB 46 l.36-55 ;
« Oups ! » 61-70 verbatim de LDB 14 l.21-30 (`src/data/oups.json`) ; « Touché en fuyant » de
`src/data/regles.json:2084` ; Dôme et Arme aethyrique de `src/data/spells.json` ; rôles et Compétences du Test
d'équipage de MDG 14 l.23-27 ; « Tests de Puissance ce Round »
(`ecran.bataille.bonus`) ; terrain et Puissances de `src/scenes/test-scenarios/13-bataille-de-masse.ts:99-104` ; Scènes de
`src/data/activities.json` ; « Cogue pirate » de `src/data/sea-events.json:1100`. Tout seuil, dé et total est un
exemple.

## surincantation
- Le bandeau d'incantation après le dé : à gauche le lanceur et son jet, au centre le sort et la répartition des pas
  (LDB 47 l.15-17, `src/noyau/fenetreDIncantation.ts:44`), à droite les cibles désignées ; la cible supplémentaire est
  cernée sur le champ.
- À valider : les pas en losanges pleins ou vides par axe, avec − et + ; un axe sans objet pour le sort (Zone, Durée de
  Fléchette, LDB 47 l.15-17) reste nommé, grisé, « sans objet » (libellé absent du jeu) ; la colonne des cibles
  remplace le bloc « Cible du sort » ; les gestes d'après le dé du socle, « Relancer » et « Résilience » fermées sur
  la réussite (LDB 17 l.23, l.68) ; l'axe « Dégâts » de la règle révisée
  (VDM 02 l.194-205) n'est pas dessiné.

## incantation-critique
- Le Critique au jet d'Incantation (LDB 46 l.26-32) arrête le bandeau après le dé : à gauche le lanceur, son jet et
  « critique » à la place de « réussite » ; trois cartes, « Incantation Critique » (une Blessure Critique si le Sort
  inflige des Dégâts, l.30), « Puissance totale » (lancé quels que soient NI et DR, dissipable, l.31), « Force
  inéluctable » (indissipable, l.32) ; `apresLeDe` du socle, « Appliquer » commet la carte choisie.
- Verbes : `jetRegler('incantation', 'effetCritique', 'critique' | 'puissance' | 'ineluctable')`, puis
  `jetValider('incantation')` ; `jetAjouterUnDR`, `jetPactiser` restent offerts. Le noyau ferme « Appliquer » tant
  qu'aucun effet n'est choisi (`jet.ferme.choixCritiqueDu`) et la carte « Incantation Critique » d'un Sort sans Dégâts
  (`src/noyau/fenetreDIncantation.ts:107-113`, `incantation.refus.sansDegats`).
- À valider : sous-titres des cartes (le jeu n'a que `cf.surincantationPleinePuissance` et
  `cf.surincantationIrresistible`, en phrases de journal) ; le jet sur le Tableau des Incantations Imparfaites
  Mineures qu'un Critique impose sans Diction instinctive (l.28) n'est pas annoncé sur l'image ; le compteur « Jets
  de table choisis » (`jetsDeTable`, EDOC 13 l.276) n'est pas dessiné.

## contre-sort-declaration, contre-sort
- Deux temps (fiche `user-doctrine-declaration-avant-jets`) : la déclaration avant les dés, puis le Test opposé de
  Langue (Magick) tombé (LDB 46 l.156), le camp du joueur à gauche comme au jet de défense.
- La déclaration se choisit en trois cartes, comme le Désengagement et le Destin : « Contrer seul » porte les deux
  seuils et la condition de portée (LDB 46 l.156 : la cible à une distance en mètres égale à la Force Mentale),
  « S’unir » est fermée quand aucun autre lanceur n'est là, « Passer » rappelle qu'un seul Sort se dissipe par Round
  (LDB 46 l.156). « Déclarer » fige le choix (`src/noyau/reglagesDuJet.ts:219`), le Test opposé suit (seconde image) ;
  « Annuler » est un verbe du flux (`src/noyau/flowVerbs.ts:93`).
- Le Test tombé : `apresLeDe` du socle, « Relancer » et « Résilience » fermées sur la réussite (LDB 17 l.23, l.68),
  « Chance : +1 DR » ouverte (LDB 17 l.24), les trois réserves à gauche des gestes.
- À valider : sous-titres des cartes (libellés absents du jeu) ; phrase d'issue en bas de casse, quand le jeu écrit
  « le Sort est DISSIPÉ » (`contreSort.dissipe`) ; « S’unir » hors des Sorts permanents (LDB 46 l.162) n'a pas
  d'arbitrage retrouvé.

## dissipation
- La Dissipation d'un sort qui dure, en Test étendu (LDB 46 l.160-162, `src/noyau/pendings.ts:735`) : à gauche le
  lanceur, son jet et le coût de l'Action (LDB 46 l.160) ; au centre le sort visé, son Niveau d'incantation et le cumul
  des DR en losanges ; à droite son lanceur ; le sort se voit sur le champ. Gestes d'après le dé du socle, « Relancer »
  et « Résilience » fermées sur la réussite.
- À valider : le cumul « 5 DR sur 7 » en losanges ; le Dôme (NI 7, `src/data/spells.json`) en exemple, alors que sa
  Durée se compte en Rounds ; le dôme dessiné sur le pion ; ruban « Dissipation » ; l'entrée est
  `dissipation-entree` ; l'état avant le dé, avec « Annuler » (`src/noyau/flowVerbs.ts:76`), n'a pas d'image.

## dissipation-entree
- L'entrée de la Dissipation d'un Sort qui dure (LDB 46 l.158-160) : le mode armé, le clic sur un pion désigne le
  porteur ; le bandeau montre alors, à gauche, le dissipeur, son seuil de Langue (Magick) et le prix, « Coûte
  l'Action » (l.160) ; au centre une carte par Sort durable du porteur avec son Niveau d'incantation, le DR à cumuler
  (l.160) ; à droite le porteur désigné ; « Dissiper » commet la carte choisie, « Annuler » rend le porteur.
- Verbes : `armerLeMode('dissipation')`, `designerLeSupport(porteurId)` au clic sur le pion,
  `dissiperLeSort(lanceurId, spellId, porteurId)` sur « Dissiper », `designerLeSupport(null)` sur « Annuler »
  (`src/noyau/combatSlice.ts:2002-2006`). Le Test s'ouvre ensuite avant le dé (`jetLancer('dissipation')`,
  `jetAnnuler('dissipation')`).
- À valider : la carte puis la plaque, quand le jeu ouvre le Test au clic sur le Sort (`ecran.offre.dissipation-sort`) ;
  le Soutien d'un lanceur du même Domaine (l.162), que le noyau fond dans le seuil, n'est pas montré ; Arme
  aethyrique (NI 2) en second Sort d'exemple.

## focalisation
- La Focalisation en Test étendu (LDB 46 l.128-136, `src/noyau/pendings.ts:725`), dans le gabarit de la Dissipation :
  à gauche le lanceur et son jet de Focalisation ; au centre le Sort, son Niveau d'incantation et le cumul des DR en
  losanges, « Focalisation : 4/7 DR. » (`cs.focusProgress`) ; à droite ce que la Focalisation ouvre : le NI ramené à
  0 au Round suivant (l.132), le Critique qui rend le Sort lançable au Round suivant quel que soit le cumul (l.136),
  la magie perdue si l'Incantation échoue (l.132). Gestes d'après le dé du socle.
- Verbes : `focaliserLeSort(lanceurId, spellId)` ouvre le Test (pastille « Focaliser » de la barre), puis
  `jetLancer`, `jetRelancer`, `jetAjouterUnDR`, `jetPactiser`, `jetForcerLaReussite`, `jetValider` sur
  `'focalisation'` ; `jetAnnuler('focalisation')` avant le dé (`src/noyau/flowVerbs.ts:73`).
- À valider : la colonne de droite (libellés absents du jeu) ; « Focalisation » sans le Vent de sa spécialisation ;
  le Dôme d'Ilyanwe en exemple (`src/scenes/test-scenarios/22-dome.ts:30`) ; le cumul atteint (`out.focusDone`) et la
  Focalisation Critique (`cs.focusCrit`) n'ont pas d'image ; l'état avant le dé relève du bandeau générique.

## incantation-imparfaite
- Le gabarit du coup critique : à gauche le lanceur et les deux dés du jet, l'unité à 8 (Influences malfaisantes,
  LDB 46 l.89) ; à droite le nom tiré, le d100 en sceau, le texte du livre ; un seul geste « Continuer ».
- À valider : le brief dit « Malignité », terme absent de la VF, lu comme les Influences malfaisantes ; ruban
  « Incantation Imparfaite » ; le d100 de la table montré en sceau à côté du nom ; ni Chance ni Résilience offertes.

## test-de-corruption
- Hors combat (LDB 19 l.29 : l'exposition n'est pas une Action du tour) : la cour sans adversaires, sans ordre ni
  Round ni « Fin du tour ». Avant le dé : à gauche le héros, la force de l'exposition et ses Points de Corruption sur
  son seuil (LDB 19 l.70) ; au centre la nature en deux cartes, Résistance ou Calme (LDB 19 l.29,
  `src/noyau/fenetreDeCorruption.ts:32`) ; à droite ce que le Test décide pour une exposition modérée (LDB 19
  l.47-53) ; au pied `avantLeDe` du socle : les trois réserves, « Lancer », « Résilience » (LDB 17 l.68). Pas
  d'« Annuler » : le flux n'en a pas.
- À valider : la table des enjeux affichée avant le dé ; les sous-titres « Influence physique » et « Corruption
  spirituelle » (libellés absents du jeu) ; Points de Corruption en losanges de cire sur le seuil. Le Test tombé est
  `test-de-corruption-tombe`.

## test-de-corruption-tombe
- Le Test de Corruption tombé (LDB 19 l.47-53) : à gauche le héros et son jet de Résistance ; au centre ce que
  l'échec lui vaut, « +2 Points », et son total sur le seuil ; à droite la table de l'exposition modérée, la ligne
  tombée en cire ; `apresLeDe` du socle sur un échec (« Relancer », « Chance : +1 DR », « Pacte », « Résilience »
  ouvertes), puis la plaque « Résistance » du flux, fermée ici : la raison se lit au survol (« Aucune Résistance
  disponible contre cette menace. », `jet.ferme.sansResistance`).
- Verbes : `jetResister('corruption')` (Talent Résistance, LDB 10 l.1016-1020 : le premier Test contre la menace
  réussit d'office, une fois par séance), `jetRelancer`, `jetAjouterUnDR`, `jetPactiser`, `jetForcerLaReussite`,
  `jetValider` sur `'corruption'` (`src/noyau/flowVerbs.ts:84`).
- À valider : la ligne tombée marquée dans la table ; « Résistance » en sixième plaque, à droite de « Résilience » ;
  la plaque ouverte (héros doté du Talent) n'a pas d'image.

## corruption-mutation
- Le Test de seuil manqué (LDB 19 l.70) arrête le jeu AVANT tout tirage : décision utilisateur du 2026-11-17, #3001 ;
  `src/noyau/corruptionFlow.ts:369-371` pose le choix, `:330-336` le résout. À gauche le héros, ses Points de
  Corruption sur son seuil et sa réserve de Résilience ; deux cartes, « Je te renie ! » (−1 Résilience, aucune
  mutation, aucun Point perdu, LDB 17 l.67) et « Muter » (perte du Bonus de Force Mentale en Points, puis le d100,
  LDB 19 l.76) ; une plaque « Confirmer ».
- À valider : ruban « La mutation menace » et carte « Muter » (libellés absents du jeu, qui écrit « Je te renie ! »
  en oui ou non, `src/noyau/choixDeFenetre.ts:246`) ; « Muter » en lettres de cire ; la mutation tirée ensuite
  (gabarit du coup critique) n'a pas d'image, pas plus que le Test de seuil.

## maladresse
- Le gabarit du coup critique : le double raté et le d100 du Tableau des Oups à gauche (LDB 14 l.17-30), « Oups ! » et
  le texte du livre à droite ; un seul geste « Continuer ».
- À valider : le titre de droite est « Oups ! », la table n'ayant pas de nom par ligne ; les deux dés montrés sont ceux
  du tirage (64), le double du Test (66) est rappelé en rubrique.

## desengagement
- Le choix dans le bandeau : trois cartes, « Sacrifier l’Avantage », « Esquive », « Fuir » (LDB 15 l.43-49, l.59-66 ;
  `src/noyau/pendings.ts:1268`), la choisie en laiton plein, la refusée en fer. La plaque de validation porte l'acte
  de la carte choisie : « Fuir » ici, « Lancer » pour l'Esquive, « Rompre » pour l'Avantage sacrifié, ces deux
  derniers n'étant pas des jets (`src/noyau/reglagesDuJet.ts:221-224`). « Fuir » dit son prix (LDB 15 l.61-64) :
  +1 Avantage immédiat à l'adversaire, son attaque gratuite à +20, puis, si elle touche, encore +1 Avantage et un Test
  de Calme.
- À valider : la raison du refus en billet de parchemin au survol, au-dessus du bandeau (fiche
  `user-arbitrage-raison-de-refus-au-survol-jamais-inline`) ; cartouche « Engagée · Avantage 0 · Orc 1 » ; sous-titres
  des cartes et libellé « Rompre » (absents du jeu). La suite de « Fuir » est `fuite`.

## fuite
- La suite de « Fuir » (LDB 15 l.59-66), dans le bandeau du jet à deux camps : à droite le coup dans le dos de
  l'adversaire, un Test de Corps à corps non opposé à +20 (l.63), son Avantage gagné à la fuite compté dans le seuil ;
  à gauche le Test de Calme Intermédiaire du fuyard touché (« Touché en fuyant », l.66) ; au centre ce que l'échec
  lui vaut : 1 État Brisé, +1 par DR sous 0 (l.66). `apresLeDe` du socle porte sur la rangée du héros.
- Verbes : `jetLancer('fuite', pid)` par rangée, `jetRelancer`, `jetAjouterUnDR`, `jetPactiser`, `jetForcerLaReussite`
  sur la rangée du héros, `jetValider('fuite')` applique le coup, les États et la course de fuite
  (`src/noyau/pendings.ts:1280-1300`, `src/noyau/flowVerbs.ts:59`). Pas d'« Annuler » : le flux n'en a pas.
- À valider : un seul verdict au centre pour deux Tests non opposés ; les Dégâts du coup ne sont pas montrés ; l'état
  avant le dé du Test de Calme et le coup qui manque (aucun Test de Calme) n'ont pas d'image ; chiffres d'exemple.

## sauvetage-par-le-destin
- Le coup fatal arrête le jeu dans le bandeau : la victime et sa réserve de Destin à gauche, trois cartes, « Éviter le
  coup », « Survivre hors du combat », « Accepter son sort » (LDB 17 l.29-32, `src/noyau/choixDeFenetre.ts:234`), puis
  une plaque « Confirmer » : l'hôte tient la carte choisie, le noyau clôt à la pose.
- À valider : « Accepter son sort » en lettres de cire ; la barre du héros vidée sur le champ et dans l'ordre ; le
  coût « −1 Destin » en sous-titre plutôt que dans le nom ; libellé « Confirmer » (absent du jeu).

## relance-a-la-chance
- Le bandeau du jet après une relance (LDB 17 l.23-25, LDB 12 l.38) : les nouveaux dés, le premier jet rappelé barré
  dans la rubrique du verdict, les trois réserves à gauche des gestes, « Relancer » fermée et sa raison en billet au
  survol (« Ce Test a déjà été relancé. »), « Résilience » fermée sur la réussite (LDB 17 l.68), « Chance : +1 DR »
  ouverte (LDB 17 l.24).
- À valider : le premier jet réduit à son nombre barré ; « Chance : +1 DR » n'a pas d'image à elle.

## bataille-de-masse
- Le champ de bataille tient l'écran, sur le socle du voyage : le Round en cartouche, le terrain écrit sur l'image
  (ADE II 08 l.112-114), les trois Scènes du Round posées sur le champ avec leurs postés, leur effet et leur
  engagement (ADE II 08 l.116-118, l.137-177 ; `src/noyau/batailleEnVue.ts`), les deux Puissances en jauges à droite
  (ADE II 08 l.17-32) et le bonus du Round aux Tests de Puissance (`src/noyau/batailleEnVue.ts:104`), le facteur
  environnemental et le Test spectaculaire en plaques, les héros en bandeau.
- À valider : la bataille sur le socle du voyage plutôt que sur le champ tactique ; une Scène de combat sans poste,
  tout le groupe s'y engageant ; le billet de la Scène visée ; « Libre · à poster » sur la carte du héros sans poste ;
  où chaque Scène se pose sur le champ (donnée absente du jeu) ; le facteur environnemental tiré (ADE II 08 l.307-322)
  n'a pas d'image à lui ; aucune sortie.

## bataille-de-masse-test-de-puissance
- Le Test spectaculaire tombé (ADE II 08 l.120, 10 + DR, 5 au minimum) : un contenant de parchemin au-dessus du bandeau
  des héros, chaque armée avec son seuil, son d100 en sceau et ce qu'elle ôte à l'autre ; les Puissances mises à jour à
  droite avec le bonus du Round (`src/noyau/batailleEnVue.ts:104`, « Tests de Puissance ce Round »), ce que le Round a
  joué dessous ; gestes « Rassemblement : Bjorn » et « Round suivant ». Le Rassemblement s'ouvre pour un héros à la
  fois, le premier qui ne l'a pas tenté (ADE II 08 l.122, `src/noyau/massBattleFlow.ts:676-698`) : la plaque le nomme
  et se répète.
- À valider : le contenant posé en bas, au-dessus des héros, et non au centre ; réussite en sceau vert comme au jet de
  défense ; ni Chance ni Résilience, le jet étant celui de l'armée ; les Scènes quittent le champ une fois le Round
  joué ; chiffres d'exemple (50 et 55 au départ, bonus de +10 au premier Round, 48 après les Scènes, dés 31 et 67) ;
  la Menace (`batailleEnVue.menace`) n'est pas montrée, l'exemple n'en ayant pas.

## course-poursuite-en-mer
- La traversée continue, sur l'écran du voyage en mer : la Cogue pirate dans le sillage, la Distance en frise de 0
  « Rattrapés » à 100 « Semés » (MDG 13 l.354-403, `src/noyau/seaVoyageFlow.ts:2168`), le panneau « La poursuite », le
  billet du Test d'équipage où le Mousse compte double (MDG 14 l.67-71, `src/data/crew-test-types.json`), les rôles
  sur les cartes des héros. Le noyau joue une manche par jour de traversée (`src/noyau/seaVoyageFlow.ts:1013`) et ne
  publie qu'un gain net (`:1861-1864`) : « Manche du jour · +1 ».
- À valider : la frise de Distance à la place de la frise du trajet ; le repère « Départ · 50 » ; Bjorn en Mousse ;
  le billet montre le Test tombé, son lancer est `course-poursuite-en-mer-test` ; la décision qui ouvre la poursuite (fuir,
  combattre, se soumettre) non plus ; l'abordage à Distance 0 (MDG 13 l.420) renvoie au combat naval
  (`voyage/combat-naval.jpg`) ; la pastille « Postes de bord » suit celle de `voyage/voyage-en-mer`.

## course-poursuite-en-mer-test
- Le Test d'équipage de Poursuite à lancer (MDG 14 l.67-71), rôle après rôle : le billet du Test donne une rangée par
  rôle tenu, sa Compétence (MDG 14 l.23-27) et son seuil, le DR des rangées tombées, « à venir » pour les autres, la
  somme ; la rangée qui joue est en cire, son héros éclairé au bandeau, le Mousse « compte double » (MDG 14 l.19,
  l.69) ; au pied du billet `avantLeDe` du socle : les trois réserves du héros, « Lancer », « Résilience »
  (LDB 17 l.68). La Distance reste à 50 tant que la manche n'est pas tombée.
- Verbes : `jetLancer('cascade', pid)`, `jetForcerLaReussite('cascade', pid)` avant le dé ; après, `jetRelancer`,
  `jetAjouterUnDR`, `jetPactiser` par rangée, `jetValider('cascade')` clôt l'étape (`src/noyau/flowVerbs.ts:100`).
  Pas d'« Annuler » : la cascade n'en a pas.
- À valider : les gestes au pied du billet plutôt que dans un bandeau du jet, les héros gardant leur bandeau ;
  l'ordre des rangées ; seuils d'exemple ; l'état après le dé d'une rangée (`apresLeDe`) n'a pas d'image ; le
  Chansonnier (MDG 14 l.71) n'est pas tenu.
