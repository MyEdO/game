import { useGame } from '../state/store';
import { useOwns } from './ownership';
import { easeDifficulty } from '../engine/tests';
import { findCrewRoleById } from '../data';
import { crewRoleValue } from '../engine/crewMorale';
import { maneuverCrewTotal } from '../state/shipManeuver';
import { RollShell, type RollAction } from './RollShell';
import type { BuiltRollRow } from './rollRowBuild';
import { buildParticipantRows, rollAllUnrolledRows } from './buildParticipantRows';
import { Icon } from './Icon';
import { testBreakdown, testPending } from './breakdown';
import { itemLabel } from '../engine/items';

/**
 * Modale du TIR DE BATTERIE (« bordée », MDG 14 l.128) — JUMEAU de `ShipManeuverModal` (flux MULTI,
 * `RollShell` + `RollRow`). Chaque Artilleur tenu = une rangée (PJ influençable / marin témoin) ;
 * le bandeau somme les DR (essentiel ×2) + Moral → le **DR PARTAGÉ** qui s'applique à TOUTES les pièces du bord
 * (l.128). Pas de virage : `extra` montre la cible + les pièces qui tirent. « Feu ! » résout la volée (`shipBatteryConfirm`).
 */
export function ShipBatteryModal() {
  const p = useGame((s) => s.pendingShipBattery);
  const battle = useGame((s) => s.battle);
  const owns = useOwns(); // possession locale à l'affichage (#1262) — hook : AVANT tout retour anticipé
  const roll = useGame((s) => s.shipBatteryRoll);
  const reroll = useGame((s) => s.shipBatteryReroll);
  const bonus = useGame((s) => s.shipBatteryBonusSL);
  const darkPact = useGame((s) => s.shipBatteryDarkPact);
  const force = useGame((s) => s.shipBatteryForceSuccess);
  const confirm = useGame((s) => s.shipBatteryConfirm);
  const cancel = useGame((s) => s.shipBatteryCancel);
  if (!p || !battle) return null;
  const ship = battle.combatants.find((c) => c.id === p.shipId);
  const target = battle.combatants.find((c) => c.id === p.targetId);
  if (!ship || !target) return null;

  const allRolled = p.participants.every((x) => x.result);
  const rollAll = rollAllUnrolledRows(p.participants, roll, (x) => !!x.interactive && owns(x.id));
  const dr = maneuverCrewTotal(p.participants, p.essentialRoleId, p.moraleScore, p.undercrew, p.extraDR); // DR PARTAGÉ (essentiel ×2 + Moral + Manque de bras + sabotage)
  const postes = (ship.postes ?? []).filter((pp) => pp.side === p.side);
  const plural = (n: number) => (n > 1 ? 's' : '');
  const sign = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

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
    note: (part, _actor, res) => <div className="cs-outcome ok-text">{part.essential ? `${sign(res.sl)} DR ×2` : `${sign(res.sl)} DR`}</div>,
  });

  const actions: RollAction[] = [
    { key: 'cancel', label: 'Annuler', onClick: cancel, when: 'always' },
    ...(rollAll ? [{ key: 'rollAll', label: <><Icon id="nav/dice" size="sm" /> Tout lancer</>, onClick: rollAll, when: 'pre' as const }] : []),
    { key: 'confirm', label: <><Icon id="fire/flame" size="sm" /> Feu !</>, onClick: confirm, when: 'always', disabled: !allRolled },
  ];

  return (
    <RollShell
      flowKey="shipBattery"
      title={<><Icon id="action/aim" size="sm" /> Tir de batterie — Test d’équipage</>}
      subtitle={<><strong>{ship.label}</strong> — bordée {p.side} sur <strong>{target.label}</strong> ({postes.length} pièce{plural(postes.length)})</>}
      extra={
        <div className="rm-note" data-ton="menace">
          <Icon id="action/aim" size="sm" /> {target.label} — Coque {target.wounds.current}/{target.wounds.max}. {postes.length} pièce{plural(postes.length)} : {postes.map((pp) => itemLabel(pp.item)).join(' · ')}.
        </div>
      }
      rows={rows}
      rolled={allRolled}
      summary={allRolled
        ? <>DR PARTAGÉ <b>{sign(dr)}</b> → chaque pièce inflige (Dégâts {sign(dr)}) ; volée de {postes.length} pièce{plural(postes.length)} (l.128).</>
        : undefined}
      actions={actions}
      onCancel={cancel}
    />
  );
}
