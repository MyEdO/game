# Juge du design v7, vague 3 (#2817, #2889, épique #2882)

Arbre jugé : /home/user/game, branche `wip/2817-vague-3`, HEAD `63b132599` (« docs(plans): vague 3, design v7, le voyage coop sort de la vague (#2817) »). `origin/main` = `cf4f18bcf`. `git diff --stat cf4f18bcf HEAD -- src` : vide. Pièce présente : `docs/plans/2026-10-19-vague-3-attaque/design.md` (v7, 727 lignes). Toutes les lectures de code sont faites à `cf4f18bcf` (`git show`, `git grep cf4f18bcf`). `git status` propre avant et après ; aucun fichier du dépôt écrit ; aucun processus ne tourne après ma fin.

Sondes du dossier rejouées : `champs-init.mts` (`champs init 150 dont stateFields 78`, `UI absents []`, `jeu 125`, `stateFields UI ['hoverDelta']`) ; `graphe.cjs` + `coupe.cjs` sur `A.txt` (14 arcs, 6 cibles, identiques au §1) ; `init-calls.cjs` ; `reexports-src.cjs` (`TOTAL src 151`, data 11, engine 16, gameIso 66, noyau 8, scenes 1, state 38, ui 11). Sondes du juge, dans `juge-v7/` : `ui-grep.cjs`, `coupe-types.cjs`, `classes-adapt.mts`, `remise-entree.mts`, `touche-chargement.mts`, `crampes-dr0.mts`, `slice-champs.mts`, avec leurs sorties `.out`. Aucune ne charge `vite.config.ts`.

## Verdict : ACCEPTÉ AVEC CORRECTIONS (0 bloquant, 0 majeur, 12 mineurs)

Ce qui tient, mesuré :

- **Le recadrage est sain.** Les quatre majeurs du v6 naissaient du découpage de ce qui voyage. Les trois tickets renvoyés existent, ouverts, avec invariant et DoD au harnais deux sièges (`gh api`) :
  - #1987 (état d'écran dans le snapshot, saves comprises, « le reste des champs d'écran de `store.ts` » à instruire) ;
  - #1502 (refus au siège demandeur) ;
  - #2895, qui nomme `sauter` et `actionnerLaPorte` (« Prérequis partagé avec #2817 »).

  Chez l'invité, rien ne bouge sur le chemin du snapshot :
  - `applyNetSnapshot` (`netFlow.ts:159-183`), `netSnapshot` (`:97-122`), `applyLoadedSave` (`store.ts:93-114`, `net` courant posé `:109`) et `netLeave` (`netFlow.ts:429`, `set({ net: initialNet() })`) gardent leur corps. `net` reste entier dans `EtatDeJeu`.
  - Le salon, le chargement en session, la sortie et le refus suivent donc la conduite d'aujourd'hui.
  - `sauter` et `actionnerLaPorte` restent hors de `GUEST_INTENTS` (classe `interne`), et jouent chez le client qui les émet, comme aujourd'hui (`useStagePointer.ts:231-251, 277, 288`).
  - L'ordre des clés du snapshot et de la save change avec la composition de l'état initial, mais rien ne le lit : `snapshotSave` boucle sur `Object.keys(initial)` (`saves.ts:87`), le chargement et le snapshot étalent (`stateFields.ts:10`, « indépendant de l'ordre »).
- **Le compte des champs** : 150 à l'état initial ; 125 de jeu ; 25 d'interface ; 24 d'interface après la vague (`hoverDelta` retiré). `combatSlice` et `buildRollFlowActions` n'apportent aucun champ (`slice-champs.mts`). Aucun champ n'est hors JSON ni `undefined` à l'init.
- **`remettreLAdaptateur` est exact**. Sonde `remise-entree.mts`, sur le comportement d'aujourd'hui (25 champs salis, puis entrée) :
  ```
  startScene : aujourd'hui 20 remis | D5 19 | en moins dans D5 ["keyOverrides"] | en trop dans D5 []
  transitionTo : aujourd'hui 2 remis | D5 2 | en moins dans D5 [] | en trop dans D5 []
  ```
  - Le seul écart est `keyOverrides`, voulu (correction du défaut du §1).
  - Aucune régression, aucune remise en trop. `resetStageGestes()` est remis dans les deux cas, comme `store.ts:2305` et `:2402`.
- **Le placement de `SCENE_ENTREE`.** Il remplace l'unique appel d'`autoSave` (`store.ts:2407`, seul site hors test de tout `src`) : après `advanceTime` (`:2405`) et `SCENE_DIRTY` (`:2406`), avant `openEncounterPsych` (`:2408`).
  - L'écouteur remet la caméra AVANT de sauvegarder. La save d'entrée porte donc `camEdge: false` et `camPan: {0,0}`, comme aujourd'hui où la remise est dans le `set` de `:2382-2401`.
  - Entre l'ancien et le nouveau point de remise, rien ne lit la caméra ni les gestes :
    - `TIME_ADVANCED` n'a que les deux écouteurs du store (`store.ts:3295, 3300`) ;
    - `SCENE_DIRTY` n'a aucun écouteur dans `src` (`git grep`, hors `emit`) ;
    - un module du noyau ne peut lire aucun champ d'interface.
- **L'exclusion de l'invité** : `autoSave` rend `false` sur `s.battle || s.net.mode === 'guest'` (`store.ts:2222`). Elle couvre la transition jouée dans la copie de l'invité.
- **La fermeture du type, re-mesurée par une autre méthode** (`ui-grep.cjs` : regex sur mots, 156 fichiers de N et de `src/noyau`, champs ET 38 actions d'adaptateur). Elle retrouve exactement la liste du §1 : `combatEffects.ts:1543`, `combatFlow.ts:7292, 7484`, `combatSlice.ts:110, 964, 995, 1005, 1029, 1063-1124, 1322, 1328, 1371`, `exploreNav.ts:7`, `stateFields.ts:49`.
  - Dans `store.ts`, seuls les 34 actions d'adaptateur, `startScene`, `transitionTo` et `stepPartyDir` (`:2569`, adaptateur) touchent l'interface. Le premier niveau (hors `GameState`) n'en touche aucun.
  - Arcs de TYPE de N vers A (`coupe-types.cjs`) : `GameState` (34 fichiers) et les `Pending*` de `store.ts`. Ce sont pour la plupart des réexportations de `noyau/pendings`, que 3b supprime. S'y ajoute `ScreenDir` (`combatCursor`, 2 fichiers, que D4/D6 coupent).
  - Le `GameState` n'importe d'A que `CombatCursor`, `CodexFocus` (interface), `NetState` (qui descend) et les types de save (actions d'adaptateur).
- **Les 38 actions d'adaptateur** existent toutes au store. Aucune n'est dans `GUEST_INTENTS`. Leurs classes sont `local`, `hôte` ou `interne` (`classes-adapt.mts`). Les 440 entrées de `GUEST_INTENTS` sont toutes des actions du store, donc du noyau.
- **`screen` typé `Ecran`** est cohérent :
  - écrivains de N : `interludeFlow.ts:220, 1440, 1462`, `massBattleFlow.ts:305, 308, 831, 865, 936`, `store.ts:2853` ;
  - lecteur de N : `modalArbiter.ts:332` ;
  - écrivains et lecteurs d'A et d'`ui` typés par la même union ; `compendiumReturn` (A) l'importe en type.
- **m8** : traité. `vitestSansEcriture.mjs` ne joue que pour `scripts/` (`:17`), si bien qu'un `setupFiles` réduit à `./data/overrides` perd seulement ce qui ne concerne pas `src/noyau`. `GELER_LA_DONNEE` vaut `import.meta.env.DEV` (`lib/gelerProfond.ts:6`), vrai sous vitest.
- **m9** : traité. 151 = 46 (`state` 38, `noyau` 8) + 105 en stock (11 + 16 + 66 + 1 + 11), conforme au §1. Le stock est admis par le credo (« Un smell mesuré par une garde vit dans le stock de la garde »).
- **D7 (horloge)** : sept émetteurs exacts (`store.ts:3169`, `restFlow.ts:190, 517`, `seaVoyageFlow.ts:1585`, `travelFlow.ts:577, 826, 1452`) ; deux tests exacts.
- **Appelants d'`initCombatAuto`** : deux, exacts (`main.tsx:42`, `tir-rapide-combats-complets.test.ts:95`).
- **`HostSession`** : seul `netFlow.ts:256` la construit hors test.
- **Le mur et les tests** : `murs/purete-imports` exclut les tests (`lint-parite.test.mjs:181, 183`). Les tests de N qui suivent leur module sous `src/noyau` et importent le store ne rougissent donc pas le mur en 3b.

## MINEUR

**m1. La correction de `keyOverrides` laisse la classe ouverte, sans la renvoyer** (principe 4 de l'en-tête).
- D5 (`design.md:226`, `:415`) corrige le seul `startScene`.
- Le même défaut, une préférence clavier écrasée par l'état de partie, tient à deux autres endroits :
  - au chargement, `applyLoadedSave` part de `getInitialState()` (valeur de CRÉATION) puis de `save.data.keyOverrides` (`store.ts:94-109`) ;
  - chez l'invité, `applyNetSnapshot` fait de même avec les touches de l'hôte (`netFlow.ts:160-166`).

  Sonde `touche-chargement.mts` :
  ```
  save porte keyOverrides : {"cam-left":"KeyA"}
  après importGame (chargement) : cam-left = KeyA | reliée = KeyZ
  invité après snapshot : cam-left = KeyH | reliée par l invité = KeyG
  ```
  « Continuer » (charger l'emplacement automatique) relance donc la partie sur les touches d'avant, et l'invité ne peut relier aucune touche.
- Correction :
  - au chargement, dans le périmètre et sans toucher le format : `applyLoadedSave` garde la valeur courante de `keyOverrides`, comme il garde `net` (`:109`), avec un test ;
  - chez l'invité : renvoi explicite à #1987, `keyOverrides` ajouté à ses candidats par siège.

**m2. H-e et l'en-tête affirment plus que la vague ne tient, et la preuve citée ne prouve pas.**
- L'en-tête et H-e disent que « la vague déplace le code sans changer ce qu'un client voit d'un autre, ce que prouvent les tests de clés de 3c » (`design.md:25`, `:701-704`). Or la vague change, volontairement :
  - en 3a, la clé `hoverDelta` quitte le snapshot et la save : elle n'est pas dans `HORS_SAVE` (`saves.ts:60-71`) ;
  - la valeur de `keyOverrides` après `startScene`, qui voyage ;
  - D4 : chez l'hôte, un clic d'invité ne dissout plus l'intention armée de l'hôte. Aujourd'hui, `consumeIntent()` (`combatSlice.ts:524-528`) s'exécute sur tout clic exécuté au nom d'un siège, puis `armedTile` pose `confirm: true` sur ce clic (`:941-942`) ;
  - la péremption du curseur change le `combatCursor` de l'hôte, qui voyage ;
  - `etatInitialDuJeu()` recalcule `campaignStart()` (`memoParVersion` sur les calendriers, `engine/clock.ts:109`), là où `startScene` repart aujourd'hui de la valeur figée à la création (`store.ts:2290`).
- Un test de CLÉS ne voit aucune de ces valeurs. Figé en liste de 149 clés, il devient en plus une garde de synchronisation à tenir à chaque champ neuf (credo).
- Correction :
  - H-e et l'en-tête énumèrent ces changements délibérés ;
  - le test de clés devient une sonde jouée au rendu de 3c (clés du snapshot et de la save, base contre tête), ou une assertion structurelle sans liste figée.

**m3. D10 : le test promis sur les Crampes abdominales n'a rien à observer.**
- D10 réécrit le `describe` « SEAM `onOwnTestFailed` » (`echec-sans-jet-appliers.test.ts:239-268`) sur un héros atteint des Crampes, et « asserte l'effet que leur échec pose ».
- Or ces tests portent un échec SANS JET, dont le DR vaut 0 (`:248`, `:260` : `{ id: 'h', sl: 0 }`). Les trois effets des Crampes sont gardés à `slThreshold <= -2`, `-4` et `-6` (`symptoms.json:217-290`), et ce sont les SEULES sources `onOwnTestFailed` de toute la donnée (`git grep`, 3 sites, tous dans `symptoms.json`).

  Sonde `crampes-dr0.mts` :
  ```
  DR 0 : lignes 0 | États []
  DR -1 : lignes 0 | États []
  DR -2 : lignes 1 | États ["sonne"]
  DR -4 : lignes 2 | États ["sonne"]
  DR -6 : lignes 3 | États ["sonne","inconscient"]
  ```
  À DR 0, le test serait vert, que l'événement parte ou non.
- Correction : une fixture observable posée par un seam de production. Par exemple, un symptôme de fixture à effet `onOwnTestFailed` sans seuil, posé par `setDataset('symptoms', …)` puis restauré (le seam que D10 nomme déjà pour les tables tirables), ou un porteur de fixture dont l'effet ne dépend pas du DR.

**m4. m10 v6 n'est pas traité sur le bon module.**
- D6 (`design.md:447`) : le test « passe désormais sa cible en argument à `gen-registry` ». Or `build-icones.test.mjs:3-23` n'appelle pas `gen-registry` : il mute l'entrée `ICON_FAMILIES` de `REGISTRIES` puis appelle `rendre()` de `scripts/docs/build-icones.mjs`, qui relit cette entrée (`:140-145`).
- `rendre()` est en plus le contrat sans argument de `GENERATORS` (`build-icones.mjs:421-422`, `build-all.mjs:224`).
- Correction : `rendre(entree = REGISTRIES.find(…))` dans `build-icones.mjs`, avec le défaut qui garde le contrat de `GENERATORS`, et le test qui passe une entrée de fixture.

**m5. Le tableau du §5 ne répond pas aux points du verdict v6.**
- Il ne suit pas `verdict-du-juge-v6.md:149-182` :
  - m1 v6 est « 90 lecteurs », pas « compte des champs » ;
  - m7 v6 est « la preuve de 3c pour `ecrireLeClient` », pas « écran du créateur » ;
  - m11 v6 est « Nom `entreeEnScene` », pas « commentaire de l'arbitre ».
- Les trois sont sans objet sur le fond, sauf m11 : l'événement neuf `EVT.SCENE_ENTREE` reconduit la collision de nom que m11 relevait. Le module `state/entreeEnScene.ts` (« ENTRÉE EN SCÈNE », rendez-vous du voile de rendu, `:1-12`) existe dans la même couche, pour un autre concept.
- Correction : le §5 réaligné sur le verdict v6, et un autre nom pour l'événement (par exemple `ARRIVEE_EN_SCENE`).

**m6. D7 fait passer l'invariant de #668 de la structure à la convention, sans garde.**
- Aujourd'hui, tout chemin qui émet `EVT.TIME_ADVANCED` tire les échéances : l'écouteur est la couture.
- Après D7, l'événement reste public mais n'a plus d'écouteur de règle. Une émission directe (le patron des sept sites d'aujourd'hui) compilerait et sauterait les échéances en silence.
- Le test réécrit sur la primitive (`delayed-effect-absolute.test.ts:72-86`, « un chemin de temps NON-advanceTime ») ne prouve plus que les chemins de repos, de voyage et de mer l'appellent.
- Les commentaires qui décrivent l'abonné deviennent faux : `noyau/pendings.ts:1670`, `upkeep.ts:22, 59, 101, 106`.
- Correction :
  - une garde (un seul site `emit(EVT.TIME_ADVANCED`, celui de la primitive), ou l'émission rendue interne à la primitive ;
  - un test par chemin réel (repos, voyage, mer) ;
  - les commentaires réécrits dans le même lot.

**m7. D9 déplace au noyau un libellé de moteur montré au joueur.**
- `appliquerLIntentionDUnSiege` reprend, hors possession, `get().log(t('coop.intentRefused', { action }))` (`netFlow.ts:263`). Le texte vaut « Action réseau refusée ({action}) : pas le propriétaire. » (`fr.ts:2315`), soit l'id brut de l'action (`battleClickEntity`) au journal, affiché hors combat (grille 4).
- La fonction est réécrite dans le lot : le poison est dans le périmètre.
- Correction : un libellé joueur (nom du geste ou du combattant), sans id ; ou un renvoi nommé à #1502.

**m8. #2895 ne couvre pas la porte en combat, que `actionnerLaPorte` porte.**
- `actionnerLaPorte` reprend aussi la branche de COMBAT (`useStagePointer.ts:274-281`), qui chez l'invité se joue de même dans sa seule copie.
- Le titre, l'invariant et la DoD de #2895 disent « en exploration ». D5 renvoie « le sort des gestes d'exploration de l'invité » à #2895.
- Correction : étendre #2895 (commentaire daté) à la porte en combat, ou ouvrir son ticket, et le citer en D5.

**m9. Inventaire de purge incomplet** (grille 2).
- `hoverDelta` est aussi écrit par la fixture `ui/determination-reachability.test.tsx:49`, que D5 ne nomme pas. `git grep` à `cf4f18bcf` : 22 occurrences dans 4 fichiers de test.
- `allow` est aussi passé par `net/session.test.ts:142`, absent de D9 (`:24, 46-51` seulement).
- Le contrat « hors allowlist, ignoré » (`session.test.ts:46-51`) doit être REJOUÉ sur `appliquerLIntentionDUnSiege` : aucun effet, aucune ligne de journal. Le rendre seulement « sans `allow` » le perdrait.
- Correction : les nommer en 3a et en 3e.

**m10. Point d'émission de `SCENE_ENTREE` dans `startScene` imprécis.**
- « Après sa remise à neuf » (`design.md:404`) ne situe pas l'émission par rapport à `seedStartingPossessions`, `SCENE_DIRTY`, `openEncounterPsych` et `pushReveal` (`store.ts:2311-2318`, `pushReveal` à `:2318`).
- C'est sans effet pour le web, puisque le noyau ne peut toucher l'interface. Mais l'ordre des événements que rend la partie en dépend.
- Correction : « à la place de `resetStageGestes()` (`store.ts:2305`), juste après le `set` de remise ».

**m11. `Ecran` au noyau porte des ids d'écran de client et d'outillage** (`editor`, `gallery`, `webglSpike`, `compendium`, `coop`, `test`), contre le deuxième principe de l'en-tête (« le TYPE du noyau ne connaît pas la moitié d'adaptateur »).
- C'est la conséquence du recadrage, `screen` mêlant phase de jeu et vue de client. D5 ne le dit pas et ne cite pas #1987.
- Correction : une phrase en D5, avec le renvoi à #1987.

**m12. Rédaction.**
- `design.md:662` porte un fragment dupliqué (« (`isolate: true`). Un fichier    `isolate: true`). Un fichier »).
- D6 (`:427-428`) : « ses événement neuf (`HEROS_A_CREER`) », alors qu'il y en a deux (`SCENE_ENTREE` aussi).
- Le stock de 105 réexportations ne nomme pas le ticket qui le vide.

## Par critère

1. **Recadrage.** Sain. Aucune décision ne change le corps du snapshot ni de la save. Les changements délibérés de valeur (m2) et la classe des touches (m1) sont à dire ou à corriger. Les cas `sauter`, la porte, le salon, le chargement, `netLeave`, l'entrée en scène et le refus gardent la conduite d'aujourd'hui (porte en combat : m8).
2. **D5.**
   - Comptes exacts.
   - Liste de `remettreLAdaptateur` exacte (`remise-entree.mts`).
   - Placement exact pour `transitionTo`, imprécis pour `startScene` (m10).
   - Exclusion de l'invité exacte.
3. **Type.**
   - Fermé sur N : mesure par deux méthodes, toutes deux conformes au §1.
   - `screen`/`Ecran` cohérent avec ses lecteurs et ses écrivains (réserve m11).
4. **Principes.**
   - Règle chez le propriétaire : tenu (D4, D7, D9, D10).
   - Seam de production : tenu, sauf la fixture des Crampes (m3).
   - Défaut corrigé ou renvoyé : non tenu pour les touches (m1), le libellé de refus (m7) et la porte en combat (m8).
5. **§5.**
   - m8 : traité.
   - m9 : traité.
   - m10 : traité sur le mauvais module (m4).
   - Libellés du tableau faux, et collision de nom reconduite (m5).
6. **Lots.**
   - L'ordre 3a, 3b, 3c, 3d, 3h, 3e reste réalisable. Chaque tête reste verte au regard du mur, qui exclut les tests.
   - Les tests promis sont écrits depuis le comportement réel (le test du siège sans verdict de 3a rougit à la base, puis passe), sauf les Crampes (m3) et le test de clés (m2).
7. **Poison.**
   - Garde de synchronisation : le test de clés figé (m2).
   - Classe corrigée à un seul site : les touches (m1).
   - Invariant passé de la structure à la convention, et commentaires périmés : l'horloge (m6).
   - Moteur-speak à l'écran : m7.

## Non vérifié

- La lecture de `vitest.noyau.config.ts` par les gardes de corpus (`tests-sans-horloge-guard`, `vi-mock-isolate-guard`) et les tranches de `suiteVitest.mjs`. Trancherait : la garde jouée sur la tête de 3e, avec un `*.hors-store.test.ts` de fixture.
- Le sort de `derived-conditions.test.ts:268-279`, qui échange `setConditionGainedHook` du moteur, une fois que `brancherLeJeu` pose ce crochet et lève sur une seconde pose. Trancherait : préciser si la levée lit le crochet du moteur ou un drapeau du noyau.

## Sondes (promouvables)

`touche-chargement.mts` (`npx tsx <chemin>` depuis `/home/user/game`) : m1. À promouvoir en test de `store` : une touche reliée après une save survit à `importGame`.
```ts
import { useGame } from '/home/user/game/src/state/store';
import { snapshotSave } from '/home/user/game/src/state/saves';
import { applyNetSnapshot, netSnapshot } from '/home/user/game/src/state/netFlow';
const g = useGame.getState;
g().setKeyBinding('cam-left', 'KeyA');
const save = snapshotSave(g() as never, useGame.getInitialState() as never, 'x');
console.log('save porte keyOverrides :', JSON.stringify((save.data as any).keyOverrides));
g().setKeyBinding('cam-left', 'KeyZ');
g().importGame(JSON.stringify(save));
console.log('après importGame (chargement) : cam-left =', g().keyOverrides['cam-left'], '| reliée =', 'KeyZ');
g().setKeyBinding('cam-left', 'KeyG');
const hote = { ...netSnapshot(g as never) } as Record<string, unknown>;
const hg = (hote as any).game ?? hote; (hg as any).keyOverrides = { 'cam-left': 'KeyH' };
applyNetSnapshot(useGame.setState as never, hote);
console.log('invité après snapshot : cam-left =', g().keyOverrides['cam-left'], '| reliée par l invité = KeyG');
```
Sortie : voir m1.

`crampes-dr0.mts` : m3. Héros de fixture (celui d'`echec-sans-jet-appliers.test.ts:32-38`) porteur de `colique` / `crampes-abdominales`, puis `fireOwnTestFailed(useGame.getState, 'h', { sl, rng: makeRNG(7) })` pour `sl` ∈ {0, −1, −2, −4, −6}, lignes rendues et États lus. Sortie : voir m3.

`remise-entree.mts` : ce qui tient (D5). À promouvoir pour le test de remise d'entrée de 3c, sur la base : 25 champs d'interface salis, `startScene` puis `transitionTo`, champs remis comparés à la liste de D5. Sortie : voir « Ce qui tient ».

`ui-grep.cjs` (`node <chemin>`) : re-mesure par regex, à `cf4f18bcf`, des accès de N (fichiers de `state` hors `A.txt`, et `src/noyau`) aux 25 champs et aux 38 actions d'adaptateur. Sortie : `ui-grep.out`, 27 lignes, conformes au §1.

`coupe-types.cjs` : arcs de TYPE de N vers A (`GRAPHE=<graphe.json> node coupe-types.cjs "$(cat sondes/A.txt)"`). Sortie : `coupe-types.out`.

`classes-adapt.mts` : classes coop des 38 actions d'adaptateur, et appartenance de `GUEST_INTENTS` au store. Sortie :
```
adapt dans GUEST_INTENTS []
actions du store 645 CLASSE 388 GUEST 440
GUEST hors actions du store 0
champs init 150
```
