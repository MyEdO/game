# Rendu C1d — console + HUD, finir C1c jusqu'à une sonde verte (#1806, #1856, #1919), 2026-09-29

Worktree `/home/user/game/.wt-1919-H2`, HEAD `b0f2f1499`, aucun geste git. Arbre principal : `git status --short` vide (0 ligne) au rendu.
Preuves sous `scratchpad/c1d/`. Budget : ~1 h 30 consommée (04:38 → 06:08).

## Sonde finale : 3 passes, sorties identiques, 20 défauts restants, tous d'une classe antérieure au lot

- `c1d/sonde-passe{1,2,3}.txt` : 762 lignes chacune, sha256 identique `b66bb083b1178c2acb19317f77919b4d9250c5a7ead7cdcf0da7fe651e65141d` ; `diff` 1-2 et 1-3 vides (`c1d/diff-1-2.txt`, `c1d/diff-1-3.txt`, 0 ligne). rc = 1 aux trois (`c1d/sonde-passe*.rc`).
- Blobs de l'arbre au lancement : `c1d/blobs-finaux.txt` (41 fichiers) ; revérifiés identiques après la passe 3.
- Classement (`c1d/sonde-passe1.classes`) : **202 défauts (C1c) → 20**. Il n'en reste que deux classes, les deux dans la matrice §12 du GROUPE :
  - 16 × « la vie de la carte N du groupe n'est pas superposée à son portrait » (561-700 ; exploration 700, combat ×… 700) ;
  - 4 × « la carte du groupe fait 88px, pas plus compacte que 88px à 1707px » (701-900 et 561-700).
  **Raison** : elles ne viennent pas de C1d. Le même compte (32 lignes « superposée » / 8 « compacte », verdict répété) se trouve déjà dans `juge-c1b/hud.txt`, dans `c1c/sonde-rouge-1.txt` et dans `c1c/sonde-finale.txt`. La tuile de `PartyDock` n'a aucune composition à 561-700 (vie posée sur le portrait) ni de carte compacte à 701-900 : ce sont des cellules §12 de la primitive, hors des « restes » de ce brief. **À ouvrir en ticket** : je n'ai pas pu vérifier les doublons, `gh` ne donne ni la recherche GraphQL ni la recherche REST dans cette session (403).
- Pour chaque vue, la couche imprime ce que son verdict accepte : 6 lignes « journal : « … » au bord bas, accepté — le panneau défile (scrollHeight X > clientHeight Y) ».
- Immobilité : « 84 vue(s) × 2 pointeur(s) comparées → OK » (tolérance 0,5 px).

**Déterminisme — la cause est trouvée et corrigée.** Sur un arbre inchangé, `c1d/sonde-2.txt` a rendu 3 défauts « au trait en bas » à 1707, alors que C1c y avait 0. Mesure `c1d/e6.js` : après un changement de tour, la page reste bloquée environ 1,2 s par une tâche longue. Un `setTimeout(50)` n'est servi qu'à t = 1177 ms. Le défilement `smooth` vers l'entrée au trait ne démarre qu'à t ≈ 1400 ms. Or `attendreStable` échantillonnait depuis Node : ses deux lectures tombaient dans la tâche longue, identiques, et elle concluait « stable » avant le défilement. Correctif : le calme se mesure dans la page, d'image en image (`requestAnimationFrame`), pendant `CALME_MS` = 250 ms de temps de page (`scripts/recette/hud-clickables.mjs:1184`, `:1206`). Résultat : 3 passes identiques.

## Arbitrages 1-6

