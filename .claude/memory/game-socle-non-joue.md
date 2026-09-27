---
name: game-socle-non-joue
description: "Un socle jamais joué n'est pas un précédent : le vérifier avant d'empiler dessus, et réparer emmène ses porteurs"
metadata:
  node_type: memory
  type: feedback
---

Une primitive trouvée dans le code n'est un modèle que si elle a déjà TOURNÉ en jeu — « N entrées l'utilisent déjà » est un argument de population, pas une preuve. Verbatim utilisateur (2026-07-26) : « En tout cas les avantages de groupe doivent aussi fonctionner. Quand tu juge que l'existant n'est pas bon, tu dois t'assurer de migrer les éléments qui l'utilisent pour qu'ils fonctionnent aussi ».

**Why:** fonder un lot sur un socle non prouvé multiplie un défaut inconnu par tous ses porteurs, et poser un second mécanisme à côté d'un premier resté mort double la dette.
**How to apply:** avant de fonder un lot sur une primitive, demander « a-t-elle déjà tourné pour de vrai ? » — sinon, lot de vérification (registre → donnée → résolution → moteur → UI + recette) AVANT ; toute réparation de socle emmène ses porteurs existants.
