---
name: user-doctrine-refonte-emmene-ses-outils
description: "Une refonte met à jour dans le même geste tout ce qui outille ou décrit ce qu'elle change (scripts, skills, règles, docs, agents, structures) ; chaque fil en répond pour ses refontes"
metadata:
  type: user
---

**Verbatim (2026-11-12)** : « On a fait des grosses refonte mais j ai l'impression que les outils ne sont pas à jour comme recette.mjs et sûrement pleins d autres »

**Verbatim (2026-11-12)** : « Outils/skills/docs/rules/structures/agents/scripts/etcs … enfin tu sais de quoi je parle »

**Verbatim (2026-11-12)** : « D ailleurs les autres fils doivent bien prendre en compte ce besoin » — #4007.

**Why :** un outil périmé ment à la session suivante, qui le découvre en panne au moment d'en avoir besoin ou, pire, suit sa consigne fausse.

**How to apply :**
- un geste qui renomme, déplace ou supprime (symbole, littéral, fichier, commande, forme de donnée) cherche l'ancien nom par `git grep` dans tout ce qui outille ou décrit : `scripts/`, `hotes/`, `.claude/` (règles, skills, agents), `docs/`, `AGENTS.md`, `README.md`, `.github/`, et le corrige dans le même commit ;
- un outil que le geste traverse se rejoue avant de dire fini ; pour l'hôte Godot, le jeu du parcours touché par `hotes/godot/lot-de-recettes.mjs` ;
- chaque fil répond des outils que ses refontes traversent ; il ne les laisse pas à un fil de rattrapage.
