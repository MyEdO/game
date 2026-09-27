---
name: game-combat-monte
description: "Combat monté — la géométrie est celle de la MONTURE ; une monture Nerveux chevauchée n'a pas de tour propre (RAW)"
metadata:
  node_type: memory
  type: project
---

Tout ce qui mesure portée, adjacence, empreinte et surbrillance d'un couple cavalier/monture passe par la géométrie de la MONTURE (souvent 2×2) ; le cavalier 1×1 la suit.

**Why:** mesurer sur le cavalier renvoie « hors de portée » après une charge (monture au contact, cavalier à 2) et laisse une cascade orpheline qui bloque la fin de tour.

**How to apply:** mesurer via la géométrie de combat de la monture (`src/state/mount.ts`) ; sur un résultat nul dans le chemin d'attaque, fermer la cascade plutôt que de sortir sans rien faire. Tour propre : `isControlledMount` (`src/state/mount.ts`, consommé par `combatSetup.ts` et `combatSlice.ts`) n'exclut de l'ordre que la monture chevauchée portant le Trait Nerveux — `LDB 14` : « une monture SANS le Trait Nerveux est un autre combattant à part entière et peut effectuer sa propre Action ».
