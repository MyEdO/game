// Contrat de l'identité de création mesurée (#2603).
import test from 'node:test'
import assert from 'node:assert/strict'
import { creationMesuree } from './identiteMesuree.mjs'
import { toleranceDeMesure } from '../guards/lib/processusWorktrees.mjs'

test('#2603 — creationMesuree : la création RÉELLE du processus courant, à `performance.timeOrigin` près', () => {
  const creation = creationMesuree(process.pid)
  assert.equal(typeof creation, 'number')
  assert.ok(Math.abs(creation - performance.timeOrigin) <= toleranceDeMesure() + 1_000, `écart ${creation - performance.timeOrigin} ms`)
})

test('#2603 — creationMesuree : mesure indéterminée, en erreur, ou processus absent = `null`', () => {
  const vue = (processus, extra = {}) => () => ({ processus, ...extra })
  assert.equal(creationMesuree(7, { mesurer: vue([{ pid: 7, creation: '2026-01-01T00:00:00.000Z' }], { indeterminee: 'échéance' }) }), null)
  assert.equal(creationMesuree(7, { mesurer: () => { throw new Error('ps absent') } }), null)
  assert.equal(creationMesuree(7, { mesurer: vue([{ pid: 8, creation: '2026-01-01T00:00:00.000Z' }]) }), null)
  assert.equal(creationMesuree(7, { mesurer: vue([{ pid: 7, creation: null }]) }), null)
  assert.equal(creationMesuree(7, { mesurer: vue([{ pid: 7, creation: '2026-01-01T00:00:00.000Z' }]) }), Date.parse('2026-01-01T00:00:00.000Z'))
  let options
  creationMesuree(7, { mesurer: (o) => { options = o; return { processus: [] } } })
  assert.deepEqual(options, { pids: [7], timeout: 10_000 })
})
