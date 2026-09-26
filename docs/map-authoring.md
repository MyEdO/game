# Authoring d'une map : le format `MapSpec`

> ⚠️ Fichier GÉNÉRÉ par `node scripts/docs/build-map-authoring.mjs` (`npm run docs:map-authoring`) — NE PAS ÉDITER À LA MAIN.

**Périmètre mesuré / angles morts** — sont LUS par AST à `src/state/mapSpec.ts` : les 38
champs de `MapSpec` (nom, type, 1re phrase de JSDoc), ceux de `WallSpec` (9, héritage
`extends` SUIVI : un parent hors du fichier est résolu à `src/state/scene.ts`, et un parent `Pick<Cible, clés>`
tire ses clés du tableau `as const` cité et leurs type/JSDoc du schéma zod de `src/data/schemas/defs-scenes/scene.ts`),
`CellRecipe` (5) et `EncounterSpec` (11), les
5 formes de `BindSpec` et les 3 de `ReliefSpec`, et les 10
étapes de l'ordre de compilation citées au JSDoc de tête. Le harnais QC liste les fonctions
exportées de `src/state/mapQC.ts`. Les exemples vivants sont MESURÉS par AST sur les 36
documents de `src/scenes/` qui exposent un littéral `MapSpec` (argument de `buildScene(...)` ou objet
annoté `MapSpec`), sur 37 qui emploient `buildScene`/`MapSpec` (hors `*.test.ts`).
**Angles morts** : un champ n'est compté « employé » que posé au PREMIER niveau du littéral — un spec
construit ailleurs (variable non annotée, fabrique) n'est pas mesuré, et une clé posée par épandage
(`...preset` — 1 document concerné) échappe à la mesure ; le JSDoc rapporté est la
1re PHRASE seulement (le corps complet vit au fichier) ; la sémantique de compilation (ce que fait
vraiment chaque primitive) n'est pas dérivable — elle est verrouillée par
`src/state/mapSpec.test.ts` ; la procédure image → grille et les pièges sont de l'ÉDITORIAL fixé
dans le script.

> **Pour l'IA (et l'humain) : c'est LE seul chemin pour construire une carte.**
> Tu décris une map en objet déclaratif `MapSpec` ; `buildScene(spec)` la compile en `Scene`.

- Type + compilateur : `src/state/mapSpec.ts`
- **Spec exécutable** (exemples courts, à jour) : `src/state/mapSpec.test.ts` — chaque `describe`
  verrouille une section.
- **Exemples VIVANTS** : les tableaux « Où voir quoi » en bas — les repères d'authoring (concept →
  scénario étalon) et la mesure par champ sur `src/scenes/`.

`buildScene` est **PUR** et **Node-safe** (zéro import `ui/`/`gameIso/`) : le générateur d'arène
l'exécute via `tsx`. Il ne fait que **rejouer les primitives pures de l'éditeur**
(`src/state/sceneEdit.ts`) dans un **ordre figé** — donc tout ce que le format exprime est, par
construction, reproductible à la main dans l'éditeur (règle 2 de `CLAUDE.md`). Si un besoin ne
s'exprime pas proprement, on **étend une primitive** (avec un golden), on ne bricole jamais le
scénario.

## Démarrage — le cas trivial est une ligne

Champs REQUIS de `MapSpec` : `size`, `id`, `label`.

```ts
import { buildScene } from '../../state/mapSpec';
const scene = buildScene({ size: [16, 10], id: 'test-x', label: 'Bac à sable', heroStart: [2, 5] });
// → plateau plat 16×10 d'herbe + 1 départ héros.
```

## Champs de `MapSpec` (38)

