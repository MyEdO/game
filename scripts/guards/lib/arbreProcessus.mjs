import { spawnSync } from 'node:child_process'
import { mesurerProcessusWorktrees } from './processusWorktrees.mjs'

export function descendantsDe(pid, sortiePs) {
  const enfants = new Map()
  for (const ligne of String(sortiePs).split('\n')) {
    const m = /^\s*(\d+)\s+(\d+)\s*$/.exec(ligne)
    if (!m) continue
    const parent = Number(m[2])
    enfants.set(parent, [...(enfants.get(parent) ?? []), Number(m[1])])
  }
  const vus = new Set([pid]); const ordre = []
  const visiter = (p) => {
    for (const enfant of enfants.get(p) ?? []) if (!vus.has(enfant)) {
      vus.add(enfant); visiter(enfant); ordre.push(enfant)
    }
  }
  visiter(pid)
  return ordre
}

export function tuerArbre(pid, { plateforme = process.platform, lister = () => spawnSync('ps', ['-A', '-o', 'pid=,ppid='], { encoding: 'utf8' }).stdout ?? '', tuer = tuerUnPid } = {}) {
  if (!pid) return
  if (plateforme === 'win32') {
    spawnSync('taskkill', ['/T', '/F', '/PID', String(pid)], { stdio: 'ignore', windowsHide: true })
    return
  }
  for (const descendant of descendantsDe(pid, lister())) tuer(descendant)
  tuer(pid); tuer(-pid)
}

function tuerUnPid(pid) {
  try { process.kill(pid, 'SIGKILL') } catch {}
}

export function mesurerArbreProcessus() {
  const vue = mesurerProcessusWorktrees({ identites: true, timeout: 5000 })
  if (vue.indeterminee || vue.erreurs?.length) throw new Error(vue.indeterminee ?? vue.erreurs.join('; '))
  return vue.processus
}

export function identitePresente(identite, vue) {
  return Boolean(identite?.creation && vue.some((p) => p.pid === identite.pid && p.creation === identite.creation))
}

export function filiationValide(parent, enfant) {
  const creationDe = (p) => typeof p?.creation === 'string' && Number.isFinite(Date.parse(p.creation)) && p.creation.endsWith('Z')
    ? p.creation.replace(/(?:\.(\d+))?Z$/, (_fin, fraction = '') => `.${fraction.padEnd(9, '0')}Z`) : null
  const creationParent = creationDe(parent)
  const creationEnfant = creationDe(enfant)
  return creationParent !== null && creationEnfant !== null && creationEnfant >= creationParent
}

export function capturerDescendants(pid, vue, captures = new Map()) {
  const parPid = new Map(vue.map((p) => [p.pid, p]))
  const liens = vue.filter((p) => filiationValide(parPid.get(p.ppid), p))
  const pids = descendantsDe(pid, liens.map((p) => `${p.pid} ${p.ppid}`).join('\n'))
  for (const descendant of pids) {
    const p = vue.find((p) => p.pid === descendant)
    if (p?.creation) captures.set(p.pid, p)
  }
  return captures
}

export function tuerCaptures(captures, vue = mesurerArbreProcessus()) {
  const profondeur = (p, vus = new Set()) => {
    if (vus.has(p.pid) || !captures.has(p.ppid)) return 0
    vus.add(p.pid)
    return 1 + profondeur(captures.get(p.ppid), vus)
  }
  for (const p of [...captures.values()].sort((a, b) => profondeur(b) - profondeur(a))) if (identitePresente(p, vue)) {
    if (process.platform === 'win32') spawnSync('taskkill', ['/F', '/PID', String(p.pid)], { stdio: 'ignore', windowsHide: true })
    else tuerUnPid(p.pid)
  }
}
