// node --test scripts/test/gitDeBanc.test.mjs
import { tableTotale } from '../../src/lib/tableTotale.ts'
import test from 'node:test'
import assert from 'node:assert/strict'
import { rmSync } from 'node:fs'
import { envDeDepotForge, instanceDeDepot, sousGitFeint } from '../guards/lib/depotGabarit.mjs'
import { commitsNommes, depotDe } from '../guards/lib/gitPorte.mjs'
import { gitDe, gitDeLArbreReel, lancerGit, lancesDeGit, resultatDeGit, resultatDeLArbreReel, sousCommande } from './gitDeBanc.mjs'
import { installer } from '../docs/lib/enregistreur-lectures.mjs'

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
  const avant = tableTotale(Object.keys(vars), (k) => process.env[k])
  Object.assign(process.env, vars)
  try {
    return fn()
  } finally {
    for (const [k, v] of Object.entries(avant)) { if (v === undefined) delete process.env[k]; else process.env[k] = v }
  }
}

for (const [nom, lancer] of [['execFileSync', lancerGit], ['spawnSync', resultatDeGit]]) {
  test(`env strictement hérité : ${nom} reste une requête Git attestée`, () => {
    dansUneInstance((racine) => {
      const mesure = installer({ racine, ignores: new Set() })
      try {
        lancer(['rev-parse', 'HEAD'], { cwd: racine, env: process.env })
        assert.deepEqual(mesure.rendu().incomplet, [])
        assert.equal(mesure.rendu().git.length, 1)
        assert.deepEqual(mesure.rendu().git[0].args, ['rev-parse', 'HEAD'])
      } finally { mesure.restaurer() }
    })
  })

  test(`env explicite conservé : ${nom} garde défaut forgé et copie personnalisée non rejouables`, () => {
    dansUneInstance((racine) => {
      const mesure = installer({ racine, ignores: new Set() })
      try {
        lancer(['rev-parse', 'HEAD'], { cwd: racine })
        assert.match(mesure.rendu().incomplet.join('\n'), /environnement.*non rejouable/)
        assert.deepEqual(mesure.rendu().git, [])
        lancer(['rev-parse', 'HEAD'], { cwd: racine, env: { ...process.env } })
        assert.deepEqual(mesure.rendu().git, [])
        assert.match(mesure.rendu().incomplet.join('\n'), /environnement.*non rejouable/)
      } finally { mesure.restaurer() }
    })
  })
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

test('`lancesDeGit` compte au PROCESSUS : le git d’un `depotDe` sans `spawn` injecté et celui du banc, rien après la sortie (#2294)', () => {
  dansUneInstance((racine) => {
    const vu = lancesDeGit(() => {
      const sha = commitsNommes(depotDe(racine, { env: envDeDepotForge() }), ['HEAD'])[0]
      return gitDe(racine, { net: true })('rev-parse', sha)
    })
    assert.match(vu.valeur, /^[0-9a-f]{40}$/)
    assert.deepEqual(vu.lances.map(sousCommande).filter((s) => s !== 'version' && s !== 'hash-object'), ['cat-file', 'rev-parse'])
    const compte = vu.lances.length
    gitDe(racine)('rev-parse', 'HEAD')
    assert.equal(vu.lances.length, compte, 'hors de `fn`, le compte est clos')
  })
})

test('`lancesDeGit` sous une git FEINTE LÈVE : la feinte répond sans processus, le compte ne mesurerait rien (#2294)', () => {
  sousGitFeint([], () => assert.throws(() => lancesDeGit(() => 0), /répond sans processus/))
})

test('`sousCommande` saute `-c <réglage>` et les `--options` qui la précèdent', () => {
  assert.equal(sousCommande(['-c', 'core.quotePath=false', '--no-pager', 'diff-tree', '-r', 'x']), 'diff-tree')
  assert.equal(sousCommande(['--version']), null)
})
