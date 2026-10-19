# Juge du design v2, vague 3 (#2817, #2889, épique #2882)

Arbre jugé : /home/user/game, branche `wip/2817-vague-3`, HEAD `3309a3278` ; `git diff --stat origin/main -- src` est vide (src = `cf4f18bcf`). La pièce est bien là : `docs/plans/2026-10-19-vague-3-attaque/design.md` (v2, 244 lignes), et les sondes sont dans `sondes/`.
Sondes rejouées (lecture seule) : `graphe.cjs` -> `juge-v2/graphe.json` (2,4 Mo, 6 s) ; `coupe.cjs` sur la liste A du §1 (38 fichiers, 12 859 lignes ; N = 128 fichiers, 55 505 lignes, chiffres retrouvés). Sondes du juge sous `juge-v2/` : `zones.cjs`, `importeurs.cjs`, `storeclo.cjs`.

## Verdict : REJETÉ (1 bloquant, 6 majeurs, 7 mineurs)

Ce qui tient. D2 (la méthode par mécanisme) dissout réellement B1, B2 et B3 : la boucle du tour, `dispatchCascadeDone` et `EFFECT_HANDLERS` sont tous dans N. Tiennent aussi D1, D3, D5 et D7 avec 3h, D9 sur le fond (construire au premier accès), D4 côté zustand, et le principe de 3b. Le bus est un émetteur pur (`src/state/bus.ts` : aucun import, aucun DOM). Aucun fichier de N n'importe un paquet hors `zod` (2 sites), ni `net`, `audio`, `scenes`, `react` ou `zustand`.

Ce qui casse. La partition A/N laisse dans A la DÉCLARATION de l'attaque du joueur. La partie de D8 ne peut donc pas jouer l'attaque complète exigée en 3e ni par la DoD de #2817.

## BLOQUANT

