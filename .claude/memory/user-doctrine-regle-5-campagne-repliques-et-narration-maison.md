---
name: user-doctrine-regle-5-campagne-repliques-et-narration-maison
description: "Dans un paquet de campagne, une réplique de PNJ absente du livre s'authore maison, et une description destinée au MJ se reformule en texte lu à l'écran même quand le livre la porte ; le verbatim ne tient plus que pour les documents et les règles ; tout texte maison passe devant un juge esprit"
metadata:
  type: user
---

Arbitrage 1 du pilotage https://github.com/cgauche/game/issues/665#issuecomment-5849927764.
*Question posée (AskUserQuestion, non-verbatim utilisateur) : répliques des PNJ — la règle 5 exige le verbatim, mais le livre donne surtout des motivations pour le MJ. Quelle politique ?*

**Verbatim —** option retenue (2026-09-26) : « **Narration reformulée aussi** » : « Comme la réplique maison, et les descriptions destinées au MJ peuvent en plus être reformulées en texte lu à l'écran. La règle 5 ne tiendrait plus que pour les documents et les règles. »
*Réplique maison, option à laquelle elle renvoie (non-verbatim utilisateur) : verbatim d'abord ; sinon donnée éditable taguée maison, avec la réf du passage source, jugée par un juge esprit.*

**Why :** sans MJ, ce que le livre confie au MJ doit être dit à l'écran.
**How to apply :**
- Une réplique absente du livre s'authore maison ; une narration destinée au MJ peut se reformuler en texte lu à l'écran, même portée par le livre, sans `source`.
- Prose `narratif` SANS `source` = maison ; AVEC, chaque paragraphe est copié à l'octet (`proseSourcees`, `src/scenes/bundled-projects.test.ts`).
- Tout texte maison passe un juge esprit (skill `adapter-une-campagne`). La prose de `src/data` n'est pas concernée.
- Réf du passage d'un texte maison : `adapteDe`, exclusif de `source` et `descRef` (`grammaire/prose.ts`).
