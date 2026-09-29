# Brief de corrections : `fusionnesEnCours` sous `enPanne`, en-tête exact, lecture « rebase entamé » dans l'hôte (#1806), 2026-09-28

## Arbre et interdits
- `/home/user/game`, branche `chantier/1806`, HEAD `46bac485e` (ton lot précédent y est COMMITÉ ; ton travail est `git diff`). Un autre codeur travaille dans `src/**` et `docs/**` : n'y touche pas, n'y lance rien.
- Périmètre : `scripts/guards/lib/gitPorte.mjs`, `scripts/guards/lib/gitPorte.d.mts` (si un export neuf), `scripts/guards/lib/gitPorte.test.mjs`, `scripts/ops/etapesDuTrain.mjs` et son test.
- Interdits : tout `git checkout/restore/reset/stash/add/commit/apply`, écriture dans `node_modules`. Processus bornés, listés au rendu. Budget : **45 min**.

## Invariant
`scripts/guards/lib/gitPorte.mjs:1-2`, verbatim : « LECTURES GIT DES PORTES — l'hôte UNIQUE de la forme d'union et des commandes git que les portes (pre-push, garde de solde, revue de palier, stocks de plage, faits de palier, closer) exécutent. »

## Cas canonique
`bornesDe` (`gitPorte.mjs:380-384`) : plusieurs révisions résolues en UNE requête `cat-file --batch-check`, dont `null` signifie « panne déjà confiée une fois ».

## Design jugé : verdict du juge de diff (2026-09-28), À REPRENDRE, formes retenues verbatim
- **D1 (bloquant), `gitPorte.mjs:900-901`** : « Sous `enPanne`, quand git est en panne, une ligne hexadécimale […] produit deux pannes. La première est exacte, `fatal: boum`, confiée par `shaDe`. La seconde, « dépôt corrompu », est un faux diagnostic ajouté par `fusionnesEnCours`. » Correction retenue : « Résoudre toutes les lignes en UNE requête `lire(depot, ['cat-file', '--batch-check'], { entree: lignes.map((l) => `${l}^{commit}\n`).join('') })`, sur le patron de `bornesDe` (`gitPorte.mjs:380-384`). `null` signifie que la panne est déjà confiée une fois : rendre `[]`. Une ligne qui ne rend pas `^[0-9a-f]+ commit ` part à `confier('dépôt corrompu : MERGE_HEAD, « l » …')`. Le sha est le premier champ. » Vérifie la forme exacte de `lire`/`entree` et de `bornesDe` dans le code avant d'écrire ; garde `revisionFautive` si une ligne fautive (ex. `-x`, caractère de contrôle) ne doit jamais être posée à `cat-file` (une ligne de `--batch-check` par requête : un `\n` ou un `\r` dans une ligne casse l'alignement — dis comment tu le tiens).
- **D2 (mineur), `gitPorte.mjs:22`** : la phrase « L'unique LECTURE D'ÉTAT hors commande git » est fausse : `statSync` (`:149`, `natureDuChemin`) lit le disque, et hors de l'hôte `scripts/ops/etapesDuTrain.mjs:299-301` et `:371-374` lisent l'état git (`rebase-merge`, `rebase-apply`) par `cheminGit` + `existsSync`. Correction : (a) l'en-tête dit exactement ce qui est vrai après ton geste ; (b) la question « un rebase est-il entamé ? » entre dans l'hôte (une question nommée, sur `natureDuChemin`), et `etapesDuTrain.mjs` la consomme — plus aucun `existsSync` d'état git hors de l'hôte (contre-grep `git grep -n "rebase-merge\|rebase-apply\|MERGE_HEAD\|existsSync" -- scripts`, sortie collée avant/après).
- **D3 (mineur), `gitPorte.test.mjs:1167-1190`** : promouvoir la sonde du juge (`/tmp/claude-0/-home-user-game/365ab83c-b2bf-5700-91e2-3605a34e86da/scratchpad/juge-gitporte/sonde.mjs`, mode `panne` : spawn feint qui rend `fatal: boum`) en test avec `assert.deepEqual(pannes, ['fatal: boum'])` ; le test « illisible » sous `enPanne` vérifie qu'il y a exactement UNE panne.

## Preuves et portes (sortie brute, code de sortie sans pipe)
- Mutation pour chaque test neuf ou durci (hash-object avant/après, rouge nommé, remise identique vérifiée par empreinte — attention : ta remise précédente par `sed` a touché une autre occurrence, remets par empreinte).
- `node --test scripts/guards/lib/gitPorte.test.mjs`, le test d'`etapesDuTrain` (`git grep -l etapesDuTrain -- 'scripts/**/*.test.*'`), les tests de solde (`scripts/hooks/solde-ticket-guard*.test.mjs`).
- `npx eslint` sur tes fichiers.

## Livrable
`/tmp/claude-0/-home-user-game/365ab83c-b2bf-5700-91e2-3605a34e86da/scratchpad/rendu-gitporte-corrections.md` + résumé factuel dans ta réponse.
