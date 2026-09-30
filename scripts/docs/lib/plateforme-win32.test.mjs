// Rendu sous win32 (#1801) : un générateur qui bâtit un chemin RELATIF par l'API de `node:path`
// rend un corps qui dépend de la plateforme. Le cas est fabriqué par une mutation EN MÉMOIRE (hook
// `load`, aucun fichier du dépôt touché), puis rendu par `build-all.mjs` sur l'arbre réel, en
// `--check` : vert sur un hôte POSIX, rouge rendu sous `--plateforme win32` et sous `--check --tout`.
// Sur un hôte win32, le rendu natif EST le rendu sous win32 : la mutation y rougit en natif, et le
// test le déclare. Le lieu d'un module décide de ce qu'il voit : le dépôt voit win32, `node_modules`
// voit l'hôte (`estModuleDuDepot`, plateforme-win32-hooks.mjs).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import { CODE_CORPS_PERIME } from './empreinte-sources.mjs'
import { PLATEFORMES, rougeDuGenerateur } from '../build-all.mjs'
import { versPosix, versWindows } from './plateforme-win32-hooks.mjs'

const RACINE = fileURLToPath(new URL('../../../', import.meta.url))
const BUILD_ALL = path.join(RACINE, 'scripts', 'docs', 'build-all.mjs')
const HOTE = process.platform
/** Le module qui rend sous win32, tel que `build-all.mjs` le compose : l'hôte win32 se rend sans lui. */
const IMPORT_WIN32 = HOTE === 'win32' ? [] : ['--import', PLATEFORMES.win32]

const donnee = (source) => `data:text/javascript,${encodeURIComponent(source)}`

/** `--import` qui mute `fichier` en mémoire : chaque `[avant, après]` doit s'appliquer, sinon le
 *  chargement échoue (une mutation qui ne mord pas ne prouve rien). */
function importMutation(fichier, remplacements) {
  const hook = [
    `const CIBLE = ${JSON.stringify(pathToFileURL(path.join(RACINE, fichier)).href)}`,
    `const REMPLACEMENTS = ${JSON.stringify(remplacements)}`,
    'export async function load(url, contexte, suivant) {',
    '  const r = await suivant(url, contexte)',
    '  if (url !== CIBLE) return r',
    '  let source = String(r.source)',
    '  for (const [avant, apres] of REMPLACEMENTS) {',
    '    const mutee = source.replace(avant, apres)',
    '    if (mutee === source) throw new Error(`mutation sans prise sur ${CIBLE} : ${avant}`)',
    '    source = mutee',
    '  }',
    '  return { ...r, source }',
    '}',
  ].join('\n')
  return `--import ${donnee(`import { register } from 'node:module'\nregister(${JSON.stringify(donnee(hook))})\n`)}`
}

/** `build-all.mjs --check --quiet <argv>` sur l'arbre réel, la mutation en `NODE_OPTIONS`. */
function verifier(argv, mutation) {
  const r = spawnSync(process.execPath, [BUILD_ALL, '--check', '--quiet', ...argv], {
    cwd: RACINE,
    encoding: 'utf8',
    env: { ...process.env, NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} ${mutation ?? ''}`.trim() },
  })
  return { status: r.status, sortie: `${r.stdout}${r.stderr}` }
}

/** Chaque cas nomme la `cible` dont la mutation change le corps et la `prise` : le motif, dans ce
 *  corps rendu en natif sans mutation, d'un chemin à `/` que la mutation réécrit. */
const CAS = [
  {
    nom: '`listerArbre` joint par `join` — build-vocabulaire',
    script: 'scripts/docs/build-vocabulaire.mjs',
    cible: 'docs/vocabulaire-mecanique.md',
    prise: /`src\/(?:data|engine|state)\/[^`\s/]+\/[^`\s]+/,
    mutation: importMutation('scripts/guards/lib/lister.mjs', [
      ['const enfant = rel ? `${rel}/${nom}` : nom', 'const enfant = rel ? join(rel, nom) : nom'],
    ]),
  },
  {
    nom: '`relatif` rendu par `relative` — build-atlas-index',
    script: 'scripts/raw/build-atlas-index.mjs',
    cible: 'docs/raw/00-index.md',
    prise: /\]\([^)\s/]+\/00-index\.md\)/,
    mutation: importMutation('scripts/raw/_lib.mjs', [
      ["import { dirname, join } from 'node:path'", "import { dirname, join, relative } from 'node:path'"],
      [
        'pages.push({ coeur, nom, relatif, chemin: join(rawDir, relatif), classe })',
        'pages.push({ coeur, nom, relatif: relative(rawDir, join(rawDir, relatif)), chemin: join(rawDir, relatif), classe })',
      ],
    ]),
  },
]

