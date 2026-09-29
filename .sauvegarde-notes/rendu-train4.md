# Rendu train 4 : R-M2 lot A (#1806), 2026-09-28

Worktree `/home/user/game/.wt-1806-L1`, HEAD `f45c18692` avec l'index du train 3 intact. Tout le travail est dans l'arbre de travail : je n'ai lancé aucune commande git d'écriture. Arbre principal `/home/user/game` : `git status --short` est vide, rien n'a fui.
Horloge : départ 15:29:42 UTC, rendu vers 17:41 UTC. L'horloge murale a sauté d'environ 1 h 40 entre deux commandes (vitest « Start at 17:15:51 », juste après un run de 15:33). Le temps de travail effectif tient dans le budget, mais le temps d'horloge le dépasse.

## Diff (hors docs générés)
```
 scripts/docs/lib/empreinte-sources.mjs  |   4 +-
 scripts/guards/lib/coupeAuCaractere.mjs |  59 +++++++----
 scripts/guards/lib/gitPorte.mjs         |   6 +-
 scripts/guards/lib/gitPorte.test.mjs    |   3 +
 scripts/ops/etapesDuTrain.mjs           |   4 +-
 scripts/ops/publier.test.mjs            |   3 +
 scripts/source/prose-source-plugin.mjs  |   4 +-
 scripts/ui/audit-i18n.mjs               |   2 +-
 src/coupe-au-caractere-guard.test.ts    |  17 +++
 src/data/source/prose-source.test.ts    |   3 +
 src/lib/coupeAuMot.mjs                  |  10 +-
 src/lib/coupeAuMot.test.ts              |  17 ++-
 src/ui/raccourcis-registre.test.ts      | 178 ++++----------------------------
```
Fichiers neufs (non suivis) : `scripts/guards/lib/raccourcisGlobaux.mjs`, `scripts/guards/lib/raccourcisGlobaux.d.mts`.
Docs générés par `npm run docs:build` : 35 fichiers `docs/**`. Le diff ne touche que la ligne `sources-empreinte` de chacun, parce que leurs sources lues (dont `src/lib/coupeAuMot.mjs`) ont bougé.

## Le rouge `analyse-retention-guard` : tombé par sa cause (E4)
- Cause : `src/ui/raccourcis-registre.test.ts:48` tenait une carte d'arbres `arbres` en portée de module, et `:169` y tenait `DEPOT = new Map(CORPUS.map…)`, un dérivé de corpus. C'est la classe #1801.
- Correction : le résolveur par l'AST (`valeurs`, `resoudre`, `ecouteurGlobal`, le verdict) passe dans `scripts/guards/lib/raccourcisGlobaux.mjs` et son `.d.mts`, sur le patron de `coupeAuCaractere.mjs`.
  - Une fonction interne `passe(fichiers)` construit le dépôt et la carte d'arbres DANS l'appel.
  - La lib exporte `verdictClavier(fichier, depot?)`, `fautesClavier(fichiers)`, `marquesHorsRegistre(fichiers)` et `LIGNES_ENTETE`.
  - Le test ne retient plus que `readCorpus(['src'])`, appelé dans chaque `it`. Le corpus lui-même est licite (témoin de la garde).
- Vérification : `src/analyse-retention-guard.test.ts` passe à 20/20 (sortie `t4-final-vitest.out`). La garde elle-même n'est pas touchée.

## E1 : contrat de `coupeAuMot`
- `src/lib/coupeAuMot.mjs:9-17` : `n` borne le RENDU, ellipse comprise. Le texte est rendu entier si `s.length <= n`. Sinon la coupe se cherche à l'index `n - 1` (`let coupe = n - 1`), ce qui donne au plus `n` caractères.
- L'en-tête dit l'exception exactement : « Seule sortie au-delà de `n` : un premier mot plus long que `n - 1` se rend entier (suivi de « … » si du texte le suit) ».
- Les 4 sites passent désormais `max` : `scripts/guards/lib/gitPorte.mjs:89`, `scripts/ops/etapesDuTrain.mjs:188`, `scripts/source/prose-source-plugin.mjs:81`, `scripts/ui/audit-i18n.mjs:205` (60, le seuil `> 60` de HEAD).
- Relecture de tous les appelants contre `c160fc3c3`. Le seuil « entier si ≤ T » est conservé partout avec le `n` actuel :
  - Sites où HEAD rendait jusqu'à `n+1` caractères ; ils rendent maintenant au plus `n` (1 de moins), au même seuil : `empreinte-sources` (LARGEUR), `sujetDeCommit` (120), `solde-ticket-guard` (80), `reanchor` (46), `derive-decoupes` (70), `night-stake-form` (70), `night-stakes-rules` (60), `trous-de-validation` (40), `bundled-projects` (60), `CodexRef` corps (400) et méta (140), `CharacterCreator` blurb (300/220), `DialogueDetail` (24/38).
  - Sites strictement identiques à HEAD : `EffectList` (46) et `GameOpEditor` (40).
  - Aucun site `src/` ne change donc de `n`.
