# Juge du design v3, vague 3 (#2817, #2889, épique #2882)

Arbre jugé : /home/user/game, branche `wip/2817-vague-3`, HEAD `662e46556`. `git diff --stat cf4f18bcf HEAD -- src` est vide. La pièce est présente : `docs/plans/2026-10-19-vague-3-attaque/design.md` (v3, 322 lignes), avec `sondes/` (5 sondes).
Sondes rejouées en lecture seule : `graphe.cjs` → `juge-v3/graphe.json` (5 s). `coupe.cjs`, `zones.cjs`, `importeurs.cjs` et `storeclo.cjs` sur la liste A du §1 (42 fichiers). Les chiffres du §1 sont retrouvés : A = 42 fichiers / 13 176 lignes, N = 124 / 55 188. La sortie de `coupe.cjs` est identique au §1, ligne pour ligne. La fermeture de `store.ts` donne 27 actions et 357 lignes, retrouvées aussi par une sonde TYPÉE (`storeacc.cjs` : 24 graines, dont `jouerAction` que la regex ne voit pas, même fermeture).
Sondes du juge : `/tmp/claude-0/-home-user-game/424b2429-c0ab-5191-a22b-3ce249f68bb5/scratchpad/juge-v3/` (`declclo.cjs`, `champs.cjs`, `typeclo.cjs`, `storeacc.cjs`, `storeraw.cjs`, `clo27champs.cjs`, `intents-probe.mts`).

## Verdict : REJETÉ (1 bloquant, 4 majeurs, 9 mineurs)

Ce qui tient :
- la méthode ;
- la fermeture des corps de déclaration d'ENTITÉ (B1 v2, côté attaque) ;
- `NetState` et `BattleActionMode` au noyau ;
- `EVT.SCENE_ENTREE` ;
- le chiffrage de 3c ;
- `detenteurDuCiblage` ;
- la suppression des réexportations ;
- l'absence de `vi.resetModules` dans la suite.

Ce qui casse :
- Le DÉPLACEMENT du héros et la déclaration sur CASE n'ont pas d'action du noyau. La reprise `:1590` (Peur, cas case) n'a donc pas de cible dans N, et la scission de D6 envoie la règle de mouvement dans A. C'est la classe même de B1, à moitié corrigée.
- La table des intentions de D9 est décrite à faux : `cascadeNext`, indispensable pour finir l'attaque, en serait exclu.
- La frontière `EtatDeJeu` / `EtatDeLAdaptateur` n'est pas mesurée : N écrit des champs que D5 range dans A.

## BLOQUANT

**B1. Déclaration sur case et déplacement : la reprise `combatSlice.ts:1590` reste sans action du noyau, et la scission range une règle dans A.**
- D6 envoie dans « une fabrique d'adaptateur » la plage `combatSlice.ts:944-1142`. Lue au code, cette plage contient :
  - `:946-1012`, la branche neutre de `battleClickTile`, c'est-à-dire le MOUVEMENT. On y trouve l'Engagement (LDB 15 l.45, `startDisengage`, `:950-953`), la Peur (LDB 21 l.27, `:973-974`), la Frénésie (LDB 21 l.33, `:977-983`), la Course à armer (`:986-1001`), le mouvement décomposable et l'empreinte (LDB 85 l.373-374) ;
  - `cancelMove` (`:1014-1037`, `clearApproachMoves` LDB 21 l.27, `loseNextMovement`) ;
  - la branche Tir rapide de `battleClickEntity` (`:1121-1126`, LDB 11 l.97-103).

  Le critère du §1 (« la règle va dans N ») est donc violé, et une partie hors store ne peut pas déplacer un héros.
