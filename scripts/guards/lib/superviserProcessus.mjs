import { spawn } from 'node:child_process'
import { accessSync, constants, existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { StringDecoder } from 'node:string_decoder'
import { createServer } from 'node:net'
import { randomUUID } from 'node:crypto'
import { ancetresValidesDe, gardienDisparu, mesurerArbreProcessus } from './arbreProcessus.mjs'
import { arretIndetermine, texteDeCause } from './arretNatif.mjs'
import { ecrireJsonAtomique, lireTextePublie, publierJsonSiAbsent } from './ecritureJsonAtomique.mjs'
import { LANCEMENTS_SUPERVISES, relancerApresNettoyage } from './controleEcritures.mjs'
import { citerArgv } from './lancerDetache.mjs'
// Clôture statique chargeable sous un Node refusé : scripts/node-requis.mjs (#1801).
const { tableTotale } = await import('../../../src/lib/tableTotale.ts')

const DELAI_IPC = 15000
/** Mesures consécutives en échec à partir desquelles l'indétermination interrompt le hook (#2626). */
const MESURES_INDETERMINEES_MAX = 20
const erreur = (code, message) => Object.assign(new Error(message), { code })
const erreurMesure = (cause, message = cause.message) => Object.assign(new Error(message, { cause }), {
  code: 'EMESURE', codeMesure: cause.code, categorie: cause.categorie,
})
const publierErreur = (cause) => ({ code: cause?.code ?? 'ECONTROLE', message: texteDeCause(cause),
  ...(cause?.code === 'EMESURE' ? { codeMesure: cause.codeMesure, categorie: cause.categorie, cause: { code: cause.cause?.code, categorie: cause.cause?.categorie, message: cause.cause?.message } } : {}),
})
function promesse() {
  let resoudre
  let rejeter
  const attente = new Promise((ok, non) => { resoudre = ok; rejeter = non })
  return { attente, resoudre, rejeter }
}
const pauseSynchrone = new Int32Array(new SharedArrayBuffer(4))
const raisonAnnulation = (signal) => signal.reason instanceof Error && typeof signal.reason.code === 'string' ? signal.reason : erreur('ABORT_ERR', 'lancement annulé')
const SIGNAUX_DU_PROCESSUS = ['SIGINT', 'SIGTERM', 'SIGHUP']
const interruptionsActives = new Set()
const relaisDeSignal = tableTotale(SIGNAUX_DU_PROCESSUS, (nom) => () => { for (const interrompre of interruptionsActives) interrompre(nom) })

/** Abonne `interrompre(nom)` aux signaux du processus par UN écouteur par signal, partagé par tous les lancements
 *  en cours ; REND le désabonnement (#2586). */
function ecouterSignauxDuProcessus(interrompre) {
  if (!interruptionsActives.size) for (const nom of SIGNAUX_DU_PROCESSUS) process.on(nom, relaisDeSignal[nom])
  interruptionsActives.add(interrompre)
  return () => {
    if (interruptionsActives.delete(interrompre) && !interruptionsActives.size) for (const nom of SIGNAUX_DU_PROCESSUS) process.off(nom, relaisDeSignal[nom])
  }
}

function interpreteurHote() {
  if (process.platform === 'win32') {
    if (!process.env.SystemRoot) throw erreur('EPREREQUIS', 'prérequis supervision Windows absent : SystemRoot')
    return join(process.env.SystemRoot, process.arch === 'ia32' ? 'Sysnative' : 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
  }
  if (process.platform !== 'linux') throw erreur('EPREREQUIS', 'supervision non supportée : ' + process.platform)
  for (const dossier of (process.env.PATH ?? '').split(delimiter)) {
    const candidat = resolve(dossier || process.cwd(), 'python3')
    try { accessSync(candidat, constants.X_OK); return realpathSync(candidat) } catch {}
  }
  throw erreur('EPREREQUIS', 'prérequis supervision Linux absent : Python3')
}

function resultatValide(vu) {
  return vu && (vu.status === null || Number.isInteger(vu.status)) &&
    (vu.signal === null || typeof vu.signal === 'string') &&
    (!vu.error || (typeof vu.error.code === 'string' && typeof vu.error.message === 'string'))
}

/**
 * Lance `commande` sous l'hôte natif de supervision (Job Windows, subreaper Linux) et rend `{ hote, controle }` dès
 * l'hôte lancé. `controle` : `pret`, `fin` (`{ resultatCible, arret }`), `finPhysique`, `mesurerDomaine`,
 * `attribuer`, `demanderArret`, `estFermeture` ; sous Linux, `mesurerDomaine` et `attribuer` lèvent `ENONSUPPORTE` et
 * arrêtent le lancement (#2586 c.6244746949). `surveillerGit` : les gardiens (parent, ancêtres git) jugés par la
 * vue native du processus, puis par leur identité de création quand la mesure échoue (#2586, #2626). Tout refus
 * précède l'hôte ; un `cwd` qui n'est pas un dossier existant se refuse en le nommant (#2586).
 * @param {string} commande @param {string[]} [args] @param {Record<string, any>} [options]
 */
export async function lancerProcessusSupervise(commande, args = [], options = {}) {
  const { cwd = process.cwd(), env, shell = false, stdio = ['pipe', 'pipe', 'pipe'], timeout, signal,
    surveillerGit = false, delaiArretMs = 2000 } = options
  if (!Number.isFinite(delaiArretMs) || delaiArretMs <= 0 || delaiArretMs > 2147483647) throw erreur('BORNE_INVALIDE', 'delaiArretMs invalide')
  const delaiNatif = Math.ceil(delaiArretMs)
  if (timeout !== undefined && (!Number.isFinite(timeout) || timeout < 0 || timeout > 2147483647)) throw erreur('BORNE_INVALIDE', 'timeout invalide')
  if (!statSync(cwd, { throwIfNoEntry: false })?.isDirectory()) throw erreur('ENOENT', 'dossier de travail absent : ' + cwd)
  if (signal?.aborted) throw raisonAnnulation(signal)
  let vueInitiale = []
  if (surveillerGit) {
    try { vueInitiale = mesurerArbreProcessus() } catch (e) { throw erreurMesure(e) }
  }
  const interpreteur = interpreteurHote()
  const ancetres = ancetresValidesDe(process.pid, vueInitiale)
  const parent = ancetres[0]
  const git = ancetres.filter((p) => /(?:^|[\\/])git(?:\.exe)?$/i.test(p.nom))
  if (surveillerGit && parent?.pid !== process.ppid) throw erreur('EPARENT', 'parent disparu avant démarrage du hook')
  if (surveillerGit && !git.length) throw erreur('EPARENT', 'ancêtre git absent avant démarrage du hook')
  const gardiens = parent ? [parent, ...git] : []
  let transaction; let dossier
  try {
    transaction = LANCEMENTS_SUPERVISES.preparer(commande, args, { cwd, env, shell })
    dossier = mkdtempSync(join(tmpdir(), 'wfrp-supervision-'))
  } catch (e) { relancerApresNettoyage(e, () => transaction?.nettoyer()) }
  const generation = randomUUID()
  const jeton = randomUUID()
  const adresse = process.platform === 'win32' ? '\\\\.\\pipe\\wfrp-supervision-' + jeton : join(dossier, 'controle.sock')
  let hote; let canal; let resultat; let instanceCible; let pid = null; let interruption = null; let clos = false; let eof = false
  let fermeHote; let canalTermine = false; let clotureDefaillante = false; let resultatPublie
  let requeteActive = false; let serveur; let intervalle; let borne; let connexion; let attenteCloture; let clotureDemandee = false
  const pret = promesse(); const finCanal = promesse(); const finHote = promesse(); const defautCloture = promesse(); const decision = promesse()
  pret.attente.catch(() => {})
  const sockets = new Set()
  const detachements = []
  const fermetures = new WeakSet()
  const enCloture = () => clos || clotureDemandee || existsSync(join(dossier, 'cloture.json'))
  const expiration = (operation, message) => Object.assign(erreur('ETIMEDOUT', message), { origine: 'controle-natif', operation, expiree: true })
  const fermeture = (operation) => {
    const cause = Object.assign(erreur('FERMETURE', 'domaine en clôture'), { origine: 'controle-natif', operation, terminale: true, expiree: false })
    fermetures.add(cause)
    return cause
  }
  const finirCanal = () => { canalTermine = true; finCanal.resoudre() }
  const detacherCanaux = () => { for (const socket of sockets) socket.destroy(); finirCanal() }
  const refuserCloture = (cause) => {
    if (clos || clotureDefaillante) return
    clotureDefaillante = true
    interruption ??= cause
    clearInterval(intervalle)
    defautCloture.resoudre(cause)
    if (fermeHote) detacherCanaux()
  }
  const cloture = () => {
    const chemin = join(dossier, 'cloture.json')
    publierJsonSiAbsent(chemin, { version: 1, generation, echeance: Date.now() + delaiNatif })
    const valeur = JSON.parse(readFileSync(chemin, 'utf8'))
    if (valeur.version !== 1 || valeur.generation !== generation || !Number.isSafeInteger(valeur.echeance)) throw erreur('ECONTROLE', 'clôture native incohérente')
    return valeur.echeance
  }
  const demanderArret = (cause) => {
    if (clos) return
    clotureDemandee = true
    if (cause && !interruption) interruption = cause instanceof Error ? cause : erreur('EINTR', texteDeCause(cause))
    try {
      const echeance = cloture()
      if (!attenteCloture) attenteCloture = setTimeout(() => {
        setImmediate(() => setImmediate(() => {
          if (clos || (fermeHote && canalTermine)) return
          refuserCloture(erreur('ECONTROLE', 'échéance native atteinte avant fermeture complète de l’hôte et du canal'))
        }))
      }, Math.max(0, echeance - Date.now()))
      return echeance
    }
    catch (causeCloture) {
      interruption = erreur('ECONTROLE', causeCloture.message)
      refuserCloture(interruption)
      detacherCanaux()
    }
  }
  const faute = (message, code = 'ECONTROLE') => demanderArret(erreur(code, message))
  const echanger = (operation, donnees, { timeout: delai = 2000 } = {}) => {
    if (enCloture()) throw fermeture(operation)
    if (pid === null) throw erreur('ECONTROLE', 'domaine non disponible avant cible')
    if (requeteActive) throw erreur('ECONTROLE', 'requête native déjà en cours')
    if (!Number.isFinite(delai) || delai < 0 || delai > 2147483647) throw erreur('BORNE_INVALIDE', 'timeout de requête natif invalide')
    if (delai === 0) throw expiration(operation, 'échéance de requête native épuisée')
    requeteActive = true
    const id = randomUUID()
    const echeance = Date.now() + Math.ceil(delai)
    const reponse = join(dossier, 'reponses', id + '.json')
    try {
      ecrireJsonAtomique(join(dossier, 'requetes', id + '.json'), { version: 1, generation, id, operation, echeance, ...donnees }, {
        attendre: (ms) => {
          const reste = echeance - Date.now()
          if (reste <= 0) throw expiration(operation, 'échéance de publication de requête native épuisée')
          Atomics.wait(pauseSynchrone, 0, 0, Math.min(ms, reste))
          if (Date.now() >= echeance) throw expiration(operation, 'échéance de publication de requête native épuisée')
        },
      })
      const lireReponse = () => {
        try { return lireTextePublie(reponse) } catch { throw erreur('ECONTROLE', 'réponse native illisible') }
      }
      let texte
      while ((texte = lireReponse()) === undefined) {
        if (existsSync(join(dossier, 'cloture.json'))) throw fermeture(operation)
        const reste = echeance - Date.now()
        if (reste <= 0) throw expiration(operation, 'échéance de requête native épuisée')
        Atomics.wait(pauseSynchrone, 0, 0, Math.min(5, reste))
      }
      let vue
      try { vue = JSON.parse(texte) } catch { throw erreur('ECONTROLE', 'réponse native illisible') }
      if (vue.version !== 1 || vue.generation !== generation || vue.id !== id || typeof vue.ok !== 'boolean') throw erreur('ECONTROLE', 'réponse native incohérente')
      if (!vue.ok) {
        if (typeof vue.error?.code !== 'string' || typeof vue.error?.message !== 'string') throw erreur('ECONTROLE', 'erreur native malformée')
        if (vue.error.code === 'FERMETURE') {
          if (!enCloture()) throw erreur('ECONTROLE', 'réponse de fermeture sans clôture publiée')
          throw fermeture(operation)
        }
        throw Object.assign(erreur(vue.error.code, vue.error.message), { origine: 'controle-natif', operation,
          expiree: ['ETIMEDOUT', 'EXPIRATION'].includes(vue.error.code) })
      }
      if (operation === 'vue' && (!vue.vue || !Array.isArray(vue.vue.processus) || typeof vue.vue.metriqueMemoire !== 'string')) throw erreur('ECONTROLE', 'vue native malformée')
      if (Date.now() > echeance) throw expiration(operation, 'réponse native après échéance de requête')
      return operation === 'vue' ? vue.vue : vue
    } catch (cause) {
      if (!cause.expiree && !fermetures.has(cause)) demanderArret(cause)
      throw cause
    } finally { requeteActive = false }
  }
  const controle = {
    get pid() { return pid },
    get phase() { return clos ? 'termine' : enCloture() ? 'cloture' : pid === null ? 'demarrage' : 'execution' },
    estFermeture: (cause) => !!cause && typeof cause === 'object' && fermetures.has(cause),
    pret: pret.attente,
    demanderArret: (cause) => demanderArret(cause ?? erreur('EINTR', 'arrêt demandé')),
    mesurerDomaine: (optionsRequete) => echanger('vue', {}, optionsRequete),
    attribuer: ({ identifiant, pid: pidInstance, creation, destination }, optionsRequete) => echanger('attribuer', { identifiant, pid: pidInstance, creation, destination }, optionsRequete),
  }
  try {
    mkdirSync(join(dossier, 'requetes'))
    mkdirSync(join(dossier, 'reponses'))
    ecrireJsonAtomique(join(dossier, 'configuration.json'), { version: 1, generation, delaiArretMs: delaiNatif })
    const sourceLien = join(dossier, 'preuve-lien')
    const cibleLien = join(dossier, 'preuve-lien-destination')
    writeFileSync(sourceLien, '', { flag: 'wx' })
    linkSync(sourceLien, cibleLien)
    rmSync(sourceLien)
    rmSync(cibleLien)
    serveur = createServer((socket) => {
      sockets.add(socket)
      socket.setEncoding('utf8')
      let tampon = ''; let authentifie = false
      socket.once('close', () => {
        sockets.delete(socket)
        if (socket === canal) {
          if (!socket.readableEnded) faute('canal worker fermé avant EOF')
          finirCanal()
        }
      })
      socket.on('error', (e) => { if (socket === canal) { faute('canal worker : ' + e.message); finirCanal() } })
      socket.on('end', () => {
        if (socket !== canal) return
        if (tampon.length) faute('message IPC tronqué à EOF')
        else if (!resultat) faute('EOF du worker avant résultat')
        else eof = true
        finirCanal()
      })
      socket.on('data', (texte) => {
        tampon += texte
        if (tampon.length > 1024 * 1024) { faute('message IPC trop grand'); socket.destroy(); return }
        for (;;) {
          const fin = tampon.indexOf('\n')
          if (fin < 0) break
          let message
          try { message = JSON.parse(tampon.slice(0, fin)) }
          catch { faute('message IPC malformé'); socket.destroy(); return }
          tampon = tampon.slice(fin + 1)
          if (!authentifie) {
            if (canal || message.type !== 'pret' || message.jeton !== jeton) { socket.destroy(); return }
            authentifie = true; canal = socket
            clearTimeout(connexion)
            if (clotureDemandee || interruption) { socket.destroy(); return }
            socket.write(JSON.stringify({ type: 'options', options: { commande, args: transaction.args, ...transaction.options } }) + '\n')
          } else if (message.type === 'cible' && pid === null && Number.isSafeInteger(message.pid) && message.pid > 0 && typeof message.instanceCible === 'string' && message.instanceCible.length) {
            pid = message.pid; instanceCible = message.instanceCible
            pret.resoudre({ pidCible: pid, instanceCible })
          } else if (message.type === 'resultat' && !resultat && resultatValide(message.resultat) &&
            (pid === null ? message.resultat.error && message.instanceCible == null : message.instanceCible === instanceCible && message.resultat.pid === pid)) {
            resultat = message.resultat
            demanderArret()
          } else faute('résultat IPC invalide', 'ERESULTAT')
        }
      })
    })
    serveur.on('error', (e) => faute('serveur IPC : ' + e.message))
    if (timeout !== undefined && timeout > 0) borne = setTimeout(() => faute(`échéance ${timeout} ms`, 'ETIMEDOUT'), timeout)
    const annuler = () => demanderArret(raisonAnnulation(signal))
    signal?.addEventListener('abort', annuler, { once: true })
    detachements.push(() => signal?.removeEventListener('abort', annuler), ecouterSignauxDuProcessus((nom) => faute(nom, 'EINTR')))
    await new Promise((ok, non) => {
      serveur.once('error', non)
      serveur.listen(adresse, () => { serveur.off('error', non); ok() })
    })
    if (signal?.aborted || interruption) throw interruption ?? erreur('ABORT_ERR', 'lancement annulé')
    const worker = fileURLToPath(new URL('./enfantSupervise.mjs', import.meta.url))
    const argv = process.platform === 'win32'
      ? ['-NoLogo', '-NoProfile', '-NonInteractive', '-File', fileURLToPath(new URL('./hoteSupervision.ps1', import.meta.url)), '-Node', process.execPath, '-CommandLine', [process.execPath, worker, adresse, jeton].map(citerArgv).join(' '), '-Worktree', cwd, '-ParentPid', String(process.pid), '-ControlDirectory', dossier, '-DelaiArretMs', String(delaiNatif)]
      : [fileURLToPath(new URL('./hoteSupervision.py', import.meta.url)), String(process.pid), process.execPath, worker, adresse, jeton, dossier, String(delaiNatif)]
    hote = spawn(interpreteur, argv, { cwd, windowsHide: true, stdio })
    let erreurHote
    hote.once('close', (status, signalHote) => {
      fermeHote = { status, signal: signalHote, erreur: erreurHote }
      finHote.resoudre(fermeHote)
      if (clotureDefaillante) detacherCanaux()
      else if (!canal) { faute('hôte fermé avant authentification du worker'); finirCanal() }
      else demanderArret()
    })
    hote.on('error', (e) => { erreurHote = e; faute(e.message, e.code ?? 'EHOTE') })
    connexion = setTimeout(() => faute('échéance de connexion du worker'), DELAI_IPC)
    let echecs = 0
    if (surveillerGit) intervalle = setInterval(() => {
      let vue = null; let echec
      try { vue = mesurerArbreProcessus(); echecs = 0 } catch (e) { echec = e; echecs += 1 }
      if (gardiens.some((gardien) => gardienDisparu(gardien, vue))) faute('parent disparu', 'EPARENT')
      else if (echecs >= MESURES_INDETERMINEES_MAX) demanderArret(erreurMesure(echec, `${echecs} mesures consécutives indéterminées : ${echec.message}`))
    }, 250)
    const complet = Promise.all([finHote.attente, finCanal.attente])
    controle.finPhysique = (async () => {
      await complet
      await decision.attente
      clos = true
      clearInterval(intervalle); clearTimeout(borne); clearTimeout(connexion); clearTimeout(attenteCloture)
      for (const detacher of detachements.splice(0)) detacher()
      for (const socket of sockets) socket.destroy()
      if (serveur.listening) await new Promise((ok) => serveur.close(ok))
      try { transaction.finaliser(resultatPublie?.resultatCible.status ?? null) }
      catch (e) { if (resultatPublie && !resultatPublie.resultatCible.error) resultatPublie.resultatCible.error = { code: 'ECONTROLE', message: e.message } }
      try { rmSync(dossier, { recursive: true, force: true, maxRetries: 3, retryDelay: 25 }) }
      catch (e) { if (resultatPublie && !resultatPublie.resultatCible.error) resultatPublie.resultatCible.error = { code: 'ECONTROLE', message: e.message } }
    })()
    controle.finPhysique.catch(() => {})
    controle.fin = (async () => {
      let completDansBorne = false
      try {
        const terminaison = await Promise.race([complet.then(([ferme]) => ({ ferme })), defautCloture.attente.then((cause) => ({ cause }))])
        if (terminaison.cause) {
          const arret = arretIndetermine({ operation: 'cloture', pid, cause: terminaison.cause })
          let certificat
          try { certificat = JSON.parse(readFileSync(join(dossier, 'certificat.json'), 'utf8')) } catch {}
          if (certificat?.version === 1 && certificat.generation === generation) Object.assign(arret, { echeance: certificat.echeance, methode: certificat.methode, zeroNatif: certificat.zero === true })
          resultatPublie = { resultatCible: { ...(resultat ?? { status: null, signal: null }), error: publierErreur(interruption ?? terminaison.cause) }, arret }
          return resultatPublie
        }
        completDansBorne = true
        const ferme = terminaison.ferme
        if (!resultat) interruption ??= erreur('ERESULTAT', 'résultat worker absent')
        if (!eof) interruption ??= erreur('ECONTROLE', 'EOF authentifié du worker absent')
        if (ferme.erreur) interruption ??= ferme.erreur
        if (ferme.status !== 0) interruption ??= erreur('EHOTE', 'hôte sorti sans nettoyage confirmé : ' + (ferme.status ?? ferme.signal))
        let certificat; let fermeture
        try {
          const lu = JSON.parse(readFileSync(join(dossier, 'certificat.json'), 'utf8'))
          fermeture = JSON.parse(readFileSync(join(dossier, 'cloture.json'), 'utf8'))
          if (fermeture.version !== 1 || fermeture.generation !== generation || !Number.isSafeInteger(fermeture.echeance) || lu.version !== 1 || lu.generation !== generation ||
            !['job-windows', 'subreaper-linux'].includes(lu.methode) || lu.echeance !== fermeture.echeance || typeof lu.zero !== 'boolean' || !Array.isArray(lu.erreurs)) throw erreur('ECONTROLE', 'certificat natif incohérent')
          certificat = lu
        } catch (e) { interruption ??= erreur('ECONTROLE', 'certificat natif absent ou invalide : ' + e.message) }
        const mort = !clotureDefaillante && ferme.status === 0 && certificat?.zero === true && certificat.erreurs.length === 0 && !['ECONTROLE', 'ERESULTAT'].includes(interruption?.code)
        const arret = { pid, etat: mort ? 'mort' : 'indetermine', echeance: fermeture?.echeance, methode: certificat?.methode,
          erreurs: mort ? [] : [...(interruption ? [interruption] : []), ...(certificat?.erreurs ?? [])].flatMap((cause) => arretIndetermine({ operation: 'cloture', pid, cause }).erreurs) }
        let resultatCible = resultat ?? { status: null, signal: null }
        if (interruption) resultatCible = { ...resultatCible, error: publierErreur(interruption) }
        resultatCible = { ...resultatCible, status: transaction.finaliser(resultatCible.status) }
        resultatPublie = { resultatCible, arret }
        return resultatPublie
      } finally {
        if (pid === null) pret.rejeter(interruption ?? erreur('ERESULTAT', 'cible absente'))
        decision.resoudre()
        if (completDansBorne) await controle.finPhysique
      }
    })()
    return { hote, controle }
  } catch (e) {
    clearTimeout(borne); clearTimeout(attenteCloture)
    for (const detacher of detachements.splice(0)) detacher()
    for (const socket of sockets) socket.destroy()
    if (serveur?.listening) await new Promise((ok) => serveur.close(ok))
    relancerApresNettoyage(e, () => {
      try { transaction.nettoyer() } finally { rmSync(dossier, { recursive: true, force: true }) }
    })
  }
}

lancerProcessusSupervise.optionsEffectives = LANCEMENTS_SUPERVISES.projeter

/**
 * `lancerProcessusSupervise`, sorties drainées et stdin fermé vide hors `heriter` : rend `{ status, signal, error?, stdout, stderr, arret }` de l'unique
 * `fin` native, et `{ status: null, signal: null, error }` sans `arret` sur un lancement refusé (#2586).
 */
export async function superviserProcessus({ commande, args = [], heriter = false, stdio, ...options }) {
  let stdout = ''; let stderr = ''
  const sortie = new StringDecoder('utf8')
  const erreurs = new StringDecoder('utf8')
  try {
    const { hote, controle } = await lancerProcessusSupervise(commande, args, { ...options, stdio: stdio ?? (heriter ? 'inherit' : ['pipe', 'pipe', 'pipe']) })
    hote.stdout?.on('data', (b) => { stdout += sortie.write(b) })
    hote.stderr?.on('data', (b) => { stderr += erreurs.write(b) })
    if (!heriter) { hote.stdin?.on('error', () => {}); hote.stdin?.end() }
    const { resultatCible, arret } = await controle.fin
    stdout += sortie.end(); stderr += erreurs.end()
    return { ...resultatCible, stdout, stderr, arret }
  } catch (e) { return { status: null, signal: null, stdout, stderr, error: publierErreur(e) } }
}

export function sortieDeSupervision(resultat, journal = process.stderr) {
  if (resultat.error) { journal.write(`[supervision] ${resultat.error.code ? `${resultat.error.code} : ` : ''}${resultat.error.message}\n`); return 1 }
  return resultat.status ?? 1
}

if (import.meta.main) {
  const options = JSON.parse(Buffer.from(process.argv[2], 'base64').toString())
  const resultat = await superviserProcessus(options)
  if (options.heriter) process.exitCode = sortieDeSupervision(resultat)
  else process.stdout.write(JSON.stringify(resultat))
}
