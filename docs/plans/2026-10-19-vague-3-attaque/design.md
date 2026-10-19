# Vagues 3 et 4 (#2817, #2889) : l'orchestration au noyau — paragraphe de design v2 (2026-10-20)

Épique #2882, plan `docs/plans/2026-10-19-restructuration.md`. La v1 (même fichier, commit `23e511c12`)
a été REJETÉE par un juge neuf (`verdict-du-juge.md` : 3 bloquants, 6 majeurs, 5 mineurs). La v2 change
de méthode parce que les trois bloquants mesurent la même chose : la fermeture de l'attaque est celle de
presque toutes les règles de `src/state`. Arbre mesuré : `origin/main` `cf4f18bcf` (vague 2 soldée).
Sondes rejouables, dans `sondes/` : `graphe.cjs` (graphe d'import de FICHIERS de `src/`, valeur et type
séparés selon les mêmes formes qu'`arcsDImport.mjs` : `import type`, spécificateurs tous `type`,
`typeof import()`) et `coupe.cjs` (arcs de valeur de N vers A ou vers une zone d'hôte). Lancer :
`node sondes/graphe.cjs <racine> > graphe.json` puis `node sondes/coupe.cjs <liste A>`.

Mandat : laurent, verbatim (2026-10-19) : « Enfin pour etre précis le ticket a faire de bout en bout
c'est 2882, la 2817 c'est juste un des sous tickets ». L'épique entière est dans le périmètre ; la v1
bornait la vague 3 contre la vague 4, la v2 n'a plus à le faire.

## 1. Ce que la mesure dit

- Sans coupe, l'attaque atteint 301 des 353 fonctions de ses trois fichiers (`dependances.md` §3), la
  boucle du tour et l'IA (B1), la clôture de cascade et ses routes de voyage (B2), et par
  `EFFECT_HANDLERS` le dialogue, le repos, la poursuite, la carte du monde et le voyage maritime (B3).
- Le graphe de FICHIERS dit où est vraiment le store. On sépare les 166 fichiers non-test de
  `src/state` en deux ensembles :
  - **A, l'adaptateur web (38 fichiers, 12 859 lignes)** : le store et sa persistance (`store`,
    `saves`, `roster`, `preferences`, `keybindingsPrefs`, `houseRules`, `projectLibrary`,
    `traceLayer`, `traceCalibration`, `editorAutosave`, `campaignData`), la coop (`netFlow`,
    `intents`), l'outillage (`devtools`, `devtoolsTimers`, `scenarioFlow`, `validateScene`, `mapQC`),
    et l'état d'interface (`targeting`, `targetingHolder`, `targetingModes`, `combatCursor`,
    `localIntent`, `clavier/keybindings`, `clavier/resoudreEchap`, `combatAuto`, `registreOffres`,
    `actionRegistry`, `hotbarBridge`, `editeurBridge`, `mapHover`, `stagePan`, `stageYaw`,
    `stageGestes`, `viewLevel`, `codexFocus`, `dismissStack`, `dispositionConsole`).
  - **N, les règles et leur orchestration (128 fichiers, 55 505 lignes)** : tout le reste, dont
    `combatFlow`, `combatSlice`, `combatEffects`, `rollFlowSpecs`, `rollFlowFactory`, `modalArbiter`,
    les flux de voyage, de repos, de taverne, de marché, l'IA, les crochets de round et de tour.
