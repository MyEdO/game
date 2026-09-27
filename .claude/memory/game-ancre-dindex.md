---
name: game-ancre-dindex
description: "Mesurer « où sont les références » s'ancre sur l'INDEX DES IDS, jamais sur un vocabulaire de clés ni un seuil de champ"
metadata:
  node_type: memory
  type: project
---

**Why:** un critère fondé sur un vocabulaire de clés ne voit que ce que le vocabulaire nomme, et il est circulaire — on le solde en éditant le vocabulaire. La vérité de « qu'est-ce qu'une référence » est dans la DONNÉE (les ids), pas dans une liste de clés.

**How to apply:** toute mesure ou garde « X référence Y » (FK, orphelins, formes de ref, consommateurs) résout contre l'index des ids ou le registre généré : une valeur chaîne égale à un id existant, hors clé d'identité du document, EST une occurrence ; le champ porteur se MESURE depuis ces occurrences, le lexique ne nomme que les formes cibles. Un seuil (« ≥ 80 % des valeurs portent un id ») ou un vocabulaire de clés dans un brief de détection est un signal d'alarme. Collisions d'ids inter-datasets et labels égaux à un id s'IMPRIMENT comme angles morts.
