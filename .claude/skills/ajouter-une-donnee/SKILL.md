---
name: ajouter-une-donnee
description: À utiliser quand on ajoute ou cure une entrée dans un src/data/*.json (trapping, qualité, carrière, machine de guerre, trait naval, activité, critique, lieu…), ou dès qu'on est tenté d'ajouter un id/label sans avoir vérifié qu'il existe déjà ailleurs. Route vers le skill de domaine dédié si l'ajout est un sort, un effet mécanique, une icône ou un livre.
---

# Ajouter une donnée dans src/data

Lire **`docs/ajouter-une-donnee.md`** (déroulé) et **`docs/donnees.md`** (carte + conventions + pièges
d'homonymes). Check-first, routage vers un skill de domaine, champ = Source RAW ⊕ convention voisine,
forme selon l'intention du RAW et canonicalisation : `.claude/rules/donnees.md`, chargée dès qu'un
`src/data/*.json` est lu ou écrit. Une donnée visible au Codex passe aussi la recette navigateur.
