#!/usr/bin/env node
// `npm run gates` (#1776) — REJEU LOCAL des gates de `ci.yml`, en LANES PARALLÈLES, avec le verdict
// de chacune DANS L'ORDRE DE `ci.yml`. C'est un confort de diagnostic, jamais une porte : la porte
// est le run CI, sur la branche puis sur le commit de la file de fusion par laquelle seule `main`
// avance (ruleset `main`, `scripts/ops/ruleset-main.mjs`).
//
// `--serie` change le MUR, jamais le VERDICT : il joue exactement les mêmes gates en une lane
// unique, dans l'ordre de ci.yml (morsure d'équivalence, `scripts/gates/toutes.test.mjs`). Une
// machine qui ne porte pas les lanes (`lanesPortees`) joue en série sans qu'on le demande.
// `--gates a,b` n'en joue que celles-là — c'est ainsi qu'on rejoue le rouge d'un run CI sans
// repayer les vingt autres.
//
// TROIS PHASES, et l'ordre est la garantie :
//   1. `npm run gen` — `build`, la suite et `docs:build` produisent les cibles de CODE depuis plusieurs
//      lanes : produites ici, elles ne se réécrivent plus.
//   2. les LANES, qui ne contiennent que des LECTEURS (ce qu'une gate écrit encore est FERMÉ par sa
//      porte, `ecritFerme`).
//   3. le RÉSUMÉ, puis la photo de l'arbre. Dans cet ordre : un résumé est ce qu'on vient de payer,
//      il s'imprime AVANT tout ce qui pourrait encore échouer.
//
// UN ROUGE NE COUPE RIEN (#1772) : la tête doit être verte sur TOUTES les gates, donc ce qu'un rouge
// ferait sauter serait payé au passage suivant. Une gate rouge pose son verdict, fait rendre 1 au
// run, et les lanes continuent : le résumé rend TOUS les rouges de la tête en un seul mur. Un
// prérequis absent est un rouge comme un autre : il ne concerne que la gate qui LIT ce chemin
// (chacune teste les SIENS). Seul un signal arrête le run : les arbres en cours sont tués, aucun
// verdict de plus ne serait juste.
//
// SOUS CHARGE, UN PROCESSUS PEUT NE PAS DÉMARRER : le 2026-09-04, quatre lanes en parallèle ont fait
// rendre `3221225794` (STATUS_DLL_INIT_FAILED) au loader Windows sur quatre spawns d'un même run —
// `docs:check` ROUGE à 48,6 s, `build` ROUGE sans une ligne d'erreur, 47 tests de la suite en
// `expected 3221225794`. Tout spawn passe donc par `scripts/guards/lib/spawnResilient.mjs`, qui
// REJOUE ce cas-là (et lui seul) ; le nombre de rejeux est imprimé au résumé — c'est LE compteur de
// pression, la mémoire système ne discriminant rien (100 % à 15 workers comme à 9).
//
// AUCUN VERROU : ce lanceur ne prend rien et n'attend personne. Ce qu'il rend est un DIAGNOSTIC
// local ; deux runs concurrents se gênent, et c'est au lanceur de choisir son moment.
//
// `--liste` n'imprime que le plan (ce qui serait joué) sans rien jouer ; `--serie` joue tout en une
// lane ; `--gates a,b` restreint la liste.
import '../node-requis.mjs'
import { spawn, spawnSync } from 'node:child_process'
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { availableParallelism } from 'node:os'
import { join } from 'node:path'
import { enteteArbre } from '../guards/lib/enteteArbre.mjs'
import { LANE_LOCALE_DE_JOB, gatesDeCi } from './gatesDeCi.mjs'
import {
  compterRejeux,
  execFileResilient,
  reessayerAuChargement,
  rejeux,
} from '../guards/lib/spawnResilient.mjs'
import { codeEnfant } from '../test/partition.mjs'
import { PEREMPTION_MS, purgerPerimes } from '../guards/lib/purgerPerimes.mjs'
const RACINE = fileURLToPath(new URL('../..', import.meta.url))

/**
 * Ce que chaque gate ÉCRIT et LIT dans l'ARBRE, MESURÉ (sonde d'écritures transitives sur les
 * scripts atteints par la commande de `ci.yml`, 2026-09-04 ; chaque ligne re-vérifiée à la source).
 * Repassée le 2026-09-08 (#1709 E) à l'ENREGISTREUR DE LECTURES (`scripts/docs/lib/enregistreur-lectures.mjs`
 * posé en `--import` sur la commande de chaque gate) : `lit` déclare aussi le CODE que la
 * gate exécute — le changer change son verdict, donc c'est une lecture. Angles morts de la sonde,
 * nommés : ce qu'un sous-processus NON-node lit (`git ls-files` de src/source-hygiene-guard.test.ts,
 * `tsc`/`eslint` binaires) lui échappe, et un chemin RELATIF écrit par un enfant dont le `cwd` est un
 * dépôt jetable lui apparaît sous la racine (vérifié fichier par fichier avant d'être écrit ici).
 * C'est cette table, et rien d'autre, qui autorise deux gates à tourner EN MÊME TEMPS : un écrivain
 * et son lecteur dans deux lanes différentes, c'est un lecteur sur un fichier à moitié écrit.
 * Un chemin qui finit par `/` désigne le dossier et tout ce qu'il contient.
 * Ce qui vit HORS de l'arbre n'est pas déclaré : `node_modules/.cache/…` est nommé par PID, `dist/`
 * n'est lu par aucune gate, et les fixtures de test se fabriquent sous `os.tmpdir()`.
 *
 * `prerequis` (optionnel) dit ce que la gate exige d'AVOIR sous la racine pour mesurer quoi que ce
 * soit, et la commande qui le pose : sans lui, elle rend l'erreur brute de son outil, qui ne nomme
 * ni ce qui manque ni ce qu'il faut lancer. Ce que le contrôle prouve : l'ABSENCE FRANCHE du
 * chemin, rien d'autre — un `server/node_modules` présent mais VIDE ou PÉRIMÉ passe, et la gate
 * rend de nouveau son erreur brute ; la fraîcheur des dépendances n'est mesurée nulle part ici.
 *
 * DEUX champs d'écriture, et la différence est le sujet : `ecrit` = ce que la gate écrit à CHAQUE
 * run — interdit à toute autre lane de le lire ; `ecritFerme` = un chemin que la gate PEUT écrire,
 * avec la PORTE qui ferme le cas, nommée au chemin (jamais à la gate). Aucune écriture n'est
 * effacée de la table pour faire passer une lane : elle change de champ, en disant pourquoi.
 */
