---
name: env-cloture-de-commit
description: "Clôturer un lot : ordre strict code → docs:build → captures → git add → git commit ; la porte du commit (hook git commit-msg) juge l'index et le message que git enregistre"
metadata: 
  node_type: memory
  type: feedback
---

La porte du commit lit un horodatage : toute `capture:` du solde doit être plus récente que le dernier
`.tsx`/`.css` d'écran stagé (`mtimeMaxDe`). Elle ne lit pas `docs/.sources-lues.json` (dérivé local,
`scripts/docs/build-all.mjs:85`) : les post-hooks le lisent pour choisir les docs à régénérer
(`touchesDocSources`, `scripts/git-hooks/docs-rebuild.mjs:95`). La porte
(`scripts/git-hooks/porte-du-commit.mjs`) tourne dans le hook git `commit-msg` : elle juge l'index que
git emporte et le message final, quelle que soit la forme de la commande (`-m`, `-F`, `-a`, pathspec,
`git add X && git commit` compris) ; son refus annule le commit, l'index reste tel quel.

**Why:** une retouche après captures ou `docs:build` invalide une preuve ; un refus de hook ressemble à
une erreur git.

**How to apply:** (1) tout le code, juge et commentaires compris ; (2) `npm run docs:build` complet ;
(3) rejeu des captures sur l'arbre définitif (scripts rejouables au scratchpad) ; (4) `git add` par
chemins, solde compris, puis `git diff --cached --name-only` ; (5) `git commit`. Refus pour du code →
repartir de (1). Voir [[env-cliquet-porteur]].
