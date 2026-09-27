---
name: game-conflit-raw-5e-description-etat-prime
description: "WFRP 5e — quand la table des modificateurs de combat contredit la description d'un État, la description gagne"
metadata: 
  node_type: memory
  type: project
  originSessionId: ac141400-e348-4fc8-af3c-169f74f555f3
  modified: 2026-09-16T12:14:56.421Z
---

Le livre 5e se contredit entre les tables de modificateurs de combat (`08 - Rules.md` l.1497-1515) et
les descriptions d'États (l.2258-2335). Arbitrage utilisateur : **c'est la description de l'État qui
fait foi.**

Verbatim utilisateur, 2026-09-16 : « En cas de conflit, c'est la description de l'état qui gagne. »

Cas connus au moment de l'arbitrage :
- **Surpris** — table l.1512 : « Target is Surprised (+1 SL) » ; description l.2334 : « Any opponent
  trying to strike you in melee gains a bonus of **+2 SL** » → **+2 DR** en mêlée.
- **À terre** — table l.1513 : « Target is Prone (+1 SL) » ; description l.2322 : « Melee Attacks
  against you benefit from **Advantage** » → **Avantage** (inversion du dé), pas un modificateur.

**Why:** sans règle de préséance, chaque État contradictoire redevient un arbitrage ponctuel, et le
monde dérive vers un mélange d'éditions — ce que [[feedback-bascule-5e-retirer-le-4e-pas-seulement-ajouter-le-5e]]
interdit.

**How to apply:** avant de coder un modificateur tiré d'une table de combat, ouvrir la description de
l'État concerné ; si elle dit autre chose, c'est elle qu'on implémente, et on retire la valeur issue de
la table.
