# Rendu train 7 — R-M2 lot A (#1806), 2026-09-28

Worktree /home/user/game/.wt-1806-L2, HEAD 20b8afba5. Arbre principal : `git status --short` vide (aucune fuite).

## G2 — LIVRÉ
- src/data/primitives.manifest.json : entrée `tsProgram` insérée juste après `constructionsReservees` (même forme que les 14 voisines d'outillage : id, type, label, fichier, concept, perimetre, verrou). Label, fichier, concept et verrou repris verbatim du verdict. `perimetre` (le verdict ne le donne pas) : « toute garde ou tout générateur qui a besoin d'un vérificateur de types », tiré de l'en-tête tsProgram.mjs:1-3. Empreinte après : b96959bcb8812063ebce5a472c5e415c5770be64.
- `npm run docs:build` rc=0. Régénérés : docs/primitives.md (153→154 et une ligne), docs/systemes.md (+ligne de matrice, + « signalé, pas forcément un défaut », comme les voisines sourceCorpus/canonUnique), src/data/schemas/_ids.generated.ts (+id), docs/structures-donnees.md et docs/donnees.md (compteurs +1), plus des empreintes `sources-empreinte` dans ajouter-une-icone, codex-relations, consommateurs-de-champs, orphelines-donnees, raw/reconciliation, registre-jets, sorts-implementation, usages-jets et vocabulaire-mecanique (le manifeste fait partie de leurs sources).

## G1 — ARRÊTÉ : la spec est contredite par le code
Le point (b) du verdict dit que `origineImportee(id, sf)` (canonUnique.mjs:404) « attrape l'import renommé ». C'est faux pour `typescript`. `origineImportee` résout le spécificateur par `moduleDe` → `resolveImport`, et son JSDoc (canonUnique.mjs:399-401) indique qu'elle rend `null` pour un paquet. Sonde (fichier temporaire dans le worktree, supprimé ensuite) sur `import { createProgram as fab } from 'typescript'; fab();` : `origineImportee('fab', sf)` → `null`, rc=0.
Aucun code n'a été modifié pour G1 : canonUnique.mjs et le témoin sont intacts. Deux conceptions sont possibles, et l'arbitrage revient à l'orchestrateur ou au juge :
 1. Utiliser `liaisonDe(id, sf)` (canonUnique.mjs:371, privée). C'est le socle même d'`origineImportee` : elle rend `{spec, nom}` sans résolution. Le test serait `spec === 'typescript'` et `FABRIQUE.test(nom)`. Le membre ne compterait que si le récepteur est lié à `typescript` (`nom` `default` ou `*`), ce qui écarte l'homonyme métier.
 2. Étendre `origineImportee` aux paquets (par exemple `module: 'typescript'` pour un spécificateur nu). Le contrat d'une primitive partagée changerait alors, et ses consommateurs sont registryIdBranch.mjs:145 et `estAppelDeclare` (:421), via rollSeamExclusivity, battleRngEngineLeak et cleEnLigne.
Pour (c), il reste à reconnaître ou déclarer hors de portée : l'accès calculé `ts['createProgram']`, la déstructuration renommée `const { createProgram: fab } = ts`, et aussi `const creer = ts.createProgram`, `ts` reçu par paramètre, `require`/`import()` dynamique.

## Autres constructions de canonUnique.mjs qui lisent un nom ÉCRIT (non corrigées)
- canonUnique.mjs:72 `estSelectionDerivee` : le récepteur est comparé au texte de `SCHEMAS_DU_CANON`. Un import renommé du schéma échappe, et un homonyme local blanchit. Même classe que G1 : c'est un nom importé, lu sans `origineImportee`.
- canonUnique.mjs:302 `CONSTRUCTION_DE_PROGRAMME` : l'objet de G1.
- Globaux lus par leur nom (pas d'import possible, seul un masquage local les trompe) : :228 et :258 `Math.abs`/`Math.max`, :315 `JSON.stringify`, :352 `Object.fromEntries`, :89-90 `Partial/Readonly/Required/Record`.
- Noms de méthode ou de propriété, par nature écrits : :64 `extract/exclude`, :269 `appelDeMethode`, :519 `join`, :202 `axes`, :474 `nomDe`.

## Portes (code lu par `$?`, sans pipe)
- `npm run typecheck:fast` rc=0, 0 erreur.
- `npm run docs:check` rc=0 (« docs:check — OK … 17 frais »).
- vitest --no-cache, 12 fichiers rc=0, 242/242 : ts-program-fabrique-guard, analyse-retention-guard, comment-poison-guard ; lecteurs du manifeste : generic-domain-import-guard, maison-sans-source, registry-enveloppe, gallery-exhaustive, primitive-owners-guard ; canonUnique : unions-canon, grid, tableTotale, roll-seam-exclusivity-guard.
- `node --test` litteralJs.test.mjs et stockDeSites.test.mjs rc=0, 33/33.
- eslint : pas lancé. Le lint est une gate du train, et aucun fichier lintable écrit à la main n'a bougé (JSON, docs générés, _ids.generated.ts généré).
- Mutation : aucun test neuf (G1 non codé), donc pas de preuve due.

## Processus
Tout au premier plan et borné par `timeout` : docs:build, typecheck:fast, docs:check, vitest, node --test, la sonde node. Tous sont terminés, aucun n'est encore en cours.

## G1 — LIVRÉ (suite, arbitrage de l'orchestrateur du 2026-09-28, conception 1)
Worktree /home/user/game/.wt-1806-L2, HEAD 20b8afba5 ; G2 conservé (15 fichiers inchangés). Arbre principal : `git status --short` vide.

### Fichiers touchés (empreinte avant, puis après)
- scripts/guards/lib/canonUnique.mjs 7a8d4f15 → 8ba3fa3c
- scripts/guards/lib/canonUnique.d.mts f08df381 → dc8e5c54 (`SCHEMAS_DU_CANON: Readonly<Record<string, readonly string[]>>`)
- src/ts-program-fabrique-guard.test.ts 5670fe3f → 360e3bf1
- src/data/schemas/unions-canon.test.ts f2050a43 → 4493be3f

### Diff
- canonUnique.mjs:407 : nouvelle `liaisonDAppele(e, sf, espaces)` (privée). C'est la liaison d'un APPELÉ sur `liaisonDe` : un identifiant, ou `x.f` quand `x` est lié par l'un des `espaces`. `estAppelDeclare` (:447) la réutilise avec `['*']`, à comportement égal, ce qui supprime la branche identifiant/membre qu'il recopiait. Le contrat d'`origineImportee` ne change pas.
- :300 `FABRIQUE_DE_PROGRAMME = /^create(\w*Program|LanguageService)$/`, et l'indice :314 suit.
- :312 `CONSTRUCTION_DE_PROGRAMME.reconnait(n, sf)` : `liaisonDAppele(n.expression, sf, ['*', 'default'])`, puis `spec === 'typescript'` et le nom EXPORTÉ testé par la regex. Le JSDoc :303-311 déclare HORS DE PORTÉE l'accès calculé, la déstructuration, l'alias de membre, le compilateur reçu en paramètre, `require`, `import ts = require` et `import()`. Il dit aussi qu'un local qui masque l'import est confondu avec lui.
- :53 `SCHEMAS_DU_CANON` devient une table `{ 'src/data/schemas/grammaire/valeurs.ts': [...] }`, de même forme que `fonctions` d'`estAppelDeclare`. :66 `estSelectionDerivee(n, sf)` juge le récepteur par `origineImportee` (le module du dépôt, dans son contrat). `sf` passe par `formeDeRecopie(n, sf)` (:156) et `recopieDeCanon.reconnait(noeud, sf)` (:195), dont la signature d.mts portait déjà `sf`. Le JSDoc déclare HORS DE PORTÉE, vus comme recopie : le module déclarant lui-même, l'espace de noms `v.availabilitySchema` et l'alias local.
- Témoin des programmes (ts-program-fabrique-guard.test.ts:34-52), 13 formes en `it.each`, verdict attendu en donnée :
  - vues : import nommé renommé, espace de noms, `ts.createLanguageService`, `ts.createSemanticDiagnosticsBuilderProgram` ;
  - non vues : homonyme local, membre d'un autre objet, import nommé d'un autre module ;
  - hors de portée (non vues) : accès calculé, déstructuration renommée, alias de membre, paramètre, `require`, `import()`.
- Témoin des sélections (unions-canon.test.ts:188-211), 6 formes en `it.each` sous rel `src/data/schemas/defs/fixture.ts` :
  - blanchies (0) : import du canon, import RENOMMÉ avec `.optional()` ;
  - vues (1) : homonyme local sans import, homonyme importé d'un autre module ;
  - hors de portée, vues (1) : espace de noms, alias local.
  L'ancien cas « `availabilitySchema.extract` sans import → [] » verrouillait la lecture par nom. Il est réécrit avec son import. Le cas `grilleMaison` reste dans son `it`.
- Sites réels : disponibilite.ts:20 reste blanchi (garde du corpus verte), et le corpus n'a aucune construction de programme.

### Mutations (canonUnique.mjs 8ba3fa3c, remis à l'identique à la main par le script inverse, empreinte relue après chaque remise = 8ba3fa3c)
- M1 : lecture par nom écrit restaurée (7975369760) → rc=1, 7 rouges : renommé, homonyme local, autre objet, autre module, paramètre, require, import().
- M2 : regex sans LanguageService (cbf99e62) → rc=1, 1 rouge : LanguageService.
- M3 : espaces `['*']` (59af62d4) → rc=1, 4 rouges : témoin d'origine (import par défaut), LanguageService, BuilderProgram, foyer sous un autre chemin.
- M4 : espaces `['default']` (d2e188c3) → rc=1, 1 rouge : espace de noms.
- M5 : tout appel d'un fichier qui cite `typescript` est vu (0cd390fa) → rc=1, 8 rouges : accès calculé, déstructuration, alias, require, import(), autre objet, témoin, corpus.
- M6 : récepteur jugé sur son texte (275a2e8a) → rc=1, 3 rouges : renommé, homonyme local, autre module.
- M7 : toute sélection blanchie (8ee051cb) → rc=1, 5 rouges : récepteur étranger, homonyme local, autre module, espace de noms, alias.
- M8 : aucune sélection blanchie (27363fdd) → rc=1, 3 rouges : import du canon, renommé, corpus (disponibilite.ts:20).
Chacun des 19 cas neufs rougit sous au moins un mutant, et tout est vert une fois rebranché.

### Portes (code lu par `$?`, sans pipe)
- `npm run typecheck:fast` rc=0, 0 erreur.
- vitest --no-cache : ts-program-fabrique-guard, comment-poison-guard, unions-canon, grid, tableTotale, roll-seam-exclusivity-guard, rc=0, 205/205. Consommateurs d'`estAppelDeclare`/`cleEnLigne` (analyse-retention-guard, cle-de-site-guard, registry-id-branch-guard) : rc=0, 49/49.
- `node --test` litteralJs.test.mjs et stockDeSites.test.mjs : rc=0, 33/33.
- eslint sur canonUnique.mjs, canonUnique.d.mts et les deux tests : rc=0.
- `npm run docs:build` rc=0, aucun fichier de plus. `npm run docs:check` rc=0 (« 17 frais »).

### Masquage des globaux (autre classe, hors lot, listé seulement)
canonUnique.mjs:237 `Math.abs`, :267 `Math.max`, :332 `JSON.stringify`, :369 `Object.fromEntries`, :98-99 `Partial/Readonly/Required/Record` : un local du même nom les trompe.

### Hors périmètre, même classe (signalé)
- src/data/schemas/grammaire/valeurs-de-champ.test.ts:320-322 `RX_SELECTION` et `selectionsSurEnumNomme` : l'enum nommé est reconnu par une regex sur le NOM déclaré (`const X = enumNomme(`) et sur le nom écrit du récepteur. Un import renommé échappe à la garde, et un homonyme la trompe.
- `SCHEMAS_DU_CANON` est exporté (d.mts:29) sans aucun consommateur hors de canonUnique.mjs : c'est antérieur à ce lot.

### Processus
Tout a tourné au premier plan, borné par `timeout` : vitest ×11, typecheck, eslint, docs:build, docs:check, node --test. Tous sont terminés, rien ne reste en arrière-plan.
