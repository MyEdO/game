---
name: game-i18n
description: "Tout nouveau champ à spécialisations déclare un `specsSource` dérivé d'un registre — jamais un pool d'ids en dur"
metadata:
  node_type: memory
  type: project
---

Arbitrage utilisateur (2026-07-26, verbatim) : « Si un jour tu propose un pool de specs, rien en dur sachant qu'on a un système pour faire références a un ensemble de spec. »

**Why:** un champ libre n'a aucun pool derrière lui, donc aucune validation — on y écrit `"hysh"` en espérant que ça matche ; une spec adossée à `specsSource` est validée au chargement par le résolveur, qui échoue vite au lieu de normaliser.

**How to apply:** un porteur de spec choisit un pool existant de l'union fermée `SpecsSource` (`winds`, `arcaneDomains`, `weaponGroupsMelee`, `cultBlessings`, `groups`, `diseases`, `mutations`, `sizes`, `damageTypes`…) ou en AJOUTE un au catalogue — il ne recopie jamais la liste des ids. Quand on cherche des résidus de logique par libellé, sweeper CHAQUE champ frère (`type`/`subType`/`kind`) : un « i18n-safe » en commentaire est un drapeau rouge, pas une preuve.
