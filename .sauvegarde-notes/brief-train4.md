# Brief du codeur : R-M2 lot A, train 4 — verdict du juge du train 3 + rouge `analyse-retention-guard` (#1806), 2026-09-28

## Worktree et interdits
- `/home/user/game/.wt-1806-L1`, branche `wt/1806-L1`, HEAD `f45c18692`. Le train 3 est INDEXÉ (78 fichiers) : n'y touche pas par git ; tes modifications vont dans l'arbre de travail par-dessus (l'orchestrateur indexera).
- Interdits : tout `git checkout/restore/reset/stash/add/commit/apply`, écriture dans `node_modules`. Chemins absolus ; l'arbre principal doit rester propre. Processus bornés, listés au rendu. Budget : **1 h 15**.

## Rouge à faire tomber (gates locales de l'orchestrateur sur train 3, `npm test`)
```
FAIL src/analyse-retention-guard.test.ts > garde de classe #1801 — une structure d'analyse ne vit pas en portée de collection > aucun module chargé par la suite ne retient une structure d'analyse
+   "src/ui/raccourcis-registre.test.ts:50 arbres (.set()",
+   "src/ui/raccourcis-registre.test.ts:169 DEPOT (initialisée)",
```
Lis la garde (`src/analyse-retention-guard.test.ts`) pour savoir ce qu'elle interdit et pourquoi (#1801), et corrige la cause, pas la garde.

## Verdict du juge du train 3 (verbatim, copie : `/tmp/claude-0/-home-user-game/365ab83c-b2bf-5700-91e2-3605a34e86da/scratchpad/juge-train3/verdict.txt`, sondes `sonde-borne.mjs`, `sonde-garde.mts`)
- **E1 (régression du train 3)** : « Quatre sites passent `max - 1` à `coupeAuMot` pour borner le rendu, ellipse comprise. Or `coupeAuMot(s, n)` ne rend le texte entier que si `s.length <= n`. Un texte d'exactement `max` caractères, entier à HEAD, est donc coupé maintenant. » Sites : `scripts/source/prose-source-plugin.mjs:81` (`TITRE_MAX` = 60, titre de chapitre VISIBLE dans l'éditeur), `scripts/ops/etapesDuTrain.mjs:188` (120), `scripts/guards/lib/gitPorte.mjs:89` (`RAISON_MAX` = 200), `scripts/ui/audit-i18n.mjs:205` (59, HEAD coupait au-delà de 60). « Correction retenue (règle générale). Le contrat de la primitive devient « `n` borne le RENDU, ellipse comprise » : texte entier si `s.length <= n`, sinon coupe cherchée à `n-1`. Les quatre sites passent alors `max`. Le test de la primitive couvre les deux frontières : longueur `n` rendue entière, longueur `n+1` coupée avec un rendu d'au plus `n`. Les 8 sites de `src/` se relisent à un caractère près. » → relis TOUS les appelants (`git grep -n coupeAuMot`) contre leur seuil d'avant (`git show c160fc3c3:<fichier>`) ; la sonde `sonde-borne.mjs` devient un test.
  - Nota : un premier mot plus long que `n` reste rendu entier (contrat R-M2 ; arbitrage de l'orchestrateur : perte acceptée) ; le « au plus `n` » vaut donc hors ce cas — dis-le exactement dans l'en-tête de la primitive.
- **E2** : « `gitPorte.mjs:47` dit « Longueur maximale d'une `raison` » ; `empreinte-sources.mjs:300` dit « rendu JSON borné » […] Correction : « coupée au mot vers N (`coupeAuMot`) ». »
- **E3** : garde `coupeAuCaractere.mjs:88-94` (`suiviEnJsx`) « ne regarde que le frère immédiat […] En JSX sur plusieurs lignes, ce frère est un nœud de texte fait uniquement de blancs » → sauter les `JsxText` `containsOnlyTriviaWhiteSpaces` + cas au témoin ; faux positifs de portée `constOmbree` (table `litteraux` indexée par nom sur tout le fichier) et `deuxInstrPortéeInterne` (paramètre homonyme) → résolution par SYMBOLE/portée, pas par nom ; « L'en-tête dit « réassignée (`let`) », mais en fait tout `let` échappe » → l'en-tête dit vrai. La sonde `sonde-garde.mts` devient des cas du test.
- **E4** : « `raccourcis-registre.test.ts:44-140` : le résolveur par l'AST (`valeurs`, `resoudre`, `ecouteurGlobal`, une centaine de lignes) vit dans le fichier de test. Le patron du même lot, `coupeAuCaractere.mjs` + `.d.mts`, le met sous `scripts/guards/lib/` […] Correction : `scripts/guards/lib/raccourcisGlobaux.mjs` + `.d.mts`, consommé par le test. » — c'est aussi là que se règle la rétention d'`arbres`/`DEPOT` (le module de garde ne retient aucune structure d'analyse en portée de module : suis ce que la garde #1801 exige et le patron de `coupeAuCaractere.mjs`).

## Invariant
Credo, verbatim : « Règles GÉNÉRALES, jamais spécifiques. » ; « Réutiliser l'existant — le CANONIQUE, pas le voisin. » R-M2 (`docs/plans/2026-08-16-spec-hud-combat.md:71-74`) : « Aucun mot tranché, nulle part ».

## Portes (sortie brute, code sans pipe)
- `npm run typecheck:fast` ; `npx vitest run --no-cache src/analyse-retention-guard.test.ts src/ui/raccourcis-registre.test.ts src/coupe-au-caractere-guard.test.ts src/lib/coupeAuMot.test.* src/comment-poison-guard.test.ts` + les tests des appelants de `coupeAuMot` ; `node --test` des tests `scripts/**` touchés (`gitPorte`, `publier`, `etapesDuTrain`, `empreinte-sources`, et ceux du plugin de prose et d'`audit-i18n` s'ils existent) ; eslint ; `npm run docs:build` puis `npm run docs:check` (exit 0).
- Mutation pour chaque test neuf.
- L'orchestrateur rejoue ensuite toutes les gates.

## Livrable
`/tmp/claude-0/-home-user-game/365ab83c-b2bf-5700-91e2-3605a34e86da/scratchpad/rendu-train4.md` + résumé factuel.
