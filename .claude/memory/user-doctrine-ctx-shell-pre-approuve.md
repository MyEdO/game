---
name: user-doctrine-ctx-shell-pre-approuve
description: "`mcp__lean-ctx__ctx_shell` reste pré-approuvé (`permissions.allow`) : un agent de fond ne peut pas répondre à une demande d'autorisation ; une commande sous `permissions.ask` part par Bash seul"
metadata:
  type: user
---

**Verbatim (2026-09-28)** : « Autoriser ctx_shell (Recommandé) »

**Why :** un agent de fond ne répond à aucune demande d'autorisation : un shell qui en exige une le fige.
**How to apply :** `mcp__lean-ctx__ctx_shell` reste dans `permissions.allow` de `.claude/settings.json`. Une commande qu'un motif `Bash(…)` de `permissions.ask` soumet à confirmation (déploiement) est refusée hors Bash et renvoyée à Bash par `scripts/hooks/confirmation-hors-bash-guard.mjs` (#2721). Sans lean-ctx : Bash, une commande simple, chemins absolus.
