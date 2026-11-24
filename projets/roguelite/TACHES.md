# Suivi des tâches du roguelite

L'état du travail, tenu à jour à chaque lot. Ce qui est décidé vit dans `CONCEPTION.md` (« Le jeu tel qu'il est
arrêté », puis les arbitrages) ; les idées non encore lancées dans `PISTES.md` ; les manques du noyau dans
`RETOURS.md`. Une tâche livrée sort de ce fichier : le commit en garde la trace.

## En cours

| Tâche | Où | Reste |
|---|---|---|
| Création des recrues par la création 5e du noyau (arbitrage du 2026-11-24, `CONCEPTION.md`), à la place de la création au pas de 5. Non entamée : reprendre la procédure de MyEdO/game#4912. Le pas de progression (`PAS`, `augmentationsDuPas` de `projets/roguelite/src/noyau/carriere.ts`) compte des points d'Augmentation, que le modèle 5e ajoute par 5 (`modeleDe(hero).pas`) : à revoir avec elle | `projets/roguelite/src/noyau/heros.ts`, `projets/roguelite/src/noyau/carriere.ts` | tout |

## Ensuite, dans l'ordre

1. Le compagnon en rencontre (MyEdO/game#4804) : lot B2 fusionné (MyEdO/game#4908), le chien du Ratier combat à son propre tour et le rejeu montre son pion, son portrait dans l'ordre et sa carte. Reste le lot C : Blessures des bêtes gardées et soignées, non entamé et libéré au ticket le 2026-11-24. Après la fusion de MyEdO/game#4911 (journal de combat), dessiner « ↳ » depuis le genre `detail` des lignes et rejouer le combat du chien (graine 114).
2. Le mage en combat automatique (MyEdO/game#4838 fusionnée) : remesurer le taux de lancer des sorts de voie par niveau, avec et sans `magie-vdm-incantation` ; rouvrir Arme et Armure aethyriques et Explosion si l'IA les lance. Lot 2 de MyEdO/game#865 : Interruption volontaire (VDM 02 l.139), évacuation sûre (l.141), Maladresse de Focalisation (l.149).
3. Choisir hors combat qui monte sa monture : le roguelite le propose avant la rencontre (gestes `monterLaBete`, `quitterLaSelle` du noyau, lot B1).
4. Débords connus : la forge et l'Hospice à la taille d'interface « grande ». Libellés de refus encore doubles : `ui/services.ts` (`manqueAuPalier`), `ui/fiche.ts:43`.
5. Salles à choix, suite : la chirurgie au camp, « qui veille », les récompenses information et objet, des pièges sur d'autres Compétences, le choix de chemin, une ressource qui s'use. « Parlementer » raté avec une bourse vide se raconte mal. Le choix réel du soigneur attend le noyau (`RETOURS.md`).
6. Provisions de route à l'Auberge relais : rations, torches, cordes, qui ouvrent ou facilitent des actions de salle.
7. Placement du groupe, consigne par héros (doctrine de l'IA), cartes tactiques.
8. Corruption et maladies : les rencontres à choix (autel profané, puits souillé, blessé contagieux) ; la mutation du seuil en combat est sur `main` (MyEdO/game#4888).
9. La forge améliore les armes : qualités d'artisanat que le noyau joue, puis Magique, à un palier élevé.
10. Équilibrage : les hardes, le Minotaure, Guerrier du Chaos + Troll (0 sur 6 au balayage) ; l'économie sur une campagne entière (piste 7) ; le soin de l'hospice gratuit au palier 3.
11. Genre des noms tirés.
12. Après chaque lot visible : jouer une partie complète à 1829×1029, puis publier l'artefact https://claude.ai/artifact/Efuaun1JUhbSpMpZEiAtLK (v34 publiée le 2026-11-24 : le chien du Ratier en combat). Publication : `node projets/roguelite/construire.mjs`, puis la page `projets/roguelite/dist/index.html` avec `jeu.js`, `jeu.css`, `kit.css` et `noyau.js` en fichiers joints. Un compte sans droit d'écriture sur l'artefact publie un artefact neuf au lieu de le remplacer.

## Reprendre ce chantier depuis un autre compte

- La branche `chantier/busy-pasteur-mpnok2` et sa PR MyEdO/game#4767 portent tout le roguelite. La PR reste en brouillon, sans fusion dans `main` (choix « Garder en brouillon » de l'utilisateur, carte de décision du 2026-11-24) ; ce fichier est l'état du travail, les arbitrages de l'utilisateur sont dans `CONCEPTION.md` et sur les tickets, cités et datés.
- Recette navigateur : `python3 -m http.server <port> --directory projets/roguelite/dist`, puis `node projets/roguelite/recette/partie.mjs <dossier> http://127.0.0.1:<port>/` ; tests : `node scripts/lancer-local.mjs vitest --cwd roguelite -- vitest run src/jeu src/noyau src/ui` ; `npx tsc -p roguelite`.
- Le roguelite ne modifie jamais `src/` : un manque du noyau va dans `RETOURS.md`, puis en ticket et chantier `chantier/<N>` (TDD, juge, PR).
- Avant de prendre un ticket du noyau : lire ses champs `Statut` / `Tenu par` (skill `se-coordonner-entre-comptes`).

## Tickets du noyau ouverts en chemin, sans preneur

- MyEdO/game#4825 : Perforante et Ulgu additionnent toutes les pièces portées, le reste la meilleure par couche.
- MyEdO/game#4879 : sept constructions `battle?.combatants ?? party` du pool des héros en combat hors d'`acteursEnJeu` (relevées par le juge de #4860).
- MyEdO/game#4904 : `jouerLaRencontre` ne s'écoute que par la tenue des jetons et s'arrête en impasse sur « Je te renie ! » (le roguelite décore sa tenue, `ouvrirEcoutee`).
- MyEdO/game#4906 : l'IA tire dans une mêlée où son camp est engagé (la fronde du Ratier touche son chien).
- MyEdO/game#4907 : la moitié des PX du Joueur pour un Homme de main (LDB 75 l.11).
- MyEdO/game#4827 : une monture perdue en cours de journée ouvre un budget à pied neuf (12 h de route le même jour).

## Attend l'utilisateur

Rien.
