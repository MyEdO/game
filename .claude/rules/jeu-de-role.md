---
paths:
  - "projets/jeu-de-role/**"
---

# Projet jeu de rôle (`projets/jeu-de-role/`)

- Le jeu de rôle est un projet du noyau, comme le roguelite : son contenu (campagnes et leurs générateurs, scénarios, fiches de dossier, cadrages) et ses suites vivent sous `projets/jeu-de-role/`, sa zone de `COUCHES` (`scripts/guards/lib/couches.mjs`), fermée à toute autre zone. Un lot du jeu de rôle n'écrit que sous `projets/jeu-de-role/` ; une couture qui manque au noyau ou au moteur va en ticket sous-issue de l'épique #5003, soldé sur son propre `chantier/<N>`, et y entre par sa forme générique, jamais par un cas propre au jeu (fiche `user-doctrine-noyau-generique-besoins-des-projets`).
- Le contenu se remet par `projets/jeu-de-role/contenu.ts` (`contenu: ContenuDUnJeu`) ; `projets/jeu-de-role/godot.ts` démarre le pont sur lui, et l'hôte texte le reçoit par `--contenu` (`.mcp.json`).
- Sa suite et son typecheck sont ceux du dépôt : `npm run test:perimetre` et `npm run typecheck:fast` le prouvent comme tout code. Ses outils : `npm run jeu-de-role:tests` (toute sa suite), `jeu-de-role:construire` (le pont sur son entrée), `jeu-de-role:ouvrir`, `jeu-de-role:web` (l'export sous `dist/godot`), `jeu-de-role:bureau`, `jeu-de-role:recette` (les jeux du lot natif qui ouvrent son contenu) et `jeu-de-role:docs` (ses docs générées sous `docs/projets/jeu-de-role/`).
- La CI joue sa suite avec celle du dépôt, et sa construction puis son lot de recettes en file (job `godot-recette` de `.github/workflows/ci.yml`) ; `deploy.yml`, `bureau.yml` et `canari.yml` bâtissent par ses scripts.
- Où vit quoi : le jeu et ses lots sur l'épique #5004 ; les retours sur le moteur et le noyau sous #5003. Les arbitrages de l'utilisateur, verbatim datés, en commentaires de #5004 ou en fiche.
- Les valeurs d'une campagne (distances, tarifs, durées) sont des valeurs d'adaptation de la couche scénario du credo, décidées et tracées au ticket du lot ; une règle de jeu reste au noyau et au `Source/`. Authoring : skill `creer-une-campagne`, `docs/campagne-authoring.md`.
