---
name: user-doctrine-ids-stables-labels-affichage
description: "Toute LOGIQUE est keyée par id STABLE ; le label est de l'AFFICHAGE, y compris à l'authoring"
metadata:
  type: user
---

**Verbatim (2026-07-09)** : « Le seul endroit où on peut mettre des labels, c'est dans le champ `label`, ou pour l'afficher, ou sur des écrans du codex/éditeur pour aider à la saisie — mais au final ce qu'on manipule c'est des IDs. »

**Why :** un label est de l'affichage (multilangue, recurable) ; keyer une logique dessus casse au premier renommage et interdit la traduction.

**How to apply :** aucun `Map`/`Record`/comparaison par label dans `src/engine` ou `src/state` (pas de `X_BY_LABEL`) ; seule couture tolérée, la conversion label→id au CHARGEMENT des données, dans `src/data/index.ts` uniquement. Y COMPRIS à l'authoring : l'auteur écrit des ids ; les résolveurs (`scripts/*/lib.mjs`) VALIDENT en fail-fast, ils ne normalisent plus.
