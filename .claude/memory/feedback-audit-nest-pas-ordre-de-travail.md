---
name: feedback-audit-nest-pas-ordre-de-travail
description: "Un rapport d'audit est une liste de PISTES à vérifier, jamais un ordre de travail"
metadata:
  node_type: memory
  type: feedback
---

**Règle :** un rapport d'audit ou d'agent se traite comme des pistes à vérifier ; on n'agit sur « X manque » qu'après avoir prouvé l'absence soi-même.
**Why:** un auditeur à preuve étroite sur-rapporte, et le coût d'un faux positif suivi est du contenu redondant à maintenir — l'inverse du but.
**How to apply:** greper l'existant (scénarios, effets, données, primitives) avant de créer quoi que ce soit, ne jamais créer en parallèle d'un équivalent ; un « tu abuses » (au plus tard le 2026-07-16) de l'utilisateur est un signal de sur-ingénierie, pas d'accélérer.
