# REPRISE — HUD en grille (#1919) + console de combat (#1806, #1856), état au 2026-09-29

## Où est le travail (tout est sur le dépôt distant)
- `main` : infobulle R-M2 (lot A) publiée (`27f8e426d`).
- `chantier/1919` = `b0f2f1499` : H1 (HUD en grille) + H1b + C1 (console, décision d'écran du 2026-09-24), COMMITÉS, jugés À REPRENDRE. NE SE PUBLIENT PAS SEULS.
- `sauvegarde/1919-c1b` : instantanés (auto toutes les 10 min) de l'arbre du worktree `.wt-1919-H2` par-dessus `b0f2f1499` (lots C1b, C1c, C1d en cours, NON JUGÉS), plus `.sauvegarde-notes/` = ce scratchpad (briefs, verdicts, sondes, rendus).
  Reprendre : `git fetch origin sauvegarde/1919-c1b && git worktree add .wt-1919 origin/chantier/1919 && cd .wt-1919 && git checkout origin/sauvegarde/1919-c1b -- . ':!.sauvegarde-notes'` (le contenu d'arbre = cumul non jugé), puis `npm ci`.

## Chaîne des lots (briefs dans `.sauvegarde-notes/`)
brief-h1-1919 → brief-h1b → brief-c1 → brief-c1b → brief-c1c → brief-c1d (en cours au moment de la sauvegarde).
Verdicts : `juge-h1/`, `juge-vision-h1/`, `juge-c1/`, `juge-vision-c1/`, `juge-c1b/verdict.txt`, `juge-vision-c1b/verdict.txt`.

## Décisions prises (évaluations d'ingénierie sous délégation, révisables)
Délégation de Clément, 2026-09-28 : « Franchement ce n'est pas mon truc les interfaces, je te laisse decider » ; « Je compte sur toi ».
- Nom de l'arche : deux lignes réservées, coupe au mot seulement (primitive `Nom`, `coupeAuMot`), nom complet en `aria-label`/infobulle.
- Doigt : cible 44 px prime (`charte-ui.md:95`) ; plafonds au doigt ≤700 : 0,48 ; 701-900 : 0,30 ; ≥901 : empreinte 0,22 (le fronton cède). Souris : 0,17/0,22 dès 701, 0,25 à 561-700, 0,45 à ≤560.
- Portrait : la case cède avant le visage.
- Écart Q1 (case 33,3 px à 1366×650 contre ≈ 37) accepté et écrit dans la spec ; bande pleine largeur maintenue (arbitrage « UN PONT CONTINU », spec:229-240, 2026-08-17).
- Journal à ≤700 dans le champ ; groupe à 561 sans recouvrement ; N5 : scroll-snap, bord bas d'un conteneur qui défile = affordance.

## Reste à faire
1. Finir C1d (brief-c1d.md) jusqu'à sonde `hud-clickables.mjs` verte (3 passes identiques).
2. `npm run gates` (24 gates), juge de diff + juge d'écran sur le cumul, commit sur `chantier/1919` (JUGE/REFUTATION/JUGE-VISION, CLIQUET éventuels), puis publication (`npm run ops:publier -- --detache` depuis une branche de chantier) : HUD + console dans le MÊME train.
3. Lot C2 (Q4.1 infobulle de refus courte, Q4.5 bandeau du groupe en vitre, Q4.6 frise sans vignette coupée).
4. Tickets hors lot : #2142 (touches en dur), #2146 (touches gravées trop petites), #2141 (`items.ts:708`) ; à solder/mesurer dans le lot : #2101, #1833, #1856.
