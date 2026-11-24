---
name: user-arbitrage-roguelite-noyau-d-abord
description: "Le roguelite joue toute règle par le noyau ; un manque du noyau devient un ticket sous #4899, jamais une règle dans l'hôte"
metadata:
  type: user
---

**Verbatim (2026-11-23)** : « On doit utiliser le noyau, je veux t'éviter le maximum de chose "interne", car ça serait de la duplication. Au mieux tu mets ça dans les retours. Par contre tu peux tout à fait modifier l'interface pour marcher "à la 5ème", et envoyer ce que veut le noyau pour que cela fonctionne. »
**Verbatim (2026-11-23)** : « Je t'autorise à modifier le noyau mais en passant par le système normal attendu par le projet avec un ticket et les skills qui gèrent le traitement des tickets »

**Why :** une règle réécrite dans l'hôte duplique le noyau et diverge de lui ; le noyau reste la seule source des règles, partagée par tous les projets.
**How to apply :** un lot du roguelite n'écrit que sous `projets/roguelite/` et lit le noyau par sa porte ; une règle ou une couture qui manque au noyau s'ouvre en ticket sous-issue de #4899 (label `projet:noyau`) et se solde sur son propre `chantier/<N>` par le circuit normal (ticket, skills, juge, PR), avec les preuves du jeu. L'hôte ne fait qu'adapter la présentation (achats par pas de +5, envoyés au noyau en Augmentations) et envoyer au noyau ce qu'il attend.
