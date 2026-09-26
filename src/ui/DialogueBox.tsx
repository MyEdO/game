import { useMemo } from 'react';
import { nomDuSiege } from '../state/netFlow';
import { useGame } from '../state/store';
import { evalCondition, conditionCtx } from '../state/flow';
import { partyMoneyTotal } from '../state/bourseFlow';
import { canAfford, toMoney } from '../engine/money';
import { Coins } from './Coins';
import { Icon } from './Icon';
import type { IconIdInput } from './icons';
import { SpeakerBanner } from './SpeakerBanner';
import { SpectatorChip } from './SpectatorChip';
import { useOwnsGroupDecision, groupDecisionSeat } from './ownership';
import { useDismissLayer } from './useDismissLayer';
import { GatedAction } from './GatedAction';

export function DialogueBox() {
  const dialogue = useGame((s) => s.dialogue);
  const flags = useGame((s) => s.flags);
  const gameTime = useGame((s) => s.gameTime);
  const party = useGame((s) => s.party);
  const money = useMemo(() => partyMoneyTotal(useGame.getState), [party]); // affordabilité/condition = somme des bourses du groupe
  const scene = useGame((s) => s.scene);
  const choose = useGame((s) => s.chooseDialogue);
  // Le dialogue est une DÉCISION DE GROUPE : un seul siège répond (`ownership.ownsGroupDecision`,
  // même routage que l'intent `chooseDialogue`). Les autres LISENT — leurs réponses sont inertes,
  // donc désactivées et non plus cliquables.
  const owns = useOwnsGroupDecision();
  const net = useGame((s) => s.net);
  const meneur = nomDuSiege(net, groupDecisionSeat(useGame.getState()));
  // COUCHE BLOQUANTE : une conversation en cours consomme le congédiement sans rien fermer — on en
  // sort par une réponse, jamais par Échap (`onDismiss: null`, l'équivalent de `closedBy="none"`).
  useDismissLayer('dialogue', null, !!dialogue);
  if (!dialogue) return null;
  const node = dialogue.dialogue.nodes.find((n) => n.id === dialogue.nodeId);
  if (!node) return null;

  // Portrait ET nom de l'interlocuteur — résolus par ENTITÉ (id), jamais par un nom en clair (#669).
  // Le nœud peut alterner l'interlocuteur ; à défaut, celui de la SESSION de dialogue.
  const speakerEntId = node.speakerId ?? dialogue.speakerId;
  const speakerEnt = speakerEntId ? scene?.entities.find((e) => e.id === speakerEntId) : undefined;
  const speakerName = speakerEnt?.label;

  const visible = node.choices
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => !c.when || evalCondition(c.when, conditionCtx({ flags, gameTime, party, money })));

  return (
    <SpeakerBanner ent={speakerEnt} label={speakerName} variant="dialogue" choices={<>
      {visible.map(({ c, i }) => {
        // Option payante : affiche le prix et se désactive si on ne peut pas payer (répétable sinon).
        const cost = c.cost && toMoney(c.cost);
        const affordable = !cost || canAfford(money, cost);
        return (
          <GatedAction
            key={i}
            id={`dlg-choice-${i}`}
            label={<>
              {c.icon && <Icon id={c.icon as IconIdInput} size="sm" />}
              <span className="dlg-choice-text">{c.label}</span>
              {cost && <span className="dlg-choice-cost"><Coins money={cost} /></span>}
            </>}
            ariaLabel={c.label}
            enabled={owns && affordable}
            reason={!owns ? `${meneur} répond pour le groupe` : 'Pas assez d’argent'}
            onClick={() => choose(i)}
            primary={false}
            btnClassName="dlg-choice"
          />
        );
      })}
      {!owns && <SpectatorChip label={meneur} action="répond pour le groupe…" />}
    </>}>
      {node.desc}
    </SpeakerBanner>
  );
}
