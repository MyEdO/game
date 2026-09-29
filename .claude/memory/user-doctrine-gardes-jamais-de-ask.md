---
name: user-doctrine-gardes-jamais-de-ask
description: "Aucune garde de hook ne DEMANDE (`ask`) : elle refuse avec une raison actionnable ou elle avertit ; un ajout d'exception de garde avertit et le juge de diff le tranche au verdict"
metadata:
  type: user
---

**Verbatim (2026-09-28)** : « Personnellement je veux pouvoir laisser les sessions fonctionner toute seule, donc les asks c'est tout ce que je ne veux pas »

**Verbatim (2026-09-28, choix sur l'ajout d'exception de garde)** : « Avertissement + juge de diff »

**Verbatim (2026-07-13, remplacé le 2026-09-28)** : « Je veux un hook qui me demande mon autorisation pour ajouter des elements aux exceptions » (message du commit `81e61c9d7`)

**Why :** un `ask` attend une réponse que personne ne donne quand les sessions tournent seules ; l'agent de fond reste « running » sans fin. Ce choix remplace la confirmation que `scripts/hooks/exception-add-guard.mjs` exigeait depuis la demande du 2026-07-13 : l'ajout n'est plus confirmé en séance, il est jugé au rendu.
**How to apply :** une garde rend `{ decision: 'deny', raison }` ou `{ contexte }` (`scripts/guards/lib/contratGarde.mjs`) ; garde de classe `modulesQuiDemandent` (`scripts/guards/lib/stdinHorsBorne.mjs`). Un ajout d'entrée ou une hausse de baseline dans une table d'exceptions de garde produit l'avertissement « ajout d'exception : le juge de diff doit le justifier au rendu », et `.claude/agents/juge.md` justifie ou refuse cet ajout dans son verdict.
