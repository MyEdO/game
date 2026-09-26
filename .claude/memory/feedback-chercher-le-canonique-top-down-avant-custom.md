---
name: feedback-chercher-le-canonique-top-down-avant-custom
description: "Monter au CONCEPT et chercher le mécanisme canonique (et les CHAMPS des ops existantes) avant toute conception — jamais imiter le mécanisme voisin"
metadata:
  node_type: memory
  type: feedback
---

**Règle :** avant toute conception, monter du symptôme local au CONCEPT (« comment ce genre de chose est-il modélisé ? ») et chercher le canonique : `docs/vocabulaire-mecanique.md` (ops ET leurs champs), `docs/index-moteur.md`, `docs/primitives.md`.
**Why:** un cas trouvé par voisinage est un cas trouvé par imitation — c'est ainsi qu'on obtient deux instances du même bug au lieu d'une ; un drapeau ou une capacité NEUVE sur une entité est suspect par défaut.
**How to apply:** ne nommer un cas canonique qu'après avoir lu la LISTE DES CHAMPS de l'op concernée (`src/engine/ops.ts`) et demandé « quel champ existant dit déjà cela ? » ; ce qui est spécifique à un porteur alors que le concept est général est un trou de socle à remonter, pas une garde de donnée à poser ; un message de correction en vol porte la MÊME discipline qu'un brief complet (primitive nommée, ou absence prouvée par grep collé).
