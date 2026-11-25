---
name: user-doctrine-campagne-jamais-generee-par-script
description: "Une campagne est MANUSCRITE et éditable : un générateur de projet de campagne est un défaut"
metadata:
  type: user
---

**Verbatim (2026-08-31)** : « une campagne doit pouvoir etre modifié depuis l'éditeur, et donc si la campagne est généré par un script, c'est un énorme défaut, car ca veux dire qu'aucune modification n'est possible. »

**Why :** la garde byte-stable (`projets/jeu-de-role/suites/generateurs-byte-stables.test.ts`) fait du générateur le propriétaire exclusif de son paquet — toute édition à l'éditeur est écrasée ou refusée, l'inverse de la règle stricte 2.
**How to apply :** jamais de générateur pour un projet de campagne — le contenu se pose à l'éditeur et le paquet est manuscrit ; un générateur ne se justifie que pour du contenu CALCULÉ non authorable à la main ; « enrichir un JSON manuscrit par script » est interdit, c'est l'un OU l'autre.
