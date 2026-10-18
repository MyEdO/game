# Revue de palier — fenêtre 02b38d88b..0dc3cba27 — 2026-09-16

verdict: PARTIEL

Fenêtre `02b38d88b..0dc3cba27` (18 commits, 10 de substance, 5 fermetures) jugée en lecture seule par un juge unique (Opus, 2026-09-16) depuis l'arbre épinglé `C:/Users/gauch/PhpstormProjects/Foundry/Game/.wt-1738` — `git rev-parse HEAD` → `0dc3cba27e3e45957e1f634bc83ff575ce453181` (l'arbre ne porte AUCUN commit de solde en plus : le solde `1738.md` est seulement INDEXÉ, `git status --porcelain` → `A  .claude/soldes/1738.md`, et `git status --porcelain -- scripts/ .github/ package.json` rend VIDE, donc les sondes node jouées sur le disque lisent bien le contenu de `0dc3cba27`). Tête PUBLIÉE contrôlée : `git branch -r --contains 0dc3cba27` → `origin/HEAD -> origin/main`, `origin/chantier/1738`, `origin/main`. Contrôle POSITIF joué avant toute mesure : `git ls-tree -r -l 0dc3cba27 -- scripts/gates/classerPush.mjs scripts/gates/classerPush.test.mjs` → `8293` et `15497` octets — le travail de #1738 jugé ici est bien dans l'arbre épinglé. Les cinq fermetures TIENNENT : solde dans le commit qui ferme pour les cinq (`--stat` collé), au plus UN reste `-> #N` par solde, les cinq cibles de routage OPEN et pertinentes au titre (#1780, #1779, #1778, #1179, #1738), réfutation à verdict nommé pour les cinq avec attaques écartées PAR MESURE, et les cinq fermetures POSÉES par le job `fermetures` (`github-actions[bot]`), après publication, jamais à la main. Le régime #1776 est tenu au code à la tête (aucun bypass au ruleset, aucune exonération locale au pre-push) et le régime #1738 est EXACT à l'unité (16 sautables / 8 toujours, 0 écart `ci.yml` ↔ `ECRIT_LU`, `migrations` sans `needs`). Ce qui NE tient pas : le commit de tête `eedd1892a` porte, dans son propre § « Gates du périmètre », DEUX chiffres périmés (`test:hooks` 951, `test:docs` 76) que la mesure réfute et que sa PROPRE ligne `JUGE:` contredit (977, 83) — récidive de la classe « chiffre non pris sur les objets », QUATRIÈME palier d'affilée, et cette fois l'écart est interne au message ; l'une de ses trois lignes `CLIQUET:` nomme un porteur de stock qui n'en est pas un ; la doctrine « exemption au SITE, jamais au fichier » est enfreinte par une exemption fichier→cardinal ; `ECRIT_LU['test'].lit` sous-déclare `scripts/` alors que trois fichiers vitest le balaient, et la garde neuve de la classe « `lit` sous-déclaré » ne peut pas le voir ; le plafond « au plus UN reste routé » est tenu à la lettre pendant que SIX restes migrent vers les épiques d'inventaire #1680/#1388 dans cette seule fenêtre ; et la dérive de branches n'a pas bougé d'un commit (11 branches / 249 commits, à l'identique du palier précédent).

## Sortie brute de l'instrument

`npm run ops:faits-de-palier -- --base 02b38d88b --tete 0dc3cba27` — digest sans valeur réécrite :

```
KEYS base | tete | depuis | chainage | faitsChemin | commits | fermetures | stocks
     | fermeturesHorsCommit | auditStock | coursesCi | revuePrecedente | provenance
     (PAS de clé `derogations` : le journal de dérogation est MORT avec 50b1a3e92)
== base :: "02b38d88b"   == tete :: "0dc3cba27"   == depuis :: "2026-09-16"   == chainage :: "vérifié"
== commits substance = 10 / total 18
== fermetures :: [#1179 → c97c41458 (solde:true) · #1713 → 4702610114 (solde:true)
                  · #1180 → ddd508c03 (solde:true) · #1776 → d5449edb2 (solde:true)
                  · #1771 → 48a3966116 (solde:true)]
== stocks :: {"refus":[],"notes":[],"commits":18,"plage":"02b38d88b..0dc3cba27","indisponible":null}
== fermeturesHorsCommit :: "aucune fermeture non citée dans la fenêtre … Aucun écart à la baseline."
                           (baseline 12 entrées)
== auditStock :: "stock 5 entrée(s), observé 5 paquet(s) >= high … aucun écart au stock daté"
== coursesCi :: 0dc3cba27 → [CI: in_progress] · 0b3631840 → [CI: success] · 26bbe9cfb → [CI: success]
               · ddd508c03 → [CI: success] · d5449edb2 → [CI: success]
               · 75692d80c → [Canari: success, CI: success] · 5a92c11ef → [CI: success]
               ; 11 des 18 shas → "courses":[]
== revuePrecedente :: {".claude/soldes/revue-palier-2026-09-16-3113daad1-02b38d88b.md", disponible:true}
== provenance :: commits/fermetures/stocks/chainage = script · fermeturesHorsCommit/coursesCi = gh
                 · auditStock = npm audit · revuePrecedente = git
```

**Le `in_progress` de la tête est PÉRIMÉ et re-mesuré ici** : `gh run list --repo cgauche/game --branch main --limit 15` → `0dc3cba27 CI completed success 16/09/2026 15:07:03`. Sept runs CI sur `main` dans la fenêtre, sept `success`, aucun rouge (§ CI).

**La prémisse du brief est partiellement FAUSSE et corrigée sur pièces** : le brief attend « #1713 par `2953e8e83` ». `2953e8e83` n'existe pas dans cette fenêtre ; #1713 est fermé par `4702610114` (`chore(ops/docs): corrige #1713 — l'export hebdomadaire des issues est supprimé, sans lecteur ni push`). Le brief attend aussi trois `CLIQUET:` sur `a95c1a9df` : ce sha n'est pas dans la fenêtre non plus — le porteur des trois `CLIQUET:` est `eedd1892a` (§ Stocks nominatifs).

Sessions, mesurées : `git log 02b38d88b..0dc3cba27 --format='%h|%(trailers:key=Claude-Session,valueonly)'` → **UN SEUL** trailer distinct (`session_01ADFgEr5qfb1F8KAt6BVRmV`), posé sur 6 commits, dont **5 des 10 de substance** (`eedd1892a`, `4702610114`, `d5fd9a36d`, `c2ac8bee4`, `50b1a3e92`). Absent sur `2ccf7f4c0`, `8e625f818`, `6c1a1cfb9`, `48a3966116`, `765e1d111`. Palier précédent : 8/10 absents. **Amélioré (8 → 5), non résorbé** — voir grief 6.

## Fermetures

