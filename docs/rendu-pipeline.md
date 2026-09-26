# Pipeline de rendu — « une scène, une apparence, N projections »

> ⚠️ Fichier GÉNÉRÉ par `node scripts/docs/build-rendu-pipeline.mjs` (`npm run docs:rendu-pipeline`) — NE PAS ÉDITER À LA MAIN.

**Périmètre mesuré / angles morts** — sont DÉRIVÉS à chaque génération : les 5 membres
de `SceneEl` et les champs de `GP`/`MaterialRef`/`Face`/`ElBase`/`ElStates`
(`src/gameIso/builders/types.ts`), les 7 builders exportés sous `src/gameIso/builders/` avec leur type
de sortie, les 9 sous-dossiers de `src/gameIso/` et leur nombre de modules directs, les
6 clés d'ambiance de `src/data/ambiance.json`, les 7 sections d'une
`DetailRecipe`, les 9 appendices du registre du rig avec leurs références par id, la
couverture RÉELLE de la garde anti-couleur (lue dans la garde) et la population
des 3 catalogues de matériaux. **Angles morts** : ce doc décrit la FORME du
pipeline, pas le RÉSULTAT — aucune mesure ici ne dit qu'une scène est belle ou juste (c'est le rôle
de la QC visuelle et des oracles de parité) ; le comptage de modules est NON récursif (un
sous-dossier n'est pas replié dans le total de son parent) ; le rôle de chaque sous-dossier et la
section « où ajouter… » sont de l'ÉDITORIAL fixé dans le script — mais leurs CLÉS sont ancrées, un
dossier neuf ou renommé fait échouer la génération.

Le rendu du monde part d'UN document de scène et d'UNE couche d'apparence EN DONNÉE, et se projette
dans plusieurs vues sans dupliquer la logique. Deux étages nets :

```
Scene ──(builders, PURS, espace MONDE)──▶ SceneEl[] ──┬─(monde volumique)──▶ canevas WebGL
                                                     └─(peintres d’authoring)──▶ SVG
```

**Contrat de perf** : un builder n'importe ni dimensions d'écran ni caméra. Sa sortie survit à toute
rotation ou changement de projection ; la première personne n'hérite d'aucun concept d'écran.

## 1. Le pivot — `src/gameIso/builders/types.ts`

`SceneEl` (`src/gameIso/builders/types.ts:241`) = `FloorEl` | `WallEl` | `RoofEl` | `PropEl` | `TokenEl` — union
discriminée par `kind`. `PropEl` (`src/gameIso/builders/types.ts:207`) se subdivise elle-même en
`BillboardPropEl` | `VolumePropEl`.

### `GP` — un point en espace MONDE

| Champ | Type | Rôle (JSDoc) |
|---|---|---|
| `x` | `number` | — |
| `y` | `number` | — |
| `h` | `number` | — |

### `MaterialRef` — une RÉFÉRENCE de matériau, jamais une couleur

| Champ | Type | Rôle (JSDoc) |
|---|---|---|
| `domain` | `'terrain' \| 'relief' \| 'structure' \| 'roof' \| 'prop'` | — |
| `id` | `string` | — |
| `part?` | `string` | — |

Domaines fermés : `terrain` · `relief` · `structure` · `roof` · `prop`. Le `part` distingue les faces d'un
même matériau ; la couleur est résolue au RENDU, depuis la donnée d'apparence et la lumière.

### `Face` — un polygone porteur d'un matériau

| Champ | Type | Rôle (JSDoc) |
|---|---|---|
| `poly` | `GP[]` | — |
| `material` | `MaterialRef` | — |
| `architectureFeatureId?` | `string` | — |
| `architectureFeatureKind?` | `FacadeFeature['kind']` | — |
| `side?` | `CellSide` | Arête de la case qui porte la face (relief/wedge/mur) — les backends en dérivent l'orientation (arête écran en affine, normale en perspective) sans re-scanner la scène. |
| `oriented` | `boolean` | REQUIS — chaque producteur DÉCLARE le régime de sa face, le compilateur refuse l'oubli. |
| `entId?` | `string` | Id de l'ENTITÉ de scène dont la face vient (décor volumique, `builders/propVolumes.ts`) — ce que le picking résout une fois la face fondue dans la géométrie commune du monde. |

### `ElBase` — l'identité MONDE commune à tous les éléments

| Champ | Type | Rôle (JSDoc) |
|---|---|---|
| `key` | `string` | Clé STABLE d'identité MONDE (`floor:x,y,z`…) — clé React/DOM, survit aux frames et rotations. |
| `cell` | `{ x: number; y: number; z: number }` | Case d'ancrage. |
| `states` | `ElStates` | — |

### `ElStates` — les vérités de SCÈNE, camera-free

| Champ | Type | Rôle (JSDoc) |
|---|---|---|
| `visible` | `boolean` | Représente une chose actuellement VISIBLE → dessinée AU-DESSUS du voile de brouillard (fog sandwich). |
| `overhang?` | `boolean` | SURPLOMB : la case a une surface marchable sur une couche inférieure (tablier de pont / loge). |
| `ghost?` | `boolean` | Émis AU-DESSUS de l'étage actif → silhouette (l'appelant l'affiche translucide, sauf surplomb PLEIN). |
| `solidOverhang?` | `boolean` | Surplomb PLEIN : fantôme dont la surface du dessous n'est PAS visible → rien à protéger, dessiné opaque comme la structure perçue (rempart en bord de carte) et au-dessus du voile. |
| `open?` | `boolean` | Porte ouverte (arête franchissable). |
| `down?` | `boolean` | Structure abattue (brèche de siège). |
| `roofOccupied?` | `boolean` | Toit dont l'empreinte est occupée par un allié (cutaway). |

La vérité de VUE (estompe d'occlusion, révélation, assombrissement d'un étage) reste une
**décoration** du rendu, jamais du pivot.

## 2. Les builders (7)

| Builder | Sortie | Site | Rôle (JSDoc) |
|---|---|---|---|
| `buildFloors` | `FloorEl[]` | `src/gameIso/builders/floors.ts:318` | Éléments `floor` de la scène. |
| `buildHighlights` | `HighlightEl[]` | `src/gameIso/builders/highlights.ts:64` | — |
| `buildPropVolumes` | `Face[]` | `src/gameIso/builders/propVolumes.ts:52` | Les faces MONDE d'un décor volumique : recette locale × cap × ancre, posées sur `baseHeightM`. |
| `buildProps` | `PropEl[]` | `src/gameIso/builders/props.ts:126` | Éléments `prop` de la scène — TOUTES les couches, sauf ISOLEMENT explicite d'un étage (`viewZ`, demande de l'appelant : vue du dessus, minimap, `state/viewLevel`). |
| `buildRoofs` | `RoofEl[]` | `src/gameIso/builders/roofs.ts:1401` | Éléments `roof` de la scène. |
| `buildTokens` | `TokenEl[]` | `src/gameIso/builders/tokens.ts:92` | Éléments `token` de la scène — figurants (toujours), puis combattants (si `battle`). |
| `buildWalls` | `WallEl[]` | `src/gameIso/builders/walls.ts:629` | Éléments `wall` de la scène. |

