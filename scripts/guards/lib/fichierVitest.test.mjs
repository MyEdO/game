// PORTE DE RÔLE du prédicat d'INSTRUMENT VITEST (#1788) — le contrat porte sur la FORME du nom,
// prouvée sur des formes NUES : prendre un fichier du dépôt pour fixture mesurerait l'arbre du jour,
// pas le prédicat. Les deux formes jouées (`.test.`, `.bench.`) sont VRAIES, une source de
// production et les voisins qui LEUR RESSEMBLENT (`.fixture.ts`, un `.bak` qui suffixe un test)
// sont FAUX — c'est là que se joue la différence entre un cliquet de FORME et une liste de fichiers.
// Les DIALECTES sont éprouvés un par un (`.ts`, `.tsx`, `.mjs`, `.mts`, `.js`, `.cjs`) : le corpus
// canonique lit `scripts/qc` en `.mts`/`.mjs` comme il lit `src` en `.ts`, et un prédicat qui ne
// couvrirait que le premier dialecte rendrait le second corpus faux en silence.
// Patron des voisins de `scripts/guards/lib/` : `node:test` + `node:assert/strict`, exécutable par
// `node --test` nu.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  estFichierVitest,
  EST_FICHIER_VITEST,
  estSuiteVitest,
  EST_SUITE_VITEST,
  SUFFIXE_SUITE,
  SUFFIXE_INSTRUMENT,
} from './fichierVitest.mjs'

test('estFichierVitest : les deux formes JOUÉES sont des instruments', () => {
  for (const rel of [
    'src/data/index-vif-guard.test.ts',
    'src/ui/roll-display-contract.test.tsx',
    'src/gameIso/stage/versionDataset.bench.ts',
    'src/gameIso/stage/arete-dans-la-chaine.bench.ts',
    'banc.bench.tsx',
    'scripts/guards/lib/sourceCorpus.test.mjs',
    'scripts/qc/planche.test.mts',
    'scripts/qc/planche.bench.mjs',
    'outil.test.js',
    'outil.test.cjs',
  ]) {
    assert.equal(estFichierVitest(rel), true, `instrument : ${rel}`)
  }
})

test('estFichierVitest : la production et ce qui RESSEMBLE à un instrument n’en sont pas', () => {
  for (const rel of [
    'src/gameIso/stage/versionDataset.ts',
    'src/gameIso/stage/versionDataset.fixture.ts',
    'src/data/index-vif-guard.test.ts.bak',
    'src/engine/types.d.ts',
    'src/data/overrides.json',
    'benchmarks.ts',
    'scripts/guards/lib/sourceCorpus.mjs',
    'xtest.ts',
    'monbench.mts',
  ]) {
    assert.equal(estFichierVitest(rel), false, `pas un instrument : ${rel}`)
  }
})

test('EST_FICHIER_VITEST : la regexp exportée est sans état — deux appels rendent le même verdict', () => {
  // Un drapeau `g` ferait alterner `test()` vrai/faux via `lastIndex` : la garde qui la consomme
  // dans un `filter` verrait un fichier sur deux.
  assert.equal(EST_FICHIER_VITEST.global, false)
  assert.equal(EST_FICHIER_VITEST.test('a.bench.ts'), EST_FICHIER_VITEST.test('a.bench.ts'))
})

test('estSuiteVitest : une SUITE oui, un BANC non — le sens « les tests seulement »', () => {
  for (const rel of ['src/data/index-vif-guard.test.ts', 'src/ui/a.test.tsx', 'scripts/g.test.mjs', 'p.test.mts'])
    assert.equal(estSuiteVitest(rel), true, `suite : ${rel}`)
  for (const rel of ['src/gameIso/stage/versionDataset.bench.ts', 'banc.bench.tsx', 'scripts/qc/planche.bench.mjs']) {
    assert.equal(estSuiteVitest(rel), false, `un banc n’est pas une suite : ${rel}`)
    assert.equal(estFichierVitest(rel), true, `mais il reste un instrument : ${rel}`)
  }
  assert.equal(EST_SUITE_VITEST.global, false)
})

test('les deux prédicats se DÉRIVENT des fragments exportés — une source, quatre exports', () => {
  // Preuve de dérivation, pas de ressemblance : le prédicat DOIT être le fragment + l'ancre de fin.
  // Muter le fragment (ici : le dialecte) fait bouger le prédicat correspondant, puisqu'il en sort.
  assert.equal(EST_SUITE_VITEST.source, `${SUFFIXE_SUITE}$`)
  assert.equal(EST_FICHIER_VITEST.source, `${SUFFIXE_INSTRUMENT}$`)
  // Un fragment est une SOURCE de regex, sans ancre : composable à gauche comme à droite.
  const dansUnChemin = new RegExp(`^src/.+${SUFFIXE_SUITE}$`)
  assert.equal(dansUnChemin.test('src/data/index-vif-guard.test.ts'), true)
  assert.equal(dansUnChemin.test('scripts/g.test.mjs'), false)
  // Le fragment d'INSTRUMENT accepte les deux formes, celui de SUITE une seule.
  assert.equal(new RegExp(`${SUFFIXE_INSTRUMENT}$`).test('a.bench.mts'), true)
  assert.equal(new RegExp(`${SUFFIXE_SUITE}$`).test('a.bench.mts'), false)
})

