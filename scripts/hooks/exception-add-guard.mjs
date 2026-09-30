// Garde PreToolUse des canaux d'écriture (`OUTILS_ECRITURE`) des tables d'exceptions de garde : doctrine
// `user-doctrine-gardes-jamais-de-ask` (2026-07-13, 2026-09-28) ; juge de diff : `.claude/agents/juge.md`.
import { readFileSync } from 'node:fs'
import { OUTILS_ECRITURE, cheminVise, ecritLeFichierEntier, ecrituresDe, texteAvant, texteNeuf } from '../guards/lib/contratGarde.mjs'
import { SUFFIXE_SUITE } from '../guards/lib/fichierVitest.mjs'
import { cheminDEcriture } from './solde-ticket-guard.mjs'

// Gardes-tests connus, par leur NOM NU : une liste de noms se compare en CHAÎNE, jamais par regex
// (aucune de ces entrées ne porte de joker).
const GARDES_NOMMEES = new Set([
  'label-logic-guard.test.ts',
  'ui-ratchets.test.ts',
  'component-conformance.test.ts',
  'no-emoji-affordance.test.ts',
  'comment-poison-guard.test.ts',
])
// Les deux FORMES gardées quel que soit le nom : toute lib de `scripts/guards/` (whitelists), et
// toute suite `*-guard` — le suffixe de suite vient du prédicat partagé (`fichierVitest.mjs`),
// couverture par motif et non par liste figée.
const DANS_GUARDS = /[\\/]scripts[\\/]guards[\\/]/
const SUITE_DE_GARDE = new RegExp('-guard' + SUFFIXE_SUITE + '$')
/** Ce fichier porte-t-il une table d'exceptions/baseline gardée ? */
export const estFichierGarde = (file) =>
  GARDES_NOMMEES.has(String(file).split(/[\\/]/).pop()) || DANS_GUARDS.test(file) || SUITE_DE_GARDE.test(file)

/** Multiset des « jetons de table » d'un extrait : TOUTE chaîne quotée (simple/double/backtick, peu
 *  importe le packing de ligne) + TOUTE clé d'objet NON quotée (`ident:`). Le multiset compare
 *  l'ensemble — deux entrées quotées sur une ligne ou une clé nue ne peuvent plus passer. */
export function entries(text) {
  const bag = new Map()
  const add = (k) => bag.set(k, (bag.get(k) ?? 0) + 1)
  for (const m of text.matchAll(/(['"`])((?:\\.|(?!\1)[^\n])*)\1/g)) add(m[2])
  // Clé d'objet NON quotée : ident suivi de `:`, hors accès `.prop` et hors intérieur d'une chaîne
  // déjà captée (lookbehind : pas précédé de `.` ni d'un guillemet).
  for (const m of text.matchAll(/(?<![\w$.'"`])([A-Za-z_$][\w$]*)\s*:/g)) add(m[1])
  return bag
}
/** Paires clé quotée → nombre (baselines de cliquet). Dernière occurrence gagne. */
export function baselines(text) {
  const map = new Map()
  for (const m of text.matchAll(/(['"])((?:(?!\1)[^\n])+)\1\s*:\s*(\d+)/g)) map.set(m[2], Number(m[3]))
  return map
}

/**
 * Décision du hook (PURE, testable) pour une écriture donnée.
 * @param {{ file: string, before: string, after: string, isWrite: boolean, exists: boolean }} p
 * @returns {{ contexte: string } | null}  — non-null = avertissement, null = silence.
 */
export function evaluate({ file, before, after, isWrite, exists }) {
  if ((isWrite && !exists) || !estFichierGarde(file)) return null

  const beforeBag = entries(before)
  const afterBag = entries(after)
  let added = []
  const removed = []
  for (const [k, n] of afterBag) if (n > (beforeBag.get(k) ?? 0)) added.push(k)
  for (const [k, n] of beforeBag) if (n > (afterBag.get(k) ?? 0)) removed.push(k)
  // RE-POINTAGE (clé `chemin:ligne` dont seule la ligne bouge, un retrait apparié) ≠ ajout : le
  // décalage de lignes est le quotidien des refactors, il ne demande rien.
  const stem = (k) => { const m = /^(.*):\d+$/.exec(k); return m ? m[1] : null }
  const removedStems = removed.map(stem).filter(Boolean)
  added = added.filter((k) => {
    const s = stem(k)
    const i = s ? removedStems.indexOf(s) : -1
    if (i === -1) return true
    removedStems.splice(i, 1) // un retrait n'apparie qu'UN ajout
    return false
  })

  const beforeBase = baselines(before)
  const afterBase = baselines(after)
  const raised = []
  for (const [k, n] of afterBase) {
    const prev = beforeBase.get(k)
    if (prev != null && n > prev) raised.push(`${k} : ${prev} → ${n}`)
  }
  // Une hausse de baseline est AUSSI comptée comme « entrée ajoutée » par le multiset quand la clé
  // est nouvelle — dédoublonne : une clé signalée en hausse n'est pas re-signalée en ajout.
  const raisedKeys = new Set(raised.map((r) => r.split(' : ')[0]))
  const netAdded = added.filter((k) => !raisedKeys.has(k))

  if (netAdded.length === 0 && raised.length === 0) return null

  const parts = []
  if (netAdded.length) parts.push(`AJOUT d'exception(s)/entrée(s) de garde : ${netAdded.slice(0, 5).join(' · ')}${netAdded.length > 5 ? ` (+${netAdded.length - 5})` : ''}`)
  if (raised.length) parts.push(`HAUSSE de baseline (cliquet à rebours) : ${raised.slice(0, 5).join(' · ')}`)
  return { contexte:
    `${AVERTISSEMENT} — ${file.split(/[\\/]/).pop()} : ${parts.join(' ; ')}.` }
}

export const AVERTISSEMENT = "ajout d'exception : le juge de diff doit le justifier au rendu"

/** Normalise UNE écriture (`ecrituresDe`) en `{ file, before, after, isWrite, exists }`. Renvoie
 *  `null` quand rien n'est comparable (aucun texte posé). Un remplacement se compare à `texteAvant`. */
export function readWrite(input) {
  const after = texteNeuf(input)
  if (typeof after !== 'string') return null
  const file = String(cheminVise(input) ?? '')
  if (!ecritLeFichierEntier(input)) {
    const lire = () => { try { return readFileSync(file, 'utf8') } catch { return '' } }
    return { file, before: String(texteAvant(input, lire)), after, isWrite: false, exists: true }
  }
  let before
  let exists = true
  try { before = readFileSync(file, 'utf8') } catch { before = ''; exists = false }
  return { file, before, after, isWrite: true, exists }
}

/** L'avertissement pour UNE écriture, `null` sans ajout. */
function avertissement(ecrit) {
  const chemin = cheminDEcriture(ecrit)
  const w = readWrite(chemin ? { ...ecrit, file_path: chemin.reel } : ecrit)
  const decision = w ? evaluate(w) : null
  return decision && !chemin?.horsContenu ? decision : null
}

const evaluer = (entree) => ecrituresDe(entree).map(avertissement)

export const garde = { nom: 'exception-add', outils: OUTILS_ECRITURE, evaluer }
