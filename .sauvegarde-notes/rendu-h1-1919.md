# Rendu H1 #1919 : la couche HUD est une grille, chaque surface déclare sa zone (2026-09-28)

Worktree `/home/user/game/.wt-1919-H1`, branche `wt/1919-H1`, base `20b8afba5`. Rien n'est committé. Arbre principal : `git -C /home/user/game status --short` est vide (aucune fuite).
`src/data/primitives.manifest.json` : non touché. Aucune écriture dans `node_modules`.
Horloge : 19:49 → 21:20 UTC (1 h 31 sur 2 h 30).

## Diff stat (`git diff --stat 20b8afba5`)
```
 docs/charte-ui.md                       |  78 +++++---
 docs/consommateurs-de-champs.md         |   2 +-   (empreinte sources, docs:build)
 docs/orphelines-donnees.md              |   2 +-   (idem)
 docs/raw/reconciliation.md              |   2 +-   (idem)
 docs/registre-jets.md                   |   2 +-   (idem)
 docs/usages-jets.md                     |   2 +-   (idem)
 scripts/guards/lib/cssCouchesStock.mjs  |   1 -    (régénéré : entrée soldée log-drawer margin-bottom)
 scripts/recette/hud-clickables.mjs      | ~200
 scripts/recette/hud-clickables.test.mjs | ~115
 scripts/recette/lib.mjs                 |  40
 scripts/recette/lib.test.mjs            |  26
 src/ui/CampaignView.tsx                 | 136
 src/ui/CombatConsole.test.tsx           | ~125
 src/ui/CombatConsole.tsx                |  91
 src/ui/ExplorationDock.test.tsx         |  67
 src/ui/PovControls.tsx                  |   3
 src/ui/styles/combat-banner.css         |  44
 src/ui/styles/combat-console.css        |  61
 src/ui/styles/exploration-dock.css      |  34
 src/ui/styles/hud.css                   | ~335
 src/ui/styles/initiative-strip.css      |  64
 src/ui/styles/log-drawer.css            |  47
 src/ui/styles/objective-banner.css      |   3
 src/ui/styles/party-dock.css            |   7
 src/ui/styles/spectator-chip.css        |   2
 src/ui/ui-ratchets.test.ts              |  34
 26 files, ~850 insertions, ~655 deletions
```
Stat brute au moment de la première passe : `scratchpad/h1/diffstat.txt`. Une retouche est venue après (`hud.css` ≤560 et la sonde, cf. point 5).

## Points 1 à 9

### 1. La grille de la couche : fait
- `.stage` : `grid-template-rows: [flot] minmax(0, 1fr) [pont] auto` (`hud.css:30`). Le pont est posé en `grid-area: pont / 1 / auto / 2`. La couche prend `flot / 1 / pont / 2`.
- `.stage > .stage-flot` (`hud.css:52-71`) : `display: grid`, `min-height: 0`, `overflow: clip`.
  - Une seule piste de rangées, jamais recopiée : `[haut] auto [bande] auto [champ] minmax(0, 1fr) [reserve] var(--flot-reserve)`.
  - Colonnes : `[flanc-g] minmax(min-content, 1fr) [centre] minmax(0, auto) [flanc-d] minmax(min-content, 1fr)`.
  - Seules les `grid-template-areas` varient : la base au-dessus de 700, puis `@media (max-width: 700px)` (`hud.css:225`).
  - 900 garde les aires de base. Seules les primitives, dans leurs modules, changent de densité.
- Aires >700 : `'contexte groupe outils' / 'temps groupe outils' / 'temps ouverture outils' / '. . .'`.
- Aires ≤700 : `'contexte groupe outils' / 'temps temps temps' / 'ouverture ouverture ouverture' / '. . .'`.
- Zones montées par `CampaignView.tsx:305-390`, chacune par une primitive `Row`/`Stack` portant `data-zone`, jamais un conteneur nu :

