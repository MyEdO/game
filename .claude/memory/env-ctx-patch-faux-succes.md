---
name: env-ctx-patch-faux-succes
description: "lean-ctx ment dans les deux sens : ctx_patch rend SUCCÈS sans écrire, ctx_read ampute au triage, ctx_search rend 0 match sur un symbole présent, un [BLOCKED] peut s'être exécuté"
metadata:
  node_type: memory
  type: project
---

**Why:** un patch « réussi » non appliqué transforme une preuve par mutation en faux vert ; une lecture amputée fait raisonner sur un fichier fantôme ; un zéro de `ctx_search` ne prouve aucune absence ; un message de blocage est un signal de POLICY, pas une preuve de non-exécution.

**How to apply:** toute édition dont dépend une PREUVE se RELIT au fichier après coup, surtout un batch `ops[]` (un `replace_unique` non unique y est ignoré en silence) ; toute lecture ou tout relevé critique passe par un script `.mjs` du dépôt exécuté par le shell natif, jamais par `ctx_read` ; toute conclusion d'ABSENCE se recoupe par un outil d'une autre famille ; un « unchanged since your last Read » sur un fichier jamais lu se force par `fresh=true` ; après un `[BLOCKED]` sur une commande à effet de bord, vérifier l'état de la cible. À recopier dans les briefs de codeurs. En worktree, tout chemin de `ctx_patch`/`ctx_read` est ABSOLU : un chemin relatif se résout contre la racine lean-ctx, donc contre l'arbre principal.
