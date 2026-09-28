---
name: env-code-de-sortie-hors-pipe
description: "Un verdict se lit au code de sortie HORS pipe, jamais à une ligne « PASS » ; une absence se recoupe par un outil d'une autre famille (ctx_search rend des faux « 0 match »)"
metadata:
  node_type: memory
  type: reference
---

**Why:** un pipe mange le code de sortie (`tail … && git push` sort 0 sur un rouge), et un outil de recherche peut conclure « n'existe pas » à tort : le 2026-09-23, `ctx_search` a rendu « 0 match » sur `rtk` (arrêt au budget de temps, 7 gros fichiers sautés) quand `git grep` en trouvait des dizaines. Le même jour, re-mesuré sous rtk 0.49 par le pont Bash : vitest rouge → `FAIL (1)` exit 1, tsc à 2 erreurs → 2 erreurs exit 1, `git show | wc -l` exact — les faux verts attribués autrefois au pont rtk ne se reproduisent plus.

**How to apply:** toute mesure de gate = code de sortie lu hors pipe (`spawnSync(...).status`, ou `cmd; echo "EXIT=$?"`), et un fichier de sonde vide ne vaut qu'avec son code de sortie collé à côté ; un `status = 1` avec ZÉRO assertion en échec est une erreur de COLLECTE, pas un test fantôme ; toute affirmation d'absence se recoupe par un outil d'une autre famille ; la mesure finale d'un lot se refait sur arbre gelé.
