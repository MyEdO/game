# Contrat de l'écran de combat (#3935)

Les signes de la cible validée, un par ligne, jugés sur la capture du jeu réel (`npm run godot:regarder -- combat`).
Un juge neuf statue signe par signe ; un signe sans verdict daté est **non vérifié**. Un lot d'écran cite les
signes qu'il ferme. Source : la cible écrite du 2026-11-13 et ses maquettes (fiche
`user-doctrine-la-cible-prime-sur-l-ancien-ecran`).
Les maquettes des planches, hors dépôt, se déclarent dans `maquettes.json` (`coteACote`, `hotes/godot/planches.mjs`).

Verdicts : `tenu`, `pas tenu`, `non vérifié`, chacun avec sa date ; le relevé du juge et ses captures vivent au ticket.

## Pendant le tour d'un héros

| n° | Signe | Verdict |
|---|---|---|
| T1 | Le champ prend tout l'écran : aucune colonne ni panneau posé dessus hors des trois ancrages | pas tenu : fenêtre « Début du round », liste « Sort » et barre des emplacements posées sur le champ (2026-11-16) |
| T2 | L'ordre du tour est une colonne de portraits au bord gauche, l'actif en bas et agrandi | tenu (2026-11-16) |
| T3 | Héros encadrés de laiton, adversaires de fer noirci sur fond de cire rouge | pas tenu : l'adversaire actif agrandi est encadré de laiton (2026-11-16) |
| T4 | Chaque rang porte une barre de vie fine et son nom à côté du portrait | tenu (2026-11-16) |
| T5 | Un médaillon marque où commence le round suivant | tenu (2026-11-16) |
| T6 | Le round est un cartouche de chêne en haut à gauche | tenu (2026-11-16) |
| T7 | Le meuble de l'actif est en bas au centre, chêne ferré, son portrait au milieu dépasse du meuble | tenu (2026-11-16) |
| T8 | À gauche du portrait : Blessures en barre et chiffres, Mouvement en losanges, Action en sceau, Avantage en chiffre | pas tenu : l'Action jouée est un disque vide, pas un sceau brisé (2026-11-16) |
| T9 | Les offres de l'Action sont des plaques à pictogramme et à nom ; l'offre armée est en laiton plein | non vérifié |
| T10 | Les offres à candidats sont des pastilles rondes nommées qui ouvrent leur liste | tenu (2026-11-16) |
| T11 | Six emplacements rapides numérotés au-dessus des actions | pas tenu : panneau détaché du meuble, libellés tronqués (2026-11-16) |
| T12 | Une liste ouverte ne montre que les options disponibles | non vérifié |
| T13 | La fin du tour est un gros bouton rond de laiton en bas à droite, deux petites pastilles à côté | tenu (2026-11-16) |
| T14 | La cible survolée a sa case cernée de cire rouge et une infobulle de parchemin à côté d'elle | non vérifié |
| T15 | Zone atteignable en teinte claire à liseré, trajet en pointillé, case d'arrivée cernée de crème | pas tenu : pas de liseré, case d’arrivée remplie de jaune (2026-11-16) |
| T16 | Chaque pion a un socle cerclé à la couleur de son camp et une barre de vie fine | pas tenu : ni socle de camp ni barre de vie (2026-11-16) |
| T17 | Aucun nom ni chiffre écrit au-dessus d'un pion | pas tenu : nom et Blessures écrits au-dessus de chaque pion (2026-11-16) |
| T18 | Le journal fait trois lignes en bas à droite, sur la scène, sans cadre, aucune ligne coupée | pas tenu : plus de trois lignes, lignes coupées, le journal saute en haut pendant un jet (2026-11-16) |
| T19 | Une pastille ouvre le journal entier sur un panneau de parchemin | non vérifié |
| T20 | Le système est une pastille en haut à droite ; aucun bouton de texte sur la scène | pas tenu : boutons de texte « Commencer le round », « Continuer », « Tout résoudre » (2026-11-16) |
| T21 | Aucune carte de héros à l'écran ; la fiche s'ouvre au clic sur un portrait de l'ordre | non vérifié |

