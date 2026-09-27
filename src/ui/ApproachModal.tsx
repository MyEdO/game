import { useGame } from '../state/store';
import { calmeValue } from '../engine/psychology';
import { RollShell, type RollAction } from './RollShell';
import { buildRollRow, type BuiltRollRow } from './rollRowBuild';
import { Icon } from './Icon';
import { testBreakdown, testPending } from './breakdown';
import { recapLineOfEvent } from '../gameIso/combatNarration';
import { ev } from '../state/combatLog';
import { describeApproach } from '../state/flowOutcomes';

/**
 * Modale d'APPROCHE d'une source de Peur (LDB 21 l.27) : « incapable de vous rapprocher … à moins de
 * réussir un Test de Calme Intermédiaire (+0) ». Test SEC qui diffère le clic d'approche — succès →
 * l'intention est relancée (approches libres ce Tour) ; échec → aucune approche ce Tour.
 */
export function ApproachModal() {
  const pa = useGame((s) => s.pendingApproach);
  const battle = useGame((s) => s.battle);
  const roll = useGame((s) => s.approachRoll);
  const reroll = useGame((s) => s.approachReroll);
  const darkPact = useGame((s) => s.approachDarkPact);
  const force = useGame((s) => s.approachForceSuccess);
  const confirm = useGame((s) => s.approachConfirm);
  const cancel = useGame((s) => s.approachCancel);
  if (!pa || !battle) return null;
  const c = battle.combatants.find((x) => x.id === pa.combatantId);
  if (!c) return null;
  const r = pa.result;
  const rolled = !!r;

  const actorRow: BuiltRollRow = buildRollRow({
    actor: c,
    row: {
      combatant: c,
      d: r ? testBreakdown('Calme', calmeValue(c), { roll: r.roll, target: r.target, sl: r.sl, success: r.success }, 'intermediaire') : undefined,
      pending: testPending('Calme', calmeValue(c), undefined, 'intermediaire'),
    },
    rerolled: !!pa.rerolled,
    onRoll: roll,
    onReroll: reroll,
    onDarkPact: darkPact,
    onForce: force,
  }, {
    fortune: c.fortune ?? 0,
    resilience: c.resilience ?? 0,
  });

  const actions: RollAction[] = [
    { key: 'cancel', label: 'Annuler', onClick: cancel, when: 'pre' },
    { key: 'confirm', label: 'Appliquer', onClick: confirm, when: 'post' },
  ];

  return (
    <RollShell
      flowKey="approach"
      title={<><Icon id="flag/fear" size="sm" /> Affronter sa Peur</>}
      subtitle={
        <>
          <strong>{c.label}</strong> ose approcher {pa.sourceName} (Test de Calme +0)
        </>
      }
      rows={[actorRow]}
      rolled={rolled}
      outcome={r ? [recapLineOfEvent(ev('fear', describeApproach(pa), c.id, pa.sourceId), battle.combatants)] : undefined}
      actions={actions}
      onCancel={rolled ? undefined : cancel}
    />
  );
}
