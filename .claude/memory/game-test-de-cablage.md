---
name: game-test-de-cablage
description: "Un test qui FORGE le ctx ne couvre pas le CÂBLAGE : exiger un test niveau state qui échoue si la clé est retirée du site d'appel"
metadata:
  node_type: memory
  type: project
---

Quand une donnée de contexte traverse une couture multi-sites (N sites construisent le même objet `ctx` à la main), chaque clé est un point de divergence silencieux : l'op est testable isolément, le câblage non — un test qui appelle `applyOps` avec un ctx forgé reste vert pendant qu'un site d'appel omet la clé.

**Why:** le défaut ne vit pas dans l'op mais dans le site qui la nourrit ; seul un flux réel le voit.
**How to apply:** pour toute nouvelle clé de ctx, exiger un test de CÂBLAGE niveau state (flux réel) ET la preuve qu'il ÉCHOUE si on retire la clé du site d'appel ; en revue, comparer clé par clé les N sites constructeurs, et mutualiser la construction du ctx quand le motif se répète.
