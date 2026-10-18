import { mesurerProcessusWorktrees, classerFiliation } from './processusWorktrees.mjs'
import { prefixeDeRefus } from './categorieDeRefus.mjs'

export function mesurerArbreProcessus({ mesurer = mesurerProcessusWorktrees } = {}) {
  for (let tentative = 0; tentative < 2; tentative++) {
    let vue
    try { vue = mesurer({ identites: true, timeout: 5000 }) }
    catch (cause) {
      const categorie = cause.categorie ?? 'panne'
      throw Object.assign(new Error(prefixeDeRefus(categorie) + ' ' + cause.message, { cause }), { code: cause.code ?? 'MESURE_PROCESSUS_IMPOSSIBLE', categorie })
    }
    if (vue.code === 'MESURE_PROCESSUS_EXPIREE' && tentative === 0) continue
    if (vue.indeterminee || vue.erreurs?.length) {
      const categorie = vue.code === 'MESURE_PROCESSUS_EXPIREE' ? 'transitoire' : 'panne'
      throw Object.assign(new Error(prefixeDeRefus(categorie) + ' ' + (vue.indeterminee ?? vue.erreurs.join('; '))), { code: vue.code ?? 'MESURE_PROCESSUS_IMPOSSIBLE', categorie })
    }
    return vue.processus
  }
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
