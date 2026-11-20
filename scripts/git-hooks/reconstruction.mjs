// RECONSTRUCTION DÉTACHÉE des dérivés d'un arbre (#2603) : `preuveValide` puis `build-all --perimes` de
// l'arbre, hors de l'attente de git.
// État `<git-dir>/hooks-git/reconstruction.json` : `{ demandes, soldees, lances: [{ pid, date }],
// dernier: { seq, code, debut, fin, log, sourceModifieePersistante? }, conflitsDeSource: { tete, demandes } | null }`,
// écrit sous le verrou d'état ; une passe par détaché tenant
// le verrou de reconstruction de l'arbre, journal `<git-dir>/hooks-git/reconstruction/<pid>.log`. Une passe écrit
// sous l'époque de l'écrivain des dérivés lue à son début (`ecrivain-derives.mjs`) ; préemptée, elle ne solde rien.
import '../node-requis.mjs'
import { spawnSync } from 'node:child_process'
import { appendFileSync, closeSync, mkdirSync, openSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ciblesSurDisque, CODE_SOURCE_MODIFIEE, DIAGNOSTIC_RECONSTRUCTION, GENERATORS, SOURCES_LUES } from '../docs/build-all.mjs'
import { CODE_DIFFERE } from '../guards/lib/codesDeSortie.mjs'
import { cheminsDeLEcrivain, envDeLaPasse, epoqueDe, operationEnCours } from '../docs/lib/ecrivain-derives.mjs'
import { preuveValide } from '../docs/lib/fraicheur-docs.mjs'
import { gitDirDe } from '../hooks/barriere-outil.mjs'
import { ecrireJsonAtomique } from '../guards/lib/ecritureJsonAtomique.mjs'
import { depotDe, etatDeLArbre, shaDe } from '../guards/lib/gitPorte.mjs'
import { lancerDetache } from '../guards/lib/lancerDetache.mjs'
import { PEREMPTION_MS, purgerPerimes } from '../guards/lib/purgerPerimes.mjs'
import { attendreSync } from '../guards/lib/spawnResilient.mjs'
import { ATTENTE_GESTES_LOURDS } from '../test/verrouGestesLourds.mjs'
import { IDENTITE_MESUREE } from '../test/identiteMesuree.mjs'
import { naissanceDuTenant, nomDesOrphelins, prendreVerrou, tenantDe } from '../test/verrou.mjs'
import { estPidVivant, estPidVivantDepuis } from '../guards/lib/pid.mjs'
import { journaliserLeHook } from './journal.mjs'

/** Code d'une reconstruction demandée dont aucun détaché ne vit plus, sans verdict (`EX_SOFTWARE`, sysexits.h). */
export const CODE_MORT_SANS_VERDICT = 70

/** L'attente du verrou d'état : une lecture et une écriture JSON, jamais une passe. Valeur maison. */
export const ATTENTE_DE_L_ETAT = Object.freeze({ echeanceMs: 10_000, pasMs: 20 })

/** L'attente d'un arbre libre de toute opération git avant une passe. Valeur maison. */
export const ATTENTE_DE_L_ARBRE = Object.freeze({ echeanceMs: 30 * 60 * 1000, pasMs: 2_000 })

/** L'attente du verrou de reconstruction de l'arbre : celle des gestes lourds, par tenant. */
export const ATTENTE_DU_TENANT = Object.freeze({ ...ATTENTE_GESTES_LOURDS, pasMs: 500 })

/** Les passes rejouées d'une même demande dont la passe rend `CODE_SOURCE_MODIFIEE`. Valeur maison. */
export const REJEUX_SUR_SOURCE_MODIFIEE = 3

/** Demandes épuisées sur la même tête avant l'échec persistant. Valeur maison. */
export const DEMANDES_SUR_SOURCE_MODIFIEE = 2

/** Un lancé de `lances` vit-il encore, né à sa `date` d'inscription ? (#2603) */
const lanceVivant = (l, identite, estVivant) => estPidVivantDepuis(l.pid, Date.parse(l.date), identite, { estVivant })

/** Ce module, point d'entrée du détaché (`--servir`). */
const SCRIPT = fileURLToPath(import.meta.url)

/** La ligne machine d'un hook qui a demandé la passe `seq` (stdout). PURE. @param {number} seq */
export const ligneDeDemande = (seq) => `reconstruction seq=${seq}\n`

