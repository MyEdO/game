// node --test scripts/test/gitDeBanc.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { rmSync } from 'node:fs'
import { envDeDepotForge, instanceDeDepot } from '../guards/lib/depotGabarit.mjs'
import { gitDe, gitDeLArbreReel, lancerGit, resultatDeGit, resultatDeLArbreReel } from './gitDeBanc.mjs'

/** `fn(racine)` sur une instance jetée à la sortie. */
function dansUneInstance(fn) {
  const { racine } = instanceDeDepot({ fichiers: { 'a.txt': 'a\n' }, message: 'banc' })
  try {
    return fn(racine)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
}

/** `fn()` sous `process.env` augmenté de `vars`, restauré à la sortie. */
function sousEnv(vars, fn) {
  const avant = Object.fromEntries(Object.keys(vars).map((k) => [k, process.env[k]]))
  Object.assign(process.env, vars)
  try {
    return fn()
  } finally {
    for (const [k, v] of Object.entries(avant)) { if (v === undefined) delete process.env[k]; else process.env[k] = v }
  }
}

test('un git qui ÉCHOUE jette un message qui porte SON stderr, pas la seule ligne de commande (#2155)', () => {
  dansUneInstance((racine) => {
    assert.throws(() => lancerGit(['show', 'revision-absente'], { cwd: racine }), /fatal: .*revision-absente/)
  })
})

test('un `git commit` à vide jette un message qui porte son code de sortie et la cause que git écrit sur STDOUT (#2155)', () => {
  dansUneInstance((racine) => {
    assert.throws(() => lancerGit(['commit', '-q', '-m', 's6'], { cwd: racine, env: { ...envDeDepotForge(), LC_ALL: 'C' } }), (e) => {
      assert.match(e.message, /git commit -q -m s6 en échec/)
      assert.match(e.message, /code 1/)
      assert.match(e.message, /nothing to commit/)
      assert.equal(e.status, 1)
      assert.ok(e.cause, 'l’erreur d’origine reste en `cause`')
      return true
    })
  })
})

test('`resultatDeLArbreReel` rend le résultat sous l’env HÉRITÉ', () => {
  dansUneInstance((racine) => {
    sousEnv({ GIT_AUTHOR_NAME: 'Intrus', GIT_AUTHOR_EMAIL: 'intrus@example.invalid' }, () => {
      const r = resultatDeLArbreReel(['var', 'GIT_AUTHOR_IDENT'], { cwd: racine })
      assert.equal(r.status, 0, r.stderr)
      assert.match(r.stdout, /^Intrus <intrus@example\.invalid>/)
    })
  })
})

test('le banc lance git sous `envDeDepotForge()` ; `gitDeLArbreReel` sous l’env HÉRITÉ', () => {
  dansUneInstance((racine) => {
    sousEnv({ GIT_AUTHOR_NAME: 'Intrus', GIT_AUTHOR_EMAIL: 'intrus@example.invalid' }, () => {
      assert.match(gitDe(racine)('var', 'GIT_AUTHOR_IDENT'), /^mesure <mesure@example\.invalid>/)
      assert.match(gitDeLArbreReel(racine)('var', 'GIT_AUTHOR_IDENT'), /^Intrus <intrus@example\.invalid>/)
    })
  })
})

test('`net` rend la sortie sans ses blancs de bord ; `input` alimente stdin', () => {
  dansUneInstance((racine) => {
    const sha = gitDe(racine, { net: true })('rev-parse', 'HEAD')
    assert.match(sha, /^[0-9a-f]{40}$/)
    assert.equal(gitDe(racine)('rev-parse', 'HEAD'), `${sha}\n`)
    assert.match(lancerGit(['hash-object', '--stdin'], { cwd: racine, input: 'o\n', net: true }), /^[0-9a-f]{40}$/)
  })
})

test('`resultatDeGit` rend status, stdout et stderr sans jeter', () => {
  dansUneInstance((racine) => {
    const r = resultatDeGit(['show', 'revision-absente'], { cwd: racine })
    assert.notEqual(r.status, 0)
    assert.match(r.stderr, /revision-absente/)
  })
})