- D4 ne nomme aucune action de mouvement. `declarerCase(pt, opts)` couvre « téléportation, poussée, pose de zone, sort sur case ». La reprise de la Peur sur case, `combatSlice.ts:1590` (`get().battleClickTile(pa.intent.pt, { confirm: true, courseArmee })`), rejoue un déplacement : elle n'a aucune action du noyau à appeler. En 3c, le type de D5 la refusera, puisque `battleClickTile` est une action de l'adaptateur. Le correctif `:1590` exigé par le verdict v2 n'est donc pas réalisé.
- `placingCommitCombatant` (`targetingModes.ts:812-815`), que D4 range dans N, appelle `get().battleClickTile({ ...t.pos })`, l'aiguilleur de A. Sonde `declclo.cjs`, `get().X(` des six corps : `battleAuContact battleClickTile battleGrapple battleManPoste faceFromPath log`.
- `declarerCase` est une seule action pour quatre modes. Elle doit donc choisir le mode, alors que D4 laisse l'aiguilleur (`currentTargetingMode`, `targetingModes.ts:963`) dans A. Il faut soit quatre actions, soit une sélection du mode dans N ; le design ne tranche pas.
- `batteryBlock` (`targetingModes.ts:229`) porte la règle d'arc et de bandes de portée (LDB 62 l.198-206, MDG). `battleShipBattery` (N) l'appelle (`combatSlice.ts:1426`), mais elle ne figure pas parmi les corps qui passent dans N. L'arc `combatSlice.ts:112 {batteryBlock}` n'a pas de résolution, et D6 liste `:1425` dans la fabrique d'adaptateur : la Bordée irait alors dans A.
- Correction :
  - la branche neutre de `battleClickTile` (`:946-1012`), `cancelMove` et la tête Tir rapide vont dans N, sous forme d'actions du noyau (`declarerDeplacement(pt, { confirm, courseArmee })` ou équivalent) ;
  - `:1590` appelle cette action ;
  - `placingCommitCombatant` appelle l'action de pose de zone du noyau ;
  - la déclaration sur case se fait par une action par mode, ou par une sélection du mode dans N à partir de `detenteurDuCiblage` et de `battle.action` ;
  - `batteryBlock` va dans N avec les corps ;
  - la plage de D6 est réécrite : seuls le curseur (`:1039-1115`), la caméra et les têtes d'aiguillage (`:928-945`, `:1117-1142`, sans les branches de règle) restent dans A.

## MAJEUR

**M1. D9 : l'union des intentions est décrite à faux, et elle exclut le geste qui finit l'attaque.**
- D9 dit « l'union des intentions est la liste de ses clés, ni `log` ni les actions internes (`cascadeNext`…) ». Sonde `intents-probe.mts` :
  ```
  cascadeNext true undefined     (GUEST_INTENTS.has, CLASSE_DES_ACTIONS[k])
  cascadeFinish true undefined
  battleClickEntity true invité
  log false interne
  GUEST_INTENTS 440 CLASSE keys 388
  { 'invité': 183, local: 24, 'hôte': 130, interne: 51 }
  ```
- `cascadeNext` est une intention d'invité dérivée (`flowVerbs.ts:125`, `resolution`), et c'est par elle que le joueur avance la cascade d'attaque (`ui/CascadeModal.tsx:144`). L'auto-avance vit dans l'UI (`CascadeModal.tsx:179`, `window.setTimeout`).
- Les « clés » de `CLASSE_DES_ACTIONS` contiennent `log` (classé `interne`) et ne contiennent pas les intentions dérivées. La définition se trompe donc dans les deux sens. Avec elle, la partie de 3e ne peut pas jouer l'attaque jusqu'à l'issue.
- La table est TOTALE sur les actions de `GameState` (`intents.ts:44-48`, `TableDesClasses`), adaptateur compris (24 `local`, 51 `interne`). Elle ne peut pas aller au noyau sans être scindée.
- `battleClickEntity` et `battleClickTile` sont des intentions `invité` (`intents.ts:77`), et elles sont les OUVREURS d'`attack`, `cast`, `maneuver`, `approach` et `ward` (`OUVERTURE_DES_FLUX`, `intents.ts:339-358`). Avec D4, ce deviennent des actions de l'adaptateur. Le design ne dit ni ce que l'invité envoie, ni ce que la table du noyau nomme pour ouvrir ces flux.
- Correction :
  - union = classes `invité` et `hôte`, plus les intentions dérivées (`coopFlowIntents`), sans `local` ni `interne` ;
  - la table est scindée entre noyau (sur `ActionsDuNoyau`) et adaptateur ;
  - l'ouverture des flux nomme les actions de déclaration ;
  - le protocole coop est dit : l'invité envoie l'action du noyau avec ses options, ou l'hôte garde un aiguilleur.

