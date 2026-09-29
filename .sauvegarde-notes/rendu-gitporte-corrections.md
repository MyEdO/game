# Rendu : corrections gitPorte (#1806), 2026-09-28

Arbre `/home/user/game`, branche `chantier/1806`, HEAD `46bac485e`. Aucun geste git d'écriture. Rien sous `src/**` ni `docs/**`.

## Fichiers touchés (`git diff --stat -- scripts`)
- scripts/guards/lib/gitPorte.mjs      | 46 (+38/-8) -> hash 67b8d82a4f12b3071438540b33d6ffe58573f4df (avant 7c62ba60)
- scripts/guards/lib/gitPorte.test.mjs | 50 -> ffdd99ee (avant f1e24532)
- scripts/ops/etapesDuTrain.mjs        | 17 -> 72938706 (avant 75e2a819)
- scripts/ops/publier.mjs              |  6 -> b840c312 (avant cee1ce99)   <- HORS périmètre listé, voir Écarts
- scripts/ops/publier.test.mjs         |  4 -> 87654772 (avant b32dae88)   <- HORS périmètre listé, voir Écarts
- gitPorte.d.mts : inchangé (`rebaseEntame` n'a pas de consommateur TypeScript).

## D1 : `fusionnesEnCours` (gitPorte.mjs:893-914)
- Lignes fautives d'abord : `lignes.find(revisionFautive)` -> `confier('dépôt corrompu : MERGE_HEAD, « l » ne nomme aucun commit')`, AVANT toute requête. Une ligne fautive n'est donc jamais posée à `cat-file`.
- Puis UNE requête : `lire(depot, ['cat-file', '--batch-check'], { entree: lignes.map((l) => `${l}^{commit}\n`).join('') })`, même patron que `bornesDe` (gitPorte.mjs:380-384 avant, `lire`/`entree` vérifiés à :248-250 / :158-166).
- `brut === null` (panne déjà confiée une fois) -> `[]`.
- Réponse i : `/^([0-9a-f]+) commit /.exec(reponses[i] ?? '')?.[1]` ; absente -> `confier(dépôt corrompu …)` ; le sha est le premier champ.
- Alignement : `\n` est impossible dans une ligne (le fichier est découpé sur `\n`) ; `\r` et tout caractère de contrôle, `-x`, la ligne vide et `@{` sont écartés par `revisionFautive` (`porteUnControle`, gitPorte.mjs:361-365), ce qui fait une ligne de lot par ligne du fichier. `cat-file --batch-check` au format par défaut prend la ligne entière pour nom d'objet. `@{` exclu : c'est le cas où `cat-file` meurt et perd les lignes suivantes (commentaire existant de `revisionsDe`). Une réponse manquante (`reponses[i]` undefined) part en « corrompu », jamais en succès.
- Fichier vide : `[]` sans requête.

## D2 : en-tête exact et question « rebase entamé » dans l'hôte
- En-tête gitPorte.mjs:22-24 : « Le DISQUE, l'hôte le lit par `natureDuChemin` (`statSync`), et par elle ses deux lectures d'ÉTAT GIT hors commande git — la fusion en cours (`MERGE_HEAD`, `fusionnesEnCours`, `readFileSync`) et le rebase entamé (`rebaseEntame`) — qui passent par `tenter` et `confier` : mêmes trois issues. »
- Nouveau `rebaseEntame(depot)` (gitPorte.mjs:917-936) : `ETATS_DE_REBASE = ['rebase-merge', 'rebase-apply']` (réf `wt-status.c`, `wt_status_check_rebase`). Pour chaque nom : `cheminGit`, puis `tenter(() => natureDuChemin(resolve(depot.cwd, chemin)))`. Illisible -> `confier('<nom> illisible : …')`. Si le chemin n'est pas `'absent'`, la fonction rend le NOM, sinon `null`. `null` sous `enPanne` si c'est une panne. `!== 'absent'` garde la sémantique de l'ancien `existsSync`.
- etapesDuTrain.mjs : imports `existsSync`/`resolve` retirés. preflight :297-299 `questions.rebaseEntame()` (le message nomme toujours `rebase-merge`/`rebase-apply`). Étape rebase :367 `questions.rebaseEntame() !== null`. Le `racine` inutilisé de l'étape rebase est retiré.
- publier.mjs:51-52,476 : `questionsDuTrain` expose `rebaseEntame` à la place de `cheminGit` (plus aucun consommateur de `questions.cheminGit`).

### Contre-grep `git grep -n "rebase-merge\|rebase-apply\|MERGE_HEAD\|existsSync" -- scripts`
Complet : scratchpad/grep-avant.txt et grep-apres.txt. existsSync : 289 lignes avant, 286 après. Diff (avant `<` / après `>`), lignes hors hôte :
```
< scripts/ops/etapesDuTrain.mjs:14:import { existsSync } from 'node:fs'
< scripts/ops/etapesDuTrain.mjs:299:      for (const nom of ['rebase-merge', 'rebase-apply']) {
< scripts/ops/etapesDuTrain.mjs:301:        if (chemin && existsSync(resolve(racine, chemin)))
< scripts/ops/etapesDuTrain.mjs:371:        const entame = ['rebase-merge', 'rebase-apply'].some((nom) => {
< scripts/ops/etapesDuTrain.mjs:373:          return Boolean(chemin) && existsSync(resolve(racine, chemin))
< scripts/ops/publier.test.mjs:380:  assert.throws(() => ctx.questions.cheminGit('rebase-merge'), GitIndisponible)
```
Après, `rebase-merge|rebase-apply|MERGE_HEAD` n'apparaît plus que dans gitPorte.mjs (:23, :884, :894, :898, :901, :918, :924) et gitPorte.test.mjs.

## D3 : tests (gitPorte.test.mjs)
- `depotFeint(cwd, repondre, enPanne)` : 3e paramètre optionnel (:43).
- « illisible » (:1180-1191) : `assert.equal(pannes.length, 1)` + `assert.match(pannes[0], /^MERGE_HEAD illisible : EISDIR/)`.
- NEUF (:1193-1210) « git EN PANNE sur les lignes de `MERGE_HEAD` — UNE requête, UNE panne, la sienne ». Il promeut la sonde du juge : feint `fatal: boum` sur tout sauf `--git-path`. Sans `enPanne` : lève `GitIndisponible` de raison `fatal: boum`. Sous `enPanne` : `[]`, `assert.deepEqual(pannes, ['fatal: boum'])`, requêtes = `[['rev-parse','--git-path'],['cat-file','--batch-check']]`.
- NEUF (:1212-1223) « rebaseEntame : `null` hors rebase, puis le NOM… » sur un vrai dépôt : `mkdir .git/rebase-merge` puis `.git/rebase-apply`.
- NEUF (:1225-1235) « rebaseEntame : git en panne ou chemin d'état ILLISIBLE ». Cas 1 : feint `fatal: boum`. Cas 2 : `--git-path` rendu de plus de 8192 caractères, soit `ENAMETOOLONG` au `statSync`. Dans les deux cas, lève `GitIndisponible` sans enPanne, et sous enPanne rend `null` avec exactement 1 panne.

## Preuves

### Tests (redirection fichier, `$?` immédiat)
- `node --test scripts/guards/lib/gitPorte.test.mjs` : exit=0, tests 63 pass 63 fail 0
- `node --test scripts/ops/etapesDuTrain.test.mjs` : exit=0, 4/4
- `node --test scripts/ops/publier.test.mjs` : exit=0, 84/84
- `node --test scripts/gates/ecrivainsAtteints.test.mjs` (3e fichier du `git grep -l etapesDuTrain`) : exit=0, 6/6
- `node --test scripts/hooks/solde-ticket-guard*.test.mjs` (driver + guard) : exit=0, 334/334
- `npx eslint` sur les 5 fichiers : exit=0, sortie vide.

### Mutations (harnais scratchpad/muter.mjs : remplacement exact unique, remise = réécriture du contenu original, empreintes prises par `git hash-object`)
| # | Mutation | Fichier : avant / muté / après | Rouge | Vert |
|---|---|---|---|---|
| M1 | retour à l'ancienne boucle `shaDe` ligne à ligne | gitPorte.mjs 67b8d82a / a76929e1 / 67b8d82a (identique) | exit 1, `not ok 6 - fusionnesEnCours : git EN PANNE … UNE requête, UNE panne, la sienne` (pass 5 fail 1) | exit 0, 6/6 |
| M2 | panne « illisible » confiée deux fois | gitPorte.mjs 67b8d82a / e9ad387f / 67b8d82a | exit 1, `not ok 5 - fusionnesEnCours : un MERGE_HEAD illisible est INDISPONIBLE…` | exit 0, 6/6 |
| M3 | `rebaseEntame` débranché (`=== 'jamais'`) | gitPorte.mjs 67b8d82a / d2e366c9 / 67b8d82a | exit 1, `not ok 1 - rebaseEntame : null hors rebase, puis le NOM…` | exit 0, 2/2 |
| M4 | `tenter` retiré (`fait(natureDuChemin(...))`) | gitPorte.mjs 67b8d82a / e505c698 / 67b8d82a | exit 1, `not ok 2 - rebaseEntame : git en panne ou chemin d'état ILLISIBLE…` | exit 0, 2/2 |
| M5 | câblage `questionsDuTrain.rebaseEntame: () => null` | publier.mjs b840c312 / 79c78921 / b840c312 | exit 1, `not ok 1 - git INDISPONIBLE : le train LÈVE GitIndisponible…` | exit 0, 1/1 |

### Sonde du juge rejouée (`juge-gitporte/sonde.mjs`, exit 0, sortie scratchpad/sonde.txt)
Il ne reste plus aucun cas à deux pannes. La sonde feint `cat-file` en `status 0, stdout ''` et ne met en panne que `rev-parse --verify` : elle modèle l'ANCIENNE requête. Sous le nouveau code, ses lignes hexadécimales tombent donc en « corrompu » (réponse vide), ce qui est un artefact du feint. Le cas « panne » réel est couvert par le test neuf :1193.

## Écarts
1. Périmètre : D2 exige que `etapesDuTrain.mjs` consomme la question. Or les étapes ne tiennent que `ctx.questions`, construit par `questionsDuTrain` (publier.mjs:472-484) et verrouillé par publier.test.mjs:353 (clés) et :380. `publier.mjs` et `publier.test.mjs` sont donc touchés (3 lignes + 2 lignes), et `cheminGit` en est retiré : il n'avait plus de consommateur, et le garder aurait laissé du code mort.
2. `cheminGit` reste exporté par gitPorte.mjs. Consommateurs : `fusionnesEnCours`, `rebaseEntame` (internes) et gitPorte.test.mjs:688, :1108. Hors de l'hôte, plus personne ne l'importe. Un garde d'exports inutilisés, s'il existe, peut le signaler.
3. Hors périmètre, non corrigé : lectures d'état git par `existsSync` hors de l'hôte, hors du motif du contre-grep, qui détectent un `.git` (repo racine). Sites : `scripts/guards/lib/arbreImbrique.mjs:13` (`existsSync(join(dossier, '.git'))`) et `scripts/hooks/solde-ticket-guard.mjs:2577` (`existsSync(join(courant, '.git'))`).

## Processus
Aucun processus d'arrière-plan. Toutes les commandes ont tourné au premier plan, sous `timeout` pour les runners, et sont terminées. Le répertoire temporaire de la sonde (`scratchpad/sonde-run`) est supprimé.
