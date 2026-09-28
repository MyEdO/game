---
name: env-ctx-shell-cwd
description: "Le cwd de ctx_shell persiste et peut pointer sur un WORKTREE voisin (.wt-*) : toute mesure git s'y fait au mauvais arbre — nommer l'arbre (git -C <racine>) ou vérifier pwd avant d'attribuer un état"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: dbd42dde-308b-4eb5-8d60-944a9814de50
  modified: 2026-09-14T08:15:12.059Z
---

Le 2026-09-14, `ctx_shell` (lean-ctx) avait pour cwd `Game/.wt-1508-t3b` (worktree d'une autre session) alors que la session travaillait dans `Game/`. Un `git status` y a rendu 42 fichiers modifiés, rapportés à l'utilisateur comme une « pollution de main » puis démentis par deux sessions : l'arbre principal était propre.

**Why:** le cwd de `ctx_shell` « persiste entre appels » et n'est pas celui du harnais ; les worktrees vivent SOUS la racine (`.wt-*`, `.claude/worktrees/*`), donc les chemins relatifs y résolvent sans erreur et rien ne signale la dérive. Le credo interdit d'attribuer un diff sans preuve — une mesure au mauvais arbre n'est pas une preuve ([[feedback-attribution]], [[env-coordination-sessions]]).

**How to apply:** avant toute mesure d'état git ou de fichier destinée à un rapport, `pwd` + `git rev-parse --show-toplevel` dans le MÊME appel, ou passer `cwd` explicitement / `git -C <racine absolue>`. Symptôme révélateur : un fichier vu par le Bash natif et « introuvable » par `ctx_shell` (ici `Source/_marker/...`). Ne jamais relayer une attribution avant d'avoir nommé l'arbre mesuré.
