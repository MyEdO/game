// Logique PURE du lanceur à deux processus (`scripts/test/run.mjs`) : partition par docblock,
// répartition des workers, routage d'un filtre, argv de l'enfant, verdicts. Le lancement lui-même
// se mesure par `npm test`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import {
  argumentsEnfant,
  bornesWorkers,
  maxWorkersMono,
  cheminsGlobSuspects,
  codeAgrege,
  codeEnfant,
  cotesRequis,
  enteteCapture,
  environnementDe,
  envEnfant,
  filtrerFichiers,
  partitionner,
  porteBilan,
  repartitionWorkers,
  resumeLancement,
  separerArguments,
  SENTINELLES,
  compterSentinelles,
  bilanDiagnostic,
  coeurs,
  capacite,
  memoireDisponibleMo,
  memoireDisponibleOctets,
  EMPREINTE_WORKER_MO,
  PARENT_MO,
  TAS_UTILISE,
  TAS_WORKER_MO,
  partieDe,
  refusDePartie,
  refusRegistreDomAbsent,
  trancher,
} from './partition.mjs'

// `filterFiles` de Vitest résout ses filtres relatifs contre le CWD (`relative(dir, f)`) : la
// racine du cas doit donc être celle d'où tourne le runner, comme en conditions réelles.
const RACINE = process.cwd()
const abs = (r) => `${RACINE}/${r}`

test('docblock : présent, absent, au-delà de 4 000 caractères, dans une chaîne', () => {
  assert.equal(environnementDe('/** @vitest-environment jsdom */\nexport {}'), 'jsdom')
  assert.equal(environnementDe('export {}'), 'node')
  // Vitest lit le fichier ENTIER (resolveConfig.rBxzbVsl.js:6559 — `code.match`, sans borne) :
  // un docblock au-delà de 4 000 caractères classe quand même le fichier en jsdom.
  assert.equal(environnementDe('x'.repeat(9000) + '\n// @vitest-environment jsdom\n'), 'jsdom')
  // Même regex, même angle mort : une occurrence DANS UNE CHAÎNE compte pour Vitest.
  assert.equal(environnementDe('const s = "@vitest-environment jsdom"'), 'jsdom')
  // Le préfixe `jest-` est reconnu, et l'environnement retenu est celui du docblock.
  assert.equal(environnementDe('// @jest-environment happy-dom'), 'happy-dom')
  // `test.environment` de vite.config.ts fait le défaut.
  assert.equal(environnementDe('export {}', 'jsdom'), 'jsdom')
})

test('partition : jsdom d’un côté, tout le reste (y compris happy-dom) de l’autre', () => {
  const codes = {
    'a.test.ts': 'export {}',
    'b.test.tsx': '/** @vitest-environment jsdom */',
    'c.test.ts': '// @vitest-environment happy-dom',
  }
  assert.deepEqual(partitionner(Object.keys(codes), (f) => codes[f]), {
    node: ['a.test.ts', 'c.test.ts'],
    jsdom: ['b.test.tsx'],
  })
})

test('workers : partage à partir de 7 cœurs (n − 1 ≥ 6), 2/3 node · 1/3 jsdom sur n − 1', () => {
  assert.deepEqual(repartitionWorkers(2), { split: false, node: 2, jsdom: 0 })
  assert.deepEqual(repartitionWorkers(3), { split: false, node: 3, jsdom: 0 })
  assert.deepEqual(repartitionWorkers(4), { split: false, node: 4, jsdom: 0 })
  assert.deepEqual(repartitionWorkers(6), { split: false, node: 6, jsdom: 0 })
  assert.deepEqual(repartitionWorkers(7), { split: true, node: 4, jsdom: 2 })
  assert.deepEqual(repartitionWorkers(16), { split: true, node: 10, jsdom: 5 })
})

const partition = {
  node: [abs('src/i18n/labels.test.ts'), abs('src/engine/combat.test.ts')],
  jsdom: [abs('src/ui/CombatConsole.test.tsx')],
}