export const ECRIT_LU = {
  'agents:check': {
    ecrit: [],
    lit: ['.claude/', '.agents/', '.codex/', 'AGENTS.md', 'CLAUDE.md', 'scripts/agents/'],
    raison:
      'mode `check` : `runCompat` n’écrit que sous `mode === "sync"` (`runCompat`, scripts/agents/compat-cli.mjs) ; ' +
      'les 48 lectures mesurées sont les DEUX côtés de la compat — .claude/ (source) et .agents/ + .codex/ + ' +
      'AGENTS.md + CLAUDE.md (miroirs comparés), plus son propre code',
  },
  'test:agents': {
    ecrit: [],
    lit: ['.claude/', '.codex/', 'scripts/agents/', 'scripts/hooks/', 'AGENTS.md', 'CLAUDE.md'],
    raison:
      'les écritures sont INJECTÉES et comptées, jamais faites (`atomicWrite` injecté, scripts/agents/compat.test.mjs) ; ' +
      'LIT les DEUX côtés de la compat sur l’arbre RÉEL, racine `new URL("../../", import.meta.url)` — ' +
      '.claude/settings.json et .codex/hooks.json, CLAUDE.md (contrat sur la ligne `@.claude/credo.md`) ' +
      'et AGENTS.md — sonde `fs` du 2026-09-16 sur `node --test scripts/agents/compat.test.mjs` ; LIT ' +
      'scripts/hooks/ depuis le 2026-09-28 (#2125) : les déclarations de hooks dérivent des registres, que ' +
      '`chargerRegistres` (scripts/agents/compat-cli.mjs) importe',
  },
  'test:hooks': {
    ecrit: [],
    ecritFerme: {
      '.claude/logs/new-src-guard-skips.log':
        'journal d’urgences du garde de nouveaux fichiers (`JOURNAL`, scripts/hooks/new-src-file-guard.mjs, écrit par ' +
        'scripts/hooks/repartiteur.mjs) : il est ' +
        'GITIGNORÉ (motif `.claude/*` de .gitignore, sans négation pour `logs/`), donc il n’entre dans aucune des ' +
        'deux clés de contenu et ne salit pas l’arbre ; aucune gate ne le lit',
    },
    lit: [
      '.claude/', '.codex/', '.github/workflows/', 'docs/', 'public/', 'scripts/', 'server/', 'src/', 'Source/',
      'CLAUDE.md', 'eslint.config.js', 'knip.json', 'package.json', 'package-lock.json', 'tsconfig.json',
      'kill-pid.mjs', 'knip-exports-baseline.json', 'vite.config.ts',
    ],
    raison:
      'le registre d’écrans que `new-src-file-guard.test.mjs` éprouve est INJECTABLE (`WFRP_REGISTRE_ECRANS`, ' +
      '`cheminRegistre` de scripts/hooks/new-src-file-guard.mjs) et le test en écrit une COPIE sous os.tmpdir() ; ' +
      'le reste des fixtures vit sous os.tmpdir() ; `guards/lib/versionsDerivees-collision.test.mjs` écrit ses ' +
      'trois cas Git dans une instance jetable : `canoniser` et `relatifSousRacine` prouvent os.tmpdir() hors ' +
      'de la racine avant `instanceDeDepot`, puis l’instance et le fichier écrit hors arbre ; le finally ' +
      'supprime l’instance et exige son absence. TMP/TEMP dans la racine est refusé avant création ; ' +
      'LIT src/ massivement (3 888 chemins) — les gardes de la ' +
      'gate balaient l’arbre réel (stocks nominatifs, garde des nouveaux fichiers, budget de contexte) ; ' +
      'LIT docs/ sur deux sites : le listing de docs/raw, et docs/.sources-lues.json (banc de ' +
      'scripts/git-hooks/, sélection de `docs-rebuild.mjs`) ; ' +
      'LIT Source/ parce que `idempotence-ordre-des-cles.test.mjs` copie le corpus (Source/ moins les ' +
      '`.pdf`, écartés par extension : sans les extractions quatre migrations sortent 1 faute de livres) sous ' +
      'os.tmpdir() avant de rejouer les 89 migrations — cette copie passe par `cpSync`, que l’enveloppe de la ' +
      'sonde n’enregistre pas : la déclaration tient de la LECTURE du code, et une sur-déclaration ne peut ' +
      'que RESSERRER les lanes ; LIT .codex/hooks.json et .claude/settings.json ' +
      '(parité des canaux), .github/workflows/ci.yml, CLAUDE.md, eslint.config.js et package.json — ' +
      'sonde 2026-09-14 (#1759, après le départ d’`enregistreur-lectures.test.mjs` vers test:docs), ' +
      '4 425 chemins lus ; +4 chemins la même sonde (public/, server/, knip.json, package-lock.json) : ' +
      '`stocks-nominatifs.test.mjs` (test « périmètre — tout JSON suivi dont la FORME est un stock … ») dérive les stocks OUBLIÉS par la FORME — il prend TOUT `.json` ' +
      'suivi par git (`git ls-files --cached -- *.json`), saute les porteurs connus et PARSE le reste, ' +
      'donc public/qc/*.json, server/package.json, server/package-lock.json, server/tsconfig.json, ' +
      'knip.json et package-lock.json ; il n’en écrit aucun, et aucune gate n’écrit sous public/ ni server/ ; ' +
      '+1 écrivain le 2026-09-18 (#1813) : `modulesFeuilles.test.mjs` fabrique l’arbre jetable où il éprouve ' +
      'les graphies d’import qui atteignent une FEUILLE (`mkdtempSync` sous os.tmpdir(), `rmSync` en finally) — ' +
      'sonde `git status --porcelain` avant/après identique, et aucun résidu dans os.tmpdir() ; ' +
      '+1 écrivain le 2026-09-20 (#1825) : `guards/lib/jouer-workflow.test.mjs` écrit ses scripts ' +
      'JOUETS sous `mkdtempSync` de os.tmpdir() (`rmSync` en finally) — l’enveloppe qu’il éprouve charge un ' +
      'FICHIER, et l’arbre n’est jamais écrit ; +2 écrivains le 2026-09-22 (#1873) : ' +
      '`migrations/lib/1825-stocks-atlas-chemins-par-coeur.test.mjs` forge son dépôt sous `mkdtempSync` de ' +
      'os.tmpdir() (`rmSync` en `t.after`) et y joue la migration par `migrations/lib/joue.mjs`, qui COPIE la ' +
      'migration dans ce dépôt (`copyFileSync`) — sonde `git status --porcelain` avant/après identique, et ' +
      'aucun résidu dans os.tmpdir() ; +1 écrivain le 2026-09-23 (#1897) : `migrations/lib/joue.test.mjs` ' +
      'réécrit (`writeFileSync`) les fichiers du dépôt jetable de `joue.mjs:depot` (`mkdtempSync` de ' +
      'os.tmpdir(), `efface` en `t.after`) pour faire mordre `crees`/`rienTouche` — sonde `git status ' +
      '--porcelain` avant/après identique, et aucun résidu `migr-` dans os.tmpdir() ; +1 lecture le 2026-09-23 (#1739) : la garde du dépôt ' +
      '`guards/lib/pdfHorsCouture.test.mjs` LIT tout fichier de code et tout JSON de configuration, suivi ou ' +
      'non indexé — son banc exige que chaque racine de `racinesBalayees` soit couverte par ce `lit` ' +
      '(kill-pid.mjs, knip-exports-baseline.json, vite.config.ts) ; +1 écrivain le 2026-09-27 (#1806) : ' +
      '`git-hooks/docs-rebuild.test.mjs` pose une cale `git` (`mkdtempSync` + `writeFileSync` sous ' +
      'os.tmpdir(), `rmSync` en finally) sur le dépôt jetable de `instanceDeDepot` — sonde ' +
      '`git status --porcelain` avant/après identique, et aucun résidu dans os.tmpdir() ; +3 écrivains le ' +
      '2026-09-30 (#2132) : `hooks/suivi-lien-guard.test.mjs` et `hooks/inject-suivi.test.mjs` forgent un dépôt ' +
      'jetable (`instanceDeDepot`, sous os.tmpdir(), `rmSync` en finally), et le second y écrit `.git/suivi` ' +
      '(suivi et journal `.journal`) ; `ops/suivi.mjs`, que le lien de session importe, n’écrit que derrière sa porte ' +
      '`import.meta.main` — sonde `git status --porcelain --ignored` avant/après identique, sur le worktree et ' +
      'sur l’arbre principal ; +2 écrivains le 2026-10-04 (#2278) : ' +
      '`mods/verifier.test.mjs` forge ses mods sous `mkdtempSync` de os.tmpdir() (`rmSync` en `t.after`), et ' +
      '`mods/verifier.mjs`, qu’il importe, copie sous un `mkdtempSync` de os.tmpdir() effacé en finally',
  },
  'mods:check': {
    ecrit: [],
    lit: ['.claude/skills/', 'scripts/mods/', 'scripts/guards/lib/lister.mjs', 'scripts/guards/lib/spawnResilient.mjs', 'src/lib/tableTotale.ts', 'src/lib/ordre.mjs'],
    raison:
      'découvre les mods sous .claude/skills/ (`racinesDeMods`, scripts/mods/racines.mjs, par `listerDossier` de ' +
      'scripts/guards/lib/lister.mjs, qui réexporte src/lib/ordre.mjs), compose ses env par `tableTotale` (src/lib/tableTotale.ts) et lance par l’hôte ' +
      'de processus (scripts/guards/lib/spawnResilient.mjs) ; chaque ' +
      'mod est COPIÉ, sans les artefacts du moteur, sous `mkdtempSync` de os.tmpdir() : `claude plugin validate --strict`, ' +
      '`claude -p` qui y pose ses types, `tsc --project <copie>` (noEmit du tsconfig posé par le moteur) et ' +
      '`claude plugin test` portent sur la COPIE ; le temporaire est effacé en finally (scripts/mods/verifier.mjs). ' +
      'Le CLI vit hors de l’arbre (PATH, ou cache npm de `npx`)',
  },
  'livraison:plage': {
    ecrit: [],
    lit: ['.claude/soldes/', 'scripts/guards/livraison-plage.mjs', 'scripts/guards/lib/', 'scripts/node-requis.mjs', 'scripts/port-dev.mjs', 'src/lib/coupeAuMot.mjs', 'package.json'],
    raison:
      'aucune écriture : la porte de publication (#2328, scripts/guards/lib/livraison.mjs) lit l’HISTOIRE par git — ' +
      'le graphe de `merge-base origin/main..HEAD`, le patch de chaque fusion contre sa fusion automatique ' +
      '(`merge-tree --write-tree`, dont les objets inaccessibles vont à l’odb, jamais à l’arbre), le journal ' +
      'des messages, et les soldes `.claude/soldes/ref-<N>.md`, `<N>.md` de HEAD ; LIT son code, la porte de ' +
      'version de Node (`engines` de package.json) et ce qu’importe l’hôte git (scripts/port-dev.mjs, src/lib/coupeAuMot.mjs)',
  },
  'test:ops': {
    ecrit: [],
    lit: ['src/', 'scripts/', 'eslint.config.js', 'kill-pid.mjs', '.claude/workflows/', '.claude/agents/', '.github/workflows/', 'knip.json', 'knip-exports-baseline.json'],
    raison:
      'aucun module atteint n’écrit DANS l’arbre (la liste des écrivains atteints vit au cliquet ' +
      '`ecrivainsAtteints.test.mjs`, pas ici) : les bancs écrivent sous os.tmpdir() — leurs dossiers de ' +
      '`mkdtempSync`, ou les dépôts jetables de `depotGabarit.mjs`, dont toutes les écritures visent ' +
      'os.tmpdir() —, et un module dont l’écriture réelle vise un autre lieu la tient derrière sa porte ' +
      '`import.meta.main`. Les cas qui demandent une explication : `knip-exports-ratchet.mjs` (seul ' +
      '`--sync`, sous la porte de `main()`, écrirait la baseline), `ruleset-main.mjs` (le corps du ruleset ' +
      'part par un fichier de os.tmpdir(), depuis `executer`, que les tests n’appellent jamais), ' +
      '`faits-de-palier.mjs` (le JSON des faits va à `--sortie`, sous os.tmpdir() par défaut — ' +
      '`sortieParDefaut`) et `suivi.mjs` (il écrit `.git/suivi/<N>.md`, dans le répertoire git COMMUN et ' +
      'non dans l’arbre, sous sa porte ; ses tests lui passent un dossier de `mkdtempSync`), et `test/verrou.mjs` ' +
      'qu’il atteint (+1 écrivain le 2026-10-05, #2279 : le verrou `.<N>.md.verrou` voisin du suivi, son temporaire et sa reprise, dans ce même ' +
      'dossier, sous cette même porte, et sous `mkdtempSync` en test) ; ' +
      '`reprendre-file.mjs` ne peut ajouter au résumé GitHub que sous sa porte CLI ' +
      '`import.meta.main` ET si `GITHUB_STEP_SUMMARY` est défini ; ' +
      'le runner fournit ce fichier hors du dépôt, et le banc CLI le remplace par un fichier de ' +
      '`mkdtempSync` sous os.tmpdir(), avec événement CI rouge, configuration GitHub temporaire et tokens GitHub vides, sans API ni écriture dans l’arbre ; ' +
      'LIT .github/workflows/ parce que `CHEMIN` de `canari.test.mjs` et le test « les contextes se LISENT ' +
      'dans le ci.yml réel » de `ruleset-main.test.mjs` lisent les workflows RÉELS, et ' +
      'scripts/guards/lib/ par le stock de `fermetures-non-citees.mjs` ; LIT tout fichier JavaScript suivi ' +
      'ou à suivre (`git ls-files -co --exclude-standard` : scripts/, .claude/workflows/, eslint.config.js, ' +
      'kill-pid.mjs), que la porte `workflows.test.mjs` parse pour y RECONNAÎTRE les scripts de workflow et ' +
      'les bancs qui importent `jouer-workflow.mjs` (`reconnaissanceDuDepot`, `bancsDeWorkflowDuDepot`), sans ' +
      'processus fils ; LIT .claude/agents/ (le cliquet d’EXCEPTIONS_MECANIQUES exige `.claude/agents/<type>.md`) ; ' +
      '`workflows-joues.test.mjs` joue les scripts de .claude/workflows/ EN PLACE, sur l’arbre réel ; ' +
      'scripts/hooks/ est lu par `validateRevuePalier` (solde-ticket-guard.mjs), sans rien y écrire ; LIT ' +
      'knip.json (le cliquet d’exports le relit). ' +
      'Ce que `soldesSuivis()` lirait de .claude/soldes/ n’est atteint que par le `main()` du script, ' +
      'gardé par `import.meta.main` (fermetures-non-citees.mjs) : les tests passent leurs ' +
      'PROPRES dépôts jetables, et la sonde n’a mesuré aucune lecture sous .claude/soldes/ ; ' +
      '+1 écrivain le 2026-09-18 (#1813) : `plageFermante.test.mjs` prend ses dépôts jetables à ' +
      '`instanceDeDepot` (os.tmpdir()) et y pose `.claude/soldes/42.md` avant de commiter — lire une plage ' +
      'et le solde qu’un commit emporte exige de VRAIS commits ; `rmSync` en finally, et sonde ' +
      '`git status --porcelain` avant/après identique sur l’arbre du dépôt',
  },
  'test:runner': {
    ecrit: [],
    lit: ['scripts/', 'package.json', '.npmrc', '.claude/settings.json', '.codex/hooks.json'],
    raison:
      'chaque cas fabrique son arbre sous os.tmpdir() (`mkdtempSync`), y compris son node_modules/.cache ; ' +
      'LIT package.json (les scripts que le runner relaie) et .npmrc (copié par scripts/node-requis.test.mjs ' +
      'dans son faux arbre, le 2026-09-24, #1801), et les deux configurations de hooks d’agent ' +
      '(.claude/settings.json, .codex/hooks.json : scripts/node-requis.test.mjs y lit les modules lancés, ' +
      'le 2026-09-27, #1801) ; +1 écrivain le 2026-10-05 (#2279 N0) : `test/verrou.test.mjs` fait se disputer ' +
      'le verrou par des processus réels sous un `mkdtempSync` de os.tmpdir() (`rmSync` en finally)',
  },
  'test:docs': {
    ecrit: [],
    lit: [
      'docs/', 'src/', '.claude/memory/', 'scripts/docs/', 'scripts/guards/lib/', 'scripts/test/partition.mjs',
      'scripts/lancer-local.mjs', 'scripts/outillage-local.mjs', 'scripts/port-dev.mjs', 'CLAUDE.md',
      'scripts/raw/', 'scripts/gen-registry.mjs', 'Source/',
    ],
    raison:
      'fixtures sous os.tmpdir() ; `build-passifs.test.mjs` crée ses instances jetables après avoir prouvé ' +
      'os.tmpdir() hors racine canonique par `canoniser` et `relatifSousRacine`, puis exige l’instance hors ' +
      'arbre ; son finally supprime l’instance et exige son absence. TMP/TEMP dans la racine est refusé ' +
      'avant `instanceDeDepot` ; lit les docs et la mémoire RÉELS (les gardes de liens et de références les ' +
      'parcourent en place) ' +
      'et scripts/guards/lib/ (`check-plans-anchors.test.mjs` lit le code de `lister.mjs` et importe ' +
      '`depotGabarit.mjs`), sans rien y écrire ; LIT les trois modules du lanceur local que `build-all.mjs` ' +
      'ramène (sonde 2026-09-08, 50 lectures) ; LIT src/ et docs/ : ' +
      '`enregistreur-lectures.test.mjs`, avec sa racine `scripts/docs`, joue de VRAIS ' +
      'générateurs en `--check` (build-index-moteur, build-donnees, build-structures) sur l’arbre réel — ils ' +
      'COMPARENT sans écrire, et leurs lectures passent par la sortie de mesure du test, sous os.tmpdir() ; ' +
      'LIT CLAUDE.md sur l’arbre RÉEL : `routingTableSlice` (manual-docs-ratchet.test.mjs) ancre la table de routage ' +
      '(`## Table de routage`) et `routedFlatDocs` en dérive les docs à plat atteignables ; LIT scripts/raw/, ' +
      'scripts/gen-registry.mjs et Source/ (#2203) : `citations-rendues.test.mjs` rend chaque cible ' +
      '(`rendreCible` ; build-all.mjs importe gen-registry.mjs et scripts/raw/), et ses générateurs lisent ' +
      'l’Atlas et Source/ — rien n’est écrit',
  },
  'deps:unused': {
    ecrit: [],
    lit: [
      'src/', 'scripts/', 'server/', 'docs/', 'Source/', 'package.json', 'knip.json', 'knip-exports-baseline.json',
      'tsconfig.json', 'vite.config.ts', 'eslint.config.js', 'index.html', '.gitignore', 'CLAUDE.md',
    ],
    raison:
      'knip et le cliquet LISENT ; la baseline ne s’écrit que sous `--sync`, absent de la commande de ci.yml ; ' +
      'LIT docs/ et Source/ — la passe knip OUVRE docs/charte-ui.md, docs/donnees.md et les trois chapitres ' +
      'Source/ que des tests adressent en tête de module (Psychologie, Aux Armes ANNEXE III, Artefacts ' +
      'magiques) : deux passes d’enregistreur, même ensemble de 5 (2026-09-08) — c’est cette lecture-là ' +
      'qui met la gate sous la clé COMPLÈTE',
  },
  'test:recette': {
    ecrit: [],
    lit: ['scripts/recette/', 'scripts/port-dev.mjs'],
    raison: 'le profil de navigateur et les captures vivent hors de l’arbre ; LIT le dériveur de port qu’il éprouve',
  },
  typecheck: {
    ecrit: [],
    lit: ['src/', 'scripts/', 'server/', 'tsconfig.json', 'package.json', 'vite.config.ts'],
    raison:
      '`tsc --noEmit --incremental false` : aucune sortie, aucun `.tsbuildinfo` ; LIT package.json et ' +
      'vite.config.ts (mesurés à la sonde, hors des deux racines de `include`)',
  },
  lint: {
    ecrit: [],
    lit: ['src/', 'scripts/', 'server/', 'eslint.config.js', 'package.json', 'kill-pid.mjs', '.claude/skills/'],
    raison:
      '`eslint .` sans `--fix` ni `--cache` ; LIT sa config à plat, package.json et le seul module de ' +
      'racine qu’il ramène — aucune lecture sous docs/ (sonde 2026-09-08, 4 009 lectures) ; sous .claude/, ' +
      'le seul périmètre du mur des mods (`GLOBS_DE_MOD`, eslint.config.js, #2278), sous .claude/skills/ : ' +
      'son `lit` chevauche `.claude/`, la gate n’est jamais sautée',
  },
  test: {
    ecrit: [],
    ecritFerme: {
      'src/':
        'le `buildStart` du plugin `registryGen` (vite.config.ts) lance `build-all.mjs --code`, qui n’écrit que si ' +
        'le rendu diffère (`ecrireDoc`, scripts/docs/lib/ecriture-derives.mjs) — `toutes.mjs` joue ' +
        '`npm run gen` avant toute gate, donc il ne reste rien à écrire',
    },
    lit: ['src/', 'server/src/', 'scripts/', 'docs/', 'Source/', '.gitattributes', 'vite.config.ts'],
    raison:
      'LIT scripts/ EN ENTIER, pas les seules racines `scripts/` de son `include` (racinesDeLaSuite.mjs) : ' +
      'les tests de `src/` IMPORTENT les porteurs de garde (`git grep "from \'../../scripts/"` : guards/lib, source, ' +
      'docs/lib, data/lib, qc/lib, raw, migrations, campagne, arene, gen-registry.mjs) ; ' +
      'LIT docs/ ET docs/raw/ (sonde `fs` du 2026-09-16, #1738) : la famille des ' +
      'CLIQUETS ET CONTRATS qui confrontent le code à un doc DÉRIVÉ (data-atlas-complete, ' +
      'index-moteur-ratchet, slots-contrat, structures-contrat, roll-seam-exclusivity-guard, ' +
      'scene-field-editability-guard, ui-ratchets, oversize-search-blindspot) — d’où la lane ' +
      'SÉPARÉE des trois écrivains de docs/raw ; AUCUNE lecture sous .claude/ ni de CLAUDE.md ' +
      '(même sonde) : les deux gardes documentaires qui les balayaient vivent ' +
      'en node:test (scripts/guards/lib/memoryLinks.test.mjs dans test:hooks, ' +
      'scripts/docs/manual-docs-ratchet.test.mjs dans test:docs) ; LIT Source/ (verbatims ' +
      'et résolution de prose : `CHAPITRE` de src/data/tavern-desc-verbatim.test.ts et de ' +
      'vdm-objets-maudits.test.ts, `AA_ANNEXE_III` de variants-integrity.test.ts, le cas « A — chaque ' +
      'adresse RÉSOUT » de prose-resolution.test.ts, `oversizeIn(\'Source\', …)` de ' +
      'src/oversize-search-blindspot.test.ts) ; LIT .gitattributes parce que le verdict de `nonLf` ' +
      '(src/source-hygiene-guard.test.ts) tient à la colonne `-text` que `git ls-files --eol` en tire',
  },
  build: {
    ecrit: [],
    ecritFerme: {
      'src/':
        'les cibles de CODE (`genererCode`, scripts/docs/build-all.mjs) sont produites AVANT toute gate ' +
        '(`npm run gen`, ci-dessous) : `ecrireOuVerifier` ne réécrit pas un rendu identique',
      'vite.config.ts.timestamp-':
        'Vite recompile sa config dans un module horodaté posé à côté d’elle, puis l’efface — mesuré ' +
        '(`vite.config.ts.timestamp-1788894628882-….mjs`, sonde 2026-09-08). LA PORTE : AUCUNE gate ne lit ' +
        'ce chemin — c’est un module que Vite écrit pour lui-même, sous un nom que le suffixe horodaté rend ' +
        'unique à chaque run, et il est gitignoré (.gitignore, section « Config de Vite recompilée »), donc ' +
        'il ne salit pas l’arbre. `ecrit` le dirait CHEVAUCHANT `vite.config.ts` (recouvrement par PRÉFIXE), ' +
        'que `test` et `typecheck` lisent depuis d’autres lanes : ce serait un faux conflit',
    },
    lit: ['src/', 'scripts/', 'Source/', 'tsconfig.json', 'vite.config.ts', 'package.json', 'index.html'],
    raison:
      '`gen && vite build` : le typage est jugé par la gate `typecheck` (step `npm run typecheck` de ci.yml, avant `build`), ' +
      '`build` juge que le bundle se construit, et `dist/` n’est lu par aucune gate ; LIT tsconfig.json ' +
      'parce que `transformWithOxc` de Vite 8.3.2 résout la configuration TypeScript pendant la transformation ' +
      'des modules (node_modules/vite/dist/node/chunks/node.js, `transformWithOxc` → `getTSConfigResolutionCache`) — l’alias `@`, lui, ' +
      'est déclaré dans `resolve.alias` de vite.config.ts ; LIT Source/ parce que le plugin ' +
      '`wfrp:prose-source` (scripts/source/prose-source-plugin.mjs) y résout la prose que les entrées ADRESSENT ' +
      '— la sonde du 2026-09-08 n’a compté AUCUNE lecture sous Source/ sur un build complet (2 056 lectures) : ' +
      'la déclaration reste, une sur-déclaration ne peut que RESSERRER les lanes ; LIT aussi index.html ' +
      '(l’entrée) et package.json',
  },
  'docs:build': {
    ecrit: [],
    ecritFerme: {
      'docs/':
        'les cibles PURES de `GENERATORS` ne sont pas commitées (#2203 A2) : leurs lecteurs les RENDENT ' +
        '(`rendreCible`, scripts/docs/build-all.mjs), jamais du disque ; un MIXTE (`injecte`) n’est réécrit que ' +
        'si son rendu diffère (`ecrireOuVerifier`), ce que `Arbre inchangé` refuse dans le même job',
      'src/':
        'les cibles de CODE sont produites AVANT toute gate (`npm run gen`, ci-dessous) : `ecrireOuVerifier` ' +
        'ne réécrit pas un rendu identique',
    },
    lit: ['docs/', 'src/', 'scripts/', 'Source/', '.claude/memory/'],
    raison:
      'chaque générateur de `GENERATORS` joué en écriture, puis les vérificateurs purs ; LIT Source/ ' +
      '(catalogues et rapports d’Atlas) et .claude/memory/ parce que `build-doctrines.mjs` dérive ' +
      '`docs/doctrines.md` des fiches `.claude/memory/user-*.md` SUIVIES par git (`fichesSuivies`)',
  },
  'test:raw': {
    ecrit: [],
    ecritFerme: {
      // Le GLOB, pas une page : l’écrivain tient le routeur de l’Atlas ET l’index de chaque cœur,
      // et la population des cœurs est DÉRIVÉE (#1825) ; un chemin de cœur écrit ici sous-déclarerait
      // dès le cœur suivant. Même glob qu’à sa déclaration de générateur (`injecte`,
      // scripts/docs/build-all.mjs).
      'docs/raw/**/00-index.md':
        '`build-atlas-index.test.mjs` IMPORTE l’écrivain des blocs des index de l’Atlas (cœurs du ' +
        'routeur, domaines de chaque cœur) ; son unique `writeFileSync` vit dans `main()`, sous sa ' +
        'porte `import.meta.main` (scripts/raw/build-atlas-index.mjs), et le banc n’appelle que ses fonctions ' +
        'PURES (`lignesDesCoeurs`, `lignesDesDomaines`, `blocsDeLAtlas`, `injecter`). Le cas `--check` ' +
        'le LANCE, mais dans un arbre JETABLE de `os.tmpdir()` dont il est le cwd : ce sont ces ' +
        'pages-là qu’il écrit, jamais celles du dépôt',
      // Le GLOB, pas un dossier : le re-coupeur sert TOUT livre à liste de découpe
      // (`scripts/raw/decoupes/<id>.json`), et recale tout stock nominatif keyé par ses fichiers.
      'Source/**/*.md':
        '`recouper-source.test.mjs` IMPORTE le re-coupeur des `.md` en service ; ses `writeFileSync` et ' +
        '`rmSync` vivent dans `main()`, sous sa porte `import.meta.main` (`main` de scripts/raw/recouper-source.mjs), ' +
        'et le banc n’appelle que son cœur PUR sur un livre FORGÉ en mémoire ; `reparer-mobilier.test.mjs` ' +
        'IMPORTE la réparation du mobilier de page (#1739), dont l’unique `writeFileSync` vit dans `main()`, ' +
        'derrière sa porte `import.meta.main` ET `--apply` (`main` de scripts/raw/reparer-mobilier.mjs) — le banc n’appelle ' +
        'que ses fonctions PURES (`reparer`, `infidelite`, `motsDe`, `niveauDesFreres`, `niveauDeLegende`, ' +
        '`texteDeBandeau`) sur des textes en mémoire ; `reparer-titres.test.mjs` IMPORTE la réparation des titres ' +
        'd’entrée (#1739), dont l’unique `writeFileSync` vit dans `main()`, derrière sa porte `import.meta.main` ET ' +
        '`--apply` (`main` de scripts/raw/reparer-titres.mjs) — le banc n’appelle que son cœur PUR (`reparerLivre`, ' +
        '`infidelite`) sur un livre forgé en mémoire',
      'scripts/raw/*-stock.json':
        'même porte, même module : le recalage des stocks nominatifs (`recalerStock`) rend un TEXTE, ' +
        'que le seul `main()` écrit derrière `import.meta.main` (`main` de scripts/raw/recouper-source.mjs)',
      // Le GLOB, pas une page : l’outil répare TOUTE page de l’Atlas dont un renvoi d’ancre est mort.
      'docs/raw/**/*.md':
        '`reparer-ancres.test.mjs` IMPORTE l’outil de réparation des renvois d’ancre (#1824) ; son unique ' +
        '`writeFileSync` vit derrière la porte `--apply` de `reparer` (scripts/raw/reparer-ancres.mjs), et ' +
        'le banc ne la passe que sur un Atlas JETABLE d’os.tmpdir() (`avecAtlasFixture`) dont il donne le ' +
        '`rawDir` — les pages du dépôt ne sont jamais écrites',
    },
    lit: ['docs/raw/', 'scripts/raw/', 'scripts/source/', 'scripts/guards/lib/', 'scripts/port-dev.mjs', 'Source/', 'src/', '.claude/agents/'],
    raison:
      'harnais de l’Atlas : il lit les fiches que les trois rapports écrivent ; éprouvant les scripts ' +
      'eux-mêmes, il LIT ce qu’ils lisent — Source/ et src/ ; ses deux bancs ' +
      'écrivains (`check-source-format.test.mjs`, `lib/marker-pages.test.mjs`) ne posent que des dossiers ' +
      'JETABLES sous `os.tmpdir()`, retirés par `rmSync` — aucune écriture dans l’arbre ; +3 écrivains le ' +
      '2026-09-20 (#1825) : `apply-livre.test.mjs` et `assemble-domain.test.mjs`, même régime ' +
      'os.tmpdir(), et `assemble-domain.mjs`, ACQUIS par l’import de son banc — ses `writeFileSync` vivent ' +
      'dans `assemble()`, appelée par le seul `main()`, sous sa porte `import.meta.main` ; +4 le 2026-09-20 ' +
      '(#1825) : la fabrique d’Atlas jetable (`atlasFixture.mjs`) et les deux bancs qui la ' +
      'prennent (`_lib.test.mjs`, `build-atlas-index.test.mjs`), même régime os.tmpdir(), et ' +
      '`build-atlas-index.mjs`, ACQUIS par l’import de son banc — son `writeFileSync` vit dans ' +
      '`main()`, sous sa porte `import.meta.main` ; +1 lecture le 2026-09-22 (#1873) : ' +
      '`atlas-domain.workflow.test.mjs` lit les fiches d’agent de .claude/agents/ (frontmatter `tools:`) ' +
      'pour tenir la liste des types SANS outil d’écriture (`typesEnLectureSeule` de scripts/raw/atlas-domain.workflow.test.mjs) — ' +
      'la gate n’est plus sautable : un push qui donne `Edit` à `lecteur` doit la jouer ; +1 écrivain le ' +
      '2026-09-23 (#1739) : `pdf-de.test.mjs`, même régime os.tmpdir() (`avecSource`) — son PDF et ses dossiers de sortie Marker ' +
      'factices ne naissent que sous la racine `source` INJECTÉE dans la couture (scripts/raw/_lib.mjs)',
  },
  'raw:check-refs': {
    ecrit: [],
    lit: ['docs/raw/', 'Source/', 'src/data/books.json', 'src/data/source/', 'src/lib/regex.ts', 'scripts/raw/', 'scripts/guards/lib/', 'scripts/port-dev.mjs'],
    raison:
      'aucune écriture dans les scripts atteints ; LIT le registre de livres et le normaliseur de références ' +
      '(src/data/books.json, src/data/source/normalize.ts) et son stock scripts/raw/dead-refs-stock.json, absent quand il est soldé',
  },
  'raw:check-code-refs': {
    ecrit: [],
    lit: ['docs/raw/', 'src/', 'Source/', 'scripts/raw/', 'scripts/guards/lib/', 'scripts/port-dev.mjs'],
    raison:
      'aucune écriture dans les scripts atteints ; LIT Source/, les stocks scripts/raw/dead-code-refs-stock.json et ' +
      'scripts/raw/empty-line-code-refs-stock.json, absents quand ils sont soldés, et scripts/raw/graphy-stock.json (sites différés)',
  },
  'raw:check-ancres': {
    ecrit: [],
    lit: ['docs/raw/', 'src/data/books.json', 'src/data/source/', 'src/lib/regex.ts', 'scripts/raw/', 'scripts/guards/lib/', 'scripts/port-dev.mjs'],
    raison:
      'aucune écriture, et AUCUN stock : l’ancre d’un titre se CALCULE (scripts/raw/lib/ancres.mjs), '
      + 'donc un renvoi mort est un renvoi faux, jamais un héritage à geler. LIT les pages de l’Atlas, '
      + 'le registre de livres (énumération des cœurs, `pagesDeLAtlas`) et l’extracteur de liens partagé '
      + '(scripts/guards/lib/liensMarkdown.mjs) ; l’outil qui répare (scripts/raw/reparer-ancres.mjs) '
      + 'écrit sous sa porte `--apply`, que la commande de .github/workflows/ci.yml n’appelle pas',
  },
  'raw:check-folio-continuity': {
    ecrit: [],
    lit: ['docs/raw/', 'Source/', 'src/data/books.json', 'src/data/source/', 'src/lib/regex.ts', 'scripts/raw/', 'scripts/guards/lib/', 'scripts/port-dev.mjs'],
    raison:
      'LIT le registre de livres, le normaliseur de références, ' +
      'le stock NOMINATIF des sauts de folio (scripts/raw/folio-gaps-stock.json) et les deux stocks des ancres ' +
      'sans contenu (scripts/raw/empty-folios-perdues-stock.json, scripts/raw/empty-folios-benignes-stock.json) ; ' +
      'aucune écriture n’est atteinte',
  },
  'raw:check-source-tables': {
    ecrit: [],
    lit: ['Source/', 'src/data/books.json', 'src/data/source/', 'src/lib/regex.ts', 'scripts/raw/', 'scripts/guards/lib/', 'scripts/port-dev.mjs'],
    raison:
      'LIT le registre de livres, le parseur de tables (src/data/source/decoupe.ts), les dossiers à `dir` de ' +
      'Source/ et son stock nominatif scripts/raw/source-tables-stock.json ; aucune écriture ' +
      'n’est atteinte',
  },
  'raw:check-source-puces': {
    ecrit: [],
    lit: ['Source/', 'src/data/books.json', 'src/data/source/', 'src/lib/regex.ts', 'scripts/raw/', 'scripts/guards/lib/', 'scripts/port-dev.mjs'],
    raison:
      'LIT le registre de livres, le normaliseur de citations (src/data/source/decoupe.ts), les dossiers ' +
      'à `dir` de Source/ et son stock nominatif scripts/raw/source-puces-stock.json ; aucune écriture ' +
      'n’est atteinte',
  },
  'raw:check-renvois': {
    ecrit: [],
    lit: ['Source/', 'src/data/books.json', 'src/data/source/', 'src/lib/regex.ts', 'src/data/hash.ts', 'scripts/raw/', 'scripts/source/', 'scripts/guards/lib/'],
    raison:
      'LIT le registre de livres, les chapitres des livres couverts par le lecteur fs (scripts/source/lecteur-fs.mjs), ' +
      'le résolveur PUR src/data/source/renvoi.ts et son stock nominatif scripts/raw/renvois-stock.json ; aucune ' +
      'écriture n’est atteinte',
  },
  'raw:check-source-format': {
    ecrit: [],
    lit: ['Source/', 'src/data/books.json', 'src/lib/regex.ts', 'scripts/raw/', 'scripts/source/nom-ascii.mjs', 'scripts/guards/lib/', 'scripts/port-dev.mjs'],
    raison:
      'LIT le registre de livres et les dossiers FR de Source/ (ceux à `dir` plus les ' +
      'pré-pipeline atteints par balayage), ainsi que son stock nominatif ' +
      'scripts/raw/source-format-stock.json ; aucune écriture n’est atteinte',
  },
  'server:typecheck': {
    ecrit: [],
    lit: ['server/'],
    prerequis: [{ chemin: 'server/node_modules', pose: 'npm --prefix server ci' }],
    raison:
      '`tsc` du sous-projet serveur, sans émission ; PRÉREQUIS : le sous-projet a ses PROPRES dépendances, ' +
      'posées par le step `npm --prefix server ci` de .github/workflows/ci.yml — sans elles `tsc` rend un TS2688 brut sur ' +
      '@cloudflare/workers-types, que rien ne rattache au dossier manquant',
  },
}

