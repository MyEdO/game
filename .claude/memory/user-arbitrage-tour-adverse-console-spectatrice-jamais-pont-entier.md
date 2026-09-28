---
name: user-arbitrage-tour-adverse-console-spectatrice-jamais-pont-entier
description: "Hors du tour du joueur local, la console prend une forme SPECTATRICE — l'ARCHE SEULE, jamais le pont entier de l'adversaire"
metadata:
  type: user
---

**Verbatim (2026-08-24)** : « D'ailleurs même au tour de l'adversaire, pourquoi je vois son pont entier ? Même RT ne fait pas ca »

**Verbatim (2026-09-20)** : « moi je voulais que cela n'affiche que cette partie sans les barres gauche et droite pour les ennemies et avant le début du combat » — « cette partie » est l'ARCHE centrale (`ConsoleArch`) : portrait dans son arche, jauges MOUV. et ACTION, États, Blessures, nom.

**Why :** le changement de FORME porte le changement d'état (on regarde / on peut cliquer), et un arsenal ennemi navigable est une fuite d'information tactique. Pas un médaillon : l'arche telle quelle — une seule matière, jamais une seconde.

**How to apply :** tout tour non contrôlé par le joueur local (ennemi, IA, autre siège, auto-combat) ET l'ouverture rendent la forme spectatrice (`.combat-console[data-forme='spectatrice']`) : l'arche SEULE, sans barre de part et d'autre ; sets, grille de capacités, accès rapide, fin de tour et travées disparaissent. La BOÎTE de la bande reste — c'est elle qui tient l'arche immobile au pixel d'une forme à l'autre — sa MATIÈRE s'éteint (nappe, liseré, ombre). Blessures d'un hostile en teinte d'équipe, jauges du tour conservées, bandeau de phase centré au-dessus de l'arche (`data-phase='spectatrice'`), et hors de l'arche le clic tombe sur le plateau. Preuve : `scripts/recette/console-pont-formes.mjs`.
