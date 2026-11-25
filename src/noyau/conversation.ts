/** Conversation : choix d'une réponse et clôture du dialogue. */
import type { DialogueTransition } from './pendings';
import { TIME_COST } from '../engine/timeCost';
import { runFlow, cloturer } from './combatEffects';
import { nomDeLInterlocuteur } from './dialogue';
import { garanti } from '../lib/garanti';
import { t } from '../i18n';
import { toMoney } from '../engine/money';
import { payFromGroup } from './bourseFlow';
import { type DialogueTurn, recordTurn } from './monde/dialogueHistory';
import type { Get, Set } from './flowTypes';
import type { CorpsDesChoix } from './choixDesFenetres';
import type { FragmentDeTables } from './tablesPosees';

/** Applique une avancée de dialogue (transition vers un nœud, ou clôture) — point UNIQUE partagé par
 *  la réponse (`fenetreChoisir('dialogue', 'reponse', …)`, cas sans Test) et `jetValider('test')` (reprise après un Test suspendu par `choice.flow`). */
function applyDialogueTransition(get: Get, set: Set, tr: DialogueTransition): void {
  if (tr === 'close') {
    if (get().dialogue) get().avancerLeTemps(TIME_COST.dialogue); // clôture (no-op si un Effect a déjà fermé)
    set({ dialogue: null });
    return;
  }
  set({ dialogue: tr });
}

/** La réponse de la conversation (`CorpsDesChoix`) : `fenetreChoisir` n'admet qu'une réponse VISIBLE du nœud
 *  (`reponsesDuNoeud`) quand la conversation répond (`conversationRepond`), et dit le refus des autres
 *  (`OUVERTS_DU_CHOIX` : siège, bourse, surface qui tient la main). */
export function choixDeConversation(get: Get, set: Set) {
  return {
    dialogue: { reponse: (choix) => repondre(get, set, choix) },
  } satisfies Partial<CorpsDesChoix>;
}

/** La réponse `choix`, jouée : son coût, l'archive du tour, son Flow, puis l'avancée du dialogue. */
function repondre(get: Get, set: Set, choix: string): void {
  const st = get();
  const etat = garanti(st.dialogue, choix, 'conversation ouverte');
  const node = garanti(etat.dialogue.nodes.find((n) => n.id === etat.nodeId), etat.nodeId, 'nœud de la conversation');
  const choice = garanti(node.choices.find((c) => c.id === choix), choix, 'réponse du nœud');
  // Option payante (auberge, péage, pot-de-vin) : dépense de groupe (aucun bénéficiaire héros
  // unique) débitée AVANT les effets ; refus si le total du groupe ne couvre pas.
  if (choice.cost) {
    const cost = toMoney(choice.cost);
    if (!payFromGroup(get, set, cost, { purpose: 'Dialogue' })) { get().ecrireAuJournal(t('store.dialogueNoMoney')); return; }
  }
  const transition: DialogueTransition = choice.next
    ? { ...etat, nodeId: choice.next.id } // même conversation : `session` et interlocuteur voyagent avec
    : 'close';
  // Nom AFFICHÉ du locuteur (`nomDeLInterlocuteur`), partagé par l'archive du tour et le titre de la fenêtre de
  // butin d'un choix payant.
  const speaker = nomDeLInterlocuteur(st);
  // Archive verbatim du tour (#718) — au moment où le choix est FAIT, pas à la reprise d'un
  // Test différé (`choice.flow` peut suspendre plus bas : le tour est déjà enregistré ici).
  const turn: DialogueTurn = {
    speaker,
    nodeText: node.desc,
    choiceText: choice.label,
    at: st.gameTime,
    sceneId: st.scene?.id,
    dialogueId: etat.dialogue.id,
    session: etat.session,
  };
  set((s) => ({ dialogueHistory: recordTurn(s.dialogueHistory, turn) }));
  // Logique du choix (effets + branches) → runFlow ; objet/argent reçu = fenêtre d'attribution (titrée du donateur).
  if (choice.flow) {
    // L'avancée du dialogue est une CLÔTURE (#1508, #2689) : elle attend le dé ou le geste que le Flow a ouvert
    // au lieu de passer devant lui — le nœud suivant ne coexiste jamais sous sa modale.
    cloturer(get, set, runFlow(get, set, choice.flow, speaker ?? 'Butin'), [{ verbe: 'dialogueSuivant', transition }]);
    return;
  }
  applyDialogueTransition(get, set, transition);
}

/** Les tables que ce module déclare au jeu (`noyau/tablesDuJeu.ts`). */
export const TABLES = {
  clotures: {
    /** AVANCÉE du dialogue — verbe de CLÔTURE (#1508). */
    dialogueSuivant: (get, set, c) => applyDialogueTransition(get, set, c.transition),
  },
} satisfies FragmentDeTables;