**M2. D5 : la frontière `EtatDeJeu` / `EtatDeLAdaptateur` est affirmée sans mesure, et elle est fausse pour les deux champs qu'elle cite.**
- Sonde `champs.cjs` (accès TYPÉS de N aux champs de `GameState`) :
  ```
  combatCursor <- state/combatCursor.ts | N: state/combatFlow.ts,state/combatSlice.ts
  localIntent <- state/localIntent.ts | N: state/combatFlow.ts,state/combatSlice.ts
  net <- state/netFlow.ts | N: ... netOwnership.ts ...
  ```
  `combatFlow.ts:7292` (`finishCombatEnd`) et `:7484-7485` (`advanceTurn`) ÉCRIVENT `combatCursor: null` et `localIntent: null`. D5 les range dans `EtatDeLAdaptateur` comme « champs que seul A touche ». En 3c, soit `Set` sur `Jeu` refuse ces écritures, soit leurs types (`CombatCursor`, `LocalIntent`, modules de A) restent dans le noyau, et l'arête `noyau → state` ne sort pas.
- Sonde `clo27champs.cjs`, sur les 27 actions qui descendent : `camPan` et `campaignSceneId` (`transitionTo`), `editingHeroId` (`setEditingHero`), `remisesDeDocument`. `transitionTo` écrit aussi `camEdge` (`store.ts`, `set` de `transitionTo`). Aucune de ces écritures n'est coupée.
- `stateFields.ts` (N) est le manifeste UNIQUE des champs transitoires, et il porte des champs d'interface : `hoverDelta` (`:49`), `sessionEndOpen` (`:76`). `resetFields('scene')` est appelé par `transitionTo`. Le design ne dit rien de la scission de ce manifeste.
- Fermeture transitive de type (`typeclo.cjs`) : les seuls types de A atteints sont `CombatCursor`, `LocalIntent`, `BattleActionMode` (avec la valeur `MODES_HORS_REGISTRE`, `actionRegistry.ts:548`, et la garde de parité `action-atteignabilite.test.ts:229`) et `NetState`.
- `Screen` dans `EtatDeJeu` n'est justifié qu'en partie. Les écritures citées par D5 sont réelles (vérifiées, ligne par ligne), mais `SCREENS` (`store.ts:196`) porte `editor`, `gallery`, `webglSpike`, `compendium`, `coop` et `test`, c'est-à-dire le shell web. Ce type d'interface entrerait dans la surface d'un hôte Godot.
- Correction :
  - mesurer les écritures de N et des 27 actions sur les champs d'interface, et les couper par des événements du bus (fin de tour, fin de combat, entrée de scène, que l'adaptateur écoute) ;
  - scinder `stateFields` par moitié d'état ;
  - restreindre le champ du noyau aux écrans que les règles posent (`campaign`, `interlude`, `massBattle`, `menu` après défaite), ou à une `phase` dont l'adaptateur dérive `screen` ;
  - dire que `BattleActionMode` emporte `MODES_HORS_REGISTRE`.

