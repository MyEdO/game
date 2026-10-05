---
name: user-doctrine-regle-ligne-de-tableau-adresse-le-tableau-entier
description: "Une règle du registre qui n'est qu'une ligne d'un tableau du livre adresse le TABLEAU ENTIER, jamais sa case"
metadata:
  type: user
---

**Verbatim (AskUserQuestion, 2026-09-28)** : « Le tableau entier (Recommandé) »

*Question posée (non-verbatim utilisateur) : que montre la fiche d'une règle qui n'est qu'une ligne de tableau ?*

Description de l'option choisie : « La fiche pointe vers l'endroit du livre, le tableau « Difficultés de Combat », et l'affiche en entier : la ligne de la règle y est, avec sa difficulté et son modificateur, au milieu des autres. Aucune nouvelle mécanique d'adresse. Le joueur doit repérer sa ligne parmi 35. »

**Why :** `regles` fait référence aux ENDROITS du livre (#1887, verbatim du 2026-09-22 : « via un lien et non un texte verbatine »). Une case isolée n'est pas un endroit que le livre imprime. Sa clé était d'ailleurs tirée d'une table mal extraite, dont les cellules fusionnées au PDF sont vides au Source.

**How to apply :** dans `regles`, une entrée dont le texte est une ligne ou une case de table porte l'adresse de la TABLE, légende comprise. Aucune adresse `cellule` dans cette famille (#1887 lot 6a-2). L'EXTENSION aux listes (une puce → la liste entière) est une évaluation d'ingénierie de l'orchestrateur, révisable, et non cet arbitrage. Les autres familles (mutations, ports, rangées de critiques) gardent leur case.
