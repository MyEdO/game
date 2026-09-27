---
name: env-cloture-de-commit
description: "Clôturer un lot : ordre strict code → docs:build → captures → git add → git commit (commande SÉPARÉE du add, le hook solde-ticket-guard juge l'index AVANT exécution)"
metadata: 
  node_type: memory
  type: feedback
---

Deux gardes du pré-commit lisent des horodatages/empreintes : toute `capture:` du solde doit être plus
récente que le dernier `.tsx`/`.css` d'écran stagé, et `docs/.sources-lues.json` doit correspondre à
l'arbre pour CHAQUE générateur (`build-all --only x` désaligne les autres). Et
`scripts/hooks/solde-ticket-guard.mjs` est un hook PreToolUse, pas un hook git : il juge l'index au
moment où la commande est SOUMISE ; son deny annule TOUTE la commande, donc un
`git add X && git commit` est refusé sur l'index d'avant le add, et l'index reste vide ensuite.

**Why:** une retouche après captures ou `docs:build` invalide une preuve ; un deny de hook ressemble à
une erreur git et l'index vide fait croire à une perte.

**How to apply:** (1) tout le code, juge et commentaires compris ; (2) `npm run docs:build` complet ;
(3) rejeu des captures sur l'arbre définitif (scripts rejouables au scratchpad) ; (4) `git add` par
chemins, solde compris, puis `git diff --cached --name-only` ; (5) `git commit -F` dans une commande
SUIVANTE. Refus pour du code → repartir de (1). Voir [[env-cliquet-porteur]]
et [[env-commit-f-fichier]].
