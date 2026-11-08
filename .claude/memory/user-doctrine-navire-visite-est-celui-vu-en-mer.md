---
name: user-doctrine-navire-visite-est-celui-vu-en-mer
description: "Un navire se pose dans une scène éditable et s'y visite pont par pont sous son modèle 3D, le même qu'en mer et dans l'atelier"
metadata:
  type: user
---

Fil de projet de la caraque (#2987, #3686), vue immersive des ponts redessinés par le plan.

**Verbatims —** Clément :
- (2026-11-08) « D ailleurs entre le rendu blender et la vue Godot … ça fait mal »
- (2026-11-08) « Moi tout ce que je veux c est que l’éditeur permette de créer ce genre de scène mais qu on puisse se déplacer sur le bateau et ses différents niveau sans avoir l impression que notre bateau représente sur la mer soit très différent de celui qu on peut visiter »

**Why :** un navire redessiné par le plan avec les murs du monde n'est plus celui qu'on voit en mer ; le jeu n'a qu'un rendu (fiche `user-doctrine-atelier-godot-unique-catalogue-de-textures-unique`).
**How to apply :** évaluation d'ingénierie révisable (non-verbatim utilisateur), retenue sur la carte de décision du fil :
- l'éditeur pose un navire dans une scène par son type et ses Améliorations ; la scène le montre par son modèle 3D ;
- le plan de ses ponts, aligné sur le modèle, porte les cases, portes, échelles et meubles sans redessiner la coque ni ses cloisons ;
- un nouveau type de navire sort de sa chaîne de fabrication avec son modèle et son plan, alignés.