test('filtrage des fichiers : sous-chaîne relative, dossier, chemin absolu, casse', () => {
  const tous = [...partition.node, ...partition.jsdom]
  assert.deepEqual(filtrerFichiers(tous, [], RACINE, 'win32'), tous)
  assert.deepEqual(filtrerFichiers(tous, ['src/engine'], RACINE, 'win32'), [abs('src/engine/combat.test.ts')])
  assert.deepEqual(filtrerFichiers(tous, ['src\\ui'], RACINE, 'win32'), [abs('src/ui/CombatConsole.test.tsx')])
  assert.deepEqual(filtrerFichiers(tous, [abs('src/ui')], RACINE, 'linux'), [abs('src/ui/CombatConsole.test.tsx')])
  assert.deepEqual(filtrerFichiers(tous, ['SRC/I18N'], RACINE, 'win32'), [abs('src/i18n/labels.test.ts')])
  assert.deepEqual(filtrerFichiers(tous, ['src/inexistant'], RACINE, 'win32'), [])
})

test('routage : un filtre-fichier ne lance que le processus qui porte ce fichier', () => {
  assert.deepEqual(cotesRequis(['src/ui/CombatConsole.test.tsx'], partition, RACINE, 'win32'), ['jsdom'])
  assert.deepEqual(cotesRequis(['src/i18n'], partition, RACINE, 'win32'), ['node'])
  assert.deepEqual(
    cotesRequis(['src/ui/CombatConsole.test.tsx', 'src/i18n'], partition, RACINE, 'win32'),
    ['node', 'jsdom'],
  )
  assert.deepEqual(cotesRequis([], partition, RACINE, 'win32'), ['node', 'jsdom'])
  // Filtre qui ne touche rien : un seul côté est rendu, et `run.mjs` retombe alors sur le
  // lancement mono-processus (cotes.length < 2), qui rend le verdict de Vitest sur ce filtre.
  assert.deepEqual(cotesRequis(['src/inexistant'], partition, RACINE, 'win32'), ['node'])
  // Chemin absolu (préfixe) et casse, comme `filterFiles`.
  assert.deepEqual(cotesRequis([abs('src/ui')], partition, RACINE, 'linux'), ['jsdom'])
  assert.deepEqual(cotesRequis(['SRC/I18N'], partition, RACINE, 'win32'), ['node'])
})

test('chemins à métacaractère de glob : repérés, sinon liste vide', () => {
  assert.deepEqual(cheminsGlobSuspects(['src/a.test.ts', 'src/(b)/c.test.ts']), ['src/(b)/c.test.ts'])
  assert.deepEqual(cheminsGlobSuspects(['src/a[1].test.ts', 'src/b*.ts', 'src/c{d}.ts', 'src/e?.ts']), [
    'src/a[1].test.ts',
    'src/b*.ts',
    'src/c{d}.ts',
    'src/e?.ts',
  ])
  assert.deepEqual(cheminsGlobSuspects(['src/a.test.ts']), [])
})

test('arguments : un positionnel ne route que s’il est un chemin existant ; drapeaux mono', () => {
  const estChemin = (t) => ['src/i18n', 'src/ui/CombatConsole.test.tsx'].includes(t)
  // `2` et `Sort` sont des valeurs de drapeau, pas des filtres.
  assert.deepEqual(separerArguments(['src/i18n', '--retry', '2', '-t', 'Sort'], estChemin), {
    filtres: ['src/i18n'],
    mono: false,
  })
  // Un positionnel qui n'est pas un chemin ne route rien (il part quand même dans l'argv enfant).
  assert.deepEqual(separerArguments(['src/i18n', 'motif-inconnu'], estChemin), {
    filtres: ['src/i18n'],
    mono: false,
  })
  assert.deepEqual(separerArguments(['--coverage']), { filtres: [], mono: true })
  assert.deepEqual(separerArguments(['--config=x.ts']), { filtres: [], mono: true })
  // Sortie machine : le préfixage `[node] `/`[jsdom] ` la rendrait illisible.
  assert.deepEqual(separerArguments(['--reporter', 'json']), { filtres: [], mono: true })
  assert.deepEqual(separerArguments(['--reporter=json', '--outputFile', 'r.json']), {
    filtres: [],
    mono: true,
  })
  assert.deepEqual(separerArguments(['--mergeReports']), { filtres: [], mono: true })
  assert.deepEqual(separerArguments(['--merge-reports']), { filtres: [], mono: true })
  assert.deepEqual(separerArguments(['-r', 'autre/racine'], () => true), {
    filtres: [],
    mono: true,
  })
})

