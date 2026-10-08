// CLIQUET : la table ÉCRIT/LU de `npm run gates` confrontée à la SOURCE (#1679 L2 T1d).
//   node --test scripts/gates/ecrivainsAtteints.test.mjs   (chaîné dans `npm run test:hooks`)
//
// `ECRIT_LU` (scripts/gates/toutes.mjs) est ce qui autorise deux gates à tourner EN MÊME TEMPS. Elle
// est MESURÉE, donc elle se démode : une gate qui se met à atteindre un module capable d'écrire est
// une gate dont il faut RE-mesurer `ecrit`. Ce cliquet fige la liste, par gate, des scripts atteints
// qui portent un appel d'écriture — un ajout ARRÊTE la CI en nommant la gate et le module.
//
// Le cas fondateur reste VISIBLE : `new-src-file-guard.test.mjs` porte un appel d'écriture, sur un
// registre INJECTÉ (`WFRP_REGISTRE_ECRANS`) dont la copie vit sous os.tmpdir(). La sonde le VOIT —
// elle mesure l'appel, pas sa cible — et c'est pourquoi elle sert : un test qui écrit est un test
// dont il faut savoir OÙ il écrit.
//
// GRAIN : le SCRIPT, pas la ligne — la limite est écrite dans `ecrivainsAtteints.mjs`. Baisser une
// entrée est libre ; en ajouter une exige de dire ce que la gate écrit.
import test from 'node:test'
import assert from 'node:assert/strict'
import { corpusParGate, ecrivainsParGate, transitif } from './ecrivainsAtteints.mjs'
import { mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ECRIT_LU } from './toutes.mjs'

const RACINE = fileURLToPath(new URL('../..', import.meta.url))