## 3. L'arborescence de `src/gameIso/`

| Dossier | Modules directs | Sous-dossiers | Rôle |
|---|---|---|---|
| `src/gameIso/authoring/` | 5 | 0 | peintres SVG (plan de station, aperçu d’éditeur, oracles de parité) — pilotés par `Dims`, seul pont monde→écran |
| `src/gameIso/backends/` | 0 | 1 | le MONDE, cuit en géométrie et rendu par une caméra réelle (three) — LE moteur du jeu en toutes vues |
| `src/gameIso/builders/` | 12 | 1 | dérivation PURE de la Scène en éléments sémantiques, en espace MONDE (aucun import de caméra ni d’écran) |
| `src/gameIso/catalog/` | 6 | 5 | catalogues d’apparence : ambiance, décor, dégradés — la couleur y est une DONNÉE |
| `src/gameIso/detail/` | 3 | 0 | détail de surface (matériaux v2) : recettes dépliées en primitives UV, déterministes au seed |
| `src/gameIso/fx/` | 5 | 0 | effets de combat — hors périmètre de la garde anti-couleur (couleur d’intention, pas d’identité de matériau) |
| `src/gameIso/pov/` | 3 | 0 | première personne : caméra, brume, boîtes de billboard, voiles d’écran |
| `src/gameIso/rig/` | 21 | 25 | art des sujets (bestiaire, équipement, véhicules) — hors périmètre de la garde anti-couleur |
| `src/gameIso/stage/` | 54 | 0 | hôtes de montage : le monde et ses surcouches React, le plan de station, le tri des objets |

### Appendices du rig — UN registre, 9 ids, une seule résolution

