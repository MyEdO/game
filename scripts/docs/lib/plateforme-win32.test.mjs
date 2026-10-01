// Rendu sous win32 (#1801, DoD 1) : chaque dérivé de `GENERATORS` rend le MÊME corps sur l'hôte et
// sous win32. L'hôte de développement est Windows, la CI est Linux : un générateur qui bâtit un chemin
// RELATIF par l'API de `node:path` rend un corps qui dépend de la plateforme. La garde compare, par
// générateur, son `rendre()` sur l'hôte (`renduDe`) à celui d'un processus rendu sous win32 (ce
// module, `--import`, puis `lib/rendre-seul.mjs`). Sur un hôte win32, le rendu natif EST le rendu sous
// win32 : la simulation n'y est pas chargée, la garde mord en CI Linux. Le lieu d'un module décide de
// ce qu'il voit : le dépôt voit win32, `node_modules` voit l'hôte (`estModuleDuDepot`,
// plateforme-win32-hooks.mjs).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import { GENERATORS, renduDe } from '../build-all.mjs'
import { cwdDonne, versPosix, versWindows } from './plateforme-win32-hooks.mjs'

const RACINE = fileURLToPath(new URL('../../../', import.meta.url))
const HOTE = process.platform
/** Le module qui rend sous win32 : l'hôte win32 se rend sans lui. */
const PLATEFORME_WIN32 = new URL('plateforme-win32.mjs', import.meta.url).href
const IMPORT_WIN32 = HOTE === 'win32' ? [] : ['--import', PLATEFORME_WIN32]
const RENDRE_SEUL = fileURLToPath(new URL('rendre-seul.mjs', import.meta.url))
const TSX_ESM = pathToFileURL(fileURLToPath(import.meta.resolve('tsx/esm'))).href

/** Le rendu de `g` par un processus rendu sous win32 : cible → texte. La simulation se pose AVANT
 *  `tsx/esm`. */
function renduSousWin32(g) {
  const args = [...IMPORT_WIN32, ...(g.runner === 'tsx' ? ['--import', TSX_ESM] : []), RENDRE_SEUL, g.script]
  return new Promise((resoudre, rejeter) => {
    const enfant = spawn(process.execPath, args, { cwd: RACINE, env: { ...process.env, WFRP_PLATEFORME_RACINE: RACINE } })
    const sortie = []
    const erreur = []
    enfant.stdout.on('data', (d) => sortie.push(d))
    enfant.stderr.on('data', (d) => erreur.push(d))
    enfant.on('error', rejeter)
    enfant.on('close', (code) => {
      if (code !== 0) rejeter(new Error(`${g.script} sous win32 : sortie ${code}\n${Buffer.concat(erreur)}`))
      else resoudre(new Map(JSON.parse(Buffer.concat(sortie).toString('utf8'))))
    })
  })
}

/** Les ÉCARTS entre le rendu de `script` sur l'hôte et sous win32 (cible → texte, chacun) : une cible
 *  d'un seul côté, ou un corps différent. PUR. */
function ecartsDeRendu(script, hote, win32) {
  const ecarts = []
  for (const cible of new Set([...hote.keys(), ...win32.keys()])) {
    if (!hote.has(cible)) ecarts.push(`${script} : « ${cible} » rendue sous win32 seulement`)
    else if (!win32.has(cible)) ecarts.push(`${script} : « ${cible} » rendue sur l’hôte seulement`)
    else if (hote.get(cible) !== win32.get(cible)) ecarts.push(`${script} : « ${cible} » — le corps dépend de la plateforme`)
  }
  return ecarts
}

test('ecartsDeRendu : corps différent, cible d’un seul côté, rendu identique', () => {
  const rendu = (paires) => new Map(paires)
  assert.deepEqual(ecartsDeRendu('g.mjs', rendu([['cible-a.md', 'a/b']]), rendu([['cible-a.md', 'a\\b']])), ['g.mjs : « cible-a.md » — le corps dépend de la plateforme'])
  assert.deepEqual(ecartsDeRendu('g.mjs', rendu([['cible-a.md', 'x']]), rendu([])), ['g.mjs : « cible-a.md » rendue sur l’hôte seulement'])
  assert.deepEqual(ecartsDeRendu('g.mjs', rendu([]), rendu([['cible-a.md', 'x']])), ['g.mjs : « cible-a.md » rendue sous win32 seulement'])
  assert.deepEqual(ecartsDeRendu('g.mjs', rendu([['cible-a.md', 'x']]), rendu([['cible-a.md', 'x']])), [])
})

test('chaque générateur de `GENERATORS` rend le MÊME corps sur l’hôte et sous win32', { timeout: 900_000 }, async (t) => {
  if (HOTE === 'win32') t.diagnostic('hôte win32 : le rendu natif EST le rendu sous win32 — la garde mord en CI Linux')
  const ecarts = []
  for (const g of GENERATORS) {
    const sousWin32 = renduSousWin32(g)
    const hote = await renduDe(g)
    ecarts.push(...ecartsDeRendu(g.script, hote, await sousWin32))
  }
  assert.deepEqual(ecarts, [])
})

