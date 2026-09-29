# Rendu codeur — R-M2 lot A, train 5 (#1806), 2026-09-28

Worktree : /home/user/game/.wt-1806-L2, HEAD eb3a49429. Rien n'a été indexé ni commité. Arbre principal : `git status --short` renvoie 0 ligne, aucune fuite.

## Porte d'entrée
Le brief touche `scripts/guards/lib/tsProgram.mjs`, une fabrique d'outillage partagée. Ce n'est pas un socle de flux de jeu, et le brief ne demande aucune branche par type de porteur. Il porte `## Invariant` (credo, verbatim) et le verdict d'un juge qui retient la correction. Je l'ai accepté.

## Fichiers touchés (code)
- scripts/guards/lib/tsProgram.mjs : 3e fabrique `parsedProgram(racine)`, qui prend un arbre déjà parsé, sans lib ni import. L'en-tête dit maintenant « Trois fabriques » et cite #1806. `getDefaultLibFileName` passe par `ts.getDefaultLibFileName(o)`, il n'y a plus de littéral 'lib.d.ts'.
- scripts/guards/lib/tsProgram.d.mts : déclaration de `parsedProgram(racine: SourceFile): Program`.
- scripts/guards/lib/coupeAuCaractere.mjs : `verificateurDe` est supprimé. Le module consomme `parsedProgram(racine).getTypeChecker()`, toujours paresseux et limité à l'appel. F3 : `suiviEnJsx` saute aussi `ts.isJsxExpression(f) && !f.expression`, et l'en-tête PORTÉE le dit.
- scripts/guards/lib/analyseRetenue.mjs : 'parsedProgram' ajouté à `FABRIQUES_D_ANALYSE`, pour que la garde #1801 voie la 3e fabrique.
- scripts/docs/lib/jsdocUnion.mjs:236 : consomme `virtualProgram({ [chemin]: text })`, avec `getSourceFile(path.resolve(VIRTUAL_ROOT, chemin))`. Voir l'écart plus bas.
- src/lib/coupeAuMot.mjs:12-13 : l'en-tête reprend verbatim la correction du juge.
- src/lib/coupeAuMot.test.ts : titre corrigé, cas `('   abc def', 5)` → `'   abc…'`. Le fuzz devient le test « balayage à graine fixe » : graine 42, 20 000 cas, arrêt dès 5 fautes, timeout 5 000 ms, environ 50 ms mesurés. Il vérifie quatre choses : le texte reste entier s'il tient ; le rendu ne dépasse `n` que dans l'exception « blancs de tête + premier mot > n-1 » ; le rendu est un préfixe du texte ; aucun texte n'est perdu. L'alphabet comprend U+00A0.
- src/coupe-au-caractere-guard.test.ts : cas `{/* c */}` entre la coupe et `{'…'}` → `['temoin.tsx:3']`.
- src/analyse-retention-guard.test.ts:521 : 'parsedProgram' ajouté au contrôle de non-vacuité des fabriques exportées.
- docs/* (36 fichiers, sortie de `npm run docs:build`) : seules les lignes `sources-empreinte` et `docs/.sources-lues.json` changent (tsProgram.mjs devient une source lue). Le `corps:` est inchangé partout. Aucune ligne de contenu n'a bougé : j'ai lancé `git diff -- docs | grep '^[-+][^-+]' | grep -v sources-empreinte` et il ne sort que des entrées de .sources-lues.json.

## Écart F2 / jsdocUnion : instance de `virtualProgram`, pas de la 3e fabrique
J'ai d'abord essayé `parsedProgram(entree.sf)`. `node scripts/docs/build-effects.mjs --check` a échoué (rc=1) avec « membre « effectOpSchema » de « effectSchema » : schéma introuvable dans les fichiers indexés ». Cause : `src/data/schemas/grammaire/mecanique.ts:1007` déclare `export type FamilleMecanique = ReturnType<typeof construire>`, et `ReturnType` vient de la lib standard. Sans lib, le vérificateur ne suit pas `FERMEE.effectOp` (mecanique.ts:1043). Le site a donc besoin de la lib et d'aucun import, sur un texte déjà en mémoire (`entree.text`), ce qui correspond exactement à `virtualProgram`. Avec `virtualProgram`, `build-effects --check` rend rc=0, « 58 Effects », sortie identique.

## Contre-grep `git grep -n "createProgram" -- scripts src`
AVANT :
```
scripts/docs/lib/jsdocUnion.mjs:236:    programme = ts.createProgram({
scripts/guards/lib/analyseRetenue.mjs:6:// FABRIQUE : `FABRIQUES_D_ANALYSE` (appel nu ou membre, `ts.createProgram`) ; toute fonction NOMMÉE du
scripts/guards/lib/analyseRetenue.mjs:60:  'createProgram',
scripts/guards/lib/coupeAuCaractere.mjs:42:  return ts.createProgram({ rootNames: [racine.fileName], options, host }).getTypeChecker()
scripts/guards/lib/tsProgram.mjs:37:  return ts.createProgram({
scripts/guards/lib/tsProgram.mjs:79:  return ts.createProgram({ rootNames: [...sources.keys()], options, host });
src/analyse-retention-guard.test.ts:118:export const DIRECT = ts.createProgram({ rootNames: [], options: {} });
src/state/built-brand-lint.test.ts:179:  const program = ts.createProgram([fileName], options, host);
src/state/roll-seam-mints.test.ts:547:  return ts.getPreEmitDiagnostics(ts.createProgram([fileName], options, host)).map((d) => d.code);
src/ui/editor/scene-field-editability-guard.test.ts:358:    return ts.createProgram({ rootNames, options: { ...parsed.options, noEmit: true }, host });
```
APRÈS :
```
scripts/guards/lib/analyseRetenue.mjs:6:// FABRIQUE : `FABRIQUES_D_ANALYSE` (appel nu ou membre, `ts.createProgram`) ; toute fonction NOMMÉE du
scripts/guards/lib/analyseRetenue.mjs:61:  'createProgram',
scripts/guards/lib/tsProgram.mjs:39:  return ts.createProgram({
scripts/guards/lib/tsProgram.mjs:81:  return ts.createProgram({ rootNames: [...sources.keys()], options, host });
scripts/guards/lib/tsProgram.mjs:99:  return ts.createProgram({ rootNames: [racine.fileName], options, host });
src/analyse-retention-guard.test.ts:118:export const DIRECT = ts.createProgram({ rootNames: [], options: {} });
src/state/built-brand-lint.test.ts:179:  const program = ts.createProgram([fileName], options, host);
src/state/roll-seam-mints.test.ts:547:  return ts.getPreEmitDiagnostics(ts.createProgram([fileName], options, host)).map((d) => d.code);
src/ui/editor/scene-field-editability-guard.test.ts:358:    return ts.createProgram({ rootNames, options: { ...parsed.options, noEmit: true }, host });
```
Sites restants hors de mon périmètre, même classe probable, non traités et non vérifiés contre les fabriques : src/state/built-brand-lint.test.ts:179, src/state/roll-seam-mints.test.ts:547 et src/ui/editor/scene-field-editability-guard.test.ts:358 (hôtes posés à la main). src/analyse-retention-guard.test.ts:118 est une morsure volontaire de la garde, pas un site. Je n'ai ouvert aucune issue : le brief ne me donne ni git ni gh.

## Portes (code de sortie lu hors pipe)
- `npm run typecheck:fast` : rc=0, « 0 erreur(s) », après l'ajout du .d.mts.
- `npx vitest run --no-cache` sur coupeAuMot.test.ts, coupe-au-caractere-guard.test.ts, comment-poison-guard.test.ts, analyse-retention-guard.test.ts, src/data/field-consumers.test.ts et src/ui/editor/scene-field-editability-guard.test.ts : rc=0, 6 fichiers, 154/154. Les deux derniers sont les tests `tsProgram` trouvés par `git grep -l "tsProgram\|jsdocUnion" -- '**/*.test.*'`. Aucun test ne vise jsdocUnion.
- `node --test scripts/docs/lib/empreinte-sources.test.mjs` : rc=0, 16/16. Aucun test `scripts/**` ne vise les fichiers touchés ; j'ai lancé celui-ci parce que le grep de noms le remonte.
- eslint sur les 9 fichiers de code touchés : rc=0, sortie vide.
- `npm run docs:build` : rc=0. `npm run docs:check` : rc=0, « docs:check — OK (… 34 générateur(s) rejoué(s) sous linux, 0 frais, 4 vérificateur(s)) ».

