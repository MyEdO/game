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
  sceau de résultat avant le dé en empreinte vide ; gestes « Lancer » (laiton plein) et « Annuler », libellés absents
  du jeu ; centre élargi de 300 à 380 px, le bandeau ne bouge pas.

## jet-de-defense (J1 à J8)
- Ruban « Défense », camp du joueur à gauche.
- À valider : réussite en sceau de cire verte et verdict vert sombre (le kit ne fixait que la cire rouge de l'échec) ;
  DR net du vainqueur ; phrase d'issue avec la localisation (dé inversé 24 → 42, bras droit), sans dégâts.

## incantation (J10)
- Bandeau à un seul camp lanceur ; le centre porte le sort en gothique et « Sort · Niveau d'incantation 0 ».
- À valider : cible à droite en bloc sans dé (portrait de fer, « Cible du sort », Blessures) ; seuil « Langue
  (Magick) ≤ 85 » d'exemple ; mêmes cinq gestes qu'à l'attaque.

## coup-critique (C1, C2, C3)
- Le bandeau reste en place : à gauche la victime, sa silhouette, « Touché à la tête », sceau « 2 » Blessures
  perdues ; à droite le nom du Critique en gothique et le texte du livre en sérif droit ; un seul geste « Continuer ».
- À valider : la barre de l'Orc passe à 12 / 14 dans l'ordre et sur le pion.

## debut-du-round (R1)
- Le choix dans le bandeau : « Agir en premier », deux cartes de héros pressables, la choisie en laiton plein ; un
  geste « Commencer le round ».
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
  de profil, niche à figure, onglets ; champ assombri à 42 % ; « Fermer » en pastille sous celle du système.
- À valider : la fiche ne prend pas tout l'écran, les ancrages restent visibles ; montrée sur Berta (un héros qui
  n'est pas l'actif) ; réserves sur une colonne ; linéale Inter Medium ; pas d'onglet « Sorts » (Berta n'est pas
  lanceuse). La maquette de fiche montre « M 2 » pour Ilyanwe, le meuble 4 / 4 : écart à trancher.

## cible-survolee (T14, T15, T16)
- Case cernée de cire rouge, infobulle de parchemin, zone atteignable à liseré, trajet en pointillé, socles de camp,
  barre de vie fine ; « Attaque » armée ; barre des six emplacements rapides validée.
