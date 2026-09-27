---
name: feedback-invariant-verbatim
description: "L'autorité descend d'une chaîne — doctrine utilisateur > RAW > mesure ; tout dérivé (rendu de juge, ticket que j'écris, JSDoc, mon propre design) se re-mesure contre elle avant d'entrer dans un brief."
metadata:
  type: feedback
---

Un invariant se recopie VERBATIM depuis le ticket ou la doctrine, avec la QUESTION à laquelle il répondait — jamais depuis la lecture qu'en fait un juge.

**Why:** une phrase généralisée hors de sa question devient un faux invariant, et la cohérence interne du code n'a jamais valeur de réponse à l'écart contre l'objectif.

**How to apply:** toute branche sur le TYPE de porteur (`isWorld`, `kind === …`) dans un socle est un drapeau rouge — la question canonique est « que fait un héros dans le même cas ? », la réponse doit être le MÊME code ; un test qui bloque en headless se lit d'abord « le pilote de test manque un geste ».
