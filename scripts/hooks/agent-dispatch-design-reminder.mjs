// Hook PreToolUse (matcher: Agent) : injecte au DISPATCH de chaque agent le rappel d'altitude de
// design — la décision d'architecture précède le premier codeur, elle ne s'extrait pas des passes
// de juge (précédent 2026-07-29, #939 : « modifications trop basiques », flag utilisateur).
import '../node-requis.mjs';
import { lireStdinBorne } from '../guards/lib/stdinBorne.mjs';

await lireStdinBorne();
process.stdout.write(
  JSON.stringify({
    suppressOutput: true,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext:
        '[RAPPEL — dispatch] Vague TRANSVERSALE (N flux/écrans/datasets) ? Alors AVANT ce dispatch : ' +
        "l'INVARIANT est écrit dans ton fil (qui possède quoi — le socle RÉSOUT, les feuilles ADRESSENT ; " +
        "critère « l'élément N+1 coûte une ligne ») et un juge l'a attaqué SUR LE DESIGN. " +
        'Une consigne « ajoute la même branche dans N specs » = trou de socle — remonter la branche, pas la copier. ' +
        'Deux passes de juge corrigeant la même classe = défaut de design : STOP rustines, remonter d’un niveau. ' +
        'Brief : périmètre exact, primitives nommées, citations verbatim, sondes exigées en sortie.',
    },
  }) + '\n',
);
