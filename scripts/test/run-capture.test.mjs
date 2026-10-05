// Capture du lanceur `scripts/test/run.mjs` sur un FAUX dépôt (tmpdir + faux
// `node_modules/vitest/vitest.mjs`) : en-tête + `status:` dans le fichier, résumé qui nomme la
// cause brute quand le run échoue SANS bilan, bornes de charge jamais doublées, couleur éteinte.
// Le faux binaire évite de payer un vrai run de suite par cas.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, readdirSync, utimesSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { clotureDImports } from '../guards/lib/importGraph.mjs'

const RACINE = fileURLToPath(new URL('../..', import.meta.url)).replace(/[\\/]$/, '')

/** Modules à copier dans le faux dépôt : la CLÔTURE d'imports RELATIFS de `run.mjs`, CALCULÉE
 *  (`clotureDImports`, `scripts/guards/lib/importGraph.mjs`) — jamais une liste tenue à la main. Une
 *  liste à tenir ne dit rien quand elle périme : au premier module partagé neuf (#1679 L3b) l'enfant
 *  mourait en `ERR_MODULE_NOT_FOUND` AVANT d'écrire sa capture, et les sept cas rougissaient sur un
 *  `scandir ENOENT` qui ne nommait pas la cause. */
function modulesDuLanceur() {
  return [...clotureDImports(['scripts/test/run.mjs'], { racine: RACINE })].sort()
}

/** Le faux dépôt n'est pas une SUITE : il ne prend pas le verrou machine du lanceur (#1679 L1c-M7),
 *  qui refuserait la vraie suite d'à côté. L'opt-out lui-même est mesuré par `run-isolation.test.mjs`. */
const SANS_VERROU = { WFRP_SUITE_LOCK: '0' }

/** Faux dépôt : le lanceur et TOUT ce qu'il importe (sa lib en fait partie), plus un Vitest de
 *  substitution. Ce que ces cas mesurent : la CAPTURE du lanceur — il rend le code de Vitest tel
 *  quel et écrit la sortie complète, même hors d'un dépôt git. */
function fauxDepot(sourceDuFauxVitest) {
  const base = mkdtempSync(join(tmpdir(), 'vitest-run-'))
  const modules = modulesDuLanceur()
  assert.ok(modules.includes('scripts/test/run.mjs'), `clôture vide ou sans le lanceur : ${modules.join(', ')}`)
  for (const rel of modules) {
    const cible = join(base, ...rel.split('/'))
    mkdirSync(dirname(cible), { recursive: true })
    copyFileSync(join(RACINE, ...rel.split('/')), cible)
  }
  mkdirSync(join(base, 'node_modules', 'vitest'), { recursive: true })
  writeFileSync(join(base, 'node_modules', 'vitest', 'vitest.mjs'), sourceDuFauxVitest, 'utf8')
  return base
}

/** Énumération du faux Vitest (`list --filesOnly --json=<f>`) : les fichiers de `TRACE_FICHIERS`,
 *  aucun par défaut. Le lanceur énumère toute suite COMPLÈTE, même en mono : le verdict d'un registre
 *  DOM absent dépend des fichiers jsdom joués (`refusRegistreDomAbsent`). */
const LISTE =
  "import fs from 'node:fs'\n" +
  "if (process.argv[2] === 'list') {\n" +
  "  const json = process.argv.find((a) => a.startsWith('--json=')).slice('--json='.length)\n" +
  "  fs.writeFileSync(json, JSON.stringify(JSON.parse(process.env.TRACE_FICHIERS ?? '[]').map((file) => ({ file }))), 'utf8')\n" +
  '  process.exit(0)\n' +
  '}\n'

const TRACE = (suite) =>
  LISTE +
  "fs.writeFileSync(process.env.TRACE_ARGV, JSON.stringify(process.argv.slice(2)), 'utf8')\n" +
  "process.stdout.write('couleur FORCE_COLOR=' + (process.env.FORCE_COLOR ?? '(absent)') + " +
  "' NO_COLOR=' + (process.env.NO_COLOR ?? '(absent)') + '\\n')\n" +
  suite

