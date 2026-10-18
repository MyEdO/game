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
// `--liste` n'imprime que le plan (ce qui serait joué) sans rien jouer ; `--serie` joue tout en une
// lane ; `--gates a,b` restreint la liste.
import '../node-requis.mjs'
import { photoArbre } from '../guards/lib/photoArbre.mjs'
export { photoArbre } from '../guards/lib/photoArbre.mjs'
import { spawnSync } from 'node:child_process'
import { spawnBorne, tuerArbre, diagnosticArret } from '../guards/lib/processusBorne.mjs'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { availableParallelism } from 'node:os'
import { join } from 'node:path'
import { enteteArbre } from '../guards/lib/enteteArbre.mjs'
import { LANE_LOCALE_DE_JOB, gatesDeCi } from './gatesDeCi.mjs'
import {
  compterRejeux,
  rejeux,
} from '../guards/lib/spawnResilient.mjs'
import { jetonsDuVerrou, prendreVerrouAsync, tenantEnUneLigne } from '../test/verrou.mjs'
import { lanceUnGesteLourd, verrouGestesLourds } from '../test/verrouGestesLourds.mjs'
import { PEREMPTION_MS, purgerPerimes } from '../guards/lib/purgerPerimes.mjs'
import { CACHE_FRAICHEUR } from '../docs/lib/cache-fraicheur.mjs'
import { CODE_DIFFERE } from '../guards/lib/codesDeSortie.mjs'
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
const RETRAIT_WORKTREE_FERME = "protectionWorktree.mjs : retirerResiduelVide appelle rmdirSync seulement depuis retirerWorktree ; cette gate ne retire aucun worktree du dépôt réel, les bancs de retrait utilisent leurs dépôts jetables. "

/** Ce que LISENT les gates d'audit du dépôt réel (`GATES_D_AUDIT`, scripts/gates/testsParGate.mjs). */
const LIT_DES_AUDITS = ['src/', 'scripts/', 'server/', 'docs/', 'Source/', '.claude/', '.codex/', '.github/', 'AGENTS.md', 'package.json', 'package-lock.json', 'tsconfig.json', 'oxlint.config.mjs', 'knip.json', 'knip-exports-baseline.json', 'kill-pid.mjs', '.npmrc']

