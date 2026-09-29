# Brief du codeur : console de combat, lot C1 — la géométrie de la décision d'écran du 2026-09-24 (#1806, #1856), 2026-09-28

La décision d'écran de la console (#1806, commentaire du 2026-09-24T09:02 « Console de combat : décision d'écran, tranchée par l'état de l'art ») a été jugée sur un instantané perdu (`03ddd90ce`, jamais poussé) : ses `fichier:ligne` visent CET instantané. Sur `main`, rien n'en est appliqué (grounding : `combat-console.css:32-33` deux variables `--cc-cell-w`/`--cc-cell-h`, `:58` `--cc-fronton: 52px` fixe, `.cc-lbl` et `.cc-set-n` présents, `:1123-1128` composition sur deux rangées, `hud-clickables.mjs:664` `BUDGET_PONT` sans plafond 561-1279). **Relocalise chaque couture sur l'arbre** avant de coder, `fichier:ligne` rendu.

Ce lot part dans le MÊME train que le HUD en grille (#1919, H1+H1b) : le juge de diff de H1 conditionne sa publication au budget du pont de 561-700 (Q4.3).

## Worktree et interdits
`/home/user/game/.wt-1919-H2`, branche `wt/1919-H2` ; H1 commité (`fc2388866`), H1b commité ou dans l'arbre selon l'état au lancement (l'orchestrateur te le dira) ; ton travail = `git diff HEAD` + non suivis. Interdits : tout `git checkout/restore/reset/stash/add/commit/apply`, écriture dans `node_modules`. Chemins absolus ; l'arbre principal reste propre. Serveur de dev et Chromium permis, un à la fois, bornés, tués par PID. Budget : **2 h 30** ; le reste NOMMÉ.

## Sources
- La décision, verbatim : `/tmp/claude-0/-home-user-game/365ab83c-b2bf-5700-91e2-3605a34e86da/scratchpad/comments/41_2026-09-24T09:02:41Z.txt` (LIS-LA EN ENTIER : Q1, Q2, Q3, Q4, « Coutures à changer », « Planche »).
- Grounding du HUD et de la console sur `main` : `scratchpad/grounding-1919.md` (§1 « Décision d'écran », §2 `combat-console.css`, §3 tests, §4 sonde).
- Verdict F8 (`scratchpad/comments/35_2026-09-24T07:18:39Z.txt`) : défaut 1 (extinction spectatrice bornée à ≥701).
- `docs/plans/2026-08-16-spec-hud-combat.md` (`:24-34`, `:58`, `:60-79`, `:172-176`, `:215`, `:220-221`, `:229-240`, `:261-262`), `docs/charte-ui.md` (`:682` « icône + libellé + touche »), fiches `.claude/memory/user-arbitrage-tour-adverse-console-spectatrice-jamais-pont-entier.md`, `user-doctrine-reference-rt-par-defaut-deviation-validee.md`, `user-doctrine-etat-de-lart-avant-invention.md`.

## Invariant
- Budget, Clément 2026-08-17, verbatim (`spec:25-26`) : « avoir 1/4 de l'interface qui est une barre d'action, ça ne va pas etre possible, surtout avec tout ce vide et ces icones disproportionnés ».
- Décision Q2, verbatim : « le fronton COMPTE dans le budget. Hauteur du fronton = `min(52px, 4.8vh)` […] Bande ≤ 17 % et empreinte totale (bande + fronton) ≤ 22 %, à toute vue ≥701. La hauteur du coin suit les cases : 2 × case + écart, au lieu de 106 px fixes. Le portrait se déduit de la HAUTEUR D'ÉCRAN (une donnée d'entrée), jamais du pont ».
- Immobilité (`CombatConsole.tsx:51-53`), verbatim : « je ne veux pas que la taille de l'interface ou les boutons bougent » — les nombres de cases sont fixes, la géométrie ne dépend que de la fenêtre.
- Tour adverse, Clément 2026-08-24, verbatim : « D'ailleurs même au tour de l'adversaire, pourquoi je vois son pont entier ? Même RT ne fait pas ca » — la boîte reste, la matière s'éteint, le clic passe au plateau.
- R-M2 (`spec:71-74`) « Aucun mot tranché, nulle part » ; R-M3 (`spec:75-76`) « Tout élément rendu est ENTIER ».
- Délégation de l'utilisateur (2026-09-28), verbatim : « Franchement ce n'est pas mon truc les interfaces, je te laisse decider » ; et « Je compte sur toi ». La décision d'écran est une évaluation d'ingénierie jugée ; les cases carrées sans libellé s'écartent de la planche du 2026-08-17 (« 12 cases (icône + libellé + touche + crans) », `spec:215`) par la doctrine RT du 2026-08-24 : `docs/plans/2026-08-16-spec-hud-combat.md:215` et `docs/charte-ui.md:682` se corrigent dans ce lot pour dire vrai.

## Cas canonique déjà couvert
La forme ≤560 (`combat-console.css`, bloc `@media (max-width: 560px)`, arche en une ligne) et la formule de côté de case : Q4.3 étend la forme de l'arche en ligne à 561-700 avec les travées côte à côte ; Q1 applique UNE formule de côté de 701 à 1279 (« aucune cassure entre 900 et 901 »). Preuve d'instance à rendre : aucune tranche n'a sa propre géométrie codée à la main, une formule par propriété, bornée par la fenêtre.

## Design jugé :
Décision d'écran du 2026-09-24 (workflow d'état de l'art `wf_181221d7-02e` : état de l'art RT, état de l'art du genre, deux designs, un juge qui tranche), recopiée dans `comments/41_…`. Les corrections de faits du juge (D1-D6, F1-F2, C1-C6) font partie du design.

## Travail (dans cet ordre)
1. **Q1** : de 701 à 1279, une seule rangée (ordre : sets, arsenal 2×3, accès rapide 2×2, arche en fronton, grille 2×6, « Fin du tour ») ; côté de case UNIQUE = `min((0,17 × hauteur − 37) / 2 ; (largeur − largeur de l'arche − 194) / 11,62)` (relocalise 37 et 194 sur les vraies variables : conduit, marges, écarts, coin) ; cases carrées SANS libellé (`.cc-lbl` meurt, le nom va dans l'infobulle et dans `aria-label`) ; icône = 60 % du côté ; touche imprimée ; case vide = vitre nue. La composition sur deux rangées (`combat-console.css:1123-1128` et environs) meurt, avec son commentaire.
2. **Q2** : `--cc-fronton: min(52px, 4.8vh)` ; coin = 2 × case + écart (plus de `--cc-end-h: 106px` fixe) ; portrait tiré de la hauteur d'écran (sans boucle portrait ∝ pont ∝ arche) ; bande ≤ 17 % et total ≤ 22 % à toute vue ≥ 701.
3. **Q4.3** : de 561 à 700, arche en une ligne + deux travées côte à côte, cases ≈ 40 px, pont ≈ 19 % ; « La frise verticale de RT jusqu'à 561 px » : aligne les aires de la couche HUD sous 700 (le juge de H1, R8 : « Q4.3 garde la frise verticale jusqu'à 561 px : le lot console devra déplacer ce bloc d'aires sous 560 »). Mesure qu'à 700×780 le fil et la frise ne sont plus rognés.
4. **Q4.2** : l'extinction spectatrice s'applique à toute largeur (aujourd'hui bornée à `@media (min-width: 701px)`), la boîte reste.
5. **Q3** : `.cc-set-n` meurt (vignettes vides comprises) ; la touche X quitte la vignette du set tenu et devient UNE plaque-flèche gravée dans l'en-tête de la travée, style `.cc-key` ; clic direct conservé ; à ≤560, elle se replie avec le commutateur.
6. **Q4.7** : « Fin du tour » affiche toujours ESPACE ; l'avertissement « Action non dépensée » passe par l'état armé (« Finir quand même ») et l'infobulle.
7. **Sonde** `scripts/recette/hud-clickables.mjs` : `BUDGET_PONT` → bande 0,17 et empreinte 0,22 appliqués dès 701 ; `part` = (bande + saillie du fronton) / hauteur ; à ≤560, le budget compact existant.
8. **Docs et commentaires** : `docs/charte-ui.md:682`, `spec:31`, `:215`, `:220-221` disent vrai ; le commentaire qui attribue « jamais un carré » à l'utilisateur (`combat-console.css:21-23` sur l'instantané) meurt ; `src/state/hotbarBridge.ts:11-12` commentaire faux (F8) ; le commentaire « excuse » renvoyant à #1806 (F8).
Hors lot (C2) : infobulle de refus courte au-dessus du liseré (Q4.1), bandeau du groupe en vitre (Q4.5), frise sans vignette coupée (Q4.6).

## Preuves (obligatoires)
- Tests réécrits depuis la décision (pas le texte CSS : relation et sonde) ; mutation pour chaque test neuf ou réécrit.
- Recette navigateur en joueur, console 0 erreur (préexistante `items.ts:708` nommée) : vues 1707×780, 1366×650, 901×780, 900×780, 701×780, 700×780, 640×780, 360×740 ; états A (tour du héros : 3 sets dont un vide, case vide intercalée, action non dépensée), B (refus au survol et au focus), C (tour adverse) ; captures `sha256sum` sous `scratchpad/c1/` ; sortie brute de la sonde, avec à chaque vue : bande %, total %, côté de case et d'icône px, portrait px, nombre de rangées.

## Portes (sortie brute, code sans pipe)
`npm run typecheck:fast` ; vitest du périmètre (CombatConsole et ses importeurs, CampaignView, ExplorationDock, `ui-ratchets`, `comment-poison-guard`, `css-modules-guard`, `primitive-owners-guard`, `console-no-title-only`) ; `node --test scripts/recette/*.test.mjs` touchés ; stock `--check` + ventilation (APPARU 0) ; eslint ; `npm run docs:build` puis `npm run docs:check`.

## Livrable
`/tmp/claude-0/-home-user-game/365ab83c-b2bf-5700-91e2-3605a34e86da/scratchpad/rendu-c1.md` (+ `scratchpad/c1/`) : coutures relocalisées ; chaque point fait/reste avec preuve ; mutations ; captures + sha256 ; sonde ; portes ; processus.
