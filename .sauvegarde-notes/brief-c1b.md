# Brief du codeur : console + HUD, lot C1b — verdicts de diff et d'écran sur le cumul H1b + C1 (#1806, #1856, #1919), 2026-09-29

## Worktree et interdits
`/home/user/game/.wt-1919-H2`, HEAD `fc2388866` (H1 commité) ; le cumul H1b + C1 est INDEXÉ (28 fichiers) : ne touche pas à l'index par git ; travaille par-dessus dans l'arbre. Interdits : tout `git checkout/restore/reset/stash/add/commit/apply`, écriture dans `node_modules`. Chemins absolus ; l'arbre principal reste propre. Serveur de dev et Chromium permis, un à la fois, bornés, tués par PID. Budget : **2 h 30** ; le reste NOMMÉ.

## Sources
Briefs : `/tmp/claude-0/-home-user-game/365ab83c-b2bf-5700-91e2-3605a34e86da/scratchpad/brief-c1.md`, `brief-h1b.md`, `brief-h1-1919.md` (invariants, décision d'écran, design) ; rendus `rendu-c1.md`, `rendu-h1b.md` ; décision `comments/41_2026-09-24T09:02:41Z.txt` ; VERDICTS : `juge-c1/verdict.txt` (diff, avec `sonde-coarse.mjs`) et `juge-vision-c1/verdict.txt` (écran, avec crops).

## Rouge de gate à faire tomber (npm test, `src/ui/css-valeur-en-test.test.ts`)
« Valeur de DESIGN épinglée sur du CSS lu […] `src/ui/CombatConsole.test.tsx:2217` — `expect(decl(ruleOf(CC_BASE, '.cc-arch-body'), 'height')).toBe('calc(var(--cc-arch-h) - var(--cc-arch-chrome))')` » → réécris en RELATION ou confie à la sonde (lis la garde pour la forme admise).

## Bloquants du juge de diff (verbatim ; corrections retenues)
- **B1** fil hors de sa zone `temps` à 700, dans la rangée `reserve` du bandeau de phase (chevauchement de 7,4 px aux pauses de Round) : « `temps` devient une grille à deux pistes : la frise en `minmax(0,1fr)` dans une enveloppe `container-type: size` (l'arrondi au pas d'entrée R-M3 est tenu), le fil en `auto` ; ou le fil reçoit sa propre zone ». Ajoute l'état « pause de Round » à la sonde et mesure l'intersection fil × `.cc-phase`.
- **B2** `@media (pointer: coarse) :root { --cc-cell: 44px }` court-circuite la formule unique (débord de la rangée +20 à +201 px de 701 à 1023, empreinte 25,7 % à 1366×650 tactile) : « la cible tactile devient un PLANCHER dans la formule, et la composition compacte se déclenche quand la rangée ne tient plus à ce plancher. F-1 et F-3 s'évaluent aussi sous coarse. » La sonde du juge (`juge-c1/sonde-coarse.mjs`) devient un test (sous souris ET sous coarse). Commentaires `combat-console.css:20-21`, `:222-223` vrais.
- **B3** ≤560 : pont 298 → 313 px (cases 36×36 contre « 36×32 » de la décision, table Q2), 48,2 % à 360×650 et 560×650, au-dessus du « ~40-45 % » (`spec:60-63`) ; F-5 (`CombatConsole.test.tsx:2143-2149`) passe à vide ; 561-700 sans plafond. Correction : la case ≤560 revient à 36×32 (ou l'écart est écrit ET tient 45 %) ; F-5 vérifie `--cc-deck-h / vh ≤ 0,45` à 360×650 et 360×740 ; un plafond chiffré pour 561-700 (voir A3) en test et en sonde ; `defautsMatrice` à toutes les hauteurs de `HAUTEURS_COUCHE` ; `hud-clickables.test.mjs:564` (« à 700, rien ») réécrit.
- **B4** nom tranché « Knud… » dans l'arche en ligne (561-700 et ≤560, « Klein Bürger » à 360) : « Le nom ne cède jamais par ellipse : il s'enroule au mot, et l'arche spectatrice prend la largeur de son contenu. » (R-M2)
- **B5** (H1b) la pose `ecran` de `.spectator-chip` a été retirée alors que `ActiveModal` est monté par QUATRE hôtes (`CampaignView.tsx:397`, `PartyScreen.tsx:597`, `MassBattleView.tsx:51`, `InterludeScreen.tsx:253`) : « la pose `ecran` reste un état de la primitive pour les hôtes sans couche HUD ; seule la zone `parole` la neutralise. » `spectator-chip.css:5-8` et la charte disent vrai ; la garde `ExplorationDock.test.tsx:383-420` ne voit que CampaignView : établis si elle doit couvrir les autres hôtes.

## Défauts du juge d'écran (verbatim, classe (a))
- **A1** au tour adverse à ≤700 l'arche saute (700 : [10, 546, 602×100] → [239, 680, 223×100]) : « la boîte reste, la matière s'éteint » (fiche tour adverse). La boîte de l'arche garde sa place et sa taille d'un tour à l'autre à toute largeur ; aussi B2 écran (Δx 42/42/30 px à 900/901/701, préexistant mais même classe : corrige).
- **A2** = B4.
- **A3** pont 561-700 à 30,3 % : le juge de diff juge « ≈19 % » infaisable (la travée seule = 16,4 % à 780) MAIS « environ 35 px de vide sont visibles sous la ligne (A-700, y≈615-650) » et `--cc-arch-ligne: 100px` est « une cote relevée à la main » → la ligne d'arche prend la hauteur de son contenu ; vise ≤ 25 % à 700×780 ; le plafond retenu est écrit (B3).
- **A4** portrait qui cède à la largeur (30 px à 701, 48 à 900, contre ≈ 66 visé par Q2 « se déduit de la HAUTEUR D'ÉCRAN ») : le juge de diff tient le plafond de largeur pour « acceptable […] c'est l'arithmétique F1 de la décision », mais le portrait de 30 px dans une arche de 164 px est un défaut visible ; tranche en mesure : le plancher du portrait vient d'abord de la hauteur, et c'est la case (plafond de largeur) qui cède, jamais le visage sous ≈ 48 px ; `combat-console.css:61` dit vrai.
- **A5** fil tranché au trait d'union (« Pierre- / de-Fer » à 701, « Pierre-de- / Fer. » à 640) — R-M2 : un nom propre composé ne se coupe pas (espace insécable ou `white-space: nowrap` sur le nom seul, le fil s'enroulant entre les noms).
- **A6** dalle sombre de la frise qui dépasse à 700 et 640 (la boîte de la frise prend la largeur du fil).
- **A7** cotes sous Q1 (1366×650 case 31,3, icône 18,8 contre ≈ 37) et bandes opaques vides à 1366 : vérifie la formule (37 et 194 relocalisés) contre la table de la décision, et dis l'écart restant.
- **A8** mineurs : coin « Fin du tour » collé au bord à 701 (liseré droit invisible) ; plaque X 13,6×8 px pâle (lisibilité) ; icônes des sets ≈ 10 px à 701.

## Restes du juge de diff à traiter dans le geste
- `!important` 5 → 7 dans `combat-console.css` (`width/height: 100% !important`, `:729-730`) : « `PortraitTile` accepte un mode « remplir » » — aucun `!important` neuf (consigne de Clément du 2026-09-20 : « L'application c'est un dépot de stock decroissant »).
- `--cc-bay-pad: var(--sp-md)` consommé par `.cc-bay` ; les constantes à synchroniser à la main (`--cc-bay-socle` 41, `--cc-arch-chrome` 59, `--cc-arch-flancs` 136, `--cc-arch-ligne` 100) deviennent la SOURCE que les règles consomment, ou sont dérivées.
- JSDoc de `defautsCouche` déplacée (`hud-clickables.mjs:709-716`) ; mutations S1-S4 rejouées sur le blob final.
- Fil à 701 comprimé dans ~57 px à côté de la frise, à 700 dessous : une seule composition de part et d'autre du seuil, ou la raison écrite.
- Commentaires au passé (« ne grave plus », « était le plus petit texte ») : au présent (règle 6).
Hors lot : touches « X » et « ESPACE » en dur alors que remappables (classe préexistante, ticket à ouvrir par l'orchestrateur) ; exception `items.ts` (#2141).

## Preuves et portes
- Mutation pour chaque test ou verdict de sonde neuf ; rejoue les mutations touchées sur les blobs FINAUX.
- Recette navigateur en joueur : vues 360×740, 360×650, 560×650, 640×780, 700×780, 701×780, 900×780, 1366×650, 1707×780 ; états A (tour du héros), C (tour adverse), pause de Round, journal ouvert ; au moins une vue sous émulation tactile (`pointer: coarse`, CDP `Emulation.setEmitTouchEventsForMouse` + `Emulation.setTouchEmulationEnabled`, ou media feature) à 768×1024 et 1366×650 ; captures `sha256sum` sous `scratchpad/c1b/` ; sonde brute (84 vues + coarse).
- `npm run typecheck:fast` ; vitest du périmètre + `src/ui/css-valeur-en-test.test.ts` ; `node --test scripts/recette/*.test.mjs` touchés ; stock `--check` + ventilation contre `fc2388866` (APPARU 0) ; eslint ; `npm run docs:build` puis `npm run docs:check`.

## Livrable
`/tmp/claude-0/-home-user-game/365ab83c-b2bf-5700-91e2-3605a34e86da/scratchpad/rendu-c1b.md` (+ `scratchpad/c1b/`) + résumé factuel.
