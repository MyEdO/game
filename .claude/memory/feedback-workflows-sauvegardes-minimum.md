---
name: feedback-workflows-sauvegardes-minimum
description: "Un workflow sauvegardé (.claude/workflows) n'existe que s'il est une MÉTHODE réellement lancée ; juger ou revoir se fait par des agents dépêchés, pas par un workflow sauvegardé"
metadata:
  type: feedback
---

Verbatims de l'utilisateur :
- 2026-09-11 : « supprime moi ce worfklow plutot » (`revue-palier`).
- 2026-09-28 : « Mince, je pensais qu'on avait supprimé les worktree de juge et de l'audit poison, preferant utilisé les agents », puis le choix « Supprimer les deux (Recommandé) » (`juge-design-socle`, `audit-poison`).

**Why:** chaque workflow sauvegardé entre sous la garde de forme (`scripts/ops/workflows.test.mjs`, `scripts/guards/lib/jouer-workflow.mjs`) et ses bancs (`scripts/ops/workflows-joues.test.mjs`). Chacun coûte donc à chaque revue et à chaque évolution de la garde. `audit-poison`, que plus rien ne lançait, a été corrigé trois fois pendant #1993.

**How to apply:**
- On ne sauvegarde un workflow que s'il porte une méthode lancée pour de vrai et de façon répétée : l'atlas RAW, `dossier-de-chapitre` et `table-simulee` pour chaque chapitre.
- Une revue ou un jugement se fait par des agents `juge` dépêchés, ou par un workflow inline non sauvegardé.
- Avant de corriger un workflow sauvegardé, vérifier qu'un consommateur le lance encore (skill, doc). S'il est orphelin, proposer sa suppression.
- Voir [[feedback-garder-objectif-macro]].