Cornes et queues ne sont pas de l'art posé au cas par cas : `src/gameIso/rig/parts/appendages/` est le registre UNIQUE, et
**1 appendice = 1 def `defs/<id>.ts` qui porte SON art** (`front` + `profile` dédié, `back` = `front` par
défaut) — aucune string SVG de corne ou de queue hors des defs. Les consommateurs les référencent **PAR ID**
et la résolution passe par la primitive unique `pickView` (`src/gameIso/rig/parts/types.ts:14`), appelée
sur un appendice par `src/gameIso/rig/composeRig.tsx`, `src/gameIso/rig/parts/monstrous.ts`, `src/gameIso/rig/parts/traitVisuals.ts`.

| Appendice | id | Def | Dos propre | Référencé par |
|---|---|---|---|---|
| Cornes caprines | `cornes-caprin` | `src/gameIso/rig/parts/appendages/defs/cornes-caprin.ts` | = face | 3 — `src/gameIso/rig/creatures/defs/Prophete-gris.ts`, `src/gameIso/rig/parts/monster/defs/caprin.ts`, `src/gameIso/rig/parts/monster/defs/gobelin.ts` |
| Cornes de démon | `cornes-demon` | `src/gameIso/rig/parts/appendages/defs/cornes-demon.ts` | = face | 2 — `src/gameIso/rig/parts/elements/defs/cornes-demon.ts`, `src/gameIso/rig/parts/monster/defs/demon.ts` |
| Cornes (générique) | `cornes-generique` | `src/gameIso/rig/parts/appendages/defs/cornes-generique.ts` | = face | 3 — `src/gameIso/rig/creatures/defs/Furie-du-chaos.ts`, `src/gameIso/rig/parts/monstrous.ts`, `src/gameIso/rig/parts/traitVisuals.ts` |
| Cornes de Gor | `cornes-gor` | `src/gameIso/rig/parts/appendages/defs/cornes-gor.ts` | = face | 5 — `src/gameIso/rig/creatures/defs/Chamane-Brey.ts`, `src/gameIso/rig/creatures/defs/Gor.ts`, `src/gameIso/rig/creatures/defs/Homme-bete-de-Khorne.ts`, `src/gameIso/rig/creatures/defs/Homme-bete.ts`, `src/gameIso/rig/creatures/defs/Urzo.ts` |
| Cornes de taureau | `cornes-taureau` | `src/gameIso/rig/parts/appendages/defs/cornes-taureau.ts` | = face | 2 — `src/gameIso/rig/parts/elements/defs/cornes-taureau.ts`, `src/gameIso/rig/parts/monster/defs/taureau.ts` |
| Cornes vestigiales | `cornes-vestigiales` | `src/gameIso/rig/parts/appendages/defs/cornes-vestigiales.ts` | = face | 3 — `src/gameIso/rig/creatures/defs/Bete-imperiale.ts`, `src/gameIso/rig/creatures/defs/Jumeaux.ts`, `src/gameIso/rig/creatures/defs/Ungor.ts` |
| Queue-fouet | `queue-fouet` | `src/gameIso/rig/parts/appendages/defs/queue-fouet.ts` | = face | 1 — `src/gameIso/rig/parts/traitVisuals.ts` |
| Queue (générique) | `queue-generique` | `src/gameIso/rig/parts/appendages/defs/queue-generique.ts` | = face | 3 — `src/gameIso/rig/parts/elements/defs/queue.ts`, `src/gameIso/rig/parts/monster/defs/singe.ts`, `src/gameIso/rig/parts/monstrous.ts` |
| Queue de rat | `queue-rat` | `src/gameIso/rig/parts/appendages/defs/queue-rat.ts` | = face | 2 — `src/gameIso/rig/parts/elements/defs/queue-rat.ts`, `src/gameIso/rig/parts/monster/defs/rat.ts` |

Un **0** en « Référencé par » est une PISTE, pas une preuve de mort : la colonne compte les fichiers de
`src/gameIso/` (hors tests et hors registre) qui citent l'id — un id choisi en donnée de scène ou au Codex n'y
apparaît pas. Ajouter un type d'appendice = déposer un def + `npm run gen` ; jamais un 4ᵉ mécanisme d'art.

## 4. Détail de surface — la recette (`src/gameIso/detail/types.ts:19`)

Une `DetailRecipe` est une donnée PURE portée par les defs d'apparence ; ses dimensions sont en
mètres, et son dépliage en primitives UV est **déterministe au seed** — le SVG d'authoring et le
monde volumique retombent donc sur le MÊME détail.

