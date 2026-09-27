import { useGame } from '../state/store';
import { testValue } from '../engine/skills';
import { flowStakeRef, refLabel } from '../data';
import { RollShell, type RollAction } from './RollShell';
import { buildRollRow, type BuiltRollRow } from './rollRowBuild';
import { testBreakdown, testPending } from './breakdown';
import { recapLineOfEvent } from '../gameIso/combatNarration';
import { ev } from '../state/combatLog';
import { describeRun } from '../state/flowOutcomes';
import { Icon } from './Icon';

/**
 * Modale de Course (LDB 15 l.41) : « Lancer » jette le Test d'Athlétisme (+20),
 * « Relancer »/« Résilience ×N » dépensent Chance/Résilience, « Appliquer » ouvre le déplacement
 * étendu (Marche + Course + DR). La Course N'EST PAS binaire : « +1 DR » (Chance, LDB 17 l.24) allonge
 * la distance parcourue (DR en mètres → cases, cf. le flux `run`).
 */
export function RunModal() {
  const pr = useGame((s) => s.pendingRun);
  const battle = useGame((s) => s.battle);
  const roll = useGame((s) => s.runRoll);
  const reroll = useGame((s) => s.runReroll);
  const bonusSL = useGame((s) => s.runBonusSL);
  const darkPact = useGame((s) => s.runDarkPact);
  const force = useGame((s) => s.runForceSuccess);
  const confirm = useGame((s) => s.runConfirm);
  const cancel = useGame((s) => s.runCancel);
  if (!pr || !battle) return null;
  const c = battle.combatants.find((x) => x.id === pr.combatantId);
  if (!c) return null;
  const r = pr.result;
  // À cheval, la Course se teste sur Chevaucher (LDB 14 l.179) — même compétence que le flux `run`.
  const skillId = c.mountId ? 'chevaucher' : 'athletisme';
  const skillLabel = refLabel('skills', { id: skillId });
  const rolled = !!r;

  const actorRow: BuiltRollRow = buildRollRow({
    actor: c,
    row: {
      combatant: c,
      d: r ? testBreakdown(skillLabel, testValue(c, skillId), { roll: r.roll, target: r.target, sl: r.dr, success: r.success }, 'accessible') : undefined,
      pending: testPending(skillLabel, testValue(c, skillId), undefined, 'accessible'),
    },
    onRoll: roll,
    rerolled: !!pr.rerolled,
    onReroll: reroll,
    onBonusSL: bonusSL, // Chance « +1 DR » = +distance de Course (LDB 17 l.24) — offert dès le jet réussi OU raté
    onDarkPact: darkPact,
    onForce: force,
  });

  const actions: RollAction[] = [
    { key: 'cancel', label: 'Annuler', onClick: cancel, when: 'pre' },
    { key: 'confirm', label: 'Appliquer', onClick: confirm, when: 'post' },
  ];

  return (
    <RollShell
      flowKey="run"
      stake={flowStakeRef('run-roll')}
      title={<><Icon id="melee/flee" size="sm" /> Course</>}
      subtitle={
        <>
          <strong>{c.label}</strong> s'élance (Test {c.mountId ? 'de Chevaucher' : "d'Athlétisme"} +20)
        </>
      }
      rows={[actorRow]}
      rolled={rolled}
      outcome={r ? [recapLineOfEvent(ev('move', describeRun(pr), c.id), battle.combatants)] : undefined}
      actions={actions}
      onCancel={rolled ? undefined : cancel}
    />
  );
}
