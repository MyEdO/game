# Rendu du train 6, R-M2 lot A (#1806), 2026-09-28

Arbre : `/home/user/game/.wt-1806-L2`, HEAD `7270396a6` (train 5 commité). Le travail = `git diff HEAD` + 1 fichier non suivi.
Arbre principal : `git -C /home/user/game status --short` vide (0 ligne), aucune fuite.
Porte d'entrée : le brief porte `## Invariant` et `## Cas canonique`. Il n'a pas de section `## Design jugé :`. J'ai pris le verdict du juge 5 (copié au brief) comme design jugé.

## Fichiers touchés
- `scripts/guards/lib/tsProgram.mjs` : D3. L'en-tête dit maintenant « gardes et générateurs », `jsdocUnion.mjs` est cité, ainsi que la garde de classe (`:10`). Le JSDoc de `virtualProgram` est réécrit. D4 : `repoProgram(root, choisirRootNames, recouvrement = {})` (`:37`). L'hôte vient de `ts.createCompilerHost(options)` : c'est le même que celui que `createProgram` construit quand on ne lui en passe pas. `getSourceFile`/`readFile` servent le recouvrement. Il n'y a qu'un chemin, sans branche.
- `scripts/guards/lib/tsProgram.d.mts` : signature `recouvrement?`, JSDoc de `virtualProgram`.
- `scripts/guards/lib/analyseRetenue.d.mts:1` : D2, ajout de `parsedProgram`.
- `scripts/guards/lib/canonUnique.mjs:288-306` : nouvelle construction générique `CONSTRUCTION_DE_PROGRAMME`. Elle reconnaît un appel nu ou membre dont le nom correspond à `/^create\w*Program$/`. L'en-tête `:12-13` la liste. `canonUnique.d.mts` l'exporte.
- `src/ts-program-fabrique-guard.test.ts` (NEUF) : la garde de classe, soit `{ ...CONSTRUCTION_DE_PROGRAMME, foyer: 'scripts/guards/lib/tsProgram.mjs' }` sur `corpusDesGardes()` (src+scripts, tests compris). Elle a trois cas : témoin, foyer, arbre réel.
- `src/data/primitives.manifest.json` (entrée `constructionsReservees`) : label + verrou. `docs/primitives.md` et `docs/systemes.md` sont régénérés.
- `src/state/built-brand-lint.test.ts:159` et `src/state/roll-seam-mints.test.ts:528` : l'hôte recopié devient `ts.getPreEmitDiagnostics(virtualProgram({ '<sonde>.ts': code }))`. Le commentaire de `roll-seam-mints.test.ts:516` ne renvoie plus à « mêmes API que built-brand-lint ».
- `src/ui/editor/scene-field-editability-guard.test.ts:341-343` : `programAvec` devient `repoProgram(ROOT, filtre DOCUMENT, patch)`. La recopie de la lecture du tsconfig a disparu.
- `src/lib/coupeAuMot.test.ts:48-71` : D1 (le titre du juge cite `:335`, le test réel est à `:48`). Nouveau titre : « non vide s'il porte autre chose que des blancs […] suivi de « … » si et seulement si du texte est retranché ». `teteEtMot` est dérivé de l'en-tête (« les blancs de tête et le premier mot ») par `TETE_ET_MOT = /^\s*\S[\S   ]*/`, sans recopier `debut` de l'implémentation. Deux assertions sont neuves : `sortie non entière` (`:68`) et `ellipse fausse` (`:69`).
- Docs générés (`npm run docs:build`) : seules les lignes `sources-empreinte`/corps bougent, plus `docs/.sources-lues.json` (entrées `src/ts-program-fabrique-guard.test.ts`).

