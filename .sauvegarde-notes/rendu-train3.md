# Rendu : R-M2 lot A, train 3 (#1806), 2026-09-28

Worktree `/home/user/game/.wt-1806-L1`, HEAD `f45c18692`. Début 14:28 UTC, fin vers 15:05 UTC. Aucun geste git.
Arbre principal `/home/user/game` : `git status --short` vide (aucune fuite).

## Fichiers
`git diff --stat` : 73 fichiers, +476 / -202 (dont 36 docs générés par `npm run docs:build` : pieds + `docs/.sources-lues.json` + `docs/primitives.md`).
- Neufs (non suivis) : `src/lib/coupeAuMot.mjs`, `src/lib/coupeAuMot.d.mts`, `src/lib/posePartagee.ts`, `src/lib/posePartagee.test.ts`, `scripts/guards/lib/dialecte.d.mts`.
- Supprimé (rm, pas en index) : `src/lib/coupeAuMot.ts`. **À poser en `git rm` par l'orchestrateur.**
- Modifiés (code) : `src/ui/Infobulle.tsx`, `src/ui/useDismissLayer.ts`, `scripts/guards/lib/coupeAuCaractere.mjs`, les 12 importeurs `src/` de coupeAuMot (chemin `.mjs`), 9 sites `scripts/` (liste D5), `src/data/primitives.manifest.json` (+ `_ids.generated.ts` régénéré).
- Modifiés (tests) : `src/lib/coupeAuMot.test.ts`, `src/coupe-au-caractere-guard.test.ts`, `src/ui/raccourcis-registre.test.ts`, `src/ui/Infobulle.test.tsx`, `src/ui/CombatConsole.test.tsx:109`, `src/ui/editor/GameOpEditor.seeds.test.tsx`, `scripts/guards/lib/gitPorte.test.mjs`, `scripts/ops/publier.test.mjs`, `scripts/docs/lib/empreinte-sources.test.mjs`, 3 dépôts jetables `scripts/migrations/lib/{1825-…,1897-…,idempotence-ordre-des-cles}.test.mjs` (liste des modules portés + `src/lib/coupeAuMot.mjs`).

