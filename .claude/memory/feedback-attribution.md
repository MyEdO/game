---
name: feedback-attribution
description: "Toute attribution (export mort, rouge de suite, fichier modifié) se prouve sur l'arbre COMMITTÉ — jamais par le dernier toucheur, l'isolation ou le nom"
metadata:
  node_type: memory
  type: feedback
---

**Règle :** une attribution se prouve par une sonde discriminante sur l'ÉTAT COMMITTÉ, jamais par « dernier toucheur », « vert en isolation » ou l'allure d'un fichier.
**Why:** `git log -S` rend le dernier commit qui a TOUCHÉ la chaîne, pas celui qui a tué le dernier consommateur ; et une garde à masque (baseline, ignore-flag, tolérance) fait porter son retard au premier lot qui la réveille — le déclencheur n'est pas le coupable.
**How to apply:** symbole mort → mesurer sa naissance puis le retrait du DERNIER consommateur ; rouge de suite → rejouer le détecteur de la garde sur un `git archive <rev>` extrait, l'isolation ne discriminant ni un cliquet agrégé ni une garde à liaison d'ordre ; appartenance d'un fichier → `git diff <fichier>`, jamais son nom ni une ligne d'inventaire d'agent ; demander si la garde a un masque avant d'accuser un lot ; un blame qui accuse une autre session se vérifie au grep sur les shas AVANT d'être énoncé et se corrige au message de commit suivant s'il est réfuté.
