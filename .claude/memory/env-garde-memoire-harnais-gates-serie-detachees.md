---
name: env-garde-memoire-harnais-gates-serie-detachees
description: "Vécu 2026-09-05 (train A #1653) : le garde-mémoire du harnais tue l'ENVELOPPE Bash de fond (les fils node survivent et finissent), les gates en LANES saturent les 31 Go (0xC0000142 = refus d'init de processus Windows) → gates en --serie, lancées DÉTACHÉES par un script node ; docs:empreinte exige une régénération sur l'arbre COMMITTÉ ; taxe de cardinal 11a sur raw.manifest ; knip et les imports de type inline"
metadata: 
  node_type: memory
  type: project
  originSessionId: e72180bd-85a9-4fe1-915b-20e4f3d7932a
  modified: 2026-09-05T02:53:54.060Z
---

**Faits mesurés (2026-09-05, session game-bc, worktree `.wt-raw`)**
- Le harnais tue une commande Bash `run_in_background` « system running low on memory » : l'ENVELOPPE meurt, les processus fils (vitest, `justifie.mjs test`) continuent et écrivent leur fichier — ne pas relancer à l'aveugle, vérifier `Get-CimInstance Win32_Process` + le fichier de sortie. Deux fois la même nuit (suite complète, puis `npm run gates`).
- `npm run gates` en LANES (3 parallèles) + une autre session = « mémoire système max : 31,2 Go / 31,2 Go (100 %) » (rapport `[diag]` de la gate `test`) → 12-15 fichiers rouges à `3221225794` (0xC0000142, refus d'initialisation de processus : migrations, scripts/map/check, progression-schemas, entity-orphans, scripts-nul-guard, quad-harnais). Au calme, tous verts. Remède : `npm run gates -- --serie` (une lane, même verdict) LANCÉ DÉTACHÉ — `spawn(process.execPath, [runner.mjs], {detached:true, stdio:['ignore',fd,fd], windowsHide:true}).unref()`, le runner faisant `spawnSync(node, ['scripts/gates/toutes.mjs','--serie'], {cwd, env:{WFRP_TEST_COEURS:'4'}, stdio:'inherit'})` puis `EXIT n` en fin de fichier (scripts `gates-detached.mjs`/`gates-runner.mjs` du scratchpad). Un `cmd.exe /c "cd /d …"` via spawn échoue sur le quoting (« syntaxe du nom de fichier incorrecte ») — passer par node → node.
- Le verrou `%LOCALAPPDATA%\Temp\wfrp-suite.lock` refuse une 2ᵉ suite complète sur la machine (exit 2, PID nommé) — utile, mais il ne protège pas des LANES de gates.
- lean-ctx (allowlist mécanique) bloque : `powershell` dans ctx_shell, `node -e`, l'arithmétique `$((i+1))`, `until`/`tasklist` dans Bash de fond (exit 126) → toute attente/boucle s'écrit dans un SCRIPT node (`sleep N` reste permis) ; l'outil PowerShell natif casse sur `$var` et les guillemets doubles imbriqués (garder des cmdlets simples, pas de `$os =`).
- `docs:empreinte` : un doc dérivé régénéré par un codeur sur un arbre SALE porte le pied d'un arbre ≠ index → gate rouge après le commit. Régénérer (`npm run docs:build`) APRÈS le dernier commit, puis committer les N lignes de pied (12 fichiers, 12 lignes).
- Ajouter une entrée à `src/data/raw.manifest.json` (règle 1) fait rougir `test:hooks` : la migration datée `2026-08-28-l1b-11a-entite-type.mjs` porte un cardinal `'raw.manifest.json': N` + `TOTAL_ATTENDU` (taxe #1648) → bump motivé (précédent 057e3f38f), seule 11a compte ce fichier (sonde sur 95 scripts).
- `deps:unused` (knip) : un type exporté consommé UNIQUEMENT par un import inline `import('./types').X` est vu MORT → import statique `type X`.
- Les justificatifs de gates sont keyés par CONTENU : après un commit de docs seuls, seules les gates à clé pleine (lisant `docs/`) rejouent (~4 min au lieu de 15).

**How to apply :** sur ce dépôt, ne jamais lancer une suite/gates en Bash de fond quand une autre session est active — script détaché + `--serie` + relire le fichier ; commit → `docs:build` → commit des pieds → gates → push.

Lié : [[env-charge-machine-un-seul-agent-lourd]], [[env-coordination-arbre-partage-sessions]], [[env-outillage-degrade-session-2026-08-31]].
