---
name: user-doctrine-reference-rt-par-defaut-deviation-validee
description: "Le défaut de toute décision d'UI est ce que fait l'interface cible (Rogue Trader) ou le genre ; toute déviation exige une contrainte propre et une validation à l'écran"
metadata:
  type: user
---

**Verbatim (2026-08-24)** : « Franchement, on part d'une interface de Rogue Trader, on fait un jeu vidéo RPG, pourquoi on réinvente des trucs qui n'existent même pas dans notre interface cible ni dans aucun jeux video du genre ? »

**Rappel (2026-10-08)**, face aux trois questions d'arbitrage de #1703 sur la barre de combat : « Franchement je ne répondrais pas a ces questions. Les RPG ont deja leur réponse, je ne vais pas réinventer le fonctionnement d'un jeu vidéo ».

**Why :** un comportement absent de la cible ET du genre est presque toujours une erreur de goût ou une sur-interprétation de doctrine — c'est le pendant UI de « aucune invention de règles ».
**How to apply :** avant toute décision d'UI (rendu, geste, libellé, état vide/désactivé/refusé), la question obligatoire du brief est « que fait RT ici ? que fait le genre ? » et la réponse par défaut est la leur ; une déviation ne se justifie que par une contrainte propre (règle WFRP, a11y, coop) et passe par une validation utilisateur à l'écran avant commit ; un principe abstrait ne s'implémente jamais en inventant une forme, et une annotation de maquette n'est pas une spec de rendu. Une question d'UI dont la cible ou le genre ont la réponse ne se pose JAMAIS à l'utilisateur en arbitrage : on prend leur réponse, et seule la déviation lui revient, à l'écran.
