---
name: user-doctrine-chantier-outille-sans-reinventer
description: "Une session déroule le workflow de bout en bout (worktree, suivi, commits, CI, tests, publication, fermeture) avec les outils du dépôt — jamais en réinventant un geste à la main"
metadata:
  node_type: memory
  type: user
---

**Verbatim (2026-09-14)** : « Moi ce que je veux c'est qu'une session puisse travailler convenablement en suivant notre workflow sans devoir réinventer la roue, que ce soit le worktree que le fichier de suivis, les messages de commits, la ci, les tests, etc ... »

**Verbatim (2026-09-14)** : « Ca me rends dingue que tu ais a faire des commandes git sur la branche principale » — #1750.

**Verbatim (2026-09-14)** : « En tout cas il est important d'offrir des outils qui ne demande pas de ma part une validation de la creation ou la modification d'un fichier, ou ca serait absurde » — #1750.

**Contexte** : prolonge #1736 (« pourquoi on doit tout faire a la main ? »).

**Why :** un geste du régime rejoué à la main coûte la cérémonie ET produit des variantes. Le régime est FIXE, donc il s'outille ; ce qu'une session doit encore inventer est un défaut de l'outillage.

**How to apply :** avant d'écrire à la main un artefact du régime (worktree, suivi, solde, message de commit, brief, revue de palier, train), chercher l'outil `scripts/ops/*` qui le pose ; absent ou refusant → ticket `domaine:outillage` traité dans le geste. Un outil se joue depuis tout worktree, sans exiger de « savoir » ce que le dépôt déclare déjà. L'ARBRE PRINCIPAL n'est jamais un point d'entrée : aucune commande git à la main (`worktree add`, `pull`, `branch -d`) ; si c'est le seul moyen, l'outil est en défaut. Un outil ou un hook ne demande JAMAIS de valider la création ou la modification d'un fichier : un hook `PreToolUse` sur `Write`/`Edit` juge le DELTA et ne rend `ask` que pour un fait NOUVEAU ; toute demande de validation vue par l'utilisateur est un défaut de la classe « hook = contenu entier ». Épique : #1750.
