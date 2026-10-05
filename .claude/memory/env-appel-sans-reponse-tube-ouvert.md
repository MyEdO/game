---
name: env-appel-sans-reponse-tube-ouvert
description: "Un appel d'outil d'agent sans tool_result est tenu par un hook pendu (`node scripts/hooks/*.mjs`, `rtk.exe hook`, `lean-ctx.exe hook`) ou un `cygwin-console-helper` orphelin. Arrêter le processus : l'appel reprend, run de workflow compris"
metadata:
  node_type: memory
  type: project
  originSessionId: 5da5cbb6-e8b7-47f0-9526-01d6f45270f5
---

Un appel d'outil sans `tool_result` attend un processus : un hook vivant après son timeout (`node scripts/hooks/*.mjs`, `rtk.exe hook claude`, `lean-ctx.exe hook`) ou un `cygwin-console-helper.exe` orphelin. L'arrêter fait reprendre l'appel en quelques secondes (#2112).

**Why:** tant que ce processus vit, l'agent est figé et `TaskStop` ne libère pas un run de workflow.

**How to apply:**
- Détecter : le transcript `subagents/**/agent-<id>.jsonl` ne bouge plus, dernier `tool_use` sans `tool_result` ; lister TOUS les processus nés dans les secondes qui suivent l'appel.
- Dégeler : `Stop-Process` depuis un script lancé par `pwsh -NoProfile -File`. Veille : un hook de plus de 2 min est pendu ; jamais `scripts/git-hooks/` ni un banc `*.test.mjs` (pre-commit et `node --test` durent des minutes).
- Une veille `Monitor` tourne sous un bash sans `pwsh` au PATH : chemin complet, filtre qui laisse passer les erreurs.
- Un agent ARRÊTÉ ne se reprend pas : un agent NEUF repart de l'état du worktree.