/** Scripts ÉCRIVAINS atteints par chaque gate — mesuré le 2026-09-04, stock à faire DÉCROÎTRE. */
const ATTENDU = {
  'agents:check': ['scripts/guards/lib/protectionWorktree.mjs', 'scripts/agents/compat-cli.mjs'],
  'test:agents': [
    'scripts/guards/lib/protectionWorktree.mjs',
    'scripts/agents/compat-cli.mjs',
    // +1 le 2026-10-08 (#2497) : `node-tests.mjs` écrit le rapport de durées de `dureesNodeTest.mjs` sous un
    // `mkdtempSync` d'os.tmpdir(), retiré par `rmSync` en finally ; l'arbre n'est jamais écrit.
    'scripts/test/node-tests.mjs',
  ],
  'test:hooks': ['scripts/guards/lib/protectionWorktree.mjs',
    'scripts/guards/lib/ecrituresFichiers.test.mjs',
    'scripts/guards/lib/ecrituresShell.test.mjs',
    'scripts/guards/lib/processusWorktrees.test.mjs',
    'scripts/guards/lib/protectionWorktree.test.mjs',
    'scripts/guards/lib/racinesBalayees.test.mjs',
    'scripts/hooks/superpowers-ecriture-guard.test.mjs',
    // +1 le 2026-10-08 (#2497) : `node-tests.mjs` écrit le rapport de durées de `dureesNodeTest.mjs` sous un
    // `mkdtempSync` d'os.tmpdir(), retiré par `rmSync` en finally ; l'arbre n'est jamais écrit.
    'scripts/test/node-tests.mjs',
    'scripts/docs/lib/fraicheur-docs.mjs',
    'scripts/guards/budget-contexte.test.mjs',
    'scripts/docs/lib/enregistreur-lectures.mjs',
    'scripts/guards/contrat-typescript.test.mjs',
    'scripts/guards/lib/lint-parite.test.mjs',
    'scripts/guards/lib/lint.testkit.mjs',
    'scripts/guards/lib/lintStage.mjs',
    'scripts/guards/lib/tsProgram.test.mjs',
    'scripts/docs/build-all.mjs',
    'scripts/docs/lib/ecriture-derives.mjs',
    // +2 le 2026-09-16 (#1738) : la garde du classement de push fabrique des dépôts JETABLES
    // (`mkdtempSync` + `git init` + `writeFileSync` sous os.tmpdir(), `rmSync` en finally) pour
    // éprouver `merge-base` et le CLI ; la garde des liens de mémoire
    // forge ses fiches sous un `mkdtempSync` de os.tmpdir() — l'arbre du dépôt n'est jamais écrit.
    'scripts/gates/classerPush.test.mjs',
    // #1964 — +1 le 2026-10-01 : fixtures sous os.tmpdir(), supprimées en finally.
    'scripts/gates/ecrivainsAtteints.test.mjs',
    'scripts/guards/lib/memoryLinks.test.mjs',
    // +1 le 2026-10-01 (#2203) : `bootstrap-conteneur.mjs` lance `docs:build` détaché et ouvre son
    // journal et son verrou sous `node_modules/.cache` ; son banc INJECTE ce geste (`GESTES_DU_CONTENEUR`)
    // — l'arbre n'est jamais écrit.
    'scripts/hooks/bootstrap-conteneur.mjs',
    // +1 le 2026-10-01 (#2203) : le banc du VERROU de `docsBuildDetache` forge une racine JETABLE
    // (`mkdtempSync` + `writeFileSync` d'un faux build sous `os.tmpdir()`, `rmSync` en finally) — un
    // build détaché se lance sur un vrai fichier ; l'arbre n'est jamais écrit.
    'scripts/hooks/bootstrap-conteneur.test.mjs',
    // +1 le 2026-10-07 (#2436) : le banc du verrou des gates forge ses configurations Vitest et ses
    // fichiers de test sous un `mkdtempSync` d'os.tmpdir(), retirés par `rmSync` en finally ; l'arbre
    // n'est jamais écrit.
    'scripts/hooks/codeur-gates-guard.test.mjs',
    // +1 le 2026-10-07 (#2187) : le banc de la barrière des hooks d'outil forge ses arbres (`.git` dossier
    // ou fichier `gitdir:`) et son verrou d'outillage sous un `mkdtempSync` de os.tmpdir() (`rmSync` en
    // finally) — un `gitdir:` et un verrou tenu ne se fabriquent pas autrement ; l'arbre n'est jamais écrit.
    'scripts/hooks/barriere-outil.test.mjs',
    // +1 le 2026-09-20 (#1825) : le banc de l'ENVELOPPE de jeu d'un workflow écrit ses
    // scripts JOUETS sous un `mkdtempSync` de os.tmpdir() (`rmSync` en finally) — l'enveloppe
    // charge un FICHIER, un script jouet ne se fabrique pas autrement ; l'arbre n'est jamais écrit.
    'scripts/guards/lib/jouer-workflow.test.mjs',
    // +1 le 2026-09-14 (#1759) : la garde de couverture des tests `scripts/**` éprouve la parité
    // « joué = suivi par git » sur un dépôt JETABLE (`mkdtempSync` + `git init` + `writeFileSync`,
    // `rmSync` en finally, sous `os.tmpdir()`) — un fichier NON suivi ne se fabrique pas autrement,
    // et l'arbre du dépôt n'est jamais écrit.
    'scripts/gates/testsParGate.test.mjs',
    'scripts/gates/toutes.mjs',
    'scripts/gates/toutes.test.mjs',
    // +1 le 2026-09-16 (#1779) : la garde du registre des workflows joue ses mutations (workflow neuf
    // sans entrée, step signaleur retiré, `on: push` ajouté) sur une COPIE jetable de
    // `.github/workflows/` (`mkdtempSync` + `cpSync` sous os.tmpdir(), `rmSync` en finally) — muter le
    // YAML ne se fabrique pas autrement, et l'arbre du dépôt n'est jamais écrit.
    'scripts/gates/workflowsDuDepot.test.mjs',
    'scripts/git-hooks/arbre-imbrique.test.mjs',
    // +1 le 2026-09-14 (#1728 train B) : la porte au MESSAGE se mesure sur un dépôt JETABLE et un
    // dossier de hooks jetable (`mkdtempSync` + `writeFileSync` sous os.tmpdir()) — un `git commit`
    // réel ne se joue pas autrement, et l'arbre du dépôt n'est jamais écrit.
    'scripts/git-hooks/commit-msg.test.mjs',
    // +1 le 2026-09-27 (#1806) : le banc du lot de `docs-rebuild` pose une cale `git` en panne
    // (`mkdtempSync` + `writeFileSync` sous os.tmpdir(), `rmSync` en finally) — la lecture du lot doit
    // tomber pour prouver le FAIL-CLOSED ; l'arbre versionné n'est jamais écrit.
    'scripts/git-hooks/docs-rebuild.test.mjs',
    // +1 le 2026-10-01 (#2194) : le journal des hooks git écrit sous `node_modules/.cache/hooks-git` du
    // cwd du hook ; les bancs qui JOUENT un hook (pre-commit, commit-msg, node-requis) le lancent avec
    // `cwd` = un dépôt ou un dossier JETABLE sous os.tmpdir(), et son banc INJECTE l'écriture. Mesure
    // du 2026-10-01 : `git status --short --ignored` identique avant et après, sur ce worktree et sur
    // l'arbre principal, et aucun `node_modules/.cache/hooks-git` créé.
    'scripts/git-hooks/journal.mjs',
    'scripts/git-hooks/merge-docs.mjs',
    // +4 le 2026-09-27 (#1903) : le pilote de fusion des stocks de sites et son banc écrivent %A, des
    // copies et des fichiers temporaires sous `os.tmpdir()` supprimés en `finally` (`three-way.mjs`,
    // la fusion 3-voies qu'ils partagent avec `merge-docs.mjs`) ; le banc des formats pose ses
    // fixtures sous un `mkdtempSync` de `os.tmpdir()`, retirées par `rmSync`. L'arbre du dépôt n'est
    // jamais écrit.
    'scripts/git-hooks/merge-stocks.mjs',
    'scripts/git-hooks/merge-stocks.test.mjs',
    // +1 −2 le 2026-10-07 (#2071), net −1 : les bancs de la porte du commit quittent `scripts/hooks/`
    // avec elle ; ils forgent leurs dépôts JETABLES (`instanceDeDepot`, sous os.tmpdir(), `rmSync` en
    // finally) — l'index d'un commit ne se fabrique pas autrement, l'arbre versionné n'est jamais écrit.
    'scripts/git-hooks/porte-du-commit.test.mjs',
    // +1 le 2026-09-27 (#1806) : le banc du pre-commit forge un dépôt JETABLE (`instanceDeDepot`, sous
    // os.tmpdir(), `rmSync` en finally), y stage un nom à tabulation et y JOUE le hook, `cwd` = ce
    // dépôt — la lecture refusée de l'index ne se fabrique pas autrement. Mesure du 2026-09-27 :
    // `git status --short --ignored` identique avant et après, sur ce worktree et sur l'arbre principal.
    'scripts/git-hooks/pre-commit.test.mjs',
    'scripts/git-hooks/pre-push.test.mjs',
    'scripts/git-hooks/three-way.mjs',
    // +1 le 2026-10-07 (#2071) : le banc de `cheminDEcriture` pose ses fichiers sous un `mkdtempSync`
    // de os.tmpdir() (`rmSync` en finally) — un chemin RÉEL ne se résout pas autrement ; l'arbre
    // versionné n'est jamais écrit.
    'scripts/guards/lib/contratGarde.test.mjs',
    // Le gabarit et ses instances vivent sous `os.tmpdir()` (`mkdtempSync` + `cpSync`), l'arbre n'est
    // jamais écrit.
    'scripts/guards/lib/depotGabarit.mjs',
    'scripts/guards/lib/depotGabarit.test.mjs',
    'scripts/guards/lib/enteteArbre.test.mjs',
    // +1 le 2026-09-14 (#1728 train B) : la porte CRLF de l'index se mesure sur un dépôt JETABLE
    // (`mkdtempSync` + `writeFileSync` sous os.tmpdir(), `git init` local) — le patch CRLF appliqué à
    // l'index ne peut pas se fabriquer autrement, et l'arbre du dépôt n'est jamais écrit.
    'scripts/guards/lib/eolStage.test.mjs',
    // +1 le 2026-09-05 (#1679 L3 T2) : le test de l'hôte des lectures git écrit ses fixtures (dépôts
    // jetables) sous `os.tmpdir()` — l'arbre n'est jamais touché.
    'scripts/guards/lib/gitPorte.test.mjs',
    'scripts/guards/lib/importGraph.test.mjs',
    'scripts/guards/lib/lintStage.test.mjs',
    // +1 le 2026-09-05 (#1679 L3b) : la porte de rôle du lecteur à ordre total pose ses dossiers-fixtures
    // (`mkdtempSync` + `writeFileSync`) sous `os.tmpdir()` — l'arbre n'est jamais écrit.
    'scripts/guards/lib/lister.test.mjs',
    // +1 le 2026-10-05 (#1887 6a-2c) : le banc de la garde des migrations au verdict vivant forge un
    // dépôt JETABLE (`mkdtempSync` sous os.tmpdir(), `mkdirSync`/`writeFileSync` des migrations et du
    // module relais, `rmSync` en finally) — la clôture d'imports exige de vrais fichiers à résoudre ;
    // l'arbre du dépôt n'est jamais écrit.
    'scripts/guards/lib/migrationsVerdictVivant.test.mjs',
    // +1 le 2026-09-18 (#1813) : la garde des MODULES FEUILLES fabrique un arbre JETABLE
    // (`mkdtempSync` sous os.tmpdir(), `mkdirSync`/`writeFileSync` pour la feuille, son banc et les
    // sources du cas, `rmSync` en finally) — éprouver les graphies d'import qui atteignent une feuille
    // exige de VRAIS fichiers à résoudre, et l'arbre du dépôt n'est jamais écrit : mesuré le
    // 2026-09-18, `git status --porcelain` identique avant/après, et `/tmp` sans résidu.
    'scripts/guards/lib/modulesFeuilles.test.mjs',
    'scripts/guards/lib/plageStock.test.mjs',
    // +1 le 2026-10-08 (#2503) : le banc de la porte d'une ÈRE forge des dépôts JETABLES
    // (`instanceDeDepot` sous os.tmpdir(), `rmSync` en finally) dont il charge l'ère ; l'arbre du dépôt
    // n'est jamais écrit.
    'scripts/guards/lib/porteDEre.test.mjs',
    // +1 le 2026-10-07 (#2001) : le banc de `mesurerProseInline` pose son projet de fixture sous un
    // `mkdtempSync` d'os.tmpdir() (`mkdirSync`/`writeFileSync`, `rmSync` en finally) — la mesure balaie
    // des FICHIERS sous une racine ; l'arbre du dépôt n'est jamais écrit.
    'scripts/guards/lib/proseInline.test.mjs',
    // +2 le 2026-09-06 (#1679 L3b) : la purge des dossiers de CACHE (`node_modules/.cache`,
    // `node_modules/.cache/gates`) est une source unique — elle EFFACE, par construction ; son test
    // pose et efface ses fichiers sous `os.tmpdir()`. Ni l'une ni l'autre ne touche l'arbre versionné.
    'scripts/guards/lib/purgerPerimes.mjs',
    'scripts/guards/lib/purgerPerimes.test.mjs',
    // +1 le 2026-09-27 (#1903) : la commande de régénération des stocks de sites, exercée par son banc
    // (`stockDeSites.test.mjs`, morsure `--check`) sur des fixtures sous `os.tmpdir()`.
    'scripts/guards/lib/regenStock.mts',
    // +1 le 2026-09-07 (#1709) : la porte de rôle du corpus source pose ses fixtures
    // (`mkdtempSync` + `writeFileSync`, puis `rmSync`) sous `os.tmpdir()` — l'arbre versionné n'est
    // jamais écrit, et la lib mesurée (`sourceCorpus.mjs`) ne fait que LIRE.
    'scripts/guards/lib/sourceCorpus.test.mjs',
    // Le banc du rejeu de spawn écrit ses
    // fixtures : des scripts jetables sous `os.tmpdir()` (`mkdtempSync` + `writeFileSync`, `rmSync`
    // en sortie) qui sortent avec le code du loader ; l'arbre n'est jamais écrit.
    'scripts/guards/lib/spawnResilient.test.mjs',
    'scripts/guards/lib/stockDeSites.test.mjs',
    // +1 le 2026-10-08 (#2503) : le banc de l'outillage en panne copie la fermeture de
    // `stocksNominatifs.mjs` et un faux paquet `typescript` sous un `mkdtempSync` d'os.tmpdir() (`rmSync`
    // en finally) — une résolution de paquet ne se fausse pas autrement ; l'arbre n'est jamais écrit.
    'scripts/guards/lib/stocksNominatifs.test.mjs',
    // +4 −1 le 2026-09-26 (#1973), net +3 : les hooks d'écriture se taisent hors de tout dépôt et lisent
    // le disque au chemin RÉEL ; quatre bancs le mesurent sous `os.tmpdir()` (`rmSync` en finally,
    // l'arbre versionné n'est jamais écrit). Data-edit ne pose que des DOSSIERS (`instanceDeDepot`,
    // `mkdtempSync`) : le hook juge un chemin. Exception-add y écrit un fichier de garde EXISTANT
    // (`writeFileSync`), memoire-tombale une fiche (`mkdirSync` + `writeFileSync`) et une jonction
    // (`symlinkSync`), poison-postcheck le fichier scanné (`mkdirSync` + `writeFileSync`) : les trois
    // lisent le disque, natif et MSYS doivent y lire le même fichier.
    'scripts/hooks/data-edit-guard.test.mjs',
    'scripts/hooks/exception-add-guard.test.mjs',
    'scripts/hooks/inject-project-credo.test.mjs',
    // +3 le 2026-09-30 (#2132) : les bancs du suivi de vague forgent un dépôt JETABLE
    // (`instanceDeDepot`, sous os.tmpdir(), `rmSync` en finally) ; celui du hook de session y écrit
    // `.git/suivi` (le suivi, le journal `.journal`). `ops/suivi.mjs`, que le lien de session importe,
    // n'écrit que derrière sa porte `import.meta.main`. Mesuré le 2026-09-30 : `git status --porcelain --ignored`
    // identique avant et après, sur ce worktree et sur l'arbre principal.
    'scripts/hooks/inject-suivi.test.mjs',
    'scripts/hooks/memoire-tombale-guard.test.mjs',
    'scripts/hooks/new-src-file-guard.test.mjs',
    'scripts/hooks/poison-postcheck.test.mjs',
    // +2 −1 le 2026-09-28 (#2125), net +1 : le répartiteur AJOUTE au fichier la trace que rend une garde
    // (`{ trace: { fichier, ligne } }`, la dérogation `SKIP_NEW_SRC_GUARD` vers
    // `.claude/logs/new-src-guard-skips.log`) ; son banc pose des `package.json` jetables sous `os.tmpdir()` (`rmSync` en finally)
    // pour le `cwd` de `ctx_shell`. L'arbre versionné n'est jamais écrit.
    'scripts/hooks/repartiteur.test.mjs',
    'scripts/hooks/repartition.mjs',
    'scripts/hooks/segments-profonds.test.mjs',
    // +1 le 2026-10-07 (#2460) : le banc de la garde d'écriture du suivi forge un dépôt JETABLE
    // (`instanceDeDepot`, sous os.tmpdir(), `rmSync` en finally) ; la garde juge l'entrée, rien n'est écrit.
    'scripts/hooks/suivi-ecriture-guard.test.mjs',
    'scripts/hooks/suivi-lien-guard.test.mjs',
    'scripts/hooks/typecheck-fast-wrapper.test.mjs',
    // +2 le 2026-09-14 (#1699) : la migration des chemins de `Source/` en ASCII et son banc. La
    // migration ÉCRIT (git mv, réécritures) UNIQUEMENT sous `--apply`, que le banc ne lui donne que
    // sur des dépôts JETABLES (`instanceDeDepot`, sous `os.tmpdir()`) ; jouée sans argument — ce que
    // fait `migrations:replay` — elle est en `--dry` et n'écrit rien. L'arbre n'est jamais touché.
    'scripts/migrations/2026-09-14-1699-source-chemins-ascii.mjs',
    'scripts/migrations/lib/1699-source-chemins-ascii.test.mjs',
    // +2 le 2026-09-18 (#1812) : le mode CROISSANCE fait grandir les documents d'un EXPORT jetable
    // (`os.tmpdir()`, `replay-head.mjs:exporter`) avant de rejouer les migrations — l'arbre n'est
    // jamais écrit, et son banc travaille sur un dépôt `mkdtemp`.
    'scripts/migrations/lib/croissance.mjs',
    'scripts/migrations/lib/croissance.test.mjs',
    'scripts/migrations/lib/empreinteRejeu.test.mjs',
    'scripts/migrations/lib/idempotence-ordre-des-cles.test.mjs',
    // +1 le 2026-09-22 (#1873) : `joue.mjs` COPIE la migration jouée dans le dépôt jetable que lui donne
    // chaque banc de migration (`copyFileSync`, sous `os.tmpdir()`) ; l'arbre n'est jamais écrit.
    // Son banc
    // `joue.test.mjs` réécrit (`writeFileSync`) les fichiers du dépôt jetable de `depot()` pour faire
    // mordre `crees`/`rienTouche` ; ce dépôt vit sous `os.tmpdir()` (`efface` en `t.after`), l'arbre
    // n'est jamais écrit.
    'scripts/migrations/lib/joue.mjs',
    'scripts/migrations/lib/joue.test.mjs',
    'scripts/migrations/replay-head.mjs',
    'scripts/ops/suivi.mjs',
    // +1 le 2026-10-07 (#2460) : `suiviFichiers.mjs`, l'écriture atomique que `suivi.mjs` importe, n'écrit que
    // sous la porte `import.meta.main` de `suivi.mjs` et dans les dépôts jetables des bancs.
    'scripts/ops/suiviFichiers.mjs',
    'scripts/raw/build-implemente.mjs',
    // +1 le 2026-10-07 (#2400) : la garde des balayages non résolus (`scripts/guards/balayages-non-resolus.test.mjs`)
    // dérive par `balayagesNonResolus` de `perimetre.mjs`, qui sauve ses mémos sous `node_modules/.cache/perimetre/`,
    // hors de l'arbre ; l'arbre n'est jamais écrit.
    'scripts/test/perimetre.mjs',
    // +2 le 2026-10-07 (#2400) : `ecritureJsonAtomique.mjs`, l'écriture JSON atomique (temporaire puis renommage)
    // qu'atteint `perimetre.mjs` (mesures de la machine, par sa seule CLI), et son banc, qui n'écrit que sous un
    // `mkdtempSync` d'os.tmpdir() (`rmSync` par t.after) — l'arbre n'est jamais écrit.
    'scripts/guards/lib/ecritureJsonAtomique.mjs',
    'scripts/guards/lib/ecritureJsonAtomique.test.mjs',
    'scripts/test/verrou.mjs',
    // +2 le 2026-10-04 (#2278) : le banc de la garde `mods:check` forge ses mods sous `mkdtempSync` de
    // os.tmpdir() (`rmSync` en `t.after`), et la garde qu'il importe copie chaque mod sous un `mkdtempSync`
    // de os.tmpdir(), effacé en finally.
    // #2258
    'scripts/mods/murDeMod.test.mjs',
    'scripts/mods/verifier.mjs',
    'scripts/mods/verifier.test.mjs',
    // +1 le 2026-10-05 (#2328) : le banc de la porte de publication forge ses chantiers fusionnés sous
    // `instanceDeDepot` (os.tmpdir(), `rmSync` en finally) ; l'arbre du dépôt n'est jamais écrit.
    'scripts/guards/lib/livraison.test.mjs',
  ],
  // +1 le 2026-10-04 (#2278) : la garde copie chaque mod sous un `mkdtempSync` de os.tmpdir(), effacé en
  // finally ; l'arbre n'est jamais écrit.
  'mods:check': ['scripts/mods/verifier.mjs'],
  // #2328
  'livraison:plage': ['scripts/guards/lib/protectionWorktree.mjs', ],
  'test:ops': ['scripts/guards/lib/protectionWorktree.mjs',
    // +1 le 2026-10-08 (#2497) : `node-tests.mjs` écrit le rapport de durées de `dureesNodeTest.mjs` sous un
    // `mkdtempSync` d'os.tmpdir(), retiré par `rmSync` en finally ; l'arbre n'est jamais écrit.
    'scripts/test/node-tests.mjs',
    // #2461
    'scripts/ops/session-runtime.mjs',
    'scripts/ops/session.test.mjs',
    'scripts/docs/lib/fraicheur-docs.mjs',
    // +1 le 2026-09-07 (#1709) : `fermer-depuis-main.test.mjs` prend ses dépôts jetables à la fixture partagée, qui n'écrit que sous `os.tmpdir()`.
    // · `chantier.test.mjs` et `worktrees.test.mjs` posent de VRAIS worktrees et un origin nu, tous
    //   sous os.tmpdir() (fixture partagée + mkdtemp), jetés en finally — aucune écriture DANS
    //   l'arbre. `chantier.mjs`/`worktrees.mjs` écrivent, eux, dans l'arbre PRINCIPAL en usage réel
    //   (git worktree add/remove), jamais depuis la gate.
    // · `publier.mjs` est atteint par `publier.test.mjs`, qui joue ses fonctions PURES (options,
    //   journal en mémoire, verdicts, mise en forme) et ses étapes sur des `ctx` FACTICES, dans des
    //   racines jetables (mkdtemp sous os.tmpdir(), rmSync en finally — d'où ses imports d'écriture).
    //   Les écritures réelles de `publier.mjs` sont son journal `node_modules/.cache/publication/` et
    //   le commit des docs DÉRIVÉS — toutes deux derrière sa porte `import.meta.main` (scripts/ops/publier.mjs,
    //   dernière ligne), jamais depuis la gate.
    // · `build-all.mjs`, `ecriture-derives.mjs` et `purgerPerimes.mjs` sont atteints PAR
    //   `publier.mjs`, qui n'en importe que des CONSTANTES et des fonctions pures (`GENERATORS`,
    //   `SOURCES_LUES`) ; leurs écritures vivent derrière leurs propres portes `import.meta.main`, ou sous
    //   `node_modules/.cache`.
    'scripts/docs/build-all.mjs',
    'scripts/docs/lib/ecriture-derives.mjs',
    'scripts/gates/toutes.mjs',
    'scripts/guards/lib/depotGabarit.mjs',
    'scripts/guards/lib/purgerPerimes.mjs',
    // +1 le 2026-10-01 (#2194) : `etapesDuTrain.mjs` importe de `docs-rebuild.mjs` deux fonctions PURES
    // (`sourcesMesurees`, `touchesDocSources`) ; le journal des hooks git n'y est armé que par `main`,
    // derrière sa porte `import.meta.main` — jamais depuis la gate.
    'scripts/git-hooks/journal.mjs',
    'scripts/ops/chantier.test.mjs',
    // +1 le 2026-09-27 (#1806) : le banc du point fixe de la CLÔTURE des étapes porte `writeFileSync(`
    // dans le TEXTE d'un module fictif, lu par un `disque` injecté EN MÉMOIRE (`sources`, une `Map`) ;
    // aucun module fictif n'est importé ni exécuté, et rien n'est écrit, ni dans l'arbre ni ailleurs.
    'scripts/ops/etapesDuTrain.test.mjs',
    // +1 le 2026-09-18 (#1813) : le banc du vocabulaire de PLAGE FERMANTE prend ses dépôts jetables à
    // la fixture partagée (`instanceDeDepot`, sous os.tmpdir()) et y pose ses fichiers
    // (`mkdirSync`/`writeFileSync` pour `.claude/soldes/42.md`, `rmSync` en finally) : lire une plage
    // dans l'histoire et le solde qu'un commit emporte exige de VRAIS commits, et l'arbre du dépôt
    // n'est jamais écrit — mesuré le 2026-09-18, `git status --porcelain` identique avant/après.
    'scripts/ops/plageFermante.test.mjs',
    'scripts/ops/publier.mjs',
    'scripts/ops/publier.test.mjs',
    'scripts/ops/reprendre-file.mjs',
    'scripts/ops/reprendre-file.test.mjs',
    'scripts/ops/worktrees.test.mjs',
    // +2 le 2026-09-29 (#2132) : `suivi.mjs` écrit `.git/suivi/<N>.json` et `<N>.mesure.json` (temporaire
    // voisin puis `renameSync`), derrière sa porte `import.meta.main` ; son banc `suivi.test.mjs` écrit ses suivis
    // sous `mkdtempSync` d'os.tmpdir() (`rmSync` en finally) et forge son dépôt par `instanceDeDepot`.
    'scripts/ops/suivi.mjs',
    'scripts/ops/suivi.test.mjs',
    // +1 le 2026-10-07 (#2460) : `suiviFichiers.mjs` porte l'écriture atomique (`ecrireSuivi` : temporaire voisin
    // puis `renameSync`, `rmSync` du temporaire) que `suivi.mjs` et `suiviMesure.mjs` importent, sous la même
    // porte `import.meta.main` de `suivi.mjs` et sous le `mkdtempSync` d'os.tmpdir() de `suivi.test.mjs`.
    'scripts/ops/suiviFichiers.mjs',
    // +2 le 2026-10-07 (#2187) : `synchroniser.mjs` écrit l'arbre PRINCIPAL (fichiers W′, `.git/index`
    // par `renameSync`, `.git/index.lock`, `.git/synchro/`, `.git/synchro-conflits/`) derrière sa porte
    // `import.meta.main` ; son banc `synchroniser.test.mjs` le joue sur des dépôts `instanceDeDepot` sous
    // os.tmpdir() (et son processus enfant, écrit sous os.tmpdir()), jetés en `after` — l'arbre n'est
    // jamais écrit.
    'scripts/ops/synchroniser.mjs',
    'scripts/ops/synchroniser.test.mjs',
    // +1 le 2026-10-05 (#2279) : `suivi.mjs` écrit chaque fichier sous le verrou exclusif `.<nom>.verrou`
    // voisin, et `suiviMesure.mjs` mesure sous le verrou `.<N>.mesure.verrou` (#2460) (`ecrireSuivi`, `mesurerLeSuivi`, `prendreVerrou` de `scripts/test/verrou.mjs` : tenant écrit dans le temporaire
    // voisin `<chemin>.<pid>.<uuid>` puis `linkSync` exclusif (`prendreDepuis`), reprise sous `<chemin>.reprise`
    // (`reprendre`), `rmSync` des temporaires), tous dans le dossier du suivi : sous `.git/suivi` derrière la
    // porte `import.meta.main` de `suivi.mjs`, et sous le `mkdtempSync` d'os.tmpdir() de `suivi.test.mjs` ;
    // l'arbre n'est jamais écrit.
    'scripts/test/verrou.mjs',
    'scripts/ops/knip-exports-ratchet.mjs',
    // +2 le 2026-09-16 (#1776) : le ruleset `main` (`scripts/ops/ruleset-main.mjs`).
    // · `ruleset-main.mjs` n'écrit QUE le corps du ruleset dans un fichier d'`os.tmpdir()`, pour le
    //   passer à `gh api --input` (`executer` de ruleset-main.mjs) ; les tests appellent `executer` avec
    //   un `runner` et un `lireCi` injectés, et ce fichier naît et meurt sous `os.tmpdir()`.
    // · `ruleset-main.test.mjs` écrit ses fixtures `ci.yml` sous `os.tmpdir()` (`mkdtempSync`) ; sa
    //   seule lecture de l'arbre réel est `blocsDeJobs`/`jobsCi` (scripts/gates/gatesDeCi.mjs), qui
    //   ne font que LIRE `.github/workflows/ci.yml`.
    // Même mesure que la raison `test:ops` d'`ECRIT_LU` (scripts/gates/toutes.mjs, `ECRIT_LU['test:ops']`).
    'scripts/ops/ruleset-main.mjs',
    'scripts/ops/ruleset-main.test.mjs',
    // +1 le 2026-09-16 (#1779) : le banc du signaleur pose le CORPS du rapport (`--body-file` de `gh`)
    // sous os.tmpdir() (`mkdtempSync` + `writeFileSync`, `rmSync` en finally) ; `signaler-rouge.mjs`
    // ne fait que LIRE ce fichier, et son `gh` est INJECTÉ — l'arbre n'est jamais écrit.
    'scripts/ops/signaler-rouge.test.mjs',
    // +1 le 2026-09-28 (#1993) : le banc des workflows joués pose une copie PERMUTÉE de
    // `dossier-de-chapitre.js` sous os.tmpdir() (`mkdtempSync` + `writeFileSync`, `rmSync` en finally)
    // pour la rejouer par `jouerWorkflow`, et (#2290) y fait écrire la fiche rendue par le lanceur
    // (`ecrireFiche`, `dir` jetable) qui arme la table ; l'arbre n'est jamais écrit.
    'scripts/ops/workflows-joues.test.mjs',
    // +1 le 2026-10-05 (#2290) : le lanceur `workflow-args.mjs`, IMPORTÉ par le banc des workflows joués
    // pour projeter les args ; son écriture sous `docs/dossiers/` vit dans sa seule CLI `ecrire-fiche`,
    // que la gate ne lance pas — le banc lui passe un `dir` jetable d'os.tmpdir().
    'scripts/raw/workflow-args.mjs',
    // +2 le 2026-10-05 (#2280) : `vigie.mjs` garde les verdicts `verte` sous `<arbre principal>/.git/vigie/`
    // par `ecrireJsonAtomique` (`scripts/guards/lib/ecritureJsonAtomique.mjs`), dans le répertoire git COMMUN et non dans
    // l'arbre ; son banc `vigie.test.mjs` écrit lui-même (`mkdirSync` + `writeFileSync` d'un cache tronqué) et
    // fait écrire `vigie.mjs` dans les `.git` de dépôts jetables (`instanceDeDepot` et un clone sous
    // `mkdtempSync` d'os.tmpdir(), `rmSync` en finally) ; `ci.test.mjs` jette (`rmSync`) les dépôts jetables de
    // `shaPousse`, posés par `instanceDeDepot` et un clone sous `mkdtempSync`. L'arbre n'est jamais écrit — mesuré le 2026-10-05, `git status --porcelain` identique
    // avant/après les deux bancs.
    'scripts/ops/ci.test.mjs',
    'scripts/ops/vigie.test.mjs',
    // +1 le 2026-10-07 (#2400) : `ecritureJsonAtomique.mjs`, l'écriture JSON atomique (temporaire puis renommage)
    // qu'atteignent `publier.mjs` (journal du train) et `vigie.mjs` (cache des verdicts) ; ses écritures visent le répertoire git COMMUN en usage réel, et des dossiers `mkdtempSync` d'os.tmpdir()
    // dans les bancs — l'arbre n'est jamais écrit.
    'scripts/guards/lib/ecritureJsonAtomique.mjs',
  ],
  'test:runner': ['scripts/guards/lib/protectionWorktree.mjs',
    // +1 le 2026-10-08 (#2497) : le banc du lanceur des gates node forge un dépôt JETABLE (`mkdtempSync` +
    // `writeFileSync` sous os.tmpdir(), `rmSync` en finally) et y joue `node --test` ; l'arbre n'est jamais écrit.
    'scripts/test/node-tests.test.mjs',
    // +1 le 2026-10-08 (#2497) : `node-tests.mjs` écrit le rapport de durées de `dureesNodeTest.mjs` sous un
    // `mkdtempSync` d'os.tmpdir(), retiré par `rmSync` en finally ; l'arbre n'est jamais écrit.
    'scripts/test/node-tests.mjs',
    // +1 le 2026-10-07 (#2400) : `ecritureJsonAtomique.mjs`, l'écriture JSON atomique (temporaire puis renommage)
    // qu'atteint `perimetre.mjs` (mesures de la machine, par sa seule CLI) ; ses écritures visent le répertoire git COMMUN en usage réel, et des dossiers `mkdtempSync` d'os.tmpdir()
    // dans les bancs — l'arbre n'est jamais écrit.
    'scripts/guards/lib/ecritureJsonAtomique.mjs',
    // +2 le 2026-10-07 (#2400) : `perimetre.mjs` importe `selectionDesGenerateurs` et `ancetresDe` de
    // `scripts/git-hooks/docs-rebuild.mjs`, qui atteint `build-all.mjs` et `journal.mjs` ; leurs écritures vivent
    // derrière `reconstruireApresGit`, `genererCode` et les `main` sous `import.meta.main`, que le banc n'appelle
    // pas. Il atteint aussi `ecriture-derives.mjs`, déjà là le 2026-10-07 (#2404) par `scripts/gen-formats.test.mjs`, qui
    // importe le générateur dont seule la porte `import.meta.main` écrit (`ecrireOuVerifier`) ; le banc calcule
    // les formats en mémoire, recouvrement virtuel compris — l'arbre n'est jamais écrit.
    'scripts/docs/build-all.mjs',
    'scripts/docs/lib/enregistreur-lectures.mjs',
    'scripts/docs/lib/ecriture-derives.mjs',
    // +1 le 2026-10-07 (#2400, fusion de #2456) : `fraicheur-docs.mjs`, atteint par le même chemin (`perimetre.mjs` →
    // `docs-rebuild.mjs` → `build-all.mjs`) ; ses écritures (`ecrirePreuve` et `copierDocsFrais`, fraicheur-docs.mjs)
    // ne partent que d'`executer` (build-all.mjs, sous sa porte `import.meta.main`), du `main` de docs-rebuild.mjs et
    // de `creerChantier` (ops/chantier.mjs), qu'aucun banc de la gate n'appelle — l'arbre n'est jamais écrit.
    'scripts/docs/lib/fraicheur-docs.mjs',
    'scripts/git-hooks/journal.mjs',
    // +2 le 2026-10-04 (#2155) : le banc du module de banc git (`gitDeBanc.test.mjs`) prend ses dépôts
    // jetables à la primitive (`instanceDeDepot`, `rmSync` en finally) ; elle n'écrit que sous
    // `mkdtempSync` de os.tmpdir() — l'arbre n'est jamais écrit.
    'scripts/guards/lib/depotGabarit.mjs',
    // +1 le 2026-10-07 (#2400) : `perimetre.mjs` lint ses fichiers touchés par `lancerLint`, qui pose sa config
    // jetable dans `cwd` ; seule la CLI l'appelle, le banc injecte son lanceur (`lintDesTouches`).
    'scripts/guards/lib/lintStage.mjs',
    'scripts/lancer-local.test.mjs',
    // +1 le 2026-09-24 (#1801) : la porte de version de Node se prouve sur un FAUX ARBRE
    // (`mkdtempSync` + `writeFileSync`/`copyFileSync` sous os.tmpdir(), `rmSync` en finally) — un
    // `engines.node` intenable ne se fabrique pas autrement ; l'arbre du dépôt n'est jamais écrit.
    'scripts/node-requis.test.mjs',
    'scripts/test/gitDeBanc.test.mjs',
    // +2 le 2026-10-07 (#2400) : `perimetre.mjs` écrit ses mémos sous `node_modules/.cache/perimetre/` par sa
    // seule CLI ; son banc lui passe un dossier de mémos et des dépôts forgés sous `mkdtempSync` d'os.tmpdir()
    // (`rmSync` par t.after) — l'arbre n'est jamais écrit. +1 le 2026-10-07 (#2400) : le reporter Vitest
    // `dureesVitest.mjs` écrit son rapport sous le `--outputFile.durees` que lui passe la CLI de `perimetre.mjs`
    // (`node_modules/.cache/perimetre/`) ; son banc n'en appelle que la fonction pure `dureesDesModules`.
    'scripts/test/dureesVitest.mjs',
    'scripts/test/perimetre.mjs',
    'scripts/test/perimetre.test.mjs',
    'scripts/test/run-capture.test.mjs',
    'scripts/test/run-isolation.test.mjs',
    'scripts/test/verrou.mjs',
    // +1 le 2026-10-05 (#2279 N0) : le banc de concurrence du verrou lance ses preneurs (processus réels)
    // sous un `mkdtempSync` d'os.tmpdir() (`writeFileSync` du compteur, `rmSync` en finally) ; l'arbre
    // n'est jamais écrit.
    'scripts/test/verrou.test.mjs',
  ],
  'test:docs': ['scripts/guards/lib/protectionWorktree.mjs',
    // +1 le 2026-10-08 (#2497) : `node-tests.mjs` écrit le rapport de durées de `dureesNodeTest.mjs` sous un
    // `mkdtempSync` d'os.tmpdir(), retiré par `rmSync` en finally ; l'arbre n'est jamais écrit.
    'scripts/test/node-tests.mjs',
    // #2499
    'scripts/gates/toutes.mjs',
    'scripts/guards/lib/purgerPerimes.mjs',
    'scripts/ops/reprendre-file.mjs',
    'scripts/docs/build-all-check.test.mjs',
    'scripts/docs/build-all.mjs',
    'scripts/docs/check-plans-anchors.test.mjs',
    // #1964
    'scripts/docs/build-passifs.test.mjs',
    // `canauxMecaniques.test.mjs` forge ses sources (`mkdtempSync` +
    // `writeFileSync`) sous `os.tmpdir()` ; l'arbre n'est jamais écrit.
    'scripts/docs/lib/canauxMecaniques.test.mjs',
    // +1 le 2026-09-26 (#1973) : le banc de `canoniser` pose deux dossiers (`mkdtempSync`,
    // `mkdirSync`) et une jonction (`symlinkSync`) sous `os.tmpdir()`, `rmSync` en finally ; l'arbre
    // n'est jamais écrit.
    'scripts/docs/lib/chemin-mesure.test.mjs',
    'scripts/docs/lib/ecriture-derives.mjs',
    // +1 le 2026-09-23 (#1801) : le banc de `ecrireOuVerifier` joue la primitive sur un doc JETABLE
    // (`mkdtempSync` + `writeFileSync` sous `os.tmpdir()`) ; l'arbre n'est jamais écrit.
    'scripts/docs/lib/ecriture-derives.test.mjs',
    // +2 le 2026-09-14 (#1759) : le test de contrat importe `installer` pour
    // monter l'enveloppe de `fs` à nu (la casse d'un chemin lu se juge sans sous-processus).
    // L'écriture de ce module est la sienne propre — `<WFRP_LECTURES_SORTIE>.<pid>.json`, derrière la
    // porte d'environnement `SORTIE` (`WFRP_LECTURES_SORTIE`) —, et `build-all.mjs` pointe cette sortie
    // sous os.tmpdir().
    'scripts/docs/lib/enregistreur-lectures.mjs',
    'scripts/docs/lib/enregistreur-lectures.test.mjs',
    'scripts/docs/lib/fraicheur-docs.mjs',
    'scripts/docs/lib/fraicheur-docs.test.mjs',
    'scripts/git-hooks/journal.mjs',
    'scripts/test/verrou.mjs',
    // `scripts/docs/lib/jsdocUnion.test.mjs`
    'scripts/docs/lib/jsdocUnion.test.mjs',
    'scripts/docs/lib/plateforme-win32-fs.test.mjs',
    // +1 le 2026-09-23 (#1801) : le banc de la simulation win32 forge un dépôt JETABLE (`mkdtempSync`
    // + `mkdirSync`/`writeFileSync` sous `os.tmpdir()`, `rmSync` en finally) — ce que voit un module
    // selon son LIEU exige de vrais fichiers à charger ; l'arbre n'est jamais écrit.
    'scripts/docs/lib/plateforme-win32.test.mjs',
    // +1 le 2026-09-07 (#1709) : `build-all-check.test.mjs` et `check-plans-anchors.test.mjs`
    // prennent leurs dépôts jetables à la fixture partagée, qui n'écrit que sous `os.tmpdir()`.
    'scripts/guards/lib/depotGabarit.mjs',
  ],
  'deps:unused': [],
  'test:recette': ['scripts/guards/lib/protectionWorktree.mjs',
    // +1 le 2026-10-08 (#2497) : `node-tests.mjs` écrit le rapport de durées de `dureesNodeTest.mjs` sous un
    // `mkdtempSync` d'os.tmpdir(), retiré par `rmSync` en finally ; l'arbre n'est jamais écrit.
    'scripts/test/node-tests.mjs',
    'scripts/recette/lib.mjs',
    // +1 le 2026-10-07 (#2198) : le banc de `shot` capture dans un dossier d'`os.tmpdir()` qu'il efface
    // (`rmSync` en `t.after`) ; l'arbre n'est jamais écrit.
    'scripts/recette/lib.test.mjs',
  ],
  typecheck: [],
  lint: [],
  // La purge des captures périmées du lanceur efface dans `node_modules/.cache`, jamais dans l'arbre versionné.
  test: [
    'scripts/guards/lib/purgerPerimes.mjs',
    'scripts/test/run.mjs',
    'scripts/test/verrou.mjs',
  ],
  // +2 le 2026-09-30 (#2203) : `gen` est `build-all.mjs --code` (`genererCode`), qui écrit les cibles
  // de CODE par `ecrireOuVerifier`.
  build: ['scripts/guards/lib/protectionWorktree.mjs',
    'scripts/docs/build-all.mjs',
    'scripts/docs/lib/ecriture-derives.mjs',
    'scripts/docs/lib/fraicheur-docs.mjs',
  ],
  'docs:build': [
    'scripts/docs/build-all.mjs',
    'scripts/docs/lib/ecriture-derives.mjs',
    'scripts/docs/lib/fraicheur-docs.mjs',
    'scripts/guards/lib/protectionWorktree.mjs',
  ],
  'test:raw': ['scripts/guards/lib/protectionWorktree.mjs',
    // +1 le 2026-10-08 (#2497) : `node-tests.mjs` écrit le rapport de durées de `dureesNodeTest.mjs` sous un
    // `mkdtempSync` d'os.tmpdir(), retiré par `rmSync` en finally ; l'arbre n'est jamais écrit.
    'scripts/test/node-tests.mjs',
    'scripts/docs/lib/ecriture-derives.mjs',
    // +1 le 2026-09-20 (#1825) : le banc du contrat d'acceptation de l'Atlas IMPORTE
    // l'acceptation déclarée par chaque lecteur, `croissance.mjs` compris — une ligne de contrat
    // qui nommerait ses lecteurs dans une CHAÎNE ne dirait rien de ce qu'ils déclarent. Le module
    // n'écrit que dans un EXPORT jetable sous `os.tmpdir()` (même raison qu'en `test:hooks`).
    'scripts/migrations/lib/croissance.mjs',
    'scripts/raw/anchor-fill.mjs',
    'scripts/raw/build-implemente.mjs',
    'scripts/raw/build-implemente.test.mjs',
    'scripts/raw/check-code-refs.test.mjs',
    'scripts/raw/check-entity-in-chapter.test.mjs',
    'scripts/raw/check-folio-continuity.test.mjs',
    // +1 le 2026-09-14 (#1739) : le banc du détecteur du format des extractions écrit — il fabrique
    // des dossiers de livre JETABLES sous `os.tmpdir()` (`mkdtempSync`/`mkdirSync`/`writeFileSync`,
    // retirés par `rmSync`) pour éprouver le chemin DISQUE du détecteur. Aucune écriture DANS
    // l'arbre : même classe que `scripts/guards/lib/depotGabarit.mjs` (test:docs) et les dépôts
    // jetables de `scripts/ops/`.
    'scripts/raw/check-source-format.test.mjs',
    'scripts/raw/citation-graphy-guard.test.mjs',
    'scripts/raw/folio-bootstrap.mjs',
    'scripts/raw/folio-bootstrap.test.mjs',
    // +1 le 2026-09-23 (#1739) : le banc de la carte de lignes éprouve le refus du CR isolé
    // (#604) de `carteDuFichier` sur un fichier JETABLE (`mkdtempSync` + `writeFileSync` sous
    // `os.tmpdir()`, `rmSync` en finally). Aucune écriture DANS l'arbre : même classe que
    // `check-source-format.test.mjs` ci-dessus.
    'scripts/raw/lib/carte-lignes.test.mjs',
    // +1 le 2026-09-14 (#1739) : le banc de la lib de lecture des extractions Marker fabrique
    // des dossiers de tranches JETABLES sous `os.tmpdir()` (`mkdtempSync`/`mkdirSync`/`writeFileSync`,
    // retirés par `rmSync`) pour éprouver `mdsDeMarker`/`mdsDeRestitutions` sur le disque. Aucune
    // écriture DANS l'arbre : même classe que `check-source-format.test.mjs` ci-dessus.
    'scripts/raw/lib/marker-pages.test.mjs',
    // L'extraction pypdf est importée par `empty-folios-stock.mjs` et `marker-pages.mjs`.
    // `extractPages` n'écrit que la sortie de
    // `pdf-extract.py` sous un `mkdtempSync` de os.tmpdir(), `rmSync` en finally : aucune écriture
    // DANS l'arbre, même classe que `anchor-fill.mjs` ci-dessus.
    'scripts/raw/lib/pdf-extract.mjs',
    'scripts/raw/reanchor-split.mjs',
    'scripts/raw/reanchor.mjs',
    'scripts/raw/reconcile.test.mjs',
    // +1 le 2026-09-21 (#1739 S1) : `recouper-source.test.mjs` importe le re-coupeur des `.md` en
    // service pour éprouver son cœur PUR (`recouper`, `planDe`, `contenuDe`, `indexDe`, `recalerStock`)
    // sur un livre FORGÉ en mémoire ; ses `writeFileSync`/`rmSync` vivent dans `main()`, sous sa porte
    // `import.meta.main` (`main` de recouper-source.mjs) — déclarés en `ecritFerme` de `test:raw` (ECRIT_LU).
    'scripts/raw/recouper-source.mjs',
    // +3 le 2026-09-20 (#1825) : les deux bancs neufs posent leurs fixtures (fiche à intégrer,
    // fiche d'un autre cœur) sous `mkdtempSync` de os.tmpdir(), `rmSync` en finally ;
    // l'assembleur est ACQUIS parce que son banc l'importe. Mesure du 2026-09-21 (#1825 F1-0-C) :
    // `assemble()` ÉCRIT, et le banc l'APPELLE — il lui passe son `rawDir` (même couture que
    // `cheminDeFiche`), pointé sur un `mkdtempSync` de os.tmpdir() : l'arbre n'est jamais écrit, et
    // le banc le mesure aux deux bouts (refus → dossier jetable VIDE ; publication → fiche DANS le
    // jetable, absente de `docs/raw/`).
    'scripts/raw/apply-livre.test.mjs',
    'scripts/raw/assemble-domain.mjs',
    'scripts/raw/assemble-domain.test.mjs',
    // +4 le 2026-09-20 (#1825) : la FABRIQUE d'Atlas jetable et les deux bancs qui la
    // prennent posent leur arborescence sous `mkdtempSync` de os.tmpdir(), `rmSync` en finally ;
    // l'écrivain du bloc des cœurs est ACQUIS parce que son banc l'importe — son `writeFileSync`
    // vit dans `main()`, sous sa porte `import.meta.main` (build-atlas-index.mjs), et le cas `--check` le
    // LANCE dans un arbre JETABLE dont il est le cwd.
    'scripts/raw/_lib.test.mjs',
    'scripts/raw/atlasFixture.mjs',
    'scripts/raw/build-atlas-index.mjs',
    'scripts/raw/build-atlas-index.test.mjs',
    // #2155 : les bancs de `test:raw` lancent git par `scripts/test/gitDeBanc.mjs`, qui tient son env isolé
    // (`envDeDepotForge`) de la primitive ; elle n'écrit que sous `mkdtempSync` de os.tmpdir().
    'scripts/guards/lib/depotGabarit.mjs',
    // +1 le 2026-09-21 (#1825) : le banc de la PROJECTION écrit les rendus de fixture que
    // `lireRendu` relit (mode de reprise du workflow) sous `mkdtempSync` de os.tmpdir(), `rmSync` en
    // finally ; depuis #2290 il y fait aussi écrire les fiches de dossier par `ecrireFiche`.
    'scripts/raw/workflow-args.test.mjs',
    // +1 le 2026-10-05 (#2290) : le lanceur ÉCRIT la fiche d'un run de `dossier-de-chapitre`
    // (`ecrireFiche`) — sous `docs/dossiers/` par sa seule CLI `ecrire-fiche`, que la gate ne lance
    // pas ; ses bancs lui passent un `dir` sous `mkdtempSync` de os.tmpdir(), et sa copie de garde
    // (`chargerDossiers` avant écriture) naît et meurt sous os.tmpdir(). L'arbre n'est jamais écrit.
    'scripts/raw/workflow-args.mjs',
    // +2 le 2026-10-05 (#2290) : les bancs du chargeur des fiches de dossier et de la population
    // CITANTS forgent leurs fiches sous `mkdtempSync` de os.tmpdir(), `rmSync` en finally.
    'scripts/raw/dossiers.test.mjs',
    'scripts/raw/lib/fichiersCitants.test.mjs',
    // +1 le 2026-09-21 (#1825) : le banc du WORKFLOW joue la reprise de BOUT EN BOUT —
    // rendu du run → fichier → `lireRendu` → workflow → fichier → `assemble`. Il écrit ses deux
    // rendus et son Atlas de sortie sous `mkdtempSync` de os.tmpdir(), `rmSync` en finally ;
    // `assemble` reçoit ce jetable par son `rawDir` (même couture que `cheminDeFiche`), l'arbre
    // n'est jamais écrit, et le banc mesure la fiche DANS le jetable.
    'scripts/raw/atlas-domain.workflow.test.mjs',
    // +1 le 2026-09-22 (#1824) : l'outil qui répare les renvois d'ancre morts, ACQUIS par l'import de
    // son banc — son `writeFileSync` vit derrière la porte `--apply` de `reparer`, que le banc ne
    // passe que sur un Atlas JETABLE d'os.tmpdir() (`avecAtlasFixture`) ; l'arbre n'est jamais écrit.
    'scripts/raw/reparer-ancres.mjs',
    // +1 le 2026-09-23 (#1739) : le banc de la couture du PDF d'un livre pose son `Source/` FACTICE
    // (un PDF, des dossiers de sortie Marker) sous `mkdtempSync` de os.tmpdir(), `rmSync` en finally,
    // et le passe à la couture par son `source` INJECTÉ ; la couture (`_lib.mjs`) n'écrit rien — le
    // seul écrivain, la CLI `pdf-de.mjs`, n'est pas importé (le banc la LANCE, sans argument).
    'scripts/raw/pdf-de.test.mjs',
    // +1 le 2026-09-23 (#1739) : la réparation du mobilier de page, ACQUISE par l'import de son banc —
    // son unique `writeFileSync` vit dans `main()`, derrière `import.meta.main` ET `--apply` ; le banc n'appelle
    // que ses fonctions PURES sur des textes en mémoire, l'arbre n'est jamais écrit.
    'scripts/raw/reparer-mobilier.mjs',
    // +1 le 2026-09-23 (#1739) : la sonde des titres d'entrée, ACQUISE par l'import de son banc — elle
    // lit le PDF dans un dossier `mkdtempSync` d'os.tmpdir(), et son `--json` refuse tout chemin sous
    // le dépôt ; le banc n'appelle que ses fonctions PURES sur des fixtures, l'arbre n'est jamais écrit.
    'scripts/raw/sonde-titres.mjs',
    // +1 le 2026-09-24 (#1739) : la réparation des titres d'entrée, ACQUISE par l'import de son banc —
    // son unique `writeFileSync` vit dans `main()`, derrière `import.meta.main` ET `--apply` ; le banc n'appelle
    // que son cœur PUR (`reparerLivre`, `infidelite`) sur un livre forgé en mémoire.
    'scripts/raw/reparer-titres.mjs',
  ],
  'raw:check-refs': ['scripts/guards/lib/protectionWorktree.mjs', ],
  // La gate enchaîne `citation-graphy-guard.mjs`, qui IMPORTE `fieldBlockMask` de
  // `build-implemente.mjs` (frontière du bloc de champ généré, source unique, #925) ; la réécriture
  // des fiches de ce module vit derrière sa porte `import.meta.main` (`main` de build-implemente.mjs).
  // Mesurée par `scripts/docs/lib/enregistreur-lectures.mjs` en `--import` sur le CLI : ZÉRO écriture.
  'raw:check-code-refs': ['scripts/guards/lib/protectionWorktree.mjs', 'scripts/raw/build-implemente.mjs'],
  // #1824
  'raw:check-ancres': ['scripts/guards/lib/protectionWorktree.mjs', ],
  'raw:check-folio-continuity': ['scripts/guards/lib/protectionWorktree.mjs', ],
  'raw:check-source-tables': ['scripts/guards/lib/protectionWorktree.mjs', ],
  'raw:check-source-format': ['scripts/guards/lib/protectionWorktree.mjs', ],
  'raw:check-source-puces': ['scripts/guards/lib/protectionWorktree.mjs', ],
  'raw:check-renvois': ['scripts/guards/lib/protectionWorktree.mjs', ],
  'server:typecheck': [],
}

