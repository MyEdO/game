# Vagues 3 et 4 (#2817, #2889) : l'orchestration au noyau — paragraphe de design v5 (2026-10-20)

Épique #2882 (« Restructuration : des couches à frontières tenues, un noyau de règles appelable par tout
hôte »), plan `docs/plans/2026-10-19-restructuration.md`. Historique : v1 (`23e511c12`) REJETÉE
(`verdict-du-juge.md`, 3 bloquants) ; v2 (`9036aa19b`) REJETÉE (`verdict-du-juge-v2.md`, 1 bloquant,
6 majeurs, 7 mineurs) ; v3 (`662e46556`) REJETÉE (`verdict-du-juge-v3.md`, 1 bloquant, 4 majeurs,
9 mineurs) ; v4 (`7a6a1e57b`) REJETÉE (`verdict-du-juge-v4.md`, 0 bloquant, 6 majeurs, 13 mineurs).
Les quatre juges ont gardé la méthode. La v5 la garde et corrige les 19 points de la v4 (§5). Ses
corrections tiennent en trois principes, appliqués à toute la classe et non au site relevé :
- la moitié d'ADAPTATEUR de l'état ne voyage jamais : ni dans le snapshot coop, ni dans la sauvegarde ;
- une règle que le propriétaire de l'état déclenche (écouteur, abonnement, verbe de clôture) est une
  fonction du NOYAU que chaque propriétaire appelle, jamais une capture du store ;
- un test pose un régime par un seam de PRODUCTION sur une fixture nommée, jamais par mutation d'un
  registre ni par `vi.mock`.

Arbre mesuré : `origin/main` `cf4f18bcf` (`git diff --stat cf4f18bcf HEAD -- src` vide). Le bus a déjà
déménagé sur `chantier/2817` (`5168069cd`, premier geste de 3a, non fusionné) ; les mesures ci-dessous
sont prises sur `cf4f18bcf` et citent `state/bus.ts`.

