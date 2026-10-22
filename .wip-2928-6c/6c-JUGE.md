VERDICT: REFUSÉ

# Juge du lot 6c (#2928, épique #2882) : projet Godot, garde GDScript, sonde CI, recette

Le jugement porte sur le diff non commité de `/home/user/game/.wt-2928-6c` (17 fichiers modifiés et 9 entrées non suivies), lu le 2026-10-22. Je n'ai rien modifié dans l'arbre : `git status --short` compte toujours 26 lignes. Mes sondes ont vécu dans le scratchpad, puis je les ai effacées.

Trois bloquants. Le projet Godot ne recopie aucune IA, aucun A*, aucune adjacence et aucune carte : c'est acquis. En revanche, la garde qui devait l'empêcher de le refaire laisse passer ces calculs. La fenêtre « générique » laisse tomber en silence tout verbe qui prend un argument. Et le GDScript échappe à la garde du poison de commentaire.

## BLOQUANT

### B1. La garde GDScript est creuse
`scripts/guards/lib/gdscriptSansRegle.mjs:10-13`, `:17-23`, `:70`

Ma sonde est un `.gd` hors du dépôt, passé à `calculsDeRegle`. Il écrit les règles que le plan M-e interdit (« ni arithmétique de distance sur les positions »), dans leur forme GDScript la plus courante. Sur neuf calculs, la garde n'en relève qu'un, `distance_to` :

| Calcul de règle dans la sonde | Relevé |
|---|---|
| adjacence : `var d := a - b` puis `maxi(absi(d.x), absi(d.y)) <= 1` | non |
| distance : `(a - b).length()` | non |
| cases voisines : `for v in VOISINS: r.append(c + v)` | non |
| cible au hasard : `cibles.pick_random()` | non |
| mélange : `cibles.shuffle()` | non |
| DR : `int(cible / 10) - int(jet / 10)` | non |
| portée : `abs(ax - bx) + abs(ay - by) <= 4` | non |
| réussite : `jet <= cible` | non |
| tri de cibles : `sort_custom(... moi.distance_to(p) < moi.distance_to(q))` | oui |

L'en-tête du module affirme aussi une chose fausse. Selon lui, chaque nom de l'API de hasard de Godot « commence par `rand` ou `Random` ». Or `Array.pick_random()` et `Array.shuffle()` sont du hasard du moteur, et ne commencent pas ainsi.

La garde ne mord que si les deux opérandes sont des coordonnées littérales (`.x - b.x`) ou si l'une est un entier nu. Il suffit de passer par une variable vectorielle pour la contourner.

**Correction attendue :**
- `mesure` mord sur toute opération `+`/`-` entre deux opérandes non littéraux d'un `Vector2`/`Vector2i` ou d'une valeur lue dans la vue.
- `mesure` mord aussi sur `abs*`, `max*`, `min*`, `sign*` et `clamp*` appliqués à ces valeurs, et sur `.length()`.
- `hasard` couvre toute l'API de hasard (`pick_random`, `shuffle`, `randomize`, `RandomNumberGenerator`, `rand_from_seed`…).
- Une forme plus sûre : une liste blanche des opérations de mise en scène permises, sur des réels ou des constantes de mise en page. `pont.gd:30` (`Time.get_ticks_msec() - _debut_ms`) doit alors s'écrire sans soustraction lue comme une mesure.
- Chaque ligne de la table ci-dessus devient un cas rouge de `gdscriptSansRegle.test.mjs`.

### B2. L'invariant de laurent est violé : la fenêtre « générique » perd tout verbe qui prend un argument
`hotes/godot/projet/scripts/fenetre.gd:45-48`, `:58-70`, `:80`, `:106-108`

Laurent, 2026-10-21 : « si je modifie le moteur, je n ai pas à toucher ni au mcp, ni à l hôte, sauf si je dois inventer des nouveaux tools ».

Je trace par la pensée l'arrivée d'un verbe nouveau dans le noyau.

