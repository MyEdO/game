import { readFileSync, readlinkSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { versCheminNatif } from './commandeShell.mjs'
import { canoniser } from '../../docs/lib/chemin-mesure.mjs'
import { listerDossier } from './lister.mjs'

export const DELAI_MESURE_PROCESSUS_MS = 5000

const CAUSE_DE_LECTURE = /^(cwd|commande|image|proprietaire|creation|identite|resident) illisible(?: : \[([^\]]+)\])?/

/** Le champ et le code d'une cause de lecture : `<champ> illisible : [<code>] <message>` pour une chaîne
 *  des collecteurs, `code` (ou celui de sa `cause`) pour une erreur. */
export function lireCause(cause) {
  if (typeof cause !== 'string') return { champ: null, code: cause?.code ?? cause?.cause?.code ?? null }
  const m = CAUSE_DE_LECTURE.exec(cause.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
  return { champ: m?.[1] ?? null, code: m?.[2] ?? null }
}

// learn.microsoft.com/windows/win32/fileio/naming-a-file#win32-device-namespaces
const PREFIXE_DE_PERIPHERIQUE = /^[\\/]{2}[?.][\\/](?=[A-Za-z]:[\\/])/

export const sousArbre = (chemin, racine, platform = process.platform, { strict = true } = {}) => {
  const p = platform === 'win32' ? path.win32 : path.posix
  const normaliser = (c) => {
    const absolu = platform === 'win32' ? p.resolve(c).replace(PREFIXE_DE_PERIPHERIQUE, '') : p.resolve(c)
    const lexical = platform === 'win32' && absolu.startsWith('\\\\')
    const reel = platform === process.platform && !lexical ? canoniser(absolu, { strict }) : absolu
    return platform === 'win32' ? reel.toLowerCase() : reel
  }
  const rel = p.relative(normaliser(racine), normaliser(chemin))
  return rel === '' || (!rel.startsWith('..' + p.sep) && rel !== '..' && !p.isAbsolute(rel))
}

export function argumentsProcessus(commande, platform = process.platform) {
  if (platform !== 'win32') return [...String(commande).matchAll(/"([^"]*)"|'([^']*)'|([^\s"']+)/g)].map((m) => m[1] ?? m[2] ?? m[3])
  const texte = String(commande ?? '')
  const argumentsLus = []
  let i = 0
  while (i < texte.length) {
    while (texte[i] === ' ' || texte[i] === '\t') i++
    if (i === texte.length) break
    let argument = '', cite = false
    const executable = argumentsLus.length === 0
    while (i < texte.length && (cite || (texte[i] !== ' ' && texte[i] !== '\t'))) {
      let barres = 0
      if (!executable) while (texte[i] === '\\') { barres++; i++ }
      if (texte[i] === '"') {
        argument += '\\'.repeat(Math.floor(barres / 2))
        if (barres % 2) argument += '"'
        else if (!executable && cite && texte[i + 1] === '"') { argument += '"'; i++ }
        else cite = !cite
        i++
      } else {
        argument += '\\'.repeat(barres)
        if (!cite && (texte[i] === ' ' || texte[i] === '\t')) break
        if (i < texte.length) argument += texte[i++]
      }
    }
    argumentsLus.push(argument)
  }
  return argumentsLus
}

/** La part d'un argument qui a la forme d'un chemin sur `platform`, ou `null` : sous win32, l'argument coupé
 *  au premier caractère interdit dans un chemin. learn.microsoft.com/windows/win32/fileio/naming-a-file#naming-conventions */
export function cheminDArgument(argument, platform = process.platform) {
  let chemin = versCheminNatif(argument, platform)
  if (/^file:\/\//i.test(chemin)) {
    try { chemin = fileURLToPath(chemin, { windows: platform === 'win32' }) }
    catch { return null }
  }
  if (platform !== 'win32') return chemin
  chemin = chemin.replace(PREFIXE_DE_PERIPHERIQUE, '')
  const interdit = chemin.search(/[^ -\uffff]|[<>"|?*]|(?<!^[A-Za-z]):/)
  return (interdit === -1 ? chemin : chemin.slice(0, interdit)) || null
}

export function liensProcessus(processus, racine, platform = process.platform, options) {
  const p = platform === 'win32' ? path.win32 : path.posix
  const liens = []
  if (processus.cwd && sousArbre(processus.cwd, racine, platform, options)) liens.push('cwd')
  if (processus.image && p.isAbsolute(processus.image) && sousArbre(processus.image, racine, platform, options)) liens.push('image ' + processus.image)
  for (const brut of [...(processus.argv ?? argumentsProcessus(processus.commande, platform)), ...referencesCommande(processus.commande)]) {
    const argument = brut.startsWith('--') && brut.includes('=') ? brut.slice(brut.indexOf('=') + 1) : brut
    if (argument.startsWith('-')) continue
    const chemin = cheminDArgument(argument, platform)
    if (chemin && (p.isAbsolute(chemin) || processus.cwd) && sousArbre(p.resolve(processus.cwd || p.parse(racine).root, chemin), racine, platform, options)) liens.push('argument ' + brut)
  }
  return [...new Set(liens)]
}

export function referencesCommande(commande) {
  const texte = String(commande ?? '')
  const citees = [...texte.matchAll(/(['"`])((?:file:\/\/\/|[A-Za-z]:[\\/]|\.\.?[\\/]|\/)[^'"`\r\n]*)\1/g)].map((m) => m[2])
  const absolues = [...texte.matchAll(/(?:file:\/\/\/|[A-Za-z]:[\\/]|(?:^|[\s("'`=])\/)[^\s"'`(),;<>|]+/g)].map((m) => m[0].replace(/^[\s("'`=]+/, ''))
  return [...new Set([...citees, ...absolues])]
}

export function porteeProcessus(vue) {
  const erreursGlobales = vue.erreursGlobales ?? vue.erreurs ?? []
  const processus = vue.processus.map((p) => {
    const lus = p.erreurs ?? []
    const champs = new Set(lus.map((e) => lireCause(e).champ))
    const absents = { commande: p.commande == null, cwd: !p.cwd, creation: !p.creation }
    return { ...p, erreurs: [...new Set([...lus, ...Object.keys(absents).filter((c) => absents[c] && !champs.has(c)).map((c) => c + ' illisible')])] }
  })
  const horsPortee = vue.processus.filter((p) => !p.proprietaire || p.proprietaire !== vue.utilisateur)
  const noms = [...new Set(horsPortee.map((p) => p.nom || 'PID ' + p.pid))].sort()
  const erreurs = [...erreursGlobales]
  for (const p of processus.filter((p) => p.proprietaire === vue.utilisateur)) {
    if (p.erreurs.length) erreurs.push('PID ' + p.pid + ' ' + p.nom + ' : ' + p.erreurs.join('; '))
  }
  return { ...vue, processus, erreursGlobales, erreurs: [...new Set(erreurs)], horsPortee, portee: `examinés : commandes, images et cwd de tous les processus ; utilisateur=${vue.utilisateur} ; hors portée : ${horsPortee.length} processus d'autres comptes ou propriétaires illisibles (${noms.join(', ') || 'aucun'}) — propriétaire seul exclu du jugement d'indétermination` }
}

/** Précision d'une date de création mesurée, par source : `etimes` de ps et `btime` de `/proc/stat` à la
 *  seconde, CIM à la milliseconde. */
export const TOLERANCE_CREATION_MS = Object.freeze({ ps: 1500, proc: 1500, cim: 0 })

/** La précision des dates `creation` de `mesurerProcessusWorktrees` sur `platform`. */
export const toleranceDeMesure = (platform = process.platform) => TOLERANCE_CREATION_MS[platform === 'win32' ? 'cim' : 'proc']

/** Le lien `parent` → `enfant` selon leurs `creation` : `'valide'`, `'exclue'` ou `'indeterminee'`. #2586 */
export function classerFiliation(parent, enfant) {
  const creationDe = (p) => {
    if (p?.etat === 'Z' || p?.erreurs?.some((e) => /identit|création|creation/i.test(e))) return null
    const m = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d+))?Z$/.exec(p?.creation ?? '')
    if (!m || !Number.isFinite(Date.parse(p.creation))) return null
    const seconde = new Date(Date.parse(m[1] + 'Z')).toISOString().slice(0, 19)
    if (seconde !== m[1]) return null
    return { seconde, fraction: m[2] ?? '' }
  }
  const a = creationDe(parent), b = creationDe(enfant)
  if (!a || !b) return 'indeterminee'
  const precision = Math.max(a.fraction.length, b.fraction.length)
  return b.seconde < a.seconde || (b.seconde === a.seconde && b.fraction.padEnd(precision, '0') < a.fraction.padEnd(precision, '0')) ? 'exclue' : 'valide'
}

/** `USER_HZ`, unité de `starttime` dans `/proc/<pid>/stat` : proc(5). */
const TICKS_PAR_SECONDE = 100

/** La vue INDÉTERMINÉE d'une mesure qui a dépassé son échéance `timeout` : aucun processus, la raison nommée. */
function indeterminee(timeout) {
  const raison = `mesure des processus indéterminée : échéance de ${timeout} ms atteinte`
  return { ...porteeProcessus({ utilisateur: null, processus: [], erreurs: [raison] }), indeterminee: raison, code: 'MESURE_PROCESSUS_EXPIREE' }
}

/** `creation` : date ISO 8601 UTC du démarrage du processus, sur les deux plateformes. `pids` ne lit que ces
 *  processus ; `timeout` (ms) borne la mesure, et son échéance rend une vue `indeterminee`. */
export function mesurerProcessusWorktrees({ platform = process.platform, pids, pidsAInspecter = [], timeout, identites = false, memoireSeulement = false } = {}) {
  const debut = Date.now()
  if (platform === 'win32') {
    const system = process.env.SystemRoot
    if (!system) throw new Error('SystemRoot absent : lecteur Windows introuvable')
    const executable = path.join(system, process.arch === 'ia32' ? 'Sysnative' : 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
    const restant = timeout === undefined ? undefined : timeout - (Date.now() - debut)
    if (restant !== undefined && restant <= 0) return indeterminee(timeout)
    const borne = restant === undefined ? {} : { timeout: restant, windowsHide: true }
    let sortie
    try {
      sortie = execFileSync(executable, ['-NoProfile', '-NonInteractive', '-File', fileURLToPath(new URL('../../ops/processus-worktrees.ps1', import.meta.url)), ...(pids ? ['-Pids', pids.join(',')] : []), ...(pidsAInspecter.length ? ['-PidsAInspecter', [...new Set(pidsAInspecter)].join(',')] : []), ...(identites ? ['-Identites'] : []), ...(memoireSeulement ? ['-MemoireSeulement'] : [])], { encoding: 'utf8', maxBuffer: 16 << 20, ...borne })
    } catch (e) {
      if (timeout !== undefined && e.code === 'ETIMEDOUT') return indeterminee(timeout)
      throw e
    }
    const vue = JSON.parse(sortie)
    return identites ? { ...vue, pids } : { ...porteeProcessus(vue), pids }
  }
  if (platform !== 'linux') throw new Error('mesure processus non supportée : ' + platform)
  const uid = process.getuid()
  const processus = []
  const aInspecter = new Set(pidsAInspecter)
  const racine = racineProcessusLinux(platform)
  const demarrage = Number(/^btime (\d+)$/m.exec(readFileSync(path.join(racine, 'stat'), 'utf8'))?.[1]) * 1000
  if (!Number.isFinite(demarrage)) throw new Error('btime illisible : ' + path.join(racine, 'stat'))
  for (const nom of listerDossier(racine).filter((n) => /^\d+$/.test(n))) {
    if (pids && !pids.includes(Number(nom))) continue
    if (timeout !== undefined && Date.now() - debut >= timeout) return indeterminee(timeout)
    const dossier = path.join(racine, nom)
    const item = { pid: Number(nom), nom, proprietaire: null, commande: null, cwd: null, creation: null, erreurs: [] }
    const illisible = (champ, e) => item.erreurs.push(champ + ' illisible : ' + (e.code ? '[' + e.code + '] ' : '') + e.message)
    try { item.proprietaire = String(statSync(dossier).uid) }
    catch (e) { if (e.code === 'ENOENT') continue; illisible('proprietaire', e) }
    try {
      const avant = readFileSync(dossier + '/stat', 'utf8')
      const champs = avant.slice(avant.lastIndexOf(')') + 2).split(' ')
      const creation = champs[19]
      item.ppid = Number(champs[1])
      item.etat = champs[0]
      item.nom = avant.slice(avant.indexOf('(') + 1, avant.lastIndexOf(')'))
      item.creation = new Date(demarrage + (Number(creation) * 1000) / TICKS_PAR_SECONDE).toISOString()
      if (!identites) {
        try {
          const rss = /^VmRSS:\s+(\d+)\s+kB$/m.exec(readFileSync(dossier + '/status', 'utf8'))
          if (!rss) throw new Error('VmRSS absent')
          item.residentOctets = Number(rss[1]) * 1024
          item.metriqueMemoire = 'RSS Linux'
        } catch (e) { illisible('resident', e) }
        if (!memoireSeulement || aInspecter.has(item.pid)) {
          try {
            item.argv = readFileSync(dossier + '/cmdline', 'utf8').split('\0').filter(Boolean)
            item.commande = item.argv.join(' ')
          } catch (e) { illisible('commande', e) }
          try { item.cwd = readlinkSync(dossier + '/cwd') } catch (e) { illisible('cwd', e) }
          try { item.image = readlinkSync(dossier + '/exe') } catch (e) { illisible('image', e) }
        }
      }
      const apres = readFileSync(dossier + '/stat', 'utf8')
      if (apres.slice(apres.lastIndexOf(')') + 2).split(' ')[19] !== creation) throw Object.assign(new Error('identité modifiée pendant inspection'), { code: 'instable' })
    } catch (e) {
      if (e.code === 'ENOENT' || e.code === 'ESRCH') continue
      illisible('identite', e)
    }
    processus.push(item)
  }
  const vue = { utilisateur: String(uid), processus, erreurs: [], pids }
  return identites ? vue : porteeProcessus(vue)
}

export function racineProcessusLinux(platform = process.platform) {
  if (platform !== 'linux') throw new Error('namespace processus non supporté : ' + platform)
  return '/proc'
}

export const CONTRATS_DE_DERIVATION = [{ fonction: racineProcessusLinux, namespace: '/proc' }]
