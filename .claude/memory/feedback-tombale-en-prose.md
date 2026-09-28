---
name: feedback-tombale-en-prose
description: "La pierre tombale se glisse dans la PROSE (fiches, docs, briefs) où aucune garde ne scanne — une mention de suppression n'est de la connaissance que si elle passe DEUX tests."
metadata:
  type: feedback
---

Verbatim utilisateur : « Tu met des pierres tombales ? ». `src/comment-poison-guard.test.ts` ne scanne que les COMMENTAIRES de `src/**` et `scripts/guards/lib/**` : la prose est son angle mort, et c'est là que le réflexe est le plus fort — quand on CORRIGE un écrit, on veut expliquer ce qu'on corrige.

**Why:** le lecteur de demain n'a que faire du delta, il lui faut l'état courant ; git porte l'histoire d'une fiche comme celle du code.

**How to apply:** garder une mention de suppression seulement si (1) le piège SURVIT à la suppression — ce qui se recrée est un GESTE, jamais un identifiant que personne ne retapera — et (2) il n'est consigné nulle part ailleurs (CLAUDE.md, credo, doc vivante, garde). Sinon supprimer ; si la connaissance porte mais que la formulation narre, la convertir en CONTRAT POSITIF au présent.
