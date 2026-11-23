# Suivi des tâches du roguelite

L'état du travail, tenu à jour à chaque lot. Ce qui est décidé vit dans `CONCEPTION.md` (« Le jeu tel qu'il est
arrêté », puis les arbitrages) ; les idées non encore lancées dans `PISTES.md` ; les manques du noyau dans
`RETOURS.md`. Une tâche livrée sort de ce fichier : le commit en garde la trace.

## En cours

| Tâche | Où | Reste |
|---|---|---|
| Écritures de fin de combat perdues après le report (MyEdO/game#4860) : la mutation du seuil de Corruption et les ops d'`onVictory` écrivent le groupe ; la défaite et la victoire attendent un Destin en suspens | branche `chantier/4860` | codeur rendu vert (`src/noyau` 1037 fichiers verts) ; reste la garde du Destin remontée en tête de `checkBattleOver` (victoire comprise), un juge de diff, puis PR et file de fusion |
| Création des héros alignée sur des multiples de 5 (arbitrage 2026-11-23 : « faut fixer les augm même de la crea a 5 points ») : les 5 Augmentations de Caractéristique sur une seule (LDB 05 l.459), les 40 de carrière en +5/+10 (l.535), les +3 de race hors carrière ou complétés (l.484) | `roguelite/src/noyau/heros.ts` | codeur en cours ; question ouverte à l'utilisateur : création fidèle à la 5e (CRB 014-015) ou 4e alignée |

## Ensuite, dans l'ordre

1. Le compagnon en rencontre (MyEdO/game#4804, lot B2), après la fusion de #4860 (même fichier `combatSlice.ts`) : le chien du Ratier membre du groupe ; `mountablesNear` exclut les bêtes du groupe pour tout allié (arbitrage du 2026-11-23, au ticket). Puis le lot C : Blessures des bêtes gardées et soignées.
2. MyEdO/game#4847 est sur `main` : remplacer la boucle de `roguelite/src/noyau/combat.ts` (`jouerLeCombat`, `clore`, la comparaison de Destin) par `jouerLaRencontre` (`src/hote/rencontre.ts`), le résultat du lancement en second argument ; répondre au courrier https://github.com/MyEdO/game/pull/4767#issuecomment-7109565373 sur #4847. La branche doit d'abord fusionner `main`.
3. Le mage en combat automatique (MyEdO/game#4838 fusionnée) : remesurer le taux de lancer des sorts de voie par niveau, avec et sans `magie-vdm-incantation` ; rouvrir Arme et Armure aethyriques et Explosion si l'IA les lance. Lot 2 de MyEdO/game#865 : Interruption volontaire (VDM 02 l.139), évacuation sûre (l.141), Maladresse de Focalisation (l.149).
4. Choisir hors combat qui monte sa monture : le roguelite le propose avant la rencontre (gestes `monterLaBete`, `quitterLaSelle` du noyau, lot B1).
5. Débords connus : la forge et l'Hospice à la taille d'interface « grande ». Libellés de refus encore doubles : `ui/services.ts` (`manqueAuPalier`), `ui/fiche.ts:43`.
6. Salles à choix, suite : la chirurgie au camp, « qui veille », les récompenses information et objet, des pièges sur d'autres Compétences, le choix de chemin, une ressource qui s'use. « Parlementer » raté avec une bourse vide se raconte mal. Le choix réel du soigneur attend le noyau (`RETOURS.md`).
7. Provisions de route à l'Auberge relais : rations, torches, cordes, qui ouvrent ou facilitent des actions de salle.
8. Placement du groupe, consigne par héros (doctrine de l'IA), cartes tactiques.
9. Corruption et maladies : les rencontres à choix (autel profané, puits souillé, blessé contagieux) ; la mutation du seuil en combat attend MyEdO/game#4860.
10. La forge améliore les armes : qualités d'artisanat que le noyau joue, puis Magique, à un palier élevé.
11. Équilibrage : les hardes, le Minotaure, Guerrier du Chaos + Troll (0 sur 6 au balayage) ; l'économie sur une campagne entière (piste 7) ; le soin de l'hospice gratuit au palier 3.
12. Genre des noms tirés.
13. Après chaque lot visible : jouer une partie complète à 1829×1029, puis publier l'artefact https://claude.ai/artifact/Efuaun1JUhbSpMpZEiAtLK (v31 publiée le 2026-11-23 : progression à la 5e, potions au départ). Publication : `node roguelite/construire.mjs`, puis la page `roguelite/dist/index.html` avec `jeu.js`, `jeu.css`, `kit.css` et `noyau.js` en fichiers joints. Un autre compte publie un artefact neuf : seul son auteur met à jour celui-ci.

## Reprendre ce chantier depuis un autre compte

- La branche `chantier/busy-pasteur-mpnok2` et sa PR MyEdO/game#4767 portent tout le roguelite ; ce fichier est l'état du travail, les arbitrages de l'utilisateur sont dans `CONCEPTION.md` et sur les tickets, cités et datés.
- Recette navigateur : `python3 -m http.server <port> --directory roguelite/dist`, puis `node roguelite/recette/partie.mjs <dossier> http://127.0.0.1:<port>/` ; tests : `node scripts/lancer-local.mjs vitest --cwd roguelite -- vitest run src/jeu src/noyau src/ui` ; `npx tsc -p roguelite`.
- Le roguelite ne modifie jamais `src/` : un manque du noyau va dans `RETOURS.md`, puis en ticket et chantier `chantier/<N>` (TDD, juge, PR).
- Avant de prendre un ticket du noyau : lire ses champs `Statut` / `Tenu par` (skill `se-coordonner-entre-comptes`).

## Tickets du noyau ouverts en chemin, sans preneur

- MyEdO/game#4825 : Perforante et Ulgu additionnent toutes les pièces portées, le reste la meilleure par couche.
- MyEdO/game#4827 : une monture perdue en cours de journée ouvre un budget à pied neuf (12 h de route le même jour).

## Attend l'utilisateur

Rien.
