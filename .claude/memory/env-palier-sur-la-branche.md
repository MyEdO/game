---
name: env-palier-sur-la-branche
description: "Fusionner origin/main dans un chantier : `git merge --no-commit` ; une résolution substantielle se juge à la PUBLICATION (gate livraison:plage) par `JUGE:`/`REFUTATION:` dans le message de la fusion, ou un descendant qui nomme son sha"
metadata: 
  node_type: memory
  type: project
  originSessionId: a0dfb696-da2e-4137-ae4b-32ad3e05ed77
  modified: 2026-10-06T12:00:00.000Z
---

Fusionner origin/main dans un chantier est un geste de CONSERVATION ; sa livraison se juge à la publication (#2328).

**Why :** les gardes de commit ne jugent que l'APPORT PROPRE d'une fusion (fusion automatique → index), jamais ce que main apporte.

**How to apply :**
- `git fetch`, puis `git merge --no-commit origin/main` — jamais un rebase (#2178). Des fichiers STAGÉS bloquent : `git restore --staged` d'abord.
- Une fusion propre, ou à résolution non substantielle, se commite SANS trailers de livraison.
- Sous `--no-commit`, `post-merge` ne tourne pas : `node scripts/git-hooks/docs-rebuild.mjs post-merge`, puis typecheck + périmètre.
- Une résolution qui change au moins `SUBSTANTIVE_MIN_LINES` lignes sous `src/` (contre la fusion automatique, marqueurs exclus) se juge avant la publication : le message de la fusion porte `JUGE:` et `REFUTATION:` (`JUGE-VISION:` si un écran change), sans sha ; sinon un commit DESCENDANT, ou le solde `.claude/soldes/ref-<N>.md` d'un ticket cité, les porte en NOMMANT son sha. En local : `git fetch origin` puis `npm run livraison:plage`. Voir [[env-cloture-de-commit]].
