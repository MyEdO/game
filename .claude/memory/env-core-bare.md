---
name: env-core-bare
description: "« fatal — this operation must be run in a work tree » dans TOUS les worktrees = core.bare=true au .git/config commun ; cause connue — un banc qui fait `git init` sous un hook hérite de GIT_DIR"
metadata: 
  node_type: memory
  type: project
  originSessionId: 60c2b9c9-5d2c-4ec0-88b2-c409c7dc078c
  modified: 2026-09-20T19:16:39.339Z
---

Symptôme : `git status` / `git grep` / `rev-parse --show-toplevel` rendent « fatal: this operation must be run in a work tree » dans un worktree sain (alors que `rev-parse HEAD` et `diff --cached` répondent). Sonde : `git config --show-origin --get-all core.bare` → `true` au `.git/config` COMMUN. Réparation : `git config --file <Game>/.git/config core.bare false` (une clé ; vérifier `find .git -maxdepth 1 -mmin -15` que rien d'autre n'a bougé, et que l'index a son compte de stagés).

**Why:** sous un hook, git exporte `GIT_DIR` / `GIT_INDEX_FILE`. Un banc qui forge un dépôt par `git init` avec l'env HÉRITÉ réinitialise le VRAI dépôt et pose `bare = true` — tous les worktrees meurent, sessions parallèles comprises ; un `git add -A` derrière stagerait la suppression de tout l'arbre (#1825).

**How to apply:** tout lanceur git visant un dépôt FORGÉ reçoit un env purgé des variables de `git rev-parse --local-env-vars` — primitive `scripts/guards/lib/depotGabarit.mjs` (vérifier qu'elle existe avant de la citer). Un banc « vert hors hook » n'est PAS prouvé s'il forge un dépôt. Ne JAMAIS pointer `GIT_DIR` sur le vrai dépôt pour reproduire. Voir [[env-coordination-sessions]], [[feedback-preuve-mesuree-sur-le-chemin-reel]].
