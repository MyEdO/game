---
name: env-type-d-agent-neuf-apres-publication
description: "Un type d'agent neuf (`.claude/agents/<x>.md`) n'existe pour Agent et `agent()` qu'une fois dans l'arbre PRINCIPAL et la session relancée ; depuis un worktree, chaque appel échoue sans agent"
metadata:
  node_type: memory
  type: project
  originSessionId: 5da5cbb6-e8b7-47f0-9526-01d6f45270f5
---

Le registre des types d'agent se charge au démarrage de la session, depuis l'arbre du PROJET (l'arbre principal), jamais depuis le worktree du chantier. Un workflow qui vise un type neuf avant publication voit chacun de ses appels échouer sans lancer d'agent : `failed` au journal, `agentId` vide.

**Why:** la table simulée d'EDO 01 a joué ses échanges avec un MJ seul, ses quatre joueurs (`agentType: 'joueur'`, défini dans le chantier) échouant à chaque salve.

**How to apply:** un chantier qui AJOUTE un type d'agent se publie, puis l'utilisateur relance la session, AVANT tout run qui le vise ; la liste des types disponibles (rappel système de la session) fait foi.
