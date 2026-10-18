# Orientation-monde persistante + consolidation de la couche tokens

*Spec — 2026-06-07. Sous-projet : refonte du facing (orientation des personnages) et
unification des tokens de rendu isométrique.*

## 1. Problème

L'orientation des personnages est **calculée en espace-écran, de façon éphémère, sur
événement** — au lieu d'être une orientation **en espace-monde, persistante, par entité**.
Concrètement le facing vit dans un `useState({view, mirror})` local à chaque token,
recalculé via `screenDir`/`facingView` uniquement quand un événement `ANIM_MOVE` /
`ANIM_ATTACK` passe sur le bus.

Conséquences observées (tous symptômes, une seule cause racine) :

1. **Tourner la caméra ne ré-oriente pas les sprites.** Un token immobile garde son
   `{view,mirror}` calculé sous l'ancien `camRot` → il pointe au mauvais endroit. Rien
   ne ré-émet ni ne recalcule sur `rotateCam` (`store.ts:440-441`).
2. **Les combattants au repos ne se regardent jamais.** Défaut `{view:'front'}` (vers la
   caméra) ; aucune logique « au repos, se tourner vers l'ennemi ».
3. **Au spawn**, tout token regarde la caméra, même un ennemi placé derrière le groupe.
4. **Le défenseur ne se tourne pas** vers son attaquant quand il est frappé
   (`RigToken.tsx:81-91` joue parade/esquive sans appeler `face(...)`).
5. **En exploration**, `moveParty` (`store.ts:683-696`) n'émet pas `ANIM_MOVE` → le groupe
   ne se tourne pas en marchant.
6. **Déplacements d'une seule case** ne mettent pas à jour le facing (garde
   `path.length > 1` dans les 3 handlers).
7. **Facing non persistant** : étant un état React local, tout remount (explore↔combat,
   save/load) le réinitialise à `front`.
8. **Entités d'ambiance** (`AmbientRigToken`, ex. « mutant dévore ») : jamais ré-orientées,
   bloquées face-caméra à vie (ne reçoivent aucun `ANIM_*`).

En plus de la cause racine, l'audit a révélé une **duplication massive** dans la couche de
rendu des tokens (le « on a empilé fonctionnalités sur fonctionnalités »), et du **code
mort** à supprimer. Le présent sous-projet corrige la racine **et** consolide la couche.

## 2. Objectifs / non-objectifs

