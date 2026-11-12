---
paths:
  - "hotes/godot/projet/project.godot"
  - "hotes/godot/projet/scenes/**"
  - "hotes/godot/projet/scripts/**"
  - "hotes/godot/projet/recettes/**"
  - "src/noyau/monde/volume/**"
  - "src/noyau/lumiereDeLaScene.ts"
---

# Rendus de l'hôte Godot

- **Deux rendus, un seul jeu de scènes** (#3951) : Forward+ hors d'une page, où la carte graphique le permet, le rendu de compatibilité dans la page ou en repli (`rendering/renderer/rendering_method`, `project.godot`). Ce qu'un seul des deux porte se décide à un seul endroit, `Lumiere.rendu_complet`, sur le rendu en cours, et ses valeurs vivent dans la ressource (`scenes/Lumiere.tscn`) : jamais une scène, un script ni un matériau par rendu. Tout changement de l'image se recette sous les deux (`npm run godot:rendus`, recette `const RECETTE_RENDUE := true`), et la page reste ce qu'elle était.
- **Aucune lampe ne reçoit l'ombre d'un luminaire ; une lampe portée, celle d'aucun corps** (#3811) : ce qui porte une lampe la masquerait. Le noyau marque `luminaire` les surfaces d'un décor qui éclaire, que `VolumeDeScene` range sur `COUCHE_DES_LUMINAIRES`, exclue de toute lampe ; les corps vivent sur `MontageDeComposition.CALQUE`, qu'exclut la lampe d'une source portée (clé `portee/<id>`). Un porteur de lumière neuf (véhicule, monture) reçoit sa couche de même, jamais une lampe sans ombre.
- **Le projet s'importe sur un seul fil** (`editor/import/use_multiple_threads=false`, `project.godot`, #3951) : l'import en plusieurs fils ne se rétablit pas. Garde `hotes/godot/polices.hors-store.test.ts`.
