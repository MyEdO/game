import { lstatSync, readFileSync, rmdirSync, writeFileSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, resolve } from 'node:path'
import { depotDe, dossierGitCommun, etatDeLArbre } from './gitPorte.mjs'
import { estCiblePure } from '../../docs/lib/cibles-generees.mjs'
import { DELAI_MESURE_PROCESSUS_MS, liensProcessus, lireCause, mesurerProcessusWorktrees, porteeProcessus, sousArbre } from './processusWorktrees.mjs'
import { ancetresValidesDe } from './arbreProcessus.mjs'
import { CATEGORIES_DE_REFUS, prefixeDeRefus } from './categorieDeRefus.mjs'
import { CACHE_FRAICHEUR } from '../../docs/lib/cache-fraicheur.mjs'
import { listerDossier, listerEntrees } from './lister.mjs'
import { coupeAuMot } from '../../../src/lib/coupeAuMot.mjs'
import { normaliserRacine } from '../../port-dev.mjs'

const LARGEUR_DE_CITATION = 160
const ELEMENTS_CITES = 5
const citation = (texte) => coupeAuMot(String(texte ?? '').replace(/\s+/g, ' ').trim(), LARGEUR_DE_CITATION)
const enumeration = (libelle, elements, separateur = ', ') => libelle + ' (' + elements.length + ') : ' + elements.slice(0, ELEMENTS_CITES).join(separateur)
  + (elements.length > ELEMENTS_CITES ? separateur + '+' + (elements.length - ELEMENTS_CITES) + ' autres' : '')

const texteDeCause = (cause) => typeof cause === 'string' ? cause : cause.message ?? String(cause)
/** La catégorie d'un code d'erreur : `errno` de Node, `win32 <n>` du collecteur Windows
 *  (learn.microsoft.com/windows/win32/debug/system-error-codes--0-499-), `instable` des deux collecteurs. */
const CATEGORIES_DE_CODE = Object.freeze({
  EACCES: 'permission', EPERM: 'permission', 'win32 5': 'permission',
  ETIMEDOUT: 'transitoire', ESRCH: 'transitoire', ENOENT: 'transitoire', MESURE_PROCESSUS_EXPIREE: 'transitoire', 'win32 299': 'transitoire', instable: 'transitoire',
  EINVAL: 'validation',
})
function categorieDeCause(cause) {
  if (Object.hasOwn(CATEGORIES_DE_REFUS, cause?.categorie)) return cause.categorie
  const { code } = lireCause(cause)
  return Object.hasOwn(CATEGORIES_DE_CODE, code) ? CATEGORIES_DE_CODE[code] : 'panne'
}
const refusDeLecture = (cause) => lireCause(cause).champ !== null && categorieDeCause(cause) === 'permission'

/** Un processus nommé sur UNE ligne bornée : PID, exécutable, commande coupée au mot. */
export const designerProcessus = (p) => 'PID ' + p.pid + (p.nom ? ' ' + p.nom : '') + ' — ' + citation(p.commande)

const RECONSTRUCTIBLES = ['node_modules', 'server/node_modules', 'dist', '.vite', dirname(CACHE_FRAICHEUR).replaceAll('\\', '/')]

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
    if (!stat) throw Object.assign(new Error('ignoré disparu pendant mesure : ' + rel), { categorie: 'transitoire' })
    if (!stat.isDirectory() || stat.isSymbolicLink()) { authores.push(rel); return }
    for (const enfant of listerDossier(chemin, { absent: 'vide' })) visiter(rel.replace(/\/$/, '') + '/' + enfant)
  }
  for (const chemin of ignores) visiter(chemin.replace(/\/$/, ''))
  return [...new Set(authores)].sort()
}

/**
 * `commun` : le dossier git commun du dépôt, sans lequel un arbre À DEMI RETIRÉ (fichier `.git`
 * parti) ne se mesure pas (`depotDeLArbre`) ; ses suivis supprimés n'y comptent pas
 * (`horsSuppressions`).
 * @returns {{ok: boolean, refus: string[], indeterminees: string[], horsMesure: string[], portee?: string}}
 */
