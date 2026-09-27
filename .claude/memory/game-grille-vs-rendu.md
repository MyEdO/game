---
name: game-grille-vs-rendu
description: "La grille est la vérité du SYSTÈME (portées, murs, déplacement) ; tout rendu d'immersion (lumière, visibilité, ambiance) se présente en CONTINU."
metadata:
  type: project
---

Arbitrage utilisateur (2026-08-14) : « le moteur graphique lui n'a pas a sentir limiter par le cadriage. Biensur les murs sont sur des arretes, les personnages se déplacent de case en case, mais la lumiere, la vue, tous ces éléments d'immersion n'ont pas besoin d'en souffrir »

**Why:** la quantification par case est une commodité du système de règles, pas une propriété du monde rendu.

**How to apply:** brouillard, teinte de visibilité, lumière et ambiance s'échantillonnent par sommet, frontières fondues — la bavure sur une case voisine est VOULUE. Ne jamais justifier une quantification visuelle par « la règle est par case ». Exception : la coupe d'étage FRANCHE en vue top (lisibilité de plan, pas immersion).
