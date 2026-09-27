---
name: feedback-granularite-table
description: "Une règle RAW s'implémente à la granularité de la TABLE (l'unité de sa phrase), jamais à celle du moteur — pas d'arbitrage maison pour rustiner un artefact de notre décomposition."
metadata:
  type: feedback
---

Verbatim utilisateur : « Moi ce que je veux, c'est du RAW. La tu m'as donné une réponse "Moteur" qui a amené a un arbitrage qui n'aurait jamais du existait ». Quand la phrase du livre a son unité d'événement (un déplacement, un Round, une rencontre, une nuit), le moteur AGRÈGE jusqu'à cette unité avant d'évaluer le prédicat.

**Why:** évaluer au grain fin (segments, ticks) puis rustiner la cadence par un garde « maison » fabrique un arbitrage que le RAW n'appelait pas ; la règle 7 ne se déclenche que sur un vrai silence du livre.

**How to apply:** avant de taguer « maison » une cadence, demander « le livre a-t-il déjà une unité d'événement ? » ; un garde anti-spam keyé (`lastXKey`) est le symptôme de l'agrégation manquante.
