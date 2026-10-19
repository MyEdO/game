import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { availableParallelism, tmpdir } from 'node:os'
import path, { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mesurerProcessusWorktrees, argumentsProcessus } from '../guards/lib/processusWorktrees.mjs'
import { canoniser } from '../docs/lib/chemin-mesure.mjs'
import { spawnBorne, diagnosticDuLancement, diagnosticArret, tuerArbre } from '../guards/lib/processusBorne.mjs'
import { lancerProcessusSupervise } from '../guards/lib/superviserProcessus.mjs'
import { ecrireJsonAtomique } from '../guards/lib/ecritureJsonAtomique.mjs'
import { CODE_DIFFERE } from '../guards/lib/codesDeSortie.mjs'
import { admissionNode, coeurs, memoireDisponibleMo } from './partition.mjs'
import { dossierDesMesures, mesuresDe } from './mesures.mjs'

const PROFILS = 'memoire-node.json'
const PRECHARGE = fileURLToPath(new URL('./memoire-precharge.cjs', import.meta.url))
const CONTRAT = 'domaine-natif-v1-gate-cjs-challenge-ack-transactionnel-v2'
/** La concurrence d'un lancement node SANS profil mémoire utilisable (#2586) : celle de l'acquisition, et celle, fixe,
 *  d'une plateforme sans mesure native (`lancerNodeMesure`). */
export const CONCURRENCE_SANS_PROFIL = 1
const empreinte = (texte) => createHash('sha256').update(texte).digest('hex')
const erreur = (message) => Object.assign(new Error(message), { code: 'MESURE_MEMOIRE_INCOMPLETE' })
const lire = (p) => {
  try { return readFileSync(p, 'utf8') }
  catch (cause) { if (cause.code === 'ENOENT') return ''; throw cause }
}
const nomOption = (v) => v.split('=')[0].replaceAll('_', '-')
const pause = new Int32Array(new SharedArrayBuffer(4))
const creationExacte = (v) => {
  if (typeof v !== 'string') return null
  const m = /^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)(?:\.(\d{1,9}))?(?:Z|\+00:00)$/.exec(v)
  return m && Number.isFinite(Date.parse(v)) ? m[1] + '.' + (m[2] ?? '').replace(/0+$/, '') + 'Z' : null
}

export function decomposerOptionsNode(texte = '') {
  const mots = []
  let mot = '', guillemets = false, commence = false
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i]
    if (c === '"') { guillemets = !guillemets }
    else if (c === '\\' && guillemets) {
      if (++i === texte.length) throw erreur('NODE_OPTIONS : échappement incomplet')
      mot += texte[i]; commence = true
    } else if (c === ' ' && !guillemets) {
      if (commence) mots.push(mot)
      mot = ''; commence = false
    } else { mot += c; commence = true }
  }
  if (guillemets) throw erreur('NODE_OPTIONS : guillemet non fermé')
  if (commence) mots.push(mot)
  return mots
}

export function environnementDeLaMesure(env, argv = [], cwd = process.cwd()) {
  const options = decomposerOptionsNode(env.NODE_OPTIONS ?? '')
  for (const liste of [options, argv]) for (let i = 0; i < liste.length; i++) {
    const a = liste[i], nom = nomOption(a)
    if (['--snapshot-blob', '--build-snapshot'].includes(nom)) throw erreur('snapshot utilisateur incompatible avec la mesure mémoire')
    if (['--test-isolation', '--experimental-test-isolation'].includes(nom)) {
      const valeur = a.includes('=') ? a.slice(a.indexOf('=') + 1) : liste[++i]
      if (valeur === 'none') throw erreur('isolation test none incompatible avec la mesure mémoire')
    }
  }
  const gardees = []
  const estGate = (v) => {
    if (!v || (!path.isAbsolute(v) && !/^\.\.?[\\/]/.test(v))) return false
    const normaliser = (p) => process.platform === 'win32' ? path.resolve(p).toLowerCase() : path.resolve(p)
    return normaliser(resolve(cwd, v)) === normaliser(PRECHARGE)
  }
  for (let i = 0; i < options.length; i++) {
    const a = options[i], nom = nomOption(a)
    if (nom === '--require' || a === '-r') {
      const jointe = a.includes('='), valeur = jointe ? a.slice(a.indexOf('=') + 1) : options[i + 1]
      if (estGate(valeur)) { if (!jointe) i++; continue }
      gardees.push(a)
      if (!jointe && valeur !== undefined) gardees.push(options[++i])
    } else if (a.startsWith('-r') && a.length > 2 && estGate(a.slice(2))) continue
    else gardees.push(a)
  }
  const citer = (v) => '"' + v.replaceAll('\\', '\\\\').replaceAll('"', '\\"') + '"'
  return { ...env, NODE_OPTIONS: ['--require', PRECHARGE, ...gardees].map(citer).join(' ') }
}

