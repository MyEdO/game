# Vagues 3 et 4 (#2817, #2889) : l'orchestration au noyau — paragraphe de design v6 (2026-10-20)

Épique #2882 (« Restructuration : des couches à frontières tenues, un noyau de règles appelable par tout
hôte »), plan `docs/plans/2026-10-19-restructuration.md`. Historique : v1 (`23e511c12`) REJETÉE
(`verdict-du-juge.md`, 3 bloquants) ; v2 (`9036aa19b`) REJETÉE (`verdict-du-juge-v2.md`, 1 bloquant,
6 majeurs, 7 mineurs) ; v3 (`662e46556`) REJETÉE (`verdict-du-juge-v3.md`, 1 bloquant, 4 majeurs,
9 mineurs) ; v4 (`7a6a1e57b`) REJETÉE (`verdict-du-juge-v4.md`, 0 bloquant, 6 majeurs, 13 mineurs) ;
v5 (`7e5d77832`) REJETÉE (`verdict-du-juge-v5.md`, 0 bloquant, 3 majeurs, 12 mineurs). Les cinq juges
ont gardé la méthode, et le v5 a validé ses mécanismes neufs (péremption du curseur, verdict du siège
qui agit, horloge, transition du jeu, tables posées, motif hors store). La v6 corrige les 15 points de
la v5 (§5). Ses corrections tiennent en quatre principes, appliqués à toute la classe et non au site
relevé :
- la moitié d'ADAPTATEUR de l'état ne voyage jamais : ni dans le snapshot coop, ni dans la sauvegarde ;
- ce qui est PAR CLIENT se déclare à une seule source, au niveau du champ : un champ mixte se scinde
  (`net`), et un champ par client ne s'écrit que pour le client propriétaire ;
- une règle que le propriétaire de l'état déclenche (écouteur, abonnement, verbe de clôture) est une
  fonction du NOYAU que chaque propriétaire appelle, jamais une capture du store ;
- un test pose un régime par un seam de PRODUCTION sur une fixture nommée, jamais par mutation d'un
  registre ni par `vi.mock` ;
- la vue d'un client SUIT la table : ce qu'elle doit refaire quand la partie change (écran du client,
  caméra, fenêtres) se dérive d'un fait de jeu partagé, observé par chaque client, jamais d'un événement
  émis chez le seul propriétaire.

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
- `invite-salon.mts`, `lecteurs-ecran.sh`, `reexports.cjs`, `reexports-noyau.cjs`, `toplevel-refs.cjs`,
  `init-calls.cjs` (juge v5) ;
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
  - `localIntent`, avec les champs `dispelCarrierId` et `refus` : des champs de jeu PAR CLIENT (D5) ;
  - `combatAuto` ENTIER, la planification du tick comprise (`planifierLeTickAuto`, D7) ;
    `initCombatAuto`, réduit à l'abonnement du store, passe dans `store.ts` (A) ;
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

**Le premier niveau de `store.ts`** (`premier-niveau.cjs`, 44 instructions hors imports) :

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

Les 201 actions qui descendent citent en valeur 11 déclarations de premier niveau (`toplevel-refs.cjs`) :
`registerScene`, `useGame` (par `getInitialState`, D5), `sceneRegistry`, `arriveeOccupee`, `tombantsDe`,
`settleFall`, `placesDe`, `seLeverDe`, `sasseoirA`, `JOUER_CAPACITE`, `applyDialogueTransition` ; en
type, `GameState`.

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
  24 avec `ecranDuClient` (D5) ;
