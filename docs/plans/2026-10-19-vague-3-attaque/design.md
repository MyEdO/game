# Vagues 3 et 4 (#2817, #2889) : l'orchestration au noyau — paragraphe de design v3 (2026-10-20)

Épique #2882 (« Restructuration : des couches à frontières tenues, un noyau de règles appelable par tout
hôte »), plan `docs/plans/2026-10-19-restructuration.md`. Historique : la v1 (`23e511c12`) a été REJETÉE
(`verdict-du-juge.md`, 3 bloquants) ; la v2 (`9036aa19b`) aussi (`verdict-du-juge-v2.md`, 1 bloquant,
6 majeurs, 7 mineurs), sans rejeter sa méthode. La v3 garde la méthode de la v2 et corrige ses 14 points
(§5). Arbre mesuré : `origin/main` `cf4f18bcf`.

Sondes rejouables, dans `sondes/` : `graphe.cjs` (graphe d'import de FICHIERS de `src/`, valeur et type
séparés : `import type`, spécificateurs tous `type`, `typeof import()`) ; `coupe.cjs` (arcs de valeur de
N vers A ou vers une zone d'hôte) ; `zones.cjs` et `importeurs.cjs` (juge v2 : arcs de N vers une zone
fermée au noyau ; lecteurs de chaque fichier de N) ; `storeclo.cjs` (juge v2 : fermeture des actions de
`store.ts` appelées par N, API TypeScript 6.0.2). Lancer `node sondes/graphe.cjs <racine> > graphe.json`,
puis `GRAPHE=graphe.json node sondes/coupe.cjs <liste A>`.

Mandat : laurent, verbatim (2026-10-19) : « Enfin pour etre précis le ticket a faire de bout en bout
c'est 2882, la 2817 c'est juste un des sous tickets ». L'épique entière est dans le périmètre.

## 1. Ce que la mesure dit

- Sans coupe, l'attaque atteint 301 des 353 fonctions de ses trois fichiers (`dependances.md` §3), la
  boucle du tour et l'IA, la clôture de cascade et ses routes de voyage, et par `EFFECT_HANDLERS` le
  dialogue, le repos, la poursuite, la carte du monde et le voyage maritime (verdict v1, B1 à B3).
