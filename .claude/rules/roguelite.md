---
paths:
  - "roguelite/**"
---

# Hôte roguelite (`roguelite/`)

- Le roguelite est un hôte tiers du noyau, séparé du jeu : un lot du roguelite n'écrit que sous `roguelite/`. Une règle que le noyau ne joue pas, ou une couture qui lui manque, va à `roguelite/RETOURS.md`, puis en ticket sous-issue de l'épique #4899, soldé sur son propre `chantier/<N>` avec les preuves du jeu.
- Un diff qui ne touche que `roguelite/` se prouve par ses outils, chacun lancé depuis la racine : `node scripts/lancer-local.mjs typescript -- tsc -p roguelite`, `node scripts/lancer-local.mjs vitest --cwd roguelite -- vitest run <fichiers>` (sans fichiers, toute sa suite, avant de pousser), `node roguelite/construire.mjs`, et la recette de `roguelite/recette/` qui couvre l'écran touché.
- Jamais `npm run test:perimetre`, `npm test`, `npm run typecheck` ni `npm run docs:check` pour un tel diff : la suite Vitest (`RACINES_DE_LA_SUITE`) et le `tsconfig.json` racine ne couvrent pas `roguelite/`, donc ils rendent un vert qui ne prouve rien, après des minutes et un verrou partagé (mesure au ticket #4899).
- La CI ne joue aucun test du roguelite. Après chaque fusion de `main` dans sa branche, rejoue son typecheck et toute sa suite : un rouge venu de `main` se corrige dans `roguelite/`, ou va en ticket sous #4899 s'il révèle un défaut du noyau.
- Où vit quoi : l'état du travail dans `roguelite/TACHES.md` ; le jeu arrêté et les arbitrages de l'utilisateur, verbatim datés, dans `roguelite/CONCEPTION.md` ; les idées dans `roguelite/PISTES.md` ; les manques du noyau dans `roguelite/RETOURS.md`. Un lot part de « Le jeu tel qu'il est arrêté » de `CONCEPTION.md`.
- Le catalogue (carrières, sorts, équipement, prix, adversaires) a une seule source, `roguelite/src/jeu/valeurs.ts` ; `roguelite/CATALOGUE.md` se régénère par `npx tsx roguelite/catalogue.ts` dans le commit qui change le catalogue.
- Prix, paliers, sélections et rencontres du roguelite sont des valeurs d'adaptation de la couche scénario du credo : décidées et tracées dans `CONCEPTION.md`, jamais une règle optionnelle du noyau ni une cérémonie d'arbitrage. Une règle de jeu reste au noyau et au `Source/`.
- Le roguelite est une page web hors de Godot : les règles des écrans Godot ne le visent pas, et la suspension de la recette web (fiche `user-doctrine-recette-web-suspendue-migration-godot`) vise l'interface web du jeu, pas lui. Sa recette navigateur est une preuve de ses lots visibles.
