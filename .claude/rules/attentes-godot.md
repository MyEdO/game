---
paths:
  - "hotes/godot/projet/scripts/**"
  - "hotes/godot/projet/recettes/**"
---

# Attentes des scripts Godot

- **Une attente qui reprend sur un noeud sorti de l'arbre ne touche ni l'arbre, ni le pont, ni l'écran** (#4195) : ce qui lance un chargement (`await` d'une lecture du pont, d'un fichier choisi ou d'un montage) tient un jeton, le jette à sa sortie de l'arbre (`_exit_tree`), et sa reprise au jeton périmé libère ce qu'elle a reçu et rend la main (`Combattant.vetir`, `_en_vol` ; `MontageDesNavires._monter`, `_montes` ; les attentes d'un écran au pont, `_en_vol` de `editeur.gd` et de `combat.gd`). Jamais un `is_inside_tree()` semé au site de la reprise. Une attente d'image (`process_frame`) n'est pas un chargement : la publication de l'écran la porte (`PublicationDeLEcran.demander`). Recette `hotes/godot/projet/recettes/sortie-de-l-arbre.gd`, un passage par porteur.
