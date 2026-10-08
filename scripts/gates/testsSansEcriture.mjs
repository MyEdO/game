#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ouvrirControleEcritures } from '../guards/lib/controleEcritures.mjs'

const RACINE = fileURLToPath(new URL('../../', import.meta.url))

export function lancerSansEcriture({ racine = RACINE, args, spawn = spawnSync, journal = console.error, env = process.env }) {
  let controle
  try {
    controle = ouvrirControleEcritures(racine, env)
    const enfant = spawn(process.execPath, args, {
      cwd: racine,
      stdio: 'inherit',
      env: controle.env,
    })
    const refus = controle.fermer()
    for (const message of refus) journal(message)
    const code = enfant.status ?? 1
    return code || (refus.length ? 1 : 0)
  } catch (e) {
    journal(`[tests] contrôle des écritures impossible : ${e.message}`)
    return 1
  } finally {
    controle?.fermer()
  }
}

if (import.meta.main) process.exit(lancerSansEcriture({ args: [join(RACINE, 'scripts/test/node-tests.mjs'), ...process.argv.slice(2)] }))
