# Juge du design vague 3 (#2817) — arbre /home/user/game/.wt-2888-2b @ 47ebdef3d (lots 2b, 2c présents)

Verdict : REJETÉ (3 bloquants). D1, D3 (raison corrigée), D5, D8, D11 et la liste 3a tiennent.

Sondes (lecture seule, TypeScript 6.0.2 API) : `juge/clo.cjs` (fermeture de valeur par symbole, lot coupé),
`juge/clo-single.cjs`, `juge/clo-files.cjs`, `juge/clo-chains.cjs` (variantes : racine seule, par fichier, chaînes),
`juge/rngcalls.cjs` (appels sans RNG). Entrées : `lot3a.json`, `roots-ia.json`, `roots-3d.json`, `roots-3d-ch.json`,
`roots-hooks.json`, `roots-3f.json`. Lancer : `node <sonde> <entrée>.json` depuis `juge/`.

## BLOQUANT
B1. 3f est inatteignable par D2 tant que le §4 exclut la boucle du tour. Sonde `clo-chains.cjs roots-3f.json`
(3d et `useGame` coupés) : `applyAttackResult` / `doAttack` / `jouerLaSuiteDuCoup` = 505 décl., 48 fichiers state, dont
`ai.ts`, `aiSpellValue.ts`, `roundHooks`, `turnHooks`, et `web/minuteries.scheduleCombatTimer` par
`jouerLaSuiteDuCoup > runPreemptShots (combatFlow.ts:4137) > ouvrirLeRound (:3227) > maybeRunEnemyTurn`.
`resolveAttack` seul : 36 décl., 7 fichiers (3a/3b), il passe. Même cas pour D4 : `handGateConfirm`, `fate*` et `defenseConfirm`
appellent `resumeEnemyTurn`/`resolveRoundBoundary` (combatSlice.ts, sites lus), `resumeEnemyTurn` = 1724 décl.
(629 avec le store coupé) et atteint `web/minuteries`. dependances.md §3 nommait cette coupe, le design ne l'a pas reprise.
Correction : ajouter un D12. Toute transition de l'attaque vers le tour (reprise de l'IA, ouverture du Round, frontière de Round)
devient une SORTIE typée de l'intention (`{type:'reprendreLeTour'|'ouvrirLeRound'|...}`) ; l'hôte web la joue en appelant le code
de `state`. Mesurer à nouveau la fermeture de 3f avec ces arêtes coupées avant d'écrire son brief.
B2. La clôture de cascade n'a pas de place. `dispatchCascadeDone` (combatSlice.ts:438-520) route voyage, mer, fleuve,
repos et séquence, puis appelle `checkBattleOver`/`resumeSuspendedAI`. Il est injecté par `setClotureDeCascade`
(noyau/cascade.ts:165-170, qui lève s'il est absent). D6 dit que l'injection « disparaît dans le lot qui descend son code », ce
qui est impossible en vague 3 (§4). L'intention « avance de cascade » (D4) lève dans une partie qui n'a pas le slice.
Correction : scinder. La clôture de combat descend (bornes `combatEndBoundary`, `finishCombatEnd`, puis `checkBattleOver` +
sortie B1). Le routage par `purpose` devient une table du noyau indexée par `purpose`, remplie depuis state jusqu'à la vague 4
(régime D10) ; un `purpose` sans entrée lève. Cela ne laisse qu'une implémentation.
B3. 3d repose sur un fait mal lu. Il est exact que la seule lecture de `store.ts` est campaignData.ts:29, mais D2 exige une fermeture
vide de TOUT state. Sonde `clo-files.cjs roots-3d-files.json` (`useGame` coupé) : `routeTriggeredTest` = 179 décl., 29 fichiers ;
`applyEffects` 159 ; `checkBattleOver` 221. Chaînes (`roots-3d-ch.json`) : `runFlow > EFFECT_HANDLERS > dialogue.ouvrirDialogue,
restFlow.openRest, pursuitFlow.startGroundPursuit, worldMap.placeById, seaVoyageFlow.openPortAt > embrigadementFlow` ;
`openSkillTest > seaVoyageFlow.activeSeaPrecipitation`. D9 fait donc entrer la vague 4 dans la vague 3. La mise hors de combat
du DoD passe aussi par ce chemin : `finishVictory > applyEffects` (combatFlow.ts:7231-7273).
Correction : trancher DANS le design, sans attendre le lot. `EFFECT_HANDLERS` devient une table du noyau dont les verbes de
domaine restent remplis depuis state jusqu'à #2889 (régime D10, un verbe absent lève). H-b est réécrite avec ces chiffres.

## MAJEUR
M1. La preuve de 3g serait fausse sous vitest. `src/test-setup.ts:96` importe `state/store`, et `isolate:false` est posé dans
vite.config.ts. Dans tout test, l'hôte web est donc installé et toutes les inscriptions de state sont actives (store.ts:1818-1838,
`createCombatSlice` :411-433, appliers de cascade). Un test « partie sans store » passe même si le noyau en dépend encore.
Le `throw` sans hôte n'est jamais exercé. Correction : un projet vitest SANS `setupFiles` (ou un script tsx) qui n'importe que
`src/noyau/index.ts`, avec contrôle du graphe sur le bundle (metafile), plus un test « sans hôte, ça lève ».
M2. L'inventaire des injections est incomplet, et plusieurs se taisent quand elles sont absentes :
- `setZoneCrossTestHook` (combatPlacement.ts:113-114, appel `?.` :147, posé par combatSlice.ts:433), sur le coup par
  `applyShieldReaction > applyZoneCrossings` (lot 3b) ;
