# Consommateurs par champ — GÉNÉRÉ

> ⚠️ Fichier GÉNÉRÉ par `npx tsx scripts/docs/build-field-consumers.mts` (`npm run docs:field-consumers`) — NE PAS ÉDITER À LA MAIN.
> Pour chaque type de référence PARTAGÉ, qui LIT chaque champ (accès/déstructuration résolus au
> `TypeChecker`, cf. `scripts/guards/lib/fieldConsumers.mjs`). Complète
> `docs/orphelines-donnees.md` (consommateurs d'ENTITÉ) — ici, consommateurs de CHAMP.

## Périmètre mesuré / angles morts

Schémas NOMMÉS candidats : `src/data/schemas/grammaire/` (formes partagées entre documents) + les `src/data/schemas/defs/` dont les sous-schémas sont nommés (`criticals.ts`, `props.ts`) ; **23 retenus** (voir en-tête du générateur pour les raisons d'exclusion). Les catalogues `src/data/schemas/defs/*.ts` à schéma d'entrée ANONYME restent HORS PÉRIMÈTRE — non par absence de nom TS : l'alias existe pour la plupart (41 interfaces `XData` dans `src/data/index.ts`, mesure 2026-09-01 — ex. `TrappingData` `index.ts:1113`, annotée par `src/engine/items.ts:20` et `src/engine/activities.ts:28`) et les champs d'une entrée anonyme sont dérivables (`scripts/docs/lib/zod-introspect.mts#introspecterDefs`) —, mais parce que la DÉRIVATION de `TARGETS` (jointure `type`↔`XData`) est un geste distinct, encore à faire (#1620) ; à l'unité, le geste d'auteur reste ouvert (nommer son schéma d'entrée dans SON def — ou en `grammaire/` si la forme est réellement partagée — puis l'ajouter à `TARGETS`), fait pour `props.json` → `PropData`.

Détection au VÉRIFICATEUR DE TYPES (`ts.Program`/`TypeChecker`) : un lecteur est un accès dont le SYMBOLE de propriété est celui déclaré par le type cible, la propriété devant lui être PROPRE ou son porteur être DÉCLARÉ de ce type — aucune annotation littérale n'est cherchée, et un type anonyme de même forme ne crédite rien. Quatre états sont mesurés, dont deux ne sont pas des mesures de lecture (hérité, absent du type TS) ; ceux qui ont des membres ici : **146 lus** ; **5 « 0 — JAMAIS LU »** (`SourceRef.note`, `CastingNumberMod.maison`, `CastingNumberMod.source`, `CastingNumberMod.desc`, `PropData.type`) — champ PROPRE au type, aucun lecteur ; **8 absents du type TS** (`AdvancementRef.table`, `PropData.labelF`, `PropData.desc`, `PropData.descRef`, `PropData.source`, `PropData.alsoIn`, `PropData.maison`, `PropData.icon`) — le champ du schéma n'existe pas sur le type : divergence schéma↔type, listée en fin de rapport, sur 159 champs de 23 types.

Le détecteur SYNTAXIQUE qui a précédé (annotation littérale du type) rendait 41 champs « 0 lecteur » sur ces mêmes 159. Des 16 « 0 lecteur » de la première version de ce rapport (échantillon COMPLET), 12 ont un lecteur mesuré — dont `argDifficulty` et `stageOutcome`, qu'une vérification à la main manque comme le scan syntaxique, `spec` d'une `QualityRef` (champ PROPRE : `qualityRefSchema` porte son propre shape) et `hidden` d'un `TraitInstance` (`hiddenGroupsOf` annote `TraitInstance[]`) ; les 4 autres sont de vrais zéros. Coût : ~17 s et ~1,3 Go pour un rapport complet, contre 1,8 s au scan syntaxique. Angles morts (redéclaration structurelle, spread, clé dynamique, champ absent du type) : en-tête de `fieldConsumers.mjs`.

### `TraitInstance` (src/engine/statEntry.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `id` | 66 | `src/engine/actorView.ts:28` |
| `value` | 14 | `src/engine/creatureAttacks.ts:80` |
| `arg` | 17 | `src/engine/creatureAttacks.ts:77` |
| `count` | 4 | `src/engine/creatureAttacks.ts:85` |
| `range` | 6 | `src/engine/creatureEquip.ts:81` |
| `natural` | 1 | `src/engine/creatureEquip.ts:87` |
| `hidden` | 1 | `src/engine/groups.ts:57` |

### `SourceRef` (src/data/schemas/grammaire/valeurs.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `book` | 11 | `src/data/sourceRefs.ts:29` |
| `page` | 10 | `src/ui/CarnetScreen.tsx:26` |
| `note` | **0 — JAMAIS LU** | — |

### `DetailRecipe` (src/gameIso/detail/types.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `courses` | 20 | `src/gameIso/authoring/detailSvg.ts:120` |
| `bands` | 1 | `src/gameIso/detail/expand.ts:101` |
| `timber` | 9 | `src/gameIso/authoring/detailSvg.ts:352` |
| `speckle` | 9 | `src/gameIso/authoring/detailSvg.ts:333` |
| `tufts` | 10 | `src/gameIso/authoring/detailSvg.ts:410` |
| `tintVar` | 4 | `src/gameIso/authoring/detailSvg.ts:177` |
| `seedScope` | 4 | `src/gameIso/authoring/detailSvg.ts:334` |

### `DiceSpec` (src/engine/dice.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `n` | 17 | `src/engine/dice.ts:83` |
| `sides` | 18 | `src/engine/dice.ts:83` |
| `plus` | 9 | `src/engine/dice.ts:83` |

### `Ref` (src/data/index.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `id` | 62 | `src/data/index.ts:3073` |
| `spec` | 18 | `src/data/index.ts:3595` |

### `QualityRef` (src/data/index.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `id` | 5 | `src/data/index.ts:3607` |
| `value` | 4 | `src/data/index.ts:3608` |

### `CastingNumberMod` (src/engine/castingNumber.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `multiply` | 2 | `src/engine/castingNumber.ts:109` |
| `divide` | 2 | `src/engine/castingNumber.ts:110` |
| `round` | 2 | `src/engine/castingNumber.ts:110` |
| `delta` | 2 | `src/engine/castingNumber.ts:111` |
| `min` | 2 | `src/engine/castingNumber.ts:112` |
| `scope` | 2 | `src/engine/castingNumber.ts:127` |
| `maison` | **0 — JAMAIS LU** | — |
| `source` | **0 — JAMAIS LU** | — |
| `desc` | **0 — JAMAIS LU** | — |

### `CountSpec` (src/data/index.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `fixed` | 4 | `src/data/index.ts:3676` |
| `roll` | 3 | `src/data/index.ts:3676` |

### `TrappingRef` (src/data/index.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `id` | 8 | `src/engine/items.ts:307` |
| `spec` | 2 | `src/engine/items.ts:309` |
| `count` | 10 | `src/data/index.ts:3676` |
| `qualities` | 4 | `src/data/index.ts:3679` |
| `qualityChoice` | 6 | `src/data/index.ts:3677` |
| `text` | 2 | `src/data/index.ts:3670` |
| `vehicleId` | 5 | `src/data/index.ts:3672` |
| `label` | 7 | `src/engine/possessionGrants.ts:25` |
| `creatureId` | 5 | `src/data/index.ts:3674` |
| `choice` | 5 | `src/data/index.ts:3667` |
| `wildcard` | 3 | `src/data/index.ts:3668` |

### `AdvancementRef` (src/data/index.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `id` | 8 | `src/data/index.ts:3649` |
| `spec` | 2 | `src/engine/careerSlots.ts:170` |
| `choix` | 7 | `src/data/index.ts:3073` |
| `pick` | 2 | `src/data/index.ts:3652` |
| `of` | 6 | `src/data/index.ts:3651` |
| `table` | — | *absent du type TS* |
| `random` | 3 | `src/data/index.ts:3654` |

### `EntityAppearance` (src/engine/authoringAppearance.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `seed` | 5 | `src/gameIso/rig/enemyProfile.ts:115` |
| `monster` | 11 | `src/gameIso/rig/enemyProfile.ts:144` |
| `colors` | 13 | `src/gameIso/rig/bodyPlan.ts:122` |
| `parts` | 5 | `src/gameIso/rig/enemyProfile.ts:61` |
| `sex` | 8 | `src/gameIso/rig/enemyProfile.ts:60` |
| `build` | 8 | `src/gameIso/rig/enemyProfile.ts:60` |
| `species` | 18 | `src/gameIso/rig/bodyPlan.ts:168` |
| `tenue` | 7 | `src/gameIso/rig/enemyProfile.ts:98` |
| `harnais` | 2 | `src/gameIso/rig/bodyPlan.ts:124` |
| `armurePortee` | 5 | `src/gameIso/rig/enemyProfile.ts:193` |
| `eyes` | 13 | `src/gameIso/rig/bodyPlan.ts:123` |
| `features` | 9 | `src/gameIso/rig/enemyProfile.ts:61` |

### `FlowTest` (src/engine/flowCore.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `stake` | 10 | `src/engine/flowCore.ts:841` |
| `skill` | 30 | `src/engine/disease.ts:371` |
| `sense` | 2 | `src/state/combatEffects.ts:1011` |
| `characteristic` | 24 | `src/engine/disease.ts:371` |
| `difficulty` | 8 | `src/engine/disease.ts:358` |
| `requireSL` | 2 | `src/state/combatEffects.ts:1050` |
| `label` | 11 | `src/state/combat/triggeredTest.ts:235` |
| `tool` | 2 | `src/state/combatEffects.ts:1013` |
| `vsGroups` | 5 | `src/state/combatEffects.ts:918` |
| `vsStatus` | 1 | `src/state/combatEffects.ts:917` |
| `begging` | 3 | `src/state/combatEffects.ts:922` |
| `vsCapricieux` | 1 | `src/state/combatEffects.ts:926` |
| `easierIf` | 11 | `src/state/combatEffects.ts:967` |
| `argDifficulty` | 1 | `src/state/triggeredEffects.ts:75` |
| `unlessImmune` | 1 | `src/state/combat/flowEval.ts:137` |
| `onlyGroups` | 1 | `src/state/combat/flowEval.ts:138` |
| `exceptGroups` | 1 | `src/state/combat/flowEval.ts:139` |
| `gate` | 1 | `src/engine/flowCore.ts:384` |
| `noSupport` | 4 | `src/state/combat/triggeredTest.ts:817` |
| `menace` | 7 | `src/state/combat/triggeredTest.ts:245` |
| `difficultyBy` | 1 | `src/engine/flowCore.ts:378` |
| `opposed` | 5 | `src/state/combat/triggeredTest.ts:304` |

### `TravelTableEntry` (src/engine/travelTables.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `min` | 2 | `src/state/travelFlow.ts:1154` |
| `max` | 1 | `src/ui/compendium/registry.ts:822` |
| `id` | 8 | `src/engine/mountTravel.ts:217` |
| `label` | 8 | `src/engine/mountTravel.ts:201` |
| `desc` | 1 | `src/state/travelPostes.ts:362` |
| `stageOutcome` | 1 | `src/state/travelPostes.ts:363` |
| `vehicleWounds` | 3 | `src/engine/vehicle.ts:59` |
| `occupantOps` | 3 | `src/state/travelFlow.ts:1158` |
| `mount` | 2 | `src/engine/mountTravel.ts:202` |

### `ShipCrewHit` (src/data/shipCriticals.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `crewTarget` | 2 | `src/engine/shipCritical.ts:243` |
| `test` | 5 | `src/engine/shipCritical.ts:66` |
| `ops` | 2 | `src/engine/shipCritical.ts:246` |

### `ShipCritEntry` (src/data/shipCriticals.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `min` | 1 | `src/ui/compendium/registry.ts:845` |
| `max` | 1 | `src/ui/compendium/registry.ts:845` |
| `id` | 3 | `src/data/index.ts:499` |
| `label` | 2 | `src/engine/shipCritical.ts:107` |
| `ops` | 3 | `src/engine/riverNavigation.ts:213` |
| `shrapnel` | 3 | `src/engine/shipCritical.ts:110` |
| `hullCrits` | 2 | `src/engine/shipCritical.ts:103` |
| `crewHit` | 2 | `src/engine/shipCritical.ts:112` |
| `note` | 2 | `src/engine/shipCritical.ts:113` |

### `PropData` (src/data/props.types.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `id` | 11 | `src/data/props.types.ts:595` |
| `type` | **0 — JAMAIS LU** | — |
| `label` | 1 | `src/ui/compendium/registry.ts:325` |
| `labelF` | — | *absent du type TS* |
| `desc` | — | *absent du type TS* |
| `descRef` | — | *absent du type TS* |
| `source` | — | *absent du type TS* |
| `alsoIn` | — | *absent du type TS* |
| `maison` | — | *absent du type TS* |
| `icon` | — | *absent du type TS* |
| `solid` | 2 | `src/data/props.types.ts:641` |
| `opaque` | 3 | `src/data/props.types.ts:600` |
| `cover` | 3 | `src/data/props.types.ts:600` |
| `light` | 3 | `src/data/props.types.ts:610` |
| `foot` | 2 | `src/data/props.types.ts:382` |
| `volume` | 18 | `src/data/index.ts:2810` |
| `seatSlots` | 5 | `src/data/props.types.ts:412` |

### `PropVolumeRecipe` (src/data/props.types.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `capIdentite` | 2 | `src/data/props.types.ts:594` |
| `primitives` | 6 | `src/data/props.types.ts:461` |

### `PropPrimitive` (src/data/props.types.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `kind` | 7 | `src/data/props.types.ts:285` |
| `center` | 6 | `src/data/props.types.ts:285` |
| `size` | 3 | `src/data/props.types.ts:285` |
| `material` | 4 | `src/data/props.types.ts:567` |
| `emet` | 2 | `src/data/props.types.ts:607` |
| `axis` | 2 | `src/data/props.types.ts:286` |
| `radiusM` | 2 | `src/data/props.types.ts:286` |
| `longueurM` | 2 | `src/data/props.types.ts:286` |
| `sides` | 2 | `src/data/props.types.ts:286` |
| `slope` | 1 | `src/data/props.types.ts:287` |

### `PropSeatSlot` (src/data/props.types.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `id` | 5 | `src/data/props.types.ts:615` |
| `anchor` | 5 | `src/data/props.types.ts:413` |
| `facing` | 1 | `src/state/seating.ts:157` |
| `approach` | 2 | `src/data/props.types.ts:540` |

### `PropPoint3` (src/data/props.types.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `xM` | 16 | `src/data/props.types.ts:173` |
| `yM` | 16 | `src/data/props.types.ts:172` |
| `hM` | 15 | `src/data/props.types.ts:172` |

### `PropSize3` (src/data/props.types.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `xM` | 3 | `src/data/props.types.ts:202` |
| `yM` | 3 | `src/data/props.types.ts:203` |
| `hM` | 3 | `src/data/props.types.ts:204` |

### `CritEscalation` (src/data/criticals.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `perRound` | 1 | `src/engine/trauma.ts:577` |
| `apresDelai` | 2 | `src/engine/trauma.ts:578` |
| `medicalAidGate` | 2 | `src/engine/trauma.ts:582` |
| `bleedOnReinjury` | 2 | `src/engine/trauma.ts:593` |
| `onRepeat` | 1 | `src/engine/critical.ts:312` |
| `onNextCritWhileCondition` | 2 | `src/engine/trauma.ts:605` |
| `onHealGrant` | 2 | `src/engine/trauma.ts:599` |

### `Amputation` (src/data/criticals.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `difficulty` | 1 | `src/engine/critical.ts:87` |
| `sequels` | 1 | `src/engine/critical.ts:76` |
| `unites` | 1 | `src/engine/critical.ts:77` |
| `timing` | 2 | `src/engine/critical.ts:327` |
| `loss` | 4 | `src/engine/critical.ts:74` |

## Champs du schéma ABSENTS du type TS

8 champs déclarés au SCHÉMA n'existent pas sur le type TS de leur `home` : `AdvancementRef.table`, `PropData.labelF`, `PropData.desc`, `PropData.descRef`, `PropData.source`, `PropData.alsoIn`, `PropData.maison`, `PropData.icon`. Divergence schéma↔type — ni lus ni lisibles, hors du compte des « 0 lecteur ».

## Synthèse

23 types, 159 champs mesurés : 146 lus, **5 avec « 0 lecteur » mesuré** au `TypeChecker`, 0 hérité, 8 absents du type TS. Ces « 0 lecteur » sont sous CLIQUET NOMINATIF (`src/data/field-consumers.test.ts`) : la liste attendue y est écrite champ par champ — un zéro apparu comme un zéro disparu est rouge, et la ligne ne se retire qu'avec le lecteur qui l'annule.

## Cas fondateur

Le champ `spec` d'une référence de dotation a 2 lecteur(s) mesuré(s) — `src/engine/items.ts:309`, `src/engine/trappingChoices.ts:36`.

`trappingRefLabel` (`src/data/index.ts`, SOURCE UNIQUE du libellé affiché d'une `TrappingRef`) ne lit PAS `ref.spec` — le rendu « base (spec) » passe par `refConcrete`, partagée par toute `Ref`.
<!-- sources-empreinte: b218fac1bdea4239fc1512c6a94441229bb57527 (2106 fichiers, 171 dossiers) corps: c6ae89f2eafdeb22e64464f02fd8dfc40f05472c -->