export function mesurerProtectionWorktree(chemin, { snapshot, processus = mesurerProcessusWorktrees, etat = etatDeLArbre, commun, sessions } = {}) {
  const refus = []
  const indeterminees = []
  const horsMesure = []
  const lies = []
  try {
    if (!isAbsolute(chemin)) throw Object.assign(new Error('chemin de worktree non absolu : ' + chemin), { categorie: 'validation' })
    const vue = porteeProcessus(snapshot ?? processus({ timeout: DELAI_MESURE_PROCESSUS_MS }))
    for (const p of vue.processus) {
      let liens = []
      const causes = [...p.erreurs]
      try {
        liens = liensProcessus(p, chemin)
      } catch (e) {
        liens = liensProcessus(p, chemin, process.platform, { strict: false })
        causes.push(e)
      }
      if (!p.cwd) {
        for (const ancetre of ancetresValidesDe(p.pid, vue.processus)) {
          if (!ancetre.cwd) continue
          let lie = false
          try { lie = sousArbre(ancetre.cwd, chemin) }
          catch (e) {
            causes.push({ message: 'ancêtre PID ' + ancetre.pid + ' : ' + e.message, categorie: categorieDeCause(e) })
            lie = liensProcessus({ cwd: ancetre.cwd }, chemin, process.platform, { strict: false }).includes('cwd')
          }
          if (lie) liens.push('ancêtre PID ' + ancetre.pid + ' cwd')
        }
      }
      if (liens.length) lies.push(designerProcessus(p) + ' — ' + citation(liens.map(citation).join(', ')))
      if (causes.length) {
        const groupes = new Map()
        for (const cause of causes) {
          const categorie = categorieDeCause(cause)
          if (!groupes.has(categorie)) groupes.set(categorie, new Set())
          groupes.get(categorie).add(texteDeCause(cause))
        }
        const exclu = p.cwd === null && !liens.length && causes.some((c) => lireCause(c).champ === 'cwd') && causes.every(refusDeLecture)
        for (const [categorie, textes] of groupes) {
          const diagnostic = prefixeDeRefus(categorie) + ' PID ' + p.pid + ' ' + (p.nom ?? '') + (p.image ? ' image=' + p.image : '') + ' : ' + citation([...textes].join('; '))
          ;(exclu ? horsMesure : indeterminees).push(diagnostic)
        }
      }
    }
    if (lies.length) refus.push(prefixeDeRefus('métier') + ' ' + enumeration('processus liés', lies, ' | '))
    for (const erreur of vue.erreursGlobales) indeterminees.push(prefixeDeRefus(vue.code === 'MESURE_PROCESSUS_EXPIREE' ? 'transitoire' : categorieDeCause(erreur)) + ' ' + citation(texteDeCause(erreur)))
    if (vue.indeterminee && !vue.erreursGlobales.length) indeterminees.push(prefixeDeRefus(vue.code === 'MESURE_PROCESSUS_EXPIREE' ? 'transitoire' : 'panne') + ' ' + citation(vue.indeterminee))
    refus.push(...new Set(indeterminees))
    const demiRetire = !lstatSync(join(chemin, '.git'), { throwIfNoEntry: false })
    const arbres = etat(depotDeLArbre(chemin, commun), { ignores: true, strict: true })
    const sales = (demiRetire ? horsSuppressions(arbres) : arbres).filter((e) => e.etat !== '!!').flatMap((e) => e.chemins)
    if (sales.length) refus.push(prefixeDeRefus('métier') + ' ' + enumeration('modifications non commitées', sales))
    const ignores = ignoresAuthores(chemin, arbres.filter((e) => e.etat === '!!').flatMap((e) => e.chemins))
    if (ignores.length) refus.push(prefixeDeRefus('métier') + ' ' + enumeration('ignoré authoré', ignores))
    let dossier = sessions ?? (commun && join(commun, 'sessions'))
    if (!dossier) {
      const lu = dossierGitCommun(depotDe(chemin))
      if (!lu.disponible) throw new Error(lu.raison)
      dossier = join(lu.valeur, 'sessions')
    }
    const lues = listerEntrees(dossier, { absent: 'vide' })
    if (lues.nature === 'other') throw new Error('dossier sessions non répertoire : ' + dossier)
    for (const { nom } of lues.entrees.filter((e) => e.nom.endsWith('.json'))) {
      const fichier = join(dossier, nom)
      const carte = JSON.parse(readFileSync(fichier, 'utf8'))
      if (!carte || typeof carte.worktree !== 'string' || !isAbsolute(carte.worktree) || typeof carte.etat !== 'string') throw Object.assign(new Error('carte session non attribuable : ' + fichier), { categorie: 'validation' })
      if (!sousArbre(carte.worktree, chemin)) continue
      if (carte.etat !== 'fermee') refus.push(prefixeDeRefus('métier') + ' session ' + fichier + ' — ' + carte.etat)
      if (carte.etat === 'fermee' && (!carte.controleur || !carte.jobHost)) throw new Error('projection session fermée incomplète : ' + fichier)
      for (const id of [carte.controleur, carte.jobHost, carte.agentProcessus, carte.lanceur].filter(Boolean)) {
        if (!Number.isInteger(id.pid) || typeof id.creation !== 'string') throw new Error('identité session illisible : ' + fichier)
        const present = vue.processus.find((p) => p.pid === id.pid)
        if (present && !present.creation) throw new Error('identité session indéterminée : PID ' + id.pid + ' — ' + fichier)
        const vivant = present?.creation === id.creation ? present : null
        if (vivant) refus.push(prefixeDeRefus('métier') + ' session ' + fichier + ' — ' + designerProcessus(vivant))
      }
    }
    return { ok: refus.length === 0, refus, indeterminees, horsMesure, portee: vue.portee }
  } catch (e) { return { ok: false, refus: [...refus, prefixeDeRefus(categorieDeCause(e)) + ' mesure indéterminée : ' + e.message], indeterminees, horsMesure } }
}

