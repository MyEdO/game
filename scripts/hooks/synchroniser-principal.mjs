// Hook SessionStart de SYNCHRONISATION DU PRINCIPAL (#2187, verdict 6026872846 point 3), surface Codex
// seule (`HOOKS_DE_SESSION`) ; côté Claude, le mod `harnais` (`suivi.ts`). Il lance la CLI
// `scripts/ops/synchroniser.mjs --json` en processus neuf et rend à la session, en contexte, son `texte`
// (`texteDeSession`) ; sortie illisible, la cause et la re-mesure du principal (`--mesurer --json`, #2493).
// Il ne fait jamais échouer la session.
import '../node-requis.mjs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TIMEOUT_SYNCHRONISEUR } from '../agents/compat-core.mjs'

/** Racine de l'arbre qui porte CE script. */
const RACINE = fileURLToPath(new URL('../..', import.meta.url))

/** Le `champ` (`texte` d'un passage, `ligne` d'une mesure) que rend la sortie `lancement` de la CLI, `null` sans état lisible. */
function champLu(lancement, champ) {
  try {
    return String(JSON.parse(lancement.stdout ?? '')[champ] ?? '')
  } catch {
    return null
  }
}

/** La cause d'une sortie `lancement` sans état lisible. */
const causeDe = (lancement) => lancement.error?.message ?? `code ${lancement.status}${lancement.signal ? ` signal ${lancement.signal}` : ''}`

/**
 * Le texte rendu à la session pour la sortie `lancement` de la CLI (`spawnSync`) : le `texte` de l'état reçu ;
 * sans état lisible, la cause et la `ligne` de la re-mesure `mesurer()` (ou sa cause), avec la reprise.
 * @param {{ stdout?: string | null, status?: number | null, signal?: string | null, error?: Error }} lancement
 * @param {{ mesurer: () => { stdout?: string | null, status?: number | null, signal?: string | null, error?: Error } }} p
 */
export function texteDuLancement(lancement, { mesurer }) {
  const texte = champLu(lancement, 'texte')
  if (texte !== null) return texte
  const mesure = mesurer()
  return `[synchroniser] principal : synchroniseur sorti sans état (${causeDe(lancement)}) ; re-mesure : ${champLu(mesure, 'ligne') ?? causeDe(mesure)} — reprise : \`npm run ops:synchroniser\``
}

if (import.meta.main) {
  const fin = Date.now() + (TIMEOUT_SYNCHRONISEUR - 5) * 1000
  const lancer = (args) => spawnSync(process.execPath, [join(RACINE, 'scripts', 'ops', 'synchroniser.mjs'), ...args], {
    cwd: RACINE, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: Math.max(1_000, fin - Date.now()), windowsHide: true,
  })
  const texte = texteDuLancement(lancer(['--json']), { mesurer: () => lancer(['--mesurer', '--json']) })
  if (texte) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: texte } }))
}
