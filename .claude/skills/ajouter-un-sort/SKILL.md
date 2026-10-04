---
name: ajouter-un-sort
description: À utiliser quand on ajoute ou cure un sort (effets, métadonnées de résolution, Projectile magique, ZdE), quand un sort n'a aucun effet mécanique en jeu, ou quand son badge mécanique/partiel/narratif semble faux.
---

# Ajouter / curer un sort

Lire **`docs/ajouter-un-sort.md`** — tout vit en DONNÉE (`spells.json` : desc VERBATIM du Source
règle stricte 5, effets en Flow/GameOp[], métadonnées de résolution) ; la classification
mécanique/partiel/narratif vient de `spellSupport` (`engine/spellspec.ts`). Tableau de bord :
`docs/sorts-implementation.md` (auto-généré — régénérer via `npm run docs:sorts` après
curation, jamais éditer à la main).