| # | commit qui ferme | solde dans le MÊME commit (`git show --stat`) | restes | routage | réfutation |
|---|---|---|---|---|---|
| #1179 | `c97c41458` | `.claude/soldes/1179.md \| 19 +++` (1 fichier) | 6 : 1 routé + **3 `inventaire #1680`** + 2 `RAS` | `-> #1780` — **OPEN**, titre « opéra : cloisons du plan, pièces de l'étage et garde-corps des balcons — suite de #1179 » : pertinent au reste | `verdict: CONFIRMÉ` — 7 attaques nommées (a)-(g), chacune écartée par mesure : folio 39 à 300 dpi pour les 62 arêtes, `outdoor z1 540→540` / `interior 2100→2100` / familles `{}` pour le basculement, mutation « dalle franchissable reste un défaut » pour l'exemption |
| #1713 | `4702610114` | `.claude/soldes/1713.md \| 12 +++` (sur 19 fichiers) | 4 : 1 routé + 2 corrigés DANS le commit + 1 `RAS` motivé | `-> #1779` — **OPEN**, titre « Porte de main : un rouge d'un workflow hors ci.yml n'est vu par aucune porte ni nommé par aucun canal » : pertinent, et OUVERT AVANT la fermeture | `verdict: PARTIEL` — 6 lentilles ; L2 (`toutes.mjs:112`, cardinal « un site ») **RÉFUTÉE par sonde `fs`** puis corrigée dans le geste ; L5 « fermeture TIENT sur le ticket, FRAGILE sur la classe » → #1779 |
| #1180 | `ddd508c03` | `.claude/soldes/1180.md \| 19 +++` (1 fichier) | 6 : 1 routé + **2 `inventaire #1680`** + 2 `RAS` + 1 corrigé | `-> #1778` — **OPEN**, titre « MapSpec : wallAppearances — une grille walled ne sait poser qu'une STRUCTURE là où elle veut un LOOK » : pertinent | `verdict: CONFIRMÉ` — (b) prouvée par MUTATION (cote remise → **462 offenseurs nommés**, 3 tests rouges), (d) par grep du site unique |
| #1776 | `d5449edb2` | `.claude/soldes/1776.md \| 13 +++` | 5 : 1 routé + 4 `RAS` chiffrés | `-> #1738` — **OPEN** : pertinent, et c'est le ticket que CE palier livre | `verdict: PARTIEL` — DoD 4 **RÉFUTÉ À LA LETTRE** (« même heure » → 71 min), DoD 2 FRAGILE remesuré à 4 tailles, DoD 6 partiel ; #1738 capture RÉFUTÉE → reste ouvert |
| #1771 | `48a3966116` | `.claude/soldes/1771.md \| 23 +++` + la revue de palier précédente `\| 214 +++` | 8 : 1 routé + **2 inventaires (#1680, #1388)** + 3 corrigés + 2 `RAS` | `-> #1179` — **OPEN au moment du routage**, fermé plus tard dans la MÊME fenêtre par `c97c41458` : le reste a été PORTÉ, pas seulement rangé | `verdict: PARTIEL` — (a) la clause PORTE de #1644 déclarée LEVÉE au rez et CONTREDITE à l'étage, dite et routée ; (b) « libellés sans ligne de Source » écartée par sonde PDF |

**Fermetures effectivement POSÉES par la machine, jamais à la main** — mesure `gh api repos/cgauche/game/issues/<N>/timeline --jq '.[] | select(.event=="closed")'` :

```
#1713 → {"actor":"github-actions[bot]","at":"2026-09-16T12:58:05Z"}
#1776 → {"actor":"github-actions[bot]","at":"2026-09-16T10:41:40Z"}
#1179 → {"actor":"github-actions[bot]","at":"2026-09-16T14:42:23Z"}
```

Chaque fermeture SUIT son run `build` vert sur `main` : #1776 à 10:41:40 après `d5449edb2 CI success 10:31:29` ; #1713 à 12:58:05 après `26bbe9cfb CI success 12:47:26` ; #1179 à 14:42:23 après un run de la même série. `gh issue view` confirme `state: CLOSED` pour #1179, #1180, #1713, #1771, #1776 ; `OPEN` pour #1777, #1778, #1779, #1780, #1738. **Le credo « une issue se ferme CORRIGÉE, et la fermeture suit la PUBLICATION » est tenu sur les cinq, mécaniquement.**

**Attaque particulière, jouée et PERDUE : « #1713 est fermé par SUPPRESSION, donc la fonction est perdue sans porteur ».** Réfutée par mesure : (a) la prémisse « aucun lecteur » est vérifiable à la tête — `git ls-tree -r --name-only 0dc3cba27 -- docs/decisions` rend **VIDE** (exit 0), et `git ls-tree -r --name-only 0dc3cba27 -- .github/workflows` rend exactement `canari.yml ci.yml deploy.yml deps-report.yml` : `export-issues.yml` a disparu, l'inventaire est cohérent avec la prose du doc dérivé (5 → 4 workflows) ; (b) le poids annoncé est EXACT — `git ls-tree -l 4702610114^ -- docs/decisions/` → `4120430  docs/decisions/issues.json` = **4,12 Mo, l'annonce « 4,1 Mo » est VRAIE** ; (c) la suppression est COMPLÈTE, pas un fichier orphelin : le commit purge dans le même geste les 6 sites qui nommaient le chemin mort (`memoryLinks.mjs`, `check-plans-anchors.mjs`, `check-doc-refs.mjs`, `manualDocsStock.mjs`, `ruleset-main.mjs`, `pre-push.mjs`, `build-reprise.mjs`) ; (d) l'arbitrage utilisateur est CITÉ verbatim avec sa date (« Oui, supprimer (Recommandé) », 2026-09-16) et il SUPERSÈDE explicitement celui du 2026-09-08 en disant pourquoi ; (e) la CLASSE survivante est routée AVANT la fermeture (#1779 OPEN). **La fermeture TIENT.**

## Commits de substance

