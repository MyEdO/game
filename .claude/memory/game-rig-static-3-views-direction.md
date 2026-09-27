---
name: game-rig-static-3-views-direction
description: "Tout objet STATIQUE rendu par le rig a un art DISTINCT par entité × 3 vues, en defs/ — sauf les armes (1 art)"
metadata:
  node_type: memory
  type: project
---

Tout objet STATIQUE du rig (engin de siège, navire, structure, objet) a un art DISTINCT par entité ET 3 vues (front/profile/back), en donnée : un fichier `defs/<id>.ts` → registre auto-chargé → résolu PAR ID, monté sur les briques partagées `nearestView` (`src/gameIso/rig/viewArt.ts`) + `orientedArtOr` (repli VISIBLE) + `groundedBody` (`src/gameIso/rig/staticBody.ts`). Exception : les ARMES gardent UN art (elles tournent dans le plan via le rig porteur). Étalons : `ship/defs/` (gardé par `ship-arts.test.ts`) et `engin/defs/`.

**Why:** un art unique pour toute une famille aplatit la lecture (deux coques au même dessin) et une vue unique casse l'orientation iso.
**How to apply:** nouvelle famille statique → art par id × 3 vues en `defs/`, jamais un name-matcher ni un `Record` central ; un id sans art tombe sur le repli VISIBLE, jamais sur un générique silencieux.