/**
 * Le dossier d'administration `<commun>/worktrees/<id>` de l'arbre `chemin` : le seul dont le
 * `gitdir` nomme `<chemin>/.git` (`git help gitrepository-layout`, « worktrees/<id>/gitdir »).
 * @param {string} chemin @param {string} commun @returns {string | null} `null` sans dossier unique
 */
export function administrationDe(chemin, commun) {
  const administration = join(commun, 'worktrees')
  const cible = normaliserRacine(join(chemin, '.git'))
  const ids = listerDossier(administration, { absent: 'vide' }).filter((id) => {
    const gitdir = join(administration, id, 'gitdir')
    return lstatSync(gitdir, { throwIfNoEntry: false })?.isFile() && normaliserRacine(readFileSync(gitdir, 'utf8').trim()) === cible
  })
  return ids.length === 1 ? join(administration, ids[0]) : null
}

/**
 * Le dépôt de l'arbre `chemin` ; À DEMI RETIRÉ (fichier `.git` parti), lu par SON dossier
 * d'administration (`administrationDe`, `git help git`, « GIT_DIR », « GIT_WORK_TREE »), sans rien
 * écrire : depuis le dossier seul, git répondrait pour le dépôt parent.
 * @param {string} chemin @param {string} [commun] @param {Parameters<typeof depotDe>[1]} [options] ceux de `depotDe`
 * @throws {Error} catégorie `validation`, sans dossier unique
 */
export function depotDeLArbre(chemin, commun, options = {}) {
  if (lstatSync(join(chemin, '.git'), { throwIfNoEntry: false })) return depotDe(chemin, options)
  const administration = commun ? administrationDe(chemin, commun) : null
  if (!administration) throw Object.assign(new Error('fichier .git absent de ' + chemin + ' : git y lirait le dépôt parent'
    + (commun ? ', et aucun dossier unique de ' + join(commun, 'worktrees') + ' ne le nomme' : '')), { categorie: 'validation' })
  return depotDe(chemin, { ...options, env: { ...(options.env ?? process.env), GIT_DIR: administration, GIT_WORK_TREE: chemin } })
}

/** L'état d'un arbre À DEMI RETIRÉ sans ses suivis supprimés (` D`) : ce que le retrait interrompu
 *  a effacé, que l'index restaure. PURE. */
export const horsSuppressions = (etat) => etat.filter((e) => e.etat !== ' D')

/**
 * Le fichier `.git` de l'arbre `chemin` RECRÉÉ vers SON dossier d'administration
 * (`administrationDe`), en création exclusive. `git worktree repair` réécrit les `.git` de TOUS les
 * worktrees, ceux d'un retrait voisin en cours compris.
 * @param {string} chemin @param {string} commun @returns {string | null} l'id relié, `null` sans dossier unique
 */
export function relierFichierGit(chemin, commun) {
  const administration = administrationDe(chemin, commun)
  if (!administration) return null
  writeFileSync(join(chemin, '.git'), 'gitdir: ' + administration.replaceAll('\\', '/') + '\n', { flag: 'wx' })
  return basename(administration)
}

export function retirerResiduelVide(chemin) {
  if (!isAbsolute(chemin) || dirname(resolve(chemin)) === resolve(chemin)) throw new Error('résidu : chemin absolu invalide ' + chemin)
  chemin = resolve(chemin)
  const stat = lstatSync(chemin, { throwIfNoEntry: false })
  if (!stat) return
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('résidu non répertoire ou lien : ' + chemin)
  rmdirSync(chemin)
}
