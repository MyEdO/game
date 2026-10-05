// Contrat de `docs:check` (#1679 L2 T1d, #1801, #1775, #2203) :
//   · `--check` rejoue chaque générateur et compare son rendu au DISQUE, sans rien écrire ;
//   · en `--check`, `executer` va au bout : chaque rouge est nommé avec sa nature, sortie 1 ;
//   · `--mixtes` (#2193) ne réécrit que `perimetreDesMixtes`, dérivé de la table, jamais `SOURCES_LUES`.
//   node --test scripts/docs/build-all-check.test.mjs  (chaîné dans `npm run test:docs`)
//
// Les cas de bout en bout jouent `executer` pour de vrai, `generateurs` injectés, sur un DÉPÔT
// JETABLE et des générateurs RÉELS qui passent par `ecrireOuVerifier`.
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { listerDossier } from '../guards/lib/lister.mjs'
import { instanceDeDepot } from '../guards/lib/depotGabarit.mjs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { issueDe, natureDuRouge, perimetreDesMixtes } from './build-all.mjs'
import { gitDe } from '../test/gitDeBanc.mjs'

const ICI = path.dirname(fileURLToPath(import.meta.url))

// Chemin de doc ASSEMBLÉ : un littéral `docs/<nom>.md` qui ne désigne AUCUN doc réel est lu par
// `scripts/docs/check-doc-refs.mjs` comme une référence vivante — qu'il déclare morte. Patron :
// `scripts/docs/lib/ecriture-derives.test.mjs`.
const doc = (nom) => ['docs', `${nom}.md`].join('/')
const DOC_A = doc('a')
const DOC_B = doc('b')

test('natureDuRouge : un code de sortie se nomme tel quel', () => {
  for (const status of [1, 2, 3, 13, 6, 7, 3221225794]) assert.equal(natureDuRouge({ status }), `sortie ${status}`)
  assert.equal(natureDuRouge({}), 'sans code de sortie')
})

test('natureDuRouge : un processus tué ou coupé se nomme par son signal ou son errno, jamais « non démarré »', () => {
  assert.equal(natureDuRouge(issueDe({ status: null, signal: 'SIGKILL' })), 'tué par SIGKILL')
  assert.equal(natureDuRouge(issueDe({ status: null, signal: 'SIGTERM', code: 'ENOBUFS', message: 'spawnSync node ENOBUFS' })), 'ENOBUFS (tué par SIGTERM)')
  assert.equal(natureDuRouge(issueDe({ code: 'ENOENT', message: 'spawnSync x ENOENT' })), 'ENOENT')
})

// ── De bout en bout : `executer`, `generateurs` injectés, sur des générateurs RÉELS ─────────────

const PRIMITIVE = pathToFileURL(path.join(ICI, 'lib', 'ecriture-derives.mjs')).href
const BUILD_ALL = pathToFileURL(path.join(ICI, 'build-all.mjs')).href

/** Un générateur RÉEL : lit ses DEUX sources (`SEUIL_SOURCES`), rend un doc qui CITE un chemin, et
 *  passe par la primitive. `cliquet` : sous `BANC_SORTIE=<code>`, il pose ce code AVANT la
 *  primitive, comme `reconcile.mjs` — les deux rouges doivent alors se dire. */
const generateurReel = (nom, { cliquet = false } = {}) => [
  "import { readFileSync } from 'node:fs'",
  `import { ecrireOuVerifier } from ${JSON.stringify(PRIMITIVE)}`,
  `const lu = readFileSync('src/${nom}.ts', 'utf8') + readFileSync('src/commun.ts', 'utf8')`,
  cliquet ? "if (process.env.BANC_SORTIE) { console.log('CLIQUET ROUGE'); process.exitCode = Number(process.env.BANC_SORTIE) }" : '',
  'ecrireOuVerifier({',
  `  out: \`# ${nom}\\n\\nSource : \\\`src/${nom}.ts\\\` (\${lu.length} octets)\\n\`,`,
  `  path: 'docs/${nom}.md',`,
  "  check: process.argv.includes('--check'),",
  `  staleMsg: 'docs/${nom}.md PÉRIMÉ', rerunMsg: 'relancer',`,
  '})',
].join('\n')

