---
name: env-agent-cwd-separe-commande-simple
description: "Sous-agent en worktree : Bash, une commande simple par appel, chaque chemin ABSOLU sous le worktree ; lecture par Read/Grep/Glob ; le cwd de Bash n'est pas forcément l'arbre, et un `cd` ne persiste pas"
metadata:
  node_type: memory
  type: project
  originSessionId: 5da5cbb6-e8b7-47f0-9526-01d6f45270f5
---

Toute commande d'un sous-agent passe par Bash : UNE commande simple par appel, chaque chemin ABSOLU sous `<worktree>` (ou `npm --prefix <worktree>`), jamais `cd … &&`, `;`, pipe, `> fichier` ni `VAR=… ;`, qui demandent une autorisation qu'un agent de fond ne peut pas donner. Lecture par Read/Grep/Glob, chemins absolus sous l'arbre.

**Why:** les scripts du dépôt résolvent leurs chemins depuis le dossier courant ; le cwd de Bash d'un sous-agent n'est pas forcément son worktree, et sur l'arbre PRINCIPAL un générateur y a réécrit `src/data/schemas/_ids.generated.ts`. Le `cd` d'un sous-agent ne persiste pas d'un appel à l'autre.

**How to apply:**
- `mcp__lean-ctx__ctx_shell` n'est plus pré-approuvé (#2721) : un shell hors Bash échappe aux confirmations de `permissions.ask` ; garde `scripts/hooks/deploiement-confirme.test.mjs`.
- Jamais de fichier CRÉÉ sous `scripts/guards/` en fond (`exception-add-guard` demande) : étendre le module canonique.
- Après un train, `git -C <arbre principal> status --short` : un fichier généré par le worktree se restaure après preuve.
- Appel sans réponse : [[env-appel-sans-reponse-tube-ouvert]]. Voir aussi [[env-agents-figes]].