/** Le `seq` de la dernière `ligneDeDemande` de `sortie`, `null` sans demande. PURE. @param {string} sortie */
export function seqDeLaSortie(sortie) {
  const vus = [...String(sortie ?? '').matchAll(/^reconstruction seq=(\d+)\r?$/gm)]
  return vus.length ? Number(vus.at(-1)[1]) : null
}

/** Les chemins de la reconstruction de l'arbre `racine`, `null` hors dépôt. @param {string} racine */
export function cheminsDeLaReconstruction(racine) {
  const gitDir = gitDirDe(racine)
  if (gitDir === null) return null
  const dossier = join(gitDir, 'hooks-git')
  return {
    etat: join(dossier, 'reconstruction.json'),
    verrouEtat: join(dossier, 'reconstruction-etat.verrou'),
    verrou: join(dossier, 'reconstruction.verrou'),
    logs: join(dossier, 'reconstruction'),
  }
}

/** Le journal de la passe du détaché `pid`. */
export const logDeLaPasse = (chemins, pid) => join(chemins.logs, `${pid}.log`)

/** L'état lu, l'état vide s'il manque ou est illisible. */
function lireEtat(chemins) {
  try {
    const lu = JSON.parse(readFileSync(chemins.etat, 'utf8'))
    return {
      demandes: lu.demandes ?? 0, soldees: lu.soldees ?? 0, lances: Array.isArray(lu.lances) ? lu.lances : [],
      dernier: lu.dernier ?? null, conflitsDeSource: lu.conflitsDeSource ?? null,
    }
  } catch {
    return { demandes: 0, soldees: 0, lances: [], dernier: null, conflitsDeSource: null }
  }
}

/** `geste(etat)` joué sous le verrou d'état ; ce qu'il rend avec `ecrire` est écrit avant la libération. */
function sousLEtat(chemins, racine, commande, geste) {
  mkdirSync(chemins.logs, { recursive: true })
  const prise = prendreVerrou({ chemin: chemins.verrouEtat, libelle: 'état de la reconstruction', commande, cwd: racine, attente: ATTENTE_DE_L_ETAT })
  if (prise.etat !== 'pris') throw new Error(prise.message)
  try {
    const { ecrire, rendu } = geste(lireEtat(chemins))
    if (ecrire) ecrireJsonAtomique(chemins.etat, ecrire)
    return rendu
  } finally {
    prise.liberer()
  }
}

/**
 * DEMANDE une passe pour l'arbre `racine` : sous le verrou d'état, lance un détaché (`--servir`) et inscrit la
 * demande et son lancement. REND le `seq` demandé. LÈVE hors dépôt, ou sur un verrou d'état tenu à l'échéance.
 * @param {string} racine
 * @param {{ script?: string, detacher?: typeof lancerDetache, horloge?: () => number }} [injections]
 */
export function demanderLaReconstruction(racine, { script = SCRIPT, detacher = lancerDetache, horloge = Date.now } = {}) {
  const chemins = cheminsDeLaReconstruction(racine)
  if (chemins === null) throw new Error(`répertoire git introuvable depuis ${racine}`)
  return sousLEtat(chemins, racine, `demande de reconstruction ${process.pid}`, (etat) => {
    const pid = detacher({ script, args: ['--servir'], cwd: racine, fdLog: 'ignore' })
    const seq = etat.demandes + 1
    return { ecrire: { ...etat, demandes: seq, lances: [...etat.lances, { pid, date: new Date(horloge()).toISOString() }] }, rendu: seq }
  })
}

/** `build-all --perimes` sous `env` : sorties humaines au journal, raison du code 79 sur le canal dédié. */
function construireLesPerimes(racine, log, env, signalerSourceModifiee) {
  const fd = openSync(log, 'a')
  try {
    const vu = spawnSync(process.execPath, [join(racine, 'scripts/docs/build-all.mjs'), '--perimes', DIAGNOSTIC_RECONSTRUCTION], {
      cwd: racine, env: { ...process.env, ...env }, stdio: ['ignore', fd, fd, 'pipe'], encoding: 'utf8',
    })
    const code = vu.status ?? 1
    if (code === CODE_SOURCE_MODIFIEE && vu.output?.[3]) {
      let diagnostic
      try { diagnostic = JSON.parse(vu.output[3]) } catch { /* Le journal garde le diagnostic humain. */ }
      if (typeof diagnostic?.generateur === 'string' && typeof diagnostic.raison === 'string') {
        signalerSourceModifiee(`${diagnostic.generateur} — ${diagnostic.raison}`)
      }
    }
    return code
  } finally {
    closeSync(fd)
  }
}

