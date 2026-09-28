import { useGame } from '../state/store';
import { flowStakeRef } from '../data';
import { combatValue } from '../engine/combat';
import { battementFoes } from '../state/combatFlow';
import { RollShell, type RollAction } from './RollShell';
import { buildRollRow, type BuiltRollRow } from './rollRowBuild';
import { OptionChooser } from './OptionChooser';
import { testBreakdown, testPending } from './breakdown';
import { recapLineOfEvent } from '../gameIso/combatNarration';
import { ev } from '../state/combatLog';
import { describeBattement } from '../state/flowOutcomes';
import { Icon } from './Icon';
import { VsHeader } from './VsHeader';

/**
 * Modale de Battement (LDB 10 l.103 / AA 13 l.17) : Action, Test de Corps à corps NON opposé retirant
 * de l'Avantage adverse. Même patron de jet MONO d'attaquant influençable que le Piétinement — la seule
 * différence métier est l'issue (`battementConfirm` → `resolveBattement`). Le picker de cible
 * (`OptionChooser`) n'apparaît que si plusieurs adversaires sont éligibles (avant le jet).
 */
export function BattementModal() {
  const pb = useGame((s) => s.pendingBattement);
  const battle = useGame((s) => s.battle);
  const roll = useGame((s) => s.battementRoll);
  const reroll = useGame((s) => s.battementReroll);
  const bonusSL = useGame((s) => s.battementBonusSL);
  const darkPact = useGame((s) => s.battementDarkPact);
  const force = useGame((s) => s.battementForceSuccess);
  const setFoe = useGame((s) => s.battementSetFoe);
  const confirm = useGame((s) => s.battementConfirm);
  const cancel = useGame((s) => s.battementCancel);
  if (!pb || !battle) return null;
  const attacker = battle.combatants.find((c) => c.id === pb.attackerId);
  const foe = battle.combatants.find((c) => c.id === pb.foeId);
  if (!attacker || !foe) return null;
  const r = pb.result;
  const rolled = !!r;
  const foes = battementFoes(attacker, battle);

  const actorRow: BuiltRollRow = buildRollRow({
    actor: attacker,
    row: {
      combatant: attacker,
      d: r ? testBreakdown('Corps à corps', combatValue(attacker, 'melee'), r) : undefined,
      pending: testPending('Corps à corps', combatValue(attacker, 'melee')),
    },
    onRoll: roll,
    rerolled: !!pb.rerolled,
    onReroll: reroll,
    onBonusSL: bonusSL,
    onDarkPact: darkPact,
    onForce: force,
  }, {
    // Résilience AVANT le jet (LDB 17 l.68) : on lance puis on force la réussite (dé PAR DÉFAUT = DR max
    // → plus d'Avantage retiré). PAS de choix du dé : l'Avantage retiré ne dépend que du DR.
    preRollForce: () => { roll(); force(); },
  });

  const actions: RollAction[] = [
    { key: 'cancel', label: 'Annuler', onClick: cancel, when: 'always' },
    { key: 'confirm', label: 'Appliquer', onClick: confirm, when: 'post' },
  ];

  return (
    <RollShell
      flowKey="battement"
      stake={flowStakeRef('battement-roll')}
      title={<><Icon id="action/attack" /> Battement</>}
      /* A→B canonique (décision utilisateur 2026-08-04) : portraits + flèche annotée de la manœuvre
         — jamais une phrase « X bat l'arme de Y ». Le COÛT (l'Action) est un prérequis de ressource,
         pas un modificateur du jet : il s'annonce sur la flèche, pas sur la ligne. */
      extra={<VsHeader actor={attacker} target={foe} label="Battement · coûte l’Action" verb="action/attack" />}
      /* Choix de la cible AVANT le jet (plusieurs adversaires éligibles) — OptionChooser partagé. */
      setup={
        foes.length > 1 ? (
          <OptionChooser
            layout="seg"
            groupLabel="Cible"
            options={foes.map((f) => ({ key: f.id, label: f.label, selected: f.id === foe.id, onSelect: () => setFoe(f.id) }))}
          />
        ) : undefined
      }
      rows={[actorRow]}
      rolled={rolled}
      outcome={r ? [recapLineOfEvent(ev('attack', describeBattement(pb, attacker.label, foe.label), attacker.id, foe.id), battle.combatants)] : undefined}
      actions={actions}
      onCancel={cancel}
    />
  );
}
