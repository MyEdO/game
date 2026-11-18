---
name: user-doctrine-maquettes-font-foi-godot-s-adapte
description: "Les nouvelles maquettes de l'interface font foi : le contrat noyau → Godot et l'hôte Godot s'adaptent à elles (ajouter, modifier, supprimer), jamais l'inverse"
metadata:
  type: user
---

**Verbatim (2026-11-18)** : « Ce que je veux dire que c est que godot n est pas encore adapté à notre nouvelle maquette, cela va demander du travail pour ajouter ce qui manque, modifier l existant et supprimer l inutile. Et c est notre nouvelle interface qui nous a permis d identifier ces lacunes » ; et : « a terme on pourra facilement generer ses données depuis Godot et tester des écrans facilement avant d impacter notre jeu et surtout facilement passer de maquette à intègre au jeu ».

**Verbatim (2026-11-18)** : « Tant que les propositions suivent les règles et embellissent le jeu tout en étant cohérent avec les autres systèmes… ».

**Verbatim (2026-11-18)** : « Tu peux tout à fait générer la trame Godot et opposer la trame cible pour aider à la migration si on valide les écrans, mais pas de brancher directement au noyau ».

**Why :** les maquettes ont révélé ce que le contrat et l'hôte ne portent pas.
**How to apply :**
- D'abord les maquettes : noyau, contrat et Godot ne changent qu'après validation des écrans ([[user-doctrine-le-jeu-envoie-des-donnees-pas-leur-affichage]]).
- Une maquette est autonome : aucun import du jeu, même de type, aucune capture de ses planches.
- Son JSON porte les données (valeurs, ids, états, mots), jamais la disposition, qui vit au rendu.
- Après validation, la trame que le jeu produit s'oppose à la trame cible pour guider la migration.
- Elle montre la cible des livres, même non jouée par le moteur.
Voir [[user-doctrine-maquettes-en-16-9]].