/**
 * La passe par défaut : `preuveValide` de `generateurs`, puis, périmée, `construire` (`build-all --perimes` de
 * l'arbre, sous `env`) ; vert, les docs modifiés nommés « à committer ». REND le code de `construire`, 0 sur une
 * preuve valide.
 * @param {{ racine: string, log: string, ecrire: (texte: string) => void, env?: Record<string, string>,
 *   generateurs?: typeof GENERATORS, construire?: typeof construireLesPerimes,
 *   signalerSourceModifiee?: (raison: string) => void }} p
 */
export function passeDesDerives({
  racine, log, ecrire, env = {}, generateurs = GENERATORS, construire = construireLesPerimes, signalerSourceModifiee = () => {},
}) {
  const validite = preuveValide(racine, { generateurs, ciblesSurDisque, sourcesLues: SOURCES_LUES })
  if (validite.ok) {
    ecrire('docs : attestation valide, rien à régénérer\n')
    return 0
  }
  ecrire(`docs : attestation périmée${validite.script ? ` (${validite.script})` : ''} — ${validite.raison}\n`)
  const code = construire(racine, log, env, signalerSourceModifiee)
  if (code !== 0) return code
  const changes = etatDeLArbre(depotDe(racine))
    .filter((e) => e.etat !== '??' && e.etat[1] !== ' ' && e.chemins[0].startsWith('docs/'))
    .map((e) => e.chemins[0])
  if (changes.length) ecrire(`docs régénérés : à committer (${changes.length}) :\n${changes.map((f) => `  ${f}`).join('\n')}\n`)
  return 0
}

/**
 * Le DÉTACHÉ : sous le verrou de reconstruction de l'arbre `racine` (attente par tenant, identité mesurée),
 * sert les demandes tant que `soldees < demandes`. Une opération git en cours (`operationEnCours`) s'attend
 * verrou de l'arbre RENDU, le détaché restant inscrit à `lances` ; à sa fin ou à l'échéance, il reprend le verrou
 * par la même prise et relit sa cible sous le verrou d'état ; une opération encore en cours à l'échéance solde la
 * cible de `CODE_DIFFERE`. Chaque passe joue `passe` sous l'époque de l'écrivain des dérivés lue avant elle
 * (`envDeLaPasse`), puis solde sa cible ; une époque changée pendant la passe (`preempterLesDerives`, ou une
 * opération git vue par `sousLEpoque`) la rejoue sans rien solder ; une passe en `CODE_SOURCE_MODIFIEE` est rejouée
 * `REJEUX_SUR_SOURCE_MODIFIEE` fois au plus, puis soldée de ce code. Sur la même tête, après
 * `DEMANDES_SUR_SOURCE_MODIFIEE` épuisements consécutifs, le verdict porte l'échec persistant. Le compteur et la
 * sortie se décident sous le verrou d'état, où le détaché se retire de `lances`. REND le nombre de passes jouées.
 * @param {{ racine: string, passe?: typeof passeDesDerives, horloge?: () => number, dormir?: (ms: number) => void,
 *   estVivant?: (pid: number) => boolean, identite?: typeof IDENTITE_MESUREE, attenteArbre?: { echeanceMs: number, pasMs: number },
 *   attenteTenant?: { echeanceMs: number, pasMs: number, parTenant?: boolean }, operation?: (gitDir: string) => string | null }} p
 */
