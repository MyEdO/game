---
name: env-reword-non-interactif-exec-amend
description: "Porter une ligne CLIQUET oubliée sur un commit de chantier déjà fait — `reword` scripté est muet (GIT_EDITOR de l'env gagne), passer par `exec` + `git commit --amend -F`"
metadata:
  node_type: memory
  type: reference
  originSessionId: a0dfb696-da2e-4137-ae4b-32ad3e05ed77
  modified: 2026-09-23T22:49:04.044Z
---

Le pre-push refuse un STOCK NOMINATIF qui grandit sans `CLIQUET: <fichier> +N — motif` au commit fautif, fichier NEUF compris. Seul le `push-branche` de `ops:publier` le voit, et son journal tronque la cause : rejouer `git push --force-with-lease origin HEAD:refs/heads/chantier/<N>` pour la lire.

Correction sur la branche de chantier (jamais sur main) :
- `reword` scripté via `core.editor` ne change PAS le message (la `GIT_EDITOR` de l'environnement gagne) et le rebase réussit en silence.
- Ce qui marche : un `sequence.editor` node qui insère `exec node amend.mjs` après chaque `pick` visé ; `amend.mjs` lit `git log -1 --format=%B`, insère la ligne avant `JUGE:`, puis `git commit --amend -F <fichier>`.
- Vérifier que `git diff --stat <ancienne tête> <nouvelle tête>` est vide.
- Passer la config par `git -c` : lean-ctx découpe mal `$env:X=` en PowerShell.

Mieux : poser `CLIQUET` au commit, après un `git diff --stat` des stocks (`scripts/gates/*`, gardes `*-guard.test.ts` à exemptions). Voir [[env-cliquet-porteur-avant-commit-pre-commit-aveugle]].
