// Hook commit-msg : la porte au MESSAGE (#1728 train B). Elle LIT le fichier du message FINAL que
// git lui passe en `$1` — le seul endroit où le sujet est connu tel qu'il sera enregistré, quelle
// que soit la façon dont il a été composé (`-m`, heredoc substitué, `-F`, éditeur, amend, rebase).
// La règle et sa lecture vivent dans `scripts/guards/lib/sujetDeCommit.mjs` (PUR) ; ici, l'entrée/
// sortie seulement.
//
// Contrat, comme `pre-commit` et `pre-push` : ce hook DOIT pouvoir refuser le commit (exit != 0).
// Sans fichier de message lisible, il ne juge RIEN et le DIT — il ne refuse pas sur du vide.
import { readFileSync } from 'node:fs'
import { refusDeSujet } from '../guards/lib/sujetDeCommit.mjs'

/** Verdict sur le fichier de message passé par git. `null` = rien à refuser.
 *  @param {string|undefined} chemin @param {{lire?: (c: string) => string}} [io] */
export function jugerFichierDeMessage(chemin, { lire = (c) => readFileSync(c, 'utf8') } = {}) {
  if (!chemin) return null
  let message
  try { message = lire(chemin) } catch (e) {
    process.stderr.write(`commit-msg : message illisible (${chemin}) — rien jugé : ${e.message}\n`)
    return null
  }
  return refusDeSujet(message)
}

if (import.meta.main) {
  const refus = jugerFichierDeMessage(process.argv[2])
  if (refus) { process.stderr.write(`${refus}\n`); process.exit(1) }
  process.exit(0)
}