/**
 * PLAFOND de lanes du rejeu LOCAL. TROIS, et non quatre : la première exécution réelle (2026-09-04) a
 * fait rendre au loader Windows `STATUS_DLL_INIT_FAILED` sur quatre spawns concurrents. Une lane de
 * moins, c'est −25 % de processus simultanés au pire moment, pour un mur inchangé.
 */
export const PLAFOND_LANES = 3

/**
 * Les LANES du rejeu local, DÉRIVÉES de `ci.yml` : une lane par job de gates, ses gates dans l'ordre
 * du fichier (`job` de `gatesDeCi`, qui écarte déjà `JOBS_HORS_REJEU_LOCAL`) — sauf un job de
 * `LANE_LOCALE_DE_JOB` (scripts/gates/gatesDeCi.mjs), dont les gates rejoignent la lane qu'il nomme,
 * qui doit être celle d'un job de gates. Une lane est une SÉRIE ; les lanes tournent ensemble, sur une
 * machine qui les porte (`lanesPortees`). Elles ne portent que des LECTEURS, et la morsure
 * `conflitsEntreLanes` le verrouille.
 * Au-delà de `PLAFOND_LANES` lanes, REFUS nommé : aucun regroupement silencieux.
 *
 * QUI EST LE MUR : chaque run le mesure et l'imprime au résumé (`lanes : docs … · types … · suite …`),
 * et pose la durée de chaque gate dans `node_modules/.cache/gates/durees.json`.
 * PURE. REND `[{ nom, gates }]`.
 */