| # | État | Preuve |
|---|---|---|
| 1 (A7 retiré, écart Q1 écrit) | fait | Spec : la bande reste de bord à bord (1c-ter cité). La cote est mesurée : case **34,25 px** à 1366×650 (`c1d/q1.txt`) ; elle était de 33,3 px avant l'arbitrage 6, car le pied de travée est passé de 10 à 8 px. Écrit en `docs/plans/2026-08-16-spec-hud-combat.md:692-705` (§ « Budget par pointeur »). Les lignes 29-30 y renvoient **à nombre de lignes constant** : les 26 ancres `spec:NN` du dépôt (R-M2 :71-74, R-M3 :75-76, :192-194, :237, :261-262…) ne bougent pas. |
| 2 (budget au doigt) | fait | `BUDGET_PONT` vaut `doigt: { arche: 0.30, empile: 0.48 }` (`hud-clickables.mjs:948`). À 701-900 au doigt, un seul plafond, celui de la ligne d'arche (`:983`) ; au doigt ≤700, 0,48 ; dès 901, l'empreinte reste à 0,22. La souris ne change pas. Le texte vit en trois endroits : spec § Budget par pointeur, charte `docs/charte-ui.md:465-469`, F-5 et F-1 (`src/ui/CombatConsole.test.tsx`). F-1 juge désormais l'empreinte à 22 % même au doigt : seule la BANDE est exemptée quand la case est à sa cible. Sonde : aucun défaut budget. Mesures : 312/650 = 48,0 % au plafond exact (au doigt ≤700) ; 183,6/650 = 28,2 % (au doigt 701-900). |
| 3 (journal ≤700 dans le champ) | fait | `hud.css:253-274` : en combat à ≤700, la zone `outils` est posée par les lignes (`grid-row: champ; grid-column: centre / -1; min-width: 0`) ; à ≤560, `grid-column: 1 / -1` (`:291`). Le panneau prend `width: calc(100cqw - 1px); max-height: var(--ld-place)`. Le rail est couché (`rowBelow={700}`, `src/ui/CampaignView.tsx:373`). `--ld-place` retire les deux filets de la plaque (`hud.css:165`) : sans eux, le panneau débordait de 1 px (`c1d/sonde-2.txt`, 8 lignes). Les défauts « débord ld-panel hors outils » disparaissent de la sonde parce que le débord n'existe plus : aucune exemption n'a été ajoutée. Le panneau s'ouvre sans rien déplacer : l'immobilité est OK à l'état journal ouvert. À ≥701, il reste ancré au rail. |
| 4 (groupe à 561) | fait | La cause est mesurée : `outils` couvrait centre + flanc droit, et son `min-width` (~62 px) se reportait sur le flanc droit, ce qui laissait 362 px au centre pour un groupe de 398 px. Une fois le rail parti dans le champ et `min-width: 0` posé, le groupe est à x 121..519 et la frise à 8..113 (sonde de mise au point `c1d/e4.js` via `c1d/dbg.mjs`, sortie lue en console, non conservée ; la sonde finale le confirme). Sonde : 0 « recouvre party-dock ». Micro-jauges intactes : poignée OK. Une règle d'aires, aucune géométrie par largeur. |
| 5 (N5, snap) | fait | `log-drawer.css:52-57` : `scroll-snap-type: y mandatory; scroll-padding-top: var(--sp-md)`, et `.ld-panel > * { scroll-snap-align: start }`. Côté sonde (`hud-clickables.mjs:337-351`) : une coupe par le bord HAUT est toujours un défaut ; une coupe par le bord BAS n'est acceptée que si `scrollHeight > clientHeight`, et le verdict l'imprime (`bordDefilant`, `:1018`). La charte l'écrit (`docs/charte-ui.md:435-442`). Sonde : 0 « ligne coupée », 6 lignes acceptées et dites. |
| 6 (stock) | fait | `--cc-arch-pad-flanc: var(--sp-lg)` (14 → 12) et `--cc-bay-pied: var(--sp-md)` (10 → 8) (`combat-console.css:43`, `:55`). Stock régénéré à la baisse (`c1d/stock-regen.txt` : IDENTITE 1747, ESPACEMENT 709, STYLE 93). `ui-ratchets` vert (53/53). |

## Reste à faire du brief