// ── CLIQUET DE BALAYAGE : le prédicat vit en UN exemplaire ────────────────────────────────────────
// Le geste qui a créé ce module ne vaut que s'il n'a pas de COPIE : une garde de synchronisation est
// un smell, une seule source de vérité. Le balayage lit `src/**` et `scripts/**` en CODE SEUL —
// commentaires et chaînes blanchis, un littéral de regexp préservé (`codeSeul.mjs`) — et refuse tout
// motif `\.test\.` / `\.bench\.` écrit ailleurs qu'ici. Deux sites seulement en sont soustraits, par
// leur FORME et non par une liste : le module lui-même, et le test du module de CORPUS, dont
// l'oracle `marcheNaive` est volontairement indépendant (un oracle qui importerait le sujet ne
// prouverait plus rien). Le motif cherché est PLANTÉ en morceaux ci-dessous : écrit d'un bloc, ce
// balayage se mordrait lui-même.
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { listerArbre } from './lister.mjs'
import { codeSeul } from './codeSeul.mjs'

const LIB = dirname(fileURLToPath(import.meta.url))
const RACINE = join(LIB, '..', '..', '..')
/** Le module qui PORTE les deux prédicats, et le test du module de CORPUS : les deux seuls sites du
 *  dépôt autorisés à écrire le motif, désignés par la FORME de leur nom, à côté de CE fichier. */
const PORTEURS = new Set(['fichierVitest.mjs', 'sourceCorpus.test.mjs'].map((nom) => join(LIB, nom)))
const DIALECTES = /\.[cm]?[jt]sx?$/
/** Une SONDE D'AUDIT DATÉE (`ops/sondes/audit-AAAA-MM-JJ/`) : l'artefact GELÉ d'une mesure passée,
 *  qui vaut par ce qu'il a compté CE JOUR-LÀ. Le migrer réécrirait la mesure ; il n'est pas du code
 *  vivant, et sa FORME — le dossier daté — le dit sans qu'on nomme un fichier. */
const SONDE_DATEE = /(^|\/)audit-\d{4}-\d{2}-\d{2}$/
/** Le motif tel qu'on l'écrirait dans une regexp, assemblé mot par mot à l'exécution. */
const MOTIFS = ['test', 'bench'].map((mot) => ['\\', '.', mot, '\\', '.'].join(''))
/** Le motif en ALTERNANCE (`\.(<a>|<mot>|<b>)\.`), où le mot côtoie d'autres suffixes dans un
 *  groupe : même copie du prédicat, invisible à `MOTIFS`. Assemblé à l'exécution, comme lui. */
const ALTERNANCE = new RegExp(String.raw`\\\.\((?:\w+\|)*(?:` + ['test', 'bench'].join('|') + String.raw`)(?:\|\w+)*\)\\\.`)
/** Une ligne de CODE SEUL copie-t-elle le motif, en bloc ou en alternance ? */
const copieLeMotif = (ligne) => MOTIFS.some((m) => ligne.includes(m)) || ALTERNANCE.test(ligne)

const balayer = (racine) =>
  listerArbre(join(RACINE, racine), {
    filtre: (rel) => DIALECTES.test(rel),
    descendre: (rel) => !rel.endsWith('node_modules') && !rel.endsWith('art-ref') && !SONDE_DATEE.test(rel),
  }).map((rel) => ({ rel: `${racine}/${rel}`, abs: join(RACINE, racine, rel) }))

test('le prédicat vit en UN exemplaire : aucune copie locale du motif dans src/** ni scripts/**', () => {
  const fautes = []
  for (const { rel, abs } of [...balayer('src'), ...balayer('scripts')]) {
    if (PORTEURS.has(abs)) continue
    codeSeul(readFileSync(abs, 'utf8'))
      .split(/\r?\n/)
      .forEach((ligne, i) => {
        if (copieLeMotif(ligne)) fautes.push(`${rel}:${i + 1}`)
      })
  }
  assert.deepEqual(
    fautes,
    [],
    'Copie locale du prédicat d’instrument Vitest — consomme `scripts/guards/lib/fichierVitest.mjs` :' +
      '\n  périmètre de PRODUCTION → `!estFichierVitest(rel)`' +
      '\n  sélection des TESTS     → `estSuiteVitest(rel)`' +
      `\nSites :\n  ${fautes.join('\n  ')}`,
  )
})

test('le balayage voit la copie en ALTERNANCE, comme la copie en bloc', () => {
  const copies = [String.raw`/\.(test|d)\.ts$/`, String.raw`/\.(test|spec)\./`, String.raw`/\.(spec|test)\./`, String.raw`/\.(d|bench|spec)\./`]
  for (const ligne of copies) assert.equal(copieLeMotif(ligne), true, ligne)
  for (const ligne of [String.raw`/\.(ts|tsx)$/`, String.raw`/\.(d)\.ts$/`, String.raw`/(test|spec)/`]) assert.equal(copieLeMotif(ligne), false, ligne)
})