export function lanesDeCi(gates, laneDeJob = LANE_LOCALE_DE_JOB) {
  const propres = new Set(gates.map((g) => g.job).filter((job) => !(job in laneDeJob)))
  const parLane = new Map()
  for (const { nom, job } of gates) {
    const lane = laneDeJob[job]?.lane ?? job
    if (!propres.has(lane))
      throw new Error(
        `ci.yml : le job ${job} rejoint la lane ${lane} (LANE_LOCALE_DE_JOB, scripts/gates/gatesDeCi.mjs), ` +
          'qu’aucun job de gates de ci.yml ne porte',
      )
    if (!parLane.has(lane)) parLane.set(lane, [])
    parLane.get(lane).push(nom)
  }
  if (parLane.size > PLAFOND_LANES)
    throw new Error(
      `ci.yml porte ${parLane.size} jobs de gates (${[...parLane.keys()].join(', ')}) : le rejeu local en tient ` +
        `${PLAFOND_LANES} au plus (PLAFOND_LANES, scripts/gates/toutes.mjs) — rattache-le à une lane ` +
        '(LANE_LOCALE_DE_JOB, scripts/gates/gatesDeCi.mjs) avant d’ajouter un job',
    )
  return [...parLane].map(([nom, noms]) => ({ nom, gates: noms }))
}

