// Hook PreToolUse(Write|Edit) : le tag `[entériné AAAA-MM-JJ]` est RÉSERVÉ à l'utilisateur (credo,
// règle 6b) — toute écriture qui l'INTRODUIT exige sa confirmation explicite : ce dialogue EST la
// validation. Opposable aux sessions ET aux sous-agents (aucune mémoire/discipline requise).
import { readFileSync } from 'node:fs'
import { cheminDEcriture } from './solde-ticket-guard.mjs'

let raw = ''
process.stdin.setEncoding('utf8')
for await (const chunk of process.stdin) raw += chunk

let input = null
try { input = JSON.parse(raw)?.tool_input ?? null } catch { /* stdin illisible → silence */ }
const chemin = cheminDEcriture(input)

const TAG = /\[entériné[^\]]*\]/i
const tags = (s) => String(s ?? '').match(/\[entériné[^\]]*\]/gi) ?? []

/** Tags du fichier CIBLE tel qu'il est sur disque — inexistant ou illisible : aucun (tout tag du
 *  contenu écrit est alors NEUF). */
function tagsSurDisque(file) {
  if (typeof file !== 'string' || file === '') return []
  try { return tags(readFileSync(file, 'utf8')) } catch { return [] }
}

/** Write : seuls comptent les tags que `content` porte EN PLUS de ceux déjà sur disque (comparaison
 *  par multiensemble : une 2ᵉ occurrence du même tag est un tag de plus). */
function writeIntroduit(input) {
  if (typeof input.content !== 'string') return false
  const ecrits = tags(input.content)
  if (ecrits.length === 0) return false
  const reste = tagsSurDisque(chemin?.reel)
  return ecrits.some((t) => {
    const i = reste.indexOf(t)
    if (i < 0) return true
    reste.splice(i, 1)
    return false
  })
}

// Write : un tag que le fichier sur disque ne portait pas. Edit : un tag que new_string INTRODUIT
// (absent d'old_string) — re-sauver un fichier qui portait déjà un tag validé ne redemande rien.
const introduces = input && (
  writeIntroduit(input) ||
  (typeof input.new_string === 'string' && TAG.test(input.new_string) && !TAG.test(String(input.old_string ?? '')))
)

if (introduces && !chemin?.horsContenu) {
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'ask',
      permissionDecisionReason:
        `⚠ Cette écriture INTRODUIT un tag [entériné] — mot RÉSERVÉ à l'utilisateur (credo 6b : ` +
        `« sans validation utilisateur explicite et traçable »). Confirmer ce dialogue VAUT validation ` +
        `pour CE site précis ; refuser si l'arbitrage n'a pas été rendu par l'utilisateur lui-même.`,
    },
  }))
}