const GENERATEURS_REELS = [
  { runner: 'node', script: 'g/a.mjs', targets: [DOC_A] },
  { runner: 'node', script: 'g/b.mjs', targets: [DOC_B] },
]

/** Joue `executer` dans un processus À PART (il imprime sur stderr, que le banc lit), par un HARNAIS
 *  posé sous le `node_modules/` ignoré du dépôt jetable : un module qui en importe un autre par
 *  `file://` absolu, lancé comme tout script. */
function executer(racine, argv, env = {}, verificateurs = [], generateurs = GENERATEURS_REELS) {
  const harnais = path.join(racine, 'node_modules', 'harnais-executer.mjs')
  mkdirSync(path.dirname(harnais), { recursive: true })
  writeFileSync(harnais, [
    `import { executer } from ${JSON.stringify(BUILD_ALL)}`,
    `process.exitCode = await executer({ cwd: ${JSON.stringify(racine)}, argv: ${JSON.stringify(['--quiet', ...argv])}, generateurs: ${JSON.stringify(generateurs)}, verificateurs: ${JSON.stringify(verificateurs)} })`,
  ].join('\n'))
  const r = spawnSync(process.execPath, [harnais], { cwd: racine, encoding: 'utf8', env: { ...process.env, ...env } })
  return { status: r.status, sortie: `${r.stdout}${r.stderr}` }
}

/** Dépôt jetable RÉGÉNÉRÉ par `executer` lui-même (docs, `.sources-lues.json`), puis stagé. */
function depotReel() {
  const { racine } = instanceDeDepot({
    commit: false,
    fichiers: {
      '.gitignore': 'node_modules/\n',
      'src/a.ts': 'export const a = 1\n',
      'src/b.ts': 'export const b = 1\n',
      'src/commun.ts': 'export const commun = 1\n',
      'g/a.mjs': generateurReel('a'),
      'g/b.mjs': generateurReel('b', { cliquet: true }),
    },
  })
  mkdirSync(path.join(racine, 'docs'), { recursive: true })
  const git = gitDe(racine)
  const build = executer(racine, [])
  assert.equal(build.status, 0, `docs:build du banc : ${build.sortie}`)
  git('add', '-A')
  return { racine, git }
}

