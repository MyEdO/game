---
name: user-doctrine-atelier-godot-unique-catalogue-de-textures-unique
description: "L'atelier Godot montre tout ce que le jeu propose (modèles 3D de toute famille, animations, effets visuels et sonores), mis à jour dans le même geste ; une seule source de textures pour tout le jeu"
metadata:
  type: user
---

**Verbatims —** Clément :
- (2026-11-08) « L atelier doit gérer tous les modèles du jeu, de la créature aux véhicules en passant par les engins et les decors »
- (2026-11-08) « Tout ce qui est 3D doit pouvoir être affiché dans l atelier Godot. Biensur ces éléments peuvent avoir des particularités qui leurs sont propres »
- (2026-11-08), sur les textures : « De souvenir les murs, le sol, et pleins de chose ont des textures. J espère que chacun ne fait pas un peu comme il veut »
- (2026-11-09), fil des effets de combat (#3770) : « L atelier Godot est sensé montrer ce que le jeu propose. Ca concerne autant les animations, effets visuels et sonore »
- (2026-11-09) : « D ailleurs c est peut être quelque chose a inscrire quelques parts de mettre à jour l atelier Godot. On a surement des trucs déjà fait dans une doc/rules/skills/agents ou que sais je, donc a modifier »

**Why :** un atelier par famille et une texture par modèle divergent ; le jeu n'a qu'un rendu.
**How to apply :**
- Ce que le jeu ajoute de montrable (modèle, clip, effet visuel, son) se montre dans l'atelier dans le même geste, lu par le pont aux catalogues du jeu : `.claude/rules/hote-godot.md`.
- Un modèle 3D de toute famille entre par la même porte (`hotes/godot/asset/`, `godot:valider`) ; sa famille y ajoute ses particularités, jamais un atelier à part. Sa chaîne vit sous `scripts/personnage-3d/`.
- Évaluation d'ingénierie révisable : un modèle n'embarque aucune texture ; une surface nomme sa matière (`hotes/godot/asset/surfaces.ts`), texturée par le catalogue unique `hotes/godot/projet/textures/`, comme les sols et les murs.
