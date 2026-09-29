# Grounding #1919 (HUD en grille) — 2026-09-28, branche chantier/1806, HEAD 7270396a6

Récupéré via `gh api repos/cgauche/game/issues/1919/comments --paginate` (OK) et
`.../1806/comments --paginate` (OK). Rien exécuté en fond ; aucun serveur/navigateur lancé.

## 1. Design retenu et défauts

### Paragraphe de design (verbatim, commentaire id=5804334389, "Design retenu : le pont se
dimensionne seul", 2026-09-23) :

> **Le pont se dimensionne seul ; le HUD vit dans ce qui reste, et n'en sort pas.** Le plateau
> `.stage` porte deux rangées : `[flot] minmax(0, 1fr) [pont] auto`. Le pont (console de combat ou
> pont d'exploration) est la rangée `pont`, à la hauteur qu'il fait. Rien au-dessus de lui ne peut
> le pousser, puisqu'une piste `minmax(0, 1fr)` ne pousse pas une piste `auto`. La couche HUD
> `.stage-flot` est une grille à ELLE, posée dans `flot`, avec `[haut] auto [bande] auto [champ]
> minmax(0, 1fr) [reserve] …`, `min-height: 0` et `overflow: clip`. Chaque surface y déclare sa
> zone (`data-zone`), et le bandeau d'ouverture devient l'une d'elles, à la rangée `champ`, monté
> par la couche. Une surface de plus coûte une ligne de `grid-template-areas` et un `data-zone`, et
> aucune hauteur n'est lue. Le rognage de la couche est le seul mode de défaillance, et il ne
> s'applique qu'HORS des vues de référence. Aux vues de référence (1707×780, 1366×650, 360×740) et
> aux seuils 900/700/560, HUD et pont tiennent ensemble, grâce au BUDGET du pont et non à une
> cession de la grille.

Phrase de charte retenue (même commentaire) :

> « `.stage` porte deux rangées, `[flot] minmax(0, 1fr) [pont] auto`. La couche HUD est une grille
> propre posée dans `flot` ; elle borne son débordement (`overflow: clip`) et porte seule les
> rangées `haut`/`bande`/`champ`/`reserve`. Le pont ne lit ni ne subit aucune rangée du HUD, et sa
> hauteur est tenue par son budget, à chaque tranche. »

Critère N+1 (même commentaire) : « Une surface de plus au HUD coûte une ligne de
`grid-template-areas` et un `data-zone`, sans aucune hauteur lue. » — G3 (id=5805158682) note un
écart JUGÉ CORRECT à ce critère : « L'écart au critère N+1 (la zone `ouverture` placée par ligne et
non par aire) est une conséquence juste. La seule forme à une ligne d'aires ferait changer la
taille de la frise au premier Round, contre l'arbitrage d'immobilité. »

