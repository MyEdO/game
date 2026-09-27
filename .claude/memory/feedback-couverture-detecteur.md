---
name: feedback-couverture-detecteur
description: "Le chiffre d'un détecteur mesure SA COUVERTURE, jamais la taille de la classe — un chiffre bas est plus suspect qu'un chiffre haut, et la règle vaut pour mes propres sondes"
metadata:
  node_type: memory
  type: feedback
---

Avant de dimensionner quoi que ce soit sur un chiffre d'outil, demander « que ne peut-il PAS voir ? ». Le taux d'angle mort compte autant que le résultat, et un chiffre BAS (« 1 seul cas sur 2082 ») déclenche la question de couverture, jamais le soulagement.

**Why:** un chiffre hérite des angles morts de l'outil qui le produit ; une sonde plus étroite que sa conclusion ne le signale jamais (`Object.keys()` sur une `Map`, un grep en guillemets doubles sur du code qui cite en simples) — un « 0 » a exactement la même tête qu'un vrai zéro.

**How to apply:** toute affirmation d'absence porte SA commande et SON périmètre exact, et se re-mesure par une méthode DIFFÉRENTE avant d'être rapportée (une convergence ne vaut vérification que si les méthodes diffèrent) ; une conclusion de PORTÉE (« ça ne pèse sur rien d'autre ») ne se tire jamais d'un détecteur, et l'écrire dans le code est du poison durable ; tout brief de mesure demande le DÉNOMINATEUR et l'ANGLE MORT ; ne jamais mesurer pendant qu'un agent tient une preuve par mutation ; une preuve par mutation mute un cas délibérément ATYPIQUE.
