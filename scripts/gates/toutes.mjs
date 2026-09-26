#!/usr/bin/env node
// `npm run gates` (#1679 L2) — joue les gates de `ci.yml` en LANES PARALLÈLES et rend, DANS L'ORDRE
// DE `ci.yml`, le verdict de chacune. C'est la commande que le refus du pre-push nomme : le régime
// « suite complète + tsc avant push » a un prix, et ce prix s'imprime ici, gate par gate.
//
// T1d change le MUR, jamais le VERDICT : `--serie` joue exactement les mêmes gates en une lane
// unique, dans l'ordre de ci.yml (morsure d'équivalence, `scripts/gates/toutes.test.mjs`).
//
// TROIS PHASES, et l'ordre est la garantie :
//   1. `npm run gen`, puis les gates qui ÉCRIVENT dans l'arbre (`AVANT_LES_LANES`) — EN SÉRIE. Ce
//      qu'elles réécrivent est NOMMÉ tout de suite, au lieu d'un « l'arbre a changé » sept minutes
//      plus tard, et aucune lane ne peut lire un fichier pendant qu'une autre l'écrit.
//   2. les LANES, qui ne contiennent plus que des LECTEURS.
//   3. le RÉSUMÉ, puis la photo de l'arbre. Dans cet ordre : un résumé est ce qu'on vient de payer,
//      il s'imprime AVANT tout ce qui pourrait encore échouer.
//
// L'ARBRE DOIT ÊTRE PROPRE AVANT LE PREMIER SPAWN : une gate jouée sur un arbre sale ne justifie
// rien (le pre-push la refusera), et la découvrir après dix minutes de gates est le pire moment.
//
// SOUS CHARGE, UN PROCESSUS PEUT NE PAS DÉMARRER : le 2026-09-04, quatre lanes en parallèle ont fait
// rendre `3221225794` (STATUS_DLL_INIT_FAILED) au loader Windows sur quatre spawns d'un même run —
// `docs:check` ROUGE à 48,6 s, `build` ROUGE sans une ligne d'erreur, un justificatif de `typecheck`
// jamais écrit, 47 tests de la suite en `expected 3221225794`. Tout spawn passe donc par
// `scripts/guards/lib/spawnResilient.mjs`, qui REJOUE ce cas-là (et lui seul) ; le nombre de rejeux
// est imprimé au résumé — c'est LE compteur de pression, la mémoire système ne discriminant rien
// (100 % à 15 workers comme à 9).
//
// PAS DE VERROU DE PUSH, et c'est mesuré (juge de design T1d, 2026-09-04) : le PID qui écrirait ce
// verrou est MORT au moment du push — le processus de gates a rendu la main — donc la session
// suivante le reprend (patron « pid vivant » de `scripts/test/verrou.mjs`) et celle qui a PAYÉ les
// gates est refusée : effet inversé. Modèle mesuré, 3 sessions et un push toutes les 45 min :
// p(rebase forcé) ≈ 2 × durée-des-gates / 45, soit 53 % à 12 min et 19 % à 4,3 min. RACCOURCIR les
// gates fait davantage que ne ferait le verrou, et ne fait attendre personne.
//
// VERROU MACHINE POUR TOUTE LA DURÉE (#1679 L3b) : ce lanceur prend le verrou de suite
// (`scripts/test/verrou.mjs`, même hôte) avant de jouer quoi que ce soit et le rend à la fin — trois
// lanes chargent la machine autant qu'une suite. Un second run de gates est REFUSÉ (exit 2) en
// nommant le PID tenant ; la suite lancée par la lane `suite` ne le reprend pas (jeton de réentrance).
//
// `--tout` rejoue tout, justificatif ou pas (mesure du coût plein) ; `--liste` n'imprime que le plan
// (ce qui serait joué, et pourquoi) sans rien jouer ; `--serie` joue tout en une lane.
//
// Chaque gate passe par `scripts/gates/justifie.mjs`, jamais par la commande nue : c'est lui qui
// écrit le justificatif au vert, et lui seul. Quand un script `<gate>:brut` existe, c'est LUI qui est
// joué : sans quoi `npm run <gate>` rentrerait dans une deuxième enveloppe et écrirait deux fois.
import { spawn, spawnSync } from 'node:child_process'
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, resolve } from 'node:path'
import { enteteArbre } from '../guards/lib/enteteArbre.mjs'
import {
  clesDeContenu,
  gatesRequises,
  justificatifsSousDAutresCles,
  lireJustificatif,
  migrerAncienneGraphie,
  motifDeRefus,
  perimetreSale,
  segmentDeGate,
} from '../guards/lib/justificatif.mjs'
import {
  compterRejeux,
  execFileResilient,
  reessayerAuChargement,
  rejeux,
} from '../guards/lib/spawnResilient.mjs'
import { codeEnfant } from '../test/partition.mjs'
import { PEREMPTION_MS, purgerPerimes } from '../guards/lib/purgerPerimes.mjs'
import { avecVerrouMachine } from '../test/verrou.mjs'
const RACINE = fileURLToPath(new URL('../..', import.meta.url))
/** Dossier de CE script : l'enveloppe `justifie.mjs` vit ici, pas dans l'arbre mesuré. */
const ICI = fileURLToPath(new URL('.', import.meta.url))

