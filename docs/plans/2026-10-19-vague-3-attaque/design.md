# Vague 3 (#2817) : l'attaque au noyau — paragraphe de design (2026-10-19)

Épique #2882, plan `docs/plans/2026-10-19-restructuration.md` (§3, §4 vague 3). Mesures :
`scratchpad/vague3/cartographie.md` (chemin, injections, aléa, type d'état) et
`scratchpad/vague3/dependances.md` (dépendances de valeur fonction par fonction, 161 unités, script
`sondes/mesure.cjs`). Arbre mesuré : lots 2b et 2c (`47ebdef3d`).

## 1. Ce que la vague livre

DoD de #2817 : la résolution complète d'une attaque, gestes du tableau compris, est appelable sans
importer `src/state/store` ni React ; le jeu passe par cette fonction et aucune seconde implémentation
ne subsiste dans `combatFlow.ts` ; le pont `poc/godot` peut l'appeler (mesuré, sans fusion) ; porte
joueur au navigateur.

## 2. Décisions

**D1. Où.** `src/noyau/combat/` (H1 du plan). `src/engine` reste la bibliothèque de règles sans état
(règle 3 d'`AGENTS.md`) ; l'attaque enchaîne ces règles sur un état de combat, ce qui est de
l'orchestration. `docs/architecture.md` § Frontière orchestrateur · machinerie · data-driven : la
machinerie (`registerCombatHook`) et le dispatch des données (`fireTriggers`) vivent du côté de
l'orchestration ; le noyau les porte, le moteur non.

**D2. Méthode : la descente par fermeture.** Un lot déplace vers le noyau un ensemble de déclarations
dont la fermeture de VALEUR hors `engine`, `data`, `lib`, `geometry`, `i18n`, `noyau` est vide une fois
les lots précédents fusionnés. Le site d'origine disparaît ; ses importeurs importent le noyau ; aucun
fichier-pont, aucune réexportation. Les feuilles d'abord (ordre topologique mesuré, `dependances.md`
§3 de l'annexe). Le mur `murs/purete-imports` refuse tout arc de valeur `noyau → state` : un symbole
descendu trop tôt fait rougir le lint, c'est la garde de la méthode, sans garde neuve. Chaque lot
re-mesure la fermeture avec le script avant son brief.

**D3. L'état : une partie que le noyau mute, pas une copie.** Le code de l'attaque mute les `Combatant`
en place puis pose `battle` par un seul `set` (`combatFlow.ts:2995`) ; il tient des références à
travers plusieurs `set` (`b.combatants.includes(enemy)`, `:8363`). Le réécrire en
`(état) → nouvel état` par copie changerait 3 700 lignes de sémantique pour un gain nul : les deux
formes sont observables et déterministes à graine égale. Le noyau garde donc la forme qu'il a déjà,
un couple `get`/`set` sur un état qu'il possède, et l'hôte externe le reçoit sous la forme d'une
**partie** : `creerPartie(etatInitial, entrees)` rend `{ etat(), envoyer(intention) → sorties,
reprendre(jeton) → sorties }`, dont l'état interne est un objet de données sans action de store. Le
store web est l'autre propriétaire du même couple. Amendement du plan §3.2 (« le couple Get/Set
disparaît des flux migrés ») : il disparaît de la SURFACE offerte aux hôtes, pas du code du noyau.

**D4. Les intentions sont les actions de flux, en union fermée.** Une intention est une valeur
`{ type, ...args }` dont l'union est fermée au type ; elle reprend les actions de l'attaque du store
(`attackRoll`, `attackConfirm`, `defenseConfirm`, `fumbleConfirm`, `handGateConfirm`, `fate*`,
`cleave*`, `dualStrike*`, `attackSet*`, `defenseSet*`, l'avance de cascade) et la table de routage coop
`src/state/intents.ts:103` les nomme déjà. Les actions descendent au noyau comme fonctions
`(get, set, ...args)` ; le slice web délègue en une ligne. Les appels `get().action()` internes
(`defenseConfirm → attackConfirm`, `→ cascadeNext`, `FLOWS.attack → cleaveEnd`) deviennent des appels
directs dans le lot qui descend l'appelé.

**D5. La suspension reste ce qu'elle est.** Les pendings sont des données sérialisables
(`src/noyau/pendings.ts`) et les fenêtres sont des étapes de cascade (`OPS_DIFFEREES`, `Applique`).
Une intention qui ouvre une fenêtre rend la main avec l'état portant le pending ; l'hôte montre la
fenêtre et envoie l'intention de reprise. Aucun modèle neuf.

**D6. Deux services d'hôte, un seul point d'installation.** `src/noyau/hote.ts` déclare l'hôte :
`emettre(evenement)` (une union fermée des événements de rendu et de son que le noyau émet :
`SCENE_DIRTY`, `ANIM_ATTACK`, `ANIM_FLOAT`, `ANIM_MOVE`, `ANIM_AOE`, `BATTLE_OVER`, `SFX`…) et
`programmer(battement, suite)` (la cadence : le noyau nomme le battement, `TEMPO`/`beatHold` restent
à l'hôte web). L'hôte web (`src/state`) l'installe au démarrage du store et relaie vers `bus` et
`scheduleCombatTimer` ; la partie le remplace par un hôte qui accumule les événements et rend un
jeton par battement. Un appel sans hôte installé lève une erreur, jamais un défaut silencieux.
Les autres points d'injection du noyau (`setSuiteApresCommit`, `setOwnTestFailedEmitter`,
`setClotureDeCascade`, `setTriggeredTestRouter`, `setConditionGainedHook`) ne sont pas des services
d'hôte : ce sont des règles posées depuis `state` parce qu'elles y vivent encore ; chacun disparaît
dans le lot qui descend son code, remplacé par un import direct.

**D7. Les entrées de l'hôte existent déjà ; on les rend obligatoires.** Les dés : `battleRng()`
(`src/noyau/battleRng.ts`) avec `seedBattleRng` ; un hôte qui montre ses dés fournit son propre `RNG`
(`int(min,max)`, `src/engine/dice.ts`) par un poseur `poserLeRng`. Les règles maison : `rule()` et
`loadRuleOverrides` (`src/engine/policy.ts:92,137`). La cadence : `setCadence`
(`src/engine/cadence.ts:22`). Les dés fixés : `desFixes()` (`src/engine/fixedDie.ts`). `creerPartie`
les pose depuis `entrees` ; l'hôte web les pose comme aujourd'hui. Les défauts `rng = defaultRNG`
des signatures du moteur sur le chemin du coup (`cartographie.md` §0.6) et le `rng: defaultRNG` en dur
de `combatEffects.ts:1582` sont retirés : `tsc` exige alors le RNG à chaque appel, un hôte ne peut
plus obtenir des dés non semés en oubliant de passer le sien. C'est une déduction d'ingénierie de la
question de Clément du 2026-10-19 (« Si je veux automatiser foundry je pourrais presque le brancher
dessus ? ») ; un hôte à dés physiques asynchrones (Foundry) est hors de la vague : il passerait par
l'intention « dé fixé » qui existe déjà.

**D8. Un concept sur tous ses porteurs.** Le cœur du coup (critiques, porteurs, Déviation, sauvegardes,
Destin, mort, `runHitModifiers`, `planifierLesCritiques`, `checkBattleOver`) sert aussi les sorts
(Projectile, `applyCast`) et le combat marin. Il descend une fois ; les appelants des sorts, encore dans
`state` jusqu'à la vague 4, l'importent du noyau. Une seule implémentation, deux appelants.

**D9. Les tests routés par les déclencheurs sont dans la vague.** `routeTriggeredTest`
(`src/state/combat/triggeredTest.ts`) est sur le chemin du coup (`onHit`, `onWoundLoss`, `onKill`,
critiques) ; une attaque sans lui jouerait d'autres règles. Il descend en vague 3 avec ses trois crochets
(`freeAttackHook`, `focusInterruptHook`, `bladeTrapHook`). Les 18 entrées de `registerCombatHook`
(`onRoundEnd`, `onTurnStart`) n'ont aucune phase sur l'attaque : leur table descend avec
`emitCombatEvent`, son remplissage reste à #2889 (arête transitoire déjà déclarée), et la vague 4 la
ferme en table statique.

**D10. Registres fermés.** Une table que la vague descend devient une table statique typée par une union
fermée quand tous ses remplisseurs sont dans le noyau (`MODIFIERS` de `hitModifiers` : 5 entrées ;
`clotureAppliers` : 10 verbes, dont 6 posés par `store.ts`, qui restent appliqués par l'hôte web tant
que leur code est dans `store.ts`). Une table dont un remplisseur reste dans `state` garde son
`register*` jusqu'à la vague 4.

**D11. #2763 sort de la vague.** « AttackResult fermé » est bloqué par #1858 (ouvert) ; la vague 3 ne
le lève pas. Il reste à #2724 ; le plan §4 vague 3 est corrigé.

## 3. Lots

Chaque lot : codeur sur brief, juge neuf, `typecheck:fast` 0, lint 0, `test:perimetre` vert, une PR
`chantier/…` en auto-fusion. Le contenu exact d'un lot vient de la re-mesure de la fermeture à sa
base (D2) : la liste ci-dessous en donne le périmètre, pas la liste de symboles définitive.

- **3a. L'hôte et les feuilles.** `src/noyau/hote.ts` (D6) et l'hôte web ; descente des symboles purs
  de `dependances.md` « descentes préalables » 1 : `bestDefenseMode`, `touchActors`, `defenseSurfaced`,
  `aiDriven`/`ownsLocal`/`actingSeat` (les sièges lisent `s.net`, une donnée de l'état),
  `OPS_DIFFEREES`/`jouerFlowEntier`/`nePeutPasDifferer`, `pushCombatStep`/`revealPurpose`/
  `drainPendingLog`, `ouvrirChute`, `pushReveal`/`revealStep`, `emitCombatEvent`/`runCombatHooks`/
  `HOOKS`, `placeCombatant`, `massBattleTrackHit`, `partyMoneyTotal`/`condCtx`, `teamCommandMod` ; leurs
  `bus.emit` passent par `emettre`. Lève la friction « la défense automatique tire le store » de #2817.
- **3b. Les groupes de géométrie et de poste** : `mount`/`siegePush`, `shipPostes`/`fireArc`/`shipCrew`,
  `combatArea`, `combatPlacement`, `cloturer`/`registerCloture`, `beginShipwreck`, `hitModifiers` en
  table fermée.
- **3c. L'usine des jets** : `makeRollFlow`/`deDuJet` (partagée par tous les flux, 431 lignes sans store).
- **3d. Les effets et les tests routés** (le seul bloquant mesuré) : `applyEffects`/`gearFromEffects`,
  `routeTriggeredTest`/`runCombatFlow`/`bandeTriggeredTest` partagent une fermeture de 132 fichiers dont
  la seule lecture du store est `src/state/campaignData.ts:29` (`useGame.getState().campaignNarratif`),
  qui devient une lecture de l'état passé ; `net/relay`, `web/minuteries`, `web/stockageWeb` de cette
  fermeture deviennent services d'hôte ou sortent du chemin. Design propre au lot, après re-mesure.
- **3e. Le cœur du coup** (cycle 1 et ses feuilles) : critiques et porteurs, Déviation, sauvegarde,
  `finalizeHeroDeath`, `notifySlain`, `planifierLesCritiques`, `appliquerLesCritiques`,
  `encaisserLeCoup`, `cloreLeCoup`, `resolveFirstBlood`, Armure Bâclée.
- **3f. Le coup et la défense** (cycle 2) : `applyAttackResult`, `appliquerLaTouche`, `jouerLApresCoup`,
  suite, balayage, gratuites, défense surfacée, `checkBattleOver`/`finishVictory`, jet et influences
  (`resolveAttack`, `attackEnv`, aperçus, `FLOWS.attack`, `FLOWS.defense`), actions de l'attaque (D4).
- **3g. La surface.** Entrées obligatoires (D7), `creerPartie`, `src/noyau/index.ts`, un test qui joue
  une attaque complète par une partie sans importer `store` (contrôle du graphe d'import compris), mesure
  sur `poc/godot` sans fusion, porte joueur au navigateur (combat de l'Arène, une critique, une mise hors
  de combat, console à 0 erreur).

## 4. Hors périmètre

La boucle du tour et l'IA au-delà de `doAttack` (`runEnemyAI`, `advanceTurn`, `resumeEnemyTurn`, les
hooks de round), les sorts, les manœuvres, l'entretien et le voyage (#2889) ; #2763 (#2724) ; l'UI de
ciblage (`targetingModes`, `targeting-holder-vs-mode`, #2724). Leurs appels au code descendu restent des
imports du noyau.

## 5. Hypothèses révisables

- H-a : le coût d'un hôte installé par module (D6) est accepté : le noyau ne fait tourner qu'une partie
  à la fois par contexte JS, ce que le jeu et le pont font.
- H-b : la fermeture de 3d se coupe sans descendre les 132 fichiers ; sinon 3d se scinde, mesure à
  l'appui.
</content>
</invoke>