**M3. La partition ne suit pas encore son propre critère.**
- Fichiers de N sans lecteur de valeur dans N, et sans règle. Sortie d'`importeurs.cjs`, avec la lecture des en-têtes :
  - `sceneToAscii` (export de l'éditeur, lu par `devtools` et `ui`) ;
  - `stations` (« AUCUN effet de règle », lu par `gameIso` et `ui`) ;
  - `visibility` (politique de rendu, lu par `gameIso`) ;
  - `poste` (« modèle-VUE » de `PostesRoster`, lu par `ui`) ;
  - `advancement` (« Vue d'avancement (couche store/UI) », lu par `ui`) ;
  - `offreRendue` (« invariant d'AFFICHAGE ») ;
  - `offresUtilisables` (« PROJECTION vers la pastille », lu par `gameIso` seul). Ce fichier rangé dans A, l'arc `offresUtilisables.ts:24 {presetPnjById}` est sans objet.
  - `cascadeTestKit.ts` (« Kit de TEST… module de test, pas de périmètre runtime ») : le `/testkit/` sensible à la casse des sondes le compte dans N, et 3b le déménagerait, contre « les testkits restent dans `state` ». Son nom viole aussi la convention `.testkit.` (`scripts/guards/lib/fichierVitest.mjs:67-80`).
- Règles qui restent dans A :
  - `actionRegistry` (567 lignes, 13 réfs RAW) ;
  - `turnEconomy` (6 réfs RAW) ;
  - 9 actions de `store.ts` hors des 27, qui portent une réf RAW et un corps (sonde `storeraw.cjs` : `resolveTest(56) climbAcross(39) extendedTestNext(36) fallAcross(34) fallChoose(24) testSetActor(24) setPosteAmmo(21) corruptionSetNature(12) resolveCorruption(12)`, 258 lignes).

  D5 définit `ActionsDuNoyau` comme « les actions dont le corps porte une règle », mais 3c n'en descend que 27.
- Correction :
  - rejouer le critère sur ces fichiers et corriger les listes du §1 ;
  - 3c descend les 27 actions et les 9 ;
  - renommer `cascadeTestKit` en `cascade.testkit.ts` et le garder dans `state` ;
  - rendre les sondes insensibles à la casse (`/testkit/i`).

**M4. D7 et 3e : la suite principale collecte les deux tests hors store, et « une seconde pose lève » les fait échouer.**
- Sonde :
  ```
  node -e 'import("/home/user/game/scripts/guards/lib/racinesDeLaSuite.mjs").then(m=>{for(const f of ["src/noyau/partie.hors-store.test.ts","src/noyau/plateforme.hors-store.test.ts"]) console.log(f, m.estDeLaSuiteVitest(f))})'
  src/noyau/partie.hors-store.test.ts true
  src/noyau/plateforme.hors-store.test.ts true
  ```
- La suite principale (`vite.config.ts` : `setupFiles` → `src/test-setup.ts:96` importe le store, `isolate: false`) les jouera aussi :
  - le store a déjà appelé `brancherLeJeu`, donc le `creerPartie` du test LÈVE ;
  - « un appel sans plateforme posée lève » est faux là où le store a posé la plateforme.
- Le design ne prévoit ni l'exclusion (`RACINES_DE_LA_SUITE`, `scripts/guards/lib/racinesDeLaSuite.mjs:14-22`, #2651), ni la voie du lanceur. `npm test` passe par `scripts/test/run.mjs`, qui génère ses configurations à partir de `vite.config.ts` (`:277-289`, `:331`), et `test:perimetre` a sa dérivation (`scripts/test/perimetreDerivation.mjs`). « Lancé par `npm test` et la CI » n'est pas mesuré.
- Ce qui est mesuré et tient :
  - aucun `vi.resetModules`, `vi.isolateModules` ni `vi.doMock` dans `src/` (seule occurrence : un commentaire, `store.ts:206`) ;
  - `createCombatSlice` n'a qu'un appelant (`store.ts:1922`).

  Dans la suite principale, le store pose donc une seule fois par worker, et `brancherLeJeu` n'y lèverait pas.
- Correction : écrire au design l'exclusion de `*.hors-store.test.ts` de la suite principale, la voie de `run.mjs` et de la dérivation du périmètre, et le motif de nom que les deux reconnaissent.

## MINEUR

- **m1.** Le §1 dit « 18 arcs dans 8 fichiers, dont 9 dans `combatSlice` ». La sortie de la sonde, collée juste au-dessus, donne 18 arcs dans 11 fichiers, dont 7 dans `combatSlice` (`:12, :42, :43, :66, :110, :111, :112`). Correction : corriger la prose.
- **m2.** `IconId` : « `MANEUVER_ICON` et `REVEAL_ICON` passent du côté de leurs lecteurs de présentation » est faux. Leurs lecteurs sont dans N : `combatManeuvers.ts:252,267` (`availableAttacks`) et `revealStep.ts:53`. `ui/ManeuverModal.tsx:4` lit en plus `MANEUVER_ICON` par le baril `combatFlow`. Correction : typer ces tables `Record<…, string>` dans N, avec un test côté `ui` qui vérifie que chaque valeur est un `IconId`.
- **m3.** D10, régime des tests. Les inscriptions de test portent surtout des genres SYNTHÉTIQUES (`'deja'`, `'fenB'`, `'opens'`, `'sonde-1479'`, `KIND_INERTE`, `'note'` ×7, `'pick'` ×4…), et non des « entrées existantes ». Il n'est pas mesuré qu'un genre réel de même forme existe pour chacun. Le décompte oublie aussi `src/state/echec-sans-jet-appliers.test.ts:244-246`, qui échange `setOwnTestFailedEmitter`, un point d'injection que D7 transforme en import direct. Correction : inventaire par fichier, genre réel retenu, `vi.spyOn(table, cle).mockImplementation`.
- **m4.** D11. Supprimer « la garde, son stock et son test » perd aussi un invariant distinct : `targeting-holder-vs-mode.test.ts`, « tout détenteur possible est une fenêtre DÉCLARÉE au registre HORS_MODAL ». Il faut le porter en type ou en test. Par ailleurs, `placingZoneOf` dérivé de `detenteurDuCiblage` devient soumis à la priorité, ce qui change sa réponse quand `pendingCleave` et une pose de zone coexistent. Ses 7 sites (dont `gameIso/stage/ZdeTemplate.tsx` et `actionRegistry`) sont à nommer.
- **m5.** D7, liste des crochets qui « capturent le propriétaire ». Seuls `setConditionGainedHook` (`combatSlice.ts:417`) et `setClotureDeCascade` (`:520`, `dispatchCascadeDone` ferme sur `get`/`set`) capturent. `setTriggeredTestRouter`, `setOwnTestFailedEmitter`, `setFreeAttackHook`, `setFocusInterruptHook`, `setBladeTrapHook` et `setZoneCrossTestHook` reçoivent des fonctions de module. Correction : dire lesquels vont dans `brancherLeJeu` et lesquels deviennent un import direct.
- **m6.** D4, gardes de l'aiguilleur. `battleClickEntity` garde `battle.over`, `preemptAiming` et `controlsCombatant` (`combatSlice.ts:1118-1130`), et `battleClickTile` fait de même (`:928-932`). Les reprises et la partie appellent l'action du noyau directement. Ces gardes doivent donc descendre dans `declarerAttaque` et les autres actions de déclaration, sinon une partie déclare pour un héros en Auto-combat.
- **m7.** D9 :
  - le morceau 7 du pont (constantes de `ui/useAttackJetProps.tsx:35,83,273-277`) vit dans `ui`, et ne peut pas être « pris à sa source unique » depuis le noyau ;
  - `index.ts` est le seul baril légitime face à D2 : le dire ;
  - l'appartenance de `RollFlowActionsMap` à `ActionsDuNoyau` n'est pas écrite. Elle est nécessaire : `attackRoll`, `cascadeRoll`…
- **m8.** D12 amende le plan, qui disait de la vague 3 « dont #2763 » (`restructuration.md:206-207`). Le blocage « #1858 » est inscrit sur #2763 (« Bloqué par #1858 »), mais sans sonde positive collée (credo).
- **m9.**
  - Le §1 range `commitPlacedZone` parmi les corps de `targetingModes`, alors qu'il est déjà dans `combatFlow.ts` (N).
  - D6 `campaignData` : le résolveur pur existe déjà (`presetDuNarratif`, `campaignData.ts:42`). Le réutiliser plutôt qu'en créer un parallèle.
  - D5 cite « `codexFocus` (`store.ts:388`) », mais aucun champ de `GameState` ne porte ce nom (sonde `champs.cjs`). Les champs sont `compendiumFocus` et `codexOverlay`.

## Par critère

1. **Points du v2.**
   - B1 : partiel. Les entités sont closes (`declclo.cjs` : seule importation de A, `type GameState`). La case et le mouvement ne le sont pas (B1).
   - M1 : partiel (M2).
   - M2 : tient pour `autoSave`, `resetStageGestes`, `setAiTrace` et le chiffre (27/357 reproduit) ; ne tient pas pour `camPan` et `camEdge` (M2).
   - M3 : partiel (M3).
   - M4 : tient (m4).
   - M5 : tient.
   - M6 : tient sur le fond, mais pas la mise en œuvre de 3e (M4).
   - m1 : partiel (m1).
   - m2 : tient, sauf le trou de casse (M3).
   - m3 : faux (m2).
   - m4 : chiffré, mais non réalisable tel quel (m3).
   - m5 : partiel (M4).
   - m6 : tient.
   - m7 : faux (M1).
2. **B1.**
   - Corps d'entité : passent dans N sans arc de valeur vers A. Fermeture : seuls des imports N, `engine`, `data`, `noyau` et `i18n`, plus `type GameState`. Lecture d'état : `battle facing pendingCascade pendingCast scene`. `chargeArmee` n'est lu que par l'affordance (`:390`).
   - Reprises : `:595` (choix de monture), `:1591` (Peur, cas entité) et `:1613` (Bénédiction de Protection) tiennent avec `declarerAttaque`. `:1590` (Peur, cas case) ne tient pas.
   - Partie hors store : elle peut déclarer, et `afterApproach` passe par la plateforme. Elle ne peut pas finir l'attaque sans `cascadeNext` (M1).
3. **Partition.**
   - `zones.cjs` : hors A, seuls les deux arcs de type `IconId`.
   - Arcs que la sonde d'import ne voit pas : appels d'actions d'adaptateur (`:1590`, `targetingModes.ts:814`) et écritures de champs (M2).
   - Fichiers mal rangés : M3.
4. **D5.**
   - Le champ de N typé par A qui resterait : `combatCursor` et `localIntent`, écrits par `combatFlow`.
   - `Screen` : justifié en partie (M2).
5. **D7.**
   - Compatible avec la suite principale : une seule pose par worker, aucun `resetModules`.
   - Les tests qui posent eux-mêmes un crochet : `engine/derived-conditions.test.ts:268-279` reste valide (contrat du moteur) ; `echec-sans-jet-appliers.test.ts:244-246` est à réécrire (m3).
   - Les tests hors store, eux, sont incompatibles avec la suite principale (M4).
6. **D10 et D11** : réalisables. D11 suffit pour la divergence ; le régime de D10 n'est pas inventorié (m3, m4).
7. **Séquencement.**
   - 3a et 3b gardent le jeu jouable : la scission se compose au store, et le déménagement est mécanique.
   - 3c bute sur M2 et B1, ce que la re-mesure à la base de 3c découvrirait trop tard.
   - Aucun pont ni seconde implémentation. Une réexportation légitime : `index.ts` (m7).
   - Report : #2763 vers #2724 (m8). Les règles qui restent dans A sont renvoyées implicitement à la vague 7 (M3) : c'est dans l'épique, mais en contradiction avec le critère du §1.
8. **Affirmations sans mesure ou contredites :**
   - « champs que seul A touche » (M2) ;
   - « ni les actions internes (`cascadeNext`…) » (M1) ;
   - « lecteurs de présentation » d'`IconId` (m2) ;
   - « 8 fichiers, 9 dans `combatSlice` » (m1) ;
   - « lancé par `npm test` » (M4) ;
   - « espions sur une entrée existante » (m3).

## Non vérifié

- La compilation réelle d'`etat.ts` sous l'arête retirée. Trancherait : une sonde tsc sur un extrait d'`EtatDeJeu`.
- Le HMR de Vite : modifier `store.ts` en développement réévalue le module dans le MÊME contexte JS, et « seconde pose lève » casserait le serveur de dev. Trancherait : `npm run dev`, puis toucher `store.ts`, console observée.
- `poc/godot`.
- Les 438 appels `get().action()`, les ~25 sites de `presetPnjById`, et les 646 + 183 chemins de 3b : repris du juge v2, non recomptés.
- L'inventaire des registres remplis à l'import sous un autre nom que `register*` ou `set*Hook`. `registerCombatEndBandApplier` (`combatFlow.ts:6896`) est un relais local, couvert.
- L'évaluation unique du store par worker sous `isolate: false` : déduite statiquement, non jouée.

## Sondes (promouvables)

`intents-probe.mts` (lancer avec `npx tsx <chemin>`) :
```ts
import { GUEST_INTENTS, CLASSE_DES_ACTIONS } from '/home/user/game/src/state/intents';
for (const a of ['cascadeNext','cascadeFinish','cascadeResolveAll','cascadeRoll','battleClickEntity','battleClickTile','attackRoll','attackConfirm','log','commitCursor'])
  console.log(a, GUEST_INTENTS.has(a), (CLASSE_DES_ACTIONS as any)[a]);
console.log('GUEST_INTENTS', GUEST_INTENTS.size, 'CLASSE keys', Object.keys(CLASSE_DES_ACTIONS).length);
const c: Record<string, number> = {}; for (const v of Object.values(CLASSE_DES_ACTIONS)) c[v as string]=(c[v as string]??0)+1; console.log(c);
```
Sortie : voir M1.

`declclo.cjs` : identifiants libres des six corps `*Commit*` de `targetingModes.ts`, rapportés à leur import. Sortie : seule importation de A, `type ./store : GameState` ; `get().X( : battleAuContact battleClickTile battleGrapple battleManPoste faceFromPath log`.
`champs.cjs` et `typeclo.cjs` : accès typés de N aux champs de `GameState` (API TypeScript 6.0.2), puis fermeture transitive des types vers A. Sorties : M2.
`storeraw.cjs` : actions de `store.ts` hors des 27 qui portent une réf RAW. Sortie : M3.
`clo27champs.cjs` : champs d'interface touchés par les 27 actions. Sortie : M2.
Les chemins sont tous sous `/tmp/claude-0/-home-user-game/424b2429-c0ab-5191-a22b-3ce249f68bb5/scratchpad/juge-v3/`.
