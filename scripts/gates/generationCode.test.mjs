import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { executer } from '../docs/build-all.mjs'
import { argumentsDeGenerationCode } from './generationCode.mjs'
import { gitDe } from '../test/gitDeBanc.mjs'

test('le démarrage test vérifie une cible manquante sans la produire ; le démarrage normal la produit', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'generation-code-banc-'))
  try {
    const git = gitDe(cwd)
    git('init', '-q')
    mkdirSync(join(cwd, 'src'))
    const primitive = new URL('../docs/lib/ecriture-derives.mjs', import.meta.url).href
    writeFileSync(join(cwd, 'source.txt'), 'export const valeur = 1;\n')
    writeFileSync(join(cwd, 'generateur.mjs'), `import {readFileSync} from 'node:fs'; import {ecrireOuVerifier} from ${JSON.stringify(primitive)}; ecrireOuVerifier({out:readFileSync('source.txt','utf8'),path:'src/cible.ts',check:process.argv.includes('--check'),staleMsg:'cible absente',rerunMsg:'generer'});`)
    const generateurs = [{ runner: 'node', script: 'generateur.mjs', targets: ['src/cible.ts'] }]
    const jouer = (test) => executer({ cwd, argv: argumentsDeGenerationCode(test, generateurs), generateurs, verificateurs: [] })
    assert.equal(await jouer(true), 1)
    assert.equal(existsSync(join(cwd, 'src/cible.ts')), false)
    assert.equal(await jouer(false), 0)
    assert.equal(readFileSync(join(cwd, 'src/cible.ts'), 'utf8'), readFileSync(join(cwd, 'source.txt'), 'utf8'))
    assert.equal(await jouer(true), 0)
  } finally { rmSync(cwd, { recursive: true, force: true }) }
})
