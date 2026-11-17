# Propositions : suite du combat (2026-11-17, #3935)

Compte rendu des quatorze états dessinés pour la magie, les réactions de combat, la bataille de masse et la
course-poursuite en mer, depuis la cible écrite `../ecrites/combat.md`, le contrat `../combat.md`, les propositions de
combat (`combat.md`) et l'écran de voyage (`voyage.md`). Aucune cible écrite ne couvre ces états : le contrat
`../combat.md` dit la bataille de masse hors de son périmètre. Sources au dépôt : `sources/combat-suite/`. Elles lient par
chemin relatif les feuilles et les scripts de leurs deux socles : `sources/combat/` pour les onze états du champ
tactique (`suite.js`, `suite.css`), `sources/voyage/` et `sources/lieux-et-nuit/` pour les trois autres (`bataille.js`,
`poursuite.js`, `champ.css`).
Rien n'est validé : chaque « choix à valider » attend l'utilisateur.

Textes repris du jeu : libellés de `src/i18n/messages/fr.ts` (« Surincantation », « {restant} pas sur {budget} »,
« Cibles supplémentaires : … à cliquer sur la carte », « Contrer seul », « S’unir », « Passer », « Déclarer »,
« Dissipation », « Corruption », « Nature de la Corruption », « Je te renie ! », « Maladresse », « Se désengager »,
« Sacrifier l’Avantage », « Fuir », « Le Destin », « Un coup fatal. », « Sans sacrifice, le héros meurt. », « Éviter le
coup », « Survivre hors du combat », « Accepter son sort », « Relancer », « Chance : +1 DR », « Pacte », « Résilience »,
« Appliquer », « Continuer », « Bataille de masse », « Round de bataille {n} / {total} », « Point de rupture
{bp}/{max} »,
« Engager le combat », « Résoudre », « Tirer un facteur (1d10) », « Test spectaculaire de Puissance », « Rassemblement
»,
« Round suivant », « Armée des Personnages », « le navire creuse l'écart ») ; « Rupture » verbatim de LDB 46 l.36-55 ;
« Oups ! » 61-70 verbatim de LDB 14 l.21-30 (`src/data/oups.json`) ; « Pattes d'animaux · +1 Mouvement » de LDB 19
l.118 ; terrain et Puissances de `src/scenes/test-scenarios/13-bataille-de-masse.ts:99-104` ; Scènes de
`src/data/activities.json` ; « Cogue pirate » de `src/data/sea-events.json:1100`. Tout seuil, dé et total est un
exemple.

## surincantation
- Le bandeau d'incantation après le dé : à gauche le lanceur et son jet, au centre le sort et la répartition des pas
  (LDB 47 l.15-17, `src/noyau/fenetreDIncantation.ts:44`), à droite les cibles désignées ; la cible supplémentaire est
  cernée sur le champ.
- À valider : les pas en losanges pleins ou vides par axe, avec − et + ; un axe sans objet pour le sort (Zone, Durée de
  Fléchette, LDB 47 l.15-17) reste nommé, grisé, « sans objet » (libellé absent du jeu) ; la colonne des cibles
  remplace le bloc « Cible du sort » ; les cinq gestes de l'incantation restent ; l'axe « Dégâts » de la règle révisée
  (VDM 02 l.194-205) n'est pas dessiné.

## contre-sort-declaration, contre-sort
- Deux temps (fiche `user-doctrine-declaration-avant-jets`) : la déclaration avant les dés, puis le Test opposé de
  Langue (Magick) tombé (LDB 46 l.156), le camp du joueur à gauche comme au jet de défense.
- À valider : la déclaration en trois petites plaques au centre, « S’unir » fermée quand aucun autre lanceur n'est là ;
  l'étiquette « Un seul Contre-sort par Round » (libellé absent du jeu) ; geste « Déclarer » ; phrase d'issue en bas de
  casse, quand le jeu écrit « le Sort est DISSIPÉ » (`contreSort.dissipe`) ; « Relancer » fermée dans l'exemple.

## dissipation
- La Dissipation d'un sort qui dure, en Test étendu (LDB 46 l.160-162, `src/noyau/pendings.ts:735`) : au centre le sort
  visé, son Niveau d'incantation et le cumul des DR en losanges ; à droite son lanceur ; le sort se voit sur le champ.
- À valider : le cumul « 5 DR sur 7 » en losanges ; le Dôme (NI 7, `src/data/spells.json`) en exemple, alors que sa
  Durée se compte en Rounds ; le dôme dessiné sur le pion ; ruban « Dissipation ».

## incantation-imparfaite
- Le gabarit du coup critique : à gauche le lanceur et les deux dés du jet, l'unité à 8 (Influences malfaisantes,
  LDB 46 l.89) ; à droite le nom tiré, le d100 en sceau, le texte du livre ; un seul geste « Continuer ».
- À valider : le brief dit « Malignité », terme absent de la VF, lu comme les Influences malfaisantes ; ruban
  « Incantation Imparfaite » ; le d100 de la table montré en sceau à côté du nom ; ni Chance ni Résilience offertes.

## test-de-corruption
- Avant le dé : à gauche le héros, la force de l'exposition et ses Points de Corruption sur son seuil (LDB 19 l.70) ; au
  centre la nature en deux cartes, Résistance ou Calme (LDB 19 l.29, `src/noyau/fenetreDeCorruption.ts:32`) ; à droite
  ce que le Test décide pour une exposition modérée (LDB 19 l.47-53).
