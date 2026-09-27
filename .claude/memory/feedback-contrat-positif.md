---
name: feedback-contrat-positif
description: "Un test porte le CONTRAT : jamais l'absence d'un élément retiré (pierre tombale), jamais la mécanique d'avant une refonte"
metadata:
  node_type: memory
  type: feedback
---

Un test verrouille le CONTRAT, jamais une implémentation. Deux formes interdites : l'assertion qui
commémore une suppression (`not.toContain('<classe retirée>')` — règle 6c en exécutable) et le test
qui verrouille l'ancienne MÉCANIQUE après refonte. Un rouge post-refonte s'ATTRIBUE d'abord :
contrat (RAW, invariant du ticket, design jugé) → il se respecte ; ancienne mécanique → il se RÉÉCRIT
depuis le nouveau contrat. Jamais adapter le flux aux tests, jamais un hack (skip, mock, timeout).

**Why:** utilisateur (2026-08-23, verbatim) : « dès qu'on fait une refonte, on a les tests qui nous
pousse a revenir a l'ancien comportement ou faire des hacks » — et un test-tombale casse pour rien
quand un design légitime réoccupe la place.

**How to apply:** l'absence-RÈGLE reste légitime quand elle est un invariant PERMANENT de classe
(« aucune réf livre hors Codex ») ; un arbitrage se verrouille par un contrat structurel POSITIF
(« l'aside contient EXACTEMENT : … ») ; le pilotage d'un mécanisme transverse vit dans UN helper de
test partagé, jamais recopié dans N tests.