export function servirLesDemandes({
  racine,
  passe = passeDesDerives,
  horloge = Date.now,
  dormir = attendreSync,
  estVivant = estPidVivant,
  identite = IDENTITE_MESUREE,
  attenteArbre = ATTENTE_DE_L_ARBRE,
  attenteTenant = ATTENTE_DU_TENANT,
  operation = operationEnCours,
}) {
  const chemins = cheminsDeLaReconstruction(racine)
  if (chemins === null) throw new Error(`répertoire git introuvable depuis ${racine}`)
  mkdirSync(chemins.logs, { recursive: true })
  purgerPerimes({ dossier: chemins.logs, motif: /^\d+\.log$/, ageMs: PEREMPTION_MS })
  const log = logDeLaPasse(chemins, process.pid)
  const gitDir = /** @type {string} */ (gitDirDe(racine))
  const ecrivain = cheminsDeLEcrivain(gitDir)
  const depot = depotDe(racine)
  const iso = () => new Date(horloge()).toISOString()
  const ecrire = (/** @type {string} */ texte) => appendFileSync(log, texte)
  const commande = `reconstruction ${process.pid}`
  const sansCeDetache = (etat) => ({ ...etat, lances: etat.lances.filter((l) => l.pid !== process.pid && lanceVivant(l, identite, estVivant)) })
  const retirer = () => sousLEtat(chemins, racine, commande, (etat) => ({ ecrire: sansCeDetache(etat) }))
  /** @type {Map<string, any>} */
  const orphelins = new Map()
  /** La prise du verrou de l'arbre ; `null` à l'échéance, ce détaché retiré de `lances`. */
  const prendre = () => {
    const vu = prendreVerrou({
      chemin: chemins.verrou, libelle: 'reconstruction de l’arbre', commande, cwd: racine, horloge, dormir,
      attente: { ...attenteTenant, annoncer: () => {} },
      identite: { ...identite, pasMs: ATTENTE_GESTES_LOURDS.pasMs },
      estVivant, orphelins,
    })
    if (vu.etat !== 'pris') {
      ecrire(`[reconstruction] ${iso()} verrou de l’arbre tenu à l’échéance : ${vu.message}\n`)
      retirer()
      return null
    }
    if (orphelins.size) ecrire(`[reconstruction] ${iso()} verrou orphelin repris : ${nomDesOrphelins([...orphelins.values()])}\n`)
    orphelins.clear()
    return vu
  }
  let prise = prendre()
  if (prise === null) return 0
  let passes = 0
  let rejeux = 0
  let teteDesRejeux = null
  let soldeDesRejeux = null
  /** La dernière attente de l'opération a-t-elle échu, opération encore en cours ? */
  let echue = false
  try {
    for (;;) {
      const lot = sousLEtat(chemins, racine, commande, (etat) => (etat.soldees >= etat.demandes
        ? { ecrire: sansCeDetache(etat), rendu: null }
        : { rendu: { cible: etat.demandes, soldees: etat.soldees } }))
      if (lot === null) return passes
      const { cible, soldees } = lot
      const enCours = operation(gitDir)
      if (enCours && !echue) {
        prise.liberer()
        prise = null
        ecrire(`[reconstruction] ${iso()} ${enCours} en cours : verrou de l’arbre rendu pendant l’attente\n`)
        const echeance = horloge() + attenteArbre.echeanceMs
        let vu = enCours
        while (vu && horloge() < echeance) {
          dormir(attenteArbre.pasMs)
          vu = operation(gitDir)
        }
        prise = prendre()
        if (prise === null) return passes
        echue = Boolean(vu)
        continue
      }
      echue = false
      const debut = iso()
      ecrire(`[reconstruction] ${debut} passe seq=${cible} — début\n`)
      let code
      let raison = null
      const tete = shaDe(depot, 'HEAD')
      if (tete !== teteDesRejeux || soldees !== soldeDesRejeux) {
        rejeux = 0
        teteDesRejeux = tete
        soldeDesRejeux = soldees
      }
      const epoque = epoqueDe(ecrivain)
      if (enCours) {
        ecrire(`[reconstruction] ${iso()} ${enCours} toujours en cours à l’échéance : passe différée\n`)
        code = CODE_DIFFERE
      } else {
        try {
          code = passe({
            racine, log, ecrire, env: envDeLaPasse(epoque),
            signalerSourceModifiee: (diagnostic) => { raison = diagnostic },
          })
        } catch (e) {
          ecrire(`[reconstruction] ${iso()} arrêt : ${/** @type {any} */ (e)?.stack ?? e}\n`)
          code = 1
        }
      }
      passes += 1
      if (epoqueDe(ecrivain) !== epoque) {
        ecrire(`[reconstruction] ${iso()} passe seq=${cible} — préemptée (code ${code}), rejouée\n`)
        continue
      }
      const rejouerLaNouvelleTete = () => {
        rejeux = 0
        ecrire(`[reconstruction] ${iso()} passe seq=${cible} — tête changée (code ${code}), rejouée\n`)
      }
      if (code === CODE_SOURCE_MODIFIEE && rejeux < REJEUX_SUR_SOURCE_MODIFIEE) {
        if (shaDe(depot, 'HEAD') !== tete) rejouerLaNouvelleTete()
        else {
          rejeux += 1
          ecrire(`[reconstruction] ${iso()} passe seq=${cible} — source modifiée pendant la passe, rejeu ${rejeux}/${REJEUX_SUR_SOURCE_MODIFIEE}\n`)
        }
        continue
      }
      sousLEtat(chemins, racine, commande, (etat) => {
        const avant = etat.conflitsDeSource?.tete === tete ? etat.conflitsDeSource : null
        const fin = iso()
        let conflitsDeSource = null
        /** @type {{ seq: number, code: number, debut: string, fin: string, log: string, sourceModifieePersistante?: { raison: string | null } }} */
        const dernier = { seq: cible, code, debut, fin, log }
        if (code === CODE_SOURCE_MODIFIEE) {
          if (shaDe(depot, 'HEAD') !== tete) {
            rejouerLaNouvelleTete()
            return {}
          }
          const demandes = Math.min(DEMANDES_SUR_SOURCE_MODIFIEE, (avant?.demandes ?? 0) + 1)
          conflitsDeSource = { tete, demandes }
          if (demandes === DEMANDES_SUR_SOURCE_MODIFIEE) dernier.sourceModifieePersistante = { raison }
        } else if (code === CODE_DIFFERE) conflitsDeSource = avant
        rejeux = 0
        const diagnostic = dernier.sourceModifieePersistante ? ` — source modifiée à répétition${raison ? ` : ${raison}` : ''}` : ''
        ecrire(`[reconstruction] ${fin} passe seq=${cible} — fin, code ${code}${diagnostic}\n`)
        return { ecrire: { ...etat, soldees: Math.max(etat.soldees, cible), dernier, conflitsDeSource } }
      })
    }
  } finally {
    prise?.liberer()
  }
}

