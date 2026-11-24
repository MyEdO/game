---
paths:
  - "projets/roguelite/**"
---

# Projet roguelite (`projets/roguelite/`)

- Le roguelite est un projet tiers du noyau, séparé du jeu : un lot du roguelite n'écrit que sous `projets/roguelite/`. Une règle que le noyau ne joue pas, ou une couture qui lui manque, va à `projets/roguelite/RETOURS.md`, puis en ticket sous-issue de l'épique #4899, soldé sur son propre `chantier/<N>` avec les preuves du jeu.
- Sa suite et son typecheck sont ceux du dépôt : `npm run test:perimetre` et `npm run typecheck:fast` le prouvent comme tout code. Ses outils : `npm run roguelite:tests` (toute sa suite), `npm run roguelite:construire` (le jeu sous `dist/roguelite/`, ignoré par git) et `npm run roguelite:recette` (le lot de `projets/roguelite/recette/lot.mjs` sur cette construction) ; un script de `recette/` se lance seul pour l'écran touché.
- La CI joue sa suite avec celle du dépôt, et sa construction puis son lot de recettes en file (job `godot-recette` de `.github/workflows/ci.yml`).
- Où vit quoi : l'état du travail dans `projets/roguelite/TACHES.md` ; le jeu arrêté et les arbitrages de l'utilisateur, verbatim datés, dans `projets/roguelite/CONCEPTION.md` ; les idées dans `projets/roguelite/PISTES.md` ; les manques du noyau dans `projets/roguelite/RETOURS.md`. Un lot part de « Le jeu tel qu'il est arrêté » de `CONCEPTION.md`.
- Le catalogue (carrières, sorts, équipement, prix, adversaires) a une seule source, `projets/roguelite/src/jeu/valeurs.ts` ; `projets/roguelite/CATALOGUE.md` se régénère par `npx tsx projets/roguelite/catalogue.ts` dans le commit qui change le catalogue.
- Prix, paliers, sélections et rencontres du roguelite sont des valeurs d'adaptation de la couche scénario du credo : décidées et tracées dans `CONCEPTION.md`, jamais une règle optionnelle du noyau ni une cérémonie d'arbitrage. Une règle de jeu reste au noyau et au `Source/`.
- Le roguelite est une page web hors de Godot : les règles des écrans Godot ne le visent pas, et la suspension de la recette web (fiche `user-doctrine-recette-web-suspendue-migration-godot`) vise l'interface web du jeu, pas lui. Sa recette navigateur est une preuve de ses lots visibles.
