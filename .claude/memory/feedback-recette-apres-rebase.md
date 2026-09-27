---
name: feedback-recette-apres-rebase
description: "Un lot UI recetté avant un rebase n'est pas recetté — la recette navigateur se rejoue sur l'arbre FINAL fusionné"
metadata:
  node_type: memory
  type: feedback
---

**Règle :** avant toute fusion d'un lot UI dont la base a bougé (rebase, conflits résolus, changement de régime de rendu dans l'intervalle), rejouer la recette navigateur sur l'arbre final — même « déjà recetté », même pressé.
**Why:** les tests unitaires prouvent l'ÉTAT, jamais la couture visuelle ; un rebase qui traverse un changement de régime de rendu invalide la recette d'origine (l'état s'arme, la peinture ne suit plus).
**How to apply:** l'arbre gelé à recetter est l'arbre FUSIONNÉ, pas celui du lot ; portes machine vertes ≠ recetté.
