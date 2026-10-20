# Juge du design v5, vague 3 (#2817, #2889, épique #2882)

Arbre jugé : /home/user/game, branche `wip/2817-vague-3`, HEAD `7e5d77832` (« docs(plans): vague 3, design v5 face au verdict v4 »). `origin/main` = `cf4f18bcf`. `git diff --stat cf4f18bcf HEAD -- src` : vide (0 ligne). La pièce est présente : `docs/plans/2026-10-19-vague-3-attaque/design.md` (v5, 676 lignes), `sondes/` (25 fichiers).

Sondes rejouées (lecture seule, sorties dans ce dossier) :
- `graphe.cjs` puis `coupe.cjs` sur `A.txt` : sortie identique au §1 (14 arcs, 11 fichiers, 3 dans `combatSlice`).
- `zones.cjs` : hors `store.ts`, seuls `IconId` (`combatManeuvers.ts:43`, `revealStep.ts:10`) et les 12 arcs de valeur déjà comptés.
- `champs-init.mts` : `champs init 150`, `UI absents []`, `jeu 125`, `stateFields UI ['hoverDelta']`.
- `snapshot-invite.mts`, `snapshot-probe.mts` : sorties du §1.
- `d11-matrice.mts` : `cas 160 écarts holder 0 écarts mode 0`.
- `icon-probe.mjs` : 12 et 6 valeurs, 0 vue par la garde.
- `premier-niveau.cjs src/state/store.ts` : 44 instructions (pas 48).
- La commande d'`inscriptions.tsv` : 108 lignes, 38 fichiers.
- D12 par `gh api` : `#1858 open`, ligne 26 du corps de #2763.

Sondes du juge, dans ce dossier : `invite-salon.mts`, `reexports.cjs`, `reexports-noyau.cjs`, `toplevel-refs.cjs`, `init-calls.cjs`, `lecteurs-ecran.sh`. Aucun processus ne tourne après ma fin ; aucun fichier du dépôt n'a été écrit (aucune sonde ne charge `vite.config.ts`).

## Verdict : REJETÉ (0 bloquant, 3 majeurs, 12 mineurs)

Ce qui tient, mesuré :
- `hoverDelta` est MORT. Hors test, `git grep hoverDelta` sur `src` et `scripts` ne rend que :
  - ses écrivains (`useHoverTargeting.ts:214-218`, où la lecture de `:214` sert à son propre dédoublonnage, et les sept `set` de `combatSlice`) ;
  - sa déclaration (`store.ts:698`) et son manifeste (`stateFields.ts:49`).

  Lectures indirectes cherchées :
  - `__wfrp.state()` (`devtools.ts:754-760`) ne le projette pas, et aucun script ne lit `getState().hoverDelta` ;
  - le snapshot et la save l'emportent par itération des clés, sans lecteur à l'arrivée.

  Attribution sur l'état committé : à `e4bf4d735`, les seuls sites de production restants sont ses écrivains, sa déclaration et son manifeste. Le dernier lecteur est `const hoverDelta = useGame((s) => s.hoverDelta)`, retiré par ce commit. La spec HUD (point 4, « Curseur porteur du coût », `2026-08-16-spec-hud-combat.md:656-658`) est servie par `cfa528908` sans ce champ. La suppression est fondée.
- La péremption du curseur couvre les trois écritures du noyau :
  - `combatFlow.ts:7292` (fin de cascade de fin de combat, puis `battle.over` ou `battle` nul) ;
  - `:7484` (`advanceTurn` : `battle.turn` change) ;
  - `combatSlice.ts:1124` (`preemptAiming` → `null`).

  Aucun curseur légitime n'existe avant l'armement du Tir rapide : à la pause, `turn` vaut -1, `controlsActive` est faux, et `preemptCur` exige `preemptAiming`.
- `intentionDuProprietaire` ne casse aucun chemin :
  - `actingSeat` n'est posé qu'autour d'`applyIntent` (`netFlow.ts:274`) ;
  - le verdict de l'invité se calcule chez lui hors siège agissant (`emettreIntentInvite`, `netFlow.ts:209`) ;
  - les tests de verdict de l'hôte (`geste-arme-voyage.test.ts:131-160`) tournent sans `withActingSeat`, et aucun test sous `withActingSeat` ne lit `localIntent`.
