#!/usr/bin/env node
// TESTS LIÉS AU DIFF (#2327 A7) : `npm run test:lies` — `vitest related` sur les chemins que le commit
// en préparation APPORTE (`ceQuApporteLeCommit` : l'index contre HEAD, ou l'apport propre d'une fusion
// en cours), `--run --maxWorkers=1`, par le vitest de CET arbre
// (`resoudreOutilLocal`, `scripts/lancer-local.mjs`). À la main de la session : le pre-commit ne le
// joue pas, ces tests lisent le disque et leur coût n'est pas borné (A7).
// Les chemins partent par paquets sous le plafond d'argv de Windows (`paquetsDArgv`), un lancement par
// paquet ; le premier code non nul est rendu.
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { ceQuApporteLeCommit, depotDe, racineDe } from '../guards/lib/gitPorte.mjs'
import { paquetsDArgv } from '../guards/lib/porteSpawn.mjs'
import { binLocal, envIsole, resoudreOutilLocal } from '../lancer-local.mjs'
import { codeEnfant } from './partition.mjs'

/** Extensions dont vitest suit le graphe d'imports. */
const EXTS_LIEES = ['.ts', '.tsx', '.mts', '.mjs', '.json']

/**
 * Les arguments de vitest pour chaque paquet de chemins changés, `[]` s'il n'y a aucun chemin à
 * extension liée (aucun lancement). PURE.
 * @param {readonly string[]} chemins @returns {string[][]}
 */
export function lancementsDesLies(chemins) {
  const lies = chemins.map((c) => String(c).replace(/\\/g, '/')).filter((c) => EXTS_LIEES.some((e) => c.endsWith(e)))
  return paquetsDArgv(lies).map((paquet) => ['related', ...paquet, '--run', '--maxWorkers=1'])
}

if (import.meta.main) {
  const racine = resolve(racineDe(depotDe(process.cwd())) ?? process.cwd())
  const lancements = lancementsDesLies(ceQuApporteLeCommit(depotDe(racine)).chemins('ACMR'))
  if (!lancements.length) {
    console.log('[test:lies] aucun chemin stagé à extension liée : aucun lancement')
    process.exit(0)
  }
  const { entree, refus } = resoudreOutilLocal(racine, 'vitest', 'vitest')
  if (refus) {
    console.error(refus)
    process.exit(2)
  }
  let code = 0
  for (const args of lancements) {
    const r = spawnSync(process.execPath, [entree, ...args], { cwd: racine, env: envIsole(process.env, binLocal(racine)), stdio: 'inherit' })
    if (code === 0) code = codeEnfant(r.status, r.signal)
  }
  process.exit(code)
}
