// Point d'entrée PROPRE de la porte de fermeture (#2125) : hook séparé du répartiteur, parce qu'un
// commit de fermeture la fait durer plusieurs secondes et qu'un dépassement du `timeout` jetterait la
// sortie de toutes les gardes d'un même processus. Même moteur : `executer` de `repartiteur.mjs`.
import '../node-requis.mjs'
import { executer } from './repartiteur.mjs'
import { garde } from './solde-ticket-guard.mjs'

/** Le registre de ce point d'entrée, lu aussi par `scripts/agents/compat-core.mjs`. */
export const REGISTRE_SOLDE = { PreToolUse: [garde] }

if (import.meta.main) await executer(REGISTRE_SOLDE)
