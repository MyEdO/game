// Hook SessionStart de SYNCHRONISATION DU PRINCIPAL (#2187, verdict 6026872846 point 3), surface Codex
// seule (`HOOKS_DE_SESSION`) ; côté Claude, le mod `harnais` (`suivi.ts`). Il lance la CLI
// `scripts/ops/synchroniser.mjs --json` en processus neuf et rend à la session, en contexte, l'état reçu
// quand il n'est pas muet (`texteDeSynchro`). Il ne fait jamais échouer la session.
import '../node-requis.mjs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TIMEOUT_SYNCHRONISEUR } from '../agents/compat-core.mjs'

/** Racine de l'arbre qui porte CE script. */
const RACINE = fileURLToPath(new URL('../..', import.meta.url))

/** Les états qui ne disent rien à la session, sans configuration client changée. */
export const ETATS_MUETS = new Set(['a-jour', 'avance'])

const REPRISE = ' — reprise : `npm run ops:synchroniser`'

/**
 * Le texte rendu à la session pour la sortie `lancement` de la CLI (`spawnSync`), `''` pour un état muet :
 * `ETATS_MUETS` et `configurationClientChangee` vide ou absent (#2187 commentaire 6029118597, C4).
 * PURE. @param {{ stdout?: string | null, status?: number | null, error?: Error }} lancement
 */
export function texteDeSynchro(lancement) {
  let vu
  try {
    vu = JSON.parse(lancement.stdout ?? '')
  } catch {
    return `[synchroniser] principal non synchronisé : aucun état lisible (${lancement.error?.message ?? `code ${lancement.status}`})${REPRISE}`
  }
  const changes = Array.isArray(vu?.configurationClientChangee) ? vu.configurationClientChangee.map(String) : []
  const etatMuet = ETATS_MUETS.has(vu?.etat)
  if (etatMuet && !changes.length) return ''
  const configuration = changes.length ? ` — la session tourne sur la configuration d'avant : ${changes.join(', ')}` : ''
  return `[synchroniser] principal : ${JSON.stringify(vu)}${configuration}${etatMuet ? '' : REPRISE}`
}

if (import.meta.main) {
  const lancement = spawnSync(process.execPath, [join(RACINE, 'scripts', 'ops', 'synchroniser.mjs'), '--json'], {
    cwd: RACINE, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: (TIMEOUT_SYNCHRONISEUR - 5) * 1000, windowsHide: true,
  })
  const texte = texteDeSynchro(lancement)
  if (texte) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: texte } }))
}
