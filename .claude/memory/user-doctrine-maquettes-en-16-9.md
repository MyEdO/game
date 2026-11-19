---
name: user-doctrine-maquettes-en-16-9
description: "Les maquettes Godot se dessinent dès maintenant dans une résolution d'écran réelle, 16:9 (1920 × 1080), plus dans le 1707 × 780 de la fenêtre de navigateur"
metadata:
  type: user
---

**Verbatim (2026-11-18)** : « Pour moi faudrait utiliser une résolution valide dès maintenant », en réponse au courrier de #4464 : les maquettes se rendaient en 1707 × 780 (ratio 2,19), le format standard d'un jeu étant 1920 × 1080.

**Why :** un écran dessiné dans un ratio qu'aucun joueur n'a se chevauche une fois porté en 16:9 (#4462).
**How to apply :** `hotes/godot/cibles/propositions/sources/rendre.mjs` rend en 1920 × 1080 et la vue de base Godot suit dans le même geste (garde `hotes/godot/planches.hors-store.test.ts`) ; les règles de `propositions/dispositions.md` s'ancrent aux bords et aux coins. Voir [[user-doctrine-maquettes-jugees-cedent-aux-arbitrages-de-design]].
