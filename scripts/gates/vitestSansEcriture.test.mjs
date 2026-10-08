import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { gitDe } from '../test/gitDeBanc.mjs'

const RACINE = fileURLToPath(new URL('../../', import.meta.url))
const SETUP = new URL('./vitestSansEcriture.mjs', import.meta.url).href
const CLI = join(RACINE, 'node_modules/vitest/vitest.mjs')

test('la configuration Vitest réelle protège les suites avant leur import', async () => {
  const { default: config } = await import('../../vite.config.ts')
  assert.ok(config.test.setupFiles.includes(fileURLToPath(new URL('./vitestSansEcriture.mjs', import.meta.url))))
})

test('Vitest installe la garde avant import, transmet aux enfants et restaure entre suites', () => {
  const racine = mkdtempSync(join(tmpdir(), 'vitest-sans-ecriture-'))
  try {
    const git = gitDe(racine)
    git('init', '-q'); git('config', 'user.name', 'banc'); git('config', 'user.email', 'banc@local')
    mkdirSync(join(racine, 'scripts/map'), { recursive: true })
    symlinkSync(join(RACINE, 'node_modules'), join(racine, 'node_modules'), 'junction')
    writeFileSync(join(racine, '.gitignore'), 'node_modules\n')
    const setup = join(racine, 'setup.mjs')
    writeFileSync(setup, `import { protegerSuiteVitest } from ${JSON.stringify(SETUP)}; await protegerSuiteVitest(${JSON.stringify(racine)});`)
    writeFileSync(join(racine, 'vitest.config.mjs'), `export default {test:{include:['scripts/map/*.test.ts','src/*.test.ts'],setupFiles:[${JSON.stringify(setup)}],pool:'forks',maxWorkers:1,isolate:false}};`)
    const fichier = join(racine, 'scripts/map/banc.test.ts')
    const jouer = (source) => {
      writeFileSync(fichier, source)
      git('add', '.'); git('commit', '-q', '-m', 'banc')
      const env = { ...process.env, PYTHONDONTWRITEBYTECODE: '0' }
      delete env.NODE_TEST_CONTEXT; delete env.WFRP_TESTS_RACINE; delete env.WFRP_TESTS_REFUS; delete env.NODE_OPTIONS
      return spawnSync(process.execPath, [CLI, 'run', '--config', 'vitest.config.mjs'], { cwd: racine, env, encoding: 'utf8', maxBuffer: 1e7 })
    }
    const imports = `import {test,expect} from 'vitest'; import {writeFileSync} from 'node:fs';`
    const top = jouer(`${imports} writeFileSync('pollution','interdit'); test('inatteignable',()=>{});`)
    assert.notEqual(top.status, 0, top.stdout + top.stderr)
    assert.match(top.stdout + top.stderr, /REFUS.*pollution/)
    const enfant = jouer(`${imports} import {spawnSync} from 'node:child_process'; test('enfant',()=>{spawnSync(process.execPath,['-e',"require('fs').writeFileSync('pollution','interdit')"]);});`)
    assert.notEqual(enfant.status, 0, enfant.stdout + enfant.stderr)
    assert.match(enfant.stdout + enfant.stderr, /REFUS.*pollution/)
    mkdirSync(join(racine, 'src'))
    writeFileSync(join(racine, 'src/hors-scripts.test.ts'), `// @vitest-environment jsdom\nimport {test,expect} from 'vitest';import {URL as NodeURL} from 'node:url';test('jsdom hors scripts : env restauré et URL de navigateur',()=>{expect(process.env.WFRP_TESTS_RACINE).toBeUndefined();expect(process.env.WFRP_TESTS_REFUS).toBeUndefined();expect(process.env.PYTHONDONTWRITEBYTECODE).toBe('0');expect(URL).toBe(window.URL);expect(URL).not.toBe(NodeURL);expect(new URL('/module','http://localhost:5173').protocol).toBe('http:');expect(new NodeURL('file:///tmp/module').protocol).toBe('file:')});`)
    const vert = jouer(`${imports} import {mkdtempSync,rmSync} from 'node:fs'; import {tmpdir} from 'node:os'; import {join} from 'node:path'; test('temporaire',()=>{expect(process.env.PYTHONDONTWRITEBYTECODE).toBe('1');const d=mkdtempSync(join(tmpdir(),'vitest-banc-'));try{writeFileSync(join(d,'permis'),'ok');expect(1).toBe(1)}finally{rmSync(d,{recursive:true,force:true})}});`)
    assert.equal(vert.status, 0, vert.stdout + vert.stderr)
    assert.throws(() => readFileSync(join(racine, 'pollution')), /ENOENT/)
  } finally { rmSync(racine, { recursive: true, force: true }) }
})
