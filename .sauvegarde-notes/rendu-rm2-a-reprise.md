# Rendu : R-M2 lot A reconstruit, la couche d'infobulle (#1806), 2026-09-28

Départ `date -u` = 09:08:13 UTC ; fin des mesures 10:13:55 UTC (horloge de l'outil). Arbre `/home/user/game`, branche `chantier/1806`.
Sondes et sorties : `scratchpad/rm2-a/`.

**HEAD a bougé pendant le lot** (écart au brief, « aucune autre session ») : `c160fc3c3` → `d3b9fdf6f` (`46bac485e`, `d3b9fdf6f`, « fix(portes) »), et `scripts/guards/lib/gitPorte.mjs` + `gitPorte.test.mjs` sont apparus modifiés à 09:12 puis ont été committés par cette autre session. `git diff --stat c160fc3c3 HEAD` : `gitPorte*.mjs`, `scripts/ops/etapesDuTrain.mjs`, `publier*.mjs` ; aucun recouvrement avec mes fichiers. Mon travail = `git diff` contre `d3b9fdf6f` + les fichiers neufs ci-dessous.

## Diff

`git diff --stat` (`rm2-a/diff-stat.txt`) : 39 fichiers, +521 −757.
```
 docs/charte-ui.md                         16   docs/primitives.md (GÉNÉRÉ)           9
 scripts/guards/lib/cssCouchesStock.mjs    37 − (GÉNÉRÉ, régénérateur ; 0 ligne ajoutée)
 src/data/primitives.manifest.json         38   src/data/schemas/_ids.generated.ts (GÉNÉRÉ) 2
 src/state/keybindings.ts 25 · keybindings.test.ts 18 · push-keyboard-commit.test.ts 20 · resoudreEchap.ts 11
 src/ui/App.tsx 11 · CombatConsole.tsx 14 · CombatConsole.test.tsx 20 · DeterminationButton.tsx 2
 src/ui/PanneauParametre.tsx 40 · editor/AddMenu.tsx 99 · editor/AddMenu.test.tsx 59
 src/ui/compendium/CodexRef.tsx 367 · CodexRef.hooks.test.tsx 47 · CodexRef.test.tsx 40
 src/ui/focus.ts 47 · useGameKeyboard.ts 36 · wrap-keyboard-vs-cursor.test.tsx 61 · gallery/registry.tsx 58
 src/ui/styles.css 5 · styles/compendium.css 123 − · components.css 2 · editor.css 4 · panneau-parametre.css 9
 sélecteurs `.codex-pop` → `.infobulle` et kind `popover-codex` → `infobulle` (tests) : stageWalk, DeterminationButton,
 ResilienceButton, RollLine-codex-chips, RollLine-etat-chips, cadre-focus-initial, determination-reachability,
 dialogue-couche-du-dessus, dialogue-du-dessus, echap-pile-lifo, useAttackJetProps.conformance
```
Fichiers neufs : `src/ui/Infobulle.tsx`, `src/ui/Infobulle.test.tsx`, `src/ui/BoiteAncree.tsx`, `src/ui/BoiteAncree.test.tsx`, `src/ui/App.surcouche-codex.test.tsx`, `src/ui/styles/infobulle.css`, `src/ui/styles/boite-ancree.css`, `src/ui/styles/codex-ref.css`.

## Point 1 : grounding (fait)
Sorties : `rm2-a/grounding.txt`, `rm2-a/importeurs-modal-focus.txt`, lectures intégrales de `CodexRef.tsx`, `focus.ts`, `Modal.tsx`.
- Déjà sur `main` : `useFocusEmprunte` dans `src/ui/focus.ts` (lot B `ce0880e57`), seule couture d'emprunt, appelée par `Modal.tsx:103`, `RollShell.tsx:388`, `CodexRef` (`useFocusEmprunte(popRef, pinned && wrap, porteDeLaBulle)`). `focusSansIntention` déjà là. `Modal.tsx` n'a QU'UN mécanisme de retour (l'emprunt) plus le repli « le dialogue qui devient le dessus reprend un focus sur body » (`Modal.tsx:127-148`) : la pile `invocateurs` de `ebf498d7d` n'est pas sur `main`, le conflit I1 (deux mécanismes) n'existe donc plus à la lettre. Ce qui restait d'I1 : la lacune Q2DIAL (`bFerme = body`), traitée au point 2.
- Absent de `main` : la frontière `Suspense` propre de la surcouche du Codex (D7 du verdict A2) : `CodexOverlay` partageait la frontière de l'écran (`App.tsx:76-99` à `c160fc3c3`). Faite.
- Consommateurs de `suppressPopover` : `CombatConsole.tsx:236,1255,1326`, `DeterminationButton.tsx:25`. `CodexRef` n'avait AUCUNE entrée au manifeste des primitives.

