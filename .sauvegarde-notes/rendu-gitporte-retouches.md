# Rendu : `fusionnesEnCours` rentre dans l'union à trois issues (#1806, retouches 1 à 4), 2026-09-28

Arbre `/home/user/game`, branche `chantier/1806`, HEAD `c160fc3c3`. Rien d'indexé ni de committé.

## Diff stat
```
 scripts/guards/lib/gitPorte.mjs      | 27 ++++++++++++---
 scripts/guards/lib/gitPorte.test.mjs | 67 ++++++++++++++++++++++++++++++++++--
 2 files changed, 87 insertions(+), 7 deletions(-)
```
Empreintes avant : gitPorte.mjs `32eb1c7f11fe70471f27e838c5a6a4485e65fa7d`, test `ed12bf0971e998decc58d0fe3474e5798054432b`.
Empreintes après : gitPorte.mjs `7c62ba6057a0a79c6d3ac2323fe62835fac80017`, test `f1e24532d12190ad2fd9a9cffa1452a0c08ef25f`.
Pas touchés : `gitPorte.d.mts` (il ne déclare pas `fusionnesEnCours`) et `revuePalier.mjs` (signature inchangée, `string[]`).

## Points
1. FAIT. `gitPorte.mjs:890-905`. La lecture passe par `tenter` (`gitPorte.mjs:~113`) : une erreur fs, un répertoire à la place du fichier compris, part à `confier` sous la forme `MERGE_HEAD illisible : <raison>`. `confier` lève `GitIndisponible`, ou rend `[]` sous `enPanne`. Chaque LIGNE (découpe `\n` avec un LF final, comme `strbuf_getline_lf`) est résolue par `shaDe` (`rev-parse --verify <ligne>^{commit}`, même pelage que `get_merge_parent`). Une ligne que `shaDe` ne résout pas, ou que l'hôte ne pose pas (`revisionFautive` : ligne vide, `-…`, caractère de contrôle, `@{`), part à `confier` sous la forme `dépôt corrompu : MERGE_HEAD, « <ligne> » ne nomme aucun commit`. On retrouve la forme de `corrompu()` (`gitPorte.mjs:407`). Le filtrage silencieux a disparu. L'ancien `natureDuChemin(...) !== 'fichier' → []` faisait passer un MERGE_HEAD-répertoire pour « hors fusion ». Désormais, seul `absent` vaut hors fusion.
   Refactor associé : j'ai extrait le prédicat de `revisionsDe` dans `revisionFautive` (`gitPorte.mjs:356-357`), qui a maintenant deux usages. Il n'y a qu'une définition.
2. FAIT. JSDoc `gitPorte.mjs:882-888`. Version installée : `git version 2.43.0`. Sources lues par curl au tag `v2.43.0` (code 0, fichiers de 1895 et 1786 lignes, plus `commit.c`) :
   - `builtin/merge.c:1044` `strbuf_addf(&buf, "%s\n", oid_to_hex(oid));`, `:1046` `write_file_buf(git_path_merge_head(the_repository), buf.buf, buf.len);`
   - `builtin/commit.c:1773` `while (strbuf_getline_lf(&m, fp) != EOF) {`, `:1776` `parent = get_merge_parent(m.buf);`, `:1778` `die(_("Corrupt MERGE_HEAD file (%s)"), m.buf);`
   - `commit.c:1700` `struct commit *get_merge_parent(const char *name)` (fait `repo_get_oid` puis `repo_peel_to_type(... OBJ_COMMIT)`)
   ÉCART : le juge citait `builtin/commit.c:1873` et `builtin/merge.c:1141`, qui correspondent à une autre version de git. Je n'ai pas lu ces lignes-là. Je ne cite que les lignes v2.43.0 vérifiées, et la JSDoc nomme la version.