| Zone | Surfaces | Montage |
|---|---|---|
| `contexte` | `.hud-topbar` : ☰ + lieu | `:311`, `Row` |
| `groupe` | `PartyDock` | `:320` |
| `temps` | frise + fil en combat, objectif hors combat | `:326`, `Row stackBelow={700}` |
| `ouverture` | `BandeauDOuverture` | `:359` |
| `outils` | rail, `Stack rowBelow={700}` | `:370` |
| `camera` | `PovControls` | `:386` |

- `data-pont="combat|exploration"` est posé sur la couche (`:305`).
- Le bandeau d'ouverture devient une surface de la couche. Il est extrait de la console :
  - `useBandeauDeRound` (`CombatConsole.tsx:483`) : source unique du bandeau de pause de Round, partagée par le pont et le bandeau d'ouverture ;
  - `estOuverture` (`:509`) et `BandeauDOuverture` (`:515`) ;
  - la console ne rend plus l'adresse `ouverture` (les deux sites de montage sont retirés).
- **Écart au critère N+1, déclaré** : la zone `camera` est posée par LIGNES (`grid-row: champ; grid-column: flanc-g`, `hud.css:125`), pas par une aire. Avec quatre rangées fixes, le coin bas-gauche du champ appartient à l'aire `temps` au-dessus de 700 (frise et caméra ne coexistent jamais). C'est le même type d'écart que le juge G3 a accepté pour l'ouverture.
- **Évaluation d'ingénierie révisable (délégation du 2026-09-28)** : au-dessus de 700, le groupe couvre `haut` + `bande`.
  - La rangée `haut` vaut donc la barre ☰ (42 px), et la frise repart sous le menu, comme sur la base.
  - Mesure à 1707×780 : frise de 452 px sur la base comme après. À 1366×650 : 284 px sur la base, 340 px après.
  - La variante « groupe dans `haut` seul » coûtait 2 entrées de frise à 1707×780. Mesuré (itérations 2-3), puis écarté.

### 2. Aucune géométrie lue d'une autre surface : fait
État de chaque littéral sur la base, puis ce qu'il est devenu :
- `70px`, trois sites :
  - `initiative-strip.css:28` : supprimé ;
  - `initiative-strip.css:114` : `--is-avail: 100cqh`, le conteneur étant la zone `temps` ;
  - `exploration-dock.css:80` : règle `.exploration-dock .ld-panel` supprimée. Le panneau garde son `max-height: 38vh` de primitive. **Changement visible** : sur un grand écran, le journal d'exploration ouvert est plus court (780 px : ≤296 px contre ≤648 px avant).
- `.hud-rail > .worldmap-btn { position: absolute; right…; bottom: calc(… + var(--xd-row) …) }` : supprimé. Le rail ne se dissout plus (`display: contents` a disparu). Il reste une `Stack` qui devient une rangée sous 700.
- `max-width: min(560px, max(200px, calc(50vw - 160px)))` de la barre haute : supprimé. La zone `contexte` ne pèse pas sur sa colonne (`contain: inline-size`), avec un plancher `min-width: var(--xd-row)`. Le lieu s'ellipse (`min-width: 0`, Row `wrap={false}`).
- `max-width: 40vw` / `52vw` du lieu : supprimés.
- `--pd-corners: 172px`, `left: 50%` + `translateX`, `top: 10px/6px`, `left: 58px`, `calc(100vw - 66px)` du groupe : supprimés. Le groupe est centré par sa colonne, avec `max-width` arrondi au pas sur `100%` de sa zone.
- `top: 138px` du volet : supprimé. Le volet naît sous sa poignée (`top: calc(100% + var(--sp-xs))`, centré sur elle).
- `--cc-ouverture-top: 152px` et ses tranches ≤700 : supprimés (`combat-console.css`). Il reste `inset: auto` sur l'adresse `ouverture`.
- `.combat-feed` : `left: 130px`, `bottom: calc(--cc-phase-h …)`, `top: 192px` (≤700), `top: 140px` (≤560) supprimés.
- Frise : `top/left/right/bottom` à 70/84/34 px et `left: 58px` supprimés.
- `.log-drawer` absolu à `right: 12/8px`, `bottom`, `left: 4px` : supprimés.
- `.stage-flot > .pov-controls { position: absolute; left: 16px; … }` : supprimé.
- `grep` de contrôle sur les sept feuilles touchées : aucun de ces littéraux ne subsiste. Les `84px`/`70px` qui restent dans `combat-console.css` (`:22`, `:72`, `:741`, `:862`) sont internes à la console et hors sujet.