test('aucune gate n’acquiert un module ÉCRIVAIN sans que ÉCRIT/LU soit re-mesurée', () => {
  const mesure = ecrivainsParGate(RACINE)
  assert.deepEqual(Object.keys(mesure).sort(), Object.keys(ATTENDU).sort(), 'les gates de ci.yml ont changé')
  for (const [gate, scripts] of Object.entries(mesure)) {
    const neufs = scripts.filter((s) => !ATTENDU[gate].includes(s))
    assert.deepEqual(
      neufs,
      [],
      `« ${gate} » atteint ${neufs.length} module(s) écrivain(s) de plus : mesure ce qu'ils écrivent DANS L'ARBRE, ` +
        `déclare-le dans ECRIT_LU (scripts/gates/toutes.mjs) — ecrit, ou ecritFerme avec sa porte — puis inscris-les ici.`,
    )
  }
})

test('aucune entrée PÉRIMÉE : chaque écrivain inscrit est encore atteint par sa gate, et encore écrivain', () => {
  const mesure = ecrivainsParGate(RACINE)
  const perimes = Object.entries(ATTENDU)
    .map(([gate, inscrits]) => [gate, inscrits.filter((s) => !(mesure[gate] ?? []).includes(s))])
    .filter(([, scripts]) => scripts.length)
  assert.deepEqual(
    perimes,
    [],
    perimes.map(([gate, scripts]) => `« ${gate} » n'atteint plus, ou n'a plus pour écrivain : ${scripts.join(', ')}`).join(' ; ') +
      ' — retire chaque entrée, justifie le retrait dans le commit ou le solde, et relis ECRIT_LU.',
  )
})

