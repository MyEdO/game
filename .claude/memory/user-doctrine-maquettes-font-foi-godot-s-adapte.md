---
name: user-doctrine-maquettes-font-foi-godot-s-adapte
description: "Les nouvelles maquettes de l'interface font foi : le contrat noyau → Godot et l'hôte Godot s'adaptent à elles (ajouter, modifier, supprimer), jamais l'inverse"
metadata:
  type: user
---

**Verbatim (2026-11-18)** : « Ce que je veux dire que c est que godot n est pas encore adapté à notre nouvelle maquette, cela va demander du travail pour ajouter ce qui manque, modifier l existant et supprimer l inutile. Et c est notre nouvelle interface qui nous a permis d identifier ces lacunes » ; et : « a terme on pourra facilement generer ses données depuis Godot et tester des écrans facilement avant d impacter notre jeu et surtout facilement passer de maquette à intègre au jeu ».

**Verbatim (2026-11-18)**, sur ce qu'une maquette peut montrer au-delà du moteur : « Tant que les propositions suivent les règles et embellissent le jeu tout en étant cohérent avec les autres systèmes… ».

**Why :** les maquettes de `hotes/godot/cibles/propositions/` ont révélé ce que le contrat et l'hôte ne portent pas.
**How to apply :** une maquette se décrit dans la forme du contrat (`src/hote/elements.ts`, `src/hote/ecran.ts`) ; quand le contrat ne convient pas, c'est lui qui change, consommateurs Godot compris, et ce que Godot devra dessiner autrement devient un ticket. Un seul schéma, aucun format parallèle propre aux maquettes. Une maquette montre la cible des livres même quand le moteur ne la joue pas encore ; ce qu'elle ajoute doit suivre les règles, embellir le jeu et rester cohérent avec les autres systèmes. Voir [[user-doctrine-maquettes-en-16-9]].
