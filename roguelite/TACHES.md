# Suivi des tâches du roguelite

L'état du travail, tenu à jour à chaque lot. Ce qui est décidé vit dans `CONCEPTION.md` (« Le jeu tel qu'il est
arrêté », puis les arbitrages) ; les idées non encore lancées dans `PISTES.md` ; les manques du noyau dans
`RETOURS.md`. Une tâche livrée sort de ce fichier : le commit en garde la trace.

## En cours

| Tâche | Où | Reste |
|---|---|---|
| Compagnon animal et montures dans le noyau (MyEdO/game#4804) | `.wt-4804-compagnon`, PR MyEdO/game#4817 | lot A en PR brouillon ; lot B1 (cavalier choisi hors combat, IA, voyage) codé, finition en cours (tests de l'IA alliée, preuves par mutation), puis juge ; ensuite B2 (compagnon en rencontre), C (Blessures) |
| Le cuir souple ajoute ses PA (MyEdO/game#4820), puis cinq panoplies de 1 à 5 PA | `.wt-4820-cuir-souple`, puis `jeu/valeurs.ts` | codeur du noyau en cours |
| Un mage pose les sorts de sa voie en combat automatique : réserve de Focalisation VDM (MyEdO/game#865), l'IA qui focalise (MyEdO/game#4821) | `.wt-865`, `.wt-4821` | #865 : design jugé, lot 1 (la réserve) en codage, lot 2 (Interruption volontaire, évacuation, Maladresse VDM) ensuite ; #4821 en codage |

## Ensuite, dans l'ordre

1. Dès que MyEdO/game#4847 est sur `main` : remplacer la boucle de `roguelite/src/noyau/combat.ts` (`jouerLeCombat`, `clore`, la comparaison de Destin) par `jouerLaRencontre` (`src/hote/rencontre.ts`), le résultat du lancement en second argument ; répondre au courrier https://github.com/MyEdO/game/pull/4767#issuecomment-7109565373 sur #4847.
2. Débords connus : la forge et
   l'Hospice à la taille d'interface « grande » (la Salle d'armes à 20 sorts est réglée par le tri des sorts).
3. Progression rapide « à la 5e » : plan conseillé en un clic, pas de +5, Compétences utiles seules ; c'est elle qui
   refait l'écran de progression, unique pour la fiche et la Salle d'armes, avec une seule marque des Augmentations.
   Le brief part de l'écran de la Salle d'armes que l'utilisateur connaît, et ne laisse pas carte blanche.
4. Choisir hors combat qui monte sa monture (après le lot B de #4804) ; le roguelite le propose avant la rencontre.
5. Placement du groupe, consigne par héros (doctrine de l'IA), cartes tactiques.
6. Corruption et maladies, en rencontres à choix.
7. Équilibrage : les hardes et le Minotaure trop durs avec le nouveau roster ; les Collèges au niveau 1 n'ont que
   leurs sorts mineurs ; plus de morts depuis les potions à l'Hospice.
8. Jouer une partie complète à 1829×1029, puis publier la v30 de l'artefact.

## Attend l'utilisateur

Rien.
