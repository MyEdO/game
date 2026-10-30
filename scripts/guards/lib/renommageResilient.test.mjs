// node --test scripts/guards/lib/renommageResilient.test.mjs
// Le renommage résilient (#2493, #3138) : un refus du système rejoué sous ses paliers, tout autre refus levé aussitôt.
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BUDGET_RENOMMAGE_MS, PALIERS_RENOMMAGE_MS, PREMIER_PALIER_RENOMMAGE_MS, FICHIER_TENU, renommerResilient } from './renommageResilient.mjs'

const dossier = mkdtempSync(join(tmpdir(), 'renommage-'))
after(() => rmSync(dossier, { recursive: true, force: true }))

const somme = (ms) => ms.reduce((s, x) => s + x, 0)

/** Une `cible` que Windows refuse de remplacer : un dossier non vide à sa place. */
function cibleTenue(nom) {
  const source = join(dossier, `${nom}.tmp`)
  const cible = join(dossier, nom)
  writeFileSync(source, nom)
  mkdirSync(cible)
  writeFileSync(join(cible, 'tenu'), 'x')
  return { source, cible }
}

test('#3138 — un renommage refusé se rejoue d’abord au premier palier, sous un total borné par son budget', () => {
  assert.equal(PALIERS_RENOMMAGE_MS[0], PREMIER_PALIER_RENOMMAGE_MS)
  assert.equal(somme(PALIERS_RENOMMAGE_MS), BUDGET_RENOMMAGE_MS)
})

test('cible tenue (un dossier à sa place) : le refus du système est rejoué au premier palier, puis le renommage aboutit', () => {
  const { source, cible } = cibleTenue('du.json')
  const attentes = []
  const liberer = (ms) => {
    attentes.push(ms)
    rmSync(cible, { recursive: true, force: true })
  }
  if (process.platform === 'win32') {
    const refus = renommerResilient(source, cible, { attendre: liberer })
    assert.equal(refus.length, 1)
    assert.ok(FICHIER_TENU.has(refus[0]), refus[0])
    assert.deepEqual(attentes, [PALIERS_RENOMMAGE_MS[0]])
    assert.equal(readFileSync(cible, 'utf8'), 'du.json')
    assert.equal(existsSync(source), false)
  } else {
    assert.throws(() => renommerResilient(source, cible, { attendre: liberer }), (e) => !FICHIER_TENU.has(/** @type {any} */ (e).code))
    assert.deepEqual(attentes, [])
  }
})

test('refus du système à chaque palier : levé après les paliers, jamais sans fin', { skip: process.platform !== 'win32' && 'refus EPERM d’un dossier cible propre à win32' }, () => {
  const { source, cible } = cibleTenue('b')
  const attentes = []
  assert.throws(() => renommerResilient(source, cible, { attendre: (ms) => attentes.push(ms) }), (e) => FICHIER_TENU.has(/** @type {any} */ (e).code))
  assert.deepEqual(attentes, PALIERS_RENOMMAGE_MS)
})

test('#3138 — paliers `[]` : le premier refus du système est levé, sans attente', { skip: process.platform !== 'win32' && 'refus EPERM d’un dossier cible propre à win32' }, () => {
  const { source, cible } = cibleTenue('sans-palier')
  const attentes = []
  assert.throws(() => renommerResilient(source, cible, { attendre: (ms) => attentes.push(ms), paliers: [] }), (e) => FICHIER_TENU.has(/** @type {any} */ (e).code))
  assert.deepEqual(attentes, [])
  assert.equal(readFileSync(source, 'utf8'), 'sans-palier')
})

test('source absente : ENOENT levé aussitôt, sans attente', () => {
  const attentes = []
  assert.throws(() => renommerResilient(join(dossier, 'absente'), join(dossier, 'c'), { attendre: (ms) => attentes.push(ms) }), { code: 'ENOENT' })
  assert.deepEqual(attentes, [])
})
