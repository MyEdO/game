---
name: game-ctx-search-skips-large-files-use-grep
description: "ctx_search rend un « 0 match » FAUX sur les fichiers >512 Ko ET avec un `include` multi-glob (scanned 0) ; preuve d'absence = git grep / grep natif"
metadata: 
  node_type: memory
  type: reference
  originSessionId: a0dfb696-da2e-4137-ae4b-32ad3e05ed77
  modified: 2026-09-17T21:45:23.991Z
---

**Why:** `ctx_search` écrit « (N files >512KB skipped) » en marge mais rend « 0 match » dans son résultat — un faux zéro devient un brief faux (doublons créés, section d'Atlas « manquante » qui existait deux fois).

Second faux zéro (2026-09-17) : `ctx_search(pattern, path=<worktree>/src, include="*.test.ts,*.test.tsx")` a rendu « 0 matches in 0 files » — le filtre `include` à plusieurs globs n'a scanné AUCUN fichier — et ce zéro est entré tel quel dans un brief (« 0 après réécriture ») alors que `git grep -n -E … -- "src/**/*.test.ts"` en rend 23 dans 12 fichiers. Un résultat « scanned 0 » ou « in 0 files » est une NON-MESURE, jamais une absence.

**How to apply:** au-dessus du seuil (`src/data/creatures.json` = 1 339 155 o ; fiches `docs/raw/` et `Source/` souvent au-dessus — vérifier par `(Get-Item <chemin>).Length`), toute preuve d'existence ou d'absence se fait en `grep -n` natif ou `node -e` (JSON.parse + filter). Un brief qui envoie un agent sonder `src/data/`, `docs/raw/` ou `Source/` porte l'avertissement et impose l'outil ; une absence rapportée par un agent n'entre dans un brief aval qu'avec l'outil de sonde nommé.