- **Verbe sans argument, ou à seul argument `pid`.** `fenetre.gd` le rend en bouton. L'invariant tient.
- **Verbe à argument** (booléen, union de littéraux, nombre, chaîne autre que le `pid`) :
  - `_arguments` (`fenetre.gd:58-70`) rend `null`, et la boucle saute le verbe sans rien dire (`fenetre.gd:47-48`, `continue`).
  - Le seul chemin de rendu restant est une liste de champs écrite à la main : `for choix in [a.choixDArme, a.localisation]` (`fenetre.gd:80`).
  - Pour qu'un tel verbe se joue dans Godot, il faut donc modifier le GDScript, alors que l'hôte texte le prend tout seul (ligne « verbes », signatures de `VERBES`).

Ce n'est pas théorique. Des verbes du noyau, présents aujourd'hui dans `projection.fenetre.verbes`, ne se jouent pas depuis Godot :
- `attackSetDualMode`, `attackSetWithhold`, `attackSetGrapple`, `attackSetHarpoonRopeCut` (booléens). La vue porte pourtant `FenetreDAttaque.deuxArmes`, `retenirSesCoups`, `empoigner` et `sansLaCorde`, que `fenetre.gd` ignore.
- Les quatre `defenseSet…`, les quatre `castSet…` et `testSetActor`.
- Surtout `cascadeChoose(pid, key)` et `cascadeAmount(pid, n)`. La projection porte « les clés de son choix » (`src/hote/projection.ts:138`), mais une étape de cascade de genre `choix` ou `quantite` n'a aucun contrôle dans Godot.

