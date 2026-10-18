// PANNE de l'outillage des hooks d'appel d'outil (#2712) : une garde, le répartiteur ou leur chargement qui
// LÈVE refuse l'appel (leçon 1.5 du guide de certification), sauf l'EXUTOIRE de la session principale : ses
// éditions de fichier, seul geste qui répare un module cassé sans que la panne sache toujours le nommer (une
// erreur de syntaxe ESM ne porte aucun chemin), et l'installation des dépendances quand c'en est une qui
// manque. Imports statiques : modules intégrés de Node et la barrière seuls, qui le charge quand tout le reste a échoué.
import { isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { editionDeSessionPrincipale } from './barriere-outil.mjs'

/** Les options admises aux commandes d'installation : aucune garde ne juge ce qui passe par là. */
const OPTIONS = String.raw`(\s+--(no-audit|no-fund|ignore-scripts|omit=dev|include=dev|prefer-offline))*`
const INSTALLATIONS = [new RegExp(`^npm (ci|install)${OPTIONS}$`), new RegExp(`^npm --prefix server (ci|install)${OPTIONS}$`)]

const versChemin = (brut) => (brut.startsWith('file://') ? fileURLToPath(brut) : brut)

const dansLArbre = (chemin, racine) => {
  const rel = relative(racine, chemin)
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel) && !rel.split(sep).includes('node_modules')
}

const CHEMIN = /(file:\/\/\/(?:[A-Za-z]:)?[^\s'"():]+|(?:[A-Za-z]:)?[\\/][^\s'"():]+?\.(?:json|mjs|cjs|tsx|ts|js))(?=[\s'"():]|$)/g

/**
 * La CAUSE d'une panne `e` sous `racine` : `dependance` quand un paquet npm manque, sinon `code` ; et les fichiers
 * de l'arbre que l'erreur nomme, message puis pile, hors `node_modules` — indicatifs, ils ne bornent rien. PURE.
 * @returns {{ genre: 'dependance' | 'code', fichiers: string[], message: string }}
 */
export function causeDePanne(e, racine) {
  const message = String(e?.message ?? e)
  const genre = e?.code === 'ERR_MODULE_NOT_FOUND' && /Cannot find package/.test(message) ? 'dependance' : 'code'
  const fichiers = [...new Set([...`${message}\n${e?.stack ?? ''}`.matchAll(CHEMIN)].map((m) => resolve(versChemin(m[1]))))].filter((c) => dansLArbre(c, racine))
  return { genre, fichiers, message }
}

/**
 * L'appel `entree` passe-t-il malgré la panne `cause` ? En session principale : une édition de fichier, et une
 * commande d'installation quand la cause est une dépendance absente. Un sous-agent ne franchit rien : son
 * cloisonnement est une garde, tombée elle aussi. PURE.
 */
export function franchitLaPanne(entree, cause) {
  if (editionDeSessionPrincipale(entree)) return true
  if (entree?.agent_id || entree?.tool_name !== 'Bash' || cause.genre !== 'dependance') return false
  return INSTALLATIONS.some((motif) => motif.test(String(entree?.tool_input?.command ?? '').trim()))
}

/** Le geste qui répare `cause`, à rendre dans le refus. PURE. */
export function gesteDeReparation(cause, racine) {
  if (cause.genre === 'dependance') return 'dépendance npm absente : lancer `npm ci` (seule commande admise)'
  const ou = cause.fichiers.length ? ` (nommé : ${cause.fichiers.map((c) => relative(racine, c)).join(', ')})` : ''
  return `corriger le module en panne${ou} par une édition de fichier, seul geste admis en session principale`
}

/** La panne `e` pour l'appel `entree` : son message, son geste de réparation, et si l'appel la franchit. PURE. */
export function panneDe(e, entree, racine) {
  const cause = causeDePanne(e, racine)
  return { message: cause.message, geste: gesteDeReparation(cause, racine), franchit: franchitLaPanne(entree, cause) }
}
