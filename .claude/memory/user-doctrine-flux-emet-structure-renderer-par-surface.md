---
name: user-doctrine-flux-emet-structure-renderer-par-surface
description: "Un flux émet de la STRUCTURE (ids, conséquences typées), jamais une chaîne d'affichage ; un renderer par surface compose le texte depuis un catalogue de gabarits"
metadata:
  type: user
---

**Verbatim (2026-07-10)** : « Il faudrait surtout reprendre la main sur ce qu'on affiche pour que cela suive toujours les mêmes règles et qu'on puisse juste modifier certains paramètres. »

**How to apply :** un flux émet `{ kind, acteur/compétence/difficulté en ids, conséquences typées }`, jamais une chaîne d'affichage. Un seul renderer par surface compose le texte depuis un catalogue de gabarits paramétrables ; la ligne de dénouement énonce la CONSÉQUENCE, pas l'outcome que la rangée de jet affiche déjà. Patron à généraliser : `CombatEventKind` et ses ids `actorId`/`targetId` (`src/state/combatLog.ts:14-24`) ; son champ `text` (`src/state/combatLog.ts:22`), chaîne déjà composée, est à résorber.
