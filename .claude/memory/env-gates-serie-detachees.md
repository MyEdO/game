---
name: env-gates-serie-detachees
description: "Gates et suite complète ne se lancent JAMAIS depuis le harnais : la CI de la branche les joue ; le train détaché `npm run ops:publier -- --detache` se suit par la commande `veille=` qu'il imprime, l'arbre reste GELÉ jusqu'à PUBLICATION:"
metadata:
  node_type: memory
  type: project
---

**Règle :** gates et suite complète ne se lancent jamais depuis le harnais — son garde-mémoire tue l'enveloppe et `npm run gates` en LANES sature la RAM (rouges `3221225794`). La CI de la branche les joue.

**How to apply :** `npm run ops:publier -- --detache` imprime `pid=`, `log=`, `veille=` et rend la main. **Monitor** sur la commande `veille=` telle qu'imprimée (#2227) : une ligne par transition, puis `PUBLICATION:` ; codes de sortie dans `scripts/ops/publier.mjs`. Jamais un `tail`/`grep` du log.

**Arbre GELÉ pendant le run :** aucune édition ni commit dans ce worktree avant `PUBLICATION:` — un manuscrit sale fait refuser `derives` ou `docs`, un commit déplace la tête publiée.

**Veille sortie en arrêt moteur ou en borne dépassée** : `-- --etapes` lit le journal sans rien jouer, `-- --reprendre` repart de la première étape non verte ; sans `--reprendre`, lot neuf.
