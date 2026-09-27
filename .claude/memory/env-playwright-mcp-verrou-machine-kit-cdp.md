---
name: env-playwright-mcp-verrou-machine-kit-cdp
description: "Le navigateur Playwright MCP est un verrou MACHINE (un profil Chrome pour toutes les sessions) — une recette bloquée « Browser is already in use » se joue par le kit CDP du dépôt (scripts/recette/lib.mjs), jamais en attendant"
metadata:
  type: feedback
---

Le serveur Playwright MCP (`mcp__plugin_playwright_playwright__*`) ouvre UN profil Chrome par machine
(`%LOCALAPPDATA%/ms-playwright-mcp/mcp-chrome-<hash>`), pas un par session ni par worktree : deux
sessions parallèles se bloquent (`Error: Browser is already in use … use --isolated`), sans file
d'attente ni fin prévisible, et le `--isolated` du message n'est pas actionnable depuis un agent.

**Why:** plusieurs sessions Claude tournent en même temps sur ce dépôt
([[env-coordination-sessions]]) et chacune peut tenir le navigateur une heure.

**How to apply:** dès le premier `already in use`, ni réessai ni attente : jouer la recette par le kit
CDP canonique — `openApp(url)` / `evaluate` / `shot` / `consoleGuard` de `scripts/recette/lib.mjs`
(Chromium PROPRE, port du worktree, `__wfrp` pour le setup et l'observation), patron
`scripts/qc/capture-jeu.mjs`, dans un script jetable au scratchpad. Le navigateur intégré
(`mcp__Claude_Browser__*`) sert à REGARDER mais n'écrit aucun PNG : une capture versionnée sous
`public/qc/soldes/` vient du kit CDP. Un brief de recetteur nomme ce repli AVANT le dispatch.