test('la sonde n’est pas AVEUGLE : elle voit les écrivains connus, et ignore les lecteurs purs', () => {
  const mesure = ecrivainsParGate(RACINE)
  // Trois vérités indépendantes, chacune vérifiable à la main.
  assert.ok(
    mesure['docs:build'].includes('scripts/docs/lib/ecriture-derives.mjs'),
    '`ecrireOuVerifier` est le seam par lequel tout générateur écrit sa cible',
  )
  assert.ok(
    mesure['test:hooks'].includes('scripts/hooks/new-src-file-guard.test.mjs'),
    'le cas fondateur (un test qui écrit un registre de garde) doit rester visible',
  )
  assert.deepEqual(mesure.typecheck, [], '`tsc --noEmit` n’atteint aucun module écrivain')
  assert.deepEqual(mesure.lint, [], '`oxlint` sans `--fix` n’atteint aucun module écrivain')
})

test('toute gate qui atteint un écrivain a une entrée ÉCRIT/LU qui en parle', () => {
  for (const [gate, scripts] of Object.entries(ecrivainsParGate(RACINE))) {
    if (!scripts.length) continue
    const e = ECRIT_LU[gate]
    assert.ok(e, `${gate} : aucune entrée ÉCRIT/LU`)
    const declare = [...e.ecrit, ...Object.keys(e.ecritFerme ?? {})]
    assert.ok(
      declare.length || e.raison.length > 20,
      `${gate} atteint ${scripts.length} module(s) écrivain(s) et ne déclare NI écriture NI raison de n'en pas avoir`,
    )
  }
})

