# Un humanoïde glTF animé dans les deux moteurs : jeu three.js et prototype Godot (2026-10-18)

Ticket: #2794

Rapport du ticket #2819 (« Essai : un humanoïde glTF animé dans le jeu three.js et dans le prototype Godot »), sous-ticket de l'épique #2794 (« un moteur de jeu tiers gratuit plutôt que rendu et interface maison, `src/engine` conservé ? »). Il fait suite au rapport `docs/plans/2026-10-18-poc-godot-3d.md`. Ce n'est pas le début d'une migration : la décision appartient à l'épique.

## Pourquoi cet essai

Clément, verbatim (2026-10-18) : « Refaire le SVG pour des vrais modeles 3 D c'est quelque chose que je souhaite réellement faire de toute maniere et on a pleins de soucis d'affichage actuellement comme la cuisson et les éléments qui mettent parfois 10sec a s'afficher en étant en plus flouté » ; puis « En plus les animations, la galere de créer des modeles 3 faces cohérent, ... ».

L'art passant de toute façon en modèles 3D, la question n'est plus « garder le SVG ou non », mais « dans quel moteur intégrer des modèles 3D coûte le moins ». L'essai place le même modèle, avec les mêmes animations, dans chacun des deux moteurs.

## Ce qui a été construit

**Modèles** : KayKit « Adventurers » et « Skeletons » (licence CC0), `Knight.glb` pour les héros (3 659 532 o, 76 animations) et `Skeleton_Warrior.glb` pour les adversaires (4 863 620 o, 95 animations). Les deux partagent un squelette de 41 os. Six animations servent : `Idle` au repos, `Walking_A` en marche, `1H_Melee_Attack_Chop` à l'attaque, `Hit_A` au coup reçu, `Death_A` à la mise hors de combat, `Block` disponible. Une seule arme à une main est visible.

**Dans le prototype Godot**, branche `poc/godot`, jamais fusionnée, tête `02fbbaa416` :
- `projet/scenes/Combattant3D.tscn` choisit le modèle par camp dans la scène (`modele_heros`, `modele_adversaires`, deux `@export` de `PackedScene`). `projet/scenes/Chevalier.tscn` hérite du `.glb` et masque les armes inutiles.
- `projet/scripts/combattant_3d.gd` porte la machine d'animation de l'`AnimationPlayer` importé.
- Le contrat `projet/scripts/plateau.gd` gagne une méthode, `attaquer(attaquant, cible)`, appelée par `combat.gd`. Le plateau 2D l'implémente sans effet, et sa vue reste identique.
- Import Godot par défaut, sans réglage.

**Dans le jeu three.js**, branche `poc/three-gltf`, jamais fusionnée, partie de `main` `90f02970c6`, tête `520ba50df0` :
- `src/gameIso/stage/gltfActeurs.ts` (nouveau) : la classe `CoucheGltf` charge les modèles par `GLTFLoader` avec un cache, les clone par `SkeletonUtils.clone`, et anime chacun par un `AnimationMixer`. Le modèle se choisit par le camp du combattant.
- `src/gameIso/stage/GameStage3D.tsx` : la couche est branchée sur la scène. Les combattants rendus en glTF sont retirés du montage et de la cuisson des billboards, le sélecteur vise les modèles, et les mixers demandent leurs propres images.
- Les fichiers sont servis depuis `public/modeles/`.
- `?billboards` dans l'URL rend les billboards SVG d'origine, pour comparer.

## Effort d'intégration

| | Godot | three.js |
|---|---|---|
| Lignes de code (ajoutées / supprimées) | 86 / 83, dans 7 fichiers de scripts et de scènes | 280 / 8, dans 2 fichiers |
| Dont fichier neuf | `Chevalier.tscn`, 23 lignes | `gltfActeurs.ts`, 207 lignes |
| Passes de code | 1 | 2 (la première a reçu six griefs du juge) |
| Temps de code, hors recette | ≈ 13 min | ≈ 4 min plus une reprise, puis ≈ 9 min de corrections |
| Recette | 43 min | ≈ 48 min, puis 19 min après corrections |
| Tests existants cassés | aucun | 17, dans `src/gameIso/stage` |

Dans les deux cas, le temps passé est surtout de la recette au navigateur, en rendu logiciel. Les temps sont ceux d'agents Claude, pas d'un développeur humain : ils comparent les deux moteurs entre eux, pas une charge de travail réelle.

Les 17 tests cassés côté three.js (dont `flipbook-frames` et `retention-de-montage`) verrouillent le montage des billboards de combattants, que l'essai retire. Ils ne sont pas réparés, car la branche est une mesure.

## Ce qui a coûté, moteur par moteur

**Godot** : rien de notable dans l'intégration elle-même.
- L'import glTF par défaut a suffi. Les animations, le squelette et les textures arrivent dans l'`AnimationPlayer` sans code.
- Seule la boucle des animations de repos et de marche se règle dans le code (`LOOP_LINEAR`).
- Les modèles portent et reçoivent les ombres de la lumière existante, en rendu Compatibility.
- Le choix du modèle et le masquage des armes se font dans l'éditeur, sans code.

**three.js** : le chargement et l'animation sont simples. Le coût vient du jeu existant, construit autour des billboards SVG. La première passe a laissé six défauts, relevés par le juge et confirmés avant correction :
1. Un héros pouvait être rendu en squelette : le modèle était choisi au montage, à un moment où le camp n'était pas encore connu.
2. La taille des créatures était ignorée.
3. Les gestes étaient coupés : la durée d'une animation SVG (attaque 620 ms) est plus courte que celle du clip glTF (1,07 s).
4. La cadence des mixers dépendait du flipbook SVG ; aucune image n'était demandée pour eux.
5. Les billboards masqués restaient montés et cuits, si bien que la cuisson SVG continuait sous les modèles.
6. Le disque d'ombre de contact restait allumé.

