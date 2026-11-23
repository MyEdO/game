# Suivi des tâches du roguelite

L'état du travail, tenu à jour à chaque lot. Ce qui est décidé vit dans `CONCEPTION.md` (« Le jeu tel qu'il est
arrêté », puis les arbitrages) ; les idées non encore lancées dans `PISTES.md` ; les manques du noyau dans
`RETOURS.md`. Une tâche livrée sort de ce fichier : le commit en garde la trace.

## En cours

| Tâche | Où | Reste |
|---|---|---|
| Cinq panoplies de 1 à 5 PA, prix, encombrement et pénalités (le cuir souple s'additionne depuis MyEdO/game#4824, fusionné) | `jeu/valeurs.ts`, `jeu/boutiques.ts` | codeur en cours |
| Montures et compagnon dans le noyau (MyEdO/game#4804) | `.wt-4804-compagnon`, PR MyEdO/game#4817 | lots A et B1 en file de fusion ; ensuite B2 (le compagnon en rencontre : le chien du Ratier membre du groupe ; aucun allié ne monte une bête du groupe, arbitrage du 2026-11-23), C (Blessures des bêtes gardées et soignées). La règle de monte « Dressé (Monture) exigé » (#4816) est tenue par un autre fil |
| Réserve de Focalisation VDM (MyEdO/game#865) | `.wt-865`, PR MyEdO/game#4838 | lot 1 jugé, en réalignement sur `main` (l'IA qui focalise de #4837) ; lot 2 : Interruption volontaire (VDM 02 l.139), évacuation sûre (l.141), Maladresse de Focalisation (l.149), cas du sort octroyé lu au grimoire |

## Ensuite, dans l'ordre

1. Dès que MyEdO/game#4847 est sur `main` : remplacer la boucle de `roguelite/src/noyau/combat.ts` (`jouerLeCombat`, `clore`, la comparaison de Destin) par `jouerLaRencontre` (`src/hote/rencontre.ts`), le résultat du lancement en second argument ; répondre au courrier https://github.com/MyEdO/game/pull/4767#issuecomment-7109565373 sur #4847.
2. Le mage en combat automatique, une fois #4838 fusionnée : remesurer le taux de lancer des sorts de voie par niveau, avec et sans `magie-vdm-incantation` ; rouvrir Arme et Armure aethyriques et Explosion si l'IA les lance ; Lumière, Métal et Mort n'offrent que Carreau au niveau 2.
3. Débords connus : la forge et l'Hospice à la taille d'interface « grande ».
4. Progression rapide « à la 5e » : plan conseillé en un clic, pas de +5, Compétences utiles seules ; c'est elle qui
   refait l'écran de progression, unique pour la fiche et la Salle d'armes, avec une seule marque des Augmentations.
   Le brief part de l'écran de la Salle d'armes que l'utilisateur connaît, et ne laisse pas carte blanche. Y montrer
   l'effet d'un achat en combat (piste 6).
5. Choisir hors combat qui monte sa monture : le roguelite le propose avant la rencontre (gestes `monterLaBete`,
   `quitterLaSelle` du noyau, lot B1).
6. Salles à choix, suite : la chirurgie au camp (aucune recrue n'a Chirurgie), « qui veille », les récompenses
   information et objet, des pièges sur d'autres Compétences, le choix de chemin entre deux salles, une ressource qui
   s'use. Le choix réel du soigneur attend le noyau (`RETOURS.md`, « aucun réglage du soigneur »).
7. Provisions de route à l'Auberge relais : rations, torches, cordes, qui ouvrent ou facilitent des actions de salle.
8. Placement du groupe, consigne par héros (doctrine de l'IA), cartes tactiques.
9. Corruption et maladies : l'horloge des maladies (hameau, salles, hospice) et la fiche sont faites (lot 1). Restent
   les rencontres à choix (autel profané, puits souillé, blessé contagieux) ; en combat, la mutation du seuil de
   Corruption attend le noyau (MyEdO/game#4860).
10. La forge améliore les armes : qualités d'artisanat que le noyau joue, puis Magique, à un palier élevé.
11. Équilibrage : les hardes, le Minotaure, et Guerrier du Chaos + Troll trop durs (0 sur 6 au balayage) ; les
    Collèges au niveau 1 n'ont que leurs sorts mineurs ; plus de morts depuis les potions à l'Hospice ; l'économie
    sur une campagne entière (piste 7).
12. Jouer une partie complète à 1829×1029, puis publier la v30 de l'artefact.

## Tickets du noyau ouverts en chemin, sans preneur

- MyEdO/game#4825 : Perforante et Ulgu additionnent toutes les pièces portées, le reste la meilleure par couche.
- MyEdO/game#4827 : une monture perdue en cours de journée ouvre un budget à pied neuf (12 h de route le même jour).

## Attend l'utilisateur

Rien.