/**
 * Ce que chaque gate ÉCRIT et LIT dans l'ARBRE, MESURÉ (sonde d'écritures transitives sur les
 * scripts atteints par la commande de `ci.yml`, 2026-09-04 ; chaque ligne re-vérifiée à la source).
 * Repassée le 2026-09-08 (#1709 E) à l'ENREGISTREUR DE LECTURES (`scripts/docs/lib/enregistreur-lectures.mjs`
 * posé en `--import` sur la commande de chaque gate) : `lit` déclare désormais aussi le CODE que la
 * gate exécute — le changer change son verdict, donc c'est une lecture. Angles morts de la sonde,
 * nommés : ce qu'un sous-processus NON-node lit (`git ls-files` de src/source-eol-guard.test.ts:50,
 * `tsc`/`eslint` binaires) lui échappe, et un chemin RELATIF écrit par un enfant dont le `cwd` est un
 * dépôt jetable lui apparaît sous la racine (vérifié fichier par fichier avant d'être écrit ici).
 * `lit` est ce qui décide de la CLÉ : une entrée touchant `docs/` ou `.claude/` exige la gate dans
 * `RAISON_CLE_COMPLETE` (garde dérivée, `toutes.test.mjs`).
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
      'mode `check` : `runCompat` n’écrit que sous `mode === "sync"` (scripts/agents/compat-cli.mjs:64,72) ; ' +
      'les 48 lectures mesurées sont les DEUX côtés de la compat — .claude/ (source) et .agents/ + .codex/ + ' +
      'AGENTS.md + CLAUDE.md (miroirs comparés), plus son propre code',
  },
  'test:agents': {
    ecrit: [],
    lit: ['scripts/agents/'],
    raison: 'les écritures sont INJECTÉES et comptées, jamais faites (scripts/agents/compat.test.mjs:65)',
  },
  'test:hooks': {
    ecrit: [],
    ecritFerme: {
      '.claude/logs/new-src-guard-skips.log':
        'journal d’urgences du garde de nouveaux fichiers (scripts/hooks/new-src-file-guard.mjs:35) : il est ' +
        'GITIGNORÉ (.gitignore:41 `.claude/*`, sans négation pour `logs/`), donc il n’entre dans aucune des ' +
        'deux clés de contenu et ne salit pas l’arbre ; aucune gate ne le lit',
    },
    lit: [
      '.claude/', '.codex/', '.github/workflows/', 'docs/', 'scripts/', 'src/', 'Source/',
      'CLAUDE.md', 'eslint.config.js', 'package.json', 'tsconfig.json',
    ],
    raison:
      'le registre d’écrans que `new-src-file-guard.test.mjs` éprouve est INJECTABLE (`WFRP_REGISTRE_ECRANS`, ' +
      'scripts/hooks/new-src-file-guard.mjs:42) et le test en écrit une COPIE sous os.tmpdir() ; ' +
      'le reste des fixtures vit sous os.tmpdir() ; LIT docs/ et src/ parce que `enregistreur-lectures.test.mjs` ' +
      'joue de VRAIS générateurs en `--check` (build-index-moteur, build-donnees, build-structures), qui comparent ' +
      'sans écrire ; LIT Source/ parce que `idempotence-ordre-des-cles.test.mjs` copie le corpus (Source/ moins les ' +
      '`.pdf`, écartés par extension : sans les extractions quatre migrations sortent 1 faute de livres) sous ' +
      'os.tmpdir() avant de rejouer les 89 migrations ; LIT .codex/hooks.json et .claude/settings.json ' +
      '(parité des canaux), .github/workflows/ci.yml, CLAUDE.md, eslint.config.js et package.json — ' +
      'sonde 2026-09-08, 4 117 lectures. Le retrait des trois fichiers les plus lents ne la sortirait PAS ' +
      'de src/ : 3 715 lectures y subsistent sans eux (mesuré)',
  },
  'test:ops': {
    ecrit: [],
    lit: ['src/', 'scripts/ops/', 'scripts/guards/lib/', 'scripts/hooks/', '.claude/workflows/', '.github/workflows/', 'knip.json', 'knip-exports-baseline.json'],
    raison:
      'sept modules atteints portent un appel d’écriture, tous hors de l’arbre ou gardés : ' +
      '`knip-exports-ratchet.mjs` (`main()` gardé par `import.meta.url === argv[1]`, l.121 ; seul `--sync` ' +
      'écrirait la baseline, l.94-96), `ruleset-evaluate.mjs` (le corps du ruleset part par un fichier de ' +
      'os.tmpdir(), l.90-97), `fermer-depuis-main.test.mjs` (dépôts jetables de os.tmpdir()) et ' +
      '`justificatif.mjs`, atteint depuis 2026-09-04 par `pushes-justifies.mjs` : ses seules écritures ' +
      'visent `<git-common-dir>/wfrp-justificatifs/` (justificatif.mjs:136,239-243,277,286-289), soit `.git/`, ' +
      'hors de l’arbre — et `pushes-justifies.test.mjs` n’éprouve que des fonctions PURES, sans disque ; LIT ' +
      '.github/workflows/ parce que `canari.test.mjs:17` et `ruleset-evaluate.test.mjs:13` lisent les ' +
      'workflows RÉELS, et scripts/guards/lib/ par le stock de `fermetures-non-citees.mjs` ; depuis ' +
      '2026-09-04, `faits-de-palier.mjs` écrit le JSON des faits à `--sortie`, sous `os.tmpdir()` par ' +
      'défaut (`sortieParDefaut`), et crée `<git-common-dir>/wfrp-justificatifs/` par `cheminJustificatifs` ' +
      '— `.git/`, hors de l’arbre ; depuis 2026-09-07 (#1709 B1), `depotGabarit.mjs` fabrique les dépôts ' +
      'jetables de `fermer-depuis-main.test.mjs` et `faits-de-palier.test.mjs` : ses seules écritures ' +
      '(`mkdtempSync`, `cpSync`, `rmSync` — depotGabarit.mjs:62,82,99-100) visent `os.tmpdir()` ; ' +
      'LIT .claude/workflows/ (`workflows.test.mjs` les parse, `workflows-joues.test.mjs` les joue) ' +
      'et scripts/hooks/ (`validateRevuePalier` de solde-ticket-guard.mjs), sans rien y écrire ; LIT knip.json ' +
      '(le cliquet d’exports le relit) ; les 3 fichiers de .claude/workflows/ sont lus EN PLACE, sur l’arbre ' +
      'réel — c’est cette lecture qui met la gate sous la clé COMPLÈTE (sonde 2026-09-08, deux passes). ' +
      'Ce que `soldesSuivis()` lirait de .claude/soldes/ n’est atteint que par le `main()` du script, ' +
      'gardé par `import.meta.url === argv[1]` (fermetures-non-citees.mjs:195) : les tests passent leurs ' +
      'PROPRES dépôts jetables, et la sonde n’a mesuré aucune lecture sous .claude/soldes/',
  },
  'test:runner': {
    ecrit: [],
    lit: ['scripts/', 'package.json'],
    raison:
      'chaque cas fabrique son arbre sous os.tmpdir() (`mkdtempSync`), y compris son node_modules/.cache ; ' +
      'LIT package.json (les scripts que le runner relaie)',
  },
  'test:docs': {
    ecrit: [],
    lit: [
      'docs/', '.claude/memory/', 'scripts/docs/', 'scripts/guards/lib/', 'scripts/test/partition.mjs',
      'scripts/lancer-local.mjs', 'scripts/outillage-local.mjs',
    ],
    raison:
      'fixtures sous os.tmpdir() ; lit les docs et la mémoire réels (RAISON_CLE_COMPLETE, justificatif.mjs:93) ' +
      'et scripts/guards/lib/ (`check-plans-anchors.test.mjs` lit le code de `lister.mjs` et importe ' +
      '`depotGabarit.mjs`), sans rien y écrire ; LIT les trois modules du lanceur local que `build-all.mjs` ' +
      'ramène (sonde 2026-09-08, 50 lectures)',
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
    lit: ['src/', 'scripts/', 'server/', 'eslint.config.js', 'package.json', 'kill-pid.mjs'],
    raison:
      '`eslint .` sans `--fix` ni `--cache` ; LIT sa config à plat, package.json et le seul module de ' +
      'racine qu’il ramène — aucune lecture sous docs/ ni .claude/ (sonde 2026-09-08, 4 009 lectures)',
  },
  test: {
    ecrit: [],
    ecritFerme: {
      'src/_registry.generated.ts':
        'le `buildStart` de vite.config.ts:16 appelle `genAll()`, qui n’écrit que `if (changed)` ' +
        '(scripts/gen-registry.mjs:435,662) — `toutes.mjs` joue `npm run gen` AVANT les lanes et REFUSE si un ' +
        'registre bouge, donc il ne reste rien à écrire',
    },
    lit: ['src/', 'server/src/', 'scripts/map/', 'docs/', '.claude/memory/', 'Source/', '.gitattributes', 'vite.config.ts'],
    raison:
      'LIT docs/ ET docs/raw/ — 9 fichiers de la suite, 12 sites (mesuré 2026-09-08) : la famille des ' +
      'CLIQUETS ET CONTRATS qui confrontent le code à un doc DÉRIVÉ (data-atlas-complete, ' +
      'index-moteur-ratchet, slots-contrat, structures-contrat, roll-seam-exclusivity-guard, ' +
      'scene-field-editability-guard, ui-ratchets, oversize-search-blindspot) plus le balayage de docs/ à ' +
      'plat de manual-docs-ratchet:30 — d’où la lane SÉPARÉE des trois écrivains de docs/raw ; ' +
      'LIT .claude/memory/ (src/memory-links-guard.test.ts:81 balaie l’arbre RÉEL) ; LIT Source/ (verbatims ' +
      'et résolution de prose : src/data/psychology-verbatim.test.ts:24, tavern-desc-verbatim.test.ts:20, ' +
      'variants-integrity.test.ts:234, vdm-objets-maudits.test.ts:154, prose-resolution.test.ts:142, ' +
      'src/oversize-search-blindspot.test.ts:121) ; LIT .gitattributes parce que le verdict de ' +
      'src/source-eol-guard.test.ts:45 tient à la colonne `-text` que `git ls-files --eol` en tire',
  },
  build: {
    ecrit: [],
    ecritFerme: {
      'src/_registry.generated.ts': 'même `genAll()` que la suite, même porte : `npm run gen` avant les lanes',
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
      '`gen && vite build` : le typage est jugé par la gate `typecheck` (ci.yml:52, avant `build`), ' +
      '`build` juge que le bundle se construit, et `dist/` n’est lu par aucune gate ; LIT tsconfig.json ' +
      'parce que l’esbuild de Vite y relit `target`/`jsx`/`useDefineForClassFields` pour transformer ' +
      'chaque module TS (les `meaningfulFields` que Vite 5.4 recopie dans `tsconfigRaw`) — `paths`, lui, ' +
      'n’en vient pas : l’alias `@` est déclaré dans vite.config.ts:47 ; LIT Source/ parce que le plugin ' +
      '`wfrp:prose-source` (scripts/source/prose-source-plugin.mjs) y résout la prose que les entrées ADRESSENT ' +
      '— la sonde du 2026-09-08 n’a compté AUCUNE lecture sous Source/ sur un build complet (2 056 lectures) : ' +
      'la déclaration reste, une sur-déclaration ne peut que RESSERRER les lanes ; LIT aussi index.html ' +
      '(l’entrée) et package.json',
  },
  'docs:check': {
    ecrit: [],
    lit: ['docs/', 'src/', 'scripts/', 'Source/', '.claude/memory/'],
    raison:
      'les générateurs y tournent en `--check` : ils COMPARENT (build-all.mjs, `if (check) continue`) ; ' +
      'LIT .claude/memory/ parce que `build-doctrines.mjs` dérive `docs/doctrines.md` des fiches ' +
      '`.claude/memory/user-*.md` SUIVIES par git (build-doctrines.mjs:195)',
  },
  'docs:empreinte': {
    ecrit: [],
    lit: [
      'docs/', 'scripts/docs/', 'scripts/guards/lib/', 'scripts/test/partition.mjs',
      'scripts/lancer-local.mjs', 'scripts/outillage-local.mjs',
    ],
    raison:
      '`--empreinte` sort avant toute génération (build-all.mjs, branche `--empreinte` de `main`) : les 9 ' +
      'lectures mesurées sont `docs/.sources-lues.json` et son propre code — les BLOBS qu’il compare sortent ' +
      'de l’INDEX (`indexGit`), jamais du disque',
  },
  'raw:coverage': {
    ecrit: [],
    ecritFerme: {
      'docs/raw/coverage.md':
        'scripts/raw/coverage.mjs:422 passe par `ecrireDoc`, qui n’écrit QUE si le rendu diffère du fichier ' +
        '(scripts/docs/lib/empreinte-sources.mjs, patron gen-registry.mjs:435) : sur l’arbre PROPRE qu’exige ce ' +
        'lanceur, un rapport à jour n’est pas réécrit. S’il est périmé au commit, il est réécrit UNE fois et ' +
        '`photoArbre` avant/après fait REFUSER le run — jamais un vert de course',
    },
    lit: ['docs/raw/', 'src/', 'Source/', 'scripts/raw/', 'scripts/guards/lib/lister.mjs', 'scripts/docs/lib/empreinte-sources.mjs'],
    raison:
      'la suite lit docs/raw/ : ce rapport et elle ne peuvent pas tourner sans cette porte ; LIT Source/ ' +
      '(312 chapitres mesurés) et son propre code',
  },
  'raw:reconcile': {
    ecrit: [],
    ecritFerme: {
      'docs/raw/reconciliation.md': 'scripts/raw/reconcile.mjs:411, même seam `ecrireDoc` et même porte que raw:coverage',
    },
    lit: ['docs/raw/', 'src/', 'Source/', 'scripts/raw/', 'scripts/guards/lib/', 'scripts/docs/lib/empreinte-sources.mjs'],
    raison:
      'la suite lit docs/raw/ : ce rapport et elle ne peuvent pas tourner sans cette porte ; LIT Source/ ' +
      '(285 chapitres mesurés), son stock `scripts/raw/reconciliation-stock.json` et son propre code',
  },
  'test:raw': {
    ecrit: [],
    lit: ['docs/raw/', 'scripts/raw/', 'scripts/guards/lib/', 'Source/', 'src/'],
    raison:
      'harnais de l’Atlas : il lit les fiches que les trois rapports écrivent ; éprouvant les scripts ' +
      'eux-mêmes, il LIT ce qu’ils lisent — Source/ et src/ (4 105 lectures mesurées)',
  },
  'raw:check-refs': {
    ecrit: [],
    lit: ['docs/raw/', 'Source/', 'src/data/books.json', 'src/data/source/', 'scripts/raw/', 'scripts/guards/lib/lister.mjs'],
    raison:
      'aucune écriture dans les scripts atteints ; LIT le registre de livres et le normaliseur de références ' +
      '(src/data/books.json, src/data/source/normalize.ts) et son stock scripts/raw/dead-refs-stock.json, ABSENT en régime nominal',
  },
  'raw:check-code-refs': {
    ecrit: [],
    lit: ['docs/raw/', 'src/', 'Source/', 'scripts/raw/', 'scripts/guards/lib/lister.mjs'],
    raison:
      'aucune écriture dans les scripts atteints ; LIT Source/ (134 chapitres mesurés) et son stock ' +
      'scripts/raw/empty-line-code-refs-stock.json',
  },
  'raw:check-folio-continuity': {
    ecrit: [],
    lit: ['docs/raw/', 'Source/', 'src/data/books.json', 'src/data/source/', 'scripts/raw/', 'scripts/guards/lib/lister.mjs'],
    raison:
      'aucune écriture dans les scripts atteints ; LIT le registre de livres, le normaliseur de références, ' +
      'le stock NOMINATIF des sauts de folio (scripts/raw/folio-gaps-stock.json) et le gel des ancres sans ' +
      'contenu (scripts/raw/empty-folios-baseline.json)',
  },
  'raw:reanchor': {
    ecrit: [],
    ecritFerme: {
      'docs/raw/reanchor.md':
        'scripts/raw/reanchor.mjs:344, même seam `ecrireDoc` et même porte que raw:coverage ; la réécriture des ' +
        'FICHES (l.309) est gardée par `apply || remap`, que la commande de ci.yml ne passe pas',
    },
    lit: [
      'docs/raw/', 'Source/', 'src/data/books.json', 'src/data/source/', 'scripts/raw/',
      'scripts/guards/lib/lister.mjs', 'scripts/docs/lib/empreinte-sources.mjs',
    ],
    raison:
      'la suite lit docs/raw/ : ce rapport et elle ne peuvent pas tourner sans cette porte ; LIT le registre ' +
      'de livres, le normaliseur de références et son stock scripts/raw/reanchor-low-stock.json',
  },
  'server:typecheck': {
    ecrit: [],
    lit: ['server/'],
    prerequis: [{ chemin: 'server/node_modules', pose: 'npm --prefix server ci' }],
    raison:
      '`tsc` du sous-projet serveur, sans émission ; PRÉREQUIS : le sous-projet a ses PROPRES dépendances, ' +
      'posées par la commande de .github/workflows/ci.yml:86 — sans elles `tsc` rend un TS2688 brut sur ' +
      '@cloudflare/workers-types, que rien ne rattache au dossier manquant',
  },
}

/**
 * Gates jouées EN SÉRIE, AVANT les lanes, parce qu'elles ÉCRIVENT dans l'arbre — l'ordre est la
 * seule chose qui empêche un lecteur d'une autre lane de tomber sur un fichier à moitié écrit.
 * Leur écriture est censée être un NON-ÉVÉNEMENT (le rendu est déjà celui du commit) ; quand elle
 * survient, la phase la NOMME et refuse, au lieu de laisser un « l'arbre a changé » anonyme tomber
 * sept minutes plus tard.
 * `ECRIT_LU` reste la vérité mesurée : ce n'est pas parce qu'une gate sort des lanes qu'elle cesse
 * d'écrire.
 */
