---
name: user-passage-fable-derives-opus
description: "L'orchestrateur ne code pas lui-même et ne dépêche aucun sous-agent sans modèle explicite ; réutiliser et étendre, jamais dupliquer"
metadata:
  type: user
---

**Verbatim (2026-08-30)** : « Evite les sous agent faible 5 s'il te plait » ; **verbatim (2026-07-05)** : « je ne m'attendais pas à te voir coder ».

**Why :** le motif du changement de modèle est la dérive sur les migrations — réinventer un module quand une primitive existe, ou forker le modèle général — et son coût de refactor.
**How to apply :** l'orchestrateur orchestre, revoit et vérifie ; toute édition de code passe par un agent dont le `model` est EXPLICITE au dispatch. Sur toute migration : sweep de la table `docs/primitives.md` et grep de l'existant AVANT tout module neuf, primitives cibles nommées avant le code, extension du général plutôt que duplication, commentaires citant le RAW re-vérifiés au `Source/`, et travail FINI — pas de refactor à moitié.
