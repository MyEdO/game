---
name: env-ordre-de-cloture-code-docs-build-captures-commit
description: "Le pré-commit d'un `corrige #N` avec écran exige captures POSTÉRIEURES au dernier fichier d'écran stagé ET empreinte docs alignée sur le dernier source — l'ordre de clôture est code → docs:build → captures → stage → commit"
metadata: 
  node_type: memory
  type: project
  originSessionId: af4cca95-103d-40f0-b2d1-6e5a482649c6
  modified: 2026-09-18T14:38:35.296Z
---

Toute retouche de code après les captures (ou après `docs:build`) invalide l'une des deux preuves du pré-commit, et le commit est refusé.

**Why :** deux gardes du pré-commit lisent des horodatages/empreintes : (1) le solde — toute `capture:` citée doit être plus récente que le dernier `.tsx`/`.css` d'écran stagé ; (2) `docs/.sources-lues.json` — l'empreinte des sources lues par CHAQUE générateur doit correspondre à l'arbre (un `build-all --only x` ne suffit pas, il désaligne les autres). Un fichier d'écran retouché pour un commentaire ou un id relance donc captures ET docs.

**How to apply :** fermer un lot dans cet ordre strict, sans retour arrière : (1) tout le code, juge compris, y compris commentaires ; (2) `npm run docs:build` complet (≈3 min) ; (3) rejeu des scripts de captures sur l'arbre définitif (les garder REJOUABLES au scratchpad) ; (4) `git add` par chemins, solde compris ; (5) `git commit -F`. Si le commit est refusé pour du code, repartir de (1) — jamais « juste » recapturer. Voir aussi [[env-cliquet-porteur-avant-commit-pre-commit-aveugle]] et [[env-hook-solde-deny-avant-execution-add-et-commit-separes]].
