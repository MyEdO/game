---
name: user-doctrine-pas-de-fallback-legacy
description: "Aucun repli qui garde vivant un comportement que le programme élimine (résolution par label comprise)"
metadata:
  type: user
---

**Verbatim (consigné le 2026-07-20)** : « Je n'aime pas les fallback qui pousse a garder un comportement legacy, dans parfois l'utilisation de label interdit ».

**Why :** un repli masque une migration incomplète et réintroduit souvent la résolution par label ([[user-doctrine-ids-stables-labels-affichage]]).

**How to apply :** une migration supprime les fonctions mortes et les champs de conflation, et remplace la référence par une réf typée résolue directement ; une régression transitoire assumée vaut mieux qu'un repli propagé.