export function profilsDuLancement({ racine, fichiers, argv = [], env = {}, superviser = lancerProcessusSupervise, mesures = mesuresDe(dossierDesMesures(racine)) }) {
  const argumentsDuLancement = [...(argv.includes('--test') ? argv : ['--test', ...argv]), ...fichiers.filter((f) => !argv.includes(f))]
  const optionsDuLancement = { cwd: racine, env: environnementDeLaMesure(env, argumentsDuLancement, racine) }
  const effectives = superviser.optionsEffectives?.(process.execPath, argumentsDuLancement, optionsDuLancement) ?? null
  const configurationConnue = effectives !== null
  argv = effectives?.args ?? argumentsDuLancement
  env = effectives?.options.env ?? optionsDuLancement.env
  const configuration = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], nom = nomOption(a)
    if (nom === '--test-reporter') configuration.push(nom, a.includes('=') ? a.slice(a.indexOf('=') + 1) : argv[++i])
    else if (['--test-reporter-destination', '--test-concurrency'].includes(nom)) { if (!a.includes('=')) i++ }
    else if (!fichiers.includes(a) && a !== '--test') configuration.push(a)
  }
  const backend = ['../guards/lib/processusJob.cs', '../guards/lib/hoteSupervision.py', '../guards/lib/hoteSupervision.ps1', './memoire-precharge.cjs']
    .map((f) => empreinte(lire(new URL(f, import.meta.url))))
  const toolchain = empreinte(JSON.stringify({ contrat: CONTRAT, backend, node: process.versions.node, executable: process.execPath,
    verrou: empreinte(lire(join(racine, 'package-lock.json'))), configuration, precharges: env.NODE_OPTIONS ?? '', configurationConnue }))
  const historiques = mesures.lire(PROFILS, (v) => v && typeof v === 'object' ? v : {})
  const entrees = fichiers.map((fichier) => {
    const cle = empreinte(JSON.stringify({ fichier, toolchain })), blob = empreinte(lire(resolve(racine, fichier))), historique = historiques[cle]
    return { fichier, cle, blob, historique, utilisable: configurationConnue && historique?.blob === blob &&
      Number.isSafeInteger(historique?.picOctets) && historique.picOctets > 0 && Number.isSafeInteger(historique?.parentOctets) && historique.parentOctets > 0 &&
      historique?.descendantsInclus === true && typeof historique.metrique === 'string' }
  })
  return { entrees, mesures, toolchain, configurationConnue }
}

export function admettreLancementNode({ fichiers, profils, parentOctets, disponibleOctets, cpus, argv = [], objectifOctets }) {
  const admission = admissionNode(cpus, disponibleOctets, { profils, parentOctets, objectifOctets, nombre: fichiers.length })
  const demandes = []
  const reste = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--test-concurrency') demandes.push(argv[++i])
    else if (a.startsWith('--test-concurrency=')) demandes.push(a.slice('--test-concurrency='.length))
    else reste.push(a)
  }
  const valeurs = demandes.map(Number)
  const demandeInvalide = valeurs.some((v) => !Number.isInteger(v) || v < 1)
  const max = valeurs.length ? Math.min(...valeurs) : admission.concurrence
  const trop = valeurs.some((v) => v > admission.concurrence)
  const profilsComplets = fichiers.every((f) => profils.some((p) => p.fichier === f && Number.isSafeInteger(p.picOctets) && p.picOctets > 0))
  const refus = !profilsComplets ? 'PROFIL_MEMOIRE_ABSENT' : admission.refus ?? (demandeInvalide ? 'CONCURRENCE_INVALIDE' : trop ? 'CONCURRENCE_SUPERIEURE_CAPACITE' : null)
  return { ...admission, refus, concurrence: max,
    argv: [...reste.filter((a) => a !== '--test'), '--test', '--test-concurrency=' + max] }
}

