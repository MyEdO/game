---
name: env-arbre-principal-en-retard-mesurer-sur-un-worktree-frais
description: "L'arbre principal local peut être des dizaines de commits derrière origin/main (personne ne le tire sous le régime des chantiers) — tout lecteur ou toute mesure de grounding se dispatche sur un worktree de chantier frais, jamais sur l'arbre principal"
metadata: 
  node_type: memory
  type: project
  originSessionId: a0dfb696-da2e-4137-ae4b-32ad3e05ed77
  modified: 2026-09-21T13:23:25.282Z
---

Sous le régime « un lot = un chantier », plus personne ne tire l'arbre principal `Foundry/Game` : il reste à la tête du dernier geste qui y a touché. Un lecteur dépêché dessus mesure un dépôt PÉRIMÉ et rend des faux zéros crédibles.

**Why :** un retard d'une quarantaine de commits suffit à faire rendre « ABSENT » un dossier qu'`origin/main` versionne par centaines de fichiers (lecteur de #1343). `git rev-parse HEAD origin/main` côte à côte le dit en une ligne.

**How to apply :** à l'ouverture d'un lot, `git fetch` puis comparer `HEAD` de l'arbre principal à `origin/main` ; ouvrir le chantier (`npm run ops:chantier -- <N>`) AVANT le grounding et donner au lecteur le chemin ABSOLU du worktree, avec l'interdit explicite de lire l'arbre principal. Ne jamais « réparer » l'arbre principal par un `git pull` à la main ([[feedback-un-lot-un-chantier-jamais-de-git-a-la-main]]). Voir aussi [[env-coordination-arbre-partage-sessions]].
