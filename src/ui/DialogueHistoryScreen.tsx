/** Relecture de l'historique de dialogue (#718 dernier lot) — surface de lecture JOUEUR du journal
 *  de conversations. Lit `dialogueHistory` (état runtime déjà tenu par le store, `recordTurn`) —
 *  aucune logique n'est ajoutée ici, seulement sa présentation regroupée en conversations. */
import { useState } from 'react';
import { ScreenShell } from './ScreenShell';
import { MasterDetail } from './MasterDetail';
import { Prose } from './Prose';
import { Icon } from './Icon';
import { GameDate } from './GameDate';
import { ListRow } from './ListRow';
import { useGame } from '../state/store';
import type { DialogueTurn } from '../state/dialogueHistory';
import { Stack } from './Layout';

/** Une conversation = les tours d'une même SESSION de dialogue (`DialogueTurn.session`, posée à
 *  l'ouverture par `ouvrirDialogue`) : deux visites au même PNJ sont deux conversations, là où le
 *  couple `dialogueId`/`sceneId` les confondait. */
export interface DialogueConversation {
  speaker?: string;
  at: number;
  sceneId?: string;
  dialogueId: string;
  session: number;
  turns: DialogueTurn[];
}

/** Pure — regroupe une liste CHRONOLOGIQUE de tours en conversations (nouveau groupe à chaque
 *  changement de `session`). */
export function groupConversations(turns: DialogueTurn[]): DialogueConversation[] {
  const groups: DialogueConversation[] = [];
  for (const turn of turns) {
    const last = groups[groups.length - 1];
    if (last && last.session === turn.session) {
      last.turns.push(turn);
    } else {
      groups.push({ speaker: turn.speaker, at: turn.at, sceneId: turn.sceneId, dialogueId: turn.dialogueId, session: turn.session, turns: [turn] });
    }
  }
  return groups;
}

export function DialogueHistoryScreen({ onClose }: { onClose: () => void }) {
  const dialogueHistory = useGame((s) => s.dialogueHistory);
  // Le plus RÉCENT en tête — `groupConversations` rend l'ordre chronologique, on l'inverse pour l'affichage.
  const conversations = groupConversations(dialogueHistory).slice().reverse();
  const aucune = conversations.length === 0;

  const [selIdx, setSelIdx] = useState(0);

  const list = aucune ? (
    <p className="empty">Aucune conversation enregistrée.</p>
  ) : (
    <Stack>
      {conversations.map((conv, i) => (
        <ListRow
          key={`${conv.session}-${i}`}
          variant="codex"
          selected={selIdx === i}
          onClick={() => setSelIdx(i)}
          label={conv.speaker ?? 'Conversation'}
        >
          <GameDate time={conv.at} />
        </ListRow>
      ))}
    </Stack>
  );

  const selected = conversations[selIdx];

  const detail = aucune ? null : !selected ? (
    <p className="empty">Sélectionnez une conversation.</p>
  ) : (
    <Stack>
      {selected.turns.map((turn, i) => (
        <Stack key={i}>
          {turn.speaker && <div className="mini-title">{turn.speaker}</div>}
          <Prose md={turn.nodeText} />
          <p className="dlg-history-reply">{turn.choiceText}</p>
        </Stack>
      ))}
    </Stack>
  );

  return (
    <ScreenShell title={<><Icon id="journal/dialogue" size="lg" /> Conversations</>} onClose={onClose} body="centered">
      <MasterDetail list={list} detail={detail} listLabel="Conversations" />
    </ScreenShell>
  );
}
