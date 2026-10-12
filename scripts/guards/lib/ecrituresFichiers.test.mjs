import test from 'node:test'
import assert from 'node:assert/strict'
import { MOT_INCONNU, ciblesDEcritureJS } from './ecrituresFichiers.mjs'
test('provenance fs sous alias sans fabriquer les homonymes', () => {
  const cibles = text => ciblesDEcritureJS(text).map(c => c.chemin)
  assert.deepEqual(cibles("require('fs').writeFileSync('x','a')"), ['x'])
  assert.deepEqual(cibles("const fs=require('fs'); const a=fs; a.writeFileSync('x','a')"), ['x'])
  assert.deepEqual(cibles("const fs=require('fs'); function f(fs){fs.writeFileSync('x','a')}"), [])
  assert.deepEqual(cibles("let fs=require('fs'); fs={}; fs.writeFileSync('x','a')"), [])
})

test('#2537 — chemins constants repliés : `const`, `+`, gabarit, `path`, `process.argv[k]`, `tmpdir()`, `process.env.TEMP`', () => {
  const plie = (text, contexte) => ciblesDEcritureJS(text, contexte).map(c => (c.inconnue ? null : c.chemin.split('\\').join('/')))
  const fs = "import fs from 'node:fs'\nimport { join } from 'node:path'\nimport { tmpdir } from 'node:os'\n"
  assert.deepEqual(plie(`${fs}const d = 'out'\nconst f = d + '/x.txt'\nfs.writeFileSync(f, 'a')`), ['out/x.txt'])
  assert.deepEqual(plie(`${fs}const r = join('a', 'b')\nfs.writeFileSync(\`\${r}/c\`, 'a')`), ['a/b/c'])
  assert.deepEqual(plie(`${fs}let d = 'out'\nfs.writeFileSync(d, 'a')`), [null])
  assert.deepEqual(plie(`${fs}fs.writeFileSync(process.argv[2], 'a')`, { argv: ['node', 's.mjs', 'sortie.txt'] }), ['sortie.txt'])
  assert.deepEqual(plie(`${fs}fs.writeFileSync(process.argv[2], 'a')`), [null])
  assert.deepEqual(plie(`${fs}fs.writeFileSync(join(tmpdir(), 'x'), 'a')`, { env: { TEMP: 'T' }, platform: 'win32' }), ['T/x'])
  assert.deepEqual(plie(`${fs}fs.writeFileSync(join(tmpdir(), 'x'), 'a')`, { env: {}, platform: 'win32' }), [null])
  assert.deepEqual(plie(`${fs}fs.writeFileSync(join(process.env.TMP, 'x'), 'a')`, { env: { TMP: 't' }, platform: 'linux' }), ['t/x'])
  assert.deepEqual(plie(`${fs}fs.writeFileSync(join(process.env.HOME, 'x'), 'a')`, { env: { HOME: 'h' } }), [null])
})

test('#2537 — un pli de chemin est celui du module importé, jamais un homonyme local', () => {
  const plie = (text, contexte) => ciblesDEcritureJS(text, contexte).map(c => (c.inconnue ? null : c.chemin.split('\\').join('/')))
  const fs = "import fs from 'node:fs'\n"
  assert.deepEqual(plie(`${fs}const join = (...a) => 'x'\nfs.writeFileSync(join('a', 'b'), 'a')`), [null])
  assert.deepEqual(plie(`${fs}const tmpdir = () => 'x'\nfs.writeFileSync(tmpdir() + '/b', 'a')`, { env: { TEMP: 'T' }, platform: 'win32' }), [null])
  assert.deepEqual(plie(`${fs}import * as P from 'node:path'\nfs.writeFileSync(P.join('a', 'b'), 'a')`), ['a/b'])
  assert.deepEqual(plie(`${fs}const { join: j } = require('node:path')\nfs.writeFileSync(j('a', 'b'), 'a')`), ['a/b'])
  assert.deepEqual(plie(`${fs}fs.writeFileSync(['a', 'b'].join('/'), 'a')`), ['a/b'])
  assert.deepEqual(plie(`${fs}import { fileURLToPath as u } from 'node:url'\nfs.writeFileSync(u(import.meta.url), 'a')`, { fichier: 'd/s.mjs' }), ['d/s.mjs'])
  assert.deepEqual(plie(`${fs}const fileURLToPath = () => 'x'\nfs.writeFileSync(fileURLToPath(import.meta.url), 'a')`, { fichier: 'd/s.mjs' }), [null])
})

test('#2537 — `import()` de `fs` attendu lu comme l’import statique ; non attendu ou non constant : cible inconnue', () => {
  const cibles = (text) => ciblesDEcritureJS(text).map(c => (c.inconnue ? `?${c.operation}` : c.chemin))
  assert.deepEqual(cibles("const fs = await import('node:fs')\nfs.writeFileSync('x', 'a')"), ['x'])
  assert.deepEqual(cibles("const { writeFileSync } = await import('node:fs')\nwriteFileSync('y', 'a')"), ['y'])
  assert.deepEqual(cibles("const fs = (await import('node:fs')).default\nfs.writeFileSync('z', 'a')"), ['z'])
  assert.deepEqual(cibles("import('node:fs').then((fs) => fs.writeFileSync('x', 'a'))"), ['?import-dynamique'])
  assert.deepEqual(cibles("const m = 'node:' + process.argv[2]\nawait import(m)"), ['?import-dynamique'])
})

test('#2537 — `node:child_process` : la commande littérale se rend à juger, une commande non constante est inconnue', () => {
  const cibles = (text) => ciblesDEcritureJS(text).map(c => c.commande ?? (c.inconnue ? `?${c.operation}` : c.chemin))
  const cp = "import { execSync, spawnSync } from 'node:child_process'\n"
  assert.deepEqual(cibles(`${cp}execSync('echo x > y')`), ['echo x > y'])
  assert.deepEqual(cibles(`${cp}spawnSync('npm', ['run', 'build'])`), ["'npm' 'run' 'build'"])
  assert.deepEqual(cibles(`${cp}execSync(process.argv[2])`), ['?execSync'])
  assert.deepEqual(cibles("execSync('echo x > y')"), [])
})

test('#2537 — un lanceur se reconnaît à son import ; `process.execPath` est `node` ; un argument non constant est `MOT_INCONNU`', () => {
  const cibles = (text) => ciblesDEcritureJS(text).map(c => c.commande ?? (c.inconnue ? `?${c.operation}` : c.chemin))
  const cp = "import { spawnSync } from 'node:child_process'\n"
  assert.deepEqual(cibles(`${cp}const s = String(spawnSync('cat', ['x']).stdout)\nconst m = /x(\\d+)/.exec(s)`), ["'cat' 'x'"])
  assert.deepEqual(cibles(`${cp}spawnSync(process.execPath, ['--test', 'a.test.mjs'])`), ["'node' '--test' 'a.test.mjs'"])
  assert.deepEqual(cibles(`${cp}spawnSync('cat', ['-n', process.argv[2]])`), [`'cat' '-n' ${MOT_INCONNU}`])
  assert.deepEqual(cibles(`${cp}const a = ['x']\nspawnSync('rm', [...a])`), [`'rm' ${MOT_INCONNU}`])
  assert.deepEqual(cibles(`${cp}spawnSync(process.argv[2], ['x'])`), ['?spawnSync'])
  assert.deepEqual(cibles("const exec = (s) => s\nexec('rm -rf x')"), [])
})
