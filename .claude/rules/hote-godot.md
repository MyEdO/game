---
paths:
  - "hotes/godot/**"
  - "src/data/rendus.json"
  - "src/data/sons/**"
  - "src/noyau/effetsDeLAppel.ts"
---

# Hôte Godot

- **L'atelier Godot montre tout ce que le jeu propose** : chaque modèle 3D quelle que soit sa famille, chaque clip d'animation, chaque effet visuel et chaque son. Ce que le jeu ajoute de montrable se montre dans l'atelier dans le même geste que son ajout, en lisant par le pont les catalogues que le jeu lit (les modèles servis, `vitrine` pour les effets et les sons), jamais une liste propre à l'atelier. Fiche `user-doctrine-atelier-godot-unique-catalogue-de-textures-unique`, recette `hotes/godot/projet/recettes/atelier-du-vehicule.gd`.
- **Ajouter ou changer un effet visuel ou sonore** : skill `ajouter-un-effet` (rendu en donnée, son CC0 épinglé, visuel Godot, atelier, recette).
- **L'atelier a une seule structure** (#3792). Le modèle se choisit en tête du panneau (listes « Corps » et « Véhicule ou engin »), jamais dans un onglet. Six onglets, un sujet chacun : Personnage (composition d'un corps : presets, axes, copie), Équipement (ce qui se monte sur le modèle posé et ses états : pièces, postes, Améliorations, emblème, voiles, sabords), Couleurs (la palette des surfaces posées), Animation (clips, lecteur, marche, et les actions du modèle posé comme « Attaquer »), Effets (la vitrine, indépendante du modèle posé), Outils (rechargement, aides, rapport). Un contrôle neuf entre dans l'onglet de son sujet ; aucun onglet ne naît pour un chantier.
- **Ce que l'atelier montre suit ce que le modèle posé offre, lu aux données** servies par le pont (manifeste, `surfaces`, clips du lecteur, réponse de `vehicule`), jamais un test sur l'id ou la famille du modèle. `_onglets_offerts` et `_adapter_les_onglets` (`atelier.gd`) portent la condition de chaque onglet et de chaque section ; un contrôle neuf y inscrit la sienne. Sans objet, il se cache, jamais grisé ni inerte.
- **Un libellé nomme ce que la donnée désigne pour tout modèle qui la porte** (« Étoffe principale », qui vaut pour un vêtement comme pour une voile), jamais une hypothèse de personnage.
- **Une particularité de famille** (voiles, sabords, rames, coupe par pont) se déclare au manifeste de son modèle, le pont la sert, l'atelier la range dans l'onglet de son sujet. La recette `atelier-du-vehicule.gd` prouve les onglets offerts d'un navire et d'un engin.
- **Le contrat du pont se documente dans le code** (#3816) : `hotes/godot/pont/CONTRAT.md` est GÉNÉRÉ (`npm run docs:contrat-du-pont`, jamais édité ni commité) depuis les blocs `@contrat <Section>` : une JSDoc par méthode de `methodes` (`pont.ts`, entrée et `@returns`), une par membre ou variante d'une déclaration marquée, `## @contrat` dans le `.gd` qui fait ce que décrit le paragraphe. Un champ, une clé de zone ou une méthode neuve porte sa propre JSDoc, en lignes courtes : jamais un paragraphe partagé qui énumère ses voisins.
