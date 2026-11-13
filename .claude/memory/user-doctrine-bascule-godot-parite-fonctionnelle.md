---
name: user-doctrine-bascule-godot-parite-fonctionnelle
description: "Bascule Godot : seuls le rendu et l'interface web partent, toutes les fonctionnalités restent (coop, sauvegardes, roster) ; aucun investissement UI/CSS web, schéma typé exposé à Godot"
metadata:
  type: user
---

**Verbatim (2026-10-25)** : « Il n'est pas question de perdre le mode coop, ni les sauvegarde, ni toutes les fonctionnalités qu'on avait avant. »

**Verbatim (2026-10-28)**, sur un stock CSS dans un lot de dette : « Stock css ? Je pensais qu on se debarasser de l Ui/css existant pour godot »

**Verbatim (2026-10-28)** : « Tant que Godot a accès aux informations et que le format soit suffisamment clair et exposé pour que créer les nouvelles interfaces se fasse sans trop de difficulté… »

**Why :** Godot remplace l'affichage, pas le jeu ; investir dans une interface qui sera jetée ne rapporte rien.

**How to apply :**
- Partent : le rendu et l'interface web (`src/ui`, `src/gameIso`). Restent : `src/state` et chaque fonctionnalité (coop, sauvegardes, roster, préférences) ; un comportement à garder va à #3009.
- La dette se ferme dans le schéma et le moteur. Côté `src/ui` et CSS, seulement le minimum pour ne pas casser ni écrire de donnée invalide : aucune ergonomie web neuve, aucune exigence de juge en ce sens.
- Le schéma typé et ses catalogues s'exposent à Godot (#3072).