Chacun de ces défauts est une couture entre le rendu des billboards et celui des modèles. Une vraie migration vers des modèles 3D dans three.js demanderait de reprendre ces coutures, de réécrire les tests qui les verrouillent, et de retirer la cuisson et le flipbook. Ce sont les pièces que Clément cite comme défauts.

## Captures

Dans le dossier du projet `poc-godot/captures-gltf/` :
- Godot : `lote-3d-capture-debut.png`, `lote-3d-capture-marche.png`, `lote-3d-capture-attaque.png`, `lote-3d-capture-hors-de-combat.png`, `lote-3d-capture-fin.png`.
- three.js : `threejs-gltf-debut.png`, et pour comparer, `threejs-billboards-debut.png` avec les billboards d'origine.

## Recette

Les deux recettes ont été pilotées par script, à la souris et au clavier réels, dans Chromium headless avec rendu logiciel SwiftShader.
- **Godot**, build debug : une partie complète jusqu'à l'issue en 3D, puis une en 2D (`?vue=2d`), console à 0 erreur et 0 avertissement.
- **three.js**, serveur de développement : un combat de l'Arène, mis en place par `__wfrp` (`fight('enc-zone1')`, placement, Blessures abaissées). Puis un déplacement, une attaque qui touche, et une mise hors de combat jouée jusqu'à `Death_A`. Un clic sur la tête d'un modèle, hors de sa case, sélectionne bien la cible. Console à 0 erreur.

## Mesures

Les mesures ont été prises dans Chromium headless, avec rendu logiciel SwiftShader, sur une machine partagée dont la charge a varié de 1 à 5. Un vrai GPU n'a pas été mesuré. Les images par seconde ne sont donc comparables qu'entre elles, et faiblement.

| Mesure | Godot release | three.js glTF | three.js billboards |
|---|---|---|---|
| Passages | 3 | 1 | 1 |
| Combattants dans le combat | 6 | 10 | 10 |
| Images/s au repos (médiane des passages) | 4,19 (de 0,82 à 6,21) | 2,62 | 1,73 |
| Combattants affichés | 3 231 ms en médiane, depuis la navigation | 11 111 ms depuis le lancement du combat, jusqu'aux 10 modèles sélectionnables | non obtenu |
| Octets transférés | 49 532 154 o au total | 12 798 491 o au combat prêt, dont 8 523 752 o de modèles | 7 433 946 o au combat prêt |

Ce que mesure chaque chiffre :
- **Godot** : la ligne `[chargement] ms=` qu'imprime `projet/scripts/mesures.gd` à la première image du combat, depuis la navigation. Elle comprend le téléchargement et la compilation de `index.wasm` (10,2 Mo en gzip).
- **three.js** : depuis l'appel `fight()` jusqu'à ce que les 10 modèles soient montés et sélectionnables. Le menu, déjà chargé avant, n'est pas compté.
- **Billboards** : la sonde n'a pas trouvé les quads, car `__wfrp.corps` rend 0 pour les billboards. Le délai n'a donc pas été mesuré.

Les deux méthodes diffèrent, et les nombres de combattants aussi. Ces chiffres ne permettent pas de classer les moteurs en vitesse. Ils montrent deux choses :
- les modèles glTF ne ralentissent pas le jeu three.js par rapport aux billboards : 2,62 images/s contre 1,73, à charge comparable ;
- l'export web de Godot pèse environ quatre fois le jeu au combat prêt.

Un faux plantage a été écarté : le build de production des mesures plantait au chargement (`TypeError: e is not a function`). La cause est le build de mesure lui-même, qui forçait `import.meta.env.DEV` à vrai pour garder `__wfrp`. Les builds de production ordinaires de `main` et de la branche d'essai affichent le menu sans erreur de page ni message en console.

## Ce qui n'a pas été mesuré

- Les passages 2 et 3 de three.js, et le délai d'affichage des billboards.
- Les images par seconde pendant une marche côté three.js : la fenêtre de mesure de 580 ms n'a capté que 2 images avec les modèles et 1 avec les billboards.
- Un vrai GPU. Le poste de Clément (RTX 4070 Laptop, 8 Go) donnerait des chiffres sans rapport avec SwiftShader.
- Le coût de production des modèles eux-mêmes : les modèles KayKit sont prêts à l'emploi, ceux du jeu seraient à créer.

## Lecture

- **Intégrer un modèle glTF animé coûte peu dans les deux moteurs.** Godot le fait sans code pour l'import et les animations. three.js demande un peu plus de 200 lignes, avec les outils qu'il fournit déjà.
- **La différence vient de l'existant.** Dans Godot, le modèle remplace des primitives, sans rien autour. Dans three.js, il entre en conflit avec le rendu des billboards : la cuisson, le flipbook, les durées d'animation SVG, et les tests qui les verrouillent. Ce rendu serait à démonter dans l'une ou l'autre option, puisque l'art SVG part.
- **L'atelier fait l'écart sur la durée.** Le choix du modèle et le masquage des armes se règlent dans l'éditeur de Godot ; dans three.js, ce serait du code ou un outil à écrire. C'est le point que Clément soulève, verbatim (2026-10-18) : « Je dois t'avouer que nos plus grosse faiblesse actuellement c'est le moteur graphique et l'interface. On se bat avec en permanence avec, tellement qu'a part toi, personne n'est capable de s'en servir ».
- **Ce que l'essai ne tranche pas** : le coût de la réécriture de l'interface de règles dans Godot, et la condition du pont, ouverte en #2817 (« Combat : résoudre et appliquer une attaque sans le store (fonctions pures appelables par tout hôte) »).

La décision revient à Clément.