- À valider : la table des enjeux affichée avant le dé ; les sous-titres « Influence physique » et « Corruption
  spirituelle » (libellés absents du jeu) ; Points de Corruption en losanges de cire sur le seuil ; geste « Lancer » ;
  l'état se montre en combat alors que l'exposition vient plus souvent de l'exploration ; le Test tombé reprendrait le
  bandeau du jet de compétence, non dessiné.

## corruption-mutation
- Le gabarit du coup critique : la victime et le d100 du tableau à gauche, la mutation en gothique et son effet à
  droite (LDB 19 l.70-76, l.118), ce que le héros perd de Points de Corruption dessous.
- À valider : « Je te renie ! » offert à côté de « Continuer » avec la réserve de Résilience (LDB 17 l.67) ; ruban
  « Mutation » ; le Test de Résistance raté qui y mène n'a pas d'image à lui.

## maladresse
- Le gabarit du coup critique : le double raté et le d100 du Tableau des Oups à gauche (LDB 14 l.17-30), « Oups ! » et
  le texte du livre à droite ; un seul geste « Continuer ».
- À valider : le titre de droite est « Oups ! », la table n'ayant pas de nom par ligne ; les deux dés montrés sont ceux
  du tirage (64), le double du Test (66) est rappelé en rubrique.

## desengagement
- Le choix dans le bandeau, comme le début du round : trois cartes, « Sacrifier l’Avantage », « Esquive », « Fuir »
  (LDB 15 l.43-49, l.59-66 ; `src/noyau/pendings.ts:1268`), la choisie en laiton plein, la refusée en fer.
- À valider : la raison du refus en billet de parchemin au survol, au-dessus du bandeau (fiche
  `user-arbitrage-raison-de-refus-au-survol-jamais-inline`) ; cartouche « Engagée · Avantage 0 · Orc 1 » ; sous-titres
  des cartes (libellés absents du jeu) ; gestes « Lancer » et « Annuler ».

## sauvetage-par-le-destin
- Le coup fatal arrête le jeu dans le bandeau : la victime et sa réserve de Destin à gauche, trois cartes, « Éviter le
  coup », « Survivre hors du combat », « Accepter son sort » (LDB 17 l.29-32, `src/noyau/choixDeFenetre.ts:234`).
- À valider : « un clic choisit, un second confirme », sans geste séparé ; « Accepter son sort » en lettres de cire ;
  la barre du héros vidée sur le champ et dans l'ordre ; le coût « −1 Destin » en sous-titre plutôt que dans le nom.

## relance-a-la-chance
- Le bandeau du jet après une relance (LDB 17 l.23-25, LDB 12 l.38) : les nouveaux dés, le premier jet rappelé barré
  sous la phrase d'issue, « Relancer » fermée, la Chance restante à gauche des gestes.
- À valider : la réserve en médaillon de fer au bord gauche des gestes ; une seule réserve montrée (la Chance), la place
  manquant pour la Résilience à côté des cinq plaques ; la raison de « Relancer » fermée vient au survol, non dessinée ;
  « Chance : +1 DR » n'a pas d'image à elle.

## bataille-de-masse
- Le champ de bataille tient l'écran, sur le socle du voyage : le Round en cartouche, le terrain écrit sur l'image
  (ADE II 08 l.112-114), les trois Scènes du Round posées sur le champ avec leurs postés, leur effet et leur
  engagement (ADE II 08 l.116-118, l.137-177 ; `src/noyau/batailleEnVue.ts`), les deux Puissances en jauges à droite
  (ADE II 08 l.17-32), le facteur environnemental et le Test spectaculaire en plaques, les héros en bandeau.
- À valider : la bataille sur le socle du voyage plutôt que sur le champ tactique ; une Scène de combat sans poste,
  tout le groupe s'y engageant ; le billet de la Scène visée ; « Libre · à poster » sur la carte du héros sans poste ;
  où chaque Scène se pose sur le champ (donnée absente du jeu) ; le facteur environnemental tiré (ADE II 08 l.307-322)
  n'a pas d'image à lui ; aucune sortie.

## bataille-de-masse-test-de-puissance
- Le Test spectaculaire tombé (ADE II 08 l.120, 10 + DR, 5 au minimum) : un contenant de parchemin au-dessus du bandeau
  des héros, chaque armée avec son seuil, son d100 en sceau et ce qu'elle ôte à l'autre ; les Puissances mises à jour à
  droite, ce que le Round a joué dessous ; gestes « Rassemblement » (ADE II 08 l.122) et « Round suivant ».
- À valider : le contenant posé en bas, au-dessus des héros, et non au centre ; réussite en sceau vert comme au jet de
  défense ; ni Chance ni Résilience, le jet étant celui de l'armée ; les Scènes quittent le champ une fois le Round
  joué ; chiffres d'exemple (50 et 55 au départ, 48 après les Scènes, dés 31 et 67).

## course-poursuite-en-mer
- La traversée continue, sur l'écran du voyage en mer : la Cogue pirate dans le sillage, la Distance en frise de 0
  « Rattrapés » à 100 « Semés » (MDG 13 l.354-403, `src/noyau/seaVoyageFlow.ts:2168`), le panneau « La poursuite », le
  billet du Test d'équipage où le Mousse compte double (MDG 14 l.67-71, `src/data/crew-test-types.json`), les rôles
  sur les cartes des héros.
- À valider : la frise de Distance à la place de la frise du trajet ; le repère « Départ · 50 » ; « +2 contre +1 » pour
  les gains des deux navires ; Bjorn en Mousse ; la décision qui ouvre la poursuite (fuir, combattre, se soumettre)
  n'a pas d'image à elle ; l'abordage à Distance 0 (MDG 13 l.420) renvoie au combat naval (`voyage/combat-naval.jpg`).
