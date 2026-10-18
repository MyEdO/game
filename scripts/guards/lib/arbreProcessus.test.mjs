import test from 'node:test'
import assert from 'node:assert/strict'
import { mesurerArbreProcessus, ancetresValidesDe } from './arbreProcessus.mjs'

const expiree = { processus: [], erreurs: ['échéance de 5000 ms atteinte'], indeterminee: 'échéance de 5000 ms atteinte', code: 'MESURE_PROCESSUS_EXPIREE' }

test('#2741 mesure lente : seule une première expiration autorise une seconde mesure bornée', () => {
  const appels = []
  const processus = [{ pid: 1, creation: '2026-10-18T00:00:00Z' }]
  assert.deepEqual(mesurerArbreProcessus({ mesurer: (options) => { appels.push(options); return appels.length === 1 ? expiree : { processus, erreurs: [] } } }), processus)
  assert.deepEqual(appels, [{ identites: true, timeout: 5000 }, { identites: true, timeout: 5000 }])
})

test('#2741 échéance répétée : refus transitoire codé, aucune vue expirée exploitée', () => {
  let appels = 0
  assert.throws(() => mesurerArbreProcessus({ mesurer: () => { appels++; return { ...expiree, processus: [{ pid: 999 }] } } }), (e) => {
    assert.equal(e.code, 'MESURE_PROCESSUS_EXPIREE')
    assert.equal(e.categorie, 'transitoire')
    assert.match(e.message, /^\[transitoire · retentable\].*5000 ms/)
    return true
  })
  assert.equal(appels, 2)
})

test('#2741 panne permanente : aucun nouvel appel', () => {
  let appels = 0
  assert.throws(() => mesurerArbreProcessus({ mesurer: () => { appels++; return { processus: [], erreurs: ['lecteur absent'] } } }), (e) => {
    assert.equal(e.categorie, 'panne')
    assert.match(e.message, /^\[panne · non retentable\].*lecteur absent/)
    return true
  })
  assert.equal(appels, 1)
  const cause = Object.assign(new Error('collecteur cassé'), { code: 'EIO' })
  assert.throws(() => mesurerArbreProcessus({ mesurer: () => { throw cause } }), (e) => e.categorie === 'panne' && e.code === 'EIO' && e.cause === cause)
})

test('#2741 ancêtres : cycle et PID recyclé rompent la filiation', () => {
  const a = { pid: 1, ppid: 2, creation: '2026-10-18T00:00:00Z' }
  const b = { pid: 2, ppid: 1, creation: a.creation }
  assert.deepEqual(ancetresValidesDe(1, [a, b]), [b])
  assert.deepEqual(ancetresValidesDe(1, [a, { ...b, creation: '2026-10-18T00:00:01Z' }]), [])
})
