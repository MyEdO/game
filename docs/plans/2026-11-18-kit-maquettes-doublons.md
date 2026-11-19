Ticket: #4411

> Critère de fusion en vigueur depuis le 2026-11-18 : même gabarit, mêmes pièces, données différentes (l'ancien critère « mêmes zones du contrat » ci-dessous ne vaut plus).

# Maquettes qui sont le même écran dans des états différents (lot 2, #4411, 2026-11-18)

Critère : même gabarit, mêmes zones du contrat (même fenêtre du noyau ou même disposition Godot) ; seuls les données
ou l'état changent. Sources : en-têtes « État de … » des comptes rendus `propositions/*.md`, scripts de page partagés
(`bord.js`, `mer.js`, `combat-naval.js`, `evenement.js`, `editeur.js`, `compendium.js`…) et la disposition Godot que
chaque fenêtre nomme. Rien n'a été fusionné. En **gras**, la maquette qui représente le mieux son groupe (l'état qui
remplit le plus de zones).

## Les deux cas de l'utilisateur
- Repos de nuit (fenêtre `repos`, disposition `repos`) : **nuit-a-l-auberge** · bivouac. Même fenêtre du noyau
  (`restFlow`). La halte n'est que l'état sans offre ni prix de l'auberge.
- Le bord en mer (`bord.js`) : **postes-de-bord** · postes-de-bord-station · activites-en-mer. Même navire, mêmes
  postes, mêmes cartes du bandeau ; c'est le panneau de droite qui change (rôles, station, Activités de la semaine).
  Ce sont deux fenêtres du noyau (affectation, `activitesEnMer`) sur une seule disposition.

## Combat (gabarits 5 et 6, décor cour)
- Le tour de l'actif (la barre) : **combat-rapides** · combat-liste · tour-adverse · cible-survolee · journal-ouvert ·
  meuble-engage-a-terre · meuble-tireur · meuble-chef-de-piece · cible-montee · visee-de-siege. fiche-au-clic est le
  même tour avec la fiche posée par-dessus.
- L'attaque avant le dé (`cascade/attaque`) : **jet-avant-le-de-armes** · jet-avant-le-de · jet-avant-le-de-empoigner ·
  jet-avant-le-de-harpon · localisation-du-critique.
