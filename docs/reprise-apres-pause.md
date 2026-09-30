# Reprise après pause

> ⚠️ Fichier GÉNÉRÉ par `node scripts/docs/build-reprise.mjs` (`npm run docs:reprise`) — NE PAS ÉDITER À LA MAIN.

**Périmètre mesuré / angles morts** — la part FACTUELLE est lue aux fichiers réels : scripts npm et
leur contenu (`package.json`), clés `git config` posées par `postinstall`, hooks Git présents sous
`scripts/git-hooks/`, hooks de session déclarés dans `.claude/settings.json`, workflows de
`.github/workflows/` (nom, déclencheurs, portes `npm` exécutées — lues aux corps `run:`, forme
inline ET blocs `run: |`, `--prefix` et `audit`/`ci` compris ; une forme d'invocation npm inconnue
y fait ÉCHOUER le script plutôt que sous-compter), motifs de `.gitignore`, seuil de
partage de la suite calculé sur `repartitionWorkers` (`scripts/test/partition.mjs`). Un renommage
casse ce script au lieu de laisser le `.md` mentir. **Angles morts** : ce runbook ne mesure PAS
l'état de la machine (auth `gh`, PDFs présents, compte Cloudflare) — il dit où ça vit, pas si c'est
là ; une invocation `npm` posée AILLEURS que dans un corps `run:` (action composite `uses:`, script
appelé par une étape) reste hors mesure ; les motivations (« pourquoi ce fichier n'est pas versionné »), la cadence d'archivage et les
conseils de vérification sont de l'ÉDITORIAL fixé dans le script, non re-dérivé à chaque run ; les
secrets d'Actions ne sont pas lisibles depuis le dépôt (leur nom seul est cité).

Référence vivante : que faire pour repartir de zéro (nouvelle machine, clone frais) après une
longue pause. Chaque chemin/symbole cité existe dans le repo — vérifié via `npm run docs:check`.

## 1. Redémarrage code (clone nu → jeu qui tourne)

```bash
git clone <url> && cd Game
npm install     # pose 9 réglages git (script "postinstall" de package.json)
npm test        # suite du moteur — deux processus Vitest (node + jsdom) si ≥ 7 cœurs, sinon un seul
npm run dev     # http://localhost:5173 (un CLONE garde le port historique)
```

**Chantier et publication.** `npm run ops:chantier -- <N>` (`node scripts/ops/chantier.mjs`) ouvre le
chantier du ticket `<N>` depuis n'importe quel worktree du dépôt (le chantier se pose à côté de
l'arbre principal) : il pose le worktree lié `.wt-<N>` sur `origin/main`, crée la branche
`chantier/<N>`, y joue `npm ci` et imprime le port dev dérivé. `npm run ops:publier -- --detache`
(`node scripts/ops/publier.mjs`) joue ensuite le train de publication ENTIER depuis ce worktree, détaché
du harnais, et imprime son `pid` et son `log`. Le train rebase sur `origin/main` — sans rebase quand
`origin/main` est déjà ancêtre de la tête, refus quand la branche porte des fusions hors tronc :
fusionner `origin/main` dans la branche, puis `--reprendre` (#1998) —, régénère les docs
dérivées, POUSSE la branche de chantier, attend le run CI de cette branche (borné par
`--ci-timeout-min`) et, sur vert, fait entrer `main` en FAST-FORWARD ; un run neuf rotationne le log
précédent en `<branche>.<AAAAMMJJ-HHMMSS>.log` (péremption 7 jours) — ce n'est pas une archive, le
`npm ci` d'`ops:chantier` efface `node_modules/.cache/`.

**Suivi de vague.** Toute reprise (compaction, lendemain, pause) commence par RELIRE
`.git/suivi/<N>.md`, le suivi de l'épique `<N>` : seule source du plan et du prochain geste, il vit
dans le répertoire git COMMUN, hors versionnement — un clone frais ne l'a pas.
`npm run ops:suivi -- <N>` (`node scripts/ops/suivi.mjs`) en rafraîchit la zone mesurée (branche,
avance, état d'issue de chaque ticket prévu) et l'imprime ; `-- <N> --creer` pose le suivi d'une
vague neuve, et sans `<N>` il liste les suivis présents.

Le port n'est historique QUE pour un arbre principal ou un clone : un **worktree lié** en dérive un
autre (5174-5272, `scripts/port-dev.mjs`) pour que deux arbres servis en même temps ne se recouvrent
jamais. `npm run dev` imprime celui qu'il sert.

`npm install` déclenche le script `postinstall`, qui pose : `core.hooksPath`, `merge.docs-generes.driver`, `merge.docs-generes.name`, `merge.docs-catalogue.driver`, `merge.docs-catalogue.name`, `merge.docs-fiche-raw.driver`, `merge.docs-fiche-raw.name`, `merge.stocks.driver`, `merge.stocks.name`.

**Sans ce postinstall, 3 familles de mécanismes sont MORTES.**

1. `core.hooksPath` → `scripts/git-hooks` : les hooks `commit-msg`, `post-merge`, `post-rewrite`, `pre-commit`, `pre-push` ne tournent plus. Le
   `pre-commit` porte les gardes anti-poison/anti-dérive de chaque commit ; `post-merge` et
   `post-rewrite` régénèrent les docs dérivés après une fusion ou un rebase. Le PALIER de revue
   adversariale se mesure sur l'histoire au moment du commit (`scripts/guards/lib/revuePalier.mjs`),
   et la fermeture des issues suit la PUBLICATION : job `fermetures` de `.github/workflows/ci.yml`
   après une course verte de tous les jobs vérifiants sur `main`, qui joue
   `node scripts/ops/fermer-depuis-main.mjs <before>..<sha>`.
2. Les pilotes de fusion des docs dérivés (`docs-generes`, `docs-catalogue`, `docs-fiche-raw`), déclarés par
   `.gitattributes` et servis par `scripts/git-hooks/merge-docs.mjs` : sans eux, chaque rebase rouvre un conflit sur
   des fichiers que `npm run docs:build` régénère seul.
3. Le pilote de fusion des stocks de sites (`stocks`), déclaré par
   `.gitattributes` et servi par `scripts/git-hooks/merge-stocks.mjs` : fusion par groupe de site ; sans lui, deux soldes
   de groupes disjoints d'un même stock rouvrent un conflit. Un stock se régénère par la commande
   `npx tsx scripts/guards/lib/regenStock.mts <module qui mesure>`, jamais par `docs:build`.

Le partage de la suite (`node scripts/test/run.mjs`) est décidé par `repartitionWorkers` : en dessous de
7 cœurs, un seul processus Vitest ; au-delà, un processus `node` et un processus `jsdom`. Les
cœurs servis sont bornés par la mémoire DISPONIBLE au lancement (`capacite`) : autant de workers que
la mémoire en porte, à l'empreinte mesurée d'un worker sous sa borne de tas, une réserve déduite par
processus Vitest. Les variables
d'environnement `WFRP_TEST_COEURS` et `WFRP_TEST_MEMOIRE_MO` forcent ces deux mesures (seule façon
de jouer l'autre chemin sur une machine quelconque).

`src/data/*.json` (124 fichiers) est la **SOURCE app-owned** : rien à régénérer après le clone.

Le canari (`.github/workflows/canari.yml`, schedule + workflow_dispatch, cron
`0 6 * * 1`) rejoue exactement ce chemin en CI, sur un runner propre, en
18 portes :

- `npm ci`
- `npm run docs:check:tout`
- `npm run agents:check`
- `npm run test:agents`
- `npm run test:hooks`
- `npm run test:ops`
- `npm run test:docs`
- `npm run test:recette`
- `npm run agents:sync`
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`
- `npm run test:raw`
- `npm run raw:check-refs`
- `npm run raw:check-code-refs`
- `npm --prefix server ci`
- `npm run server:typecheck`

Dont 2 portes sur le sous-projet `server/` (relay coop) :
`npm --prefix server ci`, `npm run server:typecheck` — son `node_modules` et son typecheck sont indépendants de ceux de la
racine, un clone frais doit les poser AUSSI.

Son step de résumé poste le rapport en commentaire sur l'issue `canari` la plus ANCIENNE encore
ouverte — il n'en crée une que s'il n'y en a aucune, et la FERME quand toutes les mesures sont vertes.
C'est le signal qu'un geste manuel a dévié de ce que `npm install` pose seul.

## 2. Ce que le clone CONTIENT

- `Source/` — texte des livres en `.md`, **citable** (réfs `LDB <chap> l.<ligne>`).
- `src/data/` — données app-owned (124 fichiers JSON commités, éditables au Compendium).
- Les gardes de données : `scripts/guards/validate-data.mts` + 180 modules
  sous `scripts/guards/lib/` (dont `scripts/guards/lib/commentPoison.mjs`,
  `scripts/guards/lib/emojiAffordance.mjs`, `scripts/guards/lib/hardcode.mjs`,
  `scripts/guards/lib/labelLogic.mjs`).
- Les gardes de SESSION : 3 scripts déclarés dans `.claude/settings.json`
  (versionné), sur 16 fichiers `.mjs` hors test sous `scripts/hooks/` — détail au § 5.
- Les schémas de données : `src/data/schemas/` (`src/data/schemas/types.ts`,
  `src/data/schemas/validate.ts`, `src/data/schemas/_registry.generated.ts`,
  `src/data/schemas/_ids.generated.ts`, `src/data/schemas/grammaire/` — le vocabulaire partagé —
  `src/data/schemas/defs/` : 133 fichiers, un par catalogue, et
  `src/data/schemas/defs-scenes/` : 17 fichiers pour les documents de scène).
- `scripts/art-ref/` — le PIPELINE d'extraction d'images (`extract.py`, `ldb_extract.py`, `ldb_map.py`, `probe.py`) : le code est
  tracké, ses SORTIES (images) ne le sont pas (§ 3).

## 3. Ce que le clone NE contient PAS — et où ça vit

| Non-versionné | Pourquoi (`.gitignore`) | Régénération / accès |
|---|---|---|
| PDFs de `Source/*.pdf` (`*.pdf`) | droits Cubicle 7, taille (limite GitHub 100 Mo/fichier) | conservés LOCALEMENT ; ré-extraction via `bash scripts/raw/reextract-all.sh <id>…` (Marker, staging `Source/_marker/split/`, **ne promeut pas** — revue manuelle avant d'écraser `Source/`) |
| Staging Marker (`Source/_marker/`) | intermédiaire de pipeline ; seuls les chapitres curés `Source/<Livre>/NN - *.md` sont committés | régénéré par le pipeline `scripts/raw/marker-*` |
| Images extraites des PDF (`/art-ref/`) | droits Cubicle 7, ce sont des sorties ; le pipeline lui-même reste tracké sous `scripts/art-ref/` | régénérables via `scripts/art-ref/extract.py`, `scripts/art-ref/ldb_extract.py`, `scripts/art-ref/ldb_map.py`, `scripts/art-ref/probe.py` + les PDFs locaux |
| Sorties de QC (`public/qc/*`) | planches de revue régénérables — pas du source | régénérables par les scripts `scripts/qc/` ; deux exceptions restent VERSIONNÉES : `!public/qc/baseline-affine/` (baseline affine, #1176 C3) et `!public/qc/soldes/` (les captures que cite le champ `capture:` d'un solde — la porte `verifierCapture` de `scripts/hooks/solde-ticket-guard.mjs` refuse une capture ignorée par git) |
| Réglages Claude Code personnels (`.claude/*`) | environnement local | exceptions VERSIONNÉES : `.claude/settings.json`, `.claude/credo.md`, `.claude/skills/`, `.claude/agents/`, `.claude/workflows/`, `.claude/memory/`, `.claude/soldes/` |

Ne sont pas non plus dans le clone, parce que ce ne sont pas des fichiers :

- **Compte Cloudflare du relay coop** — URL de prod dans `src/net/relay.ts` (`RELAY_URL_PROD`) ;
  redéployable via `npm run relay:deploy` (`npm --prefix server run deploy`).
- **Publication du jeu en prod** — workflow `.github/workflows/deploy.yml` (« Déploiement prod »,
  workflow_dispatch) ; il build le COMMIT de `main` sur un runner propre. Secret
  Actions `PROD_DEPLOY_KEY` (deploy key SSH) requis côté dépôt ; aucun clone local du dépôt prod
  nécessaire.
- **Auth `gh` (CLI GitHub)** — credentials locales, nécessaires aux commandes `gh` manuelles et aux
  gestes `ops:*` joués à la main (`node scripts/ops/fermer-depuis-main.mjs`, `node scripts/ops/fermetures-non-citees.mjs`).
  La fermeture des issues tourne en CI (job `fermetures`, `GITHUB_TOKEN`), comme l'export hebdomadaire.

## 4. Archivage des non-versionnés

Cadence recommandée : **à chaque nouveau livre importé** (PDF + art-ref associé), archiver vers
un stockage externe (l'utilisateur y consolide déjà les PDFs sources).

```powershell
Compress-Archive -Path "Source\*.pdf","art-ref" -DestinationPath "<stockage-externe>\game-sources-$(Get-Date -Format yyyy-MM-dd).zip"
```

Adapter `<stockage-externe>` (disque externe, cloud perso) — cette commande ne fait QUE lire
les non-versionnés locaux, elle ne touche pas au repo.

## 5. Portes de qualité — où elles vivent, comment vérifier qu'elles tournent

**Hooks Git locaux** (`commit-msg`, `post-merge`, `post-rewrite`, `pre-commit`, `pre-push`) : posés par `npm install` via `core.hooksPath`.
Vérifier : `git config core.hooksPath` doit répondre `scripts/git-hooks`. Si vide → hooks MORTS,
refaire `npm install`.

**Hooks de session Claude Code** (mise en conformité au démarrage, gardes anti-dérive à l'écriture), déclarés dans
`.claude/settings.json` :

| Événement | Déclencheur (matcher) | Script | Rôle |
|---|---|---|---|
| `SessionStart` | (tous) | `scripts/hooks/bootstrap-conteneur.mjs` | Conformité du conteneur distant (hooks git, gh) |
| `PreToolUse` | Write \| mcp__lean-ctx__ctx_patch \| Edit \| Bash \| PowerShell \| mcp__lean-ctx__ctx_shell | `scripts/hooks/repartiteur.mjs` | Gardes des appels d’outil (répartiteur) |
| `PreToolUse` | Bash \| PowerShell \| mcp__lean-ctx__ctx_shell | `scripts/hooks/solde-ticket-hook.mjs` | Fermeture de ticket au commit = solde écrit obligatoire |
| `PostToolUse` | Write \| Edit | `scripts/hooks/repartiteur.mjs` | Gardes des appels d’outil (répartiteur) |

**CI GitHub Actions** :

| Fichier | Nom | Déclencheurs | État |
|---|---|---|---|
| `.github/workflows/canari.yml` | Canari | schedule, workflow_dispatch (cron `0 6 * * 1`) | **autosignale** — le step « Résumé du canari » (`if: ${{ !cancelled() }}`) poste son rapport dans l’issue survivante par `scripts/ops/signaler-rouge.mjs`, puis `exit 1` si une mesure est rouge |
| `.github/workflows/ci.yml` | CI | push, pull_request | **porte** — la porte au push lit ses courses pour le sha poussé — `jugerPush` de scripts/git-hooks/pre-push.mjs appelle `coursesCi` (scripts/guards/lib/coursesCi.mjs), dont le workflow par défaut EST PORTE — et le ruleset `main` en fait ses checks requis |
| `.github/workflows/deploy.yml` | Déploiement prod | workflow_dispatch | **manuel** — `on: workflow_dispatch:` seul : lancé et regardé par une main humaine (CLAUDE.md § Pile et commandes, « prod — sur demande explicite SEULEMENT ») |
| `.github/workflows/deps-report.yml` | Rapport de dépendances | schedule, workflow_dispatch (cron `0 6 1 * *`) | **autosignale** — le step « Se nommer en rougissant » (`if: ${{ !cancelled() }}`) nomme le run et son `job.status` par `scripts/ops/signaler-rouge.mjs` : un rouge AVANT `npm run deps:report` a son canal |

La colonne « État » vient du registre `scripts/gates/workflowsDuDepot.mjs`, et chaque état y est
MESURÉ sur le YAML (garde `scripts/gates/workflowsDuDepot.test.mjs`) :

- **porte** — le workflow EST la porte : la porte au push consulte ses courses (`jugerPush` de scripts/git-hooks/pre-push.mjs → `coursesCi`, dont le défaut est PORTE) et le ruleset `main` exige ses jobs
- **autosignale** — le workflow se nomme lui-même en rougissant : un step qui joue MÊME sur rouge (`if` portant `always()`, `!cancelled()` ou `failure()` non nié, jamais sous `success()`) EXÉCUTE `scripts/ops/signaler-rouge.mjs`, qui commente ou ouvre l'issue survivante
- **manuel** — le workflow est lancé à la main sur demande explicite et regardé par celui qui le lance : son bloc `on:` ne porte que `workflow_dispatch`

Vérifier qu'elles tournent : onglet Actions du dépôt, ou `gh run list --workflow=canari.yml`. LA
PORTE est `.github/workflows/ci.yml` (« CI », push, pull_request) : elle joue les
gates sur CHAQUE branche `chantier/**`, et c'est son verdict — jamais un artefact local — qui
autorise une tête à entrer dans `main`. Elle CLASSE d'abord le push
(`scripts/gates/classerPush.mjs`) : un push dont tous les fichiers changés tombent sous
`.claude/`, `.agents/`, `.codex/`, `AGENTS.md`, `CLAUDE.md` ne joue que les 10 gates qui LISENT un de
ces chemins (`docs:check:tout`, `agents:check`, `test:docs`, `docs:empreinte`, `test:raw`, `test:agents`, `test:hooks`, `test:ops`, `test:runner`, `deps:unused`) ; les 14 autres sont sautées.

`npm run ops:publier` joue le train : rebase, docs dérivés, push de la BRANCHE, attente du run CI de
cette branche, fast-forward de `main`, pilotage. Il refuse à la première étape rouge en la nommant,
et son journal sépare le temps machine LOCAL du temps d'ATTENTE de GitHub.

## 6. Gates et livraison

**Régime** (arbitrage utilisateur 2026-09-16 : « Oui, ruleset actif ») : une branche `chantier/**` se
pousse **LIBREMENT**, aussi souvent qu'on veut — c'est le push qui déclenche la CI, et la CI joue les
mêmes gates que sur `main`. `main` ne reçoit qu'un **fast-forward** d'une tête dont le run CI est
VERT, et c'est le SERVEUR qui le tient : le ruleset `main` (`node scripts/ops/ruleset-main.mjs`, mode
`active`) exige les checks requis, refuse le non-fast-forward et la suppression. Un push de
PLUSIEURS commits est jugé par sa **TÊTE** — c'est la seule unité que la CI joue.

Le hook `scripts/git-hooks/pre-push.mjs` est le MIROIR LISIBLE de ce ruleset, jamais la porte : il
nomme 4 refus, et celui qui exige un run vert ne vaut que pour la ref `main`.
Ajouter une gate, c'est ajouter UN step à `ci.yml` — rien d'autre ne la récite.

**Rejeu LOCAL `npm run gates`** (`node scripts/gates/toutes.mjs`), un confort de diagnostic, jamais une porte :
24 gates en 3 lanes parallèles de LECTEURS — aucune gate
n'écrit dans l'arbre, un dérivé s'y VÉRIFIE (`docs:check:tout`) :

| Lane | Gates |
|---|---|
| `docs` | `docs:check:tout`, `agents:check`, `test:docs`, `build`, `docs:empreinte`, `test:raw`, `raw:check-refs`, `raw:check-code-refs`, `raw:check-ancres`, `raw:check-folio-continuity`, `raw:check-source-tables`, `raw:check-source-format`, `raw:check-source-puces`, `raw:check-renvois` |
| `types` | `test:agents`, `test:hooks`, `test:ops`, `test:runner`, `deps:unused`, `test:recette`, `typecheck`, `lint`, `server:typecheck` |
| `suite` | `test` |

Une lane est un job de `ci.yml` (`lanesDeCi`) ; `ECRIT_LU` (`scripts/gates/toutes.mjs`) dit ce
que CHAQUE gate écrit et lit (24 gates mesurées, dont
4 écrivain(s) — écriture de chaque run ou écriture POSSIBLE à porte nommée) ; c'est elle
qui rend le classement vérifiable plutôt que déclaratif. La suite est BORNÉE par `WFRP_TEST_COEURS`
pendant que les autres lanes tournent. Options : `--gates`, `--liste`, `--serie`. Une gate de `ci.yml`
sans entrée ÉCRIT/LU, ou jouée par deux jobs, fait REFUSER le run, avec son nom.

**`package-lock.json`** : le régénérer TOUJOURS avec npm@10.9.3, recette exacte de
`scripts/guards/lib/npmLockHoisted.mjs` — npx --yes npm@10.9.3 install --package-lock-only, puis valider avec npx npm@10.9.3 ci --dry-run. npm 11 ampute les entrées hoistées
`@emnapi/*` que `npm ci` exige en CI ; la garde (pre-commit +
`src/npm-lock-hoisted-guard.test.ts`) refuse un lock amputé.
<!-- sources-empreinte: 64be000d9d055dae070a2e223e454bbc7b774db6 (28 fichiers, 8 dossiers) corps: f04e1bbabc55a8d2af0d0018c8a5882d7187ebec -->
