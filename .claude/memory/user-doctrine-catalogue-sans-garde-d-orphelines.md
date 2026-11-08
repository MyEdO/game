---
name: user-doctrine-catalogue-sans-garde-d-orphelines
description: "Une entrée de catalogue (créature, trait, talent, table…) n'a pas besoin qu'une scène, une donnée ou du code la cite pour exister : aucune garde d'orphelines"
metadata:
  type: user
---

**Verbatim (2026-11-08)**, fil « Réintégrer le bestiaire Frenchy » : « cette garde existe encore ? Genre depuis quand faut qu'une creature doit etre sur une scene quand on propose un bestaire ? ... » puis « Mais vire moi cette régle sur les traits/creatures/talents et autres absurdité qui nous empeche de pauffiner notre catalogue ! »

**Why :** le catalogue sert l'étage du créateur de scénario (fiche de la vision produit en trois étages) : une entrée curée que rien ne pose encore est l'offre de l'éditeur, pas une dette.
**How to apply :**
- Aucun instrument ne refuse une entrée de `src/data` parce que nul consommateur ne la cite : ni garde, ni stock, ni rapport d'orphelines, quel que soit le catalogue.
- Une entrée reste soumise à tout le reste : source citée, schéma, règle 5, jouabilité (un sort ou un talent reste obtenable, `obtainability-guard`).
