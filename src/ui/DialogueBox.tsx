import { useId, useMemo, useRef } from 'react';
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
import { useModalA11y } from './Modal';
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
  // DIALOGUE de la pile (`useModalA11y`) : la conversation suspend le jeu — registre clavier et manette
  // muets, Tab piégé dans ses choix, focus emprunté à l'ouverture et à chaque nœud — par la même source
  // que toute surface du dessus (`dialogueDuDessus`). Sans `onClose`, sa couche est BLOQUANTE : on en
  // sort par une réponse, jamais par Échap (l'équivalent de `closedBy="none"`). Porteur du piège, elle
  // déclare sa boîte en dialogue modal nommé (`ScreenShell.tsx`, WAI-ARIA APG « Dialog (Modal) Pattern ») :
  // nom = le locuteur, description = la réplique.
  const boite = useRef<HTMLDivElement>(null);
  const nomId = useId();
  const repliqueId = useId();
  useModalA11y(boite, undefined, { kind: 'dialogue', actif: !!dialogue, etape: dialogue?.nodeId });
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
    <SpeakerBanner
      ref={boite} ent={speakerEnt} label={speakerName} variant="dialogue"
      role="dialog" aria-modal="true"
      aria-labelledby={speakerName ? nomId : undefined} aria-label={speakerName ? undefined : 'Conversation'}
      aria-describedby={node.desc ? repliqueId : undefined} labelId={nomId} textId={repliqueId}
      choices={<>
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