Sondes rejouables, dans `sondes/` :
- `graphe.cjs` (graphe d'import de FICHIERS de `src/`, valeur et type séparés) ;
- `coupe.cjs` (arcs de valeur de N vers A ou vers une zone d'hôte ; liste A en argument, virgules) ;
- `zones.cjs`, `importeurs.cjs`, `storeclo.cjs` (juge v2) ;
- `champs.cjs`, `typeclo.cjs`, `declclo.cjs`, `storeacc.cjs`, `storeraw.cjs`, `intents-probe.mts`
  (juge v3) ;
- `acces-typés.cjs`, `etatclo.cjs`, `d11-matrice.mts`, `snapshot-probe.mts`, `snapshot-invite.mts`,
  `champs-init.mts`, `icon-probe.mjs` (juge v4) ;
- `classes.mts`, `storeparts.cjs`, `premier-niveau.cjs` (inventaire de TOUT le premier niveau d'un
  module, M3 v4) ;
- `inscriptions.tsv` (inscriptions de registre et poses de crochet dans les tests ; la commande
  `git grep` est en tête du fichier) ;
- `deplacer.cjs` (le codemod de 3b) ; `A.txt` (la liste A du §1).

Toutes reconnaissent un testkit sans égard à la casse (`/testkit/i`). Lancement :
`node sondes/graphe.cjs <racine> > graphe.json`, puis
`GRAPHE=$PWD/graphe.json node sondes/coupe.cjs "$(cat sondes/A.txt)"` ; les `.mts` par
`npx tsx <chemin>` depuis la racine.

Mandat : laurent, verbatim (2026-10-19) : « Enfin pour etre précis le ticket a faire de bout en bout
c'est 2882, la 2817 c'est juste un des sous tickets ». L'épique entière est dans le périmètre.

## 1. Ce que la mesure dit

**Critère de partition** de `src/state` (165 fichiers non-test, plus les MEMBRES de `store.ts` et de
`combatSlice.ts`, et le PREMIER NIVEAU de `store.ts`, rangés un par un) :
- va dans **N (le noyau)** ce qui porte une règle (une réf RAW, une transition de l'état du jeu) ou ce
  qu'un élément de N lit en valeur ;
- va dans **A (l'adaptateur web)** ce qui ne porte qu'un état d'interface, un service web ou la
  persistance, et que seuls A, `ui` ou `gameIso` lisent ;
- un fichier qui mêle les deux se SCINDE ;
- « lu par N » s'évalue APRÈS la descente des actions du store (ci-dessous) : un module que seules des
  actions du store lisent aujourd'hui (`sceneInstance`, `dialogueHistory`, `climbMove`, `innFlow`…) est
  lu par N ;
- une règle qui vit hors de `src/state` (dans `gameIso`) descend au noyau comme action (m12 v4).

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
- N : tout le reste, dont :
  - `targetingModes`, `targeting`, `actionRegistry`, `turnEconomy`, ENTIERS (38, 3, 13 et 8 réfs RAW ;
    leurs affordances disent quelle cible est LÉGALE, ce dont tout hôte a besoin) ;
  - `localIntent`, avec les champs `dispelCarrierId` et `refus` : ce sont les trois champs de jeu PAR
    CLIENT (D5) ;
  - `combatAuto` ENTIER, la planification du tick comprise (D7) : `initCombatAuto` se réduit à
    l'abonnement du store, qui passe dans `store.ts` (A) ;
  - `advancement` : la règle de disponibilité (cumul des niveaux ≤ courant, talents du niveau courant,
    `LDB 07 l.43/76/103`) s'applique ICI (`advancement.ts:117-125`), le moteur n'en fournit que les
    coûts ;
  - `cascadeTestKit` n'est pas un fichier de N mais un testkit : il devient `cascade.testkit.ts`
    (convention `scripts/guards/lib/fichierVitest.mjs:67-80`) et reste dans `state`.

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

**Accès de N à un champ ou à une action d'interface qu'aucun import ne montre** (`acces-typés.cjs`, plus
la recherche par expression régulière `n-touche-a.txt` pour les écritures par `set({...})`) :
```
state/combatEffects.ts:1543 setEditingHero, setScreen
state/combatFlow.ts:7292, :7484 combatCursor
state/combatSlice.ts:1063 camRot, viewMode, camEdge (curseur)
state/combatSlice.ts:1073-1114 combatCursor (curseur)
state/combatSlice.ts:1124 combatCursor (tête Tir rapide de battleClickEntity)
state/combatSlice.ts:964, 995, 1005, 1029, 1322, 1328, 1371 hoverDelta
state/modalArbiter.ts:332 screen
state/stateFields.ts:49 hoverDelta
store.ts:2287-2291 camRot, zoom, viewMode, povActive (startScene) ; :2290 useGame.getInitialState()
store.ts:2399-2400 camEdge, camPan (transitionTo) ; :2407 autoSave
```

**`hoverDelta` est un champ MORT.** Écrit par `useHoverTargeting.ts:202-219` et remis à `null` par les
sept sites de `combatSlice`, il n'a plus aucun lecteur de production : `git grep -n hoverDelta -- src
':!*.test.*'` ne rend que ses écrivains, sa déclaration (`store.ts:698`) et son manifeste
(`stateFields.ts:49`). Son dernier lecteur, l'`ActionBar` (`const hoverDelta = useGame((s) =>
s.hoverDelta)`), est mort avec `e4bf4d735` (2026-08-21, « mort du cadavre ActionBar »). Le contrat de
#1135 (`set-scan-guard.test.ts:46-54`) protégeait la jauge que ce lecteur peignait ; il n'a plus d'objet.
Les tests qui le portent (`movement-resolution.test.ts:113-133`, les assertions `hoverDelta` de
`useHoverTargeting.test.tsx`) verrouillent un comportement sans consommateur. `hoverMovementResolution`
(`useHoverTargeting.ts:161`) reste : il nourrit `hoverMove`.

**Le premier niveau de `store.ts`** (`premier-niveau.cjs`, 48 instructions hors imports) :

| Lignes | Instruction | Rang |
|---|---|---|
| 49, 54, 63, 153, 156, 159, 218 | réexportations | supprimées (D2) |
| 78 | type `SheetTab` | A |
| 84-88 | `reposerPaquetDeCampagne` (réinscrit les scènes du paquet, re-dérive le narratif) | N |
| 93-114 | `applyLoadedSave` (chargement d'une save) | A, sur la reprise du noyau (D5) |
| 196-197 | `SCREENS`, `Screen` | scindés (D5) |
| 201-214 | `sceneRegistry`, `registerScene`, `resetSceneRegistry`, `scenesDuRegistre` | N |
| 224-383 | types `ShootingStance(Key)`, `BattleState`, `Objective`, `CampaignDoc`, `PaquetALancer`, `PendingInteract` | N |
| 385-1683 | interface `GameState` | scindée (D5) |
| 1689-1735 | type `CampaignVessel` | N |
| 1739-1814 | `applyDialogueTransition`, `settleFall`, `tombantsDe`, `arriveeOccupee`, `soldeDeLAction` (LDB 13 l.86-88) | N |
| 1818-1843 | six `registerCloture` : `avancerHorloge`, `retirerEntite`, `marquerActionJouee`, `dialogueSuivant`, `testRateDeLActeur` (MSRC 16 l.152), `teardownDeVictoire` | N, table des clôtures (D10) |
| 1850-1919 | `JOUER_CAPACITE`, `placesDe`, `seLeverDe`, `sasseoirA` | N |
| 1921-3290 | `useGame = create<GameState>(…)` | scindé (ci-dessous) |
| 3295, 3300 | deux `bus.on(EVT.TIME_ADVANCED, …)` : `fireScheduledEffects` (#668), `purgeSurAvanceDHorloge` | N, primitive d'horloge (D7) |
| 3315-3321 | `useGame.subscribe(…)` : réconciliation de l'occupation des sièges (`releaseRecomposedRanks`) | N, transition du jeu (D7) |

Les 201 actions qui descendent citent 14 déclarations de premier niveau : les 12 fonctions et
constantes de N du tableau, `registerScene` et `useGame` (par `getInitialState`, D5).

**Le store** (`storeparts.cjs`) : l'objet de `create<GameState>` porte 235 actions, 1 161 lignes, pour
la plupart des délégations d'une ligne vers un flux de N.
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
  `transitionTo`, `:2402`), `presetPnjById` (`interactEntity`, `jouerAction`, `chooseDialogue`), et la
  remise à neuf de `startScene` par `useGame.getInitialState()` (`:2290`).

**Les champs** (`champs-init.mts` : 150 champs à l'état initial) :
- 25 champs d'interface : `zoom`, `povActive`, `camRot`, `camEdge`, `camPan`, `viewMode`,
  `debugLabels`, `debugRoofCut`, `reveler`, `inspectId`, `sheetId`, `sheetTab`, `sheetScroll`,
  `sheetAlarmsSeen`, `hoverCombatantId`, `hovered`, `hoverDelta` (mort, supprimé en 3a),
  `keyOverrides`, `editingHeroId`, `gameMenuOpen`, `codexOverlay`, `compendiumFocus`,
  `compendiumReturn` (supprimé en 3c, D5), `possessionsScreen`, `combatCursor` ; après la vague,
  24 avec `ecranDuShell` (D5) ;
- 125 champs de jeu, dont trois PAR CLIENT, retirés un par un du snapshot coop et préservés chez
  l'invité : `localIntent`, `dispelCarrierId`, `refus` (`netFlow.ts:110, 114, 118`, puis `:171-173`) ;
- `sessionEndOpen` (`stateFields.ts:76`) est de jeu : il ouvre la Fin de séance (effet de scène
  `combatEffects.ts:1538`, puis `partyFlow.endSession`, qui porte la remise de la Fortune de séance,
  `engine/fortune.ts:24`).

**La moitié d'interface voyage aujourd'hui.** `snapshotSave` (`saves.ts:79-91`) copie toute clé de
l'état initial hors des quatre entrées de `HORS_SAVE` (`saves.ts:60-71`), et `netSnapshot`
(`netFlow.ts:97-122`) passe par lui : 22 des 25 champs d'interface sont dans le snapshot et dans la
save (`snapshot-probe.mts`). `applyNetSnapshot` (`netFlow.ts:160-180`) repart de `getInitialState()`
puis étale le snapshot : l'invité reçoit la fenêtre Codex, la fiche ouverte, la caméra et les touches de
l'hôte (`snapshot-invite.mts`) :
```
codexOverlay {"category":"talents","id":"hote"} | sheetId hote | camRot 3 | keyOverrides {"cam-left":["KeyH"]} | localIntent {"actionId":"courir"}
```
Même classe dans la save : `loadGame` rend les touches et la caméra de la save, et `startScene` remet
`keyOverrides` à sa valeur de CRÉATION du store (`loadKeyOverrides()`, `store.ts:2085`), si bien qu'une
touche reliée pendant la session revient à l'ancienne au lancement d'une partie alors que
`localStorage` porte la neuve (`setKeyBinding`, `store.ts:2086`). Défauts du périmètre, corrigés en 3c
(D5).

**Les écrans** : `SCREENS` (`store.ts:196`) a 12 valeurs.
- Six sont l'écran PARTAGÉ de la table : `screen` voyage dans le snapshot, et l'invité suit l'hôte. Ce
  sont `menu` (défaite, `store.ts:2853` ; `massBattleFlow.ts:936`), `party` et `creator` (la
  composition d'équipe se fait à plusieurs : l'invité garde son créateur local quand l'hôte est sur
  `party`, `netFlow.ts:165`), `campaign`, `interlude` (`interludeFlow.ts:220, 1440, 1462`),
  `massBattle` (`massBattleFlow.ts:305, 308, 831, 865`).
- Six sont le shell web du client : `editor`, `test`, `coop`, `compendium`, `gallery`, `webglSpike`.
- Lecteurs de l'écran AFFICHÉ hors test : `ui/App.tsx:51` (puis `:77-87`), `clavier/keybindings.ts:220,
  253, 275, 276, 281, 283, 495`, `audio/music.ts:27`, `devtools.ts:599, 757`, `openCodex`
  (`store.ts:2136`). Lecteur de l'écran du JEU : `modalArbiter.ts:332` (`ecranPlein`), `netFlow.ts:165`.

**Règles hors de `src/state`** (recherche de `useGame.setState(` et de `useGame.getState,
useGame.setState` dans `gameIso`, `ui`, `audio`, `web`, `net`) : le saut d'exploration
(`gameIso/stage/useStagePointer.ts:231-251` : élan, `planJump`, refus, `moveParty`, `runFlow`) et
l'ouverture de porte, qui écrit la scène (`:277`, `:288`, en combat et en exploration). Le reste appelle
des fonctions de N sans porter de règle (`withPreRollFixedDie`, `eteindreRefus`, `lancerScenario`,
`FLOWS.*.reverseAvailable`).

**Les intentions** (sonde du juge v3) : `CLASSE_DES_ACTIONS` a 388 clés (`invité` 183, `hôte` 130,
`local` 24, `interne` 51), `GUEST_INTENTS` 440. `cascadeNext` et `cascadeFinish` sont des intentions
dérivées (`coopFlowIntents`). `interne` compte des gestes de joueur émis par le clavier (`moveParty`,
`battleArmIntent`, `stepPartyDir`, `intents.ts:284-288`). Le filtre des intentions de l'invité est fait
deux fois : par `HostSession` (`net/session.ts:64`, `allow`) puis par `intentAllowedFor`, dans le corps
d'`applyIntent` (`netFlow.ts:259-275`), qui réécrit aussi le siège de `partyAddHero`/`partyReplaceHero`.
`localIntent` est UN champ par client : chez l'hôte, l'intention d'un invité qui ne porterait pas son
verdict retomberait sur `courseArmee(get)` (`combatSlice.ts:939`), donc sur l'intention de l'HÔTE, et
`consumeIntent()` (`combatSlice.ts:524-528`) dissout aujourd'hui l'intention armée de l'hôte sur tout
clic exécuté au nom d'un invité.

**Les tests qui inscrivent** (`inscriptions.tsv`) : 108 sites dans 38 fichiers (`register*`,
`spyApplier`, `set*Hook|Emitter|Router`). Les genres y sont surtout SYNTHÉTIQUES : les tests du socle
(`noyau/cascade.test.ts` 25 sites, `cascade-batch-socle`, `cascade-table-step`, `combatHooks.test`,
`sequence-*`) éprouvent la machinerie elle-même. Deux interdits du dépôt bornent leur régime :
`vi.mock` est refusé tant que `isolate: false` (`src/vi-mock-isolate-guard.test.ts:31, 75`,
`vite.config.ts:90`) ; la mutation en place d'un registre importé est proscrite
(`.claude/rules/tests.md:15`).

**Les icônes** : `MANEUVER_ICON` (`combatManeuvers.ts:156`) et `REVEAL_ICON` (`revealStep.ts:13`) ont
pour clés des genres ; la garde `no-phantom-icon` n'extrait que les clés `icon:`
(`scripts/guards/lib/iconRefs.mjs:12`) et voit 0 de leurs 18 valeurs (`icon-probe.mjs`). Seul le type
`IconId` les contrôle ; il est l'alias de `IconIdGenerated`, union générée dans
`ui/icons/_registry.generated.ts` par `scripts/gen-registry.mjs` (`unionDesIds`, `:176`), avec le
registre des définitions.

**Trous des sondes** (comparées au mur `arcsDImport.mjs`) : ni `require`, ni `import.meta.glob`, ni
`vi.mock`, testkits exclus. Mesuré : aucun import à effet de bord dans `state` ; aucun `require` ni
`import.meta.glob` dans un fichier non-test de N.

**Réexportations de `src/state`** (`git grep -nE "^export (\*|\{|type \{)[^;]*from " -- src/state
':!*.test.*'`, 24 lignes dans 13 fichiers) : `store.ts:49, 54, 63, 153, 156, 159, 218` ; le baril
`combatFlow.ts:246, 247, 250, 253, 268, 272, 274, 275, 281, 283, 286` ; `targeting.ts:20-21` (dont la
valeur `spellAffinity`) ; `rollFlowSpecs.ts:204, 2100` ; `combatManeuvers.ts:310` ; `spawn.ts:80` ;
`portFlow.ts:481` ; `buildings.ts:30` ; `merchants/index.ts:4` (baril) ; `dispositionConsole.ts:31`.

## 2. Décisions

**D1. Où.** `src/noyau/` (H1 du plan). `src/engine` reste la bibliothèque de règles sans état (règle 3
d'`AGENTS.md`) ; le noyau enchaîne ces règles sur l'état du jeu. `docs/architecture.md` § Frontière
orchestrateur · machinerie · data-driven : `fireTriggers` et `registerCombatHook` sont de
l'orchestration, donc au noyau. Tranchent les arbitrages cités au plan (2026-10-18 : « Mettre le code au
bon endroit ca ne me semble pas une mauvaise chose a faire non plus » ; « Il n'est pas interdit de
bouger le code mal placé en tout cas. »), et `user-doctrine-un-hote-jamais-duplique` pour le nommage.

**D2. Méthode : par mécanisme, pas par famille de flux** (amende H3 du plan). On coupe d'abord les arcs
de N vers A et vers l'hôte (§1) ; N déménage ensuite d'un bloc dans le noyau ; puis le type de l'état,
les actions et les registres se ferment dans le noyau. Aucun fichier-pont, **aucune réexportation**
hors `src/noyau/index.ts` (D9) : les 24 lignes du §1 sont supprimées (celles de `store.ts:49, 54` dès
3a, pour couper l'arc d'`actionRegistry` ; les autres en 3b), leurs importeurs réécrits vers le module
qui déclare ; `merchants/index.ts` cède sa place à ses modules ; le baril `combatFlow` se dissout.
**Un seul échafaudage, nommé et borné** : de 3b à 3d, l'inscription à l'import que portait le baril
(`combatFlow.ts:281, 283, 286`, et les modules qu'il importait pour leur effet) tient par des imports
explicites `import './x'` dans `store.ts`, dans l'ordre exact où le baril les importait ; 3d les retire
avec l'inscription elle-même (D10). H3 garde son invariant, jamais deux implémentations d'une même
règle. Garde de la méthode : `murs/purete-imports` refuse tout arc de valeur `noyau → state`.

**D3. L'état : le noyau mute, il ne rend pas une copie** (amende le But de #2817, la ligne `noyau` du
§3.1 et le §3.2 du plan). Raison : le moteur mute les combattants en place (`applyOps`,
`addCondition`) ; réécrire l'orchestration en `(état) → nouvel état` réécrirait le moteur. Le noyau
garde le couple `get`/`set` ; ce qui disparaît de la surface offerte aux hôtes, c'est le store. Un hôte
externe reçoit une **partie** (D9), propriétaire de l'état au même titre que le store web.

**D4. La déclaration des gestes reste aux actions du noyau `battleClickEntity` et `battleClickTile`.**
`targetingModes` (son aiguilleur `currentTargetingMode` `:963`, ses six commits, ses affordances,
`batteryBlock` `:229`), `targeting` et `combatOrParty` (`combatantClickActs`) sont dans N. Les deux
actions de clic restent entières dans N : le mouvement neutre (`combatSlice.ts:946-1012` : Engagement,
Peur, Frénésie, Course), `cancelMove` (`:1014-1037`), la tête Tir rapide (`:1121-1126`), les gardes
`battle.over`, `preemptAiming`, `controlsCombatant` (`:928-932`, `:1118-1130`) et la sélection du mode.
Conséquences :
- `:1590` (Peur, cas case), `:1591`, `:595`, `:1613` et `targetingModes.ts:814` appellent une action
  du noyau, comme aujourd'hui ;
- le protocole coop ne change pas : l'invité envoie `battleClickEntity`/`battleClickTile` et leurs
  options, ouvreurs des flux `attack`, `cast`, `maneuver`, `approach`, `ward` (`intents.ts:338-358`) ;
- seul le CURSEUR clavier et manette passe dans A : `moveCursor`, `snapCursorToTarget`, `commitCursor`
  (`combatSlice.ts:1062-1099`) et `clearCursor` (`:1113-1115`) forment une fabrique d'adaptateur
  `creerActionsDuCurseur(get, set)` dans `combatCursor.ts`, qui lit la caméra (`viewYawDeg`) et appelle
  les deux actions de clic. Les arcs `combatSlice.ts:42` et `:110` partent avec elle ;
- **la péremption du curseur est UNE règle de l'adaptateur** : le curseur appartient à la fenêtre de
  geste ouverte. `curseurPerime(prev, s)` (`combatCursor.ts`) le dit périmé quand `battle` naît ou
  disparaît, quand `battle.over`, `battle.turn` ou `battle.round` change, ou quand `preemptAiming`
  change. L'abonnement du store (D7) le remet à `null` dans la foulée. Les trois écritures du noyau
  (`combatFlow.ts:7292`, `:7484`, `combatSlice.ts:1124`) disparaissent : la fin de combat, le tour qui
  s'achève et le Tir rapide qui se déclenche sont trois cas de la règle, et un quatrième (un tour sauté
  par un effet, une défaite) l'est sans site neuf ;
- **le verdict d'armement est celui du siège qui agit** (M6 v4). `intentionDuProprietaire(get)`
  (`localIntent.ts`) rend `localIntent` quand aucun siège agissant n'est posé (`actingSeat`,
  `netOwnership.ts:115`), `null` sinon. `courseArmee`, `chargeArmee` (`armedIntentPortee`) et
  `consumeIntent` ne lisent que lui : une intention exécutée au nom d'un siège sans verdict joint ne
  court ni ne charge, et ne dissout pas l'intention armée du propriétaire. L'invité web joint son
  verdict comme aujourd'hui (`argsAvecVerdictLocal`, `netFlow.ts:209`).

**D5. Le type de l'état et des actions sort du store.** `src/noyau/etat.ts` déclare :
- `EtatDeJeu` : les 125 champs de jeu du §1. Leurs types vont au noyau avec eux : `BattleActionMode`
  et sa valeur `MODES_HORS_REGISTRE` (`actionRegistry.ts:548`, que garde
  `action-atteignabilite.test.ts:229`) suivent `actionRegistry` dans N ; `LocalIntent` suit
  `localIntent` ; `NetState` et `initialNet` (`netFlow.ts:48-70`), que `netOwnership` lit pour la
  possession, vont au noyau ; les types du premier niveau de `store.ts` rangés N au §1 aussi ;
- `etatInitialDuJeu(): EtatDeJeu`, valeurs initiales des 125 champs (le littéral de `create` pour ses
  champs de jeu, plus `initialFields()` du manifeste `stateFields`), lue par `startScene`, par la
  reprise (ci-dessous) et par `creerPartie` ;
- `CHAMPS_PAR_CLIENT = ['localIntent', 'dispelCarrierId', 'refus'] as const`, et
  `HORS_SAVE = { campaignNarratif: … }` (déplacé de `saves.ts`, qui ne garde que la persistance) ;
- `DonneesDeLaPartie` : les champs d'`EtatDeJeu` moins `CHAMPS_PAR_CLIENT` et `HORS_SAVE`, type
  dérivé, et `donneesDeLaPartie(jeu)`, qui les copie en itérant les clés d'`etatInitialDuJeu()` ;
- `repriseDeLaPartie(donnees)` : `etatInitialDuJeu()` moins `CHAMPS_PAR_CLIENT`, les données
  par-dessus, l'élagage des places (`pruneSeatAssignments`, aujourd'hui `store.ts:105-108`) et
  `reposerPaquetDeCampagne` ;
- `ActionsDuNoyau` : les 201 actions de jeu de `store.ts`, `combatSlice` sans le curseur,
  `RollFlowActionsMap` (`attackRoll`, `cascadeRoll`…, `rollFlowSpecs.ts:2131-2134`), et deux actions
  neuves descendues de `gameIso` (m12 v4) : `sauter(chemin, indice)` (élan, `planJump`, refus,
  `moveParty`, `runFlow`, `useStagePointer.ts:231-251`) et `actionnerLaPorte(portail)` (`toggleDoorIn`,
  `:277`, `:288`) ; `useStagePointer` garde la cadence de la marche et appelle ces deux actions ;
  toutes créées par des fabriques du noyau `(get, set) => actions` (la forme de `createCombatSlice`) ;
- `Jeu = EtatDeJeu & ActionsDuNoyau` ; `Get = () => Jeu`, `Set`, `PatchDeFlux`, `RemplacerLEtat`
  (`flowTypes.ts` va au noyau, typé sur `Jeu`).

Le store compose `GameState = Jeu & EtatDeLAdaptateur & ActionsDeLAdaptateur` ; `EtatDeLAdaptateur`
porte les 24 champs d'interface, avec leurs valeurs initiales dans le littéral de l'adaptateur ;
`ActionsDeLAdaptateur` porte les 34 actions et le curseur. `create<GameState>` accepte l'intersection ;
le `set` du store se passe en `Set` sur `Jeu` par contravariance, comme `createCombatSlice`
aujourd'hui. Le compilateur refuse dès lors qu'un module du noyau lise ou écrive un champ d'interface
ou appelle une action d'adaptateur. Les accès du §1 se coupent ainsi :
- `combatCursor` : la règle de péremption de D4 ;
- `hoverDelta` : supprimé en 3a, avec son effet d'écriture (`useHoverTargeting.ts:202-219`), ses sept
  remises, sa déclaration, son entrée de manifeste, ses tests et son crédit du cliquet `set-scan-guard`
  (l'entrée « +4 resets ad hoc (#1135) » des lignes `:46-54`) ;
- entrée en scène : `transitionTo` émet `EVT.SCENE_ENTREE { sceneId, neuve: false }` à la place de
  `get().autoSave()` (`store.ts:2407`), donc après `advanceTime` et avant `openEncounterPsych` (le point
  de reprise précède la rencontre) ; `startScene` l'émet avec `neuve: true` après sa remise à neuf. Tout
  se joue dans la même pile synchrone, avant la prochaine image (la caméra se calcule une fois par
  image, `.claude/rules/rendu-et-rig.md`) ;
- l'adaptateur a UNE fonction, `remettreLAdaptateur(neuve)`, appelée par son écouteur de
  `SCENE_ENTREE` et par le chargement d'une save :
  - toujours : `camEdge` et `camPan` à leur valeur initiale, `resetStageGestes()` ;
  - sur `neuve: true` et au chargement, aussi `debugLabels`, `debugRoofCut`, `reveler`, `inspectId`,
    `sheetId`, `sheetTab`, `sheetScroll`, `sheetAlarmsSeen`, `hoverCombatantId`, `hovered`,
    `editingHeroId`, `gameMenuOpen`, `codexOverlay`, `compendiumFocus`, `possessionsScreen`,
    `combatCursor` (16 champs, ce que remet `startScene` aujourd'hui) ;
  - gardés : `camRot`, `zoom`, `viewMode`, `povActive` (comme `startScene`, `store.ts:2287`),
    `keyOverrides` (préférence, corrige le défaut du §1) et `ecranDuShell` (le chargement le remet à
    `null`, puisqu'il affiche `campaign`) ;
  - sur `neuve: false`, l'écouteur sauvegarde ensuite (`autoSave`). Un hôte qui ne sauvegarde pas
    n'écoute rien ;
- `startScene` repart d'`etatInitialDuJeu()` et ne garde que `screen`, `party` et `net` ; il ne lit
  plus aucun champ d'interface ;
- `combatEffects.ts:1543` (« nouveau héros ») émet `EVT.HEROS_A_CREER` ; l'adaptateur ouvre le créateur
  (`setEditingHero(null)`, `setScreen('creator')`).

**Le snapshot et la sauvegarde ne portent que la partie** (M2 v4). `netSnapshot` rend
`donneesDeLaPartie(get())` (stub de campagne et règles maison comme aujourd'hui) : ses trois
suppressions (`netFlow.ts:110-118`) disparaissent, la moitié d'interface ne part plus.
`applyNetSnapshot` pose `repriseDeLaPartie(game)` : les champs par client et toute la moitié
d'interface de l'invité restent les siens, ce qui corrige l'écrasement mesuré au §1. La save porte
`donneesDeLaPartie` (`DonneesDeSave` en dérive, `snapshotSave` itère les clés d'`etatInitialDuJeu()`) ;
`FORMAT_SAVE` change avec le type (`scripts/gen-formats.mjs`, racine `SaveGame`), et une save de
l'ancienne forme est jetée comme toute autre (`saves.ts`). `applyLoadedSave` pose
`repriseDeLaPartie(save.data)`, les champs par client à leur valeur initiale, `screen: 'campaign'`, le
`net` courant, puis `remettreLAdaptateur(true)`. `HORS_SAVE` perd `reveler`, `debugLabels` et
`debugRoofCut`, exclus par construction.

**Les écrans.** Le noyau porte `screen: EcranDuJeu`, l'écran partagé de la table (`menu`, `party`,
`creator`, `campaign`, `interlude`, `massBattle`, §1). L'adaptateur porte `ecranDuShell: EcranDuShell |
null` (`editor`, `test`, `coop`, `compendium`, `gallery`, `webglSpike`), par client puisqu'il ne voyage
plus. `ecranAffiche(s) = s.ecranDuShell ?? s.screen` (`store.ts`, A) est le seul lecteur de l'écran
affiché : `App.tsx:51`, les sept sites de `keybindings.ts`, `music.ts:27`, `devtools.ts:599, 757` et
`openCodex` le lisent. `setScreen` (adaptateur) range une valeur du shell dans `ecranDuShell`, et une
valeur du jeu dans `screen` en remettant `ecranDuShell` à `null`. `compendiumReturn` disparaît (fermer
le shell rend l'écran du jeu). L'arbitre garde `ecranPlein` sur le seul `screen` du jeu
(`modalArbiter.ts:332`).

**D6. Services de plateforme et coupes.** `src/noyau/plateforme.ts` déclare ce que le noyau demande à
l'environnement d'exécution : `programmer(suite, délai)` et `annuler(jeton)` (`combatFlow:19`,
`combatDirector:16`, `enchainerEtape:2`, `combatAuto:27` ; les deux minuteries d'aujourd'hui sont deux
alias de `track`, d'où une seule paire), et `persisterLeHeros(heros)` (`partyFlow:47`). Le mot
« plateforme » évite la collision avec l'hôte de jet (`hostStep`). L'adaptateur web la pose à la
création du store et relaie vers `web/minuteries` et `roster` ; un appel sans plateforme posée LÈVE. Le
reste :
- le bus (`state/bus.ts`, émetteur pur) déménage au noyau tel quel (fait, `5168069cd`) ; ses
  événements neufs (`SCENE_ENTREE`, `HEROS_A_CREER`) naissent en 3c avec leurs émetteurs ;
- `campaignData` : ses résolveurs prennent le narratif en argument, sur le patron qui existe déjà,
  `presetDuNarratif` (`campaignData.ts:42`) ; ils passent dans N avec `mergeCreatureProfile` et
  `nomDePreset`. Les sites appelants (~25, dont `nomDEntite(ent, presetPnjById)`) passent
  `presetDuNarratif(get().campaignNarratif)` ; la lecture du store reste dans A pour ses lecteurs
  d'`ui` ;
- `registerScene` (`store.ts:202`, avec `sceneRegistry`, `resetSceneRegistry`, `scenesDuRegistre`)
  passe dans N, avec `reposerPaquetDeCampagne` ;
- `exploreNav.ts:7` (`screenStepDot`) : la règle reçoit le pas d'écran de son appelant d'A
  (`stepPartyDir`) ;
- `actionRegistry.ts:17` importe `canMove`, `entityPickables` et `activeCombatant` de leurs modules
  (`mount`, `combatFlow`) ;
- **`IconId`** (M5 v4) : l'union des ids d'icône est une DONNÉE d'ids. `gen-registry.mjs` l'écrit dans
  un fichier généré à part, `src/data/icones.generated.ts` (`export type IconIdGenerated`), que
  `ui/icons/types.ts` et le noyau lisent ; le registre des définitions reste à
  `ui/icons/_registry.generated.ts`. `MANEUVER_ICON` et `REVEAL_ICON` gardent leur type
  `Record<…, IconId>` : toute table d'icônes du noyau reste contrôlée par le compilateur, quelle que soit
  sa clé ;
- `setAiTrace` (`ai.ts:62`) reste avec `ai.ts` dans N ; `devtools` (A) l'appelle, arc A → N ouvert.

**D7. Ce que le propriétaire de l'état déclenche** (M3 v4). Une règle ne capture jamais le store : elle
est une fonction du noyau, et chaque propriétaire (le store web, la partie de D9) l'appelle.
- **`brancherLeJeu(get, set, tables)`** pose ce qui ferme sur le propriétaire : `setConditionGainedHook`
  (`combatSlice.ts:417`), `setClotureDeCascade` (`:520`, `dispatchCascadeDone` ferme sur `get`/`set`),
  et les tables de D10. Le store l'appelle à sa création avec `tablesDuJeu()`, la partie à la sienne ;
  `debrancherLeJeu()` les retire ; une seconde pose sans retrait LÈVE (un seul propriétaire par contexte
  JS, H-a). `onConditionGained` garde le contrat du moteur, « Absent ⇒ aucune réaction »
  (`engine/conditions.ts:99-103`) : c'est le noyau qui garantit la pose.
- **L'horloge** : `signalerLAvanceeDHorloge(get, set, minutes)` émet `EVT.TIME_ADVANCED`, puis tire
  `fireScheduledEffects` et `purgeSurAvanceDHorloge`, dans l'ordre des deux écouteurs d'aujourd'hui
  (`store.ts:3295, 3300`). Les sept émetteurs (`advanceTime`, `store.ts:3169` ; `restFlow.ts:190, 517` ;
  `seaVoyageFlow.ts:1585` ; `travelFlow.ts:577, 826, 1452`) l'appellent ; les deux écouteurs
  disparaissent. #668 (« Échéancier narratif ABSOLU ») garde sa couture unique, sans capture.
- **La transition du jeu** : `transitionDuJeu(prev, s): Partial<EtatDeJeu> | null` porte la
  réconciliation de l'occupation (`releaseRecomposedRanks`, `store.ts:3315-3321`, sa réentrance
  structurelle comprise). Le store l'applique par son UNIQUE `useGame.subscribe` (A), qui applique
  ensuite les règles de l'adaptateur (la péremption du curseur, D4) ; la partie l'applique dans son
  `set`, après chaque écriture.
- **L'auto-cadence** (m11 v4) : `planifierLeTickAuto(get, set)` (`combatAuto.ts`, N) porte la règle
  d'`initCombatAuto` (`combatAuto.ts:239-245` : rien en cadence manuelle, un tick coalescé par
  `programmer(…, 0)` sinon). Le store web l'abonne à `main.tsx` comme aujourd'hui (la suite principale
  ne l'abonne pas, ses tests de cadence pilotent le tick) ; la partie l'appelle dans son `set` : sous une
  cadence « Rapide » ou « Auto-combat », `envoyer` rend le jeton du tick, que l'hôte rejoue par
  `reprendre`.
- **Les crochets de module** reçoivent des fonctions de module et deviennent des IMPORTS DIRECTS en 3d,
  leur code étant au noyau : `setTriggeredTestRouter`, `setOwnTestFailedEmitter`, `setFreeAttackHook`,
  `setFocusInterruptHook`, `setBladeTrapHook`, `setZoneCrossTestHook` (`combatSlice.ts:418-433`),
  `setSuiteApresCommit` (`combatEffects.ts:782`).
- Le siège agissant (`actingSeat`, `netOwnership.ts:115-129`) : la partie pose le `siege` de
  l'intention par `withActingSeat`, la primitive existante (D9).

**D8. Entrées de la partie : dés, règles maison, cadence, dés fixés.** Elles existent déjà en variables
de module : `seedBattleRng` (`noyau/battleRng.ts`), `loadRuleOverrides` (`engine/policy.ts:137`),
`setCadence` (`engine/cadence.ts:22`), `desFixes()` (`engine/fixedDie.ts`). `creerPartie` les pose
depuis ses entrées ; l'adaptateur web les pose comme aujourd'hui. Singletons par contexte JS (H-a), ce
qui amende la formule du plan §4 (« entrées fournies par l'hôte ») : fournies par l'hôte, oui ; passées
à chaque appel, non. Les défauts silencieux `rng = defaultRNG` sont retirés sur toute la classe par le
lot 3h, qui les re-mesure à sa base (le juge v4 n'a pas vérifié les comptes de la v4).

**D9. La surface : `src/noyau/index.ts` et la partie.** `creerPartie(etatInitial, entrees)` rend
`{ etat(), envoyer(intention) → evenements, reprendre(jeton) → evenements, fermer() }`. Un hôte qui
reprend une save passe `repriseDeLaPartie(donnees)` en état initial.
- **L'intention** : `{ type: K, args: Parameters<ActionsDuNoyau[K]>, siege? }` pour toute clé `K` de
  `ActionsDuNoyau`. La partie est propriétaire de l'état, comme le store web dont l'interface appelle
  toute action ; la classe coop ne borne donc pas l'union : `interne` compte des gestes de joueur
  (`moveParty`, `battleArmIntent`, §1). `cascadeNext`, `cascadeFinish`, les délégués et la `resolution`
  des flux y sont, puisque ce sont des actions du noyau.
- **Le siège** (M6 v4) : le corps d'`applyIntent` (`netFlow.ts:259-275`) devient UNE fonction du noyau,
  `appliquerLIntentionDUnSiege(get, siege, action, args)` : le filtre `GUEST_INTENTS`, puis
  `intentAllowedFor` (refus au journal), la réécriture du siège de `partyAddHero`/`partyReplaceHero`,
  puis l'action sous `withActingSeat`. `netFlow` (hôte web) et `envoyer` (intention avec `siege`)
  l'appellent ; `HostSession` perd son option `allow` (`net/session.ts:27, 64`), filtre devenu unique.
  Une intention de siège porte son verdict d'armement : `argsAvecVerdictLocal` est exporté par
  `index.ts` pour l'hôte qui le calcule chez son joueur, et un verdict absent vaut « non armé » (D4).
  Sans `siege`, le propriétaire agit.
- **La table des classes se scinde en 3e** : `TableDesClasses` est déjà générique sur l'état
  (`intents.ts:70`). Le noyau porte `CLASSE_DES_ACTIONS_DU_NOYAU satisfies TableDesClasses<Jeu>`, avec
  `ELECTIONS_LOCALES`, `OUVERTURE_DES_FLUX` (`intents.ts:338`) et `GUEST_INTENTS` (toutes leurs entrées
  sont des actions du noyau) ; l'adaptateur porte la table de ses 38 actions (`local`, `hôte`,
  `interne`) ; `netFlow` et `intents.test.ts` lisent les deux. La totalité reste gardée des deux côtés
  par le type.
- **La partie** : son `set` applique l'écriture, puis `transitionDuJeu` et `planifierLeTickAuto` (D7) ;
  elle pose une plateforme dont `programmer` rend un jeton au lieu d'armer un délai, appelle
  `brancherLeJeu(get, set, tablesDuJeu())`, pose les entrées (D8), et s'abonne au bus pour rendre les
  événements. `fermer()` débranche.
- `index.ts` est le SEUL baril légitime de `src/noyau` (D2). Il exporte la partie, les types
  d'`EtatDeJeu`, d'`ActionsDuNoyau`, de `DonneesDeLaPartie` et de l'intention, `repriseDeLaPartie`,
  `argsAvecVerdictLocal`, et les lecteurs purs dont un hôte a besoin pour montrer une fenêtre, chacun
  pris au module qui le déclare : les six premiers morceaux de
  `docs/plans/2026-10-19-modale-attaque-godot.md` (`previewAttack`, `defenseDodgeMods`,
  `rederiveAttack`, `opReroll`, `opBonusSL`, la re-résolution de l'attaque), rendus appelables sans
  store par 3c ; pour le septième, la donnée seule (`HitLocation` du moteur, le modificateur de la
  localisation visée par la table des règles chiffrées, `modDeRegle`) : les intitulés (« Attaque »,
  « Au hasard ») sont de la présentation, que chaque hôte écrit dans sa langue
  (`ui/jetProps/useAttackJetProps.tsx:88,253`).

**D10. Registres fermés et régime des tests** (M4 v4). Une fois le code au noyau, chaque registre rempli
à l'import devient une table statique typée par une union fermée (plan §3.2) : `registerCascadeApplier`,
`registerCascadeTableFold`, `registerTableStep(Family)`, `registerCascadeSuccessRule`,
`registerExtendedTestOutcome`, `registerCombatHook`, `registerHitModifier`, `registerCloture` (dont les
six clôtures de `store.ts:1818-1843`, qui sont des règles de jeu et y entrent avec leurs fonctions),
`registerCastSpellEffect`, `registerNightBandApplier`, `registerSequence*`, `registerPerilInterrupt`,
`registerEtalGenerateur`, `setManeuverPostHitHook`. `tablesDuJeu()` les rassemble, construites au
premier appel (aucun code de premier niveau ne les lit, ce qui évite la zone morte des `const` en
cycle). Le `ReferenceError` relevé par #2817 (« Combat : résoudre et appliquer une attaque sans le
store ») disparaît d'abord parce que le store sort de la fermeture du noyau (3b, 3c), puis parce que
plus rien ne s'inscrit à l'import.

**Le socle lit les tables POSÉES par `brancherLeJeu`, jamais un module de tables** : c'est le seam de
production. Régime des tests (inventaire `inscriptions.tsv`, 108 sites, 38 fichiers) :
- une entrée de production ne s'inscrit plus : elle est déclarée dans sa table ;
- un test du SOCLE, qui éprouve la machinerie sur des genres SYNTHÉTIQUES, pose une table de fixture
  nommée par l'unique helper `avecLesTables(fixture)` de `src/noyau/noyau.testkit.ts` : il débranche le
  jeu, le rebranche sur le même `get`/`set` avec la fixture, et restaure les tables du jeu dans son
  `afterEach` (« un régime se POSE par le seam sur une fixture, puis se restaure »,
  `.claude/rules/tests.md`). Une fixture qui a besoin d'un genre réel l'étale dans un objet neuf
  (`{ ...tablesDuJeu().appliers, deja: … }`), sans muter la table du jeu ;
- un test sur un genre RÉEL asserte l'effet observable sur une fixture, sans espion ni `vi.mock` :
  le `describe` « SEAM `onOwnTestFailed` » (`echec-sans-jet-appliers.test.ts:239-268`) porte un héros atteint des Crampes abdominales
  (`symptoms.json`, déclencheur `onOwnTestFailed`, MSRC 16) et asserte l'effet que leur échec pose,
  au lieu d'échanger l'émetteur (`:244-246`) ; ses genres `mono-sans-jet` et `bande-sans-jet` passent
  par `avecLesTables` ;
- l'instantané des registres de `test-setup.ts:100,462,481-482` disparaît : aucune table ne change plus
  entre deux tests hors de `avecLesTables`, qui restaure.

**D11. Gardes qui changent.** Toute garde, lint ou générateur qui nomme un chemin déplacé le suit
(patron du lot 2b) ; `combat-event-port-guard` : sa WHITELIST de 6 chemins
(`combat-event-port-guard.test.ts:24-31`) suit au noyau, sans entrée neuve. `targeting-holder-vs-mode`
confronte deux prédicats jumeaux (`targetingHolder.ts:26-33` ⇄ la tête de `currentTargetingMode`,
`targetingModes.ts:965-969`). 3a pose la structure qui rend la divergence impossible :
- `detenteurDuCiblage(s)` rend, dans l'ordre de priorité : le balayage ou la deuxième frappe (si
  `!pendingAttack && coupFerme(s)`), la Surincantation (`pendingCast.pickingTargets`), la pose de zone
  (`placingZoneOf(s)`, source `cast` ou `siege`) ;
- `targetingHolder` en dérive (balayage et deuxième frappe à l'identique ; `pendingSiegeAim` pour une
  zone de source `siege` ; rien sinon), la tête de `currentTargetingMode` aussi ;
- `placingZoneOf` n'en dérive PAS : c'est une entrée de `detenteurDuCiblage`, inchangée, et ses sept
  sites (`gameIso/stage/MondeDeCampagne.tsx:588`, `gameIso/stage/ZdeTemplate.tsx:28`,
  `actionRegistry.ts:510`, `combatFlow.ts:5489`, `devtools.ts:1569`, `targetingModes.ts:925` et `:969`)
  gardent leur réponse ;
- équivalence avec `targetingHolder` d'aujourd'hui, prouvée sur 160 états par `d11-matrice.mts` (0
  écart de détenteur, 0 écart de mode) ;
- l'invariant distinct du test (« tout détenteur est une fenêtre DÉCLARÉE à `HORS_MODAL` ») passe au
  type : `TARGETING_HOLDERS satisfies readonly HorsModalCoveredKey[]` (`modalArbiter.ts:356`, type
  exporté) ;
- la garde, son stock et son test sont supprimés dans ce commit-là, avec la sonde de mutation du codeur.

**D12. #2763 sort de la vague.** « AttackResult fermé » est bloqué par #1858 « File de frappes du
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

- **3a. Les coupes.**
  - Le bus au noyau (fait) ; `plateforme.ts` et sa pose ; les 14 arcs du §1 (D4 pour le curseur, D6
    pour le reste) ; `IconId` généré dans `src/data` (D6).
  - La péremption du curseur et l'abonnement unique du store (D4, D7), qui retirent les trois écritures
    de `combatCursor` par N ; le verdict du siège qui agit (`intentionDuProprietaire`, D4), avec un test
    qui exécute au nom d'un siège un clic sans verdict et asserte que l'intention armée du propriétaire
    survit et que rien ne court.
  - La suppression de `hoverDelta` (D5) ; `detenteurDuCiblage` et la suppression de
    `targeting-holder-vs-mode` (D11).
  - Preuve : `coupe.cjs` et `zones.cjs` sur la liste A rendent zéro arc de N vers A ou vers une zone
    fermée au noyau ; `acces-typés.cjs` et `n-touche-a` ne rendent plus que `combatEffects.ts:1543`,
    `modalArbiter.ts:332` et les accès du store (coupés en 3c).
- **3b. Le déménagement.** Les fichiers de N passent sous `src/noyau/`, au même chemin relatif, sauf le
  modèle du monde (liste fermée au brief ; critère : le module ne lit ni ne pose d'état de combat ni de
  flux) qui va sous `src/noyau/monde/`. Chaque test homonyme suit son module ; les testkits restent dans
  `state`, `cascadeTestKit` renommé `cascade.testkit.ts`. Les réexportations restantes du §1 sont
  supprimées et le baril `combatFlow` dissous, avec l'échafaudage de D2. Codemod `sondes/deplacer.cjs` :
  spécificateurs d'import, d'`import()`, d'`import type`, de `vi.mock` et de `require` réécrits par
  l'AST ; chemins littéraux repointés hors des dossiers d'historique (`docs/plans/`,
  `docs/superpowers/`, `docs/retours/`, `.claude/soldes/`). COUCHES ne change pas : l'arête de type
  `noyau → state` couvre les types encore lus au store. Preuve : lint 0, typecheck complet, suite
  complète, détection de renommage de git (le diff de contenu se limite aux spécificateurs et aux
  chemins), et l'ordre des inscriptions identique avant et après (sonde jouée au rendu : liste des clés
  de chaque registre, dans l'ordre, sur la base et sur la tête).
- **3c. Le type et les actions** (#2889).
  - `etat.ts` et `flowTypes` au noyau ; `etatInitialDuJeu`, `CHAMPS_PAR_CLIENT`, `HORS_SAVE`,
    `donneesDeLaPartie`, `repriseDeLaPartie` ; les 201 actions de jeu de `store.ts` et les déclarations
    de premier niveau rangées N au §1 dans des fabriques et des modules du noyau ; `sauter` et
    `actionnerLaPorte` (D5).
  - `signalerLAvanceeDHorloge` et `transitionDuJeu` (D7) ; `EcranDuJeu`, `ecranDuShell`,
    `ecranAffiche` ; `SCENE_ENTREE`, `HEROS_A_CREER`, `remettreLAdaptateur` ; le snapshot, la save et le
    chargement sur la partie (D5).
  - La sonde `snapshot-invite.mts` devient un test de `netFlow` : la moitié d'interface et les champs
    par client de l'invité survivent au snapshot de l'hôte.
  - Sonde d'entrée à la base du lot : un `tsc` sur `etat.ts` seul, arête retirée, avant de déplacer les
    actions. L'arête de type `noyau → state` sort de COUCHES (DoD de #2889, premier point).
  - Porte joueur au navigateur : une Course armée puis commise, une Charge, un changement de scène
    (caméra et gestes remis, sauvegarde d'entrée rechargée), un saut d'exploration et une porte, une
    touche reliée puis une partie lancée (la touche tient), le compendium ouvert et fermé, console à
    0 erreur.
- **3d. Les registres** (#2889). D10 en entier, tests compris, l'échafaudage de D2 retiré ;
  `brancherLeJeu` et ses tables (D7). Second point de la DoD de #2889 (« Restructuration, vague 4 »).
- **3h. Les dés sans défaut** (D8) : la classe `defaultRNG` sur tout `src/`, comptes re-mesurés à la
  base.
- **3e. La surface** (#2817).
  - La table des classes scindée, `appliquerLIntentionDUnSiege`, `index.ts`, `creerPartie` (D9).
  - Les tests hors store : une constante unique, `MOTIF_HORS_STORE = 'src/noyau/**/*.hors-store.test.ts'`
    (`scripts/guards/lib/racinesDeLaSuite.mjs`), sert à la fois l'exclusion de
    `EXCLUSIONS_DE_LA_SUITE` (que lisent `vite.config.ts`, les tranches de la CI `suiteVitest.mjs`,
    `scripts/test/run.mjs` par `enumerer` et la dérivation du périmètre
    `perimetreDerivation.mjs:96,131`) et l'`include` de `vitest.noyau.config.ts` (sans `setupFiles`,
    `isolate: true`). Un fichier `*.hors-store.test.ts` posé hors de `src/noyau` n'est pas exclu, donc
    joué par la suite principale : aucun orphelin possible. Les gardes de corpus de tests lisent la
    configuration dont elles gardent le régime : `tests-sans-horloge-guard` lit les deux suites,
    `vi-mock-isolate-guard` la seule suite à `isolate: false`. Un script `test:noyau`, son pas dans
    `ci.yml`, et `test:noyau` dans la porte locale du lot.
  - `partie.hors-store.test.ts` n'importe que `src/noyau/index.ts` et joue, par une partie, une attaque
    complète (déclaration, jet, défense, critique, mise hors de combat, `cascadeNext` jusqu'à la
    clôture), puis une intention de siège sans verdict ; `plateforme.hors-store.test.ts` vérifie qu'un
    appel sans plateforme posée lève et qu'une seconde `brancherLeJeu` lève.
  - Contrôle du graphe, sur les arcs de VALEUR : la fermeture de `src/noyau/index.ts` par `graphe.cjs`
    (qui suit aussi les motifs d'`import.meta.glob`, ajoutés à la sonde pour ce contrôle) ne contient
    aucun fichier de `state`, `ui`, `gameIso`, `web`, `net`, `audio`, ni `react` ; le metafile d'esbuild
    le confirme. Les arcs de TYPE atteignent encore `gameIso/rig` (par `data/index.ts:9` et
    `engine/types.ts:1855`) jusqu'à la vague 5 (#2884), qui les retire.
  - Mesure sur `poc/godot`, sans fusion. Porte joueur au navigateur (combat de l'Arène, une critique,
    une mise hors de combat, console à 0 erreur).

Ordre : 3a, 3b, 3c, 3d, 3h, 3e. Les vagues suivantes restent celles du plan : 5 (#2884) retire les
arêtes de contenu, dont `scenes → state`, que 3b réduit, et les arcs de type vers `gameIso/rig` ; 6
l'hôte Godot ; 7 le solde (le compte des gardes ; après 3c, `state` ne porte plus de règle, ce que la
re-mesure de la vague 7 confirme).

## 4. Hypothèses révisables

- H-a : un seul jeu par contexte JS (singletons de D7, D8 et de la plateforme) ; le jeu et le pont le
  font, et `brancherLeJeu` le fait respecter. En dev, `main.tsx` importe `store.ts` sans être une
  frontière de rechargement : une modification de `store.ts` ou d'un module qu'il importe recharge la
  page entière (sonde du juge v4), donc aucune seconde pose ne survient.
- H-b : la partition se rejoue à chaque lot par les sondes et le critère du §1 ; un élément mal rangé
  change d'ensemble avec ses lecteurs, et la liste se corrige ici.
- H-c : une PR 3b de l'ordre du lot 2b (1 317 fichiers) reste revuable parce qu'elle est mécanique ;
  sinon elle se scinde par composante fortement connexe du graphe de N.
- H-e : un écran du shell, une fiche ouverte, la fenêtre Codex, la caméra et les touches ne sont plus
  partagés en coop. Aujourd'hui le snapshot de l'hôte les écrase chez l'invité (§1, `snapshot-invite`) ;
  après 3c, chaque client garde les siens, et seul l'écran partagé de la table (`screen`) suit l'hôte.
  C'est de l'ergonomie révisable, pas une règle de jeu.

## 5. Réponses au verdict v4

| Point | Réponse |
|---|---|
| M1 coupes de champs | D4 : la péremption du curseur, une règle de l'adaptateur qui couvre `:1124`, `combatFlow.ts:7292` et `:7484`. §1 : `hoverDelta` est mort depuis `e4bf4d735`, supprimé en 3a avec son contrat sans objet. D5 : `etatInitialDuJeu()`, lu par `startScene`, la reprise et `creerPartie` ; `remettreLAdaptateur` dit les champs remis et gardés. |
| M2 snapshot et save | D5 : snapshot et save portent `donneesDeLaPartie` ; l'invité garde sa moitié d'interface et ses champs par client ; `FORMAT_SAVE` suit le type ; `ecranAffiche`, seul lecteur de l'écran affiché, aux 12 sites du §1. H-e réécrite sur la mesure. Le défaut de `keyOverrides` est corrigé. |
| M3 premier niveau du store | §1 : inventaire complet (`premier-niveau.cjs`), 14 déclarations citées par les actions. D7 : `signalerLAvanceeDHorloge`, `transitionDuJeu`, appelées par chaque propriétaire ; D10 : les six clôtures sont des règles, dans la table du noyau. |
| M4 régime des tests | D10 : le socle lit les tables posées par `brancherLeJeu` ; `avecLesTables(fixture)`, seul helper, restaure ; genre réel par l'effet observable (Crampes abdominales) ; ni `vi.mock`, ni espion, ni mutation. |
| M5 `IconId` | D6 : l'union générée passe dans `src/data/icones.generated.ts`, lue par le noyau et `ui` ; les deux tables restent typées `IconId`. |
| M6 siège | D4 : `intentionDuProprietaire`, lu par le verdict et par `consumeIntent`. D9 : `appliquerLIntentionDUnSiege`, appelée par `netFlow` et `envoyer`, `allow` retiré de `HostSession` ; `argsAvecVerdictLocal` exporté ; `CHAMPS_PAR_CLIENT`. |
| m1 comptes | §1 : 125 champs de jeu, 25 d'interface, 24 après la vague. |
| m2 `NetState` | D5 : `netFlow.ts:48-70`, avec `initialNet`. |
| m3 rechargement à chaud | D7 et 3d sans `import.meta.hot` ; H-a dit le rechargement complet. |
| m4 contrôle de graphe | 3e : arcs de valeur ; arcs de type vers `gameIso/rig` à la vague 5. |
| m5 motifs hors store | 3e : `MOTIF_HORS_STORE` unique, aucun orphelin possible, gardes de corpus nommées, `test:noyau` en porte locale. |
| m6 réexportations | §1 : 24 lignes dans 13 fichiers, par la commande ; `merchants/index.ts` cède sa place (D2). |
| m7 échafaudage | D2 : un seul, nommé, borné de 3b à 3d, ordre du baril gardé ; 3b prouve l'ordre. |
| m8 écrans | §1 : `screen` est l'écran partagé de la table ; `party` et `creator` par la composition d'équipe à plusieurs ; `massBattleFlow.ts:936` cité. |
| m9 point d'émission | D5 : `SCENE_ENTREE` à la place d'`autoSave` (`store.ts:2407`). |
| m10 second manifeste | Sans objet : `hoverDelta` est supprimé ; aucun manifeste neuf, les valeurs initiales d'interface sont dans le littéral de l'adaptateur. |
| m11 auto-cadence | D7 : `planifierLeTickAuto`, abonnée par `main.tsx`, appelée par le `set` de la partie ; le jeton passe par `reprendre`. |
| m12 règles de `gameIso` | D5 : `sauter` et `actionnerLaPorte` descendent au noyau en 3c, dans la vague. |
| m13 en-tête du codemod | `sondes/deplacer.cjs:8` nomme les quatre dossiers d'historique. |
| Non vérifiés v4 | D8 : comptes re-mesurés en 3h ; genres réels : D10 ; `poc/godot` : 3e ; ordre d'inscription : preuve de 3b. |