**FAIT CLÉ** : ce design (couche `.stage-flot` en grille interne avec `data-zone`) N'EST PAS sur
`main`. Ce qui EST sur `main`, depuis `8fe2a96eb` (#1848, antérieur de 2 jours aux G2-G5 de #1919),
c'est la partie « pont dans la rangée `auto` du bas, `.stage-flot` = rangée du haut » — MAIS sans
grille interne ni `data-zone` : `.stage-flot` est un simple conteneur `position: relative` +
`container-type: size` (`src/ui/styles/hud.css:44-56`), et chaque surface (`.hud-topbar`,
`.party-dock`, `.pov-controls`, `.hud-rail`) s'y positionne encore en `position: absolute` avec des
littéraux (`hud.css:65-73`, `:82-98`, `:103-120`, `:180-197`). La conversion en grille + `data-zone`
(objet du ticket #1919, scope "HUD en grille") reste donc entièrement À FAIRE.

### Défauts consolidés — G2 pt.2-8 (tels que corrigés/annulés par G3/G4), G3 pt.1-5, G4 pt.1-5

Source : brief de reprise (id=5803168329, 16 défauts) ; verdict G2 (id=5804164976, "ce qui
tient"/"ce qui ne tient pas") ; verdict G3 (id=5805158682) ; verdict G4 (id=5805889646).

Le verdict G2 dit explicitement : « Ce qui tient : Défauts 1 à 4, 7 à 11, 13 et 15 du verdict
précédent [= brief 16 points]. » et liste 8 nouveaux défauts propres au lot G2, dont son propre
défaut n°1 (pont coupé à 700×780) a motivé le design ci-dessus. G3 dit : « Les 8 défauts G2, sauf
le 7 [tiennent]. »

Défauts du BRIEF (16 pts) encore valables si le code n'a jamais été appliqué à `main` (vérification
faite ci-dessous point par point sur l'état RÉEL de `main`) :
- **Aucun** défaut du brief n'est « déjà couvert par autre chose sur main » sauf le défaut 16
  (classifieur `column-rule*`/`list-style-image`, `block-size`/`inline-size`) : CONFIRMÉ CORRIGÉ sur
  `main`, voir §3.
- Tous les autres points du brief (1,2,3,4,5,6,7,8,9,10,11,12,13,14,15) portaient sur du code du
  worktree `wt/1919`/`wt/1919r`/`.wt-1919g3`/`wt/1919g5` — **aucun n'existe sur `main`** (grep
  négatif systématique, §2). Ils sont donc SANS OBJET tels quels (rien à « reprendre » dessus sur
  `main`, puisque le code qu'ils visaient n'y est jamais arrivé) ; mais l'INTENTION qu'ils portent
  (ex. pt.9 "un bouton qui lit la géométrie du voisin doit entrer dans le flux", pt.14 "tests par
  regex de texte CSS à réécrire en relation `data-zone`") reste un critère de conception pour la
  reprise, puisque `main` recommence de zéro sur le scope grille.

Défauts G3 (id=5805158682), avec correction retenue verbatim, et statut sur `main` :
1. **Chiffre de Blessures disparaît du groupe à ≤900** — retenu : « De 561 à 900, R-M1 ne s'applique
   pas : retour aux portraits de la base, sauf raison écrite. » — SANS OBJET direct : sur `main` le
   portrait du groupe est resté à 56px partout (`party-dock.css:27-32`, pas de `@container`
   introduit par G2/G3) ; la régression n'existe pas sur `main` car le code qui l'a introduite n'y
   est jamais arrivé. Le CRITÈRE (portraits base 561-900, chiffre lisible ≤560) reste valable pour
   toute reprise qui retoucherait ces tranches.
2. **Charte** : « Le critère N+1 est réécrit sans le dire » ; « la phrase sur la réserve est
   fausse » ; « la phrase sur le journal est fausse au-dessus de 700 ». SANS OBJET : la charte de
   `main` ne contient toujours QUE la section #1848 (`docs/charte-ui.md:386-411`, voir §5), aucune
   des phrases visées (issues du lot perdu) n'y a été écrite.
3. **Réserve de 51px en combat sans surface qui la publie** — décision retenue : « Elle est exigée
   par l'arbitrage d'immobilité … : « je ne veux pas que la taille de l'interface ou les boutons
   bougent ». L'attacher à la publication ferait changer la taille de la frise à chaque tour
   spectateur. » VALABLE COMME CRITÈRE pour toute reprise (l'arbitrage cité existe bien sur `main`,
   `src/ui/CombatConsole.tsx:51-53`, voir §6) ; le code visé (réserve de 51px) n'existe pas sur
   `main`.
4. **Sonde** : exemption du défilant trop large, recouvrement du tiroir calculé sans rognage, héros
   au trait non déterministe, `rpc` sur socket fermée ne règle jamais sa promesse (`lib.mjs:348-354`
   à l'époque). État sur `main` : voir §4, la sonde actuelle (`hud-clickables.mjs`) est celle
   d'AVANT les évolutions G3/G4/G5 côté pont — ses défauts propres au design "couche imbriquée" (qui
   n'a jamais atterri) ne s'y retrouvent pas nécessairement ; non vérifié bit-à-bit faute du code
   `lib.mjs` de l'époque (hors périmètre lu).
5. **Poison de zone touchée** (`decl` sur `--ptile-px`, hachure en triple, `--rp-taille: 42px` en
   ligne dans `RigPortrait.tsx:23`, `scroll-padding-inline-start` erroné, `!important` de
   `.cc-ico > span`). Ces poisons visaient des fichiers du lot ; vérification ciblée sur `main` :
   `--rp-taille` et le commentaire périmé `initiative-strip.css:310-314` n'ont pas été retrouvés
   identiques (non explorés ligne à ligne, hors périmètre du grounding demandé — NON COUVERT).

Défauts G4 (id=5805889646), avec correction retenue verbatim :
1. « Le chiffre s'étend aux tuiles `sm` … la bande est `md` nominale (`PartyDock.tsx:69` à
   `5927e4a4d`) » — code du lot, sans objet sur `main`.
2. « Le glyphe d'objet tombe à 72% dans les cases de la console … `combat-console.css:538-539` ».
   Sur `main` actuel, ces lignes ne portent pas ce contenu identique (le fichier a 1432 lignes,
   fortement remanié depuis, cf. §2 combat-console.css) — NON VÉRIFIÉ terme à terme, correspondance
   non établie.
3. « Journal au-dessus de 700 : raison fausse … la citation d'immobilité porte sur le compte de
   cases, pas sur un panneau ouvert par le joueur. » — critère réutilisable, code visé absent de
   `main`.
4. « 4d n'est pas bloqué : … Trou de garde : un jeton local avec un repli passe, car la garde lit le
   repli (`cssCouchesAudit.ts:208-210`) » — À VÉRIFIER sur `main` (non fait, hors budget de ce
   grounding ciblé HUD ; signalé comme non couvert).
5. « Sonde : la taille du chiffre n'est pas jugée … un tiroir rogné en partie passe … le tour
   spectateur est forgé par `store.setState` » — critère de sonde réutilisable pour toute reprise de
   `hud-clickables.mjs`.

**Décision d'orchestration jointe à G3** (verbatim, tenue) :
> Le chiffre : la spec validée tranche… De 561 à 900, R-M1 ne s'applique pas : retour aux portraits
> de la base, sauf raison écrite. … À ≤560, R-M1 (arbitré le 2026-08-16) prime sur la règle de la
> primitive (2026-06-12) : le chiffre reste lisible sur une tuile de 44 px.
> La réserve reste payée pendant tout le combat. Elle est exigée par l'arbitrage d'immobilité
> (`src/ui/CombatConsole.tsx:52-53`), verbatim : « je ne veux pas que la taille de l'interface ou les
> boutons bougent ». L'attacher à la publication ferait changer la taille de la frise à chaque tour
> spectateur. La charte le dira avec cette citation.

### Décision d'écran de la console sur #1806 (2026-09-24T09:02, id=5811134651) — tranche 561-700
(Q4.3), citation verbatim demandée :

> 3. **Chrome total à 700×780 ≈ 63 % de l'écran** (lecture de capture) : bandeau + frise horizontale
> de y 0 à 195, pont de 482 à 780.
>    - Les héros apparaissent deux fois, au bandeau et à la frise.
>    - La plage 561–700 empile les deux travées (capture refus 700).
>    - Correction : l'arche en une ligne (forme ≤560 du 2026-08-16) + les deux travées côte à côte,
>      cases ≈ 40 px, pont ≈ 19 %. La frise verticale de RT jusqu'à 561 px.
>    - Modèle : RT §B (`Analyse:75-76`, lu par le designer, non relu par moi) ; R-M1 (`spec:66-68`).

Ce même commentaire tranche aussi Q1 (console 701-900 : une seule rangée, cases carrées sans
libellé, cote unifiée) et Q2 (fronton compté dans le budget : `min(52px, 4.8vh)`, bande ≤17%,
empreinte totale ≤22%) et Q3 (suppression de `.cc-set-n`, plaque X en en-tête de travée) — verbatims
complets récupérés dans le commentaire brut (id=5811134651), non reproduits en entier ici (très
long) mais disponibles dans le fichier scratchpad `1806-comments.json`.

**FAIT CLÉ** : aucune des sections « Coutures à changer » listées à la fin de ce commentaire
(`combat-console.css:21-35,42,47,52,653-656,1086-1131,1141,181,616-622,1243-1246`;
`CombatConsole.tsx:1316,1335,1342,1121,1430`; `hud-clickables.mjs:727,1333-1336`;
`CombatConsole.test.tsx`; `docs/charte-ui.md:682`; `docs/plans/2026-08-16-spec-hud-combat.md:31,215,
220-221`; `src/state/hotbarBridge.ts:11-12`) n'est appliquée sur `main` — vérifié point par point en
§2 (ex. `.cc-lbl`, `.cc-set-n` toujours présents ; `BUDGET_PONT` toujours `{large:{des:1280,
part:0.21}, compact:{part:0.45}}` sans plafond 561-1279, `scripts/recette/hud-clickables.mjs:664`).
Cette décision de console est donc, elle aussi, PERDUE au même titre que G2-G5 (le commentaire dit
que le codeur G5 devait fusionner ce travail dans `wt/1806-combat`, jamais poussé).

## 2. État ACTUEL de `main` (chantier/1806, HEAD 7270396a6)

### `src/ui/styles/hud.css` (265 lignes)
- `.campaign-view { flex-direction: row; position: relative }` (l.14-17).
- `.stage { flex:1; position:relative; overflow:hidden; min-width:0; display:grid;
  grid-template-rows: 1fr auto }` (l.27-34) — DÉJÀ le schéma 2-rangées `[flot] 1fr [pont] auto`
  décrit par le design retenu (mais posé par #1848, PAS par #1919).
- `.stage > * { grid-area: 1/1/-1/-1 }` (l.35-37) : tout enfant par défaut couvre les 2 rangées
  (sauf override explicite ci-dessous).
- `.stage > .stage-flot { grid-area: 1/1/2/2; position:relative; pointer-events:none;
  container-type:size; container-name:flot }` (l.44-53) — rangée du haut, PAS une grille interne
  (pas de `grid-template-columns/areas`, pas de `data-zone`).
- `.stage-flot > *:not(.combat-feed) { pointer-events:auto }` (l.54-56).
- `.stage > .combat-console, .stage > .exploration-dock { grid-area: 2/1/3/2 }` (l.59-62) : le pont
  est la rangée basse.
- `.stage-flot > .pov-controls` : `position:absolute; left:16px; bottom: var(--sp-lg)` (l.65-73).
- `.hud-rail` : `position:absolute; top:16px; right:16px; z-index:46` (l.82-87) ; `@media
  (min-width:701px) { .hud-rail > .log-drawer { position:static … } }` (l.91-98).
- `.hud-topbar` : `position:absolute; top:10px; left:10px; z-index:60; gap: var(--sp-sm); max-width:
  min(560px, max(200px, calc(50vw - 160px)))` (l.103-120) — le littéral `50vw - 160px` cité par le
  brief EXISTE bien ici, mais c'est du code d'AVANT #1919 (commentaire du 2026-07-31 §2), pas du
  code du chantier perdu.
- `.hud-topbar [data-hud='place'] { max-width:40vw; … }` (l.129-135) ; `≤560 : max-width:52vw`
  (l.264).
- `.gm-btn { z-index:131 }` (l.145-148).
- `.hud-topbar > .objective-banner { flex:1 0 100%; margin-top: calc(3 * var(--sp-md));
  pointer-events:none }` (l.154-166).
- `.stage > .party-dock` : `position:absolute; top:10px; left:50%; transform:translateX(-50%);
  z-index:45; --pd-corners:172px; max-width: calc(100vw - var(--pd-corners))` puis version
  `round(down, …, var(--pd-pitch))` (l.180-192). `[data-fiche] { z-index:126 }` (l.195-197).
- Media 700px : `.stage > .party-dock { top:6px }`, `.hud-rail { display:contents }`,
  `.hud-rail > .worldmap-btn { position:absolute; right:8px; bottom: calc(var(--sp-md) +
  var(--xd-row) + var(--sp-sm)); z-index:46 }` (l.205-222).
- Media 560px : `.stage > .party-dock { left:58px; max-width: calc(100vw - 66px) … }` (l.224-235),
  `.on { z-index:60 }` (l.238-240), `.on .pd-track { position:fixed; top:138px; left:4px; … }`
  (l.247-256), `.hud-rail > .worldmap-btn { right:4px; bottom: var(--sp-md) }` (l.260-263).

**Aucun** des tokens cités par le brief de reprise comme signature du code perdu
(`--pd-box-h`, `--rangee-champ`, `--cc-ouverture-top` en tant que variable du HUD-grille — la
variable existe mais dans `combat-console.css:102`, sans rapport avec le design de grille du HUD,
`--is-round-texte`, `subgrid` dans `hud.css`) n'est présent — confirmé par grep exhaustif (§ commande
ci-dessous).
- `--hud-frise-edge` / `--hud-frise-score-lo` : confirmés être des JETONS DE COULEUR
  (`src/ui/styles/base.css:250-251` : « bord sombre de la colonne de frise », « bas du badge
  d'Initiative posé en débord ») — le point 5 du brief demandait exactement cette vérification ;
  réponse : OUI, ce sont des couleurs, pas des placements.
- `--is-round-texte` : ABSENT de `main` (grep négatif) — n'a jamais atterri.

### `src/ui/styles/initiative-strip.css` (399 lignes)
- `top: 70px` (l.28) et `--is-avail: min(84cqh, calc(100cqh - 70px - var(--cc-phase-h) -
  var(--cc-phase-air) - 12px))` (l.114) : le littéral `70px` de la réserve du haut de la frise est
  DUPLIQUÉ tel quel dans `exploration-dock.css:80` (commentaire ligne 71 de ce fichier : « la réserve
  du haut de la frise (70px, initiative-strip.css), jamais un nombre recopié » — le commentaire
  affirme le contraire de ce que le code fait : le nombre EST recopié en trois sites, aucun jeton
  partagé).
- Couleurs de frise : `--hud-frise-edge` utilisé l.64,173,177,195,241 ; `--hud-frise-score-lo`
  l.232.

### `src/ui/styles/party-dock.css` (256 lignes)
- `.party-dock { display:flex; flex-direction:column; … --pd-tile:88px; --pd-gap:8px; --pd-pad:10px;
  --pd-edge: calc(var(--pd-pad)+1px); --pd-pitch: calc(var(--pd-tile)+var(--pd-gap)) }` (l.16-41).
  Portrait = 56px (commentaire l.27-31, `CHAR_SIZE_PX.md`) à TOUTE largeur — PAS de réduction à
  48/44px, pas de `@container` : la régression G2 pt.5/G3 pt.1 n'existe pas sur `main`.
- `.pd-track` : flex, `scroll-snap-type: x mandatory`, `overflow-x:auto` (l.44-57).
- Aucun `--pd-box-h` (grep négatif confirmé).

### `src/ui/styles/portrait-tile.css` (155 lignes) — non lu ligne à ligne en détail au-delà du grep
ci-dessus ; NON COUVERT en profondeur (temps du grounding).

### `src/ui/styles/combat-console.css` (1432 lignes, extraits pertinents)
- `--cc-cell-w: clamp(52px,4.9vw,96px)` / `--cc-cell-h: min(clamp(38px, calc(10.5vh - 41px), 72px),
  calc(var(--cc-cell-w)*0.75))` (l.32-33) — DEUX variables séparées largeur/hauteur (PAS le "côté
  carré unique" décidé par Q1 du 2026-09-24).
- `--cc-fronton: 52px` (l.58, littéral fixe, PAS `min(52px, 4.8vh)` décidé par Q2).
- `--cc-portrait: calc(var(--cc-cell-h) * 2.4)` (l.63) — toujours dérivé de la cellule, PAS de la
  hauteur d'écran (le défaut D3 « boucle portrait ∝ pont ∝ arche » n'est pas corrigé).
- `--cc-deck-h: calc(max(var(--cc-bay-h), var(--cc-arch-h) - var(--cc-fronton)) + 3px)` (l.78).
- `.cc-lbl` : PRÉSENT et actif (l.581, 599, 603, 1078 et dizaines d'assertions de test) — le retrait
  du libellé (Q1) n'est PAS appliqué.
- `.cc-set-n` : PRÉSENT (l.661, 669) — la suppression décidée en Q3 n'est PAS appliquée.
- `@media (max-width:900px)` : commentaire l.1123-1128 dit EXPLICITEMENT (verbatim, inchangé depuis
  la mesure du juge) : « La rangée à QUATRE régions reste arithmétiquement infaisable entre 701 et
  ~1080px (#1856, mesuré : 9 à 14 éléments hors fenêtre à 900 même avec des voies étanches) : c'est
  une COMPOSITION qui manque à cette tranche, pas un réglage de pistes. » — c'est exactement l'état
  PRÉ-décision que le juge du 2026-09-24 a tranché (Q1 : une seule rangée dès 701) ; le code n'a
  jamais suivi la décision.
- `@media (max-width:700px)` : régions EMPILÉES, `.cc-dock { display:flex; flex-direction:column }`
  (l.1149-1157) — pas la composition « arche en ligne + deux travées côte à côte » décidée en Q4.3.
- `@media (max-width:560px)` composition compacte inchangée (`--cc-cell-w:36px`, `--cc-cell-h:32px`,
  `--cc-fronton:0px`, `--cc-portrait:30px`, l.1199-1260).
- Arbitrage d'immobilité cité au commentaire : `.cc-end.pulse { … }` avec verbatim « je ne veux pas
  que la taille de l'interface ou les boutons bougent » (l.1106-1109, second site — le premier est
  `CombatConsole.tsx:52-53`).

### `src/ui/CombatConsole.tsx`
- l.51-53 : commentaire portant le verbatim d'immobilité (cf. §6) sur `LEFT_CELLS = TAILLE_ZONE.arsenal`
  (« Nombre de cases de chaque travée — GÉOMÉTRIE IMMUABLE »).
- `endNote`/`cc-key` (mécanique visée par C1/pt.7 de la décision console) : PRÉSENTS mais NON VÉRIFIÉS
  aux lignes précises 1121/1430 citées par la décision (le fichier a pu bouger depuis le
  2026-09-24 ; correspondance non recontrôlée ligne à ligne — signalé comme NON COUVERT en détail).

### `src/ui/CampaignView.tsx` (montage)
Tous les enfants de `.stage` sont montés en siblings directs, PAS via un `data-zone` :
- `<MondeDeCampagne />`, `<CombatStartSplash />`
- `<Row className="hud-topbar">` contenant `<GameMenu>`, `[data-hud='place']`,
  `<ObjectiveBannerMount />` (exploration seulement) (l.255-283)
- `<ExplorationDock …>` (exploration seulement, l.286-311), avec `journal={<LogDrawer … />}` en PROP
- modales diverses (`SaveLoadModal`, `SessionEndModal`)
- `<PartyDock heroes={dockHeroes} … />` (l.320, toujours monté)
- `<div className="stage-flot">` (l.325) contenant : `<InitiativeStrip …>` (combat), `<CombatBanner
  />` (combat, commentaire « fil SOUS la frise »), `<Stack className="hud-rail skin-bois">` (combat,
  contient le bouton dossier de navire + `<LogDrawer battle={…} journal={journal} />`),
  `<PovControls />` (exploration), `<DialogueBox />`, `<ActiveModal />` (l.325-410).
- `{mode === 'battle' && battle && <CombatConsole />}` (l.418, sibling direct de `.stage`, hors
  `.stage-flot`).

Couture croisée relevée : `ExplorationDock` reçoit son `journal` en PROP React (le `LogDrawer`
n'est PAS monté à la même place selon le mode — dans `.stage-flot > .hud-rail` en combat, comme
enfant de `.exploration-dock` hors combat) ; c'est `exploration-dock.css:64-68`
(`.exploration-dock .log-drawer { position:relative; inset:auto }`) qui reprend l'ancrage du tiroir
pour l'assoir sur le pont, alors que `log-drawer.css` (module propre, non lu en détail — NON
COUVERT) porte son ancrage par défaut.

### `src/ui/styles/exploration-dock.css` (107 lignes) — lu intégralement, cf. citations §ci-dessus :
`--xd-row:42px` (44px `pointer:coarse`), `--xd-deck-h: calc(var(--xd-row)+4px+var(--pont-liseret))`
(l.16-27) ; `.exploration-dock` PAS d'ancrage propre (« c'est la grille qui le pose », l.28-30) ;
`.xd-openers` (l.54-59) ; `.exploration-dock .log-drawer` (l.64-68) ; `.exploration-dock .ld-panel`
avec le littéral `70px` dupliqué (l.72-80, cité en entier ci-dessus).

### `src/ui/styles/log-drawer.css`, `src/ui/styles/combat-banner.css` (101 lignes, lu en entier
ci-dessus pour `.combat-feed` : `left:130px` l.12, `bottom: calc(var(--cc-phase-h) +
var(--cc-phase-air))` l.19, `z-index:46` l.27, `pointer-events:none` l.28) — `log-drawer.css` NON LU
en détail (NON COUVERT).

## 3. Tests verrouillant la géométrie

- `src/ui/CombatConsole.test.tsx` : 195 appels à `decl(...)`, 65 à `ruleOf(CC_BASE|CC_...)`.
  Représentatif : le test « P-1 — UN élément-pont unique … » (l.741-781) vérifie la relation
  structurelle `.stage { grid-template-rows }` / `grid-area` du pont / rangée du flot PAR SÉLECTEUR
  ET PAR RELATION (pas par valeur littérale figée) — motif conforme à ce que G2 pt.14 demandait
  (« un rendu jsdom qui vérifie `el.closest('[data-zone]')`… » n'est PAS ce motif exact, puisque
  `main` n'a pas de `data-zone`, mais le principe « relation, pas littéral » est déjà en place ici).
  De nombreuses autres assertions (l.1159,1170,1260,1264,1269,1280,1290,1299,1326,1332,1540,1687,
  1766,1775-1776,1830,1998,2589) lisent le CONTENU (`.cc-lbl` textContent, présence de `.cc-set-n`)
  — verrouillent le CONTENU affiché, pas une géométrie de layout à proprement parler, mais
  DEVIENDRAIENT fausses si Q1/Q3 (retrait des libellés, suppression de `.cc-set-n`) étaient
  appliqués tels quels sur `main`.
- `src/ui/ui-ratchets.test.ts` (1596 lignes) : porte les cliquets du classifieur CSS
  (`cssCouches.mjs`/`cssCouchesAudit`/`cssCouchesStock.mjs`), pas de littéral `data-zone` ni
  `is-round`. Lignes 1462-1482 : cliquets `CSS_IDENTITE_ECRAN_RATCHET`, `CSS_ESPACEMENT_RATCHET`,
  `STYLE_INLINE_RATCHET` (comparaison de STOCK, pas de texte de règle CSS).
- `src/ui/PartyDock.test.tsx` : grep de `56px|48px|44px|CHAR_SIZE` NÉGATIF — aucune assertion de
  taille en dur trouvée dans ce fichier (portrait 56px n'y est donc pas verrouillé par texte).

## 4. `scripts/recette/hud-clickables.mjs` (970 lignes) et `vues-recette.json`

`vues-recette.json` (5 lignes) : 3 vues seulement —
`{bureau:1707×780, portable:1366×650, mobile:360×740}` — PAS les 7 largeurs (1707/1366/1100/900/700/
560/360) évoquées dans les commentaires du ticket comme `VUE_REFERENCE`/`DEFAULT_WIDTHS` de la sonde
(celles-ci sont codées EN DUR dans `hud-clickables.mjs`, pas dans ce fichier JSON qui ne sert qu'aux
3 vues « de référence »).

`hud-clickables.mjs` :
- l.73 : `const HEIGHT = VUE_REFERENCE.hauteur;` (le brief citait `:75`, proche mais pas exact — dérive
  normale, le fichier continue d'être édité).
- l.664 : `export const BUDGET_PONT = { large: { des: 1280, part: 0.21 }, compact: { part: 0.45 } };`
  — AUCUN plafond entre 561 et 1279 (confirme le défaut D1 du juge du 2026-09-24 : « la plage
  561–1279 n'a aucun plafond »). Le budget décidé le 2026-09-24 (bande ≤17%, empreinte ≤22% dès 701,
  fronton compris) N'EST PAS appliqué.
- l.666-698 : `TUILE_MIN_PX = 44` (R-M1), `defautsMatriceGroupe` (l.676) — vérifie cartes rendues,
  défilement de secours, vie/nom par carte, vie superposée au portrait à 561-700, largeur mini 44px
  à ≤560.
- l.730-733 : vérifications du pont — bord à bord, `part = r.h / m.hauteur`, comparé à
  `BUDGET_PONT.large.part` (dès 1280px) et `BUDGET_PONT.compact.part` (≤560px) — la fonction
  `part` ne compte QUE la bande (`r.h`), pas fronton+bande (le défaut D1 « le fronton est exclu du
  calcul » n'est pas corrigé).
- l.745-762 (zone initiative/dock, proche des lignes 745-747 citées) : vérifications frise en
  colonne/bande selon tranche, Round premier, défilabilité, alignement sous le groupe à 561-700,
  entrées suivantes entières à ≤560 ; puis dock bord à bord et boutons entiers à l'écran.

## 5. `docs/charte-ui.md`

Section actuelle unique sur ce sujet : « Une réserve de pont se tient par le FLUX, jamais par une
valeur (#1848) », l.386-411 :
- l.388-390 : « Le bas du champ de l'écran de jeu est une **rangée de grille**, pas une pile
  d'ancrages : `.stage` est en `grid-template-rows: 1fr auto`, le PONT (console de combat ou pont
  d'exploration) EST la rangée basse, et toutes les surfaces qui s'ancrent au bas du champ vivent
  dans `.stage-flot`, la rangée du monde (`hud.css`). »
- l.391-392 : « Conséquence : `bottom: 0` y signifie « juste au-dessus du pont », et **aucune
  feuille ne lit plus la hauteur d'un pont pour s'en écarter**. »
- l.394-401 : critère de la question à poser devant tout `bottom:`, statut légitime de `--cc-saillie`
  et du bandeau de phase superposé, critère N+1 « ajouter une surface ancrée en bas doit coûter ZÉRO
  ligne de réserve ».
- l.403-408 : `container-type: size` sur `.stage-flot`, `cqh` sur la frise, doctrine
  `container`/`contain` = PLACEMENT.
- l.410-413 : preuve mécanique `scripts/recette/console-pont-formes.mjs`.

AUCUNE section sur une grille `data-zone` du HUD, ni sur le journal absolu borné `38vh`, ni sur la
réserve de 51px, ni sur les cotes de console 701-900 décidées le 2026-09-24 — ces contenus visés
par les défauts G3/G4/décision console n'ont jamais été écrits dans la charte de `main`.

`docs/plans/2026-08-16-spec-hud-combat.md` (684 lignes), citations demandées :
- l.24-34 (Zone 1, budget de hauteur, verbatim utilisateur 2026-08-17) : « avoir 1/4 de
  l'interface qui est une barre d'action, ça ne va pas etre possible, surtout avec tout ce vide et
  ces icones disproportionnés » ; contrats : hauteur du pont ≤~21% à ≥1280, cases PAYSAGE (~90×66 à
  1920, « jamais des carrés de 84px »), icône ≈moitié de la hauteur utile.
- l.60-76 (arbitrage mobile ≤560 + R-M1 à R-M4) : composition compacte ~40-45% (~280px) ; **R-M1**
  « Bandeau = le GROUPE seul … tuiles PLEINES à largeur minimale digne (portrait reconnaissable + PV
  lisibles, ≥44px) » ; **R-M2** « Aucun mot tranché, nulle part » ; **R-M3** « Tout élément rendu est
  ENTIER » ; **R-M4** « L'épinglage d'une capture = un HASH GIT RÉEL ».
- l.192 (zone Bandeau) : « **NOM VISIBLE SOUS LA TUILE** (la planche l'affiche en permanence —
  l'interdit « nom au survol » du contrat précédent TOMBE) ».
- l.215 : « **GRILLE (E)** : 12 cases (icône + libellé + touche + crans) + conduit AVANTAGE » — c'est
  la planche que la décision console du 2026-09-24 contredit partiellement (retour au carré sans
  libellé, modèle RT).
- l.25-26 / l.30-31 (cases PAYSAGE, jamais carrées) : citées par la décision console comme
  « dérivation d'ingénierie, révisable » (D4) contredite par le retour au modèle RT.
- l.172-176 : « Listes fermées — la **PLANCHE USER 2026-08-17** … fait foi sur la COMPOSITION (zones,
  géométrie, hiérarchie, ce que chaque zone MONTRE) ; son contenu détaillé n'a PAS valeur de règle »
  (verbatim 2026-08-17 : « Les icônes proposées n ont pas valeur de règle, cette spec n a pas toute
  notre historique »).
- l.229-240 (pont continu) : « **UN PONT CONTINU pleine largeur** … Le terrain n'est JAMAIS visible
  entre deux zones de console. » ; « **L'ARCHE est le FRONTON du pont** … »
- l.261-262 : « « X FAIT TOURNER » dans l'en-tête de travée (= la touche X commute les sets, pas un
  libellé) » — cité par la décision Q3 et par Q6 du juge du 2026-09-24.

## 6. Fiches mémoire d'arbitrage

- **Immobilité** (« je ne veux pas que la taille de l'interface ou les boutons bougent ») : PAS de
  fiche `.claude/memory/` dédiée (recherche par nom et par grep verbatim sur `.claude/memory`
  négative). Le verbatim ne vit que dans le CODE : `src/ui/CombatConsole.tsx:51-53` (commentaire sur
  `LEFT_CELLS`, arbitrage daté 2026-08-16) et `src/ui/styles/combat-console.css` (second site, règle
  `.cc-end.pulse`, même verbatim).
- **Tour adverse "jamais le pont entier"** :
  `.claude/memory/user-arbitrage-tour-adverse-console-spectatrice-jamais-pont-entier.md` — verbatim
  2026-08-24 : « D'ailleurs même au tour de l'adversaire, pourquoi je vois son pont entier ? Même RT
  ne fait pas ca » ; verbatim 2026-09-20 : « moi je voulais que cela n'affiche que cette partie sans
  les barres gauche et droite pour les ennemies et avant le début du combat » — « cette partie » =
  l'arche centrale. « How to apply » : forme spectatrice = arche seule, boîte de bande conservée,
  MATIÈRE éteinte, clic hors arche tombe sur le plateau.
- **R-M1/R-M2/R-M3** : PAS de fiche `.claude/memory/` dédiée — ce sont des règles numérotées DANS
  `docs/plans/2026-08-16-spec-hud-combat.md:66-76` (plan daté, pas une fiche mémoire), citées
  verbatim au §5 ci-dessus. R-M4 est au même endroit (l.77-79).
- Fiche connexe lue en entier :
  `.claude/memory/user-arbitrage-raison-de-refus-au-survol-jamais-inline.md` — verbatim 2026-08-24 :
  « Je n'ai jamais validé ces "textes" impossible a lire sous le nom des capacités, même Rogue
  Trader qui est notre interface de départ n'a pas un tel comportement. » « How to apply » : raison
  d'un slot désactivé dans l'infobulle de survol/focus avec `aria-describedby`, jamais en texte
  inline — vaut pour console, pastilles d'entité et frise. Citée par la décision console du
  2026-09-24 comme correction du défaut Q4.1.

## Non couvert (hors périmètre exécuté de ce grounding)

- `src/ui/styles/portrait-tile.css` et `src/ui/styles/log-drawer.css` : non lus intégralement.
- Correspondance ligne-à-ligne exacte entre les lignes citées par la décision console du
  2026-09-24 (`combat-console.css:538-539,540-542`, `CombatConsole.tsx:1121,1316,1335,1342,1430`,
  `item-icon.css:3`, `src/state/hotbarBridge.ts:11-12`) et l'état ACTUEL de `main` : seules les
  variables structurantes (`.cc-lbl`, `.cc-set-n`, `--cc-cell-w/h`, `--cc-fronton`, `--cc-portrait`,
  `BUDGET_PONT`) ont été vérifiées ; le contenu fin (icônes à 72%, commentaires faux ligne par
  ligne, `hotbarBridge.ts`) n'a pas été relu.
- `scripts/guards/lib/cssCouchesAudit.ts:208-210` (trou de garde « jeton local avec repli » cité en
  G4 pt.4) : non relu sur `main`.
- Contenu détaillé de `PortraitPicker` et ses 3 appelants (cité en G4 pt.1) : non exploré.
- `src/net/` et toute dimension coop pour ce HUD : non explorée.
- Aucun test exécuté (`npm test`/`typecheck`) — un `npm run gates` tourne déjà dans
  `/home/user/game/.wt-1806-L2` selon la consigne, aucune suite lancée de mon côté.
