---
name: feedback-5e-retirer-le-4e
description: "Toute bascule d'une règle vers la 5e doit supprimer le comportement 4e, pas seulement poser le 5e à côté"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ac141400-e348-4fc8-af3c-169f74f555f3
  modified: 2026-09-16T12:14:00.877Z
---

Sur le monde Foundry « Campagne Impériale Mercredi », chaque règle portée en 5e doit **poser le
comportement attendu ET retirer celui de la 4e**. Un ajout sans retrait produit un monde hybride qui
n'existe dans aucune édition.

Verbatim utilisateur, 2026-09-16 : « Quand tu fais une modification, il est super important que tu
mette le comportement attendu de la V5 mais aussi que tu supprime l'état qu'on ne veut plus de la V4,
pour éviter d'avoir un mixe des 2. »

**Why:** le système wfrp4e implémente fidèlement la 4e ; une greffe 5e qui se contente d'ajouter
laisse les deux mécaniques actives et cumulées. Cas réel : la macro `5e — Taille` posait le +BF de la
5e sans neutraliser Dévastateur / Percutant / dégâts ×N de `OpposedTest.calculateOpposedDamage` —
les grandes créatures cumulaient les deux éditions.

**How to apply:** avant de déclarer une bascule faite, chercher dans `wfrp4e.js` toutes les coutures
qui implémentent la règle 4e correspondante (pas seulement celle qu'on a patchée), et vérifier qu'elles
sont neutralisées. Le vérificateur du monde doit porter un contrôle par couture retirée, pas seulement
par couture ajoutée. Voir [[game-5e-etat-prime]].