| Champ | Type | Rôle (JSDoc) |
|---|---|---|
| `size` | `[number, number]` | — |
| `id` | `string` | — |
| `label` | `string` | — |
| `desc?` | `string` | — |
| `ambiance?` | `Scene['ambiance']` | — |
| `weather?` | `Scene['weather']` | — |
| `ambientLight?` | `string` | — |
| `metresPerTile?` | `number` | — |
| `music?` | `Scene['music']` | — |
| `startMessage?` | `string` | — |
| `rest?` | `Scene['rest']` | — |
| `flags?` | `Record<string, boolean>` | — |
| `terrain?` | `Terrain` | Terrain de base (z0 / couche unique). |
| `legend?` | `Record<string, Terrain>` | Légende ASCII (char → terrain) partagée par tous les étages. |
| `markerFill?` | `Record<string, string>` | Char LAISSÉ sous un marqueur nettoyé (marqueur → char de LÉGENDE, ex. `{ B:'W' }` pour poser une pièce SUR le chemin de ronde 'W' sans y percer un trou). |
| `levels?` | `Record<string, string>` | Grilles ASCII par étage (`z0`/`z1`/…). |
| `walled?` | `Record<string, string>` | Grilles BOX-DRAWING par étage (`z0`/`z1`/…) : arêtes DANS l'ASCII (`parseWalledAscii`, (2W+1)×(2H+1)). |
| `wallLegend?` | `Record<string, WallOverlay>` | Char d'ARÊTE → ce qu'il ÉCRIT sur l'arête d'un étage `walled` (`WallOverlay`) : le char VAUT MUR, et porte une `structure` destructible (id de `structures.json`, ex. herse `porte-de-ville`), une `appearance` de rendu sans PV (id de `structureAppearance.json`, ex. cloison `mur-en-bois`), ou les deux. |
| `elevate?` | `Record<string, number \| { height: number; parapet: string }>` | HAUTEUR (relief) pilotée par l'ASCII (coordonnée-free) : char de LÉGENDE → hauteur métrique, `number` seul (`{ '4': 4, '3': 3 }` pour une rampe), OU `{ height, parapet }` pour une ZONE REMPART solide crénelée (`{ W: { height: 4, parapet: 'mur-en-pierre' } }` → face de maçonnerie + crénelure de périmètre au rendu). |
| `cells?` | `Record<string, CellRecipe>` | RECETTE par LETTRE de CASE COMPLÈTE (`CellRecipe`) : `wall` (enceinte pleine), `gate` (tunnel brèchable), `hero` (départ), `stair` (volée d'escalier, #780). |
| `walls?` | `WallSpec[]` | — |
| `relief?` | `ReliefSpec[]` | — |
| `terrainRects?` | `{ rect: [number, number, number, number]; terrain: Terrain; z?: number }[]` | — |
| `architecture?` | `ArchitectureBody[]` | — |
| `knownUnsupportedFloor?` | `{ x: number; y: number; z: number }[]` | Cases d'étage dont le plancher NE REPOSE PAS sur quelque chose (vide/terre nue au-dessous) — défaut de plan MESURÉ et déjà signalé, toléré ICI par la case NOMMÉE (jamais un contournement silencieux) le temps du lot de correction du plan qui les traite (`validateFloorSupport`). |
| `bind?` | `Record<string, BindSpec>` | Table des marqueurs ASCII (char → pose). |
| `entities?` | `SceneEntity[]` | Entités BRUTES (SceneEntity complètes, ids préservés). |
| `seatAssignments?` | `SeatAssignments` | OCCUPATION des places assises du mobilier posé (`propId → slotId → occupant`). |
| `heroStart?` | `[number, number] \| { x: number; y: number; z?: number }` | Départ héros : `[x,y]` ou `{x,y,z}`. |
| `entryPoints?` | `Record<string, [number, number]>` | — |
| `restZones?` | `{ rect: { x: number; y: number; w: number; h: number }; places?: Scene['rest']; quality?: 'normale' \| 'pietre' }[]` | — |
| `effectZones?` | `SceneEffectZone[]` | — |
| `zoneMap?` | `Record<string, string \| string[]>` | Calque de ZONES DESCRIPTIVES par étage : grille de chars aux dimensions de l'étage (` `/`.` = aucune zone), compilée en `SceneEffectZone` purement descriptives (nom de pièce, sans effet mécanique). |
| `zoneLegend?` | `Record<string, { id?: string; label: string; presentation?: 'interior' \| 'exterior' }>` | Légende du calque `zoneMap` : char → libellé de zone. |
| `triggers?` | `Trigger[]` | — |
| `dialogues?` | `Dialogue[]` | — |
| `encounters?` | `EncounterSpec[]` | — |
| `stations?` | `SceneStationAnchor[]` | Ancres AUTHORÉES des Scènes de bataille sur le plan (S2, Puissance de Bataille) — passées telles quelles sur la Scène construite (`Scene.stations`), consommées par `battleScenesToStations`. |

## `bind` — un marqueur ASCII → une pose

| Forme | Rôle (JSDoc) |
|---|---|
| `'heroStart'` | — |
| `{ entry: string }` | — |
| `{ emplacement: string; crew?: string; side?: FireArc; facing?: Dir8; member?: BindMember }` | `emplacement` (id d'engin) posé au marqueur : `crew` = id d'équipage servant, `side` = arc de tir naval (FireArc, absent = pivot libre), `facing` = orientation-monde de l'affût (Dir8), `z` HÉRITÉ de l'étage du marqueur (grille z1 → affût sur le chemin de ronde). |
| `{ entity: Partial<SceneEntity>; member?: BindMember }` | — |
| `Partial<SceneEntity>` | — |

L'enrôlement d'un marqueur dans une rencontre passe par `member` (`BindMember`) : l'id d'une entité
posée par `bind` est GÉNÉRÉ à la pose, c'est donc le SEUL moyen de l'ajouter au roster.

## `relief` — hauteurs métriques (repli bas niveau)

Spec de relief EN COORDONNÉES (repli bas niveau ; préférer `elevate` piloté par l'ASCII) : boîte inclusive `rect`, cellule unique `cell` (UNE case [x,y]), ou rampe interpolée `ramp`.

| Forme | Rôle (JSDoc) |
|---|---|
| `{ rect: [number, number, number, number]; height: number; z?: number }` | — |
| `{ cell: [number, number]; height: number; z?: number }` | — |
| `{ ramp: [number, number, number, number]; from: number; to: number; z?: number }` | — |

## `walls` — murs d'ARÊTE (`WallSpec`)

| Champ | Type | Rôle (JSDoc) |
|---|---|---|
| `x` | `number` | — |
| `y` | `number` | — |
| `side` | `CellSide \| '\\' \| '/'` | — |
| `z?` | `number` | — |
| `door?` | `boolean` | — |
| `window?` | `boolean` | DÉCORATIF : l'arête porte une fenêtre au rendu (mur plein serti d'une vitre — ne change pas le combat). |
| `climb?` | `WallClimb` | ESCALADABLE (LDB 15 l.53-57, cf. `WallSeg.climb`) : l'arête sépare deux surfaces de hauteurs différentes, franchissable en grimpant plutôt qu'à pied. |
| `structure?` | `string` | Hérité de `WallOverlay` — Structure destructible posée SUR l'arête (id de `structures.json`, ex. `porte-de-ville`). |
| `appearance?` | `string` | Hérité de `WallOverlay` — Apparence de rendu (`structureAppearance.json`) indépendante de `structure`. |

## `cells` — recette par LETTRE de case complète (`CellRecipe`)

| Champ | Type | Rôle (JSDoc) |
|---|---|---|
| `terrain?` | `Terrain` | Sol / FONDATION de la case (défaut = base de l'étage — évite l'herbe surprise sous une enceinte). |
| `wall?` | `{ structure: string; facing?: CellSide; height?: number }` | — |
| `gate?` | `{ structure: string; facing?: CellSide }` | — |
| `hero?` | `boolean` | — |
| `stair?` | `{ to: string }` | VOLÉE d'escalier : relie la surface de l'étage du run (couche z où la lettre est peinte) au plancher de l'étage `to`, par une rampe de hauteurs interpolées (Δ≤STEP_MAX_M). |

## `encounters` — `EncounterSpec`

| Champ | Type | Rôle (JSDoc) |
|---|---|---|
| `id` | `string` | — |
| `enemies?` | `AuthoredEnemy[]` | — |
| `members?` | `EncounterMember[]` | — |
| `surprise?` | `'party' \| 'enemies'` | — |
| `onVictory?` | `Flow` | — |
| `hidden?` | `boolean` | Rencontre invisible en exploration jusqu'au combat (embuscade visuelle) — pose `combat.hiddenUntilCombat` sur les entités enrôlées via `enemies`. |
| `maneuverability?` | `'party' \| 'enemies'` | Avantage initial — Manœuvrabilité (AA 11 l.53-65), cf. `EncounterDef.maneuverability`. |
| `threat?` | `{ camp: 'party' \| 'enemies'; tier: ThreatTier }` | Avantage initial — Menace (AA 11 l.53-65), cf. `EncounterDef.threat`. |
| `terrain?` | `{ camp: 'party' \| 'enemies'; heavy?: boolean }` | Avantage initial — Terrain (AA 11 l.53-65), cf. `EncounterDef.terrain`. |
| `victoryCondition?` | `VictoryCondition` | Objectif de victoire (#197), cf. `EncounterDef.victoryCondition`. |
| `siege?` | `boolean` | Rencontre de SIÈGE, cf. `EncounterDef.siege`. |

## `seatAssignments` — attabler, à ids FIXES seulement

- Les places d'un meuble viennent de son TYPE (`PropData.seatSlots` dans `src/data/props.json`) ;
  la Scène ne déclare que l'OCCUPATION. `src/state/seating.ts` est l'unique couture de résolution.
- Un occupant du GROUPE est un **EMPLACEMENT**, pas un personnage : `{ kind: 'party', rang }` avec
  `1 ≤ rang ≤ PARTY_MAX` (`src/state/combatants.ts`). Un document ne peut pas nommer un héros que
  le joueur créera plus tard ; le runtime résout `party[rang - 1]`. Un rang hors borne est une
  ERREUR de document ; un rang que le groupe courant n'atteint pas s'élague au chargement.
- `buildScene` **refuse** un `propId`/`entityId` que `entities` ne nomme pas littéralement : un id
  posé par `bind` est généré et change dès qu'un marqueur bouge. Pour attabler un PNJ, déclare le
  meuble ET le corps dans `entities`.
- La `pos` d'un PNJ attablé **est** la case d'abord résolue de sa place, et cet abord doit être
  PRATICABLE. Le prédicat est unique (`seatIsOccupiable`, `src/state/seating.ts`) : ce que le geste
  refuse, `validateScene` et `buildScene` le refusent aussi.
- À la souris, ce champ s'authore dans l'inspecteur de l'éditeur
  (`src/ui/editor/SeatAssignmentsField.tsx`). Toute mutation d'entité traverse le SEAM UNIQUE
  `normaliseAssises` (`src/state/sceneEdit.ts`). Garde : `src/ui/editor/seam-assise-guard.test.ts`.

## Ordre de compilation (10 étapes, cité au JSDoc de tête de `src/state/mapSpec.ts`)

```
  1. base       : `emptyScene(w,h)` + scalaires directs (id/nom/… comme les SceneProps de l'éditeur),
                  `metresPerTile`/`ambientLight`/`flags` via leurs primitives.
  2. terrain    : scan des marqueurs (`scanMarkers`) puis parse ASCII (`parseAsciiRows`) par étage,
                  posé via `putLayer`. Marqueurs nettoyés → base propre. Les grilles `walled` (box-drawing)
                  parsent tuiles + murs d'arête (`parseWalledAscii`) — les murs sont posés à l'étape 4.
  3. relief     : hauteurs métriques (`paintHeight`) par cellule — rect / cell / ramp (interpolation), puis
                  `cells` (enceinte/tunnel/départ) et `cells.stair` (volées : rampe interpolée entre deux
                  surfaces + trémie, #780 — connexité verticale DÉRIVÉE, pas d'escalier au
                  pathfinding).
  4. walls      : murs d'arête (`setEdgeWall` + `patchWall` structure) / diagonales (`toggleDiagonalWall`).
  5. architecture : `spec.architecture` copié tel quel (masses/façades) — non encore validé.
  6. entities   : `spec.entities` bruts + heroStart + interprétation du `bind` aux positions scannées.
  7. zones      : entryPoints / restZones / effectZones / triggers / dialogues.
  8. encounters : `buildEncounters` (terse → entités cachées + members).
  8bis. masses  : `deriveArchitectureMasses` COMPLÈTE les masses déclarées (surcharges, #829) avec
                  celles dérivées du plancher réel — plus d'obligation de tout couvrir à la main.
  9. validation : masses de bâtiment (`validateBuildingMasses`, garde-fou des SURCHARGES) + support
                   de plancher (`validateFloorSupport`) + ids de catalogue authorés
                   (`assertAuthoredIds`) — fail-fast, une fois zones/plancher réel connus.
```

## Pièges

- **Deux modèles de mur** : une tuile `'mur'` (terrain, via `legend`) = bloc PLEIN opaque ; un
  `WallSeg` d'**arête** (`walls`, `walled` + `wallLegend`) = cloison fine qui peut porter `door`,
  `structure` (brèchable) et/ou `appearance` (look seul, sans PV). Choisis exprès. Portes &
  structures ⇒ arêtes.
- **Marqueurs** : les chars de `bind` sont scannés PUIS nettoyés avant le parse terrain. Sur un
  terrain non-base (chemin de ronde), utilise `markerFill` pour ne pas laisser un trou `'vide'`.
- **Verticalité** = `relief` (mètres). La connexité verticale reste TOUJOURS DÉRIVÉE des hauteurs,
  par `surfaceLink` (`src/state/relief.ts`) : un dénivelé ≤ 1 m entre voisines est une RAMPE
  franchissable, au-delà c'est une FALAISE. Une lettre `cells.wall`/`cells.gate` auto-pose sa zone
  rempart en z+1 sur 4 m par défaut (`CELL_WALL_HEIGHT_M`, `src/state/mapSpec.ts`) — le z0 devient
  MASSE DE MUR, le rendu falaise + merlons suit tout seul —
  aucun escalier au pathfinding. Un ESCALIER se déclare via `cells.stair` ; la volée doit être une
  file LINÉAIRE (jamais ramifiée/cyclique) et ses cages servent d'ANCRES de recalage inter-étages :
  `buildScene` échoue si les grilles sont décalées.
- **Diagonales** : un pan oblique (`WallSpec.side` en anti-slash ou slash) est un HABILLAGE visuel,
  jamais une séparation — le mouvement, la
  vision et la grimpe restent orthogonaux, et un pan qui n'adosse aucun coin orthogonalement muré
  fait échouer `buildScene`.
- **Logique** (`triggers`/`dialogues`, `encounters.onVictory`) : recopie les `Flow`/`Condition`
  TELS QUELS, ne les réécris pas.

## Procédure image → grille (plan de livre → carte fidèle et jouable)

> **Répétable et vérifiée** : n'importe quel agent, sur n'importe quel plan de livre, produit une
> scène fidèle SANS combat artisanal. Chaque étape est VALIDABLE avant la suivante — le STRUCTUREL
> d'abord, le mobilier en DERNIER.

0. **Intrant source** : le plan illustré (folio du PDF VF). Extraire l'image de travail localement
   (gitignorée) SEULEMENT pour le jugement vision initial ; les attendus de comparaison
   (dimensions, comptes d'ouvertures par façade, murs témoins, zones) se **committent dans les
   tests de la scène** — la QC rejouable ne dépend JAMAIS d'un fichier hors git.
1. **Échelle** : convention par défaut **une porte = 1 case** (dérogable par plan, à documenter).
   `metresPerTile` s'en déduit.
2. **Dimensions communes** : tous les étages partagent le `size` du `MapSpec`.
3. **Enveloppe + cloisons** sans mobilier, en `walled` box-drawing. Obliques ORTHOGONALISÉES en
   escalier de cases.
4. **Ouvertures** : portes et fenêtres — comptées depuis le plan (le compte par façade est un
   attendu de test).
5. **Recalage z0↔z1 par ANCRES** : les cages d'escalier (`cells.stair`) et l'enveloppe commune. La
   compilation ÉCHOUE si les grilles sont décalées — le recalage est vérifié par construction.
   Un mur se déclare **par COUCHE** : un pas ne voit que l'arête de la couche la plus HAUTE qu'il engage
   (`Math.max(z, nz)`, `src/state/path.ts`, « un mur n'arrête le pas qu'à la HAUTEUR où on le franchit »).
   Une cloison qui monte jusqu'à l'étage se pose donc dans les DEUX grilles `walled` : déclarée au seul
   rez, elle passe sous les pieds et devient franchissable au niveau du plancher supérieur.
6. **Vides & hauteurs** : trémies/balcons ; la validation de trémie d'une volée couvre les surfaces
   fantômes.
7. **Zones nommées** : le calque `zoneMap` + `zoneLegend` recopie la légende du plan. Un char = une
   pièce. Le calque se **DÉRIVE du bâti** (`zonesFromSeeds`, `src/state/asciiMap.ts`) : une GRAINE par
   pièce — plusieurs quand une porte interne la coupe —, dont le remplissage 4-connexe s'arrête à toute
   arête murale (mur, porte, fenêtre, structure) et à toute case que le pas ne foule pas ; un calque
   écrit à la main se met à mentir dès qu'on bouge un mur. `clip` borne une aire OUVERTE que le plan
   partage entre n pièces sans trait entre elles : c'est un arbitrage MAISON, révisable, à motiver au
   site qui le déclare.
8. **Mobilier par marqueurs** (`bind`) — en DERNIER, jamais avant validation structurelle.
   Vocabulaire d'auberge déjà catalogué (`src/data/props.json`) : `escalier-bois`, `balustrade-bois`, `enclume`, `foyer-de-forge`, `cuve-brasserie`, `stalle-ecurie` ;
   murs à colombage via l'apparence `mur-a-ossature-en-bois`
   (`src/data/structureAppearance.json`).
9. **Recette** — le harnais ci-dessous.

## Harnais QC de carte (réfute, ne certifie jamais)

Le harnais transforme les critères flous (« chaque pièce accessible », « passage réel z0↔z1 ») en
assertions MÉCANIQUES générales, réutilisables par le test de N'IMPORTE QUELLE scène compilée.
Fonctions de `src/state/mapQC.ts` (démontrées par `src/state/mapQC.test.ts`) :

| Fonction | Site | Rôle (JSDoc) |
|---|---|---|
| `reachableCells` | `src/state/mapQC.ts:16` | Toutes les cases atteignables À PIED depuis `start` (portée illimitée, cross-couche) — léguées par l'étiquetage des composantes marchables de la scène (`walkReachableFrom`, `path.ts` : la SOURCE UNIQUE de connectivité, bâtie une fois par scène), plus de parcours propre au harnais. |
| `zoneWalkableCells` | `src/state/mapQC.ts:24` | Cases MARCHABLES d'une zone descriptive (`zoneAreaTiles` 2D, filtrées par `isWalkable` à l'étage `zone.z ?? 0` de la zone). |
| `unreachableDescriptiveZones` | `src/state/mapQC.ts:34` | Zones descriptives (pièces nommées, `isDescriptiveZone`) dont AUCUNE case marchable n'est atteignable depuis `start` — vide = toutes les pièces nommées sont accessibles. |
| `reachedFloors` | `src/state/mapQC.ts:44` | Étages (`z`) présents dans les cases atteignables depuis `start` — preuve de connexité verticale (une carte à étages habités z0..zN doit tous les faire apparaître ici). |
| `startOf` | `src/state/mapQC.ts:51` | Position du `heroStart` de la scène (départ par défaut du groupe), ou `null` si absent. |

**Jugement visuel** : capture de jeu (patron `scripts/qc/capture-jeu.mjs`) → planche par étage,
4 rotations, plan source en regard ; juges VISION en RÉFUTATION (pièces manquantes ou déformées,
ouvertures déplacées, proportions) — jamais une auto-certification du codeur.

## Où voir quoi — repères d'authoring

Le CONCEPT est éditorial, le chemin est ANCRÉ (un scénario renommé fait échouer la génération) :

| Pour… | Regarde |
|---|---|
| Cas trivial + `encounters` | `src/scenes/test-scenarios/bestiaire.ts`, `src/scenes/test-scenarios/magie.ts` |
| Relief pur (2 couches, rampes, falaise) | `src/scenes/test-scenarios/pont-vitrine.ts` |
| Multi-niveaux + logique (`triggers`/`dialogues` gatés) | `src/scenes/test-scenarios/opera.ts` |
| Box-drawing multi-étages (`walled`) + relief, grande carte | `src/scenes/opera/floorplan.ts` |
| Siège complet : relief + enceinte/porte brèchable + parapet + `bind` | `src/scenes/test-scenarios/siege-enceinte.ts` |
| Naval (coque/postes/équipage via `AuthoredEnemy`) | `src/scenes/test-scenarios/combat-naval.ts` |
| Murs-en-tuiles + `Condition` (herse) | `src/scenes/test-scenarios/piege-caveau.ts` |
| Multi-scènes + `worldMap` | `src/scenes/test-scenarios/voyage.ts` |
| Zones nommées (`zoneMap`) + harnais d’atteignabilité | `src/scenes/test-scenarios/zones-pieces.ts`, `src/state/mapQC.ts` |

## Où voir quoi — par CHAMP (mesuré)

Sur les 36 documents de `src/scenes/` qui exposent un littéral `MapSpec` :

| Champ | Documents | Exemples |
|---|---|---|
| `size` | 35 | `src/scenes/opera/floorplan.ts`, `src/scenes/test-scenarios/13-bataille-de-masse.ts`, `src/scenes/test-scenarios/14-voyage-maritime.ts`, `src/scenes/test-scenarios/15-commerce-fluvial.ts` … |
| `id` | 36 | `src/scenes/opera/floorplan.ts`, `src/scenes/test-scenarios/13-bataille-de-masse.ts`, `src/scenes/test-scenarios/14-voyage-maritime.ts`, `src/scenes/test-scenarios/15-commerce-fluvial.ts` … |
| `label` | 36 | `src/scenes/opera/floorplan.ts`, `src/scenes/test-scenarios/13-bataille-de-masse.ts`, `src/scenes/test-scenarios/14-voyage-maritime.ts`, `src/scenes/test-scenarios/15-commerce-fluvial.ts` … |
| `desc?` | 32 | `src/scenes/opera/floorplan.ts`, `src/scenes/test-scenarios/13-bataille-de-masse.ts`, `src/scenes/test-scenarios/14-voyage-maritime.ts`, `src/scenes/test-scenarios/15-commerce-fluvial.ts` … |
| `ambiance?` | 12 | `src/scenes/opera/floorplan.ts`, `src/scenes/test-scenarios/42-belier-porte.ts`, `src/scenes/test-scenarios/43-pastilles-entite.ts`, `src/scenes/test-scenarios/96-presets-edo.ts` … |
| `weather?` | 2 | `src/scenes/test-scenarios/14-voyage-maritime.ts`, `src/scenes/test-scenarios/voyage.ts` |
| `ambientLight?` | 6 | `src/scenes/test-scenarios/17-metamorphose-ulric.ts`, `src/scenes/test-scenarios/42-belier-porte.ts`, `src/scenes/test-scenarios/43-pastilles-entite.ts`, `src/scenes/test-scenarios/entrainement.ts` … |
| `metresPerTile?` | 4 | `src/scenes/test-scenarios/21-chute-du-greement.ts`, `src/scenes/test-scenarios/42-belier-porte.ts`, `src/scenes/test-scenarios/duel-naval.ts`, `src/scenes/test-scenarios/siege-enceinte.ts` |
| `startMessage?` | 32 | `src/scenes/test-scenarios/13-bataille-de-masse.ts`, `src/scenes/test-scenarios/14-voyage-maritime.ts`, `src/scenes/test-scenarios/15-commerce-fluvial.ts`, `src/scenes/test-scenarios/16-embuscade-fluviale.ts` … |
| `rest?` | 2 | `src/scenes/test-scenarios/echeance.ts`, `src/scenes/test-scenarios/voyage.ts` |
| `flags?` | 2 | `src/scenes/test-scenarios/opera.ts`, `src/scenes/vitrine-batiments.ts` |
| `terrain?` | 29 | `src/scenes/opera/floorplan.ts`, `src/scenes/test-scenarios/14-voyage-maritime.ts`, `src/scenes/test-scenarios/15-commerce-fluvial.ts`, `src/scenes/test-scenarios/16-embuscade-fluviale.ts` … |
| `legend?` | 7 | `src/scenes/opera/floorplan.ts`, `src/scenes/test-scenarios/96-presets-edo.ts`, `src/scenes/test-scenarios/embuscade.ts`, `src/scenes/test-scenarios/opera.ts` … |
| `markerFill?` | 1 | `src/scenes/test-scenarios/siege-enceinte.ts` |
| `levels?` | 7 | `src/scenes/test-scenarios/96-presets-edo.ts`, `src/scenes/test-scenarios/embuscade.ts`, `src/scenes/test-scenarios/entrainement.ts`, `src/scenes/test-scenarios/opera.ts` … |
| `walled?` | 1 | `src/scenes/opera/floorplan.ts` |
| `wallLegend?` | 1 | `src/scenes/opera/floorplan.ts` |
| `elevate?` | 1 | `src/scenes/test-scenarios/siege-enceinte.ts` |
| `cells?` | 1 | `src/scenes/test-scenarios/siege-enceinte.ts` |
| `walls?` | 5 | `src/scenes/test-scenarios/19-grimpant.ts`, `src/scenes/test-scenarios/42-belier-porte.ts`, `src/scenes/test-scenarios/99-revisit.ts`, `src/scenes/test-scenarios/zones-pieces.ts` … |
| `relief?` | 4 | `src/scenes/opera/floorplan.ts`, `src/scenes/test-scenarios/19-grimpant.ts`, `src/scenes/test-scenarios/opera.ts`, `src/scenes/test-scenarios/pont-vitrine.ts` |
| `terrainRects?` | 2 | `src/scenes/test-scenarios/zones-pieces.ts`, `src/scenes/vitrine-batiments.ts` |
| `architecture?` | 3 | `src/scenes/opera/floorplan.ts`, `src/scenes/test-scenarios/zones-pieces.ts`, `src/scenes/vitrine-batiments.ts` |
| `bind?` | 1 | `src/scenes/test-scenarios/siege-enceinte.ts` |
| `entities?` | 20 | `src/scenes/test-scenarios/18-effets-scriptes.ts`, `src/scenes/test-scenarios/21-chute-du-greement.ts`, `src/scenes/test-scenarios/43-pastilles-entite.ts`, `src/scenes/test-scenarios/96-presets-edo.ts` … |
| `heroStart?` | 33 | `src/scenes/test-scenarios/13-bataille-de-masse.ts`, `src/scenes/test-scenarios/14-voyage-maritime.ts`, `src/scenes/test-scenarios/15-commerce-fluvial.ts`, `src/scenes/test-scenarios/16-embuscade-fluviale.ts` … |
| `entryPoints?` | 1 | `src/scenes/opera/floorplan.ts` |
| `effectZones?` | 1 | `src/scenes/vitrine-batiments.ts` |
| `zoneMap?` | 2 | `src/scenes/opera/floorplan.ts`, `src/scenes/test-scenarios/zones-pieces.ts` |
| `zoneLegend?` | 2 | `src/scenes/opera/floorplan.ts`, `src/scenes/test-scenarios/zones-pieces.ts` |
| `triggers?` | 13 | `src/scenes/test-scenarios/17-metamorphose-ulric.ts`, `src/scenes/test-scenarios/18-effets-scriptes.ts`, `src/scenes/test-scenarios/95-poursuite-terrestre.ts`, `src/scenes/test-scenarios/97-enquete-carnet.ts` … |
| `dialogues?` | 11 | `src/scenes/test-scenarios/18-effets-scriptes.ts`, `src/scenes/test-scenarios/96-presets-edo.ts`, `src/scenes/test-scenarios/97-enquete-carnet.ts`, `src/scenes/test-scenarios/98-conditions-etendues.ts` … |
| `encounters?` | 15 | `src/scenes/test-scenarios/13-bataille-de-masse.ts`, `src/scenes/test-scenarios/16-embuscade-fluviale.ts`, `src/scenes/test-scenarios/17-metamorphose-ulric.ts`, `src/scenes/test-scenarios/21-chute-du-greement.ts` … |
| `stations?` | 1 | `src/scenes/test-scenarios/13-bataille-de-masse.ts` |

Champs sans aucun exemple mesuré dans `src/scenes/` : `music?`, `knownUnsupportedFloor?`, `seatAssignments?`, `restZones?` — leur seule démonstration vit dans `src/state/mapSpec.test.ts`.
<!-- sources-empreinte: c40001858f67dffe0b96289e72224b91ceaf05a5 (64 fichiers, 7 dossiers) corps: 0cf3a85725e6616358b80f72966db4d310aa7014 -->