## Point 2 : la couche `Infobulle` (fait)
`src/ui/Infobulle.tsx` (`useInfobulle`), feuille `src/ui/styles/infobulle.css` ; `CodexRef` n'en garde que le contenu (`CodexRef.tsx` −367 lignes nettes).
- Quatre booléens du contenu, aucune branche par consommateur : `atteignable`, `epinglable`, `sourdine`, `auToucher` (`Infobulle.tsx`, `OptionsInfobulle`).
- Ancrage déclaré au balisage : `bulle.ancrage` = `{ 'data-infobulle': id, 'aria-describedby' (ouverte), 'aria-keyshortcuts' (épinglable, hors sourdine) }` (`Infobulle.tsx:205`), étalé par `CodexRef` sur sa `span`. Délégation au document (survol `mouseover/mouseout`, `focusin/focusout`, `click` au toucher, `keydown` ↓ à la CAPTURE `Infobulle.tsx:180`, `mousedown` hors boîte) ; l'ancrage d'un événement se résout à l'arrivée (`ancrageDe`). Marqueur d'arrêt `data-infobulle-arret` à la racine de la boîte (`Infobulle.tsx:218`). La couche n'écoute aucun élément qu'elle ne rend pas.
- Termes : `sourdine` (prop `CodexRef` + consommateurs), `bascule`, `--ancre-*` ; kind de couche `infobulle` ; classe de boîte `.infobulle`. « popover » ne subsiste que comme `LayerNature` de `dismissStack` (autre concept, A3).
- **X2 d'emblée** : `congediee` (ref synchrone, jamais tenu par un effet) posé par `fermer` quand le pointeur ou le focus occupe l'ancrage ou la boîte (`Infobulle.tsx:84`) ; ignoré par `entre` ; levé par `quitte`, par une ENTRÉE neuve de la même modalité (pointeur ou focus arrivé d'ailleurs), ou par un geste explicite (↓, bascule).
- **X1 d'emblée** : l'emprunt est actif tant que la boîte est épinglée OU tient le focus (`Infobulle.tsx:203`, `ouverte && (epinglee || focusDedans)`), origine = `controleDe(ancrage)` (lui-même s'il est focalisable, sinon son 1ᵉʳ descendant), passée en paramètre à `useFocusEmprunte` (`focus.ts:69`, défaut `activeElement`). Aucun second mécanisme.
- **Q2DIAL (reste d'I1)** : une origine sortie du document cède la place à l'origine de la surface qui la contenait (`chaineDOrigines`, `focus.ts:19` ; table `originesDeBoite` en `WeakMap` privée à `useFocusEmprunte`, écrite et lue par lui seul). La résolution « par nom accessible » de Q6 n'est pas posée : aucun consommateur de `main` n'en a besoin (`MedicModal.tsx:134` garde l'invocateur monté). Évaluation révisable.
- Instance du cas canonique, prouvée : l'infobulle appelle `useFocusEmprunte` avec son invocateur = son ancrage ; les dialogues gardent le défaut (`activeElement`). Mutations M1 et M3.
- `CodexRef` devient une primitive déclarée (`codex-ref`, module `styles/codex-ref.css`), ce qui rend `Infobulle.tsx` réutilisée au sens de `fichiersReutilises` (importée par une entrée du manifeste) : ses modules sortent du stock sans ligne neuve.

## Point 3 : `BoiteAncree` + `usePlacementAncre` (fait)
`src/ui/BoiteAncree.tsx`, `styles/boite-ancree.css`. Consommée par la couche, `PanneauParametre.tsx` et `editor/AddMenu.tsx` (`placeMenu` et `computePopoverPos` morts ; R4 : le menu au-dessus s'ancre par `bottom`, collé à son bouton, mutation M8).
- Placement calculé PENDANT le rendu qui reçoit l'ancrage : le commit d'ouverture porte la boîte (B2, mutation M4). Puis une mesure de contrôle après ce commit (réponse à Q4i, mutation M13), puis défilement (capture) et redimensionnement ; placement égal champ à champ = aucun rendu.
- Table `VARIABLES … satisfies Record<keyof PlacementAncre, \`--ancre-${string}\`>` (`BoiteAncree.tsx:36-42`), d'où dérive l'égalité. **Écart F10** : le style ne peut PAS en dériver par calcul : la garde (xxii) `ui-ratchets.test.ts` n'admet qu'un objet littéral dont toutes les clés sont des variables (`cssCouchesAudit.ts:336-356`, `satisfies` refusé après le littéral) ; le littéral pose les cinq variables et `BoiteAncree.test.tsx` vérifie qu'aucune ne manque.
- F11 : ancrage détaché → aucun placement → aucune boîte (`BoiteAncree.tsx:69`, mutation M5). Un consommateur du lot B qui ancre sur un nœud démonté voit l'infobulle se fermer.
- E2 : `useEffect` seul, aucun `useLayoutEffect` ; test « rendu serveur » sous `renderToStaticMarkup` sans filtre de console (mutation M6).
- F9 : en-tête `BoiteAncree.tsx:1-20` dit ce que fait le code.

## Point 4 : propriété des touches (fait)
`SURFACE = '[role="dialog"],[role="tooltip"]'` exporté par `focus.ts:12` (une définition, lue par `useGameKeyboard.ts` et `chaineDOrigines`). `useGameKeyboard.ts:56` : un BUTTON/A focalisé dans une surface possède Entrée/NumpadEnter/Espace. Commentaire (`useGameKeyboard.ts:38-42`) juste pour un dialogue (F2 : « le focus y a été posé par la surface (son focus d'entrée) ou par le joueur »). Test neuf `wrap-keyboard-vs-cursor.test.tsx` (C) : tooltip et dialog ne commettent pas le curseur ; hors surface (#199) il commet (mutation M12).

## Point 5 : l'élection d'un raccourci (fait, un reste nommé)
Mesure (`rm2-a/f12-mesure.txt`) : les identifiants du registre disent « binding » (`KeyBinding`, `bindingApplies`, `runBindingById`, `runBindingUpById`, `bindingLabel`) ; « raccourci » vit en prose. Terme retenu : `elireBinding`, `bindingParId` (`keybindings.ts:558`, `:573`).
- `elireBinding` consommée par `resoudreEchap.ts` et `useGameKeyboard.ts` (la fonction `trouver` meurt) ; les répliques de test `push-keyboard-commit.test.ts` et `wrap-keyboard-vs-cursor.test.tsx` passent par elle (mutation M11).
- `bindingParId` : `runBindingById`, `runBindingUpById`, keyup de `useGameKeyboard`, `keybindings.test.ts` (dont les deux `Map` par id, F8). Garde d'unicité des ids (`keybindings.test.ts:89`, mutation M10). Q5r : rien d'exporté sans appelant de production (pas de `candidatsBinding`).
- Gardés tels quels, justifiés : `echap-desarme-mode-arme.test.tsx:73` et `raccourcis-modificateurs.test.tsx:36` listent des CANDIDATS (filtre), pas une élection.
- **Reste** : autres recherches par id recopiées en test, hors des fichiers cités : `dialogue-verbe-garde.test.ts:40`, `round-start-keybind.test.ts:11,51`, `sequence-parite-catalogue.test.ts:751,756`, `GameMenu.test.tsx:125`, `dialogue-du-dessus.test.tsx:336,508,513,521`.

## Point 6 : tests promus (fait)
- `Infobulle.test.tsx` : X1 ×3 (entrée depuis l'ancrage, depuis un autre contrôle, depuis body ; après la fiche, focus = contrôle de l'ancrage, 0 boîte), X2 (refocus sans départ : 0 boîte ; après un départ : 1), Q2DIAL (A fermé sous B : focus reste dans B ; B fermé : déclencheur de A).
- Q2BULLE : déjà verrouillé par `CodexRef.hooks.test.tsx` « ÉPINGLÉ puis désépinglé par un clic sur un AUTRE contrôle » (inchangé, vert).
- `CodexRef.hooks.test.tsx` : « Échap puis ↓ … s'épingle ET le focus y entre » (B2) ; « Échap ne rouvre pas » = le cas existant (retour du focus) + X2.
- `App.surcouche-codex.test.tsx` : sans `vi.doMock`/`resetModules` ; échoue sur l'assertion nommée « la fiche en chargement a remplacé l'écran par « Chargement… » » (M7), pas par délai.
- `BoiteAncree.test.tsx` : placement (repris de `CodexRef.test.tsx`), commit d'ouverture, mesure après le commit, ancrage détaché, rendu serveur. `AddMenu.test.tsx` réécrit sur `placerAncre`.
- Tests d'hôtes modifiés : `CombatConsole.test.tsx` (helpers `survol`, `refusAuSurvol`, sonde « mode de ciblage ARMÉ ») : un `mouseover` sur `body` avant le survol modélise le pointeur qui arrive d'ailleurs ; sans lui, trois cas re-survolaient le même ancrage sans en être sortis après Échap, ce que X2 interdit désormais.

## Point 7 : charte et catalogue (fait)
`docs/charte-ui.md:47-49` : `boite-ancree.css`, `infobulle.css`, `codex-ref.css` au catalogue des modules (R1), et « popover » remplacé par « infobulle » aux lignes de `CodexRef` (134, 450, 499, 530, 666). Manifeste : `boite-ancree`, `infobulle`, `codex-ref`, et l'entrée `focus` mise à jour ; `docs/primitives.md` régénéré (`npm run docs:primitives`, exit=0, 151 primitives). Galerie : spécimens `InfobulleDemo`, `BoiteAncreeDemo`, `CodexRefDemo` (`registry.tsx`), le spécimen de la couche sans aucune classe de `CodexRef` (R3). CSS : les règles de `CodexRef` quittent `compendium.css` pour `codex-ref.css` (dont `.codex-ref.ab-codex-info`, repeint sinon, garde §5.3) ; stock régénéré, en baisse seule.

## Questions de sortie
- **F13** : NE SE REPRODUIT PAS sur cette couche. `rm2-a/recette-{1,2,3}.txt` : 6 cycles souris (pointeur laissé en (1417,646), dans l'aire de la boîte, après le clic sur « Ouvrir la fiche ») : `boites: 0` avec `fiche: true` à chaque fois, puis pointeur hors zone : `boites: 0`. `rm2-a/f13-q4i.txt` (le script du juge : clic souris, puis 3 cycles clavier avec le pointeur resté dans l'aire) :
  ```
  [F13] clic porte → {"boites":0,"fiche":true,…}
  [F13 pin 1] Entrée → {"boites":0,"fiche":true,…}   (idem pin 2, pin 3)
  [F13 hors écran] Entrée → {"boites":0,"fiche":true,…}
  ```
  Observation hors périmètre, NON prouvée par une sortie conservée (la sortie du premier essai a été écrasée par le suivant) : un Échap pressé pendant le chargement À FROID du chunk de la fiche (aucune couche encore empilée) est tombé sur l'échelle du registre et a ouvert le menu système (« Sauvegarder / Charger » focalisé ensuite). À instruire : la surcouche en attente de son chunk n'a pas de couche de congédiement.
- **Q4i** : NON MESURÉ au navigateur. Aucun panneau ancré de la console n'a pu être ouvert dans `entrainement` (chip de munition non choisissable même après `giveTrapping('tr-tireur','carreau-nain-norse',6)` : `[Q4i] chip de munition absent`). Traité par construction : `usePlacementAncre` re-mesure après le commit d'ouverture (`BoiteAncree.tsx:84`) ; si ce commit a déplacé l'ancrage, la boîte suit (test « le commit d'ouverture qui déplace l'ancrage », mutation M13). Il reste au plus une image mal placée entre ce commit et l'effet passif ; le mesurer demande un scénario qui ouvre `dispelCarrier`, `rechargeOuverte`, `ammoOuvert` ou `alveole2e` (`CombatConsole.tsx:1415-1455`).

## Navigateur (joueur : clavier et souris réels par CDP ; `__wfrp` pour le scénario, la rencontre et le focus initial de la case)
Script `rm2-a/recette.mjs`, serveur `http://localhost:5173/`, scénario `entrainement` + `fight('enc-entrainement')`, Round 1 ouvert par Entrée réelle, case `defend` (« Défensive »). 3 passes, exit=0, `console : erreurs = 0 []` ×3. Extrait passe 1 (les 3 passes sont identiques) :
```
[cyc 1] focus posé (setup) → BUTTON «Défensive» [data-cell=defend] ; boites 1
[cyc 1] ↓ → BUTTON «Ouvrir la fiche» dansBoite
[cyc 1] Entrée → BUTTON «Monde» dansDialogue ; fiche true, codex sur-la-defensive, boites 0
[cyc 1] Échap → BUTTON «Défensive» [data-cell=defend] ; boites 0 ; sur la case = true
[cyc 4] (souris) avant survol → BUTTON «Défensive» ; clic porte → fiche true ; Échap → BUTTON «Défensive» ; sur la case = true
[cyc 5] (souris) avant survol → body ; clic porte → fiche true ; Échap → BUTTON «Défensive» ; sur la case = true
```
X1 tient au navigateur, focus parti de body compris (cyc 5).

## Table des mutations (jouées sur les blobs finaux ; `rm2-a/mut/M*-rouge.txt`, `rm2-a/mut/table-tout.json`)
| # | Fichier muté | avant → muté → après | Rouge constaté (assertion nommée) |
|---|---|---|---|
| M1 | `Infobulle.tsx` (origine retirée) | 080f8ed516 → e9ed7f2d50 → 080f8ed516 | X1 ×3 : « après la fiche, le focus est au contrôle de l'ancrage » : `expected 'body'` |
| M2 | `Infobulle.tsx` (`congediee` jamais posé) | 080f8ed516 → a3bd60d8d4 → 080f8ed516 | X2 : « refocus sans départ : la boîte congédiée reste fermée » : `expected 1 to be +0` |
| M3 | `focus.ts` (chaîne = `[o]`) | 71d81cbebf → 800a836608 → 71d81cbebf | Q2DIAL : « B fermé : le focus va au déclencheur de A, jamais à body » : `expected 'body'` |
| M4 | `BoiteAncree.tsx` (placement au 1ᵉʳ effet, forme A4) | d7565e3c27 → 602bc4660b → d7565e3c27 | « un effet du commit d'ouverture trouve la boîte » |
| M4b | `Infobulle.tsx` (↓ refusé si congédiée) | 080f8ed516 → 8af9322fc7 → 080f8ed516 | `CodexRef.hooks` B2 : « ↓ rouvre et épingle la boîte » |
| M5 | `BoiteAncree.tsx` (`isConnected` retiré) | d7565e3c27 → 6248f932c0 → d7565e3c27 | « ancrage hors du document : aucune boîte » |
| M6 | `BoiteAncree.tsx` (`useLayoutEffect`) | d7565e3c27 → ee247ca248 → d7565e3c27 | « rendu serveur : aucun avertissement » : `expected [ Array(1) ] to deeply equal []` |
| M7 | `App.tsx` (surcouche remise dans la frontière de l'écran) | 539026317e → 0aa69c16e5 → 539026317e | « la fiche en chargement a remplacé l'écran par « Chargement… » » |
| M8 | `BoiteAncree.tsx` (dessus ancré par `top`, R4) | d7565e3c27 → aabff05dcb → d7565e3c27 | `AddMenu` : « ancré par le BAS : un menu court reste collé à son bouton » : `expected 258 to be undefined` |
| M9 | `BoiteAncree.tsx` (écoute du défilement retirée) | d7565e3c27 → 0d22b8a947 → d7565e3c27 | `AddMenu` « suit son bouton » : `expected '326px' to be '146px'` |
| M10 | `keybindings.ts` (id dupliqué) | d897d38f2f → a51126fa79 → d897d38f2f | « les ids du registre sont UNIQUES » : `expected [ 'intent-cancel' ]` |
| M11 | `keybindings.ts` (`notWhenControlFocused` hors de l'élection) | d897d38f2f → c2f7c08e08 → d897d38f2f | `wrap-keyboard` (A) : `expected { id: 'cursor-down' … } to be undefined` |
| M12 | `useGameKeyboard.ts` (règle `SURFACE` retirée) | 129e9d0279 → 5714c938c3 → 129e9d0279 | (C) tooltip et dialog : « a commis le curseur derrière » : `expected 1 to be +0` |
| M13 | `BoiteAncree.tsx` (mesure après commit retirée) | d7565e3c27 → c07a60d51a → d7565e3c27 | « placée à la position de l'ancrage après le commit » |
Chaque « après » = « avant » (`git hash-object`). Sortie verte après restauration : `rm2-a/portes-vitest-final.txt` (ci-dessous). M4 ne rougit PAS `CodexRef.hooks` B2 : l'emprunt de la couche n'est actif que boîte placée (`Infobulle.tsx:203`), la course A4 y est impossible par construction ; c'est `BoiteAncree.test.tsx` qui la tient.

## Portes (sortie brute, code capturé sans pipe)
- `npm run typecheck:fast` : `typecheck:fast — 0 erreur(s)`, `exit=0` (`rm2-a/typecheck-final.txt`).
- `npx vitest run --no-cache` sur 40 fichiers nommés (`rm2-a/portes-vitest-final.txt`, liste dans la commande ; `ps` avant : aucun vitest étranger, `rm2-a/ps-avant-final.txt` ; `/proc/loadavg` `1.40 1.83 1.90`) : `Test Files 40 passed (40)`, `Tests 717 passed (717)`, `exit=0`. Inclut `src/vi-mock-isolate-guard.test.ts`, `src/comment-poison-guard.test.ts`, `src/ui/primitive-owners-guard.test.ts`, `src/ui/ui-ratchets.test.ts`, `css-modules-guard`, `css-definitions-guard`, `aria-primitive-guard`, galerie, importeurs de `Modal.tsx`/`focus.ts` (`rm2-a/importeurs-modal-focus.txt`). `src/state/resoudreEchap.test.ts` n'existe pas.
- `node scripts/docs/check-doc-refs.mjs` : `docs:check — OK (34 docs vivantes, chemins & symboles vérifiés)`, `exit=0`.
- Régénérateur de stock : son nom actuel est `npx tsx scripts/guards/lib/regenStock.mts scripts/guards/lib/cssCouchesAudit.ts` (en-tête de `regenStock.mts:7` ; `scripts/ui/regen-css-couches-stock.mts` n'existe plus). `--check` final : `Stock à jour`, `exit=0`. Stock contre HEAD (`rm2-a/stock-compte.txt`) : identité 1800 → 1770, espacement 708 → 703, style inline 95 → 93 ; 37 lignes retirées, 0 ajoutée.
- `npx eslint` sur les 36 `.ts/.tsx` touchés (`rm2-a/touches-ts.txt`) : `exit=0`, aucune sortie.

## Écarts et restes
1. HEAD déplacé par une autre session pendant le lot (voir en tête).
2. F10 partiel : style en littéral imposé par la garde (xxii) ; complétude vérifiée par test, pas par le type.
3. `title` de `CodexRef` (`${title} — ↓ : fiche`, `CodexRef.tsx`) conservé : 2ᵉ boîte native concurrente sur le même ancrage, purge prévue au lot B par le design (« migrations (feuilles, JS, `title`) »).
4. Classes de contenu `.codex-pop-title/-sub/-meta/-body/-foot/-open/-refus` gardées (contenu de `CodexRef`, partagé avec les plaques de nom et le HUD) ; seule la BOÎTE change de nom.
5. Q6 « même nom dans la même surface » non posé (aucun consommateur de `main`).
6. Point 5 : recherches par id recopiées dans six autres fichiers de test (liste au point 5).
7. Q4i non mesuré au navigateur ; observation Échap-pendant-chargement non prouvée (voir Questions).
8. Message de commit : le stock ne croît pas ; les trois modules neufs entrent dans la zone exempte (propriétaires réutilisés) sans y avoir été, à juger par la garde `RECLASSEMENT:` au commit.

## Processus lancés
- Serveur de dev `setsid nohup timeout 2700 npm run dev` : PIDs 5757 (`timeout`), 5758 (`npm run dev`), 5769 (`sh`), 5770 (`lancer-local`), 5777 (`vite`), 5785 (`esbuild`), chaîne PPID vérifiée ; tués par PID à 10:14 UTC ; `ps` ensuite : aucun restant.
- Chromium headless des recettes (`recette.mjs` ×4, `sonde.mjs` ×4, `sonde-f13-q4i.mjs` ×3) : fermés par `session.close()` à la fin de chaque script (exit=0 ou exception gérée par `finally`) ; `ps | grep chrome` : aucun restant.
- vitest / tsx / eslint / typecheck : premier plan, bornés par `timeout`, tous terminés.
