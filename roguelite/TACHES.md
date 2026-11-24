# Suivi des tâches du roguelite

L'état du travail, tenu à jour à chaque lot. Ce qui est décidé vit dans `CONCEPTION.md` (« Le jeu tel qu'il est
arrêté », puis les arbitrages) ; les idées non encore lancées dans `PISTES.md` ; les manques du noyau dans
`RETOURS.md`. Une tâche livrée sort de ce fichier : le commit en garde la trace.

## En cours

| Tâche | Où | Reste |
|---|---|---|
| Écritures de fin de combat perdues après le report (MyEdO/game#4860) : la mutation du seuil de Corruption et les ops d'`onVictory` écrivent le groupe ; la défaite et la victoire attendent un Destin en suspens | PR MyEdO/game#4888 (branche `chantier/4860`), fusion automatique armée | deux rondes de juge soldées (`.claude/soldes/4860.md`) ; attendre la CI et la file de fusion, puis vider les champs `Statut` / `Tenu par` du ticket |
| Question ouverte à l'utilisateur : création fidèle à la 5e (CRB 014-015 : 5 Compétences d'espèce à +5, 8 Augmentations de carrière plafonnées à +15, aucune Augmentation de Caractéristique) ou 4e alignée sur le pas de 5 (livrée, `roguelite/src/noyau/heros.ts`). À égalité, le Pyromancien met ses 5 Augmentations sur CC plutôt que FM | `roguelite/src/noyau/heros.ts` | attend la réponse |

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
13. Après chaque lot visible : jouer une partie complète à 1829×1029, puis publier l'artefact https://claude.ai/artifact/Efuaun1JUhbSpMpZEiAtLK (v32 publiée le 2026-11-23 : création au pas de 5). Publication : `node roguelite/construire.mjs`, puis la page `roguelite/dist/index.html` avec `jeu.js`, `jeu.css`, `kit.css` et `noyau.js` en fichiers joints. Un autre compte publie un artefact neuf : seul son auteur met à jour celui-ci.

## Reprendre ce chantier depuis un autre compte

- La branche `chantier/busy-pasteur-mpnok2` et sa PR MyEdO/game#4767 portent tout le roguelite ; ce fichier est l'état du travail, les arbitrages de l'utilisateur sont dans `CONCEPTION.md` et sur les tickets, cités et datés.
- Recette navigateur : `python3 -m http.server <port> --directory roguelite/dist`, puis `node roguelite/recette/partie.mjs <dossier> http://127.0.0.1:<port>/` ; tests : `node scripts/lancer-local.mjs vitest --cwd roguelite -- vitest run src/jeu src/noyau src/ui` ; `npx tsc -p roguelite`.
- Le roguelite ne modifie jamais `src/` : un manque du noyau va dans `RETOURS.md`, puis en ticket et chantier `chantier/<N>` (TDD, juge, PR).
- Avant de prendre un ticket du noyau : lire ses champs `Statut` / `Tenu par` (skill `se-coordonner-entre-comptes`).

## Tickets du noyau ouverts en chemin, sans preneur

- MyEdO/game#4825 : Perforante et Ulgu additionnent toutes les pièces portées, le reste la meilleure par couche.
- MyEdO/game#4879 : sept constructions `battle?.combatants ?? party` du pool des héros en combat hors d'`acteursEnJeu` (relevées par le juge de #4860).
- MyEdO/game#4827 : une monture perdue en cours de journée ouvre un budget à pied neuf (12 h de route le même jour).

## Attend l'utilisateur

Rien.