/** `node <args>` depuis `racine` rendu sous win32 (`IMPORT_WIN32`), dépôt rendu : ce que voit un module selon son LIEU.
 *  Sur un hôte win32, la simulation n'est pas chargée : l'attendu s'éprouve contre le win32 RÉEL, la
 *  simulation se vérifie sur l'hôte POSIX de la CI — le diagnostic le NOMME. */
function sousWin32(t, racine, args) {
  if (HOTE === 'win32') t.diagnostic('hôte win32 : simulation NON chargée — attendu éprouvé contre le win32 réel ; la simulation se vérifie en CI Linux')
  const r = spawnSync(process.execPath, [...IMPORT_WIN32, ...args], {
    cwd: racine,
    encoding: 'utf8',
    env: { ...process.env, WFRP_PLATEFORME_RACINE: racine },
  })
  assert.equal(r.status, 0, `${r.stdout}${r.stderr}`)
  return r.stdout.trim()
}

test('rendu sous win32 : `process.cwd()` est en `C:\\` pour le code du dépôt, celui de l’hôte pour node_modules', (t) => {
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
    const vu = JSON.parse(sousWin32(t, racine, [path.join(racine, 'src', 'entree.mjs')]))
    assert.deepEqual(vu.depot, [versWindows(racine), versWindows(path.join(racine, 'x'))])
    assert.deepEqual(vu.tiers, [racine, path.join(racine, 'x')])
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

/** Un dépôt jetable dont `src/entree.mjs` porte `source`, rendu sous win32 : ce qu'il imprime, parsé.
 *  `parLien` : la racine est donnée (cwd, `WFRP_PLATEFORME_RACINE`, entrée) par un lien symbolique
 *  (`junction` : un lien de répertoire que win32 pose sans privilège, ignoré ailleurs). */
function vuDuDepot(t, source, { parLien = false } = {}) {
  const racine = realpathSync(mkdtempSync(path.join(tmpdir(), 'plateforme-win32-')))
  const lien = `${racine}-lien`
  try {
    mkdirSync(path.join(racine, 'src'))
    writeFileSync(path.join(racine, 'src', 'entree.mjs'), source)
    if (parLien) symlinkSync(racine, lien, 'junction')
    const donnee = parLien ? lien : racine
    return { racine, lien, vu: JSON.parse(sousWin32(t, donnee, [path.join(donnee, 'src', 'entree.mjs')])) }
  } finally {
    rmSync(lien, { force: true })
    rmSync(racine, { recursive: true, force: true })
  }
}

test('rendu sous win32 : une racine donnée par un lien symbolique est vue par le code du dépôt comme le LIEN, pas sa cible', (t) => {
  const { lien, vu } = vuDuDepot(t, "console.log(JSON.stringify(process.cwd()))\n", { parLien: true })
  // GetCurrentDirectory (win32)
  assert.equal(vu, versWindows(lien))
})

test('cwdDonne : le cwd sous la racine RÉELLE est rendu sous la racine DONNÉE ; hors d’elle, tel quel', () => {
  assert.equal(cwdDonne('/reel', '/lien', '/reel'), '/lien')
  assert.equal(cwdDonne('/reel/src/a', '/lien', '/reel'), '/lien/src/a')
  assert.equal(cwdDonne('/reel/src', '/lien/', '/reel'), '/lien/src', 'une racine donnée à barre finale')
  assert.equal(cwdDonne('/reel-voisin', '/lien', '/reel'), '/reel-voisin', 'un préfixe de NOM n’est pas un dossier parent')
  assert.equal(cwdDonne('/ailleurs', '/lien', '/reel'), '/ailleurs')
})

test('rendu sous win32 : chaque fonction de `fs` et de `fs.promises` est enveloppée ou déclarée sans chemin', (t) => {
  const { vu } = vuDuDepot(t,
    [
      "import fs from 'node:fs'",
      `import { SANS_CHEMIN_FS } from ${JSON.stringify(PLATEFORME_WIN32)}`,
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

test('rendu sous win32 : `path.posix` appelé du dépôt résout sur le cwd POSIX, comme `posixCwd` de node', (t) => {
  const { racine, vu } = vuDuDepot(t,
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

test('rendu sous win32 : le `cwd` d’un glob et le chemin d’`openAsBlob` en `C:\\` sont ramenés au disque', (t) => {
  const { vu } = vuDuDepot(t,
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

test('rendu sous win32 : le PATH transmis à un enfant est ramené à la graphie de l’hôte, clé en toute casse, argv absent compris', (t) => {
  const { racine, vu } = vuDuDepot(t,
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
test('rendu sous win32 : sur l’arbre réel, tsx (node_modules) trouve son `jsx` et `fs` résout le relatif sur le disque', (t) => {
  const source = [
    "import { getTsconfig } from 'get-tsconfig'",
    "import { realpathSync } from 'node:fs'",
    "console.log(JSON.stringify([getTsconfig()?.config.compilerOptions.jsx, realpathSync('.')]))",
  ].join('\n')
  const vu = JSON.parse(sousWin32(t, RACINE, ['--input-type=module', '--eval', source]))
  assert.deepEqual(vu, ['react-jsx', realpathSync(RACINE)])
})
