---
name: feedback-jet-equals-action
description: "Coût d'un acte de combat quand le RAW est muet : un jet = une Action ; pas de jet = juste du Mouvement."
metadata:
  type: feedback
---

Mots de l'utilisateur (au plus tard le 2026-07-16) : « tout jet indique que c'est une Action », « sinon c'est juste du mouvement non ? ».

**Why:** ça comble les silences du livre par un critère objectif et vérifiable, sans rien inventer.

**How to apply:** l'acte exige un Test ⇒ Action (`battle.acted`) ; aucun Test ⇒ budget de Mouvement (`battle.movementUsed`, ex. `battleMount`/`battleDismount`). Ce critère ne renverse JAMAIS une exception canon explicite (Piétinement gratuit, Viser = Action sans jet).
