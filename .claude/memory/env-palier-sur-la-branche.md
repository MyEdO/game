---
name: env-palier-sur-la-branche
description: "Le garde de palier compte les commits depuis la dernière revue VISIBLE DANS L'HISTORIQUE DE LA BRANCHE — une revue archivée par un autre chantier n'est vue qu'après FUSION d'origin/main ; fusionner origin/main dans le chantier AVANT le commit de clôture"
metadata: 
  node_type: memory
  type: project
  originSessionId: a0dfb696-da2e-4137-ae4b-32ad3e05ed77
  modified: 2026-09-18T07:00:33.363Z
---

Le palier de `scripts/hooks/solde-ticket-guard.mjs` compte les commits de substance depuis la dernière `revue-palier-*.md` de `.claude/soldes/` sur l'ARBRE COURANT. Une revue publiée sur `origin/main` après la création de la branche reste invisible sans fusion d'`origin/main` : le garde nomme une fenêtre périmée et un compte gonflé.

**Why :** `ops:faits-de-palier` refuse de même une base qui n'enchaîne pas la dernière revue visible.

**How to apply :**
- Avant la clôture : `git fetch`, puis `git merge --no-commit origin/main` (jamais un rebase, #2178 ; `--no-commit` pour que la porte voie le commit, #2071). Des fichiers STAGÉS bloquent : `git restore --staged` d'abord.
- La fusion résolue se commite SANS trailers de livraison : les gardes ne jugent que son apport propre (#2328).
- Sous `--no-commit`, `post-merge` ne tourne pas : régénérer par `node scripts/git-hooks/docs-rebuild.mjs post-merge` ; l'étape `docs` d'`ops:publier` commet les dérivés.
- Puis typecheck + périmètre, et la revue sur la fenêtre enchaînée (`--base <tête de la dernière revue> --tete HEAD`). Voir [[env-revue-palier-tete-publiee-jamais-locale]], [[env-cloture-de-commit]].
