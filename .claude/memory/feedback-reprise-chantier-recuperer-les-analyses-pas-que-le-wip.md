---
name: feedback-reprise-chantier-recuperer-les-analyses-pas-que-le-wip
description: "2026-09-02 — reprendre le chantier d'une session fermée = récupérer AUSSI ses ANALYSES (transcript, scratch, commentaires de tickets), pas seulement son WIP de code : l'inventaire #1673 a refait une conclusion (discriminant `type` = nom de document) que la session précédente avait déjà atteinte ; et un inventaire est un PREMIER JET à réitérer après la première vague"
metadata:
  type: feedback
---

**Verbatim utilisateur (2026-09-02)** : « C'est un bon premier jet, il faudra ré-iterer une fois qu'on aura traité la premiere vague. D'ailleurs pour cette histoire de "table", la session dont tu as repris le travail avait eu la même conclusion, étonnant que tu n'ai pas récupéré ses analyses a lui aussi ».

**Contexte** : à la reprise de #1463 (régime « une session par chantier »), j'ai repris le WIP de CODE de la session fermée (passation B1 au ticket) mais pas ses analyses ; le juge #1673 a re-dérivé de zéro que `type` est le nom du document (`grammaire/document.ts:266`) et que `tables.json` n'est pas le modèle — conclusion que l'autre session avait déjà.

**Why :** une analyse re-dérivée coûte un juge complet (≈280 k tokens, 35 min) et perd les nuances de la première ; la continuité d'un chantier repose sur ses conclusions autant que sur son code.

**How to apply :**
1. À toute reprise de chantier : inventorier les SOURCES de la session fermée — commentaires GitHub qu'elle a écrits (`gh search issues --commenter`, tickets qu'elle a créés : #1669/#1670/#1673 ici), fichiers sous `.claude/parc-*`/scratch, sa mémoire, et son TRANSCRIPT (`~/.claude/projects/<slug>/<session>.jsonl`, lecture par script en streaming : `grep-transcript.mjs`) — AVANT de dispatcher un juge sur le même sujet ; le brief du juge cite ces conclusions à confirmer/réfuter, pas à redécouvrir.
2. Un inventaire (comme #1673) est un PREMIER JET : le pilotage porte une ligne « à réitérer après la première vague » et la réitération est planifiée, pas laissée à la mémoire.
