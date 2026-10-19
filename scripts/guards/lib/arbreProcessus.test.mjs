import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mesurerArbreProcessus, ancetresValidesDe } from './arbreProcessus.mjs'
import { MESURE_WINDOWS, jouerSousSuspendeur } from '../../test/suspendeurDeMesure.mjs'

const MODULE = JSON.stringify(new URL('./arbreProcessus.mjs', import.meta.url).href)

test('#2741 mesure lente : seule une première expiration autorise une seconde mesure, qui rend la vue', MESURE_WINDOWS, async (t) => {
  const vu = await jouerSousSuspendeur(t, `const { mesurerArbreProcessus } = await import(${MODULE})
console.log(JSON.stringify(mesurerArbreProcessus().some((p) => p.pid === process.pid)))`, { max: 1 })
  assert.deepEqual([vu.status, vu.sortie.trim()], [0, 'true'], vu.sortie)
  assert.deepEqual(vu.suspendeur, { status: 0, erreurs: '' })
  assert.equal(vu.suspendus.length, 1, `mesureurs suspendus : ${vu.suspendus}`)
})

test('#2741 échéance répétée : refus transitoire codé après deux mesures bornées, aucune vue expirée exploitée', MESURE_WINDOWS, async (t) => {
  const vu = await jouerSousSuspendeur(t, `const { mesurerArbreProcessus } = await import(${MODULE})
try { console.log(JSON.stringify({ vue: mesurerArbreProcessus() })) }
catch (e) { console.log(JSON.stringify({ code: e.code, categorie: e.categorie, message: e.message })) }`)
  assert.equal(vu.status, 0, vu.sortie)
  const refus = JSON.parse(vu.sortie)
  assert.deepEqual([refus.code, refus.categorie], ['MESURE_PROCESSUS_EXPIREE', 'transitoire'], vu.sortie)
  assert.match(refus.message, /^\[transitoire · retentable\] mesure des processus indéterminée : échéance de 5000 ms atteinte$/)
  assert.deepEqual(vu.suspendeur, { status: 0, erreurs: '' })
  assert.equal(vu.suspendus.length, 2, `mesureurs suspendus : ${vu.suspendus}`)
})

test('#2741 mesure qui lève : refus de panne, code et cause de la mesure conservés', MESURE_WINDOWS, (t) => {
  const systemRoot = process.env.SystemRoot
  t.after(() => { process.env.SystemRoot = systemRoot })
  delete process.env.SystemRoot
  assert.throws(() => mesurerArbreProcessus(), (e) => {
    assert.deepEqual([e.code, e.categorie, e.cause.code], ['MESURE_PROCESSUS_IMPOSSIBLE', 'panne', undefined])
    assert.equal(e.message, '[panne · non retentable] ' + e.cause.message)
    assert.match(e.message, /SystemRoot absent/)
    return true
  })
  const vide = mkdtempSync(join(tmpdir(), '2741-systemroot-'))
  t.after(() => rmSync(vide, { recursive: true, force: true }))
  process.env.SystemRoot = vide
  assert.throws(() => mesurerArbreProcessus(), (e) => {
    assert.deepEqual([e.code, e.categorie, e.cause.code], ['ENOENT', 'panne', 'ENOENT'])
    assert.equal(e.message, '[panne · non retentable] ' + e.cause.message)
    return true
  })
})

test('#2741 ancêtres : cycle et PID recyclé rompent la filiation', () => {
  const a = { pid: 1, ppid: 2, creation: '2026-10-18T00:00:00Z' }
  const b = { pid: 2, ppid: 1, creation: a.creation }
  assert.deepEqual(ancetresValidesDe(1, [a, b]), [b])
  assert.deepEqual(ancetresValidesDe(1, [a, { ...b, creation: '2026-10-18T00:00:01Z' }]), [])
})
