# Juge du design v4, vague 3 (#2817, #2889, épique #2882)

Arbre jugé : /home/user/game, branche `wip/2817-vague-3`, HEAD `7a6a1e57b`. `git diff --stat cf4f18bcf HEAD -- src` est vide, `git status` est vide. La pièce est présente : `docs/plans/2026-10-19-vague-3-attaque/design.md` (v4, 488 lignes), avec `sondes/` (17 fichiers).

Sondes rejouées, en copie dans ce dossier : `graphe.cjs` donne un `graphe.json` identique octet pour octet à celui du juge v3. `coupe.cjs` rend exactement la sortie du §1 (14 arcs, 11 fichiers, 3 dans `combatSlice`). `zones.cjs` ne rend, hors `store.ts`, que les deux arcs de type `IconId`. `classes.mts` rend 645 clés. `storeparts.cjs` rend 310 membres, 235 actions, 1 161 lignes, et les 34 actions d'adaptateur font 90 lignes. Les 108 inscriptions dans 38 fichiers d'`inscriptions.tsv` se retrouvent par la commande de son en-tête. La sonde positive de D12 (#1858 ouvert, ligne 26 du corps de #2763) se retrouve par `gh api`.

Sondes du juge, toutes dans ce dossier : `acces-typés.cjs`, `etatclo.cjs`, `d11-matrice.mts`, `snapshot-probe.mts`, `snapshot-invite.mts`, `champs-init.mts`, `icon-probe.mjs`, `hmr-probe.mjs`, et des scripts `node -e` reproduits plus bas.

Incident à déclarer : `hmr-probe.mjs` charge `vite.config.ts`, dont le greffon `registryGen()` a lancé `docs:build` et réécrit `docs/.sources-lues.json` (fichier généré, ignoré par git ; `git status` reste vide, `src/state/formats.generated.ts` n'a pas changé d'horodatage). Aucun autre fichier du dépôt n'a été touché, et aucun processus ne tourne après ma fin.

## Verdict : REJETÉ (0 bloquant, 6 majeurs, 13 mineurs)

Ce qui tient, mesuré :
- la partition des FICHIERS (42 / 123), le critère et ses justifications (`advancement`, `poste`, `turnEconomy`, `jumpMove`) ;
- le décompte et la liste des 34 actions d'adaptateur, et la classe coop de chacune (22 `local`, 6 `hôte`, 6 `interne`) ;
- la fermeture de TYPE de `Jeu` : hors `store.ts`, elle n'atteint dans A que `NetState` (que D5 déménage), plus les types du rig atteints par `Combatant` (arête `engine → gameIso`, vague 5) ; `etat.ts` compile donc en principe ;
- B1 v3 sur le fond : `battleClickTile`, `battleClickEntity`, `cancelMove`, la tête Tir rapide, `batteryBlock`, les gardes et la sélection du mode restent des actions du noyau ; les reprises `:1590`, `:1591`, `:595`, `:1613` et `targetingModes.ts:814` appellent le noyau ;
- l'union des intentions (D9) et la scission de la table des classes, réalisables avec `TableDesClasses<S, T>` ;
- D11 : équivalence prouvée sur 160 cas, invariant `HORS_MODAL` exprimable ;
- la source unique de l'exclusion des tests hors store (`EXCLUSIONS_DE_LA_SUITE`), lue par les quatre consommateurs nommés.

Ce qui casse :
- les coupes de champs de D5 ont encore un trou (`combatSlice.ts:1124`) et deux coupes fausses (`hoverDelta`, la remise à neuf de `startScene`) ;
- la moitié d'adaptateur voyage aujourd'hui dans le snapshot coop et la sauvegarde, et le design ne dit pas ce qu'elle devient : `ecranDuShell` « hors snapshot » n'a pas de mécanisme, et le précédent cité par H-e est faux ;
- le premier niveau de `store.ts` porte des règles liées au propriétaire (deux écouteurs de `TIME_ADVANCED`, un abonnement, six verbes de clôture) que ni D5, ni D7, ni 3c ne rangent ;
- le régime de tests de D7 et D10 enfreint une garde du dépôt et `.claude/rules/tests.md` ;
- la justification d'`IconId` (D6) est fausse : la garde citée ne voit pas ces tables ;
- le siège d'une partie à plusieurs joueurs lit l'intention armée du propriétaire.

## MAJEUR

**M1. D5 : les coupes de champs sont incomplètes ou fausses sur trois sites.**
- `combatSlice.ts:1124`, dans `battleClickEntity` (action du noyau selon D4), écrit un champ d'interface : `set({ preemptAiming: null, combatCursor: null })`. Le §1 affirme « leurs accès par N, tous coupés » et ne cite pour `combatCursor` que `combatFlow.ts:7292` et `:7484`. Sonde par expression régulière sur les 123 fichiers de N (`n-touche-a.txt`) : la ligne `combatSlice.ts:1124 FLD:combatCursor` y figure. En 3c, le type de D5 refuse cette écriture et aucune coupe ne la remplace. C'est la classe de M2 v3.
- `hoverDelta` : D5 supprime les sept remises à `null` de `combatSlice` et H-d affirme que le survol suffit. Or ces remises sont un contrat daté (#1135), écrit à `set-scan-guard.test.ts:46-54` : « remis à null par le MÊME `set()` qui réécrit `battle.preview`, un seul cadre de rendu, sinon la jauge survit à l'aperçu qu'elle chiffrait ». L'effet de `useHoverTargeting.ts:206-219` tourne APRÈS le rendu, donc l'image périmée que #1135 interdit existe par construction. Le contrat est verrouillé par `movement-resolution.test.ts:113-133` (« purge l'intention de survol au tap, au commit et à l'annulation de Course »), que le design ne nomme pas et que 3c rendrait rouge. H-d n'est ni honnête (elle contredit la raison écrite du code) ni vérifiable à l'œil (un seul cadre).
- `startScene` (une des 201 actions qui descendent) remet tout l'état à neuf par `useGame.getInitialState()` (`store.ts:2290`), une référence de VALEUR au store que ni `storeparts.cjs` (qui ne suit que les identifiants importés) ni le design ne voient. Au noyau, `useGame` n'existe pas : il faut un état initial du jeu au noyau. Ce même état initial manque à D9, puisque `creerPartie(etatInitial, …)` n'a aucune fabrique pour le produire : les valeurs initiales des quelque 50 champs de jeu du littéral de `create` (`storeparts.json`, 75 membres non fonctionnels) ne sont rangées nulle part. Côté adaptateur, D5 ne remet sur `SCENE_ENTREE { neuve: true }` que `camEdge` et `camPan`. Aujourd'hui `startScene` remet aussi à l'état initial `sheetId`, `inspectId`, `hovered`, `hoverCombatantId`, `codexOverlay`, `possessionsScreen`, `gameMenuOpen`, `editingHeroId`, `compendiumFocus`, `sheetTab`, `sheetScroll`, `sheetAlarmsSeen`, `combatCursor`, `keyOverrides`, `debugLabels`, `debugRoofCut` et `reveler`. Le design ne dit pas qui le fera.
- Correction :
  - nommer la coupe de `:1124` (l'adaptateur retire le curseur quand `preemptAiming` passe à `null`, ou sur un événement émis à l'ouverture du tir) ;
  - garder l'invariant de #1135 par l'adaptateur, dans la même écriture : un abonnement synchrone du store sur le changement de `battle.preview` ou de `pendingRun` qui remet `hoverDelta`, avec `movement-resolution.test.ts:113` réécrit sur ce contrat et le cliquet `set-scan-guard` resserré ;
  - déclarer au noyau `etatInitialDuJeu()` (valeurs initiales des champs de jeu, `initialFields()` du manifeste du noyau compris), lu par `startScene` et par `creerPartie` ;
  - écrire la liste des champs d'adaptateur remis à neuf sur `SCENE_ENTREE { neuve: true }` et de ceux qui sont gardés.

**M2. D5 et H-e : la moitié d'adaptateur voyage dans le snapshot et dans la sauvegarde, et `ecranDuShell` « hors snapshot » n'a pas de mécanisme.**
- `snapshotSave` (`saves.ts:79-91`) copie toute clé de l'état initial hors des quatre entrées de `HORS_SAVE` (`saves.ts:60-71`), et `netSnapshot` passe par lui (`netFlow.ts:97-122`). Sonde `snapshot-probe.mts` : 22 des 25 champs d'interface (dont `camRot`, `sheetId`, `keyOverrides`, `codexOverlay`, `combatCursor`, `compendiumReturn`) sont dans le snapshot ; seuls `debugLabels`, `debugRoofCut` et `reveler` en sont absents.
- `applyNetSnapshot` repart de `getInitialState()` puis étale le snapshot (`netFlow.ts:160-173`) et ne préserve que les trois champs de `CHAMPS_DU_SIEGE`. Sonde `snapshot-invite.mts` (hôte : `codexOverlay` « hote », `sheetId` « hote », `camRot` 3, `keyOverrides` KeyH ; invité : « invite », 1, KeyI, une intention armée), sortie :
  ```
  codexOverlay {"category":"talents","id":"hote"} | sheetId hote | camRot 3 | keyOverrides {"cam-left":["KeyH"]} | localIntent {"actionId":"courir"}
  ```
  La fenêtre Codex de l'invité est donc écrasée par celle de l'hôte : le précédent de H-e (« comme la fenêtre Codex (`codexOverlay`), déjà par siège ») est faux.
- Conséquences pour le design :
  - `ecranDuShell`, champ neuf de l'état initial, partira dans le snapshot et dans la sauvegarde, contre « PAR CLIENT, hors snapshot » ;
  - `CHAMPS_DU_SIEGE` se dit « liste unique des champs de jeu par siège », mais un quatrième champ par client vivrait ailleurs, ce qui fait deux sources.
- Les lecteurs de `screen` qui veulent l'écran AFFICHÉ ne sont pas traités. `clavier/keybindings.ts:220, 275, 276, 281, 283, 495` testent `s.screen === 'campaign'`, et `audio/music.ts:27` teste `s.screen !== 'campaign'`. Avec le compendium ouvert, `screen` reste `campaign` : les touches de caméra et d'exploration tireraient sous l'écran du Codex, et la musique de scène continuerait. `keybindings.ts:253` (`enEditeur`) lit `'editor'`, qui passe dans `ecranDuShell`. Le §1 ne compte qu'une lecture dans `keybindings.ts`.
- Correction :
  - décider que la moitié d'adaptateur ne voyage pas : le snapshot est `EtatDeJeu` moins `CHAMPS_DU_SIEGE`, et l'invité garde toute sa moitié d'adaptateur, ce qui corrige aussi l'écrasement d'aujourd'hui (poison du périmètre, credo) ;
  - dériver cette exclusion du type (une seule source), et décider ce que la sauvegarde garde de la moitié d'adaptateur ;
  - exporter un lecteur unique de l'écran affiché (`ecranDuShell ?? screen`), et le faire lire par `App.tsx`, `keybindings.ts` (7 sites) et `music.ts` ;
  - réécrire H-e sans le précédent faux.

**M3. Le premier niveau de `store.ts` porte des règles liées au propriétaire que le design ne range pas.**
- Inventaire des instructions de premier niveau de `store.ts` (script `node -e` sur l'AST, sortie résumée) :
  - `:1818-1843`, six `registerCloture` : `avancerHorloge`, `retirerEntite`, `marquerActionJouee`, `dialogueSuivant`, `testRateDeLActeur`, `teardownDeVictoire` ;
  - `:1739` `applyDialogueTransition`, `:1755` `settleFall`, `:1790` `tombantsDe`, `:1799` `arriveeOccupee`, `:1808` `soldeDeLAction` (LDB 13 l.86-88) ;
  - `:3295` `bus.on(EVT.TIME_ADVANCED, () => fireScheduledEffects(useGame.getState, useGame.setState))` (#668) ;
  - `:3300` `bus.on(EVT.TIME_ADVANCED, () => purgeSurAvanceDHorloge(useGame.getState, useGame.setState))` ;
  - `:3315-3321` `useGame.subscribe(...)`, réconciliation de l'occupation des sièges (`releaseRecomposedRanks`).
- Le §1 dit que les 201 actions emportent « 5 déclarations de premier niveau ». Une recherche des identifiants de premier niveau cités par les 201 corps en trouve au moins 9, plus `registerScene` et `useGame`.
- D10 range les six clôtures du store parmi « les 6 verbes posés par `store.ts` qui touchent l'adaptateur [et qui] deviennent des événements du bus ». Lues au code, aucune ne touche l'adaptateur : ce sont des règles de jeu (horloge, retrait d'entité, dialogue, Crampes MSRC 16 l.152, reprise de cascade). En faire des événements écoutés par A sortirait ces règles du noyau, et une partie hors store ne les jouerait plus.
- D7 affirme que « deux points d'injection capturent le `get`/`set` du propriétaire ». Les deux écouteurs de `TIME_ADVANCED` et l'abonnement d'occupation le capturent aussi, par `useGame`. Une partie (D9) ne tirerait donc ni les effets différés ni la purge des effets à durée d'horloge, et ne relèverait pas un héros recomposé : un hôte hors store jouerait une autre règle que le jeu web, sans qu'aucun test de 3e ne le voie. L'abonnement suppose de plus une observation de chaque écriture, que le `Set` d'une partie n'offre pas.
- Correction :
  - inventorier par sonde TOUT le premier niveau de `store.ts` ;
  - descendre les clôtures dans la table fermée des clôtures du noyau (D10), et les fonctions avec les actions ;
  - faire poser par `brancherLeJeu(get, set)` les deux écouteurs de `TIME_ADVANCED` ;
  - porter la réconciliation d'occupation au noyau, soit dans le `set` de la partie et du store (observation de transition), soit chez les écrivains de `party` derrière une primitive unique ;
  - corriger « 5 déclarations ».

**M4. D7 et D10 : le régime des tests enfreint une garde et `.claude/rules/tests.md`.**
- D7 prescrit, pour `echec-sans-jet-appliers.test.ts:244-246`, d'« observe[r] l'émission par `vi.mock` du module `noyau/triggeredEffects` ». `src/vi-mock-isolate-guard.test.ts:31` et `:75` refusent tout `vi.mock(` dans la suite tant qu'`isolate: false` (`vite.config.ts:90`) : la prescription est rouge en CI.
- D10 prescrit `vi.spyOn(TABLE, genre)` sur un genre réel et `poserEntreeDeBanc(table, cle, entree)` pour le socle. Ces deux gestes sont des mutations en place d'un registre importé, ce que `.claude/rules/tests.md:15` proscrit. Le seam de banc, exporté par un module de production (`src/noyau/tables.ts`) et appelé par les seuls tests, garde de plus les tables mutables à l'exécution et accepte des clés hors de l'union fermée (`'deja'`, `'note'`…), ce qui contredit la « table statique typée par une union fermée » de D10.
- La suppression du filet de `test-setup.ts:462, 481-482` (instantané et restauration de `cascadeAppliers`) fait reposer l'isolement entre fichiers d'un même worker sur chaque test qui pense à restaurer.
- Correction :
  - le socle reçoit sa table en paramètre (la table du jeu par défaut au seul site de production), et les tests du socle passent une table de fixture nommée, sans mutation ;
  - un test sur un genre réel asserte l'effet observable sur une fixture (pour `onOwnTestFailed`, les Crampes d'un porteur réel), sans espion de module.

**M5. D6 (`IconId`, m2 v3) : la garde citée ne voit pas les deux tables, et le typage `string` retire le seul contrôle.**
- D6 dit que les littéraux de `MANEUVER_ICON` et `REVEAL_ICON` « restent vus par la garde de build `ui/no-phantom-icon.test.ts` ». Cette garde n'extrait que les clés `icon:` (`scripts/guards/lib/iconRefs.mjs:12`, `/(?:"icon"|\bicon)\s*:\s*…/`). Or les deux tables ont pour clés des genres (`arme: 'action/attack'`, `miscast: 'nav/dice'`). Sonde `icon-probe.mjs` :
  ```
  src/state/combatManeuvers.ts valeurs d'icône 12 vues par la garde 0
  src/state/revealStep.ts valeurs d'icône 6 vues par la garde 0
  ```
- Retypées `Record<…, string>`, ces 18 valeurs ne seraient plus contrôlées par rien. Le point m2 v3 est réécrit, pas corrigé.
- Correction (une des deux) :
  - générer l'union `IconId` dans une zone que le noyau lit (le registre généré est une donnée d'ids) ;
  - écrire le test côté `ui` que demandait le juge v3 : chaque valeur des deux tables appartient à `ICON_DEFS`.

**M6. D9 et D4 : le verdict d'armement n'est pas « par siège » dans une partie à plusieurs joueurs.**
- Ce qui tient :
  - en solo, `courseArmee(get)` (`combatSlice.ts:939`) et `chargeArmee(get)` (`:1136`) lisent l'intention du joueur ;
  - en coop web, l'invité joint son verdict (`emettreIntentInvite`, `netFlow.ts:209` ; `INTENT_VERDICT_ARGS` force `courseArmee`/`approche` à un booléen) et l'hôte le lit dans les options.
- Ce qui ne tient pas : `localIntent` est UN champ par état, donc par CLIENT, et non par siège. Dans une partie qui sert plusieurs sièges (D9 : « Un hôte à plusieurs joueurs a donc la possession de la coop web, sans la recoder »), une intention `battleClickTile` envoyée par un siège sans `courseArmee` dans ses options retombe sur `courseArmee(get)`, c'est-à-dire sur l'intention ARMÉE DU PROPRIÉTAIRE. Puis `consumeIntent()` (`combatSlice.ts:524-528`) la dissout. C'est le défaut que `localIntent.ts:84-90` décrit (« l'hôte débloquerait le geste d'autrui en armant SA propre case »).
- D9 dit appliquer « la même [règle] que `netFlow.applyIntent` », sans dire qu'elle est extraite. Or le corps d'`applyIntent` (`netFlow.ts:259-275`) porte aussi la réécriture du siège de `partyAddHero` et de `partyReplaceHero`. Une seconde écriture de cette règle dans `envoyer` divergerait.
- Correction :
  - extraire le corps d'`applyIntent` en une fonction du noyau, appelée par `netFlow` et par `envoyer` ;
  - poser que l'intention d'un siège porte son verdict (`argsAvecVerdictLocal` côté émetteur, exporté par `index.ts`, ou un verdict absent valant `false` dès qu'un `siege` est donné) ;
  - poser que `consumeIntent` ne touche pas l'intention du propriétaire quand le siège agissant n'est pas le sien ;
  - renommer `CHAMPS_DU_SIEGE` en champs « par client ».

## MINEUR

- **m1.** Les comptes de champs : l'état initial porte 150 champs (25 d'interface, 125 de jeu ; sonde `champs-init.mts`). Le §1 dit 26 + 124 = 150, en comptant `ecranDuShell`, qui n'existe pas encore. Correction : écrire 125 champs de jeu.
- **m2.** `NetState (store.ts:890)` : la ligne 890 est le CHAMP `net`. Le type est déclaré à `netFlow.ts:48`, avec `initialNet` (`:67`) qui doit le suivre. Correction : citer `netFlow.ts:48-70`.
- **m3.** D7 et H-a, le rechargement à chaud. `main.tsx` importe `./state/store` (`main.tsx:7`). La sonde `hmr-probe.mjs` (serveur Vite en `middlewareMode`, fermé) donne `/src/main.tsx isSelfAccepting= false … importers= 0`. Toute modification de `store.ts`, ou d'un module qu'il importe, atteint donc l'entrée sans frontière, et Vite recharge la page (`propagateUpdate`, `vite/dist/node/chunks/node.js:25476`). Par ailleurs le client n'appelle `dispose` que sur le module accepté ou élagué (`vite/dist/client/client.mjs:600, 639`). `import.meta.hot?.dispose(debrancherLeJeu)` est donc du code mort, et la preuve de 3d (toucher `store.ts`, console à 0) passerait sans rien prouver. Correction : retirer la ligne et la preuve, et écrire à H-a que le rechargement de `store.ts` est complet.
- **m4.** Le contrôle de graphe de 3e ne dit pas quels arcs il suit. En arcs de valeur, la fermeture simulée après les coupes est propre (seul reste `web/minuteries`, coupé par la plateforme). En arcs de type, elle atteint `gameIso/rig/appearance.ts` (par `data/index.ts:9` et `engine/types.ts:1855`) et, par `gameIso/catalog/ambiance.ts:9`, `state/visibility.ts`, jusqu'à la vague 5. Correction : écrire « arcs de valeur », ou reporter le contrôle de type après #2884.
- **m5.** Les deux motifs de 3e divergent. L'exclusion vaut pour `**/*.hors-store.test.ts`, l'inclusion de `vitest.noyau.config.ts` pour `src/noyau/**/*.hors-store.test.ts` seulement. Un tel test posé ailleurs ne serait joué par personne, la classe que `scripts/gates/testsParGate.mjs:1-17` interdit pour les tests de `scripts/`. Exclus de `fichiersDeLaSuite`, ces fichiers sortent aussi du corpus des gardes de la suite (`vi-mock-isolate-guard`, `tests-sans-horloge-guard`), et `test:perimetre`, porte locale de chaque lot, ne les joue pas. Correction :
  - une constante unique des deux motifs, lue par la configuration du noyau ;
  - un contrôle d'orphelin ;
  - `test:noyau` dans la porte locale de 3e.
- **m6.** La liste des réexportations (§1, D2) est incomplète : `store.ts:63, 153, 156, 159` (types), `targeting.ts:20-21` (dont la valeur `spellAffinity`), `rollFlowSpecs.ts:204`, `buildings.ts:30`, `merchants/index.ts:4`. Ce dernier est un baril `index.ts` qui, déménagé, ferait un second baril dans `src/noyau` contre D9. Correction : compléter la liste par la commande `git grep -nE "^export (\*|\{|type \{)[^;]*from " -- src/state`.
- **m7.** D2 dit « aucun échafaudage transitoire », puis fait tenir l'inscription jusqu'en 3d par des imports à effet de bord ajoutés dans `store.ts`. Correction : le nommer comme l'échafaudage qu'il est, borné à 3d, et garder l'ordre d'inscription du baril.
- **m8.** Les écrans de jeu :
  - `party` n'est posé par aucune règle ni aucun flux (seulement par l'interface et lu par `netFlow.ts:165`) ;
  - `creator` n'est justifié que par l'effet de scène `combatEffects.ts:1543`, que D5 transforme en `HEROS_A_CREER` ;
  - `massBattleFlow.ts:936` pose aussi `menu`.

  Correction : justifier ces deux écrans par la coop (l'écran d'équipe partagé), et non par « les règles et les flux en posent six ».
- **m9.** `SCENE_ENTREE` : le point d'émission n'est pas dit. `transitionTo` sauvegarde AVANT `openEncounterPsych` et la carte d'entrée (`store.ts:2407-2412`), pour que le point de reprise précède la rencontre. Correction : émettre à la place de `get().autoSave()`.
- **m10.** La scission de `stateFields` crée un second manifeste pour un seul champ, `hoverDelta`, dont `resetOn` est `[]` (`stateFields.ts:49`) : la « remise sur `SCENE_ENTREE` » prêtée à l'adaptateur n'existe pas aujourd'hui. Correction : une valeur initiale dans le littéral de l'adaptateur, sans manifeste neuf.
- **m11.** La partie et l'auto-cadence. D8 pose `setCadence`, mais le tick d'auto-cadence n'est branché que par `initCombatAuto` (`combatAuto.ts:239-245`, abonnement au store). Sous une cadence « Rapide » ou « Auto-combat », une partie ne résoudrait rien seule. Correction : dire si `envoyer` appelle `tickCombatAuto` ou si la partie expose l'abonnement, par la fonction unique.
- **m12.** Des règles vivent hors de `src/state`, et ni le plan (H2) ni le design ne les recensent :
  - le saut d'exploration (élan, `planJump`, refus, `runFlow`) : `gameIso/stage/useStagePointer.ts:231-251` ;
  - l'ouverture de porte, qui écrit la scène depuis `gameIso` : `:277`, `:288`.

  Une partie hors store ne les joue pas. Correction : les nommer, avec leur ticket (credo, rien hors périmètre non dit).
- **m13.** L'en-tête de `sondes/deplacer.cjs:8` dit « hors docs/plans/ » alors que le code exclut quatre dossiers (`:93`). Correction : aligner le commentaire.

## Par critère

1. **Points du v3.**
   - B1 : corrigé pour les actions ; la coupe reste incomplète (M1, `:1124`) et le verdict par siège ne tient pas pour une partie (M6).
   - M1 : corrigé (union, `cascadeNext`, scission réalisable) ; la règle du siège reste à extraire (M6).
   - M2 : en partie (M1, M2).
   - M3 : corrigé pour les fichiers et les 235 membres de `create` ; non corrigé pour le premier niveau de `store.ts` (M3).
   - M4 : corrigé pour la source unique ; motifs et porte locale à préciser (m5).
   - m1 : corrigé.
   - m2 : réécrit, faux (M5).
   - m3 : inventaire juste ; le régime enfreint une garde et une règle (M4).
   - m4 : corrigé.
   - m5 : en partie, trois captures oubliées (M3).
   - m6 et m7 : corrigés.
   - m8 : corrigé, sonde rejouée.
   - m9 : corrigé.
   - Non vérifiés v3 : la compilation d'`etat.ts` est tranchée ici en principe (`etatclo.cjs`) ; le rechargement à chaud est tranché (m3) ; `poc/godot` reste à 3e.
2. **B1.**
   - Les sept éléments ont une action du noyau sans arc d'IMPORT vers A.
   - Il reste un arc d'ÉCRITURE de champ (`combatSlice.ts:1124`) et sept remises de `hoverDelta` à couper autrement (M1).
   - Le verdict d'armement tient en solo, en hôte et en invité web, mais pas pour un siège d'une partie (M6).
3. **Partition.**
   - Sondes rejouées à l'identique.
   - Arcs invisibles à la sonde d'import :
     - `combatEffects.ts:1543` (`setEditingHero`, `setScreen`), `transitionTo` → `autoSave` (déjà connus) ;
     - `combatSlice.ts:1124` (nouveau) ;
     - `startScene` → `useGame.getInitialState()` (nouveau) ;
     - le premier niveau de `store.ts` (M3).
   - Les 34 actions et les 25 champs d'interface existants sont justes, sondés par la sonde typée `acces-typés.cjs` et une recherche par expression régulière sur N et sur les 201 corps.
4. **D5.**
   - La frontière compile en principe : hors `store.ts`, seul `NetState` est atteint dans A, et D5 le déménage.
   - Les coupes par événements ne couvrent pas `:1124`, ni la remise à neuf de `startScene` (M1).
   - `CHAMPS_DU_SIEGE`, `ecranDuShell` et les lecteurs de `screen` sont incohérents avec `netFlow` et les sauvegardes (M2).
   - H-d est contredite par #1135 et par son test (M1) ; H-e repose sur un précédent faux (M2).
5. **D9.**
   - L'union permet de jouer l'attaque jusqu'à `cascadeNext` (`combatSlice.ts:3400`).
   - La scission de la table compile avec `TableDesClasses<S, T>`, `ActionManuscrite<S, T>`, `ClasseAdmise` (sans dépendance à `S`) et `OUVERTURE_DES_FLUX` (tous ses ouvreurs sont des actions du noyau). Aucune des 38 actions d'adaptateur n'est `invité`, donc `GUEST_INTENTS` est inchangé.
   - L'état initial manque (M1), les règles du premier niveau manquent (M3), le siège est à corriger (M6).
6. **D7, D10 et 3e.**
   - Compatibles avec la suite principale : une pose par worker, un seul appelant de `createCombatSlice`, `rollFlowWiring.test.ts:26` sans crochet.
   - Le rechargement à chaud est sans objet (m3).
   - L'exclusion passe bien par une source unique (`racinesDeLaSuite.mjs:22`, `vite.config.ts:82`, `suiteVitest.mjs:18`, `run.mjs:303`, `perimetreDerivation.mjs:96,131`).
   - Le régime de tests est à refaire (M4).
7. **D11.**
   - L'équivalence est vraie cas par cas : matrice `d11-matrice.mts`, 160 cas, sortie `cas 160 écarts holder 0 écarts mode 0 modes vus attack,placing-zone,overcast,dual,cleave`.
   - L'invariant est exprimable (`HorsModalCoveredKey`, `modalArbiter.ts:356`, à exporter ; les trois détenteurs sont aux lignes `:268, :278, :279`).
   - Les sept sites de `placingZoneOf` sont exacts.
8. **Séquencement.**
   - Les murs exemptent les tests (`oxlint.config.mjs:603`), donc 3b passe `murs/purete-imports` après les coupes de 3a.
   - Aucun pont ni aucune seconde implémentation n'est prévu ; mais `envoyer` risque d'en créer une (M6).
   - Les échafaudages non dits sont les imports à effet de bord jusqu'en 3d (m7).
   - Les reports non dits sont les règles de `gameIso` (m12).
   - 3c bute sur M1 et M3, ce que la re-mesure d'entrée ne trouverait qu'au lot.
9. **Affirmations contredites ou sans mesure :**
   - « tous coupés » (M1) ;
   - « le survol le recalcule » (M1) ;
   - « comme la fenêtre Codex, déjà par siège » (M2) ;
   - « 5 déclarations » (M3) ;
   - « les 6 verbes … qui touchent l'adaptateur » (M3) ;
   - « deux points d'injection capturent » (M3) ;
   - « restent vus par la garde de build » (M5) ;
   - « sans la recoder » (M6) ;
   - « 124 champs de jeu » (m1) ;
   - « `store.ts:890` » (m2) ;
   - le rechargement à chaud « poserait une seconde fois » (m3) ;
   - « 8 lectures … `keybindings.ts` ×1 » (M2) ;
   - « les règles et les flux en posent six » (m8) ;
   - « aucun échafaudage transitoire » (m7).

## Non vérifié

- Les comptes de D8 (34 appels de production et 295 de tests sans RNG, 71 fichiers). Trancherait : un `git grep` typé des appels sans argument `rng`.
- L'existence, pour chaque genre synthétique de l'inventaire, d'un genre réel de même forme (M4 rend la question moins centrale). Trancherait : l'inventaire par fichier qu'exige M4.
- `poc/godot` (mesure prévue en 3e).
- Le comportement de la file d'inscription si l'ordre des imports du baril `combatFlow` change (m7). Trancherait : un test qui compare l'ordre des crochets avant et après la dissolution.
- La sonde HMR n'a pas transformé tout le graphe (`App.tsx` y apparaît non auto-acceptant parce que le greffon React ne s'arme pas sans HMR). La conclusion de m3 ne dépend que de `main.tsx`, entrée sans importeur qui importe `store.ts` directement.

## Sondes (promouvables)

`snapshot-invite.mts` (lancer avec `npx tsx <chemin>` depuis `/home/user/game`) :
```ts
import { useGame } from '/home/user/game/src/state/store';
import { netSnapshot, applyNetSnapshot } from '/home/user/game/src/state/netFlow';
useGame.setState({ codexOverlay: { category: 'talents', id: 'hote' } as any, sheetId: 'hote', camRot: 3, keyOverrides: { 'cam-left': ['KeyH'] } as any, screen: 'campaign' } as any);
const snap = netSnapshot(useGame.getState);
useGame.setState({ codexOverlay: { category: 'talents', id: 'invite' } as any, sheetId: 'invite', camRot: 1, keyOverrides: { 'cam-left': ['KeyI'] } as any, localIntent: { actionId: 'courir' } } as any);
applyNetSnapshot(useGame.setState as any, snap);
const s = useGame.getState() as any;
console.log('codexOverlay', JSON.stringify(s.codexOverlay), '| sheetId', s.sheetId, '| camRot', s.camRot, '| keyOverrides', JSON.stringify(s.keyOverrides), '| localIntent', JSON.stringify(s.localIntent));
```
Sortie : voir M2.

`icon-probe.mjs` (`node <chemin>`) : copie de l'expression de `iconRefs.mjs:12` appliquée aux deux tables. Sortie : voir M5.

`d11-matrice.mts` (`npx tsx <chemin>`) : `detenteurDuCiblage` écrit selon D11, confronté à `targetingHolder` et à `currentTargetingMode` réels sur 2 × 2 × 2 × 5 × 2 × 2 = 160 états. Sortie : voir critère 7.

`acces-typés.cjs` (`node <chemin>`) : accès typés de N aux 25 champs d'interface et aux 38 actions d'adaptateur, avec la ligne. Il ne voit pas les écritures par `set({...})`, que la recherche par expression régulière (`n-touche-a.txt`) complète. Sortie (14 accès) :
```
state/combatEffects.ts:1543 setEditingHero, setScreen
state/combatFlow.ts:7292, :7484 combatCursor
state/combatSlice.ts:1063 camRot, viewMode, camEdge (curseur)
state/combatSlice.ts:1073-1114 combatCursor (curseur)
state/modalArbiter.ts:332 screen
state/stateFields.ts:49 hoverDelta
```
L'expression régulière ajoute `combatSlice.ts:1124 combatCursor` et les sept écritures de `hoverDelta`.

`etatclo.cjs` (`node <chemin>`) : fermeture de type de `Jeu` (champs et actions hors interface), sans repasser par l'interface `GameState`. Sortie :
```
gameIso/rig/appearance.ts :: Appearance <- party
gameIso/rig/appearance.ts :: RigSpeciesId <- party
gameIso/rig/bones.ts :: Slot <- party
gameIso/rig/palette.ts :: Palette <- party
gameIso/rig/parts/monstrous.ts :: MonsterParts <- party
state/netFlow.ts :: NetState <- net
```

`hmr-probe.mjs` : à NE PAS promouvoir tel quel, car le chargement de `vite.config.ts` lance `docs:build` (incident ci-dessus).
