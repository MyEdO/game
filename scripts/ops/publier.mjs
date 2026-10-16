// #2626
import { appendFileSync, closeSync, mkdirSync, writeSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { GitIndisponible, brancheDe, depotDe, racineDe, refusDeGit } from '../guards/lib/gitPorte.mjs'
import { ecrireJsonAtomique } from '../guards/lib/ecritureJsonAtomique.mjs'
import { lancerDetache } from '../guards/lib/lancerDetache.mjs'
import { ENV_PUBLICATION, publicationDe, publierDepuisSnapshot } from './publicationIsolee.mjs'
import {
  CODE_ARRET_MOTEUR, cheminsDeJournal, codeDeVerdict, commandeDeVeille, entameDuRun,
  envDeLancement, filetDuTrainEnfant, idDeRun, lancementDe, lancementNpm, ligneDeDetachement,
  ligneDePublication, lireJournal, modeDuLog, ouvrirLog, optionsDe, vivant,
} from './publicationDonnee.mjs'

const RACINE = fileURLToPath(new URL('../..', import.meta.url))

export const estUneAttente = (argv) => optionsDe(argv).veiller !== null

async function main() {
  if (process.env.WFRP_PUBLIER_ENFANT === '1' && process.env.WFRP_PUBLIER_LOG)
    filetDuTrainEnfant({ chemin: process.env.WFRP_PUBLIER_LOG })
  const args = process.argv.slice(2)
  const options = optionsDe(args)
  if (options.inconnus.length) {
    process.stderr.write(`[publier] option inconnue : ${options.inconnus.join(' ')}\n`)
    return 1
  }
  if (process.env[ENV_PUBLICATION]) {
    publicationDe(process.env, RACINE)
    return (await import('./publierTrain.mjs')).executerPublication()
  }
  if (options.etapes || options.veiller)
    return (await import('./publierTrain.mjs')).executerPublication()
  const depot = depotDe(RACINE)
  const toplevel = racineDe(depot)
  if (!toplevel || resolve(toplevel) !== resolve(RACINE))
    throw new Error(`${RACINE} n'est pas la racine de son dépôt (git dit ${toplevel ?? 'rien'})`)
  const branche = brancheDe(depot) ?? 'HEAD'
  const chemins = cheminsDeJournal(RACINE, branche)
  mkdirSync(chemins.dossier, { recursive: true })
  if (options.detache) {
    const fdLog = ouvrirLog(chemins.log, 'a')
    const argsEnfant = args.filter((a) => a !== '--detache')
    const lancement = Date.now()
    const script = fileURLToPath(import.meta.url)
    const pid = lancerDetache({
      script, args: argsEnfant, cwd: RACINE, fdLog,
      envSupplementaire: { WFRP_PUBLIER_ENFANT: '1', WFRP_PUBLIER_LOG: chemins.log, ...envDeLancement(lancement) },
    })
    writeSync(fdLog, ligneDeDetachement({ pid, log: chemins.log, args: argsEnfant }))
    closeSync(fdLog)
    process.stdout.write(`pid=${pid}\nlog=${chemins.log}\nveille=${commandeDeVeille({ script, run: idDeRun({ pid, lancement }) })}\n`)
    return 0
  }
  const lancement = lancementDe(process.env)
  const run = idDeRun({ pid: process.pid, lancement })
  const enfant = process.env.WFRP_PUBLIER_ENFANT === '1'
  let fdLog = null
  const ecrire = (texte) => {
    if (fdLog !== null) writeSync(fdLog, texte)
    if (!enfant) process.stderr.write(texte)
  }
  const entamer = () => {
    const journal = lireJournal(chemins.json, branche)
    entameDuRun(journal, { run, pid: process.pid, fileTimeoutMin: options.fileTimeoutMin })
    ecrireJsonAtomique(chemins.json, journal)
  }
  return publierDepuisSnapshot({
    source: RACINE, branche, chemins, reprendre: options.reprendre,
    args: process.argv.slice(2), env: { ...process.env, ...envDeLancement(lancement) },
    lancementNpm: (platform) => ({ ...lancementNpm('ci', platform), args: ['ci'] }),
    ouvrir: () => {
      fdLog = ouvrirLog(chemins.log, modeDuLog({ reprendre: options.reprendre }))
      if (enfant) writeSync(fdLog, ligneDeDetachement({ pid: process.pid, log: chemins.log, args: process.argv.slice(2) }))
      return ['ignore', fdLog, fdLog]
    },
    entamer, ecrire,
    achever: (verdict) => {
      const journal = lireJournal(chemins.json, branche)
      journal.verdict = verdict
      ecrireJsonAtomique(chemins.json, journal)
      ecrire(`${ligneDePublication(verdict, journal.tete)}\n`)
    },
    echouer: (e) => {
      const journal = lireJournal(chemins.json, branche)
      if (journal.pid && journal.pid !== process.pid && !journal.verdict && vivant(journal.pid)) {
        ecrire(`[publier] REFUS : ${e.message}\n`)
        return CODE_ARRET_MOTEUR
      }
      entamer()
      const courant = lireJournal(chemins.json, branche)
      courant.verdict = { etat: 'rouge', etape: 'moteur', raison: e instanceof GitIndisponible ? refusDeGit(e) : String(e?.message ?? e) }
      ecrireJsonAtomique(chemins.json, courant)
      ecrire(`${courant.verdict.raison}\n${ligneDePublication(courant.verdict, courant.tete)}\n`)
      return CODE_ARRET_MOTEUR
    },
    fermer: () => { if (fdLog !== null) closeSync(fdLog) },
  })
}

if (import.meta.main) try {
  process.exitCode = await main()
} catch (e) {
  const verdict = { etat: 'rouge', etape: 'moteur', raison: e instanceof GitIndisponible ? refusDeGit(e) : String(e?.message ?? e) }
  const ligne = `${verdict.raison}\n${ligneDePublication(verdict)}\n`
  if (process.env.WFRP_PUBLIER_ENFANT === '1' && process.env.WFRP_PUBLIER_LOG) appendFileSync(process.env.WFRP_PUBLIER_LOG, ligne)
  else process.stderr.write(ligne)
  process.exitCode = codeDeVerdict(verdict)
}
