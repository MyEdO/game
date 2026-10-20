# Juge du design v6, vague 3 (#2817, #2889, épique #2882)

Arbre jugé : /home/user/game, branche `wip/2817-vague-3`, HEAD `590600539` (« docs(plans): vague 3, design v6 face au verdict v5 (#2817) »). `origin/main` = `cf4f18bcf`. `git diff --stat cf4f18bcf HEAD -- src` : vide. Pièce présente : `docs/plans/2026-10-19-vague-3-attaque/design.md` (v6, 800 lignes). Toutes les lectures de code sont faites à `cf4f18bcf` (`git show`, `git grep cf4f18bcf`).

Sondes du dossier rejouées (lecture seule) :
- `graphe.cjs` puis `coupe.cjs` sur `A.txt` : les 6 cibles et 14 arcs du §1.
- `invite-salon.mts` : `cf4f18bcf : écran de l'invité après le snapshot = party`.
- `snapshot-invite.mts` : sortie du §1. `champs-init.mts` : `jeu 125`, `UI absents []`, `stateFields UI ['hoverDelta']`.
- `lecteurs-ecran.sh` : `lib.mjs:775`, `lib.mjs:914`, `devtools.ts:1030`. Un recensement plus large (`git grep` de `.screen`, `screen:` et `'screen'` dans `src` et `scripts`, hors test) ne trouve aucun autre lecteur : les 16 sites tiennent.
- `reexports.cjs` : `TOTAL 38 fichiers 18`. `reexports-noyau.cjs` : `TOTAL 8 fichiers 7`.
- `toplevel-refs.cjs` et `premier-niveau.cjs` : conformes au §1.

Sondes du juge, dans `juge-v6/` : `save-net.mts`, `rang-entree.mts`, `chargement-entree.mts`, `net-leave.mts`, `peremption-ecran.mts`, `reexports-src.cjs`, avec leurs sorties `.out`. Aucune ne charge `vite.config.ts`. Aucun fichier du dépôt n'a été écrit, et aucun processus ne tourne après ma fin (`ps` vide, `git status` propre).

## Verdict : REJETÉ (0 bloquant, 4 majeurs, 11 mineurs)

Ce qui tient, mesuré :
- **La péremption de l'écran du client** (M1 v5). Sonde `peremption-ecran.mts`, sur la règle de D5 :
  ```
  invité : salon, hôte au salon = coop | hôte compose = party | invité au créateur, hôte reste sur party = creator | hôte lance = campaign
  hôte au compendium, défaite = menu
  ```
  - Chez l'invité arrivé par le menu ou par `?join` (`App.tsx:58`), `screen` vaut `menu` : il reste au salon tant que l'hôte y est, et il le quitte dès que l'hôte compose.
  - L'équivalence avec `keepCreator` (`netFlow.ts:165`) tient : l'invité garde le créateur tant que l'hôte reste sur `party`, et le quitte au lancement.
  - Sur les chemins qui ouvrent un écran du client puis changent `screen`, l'ordre avec `setScreen` tient :
    - `scenarioFlow.ts:32` et `startInterlude`/`startMassBattle` depuis `test` ;
    - `Editor.tsx:836` ;
    - `App.tsx:68`.
  - Zustand relit `state` à chaque écouteur : les écritures imbriquées de l'abonnement ne livrent pas d'état périmé aux autres abonnés (`audio/wiring.ts:23`, `netFlow.ts:306`, `combatAuto.ts:240`).
- **Les 16 lecteurs de l'écran affiché** sont exacts, ainsi que les deux fixtures de `lib.test.mjs` (`:192-203`, `:2561`).
- **Les réexportations** : 38 dans 18 fichiers de `src/state` et 8 dans 7 fichiers de `src/noyau`, par l'AST.
- **`creator`** :
  - lecteurs : `App.tsx` et `keepCreator` ;
  - écrivains : `PartyScreen.tsx:123, 124, 719`, `combatEffects.ts:1543` et `__wfrp.screen` ;
  - la sortie passe par `closeCreator` → `setScreen('party')` (`CharacterCreator.tsx:304-306`).

  En écran du client, le créateur ne change rien à la composition à plusieurs. Le créateur de l'invité était déjà local (`keepCreator`). L'hôte n'entraîne plus ses invités. `editingHeroId` cesse d'être écrasé chez l'invité par le snapshot, ce qui corrige l'édition d'un héros par l'invité.
- **`seatOwns` et le repli universel** :
  - une modale ouverte décide d'abord ;
  - sinon, le combattant actif ;
  - hors combat, `seatOwns(s, seat, undefined)` rend `seat === 0` (`noyau/sieges.ts:36-40`, `netOwnership.ts:576-582`).

  « Sinon l'hôte » est exact.
- **Le point de la sauvegarde d'entrée.** `transitionTo` n'a qu'un appel d'`autoSave` dans tout `src` (`store.ts:2407`), après `advanceTime` et `SCENE_DIRTY`, avant `openEncounterPsych`. Un écouteur Zustand est synchrone, et l'observation imbriquée ne se redéclenche pas : la remise de l'adaptateur ne change pas le rang. `autoSave` exclut déjà l'invité (`store.ts:2222`).
- **Les tables tirables.** Les familles sont déjà des accesseurs `memoParVersion` passés à `registerTableStepFamily` (`combatFlow.ts:1727, 1978, 4727`, `corruptionFlow.ts:172, 197`, `seaVoyageFlow.ts:1176`, `tavernFlow.ts:1227`, `travelFlow.ts:713, 928`). `setDataset` existe (`data/overrides.ts:319`). L'angle mort cité (`index-vivant-guard.test.ts:38-63`) est exact.
- **`idUnion.out`** est réalisable. `gen-registry.mjs:123-131` écrit l'union dans le corps du registre. La cible est `cibles-registres.mjs:292-299`. Les trois sites d'`IconIdGenerated` sont `types.ts:15,19`, `build-icones.mjs:47-52` et son test.
- **`proseSource()` seul greffon et les `.generated.ts`.** Les `src/**/*.generated.ts` sont ignorés (`.gitignore:132`), mais `postinstall` les produit (`package.json:11`, `build-all.mjs --code`). Sans `registryGen`, la suite du noyau trouve donc `data/index.ts:13-14` sur toute machine installée.
- **Les lignes citées** : vérifiées une à une, et conformes. Liste :
  - `netFlow.ts:110, 114, 118, 165, 170-180` ;
  - `store.ts:105-109, 2085-2086, 2287, 2399-2407, 2853` ;
  - `combatAuto.ts:239-245`, `main.tsx:42`, `tir-rapide-combats-complets.test.ts:95` ;
  - `refusVisible.ts:39-43`, `net/session.ts:27, 64`, `intents.ts:70, 288, 338` ;
  - `actionRegistry.ts:548`, `action-atteignabilite.test.ts:229` ;
  - `combatEffects.ts:1538, 1543`, `stateFields.ts:76`, `CoopLobby.tsx:107, 131`, `modalArbiter.ts:313-317, 332, 356` ;
  - `combatSlice.ts:524-528, 939`, `netOwnership.ts:115`.

Ce qui casse :
- le `net` partagé entre dans la save, et le chargement écrase la session courante ;
- le rang d'entrée ne distingue pas deux `startScene`, et le chargement en deux écritures déclenche une sauvegarde ;
- le refus d'un siège part dans un journal que le combat n'affiche pas ;
- les écrivains de la part par client que le compilateur ne voit pas : `netLeave`, et les fixtures sous transtypage.

## MAJEUR

**M1. D5 : la save porte le `net` partagé, et le chargement écrase la session réseau courante.**
- Ce qu'affirme D5 (`design.md:398-402`) : `repriseDeLaPartie` « ne touche donc jamais `reseauDuClient` […] et le chargement d'une save garde la session réseau courante (ce que fait `applyLoadedSave` aujourd'hui en posant le `net` courant) ».
- Or, par D5 même :
  - `DonneesDeLaPartie` = `EtatDeJeu` − `CHAMPS_PAR_CLIENT` − `HORS_SAVE` (`:396`) ;
  - `CHAMPS_PAR_CLIENT` ne contient que `reseauDuClient` du côté réseau (`:387`) ;
  - le `net` réduit (`roomCode`, `seatNames`, `presence`, `ownership`, `slots`, `gmSeat`) est donc une donnée de la partie : il part en save et revient au chargement.
- Aujourd'hui, `applyLoadedSave` pose le `net` COURANT entier (`store.ts:109`), pour la raison écrite en `:97-99` : « la SESSION coop courante prime sur celle figée dans la save (ne pas ressusciter un salon mort, ne pas dissoudre un salon vivant — l'hôte peut charger une save en ligne) ».
- Sonde `save-net.mts` :
  ```
  cf4f18bcf : net après chargement = {"mode":"host",…,"roomCode":"VIVANT","seatNames":{"0":"Anne","2":"Carl"},"presence":{"2":"ok"},…} | identique à la session courante : true
  D5 v6     : net (part partagée) après chargement = {"roomCode":"ANCIEN","seatNames":{"0":"Anne","1":"Bob"},"presence":{"1":"ok"},"ownership":{"h1":1},"slots":[0,1,0,0]}
  siegesRequis solo, net de la session courante (initialNet) = [0] | net partagé de la save (D5 v6) = [0,1]
  ```
  - L'hôte en ligne qui charge une save reçoit le code de salon, les présences et les sièges d'une session morte, puis les diffuse à ses invités.
  - En solo, une save prise en coop fait attendre le siège 1 par le quorum des ready-checks (`siegesRequis`, `netOwnership.ts:90-98`, qui ne lit pas le mode ; `combatSlice.ts:1802`, `store.ts:2908`, `ReadyRow.tsx:22`).
- Cause : D5 confond deux axes, « voyage dans le snapshot » et « part en save ». La session (`roomCode`, `presence`, `seatNames`, et `ownership`/`slots`/`gmSeat` aujourd'hui) voyage vers l'invité mais ne se recharge pas d'une save.
- Correction :
  - une troisième classe à la même source, la SESSION : dans le snapshot, hors save, gardée au chargement. Par exemple `HORS_SAVE` reçoit `net`, et `donneesDeLaPartie` distingue la cible `'net'` de la cible `'save'` ;
  - la phrase de `:400-402` réécrite ;
  - un test : un hôte en session charge une save, et `roomCode`, `presence` et `seatNames` restent ceux de la session.

**M2. D5 : le rang d'`entreeEnScene` ne tient pas sa promesse (« deux entrées successives diffèrent toujours », `design.md:434`).**
- Deux `startScene` successifs sans transition :
  - `startScene` « repart d'`etatInitialDuJeu()` et ne garde que `screen`, `party`, `net` et `reseauDuClient` » (`:427-428`), donc `entreeEnScene` repart à sa valeur initiale ;
  - `marquerLEntree` est appelée « après sa remise à neuf » (`:438`), et son rang vaut « un de plus que le plus grand des rangs connus (l'état courant […]) » (`:433-434`), soit toujours 1 ;
  - deux scénarios ou deux parties lancés à la suite depuis le menu (`scenarioFlow.ts:17`, `lancerCampagne` → `loadProject` → `startScene`, `store.ts:2327`) donnent donc le même rang, et l'adaptateur n'est pas remis.

  Sonde `rang-entree.mts` :
  ```
  cf4f18bcf : après le 2e startScene, sheetId = null | inspectId = null | camPan = {"x":0,"y":0}
  D5 v6 (un set)   : 2e startScene observé = false | rangs ["rang null→1"]
  D5 v6 (deux set) : observations = ["rang null→1","rang 1→null","rang null→1"] (la remise à null est une observation que D5 ne définit pas)
  ```
  Aujourd'hui, `startScene` remet la fiche, l'inspection et la caméra. En v6, avec une seule écriture, la fiche et la caméra de la partie précédente survivent. Avec deux écritures, D5 ne dit pas ce que fait l'observation d'un `entreeEnScene` remis à `null`.
- Le chargement : « `applyLoadedSave` pose `repriseDeLaPartie(save.data)` […] puis `marquerLEntree(neuve: true)` » (`:463-464`). La reprise pose l'`entreeEnScene` de la save (`neuve: false`, prise à une transition passée). L'observateur y voit une entrée non neuve chez le propriétaire, et sauvegarde.

  Sonde `chargement-entree.mts` :
  ```
  D5 v6, chargement en deux écritures : ["remettreLAdaptateur(false)","autoSave → AUTO_SLOT écrasé par la partie chargée","remettreLAdaptateur(true)"]
  ```
  Aujourd'hui, `loadGame` n'écrit aucun emplacement (`store.ts:2226-2237`). En v6, charger une save manuelle écraserait la sauvegarde automatique.
- Correction :
  - un rang qui survit à la remise (gardé par `startScene` comme `net`, ou un compteur hors de l'état remis) ;
  - `entreeEnScene` hors de la reprise ou posé dans la même écriture que la reprise ;
  - la sémantique de `null` dite ;
  - deux tests : deux `startScene` successifs remettent la fiche ; un chargement n'écrit pas l'emplacement automatique.

**M3. D4 : le refus d'un geste exécuté au nom d'un siège « ne se perd pas » est faux en combat, et contredit la loi du refus visible.**
- D4 (`design.md:372-374`) : « `refuserGeste` l'écrit alors au journal, partagé, comme il le fait déjà hors combat (`refusVisible.ts:39-42`) ».
- Or le journal n'est pas affiché en combat. `LogDrawer.tsx:35-40` rend `battle.log` en combat, et `journal` seulement hors combat. `refuserGeste` n'écrit au journal que HORS combat, pour cette raison même (`refusVisible.ts:4-8, 39-41`).
- La spec HUD (`docs/plans/2026-08-16-spec-hud-combat.md:680`) pose : « **Refus VISIBLE par construction** — jamais un refus muet au journal (doctrine #516 ; le journal n'est pas affiché en combat, `LogDrawer`) ; le refus se dit à l'écran au point du geste ».
- La fiche utilisateur `user-arbitrage-survol-rt-strict-refus-au-clic` (verbatim 2026-08-24) le reprend : « le refus se rend AU CLIC par le mécanisme de refus existant ».
- Conséquences en v6 :
  - en combat, le refus d'un clic d'invité n'atteint aucun écran, ni le sien ni celui de l'hôte ;
  - les refus de combat s'accumulent dans le journal de partie (40 lignes, `store.ts:3161-3164`), puis apparaissent à toute la table après le combat ;
  - le test promis en 3c (« le refus va au journal, pas au `refus` de l'hôte », `:716-717`) verrouillerait le refus muet que la cible interdit.
- Correction :
  - le refus doit atteindre le siège qui a cliqué : un refus par siège dans l'état partagé (clé de siège, nonce), ou une réponse du transport à l'intention refusée, posée dans le `refus` de l'invité ;
  - un test : un invité qui clique en combat un geste refusé chez l'hôte voit le refus dans SA bannière ; l'hôte n'en voit aucun.

**M4. D5 : la scission de `net` ne voit pas ses écrivains hors du compilateur, et `netLeave` casse.**
- D5 dit seulement que « les 90 lecteurs […] lisent `reseauDuClient` ; le compilateur les trouve tous » (`:384-386`). Les écrivains de `mode`, `mySeat`, `connection` et `hostAway`, à `cf4f18bcf`, sont :
  - `netHostStart` (`netFlow.ts:305`), `netJoin` (`:337`, `:340`, `:363`) et `applyNetSnapshot` (`:174-180`), que le compilateur trouve, parce que la clé est explicite dans un littéral ;
  - `netLeave` (`:429`, `set({ net: initialNet() })`), qui compile tel quel une fois `initialNet` réduit à sa part partagée, et laisse `reseauDuClient` intact.

  Sonde `net-leave.mts` :
  ```
  cf4f18bcf : après netLeave, mode = local | mySeat = 0 | connection = ok | hostAway = false
  D5 v6     : après netLeave, reseauDuClient = {"mode":"guest","mySeat":2,"connection":"reconnecting","hostAway":true} → netHostStart refuse (« mode !== local », netFlow.ts:245), netJoin répond coop.alreadyInSession (:313)
  ```
  Aucun test ne le voit : les deux seules assertions de mode après une sortie (`netFlow.test.ts:47, 63`) portent sur des chemins où `mode` n'a jamais quitté `local`.
- Les fixtures :
  - 257 lignes, dans 127 fichiers de test, écrivent `mode`/`mySeat` dans `net` ;
  - 78 de ces lignes, dans 43 fichiers, portent un transtypage (`as never`, `as any`, `as unknown`) sur la même ligne, par exemple `pastille-entite.test.tsx:100` : `useGame.setState({ … net: { mode: 'local', mySeat: 0, … } } as never)`.

  Le compilateur ne les voit pas. Après la scission, elles écrivent une clé que plus personne ne lit, et le test tourne sous le régime par défaut de `reseauDuClient` : rouge, ou vert à tort. La preuve de 3c (typecheck plus suite verte) ne prouve donc pas la scission.
- Correction :
  - nommer `netLeave` et la valeur initiale de `reseauDuClient` (`initialReseauDuClient()`) ;
  - un helper unique de testkit qui pose le régime réseau d'un client (`.claude/rules/tests.md`, « UN helper partagé ») ;
  - une preuve par `git grep` : aucun test n'écrit `mode`/`mySeat` sous `net` ;
  - le compte des fichiers de test réécrits, au lot.

## MINEUR

- **m1. « 90 lecteurs dans 33 fichiers ».**
  - La commande du §1 (`design.md:202`) rend 88 lignes et 92 occurrences, dans 33 fichiers. 90 n'est ni l'un ni l'autre.
  - Des formes échappent à la regex : `devtools.ts:777-778` (`n.mode`, `n.mySeat`) et `netOwnership.ts:150` (`const { mode, mySeat } = state.net`). Le compilateur les trouve, mais le compte affiché est faux.
- **m2. `reseauDuClient` range de l'état de transport web dans le noyau, contre le critère du §1.** `connection` et `hostAway` ne sont lus que par `ui` (`CoopLobby.tsx:114-116`, `CoopPanels.tsx:196-198`) et écrits que par `netFlow` (A). Par le critère du §1 (« A : ce qui ne porte qu'un état d'interface, un service web […] et que seuls A, `ui` ou `gameIso` lisent »), ces deux champs vont dans `EtatDeLAdaptateur`. `mode` et `mySeat`, lus par N (`netOwnership.ts:150`), restent seuls dans `reseauDuClient`.
- **m3. Tests de D5 (écrans) non nommés** : même classe que le m3 v5.
  - Rougissent : `meta-effects.test.ts:28` (`screen` attendu `creator`), `codex-overlay.test.ts:23, 29, 31` (`screen` attendu `compendium`).
  - Restent verts sur une valeur hors `EcranDuJeu`, par le repli d'`ecranAffiche` sous `as never`, donc verrouillent l'ancienne forme : `boutonAPopup.test.tsx:87`, `Editor.test.tsx:737`, `raccourcis-modificateurs.test.tsx:103, 114, 148, 175, 187`.
  - Correction : les nommer en 3c, et les réécrire sur `setScreen`, ou sur `ecranDuClient` posé.
- **m4. `sauter` en `interne` (m8 v5 corrigé pour la porte seulement).**
  - La classe se définit « aucun écran ne l'émet » (`intents.ts:282`), alors que `useStagePointer` l'émet.
  - Chez l'invité, `sauter` (et `moveParty`, `useStagePointer.ts:248, 266`) joue dans SA copie : `planJump`, `refuserGeste`, `runFlow` du Test de saut, que le snapshot suivant efface. C'est le poison que m8 v5 demandait de trancher « avec la classe des deux actions ».
  - Correction : une classe honnête pour les gestes de marche émis par l'écran, et leur sort chez l'invité (refus local, ou routage au jeton d'exploration).
- **m5. `actionnerLaPorte` : la règle de possession est mal dite.**
  - « En combat, le propriétaire du tour actif » est imprécis : une modale ouverte prime, en combat comme hors combat (`netOwnership.ts:577-579`).
  - Hors combat, le repli rend le siège 0, pas le siège MJ, alors que le jeton d'exploration voisin (`interactEntity`) route `seat === (s.net.gmSeat ?? 0)` (`netOwnership.ts:556`). Une porte d'exploration est une interaction d'entité. À trancher, et à dire.
- **m6. Le refus hors allowlist au journal par `coop.intentRefused`.** Le texte de cette clé est « Action réseau refusée ({action}) : pas le propriétaire. » (`fr.ts:2315`). Il est faux pour un refus d'allowlist, et montre au joueur l'id brut de l'action. D9 (`design.md:574-576`) réutilise la clé sans le dire. Il faut une clé propre, à libellé joueur.
- **m7. La preuve de 3c pour `ecrireLeClient` ne prouve pas.** « `git grep` des écritures de ces champs dans `src/noyau` ne rend que `ecrireLeClient` » (`design.md:373-374`) :
  - `refus:` rend 44 lignes dans `src/state`, `src/noyau` hors test, pour la plupart des clés homonymes (`combatFlow.ts:1213-1219`, `dialogue.ts:130`, `seaVoyageFlow.ts:634`…) ;
  - le grep ne voit pas `resetFields('scene' | 'combatStart')`, qui remet `refus` (`stateFields.ts:48`), dans `transitionTo` (`store.ts:2395`) et au début du combat ;
  - correction : une preuve par le type (`Omit<…, CHAMPS_PAR_CLIENT>` sur le `Set` du noyau), ou par une sonde AST, et `resetFields` traité.
- **m8. `vitest.noyau.config.ts` « sans `setupFiles` » perd le gel du catalogue.** La suite principale gèle les entrées des données par `test-setup.ts:98` (`import './data/overrides'`, #2097 ; gel à `overrides.ts:310-314`), et la production n'importe ce module qu'en dev (`main.tsx:39`). Sans le dire, la suite du noyau tournerait sans le gel qui attrape une mutation de donnée. Correction : un `setupFiles` minimal qui l'importe, ou le gel porté par le chargement des données.
- **m9. La garde `reexportations.mjs` est bornée aux sites de la vague.** Sonde `reexports-src.cjs` sur tout `src` à `cf4f18bcf` :
  ```
  {"src/data":{"n":11,"f":8},"src/engine":{"n":16,"f":12},"src/gameIso":{"n":66,"f":54},"src/noyau":{"n":8,"f":7},"src/scenes":{"n":1,"f":1},"src/state":{"n":38,"f":18},"src/ui":{"n":11,"f":6}}
  TOTAL src 151
  ```
  D2 pose la classe (« une purge sans garde se défait ») et la garde ne couvre que 46 des 151. Credo : « Corriger la classe entière » ; « Un smell mesuré par une garde vit dans le stock de la garde ». Correction : la garde sur tout `src`, avec les 105 autres en stock, ou la raison pour laquelle une réexportation hors `state`/`noyau` n'est pas de la classe.
- **m10. `build-icones.test.mjs:12-23` mute en place l'entrée importée du registre** (`entree.out = 'preuve/…'`, restaurée en `finally`). C'est proscrit par `.claude/rules/tests.md` (« la mutation en place d'un registre importé »). D6 touche ce test sans corriger le poison du périmètre. Correction : la cible passée en argument au rendu, sans mutation.
- **m11. Nom `entreeEnScene`.**
  - Le nom existe déjà dans la même couche, pour un autre concept : l'export `entreeEnScene()` de `state/entreeEnScene.ts:51` (rendez-vous du voile, lu par `GameStage3D.tsx:115`, rangé A au §1).
  - C'est aussi une clé d'`ambiance.json:21`.

  Le champ de jeu homonyme met deux concepts sous un même nom. Il faut un autre nom (par exemple `derniereEntree`).

## Par critère

1. **Points du v5.**
   - M1 : corrigé sur le fond (péremption, `peremption-ecran.mts` ; test promu nommé).
   - M2 : corrigé (16 sites, `src` et `scripts`, kit et fixtures) ; les tests unitaires des écrans restent non nommés (m3).
   - M3 : corrigé pour le snapshot (la part par client ne part plus, `keepCreator` disparaît). Non corrigé à la classe :
     - la session entre dans la save (M1) ;
     - les écrivains hors compilateur (M4) ;
     - le rangement de `connection`/`hostAway` (m2).
   - m1 : corrigé (38 + 8, AST) ; garde bornée (m9).
   - m2 : corrigé.
   - m3 : corrigé pour les tests nommés au v5 ; la classe reste ouverte pour D5 (m3).
   - m4 : corrigé (`initCombatAuto` dans `store.ts`, désabonnement, deux appelants).
   - m5 : corrigé côté hôte (`ecrireLeClient`), faux côté invité (M3).
   - m6 : corrigé (deux contrôles distincts, confirmés à `session.ts:64` et `netOwnership.ts:586-589`) ; mauvais libellé (m6).
   - m7 : mécanisme posé ; le rang casse (M2).
   - m8 : corrigé pour la porte, pas pour le saut (m4).
   - m9 : corrigé pour le chargement des JSON ; le gel est perdu (m8).
   - m10 : corrigé.
   - m11 : corrigé.
   - m12 : corrigé ; le poison du test reste (m10).
   - Non vérifiés v5 : D8 est renvoyé à 3h et dit comme tel ; `poc/godot` en 3e ; l'ordre d'inscription est prouvé en 3b sur tout le graphe. Acceptés.
2. **Affirmations neuves ou modifiées.**
   - Vraies : 16 lecteurs ; 38 + 8 ; 11 déclarations et 44 instructions ; `creator` (lecteurs, écrivains, `keepCreator`) ; sémantique de `seatOwns` et du repli (« sinon l'hôte ») ; unique appel d'`autoSave` ; `HostSession` ignore en silence ; les lignes citées.
   - Fausses :
     - 90 lecteurs (m1) ;
     - « le chargement d'une save garde la session réseau courante » (M1) ;
     - « deux entrées successives diffèrent toujours » (M2) ;
     - « le refus […] ne se perd pas » (M3) ;
     - « le compilateur les trouve tous », étendu à tort aux écrivains (M4) ;
     - « en combat, le propriétaire du tour actif » (m5) ;
     - `sauter` « comme `moveParty` » dans une classe que l'écran n'émet pas (m4).
3. **Mécanismes neufs.**
   - Tiennent :
     - la péremption de l'écran du client, et l'ordre avec `setScreen` ;
     - `ecranAffiche` ;
     - `remettreLAdaptateur` (24 champs rangés) ;
     - la sauvegarde d'entrée au même point ;
     - les tables tirables en accesseurs ;
     - `idUnion.out` ;
     - `proseSource()` pour le chargement.
   - Ne tiennent pas :
     - `repriseDeLaPartie` sur la save (M1) ;
     - le rang (M2) ;
     - le refus au journal (M3) ;
     - la scission côté écrivains (M4).
   - Incomplets : `ecrireLeClient` et sa preuve (m7) ; les classes coop (m4, m5) ; la garde des réexportations (m9).
4. **Séquencement.**
   - L'ordre 3a, 3b, 3c, 3d, 3h, 3e reste réalisable. Aucun pont ni seconde implémentation n'est prévu ; l'échafaudage de D2 est nommé et borné.
   - 3c porte les quatre majeurs.
   - Sa preuve ne voit ni M1 (aucun chargement en session dans les tests promus), ni M2 (la porte joueur ne lance pas deux parties de suite), ni M4 (suite verte possible avec `netLeave` cassé et des fixtures transtypées).
   - Son test de refus verrouillerait M3.
5. **Credo et règle 3.**
   - Pas de garde de synchronisation ; le noyau dépend du moteur seul.
   - La source unique de la classe par client est posée, mais une troisième classe, la session, y manque (M1).
   - Le poison du périmètre reste dans le saut de l'invité (m4) et dans la mutation de registre du test d'icônes (m10).
   - La garde de classe est bornée aux sites (m9).
   - La cible utilisateur du refus visible est violée (M3).
6. **Affirmations contredites ou sans mesure** :
   - les 90 lecteurs (m1) ;
   - la session gardée au chargement (M1) ;
   - le rang toujours distinct (M2) ;
   - le refus qui ne se perd pas (M3) ;
   - le compilateur qui trouve tout (M4) ;
   - la règle de porte en combat (m5) ;
   - la classe de `sauter` (m4) ;
   - la preuve par grep d'`ecrireLeClient` (m7) ;
   - « sans `setupFiles` » sans conséquence dite (m8).

## Non vérifié

- **Deux entrées dans la même fenêtre de diffusion.** La diffusion est différée de 120 ms (`netFlow.ts:136-151`) : l'invité ne voit que la dernière de deux entrées rapprochées. Si une entrée neuve est suivie de près d'une entrée non neuve, il ne ferait que la remise partielle. Trancherait : une sonde qui cherche un `startScene` suivi d'un `transitionTo` dans la même pile synchrone (lancement de campagne, scénario).
- **La collision de rang à un redémarrage de l'hôte** (l'hôte repart à 1 alors que l'invité est resté connecté). C'est un cas limite, non mesuré.
- **Le sort réel des 78 lignes de fixtures transtypées** (rouges ou vertes à tort). Trancherait : le jeu de ces 43 fichiers sur une branche où `net` perd `mode`/`mySeat`.
- **En solo, l'effet de `ecranPlein` qui ne lit plus l'écran du client.** `surfaceTientLaMain` est consommé par `dialogue.ts:62`, `stageWalk.ts:45` et `store.ts:2715`. Les touches restent gardées par `ecranAffiche` et la marche par `modaleDuDessus()`. Aucune régression n'est prouvée.

## Sondes (promouvables)

`save-net.mts` (`npx tsx <chemin>` depuis `/home/user/game`) : M1. À promouvoir en test de `store` après 3c (un hôte en session charge une save, et la session reste).
```ts
import { useGame } from '/home/user/game/src/state/store';
import { snapshotSave } from '/home/user/game/src/state/saves';
import { initialNet } from '/home/user/game/src/state/netFlow';
const g = useGame.getState;
useGame.setState({ net: { ...initialNet(), mode: 'host', roomCode: 'ANCIEN', seatNames: { 0: 'Anne', 1: 'Bob' }, presence: { 1: 'ok' }, ownership: { h1: 1 }, slots: [0, 1, 0, 0] } });
const save = snapshotSave(g() as never, useGame.getInitialState() as never, 'x');
useGame.setState({ net: { ...initialNet(), mode: 'host', roomCode: 'VIVANT', seatNames: { 0: 'Anne', 2: 'Carl' }, presence: { 2: 'ok' }, ownership: {}, slots: [0, 2, 0, 0] } });
const avant = JSON.stringify(g().net);
g().importGame(JSON.stringify(save));
console.log('cf4f18bcf : identique à la session courante :', JSON.stringify(g().net) === avant);
// règle D5 v6 : la part partagée de save.data.net par-dessus (voir le fichier pour la suite et siegesRequis)
```
Sortie : voir M1.

`rang-entree.mts` : M2 (deux `startScene`). À promouvoir : deux `startScene` successifs remettent `sheetId`, `inspectId` et `camPan`. Sortie : voir M2.

`chargement-entree.mts` : M2 (chargement). Modèle au texte de D5. À promouvoir : `loadGame` n'écrit pas l'emplacement automatique. Sortie : voir M2.

`net-leave.mts` : M4. À promouvoir en test de `netFlow` : après une session d'invité (siège posé), `netLeave` rend `reseauDuClient` à sa valeur initiale, et `netHostStart` redevient possible. Sortie : voir M4.

`peremption-ecran.mts` : modèle de la péremption (ce qui tient), à côté d'`invite-salon.mts`.

`reexports-src.cjs` (`node <chemin>`) : la classe des réexportations sur tout `src`, lue à `cf4f18bcf` par `git show`. Sortie : voir m9.
