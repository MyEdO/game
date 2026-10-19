// Contrat de l'identité de création mesurée (#2603).
import test from 'node:test'
import assert from 'node:assert/strict'
import { BORNE_DE_MESURE_MS, creationMesuree } from './identiteMesuree.mjs'
import { toleranceDeMesure } from '../guards/lib/processusWorktrees.mjs'
import { MESURE_WINDOWS, jouerSousSuspendeur } from './suspendeurDeMesure.mjs'

test('#2603 — creationMesuree : la création RÉELLE du processus courant, à `performance.timeOrigin` près', () => {
  const creation = creationMesuree(process.pid)
  assert.equal(typeof creation, 'number')
  assert.ok(Math.abs(creation - performance.timeOrigin) <= toleranceDeMesure() + 1_000, `écart ${creation - performance.timeOrigin} ms`)
})

test('#2603 — creationMesuree : processus absent = `null`, rendu avant l’échéance de la mesure', () => {
  // 2^31 - 1 : au-delà du `pid_max` Linux (2^22, proc(5)), et non multiple de 4 comme tout PID Windows.
  const debut = Date.now()
  const creation = creationMesuree(2 ** 31 - 1)
  const ms = Date.now() - debut
  assert.equal(creation, null)
  assert.ok(ms < BORNE_DE_MESURE_MS, `rendu en ${ms} ms : l’échéance de ${BORNE_DE_MESURE_MS} ms, non l’absence`)
})

test('#2603 — creationMesuree : mesure qui lève = `null`', MESURE_WINDOWS, (t) => {
  const systemRoot = process.env.SystemRoot
  t.after(() => { process.env.SystemRoot = systemRoot })
  delete process.env.SystemRoot
  assert.equal(creationMesuree(process.pid), null)
})

test('#2603 — creationMesuree : mesure échue à sa borne = `null`', MESURE_WINDOWS, async (t) => {
  const module = JSON.stringify(new URL('./identiteMesuree.mjs', import.meta.url).href)
  const vu = await jouerSousSuspendeur(t, `const { creationMesuree } = await import(${module})
const debut = Date.now()
console.log(JSON.stringify({ creation: creationMesuree(process.pid), ms: Date.now() - debut }))`, { max: 1 })
  assert.equal(vu.status, 0, vu.sortie)
  const { creation, ms } = JSON.parse(vu.sortie)
  assert.equal(creation, null, vu.sortie)
  assert.ok(ms >= BORNE_DE_MESURE_MS && ms < 3 * BORNE_DE_MESURE_MS, `mesure rendue en ${ms} ms, borne ${BORNE_DE_MESURE_MS} ms`)
  assert.deepEqual(vu.suspendeur, { status: 0, erreurs: '' })
  assert.equal(vu.suspendus.length, 1, `mesureurs suspendus : ${vu.suspendus}`)
})