const VITEST_VERT = TRACE(
  "process.stdout.write(' Test Files  1 passed (1)\\n')\n" +
    "process.stdout.write(' Tests  3 passed (3)\\n')\n" +
    'process.exit(0)\n',
)

/** Faux run de DÉTRESSE : le binaire crache une ligne canonique par sentinelle (les six), puis
 *  échoue. Aucun vrai Vitest, aucune vraie racine React — seul le CHEMIN d'observation est mesuré. */
const LIGNES_WEDGE = [
  'Warning: An update to CombatConsole inside a test was not wrapped in act(...).',
  'Warning: You seem to have overlapping act() calls, this is not supported. ',
  'Warning: Attempted to synchronously unmount a root while React was already rendering.',
  'Warning: Should not already be working.',
  'Error: Test timed out in 5000ms.',
  'Error: Worker exited unexpectedly',
]

const VITEST_WEDGE = TRACE(
  LIGNES_WEDGE.map((l) => `process.stderr.write(${JSON.stringify(l + '\n')})\n`).join('') +
    "process.stdout.write(' Test Files  1 failed (1)\\n')\n" +
    'process.exit(1)\n',
)

const VITEST_SANS_BILAN = TRACE(
  "process.stderr.write('No test files found, exiting with code 1\\n')\n" + 'process.exit(1)\n',
)

/** `--coverage` force le lancement mono-processus (drapeau global à un seul processus). `coeurs` et
 *  `memoireMo` forcent la machine VUE par le lanceur (même levier qu'au chemin partagé) : les bornes
 *  de charge en dépendent, un cas qui laisse parler le matériel du runner mesure la machine, pas le
 *  lanceur. Des cœurs forcés sans mémoire forcée gardent une mémoire qui ne borne pas. */
function lance(base, args = [], coeurs, memoireMo = 65536) {
  const trace = join(base, 'argv.json')
  const run = spawnSync(process.execPath, [join(base, 'scripts', 'test', 'run.mjs'), '--coverage', ...args], {
    cwd: base,
    encoding: 'utf8',
    env: {
      ...process.env,
      FORCE_COLOR: '3',
      TRACE_ARGV: trace,
      ...SANS_VERROU,
      ...(coeurs === undefined
        ? {}
        : { WFRP_TEST_COEURS: String(coeurs), WFRP_TEST_MEMOIRE_MO: String(memoireMo) }),
    },
  })
  const cache = join(base, 'node_modules', '.cache')
  // Le lanceur mort AVANT sa capture ne laisse pas de dossier `.cache` : le `scandir ENOENT` qui suit
  // ne dirait RIEN de la cause. On rend d'abord ce que l'enfant a écrit sur stderr.
  const diagnostic = `status=${run.status}\n--- stderr de l'enfant ---\n${run.stderr}\n--- stdout ---\n${run.stdout}`
  let fichiers
  try { fichiers = readdirSync(cache).filter((n) => /^vitest-run-\d+\.txt$/.test(n)) } catch (err) {
    assert.fail(`aucun dossier de capture (${err.code}) — l'enfant n'a pas atteint son écriture.\n${diagnostic}`)
  }
  assert.equal(fichiers.length, 1, `captures trouvées : ${fichiers.join(', ')}\n${diagnostic}`)
  return {
    run,
    argv: JSON.parse(readFileSync(trace, 'utf8')),
    chemin: join(cache, fichiers[0]),
    capture: readFileSync(join(cache, fichiers[0]), 'utf8'),
  }
}