/**
 * ATTEND que la demande `seq` de l'arbre `racine` soit soldée. REND `{ etat: 'soldee', ...dernier }` ;
 * `{ etat: 'mort', code: CODE_MORT_SANS_VERDICT, log }` quand ni le tenant du verrou de reconstruction ni
 * aucun pid de `lances` ne vit, sous `identite` ; `{ etat: 'en-cours' }` à l'échéance.
 * @param {string} racine @param {number} seq
 * @param {{ echeanceMs: number, pasMs?: number, horloge?: () => number, dormir?: (ms: number) => void, estVivant?: (pid: number) => boolean,
 *   identite?: typeof IDENTITE_MESUREE }} p
 */
export function attendreLaReconstruction(racine, seq, { echeanceMs, pasMs = 500, horloge = Date.now, dormir = attendreSync, estVivant = estPidVivant, identite = IDENTITE_MESUREE }) {
  const chemins = cheminsDeLaReconstruction(racine)
  if (chemins === null) throw new Error(`répertoire git introuvable depuis ${racine}`)
  const echeance = horloge() + echeanceMs
  for (;;) {
    const etat = lireEtat(chemins)
    if (etat.soldees >= seq) return { etat: 'soldee', ...etat.dernier }
    const tenant = tenantDe(chemins.verrou)
    const tenu = tenant !== null && estPidVivantDepuis(tenant.pid, naissanceDuTenant(tenant), identite, { estVivant })
    if (!tenu && !etat.lances.some((l) => lanceVivant(l, identite, estVivant))) {
      const relu = lireEtat(chemins)
      if (relu.soldees >= seq) return { etat: 'soldee', ...relu.dernier }
      const dernier = relu.lances.at(-1)
      return { etat: 'mort', code: CODE_MORT_SANS_VERDICT, log: dernier ? logDeLaPasse(chemins, dernier.pid) : null }
    }
    if (horloge() >= echeance) return { etat: 'en-cours' }
    dormir(pasMs)
  }
}

/** Le nombre de demandes inscrites pour l'arbre `racine`, 0 hors dépôt. @param {string} racine */
export function demandesDe(racine) {
  const chemins = cheminsDeLaReconstruction(racine)
  return chemins === null ? 0 : lireEtat(chemins).demandes
}

if (import.meta.main && process.argv[2] === '--servir') {
  const racine = process.cwd()
  journaliserLeHook('reconstruction', { racine })
  try {
    servirLesDemandes({ racine })
  } catch (e) {
    const chemins = cheminsDeLaReconstruction(racine)
    if (chemins) appendFileSync(logDeLaPasse(chemins, process.pid), `[reconstruction] arrêt : ${/** @type {any} */ (e)?.stack ?? e}\n`)
    process.exitCode = 1
  }
}
