import { useMemo } from 'react';
import { useGame } from '../state/store';
import { reponsesDuNoeud, type ReponseDeDialogue, type TestAnnonce } from '../state/dialogue';
import { byId, refLabel } from '../data';
import { CHAR_LABELS, DIFFICULTY_LABELS } from '../engine/types';
import { t } from '../i18n';
import { Coins } from './Coins';
import { Icon } from './Icon';
import type { IconIdInput } from './icons';
import { SpeakerBanner } from './SpeakerBanner';
import { SpectatorChip } from './SpectatorChip';
import { useOwnsGroupDecision, groupDecisionSeat } from './ownership';
import { useDismissLayer } from './useDismissLayer';
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
function texteDuRefus(r: ReponseDeDialogue, siegeQuiRepond: string): string | undefined {
  if (r.enabled) return undefined;
  return r.refus === 'siege' ? `${siegeQuiRepond} répond pour le groupe` : 'Pas assez d’argent';
}

export function DialogueBox() {
  const dialogue = useGame((s) => s.dialogue);
  // Le dialogue est une DÉCISION DE GROUPE : un seul siège répond (`ownsGroupDecision`, même routage
  // que l'intent `chooseDialogue`). Les autres LISENT — leurs réponses sont inertes, donc fermées.
  const owns = useOwnsGroupDecision();
  const scene = useGame((s) => s.scene);
  const choose = useGame((s) => s.chooseDialogue);
  const net = useGame((s) => s.net);
  const party = useGame((s) => s.party);
  const flags = useGame((s) => s.flags);
  const gameTime = useGame((s) => s.gameTime);
  const siegeQuiRepond = net.seatNames[groupDecisionSeat(useGame.getState())] ?? 'L’hôte';
  // SOURCE UNIQUE des réponses, partagée avec les touches `dialogue-choice-N` : filtre `when`, rang
  // AFFICHÉ, verdict d'offre et Test annoncé s'y décident une fois (`state/dialogue.ts`). Recalculée
  // sur les ENTRÉES du sélecteur — souscriptions dont la valeur est la DÉPENDANCE, jamais une
  // souscription nue dont on jette le résultat (même patron que l'ancien `useMemo` de ce fichier).
  const reponses = useMemo(
    () => reponsesDuNoeud(useGame.getState()),
    [dialogue, net, party, flags, gameTime],
  );
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

  return (
    <SpeakerBanner ent={speakerEnt} label={speakerName} variant="dialogue" choices={<>
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
              {tag && <span className="dlg-choice-tag">{tag}</span>}
              <span className="dlg-choice-text">{r.label}</span>
              {r.cost && <span className="dlg-choice-cost"><Coins money={r.cost} /></span>}
            </>}
            // Nom ACCESSIBLE : les MÊMES morceaux déjà traduits, dans l'ordre où ils sont lus à
            // l'écran (une jointure, pas un 2ᵉ gabarit de phrase).
            ariaLabel={[num, tag, r.label].filter(Boolean).join(' ')}
            enabled={r.enabled}
            {...raisonSi(texteDuRefus(r, siegeQuiRepond))}
            onClick={() => choose(r.index)}
            primary={false}
            btnClassName="dlg-choice"
          />
        );
      })}
      {!owns && <SpectatorChip label={siegeQuiRepond} action="répond pour le groupe…" />}
    </>}>
      {node.desc}
    </SpeakerBanner>
  );
}
