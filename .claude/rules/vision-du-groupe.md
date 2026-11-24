---
paths:
  - "src/noyau/visionDuGroupe.ts"
  - "src/noyau/effetsDeLAppel.ts"
  - "src/hote/projection.ts"
  - "src/hote/ecran.ts"
  - "hotes/texte/**"
  - "hotes/godot/pont/pont.ts"
  - "hotes/godot/recette.mjs"
  - "hotes/godot/projet/art/monde.gdshader"
  - "hotes/godot/projet/art/voile.gdshader"
  - "hotes/godot/projet/art/vision.gdshaderinc"
  - "hotes/godot/projet/art/brume-de-la-vision.gdshader"
  - "hotes/godot/projet/scripts/**"
  - "hotes/godot/projet/recettes/**"
---

# Vision du groupe

- **Une seule loi dit ce que le groupe connaît, au noyau** (`src/noyau/visionDuGroupe.ts`, #3950) : une case est vue, explorée ou inconnue ; l'air au-dessus d'une case vue l'est aussi, par sa colonne, jusqu'au premier sol (`computeVisible`). La projection, l'écran, l'hôte texte, les effets et le pont la lisent par ses lecteurs (`caseEnVue`, `combattantEnVue`, `corpsEnVue`, `porteurEnVue`, `caseDeZoneEnVue`, `entiteConnue`, `coquesEnVue`, `nomEnVue`, `visionDuMonde`), Godot par ce que le pont sert ; aucun ne relit `computeStateVisible` ni ne compare une case lui-même.
- **Elle dit ce qui se MONTRE, jamais ce qui se joue** : `cibles`, `apercu` et `occupants` gardent les combattants hors de vue, leur case reste cliquable sans corps ni nom (`docs/raw/4e/combat.md`, « Combat rapproché dans le noir »).
- **La vue ne nomme que ce qui est en vue** : `voisins`, `corps`, `marques`, l'ordre du tour, `exploration.entites` ; `combat.actif` et `combat.tour` valent `null` quand l'actif ne l'est pas. L'écran nomme un combattant par `nomEnVue`, le moteur et le noyau par `nomDe` (nommeur `nomEnVue`) ; la marque de `Combatant.label` en refuse le passage direct dans `t()` (#4017).
- **Le choix de la personne dans Colérique** peut proposer son dernier nom vu dans cette scène. La même liste s’applique lorsque le joueur délègue sa décision en cadence auto. Sa clé appartient à l’étape de choix. Pendant cette fenêtre, le pont écarte les occupants hors de vue et la projection masque leur aperçu. Le choix par défaut ignore leur case. [Arbitrage du 22 novembre 2026](https://github.com/MyEdO/game/issues/4017#issuecomment-7080073368)
- **Le plan ASCII du pont** applique `combattantEnVue` en combat et `entiteConnue` en exploration, y compris pour les embuscades.
- **Godot suit la vision du pont**. Un nœud qui quitte la vue quitte l’arbre. `VolumeDeScene.voir` rappelle le masque quand `vue.vision` change et voile chaque surface ou point à sa case. Le plan `toit` sert les nappes, couronnes et faîtières. L’éditeur et l’atelier laissent leur vue libre. Voir le contrat du pont, sections « Vue » et « Monde ».
- **Sous le rendu de compatibilité (la page), le voile se mélange après l'encodage sRGB** : la part lue s'écarte de la teinte, exacte sous Forward+. L'écart se garde et se borne par les recettes rendues (`TOLERANCE`, `CREUX_DU_PILOTE`, `borne_du_pilote` de `recettes/lecture_des_pixels.gd`), jamais par un réglage du shader ni du moteur : décision de Clément au ticket #3950 (commentaire 6845370516).
- **Une zone se montre par ses cases `caseDeZoneEnVue`** (une zone qui coupe la vue se montre entière dès que le groupe en voit le bord), sous la clé de la zone entière ; une source portée hors de vue n'est pas servie, une source posée hors de vue garde sa lampe sans `visuel` ni `son` (`lumiereDeLaScene`).
- **Un effet peut n'avoir pas d'auteur** (`de`, `depart`, `trajet` à `null`, auteur hors de vue) : seule son arrivée ou sa nappe joue (`Effets._partir`).
- **La case d'une cible se lit dans `casesDesCibles`**, jamais dans `occupants` (une case, un seul id) ni dans `voisins` (les seuls en vue).
- Recettes : `vision-du-combat.gd` et `vision-du-bati.gd` (headless), `voile-de-la-vision.gd`, `voile-du-bati.gd`, `aretes-en-instances.gd`, `voile-de-la-barge.gd` et `voile-de-la-caraque.gd` (script commun `voile-du-navire.gd`), `voile-du-decor.gd` (rendu réel sous les deux rendus, `npm run godot:rendus`), parcours `vision` (`grimpant`) et `murs` (`zones-pieces`) de `hotes/godot/recette.mjs` (export Web).
