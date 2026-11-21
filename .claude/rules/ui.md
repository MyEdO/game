---
paths:
  - "src/noyau/modalArbiter.ts"
---

# Arbitrage des fenêtres du noyau

- Un libellé de bouton ou d'action est COURT, sans énumération entre parenthèses : un libellé à rallonge casse la mise en page des modales.
- L'affordance d'aide (i) se place APRÈS son référent, dans le même hit-target, insécable avec son texte : le repli de ligne ne la laisse jamais seule. « Le i devant X » nomme le PROPRIÉTAIRE de l'affordance, pas sa position.
- L’arbitre sélectionne la première entrée de `MODAL_DEFS` dont `when` est vrai. La condition d’ouverture appartient à son `when`. `pickActiveModalKey` (`src/noyau/modalArbiter.ts`)
- Un pending sans fenêtre (ciblage carte, écran dédié) va à `HORS_MODAL`, jamais à `MODAL_DEFS` (`src/noyau/modalArbiter.ts`).