/**
 * Plafond de durée par gate, en SECONDES : ×3 de la pire durée observée, jamais moins. Sans plafond,
 * une gate bloquée tient sa lane pour toujours — vécu : `server:typecheck` a rendu 0xC0000142 après
 * 33 434 s (9 h 17). Une gate EXPIRÉE est un ROUGE nommé, pas un silence.
 * Mesures de référence : pire gate hors `test` = `typecheck` 77,8 s (série du 2026-09-07 ; ×3 = 233,
 * largement sous les 600) ; `docs:build` 252,7 s sur un clone froid le 2026-09-30 (poste Windows de
 * 16 cœurs chargé, #2203) ; ×3 = 759 ;
 * `test` 339,2 s le 2026-09-26 (conteneur Linux de 4 cœurs, 3 workers, borne de tas 3 072 Mo, run
 * `mconf`) ; ×3 = 1 018.
 */
export const TIMEOUTS = { defaut: 600, test: 1020, 'docs:build': 760 }

/**
 * Cœurs servis à la SUITE pendant les lanes. Valeur mesurée le 2026-09-04 sur un poste de 16 cœurs
 * et 31,2 Go, suite SEULE et sans lane, workers SANS borne de tas :
 * `[diag] mémoire système max : 31.2 Go / 31.2 Go (100 %)` à 16 cœurs (node 10 + jsdom 5). À
 * saturation, ajouter des lanes ne rend pas du parallélisme, cela rend du swap — la suite se borne
 * donc par la couture qui existe déjà (`coeurs` de `scripts/test/partition.mjs`), jamais par une
 * seconde. À 10, `repartitionWorkers` sert node 6 + jsdom 3 : 9 workers au lieu de 15. Ce qui dit
 * le point d'équilibre est le compteur de spawns rejoués du résumé, et `worker perdu` du bloc
 * `[diag]` de la suite.
 * `capacite` (`scripts/test/partition.mjs`) borne aussi la suite par la mémoire disponible lue AU
 * LANCEMENT de la suite, avant que les lanes voisines n'allouent : aucune réserve n'est faite pour
 * elles (#2035). Sur un poste de 31,2 Go, `capacite` sert au plus 8 workers (node 5 + jsdom 3) : la
 * valeur 10 n'y mord qu'à partir de 35 306 Mo disponibles.
 * `WFRP_TEST_COEURS` posé par l'appelant PRIME — c'est par lui que la valeur se re-mesure.
 */
