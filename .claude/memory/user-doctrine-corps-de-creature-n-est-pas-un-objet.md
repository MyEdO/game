---
name: user-doctrine-corps-de-creature-n-est-pas-un-objet
description: "Le corps d'une créature (peau, écailles, griffes) n'est pas un objet : une règle qui nomme une armure ou une lame ne s'y applique pas"
metadata:
  type: user
---

**Verbatim (2026-08-10)** : « quand l'Armure parle de peau épaisse, c'est la peau de l'acteur, pas une armure de peau a ignorer »

**How to apply :** une règle qui nomme une armure ou une lame (Perforante LDB 62 l.270, Taille l.307) exclut le corps (LDB 85 l.33, l.39) par la donnée (`appearance.armurePortee`, `TraitInstance.natural`), jamais par une exclusion au cas par cas ; `armurePortee` ne dit pas le matériau. Ce qui est manufacturé devient un `ItemInstance` (patron `src/engine/conjuredWeapons.ts`) ; l'Indice du trait Arme inclut déjà le Bonus de Force (LDB 85 l.35), il ne se recompte pas.
