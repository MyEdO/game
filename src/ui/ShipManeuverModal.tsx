import { useGame } from '../state/store';
import { useOwns } from './ownership';
import { easeDifficulty } from '../engine/tests';
import { findCrewRoleById } from '../data';
import { crewRoleValue } from '../engine/crewMorale';
import { maneuverCrewTotal, deriveManeuverFromCrew } from '../state/shipManeuver';
import { RollShell, type RollAction } from './RollShell';
import type { BuiltRollRow } from './rollRowBuild';
import { buildParticipantRows, rollAllUnrolledRows } from './buildParticipantRows';
import { testBreakdown, testPending } from './breakdown';
import { OptionChooser, type RollOption } from './OptionChooser';
import { Icon } from './Icon';
import { resultLine, freeCons } from '../state/rollSeam';

/** Virages proposés (MDG 13 — angle abstrait, choix d'UX) : crans d'octant signés (±1 = 45°, ±2 = 90°). */
const TURN_OPTIONS: { key: string; label: string; steps: number }[] = [
  { key: 'b90', label: '⟲ Bâbord 90°', steps: -2 },
  { key: 'b45', label: '↰ Bâbord 45°', steps: -1 },
  { key: 'straight', label: '↑ Tout droit', steps: 0 },
  { key: 't45', label: '↱ Tribord 45°', steps: 1 },
  { key: 't90', label: '⟳ Tribord 90°', steps: 2 },
];

/**
 * Modale de MANŒUVRE navale = TEST D'ÉQUIPAGE (MDG 13-14) — flux MULTI, patron `ForceDoorModal`. Pré-jet : choix
 * du virage (`OptionChooser` → `shipManeuverSetTurn`, ⟂ jet). Chaque rôle tenu = une `RollRow` : un PJ lance
 * SON Test (Chance/+1 DR/Pacte/Résilience sur SON jet, gaté par la possession locale — `ui/ownership`) ; un marin PNJ est un TÉMOIN auto-roulé.
 * Le bandeau somme les DR (essentiel ×2) + Moral → DR final ; « Manœuvrer » vire le cap + avance (`…Confirm`).
 */
export function ShipManeuverModal() {
  const p = useGame((s) => s.pendingShipManeuver);
  const battle = useGame((s) => s.battle);
  const owns = useOwns(); // possession locale à l'affichage (#1262) — hook : AVANT tout retour anticipé
  const setTurn = useGame((s) => s.shipManeuverSetTurn);
  const roll = useGame((s) => s.shipManeuverRoll);
  const reroll = useGame((s) => s.shipManeuverReroll);
  const bonus = useGame((s) => s.shipManeuverBonusSL);
  const darkPact = useGame((s) => s.shipManeuverDarkPact);
  const force = useGame((s) => s.shipManeuverForceSuccess);
  const confirm = useGame((s) => s.shipManeuverConfirm);
  const cancel = useGame((s) => s.shipManeuverCancel);
  if (!p || !battle) return null;
  const ship = battle.combatants.find((c) => c.id === p.shipId);
  if (!ship) return null;

  const allRolled = p.participants.every((x) => x.result);
  const rollAll = rollAllUnrolledRows(p.participants, roll, (x) => !!x.interactive && owns(x.id));
  const total = maneuverCrewTotal(p.participants, p.essentialRoleId, p.moraleScore, p.undercrew, p.extraDR);
  const result = allRolled ? deriveManeuverFromCrew(ship, total) : null;
  const turnOptions: RollOption[] = TURN_OPTIONS.map((o) => ({
    key: o.key, label: o.label, selected: p.turnSteps === o.steps,
    onSelect: () => setTurn(o.steps),
  }));
  const plural = (n: number) => (n > 1 ? 's' : '');

  // Rangées via le builder mutualisé (#328) — présentation crew-roles ici, éligibilité dans le builder.
  const rows: BuiltRollRow[] = buildParticipantRows(p.participants, battle.combatants, {
    onRoll: roll, onReroll: reroll, onBonusSL: bonus, onDarkPact: darkPact, onForce: force,
    interactiveOf: (part) => !!part.interactive && owns(part.id),
    row: (part, actor, res) => {
      const role = findCrewRoleById(part.roleId);
      const val = role ? crewRoleValue(actor, role).value : 0;
      const label = `${role?.label ?? part.roleId}${part.essential ? ' ★' : ''}`;
      // Manque de bras (MDG 14 l.53) : marin déjà engagé ce Round → +2 crans de Difficulté (−20), itemisé.
      const difficulty = part.cumul ? easeDifficulty('intermediaire', -2) : undefined;
      return res
        ? { combatant: actor, d: testBreakdown(label, val, { roll: res.roll, target: res.target, sl: res.sl }, difficulty) }
        : { combatant: actor, pending: testPending(label, val, undefined, difficulty) };
    },
    note: (part, _actor, res) => <div className="cs-outcome ok-text">{resultLine(freeCons([part.essential ? `${res.sl >= 0 ? '+' : ''}${res.sl} DR ×2` : `${res.sl >= 0 ? '+' : ''}${res.sl} DR`]))}</div>,
  });

  const actions: RollAction[] = [
    { key: 'cancel', label: 'Annuler', onClick: cancel, when: 'always' },
    ...(rollAll ? [{ key: 'rollAll', label: <><Icon id="nav/dice" size="sm" /> Tout lancer</>, onClick: rollAll, when: 'pre' as const }] : []),
    { key: 'confirm', label: 'Manœuvrer', onClick: confirm, when: 'always', disabled: !allRolled },
  ];

  return (
    <RollShell
      flowKey="shipManeuver"
      title={<><Icon id="action/steer-ship" size="sm" /> Manœuvre — Test d’équipage</>}
      subtitle={<><strong>{ship.label}</strong> — {p.participants.length} rôle{plural(p.participants.length)} à la manœuvre (DR sommés)</>}
      extra={<OptionChooser layout="grid" groupLabel="Virage" options={turnOptions} />}
      rows={rows}
      rolled={allRolled}
      summary={allRolled && result
        ? <>DR d’équipage <b>{total}</b> → DR final <b>{result.dr}</b> : {result.success
            ? `cap viré, ${ship.label} avance de ${result.movement} case${plural(result.movement)}.`
            : `manœuvre ratée — le cap tient ; avance de ${result.movement} case${plural(result.movement)}.`}</>
        : undefined}
      actions={actions}
      onCancel={cancel}
    />
  );
}
