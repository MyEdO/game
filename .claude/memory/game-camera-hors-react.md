---
name: game-camera-hors-react
description: "Tout ce qui bouge PAR FRAME vit dans la BOUCLE, jamais dans l'état React ; une valeur de caméra = un calcul, N consommateurs même-frame, zéro lissage par consommateur"
metadata:
  type: project
---

**Why:** un `set` de store par événement d'entrée fait une tempête de commits React, et un easing CSS posé sur un `transform` de caméra désynchronise le DOM du canvas — l'état de l'art (react-three-fiber, `CSS2DRenderer`) place la caméra dans la boucle et repositionne les surcouches DOM depuis la MÊME caméra dans le MÊME battement.

**How to apply:** un geste ou une animation qui écrit à la cadence de l'image passe par un module vivant (`src/state/stagePan.ts`, `src/state/stageYaw.ts`) et le battement unique `src/gameIso/stage/stageFrames.ts` ; React ne commite qu'aux frontières discrètes, en ABSOLU. La caméra se calcule une fois par frame et tous ses consommateurs la lisent dans cette frame — aucun `transition` CSS sur un transform de caméra, tout easing à la SOURCE. Un module vivant partagé se remet à zéro aux frontières (entrée de scène, recentrage, `afterEach` des tests). Un groupe three se REPOSE (montage sur le semis, repose sur verdict/teinte) : disposer un matériau à dépendance fréquente relie le shader à chaque exécution.
