---
name: user-arbitrage-tests-sur-scenes-dediees-jamais-sur-scenes-utilisees
description: "Un test se joue sur une scène créée POUR LUI, jamais sur une scène utilisée (campagne, Arène)"
metadata:
  type: user
---

**Verbatim (2026-09-07)** : « Franchement si on veut faire de test, faites les sur des scenes créé spécialement pour ces tests, pas sur des scénes qui sont utilisés ... »

**Why :** une scène de campagne est de la donnée éditable par l'auteur ; un test qui assert son contenu la fige, et son rouge n'attribue aucun défaut au moteur.
**How to apply :** un test qui a besoin d'une scène la CONSTRUIT (authoring ASCII `src/noyau/monde/asciiMap.ts`, ou un scénario sous `src/scenes/test-scenarios/`) ; sur les scènes livrées, seules les gardes GÉNÉRIQUES sont licites (parse du schéma, invariants structurels joués sur toutes les scènes), jamais une assertion qui nomme une scène et son contenu.
