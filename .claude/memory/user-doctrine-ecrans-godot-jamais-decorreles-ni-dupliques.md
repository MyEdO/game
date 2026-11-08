---
name: user-doctrine-ecrans-godot-jamais-decorreles-ni-dupliques
description: "Godot, même en prototype : le « zéro duplication » du credo vaut pour les écrans ; un cadre partagé dont chaque écran hérite"
metadata:
  type: user
---

**Verbatim (2026-11-06)**, sur la carte et l'écran du lieu de #3534 : « Et n'oublie jamais que même si on reste sur du prototype, on doit éviter le piege de la version web: des écrans décorélé et dupliqué »

**Why :** le principe est déjà au credo (« Zéro dette », « Réutiliser l'existant, le canonique ») et fonde #3328. Le verbatim ajoute que le prototype n'en dispense pas : la carte et le lieu avaient été posés en deux dispositions qui recopiaient leur cadre.

**How to apply :** deux écrans qui partagent une structure (cadre, titre, gestes, place du journal et du groupe) héritent d'une même scène Godot ; une même donnée (un trajet, un service) se montre par un seul élément de `src/hote/ecran.ts`, quel que soit l'écran. Voir aussi [[user-doctrine-un-hote-jamais-duplique]].
