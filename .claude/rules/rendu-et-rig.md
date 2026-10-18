---
paths:
  - "src/gameIso/**"
  - "src/state/stage*.ts"
  - "src/state/dir8.ts"
  - "scripts/rig/**"
  - "scripts/qc/**"
  - "scripts/_qc-blind.mts"
  - "scripts/art-ref/**"
---

# Rendu du monde et rig

- Ce qui bouge à la cadence de l'image passe par un module vivant et le battement unique, jamais par l'état React, qui ne commite qu'aux frontières discrètes, en ABSOLU. `src/state/stagePan.ts` `src/state/stageYaw.ts` `src/gameIso/stage/stageFrames.ts`
- Un module vivant se remet à zéro aux frontières : entrée de scène, recentrage, `afterEach` des tests (`resetStagePan`, `resetStageYaw`).
- La caméra se calcule une fois par frame et tous ses consommateurs la lisent dans cette frame : aucune `transition` CSS sur un transform de caméra, l'easing se fait à la source.
- Un groupe three se REPOSE (monté au semis, reposé sur verdict ou teinte) : disposer un matériau à chaque changement fréquent recompile son shader.
- L'orientation est une donnée MONDE `Dir8` dans `store.facing` et `SceneEntity.facing`, jamais sur `Combatant`. Elle s'écrit par les actions du store (déplacement, attaque, sort, entrée en combat), jamais depuis un état de rendu ; le rendu la projette par `project(dir, camRot)`, jamais l'inverse. `src/state/dir8.ts` `src/gameIso/rig/facing.ts`
- Les moteurs d'animation rig et plan restent séparés. `src/gameIso/rig/anim/clips.ts` `src/gameIso/usePlanAnim.ts`
- Le rig est un pantin 2D de FACE : les angles de `Pose` tournent dans le plan de l'image ; accroupi ou assis s'expriment debout, par balancement et décor. `src/gameIso/rig/anim/ambientClips.ts`
- Avant de régler un angle, rasterise la pose elle-même et regarde le PNG : `bonesToSvg(plan.resolve(species, view, <pose>))` puis `new Resvg(svg).render().asPng()`. `scripts/qc/render-creature.mts:31-33`
- Tout objet statique du rig a un art DISTINCT par id × 3 vues dans `defs/<id>.ts`, résolu par `nearestView`, `orientedArtOr` (repli VISIBLE), `groundedBody` ; jamais de name-matcher ni de `Record` central. Armes : un seul art. `src/gameIso/rig/ship/defs/`
