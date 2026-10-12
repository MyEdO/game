import { test } from 'node:test'

import assert from 'node:assert/strict'

import { spawn } from 'node:child_process'

import { fileURLToPath, pathToFileURL } from 'node:url'

import { GENERATORS, renduDe } from '../../docs/build-all.mjs'

import { bancplateformewin32testmjs } from '../../docs/lib/bancGenerateurs.mjs'
const { ecartsDeRendu } = bancplateformewin32testmjs

const RACINE = fileURLToPath(new URL('../../../', import.meta.url))

const HOTE = process.platform

const PLATEFORME_WIN32 = new URL('../../docs/lib/plateforme-win32.mjs', import.meta.url).href

const IMPORT_WIN32 = HOTE === 'win32' ? [] : ['--import', PLATEFORME_WIN32]

const RENDRE_SEUL = fileURLToPath(new URL('../../docs/lib/rendre-seul.mjs', import.meta.url))

const TSX_ESM = pathToFileURL(fileURLToPath(import.meta.resolve('tsx/esm'))).href

function renduSousWin32(g) {
  const args = [...IMPORT_WIN32, ...(g.runner === 'tsx' ? ['--import', TSX_ESM] : []), RENDRE_SEUL, g.script]
  return new Promise((resoudre, rejeter) => {
    const enfant = spawn(process.execPath, args, { cwd: RACINE, env: { ...process.env, WFRP_PLATEFORME_RACINE: RACINE } })
    const sortie = []
    const erreur = []
    enfant.stdout.on('data', (d) => sortie.push(d))
    enfant.stderr.on('data', (d) => erreur.push(d))
    enfant.on('error', rejeter)
    enfant.on('close', (code) => {
      if (code !== 0) rejeter(new Error(`${g.script} sous win32 : sortie ${code}\n${Buffer.concat(erreur)}`))
      else resoudre(new Map(JSON.parse(Buffer.concat(sortie).toString('utf8'))))
    })
  })
}

test('chaque générateur de `GENERATORS` rend le MÊME corps sur l’hôte et sous win32', { timeout: 900_000 }, async (t) => {
  if (HOTE === 'win32') t.diagnostic('hôte win32 : le rendu natif EST le rendu sous win32 — la garde mord en CI Linux')
  const ecarts = []
  for (const g of GENERATORS) {
    const sousWin32 = renduSousWin32(g)
    const hote = await renduDe(g)
    ecarts.push(...ecartsDeRendu(g.script, hote, await sousWin32))
  }
  assert.deepEqual(ecarts, [])
})
