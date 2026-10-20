/** Un tour de dialogue ARCHIVÉ (#718) : ce qui a été dit + la réponse choisie, horodaté (gameTime).
 *  Verbatim — sert la relecture joueur, jamais une logique. */
export interface DialogueTurn {
  /** Nom AFFICHÉ du locuteur (label d'entité résolu), absent si le dialogue n'a pas de speaker. */
  speaker?: string;
  /** Texte du nœud (ce qui a été dit au joueur) — `DialogueNode.desc`, absent quand le nœud n'en porte pas. */
  nodeText?: string;
  /** Texte du choix retenu par le joueur (sa réponse). */
  choiceText: string;
  /** gameTime (minutes) du tour. */
  at: number;
  /** id de la scène où le tour a eu lieu (contexte de regroupement pour la relecture). */
  sceneId?: string;
  /** id du Dialogue dont ce tour est issu (ce qu'on a ouvert), jamais le regroupement. */
  dialogueId: string;
  /** SESSION de conversation (`EtatDialogue.session`) — CE qui regroupe les tours à la relecture :
   *  deux visites au même PNJ sont deux conversations, même `dialogueId` et même scène. */
  session: number;
}

/** Cap de volumétrie MAISON (#718) : l'historique est une archive BORNÉE (arbitrage consigné —
 *  une campagne de 9 chapitres tient largement, un save reste raisonnable ; ajustable). */
export const DIALOGUE_HISTORY_CAP = 500;

/** Ajoute un tour, borne à `cap` (fenêtre glissante). Record NEUF, jamais de mutation en place. */
export function recordTurn(
  history: DialogueTurn[],
  turn: DialogueTurn,
  cap = DIALOGUE_HISTORY_CAP
): DialogueTurn[] {
  return [...history, turn].slice(-cap);
}