test('argv de l’enfant : les arguments de l’appelant ressortent TELS QUELS, en queue', () => {
  const tete = ['/v.mjs', 'run', '--config', '/atelier/vitest.node.config.ts', '--maxWorkers', '10', '--minWorkers', '1', '--passWithNoTests']
  for (const argv of [
    ['src/i18n', '--retry', '2'],
    ['src/i18n', '--maxWorkers', '4'],
    ['src/i18n/i18n.test.ts', 'src/ui/CombatConsole.test.tsx', '--bail', '1'],
    ['-t', 'Sort de feu', '--no-file-parallelism'],
    [],
  ]) {
    const ligne = argumentsEnfant('/v.mjs', '/atelier/vitest.node.config.ts', 10, argv)
    assert.deepEqual(ligne.slice(0, tete.length), tete)
    assert.deepEqual(ligne.slice(tete.length), argv)
  }
})

test('bornes de charge : injectées par PAIRE, et jamais par-dessus celles de l’appelant', () => {
  assert.deepEqual(bornesWorkers([], 16), ['--minWorkers=1', '--maxWorkers=4'])
  assert.deepEqual(bornesWorkers(['src/engine', '--retry', '2'], 16), [
    '--minWorkers=1',
    '--maxWorkers=4',
  ])
  // Un `--minWorkers` en double fait sortir cac (« Expected a single value ») : aucune injection.
  assert.deepEqual(bornesWorkers(['--minWorkers=2'], 16), [])
  assert.deepEqual(bornesWorkers(['--minWorkers', '2'], 16), [])
  assert.deepEqual(bornesWorkers(['--maxWorkers=8'], 16), [])
  assert.deepEqual(bornesWorkers(['--min-workers=2'], 16), [])
  assert.deepEqual(bornesWorkers(['--max-workers', '8'], 16), [])
  // Un POSITIONNEL qui contient le mot n’est pas un drapeau.
  assert.deepEqual(bornesWorkers(['src/minWorkers.test.ts'], 16), [
    '--minWorkers=1',
    '--maxWorkers=4',
  ])
})

test('plafond mono : min(4, cœurs − 1), plancher 1 — la CI 4 vCPU sert 3 workers', () => {
  assert.equal(maxWorkersMono(4), 3)
  assert.deepEqual(bornesWorkers([], 4), ['--minWorkers=1', '--maxWorkers=3'])
  assert.equal(maxWorkersMono(5), 4)
  assert.equal(maxWorkersMono(16), 4)
  assert.equal(maxWorkersMono(2), 1)
  assert.equal(maxWorkersMono(1), 1)
})

/** Workers TOTAUX servis sur `cpus` cœurs : mono `maxWorkersMono`, partagé `node + jsdom`. */
const workersServis = (cpus) => {
  const r = repartitionWorkers(cpus)
  return r.split ? r.node + r.jsdom : maxWorkersMono(cpus)
}

test('machine vue : entier > 0 forcé par l’environnement, sinon la mesure', () => {
  const mesure = () => 42
  assert.equal(coeurs({ WFRP_TEST_COEURS: '16' }, mesure), 16)
  assert.equal(memoireDisponibleMo({ WFRP_TEST_MEMOIRE_MO: '5000' }, mesure), 5000)
  for (const env of [{}, { WFRP_TEST_COEURS: '0', WFRP_TEST_MEMOIRE_MO: '-3' }, { WFRP_TEST_COEURS: '2.5', WFRP_TEST_MEMOIRE_MO: 'x' }]) {
    assert.equal(coeurs(env, mesure), 42)
    assert.equal(memoireDisponibleMo(env, mesure), 42)
  }
})

test('mémoire disponible : sans contrainte de cgroup, la mesure par défaut lit `process.availableMemory`, jamais `os.freemem`', () => {
  const { availableMemory, constrainedMemory } = process
  const { freemem } = os
  process.availableMemory = () => 1000 * 2 ** 20
  process.constrainedMemory = () => 0
  os.freemem = () => 2000 * 2 ** 20
  try {
    assert.equal(memoireDisponibleMo({}), 1000)
  } finally {
    process.availableMemory = availableMemory
    process.constrainedMemory = constrainedMemory
    os.freemem = freemem
  }
})

