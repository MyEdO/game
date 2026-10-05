// Banc de CONCURRENCE réelle du verrou `prendreVerrou` (#2279 N0) : des processus distincts se
// disputent le même verrou et, verrou tenu, font une lecture-modification-écriture d'un compteur. Une
// exclusion qui fuit perd des incréments.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const MODULE = pathToFileURL(path.join(import.meta.dirname, 'verrou.mjs')).href
const PROCESSUS = 8
const PRISES = 10

/** Un preneur : `PRISES` sections critiques sous le verrou, au plus `essais` tentatives ; rend ses prises. */
const preneur = (dossier) => `
const { prendreVerrou } = await import(${JSON.stringify(MODULE)})
const fs = await import('node:fs')
const chemin = ${JSON.stringify(path.join(dossier, 'compteur.verrou'))}
const compteur = ${JSON.stringify(path.join(dossier, 'compteur'))}
const pause = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
let prises = 0
for (let essai = 0; essai < 20000 && prises < ${PRISES}; essai += 1) {
  const verrou = prendreVerrou({ chemin, env: {} })
  if (verrou.etat !== 'pris') { pause(1); continue }
  const lu = Number(fs.readFileSync(compteur, 'utf8'))
  pause(1)
  fs.writeFileSync(compteur, String(lu + 1))
  verrou.liberer()
  prises += 1
}
process.stdout.write(String(prises))
`

test(`#2279 N0 — ${PROCESSUS} processus se disputent le verrou : aucune section critique ne se chevauche, aucun incrément perdu`, async () => {
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'verrou-conc-'))
  try {
    fs.writeFileSync(path.join(dossier, 'compteur'), '0')
    const prises = await Promise.all(Array.from({ length: PROCESSUS }, () => new Promise((fini) => {
      const enfant = spawn(process.execPath, ['--input-type=module', '-e', preneur(dossier)], { stdio: ['ignore', 'pipe', 'inherit'] })
      const borne = setTimeout(() => enfant.kill(), 120000)
      let sortie = ''
      enfant.stdout.on('data', (d) => { sortie += d })
      enfant.on('close', () => { clearTimeout(borne); fini(Number(sortie)) })
    })))
    assert.deepEqual(prises, Array(PROCESSUS).fill(PRISES), 'chaque preneur a fini ses prises')
    assert.equal(fs.readFileSync(path.join(dossier, 'compteur'), 'utf8'), String(PROCESSUS * PRISES), 'incréments perdus')
    assert.deepEqual(fs.readdirSync(dossier), ['compteur'], 'ni verrou, ni temporaire, ni verrou de reprise restant')
  } finally {
    fs.rmSync(dossier, { recursive: true, force: true })
  }
})
