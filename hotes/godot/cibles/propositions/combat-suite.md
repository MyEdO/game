# Propositions : suite du combat (2026-11-17, #3935)

Compte rendu des trente-six états dessinés pour la magie, les réactions de combat, la bataille de masse et les
poursuites, en mer et à terre, depuis la cible écrite `../ecrites/combat.md`, le contrat `../combat.md`, les propositions de
combat (`combat.md`) et l'écran de voyage (`voyage.md`). Aucune cible écrite ne couvre ces états : le contrat
`../combat.md` dit la bataille de masse hors de son périmètre. Sources au dépôt : `sources/combat-suite/`. Elles lient par
chemin relatif les feuilles et les scripts de leurs deux socles : `sources/combat/` pour les vingt-quatre états du champ
tactique (`suite.js`, `suite.css`), `sources/voyage/` et `sources/lieux-et-nuit/` pour les douze autres (`bataille.js`,
`poursuite.js`, `preparation.js`, `champ.css`) ; `bataille-de-masse-preparation` charge la page
`lieux-et-nuit/interlude-en-ville.js` et n'en change que le lieu ouvert.
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
`src/data/activities.json` ; « Cogue pirate » de `src/data/sea-events.json:1100`. « Lancer le dé » (`verbe.cascadeTirage.lancer`), « Tout lancer » (`verbe.lancerAll`), « Poursuite — manche {n} »,
« Rattrapés — que fait le groupe ? », « Abandonner {who} », « S'arrêter et les affronter », « Abandonner la fuite »,
« Prendre la fuite », « Combattre », « Se soumettre », « Un prisonnier à sacrifier à Stromfels », « Livrer un membre
d'équipage », « Refuser », « Poster », « Retirer du poste », « {armee} l’emporte », « Focalisation complète — le NI du
Sort est atteint. », les refus « Exige une Planification réussie au préalable. » et « Exige un Repérage réussi au
préalable. » ; Activités de préparation et leurs enjeux de `src/data/activities.json` ; verbatim de LDB 46 l.28,
LDB 14 l.19 et ADE II 08 l.124. Tout seuil, dé et total est un
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
  `dissipation-entree`, l'état avant le dé `dissipation-avant-le-de`.

## dissipation-avant-le-de
- Le même Test étendu avant le dé (LDB 46 l.160-162) : le dissipeur, son seuil, les deux dés et le sceau vides ; au
  centre le Dôme, son Niveau d'incantation et le cumul déjà acquis, « Encore 5 DR pour dissiper le Dôme. » ; à droite
  le lanceur du Sort ; au pied `avantLeDe` du socle : les trois réserves, « Lancer », « Résilience » (LDB 17 l.68),
  « Annuler ».
- Verbes : `jetLancer('dissipation')`, `jetForcerLaReussite('dissipation')`, `jetAnnuler('dissipation')`
  (`src/noyau/flowVerbs.ts:76`). Le flux n'a aucun réglage : aucun dé réglable n'est montré.
- À valider : la phrase « Encore 5 DR pour dissiper le Dôme. » (absente du jeu) ; un cumul de 2 DR en exemple, le
  Test étant repris d'un Round à l'autre.

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
  le Dôme d'Ilyanwe en exemple (`src/scenes/test-scenarios/22-dome.ts:30`) ; les autres
  temps sont `focalisation-avant-le-de`, `focalisation-atteinte` et `focalisation-critique`.

## focalisation-avant-le-de
- La Focalisation avant le dé (LDB 46 l.128-136), nouvel état de la page `focalisation` : le lanceur, son seuil et
  les dés vides ; au centre le Sort et le cumul à zéro, « Focalisation : 0/7 DR. » ; à droite ce que la Focalisation
  ouvre ; au pied `avantLeDe` du socle avec « Annuler ».
- Verbes : `jetLancer('focalisation')`, `jetForcerLaReussite('focalisation')`, `jetAnnuler('focalisation')`
  (`src/noyau/flowVerbs.ts:73`). Aucun réglage.
- À valider : la colonne de droite affichée dès avant le dé.

## focalisation-atteinte, focalisation-critique
- Les deux fins de la Focalisation. Atteinte : le cumul rejoint le Niveau d'incantation, tous les losanges pleins,
  « Focalisation complète — le NI du Sort est atteint. » (`out.focusDone`), la ligne « 7 DR cumulés » de la colonne
  de droite en cire (LDB 46 l.132). Critique : un double réussi, « Critique » sous le sceau, la ligne « Critique » en
  cire, le Sort lançable au Round suivant quel que soit le cumul (LDB 46 l.136, `src/noyau/combatSlice.ts:3401-3419`).
  Gestes d'après le dé du socle, « Relancer » et « Résilience » fermées sur la réussite.
