// Hook PreToolUse (canaux shell) : un `tsc --noEmit` NU coûte ~42-51 s mesurés, là où le
// typecheck incrémental du dépôt coûte ~7 s à chaud ; un `vitest run` direct perd la capture en
// fichier et les bornes de charge du lanceur `npm test`. Rappel DOUX (aucun blocage, aucune
// décision) : le hook n'émet qu'un contexte additionnel quand la commande contourne la porte du
// dépôt. La reconnaissance d'un APPEL (par opposition à une commande qui MENTIONNE le motif) vit
// dans `scripts/guards/lib/appelsRunners.mjs`, partagée avec `scripts/hooks/codeur-gates-guard.mjs`.
import '../node-requis.mjs'
import { appelleTscNu, appelleVitestNu } from '../guards/lib/appelsRunners.mjs'
import { lireStdinBorne } from '../guards/lib/stdinBorne.mjs'

const brut = await lireStdinBorne()
let commande
try {
  commande = String(JSON.parse(brut || '{}').tool_input?.command ?? '')
} catch {
  commande = ''
}

const conseils = []
if (appelleTscNu(commande)) {
  conseils.push(
    '[RAPPEL — runner] Ce dépôt a `npm run typecheck:fast` : incrémental ~7 s (cache ' +
      'node_modules/.cache/typecheck.tsbuildinfo), sortie COMPLÈTE écrite dans ' +
      'node_modules/.cache/typecheck-last.txt et toutes les erreurs listées — le `tsc --noEmit` ' +
      'nu coûte ~42 s. La porte de vérité full reste `npm run typecheck`.',
  )
}
if (appelleVitestNu(commande)) {
  conseils.push(
    '[RAPPEL — runner] Ce dépôt a un lanceur de suite : préfère `npm test -- <chemins>` ' +
      '(capture en fichier + bornes de charge) — la sortie complète part dans ' +
      'node_modules/.cache/vitest-run-<pid>.txt, en-tête et `status:` compris.',
  )
}
if (!conseils.length) {
  process.exit(0)
}

process.stdout.write(
  JSON.stringify({
    suppressOutput: true,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext: conseils.join('\n'),
    },
  }) + '\n',
)
