# Rendu : CI rouge de 395e1d4c4 (#1806), 2026-09-28

Worktree `/home/user/game/.wt-1806-L1`. Sorties brutes : `scratchpad/ci395/`.

## Reproduction dans le worktree (avec le train 2)
`scratchpad/ci395/avant.txt` : `npx vitest run` sur les 7 fichiers → exit=1, « Tests 16 failed | 79 passed (95) », « Test Files 6 failed | 1 passed (7) ».
Le fichier qui passe déjà est `src/ui/raccourcis-registre.test.ts`, et c'est un FAUX vert (voir point 2).

## 1. Disjonction primitive / écran (`scripts/hooks/new-src-file-guard.test.mjs:97`)
- Cause : le TEST a raison. `src/ui/compendium/CodexRef.tsx` est au manifeste (`id: codex-ref`, `src/data/primitives.manifest.json`) ET au registre `scripts/hooks/ecrans-ui.json:135`.
- Ce que ce registre imposait : rien de plus que « être déclaré » pour `scripts/hooks/new-src-file-guard.mjs` (consommateurs : `git grep ecrans-ui`). Pas de capture, pas de recette. Le manifeste porte déjà `css` et `verrou`.
- Correction : la ligne `"src/ui/compendium/CodexRef.tsx",` est retirée de `scripts/hooks/ecrans-ui.json`. Le stock décroît.
- Mutation (le test n'est pas neuf, fichier de donnée muté) : ligne remise → `not ok 6 - DISJONCTION`, exit=1 ; ligne retirée → `# fail 0`. hash-object avant=3ced5c40f mute=e60487034 apres=3ced5c40f.

## 2. Écouteur clavier global de `Infobulle` (`src/ui/raccourcis-registre.test.ts:65`)
- Constat : à 395e1d4c4, `document.addEventListener('keydown', onKeyDown, true)` est littéral → la garde rougit. Dans le worktree, la délégation du train 2 passe par `document.addEventListener(type, deleguer, capture)` et une table `PHASES` (`src/ui/Infobulle.tsx:62-92`). La regex `ECOUTEUR_GLOBAL` ne voit que le type littéral, donc la garde passe à VIDE : même écouteur `keydown` global, mais invisible.
- Trou de la garde, corrigé pour toute la classe : `ecouteurGlobal` compte aussi un type VARIABLE posé sur `window`/`document` dès que le fichier nomme un type clavier (littéral ou clé d'objet). Seuls sites à type variable sous `src/` : `Infobulle.tsx` et `useLongPress.ts` (`SUITE` = événements pointeur, non concerné). Un cas unitaire neuf couvre les deux.
- Arbitrage : c'est une couche hors registre PAR NATURE. La preuve :
  - Échap de la couche passe par la pile (`useDismissLayer(... fermer ...)`, `Infobulle.tsx`).
  - La couche ne lit que ↓, et seulement quand la cible résout un ancrage de l'instance (`keydown: (e, a) => { if (e.key !== 'ArrowDown' ...`).
  - Le registre s'efface quand un contrôle a le focus : `cursor-down` porte `notWhenControlFocused: true` (`src/state/keybindings.ts:327`).
  - ↓ est annoncé par `aria-keyshortcuts` sur l'ancrage.
  - Couches pairs déjà déclarées : `src/ui/Modal.tsx:20`, `src/ui/useDismissLayer.ts:14`.
- Correction : `@clavier-hors-registre` ajouté dans l'en-tête de `src/ui/Infobulle.tsx:27-29`.
- Mutations :
  - M2a, marque ôtée → FAIL « tout écouteur clavier GLOBAL… », exit=1. Infobulle avant=1fcfcc42f mute=6e50b5c55 apres=1fcfcc42f.
  - M2b, garde ramenée au littéral seul → 2 FAIL : le cas neuf « type d'événement VARIABLE » et « aucune marque morte », exit=1. garde avant=bca7fdd3e mute=c22d05cfe apres=bca7fdd3e.
  - Vert : 6/6.

## 3. Spécimen de galerie (`src/ui/choix-retenu-guard.test.ts:291`)
- Cause : le CODE du lot est fautif. `src/ui/gallery/registry.tsx:894` écrit son état dans ses enfants (`{bouton ? 'Fermer la boîte' : 'Ouvrir la boîte'}`) sur un bouton `aria-expanded` sans `aria-haspopup`.
- Correction : libellé fixe « Boîte ancrée ». L'état est porté par le chevron canonique qui lit `aria-expanded`.
- Mutation : ternaire remis → `expected [ 'src/ui/gallery/registry.tsx:894' ] to deeply equal []`, exit=1 ; vert 27/27. avant=211ea70b4 mute=5f5748ab4 apres=211ea70b4.

## 4. Menu d'ajout vide
- L'hypothèse du brief est CONFIRMÉE, et le code est juste. Avant, dans `git show c160fc3c3:src/ui/editor/AddMenu.tsx`, la `div.eff-add-menu` et ses `ListRow` étaient rendues DANS le `<details>` même fermé : présentes au DOM, absentes de l'écran et de l'arbre d'accessibilité. Maintenant, `{placement && <BoiteAncree …>}` n'existe qu'ouvert, en portail sur `document.body`, comme toute surface ancrée. La recette joueur du 2026-09-28 est OK.
- Donc c'étaient les TESTS qui verrouillaient un détail d'implémentation : ils cliquaient des entrées d'un menu fermé, ou lisaient du `renderToStaticMarkup`. Seule perte possible côté joueur : la recherche Ctrl+F de Chrome dépliait un `<details>` fermé sur une entrée. Elle ne trouve plus une entrée de menu fermé. Je le juge marginal ; c'est signalé, pas corrigé.
- Résidus #1619 : aucun portail ne fuyait. Le premier test d'`EffectList` et chaque test de `seeds` levaient AVANT leur démontage, et leur conteneur restait dans `document.body`, en cascade sur les tests suivants.
- Corrections :
  - Neuf, `src/ui/editor/AddMenu.testkit.ts` : `menuDe`, `ouvrirMenu`, `entreeDe`, `choisirDansMenu`. `ouvrirMenu` fait le geste joueur : clic sur le `summary`, puis attente sous `act` du `toggle` que jsdom émet en tâche différée (sonde `scratchpad/ci395/probe.mjs` : `sync open= true`, puis `toggle` async). Il rend la boîte née de l'ouverture.
  - `EffectList.test.tsx` : la rangée est dépliée par son `summary`, le menu « Type : » est ouvert puis l'entrée choisie ; `try/finally` démonte.
  - `GameOpEditor.seeds.test.tsx` : la palette est ouverte avant chaque choix ; `afterEach` démonte ce qu'un test a laissé (`montes`) ; témoin anti-vacuité `creees > 0` dans la boucle « TOUTE op créable », sinon elle passerait à vide.
  - `GameOpEditor.test.tsx` et `FlowEditor.test.tsx` : passent en jsdom, montent (`monterRacine`/`demonterRacines`), ouvrent le menu et cherchent les entrées par libellé (`OP_LABEL`).
  - `WorldMapEditor.test.tsx` : `choisirDansMenu(menuDe(container, '+ Effet'), 'Journal')`.
- Mutation : `groups.map` → `groups.slice(0, 0).map` dans `src/ui/editor/AddMenu.tsx`, sur 5 fichiers.
  - Rouge exit=1, 8 FAIL nommés, SANS cascade de résidus : « entrée « Accorder un Talent » absente du menu », « Condition (si…): expected undefined to be defined », « narrative: expected undefined… », « témoin : la palette ouverte propose des ops à réf: expected 0 to be greater than 0 », « entrée « Journal » absente du menu », etc.
  - Vert : 68/68 avec `AddMenu.test.tsx`.
  - hash-object avant=631cdc665 mute=b7bc5e38f apres=631cdc665.

## Portes
- `npm run typecheck:fast` : exit=0, « typecheck:fast — 0 erreur(s) ».
- eslint sur les 9 fichiers touchés : exit=0, aucune sortie.
- `npx vitest run src/ui/editor` + BoiteAncree, Infobulle, CodexRef, CodexRef.hooks, raccourcis-registre, choix-retenu-guard, comment-poison-guard, primitive-owners-guard, ui-ratchets, vi-mock-isolate-guard : exit=0, « Test Files 62 passed (62) », « Tests 852 passed (852) ». Sortie dans `ci395/perimetre.txt`.
- `node --test scripts/hooks/new-src-file-guard.test.mjs scripts/hooks/stocks-nominatifs.test.mjs` : exit=0, 79/79.
- NON JOUÉS : `npx vitest run` en entier et `npm run test:hooks` en entier. Mes consignes permanentes laissent les suites entières au run CI de la branche, et `scripts/hooks/codeur-gates-guard.mjs` les bloque. Les 7 rouges vitest et le rouge hooks ont chacun été reproduits puis éteints fichier par fichier ci-dessus. Le 0 échec sur la suite entière reste à constater par la CI.
- Aucun doc généré n'a bougé : manifeste non touché par ce lot, `ecrans-ui.json` n'est rendu par aucun doc.

## Processus
Toutes les commandes sont au premier plan, bornées par `timeout`, et terminées : vitest ×9, `node --test` ×6, typecheck:fast, eslint, sonde jsdom. Aucune tâche de fond. `ps` en fin de travail : aucun vitest, node --test ni tsc vivant. Arbre principal `/home/user/game` : `git status --short` vide.
