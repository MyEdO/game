// Hook PostToolUse (matcher: Agent) : injecte au retour de chaque agent le rappel des étapes de
// vérification adversariale dues avant tout commit. Le verrou bloquant vit dans solde-ticket-guard.
import '../node-requis.mjs';
import { lireStdinBorne } from '../guards/lib/stdinBorne.mjs';

await lireStdinBorne();
process.stdout.write(
  JSON.stringify({
    suppressOutput: true,
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext:
        '[RAPPEL — retour d’agent] Si ce rendu modifie du code/de la donnée, AVANT tout commit : ' +
        '1) JUGE ADVERSARIAL sur le DIFF (agent juge, lentilles du domaine : fidélité RAW pour moteur/donnée, ' +
        'primitives vs scopes pour l’UI, morts purgées, contrats positifs) ; 2) diff LU par l’orchestrateur, ' +
        'claims « déjà correct / pas reproduit / n’existe pas » CONTRE-GREPÉS ; 3) gates machine ' +
        '(tsc + suite COMPLÈTE + cliquets) ; 4) preuve du domaine (captures+mécanismes pour l’UI, recette/tests ' +
        'réels pour la mécanique, Source/ pour les règles) ; 5) JUGE VISION en plus si un écran a changé. ' +
        'Un lot « trop petit pour les juges » se cumule avec le suivant — les juges passent sur le cumul AVANT l’utilisateur.',
    },
  }) + '\n',
);