- **Critère de partition** des 166 fichiers non-test de `src/state` :
  - un fichier va dans **N (le noyau)** s'il porte une règle (une réf RAW, une transition de l'état du
    jeu) ou si un fichier de N le lit en valeur ;
  - il va dans **A (l'adaptateur web)** s'il ne porte qu'un état d'interface, un service web ou la
    persistance, et que seuls A, `ui` ou `gameIso` le lisent (`importeurs.cjs`) ;
  - un fichier qui mêle les deux se SCINDE : la règle va dans N, le reste dans A.
- **A (42 fichiers, 13 176 lignes)** : le store et la persistance (`store`, `saves`, `roster`,
  `preferences`, `keybindingsPrefs`, `houseRules`, `projectLibrary`, `traceLayer`, `traceCalibration`,
  `editorAutosave`, `campaignData`, `formats.generated`), la coop (`netFlow`, `intents` jusqu'à 3e),
  l'outillage (`devtools`, `devtoolsTimers`, `scenarioFlow`, `validateScene`, `dialogueLibelle`,
  `mapQC`), l'état d'interface (`targeting`, `combatCursor`, `localIntent`, `clavier/keybindings`,
  `clavier/resoudreEchap`, `combatAuto`, `registreOffres`, `actionRegistry`, `hotbarBridge`,
  `editeurBridge`, `mapHover`, `stagePan`, `stageYaw`, `stageGestes`, `stageWalk`, `entreeEnScene`,
  `turnEconomy`, `viewLevel`, `codexFocus`, `dismissStack`, `dispositionConsole`), et la part
  d'interface de `targetingModes` (affordances, réticule, aiguilleur).
- **N (124 fichiers, 55 188 lignes)** : tout le reste, dont `combatFlow`, `combatSlice` (sa part de
  règles), `combatEffects`, `rollFlowSpecs`, `rollFlowFactory`, `modalArbiter`, `targetingHolder`
  (`coupFerme`, LDB 14 l.9, LDB 85 l.362 ; le détenteur du ciblage qui fonde la possession coop), le bus,
  et la part de règles de `targetingModes` : les corps de déclaration `attackClickCommit` (`:498`,
  Charge LDB 15 l.35-37, Peur LDB 21 l.27, Bénédiction de Protection LDB 41 l.142, Frénésie LDB 21 l.33,
  choix cavalier/monture LDB 14 l.181), `castClickCommit` (`:713`), `teleportCommitTile` (`:736`),
  `pushCommitTile` (`:765`), `castCommitTile` (`:804`), `placingCommitCombatant` (`:812`) et
  `commitPlacedZone`.
- **Arcs de VALEUR de N vers A ou vers une zone d'hôte** : sortie brute de `coupe.cjs` sur la liste A
  ci-dessus (hors la scission de `targetingModes`, que la sonde ne voit pas) :
  ```
  -> state/campaignData.ts 4    combatEffects.ts:29 {trappingById,indiceById,documentById}
                                combatSlice.ts:66 {trappingById}
                                offresUtilisables.ts:24 {presetPnjById}
                                sceneNpc.ts:12 {nomDePreset,presetPnjById,resolvePresetCreature}
  -> web/minuteries.ts 3        combatDirector.ts:16, combatFlow.ts:19 {scheduleCombatTimer}
                                enchainerEtape.ts:2 {scheduleFlowTimer}
  -> state/targetingModes.ts 2  combatOrParty.ts:22 {currentTargetingMode}
                                combatSlice.ts:112 {batteryBlock,currentTargetingMode}
  -> state/targeting.ts 2       combatOrParty.ts:23 {hoverTargeting}
                                combatSlice.ts:111 {cycleTarget,cyclePrevTarget,cursorActor}
  -> state/combatCursor.ts 2    combatSlice.ts:110 {nextCursorTile,nextCaseCursorTile,tileModeValidTiles,cursorCommitIntent}
                                exploreNav.ts:7 {screenStepDot}
  -> state/combatAuto.ts 1      combatSlice.ts:12 {tickCombatAuto}
  -> state/stageYaw.ts 1        combatSlice.ts:42 {viewYawDeg}
  -> state/localIntent.ts 1     combatSlice.ts:43 {chargeArmee,courseArmee}
  -> state/roster.ts 1          partyFlow.ts:47 {rosterUpdate}
  -> state/store.ts 1           seaVoyageFlow.ts:51 {registerScene}
  ```
  Soit 18 arcs dans 8 fichiers, dont 9 dans `combatSlice`. Arcs de TYPE vers une zone fermée au noyau
  (`zones.cjs`) : `IconId` (`ui/icons`) dans `combatManeuvers:43` et `revealStep:10`, rien d'autre ;
  aucun arc vers `scenes`, `net`, `audio`, `gameIso`, `racine`. Paquets en valeur : `zod` (2 sites),
  ouvert à toute zone.
- Trous connus de la sonde, comparée au mur (`arcsDImport.mjs`) : elle ne lit ni `require`, ni
  `import.meta.glob`, ni `vi.mock`, et exclut les testkits. Mesuré : aucun import à effet de bord dans
  `state` ; aucun `require` ni `import.meta.glob` dans un fichier non-test de N. Les testkits restent
  dans `state` (3b) : `partage.testkit.ts:26-27` (`import.meta.glob('/src/scenes/**')`) y est à sa place.
- **Actions du store appelées par N** (`storeclo.cjs`) : 58 actions appelées par `get().X(` depuis N ; leur
  fermeture dans `store.ts` compte **27 actions, 357 lignes** (`advanceTime autoSave confirmDistribution
  designerHerosOuvrir faceAtCombatStart faceFromPath faceToward favorGrant interactEntity jouerAction log
  moveParty openMerchant openSessionEnd openTavernGames openWorldMap remettreDocument restoreFortuneNow
  setEditingHero setScreen shipAdvance shipTurn startExtendedTest startForceDoor startInterlude
  startMassBattle transitionTo`), plus 5 déclarations de premier niveau (`sceneRegistry`, `placesDe`,
  `seLeverDe`, `sasseoirA`, `JOUER_CAPACITE`) et trois imports venus de A : `saves` (`autoSave`, par
  `transitionTo`, `store.ts:2407`), `stageGestes` (`resetStageGestes`, `:2402`), `campaignData`.
- Réexportations dans le périmètre : `store.ts:218` (`export * from '../noyau/pendings'`, commenté « pour
  la compat »), `store.ts:49` et `:54`, le baril `combatFlow.ts:246-286`, `portFlow.ts:481`,
  `spawn.ts:80`, `combatManeuvers.ts:310`, `rollFlowSpecs.ts:2100`.

## 2. Décisions

**D1. Où.** `src/noyau/` (H1 du plan). `src/engine` reste la bibliothèque de règles sans état
(règle 3 d'`AGENTS.md`) ; le noyau enchaîne ces règles sur l'état du jeu. `docs/architecture.md`
§ Frontière orchestrateur · machinerie · data-driven : `fireTriggers` (le dispatch des données) et
`registerCombatHook` (la machinerie) sont tous deux de l'orchestration, donc au noyau. `docs/doctrines.md`
ne porte aucune doctrine de couche ; tranchent les arbitrages cités au plan (2026-10-18 : « Mettre le code
au bon endroit ca ne me semble pas une mauvaise chose a faire non plus » ; « Il n'est pas interdit de
bouger le code mal placé en tout cas. »), et `user-doctrine-un-hote-jamais-duplique` pour le nommage (D6).

**D2. Méthode : par mécanisme, pas par famille de flux** (amende H3 du plan). On coupe d'abord les arcs
de N vers A et vers l'hôte (§1) ; N déménage ensuite d'un bloc dans le noyau ; puis le type de l'état,
les actions et les registres se ferment dans le noyau. Aucun échafaudage transitoire (ni sortie typée
« reprendre le tour », ni table remplie depuis `state`) ; le site d'origine disparaît dans le lot qui
déplace ; aucun fichier-pont ; **aucune réexportation** : les réexportations de §1 sont supprimées en
3b, leurs importeurs réécrits vers le module qui déclare, et le baril `combatFlow` se dissout (son effet
de bord d'inscription tient jusqu'en 3d par des imports explicites `import './x'` dans `store.ts`).
H3 garde son invariant, jamais deux implémentations d'une même règle ; l'unité de migration change.
Garde de la méthode : `murs/purete-imports` refuse tout arc de valeur `noyau → state` (COUCHES).

**D3. L'état : le noyau mute, il ne rend pas une copie** (amende le But de #2817, la ligne `noyau` du
§3.1 et le §3.2 du plan, « une fonction du noyau rend un nouvel état »). Raison : le moteur lui-même mute
les combattants en place (`applyOps`, `addCondition`) ; réécrire l'orchestration en `(état) → nouvel
état` par copie réécrirait le moteur. Le noyau garde le couple `get`/`set` en interne ; ce qui disparaît
de la surface offerte aux hôtes, c'est le store. Un hôte externe reçoit une **partie** (D8), propriétaire
de l'état au même titre que le store web.

**D4. La déclaration des gestes est une action du noyau** (B1 v2). Les corps de déclaration de
`targetingModes` (§1) passent dans N, en actions du noyau : `declarerAttaque(cibleId, opts)` (corps
d'`attackClickCommit`), `declarerSort(cibleId)`, `declarerCase(pt, opts)` (téléportation, poussée, pose
de zone, sort sur case), avec les options que l'émetteur calcule déjà (`BattleClickOpts` : `approche`,
`confirm`, `wardCleared`, `skipMountChoice` ; `TileClickOpts` : `courseArmee`). `chargeArmee` (lu
`targetingModes.ts:390`) arrive par l'option `approche`, qui le porte déjà pour la coop
(`localIntent.INTENT_VERDICT_ARGS`). Les affordances, le réticule et l'aiguilleur restent dans A :
`battleClickEntity`/`battleClickTile` deviennent un aiguilleur d'adaptateur qui lit le mode courant et
appelle l'action du noyau. Les reprises de règle qui rappelaient le clic (`combatSlice.ts:595`
`mountTargetSelect`, `:1590-1591` après la Peur, `:1613` après la Bénédiction de Protection) appellent
l'action de déclaration du noyau. L'intention d'attaque d'un hôte externe est cette action.

**D5. Le type de l'état et des actions sort du store** (M3 v1, M1 v2). `src/noyau/etat.ts` déclare :
- `EtatDeJeu` : les champs de donnée de `GameState` que N lit ou écrit (mesure au lot 3c) ; leurs types
  vont au noyau avec eux, dont `BattleActionMode` (`store.ts:249`, d'`actionRegistry`) et `NetState`
  (`:890`, de `netFlow`, lu par `netOwnership` pour la possession), `Screen` et `SCREENS` (`screen` est
  écrit par des règles : `interludeFlow.ts:1440,1462`, `massBattleFlow.ts:305,308,936`,
  `combatEffects.ts:1543`, `store.ts:2853`) ;
- `ActionsDuNoyau` : les actions dont le corps porte une règle, créées par des fabriques du noyau
  `(get, set) => actions` (la forme de `createCombatSlice`) : la part de règles de `combatSlice`, les
  27 actions de `store.ts` mesurées au §1 (357 lignes), les actions de déclaration (D4) ;
- `Jeu = EtatDeJeu & ActionsDuNoyau` ; `Get = () => Jeu`, `Set`, `PatchDeFlux`, `RemplacerLEtat`
  (`flowTypes.ts` va au noyau, typé sur `Jeu`).

Le store compose `GameState = Jeu & EtatDeLAdaptateur & ActionsDeLAdaptateur`. Vont dans
`EtatDeLAdaptateur`, dès 3c, les champs que seul A touche (mesurés au lot), dont `combatCursor`
(`store.ts:477`), `localIntent` (`:490`), `codexFocus` (`:388`). `GameState extends RollFlowActionsMap`
devient un alias d'intersection : `RollFlowActionsMap` ne référence pas `GameState`
(`rollFlowSpecs.ts:2131-2134`), et `create<GameState>` accepte l'intersection ; le `set` du store se
passe en `Set` sur `Jeu` par contravariance, comme `createCombatSlice` aujourd'hui. Les 438 appels
`get().action()` restent des appels d'actions, mais le compilateur refuse qu'un module du noyau appelle
une action de l'adaptateur. `get().log` est l'action `log` d'une fabrique du noyau, écrivain unique de
`journal`. Après 3c, aucun type du noyau ne vient de `state` : l'arête de type `noyau → state` sort de
COUCHES, et `index.ts` n'exporte aucun type de `state`.

**D6. Services de plateforme : un module, une table complète, absence = erreur** (M2 v1, M2 v2).
`src/noyau/plateforme.ts` déclare ce que le noyau demande à l'environnement d'exécution :
`programmer(suite, délai, portée)` et `annuler(jeton)` (les minuteries de `web/minuteries` :
`combatFlow:19`, `combatDirector:16`, `enchainerEtape:2`), et `persisterLeHeros(heros)`
(`partyFlow:47`, `rosterUpdate`). Le mot « plateforme » évite la collision avec l'hôte de jet
(`hostStep`, `user-doctrine-un-hote-jamais-duplique`). L'adaptateur web la pose à la création du store
et relaie vers `web/minuteries` et `roster` ; un appel sans plateforme posée LÈVE. Le reste se ferme
ainsi :
- le bus (`state/bus.ts`, émetteur pur) déménage au noyau tel quel en 3a ; la présentation et l'audio s'y
  abonnent comme aujourd'hui ;
- `transitionTo` émet un événement d'entrée de scène (`EVT.SCENE_ENTREE`) ; l'adaptateur y abonne la
  sauvegarde automatique (`autoSave`, `store.ts:2407`) et la remise à zéro des gestes de scène
  (`resetStageGestes`, `:2402`) ; un hôte qui ne sauvegarde pas n'y abonne rien, ce qui est son droit ;
- `campaignData` reste dans A (il lit le store) ; ses résolveurs purs (`trappingById`, `indiceById`,
  `documentById`, `presetPnjById`, `nomDePreset`, `resolvePresetCreature`) passent dans N et prennent le
  narratif de l'état en argument. Mesure du juge v2 : ~25 sites appelants (`presetPnjById` dans 12
  fichiers, dont le résolveur `nomDEntite(ent, presetPnjById)`), tous réécrits en 3a ;
- `registerScene` (`store.ts:202`, avec `sceneRegistry` et `resetSceneRegistry`) passe dans N ;
- `combatSlice` se scinde en 3a, et seulement là : le ciblage, le curseur, la caméra et `tickCombatAuto`
  (`combatSlice.ts:110-112`, `:12`, `:42`, `:43`, `:944-1142`, `:1425`, `:1814-1819`) vont dans une
  fabrique d'adaptateur ; le reste (jet, coup, défense, Destin, tour, cascade) reste dans N ;
- `combatOrParty` : `combatantClickActs` (`:89-98`, lit le mode de ciblage) est de l'interface et passe
  dans A ; `touchActors` et le reste restent dans N ;
- `exploreNav.ts:7` (`screenStepDot`) : la règle reçoit le pas d'écran en argument de son appelant d'A ;
- `IconId` : le noyau suit la convention déjà tenue par `engine` (`src/engine/types.ts:180-183`) et par le
  noyau lui-même (`icon?: string`, `cascade.ts:1219,1932`, `pendings.ts:486,2084,2302`,
  `rollSeam.ts:220,272,436`) : un id d'icône s'y type `string`, et `Icon` lève sur un id inconnu.
  `MANEUVER_ICON` et `REVEAL_ICON`, les deux seules tables typées `IconId`, passent du côté de leurs
  lecteurs de présentation, où le contrôle à la compilation reste ; les 213 littéraux `icon:` de N sont
  déjà en `string` (m3 v2) ;
- `setAiTrace` (`ai.ts:62`) est un interrupteur d'outillage que `devtools` (A) appelle ; il reste avec
  `ai.ts` dans N : un arc A → N est ouvert.

**D7. Crochets liés au propriétaire de l'état** (M2 v1, M6 v2). Certains points d'injection capturent le
`get`/`set` du propriétaire : `setConditionGainedHook` (`combatSlice.ts:417`), `setTriggeredTestRouter`
(`:418`), `setOwnTestFailedEmitter` (`:421`), les trois crochets du test routé (`:424,427,430`),
`setZoneCrossTestHook` (`:433`), `setClotureDeCascade` (`:520`). D'autres sont posés à l'import
(`setSuiteApresCommit`, `combatEffects.ts:782`). Règle :
- une seule fonction du noyau, `brancherLeJeu(get, set)`, pose tous ceux qui capturent le propriétaire ;
  le store l'appelle à sa création, la partie à la sienne, `debrancherLeJeu()` les retire ; une seconde
  pose sans retrait LÈVE (un seul propriétaire par contexte JS, H-a) : une partie ne se crée donc pas là
  où le store existe, et c'est voulu (§3, 3e) ;
- `onConditionGained` garde le contrat du moteur, « Absent ⇒ aucune réaction » (`engine/conditions.ts:99-103`) :
  `engine` ne lève pas ; c'est le noyau qui garantit la pose, par `brancherLeJeu` ;
- ceux qui se taisent quand ils manquent (`suiteApresCommit?.` `cascade.ts:1348`,
  `ownTestFailedEmitter?.` `:1270,1366`, `zoneCrossTestHook?.` `combatPlacement.ts:147`) cessent d'être des
  points d'injection au lot des registres (D10) : leur code étant dans le noyau, chacun devient un import
  direct ; ceux qui capturent l'état restent dans `brancherLeJeu`, et leur absence y lève ;
- le siège agissant (`actingSeat`, `netOwnership.ts:115-129`) : la partie pose le `siege` de l'intention
  par `withActingSeat`, la primitive existante.

**D8. Entrées de la partie : dés, règles maison, cadence, dés fixés** (M4, M6 v1). Elles existent déjà en
variables de module : `seedBattleRng` (`noyau/battleRng.ts`), `loadRuleOverrides`
(`engine/policy.ts:137`), `setCadence` (`engine/cadence.ts:22`), `desFixes()` (`engine/fixedDie.ts`).
`creerPartie` les pose depuis ses entrées ; l'adaptateur web les pose comme aujourd'hui. Ce sont des
singletons par contexte JS (H-a), ce qui amende la formule du plan §4 (« entrées fournies par l'hôte ») :
fournies par l'hôte, oui ; passées en paramètre de chaque appel, non. Les défauts silencieux
`rng = defaultRNG` (34 appels de production et 295 de tests sans RNG, 71 fichiers ; 53 fichiers portent
`defaultRNG`) sont retirés sur toute la classe par le lot 3h : `tsc` exige alors le RNG à chaque appel.

**D9. La surface : `src/noyau/index.ts` et la partie** (m7 v2). `creerPartie(etatInitial, entrees)` rend
`{ etat(), envoyer(intention) → evenements, reprendre(jeton) → evenements, fermer() }`. La table des
intentions (`src/state/intents.ts`, qui nomme déjà chaque intention et sa politique de possession) passe
au noyau en 3e ; l'union des intentions est la liste de ses clés, ni `log` ni les actions internes
(`cascadeNext`…). Une intention est `{ type, args, siege? }` ; `envoyer` applique la règle de possession
(`intentAllowedFor`, la même que `netFlow.applyIntent`), pose le siège (D7), appelle l'action. La partie
s'abonne au bus pour rendre les événements, pose une plateforme dont `programmer` rend un jeton au lieu
d'armer un délai, appelle `brancherLeJeu`, et pose les entrées (D8). `fermer()` débranche. `index.ts`
n'exporte que la partie, les types d'`EtatDeJeu` et de l'intention, et les lecteurs dont un hôte a besoin
pour montrer une fenêtre (les sept morceaux de `docs/plans/2026-10-19-modale-attaque-godot.md` §53-61),
chacun pris à sa source unique.

**D10. Registres fermés** (M5 v1, m4 v2). Une fois le code au noyau, chaque registre rempli à l'import
devient une table statique typée par une union fermée (plan §3.2) : `registerCascadeApplier` (116 appels,
28 fichiers), `registerCascadeTableFold`, `registerTableStep(Family)`, `registerCascadeSuccessRule`,
`registerExtendedTestOutcome`, `registerCombatHook` (18), `registerHitModifier` (5), `registerCloture`
(10 verbes ; les 6 posés par `store.ts` qui touchent l'adaptateur deviennent des événements du bus),
`registerCastSpellEffect`, `registerNightBandApplier` (17), `registerSequence*` (26),
`registerPerilInterrupt`, `registerEtalGenerateur`, `setManeuverPostHitHook`, et les points d'injection
« silencieux » de D7. Les appliers de cascade du combat y sont compris. Une table qui référence des
fonctions de modules en cycle est construite au premier accès (aucun code de premier niveau ne l'appelle),
ce qui évite la zone morte temporelle des `const` en cycle. Le `ReferenceError` relevé par #2817 (« Combat : résoudre et appliquer une attaque sans le store ») disparaît
d'abord parce que le store sort de la fermeture du noyau (3b, 3c), puis parce que plus rien ne s'inscrit
à l'import. Régime des tests : une table fermée refuse les inscriptions de test. Les 29
`registerCascadeApplier(` de 13 fichiers de test, les 10 `spyApplier`, les 9 `registerCombatHook(` de 3
fichiers et l'instantané de `test-setup.ts:100,462,481-482` sont réécrits en espions sur une entrée
existante (`vi.spyOn(table, cle)`) ou sur l'appelé ; une entrée de test hors union ne compile pas.

**D11. Gardes qui changent** (M5 v1, M4 v2). Toute garde, lint ou générateur qui nomme un chemin
déplacé le suit (patron du lot 2b). `combat-event-port-guard` : sa WHITELIST de 6 chemins
(`combat-event-port-guard.test.ts:24-31`) suit au noyau, sans entrée neuve. `targeting-holder-vs-mode`
(deux prédicats jumeaux, `targetingHolder.ts:30` ⇄ `currentTargetingMode`, `targetingModes.ts:963`, et
`placingZoneOf`) : 3a pose la structure qui rend la divergence impossible. Une seule fonction du noyau,
`detenteurDuCiblage(s)`, rend le détenteur dans l'ordre de priorité (balayage, deuxième frappe,
Surincantation, pose de zone d'un sort ou d'un pilonnage) ; `targetingHolder` (la possession coop),
`placingZoneOf` et la tête de `currentTargetingMode` (l'aiguilleur d'A) en dérivent tous trois, sans
recopier la priorité. La garde, son stock et son test sont supprimés dans ce commit-là, avec la sonde de
mutation du codeur (une priorité modifiée dans `detenteurDuCiblage` change les trois lecteurs à la fois).

**D12. #2763 sort de la vague.** « AttackResult fermé » est bloqué par #1858 (ouvert) ; il reste à #2724.

## 3. Lots

Chaque lot : un codeur sur brief, un juge neuf sur le diff, `typecheck:fast` 0 et `test:perimetre` vert
en local, `typecheck` complet, `lint` et suite complète en CI, une PR sur `chantier/2817` en fusion
automatique. Le contenu exact d'un lot vient de la re-mesure à sa base.

- **3a. Les coupes.** Le bus au noyau ; `plateforme.ts` et sa pose ; les 18 arcs de §1 et les deux arcs
  de type `IconId` coupés selon D6 ; la scission de `combatSlice` et de `targetingModes` (D4, D6) ;
  `detenteurDuCiblage` et la suppression de `targeting-holder-vs-mode` (D11). Preuve : `coupe.cjs` et
  `zones.cjs` sur la liste A rendent zéro arc de N vers A ou vers une zone fermée au noyau.
- **3b. Le déménagement.** Les fichiers de N passent sous `src/noyau/`, au même chemin relatif, sauf le
  modèle du monde (liste fermée au brief ; critère : le module ne lit ni ne pose d'état de combat ni de
  flux) qui va sous `src/noyau/monde/`. Chaque test homonyme suit son module ; les testkits restent dans
  `state`. Les réexportations de §1 sont supprimées et le baril `combatFlow` dissous (D2). Chemins :
  spécificateurs réécrits par codemod AST ; chemins vivants repointés hors `docs/plans/` (646 occurrences
  hors `src/`, plus 183 chemins littéraux `src/state/<N>.ts` dans des tests de `src/`, que le codemod de
  spécificateurs ne voit pas) ; la sortie de `scripts/gen-formats.mjs` reste dans `state`
  (`formats.generated` est dans A). COUCHES ne change pas : l'arête de type `noyau → state` (#2889)
  couvre les types encore lus au store. Preuve : lint 0, typecheck complet, suite complète, détection de
  renommage de git (le diff de contenu se limite aux spécificateurs et aux chemins).
- **3c. Le type et les actions** (#2889). `etat.ts` et `flowTypes` au noyau (D5) ; les 27 actions de
  `store.ts` descendent dans des fabriques du noyau ; chaque appel `get().action()` refusé par le nouveau
  type est coupé (D5) ; `EVT.SCENE_ENTREE` (D6). L'arête de type `noyau → state` sort de COUCHES (DoD de
  #2889, premier point).
- **3d. Les registres** (#2889). D10 en entier, tests compris ; `brancherLeJeu` (D7). DoD de #2889,
  second point.
- **3h. Les dés sans défaut** (D8) : la classe `defaultRNG` sur tout `src/`.
- **3e. La surface** (#2817). La table des intentions au noyau ; `index.ts`, `creerPartie` (D9). Un projet
  vitest dédié (`vitest.noyau.config.ts`, sans `setupFiles`, `isolate: true`), lancé par `npm test` et
  la CI, avec deux fichiers : `partie.hors-store.test.ts`, qui n'importe que `src/noyau/index.ts` et
  joue par une partie, de la déclaration à l'issue, une attaque complète (déclaration, jet, défense,
  critique, mise hors de combat) ; `plateforme.hors-store.test.ts`, qui importe `noyau/plateforme` et
  `noyau/bus` et vérifie qu'un appel sans plateforme posée lève, et qu'une seconde `brancherLeJeu` lève.
  Contrôle du graphe : la fermeture de `src/noyau/index.ts` par `graphe.cjs` (qui suit aussi les motifs
  d'`import.meta.glob`, ajoutés à la sonde pour ce contrôle) ne contient aucun fichier de `state`, `ui`,
  `gameIso`, `web`, `net`, `audio`, ni `react` ; le metafile d'esbuild le confirme. Mesure sur
  `poc/godot`, sans fusion. Porte joueur au navigateur (combat de l'Arène, une critique, une mise hors de
  combat, console à 0 erreur).

Ordre : 3a, 3b, 3c, 3d, 3h, 3e. Les vagues suivantes restent celles du plan : 5 (#2884) retire les arêtes
de contenu, dont `scenes → state`, que 3b réduit ; 6 l'hôte Godot ; 7 le solde (`state` sans règle :
`combatAuto`, ce qui reste de règle dans A après la re-mesure, et le compte des gardes).

## 4. Hypothèses révisables

- H-a : un seul jeu par contexte JS (singletons de D7, D8 et de la plateforme) ; le jeu et le pont le
  font, et `brancherLeJeu` le fait respecter.
- H-b : la partition se rejoue à chaque lot par `importeurs.cjs` et le critère du §1 ; un fichier mal
  rangé change d'ensemble avec ses lecteurs, et la liste se corrige ici.
- H-c : une PR 3b de l'ordre du lot 2b (1 317 fichiers) reste revuable parce qu'elle est mécanique ;
  sinon elle se scinde par composante fortement connexe du graphe de N.

## 5. Réponses au verdict v2

| Point | Réponse |
|---|---|
| B1 déclaration de l'attaque | D4 : les corps de déclaration passent dans N en actions du noyau ; l'aiguilleur reste dans A ; les reprises appellent l'action. |
| M1 types d'`EtatDeJeu` | D5 : critère « lu ou écrit par N » ; `BattleActionMode`, `NetState`, `Screen` au noyau ; `combatCursor`, `localIntent`, `codexFocus` dans `EtatDeLAdaptateur` dès 3c. |
| M2 table de D6 | D6 : `EVT.SCENE_ENTREE` pour `autoSave` et `resetStageGestes` ; `setAiTrace` ; 3c chiffré (27 actions, 357 lignes). |
| M3 partition | §1 : critère écrit ; `stageWalk`, `entreeEnScene`, `turnEconomy`, `formats.generated`, `dialogueLibelle` dans A ; `targetingHolder` et les déclarations dans N ; coupes sans objet retirées. |
| M4 `targeting-holder-vs-mode` | D11 : `detenteurDuCiblage`, trois lecteurs dérivés, garde supprimée dans le même commit. |
| M5 réexportations | D2, 3b : supprimées, importeurs réécrits, baril dissous. |
| M6 crochets du propriétaire | D7 : `brancherLeJeu`, seconde pose = erreur, contrat du moteur gardé. |
| m1 tableau | §1 : sortie brute de la sonde. |
| m2 trous de sonde | §1 : trous mesurés, testkits dans `state`. |
| m3 `IconId` | D6 : convention `string` du moteur et du noyau ; les deux tables typées passent chez leurs lecteurs. |
| m4 tests des registres | D10 : régime d'espion, chiffré. |
| m5 preuve de 3e | 3e : deux fichiers, `isolate: true`, fermeture qui suit `import.meta.glob`. |
| m6 chemins et scission | 3b : les deux familles de chemins nommées ; scission en 3a seulement. |
| m7 union d'intentions | D9 : table des intentions au noyau, possession appliquée. |
</content>
</invoke>