## Mutations (fichier muté ; empreintes avant / muté / après)
- M1, balayage, câblage `n - 1` → `n` (src/lib/coupeAuMot.mjs:18) : 0c943cf85c… / c2bca4f656… / 0c943cf85c…. Rouge (rc=1) : « au-delà de n : "é b     bcc   é" 3 -> "é b…" », et 4 autres. Vert après remise (rc=0).
- M2, cas `'   abc def'`, `const debut = 0` (coupeAuMot.mjs:16) : 0c943cf85c… / 56d9a4e00b… / 0c943cf85c…. Rouge : « expected '…' to be '   abc…' ». Vert après remise.
- M3, F3 : suppression de `&& !(ts.isJsxExpression(f) && !f.expression)` (coupeAuCaractere.mjs:91) : 222d6a3d6b… / 302f1cdb9a… / 222d6a3d6b…. Rouge : « expected [] to deeply equal [ 'temoin.tsx:3' ] ». Vert après remise.
- M4, câblage de `parsedProgram` : `rootNames: []` (tsProgram.mjs:99) : 29a46f0ef1… / adf4d32385… / 29a46f0ef1…. Rouge : « constante du module vue d'une portée interne: expected [] to deeply equal [ 'temoin.tsx:2' ] ». Vert après remise.
Chaque fichier a été remis à la main par sed inverse ; l'empreinte finale est égale à l'initiale.

## Processus
Aucun processus en arrière-plan. Toutes les commandes étaient au premier plan, bornées par `timeout` ou par le runner, et toutes sont terminées.