test('mémoire disponible sous cgroup : le cache de fichiers est disponible, borné par la mémoire libre', () => {
  const Mo = 2 ** 20
  const stat = (prefixe) => `cache 1\n${prefixe}inactive_file ${480 * Mo}\n${prefixe}active_file ${1150 * Mo}\nfile 999999999999\n`
  const fichiers = {
    '/sys/fs/cgroup/memory/api/bash/memory.stat': stat('total_'),
    '/sys/fs/cgroup/api/v2/memory.stat': stat(''),
  }
  const lire = (f) => {
    if (!(f in fichiers)) throw new Error(`ENOENT ${f}`)
    return fichiers[f]
  }
  const V1 = '4:memory:/api/bash\n3:cpuset:/\n'
  const V2 = '0::/api/v2\n'
  const HYBRIDE = '4:memory:/api/bash\n0::/api/v2\n'
  const nombres = { disponible: 11955 * Mo, contrainte: 13681 * Mo, libre: 15332 * Mo, totale: 16095 * Mo }
  // v1 : `total_inactive_file + total_active_file` = 1 630 Mo ajoutés à `availableMemory`.
  assert.equal(memoireDisponibleOctets(V1, lire, nombres) / Mo, 13585)
  // v2 : `inactive_file + active_file`, jamais `file`.
  assert.equal(memoireDisponibleOctets(V2, lire, nombres) / Mo, 13585)
  // Hybride : le contrôleur v1 `memory` prime (sa ligne est lue, la v2 pointerait ailleurs).
  const v1Seul = (f) => (f.startsWith('/sys/fs/cgroup/memory/') ? lire(f) : '')
  assert.equal(memoireDisponibleOctets(HYBRIDE, v1Seul, nombres) / Mo, 13585)
  // Borné par la mémoire libre de la machine.
  assert.equal(memoireDisponibleOctets(V1, lire, { ...nombres, libre: 12000 * Mo }) / Mo, 12000)
  // Illisible, ou aucune ligne de cgroup (hors Linux) : cache 0, retombe sur `availableMemory`.
  assert.equal(memoireDisponibleOctets('4:memory:/ailleurs\n', lire, nombres) / Mo, 11955)
  assert.equal(memoireDisponibleOctets('', lire, nombres) / Mo, 11955)
  assert.equal(memoireDisponibleOctets(V1, () => 'total_active_file 5\n', nombres) / Mo, 11955)
  // Non contraint : contrainte nulle, ou au-delà de la mémoire totale (ancêtre à 2^63 − 4 096).
  assert.equal(memoireDisponibleOctets(V1, lire, { ...nombres, contrainte: 0 }) / Mo, 11955)
  assert.equal(memoireDisponibleOctets(V1, lire, { ...nombres, contrainte: 9223372036854771712 }) / Mo, 11955)
})

test('invariant mémoire : parents × PARENT_MO + W × EMPREINTE_WORKER_MO ≤ mémoire disponible, plancher 1, jamais plus que les cœurs', () => {
  for (let cpus = 1; cpus <= 32; cpus++) {
    for (let memoire = 1000; memoire <= 64000; memoire += 250) {
      const c = capacite(cpus, memoire)
      const w = workersServis(c.servis)
      const partage = repartitionWorkers(c.servis).split
      const parents = partage ? 2 : 1
      const cas = `${cpus} cœurs, ${memoire} Mo disponibles → ${w} workers, ${parents} parent(s)`
      assert.ok(w >= 1, cas)
      if (memoire < PARENT_MO + EMPREINTE_WORKER_MO) assert.equal(w, 1, `plancher : ${cas}`)
      else assert.ok(parents * PARENT_MO + w * EMPREINTE_WORKER_MO <= memoire, `mémoire dépassée : ${cas}`)
      // Mono IMPOSÉ après coup (`--coverage`, filtre d'un seul côté) sur une capacité qui partageait.
      if (partage) {
        assert.ok(PARENT_MO + maxWorkersMono(c.servis) * EMPREINTE_WORKER_MO <= memoire, `mono imposé : ${cas}`)
      }
      assert.ok(w <= workersServis(cpus), `plus que les cœurs : ${cas}`)
    }
  }
})

