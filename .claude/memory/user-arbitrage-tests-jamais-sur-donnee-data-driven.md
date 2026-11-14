---
name: user-arbitrage-tests-jamais-sur-donnee-data-driven
description: "Un test ne dépend jamais d'une donnée data-driven (src/data/*.json, prétirés compris) : il déclare ses fixtures"
metadata:
  type: user
---

**Verbatim (2026-11-10)** : « Les tests ne doivent jamais dépendre d'une donnée en data-driven »

Dit au chantier #3884 (prétirés officiels à fiche figée), quand ~170 tests prenaient un prétiré de `src/data/pregens.json` comme fixture de porteur.

**Why :** une entrée de `src/data/*.json` est éditable au Compendium ; un test qui la lit fige sa valeur, et son rouge n'attribue aucun défaut au moteur. Même raison que `user-arbitrage-tests-sur-scenes-dediees-jamais-sur-scenes-utilisees`, étendue à toute la donnée.
**How to apply :** un test DÉCLARE ses porteurs et ses entrées : `combattantDeTest` (`src/engine/combattantDeTest.testkit.ts`), une `FicheDeHeros` littérale passée à `heroDeFiche`, une entrée de fixture posée par le seam du registre lu à l'appel. Jamais `pretire(...)`, jamais une assertion qui nomme une entrée réelle et son contenu. Sur un dataset livré, seules les gardes GÉNÉRIQUES sont licites (parse du schéma, références résolues, invariants joués sur toutes les entrées) ; la fidélité d'une transcription au livre se prouve par une sonde au rendu, pas par un test committé.