const PERIME = { status: CODE_CORPS_PERIME }
const ROUGE_WIN32 = (script) => rougeDuGenerateur({ script, plateforme: 'win32', issue: PERIME })
const ROUGE_NATIF = (script) => rougeDuGenerateur({ script, issue: PERIME })
/** Le rouge qu'une mutation dépendante de la plateforme doit rendre sous win32, sur CET hôte, et son
 *  code : sur l'hôte win32, le corps périmé du rendu natif, que `docs:build` guérit. */
const ROUGE_ATTENDU = (script) => (HOTE === 'win32' ? ROUGE_NATIF(script) : ROUGE_WIN32(script))
const CODE_ATTENDU = HOTE === 'win32' ? CODE_CORPS_PERIME : 1

for (const cas of CAS) {
  test(`rendu sous win32 — ${cas.nom} : sans mutation, vert sous win32`, (t) => {
    t.diagnostic(`hôte ${HOTE}`)
    const r = verifier(['--tout', '--plateforme', 'win32', '--only', cas.script])
    assert.equal(r.status, 0, r.sortie)
  })

  test(`rendu sous win32 — ${cas.nom} : muté, rouge sous win32, vert sur un hôte POSIX`, (t) => {
    const reference = verifier(['--tout', '--plateforme', HOTE, '--only', cas.script])
    assert.equal(reference.status, 0, reference.sortie)
    assert.match(
      readFileSync(path.join(RACINE, cas.cible), 'utf8'),
      cas.prise,
      `précondition : ${cas.cible}, rendu natif sans mutation, ne porte aucun chemin à \`/\` de la forme ${cas.prise} — la mutation n'a plus de prise sur le RENDU, ce cas ne prouve rien`,
    )
    const natif = verifier(['--tout', '--plateforme', HOTE, '--only', cas.script], cas.mutation)
    const win32 = verifier(['--tout', '--plateforme', 'win32', '--only', cas.script], cas.mutation)
    assert.equal(win32.status, CODE_ATTENDU, win32.sortie)
    assert.ok(win32.sortie.includes(ROUGE_ATTENDU(cas.script)), win32.sortie)
    // Sans `--tout`, la fraîcheur (sources et corps inchangés sur disque) ne saute rien : la
    // plateforme demandée est rendue.
    const sansTout = verifier(['--plateforme', 'win32', '--only', cas.script], cas.mutation)
    assert.equal(sansTout.status, CODE_ATTENDU, sansTout.sortie)
    assert.ok(sansTout.sortie.includes(ROUGE_ATTENDU(cas.script)), sansTout.sortie)
    if (HOTE === 'win32') {
      t.diagnostic('hôte win32 : le rendu natif EST le rendu sous win32, la mutation rougit aussi en natif')
      assert.equal(natif.status, CODE_CORPS_PERIME, natif.sortie)
    } else {
      t.diagnostic(`hôte ${HOTE} : la mutation ne se voit que rendue sous win32`)
      assert.equal(natif.status, 0, natif.sortie)
    }
  })
}

test('`--check --tout` rend chaque générateur sur l\'hôte ET sous win32 : le rouge nomme sa plateforme', (t) => {
  const [cas] = CAS
  const r = verifier(['--tout', '--only', cas.script], cas.mutation)
  assert.equal(r.status, CODE_ATTENDU, r.sortie)
  assert.ok(r.sortie.includes(ROUGE_ATTENDU(cas.script)), r.sortie)
  if (HOTE === 'win32') t.diagnostic('hôte win32 : une seule passe, le rendu natif')
  else assert.ok(!r.sortie.includes(ROUGE_NATIF(cas.script)), r.sortie)
})

/** `node <args>` depuis `racine` rendu sous win32 (`IMPORT_WIN32`), dépôt rendu : ce que voit un module selon son LIEU. */
function sousWin32(racine, args) {
  const r = spawnSync(process.execPath, [...IMPORT_WIN32, ...args], {
    cwd: racine,
    encoding: 'utf8',
    env: { ...process.env, WFRP_PLATEFORME_RACINE: racine },
  })
  assert.equal(r.status, 0, `${r.stdout}${r.stderr}`)
  return r.stdout.trim()
}

