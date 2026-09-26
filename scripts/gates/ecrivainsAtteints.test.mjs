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
import { execFileSync } from 'node:child_process'
import { corpusParGate, ecrivainsParGate, sansImportsDeType, transitif } from './ecrivainsAtteints.mjs'
import { statSync } from 'node:fs'
import { join } from 'node:path'
import { ECRIT_LU } from './toutes.mjs'

const RACINE = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()

/** Scripts ÉCRIVAINS atteints par chaque gate — mesuré le 2026-09-04, stock à faire DÉCROÎTRE. */
const ATTENDU = {
  'agents:check': ['scripts/agents/compat-cli.mjs'],
  'test:agents': ['scripts/agents/compat-cli.mjs'],
  'test:hooks': [
    'scripts/docs/build-all.mjs',
    'scripts/docs/lib/empreinte-sources.mjs',
    // +2 le 2026-09-16 (#1738) : la garde du classement de push fabrique des dépôts JETABLES
    // (`mkdtempSync` + `git init` + `writeFileSync` sous os.tmpdir(), `rmSync` en finally) pour
    // éprouver `merge-base` et le CLI ; la garde des liens de mémoire, venue de `src/` en node:test,
    // forge ses fiches sous un `mkdtempSync` de os.tmpdir() — l'arbre du dépôt n'est jamais écrit.
    'scripts/gates/classerPush.test.mjs',
    'scripts/guards/lib/memoryLinks.test.mjs',
    // +1 le 2026-09-20 (#1825 lot E2) : le banc de l'ENVELOPPE de jeu d'un workflow écrit ses
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
    'scripts/git-hooks/merge-docs.mjs',
    'scripts/git-hooks/merge-docs.test.mjs',
    'scripts/git-hooks/pre-push.mjs',
    'scripts/git-hooks/pre-push.test.mjs',
    // +2 le 2026-09-05 (#1679 L3 T2) : les deux tests de l'hôte des lectures git et de la lecture des
    // courses CI écrivent leurs fixtures (dépôts jetables, fichiers de stub) sous `os.tmpdir()` —
    // l'arbre n'est jamais touché.
    'scripts/guards/lib/coursesCi.test.mjs',
    // +2 le 2026-09-07 (#1709 B1) : la fixture de dépôt jetable est devenue une source unique ; le
    // gabarit et ses instances vivent sous `os.tmpdir()` (`mkdtempSync` + `cpSync`), l'arbre n'est
    // jamais écrit — même mesure que les fixtures qu'elle remplace.
    'scripts/guards/lib/depotGabarit.mjs',
    'scripts/guards/lib/depotGabarit.test.mjs',
    'scripts/guards/lib/enteteArbre.test.mjs',
    // +1 le 2026-09-14 (#1728 train B) : la porte CRLF de l'index se mesure sur un dépôt JETABLE
    // (`mkdtempSync` + `writeFileSync` sous os.tmpdir(), `git init` local) — le patch CRLF appliqué à
    // l'index ne peut pas se fabriquer autrement, et l'arbre du dépôt n'est jamais écrit.
    'scripts/guards/lib/eolStage.test.mjs',
    'scripts/guards/lib/gitPorte.test.mjs',
    'scripts/guards/lib/importGraph.test.mjs',
    'scripts/guards/lib/lintStage.test.mjs',
    // +1 le 2026-09-05 (#1679 L3b) : la porte de rôle du lecteur à ordre total pose ses dossiers-fixtures
    // (`mkdtempSync` + `writeFileSync`) sous `os.tmpdir()` — l'arbre n'est jamais écrit.
    'scripts/guards/lib/lister.test.mjs',
    // +1 le 2026-09-18 (#1813) : la garde des MODULES FEUILLES fabrique un arbre JETABLE
    // (`mkdtempSync` sous os.tmpdir(), `mkdirSync`/`writeFileSync` pour la feuille, son banc et les
    // sources du cas, `rmSync` en finally) — éprouver les graphies d'import qui atteignent une feuille
    // exige de VRAIS fichiers à résoudre, et l'arbre du dépôt n'est jamais écrit : mesuré le
    // 2026-09-18, `git status --porcelain` identique avant/après, et `/tmp` sans résidu.
    'scripts/guards/lib/modulesFeuilles.test.mjs',
    'scripts/guards/lib/plageStock.test.mjs',
    // +2 le 2026-09-06 (#1679 L3b) : la purge des dossiers de CACHE (`node_modules/.cache`,
    // `node_modules/.cache/gates`) est une source unique — elle EFFACE, par construction ; son test
    // pose et efface ses fichiers sous `os.tmpdir()`. Ni l'une ni l'autre ne touche l'arbre versionné.
    'scripts/guards/lib/purgerPerimes.mjs',
    'scripts/guards/lib/purgerPerimes.test.mjs',
    // +1 le 2026-09-07 (#1709 C1) : la porte de rôle du corpus source pose ses fixtures
    // (`mkdtempSync` + `writeFileSync`, puis `rmSync`) sous `os.tmpdir()` — l'arbre versionné n'est
    // jamais écrit, et la lib mesurée (`sourceCorpus.mjs`) ne fait que LIRE.
    'scripts/guards/lib/sourceCorpus.test.mjs',
    // +1 le 2026-09-14 (#1759) : le banc du rejeu de spawn ENTRE dans la gate — il était né le
    // 2026-09-04 hors de toute liste écrite à la main, donc jamais joué. Ses écritures sont ses
    // fixtures : des scripts jetables sous `os.tmpdir()` (`mkdtempSync` + `writeFileSync`, `rmSync`
    // en sortie) qui sortent avec le code du loader ; l'arbre n'est jamais écrit.
    'scripts/guards/lib/spawnResilient.test.mjs',
    // +4 −1 le 2026-09-26 (#1973), net +3 : les hooks d'écriture se taisent hors de tout dépôt et lisent
    // le disque au chemin RÉEL ; quatre bancs le mesurent sous `os.tmpdir()` (`rmSync` en finally,
    // l'arbre versionné n'est jamais écrit). Data-edit ne pose que des DOSSIERS (`instanceDeDepot`,
    // `mkdtempSync`) : le hook juge un chemin. Exception-add y écrit un fichier de garde EXISTANT
    // (`writeFileSync`), memoire-tombale une fiche (`mkdirSync` + `writeFileSync`) et une jonction
    // (`symlinkSync`), poison-postcheck le fichier scanné (`mkdirSync` + `writeFileSync`) : les trois
    // lisent le disque, natif et MSYS doivent y lire le même fichier.
    'scripts/hooks/data-edit-guard.test.mjs',
    // +1 le 2026-09-14 (#1754) : le banc du garde `[entériné]` pose ses fichiers-CIBLES (`mkdtempSync`
    // + `writeFileSync`, puis `rmSync`) sous `os.tmpdir()` — c'est l'état SUR DISQUE que le hook lit
    // désormais pour ne demander que sur un tag NEUF ; l'arbre versionné n'est jamais écrit.
    'scripts/hooks/enterine-guard.test.mjs',
    'scripts/hooks/exception-add-guard.test.mjs',
    'scripts/hooks/inject-project-credo.test.mjs',
    'scripts/hooks/memoire-tombale-guard.test.mjs',
    'scripts/hooks/new-src-file-guard.mjs',
    'scripts/hooks/new-src-file-guard.test.mjs',
    'scripts/hooks/poison-postcheck.test.mjs',
    'scripts/hooks/segments-profonds.test.mjs',
    'scripts/hooks/solde-ticket-guard-driver.test.mjs',
    'scripts/hooks/solde-ticket-guard.test.mjs',
    'scripts/hooks/typecheck-fast-wrapper.test.mjs',
    // +2 le 2026-09-14 (#1699) : la migration des chemins de `Source/` en ASCII et son banc. La
    // migration ÉCRIT (git mv, réécritures) UNIQUEMENT sous `--apply`, que le banc ne lui donne que
    // sur des dépôts JETABLES (`instanceDeDepot`, sous `os.tmpdir()`) ; jouée sans argument — ce que
    // fait `migrations:replay` — elle est en `--dry` et n'écrit rien. L'arbre n'est jamais touché.
    'scripts/migrations/2026-09-14-1699-source-chemins-ascii.mjs',
    'scripts/migrations/lib/1699-source-chemins-ascii.test.mjs',
    // +1 le 2026-09-22 (#1873) : le banc de la migration #1825 des stocks de l'Atlas ; son dépôt
    // jetable vit sous `os.tmpdir()`, l'arbre n'est jamais écrit.
    'scripts/migrations/lib/1825-stocks-atlas-chemins-par-coeur.test.mjs',
    // +3 le 2026-09-05 : morsure des portes des trois migrations #1686 (lot 1 ids composés, lot 2
    // fusion des matières, lot 3a-2 purge de `structureAppearance.material`) ; leur dépôt jetable vit
    // sous `os.tmpdir()`, l'arbre n'est jamais écrit.
    'scripts/migrations/lib/1686-ardoise-portes.test.mjs',
    'scripts/migrations/lib/1686-materials-portes.test.mjs',
    'scripts/migrations/lib/1686-structure-material-portes.test.mjs',
    // +1 le 2026-09-07 (#1691 lot 2) : morsure des portes des deux migrations #1691 (relief) ; son
    // dépôt jetable vit sous `os.tmpdir()`, l'arbre n'est jamais écrit.
    'scripts/migrations/lib/1691-relief-portes.test.mjs',
    // +1 le 2026-09-09 (#1715 volet b) : morsure des portes de la migration #1715 (toiture par défaut
    // de la scène) ; son dépôt jetable vit sous `os.tmpdir()`, l'arbre n'est jamais écrit.
    'scripts/migrations/lib/1715-roof-defaults-portes.test.mjs',
    // +1 le 2026-09-10 (#1687 lot 2) : morsure des portes de la migration #1687 (activation des
    // décors à places) ; son dépôt jetable vit sous `os.tmpdir()`, l'arbre n'est jamais écrit.
    'scripts/migrations/lib/1687-usable-sieges-portes.test.mjs',
    // +1 le 2026-09-23 (#1343 lot B) : morsure des portes de la migration #877 (ref de décor
    // nommée) ; son dépôt jetable vit sous `os.tmpdir()`, l'arbre n'est jamais écrit.
    'scripts/migrations/lib/877-ref-de-decor-portes.test.mjs',
    // +1 le 2026-09-23 (#1882) : morsure des portes de la migration #1882 (fiche de personnage
    // nommée) ; son dépôt jetable vit sous `os.tmpdir()`, l'arbre n'est jamais écrit.
    'scripts/migrations/lib/1882-fiche-de-personnage-portes.test.mjs',
    // +1 le 2026-09-24 (#1882 T2d) : morsure des portes de la migration 13 → 14 (réf. vivantes d'effet
    // semées) ; son dépôt jetable vit sous `os.tmpdir()`, l'arbre n'est jamais écrit.
    'scripts/migrations/lib/1882-refs-vivantes-portes.test.mjs',
    // +2 le 2026-09-18 (#1812) : le mode CROISSANCE fait grandir les documents d'un EXPORT jetable
    // (`os.tmpdir()`, `replay-head.mjs:exporter`) avant de rejouer les migrations — l'arbre n'est
    // jamais écrit, et son banc travaille sur un dépôt `mkdtemp`.
    'scripts/migrations/lib/croissance.mjs',
    'scripts/migrations/lib/croissance.test.mjs',
    'scripts/migrations/lib/empreinteRejeu.test.mjs',
    'scripts/migrations/lib/idempotence-ordre-des-cles.test.mjs',
    // +1 le 2026-09-22 (#1873) : `joue.mjs` COPIE la migration jouée dans le dépôt jetable que lui donne
    // chaque banc de migration (`copyFileSync`, sous `os.tmpdir()`) ; l'arbre n'est jamais écrit.
    'scripts/migrations/lib/joue.mjs',
    'scripts/migrations/replay-head.mjs',
    'scripts/raw/build-implemente.mjs',
    'scripts/test/verrou.mjs',
  ],
  'test:ops': [
    // +1 le 2026-09-07 (#1709 B1) : `fermer-depuis-main.test.mjs` et `faits-de-palier.test.mjs`
    // prennent leurs dépôts jetables à la fixture partagée, qui n'écrit que sous `os.tmpdir()`.
    // +8 le 2026-09-14 (#1736) : le train de publication entre dans `test:ops`.
    // · `chantier.test.mjs` et `worktrees.test.mjs` posent de VRAIS worktrees et un origin nu, tous
    //   sous os.tmpdir() (fixture partagée + mkdtemp), jetés en finally — aucune écriture DANS
    //   l'arbre. `chantier.mjs`/`worktrees.mjs` écrivent, eux, dans l'arbre PRINCIPAL en usage réel
    //   (git worktree add/remove), jamais depuis la gate.
    // · `publier.mjs` est atteint par `publier.test.mjs`, qui joue ses fonctions PURES (options,
    //   journal en mémoire, verdicts, mise en forme) et ses étapes sur des `ctx` FACTICES, dans des
    //   racines jetables (mkdtemp sous os.tmpdir(), rmSync en finally — d'où ses imports d'écriture).
    //   Les écritures réelles de `publier.mjs` sont son journal `node_modules/.cache/publication/` et
    //   le commit des docs DÉRIVÉS — toutes deux derrière sa porte `estMain` (scripts/ops/publier.mjs,
    //   dernière ligne), jamais depuis la gate.
    // · `build-all.mjs`, `empreinte-sources.mjs` et `purgerPerimes.mjs` sont atteints PAR
    //   `publier.mjs`, qui n'en importe que des CONSTANTES et des fonctions pures (`GENERATORS`,
    //   `SOURCES_LUES`) ; leurs écritures vivent derrière leurs propres portes `isMain`, ou sous
    //   `node_modules/.cache`.
    'scripts/docs/build-all.mjs',
    'scripts/docs/lib/empreinte-sources.mjs',
    'scripts/gates/toutes.mjs',
    'scripts/guards/lib/depotGabarit.mjs',
    'scripts/guards/lib/purgerPerimes.mjs',
    'scripts/ops/chantier.test.mjs',
    // +1 le 2026-09-18 (#1813) : le banc du vocabulaire de PLAGE FERMANTE prend ses dépôts jetables à
    // la fixture partagée (`instanceDeDepot`, sous os.tmpdir()) et y pose ses fichiers
    // (`mkdirSync`/`writeFileSync` pour `.claude/soldes/42.md`, `rmSync` en finally) : lire une plage
    // dans l'histoire et le solde qu'un commit emporte exige de VRAIS commits, et l'arbre du dépôt
    // n'est jamais écrit — mesuré le 2026-09-18, `git status --porcelain` identique avant/après.
    'scripts/ops/plageFermante.test.mjs',
    'scripts/ops/publier.mjs',
    'scripts/ops/publier.test.mjs',
    'scripts/ops/worktrees.test.mjs',
    'scripts/test/verrou.mjs',
    // +2 le 2026-09-04 (#1679 L2bis) : `faits-de-palier.mjs` écrit le JSON des faits (`--sortie`,
    // défaut sous os.tmpdir()) pour qu'un workflow n'ait pas à le recopier dans chaque prompt, et son
    // test fabrique un dépôt jetable sous os.tmpdir() — aucune écriture DANS l'arbre.
    'scripts/ops/faits-de-palier.mjs',
    'scripts/ops/faits-de-palier.test.mjs',
    'scripts/ops/fermer-depuis-main.test.mjs',
    'scripts/ops/knip-exports-ratchet.mjs',
    // +2 le 2026-09-16 (#1776) : le ruleset `main` (`scripts/ops/ruleset-main.mjs`).
    // · `ruleset-main.mjs` n'écrit QUE le corps du ruleset dans un fichier d'`os.tmpdir()`, pour le
    //   passer à `gh api --input` (ruleset-main.mjs:117-120) — et seulement depuis `executer`, que
    //   les tests n'appellent jamais : ils ne jouent que `corpsDuRuleset`, `contextesRequis` et
    //   `refusGh`, tous PURS.
    // · `ruleset-main.test.mjs` écrit ses fixtures `ci.yml` sous `os.tmpdir()` (`mkdtempSync`) ; sa
    //   seule lecture de l'arbre réel est `jobsCi({ cwd: RACINE })` (ruleset-main.test.mjs:27), qui
    //   ne fait que LIRE `.github/workflows/ci.yml`.
    // Même mesure que la raison `test:ops` d'`ECRIT_LU` (scripts/gates/toutes.mjs:129-150).
    'scripts/ops/ruleset-main.mjs',
    'scripts/ops/ruleset-main.test.mjs',
    // +1 le 2026-09-16 (#1779) : le banc du signaleur pose le CORPS du rapport (`--body-file` de `gh`)
    // sous os.tmpdir() (`mkdtempSync` + `writeFileSync`, `rmSync` en finally) ; `signaler-rouge.mjs`
    // ne fait que LIRE ce fichier, et son `gh` est INJECTÉ — l'arbre n'est jamais écrit.
    'scripts/ops/signaler-rouge.test.mjs',
  ],
  'test:runner': [
    'scripts/lancer-local.test.mjs',
    'scripts/test/run-capture.test.mjs',
    'scripts/test/run-isolation.test.mjs',
    'scripts/test/verrou.mjs',
  ],
  'test:docs': [
    'scripts/docs/build-all-check.test.mjs',
    'scripts/docs/build-all.mjs',
    'scripts/docs/check-plans-anchors.test.mjs',
    // +1 le 2026-09-14 (#1759) : `canauxMecaniques.test.mjs` ENTRE dans la gate — né le 2026-09-13
    // hors de toute liste écrite à la main, donc jamais joué. Il forge ses sources (`mkdtempSync` +
    // `writeFileSync`) sous `os.tmpdir()` ; l'arbre n'est jamais écrit.
    'scripts/docs/lib/canauxMecaniques.test.mjs',
    // +1 le 2026-09-26 (#1973) : le banc de `canoniser` pose deux dossiers (`mkdtempSync`,
    // `mkdirSync`) et une jonction (`symlinkSync`) sous `os.tmpdir()`, `rmSync` en finally ; l'arbre
    // n'est jamais écrit.
    'scripts/docs/lib/chemin-mesure.test.mjs',
    'scripts/docs/lib/empreinte-sources.mjs',
    // +2 le 2026-09-14 (#1759) : le test de contrat importe `installer` pour
    // monter l'enveloppe de `fs` à nu (la casse d'un chemin lu se juge sans sous-processus).
    // L'écriture de ce module est la sienne propre — `<WFRP_LECTURES_SORTIE>.<pid>.json`, derrière la
    // porte d'environnement (enregistreur-lectures.mjs:160) —, et `build-all.mjs` pointe cette sortie
    // sous os.tmpdir().
    'scripts/docs/lib/enregistreur-lectures.mjs',
    'scripts/docs/lib/enregistreur-lectures.test.mjs',
    // +1 le 2026-09-07 (#1709 B1) : `build-all-check.test.mjs` et `check-plans-anchors.test.mjs`
    // prennent leurs dépôts jetables à la fixture partagée, qui n'écrit que sous `os.tmpdir()`.
    'scripts/guards/lib/depotGabarit.mjs',
  ],
  'deps:unused': [],
  'test:recette': ['scripts/recette/lib.mjs'],
  typecheck: [],
  lint: [],
  // +1 le 2026-09-06 (#1679 L3b) : la purge des captures périmées du lanceur est passée en source
  // unique — elle efface dans `node_modules/.cache`, jamais dans l'arbre versionné.
  test: [
    'scripts/guards/lib/purgerPerimes.mjs',
    'scripts/test/run.mjs',
    'scripts/test/verrou.mjs',
  ],
  build: [],
  'docs:check': ['scripts/docs/build-all.mjs', 'scripts/docs/lib/empreinte-sources.mjs'],
  'docs:empreinte': ['scripts/docs/build-all.mjs', 'scripts/docs/lib/empreinte-sources.mjs'],
  'raw:coverage': ['scripts/docs/lib/empreinte-sources.mjs'],
  'raw:reconcile': ['scripts/docs/lib/empreinte-sources.mjs', 'scripts/raw/build-implemente.mjs'],
  'test:raw': [
    'scripts/docs/lib/empreinte-sources.mjs',
    // +1 le 2026-09-20 (#1825 lot F0) : le banc du contrat d'acceptation de l'Atlas IMPORTE
    // l'acceptation déclarée par chaque lecteur, `croissance.mjs` compris — une ligne de contrat
    // qui nommerait ses lecteurs dans une CHAÎNE ne dirait rien de ce qu'ils déclarent. Le module
    // n'écrit que dans un EXPORT jetable sous `os.tmpdir()` (même raison qu'en `test:hooks`).
    'scripts/migrations/lib/croissance.mjs',
    'scripts/raw/anchor-fill.mjs',
    'scripts/raw/build-implemente.mjs',
    'scripts/raw/build-implemente.test.mjs',
    // +1 le 2026-09-20 (#1825 lot F0) : le banc de l'aiguillage des catalogues FORGE un dépôt
    // (`mkdtempSync` + `mkdirSync`/`writeFileSync`, `rmSync` en finally, sous `os.tmpdir()`) pour
    // mesurer ce que la magie `:(glob)` porte — l'arbre du dépôt ne peut pas discriminer les deux
    // grammaires de glob. Aucune écriture DANS l'arbre : même classe que `check-source-format.test.mjs`.
    'scripts/raw/catalogues-aiguillage.test.mjs',
    'scripts/raw/check-code-refs.test.mjs',
    'scripts/raw/check-entity-in-chapter.test.mjs',
    'scripts/raw/check-folio-continuity.test.mjs',
    // +1 le 2026-09-14 (#1384 B1) : `check-source-tables.test.mjs` importe le détecteur, dont
    // l'unique écriture (régénération du stock) est fermée par `--ecrire-stock` sous `isMain`
    // (check-source-tables.mjs:194) — déclarée en `ecritFerme` de `test:raw` (ECRIT_LU).
    'scripts/raw/check-source-tables.mjs',
    // +1 le 2026-09-21 (#1820 R4) : `check-source-puces.test.mjs` importe le détecteur des puces
    // lues comme un jeton, dont l'unique écriture (régénération du stock) est fermée par
    // `--ecrire-stock` sous `isMain` (check-source-puces.mjs:159) — déclarée en `ecritFerme` de
    // `test:raw` (ECRIT_LU).
    'scripts/raw/check-source-puces.mjs',
    // +1 le 2026-09-25 (#1393 lot 1) : `check-renvois.test.mjs` importe la garde des renvois « page N »,
    // dont l'unique écriture (régénération du stock) est fermée par `--ecrire-stock` sous `isMain`
    // (check-renvois.mjs:89) — déclarée en `ecritFerme` de `test:raw` (ECRIT_LU).
    'scripts/raw/check-renvois.mjs',
    // +1 le 2026-09-14 (#1739 H-0) : `check-source-format.test.mjs` importe le détecteur du format
    // des extractions, dont l'unique écriture (régénération du stock) est fermée par `--ecrire-stock`
    // sous `isMain` (check-source-format.mjs:396) — déclarée en `ecritFerme` de `test:raw` (ECRIT_LU).
    'scripts/raw/check-source-format.mjs',
    // +1 le même jour : le banc lui-même écrit — il fabrique des dossiers de livre JETABLES sous
    // `os.tmpdir()` (`mkdtempSync`/`mkdirSync`/`writeFileSync`, retirés par `rmSync`) pour éprouver
    // le chemin DISQUE du détecteur. Aucune écriture DANS l'arbre : même classe que
    // `scripts/guards/lib/depotGabarit.mjs` (test:docs) et les dépôts jetables de `scripts/ops/`.
    'scripts/raw/check-source-format.test.mjs',
    'scripts/raw/check-refs.test.mjs',
    // +1 le 2026-09-19 (#1825 lot B) : le détecteur des sauts de folio porte désormais UN
    // `writeFileSync` — la régénération de son stock nominatif, fermée par `--ecrire-stock` sous
    // `isMain`, et déclarée en `ecritFerme` de `test:raw` (ECRIT_LU). Le banc ne fait que LIRE
    // (`readStock`, `lireStockJson`) pour comparer le fichier commité au rendu.
    'scripts/raw/check-folio-continuity.mjs',
    'scripts/raw/citation-graphy-guard.test.mjs',
    'scripts/raw/folio-bootstrap.mjs',
    'scripts/raw/folio-bootstrap.test.mjs',
    // +1 le 2026-09-23 (#1739 lot 3b-2a) : le banc de la carte de lignes éprouve le refus du CR isolé
    // (#604) de `carteDuFichier` sur un fichier JETABLE (`mkdtempSync` + `writeFileSync` sous
    // `os.tmpdir()`, `rmSync` en finally). Aucune écriture DANS l'arbre : même classe que
    // `check-source-format.test.mjs` ci-dessus.
    'scripts/raw/lib/carte-lignes.test.mjs',
    // +1 le 2026-09-14 (#1727 T2) : `check-folio-continuity.test.mjs` importe la fonction d'ÉCRITURE
    // du générateur des ancres sans contenu (`stocksEnTexte`) pour comparer son rendu aux deux stocks
    // committés ; elle rend un TEXTE. Le seul `writeFileSync` du module vit dans `main()`, sous
    // `isMain`, et exige les PDF gitignorés — déclaré en `ecritFerme` de `test:raw` (ECRIT_LU).
    'scripts/raw/lib/empty-folios-stock.mjs',
    // +1 le 2026-09-14 (#1739 Lot H) : le banc de la lib de lecture des extractions Marker fabrique
    // des dossiers de tranches JETABLES sous `os.tmpdir()` (`mkdtempSync`/`mkdirSync`/`writeFileSync`,
    // retirés par `rmSync`) pour éprouver `mdsDeMarker`/`mdsDeRestitutions` sur le disque. Aucune
    // écriture DANS l'arbre : même classe que `check-source-format.test.mjs` ci-dessus.
    'scripts/raw/lib/marker-pages.test.mjs',
    // +1 le 2026-09-25 (#1739) : l'extraction pypdf quitte `anchor-fill.mjs` pour sa maison, importée
    // par `empty-folios-stock.mjs` et `marker-pages.mjs`. `extractPages` n'écrit que la sortie de
    // `pdf-extract.py` sous un `mkdtempSync` de os.tmpdir(), `rmSync` en finally : aucune écriture
    // DANS l'arbre, même classe que `anchor-fill.mjs` ci-dessus.
    'scripts/raw/lib/pdf-extract.mjs',
    'scripts/raw/reanchor-split.mjs',
    'scripts/raw/reanchor.mjs',
    'scripts/raw/reanchor.test.mjs',
    'scripts/raw/reconcile.test.mjs',
    // +1 le 2026-09-21 (#1739 S1) : `recouper-source.test.mjs` importe le re-coupeur des `.md` en
    // service pour éprouver son cœur PUR (`recouper`, `planDe`, `contenuDe`, `indexDe`, `recalerStock`)
    // sur un livre FORGÉ en mémoire ; ses `writeFileSync`/`rmSync` vivent dans `main()`, sous sa porte
    // `estMain` (recouper-source.mjs:397) — déclarés en `ecritFerme` de `test:raw` (ECRIT_LU).
    'scripts/raw/recouper-source.mjs',
    // +1 le 2026-09-14 (#1759) : le test du LECTEUR de stock nominatif vit sous `scripts/raw`,
    // racine de cette gate. Il pose ses fixtures (`mkdtempSync` + `writeFileSync`,
    // puis `rmSync`) sous `os.tmpdir()` — l'arbre n'est jamais écrit, et le module mesuré
    // (`stockNominatif.mjs`) ne fait que LIRE.
    'scripts/raw/stockNominatif.test.mjs',
    // +3 le 2026-09-20 (#1825 lot E2) : les deux bancs neufs posent leurs fixtures (catalogue à bloc
    // préservé, fiche d'un autre cœur) sous `mkdtempSync` de os.tmpdir(), `rmSync` en finally ;
    // l'assembleur est ACQUIS parce que son banc l'importe. Mesure du 2026-09-21 (#1825 F1-0-C) :
    // `assemble()` ÉCRIT, et le banc l'APPELLE — il lui passe son `rawDir` (même couture que
    // `cheminDeFiche`), pointé sur un `mkdtempSync` de os.tmpdir() : l'arbre n'est jamais écrit, et
    // le banc le mesure aux deux bouts (refus → dossier jetable VIDE ; publication → fiche DANS le
    // jetable, absente de `docs/raw/`).
    'scripts/raw/apply-livre.test.mjs',
    'scripts/raw/assemble-domain.mjs',
    'scripts/raw/assemble-domain.test.mjs',
    // +4 le 2026-09-20 (#1825 lot F0) : la FABRIQUE d'Atlas jetable et les deux bancs qui la
    // prennent posent leur arborescence sous `mkdtempSync` de os.tmpdir(), `rmSync` en finally ;
    // l'écrivain du bloc des cœurs est ACQUIS parce que son banc l'importe — son `writeFileSync`
    // vit dans `main()`, sous sa porte `isMain` (build-atlas-index.mjs), et le cas `--check` le
    // LANCE dans un arbre JETABLE dont il est le cwd.
    'scripts/raw/_lib.test.mjs',
    'scripts/raw/atlasFixture.mjs',
    'scripts/raw/build-atlas-index.mjs',
    'scripts/raw/build-atlas-index.test.mjs',
    // +1 le 2026-09-20 (#1825 lot F0-D) : le banc de l'aiguillage des catalogues prend la fixture de
    // dépôt jetable (`instanceDeDepot`) et son env isolé (`envDeDepotForge`). La primitive ne fabrique
    // que sous `mkdtempSync` de os.tmpdir(), et jette ses gabarits à la sortie du process — aucune
    // écriture DANS l'arbre : même classe que `marker-pages.test.mjs` ci-dessus.
    'scripts/guards/lib/depotGabarit.mjs',
    // +1 le 2026-09-21 (#1825 lot F1-0-C) : le banc de la PROJECTION écrit les rendus de fixture que
    // `lireRendu` relit (mode de reprise du workflow) sous `mkdtempSync` de os.tmpdir(), `rmSync` en
    // finally ; le module mesuré (`workflow-args.mjs`) ne fait que LIRE.
    'scripts/raw/workflow-args.test.mjs',
    // +1 le 2026-09-21 (#1825 lot F1-0-D) : le banc du WORKFLOW joue la reprise de BOUT EN BOUT —
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
    // son unique `writeFileSync` vit dans `main()`, derrière `isMain` ET `--apply` ; le banc n'appelle
    // que ses fonctions PURES sur des textes en mémoire, l'arbre n'est jamais écrit.
    'scripts/raw/reparer-mobilier.mjs',
    // +1 le 2026-09-23 (#1739) : la sonde des titres d'entrée, ACQUISE par l'import de son banc — elle
    // lit le PDF dans un dossier `mkdtempSync` d'os.tmpdir(), et son `--json` refuse tout chemin sous
    // le dépôt ; le banc n'appelle que ses fonctions PURES sur des fixtures, l'arbre n'est jamais écrit.
    'scripts/raw/sonde-titres.mjs',
    // +1 le 2026-09-24 (#1739) : la réparation des titres d'entrée, ACQUISE par l'import de son banc —
    // son unique `writeFileSync` vit dans `main()`, derrière `isMain` ET `--apply` ; le banc n'appelle
    // que son cœur PUR (`reparerLivre`, `infidelite`) sur un livre forgé en mémoire.
    'scripts/raw/reparer-titres.mjs',
  ],
  'raw:check-refs': [],
  // +1 le 2026-09-11 (#925) : la gate enchaîne `citation-graphy-guard.mjs`, qui IMPORTE
  // `fieldBlockMask` de `build-implemente.mjs` (frontière du bloc de champ généré, source unique) ;
  // la réécriture des fiches de ce module vit derrière sa porte `isMain` (build-implemente.mjs:670).
  // Mesure du 2026-09-11 (`scripts/docs/lib/enregistreur-lectures.mjs` en `--import` sur le CLI) :
  // 4 137 lectures, ZÉRO écriture.
  'raw:check-code-refs': ['scripts/raw/build-implemente.mjs'],
  // La garde des renvois d'ancre de l'Atlas (#1824) n'atteint AUCUN module écrivain : elle lit les
  // pages, calcule leurs ancres et rend son verdict — l'outil qui répare vit à côté
  // (scripts/raw/reparer-ancres.mjs), et c'est LUI qui importe la garde, jamais l'inverse.
  'raw:check-ancres': [],
  // +1 le 2026-09-19 (#1825 lot B) : même module, même porte — la gate ne passe pas
  // `--ecrire-stock`, elle COMPARE le stock à sa mesure et ne touche à rien.
  'raw:check-folio-continuity': ['scripts/raw/check-folio-continuity.mjs'],
  // +1 le 2026-09-14 (#1384 B1) : la gate neuve est le détecteur des tables cassées de `Source/`,
  // qui porte UN `writeFileSync` — la régénération de son stock nominatif, fermée par la porte
  // `--ecrire-stock` (check-source-tables.mjs:194) que ci.yml ne passe pas ; déclarée en
  // `ecritFerme` sur `scripts/raw/source-tables-stock.json` (ECRIT_LU, scripts/gates/toutes.mjs).
  'raw:check-source-tables': ['scripts/raw/check-source-tables.mjs'],
  // +1 le 2026-09-14 (#1739 H-0) : la gate neuve est le détecteur du FORMAT des extractions, qui
  // porte UN `writeFileSync` — la régénération de son stock nominatif, fermée par la porte
  // `--ecrire-stock` (check-source-format.mjs:396) que ci.yml ne passe pas ; déclarée en
  // `ecritFerme` sur `scripts/raw/source-format-stock.json` (ECRIT_LU, scripts/gates/toutes.mjs).
  'raw:check-source-format': ['scripts/raw/check-source-format.mjs'],
  // +1 le 2026-09-21 (#1820 R4) : la gate neuve est le détecteur des PUCES lues comme un jeton, qui
  // porte UN `writeFileSync` — la régénération de son stock nominatif, fermée par la porte
  // `--ecrire-stock` (check-source-puces.mjs:159) que ci.yml ne passe pas ; déclarée en
  // `ecritFerme` sur `scripts/raw/source-puces-stock.json` (ECRIT_LU, scripts/gates/toutes.mjs).
  'raw:check-source-puces': ['scripts/raw/check-source-puces.mjs'],
  // +1 le 2026-09-25 (#1393 lot 1) : la gate neuve est la garde des renvois « page N », qui porte UN
  // `writeFileSync` — la régénération de son stock nominatif, fermée par la porte `--ecrire-stock`
  // (check-renvois.mjs:89) que ci.yml ne passe pas ; déclarée en `ecritFerme` sur
  // `scripts/raw/renvois-stock.json` (ECRIT_LU, scripts/gates/toutes.mjs).
  'raw:check-renvois': ['scripts/raw/check-renvois.mjs'],
  'raw:reanchor': ['scripts/docs/lib/empreinte-sources.mjs', 'scripts/raw/reanchor.mjs'],
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

test('la sonde n’est pas AVEUGLE : elle voit les écrivains connus, et ignore les lecteurs purs', () => {
  const mesure = ecrivainsParGate(RACINE)
  // Trois vérités indépendantes, chacune vérifiable à la main.
  assert.ok(
    mesure['raw:coverage'].includes('scripts/docs/lib/empreinte-sources.mjs'),
    '`ecrireDoc` est le seam par lequel raw:coverage écrit docs/raw/coverage.md',
  )
  assert.ok(
    mesure['test:hooks'].includes('scripts/hooks/new-src-file-guard.test.mjs'),
    'le cas fondateur (un test qui écrit un registre de garde) doit rester visible',
  )
  assert.deepEqual(mesure.typecheck, [], '`tsc --noEmit` n’atteint aucun module écrivain')
  assert.deepEqual(mesure.lint, [], '`eslint` sans `--fix` n’atteint aucun module écrivain')
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

test('un import de TYPE seul n’entre pas au corpus, un import mixte y entre', () => {
  assert.equal(sansImportsDeType("import type { A } from './a'\n").trim(), '')
  assert.equal(sansImportsDeType("export type { A } from './a'\n").trim(), '')
  assert.equal(sansImportsDeType("import { type A, type B } from './a'\n").trim(), '')
  assert.equal(sansImportsDeType("import { type A, b } from './a'"), "import { type A, b } from './a'")
  assert.equal(sansImportsDeType("import { a } from './a'"), "import { a } from './a'")
  // `renvoi.ts` n'importe `valeurs.ts` que pour le TYPE `SourceRef`, et `decoupe.ts` pour du code.
  const corpus = transitif(['src/data/source/renvoi.ts'], RACINE)
  assert.ok(corpus.includes('src/data/source/decoupe.ts'))
  assert.ok(!corpus.includes('src/data/schemas/grammaire/valeurs.ts'))
})
