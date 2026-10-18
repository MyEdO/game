# Outils et machine

Time matters here: do not spend time that can be avoided, and the earlier a correct result is obtained, the better.

- Un code de sortie ne se lit jamais à travers un pipe ; status 1 sans assertion en échec = erreur de collecte.
- **Canal par geste** : lire → `Read` ou `ctx_read` ; chercher → `git grep` (fait foi) ou `ctx_search` ; éditer → `Edit`/`Write` ou `ctx_patch` ; commande → `Bash`, seul couvert par `permissions.ask`. Un outil lean-ctx absent de la session ne se cherche pas : le canal natif vaut.
- Appels longs et tâches de fond : `.claude/sous-agents.md`, injecté à tout sous-agent à canal shell ; sa règle « Rien ne te survit » vaut aussi pour la session principale.
- **Git Bash** : `\\` arrive en `\`, même entre apostrophes ou en heredoc cité : écris le texte par Write au scratchpad et lance-le par son chemin, ou passe par PowerShell (#2603). MSYS réécrit `<rév>:<chemin>` : `MSYS_NO_PATHCONV=1`, ou `git ls-tree <rév> -- <f>`.
- **`grep`** : seul, le hook RTK le réécrit en `rtk grep` ; composé, l'alias lean-ctx `lean_ctx_track` rend un FAUX ZÉRO. Motif à `\`, `[` ou `"` : `git grep`, `/usr/bin/grep` ou `\grep` ; sur fichiers, finis par `< /dev/null`.
- **PowerShell** : aucune cmdlet d'écriture (`Set-Content`, `Out-File`, `Add-Content`) sur un fichier du dépôt (CRLF, `.gitattributes:5`). Suite rouge sans diff : `git ls-files --eol`.
- **lean-ctx** : `ctx_search` saute les fichiers > 512 Ko (`src/data/creatures.json`, `src/data/spells.json`, `docs/raw/4e/combat.md`) et se coupe au budget de temps : un « 0 match » ne prouve aucune absence, `git grep` si. Un faux « unchanged » de `read-dedup` se relit par `ctx_read(mode=raw, fresh=true)`. Relis au fichier un `ctx_patch` dont dépend une preuve ; un relevé critique passe par un script, pas par `ctx_read`. Après un `[BLOCKED]` à effet, vérifie la cible.
- `Measure-Object -Line` ignore les lignes vides ; `typecheck:fast` partage son tsbuildinfo : pousse, la CI tranche.
- **Réglages** : lean-ctx réécrit `~/.claude/settings.json` ; un réglage perso va dans `~/.claude/fix-leanctx-settings.mjs`, jamais à la main ni par `rtk init -g`. Read ou Edit cassés, agent à zéro outil : lance-le d'abord.
- **Veille** : durée aberrante, agents figés : lis Kernel-Power 506/507 du jour (`Get-WinEvent`, System), relance la commande coupée (`npm run ops:publier -- --reprendre`), préviens les sessions ; toute durée chiffrée la déduit.
- **Session bloquée sur un modal** : son `claude.exe` (sans `--bg-pty-host`), `AttachConsole` + `ReadConsoleOutputCharacterW` sur `CONOUT$`, touche par `WriteConsoleInput` sur `CONIN$` (outil PowerShell). Montre le modal à l'utilisateur ; `taskkill` en dernier recours.
- Un message de commit ne cite jamais le sha d'un commit non publié.
- Après un `cd` ou un retrait de worktree, vérifie `git worktree list`.
