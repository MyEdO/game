---
paths:
  - "hotes/godot/projet/scripts/**"
  - "hotes/godot/projet/recettes/**"
---

# Attentes des scripts Godot

- **Une attente qui reprend sur un noeud sorti de l'arbre ne touche ni l'arbre, ni le pont, ni l'écran** (#4195) : ce qui lance un chargement (`await` d'une lecture du pont ou d'un montage) tient un jeton, le jette à sa sortie de l'arbre (`_exit_tree`), et sa reprise au jeton périmé libère ce qu'elle a reçu et rend la main (`Combattant.vetir`, `_en_vol`). Jamais un `is_inside_tree()` semé au site de la reprise. Recette `hotes/godot/projet/recettes/sortie-de-l-arbre.gd`.
