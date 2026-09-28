import { useGame } from '../state/store';
import { flowStakeRef } from '../data';
import { distraireAttackValue, distraireDefenseValue, distraireFoes } from '../state/combatFlow';
import { OptionChooser } from './OptionChooser';
import { RollShell, type RollAction } from './RollShell';
import { VsHeader } from './VsHeader';
import { recapLineOfEvent } from '../gameIso/combatNarration';
import { ev } from '../state/combatLog';
import { testBreakdown } from './breakdown';
import { describeDistraire } from '../state/flowOutcomes';
import { opposedResponded } from './opposedFrozen';
import { buildRollRow, frozenOpposedRow } from './rollRowBuild';

/**
 * Modale de Distraire (LDB 10 l.364 / AA 13 l.51) : Mouvement, Test OPPOSÉ Athlétisme (mover) vs Calme
 * (foe), sur `RollShell` (opposé = 2 rangées) :
 * - rangée [0] = TÉMOIN : le jet de Calme du foe, FIGÉ (`interactive:false`) ;
 * - rangée [1] = INTERACTIVE : le jet d'Athlétisme du mover, porteur de son cycle d'influence.
 * Issue BINAIRE (succès/égalité/échec). Le picker de cible (`OptionChooser`) n'apparaît qu'en
 * pré-jet si plusieurs adversaires sont éligibles (slot `setup`).
 */
export function DistraireModal() {
  const pd = useGame((s) => s.pendingDistraire);
  const battle = useGame((s) => s.battle);
  const roll = useGame((s) => s.distraireRoll);
  const reroll = useGame((s) => s.distraireReroll);
  const bonusSL = useGame((s) => s.distraireBonusSL);
  const darkPact = useGame((s) => s.distraireDarkPact);
  const force = useGame((s) => s.distraireForceSuccess);
  const setFoe = useGame((s) => s.distraireSetFoe);
  const confirm = useGame((s) => s.distraireConfirm);
  const cancel = useGame((s) => s.distraireCancel);
  if (!pd || !battle) return null;
  const mover = battle.combatants.find((c) => c.id === pd.moverId);
  const foe = battle.combatants.find((c) => c.id === pd.foeId);
  if (!mover || !foe) return null;
  const rolled = !!pd.atk;
  // Adversaires éligibles au Distraire — MÊME source que l'ouverture (`distraireFoes`).
  const foes = distraireFoes(mover, battle);
  const winnerIndex = pd.result === 'success' ? 1 : pd.result === 'failure' ? 0 : null;

  // Rangée TÉMOIN : Calme du foe, figé à l'ouverture (jamais relancé) — MASQUÉ tant que le mover n'a
  // pas répondu (#990 : `pd.atk` est SA réponse ; ici le jet FIGÉ est celui du DÉFENSEUR).
  const foeRow = frozenOpposedRow(useGame.getState(), {
    ownerId: pd.foeId,
    responded: opposedResponded(useGame.getState(), [{ id: pd.moverId, interactive: true, result: pd.atk }]),
    row: { combatant: foe, d: testBreakdown('Calme', distraireDefenseValue(foe), pd.defRoll, 'intermediaire') },
  });
  // Rangée INTERACTIVE : Athlétisme du mover, porteur de son cycle d'influence.
  const actorRow = buildRollRow({
    actor: mover,
    row: { combatant: mover, d: pd.atk ? testBreakdown('Athlétisme', distraireAttackValue(mover), pd.atk, 'intermediaire') : undefined },
    onRoll: roll,
    rerolled: !!pd.rerolled,
    // Égalité comprise : l'opposition n'est pas emportée (LDB 17 l.68).
    lost: pd.result !== 'success',
    onReroll: reroll,
    onBonusSL: bonusSL,
    onDarkPact: darkPact,
    onForce: force,
  }, {
    rollLabel: 'Lancer',
    // Résilience AVANT le jet (LDB 17 l.68) : Athlétisme forcé à l'emporter.
    preRollForce: () => { roll(); force(); },
  });

  const issue = pd.atk
    ? [recapLineOfEvent(ev(pd.result === 'success' ? 'dodge' : 'attack', describeDistraire(pd, mover.label, foe.label), mover.id, foe.id), battle.combatants)]
    : undefined;

  const actions: RollAction[] = [
    { key: 'cancel', label: 'Renoncer', onClick: cancel, when: 'pre' },
    { key: 'confirm', label: 'Appliquer', onClick: confirm, when: 'post' },
  ];

  return (
    <RollShell
      flowKey="distraire"
      stake={flowStakeRef('distraire-roll')}
      title="Distraire"
      extra={<VsHeader actor={mover} target={foe} label="détourner son attention (Athlétisme vs Calme)" />}
      // Choix de la cible AVANT le jet (plusieurs adversaires en Ligne de vue) — OptionChooser partagé.
      setup={foes.length > 1 && (
        <OptionChooser
          layout="seg"
          groupLabel="Cible"
          options={foes.map((f) => ({ key: f.id, label: f.label, selected: f.id === foe.id, onSelect: () => setFoe(f.id) }))}
        />
      )}
      rows={[foeRow, actorRow]}
      rolled={rolled}
      winnerIndex={winnerIndex}
      outcome={issue}
      actions={actions}
      onCancel={rolled ? undefined : cancel}
    />
  );
}