- **Reste 6 (Δx entre formes)** : fait. Les deux voies ont maintenant pour plancher la FORMULE de leur travée, et non leur contenu : `--cc-travee-g` et `--cc-travee-d` (`combat-console.css:106-107`, grille `:264`). Les pistes sont donc les mêmes dans les deux formes. Mesure `c1d/dx-formes.txt` : l'arche est à la même x en forme complète et en forme spectatrice (900 souris 293,7 ; 901 souris 294,2 ; 901 doigt 326 ; 1000 doigt 368,2 ; avant : 326 contre 323). La tolérance de `console-pont-formes.mjs` passe de 1 à `TOLERANCE_IMMOBILE` (0,5), importée et non recopiée (`:29`, `:476`). `console-pont-formes.mjs` rc = 0 (`c1d/pont-formes.txt`), et rc = 0 avec `--widths 900,901,1000` (`c1d/pont-formes-901.txt`).
- **`.cc-bay-head`** : « ACCÈS RAPIDE » est entier et dans l'écran à 360, souris et doigt (plage de texte 239..292 souris et 268..321 doigt sur 360 ; `c1d/e2.js`, sortie `c1d/e2.out`). Aucun mot tranché dans la sonde. Le commentaire `combat-console.css:249-258` dit vrai : les voies se partagent la largeur à parts égales (1fr), chacune ≥ la formule de SA travée. Quand l'une n'a plus sa part, l'arche se décale de la moitié de l'écart : 0,3 px à 900 souris, 3 px à 1000 doigt (`dx-formes.txt`). L'arche n'a pas été recentrée. **Reste** : la rubrique de set (`.cc-bay-head` générique, `combat-console.css:378-388`) garde `text-overflow: ellipsis` au caractère. C'est latent : aucun libellé de set des données de la sonde ne déborde. Point du juge de diff C1b non soldé.
- **B5** : fait dans les fichiers du lot. Les renvois à un juge, à un verdict ou à `sonde-coarse.mjs` sont remplacés par la réf nue (`CombatConsole.tsx:51-53`, #1919, #1806, spec). Fichiers : `hud-clickables.mjs` (en-tête, `BUDGET_PONT`, `:149`, `:225`, `:922`, `:1379`, `:1408`, `:1485`), `console-pont-formes.mjs`, `docs/recette-navigateur.md:212`, `CombatConsole.test.tsx` (`:1124`, `:2142`, `:2183`, `:2228`, `:2252`, `:2256`), `TeamSegments.test.tsx:4`, `hud-clickables.test.mjs` (titre de section). La charte a sa ligne `nom.css | Nom | .nom-mot` (`docs/charte-ui.md:332`). Le paragraphe de couche dit les états, les pointeurs, les 14 largeurs et les plafonds au doigt. L'en-tête de la sonde dit sa vraie grille. **Hors périmètre, non corrigé** : le dépôt garde d'autres renvois « juge … » antérieurs au lot, par exemple `src/ui/CombatConsole.test.tsx:370`, `:553`, `:1401`, `:1910`, `src/ui/choix-retenu-guard.test.ts:18`, `src/ui/etat-aria-guard.test.ts:6`, `scripts/recette/detecteurs-hauteur.test.mjs:286`, `scripts/guards/lib/stocksNominatifs.mjs:317`. C'est une classe qui demande sa garde.

## Tickets mesurés (`c1d/tickets.txt`, tour du héros, souris et doigt, 12 vues)

- **#2101** : à chaque vue et à chaque pointeur, 8 touches `.cc-key` sur 8 sont dans l'écran et non rognées. `.cc-lbl` n'est pas mort : il ne vit que dans `.cc-end` (« Fin du tour »), entier et dans l'écran partout.
- **#1833** : la hauteur rendue de `.cc-dock` est égale à `--cc-deck-h` résolu, écart 0,0 px. Aux vues demandées : 1100×780 132,6 ; 900×780 132,6 souris et 183,6 doigt ; 800×780 132,6 et 183,6. Écart 0 aussi aux vues de la sonde (1707, 1366×650, 1280×740, 901, 701, 700, 640, 560, 360).
- **#1856** : « Fin du tour » est dans l'écran à 1100×780 (1026,675,64×95) et à 900×780 (826,689,64×81 souris ; 826,599,64×47 doigt).

## Mutations (git hash-object avant / muté / après)

Mutations unitaires sur la sonde (`c1d/mutations-unit.jsonl`), fichier `scripts/recette/hud-clickables.mjs`, avant = après `f7636fd` :
- MA `empile: 0.48 → 0.60` (blob muté `f2637da`) : rouge « budget au DOIGT sous 701 », vert après remise.
- MB `if (doigt && t === '701–900')` → `if (false)` (`2ca3246`) : rouge « budget au DOIGT à 701–900 ».
- MC `bordDefilant` rendu vide (`d186bca`) : rouge « journal : une ligne au bord BAS… ».

Mutations unitaires sur la feuille (`c1d/mutations-vt.jsonl`), fichier `combat-console.css`, avant = après `8c250fb` :
- F5 : tranche empilée sans `(pointer: coarse) and (max-width: 700px)` (`22bd146`) → F-5 rouge, puis vert.
- F1 : fronton sans clamp (`c366b64`) → F-1 rouge, puis vert.

Mutations CSS rejouées en **sonde réelle** avec `--vues` (`c1d/mutations-nav.jsonl`, sorties `c1d/mut-*.txt`). Le rouge est compté sur la classe visée ; la base sur les mêmes vues ne contient que les 20 défauts antérieurs :
- **N — immobilité du nom** (deux lignes réservées → une) : `combat-console.css` `8c250fb` → `d218932` → `8c250fb` ; 56 défauts de classe, dont « le mot « Maistre » (nom-mot) est tranché — rogné par cc-arch-name ».
- **F — frise en pause** (badge `position: static`, remis dans le flux) : `initiative-strip.css` `aabf4c8` → `3e53ed6` → `aabf4c8` ; 4 défauts « immobilité … la boîte « frise » passe de w 86,2 à 103,6 (pause de Round) — 17,4px ».
- **D — fronton au doigt** (sans clamp) : `combat-console.css` `8c250fb` → `c366b64` → `8c250fb` ; 3 défauts « 1366×650px (… pointer: coarse) : le pont, fronton compris, prend 24,3 % (plafond 22 %) ».
- **J — journal ≤700** (`outils` rendu à `grid-row: haut / champ`) : `hud.css` `e66bdd6` → `593c429` → `e66bdd6` ; 18 défauts, dont « party-dock recouvre ld-panel » (640, 561) et « party-dock recouvre hud-rail » (561).
- **M6 — mot tranché à deux lignes** (`.nom-mot` en `white-space: normal`) : `nom.css` `ac2e395` → `384ae3a` → `ac2e395` ; 56 défauts « le mot « Pierre-de-Fer » (nom-mot) est tranché — 2 lignes ».
- **M6b — même mutation, verdict de la sonde débranché** (`if (lignes > 1)` → `if (false)`, `hud-clickables.mjs` `3a17e09` → `4b74b12` → `3a17e09`) : 0 défaut de classe. C'est bien cette ligne de verdict qui attrape le mot tranché.

## Recette joueur (`c1d/recette.mjs`, `c1d/captures/`, 40 PNG, `c1d/captures/captures.sha256`)

- Mise en place par `__wfrp`, et seulement là : scénario, combat, trait au héros qui précède un adversaire, noms au pire des données (actif « Maistre Marchand (Services Urbains Fréquents & Usuels) », adversaires suivants par longueur, héros composé « Aelindra Feuille-d'Argent »), pause de Round.
- Gestes réels : « Commencer » au clic ; journal ouvert puis refermé au clic sur sa poignée ; « Fin du tour » armé au CLAVIER (Espace, le coin affiche alors « Finir quand même »), confirmé au clic ; le pont passe en forme spectatrice.
- Vues : souris à 360×740, 560×650, 640×780, 700×780, 701×780, 900×780, 1366×650 et 1707×780 ; doigt à 768×1024 et 1366×650. États : héros, journal, pause, adverse.
- À chaque vue, l'arche et la bande ont la même boîte dans les 4 états, la page ne défile pas, et le journal ne recoupe ni le groupe ni la frise (`c1d/captures/recette.log`).
- Console : 1 erreur, `items.ts:708` (#2141), 0 autre.
- Je n'ai pas de visionneuse d'image dans cette session : les captures sont hachées, **pas regardées**. La vérification est faite par les boîtes relevées.

## Portes (sorties brutes sous `c1d/`)

- `npm run typecheck:fast` : rc 0, « 0 erreur(s) » (`tc-final.txt`).
- `npx vitest run` sur 18 fichiers : les tests touchés et leurs importeurs, plus `Layout.test.tsx`, `css-valeur-en-test`, `ui-ratchets`, `comment-poison-guard`, `css-modules-guard`, `primitive-owners-guard` et `coupe-au-caractere-guard`. rc 0, 400/400 (`vt-final.txt`).
- `node --test`, fichier par fichier : `hud-clickables.test.mjs` 106/106 ; `cssCouches.test.mjs` 42/42 ; `detecteurs-pont.test.mjs` 7/7. Il n'existe pas de test propre à `console-pont-formes`.
- `eslint --max-warnings 0` sur les 20 fichiers `.ts/.tsx/.mjs/.mts` modifiés : rc 0, sortie vide (`eslint-final.txt`).
- Sonde finale : rc 1, 20 défauts nommés et classés plus haut.

## Fichiers touchés par C1d (en plus de C1b et C1c)

- `src/ui/styles/hud.css` : outils dans le champ à ≤700, aires de combat ≤700 et ≤560 scopées `[data-pont='combat']`, `--ld-place` avec ses filets.
- `src/ui/styles/log-drawer.css` : snap à la ligne.
- `src/ui/styles/combat-console.css` : voies sur formule, deux pas d'espacement sur l'échelle.
- `src/ui/CampaignView.tsx:373` : `rowBelow={700}`.
- `scripts/recette/hud-clickables.mjs` : budget au doigt, journal accepté au bord défilant, `--vues`/`VUES_COUCHE`, calme en temps de page, réfs.
- `scripts/recette/hud-clickables.test.mjs` : 2 tests réécrits, 1 neuf.
- `scripts/recette/console-pont-formes.mjs` : `TOLERANCE_IMMOBILE`, réfs.
- `scripts/guards/lib/cssCouchesStock.mjs` : régénéré à la baisse.
- `src/ui/CombatConsole.test.tsx` : F-1, F-5, réfs.
- `src/ui/TeamSegments.test.tsx`.
- `docs/charte-ui.md`, `docs/plans/2026-08-16-spec-hud-combat.md`, `docs/recette-navigateur.md`.

Docs générés : C1d n'en a édité aucun à la main. `docs:check` reste à jouer par l'orchestrateur ; les fichiers de C1d que les générateurs peuvent lire sont `hud.css`, `combat-console.css`, `log-drawer.css`, `CampaignView.tsx` et `cssCouchesStock.mjs`.

## CLIQUET à déclarer (ventilation) — stock `CSS_ESPACEMENT_RATCHET`, entrées présentes à l'arbre et absentes à HEAD

Ces entrées étaient déjà dans l'arbre à mon arrivée. Elles viennent de C1c, dont la garde résout désormais les variables hors échelle du module : des sites de HEAD sont maintenant comptés. L'outil ne peut pas en ajouter. Ce sont 24 entrées :
- **combat-console.css (12)** : `.cc-arch :: margin-top :: calc(-1 * var(--cc-fronton))`, `.cc-arsenal-body :: gap :: var(--cc-gap)`, `.cc-bay-body :: gap :: var(--cc-bay-gap)`, `.cc-dock :: gap ::` (×3 formes), `.cc-dock :: padding-inline/-left/-right`, `.cc-grid :: gap`, `.cc-sets :: gap`, `.combat-console :: padding-top :: var(--cc-saillie)`.
- **initiative-strip.css (11)** : `.is-cell :: margin-top`, `.is-round ::` ×6, `.is-tiles :: gap`, `.is-tiles :: padding` ×3.
- **party-dock.css (1)** : `.pd-track :: gap :: var(--pd-gap)`.

Côté retraits : `.cc-arch :: padding :: 6px 14px 8px` et `.cc-bay :: padding :: 8px 8px 10px` sortent, remplacés par des valeurs sur l'échelle. Côté identité : 4 entrées soldées (`.cc-arch-name :: font-size` n°2, et `line-clamp` ×3 de `figcaption`).

## Tâches lancées et leur fin

- Serveur de dev : `setsid timeout 12000 npm run dev`, pgid 4256, **tué** par groupe (`kill -- -4256`).
- Sondes : `sonde-1` (pgid 8692) **tuée** par groupe, parce qu'une édition de CSS l'avait contaminée en cours. `sonde-2`, `sonde-passe1` (arbre intermédiaire), la boucle des 3 passes finales et `mut-nav.py` (`timeout` 2400/3000/3600) sont **terminées** (fichiers `.rc` écrits, `passes.done`).
- `dbg.mjs`, `recette.mjs`, `console-pont-formes`, `mut.py`, `mut-vt.py` : premier plan, sous `timeout`, **terminés**.
- Sonde finale `ps` : aucun `vite`, `chrome`, `hud-clickables` ni `timeout` vivant.
