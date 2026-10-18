// Rendu sous win32 (#1801, DoD 1) : chaque dérivé de `GENERATORS` rend le MÊME corps sur l'hôte et
// sous win32. L'hôte de développement est Windows, la CI est Linux : un générateur qui bâtit un chemin
// RELATIF par l'API de `node:path` rend un corps qui dépend de la plateforme. La garde compare, par
// générateur, son `rendre()` sur l'hôte (`renduDe`) à celui d'un processus rendu sous win32
// (`scripts/docs/lib/plateforme-win32.mjs` en `--import`, puis `scripts/docs/lib/rendre-seul.mjs`). Sur un hôte win32, le rendu natif EST le rendu sous
// win32 : la simulation n'y est pas chargée, la garde mord en CI Linux. Le lieu d'un module décide de
// ce qu'il voit : le dépôt voit win32, `node_modules` voit l'hôte (`estModuleDuDepot`,
// plateforme-win32-hooks.mjs).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { GENERATORS, renduDe } from '../../docs/build-all.mjs'
import { ecartsDeRendu } from '../../test/lib/bancGenerateurs.mjs'

const RACINE = fileURLToPath(new URL('../../../', import.meta.url))

const HOTE = process.platform

/** Le module qui rend sous win32 : l'hôte win32 se rend sans lui. */
const PLATEFORME_WIN32 = new URL('../../docs/lib/plateforme-win32.mjs', import.meta.url).href

const IMPORT_WIN32 = HOTE === 'win32' ? [] : ['--import', PLATEFORME_WIN32]

const RENDRE_SEUL = fileURLToPath(new URL('../../docs/lib/rendre-seul.mjs', import.meta.url))

const TSX_ESM = pathToFileURL(fileURLToPath(import.meta.resolve('tsx/esm'))).href

/** Le rendu de `g` par un processus rendu sous win32 : cible → texte. La simulation se pose AVANT
 *  `tsx/esm`. */
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