- Tests :
  - `src/lib/coupeAuMot.test.ts` gagne « `n` borne le RENDU… » : longueur `n` rendue entière, longueurs `n+1` à `n+5` coupées en au plus `n`, pour n ∈ {7, 8, 25, 59, 60, 119, 120, 200}.
  - Le cas `('un deux trois', 7)` suit le contrat : 7 donne `'un…'`, et `'un deux…'` passe à `n = 8`.
  - La sonde `sonde-borne.mjs` devient trois assertions aux tests des sites : `gitPorte.test.mjs` (raison de 200 caractères entière), `publier.test.mjs` (titreDeCommit de 120 caractères entier), `prose-source.test.ts` (« Les Répurgateurs et la Chasse aux Sorcières dans le Reikland », 60 caractères, entier).
- `audit-i18n.mjs` n'a pas de test. C'est un script d'impression console, couvert seulement par le contrat de la primitive.

## E2 : commentaires
- `gitPorte.mjs:48` et `:51` disent « coupée au mot vers `RAISON_MAX` (`coupeAuMot`) ».
- `empreinte-sources.mjs:297` et `:300` disent « coupé au mot vers `LARGEUR` (`coupeAuMot`) ».
- Même correction de classe à `etapesDuTrain.mjs:185` (« bornée » devient « coupée au mot vers `max` ») et à `prose-source-plugin.mjs:46` (« Longueur maximale » devient « coupé au mot vers `TITRE_MAX` »).

## E3 : garde `coupeAuCaractere.mjs`
- `suiviEnJsx` : le frère suivant se cherche en sautant les `JsxText` `containsOnlyTriviaWhiteSpaces`.
- Portée : les noms se résolvent désormais par SYMBOLE. `verificateurDe(ts, racine)` monte un `ts.createProgram` sur le seul arbre déjà parsé (`noLib`, `noResolve`, `allowJs`), et son vérificateur fait `getSymbolAtLocation`. Il est construit paresseusement, seulement si un nom doit être résolu, et vit dans l'appel.
  - La table `litteraux` indexée par nom disparaît. `constanteDe(id)` rend la `const` que désigne le symbole.
  - `ellipseeParSonNom` compare le symbole (`constanteDe(n) === decl`).
  - Coût mesuré : corpus src+scripts à 8,25 s contre 8,05 s au juge.
  - `virtualProgram` (`tsProgram.mjs`) n'est pas réutilisé : il reparse ses sources depuis des TEXTES et charge la lib, alors qu'ici il faut les nœuds de l'arbre déjà tenu, sans la lib. À juger.
- En-tête (`:6-13`) : il dit « liée à un `let` ou un `var` » hors portée, « une constante importée » hors portée, et la résolution par symbole.
- Cas au témoin (`src/coupe-au-caractere-guard.test.ts`) :
  - JSX multi-ligne `{'…'}` et `…` : vus ; une balise entre les deux : muet.
  - Constante ombrée et constante locale qui masque : muets ; constante du module vue d'une portée interne : vue.
  - Paramètre homonyme : muet ; coupe ellipsée depuis une portée interne : vue.
  - `jsxAttribut` et `…` : vus ; `let` : muet, conforme à l'en-tête.
- Corpus src+scripts : 0 site.

