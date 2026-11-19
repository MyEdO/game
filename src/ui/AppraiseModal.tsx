import { cibleMesuree } from '../engine/tests';
import { useGame } from '../state/store';
import { type PendingAppraise } from '../noyau/pendings';
import { flowStakeRef, type FlowStakeId } from '../data';
import type { Combatant } from '../engine/types';
import { influencesLocally } from '../noyau/netOwnership';
import { RollShell, type RollAction } from './RollShell';
import { buildRollRow, type BuiltRollRow } from './rollRowBuild';
import { testBreakdown, testPending } from './breakdown';
import { recapLineOfEvent } from '../gameIso/combatNarration';
import { ev } from '../noyau/combatLog';
import { describeAppraise } from '../noyau/flowOutcomes';
import { libelleDEvaluation } from '../noyau/jetsEnVue';
import { t } from '../i18n';
import { nomEnVue } from '../noyau/visionDuGroupe';
import { garanti } from '../lib/garanti';
import { useGesteDeJet } from './useGesteDeJet';

/** Enjeu servi par chaque mode d'Évaluation. */
const APPRAISE_STAKE: Record<NonNullable<PendingAppraise['mode']>, FlowStakeId> = { evaluation: 'evaluation-evaluer', detection: 'evaluation-detecter' };

/** Vue pure de la modale d'Évaluation (testable sans store). */
export function AppraiseModalView({
  pa,
  nom,
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
  /** le nom de l'acteur tel que le groupe le connaît (`nomEnVue`). */
  nom: string;
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
  const detect = pa.mode === 'detection';
  // Repli aligné sur le flux (`openAppraise`) : le libellé vient du REGISTRE par id stable.
  const skill = libelleDEvaluation(pa);
  // La ligne figée à l'ouverture (`openAppraise`, Soutien LDB 12 compris) : celle que le résolveur jette.
  const l = pa.ligne;

  const actorRow: BuiltRollRow = buildRollRow({
    actor,
    row: {
      combatant: actor,
      d: rolled ? testBreakdown(skill, l.base, { roll: pa.roll!, ...cibleMesuree(pa), sl: pa.sl, success: pa.success }, l.difficulty, l.mods) : undefined,
      pending: testPending(skill, l.base, cibleMesuree(l), l.difficulty, l.mods),
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
        { key: 'abandonner', label: t('verbe.annuler'), onClick: onCancel, verbe: 'annuler' },
        { key: 'confirmer', label: t('verbe.valider'), onClick: onConfirm, verbe: 'valider' },
      ]
    : [];

  return (
    <RollShell
      flowKey="evaluation"
      stake={flowStakeRef(APPRAISE_STAKE[pa.mode ?? 'evaluation'])}
      title={detect ? "Détecter l'aura" : 'Évaluer'}
      /* QUI évalue → portrait dans la ligne de jet (plus de nom en clair) ; la cible/DR vit dans le cadre. */
      subtitle={<>{pa.itemName}</>}
      rows={[actorRow]}
      rolled={rolled}
      outcome={rolled ? [recapLineOfEvent(ev('information', describeAppraise(pa, nom)))] : undefined}
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
  const nom = useGame((s) => (s.pendingAppraise ? nomEnVue(s, s.pendingAppraise.actorId) : null));
  const party = useGame((s) => s.party);
  const roll = useGesteDeJet('jetLancer', 'evaluation');
  const reroll = useGesteDeJet('jetRelancer', 'evaluation');
  const bonusSL = useGesteDeJet('jetAjouterUnDR', 'evaluation');
  const darkPact = useGesteDeJet('jetPactiser', 'evaluation');
  const confirm = useGesteDeJet('jetValider', 'evaluation');
  const cancel = useGesteDeJet('jetAnnuler', 'evaluation');
  // COOP (#1017) : ABONNEMENT à `net` AVANT le retour anticipé — une ré-attribution de siège en cours
  // de fenêtre re-rend la modale (sinon `owned` reste figé sur le 1er rendu).
  useGame((s) => s.net);
  if (!pa) return null;
  const actor = party.find((c) => c.id === pa.actorId);
  // COOP (#1017) : même prédicat que la validation d'intent côté hôte (`seatInfluences`) — l'Évaluation
  // se joue entière par le siège de l'évaluateur (jet, influence, « Appliquer »).
  const owned = influencesLocally(useGame.getState(), pa.actorId);
  return <AppraiseModalView pa={pa} nom={garanti(nom, pa.actorId, 'évaluateur')} actor={actor} fortune={actor?.fortune ?? 0} onRoll={roll} onReroll={reroll} onBonusSL={bonusSL} onDarkPact={darkPact} onConfirm={confirm} onCancel={cancel} owned={owned} />;
}