**B1. Aucune action du noyau ne déclare l'attaque d'un héros. Les reprises de la déclaration repassent par l'adaptateur.**
- Le seul site qui ouvre une attaque de héros est `src/state/targetingModes.ts:707` (`openAttackCascade(get, set, pa, 'Attaque', 'action/attack')`), dans `attackClickCommit` (`:498`, que `ATTACK_MODE.commitCombatant` sert à `:821`). Ce fichier est dans A.
  - Sonde : `git grep -n "openAttackCascade(" -- 'src/**/*.ts' ':!*.test.*'` rend 5 sites. Hors la définition (`combatFlow.ts:3856`), ce sont `combatSlice.ts:1784` (Tir rapide), `:2076` (reprise d'un gate de main), `:2499` (Pilonnage) et `targetingModes.ts:707`. Aucun autre site ne déclare une attaque ordinaire.
- Ce code est une règle : `targetingModes.ts` compte 1 011 lignes, 36 réfs RAW, 14 `set(`, 12 `refuserGeste`. On y trouve la Charge (LDB 15 l.35-37), la Peur (LDB 21 l.27), la Bénédiction de Protection (LDB 41 l.142), la Frénésie (LDB 21 l.33), le coût d'Avantage (AA 11 l.30-38) et le choix cavalier/monture (LDB 14 l.181).
- Le design le sait et le reporte : « 7 le solde, dont les règles encore dans A (`targetingModes.attackClickCommit`, `combatAuto`) » (`design.md` §3, dernier paragraphe). Or H-b dit : « si 3a trouve dans A une règle dont N a besoin, elle va dans N ».
- Les reprises de règle de N rappellent le clic de l'adaptateur. Sonde : `grep -nE "get\(\)\.(battleClickEntity|battleClickTile)\(" <N>` rend `combatSlice.ts:595` (`mountTargetSelect`), `:1590-1591` (reprise après la Peur) et `:1613` (reprise après la Bénédiction de Protection). D6 range `battleClickEntity`/`battleClickTile` du côté adaptateur, puisqu'ils appellent `currentTargetingMode` (A). D4 coupe alors ces appels par « un événement du bus » ou « un champ que l'adaptateur lit ». La suite d'une règle dépendrait de l'hôte web : c'est le schéma de B1 et B3 de la v1, reporté à 3c.
- Conséquence. D8 dit « `type` pris dans l'union fermée des clés d'`ActionsDuNoyau` ». Aucune de ces clés n'ouvre l'attaque d'un héros. Le test de 3e ne peut l'écrire qu'en forçant `pendingAttack` dans l'état initial, et un champ forcé ne prouve rien du produit. Le point de DoD de #2817 « Le pont du prototype peut appeler la même fonction » (le pont déclare ses attaques) reste ouvert.
- Correction. Appliquer H-b dès le design : les corps `*Commit*` de `targetingModes` (`attackClickCommit`, `castClickCommit`, `teleportCommitTile`, `pushCommitTile`, `castCommitTile`, `placingCommitCombatant`, `commitPlacedZone`) vont dans N comme actions de déclaration du noyau, par exemple `declarerAttaque(attaquantId, cibleId, { approche, confirm, wardCleared, skipMountChoice })`. Les affordances et le réticule restent dans A. `battleClickEntity`/`battleClickTile` deviennent un aiguilleur d'adaptateur qui appelle l'action du noyau. Les reprises `:595`, `:1590`, `:1613` appellent l'action du noyau, pas le clic. La liste A et le tableau du §1 se corrigent dans le même geste. L'intention d'attaque de D8 est alors cette action. Il faut aussi re-mesurer `coupe.cjs` après ce déplacement : `targetingModes` importe `targetingHolder`, `localIntent` et `bus`.

## MAJEUR

**M1. D4 contre 3c : `EtatDeJeu` « tous les champs de DONNÉE » se type par des modules de A, et 3c retire l'arête de type `noyau → state`.**
- `store.ts:249` : `action: BattleActionMode | null` (un champ de `BattleState`), importé de `./actionRegistry` (A, `store.ts:15`).
- `store.ts:890` : `net: NetState`, de `./netFlow` (A, `:60`). `netOwnership` (N) lit ce champ pour la possession.
- `store.ts:477`, `:490`, `:388`, `:386` : `CombatCursor` (A), `LocalIntent` (A), `CodexFocus` (A) et `Screen` (déclaré dans `store.ts`).
- D4 garde ces champs jusqu'à la vague 7, et 3c déclare « L'arête de type `noyau → state` sort de COUCHES ». `noyau/etat.ts` ne compile alors plus sous `murs/purete-imports`, ou bien il faut migrer des types d'interface au noyau.
- Correction. Trancher dans le design. `BattleActionMode` et `NetState` sont des types du jeu : ils vont dans le noyau. Les champs d'interface (`screen`, `compendium*`, `combatCursor`, `localIntent`, `camRot`, `zoom`, `hovered`, `keyOverrides`…) sortent d'`EtatDeJeu` en 3c et vont dans `ActionsDeLAdaptateur & EtatDeLAdaptateur`. Il ne faut pas les garder « jusqu'à la vague 7 ».

**M2. D6, « table complète », ne l'est pas : les actions de `store.ts` que N appelle tirent la persistance de la partie et l'interface.**
- Sonde `storeclo.cjs`, graines = les 58 actions `get().X(` des 36 fichiers de N, fermeture sur les corps du `create<GameState>` :
  ```
  actions de store.ts : 235 lignes 1161
  fermeture depuis 58 graines : 27 actions, 357 lignes
  advanceTime autoSave confirmDistribution designerHerosOuvrir faceAtCombatStart faceFromPath faceToward favorGrant interactEntity jouerAction log moveParty openMerchant openSessionEnd openTavernGames openWorldMap remettreDocument restoreFortuneNow setEditingHero setScreen shipAdvance shipTurn startExtendedTest startForceDoor startInterlude startMassBattle transitionTo
  top-level de store.ts utilisés : sceneRegistry placesDe seLeverDe sasseoirA JOUER_CAPACITE
  import ./saves : snapshotSave saveToSlot AUTO_SLOT
  import ./stageGestes : resetStageGestes
  import ./campaignData : presetPnjById
  ```
- `transitionTo` (appelée 10 fois depuis N) fait `get().autoSave()` (`store.ts:2407`) et `resetStageGestes()` (`:2402`). Ni la sauvegarde de la partie ni la remise à zéro des gestes de scène ne figurent dans D6. Seul `persisterLeHeros` y est. `setAiTrace` (`ai.ts`) n'y figure pas non plus.
- La bonne nouvelle mesurée : 3c est borné (27 actions, 357 lignes). Le design ne le chiffre pas.
- Correction. Ajouter `sauvegarderLaPartie` à la plateforme, ou l'émettre en événement du bus. `resetStageGestes` devient un événement d'entrée de scène. Lister `setAiTrace`. Mettre le chiffre de fermeture de 3c dans le design.

**M3. La partition A/N est faite à la main, et elle est fausse sur plusieurs fichiers.** Sonde `importeurs.cjs` (fichiers de N qu'aucun fichier de N n'importe en valeur), extrait :
```
state/stageWalk.ts | valN=0 N:  | A: clavier/keybindings.ts,stageGestes.ts | autres:
state/entreeEnScene.ts | valN=0 N:  | A: devtools.ts | autres: gameIso
state/turnEconomy.ts | valN=0 N:  | A:  | autres: ui
state/formats.generated.ts | valN=0 N:  | A: netFlow.ts,roster.ts,saves.ts,traceLayer.ts | autres:
state/dialogueLibelle.ts | valN=0 N:  | A: validateScene.ts | autres:
```
- `stageWalk` est de l'interface. Son en-tête (`stageWalk.ts:1-4`) dit : « hors du store… Même patron que `state/stageYaw.ts` : le clavier/la manette ARMENT ». `.claude/rules/rendu-et-rig.md:4` le range sous `src/state/stage*.ts`, avec `stagePan`/`stageYaw` (A). Les coupes D6 `stageWalk:22` (`dismissStack`) et `:24` (minuteries) n'existent que parce qu'il est mal rangé.
- `entreeEnScene` est le rendez-vous entre le rendu et la recette (`:1-12`), lu seulement par `devtools` et `GameStage3D`.
- `turnEconomy` n'est lu que par `ui/console/CombatConsole.tsx:5`. La coupe D6 `ACTION_GATES`/`freeDisengage` (scission d'`actionRegistry`, 567 lignes) ne sert donc aucun lecteur de N.
- `formats.generated` (généré, non commité) n'est lu que par la persistance (A).
- À l'inverse, `targetingHolder` (A) porte `coupFerme`, une règle (LDB 14 l.9, LDB 85 l.362, `targetingHolder.ts:41-46`) que N lit (`combatSlice.ts:38`). Elle a sa place dans N, ce qui supprime la coupe `netOwnership:11`. Il y a aussi `targetingModes` (B1) et les types de M1.
- Correction. Écrire le critère de partition (lecteurs mesurés, plus « porte une règle RAW ») et rejouer la liste. Déplacer dans A `stageWalk`, `entreeEnScene`, `turnEconomy`, `formats.generated` et `dialogueLibelle`. Déplacer dans N `targetingHolder` et les commits de `targetingModes`. Retirer les coupes devenues sans objet.

