---
name: game-structure-plus-renderer
description: "Un flux émet de la STRUCTURE (ids + conséquences typées), jamais une chaîne d'affichage ; un renderer par surface compose le texte depuis un catalogue de gabarits."
metadata:
  node_type: memory
  type: feedback
---

Doctrine utilisateur (2026-07-10) : « Il faudrait surtout reprendre la main sur ce qu'on affiche pour que cela suive toujours les mêmes règles et qu'on puisse juste modifier certains paramètres. »

**Why:** un composeur que les sites APPELLENT reste esquivable ; sans API pour produire du texte depuis un flux, la dérive devient inexprimable.

**How to apply:** un flux émet `{ kind, acteur/compétence/difficulté en IDS, conséquences typées }` ; UN renderer par surface compose, les gabarits vivent dans un catalogue paramétrable ; la ligne de dénouement énonce la CONSÉQUENCE, jamais l'outcome déjà rendu par la rangée de jet. Patron existant à généraliser : le journal structuré de combat (`src/state/combatLog.ts`).
