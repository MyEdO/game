import { lstatSync, readFileSync, rmdirSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { depotDe, dossierGitCommun, etatDeLArbre } from './gitPorte.mjs'
import { estCiblePure } from '../../docs/lib/cibles-generees.mjs'
import { liensProcessus, mesurerProcessusWorktrees, sousArbre } from './processusWorktrees.mjs'
import { listerDossier } from './lister.mjs'

const RECONSTRUCTIBLES = ['node_modules', 'server/node_modules', 'dist', '.vite']
const liste = (chemin) => {
  try { return listerDossier(chemin) }
  catch (e) { if (e.code === 'ENOENT') return []; throw e }
}

export function ignoresAuthores(racine, ignores) {
  const authores = []
  const visiter = (rel) => {
    const chemin = join(racine, rel)
    const stat = lstatSync(chemin, { throwIfNoEntry: false })
    if (stat?.isSymbolicLink()) { authores.push(rel); return }
    const publication = rel === 'node_modules/.cache/publication' || rel.startsWith('node_modules/.cache/publication/')
    if (!publication && (estCiblePure(rel) || rel.split('/').includes('__pycache__') || RECONSTRUCTIBLES.some((r) => rel === r || rel.startsWith(r + '/')))) {
      if (rel === 'node_modules' || rel === 'node_modules/') {
        const cache = lstatSync(join(racine, 'node_modules/.cache'), { throwIfNoEntry: false })
        if (cache?.isSymbolicLink()) authores.push('node_modules/.cache')
        else if (lstatSync(join(racine, 'node_modules/.cache/publication'), { throwIfNoEntry: false })) visiter('node_modules/.cache/publication')
      }
      return
    }
    if (!stat) throw new Error('ignoré disparu pendant mesure : ' + rel)
    if (!stat.isDirectory() || stat.isSymbolicLink()) { authores.push(rel); return }
    const enfants = liste(chemin)
    if (!enfants.length) authores.push(rel + '/')
    for (const enfant of enfants) visiter(rel.replace(/\/$/, '') + '/' + enfant)
  }
  for (const chemin of ignores) visiter(chemin.replace(/\/$/, ''))
  return [...new Set(authores)].sort()
}

export function mesurerProtectionWorktree(chemin, { snapshot, processus = mesurerProcessusWorktrees, etat = etatDeLArbre, sessions } = {}) {
  const refus = []
  try {
    if (!isAbsolute(chemin)) throw new Error('chemin de worktree non absolu : ' + chemin)
    const vue = snapshot ?? processus()
    for (const p of vue.processus) {
      try {
        const liens = liensProcessus(p, chemin)
        if (liens.length) refus.push('PID ' + p.pid + ' — ' + p.commande + ' — ' + liens.join(', '))
      } catch (e) {
        const liens = liensProcessus(p, chemin, process.platform, { strict: false })
        if (liens.length) refus.push('PID ' + p.pid + ' — ' + p.commande + ' — ' + liens.join(', '))
        if (p.proprietaire && p.proprietaire === vue.utilisateur) refus.push('mesure processus indéterminée : PID ' + p.pid + ' ' + p.nom + ' — ' + e.message)
      }
    }
    for (const erreur of vue.erreurs ?? []) refus.push('mesure processus indéterminée : ' + erreur)
    const arbres = etat(depotDe(chemin), { ignores: true, strict: true })
    const sales = arbres.filter((e) => e.etat !== '!!').flatMap((e) => e.chemins)
    if (sales.length) refus.push('modifications non commitées : ' + sales.join(', '))
    const ignores = ignoresAuthores(chemin, arbres.filter((e) => e.etat === '!!').flatMap((e) => e.chemins))
    if (ignores.length) refus.push('ignoré authoré : ' + ignores.join(', '))
    const commun = dossierGitCommun(depotDe(chemin))
    if (!commun.disponible) throw new Error(commun.raison)
    const dossier = sessions ?? join(commun.valeur, 'sessions')
    for (const entree of liste(dossier).filter((e) => e.endsWith('.json'))) {
      const fichier = join(dossier, entree)
      const carte = JSON.parse(readFileSync(fichier, 'utf8'))
      if (!carte || typeof carte.worktree !== 'string' || !isAbsolute(carte.worktree) || typeof carte.etat !== 'string') throw new Error('carte session non attribuable : ' + fichier)
      if (!sousArbre(carte.worktree, chemin)) continue
      if (carte.etat !== 'fermee') refus.push('session ' + fichier + ' — ' + carte.etat)
      if (carte.etat === 'fermee' && (!carte.controleur || !carte.jobHost)) throw new Error('projection session fermée incomplète : ' + fichier)
      for (const id of [carte.controleur, carte.jobHost, carte.agentProcessus, carte.lanceur].filter(Boolean)) {
        if (!Number.isInteger(id.pid) || typeof id.creation !== 'string') throw new Error('identité session illisible : ' + fichier)
        const present = vue.processus.find((p) => p.pid === id.pid)
        if (present && !present.creation) throw new Error('identité session indéterminée : PID ' + id.pid + ' — ' + fichier)
        const vivant = present?.creation === id.creation ? present : null
        if (vivant) refus.push('session ' + fichier + ' — PID ' + vivant.pid + ' — ' + vivant.commande)
      }
    }
    return { ok: refus.length === 0, refus, portee: vue.portee }
  } catch (e) { return { ok: false, refus: [...refus, 'mesure indéterminée : ' + e.message] } }
}

export function retirerResiduelVide(chemin) {
  if (!isAbsolute(chemin) || dirname(resolve(chemin)) === resolve(chemin)) throw new Error('résidu : chemin absolu invalide ' + chemin)
  chemin = resolve(chemin)
  const stat = lstatSync(chemin, { throwIfNoEntry: false })
  if (!stat) return
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('résidu non répertoire ou lien : ' + chemin)
  rmdirSync(chemin)
}
