---
name: env-session-background-pieges-outils
description: "Read/Edit cassés ou un type d'agent qui résout à zéro outil → le correcteur consenti ; et deux commandes d'arbre qui échouent à moitié (cd mort, retrait de worktree)"
metadata:
  node_type: memory
  type: project
---

**Why:** la politique lean-ctx est réappliquée aux réglages à chaque début de session, et deux commandes d'arbre échouent en NON-terminant — la suite frappe alors l'arbre courant ou un chemin mort, sans erreur.

**How to apply:** si Read/Edit ou la lecture d'image échouent, ou qu'un type d'agent « resolve to zero tools » : exécuter `node ~/.claude/fix-leanctx-settings.mjs` (consentement utilisateur, idempotent, effet immédiat) AVANT tout contournement ; après tout changement de répertoire en contexte git, VÉRIFIER le dépôt courant avant la moindre commande d'état ; après un retrait de worktree, vérifier la liste des worktrees (il peut être désenregistré en laissant un dossier mort). Un train de publication se veille par sa commande `veille=`, qui sonde elle-même son pid ; tout AUTRE enfant DÉTACHÉ (`pid=` imprimé par `spawn`) veillé depuis un `Monitor` : sous Git Bash le pid Windows est la 4ᵉ colonne WINPID de `ps -W`, pas la 1ʳᵉ (pid Cygwin) — tester `ps -W | awk '$4==<pid>'` ; un test sur la 1ʳᵉ colonne rend « MORT » sur un processus vivant (mesuré 2026-09-14, train #1736) ; `tasklist` est bloqué en ctx_shell.
