import { mesurerProcessusWorktrees, classerFiliation, DELAI_MESURE_PROCESSUS_MS } from './processusWorktrees.mjs'
import { prefixeDeRefus } from './categorieDeRefus.mjs'
import { estPidVivantDepuis } from './pid.mjs'
import { IDENTITE_MESUREE } from '../../test/identiteMesuree.mjs'

/** La vue des processus de la machine et leurs identités ; une mesure expirée se retente une fois, et sa seconde échéance
 *  lève un refus transitoire ; une mesure qui lève, un refus de panne (#2741). */
export function mesurerArbreProcessus() {
  for (let tentative = 0; ; tentative++) {
    let vue
    try { vue = mesurerProcessusWorktrees({ identites: true, timeout: DELAI_MESURE_PROCESSUS_MS }) }
    catch (cause) {
      throw Object.assign(new Error(prefixeDeRefus('panne') + ' ' + cause.message, { cause }), { code: cause.code ?? 'MESURE_PROCESSUS_IMPOSSIBLE', categorie: 'panne' })
    }
    if (!vue.indeterminee) return vue.processus
    if (tentative > 0) throw Object.assign(new Error(prefixeDeRefus('transitoire') + ' ' + vue.indeterminee), { code: vue.code, categorie: 'transitoire' })
  }
}

function identitePresente(identite, vue) {
  return Boolean(identite?.creation && vue.some((p) => p.pid === identite.pid && p.creation === identite.creation && p.etat !== 'Z'))
}

/** L'identité capturée `gardien` (`pid`, `creation`) a-t-elle disparu ? Jugée dans la `vue` mesurée, sinon (`null`, mesure
 *  en échec) par son pid et sa création mesurée : seule une mort ou une réutilisation PROUVÉE rend `true` (#2586, #2626). */
export function gardienDisparu(gardien, vue) {
  if (vue) return !identitePresente(gardien, vue)
  try { return !estPidVivantDepuis(gardien.pid, Date.parse(gardien.creation), IDENTITE_MESUREE) }
  catch { return false }
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
