/** Conversation : choix d'une réponse et clôture du dialogue. */
import type { DialogueTransition } from './pendings';
import { TIME_COST } from '../engine/timeCost';
import { runFlow, jouerFlowEntier, cloturer } from './combatEffects';
import { conversationRepond, reponsesDuNoeud } from './dialogue';
import { t } from '../i18n';
import { toMoney } from '../engine/money';
import { payFromGroup } from './bourseFlow';
import { speakerEntity } from './monde/scene';
import { nomDEntite } from './monde/sceneNpc';
import { presetDuNarratif } from './monde/resolveursDuNarratif';
import { type DialogueTurn, recordTurn } from './monde/dialogueHistory';
import type { Get, Set } from './flowTypes';
import type { ActionsDuNoyau } from './actionsDuNoyau';
import type { FragmentDeTables } from './tablesPosees';

/** Applique une avancée de dialogue (transition vers un nœud, ou clôture) — point UNIQUE partagé par
 *  `chooseDialogue` (cas sans Test) et `resolveTest` (reprise après un Test suspendu par `choice.flow`). */
function applyDialogueTransition(get: Get, set: Set, tr: DialogueTransition): void {
  if (tr === 'close') {
    if (get().dialogue) get().advanceTime(TIME_COST.dialogue); // clôture (no-op si un Effect a déjà fermé)
    set({ dialogue: null });
    return;
  }
  set({ dialogue: tr });
}

export function creerActionsDeConversation(get: Get, set: Set) {
  return {
    chooseDialogue: (choiceIndex) => {
      const st = get();
      // LE VERBE VALIDE, pas la surface : la fenêtre grise, la touche se tait, mais c'est ICI que
      // « cette réponse est-elle jouable MAINTENANT ? » se tranche — un intent coop forgé, une touche
      // restée vive sous une modale et un clic arrivent tous par ce chemin. Deux portes, nommées :
      //  · `conversationRepond` — conversation ouverte, CE siège décide, aucune surface ne tient la
      //    main (`surfaceTientLaMain` : la fenêtre de jet ou le marché qu'une réponse vient d'ouvrir
      //    SUSPEND la conversation) ;
      //  · `reponsesDuNoeud` — la réponse est VISIBLE (son `when`) et OFFERTE (bourse), par le MÊME
      //    sélecteur que les deux surfaces. Un index qui n'y figure pas n'existe pas pour le joueur.
      if (!conversationRepond(st)) return;
      const r = reponsesDuNoeud(st).find((x) => x.index === choiceIndex);
      if (!r?.enabled) {
        if (r?.refus === 'argent') get().log(t('store.dialogueNoMoney'));
        return;
      }
      const node = st.dialogue.dialogue.nodes.find((n) => n.id === st.dialogue.nodeId);
      const choice = node?.choices[choiceIndex];
      if (!node || !choice) return;
      // Option payante (auberge, péage, pot-de-vin) : dépense de groupe (aucun bénéficiaire héros
      // unique) débitée AVANT les effets ; refus si le total du groupe ne couvre pas.
      if (choice.cost) {
        const cost = toMoney(choice.cost);
        if (!payFromGroup(get, set, cost, { purpose: 'Dialogue' })) { get().log(t('store.dialogueNoMoney')); return; }
      }
      const transition: DialogueTransition = choice.next
        ? { ...st.dialogue, nodeId: choice.next } // même conversation : `session` et interlocuteur voyagent avec
        : 'close';
      // Nom AFFICHÉ du locuteur (override par nœud puis speaker de session) — source unique partagée
      // par l'archive du tour et le titre de la fenêtre de butin d'un choix payant.
      const locuteur = speakerEntity(st.scene?.entities ?? [], node, st.dialogue);
      const speaker = locuteur && nomDEntite(locuteur, presetDuNarratif(get().campaignNarratif));
      // Archive verbatim du tour (#718) — au moment où le choix est FAIT, pas à la reprise d'un
      // Test différé (`choice.flow` peut suspendre plus bas : le tour est déjà enregistré ici).
      const turn: DialogueTurn = {
        speaker,
        nodeText: node.desc,
        choiceText: choice.label,
        at: st.gameTime,
        sceneId: st.scene?.id,
        dialogueId: st.dialogue.dialogue.id,
        session: st.dialogue.session,
      };
      set((s) => ({ dialogueHistory: recordTurn(s.dialogueHistory, turn) }));
      // Logique du choix (effets + branches) → runFlow ; objet/argent reçu = fenêtre d'attribution (titrée du donateur).
      if (choice.flow) {
        const suspended = get().pendingTest;
        const issue = runFlow(get, set, choice.flow, speaker ?? 'Butin');
        // Le Flow a SUSPENDU sur un Test (`openSkillTest`) : l'avancée du dialogue est portée par le
        // pending et appliquée par `resolveTest` — sinon le nœud suivant coexiste sous la modale de jet.
        const pt = get().pendingTest;
        if (pt && pt !== suspended) { set({ pendingTest: { ...pt, dialogueNext: transition } }); jouerFlowEntier(issue); return; }
        // MÊME invariant pour un DÉ (#1508) : l'avancée du dialogue est une CLÔTURE — elle attend la
        // conséquence au lieu de passer devant elle.
        cloturer(get, set, issue, [{ verbe: 'dialogueSuivant', transition }]);
        return;
      }
      applyDialogueTransition(get, set, transition);
    },
    closeDialogue: () => {
      if (get().dialogue) get().advanceTime(TIME_COST.dialogue); // clôture d'une conversation ≈ dialogue min
      set({ dialogue: null });
    },
  } satisfies Partial<ActionsDuNoyau>;
}

/** Les tables que ce module déclare au jeu (`noyau/tablesDuJeu.ts`). */
export const TABLES = {
  clotures: {
    /** AVANCÉE du dialogue — verbe de CLÔTURE (#1508). Une modale de jet ENCORE ouverte (un Test que la
     *  suite vient d'ouvrir) reprend la transition à son compte : « le dialogue n'avance jamais sous une
     *  modale de jet » vaut du Test comme du dé — le dé, lui, est tenu par la mécanique de continuation
     *  (une clôture ne se joue qu'à la validation de la DERNIÈRE étape de la grappe). */
    dialogueSuivant: (get, set, c) => {
      const pt = get().pendingTest;
      if (pt) { set({ pendingTest: { ...pt, dialogueNext: c.transition } }); return; }
      applyDialogueTransition(get, set, c.transition);
    },
  },
} satisfies FragmentDeTables;