- `remettreLAdaptateur` : 16 champs remis, `camEdge` et `camPan` toujours remis, 6 gardés. Les 24 champs d'interface sont tous rangés ; c'est exactement ce que `startScene` remet aujourd'hui (`store.ts:2287-2291`), moins `keyOverrides`, ce qui corrige le défaut du §1. `transitionTo` remet `camEdge`, `camPan` et `resetStageGestes` puis sauvegarde (`:2399-2407`) : c'est la branche `neuve: false`.
- Les initialiseurs non littéraux des champs de jeu sont tous des fonctions de N : `campaignStart`, `dayIndex`, `emptyWorldMap` et `initialNet` (`init-calls.cjs`). `etatInitialDuJeu()` est réalisable au noyau.
- Les 7 émetteurs de `TIME_ADVANCED` sont exacts (`store.ts:3169`, `restFlow.ts:190, 517`, `seaVoyageFlow.ts:1585`, `travelFlow.ts:577, 826, 1452`). Les deux seuls écouteurs sont ceux de `store.ts:3295, 3300`, donc `signalerLAvanceeDHorloge` garde l'ordre.
- La table du premier niveau de `store.ts` est COMPLÈTE : ses lignes couvrent les 44 instructions.
- Les crochets de module : la liste de D7 et D10 est complète. Production : `combatSlice.ts:417-433`, `combatFlow.ts:4379`, `combatEffects.ts:782`, et `setClotureDeCascade` (`noyau/cascade.ts:166`).
- `IconId` dans `src/data` : `noyau` importe `data` (`couches.mjs:30`), `ui` aussi (`:39`, `AMONT_DE_LA_PRESENTATION`). Des `.generated.ts` vivent déjà sous `src/data` (`schemas/_registry.generated.ts`).
- D10 et le régime des tests :
  - ni `vi.mock`, ni espion, ni mutation : `avecLesTables` passe par le seam de production `brancherLeJeu`, que la partie et le store appellent ;
  - les Crampes abdominales existent (`symptoms.json:205`, déclencheur `onOwnTestFailed`) ;
  - les tests du socle (`noyau/cascade.test.ts`) pilotent le store, donc « même `get`/`set` » tient.
- `MOTIF_HORS_STORE` : un `*.hors-store.test.ts` hors de `src/noyau` reste dans `estDeLaSuiteVitest` (`racinesDeLaSuite.mjs:26`). « Aucun orphelin possible » est vrai.
- D11 rejoué : 160 cas sans écart. Les 7 sites de `placingZoneOf` sont exacts.

Ce qui casse :
- l'écran du shell par client fige l'invité dans le salon coop ;
- la liste des lecteurs de l'écran affiché oublie `__wfrp.screen` et le kit de recette, que la porte de 3c utilise ;
- la classe « par client » a encore une seconde source (`net` et le créateur), que le texte de D5 écraserait.

## MAJEUR

**M1. D5 : l'invité ne quitte plus jamais le salon coop.**
- Aujourd'hui, l'invité attend dans le salon sur l'écran `coop` (`CoopLobby.tsx:107`, ouvert par `MainMenu.tsx:31` ou `App.tsx:58`). L'hôte compose (`setScreen('party')`, `CoopLobby.tsx:131`) ou charge en session. Le snapshot porte `screen` et l'invité le suit (`netFlow.ts:166-170`).
- En v5 :
  - `coop` est un écran du shell, rangé dans `ecranDuShell` par client et hors snapshot (`design.md:385-392`) ;
  - `applyNetSnapshot` pose `repriseDeLaPartie(game)`, et « toute la moitié d'interface de l'invité rest[e] la sienne » (`:376-377`) ;
  - rien ne remet l'`ecranDuShell` de l'invité, puisque seul `setScreen` le fait, sur geste local.

  `ecranAffiche = ecranDuShell ?? screen` rend donc `coop` pour toujours.
- Sonde `invite-salon.mts` (mesure à `cf4f18bcf`, puis la règle de D5 appliquée au même fil) :
  ```
  cf4f18bcf : écran de l’invité après le snapshot = party
  D5 v5   : screen = party | ecranDuShell = coop | ecranAffiche = coop
  ```