- 125 champs de jeu. Ce que l'invité garde à l'application d'un snapshot (`applyNetSnapshot`,
  `netFlow.ts:160-182`) est PAR CLIENT : trois champs entiers, `localIntent`, `dispelCarrierId`,
  `refus` (retirés du snapshot, `:110, 114, 118`, puis préservés, `:171-173`) ; quatre sous-champs de
  `net`, `mode`, `mySeat`, `connection`, `hostAway` (`:174-180`) ; et l'écran `creator` quand l'hôte est
  sur `party` (`keepCreator`, `:165, 170`). `NetState` (`:48-70`) mêle donc une part partagée
  (`roomCode`, `seatNames`, `presence`, `ownership`, `slots`, `gmSeat`) et une part par client, lue
  par 90 sites de production dans 33 fichiers (`git grep -nE "net\??\.(mode|mySeat|connection|hostAway)\b"`) ;
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
- Cinq sont l'écran PARTAGÉ de la table : `screen` voyage dans le snapshot, et l'invité suit l'hôte. Ce
  sont `menu` (défaite, `store.ts:2853` ; `massBattleFlow.ts:936`), `party` (la composition d'équipe se
  fait à plusieurs, l'invité suit l'hôte du salon à l'équipe, `CoopLobby.tsx:131`), `campaign`,
  `interlude` (`interludeFlow.ts:220, 1440, 1462`), `massBattle` (`massBattleFlow.ts:305, 308, 831,
  865`).
- Sept sont l'écran d'UN client : `creator` (chaque joueur crée SON héros ; `keepCreator` est
  aujourd'hui le correctif qui le rend local chez l'invité, et l'hôte qui crée un héros entraîne encore
  ses invités dans le créateur), et le shell web `editor`, `test`, `coop`, `compendium`, `gallery`,
  `webglSpike`.
- Le salon coop est un écran du client que la table fait quitter : l'invité attend sur `coop`
  (`CoopLobby.tsx:107`) et passe sur `party` quand le snapshot de l'hôte y arrive (`invite-salon.mts`,
  à `cf4f18bcf` : « écran de l'invité après le snapshot = party »).
- Lecteurs de l'écran AFFICHÉ hors test, dans `src` et `scripts` (`lecteurs-ecran.sh`, sans exclusion) :
  `ui/App.tsx:51` (puis `:77-87`), `clavier/keybindings.ts:220, 253, 275, 276, 281, 283, 495`,
  `audio/music.ts:27`, `devtools.ts:599, 757, 1030` (`__wfrp.screen` rend `g().screen`), `openCodex`
  (`store.ts:2136, 2142`), et le kit de recette `scripts/recette/lib.mjs:775` (`APP_READY`) et `:914`
  (`gotoScreen`, qui attend `getState().screen === name`), soit 16 sites ; ses fixtures
  `scripts/recette/lib.test.mjs:192-202` et `:2561` simulent `getState().screen`. Lecteurs de l'écran
  du JEU : `modalArbiter.ts:332` (`ecranPlein`), `startScene` (`store.ts:2287`). Le commentaire
  `modalArbiter.ts:313-317` dit l'écran `compendium` partagé.

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
en deux contrôles distincts : l'allowlist par `HostSession` (`net/session.ts:64`, `allow`, une
intention hors liste ignorée en silence), puis la possession par `intentAllowedFor`
(`netOwnership.ts:586-589`), dans le corps d'`applyIntent` (`netFlow.ts:259-275`), qui réécrit aussi le
siège de `partyAddHero`/`partyReplaceHero`. Trois tests recopient ce corps :
`guest-intent-path.test.ts:57`, `hors-modal-intent-path.test.ts:74`, `surface-1050-intent-path.test.ts:68` ;
deux portent `allow` : `net/session.test.ts:24, 46-51`, `net/relay.test.ts:70`.
`localIntent` est UN champ par client : chez l'hôte, l'intention d'un invité qui ne porterait pas son
verdict retomberait sur `courseArmee(get)` (`combatSlice.ts:939`), donc sur l'intention de l'HÔTE, et
`consumeIntent()` (`combatSlice.ts:524-528`) dissout aujourd'hui l'intention armée de l'hôte sur tout
clic exécuté au nom d'un invité. Même classe pour `refus` : `refuserGeste` (`refusVisible.ts:43`) écrit
le refus d'un geste exécuté au nom d'un siège dans le `refus` de l'hôte, alors qu'il appartient à
l'invité (`netFlow.ts:115-117`), qui ne le voit jamais.

**L'auto-cadence et l'horloge dans les tests.** `initCombatAuto` (`combatAuto.ts:239-245`) a deux
appelants : `main.tsx:42` et `tir-rapide-combats-complets.test.ts:95` (`initCombatAuto();
setCadence('auto')`), qui ne se désabonne jamais (aucun retour de désabonnement), si bien que
l'abonnement survit aux fichiers suivants du worker (`isolate: false`). Deux tests émettent
`EVT.TIME_ADVANCED` sur le bus et attendent l'effet des écouteurs : `delayed-effect-absolute.test.ts:72-86`
et `determination-conscience.test.ts:116-125`.

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

