import childProcess from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { activerPrecharge, lancementControle, relayerReporters, restituerRapports } from './controleEcritures.mjs'
import { lancerSansEcriture } from '../../gates/testsSansEcriture.mjs'

export function envelopperSpawnSync(original, { lancer = lancerSansEcriture, journal = console.error } = {}) {
  return function (commande, args, options = {}) {
    if (!lancementControle(commande, args))
      return original.apply(this, arguments)
    const racine = resolve(options.cwd instanceof URL ? fileURLToPath(options.cwd) : options.cwd ?? process.cwd())
    const temporaire = mkdtempSync(join(tmpdir(), 'perimetre-reporters-'))
    let resultat
    let erreurDeSpawn
    try {
      const relais = relayerReporters(args, racine, temporaire)
      const code = lancer({
        racine,
        args: relais.args,
        env: options.env ?? process.env,
        journal,
        spawn: (executable, argumentsEnfant, controle) => {
          try {
            resultat = original.call(this, executable, argumentsEnfant, {
              ...options,
              cwd: controle.cwd,
              env: controle.env,
            })
          } catch (erreur) {
            erreurDeSpawn = erreur
            throw erreur
          }
          return resultat
        },
      })
      if (erreurDeSpawn) throw erreurDeSpawn
      if (!resultat) resultat = { status: code || 1, signal: null, pid: 0, stdout: null, stderr: null, output: [null, null, null] }
      if (resultat.status !== null && resultat.status === 0 && code !== 0) resultat.status = code
      for (const message of restituerRapports(relais.rapports)) {
        journal(message)
        if (resultat.status === 0) resultat.status = 1
      }
      return resultat
    } finally {
      rmSync(temporaire, { recursive: true, force: true, maxRetries: 3, retryDelay: 25 })
    }
  }
}

function installer() {
  childProcess.spawnSync = envelopperSpawnSync(childProcess.spawnSync)
  syncBuiltinESMExports()
}

if (activerPrecharge()) installer()
