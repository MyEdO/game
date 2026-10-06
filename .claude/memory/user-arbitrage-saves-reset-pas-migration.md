---
name: user-arbitrage-saves-reset-pas-migration
description: "Formats persistés (saves, projets de l'éditeur) : aucune migration de chargement — une donnée d'une autre forme est refusée, jamais migrée"
metadata:
  type: user
---

**Verbatim (2026-08-17)** : « L'application n'est pas en prod, si tu perds du temps a faire ces migrations, je prefere que tu supprimer les données plutot que tu les migre »

**Verbatim 2026-10-05** (projets de l'éditeur) : « Pour le moment, comme les sauvegarde, applique ma régle »

**Why :** une donnée perdue coûte moins cher qu'une migration écrite, testée et maintenue à chaque changement de forme.
**How to apply :**
- Aucun numéro de version ne s'écrit à la main.
- Projet de l'éditeur (bibliothèque, import, autosave) : le schéma zod (`projetSchema`, `sceneSchema` pour une scène d'autosave) est le SEUL contrôle de forme ; le document ne porte aucun champ de version. Une autre forme est REFUSÉE avec son rapport, AFFICHÉE, jamais retirée automatiquement : la suppression reste un geste de l'auteur (#2404).
- Le contenu commité (`src/scenes/**`) se réécrit dans le MÊME commit que le changement de forme (générateur, ou script one-shot non commité).
- Un changement de SENS à forme égale RENOMME sa clé (précédent #1507, `radiusM`).
- Save de partie : une save d'une autre version se jette avec un message clair au joueur ; aucune chaîne de migration ni fixture golden.
- À re-discuter à la mise en prod réelle.
