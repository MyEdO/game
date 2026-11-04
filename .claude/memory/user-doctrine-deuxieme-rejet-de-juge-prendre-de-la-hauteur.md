---
name: user-doctrine-deuxieme-rejet-de-juge-prendre-de-la-hauteur
description: "Au 2e rejet d'un juge sur un lot, on prend de la hauteur (redécouper, inventorier la classe) au lieu d'enchaîner les rondes ; chaque grief se traite comme une famille"
metadata:
  type: user
---

**Verbatim (2026-10-28)**, en apprenant qu'un lot en était à son 6e juge : « 6ieme juge ? Je pensais qu'a partir du 2ieme juge on prenais de la hauteur plutot que se taper 4 autres juges sur la même choses ? »

**Verbatim (2026-10-28)** : « le juge te dit "tu as oublié ca", le codeur corrige, puis le juge te dit "tu as aussi oublié ca", et ca 4 fois de suite, plutot de se dire "et j'ai oublié quoi d'autres ?" »

**Why :** des rejets répétés signalent un lot mal découpé ou une classe non inventoriée, pas un correctif manquant.

**How to apply :**
- Deux rondes au plus ; au 2e rejet, diagnostiquer pourquoi ça ne converge pas, puis redécouper le lot ou réduire ce qu'il prétend fermer (`orchestrer-des-agents`, point 3).
- Avant de coder un lot de classe, l'inventorier par script (`git grep`, parcours de schéma) et joindre l'inventaire aux briefs du codeur et du juge.
- Chaque grief est le symptôme d'une famille : le codeur balaie « qu'ai-je oublié d'autre du même genre ? » et rend l'inventaire (commande et sortie) avec sa ronde.
