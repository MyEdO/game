---
paths:
  - "scripts/ops/**"
  - "scripts/gates/**"
  - ".github/workflows/**"
  - ".github/actions/**"
  - "scripts/agents/**"
  - "scripts/hooks/**"
  - "scripts/guards/**"
---

# Outillage ops, train, CI

- Un outil neuf entre dans un run dans le geste qui le crée : une gate de `ci.yml`, ou `canari.yml` s'il est trop lourd (`hotes/godot/lot-de-recettes.mjs`). Un outil qu'aucun run ne joue périme sans bruit. #4007
- Un outil ou une garde qui juge l'entrée d'un outil TIERS (paramètres lean-ctx, histoire git) se code d'emblée en forme FERMÉE : liste blanche minimale lue aux sources du tiers, tout le reste refusé. Épingle la version auditée dans une constante confrontée par un test `--version`. Exception, le pont Codex : il lance la version complète la plus récente, la mise à jour s'installe côte à côte en tâche détachée, jamais dans le lancement, et la réception valide chaque champ lu au lieu d'épingler (fiche `user-doctrine-orchestrateur-de-sessions-max5`). Deux réfutations de la même classe de trou : remonte au design fermé au lieu de boucher le trou suivant. #2180 #2222 `familleLeanCtx` et `LEAN_CTX_VERSION` (`scripts/guards/lib/contratGarde.mjs`, `scripts/hooks/canal-outil-guard.test.mjs`) `scripts/ops/session-codex.mjs`
- **Conteneur cloud** : `node_modules` d'un worktree se pose par `cp -al` depuis un arbre au même `package-lock.json`, jamais par lien symbolique ; worktree par `git -c core.hooksPath=/dev/null worktree add`. Le proxy refuse `gh api --paginate` : paginer par `&page=N`.
- Corriger une branche poussée pendant que le worktree sert à une autre, sans checkout : index temporaire (`GIT_INDEX_FILE`), `read-tree` de la branche, `hash-object -w` et `update-index --cacheinfo` par fichier, `write-tree`, `commit-tree -p <tête>`, `update-ref`. La plomberie ne lance aucun hook : passe le message par `node scripts/git-hooks/commit-msg.mjs <copie>` avant `commit-tree`. #3305
