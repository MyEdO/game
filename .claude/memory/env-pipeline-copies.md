---
name: env-pipeline-copies
description: "Dans un script de workflow, pipeline()/parallel() rendent des COPIES des items (identité fausse) et agent() rend null sur échec — apparier par clé, et faire juger tout changement de workflow"
metadata:
  node_type: memory
  type: reference
---

**Why:** les items traversent la frontière du sandbox par sérialisation : toute comparaison par identité est fausse pour TOUS les items (45 bloquants affichés pour 22 distincts), et une doublure de test qui passe les objets par référence ne peut pas voir le défaut.

**How to apply:** apparier par CLÉ (label, titre normalisé), jamais par identité ; `.filter(Boolean)` après `pipeline`/`parallel` et traiter un `null` d'agent comme un lot PERDU dit au journal ; les doublures de test clonent items et résultats ; tout changement d'un `.claude/workflows/*.js` passe par un juge de diff avec la lentille « hypothèses de harnais », jamais sauté.