export function collecterMemoire({ controle, pid = controle?.pid, fichiers, racine, dossier, generation, mesurer = mesurerProcessusWorktrees,
  platform = process.platform, maintenant = Date.now }) {
  const pics = new Map(), emissions = new Map(), entrees = new Map(fichiers.map((f) => [empreinte(f), f]))
  const engagements = new Map(), enSuspens = new Map()
  let parentOctets = 0, metrique, defaut, cloturee = false, valides = 0, rejets = 0, premiereCause, resultatQualite = 'en-cours'
  const expirations = new WeakSet()
  const finDeCible = Object.assign(erreur('cible sortie'), { code: 'CIBLE_SORTIE' })
  let cibleAcquittee = false
  const qualite = () => ({ resultat: defaut ? 'incomplete' : resultatQualite, echantillonsValides: valides, rejets,
    premiereCause: premiereCause ? diagnosticDuLancement({ error: premiereCause }).error : null })
  const expiration = (message, cause) => {
    const e = Object.assign(erreur(message), { code: 'ECHANTILLON_MEMOIRE_EXPIRE', ...(cause ? { cause } : {}) })
    expirations.add(e)
    return e
  }
  const faute = (code) => Object.assign(erreur(code), { code })
  const chemins = platform === 'win32' ? path.win32 : path.posix
  const canonique = (fichier, cwd) => {
    if (/^file:\/\//i.test(fichier)) fichier = fileURLToPath(fichier, { windows: platform === 'win32' })
    const absolu = chemins.resolve(cwd, fichier)
    const reel = platform === process.platform ? canoniser(absolu, { strict: true }) : absolu
    return platform === 'win32' ? reel.toLowerCase() : reel
  }
  const candidats = fichiers.map((fichier) => ({ fichier, id: empreinte(fichier), chemin: canonique(fichier, racine) }))
  const lireJson = (fichier, facultatif = false) => {
    try { return JSON.parse(readFileSync(fichier, 'utf8')) }
    catch (e) { if (facultatif && e.code === 'ENOENT') return null; throw e }
  }
  const observer = () => {
    const echeance = maintenant() + 2000, nouvelles = new Map()
    const restant = () => {
      const ms = echeance - maintenant()
      if (ms <= 0) throw faute(enSuspens.size ? 'MEMBRE_NON_ATTRIBUE' : 'CHALLENGE_MEMOIRE_EXPIRE')
      return ms
    }
    const resultatControle = (operation, appel) => {
      try { return appel() } catch (cause) {
        if (cause.origine === 'controle-natif' && cause.operation === operation && cause.expiree === true && ['ETIMEDOUT', 'EXPIRATION'].includes(cause.code))
          throw expiration(cause.message, cause)
        throw cause
      }
    }
    const publier = (fichier, valeur) => ecrireJsonAtomique(fichier, valeur, { attendre: (ms) => {
      Atomics.wait(pause, 0, 0, Math.min(ms, restant()))
      restant()
    } })
    const capturer = () => {
      const r = resultatControle('vue', () => controle.mesurerDomaine({ timeout: restant() }))
      const vue = r?.vue ?? r
      if (!vue || !Array.isArray(vue.processus) || vue.metriqueMemoire !== 'working-set') throw erreur('vue native invalide')
      const ids = new Set(), pids = new Set()
      for (const p of vue.processus) {
        if (!p || typeof p.identifiant !== 'string' || !p.identifiant || ids.has(p.identifiant) || !Number.isInteger(p.pid) || p.pid <= 0 || pids.has(p.pid) || !creationExacte(p.creation))
          throw erreur('identité native invalide ou dupliquée')
        ids.add(p.identifiant); pids.add(p.pid)
        if (!['vivant', 'sortie'].includes(p.etat) || !Array.isArray(p.erreurs) || p.erreurs.length || !Number.isSafeInteger(p.residentOctets) || p.residentOctets < 0 || p.metriqueMemoire !== vue.metriqueMemoire)
          throw erreur('working-set natif incomplet')
        if (['hote', 'worker', 'cible'].includes(p.role)) {
          if ((p.etat !== 'vivant' && p.role !== 'cible') || p.entreeId !== null || (p.role === 'cible' && p.pid !== pid)) throw erreur('infrastructure native contradictoire')
        } else if (p.role !== null || (p.entreeId !== null && !entrees.has(p.entreeId))) throw erreur('attribution native inconnue')
        const engagement = engagements.get(p.identifiant)
        if (engagement) {
          if (engagement.type === 'entree' ? p.entreeId !== engagement.id : p.role !== 'cible' || p.entreeId !== null) throw erreur('attribution native non conservée')
        }
        if (p.role === null && p.entreeId === null) {
          if (p.etat !== 'vivant') throw faute('MEMBRE_NON_ATTRIBUE')
          const precedent = enSuspens.get(p.identifiant)
          if (precedent && (precedent.pid !== p.pid || precedent.creation !== p.creation)) throw erreur('instance native modifiée pendant acquisition')
          enSuspens.set(p.identifiant, { identifiant: p.identifiant, pid: p.pid, creation: p.creation })
        } else enSuspens.delete(p.identifiant)
      }
      if (cibleAcquittee && !vue.processus.some((p) => p.role === 'cible' && p.etat === 'vivant')) throw finDeCible
      for (const identifiant of enSuspens.keys()) if (!ids.has(identifiant)) throw faute('MEMBRE_DISPARU_NON_ATTRIBUE')
      restant()
      return vue
    }
    const attribuer = (p, destination) => {
      const engagement = engagements.get(p.identifiant)
      if (engagement && JSON.stringify(engagement) !== JSON.stringify(destination)) throw erreur('attribution native contradictoire')
      resultatControle('attribuer', () => controle.attribuer({ identifiant: p.identifiant, pid: p.pid, creation: p.creation, destination }, { timeout: restant() }))
      engagements.set(p.identifiant, destination)
      enSuspens.delete(p.identifiant)
    }
    let vue
    while (true) {
      vue = capturer()
      for (const nom of readdirSync(join(dossier, 'emissions')).filter((n) => n.endsWith('.json'))) {
        const e = lireJson(join(dossier, 'emissions', nom))
        if (e.version !== 1 || e.generation !== generation || typeof e.id !== 'string' || !/^[0-9a-f-]{36}$/.test(e.id) || nom !== e.id + '.json' || !Number.isInteger(e.pid) || e.pid <= 0)
          throw erreur('émission mémoire invalide')
        if (emissions.has(e.id) || nouvelles.has(e.id)) continue
        const p = vue.processus.find((m) => m.pid === e.pid)
        if (!p || p.etat !== 'vivant') throw erreur('émission sans instance native vivante')
        const nonce = randomBytes(32).toString('hex'), base = join(dossier, 'emissions', e.id)
        const identite = { identifiant: p.identifiant, pid: p.pid, creation: p.creation }
        publier(join(base + '.challenges', nonce + '.json'), { version: 1, generation, id: e.id, identifiant: p.identifiant, nonce })
        nouvelles.set(e.id, { ...e, nonce, base, identite })
      }
      for (const e of nouvelles.values()) {
        const p = vue.processus.find((m) => m.identifiant === e.identite.identifiant && m.pid === e.identite.pid && m.creation === e.identite.creation)
        if (!p || p.etat !== 'vivant') throw erreur('instance native modifiée avant acquittement')
        while (!e.repondue) {
          const r = lireJson(e.base + '.' + e.nonce + '.reponse', true)
          if (r && (r.version !== 1 || r.generation !== generation || r.id !== e.id || r.pid !== e.pid || typeof r.nonce !== 'string' || !/^[a-f0-9]{64}$/.test(r.nonce))) throw erreur('réponse de gate invalide')
          if (r?.nonce === e.nonce) {
            if (r.identifiant !== e.identite.identifiant) throw erreur('réponse de gate sans instance capturée')
            e.repondue = true
          } else Atomics.wait(pause, 0, 0, Math.min(5, restant()))
        }
        if (p.pid === pid && (p.role === 'cible' || p.role === null)) attribuer(e.identite, { type: 'parent' })
        else if (p.entreeId !== null) {
          if (!entrees.has(p.entreeId)) throw erreur('entrée native inconnue')
        } else if (p.role !== null) throw erreur('émission infrastructure inattendue')
        else {
          const inspection = mesurer({ pids: [p.pid], pidsAInspecter: [p.pid], memoireSeulement: true, timeout: restant() })
          if (inspection?.code === 'MESURE_PROCESSUS_EXPIREE' && Object.hasOwn(inspection, 'indeterminee')) throw expiration(inspection.indeterminee)
          if (!inspection || Object.hasOwn(inspection, 'indeterminee') || inspection.expiree || !Array.isArray(inspection.processus)) throw erreur('inspection initiale indéterminée')
          const correspondants = inspection.processus.filter((m) => m.pid === p.pid && creationExacte(platform === 'win32' ? m.creationNative : m.creation) === creationExacte(p.creation))
          const m = correspondants[0]
          if (correspondants.length !== 1 || !m.cwd || !m.commande || m.erreurs?.length) throw erreur('inspection initiale sans identité exacte')
          const argv = m.argv ?? argumentsProcessus(m.commande, platform)
          const cheminsLus = new Set(argv.filter((a) => a && !a.startsWith('-')).map((a) => canonique(a, m.cwd)))
          const trouves = candidats.filter((c) => cheminsLus.has(c.chemin))
          if (trouves.length !== 1) throw erreur('association initiale non unique : ' + trouves.length + ' candidats')
          attribuer(e.identite, { type: 'entree', id: trouves[0].id })
        }
      }
      if (nouvelles.size) vue = capturer()
      if (!enSuspens.size) break
      Atomics.wait(pause, 0, 0, Math.min(5, restant()))
    }
    const sommes = new Map(), roles = new Set()
    let sommeParent = 0
    for (const p of vue.processus) {
      if (p.role !== null) {
        if (roles.has(p.role)) throw erreur('infrastructure native dupliquée')
        roles.add(p.role)
        sommeParent += p.residentOctets
        if (!Number.isSafeInteger(sommeParent)) throw erreur('somme working-set parent invalide')
      } else {
        const fichier = entrees.get(p.entreeId), somme = (sommes.get(fichier) ?? 0) + p.residentOctets
        if (!Number.isSafeInteger(somme)) throw erreur('somme working-set entrée invalide')
        sommes.set(fichier, somme)
      }
    }
    if (!roles.has('hote') || !roles.has('worker') || !roles.has('cible')) throw erreur('infrastructure native absente')
    for (const e of nouvelles.values()) {
      const p = vue.processus.find((m) => m.identifiant === e.identite.identifiant && m.pid === e.identite.pid && m.creation === e.identite.creation)
      if (!p || p.etat !== 'vivant') throw erreur('instance native modifiée avant acquittement')
    }
    restant()
    const prochains = new Map(emissions)
    for (const e of nouvelles.values()) prochains.set(e.id, e.nonce)
    if (nouvelles.size) {
      publier(join(dossier, 'acquittements', randomUUID() + '.json'), { version: 1, generation, emissions: Object.fromEntries(prochains) })
      restant()
    }
    for (const [id, nonce] of prochains) emissions.set(id, nonce)
    parentOctets = Math.max(parentOctets, sommeParent)
    metrique = vue.metriqueMemoire
    for (const [fichier, somme] of sommes) pics.set(fichier, Math.max(pics.get(fichier) ?? 0, somme))
    valides++
    cibleAcquittee ||= [...engagements.values()].some((d) => d.type === 'parent')
  }
  return {
    get defaut() { return defaut },
    get cloturee() { return cloturee },
    get qualite() { return qualite() },
    echantillonner() {
      if (defaut || cloturee) return
      try { observer() } catch (cause) {
        if (cause === finDeCible || (controle.estFermeture?.(cause) === true && controle.phase === 'cloture')) {
          cloturee = true
          return
        }
        rejets = Math.min(Number.MAX_SAFE_INTEGER, rejets + 1)
        premiereCause ??= cause
        if (!expirations.has(cause)) defaut = Object.assign(erreur('collecte impossible : ' + cause.message), { cause })
      }
    },
    terminer() {
      if (defaut) throw defaut
      if (enSuspens.size || readdirSync(join(dossier, 'emissions')).some((n) => n.endsWith('.json') && !emissions.has(n.slice(0, -5)))) throw erreur('émission mémoire non acquittée')
      const absents = fichiers.filter((f) => !pics.get(f))
      if (absents.length || !parentOctets || !metrique) {
        resultatQualite = 'incomplete'
        throw Object.assign(erreur('observation absente : ' + absents.join(', ')), premiereCause ? { cause: premiereCause } : {})
      }
      resultatQualite = 'complete'
      return { parentOctets, metrique, pics: Object.fromEntries(pics), qualite: qualite() }
    },
  }
}

/** Les arguments `node --test` des `fichiers` sous `argv`, toute `--test-concurrency` remplacée par
 *  `CONCURRENCE_SANS_PROFIL`. PURE. */
const aConcurrenceSansProfil = (argv, fichiers) => {
  const sansConcurrence = []
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--test-concurrency') i++
    else if (!argv[i].startsWith('--test-concurrency=')) sansConcurrence.push(argv[i])
  }
  return [...sansConcurrence.filter((a) => a !== '--test'), '--test', '--test-concurrency=' + CONCURRENCE_SANS_PROFIL, ...fichiers]
}

