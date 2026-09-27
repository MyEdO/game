---
name: env-cliquet-porteur
description: "Toute entrée ajoutée à un PORTEUR de stock (baseline JSON, *Stock.mjs, scripts/hooks/*.json) exige sa ligne CLIQUET au message AVANT le commit — le pre-commit laisse passer, test:hooks sur la plage poussée rougit et fait sauter toutes les gates suivantes"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c95432bf-a32b-458a-8974-aa68a2923b3c
  modified: 2026-09-14T19:55:23.303Z
---

Une entrée de plus dans un porteur de stock nominatif (`scripts/guards/lib/*Stock.mjs`,
`decisions-baseline.json`, `scripts/hooks/*.json`, `scripts/raw/*-stock.json`…) est une CROISSANCE
que `croissanceDesStocks` (`scripts/guards/lib/stocksNominatifs.mjs`) exige déclarée par
`CLIQUET: <fichier> +N — <motif>` au message du commit qui la porte.

**Why:** le pre-commit ne juge pas la plage ; c'est `test:hooks` sur la plage poussée qui rougit et
fait sauter les gates suivantes, et un message enfoui sous d'autres commits ne se répare qu'en
reconstruisant la pile.

**How to apply:** avant tout commit, `git diff --cached --stat` sur les porteurs ; chaque porteur qui
grandit reçoit sa ligne `CLIQUET:` (motif ≥ 20 caractères). Le PLAFOND vit souvent dans un `.test.ts`
de contrat (`structures-contrat`, `slots-contrat`, `registry-enveloppe`…) que la plage ne voit pas :
une ligne par FICHIER dont un cran bouge. Un plafond ne se relève que si le réel le DÉPASSE. Un
message ne cite jamais le SHA d'un commit non publié (le rebase le réécrit). Voir
[[env-gates-serie-detachees]].
