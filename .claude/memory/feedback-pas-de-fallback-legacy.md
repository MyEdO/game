---
name: feedback-pas-de-fallback-legacy
description: "Un fallback qui fait VIVRE un comportement legacy (résoudre un id dans l'ancien foyer PUIS le nouveau, retomber sur le label) est interdit — le legacy se SUPPRIME."
metadata:
  type: feedback
---

Verbatim utilisateur : « Je n'aime pas les fallback qui pousse a garder un comportement legacy, dans parfois l'utilisation de label interdit ».

**Why:** investir du code pour faire vivre un modèle que le programme élimine est de la dette : le fallback masque une migration incomplète et ré-introduit souvent la résolution par label.

**How to apply:** supprimer les fonctions mortes et les champs de conflation, remplacer la référence par une réf TYPÉE résolue directement ; une régression transitoire ASSUMÉE est préférable au legacy propé.
