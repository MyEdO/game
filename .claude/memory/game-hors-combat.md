---
name: game-hors-combat
description: "Porter un système combat-only vers le hors-combat = rendre le flux EXISTANT combat-optionnel, jamais écrire un flux parallèle."
metadata:
  node_type: memory
  type: feedback
---

**Why:** un flux hors-combat self-contained recopie la résolution et les effets (soin, buffs, États, maléfice) — dette et divergence garanties ; l'utilisateur l'a tranché par « Évite de dupliquer ».

**How to apply:** patron « résoudre → appliquer l'effet → finaliser » : résolution par `actorIn`/`inBattleId` (`src/state/combatants.ts`) et re-rendu par `touchActors` (`src/state/combatOrParty.ts`), sortie unique par `finishPlayerAction` (`src/state/combatFlow.ts`), cœur d'effet rendu `battle`-nullable. Seule dérogation : un fichier dédié est acceptable si le flux ne réutiliserait QUE des résolveurs purs (zéro logique d'effet à copier).
