---
name: env-gates-serie-detachees
description: "Gates et suite complète ne se lancent JAMAIS depuis le harnais : la CI de la branche les joue ; le train détaché `npm run ops:publier -- --detache` se suit par la commande `veille=` qu'il imprime, le train publie un SHA capturé dans un snapshot et laisse le WIP source évoluer"
metadata:
  node_type: memory
  type: project
---

**Règle :** gates et suite complète ne se lancent jamais depuis le harnais — son garde-mémoire tue l'enveloppe et `npm run gates` en LANES sature la RAM (rouges `3221225794`). La CI de la branche les joue.

**How to apply :** `npm run ops:publier -- --detache` imprime `pid=`, `log=`, `veille=` et rend la main. **Monitor** sur la commande composite `veille=` telle qu'imprimée (#2227) : `… --veiller <run>; … --veiller <run> --constat`. Une ligne `#<seq>` par transition, puis `PUBLICATION:` ; le constat rend le verdict (0/1/3/4/5). Monitor plafonné : ré-armer `… --veiller <run> --depuis <dernier #seq>; … --veiller <run> --constat`, sans ré-émission, borne depuis le lancement. Jamais un `tail`/`grep` du log.

**SHA capturé pendant le run :** le train publie un snapshot de la tête committée au lancement. WIP et nouveaux commits peuvent évoluer pendant le run ; le bail distant empêche d’écraser une tête plus récente. Utilisateur, 16 octobre 2026, #2626 : « publier une tête committée et verte sans que le WIP d'un codeur dans le même arbre bloque ».

**Veille sortie en arrêt moteur ou en borne dépassée** : `-- --etapes` lit le journal sans rien jouer, `-- --reprendre` repart de la première étape non verte ; sans `--reprendre`, lot neuf.
