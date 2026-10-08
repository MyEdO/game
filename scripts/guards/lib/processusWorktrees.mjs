import { readFileSync, readlinkSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { versCheminNatif } from './commandeShell.mjs'
import { canoniser } from '../../docs/lib/chemin-mesure.mjs'
import { listerDossier } from './lister.mjs'

export const sousArbre = (chemin, racine, platform = process.platform, { strict = true } = {}) => {
  const p = platform === 'win32' ? path.win32 : path.posix
  const normaliser = (c) => {
    const absolu = p.resolve(c)
    const reel = platform === process.platform ? canoniser(absolu, { strict }) : absolu
    return platform === 'win32' ? reel.toLowerCase() : reel
  }
  const rel = p.relative(normaliser(racine), normaliser(chemin))
  return rel === '' || (!rel.startsWith('..' + p.sep) && rel !== '..' && !p.isAbsolute(rel))
}

export function argumentsProcessus(commande) {
  return [...String(commande).matchAll(/"([^"]*)"|'([^']*)'|([^\s"']+)/g)].map((m) => m[1] ?? m[2] ?? m[3])
}

export function liensProcessus(processus, racine, platform = process.platform, options) {
  const p = platform === 'win32' ? path.win32 : path.posix
  const liens = []
  if (processus.cwd && sousArbre(processus.cwd, racine, platform, options)) liens.push('cwd')
  for (const brut of [...(processus.argv ?? argumentsProcessus(processus.commande)), ...referencesCommande(processus.commande)]) {
    const argument = brut.startsWith('--') && brut.includes('=') ? brut.slice(brut.indexOf('=') + 1) : brut
    if (argument.startsWith('-')) continue
    let chemin = versCheminNatif(argument, platform)
    if (/^file:\/\//i.test(chemin)) {
      try { chemin = fileURLToPath(chemin, { windows: platform === 'win32' }) }
      catch { continue }
    }
    if ((p.isAbsolute(chemin) || processus.cwd) && sousArbre(p.resolve(processus.cwd || p.parse(racine).root, chemin), racine, platform, options)) liens.push('argument ' + brut)
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
  const horsPortee = vue.processus.filter((p) => !p.proprietaire || p.proprietaire !== vue.utilisateur)
  const noms = [...new Set(horsPortee.map((p) => p.nom || 'PID ' + p.pid))].sort()
  const erreurs = [...(vue.erreurs ?? [])]
  for (const p of vue.processus.filter((p) => p.proprietaire === vue.utilisateur)) {
    const causes = [...(p.erreurs ?? [])]
    if (!p.commande) causes.push('commande illisible')
    if (!p.cwd) causes.push('cwd illisible')
    if (!p.creation) causes.push('création illisible')
    if (causes.length) erreurs.push('PID ' + p.pid + ' ' + p.nom + ' : ' + [...new Set(causes)].join('; '))
  }
  return { ...vue, erreurs: [...new Set(erreurs)], horsPortee, portee: `examinés : commandes et cwd lisibles de tous les processus ; utilisateur=${vue.utilisateur} ; hors portée : ${horsPortee.length} processus d'autres comptes ou propriétaires illisibles (${noms.join(', ') || 'aucun'}) — propriétaire seul exclu du jugement d'indétermination` }
}

export function mesurerProcessusWorktrees({ platform = process.platform, pids } = {}) {
  if (platform === 'win32') {
    const system = process.env.SystemRoot
    if (!system) throw new Error('SystemRoot absent : lecteur Windows introuvable')
    const executable = path.join(system, process.arch === 'ia32' ? 'Sysnative' : 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
    return porteeProcessus(JSON.parse(execFileSync(executable, ['-NoProfile', '-NonInteractive', '-File', fileURLToPath(new URL('../../ops/processus-worktrees.ps1', import.meta.url)), ...(pids ? ['-Pids', pids.join(',')] : [])], { encoding: 'utf8', maxBuffer: 16 << 20 })))
  }
  if (platform !== 'linux') throw new Error('mesure processus non supportée : ' + platform)
  const uid = process.getuid()
  const processus = []
  const racine = racineProcessusLinux(platform)
  for (const nom of listerDossier(racine).filter((n) => /^\d+$/.test(n))) {
    if (pids && !pids.includes(Number(nom))) continue
    const dossier = path.join(racine, nom)
    const item = { pid: Number(nom), nom, proprietaire: null, commande: null, cwd: null, creation: null, erreurs: [] }
    try { item.proprietaire = String(statSync(dossier).uid) }
    catch (e) { if (e.code === 'ENOENT') continue; item.erreurs.push('propriétaire illisible : ' + e.message) }
    try {
      const avant = readFileSync(dossier + '/stat', 'utf8')
      const creation = avant.slice(avant.lastIndexOf(')') + 2).split(' ')[19]
      item.nom = avant.slice(avant.indexOf('(') + 1, avant.lastIndexOf(')'))
      item.creation = creation
      try {
        item.argv = readFileSync(dossier + '/cmdline', 'utf8').split('\0').filter(Boolean)
        item.commande = item.argv.join(' ')
        if (!item.commande) item.erreurs.push('commande illisible')
      } catch (e) { item.erreurs.push('commande illisible : ' + e.message) }
      try { item.cwd = readlinkSync(dossier + '/cwd') } catch (e) { item.erreurs.push('cwd illisible : ' + e.message) }
      const apres = readFileSync(dossier + '/stat', 'utf8')
      if (apres.slice(apres.lastIndexOf(')') + 2).split(' ')[19] !== creation) throw new Error('identité modifiée pendant inspection')
    } catch (e) {
      if (e.code === 'ENOENT' || e.code === 'ESRCH') continue
      item.erreurs.push(e.message)
    }
    processus.push(item)
  }
  return porteeProcessus({ utilisateur: String(uid), processus })
}

export function racineProcessusLinux(platform = process.platform) {
  if (platform !== 'linux') throw new Error('namespace processus non supporté : ' + platform)
  return '/proc'
}

export const CONTRATS_DE_DERIVATION = [{ fonction: racineProcessusLinux, namespace: '/proc' }]
