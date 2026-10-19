# Dépendances de VALEUR de l'attaque hors zones autorisées (vague 3, #2817 / épique #2882)

Arbre `/home/user/game/.wt-2888-2b`, HEAD `47ebdef3d`. Mesure LECTURE SEULE par l'API du compilateur TypeScript 6.0.2
(`/opt/node-tools/node_modules/typescript` : le `typescript` du dépôt est la version 7.0.2, port natif sans API JS, et `ts-morph`
est absent). Script : `sondes/mesure.cjs` (6 s), sorties brutes `sondes/mesure.md` (annexe A de ce fichier) et `sondes/mesure.json`.
Cartographie préalable : `cartographie.md` (non refaite).

## 0. Méthode et limites (à lire avant les chiffres)

- Unité = déclaration de premier niveau (fonction, `const`, instruction `registerX(...)` de haut niveau) dont la première ligne tombe dans
  les régions demandées de `combatFlow.ts` ; `rederiveAttack`, `parryWeaponOf`, `finishDefenseResult` (`rollFlowSpecs.ts:71-124`) ;
  les propriétés `FLOWS.attack` (`rollFlowSpecs.ts:523-638`) et `FLOWS.defense` (`:646-714`) ; les 23 actions `combatSlice.ts`
  (`attackRoll`, `attackConfirm`, `defenseConfirm`, `fumbleConfirm`, `handGateConfirm`, `fateNegate/Survive/Accept`, `cleaveAttack/End`,
  `dualStrikeAttack/Skip`, `attackSet*`, `defenseSet*`). Total **161 unités**, dont 156 d'attaque et 7 de sorts (2 en commun).
- Une dépendance = identifiant de VALEUR du corps (type exclu, local exclu), alias et barils (`export *`) traversés jusqu'à la déclaration
  finale. Zones omises : `engine, data, lib, geometry, i18n, noyau`. Tout le reste est rapporté, par module.