test('`--check` rejoue chaque générateur : un corps divergent posé sur le disque est NOMMÉ, sortie 1, rien d’écrit', () => {
  const { racine } = depotReel()
  try {
    const cible = path.join(racine, DOC_A)
    const rendu = readFileSync(cible, 'utf8')
    const divergent = rendu.replaceAll('src/a.ts', 'src\\a.ts')
    assert.notEqual(divergent, rendu, 'la fixture n’a substitué aucun séparateur')
    writeFileSync(cible, divergent)
    const rouge = executer(racine, ['--check'])
    assert.equal(rouge.status, 1, rouge.sortie)
    assert.match(rouge.sortie, /docs:check — ROUGE \(1\) :\n {2}docs:check — g\/a\.mjs — sortie 1\n/)
    assert.match(rouge.sortie, /disque : "Source : `src\\\\a\.ts`/, 'la divergence nomme la graphie du disque')
    assert.equal(readFileSync(cible, 'utf8'), divergent, '`--check` n’écrit jamais')
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('`--check` va AU BOUT : un corps divergent ET un cliquet rouge dans le même run, nommés chacun', () => {
  const { racine, git } = depotReel()
  try {
    const cible = path.join(racine, DOC_A)
    writeFileSync(cible, readFileSync(cible, 'utf8').replace('# a\n', '# a édité à la main\n'))
    git('add', DOC_A)
    const rouge = executer(racine, ['--check'], { BANC_SORTIE: '1' })
    assert.equal(rouge.status, 1, rouge.sortie)
    // `g/a.mjs` est rouge le PREMIER : `g/b.mjs`, qui le suit, doit rendre son verdict quand même.
    assert.match(rouge.sortie, /docs:check — ROUGE \(2\) :\n {2}docs:check — g\/a\.mjs — sortie 1\n {2}docs:check — g\/b\.mjs — sortie 1\n/)
    assert.match(rouge.sortie, /CLIQUET ROUGE/)

    // Tout re-rendu : vert.
    assert.equal(executer(racine, []).status, 0)
    git('add', '-A')
    const vert = executer(racine, ['--check'])
    assert.equal(vert.status, 0, vert.sortie)
    assert.match(vert.sortie, /docs:check — OK/)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('`executer` purge son cache de lectures à chaque sortie, verte, rouge ou en ARRÊT', () => {
  const { racine, git } = depotReel()
  const cache = path.join(racine, 'node_modules', '.cache', 'lectures-docs')
  const restes = () => listerDossier(cache, { absent: 'vide' })
  try {
    assert.deepEqual(restes(), [], 'après `docs:build` vert')
    const cible = path.join(racine, DOC_A)
    writeFileSync(cible, readFileSync(cible, 'utf8').replace('# a\n', '# a édité à la main\n'))
    git('add', DOC_A)
    assert.equal(executer(racine, ['--check']).status, 1)
    assert.deepEqual(restes(), [], 'après `--check` rouge')
    assert.equal(executer(racine, [], { BANC_SORTIE: '1' }).status, 1)
    assert.deepEqual(restes(), [], 'après un ARRÊT de `docs:build`')
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('`--check` : un VÉRIFICATEUR rouge est nommé, et sort à 1 (aucune régénération ne le guérit)', () => {
  const { racine } = depotReel()
  try {
    mkdirSync(path.join(racine, 'v'))
    writeFileSync(path.join(racine, 'v', 'rouge.mjs'), "console.error('VÉRIFICATEUR ROUGE'); process.exitCode = 1\n")
    const rouge = executer(racine, ['--check'], {}, ['v/rouge.mjs'])
    assert.equal(rouge.status, 1, rouge.sortie)
    assert.match(rouge.sortie, /VÉRIFICATEUR ROUGE/)
    assert.match(rouge.sortie, /docs:check — ROUGE \(1\) :\n {2}docs:check — v\/rouge\.mjs — sortie 1\n/)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('une cible LITTÉRALE déclarée que le rendu ne produit pas est REFUSÉE, nommément, en écriture comme en `--check`', () => {
  const { racine } = depotReel()
  const fantome = doc('fantome')
  const generateurs = [{ ...GENERATEURS_REELS[0], targets: [DOC_A, fantome] }, GENERATEURS_REELS[1]]
  const refus = `ARRÊT sur g/a.mjs : cible(s) LITTÉRALE(S) déclarée(s) que son rendu ne produit pas : ${fantome}.`
  try {
    const build = executer(racine, [], {}, [], generateurs)
    assert.equal(build.status, 1, build.sortie)
    assert.ok(build.sortie.includes(refus), build.sortie)
    const check = executer(racine, ['--check'], {}, [], generateurs)
    assert.equal(check.status, 1, check.sortie)
    assert.ok(check.sortie.includes(refus), check.sortie)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

// ── `--mixtes` (#2193) : l'étape `docs` du train ne régénère que ce qu'elle commet ─────────────────

test('perimetreDesMixtes se DÉRIVE de la table : un générateur qui gagne un `injecte` y entre, sans liste de noms', () => {
  const code = { runner: 'node', script: 'g/code.mjs', targets: ['src/x.gen.ts'] }
  const pur = { runner: 'node', script: 'g/pur.mjs', targets: [DOC_A] }
  const mixte = { runner: 'node', script: 'g/mixte.mjs', targets: [], injecte: [DOC_B] }
  assert.deepEqual(perimetreDesMixtes([pur, mixte, code]), [mixte, code], 'l’ordre est celui de la table')
  const devenuMixte = { ...pur, injecte: [doc('c')] }
  assert.deepEqual(perimetreDesMixtes([code, devenuMixte, mixte]), [code, devenuMixte, mixte])
})

test('`--mixtes` réécrit les seuls générateurs du périmètre, et JAMAIS `SOURCES_LUES`', () => {
  const { racine } = depotReel()
  try {
    const sourcesLues = path.join(racine, 'docs', '.sources-lues.json')
    writeFileSync(sourcesLues, 'SENTINELLE\n')
    const docB = readFileSync(path.join(racine, DOC_B), 'utf8')
    writeFileSync(path.join(racine, 'src/a.ts'), 'export const a = 22222\n')
    writeFileSync(path.join(racine, 'src/b.ts'), 'export const b = 22222\n')
    const generateurs = [{ ...GENERATEURS_REELS[0], targets: [], injecte: [DOC_A] }, GENERATEURS_REELS[1]]
    const vu = executer(racine, ['--mixtes'], {}, [], generateurs)
    assert.equal(vu.status, 0, vu.sortie)
    assert.match(readFileSync(path.join(racine, DOC_A), 'utf8'), /\(47 octets\)/, 'le mixte est régénéré')
    assert.equal(readFileSync(path.join(racine, DOC_B), 'utf8'), docB, 'un générateur hors périmètre ne joue pas')
    assert.equal(readFileSync(sourcesLues, 'utf8'), 'SENTINELLE\n', '`--mixtes` ne réécrit pas la mesure')
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('`--only` écrit sa sélection, conserve les autres mesures, purge les anciens et garde les vérificateurs', () => {
  const { racine } = depotReel()
  try {
    const fichier = path.join(racine, 'docs', '.sources-lues.json')
    const ancienne = JSON.parse(readFileSync(fichier, 'utf8'))
    ancienne['g/supprime.mjs'] = ancienne['g/b.mjs']
    writeFileSync(fichier, JSON.stringify(ancienne))
    const b = readFileSync(path.join(racine, DOC_B), 'utf8')
    writeFileSync(path.join(racine, 'src/a.ts'), 'export const a = 222222\n')
    writeFileSync(path.join(racine, 'src/b.ts'), 'export const b = 222222\n')
    mkdirSync(path.join(racine, 'v'))
    writeFileSync(path.join(racine, 'v', 'rouge.mjs'), "console.error('VÉRIFICATEUR CONSERVÉ'); process.exitCode = 1\n")
    const vu = executer(racine, ['--only', 'g/a.mjs'], {}, ['v/rouge.mjs'])
    assert.equal(vu.status, 1, vu.sortie)
    assert.match(vu.sortie, /VÉRIFICATEUR CONSERVÉ/)
    assert.match(readFileSync(path.join(racine, DOC_A), 'utf8'), /48 octets/)
    assert.equal(readFileSync(path.join(racine, DOC_B), 'utf8'), b)
    const apres = JSON.parse(readFileSync(fichier, 'utf8'))
    assert.deepEqual(apres['g/b.mjs'], ancienne['g/b.mjs'])
    assert.equal(Object.hasOwn(apres, 'g/supprime.mjs'), false)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

for (const vide of [false, true]) test(`--only refuse ${vide ? 'une sélection vide' : 'un nom inconnu'} avant toute écriture ou préparation de cache`, () => {
  const { racine } = depotReel()
  const cache = path.join(racine, 'node_modules/.cache/lectures-docs')
  const sources = path.join(racine, 'docs/.sources-lues.json')
  try {
    const avant = [DOC_A, DOC_B].map((f) => readFileSync(path.join(racine, f), 'utf8'))
    const mesure = readFileSync(sources, 'utf8')
    writeFileSync(path.join(racine, 'src/a.ts'), 'export const a = 999999\n')
    rmSync(cache, { recursive: true, force: true })
    const selection = vide ? ['--only'] : ['--only', 'g/a.mjs', 'g/typo.mjs']
    for (const mode of [[], ['--check'], ['--code'], ['--mixtes']]) {
      const vu = executer(racine, [...mode, ...selection])
      assert.equal(vu.status, 1, vu.sortie)
      assert.match(vu.sortie, vide ? /--only sélection vide/ : /--only nom\(s\) inconnu\(s\) : g\/typo\.mjs/)
      assert.deepEqual([DOC_A, DOC_B].map((f) => readFileSync(path.join(racine, f), 'utf8')), avant)
      assert.equal(readFileSync(sources, 'utf8'), mesure)
      assert.deepEqual(listerDossier(cache, { absent: 'vide' }), [])
      assert.throws(() => statSync(cache), { code: 'ENOENT' })
    }
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('--only reconnaît les vérificateurs canoniques et conserve tous leurs verdicts', () => {
  const { racine } = depotReel()
  try {
    mkdirSync(path.join(racine, 'v'))
    writeFileSync(path.join(racine, 'v/a.mjs'), "Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 15); console.error('VERIFICATEUR_A'); process.exitCode = 1")
    writeFileSync(path.join(racine, 'v/b.mjs'), "console.error('VERIFICATEUR_B'); process.exitCode = 1")
    const vu = executer(racine, ['--only', 'v/a.mjs'], {}, ['v/a.mjs', 'v/b.mjs'])
    assert.equal(vu.status, 1, vu.sortie)
    assert.match(vu.sortie, /VERIFICATEUR_A/)
    assert.match(vu.sortie, /VERIFICATEUR_B/)
    for (const nom of ['a', 'b']) {
      const debut = `[docs:build] v/${nom}.mjs — début`
      assert.ok(vu.sortie.includes(debut), vu.sortie)
      assert.ok(vu.sortie.indexOf(debut) < vu.sortie.indexOf(`VERIFICATEUR_${nom.toUpperCase()}`), vu.sortie)
      assert.match(vu.sortie, new RegExp(`v/${nom}\\.mjs — fin \\(\\d+ ms\\)`))
    }
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('`--verifier-code` mesure le code identique sans écrire ; code absent ou périmé arrête les docs', () => {
  const { racine } = depotReel()
  const code = 'src/a.gen.ts'
  const generateurs = [{ ...GENERATEURS_REELS[0], targets: [code] }, GENERATEURS_REELS[1]]
  writeFileSync(path.join(racine, 'g/a.mjs'), generateurReel('a').replaceAll(DOC_A, code))
  try {
    assert.equal(executer(racine, [], {}, [], generateurs).status, 0)
    const codeEnPlace = readFileSync(path.join(racine, code), 'utf8')
    const modification = statSync(path.join(racine, code)).mtimeMs
    const mesureAvant = JSON.parse(readFileSync(path.join(racine, 'docs/.sources-lues.json'), 'utf8'))
    const vert = executer(racine, ['--verifier-code'], {}, [], generateurs)
    assert.equal(vert.status, 0, vert.sortie)
    assert.equal(statSync(path.join(racine, code)).mtimeMs, modification)
    assert.deepEqual(JSON.parse(readFileSync(path.join(racine, 'docs/.sources-lues.json'), 'utf8')), mesureAvant)
    const b = readFileSync(path.join(racine, DOC_B), 'utf8')
    for (const absent of [false, true]) {
      if (absent) rmSync(path.join(racine, code))
      else writeFileSync(path.join(racine, code), 'périmé')
      writeFileSync(path.join(racine, 'src/b.ts'), 'export const b = 999999\n')
      const rouge = executer(racine, ['--verifier-code'], {}, [], generateurs)
      assert.equal(rouge.status, 1, rouge.sortie)
      assert.equal(readFileSync(path.join(racine, DOC_B), 'utf8'), b)
      assert.deepEqual(JSON.parse(readFileSync(path.join(racine, 'docs/.sources-lues.json'), 'utf8')), mesureAvant)
    }
    writeFileSync(path.join(racine, code), codeEnPlace)
    assert.equal(executer(racine, ['--verifier-code', '--only', 'g/a.mjs'], {}, [], generateurs).status, 0)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})
