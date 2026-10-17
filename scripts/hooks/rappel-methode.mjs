// Hook UserPromptSubmit du RAPPEL DE MÉTHODE, surface Claude : chaque demande arrive avec le pointeur
// vers le skill `aborder-un-sujet`, sans dépendre du jugement de la session. Le texte de la méthode vit
// dans le skill seul ; ce hook ne porte que son nom. Il ne lit pas son stdin et n'écrit que son stdout.
import '../node-requis.mjs'

export const SKILL_DE_METHODE = 'aborder-un-sujet'

export const RAPPEL = `Si ce message porte une nouvelle demande de l'utilisateur ou change l'objectif, applique le skill \`${SKILL_DE_METHODE}\` avant le premier geste : qualifie-la, agis tout de suite si elle est claire, sinon cadre-la toi-même sans solliciter l'utilisateur. Un retour d'agent, une notification ou la suite d'un plan en cours n'en est pas une.`

if (import.meta.main)
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: RAPPEL } }))
