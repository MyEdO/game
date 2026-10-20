---
name: user-arbitrage-bourse-personnelle-trapping
description: "La monnaie est PERSONNELLE et portée par la bourse-trapping du héros ; les gestes de groupe restent des allocations"
metadata:
  node_type: memory
  type: user
---

Verbatim utilisateur (2026-09-06) : « Non laisse comme ca, tant que la bourse est personnelle, le faite de redistribuer l’argent automatiquement ca me va. »

**Why:** le RAW compte la monnaie dans l’Encombrement INDIVIDUEL et le jeu ne connaît pas d’inventaire de groupe — une bourse commune contredirait les deux.

**How to apply:** la monnaie vit par héros, dans une `ItemInstance` du trapping `bourse` (champ `money`) ; toute somme entrée ou sortie est une allocation par les primitives de `src/noyau/bourseFlow.ts`, jamais une écriture directe ; toute surface « Bourse » de groupe est dérivée.
