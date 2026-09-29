// Un lancement de Chrome raté dit POURQUOI (#1883) : la CI n'a qu'un log, et « CDP indisponible »
// sans le stderr de Chrome n'y établit aucune cause. Le « Chrome » lancé ici est Node lui-même, qui
// refuse `--headless=new` sur stderr et sort aussitôt : un vrai process, sans navigateur.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { delaiCdpParDefaut, launchSession } from './lib.mjs'

test('launchSession : un Chrome qui meurt au lancement rejette AUSSITÔT, avec sa sortie et la fin de son stderr', async () => {
  const depart = Date.now()
  await assert.rejects(
    () => launchSession({ chromePath: process.execPath, timeoutMs: 20000 }),
    (e) => {
      assert.match(e.message, /Chrome s'est arrêté avant d'ouvrir le CDP \(code \d+/)
      assert.match(e.message, /fin du stderr de Chrome/)
      assert.match(e.message, /--headless=new/)
      return true
    },
  )
  assert.ok(Date.now() - depart < 20000, 'le délai CDP ne s’attend pas quand Chrome est déjà mort')
})

test('launchSession : un exécutable introuvable rejette avec la cause du lancement', async () => {
  await assert.rejects(
    () => launchSession({ chromePath: 'chrome-introuvable-1883', timeoutMs: 20000 }),
    /lancement impossible : spawn chrome-introuvable-1883 ENOENT/,
  )
})

test('delaiCdpParDefaut : 30 s sous CI, 10 s en local', () => {
  assert.equal(delaiCdpParDefaut({ CI: 'true' }), 30000)
  assert.equal(delaiCdpParDefaut({}), 10000)
})