## Table des mutations (fichier muté, `git hash-object` avant / muté / après, rouge nommé)
| # | fichier | mutation | avant | muté | après | rouge | vert |
|---|---|---|---|---|---|---|---|
| M1 | src/lib/coupeAuMot.mjs | `n - 1` → `n` | e678f43a | 3d17a303 | e678f43a | « `n` borne le RENDU… » : `longueur 9 : mot mot…: expected 8 to be less than or equal to 7` ; + `'un deux…' to be 'un…'` | 8/8 |
| M2 | scripts/guards/lib/gitPorte.mjs | `RAISON_MAX` → `RAISON_MAX - 1` | 0c4b7ea6 | 2f80893c | 0c4b7ea6 | `not ok 1 - classer : la RAISON…` (actual `…mot…`, expected `…motx`) | rc=0 |
| M3 | scripts/ops/etapesDuTrain.mjs | `max` → `max - 1` | 13b2b11c | a86b4a47 | 13b2b11c | `not ok 1 - titreDeCommit…` (actual `…mot…`, expected `…motx`) | rc=0 |
| M4 | scripts/source/prose-source-plugin.mjs | `TITRE_MAX` → `TITRE_MAX - 1` | c34f4223 | 5f16c9ca | c34f4223 | `un titre de 60 caractères se rend entier: expected 'Les Répurgateurs et la Chasse aux Sor…'` | 1 passed |
| M5 | scripts/guards/lib/coupeAuCaractere.mjs | frère immédiat | 45be912e | fd482afc | 45be912e | « JSX sur plusieurs lignes… » `expected [] to deeply equal [ 'temoin.tsx:3' ]` | 5 passed |
| M6 | idem | `constanteDe(n) === decl &&` → `true &&` | 45be912e | 05c01d24 | 45be912e | `paramètre homonyme: expected [ 'temoin.tsx:1' ] to deeply equal []` | 5 passed |
| M7 | idem | `constanteDe` par NOM | 45be912e | ceb6349b | 45be912e | `constante ombrée: expected [ 'temoin.tsx:3' ] to deeply equal []` | 5 passed |
| M8 | scripts/guards/lib/raccourcisGlobaux.mjs | dépôt vide | acba2dba | 03ad4e4c | acba2dba | `table importée d’un module du dépôt: expected 'écouteur global au type d'événement …' to match /hors du registre/` | 7/7 |
| M9 | idem | `mortes` inversé | acba2dba | 2a97f07a | acba2dba | `marque … sans écouteur clavier global: expected [ 'src/ui/Infobulle.tsx', …(3) ] to deeply equal []` | 1 passed |

Incidents :
- M1, premier essai : le test de frontière restait vert sous la mutation, car avec n multiple de 4, `s[n]` n'était jamais une espace. Je l'ai renforcé (n de résidus variés, longueurs n+1 à n+5) et le rouge s'est alors constaté.
- M6, premier essai : mon script inverse ne savait pas remplacer une chaîne vide, donc le fichier est resté muté et le premier M7 a tourné dessus. J'ai remis le fichier à la main (hash 45be912e confirmé), puis rejoué M6 (en `true &&`) et M7 proprement.

Sorties : `scratchpad/t4-mut/M*-{rouge,vert}.out`.

## Portes (code de sortie capturé sans pipe)
- `npm run typecheck:fast` : rc=0, « 0 erreur(s) » (`t4-final-tc.out`).
- vitest `--no-cache` : rc=0, 15 fichiers, 449 tests (`t4-final-vitest.out`).
  - Fichiers : analyse-retention-guard, raccourcis-registre, coupe-au-caractere-guard, coupeAuMot, comment-poison-guard, prose-source, CodexRef, CombatConsole, night-stake-form, night-stakes-rules, trous-de-validation, bundled-projects, EffectList, CharacterCreator, GameOpEditor.
  - Les autres fichiers GameOpEditor.* et DialogueDetail n'ont pas de test propre ; les GameOpEditor.* sont verts au run intermédiaire `t4-v3.out`.
- `node --test` : rc=0, 485/485 (`t4-final-nt.out`) sur gitPorte, publier, etapesDuTrain, empreinte-sources, solde-ticket-guard, reanchor.
- eslint sur les fichiers touchés : rc=0.
- `npm run docs:build` : rc=0, puis `npm run docs:check` : rc=0 (« docs:check — OK … 34 générateur(s) », `t4-docscheck3.out`).
  - Un docs:check intermédiaire était rouge (rc=2, pied périmé sur `docs/raw/reconciliation.md`) : les sources avaient changé après le premier build (test de coupeAuMot renforcé). Rebuild, puis check vert.

## Processus lancés
- Une commande `npm run docs:build` (bornée par `timeout 900`) a été basculée en arrière-plan par l'outil (ID bdsqd4494). Elle s'est terminée seule, rc=0.
- Toutes les autres commandes ont tourné au premier plan, bornées par `timeout`, et sont terminées. Aucune tâche vivante.

## Écarts / à juger
- Pour la résolution par symbole dans `coupeAuCaractere.mjs`, j'ai écrit un programme local sur l'arbre (`verificateurDe`) plutôt que `virtualProgram` (motif ci-dessus, section E3).
- `audit-i18n.mjs` n'a pas de test de site.