**Réexportations** (par l'AST, `reexports.cjs` et `reexports-noyau.cjs` : `export … from`, formes
multi-lignes comprises, et `export { x }` d'un nom importé) :
- `src/state`, 38 dans 18 fichiers : `store.ts:49, 54, 63, 153, 156, 159, 218` ; le baril
  `combatFlow.ts:246, 247, 250, 253, 268, 272, 274, 275, 281, 283, 286` ; `targeting.ts:20, 21` (dont la
  valeur `spellAffinity`) ; `rollFlowSpecs.ts:204, 2100` ; `sequenceCore.ts:53, 56` ;
  `sequenceContract.ts:57` ; `combatManeuvers.ts:310` ; `spawn.ts:80` ; `portFlow.ts:481` ;
  `buildings.ts:30` ; `dispositionConsole.ts:31` ; `merchants/index.ts:4, 5` (baril) ; et en
  import-puis-export `bourseFlow.ts:20`, `fireArc.ts:16`, `possessionsFlow.ts:15`, `shipManeuver.ts:40`,
  `shipPostes.ts:22`, `upkeep.ts:55` ;
- `src/noyau`, 8 dans 7 fichiers : `combat/flowEval.ts:22`, `monde/flow.ts:20`, `monde/path.ts:461`,
  `monde/scene.ts:67, 313`, `monde/terrain/index.ts:22`, `pendings.ts:37`, `rollSeam.ts:425`.

La commande `git grep` de la v5 n'en voyait que 28 lignes : ni les formes multi-lignes, ni
l'import-puis-export.

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
hors `src/noyau/index.ts` (D9) : les 46 réexportations du §1, de `src/state` et de `src/noyau`, sont
supprimées (celles de `store.ts:49, 54` dès 3a, pour couper l'arc d'`actionRegistry` ; les autres en
3b), leurs importeurs réécrits vers le module qui déclare ; `merchants/index.ts` cède sa place à ses
modules ; le baril `combatFlow` se dissout ; `monde/terrain/index.ts`, module de 168 lignes et non
baril, ne garde que ses déclarations. La classe reçoit sa garde mécanique en 3b
(`scripts/guards/lib/reexportations.mjs`, l'AST de `reexports.cjs` promu, stock vide sur `src/noyau`
hors `index.ts` et sur `src/state`), parce qu'une purge sans garde se défait au lot suivant (credo).
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
  verdict comme aujourd'hui (`argsAvecVerdictLocal`, `netFlow.ts:209`) ;
- **un champ par client ne s'écrit que pour le client propriétaire** (m5 v5, la classe de la ligne
  précédente) : toute écriture du noyau d'un champ de `CHAMPS_PAR_CLIENT` (D5) passe par
  `ecrireLeClient(get, set, patch)` (`localIntent.ts`), sans effet sous un siège agissant (les remises
  à neuf par `etatInitialDuJeu`, que seul le propriétaire joue, n'en sont pas). Le refus d'un
  geste exécuté au nom d'un siège ne se perd pas : `refuserGeste` l'écrit alors au journal, partagé,
  comme il le fait déjà hors combat (`refusVisible.ts:39-42`). La preuve de 3c : `git grep` des
  écritures de ces champs dans `src/noyau` ne rend que `ecrireLeClient`.

**D5. Le type de l'état et des actions sort du store.** `src/noyau/etat.ts` déclare :
- `EtatDeJeu` : les 125 champs de jeu du §1, `net` scindé, plus `reseauDuClient` et `entreeEnScene`
  (ci-dessous), soit 127. Leurs types vont au noyau avec eux : `BattleActionMode` et sa valeur
  `MODES_HORS_REGISTRE` (`actionRegistry.ts:548`, que garde `action-atteignabilite.test.ts:229`) suivent
  `actionRegistry` dans N ; `LocalIntent` suit `localIntent` ; les types du premier niveau de
  `store.ts` rangés N au §1 aussi ;
- **`net` se scinde** (M3 v5) : `NetState` (`netFlow.ts:48-70`, avec `initialNet`) va au noyau réduit à
  sa part partagée (`roomCode`, `seatNames`, `presence`, `ownership`, `slots`, `gmSeat`) ; sa part par
  client devient le champ `reseauDuClient: { mode, mySeat, connection, hostAway }`. Les 90 lecteurs du
  §1 (`net.mode`, `net.mySeat`, `net.connection`, `net.hostAway`) lisent `reseauDuClient` ; le
  compilateur les trouve tous, puisque le type de `net` perd ces clés ;
- `CHAMPS_PAR_CLIENT = ['localIntent', 'dispelCarrierId', 'refus', 'reseauDuClient'] as const` : la
  SEULE source de ce qui est par client dans l'état du jeu, lue par le snapshot, la reprise, la save et
  `ecrireLeClient` (D4). La règle du créateur n'y figure pas : `creator` devient un écran de client
  (ci-dessous), et `keepCreator` (`netFlow.ts:165, 170`) disparaît ;
- `HORS_SAVE = { campaignNarratif: … }` (déplacé de `saves.ts`, qui ne garde que la persistance) ;
- `etatInitialDuJeu(): EtatDeJeu`, valeurs initiales des 127 champs (le littéral de `create` pour ses
  champs de jeu, plus `initialFields()` du manifeste `stateFields` ; ses initialiseurs non littéraux,
  `campaignStart`, `dayIndex`, `emptyWorldMap`, `initialNet`, sont des fonctions de N,
  `init-calls.cjs`), lue par `startScene`, par la reprise et par `creerPartie` ;
- `DonneesDeLaPartie` : les champs d'`EtatDeJeu` moins `CHAMPS_PAR_CLIENT` et `HORS_SAVE`, type
  dérivé, et `donneesDeLaPartie(jeu)`, qui les copie en itérant les clés d'`etatInitialDuJeu()` ;
- `repriseDeLaPartie(donnees)` : `etatInitialDuJeu()` moins `CHAMPS_PAR_CLIENT`, les données
  par-dessus, l'élagage des places (`pruneSeatAssignments`, aujourd'hui `store.ts:105-108`) et
  `reposerPaquetDeCampagne`. Elle ne touche donc jamais `reseauDuClient` : l'invité garde `mode`,
  `mySeat`, `connection` et `hostAway` par construction, et le chargement d'une save garde la session
  réseau courante (ce que fait `applyLoadedSave` aujourd'hui en posant le `net` courant, `store.ts:109`) ;
- `ActionsDuNoyau` : les 201 actions de jeu de `store.ts`, `combatSlice` sans le curseur,
  `RollFlowActionsMap` (`attackRoll`, `cascadeRoll`…, `rollFlowSpecs.ts:2131-2134`), et deux actions
  neuves descendues de `gameIso` (m12 v4) : `sauter(chemin, indice)` (élan, `planJump`, refus,
  `moveParty`, `runFlow`, `useStagePointer.ts:231-251`) et `actionnerLaPorte(portail)` (`toggleDoorIn`,
  `:277`, `:288`) ; `useStagePointer` garde la cadence de la marche et appelle ces deux actions ;
  toutes créées par des fabriques du noyau `(get, set) => actions` (la forme de `createCombatSlice`).
  Classes coop des deux neuves (m8 v5) : `sauter` est un pas de la marche d'exploration, classe
  `interne` comme `moveParty` (`intents.ts:288`) ; `actionnerLaPorte` est un geste de jeu, classe
  `invité`, possession par le repli universel d'`intentAllowedFor` (`netOwnership.ts:576-582` : en
  combat, le propriétaire du tour actif ; hors combat, la fenêtre ouverte, sinon l'hôte). L'invité
  n'ouvre donc plus une porte dans sa seule copie de la scène, que le snapshot suivant écrasait ;
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
- `startScene` repart d'`etatInitialDuJeu()` et ne garde que `screen`, `party`, `net` et
  `reseauDuClient` ; il ne lit plus aucun champ d'interface ;
- `combatEffects.ts:1543` (« nouveau héros ») émet `EVT.HEROS_A_CREER` ; l'adaptateur du propriétaire
  ouvre SON créateur (`setEditingHero(null)`, `setScreen('creator')`), sans entraîner ses invités.

**L'entrée en scène est un fait de jeu partagé** (m7 v5). Le champ de jeu `entreeEnScene: { sceneId,
neuve, rang } | null` est posé par `marquerLEntree(get, set, neuve)` (N), dont `rang` vaut un de plus
que le plus grand des rangs connus (l'état courant, et pour le chargement la save) : deux entrées
successives diffèrent toujours. Il voyage dans le snapshot, comme `screen`. Le posent :
- `transitionTo`, avec `neuve: false`, à la place de `get().autoSave()` (`store.ts:2407`), donc après
  `advanceTime` et avant `openEncounterPsych` (le point de reprise précède la rencontre) ;
- `startScene`, avec `neuve: true`, après sa remise à neuf ;
- le chargement d'une save, avec `neuve: true`, après la reprise.

Chaque client l'observe, par l'abonnement du store (D7) : quand le rang change, son adaptateur appelle
`remettreLAdaptateur(neuve)`. Chez le seul propriétaire (`reseauDuClient.mode !== 'guest'`), une entrée
`neuve: false` sauvegarde ensuite (`autoSave`) ; un hôte qui ne sauvegarde pas n'observe rien. Tout se
joue dans la même pile synchrone, avant la prochaine image (la caméra se calcule une fois par image,
`.claude/rules/rendu-et-rig.md`). `remettreLAdaptateur(neuve)` :
- toujours : `camEdge` et `camPan` à leur valeur initiale, `resetStageGestes()` ;
- sur `neuve: true`, aussi `debugLabels`, `debugRoofCut`, `reveler`, `inspectId`, `sheetId`,
  `sheetTab`, `sheetScroll`, `sheetAlarmsSeen`, `hoverCombatantId`, `hovered`, `editingHeroId`,
  `gameMenuOpen`, `codexOverlay`, `compendiumFocus`, `possessionsScreen`, `combatCursor` (16 champs, ce
  que remet `startScene` aujourd'hui) ;
- gardés : `camRot`, `zoom`, `viewMode`, `povActive` (comme `startScene`, `store.ts:2287`),
  `keyOverrides` (préférence, corrige le défaut du §1) et `ecranDuClient` (que règle la péremption
  ci-dessous).

**Le snapshot et la sauvegarde ne portent que la partie** (M2 v4). `netSnapshot` rend
`donneesDeLaPartie(get())` (stub de campagne et règles maison comme aujourd'hui) : ses trois
suppressions (`netFlow.ts:110-118`) disparaissent, la moitié d'interface et la part par client ne
partent plus. `applyNetSnapshot` pose `repriseDeLaPartie(game)` : les champs par client et toute la
moitié d'interface de l'invité restent les siens, ce qui corrige l'écrasement mesuré au §1 et retire la
fusion de `net` (`:174-180`). La save porte `donneesDeLaPartie` (`DonneesDeSave` en dérive,
`snapshotSave` itère les clés d'`etatInitialDuJeu()`) ; `FORMAT_SAVE` change avec le type
(`scripts/gen-formats.mjs`, racine `SaveGame`), et une save de l'ancienne forme est jetée comme toute
autre (`saves.ts`). `applyLoadedSave` pose `repriseDeLaPartie(save.data)`, les champs par client hors
`reseauDuClient` à leur valeur initiale, `screen: 'campaign'`, puis `marquerLEntree(neuve: true)`.
`HORS_SAVE` perd `reveler`, `debugLabels` et `debugRoofCut`, exclus par construction.

**Les écrans.** Le noyau porte `screen: EcranDuJeu`, l'écran partagé de la table (`menu`, `party`,
`campaign`, `interlude`, `massBattle`, §1). L'adaptateur porte `ecranDuClient: EcranDuClient | null`
(`creator`, `editor`, `test`, `coop`, `compendium`, `gallery`, `webglSpike`), par client puisqu'il ne
voyage plus.
- **Péremption** (M1 v5) : l'écran du client cède quand la table change d'écran. L'abonnement du store
  (D7) remet `ecranDuClient` à `null` quand `screen` change entre deux états, sur le patron de la
  péremption du curseur. L'invité au salon (`coop`) suit donc l'hôte sur `party`, puis sur `campaign`
  après un chargement en session ; l'invité dans son créateur le quitte quand l'hôte lance la partie
  (ce que fait `keepCreator` aujourd'hui) ; l'hôte dans le compendium voit la défaite qui le renvoie au
  menu.
- `ecranAffiche(s) = s.ecranDuClient ?? s.screen` (`store.ts`, A) est le seul lecteur de l'écran affiché.
  Les 16 sites du §1 le lisent : `App.tsx`, `keybindings.ts` ×7, `music.ts`, `devtools.ts` ×3
  (`__wfrp.screen` et `__wfrp.state().screen` rendent l'écran affiché ; un accesseur
  `__wfrp.ecran()` le lit), `openCodex` ×2, et le kit de recette, dont `APP_READY` et `gotoScreen` lisent
  `window.__wfrp.ecran()` au lieu de `window.__game.getState().screen` ; les deux fixtures de
  `lib.test.mjs` simulent cet accesseur.
- `setScreen` (adaptateur) range une valeur de client dans `ecranDuClient`, et une valeur du jeu dans
  `screen` en remettant `ecranDuClient` à `null`. `compendiumReturn` disparaît (fermer l'écran du client
  rend l'écran du jeu).
- L'arbitre garde `ecranPlein` sur le seul `screen` du jeu (`modalArbiter.ts:332`) : il ne bloque plus
  les gestes d'un invité quand l'hôte est dans un écran de client. Son commentaire
  (`modalArbiter.ts:313-317`, « l'écran `compendium` est PARTAGÉ ») se réécrit dans le même commit.

**D6. Services de plateforme et coupes.** `src/noyau/plateforme.ts` déclare ce que le noyau demande à
l'environnement d'exécution : `programmer(suite, délai)` et `annuler(jeton)` (`combatFlow:19`,
`combatDirector:16`, `enchainerEtape:2`, `combatAuto:27` ; les deux minuteries d'aujourd'hui sont deux
alias de `track`, d'où une seule paire), et `persisterLeHeros(heros)` (`partyFlow:47`). Le mot
« plateforme » évite la collision avec l'hôte de jet (`hostStep`). L'adaptateur web la pose à la
création du store et relaie vers `web/minuteries` et `roster` ; un appel sans plateforme posée LÈVE. Le
reste :
- le bus (`state/bus.ts`, émetteur pur) déménage au noyau tel quel (fait, `5168069cd`) ; ses
  événement neuf (`HEROS_A_CREER`) naît en 3c avec son émetteur ;
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
  `ui/icons/_registry.generated.ts`. L'outillage (m12 v5) : une option générale `idUnion.out` de la
  cible (`cibles-registres.mjs:292-299`), qui vaut pour toute cible et sans cas propre aux icônes, et que
  `gen-registry.mjs:123-131` honore ; `scripts/docs/build-icones.mjs:47-52` et
  `build-icones.test.mjs:12-23` lisent l'union à son fichier neuf. `MANEUVER_ICON` et `REVEAL_ICON` gardent leur type
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
  (`store.ts:3295, 3300`). Les deux tests qui émettent l'événement à la main
  (`delayed-effect-absolute.test.ts:72-86`, `determination-conscience.test.ts:116-125`) appellent la
  primitive. Les sept émetteurs (`advanceTime`, `store.ts:3169` ; `restFlow.ts:190, 517` ;
  `seaVoyageFlow.ts:1585` ; `travelFlow.ts:577, 826, 1452`) l'appellent ; les deux écouteurs
  disparaissent. #668 (« Échéancier narratif ABSOLU ») garde sa couture unique, sans capture.
- **La transition du jeu** : `transitionDuJeu(prev, s): Partial<EtatDeJeu> | null` porte la
  réconciliation de l'occupation (`releaseRecomposedRanks`, `store.ts:3315-3321`, sa réentrance
  structurelle comprise). Le store l'applique par son UNIQUE `useGame.subscribe` (A), qui applique
  ensuite les règles de l'adaptateur : la péremption du curseur (D4), celle de l'écran du client et
  l'observation de l'entrée en scène (D5). La partie l'applique dans son `set`, après chaque écriture.
- **L'auto-cadence** (m11 v4, m4 v5) : `planifierLeTickAuto(get, set)` (`combatAuto.ts`, N) porte la
  règle d'`initCombatAuto` (`combatAuto.ts:239-245` : rien en cadence manuelle, un tick coalescé par
  `programmer(…, 0)` sinon). `initCombatAuto()` (`store.ts`, A) abonne le store à cette fonction et rend
  son désabonnement ; ses deux appelants restent `main.tsx:42` et
  `tir-rapide-combats-complets.test.ts:95`, qui se désabonne désormais dans son `afterAll` (l'abonnement
  survivait aux fichiers suivants du worker, §1). Les autres tests de cadence pilotent le tick à la
  main. La partie appelle `planifierLeTickAuto` dans son `set` : sous une cadence « Rapide » ou
  « Auto-combat », `envoyer` rend le jeton du tick, que l'hôte rejoue par `reprendre`.
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
  `appliquerLIntentionDUnSiege(get, siege, action, args)` : l'allowlist `GUEST_INTENTS`, puis la
  possession par `intentAllowedFor`, deux contrôles distincts, chacun refusé au journal
  (`coop.intentRefused` ; une intention hors allowlist, ignorée en silence aujourd'hui, est un client
  qui triche et se dit) ; puis la réécriture du siège de `partyAddHero`/`partyReplaceHero`, puis
  l'action sous `withActingSeat`. `netFlow` (hôte web) et `envoyer` (intention avec `siege`)
  l'appellent ; `HostSession` perd son option `allow` (`net/session.ts:27, 64`), parce que le point
  d'entrée des intentions devient unique. `net/session.test.ts:24, 46-51` et `net/relay.test.ts:70`
  perdent `allow` ; les trois tests qui recopient le corps d'`applyIntent` (§1) appellent la fonction.
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
- `index.ts` est le SEUL module de `src/noyau` qui réexporte (D2, garde de 3b). Il exporte la partie, les types
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
`registerEtalGenerateur`, `setManeuverPostHitHook`. L'union fermée porte sur les clés de CODE (genres
d'étape, familles de tables, verbes) ; une famille de tables tirables, dont les clés sont des ids de
données (`noyau/cascade.ts:255-276`, `corruptionFlow.ts:155-197`, `seaVoyageFlow.ts:1170`), reste un
ACCESSEUR vivant (`memoParVersion`, #1692 « pas d'index figé sur un dataset mutable ») : la table
porte l'accesseur, jamais son évaluation. `tablesDuJeu()` rassemble les tables à son premier appel (aucun
code de premier niveau ne les lit, ce qui évite la zone morte des `const` en cycle) ; ce qu'elle
mémorise est le conteneur de fonctions et d'accesseurs, si bien qu'une donnée éditée au Codex se relit
comme aujourd'hui. `index-vivant-guard.test.ts:38-63` déclare cette forme (« FABRIQUE INTER-MODULE »)
angle mort : un test de 3d édite une donnée tirable par le seam d'édition (`setDataset`), tire, et
restaure. Le `ReferenceError` relevé par #2817 (« Combat : résoudre et appliquer une attaque sans le
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
  supprimées, de `src/state` comme de `src/noyau`, le baril `combatFlow` dissous avec l'échafaudage de
  D2, et la garde `reexportations.mjs` posée. Codemod `sondes/deplacer.cjs` :
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
  - `signalerLAvanceeDHorloge` et `transitionDuJeu` (D7) ; `net` scindé et `reseauDuClient` ;
    `ecrireLeClient` (D4) ; `EcranDuJeu`, `ecranDuClient`, sa péremption, `ecranAffiche` aux 16 sites ;
    `entreeEnScene`, `marquerLEntree`, `remettreLAdaptateur`, `HEROS_A_CREER` ; le snapshot, la save et
    le chargement sur la partie (D5).
  - Tests de `netFlow` promus des sondes : `snapshot-invite.mts` (la moitié d'interface et les champs
    par client de l'invité, `reseauDuClient` compris, survivent au snapshot de l'hôte) et
    `invite-salon.mts` (un invité au salon suit l'hôte sur `party`, puis sur `campaign` après un
    chargement en session) ; un test d'entrée en scène chez l'invité (sa caméra se remet quand le
    snapshot porte une entrée neuve) ; un test de refus sous siège agissant (le refus va au journal,
    pas au `refus` de l'hôte).
  - Sonde d'entrée à la base du lot : un `tsc` sur `etat.ts` seul, arête retirée, avant de déplacer les
    actions. L'arête de type `noyau → state` sort de COUCHES (DoD de #2889, premier point).
  - Porte joueur au navigateur : une Course armée puis commise, une Charge, un changement de scène
    (caméra et gestes remis, sauvegarde d'entrée rechargée), un saut d'exploration et une porte, une
    touche reliée puis une partie lancée (la touche tient), le compendium ouvert et fermé par
    `gotoScreen` du kit de recette, console à 0 erreur.
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
  - `vitest.noyau.config.ts` charge les données par la même porte que la suite (m9 v5) : son seul
    greffon est `proseSource()` (`scripts/source/prose-source-plugin.mjs`, celui de `vite.config.ts:43`),
    sans `registryGen` ni `react`, si bien que les `src/data/*.json` y sont matérialisés comme le veut
    `data/index.ts:166-171`. Le metafile d'esbuild de 3e ne mesure que le graphe, où la forme disque du
    JSON suffit ; le chargement des données par l'hôte Godot est l'affaire de la vague 6.
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
- H-e : un écran de client, une fiche ouverte, la fenêtre Codex, la caméra et les touches ne sont plus
  partagés en coop. Aujourd'hui le snapshot de l'hôte les écrase chez l'invité (§1, `snapshot-invite`) ;
  après 3c, chaque client garde les siens, et ne suivent l'hôte que l'écran partagé de la table
  (`screen`, qui périme l'écran du client) et l'entrée en scène (qui remet la vue de chaque client).
  Le compendium ou le créateur de l'hôte n'entraînent plus ses invités. C'est de l'ergonomie
  révisable, pas une règle de jeu.

## 5. Réponses au verdict v5

Les réponses au verdict v4 sont dans la v5 (`7e5d77832`, §5), que le juge v5 a jugées point par point.

| Point | Réponse |
|---|---|
| M1 salon coop | D5 : l'écran du client se périme quand l'écran de la table change ; `invite-salon.mts` devient un test de `netFlow` (3c). |
| M2 lecteurs de l'écran | §1 : 16 sites dans `src` et `scripts`, par `lecteurs-ecran.sh` sans exclusion ; D5 : `ecranAffiche` partout, `__wfrp.screen`, `__wfrp.state()` et `__wfrp.ecran()` sur l'écran affiché, kit de recette et ses deux fixtures sur `__wfrp.ecran()` ; la porte de 3c passe par `gotoScreen`. |
| M3 part par client | D5 : `net` scindé, `reseauDuClient` dans `CHAMPS_PAR_CLIENT`, seule source ; `repriseDeLaPartie` ne touche jamais la part par client ; `creator` devient un écran de client, `keepCreator` disparaît ; test de parité en 3c. |
| m1 réexportations | §1 : 38 dans 18 fichiers de `src/state` et 8 dans 7 de `src/noyau`, par l'AST ; D2 : toutes supprimées, garde `reexportations.mjs` en 3b ; `monde/terrain/index.ts` est un module, non un baril. |
| m2 comptes | §1 : 44 instructions, 11 déclarations en valeur nommées, `GameState` en type. |
| m3 tests rouges | §1 et D7, D9 : les deux tests de `TIME_ADVANCED` appellent la primitive ; `session.test.ts` et `relay.test.ts` perdent `allow` ; les trois copies d'`applyIntent` appellent la fonction du noyau. |
| m4 auto-cadence | D7 : `initCombatAuto` dans `store.ts`, rend son désabonnement ; ses deux appelants nommés, le test se désabonne. |
| m5 `refus` | D4 : un champ par client ne s'écrit que pour le propriétaire (`ecrireLeClient`) ; le refus d'un siège va au journal ; test en 3c. |
| m6 deux contrôles | §1 et D9 : allowlist et possession sont distincts ; le retrait d'`allow` tient à l'unicité du point d'entrée ; une intention hors allowlist se dit au journal. |
| m7 invité et scène | D5 : `entreeEnScene`, fait de jeu partagé observé par chaque client ; la sauvegarde d'entrée chez le seul propriétaire ; test en 3c. |
| m8 classes coop | D5 : `sauter` `interne` comme `moveParty`, `actionnerLaPorte` `invité` sous le repli universel. |
| m9 greffons | 3e : `vitest.noyau.config.ts` a pour seul greffon `proseSource()` ; le metafile ne mesure que le graphe ; l'hôte Godot à la vague 6. |
| m10 tables tirables | D10 : l'union fermée porte sur les clés de code ; une famille tirable reste un accesseur vivant ; test d'édition puis tirage en 3d. |
| m11 commentaire vivant | D5 : `modalArbiter.ts:313-317` réécrit dans le commit, avec sa conséquence dite. |
| m12 outillage d'`IconId` | D6 : option générale `idUnion.out`, `gen-registry.mjs:123-131`, `build-icones.mjs:47-52` et son test. |
| Non vérifiés v5 | D8 : 131 défauts `= defaultRNG` dans 48 fichiers de production selon le juge v5, re-mesurés en 3h ; `poc/godot` : 3e ; ordre d'inscription : preuve de 3b, sur tout le graphe et non sur les seuls imports de `store.ts`. |
