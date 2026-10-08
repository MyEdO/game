// `canoniser` d'un chemin ABSENT du disque : l'ancêtre EXISTANT le plus proche est canonisé (jonction
// suivie), le reste recollé tel quel (#1973). Fixtures sous `os.tmpdir()`, `rmSync` en finally.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ancetreExistant, canoniser } from './chemin-mesure.mjs'

test('canonisation stricte : absence normale, ancêtre et cible physique illisibles', () => {
  const base = mkdtempSync(join(tmpdir(), 'wfrp-canon-strict-'))
  const stat = fs.statSync
  const realpath = fs.realpathSync.native
  try {
    assert.equal(canoniser(join(base, 'absent/x'), { strict: true }), join(realpath(base), 'absent/x'))
    for (const code of ['EACCES', 'EPERM']) {
      fs.statSync = () => { throw Object.assign(new Error('banc'), { code }) }
      assert.throws(() => ancetreExistant(base, { strict: true }), new RegExp(`ancêtre illisible.*${code}`))
      fs.statSync = stat
      fs.realpathSync.native = () => { throw Object.assign(new Error('banc'), { code }) }
      assert.throws(() => canoniser(base, { strict: true }), new RegExp(`canonisation physique illisible.*${code}`))
      assert.equal(canoniser(base), base)
      fs.realpathSync.native = realpath
    }
    fs.realpathSync.native = (chemin) => {
      if (chemin === base) throw Object.assign(new Error('disparu'), { code: 'ENOENT' })
      return realpath(chemin)
    }
    assert.equal(canoniser(base, { strict: true }), join(realpath(join(base, '..')), base.split(/[\\/]/).at(-1)))
  } finally {
    fs.statSync = stat
    fs.realpathSync.native = realpath
    rmSync(base, { recursive: true, force: true })
  }
})

test('canoniser : un chemin absent SOUS une jonction rend la cible réelle + le reste', () => {
  const base = mkdtempSync(join(tmpdir(), 'wfrp-canon-'))
  try {
    const cible = join(base, 'cible')
    mkdirSync(cible)
    const jonction = join(base, 'lien')
    symlinkSync(cible, jonction, 'junction')
    assert.equal(canoniser(join(jonction, 'absent', 'x.md')), join(realpathSync.native(cible), 'absent', 'x.md'))
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('ancetreExistant : le chemin lui-même s’il existe, son ancêtre sinon', () => {
  const base = mkdtempSync(join(tmpdir(), 'wfrp-canon-'))
  try {
    assert.equal(ancetreExistant(base), base)
    assert.equal(ancetreExistant(join(base, 'a', 'b.md')), base)
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})
