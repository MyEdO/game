---
name: feedback-coherence-par-concept
description: "L'inventaire d'un lot de FORME se fait par CONCEPT sur tous les datasets, jamais par fichier du ticket"
metadata:
  node_type: memory
  type: feedback
---

Verbatim utilisateur (2026-08-23) : « il n'y a aucune raison d'avoir autant de structure différente, même entre type. Il faudrait fournir une structure type partagé […] et l'imposé comme structure obligatoire pour tout json de l'application ».
**Règle :** un lot de forme s'inventorie par CONCEPT (grep du concept dans tous les `src/data/*.json`, les schémas et le moteur), jamais sur le seul dataset nommé par le ticket.
**Why:** le même concept vit ailleurs sous d'autres formes (libellés, littéral dans une op, regex sur un label) ; ne traiter que le dataset du ticket fabrique une demi-migration.
**How to apply:** la forme cible est le schéma partagé existant (`src/data/schemas/grammaire/reference.ts` — référence générique `{id, spec?, choix?, value?}`, variantes par COMPOSITION seulement), le lot va jusqu'au moteur, et une garde structurelle sur les defs l'impose à tout JSON.