## Points
- **D1** : `npm run docs:build` rc=0 puis `npm run docs:check` rc=0 (« docs:check — OK (34 docs vivantes…) », « docs/.sources-lues.json à jour, 34 générateur(s) »).
- **D2** : en-tête `src/ui/Infobulle.tsx:27-30` réécrit : ↓ pris à la CAPTURE du document, propagation arrêtée avant l'écouteur du registre en bulle sur la fenêtre (`useGameKeyboard.ts`). Plus de `notWhenControlFocused`. Sonde3 promue en test : `Infobulle.test.tsx`, describe « ↓ — pris à la capture du document… ». Témoin : `KeyA` atteint la fenêtre (`{parvenus:1, empeche:false}`), ↓ ne l'atteint pas (`{parvenus:0, empeche:true}`), 1 boîte.
- **D3** : `coupeAuMot` cherche la coupe après le 1er non-blanc (`debut`), et U+2007 est ajouté aux insécables (`ESPACE_SECABLE = /[^\S   ]/`). Nouveaux cas : `' Anticonstitutionnellement dit',10 → ' Anticonstitutionnellement…'`, `'   abcdefghij klm',5 → '   abcdefghij…'`, `'  un deux trois',8 → '  un…'`, U+2007 et U+202F.
- **D4** : `src/ui/CombatConsole.test.tsx:109` cite maintenant `coupeAuMot` et `BORNE_DU_CORPS`.
- **D5** : `src/lib/coupeAuMot.mjs` + `.d.mts`, module pur sans import (patron `ordre.mjs`). Importeurs `src/` pointés vers `.mjs`. Manifeste : `fichier` → `.mjs`, périmètre étendu à `scripts/`. Garde étendue à `src/` + `scripts/` (`.ts .tsx .mts .cts .js .jsx .mjs .cjs`, tests compris). Classement des sites :
  | site | ce qui est coupé | lu par | verdict |
  |---|---|---|---|
  | `scripts/source/prose-source-plugin.mjs:80` | titre de chapitre (éditeur DescRefField, dans l'app) | humain, dans l'UI | migré |
  | `scripts/guards/lib/sujetDeCommit.mjs:40` | sujet de commit cité dans un refus | humain | migré (`« ${coupeAuMot(sujet,120)} »`) |
  | `scripts/ops/etapesDuTrain.mjs:187` | titre de commit | humain | migré (`coupeAuMot(ligne, max-1)`) |
  | `scripts/source/derive-decoupes.mjs:128` | paragraphe de prose introuvable | humain | migré (plus de « … » ajouté d'office) |
  | `scripts/ui/audit-i18n.mjs:204` | texte d'UI en double | humain | migré (`coupeAuMot(textVal,59)`) |
  | `scripts/docs/lib/empreinte-sources.mjs:300` | ligne d'un doc généré dans l'aperçu de divergence | humain (diagnostic) | migré |
  | `scripts/hooks/solde-ticket-guard.mjs:915` | extrait de commande dans le motif d'un refus | humain (message) | migré |
  | `scripts/guards/lib/gitPorte.mjs:88` `raisonCourte` | 1re ligne de stderr de git ou motif composé | humain, ET relu par du code : `HORS_ARBRE.test(vu.raison)` à `gitPorte.mjs:873` | migré : le motif est en tête, donc la relecture tient (`gitPorte.test.mjs` vert). Coût : voir Écarts 1 |
  | **site neuf trouvé par la garde étendue** : `scripts/raw/reanchor.mjs:286` (coupe en deux instructions, `snippet` puis `« ${snippet}… »` ×3) | citation de source | humain | migré (`coupeAuMot(…, 46)`, « … » retiré des 3 gabarits) |
  Aucun site ne coupe un sha ni une clé. Aucun n'a donc été laissé comme « donnée machine ».
- **D6** : `scripts/guards/lib/coupeAuCaractere.mjs` réécrit, toujours par l'AST. Il voit maintenant : le nœud JSX qui suit `{coupe}` (texte ou `{'…'}`), une constante `const` à littéral nommée, `padEnd` et `concat`, le `join` d'un tableau de caractères (`[...s]`, `Array.from(s)`), et une coupe liée à une `const` puis ellipsée dans la portée de sa déclaration (deux instructions). Le foyer `src/lib/coupeAuMot.mjs` sort par `sAppliqueA({foyer})`, la primitive canonique de `sourceCorpus.mjs`, pas par une liste. Le test prouve qu'il est vu sous un autre chemin. Sonde4 : les 6 formes → 1 site chacune. **Hors de portée** (sans flux de données) : coupe passée en argument à une fonction qui ellipse, coupe rendue par une fonction, variable `let` réassignée, ellipse posée dans un autre fichier.
- **D7** : `src/ui/raccourcis-registre.test.ts` passe à l'AST (`ast`/`typescript` de `dialecte.mjs`, qui reçoit un `dialecte.d.mts` pour le typage `src/`). Pour `window|document.addEventListener(type, …)`, `type` se résout ainsi : littéral, gabarit sans trou, `const` locale, table (clés et valeurs d'objet, éléments de tableau, `Object.entries/keys/values`), variable de `for…of`, paramètre d'un rappel `forEach`, import relatif d'un module du dépôt. Un type non résolu est un refus distinct (« NON RÉSOLU »). Les quatre cas de la sonde sont au test (« la CLASSE, pas la co-occurrence »), avec `forEach`, `const TYPE` et le non-résolu.
- **D8** : `GameOpEditor.seeds.test.tsx` consomme `monterRacine`/`demonterRacines` (`afterEach(demonterRacines)`, re-rendu par `montage.rendre`). `montes` et `teardown` ont disparu. La boucle démonte à chaque tour.
- **Observation (compteurs d'écouteurs)** : la couture est `src/lib/posePartagee.ts` (`posePartagee(poser, retirer) → { prendre(): remise, vider() }`). Deux consommateurs : `useDismissLayer.ts` (`PORTE`, qui remplace `montees`/`brancherPorte`/`debrancherPorte`, et `resetDismissLayers` passe par `PORTE.vider()`) et `Infobulle.tsx` (`DELEGATION`, `inscrire`). Les `addEventListener` restent dans chaque consommateur, donc la garde clavier voit toujours les littéraux. Manifeste : entrée `posePartagee`. Suites des deux consommateurs vertes sans réécriture (liste plus bas). Seule différence de comportement : après `vider()`, une remise antérieure ne fait plus rien, alors qu'avant le compteur pouvait devenir négatif. Ce chemin n'existe que dans les bancs de test (`resetDismissLayers`).

## Mutations (état final des fichiers ; `muter.py` : mute, joue, restaure à l'octet, rejoue)
Sorties : `scratchpad/mut/<nom>.{rouge,vert}.out`.
| mutation | fichier | hash avant = après | hash muté | rouge (assertion) | vert |
|---|---|---|---|---|---|
| M1 debut=0 | src/lib/coupeAuMot.mjs | 08820c3d3f48 | 1afc30482675 | « les blancs de tête… » : `'…'` au lieu de `' Anticonstitutionnellement…'` | 0 |
| M2 U+2007 retiré | src/lib/coupeAuMot.mjs | 08820c3d3f48 | b8b6ef3a0b88 | « une espace insécable ne coupe pas » : `'un…'` | 0 |
| M3 remise non unique | src/lib/posePartagee.ts | e9ff6f7719db | a485a19d1e4e | « une remise n'agit qu'une fois » | 0 |
| M4 génération ignorée | src/lib/posePartagee.ts | e9ff6f7719db | e272aef2ae8f | « `vider` … rend inertes les remises » | 0 |
| M5 `stopPropagation` retiré | src/ui/Infobulle.tsx | f3b1afcc84d9 | 8df6a96752d3 | « ↓ sur l'ancrage… » : `{parvenus:1}` | 0 |
| M6 JSX voisin | scripts/guards/lib/coupeAuCaractere.mjs | 890f0bf8973b | bd3fecd11b1a | témoin « chaque forme… » `[]` | 0 |
| M7 constante nommée | idem | 890f0bf8973b | 98dc6c4923f1 | idem (`temoin.tsx:2`) | 0 |
| M8 deux instructions | idem | 890f0bf8973b | 778e543d21cd | témoin + « le FOYER… sous un autre chemin est vu » | 0 |
| M9 foyer retiré | idem | 890f0bf8973b | 04364800d0db | « le FOYER… » + « aucun site » : `src/lib/coupeAuMot.mjs:22` | 0 |
| M10 padEnd/concat | idem | 890f0bf8973b | b2aade5c2e1d | témoin « chaque forme… » | 0 |
| M11 tableau de caractères | idem | 890f0bf8973b | 1ef36fbba865 | témoin « chaque forme… » | 0 |
| R1 import non résolu | src/ui/raccourcis-registre.test.ts | 0ea8d39b13dc | be52f4224917 | « la CLASSE, pas la co-occurrence » (table importée) | 0 |
| R2 cible globale ignorée | idem | 0ea8d39b13dc | 9807a0c2b0b2 | idem (écouteur local) | 0 |
| R3 gabarit ignoré | idem | 0ea8d39b13dc | faed7be239ad | idem (gabarit) | 0 |
| S1 coupe au caractère | scripts/guards/lib/gitPorte.mjs | e146c0f2c3a8 | 23aac44621bd | `not ok` « classer : la RAISON… coupée AU MOT » | 0 |
| S2 coupe au caractère | scripts/ops/etapesDuTrain.mjs | ed90e4df0103 | 02ee2ecb4c10 | `not ok` « titreDeCommit… ». Au 1er essai, la mutation survivait (la coupe tombait déjà sur une espace) : test durci avec `'abcdefgh '` | 0 |
| S3 coupe au caractère | scripts/docs/lib/empreinte-sources.mjs | 39a467d79e90 | 0e833ba91cc6 | `not ok` « apercuDivergences… » | 0 |
Les empreintes complètes sont dans la sortie JSON de chaque mutation (chaque ligne donne `"identique": true`).

## Portes
- `npm run typecheck:fast` : rc=0, « 0 erreur(s) ».
- `npx vitest run --no-cache` sur 29 fichiers : les miens, `Infobulle.test.tsx`, les 12 importeurs de test de `useDismissLayer`, les 7 de `coupeAuMot`, `prose-source`, `numero-de-chapitre` et les gardes `coupe-au-caractere`, `raccourcis-registre`, `comment-poison`, `ui-ratchets`, `primitive-owners`, `vi-mock-isolate`. rc=0, « Test Files 29 passed (29) · Tests 541 passed (541) ».
- `node --test` sur les 60 tests `scripts/**` qui nomment un module touché ou copient `scripts/…` : 1419 tests, 1418 pass, 1 fail = `scripts/gates/classerPush.test.mjs:211`, « ENOENT … src/lib/coupeAuMot.ts ». Ce test lit `git ls-files` : il liste encore le `.ts` supprimé mais pas posé en index. Il se résout au commit (git rm). Aucun autre rouge.
- `npx eslint` sur les fichiers touchés (.ts/.tsx/.mjs/.mts) : rc=0.
- `npm run docs:build` rc=0, puis `npm run docs:check` rc=0.

## Écarts, pour l'orchestrateur
1. `coupeAuMot` ne borne PAS la longueur : c'est le contrat R-M2, un 1er mot plus long que n se rend entier. Sur des messages d'outil, cela donne : (a) un token unique plus long que la borne passe entier ; (b) un token long qui n'est PAS le premier disparaît avec la suite. Exemple de `gitPorte.test.mjs:303` : `arbre principal non résolu : cwd inexistant :…`, le chemin de 240 caractères est perdu, alors qu'avant on en gardait un préfixe de 199. J'ai migré parce que le brief pose R-M2 « nulle part ». Si l'orchestrateur juge ce diagnostic trop appauvri pour `raisonCourte`, c'est une décision de design, pas un geste de codeur.
2. Test réécrit : `gitPorte.test.mjs:303`, regex `cwd inexistant : ` → `cwd inexistant :` (l'espace est tombé avec le chemin).
3. Le fichier supprimé `src/lib/coupeAuMot.ts` doit être posé en `git rm` (voir classerPush).
4. Hors périmètre, non corrigé : les dépôts jetables recopient à la main la liste des modules qu'ils portent. C'est la classe déjà portée sur #2034 : j'ai dû y ajouter `src/lib/coupeAuMot.mjs` dans 3 fichiers.

## Processus
Aucun lancé en arrière-plan. Toutes les commandes (vitest, node --test, tsc, eslint, docs:build/check, tsx sonde4, node scan.mjs) ont tourné au premier plan sous `timeout`, et toutes sont terminées. `ps` final : 0 processus vitest/node --test/tsx.
Fichiers de travail : `scratchpad/scan.mjs`, `scratchpad/mut/muter.py`, `scratchpad/*.out`.
