# Cartographie pour la vague 3 (#2817), épique #2882

Arbre lu : `/home/user/game/.wt-2888-2b` (HEAD `47ebdef3d`, lots 2b et 2c ; base `65f17802d` = `origin/main`).
Lecture seule. Chemins relatifs à cette racine. Tout nombre vient de `git grep`, de lecture ou d'un
script de fermeture d'imports (scratchpad, `closure.mjs`, imports de VALEUR seulement, types exclus).
`docs/primitives.md` et `docs/index-moteur.md` sont GÉNÉRÉS et absents de ce worktree : lus dans
`/home/user/game/docs/` (daté 15:37 du 2026-10-19, peut diverger de ce HEAD). Les tickets #2817 et
#2763 ont été lus via `gh api`.

## 0. Constats qui nuancent ou contredisent le plan / le ticket

1. **Les tables « de combat » n'ont pas la même résidence.** `registerCombatHook` (`src/state/combatHooks.ts:57`),
   `registerHitModifier` (`src/state/combat/hitModifiers.ts:201`), `registerCloture` (`src/state/combatEffects.ts:734`),
   `registerCastSpellEffect` (`combatEffects.ts:1253`) vivent dans `src/state`, pas dans le noyau. Ce que le
   noyau reçoit de `src/state` est autre : `registerCascadeApplier` & co (`src/noyau/cascade.ts:97,135,150,193,269,274`)
   et quatre variables de module injectées (§2.B). Le plan range les deux familles sous « crochets que le
   combat pose sur le noyau » ; ce sont deux chantiers différents (déménager une table vs fermer un point d'injection).
2. **`registerCombatHook` n'a AUCUNE entrée sur le chemin de l'attaque.** 18 entrées : 15 sur la phase
   `onRoundEnd` (`src/state/combat/roundHooks.ts:53-312`), 3 sur `onTurnStart` (`src/state/combat/turnHooks.ts:262,305,311`).
   Les événements émis par l'attaque (`onHit`, `onWoundLoss`, `onKill`, `onCrit`, `onSlain`, `onAttackResolved`,
   `onStartled`, `onGainCondition`) traversent `runCombatHooks` (`src/state/combatEvents.ts:30`) sans hook ; seul
   `fireTriggers` (données) agit. La table des hooks relève donc de #2889 (entretien de fin de round / début de tour) ;
   l'attaque ne dépend que du DISPATCH.
3. **`registerHitModifier` est partagé avec les sorts** : second appelant de `runHitModifiers` à `combatFlow.ts:5955`
   (`applyCast`, Projectile magique). Idem `planifierLesCritiques` (`combatFlow.ts:2767` mêlée, `:2623` marin, `:5971` Projectile).
   Déplacer ces fonctions engage les sorts.
4. **`routeTriggeredTest` est sur le chemin de l'attaque** : les triggers `onHit`/`onWoundLoss`/`onKill`/… passent par
   `fireTriggers` (noyau) puis `testRouter` (`src/noyau/triggeredEffects.ts:282-283,459`), posé par
   `combatSlice.ts:418` sur `routeTriggeredTest` (`src/state/combat/triggeredTest.ts`, 952 lignes, cadence-aware,
   pousse des étapes de cascade pour les héros manuels). Trois autres hooks y sont lus (`freeAttackHook`,
   `focusInterruptHook`, `bladeTrapHook`, `triggeredTest.ts:104,114,125`, lus `:485-496`). Le ticket n'en parle
   pas ; le plan classe « tests simples » en vague 4. Zone grise entre vagues.
