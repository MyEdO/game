---
name: env-foundry-jet-sans-modale
description: "wfrp4e — mesurer un jet au navigateur : skipDialog, evaluateSync refusé, et les écritures non attendues de updateChannelledItems"
metadata: 
  node_type: memory
  type: reference
  originSessionId: ac141400-e348-4fc8-af3c-169f74f555f3
  modified: 2026-09-16T21:14:55.247Z
---

Pièges du moteur de jets wfrp4e éprouvé depuis Playwright :

1. **`skipDialog` dans le CONTEXTE** — `await actor.setupChannell(sort, { skipDialog: true, rollMode: "selfroll" })`. Sans lui, `awaitSubmit` attend un clic et `browser_evaluate` se fige. Le `bypass()` honore `computeFields` (chemin réel) ; `options.bypass` est mort.
2. **`Roll#evaluateSync()` refusé** : tout dé de plus se lance dans une méthode asynchrone déjà attendue. `_handleMiscasts` (l.11147) n'est pas attendue : la rendre async écrit après son lecteur.
3. **`updateChannelledItems` (l.11404) écrit sans `await`** : une seconde écriture de la réserve se perd. Replier toute correction sur son unique delta, dans la méthode.
4. **`computeResult` (l.11341) décore déjà** `minormis`/`majormis` avec `miscastModifier` : poser le modificateur avant, sinon « (+30) (+30) ».

**How to apply:** acteur réel, `test.preData.roll = N` entre `setup*` et `test.roll()`, puis restauration intégrale et suppression des messages créés. Prouver un patch par deux mesures au même dé forcé, origine puis patch. Voir [[env-foundry-champ-multi-surfaces]], [[feedback-5e-regle-absente-ecartee]].