/** Le lancement `node --test` des `fichiers` (#2586). Sous win32, mesuré : profils (`profilsDuLancement`), admission
 *  ou acquisition, collecte (`collecterMemoire`). Sous toute autre `platform`, l'hôte ne sert aucune vue : lancement
 *  à `CONCURRENCE_SANS_PROFIL`, rien d'appris, raison au journal ; `forcer` y échoue fermé en `ENONSUPPORTE`
 *  (#2586 c.6245552712). */
export async function lancerNodeMesure({ racine, fichiers, argv = [], env = process.env, signal, mesures, forcer = false,
  journal = console.log, platform = process.platform }) {
  const limiteMs = 30 * 60_000
  const diffuser = async (...argumentsSupervision) => {
    const lancement = await lancerProcessusSupervise(...argumentsSupervision)
    lancement.hote.stdout?.on('data', (d) => process.stdout.write(d))
    lancement.hote.stderr?.on('data', (d) => process.stderr.write(d))
    return lancement
  }
  if (platform !== 'win32') {
    if (forcer) {
      const error = Object.assign(new Error('--reacquerir-memoire : mesure mémoire indisponible sous ' + platform), { code: 'ENONSUPPORTE' })
      journal('[memoire] ENONSUPPORTE : ' + error.message)
      return { code: 2, error, refus: error.code, arret: { etat: 'mort', erreurs: [] } }
    }
    journal('[memoire] mesure indisponible sous ' + platform + ', concurrence fixe ' + CONCURRENCE_SANS_PROFIL + ' : ' + fichiers.join(', '))
    const dossier = mkdtempSync(join(env.WFRP_MEMOIRE_DOSSIER ?? tmpdir(), 'wfrp-node-'))
    let resultat
    try {
      resultat = await spawnBorne({ argv: aConcurrenceSansProfil(argv, fichiers), cwd: racine, env, signal, limiteMs,
        fichier: join(dossier, 'lancement.log'), maxBuffer: 16 * 2 ** 20, superviser: diffuser })
      return { ...resultat, concurrence: CONCURRENCE_SANS_PROFIL }
    } finally {
      if (!resultat || resultat.arret?.etat === 'mort') rmSync(dossier, { recursive: true, force: true, maxRetries: 3, retryDelay: 25 })
    }
  }
  try { environnementDeLaMesure(env, argv, racine) } catch (error) { return { code: 2, error, refus: error.code, arret: { etat: 'mort', erreurs: [] } } }
  const profils = profilsDuLancement({ racine, fichiers, argv, env, mesures })
  const acquisition = forcer || profils.entrees.some((e) => !e.utilisable)
  const parentOctets = Math.max(0, ...profils.entrees.map((e) => e.historique?.parentOctets ?? 0))
  const disponible = () => ({ disponibleOctets: memoireDisponibleMo(env) * 2 ** 20, cpus: coeurs(env, availableParallelism) })
  const mo = (octets) => Math.round(octets / 2 ** 20)
  // #2586
  const refuser = (admission, disponibleOctets) => ({ code: admission.refus === 'MEMOIRE_INSUFFISANTE' ? CODE_DIFFERE : 2, refus: admission.refus, admission,
    message: '[memoire] ' + admission.refus + ' : minimum ' + mo(admission.minimumOctets) + ' Mo, disponible ' + mo(disponibleOctets) + ' Mo',
    arret: { etat: 'mort', erreurs: [] } })
  let args
  let concurrence
  if (acquisition) {
    const historiques = profils.entrees.map((e) => e.historique).filter((h) => Number.isSafeInteger(h?.picOctets) && h.picOctets > 0)
    if (historiques.length) {
      const { disponibleOctets, cpus } = disponible()
      const admission = admissionNode(cpus, disponibleOctets, { profils: historiques, parentOctets, nombre: fichiers.length })
      if (admission.refus) {
        journal('[memoire] admission Node (acquisition) : ' + JSON.stringify(admission))
        return refuser(admission, disponibleOctets)
      }
    }
    concurrence = CONCURRENCE_SANS_PROFIL
    args = aConcurrenceSansProfil(argv, fichiers)
    journal('[memoire] acquisition utile en concurrence ' + concurrence + ' : ' + profils.entrees.filter((e) => forcer || !e.utilisable).map((e) => e.fichier).join(', '))
  } else {
    const mesure = disponible()
    const admission = admettreLancementNode({ fichiers, argv, parentOctets,
      profils: profils.entrees.map((e) => e.historique), ...mesure })
    journal('[memoire] admission Node : ' + JSON.stringify(admission, (k, v) => k === 'argv' ? undefined : v))
    if (admission.refus) return refuser(admission, mesure.disponibleOctets)
    concurrence = admission.concurrence
    args = [...admission.argv, ...fichiers]
  }
  if (signal?.aborted) return { code: 1, annulee: true, arret: { etat: 'mort', erreurs: [] } }
  const dossier = mkdtempSync(join(env.WFRP_MEMOIRE_DOSSIER ?? tmpdir(), 'wfrp-memoire-'))
  const generation = randomUUID()
  mkdirSync(join(dossier, 'emissions'))
  mkdirSync(join(dossier, 'acquittements'))
  let collecte
  let minuterie
  let resultat
  let controle
  const annulationCollecte = new AbortController()
  const signalCompose = signal ? AbortSignal.any([signal, annulationCollecte.signal]) : annulationCollecte.signal
  let defautSignale = false
  try {
    resultat = await spawnBorne({ argv: args, cwd: racine,
      env: { ...environnementDeLaMesure(env, args, racine), WFRP_MEMOIRE_DOSSIER: dossier, WFRP_MEMOIRE_GENERATION: generation },
      signal: signalCompose, limiteMs, fichier: join(dossier, 'lancement.log'), maxBuffer: 16 * 2 ** 20,
      superviser: diffuser,
      surControle: (vu) => { controle = vu },
      surPid: (pidCible) => {
        collecte = collecterMemoire({ controle, pid: pidCible, fichiers, racine, dossier, generation })
        const echantillonner = () => {
          if (controle.phase !== 'execution') { clearInterval(minuterie); return }
          collecte.echantillonner()
          if (collecte.cloturee) { clearInterval(minuterie); return }
          if (collecte.defaut && !defautSignale) {
            defautSignale = true
            journal('[memoire] défaut initial : ' + JSON.stringify(diagnosticDuLancement({ defautCollecte: collecte.defaut })))
            annulationCollecte.abort(collecte.defaut)
          }
        }
        echantillonner()
        if (!collecte.defaut) minuterie = setInterval(echantillonner, 100)
      } })
    clearInterval(minuterie)
    if (resultat.annulee || resultat.expiree || resultat.arret?.etat !== 'mort' || resultat.error) throw Object.assign(erreur('lancement interrompu ou arrêt non confirmé'), { cause: collecte?.defaut ?? resultat.error })
    if (profils.entrees.some((e) => empreinte(lire(resolve(racine, e.fichier))) !== e.blob)) throw erreur('source modifiée pendant la mesure')
    if (!collecte) throw erreur('cible non capturée')
    const observe = collecte.terminer()
    const date = new Date().toISOString()
    const entrees = Object.fromEntries(profils.entrees.map((e) => [e.cle, { fichier: e.fichier, blob: e.blob,
      contrat: CONTRAT, toolchain: profils.toolchain, picOctets: observe.pics[e.fichier], parentOctets: observe.parentOctets,
      date, metrique: observe.metrique, descendantsInclus: true, qualite: observe.qualite, portee: 'maximum résident historique échantillonné du domaine natif attribué par entrée ; échantillons rejetés=' + observe.qualite.rejets }]))
    if (profils.configurationConnue) profils.mesures.ecrire(PROFILS, entrees, (anciens, nouveaux) => {
      const fusion = { ...anciens }
      for (const [cle, profil] of Object.entries(nouveaux)) fusion[cle] = { ...profil,
        picOctets: forcer ? profil.picOctets : Math.max(profil.picOctets, anciens[cle]?.picOctets ?? 0),
        parentOctets: forcer ? profil.parentOctets : Math.max(profil.parentOctets, anciens[cle]?.parentOctets ?? 0) }
      return fusion
    })
    journal('[memoire] observation Node : ' + JSON.stringify(observe))
    return { ...resultat, acquisition, concurrence, memoire: observe }
  } catch (cause) {
    clearInterval(minuterie)
    const arret = resultat ? resultat.arret : controle && await tuerArbre(controle, cause)
    const rendu = { ...resultat, code: resultat?.code || 1, error: cause, arret, acquisition, concurrence, defautCollecte: collecte?.defaut, qualiteCollecte: collecte && { ...collecte.qualite, resultat: 'incomplete' } }
    const diagnostic = { ...diagnosticDuLancement({ ...rendu, dossier }), qualiteCollecte: rendu.qualiteCollecte }
    journal('[memoire] MESURE_MEMOIRE_INCOMPLETE : ' + cause.message)
    diagnosticArret(rendu, journal, '[memoire] ')
    journal('[memoire] diagnostic lancement : ' + JSON.stringify(diagnostic))
    try {
      const fichier = join(dossier, 'diagnostic-arret')
      ecrireJsonAtomique(fichier, diagnostic)
      if (resultat && resultat.arret?.etat !== 'mort') {
        rendu.diagnostic = fichier
        journal('[memoire] diagnostic conservé : ' + fichier)
      }
    } catch (causeEcriture) {
      journal('[memoire] échec écriture diagnostic : ' + JSON.stringify(diagnosticDuLancement({ error: causeEcriture }).error))
    }
    return rendu
  } finally {
    clearInterval(minuterie)
    if (resultat?.arret?.etat === 'mort' || !controle) rmSync(dossier, { recursive: true, force: true, maxRetries: 3, retryDelay: 25 })
  }
}