- **Les arcs de VALEUR de N vers A ou vers une zone d'hôte** (`coupe.cjs`, hors tests) :

  | Cible | Sites |
  |---|---|
  | `state/bus` | 15 fichiers ; le bus est un émetteur pur (`bus.ts`, 58 lignes, sans DOM) |
  | `web/minuteries` | `combatFlow:19`, `combatDirector:16`, `enchainerEtape:2`, `entreeEnScene:14`, `stageWalk:24` |
  | `state/campaignData` | `combatEffects:29`, `combatSlice:66`, `offresUtilisables:24`, `sceneNpc:12` |
  | ciblage, curseur, caméra, modales (`targeting`, `targetingHolder`, `targetingModes`, `combatCursor`, `localIntent`, `stageYaw`, `dismissStack`) | `combatOrParty:22-23`, `netOwnership:11`, `stageWalk:22`, et `combatSlice` (`cycleTarget`, `cursorActor`, `currentTargetingMode`, `batteryBlock`, `coupFerme`, `nextCursorTile`…, `chargeArmee`, `viewYawDeg`) |
  | `state/combatAuto` | `combatSlice:12` (`tickCombatAuto`) |
  | `state/roster` | `partyFlow:47` (`rosterUpdate`) |
  | `state/store` | `seaVoyageFlow:51` (`registerScene`) |
  | `state/actionRegistry` | `turnEconomy:5` (`ACTION_GATES`, `freeDisengage`) |

  Et deux arcs de TYPE vers une zone qui ne survit pas : `IconId` (`ui/icons`) dans `combatManeuvers:43`
  et `revealStep:10`. `scenarioFlow` (type de `scenes`) est dans A.
- Aucun fichier de N n'importe `net`, `audio`, `scenes`, `react` ou `zustand` en valeur. Hors `combatSlice`,
  les coupes touchent 12 fichiers.
- `get().<action>()` : 438 appels dans 42 fichiers, dont 241 `get().log(` ; une soixantaine d'actions
  distinctes. Le type qui les autorise est `Get = () => GameState` (`flowTypes.ts:9`).

## 2. Décisions