- **Aucune dépendance vers `src/web`, `src/net`, `src/scenes`, `src/audio` ni `store.ts` sur les 156 unités d'attaque** : seul `src/state`
  apparaît (`web/minuteries.scheduleCombatTimer` n'est atteint que par des appelés HORS liste : `resumeEnemyTurn`, etc. ; §4).
- Les références comptent aussi les passages en argument (pas seulement les appels). Un appel par `get().action(...)` (action du store) n'est
  PAS une arête interne : relevé à part (§1bis de l'annexe) : `defenseConfirm` → `attackConfirm`, `handGateConfirm` → `dualStrikeAttack`,
  `attackConfirm`/`fumbleConfirm`/`defenseConfirm` → `cascadeNext`, `FLOWS.attack` → `cleaveEnd`. (Les entrées `set`, `get`, `recompter`,
  `deviable` de ce relevé sont du bruit : membres de signatures déclarées en `state`.)
- **Limite des fermetures** : elles suivent les références des DÉCLARATIONS, pas les instructions de haut niveau qui REMPLISSENT une table
  à l'import (`registerHitModifier` ×5 `hitModifiers.ts:247-324`, `registerCloture` ×2 `combatEffects.ts:785-786` + ×6 `store.ts:1818-1838`,
  `registerCombatHook` ×18, `registerCascadeApplier`). Ce que ces remplisseurs référencent (par ex. `pushBackTiles` de `combatPlacement` par
  `hitModifiers.ts:38`) n'est pas dans les chiffres de fermeture par symbole ; il l'est dans la fermeture de FICHIER (§6 de l'annexe).
- Les fermetures de fichier (imports de valeur) surestiment : un import utilisé en type seul mais non marqué `type` compte. Les fermetures
  par symbole sont les chiffres à retenir ; les deux sont données.

## 1. Table fonction → dépendances (résumé ; table complète §1 de l'annexe A, 161 lignes)

Dépendances hors zones par unité d'attaque, groupées par module `state` (seules les unités non vides) :

| unité (fichier:lignes) | dépendances |
|---|---|
| `firedWeapon` (combatFlow 361-391) | `mount.pickAttackWeaponList` ; `shipPostes.servingCrewPresent` |
| `firedAttackBlock` (440-494) | `mount.{attackGeomOf,combatGeomOf,pickAttackWeaponList}` ; `shipPostes.{mountedWeaponBears,shipOfCrew}` ; get ×4 (`battle`, `facing`) |
| `attackEnv` (721-811) | `commandTeam.teamCommandMod` ; `mount.{mountMovement,mountedAttackMods}` ; `shipPostes.crewPosteOf` ; get ×4 |
| `resolveAttack` (813-888) | `combatManeuvers.bestDefenseMode` ; `mount.{attackGeomOf,chargeDmgProxy,combatGeomOf}` ; `netOwnership.defenseSurfaced` ; get ×6 dont ×4 `get()` entier |
| `resolveDualSecond` (896-925) | `bestDefenseMode`, `defenseSurfaced` |
| `previewAttack` / `defenseDodgeMods` / `previewDefense` / `previewResourceDelta` | `mount.{attackGeomOf,combatGeomOf}` ; `mount.mountedDodgeMods` ; `bestDefenseMode` ; `mount.mountMovement` |
| `attackPlan` (1625-1682) | `mount.{combatGeomOf,meleeWeaponInRange,mountMovement,mountOf}` |
| `notifySlain` (1703) | `combatEvents.emitCombatEvent` (+ hors liste `releaseSeatsOfDowned`, `resolveTriggerImpureOps`→`summonFlow.applySummon`) |
| `applyCriticalToTarget` (1798-1912) | `combat/triggeredTest.routeTriggeredTest` ; `combatEffects.pushReveal` ; set passé ×4 |
| `applyHullCriticalToTarget` (1923-1972) | `combat/triggeredTest.bandeTriggeredTest` ; `combatEffects.{pushCombatStep,pushReveal}` |
| `collapseStructure` (2045-2086) | `bus.{bus,EVT}` ; `combatEffects.ouvrirChute` ; `spawn.placeCombatant` |
| `autoDeviate` (2143) | `combatEffects.pushReveal` |
| `apresLeCritiqueDe` (2306) | `combatEvents.emitCombatEvent` |
| `battleAreaTargets`, `siegeBlastRadiusTiles` | `combatArea.areaTargets`, `combatArea.blastRadiusTiles` |
| `pousserSauvegarde` (2348), `ouvrirDeDeCasse` (3337) | `combatEffects.revealPurpose` |
| `applyAttackResult` (2662), `jouerLaFrappePassive`, `ecrireLaMaladresse`, `applyOups`, `doAttack`, `jouerLesTirsDeBordee`, `runCleaveChain`, `applyTalentFreeAttack`, `applyFreeAttack`, casse (`top@3526`) | `combatEffects.OPS_DIFFEREES` (11 unités) ; `casseDArme` : + `jouerFlowEntier`, `nePeutPasDifferer` |
| `appliquerLaTouche` (2680-2999, 320 lignes) | `bus.{bus,EVT}` ; `combat/hitModifiers.runHitModifiers` ; `combatArea.resolveWeaponArea` ; `combatEffects.drainPendingLog` ; `combatEvents.emitCombatEvent` ; `bestDefenseMode` ; `massBattleFlow.massBattleTrackHit` ; `shipCrew.endShanty` ; get ×6 (`battle`×4, `scene`×2) + 31 passages de `get` ; set ×4 (`facing`×2, `battle`×2 dont forme `fn`) + 26 passages de `set` |
| `reactionDeBouclierEnDegats` (3042), `surfacedDefensePending` (3739), `maybeOpenDefense` (3653-3722) | `netOwnership.defenseSurfaced` ; `maybeOpenDefense` : + `bestDefenseMode`, `mount.chargeDmgProxy` |
| `openSurfacedDefense` (3756) | `bestDefenseMode`, `mount.chargeDmgProxy` |
| `applyShieldReaction` (3577) | `bus` ; `combatPlacement.applyZoneCrossings` ; `spawn.placeCombatant` |
| `heldGroundStanceBlock` (3791) | `mount.mountMovement` |
| `aiHandGate` (3897) | `combatOrParty.touchActors` |
| `resumeCleaveChain`, `autoCleave`, `maybeHeroCleave` (4006-4083) | `combatPlacement.displaceSmaller` ; `spawn.placeCombatant` ; `bus` (resume) ; `netOwnership.aiDriven` (auto) |
| `jouerLaSuiteDuCoup` (4107) | `combat/hitModifiers.toucheSauvee` |
| `aiAvailableFreeAttack`, `applyTalentFreeAttack` | `combatManeuvers.availableFreeAttackOps` ; `netOwnership.aiDriven` ; `freeAttackTarget`→`freeAttackTargetOk` |
| `checkFocusInterruption` (3116), `resolveFreeAttacks` (4251) | `combat/triggeredTest.runCombatFlow` |
| `resumeMeleeAfterSuspension` (4485) | `combatEffects.jouerFlowEntier` |
| `checkBattleOver` (7133-7223) | `bus` ; `mount.sweepDismountDeaths` ; `shipCrew.resolveShipUnits` ; `shipwreck.beginShipwreck` ; get ×9 (`battle`×5, `pendingCascade`×2, `scene`, `vessel`) ; set ×5 (`battle`) |
| `finishVictory` (7231-7275) | `bourseFlow.{condCtx,partyMoneyTotal}` ; `bus` ; `combatEffects.{applyEffects,cloturer,gearFromEffects}` ; get `battle`×3, `party` |
| `registerCloture('ouvrirEcranDeVictoire')` (7276) | `bourseFlow.partyMoneyTotal` ; `combatEffects.registerCloture` ; get `party` ; set `pendingVictory` |
| `finishCombatEnd` (7289) | rien hors zone ; get `battle`×3 + `combatCursor` ; set `combatCursor` |
| `rederiveAttack` (rollFlowSpecs 71) | `bestDefenseMode` ; `mount.chargeDmgProxy` |
| `FLOWS.attack` (523-638) | `bus` ; `rollFlowFactory.{makeRollFlow,deDuJet}` ; get ×6 (`battle`, `pendingAttack`, `pendingCascade`, action `cleaveEnd`) ; set ×5 (`pendingAttack`×4, `battle`, `facing`) |
| `FLOWS.defense` (646-714) | `rollFlowFactory.{makeRollFlow,deDuJet}` ; aucun get/set direct |
| `slice.handGateConfirm` (2066) | `bus` ; `combatOrParty.touchActors` ; `netOwnership.aiDriven` |
| `slice.attackConfirm` (2344-2479, 136 lignes) | `bus` ; `combatArea.resolveWeaponArea` ; `combatEffects.jouerFlowEntier` ; `combatManeuvers.hasFreeWeaponAttack` ; `mount.mountMovement` ; get ×13 (`battle`×8, `pendingCleave`, `pendingDualStrike`, `pendingCascade`, action `cascadeNext`) ; set ×9 (`battle`×7, `pendingAttack`, `pendingCleave`, `pendingDualStrike`) |
| `slice.fumbleConfirm` | `combatEffects.{OPS_DIFFEREES,jouerFlowEntier}` |
| autres actions de slice (`attackRoll`, `defenseConfirm`, `fate*`, `cleave*`, `dualStrike*`, `attackSet*`, `defenseSet*`) | aucune valeur hors zone en direct ; uniquement `get`/`set` + appelés internes ; `attackRoll` : get ×3 dont `get().log` |

Comptes `get`/`set` sur les unités d'attaque (somme de la table complète) : l'attaque lit le store presque exclusivement par `battle`
(≈ 81 lectures dans `combatFlow`), puis `scene`, `gameTime`, `pendingCascade`, `facing`, `log`, `party`, `vessel`, `combatCursor`, `pending*`
(`pendingAttack`, `pendingDefense`, `pendingCleave`, `pendingDualStrike`, `pendingHandGate`, `pendingFateSave`, `pendingLogQueue`) ; écrit `battle`
(forme objet), `facing`, `pendingDefense`, `pendingHandGate`, `pendingAttack`, `pendingCleave`, `pendingDualStrike`, `pendingFateSave`, `pendingLogQueue`,
`pendingVictory`, `combatCursor`. Beaucoup d'unités transmettent `get`/`set` à d'autres (colonnes « passé » : `appliquerLaTouche` 31/26,
`jouerLaSuiteDuCoup` 8/7, `slice.attackConfirm` 12/7) : le contrat d'entrée réel est `(get, set)` typés `Get`/`Set` de `state/flowTypes`.

## 2. Graphe interne, ordre topologique

- 149 composantes sur 161 unités ; **deux seuls cycles** (tout le reste est acyclique) :
  1. `{applyCritAndFinalize, appliquerLesCritiques, encaisserLeCoup, encaisserLeCoupDuMarin, applyHullCriticalToTarget, applyCriticalToTarget}` (6) : les critiques de porteurs (coque, personnage) rappellent l'encaissement.
  2. `{autoCleave, jouerLesTirsDeBordee, runCleaveChain, resumeCleaveChain, jouerLaSuiteDuCoup, jouerLaFrappePassive, jouerLApresCoup, applyAttackResult}` (8) : la suite du coup rappelle `applyAttackResult` (balayage, bordée, frappe passive).
- Une fermeture de TROISIÈME niveau n'est pas un cycle de fonctions mais de registres : `top@4573 registerCascadeApplier('deviation')` ↔ `reprendreLeCoup`/`resolveDeviation`, `top@2368 'sauvegarde'` ↔ `reprendreApresSauvegarde`, `top@3526 'casseDArme'` → `applyOups`/`jouerLApresCoup` : les reprises passent par `cascadeAppliers` (noyau), pas par appel direct.
- Ordre feuilles → racines (extrait ; rangs complets à l'annexe A §3) :
  1. Contexte pur : `applyIncomingMeleeAdvantage`, `armeDeLaGratuite`, `weaponContextOf`, `firedWeapon`, `attackWeaponOf`, `victimeDuCoup`, `banRangedActive`, `strayShotVictim`, `crowdEligible`, `attackWardGate`, `withAttackerAt`, `isBlackPowderWeapon`.
  2. Jet : `attackEnv` → `defenseDodgeMods` → `resolveAttack` → `resolveDualSecond` ; aperçus `previewAttack` → `attackPlan`, `previewDefense`, `previewResourceDelta`.
  3. Mort et critiques : `finalizeHeroDeath`, `notifySlain` ; tables critiques ; `critSeverity*` → `resolveCritSeverity` ; `pushDeviationStep` ; `previewCritEntry` ; `planifierLesCritiques` ; `breakBacleArmour`, `deflectCrit`, `autoDeviate`, `apresLeCritiqueDe` ; `resolveFirstBlood` → `cloreLeCoup` ; **cycle 1** (`encaisserLeCoup`, `appliquerLesCritiques`, `applyCriticalToTarget`, `applyHullCriticalToTarget`…) ; `applyOpposedCritical`.
  4. Clôture : `collapseStructure`, `finishVictory` → `checkBattleOver` (appelé par `appliquerLaTouche`, `applyOups`, `applyShieldReaction`, `cloreLaReprise`, `slice.attackConfirm`).
  5. `pousserSauvegarde`, `checkFocusInterruption`, `battleAreaTargets`, `creatureAttackKind`, `weaponHasBlade` → `appliquerLaTouche` (rang 65).
  6. Usure/casse/maladresse : `ditLUsure`, `wearActiveWeapon`, `ouvrirDeDeCasse`, `applyOups` → `ecrireLaMaladresse` → `maladresseDeLAttaquant`/`DuDefenseur` ; `applyShieldReaction` → `reactionDeBouclierEnDegats` ; `riposteDeclaree`.
  7. Défense : `defenseEnCours`, `refuserLaDefense`, `openDefenseCascade` → `maybeOpenDefense` ; `surfacedDefensePending` → `openSurfacedDefense`.
  8. **Cycle 2** (suite du coup) puis `resumeMeleeAfterSuspension` → `reprendreApresSauvegarde` ; applier `casseDArme`.
  9. Ouverture : `STANCE_BLOCK` → `withArmedStance` → `openAttackCascade` ; `aiHandGate` → `doAttack`; gratuites `applyTalentFreeAttack` → `aiAvailableFreeAttack` → `drainerLesGratuites`, `applyFreeAttack` ; reprise `cloreLaReprise` → `reprendreLeCoup` → `resolveDeviation`.
  10. Spécs/actions : `rederiveAttack`, `finishDefenseResult` → `FLOWS.attack`, `FLOWS.defense` ; `slice.*` (racines).
- `appliquerLaTouche` (rang 65) a 11 appelés internes et UN seul appelant direct : `applyAttackResult`. `applyAttackResult` est dans le cycle 2.
- Appelants externes du graphe : `slice.attackConfirm` (7 appelés internes), `slice.defenseConfirm` (→ `applyAttackResult`, `drainerLesGratuites`), `slice.attackRoll` (→ `resolveAttack`), `doAttack` (racine IA).

## 3. Appelés HORS liste (un niveau) : l'attaque ne s'arrête pas aux régions demandées

Section 4/4bis de l'annexe. Les plus lourds pour le déplacement :
- `finalizeBattle` (7014-7071), `openCombatEndCascade` (6810-6885), `victoryConditionMet` (7076), `resolveSurrenderThreshold` (7108), via `checkBattleOver`/`finishVictory`/`finishCombatEnd`.
- `markActed` (7790), `clearActorAim` (7425), `critRollTwiceFor` (182), `releaseSeatsOfDowned` (6969), `resolveTriggerImpureOps` (6577, tire `summonFlow.applySummon`), `applyBladeTrap` (7324), `runPreemptShots` (3191, `bus`+`OPS_DIFFEREES`+`aiDriven`), `aiCreatureFreeAttacks` (4587-4667, `combatManeuvers.{MELEE_MANEUVER_KINDS,freeAttackCost,gratuitesRestantes}`, `mount.mountMovement`).
- `resumeEnemyTurn` (7431, appelé par `fateNegate/Survive/Accept`, `handGateConfirm`, `defenseConfirm`) : **seule rencontre avec une minuterie et la cadence** — `web/minuteries.scheduleCombatTimer`, `combatDirector.beatHold`, `combatGate.combatAdvanceBlocked`. `resolveRoundBoundary` (7586, appelé par `fateSurvive/Accept`) : la boucle de round.
- `advanceCombatJet` (`combatSlice.ts:285`, → `targetingHolder.coupFerme`), `poserLaFrappeSuivante` (`:304`), `surLEtapeDeDefense` (`:295`), `acquireAnimositeOnFate` (`:149`).
- Côté spécs : `defenseSubOf`, `forcedOpposedAtk`, `opposedForcedFloor`, `opposedForcingCancelled`, `sealOutcome`, `testOutcome`, `clearApproachMoves` (combatFlow 7772).
- Côté sorts (`applyCast` et Projectile) : `jouerLeRebond`, `runCastFlow`, `appliquerTouchePourCible`, `placeSpellZone`, `finishPlayerAction` (→ `combatOrParty.touchActors`, `drainPendingLog`, `bus`), `applyAreaAttack` (→ `combatManeuvers.{resolveManeuver,rollManeuverAttacker,maneuverAttackerDifficulty}`), `useSpellComponent`, `applyMiscast`.
- **Fermeture transitive** de l'attaque dans les trois fichiers : **301 fonctions/constantes sur 353 candidats** (236 dans `combatFlow.ts`, 38 dans `rollFlowSpecs.ts`, 27 dans `combatSlice.ts`), car `resumeEnemyTurn` → boucle de tour → IA → sorts. L'attaque ne se coupe de l'IA/tour/sorts QUE si ces entrées (`resumeEnemyTurn`, `resolveRoundBoundary`, `advanceCombatJet`) deviennent des SORTIES (« reprendre le tour »). Elle référence alors **119 symboles externes** (annexe §7), contre **59** en direct.

## 4. Fermeture propre de chaque module `state` dépendance (item 3)

Deux mesures. Fichier = imports de valeur, surestime. **Symbole** = ce que le symbole utilisé tire réellement (références de valeur transitives, hors zones autorisées).

| module | symboles utilisés | fichier : state / store ? | SYMBOLE : décl. / lignes / store ? |
|---|---|---|---|
| `combatOrParty` | `touchActors` | 130 / OUI (`combatOrParty` > `targetingModes` > `combatFlow` > `seaVoyageFlow` > `store`) | **1 décl., 3 lignes, non** |
| `combatManeuvers` | `bestDefenseMode`, `availableFreeAttackOps`, `freeAttackTargetOk`, `hasFreeWeaponAttack` | 130 / OUI (via `combatOrParty`) | **5 décl., 36 lignes, non** (`bestDefenseMode` : 4 lignes, 1 décl.) |
| `netOwnership` | `defenseSurfaced`, `aiDriven` | 4 / non | 4 décl., 18 lignes, non (lit `s.net`) |
| `bus` | `bus`, `EVT` | 1 / non | 3 décl., 52 lignes ; **émetteur pur** (aucun `on` côté attaque) |
| `mount` + `siegePush` | 10 symboles (`mountMovement`, `mountOf`, `combatGeomOf`, `attackGeomOf`, `pickAttackWeaponList`, `meleeWeaponInRange`, `mountedAttackMods`, `mountedDodgeMods`, `chargeDmgProxy`, `sweepDismountDeaths`) | 2 / non | 23 décl., 129 lignes, non |
| `shipPostes` + `fireArc`, `shipCrew`, `shipwreck`, `commandTeam` | `crewPosteOf`, `mountedWeaponBears`, `servingCrewPresent`, `shipOfCrew` ; `endShanty`, `resolveShipUnits` ; `beginShipwreck` ; `teamCommandMod` | 2 / 2 / 8 / 1, non | 7 décl./46 l. ; 2/32 ; **17/177** (traîne `carriers`, `netOwnership`, `worldMap`, `bourseFlow`) ; 4/22 |
| `combatArea` | `areaTargets`, `blastRadiusTiles`, `resolveWeaponArea` | 3 / non | 9 décl., 95 lignes, non (traîne `combatEvents` + `combatHooks`) |
| `combatPlacement` + `spawn` | `applyZoneCrossings`, `displaceSmaller` ; `placeCombatant` | 2 / non ; 1 / non | 7 décl./97 l. (`bus`, `zoneCrossTestHook`) ; 2/14 |
| `combat/hitModifiers` | `runHitModifiers`, `toucheSauvee` | 3 / non | 3 décl., 14 lignes ; **mais** la table `MODIFIERS` est remplie à l'import par 5 `registerHitModifier` qui importent `combatPlacement.pushBackTiles` (`hitModifiers.ts:38`) |
| `combatEvents` + `combatHooks` | `emitCombatEvent` | 2 / non | 3 décl., 17 lignes (`runCombatHooks`, table `HOOKS` remplie par 18 `registerCombatHook` : `roundHooks`, `turnHooks`) |
| `combatEffects` (sous-ensemble sans store) | `OPS_DIFFEREES`, `cloturer`, `registerCloture`, `drainPendingLog`, `jouerFlowEntier`, `nePeutPasDifferer`, `ouvrirChute`, `pushCombatStep`, `pushReveal`, `revealPurpose` | 130 / OUI | **18 décl., 127 lignes** (+ `revealStep.ts`), non ; `cloturer` 59 lignes tient `clotureAppliers` (Map), remplie hors du fichier par `store.ts:1818-1838` (6) et `combatFlow.ts:5073,7276` |
| `combatEffects` (ce qui atteint le store) | `applyEffects`, `gearFromEffects` | | **1718 décl., 132 fichiers, store** |
| `combat/triggeredTest` | `routeTriggeredTest`, `runCombatFlow`, `bandeTriggeredTest` | 130 / OUI | **1718 décl., 132 fichiers, store, `net/relay`, `web/minuteries`, `web/stockageWeb`** |
| `rollFlowFactory` | `makeRollFlow`, `deDuJet` | 130 / OUI | 17 décl., 431 lignes, non (`combatOrParty`, `corruptionFlow` au passage) |
| `massBattleFlow`, `bourseFlow` | `massBattleTrackHit` ; `partyMoneyTotal`, `condCtx` | 1 / non | 1 décl./8 l. ; 3/7 |
| sorts seulement | `corruptionFlow.gainCorruption` (7/73), `summonFlow.applySummon` (18/382), `consumableFlow.runConsumable` (**store**) | | |

**Constat central.** Un symbole d'un module « qui atteint le store par fichier » descend seul sans le store dès que sa déclaration ne référence pas
`combatOrParty.currentTargetingMode`-type de cycle : `touchActors` (3 lignes), `bestDefenseMode` (4 lignes) en sont la preuve.
Le chemin fichier `combatOrParty.ts:22` → `targetingModes` → `combatFlow` → `store` est un défaut de FICHIER, pas de symbole.
**Union des symboles sans store : 135 déclarations, 1620 lignes** (annexe §6bis).

**Les deux seules fermetures lourdes** (tout ce qui atteint le store) :
- `applyEffects`/`gearFromEffects` (interprète `EFFECT_HANDLERS`, `combatEffects.ts:1261`) et `routeTriggeredTest`/`runCombatFlow`/`bandeTriggeredTest`
  (`triggeredTest.ts`, qui rappelle `runFlow` → `EFFECT_HANDLERS`) : **même fermeture de 1718 déclarations / 132 fichiers**. L'unique déclaration en amont du store
  qui touche une valeur de `store.ts` est **`campaignData.ts#maps` → `useGame.getState().campaignNarratif`** (`campaignData.ts:29` ; second accès `:100`, 4 occurrences de `useGame` au total) ;
  les 15 autres « entrées » du relevé (annexe §10) sont en aval de `useGame` (le store référence `netFlow`, `registerScene`…). `combatEffects.ts:29` importe `trappingById, indiceById, documentById`.
- `consumableFlow.runConsumable` (sorts) tombe dans la même fermeture via `runFlow`.

## 5. Services d'hôte et symboles à descendre / à transformer (item 3, suite)

Classement des 59 symboles directs (+ appelés hors liste pour 119) :

**Services d'hôte (sorties ou entrées, ne descendent pas tels quels)**
- `bus.emit(EVT.*)` : 12 `SCENE_DIRTY` + 2 `ANIM_ATTACK` + 1 `ANIM_FLOAT` + 1 `ANIM_MOVE` + 1 `BATTLE_OVER` dans l'attaque de `combatFlow`, 3 `SCENE_DIRTY` dans les actions de slice, 1 dans `FLOWS.attack`. 11 unités d'attaque + 2 de sorts. Sortie pure (aucun abonné côté attaque).
- `scheduleCombatTimer`, `beatHold`, `combatAdvanceBlocked`, `TEMPO` : **absents des 156 unités d'attaque** ; atteints par `resumeEnemyTurn` (7431), `runPreemptShots`, boucle de tour (§3).
- Sièges/réseau : `defenseSurfaced` (3 lignes), `aiDriven` (15 lignes, `ownsLocal`, `actingSeat`) lisent `s.net.gmSeat/ownership/mode` ; `controlsCombatant` hors liste. Entrée.
- Tables à l'import qui INJECTENT : `clotureAppliers` (`registerCloture`), `HOOKS`, `MODIFIERS`, `zoneCrossTestHook`, `setManeuverPostHitHook`, 3 hooks du test routé, `cascadeAppliers`, `onConditionGained` (moteur).
- Aléa/config : `battleRng()` (noyau, déjà dans une zone autorisée) ; `rule()`, `cadence()`, `desFixes()` (moteur) ne ressortent pas comme dépendances `state` mais restent des variables de module lues en profondeur (cartographie §0.5-0.6).

**À descendre au noyau (déplaçables en l'état, par ordre croissant de taille)**
1. `bestDefenseMode` (4 l.), `touchActors` (3 l.), `defenseSurfaced` (3 l.), `aiDriven` + `ownsLocal`/`actingSeat` (15 l.), `emitCombatEvent` + `runCombatHooks`/`HOOKS` (17 l.), `OPS_DIFFEREES`/`jouerFlowEntier`/`nePeutPasDifferer` (≈ 11 l.), `pushCombatStep`/`revealPurpose`/`drainPendingLog` (≈ 11 l.), `bourseFlow.partyMoneyTotal`/`condCtx` (7 l.), `massBattleTrackHit` (8 l.), `placeCombatant` (14 l.), `runHitModifiers`/`toucheSauvee` (14 l. + 5 modifiers à l'import), `commandTeam.teamCommandMod` (22 l.), `shipCrew.{endShanty,resolveShipUnits}` (32 l.), `shipPostes`+`fireArc` (46 l.), `pushReveal`+`revealStep` (36 l.), `ouvrirChute` (13 l.).
2. Groupes de 100 à 200 lignes : `mount`+`siegePush` (129 l., 23 décl.), `combatArea` (95 l.), `combatPlacement` (97 l.), `cloturer`/`registerCloture` (≈ 63 l.), `beginShipwreck` (177 l., 17 décl.).
3. `rollFlowFactory.makeRollFlow` (431 l., 17 décl.) : usine partagée avec tous les flux (hors attaque aussi).
4. **Bloquant** : `applyEffects` + `gearFromEffects` + `routeTriggeredTest`/`runCombatFlow`/`bandeTriggeredTest` (même fermeture, 1718 décl.) : soit descendre ~132 fichiers, soit les rendre SORTIE (« effets à jouer », « test déclenché à router ») soit couper `campaignData.maps` (accès au store `campaignNarratif`) en entrée.

## 6. Sorts partageant le coup (item 4)

Unités : `compterLesCritiquesDuProjectile` (2401-2415), `libelleDuCoup` (2435-2438) [attaque+sorts] ; `clore` (5903), `causeDuProjectile` (5910), `appliquerToucheDeProjectile` (5929-6026, 98 l.), `localisationRelanceeDuProjectile` (6030) ; `applyCast` (6115-6509, 395 l.).
- `appliquerToucheDeProjectile` appelle 5 unités d'attaque partagées : `checkFocusInterruption`, `pousserSauvegarde`, `planifierLesCritiques`, `appliquerLesCritiques`, `apresLeCritiqueDe` (+ hors liste `critRollTwiceFor`, `runCastFlow`), et `reprendreLeCoup`/`reprendreApresSauvegarde` y rentrent (appelants).
- Fermeture, dans la liste, de ce que les sorts appellent côté coup : **30 unités** (dont le cycle 1 entier, `finalizeHeroDeath`, `resolveCritSeverity`, `autoDeviate`, `breakBacleArmour`, `applyCriticalToTarget`, `cloreLeCoup`), soit **27 des 156 unités d'attaque**.
- Symboles externes communs attaque/sorts : `bus`, `EVT`, `runHitModifiers`, `emitCombatEvent`, `placeCombatant`, `applyZoneCrossings`. Propres aux sorts : `corruptionFlow.gainCorruption`, `summonFlow.applySummon`, `consumableFlow.runConsumable` (store).
- `applyCast` : get ×13 (`gameTime`×6, `battle`×4, `scene`×3), set ×3 (`facing`×2, `battle`), 30 passages de `get` ; il n'appelle AUCUNE unité d'attaque directement (hors liste : `jouerLeRebond`, `appliquerTouchePourCible`, `finishPlayerAction`, `applyAreaAttack`…).
- `runHitModifiers` : seconds appelants `combatFlow.ts:2717` (`appliquerLaTouche`) et `:5955` (`appliquerToucheDeProjectile`). `planifierLesCritiques` : `appliquerLaTouche`, `encaisserLeCoupDuMarin`, `appliquerToucheDeProjectile`.

## 7. `checkBattleOver` / `finishVictory` / `finishCombatEnd` (item 5)

Lu : `combatFlow.ts:7014-7071` (`finalizeBattle`), `6810-6885` (`openCombatEndCascade`), `7133-7298`.
| lit (hors combat) | où |
|---|---|
| `vessel` (`vehicleId`) | `checkBattleOver` 7168 ; `finalizeBattle` 7037 |
| `scene` (`entities`) | `checkBattleOver` (désarçonnement 7141, `victoryConditionMet`) ; `finalizeBattle` 7044 |
| `party` | `finalizeBattle` 7015 (`carryOverState`, écriture 7031), `finishVictory` (`party[0].xp`, `partyMoneyTotal`), clôture `ouvrirEcranDeVictoire` |
| `pendingCascade` | `checkBattleOver` 2× (diffère la victoire) ; `openCombatEndCascade` |
| `possessions`, `deferredUpkeepQueue`, `combatCursor`, `log` (action) | `finalizeBattle` ; `openCombatEndCascade` ; `finishCombatEnd` ; ces deux |
| `battle.onVictory` (Flow, aplati par `flattenFlow(…, condCtx(get))`) | `finishVictory` : lit flags/horloge/bourse/groupe par `condCtx` |

| écrit (hors `battle`) | où |
|---|---|
| `party` (report des Blessures/États/morts, `carryOverState`) | `finalizeBattle` 7031 |
| `vessel.wounds` **et** `travelPlan.vehicle.wounds` | `finalizeBattle` 7037-7039 → `seaVoyageFlow.setVesselHull` (`seaVoyageFlow.ts:380-389`, écrit les deux) ; aussi `beginShipwreck` |
| `scene.entities` (retrait des tombés) | `finalizeBattle` → `combatPlacement.removeEntities` |
| `possessions` (`destroyed`, `wounds.current`) | `finalizeBattle` 7069 |
| `pendingCascade` (bornes `combatEndBoundary`), `deferredUpkeepQueue` (vidée) | `openCombatEndCascade` (6884, 6873) ; `openSequence` du noyau |
| `combatCursor` | `finishCombatEnd` 7292 |
| `pendingVictory` | clôture `ouvrirEcranDeVictoire` (7276-7284), posée par `cloturer(...)` |
| **flags, horloge, bourse, PX, butin, téléport, dialogue, `startCombat`** | **indirect** : `finishVictory` → `applyEffects(get, set, immediate)` (`combatEffects.ts:2253`, registre `EFFECT_HANDLERS`) : toute l'interface d'`Effect`. Les 4 verbes `transition/transitionBack/startDialogue/startCombat` sont DIFFÉRÉS (`onContinue`) au clic « Continuer » (`dismissVictory`, hors cette région) |
| événements | `emitCombatEvent('onCombatEnd')` (`finalizeBattle` 7020), `bus BATTLE_OVER` (7236), `SCENE_DIRTY` ×4 |
- `registerCloture('ouvrirEcranDeVictoire')` (`combatFlow.ts:7276`) : un des 10 verbes (`combatEffects.ts:733-743`), joué par `jouerLesClotures`.
- Dépendances `state` directes de la famille : `bus`, `mount.sweepDismountDeaths`, `shipCrew.resolveShipUnits`, `shipwreck.beginShipwreck`, `bourseFlow.{condCtx,partyMoneyTotal}`, `combatEffects.{applyEffects,cloturer,gearFromEffects,registerCloture,drainPendingLog}`, `combatEvents.emitCombatEvent`, `combatPlacement.removeEntities`, `seaVoyageFlow.setVesselHull`, `triggeredTest.routeTriggeredTest`, `combatEndBands.combatEndBands`, `nightBands.nightBands`, `corruptionFlow.testDExposition`. Seul `applyEffects`/`gearFromEffects`/`routeTriggeredTest` appartient à la fermeture lourde (§4).
- `registerCloture` est écrit dans `combatFlow.ts:5073` (aussi) et `store.ts:1818-1838` (6 verbes touchant `advanceTime`/`removeEntity` du store).
- Appelants de `checkBattleOver` dans la liste : `appliquerLaTouche`, `applyOups`, `applyShieldReaction`, `cloreLaReprise`, `slice.attackConfirm` ; hors liste : `dispatchCascadeDone` (`combatSlice.ts:438-520`, re-vérification), `resumeSuspendedAI`.

## 8. Poison rencontré (non corrigé)

- `src/state/combatFlow.ts:7191` : « comportement historique inchangé » (pierre tombale / rétro-compat) dans le commentaire de `checkBattleOver`.
- `src/state/rollFlowSpecs.ts:219` et `:232` : « byte-identiques aux anciens `() => FLOWS.x.m(get, set)` » (pierre tombale), hors régions demandées mais dans le même fichier.
- Paraphrases de règle en tête de `checkBattleOver` (`combatFlow.ts:7134-7223`, ex. « Combat monté », « Reddition », « NAUFRAGE », « Un engin INERTE… ») et de `finalizeBattle` (7014-7071) : non comptées une à une.
- `src/state/combatSlice.ts:2376` (« n'est déplacé ») : à relire, non classé.
- Cartographie §10 (non refait) : `store.ts:216-217`, `combatFlow.ts:7540, 8263, 5376, 5497, 8057, 8449, 8614`, `combatSlice.ts:4, 411, 756`.

## 9. Non couvert

- Aucune lecture du corps de `routeTriggeredTest` ni des 18 `registerCombatHook`, `applyOups`/`applyShieldReaction` détaillés ; les relevés `get`/`set` ne suivent pas les alias (`const s = get()`), comptés comme « `get()` entier » ; les clés de `set` dont l'argument est une variable ne sont pas résolues.
- `dispatchCascadeDone`, `cascadeNext`, `startCombat`, `battleClickEntity`, `attackClickCommit`, `siegeAimCommit`, `preemptRangedShot`, `poserLaFrappeSuivante` (sauf comme appelés) ne sont pas des unités mesurées ; la boucle de tour (`advanceTurn`, `maybeRunEnemyTurn`, `runEnemyAI`) non plus.
- Les fermetures ne comptent pas les instructions de haut niveau (remplissage de tables, `register*`) ni les imports dynamiques `import()`.
- Aucun test, build ni typecheck lancés. `docs/primitives.md` et `docs/index-moteur.md` non reconsultés (absents de ce worktree, voir cartographie §9) : ce rapport ne conclut à aucun manque de vocabulaire moteur.

---
# Annexe A — sortie brute de `sondes/mesure.cjs`

# Mesure automatique (TypeScript compiler API) — dépendances de VALEUR hors zones autorisées

Arbre /home/user/game/.wt-2888-2b, HEAD 47ebdef3d. Script : `sondes/mesure.cjs`. Unités : 161.
Une dépendance = identifiant de valeur dans le corps de l'unité, résolu (alias suivis, barils traversés) à sa déclaration finale ; zones autorisées (engine, data, lib, geometry, i18n, noyau) omises ; locaux omis. `get`/`set` = paramètres store (appels, champs lus par `get().X`, clés écrites par `set({...})`, `fn` = forme fonctionnelle `set((s)=>…)`, `passé` = transmis en argument à un autre appelé).

## 1. Table par unité

| unité | fichier:lignes | grp | dépendances hors zones (module.{symboles}) | get (appels/champs/passé) | set (appels/clés/passé) | actions de store appelées | variables de module internes | internes (appelés dans la liste) | hors liste (cand.) |
|---|---|---|---|---|---|---|---|---|---|
| applyIncomingMeleeAdvantage | combatFlow.ts:315-321 (7) | attaque | - | 0/-/1 | 0/-/0 | - | - | - | - |
| attackWeaponOf | combatFlow.ts:331-339 (9) | attaque | - | 0/-/0 | 0/-/0 | - | - | armeDeLaGratuite,firedWeapon | - |
| victimeDuCoup | combatFlow.ts:344-346 (3) | attaque | - | 0/-/0 | 0/-/0 | - | - | - | - |
| armeDeLaGratuite | combatFlow.ts:351-356 (6) | attaque | - | 0/-/0 | 0/-/0 | - | - | - | - |
| firedWeapon | combatFlow.ts:361-391 (31) | attaque | mount.{pickAttackWeaponList} ; shipPostes.{servingCrewPresent} | 0/-/0 | 0/-/0 | - | - | weaponContextOf | - |
| weaponContextOf | combatFlow.ts:398-411 (14) | attaque | - | 0/-/0 | 0/-/0 | - | - | - | - |
| banRangedActive | combatFlow.ts:419-421 (3) | attaque | - | 0/-/0 | 0/-/0 | - | - | - | - |
| siegeActif | combatFlow.ts:429-431 (3) | attaque | - | 0/-/0 | 0/-/0 | - | - | - | - |
| firedAttackBlock | combatFlow.ts:440-494 (55) | attaque | mount.{attackGeomOf,combatGeomOf,pickAttackWeaponList} ; shipPostes.{mountedWeaponBears,shipOfCrew} | 4/battle×2 facing×2/0 | 0/-/0 | - | - | banRangedActive | - |
| strayShotVictim | combatFlow.ts:497-504 (8) | attaque | - | 0/-/0 | 0/-/0 | - | - | - | - |
| crowdEligible | combatFlow.ts:507-511 (5) | attaque | - | 0/-/0 | 0/-/0 | - | - | - | - |
| attackWardGate | combatFlow.ts:516-529 (14) | attaque | - | 0/-/0 | 0/-/0 | - | - | - | - |
| isBlackPowderWeapon | combatFlow.ts:689-692 (4) | attaque | - | 0/-/0 | 0/-/0 | - | - | - | - |
| withAttackerAt | combatFlow.ts:707-713 (7) | attaque | - | 0/-/0 | 0/-/0 | - | - | - | - |
| attackEnv | combatFlow.ts:721-811 (91) | attaque | commandTeam.{teamCommandMod} ; mount.{mountMovement,mountedAttackMods} ; shipPostes.{crewPosteOf} | 4/scene×1 battle×1 gameTime×1 facing×1/1 | 0/-/0 | - | - | withAttackerAt,isBlackPowderWeapon,crowdEligible | activeDayWeather |
| resolveAttack | combatFlow.ts:813-888 (76) | attaque | combatManeuvers.{bestDefenseMode} ; mount.{attackGeomOf,chargeDmgProxy,combatGeomOf} ; netOwnership.{defenseSurfaced} | 6/*entier*×4 battle×1 scene×1/1 | 0/-/0 | - | - | firedWeapon,banRangedActive,attackEnv,defenseDodgeMods,strayShotVictim | - |
| resolveDualSecond | combatFlow.ts:896-925 (30) | attaque | combatManeuvers.{bestDefenseMode} ; netOwnership.{defenseSurfaced} | 3/*entier*×3/1 | 0/-/0 | - | - | weaponContextOf,attackEnv,defenseDodgeMods | - |
| dualStrikeTargets | combatFlow.ts:930-936 (7) | attaque | - | 0/-/0 | 0/-/0 | - | - | - | - |
| previewAttack | combatFlow.ts:967-1015 (49) | attaque | mount.{attackGeomOf,combatGeomOf} | 2/battle×1 scene×1/1 | 0/-/0 | - | - | firedWeapon,attackEnv | - |
| difficultyOf | combatFlow.ts:1022-1025 (4) | attaque | - | 0/-/0 | 0/-/0 | - | - | - | - |
| defenseDodgeMods | combatFlow.ts:1031-1035 (5) | attaque | mount.{mountedDodgeMods} | 0/-/0 | 0/-/0 | - | - | - | - |
| previewDefense | combatFlow.ts:1048-1064 (17) | attaque | combatManeuvers.{bestDefenseMode} | 0/-/0 | 0/-/0 | - | - | - | - |
| previewCast | combatFlow.ts:1069-1105 (37) | attaque | - | 0/-/0 | 0/-/0 | - | - | - | castContextMods |
| previewResourceDelta | combatFlow.ts:1110-1126 (17) | attaque | mount.{mountMovement} | 0/-/0 | 0/-/0 | - | - | - | activeCombatant |
| attackPlan | combatFlow.ts:1625-1682 (58) | attaque | mount.{combatGeomOf,meleeWeaponInRange,mountMovement,mountOf} | 2/battle×1 scene×1/2 | 0/-/0 | - | - | previewAttack | bestAdjacentReachable,displayedReach |
| finalizeHeroDeath | combatFlow.ts:1688-1697 (10) | attaque | - | 0/-/0 | 1/pendingFateSave×1/0 | - | - | - | - |
| notifySlain | combatFlow.ts:1703-1713 (11) | attaque | combatEvents.{emitCombatEvent} | 1/battle×1/3 | 0/-/3 | - | - | - | releaseSeatsOfDowned,resolveTriggerImpureOps |
| CRIT_TABLE_IDS | combatFlow.ts:1719-1721 (3) | attaque | - | 0/-/0 | 0/-/0 | - | - | - | - |
| CRIT_TABLE_CATEGORIES | combatFlow.ts:1724-1726 (3) | attaque | - | 0/-/0 | 0/-/0 | - | - | - | - |
| top@1727:registerTableStepFamily | combatFlow.ts:1727-1738 (12) | attaque | - | 0/-/0 | 0/-/0 | - | - | CRIT_TABLE_IDS,CRIT_TABLE_CATEGORIES | - |
| critSeverityInSeam | combatFlow.ts:1747-1749 (3) | attaque | - | 0/-/0 | 0/-/0 | - | - | - | - |
| critSeverityDecl | combatFlow.ts:1759-1768 (10) | attaque | - | 0/-/0 | 0/-/0 | - | - | critSeverityInSeam,CRIT_TABLE_IDS | - |
| resolveCritSeverity | combatFlow.ts:1783-1793 (11) | attaque | - | 0/-/0 | 0/-/0 | - | - | critSeverityInSeam,critSeverityDecl | - |
| applyCriticalToTarget | combatFlow.ts:1798-1912 (115) | attaque | combat/triggeredTest.{routeTriggeredTest} ; combatEffects.{pushReveal} | 0/-/0 | 0/-/4 | - | - | applyStructureCriticalToTarget,applyHullCriticalToTarget,resolveCritSeverity | - |
| applyHullCriticalToTarget | combatFlow.ts:1923-1972 (50) | attaque | combat/triggeredTest.{bandeTriggeredTest} ; combatEffects.{pushCombatStep,pushReveal} | 0/-/0 | 0/-/4 | - | - | encaisserLeCoupDuMarin,naissanceDuCoupDuMarin | - |
| STRUCTURE_CRIT_TABLE | combatFlow.ts:1977-1977 (1) | attaque | - | 0/-/0 | 0/-/0 | - | - | - | - |
| top@1978:registerTableStepFamily | combatFlow.ts:1978-1984 (7) | attaque | - | 0/-/0 | 0/-/0 | - | - | STRUCTURE_CRIT_TABLE | - |
| applyStructureCriticalToTarget | combatFlow.ts:1996-2039 (44) | attaque | - | 0/-/0 | 0/-/1 | - | - | STRUCTURE_CRIT_TABLE | - |
| collapseStructure | combatFlow.ts:2045-2086 (42) | attaque | bus.{EVT,bus} ; combatEffects.{ouvrirChute} ; spawn.{placeCombatant} | 3/battle×2 *entier*×1/0 | 1/scene×1 battle×1 fn×1/1 | - | - | - | - |
| previewCritEntry | combatFlow.ts:2091-2109 (19) | attaque | - | 0/-/0 | 0/-/0 | - | - | - | - |
| deflectCrit | combatFlow.ts:2114-2118 (5) | attaque | - | 0/-/0 | 0/-/0 | - | - | - | - |
| applyCritAndFinalize | combatFlow.ts:2123-2131 (9) | attaque | - | 1/battle×1/2 | 0/-/2 | - | - | applyCriticalToTarget,finalizeHeroDeath | - |
| autoDeviate | combatFlow.ts:2143-2157 (15) | attaque | combatEffects.{pushReveal} | 0/-/0 | 0/-/1 | - | - | deflectCrit | - |
| pushDeviationStep | combatFlow.ts:2174-2206 (33) | attaque | - | 0/-/0 | 0/-/2 | - | - | - | - |
| top@2218:registerCascadeTableFold('deviation') | combatFlow.ts:2218-2229 (12) | attaque | - | 1/battle×1/0 | 0/-/0 | - | - | previewCritEntry,libelleDuCoup | - |
| breakBacleArmour | combatFlow.ts:2232-2234 (3) | attaque | - | 0/-/0 | 0/-/0 | - | - | - | - |
| weaponHasBlade | combatFlow.ts:2238-2240 (3) | attaque | - | 0/-/0 | 0/-/0 | - | - | - | - |
| applyOpposedCritical | combatFlow.ts:2249-2289 (41) | attaque | - | 2/battle×1 *entier*×1/2 | 0/-/4 | - | - | breakBacleArmour,autoDeviate,resolveCritSeverity,previewCritEntry,pushDeviationStep,applyCritAndFinalize,apresLeCritiqueDe | critRollTwiceFor |
| apresLeCritiqueDe | combatFlow.ts:2306-2319 (14) | attaque | combatEvents.{emitCombatEvent} | 0/-/0 | 0/-/0 | - | - | - | - |
| battleAreaTargets | combatFlow.ts:2324-2327 (4) | attaque | combatArea.{areaTargets} | 2/battle×1 scene×1/0 | 0/-/0 | - | - | - | - |
| siegeBlastRadiusTiles | combatFlow.ts:2331-2335 (5) | attaque | combatArea.{blastRadiusTiles} | 0/-/0 | 0/-/0 | - | - | - | - |
| pousserSauvegarde | combatFlow.ts:2348-2359 (12) | attaque | combatEffects.{revealPurpose} | 0/-/0 | 0/-/1 | - | - | - | - |
| top@2368:registerCascadeApplier('sauvegarde') | combatFlow.ts:2368-2380 (13) | attaque | - | 0/-/1 | 0/-/2 | - | - | pousserSauvegarde,reprendreApresSauvegarde | - |
| reprendreApresSauvegarde | combatFlow.ts:2385-2397 (13) | attaque | - | 0/-/3 | 0/-/3 | - | - | appliquerToucheDeProjectile,resumeMeleeAfterSuspension | jouerLeRebond |
| compterLesCritiquesDuProjectile | combatFlow.ts:2401-2415 (15) | attaque+sorts | - | 0/-/0 | 0/-/0 | - | - | causeDuProjectile | - |
| libelleDuCoup | combatFlow.ts:2435-2438 (4) | attaque+sorts | - | 0/-/0 | 0/-/0 | - | - | - | - |
| planifierLesCritiques | combatFlow.ts:2453-2490 (38) | attaque | - | 1/*entier*×1/0 | 0/-/2 | recompter,deviable | - | critSeverityInSeam,pushDeviationStep,critSeverityDecl,resolveCritSeverity,previewCritEntry,libelleDuCoup | - |
| appliquerLesCritiques | combatFlow.ts:2514-2544 (31) | attaque | - | 0/-/0 | 0/-/0 | set,get | - | breakBacleArmour,autoDeviate,deflectCrit,applyCritAndFinalize | - |
| encaisserLeCoup | combatFlow.ts:2563-2579 (17) | attaque | - | 0/-/0 | 0/-/0 | - | - | appliquerLesCritiques,apresLeCritiqueDe,cloreLeCoup | - |
| cloreLeCoup | combatFlow.ts:2583-2592 (10) | attaque | - | 1/battle×1/0 | 0/-/0 | - | - | resolveFirstBlood | - |
| naissanceDuCoupDuMarin | combatFlow.ts:2596-2607 (12) | attaque | - | 0/-/0 | 0/-/0 | - | - | localisationRelanceeDuProjectile | - |
| encaisserLeCoupDuMarin | combatFlow.ts:2613-2634 (22) | attaque | - | 1/battle×1/2 | 0/-/2 | - | - | compterLesCritiquesDuProjectile,planifierLesCritiques,encaisserLeCoup | critRollTwiceFor |
| applyAttackResult | combatFlow.ts:2662-2675 (14) | attaque | combatEffects.{OPS_DIFFEREES} | 0/-/2 | 0/-/2 | - | - | appliquerLaTouche,jouerLApresCoup | - |
| appliquerLaTouche | combatFlow.ts:2680-2999 (320) | attaque | bus.{EVT,bus} ; combat/hitModifiers.{runHitModifiers} ; combatArea.{resolveWeaponArea} ; combatEffects.{drainPendingLog} ; combatEvents.{emitCombatEvent} ; combatManeuvers.{bestDefenseMode} ; massBattleFlow.{massBattleTrackHit} ; shipCrew.{endShanty} | 6/battle×4 scene×2/31 | 4/facing×2 battle×2 fn×2/26 | - | - | checkFocusInterruption,pousserSauvegarde,finalizeHeroDeath,creatureAttackKind,notifySlain,checkBattleOver,planifierLesCritiques,encaisserLeCoup,applyOpposedCritical,weaponHasBlade,battleAreaTargets | clearActorAim,markActed,critRollTwiceFor,GRAPPLE_SOURCE |
| jouerLApresCoup | combatFlow.ts:3009-3038 (30) | attaque | - | 1/battle×1/7 | 0/-/7 | - | - | maladresseDeLAttaquant,maladresseDuDefenseur,riposteDeclaree,jouerLaFrappePassive,reactionDeBouclierEnDegats,jouerLaSuiteDuCoup | - |
| reactionDeBouclierEnDegats | combatFlow.ts:3042-3045 (4) | attaque | netOwnership.{defenseSurfaced} | 1/*entier*×1/1 | 0/-/1 | - | - | applyShieldReaction,defenseGagneeEnMelee | - |
| riposteDeclaree | combatFlow.ts:3050-3057 (8) | attaque | - | 0/-/0 | 0/-/0 | - | - | defenseGagneeEnMelee | - |
| defenseGagneeEnMelee | combatFlow.ts:3061-3064 (4) | attaque | - | 0/-/0 | 0/-/0 | - | - | - | - |
| jouerLaFrappePassive | combatFlow.ts:3070-3076 (7) | attaque | combatEffects.{OPS_DIFFEREES} | 0/-/1 | 0/-/1 | - | - | applyAttackResult | - |
| ecrireLaMaladresse | combatFlow.ts:3082-3088 (7) | attaque | combatEffects.{OPS_DIFFEREES} | 1/*entier*×1/2 | 0/-/2 | - | - | applyOups | - |
| maladresseDeLAttaquant | combatFlow.ts:3091-3094 (4) | attaque | - | 0/-/1 | 0/-/1 | - | - | attackerFumbled,ecrireLaMaladresse | - |
| maladresseDuDefenseur | combatFlow.ts:3098-3103 (6) | attaque | - | 0/-/1 | 0/-/1 | - | - | defenderFumbled,ecrireLaMaladresse | - |
| checkFocusInterruption | combatFlow.ts:3116-3128 (13) | attaque | combat/triggeredTest.{runCombatFlow} | 0/-/1 | 0/-/1 | - | - | - | - |
| applyFocusInterruption | combatFlow.ts:3138-3146 (9) | attaque | - | 1/pendingLogQueue×1/1 | 1/pendingLogQueue×1/1 | - | - | - | useSpellComponent,applyMiscast |
| attackerFumbled | combatFlow.ts:3151-3156 (6) | attaque | - | 0/-/0 | 0/-/0 | - | - | - | - |
| defenderFumbled | combatFlow.ts:3161-3166 (6) | attaque | - | 0/-/0 | 0/-/0 | - | - | - | - |
| inFiringBand | combatFlow.ts:3171-3179 (9) | attaque | - | 0/-/0 | 0/-/0 | - | - | - | - |
| alliesAtRange | combatFlow.ts:3183-3185 (3) | attaque | - | 0/-/0 | 0/-/0 | - | - | inFiringBand | - |
| ditLUsure | combatFlow.ts:3277-3280 (4) | attaque | - | 0/-/0 | 0/-/0 | - | - | - | - |
| wearActiveWeapon | combatFlow.ts:3288-3325 (38) | attaque | - | 0/-/0 | 0/-/0 | - | - | - | - |
| ouvrirDeDeCasse | combatFlow.ts:3337-3358 (22) | attaque | combatEffects.{revealPurpose} | 0/-/0 | 0/-/2 | - | - | - | - |
| applyOups | combatFlow.ts:3370-3482 (113) | attaque | bus.{EVT,bus} ; combatEffects.{OPS_DIFFEREES} | 4/battle×3 scene×1/1 | 1/battle×1/2 | - | - | ouvrirDeDeCasse,wearActiveWeapon,ditLUsure,alliesAtRange,checkBattleOver | - |
| top@3487:registerTableStep | combatFlow.ts:3487-3493 (7) | attaque | - | 0/-/0 | 0/-/0 | - | - | - | - |
| armeDeLaCasse | combatFlow.ts:3497-3502 (6) | attaque | - | 1/battle×1/0 | 0/-/0 | - | - | - | - |
| demandesDeLaCasse | combatFlow.ts:3506-3515 (10) | attaque | - | 2/battle×2/0 | 0/-/0 | - | - | - | - |
| top@3526:registerCascadeApplier('casseDArme') | combatFlow.ts:3526-3569 (44) | attaque | combatEffects.{OPS_DIFFEREES,jouerFlowEntier,nePeutPasDifferer} | 2/battle×2/7 | 0/-/5 | - | - | armeDeLaCasse,demandesDeLaCasse,applyOups,jouerLApresCoup | applyBladeTrap |
| applyShieldReaction | combatFlow.ts:3577-3603 (27) | attaque | bus.{EVT,bus} ; combatPlacement.{applyZoneCrossings} ; spawn.{placeCombatant} | 5/scene×3 battle×2/4 | 1/battle×1/2 | - | - | checkBattleOver | - |
| defenseEnCours | combatFlow.ts:3613-3615 (3) | attaque | - | 0/-/0 | 0/-/0 | - | - | - | - |
| refuserLaDefense | combatFlow.ts:3622-3628 (7) | attaque | - | 0/-/0 | 0/-/0 | - | - | - | - |
| openDefenseCascade | combatFlow.ts:3638-3646 (9) | attaque | - | 0/-/3 | 0/-/1 | - | - | - | - |
| maybeOpenDefense | combatFlow.ts:3653-3722 (70) | attaque | combatManeuvers.{bestDefenseMode} ; mount.{chargeDmgProxy} ; netOwnership.{defenseSurfaced} | 4/*entier*×2 scene×1 battle×1/5 | 2/pendingDefense×2/2 | - | - | defenseEnCours,refuserLaDefense,attackEnv,openDefenseCascade,applyIncomingMeleeAdvantage | - |
| surfacedDefensePending | combatFlow.ts:3739-3747 (9) | attaque | netOwnership.{defenseSurfaced} | 0/-/0 | 0/-/0 | - | - | victimeDuCoup | - |
| openSurfacedDefense | combatFlow.ts:3756-3781 (26) | attaque | combatManeuvers.{bestDefenseMode} ; mount.{chargeDmgProxy} | 3/*entier*×1 scene×1 battle×1/2 | 2/pendingDefense×2/1 | - | - | surfacedDefensePending,attackEnv,openDefenseCascade | - |
| heldGroundStanceBlock | combatFlow.ts:3791-3798 (8) | attaque | mount.{mountMovement} | 0/-/0 | 0/-/0 | - | - | - | - |
| intoCrowdStanceBlock | combatFlow.ts:3806-3816 (11) | attaque | - | 0/-/0 | 0/-/0 | - | - | crowdEligible | - |
| STANCE_BLOCK | combatFlow.ts:3820-3823 (4) | attaque | - | 0/-/0 | 0/-/0 | - | - | heldGroundStanceBlock,intoCrowdStanceBlock | - |
| withArmedStance | combatFlow.ts:3830-3844 (15) | attaque | - | 1/battle×1/0 | 0/-/0 | - | - | attackWeaponOf,STANCE_BLOCK | - |
| openAttackCascade | combatFlow.ts:3856-3865 (10) | attaque | - | 1/*entier*×1/2 | 0/-/2 | - | - | withArmedStance,poserLeTestDeMain,poserLEtapeDAttaque | - |
| poserLeTestDeMain | combatFlow.ts:3870-3876 (7) | attaque | - | 0/-/0 | 1/pendingHandGate×1/0 | - | - | - | - |
| poserLEtapeDAttaque | combatFlow.ts:3881-3889 (9) | attaque | - | 0/-/3 | 1/pendingAttack×1/1 | - | - | - | - |
| aiHandGate | combatFlow.ts:3897-3909 (13) | attaque | combatOrParty.{touchActors} | 2/battle×1 *entier*×1/1 | 2/battle×2/0 | - | - | - | - |
| doAttack | combatFlow.ts:3911-3940 (30) | attaque | combatEffects.{OPS_DIFFEREES} | 3/battle×2 log×1/5 | 2/battle×2/3 | log | - | attackWardGate,aiHandGate,firedWeapon,maybeOpenDefense,applyIncomingMeleeAdvantage,resolveAttack,applyAttackResult | - |
| jouerLesTirsDeBordee | combatFlow.ts:3949-3959 (11) | attaque | combatEffects.{OPS_DIFFEREES} | 1/battle×1/1 | 0/-/1 | - | - | applyAttackResult | - |
| cleaveTargets | combatFlow.ts:3968-3974 (7) | attaque | - | 0/-/0 | 0/-/0 | - | - | - | - |
| runCleaveChain | combatFlow.ts:3981-4002 (22) | attaque | bus.{EVT,bus} ; combatEffects.{OPS_DIFFEREES} | 2/battle×2/3 | 1/battle×1/2 | - | - | cleaveTargets,maybeOpenDefense,resolveAttack,applyAttackResult | - |
| resumeCleaveChain | combatFlow.ts:4006-4018 (13) | attaque | bus.{EVT,bus} ; combatPlacement.{displaceSmaller} ; spawn.{placeCombatant} | 2/scene×1 battle×1/2 | 1/battle×1/1 | - | - | runCleaveChain | - |
| autoCleave | combatFlow.ts:4027-4041 (15) | attaque | combatPlacement.{displaceSmaller} ; netOwnership.{aiDriven} ; spawn.{placeCombatant} | 2/*entier*×1 scene×1/2 | 0/-/1 | - | - | runCleaveChain | - |
| maybeHeroCleave | combatFlow.ts:4049-4083 (35) | attaque | combatPlacement.{displaceSmaller} ; spawn.{placeCombatant} | 4/*entier*×1 pendingCleave×1 scene×1 battle×1/1 | 2/pendingCleave×2 battle×2/0 | - | - | cleaveTargets | - |
| jouerLaSuiteDuCoup | combatFlow.ts:4107-4146 (40) | attaque | combat/hitModifiers.{toucheSauvee} | 3/battle×3/8 | 3/battle×2 pendingDualStrike×1/7 | - | - | applyFreeAttackEffects,dualStrikeTargets,maybeHeroCleave,resumeCleaveChain,jouerLesTirsDeBordee,autoCleave,jouerLApresCoup,resolveFreeAttacks | critRollTwiceFor,runPreemptShots |
| aiAvailableFreeAttack | combatFlow.ts:4162-4173 (12) | attaque | combatManeuvers.{availableFreeAttackOps} ; netOwnership.{aiDriven} | 2/*entier*×1 battle×1/1 | 0/-/1 | - | - | applyTalentFreeAttack | - |
| drainerLesGratuites | combatFlow.ts:4191-4195 (5) | attaque | - | 1/*entier*×1/2 | 0/-/2 | - | - | defenseEnCours,aiAvailableFreeAttack | aiCreatureFreeAttacks |
| applyTalentFreeAttack | combatFlow.ts:4210-4238 (29) | attaque | combatEffects.{OPS_DIFFEREES} ; netOwnership.{aiDriven} | 3/battle×2 *entier*×1/6 | 0/-/2 | - | - | maybeOpenDefense,resolveAttack,applyAttackResult | - |
| freeAttackHookImpl | combatFlow.ts:4243-4245 (3) | attaque | - | 0/-/1 | 0/-/1 | - | - | applyTalentFreeAttack | - |
| resolveFreeAttacks | combatFlow.ts:4251-4271 (21) | attaque | combat/triggeredTest.{runCombatFlow} | 2/*entier*×2/1 | 0/-/1 | - | - | defenseEnCours | - |
| creatureAttackKind | combatFlow.ts:4283-4285 (3) | attaque | - | 0/-/0 | 0/-/0 | - | - | - | - |
| applyFreeAttackEffects | combatFlow.ts:4290-4303 (14) | attaque | - | 1/log×1/1 | 0/-/0 | log | - | - | - |
| freeAttackTarget | combatFlow.ts:4306-4308 (3) | attaque | combatManeuvers.{freeAttackTargetOk} | 0/-/0 | 0/-/0 | - | - | - | - |
| applyFreeAttack | combatFlow.ts:4314-4326 (13) | attaque | combatEffects.{OPS_DIFFEREES} ; combatManeuvers.{bestDefenseMode} | 1/battle×1/3 | 0/-/2 | - | - | armeDeLaGratuite,maybeOpenDefense,applyAttackResult | - |
| resumeMeleeAfterSuspension | combatFlow.ts:4485-4500 (16) | attaque | combatEffects.{jouerFlowEntier} | 1/battle×1/1 | 0/-/1 | - | - | applyAttackResult | - |
| resolveDeviation | combatFlow.ts:4507-4526 (20) | attaque | - | 1/battle×1/4 | 0/-/4 | - | - | reprendreLeCoup,deflectCrit,applyCritAndFinalize,apresLeCritiqueDe,breakBacleArmour,cloreLaReprise | - |
| cloreLaReprise | combatFlow.ts:4530-4541 (12) | attaque | - | 4/battle×4/1 | 1/battle×1/1 | - | - | checkBattleOver | - |
| reprendreLeCoup | combatFlow.ts:4546-4563 (18) | attaque | - | 2/*entier*×2/6 | 0/-/6 | - | - | resumeMeleeAfterSuspension,encaisserLeCoupDuMarin,cloreLaReprise,appliquerToucheDeProjectile | jouerLeRebond |
| top@4573:registerCascadeApplier('deviation') | combatFlow.ts:4573-4581 (9) | attaque | - | 0/-/2 | 0/-/2 | - | - | reprendreLeCoup,resolveDeviation | - |
| resolveFirstBlood | combatFlow.ts:7124-7131 (8) | attaque | - | 0/-/0 | 0/-/0 | - | - | - | - |
| checkBattleOver | combatFlow.ts:7133-7223 (91) | attaque | bus.{EVT,bus} ; mount.{sweepDismountDeaths} ; shipCrew.{resolveShipUnits} ; shipwreck.{beginShipwreck} | 9/battle×5 pendingCascade×2 scene×1 vessel×1/8 | 5/battle×5/8 | - | - | collapseStructure,finishVictory | resolveSurrenderThreshold,openCombatEndCascade,finalizeBattle,victoryConditionMet |
| finishVictory | combatFlow.ts:7231-7275 (45) | attaque | bourseFlow.{condCtx,partyMoneyTotal} ; bus.{EVT,bus} ; combatEffects.{applyEffects,cloturer,gearFromEffects} | 4/battle×3 party×1/5 | 1/battle×1/3 | - | - | - | finalizeBattle |
| top@7276:registerCloture('ouvrirEcranDeVictoire') | combatFlow.ts:7276-7284 (9) | attaque | bourseFlow.{partyMoneyTotal} ; combatEffects.{registerCloture} | 1/party×1/1 | 1/pendingVictory×1/0 | - | - | - | - |
| finishCombatEnd | combatFlow.ts:7289-7298 (10) | attaque | - | 4/battle×3 combatCursor×1/2 | 2/combatCursor×1 battle×1/2 | - | - | finishVictory | finalizeBattle |
| rederiveAttack | rollFlowSpecs.ts:71-103 (33) | attaque | combatManeuvers.{bestDefenseMode} ; mount.{chargeDmgProxy} | 0/-/0 | 0/-/0 | - | - | firedWeapon | - |
| parryWeaponOf | rollFlowSpecs.ts:106-108 (3) | attaque | - | 0/-/0 | 0/-/0 | - | - | - | - |
| finishDefenseResult | rollFlowSpecs.ts:113-124 (12) | attaque | - | 0/-/0 | 0/-/0 | - | - | parryWeaponOf | defenseSubOf,forcedOpposedAtk |
| clore | combatFlow.ts:5903-5907 (5) | sorts | bus.{EVT,bus} | 1/battle×1/0 | 0/-/0 | - | - | - | - |
| causeDuProjectile | combatFlow.ts:5910-5910 (1) | sorts | - | 0/-/0 | 0/-/0 | - | - | - | - |
| appliquerToucheDeProjectile | combatFlow.ts:5929-6026 (98) | sorts | combat/hitModifiers.{runHitModifiers} ; corruptionFlow.{gainCorruption} | 5/gameTime×3 *entier*×2/11 | 0/-/9 | - | - | checkFocusInterruption,pousserSauvegarde,clore,planifierLesCritiques,compterLesCritiquesDuProjectile,appliquerLesCritiques,apresLeCritiqueDe | critRollTwiceFor,runCastFlow |
| localisationRelanceeDuProjectile | combatFlow.ts:6030-6033 (4) | sorts | - | 0/-/0 | 0/-/0 | - | - | causeDuProjectile | - |
| applyCast | combatFlow.ts:6115-6509 (395) | sorts | bus.{EVT,bus} ; combatEvents.{emitCombatEvent} ; combatPlacement.{applyZoneCrossings} ; consumableFlow.{runConsumable} ; corruptionFlow.{gainCorruption} ; spawn.{placeCombatant} ; summonFlow.{applySummon} | 13/gameTime×6 battle×4 scene×3/30 | 3/facing×2 battle×1 fn×2/24 | - | - | - | zoneRadiusMeters,useSpellComponent,castNearCorruption,applyMiscast,appliquerTouchePourCible,jouerLeRebond,placeSpellZone,runCastFlow,domainBreathType,applyAreaAttack,finishPlayerAction |
| FLOWS.attack | rollFlowSpecs.ts:523-638 (116) | attaque | bus.{EVT,bus} ; rollFlowFactory.{deDuJet,makeRollFlow} | 6/battle×3 pendingAttack×1 cleaveEnd×1 pendingCascade×1/3 | 5/pendingAttack×4 battle×2 facing×1/0 | cleaveEnd | - | rederiveAttack,resolveAttack,attackWeaponOf,firedWeapon | opposedForcedFloor,sealOutcome,clearApproachMoves |
| FLOWS.defense | rollFlowSpecs.ts:646-714 (69) | attaque | rollFlowFactory.{deDuJet,makeRollFlow} | 0/-/0 | 0/-/0 | - | - | finishDefenseResult,defenseDodgeMods,parryWeaponOf | opposedForcedFloor,opposedForcingCancelled,defenseSubOf,testOutcome |
| slice.fateNegate | combatSlice.ts:1824-1836 (13) | attaque | - | 1/*entier*×1/1 | 2/pendingFateSave×1 battle×1/1 | - | - | - | acquireAnimositeOnFate,resumeEnemyTurn |
| slice.fateSurvive | combatSlice.ts:1837-1852 (16) | attaque | - | 1/*entier*×1/2 | 2/pendingFateSave×1 battle×1/2 | - | - | - | acquireAnimositeOnFate,resolveRoundBoundary,resumeEnemyTurn |
| slice.fateAccept | combatSlice.ts:1853-1865 (13) | attaque | - | 1/*entier*×1/2 | 2/pendingFateSave×1 battle×1/2 | - | - | - | resolveRoundBoundary,resumeEnemyTurn |
| slice.handGateConfirm | combatSlice.ts:2066-2090 (25) | attaque | bus.{EVT,bus} ; combatOrParty.{touchActors} ; netOwnership.{aiDriven} | 6/*entier*×3 battle×2 dualStrikeAttack×1/3 | 3/pendingHandGate×1 battle×1 pendingDualStrike×1/2 | dualStrikeAttack | - | openAttackCascade | advanceCombatJet,resumeEnemyTurn |
| slice.attackSetLocation | combatSlice.ts:2273-2277 (5) | attaque | - | 1/pendingAttack×1/0 | 1/pendingAttack×1/0 | - | - | - | - |
| slice.attackSetWeapon | combatSlice.ts:2278-2282 (5) | attaque | - | 1/pendingAttack×1/0 | 1/pendingAttack×1/0 | - | - | - | - |
| slice.attackSetDualMode | combatSlice.ts:2283-2290 (8) | attaque | - | 2/pendingAttack×1 battle×1/0 | 1/pendingAttack×1/0 | - | - | - | - |
| slice.attackSetHarpoonRopeCut | combatSlice.ts:2291-2295 (5) | attaque | - | 1/pendingAttack×1/0 | 1/pendingAttack×1/0 | - | - | - | - |
| slice.attackSetWithhold | combatSlice.ts:2296-2300 (5) | attaque | - | 1/pendingAttack×1/0 | 1/pendingAttack×1/0 | - | - | - | - |
| slice.attackSetGrapple | combatSlice.ts:2301-2305 (5) | attaque | - | 1/pendingAttack×1/0 | 1/pendingAttack×1/0 | - | - | - | - |
| slice.attackSetCritLocation | combatSlice.ts:2306-2316 (11) | attaque | - | 2/pendingAttack×1 battle×1/0 | 1/pendingAttack×1/0 | - | - | victimeDuCoup,attackWeaponOf | - |
| slice.attackRoll | combatSlice.ts:2317-2341 (25) | attaque | - | 3/*entier*×2 log×1/3 | 2/pendingAttack×2/0 | log | - | applyIncomingMeleeAdvantage,attackWeaponOf,resolveAttack,defenseDodgeMods | advanceCombatJet |
| slice.attackConfirm | combatSlice.ts:2344-2479 (136) | attaque | bus.{EVT,bus} ; combatArea.{resolveWeaponArea} ; combatEffects.{jouerFlowEntier} ; combatManeuvers.{hasFreeWeaponAttack} ; mount.{mountMovement} | 13/battle×8 *entier*×1 pendingCleave×1 pendingDualStrike×1 pendingCascade×1 cascadeNext×1/12 | 9/battle×7 pendingAttack×1 pendingCleave×1 pendingDualStrike×1/7 | cascadeNext | - | victimeDuCoup,attackWeaponOf,openSurfacedDefense,applyAttackResult,checkBattleOver,battleAreaTargets,attackerFumbled | advanceCombatJet,markActed |
| slice.cleaveAttack | combatSlice.ts:2511-2520 (10) | attaque | - | 1/*entier*×1/1 | 0/-/1 | - | - | cleaveTargets | poserLaFrappeSuivante |
| slice.cleaveEnd | combatSlice.ts:2521-2525 (5) | attaque | - | 1/*entier*×1/1 | 1/pendingCleave×1/0 | - | - | - | advanceCombatJet |
| slice.dualStrikeAttack | combatSlice.ts:2526-2546 (21) | attaque | - | 1/*entier*×1/2 | 1/pendingDualStrike×1/2 | - | - | dualStrikeTargets,poserLeTestDeMain,resolveDualSecond | poserLaFrappeSuivante |
| slice.dualStrikeSkip | combatSlice.ts:2547-2547 (1) | attaque | - | 0/-/1 | 1/pendingDualStrike×1/0 | - | - | - | advanceCombatJet |
| slice.fumbleConfirm | combatSlice.ts:2557-2580 (24) | attaque | combatEffects.{OPS_DIFFEREES,jouerFlowEntier} | 3/*entier*×1 pendingCascade×1 cascadeNext×1/3 | 0/-/3 | cascadeNext | - | applyOups,jouerLApresCoup | - |
| slice.defenseSetMode | combatSlice.ts:2583-2588 (6) | attaque | - | 1/pendingDefense×1/0 | 1/pendingDefense×1/0 | - | - | - | - |
| slice.defenseSetParryWeapon | combatSlice.ts:2589-2593 (5) | attaque | - | 1/pendingDefense×1/0 | 1/pendingDefense×1/0 | - | - | - | - |
| slice.defenseSetShieldReaction | combatSlice.ts:2595-2599 (5) | attaque | - | 1/pendingDefense×1/0 | 1/pendingDefense×1/0 | - | - | - | - |
| slice.defenseSetRiposte | combatSlice.ts:2601-2605 (5) | attaque | - | 1/pendingDefense×1/0 | 1/pendingDefense×1/0 | - | - | - | - |
| slice.defenseConfirm | combatSlice.ts:2609-2673 (65) | attaque | - | 5/*entier*×3 cascadeNext×1 attackConfirm×1/3 | 2/pendingDefense×1 pendingCascade×1 pendingAttack×1 fn×1/3 | cascadeNext,attackConfirm | - | applyAttackResult,drainerLesGratuites | surLEtapeDeDefense,resumeEnemyTurn |

## 2. Agrégat par symbole externe (utilisé par N unités)

| symbole | module | zone | unités attaque | unités sorts | exemples |
|---|---|---|---|---|---|
| bus | state/bus | state | 11 | 2 | collapseStructure, appliquerLaTouche, applyOups, applyShieldReaction, runCleaveChain |
| EVT | state/bus | state | 11 | 2 | collapseStructure, appliquerLaTouche, applyOups, applyShieldReaction, runCleaveChain |
| OPS_DIFFEREES | state/combatEffects | state | 11 | 0 | applyAttackResult, jouerLaFrappePassive, ecrireLaMaladresse, applyOups, top@3526:registerCascadeApplier('casseDArme') |
| bestDefenseMode | state/combatManeuvers | state | 8 | 0 | resolveAttack, resolveDualSecond, previewDefense, appliquerLaTouche, maybeOpenDefense |
| placeCombatant | state/spawn | state | 5 | 1 | collapseStructure, applyShieldReaction, resumeCleaveChain, autoCleave, maybeHeroCleave |
| mountMovement | state/mount | state | 5 | 0 | attackEnv, previewResourceDelta, attackPlan, heldGroundStanceBlock, slice.attackConfirm |
| defenseSurfaced | state/netOwnership | state | 5 | 0 | resolveAttack, resolveDualSecond, reactionDeBouclierEnDegats, maybeOpenDefense, surfacedDefensePending |
| jouerFlowEntier | state/combatEffects | state | 4 | 0 | top@3526:registerCascadeApplier('casseDArme'), resumeMeleeAfterSuspension, slice.attackConfirm, slice.fumbleConfirm |
| emitCombatEvent | state/combatEvents | state | 3 | 1 | notifySlain, apresLeCritiqueDe, appliquerLaTouche, applyCast |
| chargeDmgProxy | state/mount | state | 4 | 0 | resolveAttack, maybeOpenDefense, openSurfacedDefense, rederiveAttack |
| combatGeomOf | state/mount | state | 4 | 0 | firedAttackBlock, resolveAttack, previewAttack, attackPlan |
| aiDriven | state/netOwnership | state | 4 | 0 | autoCleave, aiAvailableFreeAttack, applyTalentFreeAttack, slice.handGateConfirm |
| pushReveal | state/combatEffects | state | 3 | 0 | applyCriticalToTarget, applyHullCriticalToTarget, autoDeviate |
| displaceSmaller | state/combatPlacement | state | 3 | 0 | resumeCleaveChain, autoCleave, maybeHeroCleave |
| attackGeomOf | state/mount | state | 3 | 0 | firedAttackBlock, resolveAttack, previewAttack |
| partyMoneyTotal | state/bourseFlow | state | 2 | 0 | finishVictory, top@7276:registerCloture('ouvrirEcranDeVictoire') |
| runHitModifiers | state/combat/hitModifiers | state | 1 | 1 | appliquerLaTouche, appliquerToucheDeProjectile |
| runCombatFlow | state/combat/triggeredTest | state | 2 | 0 | checkFocusInterruption, resolveFreeAttacks |
| resolveWeaponArea | state/combatArea | state | 2 | 0 | appliquerLaTouche, slice.attackConfirm |
| revealPurpose | state/combatEffects | state | 2 | 0 | pousserSauvegarde, ouvrirDeDeCasse |
| touchActors | state/combatOrParty | state | 2 | 0 | aiHandGate, slice.handGateConfirm |
| applyZoneCrossings | state/combatPlacement | state | 1 | 1 | applyShieldReaction, applyCast |
| gainCorruption | state/corruptionFlow | state | 0 | 2 | appliquerToucheDeProjectile, applyCast |
| pickAttackWeaponList | state/mount | state | 2 | 0 | firedWeapon, firedAttackBlock |
| deDuJet | state/rollFlowFactory | state | 2 | 0 | FLOWS.attack, FLOWS.defense |
| makeRollFlow | state/rollFlowFactory | state | 2 | 0 | FLOWS.attack, FLOWS.defense |
| condCtx | state/bourseFlow | state | 1 | 0 | finishVictory |
| toucheSauvee | state/combat/hitModifiers | state | 1 | 0 | jouerLaSuiteDuCoup |
| bandeTriggeredTest | state/combat/triggeredTest | state | 1 | 0 | applyHullCriticalToTarget |
| routeTriggeredTest | state/combat/triggeredTest | state | 1 | 0 | applyCriticalToTarget |
| areaTargets | state/combatArea | state | 1 | 0 | battleAreaTargets |
| blastRadiusTiles | state/combatArea | state | 1 | 0 | siegeBlastRadiusTiles |
| applyEffects | state/combatEffects | state | 1 | 0 | finishVictory |
| cloturer | state/combatEffects | state | 1 | 0 | finishVictory |
| drainPendingLog | state/combatEffects | state | 1 | 0 | appliquerLaTouche |
| gearFromEffects | state/combatEffects | state | 1 | 0 | finishVictory |
| nePeutPasDifferer | state/combatEffects | state | 1 | 0 | top@3526:registerCascadeApplier('casseDArme') |
| ouvrirChute | state/combatEffects | state | 1 | 0 | collapseStructure |
| pushCombatStep | state/combatEffects | state | 1 | 0 | applyHullCriticalToTarget |
| registerCloture | state/combatEffects | state | 1 | 0 | top@7276:registerCloture('ouvrirEcranDeVictoire') |
| availableFreeAttackOps | state/combatManeuvers | state | 1 | 0 | aiAvailableFreeAttack |
| freeAttackTargetOk | state/combatManeuvers | state | 1 | 0 | freeAttackTarget |
| hasFreeWeaponAttack | state/combatManeuvers | state | 1 | 0 | slice.attackConfirm |
| teamCommandMod | state/commandTeam | state | 1 | 0 | attackEnv |
| runConsumable | state/consumableFlow | state | 0 | 1 | applyCast |
| massBattleTrackHit | state/massBattleFlow | state | 1 | 0 | appliquerLaTouche |
| meleeWeaponInRange | state/mount | state | 1 | 0 | attackPlan |
| mountedAttackMods | state/mount | state | 1 | 0 | attackEnv |
| mountedDodgeMods | state/mount | state | 1 | 0 | defenseDodgeMods |
| mountOf | state/mount | state | 1 | 0 | attackPlan |
| sweepDismountDeaths | state/mount | state | 1 | 0 | checkBattleOver |
| endShanty | state/shipCrew | state | 1 | 0 | appliquerLaTouche |
| resolveShipUnits | state/shipCrew | state | 1 | 0 | checkBattleOver |
| crewPosteOf | state/shipPostes | state | 1 | 0 | attackEnv |
| mountedWeaponBears | state/shipPostes | state | 1 | 0 | firedAttackBlock |
| servingCrewPresent | state/shipPostes | state | 1 | 0 | firedWeapon |
| shipOfCrew | state/shipPostes | state | 1 | 0 | firedAttackBlock |
| beginShipwreck | state/shipwreck | state | 1 | 0 | checkBattleOver |
| applySummon | state/summonFlow | state | 0 | 1 | applyCast |

## 3. Graphe interne et ordre topologique (feuilles d'abord ; composantes fortement connexes entre accolades)

| rang | composante | appelle (dans la liste) | appelée par (dans la liste) |
|---|---|---|---|
| 1 | applyIncomingMeleeAdvantage | (feuille) | maybeOpenDefense, doAttack, slice.attackRoll |
| 2 | armeDeLaGratuite | (feuille) | attackWeaponOf, applyFreeAttack |
| 3 | weaponContextOf | (feuille) | firedWeapon, resolveDualSecond |
| 4 | firedWeapon | weaponContextOf | attackWeaponOf, resolveAttack, previewAttack, doAttack, rederiveAttack, FLOWS.attack |
| 5 | attackWeaponOf | armeDeLaGratuite, firedWeapon | withArmedStance, FLOWS.attack, slice.attackSetCritLocation, slice.attackRoll, slice.attackConfirm |
| 6 | victimeDuCoup | (feuille) | surfacedDefensePending, slice.attackSetCritLocation, slice.attackConfirm |
| 7 | banRangedActive | (feuille) | firedAttackBlock, resolveAttack |
| 8 | siegeActif | (feuille) | (racine) |
| 9 | firedAttackBlock | banRangedActive | (racine) |
| 10 | strayShotVictim | (feuille) | resolveAttack |
| 11 | crowdEligible | (feuille) | attackEnv, intoCrowdStanceBlock |
| 12 | attackWardGate | (feuille) | doAttack |
| 13 | isBlackPowderWeapon | (feuille) | attackEnv |
| 14 | withAttackerAt | (feuille) | attackEnv |
| 15 | attackEnv | withAttackerAt, isBlackPowderWeapon, crowdEligible | resolveAttack, resolveDualSecond, previewAttack, maybeOpenDefense, openSurfacedDefense |
| 16 | defenseDodgeMods | (feuille) | resolveAttack, resolveDualSecond, FLOWS.defense, slice.attackRoll |
| 17 | resolveAttack | firedWeapon, banRangedActive, attackEnv, defenseDodgeMods, strayShotVictim | doAttack, runCleaveChain, applyTalentFreeAttack, FLOWS.attack, slice.attackRoll |
| 18 | resolveDualSecond | weaponContextOf, attackEnv, defenseDodgeMods | slice.dualStrikeAttack |
| 19 | dualStrikeTargets | (feuille) | jouerLaSuiteDuCoup, slice.dualStrikeAttack |
| 20 | previewAttack | firedWeapon, attackEnv | attackPlan |
| 21 | difficultyOf | (feuille) | (racine) |
| 22 | previewDefense | (feuille) | (racine) |
| 23 | previewCast | (feuille) | (racine) |
| 24 | previewResourceDelta | (feuille) | (racine) |
| 25 | attackPlan | previewAttack | (racine) |
| 26 | finalizeHeroDeath | (feuille) | applyCritAndFinalize, appliquerLaTouche |
| 27 | notifySlain | (feuille) | appliquerLaTouche |
| 28 | CRIT_TABLE_IDS | (feuille) | top@1727:registerTableStepFamily, critSeverityDecl |
| 29 | CRIT_TABLE_CATEGORIES | (feuille) | top@1727:registerTableStepFamily |
| 30 | top@1727:registerTableStepFamily | CRIT_TABLE_IDS, CRIT_TABLE_CATEGORIES | (racine) |
| 31 | critSeverityInSeam | (feuille) | critSeverityDecl, resolveCritSeverity, planifierLesCritiques |
| 32 | critSeverityDecl | critSeverityInSeam, CRIT_TABLE_IDS | resolveCritSeverity, planifierLesCritiques |
| 33 | resolveCritSeverity | critSeverityInSeam, critSeverityDecl | applyCriticalToTarget, applyOpposedCritical, planifierLesCritiques |
| 34 | STRUCTURE_CRIT_TABLE | (feuille) | top@1978:registerTableStepFamily, applyStructureCriticalToTarget |
| 35 | applyStructureCriticalToTarget | STRUCTURE_CRIT_TABLE | applyCriticalToTarget |
| 36 | causeDuProjectile | (feuille) | compterLesCritiquesDuProjectile, localisationRelanceeDuProjectile |
| 37 | compterLesCritiquesDuProjectile | causeDuProjectile | encaisserLeCoupDuMarin, appliquerToucheDeProjectile |
| 38 | pushDeviationStep | (feuille) | applyOpposedCritical, planifierLesCritiques |
| 39 | previewCritEntry | (feuille) | top@2218:registerCascadeTableFold('deviation'), applyOpposedCritical, planifierLesCritiques |
| 40 | libelleDuCoup | (feuille) | top@2218:registerCascadeTableFold('deviation'), planifierLesCritiques |
| 41 | planifierLesCritiques | critSeverityInSeam, pushDeviationStep, critSeverityDecl, resolveCritSeverity, previewCritEntry, libelleDuCoup | encaisserLeCoupDuMarin, appliquerLaTouche, appliquerToucheDeProjectile |
| 42 | breakBacleArmour | (feuille) | applyOpposedCritical, appliquerLesCritiques, resolveDeviation |
| 43 | deflectCrit | (feuille) | autoDeviate, appliquerLesCritiques, resolveDeviation |
| 44 | autoDeviate | deflectCrit | applyOpposedCritical, appliquerLesCritiques |
| 45 | apresLeCritiqueDe | (feuille) | applyOpposedCritical, encaisserLeCoup, resolveDeviation, appliquerToucheDeProjectile |
| 46 | resolveFirstBlood | (feuille) | cloreLeCoup |
| 47 | cloreLeCoup | resolveFirstBlood | encaisserLeCoup |
| 48 | localisationRelanceeDuProjectile | causeDuProjectile | naissanceDuCoupDuMarin |
| 49 | naissanceDuCoupDuMarin | localisationRelanceeDuProjectile | applyHullCriticalToTarget |
| 50 | {applyCritAndFinalize, appliquerLesCritiques, encaisserLeCoup, encaisserLeCoupDuMarin, applyHullCriticalToTarget, applyCriticalToTarget} | finalizeHeroDeath, breakBacleArmour, autoDeviate, deflectCrit, apresLeCritiqueDe, cloreLeCoup, compterLesCritiquesDuProjectile, planifierLesCritiques, naissanceDuCoupDuMarin, applyStructureCriticalToTarget, resolveCritSeverity | applyOpposedCritical, resolveDeviation, appliquerToucheDeProjectile, appliquerLaTouche, reprendreLeCoup |
| 51 | top@1978:registerTableStepFamily | STRUCTURE_CRIT_TABLE | (racine) |
| 52 | collapseStructure | (feuille) | checkBattleOver |
| 53 | top@2218:registerCascadeTableFold('deviation') | previewCritEntry, libelleDuCoup | (racine) |
| 54 | weaponHasBlade | (feuille) | appliquerLaTouche |
| 55 | applyOpposedCritical | breakBacleArmour, autoDeviate, resolveCritSeverity, previewCritEntry, pushDeviationStep, applyCritAndFinalize, apresLeCritiqueDe | appliquerLaTouche |
| 56 | battleAreaTargets | (feuille) | appliquerLaTouche, slice.attackConfirm |
| 57 | siegeBlastRadiusTiles | (feuille) | (racine) |
| 58 | pousserSauvegarde | (feuille) | top@2368:registerCascadeApplier('sauvegarde'), appliquerLaTouche, appliquerToucheDeProjectile |
| 59 | checkFocusInterruption | (feuille) | appliquerLaTouche, appliquerToucheDeProjectile |
| 60 | clore | (feuille) | appliquerToucheDeProjectile |
| 61 | appliquerToucheDeProjectile | checkFocusInterruption, pousserSauvegarde, clore, planifierLesCritiques, compterLesCritiquesDuProjectile, appliquerLesCritiques, apresLeCritiqueDe | reprendreApresSauvegarde, reprendreLeCoup |
| 62 | creatureAttackKind | (feuille) | appliquerLaTouche |
| 63 | finishVictory | (feuille) | checkBattleOver, finishCombatEnd |
| 64 | checkBattleOver | collapseStructure, finishVictory | appliquerLaTouche, applyOups, applyShieldReaction, cloreLaReprise, slice.attackConfirm |
| 65 | appliquerLaTouche | checkFocusInterruption, pousserSauvegarde, finalizeHeroDeath, creatureAttackKind, notifySlain, checkBattleOver, planifierLesCritiques, encaisserLeCoup, applyOpposedCritical, weaponHasBlade, battleAreaTargets | applyAttackResult |
| 66 | attackerFumbled | (feuille) | maladresseDeLAttaquant, slice.attackConfirm |
| 67 | ouvrirDeDeCasse | (feuille) | applyOups |
| 68 | wearActiveWeapon | (feuille) | applyOups |
| 69 | ditLUsure | (feuille) | applyOups |
| 70 | inFiringBand | (feuille) | alliesAtRange |
| 71 | alliesAtRange | inFiringBand | applyOups |
| 72 | applyOups | ouvrirDeDeCasse, wearActiveWeapon, ditLUsure, alliesAtRange, checkBattleOver | ecrireLaMaladresse, top@3526:registerCascadeApplier('casseDArme'), slice.fumbleConfirm |
| 73 | ecrireLaMaladresse | applyOups | maladresseDeLAttaquant, maladresseDuDefenseur |
| 74 | maladresseDeLAttaquant | attackerFumbled, ecrireLaMaladresse | jouerLApresCoup |
| 75 | defenderFumbled | (feuille) | maladresseDuDefenseur |
| 76 | maladresseDuDefenseur | defenderFumbled, ecrireLaMaladresse | jouerLApresCoup |
| 77 | defenseGagneeEnMelee | (feuille) | reactionDeBouclierEnDegats, riposteDeclaree |
| 78 | riposteDeclaree | defenseGagneeEnMelee | jouerLApresCoup |
| 79 | applyShieldReaction | checkBattleOver | reactionDeBouclierEnDegats |
| 80 | reactionDeBouclierEnDegats | applyShieldReaction, defenseGagneeEnMelee | jouerLApresCoup |
| 81 | applyFreeAttackEffects | (feuille) | jouerLaSuiteDuCoup |
| 82 | cleaveTargets | (feuille) | runCleaveChain, maybeHeroCleave, slice.cleaveAttack |
| 83 | maybeHeroCleave | cleaveTargets | jouerLaSuiteDuCoup |
| 84 | defenseEnCours | (feuille) | maybeOpenDefense, drainerLesGratuites, resolveFreeAttacks |
| 85 | refuserLaDefense | (feuille) | maybeOpenDefense |
| 86 | openDefenseCascade | (feuille) | maybeOpenDefense, openSurfacedDefense |
| 87 | maybeOpenDefense | defenseEnCours, refuserLaDefense, attackEnv, openDefenseCascade, applyIncomingMeleeAdvantage | doAttack, runCleaveChain, applyTalentFreeAttack, applyFreeAttack |
| 88 | resolveFreeAttacks | defenseEnCours | jouerLaSuiteDuCoup |
| 89 | {autoCleave, jouerLesTirsDeBordee, runCleaveChain, resumeCleaveChain, jouerLaSuiteDuCoup, jouerLaFrappePassive, jouerLApresCoup, applyAttackResult} | cleaveTargets, maybeOpenDefense, resolveAttack, applyFreeAttackEffects, dualStrikeTargets, maybeHeroCleave, resolveFreeAttacks, maladresseDeLAttaquant, maladresseDuDefenseur, riposteDeclaree, reactionDeBouclierEnDegats, appliquerLaTouche | top@3526:registerCascadeApplier('casseDArme'), slice.fumbleConfirm, doAttack, applyTalentFreeAttack, applyFreeAttack, resumeMeleeAfterSuspension, slice.attackConfirm, slice.defenseConfirm |
| 90 | resumeMeleeAfterSuspension | applyAttackResult | reprendreApresSauvegarde, reprendreLeCoup |
| 91 | reprendreApresSauvegarde | appliquerToucheDeProjectile, resumeMeleeAfterSuspension | top@2368:registerCascadeApplier('sauvegarde') |
| 92 | top@2368:registerCascadeApplier('sauvegarde') | pousserSauvegarde, reprendreApresSauvegarde | (racine) |
| 93 | applyFocusInterruption | (feuille) | (racine) |
| 94 | top@3487:registerTableStep | (feuille) | (racine) |
| 95 | armeDeLaCasse | (feuille) | top@3526:registerCascadeApplier('casseDArme') |
| 96 | demandesDeLaCasse | (feuille) | top@3526:registerCascadeApplier('casseDArme') |
| 97 | top@3526:registerCascadeApplier('casseDArme') | armeDeLaCasse, demandesDeLaCasse, applyOups, jouerLApresCoup | (racine) |
| 98 | surfacedDefensePending | victimeDuCoup | openSurfacedDefense |
| 99 | openSurfacedDefense | surfacedDefensePending, attackEnv, openDefenseCascade | slice.attackConfirm |
| 100 | heldGroundStanceBlock | (feuille) | STANCE_BLOCK |
| 101 | intoCrowdStanceBlock | crowdEligible | STANCE_BLOCK |
| 102 | STANCE_BLOCK | heldGroundStanceBlock, intoCrowdStanceBlock | withArmedStance |
| 103 | withArmedStance | attackWeaponOf, STANCE_BLOCK | openAttackCascade |
| 104 | poserLeTestDeMain | (feuille) | openAttackCascade, slice.dualStrikeAttack |
| 105 | poserLEtapeDAttaque | (feuille) | openAttackCascade |
| 106 | openAttackCascade | withArmedStance, poserLeTestDeMain, poserLEtapeDAttaque | slice.handGateConfirm |
| 107 | aiHandGate | (feuille) | doAttack |
| 108 | doAttack | attackWardGate, aiHandGate, firedWeapon, maybeOpenDefense, applyIncomingMeleeAdvantage, resolveAttack, applyAttackResult | (racine) |
| 109 | applyTalentFreeAttack | maybeOpenDefense, resolveAttack, applyAttackResult | aiAvailableFreeAttack, freeAttackHookImpl |
| 110 | aiAvailableFreeAttack | applyTalentFreeAttack | drainerLesGratuites |
| 111 | drainerLesGratuites | defenseEnCours, aiAvailableFreeAttack | slice.defenseConfirm |
| 112 | freeAttackHookImpl | applyTalentFreeAttack | (racine) |
| 113 | freeAttackTarget | (feuille) | (racine) |
| 114 | applyFreeAttack | armeDeLaGratuite, maybeOpenDefense, applyAttackResult | (racine) |
| 115 | cloreLaReprise | checkBattleOver | resolveDeviation, reprendreLeCoup |
| 116 | reprendreLeCoup | resumeMeleeAfterSuspension, encaisserLeCoupDuMarin, cloreLaReprise, appliquerToucheDeProjectile | resolveDeviation, top@4573:registerCascadeApplier('deviation') |
| 117 | resolveDeviation | reprendreLeCoup, deflectCrit, applyCritAndFinalize, apresLeCritiqueDe, breakBacleArmour, cloreLaReprise | top@4573:registerCascadeApplier('deviation') |
| 118 | top@4573:registerCascadeApplier('deviation') | reprendreLeCoup, resolveDeviation | (racine) |
| 119 | top@7276:registerCloture('ouvrirEcranDeVictoire') | (feuille) | (racine) |
| 120 | finishCombatEnd | finishVictory | (racine) |
| 121 | rederiveAttack | firedWeapon | FLOWS.attack |
| 122 | parryWeaponOf | (feuille) | finishDefenseResult, FLOWS.defense |
| 123 | finishDefenseResult | parryWeaponOf | FLOWS.defense |
| 124 | applyCast | (feuille) | (racine) |
| 125 | FLOWS.attack | rederiveAttack, resolveAttack, attackWeaponOf, firedWeapon | (racine) |
| 126 | FLOWS.defense | finishDefenseResult, defenseDodgeMods, parryWeaponOf | (racine) |
| 127 | slice.fateNegate | (feuille) | (racine) |
| 128 | slice.fateSurvive | (feuille) | (racine) |
| 129 | slice.fateAccept | (feuille) | (racine) |
| 130 | slice.handGateConfirm | openAttackCascade | (racine) |
| 131 | slice.attackSetLocation | (feuille) | (racine) |
| 132 | slice.attackSetWeapon | (feuille) | (racine) |
| 133 | slice.attackSetDualMode | (feuille) | (racine) |
| 134 | slice.attackSetHarpoonRopeCut | (feuille) | (racine) |
| 135 | slice.attackSetWithhold | (feuille) | (racine) |
| 136 | slice.attackSetGrapple | (feuille) | (racine) |
| 137 | slice.attackSetCritLocation | victimeDuCoup, attackWeaponOf | (racine) |
| 138 | slice.attackRoll | applyIncomingMeleeAdvantage, attackWeaponOf, resolveAttack, defenseDodgeMods | (racine) |
| 139 | slice.attackConfirm | victimeDuCoup, attackWeaponOf, openSurfacedDefense, applyAttackResult, checkBattleOver, battleAreaTargets, attackerFumbled | (racine) |
| 140 | slice.cleaveAttack | cleaveTargets | (racine) |
| 141 | slice.cleaveEnd | (feuille) | (racine) |
| 142 | slice.dualStrikeAttack | dualStrikeTargets, poserLeTestDeMain, resolveDualSecond | (racine) |
| 143 | slice.dualStrikeSkip | (feuille) | (racine) |
| 144 | slice.fumbleConfirm | applyOups, jouerLApresCoup | (racine) |
| 145 | slice.defenseSetMode | (feuille) | (racine) |
| 146 | slice.defenseSetParryWeapon | (feuille) | (racine) |
| 147 | slice.defenseSetShieldReaction | (feuille) | (racine) |
| 148 | slice.defenseSetRiposte | (feuille) | (racine) |
| 149 | slice.defenseConfirm | applyAttackResult, drainerLesGratuites | (racine) |

Composantes cycliques (taille>1) : 6, 8.

## 4. Appelés directs HORS liste (fonctions de combatFlow / rollFlowSpecs / combatSlice, un niveau)

| fonction | fichier:lignes | appelée par (unités de la liste) | dépendances hors zones propres |
|---|---|---|---|
| activeDayWeather | combatFlow.ts:597-599 | attackEnv | - |
| castContextMods | combatFlow.ts:6677-6694 | previewCast | - |
| activeCombatant | combatFlow.ts:263-265 | previewResourceDelta | - |
| bestAdjacentReachable | combatFlow.ts:1429-1444 | attackPlan | - |
| displayedReach | combatFlow.ts:1519-1523 | attackPlan | - |
| releaseSeatsOfDowned | combatFlow.ts:6969-6983 | notifySlain | - |
| resolveTriggerImpureOps | combatFlow.ts:6577-6587 | notifySlain | summonFlow.{applySummon} |
| critRollTwiceFor | combatFlow.ts:182-184 | applyOpposedCritical, encaisserLeCoupDuMarin, appliquerLaTouche, jouerLaSuiteDuCoup, appliquerToucheDeProjectile | - |
| jouerLeRebond | combatFlow.ts:6076-6112 | reprendreApresSauvegarde, reprendreLeCoup, applyCast | - |
| clearActorAim | combatFlow.ts:7425-7427 | appliquerLaTouche | - |
| markActed | combatFlow.ts:7790-7795 | appliquerLaTouche, slice.attackConfirm | - |
| GRAPPLE_SOURCE | combatFlow.ts:1388-1388 | appliquerLaTouche | - |
| useSpellComponent | combatFlow.ts:4705-4715 | applyFocusInterruption, applyCast | - |
| applyMiscast | combatFlow.ts:4823-4859 | applyFocusInterruption, applyCast | - |
| applyBladeTrap | combatFlow.ts:7324-7372 | top@3526:registerCascadeApplier('casseDArme') | bus.{EVT,bus} ; combatEffects.{OPS_DIFFEREES} |
| runPreemptShots | combatFlow.ts:3191-3229 | jouerLaSuiteDuCoup | bus.{EVT,bus} ; combatEffects.{OPS_DIFFEREES} ; netOwnership.{aiDriven} |
| aiCreatureFreeAttacks | combatFlow.ts:4587-4667 | drainerLesGratuites | bus.{EVT,bus} ; combatManeuvers.{MELEE_MANEUVER_KINDS,freeAttackCost,gratuitesRestantes} ; mount.{mountMovement} |
| resolveSurrenderThreshold | combatFlow.ts:7108-7116 | checkBattleOver | - |
| openCombatEndCascade | combatFlow.ts:6810-6885 | checkBattleOver | combat/triggeredTest.{routeTriggeredTest} ; combatEffects.{drainPendingLog} ; combatEndBands.{combatEndBands} ; corruptionFlow.{testDExposition} ; nightBands.{nightBands} |
| finalizeBattle | combatFlow.ts:7014-7071 | checkBattleOver, finishVictory, finishCombatEnd | combatEvents.{emitCombatEvent} ; combatPlacement.{removeEntities} ; seaVoyageFlow.{setVesselHull} |
| victoryConditionMet | combatFlow.ts:7076-7101 | checkBattleOver | - |
| defenseSubOf | rollFlowSpecs.ts:180-183 | finishDefenseResult, FLOWS.defense | - |
| forcedOpposedAtk | rollFlowSpecs.ts:172-175 | finishDefenseResult | - |
| runCastFlow | combatFlow.ts:5882-5887 | appliquerToucheDeProjectile, applyCast | combat/triggeredTest.{runCombatFlow} ; combatEffects.{drainPendingLog} |
| zoneRadiusMeters | combatFlow.ts:5387-5390 | applyCast | - |
| castNearCorruption | combatFlow.ts:6640-6646 | applyCast | - |
| appliquerTouchePourCible | combatFlow.ts:6042-6067 | applyCast | - |
| placeSpellZone | combatFlow.ts:6516-6535 | applyCast | - |
| domainBreathType | combatFlow.ts:6616-6618 | applyCast | - |
| applyAreaAttack | combatFlow.ts:4337-4342 | applyCast | combatManeuvers.{maneuverAttackerDifficulty,resolveManeuver,rollManeuverAttacker} |
| finishPlayerAction | combatFlow.ts:4964-4982 | applyCast | bus.{EVT,bus} ; combatEffects.{drainPendingLog} ; combatOrParty.{touchActors} |
| opposedForcedFloor | rollFlowSpecs.ts:153-155 | FLOWS.attack, FLOWS.defense | - |
| sealOutcome | rollFlowSpecs.ts:307-308 | FLOWS.attack | - |
| clearApproachMoves | combatFlow.ts:7772-7774 | FLOWS.attack | - |
| opposedForcingCancelled | rollFlowSpecs.ts:136-138 | FLOWS.defense | - |
| testOutcome | rollFlowSpecs.ts:312-313 | FLOWS.defense | - |
| acquireAnimositeOnFate | combatSlice.ts:149-158 | slice.fateNegate, slice.fateSurvive | - |
| resumeEnemyTurn | combatFlow.ts:7431-7435 | slice.fateNegate, slice.fateSurvive, slice.fateAccept, slice.handGateConfirm, slice.defenseConfirm | combatDirector.{beatHold} ; combatGate.{combatAdvanceBlocked} ; web/minuteries.{scheduleCombatTimer} |
| resolveRoundBoundary | combatFlow.ts:7586-7651 | slice.fateSurvive, slice.fateAccept | - |
| advanceCombatJet | combatSlice.ts:285-291 | slice.handGateConfirm, slice.attackRoll, slice.attackConfirm, slice.cleaveEnd, slice.dualStrikeSkip | targetingHolder.{coupFerme} |
| poserLaFrappeSuivante | combatSlice.ts:304-311 | slice.cleaveAttack, slice.dualStrikeAttack | - |
| surLEtapeDeDefense | combatSlice.ts:295-298 | slice.defenseConfirm | - |

Fermeture transitive de l'attaque dans les trois fichiers (fonctions/constantes top-level + locaux de createCombatSlice) : 301 candidats atteints (liste initiale 161) ; total candidats 353. Par fichier : {"state/combatFlow.ts":236,"state/rollFlowSpecs.ts":38,"state/combatSlice.ts":27}

## 5. Fermeture par symbole externe utilisé (précis : références de valeur d'une déclaration, transitives hors zones autorisées)

Colonnes : décl. = nombre de déclarations atteintes (soi inclus) ; fichiers state = nombre de fichiers `src/state` distincts ; autres zones = fichiers hors state/zones autorisées ; store = atteint une déclaration de `store.ts` (chaîne la plus courte) ; combatFlow = atteint `combatFlow.ts`.

| symbole | décl. | fichiers state | autres zones | store.ts ? | combatFlow.ts ? | chaîne vers store |
|---|---|---|---|---|---|---|
| bourseFlow.condCtx | 3 | 1 | - | non | non |  |
| bourseFlow.partyMoneyTotal | 2 | 1 | - | non | non |  |
| bus.bus | 2 | 1 | - | non | non |  |
| bus.EVT | 1 | 1 | - | non | non |  |
| combat/hitModifiers.runHitModifiers | 2 | 1 | - | non | non |  |
| combat/hitModifiers.toucheSauvee | 1 | 1 | - | non | non |  |
| combat/triggeredTest.bandeTriggeredTest | 1718 | 126 | web/stockageWeb.ts,net/relay.ts,net/session.ts,web/minuteries.ts,net/compress.ts,net/protocol.ts | OUI | OUI | combat/triggeredTest.ts#bandeTriggeredTest > combat/triggeredTest.ts#runCombatFlow > combat/triggeredTest.ts#resolveFlowTest > combatEffects.ts#runFlow > combatEffects.ts#EFFECT_HANDLERS > campaignData.ts#documentById > campaignData.ts#maps > store.ts#useGame |
| combat/triggeredTest.routeTriggeredTest | 1718 | 126 | web/stockageWeb.ts,net/relay.ts,net/session.ts,web/minuteries.ts,net/compress.ts,net/protocol.ts | OUI | OUI | combat/triggeredTest.ts#routeTriggeredTest > combat/triggeredTest.ts#runCombatFlow > combat/triggeredTest.ts#resolveFlowTest > combatEffects.ts#runFlow > combatEffects.ts#EFFECT_HANDLERS > campaignData.ts#documentById > campaignData.ts#maps > store.ts#useGame |
| combat/triggeredTest.runCombatFlow | 1718 | 126 | web/stockageWeb.ts,net/relay.ts,net/session.ts,web/minuteries.ts,net/compress.ts,net/protocol.ts | OUI | OUI | combat/triggeredTest.ts#runCombatFlow > combat/triggeredTest.ts#resolveFlowTest > combatEffects.ts#runFlow > combatEffects.ts#EFFECT_HANDLERS > campaignData.ts#documentById > campaignData.ts#maps > store.ts#useGame |
| combatArea.areaTargets | 2 | 1 | - | non | non |  |
| combatArea.blastRadiusTiles | 3 | 1 | - | non | non |  |
| combatArea.resolveWeaponArea | 5 | 3 | - | non | non |  |
| combatEffects.applyEffects | 1718 | 126 | web/stockageWeb.ts,net/relay.ts,net/session.ts,web/minuteries.ts,net/compress.ts,net/protocol.ts | OUI | OUI | combatEffects.ts#applyEffects > combatEffects.ts#EFFECT_HANDLERS > campaignData.ts#documentById > campaignData.ts#maps > store.ts#useGame |
| combatEffects.cloturer | 7 | 1 | - | non | non |  |
| combatEffects.drainPendingLog | 1 | 1 | - | non | non |  |
| combatEffects.gearFromEffects | 1718 | 126 | web/stockageWeb.ts,net/relay.ts,net/session.ts,web/minuteries.ts,net/compress.ts,net/protocol.ts | OUI | OUI | combatEffects.ts#gearFromEffects > campaignData.ts#trappingById > campaignData.ts#maps > store.ts#useGame |
| combatEffects.jouerFlowEntier | 1 | 1 | - | non | non |  |
| combatEffects.nePeutPasDifferer | 2 | 1 | - | non | non |  |
| combatEffects.OPS_DIFFEREES | 1 | 1 | - | non | non |  |
| combatEffects.ouvrirChute | 2 | 1 | - | non | non |  |
| combatEffects.pushCombatStep | 1 | 1 | - | non | non |  |
| combatEffects.pushReveal | 5 | 2 | - | non | non |  |
| combatEffects.registerCloture | 2 | 1 | - | non | non |  |
| combatEffects.revealPurpose | 1 | 1 | - | non | non |  |
| combatEvents.emitCombatEvent | 3 | 2 | - | non | non |  |
| combatManeuvers.availableFreeAttackOps | 1 | 1 | - | non | non |  |
| combatManeuvers.bestDefenseMode | 1 | 1 | - | non | non |  |
| combatManeuvers.freeAttackTargetOk | 2 | 1 | - | non | non |  |
| combatManeuvers.hasFreeWeaponAttack | 2 | 1 | - | non | non |  |
| combatOrParty.touchActors | 1 | 1 | - | non | non |  |
| combatPlacement.applyZoneCrossings | 5 | 2 | - | non | non |  |
| combatPlacement.displaceSmaller | 2 | 1 | - | non | non |  |
| commandTeam.teamCommandMod | 4 | 1 | - | non | non |  |
| consumableFlow.runConsumable | 1718 | 126 | web/stockageWeb.ts,net/relay.ts,net/session.ts,web/minuteries.ts,net/compress.ts,net/protocol.ts | OUI | OUI | consumableFlow.ts#runConsumable > consumableFlow.ts#runSceneConsumableFlow > combatEffects.ts#runFlow > combatEffects.ts#EFFECT_HANDLERS > campaignData.ts#documentById > campaignData.ts#maps > store.ts#useGame |
| corruptionFlow.gainCorruption | 7 | 1 | - | non | non |  |
| massBattleFlow.massBattleTrackHit | 1 | 1 | - | non | non |  |
| mount.attackGeomOf | 5 | 2 | - | non | non |  |
| mount.chargeDmgProxy | 1 | 1 | - | non | non |  |
| mount.combatGeomOf | 5 | 2 | - | non | non |  |
| mount.meleeWeaponInRange | 7 | 2 | - | non | non |  |
| mount.mountedAttackMods | 2 | 1 | - | non | non |  |
| mount.mountedDodgeMods | 2 | 1 | - | non | non |  |
| mount.mountMovement | 2 | 1 | - | non | non |  |
| mount.mountOf | 1 | 1 | - | non | non |  |
| mount.pickAttackWeaponList | 9 | 2 | - | non | non |  |
| mount.sweepDismountDeaths | 5 | 1 | - | non | non |  |
| netOwnership.aiDriven | 3 | 1 | - | non | non |  |
| netOwnership.defenseSurfaced | 1 | 1 | - | non | non |  |
| rollFlowFactory.deDuJet | 1 | 1 | - | non | non |  |
| rollFlowFactory.makeRollFlow | 17 | 3 | - | non | non |  |
| shipCrew.endShanty | 1 | 1 | - | non | non |  |
| shipCrew.resolveShipUnits | 1 | 1 | - | non | non |  |
| shipPostes.crewPosteOf | 1 | 1 | - | non | non |  |
| shipPostes.mountedWeaponBears | 4 | 2 | - | non | non |  |
| shipPostes.servingCrewPresent | 1 | 1 | - | non | non |  |
| shipPostes.shipOfCrew | 1 | 1 | - | non | non |  |
| shipwreck.beginShipwreck | 17 | 5 | - | non | non |  |
| spawn.placeCombatant | 2 | 1 | - | non | non |  |
| summonFlow.applySummon | 18 | 2 | - | non | non |  |

## 6. Par module de state (fermeture de FICHIER par imports de valeur — sur-estime —, et union des fermetures de symboles utilisés par l'attaque)

| module | symboles utilisés (attaque+sorts) | fichiers state (imports valeur) | store ? | combatFlow ? | fichiers state (symboles utilisés) | store (symboles) ? | autres zones (symboles) |
|---|---|---|---|---|---|---|---|
| state/combatEffects | OPS_DIFFEREES, applyEffects, cloturer, drainPendingLog, gearFromEffects, jouerFlowEntier, nePeutPasDifferer, ouvrirChute, pushCombatStep, pushReveal, registerCloture, revealPurpose | 130 (+6 autres zones) | OUI (state/combatEffects > state/campaignData > state/store) | OUI | 126 | OUI | web/stockageWeb.ts, net/relay.ts, net/session.ts, web/minuteries.ts, net/compress.ts, net/protocol.ts |
| state/mount | attackGeomOf, chargeDmgProxy, combatGeomOf, meleeWeaponInRange, mountMovement, mountOf, mountedAttackMods, mountedDodgeMods, pickAttackWeaponList, sweepDismountDeaths | 2 | non | non | 2 | non | - |
| state/shipPostes | crewPosteOf, mountedWeaponBears, servingCrewPresent, shipOfCrew | 2 | non | non | 2 | non | - |
| state/combatManeuvers | availableFreeAttackOps, bestDefenseMode, freeAttackTargetOk, hasFreeWeaponAttack | 130 (+6 autres zones) | OUI (state/combatManeuvers > state/combatOrParty > state/targetingModes > state/combatFlow > state/seaVoyageFlow > state/store) | OUI | 1 | non | - |
| state/combat/triggeredTest | bandeTriggeredTest, routeTriggeredTest, runCombatFlow | 130 (+6 autres zones) | OUI (state/combat/triggeredTest > state/combatEffects > state/campaignData > state/store) | OUI | 126 | OUI | web/stockageWeb.ts, net/relay.ts, net/session.ts, web/minuteries.ts, net/compress.ts, net/protocol.ts |
| state/combatArea | areaTargets, blastRadiusTiles, resolveWeaponArea | 3 | non | non | 3 | non | - |
| state/netOwnership | aiDriven, defenseSurfaced | 4 | non | non | 1 | non | - |
| state/bus | EVT, bus | 1 | non | non | 1 | non | - |
| state/combat/hitModifiers | runHitModifiers, toucheSauvee | 3 | non | non | 1 | non | - |
| state/shipCrew | endShanty, resolveShipUnits | 2 | non | non | 1 | non | - |
| state/combatPlacement | applyZoneCrossings, displaceSmaller | 2 | non | non | 2 | non | - |
| state/bourseFlow | condCtx, partyMoneyTotal | 1 | non | non | 1 | non | - |
| state/rollFlowFactory | deDuJet, makeRollFlow | 130 (+6 autres zones) | OUI (state/rollFlowFactory > state/corruptionFlow > state/combatFlow > state/seaVoyageFlow > state/store) | OUI | 3 | non | - |
| state/commandTeam | teamCommandMod | 1 | non | non | 1 | non | - |
| state/combatEvents | emitCombatEvent | 2 | non | non | 2 | non | - |
| state/spawn | placeCombatant | 1 | non | non | 1 | non | - |
| state/massBattleFlow | massBattleTrackHit | 1 | non | non | 1 | non | - |
| state/combatOrParty | touchActors | 130 (+6 autres zones) | OUI (state/combatOrParty > state/targetingModes > state/combatFlow > state/seaVoyageFlow > state/store) | OUI | 1 | non | - |
| state/shipwreck | beginShipwreck | 8 | non | non | 5 | non | - |
| state/corruptionFlow | gainCorruption | 130 (+6 autres zones) | OUI (state/corruptionFlow > state/combatFlow > state/seaVoyageFlow > state/store) | OUI | 1 | non | - |
| state/consumableFlow | runConsumable | 130 (+6 autres zones) | OUI (state/consumableFlow > state/combatFlow > state/seaVoyageFlow > state/store) | OUI | 126 | OUI | web/stockageWeb.ts, net/relay.ts, net/session.ts, web/minuteries.ts, net/compress.ts, net/protocol.ts |
| state/summonFlow | applySummon | 2 | non | non | 2 | non | - |

## 4bis. Hors liste : champs lus/écrits du store, actions de store, variables de module

| fonction | get (appels/champs/passé) | set (appels/clés/passé) | actions de store | variables de module (autres) |
|---|---|---|---|---|
| activeDayWeather | 0/-/1 | 0/-/0 | - | - |
| castContextMods | 0/-/0 | 0/-/0 | - | - |
| activeCombatant | 0/-/0 | 0/-/0 | - | - |
| bestAdjacentReachable | 0/-/0 | 0/-/0 | - | - |
| displayedReach | 1/battle×1/1 | 0/-/0 | - | - |
| releaseSeatsOfDowned | 3/scene×1 party×1 battle×1/0 | 1/scene×1/0 | - | - |
| resolveTriggerImpureOps | 0/-/3 | 0/-/2 | - | - |
| critRollTwiceFor | 0/-/0 | 0/-/0 | - | - |
| jouerLeRebond | 1/battle×1/1 | 0/-/1 | - | - |
| clearActorAim | 1/actorAim×1/0 | 1/actorAim×1/0 | - | - |
| markActed | 2/battle×2/1 | 0/-/1 | - | - |
| GRAPPLE_SOURCE | 0/-/0 | 0/-/0 | - | - |
| useSpellComponent | 0/-/0 | 0/-/0 | - | - |
| applyMiscast | 0/-/2 | 0/-/3 | - | - |
| applyBladeTrap | 1/battle×1/4 | 0/-/5 | - | - |
| runPreemptShots | 5/battle×3 *entier*×1 scene×1/6 | 1/battle×1/5 | - | - |
| aiCreatureFreeAttacks | 6/battle×5 *entier*×1/8 | 2/battle×2/5 | - | - |
| resolveSurrenderThreshold | 0/-/0 | 0/-/0 | - | - |
| openCombatEndCascade | 5/battle×1 *entier*×1 log×1 deferredUpkeepQueue×1 pendingCascade×1/6 | 2/deferredUpkeepQueue×1 pendingCascade×1/5 | log | - |
| finalizeBattle | 5/*entier*×1 log×1 vessel×1 scene×1 possessions×1/3 | 2/party×1 possessions×1/3 | log | - |
| victoryConditionMet | 0/-/0 | 0/-/0 | - | - |
| defenseSubOf | 0/-/0 | 0/-/0 | - | - |
| forcedOpposedAtk | 0/-/0 | 0/-/0 | - | - |
| runCastFlow | 0/-/2 | 0/-/2 | - | - |
| zoneRadiusMeters | 0/-/0 | 0/-/0 | - | - |
| castNearCorruption | 3/flags×1 battle×1 party×1/0 | 0/-/0 | - | - |
| appliquerTouchePourCible | 1/*entier*×1/3 | 0/-/1 | - | - |
| placeSpellZone | 0/-/1 | 0/-/0 | - | - |
| domainBreathType | 0/-/0 | 0/-/0 | - | - |
| applyAreaAttack | 0/-/2 | 0/-/2 | - | - |
| finishPlayerAction | 2/battle×1 *entier*×1/5 | 2/battle×1 ?CallExpression×1/5 | - | - |
| opposedForcedFloor | 0/-/0 | 0/-/0 | - | - |
| sealOutcome | 0/-/0 | 0/-/0 | - | - |
| clearApproachMoves | 0/-/0 | 0/-/0 | - | - |
| opposedForcingCancelled | 0/-/0 | 0/-/0 | - | - |
| testOutcome | 0/-/0 | 0/-/0 | - | - |
| acquireAnimositeOnFate | 0/-/0 | 0/-/0 | - | - |
| resumeEnemyTurn | 1/*entier*×1/3 | 0/-/2 | - | - |
| resolveRoundBoundary | 2/battle×1 pendingCascade×1/5 | 2/pendingFateSave×2/5 | - | - |
| advanceCombatJet | 7/pendingCascade×1 pendingAttack×1 pendingDefense×1 pendingCleave×1 pendingDualStrike×1 *entier*×1 cascadeNext×1/0 | 0/-/0 | cascadeNext | - |
| poserLaFrappeSuivante | 3/pendingCascade×2 cascadeNext×1/1 | 1/pendingAttack×1/1 | cascadeNext | - |
| surLEtapeDeDefense | 0/-/0 | 0/-/0 | - | - |

## 1bis. Unités : actions de store appelées (get().action), variables de module internes

| unité | actions de store | variables de module (combatFlow/specs/slice) |
|---|---|---|
| planifierLesCritiques | recompter, deviable | - |
| appliquerLesCritiques | set, get | - |
| doAttack | log | - |
| applyFreeAttackEffects | log | - |
| FLOWS.attack | cleaveEnd | - |
| slice.handGateConfirm | dualStrikeAttack | - |
| slice.attackRoll | log | - |
| slice.attackConfirm | cascadeNext | - |
| slice.fumbleConfirm | cascadeNext | - |
| slice.defenseConfirm | cascadeNext, attackConfirm | - |

## 7. Externes (hors fichiers combatFlow/rollFlowSpecs/combatSlice et hors zones autorisées) de la FERMETURE TRANSITIVE de l'attaque (301 fonctions, y compris IA/sorts/tour atteints) : 119 symboles

Sur-estimation : la fermeture suit toute référence (appel, passage en argument), y compris vers l'IA, les sorts et la boucle de tour. Colonnes : nombre de fonctions atteintes qui le référencent.

| symbole | module | zone | fonctions référentes | dont direct dans la liste d'attaque |
|---|---|---|---|---|
| bus | state/bus | state | 24 | oui |
| EVT | state/bus | state | 24 | oui |
| OPS_DIFFEREES | state/combatEffects | state | 13 | oui |
| mountMovement | state/mount | state | 9 | oui |
| emitCombatEvent | state/combatEvents | state | 8 | oui |
| bestDefenseMode | state/combatManeuvers | state | 8 | oui |
| aiDriven | state/netOwnership | state | 8 | oui |
| placeCombatant | state/spawn | state | 7 | oui |
| resolveManeuver | state/combatManeuvers | state | 6 | non |
| rollManeuverAttacker | state/combatManeuvers | state | 6 | non |
| deDuJet | state/rollFlowFactory | state | 6 | oui |
| drainPendingLog | state/combatEffects | state | 5 | oui |
| touchActors | state/combatOrParty | state | 5 | oui |
| defenseSurfaced | state/netOwnership | state | 5 | oui |
| runCombatFlow | state/combat/triggeredTest | state | 4 | oui |
| beatHold | state/combatDirector | state | 4 | non |
| jouerFlowEntier | state/combatEffects | state | 4 | oui |
| pushReveal | state/combatEffects | state | 4 | oui |
| combatAdvanceBlocked | state/combatGate | state | 4 | non |
| displaceSmaller | state/combatPlacement | state | 4 | oui |
| chargeDmgProxy | state/mount | state | 4 | oui |
| combatGeomOf | state/mount | state | 4 | oui |
| mountOf | state/mount | state | 4 | oui |
| makeRollFlow | state/rollFlowFactory | state | 4 | oui |
| scheduleCombatTimer | web/minuteries | web | 4 | non |
| applyZoneCrossings | state/combatPlacement | state | 3 | oui |
| attackGeomOf | state/mount | state | 3 | oui |
| chooseEnemyAction | state/ai | state | 2 | non |
| partyMoneyTotal | state/bourseFlow | state | 2 | oui |
| runHitModifiers | state/combat/hitModifiers | state | 2 | oui |
| routeTriggeredTest | state/combat/triggeredTest | state | 2 | oui |
| fireTurnStartTriggers | state/combat/turnHooks | state | 2 | non |
| resolveActGates | state/combat/turnHooks | state | 2 | non |
| resolveWeaponArea | state/combatArea | state | 2 | oui |
| pushCombatStep | state/combatEffects | state | 2 | oui |
| revealPurpose | state/combatEffects | state | 2 | oui |
| distraireAttackValue | state/combatManeuvers | state | 2 | non |
| maneuverAttackerDifficulty | state/combatManeuvers | state | 2 | non |
| gainCorruption | state/corruptionFlow | state | 2 | oui |
| pickAttackWeaponList | state/mount | state | 2 | oui |
| riderFearSize | state/mount | state | 2 | non |
| crewPosteOf | state/shipPostes | state | 2 | oui |
| applySummon | state/summonFlow | state | 2 | oui |
| TEMPO | state/tempo | state | 2 | non |
| consumeAiRanking | state/ai | state | 1 | non |
| condCtx | state/bourseFlow | state | 1 | oui |
| toucheSauvee | state/combat/hitModifiers | state | 1 | oui |
| resolveRecoverTest | state/combat/recover | state | 1 | non |
| collectHeroRoundEndUpkeep | state/combat/roundHooks | state | 1 | non |
| bandeTriggeredTest | state/combat/triggeredTest | state | 1 | oui |
| simpleBatchTestStep | state/combat/triggeredTest | state | 1 | non |
| fireTurnEndTriggers | state/combat/turnHooks | state | 1 | non |
| areaTargets | state/combatArea | state | 1 | oui |
| blastRadiusTiles | state/combatArea | state | 1 | oui |
| afterApproach | state/combatDirector | state | 1 | non |
| approachMs | state/combatDirector | state | 1 | non |
| applyEffects | state/combatEffects | state | 1 | oui |
| cloturer | state/combatEffects | state | 1 | oui |
| gearFromEffects | state/combatEffects | state | 1 | oui |
| nePeutPasDifferer | state/combatEffects | state | 1 | oui |
| ouvrirChute | state/combatEffects | state | 1 | oui |
| registerCloture | state/combatEffects | state | 1 | oui |
| combatEndBands | state/combatEndBands | state | 1 | non |
| availableFreeAttackOps | state/combatManeuvers | state | 1 | oui |
| battementEligible | state/combatManeuvers | state | 1 | non |
| distraireDefenseValue | state/combatManeuvers | state | 1 | non |
| distraireEligible | state/combatManeuvers | state | 1 | non |
| freeAttackCost | state/combatManeuvers | state | 1 | non |
| freeAttackTargetOk | state/combatManeuvers | state | 1 | oui |
| gratuitesRestantes | state/combatManeuvers | state | 1 | non |
| hasFreeWeaponAttack | state/combatManeuvers | state | 1 | oui |
| MELEE_MANEUVER_KINDS | state/combatManeuvers | state | 1 | non |
| resolveBattement | state/combatManeuvers | state | 1 | non |
| resolveDistraire | state/combatManeuvers | state | 1 | non |
| seaMagicContext | state/combatOrParty | state | 1 | non |
| windsMagicModOf | state/combatOrParty | state | 1 | non |
| removeEntities | state/combatPlacement | state | 1 | non |
| combatOrder | state/combatSetup | state | 1 | non |
| rollInitiative | state/combatSetup | state | 1 | non |
| teamCommandMod | state/commandTeam | state | 1 | oui |
| runConsumable | state/consumableFlow | state | 1 | oui |
| testDExposition | state/corruptionFlow | state | 1 | non |
| metresRetenus | state/fallMove | state | 1 | non |
| phaseDeChute | state/fallMove | state | 1 | non |
| headingToBear | state/fireArc | state | 1 | non |
| targetArc | state/fireArc | state | 1 | non |
| describeBargain | state/flowOutcomes | state | 1 | non |
| describeFrenzy | state/flowOutcomes | state | 1 | non |
| describeReload | state/flowOutcomes | state | 1 | non |
| describeStateRecovery | state/flowOutcomes | state | 1 | non |
| describeTest | state/flowOutcomes | state | 1 | non |
| massBattleTrackHit | state/massBattleFlow | state | 1 | oui |
| canMove | state/mount | state | 1 | non |
| meleeWeaponInRange | state/mount | state | 1 | oui |
| mountableNear | state/mount | state | 1 | non |
| mountedAttackMods | state/mount | state | 1 | oui |
| mountedDodgeMods | state/mount | state | 1 | oui |
| mountUp | state/mount | state | 1 | non |
| movementRemaining | state/mount | state | 1 | non |
| sweepDismountDeaths | state/mount | state | 1 | oui |
| controlsCombatant | state/netOwnership | state | 1 | non |
| nightBands | state/nightBands | state | 1 | non |
| splitBandRows | state/nightBands | state | 1 | non |
| setVesselHull | state/seaVoyageFlow | state | 1 | non |
| bearingPostes | state/shipBattery | state | 1 | non |
| mostArmedSide | state/shipBattery | state | 1 | non |
| endShanty | state/shipCrew | state | 1 | oui |
| resolveShipUnits | state/shipCrew | state | 1 | oui |
| forceCrewRole | state/shipManeuver | state | 1 | non |
| maneuverShip | state/shipManeuver | state | 1 | non |
| rollCrewRole | state/shipManeuver | state | 1 | non |
| mountedWeaponBears | state/shipPostes | state | 1 | oui |
| servablePostes | state/shipPostes | state | 1 | non |
| serveAtPoste | state/shipPostes | state | 1 | non |
| servingCrewPresent | state/shipPostes | state | 1 | oui |
| shipOfCrew | state/shipPostes | state | 1 | oui |
| beginShipwreck | state/shipwreck | state | 1 | oui |
| coupFerme | state/targetingHolder | state | 1 | non |
| perceivedTiles | state/visionState | state | 1 | non |

## 5bis. Taille (lignes) des déclarations atteintes par symbole externe, quand la fermeture n'atteint pas store.ts

| symbole | décl. atteintes (≤12 listées) | lignes cumulées |
|---|---|---|
| bourseFlow.condCtx | bourseFlow.ts#condCtx, bourseFlow.ts#partyMoneyTotal, bourseFlow.ts#ZERO_MONEY | 7 |
| bourseFlow.partyMoneyTotal | bourseFlow.ts#partyMoneyTotal, bourseFlow.ts#ZERO_MONEY | 4 |
| bus.bus | bus.ts#bus, bus.ts#EventBus | 15 |
| bus.EVT | bus.ts#EVT | 37 |
| combat/hitModifiers.runHitModifiers | combat/hitModifiers.ts#runHitModifiers, combat/hitModifiers.ts#MODIFIERS | 11 |
| combat/hitModifiers.toucheSauvee | combat/hitModifiers.ts#toucheSauvee | 3 |
| combatArea.areaTargets | combatArea.ts#areaTargets, combatArea.ts#metresToTiles | 15 |
| combatArea.blastRadiusTiles | combatArea.ts#blastRadiusTiles, combatArea.ts#weaponAreaIndice, combatArea.ts#metresToTiles | 12 |
| combatArea.resolveWeaponArea | combatArea.ts#resolveWeaponArea, combatArea.ts#hitSecondary, combatEvents.ts#emitCombatEvent, combatHooks.ts#runCombatHooks, combatHooks.ts#HOOKS | 71 |
| combatEffects.cloturer | combatEffects.ts#cloturer, combatEffects.ts#OPS_DIFFEREES, combatEffects.ts#confierLaSuite, combatEffects.ts#jouerLesClotures, combatEffects.ts#indexDeLEtapeQuiAttend, combatEffects.ts#clotureAppliers, combatEffects.ts#comptePasDifferes | 59 |
| combatEffects.drainPendingLog | combatEffects.ts#drainPendingLog | 6 |
| combatEffects.jouerFlowEntier | combatEffects.ts#jouerFlowEntier | 3 |
| combatEffects.nePeutPasDifferer | combatEffects.ts#nePeutPasDifferer, combatEffects.ts#OPS_DIFFEREES | 7 |
| combatEffects.OPS_DIFFEREES | combatEffects.ts#OPS_DIFFEREES | 1 |
| combatEffects.ouvrirChute | combatEffects.ts#ouvrirChute, combatEffects.ts#revealPurpose | 13 |
| combatEffects.pushCombatStep | combatEffects.ts#pushCombatStep | 3 |
| combatEffects.pushReveal | combatEffects.ts#pushReveal, revealStep.ts#revealToStep, combatEffects.ts#revealPurpose, revealStep.ts#REVEAL_ICON, revealStep.ts#REVEAL_AUTO_CLOSE_MS | 36 |
| combatEffects.registerCloture | combatEffects.ts#registerCloture, combatEffects.ts#clotureAppliers | 4 |
| combatEffects.revealPurpose | combatEffects.ts#revealPurpose | 2 |
| combatEvents.emitCombatEvent | combatEvents.ts#emitCombatEvent, combatHooks.ts#runCombatHooks, combatHooks.ts#HOOKS | 17 |
| combatManeuvers.availableFreeAttackOps | combatManeuvers.ts#availableFreeAttackOps | 12 |
| combatManeuvers.bestDefenseMode | combatManeuvers.ts#bestDefenseMode | 4 |
| combatManeuvers.freeAttackTargetOk | combatManeuvers.ts#freeAttackTargetOk, combatManeuvers.ts#cibleDEcartDeTaille | 16 |
| combatManeuvers.hasFreeWeaponAttack | combatManeuvers.ts#hasFreeWeaponAttack, combatManeuvers.ts#availableFreeAttackOps | 16 |
| combatOrParty.touchActors | combatOrParty.ts#touchActors | 3 |
| combatPlacement.applyZoneCrossings | combatPlacement.ts#applyZoneCrossings, bus.ts#bus, bus.ts#EVT, combatPlacement.ts#zoneCrossTestHook, bus.ts#EventBus | 74 |
| combatPlacement.displaceSmaller | combatPlacement.ts#displaceSmaller, combatPlacement.ts#nearestFreeOutside | 23 |
| commandTeam.teamCommandMod | commandTeam.ts#teamCommandMod, commandTeam.ts#effectiveCommander, commandTeam.ts#withinVoice, commandTeam.ts#voiceCommandRangeM | 22 |
| corruptionFlow.gainCorruption | corruptionFlow.ts#gainCorruption, corruptionFlow.ts#poseCorruptionPending, corruptionFlow.ts#applyMutation, corruptionFlow.ts#natureStep, corruptionFlow.ts#mutationPurpose, corruptionFlow.ts#mutationNatureTableId, corruptionFlow.ts#NATURE_TABLE_PREFIX | 73 |
| massBattleFlow.massBattleTrackHit | massBattleFlow.ts#massBattleTrackHit | 8 |
| mount.attackGeomOf | mount.ts#attackGeomOf, mount.ts#attackGeomOfList, siegePush.ts#isMeleeWarMachine, siegePush.ts#meleeWarMachineHullOf, siegePush.ts#posteHullOf | 27 |
| mount.chargeDmgProxy | mount.ts#chargeDmgProxy | 4 |
| mount.combatGeomOf | mount.ts#combatGeomOf, mount.ts#combatGeomOfList, siegePush.ts#meleeWarMachineHullOf, siegePush.ts#isMeleeWarMachine, siegePush.ts#posteHullOf | 19 |
| mount.meleeWeaponInRange | mount.ts#meleeWeaponInRange, mount.ts#meleeWeaponInRangeList, mount.ts#combatGeomOfList, mount.ts#attackGeomOfList, siegePush.ts#meleeWarMachineHullOf, siegePush.ts#isMeleeWarMachine, siegePush.ts#posteHullOf | 35 |
| mount.mountedAttackMods | mount.ts#mountedAttackMods, mount.ts#mountOf | 11 |
| mount.mountedDodgeMods | mount.ts#mountedDodgeMods, mount.ts#hasAcrobatiesEquestres | 5 |
| mount.mountMovement | mount.ts#mountMovement, mount.ts#mountOf | 6 |
| mount.mountOf | mount.ts#mountOf | 2 |
| mount.pickAttackWeaponList | mount.ts#pickAttackWeaponList, mount.ts#ARME_INTROUVABLE, mount.ts#personalWeaponsOf, mount.ts#meleeWeaponInRangeList, mount.ts#combatGeomOfList, mount.ts#attackGeomOfList, siegePush.ts#meleeWarMachineHullOf, siegePush.ts#isMeleeWarMachine, siegePush.ts#posteHullOf | 55 |
| mount.sweepDismountDeaths | mount.ts#sweepDismountDeaths, mount.ts#handleMountDeath, mount.ts#riderOf, mount.ts#nearestFreeFoot, mount.ts#tileToFootprint | 44 |
| netOwnership.aiDriven | netOwnership.ts#aiDriven, netOwnership.ts#ownsLocal, netOwnership.ts#actingSeat | 15 |
| netOwnership.defenseSurfaced | netOwnership.ts#defenseSurfaced | 3 |
| rollFlowFactory.deDuJet | rollFlowFactory.ts#deDuJet | 3 |
| rollFlowFactory.makeRollFlow | 17 décl. | 431 |
| shipCrew.endShanty | shipCrew.ts#endShanty | 9 |
| shipCrew.resolveShipUnits | shipCrew.ts#resolveShipUnits | 23 |
| shipPostes.crewPosteOf | shipPostes.ts#crewPosteOf | 7 |
| shipPostes.mountedWeaponBears | shipPostes.ts#mountedWeaponBears, fireArc.ts#inFireArc, fireArc.ts#targetArc, fireArc.ts#relativeOctant | 22 |
| shipPostes.servingCrewPresent | shipPostes.ts#servingCrewPresent | 14 |
| shipPostes.shipOfCrew | shipPostes.ts#shipOfCrew | 3 |
| shipwreck.beginShipwreck | 17 décl. | 177 |
| spawn.placeCombatant | spawn.ts#placeCombatant, spawn.ts#tileAt2 | 14 |
| summonFlow.applySummon | 18 décl. | 382 |

## 8. Unités des sorts partageant le coup (applyCast, Projectile 5903-6033, 2401-2452 compterLesCritiquesDuProjectile…)

| unité | lignes | dépendances hors zones | internes appelés dans la liste | hors liste | get (champs) | set (clés) |
|---|---|---|---|---|---|---|
| compterLesCritiquesDuProjectile [attaque+sorts] | 2401-2415 | - | causeDuProjectile | - | - (0) | - (0) |
| libelleDuCoup [attaque+sorts] | 2435-2438 | - | - | - | - (0) | - (0) |
| clore [sorts] | 5903-5907 | bus.{EVT,bus} | - | - | battle×1 (1) | - (0) |
| causeDuProjectile [sorts] | 5910-5910 | - | - | - | - (0) | - (0) |
| appliquerToucheDeProjectile [sorts] | 5929-6026 | combat/hitModifiers.{runHitModifiers} ; corruptionFlow.{gainCorruption} | checkFocusInterruption*, pousserSauvegarde*, clore, planifierLesCritiques*, compterLesCritiquesDuProjectile, appliquerLesCritiques*, apresLeCritiqueDe* | critRollTwiceFor, runCastFlow | gameTime×3 *entier*×2 (5) | - (0) |
| localisationRelanceeDuProjectile [sorts] | 6030-6033 | - | causeDuProjectile | - | - (0) | - (0) |
| applyCast [sorts] | 6115-6509 | bus.{EVT,bus} ; combatEvents.{emitCombatEvent} ; combatPlacement.{applyZoneCrossings} ; consumableFlow.{runConsumable} ; corruptionFlow.{gainCorruption} ; spawn.{placeCombatant} ; summonFlow.{applySummon} | - | zoneRadiusMeters, useSpellComponent, castNearCorruption, applyMiscast, appliquerTouchePourCible, jouerLeRebond, placeSpellZone, runCastFlow, domainBreathType, applyAreaAttack, finishPlayerAction | gameTime×6 battle×4 scene×3 (13) | facing×2 battle×1 (3) |

(`*` = unité du chemin d'attaque, partagée avec les sorts.)

Symboles externes communs attaque/sorts : bus, EVT, runHitModifiers, emitCombatEvent, placeCombatant, applyZoneCrossings.
Unités d'attaque appelées par les sorts : checkFocusInterruption, pousserSauvegarde, planifierLesCritiques, appliquerLesCritiques, apresLeCritiqueDe.
Fermeture dans la liste de ce que les sorts appellent côté coup : 30 unités : causeDuProjectile, apresLeCritiqueDe, appliquerLesCritiques, applyCritAndFinalize, finalizeHeroDeath, applyCriticalToTarget, resolveCritSeverity, critSeverityDecl, CRIT_TABLE_IDS, critSeverityInSeam, applyHullCriticalToTarget, naissanceDuCoupDuMarin, localisationRelanceeDuProjectile, encaisserLeCoupDuMarin, encaisserLeCoup, cloreLeCoup, resolveFirstBlood, planifierLesCritiques, libelleDuCoup, previewCritEntry, pushDeviationStep, compterLesCritiquesDuProjectile, applyStructureCriticalToTarget, STRUCTURE_CRIT_TABLE, deflectCrit, autoDeviate, breakBacleArmour, clore, pousserSauvegarde, checkFocusInterruption.
Sur 156 unités d'attaque, 27 sont atteintes par les sorts.

## 9. Clôture de combat : checkBattleOver / finishVictory / finishCombatEnd et leurs appelés hors liste (combatFlow)

| fonction | lignes | get (appels/champs) | set (clés) | actions de store | externes hors zones | internes autres (hors famille) |
|---|---|---|---|---|---|---|
| checkBattleOver | 7133-7223 | 9/battle×5 pendingCascade×2 scene×1 vessel×1/pass 8 | 5/battle×5/pass 8 | - | bus.{EVT,bus} ; mount.{sweepDismountDeaths} ; shipCrew.{resolveShipUnits} ; shipwreck.{beginShipwreck} | collapseStructure,resolveSurrenderThreshold,openCombatEndCascade,finalizeBattle,victoryConditionMet,finishVictory |
| finishVictory | 7231-7275 | 4/battle×3 party×1/pass 5 | 1/battle×1/pass 3 | - | bourseFlow.{condCtx,partyMoneyTotal} ; bus.{EVT,bus} ; combatEffects.{applyEffects,cloturer,gearFromEffects} | finalizeBattle |
| finishCombatEnd | 7289-7298 | 4/battle×3 combatCursor×1/pass 2 | 2/combatCursor×1 battle×1/pass 2 | - | - | finishVictory,finalizeBattle |
| resolveFirstBlood | 7124-7131 | 0/-/pass 0 | 0/-/pass 0 | - | - | - |
| collapseStructure | 2045-2086 | 3/battle×2 *entier*×1/pass 0 | 1/scene×1 battle×1/pass 1 | - | bus.{EVT,bus} ; combatEffects.{ouvrirChute} ; spawn.{placeCombatant} | - |
| resolveSurrenderThreshold | 7108-7116 | 0/-/pass 0 | 0/-/pass 0 | - | - | - |
| openCombatEndCascade | 6810-6885 | 5/battle×1 *entier*×1 log×1 deferredUpkeepQueue×1 pendingCascade×1/pass 6 | 2/deferredUpkeepQueue×1 pendingCascade×1/pass 5 | log | combat/triggeredTest.{routeTriggeredTest} ; combatEffects.{drainPendingLog} ; combatEndBands.{combatEndBands} ; corruptionFlow.{testDExposition} ; nightBands.{nightBands} | worstCorruptionExposure,decideCombatEndHeroTests,combatEndResistVal,routeBandByPilot |
| finalizeBattle | 7014-7071 | 5/*entier*×1 log×1 vessel×1 scene×1 possessions×1/pass 3 | 2/party×1 possessions×1/pass 3 | log | combatEvents.{emitCombatEvent} ; combatPlacement.{removeEntities} ; seaVoyageFlow.{setVesselHull} | - |
| victoryConditionMet | 7076-7101 | 0/-/pass 0 | 0/-/pass 0 | - | - | - |

## 10. Fermetures lourdes : déclarations qui référencent DIRECTEMENT une valeur de store.ts (points d'entrée du store)

### combatEffects.ts#applyEffects : 1718 décl., 132 fichiers ; 16 déclarations touchent store.ts directement

- campaignData.ts#maps -> useGame
- store.ts#useGame -> applyLoadedSave,registerScene,sceneRegistry,arriveeOccupee,tombantsDe,settleFall,placesDe,seLeverDe,sasseoirA,JOUER_CAPACITE,applyDialogueTransition
- netFlow.ts#netHostStart -> useGame
- netFlow.ts#netJoin -> registerScene
- netFlow.ts#applyNetSnapshot -> useGame,reposerPaquetDeCampagne
- store.ts#applyLoadedSave -> useGame,reposerPaquetDeCampagne
- store.ts#registerScene -> sceneRegistry
- store.ts#settleFall -> soldeDeLAction
- store.ts#seLeverDe -> placesDe
- store.ts#sasseoirA -> placesDe
- netFlow.ts#netSnapshot -> useGame
- netFlow.ts#interceptGuestActions -> useGame
- store.ts#reposerPaquetDeCampagne -> registerScene
- netFlow.ts#restoreGuestActions -> useGame
- netFlow.ts#emettreIntentInvite -> useGame
- seaVoyageFlow.ts#openGenericBoarding -> registerScene

Fichiers (décl. atteintes) : state/combatFlow.ts:265, state/seaVoyageFlow.ts:92, state/merchantFlow.ts:58, state/massBattleFlow.ts:49, state/sceneEdit.ts:49, state/combatEffects.ts:46, state/rollFlowSpecs.ts:43, state/combatManeuvers.ts:42, state/travelFlow.ts:40, state/partyFlow.ts:38, state/targetingModes.ts:36, state/interludeFlow.ts:34, state/netOwnership.ts:33, state/mount.ts:33, state/combat/triggeredTest.ts:30, state/netFlow.ts:29, state/riverVoyageFlow.ts:29, state/shipCrew.ts:27, state/restFlow.ts:26, state/aiSpellValue.ts:25, state/sequenceCore.ts:20, state/shipPostes.ts:18, state/vision.ts:18, state/spawn.ts:17, state/combatSlice.ts:17, state/saves.ts:16, state/carriers.ts:16, state/portFlow.ts:16, state/store.ts:14, state/ai.ts:14, state/bourseFlow.ts:13, state/corruptionFlow.ts:13, state/landMarketFlow.ts:13, net/relay.ts:13, state/tavernFlow.ts:12, state/medicFlow.ts:12, state/shipManeuver.ts:12, state/campaignData.ts:11, state/possessionsFlow.ts:11, state/gesteDArete.ts:11, state/seaActivities.ts:11, state/modalArbiter.ts:11, state/mapSpec.ts:11, state/planDefects.ts:11, state/stageYaw.ts:10, state/asciiMap.ts:10, state/decouvertePorteSecrete.ts:9, state/siegePush.ts:9, state/combatAuto.ts:9, state/rollFlowFactory.ts:9, state/sceneNpc.ts:8, state/visionState.ts:8, state/fallMove.ts:8, state/combatCursor.ts:8, state/intents.ts:8, state/combatPlacement.ts:7, state/nightBands.ts:7, state/rooms.ts:7, state/billetFlow.ts:7, state/localIntent.ts:7, state/commandTeam.ts:7, state/stairFlight.ts:7, state/worldMap.ts:6, state/favorFlow.ts:6, state/combatArea.ts:6, state/flowOutcomes.ts:6, state/shipwreck.ts:6, state/combatEndBands.ts:6, state/clues.ts:5, state/encounterPsychFlow.ts:5, state/pursuitFlow.ts:5, state/stagePan.ts:5, state/exploreNav.ts:5, state/consumableFlow.ts:5, state/targeting.ts:5, state/flowVerbs.ts:5, web/minuteries.ts:5, state/roster.ts:5, net/compress.ts:5, state/dialogue.ts:4, state/combatOrParty.ts:4, state/stateFields.ts:4, state/etalLotFlow.ts:4, state/upkeep.ts:4, state/sequenceContract.ts:4, state/fireArc.ts:4, state/stageWalk.ts:4, state/combat/turnHooks.ts:4, state/combatDirector.ts:4, state/combat/roundHooks.ts:4, state/chapitreRecap.ts:3, state/bus.ts:3, state/revealStep.ts:3, state/embrigadementFlow.ts:3, state/keybindingsPrefs.ts:3, state/sceneInstance.ts:3, state/outOfCombatUpkeep.ts:3, state/innFlow.ts:3, state/shipBattery.ts:3, state/carrier.ts:3, state/etalLot.ts:3, state/summonFlow.ts:3, net/protocol.ts:3, state/combat/hitModifiers.ts:3, state/refusVisible.ts:2, state/shipCollision.ts:2, state/dialogueHistory.ts:2, state/combatSetup.ts:2, web/stockageWeb.ts:2, state/activityWorldRolls.ts:2, net/session.ts:2, state/formats.generated.ts:2, state/targetingHolder.ts:2, state/combatHooks.ts:2, state/authorPerils.ts:2, state/shipDamage.ts:2, state/buildings.ts:2, state/stageGestes.ts:1, state/campaignNarratif.ts:1, state/climbMove.ts:1, state/identites.ts:1, state/endTurnGuard.ts:1, state/combat/recover.ts:1, state/combatEvents.ts:1, state/merchants/index.ts:1, state/clockHooks.ts:1, state/combatGate.ts:1, state/tempo.ts:1, state/activityIssue.ts:1, state/encounterAuthoring.ts:1, state/entityId.ts:1, state/siegeEmplacement.ts:1

### combatEffects.ts#gearFromEffects : 1718 décl., 132 fichiers ; 16 déclarations touchent store.ts directement

- campaignData.ts#maps -> useGame
- store.ts#useGame -> applyLoadedSave,registerScene,sceneRegistry,arriveeOccupee,tombantsDe,settleFall,placesDe,seLeverDe,sasseoirA,JOUER_CAPACITE,applyDialogueTransition
- netFlow.ts#netHostStart -> useGame
- netFlow.ts#netJoin -> registerScene
- netFlow.ts#applyNetSnapshot -> useGame,reposerPaquetDeCampagne
- store.ts#applyLoadedSave -> useGame,reposerPaquetDeCampagne
- store.ts#registerScene -> sceneRegistry
- store.ts#settleFall -> soldeDeLAction
- store.ts#seLeverDe -> placesDe
- store.ts#sasseoirA -> placesDe
- netFlow.ts#netSnapshot -> useGame
- netFlow.ts#interceptGuestActions -> useGame
- store.ts#reposerPaquetDeCampagne -> registerScene
- netFlow.ts#restoreGuestActions -> useGame
- netFlow.ts#emettreIntentInvite -> useGame
- seaVoyageFlow.ts#openGenericBoarding -> registerScene

Fichiers (décl. atteintes) : state/combatFlow.ts:265, state/seaVoyageFlow.ts:92, state/merchantFlow.ts:58, state/massBattleFlow.ts:49, state/sceneEdit.ts:49, state/combatEffects.ts:46, state/rollFlowSpecs.ts:43, state/combatManeuvers.ts:42, state/travelFlow.ts:40, state/partyFlow.ts:38, state/targetingModes.ts:36, state/interludeFlow.ts:34, state/netOwnership.ts:33, state/mount.ts:33, state/combat/triggeredTest.ts:30, state/netFlow.ts:29, state/riverVoyageFlow.ts:29, state/shipCrew.ts:27, state/restFlow.ts:26, state/aiSpellValue.ts:25, state/sequenceCore.ts:20, state/shipPostes.ts:18, state/vision.ts:18, state/combatSlice.ts:17, state/spawn.ts:17, state/saves.ts:16, state/carriers.ts:16, state/portFlow.ts:16, state/store.ts:14, state/ai.ts:14, state/corruptionFlow.ts:13, state/bourseFlow.ts:13, state/landMarketFlow.ts:13, net/relay.ts:13, state/tavernFlow.ts:12, state/medicFlow.ts:12, state/shipManeuver.ts:12, state/campaignData.ts:11, state/possessionsFlow.ts:11, state/gesteDArete.ts:11, state/seaActivities.ts:11, state/modalArbiter.ts:11, state/mapSpec.ts:11, state/planDefects.ts:11, state/stageYaw.ts:10, state/asciiMap.ts:10, state/decouvertePorteSecrete.ts:9, state/siegePush.ts:9, state/combatAuto.ts:9, state/rollFlowFactory.ts:9, state/visionState.ts:8, state/fallMove.ts:8, state/sceneNpc.ts:8, state/combatCursor.ts:8, state/intents.ts:8, state/rooms.ts:7, state/nightBands.ts:7, state/billetFlow.ts:7, state/combatPlacement.ts:7, state/localIntent.ts:7, state/commandTeam.ts:7, state/stairFlight.ts:7, state/worldMap.ts:6, state/favorFlow.ts:6, state/combatArea.ts:6, state/flowOutcomes.ts:6, state/shipwreck.ts:6, state/combatEndBands.ts:6, state/stagePan.ts:5, state/clues.ts:5, state/exploreNav.ts:5, state/encounterPsychFlow.ts:5, state/consumableFlow.ts:5, state/targeting.ts:5, state/flowVerbs.ts:5, web/minuteries.ts:5, state/roster.ts:5, state/pursuitFlow.ts:5, net/compress.ts:5, state/stateFields.ts:4, state/combatOrParty.ts:4, state/dialogue.ts:4, state/etalLotFlow.ts:4, state/upkeep.ts:4, state/fireArc.ts:4, state/stageWalk.ts:4, state/sequenceContract.ts:4, state/combat/turnHooks.ts:4, state/combatDirector.ts:4, state/combat/roundHooks.ts:4, state/bus.ts:3, state/keybindingsPrefs.ts:3, state/chapitreRecap.ts:3, state/sceneInstance.ts:3, state/outOfCombatUpkeep.ts:3, state/innFlow.ts:3, state/shipBattery.ts:3, state/carrier.ts:3, state/revealStep.ts:3, state/etalLot.ts:3, state/summonFlow.ts:3, net/protocol.ts:3, state/combat/hitModifiers.ts:3, state/embrigadementFlow.ts:3, state/shipCollision.ts:2, state/refusVisible.ts:2, state/dialogueHistory.ts:2, state/combatSetup.ts:2, web/stockageWeb.ts:2, state/activityWorldRolls.ts:2, net/session.ts:2, state/formats.generated.ts:2, state/targetingHolder.ts:2, state/combatHooks.ts:2, state/authorPerils.ts:2, state/shipDamage.ts:2, state/buildings.ts:2, state/stageGestes.ts:1, state/campaignNarratif.ts:1, state/climbMove.ts:1, state/identites.ts:1, state/endTurnGuard.ts:1, state/combat/recover.ts:1, state/combatEvents.ts:1, state/merchants/index.ts:1, state/clockHooks.ts:1, state/combatGate.ts:1, state/tempo.ts:1, state/activityIssue.ts:1, state/encounterAuthoring.ts:1, state/entityId.ts:1, state/siegeEmplacement.ts:1

### combat/triggeredTest.ts#routeTriggeredTest : 1718 décl., 132 fichiers ; 16 déclarations touchent store.ts directement

- campaignData.ts#maps -> useGame
- store.ts#useGame -> applyLoadedSave,registerScene,sceneRegistry,arriveeOccupee,tombantsDe,settleFall,placesDe,seLeverDe,sasseoirA,JOUER_CAPACITE,applyDialogueTransition
- netFlow.ts#netHostStart -> useGame
- netFlow.ts#netJoin -> registerScene
- netFlow.ts#applyNetSnapshot -> useGame,reposerPaquetDeCampagne
- store.ts#applyLoadedSave -> useGame,reposerPaquetDeCampagne
- store.ts#registerScene -> sceneRegistry
- store.ts#settleFall -> soldeDeLAction
- store.ts#seLeverDe -> placesDe
- store.ts#sasseoirA -> placesDe
- netFlow.ts#netSnapshot -> useGame
- netFlow.ts#interceptGuestActions -> useGame
- store.ts#reposerPaquetDeCampagne -> registerScene
- netFlow.ts#restoreGuestActions -> useGame
- netFlow.ts#emettreIntentInvite -> useGame
- seaVoyageFlow.ts#openGenericBoarding -> registerScene

Fichiers (décl. atteintes) : state/combatFlow.ts:265, state/seaVoyageFlow.ts:92, state/merchantFlow.ts:58, state/massBattleFlow.ts:49, state/sceneEdit.ts:49, state/combatEffects.ts:46, state/rollFlowSpecs.ts:43, state/combatManeuvers.ts:42, state/travelFlow.ts:40, state/partyFlow.ts:38, state/targetingModes.ts:36, state/interludeFlow.ts:34, state/netOwnership.ts:33, state/mount.ts:33, state/combat/triggeredTest.ts:30, state/netFlow.ts:29, state/riverVoyageFlow.ts:29, state/shipCrew.ts:27, state/restFlow.ts:26, state/aiSpellValue.ts:25, state/sequenceCore.ts:20, state/shipPostes.ts:18, state/vision.ts:18, state/spawn.ts:17, state/combatSlice.ts:17, state/saves.ts:16, state/carriers.ts:16, state/portFlow.ts:16, state/store.ts:14, state/ai.ts:14, state/bourseFlow.ts:13, state/corruptionFlow.ts:13, state/landMarketFlow.ts:13, net/relay.ts:13, state/tavernFlow.ts:12, state/medicFlow.ts:12, state/shipManeuver.ts:12, state/campaignData.ts:11, state/possessionsFlow.ts:11, state/gesteDArete.ts:11, state/seaActivities.ts:11, state/modalArbiter.ts:11, state/mapSpec.ts:11, state/planDefects.ts:11, state/stageYaw.ts:10, state/asciiMap.ts:10, state/decouvertePorteSecrete.ts:9, state/siegePush.ts:9, state/combatAuto.ts:9, state/rollFlowFactory.ts:9, state/sceneNpc.ts:8, state/visionState.ts:8, state/fallMove.ts:8, state/combatCursor.ts:8, state/intents.ts:8, state/combatPlacement.ts:7, state/nightBands.ts:7, state/rooms.ts:7, state/billetFlow.ts:7, state/localIntent.ts:7, state/commandTeam.ts:7, state/stairFlight.ts:7, state/worldMap.ts:6, state/favorFlow.ts:6, state/combatArea.ts:6, state/flowOutcomes.ts:6, state/shipwreck.ts:6, state/combatEndBands.ts:6, state/clues.ts:5, state/encounterPsychFlow.ts:5, state/pursuitFlow.ts:5, state/stagePan.ts:5, state/exploreNav.ts:5, state/consumableFlow.ts:5, state/targeting.ts:5, state/flowVerbs.ts:5, web/minuteries.ts:5, state/roster.ts:5, net/compress.ts:5, state/combatOrParty.ts:4, state/dialogue.ts:4, state/stateFields.ts:4, state/etalLotFlow.ts:4, state/upkeep.ts:4, state/sequenceContract.ts:4, state/fireArc.ts:4, state/stageWalk.ts:4, state/combat/turnHooks.ts:4, state/combatDirector.ts:4, state/combat/roundHooks.ts:4, state/bus.ts:3, state/chapitreRecap.ts:3, state/embrigadementFlow.ts:3, state/revealStep.ts:3, state/keybindingsPrefs.ts:3, state/sceneInstance.ts:3, state/outOfCombatUpkeep.ts:3, state/innFlow.ts:3, state/shipBattery.ts:3, state/carrier.ts:3, state/etalLot.ts:3, state/summonFlow.ts:3, net/protocol.ts:3, state/combat/hitModifiers.ts:3, state/refusVisible.ts:2, state/shipCollision.ts:2, state/dialogueHistory.ts:2, state/combatSetup.ts:2, web/stockageWeb.ts:2, state/activityWorldRolls.ts:2, net/session.ts:2, state/formats.generated.ts:2, state/targetingHolder.ts:2, state/combatHooks.ts:2, state/authorPerils.ts:2, state/shipDamage.ts:2, state/buildings.ts:2, state/stageGestes.ts:1, state/campaignNarratif.ts:1, state/climbMove.ts:1, state/identites.ts:1, state/endTurnGuard.ts:1, state/combat/recover.ts:1, state/combatEvents.ts:1, state/merchants/index.ts:1, state/clockHooks.ts:1, state/combatGate.ts:1, state/tempo.ts:1, state/activityIssue.ts:1, state/encounterAuthoring.ts:1, state/entityId.ts:1, state/siegeEmplacement.ts:1

### combat/triggeredTest.ts#runCombatFlow : 1718 décl., 132 fichiers ; 16 déclarations touchent store.ts directement

- campaignData.ts#maps -> useGame
- store.ts#useGame -> applyLoadedSave,registerScene,sceneRegistry,arriveeOccupee,tombantsDe,settleFall,placesDe,seLeverDe,sasseoirA,JOUER_CAPACITE,applyDialogueTransition
- netFlow.ts#netHostStart -> useGame
- netFlow.ts#netJoin -> registerScene
- netFlow.ts#applyNetSnapshot -> useGame,reposerPaquetDeCampagne
- store.ts#applyLoadedSave -> useGame,reposerPaquetDeCampagne
- store.ts#registerScene -> sceneRegistry
- store.ts#settleFall -> soldeDeLAction
- store.ts#seLeverDe -> placesDe
- store.ts#sasseoirA -> placesDe
- netFlow.ts#netSnapshot -> useGame
- netFlow.ts#interceptGuestActions -> useGame
- store.ts#reposerPaquetDeCampagne -> registerScene
- netFlow.ts#restoreGuestActions -> useGame
- netFlow.ts#emettreIntentInvite -> useGame
- seaVoyageFlow.ts#openGenericBoarding -> registerScene

Fichiers (décl. atteintes) : state/combatFlow.ts:265, state/seaVoyageFlow.ts:92, state/merchantFlow.ts:58, state/massBattleFlow.ts:49, state/sceneEdit.ts:49, state/combatEffects.ts:46, state/rollFlowSpecs.ts:43, state/combatManeuvers.ts:42, state/travelFlow.ts:40, state/partyFlow.ts:38, state/targetingModes.ts:36, state/interludeFlow.ts:34, state/netOwnership.ts:33, state/mount.ts:33, state/combat/triggeredTest.ts:30, state/netFlow.ts:29, state/riverVoyageFlow.ts:29, state/shipCrew.ts:27, state/restFlow.ts:26, state/aiSpellValue.ts:25, state/sequenceCore.ts:20, state/shipPostes.ts:18, state/vision.ts:18, state/spawn.ts:17, state/combatSlice.ts:17, state/saves.ts:16, state/carriers.ts:16, state/portFlow.ts:16, state/store.ts:14, state/ai.ts:14, state/bourseFlow.ts:13, state/corruptionFlow.ts:13, state/landMarketFlow.ts:13, net/relay.ts:13, state/tavernFlow.ts:12, state/medicFlow.ts:12, state/shipManeuver.ts:12, state/campaignData.ts:11, state/possessionsFlow.ts:11, state/gesteDArete.ts:11, state/seaActivities.ts:11, state/modalArbiter.ts:11, state/mapSpec.ts:11, state/planDefects.ts:11, state/stageYaw.ts:10, state/asciiMap.ts:10, state/decouvertePorteSecrete.ts:9, state/siegePush.ts:9, state/combatAuto.ts:9, state/rollFlowFactory.ts:9, state/sceneNpc.ts:8, state/visionState.ts:8, state/fallMove.ts:8, state/combatCursor.ts:8, state/intents.ts:8, state/combatPlacement.ts:7, state/nightBands.ts:7, state/rooms.ts:7, state/billetFlow.ts:7, state/localIntent.ts:7, state/commandTeam.ts:7, state/stairFlight.ts:7, state/worldMap.ts:6, state/favorFlow.ts:6, state/combatArea.ts:6, state/flowOutcomes.ts:6, state/shipwreck.ts:6, state/combatEndBands.ts:6, state/clues.ts:5, state/encounterPsychFlow.ts:5, state/pursuitFlow.ts:5, state/stagePan.ts:5, state/exploreNav.ts:5, state/consumableFlow.ts:5, state/targeting.ts:5, state/flowVerbs.ts:5, web/minuteries.ts:5, state/roster.ts:5, net/compress.ts:5, state/combatOrParty.ts:4, state/dialogue.ts:4, state/stateFields.ts:4, state/etalLotFlow.ts:4, state/upkeep.ts:4, state/sequenceContract.ts:4, state/fireArc.ts:4, state/stageWalk.ts:4, state/combat/turnHooks.ts:4, state/combatDirector.ts:4, state/combat/roundHooks.ts:4, state/bus.ts:3, state/chapitreRecap.ts:3, state/embrigadementFlow.ts:3, state/revealStep.ts:3, state/keybindingsPrefs.ts:3, state/sceneInstance.ts:3, state/outOfCombatUpkeep.ts:3, state/innFlow.ts:3, state/shipBattery.ts:3, state/carrier.ts:3, state/etalLot.ts:3, state/summonFlow.ts:3, net/protocol.ts:3, state/combat/hitModifiers.ts:3, state/refusVisible.ts:2, state/shipCollision.ts:2, state/dialogueHistory.ts:2, state/combatSetup.ts:2, web/stockageWeb.ts:2, state/activityWorldRolls.ts:2, net/session.ts:2, state/formats.generated.ts:2, state/targetingHolder.ts:2, state/combatHooks.ts:2, state/authorPerils.ts:2, state/shipDamage.ts:2, state/buildings.ts:2, state/stageGestes.ts:1, state/campaignNarratif.ts:1, state/climbMove.ts:1, state/identites.ts:1, state/endTurnGuard.ts:1, state/combat/recover.ts:1, state/combatEvents.ts:1, state/merchants/index.ts:1, state/clockHooks.ts:1, state/combatGate.ts:1, state/tempo.ts:1, state/activityIssue.ts:1, state/encounterAuthoring.ts:1, state/entityId.ts:1, state/siegeEmplacement.ts:1

### combat/triggeredTest.ts#bandeTriggeredTest : 1718 décl., 132 fichiers ; 16 déclarations touchent store.ts directement

- campaignData.ts#maps -> useGame
- store.ts#useGame -> applyLoadedSave,registerScene,sceneRegistry,arriveeOccupee,tombantsDe,settleFall,placesDe,seLeverDe,sasseoirA,JOUER_CAPACITE,applyDialogueTransition
- netFlow.ts#netHostStart -> useGame
- netFlow.ts#netJoin -> registerScene
- netFlow.ts#applyNetSnapshot -> useGame,reposerPaquetDeCampagne
- store.ts#applyLoadedSave -> useGame,reposerPaquetDeCampagne
- store.ts#registerScene -> sceneRegistry
- store.ts#settleFall -> soldeDeLAction
- store.ts#seLeverDe -> placesDe
- store.ts#sasseoirA -> placesDe
- netFlow.ts#netSnapshot -> useGame
- netFlow.ts#interceptGuestActions -> useGame
- store.ts#reposerPaquetDeCampagne -> registerScene
- netFlow.ts#restoreGuestActions -> useGame
- netFlow.ts#emettreIntentInvite -> useGame
- seaVoyageFlow.ts#openGenericBoarding -> registerScene

Fichiers (décl. atteintes) : state/combatFlow.ts:265, state/seaVoyageFlow.ts:92, state/merchantFlow.ts:58, state/massBattleFlow.ts:49, state/sceneEdit.ts:49, state/combatEffects.ts:46, state/rollFlowSpecs.ts:43, state/combatManeuvers.ts:42, state/travelFlow.ts:40, state/partyFlow.ts:38, state/targetingModes.ts:36, state/interludeFlow.ts:34, state/netOwnership.ts:33, state/mount.ts:33, state/combat/triggeredTest.ts:30, state/netFlow.ts:29, state/riverVoyageFlow.ts:29, state/shipCrew.ts:27, state/restFlow.ts:26, state/aiSpellValue.ts:25, state/sequenceCore.ts:20, state/shipPostes.ts:18, state/vision.ts:18, state/spawn.ts:17, state/combatSlice.ts:17, state/saves.ts:16, state/carriers.ts:16, state/portFlow.ts:16, state/store.ts:14, state/ai.ts:14, state/bourseFlow.ts:13, state/corruptionFlow.ts:13, state/landMarketFlow.ts:13, net/relay.ts:13, state/tavernFlow.ts:12, state/medicFlow.ts:12, state/shipManeuver.ts:12, state/campaignData.ts:11, state/possessionsFlow.ts:11, state/gesteDArete.ts:11, state/seaActivities.ts:11, state/modalArbiter.ts:11, state/mapSpec.ts:11, state/planDefects.ts:11, state/stageYaw.ts:10, state/asciiMap.ts:10, state/decouvertePorteSecrete.ts:9, state/siegePush.ts:9, state/combatAuto.ts:9, state/rollFlowFactory.ts:9, state/sceneNpc.ts:8, state/visionState.ts:8, state/fallMove.ts:8, state/combatCursor.ts:8, state/intents.ts:8, state/combatPlacement.ts:7, state/nightBands.ts:7, state/rooms.ts:7, state/billetFlow.ts:7, state/localIntent.ts:7, state/commandTeam.ts:7, state/stairFlight.ts:7, state/worldMap.ts:6, state/favorFlow.ts:6, state/combatArea.ts:6, state/flowOutcomes.ts:6, state/shipwreck.ts:6, state/combatEndBands.ts:6, state/clues.ts:5, state/encounterPsychFlow.ts:5, state/pursuitFlow.ts:5, state/stagePan.ts:5, state/exploreNav.ts:5, state/consumableFlow.ts:5, state/targeting.ts:5, state/flowVerbs.ts:5, web/minuteries.ts:5, state/roster.ts:5, net/compress.ts:5, state/combatOrParty.ts:4, state/dialogue.ts:4, state/stateFields.ts:4, state/etalLotFlow.ts:4, state/upkeep.ts:4, state/sequenceContract.ts:4, state/fireArc.ts:4, state/stageWalk.ts:4, state/combat/turnHooks.ts:4, state/combatDirector.ts:4, state/combat/roundHooks.ts:4, state/bus.ts:3, state/chapitreRecap.ts:3, state/embrigadementFlow.ts:3, state/revealStep.ts:3, state/keybindingsPrefs.ts:3, state/sceneInstance.ts:3, state/outOfCombatUpkeep.ts:3, state/innFlow.ts:3, state/shipBattery.ts:3, state/carrier.ts:3, state/etalLot.ts:3, state/summonFlow.ts:3, net/protocol.ts:3, state/combat/hitModifiers.ts:3, state/refusVisible.ts:2, state/shipCollision.ts:2, state/dialogueHistory.ts:2, state/combatSetup.ts:2, web/stockageWeb.ts:2, state/activityWorldRolls.ts:2, net/session.ts:2, state/formats.generated.ts:2, state/targetingHolder.ts:2, state/combatHooks.ts:2, state/authorPerils.ts:2, state/shipDamage.ts:2, state/buildings.ts:2, state/stageGestes.ts:1, state/campaignNarratif.ts:1, state/climbMove.ts:1, state/identites.ts:1, state/endTurnGuard.ts:1, state/combat/recover.ts:1, state/combatEvents.ts:1, state/merchants/index.ts:1, state/clockHooks.ts:1, state/combatGate.ts:1, state/tempo.ts:1, state/activityIssue.ts:1, state/encounterAuthoring.ts:1, state/entityId.ts:1, state/siegeEmplacement.ts:1

### consumableFlow.ts#runConsumable : 1718 décl., 132 fichiers ; 16 déclarations touchent store.ts directement

- campaignData.ts#maps -> useGame
- store.ts#useGame -> applyLoadedSave,registerScene,sceneRegistry,arriveeOccupee,tombantsDe,settleFall,placesDe,seLeverDe,sasseoirA,JOUER_CAPACITE,applyDialogueTransition
- netFlow.ts#netHostStart -> useGame
- netFlow.ts#netJoin -> registerScene
- netFlow.ts#applyNetSnapshot -> useGame,reposerPaquetDeCampagne
- store.ts#applyLoadedSave -> useGame,reposerPaquetDeCampagne
- store.ts#registerScene -> sceneRegistry
- store.ts#settleFall -> soldeDeLAction
- store.ts#seLeverDe -> placesDe
- store.ts#sasseoirA -> placesDe
- netFlow.ts#netSnapshot -> useGame
- netFlow.ts#interceptGuestActions -> useGame
- store.ts#reposerPaquetDeCampagne -> registerScene
- netFlow.ts#restoreGuestActions -> useGame
- netFlow.ts#emettreIntentInvite -> useGame
- seaVoyageFlow.ts#openGenericBoarding -> registerScene

Fichiers (décl. atteintes) : state/combatFlow.ts:265, state/seaVoyageFlow.ts:92, state/merchantFlow.ts:58, state/massBattleFlow.ts:49, state/sceneEdit.ts:49, state/combatEffects.ts:46, state/rollFlowSpecs.ts:43, state/combatManeuvers.ts:42, state/travelFlow.ts:40, state/partyFlow.ts:38, state/targetingModes.ts:36, state/interludeFlow.ts:34, state/netOwnership.ts:33, state/mount.ts:33, state/combat/triggeredTest.ts:30, state/netFlow.ts:29, state/riverVoyageFlow.ts:29, state/shipCrew.ts:27, state/restFlow.ts:26, state/aiSpellValue.ts:25, state/sequenceCore.ts:20, state/shipPostes.ts:18, state/vision.ts:18, state/spawn.ts:17, state/combatSlice.ts:17, state/saves.ts:16, state/carriers.ts:16, state/portFlow.ts:16, state/store.ts:14, state/ai.ts:14, state/corruptionFlow.ts:13, state/bourseFlow.ts:13, state/landMarketFlow.ts:13, net/relay.ts:13, state/tavernFlow.ts:12, state/medicFlow.ts:12, state/shipManeuver.ts:12, state/campaignData.ts:11, state/possessionsFlow.ts:11, state/gesteDArete.ts:11, state/seaActivities.ts:11, state/modalArbiter.ts:11, state/mapSpec.ts:11, state/planDefects.ts:11, state/stageYaw.ts:10, state/asciiMap.ts:10, state/decouvertePorteSecrete.ts:9, state/siegePush.ts:9, state/combatAuto.ts:9, state/rollFlowFactory.ts:9, state/sceneNpc.ts:8, state/visionState.ts:8, state/fallMove.ts:8, state/combatCursor.ts:8, state/intents.ts:8, state/combatPlacement.ts:7, state/nightBands.ts:7, state/rooms.ts:7, state/billetFlow.ts:7, state/localIntent.ts:7, state/commandTeam.ts:7, state/stairFlight.ts:7, state/worldMap.ts:6, state/favorFlow.ts:6, state/combatArea.ts:6, state/flowOutcomes.ts:6, state/shipwreck.ts:6, state/combatEndBands.ts:6, state/consumableFlow.ts:5, state/clues.ts:5, state/encounterPsychFlow.ts:5, state/pursuitFlow.ts:5, state/stagePan.ts:5, state/exploreNav.ts:5, state/targeting.ts:5, state/flowVerbs.ts:5, web/minuteries.ts:5, state/roster.ts:5, net/compress.ts:5, state/combatOrParty.ts:4, state/dialogue.ts:4, state/stateFields.ts:4, state/etalLotFlow.ts:4, state/upkeep.ts:4, state/sequenceContract.ts:4, state/fireArc.ts:4, state/stageWalk.ts:4, state/combat/turnHooks.ts:4, state/combatDirector.ts:4, state/combat/roundHooks.ts:4, state/bus.ts:3, state/chapitreRecap.ts:3, state/embrigadementFlow.ts:3, state/revealStep.ts:3, state/keybindingsPrefs.ts:3, state/sceneInstance.ts:3, state/outOfCombatUpkeep.ts:3, state/innFlow.ts:3, state/shipBattery.ts:3, state/carrier.ts:3, state/etalLot.ts:3, state/summonFlow.ts:3, net/protocol.ts:3, state/combat/hitModifiers.ts:3, state/refusVisible.ts:2, state/shipCollision.ts:2, state/dialogueHistory.ts:2, state/combatSetup.ts:2, web/stockageWeb.ts:2, state/activityWorldRolls.ts:2, net/session.ts:2, state/formats.generated.ts:2, state/targetingHolder.ts:2, state/combatHooks.ts:2, state/authorPerils.ts:2, state/shipDamage.ts:2, state/buildings.ts:2, state/stageGestes.ts:1, state/campaignNarratif.ts:1, state/climbMove.ts:1, state/identites.ts:1, state/endTurnGuard.ts:1, state/combat/recover.ts:1, state/combatEvents.ts:1, state/merchants/index.ts:1, state/clockHooks.ts:1, state/combatGate.ts:1, state/tempo.ts:1, state/activityIssue.ts:1, state/encounterAuthoring.ts:1, state/entityId.ts:1, state/siegeEmplacement.ts:1


## 6bis. Par module : union des déclarations à déplacer (symboles utilisés dont la fermeture n'atteint pas store.ts), lignes cumulées

| module | symboles | décl. (union) | lignes (union) | fichiers touchés par la fermeture |
|---|---|---|---|---|
| state/combatEffects | OPS_DIFFEREES, cloturer, drainPendingLog, jouerFlowEntier, nePeutPasDifferer, ouvrirChute, pushCombatStep, pushReveal, registerCloture, revealPurpose | 18 | 127 | state/combatEffects.ts, state/revealStep.ts |
| state/mount | attackGeomOf, chargeDmgProxy, combatGeomOf, meleeWeaponInRange, mountMovement, mountOf, mountedAttackMods, mountedDodgeMods, pickAttackWeaponList, sweepDismountDeaths | 23 | 129 | state/mount.ts, state/siegePush.ts |
| state/shipPostes | crewPosteOf, mountedWeaponBears, servingCrewPresent, shipOfCrew | 7 | 46 | state/shipPostes.ts, state/fireArc.ts |
| state/combatManeuvers | availableFreeAttackOps, bestDefenseMode, freeAttackTargetOk, hasFreeWeaponAttack | 5 | 36 | state/combatManeuvers.ts |
| state/combatArea | areaTargets, blastRadiusTiles, resolveWeaponArea | 9 | 95 | state/combatArea.ts, state/combatEvents.ts, state/combatHooks.ts |
| state/netOwnership | aiDriven, defenseSurfaced | 4 | 18 | state/netOwnership.ts |
| state/bus | EVT, bus | 3 | 52 | state/bus.ts |
| state/combat/hitModifiers | runHitModifiers, toucheSauvee | 3 | 14 | state/combat/hitModifiers.ts |
| state/shipCrew | endShanty, resolveShipUnits | 2 | 32 | state/shipCrew.ts |
| state/combatPlacement | applyZoneCrossings, displaceSmaller | 7 | 97 | state/combatPlacement.ts, state/bus.ts |
| state/bourseFlow | condCtx, partyMoneyTotal | 3 | 7 | state/bourseFlow.ts |
| state/rollFlowFactory | deDuJet, makeRollFlow | 17 | 431 | state/rollFlowFactory.ts, state/combatOrParty.ts, state/corruptionFlow.ts |
| state/commandTeam | teamCommandMod | 4 | 22 | state/commandTeam.ts |
| state/combatEvents | emitCombatEvent | 3 | 17 | state/combatEvents.ts, state/combatHooks.ts |
| state/spawn | placeCombatant | 2 | 14 | state/spawn.ts |
| state/massBattleFlow | massBattleTrackHit | 1 | 8 | state/massBattleFlow.ts |
| state/combatOrParty | touchActors | 1 | 3 | state/combatOrParty.ts |
| state/shipwreck | beginShipwreck | 17 | 177 | state/shipwreck.ts, state/carriers.ts, state/netOwnership.ts, state/worldMap.ts, state/bourseFlow.ts |
| state/corruptionFlow | gainCorruption | 7 | 73 | state/corruptionFlow.ts |
| state/summonFlow | applySummon | 18 | 382 | state/summonFlow.ts, state/spawn.ts |

Union globale (symboles sans store) : 135 déclarations, 1620 lignes.