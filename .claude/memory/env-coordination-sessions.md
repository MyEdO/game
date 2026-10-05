---
name: env-coordination-sessions
description: "Les gardes qui balaient le DISQUE (CI, train) prennent un WIP voisin en otage ; le pre-commit, lui, ne lit que l'index — livrer depuis un worktree à npm ci, puis fusion en avance rapide"
metadata:
  node_type: memory
  type: project
---

**Why:** les gardes de disque (`docs:build`, `raw:implemente --check`, gardes qui listent leurs documents par git) balaient l'ARBRE : jouées sur l'arbre partagé qui porte le WIP d'une autre session, elles refusent un train propre sur l'index, et deux gardes peuvent être structurellement contradictoires. Le pre-commit ne juge que l'index (`scripts/git-hooks/pre-commit.mjs`) ; les gardes de disque vivent à la CI et au train.

**How to apply:** livrer depuis un worktree détaché à HEAD (patch de l'index appliqué dedans, **`npm ci` DANS le worktree** — sans node_modules propres, vitest remonte à l'arbre principal), puis fusion en avance rapide dans l'arbre principal ; les docs générés se régénèrent sur l'INDEX, pas sur l'arbre ; un fichier modifié n'a pas de propriétaire évident — il se classe par son CONTENU (historique, diff), jamais par intuition, et aucune remise à l'état HEAD ne se fait sans l'inventaire de l'autre session.
