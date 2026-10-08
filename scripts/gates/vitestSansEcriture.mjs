import { afterAll, expect } from 'vitest'
import { appendFileSync } from 'node:fs'
import { relative } from 'node:path'
import { RACINES_DE_LA_SUITE } from '../guards/lib/racinesDeLaSuite.mjs'
import { tableTotale } from '../../src/lib/tableTotale.ts'

const EN_COURS = Symbol.for('wfrp.tests.vitest.controle')
const CLEFS = ['NODE_OPTIONS', 'WFRP_TESTS_RACINE', 'WFRP_TESTS_REFUS', 'PYTHONDONTWRITEBYTECODE']

// La collecte peut échouer avant afterAll : le prochain setup ou la sortie du worker clôt le contrôle.
globalThis[EN_COURS]?.()

export async function protegerSuiteVitest(racine = process.cwd()) {
  globalThis[EN_COURS]?.()
  const chemin = expect.getState().testPath
  if (!chemin) throw new Error('garde Vitest : testPath absent avant la collecte')
  const rel = relative(racine, chemin).replaceAll('\\', '/')
  if (!RACINES_DE_LA_SUITE.some(({ dir, exts }) => dir.startsWith('scripts/') && rel.startsWith(`${dir}/`) && exts.some((e) => rel.endsWith(e)))) return
  const [{ ouvrirControleEcritures }, { installer }] = await Promise.all([
    import('../guards/lib/controleEcritures.mjs'), import('../guards/lib/intercepterEcritures.mjs'),
  ])
  const controle = ouvrirControleEcritures(racine)
  const avant = tableTotale(CLEFS, (c) => process.env[c])
  for (const c of CLEFS) process.env[c] = controle.env[c]
  const refus = []
  const restaurer = installer({ racine, signaler(message) {
    refus.push(message)
    appendFileSync(`${controle.env.WFRP_TESTS_REFUS}.${process.pid}.jsonl`, JSON.stringify(message) + '\n')
  } })
  let ferme = false
  const terminer = () => {
    if (ferme) return
    ferme = true
    restaurer()
    for (const c of CLEFS) if (avant[c] === undefined) delete process.env[c]; else process.env[c] = avant[c]
    delete globalThis[EN_COURS]
    process.removeListener('exit', sortie)
    const anomalies = controle.fermer()
    if (anomalies.length || refus.length) throw new Error([...new Set([...refus, ...anomalies])].join('\n'))
  }
  const sortie = () => { try { terminer() } catch (e) { console.error(e.message); process.exitCode = 1 } }
  globalThis[EN_COURS] = terminer
  process.once('exit', sortie)
  afterAll(terminer)
}

await protegerSuiteVitest()
