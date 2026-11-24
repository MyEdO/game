---
name: user-arbitrage-roguelite-conduite-des-lots
description: "Lots du roguelite : agents en parallèle, bug majeur corrigé sans feu vert, Fable au dessin seul, preuves ciblées"
metadata:
  type: user
---

**Verbatim (2026-11-23)** : « Tu sais tu n'as pas vraiment de limite d'agent ici »
**Verbatim (2026-11-23)** : « En cas de bug majeur de ce genre, je t'autorise a lancer un agent pour le corriger »
**Verbatim (2026-11-23)** : « mais arrete, Fable coute chere ! »
**Verbatim (2026-11-23)** : « L'art de perdre un temps monstrueux sur des agents qui ont 5min de cache »

**Why :** le roguelite avance par lots courts ; l'attente, les preuves trop larges et un modèle cher mal employé coûtent plus que le lot.
**How to apply :** les lots sans fichier commun partent en même temps, en worktree isolé s'ils se croisent, chacun avec son budget ; un plantage ou une règle cassée en jeu se corrige aussitôt par un agent, sans attendre de feu vert ; Fable ne reçoit que du dessin, sur un écran, avec un brief qui part de l'écran existant, jamais une correction ni de la plomberie ; les preuves d'un lot sont le vitest ciblé (`npm test -- <fichiers>`, `npm run roguelite:tests`), `npm run roguelite:construire`, `npm run typecheck:fast` et les recettes concernées (`npm run roguelite:recette`).
