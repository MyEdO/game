---
name: creer-un-personnage-3d
description: Produire depuis une illustration un élément 3D du jeu (GLB et manifeste schéma 3 sur la base imposée). Pas pour les rigs SVG ni les règles.
---
<!-- GENERATED: agents:sync; source=.claude/skills/creer-un-personnage-3d/SKILL.md -->

# Produire un élément 3D

Lire et suivre **`docs/creer-un-personnage-3d.md`** : prérequis mesurés, choix catégorie/clé,
fichier de données, construction, export, validation du manifeste, évaluateur et revue.
Les contrats exécutables sont `hotes/godot/asset/element.ts` et
`hotes/godot/asset/evaluateur/manifesteDeBase.ts`.

Valider le manifeste et son GLB par **`npm run godot:valider -- <element.json> <base.json> <element.glb>`**.
Mesurer l'élément monté par **`npm run godot:evaluer -- <element.glb> --base <base.glb> --manifeste <base.json>`** ;
utiliser `--facteurs sl=1,legs=1,arms=1,head=1,st=1` et `--silhouettes feminin=1,corpulence=1`
avec les valeurs de la matrice requise. La procédure précise les commandes et leurs limites.

Produire **un GLB et un manifeste schéma 3 par (base, clé)**, avec source éditable et provenance.
La base et ses clips doivent avoir passé leur porte d'animation avant construction. Ne jamais
substituer un rig personnel, morpher un corps par personnage ou réparer la base dans un élément.
Construire avec `scripts/personnage-3d/`, une pièce à la fois ; interroger le porteur et emprunter
ses poids. Les requêtes Blender servent à construire ; seule la mesure Node valide.

Pour un personnage, répartir trois agents à fichiers et sorties disjoints : tête/pilosité ;
corps/vêtements/armure ; rigides/accessoires. Borne de chaque build : moins de 270 s.
Après deux échecs du même défaut, changer de méthode avant une troisième retouche.

Interdits : générateur image → 3D, retopologie automatique, illustration projetée en texture,
coque moulée pour un vêtement de silhouette, couleur cuite, mouvement des chaînes recalculé par l'hôte.
Une couleur appartient à la palette ou à la teinte, jamais à une variante de géométrie.

Statut **NON VÉRIFIÉ par défaut**. Un juge neuf statue par signe identitaire ; la revue utilisateur
consigne verbatim et date dans la provenance avant d'entériner l'élément. Ni un rendu Blender,
ni un évaluateur vert sur ses seules gardes présentes ne prouvent le fini dans Godot.
Pour un défaut visible, lire le cas ciblé dans [diagnostics](references/diagnostics.md).
