---
name: feedback-demande-de-validation-est-un-defaut
description: Chaque demande de validation vue par l'utilisateur est un défaut à diagnostiquer à son émetteur et à corriger dans la vague, jamais une commande à rejouer
metadata:
  type: feedback
---

Toute demande de validation qui atteint l'utilisateur est un défaut. Avant de rejouer, nommer l'émetteur — hook du dépôt (`scripts/hooks/*`), classificateur du harnais, ou mon propre enchaînement — et corriger à la racine dans la même vague ; un hook fautif se ticketise avec ses sondes et se corrige par un codeur.

**Why:** « Tu fais quoi qui fait que je dois valider chacune de tes opérations ? » / « Pourquoi je dois valider ce genre d'opération ? Qui est responsable ? » (utilisateur, 2026-09-13).

**How to apply:** commit en worktree lié avec `cd <worktree> && …` en tête de commande et message inline par `-m "$(cat <<'EOF' … EOF)"` ; jamais `Set-Location`, jamais un fichier `-F` créé dans la même commande ; un brief qui cite des commandes git se passe inline à l'agent, pas par un heredoc. Voir [[env-coordination-sessions]].