Pour les deux choix rendus, le verbe se devine par la forme de son argument (`fenetre.gd:106-108` : le premier verbe de la fenêtre dont l'union admet chaque option). L'association choix → verbe est donc reconstruite par l'hôte, et elle dépend de l'ordre. `attackSetLocation` et `attackSetCritLocation` admettent tous deux chaque localisation non vide. Seul l'ordre de `FENETRE_DU_JET.reglages` (`src/noyau/combatAuto.ts:53`) fait jouer le bon : réordonner cette liste du noyau ferait jouer à Godot la localisation du critique, en silence.

Deux autres manques :
- `CONTRAT.md:72` dit « sa clé, et ses verbes en boutons » : c'est inexact, une partie des verbes n'est jamais rendue.
- Les offres à plusieurs candidats (`OffreEnVue.n > 1`) ou qui lisent un contexte ne se désignent pas, car `interface.gd:79-84` n'envoie que `{offre}`. Moins grave, même famille.

**Correction attendue :**
- Le noyau nomme le verbe de chaque choix et de chaque bascule de `FenetreDAttaque`, comme il nomme les clés d'une étape de cascade.
- `fenetre.gd` rend CHAQUE verbe de `fenetre.verbes` d'après sa forme (`vue.parametres`) : bascule pour un `booleen`, rangée de boutons pour une union de littéraux, champ pour un `nombre`, options lues dans la vue pour une `chaine` désignée.
- Plus de liste de champs à la main, plus de devinette par forme.
- Le contrat dit ce qui est rendu.

### B3. Le GDScript échappe à la garde du poison de commentaire (M-b)
`scripts/guards/lib/commentPoison.mjs:27`

`PERIMETRE_DES_GARDES.extensions` vaut `['.ts', '.tsx', '.mts', '.mjs']`. Les six scripts `.gd` du lot, et leurs en-têtes `##`, ne sont donc lus par aucune des trois portes anti-poison. M-b voulait que le périmètre couvre `hotes`.

Le rapport classe ce trou « hors périmètre ». Or c'est le lot qui l'ouvre, en introduisant le langage. Le credo dit « rien différé, rien hors scope », et « chaque classe de poison découverte reçoit sa garde mécanique dans le même chantier ».

À la lecture, je ne trouve aucun poison dans les commentaires actuels des `.gd`. C'est l'absence de garde qui bloque.

**Correction attendue :** `.gd` entre dans le périmètre. Ses commentaires `#`/`##` sont extraits par `lexemesGdscript` (déjà dans le lot) et jugés par les trois familles du poison. Un témoin rouge prouve que la garde lit un `.gd`.

## À CORRIGER

1. **La recette ne vérifie pas son titre.** `hotes/godot/recette.mjs:85-128`
   - Chaque étape est seulement notée (`noter`). `erreursGlobales` est imprimé et jamais vérifié (`:128`).
   - Le code de sortie ne dépend que d'une levée ou d'une erreur de console. Ni le déplacement de Berta, ni la fenêtre d'attaque fermée, ni la Défense tenue par le héros, ni le round 2 ne sont vérifiés.
   - Correction : un `assert` par étape du critère 4, et `erreurs.length === 0` dans le code de sortie.
2. **L'hôte texte change en silence.** `src/noyau/combatAuto.ts:53-57`
   - Les `reglages` de `FENETRE_DU_JET` entrent dans `fenetreDuJeu`. Ils allongent donc la ligne « verbes » de la vue de l'hôte texte et le message « verbe inconnu » (`src/hote/geste.ts:84`).
   - Le changement est légitime : il comble un manque, et la suite de l'hôte texte reste verte. Mais le rapport ne le dit pas, et `scripts/docs/build-hote-texte.mjs:78` décrit `fenetre.verbes` sans les réglages, si bien que `docs/hote-texte.md` généré devient inexact.
   - Correction : la ligne du générateur nomme `FENETRE_DU_JET.reglages`, et le rapport annonce le changement.
   - Au passage, rien ne garantit qu'une action `<flux>Set…` neuve soit déclarée. Un témoin dans `src/noyau/fenetres-nomment-leurs-verbes.hors-store.test.ts` fermerait cette dérive.
3. **La licence KayKit est incomplète.** `hotes/godot/projet/modeles/LICENSE-KayKit.txt:2` ne nomme que l'« Adventurers Character Pack ». `Skeleton_Warrior.glb` vient du pack « Skeletons », dont la licence n'est pas versée. Correction : ajouter sa licence verbatim à côté du modèle.
4. **`ECRIT_LU['godot:sonde'].lit` est incomplet.** `scripts/gates/toutes.mjs:419-427` déclare `['hotes/', 'scripts/', 'package.json']`. Mais `construire.mjs:26` importe `src/lib/tableTotale.ts` dès le chargement, avant tout mode, et la sonde l'exécute donc. Correction : ajouter `src/lib/`, ou les zones, comme pour `pont:godot`, puis vérifier à l'enregistreur de lectures.
5. **Le test du plateau ne vérifie pas son titre.** `hotes/godot/pont/contrat.hors-store.test.ts:131-140` ne teste `infranchissables` que par `Array.isArray`. Correction : vérifier une case infranchissable connue du scénario, et une case franchissable.
6. **`wfrpEcran.pas` n'a pas de consommateur.** Il est publié (`combat.gd:52,65`, `CONTRAT.md:104`), mais la recette marque à la place `wfrpEcran.vu` (`recette.mjs:44-45`) en écrivant dans l'objet publié. Correction : soit la recette attend le `pas` suivant, soit le champ disparaît.

## Remarques (sans gravité)

- **Angle mort de la sonde.** `--check-only` ne voit pas l'appel d'une méthode renommée d'une autre classe (`class_name`). J'ai rendu `_plateau.montrer` en `montrer_renomme` dans `combat.gd` : code 0, aucune ligne d'erreur. Lancer la scène principale ne le voit pas davantage (`--quit-after`, code 0, car hors navigateur la scène s'arrête avant d'appeler `_suivre`). Les erreurs internes à un script, elles, rougissent bien : parse, type, membre inconnu d'un type natif ou de `self`. Cet angle mort est à dire dans le plan (M-f).
- **Captures périmées.** L'export du codeur (05:24:56) date d'avant les dernières éditions de `interface.gd` (05:28:49) et de `pont.ts` (05:38:38). Les captures de `public/qc/soldes/2928-6c-*.png` viennent de cet export-là. J'ai rejoué export et recette sur le code livré : même déroulé (voir plus bas). La preuve tient, mais les captures sont à refaire sur l'export final.
- **Deux lexeurs.** `gdscriptSansRegle.mjs` est un second lexeur de blanchiment, alors que l'en-tête de `codeSeul.mjs` dit « en UN exemplaire ». Le dialecte diffère, je ne le compte pas comme duplication. On peut envisager un `codeSeul(src, { dialecte })`.

## Vérifié conforme

- **Noyau pur, web intact.** `plateauDeLaScene`, `verbesDuJet` et `fenetreDuJeu` n'ont aucun consommateur web (relevé `git grep`). Aucun test du noyau n'est réécrit.
- **Tests touchés.**
  - `lib.test.mjs` passe au format `ps` à quatre colonnes (`stat`). Chaque refus est conservé, et un zombie est écarté.
  - `ecrivainsAtteints.test.mjs` gagne une entrée : `+1` daté et justifié, selon la convention du fichier.
  - Les deux autres tests sont des ajouts.
- **Critère 2.** `grep -rE "AStarGrid2D|_jouer_ia|_adjacent|class_name Carte|departs" hotes/godot/projet` ne rend rien.
- **GDScript.** Il ne porte ni IA, ni A*, ni liste de verbes. Ses chaînes ne nomment aucun verbe ni aucune fenêtre (garde des noms verte).
- **Murs.** `recette.mjs` n'importe que `scripts/recette/lib.mjs`. Ni store, ni UI. La fermeture du pont est verte.
- **Sonde CI.** Version et SHA-256 épinglés (`construire.mjs:119-125`), cache `actions/cache@v4`, `--check-only` sur chaque script. Elle rougit sur une erreur de parse ou de type : code 1 et lignes `SCRIPT ERROR`.
- **Fichiers Godot.**
  - `.import` et `.uid` sont commités à raison : un `--import` sur une copie laisse chaque fichier suivi identique (`diff -r` vide).
  - `.gitattributes` : `*.glb binary` couvre le seul binaire ajouté.
- **Poids.** Les `.glb` font 1,16 Mo, élagués depuis 8,5 Mo. Les 4 PNG font 919 Ko, dans la norme de `soldes/`.
- **Poison de commentaire.** Je n'en trouve aucun à la lecture des `.gd`, de `recette.mjs` ni de `construire.mjs`.

## Preuves rejouées
Logs sous `/tmp/claude-0/-home-user-game/424b2429-c0ab-5191-a22b-3ce249f68bb5/scratchpad/juge6c/`.

- `npm run typecheck` : rc=0, aucune ligne d'erreur.
- `npm run lint` : rc=0.
- `npm run test:noyau` : « Test Files 17 passed (17) · Tests 257 passed (257) », rc=0. Ce compte inclut `derive-du-noyau`, `contrat` et `tour` (hors store) et les tests de l'hôte texte.
- `npm test -- src/hote hotes/godot src/noyau/surface-fermeture-guard.test.ts src/comment-poison-guard.test.ts` : « Test Files 2 passed (2) · Tests 117 passed (117) », rc=0. Les fichiers hors store vivent dans `test:noyau`. La commande a d'elle-même enchaîné un `docs:check` en prélude : « docs:check — OK ».
- `node --test scripts/guards/lib/gdscriptSansRegle.test.mjs scripts/recette/lib.test.mjs` : « pass 290 · fail 0 · skipped 1 », le saut étant « PowerShell absent ». rc=0.
- `npm run pont:godot` : « wfrp-pont.js : 7 277 187 o brut, 1 795 170 o gzip » ; « demarrer dome et vue ok, second demarrer refusé, erreursGlobales vide ». rc=0.
- `npm run godot:sonde` (binaire en cache `~/.cache/wfrp-godot/4.7-stable/`) : « [godot] 4.7.stable : projet importé, 6 scripts contrôlés », rc=0.
- **Sonde de la garde GDScript** : un seul relevé sur neuf calculs de règle, `.distance_to(` (voir B1).
- **Godot sur une copie hors dépôt** :
  - erreur de type : rc 1, « Cannot assign a value of type "String" as "int" » ;
  - parse : rc 1 ;
  - membre de `Vector2` : rc 1 ;
  - méthode d'une autre classe : rc 0 (angle mort).
- **Export et recette rejoués sur le code livré** :
  - `construire.mjs --export` : rc=0, `index.wasm` 39 509 339 o.
  - Recette : rc=0. « localisation tete ; cible du jet 28 », « 14 dégâts − 7 (BE+PA) = 7 Blessures », « Berta en 1,5 », « fenêtre cascade, étape defenseJet, à Ilyanwe la Voilée », « Défense confirmée : fenêtre roundStart, round 2 », « erreursGlobales : {"ok":true,"erreurs":[]} », « console : 3 entrée(s), 0 erreur(s), 0 avertissement(s) ».
- **Lus en entier** : les six `hotes/godot/projet/scripts/*.gd`, les scènes, `cases.tres`, les `.import`, `construire.mjs`, `recette.mjs`, `gdscriptSansRegle.*`, et `git diff` de chaque fichier modifié.
