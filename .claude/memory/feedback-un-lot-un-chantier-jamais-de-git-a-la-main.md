---
name: feedback-un-lot-un-chantier-jamais-de-git-a-la-main
description: "Chaque lot vit dans SON worktree (`ops:chantier`) et se publie par `ops:publier` ; deux lots dans un worktree = empreintes de docs fausses, conflits et git à la main que l'utilisateur ne supporte pas."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: cb6a1279-328c-45de-be20-fa4bac61ed81
  modified: 2026-09-14T19:56:00.836Z
---

Verbatim utilisateur (2026-09-14) : « Ca me rends dingue que tu ais a faire des commandes git sur la branche principale ». J'avais posé le fix du hook #1754 dans le worktree du train #1508 T3b-1 : les portes (empreinte des docs contre l'INDEX, revue de palier, solde) ont forcé patch, checkout, régénération, rebase et résolution à la main.

**Why:** tout geste git visible signale un outillage non utilisé (`ops:chantier`, `ops:publier --detache`). Les générateurs de docs lisent des LISTINGS : un fichier non suivi change le pied ; deux lots mêlés fabriquent des conflits évitables.

**How to apply:** lot urgent en cours de train → son propre chantier. Avant un commit qui ferme : solde et revue de palier STAGÉS dans une commande séparée (les gardes lisent l'index avant la commande). Sonde non suivie dans l'arbre → la ranger avant `ops:publier`. Voir [[feedback-jamais-git-surgery-arbre-partage-actif]].
