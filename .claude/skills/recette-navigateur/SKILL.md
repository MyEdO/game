---
name: recette-navigateur
description: À utiliser avant de valider TOUTE feature visible en jeu (UI, combat, IA, voyage) dans le navigateur — Playwright sur le serveur de dev de CET arbre (localhost:5173 sur l'arbre principal, port dérivé en worktree lié — scripts/port-dev.mjs) — ou quand un clic/survol/état ne répond pas comme attendu en recette. Suspendue pendant la migration Godot : aucune recette de l'interface web.
---

# Recette navigateur

**Suspendue pendant la migration Godot** : aucune recette ni capture de l'interface web, fiche `.claude/memory/user-doctrine-recette-web-suspendue-migration-godot.md`.

Lire **`docs/recette-navigateur.md`**. L'essentiel non négociable : piloter **COMME UN JOUEUR**
(clavier `src/state/clavier/keybindings.ts` + clics réels d'abord ; `__wfrp` pour le setup/l'observation ;
store en dernier recours pour un setup sans helper — jamais pour déclencher le flux testé). Console à 0 erreur. Piège
closure-sync : jamais lire le DOM dans le même `evaluate` que l'action qui change l'état React.

## Ce que seule la recette prouve

Un juge de DIFF prouve la COMPOSITION d'un composant ; seule la recette prouve que le joueur le VOIT —
une feature peut être câblée sur une primitive qu'aucun écran du parcours ne monte. Le brief NOMME
l'écran-cible du parcours joueur (« Fiche complète »), jamais le composant (« HeroSheet ») ; quand une
primitive est composée par plusieurs écrans, vérifier lesquels la montent AVEC la donnée concernée (un
`sections=[…]` restrictif chez l'appelant masque une rubrique pourtant présente dans la primitive).

Un lot UI dont la base a bougé (rebase, conflits résolus, régime de rendu changé entre-temps) se
recette À NOUVEAU sur l'arbre FUSIONNÉ avant sa fusion, même déjà recetté : des portes machine vertes
ne valent pas une recette.

## Recette VISUELLE

Le brief demande d'ÉNUMÉRER tout ce qui est à l'écran calque par calque et de dire ce que chaque chose
est censée être — jamais « est-ce que X marche ». Verdict attendu : « un joueur comprend-il ce qu'il
regarde » ; le cas qui tranche est celui où PLUSIEURS choses se recouvrent (sous un porche, sous une
dalle d'étage), jamais une position unique. Ne jamais relayer un « ça ressemble à un jeu » sans avoir
regardé la capture soi-même.

## Fin de vague : DEUX passes

1. **PREUVE** — le DoD, scriptée, captures et `fichier:ligne` à l'appui.
2. **JOUEUR-RPG** — persona explicite (« joueur de BG3/NWN/table WFRP qui découvre ce jeu »), zéro DoD,
   jeu naturel. Rapport en LANGAGE JOUEUR : ressentis et thèmes classés « ce qui m'aurait fait quitter »
   → « ce qui m'a gêné » → « ce qui m'a manqué », captures à l'appui, jamais de `fichier:ligne`.
