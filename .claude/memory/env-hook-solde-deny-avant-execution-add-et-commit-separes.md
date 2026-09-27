---
name: env-hook-solde-deny-avant-execution-add-et-commit-separes
description: "Le hook solde-ticket-guard évalue la commande Bash AVANT son exécution — un `git add X && git commit` est refusé sur l'index d'AVANT le add, et rien ne s'exécute"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: a0dfb696-da2e-4137-ae4b-32ad3e05ed77
  modified: 2026-09-17T23:49:31.362Z
---

`scripts/hooks/solde-ticket-guard.mjs` est un hook PreToolUse (Claude Code), pas un hook git : il lit
l'index STAGÉ au moment où la commande est soumise, puis rend `deny`, et un deny annule TOUTE la
commande. Un `git add <revue> && git commit -F …` en une seule ligne est donc refusé (« Palier atteint …
revue exigée ») alors que la revue est sur le disque, et `git diff --cached` rend VIDE ensuite parce que
le `git add` n'a jamais tourné — ce n'est pas un « add qui ne prend pas » (fausse piste vue 2026-09-18).

**Why:** un deny de hook ressemble à une erreur git, et l'index vide après coup fait croire à une perte.

**How to apply:** `git add` dans une commande, `git commit` dans la SUIVANTE, et vérifier l'index par
`git diff --cached --name-only` entre les deux. Même règle pour le fichier `-F` ([[env-garde-commit-fichier-message-doit-preexister]]).
