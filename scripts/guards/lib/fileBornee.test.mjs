import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { enFileBornee } from './fileBornee.mjs'
import { spawnBorne } from './processusBorne.mjs'

/** Attente de `ms` arrêtée par `signal` ; à l'arrêt, la tâche rejette de SA propre erreur, comme un lancement annulé
 *  (`spawnBorne` rend `ABORT_ERR lancement annulé`), jamais de la raison du signal. */
const attendre = (ms, signal, i) => new Promise((resoudre, rejeter) => {
  const annulee = () => new Error(`tâche ${i} annulée`)
  if (signal.aborted) { rejeter(annulee()); return }
  const minuterie = setTimeout(resoudre, ms)
  signal.addEventListener('abort', () => { clearTimeout(minuterie); rejeter(annulee()) }, { once: true })
})

test('résultats dans l’ordre des tâches, `deFront` en cours au plus', { timeout: 10_000 }, async () => {
  let enCours = 0
  let pic = 0
  const taches = [30, 5, 20, 1, 10, 2].map((ms, i) => async (signal) => {
    pic = Math.max(pic, ++enCours)
    await attendre(ms, signal, i)
    enCours -= 1
    return i
  })
  assert.deepEqual(await enFileBornee(taches, { deFront: 2 }), [0, 1, 2, 3, 4, 5])
  assert.equal(pic, 2)
})

test('au premier rejet, plus aucune tâche ne se lance, celles en vol reçoivent l’arrêt et la file rejette de CE rejet après leur clôture', { timeout: 10_000 }, async () => {
  const lancees = []
  const closes = []
  const echec = new Error('tâche 1 en échec')
  const taches = Array.from({ length: 10 }, (_, i) => async (signal) => {
    lancees.push(i)
    try {
      if (i === 1) throw echec
      await attendre(15_000, signal, i)
    } finally { closes.push(i) }
  })
  const t0 = Date.now()
  await assert.rejects(enFileBornee(taches, { deFront: 2 }), (e) => e === echec)
  assert.deepEqual(lancees, [0, 1])
  assert.deepEqual(closes.toSorted(), [0, 1])
  assert.ok(Date.now() - t0 < 5_000)
})

test('l’abandon de l’appelant arrête la file et la fait rejeter de SA raison, pas de l’erreur que les tâches rendent à l’arrêt', { timeout: 10_000 }, async () => {
  const appelant = new AbortController()
  const raison = new Error('échéance de l’appelant')
  const lancees = []
  const taches = Array.from({ length: 6 }, (_, i) => async (signal) => {
    lancees.push(i)
    if (i === 0) appelant.abort(raison)
    await attendre(15_000, signal, i)
  })
  await assert.rejects(enFileBornee(taches, { deFront: 1, signal: appelant.signal }), (e) => e === raison)
  assert.deepEqual(lancees, [0])
})

test('appelant déjà abandonné : aucune tâche ne se lance, la file rejette de sa raison', async () => {
  const raison = new Error('abandon préalable')
  const lancees = []
  const taches = Array.from({ length: 3 }, (_, i) => async () => { lancees.push(i) })
  await assert.rejects(enFileBornee(taches, { deFront: 2, signal: AbortSignal.abort(raison) }), (e) => e === raison)
  assert.deepEqual(lancees, [])
})

test('une tâche qui ignore son signal tient la file jusqu’à sa propre fin', { timeout: 10_000 }, async () => {
  let close = false
  const taches = [
    async () => { await new Promise((r) => setTimeout(r, 300)); close = true },
    async () => { throw new Error('tâche 1 en échec') },
  ]
  const t0 = Date.now()
  await assert.rejects(enFileBornee(taches, { deFront: 2 }), /tâche 1 en échec/)
  assert.equal(close, true)
  assert.ok(Date.now() - t0 >= 250, `${Date.now() - t0} ms`)
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
