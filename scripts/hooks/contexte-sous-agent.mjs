// Hook SubagentStart (#2712, #2725) : entrent au contexte d'un sous-agent les règles communes
// (`REGLES_COMMUNES`) s'il dispose d'un canal shell (`OUTILS_SHELL`), et, en conteneur distant, l'index de
// la mémoire committée (`memoire-du-depot.mjs`) s'il peut LIRE ses fiches. Un type sans fiche (intégré) hérite
// de tous les outils ; un type cloisonné n'en reçoit rien. Doc hooks : SubagentStart, `additionalContext`.
import '../node-requis.mjs'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { lireStdinBorne } from '../guards/lib/stdinBorne.mjs'
import { OUTILS_SHELL } from '../guards/lib/contratGarde.mjs'
import { fichesDAgent, outilAccorde } from '../guards/lib/typesDAgent.mjs'
import { RACINE_DU_DEPOT, memoireDuConteneur } from './memoire-du-depot.mjs'

export const REGLES_COMMUNES = '.claude/sous-agents.md'

/** La sortie du hook pour `entree`, `null` s'il n'y a rien à porter. */
export function sortieSousAgent(entree, { env = process.env, racine = RACINE_DU_DEPOT, fiches = () => fichesDAgent(racine) } = {}) {
  const fiche = fiches().get(String(entree?.agent_type ?? ''))
  const accorde = (outil) => !fiche || outilAccorde(fiche, outil)
  const parts = []
  if (OUTILS_SHELL.some(accorde)) parts.push(readFileSync(join(racine, REGLES_COMMUNES), 'utf8').trim())
  const memoire = accorde('Read') ? memoireDuConteneur(env, racine) : null
  if (memoire) parts.push(memoire)
  return parts.length === 0 ? null : { hookSpecificOutput: { hookEventName: 'SubagentStart', additionalContext: parts.join('\n\n') } }
}

if (import.meta.main) {
  let entree
  try { entree = JSON.parse(await lireStdinBorne()) } catch { entree = null }
  const sortie = sortieSousAgent(entree)
  if (sortie) process.stdout.write(JSON.stringify(sortie))
}
