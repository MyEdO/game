// Hook PreToolUse(Write|Edit) : les TABLES D'EXCEPTIONS/WHITELISTS des gardes ne grossissent
// JAMAIS sans l'utilisateur (demande du 2026-07-13) — toute écriture qui AJOUTE une entrée à une
// table d'exceptions de garde, ou qui AUGMENTE une baseline de cliquet, exige sa confirmation
// explicite. Les re-pointages (clé remplacée, compte constant) et les RETRAITS passent sans
// friction. Opposable aux sessions ET aux sous-agents.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
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
// Motif de CRÉATION de garde : tout fichier dont le nom/chemin annonce une garde (`-guard`, `guards/`).
// Un fichier de garde NEUF est gardé DÈS sa création — parade au déplacement d'une whitelist vers un
// nouveau fichier hors de la liste nominative `GARDES_NOMMEES`.
export const GUARD_FILE = /(-guard(?:\.|\b)|[\\/]guards?[\\/])/i

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
 * @returns {{ reason: string } | null}  — non-null = `ask`, null = silence.
 */
export function evaluate({ file, before, after, isWrite, exists }) {
  // CRÉATION d'un fichier de garde (Write sur fichier inexistant du motif) : ask systématique.
  if (isWrite && !exists && GUARD_FILE.test(file)) {
    return { reason: `⚠ ${file.split(/[\\/]/).pop()} — création d'un fichier de garde : vérifier qu'il ne DÉPLACE pas une whitelist existante ` +
      `(les tables d'exceptions ne grossissent qu'avec l'AUTORISATION de l'utilisateur, demande 2026-07-13). Confirmer = valider CE nouveau fichier.` }
  }
  if (!estFichierGarde(file)) return null

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
  return { reason:
    `⚠ ${file.split(/[\\/]/).pop()} — ${parts.join(' ; ')}. Les tables d'exceptions des gardes ne ` +
    `grossissent qu'avec l'AUTORISATION de l'utilisateur (demande 2026-07-13) : confirmer ce dialogue ` +
    `VAUT autorisation pour CES entrées précises ; refuser sinon (re-pointages et retraits passent seuls).` }
}

/** Normalise l'entrée d'outil (`Write`/`Edit`) en `{ file, before, after, isWrite, exists }`. Renvoie
 *  `null` quand rien n'est comparable (stdin illisible / forme inconnue). */
export function readWrite(input) {
  if (!input) return null
  const file = String(input.file_path ?? input.path ?? '')
  if (typeof input.new_string === 'string') {
    return { file, before: String(input.old_string ?? ''), after: input.new_string, isWrite: false, exists: true }
  }
  if (typeof input.content === 'string') {
    let before
    let exists = true
    try { before = readFileSync(file, 'utf8') } catch { before = ''; exists = false }
    return { file, before, after: input.content, isWrite: true, exists }
  }
  return null
}

// ── Driver stdin (n'exécute QUE lancé en direct, jamais à l'import du module de test) ─────────────
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  let raw = ''
  process.stdin.setEncoding('utf8')
  for await (const chunk of process.stdin) raw += chunk
  let input = null
  try { input = JSON.parse(raw)?.tool_input ?? null } catch { /* stdin illisible → silence */ }
  const chemin = cheminDEcriture(input)
  const w = readWrite(chemin ? { ...input, file_path: chemin.reel } : input)
  const decision = w ? evaluate(w) : null
  if (decision && !chemin?.horsContenu) {
    console.log(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'ask',
        permissionDecisionReason: decision.reason,
      },
    }))
  }
  process.exit(0)
}
