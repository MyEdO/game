---
paths:
  - "src/gameIso/**"
  - "src/state/stage*.ts"
  - "src/geometry/dir8.ts"
  - "scripts/qc/**"
---

# Rendu du monde

- **Ce rendu web est abandonné, remplacé par l'hôte Godot** (#2794, #3009 ; utilisateur, 2026-10-25 : « changement de moteur de jeu par GODOT. Ca veut dire l'abandonner du svg et l'interface actuel », et 2026-10-29 : « la partie web va etre abandonné et remplacé par godot »). Il ne reçoit que ce qui garde le jeu web jouable jusqu'à la bascule. On n'y ajoute rien, on n'en migre rien, et aucun travail 3D ou Godot n'en tire un id, une forme ou un modèle. Il se supprime à la bascule.
- **Le jeu web n'affiche aucun personnage** (#3160 ; utilisateur, 2026-10-30 : « Retirer dès maintenant le rig SVG et le rendu web des personnages […]. Plus rien à toucher, mais le jeu web, y compris la prod, n'affiche plus les personnages tant que Godot ne l'a pas remplacé. »). Aucun dessin de personnage ni de créature ne se pose sous `src/gameIso/` ; leur rendu revient à l'hôte Godot (`hotes/godot/`). `src/retour-du-rig-guard.test.ts`
- Ce qui bouge à la cadence de l'image passe par un module vivant et le battement unique, jamais par l'état React, qui ne commite qu'aux frontières discrètes, en ABSOLU. `src/state/stagePan.ts` `src/state/stageYaw.ts` `src/gameIso/stage/stageFrames.ts`
- Un module vivant se remet à zéro aux frontières : entrée de scène, recentrage, `afterEach` des tests (`resetStagePan`, `resetStageYaw`).
- La caméra se calcule une fois par frame et tous ses consommateurs la lisent dans cette frame : aucune `transition` CSS sur un transform de caméra, l'easing se fait à la source.
- Un groupe three se REPOSE (monté au semis, reposé sur verdict ou teinte) : disposer un matériau à chaque changement fréquent recompile son shader.
- L'orientation est une donnée MONDE `Dir8` dans `store.facing` et `SceneEntity.facing`, jamais sur `Combatant`. Elle s'écrit par les actions du store (déplacement, attaque, sort, entrée en combat), jamais depuis un état de rendu ; le rendu la projette par `project(dir, camRot)`, jamais l'inverse. `src/geometry/dir8.ts` `src/gameIso/facing.ts`