export const AVANT_LES_LANES = ['raw:coverage', 'raw:reconcile', 'raw:reanchor']

/**
 * Les LANES, nominatives. Une lane est une SÉRIE ; les lanes tournent ensemble. Elles ne portent que
 * des LECTEURS (les écrivains sont dans `AVANT_LES_LANES`), et la morsure `conflitsEntreLanes` le
 * verrouille. Une gate de `ci.yml` qui n'est ni dans une lane ni dans la phase série fait REFUSER le
 * run, avec son nom : le classement est une décision, pas un silence (patron `CI_SEULEMENT`).
 *
 * TROIS lanes, et non quatre : la première exécution réelle (2026-09-04) a fait rendre au loader
 * Windows `STATUS_DLL_INIT_FAILED` sur quatre spawns concurrents. Une lane de moins, c'est −25 % de
 * processus simultanés au pire moment, pour un mur inchangé.
 *
 * QUI EST LE MUR, MESURÉ LE 2026-09-08 (durées du dernier run, `node_modules/.cache/gates/durees.json`,
 * en secondes) : phase série 6,99 + max(suite 133,10 ; types 198,29 ; docs 93,24) = 205,3 s. Ce n'est
 * plus la suite : `test` est tombé à 133,1 s, et c'est la lane `types` qui tient le mur, à 198,3 s.
 * La composition ci-dessous reste juste — aucune lane ne dépasse la somme des autres — mais la marge
 * qui la justifiait a changé de côté : c'est `types` qu'on remesure avant d'y ajouter quoi que ce
 * soit, et c'est en l'ALLÉGEANT, non en allégeant la suite, qu'on ferait bouger le mur.
 */
