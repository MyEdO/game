import { useGame } from '../state/store';
import { flowStakeRef } from '../data';
import { effectiveChar } from '../engine/characteristics';
import { RollShell, type RollAction } from './RollShell';
import { buildRollRow, type BuiltRollRow } from './rollRowBuild';
import { testBreakdown, testPending } from './breakdown';
import { recapLineOfEvent } from '../gameIso/combatNarration';
import { ev } from '../state/combatLog';
import { describeWard } from '../state/flowOutcomes';
import { Icon } from './Icon';

/**
 * Modale de la Bénédiction de Protection (LDB 41 l.142) : « Les ennemis doivent effectuer un Test de
 * Force Mentale Accessible (+20) pour attaquer votre cible […]. Sur un échec, ils doivent choisir une
 * cible ou une Action différente. » Le Test du HÉROS attaquant DIFFÈRE la déclaration d'attaque sur une
 * cible bénie — succès → l'attaque est relancée ; échec → l'attaque n'a pas lieu (rien n'est consommé).
 */
export function WardModal() {
  const pw = useGame((s) => s.pendingWard);
  const battle = useGame((s) => s.battle);
  const roll = useGame((s) => s.wardRoll);
  const reroll = useGame((s) => s.wardReroll);
  const darkPact = useGame((s) => s.wardDarkPact);
  const force = useGame((s) => s.wardForceSuccess);
  const confirm = useGame((s) => s.wardConfirm);
  const cancel = useGame((s) => s.wardCancel);
  if (!pw || !battle) return null;
  const attacker = battle.combatants.find((x) => x.id === pw.attackerId);
  if (!attacker) return null;
  const r = pw.result;
  const rolled = !!r;

  const actorRow: BuiltRollRow = buildRollRow({
    actor: attacker,
    row: {
      combatant: attacker,
      d: r ? testBreakdown('Force Mentale', effectiveChar(attacker, 'force-mentale'), { roll: r.roll, target: r.target, sl: r.sl, success: r.success }, 'accessible') : undefined,
      pending: testPending('Force Mentale', effectiveChar(attacker, 'force-mentale'), undefined, 'accessible'),
    },
    onRoll: roll,
    rerolled: !!pw.rerolled,
    onReroll: reroll,
    onDarkPact: darkPact,
    onForce: force,
  });

  const actions: RollAction[] = [
    { key: 'cancel', label: 'Annuler', onClick: cancel, when: 'pre' },
    { key: 'confirm', label: 'Appliquer', onClick: confirm, when: 'post' },
  ];

  return (
    <RollShell
      flowKey="ward"
      stake={flowStakeRef('ward', 'roll')}
      title={<><Icon id="action/defend" size="sm" /> Bénédiction de Protection</>}
      subtitle={
        <>
          <strong>{attacker.label}</strong> ose frapper {pw.targetName} (Test de FM +20)
        </>
      }
      rows={[actorRow]}
      rolled={rolled}
      outcome={r ? [recapLineOfEvent(ev('info', describeWard(pw, pw.targetName), attacker.id, pw.targetId), battle.combatants)] : undefined}
      actions={actions}
      onCancel={rolled ? undefined : cancel}
    />
  );
}