export const COEURS_SUITE_EN_LANES = 10

/**
 * La machine porte-t-elle les LANES ? La suite en prend `COEURS_SUITE_EN_LANES` : les autres lanes
 * n'ont de place qu'AU-DELÀ. Jusqu'à la borne, la suite prend la machine entière, et tout ce qui
 * tourne à côté d'elle ne rend plus un verdict mais une expiration. Mesuré le 2026-09-24 (#1801) sur
 * un conteneur Linux de 4 cœurs et 15,6 Go : la suite SEULE y monte à 14,9 Go (95 %, bloc `[diag]`
 * du run CI 35986843571, même gabarit) ; deux runs en lanes y ont fait EXPIRER `test`, `test:hooks`
 * et `build` (1 817 s pour `build`, 18 s seul) sous une pression mémoire pleine (PSI `full` à 90 %
 * sur 5 min). En deçà, le run est une SÉRIE, dite au journal.
 */
export const lanesPortees = (machine) => machine > COEURS_SUITE_EN_LANES

/** Dossier des sorties de gate : un fichier par gate et par PID (patron `scripts/test/run.mjs`). */
export const dossierSorties = (racine) => join(racine, 'node_modules', '.cache', 'gates')

/** Durées du dernier run, par gate — la mesure qui compose les LANES et pose les TIMEOUTS. */
const fichierDurees = (racine) => join(dossierSorties(racine), 'durees.json')

/** Nom de FICHIER de la sortie d'une gate : le nom de gate porte des `:`, que Windows refuse. */
export const fichierDeSortie = (gate, pid) => `${encodeURIComponent(gate)}-${pid}.txt`

/** Motif de nom d'une sortie de gate : `<segment>-<pid>.txt` (`fichierDeSortie`). */
const MOTIF_SORTIE = /-\d+\.txt$/


/**
 * PRÉREQUIS ABSENTS d'une gate : les entrées de son `prerequis` (ECRIT_LU) dont le `chemin`, relatif
 * à `racine`, n'existe pas. Une gate dont le prérequis manque ne mesure RIEN — elle rend l'erreur
 * brute de son outil, à la place de la commande qui pose ce qui manque.
 * REND `[{ chemin, pose }]`, vide quand tout est là (le cas courant : aucune lecture de plus).
 */
export const prerequisAbsents = (entree, racine) =>
  (entree?.prerequis ?? []).filter(({ chemin }) => !existsSync(join(racine, chemin)))

/** Ce qu'un refus de prérequis écrit dans la sortie de la gate — c'est cette queue que le résumé
 *  imprime, et le MÊME texte que la préflight de `scripts/ops/publier.mjs` rend AVANT la série. PURE. */
export const refusDePrerequis = (nom, absents) =>
  `${absents
    .map(({ chemin, pose }) => `[gates] ${nom} — prérequis absent : \`${chemin}\` (le pose : \`${pose}\`)`)
    .join('\n')}\n`

/** Deux chemins déclarés se RECOUVRENT quand l'un préfixe l'autre : une fiche de `docs/raw/` est
 *  sous `docs/`, donc l'écrire c'est écrire dans ce que lit quiconque lit `docs/`. */
const chevauche = (a, b) => a.startsWith(b) || b.startsWith(a)

/** Couples « une lane ÉCRIT ce qu'une AUTRE lit » — la liste doit être VIDE. Seul `ecrit` compte :
 *  un chemin passé en `ecritFerme` porte, AU CHEMIN, la porte qui ferme son cas. */
export function conflitsEntreLanes(lanes, ecritLu = ECRIT_LU) {
  const conflits = []
  for (const a of lanes)
    for (const b of lanes) {
      if (a.nom === b.nom) continue
      for (const ecrivain of a.gates)
        for (const lecteur of b.gates)
          for (const ecrit of ecritLu[ecrivain]?.ecrit ?? [])
            for (const lu of ecritLu[lecteur]?.lit ?? [])
              if (chevauche(ecrit, lu))
                conflits.push(`lane ${a.nom} : ${ecrivain} ÉCRIT ${ecrit} · lane ${b.nom} : ${lecteur} LIT ${lu}`)
    }
  return conflits
}

/**
 * Refus de COUVERTURE : gate de ci.yml sans entrée ÉCRIT/LU, ou dont `lit` est vide. La liste doit
 * être VIDE — une gate ajoutée à la CI ARRÊTE `npm run gates` tant qu'on n'a pas dit ce qu'elle écrit
 * et ce qu'elle lit. Où elle court, c'est son job de `ci.yml` qui le dit (`lanesDeCi`).
 */
export function refusDeCouverture(noms, ecritLu = ECRIT_LU) {
  const refus = []
  for (const nom of noms) {
    if (!ecritLu[nom]) refus.push(`${nom} : aucune entrée ÉCRIT/LU — la mesurer avant de la placer`)
    // `lit` NON VIDE, pas seulement l'entrée : c'est `lit` qui décide si la gate est sautable sur un
    // push documentaire (`gatesSautables`, scripts/gates/classerPush.mjs) — une gate sans lecture
    // mesurée jouerait toujours, en silence.
    else if (!ecritLu[nom].lit?.length)
      refus.push(`${nom} : entrée ÉCRIT/LU sans « lit » — mesure ce qu'elle lit, ou elle jouera sur tout push`)
  }
  return refus
}

/**
 * Le refus du VERROU DE SUITE (`scripts/test/verrou.mjs`) : quand une autre session joue déjà une
 * suite complète, `npm test` sort en 2 SANS avoir rien joué. Reconnu par sa SORTIE, jamais par le
 * code seul — un 2 est aussi ce que rend une invocation mal formée du lanceur.
 */
export const estRefusDuVerrou = (code, sortie) =>
  code === 2 && /^\[verrou\] (?:une suite complète tourne déjà|verrou disputé)/m.test(sortie)

/** Pas et borne de l'attente du verrou de suite. Au-delà, c'est un rouge : une suite qui n'a pas
 *  tourné ne justifie rien, et attendre sans fin ne le dirait jamais. */
export const ATTENTE_VERROU = { pasMs: 15_000, borneMs: 20 * 60 * 1000 }

/**
 * Tue l'ARBRE d'un enfant. Un `kill` sur le seul PID laisse vivre `npm`, `vitest` et leurs workers :
 * ils garderaient le verrou de suite et les cœurs après un Ctrl-C.
 *
 * LE GROUPE NE SUFFIT PAS, et c'est mesuré : `process.kill(-pid)` ne frappe que le groupe du fils,
 * or un descendant posé avec `detached: true` reçoit SON PROPRE groupe (`setsid`) et sort de portée.
 * Sous Windows le défaut ne se voyait pas — `taskkill /T` suit la FILIATION, pas la session — d'où un
 * vert local et un rouge sur la CI ubuntu (run 33866600011, `toutes.test.mjs` : « le PETIT-FILS écrit
 * encore »). Sur POSIX on énumère donc la descendance par `ps`, on tue les FEUILLES d'abord, puis le
 * fils, puis son groupe — ce dernier tir rattrapant tout processus né après l'instantané de `ps`.
 * Patron `tree-kill`, sans la dépendance. `lister`/`tuer`/`plateforme` sont injectés pour la mesure.
 */
export function tuerArbre(pid, { plateforme = process.platform, lister = listerProcessus, tuer = tuerUnPid } = {}) {
  if (!pid) return
  // `taskkill /T` suit la filiation PARENT-ENFANT, quelle que soit la session : rien à énumérer.
  if (plateforme === 'win32') {
    spawnSync('taskkill', ['/T', '/F', '/PID', String(pid)], { stdio: 'ignore' })
    return
  }
  // Feuilles d'abord, puis le fils, PUIS son groupe : un descendant tué avant son parent ne peut pas
  // être ré-adopté par init et survivre à la bataille.
  for (const descendant of descendantsDe(pid, lister())) tuer(descendant)
  tuer(pid)
  tuer(-pid)
}

/** Envoie SIGKILL à un pid (ou à un groupe, pid négatif). Un pid déjà mort n'est pas une erreur. */
function tuerUnPid(pid) {
  try {
    process.kill(pid, 'SIGKILL')
  } catch {
    /* déjà mort, ou hors de notre portée : le suivant tranchera */
  }
}

/** Table `pid ppid` de TOUS les processus (POSIX). Vide si `ps` manque : on retombe sur le groupe. */
function listerProcessus() {
  const ps = spawnSync('ps', ['-A', '-o', 'pid=,ppid='], { encoding: 'utf8' })
  return ps.stdout ?? ''
}

/**
 * Descendance TRANSITIVE de `pid` d'après une sortie `ps -A -o pid=,ppid=`, LES FEUILLES D'ABORD.
 * `vus` ferme les cycles que `ps` peut rendre (un processus dont le ppid est lui-même, ou 0 adopté
 * par 1) : sans lui, l'énumération ne s'arrêterait pas.
 */
