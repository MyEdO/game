# Brief du codeur : R-M2 lot A, train 6 — clore la classe « ts.Program hors fabrique » et les textes du juge 5 (#1806), 2026-09-28

## Worktree et interdits
`/home/user/game/.wt-1806-L2`, branche `wt/1806-L2`, HEAD `eb3a49429` (= `main`). Le train 5 est INDEXÉ : n'y touche pas par git, travaille par-dessus dans l'arbre. Interdits : tout `git checkout/restore/reset/stash/add/commit/apply`, écriture dans `node_modules`. Chemins absolus ; l'arbre principal reste propre. Processus bornés, listés au rendu. Budget : 1 h. Outils `mcp__lean-ctx__*` possiblement absents : Bash et Write.

## Verdict du juge du train 5 (verbatim, copie : `/tmp/claude-0/-home-user-game/365ab83c-b2bf-5700-91e2-3605a34e86da/scratchpad/juge-train5/verdict.txt`, sondes dans le même dossier)
- **D1** `src/lib/coupeAuMot.test.ts:335` : « Le titre promet « un préfixe du texte, non vide ». Pour un texte fait de seuls blancs, le rendu est vide » → le titre dit « non vide s'il porte autre chose que des blancs ». Renfort retenu : « deux mutants qui contredisent l'en-tête survivent au balayage […] `exceptionRendTout` […] `sansEllipse` […] Deux assertions dans la boucle les tueraient : si `rendu.length > n`, alors `base === s.slice(0, teteEtMot)` ; `rendu.endsWith('…') === (base.length < s.trimEnd().length)`. » Et « `teteEtMot` recopie la définition de `debut` de l'implémentation au lieu de la dériver » : dérive-la (export interne testable ou calcul indépendant de la spec), sans dupliquer le code sous test. Mutation pour chaque assertion neuve (les deux mutants du juge rougissent).
- **D2** `scripts/guards/lib/analyseRetenue.d.mts:1-2` : la liste « Fabriques de base » ajoute `parsedProgram`.
- **D3** `scripts/guards/lib/tsProgram.mjs` `:1`, `:6`, `:45-46` : « ces lignes disent « gardes et générateurs » et « sources EN MÉMOIRE, bibliothèque standard comprise, sans disque ni import » » (`jsdocUnion.mjs:238` consomme `virtualProgram` pour générer `docs/campagne-effects.md`).
- **D4** (la classe de F2 n'est pas close) :
  - `src/state/built-brand-lint.test.ts:157-181` (`codesDeDiagnostic`) → `virtualProgram` (le juge : « 0 écart sur 18 variantes »).
  - `src/state/roll-seam-mints.test.ts:526-548` (`diagnosticsDisplay`) → `virtualProgram` ; c'est « une copie à l'identique de l'hôte précédent (`:514`) » : un seul hôte, pas deux.
  - `src/ui/editor/scene-field-editability-guard.test.ts:341-359` (`programAvec`) : « besoin distinct : le programme du dépôt (tsconfig, disque, fermeture d'imports) avec des modules remplacés en mémoire […] Correction : un paramètre optionnel de remplacement dans `repoProgram`, pas une quatrième fabrique. » Il recopie aussi la lecture du tsconfig (`:342-344` contre `tsProgram.mjs:35-38`) : elle meurt.
  - **Garde de la classe** : « `createProgram` hors `tsProgram.mjs`, avec pour seule exception la morsure `analyse-retention-guard.test.ts:118` ». L'exception ne doit pas être une liste de chemins : trouve comment le dépôt exempte une MORSURE volontaire d'une garde (`git grep -n "morsure" -- scripts/guards/lib src/*.test.ts | head -20`, et `sAppliqueA` de `scripts/guards/lib/sourceCorpus.mjs`) et reprends ce mécanisme canonique. Mutation : un `ts.createProgram` réintroduit dans un fichier rougit la garde.

## Invariant
En-tête de `scripts/guards/lib/tsProgram.mjs:1-5` (lis-le) : les fabriques de `ts.Program` sont PARTAGÉES. Credo, verbatim : « Pas de code mort, de deprecated, de rétro-compatibilité, ni de duplication » ; « Un audit se clôt par des GARDES, pas par une purge » ; « Réutiliser l'existant — le CANONIQUE, pas le voisin. »

## Cas canonique
`virtualProgram` (sources en mémoire + lib standard) et `repoProgram` (programme du dépôt) de `tsProgram.mjs` ; `parsedProgram` (arbre déjà parsé, sans lib). Les trois sites de test en sont des instances (le juge le prouve pour deux ; le troisième demande un paramètre de `repoProgram`).

## Portes (sortie brute, code sans pipe)
`npm run typecheck:fast` ; `npx vitest run --no-cache` sur `src/lib/coupeAuMot.test.ts`, les trois tests migrés, la garde neuve, `src/analyse-retention-guard.test.ts`, `src/comment-poison-guard.test.ts`, `src/data/field-consumers.test.ts` ; eslint ; `node scripts/docs/build-effects.mjs --check` ; `npm run docs:build` puis `npm run docs:check` (exit 0). L'orchestrateur rejoue toutes les gates ensuite.

## Livrable
`/tmp/claude-0/-home-user-game/365ab83c-b2bf-5700-91e2-3605a34e86da/scratchpad/rendu-train6.md` + résumé factuel.
