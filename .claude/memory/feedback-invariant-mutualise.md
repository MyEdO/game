---
name: feedback-invariant-mutualise
description: "La duplication se mesure à « un appelant peut-il VIOLER l'invariant ? », pas au nombre de lignes — un invariant en plusieurs temps se mutualise dans une primitive qui le rend infalsifiable."
metadata:
  type: feedback
---

**Why:** un enchaînement répété qui « ressemble à de la simple réutilisation » se casse en silence dès qu'un appelant oublie une étape ; le footgun se retire À LA SOURCE, pas par une consigne.

**How to apply:** si un appelant peut violer l'invariant, extraire la primitive ET supprimer le geste optionnel qui le permettait (le paramètre devient la valeur déjà résolue, la fonction ne re-tire plus rien) — la faute devient structurellement impossible.