export const LANES = [
  {
    nom: 'suite',
    gates: ['test'],
    raison:
      'la seule à saturer la machine — seule dans sa lane, et BORNÉE par `WFRP_TEST_COEURS` pendant que ' +
      'les deux autres tournent. Elle n’est pas le mur (133,1 s le 2026-09-08) — voir « QUI EST LE MUR » ci-dessus',
  },
  {
    nom: 'types',
    gates: [
      'typecheck', 'lint', 'deps:unused', 'server:typecheck', 'test:agents', 'test:ops',
      'test:runner', 'test:recette', 'test:hooks',
    ],
    raison:
      'lectures du même graphe TypeScript et gates courtes, aucune écriture d’arbre. Somme du dernier run ' +
      '(durees.json, 2026-09-08) : typecheck 65,7 + lint 59,7 + test:hooks 37,7 + deps:unused 19,9 + ' +
      'test:recette 6,8 + test:ops 3,3 + test:runner 2,4 + server:typecheck 2,2 + test:agents 0,8 = ' +
      '198,3 s. C’est ELLE le mur (suite 133,1 s, docs 93,2 s) : rien ne s’y ajoute sans la remesurer, et ' +
      'toute seconde qu’on lui retire est une seconde de moins avant push. `test:hooks` y est admis parce ' +
      'qu’il ne fait aucune écriture d’arbre SUIVIE (registre d’écrans injectable ; sa seule écriture ' +
      'réelle, le journal gitignoré, est en `ecritFerme`)',
  },
  {
    nom: 'docs',
    gates: [
      'docs:check', 'docs:empreinte', 'test:raw', 'raw:check-refs', 'raw:check-code-refs',
      'raw:check-folio-continuity', 'test:docs', 'agents:check', 'build',
    ],
    raison:
      'tous les LECTEURS de docs/ et docs/raw/ — leurs trois écrivains ont déjà tourné, en série, avant que ' +
      'cette lane ne commence. `build` y tient parce que c’est une des gates les moins chères (22,5 s au ' +
      'dernier run : il ne joue plus que `gen && vite build`) et que cette lane est la plus courte — 70,8 s ' +
      'sans lui, 93,2 s avec (durees.json, 2026-09-08), loin sous le mur de `types` ; il n’écrit d’ailleurs ' +
      'que les registres déjà régénérés par `gen` en phase préalable',
  },
]

