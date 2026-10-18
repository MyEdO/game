import { spawn, spawnSync } from 'node:child_process'
import { createHash, timingSafeEqual } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { appendFileSync, mkdirSync, readFileSync, existsSync, mkdtempSync, rmSync, openSync, readSync, closeSync, fstatSync } from 'node:fs'
import { stripVTControlCharacters } from 'node:util'
import { createServer, createConnection } from 'node:net'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createInterface } from 'node:readline'
import { prefixeDeRefus } from '../guards/lib/categorieDeRefus.mjs'
import { tableTotale } from '../../src/lib/tableTotale.ts'
import { coupeAuMot } from '../../src/lib/coupeAuMot.mjs'

export const VERSION_PROTOCOLE_CODEX = '0.163.0'
export const MAX_MESSAGE_CODEX = 64 * 1024
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const refus = (categorie, message, native) => Object.assign(new Error(`${prefixeDeRefus(categorie)} ${message}`), { native })
const empreinte = (s) => createHash('sha256').update(s).digest('hex')
const OUTILS = ['commandExecution', 'fileChange', 'mcpToolCall', 'dynamicToolCall', 'collabAgentToolCall', 'webSearch', 'imageView', 'imageGeneration', 'sleep']
const CHAMPS_OUTILS = Object.freeze({ commandExecution: ['command', 'status'], fileChange: ['status'], mcpToolCall: ['server', 'tool', 'status'], dynamicToolCall: ['tool', 'status'], collabAgentToolCall: ['tool', 'status'], webSearch: [], imageView: [], imageGeneration: ['status'], sleep: [] })
const CHAMPS_ITEMS = ['item.@agentMessage.type', 'item.@agentMessage.text', ...OUTILS.flatMap((t) => ['id', ...CHAMPS_OUTILS[t]].map((k) => `item.@${t}.${k}`))]
const CHAMPS = Object.freeze({
  'v1/InitializeParams': ['clientInfo.name', 'clientInfo.version', 'capabilities.experimentalApi'],
  'v1/InitializeResponse': ['userAgent'],
  'v2/ThreadStartParams': ['cwd'],
  'v2/ThreadStartResponse': ['thread.id'],
  'v2/TurnStartParams': ['threadId', 'input.[].@text.type', 'input.[].@text.text', 'outputSchema'],
  'v2/TurnStartResponse': ['turn.id'],
  'v2/TurnSteerParams': ['threadId', 'expectedTurnId', 'input.[].@text.type', 'input.[].@text.text'],
  'v2/TurnSteerResponse': ['turnId'],
  'v2/TurnInterruptParams': ['threadId', 'turnId'],
  'v2/TurnInterruptResponse': [],
  'v2/TurnStartedNotification': ['threadId', 'turn.id'],
  'v2/TurnCompletedNotification': ['threadId', 'turn.id', 'turn.status', 'turn.items.[].@agentMessage.type', 'turn.items.[].@agentMessage.text', 'turn.durationMs', 'turn.error.message'],
  'v2/ItemCompletedNotification': ['threadId', 'turnId', ...CHAMPS_ITEMS],
  'v2/ItemStartedNotification': ['threadId', 'turnId', ...CHAMPS_ITEMS],
  'v2/ThreadTokenUsageUpdatedNotification': ['threadId', 'turnId', 'tokenUsage.total.totalTokens'],
  'v2/ThreadStatusChangedNotification': ['threadId', 'status.@active.type', 'status.@active.activeFlags.[]'],
  'v2/ErrorNotification': ['threadId', 'error.message'],
})
const EMPREINTES = Object.freeze({
  'v1/InitializeParams': '623dacaf3ad710a70a827eaed46f138e085661cdeae6ba05b4772a124fbfbdc7',
  'v1/InitializeResponse': '5dbc854f567d45b4b0a2907547f63b64c84a399c71729e6a60a423084665f442',
  'v2/ThreadStartParams': '9dfbb8da33c180a230217e393d106d4f9953ddaf9ac741622ef824a26a4304bb',
  'v2/ThreadStartResponse': '32abd685e7f8680e2718627751068b65856595ed706a6fc07f861f55c2b3d611',
  'v2/TurnStartParams': 'd1006b5d7a9342585ce867a6daf1d4b2cb2478ebd6c076b2558f3758e27de06a',
  'v2/TurnStartResponse': '036750364cd5d4d21ddded797dbe88d9f7f0104c1922df1b9981e63b09026a62',
  'v2/TurnSteerParams': 'bc5faf38e6d2fe8b12ee5c0311db0341febc57f9a6549298c85d69fd3da0fde6',
  'v2/TurnSteerResponse': 'ec09e5b5b5cd62b0e6f2cabe4f2180e6cf8e136ec67bf43fde9d4934f10ebe00',
  'v2/TurnInterruptParams': 'c0cd7920406a77d4f75a2a441a7d35aea303b4c33b73760912294f020448464c',
  'v2/TurnInterruptResponse': '44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a',
  'v2/TurnStartedNotification': 'abae1781e40c74769480a11971b850ab1b4a42f77a4fe76f6fe274972c2aa2c4',
  'v2/TurnCompletedNotification': '12822e0f1551cc1dbdd6025e3f564865090d18648ecbff75e99e791f78b5349b',
  'v2/ItemCompletedNotification': '973243d19a85605f9edfa7aad1dd90e9405e3212747157a2c6d7e8d6b8656a21',
  'v2/ItemStartedNotification': '973243d19a85605f9edfa7aad1dd90e9405e3212747157a2c6d7e8d6b8656a21',
  'v2/ThreadTokenUsageUpdatedNotification': '8d41e6d6a92479e1fa9e411bbff6e2412959bfdd979e349fb31f87c57dc040b4',
  'v2/ThreadStatusChangedNotification': '8e0b5553009531739bc455be014a6a1c04aebf3b1f3629ff439ae204f7e5cec6',
  'v2/ErrorNotification': '0ee69aea58e82042178f3a259e15b8b4718ddcddd57f9bbcf0a242c5d0ce9b43',
})
const METHODES = {
  ClientRequest: { initialize: 'v1/InitializeParams', 'thread/start': 'v2/ThreadStartParams', 'turn/start': 'v2/TurnStartParams', 'turn/steer': 'v2/TurnSteerParams', 'turn/interrupt': 'v2/TurnInterruptParams' },
  ClientNotification: { initialized: null },
  ServerNotification: { 'turn/started': 'v2/TurnStartedNotification', 'turn/completed': 'v2/TurnCompletedNotification', 'item/started': 'v2/ItemStartedNotification', 'item/completed': 'v2/ItemCompletedNotification', 'thread/tokenUsage/updated': 'v2/ThreadTokenUsageUpdatedNotification', 'thread/status/changed': 'v2/ThreadStatusChangedNotification', error: 'v2/ErrorNotification' },
}
function forme(schema, segments, definitions = schema?.definitions || {}) {
  if (!schema) return null
  if (schema.$ref) return forme(definitions[schema.$ref.split('/').at(-1)], segments, definitions)
  const base = tableTotale(['type', 'enum', 'const'].filter((k) => Object.hasOwn(schema, k)), (k) => schema[k])
  if (!segments.length) return base
  if (segments[0].startsWith('@') && schema.properties?.type?.enum?.includes(segments[0].slice(1))) return forme(schema, segments.slice(1), definitions)
  const alternatives = schema.oneOf || schema.anyOf || schema.allOf
  if (alternatives) {
    const branches = alternatives.map((s) => s.type === 'null' ? { type: 'null' } : forme(s, segments, definitions)).filter(Boolean)
    return branches.length ? { ...base, branches } : null
  }
  const [key, ...reste] = segments
  const enfant = forme(key === '[]' ? schema.items : schema.properties?.[key], reste, definitions)
  return enfant ? { ...base, required: key === '[]' || (schema.required || []).includes(key), enfant } : null
}
export function verifierProtocoleCodex({ executable, executer = spawnSync }) {
  let scratch
  try {
    const version = executer(executable, ['--version'], { encoding: 'utf8', timeout: 15_000, windowsHide: true })
    if (version.error || version.status !== 0) throw refus('panne', 'Version Codex invérifiable', version.error?.message || version.stderr)
    const mesure = /^codex-cli (\d+\.\d+\.\d+)\s*$/.exec(version.stdout)?.[1]
    if (!mesure || mesure.split('.').map(Number).some((v, i, a) => a.slice(0, i).every((n, j) => n === Number(VERSION_PROTOCOLE_CODEX.split('.')[j])) && v < Number(VERSION_PROTOCOLE_CODEX.split('.')[i]))) throw refus('validation', `Protocole Codex non audité : ${version.stdout.trim()}`)
    scratch = mkdtempSync(join(tmpdir(), 'wfrp-codex-protocole-'))
    const genere = executer(executable, ['app-server', 'generate-json-schema', '--out', scratch], { encoding: 'utf8', timeout: 30_000, windowsHide: true })
    if (genere.error || genere.status !== 0) throw refus('panne', 'Schéma Codex invérifiable', genere.error?.message || genere.stderr)
    for (const [nom, attendu] of Object.entries(EMPREINTES)) {
      const document = JSON.parse(readFileSync(join(scratch, `${nom}.json`), 'utf8'))
      const mesuree = empreinte(JSON.stringify(tableTotale(CHAMPS[nom], (p) => forme(document, p.split('.')))))
      if (mesuree !== attendu) throw refus('validation', `Protocole Codex incompatible : ${nom} (${mesure})`)
    }
    for (const [enveloppe, methodes] of Object.entries(METHODES)) {
      const document = JSON.parse(readFileSync(join(scratch, `${enveloppe}.json`), 'utf8'))
      for (const [methode, nom] of Object.entries(methodes)) {
        const branche = document.oneOf?.find((b) => b.properties?.method?.enum?.includes(methode))
        const requis = ['method', ...(nom ? ['params'] : []), ...(enveloppe === 'ClientRequest' ? ['id'] : [])]
        if (branche?.type !== 'object' || branche.properties.method.type !== 'string' || requis.some((k) => !branche.required?.includes(k))) throw refus('validation', `Méthode Codex incompatible : ${methode}`)
        if (nom) {
          const mesuree = empreinte(JSON.stringify(tableTotale(CHAMPS[nom], (p) => forme(branche.properties.params, p.split('.'), document.definitions))))
          if (mesuree !== EMPREINTES[nom]) throw refus('validation', `Paramètres de méthode Codex incompatibles : ${methode}`)
        }
      }
    }
    return { version: mesure, auditee: VERSION_PROTOCOLE_CODEX }
  } catch (e) {
    if (e.message.startsWith('[')) throw e
    throw refus('panne', `Contrôle du protocole Codex impossible : ${e.message}`)
  } finally {
    if (scratch) rmSync(scratch, { recursive: true, force: true })
  }
}
function identite(sessionId) {
  if (typeof sessionId !== 'string' || !UUID.test(sessionId)) throw refus('validation', 'sessionId UUID requis')
}
function adresse(dossier, sessionId) {
  identite(sessionId)
  return process.platform === 'win32' ? `\\\\.\\pipe\\wfrp-codex-${sessionId}` : join(dossier, `${sessionId}.codex.sock`)
}
function chemins(dossier, sessionId) {
  identite(sessionId)
  return { journal: join(dossier, `${sessionId}.codex.jsonl`), stderr: join(dossier, `${sessionId}.codex.stderr.log`) }
}
export function projeterJournalCodex(journal, echo = (texte) => process.stdout.write(texte)) {
  const bloc = Buffer.alloc(16 * 1024), limiteLecture = 256 * 1024
  let position = 0, morceaux = [], longueur = 0, reprise, threadId, turnId
  const afficher = (prefixe, texte = '') => {
    const net = stripVTControlCharacters(String(texte).slice(0, 8192)).replace(/[\p{Cc}\p{Cf}]/gu, ' ').replace(/\s+/gu, ' ').trim()
    echo(`[Codex] ${prefixe}${net ? ` : ${coupeAuMot(net, 4096)}` : ''}\n`)
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
    else if (n?.method === 'error') afficher('Erreur native', p?.error?.message)
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
    if (!existsSync(journal)) return
    const fd = openSync(journal, 'r')
    try {
      const taille = fstatSync(fd).size
      let budget = limiteLecture
      while (position < taille && budget > 0) {
        const n = readSync(fd, bloc, 0, Math.min(bloc.length, budget, taille - position), position)
        if (!n) break
        position += n
        budget -= n
        let debut = 0
        for (let i = 0; i < n; i++) if (bloc[i] === 10) {
          ajouter(bloc.subarray(debut, i))
          try { projeter(JSON.parse(Buffer.concat(morceaux, longueur).toString('utf8'))) }
          catch (e) { if (e instanceof SyntaxError) afficher('Journal', 'ligne JSON invalide'); else throw e }
          morceaux = []; longueur = 0; debut = i + 1
        }
        ajouter(bloc.subarray(debut, n))
      }
      if (position < taille) reprise = setImmediate(lire)
    } finally { closeSync(fd) }
  }
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
    const timer = setTimeout(() => finir(refus('transitoire', 'Borne IPC Codex atteinte')), timeoutMs)
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
        if (r.erreur) finir(Object.assign(new Error(r.erreur), { native: r.native }))
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
  const projeterJournal = projeterJournalCodex(fichiers.journal, echo)
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
  function requete(method, params) {
    if (mort || natif.stdin.destroyed) return Promise.reject(refus('panne', 'App-server Codex arrêté'))
    return new Promise((resolve, reject) => {
      const id = ++numero
      const timer = setTimeout(() => { attentes.delete(id); reject(refus('transitoire', `Borne native ${method} atteinte`)) }, 20_000)
      attentes.set(id, { resolve, reject, timer })
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
    if (typeof r?.turn?.id !== 'string') throw refus('panne', 'Réponse turn/start sans identité')
    if (!projection.turnId) projection.turnId = r.turn.id
    else if (projection.turnId !== r.turn.id) throw refus('panne', 'Identité de tour contradictoire')
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
      if (x.error) a.reject(refus('métier', `Refus natif Codex : ${x.error.message}`, x.error))
      else a.resolve(x.result)
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
    if (!p || p.threadId !== projection.threadId) return
    if (x.method === 'turn/completed' && toursTermines.has(p.turn?.id)) return
    if (p.turnId && projection.turnId && p.turnId !== projection.turnId) return
    if (x.method === 'turn/started') {
      if (typeof p.turn?.id !== 'string' || (projection.turnId && p.turn.id !== projection.turnId)) throw refus('panne', 'Notification de tour contradictoire')
      projection = { ...projection, turnId: p.turn.id, etat: 'occupe' }
      tourDemarre = true
      notifier({ ...projection })
      signaux.emit('demarre')
    } else if (x.method === 'thread/tokenUsage/updated') {
      projection = { ...projection, jetons: p.tokenUsage }
      notifier({ ...projection })
    } else if (x.method === 'item/started' || x.method === 'item/completed') {
      if (p.item?.type === 'agentMessage' && x.method === 'item/completed') rapportTexte = p.item.text
      else if (p.item && OUTILS.includes(p.item.type) && !outilsVus.has(p.item.id)) {
        outilsVus.add(p.item.id)
        projection = { ...projection, outils: outilsVus.size }
        notifier({ ...projection })
      }
    } else if (x.method === 'error') {
      echouer(refus('panne', p.error?.message || 'Erreur native Codex', p.error))
    } else if (x.method === 'turn/completed') {
      if (p.turn?.id !== projection.turnId) throw refus('panne', 'Fin de tour étrangère')
      toursTermines.add(p.turn.id)
      tourDemarre = false
      if (p.turn.status === 'completed') {
        const texte = p.turn.items?.filter((i) => i.type === 'agentMessage').at(-1)?.text || rapportTexte
        let rapport
        try { rapport = JSON.parse(texte) } catch { throw refus('panne', 'Rapport Codex absent ou JSON invalide') }
        publier('fin', { etat: 'inactif', rapport, dureeMs: p.turn.durationMs ?? Date.now() - debut })
      } else if (p.turn.status === 'interrupted' && ferme) {
        publier('inactif', { etat: 'inactif', interrompu: true })
      } else echouer(refus('métier', p.turn.error?.message || `Tour Codex ${p.turn.status}`, p.turn.error))
      signaux.emit('termine')
    } else if (x.method === 'thread/status/changed' && p.status?.type === 'active' && p.status.activeFlags?.length && projection.etat !== 'attente') {
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
          timer = setTimeout(() => repondre({ erreur: refus('transitoire', 'Borne de veille Codex atteinte').message }), q.timeoutMs)
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
              const resultat = projection.etat === 'inactif' ? await demarrerTour(q.message) : await requete('turn/steer', { threadId: projection.threadId, expectedTurnId: projection.turnId, input: [{ type: 'text', text: q.message }] })
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
    const r = await requete('thread/start', { cwd: carte.worktree })
    if (typeof r?.thread?.id !== 'string') throw refus('panne', 'Réponse thread/start sans identité')
    projection.threadId = r.thread.id
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
          await requete('turn/interrupt', { threadId: projection.threadId, turnId: projection.turnId })
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