export const ECRIT_LU = {
  'agents:check': {
    ecrit: [],
    lit: ['.claude/', '.agents/', '.codex/', 'scripts/agents/'],
    raison: RETRAIT_WORKTREE_FERME +
      'mode `check` : `runCompat` n’écrit que sous `mode === "sync"` (`runCompat`, scripts/agents/compat-cli.mjs) ; ' +
      'il lit les DEUX côtés de la compat — .claude/ (source) et .agents/ + .codex/ (miroirs comparés), plus son ' +
      'propre code (`FICHIERS_LUS`, `DOSSIERS_LUS`)',
  },
  'test:agents': {
    ecrit: [],
    lit: ['.claude/', '.codex/', 'scripts/agents/', 'scripts/hooks/', 'CLAUDE.md'],
    raison: RETRAIT_WORKTREE_FERME +
      'les écritures sont INJECTÉES et comptées, jamais faites (`atomicWrite` injecté, scripts/agents/compat.test.mjs) ; ' +
      'LIT les DEUX côtés de la compat sur l’arbre RÉEL, racine `new URL("../../", import.meta.url)` — ' +
      '.claude/settings.json et .codex/hooks.json, CLAUDE.md (contrat sur ses imports `@.claude/credo.md` et ' +
      '`@AGENTS.md`) — sonde `fs` du 2026-09-16 sur `node --test scripts/agents/compat.test.mjs` ; LIT ' +
      'scripts/hooks/ depuis le 2026-09-28 (#2125) : les déclarations de hooks dérivent des registres, que ' +
      '`chargerRegistres` (scripts/agents/compat-cli.mjs) importe',
  },
  'test:hooks': {
    ecrit: [],
    ecritFerme: {
      'node_modules/typescript/dist/api/node/wtf8.js':
        'contrat d’installation TypeScript (scripts/guards/contrat-typescript.mjs) : appliquerCorrectif de scripts/guards/lib/gitPorte.mjs ' +
        'borne git apply à cet unique --include ; postinstall exécute verifierContratTypeScript avant les générateurs et hooks, donc le banc réel ' +
        'rencontre le SDK déjà corrigé : --reverse --check puis return false sans écriture, éprouvé par le banc d’idempotence ; ' +
        'node_modules/ est gitignoré et reste hors des clés de contenu, mais les gates natives lisent ce SDK',
    },
    lit: [
      '.claude/', '.codex/', '.github/workflows/', 'docs/', 'patches/', 'public/', 'scripts/', 'server/', 'src/', 'Source/',
      'CLAUDE.md', 'AGENTS.md', 'oxlint.config.mjs', 'knip.json', 'package.json', 'package-lock.json', 'tsconfig.json',
      'kill-pid.mjs', 'knip-exports-baseline.json', 'vite.config.ts',
    ],
    raison: RETRAIT_WORKTREE_FERME +
      'session-start.mjs importe compat-cli.mjs : chargerRegistres ne fait que charger les registres de hooks ; runCompat et atomicWrite ne sont pas appelés, et la porte import.meta.main reste fermée ; ' +
      'patchCodex.test.mjs écrit son fichier et sa jonction réels uniquement sous mkdtempSync de os.tmpdir(), puis unlinkSync et rmSync en finally ; ' +
      'superviserProcessus.test.mjs écrit ses lanceurs, PID, battements et résultats JSON dans mkdtempSync de os.tmpdir(), puis rmSync en finally ; ses enfants écrivent ces seuls chemins temporaires ; ' +
      'fraicheur-docs.mjs est atteint par build-all : les gardes lisent son code ou appellent ses fonctions sur leurs fixtures, jamais pour écrire le ledger de la racine réelle ; ' +
      'le registre d’écrans que `new-src-file-guard.test.mjs` éprouve est INJECTABLE (`WFRP_REGISTRE_ECRANS`, ' +
      '`cheminRegistre` de scripts/hooks/new-src-file-guard.mjs) et le test en écrit une COPIE sous os.tmpdir() ; ' +
      'le journal de dérogations est injecté par WFRP_JOURNAL_NEW_SRC_GUARD (`cheminJournal`), écrit et vérifié sous os.tmpdir() ; ' +
      'sonde #2489 du 2026-10-08 : journal réel seul pollueur des sept suites avant correction, paire hook/générateurs corrigée sans changement de l’arbre ; ' +
      '`testsSansEcriture.mjs` refuse les mutations fs des processus Node héritant du préchargeur dans la racine, ignorés compris, et photographie état et empreintes avant/après la suite ; ' +
      'les autres fixtures vivent sous os.tmpdir() ; le banc de configuration de lancerLint copie le fichier jugé dans sa fixture temporaire, ' +
      'y écrit .lint-PID-aléatoire.config.mjs et y mesure cette écriture avec le collecteur de lectures, puis exige la suppression de la configuration ; ' +
      'enregistreur-lectures.mjs n’écrit sa sortie que si WFRP_LECTURES_RACINE et WFRP_LECTURES_SORTIE sont fournis, avec WFRP_LECTURES_IGNORES requis ; ' +
      'ces variables sont absentes du banc lintStage : installer rend un collecteur sur la fixture temporaire, restauré en finally avant son retrait ; ' +
      'les sorties de l’instrumentation sont dirigées vers les fixtures temporaires par ces variables ; ' +
      'le contrat d’installation TypeScript lit le patch réel sous patches/ et peut corriger uniquement node_modules/typescript/dist/api/node/wtf8.js ; ' +
      'LIT src/ massivement (3 888 chemins) — les gardes de la ' +
      'gate balaient l’arbre réel (stocks nominatifs, garde des nouveaux fichiers, budget de contexte) ; ' +
      'LIT docs/ pour le listing de docs/raw ; le banc de scripts/git-hooks/ injecte sa mesure par mesurerEnRendu ; ' +
      'LIT Source/ parce que `idempotence-ordre-des-cles.test.mjs` copie le corpus (Source/ moins les ' +
      '`.pdf`, écartés par extension : sans les extractions quatre migrations sortent 1 faute de livres) sous ' +
      'os.tmpdir() avant de rejouer les 89 migrations — cette copie passe par `cpSync`, que l’enveloppe de la ' +
      'sonde n’enregistre pas : la déclaration tient de la LECTURE du code, et une sur-déclaration ne peut ' +
      'que RESSERRER les lanes ; LIT .codex/hooks.json et .claude/settings.json ' +
      '(parité des canaux), .github/workflows/ci.yml, CLAUDE.md et AGENTS.md qu’il importe (budget de contexte), oxlint.config.mjs et package.json — ' +
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
      '`git status --porcelain` avant/après identique, et aucun résidu dans os.tmpdir() ; +1 écrivain le ' +
      '2026-10-15 (#2603) : `git-hooks/reconstruction.mjs`, atteint par ' +
      '`docs-rebuild.mjs` : l’état, les verrous et les journaux de la reconstruction sous `.git/hooks-git/` des dépôts ' +
      '`instanceDeDepot` sous os.tmpdir() ; ' +
      '`guards/lib/cssImages.test.mjs` (#2603) sauve les mémos d’analyse sous `.git/hooks-git/memos-analyse/` de dépôts ' +
      '`instanceDeDepot` sous os.tmpdir(), retirés en finally ; `guards/lib/memosDAnalyse.test.mjs` (#2603) écrit ses mémos ' +
      'sous des `mkdtempSync` d’os.tmpdir(), retirés par `t.after` ; `hooks/stocks-nominatifs.test.mjs` (#2603, 2026-10-16) ' +
      'sauve les mémos d’analyse de la plage du dépôt réel sous un `mkdtempSync` d’os.tmpdir(), retiré par `t.after` ; +3 écrivains le ' +
      '2026-09-30 (#2132) : `hooks/suivi-lien-guard.test.mjs` et `hooks/inject-suivi.test.mjs` forgent un dépôt ' +
      'jetable (`instanceDeDepot`, sous os.tmpdir(), `rmSync` en finally), et le second y écrit `.git/suivi` ' +
      '(suivi et journal `.journal`) ; `ops/suivi.mjs`, que le lien de session importe, et `ops/suiviFichiers.mjs` (#2460), son écriture atomique, n’écrivent que derrière sa porte ' +
      '`import.meta.main` — sonde `git status --porcelain --ignored` avant/après identique, sur le worktree et ' +
      'sur l’arbre principal ; +1 écrivain le 2026-10-07 (#2460) : `hooks/suivi-ecriture-guard.test.mjs` forge un ' +
      'dépôt jetable (`instanceDeDepot`, sous os.tmpdir(), `rmSync` en finally), la garde n’y écrit rien ; +2 écrivains le 2026-10-04 (#2278) : ' +
      '`mods/verifier.test.mjs` forge ses mods sous `mkdtempSync` de os.tmpdir() (`rmSync` en `t.after`), et ' +
      '`mods/verifier.mjs`, qu’il importe, copie sous un `mkdtempSync` de os.tmpdir() effacé en finally ; ' +
      '`scripts/guards/budget-contexte.test.mjs` forge ses fixtures avec instanceDeDepot sous os.tmpdir(), ' +
      'écrit son evenement.json sous cette racine temporaire et la nettoie par rmSync en finally ; ' +
      '`mods/murDeMod.test.mjs` crée ses fichiers de sélection native par mkdirSync/writeFileSync ' +
      'sous mkdtempSync(join(os.tmpdir(), "lint-mod-perimetre-")), puis rmSync en finally ; ' +
      'lancerLint y crée sa configuration temporaire .lint- et la retire en finally ; +1 écrivain le 2026-10-07 (#2187) : ' +
      '`hooks/barriere-outil.test.mjs` forge ses arbres (`.git` dossier ou fichier `gitdir:`, LF et CRLF, sous-module) ' +
      'et y écrit le verrou d’outillage sous `mkdtempSync` de os.tmpdir() (`rmSync` en finally) — l’arbre n’est jamais écrit',
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
    raison: RETRAIT_WORKTREE_FERME +
      'aucune écriture : la porte de publication (#2328, scripts/guards/lib/livraison.mjs) lit l’HISTOIRE par git — ' +
      'le graphe de `merge-base origin/main..HEAD`, le patch de chaque fusion contre sa fusion automatique ' +
      '(`merge-tree --write-tree`, dont les objets inaccessibles vont à l’odb, jamais à l’arbre), le journal ' +
      'des messages, et les soldes `.claude/soldes/ref-<N>.md`, `<N>.md` de HEAD ; LIT son code, la porte de ' +
      'version de Node (`engines` de package.json) et ce qu’importe l’hôte git (scripts/port-dev.mjs, src/lib/coupeAuMot.mjs)',
  },
  'comptes:plage': {
    ecrit: [],
    lit: ['src/', 'scripts/', 'Source/', 'package.json', 'tsconfig.json'],
    raison: RETRAIT_WORKTREE_FERME +
      'la porte des collections à compte (#2705, scripts/guards/lib/corpusDesComptes.mts) lit l’HISTOIRE par git — ' +
      '`merge-base origin/main..HEAD`, et les images de `src/` et `Source/` aux deux bornes (`listerImage`, `lireEnLot`) — ' +
      'et pose chacune sous un `mkdtempSync` d’os.tmpdir(), effacé en finally, deux fois : avec une COPIE de `scripts/`, `package.json` ' +
      'et `tsconfig.json` de l’arbre (le détecteur de la tête), puis avec ceux du commit de base lus par git (`detecteurDuCommit`), `node_modules` lié (`lierDependances`) et les cibles de code produites ' +
      'DANS l’image (`genererCodeSansCertifier`, cwd = l’image) ; chaque image se mesure dans un processus tsx fils ; ' +
      'aucune écriture dans l’arbre',
  },
  'test:corpus': {
    ecrit: [],
    lit: LIT_DES_AUDITS,
    raison: 'Les audits et rendus du dépôt réel lisent leurs corpus ; les copies, mutations et rapports des bancs restent sous os.tmpdir(), retirés en finally. Les générateurs importés gardent leurs écritures derrière leur porte CLI ; les rendus sont lus sans publication dans l’arbre.',
  },
  'test:corpus-isole': {
    ecrit: [],
    lit: LIT_DES_AUDITS,
    raison: 'Les audits du dépôt réel joués sans concurrence lisent leurs corpus ; leurs mémos et copies restent sous un `mkdtempSync` d’os.tmpdir(), retiré en finally, et leurs stocks se lisent sans réécriture.',
  },
  'test:ops': {
    ecrit: [],
    lit: ['src/', 'scripts/', 'oxlint.config.mjs', 'kill-pid.mjs', '.claude/workflows/', '.claude/agents/', '.claude/skills/harnais/', '.claude/settings.json', '.claude/credo.md', '.codex/hooks.json', '.github/workflows/', 'knip.json', 'knip-exports-baseline.json'],
    raison: RETRAIT_WORKTREE_FERME +
      'session-start.test.mjs copie les configurations réelles .claude/settings.json et .codex/hooks.json, le credo .claude/credo.md et les scripts des hooks dans ses fixtures mkdtempSync sous os.tmpdir(), retirées par t.after ; ses mutations de configuration, hooks, credo et reçus restent dans ces fixtures ; ' +
      'session-start.mjs importe compat-cli.mjs ; le préflight charge registre.mjs dynamiquement via chargerRegistres, jamais runCompat ni atomicWrite ; session-start.test.mjs importe directement bootstrap-conteneur.mjs ; ' +
      'les CLI réellement lancés par session-start.test.mjs sont inject-project-credo.mjs et bootstrap-conteneur.mjs, avec cwd, CLAUDE_PROJECT_DIR et chemin de reçu dans la fixture temporaire ; CLAUDE_CODE_REMOTE=false ferme bootstrap avant tout prérequis ; seul le reçu natif valide est écrit dans la fixture, son absence hors ops et après panne étant éprouvée ; ' +
      'session-runtime.mjs écrit cartes, bootstrap, demande d’arrêt et temporaires dans le registre machine .git/sessions ; session.test.mjs lui injecte uniquement des dossiers mkdtempSync sous os.tmpdir(), supprimés en after ; ' +
      'session-codex.mjs écrit son journal JSONL et stderr dans le dossier de registre injecté ; session-codex.test.mjs injecte seulement des mkdtempSync sous os.tmpdir(), y écrit les doubles app-server et y retire les fixtures après exit des enfants ; le contrôle du protocole génère ses schémas sous un mkdtempSync de os.tmpdir(), retiré en finally ; ' +
      'session-version.mjs et son banc vérifient version et registre sans écriture fs ; session-harnais.test.mjs lit les hooks réels sous .claude/skills/harnais/ et les exécute avec ses interfaces injectées, sans écrire ce dossier ; ' +
      'session.test.mjs importe repartition.mjs pour surfaceDe et projeter, fonctions pures sans lecture ni écriture fs ; ses mkdirSync et appendFileSync de traces sont fermés dans executer(registre), que ce banc n’appelle pas ; aucune lecture ni écriture de trace n’est atteinte par ce chemin ; ' +
      'son JobHost Windows ne lance au banc que des enfants Node neutres sous ces dossiers temporaires, jamais Windows Terminal ni un agent ; le lancement WT et l’inventaire sont injectés, et lancerAgent ne lance au banc que des enfants Node neutres sous os.tmpdir() ; ' +
      'fraicheur-docs.mjs ne reçoit des bancs chantier que leurs dépôts jetables sous os.tmpdir(), ou un copierDocs injecté ; aucun ledger du principal réel n’est écrit ; ' +
      'aucun module atteint n’écrit DANS l’arbre (la liste des écrivains atteints vit au cliquet ' +
      '`ecrivainsAtteints.test.mjs`, pas ici) : les bancs écrivent sous os.tmpdir() — leurs dossiers de ' +
      '`mkdtempSync`, ou les dépôts jetables de `depotGabarit.mjs`, dont toutes les écritures visent ' +
      'os.tmpdir() —, et un module dont l’écriture réelle vise un autre lieu la tient derrière sa porte ' +
      '`import.meta.main`. Les cas qui demandent une explication : `knip-exports-ratchet.mjs` (seul ' +
      '`--sync`, sous la porte de `main()`, écrirait la baseline ; scripts/ops/knip-exports-ratchet.test.mjs écrit et retire uniquement ses fixtures de configuration et de bibliothèque sous os.tmpdir()), `ruleset-main.mjs` (le corps du ruleset ' +
      'part par un fichier de os.tmpdir(), depuis `executer`, que les tests n’appellent jamais), ' +
      '`suivi.mjs` et `suiviFichiers.mjs` (#2460) (ils écrivent `.git/suivi/<N>.json` et `<N>.mesure.json`, dans le répertoire git COMMUN et ' +
      'non dans l’arbre, sous sa porte ; ses tests lui passent un dossier de `mkdtempSync`), et `test/verrou.mjs` ' +
      'qu’il atteint (+1 écrivain le 2026-10-05, #2279 : le verrou `.<nom>.verrou` voisin du fichier écrit, le verrou de mesure `.<N>.mesure.verrou` (#2460), leur temporaire et leur reprise, dans ce même ' +
      'dossier, sous cette même porte, et sous `mkdtempSync` en test) ; `synchroniser.mjs` (#2187 : il avance ' +
      'l’arbre PRINCIPAL — fichiers W′, `.git/index`, `.git/index.lock`, `.git/synchro/`, `.git/synchro-conflits/` — ' +
      'sous sa porte `import.meta.main` ; son banc ne le joue que sur des dépôts `instanceDeDepot` sous os.tmpdir()) ; ' +
      '`reconstruction.mjs` (#2603), atteint par `synchroniser.mjs` et `bootstrap-conteneur.mjs` : son état, ses verrous et ses ' +
      'journaux vivent sous `.git/hooks-git/`, hors de l’arbre, et ses bancs ne le jouent que sur des dépôts `instanceDeDepot` ' +
      'sous os.tmpdir() ; `ecritureJsonAtomique.mjs` (scripts/guards/lib), atteint par `publier.mjs`, ' +
      'pour `vigie.mjs` (#2280, #2603 : les mémoires machine des verdicts et des têtes de l’origine, et leurs verrous, sous `<arbre principal>/.git/vigie/`, répertoire git ' +
      'COMMUN, hors de l’arbre ; ses bancs `vigie.test.mjs` et `ci.test.mjs` n’écrivent que sous `mkdtempSync`) ; ' +
      '`reprendre-file.mjs` ne peut ajouter au résumé GitHub que sous sa porte CLI ' +
      '`import.meta.main` ET si `GITHUB_STEP_SUMMARY` est défini ; ' +
      'le runner fournit ce fichier hors du dépôt, et le banc CLI le remplace par un fichier de ' +
      '`mkdtempSync` sous os.tmpdir(), avec événement CI rouge, configuration GitHub temporaire et tokens GitHub vides, sans API ni écriture dans l’arbre ; ' +
      'LIT .github/workflows/ parce que `CHEMIN` de `canari.test.mjs` et le test « les contextes se LISENT ' +
      'dans le ci.yml réel » de `ruleset-main.test.mjs` lisent les workflows RÉELS, et ' +
      'scripts/guards/lib/ par le stock de `fermetures-non-citees.mjs` ; LIT tout fichier JavaScript suivi ' +
      'ou à suivre (`git ls-files -co --exclude-standard` : scripts/, .claude/workflows/, oxlint.config.mjs, ' +
      'kill-pid.mjs), que la porte `workflows.test.mjs` parse pour y RECONNAÎTRE les scripts de workflow et ' +
      'les bancs qui importent `jouer-workflow.mjs` (`reconnaissanceDuDepot`, `bancsDeWorkflowDuDepot`), sans ' +
      'processus fils ; LIT .claude/agents/ (le cliquet d’EXCEPTIONS_MECANIQUES exige `.claude/agents/<type>.md`) ; ' +
      '`workflows-joues.test.mjs` joue les scripts de .claude/workflows/ EN PLACE, sur l’arbre réel ; ' +
      'LIT knip.json (le cliquet d’exports le relit). ' +
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
    raison: RETRAIT_WORKTREE_FERME +
      'gitDeBanc.test.mjs importe installer du collecteur et ses dépendances sous scripts/ : aucune SORTIE fournie, aucun flush appelé ; ' +
      'ses captures Git restent en mémoire sur des dépôts instanceDeDepot sous os.tmpdir(), restaurés puis supprimés en finally ; ' +
      'chaque cas fabrique son arbre sous os.tmpdir() (`mkdtempSync`), y compris son node_modules/.cache ; ' +
      'LIT package.json (les scripts que le runner relaie) et .npmrc (copié par scripts/node-requis.test.mjs ' +
      'dans son faux arbre, le 2026-09-24, #1801), et les deux configurations de hooks d’agent ' +
      '(.claude/settings.json, .codex/hooks.json : scripts/node-requis.test.mjs y lit les modules lancés, ' +
      'le 2026-09-27, #1801) ; +1 écrivain le 2026-10-05 (#2279 N0) : `test/verrou.test.mjs` fait se disputer ' +
      'le verrou par des processus réels sous un `mkdtempSync` de os.tmpdir() (`rmSync` en finally) ; ' +
      '`scripts/test/perimetre.test.mjs` forge ses dépôts avec mkdtempSync(tmpdir()), mémos compris, et les nettoie par t.after ; ' +
      '+1 écrivain le 2026-10-07 (#2400) : `lintStage.mjs`, atteint par `perimetre.mjs`, dont le banc injecte le lanceur de lint ; ' +
      '+1 le 2026-10-07 (#2404) : `scripts/gen-formats.test.mjs` atteint `ecrireOuVerifier` par le générateur, ' +
      'sans jamais passer sa porte d’écriture `import.meta.main` (formats calculés en mémoire) ; +1 le 2026-10-07 (#2400, fusion de #2456) : ' +
      '`fraicheur-docs.mjs`, atteint par `perimetre.mjs` → `selection-des-derives.mjs` → `build-all.mjs`, n’écrit sa preuve ' +
      '(node_modules/.cache/docs-fraicheur.json) que depuis `executer` sous la porte `import.meta.main` de build-all.mjs, ' +
      'que les bancs de la gate n’appellent pas ; +1 le 2026-10-15 (#2603) : `purgerPerimes.mjs`, atteint par `perimetre.mjs` → ' +
      '`memosDAnalyse.mjs`, ne purge que le dossier de mémos de son appelant (node_modules/.cache/perimetre, ou un ' +
      '`mkdtempSync` d’os.tmpdir() des bancs)',
  },
  'test:docs': {
    ecrit: [],
    lit: [
      'docs/', 'src/', '.claude/memory/', 'scripts/docs/', 'scripts/guards/lib/', 'scripts/test/partition.mjs',
      'scripts/lancer-local.mjs', 'scripts/outillage-local.mjs', 'scripts/port-dev.mjs', 'CLAUDE.md', 'AGENTS.md',
      'scripts/etape-profilee.mjs',
      'scripts/git-hooks/', 'scripts/hooks/',
      'scripts/test/verrou.mjs', 'scripts/test/memoire.mjs', 'scripts/test/mesures.mjs', 'scripts/test/memoire-precharge.cjs', 'scripts/test/verrouGestesLourds.mjs', 'scripts/test/gitDeBanc.mjs',
      'scripts/test/node-tests.mjs', 'scripts/node-requis.mjs',
      'scripts/raw/', 'scripts/gen-registry.mjs', 'Source/',
      'scripts/gates/', 'scripts/ops/reprendre-file.mjs', 'scripts/ops/ruleset-main.mjs',
      'scripts/art-ref/',
      '.claude/settings.json', '.github/workflows/', '.gitignore', 'package.json', 'patches/',
    ],
    raison: RETRAIT_WORKTREE_FERME +
      'LIT scripts/etape-profilee.mjs : build-all partage les annonces de progression et leur mesure avec les gestes ops ; ' +
      'scripts/docs/check-doc-refs.test.mjs écrit et supprime ses cibles de suites dans des fixtures sous os.tmpdir(), retirées en finally ; sa CLI lit ces fixtures sans publication ; ' +
      'les bancs fraîcheur écrivent leur cache dans leurs dépôts sous os.tmpdir(), supprimés en finally ; ' +
      'ecrireJsonAtomique (scripts/guards/lib/ecritureJsonAtomique.mjs), atteint par les bancs de certification, écrit uniquement leurs caches de fixtures sous os.tmpdir() ; ' +
      'fixtures sous os.tmpdir(), dont celles de scripts/docs/lib/jsdocUnion.test.mjs ' +
      '(jsdoc-native-, zod-native-, union-optional-native-, supprimées en finally) ; ' +
      'scripts/docs/lib/plateforme-win32-fs.test.mjs écrit ses douze fixtures de décodage sous os.tmpdir(), préfixe plateforme-win32-decodage-, ' +
      'puis supprime chaque dossier par rmSync en finally ; ' +
      '`build-passifs.test.mjs` crée ses instances jetables après avoir prouvé ' +
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
      'LIT AGENTS.md sur l’arbre RÉEL : `routingTableSlice` (manual-docs-ratchet.test.mjs) ancre la table de routage ' +
      'd’AGENTS.md (`## Table de routage`) et `routedFlatDocs` en dérive les docs à plat atteignables ; LIT scripts/raw/, ' +
      'scripts/gen-registry.mjs et Source/ (#2203) : `citations-rendues.test.mjs` rend chaque cible ' +
      '(`rendreCible` ; build-all.mjs importe gen-registry.mjs et scripts/raw/), et ses générateurs lisent ' +
      'l’Atlas et Source/ — rien n’est écrit ; LIT les sources, configurations et inventaires du runbook ' +
      'par `build-reprise.test.mjs` et `rendre` (sonde du 2026-10-07, #2499 : zéro écriture mesurée). ' +
      '`scripts/gates/toutes.mjs` atteint `purgerPerimes`, mais `principal` reste derrière `import.meta.main` ; ' +
      'ni ses mkdir/writeFile ni sa purge ne sont appelés. `scripts/ops/reprendre-file.mjs` garde sa CLI ' +
      'derrière `import.meta.main` : `reprendreFile` et appendFileSync sous GITHUB_STEP_SUMMARY ne sont pas appelés. ' +
      'Les seules sorties de la sonde de lectures sont archivées hors arbre ; +2 écrivains le 2026-10-15 (#2603) : ' +
      '`docs/lib/ecrivain-derives.test.mjs` joue la course passe/post-hook dans un dépôt `instanceDeDepot` sous os.tmpdir() ' +
      '(générateur lent et signaux sous `mkdtempSync`, `rmSync` en finally) ; il importe `docs-rebuild.mjs`, qui atteint ' +
      '`reconstruction.mjs` (état, verrous et journaux sous `.git/hooks-git/` des seuls dépôts jetables) ; ' +
      '`miroirs-d-agents.mjs` y atteint `memosDAnalyse.mjs`, dont les ' +
      'mémos ne s’écrivent que sous `<git-common-dir>/hooks-git/memos-analyse/`, hors de l’arbre, et seulement par un post-hook ' +
      'ou une porte que les bancs ne jouent que dans des dépôts `instanceDeDepot` sous os.tmpdir()'
  },
  'deps:unused': {
    ecrit: [],
    lit: [
      'src/', 'scripts/', 'server/', 'docs/', 'Source/', 'package.json', 'knip.json', 'knip-exports-baseline.json',
      'tsconfig.json', 'vite.config.ts', 'oxlint.config.mjs', 'index.html', '.gitignore', 'CLAUDE.md',
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
    raison: RETRAIT_WORKTREE_FERME + 'le profil de navigateur et les captures vivent hors de l’arbre (le banc capture sous os.tmpdir() et l’efface) ; LIT le dériveur de port qu’il éprouve',
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
    lit: ['src/', 'scripts/', 'server/', '.claude/workflows/', '.claude/skills/', 'oxlint.config.mjs', 'package.json', 'kill-pid.mjs'],
    raison:
      'Oxlint sans `--fix` ; LIT sa config explicite, ses plugins sous scripts/, package.json et les ' +
      'modules de code sélectionnés, dont .claude/workflows/ : lecture du code et découverte native ' +
      '`oxlint . --config oxlint.config.mjs --debug files`, sonde 2026-10-05 ; les configurations imbriquées sont désactivées ; ' +
      'le mur des mods (#2278) porte le périmètre hooks/types/tests sous .claude/skills/.',
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
      'scripts/corpus/docs/manual-docs-ratchet.test.mjs dans test:corpus) ; LIT Source/ (verbatims ' +
      'et résolution de prose : `CHAPITRE` de src/data/tavern-desc-verbatim.test.ts et de ' +
      'vdm-objets-maudits.test.ts, `AA_ANNEXE_III` de variants-integrity.test.ts, le cas « A — chaque ' +
      'adresse RÉSOUT » de prose-resolution.test.ts, `oversizeIn(\'Source\', …)` de ' +
      'src/oversize-search-blindspot.test.ts) ; LIT .gitattributes parce que le verdict de `nonLf` ' +
      '(src/source-hygiene-guard.test.ts) tient à la colonne `-text` que `git ls-files --eol` en tire',
  },
  build: {
    ecrit: [],
    ecritFerme: {
      [CACHE_FRAICHEUR]:
        '`build-all.mjs --code` invalide puis certifie ses écritures par ecrireJsonAtomique (scripts/guards/lib/ecritureJsonAtomique.mjs), temporaire propre au PID puis renommage ; ' +
        'destination sous docs/.cache/ gitignoré, hors arbre versionné ; les seuls lecteurs réels build/docs:build sont dans le même job/lane docs de ci.yml, ' +
        'séquentiels par jouerLane ; les autres lanes ne lisent que leurs caches de fixtures sous os.tmpdir()',
      'src/':
        'les cibles de CODE (`genererCode`, scripts/docs/build-all.mjs) sont produites AVANT toute gate ' +
        '(`npm run gen`, ci-dessous) : `ecrireOuVerifier` ne réécrit pas un rendu identique',
      'docs/.sources-lues.json':
        '`build-all.mjs --code` conserve les mesures des autres générateurs et enregistre celles des cibles de code ; seuls build et docs:build lisent cette mesure réelle dans le même job/lane docs, séquentiels par jouerLane ; les autres lanes utilisent leurs mesures de fixtures sous os.tmpdir()',
      'vite.config.ts.timestamp-*.mjs':
        'Vite recompile sa config dans un module horodaté posé à côté d’elle, puis l’efface — mesuré ' +
        '(`vite.config.ts.timestamp-1788894628882-….mjs`, sonde 2026-09-08). LA PORTE : AUCUNE gate ne lit ' +
        'ce chemin — c’est un module que Vite écrit pour lui-même, sous un nom que le suffixe horodaté rend ' +
        'unique à chaque run, et il est gitignoré (.gitignore, section « Config de Vite recompilée »), donc ' +
        'il ne salit pas l’arbre. `ecrit` le dirait CHEVAUCHANT `vite.config.ts` (recouvrement par PRÉFIXE), ' +
        'que `test` et `typecheck` lisent depuis d’autres lanes : ce serait un faux conflit',
    },
    lit: ['src/', 'scripts/', 'Source/', 'tsconfig.json', 'vite.config.ts', 'package.json', 'index.html', CACHE_FRAICHEUR],
    raison: RETRAIT_WORKTREE_FERME +
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
      [CACHE_FRAICHEUR]:
        'certificat écrit par ecrireJsonAtomique (scripts/guards/lib/ecritureJsonAtomique.mjs), temporaire propre au PID puis renommage sur ce cache gitignoré sous docs/.cache/, hors arbre versionné ; seuls build et docs:build lisent celui de la racine réelle : ' +
        'même job/lane docs de ci.yml, joués séquentiellement par jouerLane ; les autres lanes ne lisent que leurs caches de fixtures sous os.tmpdir()',
      'docs/':
        'les mesures docs/.sources-lues.json sont écrites par build-all.mjs ; ' +
        'les cibles PURES de `GENERATORS` ne sont pas commitées (#2203 A2) : leurs lecteurs les RENDENT ' +
        '(`rendreCible`, scripts/docs/build-all.mjs), jamais du disque ; un MIXTE (`injecte`) n’est réécrit que ' +
        'si son rendu diffère (`ecrireOuVerifier`), ce que `Arbre inchangé` refuse dans le même job',
      'src/':
        'les cibles de CODE sont produites AVANT toute gate (`npm run gen`, ci-dessous) : `ecrireOuVerifier` ' +
        'ne réécrit pas un rendu identique',
    },
    lit: ['docs/', 'src/', 'scripts/', 'Source/', '.claude/memory/', CACHE_FRAICHEUR],
    raison:
      'chaque générateur de `GENERATORS` joué en écriture, puis les vérificateurs purs ; LIT Source/ ' +
      '(catalogues et rapports d’Atlas) et .claude/memory/ parce que `build-doctrines.mjs` dérive ' +
      '`docs/doctrines.md` des fiches `.claude/memory/user-*.md` SUIVIES par git (`fichesSuivies`) ; ' +
      'protectionWorktree.mjs est acquis par gitPorte.mjs : son unique écrivain retirerResiduelVide appelle rmdirSync, ' +
      'uniquement depuis retirerWorktree ; aucun générateur de docs:build ne demande un retrait de worktree',
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
        'routeur, domaines de chaque cœur) ; son unique écriture (`ecrireDoc`) vit dans `main()`, sous sa ' +
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
    raison: RETRAIT_WORKTREE_FERME +
      'harnais de l’Atlas : il lit les fiches que les trois rapports écrivent ; éprouvant les scripts ' +
      'eux-mêmes, il LIT ce qu’ils lisent — Source/ et src/ ; ses deux bancs ' +
      'écrivains (`check-source-format.test.mjs`, `lib/marker-pages.test.mjs`) ne posent que des dossiers ' +
      'JETABLES sous `os.tmpdir()`, retirés par `rmSync` — aucune écriture dans l’arbre ; +3 écrivains le ' +
      '2026-09-20 (#1825) : `apply-livre.test.mjs` et `assemble-domain.test.mjs`, même régime ' +
      'os.tmpdir(), et `assemble-domain.mjs`, ACQUIS par l’import de son banc — ses `writeFileSync` vivent ' +
      'dans `assemble()`, appelée par le seul `main()`, sous sa porte `import.meta.main` ; +4 le 2026-09-20 ' +
      '(#1825) : la fabrique d’Atlas jetable (`atlasFixture.mjs`) et les deux bancs qui la ' +
      'prennent (`_lib.test.mjs`, `build-atlas-index.test.mjs`), même régime os.tmpdir(), et ' +
      '`build-atlas-index.mjs`, ACQUIS par l’import de son banc — son écriture (`ecrireDoc`) vit dans ' +
      '`main()`, sous sa porte `import.meta.main` ; +1 lecture le 2026-09-22 (#1873) : ' +
      '`atlas-domain.workflow.test.mjs` lit les fiches d’agent de .claude/agents/ (frontmatter `tools:`) ' +
      'pour tenir la liste des types SANS outil d’écriture (`typesEnLectureSeule` de scripts/guards/lib/typesDAgent.mjs) — ' +
      'la gate n’est plus sautable : un push qui donne `Edit` à `lecteur` doit la jouer ; +1 écrivain le ' +
      '2026-09-23 (#1739) : `pdf-de.test.mjs`, même régime os.tmpdir() (`avecSource`) — son PDF et ses dossiers de sortie Marker ' +
      'factices ne naissent que sous la racine `source` INJECTÉE dans la couture (scripts/raw/_lib.mjs) ; +3 écrivains le ' +
      '2026-10-15 (#2603) : `ecritureJsonAtomique.mjs`, `renommageResilient.mjs` et `test/verrou.mjs`, ACQUIS par ' +
      '`ecriture-derives.mjs` → `ecrivain-derives.mjs` (l’écrivain unique des dérivés) — `ecrireDoc` n’est appelé que ' +
      'sous la porte `import.meta.main` des scripts de scripts/raw/, que les bancs de la gate n’appellent pas',
  },
  'raw:check-refs': {
    ecrit: [],
    lit: ['docs/raw/', 'Source/', 'src/data/books.json', 'src/data/source/', 'src/lib/regex.ts', 'scripts/raw/', 'scripts/guards/lib/', 'scripts/port-dev.mjs'],
    raison: RETRAIT_WORKTREE_FERME +
      'aucune écriture dans les scripts atteints ; LIT le registre de livres et le normaliseur de références ' +
      '(src/data/books.json, src/data/source/normalize.ts) et son stock scripts/raw/dead-refs-stock.json, absent quand il est soldé',
  },
  'raw:check-code-refs': {
    ecrit: [],
    lit: ['docs/raw/', 'src/', 'Source/', 'scripts/raw/', 'scripts/guards/lib/', 'scripts/port-dev.mjs'],
    raison: RETRAIT_WORKTREE_FERME +
      'aucune écriture dans l’arbre : `ecritureJsonAtomique.mjs`, `renommageResilient.mjs` et `test/verrou.mjs`, ACQUIS (#2603) par ' +
      '`build-implemente.mjs` → `ecriture-derives.mjs` → `ecrivain-derives.mjs` (l’écrivain unique des dérivés), n’écrivent ' +
      'que sous la porte `import.meta.main` de scripts/raw/build-implemente.mjs, que la gate n’appelle pas ; ' +
      'LIT Source/, les stocks scripts/raw/dead-code-refs-stock.json et ' +
      'scripts/raw/empty-line-code-refs-stock.json, absents quand ils sont soldés, et scripts/raw/graphy-stock.json (sites différés)',
  },
  'raw:check-ancres': {
    ecrit: [],
    lit: ['docs/raw/', 'src/data/books.json', 'src/data/source/', 'src/lib/regex.ts', 'scripts/raw/', 'scripts/guards/lib/', 'scripts/port-dev.mjs'],
    raison: RETRAIT_WORKTREE_FERME +
      'aucune écriture, et AUCUN stock : l’ancre d’un titre se CALCULE (scripts/raw/lib/ancres.mjs), '
      + 'donc un renvoi mort est un renvoi faux, jamais un héritage à geler. LIT les pages de l’Atlas, '
      + 'le registre de livres (énumération des cœurs, `pagesDeLAtlas`) et l’extracteur de liens partagé '
      + '(scripts/guards/lib/liensMarkdown.mjs) ; l’outil qui répare (scripts/raw/reparer-ancres.mjs) '
      + 'écrit sous sa porte `--apply`, que la commande de .github/workflows/ci.yml n’appelle pas',
  },
  'raw:check-folio-continuity': {
    ecrit: [],
    lit: ['docs/raw/', 'Source/', 'src/data/books.json', 'src/data/source/', 'src/lib/regex.ts', 'scripts/raw/', 'scripts/guards/lib/', 'scripts/port-dev.mjs'],
    raison: RETRAIT_WORKTREE_FERME +
      'LIT le registre de livres, le normaliseur de références, ' +
      'le stock NOMINATIF des sauts de folio (scripts/raw/folio-gaps-stock.json) et les deux stocks des ancres ' +
      'sans contenu (scripts/raw/empty-folios-perdues-stock.json, scripts/raw/empty-folios-benignes-stock.json) ; ' +
      'aucune écriture n’est atteinte',
  },
  'raw:check-source-tables': {
    ecrit: [],
    lit: ['Source/', 'src/data/books.json', 'src/data/source/', 'src/lib/regex.ts', 'scripts/raw/', 'scripts/guards/lib/', 'scripts/port-dev.mjs'],
    raison: RETRAIT_WORKTREE_FERME +
      'LIT le registre de livres, le parseur de tables (src/data/source/decoupe.ts), les dossiers à `dir` de ' +
      'Source/ et son stock nominatif scripts/raw/source-tables-stock.json ; aucune écriture ' +
      'n’est atteinte',
  },
  'raw:check-source-puces': {
    ecrit: [],
    lit: ['Source/', 'src/data/books.json', 'src/data/source/', 'src/lib/regex.ts', 'scripts/raw/', 'scripts/guards/lib/', 'scripts/port-dev.mjs'],
    raison: RETRAIT_WORKTREE_FERME +
      'LIT le registre de livres, le normaliseur de citations (src/data/source/decoupe.ts), les dossiers ' +
      'à `dir` de Source/ et son stock nominatif scripts/raw/source-puces-stock.json ; aucune écriture ' +
      'n’est atteinte',
  },
  'raw:check-renvois': {
    ecrit: [],
    lit: ['Source/', 'src/data/books.json', 'src/data/source/', 'src/lib/regex.ts', 'src/data/hash.ts', 'scripts/raw/', 'scripts/source/', 'scripts/guards/lib/'],
    raison: RETRAIT_WORKTREE_FERME +
      'LIT le registre de livres, les chapitres des livres couverts par le lecteur fs (scripts/source/lecteur-fs.mjs), ' +
      'le résolveur PUR src/data/source/renvoi.ts et son stock nominatif scripts/raw/renvois-stock.json ; aucune ' +
      'écriture n’est atteinte',
  },
  'raw:check-source-format': {
    ecrit: [],
    lit: ['Source/', 'src/data/books.json', 'src/lib/regex.ts', 'scripts/raw/', 'scripts/source/nom-ascii.mjs', 'scripts/guards/lib/', 'scripts/port-dev.mjs'],
    raison: RETRAIT_WORKTREE_FERME +
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
 *  imprime, et le MÊME texte que la préflight de `scripts/ops/etapesDuTrain.mjs` rend AVANT la série. PURE. */
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

/** Les `n` dernières lignes non vides d'un texte — la queue qu'on imprime sous un rouge. */
export const queue = (texte, n) =>
  texte
    .split('\n')
    .filter((l) => l.trim() !== '')
    .slice(-n)

/** Lignes de queue imprimées sous chaque rouge du résumé. */
const LIGNES_DE_QUEUE = 40

/** Le script de `package.json` que joue une gate (`npm test` → `test`, `npm run x` → `x`). */
const scriptDeGate = (gate) => (gate.nom === 'test' ? 'test' : gate.nom)

const arretNonConfirme = (arret) => arret?.etat !== 'mort'

export async function arreterGatesSurSignal({ signal, vivants, verrousTenus, journal, arreter = tuerArbre, lancementsEnCours = [] }) {
  journal(`\n[gates] ${signal} — demande d'arrêt de l'arbre de chaque gate en cours.\n`)
  const controles = [...vivants.values()]
  for (const controle of controles) controle.demanderArret()
  const arrets = controles.map(async (controle) => {
    try { return await arreter(controle) }
    catch (cause) { return { etat: 'indetermine', erreurs: [{ operation: 'arret', pid: controle.pid, code: cause.code ?? 'ARRET_INDETERMINE', message: cause.message, cause: cause.cause }] } }
  })
  const resultats = await Promise.all([...arrets, ...[...lancementsEnCours].map(async (fin) => (await fin).arret)])
  let indetermine = false
  for (const vu of resultats) if (diagnosticArret({ arret: vu }, (ligne) => journal(ligne + '\n')) || arretNonConfirme(vu)) indetermine = true
  if (!indetermine) for (const tenu of verrousTenus) tenu.liberer()
  else journal('[gates] arrêt indéterminé — aucun verrou libéré manuellement.\n')
  return 130
}

/**
 * Joue toutes les gates exigées. `racine`, `argv` et `journal` sont INJECTÉS : sans cela, ni la
 * politique d'arrêt ni le résumé ne se mesurent autrement qu'en jouant les vraies gates.
 * `horloge` porte les chronomètres et l'attente du verrou, jamais l'horloge murale des enfants supervisés.
 * `prendre` prend le verrou des gestes lourds, `lancer` joue chaque gate (`spawnBorne`), `sortir` reçoit le
 * code du gestionnaire de SIGINT/SIGTERM (`process.exit`).
 * REND le code de sortie.
 */
export async function principal({
  racine = RACINE,
  argv = process.argv,
  journal = (t) => process.stderr.write(t),
  ecritLu = ECRIT_LU,
  machine = availableParallelism(),
  env = process.env, signal, verrou: instance, prendre = prendreVerrouAsync, lancer = spawnBorne, horloge = Date.now,
  sortir = process.exit,
} = {}) {
  const configuration = instance ?? verrouGestesLourds(racine)
  const secondesDepuis = (debut) => (horloge() - debut) / 1000
  const LISTE = argv.includes('--liste')
  const SERIE = argv.includes('--serie') || !lanesPortees(machine) || jetonsDuVerrou(env, configuration.chemin).length > 0
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
  const avantGen = horloge()
  const gen = spawnSync('npm', ['run', 'gen'], {
    cwd: racine,
    stdio: ['ignore', 'ignore', 'pipe'],
    shell: process.platform === 'win32',
    encoding: 'utf8',
    env,
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
  const lancementsEnCours = new Set()
  // #1772 #2586
  const verrousTenus = new Set()
  const arretDesAttentes = new AbortController()
  const signalDePrise = signal ? AbortSignal.any([signal, arretDesAttentes.signal]) : arretDesAttentes.signal
  let arretSurSignal
  const arreterSurSignal = (signal) => {
    arretDesAttentes.abort()
    arretSurSignal ??= arreterGatesSurSignal({ signal, vivants, verrousTenus, journal, lancementsEnCours }).then((code) => sortir(code))
  }
  const surSigint = () => arreterSurSignal('SIGINT')
  const surSigterm = () => arreterSurSignal('SIGTERM')
  process.on('SIGINT', surSigint)
  process.on('SIGTERM', surSigterm)
  try {

    /** Un ROUGE de gate rendu SANS spawn : `sortie` écrite dans le fichier de la gate. */
    const rougeSansSpawn = (gate, sortie, code = 1) => {
      const fichier = join(dossierSorties(racine), fichierDeSortie(gate.nom, process.pid))
      writeFileSync(fichier, sortie)
      return { code, expiree: false, fichier, sortie, limiteMs: limiteDe(gate.nom), arret: { etat: 'mort', erreurs: [] } }
    }

    /** Joue UNE gate, sortie dans son fichier, bornée par son plafond, rejouée si elle n'a pas démarré. */
    const jouerGate = async (gate, coeurs, envEnPlus) => {
      let terminerLancement
      let arretDuLancement = { etat: 'mort', erreurs: [] }
      const finDuLancement = new Promise((ok) => { terminerLancement = ok })
      lancementsEnCours.add(finDuLancement)
      try {
      const fichier = join(dossierSorties(racine), fichierDeSortie(gate.nom, process.pid))
      // PRÉREQUIS D'ABORD : jouer une gate dont le prérequis manque rend l'erreur brute de son outil
      // (un TS2688 pour `server:typecheck`), qui ne nomme ni le dossier absent ni la commande qui le
      // pose. Le verdict est le même ROUGE, mais il DIT quoi faire — et rien n'est spawné. Ce refus ne
      // pèse que sur CE rejeu local : la gate reste jouée, elle, par le run CI de la branche.
      const absents = prerequisAbsents(ecritLu[gate.nom], racine)
      if (absents.length) return rougeSansSpawn(gate, refusDePrerequis(gate.nom, absents))
      // La commande est celle de `ci.yml`, TELLE QUELLE : ce qui se rejoue ici est ce que la CI joue.
      // Un script absent de `package.json` est un rouge NOMMÉ, pas un `npm` qui se plaint tout seul.
      const script = scriptDeGate(gate)
      if (!scripts[script]) {
        return rougeSansSpawn(gate, `[gates] ${gate.nom} — aucun script « ${script} » dans package.json (step de ci.yml : ${gate.commande})\n`)
      }
      const envGate = { ...env, ...envEnPlus }
      if (coeurs && !envGate.WFRP_TEST_COEURS) envGate.WFRP_TEST_COEURS = String(coeurs)
      const [commande, ...args] = gate.commande.split(' ')
      const r = await lancer({
        commande,
        argv: args,
        fichier,
        limiteMs: limiteDe(gate.nom),
        cwd: racine,
        env: envGate,
        signal,
        site: `gate ${gate.nom}`,
        surControle: (controle) => { arretDuLancement = { etat: 'indetermine', erreurs: [] }; vivants.set(gate.nom, controle) },
      })
      if (!arretNonConfirme(r.arret)) vivants.delete(gate.nom)
      arretDuLancement = r.arret

      return r
      } finally {
        terminerLancement({ arret: arretDuLancement })
        lancementsEnCours.delete(finDuLancement)
      }
    }

    // #1772 #2586
    const poser = (nom, r) => {
      const secondes = secondesDepuis(r.debut)
      const statut = r.expiree ? 'EXPIRÉE' : r.code === 0 ? 'vert' : 'ROUGE'
      verdicts.set(nom, { statut, code: r.code, secondes, fichier: r.fichier, sortie: r.sortie, limiteMs: r.limiteMs, error: r.error, arret: r.arret })
      diagnosticArret(r, (ligne) => journal(ligne + '\n'))
      if (arretNonConfirme(r.arret)) arretDesAttentes.abort()
      journal(`[gates] ${nom} — ${statut} (exit ${r.code}) en ${secondes.toFixed(1)} s · ${r.fichier}\n`)
      return statut
    }

    const jouerLane = async (lane) => {
      const debut = horloge()
      for (const nom of lane.gates) {
        const gate = aJouerParNom.get(nom)
        const refusDeCapacite = () => {
          const indeterminees = [...vivants.keys()].filter((enCours) => verdicts.has(enCours) && arretNonConfirme(verdicts.get(enCours).arret))
          return indeterminees.length
            ? `[gates] ${nom} — REFUS CAPACITE_ARRET_INDETERMINE : ${indeterminees.map((n) => `${n} PID ${vivants.get(n)?.pid}`).join(', ')} ; capacité retenue, arrêt non confirmé.\n`
            : null
        }
        const refusAvantPrise = refusDeCapacite()
        if (refusAvantPrise) {
          poser(nom, { ...rougeSansSpawn(gate, refusAvantPrise, 2), debut: horloge() })
          continue
        }
        // #2187 #2586
        const lourde = lanceUnGesteLourd(scripts[scriptDeGate(gate)])
        const debutAttente = horloge()
        const verrou = lourde
          ? await prendre({
              ...configuration, env, horloge, signal: signalDePrise, commande: 'gates ' + nom, cwd: racine,
              attente: { ...configuration.attente, annoncer: (tenant) => {
                journal('[gates] ' + nom + ' — attente du geste lourd : ' + tenantEnUneLigne(tenant) + '\n')
              } },
            })
          : null
        if (verrou?.liberer) verrousTenus.add(verrou)
        if (lourde) journal(`[gates] ${nom} — ${((horloge() - debutAttente) / 1000).toFixed(1)} s d'attente du geste lourd (hors chronomètre)\n`)
        const debutGate = horloge()
        try {
          const refusApresPrise = refusDeCapacite()
          const r = refusApresPrise
            ? rougeSansSpawn(gate, refusApresPrise, 2)
            : verrou?.etat === 'refus' ? rougeSansSpawn(gate, verrou.message + '\n', CODE_DIFFERE)
            : await jouerGate(gate, !SERIE && nom === 'test' ? COEURS_SUITE_EN_LANES : null, verrou?.env)
          poser(nom, { ...r, debut: debutGate })
        } finally {
          if (!arretNonConfirme(verdicts.get(nom)?.arret)) {
            verrou?.liberer?.()
            verrousTenus.delete(verrou)
          }
        }
      }
      return { nom: lane.nom, secondes: secondesDepuis(debut) }
    }

    const photoDepart = photoArbre(racine)
    const debutTotal = horloge()

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
  } finally {
    process.removeListener('SIGINT', surSigint)
    process.removeListener('SIGTERM', surSigterm)
  }
}

if (import.meta.main) {
  process.exit(
    await principal().catch((e) => {
      process.stderr.write(`[gates] ARRÊT INATTENDU : ${e?.stack ?? e}\n`)
      return 1
    }),
  )
}