## Pendant le tour d'un adversaire

| n° | Signe | Verdict |
|---|---|---|
| A1 | Le meuble garde sa place et montre l'adversaire : portrait de fer, nom, Blessures | pas tenu : portrait encadré de laiton, à droite du meuble (2026-11-16) |
| A2 | Les plaques et la fin du tour sont fermées (fer, gris) | pas tenu : plaques et fin du tour absentes au lieu de fermées (2026-11-16) |

## Pendant un jet (attaque, défense, incantation)

| n° | Signe | Verdict |
|---|---|---|
| J1 | Le bandeau de jet occupe la place du meuble de l'actif, en bas ; aucune fenêtre centrée | pas tenu : bandeau décalé à droite jusqu’au bord, couvre la fin du tour (2026-11-16) |
| J2 | Le champ reste visible ; les deux pions du coup gardent leur case cernée | pas tenu : le pion ciblé est mangé par le bandeau, la cible n’est pas cernée (2026-11-16) |
| J3 | Le bandeau a la même place quel que soit le jet | pas tenu : le bord haut saute d’environ 140 px selon l’étape (2026-11-16) |
| J4 | Parchemin dans un cadre de chêne ferré, le titre sur un ruban | tenu (2026-11-16) |
| J5 | Le camp du joueur à gauche, l'autre à droite, chacun avec portrait, compétence et seuil | pas tenu : camp adverse sans seuil avant le dé, replié sous le centre après (2026-11-16) |
| J6 | Chaque camp montre ses deux dés à dix faces, le résultat en sceau de cire, le verdict et le DR | pas tenu : aucun dé, cercle fin au lieu du sceau (2026-11-16) |
| J7 | Au centre, le DR net en gothique et la phrase d'issue | tenu (2026-11-16) |
| J8 | En bas, les gestes : celui de l'Entrée en laiton plein, les autres en plaque sombre | tenu (2026-11-16) |
| J9 | Avant le dé : localisation sur une silhouette à six zones et « Au hasard », « Retenir ses coups » en bascule, dés posés sans face | pas tenu : sept boutons de texte, pas de silhouette, aucun dé posé (2026-11-16) |
| J10 | L'incantation est le même bandeau à un seul camp, le centre porte le sort et sa cible | tenu (2026-11-16) |

## Au début du round

| n° | Signe | Verdict |
|---|---|---|
| R1 | Si le début du round s'affiche (un choix à faire), c'est à la place du bandeau de jet ; aucune fenêtre centrée | pas tenu : fenêtre sombre « Début du round » (2026-11-16) |

## Au coup critique

| n° | Signe | Verdict |
|---|---|---|
| C1 | Le bandeau reste en place et change de contenu ; aucune autre fenêtre | pas tenu : fenêtre sombre centrée (2026-11-16) |
| C2 | Silhouette avec la localisation touchée en cire rouge, Blessures perdues en sceau | pas tenu : pas de silhouette, lignes de texte (2026-11-16) |
| C3 | Nom du Critique en gothique, texte du livre en sérif, « Continuer » en laiton plein | pas tenu : titre générique, texte sans sérif, « Continuer » en plaque sombre (2026-11-16) |

## À la fin du combat

| n° | Signe | Verdict |
|---|---|---|
| F1 | Le champ s'assombrit ; un cartouche de toile au centre dit « Victoire » ou « Défaite » en gothique | non vérifié |
| F2 | Un seul bouton dessous ; le message n'est dit qu'une fois | non vérifié |

## Hors contrat

Le rendu du champ, les portraits peints (#2972), le mouvement (chute des dés, entrée du bandeau), l'ordre à
vingt-six combattants, la bataille de masse.
