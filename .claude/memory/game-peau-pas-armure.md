---
name: game-peau-pas-armure
description: "Le CORPS d'une créature (peau, écailles, griffes) n'est pas un OBJET : les règles qui nomment « une armure » ou « une lame » ne s'y appliquent pas."
metadata:
  type: project
---

Correction utilisateur (2026-08-10) : « quand l'Armure parle de peau épaisse, c'est la peau de l'acteur, pas une armure de peau a ignorer ».

**Why:** le RAW énonce les deux natures sous un même trait (`LDB 85 l.33` Arme, « ou utilise ses dents, griffes » ; `l.39` Armure, « ou une peau épaisse ») — la frontière est celle de la source, pas un modèle plaqué.

**How to apply:** toute couture qui nomme l'objet (Perforante `LDB 62 l.270`, Taille `l.307`, Déviation Critique `LDB 63 l.28`, piège-lame, désarmement, usure) exclut le corps — par la DONNÉE existante (`appearance.armurePortee` = porté vs corps ; `TraitInstance.natural`), jamais par une exclusion accumulée au cas par cas (patron à généraliser : `nonDeviatableMutationAP`, `src/engine/items.ts`). Ce qui est manufacturé devient un vrai `ItemInstance` (patron `weaponFromTrait` / `conjuredWeapons.ts`) ; attention au double-compte du Bonus de Force (l'Indice du trait Arme l'inclut déjà, `LDB 85 l.35`), et `armurePortee` ne dit JAMAIS le matériau.
