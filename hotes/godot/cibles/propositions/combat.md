# Propositions : combat (2026-11-16, #3935)

Compte rendu des onze états dessinés depuis la cible écrite `../ecrites/combat.md`, le contrat `../combat.md` et les
maquettes validées (`../maquettes/`). Sources au dépôt : `sources/combat/`.
Rien n'est validé : chaque « choix à valider » attend l'utilisateur.

Textes repris du jeu : libellés de `src/i18n/messages/fr.ts` (« Localisation », « Au hasard », « Retenir ses coups »,
« Début du round », « Agir en premier », « Commencer le round », « Incantation », « Victoire », « Défaite », les six
localisations) ; critique « Coup percutant » verbatim de `src/data/criticals.json` ; malus de visée −20 (LDB 14 l.73,
`src/engine/combat.ts:1047`).

## tour-adverse (A1, A2, T3)
- Le meuble garde sa place et montre l'adversaire : portrait de fer, nom, arme (« Hache »), Blessures.
- Plaques et fin du tour fermées.
- À valider : le meuble ne montre ni Mouvement, ni Action, ni Avantage ; emplacements rapides absents (ce sont ceux
  du héros) ; ruban « Action » grisé ; l'ordre montre l'Orc actif, la borne « Round 2 » puis deux fantômes ; aucune
  marque au sol pour l'adversaire, seulement son halo de camp.

## jet-avant-le-de (J9)
- Silhouette à six zones et « Au hasard », « Retenir ses coups » en bascule, dés posés sans face.
- À valider : une zone choisie (Tête, en laiton plein) plutôt que « Au hasard » ; malus en étiquette « −20 au Test »
  et seuil déjà corrigé ; « Au hasard » en petite plaque sombre ; bascule en interrupteur de fer à bouton de laiton ;
  sceau de résultat avant le dé en empreinte vide ; gestes « Lancer » (laiton plein, `verbe.lancer`), « Résilience »
  (LDB 17 l.68) et « Annuler » (`verbe.annuler`), réserves du héros à gauche (`sources/combat/jet.js`) ; centre
  élargi de 300 à 380 px, le bandeau ne bouge pas.

## jet-de-defense (J1 à J8)
- Ruban « Défense », camp du joueur à gauche.
- À valider : réussite en sceau de cire verte et verdict vert sombre (le kit ne fixait que la cire rouge de l'échec) ;
  DR net du vainqueur ; phrase d'issue avec la localisation (dé inversé 24 → 42, bras droit), sans dégâts.
- Reste : le choix de la réaction avant le dé du défenseur (LDB 13 l.167) n'est pas dessiné, écran du lot suivant.

## incantation (J10)
- Bandeau à un seul camp lanceur ; le centre porte le sort en gothique et « Sort · Niveau d'incantation 0 ».
- À valider : cible à droite en bloc sans dé (portrait de fer, « Cible du sort », Blessures) ; seuil « Langue
  (Magick) ≤ 85 » d'exemple ; mêmes cinq gestes qu'à l'attaque.
- Jet réussi (34 sous 85) : « Relancer » et « Résilience » fermés, la raison en bulle au survol (LDB 17 l.23, l.68) ;
  « Chance : +1 DR » reste ouverte (LDB 17 l.24). 34 n'est pas un double : pas d'Incantation Critique à choisir
  dans cet état (LDB 46 l.26-32).

## coup-critique (C1, C2, C3)
- Le bandeau reste en place : à gauche la victime, sa silhouette, « Touché à la tête », sceau « 2 » Blessures
  perdues ; à droite le nom du Critique en gothique et le texte du livre en sérif droit ; un seul geste « Continuer ».
- La barre de l'Orc compte le coup et le Critique (LDB 14 l.3) : 9 / 14 dans l'ordre et sur le pion, soit
  10 dégâts − 7 (BE 4 + PA 3, `src/data/creatures.json`) = 3 Blessures, puis les 2 du Critique (LDB 18 l.65). Le
  journal dit le coup au format du jeu (`touche.chiffree`, `touche.critique`, `src/i18n/messages/fr.ts:103-105`).
- À valider : le DR net d'exemple du coup (+4, avec les Dégâts +6 du bâton) ; l'état montré est celui d'après
  l'application des deux pertes.

## debut-du-round (R1)
- Le choix dans le bandeau, carte puis plaque : « Agir en premier », une carte par héros offert, la choisie en
  laiton plein ; la plaque « Commencer le round » commet.
- Berta seule est offerte : Ilyanwe est déjà en tête de l'ordre (`src/noyau/turnEconomy.ts:43`).
- La carte porte son coût, « 1 Chance » (LDB 17 l.25 ; une arme Rapide le rendrait gratuit, LDB 62 l.298-300,
  `turnEconomy.ts:61`) ; la Chance de Berta en médaillon à gauche de la plaque.
- Reste, hors maquette : le noyau dépense la Chance au clic de la carte (`src/noyau/combatSlice.ts:2160`), la
  maquette au clic de la plaque (transversal §6 n° 4) ; le Tir rapide (LDB 11 l.97-103) vient au lot suivant.
- À valider : cartouche « Round 2 · le round débute » ; personne d'agrandi dans l'ordre ; fin du tour fermée ;
  aucune marque au sol.

## fin-victoire, fin-defaite (F1, F2)
- Champ assombri à 66 %, cartouche de toile rouge à queues d'aronde et liseré d'or, plus sombre pour la défaite ;
  « Reprendre » en laiton plein dessous.
- À valider : tout le reste de l'interface disparaît, seule la pastille du système reste ; pions du camp vaincu
  retirés. Tension : le cartouche est centré (F1 et la cible le veulent) alors que la règle dit « jamais de fenêtre
  centrée » pour ce qui arrête le jeu.

## journal-ouvert (T19)
- Panneau de parchemin ouvert au-dessus de sa pastille, qui passe en laiton plein ; rangé par round, ruban
  « Journal ».
- À valider : les trois lignes sur la scène disparaissent tant qu'il est ouvert ; lignes d'exemple.

## fiche-au-clic (T21)
- Quatre panneaux entre l'ordre et le journal, au-dessus du meuble, repris de la maquette de fiche : identité, bande
  de profil, niche à figure, onglets ; champ assombri à 42 % ; la croix de laiton de la charte (`sources/gestes.js`) sous la pastille du système.
- À valider : la fiche ne prend pas tout l'écran, les ancrages restent visibles ; montrée sur Berta (un héros qui
  n'est pas l'actif) ; réserves sur une colonne ; linéale Inter Medium ; pas d'onglet « Sorts » (Berta n'est pas
  lanceuse).
- « M 2 » de la maquette de fiche contre 4 / 4 au meuble : sans objet. La fiche validée montre Ilyanwe À Terre
  (0 / 17), son Mouvement effectif est la moitié de 4 (`src/engine/encumbrance.ts:53-66`) ; debout, le meuble dit 4.

## cible-survolee (T14, T15, T16)
- Case cernée de cire rouge, infobulle de parchemin, zone atteignable à liseré, trajet en pointillé, socles de camp,
  barre de vie fine ; « Attaque » armée ; barre des six emplacements rapides validée.
