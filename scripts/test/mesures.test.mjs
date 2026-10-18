import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mesuresDe } from './mesures.mjs'

const dossierDe = (t) => {
  const dossier = mkdtempSync(join(tmpdir(), 'mesures-'))
  t.after(() => rmSync(dossier, { recursive: true, force: true, maxRetries: 3, retryDelay: 25 }))
  return dossier
}
const objet = (v) => v

test('mémo absent : vide à la lecture, créé à l’écriture', (t) => {
  const dossier = dossierDe(t), mesures = mesuresDe(dossier)
  assert.deepEqual(mesures.lire('ABSENT', objet), {})
  mesures.ecrire('ABSENT', { a: 1 }, (anciens, entrees) => ({ ...anciens, ...entrees }))
  assert.deepEqual(JSON.parse(readFileSync(join(dossier, 'ABSENT'), 'utf8')), { a: 1 })
})

test('mémo corrompu ou illisible : levée nommée avec sa cause, jamais écrasé par la fusion', (t) => {
  const dossier = dossierDe(t), mesures = mesuresDe(dossier)
  writeFileSync(join(dossier, 'CORROMPU'), '{"a":')
  mkdirSync(join(dossier, 'ILLISIBLE'))
  for (const [nom, cause] of [['CORROMPU', (c) => c instanceof SyntaxError], ['ILLISIBLE', (c) => c?.code === 'EISDIR']]) {
    assert.throws(() => mesures.lire(nom, objet), (e) => {
      assert.match(e.message, new RegExp(`mémo .*${nom} illisible`))
      assert.ok(cause(e.cause), String(e.cause))
      return true
    })
  }
  assert.throws(() => mesures.ecrire('CORROMPU', { b: 2 }, (anciens, entrees) => ({ ...anciens, ...entrees })), /CORROMPU illisible/)
  assert.equal(readFileSync(join(dossier, 'CORROMPU'), 'utf8'), '{"a":')
})
