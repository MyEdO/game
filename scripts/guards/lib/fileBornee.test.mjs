import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { enFileBornee } from './fileBornee.mjs'
import { spawnBorne } from './processusBorne.mjs'

const attendre = (ms, signal) => new Promise((resoudre, rejeter) => {
  if (signal.aborted) { rejeter(signal.reason); return }
  const minuterie = setTimeout(resoudre, ms)
  signal.addEventListener('abort', () => { clearTimeout(minuterie); rejeter(signal.reason) }, { once: true })
})

test('résultats dans l’ordre des tâches, `deFront` en cours au plus', { timeout: 10_000 }, async () => {
  let enCours = 0
  let pic = 0
  const taches = [30, 5, 20, 1, 10, 2].map((ms, i) => async (signal) => {
    pic = Math.max(pic, ++enCours)
    await attendre(ms, signal)
    enCours -= 1
    return i
  })
  assert.deepEqual(await enFileBornee(taches, { deFront: 2 }), [0, 1, 2, 3, 4, 5])
  assert.equal(pic, 2)
})

test('au premier rejet, plus aucune tâche ne se lance, celles en vol reçoivent l’arrêt et la file rejette après leur clôture', { timeout: 10_000 }, async () => {
  const lancees = []
  const closes = []
  const taches = Array.from({ length: 10 }, (_, i) => async (signal) => {
    lancees.push(i)
    try {
      if (i === 1) throw new Error('tâche 1 en échec')
      await attendre(15_000, signal)
    } finally { closes.push(i) }
  })
  const t0 = Date.now()
  await assert.rejects(enFileBornee(taches, { deFront: 2 }), /tâche 1 en échec/)
  assert.deepEqual(lancees, [0, 1])
  assert.deepEqual(closes.toSorted(), [0, 1])
  assert.ok(Date.now() - t0 < 5_000)
})

test('l’abandon du signal de l’appelant arrête la file et la fait rejeter de sa cause', { timeout: 10_000 }, async () => {
  const appelant = new AbortController()
  const lancees = []
  const taches = Array.from({ length: 6 }, (_, i) => async (signal) => {
    lancees.push(i)
    if (i === 0) appelant.abort(new Error('échéance de l’appelant'))
    await attendre(15_000, signal)
  })
  await assert.rejects(enFileBornee(taches, { deFront: 1, signal: appelant.signal }), /échéance de l’appelant/)
  assert.deepEqual(lancees, [0])
})

test('`deFront` hors des entiers positifs : refus nommé', async () => {
  await assert.rejects(enFileBornee([], { deFront: 0 }), { code: 'BORNE_INVALIDE' })
})

test('lancements `spawnBorne` : au rejet, l’arbre en vol est ARRÊTÉ (`mort`) et rien ne se lance après', { timeout: 30_000 }, async (t) => {
  const dossier = mkdtempSync(join(tmpdir(), 'file-bornee-'))
  t.after(() => rmSync(dossier, { recursive: true, force: true }))
  const lancees = []
  const resultats = []
  const taches = Array.from({ length: 10 }, (_, i) => async (signal) => {
    lancees.push(i)
    const r = await spawnBorne({ argv: ['-e', i === 1 ? 'process.exit(1)' : 'setTimeout(() => {}, 15000)'],
      fichier: join(dossier, `${i}.log`), limiteMs: 30_000, signal })
    resultats.push({ i, annulee: r.annulee, arret: r.arret.etat })
    if (r.code !== 0) throw new Error(`tâche ${i} sortie ${r.code}`)
  })
  const t0 = Date.now()
  await assert.rejects(enFileBornee(taches, { deFront: 2 }), /tâche 1 sortie 1/)
  assert.deepEqual(lancees, [0, 1])
  assert.deepEqual(resultats.toSorted((a, b) => a.i - b.i), [{ i: 0, annulee: true, arret: 'mort' }, { i: 1, annulee: false, arret: 'mort' }])
  assert.ok(Date.now() - t0 < 15_000, `${Date.now() - t0} ms`)
})