export function descendantsDe(pid, sortiePs) {
  const enfantsDe = new Map()
  for (const ligne of String(sortiePs).split('\n')) {
    const m = /^\s*(\d+)\s+(\d+)\s*$/.exec(ligne)
    if (!m) continue
    const [fils, parent] = [Number(m[1]), Number(m[2])]
    if (!enfantsDe.has(parent)) enfantsDe.set(parent, [])
    enfantsDe.get(parent).push(fils)
  }
  const parGeneration = []
  const vus = new Set([pid])
  let front = [pid]
  while (front.length) {
    const suivante = []
    for (const parent of front)
      for (const fils of enfantsDe.get(parent) ?? [])
        if (!vus.has(fils)) {
          vus.add(fils)
          suivante.push(fils)
        }
    if (suivante.length) parGeneration.push(suivante)
    front = suivante
  }
  return parGeneration.reverse().flat()
}

/** Plafond d'une gate, en millisecondes. */
export const limiteDe = (gate) => (TIMEOUTS[gate] ?? TIMEOUTS.defaut) * 1000

/**
 * Lanes RÉELLEMENT jouées. `--serie` en rend UNE, portant les mêmes gates dans l'ordre de ci.yml :
 * c'est ici, et nulle part ailleurs, que les deux modes se séparent — le reste du lanceur (commande,
 * commande, plafond, verdict) est commun, donc le verdict l'est aussi.
 */
export function lanesAJouer(aJouer, { serie = false, lanes }) {
  const noms = new Set(aJouer.map((g) => g.nom))
  if (serie) return [{ nom: 'serie', gates: aJouer.map((g) => g.nom) }]
  return lanes.map((l) => ({ ...l, gates: l.gates.filter((n) => noms.has(n)) })).filter((l) => l.gates.length)
}

/**
 * Lance `node <argv>` avec sa sortie dans `fichier`, BORNÉ par `limiteMs`, et REJOUÉ si le processus
 * n'a pas démarré (`spawnResilient` — le fichier de sortie est réouvert en `'w'` à chaque essai, sans
 * quoi le second écrirait à la suite du premier). À l'expiration, c'est l'ARBRE de l'enfant qui tombe
 * — `npm`, `vitest` et leurs workers survivraient à un kill sur le seul PID, et garderaient le verrou
 * de suite et les cœurs. `surPid` reçoit le PID DÈS LE SPAWN : c'est par lui que l'arrêt sur signal
 * atteint les enfants EN COURS, dont la promesse se résoudra plus tard.
 * REND `{ code, expiree, fichier, sortie, limiteMs, pid }`.
 */
export function spawnBorne({ commande, argv, fichier, limiteMs, cwd, env = process.env, surPid, site }) {
  const unEssai = () =>
    new Promise((resoudre) => {
      const fd = openSync(fichier, 'w')
      // `npm` est un SCRIPT sous Windows (`npm.cmd`) : sans `shell`, le loader ne le démarre pas.
      const enfant = spawn(commande ?? process.execPath, argv, {
        cwd,
        env,
        stdio: ['ignore', fd, fd],
        shell: commande === 'npm' && process.platform === 'win32',
        detached: process.platform !== 'win32',
      })
      surPid?.(enfant.pid)
      let expiree = false
      const minuterie = setTimeout(() => {
        expiree = true
        tuerArbre(enfant.pid)
      }, limiteMs)
      const finir = (code) => {
        clearTimeout(minuterie)
        try {
          closeSync(fd)
        } catch {
          /* déjà fermé */
        }
        let sortie = ''
        try {
          sortie = readFileSync(fichier, 'utf8')
        } catch {
          /* sortie illisible : le verdict reste celui du code de sortie */
        }
        resoudre({ code, expiree, fichier, sortie, limiteMs, pid: enfant.pid })
      }
      enfant.on('error', () => finir(1))
      enfant.on('close', (code, signal) => finir(codeEnfant(code, signal)))
    })
  return reessayerAuChargement(unEssai, { site: site ?? fichier })
}

/** Les `n` dernières lignes non vides d'un texte — la queue qu'on imprime sous un rouge. */
export const queue = (texte, n) =>
  texte
    .split('\n')
    .filter((l) => l.trim() !== '')
    .slice(-n)

/** Lignes de queue imprimées sous chaque rouge du résumé. */
const LIGNES_DE_QUEUE = 40

/**
 * `git status --porcelain` en ENTIER (docs compris). NE LÈVE PAS : le 2026-09-04, cet appel a rendu
 * `STATUS_DLL_INIT_FAILED` après sept minutes de gates et l'exception a emporté le processus AVANT le
 * résumé — vingt-deux verdicts payés, aucun imprimé. Une photo impossible est une LIGNE du résumé.
 * REND `{ texte, erreur }`.
 */
export function photoArbre(racine) {
  try {
    return {
      texte: execFileResilient('git', ['status', '--porcelain'], { cwd: racine, encoding: 'utf8', maxBuffer: 1 << 28 }, {
        site: 'toutes.mjs/photoArbre',
      }),
      erreur: null,
    }
  } catch (e) {
    return { texte: null, erreur: e.message }
  }
}

const secondesDepuis = (debut) => (Date.now() - debut) / 1000

/**
 * Joue toutes les gates exigées. `racine`, `argv` et `journal` sont INJECTÉS : sans cela, ni la
 * politique d'arrêt ni le résumé ne se mesurent autrement qu'en jouant les vraies gates.
 * REND le code de sortie.
 */