- Verbes : `jetValider('focalisation')` sur « Appliquer » ; `jetAjouterUnDR`, `jetPactiser` restent ouverts.
- À valider : la ligne tombée marquée en cire dans la colonne de droite, comme au Test de Corruption ; la phrase du
  Critique sous le cumul (« Dôme est lançable au prochain Round (NI 0) ! », `cs.focusCrit`) ; dés 31 et 33 d'exemple.

## incantation-imparfaite
- Le gabarit du coup critique : à gauche le lanceur et les deux dés du jet, l'unité à 8 (Influences malfaisantes,
  LDB 46 l.89) ; à droite le nom tiré, le d100 en sceau, le texte du livre ; un seul geste « Continuer ».
- À valider : le brief dit « Malignité », terme absent de la VF, lu comme les Influences malfaisantes ; ruban
  « Incantation Imparfaite » ; le d100 de la table montré en sceau à côté du nom ; ni Chance ni Résilience offertes.

## incantation-imparfaite-tirage
- Le tirage de table avant le dé, nouvel état de la page `incantation-imparfaite` : l'Incantation Imparfaite Mineure
  qu'exige un Critique (LDB 46 l.28). À gauche le lanceur et les deux dés du jet d'Incantation, le double en cire
  (« Critique : 33 ») ; à droite « Les Vents s'emballent », le d100 de la table en sceau vide, « à tirer au d100 », le
  texte du livre ; un seul geste, « Lancer le dé ».
- Verbes : `jetLancer('cascadeTirage', stepId)` ; `jetImposerLeResultat('cascadeTirage', stepId, valeur)` pose le dé
  (`src/noyau/flowVerbs.ts:116`). Un tirage n'est pas un Test : ni réserves ni Résilience.
- À valider : le titre « Les Vents s'emballent » (absent du jeu) ; pas de champ « Fixer le dé » sur l'image ; le
  Talent Diction instinctive, qui dispense du tirage, n'est dit que par le texte du livre.

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
  la plaque ouverte est `test-de-corruption-resistance`.

## test-de-corruption-resistance
- Le même Test tombé pour un héros doté du Talent Résistance (Corruption) : le Talent nommé à côté du nom, la plaque
  « Résistance » ouverte en sixième geste (LDB 10 l.1016-1020, `src/noyau/rollFlowFactory.ts:516-520`).
- Verbes : `jetResister('corruption')` ; les autres gestes sont ceux de `test-de-corruption-tombe`.
- À valider : le Talent écrit en étiquette à droite du nom ; Berta dotée du Talent pour l'exemple.

## test-de-corruption-resilience
- La Résilience dépensée avant le dé (LDB 17 l.68) : le joueur choisit le résultat, les deux dés portent leurs − et
  + et valent 01 par défaut, le sceau est vert, « Réussite · DR +4 » ; la Motivation du héros est dite sous son nom ;
  au centre « Aucun Point », la ligne « Succès, 2 DR et plus » en cire ; la réserve de Résilience est tombée à 0,
  « Relancer » et « Résilience » fermées.
- Verbes : `jetForcerLaReussite('corruption')` a ouvert l'état ; chaque − ou + pose
  `jetImposerLeResultat('corruption', valeur)` (`src/noyau/rollFlowFactory.ts:144-147`, `:160-169`) ;
  `jetValider('corruption')` sur « Appliquer ».
- À valider : les − et + au-dessus et au-dessous de chaque dé, proches des réserves ; le dé choisi borné aux
  réussites ; « Je ne faillirai pas ! » en Motivation d'exemple ; cet état vaut pour tout Test du bandeau, il n'est
  dessiné qu'ici.

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

## maladresse-tirage
- Le tirage du Tableau des Oups avant le dé, nouvel état de la page `maladresse` : à gauche le héros, « Échec sur un
  double : 66 », les deux dés du Test ; à droite « Oups ! », le d100 en sceau vide, le texte du livre (LDB 14 l.19) ;
  un seul geste, « Lancer le dé ».
- Verbes : `jetLancer('maladresse', stepId)`, puis `jetValider('maladresse', stepId)` sur « Continuer »
  (`src/noyau/flowVerbs.ts:118`).