### 3. Portée : fait
- Toutes les règles du groupe sont portées par la zone : `[data-zone='groupe'] > .party-dock` (`hud.css:197`) et `.on` (`:248`).
- `[data-fiche] { z-index: 126 }` est gardé (`:208`, #1829).
- La couche n'est plus un conteneur de requête : `container-type` sur `.stage-flot` créait un contexte d'empilement qui aurait piégé le 126 sous le voile de la fiche. Seule la zone `temps` est conteneur, au-dessus de 700.

### 4. Réserve de phase : fait
- `--flot-reserve` vaut `calc(var(--cc-phase-h) + var(--cc-phase-air))` sous `[data-pont='combat']`, et `0px` sinon (`hud.css:60,70`). C'est la seule lecture.
- Elle est payée pendant tout le combat, verbatim d'immobilité cité à la charte.
- Plus aucun module (frise, fil) ne lit `--cc-phase-h`. Le test P-6 le garde.

### 5. Portraits : pas modifiés sur ce point, mesurés. Une régression du lot corrigée en route
- De 561 à 900 : 56 px, comme la base. `party-dock.css` n'a reçu que des commentaires. Aucun `@container`, rien d'étendu aux tuiles `sm`.
- ≤560, volet à 360 × 740, mesure réelle (`scratchpad/h1/apres/mesures.json`, clé `volet-360`) :
  - tuiles 44 × 62 ;
  - chiffres « 12/12, 16/16, 14/14, 10/10 » rendus et atteints, en police **9px** (valeur de la base, non modifiée).
  - Aucune règle écrite ne fixe un corps minimal « lisible ». C'est donc **nommé, pas tranché**, pour le juge ou le lot console.
- **Régression du lot, trouvée puis corrigée** (même classe que le G2 pt.5) :
  - la poignée repliée ≤560 était rognée à 93 px par l'arrondi au pas, et ses 4 micro-jauges étaient cachées (0 sur 4) ;
  - correctif : `[data-zone='groupe'] > .party-dock { max-width: 100% }` sous 560 (`hud.css:244`). Poignée remesurée : 160,5 px, comme la base, centrée à 180/360 ;
  - garde : nouveau verdict de sonde « micro-jauges » (`hud-clickables.mjs:483` pour la mesure, `defautsGroupe` pour le verdict).

### 6. Journal : panneau ancré à son bouton, raison mesurée
- Le panneau naît du bouton par `position: absolute` dans `.log-drawer`, qui est relatif (`log-drawer.css`). Aucun Anchor Positioning.
- Il s'ouvre vers le haut sur le pont d'exploration, et pend sous le bouton dans le rail (`hud.css:147`).
- Mesure du flux, injecté en variante (`scratchpad/h1/journal-flux.txt`), centre du groupe fermé → ouvert :

| Vue | Flux | Ancré |
|---|---|---|
| 1707 | 853,5 → 853,5 | inchangé |
| 1366 | 683 → 683 | inchangé |
| 900 | 450 → **337** | inchangé |
| 700 | 350 → **197** | inchangé |
| 360 | 180 → **50** | inchangé |

- En flux, le bouton du journal descend aussi de 152 px à toute largeur. Ancré, ni le groupe ni le bouton ne bougent.
- Raison écrite à la charte : la largeur du panneau devenait le minimum de la colonne `outils`. La citation d'immobilité n'est pas invoquée.

### 7. Tests réécrits en « la surface déclare sa zone » : fait
Nouveau rendu jsdom de `CampaignView` (`ExplorationDock.test.tsx`, bloc « #1919 — la couche HUD est une grille ») :
- exploration : `contexte`, `groupe`, `temps` (objectif), `camera` ;
- combat : frise et fil en `temps`, `outils`, `ouverture`, `groupe` ;
- le pont et la console sont hors de la couche, enfants de `.stage` ;
- chaque zone est un enfant direct de la couche, et `hud.css` la place.

Tests réécrits :
- `ExplorationDock.test.tsx` « le tiroir-journal est assis SUR le pont, et son panneau naît de son bouton » (remplace « LIT la réserve »).
- `CombatConsole.test.tsx` :
  - P-1 : rangées nommées `[flot] … [pont] auto`, couche bornée à la ligne `pont` ;
  - P-5 : le fil n'a aucune ancre ;
  - P-6 : la frise n'a ni ancre ni lecture de phase, `--is-avail` en `cqh`, zone `temps` conteneur ;
  - P-7 : le débord du bandeau, adresses `pont` et `spectatrice`, tient dans `--flot-reserve` ;
  - « le bandeau d'OUVERTURE n'a AUCUNE ancre propre » (remplace « s'ancre sur des grandeurs DÉCLARÉES ») ;
  - le helper `ouverture()` monte `<BandeauDOuverture/><CombatConsole/>`, et « OUVERTURE : bandeau CENTRÉ hors du pont » perd ses assertions de texte CSS.
- `ui-ratchets.test.ts` :
  - « couche HUD (#1919) : aucune surface n'est posée hors flux, seul le VOLET du groupe l'est » (remplace « ≤700 : le rail se DISSOUT ») ; c'est une garde de CLASSE : tout `position: absolute|fixed` dans `hud.css` ;
  - « ≤560, bande DÉPLIÉE » (sélecteurs de zone).
- `hud-clickables.test.mjs` : 3 tests du rail dissous retirés (le code qu'ils gardaient n'existe plus), 10 tests `defautsCouche` et micro-jauges ajoutés.
- `lib.test.mjs` : 2 tests `appelCdp`.

### 8. Sonde étendue : fait
`scripts/recette/hud-clickables.mjs` :
- `LARGEURS_COUCHE` à 7 largeurs × `HAUTEURS_COUCHE` à 3 hauteurs de `vues-recette.json` (`:81`), jouées dans 4 états : exploration, ouverture, tour de héros, spectateur.
- Le spectateur est atteint par le VRAI geste : « Fin du tour » cliqué deux fois (`cliquerAction`), minuteries IA figées pendant la mesure, forme `spectatrice` vérifiée. Jamais `store.setState`.
- Verdicts `defautsCouche` (`:706`) : pont posé au bas, page sans défilement, aucune surface de zone rognée par la couche, chaque commande de la couche et du pont atteinte.
- L'exemption vaut seulement pour une commande hors du champ ENTIER de son ancêtre défilant, ou sous sa tête collée (`sticky`). Il n'y a plus d'amnistie « un autre enfant ».
- Le recouvrement du tiroir se calcule désormais sur sa boîte rognée par la couche (juge G3 pt.4).
- Branches mortes du rail dissous retirées.
- `rpc` sur une socket fermée : **le défaut était présent sur la base**. Selon WHATWG, `send` sur une socket CLOSED jette le message sans lever, donc la promesse pendait.
  - Corrigé par l'extraction `appelCdp` (`lib.mjs:317`), qui rejette tout de suite une erreur typée `TARGET_NAVIGATED`.

### 9. Charte : fait
- `docs/charte-ui.md:386` : la section « Une réserve de pont se tient par le FLUX… » est remplacée par « Le pont se dimensionne seul ; le HUD vit dans ce qui reste, et n'en sort pas (#1848, #1919) ».
- Elle porte la phrase retenue verbatim, le critère N+1, la réserve avec le verbatim d'immobilité et sa date, le journal avec sa raison mesurée, la zone conteneur `cqh` et la preuve mécanique.
- Commentaires des feuilles touchées remis au présent, à réf nue : `hud.css`, `initiative-strip.css`, `combat-banner.css`, `log-drawer.css`, `exploration-dock.css`, `combat-console.css` (`--cc-deck-h`, `--cc-phase-h`, `--cc-notch`, ouverture), `party-dock.css`, `objective-banner.css`, `spectator-chip.css`, `PovControls.tsx`.

## Mutations (fichier muté, test ROUGE, remise à l'identique, test VERT)
Empreintes `git hash-object` complètes : `scratchpad/h1/mut/*-resultats.json`, `sortie*.txt`. Journaux rouge/vert : `scratchpad/h1/mut/<nom>-{rouge,vert}.txt`. Dans chaque ligne, les empreintes « avant » et « après » sont identiques.

| Mutation | Fichier | Test rouge | Avant → muté → après |
|---|---|---|---|
| M1 zone `temps`→`champ` | CampaignView.tsx | 2 tests « #1919 » | fc0bde9084 → a93c06d250 → fc0bde9084 |
| M2 ouverture hors zone | CampaignView.tsx | « #1919 COMBAT » | fc0bde9084 → 816c1aa4b5 → fc0bde9084 |
| M3 panneau relit `70px` | exploration-dock.css | « tiroir-journal est assis » | d0b975e7fa → d7f3e9b45f → d0b975e7fa |
| M4 `[flot] 1fr` | hud.css | P-1 | 0598c93531 → 513097294e → 0598c93531 |
| M5 `left: 130px` sur le fil | combat-banner.css | P-5 | 5979596b8f → 9a4029d7b6 → 5979596b8f |
| M6 frise relit `--cc-phase-h` | initiative-strip.css | P-6 | 08faee7c7d → 1221953f3f → 08faee7c7d |
| M7 réserve trop courte (après correction du pire cas du test) | hud.css | P-7 | 0598c93531 → 5ed6c1adf4 → 0598c93531 |
| M8 `top` sur l'ouverture | combat-console.css | « OUVERTURE n'a AUCUNE ancre » | 446c1c8ef4 → cd083a544b → 446c1c8ef4 |
| M9 `BandeauDOuverture` nul | CombatConsole.tsx | 2 tests « OUVERTURE » | 94fac818b6 → 449418ab29 → 94fac818b6 |
| M10 rail `absolute` | hud.css | « couche HUD : aucune surface hors flux » | 0598c93531 → 657a23dbea → 0598c93531 |
| M11 volet `z-index: 40` | hud.css | « bande DÉPLIÉE » | 0598c93531 → f003fb6ecc → 0598c93531 |
| M12 garde `readyState` retirée | lib.mjs | 2 tests « appel CDP » | 48b3f978ec → c94a0f9236 → 48b3f978ec |
| M13 `defautsCouche` muet | hud-clickables.mjs | 7 tests couche rouges | a0c6edac2f → 24a60de144 → a0c6edac2f |
| M14 exemption ignorée | hud-clickables.mjs | « EXEMPTÉE » | a0c6edac2f → 7dd32ca350 → a0c6edac2f |
| M15 seuil de rognure à 0 | hud-clickables.mjs | « demi-pixel » | a0c6edac2f → d83604b2bf → a0c6edac2f |
| M16 poignée arrondie au pas (sonde réelle `--widths 360`) | hud.css | « la poignée du groupe replié ne montre que 0 micro-jauge(s) sur 4 », exploration et combat 360 ; vert : 360 OK | 989a182259 → 9f8fde824e → 989a182259 |
| M17 verdict micro neutralisé | hud-clickables.mjs | « MICRO-JAUGES » | dbae612f36 → 202bfcc687 → dbae612f36 |

Précisions sur quelques lignes :
- **M7** : la première version de P-7 est restée VERTE sous mutation. Le cas `pont` de la saillie compensait le débord. Le test a été corrigé pour juger le pire cas (adresse `spectatrice`), puis rejoué ROUGE.
- **M12** : la promesse pend et est annulée par `node --test`.
- **M16** : la sonde sort en 1 dans les deux passes, à cause des défauts 700 et 900 listés plus bas. Seule la ligne micro-jauges change.
- M1 à M15 ont été joués avant les dernières retouches de `hud.css` et de la sonde, donc à d'autres empreintes. Les tests visés ont été rejoués verts sur l'arbre final.

## Captures (avant sur `20b8afba5`, après sur l'arbre final) et sha256
- Méthode « avant » : les fichiers WIP ont été copiés dans `scratchpad/h1/wip/`, remplacés par `git show 20b8afba5:<fichier>` (aucune commande git d'écriture), capturés, puis restaurés depuis `wip/`.
- Dossiers `scratchpad/h1/avant/` (30 PNG + `mesures.json`) et `scratchpad/h1/apres/` (31 PNG, dont `exploration-volet-360x740.png`, + `mesures.json`).
- Empreintes : `scratchpad/h1/avant.sha256` et `scratchpad/h1/apres.sha256`.
- États capturés : exploration ; journal d'exploration ouvert (clic réel) ; ouverture ; tour de héros ; journal de combat ouvert (clic réel) ; tour adverse.
- Vues : 360×740, 700×780, 900×780, 1366×650, 1707×780.
- « Commencer le combat » est cliqué au vrai bouton.
- Clic réel dans une zone vide, cible reçue `svg.iso-stage`, donc le monde : en exploration (847, 292) et en combat (847, 260).
- Comparaison de boîtes avant/après : `scratchpad/h1/comparaison.txt`. Extraits :

| Vue | Surface | Avant | Après |
|---|---|---|---|
| 1707 héros | frise | 10,79.8, h 452 | 8,65.8, h 452 |
| 1707 héros | fil | x 130 | x 102 (juste après la frise) |
| 1707 héros | groupe | 654.5 | 654.5 |
| 1366 héros | frise | h 284 | h 340 |
| 700 héros | frise | y 84, recouvrait le groupe (6..129,6) | y 131,6, sous le groupe |
| 360 héros | groupe | x 58 | x 99,8, centré |
| 360 héros | rail | 0×0 (dissous) | 296,4 : rangée en haut à droite |
| 360 ouverture | bandeau | 352 de large | 207, centré au pied du champ |

- Console : **1 erreur, identique avant et après**. Elle est hors périmètre, cf. plus bas.
- **Limite** : l'agent n'a aucun outil de lecture d'image. Les captures sont produites et hachées, mais leur lecture visuelle reste à faire par l'orchestrateur ou le juge. Toutes les affirmations de ce rendu viennent des mesures DOM (`mesures.json`, sonde).

## Sortie de la sonde étendue
Sortie brute complète : `scratchpad/h1/sonde-finale.txt`, avec `exit=1` et « 56 défaut(s) ».

Couche : 84 vues jugées, **78 OK**. Les 6 en défaut :

**Tour de héros à 900, les 3 hauteurs** : défaut de console, préexistant.
- « Dague » et « Mains nues » à x = −36,6 px, hors écran.
- « Ignorer les modificateurs de critique » recouvert par `icon <svg>`, déjà relevé par le juge G2 sur la base.
- Cela relève de la composition 701-900 du lot console (décision Q1 du 2026-09-24).

**Tour de héros à 700, les 3 hauteurs** : le pont fait 575 px (74 % de 780, 88 % de 650). C'est l'entrée mesurée du lot console (budget du pont 561-700).
- La couche rogne le fil de 26,5 / 66,5 / 156,5 px, la frise de 40,5 / 130,5 px et le groupe de 52,6 px.
- Au plus, 9 entrées de frise passent sous le pont (`cc-dock`).
- Sur la base, la même vue avait déjà la frise sur le groupe (84..158 contre 6..129,6) et un flot de 205 px.

Autres défauts, hors couche. Code des portraits et de la console non touché par ce lot : défauts préexistants par inférence, non rejoués sur la base.
- 1707 : pont à 24,0 % pour un plafond de 21 % (G2 : base).
- « Au trait en bas » à 1707, 1100, 900 et 360 (G4 : reproduit par F5 sur la base).
- Matrice §12 à 700 : « vie non superposée au portrait » ; à 700 et 900 : « carte pas plus compacte ».
  - Cela contredit la décision G3 « de 561 à 900, retour aux portraits de la base ».
  - C'est donc le verdict de sonde `defautsCompacite` / `vieSurPortrait` qu'il faudra réécrire depuis cette décision. Il n'est pas modifié ici : ce n'est pas dans le lot.

## Portes (sortie brute dans `scratchpad/h1/porte-*.txt`, code lu sans pipe)

| Porte | Code | Résultat |
|---|---|---|
| `npm run typecheck:fast` | exit=0 | 0 erreur(s) |
| `npx vitest run --no-cache` (liste ci-dessous) | exit=0 | 23 fichiers, 477 passés + 2 todo |
| `node --test` (liste ci-dessous) | exit=0 | 319/319 |
| `npx tsx scripts/guards/lib/regenStock.mts scripts/guards/lib/cssCouchesAudit.ts --check` | exit=0 | Stock à jour. Régénéré avant par `--lot '#1919'` : 1 entrée soldée |
| `npx tsx scripts/ui/ventilation-css-couches.mts 20b8afba5` | exit=0 | voir ci-dessous |
| `npx eslint` sur les 11 `.ts/.tsx/.mjs` touchés | exit=0 | sortie vide |
| `npm run docs:build` | exit=0 | 5 docs générées, empreinte seule |
| `npm run docs:check` | exit=0 | OK |

Fichiers vitest : CampaignView, CombatBanner, CombatConsole, ExplorationDock, GameMenu, InitiativeStrip, LogDrawer, ObjectiveBanner, PartyDock, camera-sans-plaque, css-modules-guard, primitive-owners-guard, ui-ratchets, comment-poison-guard, stock-primitive, bascule-de-vue, murage-identite, in-battle-find-guard, coop-surfaces-combat, determination-reachability, dialogue-couche-du-dessus, dialogue-du-dessus, fin-de-tour-deux-temps. Ce sont tous les importeurs de test des fichiers touchés, trouvés par `git grep -l`.

Fichiers `node --test` : `scripts/recette/lib.test.mjs`, `hud-clickables.test.mjs`, `detecteurs-pont.test.mjs`, `detecteurs-hauteur.test.mjs`, `scripts/guards/lib/cssCouches.test.mjs`, `cssConservation.test.mjs`, `scripts/hooks/stocks-nominatifs.test.mjs`.

Ventilation : identité 1770 → 1770, APPARU 0 ; espacement 703 → 702 (DISPARU 1), APPARU 0. Aucun `!important` neuf (`git diff 20b8afba5 -- src/ui/styles | grep '^+.*!important'` est vide).

## Hors périmètre (constaté, non corrigé)
- `src/engine/items.ts:708` `unloadWeapon` : « TypeError: Cannot assign to read only property 'loaded' » via `combatFlow.ts:1719` / `:1481` / `:2370`. Il se déclenche sur une attaque d'IA ennemie, avant et après, sur `embuscade` graine 7 + `fight('enc-mutants')`. C'est la seule erreur console de la recette.
- Console 701-900 : commutateur de sets hors écran, case recouverte par un `svg`. Et budget du pont 561-700 (575 px). Ce sont les entrées du lot console, mesurées ci-dessus.
- `scripts/guards/lib/cssConservation.mjs:13` : l'exemple de commentaire `.party-dock` → `.stage > .party-dock` n'existe plus dans le code. C'est un exemple générique, laissé tel quel.

## Processus
- Serveur de dev n°1 : `timeout 7200 npm run dev`, PGID 24840, port 5246. **Tué** (SIGTERM au groupe), vérifié : aucun `vite`/`esbuild`, `curl` rend 000.
- Serveur de dev n°2 : `timeout 1800 npm run dev`, PGID 32567. **Tué** de la même façon, vérifié.
- Chromium : chaque session `openApp` a été fermée par `session.close()` dans un `finally`. `ps` ne montre aucun processus chrome restant.
- Aucune tâche en arrière-plan ne survit.
