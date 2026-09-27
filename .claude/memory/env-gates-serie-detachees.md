---
name: env-gates-serie-detachees
description: "Gates et suite complète ne se lancent JAMAIS depuis le harnais : le train détaché `npm run ops:publier -- --detache` les joue en --serie, on lit son log, l'arbre reste GELÉ jusqu'à PUBLICATION:"
metadata:
  node_type: memory
  type: project
---

**Règle :** gates et suite complète ne se lancent jamais depuis le harnais — son garde-mémoire tue l'enveloppe (« system running low on memory ») et `npm run gates` en LANES sature la RAM (rouges `3221225794`, qui n'attribuent rien). Un veilleur node écrit à la main tombe pareil.

**How to apply :** depuis le worktree du chantier, `npm run ops:publier -- --detache` : il se re-spawne détaché, imprime `pid=` et `log=`, rend la main, joue les gates en `--serie` sous `WFRP_TEST_COEURS=4` (aucune mesure comparable à la référence série). Veille par **Monitor** (`until grep -q "^PUBLICATION:" <log>; do sleep 20; done`) : la dernière ligne du log est `PUBLICATION: vert|rouge|indéterminée`.

**Arbre GELÉ pendant le run :** aucune édition ni commit dans ce worktree avant la ligne `PUBLICATION:` — la porte compare `git status` avant/après et REFUSE tout le run au moindre changement ; un correctif attend la fin du journal, se committe, puis on relance.

**Timeout du Monitor sans `PUBLICATION:`** = processus TUÉ, jamais « ça tourne encore » : `-- --etapes` lit l'état du journal sans rien jouer, `-- --reprendre` repart de la première étape non verte ; sans `--reprendre` le journal est NEUF : lot neuf, pas une reprise.