**M4. D10 affirme sans montrer que `targeting-holder-vs-mode` se résout.**
- La garde (`src/state/targeting-holder-vs-mode.test.ts:1-13`) confronte `targetingHolder` et `currentTargetingMode`, deux prédicats jumeaux (`targetingHolder.ts:30`, « jumeau : combatFlow.placingZoneOf (source 'cast') »). Couper l'import `netOwnership:11` ne fusionne pas les jumeaux. Après la v2, les deux sources sont dans A : le risque de divergence est entier.
- La doctrine de #2724 exige la STRUCTURE qui rend la divergence impossible avant de supprimer la garde.
- Correction. Nommer la structure : un verdict unique, par exemple le mode courant dérivé de `targetingHolder` (ou l'inverse), et `placingZoneOf` dérivé de la même source. Supprimer la garde, son stock et son test dans ce commit-là, avec la sonde de mutation du codeur.

**M5. D2 « aucune réexportation de compatibilité » contre 3b « barils suivis ».**
- Réexportations dans le périmètre :
  - `store.ts:218` `export * from '../noyau/pendings'`, commenté « ré-exportés pour la compat des imports existants » (`:216-217`) ;
  - `store.ts:49` (`activeCombatant`, `entityPickables` depuis `combatFlow`) et `:54` (`movementRemaining`, `canMove` depuis `mount`) ;
  - le baril `combatFlow.ts:246-286` (9 `export *`, et des réexportations commentées « ré-export pour frenzy*.test / psych*.test ») ;
  - `portFlow.ts:481`, `spawn.ts:80`, `combatManeuvers.ts:310`, `rollFlowSpecs.ts:2100`.
- Sonde graphe : 18 fichiers (12 hors test, 72 noms) lisent un type de `noyau/pendings` par `state/store`, et 10 fichiers lisent les réexportations `combatFlow`/`mount` du store. Après 3b, `store.ts:49` sert de pont `state → noyau` aux lecteurs de l'interface, et les fichiers de N lisent `noyau/pendings` par un aller-retour `noyau → state → noyau`.
- Correction. 3b réécrit ces importeurs vers la source et supprime ces réexportations dans le même lot. Le baril `combatFlow` se dissout : les spécificateurs pointent sur le module qui déclare. Son effet de bord d'inscription tient jusqu'en 3d par un import explicite, sans baril.

**M6. D8 et D6 : les crochets qui CAPTURENT un `get`/`set` contredisent la partie, et `onConditionGained` « LÈVE » contredit le contrat du moteur.**
- `combatSlice.ts:417` pose `setConditionGainedHook((c, name) => handleConditionGained(get, set, c, name))`. C'est un singleton de module lié au propriétaire de l'état qui l'a posé. D6 garde ce point d'injection après 3d (`engine` ne reçoit pas `get`/`set`).
- Une partie créée là où le store existe (toute la suite principale : `src/test-setup.ts:96` importe le store, `vite.config.ts:90` `isolate: false`) réécrit ce crochet sur son propre état, pour tous les fichiers suivants du worker. H-a ne le borne pas.
- `engine/conditions.ts:99-103` documente que l'absence est légitime : « Absent ⇒ aucune réaction (création de perso, effets hors combat, tests purs) ». Le faire LEVER rend l'`addCondition` du moteur dépendant au runtime du noyau. Cela contredit la règle 3 et cassera tout appel du moteur hors noyau, dont le projet de test sans `setupFiles` de 3e s'il touche un État avant `creerPartie`.
- Correction. Dire qui pose le crochet, et avec quel `get`/`set`. Interdire `creerPartie` en présence du store (garde d'exécution : une seconde pose lève), ou faire passer par le crochet un contexte de partie. Garder « absent = aucune réaction » pour le moteur. Le « lève » appartient au noyau (la partie et le store le posent toujours), pas à `engine`.

## MINEUR

**m1. Le tableau du §1 n'est pas la sortie de sa propre sonde.**
- `coupe.cjs` sur la liste A du §1 rend aussi `exploreNav.ts:7 -> combatCursor {screenStepDot}`, absent du tableau. « Hors combatSlice, les coupes touchent 12 fichiers » : la sonde en rend 13, sans le bus.
- La ligne `state/bus | 15 fichiers` ne peut pas sortir de cette liste : `bus` est dans N (128 fichiers). Avec `bus` ajouté à A, la sonde rend 11 importeurs, pas 15.
- Correction : coller la sortie brute de la sonde.

**m2. Les trous de détecteur de `coupe.cjs`.**
- Un import à effet de bord (`import './x'`, `names` vide) est sauté, alors que le mur le juge comme un arc de valeur (`arcsDImport.mjs` `efface`). 0 cas dans N aujourd'hui (sonde : « total effets de bord non-test 12 », aucun dans `state`).
- `require`, `import.meta.glob` et `vi.mock` ne sont pas lus. Les testkits et `fixture` sont exclus, alors que le mur ne les exempte pas (`oxlint.config.mjs:603-605`, `excludeFiles` = `*.test.*`, `*.bench.*`). `partage.testkit.ts:26-27` (`import.meta.glob('/src/scenes/**')`) serait refusé s'il passait au noyau.
- Correction : aligner la sonde sur `visiteurDArcs`, et dire au brief de 3b le sort de chaque testkit.

**m3. `IconId` traite le cas, pas la classe.**
- N porte 213 littéraux `icon: 'x/y'` (combatEffects 62, tavernFlow 38, seaVoyageFlow 18, combatFlow 17…), et le noyau type déjà `icon?: string` (`cascade.ts:1219,1932`, `pendings.ts:486,2084,2302`, `rollSeam.ts:220,272,436`).
- Déplacer seulement `MANEUVER_ICON`/`REVEAL_ICON` chez leurs lecteurs laisse la classe en place.
- Correction : sortir le type `IconId` (union d'ids) vers une zone qui survit, ou assumer `string` partout, en le disant.

**m4. D9 ne dit rien des tests qui inscrivent dans les registres.**
- 29 `registerCascadeApplier(` dans 13 fichiers de test, `spyApplier` dans 10, 9 `registerCombatHook(` dans 3, et l'instantané/restauration de `cascadeAppliers` (`src/test-setup.ts:100,462,481-482`).
- Une table fermée interdit ces inscriptions. Sans régime écrit, le codeur rouvrira une porte d'inscription « de test ».
- Correction : nommer le régime (espion sur l'entrée de table, `vi.spyOn`, ou entrées de test interdites), et le chiffrer.

**m5. 3e : le test « sans plateforme, ça lève » contredit « n'importe que `src/noyau/index.ts` ».**
- `creerPartie` pose la plateforme, et `index.ts` n'exporte que la partie.
- Le projet dédié doit aussi être `isolate: true`, ou ne porter qu'un fichier, sinon l'ordre des tests décide.
- esbuild ne suit pas `import.meta.glob` (`src/data/dev-validate.ts:16-17`, `src/data/dossiers.ts:10`) : le metafile sous-compte si la fermeture y passe.
- Correction : écrire les deux fichiers et l'option d'isolation. Faire lever l'appel d'un module interne importé par le test « lève », hors `index.ts`.

**m6. L'inventaire des chemins de 3b est incomplet, et la scission de `combatSlice` est datée deux fois.**
- Inventaire : 646 occurrences hors `src/` (proche du 653 annoncé), mais aussi 183 chemins littéraux `src/state/<N>.ts` dans des tests de `src/` (exemples : `src/data/field-consumers.test.ts:166`, `src/data/generic-domain-import-guard.test.ts:96`). Le codemod de spécificateurs ne les voit pas. `scripts/gen-formats.mjs` écrit `src/state/formats.generated.ts`.
- Scission : 3a doit scinder `combatSlice` pour couper ses arcs (`combatSlice.ts:12,38,42,43,110-112`), et 3c répète « `combatSlice` scindé ».
- Correction : nommer ces deux familles de chemins au brief de 3b, et dater la scission en 3a seulement.

**m7. D8 : l'union d'intentions est trop large.**
- « Les clés d'`ActionsDuNoyau` » expose `log` et les actions internes (`cascadeNext`…) comme intentions d'hôte.
- La partie pose `withActingSeat` mais ne dit pas qu'elle applique `intentAllowedFor`, la règle de possession que `netFlow.applyIntent` joue.
- Correction : prendre l'union dans la table des intentions (`src/state/intents.ts`, à porter au noyau), avec sa politique de possession.

## Par critère

1. Réponses au v1.
   - B1, B2, B3 : dissous par D2 (fichiers dans N, vérifié par la liste N).
   - M1 : partiellement (m5).
   - M2 : incomplet (M2).
   - M3 : contradictoire (M1).
   - M4 : tient.
   - M5 : `targeting-holder-vs-mode` affirmé (M4). `combat-event-port-guard` tient : WHITELIST de 6 chemins, `src/state/combat-event-port-guard.test.ts:24-31`, chemins réécrits sans entrée neuve.
   - M6 : tient (3h).
   - m1, m2, m3 : tiennent (`couches.mjs:30` porte bien l'arête de type `noyau → state` #2889).
   - m4 : réponse fausse (M5).
   - m5 : tient (`docs/doctrines.md` ne porte ni « couche » ni « noyau » : grep vide).
2. Mesure : partition fausse (M3, B1), tableau non conforme à la sonde (m1), détecteur aux trous mesurés à 0 (m2).
3. Coupes de D6.
   - `campaignData` : faisable, mais avec ~25 sites appelants (`presetPnjById` 12 fichiers, `nomDEntite(ent, presetPnjById)` en résolveur), pas 4.
   - `registerScene` : faisable (`store.ts:201-214`, lecteur `:2343` dans A).
   - `rosterUpdate` : faisable.
   - `combatOrParty` : faisable (`combatantClickActs` va dans A).
   - `ACTION_GATES` : sans objet (M3).
   - `stageWalk`/`dismissStack` : sans objet (M3).
   - `IconId` : m3.
   - `combatSlice` : infaisable tel qu'écrit pour les reprises (B1).
4. D4 : le typage zustand tient (`create<GameState>` `store.ts:1921`, le `set` du store se passe en `Set` sur `Jeu` par contravariance, comme `createCombatSlice` aujourd'hui). `GameState extends RollFlowActionsMap` (`store.ts:385`) se réécrit en alias, puisque `RollFlowActionsMap` ne référence pas `GameState` (`rollFlowSpecs.ts:2131-2134`). Aucune fusion d'interface (`git grep "interface GameState"` : 1 site). Bloqué seulement par M1.
5. D2 : COUCHES et le lint tiennent la méthode lot par lot (`noyau` n'ouvre que `engine`, `data` et les feuilles, `couches.mjs:30` ; les tests sont exemptés, `oxlint.config.mjs:604`). Les réexportations (M5) et les testkits non exemptés (m2) restent à régler.
6. D9 : sain. La construction au premier accès évite la TDZ des `const` exportés en cycle, tant qu'aucun code de premier niveau n'appelle l'accesseur (à garder par la suppression de tout `register*` au chargement, que D9 prévoit). Le `ReferenceError` de #2817 disparaît d'abord parce que le store sort du bundle (3b-3c), D9 fermant les cycles internes au noyau. Restent les tests (m4).
7. D8 : il manque l'action de déclaration (B1), la règle de possession (m7), le propriétaire du crochet `onConditionGained` (M6) et `combatAuto` en cadence automatique (laissé dans A, `combatSlice.ts:1819`). Les minuteries par jeton tiennent (`web/minuteries.ts:28-42`, API à 3 fonctions).
8. 3e : le projet sans `setupFiles` répond bien à `test-setup.ts:96` et à `isolate:false`, sous les réserves de m5. Il ne peut pas jouer l'attaque sans B1.
9. Séquencement : 3a, 3b et 3d gardent le jeu et la CI (coupes à comportement constant, déménagement mécanique, précédent 2b de 1 317 fichiers). Le risque est en 3c (B1, M1, M2). 3b est revuable s'il ne fait que renommer et réécrire des spécificateurs : la détection de renommage de git le montre, M5 compris.

## Non vérifié

- `poc/godot` (branche non sondée).
- La faisabilité de 3h fichier par fichier.
- L'effet d'un `bus.emit` pendant un rendu.
- Le comportement d'un projet vitest `projects` partagé contre une configuration dédiée (trancherait : un essai `npx vitest run --config <config sans setupFiles>` sur une sonde qui importe `noyau/cascade`).
- La compilation réelle d'`etat.ts`. Trancherait : une sonde tsc sur un `EtatDeJeu` extrait, sous l'arête retirée.

## Sondes (code exact, promouvables)

`juge-v2/zones.cjs`, tout arc de N vers une zone que le noyau n'ouvre pas :
```js
const g=require(process.env.GRAPHE);
const A=new Set(process.argv[2].split(',').map(s=>'state/'+s+'.ts'));
const isTest=f=>/\.test\.|testkit|test-setup|fixture/.test(f);
const zone=f=>f.includes('/')?f.split('/')[0]:'racine';
const OK=new Set(['engine','data','lib','geometry','i18n','noyau']);
const N=Object.keys(g).filter(f=>f.startsWith('state/')&&!isTest(f)&&!A.has(f));
const Nset=new Set(N);
const rows=[];
for(const f of N) for(const a of g[f].arcs){ const z=zone(a.to); if(OK.has(z)) continue; if(z==='state'&&Nset.has(a.to)) continue;
  rows.push([a.type?'TYPE ':'VAL  ', z==='state'?(A.has(a.to)?'A':(isTest(a.to)?'TESTKIT':'?')):z, f+':'+a.line, '->', a.to, JSON.stringify(a.names)].join(' ')); }
rows.sort(); console.log(rows.join('\n')); console.log(rows.length);
```
Sortie : 65 lignes, dont `VAL A state/exploreNav.ts:7 -> state/combatCursor.ts ["screenStepDot","type ScreenDir"]` (absent du §1), `TYPE ui …combatManeuvers.ts:43` et `…revealStep.ts:10` (`IconId`), et aucun arc vers `scenes`, `net`, `audio`, `gameIso` ni `racine`.

`juge-v2/importeurs.cjs` (sortie de M3) :
```js
const g=require(process.env.GRAPHE);
const A=new Set(process.argv[2].split(',').map(s=>'state/'+s+'.ts'));
const isTest=f=>/\.test\.|testkit|test-setup|fixture/.test(f);
const zone=f=>f.includes('/')?f.split('/')[0]:'racine';
const N=Object.keys(g).filter(f=>f.startsWith('state/')&&!isTest(f)&&!A.has(f));const Ns=new Set(N);
const imp={}; for(const f of N) imp[f]={N:new Set(),A:new Set(),autres:new Set(),valN:0};
for(const [f,v] of Object.entries(g)){ if(isTest(f)) continue; for(const a of v.arcs){ if(!imp[a.to]||f===a.to) continue;
  if(Ns.has(f)){imp[a.to].N.add(f.replace('state/','')); if(!a.type) imp[a.to].valN++;} else if(A.has(f)) imp[a.to].A.add(f.replace('state/','')); else imp[a.to].autres.add(zone(f)); } }
for(const f of N){const i=imp[f]; if(i.valN===0) console.log(f, '| valN=0 N:',[...i.N].join(','),'| A:',[...i.A].join(','),'| autres:',[...i.autres].join(','));}
```

`juge-v2/storeclo.cjs` (sortie de M2) : il parse `store.ts` (API TypeScript 6.0.2), relève l'objet du `create<GameState>`, fait la fermeture par les `get().X(` depuis les graines (les actions appelées par N), puis liste les identifiants libres de premier niveau et les imports venus de A. Lancement : `AFILE=juge-v2/A.txt node juge-v2/storeclo.cjs "<58 actions>"`.

Commandes rejouées :
```
node docs/plans/2026-10-19-vague-3-attaque/sondes/graphe.cjs /home/user/game > juge-v2/graphe.json
GRAPHE=juge-v2/graphe.json node docs/plans/2026-10-19-vague-3-attaque/sondes/coupe.cjs <A du §1>     # 13 cibles, exploreNav:7 compris
GRAPHE=juge-v2/graphe.json node docs/plans/2026-10-19-vague-3-attaque/sondes/coupe.cjs <A>,bus       # bus : 11 importeurs
```
