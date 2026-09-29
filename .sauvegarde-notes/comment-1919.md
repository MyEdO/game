## Reprise du HUD en grille après perte, lot H1 — brief du codeur (2026-09-28)

Constat : le travail G2-G5 (worktrees `wt/1919*`) na## Invariant
- Design retenu (#1919, commentaire 5804334389, 2026-09-23), verbatim : « **Le pont se dimensionne seul ; le HUD vit dans ce qui reste, et n'en sort pas.** Le plateau `.stage` porte deux rangées : `[flot] minmax(0, 1fr) [pont] auto`. Le pont (console de combat ou pont d'exploration) est la rangée `pont`, à la hauteur qu'il fait. Rien au-dessus de lui ne peut le pousser, puisqu'une piste `minmax(0, 1fr)` ne pousse pas une piste `auto`. La couche HUD `.stage-flot` est une grille à ELLE, posée dans `flot`, avec `[haut] auto [bande] auto [champ] minmax(0, 1fr) [reserve] …`, `min-height: 0` et `overflow: clip`. Chaque surface y déclare sa zone (`data-zone`), et le bandeau d'ouverture devient l'une d'elles, à la rangée `champ`, monté par la couche. Une surface de plus coûte une ligne de `grid-template-areas` et un `data-zone`, et aucune hauteur n'est lue. […] Aux vues de référence (1707×780, 1366×650, 360×740) et aux seuils 900/700/560, HUD et pont tiennent ensemble, grâce au BUDGET du pont et non à une cession de la grille. »
- Question à laquelle il répond : qui possède la hauteur de l'écran quand le HUD et le pont se la disputent ?
- Phrase de charte retenue, verbatim, qui REMPLACE la section concernée de `docs/charte-ui.md` : « `.stage` porte deux rangées, `[flot] minmax(0, 1fr) [pont] auto`. La couche HUD est une grille propre posée dans `flot` ; elle borne son débordement (`overflow: clip`) et porte seule les rangées `haut`/`bande`/`champ`/`reserve`. Le pont ne lit ni ne subit aucune rangée du HUD, et sa hauteur est tenue par son budget, à chaque tranche. »
- Critère N+1 : une surface de plus au HUD = une ligne de `grid-template-areas` + un `data-zone`, aucune hauteur lue.
- Arbitrage d'immobilité, verbatim (`src/ui/CombatConsole.tsx:51-53`) : « je ne veux pas que la taille de l'interface ou les boutons bougent » — la réserve de phase est payée pendant tout le combat (décision G3, verbatim dans le grounding).
- Consigne de Clément (2026-09-20, #1806), verbatim : « L'application c'est un dépot de stock decroissant. Surtout que c'est toi qui a mis ces !important il y a quelques jours » : aucun `!important` neuf, aucun registre neuf, stocks CSS en décroissance.
- Délégation de l'utilisateur (2026-09-28), verbatim : « Franchement ce n'est pas mon truc les interfaces, je te laisse decider » : les choix de mise en page sont des évaluations d'ingénierie révisables ; en cas de doute, l'état de l'art (Rogue Trader, doctrine `.claude/memory/user-doctrine-reference-rt-par-defaut-deviation-validee.md`).

## Cas canonique déjà couvert
`.stage { grid-template-rows: 1fr auto }` (`src/ui/styles/hud.css:27-34`, #1848, `8fe2a96eb`) : le pont est déjà la rangée `auto` du bas et ne lit aucune hauteur du HUD. La couche `.stage-flot` (`hud.css:44-56`) est la rangée du haut, mais ses surfaces s'y posent encore en `position: absolute` avec littéraux (`.hud-topbar` `:103-120`, `.party-dock` `:180-197`, `.pov-controls` `:65-73`, `.hud-rail` `:82-98`, media `:205-263`). Preuve d'instance à rendre : chaque surface du HUD passe de « absolue à des littéraux » à « une zone de la grille de la couche », sans branche par surface.

## Design jugé :
Juge de design du 2026-09-23 (#1919, commentaire 5804334389) : candidat (b) « gabarit unique, rangées du HUD en `minmax(0, auto)` : NE TIENT PAS » ; candidat (a) « couche imbriquée : la bonne ossature, à deux conditions : la couche borne son débordement (`overflow: clip`) […] le bandeau d'ouverture devient une zone de la couche ». Juges de diff G3 (5805158682) et G4 (5805889646) : critères repris ci-dessous.

## Travail, dans cet ordre
1. **La grille de la couche** : `.stage-flot` en grille à rangées nommées `haut`/`bande`/`champ`/`reserve`, `min-height: 0`, `overflow: clip` ; chaque surface déclare `data-zone` et se place par `grid-area` (topbar : contexte/lieu/objectif et menu ; groupe ; frise d'initiative ; bandeau d'ouverture ; rail d'outils ; contrôles de caméra ; journal) ; seules les `grid-template-areas` varient par largeur (900/700/560), jamais un gabarit de rangées recopié (G2 pt.11). Monte chaque surface dans la couche depuis `src/ui/CampaignView.tsx` (grounding §2) ; les primitives de mise en page (`Stack`/`Row`/`Grid`, `docs/primitives.md`), jamais un conteneur nu.
2. **Aucune géométrie lue d'une autre surface** : le `70px` recopié trois fois (`initiative-strip.css:28,114`, `exploration-dock.css:80`), `.hud-rail > .worldmap-btn` qui lisait la géométrie du voisin (G2 pt.9), `max-width: calc(50vw - 160px)` de la topbar, `--pd-corners: 172px`, `left: 58px`, `top: 138px`… : chaque littéral de placement disparaît au profit de la grille ; établis pour chacun (grounding §2) s'il vit encore sur `main`.
3. **Portée** : les règles du groupe sont portées par la zone (`[data-zone='groupe'] > .party-dock`, G2 pt.10) ; le `z-index` du groupe au-dessus du voile de la fiche reste, justifié par #1829.
4. **Réserve de phase** : payée pendant tout le combat (arbitrage d'immobilité, verbatim ci-dessus), une seule lecture (G2 pt.11).
5. **Portraits** : de 561 à 900, portraits de la base (56 px) ; ≤ 560, R-M1 (`spec:66-67`, « PV lisibles, ≥44px ») avec le chiffre de Blessures lisible (`spec:192`) ; le chiffre ne s'étend pas aux tuiles `sm` (G4 pt.1).
6. **Journal** : au-dessus de 700, choisis entre flux (une zone) et panneau ancré, et donne la raison vraie (G4 pt.3 : « Mis dans le flux, il ne déplace pas le groupe à 1366 et 1707 ; la citation d'immobilité porte sur le compte de cases, pas sur un panneau ouvert par le joueur ») ; aucun Anchor Positioning CSS sans repli (brief G pt.7 : non pris en charge par Firefox ESR 140 ni Safari < 26) — la voie de flux est préférée si elle tient.
7. **Tests** : tout test qui verrouille l'ancienne géométrie par TEXTE CSS se réécrit en « la surface déclare sa zone » (`el.closest('[data-zone]')?.dataset.zone`, rendu jsdom) ; la géométrie relève de la sonde (G2 pt.14, G2 pt.7) ; cite chaque test réécrit (grounding §3).
8. **Sonde** `scripts/recette/hud-clickables.mjs` étendue (design, « Preuve mécanique ») : 3 hauteurs × 7 largeurs × 4 états (exploration, ouverture, tour de héros, spectateur) ; pont posé au bas de l'écran, plateau sans débordement, commandes du pont et du HUD atteignables ; tour spectateur par le vrai geste (G4 pt.5, jamais `store.setState`) ; `rpc` sur socket fermée qui ne règle jamais sa promesse (`lib.mjs`, G3 pt.4) : vérifie sur `main` et corrige s'il est là.
9. **Charte** : la phrase retenue remplace l'ancienne (`docs/charte-ui.md:386-411`) ; commentaires périmés des feuilles touchées mis au présent, à réf nue (règle 6).

Hors de ce lot (lot console suivant) : forme de la console, budget du pont à 561-1279, fronton, cases carrées. Si la grille révèle un recouvrement pont/HUD à une vue de référence, MESURE-le et rends-le (c'est l'entrée du lot console), sans coder la console.

## Preuves (obligatoires)
- Mutation pour chaque test neuf ou réécrit (empreintes `git hash-object`, rouge nommé, remise identique).
- Recette navigateur en joueur (`docs/recette-navigateur.md`), console 0 erreur : exploration et combat (tour de héros, tour adverse), aux vues 360×740, 700×780, 900×780, 1366×650, 1707×780 ; clic dans une zone vide → le monde le reçoit ; journal ouvert/fermé ; captures avant (sur `chantier/1806`, tête `20b8afba5`) et après, `sha256sum` de chacune, sous `scratchpad/h1/`.
- Sortie brute de la sonde étendue.

## Portes (sortie brute, code sans pipe)
`npm run typecheck:fast` ; `npx vitest run --no-cache` sur les tests du périmètre (CampaignView, CombatConsole, ExplorationDock, PartyDock, InitiativeStrip, ObjectiveBanner, LogDrawer, `ui-ratchets`, `css-modules-guard`, `primitive-owners-guard`, `comment-poison-guard`, et tout importeur de test d'un fichier touché, liste par `git grep -l`) ; `node --test scripts/recette/*.test.mjs` touchés ; stock CSS `npx tsx scripts/guards/lib/regenStock.mts scripts/guards/lib/cssCouchesAudit.ts --check` puis la ventilation (`npx tsx scripts/ui/ventilation-css-couches.mts 20b8afba5`, APPARU 0) ; eslint ; `npm run docs:build` puis `npm run docs:check`. L'orchestrateur joue ensuite toutes les gates.

## Livrable
`scratchpad/rendu-h1-1919.md` (+ `scratchpad/h1/`) : diff stat ; chaque point 1-9 fait/reste avec preuve ; mutations ; captures + sha256 ; sortie de la sonde ; portes ; processus.

---
_Generated by [Claude Code](https://claude.ai/code)_
