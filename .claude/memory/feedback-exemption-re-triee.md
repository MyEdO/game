---
name: feedback-exemption-re-triee
description: "Une exemption de garde est un jugement daté contre un périmètre daté — elle se re-trie dès qu'une directive déplace l'invariant"
metadata:
  node_type: memory
  type: feedback
---

Verbatim utilisateur (2026-08-20) : « malgres cette migration […] tu as trouvé un moyen de ne pas la finir ».
**Règle :** toute directive qui redéfinit un invariant (qui contrôle quoi, qui possède quoi, ce qui compte comme X) inventorie et RE-JUGE, dans le MÊME lot, les exemptions accordées sous l'ancien invariant.
**Why:** une whitelist comptée se voit et décroît ; une exemption STRUCTURELLE (reconnue par forme) ne laisse aucune liste à regarder — la garde reste verte et se lit « migration finie » alors que le stock exempté n'a jamais été migré.
**How to apply:** greper les exclusions de principe des scanners (ex. `isWorldDie`, `scripts/guards/lib/rollSeamExclusivity.mjs`) et les juger une à une contre le nouveau périmètre ; une exemption re-confirmée se re-date, une exemption caduque devient le stock du lot suivant.
