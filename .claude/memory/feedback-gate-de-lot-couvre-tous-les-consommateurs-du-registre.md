---
name: feedback-gate-de-lot-couvre-tous-les-consommateurs-du-registre
description: "Le périmètre de gates d'un lot se DÉRIVE de qui LIT ce qu'il touche (registre, stock, primitive), jamais de là où il a écrit."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: a0dfb696-da2e-4137-ae4b-32ad3e05ed77
  modified: 2026-09-21T16:15:37.338Z
---

Avant d'écrire le brief d'un lot, mesurer ses consommateurs (`grep -rl` sur le symbole ou le module
touché, tests compris) et poser CE set de gates ; la suite complète avant fusion reste la règle.

**Why:** un périmètre choisi par « où j'ai écrit » ignore « qui me lit » — un registre d'actions est lu
par le monde autant que par la console, un stock de garde par plusieurs suites, un `*-projet.json` est
le PRODUIT d'un `scripts/<campagne>/generate.mjs` (`generateurs-byte-stables.test.ts`), et la
régression sort après le push (#877, #1874, #1362).

**How to apply:**
- schéma de scène ou `*-projet.json` touché ⇒ `npm test -- src/state src/data src/scenes src/ui`
  avant le juge de diff, écrit au brief ;
- `src/data/actions.json`, `src/state/actionRegistry.ts`, `scripts/guards/lib/*Stock.mjs` ⇒ dériver
  les suites par grep et les jouer ;
- angle mort du grep par symbole : un fichier NEUF n'a pas de lecteur par symbole mais les gardes de
  CORPUS qui balaient son dossier le lisent (`src/state/set-scan-guard.test.ts` lit `src/state/*.ts`,
  `.testkit.ts` compris) ⇒ jouer aussi `<dossier>/*-guard.test.ts` et les gardes de racine ;
- un en-tête ou un littéral récapitulatif se recale avec ses lignes.