`JUGE:` — `git log 02b38d88b..0dc3cba27 --format='%h' --grep='JUGE:'` → `eedd1892a 2ccf7f4c0 4702610114 8e625f818 6c1a1cfb9 d5449edb2 d5fd9a36d c2ac8bee4 50b1a3e92 48a3966116 765e1d111` : **les 10 commits de substance le portent** (plus `d5449edb2`, un solde).
`REFUTATION:` — même commande, `--grep='REFUTATION:'` → 9 shas ; **manquent `d5fd9a36d` et `c2ac8bee4`**. Donc **8 des 10 commits de substance portent les DEUX lignes** (contre 9/10 au palier précédent). Nuance dite : `d5fd9a36d` porte au contraire du contenu de réfutation SOUS le libellé `JUGE:` (« sonde `jugerPush` sur `refs/heads/main` avec et sans `GITHUB_ACTIONS=true` : refus identiques » — c'est une réfutation), c'est l'ÉTIQUETTE qui manque, pas la preuve.

Quatre annonces rejouées, sur DEUX canaux distincts (le canal `session_01ADFgEr…` et le canal anonyme sans trailer), dont deux **RÉFUTÉES**.

| sha | canal | annonce | rejeu à `0dc3cba27` |
|---|---|---|---|
| `eedd1892a` | `session_01ADFgEr…` | « 16 gates sautables … 8 jouent toujours » | **VRAIE, à l'unité, et confrontée dans les deux sens.** Sonde node ci-dessous → `SAUTABLES 16`, `TOUJOURS 8`, `ECARTS ci.yml<->ECRIT_LU 0`. Les 8 toujours sont EXACTEMENT ceux annoncés : `agents:check deps:unused docs:check docs:empreinte test:agents test:docs test:hooks test:ops`. Recoupé au fichier : `git show 0dc3cba27:.github/workflows/ci.yml \| grep -c "produit != 'false'"` → **20** = 16 sautables + 3 `CI_SEULEMENT_PRODUIT` (`gen` mutant l.71, `raw:catalogs` mutant l.91, `npm --prefix server ci` l.111) + 1 rejeu de `migrations` (l.140). Aucun reste. |
| `eedd1892a` | `session_01ADFgEr…` | « `test:ops` 243 » | **VRAIE.** `npm run test:ops` → `1..231 / # tests 243 / # pass 243 / # fail 0`. |
| `eedd1892a` | `session_01ADFgEr…` | « `test:hooks` 951 » (§ Gates du périmètre) | **RÉFUTÉE.** `npm run test:hooks` sur l'arbre épinglé → `1..965 / # tests 979 / # pass 979 / # fail 0 / # duration_ms 34899`. Ni 979 ni 965 ne valent 951. **951 est le chiffre du commit PRÉCÉDENT** (`4702610114` : « `test:hooks` 951/951 »), recopié dans un message dont le geste AJOUTE 11 cas (migration `memoryLinks.test.mjs`) + 2 tests (son propre `CLIQUET:`). La ligne `JUGE:` du MÊME commit dit « `test:hooks` 977 » — et 977 + 2 = 979, la mesure. Voir grief 1. |
| `eedd1892a` | `session_01ADFgEr…` | « `test:docs` 76 » (§ Gates du périmètre) | **RÉFUTÉE.** `npm run test:docs` → `1..83 / # tests 83 / # pass 83 / # fail 0`. **76 est aussi le chiffre de `4702610114`** ; la ligne `JUGE:` du même commit dit « `test:docs` 83 », qui est la mesure. Voir grief 1. |
| `4702610114` | `session_01ADFgEr…` | « issues.json 4,1 Mo » | **VRAIE.** `git ls-tree -l 4702610114^ -- docs/decisions/` → `4120430` octets = 4,12 Mo. |

Sonde du 16/8, lecture seule, promouvable en test (c'est exactement l'invariant que `classerPush.test.mjs` teste déjà dans les deux sens ; elle est reproduite ici comme CONTRÔLE INDÉPENDANT, hors du banc du lot) :

```js
const R = 'file:///C:/Users/gauch/PhpstormProjects/Foundry/Game/.wt-1738/scripts/gates/'
const { gatesSautables, CONDITION_PRODUIT } = await import(R + 'classerPush.mjs')
const { gatesDeCi } = await import(R + 'gatesDeCi.mjs')
const { ECRIT_LU } = await import(R + 'toutes.mjs')
const cwd = 'C:/Users/gauch/PhpstormProjects/Foundry/Game/.wt-1738'
const gates = gatesDeCi({ cwd })
const s = gatesSautables({ gates, ecritLu: ECRIT_LU })
const noms = gates.map(g => g.nom)
console.log('gatesDeCi total', noms.length)
console.log('SAUTABLES', s.size, '::', [...s].sort().join(' '))
const tj = noms.filter(n => !s.has(n)).sort()
console.log('TOUJOURS', tj.length, '::', tj.join(' '))
const ecarts = gates.filter(g => ((g.si ?? '').includes(CONDITION_PRODUIT)) !== s.has(g.nom))
console.log('ECARTS ci.yml<->ECRIT_LU', ecarts.length, ecarts.map(e=>e.nom).join(' '))
```

Sortie :

```
gatesDeCi total 24
SAUTABLES 16 :: build lint raw:check-code-refs raw:check-folio-continuity raw:check-refs
  raw:check-source-format raw:check-source-tables raw:coverage raw:reanchor raw:reconcile
  server:typecheck test test:raw test:recette test:runner typecheck
TOUJOURS 8 :: agents:check deps:unused docs:check docs:empreinte test:agents test:docs test:hooks test:ops
ECARTS ci.yml<->ECRIT_LU 0
```

## Stocks nominatifs

`refus: []`, `notes: []` sur 18 commits. Les `CLIQUET:` de la fenêtre vivent sur `eedd1892a` (trois) et `c2ac8bee4` (un). Comptés à la pièce, `git diff <sha>^ <sha> -- <fichier>` :

| `CLIQUET:` déclaré | mesure du diff | verdict |
|---|---|---|
| `c2ac8bee4` : `scripts/gates/ecrivainsAtteints.test.mjs +2` | le diff ajoute EXACTEMENT deux entrées : `'scripts/ops/ruleset-main.mjs'`, `'scripts/ops/ruleset-main.test.mjs'`, avec leur mesure en commentaire | **VRAI** |
| `eedd1892a` : `scripts/gates/ecrivainsAtteints.test.mjs +2` | le diff ajoute EXACTEMENT deux entrées : `'scripts/gates/classerPush.test.mjs'`, `'scripts/guards/lib/memoryLinks.test.mjs'` | **VRAI** |
| `eedd1892a` : `src/ui/registry-id-branch-guard.test.ts +1` | le diff ajoute EXACTEMENT une entrée : `'scripts/gates/classerPush.mjs': 1,` + 4 lignes de motif | **VRAI sur le compte, DÉFECTUEUX sur la forme** — grief 3 |
| `eedd1892a` : `scripts/gates/classerPush.test.mjs +1` | `git grep -n "classerPush.test.mjs" 0dc3cba27 -- scripts src` rend **3 hits**, dont UN SEUL est une entrée de stock : `scripts/gates/ecrivainsAtteints.test.mjs:35` — c'est-à-dire l'une des deux entrées DÉJÀ couvertes par le `CLIQUET:` précédent. Aucun stock ne vit dans `classerPush.test.mjs` (`git show 0dc3cba27:scripts/gates/classerPush.test.mjs \| head -1` → « CLIQUET du CLASSEMENT DU PUSH — `ci.yml` confronté à la MESURE `ECRIT_LU` », un banc, pas un magasin) | **SUR-DÉCLARATION** — grief 4 |

La convention est explicite au code : `git show 0dc3cba27:scripts/guards/budget-contexte.mjs:44` — « Le fichier qui PORTE le plafond : c'est lui que le `CLIQUET:` d'un message de commit nomme », et `budget-contexte.test.mjs:127` est un test de CLASSE (« un CLIQUET qui nomme un AUTRE fichier ne couvre pas le budget »). La sur-déclaration ne rompt pas `refus: []` (elle ne fait qu'ajouter du bruit), mais elle rend le grand livre des cliquets INEXACT : trois lignes annoncent trois croissances quand l'arbre en porte deux distinctes (+2 et +1, sur deux fichiers).

`auditStock` : 5 entrées, 5 paquets `>= high`, « aucun écart au stock daté ». Aucune croissance.

## CI

- **Sept têtes, sept verts sur `main`.** `gh run list --repo cgauche/game --branch main --limit 15 --json headSha,conclusion,status,workflowName,createdAt` :

```
0dc3cba27 CI success 16/09 15:07   0b3631840 CI success 16/09 14:31   26bbe9cfb CI success 16/09 12:47
ddd508c03 CI success 16/09 12:28   d5449edb2 CI success 16/09 10:31   75692d80c Canari success 16/09 10:14
75692d80c CI success 16/09 09:54   5a92c11ef CI success 16/09 08:53   02b38d88b CI success 15/09 23:38
```

Les fast-forwards de `main` cités par le brief ont chacun leur run vert SUR `main` : `26bbe9cfb` ✅, `0dc3cba27` ✅. Aucun rouge de CI dans la fenêtre. La branche de chantier porte aussi sa preuve : `gh run list --branch chantier/1738` → `0dc3cba27 CI success 16/09 14:56` **précède** le run de `main` à 15:07 — le régime « la CI de la branche est la porte, `main` ne reçoit qu'un fast-forward vert » est observé de bout en bout, chronomètre à l'appui.
- **11 des 18 shas sans run propre** : régime de publication en TRAIN, la tête porte la preuve. Identique au palier précédent, pas un grief en soi.
- **`Export des issues` a DISPARU** : aucun rouge hebdomadaire n'est plus possible. Grief 6 du palier précédent **RÉSORBÉ par suppression**, avec arbitrage utilisateur cité (§ Fermetures).

## Dérogations et fermetures hors commit

- `derogations` : la clé n'existe plus dans la sortie de l'instrument — `git grep -n "derogation" 0dc3cba27 -- scripts/ops/faits-de-palier.mjs` rend **VIDE (exit 1)**. Ce n'est pas une panne : `50b1a3e92` a tué « les leviers de dérogation et leur journal » avec le justificatif de gates. L'instrument ne rapporte plus un canal mort — cohérent, et une absence VÉRIFIÉE vaut mieux qu'un `[]` d'un mécanisme supprimé.
- `fermeturesHorsCommit` : « aucune fermeture non citée dans la fenêtre », **aucun écart à la baseline de 12 entrées** (provenance `gh`). Recoupé indépendamment : les trois timelines lues ci-dessus donnent `github-actions[bot]` pour actor — aucune fermeture manuelle.

## Régime #1776 et #1738 tenus à la tête

Mesuré au blob, jamais au message :

- **`pre-push` sans bypass** : `git show 0dc3cba27:scripts/git-hooks/pre-push.mjs | grep -E "GITHUB_ACTIONS|bypass|skip"` rend **une seule ligne, un COMMENTAIRE** : « `GITHUB_ACTIONS` : le ruleset n'en porte aucune (HTTP 422 du 2026-09-16) — un saut local ne… ». Aucune branche de code.
- **`ruleset-main.mjs` sans `bypass_actors`** : `grep -n "bypass"` rend **deux lignes, toutes deux en commentaire** (« AUCUN BYPASS — mesure du 2026-09-16 à l'activation… »). Les clés du corps posé sont `name`, `target: 'branch'`, `enforcement: 'active'`, `conditions`, `rules` — **aucune clé `bypass_actors`**. Le 422 du serveur est PORTÉ au code, pas contourné.
- **`migrations` sans `needs`** : `git show 0dc3cba27:.github/workflows/ci.yml | grep -n "needs:"` rend **deux lignes** — un COMMENTAIRE (l.118 : « JAMAIS de `needs: build` : c'est un check REQUIS du ruleset `main`, et un check `skipped` bloque le fast-forward ») et **l.149 `needs: build`, qui appartient au job `fermetures`** (l.147-149), pas à `migrations` (l.120-146). La lecture naïve du grep aurait menti ; la lecture par jobs confirme l'annonce.
- **Ordre du classement** : le step `classer` précède `npm ci` dans les DEUX jobs à checks requis (`ci.yml` l.43 `run: node scripts/gates/classerPush.mjs >> "$GITHUB_OUTPUT"`, l.44-45 `id: install / run: npm ci`), ce que la garde verrouille (`classerPush.test.mjs` : « le classement doit précéder `npm ci` — il n'importe que node:* »). Fail-closed en polarité : les 20 conditions sont toutes `!= 'false'`, jamais `== 'true'`.
- **Contre-attaque « `.claude/` documentaire ouvre un trou : une fiche seule sauterait une garde qui la lit »** — RÉFUTÉE par mesure. `git grep -nE "(readFileSync|readdirSync|readFile|globSync|glob\()" 0dc3cba27 -- 'src/**' | grep -E "\.claude|\.agents|\.codex|AGENTS\.md|CLAUDE\.md"` → **exit 1, zéro hit** : les 30+ occurrences de `CLAUDE.md` sous `src/` sont toutes en COMMENTAIRE ou en prose de donnée. Et les deux gardes documentaires qui LISAIENT vraiment `.claude/` (`memory-links-guard`, `manual-docs-ratchet`) ont migré vers `test:hooks` / `test:docs`, tous deux dans les 8 gates qui jouent TOUJOURS (`ECRIT_LU['test:hooks'].lit` contient `'.claude/'`). **Aucun chemin par lequel un push de fiche saute la garde qui la lit.** La porte de #1738 TIENT.

## Griefs de la revue précédente (10 routés)

| grief du 2026-09-16 (`02b38d88b`) | état dans CETTE fenêtre | mesure |
|---|---|---|
| 1 — `edf042cfa` supprime une revue de palier (« doublon » faux, 4 trouvailles désarchivées) | **TRACÉ, non résorbé** | `gh issue view 1777` → **OPEN**, titre « Revue de palier SUPPRIMÉE par edf042cfa (« doublon » faux : 4 trouvailles désarchivées) — une revue orpheline se RECALE, garde contre la suppression ». Aucun commit de la fenêtre ne le porte ; aucune garde neuve dans `scripts/guards/lib/revuePalier.mjs` contre la SUPPRESSION (le module ne valide que le NOM et la FENÊTRE d'une revue AJOUTÉE, `revuesNeuves` lit `--diff-filter=A`). **Persistant.** |
| 2 — cardinal vivant 40/89 de `scenarios-contrat.test.ts` | **RÉSORBÉ** | corrigé par `765e1d111` (solde `1771.md` : « -> corrigé par 765e1d111 src/data/schemas/defs-scenes/scenarios-contrat.test.ts:35 »), plancher + diagnostic. |
| 3 — « chiffre non pris sur les objets » (49 vs 53 de `3446f0b25`), routé #1392 | **AGGRAVÉ : la classe RÉCIDIVE, 4e palier d'affilée, DEUX fois dans le même message** | `eedd1892a` : « `test:hooks` 951 » vs « `test:hooks` 977 » et « `test:docs` 76 » vs « `test:docs` 83 », mesures 979 et 83. Voir grief 1. |
| 4 — correctif de gate APRÈS le commit qui ferme (×3), routé #1750 | **RÉSORBÉ dans cette fenêtre** | aucune des cinq fermetures n'est suivie d'un correctif de gate : les commits qui suivent `c97c41458`, `4702610114`, `ddd508c03`, `d5449edb2`, `48a3966116` sont soit des `chore(docs)` de docs dérivés (`0b3631840`, `26bbe9cfb`, `75692d80c`), soit le lot suivant. Le seul « correctif de rouge après coup » est `c2ac8bee4`, qui corrige un rouge de CI de BRANCHE de `50b1a3e92` — donc AVANT tout fast-forward de `main` : c'est le régime #1776 qui fonctionne, pas un solde signé sur un arbre rouge. |
| 5 — trailer `Claude-Session` absent sur 8/10 des commits de substance, routé #1750 | **AMÉLIORÉ, non résorbé : 5/10** | mesure ci-dessus. Toujours **une seule session distincte** : la lentille « ≥ 2 sessions » reste inapplicable. Voir grief 6. |
| 6 — `Export des issues` rouge, deux exports perdus, routé #1713 | **RÉSORBÉ** | #1713 **CLOSED** le 2026-09-16 à 12:58:05 par `github-actions[bot]` ; `git ls-tree -r --name-only 0dc3cba27 -- .github/workflows` ne rend plus `export-issues.yml` ; `docs/decisions/` vide. Résorbé PAR SUPPRESSION, sur arbitrage utilisateur cité verbatim + date. |
| Dérive de branches (11 / 249 au palier précédent) | **STRICTEMENT IDENTIQUE, ni décrue ni crue** | sonde ci-dessous : **11 branches hors régime portant exactement 249 commits jamais fusionnés**, la plus vieille toujours `worktree-agent-a8c251af80eb67c75 +13 2026-08-05`. Aucune reprise. Voir grief 7. |
| Grief 10 du palier 2026-09-09 (« la porte ne voit que `ci.yml` ») | **TRACÉ, non résorbé — et correctement disposé** | `gh issue view 1779` → **OPEN**. Le solde `1713.md` le NOMME explicitement (« l'INSTANCE disparaît avec ce lot, la CLASSE survit -> #1779 ») et le ticket a été ouvert AVANT la fermeture. C'est la disposition exemplaire d'un reste de classe : instance corrigée, classe ouverte, fermeture assumée sur l'instance seule. |

Sonde de la dérive (lecture seule) :

```js
import { execFileSync } from 'node:child_process'
const cwd = 'C:/Users/gauch/PhpstormProjects/Foundry/Game/.wt-1738'
const g = (a) => execFileSync('git', a, { cwd, encoding: 'utf8' }).trim()
const branches = g(['branch','-a','--format=%(refname:short)']).split('\n').filter(b=>b && !b.includes('HEAD'))
let tot = 0; const l = []
for (const b of branches) {
  if (b === 'main' || b === 'origin/main') continue
  let n; try { n = Number(g(['rev-list','--count',`origin/main..${b}`])) } catch { continue }
  if (n > 0) { l.push(`${b} +${n} ${g(['log','-1','--format=%ad','--date=short',b])}`); tot += n }
}
console.log(l.join('\n')); console.log('AVANCE>0', l.length, '| TOTAL_NON_FUSIONNES', tot)
```

Sortie (hors `backup/*`, `sauvegarde/*` et doublons `origin/*`, population du tableau du palier précédent) : `ab/notre +1` · `ab/phanes +6` · `ab/phanes-c +7` · `chantier/1456-choix +1` · `chantier/1501-jets-mer +68` · `chantier/mobilier-diligence +70` · `codex/1388 +68` · `essai/phaneslight-rejeu +9` · `fix/garde-rm-worktree +5` · `worktree-agent-a8c251af80eb67c75 +13` · `worktree-agent-ecran +1` = **11 branches, 249 commits**. Note POSITIVE mesurée au passage : les branches du palier `chantier/1179`, `chantier/1180`, `chantier/1738` sont toutes à **+0** — les chantiers de la fenêtre ont bien rejoint le tronc, la dérive est un stock HISTORIQUE figé, pas une fuite en cours. Les 4 branches `backup/*` + `sauvegarde/*` (74+42+2+71+42 = 231 commits) sont hors population, comme au palier précédent.

## Architecture à rebours (#1776 → #1713 → #1738)

Trois coutures, la question posée à chacune : *si on repartait de zéro avec le ruleset d'aujourd'hui, existerait-elle telle quelle ?*

**#1776 — « la CI de la branche est la porte, `main` entre en fast-forward » : TIENT, et c'est la couture qui SIMPLIFIE.** De zéro, avec un ruleset serveur actif, on n'écrirait jamais le justificatif de gates par contenu (`justificatif.mjs`, `justifie.mjs`, `portePush.mjs`, `pushes-justifies.mjs`, le verrou machine, le journal de dérogation) : c'est une porte CLIENTE qui réimplémente une porte SERVEUR, et le lot les tue toutes. Ce qui reste est irréductible : un ruleset côté serveur (la seule porte qu'un agent ne peut pas contourner) et un `pre-push` à quatre refus dont aucun n'est une re-vérification du serveur. La preuve par le réel est dans la fenêtre : `c2ac8bee4` existe parce que le run CI de la BRANCHE a attrapé deux écrivains non déclarés que le vert local n'avait pas vus — « les deux fichiers étaient NON SUIVIS au moment des gates du périmètre, invisibles de la sonde jusqu'au commit ». C'est exactement le trou que la couture est censée fermer, et elle l'a fermé en production. **Aucun défaut concret.**

**#1713 — la suppression de l'export : TIENT, mais c'est un RETRAIT, pas une couture.** De zéro on ne l'écrirait pas : un miroir hebdomadaire de l'API GitHub dans le dépôt, poussé par un bot que le ruleset refuse, sans lecteur. Le lot ne laisse rien : 0 lecteur (contre-sondé), 0 exemption orpheline, 0 chemin mort, et la garde reste verte SANS l'exemption qu'on lui retire (`check-plans-anchors`, banc 7/7 — preuve qu'aucune exemption ne compensait un défaut). **Aucun défaut concret**, sinon qu'il a fallu 13 jours et deux exports perdus pour trancher entre « le job joue les gates » (2026-09-08) et « supprimer » (2026-09-16), là où la bonne question — « qui LIT ce fichier ? » — se mesurait dès l'ouverture.

**#1738 — le classement du push : TIENT sur la porte, FRAGILE sur sa MESURE.** De zéro, on écrirait la même chose : une gate joue ssi elle lit ce que le push touche ; la liste documentaire est courte, nommée et fail-closed ; la condition est portée par CHAQUE step plutôt que par un job, ce qui garde `build` et `migrations` non-`skipped` — condition dure imposée par le ruleset, pas un choix de style. Le **défaut concret** est dans l'assiette de la décision : `gatesSautables` lit `ECRIT_LU[gate].lit`, une déclaration, et la garde neuve ne la confronte au CODE ATTEINT que sur **un seul axe** (« ne nomme aucun chemin DOCUMENTAIRE »), jamais sur la COMPLÉTUDE. Mesure : `ECRIT_LU['test'].lit` vaut `["src/","server/src/","scripts/map/","docs/","Source/",".gitattributes","vite.config.ts"]` alors que trois fichiers vitest balaient `scripts/` bien au-delà de `scripts/map/` — `src/gameIso/rig/plan-species-vocabulaire.test.ts:154` (`readCorpus(['src','scripts'], …)`), `src/gameIso/catalog/planche-qc-cuisson.test.ts:180` (`readCorpus(['scripts/qc'], …)`), `src/scenes/generateurs-byte-stables.test.ts:37` (`listerDossier(SCRIPTS_DIR)`). La sonde `fs` annoncée (« 24 200 lectures ») a donc rendu un `lit` incomplet, et la garde ne peut pas le voir. Voir grief 2.

## Griefs

**Grief 1 — `eedd1892a` porte, dans son § « Gates du périmètre », DEUX chiffres périmés que sa propre ligne `JUGE:` contredit et que la mesure réfute : c'est la classe « chiffre non pris sur les objets », QUATRIÈME palier d'affilée.** Le message dit, § Gates du périmètre : « `test:hooks` 951, `test:docs` 76, `test:ops` 243 ». La même page, ligne `JUGE:` lentille L5, dit : « `test:hooks` 977, `test:docs` 83 ». Rejeu sur l'arbre épinglé (working tree propre sur `scripts/`, `.github/`, `package.json` — contrôlé) :

```
$ npm run test:hooks   →  1..965 / # tests 979 / # pass 979 / # fail 0 / # duration_ms 34899.5464
$ npm run test:docs    →  1..83  / # tests  83 / # pass  83 / # fail 0
$ npm run test:ops     →  1..231 / # tests 243 / # pass 243 / # fail 0
```

`test:ops` 243 est VRAI. `test:hooks` 951 et `test:docs` 76 sont FAUX — et ce sont mot pour mot les chiffres du commit précédent du même train (`4702610114` : « `test:hooks` 951/951 ; `test:docs` 76/76 »), recopiés dans un message dont le geste MIGRE 18 cas de vitest vers ces deux gates et AJOUTE 2 tests par son propre `CLIQUET:`. L'arithmétique du commit se boucle d'ailleurs sur les bons chiffres : 977 (mesure du juge) + 2 (les deux tests du `CLIQUET:`) = 979 (ma mesure). Le message annonce donc, dans son bloc de PREUVE, un état d'AVANT son propre geste, tandis qu'il porte ailleurs l'état d'APRÈS.

→ attendu : les chiffres du § « Gates du périmètre » se prennent sur la sortie du dernier rejeu, pas sur le message précédent ; deux chiffres d'une même grandeur dans un message se lisent de la MÊME mesure. `fichier:ligne` : `git show eedd1892a --format=%B`, § « Gates du périmètre : `test:hooks` 951 … `test:docs` 76 » vs ligne `JUGE:` « L5 migration TIENT (… `test:hooks` 977, `test:docs` 83) ». **Non bloquant** (les gates sont VERTES, 979/979 et 83/83, aucune régression), mais c'est la 4e récidive consécutive d'une classe déjà routée sur #1392, et la 2e fois d'affilée que l'écart est INTERNE au message — détectable sans aucune mesure de code, par une relecture du message par son auteur. La classe appelle désormais une GARDE, pas un ticket : un hook de commit qui refuse deux occurrences contradictoires du motif `<gate> <nombre>` dans un même message est un détecteur à une regex.

**Grief 2 — la garde neuve de la classe « `lit` sous-déclaré » ne mesure qu'UN axe, et l'axe non mesuré est déjà faux à la tête : `ECRIT_LU['test'].lit` omet `scripts/`.** `eedd1892a` annonce : « La classe « `lit` sous-déclaré » reçoit sa garde : pour chaque gate sautable, le corpus qu'elle atteint (`corpusParGate`) ne nomme aucun chemin documentaire ». La garde est réelle et bien faite (`classerPush.test.mjs`, test « aucune gate SAUTABLE ne nomme un chemin DOCUMENTAIRE dans le code qu'elle atteint »), mais son assertion est `trous == []` sur les seuls JETONS de `DOCUMENTAIRE` : elle ne confronte JAMAIS `lit` à la complétude du corpus. Trois sites mesurés où `npm test` lit `scripts/` hors `scripts/map/` :

```
$ git grep -nE "readCorpus\(|listerArbre\(|listerDossier\(" 0dc3cba27 -- 'src/**' | grep -i script
src/gameIso/rig/plan-species-vocabulaire.test.ts:154:  for (const { rel, text } of readCorpus(['src', 'scripts'], { exts: ['.ts','.tsx','.mts'], tests: true })) {
src/gameIso/catalog/planche-qc-cuisson.test.ts:180:    const fichiers = readCorpus(['scripts/qc'], { exts: ['.mts','.mjs','.ts','.js'] })
src/scenes/generateurs-byte-stables.test.ts:37:  for (const nom of listerDossier(SCRIPTS_DIR)) {
```

contre `ECRIT_LU['test'].lit = ["src/","server/src/","scripts/map/","docs/","Source/",".gitattributes","vite.config.ts"]`. Conséquence mesurée aujourd'hui : **AUCUNE sur le classement** (`scripts/` n'est pas documentaire, `test` reste sautable dans les deux cas) et **aucune sur les lanes** — sonde `conflitsEntreLanes()` → `[]` avant comme après mutation (`conflits si test declare scripts/: []`), parce qu'aucune gate ne déclare `ecrit` sous `scripts/`. C'est donc un défaut LATENT et non un trou : le jour où une gate écrira sous `scripts/` (un générateur, un `gen` d'outillage), `conflitsEntreLanes` ne verra pas le conflit avec la suite, et `npm run gates` jouera deux gates concurrentes sur le même arbre. Le credo l'a déjà nommé : « une garde de synchronisation est un smell : une seule source de vérité » — ici `lit` est une DÉCLARATION synchronisée à la main avec un corpus qui se CALCULE.

→ attendu : le même banc qui confronte le corpus aux jetons documentaires le confronte à `lit` tout court — tout dossier de premier niveau nommé par le corpus d'une gate doit être couvert par un préfixe de son `lit`, ou la gate rougit. `fichier:ligne` : `scripts/gates/classerPush.test.mjs`, test « aucune gate SAUTABLE ne nomme un chemin DOCUMENTAIRE dans le code qu'elle atteint » (un seul axe) ; `scripts/gates/toutes.mjs`, entrée `ECRIT_LU['test'].lit`. **Non bloquant** — la porte de #1738 TIENT (contre-grep des lectures documentaires depuis `src/` à zéro, § Régime).

**Grief 3 — l'exemption posée par `eedd1892a` dans `registry-id-branch-guard.test.ts` est au FICHIER et porte un CARDINAL, contre la fiche `user-doctrine-garde-exemption-au-site-forme-et-catalogue` et contre ce que la garde voisine sait déjà faire.** Le diff ajoute :

```
+  'scripts/gates/classerPush.mjs': 1,
```

c'est-à-dire : *ce FICHIER a droit à UNE occurrence*. Deux défauts en un. (a) La granularité est le fichier, non le site : n'importe quelle autre occurrence du motif `ID_NAME_RX` ajoutée plus tard dans `classerPush.mjs` — un vrai défaut, celui-là — consommerait l'exemption sans être vue, à un `1` près. (b) Le `1` est un cardinal vivant dans un stock de garde : `.claude/rules/tests.md` l'interdit, et le grief 2 du palier PRÉCÉDENT portait exactement là-dessus (corrigé par `765e1d111` dans cette même fenêtre — la doctrine est donc fraîche et connue de l'équipe). Le commit le SAIT et le déclare en `CLIQUET:` (« la garde n'exempte qu'au fichier (cardinal) »), ce qui est honnête, mais un `CLIQUET:` déclare une croissance, il n'autorise pas une forme. Et la forme au SITE existe déjà dans l'arbre, à deux fichiers de là : le palier précédent a mesuré `check-doc-refs.mjs` / `DOC_REF_SITES_EXEMPTS`, clé `fichier|jeton` — une exemption au SITE, sans compte. Le canonique était disponible, c'est le voisin qui a été copié.

→ attendu : `registry-id-branch-guard` exempte par clé de SITE (`fichier|symbole` ou `fichier:ligne`, comme `DOC_REF_SITES_EXEMPTS`), sans cardinal ; à défaut, le motif SAIN (« comparer `github.ref` à une ref git ») se reconnaît par la garde elle-même. `fichier:ligne` : `src/ui/registry-id-branch-guard.test.ts`, entrée `'scripts/gates/classerPush.mjs': 1` (ajoutée par `eedd1892a`). **Non bloquant.**

**Grief 4 — la troisième ligne `CLIQUET:` de `eedd1892a` nomme un porteur de stock qui n'en est pas un, et double-déclare une croissance déjà couverte.** Elle dit : `CLIQUET: scripts/gates/classerPush.test.mjs +1 — fixture d'un dépôt jetable … pas un stock : faux positif de forme`. Or `git grep -n "classerPush.test.mjs" 0dc3cba27 -- scripts src` rend **trois hits** : un commentaire d'en-tête, un renvoi dans `gatesDeCi.mjs:62`, et **une seule entrée de stock — `scripts/gates/ecrivainsAtteints.test.mjs:35`**, précisément l'une des DEUX entrées déjà déclarées par le `CLIQUET:` `ecrivainsAtteints.test.mjs +2` du même message. `classerPush.test.mjs` est un fichier NEUF de 359 lignes créé par ce commit ; il ne porte aucun stock. La convention est pourtant explicite au code : `budget-contexte.mjs:44` — « Le fichier qui PORTE le plafond : c'est lui que le `CLIQUET:` d'un message de commit nomme » — et `budget-contexte.test.mjs:127` teste la classe (« un CLIQUET qui nomme un AUTRE fichier ne couvre pas le budget »). Effet réel : nul sur `refus: []` (une sur-déclaration ne peut que resserrer), mais le grand livre des cliquets annonce trois croissances quand l'arbre en porte deux, sur deux fichiers — un lecteur du palier suivant cherchera un magasin qui n'existe pas.

→ attendu : une ligne `CLIQUET:` nomme le FICHIER QUI PORTE LE STOCK, jamais le fichier à l'origine de l'entrée ; deux entrées ajoutées au même stock font UNE ligne `+2`, pas `+2` et `+1`. `fichier:ligne` : `git show eedd1892a --format=%B`, 3e ligne `CLIQUET:`. **Non bloquant.**

**Grief 5 — le plafond « au plus UN reste routé par solde » est tenu à la LETTRE pendant que SIX restes migrent, dans cette seule fenêtre, vers des épiques d'inventaire qu'aucun solde ne fermera.** Mesure :

```
$ git grep -c "inventaire #1680" 0dc3cba27 -- .claude/soldes
.claude/soldes/1179.md:3        ← cette fenêtre
.claude/soldes/1180.md:2        ← cette fenêtre
.claude/soldes/1478.md:1
.claude/soldes/1624.md:1
.claude/soldes/1687.md:2
.claude/soldes/1771.md:1        ← cette fenêtre
(+ .claude/soldes/1771.md porte aussi un « inventaire #1388 »)
```

Avant cette fenêtre, tout le dépôt portait **4 lignes** `inventaire #1680`, réparties sur 3 soldes. Cette fenêtre en ajoute **6** sur 3 soldes — le stock a été multiplié par 2,5 en un palier, et la revue précédente n'en comptait qu'une seule (« 2 `RAS` + 1 `inventaire #1680` » sur `1478.md`). `gh issue view 1680` → **OPEN**, 25 commentaires, titre « SOCLE VOLUMIQUE — 18 régimes coexistants … audit d'architecture 2026-09-01 » : une épique de vague, ouverte depuis 15 jours, qu'aucun des soldes contributeurs ne se donne pour objet de fermer. `gh issue view 1388` → **OPEN**, « ÉPIQUE — Chantier "Un texte, trois fenêtres" ». Chaque reste inventorié est individuellement bien motivé et bien mesuré (je les ai lus : famille « mur flottant » mesurée sur trois cartes, `fortified` sans lecteur de rendu, cardinal vivant en prose dans le JSDoc de `wallCellIndexOf`, `MAP_REGISTRY` à une entrée, légende d'image non extraite) — le grief ne porte pas sur leur qualité, il porte sur le fait que la grammaire des restes compte `-> #N` et ne compte pas `-> inventaire #N` : le plafond de UN se respecte à 1 pendant que 3 restes partent par la porte de service dans un SEUL solde (`1179.md`).

→ attendu : ou `-> inventaire #N` compte comme un reste routé dans la grammaire du solde (plafond de un, toutes formes confondues), ou l'épique d'inventaire porte une DoD de vidage datée et le solde qui y verse cite le commentaire qu'il y a posé — sinon l'inventaire est une corbeille à restes qui échappe au seul cliquet qui compte les restes. `fichier:ligne` : `.claude/soldes/1179.md` § Restes (3 entrées `-> inventaire #1680`), `.claude/soldes/1180.md` § Restes (2), `.claude/soldes/1771.md` § Restes (1 + 1 `-> inventaire #1388`). **Non bloquant** — aucune fermeture n'en dépend, et le reste `-> #N` de chacun des cinq soldes est le bon.

**Grief 6 — le trailer `Claude-Session` reste absent sur 5 des 10 commits de substance, et la fenêtre ne trace toujours qu'UNE session : la lentille « ≥ 2 sessions » est inapplicable pour le second palier d'affilée.** `git log 02b38d88b..0dc3cba27 --format='%h|%(trailers:key=Claude-Session,valueonly)'` : 6 commits portent `session_01ADFgEr5qfb1F8KAt6BVRmV`, 12 n'en portent aucun ; parmi les 10 de substance, **5 avec, 5 sans** (`2ccf7f4c0`, `8e625f818`, `6c1a1cfb9`, `48a3966116`, `765e1d111`). Les cinq nus sont tous `Co-Authored-By: Claude Fable 5.1` : un agent a produit, un canal a publié sans poser le trailer. Le palier précédent mesurait 8/10 nus : la tendance est BONNE (8 → 5) mais la cause est intacte, et l'effet sur ce jugement est identique — les quatre annonces rejouées viennent toutes du même canal, faute d'un second canal tracé. Grief 5 du palier précédent, routé #1750, **persistant sous forme atténuée**.

→ attendu : le trailer `Claude-Session` se pose par le même geste que `Co-Authored-By`, sinon ni l'un ni l'autre. `fichier:ligne` : `git log 02b38d88b..0dc3cba27 --format='%h %(trailers:key=Claude-Session,valueonly)'`. **Non bloquant.**

**Grief 7 — la dérive de branches n'a pas bougé d'un seul commit : 11 branches / 249 commits, à l'identique du palier précédent.** Sonde node collée au § Griefs de la revue précédente : `AVANCE>0 11 | TOTAL_NON_FUSIONNES 249`, plus vieille `worktree-agent-a8c251af80eb67c75 +13 2026-08-05` (42 jours). Le palier 2026-09-15 mesurait 9 / 210, le palier 2026-09-16 mesurait 11 / 249 et le routait sur #1750 ; ce palier mesure **exactement 11 / 249**. Le geste nommé par le solde #1768 (« le geste est `npm run ops:worktrees -- --purger`, pas le board ») n'a pas été joué. Élément à décharge, MESURÉ et dit : les trois branches de CETTE fenêtre (`chantier/1179`, `chantier/1180`, `chantier/1738`) sont toutes à **+0** — le régime #1776 ne fabrique PAS de dérive nouvelle, le stock est historique et figé.

→ attendu : le stock historique se purge en un geste daté, ou #1750 porte une échéance ; un chiffre qui ne bouge pas d'un palier à l'autre n'est plus un indicateur, c'est un meuble. `fichier:ligne` : sonde ci-dessus, `origin/main..<branche>` pour les 11. **Non bloquant.**

**Grief 8 — la garde réclamée par #1777 (« une revue orpheline se RECALE, jamais ne se supprime ») n'existe toujours pas, alors que le module qui la porterait a été relu dans cette fenêtre.** `gh issue view 1777` → **OPEN**. `scripts/guards/lib/revuePalier.mjs` à `0dc3cba27` valide le NOM d'une revue AJOUTÉE (`revuesNeuves` lit `git diff --cached --diff-filter=A`, l.118), mesure le palier (`mesureDuPalier`, l.193) et sait déjà nommer le cas de l'orpheline en clair (l.209-218 : « une revue dont la tête de fenêtre est ORPHELINE (rebase) se ré-écrit sur sa fenêtre réelle ») — mais **rien ne regarde `--diff-filter=D`** : une revue archivée peut être supprimée par n'importe quel commit sans qu'aucune porte ne bronche. Le mécanisme manquant est à une ligne de celui qui existe. C'est le grief 1 du palier précédent, non résorbé, et ce palier constate que l'occasion de le résorber (un chantier qui touche justement `revuePalier.mjs`… qu'il n'a pas touché) est passée.

→ attendu : `revuesNeuves` a son pendant `revuesRetirees` (`--diff-filter=D`), et la porte au commit refuse le retrait d'une archive de revue sans un remplaçant portant la même fenêtre. `fichier:ligne` : `scripts/guards/lib/revuePalier.mjs:117-127` (`revuesNeuves`, `--diff-filter=A` seul). **Non bloquant**, mais c'est le SEUL grief du palier qui protège une archive de jugement — donc le seul dont l'absence se paie en preuves perdues.

## Non couvert par ce jugement

(a) **`npm test` n'est pas rejoué** : l'annonce « 1503 fichiers / 21 463 tests » de `eedd1892a` est prise pour vraie (coût : la suite complète). Trois gates l'ont été intégralement — `test:hooks` 979/979, `test:docs` 83/83, `test:ops` 243/243 — et deux d'entre elles ont réfuté le message. (b) **L'annonce « 24 200 lectures » n'est pas rejouée** : elle exige une sonde `fs` enveloppante sur la suite entière ; le grief 2 la met en doute PAR AILLEURS (trois sites de lecture de `scripts/` non déclarés), sans la mesurer. (c) **Aucun contrôle visuel** : les onze captures citées par les soldes `1179`/`1180`/`1771` sont vérifiées NOMMÉES, non OUVERTES ; les claims « murs lisses », « le puits est ouvert », « l'étage a disparu en bloc » reposent sur les recettes CDP du 2026-09-16 et ne sont pas re-jugés à l'écran. (d) **`typecheck`, `lint`, `build`, `docs:check`, `docs:empreinte` et les mutations rouge→vert** annoncées ne sont pas rejoués. (e) **Le contenu GitHub des tickets** n'est recroisé que sur `state`/`title`/`closedAt`/`actor` ; les verbatims d'arbitrage cités aux messages (« Oui, supprimer (Recommandé) ») ne sont pas relus au ticket. (f) **`corpusParGate` n'est pas exécuté** : le grief 2 mesure les sites de lecture par grep statique sur `src/**`, pas par la fermeture d'imports de la garde. (g) **Les 3 hypothèses de l'architecture à rebours** sont jugées sur le code et l'histoire de la fenêtre, pas sur un rejeu du régime (aucun push n'a été émis depuis cet arbre).

## Verdict

verdict: PARTIEL

Le socle de fermeture ne cède sur aucun point, et c'est le palier le mieux OUTILLÉ des quatre : **cinq fermetures, cinq soldes DANS le commit qui ferme, zéro fermeture hors commit, au plus UN reste `-> #N` par solde, cinq cibles de routage OPEN et pertinentes au titre (#1780, #1779, #1778, #1179, #1738), cinq réfutations à verdict nommé dont trois qui déclarent une clause RÉFUTÉE ou FRAGILE au lieu de l'enjoliver, les cinq fermetures POSÉES par `github-actions[bot]` après un `build` vert (timelines collées), sept têtes de train vertes sur `main` et un run vert sur la branche AVANT le fast-forward, `refus: []` sur 18 commits avec les quatre `CLIQUET:` comptés à la pièce, zéro écart au stock d'audit, `JUGE:` sur 10 commits de substance sur 10, et le régime #1738 EXACT à l'unité** — 16 gates sautables, 8 qui jouent toujours, **0 écart `ci.yml` ↔ `ECRIT_LU`** dans les deux sens, `migrations` sans `needs` (le seul `needs: build` du fichier appartient à `fermetures`, l.149), 20 conditions toutes en polarité fail-closed `!= 'false'`, classement joué AVANT `npm ci`. Trois attaques du brief et de mon propre chef sont RÉFUTÉES par mesure et dites comme telles : la fermeture de #1713 par suppression TIENT (0 lecteur, 0 exemption orpheline, garde verte SANS son exemption, arbitrage utilisateur verbatim daté) ; le régime #1776 est au CODE et non au message (`bypass` n'apparaît qu'en commentaire dans `ruleset-main.mjs` et `pre-push.mjs`, le corps du ruleset n'a aucune clé `bypass_actors`) ; et classer `.claude/` en documentaire n'ouvre AUCUN trou (`git grep` des lectures `fs` de chemins documentaires depuis `src/**` → exit 1, zéro hit ; les deux gardes qui lisaient vraiment `.claude/` ont migré vers des gates qui jouent TOUJOURS). Du côté des griefs de la revue précédente, trois sont RÉSORBÉS et mesurés (grief 2, cardinal vivant 40/89, corrigé par `765e1d111` ; grief 4, correctif de gate après la fermeture, zéro occurrence dans cette fenêtre ; grief 6, `Export des issues`, supprimé avec son dossier), un est ATTÉNUÉ (grief 5, trailers 8/10 → 5/10 absents), et trois PERSISTENT sans geste (grief 1 → #1777 sans garde, grief 10 du 2026-09-09 → #1779 correctement ouvert avant la fermeture, dérive 11/249 inchangée au commit près). Huit griefs instruits, aucun bloquant, chacun avec sa sonde : (1) `eedd1892a` annonce « `test:hooks` 951 » et « `test:docs` 76 » là où la mesure rend 979/979 et 83/83 et où sa PROPRE ligne `JUGE:` dit 977 et 83 — 4e récidive consécutive de la classe « chiffre non pris sur les objets », 2e fois d'affilée avec l'écart INTERNE au message ; (2) la garde neuve de la classe « `lit` sous-déclaré » ne mesure qu'un axe, et l'axe non mesuré est déjà faux (`ECRIT_LU['test'].lit` omet `scripts/`, lu par trois fichiers vitest — latent aujourd'hui, `conflitsEntreLanes()` → `[]`) ; (3) l'exemption posée dans `registry-id-branch-guard.test.ts` est au FICHIER avec un CARDINAL quand la garde voisine exempte au SITE sans compte ; (4) une des trois lignes `CLIQUET:` nomme un porteur de stock qui n'en est pas un et double-déclare ; (5) le plafond « un reste routé » est tenu à la lettre pendant que SIX restes partent aux épiques d'inventaire dans une seule fenêtre, contre 4 lignes pour tout le reste de l'histoire ; (6) 5 des 10 commits de substance restent sans trailer de session, une seule session tracée ; (7) la dérive est figée à 11 branches / 249 commits, à l'identique — mais aucune des trois branches de CETTE fenêtre n'y contribue ; (8) la garde réclamée par #1777 n'existe toujours pas, alors que `revuePalier.mjs` ne regarde que `--diff-filter=A` et qu'une archive de revue reste supprimable sans porte.
