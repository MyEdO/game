---
name: env-coordination-sessions
description: "La porte pre-commit mesure l'ARBRE, jamais l'index : un WIP voisin prend un train propre en otage — livrer depuis un worktree à npm ci, puis fusion en avance rapide"
metadata:
  node_type: memory
  type: project
---

**Why:** les gardes de porte (`docs:check`, `raw:implemente`, gardes qui listent leurs documents par git) balaient le DISQUE : quand l'arbre porte le WIP d'une autre session, un train propre sur l'index est refusé, et deux gardes peuvent être structurellement contradictoires.

**How to apply:** livrer depuis un worktree détaché à HEAD (patch de l'index appliqué dedans, **`npm ci` DANS le worktree** — sans node_modules propres, vitest remonte à l'arbre principal), puis fusion en avance rapide dans l'arbre principal ; les docs générés se régénèrent sur l'INDEX, pas sur l'arbre ; un fichier modifié n'a pas de propriétaire évident — il se classe par son CONTENU (historique, diff), jamais par intuition, et aucune remise à l'état HEAD ne se fait sans l'inventaire de l'autre session.
