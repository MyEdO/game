---
name: feedback-jamais-de-demi-migration
description: "Pas de travail à moitié ni de demi-migration : un chantier liste ses sites exhaustivement et ne ferme que la liste à zéro ; murer le neuf en laissant le stock EST la demi-migration."
metadata:
  type: feedback
---

Verbatims utilisateur : « je n'aime pas le travail fait a moitié et les demi-migrations » (2026-08-09) ; « murer le neuf c'est valider du legacy qui vivra eternellement » (2026-08-14) ; « Pas de demi-migration ou de guard qui valident l'existent et empeche les nouvelles apparitions » (2026-08-16).

**Why:** un site non migré est un bug en incubation plus un précédent que le code voisin copie ; finir coûte toujours moins que redécouvrir les sites un incident à la fois.

**How to apply:** un lot de structure = UN concept sur TOUS ses porteurs (datasets, ops, tables, scènes, saves, éditeur, Codex), jamais « par dataset » ni « données d'abord, ops plus tard », et aucun schéma qui accepte l'ancienne ET la nouvelle forme ; toute baseline posée par un verrou porte son lot d'extinction, sinon le verrou est refusé ; quand N sites exigent la même retouche, le lot juste est le SOCLE qui les rend déclaratifs. La fermeture se prouve par un motif qui ne compile plus ou une garde rouge, pas par « les sites connus sont migrés ».