test('capture : en-tête d’emblée, sortie tee-ée, `status:` en queue, chemin dans le résumé', () => {
  const base = fauxDepot(VITEST_VERT)
  try {
    const { run, capture, chemin } = lance(base)
    assert.equal(run.status, 0, `run en échec : ${run.stdout}${run.stderr}`)
    assert.ok(capture.length > 0, 'capture vide')
    assert.match(capture, /^# commande : .*run\.mjs .*--coverage/m)
    assert.match(capture, /^# date : \d{4}-\d{2}-\d{2}T[\d:.]+Z$/m)
    assert.match(capture, /^# pid : \d+$/m)
    assert.match(capture, /^# cwd : .+$/m)
    assert.match(capture, /Test Files {2}1 passed \(1\)/)
    assert.equal(capture.trimEnd().split('\n').pop(), 'status: 0')
    // Le chemin de la capture clôt le résumé imprimé.
    assert.equal(run.stdout.trimEnd().split('\n').pop(), `capture : ${chemin}`)
    // Couleur : FORCE_COLOR SUPPRIMÉ (pas mis à `0`), NO_COLOR posé.
    assert.match(run.stdout, /couleur FORCE_COLOR=\(absent\) NO_COLOR=1/)
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

/** Ordre exigé : `[diag]` AVANT le résumé et avant `status:`, `capture :` dernière de la sortie,
 *  `status:` dernière du fichier. Un pont d'outillage qui tronque la queue garde ainsi la mesure. */
function verifierOrdreDiag({ run, capture, chemin }) {
  const diagSortie = run.stdout.split('\n').filter((l) => l.startsWith('[diag] '))
  assert.equal(diagSortie.length, 4, `bloc [diag] absent ou incomplet en sortie : ${run.stdout}`)
  assert.match(
    diagSortie[0],
    /^\[diag\] machine : \d+ cœurs · [\d.]+ Go · disponible [\d.]+ Go → (\d+ workers? portés?|mémoire insuffisante pour un worker \(\d+ Mo < \d+ Mo\)) · réserve de [12] parents? · borné par (cœurs|(mémoire|plancher) \(\d+ cœurs servis\)) · (mono|partagé) \(seuil 7\) · maxWorkers=/,
  )
  assert.match(diagSortie[1], /^\[diag\] mémoire système max : [\d.]+ Go \/ [\d.]+ Go \(\d+ %\) · rss lanceur max \d+ Mo · fenêtre [\d.]+ s$/)
  assert.match(diagSortie[2], /^\[diag\] sentinelles : act hors act \d+ · /)
  assert.match(diagSortie[3], /^\[diag\] tas max d'un worker : (non relevé|\d+ Mo) \/ \d+ Mo/)
  assert.equal(run.stdout.trimEnd().split('\n').pop(), `capture : ${chemin}`)
  assert.ok(run.stdout.indexOf('[diag] machine') < run.stdout.indexOf('capture : '), 'résumé avant [diag]')

  const lignesCapture = capture.split('\n')
  const diagCapture = lignesCapture.filter((l) => l.startsWith('[diag] '))
  assert.deepEqual(diagCapture, diagSortie, `bloc [diag] absent de la capture : ${capture}`)
  assert.equal(capture.trimEnd().split('\n').pop(), `status: ${run.status}`)
  assert.ok(
    lignesCapture.indexOf(diagCapture[0]) < lignesCapture.findIndex((l) => l.startsWith('status: ')),
    `[diag] écrit APRÈS status: : ${capture}`,
  )
  return diagSortie
}

test('diagnostic : bloc [diag] en sortie ET en capture, avant `status:`, sur un run VERT', () => {
  const base = fauxDepot(VITEST_VERT)
  try {
    const pose = lance(base)
    assert.equal(pose.run.status, 0, `run en échec : ${pose.run.stdout}${pose.run.stderr}`)
    const diag = verifierOrdreDiag(pose)
    assert.equal(
      diag[2],
      '[diag] sentinelles : act hors act 0 · act chevauchants 0 · unmount pendant rendu 0 · React coincé 0 · test expiré 0 · worker perdu 0',
    )
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('diagnostic : un run de DÉTRESSE compte ses six sentinelles, même ordre de sortie', () => {
  const base = fauxDepot(VITEST_WEDGE)
  try {
    const pose = lance(base)
    assert.equal(pose.run.status, 1)
    const diag = verifierOrdreDiag(pose)
    assert.equal(
      diag[2],
      '[diag] sentinelles : act hors act 1 · act chevauchants 1 · unmount pendant rendu 1 · React coincé 1 · test expiré 1 · worker perdu 1',
    )
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('plafond de charge : injecté par défaut, jamais doublé si l’appelant borne', () => {
  // Un dépôt par lancement : la capture est nommée par PID, deux runs y déposeraient deux fichiers.
  const sansBorne = fauxDepot(VITEST_VERT)
  const petiteMachine = fauxDepot(VITEST_VERT)
  const avecBorne = fauxDepot(VITEST_VERT)
  const memoirePauvre = fauxDepot(VITEST_VERT)
  try {
    assert.deepEqual(lance(sansBorne, [], 16).argv.slice(0, 2), ['run', '--maxWorkers=4'])
    // Plafond `min(4, cœurs − 1)` sur le chemin RÉEL du lanceur, pas seulement dans la fonction pure.
    assert.deepEqual(lance(petiteMachine, [], 4).argv.slice(0, 2), ['run', '--maxWorkers=3'])
    // La mémoire disponible borne sur le chemin RÉEL : 5 000 Mo ne portent pas un worker, le plancher en sert un.
    assert.deepEqual(lance(memoirePauvre, [], 16, 5000).argv.slice(0, 2), ['run', '--maxWorkers=1'])

    const borne = lance(avecBorne, ['--maxWorkers=2'], 16)
    assert.equal(borne.run.status, 0, `run en échec : ${borne.run.stdout}${borne.run.stderr}`)
    const mins = borne.argv.filter((a) => /^--min-?[wW]orkers(=|$)/.test(a))
    assert.equal(mins.length, 0, `borne minimum non supportée : ${borne.argv.join(' ')}`)
    const maxs = borne.argv.filter((a) => /^--max-?[wW]orkers(=|$)/.test(a))
    assert.equal(maxs.length, 1, `borne injectée par-dessus : ${borne.argv.join(' ')}`)
  } finally {
    for (const base of [sansBorne, petiteMachine, avecBorne, memoirePauvre]) rmSync(base, { recursive: true, force: true })
  }
})

// ── Chemin PARTAGÉ (deux processus Vitest) ────────────────────────────────────────────────────
// Les trois cas ci-dessus forcent `--coverage`, donc le lancement MONO : le chemin réellement servi
// par `npm test` (le partage node/jsdom) n'était couvert par aucun d'eux. `WFRP_TEST_COEURS` et
// `WFRP_TEST_MEMOIRE_MO` forcent le seuil de partage, sinon le verdict dépendrait du runner.
const VITEST_SPLIT =
  LISTE +
  'const argv = process.argv.slice(2)\n' +
  "const cote = /vitest\\.([a-z]+)\\.config/.exec(argv[argv.indexOf('--config') + 1])[1]\n" +
  // Le côté jsdom note son passage au registre de la barrière DOM, comme `src/test-setup.ts`.
  "if (cote === 'jsdom') fs.appendFileSync(process.env.WFRP_DOM_RESIDU_REGISTRE, 'ecran.test.tsx\\tpropre\\n')\n" +
  "process.stdout.write(' Test Files  1 passed (1)\\n')\n" +
  "process.stdout.write('marque-stdout ' + cote + '\\n')\n" +
  "process.stderr.write('marque-stderr ' + cote + '\\n')\n" +
  'process.exit(0)\n'

test('partage node/jsdom : DEUX processus, sorties préfixées par côté, les deux dans la capture', () => {
  const base = fauxDepot(VITEST_SPLIT)
  try {
    // Un fichier par côté : c'est le docblock qui décide, comme Vitest lui-même.
    const cote = { node: join(base, 'moteur.test.ts'), jsdom: join(base, 'ecran.test.tsx') }
    writeFileSync(cote.node, "import { test } from 'vitest'\ntest('n', () => {})\n", 'utf8')
    writeFileSync(cote.jsdom, '// @vitest-environment jsdom\ntest x\n', 'utf8')
    const trace = join(base, 'argv.json')
    const run = spawnSync(process.execPath, [join(base, 'scripts', 'test', 'run.mjs')], {
      cwd: base,
      encoding: 'utf8',
      env: {
        ...process.env,
        TRACE_ARGV: trace,
        WFRP_TEST_COEURS: '16',
        WFRP_TEST_MEMOIRE_MO: '65536',
        ...SANS_VERROU,
        TRACE_FICHIERS: JSON.stringify([cote.node, cote.jsdom].map((p) => p.split('\\').join('/'))),
      },
    })
    assert.equal(run.status, 0, `run partagé en échec : ${run.stdout}${run.stderr}`)
    const cache = join(base, 'node_modules', '.cache')
    const fichiers = readdirSync(cache).filter((n) => /^vitest-run-\d+\.txt$/.test(n))
    assert.equal(fichiers.length, 1, `captures trouvées : ${fichiers.join(', ')}`)
    const capture = readFileSync(join(cache, fichiers[0]), 'utf8')
    // Les DEUX côtés ont tourné, et chaque flux (stdout ET stderr) porte le préfixe de son côté.
    for (const c of ['node', 'jsdom']) {
      assert.ok(capture.includes(`[${c}] marque-stdout ${c}`), `stdout du côté ${c} absent : ${capture}`)
      assert.ok(capture.includes(`[${c}] marque-stderr ${c}`), `stderr du côté ${c} absent : ${capture}`)
    }
    assert.match(capture, /node: exit 0 · jsdom: exit 0 · real [\d.]+s/)
    assert.equal(capture.trimEnd().split('\n').pop(), 'status: 0')
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('bornage du cache : les captures de plus de 7 jours partent, les fraîches restent', () => {
  const base = fauxDepot(VITEST_VERT)
  try {
    const cache = join(base, 'node_modules', '.cache')
    mkdirSync(cache, { recursive: true })
    const vieille = join(cache, 'vitest-run-999999.txt')
    const recente = join(cache, 'vitest-run-999998.txt')
    for (const f of [vieille, recente]) writeFileSync(f, 'ancienne capture\n', 'utf8')
    const il_y_a_8_jours = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
    utimesSync(vieille, il_y_a_8_jours, il_y_a_8_jours)

    const run = spawnSync(process.execPath, [join(base, 'scripts', 'test', 'run.mjs'), '--coverage'], {
      cwd: base,
      encoding: 'utf8',
      env: { ...process.env, TRACE_ARGV: join(base, 'argv.json'), ...SANS_VERROU },
    })
    assert.equal(run.status, 0, `run en échec : ${run.stdout}${run.stderr}`)
    const restants = readdirSync(cache).filter((n) => /^vitest-run-\d+\.txt$/.test(n))
    assert.ok(!restants.includes('vitest-run-999999.txt'), `capture périmée conservée : ${restants.join(', ')}`)
    assert.ok(restants.includes('vitest-run-999998.txt'), `capture fraîche emportée : ${restants.join(', ')}`)
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('échec SANS bilan : la cause brute et l’exit sont imprimés, jamais un résumé vide', () => {
  const base = fauxDepot(VITEST_SANS_BILAN)
  try {
    const { run, capture, chemin } = lance(base)
    assert.equal(run.status, 1)
    assert.match(run.stdout, /ÉCHEC \(code 1\) sans bilan Vitest/)
    assert.match(run.stdout, /No test files found/)
    assert.equal(run.stdout.trimEnd().split('\n').pop(), `capture : ${chemin}`)
    assert.equal(capture.trimEnd().split('\n').pop(), 'status: 1')
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

// ── Registre DOM et PARTIE de la suite (chemin mono, celui de la CI à 4 cœurs) ─────────────────────

/** Lancement sur la machine de la CI (4 cœurs, donc mono), sans `--coverage`. */
function lanceMono(base, env = {}, args = []) {
  return spawnSync(process.execPath, [join(base, 'scripts', 'test', 'run.mjs'), ...args], {
    cwd: base,
    encoding: 'utf8',
    env: { ...process.env, TRACE_ARGV: join(base, 'argv.json'), WFRP_TEST_COEURS: '4', WFRP_TEST_MEMOIRE_MO: '65536', ...SANS_VERROU, ...env },
  })
}

const posixDe = (p) => p.split('\\').join('/')

test('registre DOM ABSENT après un fichier jsdom joué : ÉCHEC nommé — toléré sans aucun fichier jsdom', () => {
  for (const [nom, contenu, statut] of [
    ['ecran.test.tsx', '// @vitest-environment jsdom\n', 1],
    ['moteur.test.ts', "import { test } from 'vitest'\n", 0],
  ]) {
    const base = fauxDepot(VITEST_VERT)
    try {
      const fichier = join(base, nom)
      writeFileSync(fichier, contenu, 'utf8')
      const run = lanceMono(base, { TRACE_FICHIERS: JSON.stringify([posixDe(fichier)]) })
      assert.equal(run.status, statut, `${nom} : ${run.stdout}${run.stderr}`)
      const message = /registre de passage de la barrière DOM ABSENT après 1 fichier\(s\) jsdom joué\(s\)/
      if (statut) assert.match(run.stderr, message)
      else assert.doesNotMatch(run.stderr, message)
    } finally {
      rmSync(base, { recursive: true, force: true })
    }
  }
})

/** Faux Vitest d'une PARTIE : il rend l'`include` de la config reçue (`--config`) dans `TRACE_INCLUDE`. */
const VITEST_PARTIE =
  LISTE +
  'const argv = process.argv.slice(2)\n' +
  "const config = fs.readFileSync(argv[argv.indexOf('--config') + 1], 'utf8')\n" +
  "fs.writeFileSync(process.env.TRACE_INCLUDE, /include: (\\[.*?\\]) \\} \\};/.exec(config)[1], 'utf8')\n" +
  "process.stdout.write(' Test Files  1 passed (1)\\n')\n" +
  'process.exit(0)\n'

test('partie i/K : la tranche part en `include`, compte et empreinte imprimés ; les K tranches partitionnent la liste', () => {
  const noms = Array.from({ length: 9 }, (_, n) => `src/t${n}.test.ts`)
  const K = 3
  const vus = []
  const listes = new Set()
  for (let i = 1; i <= K; i += 1) {
    const base = fauxDepot(VITEST_PARTIE)
    try {
      mkdirSync(join(base, 'src'), { recursive: true })
      for (const n of noms) writeFileSync(join(base, n), "import { test } from 'vitest'\n", 'utf8')
      const trace = join(base, 'include.json')
      const run = lanceMono(base, {
        WFRP_TEST_PARTIE: `${i}/${K}`,
        TRACE_INCLUDE: trace,
        TRACE_FICHIERS: JSON.stringify(noms.map((n) => posixDe(join(base, n)))),
      })
      assert.equal(run.status, 0, `partie ${i} : ${run.stdout}${run.stderr}`)
      const inclus = JSON.parse(readFileSync(trace, 'utf8'))
      const ligne = new RegExp(`^\\[partie\\] ${i}/${K} : ${inclus.length} fichier\\(s\\) sur ${noms.length} · empreinte [0-9a-f]{12} · liste ([0-9a-f]{12})$`, 'm').exec(run.stdout)
      assert.ok(ligne, `ligne [partie] absente : ${run.stdout}`)
      listes.add(ligne[1])
      vus.push(...inclus)
    } finally {
      rmSync(base, { recursive: true, force: true })
    }
  }
  assert.deepEqual([...vus].sort(), [...noms].sort(), 'les tranches jouées ne sont pas une partition de la liste')
  assert.equal(listes.size, 1, 'les K parties d’une même liste impriment la même empreinte de liste')
})

test('partie mal formée, ou combinée à un filtre de fichier : REFUS nommé, aucun Vitest lancé', () => {
  for (const [valeur, args, motif] of [
    ['4/3', [], /REFUS — WFRP_TEST_PARTIE mal formée : « 4\/3 »/],
    ['', [], /REFUS — WFRP_TEST_PARTIE mal formée : « {2}»/],
    ['1/3', ['un-filtre.ts'], /REFUS — WFRP_TEST_PARTIE combinée à un filtre de fichier \(un-filtre\.ts\)/],
  ]) {
    const base = fauxDepot(VITEST_VERT)
    try {
      writeFileSync(join(base, 'un-filtre.ts'), "import { test } from 'vitest'\n", 'utf8')
      const run = lanceMono(base, { WFRP_TEST_PARTIE: valeur }, args)
      assert.equal(run.status, 2, `${valeur} ${args} : ${run.stdout}${run.stderr}`)
      assert.match(run.stderr, motif)
      assert.throws(() => readFileSync(join(base, 'argv.json')), /ENOENT/, 'Vitest a été lancé malgré le refus')
    } finally {
      rmSync(base, { recursive: true, force: true })
    }
  }
})