test('capacité : cas choisis, attendus écrits à la main', () => {
  // Conteneur de 4 cœurs, 15 424 Mo disponibles : les cœurs bornent, mono à 3 workers.
  assert.deepEqual(capacite(4, 15424), { cpus: 4, memoireMo: 15424, servis: 4, portes: 3, parents: 1, borne: 'cœurs' })
  assert.equal(workersServis(4), 3)
  // 16 cœurs, 24 000 Mo : un parent partagerait (7 cœurs servis), deux retombent sous le seuil.
  assert.deepEqual(capacite(16, 24000), { cpus: 16, memoireMo: 24000, servis: 6, portes: 5, parents: 1, borne: 'mémoire' })
  assert.equal(workersServis(6), 4)
  // 16 cœurs, 25 000 Mo : la mémoire borne, partage à node 4 + jsdom 2, deux parents.
  assert.deepEqual(capacite(16, 25000), { cpus: 16, memoireMo: 25000, servis: 7, portes: 6, parents: 2, borne: 'mémoire' })
  assert.deepEqual(repartitionWorkers(7), { split: true, node: 4, jsdom: 2 })
  // Poste de 31,2 Go : au plus node 5 + jsdom 3 ; la borne de 10 cœurs des lanes mord à 35 306 Mo.
  assert.deepEqual(capacite(16, 31948), { cpus: 16, memoireMo: 31948, servis: 9, portes: 8, parents: 2, borne: 'mémoire' })
  assert.deepEqual(repartitionWorkers(9), { split: true, node: 5, jsdom: 3 })
  assert.deepEqual(capacite(10, 35305), { cpus: 10, memoireMo: 35305, servis: 9, portes: 8, parents: 2, borne: 'mémoire' })
  assert.deepEqual(capacite(10, 35306), { cpus: 10, memoireMo: 35306, servis: 10, portes: 9, parents: 2, borne: 'cœurs' })
  // Mémoire riche : les cœurs bornent, node 10 + jsdom 5.
  assert.deepEqual(capacite(16, 65536), { cpus: 16, memoireMo: 65536, servis: 16, portes: 17, parents: 2, borne: 'cœurs' })
  // Mémoire qui ne porte pas un worker : le plancher en sert un, et le dit.
  assert.deepEqual(capacite(16, 5000), { cpus: 16, memoireMo: 5000, servis: 2, portes: 0, parents: 1, borne: 'plancher' })
  assert.equal(workersServis(2), 1)
  assert.deepEqual(capacite(1, 1000), { cpus: 1, memoireMo: 1000, servis: 1, portes: -1, parents: 1, borne: 'plancher' })
})

test('tas d’un worker : relevé sur la ligne de fichier du reporter, préfixée ou non', () => {
  assert.equal(' ✓ src/engine/dice.test.ts (7 tests) 12ms 245 MB heap used'.match(TAS_UTILISE)?.[1], '245')
  assert.equal('[jsdom]  ✓ src/ui/x.test.tsx (3 tests) 2601 MB heap used'.match(TAS_UTILISE)?.[1], '2601')
  assert.equal(' ✓ src/engine/dice.test.ts (7 tests) 12ms'.match(TAS_UTILISE), null)
})

test('environnement des enfants : NO_COLOR posé, FORCE_COLOR SUPPRIMÉ (pas mis à zéro)', () => {
  const env = envEnfant({ PATH: '/bin', FORCE_COLOR: '3' })
  assert.equal(env.NO_COLOR, '1')
  assert.equal('FORCE_COLOR' in env, false)
  assert.equal(env.PATH, '/bin')
  // Casse Windows : la variable existe parfois en minuscules dans l’objet copié.
  assert.equal('force_color' in envEnfant({ force_color: '1' }), false)
})

test('bilan du reporter : repéré sur « Test Files » / « Tests », pas sur une phrase quelconque', () => {
  assert.ok(porteBilan('  Test Files  3 passed (3)'))
  assert.ok(porteBilan(' Tests  12 passed (12)'))
  assert.ok(!porteBilan('No test files found, exiting with code 1'))
  assert.ok(!porteBilan(''))
  assert.ok(!porteBilan(' ✓ src/engine/dice.test.ts (7 tests)'))
})

