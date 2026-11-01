---
name: user-doctrine-recette-web-suspendue-migration-godot
description: "Migration Godot : aucune recette navigateur ni capture de l'interface web, aucun ticket sur sa présentation ; JUGE-VISION porte « aucune capture », la citation et les tests DOM"
metadata:
  type: user
---

**Verbatim (2026-10-25)** : « changement de moteur de jeu par GODOT. Ca veut dire l'abandonner du svg et l'interface actuel, et mise en pause du test retours de recette sur les régles du jeu le temps de cette migration. »

**Verbatim (2026-10-26)**, sur une recette lancée pour un commit touchant `src/ui` : « Qu est ce que j ai dit sur la recette déjà ? »

**Verbatim (2026-11-01)**, sur des tickets ouverts depuis une recette web : « Donc tu es en train de recetter un truc abandonné et créé des tickets dessus ? », puis : « Mais il n'y a pas que ce ticket. »

**Verbatim (2026-11-01)** : « Mais on va pas recetter un truc qui n'est pas encore en place, ni recetter une interface qu'on va entierement refaire ! »

**Why :** l'interface web sera jetée à la bascule Godot ; la recetter coûte sans rien rapporter.

**How to apply :** tant que dure la migration Godot :
- aucune recette navigateur, aucune capture de l'interface web, par une session ou un agent ;
- aucune recette de l'écran Godot tant qu'il n'est pas en place : ni constat ni besoin de parité tiré de son état ;
- aucun ticket sur la présentation de l'écran de jeu web ; un comportement que Godot doit garder va à #3009, un outil d'auteur (Compendium, atelier, galeries), au sort reporté, à #3006 ;
- un commit qui touche `src/ui` ou `src/gameIso` remplit `JUGE-VISION:` par « aucune capture », la citation du 2026-10-25 et les tests DOM qui couvrent le changement.
