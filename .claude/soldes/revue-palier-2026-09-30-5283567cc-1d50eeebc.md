# Revue de palier — fenêtre 5283567cc..1d50eeebc — 2026-09-30

verdict: PARTIEL

Revue en lecture seule, mandat : réfuter. La fenêtre `5283567cc..1d50eeebc` compte 122 commits : 99 non-fusions, dont 76 touchent `src/` ou `scripts/`, et 23 fusions. `main` a reçu 57 commits de premier parent.

L'arbre jugé est ÉPINGLÉ à `1d50eeebc` (= `origin/main` au jugement) et lu par `git show 1d50eeebc:<chemin>`.

Chaînage : la revue précédente `.claude/soldes/revue-palier-2026-09-27-faaf4139c-5283567cc.md` s'arrête à `5283567cc`, la base de celle-ci.

Entrée mesurée : `npm run ops:faits-de-palier -- --base 5283567cc --tete origin/main`. Seuls les chiffres que je conteste sont re-mesurés.

Synthèse du cumul :
- Les 4 fermetures de la fenêtre (#1801, #1775, #1946, #2099) tiennent sur pièces. Chaque reste est routé vers un ticket OUVERT, et chaque fermeture suit une CI verte sur `main`.
- Aucune fermeture hors commit dans la fenêtre.
- CI de `main` : 22 courses « CI » de push, 21 vertes et 1 rouge (`3b1e64c64`, test instable, routé sur #2155). La tête est verte.

Ce qui empêche CONFIRMÉ :
- **(A)** Le message de `c7625d683` annonce une valeur de cliquet qui n'est pas celle du diff.
- **(B)** `b5a083158` fait grandir une table d'exceptions de garde de +5 sans `CLIQUET:` au message.
- **(C)** Le pilotage de l'épique #1811 est muet depuis le 2026-09-20, alors que son lot #1806 a porté environ 40 commits dans la fenêtre.
- **(D)** `audit-stock` est rouge (11 écarts), sans ticket ouvert.
- **(E)** L'instrument `faits-de-palier` rend 5 faux refus sur 12. La mesure de stock de la plage n'est donc pas fiable telle quelle.

## Fermetures

### Par commit (`corrige #N`)

| # | commit | solde à `1d50eeebc` | restes | CI avant fermeture | verdict |
|---|---|---|---|---|---|
| #1801 | `e0d0bb42d` | `.claude/soldes/1801.md` | #2071 OUVERT ; U corrigé par `21964d1f2` (ancêtre de la tête : `merge-base --is-ancestor` exit 0) ; V routé sur #2035 OUVERT | publié par `ce68999a6`, course 36351529135 verte (21:23Z) ; fermé à 21:37:48Z | CONFIRMÉ |
| #1775 (build-all --check : le câblage de piedsDesNonVerifiables n'est prouvé que par des regex sur la source) | `e0d0bb42d` | `.claude/soldes/1775.md` | RAS | idem | CONFIRMÉ |
| #1946 (Scripts : quatre formes de « ce module est-il le point d'entrée ») | `e0d0bb42d` | `.claude/soldes/1946.md` | U corrigé ; sites de la fusion migrés | idem | CONFIRMÉ |
| #2099 | `4f3c1e282` | `.claude/soldes/2099.md` | #2100 OUVERT | course 36682133160 verte (07:09Z) ; fermé à 07:26:40Z | CONFIRMÉ |

Pièces vérifiées :
- **#1946**
  - `scripts/raw/audit-refs-chapitre.mjs:130` porte `if (import.meta.main) main()`.
  - `scripts/node-requis.test.mjs` est présent.
  - Rejeu `node --test scripts/node-requis.test.mjs scripts/docs/build-all-check.test.mjs` : exit 0, 32 tests, 30 pass, 0 fail, 2 SKIP (« hôte sans autre plateforme à rendre », hôte win32).
- **#1801**
  - Rejeu `npm test -- src/graphies-d-hote-guard.test.ts src/point-d-entree-guard.test.ts …` : exit 0.
  - La case (1) de la DoD (rendu croisé des plateformes) n'est pas rejouable sur un hôte win32 : les 2 SKIP ci-dessus. Elle repose sur la CI Linux.
- **#2099**
  - `src/ui/editor/GameOpEditor.tsx:259` porte `LIBELLE_DE_FORME`, `:278` `FORME_DE_CLE`, `:285` `TERME_CONSTANT`, `:369` la branche `sinPoints`.
  - `src/data/schemas/defs/miscast.ts:36` porte `value: formulaSinSchema`, et `:59` porte `escapeStrength: formulaSchema`, comme le solde le dit.
  - Les deux tests nommés et les deux captures `public/qc/soldes/2099-*.png` sont présents.
  - Rejeu vitest de `GameOpEditor.formule-totale.test.tsx` et `codex-edit-miscast.test.tsx` : dans le lot de 7 fichiers, 238/238, exit 0.
  - `engineFormulaSchema` n'existe plus dans le code. Il ne survit que dans trois commentaires d'historique de cliquet, `src/data/structures-contrat.test.ts:710,877,880` : voir la section Dérive.

### Hors commit

`gh api 'search/issues?q=repo:MyEdO/game+is:issue+closed:>=2026-09-27'` rend 5 items :
- #1801 (raw:reconcile dépendant de la plateforme), #1775 (build-all --check de bout en bout), #1946 (point d'entrée des scripts) et #2099 (éditeur de Formula non total) sont cités ci-dessus.
- #1998 est fermé à 2026-09-27T17:48:15Z, AVANT la base `5283567cc` (18:45:29Z) : il relève du palier précédent.

Le script le confirme : « aucune fermeture non citée dans la fenêtre ».

## Commits vérifiés (5, cinq sessions différentes)

| sha | session | annonce | preuve à `1d50eeebc` | verdict |
|---|---|---|---|---|
| `0a9377caf` | `011Q5qB9…` (#1897) | « MDG 13 l.272 : force du vent à l'aube, midi, crépuscule, minuit » ; « MDG 13 l.294 : 25 % de la vitesse sans Ancre » ; seuil et cadence en DONNÉE | `Source/WH - V4 - La Mer de Griffe/13 - Navigation maritime.md:272` (« mettez-la à jour à l'aube, à midi, au crépuscule et à minuit ») et `:294` (« 25 % de sa vitesse normale ») ; `src/data/sea-weather.json:443-444` `windTickThreshold: 1`, `windTicksPerDay: 4` ; `src/engine/forceDuVent.ts` `basculesDeForce` pur ; reste #2083 OUVERT ; rejeu `sea-weather.test.ts` et `sea-voyage-flow.test.ts` vert | CONFIRMÉ |
| `777cc5544` | sans trailer (#2112) | 14 hooks lisent le stdin par `lireStdinBorne`, `DELAI_STDIN_MS` 8 s, garde de classe | `scripts/guards/lib/stdinBorne.mjs:9` `DELAI_STDIN_MS = 8000` ; `git grep "process\.stdin" -- scripts/hooks` hors tests : 0 ligne ; rejeu `node --test stdinBorne.test.mjs stdinHorsBorne.test.mjs` : exit 0, 11/11 | CONFIRMÉ |
| `4eb3e9fc7` | `01Gvotqr…` (#1887) | « 64 règles ADRESSENT leur prose », 21 restent inline, `PROSE_INLINE_TOLEREE` regles 85 → 21 ; réfs LDB 14 l.179-184 et LDB 10 l.30 | sonde 4 : `regles.json` passe de 1 à 65 `descRef` (+64) et de 85 à 21 `desc` inline ; `src/data/schemas/grammaire/prose-inline.ts:79` `regles: { entrees: 21 … }` ; `LDB 14 _GoBack.md:179-184` (monture) et `LDB 10 Talents.md:30` (Acrobaties équestres) exacts ; fiche `user-doctrine-regle-ligne-de-tableau-adresse-le-tableau-entier.md` présente | CONFIRMÉ |
| `9fdbe93b2` | `01Bx8AEm…` (#1806) | `MonsterPartsFields` sort du registre des écrans (DISJONCTION) | `scripts/hooks/ecrans-ui.json` : 0 occurrence ; `src/data/primitives.manifest.json:726-727` porte l'entrée `reglagesApparence` → `src/ui/editor/MonsterPartsFields.tsx` ; garde `scripts/hooks/new-src-file-guard.test.mjs:93-99` | CONFIRMÉ |
| `c7625d683` | `01TF28ta…` (#2178, session de l'orchestrateur) | « `PLAFOND_OCTETS` = 26695, la mesure de cet arbre » | le diff pose `PLAFOND_OCTETS = 27213` (`scripts/guards/budget-contexte.mjs:40`, depuis 27216). Mesure rejouée : `node scripts/guards/budget-contexte.mjs` exit 0, « 27213 TOTAL — plafond 27213 ». Le chiffre 26695 n'apparaît nulle part dans le diff : l'annonce est FAUSSE. Le plafond, lui, est juste. | RÉFUTÉ (annonce) |

## CI

Source : `gh run list -R MyEdO/game --created '>=2026-09-27'`, filtrée sur `headBranch == main`. `gh run list --branch main` ne rend RIEN au-delà du 2026-09-27T19:48Z depuis le transfert vers MyEdO : le filtre `--branch` ment par omission.

- **22 courses « CI » de push sur `main` dans la fenêtre : 21 vertes, 1 rouge.**
- La tête `1d50eeebc` est verte (course 36689913125).
- Rouge : `3b1e64c64`, un commit de docs seul, course 36446954399, job `build`, étape `npm run test:hooks`. Le test en échec est `not ok 985 - DRIVER : le palier compte le commit en cours par ce qu'il emporte` (`scripts/hooks/solde-ticket-guard-driver.test.mjs:178`, `Command failed: git commit -q -m s6`).
  - Le même sha est VERT sur `chantier/1806` (course 36444708259) : c'est un test instable.
  - `main` est resté rouge de 15:53Z à 18:24Z (`eb3a49429` vert, course 36464969958), soit environ 2 h 30, sans relance.
  - Routé : #2155 OUVERT (« rougit main par intermittence »), ouvert le 2026-09-29.
  - Aucune fermeture n'était en attente sur `472b05fd9` à `3b1e64c64` : le saut de `fermetures` n'a rien coûté ici. La classe est notée sur #2155, commentaire du 2026-09-29T20:45Z.
- Canari du 2026-09-28 (`c50bb66a5`, course 36428773870) : vert.

## Dérive

1. **Cliquet enjambé (`b5a083158`, #1903).** `scripts/gates/ecrivainsAtteints.test.mjs` passe de +5 entrées nettes à `1d50eeebc`, aux lignes 66-72 et 114-116 : `merge-stocks.mjs`, `merge-stocks.test.mjs`, `three-way.mjs`, `regenStock.mts`, `stockDeSites.test.mjs`.
   - Le message porte 9 lignes `CLIQUET:`, aucune pour ce fichier.
   - Le même fichier reçoit bien son `CLIQUET: … +1` dans `4f3c1e282` : la règle est connue.
   - Le motif en tête de fichier (écritures sous `os.tmpdir()`, `rmSync` en `finally`) justifie l'entrée sur le fond (grille 6 : ajout JUSTIFIÉ). La porte de message, elle, a été enjambée.
   - Non vérifié : par quel chemin ce commit a franchi la porte de push (plage cumulée de la fusion `35f7cfcca` ?).
2. **Annonce de cliquet fausse (`c7625d683`).** Voir le tableau : 26695 annoncé, 27213 posé et mesuré.
3. **Pilotage d'épique muet.**
   - #1811 (couche layout) : dernier commentaire le 2026-09-20T08:13Z. Son lot #1806 porte environ 40 commits de la fenêtre (R-M2 trains 1 à 7, portes, lot B).
   - #665 (EDO) : dernier commentaire « PILOTAGE » le 2026-09-26. Le chantier A de #1993 a été publié le 2026-09-30 (`4f3c1e282`) sans pilotage mis à jour.
   - #2189 (épique outillage) : 0 commentaire.
4. **Lots-fleuves.**
   - `4f3c1e282` : 287 fichiers, +9228/−4510. Il mêle la méthode de campagne (#1993), l'éditeur de Formula (#2099), `ScreenShell` à 360 px, les gardes du seam (#274/#370), la mémoire et `.claude/settings.json`.
   - `b5a083158` : 458 fichiers, +11161/−8820.
   - Ces deux commits vont contre la fiche « un lot = un chantier ». La revue d'un tel commit n'est pas faisable à la ligne.
5. **Pierre tombale de cliquet.** `src/data/structures-contrat.test.ts:877-890` raconte en commentaire la trajectoire du plafond (« 23 → 22 … puis 22 → 23 … puis 23 → 16 … puis 16 → 5 (#1993) »). Il cite `engineFormulaSchema`, un symbole supprimé par `4f3c1e282`. `4f3c1e282` y AJOUTE un maillon : c'est l'historique git réécrit en prose (famille « pierre tombale » du credo).
6. **Lentille de langue (un concept = un terme).**
   - Portées de commit pour un même objet (les portes et hooks de commit ou de push) : `gates` 12, `gardes` 9, `portes` 4. La même session `01Bx8AEm…` passe de `fix(gates)` à `refactor(portes)` au fil de #1806.
   - Même domaine sous trois graphies : `creation` 3, `création` 2, `createur` 2. Et `solde` 1 / `soldes` 1.
   - La primitive `reglagesApparence` porte deux noms : son libellé de manifeste est `ReglagesApparence/MonsterPartsFields` (`primitives.manifest.json:726`), son fichier `MonsterPartsFields.tsx`.
7. **Deux portes comptent différemment le même geste** (`b5a083158`) : `CLIQUET: scripts/guards/lib/stockDeSites.test.mjs +7` (« la porte de ce lot ») puis `+8` (« la porte d'avant ce lot »). Deux définitions de « stock » ont coexisté le temps d'un train.

## Instrument (faits-de-palier) : faux refus, instruits

`stocks.refus` et `stocks.reclassements` rendent 12 lignes : 4 refus nets au-delà du +7 déclaré, et 3 « illisible ».

- **3 « illisible » sur `primitives.manifest.json`** (`629ada8cf`, `658484bcc`, `35f7cfcca`) : FAUX.
  - Le fichier parse aux trois commits et à leurs deux parents (sonde 2).
  - Cause établie : les trois fusions ont RÉSOLU un conflit sur ce fichier (`git merge-tree --write-tree --name-only` : `CONFLICT (content): Merge conflict in src/data/primitives.manifest.json` pour les trois).
  - La base d'une fusion (`ceQueFaitLeCommit`, `scripts/guards/lib/plageStock.mjs:167-181`) porte les marqueurs de conflit, et `manifesteDe` (`scripts/guards/lib/cssCouches.mjs:350-358`) lève.
  - Conséquence : toute fusion qui résout un conflit du manifeste devient injugeable pour le reclassement.
- **`scripts/raw/source-format-stock.json` +20 et `empty-folios-perdues-stock.json` +1** (`b5a083158`) : FAUX. Les clés (famille, fichier, ref, occurrence) sont identiques avant et après, 997/997 et 23/23 (sonde 4b). C'est un réordonnancement textuel, compté comme une croissance.
- **`scripts/guards/lib/registryIdBranch.mjs` +1** (`b5a083158`) : FAUX. `VOCABULARY_TYPES` garde UNE entrée, dont la valeur passe de `'src/gameIso/rig/bones'` à `'…/bones.ts'`.
- **`ecrivainsAtteints.test.mjs` +5** : VRAI (Dérive 1).

## Restes routés par cette revue

- (α) c7625d683 : l'annonce ne se corrige pas dans l'histoire. Elle est consignée ici. Le plafond posé (27213) est juste.
- (β) b5a083158 : `CLIQUET:` absent pour `ecrivainsAtteints.test.mjs +5`. Il faut rechercher par où la porte a laissé passer le commit (fusion en croix ? rattaché à #2074).
- (γ) Faux refus de l'instrument sur la base des fusions en conflit et sur les stocks JSON réordonnés : ticket à ouvrir.
- (δ) Pilotage de #1811, #665 et #2189 à reposer avec l'état mesuré.
- (ε) audit-stock rouge (11 écarts), aucun ticket ouvert : à ouvrir.

Non vérifié, à l'échéance :
- les 24 portes de `npm run gates` annoncées au solde de #1801 (887 s sous Linux, non rejouées) ;
- la suite complète et le typecheck de la tête ;
- les griefs H, I et W de la revue précédente (seul #2034 est vérifié OUVERT) ;
- les commits de #1806, #1897 et #1988 autres que ceux du tableau ;
- `36871f69b`, 26 presets PNJ : texte au Source non confronté.

## Sondes

**Sonde 1** : fermetures hors commit.

```
gh api 'search/issues?q=repo:MyEdO/game+is:issue+closed:>=2026-09-27&per_page=100' --jq '.items[] | "\(.number) \(.closed_at) \(.title)"'
```

**Sonde 2** : le manifeste parse-t-il aux fusions et à leurs parents ? Résultat : les trois fusions et leurs parents ^1 et ^2 rendent `ok`.

```js
const {execFileSync}=require('child_process');
for (const s of process.argv.slice(2)) for (const rev of [s, s+'^1', s+'^2']) {
  let t; try { t=execFileSync('git',['show',rev+':src/data/primitives.manifest.json'],{encoding:'utf8',cwd}) } catch { console.log(rev,'absent'); continue }
  try { JSON.parse(t); console.log(rev,'ok',t.length) } catch(e){ console.log(rev,'KO',e.message) }
}
```

**Sonde 3** : ces fusions ont-elles résolu un conflit sur le manifeste ? Résultat : `CONFLICT (content)` pour `629ada8cf`, `658484bcc` et `35f7cfcca`.

```
git merge-tree --write-tree --name-only <m>^1 <m>^2 | grep primitives.manifest
```

**Sonde 4b** : clés du stock avant et après `b5a083158`. Résultat : source-format 997/997, 0 née, 0 morte ; perdues 23/23, 0 née, 0 morte.

```js
const k=e=>[e.famille,e.fichier,e.ref,e.occurrence].join(' :: ');
const A=new Set(arr(rd(sha+'^')).map(k)), B=new Set(arr(rd(sha)).map(k));
console.log('nes',[...B].filter(x=>!A.has(x)).length,'morts',[...A].filter(x=>!B.has(x)).length);
```

**Sonde 4** : `regles.json`, compte des `descRef` et des `desc` inline. Résultat : `4eb3e9fc7^` 86 entrées, 1 `descRef`, 85 inline ; `4eb3e9fc7` et `1d50eeebc` 86 entrées, 65 `descRef`, 21 inline.
