---
name: user-doctrine-atelier-godot-unique-catalogue-de-textures-unique
description: "Tout modèle 3D (créature, véhicule, engin, décor) s'affiche dans l'atelier Godot, chaque famille avec ses particularités ; une seule source de textures pour tout le jeu"
metadata:
  type: user
---

Fil de projet de la caraque (#2987, #3686), revue des planches v4 du modèle.

**Verbatims —** Clément (2026-11-08) :
- « L atelier doit gérer tous les modèles du jeu, de la créature aux véhicules en passant par les engins et les decors »
- « Tout ce qui est 3D doit pouvoir être affiché dans l atelier Godot. Biensur ces éléments peuvent avoir des particularités qui leurs sont propres »
- sur les textures : « De souvenir les murs, le sol, et pleins de chose ont des textures. J espère que chacun ne fait pas un peu comme il veut »

**Why :** un atelier par famille et une texture par modèle divergent (couleurs, provenance, rendu) ; le jeu n'a qu'un rendu.
**How to apply :**
- Un modèle 3D, quelle que soit sa famille, entre par le même index et la même porte (`hotes/godot/asset/`, `godot:valider`) et s'affiche dans l'atelier Godot ; sa famille y ajoute ses particularités (postes et Améliorations d'un véhicule, par exemple), jamais un atelier à part.
- Sa chaîne de fabrication vit sous `scripts/personnage-3d/` (`environnement.mjs`), à côté de la base, jamais en scripts hors dépôt durables.
- Évaluation d'ingénierie révisable (non-verbatim utilisateur) : un modèle n'embarque aucune texture ; une surface nomme sa matière de décor du monde (`matiere`, `hotes/godot/asset/surfaces.ts`), dont la texture vient du catalogue unique `hotes/godot/projet/textures/` (provenance `provenance.json`, Release épinglée), comme les sols et les murs ; une planche de contrôle colore par emplacement de palette, comme le jeu.