- À valider : « Lancer le dé », libellé du tirage de cascade, repris pour la Maladresse.

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
  n'a pas d'image à lui ; la pose d'un héros est `bataille-de-masse-poster`, la sortie `bataille-de-masse-issue`.

## bataille-de-masse-poster
- Poster et retirer un héros, nouvel état de la page `bataille-de-masse` : la Scène « Motivation » visée, son billet
  donnant une rangée par héros avec la Compétence de la Scène et son seuil, et une plaque par rangée : « Retirer du
  poste » pour qui y est, « Poster » pour les autres (ADE II 08 l.116-118) ; sur le champ, les postés en médaillons et
  un « + » sur chaque Scène ; Mira, sans poste, porte « À poster sur une Scène ».
- Verbes : `fenetreChoisir('batailleDeMasse', 'ajouterAuPoste', sceneId, heroId)` et
  `fenetreChoisir('batailleDeMasse', 'retirerDuPoste', sceneId, heroId)` (`src/noyau/batailleEnVue.ts:85`).
- À valider : le billet de la Scène comme lieu de la pose, plutôt qu'un glisser du héros ; un héros posté ailleurs
  garde « Poster » ouverte ; seuils d'exemple.

## bataille-de-masse-issue
- L'issue de la bataille (ADE II 08 l.124) : le parchemin « Issue de la bataille », « Armée des Personnages
  l'emporte » (`mbf.issue`), les deux Puissances finales en sceaux, « Victoire » et « En fuite », le texte du livre ;
  à droite les Puissances et ce que chaque Round a joué ; un seul geste, « Quitter le champ ».
- Verbes : `fenetreFermer('batailleDeMasse')` (`src/noyau/batailleEnVue.ts:121-124`).
- À valider : « Quitter le champ », quand le jeu dit « Terminer la bataille » (`verbe.batailleDeMasse.fermer`) ; le
  rappel Round par Round à droite (libellés absents du jeu) ; Puissances d'exemple, 46 contre 21 ; la défaite n'a pas
  d'image à elle, elle échange les deux sceaux.

## bataille-de-masse-preparation
- La préparation, en interlude (ADE II 08 l.79-110) : la carte de la ville porte un lieu de plus, « Le camp de
  l'armée », hors les murs ; son panneau donne les deux Puissances de départ et les six Activités de préparation
  (`src/data/activities.json`, contexte `bataille`) avec leur Test ; la prise montre son enjeu ; Infiltration et
  Sabotage sont fermées, la raison au survol (« Exige un Repérage réussi au préalable. ») ; « Envoyer Mira au camp »
  commet ; le geste de sortie de l'interlude devient « Livrer bataille ».
- Verbes : `menerLActionDeBataille(heroId, activityId)` (`src/noyau/interludeEnVue.ts:94-96`) ; refus de
  `refusDePrepaDeBataille` (`src/noyau/massBattleFlow.ts:460-476`) ; `fenetreValider('interlude')` clôt l'interlude et
  engage la bataille (`src/noyau/interludeFlow.ts:1196-1200`).
- À valider : la préparation rangée dans un lieu de la carte, « Le camp de l'armée », alors que le jeu ajoute ses
  Activités au catalogue de l'interlude (`src/noyau/interludeFlow.ts:457-467`) ; « Livrer bataille », « Hors les
  murs », « Envoyer Mira au camp » (libellés absents du jeu) ; les deux fermées côte à côte ; la bulle du refus
  recouvre la ligne du dessus.

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
  le billet montre le Test tombé, son lancer est `course-poursuite-en-mer-test` ; la décision qui ouvre la poursuite est
  `course-poursuite-en-mer-sommation` ; l'abordage à Distance 0 (MDG 13 l.420) renvoie au combat naval
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
  l'ordre des rangées ; seuils d'exemple ; l'état après le dé d'une rangée est
  `course-poursuite-en-mer-test-tombe` ; le Chansonnier (MDG 14 l.71) n'est pas tenu.

## course-poursuite-en-mer-test-tombe
- Le Test d'équipage après le dé d'une rangée, nouvel état de la page du Test : la rangée de Mira tombée en échec,
  son dé et son DR en cire, la somme mise à jour ; au pied du billet `apresLeDe` du socle sur un échec : les trois
  réserves, « Continuer », « Relancer », « Chance : +1 DR », « Pacte », « Résilience ».
