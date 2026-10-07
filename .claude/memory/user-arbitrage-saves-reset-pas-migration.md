---
name: user-arbitrage-saves-reset-pas-migration
description: "Formats persistés (saves, roster, export de héros, calques, projets de l'éditeur) : aucune migration de chargement — une donnée d'une autre forme est refusée, jamais migrée"
metadata:
  type: user
---

**Verbatim (2026-08-17)** : « L'application n'est pas en prod, si tu perds du temps a faire ces migrations, je prefere que tu supprimer les données plutot que tu les migre »

**Verbatim 2026-10-05** (projets de l'éditeur) : « Pour le moment, comme les sauvegarde, applique ma régle »

**Verbatim 2026-10-05** : « J'étais sûre qu'a un moment j'avais demandé de ne pas gerer la retrocompatibilité sur les migrations pour le moment (on invalide tout et on recharge), histoire d'éviter tous ces conflits. »

**Why :** une donnée perdue coûte moins qu'une migration écrite, testée et maintenue.
**How to apply :**
- Aucune version écrite à la main ; une donnée d'un autre format est REFUSÉE avec message, jamais migrée.
- Projet de l'éditeur : le schéma zod seul. Format sans schéma : `version` = format dérivé du type (`src/state/formats.generated.ts`). IndexedDB déclarative ; dictionnaires validés au registre.
- Roster et export de héros jetés : évaluation d'ingénierie de game-32, révisable, aucun verbatim ne les couvre.
- Détail : `docs/architecture.md`, section FORMATS PERSISTÉS. À re-discuter à la mise en prod réelle.
