---
name: game-erreurs-de-pdf
description: "Un écart src/data ↔ Source peut être une correction volontaire de l'utilisateur : vérifier cas par cas, jamais appliquer la source en aveugle"
metadata:
  node_type: memory
  type: feedback
---

Les livres `Source/` (PDF → Marker/OCR) contiennent des erreurs, et `src/data/*.json` a parfois été corrigé À LA MAIN contre elles : un écart n'implique donc pas que le JSON est faux. La VO de `Source/` est un TIE-BREAKER quand la VF est douteuse sur une VALEUR, jamais la source de la donnée affichée, et elle ne tranche pas un défaut d'ORDRE propre à la VF.

**Why:** appliquer la source en aveugle ré-introduit les bugs que l'utilisateur a déjà éliminés.
**How to apply:** sur tout audit contre `Source/`, présenter la preuve (citation + valeur JSON), se demander « bug JSON ou correction volontaire ? », flaguer plutôt qu'éditer quand c'est ambigu, et ne jamais tordre un test qui asserte une valeur corrigée.