**Objectifs**
- Orientation **purement visuelle** (le moteur `src/engine` reste pur ; aucun bonus de
  flanc/dos — cf. règle d'or « ne rien inventer »).
- Orientation **en espace-monde, persistante**, source de vérité unique.
- Le rendu devient une **pure projection** de `(orientation-monde, camRot)` → les sprites se
  ré-orientent **à chaque rendu** (corrige la rotation caméra sans aucun événement).
- **Consolider** la couche tokens : supprimer la triplication facing/miroir/positionnement/
  bus/mort derrière une coquille unique.
- **Supprimer le legacy vérifié-mort** de la zone rendu.
- **Orientation initiale éditable** dans l'éditeur.

**Non-objectifs**
- Pas de règles de combat de flanc/dos (visuel seulement).
- Pas de rotation 3D du rig (le rig est un paper-doll 2D ; on garde le snap 8→3 vues + miroir
  — cf. `.claude/rules/rendu-et-rig.md`).
- Pas de caméra à 8 positions (la projection iso ne gère que les paliers de 90° ; un vrai 45°
  serait un autre chantier). **Caméra = 4 positions ; orientation perso = 8 directions.**

## 3. Modèle de données

### 3.1 Type `Dir8` (espace-monde, grille)

```ts
export type Dir8 = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SO' | 'O' | 'NO';
```

- Espace-**monde** (grille), **pas** écran. `'O'` = Ouest (convention FR existante).
- 8 directions = les 4 cardinales + 4 diagonales (un ennemi peut être en diagonale d'une
  case). Le rendu ramène ensuite ces 8 à **3 vues d'art (face/dos/profil) + miroir** ; 8 est
  donc « sans perte » pour ce que le moteur de rendu sait afficher.
- Table de correspondance `Dir8 ⇄ delta grille` `{gx, gy} ∈ {-1,0,1}²\{0,0}` (fonction pure,
  testée) — l'ancrage exact des cardinales sur la grille est figé par les tests de
  projection (§4) et la recette navigateur.

### 3.2 Où vit l'orientation (couche state, jamais le moteur)

- **Authoring (scène)** : `SceneEntity.facing` (`scene.ts:91`) — champ **déjà présent mais
  mort** (4-dir `Facing`, jamais lu au rendu). On le **retype `facing?: Dir8`** :
  cela supprime le legacy 4-dir *et* alimente l'orientation authored. `BuildingFeature.facing`
  (`scene.ts:129`, 4-dir, utilisé pour les portes) reste **intact**.
- **Runtime (store)** : une table d'orientation vivante par entité/combattant, p. ex.
  `facing: Record<EntityId, Dir8>` dans l'état du store, sérialisée avec l'état → survit aux
  remounts explore↔combat (corrige le trou n°7). Le `Combatant` du moteur
  (`engine/types.ts`) **n'est pas touché** (engine pur).
- **Fallback de lecture** : `store.facing[id]` → sinon `SceneEntity.facing` (authored) →
  sinon défaut `'S'` (face caméra).

## 4. Projection (le cœur — corrige la rotation caméra)

Une **fonction pure** dans `src/gameIso/rig/facing.ts` :

```ts
export function project(dir: Dir8, camRot: Rot): { view: View; mirror: boolean }
```

- Réutilise les primitives existantes : rotation du delta-grille de `dir` par `camRot` (même
  logique que `rotTile`, `iso.ts:33-46`), puis skew iso (`dx = rgx − rgy`, `dy = rgx + rgy`),
  puis l'actuel `facingView(dx, dy)` (`facing.ts:7-12`).
- Recalculée **à chaque rendu** par chaque token. Comme l'orientation est en **monde** et que
  la projection relit `camRot`, **tourner la caméra ré-oriente automatiquement** (trou n°1)
  — aucun événement émis.
- **Lire `camRot` (la cible), pas `shownRot`** (la rotation d'affichage différée de la
  transition « dim-and-turn », `IsoStage.tsx:84,261`), pour que le facing ne traîne pas
  derrière la transition.

Fonction pure compagnonne :

```ts
export function facingToward(from: {x:number;y:number}, to: {x:number;y:number}): Dir8
```

Snap du delta-grille `(to − from)` vers la `Dir8` la plus proche. Utilisée par les
déclencheurs (§5). Pure → testée.

> `screenDir` (`facing.ts:16-24`) et `facingView` (`facing.ts:7-12`) **restent** (le type
> `View` et le mapping front/dos/profil/miroir sont toujours nécessaires) ; seuls les appels
> per-composant changent.

## 5. Déclencheurs (quand on écrit `facing` dans le store)

L'orientation-monde est écrite **dans la même mutation pré-émission** que les positions
(éviter le piège « setState puis relire l'état périmé dans le même tick », cf. note projet) :

| Moment | Orientation posée | Site | Corrige |
|---|---|---|---|
| Entrée en combat / spawn | vers l'ennemi engagé / le plus proche (ou `SceneEntity.facing` si authored) | flux d'init combat / `spawn.ts` | 2, 3 |
| Déplacement (combat) | direction du dernier pas (`facingToward(p[len-2], p[len-1])`) | `store.ts:1005-1006` (héros), `:1044` (charge), `combatFlow.ts:1205-1206` (IA) | 6 |
| Déplacement (exploration) | direction de marche | `moveParty` (`store.ts:683-696`) | 5 |
| Attaque | attaquant → cible | avant émission `combatFlow.ts:554` (mêlée/dist.), `:936/:982` (sorts) | — (déjà, mais persisté) |
| Frappé | défenseur → attaquant | dans l'application des dégâts / réaction défenseur | 4 |
| Rotation caméra | *rien* (pure projection, §4) | — | 1 |

**Comportement au repos** (réponse utilisateur) : orientation **posée à l'entrée en
combat/au spawn vers l'ennemi engagé**, puis **stable** — ne change que sur ses propres
actions (bouger/attaquer) ou quand l'entité est **frappée**. Pas de suivi continu (pas de
tremblotement).

**Entités d'ambiance** : leur orientation vient de `SceneEntity.facing` (authored) → projetée
au rendu comme tout le monde. Plus de blocage face-caméra (trou n°8) et ré-orientation
correcte à la rotation caméra, gratuitement.

## 6. Couche rendu — tokens dérivés au rendu

`RigToken`, `AnimatedPlanToken` **lisent `facing` du store + `camRot`** et appellent
`project(...)` à chaque rendu, au lieu du `useState({view,mirror})` éphémère piloté par le
bus. On supprime :

- `RigToken.tsx` : la closure `face` (`:64-71`), ses appels (`:74-75`, `:97-98`), le
  `useState` facing (`:49`)/`setFacing`. Les lectures `:119-120` deviennent
  `const {view,mirror} = project(facingOf(id), camRot)`.
- `AnimatedPlanToken.tsx` : la closure `face` (`:33-39`), ses appels (`:54-55`, `:62`), le
  `useState` (`:22`). Le handler d'attaque n'a plus besoin de lire `battle.combatants`
  (`:61`) pour le facing.

**Séparation nette** :
- **Orientation = store (monde), projetée au rendu** ;
- **Animation transitoire = bus** (inchangé) : `ANIM_MOVE`/`ANIM_ATTACK`/`ANIM_IMPACT`
  continuent de porter la marche/lunge/parade/esquive/coup-reçu/dégâts flottants. Une pose
  transitoire **est** événementielle (début + décroissance) → reste sur le bus.

## 7. Consolidation des tokens (`BodyToken` + `BodyBackend`)

L'audit a trouvé : facing **×3**, miroir **×3 divergent** (120 vs 160), wrapper de
positionnement **×4** (`token()` `IsoStage.tsx:347-369`, `tokenNode()` `:372-385`,
`EntityToken` `EntityToken.tsx:20-31`, `placeSprite()` `sprites.ts:16-20`), câblage bus + mort
**×3**.

**Cible** : une **coquille unique `BodyToken`** qui porte tout le *partagé* et délègue
**seulement les pixels du corps** à un `BodyBackend` :

- **Concerns partagés (coquille)** : positionnement (ombre + `translate(cx,feetY)` + box
  `translate(-60s,-150s) scale(s)` + `dim`/walking timing), **facing** (lecture store + `project`),
  **miroir** (un wrapper paramétré par `boxWidth` du backend → le 120/160 devient une
  constante déclarée), **câblage bus** (une souscription `ANIM_*` filtrée par `id` → interface
  d'animation du backend), **mort/cadavre** (une convention + opt-out `bakedDeath`).
- **Concerns par backend (interface `BodyBackend`)** : `boxWidth`, `views` supportées, et la
  production du markup corps pour `(view, mirror, animState, colors/appearance, dead)`.
  Deux implémentations **vivantes** :
  - **rig** (humanoïde) : enveloppe l'actuel `RigToken` (`RigSprite` + `useRigClip` + clips
    arme/sort/ambiance + `CORPSE_POSE`).
  - **plan** (non-bipède) : enveloppe l'actuel `AnimatedPlanToken` (`plan.resolve` + sampler
    rest/walk/attack + `idle/deathPose`) ; **gagne le mode rest statique** pour que
    l'exploration et l'éditeur passent par le **même** backend (fin de l'asymétrie où les
    non-bipèdes d'exploration tombaient sur un SVG statique sans facing ni anim).
- **Dispatch** : une fonction unique `pickBackend(entityOrCombatant)` encapsulant l'échelle
  actuelle `isHero / enemyRigProfile / entityRigProfile / bodyPlanOf`. Les deux sites
  d'`IsoStage` (combat + exploration) **et** l'éditeur lisent `pickBackend(x)` → `<BodyToken>`.
- `EntityToken` (4e copie de wrapper, éditeur uniquement) **est absorbé** par `BodyToken`.
- Le markup corps (`RigSprite`, `plan.resolve`) n'est **pas** modifié ; chaque backend garde
  son propre moteur d'animation en interne.

## 8. Suppression du legacy (registre, vérifié)

| Cible | Réf | Verdict | Preuve |
|---|---|---|---|
| Branche monolithique en combat | `IsoStage.tsx:424-429` | **SUPPRIMER** | `bodyPlanOf` ne renvoie jamais `'monolithic'` (0 def) → inatteignable |
| `creatureFx` state+effet | `IsoStage.tsx:172-190` | **SUPPRIMER** | consommé seulement par la branche morte `:428` |
| `creatureFacing` state+effet | `IsoStage.tsx:194-214` | **SUPPRIMER** | consommé seulement par `:426-428` (morte) |
| Import `facingView,screenDir` dans IsoStage | `IsoStage.tsx:41` | **SUPPRIMER** | utilisé seulement par les effets morts |
| Param `mirror` de `token()` + wrapper miroir | `IsoStage.tsx:347,364` | **SUPPRIMER** (après) | jamais truthy hors branche morte |
| `hasCreatureViews()` | `sprites.ts:128-130` | **SUPPRIMER** | 0 appelant (def + test) |
| `SceneEntity.facing` 4-dir | `scene.ts:91` | **RETYPER → `Dir8`** | mort en 4-dir ; réutilisé en 8-dir authored |
| Note « code Phaser src/game/ » | `Game/CLAUDE.md` | **CORRIGER** (doc) | `src/game/` n'existe plus |
| `creatureView` + `creatureViews.json` + `CREATURE_VIEWS*` | `sprites.ts:108-125` | **GARDER** | mort dans l'app **mais vivant en outillage QC** (`_qc-*`, `_ref-*`, `_ingest-*`) — décision utilisateur : garder le cluster QC |
| `enemySprite`/`creatureSprites.json`/`composeAppearance`/`entitySprite` | `sprites.ts`,`appearance.ts` | **GARDER** | fallback vivant entités/éditeur (`EntityToken.tsx:27`, `IsoStage.tsx:453`) |
| `facing.ts` (fichier) | `rig/facing.ts` | **GARDER** | `View` + `facingView` + `screenDir` toujours utilisés |

Tests couplés à mettre à jour : `creatureView.test.ts` reste vert (cluster gardé) ; vérifier
`appearance.test.ts:51-126` (cas fallback). Aucune scène n'a de `facing` authored au niveau
entité (vérifié `src/scenes`).

## 9. Éditeur

Ajout d'un sélecteur **« Orientation »** (8 directions `Dir8`) dans l'inspecteur d'entité
(`Editor.tsx:1035-1212`, qui n'expose aujourd'hui aucun contrôle d'orientation entité),
écrivant `SceneEntity.facing` — en miroir du sélecteur d'orientation déjà présent pour les
**bâtiments** (`Editor.tsx:959-972`). Le spawn respecte l'orientation authored (§5).

## 10. Tests + recette

**Unitaires (purs — aucun timer)** : c'est là qu'on verrouille le comportement (couverture
facing ≈ zéro aujourd'hui).
- `project(dir, camRot)` : table de vérité **8 dirs × 4 rotations = 32 cas** → `{view, mirror}`
  attendu (épingle la correction caméra).
- `facingToward(from, to)` → `Dir8` (snap du delta grille, cas cardinaux + diagonaux + nul).
- Sélection d'orientation à l'entrée en combat (ennemi le plus proche/engagé) à partir de
  positions données.

**Store/intégration** : après `rotateCam`, la vue projetée d'un combattant immobile change
correctement **sans** modifier `store.facing` (dérivée).

**Recette navigateur** (scénario de test combat, cf. `docs/test-scenarios.md`) :
spawn → les ennemis se regardent ; **Q/E** → orientations correctes après rotation ;
attaque → l'attaquant se tourne ; coup reçu → le défenseur se tourne ; marche en exploration
→ le groupe se tourne ; entité d'ambiance orientée + ré-orientée à la rotation.

**Pièges** (notes projet) : `vi.useFakeTimers()` + `clearAllTimers` pour tout test touchant
les timers/rAF des tokens ; lire la modale via `.roll-modal` si recette ; recharger franc
(HMR périmé).

## 11. Phasage (chaque phase livrable + testable seule)

- **P0 — Nettoyage legacy** (zéro changement de comportement) : §8 — suppression branche
  monolithique morte + effets/imports morts + `hasCreatureViews` + correction note CLAUDE.md ;
  retype `SceneEntity.facing → Dir8`. Réduit la surface avant refactor. `npm test` + typecheck verts.
- **P1 — Modèle facing-monde + projection** : §3, §4, §6 — `Dir8`, `project()` + tests (32),
  `facingToward()`, table `facing` store, tokens dérivés au rendu (suppr. des `useState`),
  écriture au move/attaque. → corrige 1, 6, 7 + cohérence move/attaque.
- **P2 — Comportements au repos** : §5 — début combat/spawn face ennemi, défenseur face
  attaquant, facing exploration, entités d'ambiance. → corrige 2, 3, 4, 5, 8.
- **P3 — Consolidation `BodyToken`** : §7 — coquille + backends (rig/plan), unif.
  positionnement/miroir/bus/mort, exploration non-bipèdes + éditeur sur chemin unifié,
  absorption `EntityToken`.
- **P4 — Éditeur** : §9 — sélecteur orientation + respect authored au spawn.

> Ordre choisi : legacy d'abord (surface réduite), puis le fix que l'utilisateur a signalé
> (P1+P2, avec tests), puis le gros refactor (P3) dé-risqué par les tests de facing et un
> backend monolithique déjà supprimé, puis l'éditeur. Réordonnançable au plan.

## 12. Risques

- **P3 (consolidation)** est le morceau le plus risqué : deux moteurs d'animation distincts
  (`useRigClip` tween vs boucle rAF du plan) restent **internes aux backends** ; la coquille
  n'unifie que facing/miroir/positionnement/bus/mort. Mitigation : P3 après P1/P2 (tests
  facing en place) ; golden/structure tests des tokens avant/après.
- **Ancrage des cardinales `Dir8` sur la grille** : figé par les 32 cas de `project()` +
  recette ; risque d'inversion gauche/droite → la recette navigateur tranche.
- **Sérialisation** de `store.facing` : vérifier save/load (entrée/sortie combat) ; entrées
  périmées après mort = inoffensives.
- **Engine pur** : aucune lecture de facing dans `src/engine` ; garde-fou = revue + tests
  moteur inchangés verts.