test('capture : un en-tête est écrit d’emblée (commande, date, pid, cwd)', () => {
  const entete = enteteCapture({
    commande: 'node scripts/test/run.mjs src/engine',
    pid: 4242,
    cwd: '/depot',
    date: new Date('2026-08-30T10:11:12.000Z'),
  })
  assert.match(entete, /^# commande : node scripts\/test\/run\.mjs src\/engine$/m)
  assert.match(entete, /^# date : 2026-08-30T10:11:12\.000Z$/m)
  assert.match(entete, /^# pid : 4242$/m)
  assert.match(entete, /^# cwd : \/depot$/m)
  assert.ok(entete.endsWith('\n'))
})

test('résumé : un échec SANS bilan rend la cause brute et l’exit ; le chemin clôt toujours', () => {
  const sansBilan = resumeLancement({
    statut: 1,
    bilan: false,
    queue: ['No test files found, exiting with code 1'],
    capture: '/depot/node_modules/.cache/vitest-run-7.txt',
  })
  assert.match(sansBilan, /ÉCHEC \(code 1\) sans bilan Vitest/)
  assert.match(sansBilan, /No test files found/)
  assert.equal(
    sansBilan.trimEnd().split('\n').pop(),
    'capture : /depot/node_modules/.cache/vitest-run-7.txt',
  )
  // Un échec AVEC bilan est déjà raconté par le reporter : pas de redite.
  const avecBilan = resumeLancement({ statut: 1, bilan: true, queue: ['x'], capture: '/c.txt' })
  assert.equal(avecBilan, 'capture : /c.txt\n')
  assert.equal(
    resumeLancement({ statut: 0, bilan: true, queue: [], capture: '/c.txt' }),
    'capture : /c.txt\n',
  )
})

test('verdicts : signal et code absent valent échec, les deux côtés doivent réussir', () => {
  assert.equal(codeEnfant(0, null), 0)
  assert.equal(codeEnfant(1, null), 1)
  assert.equal(codeEnfant(null, 'SIGTERM'), 1)
  assert.equal(codeEnfant(0, 'SIGTERM'), 1)
  assert.equal(codeEnfant(null, null), 1)
  assert.equal(codeAgrege([0, 0]), 0)
  assert.equal(codeAgrege([0, 1]), 1)
  assert.equal(codeAgrege([1, 0]), 1)
  assert.equal(codeAgrege([0]), 0)
})

// Une ligne CANONIQUE par sentinelle, copiée du message de son émetteur (références aux sources
// dans `SENTINELLES`), préfixée comme la console la rend. Une sentinelle qui cesse de mordre —
// message d'amont réécrit, regex retouchée — rend un compte à zéro indiscernable d'un run sain :
// c'est ce silence-là que la table interdit.
const ECHANTILLONS = {
  'act hors act':
    'Warning: An update to CombatConsole inside a test was not wrapped in act(...).',
  'act chevauchants':
    'Warning: You seem to have overlapping act() calls, this is not supported. Be sure to await previous act() calls before making a new one. ',
  'unmount pendant rendu':
    'Warning: Attempted to synchronously unmount a root while React was already rendering. React cannot finish unmounting the root until the current render has completed, which may lead to a race condition.',
  'React coincé': 'Warning: Should not already be working.',
  'test expiré': ' FAIL  src/ui/x.test.tsx > cas > Error: Test timed out in 5000ms.',
  'worker perdu': 'Error: Worker exited unexpectedly',
}

test('sentinelles : chacune MORD sa ligne canonique, et elle seule', () => {
  assert.deepEqual(
    SENTINELLES.map(([libelle]) => libelle),
    Object.keys(ECHANTILLONS),
    'une sentinelle sans ligne canonique ne peut pas être prouvée mordante',
  )
  for (const [libelle, motif] of SENTINELLES) {
    assert.ok(motif.test(ECHANTILLONS[libelle]), `sentinelle muette sur sa ligne : ${libelle}`)
    for (const [autre, ligne] of Object.entries(ECHANTILLONS)) {
      if (autre === libelle) continue
      assert.ok(!motif.test(ligne), `sentinelle « ${libelle} » déborde sur « ${autre} »`)
    }
  }
  // La seconde graphie de « worker perdu », et une ligne banale qui ne doit rien déclencher.
  const [, motifWorker] = SENTINELLES.find(([l]) => l === 'worker perdu')
  assert.ok(motifWorker.test('FATAL ERROR: Reached heap limit — JS heap out of memory'))
  for (const [, motif] of SENTINELLES) assert.ok(!motif.test(' Test Files  1 passed (1)'))
})

test('comptage : cumul par libellé sur un mélange, zéros sur une sortie saine', () => {
  const melange = [
    ECHANTILLONS['act hors act'],
    ECHANTILLONS['act hors act'],
    '[jsdom] ' + ECHANTILLONS['React coincé'],
    ECHANTILLONS['test expiré'],
    ' Tests  3 passed (3)',
  ]
  assert.deepEqual(compterSentinelles(melange), {
    'act hors act': 2,
    'act chevauchants': 0,
    'unmount pendant rendu': 0,
    'React coincé': 1,
    'test expiré': 1,
    'worker perdu': 0,
  })
  assert.deepEqual(
    compterSentinelles([]),
    Object.fromEntries(SENTINELLES.map(([l]) => [l, 0])),
    'le compte vide doit porter les six libellés à zéro',
  )
})

test('bloc [diag] : quatre lignes, mode et bornes RENDUS (jamais déduits des cœurs)', () => {
  const compte = compterSentinelles([ECHANTILLONS['test expiré']])
  const mesure = {
    capacite: capacite(16, 65536),
    memGo: 31.9,
    memMaxGo: 12.75,
    rssMaxMo: 84.4,
    secondes: 97.83,
    tasMaxMo: 2043,
  }
  const mono = bilanDiagnostic(compte, { ...mesure, partage: false, maxWorkers: '4' })
  const lignes = mono.trimEnd().split('\n')
  assert.equal(lignes.length, 4)
  assert.equal(
    lignes[0],
    '[diag] machine : 16 cœurs · 31.9 Go · disponible 64.0 Go → 17 workers portés · réserve de 2 parents · borné par cœurs · mono (seuil 7) · maxWorkers=4',
  )
  assert.equal(
    lignes[1],
    '[diag] mémoire système max : 12.8 Go / 31.9 Go (40 %) · rss lanceur max 84 Mo · fenêtre 97.8 s',
  )
  assert.equal(
    lignes[2],
    '[diag] sentinelles : act hors act 0 · act chevauchants 0 · unmount pendant rendu 0 · React coincé 0 · test expiré 1 · worker perdu 0',
  )
  assert.equal(lignes[3], `[diag] tas max d'un worker : 2043 Mo / ${TAS_WORKER_MO} Mo (67 %)`)
  // À cœurs IDENTIQUES, le mode dépend du run (`--coverage` impose le mono à 16 cœurs).
  const partage = bilanDiagnostic(compte, { ...mesure, partage: true, maxWorkers: 'node 10+jsdom 5' })
  assert.match(partage, /^\[diag\] machine : 16 cœurs · .* · partagé \(seuil 7\) · maxWorkers=node 10\+jsdom 5$/m)
  assert.ok(mono.endsWith('\n'), 'le bloc doit clore sa dernière ligne')
})

test('bloc [diag] : la mémoire qui borne et le plancher sont dits, le tas alerte à 85 % et se dit non relevé', () => {
  const compte = compterSentinelles([])
  const mesure = { capacite: capacite(16, 25000), memGo: 31.2, memMaxGo: 20, rssMaxMo: 60, secondes: 10 }
  const borne = bilanDiagnostic(compte, { ...mesure, partage: true, maxWorkers: 'node 4+jsdom 2', tasMaxMo: 2612 })
  const [machine, , , tas] = borne.trimEnd().split('\n')
  assert.match(machine, / · disponible 24\.4 Go → 6 workers portés · réserve de 2 parents · borné par mémoire \(7 cœurs servis\) · partagé /)
  assert.equal(tas, `[diag] tas max d'un worker : 2612 Mo / ${TAS_WORKER_MO} Mo (85 %) · ALERTE ≥ 85 %`)
  const sousSeuil = bilanDiagnostic(compte, { ...mesure, partage: true, maxWorkers: 'x', tasMaxMo: 2611 })
  assert.ok(!sousSeuil.includes('ALERTE'), sousSeuil)
  const pauvre = bilanDiagnostic(compte, { ...mesure, capacite: capacite(16, 5000), partage: false, maxWorkers: '1', tasMaxMo: null })
  assert.match(pauvre, / · disponible 4\.9 Go → mémoire insuffisante pour un worker \(5000 Mo < 5060 Mo\) · réserve de 1 parent · borné par plancher \(2 cœurs servis\) · mono /)
  const muet = bilanDiagnostic(compte, { ...mesure, partage: true, maxWorkers: 'x', tasMaxMo: null })
  assert.match(muet, new RegExp(`^\\[diag\\] tas max d'un worker : non relevé / ${TAS_WORKER_MO} Mo$`, 'm'))
})

// ── Partie de la suite (`WFRP_TEST_PARTIE`, job matrice `suite` de ci.yml) ─────────────────────────

/** Liste de chemins relatifs POSIX à la forme du dépôt. */
const listeDe = (n) => Array.from({ length: n }, (_, k) => `src/${['ui', 'engine', 'state'][k % 3]}/f${k}.test.ts`)

test('partie : `i/K` avec 1 ≤ i ≤ K, variable absente = null, toute autre forme est un REFUS nommé', () => {
  assert.equal(partieDe(undefined), null)
  assert.deepEqual(partieDe('1/1'), { i: 1, k: 1 })
  assert.deepEqual(partieDe('3/3'), { i: 3, k: 3 })
  for (const mal of ['', '0/3', '4/3', '1/0', '1', '1/3 ', ' 1/3', '01/3', 'a/b', '1/3/4', '-1/3'])
    assert.match(partieDe(mal).refus, new RegExp(`WFRP_TEST_PARTIE mal formée : « ${mal.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')} »`), JSON.stringify(mal))
})

test('partie : un filtre de fichier, un drapeau restrictif ou global à un processus la REFUSENT', () => {
  assert.equal(refusDePartie({ filtres: [], argv: [] }), null)
  assert.equal(refusDePartie({ filtres: [], argv: ['--bail'] }), null, '`--bail` ne restreint pas un run vert')
  assert.match(refusDePartie({ filtres: ['src/a.ts'], argv: ['src/a.ts'] }), /combinée à un filtre de fichier \(src\/a\.ts\)/)
  assert.match(refusDePartie({ filtres: [], argv: ['-t', 'x'] }), /drapeau restrictif -t/)
  assert.match(refusDePartie({ filtres: [], argv: ['--shard=1/2'] }), /drapeau restrictif --shard=1\/2/)
  assert.match(refusDePartie({ filtres: [], argv: ['--config', 'x.ts'] }), /drapeau --config, global à un seul processus/)
})

test('partie : pour K ∈ {1..5}, les K tranches sont DISJOINTES et leur union est la liste', () => {
  const liste = listeDe(200)
  for (let k = 1; k <= 5; k += 1) {
    const tranches = Array.from({ length: k }, (_, i) => trancher(liste, { i: i + 1, k }).fichiers)
    const union = tranches.flat()
    assert.equal(union.length, liste.length, `K=${k} : un fichier joué deux fois ou jamais`)
    assert.deepEqual([...union].sort(), [...liste].sort(), `K=${k} : union ≠ liste`)
    for (const t of tranches) assert.ok(t.length > 0, `K=${k} : une tranche vide sur 200 fichiers`)
  }
})

test('partie : un fichier AJOUTÉ ne déplace aucun autre fichier de tranche', () => {
  const liste = listeDe(120)
  const partieDeChacun = (l, k) =>
    new Map(Array.from({ length: k }, (_, i) => trancher(l, { i: i + 1, k }).fichiers.map((f) => [f, i + 1])).flat())
  for (let k = 2; k <= 5; k += 1) {
    const avant = partieDeChacun(liste, k)
    for (const ajout of ['src/aaa/premier.test.ts', 'src/state/f60b.test.ts', 'zzz/dernier.test.ts']) {
      const apres = partieDeChacun([...liste, ajout], k)
      const deplaces = liste.filter((f) => apres.get(f) !== avant.get(f))
      assert.deepEqual(deplaces, [], `K=${k}, ajout de ${ajout} : fichiers déplacés`)
    }
  }
})

test('partie : la tranche est triée par unité de code, son empreinte ne dépend que de son contenu', () => {
  const liste = listeDe(60)
  const t = trancher(liste, { i: 2, k: 3 })
  assert.deepEqual(t.fichiers, [...t.fichiers].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)))
  assert.match(t.empreinte, /^[0-9a-f]{12}$/)
  assert.equal(trancher([...liste].reverse(), { i: 2, k: 3 }).empreinte, t.empreinte, 'l’ordre d’énumération change l’empreinte')
})

test('registre DOM absent : toléré sans fichier jsdom joué, REFUS nommé dès un fichier jsdom', () => {
  assert.equal(refusRegistreDomAbsent(0), null)
  assert.match(refusRegistreDomAbsent(3), /registre de passage de la barrière DOM ABSENT après 3 fichier\(s\) jsdom joué\(s\)/)
})
