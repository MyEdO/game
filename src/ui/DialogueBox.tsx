import { useId, useMemo, useRef } from 'react';
import { nomDuSiege } from '../state/netFlow';
import { useGame } from '../state/store';
import { COUCHE_CONVERSATION, reponsesDuNoeud, type ReponseDeDialogue, type TestAnnonce } from '../state/dialogue';
import { byId, refLabel } from '../data';
import { CHAR_LABELS, DIFFICULTY_LABELS } from '../engine/types';
import { spellMoney } from '../engine/money';
import { t } from '../i18n';
import { Coins } from './Coins';
import { Icon } from './Icon';
import type { IconIdInput } from './icons';
import { SpeakerBanner } from './SpeakerBanner';
import { SpectatorChip } from './SpectatorChip';
import { useOwnsGroupDecision, groupDecisionSeat } from './ownership';
import { useModalA11y } from './Modal';
import { GatedAction, raisonSi } from './GatedAction';

/**
 * Ce que la réponse ANNONCE, en clair : « Compétence — Difficulté », plus le DR CUMULÉ d'un Test
 * ÉTENDU. Les ids STABLES viennent du FLUX (`testAnnonce`) ; ici, et ici seulement, ils se résolvent
 * en libellés au registre (`byId('skill')`/`refLabel`, `CHAR_LABELS`, `DIFFICULTY_LABELS`) — un
 * auteur n'écrit JAMAIS la Compétence dans le libellé de sa réponse (garde
 * `scripts/guards/lib/dialogueLabelTest.mjs`). Une Compétence hors catalogue s'affiche par son id
 * nu : une dette de donnée se voit, elle ne crashe pas.
 */
function libelleDuTest(test: TestAnnonce): string {
  const quoi = test.skill
    ? (byId('skill', test.skill.id) ? refLabel('skills', test.skill) : test.skill.id)
    : test.characteristic ? CHAR_LABELS[test.characteristic] : '';
  const diff = DIFFICULTY_LABELS[test.difficulty];
  // Le FORMAT est un texte joueur : il vit à l'i18n comme les autres formats de ligne de jet
  // (`casc.traceTestLabel`), jamais en gabarit codé ici.
  return test.targetDR != null
    ? t('dlg.testTagCumul', { quoi, diff, dr: test.targetDR })
    : t('dlg.testTag', { quoi, diff });
}

/** Texte du REFUS d'une réponse — la raison que `GatedAction` fait lire au survol et au focus. */
function texteDuRefus(r: ReponseDeDialogue, meneur: string): string | undefined {
  if (r.enabled) return undefined;
  return r.refus === 'siege' ? `${meneur} répond pour le groupe` : 'Pas assez d’argent';
}

export function DialogueBox() {
  const dialogue = useGame((s) => s.dialogue);
  // Le dialogue est une DÉCISION DE GROUPE : un seul siège répond (`ownsGroupDecision`, même routage
  // que l'intent `chooseDialogue`). Les autres LISENT — leurs réponses sont inertes, donc fermées.
  const owns = useOwnsGroupDecision();
  const scene = useGame((s) => s.scene);
  const choose = useGame((s) => s.chooseDialogue);
  const net = useGame((s) => s.net);
  const meneur = nomDuSiege(net, groupDecisionSeat(useGame.getState()));
  // SOURCE UNIQUE des réponses, partagée avec les touches `dialogue-choice-N` (`state/dialogue.ts`).
  // Abonnement au RÉSULTAT, jamais à une liste d'entrées recopiée : la signature est une valeur
  // primitive, donc un changement d'état qui ne change aucune réponse ne re-rend rien.
  const signature = useGame((s) => JSON.stringify(reponsesDuNoeud(s)));
  const reponses = useMemo(() => JSON.parse(signature) as ReponseDeDialogue[], [signature]);
  // MODALE de la pile (`useModalA11y`), au plan de la SCÈNE : toute couche d'application est peinte
  // au-dessus d'elle (`dismissStack`, `coucheDuDessus`). Au-dessus, elle suspend le jeu — registre
  // clavier et manette muets hors ses réponses (`bindingApplies`), Tab piégé dans ses choix, focus
  // emprunté à l'ouverture et à chaque nœud. Sans `onClose`, sa couche est BLOQUANTE : on en sort par
  // une réponse, jamais par Échap (l'équivalent de `closedBy="none"`). Porteur du piège, elle déclare
  // sa boîte en dialogue modal nommé (`ScreenShell.tsx`, WAI-ARIA APG « Dialog (Modal) Pattern ») :
  // nom = le locuteur, description = la réplique.
  const boite = useRef<HTMLDivElement>(null);
  const nomId = useId();
  const repliqueId = useId();
  useModalA11y(boite, undefined, { kind: COUCHE_CONVERSATION, plan: 'scene', actif: !!dialogue, etape: dialogue?.nodeId });
  if (!dialogue) return null;
  const node = dialogue.dialogue.nodes.find((n) => n.id === dialogue.nodeId);
  if (!node) return null;

  // Portrait ET nom de l'interlocuteur — résolus par ENTITÉ (id), jamais par un nom en clair (#669).
  // Le nœud peut alterner l'interlocuteur ; à défaut, celui de la SESSION de dialogue.
  const speakerEntId = node.speakerId ?? dialogue.speakerId;
  const speakerEnt = speakerEntId ? scene?.entities.find((e) => e.id === speakerEntId) : undefined;
  const speakerName = speakerEnt?.label;

  return (
    <SpeakerBanner
      ref={boite} ent={speakerEnt} label={speakerName} variant="dialogue"
      role="dialog" aria-modal="true"
      aria-labelledby={speakerName ? nomId : undefined} aria-label={speakerName ? undefined : 'Conversation'}
      aria-describedby={node.desc ? repliqueId : undefined} labelId={nomId} textId={repliqueId}
      choices={<>
      {reponses.map((r) => {
        const num = t('dlg.choiceNum', { n: r.rang });
        const tag = r.test ? libelleDuTest(r.test) : '';
        return (
          <GatedAction
            key={r.index}
            id={`dlg-choice-${r.index}`}
            label={<>
              {/* Le RANG est l'ADRESSE de la réponse à l'écran — c'est lui que frappe la touche. */}
              <span className="dlg-choice-num">{num}</span>
              {r.icon && <Icon id={r.icon as IconIdInput} size="sm" />}
              {/* Tag et libellé : UN bloc de texte, qui reflue d'un tenant sous le numéro. */}
              <span className="dlg-choice-text">
                {tag && <><span className="muted">{tag}</span>{' '}</>}
                {r.label}
              </span>
              {r.cost && <span className="dlg-choice-cost"><Coins money={r.cost} /></span>}
            </>}
            // Nom ACCESSIBLE : les MÊMES morceaux déjà traduits, dans l'ordre où ils sont lus à
            // l'écran (une jointure, pas un 2ᵉ gabarit de phrase) — le coût par l'épellation que la
            // puce `Coins` porte en `title`.
            ariaLabel={[num, tag, r.label, r.cost && spellMoney(r.cost)].filter(Boolean).join(' ')}
            enabled={r.enabled}
            {...raisonSi(texteDuRefus(r, meneur))}
            onClick={() => choose(r.index)}
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