- `suiteApresCommit?.` (cascade.ts:1348) et `ownTestFailedEmitter?.` (:1270, :1366) ;
- les trois crochets de D9 ne descendent pas par import direct. `roots-hooks.json` : `freeAttackHookImpl` = 630 décl. et atteint
  l'IA et `minuteries` ; `applyBladeTrap` = 226 ; `applyFocusInterruption` atteint `useSpellComponent` (sorts) ;
- le journal : `get().log` (15 appels dans les fichiers de flux, store.ts:3161, `markFixedDie`), alors que `PatchDeFlux` interdit
  `journal` (flowTypes.ts:12) ;
- `actingSeat` est une variable de module posée par `withActingSeat` (netOwnership.ts:115-129, netFlow.ts:274), pas
  « une donnée de l'état ».
Correction : table complète des injections dans D6, absence = erreur. Journal = service d'hôte ou écrivain unique du noyau.
Le siège agissant est porté par l'intention.
M3. Le type de l'état n'est pas tranché. `Get = () => GameState` (flowTypes.ts:7-9), or l'état d'une partie « sans action »
n'est pas un `GameState`, et le plan §3.2 dit « son type sort de store.ts ». Correction : D3 nomme le type du noyau, avec les
champs mesurés (`battle, scene, party, vessel, travelPlan, flags, possessions, gameTime, net, facing, pending*, combatCursor,
deferredUpkeepQueue, journal`) ; `GameState` le compose ; `index.ts` est sans type de state.
M4. D3 est juste mais sa raison et sa portée sont mal posées. :8363 est dans l'IA (hors périmètre) et les comparaisons
d'identité sont rares (11 sites, git grep). La vraie raison : le moteur mute en place (`applyOps`, `addCondition`). L'amendement
touche aussi le But de #2817 et la ligne `noyau` de la table §3.1, pas seulement le §3.2. Il faut dire aussi que D7 pose ses
entrées en singletons de module, contre « entrées fournies par l'hôte » au §4 du plan.
M5. Amendements du plan non dits :
- `targeting-holder-vs-mode` : le plan §4 l'absorbe en vague 3, le design §4 l'exclut ;
- `combatEventPort` : la WHITELIST de `src/state/combat-event-port-guard.test.ts` change dès que `runCombatHooks`/`emitCombatEvent`
  descendent en 3a. C'est une table d'exceptions : à justifier ;
- « les appliers de cascade du combat » (plan §4) manquent à D10, et un `registerCascadeApplier` appelé à l'import dans le noyau
  contredit le §3.2.
M6. Le coût de D7 n'est pas mesuré. `rngcalls.cjs` : 34 appels de production + 295 de tests sans RNG, 71 fichiers (dont
57 de tests). `applyOps` : 16/69 en production, 255/373 en tests ; `endOfRound` 25 en tests ; `resolveFormula` 15 en
production (magic.ts). `rollTest`, `applyOps` et `resolveFormula` ne sont pas propres à l'attaque, et 53 fichiers portent
`defaultRNG`. Retirer les défauts du seul « chemin du coup » traite un cas, pas la classe. Correction : un lot à part, sur la
classe entière, avec ce décompte, ou bien D7 retiré.

## MINEUR
m1. Les fermetures de 3a sont VIDES une fois 3a descendu (`clo.cjs lot3a.json`), aux helpers privés près (`tileAt2`, `ZERO_MONEY`,
`effectiveCommander`/`withinVoice`/`voiceCommandRangeM`, `REVEAL_ICON`/`REVEAL_AUTO_CLOSE_MS`), plus
`withActingSeat`/`decidingSeat` qui suivent `actingSeat`. En revanche aucun symbole de 3a ne référence `bus` (aucun coupé atteint) :
`hote.ts` en 3a n'aurait aucun consommateur (code mort ; `deps:exports` lancé par knip). Le déplacer en 3b, où `combatPlacement` émet.
m2. « hôte » entre en collision avec l'hôte de jet (`hostStep`, doctrine user-doctrine-un-hote-jamais-duplique). Renommer.
m3. D9 : « arête transitoire déjà déclarée » est faux. noyau→state est en type seul (couches.mjs:30), et une inscription à l'import n'est pas un arc.
m4. D2 : chaque déplacement casse les importeurs du baril `export *` de combatFlow.ts (306 tests y font référence) ; coût à mesurer par lot.
m5. D1 ne cite pas `docs/doctrines.md`, comme le ticket le demande.

## Non vérifié
`bus.emit` pendant un rendu React (non sondé ; `previewAttack` n'a pas d'arc vers `bus` selon la mesure) ; atomicité des
cycles 1 et 2 (réels selon `mesure.cjs` ; 3e et 3f les prennent d'un bloc, ce qui convient) ; identité référentielle tenue par les
tests ; `poc/godot`. Ce qui trancherait : une sonde de rendu, et `clo.cjs` sur 3e/3f une fois la coupe B1 posée.
