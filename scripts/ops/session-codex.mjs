import { spawn } from 'node:child_process'
import { createHash, timingSafeEqual } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { appendFileSync, mkdirSync, readFileSync, existsSync, openSync, readSync, closeSync, fstatSync } from 'node:fs'
import { stripVTControlCharacters } from 'node:util'
import { createServer, createConnection } from 'node:net'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { prefixeDeRefus } from '../guards/lib/categorieDeRefus.mjs'
import { coupeAuMot } from '../../src/lib/coupeAuMot.mjs'

export const MAX_MESSAGE_CODEX = 64 * 1024
export const ANNEXES_CODEX = Object.freeze({ journalCodex: 'codex.jsonl', stderrCodex: 'codex.stderr.log', socketCodex: 'codex.sock' })
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const refus = (categorie, message, native) => Object.assign(new Error(`${prefixeDeRefus(categorie)} ${message}`), { native })
const empreinte = (s) => createHash('sha256').update(s).digest('hex')
const OUTILS = ['commandExecution', 'fileChange', 'mcpToolCall', 'dynamicToolCall', 'collabAgentToolCall', 'webSearch', 'imageView', 'imageGeneration', 'sleep']
const CHAMPS_OUTILS = Object.freeze({ commandExecution: ['command', 'status'], fileChange: ['status'], mcpToolCall: ['server', 'tool', 'status'], dynamicToolCall: ['tool', 'status'], collabAgentToolCall: ['tool', 'status'], webSearch: [], imageView: [], imageGeneration: ['status'], sleep: [] })
const NOTIFICATIONS_LUES = new Set(['turn/started', 'turn/completed', 'item/started', 'item/completed', 'thread/tokenUsage/updated', 'thread/status/changed', 'error'])
const FORMES_LUES = Object.freeze({ chaine: (v) => typeof v === 'string', booleen: (v) => typeof v === 'boolean', entier: Number.isInteger, tableau: Array.isArray, objet: (v) => v !== null && typeof v === 'object' && !Array.isArray(v) })
const nature = (v) => v === undefined ? 'absent' : v === null ? 'null' : Array.isArray(v) ? 'tableau' : typeof v
function lu(methode, racine, chemin, forme, { nul = false } = {}) {
  const valeur = chemin.split('.').reduce((o, k) => (o !== null && typeof o === 'object' ? o[k] : undefined), racine)
  if (nul && (valeur === undefined || valeur === null)) return null
  if (!FORMES_LUES[forme](valeur)) throw refus('panne', `Protocole Codex incompatible : ${methode} ${chemin} attendu ${forme}${nul ? ' ou null' : ''}, reçu ${nature(valeur)}`)
  return valeur
}
function identite(sessionId) {
  if (typeof sessionId !== 'string' || !UUID.test(sessionId)) throw refus('validation', 'sessionId UUID requis')
}
function adresse(dossier, sessionId) {
  identite(sessionId)
  return process.platform === 'win32' ? `\\\\.\\pipe\\wfrp-codex-${sessionId}` : join(dossier, `${sessionId}.${ANNEXES_CODEX.socketCodex}`)
}
function chemins(dossier, sessionId) {
  identite(sessionId)
  return { journal: join(dossier, `${sessionId}.${ANNEXES_CODEX.journalCodex}`), stderr: join(dossier, `${sessionId}.${ANNEXES_CODEX.stderrCodex}`) }
}
export function projeterJournalCodex(journal, echo = process.stdout, diagnostic = () => {}) {
  const bloc = Buffer.alloc(16 * 1024), limiteLecture = 256 * 1024
  let position = 0, morceaux = [], longueur = 0, reprise, threadId, turnId, suspendue = false, fermee = false, ecritures = 0, nettoyage
  const flux = typeof echo === 'function' ? null : echo
  function suspendre(e) {
    if (suspendue) return
    suspendue = true
    clearImmediate(reprise)
    morceaux = []; longueur = 0
    try { diagnostic(e) } catch {}
  }
  function nettoyer() {
    if (fermee && !ecritures && flux) {
      clearImmediate(nettoyage)
      nettoyage = setImmediate(() => flux.off('error', suspendre))
    }
  }
  flux?.on('error', suspendre)
  const afficher = (prefixe, texte = '') => {
    if (suspendue || fermee) return
    const net = stripVTControlCharacters(String(texte)).replace(/[\p{Cc}\p{Cf}]/gu, ' ').replace(/\s+/gu, ' ').trim()
    const ligne = `[Codex] ${prefixe}${net ? ` : ${coupeAuMot(net, 4096)}` : ''}\n`
    if (!flux) echo(ligne)
    else {
      ecritures++
      try {
        flux.write(ligne, (e) => { ecritures--; if (e) suspendre(e); nettoyer() })
      } catch (e) { ecritures--; throw e }
    }
  }
  function projeter(x) {
    const n = x.notification, p = n?.params, item = p?.item
    if (n && Object.hasOwn(n, 'id') && !n.method) {
      if (!threadId && typeof n.result?.thread?.id === 'string') threadId = n.result.thread.id
      if (threadId && typeof n.result?.turn?.id === 'string') turnId = n.result.turn.id
    }
    if (n?.method) {
      if (!threadId || p?.threadId !== threadId) return
      if (p.turnId && (!turnId || p.turnId !== turnId)) return
      if (n.method === 'turn/started' || n.method === 'turn/completed') {
        if (!turnId || p.turn?.id !== turnId) return
      }
    }
    if (n?.method === 'item/completed' && item?.type === 'agentMessage') afficher('Agent', item.text)
    else if ((n?.method === 'item/started' || n?.method === 'item/completed') && OUTILS.includes(item?.type)) {
      const champs = CHAMPS_OUTILS[item.type]
      const detail = champs.filter((k) => k !== 'status').map((k) => item[k]).filter((v) => typeof v === 'string').join(' / ')
      const statut = champs.includes('status') && typeof item.status === 'string' ? item.status : n.method === 'item/started' ? 'inProgress' : 'completed'
      afficher(`Outil ${item.type} [${statut}]`, detail)
    } else if (n?.method === 'turn/completed') { afficher('Fin du tour', p.turn.status); turnId = undefined }
    else if (n?.method === 'error') afficher(p?.willRetry === true ? 'Erreur native réessayée par Codex' : 'Erreur native', p?.error?.message)
    else if (n?.error) afficher('Refus natif', n.error.message)
    else if (x.transition && ['erreur', 'mort', 'fermeture'].includes(x.transition.type)) afficher(x.transition.type, x.transition.cause || x.transition.etat)
    else if (x.erreur) afficher('Erreur', x.erreur)
  }
  function ajouter(partie) {
    if (!partie.length) return
    morceaux.push(Buffer.from(partie)); longueur += partie.length
  }
  function lire() {
    clearImmediate(reprise)
    reprise = undefined
    if (suspendue || fermee) return
    try { lireJournal() } catch (e) { suspendre(e) }
  }
  function lireJournal() {
    if (!existsSync(journal)) return
    const fd = openSync(journal, 'r')
    try {
      const stat = fstatSync(fd)
      if (!stat.isFile()) throw Error('Journal de projection non régulier')
      const taille = stat.size
      let budget = limiteLecture
      while (position < taille && budget > 0) {
        const n = readSync(fd, bloc, 0, Math.min(bloc.length, budget, taille - position), position)
        if (!n) break
        position += n
        budget -= n
        let debut = 0
        for (let i = 0; i < n; i++) if (bloc[i] === 10) {
          ajouter(bloc.subarray(debut, i))
          let entree
          try { entree = JSON.parse(Buffer.concat(morceaux, longueur).toString('utf8')) }
          catch (e) { if (e instanceof SyntaxError) afficher('Journal', 'ligne JSON invalide'); else throw e }
          if (entree !== undefined) projeter(entree)
          morceaux = []; longueur = 0; debut = i + 1
        }
        ajouter(bloc.subarray(debut, n))
      }
      if (position < taille) reprise = setImmediate(lire)
    } finally { closeSync(fd) }
  }
  lire.fermer = () => { fermee = true; clearImmediate(reprise); morceaux = []; longueur = 0; nettoyer() }
  return lire
}
function lireTransitions(dossier, sessionId) {
  const p = chemins(dossier, sessionId).journal
  if (!existsSync(p)) return []
  try {
    const transitions = readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((x) => x.transition).map((x) => x.transition)
    if (transitions.some((x, i) => x.sessionId !== sessionId || x.seq !== i + 1 || x.curseur !== x.seq)) throw Error('Identité ou séquence discontinue')
    return transitions
  } catch (e) { throw refus('panne', `Journal Codex illisible : ${e.message}`) }
}
function messageValide(message, requestId) {
  if (typeof message !== 'string' || !message.trim() || Buffer.byteLength(message, 'utf8') > MAX_MESSAGE_CODEX) throw refus('validation', `Message requis, au plus ${MAX_MESSAGE_CODEX} octets UTF-8`)
  if (typeof requestId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(requestId)) throw refus('validation', 'requestId requis (1 à 128 caractères alphanumériques, _ ou -)')
}
function delaiValide(timeoutMs, maximum = 240_000) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > maximum) throw refus('validation', `timeoutMs doit être entier entre 1 et ${maximum}`)
}
function curseurValide(depuis) {
  if (!Number.isSafeInteger(depuis) || depuis < 0) throw refus('validation', 'Curseur depuis entier positif requis')
}
function connexion({ dossier, sessionId, timeoutMs }, commande) {
  delaiValide(timeoutMs, commande.op === 'veiller' ? 3_600_000 : 240_000)
  return new Promise((resolve, reject) => {
    const socket = createConnection(adresse(dossier, sessionId))
    socket.setEncoding('utf8')
    const timer = setTimeout(() => finir(Object.assign(refus('transitoire', 'Borne IPC Codex atteinte'), { code: 'BORNE_IPC_CODEX' })), timeoutMs)
    let fini = false, tampon = ''
    function finir(erreur, resultat) {
      if (fini) return
      fini = true
      clearTimeout(timer)
      socket.destroy()
      if (erreur) reject(erreur)
      else resolve(resultat)
    }
    socket.on('connect', () => socket.write(`${JSON.stringify({ ...commande, sessionId })}\n`))
    socket.on('data', (b) => {
      tampon += b.toString('utf8')
      if (Buffer.byteLength(tampon) > 2_000_000) return finir(refus('panne', 'Réponse IPC Codex trop longue'))
      const fin = tampon.indexOf('\n')
      if (fin < 0) return
      try {
        const r = JSON.parse(tampon.slice(0, fin))
        if (r.erreur) {
          if (r.code !== undefined && !(commande.op === 'veiller' && r.code === 'BORNE_IPC_CODEX'
            && r.erreur === refus('transitoire', 'Borne de veille Codex atteinte').message
            && Object.keys(r).every((k) => ['erreur', 'code'].includes(k)))) return finir(refus('panne', 'Code de réponse IPC Codex invalide'))
          finir(Object.assign(new Error(r.erreur), { native: r.native, ...(r.code === 'BORNE_IPC_CODEX' ? { code: r.code } : {}) }))
        }
        else finir(null, r)
      } catch (e) { finir(refus('panne', `Réponse IPC Codex invalide : ${e.message}`)) }
    })
    socket.on('error', (e) => finir(refus('transitoire', `Pont Codex indisponible : ${e.message}`)))
    socket.on('end', () => finir(refus('panne', 'Mort du pont Codex : EOF sans réponse terminale')))
  })
}
export async function envoyerCodex({ dossier, sessionId, jeton, message, requestId, timeoutMs = 30_000 }) {
  identite(sessionId)
  messageValide(message, requestId)
  if (typeof jeton !== 'string' || !jeton) throw refus('permission', 'Jeton requis')
  return connexion({ dossier, sessionId, timeoutMs }, { op: 'envoyer', jeton, message, requestId })
}
export async function veillerCodex({ dossier, sessionId, depuis = 0, timeoutMs = 60_000 }) {
  identite(sessionId)
  curseurValide(depuis)
  if (timeoutMs !== 0) delaiValide(timeoutMs, 3_600_000)
  const deja = lireTransitions(dossier, sessionId).find((x) => x.seq > depuis)
  if (deja) return deja
  if (timeoutMs === 0) return { type: 'aucune', sessionId, seq: depuis, curseur: depuis, etat: 'indeterminee' }
  try { return await connexion({ dossier, sessionId, timeoutMs }, { op: 'veiller', depuis, timeoutMs }) }
  catch (e) {
    const derniere = lireTransitions(dossier, sessionId).find((x) => x.seq > depuis)
    if (derniere) return derniere
    throw e
  }
}
export function lancerPontCodex({ plan, carte, dossier, consigne, schema, env, notifier, lancer = spawn, echo }) {
  identite(carte.sessionId)
  if (typeof notifier !== 'function' || !/^[0-9a-f]{64}$/.test(carte.empreinteJeton)) throw refus('validation', 'Projection et empreinte de capacité requises')
  const outputSchema = typeof schema === 'string' ? JSON.parse(readFileSync(schema, 'utf8')) : schema
  if (!outputSchema || typeof outputSchema !== 'object') throw refus('validation', 'Schéma de rapport requis')
  mkdirSync(dossier, { recursive: true })
  const fichiers = chemins(dossier, carte.sessionId)
  const natif = lancer(plan.executable, plan.args, { cwd: carte.worktree, env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })
  const child = new EventEmitter(), signaux = new EventEmitter(), attentes = new Map(), clients = new Set(), abonnements = new Set(), envois = new Map()
  let premiereCause = '', stderr = '', numero = 0, seq = 0, ferme = false, mort = false, sorti = false, arretSansProtocoleDemande = false, tourDemarre = false, fermetureTerminee = false, serial = Promise.resolve(), rapportTexte = '', timerArret
  const debut = Date.now()
  let projection = { threadId: null, turnId: null, etat: 'demarrage', jetons: null, dureeMs: 0, outils: 0, diagnostic: fichiers.stderr }
  const outilsVus = new Set()
  const toursTermines = new Set()
  Object.defineProperties(child, { pid: { get: () => natif.pid }, exitCode: { get: () => natif.exitCode }, signalCode: { get: () => natif.signalCode } })
  const projeterJournal = projeterJournalCodex(fichiers.journal, echo, (e) => appendFileSync(fichiers.stderr, `[Codex] Affichage suspendu : ${e.message}\n`))
  function journal(x) { appendFileSync(fichiers.journal, `${JSON.stringify(x)}\n`); projeterJournal() }
  function cause(e) { if (!premiereCause) premiereCause = e.message || String(e) }
  function publier(type, champs = {}) {
    const suivante = { ...projection, dureeMs: Date.now() - debut, ...champs }
    notifier({ ...suivante })
    projection = suivante
    const transition = { sessionId: carte.sessionId, seq: ++seq, curseur: seq, type, ...projection }
    journal({ transition })
    for (const ab of abonnements) if (transition.seq > ab.depuis) ab.repondre(transition)
    return transition
  }
  function echouer(e) {
    cause(e.message?.startsWith('[') ? e : refus('panne', e.message || String(e)))
    try { publier('erreur', { etat: 'erreur', cause: premiereCause, native: e.native }) } catch (erreur) { cause(erreur); journal({ erreur: erreur.message }) }
  }
  function requete(method, params, timeoutMs = 20_000) {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return Promise.reject(refus('transitoire', `Borne native ${method} atteinte avant émission : échéance de démarrage épuisée`))
    if (mort || natif.stdin.destroyed) return Promise.reject(refus('panne', 'App-server Codex arrêté'))
    return new Promise((resolve, reject) => {
      const id = ++numero
      const timer = setTimeout(() => { attentes.delete(id); reject(refus('transitoire', `Borne native ${method} atteinte`)) }, timeoutMs)
      attentes.set(id, { resolve, reject, timer, method })
      natif.stdin.write(`${JSON.stringify({ id, method, params })}\n`, (e) => {
        if (e && attentes.delete(id)) { clearTimeout(timer); reject(refus('panne', e.message)) }
      })
    })
  }
  function attendreSignal(nom, predicat, timeoutMs = 20_000) {
    if (predicat()) return Promise.resolve()
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => finir(refus('transitoire', `Borne ${nom} atteinte`)), timeoutMs)
      const ecouter = () => { if (predicat()) finir() }
      const mortEcouter = () => finir(refus('panne', 'Mort app-server pendant attente'))
      function finir(e) { clearTimeout(timer); signaux.off(nom, ecouter); signaux.off('mort', mortEcouter); if (e) reject(e); else resolve() }
      signaux.on(nom, ecouter)
      signaux.on('mort', mortEcouter)
    })
  }
  async function demarrerTour(texte) {
    projection = { ...projection, etat: 'occupe', turnId: null }
    delete projection.rapport
    rapportTexte = ''
    tourDemarre = false
    const r = await requete('turn/start', { threadId: projection.threadId, input: [{ type: 'text', text: texte }], outputSchema })
    const turnId = lu('turn/start', r, 'turn.id', 'chaine')
    if (!projection.turnId) projection.turnId = turnId
    else if (projection.turnId !== turnId) throw refus('panne', 'Identité de tour contradictoire')
    notifier({ ...projection })
    return r
  }
  function recevoir(x) {
    journal({ notification: x })
    if (Object.hasOwn(x, 'id') && !x.method) {
      const a = attentes.get(x.id)
      if (!a) return
      attentes.delete(x.id)
      clearTimeout(a.timer)
      try {
        if (x.error) a.reject(refus('métier', `Refus natif Codex : ${lu(a.method, x, 'error.message', 'chaine')}`, x.error))
        else a.resolve(x.result)
      } catch (e) { a.reject(e); throw e }
      return
    }
    const p = x.params
    if (x.method && Object.hasOwn(x, 'id')) {
      if (p?.threadId !== projection.threadId) throw refus('permission', 'Requête native hors thread possédé')
      publier('approbation', { etat: 'attente' })
      natif.stdin.write(`${JSON.stringify({ id: x.id, error: { code: -32601, message: `${prefixeDeRefus('permission')} Interaction refusée : policy never` } })}\n`)
      publier('erreur', { etat: 'erreur', cause: `${prefixeDeRefus('permission')} Interaction native refusée : ${x.method}` })
      return
    }
    if (!NOTIFICATIONS_LUES.has(x.method)) return
    const m = x.method, champ = (chemin, forme, options) => lu(m, x, `params.${chemin}`, forme, options)
    if (champ('threadId', 'chaine') !== projection.threadId) return
    const tour = m === 'turn/started' || m === 'turn/completed'
    const turnId = tour ? champ('turn.id', 'chaine') : m === 'thread/status/changed' ? null : champ('turnId', 'chaine')
    if (m === 'turn/completed' && toursTermines.has(turnId)) return
    if (!tour && turnId && projection.turnId && turnId !== projection.turnId) return
    if (m === 'turn/started') {
      if (projection.turnId && turnId !== projection.turnId) throw refus('panne', 'Notification de tour contradictoire')
      projection = { ...projection, turnId, etat: 'occupe' }
      tourDemarre = true
      notifier({ ...projection })
      signaux.emit('demarre')
    } else if (m === 'thread/tokenUsage/updated') {
      champ('tokenUsage', 'objet')
      projection = { ...projection, jetons: p.tokenUsage }
      notifier({ ...projection })
    } else if (m === 'item/started' || m === 'item/completed') {
      const type = champ('item.type', 'chaine')
      if (type === 'agentMessage' && m === 'item/completed') rapportTexte = champ('item.text', 'chaine')
      else if (OUTILS.includes(type)) {
        const id = champ('item.id', 'chaine')
        if (!outilsVus.has(id)) {
          outilsVus.add(id)
          projection = { ...projection, outils: outilsVus.size }
          notifier({ ...projection })
        }
      }
    } else if (m === 'error') {
      const message = champ('error.message', 'chaine')
      if (champ('willRetry', 'booleen', { nul: true })) appendFileSync(fichiers.stderr, `[Codex] Erreur native réessayée par Codex : ${message}\n`)
      else echouer(refus('panne', message, p.error))
    } else if (m === 'turn/completed') {
      if (turnId !== projection.turnId) throw refus('panne', 'Fin de tour étrangère')
      const statut = champ('turn.status', 'chaine')
      const textes = champ('turn.items', 'tableau').flatMap((_, i) => champ(`turn.items.${i}.type`, 'chaine') === 'agentMessage' ? [champ(`turn.items.${i}.text`, 'chaine')] : [])
      const dureeMs = champ('turn.durationMs', 'entier', { nul: true })
      const erreur = champ('turn.error', 'objet', { nul: true }) && champ('turn.error.message', 'chaine')
      toursTermines.add(turnId)
      tourDemarre = false
      if (statut === 'completed') {
        const texte = textes.at(-1) || rapportTexte
        let rapport
        try { rapport = JSON.parse(texte) } catch { throw refus('panne', 'Rapport Codex absent ou JSON invalide') }
        publier('fin', { etat: 'inactif', rapport, dureeMs: dureeMs ?? Date.now() - debut })
      } else if (statut === 'interrupted' && ferme) {
        publier('inactif', { etat: 'inactif', interrompu: true })
      } else echouer(refus('métier', erreur || `Tour Codex ${statut}`, p.turn.error))
      signaux.emit('termine')
    } else if (m === 'thread/status/changed' && champ('status.type', 'chaine') === 'active' && champ('status.activeFlags', 'tableau').length && projection.etat !== 'attente') {
      publier('approbation', { etat: 'attente' })
    }
  }
  const lignes = createInterface({ input: natif.stdout })
  lignes.on('line', (l) => { try { recevoir(JSON.parse(l)) } catch (e) { echouer(e) } })
  function perdreProtocole() {
    if (!fermetureTerminee && !mort) {
      echouer(refus('panne', stderr.trim() || 'EOF app-server Codex sans fermeture terminale'))
      enfantMort()
      arreterSansProtocole()
    }
  }
  lignes.on('close', perdreProtocole)
  natif.stdout.on('close', perdreProtocole)
  natif.stderr.on('data', (b) => { appendFileSync(fichiers.stderr, b); stderr += b.toString('utf8') })
  natif.stdin.on('error', (e) => echouer(refus('panne', `stdin Codex : ${e.message}`)))
  function enfantMort() {
    if (mort) return
    mort = true
    signaux.emit('mort')
    for (const a of attentes.values()) { clearTimeout(a.timer); a.reject(refus('panne', 'Mort app-server Codex', stderr)) }
    attentes.clear()
    if (!fermetureTerminee) {
      cause(refus('panne', stderr.trim() || 'App-server Codex arrêté sans fermeture'))
      try { publier('mort', { etat: 'mort', cause: premiereCause }) } catch (e) { journal({ erreur: e.message }) }
    }
    serveur.close()
    for (const s of clients) { s.end(); s.destroySoon() }
  }
  function arreterSansProtocole() {
    if (sorti || !natif.pid) return false
    if (arretSansProtocoleDemande) return true
    arretSansProtocoleDemande = true
    ferme = true
    clearTimeout(timerArret)
    timerArret = setTimeout(() => {
      echouer(refus('panne', 'Arrêt forcé Codex après perte du protocole'))
      natif.kill('SIGKILL')
    }, 2000)
    natif.kill('SIGTERM')
    return true
  }
  natif.on('error', (e) => { echouer(refus('panne', e.message)); enfantMort(); child.emit('error', e) })
  natif.on('exit', (code, signal) => { sorti = true; clearTimeout(timerArret); enfantMort(); child.emit('exit', code, signal) })
  natif.on('close', () => projeterJournal.fermer())
  const serveur = createServer((socket) => {
    socket.setEncoding('utf8')
    socket.setTimeout(30_000, () => socket.destroy())
    clients.add(socket)
    let tampon = '', traite = false, abonnement, timer
    socket.on('error', () => {})
    socket.on('close', () => { clients.delete(socket); clearTimeout(timer); if (abonnement) abonnements.delete(abonnement) })
    const repondre = (r) => { clearTimeout(timer); if (abonnement) abonnements.delete(abonnement); socket.end(`${JSON.stringify(r)}\n`) }
    socket.on('data', (b) => {
      if (traite) return
      tampon += b.toString('utf8')
      if (Buffer.byteLength(tampon) > MAX_MESSAGE_CODEX + 4096) { traite = true; repondre({ erreur: refus('validation', 'Commande IPC trop longue').message }); return }
      const fin = tampon.indexOf('\n')
      if (fin < 0) return
      traite = true
      try {
        const q = JSON.parse(tampon.slice(0, fin))
        const champs = q.op === 'envoyer' ? ['op', 'sessionId', 'jeton', 'message', 'requestId'] : ['op', 'sessionId', 'depuis', 'timeoutMs']
        if (Object.keys(q).some((k) => !champs.includes(k))) throw refus('validation', 'Champ IPC inconnu')
        if (q.sessionId !== carte.sessionId) throw refus('permission', 'Session IPC étrangère')
        if (q.op === 'veiller') {
          curseurValide(q.depuis)
          delaiValide(q.timeoutMs, 3_600_000)
          const deja = lireTransitions(dossier, carte.sessionId).find((t) => t.seq > q.depuis)
          if (deja) return repondre(deja)
          abonnement = { depuis: q.depuis, repondre }
          abonnements.add(abonnement)
          socket.setTimeout(q.timeoutMs + 1000)
          timer = setTimeout(() => repondre({ erreur: refus('transitoire', 'Borne de veille Codex atteinte').message, code: 'BORNE_IPC_CODEX' }), q.timeoutMs)
        } else if (q.op === 'envoyer') {
          if (typeof q.jeton !== 'string' || !timingSafeEqual(Buffer.from(empreinte(q.jeton), 'hex'), Buffer.from(carte.empreinteJeton, 'hex'))) throw refus('permission', 'Jeton Codex incorrect')
          messageValide(q.message, q.requestId)
          if (ferme || mort) throw refus('métier', 'Session Codex en fermeture ou morte')
          const existant = envois.get(q.requestId)
          if (existant && existant.empreinte !== empreinte(q.message)) throw refus('validation', 'requestId déjà employé avec un autre message')
          let promesse = existant?.promesse
          if (!promesse) {
            promesse = serial.then(async () => {
              if (ferme || mort) throw refus('métier', 'Session Codex en fermeture ou morte')
              await pret
              const resultat = toursTermines.has(projection.turnId) ? await demarrerTour(q.message) : await requete('turn/steer', { threadId: projection.threadId, expectedTurnId: projection.turnId, input: [{ type: 'text', text: q.message }] })
              return { ok: true, requestId: q.requestId, threadId: projection.threadId, turnId: projection.turnId, resultat }
            })
            serial = promesse.catch(() => {})
            envois.set(q.requestId, { empreinte: empreinte(q.message), promesse })
          }
          promesse.then(repondre, (e) => repondre({ erreur: e.message, native: e.native }))
        } else throw refus('validation', 'Commande IPC inconnue')
      } catch (e) { repondre({ erreur: e.message.startsWith('[') ? e.message : refus('validation', e.message).message, native: e.native }) }
    })
  })
  serveur.on('error', (e) => { echouer(refus('panne', `IPC Codex : ${e.message}`)); child.kill() })
  serveur.listen(adresse(dossier, carte.sessionId))
  const pret = (async () => {
    await requete('initialize', { clientInfo: { name: 'wfrp-session', version: '1' }, capabilities: { experimentalApi: true } })
    natif.stdin.write(`${JSON.stringify({ method: 'initialized', params: {} })}\n`)
    const r = await requete('thread/start', { cwd: carte.worktree }, carte.demarrageJusqua - Date.now())
    projection.threadId = lu('thread/start', r, 'thread.id', 'chaine')
    await demarrerTour(consigne)
  })()
  pret.catch((e) => { echouer(e); child.kill() })
  child.kill = () => {
    if (mort) return arreterSansProtocole()
    if (ferme || sorti) return false
    ferme = true
    timerArret = setTimeout(() => { echouer(refus('panne', 'Arrêt forcé Codex après borne de fermeture')); natif.kill('SIGKILL') }, 25_000)
    const arreter = async () => {
      try {
        await pret
        await serial
        if (projection.etat === 'occupe' || projection.etat === 'attente') {
          await attendreSignal('demarre', () => tourDemarre)
          await requete('turn/interrupt', { threadId: projection.threadId, turnId: projection.turnId }).catch((e) => { if (!toursTermines.has(projection.turnId)) throw e })
          await attendreSignal('termine', () => !tourDemarre)
        }
        fermetureTerminee = true
        publier('fermeture', { etat: 'fermee' })
      } catch (e) { echouer(e); fermetureTerminee = true; try { publier('fermeture', { etat: 'fermee' }) } catch (erreur) { journal({ erreur: erreur.message }) } }
      natif.stdin.end()
    }
    void arreter()
    return true
  }
  return { child, cause: () => premiereCause || stderr.trim(), journalDiagnostic: fichiers.stderr }
}