**D1. Où.** `src/noyau/` (H1 du plan). `src/engine` reste la bibliothèque de règles sans état
(règle 3 d'`AGENTS.md`) ; le noyau enchaîne ces règles sur l'état du jeu. `docs/architecture.md`
§ Frontière orchestrateur · machinerie · data-driven : `fireTriggers` (le dispatch des données) et
`registerCombatHook` (la machinerie) sont tous deux de l'orchestration, donc au noyau. `docs/doctrines.md`
ne porte aucune doctrine de couche ; tranchent les arbitrages cités au plan (2026-10-18 : « Mettre le code
au bon endroit ca ne me semble pas une mauvaise chose a faire non plus » ; « Il n'est pas interdit de
bouger le code mal placé en tout cas. »), et `user-doctrine-un-hote-jamais-duplique` pour le nommage (D6).

**D2. Méthode : par mécanisme, pas par famille de flux** (amende H3 du plan). On coupe d'abord les arcs
de valeur de N vers A et vers l'hôte (§1) ; N déménage ensuite d'un bloc dans le noyau ; puis le type
de l'état, les actions et les registres se ferment dans le noyau. Aucun échafaudage transitoire : ni
sortie typée « reprendre le tour » (B1), ni table de routage de clôture remplie depuis `state` (B2), ni
`EFFECT_HANDLERS` rempli depuis `state` (B3), que la vague 4 aurait dû démolir. Le site d'origine
disparaît dans le lot qui déplace ; aucun fichier-pont, aucune réexportation de compatibilité. H3 garde
son invariant, jamais deux implémentations d'une même règle ; c'est l'unité de migration qui change.
Garde de la méthode : `murs/purete-imports` refuse tout arc de valeur `noyau → state` (COUCHES) ; un
fichier déplacé trop tôt fait rougir le lint, sans garde neuve.

**D3. L'état : le noyau mute, il ne rend pas une copie** (amende le But de #2817, la ligne `noyau` du
§3.1 et le §3.2 du plan, « une fonction du noyau rend un nouvel état »). Raison : le moteur lui-même mute
les combattants en place (`applyOps`, `addCondition`) ; réécrire l'orchestration en `(état) → nouvel
état` par copie réécrirait le moteur. Le noyau garde le couple `get`/`set` en interne ; ce qui disparaît
de la surface offerte aux hôtes, c'est le store. Un hôte externe reçoit une **partie** (D8), propriétaire
de l'état au même titre que le store web.

**D4. Le type de l'état et des actions sort du store** (M3). `src/noyau/etat.ts` déclare :
- `EtatDeJeu` : tous les champs de DONNÉE de `GameState` (`store.ts:385-1688`), sans fonction ;
- `ActionsDuNoyau` : les actions dont le corps porte une règle, créées par des fabriques du noyau
  `(get, set) => actions` (la forme de `createCombatSlice` aujourd'hui) ;
- `Jeu = EtatDeJeu & ActionsDuNoyau` ; `Get = () => Jeu`, `Set`, `PatchDeFlux`, `RemplacerLEtat`
  (`flowTypes.ts` va au noyau, typé sur `Jeu`).

Le store compose : `GameState = Jeu & ActionsDeLAdaptateur` (écran, ciblage, caméra, persistance,
coop). Les appels `get().action()` restent des appels d'actions, mais le compilateur refuse qu'un module
du noyau appelle une action de l'adaptateur ; chaque appel refusé est coupé dans le lot du type : une
action qui porte une règle descend dans une fabrique du noyau ; une action d'interface appelée par une
règle devient un champ d'`EtatDeJeu` que l'adaptateur lit, ou un événement du bus. `get().log` devient
l'action `log` d'une fabrique du noyau, qui reste l'écrivain unique de `journal` (`PatchDeFlux` l'interdit
à tout autre écrivain). `index.ts` n'exporte aucun type de `state`. Les champs d'interface encore dans
`EtatDeJeu` (écran, onglet de fiche, `battle.preview`, `battle.reachable`…) sont inventoriés au lot du
type et sortent à la vague 7, qui rend `state` sans règle et le noyau sans interface.

**D5. La suspension reste ce qu'elle est.** Pendings sérialisables (`src/noyau/pendings.ts`), fenêtres
en étapes de cascade (`OPS_DIFFEREES`, `Applique`). Une intention qui ouvre une fenêtre rend la main avec
l'état portant le pending ; l'hôte montre la fenêtre et envoie l'intention de reprise.

**D6. Services de plateforme : un module, une table complète, absence = erreur** (M2, m1, m2).
`src/noyau/plateforme.ts` déclare ce que le noyau demande à l'environnement d'exécution, et rien d'autre :
`programmer(suite, délai, portée)` et `annuler(jeton)` (les minuteries de `web/minuteries`, de combat et
de flux), et `persisterLeHeros(heros)` (`rosterUpdate`). Le mot « plateforme » évite la collision avec
l'hôte de jet (`hostStep`, `user-doctrine-un-hote-jamais-duplique`). L'adaptateur web pose la
plateforme à la création du store et relaie vers `web/minuteries` et `roster` ; un appel sans plateforme
posée LÈVE. Ce qui n'est PAS un service de plateforme, et comment chaque point se ferme :
- le bus (`state/bus.ts`) est un émetteur pur : il déménage au noyau tel quel en 3a (`src/noyau/bus.ts`),
  la présentation et l'audio s'y abonnent comme aujourd'hui ;
- `campaignData` : ses lectures `useGame.getState().campaignNarratif` (`:29`, `:100`) deviennent des
  lectures de l'état passé par l'appelant ; le module va dans N ;
- `registerScene` (`store.ts:202`, le registre des scènes chargées) va au noyau avec son registre ;
- le ciblage, le curseur, la caméra et la pile de modales lus par N : la règle reçoit en argument ce que
  l'interface sait (l'appelant de l'adaptateur le lit), ou l'action d'interface reste dans une fabrique
  de l'adaptateur. `combatSlice` se scinde ainsi : ciblage, curseur, caméra et `tickCombatAuto` d'un
  côté (adaptateur) ; jet, coup, défense, Destin, tour et cascade de l'autre (N) ;
- `ACTION_GATES` et `freeDisengage` (`actionRegistry`) : les portes d'action sont une règle et vont dans
  N ; le registre d'affichage des actions reste à l'adaptateur ;
- `IconId` : `MANEUVER_ICON` et `REVEAL_ICON` sont de la présentation ; ils passent du côté de leurs
  lecteurs, le noyau porte la sorte (`AttackKind`, `RevealEntry['kind']`) ;
- les points d'injection du noyau qui se taisent quand ils manquent (`suiteApresCommit?.`
  `cascade.ts:1348`, `ownTestFailedEmitter?.` `:1270,1366`, `zoneCrossTestHook?.`
  `combatPlacement.ts:147`), celui qui lève (`clotureInjectee`, `cascade.ts:165-170`), `testRouter`
  (`triggeredEffects.ts:282`), les trois crochets du test routé (`triggeredTest.ts:104,114,125`) et
  `onConditionGained` (`engine/conditions.ts:105`) sont posés aujourd'hui depuis `combatSlice` ou à
  l'import de `combatEffects`, qui déménagent tous deux en 3b. Au lot des registres (D9), chacun devient
  un import direct ou une entrée de table statique. Le seul qui reste un point d'injection est
  `onConditionGained`, parce que `engine` ne peut pas importer le noyau : il est alors posé par le noyau
  et LÈVE s'il manque ;
- le siège agissant (`actingSeat`, variable de module de `netOwnership.ts:115-129` posée par
  `withActingSeat`) : une intention de partie porte son `siege`, que la partie pose par `withActingSeat`
  (la primitive existante) ; sans siège, la partie joue en local, comme le jeu solo.

**D7. Entrées de la partie : dés, règles maison, cadence, dés fixés** (M4, M6). Elles existent déjà en
variables de module : `seedBattleRng` (`noyau/battleRng.ts`), `loadRuleOverrides`
(`engine/policy.ts:137`), `setCadence` (`engine/cadence.ts:22`), `desFixes()` (`engine/fixedDie.ts`).
`creerPartie` les pose depuis ses entrées ; l'adaptateur web les pose comme aujourd'hui. Ce sont des
singletons par contexte JS (H-a), ce qui amende la formule du plan §4 (« entrées fournies par l'hôte ») :
fournies par l'hôte, oui ; passées en paramètre de chaque appel, non. Les défauts silencieux
`rng = defaultRNG` forment une classe à part, mesurée par le juge v1 : 34 appels de production et 295 de
tests sans RNG, 71 fichiers ; 53 fichiers portent `defaultRNG`. Le lot 3h les retire sur toute la
classe, pas seulement sur le chemin du coup : `tsc` exige alors le RNG à chaque appel.

**D8. La surface : `src/noyau/index.ts` et la partie.** `creerPartie(etatInitial, entrees)` rend
`{ etat(), envoyer(intention) → evenements, reprendre(jeton) → evenements }`. Une intention est
`{ type, args, siege? }`, `type` pris dans l'union fermée des clés d'`ActionsDuNoyau` ; `envoyer` appelle
l'action de même nom (la table de routage coop `src/state/intents.ts:103` les nomme déjà). La partie
s'abonne au bus pour rendre les événements, pose une plateforme dont `programmer` rend un jeton par
minuterie au lieu d'armer un délai, et pose les entrées (D7). `index.ts` n'exporte que la partie, les
types d'`EtatDeJeu` et de l'intention, et les lecteurs dont un hôte a besoin pour montrer une fenêtre
(les sept morceaux de `docs/plans/2026-10-19-modale-attaque-godot.md` §53-61 : aperçu,
`defenseDodgeMods`, dérivation, relance, bonus de DR, relance par re-résolution, constantes de la
modale), chacun pris à sa source unique.

**D9. Registres fermés** (M5). Une fois le code au noyau, chaque registre rempli à l'import devient une
table statique typée par une union fermée (plan §3.2) : `registerCascadeApplier` (116 appels,
28 fichiers), `registerCascadeTableFold`, `registerTableStep(Family)`, `registerCascadeSuccessRule`,
`registerExtendedTestOutcome`, `registerCombatHook` (18), `registerHitModifier` (5), `registerCloture`
(10 verbes, dont 6 posés par `store.ts` : ceux qui touchent l'adaptateur deviennent des événements du
bus), `registerCastSpellEffect`, `registerNightBandApplier` (17), `registerSequence*` (26),
`registerPerilInterrupt`, `registerEtalGenerateur`, `setManeuverPostHitHook`, et les points d'injection
de D6. Les appliers de cascade du combat y sont compris. Une table statique qui référence des fonctions
de modules en cycle est construite au premier accès, pour ne dépendre d'aucun ordre d'évaluation : c'est
ce qui supprime le `ReferenceError` d'ordre d'import relevé par #2817 (« Combat : résoudre et
appliquer une attaque sans le store »).

**D10. Gardes qui changent** (M5). Toute garde, lint ou générateur qui nomme un chemin déplacé le suit
(patron du lot 2b : chaque garde bornée à `src/state` qui jugeait un fichier déplacé le juge encore).
`combat-event-port-guard` : sa WHITELIST suit `runCombatHooks`/`emitCombatEvent` au noyau, sans entrée
neuve. `targeting-holder-vs-mode` : les deux prédicats jumeaux et le cycle `netOwnership →
targetingModes → combatFlow` sont précisément les arcs que 3a coupe (`netOwnership:11`,
`combatOrParty:22`) ; 3a résout le cas et supprime la garde, son stock et son test dans le même commit
(doctrine de #2724), comme le plan §4 le prévoyait.

**D11. #2763 sort de la vague.** « AttackResult fermé » est bloqué par #1858 (ouvert) ; il reste à #2724.

## 3. Lots

Chaque lot : un codeur sur brief, un juge neuf sur le diff, `typecheck` complet, `lint` 0,
`test:perimetre` vert, une PR sur `chantier/2817` en fusion automatique. Le contenu exact d'un lot vient
de la re-mesure (`graphe.cjs`, `coupe.cjs`) à sa base.

- **3a. Les coupes.** Le bus au noyau ; `plateforme.ts` et sa pose par l'adaptateur ; les arcs de §1
  coupés selon D6, `IconId` compris ; `targeting-holder-vs-mode` résolu (D10). Preuve : `coupe.cjs` rend
  zéro arc de valeur de N vers A ou vers une zone d'hôte, et aucun arc de type de N vers `ui`,
  `gameIso`, `scenes`.
- **3b. Le déménagement.** Les fichiers de N passent sous `src/noyau/`, au même chemin relatif, sauf le
  modèle du monde, qui va sous `src/noyau/monde/` (liste fermée au brief ; critère : le module ne lit ni
  ne pose d'état de combat ni de flux : carte, pièces, bâtiments, vision, conversion ASCII). Chaque test
  homonyme suit son module ; un testkit qui importe le store reste dans `state`. Spécificateurs réécrits
  par codemod AST, chemins vivants repointés hors `docs/plans/` (653 occurrences mesurées hors du code
  de `src/`), barils (`combatFlow`, `export *`) suivis : le coût du baril (m4) est le nombre de
  spécificateurs réécrits, rapporté dans la preuve. COUCHES ne change pas : l'arête de type
  `noyau → state` (#2889) couvre les types encore lus au store. Preuve : lint 0 (aucun arc de valeur
  `noyau → state`), typecheck complet, suite complète en CI.
- **3c. Le type et les actions** (#2889). `etat.ts` (D4) ; `flowTypes` au noyau ; `combatSlice` scindé ;
  les actions de `store.ts` dont le corps porte une règle descendent dans des fabriques du noyau ; chaque
  appel `get().action()` refusé par le nouveau type est coupé (D4). L'arête de type `noyau → state`
  sort de COUCHES (DoD de #2889, premier point).
- **3d. Les registres** (#2889). D9 en entier ; les gardes de totalité existantes
  (`_ClotureVerbesTotaux`) deviennent l'union de leur table. DoD de #2889, second point.
- **3h. Les dés sans défaut** (D7) : la classe `defaultRNG` sur tout `src/`.
- **3e. La surface** (#2817). `index.ts`, `creerPartie` ; un projet de test SANS `setupFiles` (config
  vitest dédiée, lancée par `npm test` et la CI) qui n'importe que `src/noyau/index.ts` et joue par une
  partie une attaque complète (jet, défense, critique, mise hors de combat) ; un test « sans plateforme,
  ça lève » ; contrôle du graphe sur le bundle (esbuild `metafile` de `src/noyau/index.ts` : aucun
  fichier de `state`, `ui`, `gameIso`, `web`, `net`, `audio`, ni `react`) (M1). Mesure sur `poc/godot`,
  sans fusion. Porte joueur au navigateur (combat de l'Arène, une critique, une mise hors de combat,
  console à 0 erreur).

Ordre : 3a, 3b, 3c, 3d, 3h, 3e. Les vagues suivantes de l'épique restent celles du plan : 5 (#2884)
retire les arêtes de contenu, dont `scenes → state`, que 3b réduit (la plupart des modules de `state`
que `scenes` importe sont dans N) ; 6 l'hôte Godot ; 7 le solde, dont les règles encore dans A
(`targetingModes.attackClickCommit`, `combatAuto`) et les champs d'interface d'`EtatDeJeu`.

## 4. Réponses au verdict v1

| Objection | Réponse |
|---|---|
| B1 tour | D2 : le tour déménage avec l'attaque (3b) ; la minuterie est un service de plateforme (D6). Pas de sortie typée. |
| B2 clôture de cascade | `dispatchCascadeDone` est dans `combatSlice`, côté N ; il déménage en 3b, son injection devient un import ou une table en 3d. |
| B3 lot 3d v1 | D2 : `routeTriggeredTest`, `applyEffects`, `checkBattleOver` et leurs routes de domaine sont dans N et déménagent ensemble. |
| M1 preuve | 3e : projet sans `setupFiles`, test « sans plateforme, ça lève », metafile. |
| M2 injections | D6 : table complète, chaque point nommé avec sa fermeture ; `get().log` en D4 ; siège par l'intention. |
| M3 type | D4 : `EtatDeJeu`, `ActionsDuNoyau`, `Jeu`. |
| M4 raison de D3 | D3 : le moteur mute en place ; amendements nommés ; D7 : singletons assumés. |
| M5 amendements | D9 (appliers de combat), D10 (`combat-event-port-guard`, `targeting-holder-vs-mode`). |
| M6 coût de D7 | D7 : lot 3h sur toute la classe. |
| m1 hôte sans consommateur | Le bus déménage au lieu d'un hôte d'événements ; `plateforme.ts` naît en 3a avec ses consommateurs (minuteries, roster). |
| m2 nom | « plateforme ». |
| m3 arête transitoire | D2 ne s'appuie que sur l'arête de type `noyau → state`, qui existe (`couches.mjs:30`). |
| m4 baril | 3b : codemod, coût rapporté dans la preuve du lot. |
| m5 doctrines | D1. |

## 5. Hypothèses révisables

- H-a : un seul jeu par contexte JS (singletons de D7 et de la plateforme) ; le jeu et le pont le font.
- H-b : la liste A est juste ; si 3a trouve dans A une règle dont N a besoin, elle va dans N avec son
  lecteur, mesure à l'appui, et la liste se corrige.
- H-c : une PR 3b de l'ordre du lot 2b (1 317 fichiers) reste revuable parce qu'elle est mécanique ;
  sinon elle se scinde par composante fortement connexe du graphe de N.
</content>
</invoke>
