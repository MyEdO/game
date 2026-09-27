import { useGame, type PendingAppraise } from '../state/store';
import { flowStakeRef, refLabel, type FlowStakeId } from '../data';
import type { Combatant } from '../engine/types';
import { influencesLocally } from '../state/netOwnership';
import { RollShell, type RollAction } from './RollShell';
import { buildRollRow, type BuiltRollRow } from './rollRowBuild';
import { testValueSplit, testBreakdown, testPending } from './breakdown';
import { APPRAISE_SKILL } from '../state/merchantFlow';
import { recapLineOfEvent } from '../gameIso/combatNarration';
import { ev } from '../state/combatLog';
import { describeAppraise } from '../state/flowOutcomes';

/** Enjeu servi par chaque mode d'Évaluation. */
const APPRAISE_STAKE: Record<NonNullable<PendingAppraise['mode']>, FlowStakeId> = { evaluate: 'appraise-evaluate', detect: 'appraise-detect' };

/** Vue pure de la modale d'Évaluation (testable sans store). */
export function AppraiseModalView({
  pa,
  actor,
  fortune,
  onRoll,
  onReroll,
  onBonusSL,
  onDarkPact,
  onConfirm,
  onCancel,
  owned = true,
}: {
  pa: PendingAppraise;
  /** Évaluateur (jet mono-acteur) → portrait dans la ligne de jet. */
  actor?: Combatant;
  fortune: number;
  onRoll: () => void;
  onReroll: () => void;
  onBonusSL: () => void;
  onDarkPact?: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  /** COOP (#1017) : ce siège possède-t-il l'évaluateur ? Faux → rangée TÉMOIN et aucune action (le
   *  geste serait refusé par `intentAllowedFor` : affordance morte). */
  owned?: boolean;
}) {
  const rolled = pa.roll != null;
  const detect = pa.mode === 'detect';
  // Repli aligné sur le flux (`openAppraise`) : le libellé vient du REGISTRE par id stable.
  const skill = pa.skillLabel ?? refLabel('skills', { id: APPRAISE_SKILL[pa.mode ?? 'evaluate'].skill });
  // Soutien du groupe (LDB 12) et composantes de la valeur de Test (États, séquelles, passifs,
  // effets — #1178) : lignes de mod NOMMÉES, base rebasée sur le Niveau de Compétence nu (LDB 09 l.17).
  // La Compétence testée vient de la SOURCE UNIQUE du flux (`APPRAISE_SKILL`), par id.
  const { base, mods: supMods } = testValueSplit(actor, pa.skillValue, { support: pa.support, ...APPRAISE_SKILL[pa.mode ?? 'evaluate'] });

  const actorRow: BuiltRollRow = buildRollRow({
    actor,
    row: {
      combatant: actor,
      d: rolled ? testBreakdown(skill, base, { roll: pa.roll!, target: pa.target, sl: pa.sl, success: pa.success }, pa.difficulty, supMods) : undefined,
      pending: testPending(skill, base, pa.target, pa.difficulty, supMods),
    },
    rerolled: !!pa.rerolled,
    onRoll,
    onReroll,
    onBonusSL,
    onDarkPact,
  }, {
    interactive: owned,
    fortune,
  });

  const actions: RollAction[] = owned
    ? [
        { key: 'cancel', label: 'Annuler', onClick: onCancel, when: 'pre' },
        { key: 'confirm', label: 'Appliquer', onClick: onConfirm, when: 'post' },
      ]
    : [];

  return (
    <RollShell
      flowKey="appraise"
      stake={flowStakeRef(APPRAISE_STAKE[pa.mode ?? 'evaluate'])}
      title={detect ? "Détecter l'aura" : 'Évaluer'}
      /* QUI évalue → portrait dans la ligne de jet (plus de nom en clair) ; la cible/DR vit dans le cadre. */
      subtitle={<>{pa.itemName}</>}
      rows={[actorRow]}
      rolled={rolled}
      outcome={rolled ? [recapLineOfEvent(ev('info', describeAppraise(pa)))] : undefined}
      actions={actions}
      onCancel={rolled || !owned ? undefined : onCancel}
    />
  );
}

/**
 * Évaluation (LDB 59 l.41 : « estimer les prix des objets Rares ou Exotiques à ±10 % »). Test d'Évaluation
 * (Int) ; un succès RÉVÈLE un objet non identifié (ses qualités cachées deviennent visibles) et en donne
 * une estimation de prix. « Lancer » fait le jet, une Chance est possible avant d'acquitter (révélation).
 */
export function AppraiseModal() {
  const pa = useGame((s) => s.pendingAppraise);
  const party = useGame((s) => s.party);
  const roll = useGame((s) => s.appraiseRoll);
  const reroll = useGame((s) => s.appraiseReroll);
  const bonusSL = useGame((s) => s.appraiseBonusSL);
  const darkPact = useGame((s) => s.appraiseDarkPact);
  const confirm = useGame((s) => s.resolveAppraise);
  const cancel = useGame((s) => s.appraiseCancel);
  // COOP (#1017) : ABONNEMENT à `net` AVANT le retour anticipé — une ré-attribution de siège en cours
  // de fenêtre re-rend la modale (sinon `owned` reste figé sur le 1er rendu).
  useGame((s) => s.net);
  if (!pa) return null;
  const actor = party.find((c) => c.id === pa.actorId);
  // COOP (#1017) : même prédicat que la validation d'intent côté hôte (`seatInfluences`) — l'Évaluation
  // se joue entière par le siège de l'évaluateur (jet, influence, « Appliquer »).
  const owned = influencesLocally(useGame.getState(), pa.actorId);
  return <AppraiseModalView pa={pa} actor={actor} fortune={actor?.fortune ?? 0} onRoll={roll} onReroll={reroll} onBonusSL={bonusSL} onDarkPact={darkPact} onConfirm={confirm} onCancel={cancel} owned={owned} />;
}