- Aucun test ne verrouille ce suivi : `git grep screen` sur les tests de `netFlow`, `seating-coop` et `campaign-snapshot` ne trouve aucune assertion d'écran. La porte joueur de 3c ne joue pas de coop. La régression passerait la vague verte.
- Correction :
  - poser la règle d'adaptateur qui périme le shell quand l'écran de la table change, au patron de la péremption du curseur (`ecranDuShell` remis à `null` quand `screen` change entre deux états), ou sortir `coop` du shell ;
  - promouvoir la sonde en test de `netFlow` : un invité au salon suit l'hôte sur `party`, puis sur `campaign` après un chargement en session.

**M2. D5 : « `ecranAffiche`, seul lecteur de l'écran affiché, aux 12 sites » oublie trois lecteurs, et deux outils cassent.**
- Sonde `lecteurs-ecran.sh` (les lectures de `.screen` sur l'état hors test, dans `src` et `scripts`, moins les sites du §1) :
  ```
  scripts/recette/lib.mjs:775:const APP_READY = `… window.__game.getState().screen !== 'menu' || …`
  scripts/recette/lib.mjs:914:      ecran: window.__game?.getState().screen ?? null,
  src/state/devtools.ts:1030:      return g().screen;
  ```
- Conséquences :
  - `__wfrp.screen('compendium')` rendrait `menu` ;
  - `gotoScreen` (`lib.mjs:907-927`) attend `lecture.ecran === name` et lève à l'échéance pour tout écran du shell, utilisé par `shot-editor-lower-layer-gabarit.mjs:47` (`editor`) et `shot-screen.mjs:48` (`--screen gallery`) ;
  - `APP_READY` reste faux sur un écran du shell ouvert depuis le menu ;
  - la porte joueur de 3c (« le compendium ouvert et fermé ») passe par ce kit ;
  - `lib.test.mjs:192-202` et `:2561` simulent `getState().screen`.

  Même classe que le M2 v4 (lecteurs de `screen` non recensés), corrigée au site et non à la classe : le recensement ne cherchait que dans `src`.
- Correction : recenser `src` et `scripts`, faire lire `ecranAffiche` par `__wfrp.screen` et `__wfrp.state()`, faire lire au kit de recette l'écran affiché (`__wfrp.state().screen` ou un champ exposé), réécrire les deux fixtures de `lib.test.mjs`, et dire le compte.

**M3. §1 et D5 : « trois champs PAR CLIENT » est faux, et la v5 garde une seconde source de la classe.**
- `applyNetSnapshot` préserve aussi, chez l'invité :
  - `net.mode`, `net.mySeat`, `net.connection` et `net.hostAway` (`netFlow.ts:174-180`) ;
  - l'écran `creator` quand l'hôte est sur `party` (`keepCreator`, `:165, :170`), que le §1 cite pourtant.

  `NetState` (`:48-70`) mêle des champs partagés (`ownership`, `slots`, `seatNames`, `presence`, `roomCode`, `gmSeat`) et des champs par client.
- La v5 met `net` dans `EtatDeJeu`, donc dans `DonneesDeLaPartie`, et écrit que `applyNetSnapshot` pose `repriseDeLaPartie(game)`, qui étale les données de l'hôte (`design.md:329-331, 376-377`). Appliqué tel quel, l'invité reçoit `mode: 'host'` et `mySeat: 0`. Appliqué avec la fusion d'aujourd'hui, la classe a deux sources : `CHAMPS_PAR_CLIENT` et le code de `netFlow`. C'est le reproche du M2 v4 (« deux sources »), que le §5 dit corrigé.
- Correction :
  - déclarer la part par client de `net` et la règle du créateur dans la source unique, par exemple `CHAMPS_PAR_CLIENT` étendu à des chemins, ou `NetState` scindé en partagé et par client ;
  - dire ce que `repriseDeLaPartie` fait de `net` au snapshot, et à la save (où `applyLoadedSave` pose le `net` courant) ;
  - tester la parité : l'invité garde `mode`, `mySeat`, `connection` et `hostAway`.

## MINEUR

- **m1. Réexportations (m6 v4 non corrigé à la classe).**
  - La commande du §1 rend 28 lignes dans 10 fichiers, pas « 24 lignes dans 13 fichiers » (la liste du §1 est bien celle de la commande).
  - Par l'AST (`reexports.cjs`), la classe compte 38 réexportations dans 18 fichiers. La regex ne voit ni les formes multi-lignes (`sequenceCore.ts:53, :56`, `sequenceContract.ts:57`), ni l'import-puis-export : `bourseFlow.ts:20`, `fireArc.ts:16`, `possessionsFlow.ts:15`, `shipManeuver.ts:40`, `shipPostes.ts:22`, `upkeep.ts:55`, `merchants/index.ts:5`.
  - `src/noyau` porte déjà 8 réexportations (`reexports-noyau.cjs`), dont un second `index.ts` : `noyau/monde/terrain/index.ts:22`. D2 et D9 (« aucune réexportation hors `src/noyau/index.ts` », « SEUL baril ») sont faux dès aujourd'hui.
  - Correction : la liste par l'AST, et le sort de ces 18 fichiers et des 8 du noyau.
- **m2. Comptes du premier niveau.**
  - 44 instructions, pas 48 (`premier-niveau.cjs`).
  - Les 201 actions citent en valeur 11 déclarations de premier niveau, plus le type `GameState` (`toplevel-refs.cjs`) : `registerScene`, `useGame`, `sceneRegistry`, `arriveeOccupee`, `tombantsDe`, `settleFall`, `placesDe`, `seLeverDe`, `sasseoirA`, `JOUER_CAPACITE` et `applyDialogueTransition`. Le design en annonce 14, dont « 12 fonctions et constantes ».
- **m3. Tests rendus rouges, non nommés.**
  - `delayed-effect-absolute.test.ts:72-86` et `determination-conscience.test.ts:116-125` émettent `bus.emit(EVT.TIME_ADVANCED)` et attendent l'effet de l'écouteur que D7 retire.
  - `net/session.test.ts:24, 46-51` et `net/relay.test.ts:70` portent `allow`.
  - Trois tests recopient le corps d'`applyIntent` : `guest-intent-path.test.ts:57`, `hors-modal-intent-path.test.ts:74`, `surface-1050-intent-path.test.ts:68`. Une fois `appliquerLIntentionDUnSiege` extraite, ils doivent l'appeler (`.claude/rules/tests.md`, un seul helper).
- **m4. Auto-cadence (m11 v4).**
  - « La suite principale ne l'abonne pas » est contredit par `tir-rapide-combats-complets.test.ts:95` (`initCombatAuto(); setCadence('auto')`).
  - Le §1 (`:75-76`, l'abonnement « passe dans `store.ts` ») contredit D7 (« le store web l'abonne à `main.tsx` »).
  - Correction : nommer la fonction exportée et son appelant, et le sort de ce test.
- **m5. Siège agissant, champ `refus` : M6 v4 corrigé pour `localIntent` seulement.** `refuserGeste` écrit le refus d'un geste exécuté au nom d'un siège dans le `refus` par client du propriétaire (`refusVisible.ts:43`). Or `netFlow.ts:115-117` dit que ce refus appartient à l'invité, qui ne le voit jamais. C'est la même classe qu'`intentionDuProprietaire`. Correction : la règle pour toute écriture d'un champ par client sous siège agissant.
- **m6. « Le filtre … est fait deux fois » (§1 `:227-229`) est faux.** `HostSession` filtre l'allowlist (`session.ts:64`) ; `intentAllowedFor` filtre la possession (`netOwnership.ts:586-589`). Ce sont deux contrôles distincts. Le retrait d'`allow` se justifie par l'unicité du point d'entrée. Il reste à dire si une intention hors allowlist est ignorée en silence ou journalisée.
- **m7. Invité et changement de scène.** `SCENE_ENTREE` n'est émis que chez le propriétaire. Chez l'invité, la caméra, les gestes vivants, l'inspection et la fiche survivent à la scène que l'hôte quitte ; aujourd'hui `camPan` lui arrive remis par le snapshot. H-e ne le dit pas.
- **m8. `sauter` et `actionnerLaPorte` : leur classe coop n'est pas dite.** Aujourd'hui, l'invité ouvre la porte dans SA copie de la scène (`useStagePointer.ts:277, 288`), que le snapshot suivant écrase, et joue le saut localement (`:248`). C'est un poison du périmètre, à trancher avec la classe des deux actions (la totalité par le type l'exigera).
- **m9. Le régime de plugins de `vitest.noyau.config.ts` n'est pas dit.** Sans `wfrp:prose-source`, les `src/data/*.json` se chargent sous leur forme disque, contre `data/index.ts:166-171` (« la SEULE porte de chargement … sous vitest »). La même question vaut pour l'hôte externe et le metafile d'esbuild de 3e.
- **m10. D10, « construites au premier appel ».** Les tables tirables ont des clés qui sont des ids de données (`noyau/cascade.ts:255-276`, `corruptionFlow.ts:155-197`, `seaVoyageFlow.ts:1170`). L'union fermée ne peut porter que sur les FAMILLES, et chacune doit rester un accesseur vivant (`memoParVersion`, #1692). Mémoriser leur évaluation figerait une donnée éditée au Codex, dans un angle mort déclaré de `index-vivant-guard.test.ts:38-63` (« FABRIQUE INTER-MODULE », « INSTRUCTION D'APPEL DE NIVEAU MODULE »). À écrire.
- **m11. `modalArbiter.ts:313-317`, référence vivante.** Le commentaire dit l'écran `compendium` PARTAGÉ et écrasé par le snapshot ; après D5, il ment. À réécrire dans le commit de D5, avec la conséquence : `ecranPlein` ne bloque plus les gestes d'invité quand l'hôte est dans un écran du shell.
- **m12. `IconId` (M5 v4), outillage non nommé.**
  - `gen-registry.mjs:123-131` écrit l'union DANS le fichier du registre. L'écrire à part demande une option générale d'`idUnion` (cible `cibles-registres.mjs:292-299`), sans cas propre aux icônes.
  - `scripts/docs/build-icones.mjs:47-52` et `build-icones.test.mjs:12-23` lisent l'union au registre d'`ui`. D11 couvre la classe (« générateur … le suit ») ; ces trois sites sont à nommer.

## Par critère

1. **Points du v4.**
   - M1 : corrigé (péremption, `hoverDelta` mort prouvé, `etatInitialDuJeu`, liste des remises juste).
   - M2 : corrigé sur le mécanisme (`donneesDeLaPartie`), non corrigé à la classe : M1, M2 et M3 de ce verdict.
   - M3 : corrigé (inventaire complet, horloge, transition, clôtures en table) ; comptes faux (m2) et tests non nommés (m3).
   - M4 : corrigé.
   - M5 : corrigé sur le fond ; l'outillage est à nommer (m12).
   - M6 : corrigé pour `localIntent` ; reste `refus` (m5).
   - m1, m2, m3, m4, m5, m7, m8, m9, m13 : corrigés. L'en-tête de `deplacer.cjs` est à sa ligne 9, pas 8.
   - m6 : non corrigé (m1).
   - m10 : sans objet, accepté.
   - m11 : corrigé sur le fond, affirmation contredite (m4).
   - m12 : corrigé, classe coop non dite (m8).
2. **Affirmations du §1.**
   - Vraies : `hoverDelta` mort ; 150, 25 et 125 champs ; 14 arcs ; 7 émetteurs ; 34 actions d'adaptateur et 201 de noyau ; D12.
   - Fausses : 12 lecteurs de l'écran affiché (M2) ; trois champs par client (M3) ; 24 réexportations (m1) ; 48 instructions et 14 déclarations (m2) ; filtre fait deux fois (m6) ; « la suite principale ne l'abonne pas » (m4).
3. **Mécanismes neufs.**
   - Tiennent : la péremption, `intentionDuProprietaire`, `remettreLAdaptateur` (chez le propriétaire), `signalerLAvanceeDHorloge`, `transitionDuJeu` (réentrance structurelle gardée : l'écriture de libération porte une occupation neuve), `IconId`, `avecLesTables` (aucune API de mutation ne survit en 3d, donc l'isolement entre fichiers tient par construction), `MOTIF_HORS_STORE`.
   - Incomplets : `donneesDeLaPartie` et `repriseDeLaPartie` pour `net` et l'écran (M1, M3) ; `appliquerLIntentionDUnSiege` pour les tests (m3) et `refus` (m5) ; `planifierLeTickAuto` (m4).
4. **Séquencement.**
   - 3a → 3b tient : après 3a, `zones.cjs` ne laisse que des arcs de type vers `store.ts`, couverts par l'arête transitoire `noyau → state` (`couches.mjs:30`).
   - 3c bute sur M1, M2 et M3. Sa preuve ne voit pas M1 (pas de coop dans la porte joueur) et échoue sur M2 (le kit de recette).
   - Aucun pont ni aucune seconde implémentation n'est prévu ; l'échafaudage de D2 est nommé et borné.
5. **Credo et règle 3.** Pas de garde de synchronisation ; le noyau dépend du moteur seul. La source unique est rompue pour la classe par client (M3). Le poison du périmètre reste non traité : `refus` (m5), la porte et le saut de l'invité (m8), le commentaire vivant (m11).
6. **Affirmations contredites ou sans mesure :**
   - les 12 lecteurs (M2) ;
   - les trois champs par client (M3) ;
   - les 24 lignes dans 13 fichiers (m1) ;
   - le « SEUL baril » (m1) ;
   - les 48 instructions (m2) ;
   - les 14 déclarations (m2) ;
   - le filtre fait deux fois (m6) ;
   - « la suite principale ne l'abonne pas » (m4) ;
   - « aucune réexportation hors `index.ts` » (m1).

## Non vérifié

- Les comptes de D8, renvoyés à 3h. Pour information : `git grep -nE "=\s*defaultRNG" -- src ':!*.test.*'` rend 131 sites dans 48 fichiers à `cf4f18bcf`.
- `poc/godot` (mesure prévue en 3e).
- L'ordre d'inscription après la dissolution du baril. Trancherait : la sonde de 3b. L'ordre d'évaluation dépend de tout le graphe, pas seulement de l'ordre des imports de `store.ts`.
- La perte ergonomique de la péremption sur un changement de tireur armé (`preemptAiming` A → B efface le curseur ; aujourd'hui il reste). Elle n'est pas prouvée nuisible, donc ce n'est pas un défaut.
- L'effet du chargement des JSON sous forme disque dans la suite hors store (m9). Trancherait : `partie.hors-store.test.ts` joué sous les deux régimes.

## Sondes (promouvables)

`invite-salon.mts` (`npx tsx <chemin>` depuis `/home/user/game`) :
```ts
import { useGame } from '/home/user/game/src/state/store';
import { netSnapshot, applyNetSnapshot } from '/home/user/game/src/state/netFlow';
useGame.getState().setScreen('party');                 // l'hôte compose depuis le salon
const snap = netSnapshot(useGame.getState);
useGame.getState().setScreen('coop');                  // l'invité attend au salon
applyNetSnapshot(useGame.setState as any, snap);
console.log('cf4f18bcf : écran de l’invité après le snapshot =', useGame.getState().screen);
const SHELL = new Set(['editor', 'test', 'coop', 'compendium', 'gallery', 'webglSpike']);
let invite = { screen: 'menu', ecranDuShell: null as string | null };
const setScreen = (v: string) => { invite = SHELL.has(v) ? { ...invite, ecranDuShell: v } : { screen: v, ecranDuShell: null }; };
setScreen('coop');
invite = { ...invite, screen: (snap as any).game?.screen ?? (snap as any).screen };   // repriseDeLaPartie
console.log('D5 v5   : screen =', invite.screen, '| ecranDuShell =', invite.ecranDuShell, '| ecranAffiche =', invite.ecranDuShell ?? invite.screen);
```
Sortie : voir M1. À promouvoir en test de `netFlow` après 3c : l'invité au salon suit l'hôte.

`lecteurs-ecran.sh` (`sh <chemin>`) : les lectures de `.screen` sur l'état hors test dans `src` et `scripts`, moins les sites du §1. Sortie : voir M2.

`reexports.cjs` (`node <chemin>`) : les réexportations de `src/state` par l'AST (`export … from`, et `export { x }` d'un nom importé). Sortie : `TOTAL 38 fichiers 18`. `reexports-noyau.cjs` fait de même sur `src/noyau` : `TOTAL 8 fichiers 7`.

`toplevel-refs.cjs` (`node <chemin>`) : les identifiants de premier niveau de `store.ts` cités par les 201 actions de noyau et par les 34 d'adaptateur. Sortie : voir m2.

`init-calls.cjs` (`node <chemin>`) : les initialiseurs non littéraux du littéral de `create`. Sortie : `campaignStart`, `dayIndex`, `emptyWorldMap`, `loadKeyOverrides` (adaptateur) et `initialNet`.
