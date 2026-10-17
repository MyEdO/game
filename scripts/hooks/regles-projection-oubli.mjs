// Hook SessionStart de l'OUBLI des règles projetées (#2683), surfaces Claude et Codex : la projection
// (`scripts/hooks/regles-projection-guard.mjs`) injecte une règle une fois par contexte ; une compaction, qui garde
// le `session_id` (`scripts/hooks/inject-suivi.mjs:5-6`), sort ces règles du contexte, et l'état de la session
// s'efface ici. La garde reste pure (#2125) : ce point d'entrée porte l'effet.
import '../node-requis.mjs'
import { rmSync } from 'node:fs'
import { lireStdinBorne } from '../guards/lib/stdinBorne.mjs'
import { dossierDeSession } from './regles-projection-guard.mjs'

/** SessionStart d'une compaction : l'état de TOUS les contextes de la session s'efface. `true` si l'entrée est
 *  une compaction. */
export function oublierALaCompaction(entree) {
  if (entree?.hook_event_name !== 'SessionStart' || entree.source !== 'compact') return false
  rmSync(dossierDeSession(entree.session_id), { recursive: true, force: true })
  return true
}

if (import.meta.main) {
  let entree = null
  try {
    entree = JSON.parse(await lireStdinBorne())
  } catch {
    /* stdin illisible : aucune session à oublier */
  }
  oublierALaCompaction(entree)
}