3. FAIT. En-tête `gitPorte.mjs:22-23` : « L'unique LECTURE D'ÉTAT hors commande git — `MERGE_HEAD` (`fusionnesEnCours`) — passe par `tenter` et `confier` : mêmes trois issues. »
4. FAIT. `gitPorte.test.mjs:1131` fixture `depotEnFusion(branches)` : `instanceDeDepot` + `envDeDepotForge`, puis `merge --no-commit --no-ff`. Tests :1145 hors fusion `[]` ; :1152 fusion simple ; :1159 octopus à deux lignes (témoin : le contenu de MERGE_HEAD) ; :1167 ligne non résolue (`ZERO`, `pas-un-commit`, `''`, `-x`), qui lève et, sous `enPanne`, rend `[]` avec la raison exacte ; :1180 MERGE_HEAD remplacé par un répertoire, qui donne `MERGE_HEAD illisible : EISDIR` (lève, ou `[]` + panne confiée).

## Mutations (fichier muté : gitPorte.mjs, base `7c62ba60…`)
| mutation | empreinte mutée | rouge | remise |
|---|---|---|---|
| hors : `readFileSync` sans la garde `absent` | `77920517…` | 1 hors fusion | `7c62ba60…` |
| simple : `return []` | `5d076883…` | 2 simple, 3 octopus | `7c62ba60…` |
| octopus : `split('\n').slice(0, 1)` | `387d4689…` | 3 octopus (et 4) | `7c62ba60…` |
| corrompu : `if (!sha) continue` (ancien filtrage) | `01d7a692…` | 4 corrompu | `7c62ba60…`, remise faite à la main, voir plus bas |
| illisible : `if (!lu.disponible) return []` | `506e1adf…` | 5 illisible (et 4 : mutation empilée sur la précédente, voir plus bas) | `01d7a692…` puis `7c62ba60…` |
Chaque mutation : exit=1 au rouge. La remise automatique de « corrompu » a échoué parce que `if (!sha) continue` apparaît aussi en `gitPorte.mjs:405`. La mutation « illisible » s'est donc jouée par-dessus « corrompu », d'où le test 4 rouge en même temps. J'ai remis « illisible » par script (retour à `01d7a692…`), puis « corrompu » à la main, sur le contexte unique de la ligne 900 : empreinte finale `7c62ba6057a0a79c6d3ac2323fe62835fac80017`, identique à la base.

## Portes (sortie redirigée, `$?` immédiat)
- `node --test scripts/guards/lib/gitPorte.test.mjs` : exit=0, tests 60, pass 60, fail 0.
- Tests de revuePalier (`git grep -l revuePalier -- 'scripts/**/*.test.*'`, soit `scripts/hooks/solde-ticket-guard-driver.test.mjs` et `scripts/hooks/solde-ticket-guard.test.mjs`) : exit=0, tests 334, pass 334.
- `npx eslint scripts/guards/lib/gitPorte.mjs scripts/guards/lib/gitPorte.test.mjs` : exit=0, sortie vide.
- `npx vitest run --no-cache src/comment-poison-guard.test.ts` : exit=0, 79/79.

## Reste nommé
- Sous `enPanne` seulement : si `shaDe` rencontre une INDISPONIBILITÉ git sur une ligne, il la confie puis rend `null`, et `fusionnesEnCours` confie ensuite en plus « dépôt corrompu : MERGE_HEAD… ». `enPanne` reçoit alors deux raisons, dont la seconde est inexacte. Sans `enPanne` (le cas de `revuePalier.mjs:122`), `shaDe` lève d'abord et la vraie raison passe. Corriger demanderait que `shaDe` distingue « absent » de « confié » pour son appelant : c'est un changement de signature hors du brief, donc non fait.
- Une ligne en `@{…}` est déclarée corrompue alors que `get_merge_parent` pourrait la résoudre. git n'écrit jamais que de l'hex (`merge.c:1044`), et l'hôte refuse de poser `@{` (`revisionsDe`).

## Processus
Tous au premier plan, bornés par `timeout`, tous terminés : 3 `curl` (sources git), `node --test` (1 run ciblé, 5 runs de mutation, 1 run complet, 1 run revuePalier), `npx eslint`, `npx vitest`. Aucune tâche en arrière-plan. Arbre principal = arbre de travail : `git status --short` ne montre que les 2 fichiers du périmètre.