- Verbes : `jetRelancer('cascade', pid)`, `jetAjouterUnDR('cascade', pid)`, `jetPactiser('cascade', pid)`,
  `jetForcerLaReussite('cascade', pid)` ; `jetValider('cascade')` sur « Continuer » (`src/noyau/flowVerbs.ts:100`).
- À valider : « Continuer » clôt toute l'étape, pas la seule rangée ; cinq plaques au pied d'un billet élargi.

## course-poursuite-en-mer-sommation
- La sommation du navire hostile (MDG 15 l.171-173, `src/noyau/seaVoyageFlow.ts:2216-2228`) : la Cogue pirate bord
  à bord, le panneau « La sommation » (équipage, cargaison en cale, part pillée), et dans le bandeau celui qui décide
  pour le bord puis trois cartes : « Prendre la fuite », « Combattre », « Se soumettre », chacune avec ce qu'elle
  engage ; la plaque porte le nom de la carte choisie.
- Verbes : `jetRegler('cascade', 'choix', clé, pid)` au clic sur une carte, `jetValider('cascade')` sur la plaque.
- À valider : la part pillée, « 100 % · valeur maison » : `pirate-pillage-pct` (`src/data/reglesOptionnelles.json:1434`)
  est une règle optionnelle, MDG 15 l.171-173 ne chiffrant pas l'extorsion ; Bjorn décide pour le bord, le noyau
  prenant le meilleur à la barre (`seaDecider`) ; les décisions tiennent dans le bandeau du jet et ses cartes, le
  contenant d'événement du voyage vivant dans une page et non au socle.

## course-poursuite-en-mer-tribut
- Le tribut qui suit la soumission (`src/noyau/seaVoyageFlow.ts:2964-3006`) : le récit dit la cale fouillée, le
  bandeau « Un prisonnier à sacrifier à Stromfels » offre deux cartes, « Livrer un membre d'équipage » (Moral −2d10)
  et « Refuser » (les forbans passent à l'abordage).
- Verbes : `jetRegler('cascade', 'choix', clé, pid)`, `jetValider('cascade')`.
- À valider : le tribut est une mise en jeu du noyau, non chiffrée par le livre (MDG 15 l.171-173) ; « Livrer » en
  carte d'armée et non en cire, bien qu'elle coûte un marin.

## poursuite-terrestre
- La poursuite à pied (LDB 15 l.88-108, `src/noyau/pursuitFlow.ts`), sur le socle du voyage et le gabarit de la
  poursuite en mer : « Poursuite — manche 2 », le panneau « La poursuite » (poursuivants, Distance, ce que valent 0
  et 10) avec « Abandonner la fuite », la frise de Distance de 0 « Rattrapés » à 10 « Semés », le billet du Test de
  Mouvement : une rangée par coureur avec son seuil d'Athlétisme, celle qui joue en cire avec son bonus de Mouvement
  (`pursuitMoveBonus`), les poursuivants en dernière rangée ; au pied `avantLeDe` du socle et « Tout lancer ».
- Verbes : `jetLancer('cascade', pid)` par rangée, `jetLancer('cascade')` sans rangée sur « Tout lancer »
  (`rangeeFacultative`, `src/noyau/flowVerbs.ts:156`), `jetForcerLaReussite('cascade', pid)` ;
  `jetRegler('cascade', 'abandon', true)` sur « Abandonner la fuite » (`src/noyau/pursuitFlow.ts:546-550`).
- À valider : la frise de la mer reprise à l'échelle 0-10 ; « Tout lancer » à droite des gestes de la rangée ;
  « Abandonner la fuite » dans le panneau et non au pied ; les coureurs en silhouettes sur la route ; Distance 4 et
  seuils d'exemple.

## poursuite-terrestre-rattrapes
- La Distance tombée à 0 (LDB 15 l.102-108) : le bandeau « Rattrapés — que fait le groupe ? », celui qui décide, deux
  cartes : « Abandonner Aldric », en cire avec son portrait (le plus lent, à Mouvement égal le plus bas DR,
  `src/noyau/pursuitFlow.ts`), et « S'arrêter et les affronter » ; la plaque porte le choix, ici « Faire face ».
- Verbes : `jetRegler('cascade', 'choix', 'sacrifier' | 'affronter', pid)`, `jetValider('cascade')`.
- À valider : « Abandonner Aldric », libellé du jeu, là où le brief dit « Sacrifier le plus lent » ; « Faire face »
  sur la plaque (absent du jeu) ; qui décide pour le groupe.