export async function principal({
  racine = RACINE,
  argv = process.argv,
  journal = (t) => process.stderr.write(t),
  ecritLu = ECRIT_LU,
  machine = availableParallelism(),
} = {}) {
  const LISTE = argv.includes('--liste')
  const SERIE = argv.includes('--serie') || !lanesPortees(machine)
  // `--gates a,b` : la liste NOMMÉE, dans l'ordre de ci.yml. Un nom inconnu du fichier fait REFUSER
  // — une faute de frappe qui jouerait zéro gate en s'annonçant verte serait le pire des verdicts.
  const iGates = argv.indexOf('--gates')
  const demandees = iGates === -1 ? null : String(argv[iGates + 1] ?? '').split(',').map((s) => s.trim()).filter(Boolean)

  journal(`[gates] ${enteteArbre(racine)}\n`)

  const scripts = JSON.parse(readFileSync(join(racine, 'package.json'), 'utf8')).scripts ?? {}
  const toutesLesGates = gatesDeCi({ cwd: racine })
  if (demandees) {
    const inconnues = demandees.filter((n) => !toutesLesGates.some((g) => g.nom === n))
    if (inconnues.length) {
      journal(
        `[gates] REFUS — ci.yml ne porte aucune gate nommée ${inconnues.join(', ')}.\n` +
          `[gates] gates lisibles : ${toutesLesGates.map((g) => g.nom).join(', ')}\n`,
      )
      return 1
    }
  }
  const gates = demandees ? toutesLesGates.filter((g) => demandees.includes(g.nom)) : toutesLesGates
  journal(`[gates] ${gates.length} gate(s) lues dans ci.yml${demandees ? ` (sur ${toutesLesGates.length})` : ''}\n`)

  // La couverture et les lanes se jugent sur ci.yml ENTIER, jamais sur le sous-ensemble de `--gates` :
  // une gate écartée d'un run ne rend pas la table fautive.
  const manques = refusDeCouverture(toutesLesGates.map((g) => g.nom), ecritLu)
  if (manques.length) {
    journal(
      `[gates] REFUS — ECRIT_LU ne couvre pas ci.yml :\n${manques.map((m) => `  ${m}`).join('\n')}\n` +
        '[gates] scripts/gates/toutes.mjs : ECRIT_LU.\n',
    )
    return 1
  }
  let lanesDeclarees
  try {
    lanesDeclarees = lanesDeCi(toutesLesGates)
  } catch (e) {
    journal(`[gates] REFUS — ${e.message}\n`)
    return 1
  }
  for (const lane of lanesDeclarees) journal(`[gates] lane ${lane.nom} (job de ci.yml) : ${lane.gates.join(', ')}\n`)
  const conflits = conflitsEntreLanes(lanesDeclarees, ecritLu)
  if (conflits.length) {
    journal(`[gates] REFUS — une lane écrit ce qu'une autre lit :\n${conflits.map((c) => `  ${c}`).join('\n')}\n`)
    return 1
  }

  const aJouer = gates
  if (!argv.includes('--serie') && SERIE)
    journal(
      `[gates] machine de ${machine} cœur(s), pas au-delà des ${COEURS_SUITE_EN_LANES} de la suite : ` +
        'une seule lane, dans l’ordre de ci.yml (`lanesPortees`)\n',
    )
  for (const gate of aJouer) journal(`[gates] ${gate.nom} — à jouer : ${gate.commande}\n`)
  if (LISTE) return 0
  if (!aJouer.length) {
    journal('[gates] rien à jouer.\n')
    return 0
  }

  // `npm run gen` AVANT tout (`genererCode`, scripts/docs/build-all.mjs ; #2203 A2) : `build`, la
  // suite et `docs:build` produisent les cibles de CODE depuis plusieurs lanes ; produites ici, elles
  // ne sont plus réécrites (`ecrireOuVerifier` n'écrit qu'un rendu qui diffère).
  const avantGen = Date.now()
  const gen = spawnSync('npm', ['run', 'gen'], {
    cwd: racine,
    stdio: ['ignore', 'ignore', 'pipe'],
    shell: process.platform === 'win32',
    encoding: 'utf8',
  })
  if (gen.status !== 0) {
    journal(`[gates] REFUS — « npm run gen » rouge (exit ${gen.status}) :\n${gen.stderr ?? ''}\n`)
    return 1
  }
  journal(`[gates] gen — cibles de code produites en ${secondesDepuis(avantGen).toFixed(1)} s\n`)

  mkdirSync(dossierSorties(racine), { recursive: true })
  purgerPerimes({ dossier: dossierSorties(racine), motif: MOTIF_SORTIE, ageMs: PEREMPTION_MS })

  const aJouerParNom = new Map(aJouer.map((g) => [g.nom, g]))
  const verdicts = new Map()
  const vivants = new Map()
  // Seul un SIGNAL arrête le run (#1772) : les arbres en cours sont tués, rien ne peut plus rendre de
  // verdict. AUCUN verdict de gate n'arrête quoi que ce soit, pas même un refus de prérequis : les
  // autres gates lisent le même arbre propre, et chacune teste SES PROPRES prérequis
  // (`prerequisAbsents`), donc leur verdict est juste.
  const arreterSurSignal = (signal) => {
    journal(
      `\n[gates] ${signal} — arrêt : l'ARBRE de chaque gate en cours est tué (un enfant survivant garderait ` +
        'le verrou de suite et des cœurs).\n',
    )
    for (const pid of vivants.values()) tuerArbre(pid)
    process.exit(130)
  }
  process.on('SIGINT', () => arreterSurSignal('SIGINT'))
  process.on('SIGTERM', () => arreterSurSignal('SIGTERM'))

  /** Joue UNE gate, sortie dans son fichier, bornée par son plafond, rejouée si elle n'a pas démarré. */
  const jouerUneFois = async (gate, coeurs) => {
    const fichier = join(dossierSorties(racine), fichierDeSortie(gate.nom, process.pid))
    // PRÉREQUIS D'ABORD : jouer une gate dont le prérequis manque rend l'erreur brute de son outil
    // (un TS2688 pour `server:typecheck`), qui ne nomme ni le dossier absent ni la commande qui le
    // pose. Le verdict est le même ROUGE, mais il DIT quoi faire — et rien n'est spawné. Ce refus ne
    // pèse que sur CE rejeu local : la gate reste jouée, elle, par le run CI de la branche.
    const absents = prerequisAbsents(ecritLu[gate.nom], racine)
    if (absents.length) {
      const sortie = refusDePrerequis(gate.nom, absents)
      writeFileSync(fichier, sortie)
      return { code: 1, expiree: false, fichier, sortie, limiteMs: limiteDe(gate.nom) }
    }
    // La commande est celle de `ci.yml`, TELLE QUELLE : ce qui se rejoue ici est ce que la CI joue.
    // Un script absent de `package.json` est un rouge NOMMÉ, pas un `npm` qui se plaint tout seul.
    const script = gate.nom === 'test' ? 'test' : gate.nom
    if (!scripts[script]) {
      const sortie = `[gates] ${gate.nom} — aucun script « ${script} » dans package.json (step de ci.yml : ${gate.commande})\n`
      writeFileSync(fichier, sortie)
      return { code: 1, expiree: false, fichier, sortie, limiteMs: limiteDe(gate.nom) }
    }
    const env = { ...process.env }
    if (coeurs && !process.env.WFRP_TEST_COEURS) env.WFRP_TEST_COEURS = String(coeurs)
    const [commande, ...args] = gate.commande.split(' ')
    const r = await spawnBorne({
      commande,
      argv: args,
      fichier,
      limiteMs: limiteDe(gate.nom),
      cwd: racine,
      env,
      site: `gate ${gate.nom}`,
      surPid: (pid) => vivants.set(gate.nom, pid),
    })
    vivants.delete(gate.nom)
    return r
  }

  let attenteVerrouMs = 0
  /** Joue une gate, en ATTENDANT quand le verrou de suite d'un autre arbre la refuse sans rien jouer. */
  const jouerGate = async (gate, coeurs) => {
    const debutAttente = Date.now()
    for (;;) {
      const r = await jouerUneFois(gate, coeurs)
      if (!estRefusDuVerrou(r.code, r.sortie)) return r
      attenteVerrouMs = Math.max(attenteVerrouMs, Date.now() - debutAttente)
      if (Date.now() - debutAttente >= ATTENTE_VERROU.borneMs) {
        journal(
          `[gates] ${gate.nom} — verrou de suite tenu depuis ${(ATTENTE_VERROU.borneMs / 60000).toFixed(0)} min : ` +
            'abandon (une suite qui n’a pas tourné ne justifie rien).\n',
        )
        return r
      }
      journal(
        `[gates] ${gate.nom} — suite d'un autre arbre en cours : attente ` +
          `${(ATTENTE_VERROU.pasMs / 1000).toFixed(0)} s (déjà ${((Date.now() - debutAttente) / 1000).toFixed(0)} s)\n`,
      )
      await new Promise((patienter) => setTimeout(patienter, ATTENTE_VERROU.pasMs))
    }
  }

  /** Pose le verdict d'une gate. Aucun verdict n'ARME quoi que ce soit : le résumé compte tout
   *  verdict non vert, et les lanes vont au bout. */
  const poser = (nom, r) => {
    const secondes = secondesDepuis(r.debut)
    const statut = r.expiree ? 'EXPIRÉE' : r.code === 0 ? 'vert' : 'ROUGE'
    verdicts.set(nom, { statut, code: r.code, secondes, fichier: r.fichier, sortie: r.sortie, limiteMs: r.limiteMs })
    journal(`[gates] ${nom} — ${statut} (exit ${r.code}) en ${secondes.toFixed(1)} s · ${r.fichier}\n`)
    return statut
  }

  const jouerLane = async (lane) => {
    const debut = Date.now()
    for (const nom of lane.gates) {
      const debutGate = Date.now()
      // En série (`--serie`, ou machine qui ne porte pas les lanes) la suite n'est PAS bornée : rien ne
      // tourne à côté d'elle, et la brider fausserait la seule mesure de référence du lanceur.
      const r = await jouerGate(aJouerParNom.get(nom), !SERIE && nom === 'test' ? COEURS_SUITE_EN_LANES : null)
      poser(nom, { ...r, debut: debutGate })
    }
    return { nom: lane.nom, secondes: secondesDepuis(debut) }
  }

  const photoDepart = photoArbre(racine)
  const debutTotal = Date.now()

  // PHASE 2 — les lanes, qui ne portent que des lecteurs.
  const lanes = lanesAJouer(aJouer, { serie: SERIE, lanes: lanesDeclarees })
  const dureesLanes = await Promise.all(lanes.map(jouerLane))
  const mur = secondesDepuis(debutTotal)

  // PHASE 3 — le RÉSUMÉ D'ABORD, dans l'ordre de ci.yml. L'ordonnancement en lanes ne doit pas
  // devenir l'ordre de LECTURE d'un verdict, et rien de ce qui suit ne peut plus l'empêcher.
  journal('\n[gates] ——— résumé ———\n')
  let code = 0
  for (const gate of gates) {
    const v = verdicts.get(gate.nom)
    if (!v) continue
    const exit = typeof v.code === 'number' ? ` (exit ${v.code})` : ''
    journal(`[gates] ${gate.nom} — ${v.statut}${exit} — ${v.secondes.toFixed(1)} s — ${v.fichier}\n`)
    if (v.statut === 'vert') continue
    code = 1
    if (v.statut === 'EXPIRÉE') journal(`[gates]   expirée au plafond de ${(v.limiteMs / 1000).toFixed(0)} s (TIMEOUTS)\n`)
    if (v.sortie) for (const l of queue(v.sortie, LIGNES_DE_QUEUE)) journal(`[gates]   | ${l}\n`)
  }
  const serieEquivalente = [...verdicts.values()].reduce((n, v) => n + v.secondes, 0)
  journal(
    `[gates] total ${mur.toFixed(1)} s · série équivalente ${serieEquivalente.toFixed(1)} s · lanes : ` +
      `${dureesLanes.map((d) => `${d.nom} ${d.secondes.toFixed(1)} s`).join(' · ') || '(aucune)'}\n`,
  )
  const rejeuxDesGates = [...verdicts.values()].reduce((n, v) => n + compterRejeux(v.sortie), 0)
  const totalRejeux = rejeux.total + rejeuxDesGates
  journal(
    totalRejeux
      ? `[gates] ${totalRejeux} spawn(s) rejoué(s) — pression système (le processus n'avait pas démarré)\n`
      : '[gates] 0 spawn rejoué — aucune pression de chargement\n',
  )
  if (attenteVerrouMs) journal(`[gates] dont ${(attenteVerrouMs / 1000).toFixed(0)} s d'attente du verrou de suite\n`)

  // Les durées de CE run sont la mesure des LANES et des TIMEOUTS — écriture au mieux, jamais un verdict.
  try {
    writeFileSync(
      fichierDurees(racine),
      `${JSON.stringify(Object.fromEntries([...verdicts].map(([n, v]) => [n, v.secondes])), null, 2)}\n`,
    )
  } catch {
    /* cache indisponible : la mesure de ce run est perdue, rien d'autre */
  }

  const photoFin = photoArbre(racine)
  if (photoDepart.erreur || photoFin.erreur) {
    journal(`[gates] photo de l'arbre IMPOSSIBLE (${photoDepart.erreur ?? photoFin.erreur}) — vérifie \`git status\` à la main.\n`)
  } else if (photoFin.texte !== photoDepart.texte) {
    journal(
      "[gates] REFUS — l'arbre a CHANGÉ pendant le run : une gate y a écrit ce qu'une autre lisait, et " +
        'aucun verdict de ce run ne vaut. `git status` avant et après diffèrent.\n',
    )
    code = 1
  }
  return code
}

if (import.meta.main) {
  process.exit(
    await principal().catch((e) => {
      process.stderr.write(`[gates] ARRÊT INATTENDU : ${e?.stack ?? e}\n`)
      return 1
    }),
  )
}
