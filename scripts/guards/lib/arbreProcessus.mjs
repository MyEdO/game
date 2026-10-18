import { mesurerProcessusWorktrees, classerFiliation } from './processusWorktrees.mjs'

export function mesurerArbreProcessus() {
  const vue = mesurerProcessusWorktrees({ identites: true, timeout: 5000 })
  if (vue.indeterminee || vue.erreurs?.length) throw new Error(vue.indeterminee ?? vue.erreurs.join('; '))
  return vue.processus
}

export function identitePresente(identite, vue) {
  return Boolean(identite?.creation && vue.some((p) => p.pid === identite.pid && p.creation === identite.creation && p.etat !== 'Z'))
}

export function filiationValide(parent, enfant) {
  return classerFiliation(parent, enfant) === 'valide'
}

export function ancetresValidesDe(pid, vue) {
  const parPid = new Map(vue.map((p) => [p.pid, p]))
  let enfant = parPid.get(pid)
  if (!filiationValide(enfant, enfant)) return []
  const ancetres = []
  const vus = new Set([pid])
  for (;;) {
    const parent = parPid.get(enfant.ppid)
    if (!parent || vus.has(parent.pid) || !filiationValide(parent, enfant)) break
    vus.add(parent.pid)
    ancetres.push(parent)
    enfant = parent
  }
  return ancetres
}
