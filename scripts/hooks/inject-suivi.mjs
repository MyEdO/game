// Hook SessionStart du SUIVI DE VAGUE (#2132), surface Codex : après une compaction ou une reprise, le
// suivi est en contexte sans que la session ait à se souvenir de le relire. Côté Claude, le mod
// `harnais` (`.claude/skills/harnais/hooks/suivi.ts`, #2279) porte ce même contexte.
//
// Le lien vit au journal `<dossierDesSuivis>/.journal`, indexé par `session_id`. Compaction et reprise
// gardent ce `session_id` ; une session neuve, un `/clear` ou un fork en ont un neuf. Le texte est le
// `contexte` de `etatDeSession` (`scripts/ops/suivi.mjs`), pour la seule session PRINCIPALE
// (`sessionPrincipale`). Il ne MESURE rien (ni `gh`, ni `fetch`) et n'écrit rien hors de son stdout.
//
// La clôture STATIQUE s'arrête à la porte de version (`scripts/node-requis.mjs`) : `ops/suivi.mjs`
// atteint un module TypeScript, il se charge après elle, par `import()`.
import '../node-requis.mjs'
import * as FS from 'node:fs'
import { lireStdinBorne } from '../guards/lib/stdinBorne.mjs'

const { dossierDesSuivis, etatDeSession } = await import('../ops/suivi.mjs')
const { sessionPrincipale } = await import('./suivi-lien-guard.mjs')

/**
 * Le texte injecté au démarrage de la session `entree` : le `contexte` de `etatDeSession`, `''` sans
 * session principale ou sans rien à dire.
 * @param {{entree: object, dossier: string, maintenant: Date, fs?: typeof FS}} params
 * @returns {string}
 */
export const texteDInjection = ({ entree, dossier, maintenant, fs = FS }) =>
  (sessionPrincipale(entree) ? etatDeSession({ session: entree.session_id, dossier, maintenant, fs }).contexte : '')

if (import.meta.main) {
  let entree
  try {
    entree = JSON.parse(await lireStdinBorne())
  } catch {
    entree = null
  }
  const vu = dossierDesSuivis(process.cwd())
  if (vu.disponible) {
    const texte = texteDInjection({ entree, dossier: vu.valeur, maintenant: new Date() })
    if (texte) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: texte } }))
  }
}