/**
 * Plafond de durée par gate, en SECONDES : ×3 de la pire durée observée, jamais moins. Sans plafond,
 * une gate bloquée tient sa lane pour toujours — vécu : `server:typecheck` a rendu 0xC0000142 après
 * 33 434 s (9 h 17). Une gate EXPIRÉE est un ROUGE nommé, pas un silence.
 * Mesures de référence : pire gate hors `test` et `docs:check` = `typecheck` 77,8 s (série du
 * 2026-09-07 ; ×3 = 233, largement sous les 600) ; `test` 275,1 s et il RALENTIT sous bornage
 * (×3 = 825) ; `docs:check` vaut 209,4 s quand il rejoue tout (×3 = 629).
 */
export const TIMEOUTS = { defaut: 600, test: 900, 'docs:check': 900 }

/**
 * Cœurs servis à la SUITE pendant les lanes. Mesuré sur cette machine, suite SEULE et sans lane :
 * `[diag] mémoire système max : 31.2 Go / 31.2 Go (100 %)` à 16 cœurs (node 10 + jsdom 5). À
 * saturation, ajouter des lanes ne rend pas du parallélisme, cela rend du swap — la suite se borne
 * donc par la couture qui existe déjà (`coeurs`, scripts/test/partition.mjs:43), jamais par une
 * seconde. À 10, `repartitionWorkers` sert node 6 + jsdom 3 : 9 workers au lieu de 15.
 * La RAM ne dit RIEN du point d'équilibre (100 % dans les deux régimes, mesuré) : ce qui le dit est
 * le compteur de spawns rejoués du résumé, et `worker perdu` du bloc `[diag]` de la suite.
 * `WFRP_TEST_COEURS` posé par l'appelant PRIME — c'est par lui que la valeur se re-mesure.
 */
export const COEURS_SUITE_EN_LANES = 10

/** Dossier des sorties de gate : un fichier par gate et par PID (patron `scripts/test/run.mjs`). */
export const dossierSorties = (racine) => join(racine, 'node_modules', '.cache', 'gates')

/** Durées du dernier run, par gate — la seule source du COÛT ESTIMÉ d'une gate sautée. */
export const fichierDurees = (racine) => join(dossierSorties(racine), 'durees.json')

/** Nom de FICHIER de la sortie d'une gate, encodé par `segmentDeGate` (justificatif.mjs). */
export const fichierDeSortie = (gate, pid) => `${segmentDeGate(gate)}-${pid}.txt`

