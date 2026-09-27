---
name: feedback-wip-voisin
description: "Le WIP d'une autre session impose la CHIRURGIE (mes hunks, jamais les siens), jamais l'ÉVITEMENT d'un fichier — un plan qui contourne un fichier partagé est infirme"
metadata:
  node_type: memory
  type: feedback
---

Verbatim utilisateur (2026-08-10) : « m en fiche si y a du wip voisin, c'est une excuse pour ne
jamais finir son travail ». Un fichier en WIP voisin S'ÉDITE : hunks chirurgicaux à distance des
siens, commit par hunk re-vérifié à l'instant, attribution de tout rouge. Un plan qui pose « fichier
X intouchable » comme contrainte STRUCTURANTE (murage reporté, fossile créé) se corrige : la
contrainte est d'EXÉCUTION, jamais de CONCEPTION.

**Why:** sur un arbre partagé en continu il y a TOUJOURS du WIP voisin quelque part ; en faire un mur
transforme chaque chantier en gruyère de reports qui ne se résorbent jamais.

**How to apply:** la collision de LIGNES (deux sessions sur le même hunk) est une coordination
ponctuelle avec l'utilisateur, jamais un motif d'évitement a priori ; les interdits durables restent
entiers — jamais de git destructif, jamais committer les hunks du voisin.
