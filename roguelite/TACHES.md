# Suivi des tâches du roguelite

L'état du travail, tenu à jour à chaque lot. Ce qui est décidé vit dans `CONCEPTION.md` (« Le jeu tel qu'il est
arrêté », puis les arbitrages) ; les idées non encore lancées dans `PISTES.md` ; les manques du noyau dans
`RETOURS.md`. Une tâche livrée sort de ce fichier : le commit en garde la trace.

## En cours

| Tâche | Où | Reste |
|---|---|---|
| Compagnon animal et montures dans le noyau (MyEdO/game#4804) | `.wt-4804-compagnon`, PR MyEdO/game#4817 | lot A en PR brouillon ; lot B1 (cavalier choisi hors combat, IA, voyage) en cours ; puis B2 (compagnon en rencontre), C (Blessures) |
| Cinq panoplies, une par niveau de PA, prix et encombrement | `jeu/valeurs.ts`, `jeu/boutiques.ts` | codeur en cours |
| Auberge relais : chambre de repos (repos du noyau) et renvoi avec prime | worktree isolé | codeur en cours |

## Ensuite, dans l'ordre

1. Débords connus : la forge et
   l'Hospice à la taille d'interface « grande » (la Salle d'armes à 20 sorts est réglée par le tri des sorts).
2. Sorts, suite : un mage de niveau 2 ne pose aucun sort de sa voie en combat automatique : avec ses Caractéristiques
   de départ il doit focaliser plusieurs tours et le combat finit avant (constat utilisateur : « Sans les bonnes stats,
   c'est difficile de monter assez sa foca pour lancer un sort »). Ordonner chaque voie par ND : aux premiers niveaux,
   des sorts de faible ND (Arme et Armure aethyriques ND 2, Carreau et Explosion ND 4, Embrasement ND 3, Écorce ND 3),
   les ND 6 à 9 plus tard ; mesurer en combat simulé le taux de lancer par niveau. Jouer avec les règles optionnelles
   du noyau qui conviennent (« Faut aussi jouer avec les régles optionnels qui vont bien comme celui de VDM ») :
   `magie-vdm-incantation` (Focalisation en réserve qui réduit le NI de tout sort du Vent, VDM 02 l.129-139 ; Puissance
   totale ; Projectile magique + BFM), posée une fois dans `ouvrirEnAuto` (`regles`), mesurée avec et sans.
3. Progression rapide « à la 5e » : plan conseillé en un clic, pas de +5, Compétences utiles seules ; c'est elle qui
   refait l'écran de progression, unique pour la fiche et la Salle d'armes, avec une seule marque des Augmentations.
   Le brief part de l'écran de la Salle d'armes que l'utilisateur connaît, et ne laisse pas carte blanche.
4. Salles à choix, suite : le camp avec le soigneur (infirmerie du noyau), la rencontre sociale.
5. Choisir hors combat qui monte sa monture (après le lot B de #4804) ; le roguelite le propose avant la rencontre.
6. Placement du groupe, consigne par héros (doctrine de l'IA), cartes tactiques.
7. Corruption et maladies, en rencontres à choix.
8. Équilibrage : les hardes et le Minotaure trop durs avec le nouveau roster ; les Collèges au niveau 1 n'ont que
   leurs sorts mineurs ; plus de morts depuis les potions à l'Hospice.
9. Jouer une partie complète à 1829×1029, puis publier la v30 de l'artefact.

## Attend l'utilisateur

Rien.
