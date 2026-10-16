// RECONSTRUCTION DÉTACHÉE des dérivés d'un arbre (#2603) : `preuveValide` puis `build-all --perimes` de
// l'arbre, hors de l'attente de git.
// État `<git-dir>/hooks-git/reconstruction.json` : `{ demandes, soldees, lances: [{ pid, date }],
// dernier: { seq, code, debut, fin, log } }`, écrit sous le verrou d'état ; une passe par détaché tenant
// le verrou de reconstruction de l'arbre, journal `<git-dir>/hooks-git/reconstruction/<pid>.log`. Une passe écrit
// sous l'époque de l'écrivain des dérivés lue à son début (`ecrivain-derives.mjs`) ; préemptée, elle ne solde rien.
import '../node-requis.mjs'
import { spawnSync } from 'node:child_process'
import { appendFileSync, closeSync, mkdirSync, openSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ciblesSurDisque, CODE_DIFFERE, CODE_SOURCE_MODIFIEE, GENERATORS, SOURCES_LUES } from '../docs/build-all.mjs'
import { cheminsDeLEcrivain, envDeLaPasse, epoqueDe, operationEnCours } from '../docs/lib/ecrivain-derives.mjs'
import { preuveValide } from '../docs/lib/fraicheur-docs.mjs'
import { gitDirDe } from '../hooks/barriere-outil.mjs'
import { ecrireJsonAtomique } from '../guards/lib/ecritureJsonAtomique.mjs'
import { depotDe, etatDeLArbre } from '../guards/lib/gitPorte.mjs'
import { lancerDetache } from '../guards/lib/lancerDetache.mjs'
import { toleranceDeMesure } from '../guards/lib/processusWorktrees.mjs'
import { PEREMPTION_MS, purgerPerimes } from '../guards/lib/purgerPerimes.mjs'
import { attendreSync } from '../guards/lib/spawnResilient.mjs'
import { ATTENTE_GESTES_LOURDS, creationMesuree } from '../test/verrouGestesLourds.mjs'
import { attendreLibre, consignant, nomDesOrphelins, prendreVerrou } from '../test/verrou.mjs'
import { estPidVivant } from '../guards/lib/pid.mjs'
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
    return { demandes: lu.demandes ?? 0, soldees: lu.soldees ?? 0, lances: Array.isArray(lu.lances) ? lu.lances : [], dernier: lu.dernier ?? null }
  } catch {
    return { demandes: 0, soldees: 0, lances: [], dernier: null }
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

/** `build-all --perimes` de l'arbre `racine` sous l'env `env`, sa sortie ajoutée au journal `log` : REND son code. */
function construireLesPerimes(racine, log, env) {
  const fd = openSync(log, 'a')
  try {
    const vu = spawnSync(process.execPath, [join(racine, 'scripts/docs/build-all.mjs'), '--perimes'], { cwd: racine, env: { ...process.env, ...env }, stdio: ['ignore', fd, fd] })
    return vu.error ? 1 : vu.status ?? 1
  } finally {
    closeSync(fd)
  }
}

/**
 * La passe par défaut : `preuveValide` de `generateurs`, puis, périmée, `construire` (`build-all --perimes` de
 * l'arbre, sous `env`) ; vert, les docs modifiés nommés « à committer ». REND le code de `construire`, 0 sur une
 * preuve valide.
 * @param {{ racine: string, log: string, ecrire: (texte: string) => void, env?: Record<string, string>,
 *   generateurs?: typeof GENERATORS, construire?: (racine: string, log: string, env: Record<string, string>) => number }} p
 */
export function passeDesDerives({ racine, log, ecrire, env = {}, generateurs = GENERATORS, construire = construireLesPerimes }) {
  const validite = preuveValide(racine, { generateurs, ciblesSurDisque, sourcesLues: SOURCES_LUES })
  if (validite.ok) {
    ecrire('docs : attestation valide, rien à régénérer\n')
    return 0
  }
  ecrire(`docs : attestation périmée${validite.script ? ` (${validite.script})` : ''} — ${validite.raison}\n`)
  const code = construire(racine, log, env)
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
 * `REJEUX_SUR_SOURCE_MODIFIEE` fois au plus, puis soldée de ce code. La sortie se décide sous le verrou d'état, où
 * le détaché se retire de `lances`. REND le nombre de passes jouées.
 * @param {{ racine: string, passe?: typeof passeDesDerives, horloge?: () => number, dormir?: (ms: number) => void,
 *   estVivant?: (pid: number) => boolean, attenteArbre?: { echeanceMs: number, pasMs: number },
 *   attenteTenant?: { echeanceMs: number, pasMs: number, parTenant?: boolean }, operation?: (gitDir: string) => string | null }} p
 */
export function servirLesDemandes({
  racine,
  passe = passeDesDerives,
  horloge = Date.now,
  dormir = attendreSync,
  estVivant = estPidVivant,
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
  const iso = () => new Date(horloge()).toISOString()
  const ecrire = (/** @type {string} */ texte) => appendFileSync(log, texte)
  const commande = `reconstruction ${process.pid}`
  const sansCeDetache = (etat) => ({ ...etat, lances: etat.lances.filter((l) => l.pid !== process.pid && estVivant(l.pid)) })
  const retirer = () => sousLEtat(chemins, racine, commande, (etat) => ({ ecrire: sansCeDetache(etat) }))
  /** @type {Map<string, any>} */
  const orphelins = new Map()
  /** La prise du verrou de l'arbre ; `null` à l'échéance, ce détaché retiré de `lances`. */
  const prendre = () => {
    const vu = prendreVerrou({
      chemin: chemins.verrou, libelle: 'reconstruction de l’arbre', commande, cwd: racine, horloge, dormir,
      attente: { ...attenteTenant, annoncer: () => {} },
      identite: { lireCreation: creationMesuree, toleranceMs: toleranceDeMesure(), pasMs: ATTENTE_GESTES_LOURDS.pasMs },
      estVivant: consignant(chemins.verrou, null, estVivant, horloge, orphelins),
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
  /** La dernière attente de l'opération a-t-elle échu, opération encore en cours ? */
  let echue = false
  try {
    for (;;) {
      const cible = sousLEtat(chemins, racine, commande, (etat) => (etat.soldees >= etat.demandes
        ? { ecrire: sansCeDetache(etat), rendu: null }
        : { rendu: etat.demandes }))
      if (cible === null) return passes
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
      const epoque = epoqueDe(ecrivain)
      if (enCours) {
        ecrire(`[reconstruction] ${iso()} ${enCours} toujours en cours à l’échéance : passe différée\n`)
        code = CODE_DIFFERE
      } else {
        try {
          code = passe({ racine, log, ecrire, env: envDeLaPasse(epoque) })
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
      if (code === CODE_SOURCE_MODIFIEE && rejeux < REJEUX_SUR_SOURCE_MODIFIEE) {
        rejeux += 1
        ecrire(`[reconstruction] ${iso()} passe seq=${cible} — source modifiée pendant la passe, rejeu ${rejeux}/${REJEUX_SUR_SOURCE_MODIFIEE}\n`)
        continue
      }
      rejeux = 0
      const fin = iso()
      ecrire(`[reconstruction] ${fin} passe seq=${cible} — fin, code ${code}\n`)
      sousLEtat(chemins, racine, commande, (etat) => ({
        ecrire: { ...etat, soldees: Math.max(etat.soldees, cible), dernier: { seq: cible, code, debut, fin, log } },
      }))
    }
  } finally {
    prise?.liberer()
  }
}

/**
 * ATTEND que la demande `seq` de l'arbre `racine` soit soldée. REND `{ etat: 'soldee', ...dernier }` ;
 * `{ etat: 'mort', code: CODE_MORT_SANS_VERDICT, log }` quand ni le tenant du verrou de reconstruction ni
 * aucun pid de `lances` ne vit ; `{ etat: 'en-cours' }` à l'échéance.
 * @param {string} racine @param {number} seq
 * @param {{ echeanceMs: number, pasMs?: number, horloge?: () => number, dormir?: (ms: number) => void, estVivant?: (pid: number) => boolean }} p
 */
export function attendreLaReconstruction(racine, seq, { echeanceMs, pasMs = 500, horloge = Date.now, dormir = attendreSync, estVivant = estPidVivant }) {
  const chemins = cheminsDeLaReconstruction(racine)
  if (chemins === null) throw new Error(`répertoire git introuvable depuis ${racine}`)
  const echeance = horloge() + echeanceMs
  for (;;) {
    const etat = lireEtat(chemins)
    if (etat.soldees >= seq) return { etat: 'soldee', ...etat.dernier }
    const tenu = attendreLibre({ chemin: chemins.verrou, estVivant }).etat === 'occupe'
    if (!tenu && !etat.lances.some((l) => estVivant(l.pid))) {
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