5. **`rule()` (règles maison) n'est pas une entrée mais une variable de module lue DIRECTEMENT par le moteur** :
   `src/engine/policy.ts:92` (`overrides`), lue par 29 fichiers de `src/engine` (`git grep -lE "\brule\(|ruleMode|ruleNum" -- src/engine`).
   Sur le chemin du coup : `engine/combat.ts:622,623,746,1354,1577,1663,1733`, `engine/conditions.ts:961,964,970,1015`,
   `engine/critical.ts:256`, `engine/advantagePool.ts:26`. Donc « règles maison = entrée fournie par l'hôte » demande,
   soit de passer la config en paramètre à ces 29 fichiers, soit de garder un setter de module posé avant l'appel.
   Idem `cadence()` (`engine/cadence.ts:16`) et `desFixes()` (`engine/fixedDie.ts:13`). Aucune lecture d'édition 4e/5e
   sur le chemin (seule occurrence : `src/data/index.ts:2292`, champ de donnée d'un livre).
6. **Valeurs par défaut `defaultRNG` (Math.random) sous les signatures du moteur** : `engine/combat.ts:1066,1081,1095,1106,1142,1343,1456,1487`,
   `engine/critical.ts:198,460`, `engine/conditions.ts:777,925,939`, `engine/ops.ts:141,211,1691`, `engine/tests.ts:130,275`,
   `noyau/triggeredEffects.ts:328,398` (`ctx.rng ?? defaultRNG`), `noyau/rollSeam.ts:1989`, `state/combatEffects.ts:1582`
   (`rng: defaultRNG` en dur). Un hôte qui oublie de passer son RNG obtient silencieusement des dés non seedés.
7. **#2763 n'est écrit nulle part dans le code ni les docs** (seul `docs/plans/2026-10-19-restructuration.md:207` le cite). C'est
   « AttackResult fermé » : sous-issue de #2724, **bloqué par #1858** (ouvert : « File de frappes du tour »). La vague 3
   l'« absorbe » alors qu'il a un bloquant ouvert dont la vague 3 ne dit rien.
8. `combatFlow.ts` fait **8665 lignes** (ticket : 8614). Toutes les lignes du tableau du ticket ont bougé (§6.B).
9. **Le pont `poc/godot` importe `src/state/rollSeam`**, qui n'existe plus à cet emplacement depuis le lot 2b
   (`src/noyau/rollSeam.ts`). Sans objet pour la vague 3 mais le pont n'est pas rebasable tel quel.
10. Le rapport `docs/plans/2026-10-19-modale-attaque-godot.md:55-63` liste **sept morceaux** que le pont refait pour la seule modale
    (aperçu, `defenseDodgeMods`, `rederiveAttack`, `opReroll`, `opBonusSL`, relance par `resolveAttack`, constantes UI). Ils
    sont dans le DoD du ticket (« le pont peut appeler la même fonction ») mais pas dans son tableau de gestes : l'API doit
    couvrir aperçu + jet + influences + application, pas seulement « appliquer ».

---

## 1. Chemin d'une attaque, de bout en bout

Notations : `G` = lit `get()` ; `S` = écrit `set()` ; « mute » = écriture EN PLACE sur un `Combatant` partagé
(`battle.combatants[i]`), puis re-rendu par `touchActors`/`set({battle:{...}})`. Toute la résolution mute les objets
`Combatant` en place (hp `wounds.current`, `advantage`, conditions…) — il n'y a pas de copie d'état.

### 1.A Attaque de mêlée d'un héros piloté à la main (chemin de référence)

| # | Étape | Fonction, fichier:ligne | Lit | Écrit / émet | Attente |
|---|---|---|---|---|---|
| 1 | Clic cible | `battleClickEntity` `src/state/combatSlice.ts:1117` → mode de ciblage `ATTACK_MODE` `src/state/targetingModes.ts:821` → `attackClickCommit` `:498-710` | G `battle`, `scene`, `facing`, `net` (via `controlsCombatant` `netOwnership.ts`), `preemptAiming`; options locales (`chargeArmee`, `src/state/localIntent.ts:93`) | S `battle.preview` (tap 1, aperçu `:586-592`), `pendingMountTarget` (choix cavalier/monture `:599`), mute positions/Avantage/`chargedThisTurn` (charge `:640-652`, mouvement `:660-679`), `bus ANIM_MOVE`, `SCENE_DIRTY` | tap 1 = aperçu, tap 2 = commit (`opts.confirm` court-circuite) |
| 2 | Plan | `attackPlan` `combatFlow.ts:1625` ; gates `firedAttackBlock` `:440`, `heldGroundStanceBlock` `:3791`, `attackWardGate` `:516` | G `battle`, `scene` | refus visible `refuserGeste` | — |
| 3 | Approche puis ouverture | `afterApproach` `src/state/combatDirector.ts:43` → `scheduleCombatTimer` (`src/web/minuteries.ts`) puis `openAttackCascade` `combatFlow.ts:3856` | G `battle`, `pendingCascade` | — | **minuterie réelle** si déplacement (`approachMs` = `walkMs` + `beatHold('afterMove')`) |
| 4 | Gate de main (AA 07) ou étape d'attaque | `attackHandGate` (engine) → `poserLeTestDeMain` `:3870` (pose `pendingHandGate`) ; sinon `poserLEtapeDAttaque` `:3881` → `hostStep`/`openSequence` (`src/noyau/rollSeam.ts:1856,1896`) | G `pendingCascade` | S `pendingAttack`, `pendingCascade` (étape `jet:'attack'`) | **modale** : jet différé du joueur |
| 5 | Réglages avant jet | `attackSetLocation/Weapon/DualMode/HarpoonRopeCut/Withhold/Grapple` `combatSlice.ts:2273-2305` | G `pendingAttack` | S `pendingAttack` | modale |
| 6 | Jet | `attackRoll` `combatSlice.ts:2317` : `applyIncomingMeleeAdvantage` `combatFlow.ts:315` (mute Avantage) puis `resolveAttack` `:813-895` | G `battle`, `scene`, `gameTime`, `net` (`defenseSurfaced` → `jetSurfaced`, `src/noyau/sieges.ts:52`) | `resolveMelee`/`resolveRanged` (engine `combat.ts:1339/1452`) avec `battleRng()` ; S `pendingAttack.result` figé (`weapon`, `distanceTiles`, `dodgeMods`) ; si `null` : `get().log`, `pendingAttack=null`, `advanceCombatJet` | modale : le joueur lance |
| 7 | Influences | usine `makeRollFlow` `src/state/rollFlowFactory.ts:537` + spec `FLOWS.attack` `src/state/rollFlowSpecs.ts:516-638` : `reroll` (re-`resolveAttack`, `:561`), `bonusSL`, `forceSuccess`/`setForcedRoll` (Résilience, `rederiveAttack` `:71`), inversion, dé fixé (`rollFlowFactory.ts:494-514`, `canFixDie` `netOwnership.ts:303`) | G `pendingAttack`, acteur, Fortune/Résilience | S `pendingAttack.result`, mute `fortune` ; `battleRng()` aux relances | modale |
| 8 | Application | `attackConfirm` `combatSlice.ts:2344-2486` : fige le contexte (`pa`, `victimeDuCoup` `combatFlow.ts:344`, `attackWeaponOf` `:331`), `set({pendingAttack:null})`, puis **trois branches** : (a) défense surfacée → `openSurfacedDefense` `:3756` (étape `defense`, curseur avance, retour par `defenseConfirm`) ; (b) Tir rapide `pa.interrupt` ; (c) pilonnage `pa.siege` → `resolveWeaponArea` ; (d) coup normal : prix de déclaration (Frénésie, Tir immobile, deux armes, gratuite), `SuiteDeCoup` déclarée, `jouerFlowEntier(applyAttackResult(...))` | G `battle`, `pendingCleave`, `pendingDualStrike` | S `pendingAttack`, `pendingCleave`, `pendingDualStrike`, `battle` | modale de défense du défenseur si surfacé |
| 9 | Défense surfacée | `surfacedDefensePending` `:3739` (prédicat pur) ; `openSurfacedDefense` `:3756` pose `pendingDefense` (suite `mode:'pilotee'`) ; flux `FLOWS.defense` `rollFlowSpecs.ts:646` (`rollMeleeDefender`, `finishDefenseResult` `:113`, `battleRng()` `:685`) ; `defenseConfirm` `combatSlice.ts:2609-2673` | G `pendingDefense`, `pendingCascade` | S `pendingDefense=null`, `pendingAttack` reposé puis `attackConfirm()` ; ou `applyAttackResult` direct si `suite.mode==='machine'` ; `drainerLesGratuites`, `resumeEnemyTurn` | modale du défenseur |
| 10 | Le coup | `applyAttackResult` `combatFlow.ts:2662` = `appliquerLaTouche` `:2680-3008` + `jouerLApresCoup` `:3009` | voir 1.D | rend `OPS_DIFFEREES` (`combatEffects.ts:389`) si une fenêtre tient la main | fenêtres : sauvegarde, Déviation, Maladresse, dé de casse, défense du maillon suivant |
| 11 | Curseur / clôture de séquence | `advanceCombatJet` `combatSlice.ts:287` → `cascadeNext` `:3400` → `dispatchCascadeDone` `:438-520` (injecté au noyau `:520`) → `checkBattleOver` `combatFlow.ts:7133` / `resumeSuspendedAI` `:7440` | G `pendingCascade`, `battle` | S ; `bus` | — |

### 1.B Attaque à distance (héros)
Même chemin que 1.A jusqu'à `openAttackCascade`. Différences : `firedAttackBlock` (Recharge/munition/arc, `combatFlow.ts:440`) ; `resolveAttack` branche `weapon.type==='ranged'` `:829-881` (tir dans le tas `intoCrowd` `:831-841`, défense RAW auto `bestRangedDefense`/`rangedDefenseModes` `:858-866`, tir dévié sur allié `strayShotVictim` `:497`) ; à l'application : décharge `unloadWeapon`/`spendChamberedRound` `:2894`, `consumeAmmo` `:2901`, `shotsThisTurn`, Salve (`:2952+`), `scatter` des armes de jet `:2945`, nervosité `onStartled` `:2956`, aire `resolveWeaponArea` `:2971` (`src/state/combatArea.ts`). Variantes : Tir rapide `preemptRangedShot` `combatSlice.ts:1761` + `runPreemptShots` `combatFlow.ts:3191` ; pilonnage `siegeAimCommit` `combatSlice.ts:2487` ; bordée `jouerLesTirsDeBordee` `combatFlow.ts:3949`.

### 1.C Attaque d'un combattant conduit par l'IA
`maybeRunEnemyTurn` `combatFlow.ts:7682` → `scheduleCombatTimer(runEnemyAI, beatHold('turnHandoff'))` `:7693` → `runEnemyAI` `:8233` → `attackThenAdvance` `:8352-8384` (pose `actorAim`, `scheduleCombatTimer(...,TEMPO.aimTelegraph)`) → `doAttack` `:3911-3945` : `attackWardGate`, `aiHandGate` `:3897` (Test de Dextérité inline), `maybeOpenDefense` `:3653` (si défenseur surfacé : fige l'attaquant, pose `pendingDefense` suite `mode:'machine'`, ouvre la fenêtre → reprise par `defenseConfirm`) sinon `resolveAttack` puis `applyAttackResult(...)` directement. Puis `drainerLesGratuites` `:4191` ; `scheduleCombatTimer(advanceTurn, beatHold('postAttack'))` `:8382`. Reprise après fenêtre : `resumeEnemyTurn` `:7431` (timer `enemyAdvance`) ou `resumeSuspendedAI` `:7440`. Un héros en Auto-combat suit ce chemin (`aiDriven`, `netOwnership.ts:225`) ou l'automate `combatAuto.ts:37` (`attack: drive ['attackRoll','attackConfirm']`, timers `combatAuto.ts:117,158,161,221,243`).

### 1.D Détail de `appliquerLaTouche` (`combatFlow.ts:2680-3008`), dans l'ordre
- `clearActorAim` (G/S `actorAim`) `:2691`; retire `Surpris` `:2699`.
- `runHitModifiers` (5 modifiers, `hitModifiers.ts`) `:2717` ; une sauvegarde déclarée `pousserSauvegarde` `:2348` (pousse l'étape `sauvegarde`, applier `:2368`, rentrée par `reprendreApresSauvegarde` `:2385`) SUSPEND le coup.
- `coupAApplique` (Empoignade, engine) `:2735`.
- **Mort automatique d'un Inconscient** (option `combat-helpless-mode`) `:2739-2763` : `finalizeHeroDeath` `:1688` (pose `pendingFateSave` si Destin, sinon `dead=true`), levée Engagement/Psychologie `:2747-2750`, `notifySlain` `:1703`, `checkBattleOver`.
- **Fenêtre de Déviation critique** : `planifierLesCritiques` `:2453-2512` (G `tenuParUnHumain`, `regimeDePorteur`, `rule('combat-critical-deflect')` ; pousse `pushDeviationStep` `:2174`, applier `'deviation'` `:4573`, pli `registerCascadeTableFold('deviation')` `:2218`).
- Prix : visée, pénalité de Maladresse, `engage`/`markAttacked`, Avantage de l'attaquant (renversement, `campGain`) `:2790-2810`, Empoignade.
- **Blessures + Mort subite + critiques planifiés** : `encaisserLeCoup` `:2563` → `reinjuryBleed`, `appliquerLesCritiques` `:2514` (Mort subite, **Déviation automatique `autoDeviate` `:2143`**, `deflectCrit` `:2114`, `applyCritAndFinalize` `:2123` → `applyCriticalToTarget` `:1798` (**porteurs** : `structure` → `applyStructureCriticalToTarget` `:1996`, `vehicule-routier` `:1824`, `navire` → `applyHullCriticalToTarget` `:1923`, personnage ; **amputations** `consolidateAmputations` `:1865` ; révélation `pushReveal` ; `routeTriggeredTest`), **Armure Bâclée cassée** `breakBacleArmour` `:2232`, `apresLeCritiqueDe` `:2306` → Frappe blessante + `emitCombatEvent('onCrit')`), puis `cloreLeCoup` `:2583` (**Premier sang** `resolveFirstBlood` `:7124`, 0 PB → À Terre, **levée Engagement/Psychologie** `:2589-2593`).
- **Critiques du Test opposé** `:2821-2855` (`applyOpposedCritical` `:2249` ; piège-lame → étape `bladeTrap` `:2836-2848`).
- Nausée `:2858`; `onWoundLoss` `:2869`, `onKill` `:2876`, `notifySlain` ×2 `:2881`, Taille `:2884`, décharge/munition `:2886-2905`, interruption de rechargement, Avantage défenseur `:2908-2925`, Porte-Bouclier, `bus ANIM_ATTACK` `:2937`, journal `ligneDuCoup`, dispersion `:2945`, `onStartled` `:2956`, `onHit` `:2963`, `massBattleTrackHit` `:2966`, aire `:2971`, `checkFocusInterruption` `:2978`, `onAttackResolved` `:2987`, `fireOwnTestFailed` ×2 `:2992`, `drainPendingLog` `:2994`, **le seul `set({battle:{...battle, acted, log}})` final `:2995`**, `bus SCENE_DIRTY`, `checkBattleOver` `:2997`.
- Après-coup `jouerLApresCoup` `:3009` (temps `APRES_COUP` : `oupsAttaquant` `:3091`, `oupsDefenseur` `:3098`, `reaction` `:3042,3050,3070`, `suite` `jouerLaSuiteDuCoup` `:4107` : manœuvre gratuite, deuxième frappe, `enchainement` hero/chaine/bordee/auto/tirRapide/apresCoup, `maybeHeroCleave` `:4049`, `autoCleave` `:4027`, `runCleaveChain` `:3981`, gratuites `resolveFreeAttacks` `:4251`).

### 1.E « Test opposé »
Il n'y a pas de chemin distinct pour l'attaque : la mêlée EST le Test opposé (`resolveMelee` tire les deux jets quand le défenseur n'est pas surfacé ; sinon `defense:'none'` puis la fenêtre `FLOWS.defense` oppose le jet de défense au jet d'attaque figé et `finishDefenseResult` `rollFlowSpecs.ts:113` recompose le `AttackResult`). Les « critiques du Test opposé » (doubles) sont dans `appliquerLaTouche` `:2821-2855`. Les autres Tests opposés (Empoignade `combatFlow.ts:1390-1427`, Désengagement `:1280-1377`, Au contact `:1378`, Battement/Distraire `combatManeuvers.ts`, manœuvres de créature `combatManeuvers.ts:601`) ne passent PAS par `applyAttackResult` (sauf la frappe de dos du fuyard `combatSlice.ts:782`, et la frappe passive `jouerLaFrappePassive` `combatFlow.ts:3070` qui y revient).

### 1.F Ce que l'attaque lit de `GameState` (échantillon mesuré sur `combatFlow.ts:700-4700`)
`get().battle` ×81, `get().scene` ×22 (`sceneMetresPerTile`, `dimensions`), `get().gameTime` ×3, `get().pendingCascade` ×2, `get().log` ×2, `pendingLogQueue`, `pendingCleave`, `facing` ×1. Écritures `set(...)` : `battle` ×23, `pendingDefense` ×2, `pendingCleave` ×2, `facing` ×2, `pendingLogQueue`, `pendingHandGate`, `pendingGrapple`, `pendingFateSave`, `pendingDualStrike`, `pendingAuContact`, `pendingAttack`. Plus, par prédicats passant `get()` entier : `defenseSurfaced`/`tenuParUnHumain`/`jetSurfaced` (`s.net.gmSeat`, `s.net.ownership`), `checkBattleOver` (`vessel`, `travelPlan`, `party`, `flags`, `pendingVictory`, `pendingCascade`), `routeTriggeredTest` (`condCtx(get)`).

### 1.G Événements émis (bus, `src/state/bus.ts`, un module `state`)
`combatFlow.ts` : `SCENE_DIRTY` ×35, `ANIM_MOVE` ×5, `ANIM_ATTACK` ×4 (dont `:2754` mort-auto, `:2937` coup), `BATTLE_OVER` ×1 (`finishVictory` `:7236`), `ANIM_FLOAT` ×1 (`:2946`), `ANIM_AOE` ×1. `combatSlice.ts` : `SCENE_DIRTY` ×51, `ANIM_MOVE` ×4, `ANIM_FLOAT` ×1. `combatEffects.ts` : `SFX` ×2 (lot 2c, `:1414`). Aucun fichier `src/noyau/**` n'importe le bus. Le journal a trois canaux : `battle.log` (`ev`/`evLines`, `src/noyau/combatLog.ts`), `journaliser` (`combatLog.ts:76`), journal de groupe `get().log` (`store.ts`), plus la file `pendingLogQueue` (`drainPendingLog` `combatEffects.ts:129`).

---

## 2. Inventaire des injections

### 2.A Tables dont la définition vit dans `src/state` (à déménager ou fermer)
| Table | Définition | Remplie par (à l'import) | Entrées | Flux qui en dépendent |
|---|---|---|---|---|
| `registerHitModifier` | `src/state/combat/hitModifiers.ts:197-201` (`MODIFIERS` tableau trié) | `hitModifiers.ts:247,263,286,302,324` ; chargé par le baril `combatFlow.ts:286` | 5 : `wake-sleeper`(5), `arrow-ward`(8), `ward-saves`(10), `martyr`(40), `pushback`(50) | **attaque** (`combatFlow.ts:2717`) ET **sorts** (`:5955`). Closure de valeur : 3 fichiers `state` (`hitModifiers`, `combatPlacement`, `bus`). |
| `registerCombatHook` | `src/state/combatHooks.ts:57` (`HOOKS`) | `roundHooks.ts` ×15 (`onRoundEnd`), `turnHooks.ts` ×3 (`onTurnStart`) ; barils `combatFlow.ts:281,283` | 18 | **Aucune entrée sur les phases de l'attaque** ; dispatch par `emitCombatEvent` (`combatEvents.ts:28`). Entretien de round et début de tour = #2889. |
| `registerCloture` | `src/state/combatEffects.ts:733-736` (`clotureAppliers` Map, totalité tenue au type `CLOTURE_VERBES` `:738`) | `combatEffects.ts:785,786` ; `combatFlow.ts:5073,7276` ; `store.ts:1818,1819,1820,1825,1832,1838` | 10 verbes | Touchées par l'attaque : `ouvrirEcranDeVictoire` (`finishVictory` via `checkBattleOver`), `teardownDeVictoire` (store), `reprendreFlowDeCombat` (`runCombatFlow`), `effetsProgrammes`/`reprendreFlow` (`jouerLesClotures`, branchée au goulot noyau par `setSuiteApresCommit` `combatEffects.ts:782`). `avancerHorloge`/`retirerEntite`/`marquerActionJouee`/`dialogueSuivant`/`testRateDeLActeur` : flux monde. |
| `registerCastSpellEffect` | `combatEffects.ts:1253` (`castSpellRunner`) | `combatFlow.ts:5070` | 1 | sorts (#2889) |
| 3 hooks du test routé | `src/state/combat/triggeredTest.ts:104,114,125` | `combatSlice.ts:424,427,430` dans `createCombatSlice` (à l'init du slice, pas à l'import) | 3 | triggers de DONNÉES ouvrant une attaque gratuite / interruption de focalisation / piège-lame : **attaque** (indirectement) |
| `setManeuverPostHitHook` | `combatManeuvers.ts:90` | `combatFlow.ts:4379` | 1 | manœuvres de créature (#2889) |
| `setZoneCrossTestHook` | `combatPlacement.ts:113` | `combatSlice.ts:433` | 1 | mouvement/zones (#2889) |
| `AI_TURN_LOG`, `preRollFixedDiePending` | `combatFlow.ts:8121`, `:5196` | module | — | IA ; sorts (dé pré-armé) |
| `registerPerilInterrupt`, `registerEtalGenerateur`, `registerNightBandApplier`, `registerSequence*` | `authorPerils.ts:55`, `etalLotFlow.ts:35`, `nightBands.ts:126`, `sequenceCore.ts:69-225` | | — | hors attaque (vague 4) |

### 2.B Points d'injection DU NOYAU (variables de module assignées depuis `src/state`)
| Variable | Définition | Posée par | Lue par |
|---|---|---|---|
| `suiteApresCommit` | `src/noyau/cascade.ts:127,129` | `combatEffects.ts:782` (à l'import) | goulot `commitStep` `cascade.ts:1348` |
| `ownTestFailedEmitter` | `cascade.ts:158-159` | `combatSlice.ts:421` | `cascade.ts:1270,1366` |
| `clotureInjectee` (`dispatchCascadeDone`) | `cascade.ts:165-170` | `combatSlice.ts:520` | reprise d'une séquence parquée |
| `testRouter` | `src/noyau/triggeredEffects.ts:282-283` | `combatSlice.ts:418` | `triggeredEffects.ts:459` |
| `onConditionGained` (moteur !) | `src/engine/conditions.ts:105-109` | `combatSlice.ts:417` → `handleConditionGained` | toute pose d'État (`addCondition`) |

Ces cinq sont posés dans `createCombatSlice` (`combatSlice.ts:411+`) ou à l'import de `combatEffects` ; un hôte sans le slice ne les a pas.

### 2.C Registres de cascade du noyau remplis depuis `state`
`cascadeAppliers` (`cascade.ts:94`, Record<string, …>) : ≈ 114 appels `registerCascadeApplier` hors tests (dont `seaVoyageFlow` 28, `riverVoyageFlow` 13, `tavernFlow` 11, `combatFlow` 9, `travelFlow` 7…), plusieurs en boucle ou via helper (`registerCombatEndBandApplier` `combatFlow.ts:6896`, `WATER_EXPOSURE_KINDS` `combatEffects.ts:2234`). Autres : `cascadeTableFolds` (`cascade.ts:132`) 1 entrée de combat (`deviation`, `combatFlow.ts:2218`) ; `registerTableStep(Family)` (`cascade.ts:269,274`) : `combatFlow.ts:1727` (4 tables critiques), `:1978` (structure), `:3487` (Salve), `:4727` (3 tables d'Imparfaite), `corruptionFlow.ts:172,197` ; `cascadeSuccessRules`, `extendedTestOutcomeAppliers`.
**Appliers de COMBAT dont l'attaque dépend** (kinds poussés par le coup) : `deviation` `combatFlow.ts:4573`, `sauvegarde` `:2368`, `casseDArme` `:3526`, `bladeTrap`+`bladeTrapResult` `:7384,7377`, `fleeMove` `:1369` (frappe de dos), `maneuverDefense` `combatManeuvers.ts:601`, `triggeredTest`/`triggeredChoice`/`triggeredBatchTest` `triggeredTest.ts:675,783,369` (triggers). Étapes hôtes sans applier : `attackJet`, `defenseJet`, `fumbleJet` (`combatFlow.ts:3885,3642,3084`).
**Appliers de COMBAT hors attaque** (#2889) : `combatPsych` `:8101`, `combatEndDisease/Corruption` `:6917,6927`, `miscastTable` `:4787`, `actGate`/`actGateChoice` `turnHooks.ts:123,141`, `fatigue`/`aaBleedUnconscious`/`spellPlusChoice`/`spellPlusTest` `roundHooks.ts:418-470`, `opsDe`/`chuteDe` `combatEffects.ts:584,628`.

### 2.D Gardes de totalité existantes
`_ClotureVerbesTotaux` (`combatEffects.ts:739-743`) : seul registre déjà « fermé au type » (verbe absent de la liste = `tsc` rouge) ; il n'est pas statique pour autant (`Map` remplie par `registerCloture`).

---

## 3. Aléa et cadence

**Dés**
- `battleRng()` = variable de module `_rng` (`src/noyau/battleRng.ts:8`), réensemencée par `seedBattleRng` (`:16`, appelée par `store.seedRng`, `store.ts:2809`). 407 occurrences de `battleRng` hors tests dans 40 fichiers ; `combatFlow.ts` 103, `rollFlowSpecs.ts` 46, `seaVoyageFlow.ts` 28.
- Sur le chemin de l'attaque, lignes de `combatFlow.ts` : jet d'attaque/défense `843-887`, `922-924` ; ranged `516,666,671` ; crits `1708,1787-1791,1883,1938,1982,2015-2019,2224,2262,2316` ; bordée `2601,3956` ; trigger `2869,2876,2963,2987,2992,2993` ; dispersion `2945` ; frappe passive `3073` ; Maladresse `3087,3407,3415,3466` ; défense `3673,3695` ; main `3900,3903` ; gratuites `4118,4299-4472`. `combatSlice.ts` : `151,229,421,642,830,895,1474,2081,2400,2554,2809…` (attaque : `2554` = `fumbleConfirm`). `rollFlowSpecs.ts` : relances/forçage `685,794,849,923,989…`.
- Le tirage suit l'ordre d'appel (un seul flux) : l'ordre des appels est donc un contrat de reproductibilité (`resolveCritique` consomme du RNG même sous dé posé : `combatFlow.ts:2209-2216`).
- Interface `RNG` = `{ int(min,max) }` seulement (`src/engine/dice.ts`), implémentation seedable `makeRNG` (`:22`).
- Dés forcés/fixés : Résilience (`forceSuccess`/`setForcedRoll`, `rollFlowFactory.ts:493-514`), option « Dés fixés » `desFixes()` (`engine/fixedDie.ts:16`) via `canFixDie` (`netOwnership.ts:303`) ; le dé est d'abord tiré NATURELLEMENT puis SUBSTITUÉ (`withPreRollFixedDie` `combatFlow.ts:5208`, côté sorts). Marque de provenance : `src/noyau/fixedDieMark.ts:49,55` (lue par `combatLog.ts:90` et `store.ts:3163`).
- Défauts `defaultRNG` : voir §0.6.

**Cadence**
- `scheduleCombatTimer`/`scheduleFlowTimer` (`src/web/minuteries.ts`, registre `pending`, nettoyé par `src/test-setup.ts`). Sur le chemin de l'attaque : approche `combatDirector.ts:43` (←`targetingModes.ts:703`, `combatFlow.ts:8658`) ; télégraphe IA `combatFlow.ts:8360`/`TEMPO.aimTelegraph` ; fin de tour `:8382,8571` (`postAttack`) ; reprises `:7434` (`enemyAdvance`), `:8193`, `:7693` (`turnHandoff`) ; auto-cadence `combatAuto.ts:117,158,161,221,243`.
- Durées : `beatHold(get, base)` (`combatDirector.ts:24`) = `TEMPO[base]` (`src/state/tempo.ts`) × ton du dernier événement (`lastEventTone`, `noyau/combatLog`) — lit `battle.log`.
- Mode de cadence `manuel|rapide|auto` : variable de module `cadence()` (`engine/cadence.ts:16`, `setCadence` `:22`), lue par `cadenceAuto()` (`noyau/rollSeam.ts:351,405`), `cadenceAutoCombat()` (`netOwnership.ts:232`, `combatFlow.ts:7671`) → décide « modale ou inline » pour chaque porteur (`surfaceOf`, `rollSeam`).
- Attentes d'animation : aucune attente d'un événement de rendu ; seules les durées estimées (`walkMs` `src/geometry/walk`) cadencent.

**Configuration maison** : §0.5 ; lectures de `rule(...)` dans `combatFlow.ts` : `665,781,2147,2273,2468,4031,4060` (attaque), `4706,5100,6221,6728,7515,8062` (autres) ; `combatSlice.ts:1868` ; `combatHooks.ts:68` (`enabledIf`) ; chargement `loadRuleOverrides` (`engine/policy.ts:137`) par `state/houseRules.ts:24`, `netFlow.ts:163`, `store.ts:112`.

**Sièges / coop (entrée implicite de l'attaque)** : `defenseSurfaced`→`jetSurfaced` (`noyau/sieges.ts:52`), `tenuParUnHumain` (`:72`), `aiDriven`/`controlsCombatant`/`pilotedByHuman` (`netOwnership.ts:225,240,…`) lisent `s.net.gmSeat`, `s.net.ownership`, `s.net.mode`. Les intents d'attaque sont routés par la table `src/state/intents.ts:103` (`attackConfirm: 'invité'`…), l'hôte exécutant.

---

## 4. Type de l'état de combat

- `BattleState` : `src/state/store.ts:230-349`. Champs : `combatants`, `order`, `baseOrder?`, `turn`, `round`, `crewActed?`, `action`, `selectedSpellId`, `selectedAttack?`, `reachable: Map`, `movementUsed`, `movedPreAction`, `acted`, `aiTurnPlayed?`, `loadoutSwapped?`, `stances?`, `log: CombatEvent[]`, `over`, `onVictory?: Flow`, `victoryCondition?`, `banRanged?`, `siege?`, `zones?`, `domainCasts?`, `windsOfMagic?`, `advantagePools?`, `bleedDoomed?`, `moveSnapshot?`, `runBudget?`, `fearGate?`, `handRaisedBy?`, `endTurnArmed?`, `preview?`. Contient de l'état d'INTERFACE (`action`, `selectedSpellId`, `selectedAttack`, `reachable: Map`, `preview`, `handRaisedBy`, `endTurnArmed`) mêlé à l'état de règles. Types non moteur dont il dépend : `BattleActionMode` (`src/state/actionRegistry.ts`), `ShootingStance` (`store.ts:226-230`, local), `MoveSnapshot` (déjà `noyau/monde/combatGeometry`), `BattleZone` (`noyau/monde/zones`), `Flow` (`noyau/monde/flow`), `VictoryCondition` (`noyau/monde/scene`), `CombatEvent` (`noyau/combatLog`).
- `GameState` : `store.ts:385` (`extends RollFlowActionsMap`) ; `battle: BattleState | null` `:594` ; slots de pendings `:551-847` (dont attaque : `pendingAttack :621`, `pendingHandGate :624`, `pendingDefense :631`, `pendingCleave :715`, `pendingDualStrike :717`, `pendingLogQueue :726`, `pendingFateSave :768`, `pendingCascade :660`, `pendingVictory :773`). Les TYPES des pendings sont déjà au noyau : `export * from '../noyau/pendings'` (`store.ts:218`, préfixé du commentaire « ré-exportés pour la compat des imports existants », `store.ts:216-217`) : `PendingAttack` `noyau/pendings.ts:370`, `PendingHandGate :463`, `PendingCleave :504`, `PendingDualStrike :519`, `PendingDefense :1224`, `SuiteDeCoup :1059`, `QueueDuCoup :1135`, `CoupSuspendu :863`, `PendingDeviation :908`, `DecisionDeCritique :850`, `DeviationCtx :835`, `EnchainementDuCoup :1029`, `Cloture :1667`, `PendingCasseDArme :1164`.
- `Get = () => GameState`, `Set = (partial | fn) => void`, `PatchDeFlux` : `src/state/flowTypes.ts:9-13`. `PendingKey` : `src/state/stateFields.ts:27`. `Applique` : `combatEffects.ts:405`.
- **Arcs de TYPE `noyau → state` aujourd'hui** (hors tests), exactement :
  - `store` : `GameState` (`noyau/cascade.ts:19`, `fixedDieMark.ts:14`, `rollSeam.ts:36`, `sieges.ts:4`, `slotsDeJet.ts:5`, `voyageCadence.ts:15`, `monde/combatants.ts:19`), `BattleState` (`monde/combatGeometry.ts:7`).
  - `flowTypes` : `Get`, `Set` (`cascade.ts:18`, `rollSeam.ts:35`, `combatLog.ts:12`, `partyWipe.ts:17`, `triggeredEffects.ts:13`), `Get` seul (`combat/advantagePool.ts:10`).
  - `stateFields` : `PendingKey` (`slotsDeJet.ts:7`).
  - `rollFlowFactory` : `RollParticipant`, `MultiPending`, `PendingBase` (`pendings.ts:26`).
  - `combat/recover` : `RecoverOpposition` (`pendings.ts:24`).
  - `restFlow` : `NightEntry` (`voyageCadence.ts:12`), `PendingRest` par type en ligne (`pendings.ts:2378`, `import('../state/restFlow')`).
  Les tests du noyau importent des VALEURS de `state` : `cascade.test.ts:4,8`, `rollSeam.test.ts:2,4,5,8`, `fixedDieMark.test.ts:2`, `monde/combatants.test.ts:3`, `monde/sceneRules.test.ts:5`, `monde/combatGeometry.test.ts:4,5` (non vérifié : si `murs/purete-imports` les exempte).
  Table : `scripts/guards/lib/couches.mjs:30` (`noyau: importe engine, data, feuilles ; transitoire state {issue '#2889', types:true}`).

---

## 5. `bestDefenseMode`

- Définition : `src/state/combatManeuvers.ts:632-635` (3 lignes, `isBestial(defender.traits)` puis comparaison de `defenseValue(defender,'esquive')` et `'parade'`). Valeurs importées par la FONCTION : `isBestial` (`engine/traits/dispatch`) et `defenseValue` (`engine/combat.ts:388`) — du moteur pur.
- Elle tire le store parce qu'elle est dans un fichier dont les imports de VALEUR sont : `./bus` (`:60`), `./netOwnership` (`:38`, `defenseSurfaced`), `./combatOrParty` (`:40`, `touchActors`), `../noyau/cascade` (`registerCascadeApplier`, `startCascade`, `:36`), `../noyau/triggeredEffects` (`:53`), etc. Chaîne mesurée (fermeture de valeur) : `combatManeuvers.ts` → `combatOrParty.ts:22` (`import { currentTargetingMode } from './targetingModes'`) → `targetingModes.ts:62-64` (`from './combatFlow'`, qui ré-exporte `combatManeuvers`) → `store.ts`, `combatSlice.ts`… Fermeture : **633 fichiers dont 131 sous `src/state`** (`closure.mjs src/state/combatManeuvers.ts`). `netOwnership.ts` seul : 260 fichiers dont 4 `state`, sans `store` (n'est pas le coupable). Le coupable est `combatOrParty → targetingModes`.
- Le plan/ticket : « ordre d'import » et `ReferenceError clotureAppliers` (`combatEffects.ts:738` via `store.ts:1816`) viennent du même cycle `combatManeuvers → … → combatEffects → store`.
- Appelants (hors tests) : `combatFlow.ts:288` (ré-export), `:887,921,1052,2929,3713,3778,4323` ; `combatManeuvers.ts:366,557,563` ; `rollFlowSpecs.ts:34,93` ; `devtools.ts:127,1832`. Type : `noyau/pendings.ts:1230` (commentaire seul).
- Fermeture d'imports d'autres cibles candidates : `state/combat/hitModifiers.ts` → 3 fichiers `state` ; `state/combatHooks.ts` → types + `engine/policy` seulement ; `state/combatEvents.ts` → `combatHooks` + `noyau/triggeredEffects`.

---

## 6. Taille, découpage, tests

### 6.A Fichiers
`src/state/combatFlow.ts` **8665** lignes ; `combatSlice.ts` 3711 ; `combatEffects.ts` 2304 ; `combat/triggeredTest.ts` 952 ; `combatManeuvers.ts` 724 ; `combat/roundHooks.ts` 477 ; `combat/hitModifiers.ts` 344 ; `combat/turnHooks.ts` 316 ; `rollFlowFactory.ts` 835 ; `store.ts` 3321 ; `src/engine/combat.ts` 1906 ; `src/noyau/*.ts` 8554 lignes au total.

### 6.B Régions de `combatFlow.ts` (fonction → plage)
Le baril : `export *` `:246-286` (monde/combatGeometry, combatPlacement, combatArea, combatGate, combatEffects, combatManeuvers, combatHooks, combatSetup, combat/triggeredTest, `turnHooks`, `hitModifiers`).

Partie ATTAQUE (approx. 3 700 lignes de 8665, bornes par fonction) :
| Région | Plage | Contenu |
|---|---|---|
| Arme et contexte | 315-540 | `applyIncomingMeleeAdvantage` 315, `attackWeaponOf` 331, `victimeDuCoup` 344, `armeDeLaGratuite` 351, `firedWeapon` 361, `weaponContextOf` 398, `banRangedActive` 419, `siegeActif` 429, `firedAttackBlock` 440, `strayShotVictim` 497, `crowdEligible` 507, `attackWardGate` 516 |
| Environnement et jet | 689-940 | `attackEnv` 721-812, `resolveAttack` 813-895, `resolveDualSecond` 896-929, `dualStrikeTargets` 930 |
| Aperçu | 941-1068, 1110 | `previewAttack` 967, `difficultyOf` 1022, `defenseDodgeMods` 1031, `previewDefense` 1048, `previewResourceDelta` 1110, `eligibleAttackTargetIds` 1141 |
| Plan | 1616-1686 | `attackPlan` |
| Mort | 1688-1717 | `finalizeHeroDeath` 1688, `notifySlain` 1703 |
| Critiques (porteurs) | 1719-2112 | tables 1719-1782, `resolveCritSeverity` 1783, `applyCriticalToTarget` 1798, `applyHullCriticalToTarget` 1923, structure 1977-2090, `previewCritEntry` 2091 |
| Déviation | 2114-2322 | `deflectCrit` 2114, `applyCritAndFinalize` 2123, `autoDeviate` 2143, `pushDeviationStep` 2174, pli 2218, `breakBacleArmour` 2232, `applyOpposedCritical` 2249, `apresLeCritiqueDe` 2306 |
| Sauvegarde | 2348-2400 | `pousserSauvegarde`, applier, `reprendreApresSauvegarde` |
| Plan et encaissement des critiques | 2401-2640 | `planifierLesCritiques` 2453, `appliquerLesCritiques` 2514, `encaisserLeCoup` 2563, `cloreLeCoup` 2583, marin 2596-2640 (Projectile : 2401-2452) |
| **Le coup** | 2641-3008 | `ApplicationDuCoup` 2641, `applyAttackResult` 2662, `appliquerLaTouche` 2680-3008 |
| Après-coup | 3009-3190 | `jouerLApresCoup` 3009, réaction/riposte 3042-3070, Maladresses 3082-3114, focalisation 3116-3150, `attackerFumbled`/`defenderFumbled` 3151-3170 |
| Tir rapide | 3171-3236 | `inFiringBand`, `runPreemptShots` 3191 |
| Usure et casse | 3277-3576 | `wearActiveWeapon` 3288, `applyOups` 3370, casse d'arme 3497-3576 |
| Défense | 3577-3790 | `applyShieldReaction` 3577, `defenseEnCours` 3613, `maybeOpenDefense` 3653, `surfacedDefensePending` 3739, `openSurfacedDefense` 3756 |
| Postures et ouverture | 3791-3965 | `STANCE_BLOCK` 3820, `openAttackCascade` 3856, `poserLeTestDeMain` 3870, `poserLEtapeDAttaque` 3881, `aiHandGate` 3897, `doAttack` 3911, `jouerLesTirsDeBordee` 3949 |
| Balayage / suite | 3968-4160 | `cleaveTargets`, `runCleaveChain` 3981, `autoCleave` 4027, `maybeHeroCleave` 4049, `jouerLaSuiteDuCoup` 4107 |
| Gratuites | 4162-4336 | `aiAvailableFreeAttack`, `drainerLesGratuites` 4191, `applyTalentFreeAttack` 4210, `resolveFreeAttacks` 4251, `applyFreeAttack` 4314 |
| Reprise | 4485-4586 | `resumeMeleeAfterSuspension` 4485, `resolveDeviation` 4507, `cloreLaReprise` 4530, `reprendreLeCoup` 4546, applier `deviation` 4573 |
| Clôture de combat | 7133-7300 | `checkBattleOver` 7133, `finishVictory` 7231, `finishCombatEnd` 7289, `resolveFirstBlood` 7124 |
| Reprise de l'IA | 7425-7478, 8233-8400 | `resumeEnemyTurn` 7431, `resumeSuspendedAI` 7440, `runEnemyAI` 8233 |

Hors attaque : 543-688 (surprise, météo, vents), 1134-1615 (mouvement, désengagement, Au contact, Empoignade, portées, IA d'approche, peur), 4337-4484 (aire/langue/gémissement/regard/IA spéciale/Battement), 4671-6710 (sorts, Contre-sort, Projectile, incantation), 6713-7123 (fin de combat, tests), 7305-7424 (gantelet, piège-lame), 7479-7800 (tour, round), 7800-8120 (psychologie), 8122-8665 (IA).
Actions de store : `combatSlice.ts` `battleClickEntity :1117`, `preemptRangedShot :1761`, `fateNegate/fateSurvive/fateAccept :1824/1837/1853`, `handGateConfirm :2066`, `attackSet* :2273-2305`, `attackRoll :2317`, `attackConfirm :2344`, `siegeAimCommit :2487`, `cleaveAttack/End :2511/2521`, `dualStrike* :2526/2547`, `fumbleConfirm :2557`, `defenseSet*/defenseConfirm :2583-2673`, `startCombat :2677`, `cascadeNext :3400`, `dispatchCascadeDone :438-518`, `advanceCombatJet :287`, `poserLaFrappeSuivante :301`.

Appelants externes de `applyAttackResult` : `combatSlice.ts:782` (frappe de dos du fuyard), `:2379` (Tir rapide), `:2472` (coup normal), `:2661` (défense machine). Importeurs de `combatFlow` : 32 fichiers hors tests (`src/gameIso/stage/*`, `src/ui/*`, `src/state/*`), 306 fichiers de tests y font référence.

### 6.C Tests qui exercent l'attaque via le store (97 fichiers au total, mesure `attackConfirm|attackRoll|applyAttackResult|doAttack|resolveAttack|openAttackCascade|defenseConfirm`)
`attackConfirm`/`attackRoll` : 39 fichiers ; `applyAttackResult` : 45 ; `doAttack|runEnemyAI|maybeRunEnemyTurn` : 32 ; `defenseConfirm` : 23. Liste complète (les 97) :
`src/engine/traits/parity.test.ts`, `src/gameIso/backends/webgl/dessin-combat-gel.test.tsx`, `src/gameIso/stage/useHoverTargeting.test.tsx`, `src/scenes/test-scenarios/22-dome.test.ts`, `src/scenes/test-scenarios/42-belier-porte.test.ts`, et sous `src/state/` : `ai-aim-banner-intent.test.tsx apres-coup at-terre attack-intent-ownership banish champion-riposte cleave combat-gel-tour combat-hotes-porte combat-optional-rules combat-tables-choix-porte combat/hitSaves.golden combat/sauvegarde-a-la-porte combatFlow-los compte-du-coup-apercu coup-a-zero crit-severity-step critique-obtenu-sans-prise critique-sans-blessure critiques-du-coup-store defense-hote-prete defense-suite defense-surfacage deviation-armour deviation-paths dual-wield enemy-reload firstBlood fixed-die flee frenesie-critique-devie frenzy-hero-free frenzy-ia grapple gratuite-avantage-apercu gratuite-nom-unique gratuites-au-tour hand-gate-flow helpless-crit-location hurlement-resist-cascade inanimate-melee jet-owner-real-flows l13-gates localisation-relancee-application localisation-relancee-figee man-emplacement martyr-critique melee-enchainements-sans-gel mounted-reach naval-damage oncrit-origine oups-a-la-porte parite-heros-ia-test parite-ordre-de player-maneuvers porte-bouclier-advantage porte-bouclier-chemin-joueur porte-bouclier-reaction posture-tir preview-attack raw2-crit-location reinjury-bleed reveal-combat riposte-frappe-passive roll-line-combat roll-modal-invariant roll-seam-exclusivity-guard rollflow-outcome-invariant scatter-throw seconde-main-store sequence-possession set-scan-guard siege-emplacement siege-indirect stationary-fire store structure-combat taillade-indice talent-free-attack tentacle-attack tir-rapide-combats-complets tir-rapide-fenetre trample triggered-effects weapon-context-funnel`, et `src/ui/CascadeTableMode.test.tsx attente-defense-surfacee.test.tsx deux-armes-fenetre.test.tsx etat-sur-les-modales.test.tsx jetProps/defense-forcage-annule.test.tsx jetProps/useAttackJetProps.conformance.test.tsx jetProps/useDefenseJetProps.conformance.test.tsx`.
Gardes qui lisent le chemin : `src/state/roll-seam-exclusivity-guard.test.ts` (« Applique » consommé, `scripts/guards/lib/rollSeamExclusivity.mjs`), `combat-event-port-guard.test.ts`, `combat-event-emission-coverage.test.ts`, `combat-hardcode-guard.test.ts`, `combat-timer-leak.test.ts`, `batch-naval-quarantine-guard.test.ts`, `set-scan-guard.test.ts`. Kits : `src/state/combatDeTest.testkit.ts`, `cascadeTestKit.ts`, `noeudsDeTest.testkit.ts`.

---

## 7. Couplage avec #2724 vague 3

- **#2763** = « AttackResult fermé : marque `Touche` posée par `applyHit` seul, fixtures par `toucheAuJetPose` (tri C6) », sous-issue de #2724, ouvert, « Bloqué par #1858 » (File de frappes du tour, ouvert). Sites mesurés : `AttackResult` `src/engine/combat.ts:498`, `critLocation` `:507`, `applyHit` `:1717` (pose `critLocation` `:1809`), `toucheAuJetPose` `:1562`, `toucheDuTestDeDefense` `:1571`, `localisationRelanceeDe` `:1605`, `compteDuCoup` `:1616` ; lecteurs de `critLocation` hors tests : `combatFlow.ts` ×7, `rollFlowSpecs.ts` ×7, `combatSlice.ts` ×1 (`:2306` `attackSetCritLocation`), `noyau/pendings.ts` ×3, `ui/EtatPanel.tsx` ×4, `ui/jetProps/useAttackJetProps.tsx` ×1 ; 24 fichiers de tests combinent `critical: true` et `applyAttackResult` (sonde du ticket : 20). Le Projectile naît d'un littéral (`ToucheDeProjectile`, `combatFlow.ts:5903-6030`).
- **`targeting-holder-vs-mode`** : test `src/state/targeting-holder-vs-mode.test.ts` ; sites `src/state/targetingHolder.ts:11` (prédicat `mapTargetingActive`, aussi lu par `src/gameIso/SurcoucheIso.tsx:14` et `netOwnership.ts:11`) et `src/state/targetingModes.ts:961` (`currentTargetingMode`). Le plan de #2724 (`docs/plans/2026-10-18-gardes-vers-structure.md:196,460`) dit : « deux prédicats jumeaux ; cycle `netOwnership`→`targetingModes`→`combatFlow` » (rang 7, 3 niveaux). Il touche le CHEMIN d'import de `bestDefenseMode` (§5) mais pas le code déplacé par la vague 3 (c'est de l'UI de ciblage, `targetingModes.ts:343-712` = `attackAffordance`/`attackClickCommit`, côté présentation/adaptateur).
- Autres items de la vague 3 de #2724 (`docs/plans/2026-10-18-gardes-vers-structure.md:199-205`) restant à #2724 selon le plan : `combatEventPort` (`combatFlow.ts:263`, `export *` réécrit), seam de jet (`rollSeam*`, `battleRng*`, `SeamRng`), `setScan` (707 sites), `sceneMutation`, `inBattleFind` (74 sites), `MACHINERY_RX`, `effect-rule-anchor`, `cascade-step-stake`. **Recouvrement mesuré** : `battleRng*` et le « seam de jet » sont dans le code que la vague 3 doit paramétrer (§3) ; `combatEventPort` réécrit la ligne `combatFlow.ts:263`/baril que la vague 3 déplace. « Coordination avec #1595 » (`:205-207` : la vague 3 de #2724 part après #1595 ; le train `chantier/1595` était en vol, PR #2764).

---

## 8. Branche `poc/godot`

`git branch -r` : `origin/poc/godot` existe ; `git ls-remote` : `3baf8483b9367260756cfd5d3e87948caa929b48 refs/heads/poc/godot` (tête). `pont.ts` fait 638 lignes sur cette tête (le ticket citait `:141-211` à l'époque de #2793) ; l'enchaînement maison se lit aujourd'hui à **`pont.ts:178-262`** :
- `critiquesTireesDeuxFois` `:178` (copie de `combatFlow.ts:178`), `appliquerLaCritique` `:185-206` (copie de la branche `personnage` d'`applyCriticalToTarget` : `resolveCritique`, `criticalWounds`, `tookCriticalThisFight`, `critEntriesSuffered`, traumas + `consolidateAmputations`, `applyOps` sauf létal → `dead=true` **sans Destin**) ;
- `encaisserLeCoup` `:208-234` (copie : Blessures, `reinjuryBleed`, Mort subite, boucle des critiques jusqu'au létal, `applyZeroWounds` si `regimeDePorteur.clore`) — **refuse** les porteurs ≠ `personnage` (`:210`) ;
- `resoudre` `:237-240` (`resolveMelee` + `bestDefenseMode` importé de `src/state/combatManeuvers`) ;
- `appliquer` `:244-262` (`compteDuCoup`, Avantage attaquant/défenseur `gainAdvantage`, `groupAdvantage`, relance de localisation, `woundsLost`).
Absents du pont (donc à offrir par l'API du noyau si l'hôte doit les avoir) : Destin (`finalizeHeroDeath`), Déviation critique/automatique, mort-auto d'un Inconscient, sauvegardes de touche (registre), premier sang, levée d'Engagement/Psychologie, `engage`/`markAttacked`, Armure Bâclée, critiques du Test opposé, `onHit`/`onWoundLoss`/`onKill`/`onCrit`/`notifySlain`, Maladresse, riposte, balayage, bornes d'Action (`acted`), `checkBattleOver`, journal par `ev`.
Imports du pont hors moteur : `src/state/store` (effet de bord, `pont.ts:4`), `src/state/combatFlow` (`previewDefense`), `src/state/combatManeuvers` (`bestDefenseMode`), `src/state/rollFlowFactory` (`actorInfluenceView`, `rerollAvailable`), `src/state/rollSeam` (`composeRollLabel`, `rollLine`) — **chemin périmé depuis le lot 2b** —, `src/state/spawn` (`creatureToCombatant`), `src/ui/difficultyText`. RNG : `makeRNG(graine)` passé en paramètre (`pont.ts:530,580`). Les sept morceaux de la modale : `docs/plans/2026-10-19-modale-attaque-godot.md:55-63` (§0.10).

---

## 9. Primitives canoniques déjà présentes (à réutiliser, pas à réinventer)

Lu dans `/home/user/game/docs/primitives.md` (GÉNÉRÉ, absent du worktree) :
- l.232 : « un COUP = application + après-coup, une écriture » → `applyAttackResult / jouerLApresCoup / APRES_COUP / SuiteDeCoup / SuiteDeDefense` (`src/state/combatFlow.ts`, test `src/state/apres-coup.test.ts`) ; manifeste `src/data/primitives.manifest.json:1456`. C'est LA couture à déplacer, pas à recréer.
- l.231 : `confierLaSuite/cloturer/Suite` (`combatEffects.ts`) = la suspension/reprise (`Applique`/`OPS_DIFFEREES`).
- l.240 : `touchActors` (`combatOrParty.ts`), seule couture de re-rendu après mutation en place.
- l.35 : `actorIn/inBattleId/ecrireActeur` (`src/noyau/monde/combatants.ts`).
- l.51 : `cascade/registerCascadeApplier` ; l.145 : `makeRollFlow/FLOWS` ; l.213 : `openRoll/surfaceDeLEtape` (`src/noyau/rollSeam.ts`) ; l.181 : `rule/policy`.
- `docs/index-moteur.md:699,720,1078` : `resolveMelee` (combat.ts:1339), `issueAuJet` (combat.ts:1641), `makeRNG` (dice.ts:23) ; `:63-64` rubrique « Combat : attaque, Avantage, engagement, Coups Critiques » (`compteDuCoup`, `critiquesDuCoup`, `apresDeviations`, `toucheAuJetPose` y figurent). Moteur déjà pur pour : jet, compte du coup, critiques, Blessures (`woundsFromHit`), Mort subite (`appliquerMortSubite`), traumas.
- Je ne conclus à aucun manque de vocabulaire moteur : la question posée est une couture d'orchestration, pas une op/Condition/Trigger. Aucune fonction `(état, intention) → (état, journal, événements)` n'existe aujourd'hui sous `src/noyau` (`git grep` sur `export function` de `src/noyau/*.ts` et `index-moteur`), ni `src/noyau/index.ts`.

---

## 10. Poison de commentaire rencontré (non corrigé)

- `src/state/store.ts:216-217` : « extraits dans ./pendings, ré-exportés pour la compat des imports existants » (rétro-compatibilité + pierre tombale) devant `export * from '../noyau/pendings'` `:218`.
- `src/state/combatFlow.ts:7540` et `:8263` : « STRICTEMENT équivalent à l'ancien `runCombatHooks(...)` » (pierre tombale) ; `:5376` (« l'ancien jet inline »), `:5497` (« parité avec l'ancien flux »), `:8057` (« au lieu de l'ancien cumul… »), `:8449`, `:8614`.
- `src/state/combatSlice.ts:4` et `:411` (« déplacées VERBATIM ») ; `:756` (« DIVERGE de l'ancienne — assumé », excuse sans tag).
- `src/state/combatFlow.ts:3277-` non relu en entier ; `src/noyau/pendings.ts:633,1568` (« comportement historique »).
- Paraphrases de règle dans les commentaires : nombreuses en tête de `appliquerLaTouche` (`combatFlow.ts:2684-2716`, 2739-2742) et `critiquesDuCoup` ; non comptées.

---

## 11. Non couvert (ce que je n'ai PAS lu)

- Corps de `src/state/combat/triggeredTest.ts` (hors lignes 92-130, 485-496), `applyOups`/casse d'arme `combatFlow.ts:3277-3576`, `applyShieldReaction`, `applyFreeAttack*` `4162-4336`, `combatArea.resolveWeaponArea`, `engine/combat.ts` (hors signatures), `engine/critical.ts` (hors `jeuDeCritique`, signatures).
- `src/ui/jetProps/useAttackJetProps.tsx`, `CascadeModal`, `RollShell` (côté présentation) ; `src/state/ai.ts` (décision de l'IA) ; `net/` (relay) au-delà de `intents.ts:103`.
- Comportement des gardes (`scripts/guards/**`, `murs/purete-imports`) face aux fichiers de tests du noyau ; `docs/architecture.md` (§ frontière orchestrateur/machinerie/donnée) et `docs/doctrines.md` non relus pour cette carte.
- Les sorts (`applyCast`, `appliquerToucheDeProjectile`), l'entretien (`roundHooks`), le voyage : seulement localisés.
- Aucune exécution (tests, build, typecheck) ; `gh` utilisé en lecture sur #2763, #2817, #1858, #2724.

---

## 12. Proposition de découpe en lots (à juger ; la carte ci-dessus est la seule partie factuelle)

Principe : « jamais deux implémentations d'une même règle » ⇒ chaque lot DÉPLACE un morceau (le site d'origine importe le nouveau) et ne duplique rien.

| Lot | Contenu | Fichiers | Risque |
|---|---|---|---|
| 3a | `bestDefenseMode` hors de `combatManeuvers` (3 lignes, deps `engine` seulement) ; retire l'ordre d'import, −633 fichiers de fermeture pour qui l'importe | `src/state/combatManeuvers.ts:632`, appelants §5, éventuellement `src/engine/combat.ts` ou `src/noyau/combat/` | faible ; `docs/primitives.md`/`index-moteur` régénérés |
| 3b | Type de l'état de combat au noyau : `BattleState` (+ `ShootingStance`, `BattleActionMode` ou son découpage, retrait des champs d'UI `preview`/`reachable`/`action`…) ; `GameState` le compose ; retire le symbole `BattleState` de l'arc `noyau→state` (`monde/combatGeometry.ts:7`) | `store.ts:230-349`, `noyau/pendings.ts`, `actionRegistry.ts` | moyen (≈ 306 fichiers de test et 32 importeurs lisent `store`) ; décision Q1/Q2 requise |
| 3c | Déménager les tables fermables de l'attaque : `hitModifiers` (5) en table statique typée par union d'ids, dispatch `combatHooks`/`combatEvents` (la table `HOOKS` reste #2889 : seul le dispatch passe), `Cloture` totale | `state/combat/hitModifiers.ts`, `combatHooks.ts`, `combatEvents.ts`, `combatEffects.ts:733-786`, `store.ts:1818-1838`, `combatFlow.ts:5073,7276` | moyen : `registerCloture` croise le store (`advanceTime`, `removeEntity`) ; `hitModifiers` partagé avec `applyCast` |
| 3d | Cœur du coup : `encaisserLeCoup`, `planifierLesCritiques`, `appliquerLesCritiques`, `applyCriticalToTarget` (porteurs), `applyOpposedCritical`, `autoDeviate`, `finalizeHeroDeath`, `notifySlain`, `cloreLeCoup`, `resolveFirstBlood`, `breakBacleArmour` → noyau, appelés par `appliquerLaTouche` encore dans `state` ; sert aussi le Projectile (`:5971`) et le marin (`:2623`) | `combatFlow.ts:1688-2640` | élevé : mutation en place, `pushReveal`/`pushDeviationStep`/`routeTriggeredTest` (étapes de cascade) ; commun aux sorts |
| 3e | `appliquerLaTouche` + `jouerLApresCoup` + `jouerLaSuiteDuCoup` + `maybeOpenDefense`/`openSurfacedDefense` + `checkBattleOver` (≈ 45 appelants) ; l'adaptateur `state` ne fait que poser | `combatFlow.ts:2641-3190,3577-3790,3949-4160,7133-7300` | très élevé : suspension/reprise (`OPS_DIFFEREES`), 97 fichiers de tests |
| 3f | Jet et influences : `resolveAttack`, `attackEnv`, `previewAttack/Defense`, `rederiveAttack`, `finishDefenseResult`, relance/`bonusSL`/forçage (les « sept morceaux » du pont) → API du noyau | `combatFlow.ts:689-1068`, `rollFlowSpecs.ts:71-130,516-720`, `rollFlowFactory.ts` | moyen-élevé ; l'usine `makeRollFlow` est partagée par tous les flux (#2889) |
| 3g | Entrées de l'hôte : RNG, cadence (`beatHold` → événement « attendre N ms »), config `rule()`/`cadence()`/`desFixes()` (§0.5-0.6) ; événements `ANIM_*`/`SCENE_DIRTY` → liste rendue par le noyau ; `src/noyau/index.ts` naît avec la première fonction exposée | `battleRng.ts`, `engine/policy.ts`, `engine/cadence.ts`, `bus.ts`, `combatDirector.ts` | moyen ; transversal |
| 3h | Surface du noyau pour l'hôte (`src/noyau/index.ts`) + test hors store + contrôle du graphe d'import ; mesure sur `poc/godot` (sans fusion) | `src/noyau/index.ts`, test | faible une fois 3b-3g faits |

L'ordre 3a, 3b, 3c puis 3d (sans toucher aux appelants), 3e, 3f, 3g, 3h tient « jeu vert » à chaque marche si chaque lot ré-exporte nulle part (importeurs mis à jour dans le lot, `export *` du baril modifié au besoin). #2763 (AttackResult fermé) s'insère après 3d/3e mais reste bloqué par #1858.

### Questions de design restantes
1. **Qu'est-ce que l'« état de combat » du noyau ?** `BattleState` seul ne suffit pas : l'attaque lit/écrit `scene` (échelle, dimensions), `facing`, `net` (sièges), `gameTime`, `flags`/`party`/`vessel` (clôture de combat), et 8 slots `pending*` + `pendingCascade` (étapes poussées). Une tranche de `GameState` ? un type neuf ?
2. **Mutation en place des `Combatant`** (identité référentielle utilisée : `b.combatants.includes(enemy)` `combatFlow.ts:8363`, objets tenus à travers plusieurs `set`) : copie à l'entrée (`structuredClone`, coût) ou contrat « l'hôte possède, le noyau mute » ? Détermine ce que « nouvel état » veut dire.
3. **Suspension** : garder `OPS_DIFFEREES` + pendings sérialisables + étapes de cascade (le noyau « rend la main » avec une fenêtre ouverte, l'hôte la joue et rappelle une fonction de reprise), ou une valeur de retour explicite ? Les reprises (`reprendreLeCoup`, `defenseConfirm`, `fumbleConfirm`, `dispatchCascadeDone`) vivent dans `combatSlice`.
4. **Qui orchestre le tour** ? Après le coup, `resumeEnemyTurn`/`advanceTurn`/`scheduleCombatTimer` (IA, gratuites, balayage, `checkBattleOver`). Le noyau rend-il « tour de l'IA à reprendre dans N ms » ou porte-t-il la boucle ?
5. **Événements** : liste typée rendue (remplace `bus` ; `SCENE_DIRTY` ×86 n'a plus de sens), payload `ANIM_ATTACK` embarque `res`/`weapon` complets ; ordre vis-à-vis du journal.
6. **Dés** : l'interface `RNG` = `int(min,max)` suffit-elle pour « l'hôte montre ses propres dés » (ordre d'appel imposé, dé tiré puis substitué par Résilience/« Dés fixés », défauts `defaultRNG`) ? Faut-il une requête de dé (`demanderUnDe`) plutôt qu'un RNG ?
7. **Configuration** : paramètre explicite (touche 29 fichiers moteur) ou setter de module scopé ? Qui fournit `cadence`, `desFixes`, `rule` (lus en profondeur)?
8. **Frontière avec `fireTriggers`/`routeTriggeredTest`** (§0.4) : l'attaque émet des triggers de données qui ouvrent des Tests cadence-aware ; vague 3 ou 4 ? Idem `checkFocusInterruption`, `fireOwnTestFailed`, `onGainCondition` (hook moteur `setConditionGainedHook`).
9. **Périmètre « un concept sur tous ses porteurs »** (credo) : critiques, `runHitModifiers`, `planifierLesCritiques`, `checkBattleOver`, `finalizeHeroDeath` sont partagés avec sorts/manœuvres/entretien ; migrer l'attaque seule laisse-t-il deux chemins pour les Projectiles ?
10. **#2763 et #1858** : l'absorber en vague 3 suppose de lever #1858 ou de sortir #2763 de la vague.
11. **UI mêlée à l'état de règles** dans `BattleState` (`action`, `preview`, `reachable`, `selectedAttack`, `handRaisedBy`, `endTurnArmed`, `stances`) : restent-ils dans le type du noyau ?
12. **Tests du noyau qui importent `state`** (§4) et gardes `purete-imports` : à trancher avec l'arête `noyau→state` types seuls restante.
