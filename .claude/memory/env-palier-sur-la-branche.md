---
name: env-palier-sur-la-branche
description: "Fusionner origin/main dans un chantier : `git merge --no-commit`, commit SANS trailers (apport propre jugé), résolution substantielle jugée à la PUBLICATION en nommant son sha (gate livraison:plage)"
metadata: 
  node_type: memory
  type: project
  originSessionId: a0dfb696-da2e-4137-ae4b-32ad3e05ed77
  modified: 2026-10-05T16:00:00.000Z
---

Fusionner origin/main dans un chantier est un geste de CONSERVATION ; sa livraison se juge à la publication (#2328).

**Why :** les gardes de commit ne jugent que l'APPORT PROPRE d'une fusion (fusion automatique → index), jamais ce que main apporte.

**How to apply :**
- `git fetch`, puis `git merge --no-commit origin/main` — jamais un rebase (#2178). Des fichiers STAGÉS bloquent : `git restore --staged` d'abord.
- La fusion résolue se commite SANS trailers de livraison.
- Sous `--no-commit`, `post-merge` ne tourne pas : `node scripts/git-hooks/docs-rebuild.mjs post-merge`, puis typecheck + périmètre.
- Une résolution d'au moins `SUBSTANTIVE_MIN_LINES` insertions sous `src/` se juge AVANT la publication : un commit postérieur dont `JUGE:` et `REFUTATION:` (et `JUGE-VISION:` si un écran en reçoit) nomment son sha. En local, `git fetch origin` puis `npm run livraison:plage`. Voir [[env-cloture-de-commit]].
