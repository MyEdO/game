# Brief du codeur : HUD en grille, lot H1b — corrections des juges de diff et d'écran (#1919), 2026-09-28

## Worktree et interdits
`/home/user/game/.wt-1919-H2`, branche `wt/1919-H2`, HEAD `fc2388866` (lot H1 commité, poussé sur `chantier/1919`), arbre propre ; ton travail = `git diff HEAD` + non suivis. Interdits : tout `git checkout/restore/reset/stash/add/commit/apply`, écriture dans `node_modules`. Chemins absolus ; l'arbre principal reste propre. Serveur de dev et Chromium permis, un à la fois, bornés, tués par PID. Budget : **1 h 45**. Outils `mcp__lean-ctx__*` possiblement absents : Bash et Write.

## Sources
Brief H1 (invariant, design, cas canonique) : `/tmp/claude-0/-home-user-game/365ab83c-b2bf-5700-91e2-3605a34e86da/scratchpad/brief-h1-1919.md` ; ton rendu H1 : `scratchpad/rendu-h1-1919.md` ; verdicts : `scratchpad/juge-h1/verdict.txt` (diff) et `scratchpad/juge-vision-h1/verdict.txt` (écran) ; captures `scratchpad/h1/{avant,apres}/`.

## Invariant (rappel, verbatim du design du 2026-09-23)
« Le pont se dimensionne seul ; le HUD vit dans ce qui reste, et n'en sort pas. […] Aux vues de référence (1707×780, 1366×650, 360×740) et aux seuils 900/700/560, HUD et pont tiennent ensemble, grâce au BUDGET du pont et non à une cession de la grille. » R-M2 (`docs/plans/2026-08-16-spec-hud-combat.md:71-74`) : « Aucun mot tranché, nulle part ». R-M3 (`:75-76`) : « Tout élément rendu est ENTIER ».

## Défauts à corriger (verbatim des verdicts)
Du juge d'écran :
- **A1** « 360×740, vue de référence, exploration : le lieu est perdu. Avant : « Du Sang sur la Route — scène… ». Après : « Du S… ». La zone `contexte` fait 91,8 px de large, dont 42 px pour ☰ ». **A2** même classe à 700 (« Du Sang sur l… »). → la zone `contexte` reçoit la place que le lieu exige (R-M2 : coupe au mot au pire, jamais « Du S… »), sous les aires de ≤700.
- **A3** « 360×740, vue de référence, journal de combat ouvert : il recouvre la frise et le fil […] Commandes inatteignables dans `mesures.json` : 4 avant, 9 après […] Avant, le panneau vivait dans le champ (y 221..386) et restait lisible. » → au moins à ≤700, le panneau du journal ne recouvre ni la frise ni le fil (il vit dans le champ, ou ailleurs de mesuré) ; « le journal ouvert ne déplace rien » reste vrai.
- **A4** « 900×780, seuil, exploration : l'objectif sort de sa zone. La zone `temps` va de x 8 à 243 ; l'objectif va de x 8 à 368,7. Il passe sous le groupe (z-index 45) et son texte est coupé […] La sonde ne le détecte pas : elle ne juge que le rognage par la couche, jamais le débord d'une zone ni le recouvrement entre surfaces. » → l'objectif tient dans sa zone (ou sa zone grandit) ; ET la sonde `hud-clickables.mjs` gagne deux verdicts de CLASSE : **débord d'une surface hors de sa zone** et **recouvrement entre deux zones**, jugés sur les 84 vues.
- **A5** (fil perdu à 700 sous un pont de 575 px) : NE PAS corriger dans la couche (juge de diff, B3 : « La couche ne doit pas garantir le fil […] Le correctif est celui du lot console, Q4.3 ») ; mesure seulement, après tes corrections, ce qui est rogné à 700 (entrée du lot console).
Du juge de diff :
- **B1** `docs/charte-ui.md:400-401` affirme « Aucune surface ne s'ancre en absolu à des littéraux » et « Le seul hors-flux de la couche est le volet déplié » ; contre-preuves : `.dialogue-box` (`components.css:619-622`, absolu, `bottom: 18px`, monté dans `.stage-flot`), `.spectator-chip[data-pose='ecran']` (`spectator-chip.css:21-26`, via `ActiveModal.tsx:76`), `.ld-panel` (`log-drawer.css:38`). « Correction : donner une zone à la conversation et à la puce. Sinon, la charte les nomme comme exceptions et la garde couvre leurs feuilles. » → donne-leur une zone (critère N+1) ; la garde « couche HUD » de `ui-ratchets.test.ts` couvre toutes les feuilles des enfants de `.stage-flot`, pas seulement `hud.css`.
- **B2** `src/ui/styles/combat-banner.css:6` nomme la zone `champ` : c'est `temps`.
- **R1** la phrase de charte « seuls la barre haute, le rail et le groupe dimensionnent les colonnes » est fausse pour la barre haute (`contain: inline-size`) → la charte dit vrai après A1.
- **R2** « `BandeauDOuverture` teste `estOuverture(s) && !s.battle?.over`, la console `estOuverture` sans `over`. Il faut mettre `over` dans `estOuverture`, ou nulle part. »
- **R4** la charte attribue au « flux » les 152 px de descente du bouton, alors qu'ils viennent de l'ordre du DOM (`LogDrawer.tsx:25-45`) → la phrase dit la vraie cause.
- **R5** `pointer-events` en double (`.hud-topbar` contre `:where(.stage-flot > [data-zone] > *)`) → une règle.

## Portes et preuves
- Mutation pour chaque test ou verdict de sonde neuf (le débord et le recouvrement : un placement fautif réintroduit rougit la sonde).
- Recette navigateur en joueur, console 0 erreur (l'erreur préexistante `src/engine/items.ts:708` `unloadWeapon` exceptée, nomme-la) : captures APRÈS des vues des défauts A1-A4 (360, 700, 900 ; exploration, journal ouvert), `sha256sum`, sous `scratchpad/h1b/` ; sortie brute de la sonde étendue.
- `npm run typecheck:fast` ; vitest du périmètre (tests touchés et importeurs, `ui-ratchets`, `comment-poison-guard`, `css-modules-guard`, `primitive-owners-guard`) ; `node --test scripts/recette/*.test.mjs` touchés ; stock `--check` et ventilation contre `fc2388866` (APPARU 0) ; eslint ; `npm run docs:build` puis `npm run docs:check`.

## Livrable
`/tmp/claude-0/-home-user-game/365ab83c-b2bf-5700-91e2-3605a34e86da/scratchpad/rendu-h1b.md` + résumé factuel.
