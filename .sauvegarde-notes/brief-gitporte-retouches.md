# Brief du codeur : `fusionnesEnCours` rentre dans l'union à trois issues (#1806, retouches 1 à 4 du juge des correctifs), 2026-09-28

## Arbre et interdits
- `/home/user/game`, branche `chantier/1806` (HEAD `c160fc3c3`). Un AUTRE codeur travaille en même temps dans cet arbre sur `src/ui/**`, `src/state/**`, `docs/charte-ui.md`, `docs/primitives.md` : tu n'y touches pas, et tu n'y lances rien. Ton périmètre : `scripts/guards/lib/gitPorte.mjs`, `scripts/guards/lib/gitPorte.d.mts`, `scripts/guards/lib/gitPorte.test.mjs`, et un appelant (`scripts/guards/lib/revuePalier.mjs`) seulement si la signature change.
- Interdits : tout `git checkout/restore/reset/stash/add/commit/apply`, toute écriture dans `node_modules`. Processus bornés, listés au rendu. Budget : **45 min d'horloge** ; le reste NOMMÉ.

## Invariant
- En-tête de l'hôte, `scripts/guards/lib/gitPorte.mjs:1-2`, verbatim : « LECTURES GIT DES PORTES — l'hôte UNIQUE de la forme d'union et des commandes git que les portes (pre-push, garde de solde, revue de palier, stocks de plage, faits de palier, closer) exécutent. » ; `:4` : « COMBIEN D'ISSUES A UNE LECTURE GIT ? TROIS » ; `:20-21` : « Une borne NOMMÉE dont l'objet MANQUE n'est pas absente : le dépôt est corrompu, et c'est l'issue 3 (`corrompu`, #1806). »
- Question : que rend une lecture de l'ÉTAT git (fichier sous `.git/`) quand elle échoue ou lit un objet que git ne résout pas ?

## Cas canonique déjà couvert
Les questions de l'hôte qui passent par `interroger`/`lire`/`confier` (ex. `racineDe`, `gitPorte.mjs:863-867`). `fusionnesEnCours` (`gitPorte.mjs:882-888`) est la seule qui lise un fichier d'état git par `readFileSync` : rends la preuve qu'elle est une INSTANCE de l'union (mêmes trois issues, même `confier`/`corrompu`), pas une branche à part.

## Design jugé :
Juge des correctifs `707dce2ab` et `12d0339ce` (pilotage #1806 du 2026-09-28T07:24:59Z, « Restes nommés »), verbatim :
1. « `fusionnesEnCours` (`scripts/guards/lib/gitPorte.mjs:882-888`) sort de l'union à trois issues : une erreur fs de `readFileSync` n'est pas prise en charge, et une ligne de `MERGE_HEAD` que `shaDe` ne résout pas disparaît en silence là où git déclare le fichier corrompu (`builtin/commit.c:1873`). »
2. « Sa JSDoc attribue « un sha par ligne » à `git help revisions` ; la forme s'écrit à `builtin/merge.c:1141` et se lit à `builtin/commit.c:1867`. »
3. « L'en-tête de l'hôte (`gitPorte.mjs:1-35`) ne déclare pas cette lecture de fichier d'état git. »
4. « Aucun test direct de `fusionnesEnCours`, octopus à deux lignes compris. »

## Travail
1. Erreur fs → issue 3 (via le mécanisme existant de l'hôte, jamais un second) ; ligne non résolue → `corrompu`, jamais filtrée en silence.
2. Réfs de la JSDoc : VÉRIFIE les lignes citées contre le source de git de la version installée (`git --version`, sortie collée). Tente de lire `builtin/merge.c` et `builtin/commit.c` au tag correspondant (ex. `curl -sS https://raw.githubusercontent.com/git/git/v<version>/builtin/commit.c | sed -n '1860,1880p'`). Si le réseau refuse, dis-le avec la sortie, et ne cite que ce que tu as lu (`git help` compris) ; jamais une ligne non vérifiée.
3. En-tête : une ligne qui déclare la lecture de `MERGE_HEAD` comme lecture d'état, sans paraphrase de règle (règle 6, réf nue).
4. Tests directs dans `gitPorte.test.mjs`, sur le patron des tests voisins (dépôt gabarit, `envDeDepot…` : lis comment les tests existants fabriquent leur dépôt) : hors fusion → `[]` ; fusion simple ; octopus à deux lignes ; ligne non résolue → corrompu ; fichier illisible → issue 3.

Commentaires : réf nue, aucune paraphrase, aucune pierre tombale.

## Preuves et portes (sortie brute, code de sortie capturé sans pipe)
- Mutation pour chaque test neuf (hash-object avant/après, rouge nommé, remise).
- `node --test scripts/guards/lib/gitPorte.test.mjs` et les tests de `revuePalier` (`git grep -l revuePalier -- 'scripts/**/*.test.*'`).
- `npx eslint` sur tes fichiers ; `npx vitest run --no-cache src/comment-poison-guard.test.ts`.

## Livrable
`/tmp/claude-0/-home-user-game/365ab83c-b2bf-5700-91e2-3605a34e86da/scratchpad/rendu-gitporte-retouches.md` : diff stat, chaque point fait/reste avec preuve, mutations, portes, processus.
