import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { depotDe, dossierGitCommun } from './gitPorte.mjs'
import { photoArbre } from './photoArbre.mjs'
import { listerDossier } from './lister.mjs'

const INTERCEPTEUR = new URL('./intercepterEcritures.mjs', import.meta.url).href
const PRECHARGE = Symbol.for('wfrp.tests.perimetreSansEcriture')

export const activerPrecharge = () => !globalThis[PRECHARGE] && (globalThis[PRECHARGE] = true)

export const environnementDuControle = (env = process.env) => ({ ...env, PYTHONDONTWRITEBYTECODE: '1',
  NODE_OPTIONS: `${env.NODE_OPTIONS ?? ''} --import=${INTERCEPTEUR}`.trim() })

export const lancementControle = (commande, args) => commande === process.execPath && Array.isArray(args) && args.includes('--test')

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

export function restituerRapports(rapports) {
  const echecs = []
  for (const rapport of rapports) {
    if (!existsSync(rapport.temporaire)) continue
    try {
      mkdirSync(dirname(rapport.destination), { recursive: true })
      copyFileSync(rapport.temporaire, rapport.destination)
    } catch (erreur) {
      echecs.push(`[tests] restitution du reporter impossible : ${rapport.destination} : ${erreur.message}`)
    }
  }
  return echecs
}

export function relancerApresNettoyage(erreur, nettoyer) {
  try { nettoyer() }
  catch (nettoyage) { throw new AggregateError([erreur, nettoyage], erreur.message, { cause: nettoyage }) }
  throw erreur
}

export function lancementsControles(selection) {
  const projeter = (commande, args, options = {}) => ({ args, options: selection(commande, args)
    ? { ...options, env: environnementDuControle(options.env ?? process.env) } : options })
  const preparer = (commande, args, options = {}, dependances = {}) => preparerDepuis(projeter(commande, args, options), args, options, dependances)
  return { projeter, preparer }
}

export const LANCEMENTS_SUPERVISES = lancementsControles((commande, args) => globalThis[PRECHARGE] === true && lancementControle(commande, args))

function preparerDepuis(projection, args, options, { ouvrir = ouvrirControleEcritures, journal = console.error, supprimer = rmSync }) {
  let finalise = false
  let verdict
  let controle
  let temporaire
  let nettoye = false
  let fermetureTentee = false
  const fermer = () => {
    if (fermetureTentee) return []
    fermetureTentee = true
    return controle?.fermer() ?? []
  }
  const nettoyer = () => {
    if (nettoye) return
    nettoye = true
    try { fermer() }
    finally {
      if (temporaire) supprimer(temporaire, { recursive: true, force: true, maxRetries: 3, retryDelay: 25 })
    }
  }
  if (projection.options === options) return { args, options,
    finaliser(status) { if (!finalise) { finalise = true; verdict = status } return verdict }, nettoyer }
  const racine = resolve(options.cwd instanceof URL ? fileURLToPath(options.cwd) : options.cwd ?? process.cwd())
  let relais
  try {
    temporaire = mkdtempSync(join(tmpdir(), 'perimetre-reporters-'))
    relais = relayerReporters(args, racine, temporaire)
    controle = ouvrir(racine, options.env ?? process.env)
  } catch (erreur) {
    relancerApresNettoyage(erreur, nettoyer)
  }
  return {
    args: relais.args,
    options: { ...projection.options, env: controle.env },
    finaliser(status) {
      if (finalise) return verdict
      finalise = true
      verdict = status
      const refuser = () => { if (verdict === 0) verdict = 1 }
      try {
        const refus = [...fermer(), ...restituerRapports(relais.rapports)]
        if (refus.length) refuser()
        for (const message of refus) journal(message)
      } catch (erreur) {
        refuser()
        journal('[tests] clôture du contrôle impossible : ' + erreur.message)
      } finally {
        try { nettoyer() }
        catch (erreur) {
          refuser()
          journal('[tests] nettoyage du contrôle impossible : ' + temporaire + ' : ' + erreur.message)
        }
      }
      return verdict
    },
    nettoyer,
  }
}

export function ouvrirControleEcritures(racine, env = process.env) {
  const avant = photoArbre(racine)
  if (avant.erreur) throw new Error(`photo impossible : ${avant.erreur}`)
  const commun = dossierGitCommun(depotDe(racine))
  if (!commun.disponible) throw new Error(`répertoire git commun impossible : ${commun.raison}`)
  const dossier = mkdtempSync(join(tmpdir(), 'tests-sans-ecriture-'))
  let ferme = false
  return {
    env: { ...environnementDuControle(env),
      WFRP_TESTS_RACINE: racine, WFRP_TESTS_GIT_COMMUN: commun.valeur, WFRP_TESTS_REFUS: join(dossier, 'refus') },
    fermer() {
      if (ferme) return []
      ferme = true
      try {
        const apres = photoArbre(racine)
        const refus = listerDossier(dossier).flatMap((f) => readFileSync(join(dossier, f), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)))
        if (apres.erreur || apres.texte !== avant.texte) refus.push(`[tests] REFUS arbre modifié ou photo impossible : ${apres.erreur ?? apres.texte}`)
        return refus
      } finally { rmSync(dossier, { recursive: true, force: true }) }
    },
  }
}
