---
name: feedback-5e-regle-absente-ecartee
description: "Monde Foundry — une règle 5e sans AUCUN support dans le système s'écarte au lieu de se construire ; on corrige ce qui existe et qui est faux"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ac141400-e348-4fc8-af3c-169f74f555f3
  modified: 2026-09-16T21:14:34.649Z
---

Bascule 5e du monde Foundry : une règle 5e sans aucun support dans `wfrp4e.js` s'écarte.

> Verbatim utilisateur (2026-09-16), devant la Dissipation (`11 l.290-296`) : « Oublie si ca n'existe pas »

**Why :** la bascule est un travail de *correction*, pas de développement de système. Une règle
absente demande une brique entière (affordance de chat, test opposé, portée, cadence par round) qui
vivrait en runtime, à rejouer à chaque séance. Une règle **présente et fausse** se corrige pour un
coût sans rapport.

**How to apply :** avant de proposer une règle 5e manquante, mesurer si le système la porte, même
mal (`grep` du concept dans `wfrp4e.js`) :
- présente et fausse → on corrige ;
- présente sous un autre nom / un réglage optionnel → on bascule le réglage (persistant) ;
- **absente de bout en bout → on écarte**, en consignant au journal de reprise *ce qu'il aurait
  fallu construire* et *pourquoi c'est disproportionné*.

Écartées de même : interruption et dégâts en focalisant (`11 l.207`, `11 l.213`).

Voir [[feedback-5e-retirer-le-4e]] et
[[env-foundry-jet-sans-modale]].
