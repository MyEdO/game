// #2626
import { closeSync, mkdirSync, writeSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { brancheDe, depotDe, racineDe } from '../guards/lib/gitPorte.mjs'
import { ecrireJsonAtomique } from '../guards/lib/ecritureJsonAtomique.mjs'
import { lancerDetache } from '../guards/lib/lancerDetache.mjs'
import { ENV_PUBLICATION, publicationDe, publierDepuisSnapshot } from './publicationIsolee.mjs'
import {
  CODE_ARRET_MOTEUR, cheminsDeJournal, chuteMoteur, commandeDeVeille, entameDuRun,
  envDeLancement, filetDuTrainEnfant, idDeRun, lancementDe, lancementNpm, ligneDeDetachement,
  ligneDePublication, lireJournal, modeDuLog, ouvrirLog, optionsDe, raisonDeLErreur, refusDOptions, runEnVol, sortirHorsJournal,
} from './publicationDonnee.mjs'
import { IDENTITE_MESUREE } from '../test/identiteMesuree.mjs'

const RACINE = fileURLToPath(new URL('../..', import.meta.url))

export const estUneAttente = (argv) => optionsDe(argv).veiller !== null

/** La sortie de l'enfant de `--detache` : son log et son run (`sortirHorsJournal`, #2603) ; `null` hors d'un enfant,
 *  et pour le train de son snapshot (`ENV_PUBLICATION`), dont le stderr est le log et le run celui de l'enfant. */
const sortieDeLEnfant = () => (process.env.WFRP_PUBLIER_ENFANT === '1' && process.env.WFRP_PUBLIER_LOG && !process.env[ENV_PUBLICATION]
  ? { log: process.env.WFRP_PUBLIER_LOG, run: idDeRun({ pid: process.pid, lancement: lancementDe(process.env) }) }
  : null)

/** @param {{log:string, run:string}|null} sortie */
async function main(sortie) {
  if (sortie) filetDuTrainEnfant({ chemin: sortie.log, run: sortie.run })
  /** Le refus d'un run sans verdict au journal : `sortirHorsJournal` pour l'enfant de `--detache`, `ecrire` sinon (#2603). */
  const refuser = (raison, code, ecrire) => {
    if (sortie) return sortirHorsJournal({ ...sortie, raison })
    ecrire(`${raison}\n`)
    return code
  }
  const args = process.argv.slice(2)
  const options = optionsDe(args)
  if (options.inconnus.length)
    return refuser(refusDOptions(options.inconnus), 1, (texte) => process.stderr.write(texte))
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
    entameDuRun(journal, { run, pid: process.pid, creation: performance.timeOrigin, fileTimeoutMin: options.fileTimeoutMin })
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
    entamer, ecrire, refuser: (raison) => refuser(raison, 1, ecrire),
    achever: (verdict) => {
      const journal = lireJournal(chemins.json, branche)
      journal.verdict = verdict
      ecrireJsonAtomique(chemins.json, journal)
      ecrire(`${ligneDePublication(verdict, journal.tete)}\n`)
    },
    echouer: (e) => {
      const journal = lireJournal(chemins.json, branche)
      if (journal.pid !== process.pid && runEnVol(journal, IDENTITE_MESUREE))
        return refuser(`[publier] REFUS : ${e.message}`, CODE_ARRET_MOTEUR, ecrire)
      entamer()
      const courant = lireJournal(chemins.json, branche)
      const { verdict, texte, code } = chuteMoteur(raisonDeLErreur(e), { tete: courant.tete })
      courant.verdict = verdict
      ecrireJsonAtomique(chemins.json, courant)
      ecrire(texte)
      return code
    },
    fermer: () => { if (fdLog !== null) closeSync(fdLog) },
  })
}

if (import.meta.main) {
  const sortie = sortieDeLEnfant()
  try {
    process.exitCode = await main(sortie)
  } catch (e) {
    const raison = raisonDeLErreur(e)
    if (sortie) process.exitCode = sortirHorsJournal({ ...sortie, raison })
    else {
      const { texte, code } = chuteMoteur(raison)
      process.stderr.write(texte)
      process.exitCode = code
    }
  }
}
