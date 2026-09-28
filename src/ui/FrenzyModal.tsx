import { useGame } from '../state/store';
import { flowStakeRef } from '../data';
import { effectiveChar } from '../engine/characteristics';
import { RollShell, type RollAction } from './RollShell';
import { buildRollRow, type BuiltRollRow } from './rollRowBuild';
import { testBreakdown, testPending } from './breakdown';
import { recapLineOfEvent } from '../gameIso/combatNarration';
import { ev } from '../state/combatLog';
import { describeFrenzy } from '../state/flowOutcomes';
import { Icon } from './Icon';

/**
 * Modale d'entrée en Frénésie (LDB 21 l.31) : « Lancer » jette le Test de Force Mentale,
 * « Relancer »/« Résilience ×N » dépensent Chance/Résilience, « Appliquer » fige le résultat
 * (entre en Frénésie sur succès). Test binaire (pas de DR) → pas de « +1 DR ».
 */
export function FrenzyModal() {
  const pf = useGame((s) => s.pendingFrenzy);
  const battle = useGame((s) => s.battle);
  const roll = useGame((s) => s.frenzyRoll);
  const reroll = useGame((s) => s.frenzyReroll);
  const darkPact = useGame((s) => s.frenzyDarkPact);
  const force = useGame((s) => s.frenzyForceSuccess);
  const confirm = useGame((s) => s.frenzyConfirm);
  const cancel = useGame((s) => s.frenzyCancel);
  if (!pf || !battle) return null;
  const c = battle.combatants.find((x) => x.id === pf.combatantId);
  if (!c) return null;
  const r = pf.result;
  const rolled = !!r;

  const actorRow: BuiltRollRow = buildRollRow({
    actor: c,
    row: {
      combatant: c,
      d: r ? testBreakdown('Force Mentale', effectiveChar(c, 'force-mentale'), { roll: r.roll, target: r.target, sl: r.sl, success: r.success }) : undefined,
      pending: testPending('Force Mentale', effectiveChar(c, 'force-mentale')),
    },
    rerolled: !!pf.rerolled,
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
      flowKey="frenzy"
      stake={flowStakeRef('frenzy-roll')}
      title={<><Icon id="flag/frenzy" size="sm" /> Frénésie</>}
      subtitle={
        <>
          <strong>{c.label}</strong> tente d'entrer en Frénésie (Test de Force Mentale)
        </>
      }
      rows={[actorRow]}
      rolled={rolled}
      outcome={r ? [recapLineOfEvent(ev('frenzy', describeFrenzy(pf, c.label), c.id), battle.combatants)] : undefined}
      actions={actions}
      onCancel={rolled ? undefined : cancel}
    />
  );
}
