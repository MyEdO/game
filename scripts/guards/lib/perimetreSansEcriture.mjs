import childProcess from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { lancerSansEcriture } from '../../gates/testsSansEcriture.mjs'

export function relayerReporters(args, racine, temporaire) {
  const rapports = []
  const destination = (valeur) => {
    if (valeur === 'stdout' || valeur === 'stderr' || !valeur) return valeur
    const fichier = join(temporaire, `${rapports.length}.rapport`)
    rapports.push({ temporaire: fichier, destination: resolve(racine, valeur) })
    return fichier
  }
  const relaye = args.map((arg, index) => {
    if (arg.startsWith('--test-reporter-destination='))
      return `--test-reporter-destination=${destination(arg.slice('--test-reporter-destination='.length))}`
    return args[index - 1] === '--test-reporter-destination' ? destination(arg) : arg
  })
  return { args: relaye, rapports }
}

export function envelopperSpawnSync(original, { lancer = lancerSansEcriture, journal = console.error } = {}) {
  return function (commande, args, options = {}) {
    if (commande !== process.execPath || !Array.isArray(args) || !args.includes('--test'))
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
      for (const rapport of relais.rapports) {
        if (!existsSync(rapport.temporaire)) continue
        try {
          mkdirSync(dirname(rapport.destination), { recursive: true })
          copyFileSync(rapport.temporaire, rapport.destination)
        } catch (erreur) {
          journal(`[tests] restitution du reporter impossible : ${rapport.destination} : ${erreur.message}`)
          if (resultat.status === 0) resultat.status = 1
        }
      }
      return resultat
    } finally {
      rmSync(temporaire, { recursive: true, force: true, maxRetries: 3, retryDelay: 25 })
    }
  }
}

export function installer() {
  const original = childProcess.spawnSync
  childProcess.spawnSync = envelopperSpawnSync(original)
  syncBuiltinESMExports()
  return () => {
    childProcess.spawnSync = original
    syncBuiltinESMExports()
  }
}

const marque = Symbol.for('wfrp.tests.perimetreSansEcriture')
if (!globalThis[marque]) {
  globalThis[marque] = true
  installer()
}