/** Motif de nom d'une sortie de gate : `<segment>-<pid>.txt` (`fichierDeSortie`). */
const MOTIF_SORTIE = /-\d+\.txt$/

/** Durées du dernier run (`{}` au premier). */
function lireDurees(racine) {
  try {
    return JSON.parse(readFileSync(fichierDurees(racine), 'utf8'))
  } catch {
    return {}
  }
}

/**
 * PRÉREQUIS ABSENTS d'une gate : les entrées de son `prerequis` (ECRIT_LU) dont le `chemin`, relatif
 * à `racine`, n'existe pas. Une gate dont le prérequis manque ne mesure RIEN — elle rend l'erreur
 * brute de son outil, à la place de la commande qui pose ce qui manque.
 * REND `[{ chemin, pose }]`, vide quand tout est là (le cas courant : aucune lecture de plus).
 */
export const prerequisAbsents = (entree, racine) =>
  (entree?.prerequis ?? []).filter(({ chemin }) => !existsSync(join(racine, chemin)))

/** Ce qu'un refus de prérequis écrit dans la sortie de la gate — c'est cette queue que le résumé imprime. */
const refusDePrerequis = (nom, absents) =>
  `${absents
    .map(({ chemin, pose }) => `[gates] ${nom} — prérequis absent : \`${chemin}\` (le pose : \`${pose}\`)`)
    .join('\n')}\n`

/** Deux chemins déclarés se RECOUVRENT quand l'un préfixe l'autre : une fiche de `docs/raw/` est
 *  sous `docs/`, donc l'écrire c'est écrire dans ce que lit quiconque lit `docs/`. */
const chevauche = (a, b) => a.startsWith(b) || b.startsWith(a)

/** Couples « une lane ÉCRIT ce qu'une AUTRE lit » — la liste doit être VIDE. Seul `ecrit` compte :
 *  un chemin passé en `ecritFerme` porte, AU CHEMIN, la porte qui ferme son cas. */
export function conflitsEntreLanes(lanes = LANES, ecritLu = ECRIT_LU) {
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
 * Refus de COUVERTURE : gate de ci.yml ni en lane ni en phase série, gate nommée par une lane et
 * absente de ci.yml, gate sans entrée ÉCRIT/LU, gate placée deux fois. La liste doit être VIDE — une
 * gate ajoutée à la CI ARRÊTE `npm run gates` tant qu'on n'a pas dit ce qu'elle écrit, ce qu'elle lit
 * et où elle court.
 */
export function refusDeCouverture(noms, lanes = LANES, ecritLu = ECRIT_LU, avant = AVANT_LES_LANES) {
  const refus = []
  const placees = new Map()
  const poser = (gate, ou) => {
    if (placees.has(gate)) refus.push(`${gate} : placée deux fois (${placees.get(gate)} ET ${ou})`)
    else placees.set(gate, ou)
    if (!noms.includes(gate)) refus.push(`${gate} : nommée par ${ou}, absente de ci.yml — la retirer`)
  }
  for (const gate of avant) poser(gate, 'la phase série AVANT_LES_LANES')
  for (const lane of lanes) for (const gate of lane.gates) poser(gate, `la lane ${lane.nom}`)
  for (const nom of noms) {
    if (!placees.has(nom))
      refus.push(`${nom} : gate de ci.yml sans place — la mettre dans LANES ou AVANT_LES_LANES, avec ce qu'elle ÉCRIT et LIT`)
    if (!ecritLu[nom]) refus.push(`${nom} : aucune entrée ÉCRIT/LU — la mesurer avant de la placer`)
  }
  return refus
}

/**
 * Le refus du VERROU DE SUITE (`scripts/test/verrou.mjs`) : quand une autre session joue déjà une
 * suite complète, `npm test` sort en 2 SANS avoir rien joué. Reconnu par sa SORTIE, jamais par le
 * code seul — un 2 est aussi ce que rend une invocation mal formée de `justifie.mjs`.
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
 * enveloppe `justifie.mjs`, plafond, verdict) est commun, donc le verdict l'est aussi.
 */
