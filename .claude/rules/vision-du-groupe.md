---
paths:
  - "src/noyau/visionDuGroupe.ts"
  - "src/noyau/effetsDeLAppel.ts"
  - "src/hote/projection.ts"
  - "src/hote/ecran.ts"
  - "src/hoteTexte/**"
  - "hotes/godot/pont/pont.ts"
  - "hotes/godot/recette.mjs"
  - "hotes/godot/projet/art/monde.gdshader"
  - "hotes/godot/projet/scripts/**"
  - "hotes/godot/projet/recettes/**"
---

# Vision du groupe

- **Une seule loi dit ce que le groupe connaît, au noyau** (`src/noyau/visionDuGroupe.ts`, #3950) : une case est vue, explorée ou inconnue. La projection, l'écran, l'hôte texte, les effets et le pont la lisent par ses lecteurs (`caseEnVue`, `combattantEnVue`, `corpsEnVue`, `porteurEnVue`, `caseDeZoneEnVue`, `entiteConnue`, `nomEnVue`, `visionDuMonde`), Godot par ce que le pont sert ; aucun ne relit `computeStateVisible` ni ne compare une case lui-même (le rendu web, `src/gameIso`, a sa propre lecture).
- **Elle dit ce qui se MONTRE, jamais ce qui se joue** : `cibles`, `apercu` et `occupants` gardent les combattants hors de vue, leur case reste cliquable sans corps ni nom (`docs/raw/4e/combat.md`, « Combat rapproché dans le noir »).
- **La vue ne nomme que ce qui est en vue** : `voisins`, `corps`, `marques`, l'ordre du tour, `exploration.entites` ; `combat.actif` et `combat.tour` valent `null` quand l'actif ne l'est pas. Les zones de l'écran (ordre, barre, fenêtres, aperçu, fiche, offres) nomment un combattant par `nomEnVue` (le texte du moteur : #4017).
- **Godot ne décide rien** : un nœud que la vue ne nomme plus quitte l'arbre ; les morceaux, les toits et les couronnes se voilent par la texture de `vision` (`VolumeDeScene.voir`, `art/monde.gdshader`), rappelée quand `vue.vision` change, et un mur prend l'état de la meilleure des cases qu'il sépare (`AreteDessinee.cases`, `_teindre`) ; l'éditeur et l'atelier n'appellent pas `voir`.
- **Une zone se montre par ses cases `caseDeZoneEnVue`** (une zone qui coupe la vue se montre entière dès que le groupe en voit le bord), sous la clé de la zone entière ; une source portée hors de vue n'est pas servie, une source posée hors de vue garde sa lampe sans `visuel` ni `son` (`lumiereDeLaScene`).
- **Un effet peut n'avoir pas d'auteur** (`de`, `depart`, `trajet` à `null`, auteur hors de vue) : seule son arrivée ou sa nappe joue (`Effets._partir`).
- **La case d'une cible se lit dans `casesDesCibles`**, jamais dans `occupants` (une case, un seul id) ni dans `voisins` (les seuls en vue).
- Recettes : `projet/recettes/vision-du-combat.gd` (headless, `godot:sonde`), `projet/recettes/voile-de-la-vision.gd`, `voile-du-bati.gd` et `aretes-en-instances.gd` (rendu réel sous les deux rendus, `npm run godot:rendus`), parcours `vision` (`grimpant`) et `murs` (`zones-pieces`) de `hotes/godot/recette.mjs` (export Web).
