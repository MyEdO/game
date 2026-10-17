// node --test scripts/guards/lib/renommageResilient.test.mjs
// Le renommage résilient (#2493) : un refus du système rejoué sous `BACKOFFS_MS`, tout autre refus levé aussitôt.
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BACKOFFS_MS } from './spawnResilient.mjs'
import { RENOMMAGE_REFUSE, renommerResilient } from './renommageResilient.mjs'

const dossier = mkdtempSync(join(tmpdir(), 'renommage-'))
after(() => rmSync(dossier, { recursive: true, force: true }))

test('cible tenue (un dossier à sa place) : le refus du système est rejoué au palier suivant, puis le renommage aboutit', () => {
  const source = join(dossier, 'du.json.1.tmp')
  const cible = join(dossier, 'du.json')
  writeFileSync(source, '{"echec":3}\n')
  mkdirSync(cible)
  writeFileSync(join(cible, 'tenu'), 'x')
  const attentes = []
  const liberer = (ms) => {
    attentes.push(ms)
    rmSync(cible, { recursive: true, force: true })
  }
  if (process.platform === 'win32') {
    const refus = renommerResilient(source, cible, { attendre: liberer })
    assert.equal(refus.length, 1)
    assert.ok(RENOMMAGE_REFUSE.has(refus[0]), refus[0])
    assert.deepEqual(attentes, [BACKOFFS_MS[0]])
    assert.equal(readFileSync(cible, 'utf8'), '{"echec":3}\n')
    assert.equal(existsSync(source), false)
  } else {
    assert.throws(() => renommerResilient(source, cible, { attendre: liberer }), (e) => !RENOMMAGE_REFUSE.has(/** @type {any} */ (e).code))
    assert.deepEqual(attentes, [])
  }
})

test('refus du système à chaque palier : levé après les paliers de `BACKOFFS_MS`, jamais sans fin', { skip: process.platform !== 'win32' && 'refus EPERM d’un dossier cible propre à win32' }, () => {
  const source = join(dossier, 'b.tmp')
  const cible = join(dossier, 'b')
  writeFileSync(source, 'b')
  mkdirSync(cible)
  writeFileSync(join(cible, 'tenu'), 'x')
  const attentes = []
  assert.throws(() => renommerResilient(source, cible, { attendre: (ms) => attentes.push(ms) }), (e) => RENOMMAGE_REFUSE.has(/** @type {any} */ (e).code))
  assert.deepEqual(attentes, BACKOFFS_MS)
})

test('source absente : ENOENT levé aussitôt, sans attente', () => {
  const attentes = []
  assert.throws(() => renommerResilient(join(dossier, 'absente'), join(dossier, 'c'), { attendre: (ms) => attentes.push(ms) }), { code: 'ENOENT' })
  assert.deepEqual(attentes, [])
})