export function lanesAJouer(aJouer, { serie = false, lanes = LANES } = {}) {
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
export function spawnBorne({ argv, fichier, limiteMs, cwd, env = process.env, surPid, site }) {
  const unEssai = () =>
    new Promise((resoudre) => {
      const fd = openSync(fichier, 'w')
      const enfant = spawn(process.execPath, argv, {
        cwd,
        env,
        stdio: ['ignore', fd, fd],
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

/** Ce que le résumé imprime pour une gate qui n'a pas été jouée faute d'un rouge ailleurs. */
export const coutEstime = (durees, nom) =>
  typeof durees[nom] === 'number' ? `~${durees[nom].toFixed(1)} s au dernier run` : 'coût inconnu'

/**
 * Joue toutes les gates exigées. `racine`, `argv` et `journal` sont INJECTÉS : sans cela, ni la
 * politique d'arrêt ni le résumé ne se mesurent autrement qu'en jouant les vraies gates.
 * REND le code de sortie.
 */
export async function principal({
  racine = RACINE,
  argv = process.argv,
  journal = (t) => process.stderr.write(t),
  lanes: lanesDeclarees = LANES,
  avant = AVANT_LES_LANES,
  ecritLu = ECRIT_LU,
} = {}) {
  const TOUT = argv.includes('--tout')
  const LISTE = argv.includes('--liste')
  const SERIE = argv.includes('--serie')

  journal(`[gates] ${enteteArbre(racine)}\n`)

  const salis = perimetreSale({ cwd: racine })
  if (salis.length && !LISTE) {
    journal(
      `[gates] REFUS — l'arbre porte ${salis.length} chemin(s) non committé(s) au périmètre de la clé :\n` +
        `${salis.map((s) => `  ${s}`).join('\n')}\n` +
        `[gates] committer d'abord : une gate jouée sur cet arbre ne justifiera aucun push.\n`,
    )
    return 1
  }

  const scripts = JSON.parse(readFileSync(join(racine, 'package.json'), 'utf8')).scripts ?? {}
  // Le magasin passe à la graphie courante AVANT toute lecture : sinon les justificatifs de
  // l'ancienne (un fichier par gate, sans clé ni propreté dans le nom) seraient invisibles et
  // chaque gate serait redonnée à jouer.
  migrerAncienneGraphie({ cwd: racine, journal })
  // DEUX clés, comme le pre-push (scripts/git-hooks/pre-push.mjs) : les 15 gates de
  // `RAISON_CLE_COMPLETE` lisent `docs/` ou `.claude/`, hors de la clé partielle. Sans la clé
  // complète ici, le lanceur déclare « déjà justifiée » ce que le push refuse ensuite (mesuré sur
  // fdf62479e : 22 gates sautées, 11 refusées au push).
  const cles = clesDeContenu('HEAD', { cwd: racine })
  const cle = cles.cleTree
  const gates = gatesRequises({ cwd: racine })
  journal(`[gates] ${gates.length} gate(s) lues dans ci.yml · contenu ${cle.slice(0, 12)}\n`)

  const manques = refusDeCouverture(gates.map((g) => g.nom), lanesDeclarees, ecritLu, avant)
  if (manques.length) {
    journal(
      `[gates] REFUS — la table des lanes ne couvre pas ci.yml :\n${manques.map((m) => `  ${m}`).join('\n')}\n` +
        '[gates] scripts/gates/toutes.mjs : LANES, AVANT_LES_LANES et ECRIT_LU.\n',
    )
    return 1
  }
  const conflits = conflitsEntreLanes(lanesDeclarees, ecritLu)
  if (conflits.length) {
    journal(`[gates] REFUS — une lane écrit ce qu'une autre lit :\n${conflits.map((c) => `  ${c}`).join('\n')}\n`)
    return 1
  }

  // À JOUER, dans l'ordre de ci.yml : celles dont le justificatif manque, est rouge, ou fut pris sur
  // un arbre sale.
  const aJouer = []
  for (const gate of gates) {
    const vue = lireJustificatif({ cwd: racine, gate: gate.nom, cles })
    const motif = motifDeRefus(vue, gate, {
      autresCles: justificatifsSousDAutresCles({ cwd: racine, gate: gate.nom, cles }),
    })
    if (!TOUT && !motif) {
      journal(`[gates] ${gate.nom} — déjà justifiée sur ce contenu\n`)
      continue
    }
    journal(`[gates] ${gate.nom} — ${TOUT ? 'rejeu demandé' : motif}\n`)
    aJouer.push(gate)
  }
  if (LISTE) return 0
  if (!aJouer.length) {
    journal('[gates] rien à jouer : tout est justifié sur ce contenu.\n')
    return 0
  }

  // `npm run gen` AVANT tout : `build` ET la suite appellent `genAll()` (vite.config.ts:16), qui
  // réécrit `src/**/*.generated.ts` si un registre a bougé. Joué une fois ici, il ne reste rien à
  // écrire — et un registre périmé se dit MAINTENANT. C'est le step « Dérive des registres générés »
  // de ci.yml, joué localement.
  const avantGen = Date.now()
  const gen = spawnSync('npm', ['run', 'gen'], {
    cwd: racine,
    stdio: ['ignore', 'ignore', 'pipe'],
    shell: process.platform === 'win32',
    encoding: 'utf8',
  })
  if (gen.status !== 0) {
    journal(`[gates] REFUS — « npm run gen » a échoué (exit ${gen.status}) :\n${gen.stderr ?? ''}\n`)
    return 1
  }
  const derive = spawnSync('git', ['diff', '--name-only', '--', '*.generated.ts'], { cwd: racine, encoding: 'utf8' })
    .stdout.trim()
  if (derive) {
    journal(
      `[gates] REFUS — registres générés PÉRIMÉS (« npm run gen » les a réécrits) :\n` +
        `${derive.split('\n').map((f) => `  ${f}`).join('\n')}\n` +
        '[gates] committe-les : sans quoi la suite et `build` les réécriraient en même temps.\n',
    )
    return 1
  }
  journal(`[gates] gen — registres à jour en ${secondesDepuis(avantGen).toFixed(1)} s\n`)

  mkdirSync(dossierSorties(racine), { recursive: true })
  purgerPerimes({ dossier: dossierSorties(racine), motif: MOTIF_SORTIE, ageMs: PEREMPTION_MS })
  const durees = lireDurees(racine)

  const aJouerParNom = new Map(aJouer.map((g) => [g.nom, g]))
  const verdicts = new Map()
  const vivants = new Map()
  let arret = null

  const arreterSurSignal = (signal) => {
    journal(
      `\n[gates] ${signal} — arrêt : l'ARBRE de chaque gate en cours est tué (un enfant survivant garderait ` +
        'le verrou de suite et des cœurs).\n',
    )
    arret = `signal ${signal}`
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
    // pose. Le verdict est le même ROUGE, mais il DIT quoi faire — et rien n'est spawné, donc aucun
    // justificatif n'est écrit : seul `justifie.mjs` en écrit, et il n'est pas appelé. Le refus ne
    // pèse que sur CE run : les clés de justificatif sont des `git ls-tree` (justificatif.mjs:47,77),
    // qu'un dossier gitignoré ne change pas — un justificatif vert d'avant la suppression des
    // dépendances reste donc valable, et la gate n'est pas même redonnée à jouer.
    const absents = prerequisAbsents(ecritLu[gate.nom], racine)
    if (absents.length) {
      const sortie = refusDePrerequis(gate.nom, absents)
      writeFileSync(fichier, sortie)
      return { code: 1, expiree: false, fichier, sortie, limiteMs: limiteDe(gate.nom) }
    }
    const commande = scripts[`${gate.nom}:brut`] ? `npm run ${gate.nom}:brut` : gate.commande
    const env = { ...process.env }
    if (coeurs && !process.env.WFRP_TEST_COEURS) env.WFRP_TEST_COEURS = String(coeurs)
    // L'enveloppe est celle de CET outil, jamais celle de l'arbre mesuré : c'est `WFRP_GATES_RACINE`
    // qui lui dit sur quel arbre écrire son justificatif (sans quoi une mesure sur un dépôt jetable
    // écrirait dans le dépôt réel).
    env.WFRP_GATES_RACINE = racine
    const r = await spawnBorne({
      argv: [join(ICI, 'justifie.mjs'), gate.nom, '--', ...commande.split(' ')],
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

  /** Pose le verdict d'une gate et, si c'est un rouge, ARME l'arrêt des lanes. Le rejeu de
   *  `spawnResilient` est déjà ÉPUISÉ quand on arrive ici : un processus qui n'a pas démarré ne fait
   *  donc plus sauter les gates suivantes. */
  const poser = (nom, r) => {
    const secondes = secondesDepuis(r.debut)
    const statut = r.expiree ? 'EXPIRÉE' : r.code === 0 ? 'vert' : 'ROUGE'
    verdicts.set(nom, { statut, code: r.code, secondes, fichier: r.fichier, sortie: r.sortie, limiteMs: r.limiteMs })
    journal(`[gates] ${nom} — ${statut} (exit ${r.code}) en ${secondes.toFixed(1)} s · ${r.fichier}\n`)
    if (statut !== 'vert' && !arret) arret = `${nom} ${statut} (exit ${r.code})`
    return statut
  }

  const jouerLane = async (lane) => {
    const debut = Date.now()
    for (const nom of lane.gates) {
      if (arret) {
        verdicts.set(nom, { statut: 'sautée', secondes: 0, raison: `${arret} — ${coutEstime(durees, nom)}` })
        continue
      }
      const debutGate = Date.now()
      // `--serie` ne borne PAS la suite : c'est le mode DIAGNOSTIC, rien ne tourne à côté d'elle, et
      // la brider fausserait la seule mesure de référence dont dispose le lanceur.
      const r = await jouerGate(aJouerParNom.get(nom), !SERIE && nom === 'test' ? COEURS_SUITE_EN_LANES : null)
      poser(nom, { ...r, debut: debutGate })
    }
    return { nom: lane.nom, secondes: secondesDepuis(debut) }
  }

  const photoDepart = photoArbre(racine)
  const debutTotal = Date.now()

  // PHASE 1 — les écrivains, en série. Une seule d'entre elles peut réécrire l'arbre, et si elle le
  // fait, on le dit ICI, avec les chemins, au lieu d'un verdict de course sept minutes plus tard.
  const enSerieAvant = avant.filter((n) => aJouerParNom.has(n))
  let refusEcriture = null
  if (!SERIE) {
    for (const nom of enSerieAvant) {
      if (arret) {
        verdicts.set(nom, { statut: 'sautée', secondes: 0, raison: `${arret} — ${coutEstime(durees, nom)}` })
        continue
      }
      const debutGate = Date.now()
      poser(nom, { ...(await jouerGate(aJouerParNom.get(nom), null)), debut: debutGate })
      const apres = photoArbre(racine)
      if (photoDepart.texte !== null && apres.texte !== null && apres.texte !== photoDepart.texte) {
        const bouges = apres.texte
          .split('\n')
          .filter((l) => l.trim() && !photoDepart.texte.includes(l))
        refusEcriture =
          `[gates] REFUS — « ${nom} » a RÉÉCRIT l'arbre : son rendu n'est pas celui du commit.\n` +
          `${bouges.map((l) => `  ${l}`).join('\n')}\n` +
          '[gates] régénère et committe ces fichiers, puis rejoue les gates.\n'
        arret = `${nom} a réécrit l'arbre`
        break
      }
    }
  }

  // PHASE 2 — les lanes, qui ne portent que des lecteurs.
  const lanes = lanesAJouer(
    aJouer.filter((g) => SERIE || !avant.includes(g.nom)),
    { serie: SERIE, lanes: lanesDeclarees },
  )
  // Un refus d'écriture tranche AVANT les lanes : ce qu'elles auraient joué est SAUTÉ, avec son coût,
  // et le résumé le nomme au lieu de le passer pour « déjà justifié ».
  if (refusEcriture)
    for (const lane of lanes)
      for (const nom of lane.gates)
        verdicts.set(nom, { statut: 'sautée', secondes: 0, raison: `${arret} — ${coutEstime(durees, nom)}` })
  const dureesLanes = refusEcriture ? [] : await Promise.all(lanes.map(jouerLane))
  const mur = secondesDepuis(debutTotal)

  // PHASE 3 — le RÉSUMÉ D'ABORD, dans l'ordre de ci.yml. L'ordonnancement en lanes ne doit pas
  // devenir l'ordre de LECTURE d'un verdict, et rien de ce qui suit ne peut plus l'empêcher.
  journal('\n[gates] ——— résumé ———\n')
  let code = 0
  for (const gate of gates) {
    const v = verdicts.get(gate.nom)
    if (!v) {
      journal(`[gates] ${gate.nom} — déjà justifiée — 0.0 s\n`)
      continue
    }
    const exit = typeof v.code === 'number' ? ` (exit ${v.code})` : ''
    journal(`[gates] ${gate.nom} — ${v.statut}${exit} — ${v.secondes.toFixed(1)} s — ${v.fichier ?? v.raison}\n`)
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
  if (refusEcriture) {
    journal(refusEcriture)
    code = 1
  }

  // Les durées de CE run servent de coût estimé au prochain — écriture au mieux, jamais un verdict.
  try {
    writeFileSync(
      fichierDurees(racine),
      `${JSON.stringify(Object.fromEntries([...verdicts].filter(([, v]) => v.statut !== 'sautée').map(([n, v]) => [n, v.secondes])), null, 2)}\n`,
    )
  } catch {
    /* cache indisponible : le prochain résumé dira « coût inconnu » */
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

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  process.exit(
    await avecVerrouMachine(() => principal(), { cwd: RACINE, journal: (t) => process.stderr.write(t) }).catch((e) => {
      process.stderr.write(`[gates] ARRÊT INATTENDU : ${e?.stack ?? e}\n`)
      return 1
    }),
  )
}