test('rendu sous win32 : `process.cwd()` est en `C:\\` pour le code du dépôt, celui de l’hôte pour node_modules', () => {
  const racine = realpathSync(mkdtempSync(path.join(tmpdir(), 'plateforme-win32-')))
  try {
    const vuDe = "import path from 'node:path'\nexport const vu = () => [process.cwd(), path.resolve('x')]\n"
    mkdirSync(path.join(racine, 'src'))
    mkdirSync(path.join(racine, 'node_modules', 'tiers'), { recursive: true })
    writeFileSync(path.join(racine, 'src', 'depot.mjs'), vuDe)
    writeFileSync(path.join(racine, 'node_modules', 'tiers', 'tiers.mjs'), vuDe)
    writeFileSync(
      path.join(racine, 'src', 'entree.mjs'),
      "import { vu as depot } from './depot.mjs'\nimport { vu as tiers } from '../node_modules/tiers/tiers.mjs'\n" +
        'console.log(JSON.stringify({ depot: depot(), tiers: tiers() }))\n',
    )
    const vu = JSON.parse(sousWin32(racine, [path.join(racine, 'src', 'entree.mjs')]))
    assert.deepEqual(vu.depot, [versWindows(racine), versWindows(path.join(racine, 'x'))])
    assert.deepEqual(vu.tiers, [racine, path.join(racine, 'x')])
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

/** Un dépôt jetable dont `src/entree.mjs` porte `source`, rendu sous win32 : ce qu'il imprime, parsé.
 *  `parLien` : la racine est donnée (cwd, `WFRP_PLATEFORME_RACINE`, entrée) par un lien symbolique
 *  (`junction` : un lien de répertoire que win32 pose sans privilège, ignoré ailleurs) ; `cwdHote` :
 *  le cwd que l'hôte donne à un enfant lancé depuis elle, sans rendu. */
function vuDuDepot(source, { parLien = false } = {}) {
  const racine = realpathSync(mkdtempSync(path.join(tmpdir(), 'plateforme-win32-')))
  const lien = `${racine}-lien`
  try {
    mkdirSync(path.join(racine, 'src'))
    writeFileSync(path.join(racine, 'src', 'entree.mjs'), source)
    if (parLien) symlinkSync(racine, lien, 'junction')
    const donnee = parLien ? lien : racine
    const cwdHote = spawnSync(process.execPath, ['-e', 'process.stdout.write(process.cwd())'], { cwd: donnee, encoding: 'utf8' }).stdout
    return { racine, cwdHote, vu: JSON.parse(sousWin32(donnee, [path.join(donnee, 'src', 'entree.mjs')])) }
  } finally {
    rmSync(lien, { force: true })
    rmSync(racine, { recursive: true, force: true })
  }
}

test('rendu sous win32 : une racine donnée par un lien symbolique est simulée comme sa cible', () => {
  const { cwdHote, vu } = vuDuDepot("console.log(JSON.stringify(process.cwd()))\n", { parLien: true })
  assert.equal(vu, versWindows(cwdHote))
})

test('rendu sous win32 : chaque fonction de `fs` et de `fs.promises` est enveloppée ou déclarée sans chemin', () => {
  const { vu } = vuDuDepot(
    [
      "import fs from 'node:fs'",
      `import { SANS_CHEMIN_FS } from ${JSON.stringify(PLATEFORMES.win32)}`,
      'const oubliees = []',
      "for (const [nom, hote] of [['fs', fs], ['fs.promises', fs.promises]]) {",
      '  for (const cle of Object.keys(hote)) {',
      "    if (typeof hote[cle] !== 'function' || hote[cle].name === 'enveloppe') continue",
      "    if (!SANS_CHEMIN_FS.has(cle.replace(/Sync$/, ''))) oubliees.push(`${nom}.${cle}`)",
      '  }',
      '}',
      'console.log(JSON.stringify(oubliees))',
      '',
    ].join('\n'),
  )
  assert.deepEqual(vu, [])
})

test('rendu sous win32 : `path.posix` appelé du dépôt résout sur le cwd POSIX, comme `posixCwd` de node', () => {
  const { racine, vu } = vuDuDepot(
    [
      "import path, { posix } from 'node:path'",
      "import posixSeul from 'node:path/posix'",
      "import win32Seul from 'node:path/win32'",
      'console.log(JSON.stringify([',
      "  path.posix.resolve('a'), posix.resolve('a'), posixSeul.resolve('a'), win32Seul.posix.resolve('a'),",
      "  path.posix.relative('/', 'a'), posix.win32.resolve('a'), path.resolve('a'),",
      ']))',
      '',
    ].join('\n'),
  )
  const posixA = versPosix(path.join(racine, 'a'))
  const windowsA = versWindows(path.join(racine, 'a'))
  assert.deepEqual(vu, [posixA, posixA, posixA, posixA, posixA.slice(1), windowsA, windowsA])
})

test('rendu sous win32 : le `cwd` d’un glob et le chemin d’`openAsBlob` en `C:\\` sont ramenés au disque', () => {
  const { vu } = vuDuDepot(
    [
      "import fs from 'node:fs'",
      "import path from 'node:path'",
      "const src = path.join(process.cwd(), 'src')",
      'const blob = await fs.openAsBlob(path.join(src, "entree.mjs"))',
      'const asynchrone = []',
      "for await (const f of fs.promises.glob('*.mjs', { cwd: src })) asynchrone.push(f)",
      "const rappel = await new Promise((r, e) => fs.glob('*.mjs', { cwd: src }, (err, l) => (err ? e(err) : r(l))))",
      "console.log(JSON.stringify([fs.globSync('*.mjs', { cwd: src }), asynchrone, rappel, blob.size > 0]))",
      '',
    ].join('\n'),
  )
  assert.deepEqual(vu, [['entree.mjs'], ['entree.mjs'], ['entree.mjs'], true])
})

test('rendu sous win32 : le PATH transmis à un enfant est ramené à la graphie de l’hôte, clé en toute casse, argv absent compris', () => {
  const { racine, vu } = vuDuDepot(
    [
      "import { spawnSync } from 'node:child_process'",
      "import path from 'node:path'",
      "const bin = path.join(process.cwd(), 'node_modules', '.bin')",
      "const lu = (env) => spawnSync(process.execPath, ['-e', 'process.stdout.write(process.env.Path ?? process.env.PATH)'], { env, encoding: 'utf8' }).stdout",
      'console.log(JSON.stringify([',
      "  lu({ Path: [bin, path.join(path.parse(process.cwd()).root, 'outils')].join(path.delimiter) }),",
      "  lu({ PATH: '/usr/bin:/bin' }),",
      "  spawnSync(process.execPath, undefined, { cwd: process.cwd(), input: 'process.stdout.write(process.cwd())', encoding: 'utf8' }).stdout,",
      ']))',
      '',
    ].join('\n'),
  )
  const graphieDeLHote = [path.join(racine, 'node_modules', '.bin'), path.join(path.parse(racine).root, 'outils')].join(path.delimiter)
  assert.deepEqual(vu, [graphieDeLHote, '/usr/bin:/bin', racine])
})

// Sur l'arbre réel, les deux modules de la simulation sont SOUS la racine : leurs enveloppes de `fs`
// passent des chemins POSIX à l'hôte, qui résout le relatif par le cwd de l'hôte.
test('rendu sous win32 : sur l’arbre réel, tsx (node_modules) trouve son `jsx` et `fs` résout le relatif sur le disque', () => {
  const source = [
    "import { getTsconfig } from 'get-tsconfig'",
    "import { realpathSync } from 'node:fs'",
    "console.log(JSON.stringify([getTsconfig()?.config.compilerOptions.jsx, realpathSync('.')]))",
  ].join('\n')
  const vu = JSON.parse(sousWin32(RACINE, ['--input-type=module', '--eval', source]))
  assert.deepEqual(vu, ['react-jsx', realpathSync(RACINE)])
})

test('`--plateforme` inconnue, sans valeur ou en surnombre : refus nommé, rien de rendu', () => {
  for (const [argv, recu] of [
    [['--plateforme', 'amiga'], 'amiga'],
    [['--plateforme'], ''],
    [['--plateforme', '--only', 'scripts/raw/reanchor.mjs'], ''],
    [['--plateforme', 'win32', HOTE, '--only', 'scripts/raw/reanchor.mjs'], `win32 ${HOTE}`],
  ]) {
    const r = verifier(argv)
    assert.equal(r.status, 1, `${argv.join(' ')} : ${r.sortie}`)
    assert.ok(r.sortie.includes(`--plateforme « ${recu} » : attend UNE plateforme parmi ${HOTE}`), r.sortie)
  }
})