## Écarts au brief ou au verdict
1. **Exemption de la morsure, sans liste ni mécanisme** : `analyse-retention-guard.test.ts:118` est écrit DANS un littéral de gabarit, donc ce n'est pas un nœud d'appel. Le scan AST ne le lit pas, et aucune exemption n'est nécessaire (le témoin, cas `const f = \`…ts.createProgram(…)…\``, le montre). Le seul périmètre de la garde est le `foyer`, lu par `sAppliqueA`, qui est le mécanisme canonique des constructions réservées (`canonUnique.mjs`, hôte « constructions réservées que ses appelants déclarent »).
2. **Assertion (a) du juge, corrigée d'un `.trimEnd()`** : `base === s.slice(0, teteEtMot)` est FAUX sur l'implémentation réelle quand le premier mot finit par une espace insécable. Cette espace fait partie du mot, et `trimEnd` la retire. Sonde : test édité sans `.trimEnd()`, rc=1, par exemple `"b    \n  ccbaaaa" 1 -> "b…"` (`t6-sonde-trim.out`). Retenu : `base === s.slice(0, teteEtMot).trimEnd()`.
3. **« sans disque ni import » (D3) formulé autrement** : `virtualProgram` résout les imports ENTRE ses sources (les fixtures de `scene-field-editability-guard.test.ts` s'importent entre elles). « sans import » mentirait. Texte retenu : « sans disque (un import ne se résout qu'entre ces sources) ».
4. **Portée de la garde** : `create*Program` (`createProgram`, `createIncrementalProgram`, `createWatchProgram`), pas `createLanguageService`. Le dépôt n'en a aucun appel hors foyer.
5. `types: []` des deux sondes n'existe pas dans `virtualProgram`. Le juge a mesuré 0 écart sur 18 variantes, et les 41+ tests restent verts.

## Hors périmètre (constat, sans correction)
- `tsProgram.mjs` (`repoProgram/virtualProgram/parsedProgram`) n'a AUCUNE entrée dans `src/data/primitives.manifest.json` : `grep tsProgram` rend 0 ligne dans le manifeste et dans `docs/primitives.md`. C'est une primitive partagée absente du catalogue.

## Preuves par mutation (empreintes `git hash-object`)
- M1, mutant `exceptionRendTout` (`src/lib/coupeAuMot.mjs`, `if (coupe <= debut) return s`) : avant `0c943cf8`, muté `4ef08195`, `vitest -t balayage` rc=1 (« sortie non entière » ×5), remis à la main `0c943cf8`.
- M2, mutant `sansEllipse` (`return prefixe`) : muté `9f03f395`, rc=1 (« ellipse fausse » ×5), remis `0c943cf8`.
- M3, garde : `ts.createProgram(['sonde-murage.ts'], {})` réintroduit dans `src/state/built-brand-lint.test.ts` : avant `d1d18d3c`, muté `28e308d7`, garde rc=1 (1 failed, `rel: src/state/built-brand-lint.test.ts`), remis `d1d18d3c`.
- M4, recouvrement de `repoProgram` débranché (`Object.entries({})`) dans `tsProgram.mjs` : avant `4856e2d0`, muté `dfe6c7e0`, `scene-field-editability-guard -t fossile` rc=1 (3 failed), remis `4856e2d0`.
- Sonde du test (écart 2) : `coupeAuMot.test.ts` avant `b7fe2bbb`, sonde `98f9390f` rc=1, remis `b7fe2bbb`.

## Portes (code lu par `$?` immédiat, sortie redirigée vers un fichier)
- `npm run typecheck:fast` : rc=0, « 0 erreur(s) ».
- `npx vitest run --no-cache` sur coupeAuMot, ts-program-fabrique-guard, built-brand-lint, roll-seam-mints, scene-field-editability-guard, analyse-retention-guard, comment-poison-guard et field-consumers : rc=0, 8 fichiers, 248/248.
- Tests qui lisent le manifeste (generic-domain-import-guard, maison-sans-source, registry-enveloppe, gallery-exhaustive, primitive-owners-guard) : rc=0, 36/36.
- `npx eslint` sur les 7 fichiers de code touchés : rc=0.
- `node scripts/docs/build-effects.mjs --check` : rc=0, « 58 Effects ».
- `npm run docs:build` : rc=0 ; `npm run docs:check` : rc=0.
Sorties : `scratchpad/t6-*.out`.

## Processus
Aucun en arrière-plan. Toutes les commandes ont tourné au premier plan, bornées par `timeout`, et sont terminées.
