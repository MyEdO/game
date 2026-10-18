// Rendu sous win32 (#1801, DoD 1) : chaque dérivé de `GENERATORS` rend le MÊME corps sur l'hôte et
// sous win32. L'hôte de développement est Windows, la CI est Linux : un générateur qui bâtit un chemin
// RELATIF par l'API de `node:path` rend un corps qui dépend de la plateforme. La garde compare, par
// générateur, le rendu d'un processus de l'hôte (`renduSurLHote`) à celui d'un processus rendu sous
// win32 (`renduSousWin32`) : tous deux jouent `scripts/docs/lib/rendre-seul.mjs`, et
// `scripts/docs/lib/plateforme-win32.mjs` en `--import` est leur SEULE différence. Sur un hôte win32, le
// rendu natif EST le rendu sous win32 : les deux côtés seraient la même commande, la garde n'y rend rien
// et mord en CI Linux.
// Le lieu d'un module décide de ce qu'il voit : le dépôt voit win32, `node_modules` voit l'hôte
// (`estModuleDuDepot`, plateforme-win32-hooks.mjs).
// Les processus de rendu se mènent de front par `enFileBornee`, un par cœur (`coeurs`), lancés par
// `spawnBorne` (#2586).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { availableParallelism, tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { GENERATORS } from '../../docs/build-all.mjs'
import { enFileBornee } from '../../guards/lib/fileBornee.mjs'
import { spawnBorne } from '../../guards/lib/processusBorne.mjs'
import { ecartsDeRendu } from '../../test/lib/bancGenerateurs.mjs'
import { coeurs } from '../../test/partition.mjs'

const RACINE = fileURLToPath(new URL('../../../', import.meta.url))

/** Le module qui rend sous win32. */
const PLATEFORME_WIN32 = new URL('../../docs/lib/plateforme-win32.mjs', import.meta.url).href

const RENDRE_SEUL = fileURLToPath(new URL('../../docs/lib/rendre-seul.mjs', import.meta.url))

const TSX_ESM = pathToFileURL(fileURLToPath(import.meta.resolve('tsx/esm'))).href

const ECHEANCE_MS = 900_000

/** Rendu d'un générateur : tous les dérivés de `GENERATORS` tiennent sous cette capture. */
const CAPTURE_MAX = 256 * 1024 * 1024

/** Le rendu de `g` par un processus node que `imports` précharge, arrêté avec `signal` : cible → texte.
 *  La simulation se pose AVANT `tsx/esm`. */
async function renduEnProcessus(g, imports, dossier, signal) {
  const cote = imports.length ? 'sous win32' : 'sur l’hôte'
  const r = await spawnBorne({
    argv: [...imports, ...(g.runner === 'tsx' ? ['--import', TSX_ESM] : []), RENDRE_SEUL, g.script],
    fichier: join(dossier, `${g.script.replaceAll('/', '_')}.${imports.length ? 'win32' : 'hote'}.log`),
    limiteMs: ECHEANCE_MS, cwd: RACINE, env: { ...process.env, WFRP_PLATEFORME_RACINE: RACINE },
    signal, fluxDistincts: true, maxBuffer: CAPTURE_MAX, site: `plateforme-win32/${g.script} ${cote}`,
  })
  if (r.code !== 0) throw new Error(`${g.script} ${cote} : sortie ${r.code}${r.error ? ` (${r.error.code ?? ''} ${r.error.message})` : ''}\n${r.stderr}`)
  return new Map(JSON.parse(r.stdout))
}

const renduSurLHote = (g, dossier, signal) => renduEnProcessus(g, [], dossier, signal)
const renduSousWin32 = (g, dossier, signal) => renduEnProcessus(g, ['--import', PLATEFORME_WIN32], dossier, signal)

test('chaque générateur de `GENERATORS` rend le MÊME corps sur l’hôte et sous win32', {
  timeout: ECHEANCE_MS,
  skip: process.platform === 'win32' && 'hôte win32 : le rendu natif EST le rendu sous win32 — la garde mord en CI Linux',
}, async (t) => {
  const dossier = mkdtempSync(join(tmpdir(), 'plateforme-win32-rendus-'))
  t.after(() => rmSync(dossier, { recursive: true, force: true }))
  const taches = GENERATORS.flatMap((g) => [(s) => renduSurLHote(g, dossier, s), (s) => renduSousWin32(g, dossier, s)])
  const rendus = await enFileBornee(taches, { deFront: coeurs(process.env, availableParallelism), signal: t.signal })
  const ecarts = GENERATORS.flatMap((g, i) => ecartsDeRendu(g.script, rendus[2 * i], rendus[2 * i + 1]))
  assert.deepEqual(ecarts, [])
})
