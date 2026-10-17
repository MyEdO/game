// Hook SubagentStart (#2712) : en conteneur distant, l'index de la mémoire committée (`memoire-du-depot.mjs`)
// entre au contexte de chaque sous-agent qui peut LIRE ses fiches (un type sans fiche hérite de `Read`) ;
// un type cloisonné, sans `Read`, n'en reçoit rien. Doc hooks : SubagentStart, `additionalContext`.
import '../node-requis.mjs'
import { lireStdinBorne } from '../guards/lib/stdinBorne.mjs'
import { fichesDAgent, outilAccorde } from '../guards/lib/typesDAgent.mjs'
import { RACINE_DU_DEPOT, memoireDuConteneur } from './memoire-du-depot.mjs'

/** La sortie du hook pour `entree`, `null` s'il n'y a rien à porter ; un type sans fiche (intégré) lit. */
export function sortieSousAgent(entree, { env = process.env, racine = RACINE_DU_DEPOT, fiches = () => fichesDAgent(racine) } = {}) {
  const memoire = memoireDuConteneur(env, racine)
  if (!memoire) return null
  const fiche = fiches().get(String(entree?.agent_type ?? ''))
  if (fiche && !outilAccorde(fiche, 'Read')) return null
  return { hookSpecificOutput: { hookEventName: 'SubagentStart', additionalContext: memoire } }
}

if (import.meta.main) {
  let entree
  try { entree = JSON.parse(await lireStdinBorne()) } catch { entree = null }
  const sortie = sortieSousAgent(entree)
  if (sortie) process.stdout.write(JSON.stringify(sortie))
}