| Section | Rôle (JSDoc) |
|---|---|
| `courses?` | Rangs horizontaux (assises de pierre, bardeaux, planches). |
| `bands?` | Bandes horizontales pleines (plinthe, arase, bandeau) : `atV` = CENTRE de la bande ∈ [0,1] (0 = haut de la face, 1 = bas), `hM` = hauteur (m). |
| `timber?` | Colombage : poteaux verticaux tous les `postEveryM` mètres + écharpes en X ou en V par travée. |
| `speckle?` | Mouchetis (lichen, salissure, silex) : densité par m², rayon (m) min/max, palette tirée au seed. |
| `tufts?` | Touffes d'herbe / brins (sol) : densité par m², hauteur de brin (m) min/max, palette tirée au seed. |
| `tintVar?` | Variance de TEINTE de la surface entière ∈ [0,1] par unité de seed (tuile/face) — tue l'uniformité d'un aplat répété : le backend module le fill de base par `shade(base, 1 ± tintVar)`. |
| `seedScope` | Portée de l'IDENTITÉ du seed — dit à l'APPELANT quoi hasher (le seed n'est jamais stocké) : 'edge' = par arête de mur (x,y,z,side), 'tile' = par tuile (x,y,z), 'instance' = par instance (bâtiment/structure entière : même détail sur toutes ses faces). |

## 5. Ambiance — `src/data/ambiance.json`

6 clés d'ambiance en donnée : `ambientFloor` · `fogTint` · `faceShade` · `entreeEnScene` · `iso` · `pov`. Les deux
regards du monde et la QC headless consomment les MÊMES defs, assemblées une fois.

## 6. Garde anti-couleur — `src/gameIso/renderer-no-hardcoded-color.test.ts`

Aucun renderer d'environnement ne porte de **littéral** de couleur : toute couleur vient de la
DONNÉE ou de la LUMIÈRE. La couverture ci-dessous est lue DANS la garde (aucune liste tenue ici) :

- **balayage récursif** de `src/gameIso/builders/`, `src/gameIso/backends/`, `src/gameIso/authoring/`, `src/gameIso/detail/`, `src/gameIso/pov/`, `src/gameIso/catalog/`, `src/gameIso/stage/` — tout
  fichier NEUF y est couvert d'office ;
- **renderers nommés** à la racine : `src/gameIso/SurcoucheIso.tsx`, `src/gameIso/sprites.ts` ;
- **bloc à part** (chrome d'ÉTAT des jetons, allowlist neutre) :
  `src/gameIso/stage/TokenChromeOverlay.tsx`, `src/gameIso/tokenBodyKind.tsx` — un fichier passe par un bloc ou par
  l'autre, jamais par les deux.

Hors balayage (couleur LÉGITIME : art de sujet, effets, ou donnée d'identité) : `src/gameIso/fx/`, `src/gameIso/rig/`.

## 7. QC visuelle — `scripts/qc/capture-jeu.mjs`

Instrument de **non-régression visuelle** : les planches se capturent DANS l'app (le jeu réel, son
monde et son écran), jamais par un rendu parallèle hors app — un second chemin de rendu jugerait
autre chose que ce que le joueur voit. Copier les planches AVANT un changement d'apparence,
relancer, comparer : une migration donnée-neutre doit rester identique.

## 8. Où ajouter…

| Catalogue | Entrées |
|---|---|
| `src/data/structureAppearance.json` | 18 |
| `src/data/materials.json` | 16 |
| `src/data/decorPalette.json` | 435 |

- **un matériau** (structure / relief / toit) : une entrée dans le catalogue correspondant ci-dessus
  (id + couleurs par `part` + `detail` optionnelle). Les éléments le référencent par id ; le rendu
  résout les couleurs par `part`.
- **un ton de décor** : une entrée dans la palette — jamais un hex dans un renderer (§6).
- **un terrain** : une entrée dans `src/data/terrains.json` (règle ET rendu dans la même entrée).
- **un prop / décor** : une def sous `src/gameIso/catalog/decor/defs/`, puis `npm run gen`. Symétrique →
  un seul dessin ; directionnel → il DÉCLARE ses vues, et la sélection vue + miroir + repli se fait
  dans la MACHINERIE partagée, jamais dans la def.
- **un TYPE d'élément** (au-delà des 5 membres de `SceneEl`) : ajouter le variant au pivot,
  son builder, sa cuisson dans le monde volumique, et — s'il doit se voir à l'authoring — son peintre
  SVG avec sa profondeur de tri.
<!-- sources-empreinte: bc47a9c5e6aff1bfa08391ffd7269d6e71b54223 (1013 fichiers, 92 dossiers) corps: ab70c79cfb4038262dcc4a0bb29a54cdcfb6ea17 -->
