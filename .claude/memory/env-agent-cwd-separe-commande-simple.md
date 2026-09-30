---
name: env-agent-cwd-separe-commande-simple
description: "Sous-agent en worktree : ctx_shell avec `cwd` = worktree, une commande simple par appel, lecture par ctx_read/ctx_search ; sans `cwd`, il mesure l'arbre principal ET y écrit ; le `cd` Bash d'un sous-agent ne persiste pas"
metadata:
  node_type: memory
  type: project
  originSessionId: 5da5cbb6-e8b7-47f0-9526-01d6f45270f5
---

Toute commande d'un sous-agent passe par `ctx_shell` avec `cwd` = `<worktree>` (ou `npm --prefix <worktree>`) : UNE commande simple par appel, jamais `cd … &&`, `;`, `> fichier` ni `VAR=… ;`, qui demandent une autorisation qu'un agent de fond ne peut pas donner. Lecture par `ctx_read`/`ctx_search`, jamais `cat`/`sed` sur un chemin hors du projet.

**Why:** les scripts du dépôt résolvent leurs chemins depuis le dossier courant ; sans `cwd`, l'agent mesure l'arbre PRINCIPAL et peut y écrire (un générateur y a réécrit `src/data/schemas/_ids.generated.ts`). Le `cd` Bash d'un sous-agent ne persiste pas, seul le `cwd` de `ctx_shell` persiste.

**How to apply:**
- Arbitrage de l'utilisateur (2026-09-28) : « Autoriser ctx_shell (Recommandé) ». Bash et PowerShell restent interdits aux agents de fond.
- Jamais de fichier CRÉÉ sous `scripts/guards/` en fond (`exception-add-guard` demande) : étendre le module canonique.
- Après un train, `git -C <arbre principal> status --short` : un fichier généré par le worktree se restaure après preuve.
- Appel sans réponse : [[env-appel-sans-reponse-tube-ouvert]]. Voir aussi [[env-agents-figes]], [[env-ctx-shell-cwd]].
