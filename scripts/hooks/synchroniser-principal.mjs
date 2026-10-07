// Hook SessionStart de SYNCHRONISATION DU PRINCIPAL (#2187, verdict 6026872846 point 3), surface Codex
// seule (`HOOKS_DE_SESSION`) ; côté Claude, le mod `harnais` (`suivi.ts`). Il lance la CLI
// `scripts/ops/synchroniser.mjs --json` en processus neuf et rend à la session, en contexte, l'état reçu
// quand il n'est ni `a-jour` ni `avance`. Il ne fait jamais échouer la session.
import '../node-requis.mjs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TIMEOUT_SYNCHRONISEUR } from '../agents/compat-core.mjs'

/** Racine de l'arbre qui porte CE script. */
const RACINE = fileURLToPath(new URL('../..', import.meta.url))

/** Les états qui ne disent rien à la session. */
const ETATS_MUETS = new Set(['a-jour', 'avance'])

/**
 * Le texte rendu à la session pour la sortie `lancement` de la CLI (`spawnSync`), `''` pour un état muet.
 * PURE. @param {{ stdout?: string | null, status?: number | null, error?: Error }} lancement
 */
export function texteDeSynchro(lancement) {
  let vu
  try {
    vu = JSON.parse(lancement.stdout ?? '')
  } catch {
    return `[synchroniser] principal non synchronisé : aucun état lisible (${lancement.error?.message ?? `code ${lancement.status}`}) — reprise : \`npm run ops:synchroniser\``
  }
  return ETATS_MUETS.has(vu?.etat) ? '' : `[synchroniser] principal : ${JSON.stringify(vu)} — reprise : \`npm run ops:synchroniser\``
}

if (import.meta.main) {
  const lancement = spawnSync(process.execPath, [join(RACINE, 'scripts', 'ops', 'synchroniser.mjs'), '--json'], {
    cwd: RACINE, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: (TIMEOUT_SYNCHRONISEUR - 5) * 1000, windowsHide: true,
  })
  const texte = texteDeSynchro(lancement)
  if (texte) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: texte } }))
}
