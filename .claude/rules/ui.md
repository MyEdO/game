---
paths:
  - "src/ui/**"
  - "src/state/modalArbiter.ts"
---

# Écrans React et CSS

- Un libellé de bouton ou d'action est COURT, sans énumération entre parenthèses : un libellé à rallonge casse la mise en page des modales.
- L'affordance d'aide (i) se place APRÈS son référent, dans le même hit-target, insécable avec son texte : le repli de ligne ne la laisse jamais seule. « Le i devant X » nomme le PROPRIÉTAIRE de l'affordance, pas sa position.
- L'arbitre monte la PREMIÈRE entrée de `MODAL_DEFS` dont `when` est vrai : une modale qui rend `null` fige la partie, encode sa condition dans son `when`. `pickActiveModalKey` `src/state/modalArbiter.ts:198`
- Un pending sans fenêtre (ciblage carte, écran dédié) va à `HORS_MODAL`, jamais à `MODAL_DEFS`. `src/state/modalArbiter.ts:263`
- Un `!important` qui verrouille un contournement est une rustine : remonte à la cause (sélecteur trop général, ordre de cascade).
