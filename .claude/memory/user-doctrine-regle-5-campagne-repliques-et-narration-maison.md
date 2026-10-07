---
name: user-doctrine-regle-5-campagne-repliques-et-narration-maison
description: "Dans un paquet de campagne, une réplique de PNJ absente du livre s'authore maison, et une description destinée au MJ se reformule en texte lu à l'écran même quand le livre la porte ; le verbatim ne tient plus que pour les documents et les règles ; tout texte maison passe devant un juge esprit"
metadata:
  type: user
---

Arbitrage : https://github.com/cgauche/game/issues/665#issuecomment-5849927764.
Question : répliques à partir des motivations du MJ.

**Verbatim —** option retenue (2026-09-26) : « **Narration reformulée aussi** » : « Comme la réplique maison, et les descriptions destinées au MJ peuvent en plus être reformulées en texte lu à l'écran. La règle 5 ne tiendrait plus que pour les documents et les règles. »
Option « Réplique maison » (non-verbatim) : verbatim d'abord ; sinon texte éditable maison, référencé et jugé. Sans MJ, sa narration se lit à l'écran.

- `proseNommee`/`PROSES_NOMMEES` : ouverture, stade, document, terrain. Provenance locale : `source` = copie par folio, `adapteDe` = adaptation, aucune = Maison. Document : `source` seule. `adapteDe` exclut `source` et `descRef`.
- La source racine est documentaire ; elle ne porte ni n'alimente la prose. Une frontière locale coupe l'héritage, même Maison ; preset→profil subsiste, adapté coupe.
- Copies à l'octet : `proseSourcees` (`src/scenes/bundled-projects.test.ts`). Maison : juge esprit (`adapter-une-campagne`). La prose de `src/data` reste hors arbitrage.
