---
name: user-doctrine-specs-par-specssource-jamais-en-dur
description: "Un champ à spécialisations déclare un `specsSource` de l'union fermée `SpecsSource`, jamais un pool d'ids en dur"
metadata:
  type: user
---

**Verbatim (2026-07-26)** : « Si un jour tu propose un pool de specs, rien en dur sachant qu'on a un système pour faire références a un ensemble de spec. »

**How to apply :** un champ à spécialisations déclare un `specsSource` pris dans l'union fermée `SpecsSource` (`src/data/index.ts:941`), ou y ajoute un pool, jamais une liste d'ids recopiée. Traquer une logique par libellé balaie chaque champ frère (`type`, `subType`, `kind`) : un commentaire i18n-safe n'est pas une preuve.