test('un import de DOSSIER se résout en son `index`, jamais en dossier (src/data/index.ts : `../i18n`)', () => {
  const corpus = transitif(['src/data/index.ts'], RACINE)
  assert.ok(corpus.includes('src/i18n/index.ts'), '`../i18n` doit atteindre src/i18n/index.ts')
  assert.ok(!corpus.includes('src/i18n'), 'un dossier n’est jamais un module du corpus')
})

test('le corpus de chaque gate ne compte que des FICHIERS', () => {
  for (const [gate, corpus] of Object.entries(corpusParGate(RACINE))) {
    const dossiers = corpus.filter((f) => !statSync(join(RACINE, f)).isFile())
    assert.deepEqual(dossiers, [], `${gate} : corpus porteur de dossiers`)
  }
})

test('les imports effacés n’entrent pas au corpus réel', () => {
  // `renvoi.ts` n'importe `valeurs.ts` que pour le TYPE `SourceRef`, et `decoupe.ts` pour du code.
  const corpus = transitif(['src/data/source/renvoi.ts'], RACINE)
  assert.ok(corpus.includes('src/data/source/decoupe.ts'))
  assert.ok(!corpus.includes('src/data/schemas/grammaire/valeurs.ts'))
})

test('R3 : le corpus suit les acquisitions exécutées et ignore le texte inerte', () => {
  const racine = mkdtempSync(join(tmpdir(), 'ecrivains-imports-'))
  try {
    writeFileSync(join(racine, 'a.ts'), 'export const b = 1; export type A = number; export type B = string;')
    const cas = [
      ["import type { A } from './a';", false],
      ["export type { A } from './a';", false],
      ["import { type A, type B } from './a';", false],
      ["import { type A, b } from './a';", false],
      ["import { type A, b } from './a'; console.log(b);", true],
      ["import './a';", true],
      ["export { b } from './a';", true],
      ["const p = import('./a');", true],
      ["const p = require('./a');", true],
      ["/* import './a'; */ const s = \"from './a'\";", false],
    ]
    for (const [source, atteint] of cas) {
      writeFileSync(join(racine, 'entree.ts'), source)
      assert.deepEqual(transitif(['entree.ts'], racine).sort(), atteint ? ['a.ts', 'entree.ts'] : ['entree.ts'], source)
    }
    assert.deepEqual(transitif(['absent.mjs'], racine), [])
    writeFileSync(join(racine, 'invalide.mjs'), 'const = ;')
    assert.throws(() => transitif(['invalide.mjs'], racine), /invalide\.mjs ne se parse pas/)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})