- La défense (`cascade/defense`) : **defense-avant-le-de** · defense-riposte · defense-sociale · jet-de-defense (après le dé).
- L'attaque après le dé : **combat-jet-d-attaque** · seconde-frappe · frappe-mortelle.
- Le coup critique : **coup-critique** (localisation-du-critique se range avec l'attaque avant le dé).
- Le début du round (`debutDuRound`) : **debut-du-round** · debut-du-round-tir-rapide.
- La Détermination : **determination** · determination-etat.
- L'issue d'un combat : **fin-defaite** · fin-repli · fin-aneantissement. fin-victoire est à part : elle a le butin,
  un corps que les trois autres n'ont pas.

## Suite du combat (gabarit 6)
- L'incantation (`cascade/incantation`) : **surincantation** · incantation (combat/) · incantation-critique ·
  incantation-imparfaite · incantation-imparfaite-tirage.
- Le contre-sort : **contre-sort** · contre-sort-declaration.
- La dissipation : **dissipation** · dissipation-avant-le-de · dissipation-entree.
- La focalisation : **focalisation** · focalisation-avant-le-de · focalisation-atteinte · focalisation-critique.
- Le Test de Corruption : **test-de-corruption-tombe** · test-de-corruption · test-de-corruption-resistance ·
  test-de-corruption-resilience. corruption-mutation est une autre fenêtre (un choix, sans jet).
- La maladresse : **maladresse-tirage** · maladresse.
- La relance par la Chance : relance-a-la-chance est un état après le dé de n'importe quelle fenêtre de jet ; il
  double l'état « jet tombé » de chacune (**combat-jet-d-attaque** le porte déjà, Chance comprise).

## Bataille et poursuites (gabarit 4)
- La bataille de masse (`batailleDeMasse`) : **bataille-de-masse** · bataille-de-masse-poster ·
  bataille-de-masse-test-de-puissance · bataille-de-masse-issue. bataille-de-masse-preparation est un autre écran.
- La poursuite en mer : **course-poursuite-en-mer** · course-poursuite-en-mer-test · -test-tombe · -sommation · -tribut.
- La poursuite à terre : **poursuite-terrestre** · poursuite-terrestre-rattrapes.

## Commerce (gabarit 4)
- La halle (`marcheDeTerre`) : **halle-achat** · halle-vente.
- Le port (`port`) : **port** · port-negoce · port-achat · port-chantier · port-recrutement · port-avitaillement
  (onglets d'une même page).
- Le marchandage : **marchandage** · marchandage-avant-le-de.

## Exploration et récit
- L'exploration : **exploration-gestes** · exploration · exploration-dessus. exploration-premiere-personne reste à
  trancher (plan § 4 : variante du gabarit 4 ou regard du décor `auberge`).
- Le document : **document** · document-relu.
- La carte du monde : **carte-du-monde** · carte-du-monde-depart-de-nuit.
- Les soins : **services-du-lieu-medecin** · soins-entre-heros (même page `soins.js`).

## Lieux
- L'auberge, onglets d'une même page : **nuit-a-l-auberge** · jeux-de-taverne.

## Voyage
- L'évènement de route (`evenement.js`) : **evenement-de-route** · evenement-de-route-issue · evenement-de-route-echec.
- Le voyage fluvial : **voyage-fluvial** · voyage-fluvial-peril.
- Le voyage en mer (`mer.js`) : **voyage-en-mer** · mer-relache · mer-conseil-de-bord · mer-fuite-de-vapeur.
- Le combat naval (`combat-naval.js`) : **combat-naval** · combat-naval-bordee · combat-naval-chanson ·
  meuble-piece-de-bord.
- Le dossier d'une possession (gabarit 3, un porteur qui n'est pas un combattant) : **dossier-du-navire** ·
  dossier-du-navire-cargaison · dossier-de-la-bete · dossier-du-vehicule.

## Héros (gabarit 3)
- Les Caractéristiques : **creation-caracteristiques-points** · creation-caracteristiques ·
  creation-caracteristiques-reassigner.
- Les talents : **creation-talents** · creation-talents-doublon · creation-talents-sorts-mineurs.
- La dépense d'expérience : **progression-depense-d-experience** · progression-depense-d-experience-creneaux ·
  progression-depense-d-experience-sorts.
- Le changement de carrière : **progression-changement-de-carriere** · progression-changement-de-carriere-saut.
- Les possessions de la fiche : **fiche-possessions** · fiche-possessions-composant · -faveur · -prothese.
- Les autres pages de la création (race, carrière, signe astral, compétences de race et de carrière, possessions,
  identité, présentation) sont dix étapes d'un même écran, chacune avec son propre corps : ce sont des pages, pas
  des doublons.

## Accueil, système et outils
- La nouvelle partie : **nouvelle-partie** · nouvelle-partie-roster · nouvelle-partie-coop.
- Les options : **options** · options-chance · options-verrou.
- Les sauvegardes : **sauvegardes** · sauvegardes-combat.
- Le chapitre : **ouverture-de-chapitre** · fin-de-chapitre. Même carton, avec un récapitulatif à la fin.
- Le compendium : **compendium** · compendium-atelier.
- L'éditeur de scène : **editeur-scene** · editeur-outil-terrain · editeur-supprimer.
- La coop : **coop-salon** · coop-ouvrir · coop-la-main.

## Bilan
45 lignes de groupe, comptées par script sur ce fichier. Elles nomment 143 des 162 maquettes, dont quelques pages
citées pour mémoire sans double : coup-critique, fin-victoire, corruption-mutation, bataille-de-masse-preparation,
exploration-premiere-personne. Les 19 maquettes qui restent n'ont aucun double : accueil, arrivee, carnet, les sept
autres étapes de la création, desengagement, designation-d-un-heros, dialogue, editeur-carte-du-monde, fin-de-seance,
fuite, interlude-en-ville, jet-de-competence, menu-de-la-partie, sauvetage-par-le-destin.
