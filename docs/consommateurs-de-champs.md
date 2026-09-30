# Consommateurs par champ — GÉNÉRÉ

> ⚠️ Fichier GÉNÉRÉ par `npx tsx scripts/docs/build-field-consumers.mts` (`npm run docs:field-consumers`) — NE PAS ÉDITER À LA MAIN.
> Pour chaque type de référence PARTAGÉ, qui LIT chaque champ (accès/déstructuration résolus au
> `TypeChecker`, cf. `scripts/guards/lib/fieldConsumers.mjs`). Complète
> `docs/orphelines-donnees.md` (consommateurs d'ENTITÉ) — ici, consommateurs de CHAMP.

## Périmètre mesuré / angles morts

Schémas NOMMÉS candidats : `src/data/schemas/grammaire/` (formes partagées entre documents) + les `src/data/schemas/defs/` dont les sous-schémas sont nommés (`criticals.ts`, `props.ts`) ; **23 retenus** (voir en-tête du générateur pour les raisons d'exclusion). Les catalogues `src/data/schemas/defs/*.ts` à schéma d'entrée ANONYME restent HORS PÉRIMÈTRE — non par absence de nom TS : l'alias existe pour la plupart (41 interfaces `XData` dans `src/data/index.ts`, mesure 2026-09-01 — ex. `TrappingData`, annotée par `TrappingResolver` de `src/engine/items.ts` et `craftSpecOf` de `src/engine/activities.ts`) et les champs d'une entrée anonyme sont dérivables (`scripts/docs/lib/zod-introspect.mts#introspecterDefs`) —, mais parce que la DÉRIVATION de `TARGETS` (jointure `type`↔`XData`) est un geste distinct, encore à faire (#1620) ; à l'unité, le geste d'auteur reste ouvert (nommer son schéma d'entrée dans SON def — ou en `grammaire/` si la forme est réellement partagée — puis l'ajouter à `TARGETS`), fait pour `props.json` → `PropData`.

Détection au VÉRIFICATEUR DE TYPES (`ts.Program`/`TypeChecker`) : un lecteur est un accès dont le SYMBOLE de propriété est celui déclaré par le type cible, la propriété devant lui être PROPRE ou son porteur être DÉCLARÉ de ce type — aucune annotation littérale n'est cherchée, et un type anonyme de même forme ne crédite rien. Quatre états sont mesurés, dont deux ne sont pas des mesures de lecture (hérité, absent du type TS) ; ceux qui ont des membres ici : **148 lus** ; **4 « 0 — JAMAIS LU »** (`CastingNumberMod.maison`, `CastingNumberMod.source`, `CastingNumberMod.desc`, `PropData.type`) — champ PROPRE au type, aucun lecteur ; **8 absents du type TS** (`AdvancementRef.table`, `PropData.labelF`, `PropData.desc`, `PropData.descRef`, `PropData.source`, `PropData.alsoIn`, `PropData.maison`, `PropData.icon`) — le champ du schéma n'existe pas sur le type : divergence schéma↔type, listée en fin de rapport, sur 160 champs de 23 types.

Le détecteur SYNTAXIQUE qui a précédé (annotation littérale du type) rendait 41 champs « 0 lecteur » sur ces mêmes 160. Des 16 « 0 lecteur » de la première version de ce rapport (échantillon COMPLET), 12 ont un lecteur mesuré — dont `argDifficulty` et `stageOutcome`, qu'une vérification à la main manque comme le scan syntaxique, `spec` d'une `QualityRef` (champ PROPRE : `qualityRefSchema` porte son propre shape) et `hidden` d'un `TraitInstance` (`hiddenGroupsOf` annote `TraitInstance[]`) ; les 4 autres sont de vrais zéros. Coût : ~17 s et ~1,3 Go pour un rapport complet, contre 1,8 s au scan syntaxique. Angles morts (redéclaration structurelle, spread, clé dynamique, champ absent du type) : en-tête de `fieldConsumers.mjs`.

### `TraitInstance` (src/engine/statEntry.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `id` | 70 | `src/engine/actorView.ts:29` |
| `value` | 14 | `src/engine/creatureAttacks.ts:80` |
| `arg` | 19 | `src/engine/creatureAttacks.ts:77` |
| `count` | 4 | `src/engine/creatureAttacks.ts:85` |
| `range` | 7 | `src/engine/creatureEquip.ts:81` |
| `natural` | 1 | `src/engine/creatureEquip.ts:87` |
| `hidden` | 1 | `src/engine/groups.ts:57` |

### `SourceRef` (src/data/schemas/grammaire/valeurs.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `book` | 9 | `src/data/index.ts:2907` |
| `page` | 6 | `src/data/index.ts:2907` |
| `note` | 2 | `src/ui/gallery/registry.tsx:378` |

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
| `n` | 17 | `src/engine/dice.ts:89` |
| `sides` | 19 | `src/engine/dice.ts:89` |
| `plus` | 9 | `src/engine/dice.ts:89` |

### `RefDesignee` (src/data/schemas/grammaire/ref.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `id` | 239 | `src/data/index.ts:3070` |
| `spec` | 143 | `src/data/index.ts:3534` |

### `QualityRef` (src/data/index.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `id` | 6 | `src/data/index.ts:3540` |
| `value` | 4 | `src/data/index.ts:3541` |

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
| `fixed` | 4 | `src/data/index.ts:3609` |
| `roll` | 3 | `src/data/index.ts:3609` |

### `TrappingRef` (src/data/index.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `id` | 8 | `src/engine/items.ts:307` |
| `spec` | 2 | `src/engine/items.ts:309` |
| `count` | 10 | `src/data/index.ts:3609` |
| `qualities` | 3 | `src/data/index.ts:3611` |
| `qualityChoice` | 2 | `src/data/index.ts:3610` |
| `text` | 2 | `src/data/index.ts:3603` |
| `vehicleId` | 5 | `src/data/index.ts:3605` |
| `label` | 7 | `src/engine/possessionGrants.ts:25` |
| `creatureId` | 5 | `src/data/index.ts:3607` |
| `choice` | 6 | `src/data/index.ts:3600` |
| `wildcard` | 3 | `src/data/index.ts:3601` |

### `AdvancementRef` (src/data/index.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `id` | 18 | `src/data/index.ts:3593` |
| `spec` | 6 | `src/engine/careerSlots.ts:98` |
| `choix` | 10 | `src/data/index.ts:3070` |
| `pick` | 4 | `src/data/index.ts:3585` |
| `of` | 9 | `src/data/index.ts:3584` |
| `table` | — | *absent du type TS* |
| `random` | 6 | `src/data/index.ts:3587` |

### `EntityAppearance` (src/engine/authoringAppearance.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `seed` | 3 | `src/gameIso/rig/enemyProfile.ts:118` |
| `monster` | 3 | `src/gameIso/rig/enemyProfile.ts:174` |
| `colors` | 5 | `src/gameIso/rig/bodyPlan.ts:122` |
| `parts` | 2 | `src/gameIso/rig/enemyProfile.ts:64` |
| `sex` | 1 | `src/gameIso/rig/enemyProfile.ts:63` |
| `build` | 2 | `src/gameIso/rig/enemyProfile.ts:63` |
| `species` | 11 | `src/gameIso/rig/bodyPlan.ts:172` |
| `tenue` | 4 | `src/gameIso/rig/enemyProfile.ts:101` |
| `harnais` | 2 | `src/gameIso/rig/bodyPlan.ts:124` |
| `armurePortee` | 3 | `src/gameIso/rig/enemyProfile.ts:222` |
| `hairstyle` | 1 | `src/gameIso/rig/enemyProfile.ts:64` |
| `eyes` | 5 | `src/gameIso/rig/bodyPlan.ts:123` |
| `features` | 4 | `src/gameIso/rig/enemyProfile.ts:64` |

### `FlowTest` (src/engine/flowCore.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `stake` | 10 | `src/engine/flowCore.ts:847` |
| `skill` | 31 | `src/engine/disease.ts:371` |
| `sense` | 2 | `src/state/combatEffects.ts:1012` |
| `characteristic` | 25 | `src/engine/disease.ts:371` |
| `difficulty` | 8 | `src/engine/disease.ts:358` |
| `requireSL` | 2 | `src/state/combatEffects.ts:1051` |
| `label` | 11 | `src/state/combat/triggeredTest.ts:235` |
| `tool` | 2 | `src/state/combatEffects.ts:1014` |
| `vsGroups` | 5 | `src/state/combatEffects.ts:919` |
| `vsStatus` | 1 | `src/state/combatEffects.ts:918` |
| `begging` | 3 | `src/state/combatEffects.ts:923` |
| `vsCapricieux` | 1 | `src/state/combatEffects.ts:927` |
| `easierIf` | 11 | `src/state/combatEffects.ts:968` |
| `argDifficulty` | 1 | `src/state/triggeredEffects.ts:75` |
| `unlessImmune` | 1 | `src/state/combat/flowEval.ts:137` |
| `onlyGroups` | 1 | `src/state/combat/flowEval.ts:138` |
| `exceptGroups` | 1 | `src/state/combat/flowEval.ts:139` |
| `gate` | 1 | `src/engine/flowCore.ts:384` |
| `noSupport` | 4 | `src/state/combat/triggeredTest.ts:824` |
| `menace` | 7 | `src/state/combat/triggeredTest.ts:245` |
| `difficultyBy` | 1 | `src/engine/flowCore.ts:378` |
| `opposed` | 5 | `src/state/combat/triggeredTest.ts:304` |

### `TravelTableEntry` (src/engine/travelTables.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `min` | 2 | `src/state/travelFlow.ts:1154` |
| `max` | 1 | `src/ui/compendium/registry.ts:771` |
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
| `min` | 1 | `src/ui/compendium/registry.ts:794` |
| `max` | 1 | `src/ui/compendium/registry.ts:794` |
| `id` | 3 | `src/data/index.ts:501` |
| `label` | 2 | `src/engine/shipCritical.ts:107` |
| `ops` | 3 | `src/engine/riverNavigation.ts:207` |
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
| `volume` | 16 | `src/data/props.types.ts:451` |
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
| `onRepeat` | 1 | `src/engine/critical.ts:329` |
| `onNextCritWhileCondition` | 2 | `src/engine/trauma.ts:605` |
| `onHealGrant` | 2 | `src/engine/trauma.ts:599` |

### `Amputation` (src/data/criticals.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `difficulty` | 1 | `src/engine/critical.ts:87` |
| `sequels` | 1 | `src/engine/critical.ts:76` |
| `unites` | 1 | `src/engine/critical.ts:77` |
| `timing` | 2 | `src/engine/critical.ts:344` |
| `loss` | 4 | `src/engine/critical.ts:74` |

## Champs du schéma ABSENTS du type TS

8 champs déclarés au SCHÉMA n'existent pas sur le type TS de leur `home` : `AdvancementRef.table`, `PropData.labelF`, `PropData.desc`, `PropData.descRef`, `PropData.source`, `PropData.alsoIn`, `PropData.maison`, `PropData.icon`. Divergence schéma↔type — ni lus ni lisibles, hors du compte des « 0 lecteur ».

## Synthèse

23 types, 160 champs mesurés : 148 lus, **4 avec « 0 lecteur » mesuré** au `TypeChecker`, 0 hérité, 8 absents du type TS. Ces « 0 lecteur » sont sous CLIQUET NOMINATIF (`src/data/field-consumers.test.ts`) : la liste attendue y est écrite champ par champ — un zéro apparu comme un zéro disparu est rouge, et la ligne ne se retire qu'avec le lecteur qui l'annule.

## Cas fondateur

Le champ `spec` d'une référence de dotation a 2 lecteur(s) mesuré(s) — `src/engine/items.ts:309`, `src/engine/trappingChoices.ts:107`.

`trappingRefLabel` (`src/data/index.ts`, SOURCE UNIQUE du libellé affiché d'une `TrappingRef`) ne lit PAS `ref.spec` — le rendu « base (spec) » passe par `refLabel`, partagée par toute `RefDesignee`.
<!-- sources-empreinte: 0bec0665c64ffb4a26c33685fc1f03ba97ed93f2 (2145 fichiers, 175 dossiers) corps: a2fc6daaea26769bb03de05348139b56e4131032 -->
