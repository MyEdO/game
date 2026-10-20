# Vagues 3 et 4 (#2817, #2889) : l'orchestration au noyau — paragraphe de design v4 (2026-10-20)

Épique #2882 (« Restructuration : des couches à frontières tenues, un noyau de règles appelable par tout
hôte »), plan `docs/plans/2026-10-19-restructuration.md`. Historique : v1 (`23e511c12`) REJETÉE
(`verdict-du-juge.md`, 3 bloquants) ; v2 (`9036aa19b`) REJETÉE (`verdict-du-juge-v2.md`, 1 bloquant,
6 majeurs, 7 mineurs) ; v3 (`662e46556`) REJETÉE (`verdict-du-juge-v3.md`, 1 bloquant, 4 majeurs,
9 mineurs). Les trois juges ont gardé la méthode. La v4 la garde et corrige les 14 points de la v3 (§5)
en appliquant le critère du §1 à TOUT `src/state`, membres du store compris : la v3 l'appliquait aux
fichiers et à 27 actions du store, et ses écarts (déclaration sur case, intentions, champs d'interface)
venaient de là. Arbre mesuré : `origin/main` `cf4f18bcf` (`git diff --stat cf4f18bcf HEAD -- src` vide).

Sondes rejouables, dans `sondes/` :
- `graphe.cjs` (graphe d'import de FICHIERS de `src/`, valeur et type séparés) ;
- `coupe.cjs` (arcs de valeur de N vers A ou vers une zone d'hôte ; liste A en argument, virgules) ;
- `zones.cjs`, `importeurs.cjs`, `storeclo.cjs` (juge v2) ;
- `champs.cjs`, `typeclo.cjs`, `declclo.cjs`, `storeacc.cjs`, `storeraw.cjs`, `intents-probe.mts`
  (juge v3) ;
- `classes.mts` (classe coop de chaque action : `CLASSE_DES_ACTIONS`, plus les intentions dérivées) et
  `storeparts.cjs` (membres de l'objet de `create<GameState>` : lignes, classe, appels `get().X(`,
  clés écrites par `set`, imports de A utilisés) ;
- `inscriptions.tsv` (inscriptions de registre et poses de crochet dans les tests ; la commande
  `git grep` est en tête du fichier) ;
- `deplacer.cjs` (le codemod de 3b) ; `A.txt` (la liste A du §1).

Toutes reconnaissent un testkit sans égard à la casse (`/testkit/i`, M3 v3). Lancement :
`node sondes/graphe.cjs <racine> > graphe.json`, puis
`GRAPHE=$PWD/graphe.json node sondes/coupe.cjs "$(cat sondes/A.txt)"`.

Mandat : laurent, verbatim (2026-10-19) : « Enfin pour etre précis le ticket a faire de bout en bout
c'est 2882, la 2817 c'est juste un des sous tickets ». L'épique entière est dans le périmètre.

## 1. Ce que la mesure dit

**Critère de partition** de `src/state` (165 fichiers non-test, plus les MEMBRES de `store.ts` et de
`combatSlice.ts`, rangés un par un) :
- va dans **N (le noyau)** ce qui porte une règle (une réf RAW, une transition de l'état du jeu) ou ce
  qu'un élément de N lit en valeur ;
- va dans **A (l'adaptateur web)** ce qui ne porte qu'un état d'interface, un service web ou la
  persistance, et que seuls A, `ui` ou `gameIso` lisent ;
- un fichier qui mêle les deux se SCINDE ;
- « lu par N » s'évalue APRÈS la descente des actions du store (ci-dessous) : un module que seules des
  actions du store lisent aujourd'hui (`sceneInstance`, `dialogueHistory`, `climbMove`, `innFlow`…) est
  lu par N.

**Fichiers.** A = 42 fichiers, 11 760 lignes ; N = 123 fichiers, 56 396 lignes (`sondes/A.txt`).
- A, le store et la persistance : `store` (sa part d'adaptateur, ci-dessous), `saves`, `roster`,
  `preferences`, `keybindingsPrefs`, `houseRules`, `projectLibrary`, `traceLayer`, `traceCalibration`,
  `editorAutosave`, `campaignData` (sa lecture du store ; ses résolveurs purs vont dans N, D6),
  `formats.generated`.
- A, la coop : `netFlow`, `intents` (jusqu'à 3e, D9).
- A, l'outillage : `devtools`, `devtoolsTimers`, `scenarioFlow`, `validateScene`, `dialogueLibelle`,
  `mapQC`, `sceneToAscii` (export de l'éditeur).
- A, l'état d'interface : `combatCursor` (avec la fabrique du curseur, D4), `clavier/keybindings`,
  `clavier/resoudreEchap`, `registreOffres`, `hotbarBridge`, `editeurBridge`, `mapHover`, `stagePan`,
  `stageYaw`, `stageGestes`, `stageWalk`, `entreeEnScene`, `viewLevel`, `codexFocus`, `dismissStack`,
  `dispositionConsole`, `stations` (« AUCUN effet de règle »), `visibility` (politique de rendu),
  `offreRendue` (« invariant d'AFFICHAGE »), `offresUtilisables` (« PROJECTION vers la pastille »),
  `poste` (« modèle-VUE », « jamais la mécanique de résolution »).
- N : tout le reste. Changent de côté par rapport à la v3 :
  - `targetingModes`, `targeting`, `actionRegistry`, `turnEconomy` passent ENTIERS dans N : ils portent
    38, 3, 13 et 8 réfs RAW, et le critère ne les scinde pas (leurs affordances disent quelle cible est
    LÉGALE, ce dont tout hôte a besoin) ;
  - `localIntent` va dans N, avec les champs `dispelCarrierId` et `refus` : ce sont les trois champs de
    jeu PAR SIÈGE (D5) ;
  - `combatAuto` se scinde : `tickCombatAuto`, `JET_AUTO` et `willAutoResolve` dans N (lus en valeur
    par `combatSlice.resumeCadence`, `combatSlice.ts:1819`) ; `initCombatAuto` (l'abonnement à
    `useGame`, `combatAuto.ts:239-245`) dans A ;
  - `advancement` reste dans N : la règle de disponibilité (cumul des niveaux ≤ courant, talents du
    niveau courant, `LDB 07 l.43/76/103`) s'applique ICI (`advancement.ts:117-125`), le moteur n'en
    fournit que les coûts ;
  - `cascadeTestKit` n'est pas un fichier de N mais un testkit (M3 v3) : il devient
    `cascade.testkit.ts` (convention `scripts/guards/lib/fichierVitest.mjs:67-80`) et reste dans
    `state`.

`importeurs.cjs` sur cette liste : les fichiers de N sans lecteur de valeur dans N sont tous lus par une
action du store qui descend, ou portent une règle (`jumpMove`, 3 réfs, lu par `gameIso`) ; aucun n'est
un fichier d'interface.

**Arcs de VALEUR de N vers A ou vers une zone d'hôte** (sortie brute de `coupe.cjs` sur `sondes/A.txt`) :
```
-> web/minuteries.ts 4
    combatAuto.ts:27 {scheduleCombatTimer}
    combatDirector.ts:16 {scheduleCombatTimer}
    combatFlow.ts:19 {scheduleCombatTimer}
    enchainerEtape.ts:2 {scheduleFlowTimer}
-> state/store.ts 3
    actionRegistry.ts:17 {canMove,entityPickables,activeCombatant}
    combatAuto.ts:19 {useGame}
    seaVoyageFlow.ts:51 {registerScene}
-> state/campaignData.ts 3
    combatEffects.ts:29 {trappingById,indiceById,documentById}
    combatSlice.ts:66 {trappingById}
    sceneNpc.ts:12 {nomDePreset,presetPnjById,resolvePresetCreature}
-> state/combatCursor.ts 2
    combatSlice.ts:110 {nextCursorTile,nextCaseCursorTile,tileModeValidTiles,cursorCommitIntent}
    exploreNav.ts:7 {screenStepDot}
-> state/stageYaw.ts 1
    combatSlice.ts:42 {viewYawDeg}
-> state/roster.ts 1
    partyFlow.ts:47 {rosterUpdate}
```
Soit 14 arcs dans 11 fichiers, dont 3 dans `combatSlice`. Arcs de TYPE vers une zone fermée au noyau
(`zones.cjs`) : `IconId` dans `combatManeuvers:43` et `revealStep:10`, rien d'autre. Paquets en valeur :
`zod` (2 sites), ouvert à toute zone.

**Le store** (`storeparts.cjs`) : l'objet de `create<GameState>` (`store.ts:1921-3290`) porte 235
actions, 1 161 lignes, pour la plupart des délégations d'une ligne vers un flux de N.
- **34 actions d'adaptateur (90 lignes)** : la caméra et la vue (`rotateCam`, `setZoom`, `setCamPan`,
  `resetCamPan`, `toggleViewMode`, `togglePov`, `setReveler`) ; la fiche, l'inspection et le survol
  (`setInspectId`, `setSheetId`, `setSheetTab`, `setSheetScroll`, `setSheetAlarmsSeen`,
  `setHoverCombatant`, `setHovered`) ; les touches (`setKeyBinding`, `resetKeyBindings`) ; les écrans du
  shell (`setScreen`, `setEditingHero`, `openCodex`, `closeCodexOverlay`, `openPossessionsScreen`,
  `closePossessionsScreen`, `setGameMenu`) ; la coop (`netHostStart`, `netJoin`, `netLeave`,
  `netAssign`, `setGmSeat`, `netAssignSlot`) ; la persistance (`saveGame`, `autoSave`, `loadGame`,
  `importGame`) ; le pas d'exploration relatif à l'écran (`stepPartyDir`, qui lit `viewYawDeg`).
  S'y ajoutent les 4 actions du curseur de `combatSlice` (D4).
- **201 actions de noyau (1 071 lignes)** : toutes les autres. Ce qui les relie encore à A : un appel
  (`transitionTo` → `autoSave`, `store.ts:2407`), un import (`resetStageGestes`, dans `startScene` et
  `transitionTo`, `:2402`), et `presetPnjById` (`interactEntity`, `jouerAction`, `chooseDialogue`).
  Elles emportent 5 déclarations de premier niveau (`sceneRegistry`, `placesDe`, `seLeverDe`,
  `sasseoirA`, `JOUER_CAPACITE`).
- Appels d'actions d'adaptateur depuis les fichiers de N (`git grep` des 34 noms sur N) :
  `combatEffects.ts:1543` (`setEditingHero(null)`, `setScreen('creator')`) et `targetingModes.ts:864`
  (`dispelSelectCarrier`, qui est une action de noyau avec son champ, D5).

**Les champs** (`champs.cjs`, filtré aux 150 champs réels de `GameState`, initialisés au store ou au
manifeste `stateFields`) :
- 26 champs d'interface : `zoom`, `povActive`, `camRot`, `camEdge`, `camPan`, `viewMode`,
  `debugLabels`, `debugRoofCut`, `reveler`, `inspectId`, `sheetId`, `sheetTab`, `sheetScroll`,
  `sheetAlarmsSeen`, `hoverCombatantId`, `hovered`, `hoverDelta`, `keyOverrides`, `editingHeroId`,
  `gameMenuOpen`, `codexOverlay`, `compendiumFocus`, `compendiumReturn`, `possessionsScreen`,
  `combatCursor`, et le champ neuf `ecranDuShell` (D5) ; `compendiumReturn` disparaît en 3c (D5) ;
- leurs accès par N, tous coupés en D4, D5 et D6 :
  - `combatCursor` écrit par `combatFlow.ts:7292` (`finishCombatEnd`) et `:7484` (`advanceTurn`) ;
  - `hoverDelta` écrit par `combatSlice.ts:964, 995, 1005, 1029, 1322, 1328, 1371` ;
  - `camEdge`, `camPan` écrits par `transitionTo` (`store.ts:2399-2400`) ;
  - `camRot`, `zoom`, `viewMode`, `povActive` recopiés par `startScene` (`store.ts:2287-2291`) ;
  - `editingHeroId` écrit par `combatEffects.ts:1543` ;
  - `camRot`, `viewMode`, `camEdge` lus par `moveCursor` (`combatSlice.ts:1063`), qui passe dans A ;
- 124 champs de jeu, dont trois PAR SIÈGE, hors snapshot coop et préservés chez l'invité :
  `localIntent`, `dispelCarrierId`, `refus` (`netFlow.ts:110, 114, 118`, puis `:171-173`) ;
- `stateFields.ts` porte un champ d'interface, `hoverDelta` (`:49`). `sessionEndOpen` (`:76`), que la v3
  rangeait aussi dans l'interface, est de jeu : il ouvre la Fin de séance (effet de scène
  `combatEffects.ts:1538`, puis `partyFlow.endSession`, qui porte la remise de la Fortune de séance,
  `engine/fortune.ts:24`).

**Les écrans** : `SCREENS` (`store.ts:196`) a 12 valeurs. Les règles et les flux en posent six : `menu`
(défaite, `store.ts:2853`), `party`, `creator` (effet de scène), `campaign`, `interlude`
(`interludeFlow.ts:220, 1440, 1462`), `massBattle` (`massBattleFlow.ts:305, 308, 831, 865`). Les six
autres sont le shell web : `editor`, `test`, `coop`, `compendium`, `gallery`, `webglSpike` (8 lectures
hors test : `ui/App.tsx` ×5, `store.ts` ×2, `clavier/keybindings.ts` ×1 ; 6 `setScreen` de ces valeurs).

**Les intentions** (sonde du juge v3) : `CLASSE_DES_ACTIONS` a 388 clés (`invité` 183, `hôte` 130,
`local` 24, `interne` 51), `GUEST_INTENTS` 440. `cascadeNext` et `cascadeFinish` sont des intentions
dérivées (`coopFlowIntents`). `interne` compte des gestes de joueur émis par le clavier (`moveParty`,
`battleArmIntent`, `stepPartyDir`, `intents.ts:284-288`).

**Les tests qui inscrivent** (`inscriptions.tsv`) : 108 sites dans 38 fichiers (`register*`,
`spyApplier`, `set*Hook|Emitter|Router`). Les genres y sont surtout SYNTHÉTIQUES : les tests du socle
(`noyau/cascade.test.ts` 25 sites, `cascade-batch-socle`, `cascade-table-step`, `combatHooks.test`,
`sequence-*`) éprouvent la machinerie elle-même.

**Trous des sondes** (comparées au mur `arcsDImport.mjs`) : ni `require`, ni `import.meta.glob`, ni
`vi.mock`, testkits exclus. Mesuré : aucun import à effet de bord dans `state` ; aucun `require` ni
`import.meta.glob` dans un fichier non-test de N.

**Réexportations du périmètre** : `store.ts:218` (`export * from '../noyau/pendings'`, « pour la
compat »), `store.ts:49` et `:54` (que lit `actionRegistry.ts:17`), le baril `combatFlow.ts:246-286`,
`portFlow.ts:481`, `spawn.ts:80`, `combatManeuvers.ts:310`, `rollFlowSpecs.ts:2100`.

## 2. Décisions

**D1. Où.** `src/noyau/` (H1 du plan). `src/engine` reste la bibliothèque de règles sans état (règle 3
d'`AGENTS.md`) ; le noyau enchaîne ces règles sur l'état du jeu. `docs/architecture.md` § Frontière
orchestrateur · machinerie · data-driven : `fireTriggers` et `registerCombatHook` sont de
l'orchestration, donc au noyau. Tranchent les arbitrages cités au plan (2026-10-18 : « Mettre le code au
bon endroit ca ne me semble pas une mauvaise chose a faire non plus » ; « Il n'est pas interdit de
bouger le code mal placé en tout cas. »), et `user-doctrine-un-hote-jamais-duplique` pour le nommage.

**D2. Méthode : par mécanisme, pas par famille de flux** (amende H3 du plan). On coupe d'abord les arcs
de N vers A et vers l'hôte (§1) ; N déménage ensuite d'un bloc dans le noyau ; puis le type de l'état,
les actions et les registres se ferment dans le noyau. Aucun échafaudage transitoire, aucun
fichier-pont, **aucune réexportation** hors `src/noyau/index.ts` (D9) : celles du §1 sont supprimées en
3b (celles de `store.ts:49,54` dès 3a, pour couper l'arc d'`actionRegistry`), leurs importeurs réécrits
vers le module qui déclare, et le baril `combatFlow` se dissout (son effet de bord d'inscription tient
jusqu'en 3d par des imports explicites `import './x'` dans `store.ts`). H3 garde son invariant, jamais
deux implémentations d'une même règle. Garde de la méthode : `murs/purete-imports` refuse tout arc de
valeur `noyau → state`.

**D3. L'état : le noyau mute, il ne rend pas une copie** (amende le But de #2817, la ligne `noyau` du
§3.1 et le §3.2 du plan). Raison : le moteur mute les combattants en place (`applyOps`,
`addCondition`) ; réécrire l'orchestration en `(état) → nouvel état` réécrirait le moteur. Le noyau
garde le couple `get`/`set` ; ce qui disparaît de la surface offerte aux hôtes, c'est le store. Un hôte
externe reçoit une **partie** (D9), propriétaire de l'état au même titre que le store web.

**D4. La déclaration des gestes reste aux actions du noyau `battleClickEntity` et `battleClickTile`**
(B1 v2 et v3). `targetingModes` (son aiguilleur `currentTargetingMode` `:963`, ses six commits, ses
affordances, `batteryBlock` `:229`), `targeting` et `combatOrParty` (`combatantClickActs`) sont dans N.
Les deux actions de clic restent entières dans N : le mouvement neutre (`combatSlice.ts:946-1012` :
Engagement, Peur, Frénésie, Course), `cancelMove` (`:1014-1037`), la tête Tir rapide (`:1121-1126`), les
gardes `battle.over`, `preemptAiming`, `controlsCombatant` (`:928-932`, `:1118-1130`) et la sélection du
mode. Conséquences :
- `:1590` (Peur, cas case), `:1591`, `:595`, `:1613` et `targetingModes.ts:814` appellent une action
  du noyau, comme aujourd'hui ;
- le verdict d'armement (`opts?.courseArmee ?? courseArmee(get)`, `:939` ; `chargeArmee`, `:1136`) lit
  `localIntent`, champ de jeu PAR SIÈGE (D5) : un hôte solo arme sa Course par `battleArmIntent`
  (action de noyau, `:1104-1112`), un invité joint son verdict aux arguments comme aujourd'hui
  (`localIntent.argsAvecVerdictLocal`, `netFlow.ts:209`) ;
- le protocole coop ne change pas : l'invité envoie `battleClickEntity`/`battleClickTile` et leurs
  options, ouvreurs des flux `attack`, `cast`, `maneuver`, `approach`, `ward` (`intents.ts:338-358`) ;
- seul le CURSEUR clavier et manette passe dans A : `moveCursor`, `snapCursorToTarget`, `commitCursor`
  (`combatSlice.ts:1062-1099`) et `clearCursor` (`:1113-1115`) forment une fabrique d'adaptateur
  `creerActionsDuCurseur(get, set)` dans `combatCursor.ts`, qui lit la caméra (`viewYawDeg`) et appelle
  les deux actions de clic. Les arcs `combatSlice.ts:42` et `:110` partent avec elle.

**D5. Le type de l'état et des actions sort du store** (M3 v1, M1 v2, M2 v3). `src/noyau/etat.ts`
déclare :
- `EtatDeJeu` : les 124 champs de jeu du §1. Leurs types vont au noyau avec eux : `BattleActionMode`
  et sa valeur `MODES_HORS_REGISTRE` (`actionRegistry.ts:548`, que garde
  `action-atteignabilite.test.ts:229`) suivent `actionRegistry` dans N ; `LocalIntent` suit
  `localIntent` ; `NetState` (`store.ts:890`), que `netOwnership` lit pour la possession, va au noyau ;
- `CHAMPS_DU_SIEGE = ['localIntent', 'dispelCarrierId', 'refus']`, liste unique des champs de jeu par
  siège, que `netSnapshot` et `applyNetSnapshot` lisent au lieu de leurs trois lignes chacun
  (`netFlow.ts:110-118`, `:171-173`) ;
- `ActionsDuNoyau` : les 201 actions de jeu de `store.ts`, `combatSlice` sans le curseur, et
  `RollFlowActionsMap` (`attackRoll`, `cascadeRoll`…, `rollFlowSpecs.ts:2131-2134`), créées par des
  fabriques du noyau `(get, set) => actions` (la forme de `createCombatSlice`) ; `dispelSelectCarrier`
  y entre avec son champ ;
- `Jeu = EtatDeJeu & ActionsDuNoyau` ; `Get = () => Jeu`, `Set`, `PatchDeFlux`, `RemplacerLEtat`
  (`flowTypes.ts` va au noyau, typé sur `Jeu`).

Le store compose `GameState = Jeu & EtatDeLAdaptateur & ActionsDeLAdaptateur` ; `EtatDeLAdaptateur`
porte les champs d'interface, `ActionsDeLAdaptateur` les 34 actions et le curseur. `create<GameState>`
accepte l'intersection ; le `set` du store se passe en `Set` sur `Jeu` par contravariance, comme
`createCombatSlice` aujourd'hui. Le compilateur refuse dès lors qu'un module du noyau lise ou écrive un
champ d'interface ou appelle une action d'adaptateur. Les accès du §1 se coupent ainsi :
- `combatCursor` : `advanceTurn` émet `EVT.TOUR_ACHEVE` ; toute issue de combat émet `EVT.BATTLE_OVER`
  (aujourd'hui la seule victoire, `combatFlow.ts:7236` ; la défaite l'émet avec `victory: false`, que
  `audio/wiring.ts:54-56` ignore déjà) ; l'adaptateur remet le curseur à `null` sur les deux ;
- `hoverDelta` : les sept remises à `null` de `combatSlice` disparaissent ; le survol le recalcule de
  lui-même, son effet dépendant de `battle` (`gameIso/stage/useHoverTargeting.ts:206-219`) (H-d) ;
- caméra et gestes de scène : `transitionTo` et `startScene` émettent `EVT.SCENE_ENTREE { sceneId,
  neuve }` ; l'adaptateur y remet `camEdge` et `camPan`, garde `camRot`, `zoom`, `viewMode`, `povActive`
  d'une partie neuve à l'autre (ce que fait `startScene`, `store.ts:2287-2291`), appelle
  `resetStageGestes`, et sur `neuve: false` sauvegarde (`autoSave`). Un hôte qui ne sauvegarde pas n'y
  abonne rien ;
- `combatEffects.ts:1543` (« nouveau héros ») émet `EVT.HEROS_A_CREER` ; l'adaptateur ouvre le créateur
  (`setEditingHero(null)`, `setScreen('creator')`) ;
- `stateFields` se scinde par moitié d'état : le manifeste du noyau (typé sur `keyof EtatDeJeu`, d'où
  `PendingKey` dérive toujours) et celui de l'adaptateur (`hoverDelta`) ; le store étale les deux
  `initialFields()`, `transitionTo` remet le premier, l'adaptateur le second sur `EVT.SCENE_ENTREE`.

**Les écrans.** Le noyau porte `screen: EcranDuJeu`, union des six écrans que les règles et les flux
posent (`menu`, `party`, `creator`, `campaign`, `interlude`, `massBattle`), déclarée au noyau.
L'adaptateur porte `ecranDuShell: EcranDuShell | null` (`editor`, `test`, `coop`, `compendium`,
`gallery`, `webglSpike`) ; l'écran affiché est `ecranDuShell ?? screen` (`ui/App.tsx`) ; `setScreen`
(adaptateur) range sa valeur dans le bon champ ; `compendiumReturn` disparaît (fermer le shell rend
l'écran du jeu). `ecranDuShell` est PAR CLIENT, hors snapshot. L'arbitre garde `ecranPlein` sur le seul
`screen` du jeu (`modalArbiter.ts:332`) (H-e).

**D6. Services de plateforme et coupes** (M2 v1, M2 v2). `src/noyau/plateforme.ts` déclare ce que le
noyau demande à l'environnement d'exécution : `programmer(suite, délai, portée)` et `annuler(jeton)`
(`combatFlow:19`, `combatDirector:16`, `enchainerEtape:2`, `combatAuto:27`), et `persisterLeHeros(heros)`
(`partyFlow:47`). Le mot « plateforme » évite la collision avec l'hôte de jet (`hostStep`). L'adaptateur
web la pose à la création du store et relaie vers `web/minuteries` et `roster` ; un appel sans
plateforme posée LÈVE. Le reste :
- le bus (`state/bus.ts`, émetteur pur) déménage au noyau tel quel en 3a ; ses événements neufs
  (`TOUR_ACHEVE`, `SCENE_ENTREE`, `HEROS_A_CREER`) naissent en 3c avec leurs émetteurs ;
- `campaignData` : ses résolveurs prennent le narratif en argument, sur le patron qui existe déjà,
  `presetDuNarratif` (`campaignData.ts:42`) ; ils passent dans N avec `mergeCreatureProfile` et
  `nomDePreset`. Les sites appelants (~25, dont `nomDEntite(ent, presetPnjById)`) passent
  `presetDuNarratif(get().campaignNarratif)` ; la lecture du store reste dans A pour ses lecteurs
  d'`ui` ;
- `registerScene` (`store.ts:202`, avec `sceneRegistry` et `resetSceneRegistry`) passe dans N ;
- `exploreNav.ts:7` (`screenStepDot`) : la règle reçoit le pas d'écran de son appelant d'A
  (`stepPartyDir`) ;
- `actionRegistry.ts:17` importe `canMove`, `entityPickables` et `activeCombatant` de leurs modules
  (`mount`, `combatFlow`) ;
- `combatAuto` se scinde (§1) ; `initCombatAuto` reste appelé par `main.tsx`, depuis un module d'A ;
- `IconId` (m2 v3) : un id d'icône se type `string` dans N, convention d'`engine`
  (`src/engine/types.ts:180-183`) et du noyau (`cascade.ts:1219,1932`, `pendings.ts:486,2084,2302`,
  `rollSeam.ts:220,272,436`). `MANEUVER_ICON` (`combatManeuvers.ts:156`) et `REVEAL_ICON`
  (`revealStep.ts:13`) deviennent `Record<…, string>` dans N ; leurs littéraux restent vus par la garde
  de build `ui/no-phantom-icon.test.ts`, qui balaie `src/state` et `src/noyau` contre `ICON_DEFS`
  (`SCAN_DIRS`, `:22`) ;
- `setAiTrace` (`ai.ts:62`) reste avec `ai.ts` dans N ; `devtools` (A) l'appelle, arc A → N ouvert.

**D7. Crochets liés au propriétaire de l'état** (M6 v2, m5 v3). Deux points d'injection capturent le
`get`/`set` du propriétaire : `setConditionGainedHook` (`combatSlice.ts:417`) et `setClotureDeCascade`
(`:520`, `dispatchCascadeDone` ferme sur `get`/`set`). Règle :
- une seule fonction du noyau, `brancherLeJeu(get, set)`, pose ces deux-là ; le store l'appelle à sa
  création, la partie à la sienne, `debrancherLeJeu()` les retire ; une seconde pose sans retrait LÈVE
  (un seul propriétaire par contexte JS, H-a) ;
- au rechargement à chaud de Vite, le module du store réévalué dans le même contexte poserait une
  seconde fois : `store.ts` déclare `import.meta.hot?.dispose(debrancherLeJeu)` ;
- `onConditionGained` garde le contrat du moteur, « Absent ⇒ aucune réaction »
  (`engine/conditions.ts:99-103`) : c'est le noyau qui garantit la pose ;
- les autres reçoivent des fonctions de module et deviennent des IMPORTS DIRECTS en 3d, leur code étant
  au noyau : `setTriggeredTestRouter`, `setOwnTestFailedEmitter`, `setFreeAttackHook`,
  `setFocusInterruptHook`, `setBladeTrapHook`, `setZoneCrossTestHook` (`combatSlice.ts:418-433`),
  `setSuiteApresCommit` (`combatEffects.ts:782`). `echec-sans-jet-appliers.test.ts:244-246`, qui
  échange l'émetteur, observe l'émission par `vi.mock` du module `noyau/triggeredEffects`
  (`fireOwnTestFailed`, `:508`) ;
- le siège agissant (`actingSeat`, `netOwnership.ts:115-129`) : la partie pose le `siege` de
  l'intention par `withActingSeat`, la primitive existante.

**D8. Entrées de la partie : dés, règles maison, cadence, dés fixés** (M4, M6 v1). Elles existent déjà en
variables de module : `seedBattleRng` (`noyau/battleRng.ts`), `loadRuleOverrides`
(`engine/policy.ts:137`), `setCadence` (`engine/cadence.ts:22`), `desFixes()` (`engine/fixedDie.ts`).
`creerPartie` les pose depuis ses entrées ; l'adaptateur web les pose comme aujourd'hui. Singletons par
contexte JS (H-a), ce qui amende la formule du plan §4 (« entrées fournies par l'hôte ») : fournies par
l'hôte, oui ; passées à chaque appel, non. Les défauts silencieux `rng = defaultRNG` (34 appels de
production et 295 de tests sans RNG, 71 fichiers) sont retirés sur toute la classe par le lot 3h.

**D9. La surface : `src/noyau/index.ts` et la partie** (M1 v3, m7 v3). `creerPartie(etatInitial,
entrees)` rend `{ etat(), envoyer(intention) → evenements, reprendre(jeton) → evenements, fermer() }`.
- **L'intention** : `{ type: K, args: Parameters<ActionsDuNoyau[K]>, siege? }` pour toute clé `K` de
  `ActionsDuNoyau`. La partie est propriétaire de l'état, comme le store web dont l'interface appelle
  toute action ; la classe coop ne borne donc pas l'union : `interne` compte des gestes de joueur
  (`moveParty`, `battleArmIntent`, §1). `cascadeNext`, `cascadeFinish`, les délégués et la `resolution`
  des flux y sont, puisque ce sont des actions du noyau.
- **Le siège** : sans `siege`, le propriétaire agit ; avec un `siege`, `envoyer` applique la règle de
  l'hôte coop (`GUEST_INTENTS`, puis `intentAllowedFor`, la même que `netFlow.applyIntent`) et pose le
  siège (D7). Un hôte à plusieurs joueurs a donc la possession de la coop web, sans la recoder.
- **La table des classes se scinde en 3e** : `TableDesClasses` est déjà générique sur l'état
  (`intents.ts:70`). Le noyau porte `CLASSE_DES_ACTIONS_DU_NOYAU satisfies TableDesClasses<Jeu>`, avec
  `ELECTIONS_LOCALES`, `OUVERTURE_DES_FLUX` et `GUEST_INTENTS` (toutes ses entrées sont des actions du
  noyau) ; l'adaptateur porte la table de ses 38 actions (`local`, `hôte`, `interne`) ; `netFlow` et
  `intents.test.ts` lisent les deux. La totalité reste gardée des deux côtés par le type.
- La partie s'abonne au bus pour rendre les événements, pose une plateforme dont `programmer` rend un
  jeton au lieu d'armer un délai, appelle `brancherLeJeu`, pose les entrées (D8). `fermer()` débranche.
- `index.ts` est le SEUL baril légitime de `src/noyau` (D2). Il exporte la partie, les types
  d'`EtatDeJeu`, d'`ActionsDuNoyau` et de l'intention, et les lecteurs purs dont un hôte a besoin pour
  montrer une fenêtre, chacun pris au module qui le déclare : les six premiers morceaux de
  `docs/plans/2026-10-19-modale-attaque-godot.md` (`previewAttack`, `defenseDodgeMods`,
  `rederiveAttack`, `opReroll`, `opBonusSL`, la re-résolution de l'attaque), rendus appelables sans
  store par 3c ; pour le septième, la donnée seule (`HitLocation` du moteur, le modificateur de la
  localisation visée par la table des règles chiffrées, `modDeRegle`) : les intitulés (« Attaque »,
  « Au hasard ») sont de la présentation, que chaque hôte écrit dans sa langue
  (`ui/jetProps/useAttackJetProps.tsx:88,253`).

**D10. Registres fermés** (M5 v1, m4 v2, m3 v3). Une fois le code au noyau, chaque registre rempli à
l'import devient une table statique typée par une union fermée (plan §3.2) : `registerCascadeApplier`,
`registerCascadeTableFold`, `registerTableStep(Family)`, `registerCascadeSuccessRule`,
`registerExtendedTestOutcome`, `registerCombatHook`, `registerHitModifier`, `registerCloture` (les 6
verbes posés par `store.ts` qui touchent l'adaptateur deviennent des événements du bus),
`registerCastSpellEffect`, `registerNightBandApplier`, `registerSequence*`, `registerPerilInterrupt`,
`registerEtalGenerateur`, `setManeuverPostHitHook`. Une table qui référence des fonctions de modules en
cycle est construite au premier accès (aucun code de premier niveau ne l'appelle), ce qui évite la zone
morte des `const` en cycle. Le `ReferenceError` relevé par #2817 (« Combat : résoudre et appliquer une attaque sans le store ») disparaît d'abord parce que le store
sort de la fermeture du noyau (3b, 3c), puis parce que plus rien ne s'inscrit à l'import.

Régime des tests (inventaire `inscriptions.tsv`, 108 sites, 38 fichiers) :
- une entrée de production ne s'inscrit plus : elle est déclarée dans sa table ;
- un test qui observe un genre RÉEL l'espionne par `vi.spyOn(TABLE, genre)` ;
- un test du SOCLE, qui éprouve la machinerie sur un genre SYNTHÉTIQUE (la majorité de l'inventaire),
  pose son entrée par l'unique seam de banc `poserEntreeDeBanc(table, cle, entree)` de
  `src/noyau/tables.ts`, qui rend sa restauration (« un régime se POSE par le seam sur une fixture,
  puis se restaure », `.claude/rules/tests.md`) ;
- l'instantané des registres de `test-setup.ts:100,462,481-482` disparaît : les tables ne changent plus
  entre deux tests que par ce seam, qui restaure.

**D11. Gardes qui changent** (M4 v2, m4 v3). Toute garde, lint ou générateur qui nomme un chemin
déplacé le suit (patron du lot 2b) ; `combat-event-port-guard` : sa WHITELIST de 6 chemins
(`combat-event-port-guard.test.ts:24-31`) suit au noyau, sans entrée neuve.
`targeting-holder-vs-mode` confronte deux prédicats jumeaux (`targetingHolder.ts:26-33` ⇄ la tête de
`currentTargetingMode`, `targetingModes.ts:965-969`). 3a pose la structure qui rend la divergence
impossible :
- `detenteurDuCiblage(s)` rend, dans l'ordre de priorité : le balayage ou la deuxième frappe (si
  `!pendingAttack && coupFerme(s)`), la Surincantation (`pendingCast.pickingTargets`), la pose de zone
  (`placingZoneOf(s)`, source `cast` ou `siege`) ;
- `targetingHolder` en dérive (balayage et deuxième frappe à l'identique ; `pendingSiegeAim` pour une
  zone de source `siege` ; rien sinon), la tête de `currentTargetingMode` aussi ;
- `placingZoneOf` n'en dérive PAS : c'est une entrée de `detenteurDuCiblage`, inchangée, et ses sept
  sites (`gameIso/stage/MondeDeCampagne.tsx:588`, `gameIso/stage/ZdeTemplate.tsx:28`,
  `actionRegistry.ts:510`, `combatFlow.ts:5489`, `devtools.ts:1569`, `targetingModes.ts:925` et `:969`)
  gardent leur réponse ;
- équivalence avec `targetingHolder` d'aujourd'hui : la Surincantation et la zone de sort rendent
  `undefined` ; `placingZoneOf` rend la source `siege` exactement quand `pendingSiegeAim` est posé sans
  zone de sort en pose (`combatFlow.ts:5461-5476`), cas où la fonction actuelle rend `pendingSiegeAim` ;
- l'invariant distinct du test (« tout détenteur est une fenêtre DÉCLARÉE à `HORS_MODAL` ») passe au
  type : `TARGETING_HOLDERS satisfies readonly HorsModalCoveredKey[]` (`modalArbiter.ts`, type
  exporté) ;
- la garde, son stock et son test sont supprimés dans ce commit-là, avec la sonde de mutation du codeur.

**D12. #2763 sort de la vague** (m8 v3). « AttackResult fermé » est bloqué par #1858 « File de frappes du
tour » ; il reste à #2724, et le plan s'amende (`restructuration.md:206-207`, « dont #2763 »). Sonde
positive (2026-10-20), collée aussi à #2763 :
```
$ gh api repos/MyEdO/game/issues/1858 --jq '"#\(.number) \(.state) — \(.title)"'
#1858 open — File de frappes du tour : neuf pertes de frappes (gratuites perdues ou rebâties sans fin) et Frappe Mortelle qui re-frappe la même cible
$ gh api repos/MyEdO/game/issues/2763 --jq '.body' | grep -n 1858
26:Bloqué par #1858 (File de frappes du tour), pour le tri C6, comme le consigne le suivi de #2561. Prérequis partagé avec #1595.
```

## 3. Lots

Chaque lot : un codeur sur brief, un juge neuf sur le diff, `typecheck:fast` 0 et `test:perimetre` vert
en local, `typecheck` complet, `lint` et suite complète en CI, une PR sur `chantier/2817` en fusion
automatique. Le contenu exact d'un lot vient de la re-mesure à sa base (H-b).

- **3a. Les coupes.** Le bus au noyau ; `plateforme.ts` et sa pose ; les 14 arcs du §1 (D4 pour le
  curseur, D6 pour le reste) et les deux arcs de type `IconId` (D6) ; `detenteurDuCiblage` et la
  suppression de `targeting-holder-vs-mode` (D11). Preuve : `coupe.cjs` et `zones.cjs` sur la liste A
  rendent zéro arc de N vers A ou vers une zone fermée au noyau.
- **3b. Le déménagement.** Les fichiers de N passent sous `src/noyau/`, au même chemin relatif, sauf le
  modèle du monde (liste fermée au brief ; critère : le module ne lit ni ne pose d'état de combat ni de
  flux) qui va sous `src/noyau/monde/`. Chaque test homonyme suit son module ; les testkits restent dans
  `state`, `cascadeTestKit` renommé `cascade.testkit.ts`. Les réexportations restantes du §1 sont
  supprimées et le baril `combatFlow` dissous (D2). Codemod `sondes/deplacer.cjs` : spécificateurs
  d'import, d'`import()`, d'`import type`, de `vi.mock` et de `require` réécrits par l'AST ; chemins
  littéraux repointés hors des dossiers d'historique (`docs/plans/`, `docs/superpowers/`,
  `docs/retours/`, `.claude/soldes/`). COUCHES ne change pas : l'arête de type `noyau → state` couvre
  les types encore lus au store. Preuve : lint 0, typecheck complet, suite complète, détection de
  renommage de git (le diff de contenu se limite aux spécificateurs et aux chemins).
- **3c. Le type et les actions** (#2889). `etat.ts` et `flowTypes` au noyau ; les 201 actions de jeu de
  `store.ts` et leurs 5 déclarations dans des fabriques du noyau ; `CHAMPS_DU_SIEGE`, `EcranDuJeu` et
  `ecranDuShell`, la scission de `stateFields`, les événements `TOUR_ACHEVE`, `SCENE_ENTREE`,
  `HEROS_A_CREER` et `BATTLE_OVER` sur toute issue (D5). Sonde d'entrée à la base du lot : un `tsc` sur
  `etat.ts` seul, arête retirée, avant de déplacer les actions. L'arête de type `noyau → state` sort de
  COUCHES (DoD de #2889, premier point). Porte joueur au navigateur : une Course armée puis commise, une
  Charge, un changement de scène (caméra et gestes remis, sauvegarde d'entrée), le compendium ouvert et
  fermé, console à 0 erreur.
- **3d. Les registres** (#2889). D10 en entier, tests compris ; `brancherLeJeu` et sa remise au
  rechargement à chaud (D7), prouvée par `npm run dev`, `store.ts` touché, console à 0 erreur. Second
  point de la DoD de #2889 (« Restructuration, vague 4 »).
- **3h. Les dés sans défaut** (D8) : la classe `defaultRNG` sur tout `src/`.
- **3e. La surface** (#2817). La table des classes scindée, `index.ts`, `creerPartie` (D9). Les tests
  hors store :
  - `**/*.hors-store.test.ts` entre dans `EXCLUSIONS_DE_LA_SUITE`
    (`scripts/guards/lib/racinesDeLaSuite.mjs:22`), source unique que lisent `vite.config.ts`, les
    tranches de la CI (`suiteVitest.mjs`), `scripts/test/run.mjs` (par `enumerer`) et la dérivation du
    périmètre (`perimetreDerivation.mjs:96,131`, par `estDeLaSuiteVitest`) : la suite principale, dont
    le store a déjà posé `brancherLeJeu`, ne les joue pas ;
  - une configuration committée `vitest.noyau.config.ts` (sans `setupFiles`, `isolate: true`,
    `include` sur `src/noyau/**/*.hors-store.test.ts`), un script `test:noyau`, et son pas dans `ci.yml`
    à côté de la suite ;
  - `partie.hors-store.test.ts` n'importe que `src/noyau/index.ts` et joue, par une partie, une attaque
    complète (déclaration, jet, défense, critique, mise hors de combat, `cascadeNext` jusqu'à la
    clôture) ;
  - `plateforme.hors-store.test.ts` importe `noyau/plateforme` et `noyau/bus`, et vérifie qu'un appel
    sans plateforme posée lève et qu'une seconde `brancherLeJeu` lève.

  Contrôle du graphe : la fermeture de `src/noyau/index.ts` par `graphe.cjs` (qui suit aussi les motifs
  d'`import.meta.glob`, ajoutés à la sonde pour ce contrôle) ne contient aucun fichier de `state`, `ui`,
  `gameIso`, `web`, `net`, `audio`, ni `react` ; le metafile d'esbuild le confirme. Mesure sur
  `poc/godot`, sans fusion. Porte joueur au navigateur (combat de l'Arène, une critique, une mise hors de
  combat, console à 0 erreur).

Ordre : 3a, 3b, 3c, 3d, 3h, 3e. Les vagues suivantes restent celles du plan : 5 (#2884) retire les
arêtes de contenu, dont `scenes → state`, que 3b réduit ; 6 l'hôte Godot ; 7 le solde (le compte des
gardes ; après 3c, `state` ne porte plus de règle, ce que la re-mesure de la vague 7 confirme).

## 4. Hypothèses révisables

- H-a : un seul jeu par contexte JS (singletons de D7, D8 et de la plateforme) ; le jeu et le pont le
  font, `brancherLeJeu` le fait respecter, et la remise au rechargement à chaud le préserve en dev.
- H-b : la partition se rejoue à chaque lot par les sondes et le critère du §1 ; un élément mal rangé
  change d'ensemble avec ses lecteurs, et la liste se corrige ici.
- H-c : une PR 3b de l'ordre du lot 2b (1 317 fichiers) reste revuable parce qu'elle est mécanique ;
  sinon elle se scinde par composante fortement connexe du graphe de N.
- H-d : sans les remises à `null` du noyau, `hoverDelta` ne montre pas de jauge périmée après un
  déplacement commis, le survol le recalculant au rendu qui suit. Vérifié à la porte joueur de 3c ; si
  une image périmée survit, l'adaptateur le remet sur l'événement qui suit le commit.
- H-e : un écran du shell n'est plus partagé en coop. Aujourd'hui le snapshot de l'hôte écrase `screen`
  chez l'invité, compendium compris (`modalArbiter.ts:311-317`) ; après 3c, le compendium plein écran de
  l'hôte n'entraîne plus ses invités, comme la fenêtre Codex (`codexOverlay`), déjà par siège. C'est de
  l'ergonomie révisable, pas une règle de jeu.

## 5. Réponses au verdict v3

| Point | Réponse |
|---|---|
| B1 case et mouvement | D4 : `targetingModes` et `targeting` entiers dans N ; `battleClickTile`/`battleClickEntity` restent des actions du noyau, mouvement, `cancelMove`, Tir rapide, sélection du mode et `batteryBlock` compris ; `:1590` et `targetingModes.ts:814` appellent le noyau ; seul le curseur passe dans A. |
| M1 union des intentions | D9 : union = clés d'`ActionsDuNoyau` (`cascadeNext` compris) ; le siège applique `GUEST_INTENTS` et `intentAllowedFor` ; table scindée sur `TableDesClasses<Jeu>` ; ouvreurs et protocole coop inchangés. |
| M2 frontière de l'état | §1 mesuré (`champs.cjs` filtré, `storeparts.cjs`) : 26 champs d'interface, leurs accès par N coupés (`TOUR_ACHEVE`, `BATTLE_OVER`, `SCENE_ENTREE`, `HEROS_A_CREER`, curseur dans A) ; `stateFields` scindé ; `CHAMPS_DU_SIEGE` ; `EcranDuJeu` et `ecranDuShell` ; `MODES_HORS_REGISTRE` suit `actionRegistry`. |
| M3 partition | §1 : critère appliqué aux membres du store (201 actions descendent, 34 restent) ; `sceneToAscii`, `stations`, `visibility`, `offreRendue`, `offresUtilisables`, `poste` dans A ; `advancement` dans N, motivé ; `actionRegistry`, `turnEconomy` dans N ; `cascade.testkit.ts` ; sondes `/testkit/i`. |
| M4 tests hors store | 3e : exclusion par `EXCLUSIONS_DE_LA_SUITE` (source unique de la suite, du lanceur, des tranches et du périmètre), config dédiée, `test:noyau`, pas de CI. |
| m1 décompte | §1 : 14 arcs, 11 fichiers, 3 dans `combatSlice`, sortie brute. |
| m2 `IconId` | D6 : tables typées `string` dans N ; la garde de build `no-phantom-icon` balaie déjà `state` et `noyau`. |
| m3 régime des tests | D10 : inventaire (`inscriptions.tsv`), espion sur genre réel, seam de banc pour le socle ; `echec-sans-jet-appliers` par `vi.mock` (D7). |
| m4 `targeting-holder-vs-mode` | D11 : invariant `HORS_MODAL` porté au type ; `placingZoneOf` non dérivé, sept sites nommés, équivalence écrite. |
| m5 crochets | D7 : deux crochets dans `brancherLeJeu`, sept en imports directs, nommés. |
| m6 gardes de l'aiguilleur | D4 : les gardes restent dans les actions du noyau, que partie et reprises appellent. |
| m7 surface | D9 : morceau 7 = donnée du moteur, intitulés à l'hôte ; `index.ts` seul baril ; `RollFlowActionsMap` ⊂ `ActionsDuNoyau` (D5). |
| m8 #2763 (« AttackResult fermé ») | D12 : sonde positive collée. |
| m9 noms | §1 : `commitPlacedZone` est déjà dans `combatFlow` (N) ; D6 : `presetDuNarratif` réutilisé ; D5 : `compendiumFocus` et `codexOverlay` (`codexFocus` est le fichier). |
| Non vérifiés | `etat.ts` : sonde `tsc` d'entrée de 3c ; HMR : D7 et preuve de 3d ; `poc/godot` : 3e. |
