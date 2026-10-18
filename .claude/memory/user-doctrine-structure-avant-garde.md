---
name: user-doctrine-structure-avant-garde
description: "Une classe de contournement se rend d'abord impossible à écrire par la structure (module, exports, types) ; une garde seulement là où la structure ne peut pas porter l'invariant"
metadata:
  type: user
---

**Verbatim (2026-10-17)**, sur une garde de stock proposée contre les Critiques appliqués hors pipeline : « Le projet va finir en un amalgame de garde. »

**Why :** une garde mesure une fuite après coup et ajoute un stock à entretenir ; une frontière de module (exports minimaux, applicateurs internes) rend la fuite incompilable sans rien à entretenir.

**How to apply :** devant une classe de contournement, cherche d'abord le module, les exports et le type qui la rendraient impossible à écrire, et n'exporte que les entrées du chemin canonique. Une garde seulement quand la structure ne peut pas porter l'invariant (prose, données JSON, conventions de commentaires), en le disant. « Un audit se clôt par des gardes » se lit « par une impossibilité mécanique », dont la structure est la meilleure forme.
