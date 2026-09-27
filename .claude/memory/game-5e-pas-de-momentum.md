---
name: game-5e-pas-de-momentum
description: "Bascule 5e — le Momentum n'est pas implémenté, le monde garde l'Avantage de groupe 4e"
metadata: 
  node_type: memory
  type: project
  originSessionId: ac141400-e348-4fc8-af3c-169f74f555f3
  modified: 2026-09-16T12:42:37.294Z
---

Le **Momentum** 5e (`08 - Rules.md` l.1603-1621) **n'est pas repris** sur le monde « Campagne
Impériale Mercredi » : il reste sur l'**Avantage de groupe** 4e (`useGroupAdvantage` à `true`,
réserve partagée par camp ; `autoFillAdvantage` à `false`, pas de +10 automatique).

Verbatim utilisateur, 2026-09-16 : « Pas de Momentum, on reste sur les avantages de groupe. »

**Conséquences :**
- « Peur : tu ne gagnes plus de Momentum » se lit « tu ne génères plus d'Avantage pour ton camp » ;
- Talents et Traits 5e qui *dépensent* du Momentum (`08 - Rules.md` l.1556) : arbitrage MJ.

Écart **assumé**, pas un mélange involontaire
([[feedback-5e-retirer-le-4e]]).

**Faux ami :** l'**Advantage 5e** (`08 - Rules.md` l.67-69 : inverser les chiffres du dé) est une
AUTRE mécanique, DÉJÀ BASCULÉE — ne pas la reproposer. Elle vit dans `5e — Canal unique (DR et
inversion)` : `game.wfrp4e.inverser5e(data, ±1)`, solde `data.__solde5e`, consommé par
`preData.reversal` (`wfrp4e.js` l.7645-7698). L'arbitrage ne porte que sur la **réserve**.
