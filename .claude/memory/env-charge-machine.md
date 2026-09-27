---
name: env-charge-machine
description: "Une seule tâche lourde à la fois sur cette machine, et arbre src/ AU REPOS pendant une recette ou une capture"
metadata:
  node_type: memory
  type: project
---

**Why:** deux suites complètes simultanées effondrent la machine (contention jsdom, gels matériels) ; et une recette/capture navigateur est une section critique — une écriture même IDEMPOTENTE sous `src/` (le `gen-registry` de `npm test` réécrit `src/data/*.json` à contenu identique) change le mtime, déclenche un full-reload Vite et efface `__wfrp`, invisible de l'état git.

**How to apply:** la suite complète (`npm test`, chemin canonique `scripts/test/run.mjs`, qui borne LUI-MÊME les workers — ne jamais y ajouter `--minWorkers`/`--maxWorkers`) se joue SEULE, jamais en fond ; le verrou `scripts/test/verrou.mjs` refuse la 2ᵉ mais ne voit ni les gates ni les recettes — un seul agent par worktree pendant une recette, aucun juge qui sonde, aucune capture ; ne croire un vert QUE s'il porte un COMPTE de tests > 0 ; les briefs d'agents ne demandent que des suites CIBLÉES.
