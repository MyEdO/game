---
paths:
  - "projets/roguelite/**"
---

# Projet roguelite (`projets/roguelite/`)

- Le roguelite est un projet tiers du noyau, séparé du jeu : un lot du roguelite n'écrit que sous `projets/roguelite/`. Une règle que le noyau ne joue pas, ou une couture qui lui manque, va en ticket sous-issue de l'épique #4899 (label `projet:noyau`), soldé sur son propre `chantier/<N>` avec les preuves du jeu ; il y entre par sa forme générique, en étendant le verbe, l'op ou le sélecteur qui le couvre en partie, jamais par un verbe ou un cas propre au roguelite (fiche `user-doctrine-noyau-generique-besoins-des-projets`).
- Sa suite et son typecheck sont ceux du dépôt : `npm run test:perimetre` et `npm run typecheck:fast` le prouvent comme tout code. Ses outils : `npm run roguelite:tests` (toute sa suite), `npm run roguelite:construire` (le jeu sous `dist/roguelite/`, ignoré par git) et `npm run roguelite:recette` (le lot de `projets/roguelite/recette/lot.mjs` sur cette construction) ; un script de `recette/` se lance seul pour l'écran touché.
- La CI joue sa suite avec celle du dépôt, et sa construction puis son lot de recettes en file (job `godot-recette` de `.github/workflows/ci.yml`).
- Où vit quoi : le jeu arrêté, la publication de l'artefact et les lots (label `projet:roguelite`) sur l'épique #4947, les arbitrages de l'utilisateur, verbatim datés, en commentaires de #4947 ou en fiche `user-arbitrage-roguelite-*` ; les manques du noyau sous #4899. Un lot part de « Le jeu tel qu'il est arrêté » de #4947.
- Le catalogue (carrières, sorts, équipement, prix, adversaires) a une seule source, `projets/roguelite/src/jeu/valeurs.ts` ; `projets/roguelite/CATALOGUE.md` se régénère par `npx tsx projets/roguelite/catalogue.ts` dans le commit qui change le catalogue.
- Prix, paliers, sélections et rencontres du roguelite sont des valeurs d'adaptation de la couche scénario du credo : décidées et tracées sur #4947 et au ticket du lot, jamais une règle optionnelle du noyau ni une cérémonie d'arbitrage. Une règle de jeu reste au noyau et au `Source/`.
- Le roguelite est une page web hors de Godot : les règles des écrans Godot ne le visent pas, et la suspension de la recette web (fiche `user-doctrine-recette-web-suspendue-migration-godot`) vise l'interface web du jeu, pas lui. Sa recette navigateur est une preuve de ses lots visibles.
