---
name: user-doctrine-format-unifie-reextraction-permise
description: "Toutes les extractions de Source/ ont UN format ; un livre hors format se RÉ-EXTRAIT (clause « un livre en service ne se ré-extrait plus » de #1388 §2.1 levée le 2026-09-14)"
metadata:
  node_type: memory
  type: user
---

Verbatim utilisateur (2026-09-14, épique #1388, Lot B) : « Il faut un format unifié pour toutes les extractions, donc s'il faut rééxtraire, on rééxtrait »

Verbatim utilisateur (2026-09-20, #1836 → #1739, devant des sujets posés sur des niveaux de heading différents selon le livre) : « Surtout qu'on peut modifier la source dans son format, on ne doit pas se plier au format de chaque livre, mais migrer les livres dans le même format » — puis : « On a un vrai chantier dans l'épique sur les sources, il faut absoluement éviter de le saboter en prenant des décisions contradictoires » — puis : « Mais oui pour ce qui est de la source, le format unique sur tous les livres est super important. Il est interdit de réécrire le texte. On peut réparer le texte s'il est tronqué/mélangé car l'extraction n'est pas parfaite. »

**Why:** les 16 livres FR ont été extraits à des dates et avec des chaînes différentes (en-têtes de folio, ancres, tables) ; corriger à la main un livre hors format, c'est entretenir N formats — l'objectif est UN format, celui du pipeline documenté (`docs/ajouter-un-livre-source.md`, Marker paginé + découpeur câblé à `nomAscii`).

**How to apply:** avant de corriger un chapitre à la main, vérifier que son livre est au format canonique ; sinon, ré-extraction du livre (session qui tient Marker, en série, sous `Source/_marker/`), puis `reanchor --apply --remap` + `reparer-adresses` + stocks régénérés dans le même commit ; la correction manuelle au PDF ne porte que sur le résidu que la chaîne canonique ne sait pas produire. Un défaut de format trouvé depuis un AUTRE chantier se dépose en FAITS sur #1739, qui tranche : ni clause, ni régime de garde, ni ordre de trains décidés d'ailleurs.
